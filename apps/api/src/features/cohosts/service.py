"""Co-Gastgeber (Airbnb „Co-Hosts") — Plattform-Marktplatz.

ABGRENZUNG zum Team-Modell (apps/web): Ein Co-Gastgeber gehört einem ANDEREN
Tenant an. Er ist selbst Gastgeber und hilft auf einem fremden Objekt mit.
Deshalb greift hier NICHT der übliche tenant-Scope, sondern eine explizite
Zuordnung je Objekt (property_cohosts).

REGELN aus der Airbnb-Dokumentation (Artikel 1534/1243/3264, abgerufen
2026-07-26) — alle serverseitig erzwungen, nie nur im Client:

  • Höchstens 10 Co-Gastgeber je Objekt.
  • Ein Co-Gastgeber mit Vollzugriff darf weitere einladen, aber NUR mit
    eingeschränktem Zugriff — nie erneut Vollzugriff.
  • Auszahlungsdaten richtet ausschließlich der Eigentümer ein.
  • Wer entfernt wird, verliert JEDEN Zugriff sofort.
  • Vor der Annahme muss die Identität geprüft sein.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext, secrets_match
from src.core.supabase import escape_like

from .payouts import pruefe_vereinbarung_gegen_gebuehr
from .schemas import (
    Cohost,
    CohostAccess,
    CohostAssignment,
    CohostInvitation,
    CohostInvite,
    CohostInviteResponse,
    CohostShareUpdate,
    PendingInvitation,
)
from .stripe_service import CohostStripeService

log = get_logger("nextdays.cohosts")

# Airbnb-Grenze: max. 10 Co-Gastgeber je Objekt. Serverseitig erzwungen —
# zugleich Obergrenze gegen unbegrenztes Wachstum (Wurzel 8).
_MAX_COHOSTS = 10

# Spalten, die aus property_cohosts direkt ins Cohost-Schema übernommen werden.
# Explizit statt über model_fields: Eine neue DB-Spalte soll nicht automatisch
# nach außen wandern — was ausgeliefert wird, ist eine bewusste Entscheidung.
_COHOST_FELDER = (
    "id",
    "property_id",
    "user_id",
    "access",
    "status",
    "note",
    "created_at",
    "accepted_at",
    # Beteiligung (0214) — der Gastgeber muss sehen, was er vereinbart hat.
    "share_kind",
    "share_bps",
    "share_fixed_cents",
    "share_currency",
)

# Gültigkeit einer Einladung. Airbnb nennt keine feste Frist; 7 Tage sind lang
# genug für eine Antwort und kurz genug, dass ein vergessener Link nicht ewig
# gültig bleibt.
_EINLADUNG_TAGE = 7


class CohostError(Exception):
    """Fachlicher Fehler mit HTTP-Status."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _hash(token: str) -> str:
    """Token-Hash für die Ablage. Der Klartext verlässt den Server nur einmal."""
    return hashlib.sha256(token.encode()).hexdigest()


