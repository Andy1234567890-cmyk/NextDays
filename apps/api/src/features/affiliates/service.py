"""Service-Schicht des Partnerprogramms.

Zwei Clients wie in `guest_auth`: `_anon` für Login/Refresh/Reset (RLS-
respektierend, GoTrue), `_service` für alles an den Partner-Tabellen — die
sind für anon/authenticated hart gesperrt (0517, Wurzel 6). Jeder per-ID-
Zugriff ist über `affiliate_id` aus dem Token gescopet (Wurzel 3/9); es gibt
keinen ungescopten Load mit nachgelagertem Vergleich.

Der Partner sieht seine Kunden NUR pseudonym (`#3`), mit Land, Status und
Beträgen — nie Name, nie E-Mail (Rewardful-Standard, Datenminimierung).
"""

from __future__ import annotations

import secrets
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from postgrest.exceptions import APIError
from pydantic import SecretStr
from supabase import Client
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.core.captcha import CaptchaError, CaptchaService
from src.core.config import Settings, get_settings
from src.core.gotrue_fehler import (
    STOERUNG_MELDUNG,
    TRANSPORT_FEHLER,
    ist_abgelehnt,
    stoerung_oder_ablehnung,
)
from src.core.logging import get_logger, mask_email
from src.core.security import AffiliateContext, PlatformContext
from src.core.supabase import fetch_all_rows

from . import attribution, vies
from .attribution import code_normalisieren, code_vorschlag
from .connect_service import ConnectMixin
from .fehler import AffiliateError
from .kanaele import kanaele_aus_zeile
from .leads_service import LeadsMixin
from .login_konto import LoginKontoMixin
from .mails import PartnerMails
from .schemas import (
    BackofficeEntscheidung,
    BackofficeKorrektur,
    BackofficeManuelleZuordnung,
    BackofficeMaterial,
    BackofficeMaterialAendern,
    BackofficeMaterialAnlegen,
    BackofficePartner,
    BackofficePartnerDetail,
    BackofficePartnerListe,
    BackofficeProvision,
    BackofficeProvisionsListe,
    BackofficeRangSetzen,
    BackofficeReferral,
    BackofficeReferralListe,
    BackofficeReferralStatus,
    BackofficeSperre,
    Betrag,
    ConnectStand,
    PartnerAuszahlung,
    PartnerAuszahlungsListe,
    PartnerBewerbung,
    PartnerCode,
    PartnerCodeAnlegen,
    PartnerDashboard,
    PartnerKennzahlen,
    PartnerKunde,
    PartnerKundenListe,
    PartnerLogin,
    PartnerMaterial,
    PartnerMessage,
    PartnerNaechsterRang,
    PartnerPasswordReset,
    PartnerProfil,
    PartnerProfilUpdate,
    PartnerProvision,
    PartnerProvisionsListe,
    PartnerRang,
    PartnerRefresh,
    PartnerSession,
    PartnerSteuerdaten,
    SliceHealth,
    SocialKanal,
)
from .team_service import TeamMixin, _summe, _team_partner_id
from .tracking_service import TrackingMixin, _reichweite

log = get_logger("nextdays.affiliates")

CAPTCHA_AKTION = "partner_bewerbung"
_UNIQUE_VIOLATION = "23505"
_MAX_LIMIT = 200
# Zahlende Kunden: Zuordnung hat eine erste bezahlte Rechnung UND das Abo des
# Betriebs läuft noch (past_due zählt: die Zahlung ist nur verzögert).
_ZAHLEND_STATUS = ("active", "past_due")


def _kanaele(row: dict[str, Any]) -> list[SocialKanal]:
    return kanaele_aus_zeile(row, SocialKanal)


