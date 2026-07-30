"""Plattform-Backoffice — Basisdienste (Identität, Audit-Protokoll).

Dieser Slice ist der EINZIGE, der bewusst mandantenübergreifend arbeitet. Alle
anderen Slices scopen hart auf tenant_id (Wurzel 3). Die Berechtigung dafür
prüft der Guard (core.security.get_current_platform_admin) bei jedem Request
frisch gegen public.platform_admins.

Der Service-Client umgeht RLS — das ist hier gewollt und der Grund, warum der
Zugang so eng bewacht ist.
"""
from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import Request
from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import PlatformContext
from src.core.supabase import escape_like, fetch_all_rows

from . import audit
from .schemas import (
    AuditEntry,
    AuditList,
    BuchungDetail,
    BuchungGast,
    BuchungList,
    BuchungObjekt,
    BuchungProvision,
    BuchungSummary,
    BuchungZahlung,
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
    SteuerBetrieb,
    SteuerUebersicht,
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

# Wie viele Nachrichten die Ungelesen-Zählung höchstens betrachtet.
_UNREAD_SCAN = 500

# Länge der Vorschau der letzten Nachricht (Liste + Melder-Widget).
_PREVIEW_LEN = 160


def _vorschau(text: str) -> str:
    """Einzeilige Vorschau der letzten sichtbaren Nachricht."""
    flach = " ".join(text.split())
    if len(flach) <= _PREVIEW_LEN:
        return flach
    return flach[: _PREVIEW_LEN - 1].rstrip() + "…"

# Obergrenze für die Finanz-Aggregation. Python-seitige Summen sind nur bis zu
# dieser Größe vertretbar; darüber gehört die Aggregation in die DB (View/RPC).
_AGGREGAT_LIMIT = 5000

# Obergrenze aus § 23 Satz 2 PStTG: die Massnahme muss SPAETESTENS nach 180
# Tagen greifen. Wird sie das nicht, ist das fuer den BETREIBER bussgeldbewehrt
# (§ 25 Abs. 1 Nr. 6) — darum in der Pruefsicht sichtbar. Bewusst hier
# gespiegelt statt importiert: der platform_admin-Slice soll nicht vom
# taxpayer-Slice abhaengen.
_FRIST_SPAETESTENS_TAGE = 180

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


# Spalten der Buchungs-LISTE. Bewusst ohne Kontaktdaten (Telefon, Anschrift):
# die Liste wird überflogen, das Detail wird geöffnet — und nur dieses Öffnen
# ist der Vorgang, der mit tenant_id protokolliert gehört.
_BUCHUNG_LIST_FIELDS = (
    "id, tenant_id, property_id, guest_id, channel, status, payment_status, "
    "check_in, check_out, total_amount, paid_amount, currency, created_at"
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
            # Wildcards bleiben außen (Teilstring-Suche ist gewollt), der
            # EINGEGEBENE Teil wird escaped — sonst wirkt ein `%` im Suchtext
            # als zusätzliches Wildcard und liefert falsche Treffer.
            query = query.ilike("name", f"%{escape_like(suche)}%")
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
            query = query.ilike("email", f"%{escape_like(suche)}%")
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
        # fetch_all_rows statt .execute(): ab 1000 Betrieben schnitt PostgREST
        # die Listen still ab und die Backoffice-Kennzahl war zu niedrig
        # (Wurzel 8). Eine reine Differenz zweier counts wäre falsch, sobald
        # ein Billing-Profil ohne passenden Tenant existiert — deshalb weiter
        # ein echter Mengenvergleich, nur vollständig geladen.
        alle = fetch_all_rows(self._db.table("tenants").select("id").order("id"))
        bereit = fetch_all_rows(
            self._db.table("tenant_billing_profile")
            .select("tenant_id")
            .eq("stripe_charges_enabled", True)
            .order("tenant_id")
        )
        bereit_ids = {r["tenant_id"] for r in bereit if r.get("tenant_id")}
        return sum(1 for t in alle if t["id"] not in bereit_ids)

    def _abo_verteilung(self) -> dict[str, int]:
        """Abo-Status über alle Betriebe (status → Anzahl)."""
        rows = fetch_all_rows(
            self._db.table("tenant_subscription").select("status, tenant_id")
            .order("tenant_id")
        )
        out: dict[str, int] = {}
        for r in rows:
            s = r.get("status") or "unbekannt"
            out[s] = out.get(s, 0) + 1
        return out

    # -- Support ------------------------------------------------------------

    def tickets(
        self,
        *,
        status_filter: str | None = None,
        source: str | None = None,
        assignee_user_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> SupportTicketList:
        """Support-Konversationen, zuletzt aktive zuerst.

        `unread` ist die Zahl der Melder-Nachrichten, die jünger sind als der
        Lese-Cursor des Teams (agent_last_read_at) — dieselbe Rechnung wie beim
        Melder, nur aus der Gegenrichtung.
        """
        limit = max(1, min(_MAX_LIMIT, limit))
        offset = max(0, offset)

        query = (
            self._db.table("support_tickets")
            .select("*", count="exact")
            .order("last_message_at", desc=True)
        )
        if status_filter:
            query = query.eq("status", status_filter)
        if source:
            query = query.eq("source", source)
        if assignee_user_id:
            query = query.eq("assignee_user_id", assignee_user_id)
        res = query.range(offset, offset + limit - 1).execute()
        rows = res.data or []
        namen = self._tenant_names([r.get("tenant_id") for r in rows])
        ungelesen = self._ungelesen_je_ticket(rows)
        return SupportTicketList(
            items=[
                SupportTicket(
                    **r,
                    tenant_name=namen.get(r.get("tenant_id") or ""),
                    unread=ungelesen.get(r["id"], 0),
                )
                for r in rows
            ],
            total=res.count or 0,
        )

    def _ungelesen_je_ticket(self, rows: list[dict]) -> dict[str, int]:
        """Ungelesene Melder-Nachrichten je Konversation (eine Abfrage)."""
        ids = [r["id"] for r in rows]
        if not ids:
            return {}
        msgs = (
            self._db.table("support_messages")
            .select("ticket_id, created_at")
            .in_("ticket_id", ids)
            .eq("author_kind", "reporter")
            .order("created_at", desc=True)
            .limit(_UNREAD_SCAN)
            .execute()
        ).data or []
        cursor = {r["id"]: r.get("agent_last_read_at") for r in rows}
        gezaehlt: dict[str, int] = {tid: 0 for tid in ids}
        for m in msgs:
            gelesen_bis = cursor.get(m["ticket_id"])
            if gelesen_bis is None or m["created_at"] > gelesen_bis:
                gezaehlt[m["ticket_id"]] += 1
        return gezaehlt

    def mark_ticket_read(self, ticket_id: str) -> bool:
        """Lese-Cursor des Teams setzen. False = Ticket unbekannt."""
        upd = (
            self._db.table("support_tickets")
            .update({"agent_last_read_at": datetime.now(UTC).isoformat()})
            .eq("id", ticket_id)
            .execute()
        ).data
        return bool(upd)

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
            unread=self._ungelesen_je_ticket([row]).get(row["id"], 0),
            messages=[SupportMessage(**m) for m in msgs],
        )

    def reply(
        self,
        ticket_id: str,
        *,
        author_user_id: str,
        body: str,
        internal: bool,
        client_msg_id: str | None = None,
    ) -> SupportMessage | None:
        """Antwort oder interne Notiz anhängen. None = Ticket unbekannt.

        Aktualisiert last_message_at, damit die Liste nach echter Aktivität
        sortiert. Eine INTERNE Notiz zählt bewusst auch als Aktivität — für das
        Team ist sie relevant, für den Melder bleibt sie unsichtbar. Genau
        deshalb wird die VORSCHAU (last_message_preview) bei internen Notizen
        NICHT gesetzt: der Melder liest die Spalte per RLS mit (0205/0236).

        Idempotent über client_msg_id (Wurzel 2): der partielle UNIQUE-Index ist
        der Backstop, eine 23505 beim Retry ist der Erfolgspfad.
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
        try:
            res = (
                self._db.table("support_messages")
                .insert(
                    {
                        "ticket_id": ticket_id,
                        "author_kind": "agent",
                        "author_user_id": author_user_id,
                        "body": body,
                        "internal": internal,
                        "client_msg_id": client_msg_id,
                    }
                )
                .execute()
            ).data
        except APIError as exc:
            if getattr(exc, "code", None) != "23505" or not client_msg_id:
                raise
            bestehend = (
                self._db.table("support_messages")
                .select("*")
                .eq("ticket_id", ticket_id)
                .eq("client_msg_id", client_msg_id)
                .limit(1)
                .execute()
            ).data or []
            if not bestehend:
                raise
            return SupportMessage(**bestehend[0])

        felder: dict[str, str | None] = {
            "last_message_at": jetzt,
            "updated_at": jetzt,
            # Wer schreibt, hat gelesen.
            "agent_last_read_at": jetzt,
        }
        if not internal:
            felder["last_message_preview"] = _vorschau(body)
            felder["last_message_kind"] = "agent"
        self._db.table("support_tickets").update(felder).eq(
            "id", ticket_id
        ).execute()
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

    # -- Steuer-Compliance (Prüfsicht des Betreibers) ----------------------

    def steuer_uebersicht(self, *, nur_luecken: bool = False) -> SteuerUebersicht:
        """Steuerlicher Stand ALLER Betriebe.

        Warum diese Sicht existiert: Nach § 23 PStTG muss der Plattform-
        betreiber die Mitwirkung durchsetzen, und das Unterlassen ist selbst
        bußgeldbewehrt (§ 25 Abs. 1 Nr. 6, bis 30.000 EUR). Eine Oberfläche,
        die nur den Gastgeber fragt, erfüllt die Pflicht nicht — der Betreiber
        muss sehen können, wo etwas fehlt.

        Die Pflichtländer werden ODER-verknüpft abgeleitet: Sitzland des
        Betriebs ODER Land eines Objekts. Nur die Objektländer zu prüfen wäre
        zu eng — ein deutscher Betrieb mit ausschließlich spanischen Objekten
        ist auch in Deutschland meldepflichtig.
        """
        tenants = (
            self._db.table("tenants")
            .select("id, name, country")
            .order("name")
            .limit(_AGGREGAT_LIMIT)
            .execute()
        ).data or []
        if not tenants:
            return SteuerUebersicht(betriebe=[])

        ids = [t["id"] for t in tenants]
        objekte = self._objekt_stand(ids)
        erfasst = self._erfasste_laender(ids)
        mahnungen = self._mahnstand(ids)

        betriebe: list[SteuerBetrieb] = []
        for t in tenants:
            tid = t["id"]
            objekt_laender, gesamt, ohne_angabe = objekte.get(tid, (set(), 0, 0))
            pflicht = set(objekt_laender)
            if t.get("country"):
                pflicht.add(t["country"].upper())
            abgedeckt = erfasst.get(tid, set())
            offen, einbehalt, ueberfaellig = mahnungen.get(tid, (0, False, []))

            betriebe.append(
                SteuerBetrieb(
                    tenant_id=tid,
                    tenant_name=t.get("name"),
                    country=t.get("country"),
                    pflicht_laender=sorted(pflicht),
                    erfasste_laender=sorted(abgedeckt),
                    fehlende_laender=sorted(pflicht - abgedeckt),
                    objekte_gesamt=gesamt,
                    objekte_ohne_angabe=ohne_angabe,
                    mahnungen_offen=offen,
                    zahlungen_einbehalten=einbehalt,
                    ueberfaellig=sorted(ueberfaellig),
                )
            )

        sichtbar = (
            [b for b in betriebe if not b.vollstaendig] if nur_luecken else betriebe
        )
        return SteuerUebersicht(
            betriebe=sichtbar,
            betriebe_gesamt=len(betriebe),
            betriebe_vollstaendig=sum(1 for b in betriebe if b.vollstaendig),
            betriebe_mit_luecke=sum(1 for b in betriebe if b.fehlende_laender),
            betriebe_ueberfaellig=sum(1 for b in betriebe if b.ueberfaellig),
            zahlungen_einbehalten=sum(
                1 for b in betriebe if b.zahlungen_einbehalten
            ),
        )

    def _objekt_stand(
        self, tenant_ids: list[str]
    ) -> dict[str, tuple[set[str], int, int]]:
        """tenant_id → (Objektländer, Anzahl, davon ohne Grundbuchangabe)."""
        rows = (
            self._db.table("properties")
            .select(
                "tenant_id, country, land_registration_number, "
                "land_registration_unavailable"
            )
            .in_("tenant_id", tenant_ids)
            .limit(_AGGREGAT_LIMIT)
            .execute()
        ).data or []
        stand: dict[str, tuple[set[str], int, int]] = {}
        for r in rows:
            tid = r["tenant_id"]
            laender, gesamt, ohne = stand.get(tid, (set(), 0, 0))
            if r.get("country"):
                laender.add(r["country"].upper())
            erhoben = bool(r.get("land_registration_number")) or bool(
                r.get("land_registration_unavailable")
            )
            stand[tid] = (laender, gesamt + 1, ohne + (0 if erhoben else 1))
        return stand

    def _erfasste_laender(self, tenant_ids: list[str]) -> dict[str, set[str]]:
        """tenant_id → Länder mit vorliegender Selbstauskunft."""
        rows = (
            self._db.table("taxpayer_info")
            .select("tenant_id, country")
            .in_("tenant_id", tenant_ids)
            .limit(_AGGREGAT_LIMIT)
            .execute()
        ).data or []
        erfasst: dict[str, set[str]] = {}
        for r in rows:
            erfasst.setdefault(r["tenant_id"], set()).add(
                (r["country"] or "").upper()
            )
        return erfasst

    def _mahnstand(
        self, tenant_ids: list[str]
    ) -> dict[str, tuple[int, bool, list[str]]]:
        """tenant_id → (offene Vorgänge, Einbehalt aktiv, überfällige Länder).

        Überfällig heißt: die 180-Tage-Obergrenze aus § 23 Satz 2 ist
        verstrichen, ohne dass eine Maßnahme griff. Genau dieser Fall ist für
        den BETREIBER bußgeldbewehrt — er muss sichtbar sein.
        """
        rows = (
            self._db.table("taxpayer_enforcement")
            .select("tenant_id, country, requested_at, enforced_at, resolved_at")
            .in_("tenant_id", tenant_ids)
            .is_("resolved_at", "null")
            .limit(_AGGREGAT_LIMIT)
            .execute()
        ).data or []
        jetzt = datetime.now(UTC)
        stand: dict[str, tuple[int, bool, list[str]]] = {}
        for r in rows:
            tid = r["tenant_id"]
            offen, einbehalt, ueberfaellig = stand.get(tid, (0, False, []))
            offen += 1
            if r.get("enforced_at"):
                einbehalt = True
            elif (
                jetzt - datetime.fromisoformat(r["requested_at"])
            ).days > _FRIST_SPAETESTENS_TAGE:
                ueberfaellig.append(r["country"])
            stand[tid] = (offen, einbehalt, ueberfaellig)
        return stand

    # -- Buchungen (mandantenübergreifend) ---------------------------------

    def buchungen(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        status_filter: str | None = None,
        channel: str | None = None,
        tenant_id: str | None = None,
        suche: str | None = None,
    ) -> BuchungList:
        """Alle Buchungen der Plattform, neueste zuerst.

        `suche` trifft die Gast-E-Mail — das ist der Weg, auf dem eine Anfrage
        real hereinkommt („Gast XY beschwert sich"). Die Liste zeigt bewusst
        KEINE Telefonnummer und keine Anschrift; dafür gibt es das Detail.
        """
        limit = max(1, min(_MAX_LIMIT, limit))
        offset = max(0, offset)

        query = (
            self._db.table("reservations")
            .select(_BUCHUNG_LIST_FIELDS, count="exact")
            .order("created_at", desc=True)
        )
        if status_filter:
            query = query.eq("status", status_filter)
        if channel:
            query = query.eq("channel", channel)
        if tenant_id:
            query = query.eq("tenant_id", tenant_id)
        if suche:
            query = query.ilike("guest_email", f"%{escape_like(suche)}%")
        res = query.range(offset, offset + limit - 1).execute()
        rows = res.data or []

        namen = self._tenant_names([r.get("tenant_id") for r in rows])
        objekte = self._property_titles([r.get("property_id") for r in rows])
        gaeste = self._guest_names([r.get("guest_id") for r in rows])
        return BuchungList(
            items=[
                self._buchung_summary(r, namen, objekte, gaeste) for r in rows
            ],
            total=res.count or 0,
        )

    def buchung(self, reservation_id: str) -> BuchungDetail | None:
        """Eine Buchung mit beiden Seiten: Betrieb/Objekt und Gast/Zahlung."""
        rows = (
            self._db.table("reservations")
            .select("*")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            return None
        r = rows[0]

        namen = self._tenant_names([r.get("tenant_id")])
        objekt = self._objekt(r["property_id"])
        gaeste = self._guest_names([r.get("guest_id")])
        basis = self._buchung_summary(
            r, namen, {objekt.id: objekt.title} if objekt.title else {}, gaeste
        )
        return BuchungDetail(
            **basis.model_dump(),
            gast=self._gast(r),
            objekt=objekt,
            zahlungen=self._zahlungen(reservation_id),
            provisionen=self._provisionen(reservation_id),
            quote_items=r.get("quote_items") or [],
            num_guests=r.get("num_guests", 1),
            adults=r.get("adults", 1),
            children=r.get("children", 0),
            infants=r.get("infants", 0),
            pets=r.get("pets", 0),
            note=r.get("note"),
            ota_name=r.get("ota_name"),
            external_ref=r.get("external_ref"),
            source_channex_booking_id=r.get("source_channex_booking_id"),
            cancel_reason=r.get("cancel_reason"),
            cancelled_at=r.get("cancelled_at"),
            checked_in_at=r.get("checked_in_at"),
            checked_out_at=r.get("checked_out_at"),
            channel_fee=r.get("channel_fee") or 0,
        )

    @staticmethod
    def _buchung_summary(
        row: dict,
        tenant_namen: dict[str, str],
        objekt_titel: dict[str, str],
        gast_namen: dict[str, str],
    ) -> BuchungSummary:
        """Eine Zeile in die Listensicht übersetzen.

        Die Nächte werden aus den Daten GERECHNET, nicht gespeichert — eine
        zweite Quelle für dieselbe Zahl liefe auseinander (Wurzel 1).
        """
        anreise = date.fromisoformat(row["check_in"])
        abreise = date.fromisoformat(row["check_out"])
        return BuchungSummary(
            id=row["id"],
            tenant_id=row["tenant_id"],
            tenant_name=tenant_namen.get(row["tenant_id"]),
            property_id=row["property_id"],
            property_title=objekt_titel.get(row["property_id"]),
            guest_name=gast_namen.get(row.get("guest_id") or ""),
            channel=row["channel"],
            status=row["status"],
            payment_status=row["payment_status"],
            check_in=anreise,
            check_out=abreise,
            naechte=(abreise - anreise).days,
            total_amount=row["total_amount"],
            paid_amount=row["paid_amount"],
            currency=row.get("currency"),
            created_at=row["created_at"],
        )

    def _gast(self, row: dict) -> BuchungGast:
        """Die Gastseite aus drei möglichen Quellen zusammensetzen.

        Reihenfolge ist Absicht: die Reservierung selbst ist die einzige immer
        vorhandene Quelle. Gastakte und Plattform-Konto ERGÄNZEN sie, ersetzen
        sie aber nie — sonst zeigte das Backoffice eine andere E-Mail an, als
        in der Buchung steht.
        """
        gast = BuchungGast(
            email=row.get("guest_email"),
            phone=row.get("guest_phone"),
            country=row.get("guest_country"),
            language=row.get("guest_language"),
        )
        if guest_id := row.get("guest_id"):
            akte = (
                self._db.table("guests")
                .select("id, name, company, stays_count")
                .eq("id", guest_id)
                .limit(1)
                .execute()
            ).data
            if akte:
                gast.guest_id = akte[0]["id"]
                gast.name = akte[0].get("name")
                gast.company = akte[0].get("company")
                gast.stays_count = akte[0].get("stays_count")
        if email := row.get("guest_email"):
            konto = (
                self._db.table("portal_guests")
                .select("id, name, created_at")
                # escape_like + stabile Sortierung: eine E-Mail mit `%` würde
                # sonst als Wildcard matchen und im Detail ein FREMDES
                # Plattform-Konto anzeigen (Wurzel 8).
                .ilike("email", escape_like(email))
                .order("created_at")
                .limit(1)
                .execute()
            ).data
            if konto:
                gast.portal_guest_id = konto[0]["id"]
                gast.portal_registered_at = konto[0].get("created_at")
                gast.name = gast.name or konto[0].get("name")
        return gast

    def _objekt(self, property_id: str) -> BuchungObjekt:
        """Die Objektseite — EINE buchbare Einheit, kein Container."""
        rows = (
            self._db.table("properties")
            .select("id, title, street, postal_code, city, country, status, max_guests")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            # Der Fremdschlüssel ist RESTRICT — das kann nur passieren, wenn
            # jemand an der DB vorbei gelöscht hat. Nicht erfinden, nur die ID.
            return BuchungObjekt(id=property_id)
        return BuchungObjekt(**rows[0])

    def _zahlungen(self, reservation_id: str) -> list[BuchungZahlung]:
        rows = (
            self._db.table("payments")
            .select(
                "id, type, status, gateway, amount, currency, due_at, created_at"
            )
            .eq("reservation_id", reservation_id)
            .order("created_at")
            .limit(_MAX_LIMIT)
            .execute()
        ).data or []
        return [BuchungZahlung(**r) for r in rows]

    def _provisionen(self, reservation_id: str) -> list[BuchungProvision]:
        rows = (
            self._db.table("platform_fees")
            .select(
                "id, fee_bps, gross_amount_cents, fee_amount_cents, "
                "reversed_amount_cents, currency, gateway, status, created_at"
            )
            .eq("reservation_id", reservation_id)
            .order("created_at")
            .limit(_MAX_LIMIT)
            .execute()
        ).data or []
        return [BuchungProvision(**r) for r in rows]

    def _property_titles(self, property_ids: list[str | None]) -> dict[str, str]:
        """id → Titel für eine Menge von Objekten (eine Abfrage)."""
        eindeutig = list({p for p in property_ids if p})
        if not eindeutig:
            return {}
        rows = (
            self._db.table("properties")
            .select("id, title")
            .in_("id", eindeutig)
            .execute()
        ).data or []
        return {r["id"]: r["title"] for r in rows if r.get("title")}

    def _guest_names(self, guest_ids: list[str | None]) -> dict[str, str]:
        """id → Name für eine Menge von Gastakten (eine Abfrage)."""
        eindeutig = list({g for g in guest_ids if g})
        if not eindeutig:
            return {}
        rows = (
            self._db.table("guests")
            .select("id, name")
            .in_("id", eindeutig)
            .execute()
        ).data or []
        return {r["id"]: r["name"] for r in rows if r.get("name")}
