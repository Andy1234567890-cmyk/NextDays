"""Plattform-Backoffice — Basisdienste (Identität, Audit-Protokoll).

Dieser Slice ist der EINZIGE, der bewusst mandantenübergreifend arbeitet. Alle
anderen Slices scopen hart auf tenant_id (Wurzel 3). Die Berechtigung dafür
prüft der Guard (core.security.get_current_platform_admin) bei jedem Request
frisch gegen public.platform_admins.

Der Service-Client umgeht RLS — das ist hier gewollt und der Grund, warum der
Zugang so eng bewacht ist.
"""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Request
from supabase import Client

from src.core.logging import get_logger
from src.core.security import PlatformContext

from . import audit
from .schemas import (
    AuditEntry,
    AuditList,
    FinanzKennzahlen,
    FinanzUebersicht,
    ModerationList,
    ModerationProperty,
    PlatformFeeRow,
    PlatformGuest,
    PlatformGuestList,
    PlatformMe,
    PlatformUser,
    PlatformUserList,
    SupportMessage,
    SupportTicket,
    SupportTicketDetail,
    SupportTicketList,
    TenantDetail,
    TenantList,
    TenantSummary,
    VorgangEintrag,
    VorgangList,
)

log = get_logger("nextdays.platform_admin")

# Harte Obergrenze je Abfrage (Wurzel 8: kein unbegrenzter Bereich).
_MAX_LIMIT = 200

# Obergrenze für die Finanz-Aggregation. Python-seitige Summen sind nur bis zu
# dieser Größe vertretbar; darüber gehört die Aggregation in die DB (View/RPC).
_AGGREGAT_LIMIT = 5000

# Spalten aus public.tenants, die in die Backoffice-Sicht übernommen werden.
# Explizit statt per model_fields-Introspektion: so ist beim Lesen sichtbar,
# welche Felder das Backoffice sieht, und ein neues Schema-Feld leakt nicht
# versehentlich Daten, die hier nichts zu suchen haben.
_TENANT_COLUMNS = (
    "id",
    "name",
    "country",
    "currency",
    "account_type",
    "business_type",
    "created_at",
)


def _tenant_base(row: dict) -> dict:
    """Nur die freigegebenen tenants-Spalten aus einer DB-Zeile."""
    return {k: v for k, v in row.items() if k in _TENANT_COLUMNS}


# Spalten, die die Freigabe-Warteschlange aus properties liest. Bewusst knapp:
# der Betreiber braucht zur Prüfung Titel, Ort, Fotos und Kapazität — nicht die
# vollständige Objektzeile (kein unnötiger Einblick in fremde Mandantendaten).
_MODERATION_FIELDS = (
    "id",
    "tenant_id",
    "title",
    "city",
    "country",
    "status",
    "moderation_status",
    "moderation_note",
    "moderation_submitted_at",
    "moderation_reviewed_at",
    "photos",
    "max_guests",
    "currency",
)
_MODERATION_COLUMNS = ", ".join(_MODERATION_FIELDS)