class CohostService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Sicht des Eigentümers ---------------------------------------------

    def _require_own_property(self, ctx: AuthContext, property_id: str) -> dict:
        """Objekt laden und auf den eigenen Tenant scopen (Wurzel 3).

        Load und Scope bewusst zusammen: Getrennt vergisst man den Scope.
        """
        rows = (
            self._db.table("properties")
            .select("id, tenant_id, title")
            .eq("id", property_id)
            .eq("tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise CohostError("Objekt nicht gefunden.", status_code=404)
        return rows[0]

    def list_for_property(
        self, ctx: AuthContext, property_id: str
    ) -> list[Cohost]:
        """Co-Gastgeber eines Objekts, inklusive noch offener Einladungen."""
        self._require_own_property(ctx, property_id)
        rows = (
            self._db.table("property_cohosts")
            .select("*")
            .eq("property_id", property_id)
            .in_("status", ["pending", "active"])
            .order("created_at")
            .execute()
        ).data or []
        if not rows:
            return []

        # Namen/E-Mails nachladen: Der Co-Gastgeber sitzt in einem anderen
        # Tenant, ein Join über den tenant-gescopten Pfad findet ihn nicht.
        namen = self._namen_von({r["user_id"] for r in rows})
        return [
            Cohost(
                **{k: v for k, v in r.items() if k in _COHOST_FELDER},
                full_name=namen.get(r["user_id"], {}).get("full_name"),
                email=namen.get(r["user_id"], {}).get("email"),
            )
            for r in rows
        ]

    def _namen_von(self, user_ids: set[str]) -> dict[str, dict]:
        """Anzeigedaten mehrerer Nutzer (tenant-übergreifend).

        Bewusst nur full_name und email — keine Rolle, keine Rechte, keine
        Adresse. Ein Eigentümer soll seinen Co-Gastgeber erkennen, nicht dessen
        Konto ausforschen (Wurzel 9: kein Recon-Material).
        """
        if not user_ids:
            return {}
        rows = (
            self._db.table("users")
            .select("id, full_name, email")
            .in_("id", list(user_ids))
            .execute()
        ).data or []
        return {r["id"]: r for r in rows}

    def invite(
        self, ctx: AuthContext, property_id: str, req: CohostInvite
    ) -> CohostInviteResponse:
        """Einen Co-Gastgeber einladen.

        Erzeugt NUR eine Einladung — die Zuordnung entsteht erst mit der
        Annahme. So bekommt niemand Zugriff auf ein fremdes Objekt, ohne
        zugestimmt zu haben.
        """
        self._require_own_property(ctx, property_id)
        self._pruefe_obergrenze(property_id)
        self._pruefe_vergaberecht(ctx, property_id, req.access)

        # Bereits Co-Gastgeber? Dann ist eine Einladung sinnlos.
        email = req.email.strip().lower()
        vorhanden = (
            self._db.table("users")
            .select("id")
            # escape_like: '_' ist ein ILIKE-Wildcard und in E-Mails häufig —
            # ohne Escaping träfe 'max_muster@x.de' auch 'maxamuster@x.de'.
            .ilike("email", escape_like(email))
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            schon = (
                self._db.table("property_cohosts")
                .select("id")
                .eq("property_id", property_id)
                .eq("user_id", vorhanden[0]["id"])
                .in_("status", ["pending", "active"])
                .limit(1)
                .execute()
            ).data or []
            if schon:
                raise CohostError(
                    "Diese Person ist bereits Co-Gastgeber dieses Objekts.",
                    status_code=409,
                )

        token = secrets.token_urlsafe(32)
        jetzt = datetime.now(UTC)
        ablauf = jetzt + timedelta(days=_EINLADUNG_TAGE)

        try:
            res = (
                self._db.table("cohost_invitations")
                .insert(
                    {
                        "property_id": property_id,
                        "owner_tenant_id": ctx.tenant_id,
                        "email": email,
                        "access": req.access.value,
                        "note": req.note,
                        "token_hash": _hash(token),
                        "invited_by": ctx.user_id,
                        "expires_at": ablauf.isoformat(),
                    }
                )
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001 — auf Konflikt eingrenzen
            # UNIQUE-Verletzung: Es gibt schon eine offene Einladung. Das ist
            # kein Serverfehler, sondern eine klare Aussage (Wurzel 2/5).
            if "23505" in str(exc) or "duplicate" in str(exc).lower():
                raise CohostError(
                    "Für diese Adresse ist bereits eine Einladung offen.",
                    status_code=409,
                ) from exc
            raise

        log.info(
            "cohost_invited",
            property_id=property_id,
            tenant_id=ctx.tenant_id,
            access=req.access.value,
        )
        return CohostInviteResponse(
            id=res[0]["id"],
            email=email,
            access=req.access,
            expires_at=ablauf,
            # Der Link geht an den Eingeladenen. Solange kein Mailversand
            # existiert, gibt ihn der Eigentümer weiter — sichtbar statt eines
            # stillen Versands, der nirgendwo ankommt (Wurzel 4/5).
            link=f"/co-gastgeber/einladung/{token}",
        )

    def _pruefe_obergrenze(self, property_id: str) -> None:
        """Max. 10 je Objekt — offene Einladungen zählen mit."""
        aktiv = (
            self._db.table("property_cohosts")
            .select("id", count="exact")
            .eq("property_id", property_id)
            .in_("status", ["pending", "active"])
            .execute()
        ).count or 0
        offen = (
            self._db.table("cohost_invitations")
            .select("id", count="exact")
            .eq("property_id", property_id)
            .is_("accepted_at", "null")
            .is_("declined_at", "null")
            .gt("expires_at", datetime.now(UTC).isoformat())
            .execute()
        ).count or 0
        if aktiv + offen >= _MAX_COHOSTS:
            raise CohostError(
                f"Ein Objekt kann höchstens {_MAX_COHOSTS} Co-Gastgeber haben.",
                status_code=409,
            )

    def _pruefe_vergaberecht(
        self, ctx: AuthContext, property_id: str, access: CohostAccess
    ) -> None:
        """Darf dieser Nutzer diese Stufe vergeben?

        Airbnb-Regel: Ein Co-Gastgeber mit Vollzugriff darf weitere einladen,
        aber NUR mit eingeschränktem Zugriff. Sonst könnte er sich eine Kette
        gleichberechtigter Zugriffe schaffen, die der Eigentümer nicht
        überblickt (Privilege-Escalation, Wurzel 3).
        """
        eigene = (
            self._db.table("property_cohosts")
            .select("access")
            .eq("property_id", property_id)
            .eq("user_id", ctx.user_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        ).data or []
        if not eigene:
            # Kein Co-Gastgeber → der Eigentümer selbst. Er darf alles vergeben;
            # dass ihm das Objekt gehört, hat _require_own_property geprüft.
            return
        if access is CohostAccess.full:
            raise CohostError(
                "Als Co-Gastgeber kannst du keinen Vollzugriff vergeben.",
                status_code=403,
            )

    def update_access(
        self, ctx: AuthContext, property_id: str, cohost_id: str, access: CohostAccess
    ) -> Cohost:
        """Zugriffsstufe ändern. Nur für Objekte des eigenen Tenants."""
        self._require_own_property(ctx, property_id)
        self._pruefe_vergaberecht(ctx, property_id, access)

        rows = (
            self._db.table("property_cohosts")
            .update({"access": access.value, "updated_at": datetime.now(UTC).isoformat()})
            .eq("id", cohost_id)
            # Der property_id-Filter ist der eigentliche Scope: Ohne ihn ließe
            # sich über eine fremde cohost_id eine andere Zuordnung ändern
            # (IDOR, Wurzel 9).
            .eq("property_id", property_id)
            .execute()
        ).data or []
        if not rows:
            raise CohostError("Co-Gastgeber nicht gefunden.", status_code=404)
        log.info("cohost_access_changed", cohost_id=cohost_id, access=access.value)
        namen = self._namen_von({rows[0]["user_id"]})
        return Cohost(
            **{k: v for k, v in rows[0].items() if k in _COHOST_FELDER},
            full_name=namen.get(rows[0]["user_id"], {}).get("full_name"),
            email=namen.get(rows[0]["user_id"], {}).get("email"),
        )

    def update_share(
        self,
        ctx: AuthContext,
        property_id: str,
        cohost_id: str,
        req: CohostShareUpdate,
    ) -> Cohost:
        """Beteiligung eines Co-Gastgebers festlegen.

        Die Plattform-Gebühr bleibt unberührt — diese Beteiligung kommt
        obendrauf und geht zulasten des Gastgebers. Deshalb entscheidet allein
        der Eigentümer darüber; ein Co-Gastgeber kann seine eigene Beteiligung
        nicht setzen (der _require_own_property-Scope stellt das sicher).
        """
        self._require_own_property(ctx, property_id)

        # Vorabprüfung: Passt die prozentuale Beteiligung neben die
        # Plattform-Gebühr und die bereits vergebenen Anteile? Den Fehler hier
        # zu fangen ist besser, als ihn erst bei der nächsten Buchung zu
        # bemerken.
        plattform_bps = self._plattform_bps(ctx.tenant_id)
        bestehende = sum(
            int(r.get("share_bps") or 0)
            for r in (
                self._db.table("property_cohosts")
                .select("id, share_kind, share_bps")
                .eq("property_id", property_id)
                .eq("status", "active")
                .eq("share_kind", "percent")
                .execute()
            ).data or []
            if r["id"] != cohost_id
        )
        pruefe_vereinbarung_gegen_gebuehr(
            share_kind=req.share_kind.value,
            share_bps=req.share_bps,
            plattform_bps=plattform_bps,
            bestehende_bps=bestehende,
        )

        rows = (
            self._db.table("property_cohosts")
            .update(
                {
                    "share_kind": req.share_kind.value,
                    "share_bps": req.share_bps,
                    "share_fixed_cents": req.share_fixed_cents,
                    "share_currency": (
                        req.share_currency.upper() if req.share_currency else None
                    ),
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", cohost_id)
            # Objekt-Scope gegen IDOR (Wurzel 9).
            .eq("property_id", property_id)
            .execute()
        ).data or []
        if not rows:
            raise CohostError("Co-Gastgeber nicht gefunden.", status_code=404)
        log.info(
            "cohost_share_changed",
            cohost_id=cohost_id,
            share_kind=req.share_kind.value,
        )
        namen = self._namen_von({rows[0]["user_id"]})
        return Cohost(
            **{k: v for k, v in rows[0].items() if k in _COHOST_FELDER},
            full_name=namen.get(rows[0]["user_id"], {}).get("full_name"),
            email=namen.get(rows[0]["user_id"], {}).get("email"),
        )

    def plattform_bps(self, ctx: AuthContext) -> int:
        """Öffentlicher Einstieg für die Oberfläche (Tenant aus dem Token)."""
        return self._plattform_bps(ctx.tenant_id)

    def _plattform_bps(self, tenant_id: str) -> int:
        """Provisions-Satz für die Beispielrechnung der Beteiligung.

        Zeigt den PORTAL-Satz (Preisliste §2, 8 % all-in) — der Kanal steht bei
        der Vorschau naturgemäß noch nicht fest, und der Portal-Satz ist der
        einzige, der die Beteiligung überhaupt schmälert. Auf Direktbuchungen
        (0 %) fällt der Abzug später weg, der Co-Gastgeber bekommt dann mehr.

        NICHT am account_type festmachen: Es gibt nur EINEN Tarif
        (Preisliste §1), der Kanal entscheidet.
        """
        rows = (
            self._db.table("tenants")
            .select("platform_fee_bps")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return 0
        bps = rows[0].get("platform_fee_bps")
        if bps is None:
            raise CohostError(
                "Provisions-Satz des Kontos fehlt.", status_code=500
            )
        return int(bps)

    def remove(self, ctx: AuthContext, property_id: str, cohost_id: str) -> None:
        """Zugriff entziehen.

        Bewusst kein DELETE, sondern status='revoked': Die Historie bleibt
        nachvollziehbar (wer hatte wann Zugriff), der Zugriff endet trotzdem
        sofort — is_cohost_of prüft auf status='active'.
        """
        self._require_own_property(ctx, property_id)
        jetzt = datetime.now(UTC).isoformat()
        rows = (
            self._db.table("property_cohosts")
            .update({"status": "revoked", "revoked_at": jetzt, "updated_at": jetzt})
            .eq("id", cohost_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
        if not rows:
            raise CohostError("Co-Gastgeber nicht gefunden.", status_code=404)
        log.info("cohost_removed", cohost_id=cohost_id, property_id=property_id)

    def list_invitations(
        self, ctx: AuthContext, property_id: str
    ) -> list[CohostInvitation]:
        """Offene Einladungen eines Objekts. Ohne Token (nur der Hash liegt in der DB)."""
        self._require_own_property(ctx, property_id)
        rows = (
            self._db.table("cohost_invitations")
            .select("id, property_id, email, access, note, expires_at, created_at")
            .eq("property_id", property_id)
            .is_("accepted_at", "null")
            .is_("declined_at", "null")
            .gt("expires_at", datetime.now(UTC).isoformat())
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return [CohostInvitation(**r) for r in rows]

    def cancel_invitation(
        self, ctx: AuthContext, property_id: str, invitation_id: str
    ) -> None:
        """Eine offene Einladung zurückziehen."""
        self._require_own_property(ctx, property_id)
        rows = (
            self._db.table("cohost_invitations")
            .update({"declined_at": datetime.now(UTC).isoformat()})
            .eq("id", invitation_id)
            .eq("property_id", property_id)
            .is_("accepted_at", "null")
            .execute()
        ).data or []
        if not rows:
            raise CohostError("Einladung nicht gefunden.", status_code=404)

    # -- Sicht des Eingeladenen --------------------------------------------

    def invitation_by_token(self, token: str) -> PendingInvitation:
        """Eine Einladung über ihren Token öffnen.

        Der Vergleich läuft über den HASH, und der Treffer wird zusätzlich
        byteweise gegengeprüft (secrets_match) — ein Zeitkanal über den Index
        soll keine Rückschlüsse auf gültige Token erlauben.
        """
        if not token or len(token) < 20:
            raise CohostError("Einladung ungültig.", status_code=404)
        rows = (
            self._db.table("cohost_invitations")
            .select("*")
            .eq("token_hash", _hash(token))
            .limit(1)
            .execute()
        ).data or []
        if not rows or not secrets_match(_hash(token), rows[0]["token_hash"]):
            raise CohostError("Einladung ungültig.", status_code=404)
        inv = rows[0]

        if inv.get("accepted_at"):
            raise CohostError("Diese Einladung wurde bereits angenommen.", status_code=409)
        if inv.get("declined_at"):
            raise CohostError("Diese Einladung wurde zurückgezogen.", status_code=410)
        if _parse(inv["expires_at"]) < datetime.now(UTC):
            raise CohostError("Diese Einladung ist abgelaufen.", status_code=410)

        prop = (
            self._db.table("properties")
            .select("title")
            .eq("id", inv["property_id"])
            .limit(1)
            .execute()
        ).data or []
        inviter = self._namen_von({inv["invited_by"]})
        return PendingInvitation(
            id=inv["id"],
            property_id=inv["property_id"],
            property_title=prop[0]["title"] if prop else None,
            access=CohostAccess(inv["access"]),
            note=inv.get("note"),
            expires_at=inv["expires_at"],
            inviter_name=inviter.get(inv["invited_by"], {}).get("full_name"),
        )

    def accept(self, ctx: AuthContext, token: str) -> CohostAssignment:
        """Eine Einladung annehmen.

        Idempotent (Wurzel 2): Ein zweiter Aufruf mit demselben Token — durch
        Doppelklick oder Retry — gibt die bestehende Zuordnung zurück, statt
        eine zweite anzulegen oder zu scheitern.
        """
        inv_rows = (
            self._db.table("cohost_invitations")
            .select("*")
            .eq("token_hash", _hash(token))
            .limit(1)
            .execute()
        ).data or []
        if not inv_rows:
            raise CohostError("Einladung ungültig.", status_code=404)
        inv = inv_rows[0]

        # Bereits angenommen? Dann die vorhandene Zuordnung zurückgeben.
        if inv.get("accepted_at"):
            bestehend = (
                self._db.table("property_cohosts")
                .select("*")
                .eq("property_id", inv["property_id"])
                .eq("user_id", ctx.user_id)
                .limit(1)
                .execute()
            ).data or []
            if bestehend:
                return self._als_assignment(bestehend[0])
            raise CohostError("Diese Einladung wurde bereits angenommen.", status_code=409)

        if inv.get("declined_at"):
            raise CohostError("Diese Einladung wurde zurückgezogen.", status_code=410)
        if _parse(inv["expires_at"]) < datetime.now(UTC):
            raise CohostError("Diese Einladung ist abgelaufen.", status_code=410)

        # Die Einladung gilt einer bestimmten Adresse. Sonst könnte ein
        # weitergeleiteter Link von jedem eingelöst werden (Wurzel 3).
        eigene = (
            self._db.table("users")
            .select("email, identity_status")
            .eq("id", ctx.user_id)
            .limit(1)
            .execute()
        ).data or []
        if not eigene:
            raise CohostError("Konto nicht gefunden.", status_code=404)
        if eigene[0]["email"].strip().lower() != inv["email"].strip().lower():
            raise CohostError(
                "Diese Einladung gilt einer anderen E-Mail-Adresse.",
                status_code=403,
            )
        # Airbnb verlangt die Identitätsprüfung VOR der Annahme.
        if eigene[0].get("identity_status") != "verified":
            raise CohostError(
                "Bitte bestätige zuerst deine Identität, um die Einladung "
                "anzunehmen.",
                status_code=403,
            )
        # Auszahlungsbereites Stripe-Konto ist Pflicht: Ohne kann eine
        # vereinbarte Beteiligung nie fließen, und die Zeilen blieben ewig
        # offen. Fail-closed — im Zweifel nicht annehmen (Wurzel 5).
        if not CohostStripeService(self._db).ist_auszahlungsbereit(ctx.user_id):
            raise CohostError(
                "Bitte verbinde zuerst dein Auszahlungskonto, um die "
                "Einladung anzunehmen.",
                status_code=403,
            )

        jetzt = datetime.now(UTC).isoformat()
        neu = (
            self._db.table("property_cohosts")
            .insert(
                {
                    "property_id": inv["property_id"],
                    "user_id": ctx.user_id,
                    "owner_tenant_id": inv["owner_tenant_id"],
                    "access": inv["access"],
                    "status": "active",
                    "invited_by": inv["invited_by"],
                    "note": inv.get("note"),
                    "accepted_at": jetzt,
                }
            )
            .execute()
        ).data
        self._db.table("cohost_invitations").update(
            {"accepted_at": jetzt, "accepted_by": ctx.user_id}
        ).eq("id", inv["id"]).execute()

        log.info(
            "cohost_accepted",
            property_id=inv["property_id"],
            access=inv["access"],
        )
        return self._als_assignment(neu[0])

    def decline(self, token: str) -> None:
        """Eine Einladung ablehnen. Kein Login nötig — der Token genügt."""
        rows = (
            self._db.table("cohost_invitations")
            .update({"declined_at": datetime.now(UTC).isoformat()})
            .eq("token_hash", _hash(token))
            .is_("accepted_at", "null")
            .is_("declined_at", "null")
            .execute()
        ).data or []
        if not rows:
            raise CohostError("Einladung ungültig.", status_code=404)

    def my_assignments(self, ctx: AuthContext) -> list[CohostAssignment]:
        """Objekte, die ich als Co-Gastgeber mitbetreue."""
        rows = (
            self._db.table("property_cohosts")
            .select("*")
            .eq("user_id", ctx.user_id)
            .eq("status", "active")
            .order("accepted_at", desc=True)
            .execute()
        ).data or []
        if not rows:
            return []
        titel = self._titel_von({r["property_id"] for r in rows})
        return [
            CohostAssignment(
                id=r["id"],
                property_id=r["property_id"],
                property_title=titel.get(r["property_id"]),
                access=CohostAccess(r["access"]),
                accepted_at=r.get("accepted_at"),
            )
            for r in rows
        ]

    def leave(self, ctx: AuthContext, cohost_id: str) -> None:
        """Selbst als Co-Gastgeber austreten (Airbnb: „remove themselves")."""
        jetzt = datetime.now(UTC).isoformat()
        rows = (
            self._db.table("property_cohosts")
            .update({"status": "revoked", "revoked_at": jetzt, "updated_at": jetzt})
            .eq("id", cohost_id)
            # Scope: nur die EIGENE Zuordnung (Wurzel 9).
            .eq("user_id", ctx.user_id)
            .execute()
        ).data or []
        if not rows:
            raise CohostError("Zuordnung nicht gefunden.", status_code=404)

    def _titel_von(self, property_ids: set[str]) -> dict[str, str | None]:
        if not property_ids:
            return {}
        rows = (
            self._db.table("properties")
            .select("id, title")
            .in_("id", list(property_ids))
            .execute()
        ).data or []
        return {r["id"]: r.get("title") for r in rows}

    def _als_assignment(self, row: dict) -> CohostAssignment:
        titel = self._titel_von({row["property_id"]})
        return CohostAssignment(
            id=row["id"],
            property_id=row["property_id"],
            property_title=titel.get(row["property_id"]),
            access=CohostAccess(row["access"]),
            accepted_at=row.get("accepted_at"),
        )


def _parse(wert: str) -> datetime:
    """ISO-Zeitstempel aus der DB in ein aware datetime."""
    return datetime.fromisoformat(str(wert).replace("Z", "+00:00"))