def _rows(res: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    return list(getattr(res, "data", None) or [])


def _rang(tier: dict[str, Any], boni: list[dict[str, Any]] | None = None) -> PartnerRang:
    return PartnerRang(
        id=tier["id"],
        name=tier["name"],
        min_customers=int(tier["min_customers"]),
        max_customers=tier.get("max_customers"),
        rate=str(Decimal(str(tier["rate"])).normalize()),
        # 0525: außer Dienst — immer "0", die Team-Provision ist die Differenz.
        override_rate="0",
        lifetime_rate=str(Decimal(str(tier.get("lifetime_rate") or "0")).normalize()),
        team_allowed=bool(tier.get("team_allowed")),
        bonus=[
            Betrag(amount=f"{Decimal(str(b['amount'])):.2f}", currency=str(b["currency"]).upper())
            for b in (boni or [])
        ],
    )


def _betraege(summen: dict[str, Decimal]) -> list[Betrag]:
    return [Betrag(amount=f"{summen[w]:.2f}", currency=w) for w in sorted(summen) if summen[w] != 0]


def _maskiert(method: str | None, details: dict[str, Any]) -> str | None:
    if not method:
        return None
    if method == "sepa":
        iban = str(details.get("iban") or "")
        return f"…{iban[-4:]}" if iban else None
    email = str(details.get("email") or "")
    return mask_email(email) if email else None




class AffiliatesService(
    LoginKontoMixin, TeamMixin, TrackingMixin, ConnectMixin, LeadsMixin
):
    slice_name = "affiliates"

    def __init__(
        self,
        anon_client: Client,
        service_client: Client,
        *,
        settings: Settings | None = None,
        mails: PartnerMails | None = None,
        captcha: CaptchaService | None = None,
        vies_pruefen: Any = vies.pruefen,  # noqa: ANN401 — injizierbar für Tests
    ) -> None:
        self._anon = anon_client
        self._db = service_client
        self._settings = settings or get_settings()
        self._mails = mails or PartnerMails(settings=self._settings)
        self._captcha = captcha or CaptchaService(self._settings)
        self._vies = vies_pruefen

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    @property
    def db(self) -> Client:
        """Service-Client für Router-Bausteine ohne Partner-Kontext (Klick,
        Auszahlungslauf, Audit). Der Scope liegt dort beim Backoffice-Guard."""
        return self._db

    @property
    def mails(self) -> PartnerMails:
        return self._mails

    # --- Ränge ----------------------------------------------------------------

    def raenge(self) -> list[PartnerRang]:
        rows = _rows(self._db.table("affiliate_tiers").select("*").order("sort").execute())
        if not rows:
            raise AffiliateError(
                "Staffel nicht hinterlegt (affiliate_tiers leer).", status_code=503
            )
        boni: dict[str, list[dict[str, Any]]] = {}
        for b in _rows(self._db.table("affiliate_tier_bonuses").select("*").execute()):
            boni.setdefault(b["tier_id"], []).append(b)
        return [_rang(r, boni.get(r["id"])) for r in rows]

    def _tier(self, tier_id: str) -> dict[str, Any]:
        rows = _rows(
            self._db.table("affiliate_tiers").select("*").eq("id", tier_id).limit(1).execute()
        )
        if not rows:
            raise AffiliateError(f"Rang {tier_id!r} unbekannt.", status_code=500)
        return rows[0]

    # --- Bewerbung -------------------------------------------------------------

    def bewerben(
        self,
        req: PartnerBewerbung,
        *,
        ip: str | None,
        user_agent: str | None,
    ) -> PartnerSession:
        """Bewerbung annehmen: Captcha → Login-Konto → Partnerzeile → Session.

        Honigtopf gefüllt → dieselbe Antwortform wie sonst wäre hier nicht
        möglich (es gibt eine Session zurück); der Bot bekommt einen 422 ohne
        Hinweis auf den Grund.
        """
        if req.website:
            raise AffiliateError("Bewerbung nicht angenommen.", status_code=422)
        try:
            self._captcha.pruefen(
                req.captcha_token, aktion=CAPTCHA_AKTION, ip=ip, user_agent=user_agent
            )
        except CaptchaError as exc:
            raise AffiliateError(exc.message, status_code=exc.status_code) from exc
        if req.legal_form == "company" and not req.vat_id:
            raise AffiliateError(
                "Unternehmen brauchen eine USt-IdNr. — oder als Privatperson bewerben.",
                status_code=422,
            )

        # `neu_angelegt` entscheidet, was ein Rollback darf: bei einem
        # ERWEITERTEN Bestandskonto (siehe `_create_auth_user`) darf es das
        # Konto NIE löschen — das wäre die Löschung eines fremden PMS-Zugangs
        # wegen eines fehlgeschlagenen Bewerbungs-Inserts (Wurzel 1: der
        # Gegenzustand ist die Partner-Kennung, nicht das Konto).
        user_id, neu_angelegt = self._login_konto_sichern(req.email, req.password)
        try:
            self._db.table("affiliates").insert(
                {
                    "id": user_id,
                    "email": req.email.lower(),
                    "full_name": req.full_name.strip(),
                    "company": (req.company or "").strip() or None,
                    "legal_form": req.legal_form,
                    "country": req.country,
                    "vat_id": req.vat_id,
                    "language": req.language,
                    "channel_url": req.channel_url,
                    "channels": [k.model_dump() for k in req.channels],
                    "pitch": (req.pitch or "").strip() or None,
                    "terms_version": req.terms_version,
                    "terms_accepted_at": datetime.now(UTC).isoformat(),
                }
            ).execute()
        except APIError as exc:
            self._rollback_login_konto(user_id, neu_angelegt=neu_angelegt)
            if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
                raise AffiliateError(
                    "Für diese E-Mail gibt es bereits eine Bewerbung.", status_code=409
                ) from exc
            raise
        except Exception:
            self._rollback_login_konto(user_id, neu_angelegt=neu_angelegt)
            raise
        if req.vat_id:
            self._vat_pruefen_und_merken(user_id, req.vat_id)
        if req.sponsor_code:
            # Team (0520): einmalig, aus dem sichtbar bestätigten Code. Kein Treffer
            # → keine Zuordnung, die Bewerbung bleibt gültig.
            attribution.sponsor_zuordnen(
                self._db,
                affiliate_id=user_id,
                bewerber_email=req.email,
                sponsor_code=req.sponsor_code,
                mails=self._mails,
                bewerber_name=req.full_name.strip(),
            )
        self._mails.bewerbung_eingegangen(email=req.email, name=req.full_name, sprache=req.language)
        log.info("partner_bewerbung", affiliate_id=user_id, email=mask_email(req.email))
        return self.login(PartnerLogin(email=req.email, password=req.password))

    def _vat_pruefen_und_merken(self, affiliate_id: str, vat_id: str) -> bool | None:
        ergebnis = self._vies(vat_id)
        update: dict[str, Any] = {"vat_id": vat_id}
        if ergebnis is True:
            update["vat_id_verified_at"] = datetime.now(UTC).isoformat()
        else:
            update["vat_id_verified_at"] = None
        self._db.table("affiliates").update(update).eq("id", affiliate_id).execute()
        log.info("partner_vies", affiliate_id=affiliate_id, ergebnis=ergebnis)
        return ergebnis

    # --- Login / Refresh / Reset ---------------------------------------------

    def login(self, req: PartnerLogin) -> PartnerSession:
        try:
            res = self._anon.auth.sign_in_with_password(
                {"email": req.email, "password": req.password.get_secret_value()}
            )
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            stoerung = stoerung_oder_ablehnung(exc)
            log.warning(
                "partner_login_failed",
                email=mask_email(req.email),
                error=str(exc),
                stoerung=stoerung,
            )
            if stoerung:
                raise AffiliateError(STOERUNG_MELDUNG, status_code=503) from exc
            raise AffiliateError("Login fehlgeschlagen.", status_code=401) from exc
        if res.session is None:
            raise AffiliateError("Login fehlgeschlagen.", status_code=401)
        # Nur ein Partner-Konto darf hier eine Session bekommen — ein Betriebs-
        # Nutzer mit gültigem Passwort sonst schon (dieselbe GoTrue-Instanz).
        meta = getattr(res.user, "app_metadata", None) or {}
        if meta.get("affiliate") is not True:
            raise AffiliateError("Kein Partner-Konto.", status_code=403)
        return PartnerSession(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            expires_in=res.session.expires_in,
        )

    def refresh(self, req: PartnerRefresh) -> PartnerSession:
        try:
            res = self._anon.auth.refresh_session(req.refresh_token.get_secret_value())
        except GoTrueAuthError as exc:
            if not ist_abgelehnt(exc):
                raise AffiliateError("Anmeldedienst nicht erreichbar.", status_code=503) from exc
            raise AffiliateError("Sitzung abgelaufen.", status_code=401) from exc
        except TRANSPORT_FEHLER as exc:
            raise AffiliateError("Anmeldedienst nicht erreichbar.", status_code=503) from exc
        if res.session is None:
            raise AffiliateError("Sitzung abgelaufen.", status_code=401)
        return PartnerSession(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            expires_in=res.session.expires_in,
        )

    def password_reset(self, req: PartnerPasswordReset) -> PartnerMessage:
        """Antwortet IMMER neutral (kein Existenz-Leak)."""
        try:
            self._anon.auth.reset_password_email(req.email)
        except Exception as exc:  # noqa: BLE001 — best-effort, neutrale Antwort bleibt
            log.warning(
                "partner_password_reset_failed", email=mask_email(req.email), error=str(exc)
            )
        return PartnerMessage(message="Falls ein Konto existiert, wurde eine E-Mail versendet.")

    def _reauth(self, ctx: AffiliateContext, password: SecretStr) -> None:
        """Passwort-Rückfrage vor sicherheitskritischen Änderungen (Wurzel 7)."""
        try:
            res = self._anon.auth.sign_in_with_password(
                {"email": ctx.email, "password": password.get_secret_value()}
            )
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            if stoerung_oder_ablehnung(exc):
                raise AffiliateError(STOERUNG_MELDUNG, status_code=503) from exc
            raise AffiliateError("Passwort stimmt nicht.", status_code=401) from exc
        if res.session is None:
            raise AffiliateError("Passwort stimmt nicht.", status_code=401)

    # --- Profil ---------------------------------------------------------------

    def _own_row(self, ctx: AffiliateContext) -> dict[str, Any]:
        rows = _rows(
            self._db.table("affiliates").select("*").eq("id", ctx.affiliate_id).limit(1).execute()
        )
        if not rows:
            raise AffiliateError("Partner nicht gefunden.", status_code=404)
        return rows[0]

    def _profil(self, row: dict[str, Any]) -> PartnerProfil:
        details = row.get("payout_details") or {}
        return PartnerProfil(
            affiliate_id=row["id"],
            email=row["email"],
            full_name=row["full_name"],
            company=row.get("company"),
            legal_form=row["legal_form"],
            country=row["country"],
            vat_id=row.get("vat_id"),
            vat_id_verified=bool(row.get("vat_id_verified_at")),
            language=row.get("language") or "en",
            channel_url=row.get("channel_url"),
            channels=_kanaele(row),
            sponsor_name=self._partner_name(row.get("sponsor_affiliate_id")),
            team_size=self._team_size(row["id"]),
            status=row["status"],
            status_reason=row.get("status_reason"),
            tier=_rang(self._tier(row["current_tier_id"])),
            payout_method=row.get("payout_method"),
            payout_details_masked=_maskiert(row.get("payout_method"), details),
            connect=ConnectStand(
                verbunden=bool(row.get("stripe_account_id")),
                stripe_account_id=row.get("stripe_account_id"),
                auszahlbar=bool(row.get("stripe_payouts_enabled")),
                daten_vollstaendig=bool(row.get("stripe_details_submitted")),
                offene_felder=list(row.get("stripe_requirements") or []),
                gesperrt_grund=row.get("stripe_disabled_reason"),
            ),
            terms_version=row.get("terms_version"),
            created_at=row["created_at"],
        )

    def profil(self, ctx: AffiliateContext) -> PartnerProfil:
        return self._profil(self._own_row(ctx))

    def bedingungen_annehmen(self, ctx: AffiliateContext, version: str) -> PartnerProfil:
        self._own_row(ctx)
        self._db.table("affiliates").update(
            {"terms_version": version, "terms_accepted_at": datetime.now(UTC).isoformat()}
        ).eq("id", ctx.affiliate_id).execute()
        log.info("partner_bedingungen_angenommen", affiliate_id=ctx.affiliate_id, version=version)
        return self.profil(ctx)

    def profil_aendern(self, ctx: AffiliateContext, req: PartnerProfilUpdate) -> PartnerProfil:
        self._own_row(ctx)
        updates = req.model_dump(exclude_unset=True)
        if req.channels is not None:
            # Der Altwert `channel_url` bleibt der erste Kanal — Anzeigen, die
            # ihn noch lesen, zeigen so nie einen Kanal, den es nicht mehr gibt.
            updates["channels"] = [k.model_dump() for k in req.channels]
            updates["channel_url"] = req.channels[0].url
        if not updates:
            return self.profil(ctx)
        res = self._db.table("affiliates").update(updates).eq("id", ctx.affiliate_id).execute()
        rows = _rows(res)
        if not rows:
            raise AffiliateError("Partner nicht gefunden.", status_code=404)
        return self._profil(rows[0])

    def steuerdaten_setzen(self, ctx: AffiliateContext, req: PartnerSteuerdaten) -> PartnerProfil:
        """Rechtsform und USt-IdNr. — mit Re-Auth (Wurzel 7).

        Der Auszahlungsweg wird hier seit 0522 NICHT mehr gesetzt: es gibt nur
        das Verbundkonto, die Bankverbindung liegt bei Stripe. Schickt ein
        Altclient noch `payout_method`/`payout_details`, wird das ignoriert
        statt gespeichert — sonst stünde im Profil ein Weg, den der
        Auszahlungslauf nicht geht (Attrappe).
        """
        self._reauth(ctx, req.password)
        self._own_row(ctx)
        if req.legal_form == "company" and not req.vat_id:
            raise AffiliateError("Unternehmen brauchen eine USt-IdNr.", status_code=422)
        updates: dict[str, Any] = {
            "legal_form": req.legal_form,
            "country": req.country,
            "vat_id": req.vat_id,
            "vat_id_verified_at": None,
        }
        self._db.table("affiliates").update(updates).eq("id", ctx.affiliate_id).execute()
        if req.vat_id:
            self._vat_pruefen_und_merken(ctx.affiliate_id, req.vat_id)
        log.info("partner_steuerdaten_geaendert", affiliate_id=ctx.affiliate_id)
        return self.profil(ctx)

    # --- Codes ----------------------------------------------------------------

    def _code_objekt(self, row: dict[str, Any], klicks: int = 0) -> PartnerCode:
        basis = (self._settings.marketing_base_url or "").strip().rstrip("/")
        return PartnerCode(
            id=row["id"],
            code=row["code"],
            label=row.get("label"),
            active=bool(row.get("active", True)),
            url=f"{basis}/?ref={row['code']}" if basis else None,
            tracking_url=f"{basis}/p/{row['code']}" if basis else None,
            clicks_30d=klicks,
            created_at=row["created_at"],
        )

    def _klicks_30d(self, affiliate_id: str) -> dict[str, int]:
        seit = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        rows = fetch_all_rows(
            self._db.table("affiliate_clicks")
            .select("code_id")
            .eq("affiliate_id", affiliate_id)
            .gte("created_at", seit)
        )
        zaehler: dict[str, int] = defaultdict(int)
        for r in rows:
            zaehler[r["code_id"]] += 1
        return zaehler

    def codes(self, ctx: AffiliateContext) -> list[PartnerCode]:
        rows = _rows(
            self._db.table("affiliate_referral_codes")
            .select("*")
            .eq("affiliate_id", ctx.affiliate_id)
            .order("created_at")
            .execute()
        )
        klicks = self._klicks_30d(ctx.affiliate_id)
        return [self._code_objekt(r, klicks.get(r["id"], 0)) for r in rows]

    def code_anlegen(self, ctx: AffiliateContext, req: PartnerCodeAnlegen) -> PartnerCode:
        row = self._own_row(ctx)
        vorhanden = _rows(
            self._db.table("affiliate_referral_codes")
            .select("id")
            .eq("affiliate_id", ctx.affiliate_id)
            .execute()
        )
        if len(vorhanden) >= 10:
            raise AffiliateError("Höchstens zehn Codes je Partner.", status_code=422)
        code = req.code or code_vorschlag(row["full_name"])
        return self._code_objekt(self._code_einfuegen(ctx.affiliate_id, code, req.label))

    def _code_einfuegen(self, affiliate_id: str, code: str, label: str | None) -> dict[str, Any]:
        norm = code_normalisieren(code)
        if norm is None:
            raise AffiliateError("Code ungültig.", status_code=422)
        try:
            res = (
                self._db.table("affiliate_referral_codes")
                .insert({"affiliate_id": affiliate_id, "code": norm, "label": label})
                .execute()
            )
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
                raise AffiliateError("Dieser Code ist bereits vergeben.", status_code=409) from exc
            raise
        rows = _rows(res)
        if not rows:
            raise AffiliateError("Code konnte nicht angelegt werden.", status_code=500)
        return rows[0]

    def _startcode_sicherstellen(self, affiliate_id: str, name: str) -> str:
        rows = _rows(
            self._db.table("affiliate_referral_codes")
            .select("code")
            .eq("affiliate_id", affiliate_id)
            .eq("active", True)
            .order("created_at")
            .limit(1)
            .execute()
        )
        if rows:
            return rows[0]["code"]
        for _ in range(5):
            try:
                return self._code_einfuegen(affiliate_id, code_vorschlag(name), None)["code"]
            except AffiliateError as exc:
                if exc.status_code != 409:
                    raise
        raise AffiliateError("Kein freier Startcode gefunden.", status_code=500)

    # --- Kunden / Kennzahlen -------------------------------------------------

    def _referrals(self, affiliate_id: str) -> list[dict[str, Any]]:
        return fetch_all_rows(
            self._db.table("affiliate_referrals")
            .select("*")
            .eq("affiliate_id", affiliate_id)
            .order("created_at")
        )

    def _abo_status(self, tenant_ids: list[str]) -> dict[str, str]:
        if not tenant_ids:
            return {}
        rows = fetch_all_rows(
            self._db.table("tenant_subscription")
            .select("tenant_id, status")
            .in_("tenant_id", tenant_ids)
        )
        return {r["tenant_id"]: str(r.get("status") or "") for r in rows}

    def _laender(self, tenant_ids: list[str]) -> dict[str, str | None]:
        if not tenant_ids:
            return {}
        rows = fetch_all_rows(self._db.table("tenants").select("id, country").in_("id", tenant_ids))
        return {r["id"]: r.get("country") for r in rows}

    def _kunden_status(self, ref: dict[str, Any], abo: str) -> str:
        if ref["status"] == "rejected":
            return "abgelehnt"
        if ref["status"] == "held":
            return "in_pruefung"
        if not ref.get("first_paid_at"):
            return "registriert"
        return "zahlend" if abo in _ZAHLEND_STATUS else "beendet"

    def zahlende_kunden(self, affiliate_id: str) -> int:
        refs = [
            r
            for r in self._referrals(affiliate_id)
            if r["status"] == "approved" and r.get("first_paid_at")
        ]
        abo = self._abo_status([r["tenant_id"] for r in refs])
        return sum(1 for r in refs if abo.get(r["tenant_id"]) in _ZAHLEND_STATUS)

    def struktur_kunden(self, affiliate_id: str, eigene: int | None = None) -> int:
        """Eigene zahlende Kunden + die der Team-Partner (eine Ebene) — die Zahl,
        die den Rang bestimmt (0525, `stufen.struktur_kunden_je_partner`)."""
        eigene = self.zahlende_kunden(affiliate_id) if eigene is None else eigene
        team = self._team_mitglieder(affiliate_id)
        return eigene + sum(self.zahlende_kunden(m["id"]) for m in team)

    def _provisionen(self, affiliate_id: str) -> list[dict[str, Any]]:
        return fetch_all_rows(
            self._db.table("affiliate_commissions")
            .select("*")
            .eq("affiliate_id", affiliate_id)
            .order("created_at", desc=True)
        )

    def kunden(
        self, ctx: AffiliateContext, *, limit: int = 50, offset: int = 0
    ) -> PartnerKundenListe:
        refs = self._referrals(ctx.affiliate_id)
        ids = [r["tenant_id"] for r in refs]
        abo = self._abo_status(ids)
        laender = self._laender(ids)
        summen: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
        for c in self._provisionen(ctx.affiliate_id):
            if c["status"] in ("cancelled",):
                continue
            summen[c["referral_id"]][c["currency"]] += Decimal(str(c["amount"]))
        items: list[PartnerKunde] = []
        for n, r in enumerate(refs, start=1):
            items.append(
                PartnerKunde(
                    id=r["id"],
                    label=f"#{n}",
                    country=laender.get(r["tenant_id"]),
                    status=self._kunden_status(r, abo.get(r["tenant_id"], "")),
                    registered_at=r["created_at"],
                    first_paid_at=r.get("first_paid_at"),
                    commission_until=r.get("commission_until"),
                    earned=_betraege(summen.get(r["id"], {})),
                )
            )
        items.reverse()
        limit = max(1, min(_MAX_LIMIT, limit))
        return PartnerKundenListe(total=len(items), items=items[offset : offset + limit])

    def _kunden_labels(self, affiliate_id: str) -> dict[str, str]:
        return {r["id"]: f"#{n}" for n, r in enumerate(self._referrals(affiliate_id), start=1)}

    def provisionen(
        self, ctx: AffiliateContext, *, limit: int = 50, offset: int = 0
    ) -> PartnerProvisionsListe:
        rows = self._provisionen(ctx.affiliate_id)
        labels = self._kunden_labels(ctx.affiliate_id)
        team = self._team_namen(rows)
        limit = max(1, min(_MAX_LIMIT, limit))
        items = [self._provision(r, labels, team) for r in rows[offset : offset + limit]]
        return PartnerProvisionsListe(total=len(rows), items=items)

    def _team_namen(self, rows: list[dict[str, Any]]) -> dict[str, str]:
        ids = {tp for r in rows if (tp := _team_partner_id(r.get("reason")))}
        if not ids:
            return {}
        namen = fetch_all_rows(
            self._db.table("affiliates").select("id, full_name, company").in_("id", sorted(ids))
        )
        return {n["id"]: (n.get("company") or n["full_name"]) for n in namen}

    @staticmethod
    def _provision(
        r: dict[str, Any], labels: dict[str, str], team: dict[str, str] | None = None
    ) -> PartnerProvision:
        tp = (
            _team_partner_id(r.get("reason"))
            if r["kind"] in ("override", "lifetime", "booking_share")
            else None
        )
        if r["kind"] == "bonus":
            # Aufstiegsbonus hängt an keinem Kunden — der Rang ist die Quelle.
            label = r.get("tier_id") or "—"
        else:
            label = labels.get(r.get("referral_id") or "", "Team" if tp else "#?")
        return PartnerProvision(
            id=r["id"],
            customer_label=label,
            source_partner_name=(team or {}).get(tp) if tp else None,
            kind=r["kind"],
            amount=f"{Decimal(str(r['amount'])):.2f}",
            currency=r["currency"],
            base_amount=f"{Decimal(str(r['base_amount'])):.2f}",
            rate=str(Decimal(str(r["rate"])).normalize()),
            tier_id=r["tier_id"],
            status=r["status"],
            period=r.get("period"),
            matures_at=r.get("matures_at"),
            created_at=r["created_at"],
        )

    def auszahlungen(
        self, ctx: AffiliateContext, *, limit: int = 50, offset: int = 0
    ) -> PartnerAuszahlungsListe:
        res = (
            self._db.table("affiliate_payouts")
            .select("*", count="exact")
            .eq("affiliate_id", ctx.affiliate_id)
            .order("created_at", desc=True)
            .range(offset, offset + max(1, min(_MAX_LIMIT, limit)) - 1)
            .execute()
        )
        return PartnerAuszahlungsListe(
            total=res.count or 0,
            items=[
                PartnerAuszahlung(
                    id=r["id"],
                    amount=f"{Decimal(str(r['amount'])):.2f}",
                    currency=r["currency"],
                    method=r["method"],
                    status=r["status"],
                    period_from=r.get("period_from"),
                    period_to=r.get("period_to"),
                    statement_no=r.get("statement_no"),
                    external_ref=r.get("external_ref"),
                    paid_at=r.get("paid_at"),
                    created_at=r["created_at"],
                )
                for r in _rows(res)
            ],
        )

    def dashboard(self, ctx: AffiliateContext) -> PartnerDashboard:
        row = self._own_row(ctx)
        refs = self._referrals(ctx.affiliate_id)
        abo = self._abo_status([r["tenant_id"] for r in refs if r.get("first_paid_at")])
        registrierungen = sum(1 for r in refs if r["status"] != "rejected")
        zahlend = sum(
            1
            for r in refs
            if r["status"] == "approved"
            and r.get("first_paid_at")
            and abo.get(r["tenant_id"]) in _ZAHLEND_STATUS
        )
        summen: dict[str, dict[str, Decimal]] = {
            "pending": defaultdict(Decimal),
            "approved": defaultdict(Decimal),
            "paid": defaultdict(Decimal),
        }
        for c in self._provisionen(ctx.affiliate_id):
            eimer = {
                "pending": "pending",
                "held": "pending",
                "approved": "approved",
                "paid": "paid",
            }.get(c["status"])
            if eimer:
                summen[eimer][c["currency"]] += Decimal(str(c["amount"]))
        raenge = self.raenge()
        aktuell = next((t for t in raenge if t.id == row["current_tier_id"]), raenge[0])
        struktur = self.struktur_kunden(ctx.affiliate_id, zahlend)
        naechster: PartnerNaechsterRang | None = None
        hoeher = [t for t in raenge if t.min_customers > aktuell.min_customers]
        if hoeher:
            ziel = min(hoeher, key=lambda t: t.min_customers)
            naechster = PartnerNaechsterRang(
                tier=ziel, missing_customers=max(0, ziel.min_customers - struktur)
            )
        codes = self.codes(ctx)
        _gueltig = ("pending", "held", "approved", "paid")

        def je_art(art: str) -> list[Betrag]:
            return _summe(
                [
                    c
                    for c in self._provisionen(ctx.affiliate_id)
                    if c["kind"] == art and c["status"] in _gueltig
                ]
            )

        return PartnerDashboard(
            status=row["status"],
            tier=aktuell,
            next_tier=naechster,
            kennzahlen=PartnerKennzahlen(
                team_size=self._team_size(ctx.affiliate_id),
                team_override=je_art("override"),
                structure_customers=struktur,
                lifetime=je_art("lifetime"),
                booking_share=je_art("booking_share"),
                bonus=je_art("bonus"),
                clicks_30d=sum(c.clicks_30d for c in codes),
                registrations=registrierungen,
                paying_customers=zahlend,
                pending=_betraege(summen["pending"]),
                approved=_betraege(summen["approved"]),
                paid=_betraege(summen["paid"]),
            ),
            codes=codes,
        )

    def material(self, ctx: AffiliateContext) -> list[PartnerMaterial]:
        row = self._own_row(ctx)
        rows = fetch_all_rows(
            self._db.table("affiliate_assets").select("*").eq("active", True).order("sort")
        )
        sprache = row.get("language") or "en"
        # Sprachneutrales Material plus das der eigenen Sprache; fehlt die
        # Sprache, zusätzlich Englisch — nie Deutsch als stummer Ersatz.
        vorhanden = {r.get("language") for r in rows}
        erlaubt = {None, sprache} | ({"en"} if sprache not in vorhanden else set())
        return [
            PartnerMaterial(
                id=r["id"],
                kind=r["kind"],
                title=r["title"],
                description=r.get("description"),
                language=r.get("language"),
                url=r.get("url"),
                body=r.get("body"),
            )
            for r in rows
            if r.get("language") in erlaubt
        ]

    # --- Backoffice -----------------------------------------------------------

    def _bo_partner(
        self,
        row: dict[str, Any],
        referrals: int = 0,
        zahlend: int = 0,
        klicks_30d: int = 0,
        sponsor_name: str | None = None,
        team_size: int | None = None,
    ) -> BackofficePartner:
        if sponsor_name is None and row.get("sponsor_affiliate_id"):
            sponsor_name = self._partner_name(row["sponsor_affiliate_id"])
        if team_size is None:
            team_size = self._team_size(row["id"])
        return BackofficePartner(
            sponsor_affiliate_id=row.get("sponsor_affiliate_id"),
            sponsor_name=sponsor_name,
            sponsor_joined_at=row.get("sponsor_joined_at"),
            sponsor_flags=list(row.get("sponsor_flags") or []),
            team_size=team_size,
            id=row["id"],
            email=row["email"],
            full_name=row["full_name"],
            company=row.get("company"),
            legal_form=row["legal_form"],
            country=row["country"],
            vat_id=row.get("vat_id"),
            vat_id_verified_at=row.get("vat_id_verified_at"),
            language=row.get("language") or "en",
            channel_url=row.get("channel_url"),
            channels=_kanaele(row),
            pitch=row.get("pitch"),
            status=row["status"],
            status_reason=row.get("status_reason"),
            current_tier_id=row["current_tier_id"],
            payout_method=row.get("payout_method"),
            terms_version=row.get("terms_version"),
            terms_accepted_at=row.get("terms_accepted_at"),
            created_at=row["created_at"],
            reviewed_at=row.get("reviewed_at"),
            referrals=referrals,
            paying_customers=zahlend,
            clicks_30d=klicks_30d,
            reach=_reichweite(row),
        )

    def bo_liste(
        self, *, status: str | None, suche: str | None, limit: int = 50, offset: int = 0
    ) -> BackofficePartnerListe:
        limit = max(1, min(_MAX_LIMIT, limit))
        q = self._db.table("affiliates").select("*", count="exact").order("created_at", desc=True)
        if status:
            q = q.eq("status", status)
        if suche:
            from src.core.supabase import escape_like  # noqa: PLC0415

            muster = f"%{escape_like(suche.strip())}%"
            q = q.or_(f"email.ilike.{muster},full_name.ilike.{muster},company.ilike.{muster}")
        res = q.range(offset, offset + limit - 1).execute()
        rows = _rows(res)
        ids = [r["id"] for r in rows]
        zaehler: dict[str, int] = defaultdict(int)
        zahlend: dict[str, int] = defaultdict(int)
        if ids:
            refs = fetch_all_rows(
                self._db.table("affiliate_referrals")
                .select("affiliate_id, tenant_id, status, first_paid_at")
                .in_("affiliate_id", ids)
            )
            abo = self._abo_status([r["tenant_id"] for r in refs if r.get("first_paid_at")])
            for r in refs:
                if r["status"] != "rejected":
                    zaehler[r["affiliate_id"]] += 1
                if (
                    r["status"] == "approved"
                    and r.get("first_paid_at")
                    and abo.get(r["tenant_id"]) in _ZAHLEND_STATUS
                ):
                    zahlend[r["affiliate_id"]] += 1
        klicks = self._klicks_je_partner(ids, tage=30) if ids else {}
        sponsor_ids = sorted(
            {r["sponsor_affiliate_id"] for r in rows if r.get("sponsor_affiliate_id")}
        )
        namen = {
            n["id"]: (n.get("company") or n["full_name"])
            for n in (
                fetch_all_rows(
                    self._db.table("affiliates")
                    .select("id, full_name, company")
                    .in_("id", sponsor_ids)
                )
                if sponsor_ids
                else []
            )
        }
        teams: dict[str, int] = defaultdict(int)
        if ids:
            for m in fetch_all_rows(
                self._db.table("affiliates")
                .select("sponsor_affiliate_id")
                .in_("sponsor_affiliate_id", ids)
            ):
                teams[m["sponsor_affiliate_id"]] += 1
        return BackofficePartnerListe(
            total=res.count or 0,
            items=[
                self._bo_partner(
                    r,
                    zaehler[r["id"]],
                    zahlend[r["id"]],
                    klicks.get(r["id"], 0),
                    sponsor_name=namen.get(r.get("sponsor_affiliate_id") or "", None),
                    team_size=teams.get(r["id"], 0),
                )
                for r in rows
            ],
        )

    def _klicks_je_partner(self, ids: list[str], *, tage: int) -> dict[str, int]:
        seit = (datetime.now(UTC) - timedelta(days=tage)).isoformat()
        rows = fetch_all_rows(
            self._db.table("affiliate_clicks")
            .select("affiliate_id")
            .in_("affiliate_id", ids)
            .gte("created_at", seit)
        )
        zaehler: dict[str, int] = defaultdict(int)
        for r in rows:
            zaehler[r["affiliate_id"]] += 1
        return zaehler

    def _bo_row(self, affiliate_id: str) -> dict[str, Any]:
        rows = _rows(
            self._db.table("affiliates").select("*").eq("id", affiliate_id).limit(1).execute()
        )
        if not rows:
            raise AffiliateError("Partner nicht gefunden.", status_code=404)
        return rows[0]

    def bo_detail(self, affiliate_id: str) -> BackofficePartnerDetail:
        row = self._bo_row(affiliate_id)
        codes = _rows(
            self._db.table("affiliate_referral_codes")
            .select("*")
            .eq("affiliate_id", affiliate_id)
            .order("created_at")
            .execute()
        )
        klicks = self._klicks_30d(affiliate_id)
        verlauf = _rows(
            self._db.table("affiliate_tier_history")
            .select("*")
            .eq("affiliate_id", affiliate_id)
            .order("valid_from", desc=True)
            .execute()
        )
        return BackofficePartnerDetail(
            partner=self._bo_partner(row, 0, self.zahlende_kunden(affiliate_id)),
            payout_details=dict(row.get("payout_details") or {}),
            codes=[self._code_objekt(c, klicks.get(c["id"], 0)) for c in codes],
            tier_history=verlauf,
        )

    def bo_entscheiden(
        self, affiliate_id: str, req: BackofficeEntscheidung, admin: PlatformContext
    ) -> BackofficePartner:
        row = self._bo_row(affiliate_id)
        if row["status"] not in ("pending_review", "rejected"):
            raise AffiliateError("Nur Bewerbungen können entschieden werden.", status_code=409)
        jetzt = datetime.now(UTC).isoformat()
        if req.decision == "approve":
            if not row.get("terms_accepted_at"):
                raise AffiliateError(
                    "Ohne Zustimmung zu den Bedingungen keine Freigabe.", status_code=422
                )
            self._db.table("affiliates").update(
                {
                    "status": "approved",
                    "status_reason": None,
                    "reviewed_by": admin.user_id,
                    "reviewed_at": jetzt,
                }
            ).eq("id", affiliate_id).execute()
            code = self._startcode_sicherstellen(affiliate_id, row["full_name"])
            self._db.table("affiliate_tier_history").insert(
                {
                    "affiliate_id": affiliate_id,
                    "tier_id": row["current_tier_id"],
                    "paying_customers": 0,
                    "trigger_kind": "manual",
                    "changed_by": admin.user_id,
                    "note": "Freigabe",
                }
            ).execute()
            self._mails.freigegeben(
                email=row["email"],
                name=row["full_name"],
                sprache=row.get("language") or "en",
                code=code,
            )
        else:
            self._db.table("affiliates").update(
                {
                    "status": "rejected",
                    "status_reason": req.reason,
                    "reviewed_by": admin.user_id,
                    "reviewed_at": jetzt,
                }
            ).eq("id", affiliate_id).execute()
            self._mails.abgelehnt(
                email=row["email"],
                name=row["full_name"],
                sprache=row.get("language") or "en",
                grund=req.reason,
            )
        log.info(
            "partner_entscheidung",
            affiliate_id=affiliate_id,
            decision=req.decision,
            by=admin.user_id,
        )
        return self._bo_partner(self._bo_row(affiliate_id))

    def bo_sperren(
        self, affiliate_id: str, req: BackofficeSperre, admin: PlatformContext
    ) -> BackofficePartner:
        row = self._bo_row(affiliate_id)
        if row["status"] != "approved":
            raise AffiliateError(
                "Nur freigegebene Partner können gesperrt werden.", status_code=409
            )
        self._db.table("affiliates").update(
            {
                "status": "suspended",
                "status_reason": req.reason,
                "reviewed_by": admin.user_id,
                "reviewed_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", affiliate_id).execute()
        # Gegenzustand (Wurzel 1): offene Erträge nicht mehr auszahlen.
        self._db.table("affiliate_commissions").update(
            {"status": "held", "reason": "partner_suspended"}
        ).eq("affiliate_id", affiliate_id).in_("status", ["pending", "approved"]).execute()
        # Team (0520): auch die Overrides des Sponsors, die aus diesem Partner stammen.
        self._db.table("affiliate_commissions").update(
            {"status": "held", "reason": f"team_suspended:{affiliate_id}"}
        ).eq("kind", "override").eq("reason", f"team:{affiliate_id}").in_(
            "status", ["pending", "approved"]
        ).execute()
        log.info("partner_gesperrt", affiliate_id=affiliate_id, by=admin.user_id)
        return self._bo_partner(self._bo_row(affiliate_id))

    def bo_entsperren(self, affiliate_id: str, admin: PlatformContext) -> BackofficePartner:
        row = self._bo_row(affiliate_id)
        if row["status"] != "suspended":
            raise AffiliateError("Partner ist nicht gesperrt.", status_code=409)
        self._db.table("affiliates").update(
            {
                "status": "approved",
                "status_reason": None,
                "reviewed_by": admin.user_id,
                "reviewed_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", affiliate_id).execute()
        self._db.table("affiliate_commissions").update({"status": "pending", "reason": None}).eq(
            "affiliate_id", affiliate_id
        ).eq("status", "held").eq("reason", "partner_suspended").execute()
        self._db.table("affiliate_commissions").update(
            {"status": "pending", "reason": f"team:{affiliate_id}"}
        ).eq("kind", "override").eq("reason", f"team_suspended:{affiliate_id}").eq(
            "status", "held"
        ).execute()
        log.info("partner_entsperrt", affiliate_id=affiliate_id, by=admin.user_id)
        return self._bo_partner(self._bo_row(affiliate_id))

    def bo_referrals(self, affiliate_id: str) -> BackofficeReferralListe:
        refs = self._referrals(affiliate_id)
        ids = [r["tenant_id"] for r in refs]
        namen: dict[str, dict[str, Any]] = {}
        if ids:
            for t in fetch_all_rows(
                self._db.table("tenants").select("id, name, country").in_("id", ids)
            ):
                namen[t["id"]] = t
        return BackofficeReferralListe(
            total=len(refs),
            items=[
                BackofficeReferral(
                    id=r["id"],
                    affiliate_id=r["affiliate_id"],
                    tenant_id=r["tenant_id"],
                    tenant_name=namen.get(r["tenant_id"], {}).get("name"),
                    tenant_country=namen.get(r["tenant_id"], {}).get("country"),
                    method=r["method"],
                    status=r["status"],
                    flags=list(r.get("flags") or []),
                    contact_opt_in=bool(r.get("contact_opt_in")),
                    first_paid_at=r.get("first_paid_at"),
                    commission_until=r.get("commission_until"),
                    review_note=r.get("review_note"),
                    created_at=r["created_at"],
                )
                for r in reversed(refs)
            ],
        )

    def bo_referral_status(
        self, referral_id: str, req: BackofficeReferralStatus, admin: PlatformContext
    ) -> BackofficeReferral:
        rows = _rows(
            self._db.table("affiliate_referrals")
            .select("*")
            .eq("id", referral_id)
            .limit(1)
            .execute()
        )
        if not rows:
            raise AffiliateError("Zuordnung nicht gefunden.", status_code=404)
        self._db.table("affiliate_referrals").update(
            {
                "status": req.status,
                "review_note": req.note,
                "reviewed_by": admin.user_id,
                "reviewed_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", referral_id).execute()
        # Gegenzustand an den Provisionszeilen (Wurzel 1).
        if req.status == "approved":
            self._db.table("affiliate_commissions").update({"status": "pending"}).eq(
                "referral_id", referral_id
            ).eq("status", "held").execute()
        elif req.status == "rejected":
            self._db.table("affiliate_commissions").update(
                {"status": "cancelled", "reason": req.note}
            ).eq("referral_id", referral_id).in_(
                "status", ["pending", "approved", "held"]
            ).execute()
        else:
            self._db.table("affiliate_commissions").update({"status": "held"}).eq(
                "referral_id", referral_id
            ).in_("status", ["pending", "approved"]).execute()
        log.info(
            "partner_zuordnung_entschieden",
            referral_id=referral_id,
            status=req.status,
            by=admin.user_id,
        )
        aff = rows[0]["affiliate_id"]
        return next(i for i in self.bo_referrals(aff).items if i.id == referral_id)

    def bo_manuell_zuordnen(
        self, req: BackofficeManuelleZuordnung, admin: PlatformContext
    ) -> BackofficeReferral:
        self._bo_row(req.affiliate_id)
        try:
            res = (
                self._db.table("affiliate_referrals")
                .insert(
                    {
                        "affiliate_id": req.affiliate_id,
                        "tenant_id": req.tenant_id,
                        "method": "manual",
                        "status": "approved",
                        "flags": [],
                        "contact_opt_in": req.contact_opt_in,
                        "review_note": req.note,
                        "reviewed_by": admin.user_id,
                        "reviewed_at": datetime.now(UTC).isoformat(),
                    }
                )
                .execute()
            )
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
                raise AffiliateError(
                    "Dieser Betrieb ist bereits einem Partner zugeordnet.", status_code=409
                ) from exc
            raise
        neu = _rows(res)[0]
        log.info(
            "partner_zuordnung_manuell",
            tenant_id=req.tenant_id,
            affiliate_id=req.affiliate_id,
            by=admin.user_id,
        )
        return next(i for i in self.bo_referrals(req.affiliate_id).items if i.id == neu["id"])

    def bo_provisionen(
        self, affiliate_id: str, *, limit: int = 100, offset: int = 0
    ) -> BackofficeProvisionsListe:
        rows = self._provisionen(affiliate_id)
        labels = self._kunden_labels(affiliate_id)
        team = self._team_namen(rows)
        limit = max(1, min(_MAX_LIMIT, limit))
        items = []
        for r in rows[offset : offset + limit]:
            basis = self._provision(r, labels, team)
            items.append(
                BackofficeProvision(
                    **basis.model_dump(),
                    tenant_id=r["tenant_id"],
                    stripe_invoice_id=r.get("stripe_invoice_id"),
                    reason=r.get("reason"),
                    parent_id=r.get("parent_id"),
                    source_affiliate_id=_team_partner_id(r.get("reason")),
                )
            )
        return BackofficeProvisionsListe(total=len(rows), items=items)

    def bo_korrektur(
        self, affiliate_id: str, req: BackofficeKorrektur, admin: PlatformContext
    ) -> BackofficeProvision:
        row = self._bo_row(affiliate_id)
        referral_id = req.referral_id
        if referral_id is None:
            refs = self._referrals(affiliate_id)
            if not refs:
                raise AffiliateError(
                    "Partner hat keine Zuordnung — Korrektur braucht eine.", status_code=422
                )
            referral_id = refs[0]["id"]
        refs = _rows(
            self._db.table("affiliate_referrals")
            .select("id, tenant_id")
            .eq("id", referral_id)
            .eq("affiliate_id", affiliate_id)
            .limit(1)
            .execute()
        )
        if not refs:
            raise AffiliateError("Zuordnung gehört nicht zu diesem Partner.", status_code=404)
        betrag = Decimal(req.amount)
        # Währung gegen die Auszahlungs-Tabelle prüfen (Daten, Wurzel 4): eine
        # unbekannte Währung wäre eine Zeile, die der Lauf nie auszahlen kann.
        bekannt = _rows(
            self._db.table("affiliate_payout_minimums")
            .select("currency")
            .eq("currency", req.currency.upper())
            .limit(1)
            .execute()
        )
        if not bekannt:
            raise AffiliateError(
                f"Währung {req.currency.upper()} ist nicht in affiliate_payout_minimums "
                "hinterlegt — erst dort ergänzen.",
                status_code=422,
            )
        tier = self._tier(row["current_tier_id"])
        res = (
            self._db.table("affiliate_commissions")
            .insert(
                {
                    "referral_id": referral_id,
                    "affiliate_id": affiliate_id,
                    "tenant_id": refs[0]["tenant_id"],
                    "kind": "adjustment",
                    "currency": req.currency.upper(),
                    "base_amount": "0.00",
                    "rate": str(tier["rate"]),
                    "tier_id": tier["id"],
                    "amount": f"{betrag:.2f}",
                    "status": "approved",
                    "period": datetime.now(UTC).strftime("%Y-%m"),
                    "reason": f"{req.reason} (by {admin.email or admin.user_id})",
                }
            )
            .execute()
        )
        neu = _rows(res)[0]
        log.info(
            "partner_korrektur",
            affiliate_id=affiliate_id,
            betrag=req.amount,
            currency=req.currency,
            by=admin.user_id,
        )
        basis = self._provision(neu, self._kunden_labels(affiliate_id))
        return BackofficeProvision(
            **basis.model_dump(),
            tenant_id=neu["tenant_id"],
            stripe_invoice_id=None,
            reason=neu.get("reason"),
        )

    def bo_rang_setzen(
        self, affiliate_id: str, req: BackofficeRangSetzen, admin: PlatformContext
    ) -> BackofficePartner:
        row = self._bo_row(affiliate_id)
        tier = self._tier(req.tier_id)
        jetzt = datetime.now(UTC).isoformat()
        self._db.table("affiliate_tier_history").update({"valid_to": jetzt}).eq(
            "affiliate_id", affiliate_id
        ).is_("valid_to", "null").execute()
        self._db.table("affiliate_tier_history").insert(
            {
                "affiliate_id": affiliate_id,
                "tier_id": tier["id"],
                "paying_customers": self.zahlende_kunden(affiliate_id),
                "trigger_kind": "manual",
                "changed_by": admin.user_id,
                "note": req.note,
            }
        ).execute()
        self._db.table("affiliates").update(
            {"current_tier_id": tier["id"], "tier_below_since": None}
        ).eq("id", affiliate_id).execute()
        if Decimal(str(tier["rate"])) > Decimal(str(self._tier(row["current_tier_id"])["rate"])):
            self._mails.rang_erreicht(
                email=row["email"],
                name=row["full_name"],
                sprache=row.get("language") or "en",
                rang=tier["name"],
                satz_prozent=f"{(Decimal(str(tier['rate'])) * 100).normalize():f}",
            )
        log.info(
            "partner_rang_manuell", affiliate_id=affiliate_id, tier=tier["id"], by=admin.user_id
        )
        return self._bo_partner(self._bo_row(affiliate_id))

    # --- Werbematerial (affiliate_assets) — Pflege im Backoffice ------------

    def bo_material_liste(self) -> list[BackofficeMaterial]:
        rows = fetch_all_rows(
            self._db.table("affiliate_assets").select("*").order("sort").order("created_at")
        )
        return [self._material(r) for r in rows]

    def bo_material_anlegen(
        self, req: BackofficeMaterialAnlegen, admin: PlatformContext
    ) -> BackofficeMaterial:
        res = self._db.table("affiliate_assets").insert(req.model_dump()).execute()
        row = (res.data or [None])[0]
        if not row:
            raise AffiliateError("Material konnte nicht angelegt werden.", status_code=500)
        log.info("partner_material_angelegt", asset_id=row["id"], kind=req.kind, by=admin.user_id)
        return self._material(row)

    def bo_material_aendern(
        self, asset_id: str, req: BackofficeMaterialAendern, admin: PlatformContext
    ) -> BackofficeMaterial:
        alt = self._material_row(asset_id)
        daten = req.model_dump(exclude_unset=True)
        if not daten:
            return self._material(alt)
        neu = {**alt, **daten}
        # Dieselbe Vollständigkeitsregel wie beim Anlegen — sonst ließe sich
        # per PATCH die Adresse eines Links leeren.
        if neu["kind"] == "text" and not (neu.get("body") or "").strip():
            raise AffiliateError("Ein Textbaustein braucht einen Text.", status_code=422)
        if neu["kind"] != "text" and not neu.get("url"):
            raise AffiliateError("Video, Bild und Link brauchen eine Adresse.", status_code=422)
        self._db.table("affiliate_assets").update(daten).eq("id", asset_id).execute()
        log.info(
            "partner_material_geaendert", asset_id=asset_id, felder=sorted(daten), by=admin.user_id
        )
        return self._material(self._material_row(asset_id))

    def bo_material_loeschen(self, asset_id: str, admin: PlatformContext) -> None:
        self._material_row(asset_id)
        self._db.table("affiliate_assets").delete().eq("id", asset_id).execute()
        log.info("partner_material_geloescht", asset_id=asset_id, by=admin.user_id)

    def _material_row(self, asset_id: str) -> dict[str, Any]:
        res = self._db.table("affiliate_assets").select("*").eq("id", asset_id).limit(1).execute()
        row = (res.data or [None])[0]
        if not row:
            raise AffiliateError("Material nicht gefunden.", status_code=404)
        return row

    @staticmethod
    def _material(r: dict[str, Any]) -> BackofficeMaterial:
        return BackofficeMaterial(
            id=r["id"],
            kind=r["kind"],
            title=r["title"],
            description=r.get("description"),
            language=r.get("language"),
            url=r.get("url"),
            body=r.get("body"),
            sort=int(r.get("sort") or 0),
            active=bool(r.get("active", True)),
            created_at=str(r.get("created_at") or ""),
        )

    # --- Klick-Token für die Marketing-Weiterleitung -------------------------

    @staticmethod
    def klick_token() -> str:
        return secrets.token_urlsafe(18)