class PlatformAdminService:
    def __init__(self, db: Client) -> None:
        self._db = db

    @property
    def db(self) -> Client:
        """Der Service-Client, damit verwandte Slices (Diagnose) ihn
        mitnutzen können, ohne einen zweiten aufzubauen."""
        return self._db

    def log_action(
        self,
        ctx: PlatformContext,
        action: str,
        *,
        target_type: str | None = None,
        target_id: str | None = None,
        tenant_id: str | None = None,
        detail: dict | None = None,
        request: Request | None = None,
    ) -> None:
        """Eine Backoffice-Aktion protokollieren (siehe audit.record).

        Liegt am Service, damit die Router nicht auf den DB-Client zugreifen
        müssen — ein Router kennt nur den Service.
        """
        audit.record(
            self._db,
            ctx,
            action,
            target_type=target_type,
            target_id=target_id,
            tenant_id=tenant_id,
            detail=detail,
            request=request,
        )

    @staticmethod
    def me(ctx: PlatformContext) -> PlatformMe:
        """Identität + Rolle des eingeloggten Backoffice-Nutzers."""
        return PlatformMe(
            user_id=ctx.user_id,
            email=ctx.email,
            platform_role=ctx.platform_role,
            can_write=ctx.is_admin,
        )

    def audit(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        action: str | None = None,
        tenant_id: str | None = None,
        actor_user_id: str | None = None,
    ) -> AuditList:
        """Backoffice-Protokoll lesen (neueste zuerst), optional gefiltert.

        limit ist hart gedeckelt; offset/limit werden auf sinnvolle Werte
        geklemmt, damit ein manipulierter Query-Parameter keine Vollabfrage
        auslöst (Wurzel 8).
        """
        limit = max(1, min(_MAX_LIMIT, limit))
        offset = max(0, offset)

        query = (
            self._db.table("platform_audit_log")
            .select("*", count="exact")
            .order("created_at", desc=True)
        )
        if action:
            query = query.eq("action", action)
        if tenant_id:
            query = query.eq("tenant_id", tenant_id)
        if actor_user_id:
            query = query.eq("actor_user_id", actor_user_id)

        res = query.range(offset, offset + limit - 1).execute()
        return AuditList(
            items=[AuditEntry(**row) for row in (res.data or [])],
            total=res.count or 0,
        )

    # -- Betriebe (Tenants) ------------------------------------------------

    def tenants(
        self, *, limit: int = 50, offset: int = 0, suche: str | None = None
    ) -> TenantList:
        """Alle Betriebe der Plattform (neueste zuerst), optional nach Name
        gefiltert. Die Objekt-/Nutzerzahlen werden in zwei Sammelabfragen
        ergänzt — nicht je Zeile (kein N+1)."""
        limit = max(1, min(_MAX_LIMIT, limit))
        offset = max(0, offset)

        query = (
            self._db.table("tenants")
            .select("*", count="exact")
            .order("created_at", desc=True)
        )
        if suche:
            query = query.ilike("name", f"%{suche}%")
        res = query.range(offset, offset + limit - 1).execute()
        rows = res.data or []
        ids = [r["id"] for r in rows]

        props = self._property_counts(ids)
        users = self._user_counts(ids)
        return TenantList(
            items=[
                TenantSummary(
                    **_tenant_base(r),
                    property_count=props.get(r["id"], (0, 0))[0],
                    active_property_count=props.get(r["id"], (0, 0))[1],
                    user_count=users.get(r["id"], 0),
                )
                for r in rows
            ],
            total=res.count or 0,
        )

    def tenant(self, tenant_id: str) -> TenantDetail | None:
        """Ein Betrieb im Detail inkl. Zahlungs-/Abo-Status. None = unbekannt."""
        rows = (
            self._db.table("tenants")
            .select("*")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        row = rows[0]

        props = self._property_counts([tenant_id])
        users = self._user_counts([tenant_id])

        billing = (
            self._db.table("tenant_billing_profile")
            .select("stripe_charges_enabled, stripe_account_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        sub = (
            self._db.table("tenant_subscription")
            .select("status")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []

        return TenantDetail(
            **_tenant_base(row),
            property_count=props.get(tenant_id, (0, 0))[0],
            active_property_count=props.get(tenant_id, (0, 0))[1],
            user_count=users.get(tenant_id, 0),
            stripe_charges_enabled=bool(
                billing[0].get("stripe_charges_enabled") if billing else False
            ),
            stripe_account_id=(
                billing[0].get("stripe_account_id") if billing else None
            ),
            subscription_status=sub[0].get("status") if sub else None,
        )

    def _property_counts(self, tenant_ids: list[str]) -> dict[str, tuple[int, int]]:
        """(gesamt, aktiv) Objekte je Tenant in EINER Abfrage."""
        if not tenant_ids:
            return {}
        rows = (
            self._db.table("properties")
            .select("tenant_id, status")
            .in_("tenant_id", tenant_ids)
            .execute()
        ).data or []
        out: dict[str, tuple[int, int]] = {}
        for r in rows:
            tid = r.get("tenant_id")
            if not tid:
                continue
            gesamt, aktiv = out.get(tid, (0, 0))
            out[tid] = (gesamt + 1, aktiv + (1 if r.get("status") == "active" else 0))
        return out

    def _user_counts(self, tenant_ids: list[str]) -> dict[str, int]:
        """Nutzerzahl je Tenant in EINER Abfrage."""
        if not tenant_ids:
            return {}
        rows = (
            self._db.table("users")
            .select("tenant_id")
            .in_("tenant_id", tenant_ids)
            .execute()
        ).data or []
        out: dict[str, int] = {}
        for r in rows:
            tid = r.get("tenant_id")
            if tid:
                out[tid] = out.get(tid, 0) + 1
        return out

    # -- Registrierungen ---------------------------------------------------

    def users(
        self, *, limit: int = 50, offset: int = 0, tenant_id: str | None = None
    ) -> PlatformUserList:
        """Betriebs-Nutzer (Supply-Seite), neueste zuerst. Der Betriebsname wird
        in einer Sammelabfrage ergänzt (kein N+1)."""
        limit = max(1, min(_MAX_LIMIT, limit))
        offset = max(0, offset)

        query = (
            self._db.table("users")
            .select("id, tenant_id, email, full_name, role, created_at", count="exact")
            .order("created_at", desc=True)
        )
        if tenant_id:
            query = query.eq("tenant_id", tenant_id)
        res = query.range(offset, offset + limit - 1).execute()
        rows = res.data or []

        namen = self._tenant_names([r["tenant_id"] for r in rows if r.get("tenant_id")])
        return PlatformUserList(
            items=[
                PlatformUser(**r, tenant_name=namen.get(r.get("tenant_id") or ""))
                for r in rows
            ],
            total=res.count or 0,
        )

    def guests(
        self, *, limit: int = 50, offset: int = 0, suche: str | None = None
    ) -> PlatformGuestList:
        """Plattform-Gäste (Demand-Seite, portal_guests), neueste zuerst."""
        limit = max(1, min(_MAX_LIMIT, limit))
        offset = max(0, offset)

        query = (
            self._db.table("portal_guests")
            .select(
                "id, email, name, preferred_locale, preferred_currency, "
                "marketing_opt_in, created_at",
                count="exact",
            )
            .order("created_at", desc=True)
        )
        if suche:
            query = query.ilike("email", f"%{suche}%")
        res = query.range(offset, offset + limit - 1).execute()
        return PlatformGuestList(
            items=[PlatformGuest(**r) for r in (res.data or [])],
            total=res.count or 0,
        )

    def _tenant_names(self, tenant_ids: list[str | None]) -> dict[str, str]:
        """id → name für eine Menge von Betrieben (eine Abfrage).

        None-Einträge sind erlaubt und werden ignoriert: Support-Tickets von
        Plattform-Gästen haben keinen Betrieb.
        """
        eindeutig = list({t for t in tenant_ids if t})
        if not eindeutig:
            return {}
        rows = (
            self._db.table("tenants")
            .select("id, name")
            .in_("id", eindeutig)
            .execute()
        ).data or []
        return {r["id"]: r["name"] for r in rows}

    # -- Objekt-Freigabe (Marktplatz) --------------------------------------

    def moderation_queue(
        self, *, status_filter: str = "pending", limit: int = 50, offset: int = 0
    ) -> ModerationList:
        """Objekte in der Freigabe-Warteschlange.

        Standardmäßig die wartenden (älteste Einreichung zuerst — wer zuerst
        eingereicht hat, wird zuerst geprüft).
        """
        limit = max(1, min(_MAX_LIMIT, limit))
        offset = max(0, offset)

        query = (
            self._db.table("properties")
            .select(_MODERATION_COLUMNS, count="exact")
            .eq("moderation_status", status_filter)
        )
        # Wartende nach Einreichung, alles andere nach letzter Entscheidung.
        if status_filter == "pending":
            query = query.order("moderation_submitted_at", desc=False)
        else:
            query = query.order("moderation_reviewed_at", desc=True)

        res = query.range(offset, offset + limit - 1).execute()
        rows = res.data or []
        namen = self._tenant_names([r["tenant_id"] for r in rows if r.get("tenant_id")])
        return ModerationList(
            items=[
                ModerationProperty(
                    **r, tenant_name=namen.get(r.get("tenant_id") or "")
                )
                for r in rows
            ],
            total=res.count or 0,
        )

    def decide(
        self,
        property_id: str,
        *,
        approve: bool,
        reviewer_user_id: str,
        note: str | None,
    ) -> ModerationProperty | None:
        """Ein Objekt freigeben oder ablehnen. None = Objekt unbekannt.

        Bewusst OHNE tenant-Scope: das ist die eine Stelle, an der der Betreiber
        mandantenübergreifend eingreift. Der Guard require_platform_write hat die
        Berechtigung vorher geprüft.
        """
        felder = {
            "moderation_status": "approved" if approve else "rejected",
            "moderation_note": note,
            "moderation_reviewed_by": reviewer_user_id,
            "moderation_reviewed_at": datetime.now(UTC).isoformat(),
        }
        upd = (
            self._db.table("properties")
            .update(felder)
            .eq("id", property_id)
            .execute()
        ).data
        if not upd:
            return None
        row = upd[0]
        namen = self._tenant_names([row.get("tenant_id")])
        log.info(
            "property_moderation_decided",
            property_id=property_id,
            approved=approve,
            reviewer=reviewer_user_id,
        )
        return ModerationProperty(
            **{k: v for k, v in row.items() if k in _MODERATION_FIELDS},
            tenant_name=namen.get(row.get("tenant_id") or ""),
        )

    # -- Stripe & Finanzen --------------------------------------------------

    def finanzen(self, *, limit: int = 50) -> FinanzUebersicht:
        """Aggregierte Finanzsicht über alle Betriebe.

        Die Kennzahlen werden JE WÄHRUNG getrennt ausgewiesen — eine Summe über
        verschiedene Währungen bräuchte einen Umrechnungskurs, den wir hier nicht
        erfinden (Wurzel 4). Beträge bleiben in Cent; die Anzeige formatiert.
        """
        limit = max(1, min(_MAX_LIMIT, limit))

        # Alle Provisionszeilen für die Aggregation. Die Obergrenze schützt vor
        # einer Vollabfrage, sobald das Volumen wächst — dann muss hier eine
        # DB-seitige Aggregation (View/RPC) her statt Python-Summen.
        rows = (
            self._db.table("platform_fees")
            .select(
                "id, tenant_id, reservation_id, fee_bps, gross_amount_cents, "
                "fee_amount_cents, reversed_amount_cents, currency, gateway, "
                "status, created_at"
            )
            .order("created_at", desc=True)
            .limit(_AGGREGAT_LIMIT)
            .execute()
        ).data or []

        je_waehrung: dict[str, FinanzKennzahlen] = {}
        for r in rows:
            # Ohne Währung lässt sich nichts sinnvoll summieren → überspringen
            # statt einer Sammelkategorie mit gemischten Währungen.
            waehrung = r.get("currency")
            if not waehrung:
                continue
            k = je_waehrung.setdefault(
                waehrung, FinanzKennzahlen(currency=waehrung)
            )
            k.gross_amount_cents += int(r.get("gross_amount_cents") or 0)
            k.fee_amount_cents += int(r.get("fee_amount_cents") or 0)
            k.reversed_amount_cents += int(r.get("reversed_amount_cents") or 0)
            k.fee_count += 1

        letzte_rows = rows[:limit]
        namen = self._tenant_names(
            [r["tenant_id"] for r in letzte_rows if r.get("tenant_id")]
        )

        return FinanzUebersicht(
            kennzahlen=sorted(
                je_waehrung.values(), key=lambda k: -k.fee_amount_cents
            ),
            letzte=[
                PlatformFeeRow(**r, tenant_name=namen.get(r.get("tenant_id") or ""))
                for r in letzte_rows
            ],
            tenants_ohne_zahlung=self._tenants_ohne_zahlung(),
            abos=self._abo_verteilung(),
        )

    def _tenants_ohne_zahlung(self) -> int:
        """Betriebe ohne freigeschaltete Stripe-Zahlungen.

        Zählt auch Betriebe MIT Profil, bei denen charges_enabled false ist —
        beide Fälle bedeuten: dieser Betrieb kann nicht verkaufen.
        """
        alle = (
            self._db.table("tenants").select("id").execute()
        ).data or []
        bereit = (
            self._db.table("tenant_billing_profile")
            .select("tenant_id")
            .eq("stripe_charges_enabled", True)
            .execute()
        ).data or []
        bereit_ids = {r["tenant_id"] for r in bereit if r.get("tenant_id")}
        return sum(1 for t in alle if t["id"] not in bereit_ids)

    def _abo_verteilung(self) -> dict[str, int]:
        """Abo-Status über alle Betriebe (status → Anzahl)."""
        rows = (
            self._db.table("tenant_subscription").select("status").execute()
        ).data or []
        out: dict[str, int] = {}
        for r in rows:
            s = r.get("status") or "unbekannt"
            out[s] = out.get(s, 0) + 1
        return out

    # -- Support ------------------------------------------------------------

    def tickets(
        self, *, status_filter: str | None = None, limit: int = 50, offset: int = 0
    ) -> SupportTicketList:
        """Support-Tickets, zuletzt aktive zuerst."""
        limit = max(1, min(_MAX_LIMIT, limit))
        offset = max(0, offset)

        query = (
            self._db.table("support_tickets")
            .select("*", count="exact")
            .order("last_message_at", desc=True)
        )
        if status_filter:
            query = query.eq("status", status_filter)
        res = query.range(offset, offset + limit - 1).execute()
        rows = res.data or []
        namen = self._tenant_names([r.get("tenant_id") for r in rows])
        return SupportTicketList(
            items=[
                SupportTicket(**r, tenant_name=namen.get(r.get("tenant_id") or ""))
                for r in rows
            ],
            total=res.count or 0,
        )

    def ticket(self, ticket_id: str) -> SupportTicketDetail | None:
        """Ein Ticket mit vollem Verlauf. None = unbekannt.

        Im Backoffice werden AUCH interne Notizen geliefert — anders als auf
        einem künftigen Melder-Endpunkt, der internal=true herausfiltern muss.
        """
        rows = (
            self._db.table("support_tickets")
            .select("*")
            .eq("id", ticket_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None
        row = rows[0]
        msgs = (
            self._db.table("support_messages")
            .select("*")
            .eq("ticket_id", ticket_id)
            .order("created_at", desc=False)
            .execute()
        ).data or []
        namen = self._tenant_names([row.get("tenant_id")])
        return SupportTicketDetail(
            **row,
            tenant_name=namen.get(row.get("tenant_id") or ""),
            messages=[SupportMessage(**m) for m in msgs],
        )

    def reply(
        self, ticket_id: str, *, author_user_id: str, body: str, internal: bool
    ) -> SupportMessage | None:
        """Antwort oder interne Notiz anhängen. None = Ticket unbekannt.

        Aktualisiert last_message_at, damit die Liste nach echter Aktivität
        sortiert. Eine INTERNE Notiz zählt bewusst auch als Aktivität — für das
        Team ist sie relevant, für den Melder bleibt sie unsichtbar.
        """
        vorhanden = (
            self._db.table("support_tickets")
            .select("id")
            .eq("id", ticket_id)
            .limit(1)
            .execute()
        ).data or []
        if not vorhanden:
            return None

        jetzt = datetime.now(UTC).isoformat()
        res = (
            self._db.table("support_messages")
            .insert(
                {
                    "ticket_id": ticket_id,
                    "author_kind": "agent",
                    "author_user_id": author_user_id,
                    "body": body,
                    "internal": internal,
                }
            )
            .execute()
        ).data
        self._db.table("support_tickets").update(
            {"last_message_at": jetzt, "updated_at": jetzt}
        ).eq("id", ticket_id).execute()
        return SupportMessage(**res[0])

    def update_ticket(
        self, ticket_id: str, felder: dict[str, str | None]
    ) -> SupportTicket | None:
        """Status/Priorität/Zuweisung ändern. None = Ticket unbekannt."""
        gesetzt = {k: v for k, v in felder.items() if v is not None}
        if not gesetzt:
            detail = self.ticket(ticket_id)
            return SupportTicket(**detail.model_dump()) if detail else None

        gesetzt["updated_at"] = datetime.now(UTC).isoformat()
        upd = (
            self._db.table("support_tickets")
            .update(gesetzt)
            .eq("id", ticket_id)
            .execute()
        ).data
        if not upd:
            return None
        row = upd[0]
        namen = self._tenant_names([row.get("tenant_id")])
        return SupportTicket(
            **row, tenant_name=namen.get(row.get("tenant_id") or "")
        )

    # -- Vorgangshistorie eines Betriebs -----------------------------------

    def vorgaenge(self, tenant_id: str, *, limit: int = 100) -> VorgangList:
        """Fachliche Vorgänge eines Betriebs, neueste zuerst.

        Führt vier bestehende Quellen zusammen — es wird NICHTS zusätzlich
        aufgezeichnet, nur sichtbar gemacht, was der Betrieb ohnehin
        protokolliert:

          • reservation_events            — Buchung angelegt/geändert
          • reservation_cancellation_log  — Stornierungen samt Grund
          • login_devices                 — Anmeldungen (Gerät, Ort)
          • inbox_assignment_log          — Zuweisung von Konversationen

        Bewusst KEINE Klickpfade oder Seitenaufrufe: das wäre
        Verhaltenskontrolle. Hier geht es um Geschäftsvorgänge, die der Support
        nachvollziehen können muss („wer hat die Buchung storniert?").
        """
        limit = max(1, min(_MAX_LIMIT, limit))
        eintraege: list[VorgangEintrag] = []

        eintraege += self._vorgaenge_reservierung(tenant_id, limit)
        eintraege += self._vorgaenge_stornierung(tenant_id, limit)
        eintraege += self._vorgaenge_zuweisung(tenant_id, limit)
        eintraege += self._vorgaenge_anmeldung(tenant_id, limit)

        # E-Mails in EINER Sammelabfrage nachziehen (kein N+1).
        mails = self._user_emails([e.user_id for e in eintraege])
        for e in eintraege:
            e.user_email = mails.get(e.user_id or "")

        eintraege.sort(key=lambda e: e.created_at, reverse=True)
        return VorgangList(items=eintraege[:limit])

    def _vorgaenge_reservierung(
        self, tenant_id: str, limit: int
    ) -> list[VorgangEintrag]:
        rows = (
            self._db.table("reservation_events")
            .select("kind, by_user_id, detail, reservation_id, created_at")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        ).data or []
        beschriftung = {
            "created": "Buchung angelegt",
            "cancelled": "Buchung storniert",
            "modified": "Buchung geändert",
        }
        return [
            VorgangEintrag(
                quelle="reservierung",
                art=r.get("kind") or "unbekannt",
                beschreibung=beschriftung.get(
                    r.get("kind") or "", f"Buchung: {r.get('kind')}"
                ),
                user_id=r.get("by_user_id"),
                ziel_id=r.get("reservation_id"),
                detail=r.get("detail") or {},
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def _vorgaenge_stornierung(
        self, tenant_id: str, limit: int
    ) -> list[VorgangEintrag]:
        rows = (
            self._db.table("reservation_cancellation_log")
            .select("reservation_id, by_user_id, reason, channel, ota_name, created_at")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        ).data or []
        return [
            VorgangEintrag(
                quelle="stornierung",
                art="cancelled",
                beschreibung=(
                    f"Storniert über {r.get('ota_name') or r.get('channel') or 'unbekannt'}"
                ),
                user_id=r.get("by_user_id"),
                ziel_id=r.get("reservation_id"),
                detail={
                    k: v
                    for k, v in (("grund", r.get("reason")), ("kanal", r.get("channel")))
                    if v
                },
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def _vorgaenge_zuweisung(
        self, tenant_id: str, limit: int
    ) -> list[VorgangEintrag]:
        rows = (
            self._db.table("inbox_assignment_log")
            .select("thread_id, from_user_id, to_user_id, by_user_id, created_at")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        ).data or []
        return [
            VorgangEintrag(
                quelle="zuweisung",
                art="assigned",
                beschreibung="Konversation zugewiesen",
                user_id=r.get("by_user_id"),
                ziel_id=r.get("thread_id"),
                detail={
                    "von": r.get("from_user_id"),
                    "an": r.get("to_user_id"),
                },
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def _vorgaenge_anmeldung(
        self, tenant_id: str, limit: int
    ) -> list[VorgangEintrag]:
        """Anmeldungen der Nutzer dieses Betriebs.

        login_devices hat kein tenant_id — die Zuordnung läuft über die
        Nutzer des Betriebs. Ohne Nutzer keine Abfrage (statt einer
        ungescopten Vollabfrage).
        """
        users = (
            self._db.table("users")
            .select("id")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        ids = [u["id"] for u in users]
        if not ids:
            return []

        rows = (
            self._db.table("login_devices")
            .select("user_id, ip, user_agent, country, city, created_at")
            .in_("user_id", ids)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        ).data or []
        return [
            VorgangEintrag(
                quelle="anmeldung",
                art="login",
                beschreibung=(
                    "Anmeldung"
                    + (
                        f" aus {r.get('city') or r.get('country')}"
                        if (r.get("city") or r.get("country"))
                        else ""
                    )
                ),
                user_id=r.get("user_id"),
                detail={
                    k: v
                    for k, v in (
                        ("ip", r.get("ip")),
                        # Nur gekürzt — der volle User-Agent ist Rauschen.
                        ("geraet", (r.get("user_agent") or "")[:80] or None),
                    )
                    if v
                },
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def _user_emails(self, user_ids: list[str | None]) -> dict[str, str]:
        """id → E-Mail für eine Menge von Nutzern (eine Abfrage)."""
        eindeutig = list({u for u in user_ids if u})
        if not eindeutig:
            return {}
        rows = (
            self._db.table("users")
            .select("id, email")
            .in_("id", eindeutig)
            .execute()
        ).data or []
        return {r["id"]: r["email"] for r in rows if r.get("email")}
