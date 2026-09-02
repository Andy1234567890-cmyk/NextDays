"""Team-Provision (0520) — Auswertung, Team-Chat und Backoffice-Team, als Mixin
des AffiliatesService. Eigenes Modul, weil service.py sonst die 1500-Zeilen-
Grenze reißt; fachlich ist es ein Ausschnitt desselben Service (gleiche DB,
gleiche Hilfsmethoden)."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from . import attribution
from .fehler import AffiliateError
from .schemas import (
    BackofficePartner,
    BackofficeSponsorSetzen,
    BackofficeTeam,
    BackofficeTeamMitglied,
    Betrag,
    PartnerRang,
    PartnerTeam,
    PartnerTeamMitglied,
    PartnerTeamMonat,
    PartnerTeamSponsor,
    TeamNachricht,
    TeamThread,
)

if TYPE_CHECKING:
    from supabase import Client

    from src.core.config import Settings
    from src.core.security import AffiliateContext, PlatformContext

log = get_logger(__name__)
_UNIQUE_VIOLATION = "23505"


def _rows(res: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    return list(getattr(res, "data", None) or [])


def _betraege(summen: dict[str, Decimal]) -> list[Betrag]:
    return [Betrag(amount=f"{summen[w]:.2f}", currency=w) for w in sorted(summen) if summen[w] != 0]


def _summe(rows: list[dict[str, Any]], feld: str = "amount") -> list[Betrag]:
    summen: dict[str, Decimal] = defaultdict(Decimal)
    for r in rows:
        summen[str(r["currency"]).upper()] += Decimal(str(r[feld]))
    return _betraege(summen)


def _team_partner_id(reason: str | None) -> str | None:
    """Override-Zeilen tragen `team:<affiliate_id>` als Herkunft."""
    if reason and reason.startswith("team:"):
        return reason.split(":", 2)[1] or None
    return None


class TeamMixin:  # pylint: disable=too-few-public-methods
    """Braucht vom Host: _db, _settings, _own_row, _bo_row, raenge, zahlende_kunden."""

    _db: Client
    _settings: Settings

    # Vom Host bereitgestellt — hier nur für die Typprüfung deklariert.
    def _own_row(self, ctx: AffiliateContext) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError

    def _bo_row(self, affiliate_id: str) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError

    def raenge(self) -> list[PartnerRang]:  # pragma: no cover
        raise NotImplementedError

    def zahlende_kunden(self, affiliate_id: str) -> int:  # pragma: no cover
        raise NotImplementedError

    def _bo_partner(  # pragma: no cover
        self,
        row: dict[str, Any],
        referrals: int = 0,
        zahlend: int = 0,
        klicks_30d: int = 0,
        sponsor_name: str | None = None,
        team_size: int | None = None,
    ) -> BackofficePartner:
        raise NotImplementedError

    # --- Team (0520) ----------------------------------------------------------------

    def _partner_name(self, affiliate_id: str | None) -> str | None:
        if not affiliate_id:
            return None
        rows = _rows(
            self._db.table("affiliates")
            .select("full_name, company")
            .eq("id", affiliate_id)
            .limit(1)
            .execute()
        )
        if not rows:
            return None
        return rows[0].get("company") or rows[0]["full_name"]

    def _team_size(self, affiliate_id: str) -> int:
        res = (
            self._db.table("affiliates")
            .select("id", count="exact")
            .eq("sponsor_affiliate_id", affiliate_id)
            .limit(1)
            .execute()
        )
        return res.count or 0

    def _team_mitglieder(self, affiliate_id: str) -> list[dict[str, Any]]:
        return fetch_all_rows(
            self._db.table("affiliates")
            .select(
                "id, full_name, company, email, status, current_tier_id, sponsor_joined_at, "
                "sponsor_flags"
            )
            .eq("sponsor_affiliate_id", affiliate_id)
            .order("sponsor_joined_at")
        )

    def _team_zeilen(self, sponsor_id: str, mitglieder: list[str]) -> tuple[list, list]:
        """(Ertragszeilen der Team-Partner, Override-Zeilen des Sponsors)."""
        ertraege = (
            fetch_all_rows(
                self._db.table("affiliate_commissions")
                .select("affiliate_id, currency, base_amount, amount, status, created_at, kind")
                .in_("affiliate_id", mitglieder)
                .eq("kind", "earn")
            )
            if mitglieder
            else []
        )
        overrides = fetch_all_rows(
            self._db.table("affiliate_commissions")
            .select("id, currency, amount, status, created_at, reason, base_amount")
            .eq("affiliate_id", sponsor_id)
            .eq("kind", "override")
        )
        return ertraege, overrides

    def team(self, ctx: AffiliateContext) -> PartnerTeam:
        """Die Team-Auswertung des Sponsors: wer im Team ist, was jeder umsetzt
        und was daraus an Team-Provision entsteht — ohne Kundendetails der
        Team-Partner."""
        row = self._own_row(ctx)
        mitglieder = self._team_mitglieder(ctx.affiliate_id)
        ids = [m["id"] for m in mitglieder]
        ertraege, overrides = self._team_zeilen(ctx.affiliate_id, ids)
        jetzt = datetime.now(UTC)
        seit_30 = (jetzt - timedelta(days=30)).isoformat()
        raenge = {t.id: t for t in self.raenge()}
        aktuell = raenge.get(row["current_tier_id"]) or next(iter(raenge.values()))

        def zeilen_von(mid: str) -> list[dict[str, Any]]:
            return [e for e in ertraege if e["affiliate_id"] == mid]

        def overrides_von(mid: str) -> list[dict[str, Any]]:
            return [o for o in overrides if _team_partner_id(o.get("reason")) == mid]

        def nach_status(rows: list[dict[str, Any]], *stati: str) -> list[Betrag]:
            return _summe([r for r in rows if r["status"] in stati])

        members = [
            PartnerTeamMitglied(
                affiliate_id=m["id"],
                name=m["full_name"],
                company=m.get("company"),
                status=m["status"],
                tier=raenge.get(m["current_tier_id"]) or aktuell,
                joined_at=m.get("sponsor_joined_at"),
                paying_customers=self.zahlende_kunden(m["id"]),
                revenue_30d=_summe(
                    [e for e in zeilen_von(m["id"]) if str(e["created_at"]) >= seit_30],
                    "base_amount",
                ),
                revenue_total=_summe(zeilen_von(m["id"]), "base_amount"),
                override_pending=nach_status(overrides_von(m["id"]), "pending", "held"),
                override_approved=nach_status(overrides_von(m["id"]), "approved"),
                override_paid=nach_status(overrides_von(m["id"]), "paid"),
                flags=list(m.get("sponsor_flags") or []),
            )
            for m in mitglieder
        ]
        monate: list[PartnerTeamMonat] = []
        for i in range(11, -1, -1):
            jahr, monat = (jetzt.year, jetzt.month - i)
            while monat <= 0:
                monat += 12
                jahr -= 1
            key = f"{jahr:04d}-{monat:02d}"
            monate.append(
                PartnerTeamMonat(
                    month=key,
                    override=_summe([o for o in overrides if str(o["created_at"])[:7] == key]),
                    revenue=_summe(
                        [e for e in ertraege if str(e["created_at"])[:7] == key], "base_amount"
                    ),
                )
            )
        basis = (self._settings.marketing_base_url or "").strip().rstrip("/")
        code = self._startcode(ctx.affiliate_id)
        sponsor: PartnerTeamSponsor | None = None
        if row.get("sponsor_affiliate_id"):
            sp = _rows(
                self._db.table("affiliates")
                .select("id, full_name, company")
                .eq("id", row["sponsor_affiliate_id"])
                .limit(1)
                .execute()
            )
            if sp:
                sponsor = PartnerTeamSponsor(
                    affiliate_id=sp[0]["id"],
                    name=sp[0]["full_name"],
                    company=sp[0].get("company"),
                    joined_at=row.get("sponsor_joined_at"),
                )
        # Team-Link nur, wenn der eigene Rang Team-Partner führen darf (0525) —
        # die Sperre selbst sitzt in attribution._sponsor_pruefen, nicht hier.
        return PartnerTeam(
            team_link=(
                f"{basis}/p/{code}?team=1" if basis and code and aktuell.team_allowed else None
            ),
            team_allowed=aktuell.team_allowed,
            own_rate=aktuell.rate,
            members=members,
            members_active=sum(1 for m in mitglieder if m["status"] == "approved"),
            team_customers=sum(m.paying_customers for m in members),
            revenue_30d=_summe(
                [e for e in ertraege if str(e["created_at"]) >= seit_30], "base_amount"
            ),
            override_pending=nach_status(overrides, "pending", "held"),
            override_approved=nach_status(overrides, "approved"),
            override_paid=nach_status(overrides, "paid"),
            months=monate,
            sponsor=sponsor,
        )

    def _startcode(self, affiliate_id: str) -> str | None:
        rows = _rows(
            self._db.table("affiliate_referral_codes")
            .select("code")
            .eq("affiliate_id", affiliate_id)
            .eq("active", True)
            .order("created_at")
            .limit(1)
            .execute()
        )
        return rows[0]["code"] if rows else None

    # --- Team-Chat Sponsor ↔ Mitglied --------------------------------------------

    def _team_partner_von(self, ctx: AffiliateContext) -> dict[str, dict[str, Any]]:
        """Alle Partner, mit denen ich einen Thread haben darf: mein Sponsor und
        meine Team-Mitglieder — id → Zeile mit Rolle des ANDEREN."""
        row = self._own_row(ctx)
        erlaubt: dict[str, dict[str, Any]] = {}
        if row.get("sponsor_affiliate_id"):
            sp = _rows(
                self._db.table("affiliates")
                .select("id, full_name, company")
                .eq("id", row["sponsor_affiliate_id"])
                .limit(1)
                .execute()
            )
            if sp:
                erlaubt[sp[0]["id"]] = {**sp[0], "role": "sponsor"}
        for m in self._team_mitglieder(ctx.affiliate_id):
            erlaubt[m["id"]] = {**m, "role": "member"}
        return erlaubt

    def _thread_objekt(
        self, t: dict[str, Any], ctx: AffiliateContext, partner: dict[str, Any], unread: int = 0
    ) -> TeamThread:
        return TeamThread(
            id=t["id"],
            partner_id=partner["id"],
            partner_name=partner.get("company") or partner["full_name"],
            role=partner["role"],
            last_message_at=t.get("last_message_at"),
            unread=unread,
        )

    def team_threads(self, ctx: AffiliateContext) -> list[TeamThread]:
        erlaubt = self._team_partner_von(ctx)
        threads = fetch_all_rows(
            self._db.table("affiliate_team_threads")
            .select("*")
            .or_(
                f"sponsor_affiliate_id.eq.{ctx.affiliate_id},"
                f"member_affiliate_id.eq.{ctx.affiliate_id}"
            )
            .order("last_message_at", desc=True)
        )
        aus: list[TeamThread] = []
        for t in threads:
            anderer = (
                t["member_affiliate_id"]
                if t["sponsor_affiliate_id"] == ctx.affiliate_id
                else t["sponsor_affiliate_id"]
            )
            partner = erlaubt.get(anderer)
            if partner is None:
                continue  # Beziehung inzwischen gelöst — Verlauf bleibt, aber nicht mehr sichtbar
            ungelesen = (
                self._db.table("affiliate_team_messages")
                .select("id", count="exact")
                .eq("thread_id", t["id"])
                .neq("sender_affiliate_id", ctx.affiliate_id)
                .is_("read_at", "null")
                .limit(1)
                .execute()
            )
            aus.append(self._thread_objekt(t, ctx, partner, ungelesen.count or 0))
        return aus

    def team_thread_starten(self, ctx: AffiliateContext, partner_id: str) -> TeamThread:
        erlaubt = self._team_partner_von(ctx)
        partner = erlaubt.get(partner_id)
        if partner is None:
            raise AffiliateError("Kein Team-Verhältnis zu diesem Partner.", status_code=403)
        sponsor_id, member_id = (
            (partner_id, ctx.affiliate_id)
            if partner["role"] == "sponsor"
            else (ctx.affiliate_id, partner_id)
        )
        vorhanden = _rows(
            self._db.table("affiliate_team_threads")
            .select("*")
            .eq("sponsor_affiliate_id", sponsor_id)
            .eq("member_affiliate_id", member_id)
            .limit(1)
            .execute()
        )
        if vorhanden:
            return self._thread_objekt(vorhanden[0], ctx, partner)
        try:
            res = (
                self._db.table("affiliate_team_threads")
                .insert({"sponsor_affiliate_id": sponsor_id, "member_affiliate_id": member_id})
                .execute()
            )
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VIOLATION:  # Doppelklick (Wurzel 2)
                return self.team_thread_starten(ctx, partner_id)
            raise
        return self._thread_objekt(_rows(res)[0], ctx, partner)

    def _own_thread(self, ctx: AffiliateContext, thread_id: str) -> dict[str, Any]:
        rows = _rows(
            self._db.table("affiliate_team_threads")
            .select("*")
            .eq("id", thread_id)
            .limit(1)
            .execute()
        )
        if not rows or ctx.affiliate_id not in (
            rows[0]["sponsor_affiliate_id"],
            rows[0]["member_affiliate_id"],
        ):
            raise AffiliateError("Unterhaltung nicht gefunden.", status_code=404)
        return rows[0]

    def team_nachrichten(self, ctx: AffiliateContext, thread_id: str) -> list[TeamNachricht]:
        self._own_thread(ctx, thread_id)
        rows = fetch_all_rows(
            self._db.table("affiliate_team_messages")
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at")
        )
        # Lesen = gelesen (für die fremden Nachrichten).
        self._db.table("affiliate_team_messages").update(
            {"read_at": datetime.now(UTC).isoformat()}
        ).eq("thread_id", thread_id).neq("sender_affiliate_id", ctx.affiliate_id).is_(
            "read_at", "null"
        ).execute()
        return [
            TeamNachricht(
                id=r["id"],
                thread_id=r["thread_id"],
                sender_affiliate_id=r["sender_affiliate_id"],
                mine=r["sender_affiliate_id"] == ctx.affiliate_id,
                body=r["body"],
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def team_nachricht_senden(
        self, ctx: AffiliateContext, thread_id: str, body: str
    ) -> TeamNachricht:
        thread = self._own_thread(ctx, thread_id)
        anderer = (
            thread["member_affiliate_id"]
            if thread["sponsor_affiliate_id"] == ctx.affiliate_id
            else thread["sponsor_affiliate_id"]
        )
        if anderer not in self._team_partner_von(ctx):
            raise AffiliateError("Das Team-Verhältnis besteht nicht mehr.", status_code=403)
        text_ = body.strip()
        if not text_:
            raise AffiliateError("Leere Nachricht.", status_code=422)
        res = (
            self._db.table("affiliate_team_messages")
            .insert(
                {"thread_id": thread_id, "sender_affiliate_id": ctx.affiliate_id, "body": text_}
            )
            .execute()
        )
        r = _rows(res)[0]
        self._db.table("affiliate_team_threads").update({"last_message_at": r["created_at"]}).eq(
            "id", thread_id
        ).execute()
        return TeamNachricht(
            id=r["id"],
            thread_id=thread_id,
            sender_affiliate_id=ctx.affiliate_id,
            mine=True,
            body=text_,
            created_at=r["created_at"],
        )

    def _bo_team_mitglied(
        self, m: dict[str, Any], ertraege: list[dict[str, Any]], overrides: list[dict[str, Any]]
    ) -> BackofficeTeamMitglied:
        return BackofficeTeamMitglied(
            affiliate_id=m["id"],
            name=m["full_name"],
            company=m.get("company"),
            email=m["email"],
            status=m["status"],
            current_tier_id=m["current_tier_id"],
            joined_at=m.get("sponsor_joined_at"),
            flags=list(m.get("sponsor_flags") or []),
            paying_customers=self.zahlende_kunden(m["id"]),
            revenue_total=_summe(
                [e for e in ertraege if e["affiliate_id"] == m["id"]], "base_amount"
            ),
            override_total=_summe(
                [
                    o
                    for o in overrides
                    if _team_partner_id(o.get("reason")) == m["id"]
                    and o["status"] in ("pending", "held", "approved", "paid")
                ]
            ),
        )

    def bo_team(self, affiliate_id: str) -> BackofficeTeam:
        row = self._bo_row(affiliate_id)
        mitglieder = self._team_mitglieder(affiliate_id)
        ertraege, overrides = self._team_zeilen(affiliate_id, [m["id"] for m in mitglieder])
        sponsor: BackofficeTeamMitglied | None = None
        if row.get("sponsor_affiliate_id"):
            sp = _rows(
                self._db.table("affiliates")
                .select(
                    "id, full_name, company, email, status, current_tier_id, sponsor_joined_at, "
                    "sponsor_flags"
                )
                .eq("id", row["sponsor_affiliate_id"])
                .limit(1)
                .execute()
            )
            if sp:
                # Für den Sponsor-Block: Flags der BEZIEHUNG (stehen am Mitglied = row).
                sponsor = self._bo_team_mitglied(
                    {
                        **sp[0],
                        "sponsor_joined_at": row.get("sponsor_joined_at"),
                        "sponsor_flags": row.get("sponsor_flags") or [],
                    },
                    [],
                    [],
                )
        return BackofficeTeam(
            sponsor=sponsor,
            members=[self._bo_team_mitglied(m, ertraege, overrides) for m in mitglieder],
            override_pending=_summe([o for o in overrides if o["status"] in ("pending", "held")]),
            override_approved=_summe([o for o in overrides if o["status"] == "approved"]),
            override_paid=_summe([o for o in overrides if o["status"] == "paid"]),
        )

    def bo_sponsor_setzen(
        self, affiliate_id: str, req: BackofficeSponsorSetzen, admin: PlatformContext
    ) -> BackofficePartner:
        """Sponsor setzen, umhängen oder lösen — nur hier, mit Grund und Audit.
        Eine Ebene erzwingt der DB-Trigger; hier wird die Fachregel zusätzlich
        geprüft, damit der Fehler lesbar ist statt ein 23514."""
        row = self._bo_row(affiliate_id)
        updates: dict[str, Any] = {}
        if req.sponsor_affiliate_id is None:
            updates.update({"sponsor_affiliate_id": None, "sponsor_joined_at": None})
        else:
            if req.sponsor_affiliate_id == affiliate_id:
                raise AffiliateError(
                    "Ein Partner kann nicht sein eigener Sponsor sein.", status_code=422
                )
            sponsor = self._bo_row(req.sponsor_affiliate_id)
            if sponsor.get("sponsor_affiliate_id"):
                raise AffiliateError(
                    "Der gewählte Sponsor ist selbst Team-Mitglied — nur eine Ebene.",
                    status_code=422,
                )
            if not attribution.rang_darf_team_fuehren(self._db, sponsor.get("current_tier_id")):
                raise AffiliateError(
                    "Der gewählte Sponsor darf in seinem Rang noch kein Team führen "
                    "(erst ab Aufsteiger).",
                    status_code=422,
                )
            if self._team_size(affiliate_id) > 0:
                raise AffiliateError(
                    "Dieser Partner führt ein Team und kann kein Team-Mitglied werden.",
                    status_code=422,
                )
            if req.sponsor_affiliate_id != row.get("sponsor_affiliate_id"):
                updates.update(
                    {
                        "sponsor_affiliate_id": req.sponsor_affiliate_id,
                        "sponsor_joined_at": datetime.now(UTC).isoformat(),
                        "sponsor_flags": attribution.sponsor_flags(
                            sponsor=sponsor, bewerber_email=row["email"]
                        ),
                    }
                )
        if req.clear_flags:
            updates["sponsor_flags"] = []
        if updates:
            try:
                self._db.table("affiliates").update(updates).eq("id", affiliate_id).execute()
            except APIError as exc:
                raise AffiliateError(f"Zuordnung abgelehnt: {exc}", status_code=422) from exc
        log.info(
            "partner_sponsor_gesetzt",
            affiliate_id=affiliate_id,
            sponsor=req.sponsor_affiliate_id,
            by=admin.user_id,
            note=req.note,
        )
        return self._bo_partner(self._bo_row(affiliate_id))
