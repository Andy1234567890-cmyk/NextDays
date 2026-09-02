"""Attribution: Klick → Registrierung → Zuordnung eines Betriebs zu einem Partner.
DER WEG OHNE COOKIE. Der Partner-Link führt auf die Marketing-Seite
(`/p/CODE`), die den Klick hier meldet und den Besucher mit `?ref=CODE&klick=…`
weiterschickt. Der Code steht bis zur Registrierung sichtbar im Formular
(„Empfohlen von"), der Betrieb bestätigt ihn durch das Absenden. Ein
Tracking-Cookie fällt nach EDPB 2/2023 Rn. 49–51 unter Art. 5(3) ePrivacy und
bräuchte eine Einwilligung — der bestätigte Code im Formular nicht.

GENAU EIN PARTNER JE BETRIEB (Wurzel 2): UNIQUE (tenant_id) in 0517. Der
erste gewinnt; ein zweiter Code später wird geloggt, ändert aber nichts. Nur
das Backoffice hängt um (manual, mit Audit).

BETRUGSREGELN — deterministisch, nie stumm (Wurzel 5): Selbstwerbung (Partner
wirbt sein eigenes Konto) wird abgelehnt; gleiche E-Mail-Domain (außer
Freemailer) und Wegwerf-Adressen werden auf `held` gesetzt und benannt. Das
Backoffice entscheidet — es entsteht in jedem Fall eine Zeile mit Flags,
damit die Ablehnung nachvollziehbar ist.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError

from src.core.logging import get_logger, mask_email
from src.features.contact.spamnetz import ist_wegwerf_adresse

if TYPE_CHECKING:
    from supabase import Client

    from .mails import PartnerMails

log = get_logger("nextdays.affiliates.attribution")

# Anbieter, bei denen eine gleiche Domain NICHTS über Zusammengehörigkeit sagt.
FREEMAILER = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "outlook.com",
        "outlook.de",
        "hotmail.com",
        "hotmail.de",
        "live.com",
        "live.de",
        "yahoo.com",
        "yahoo.de",
        "icloud.com",
        "me.com",
        "gmx.de",
        "gmx.net",
        "gmx.at",
        "gmx.ch",
        "web.de",
        "t-online.de",
        "proton.me",
        "protonmail.com",
        "mail.com",
        "mail.de",
        "yandex.com",
        "freenet.de",
        "aol.com",
        "posteo.de",
        "tutanota.com",
        "mailbox.org",
    }
)

# Postgres: unique_violation.
_UNIQUE_VIOLATION = "23505"

# Alphabet für Wunsch-freie Codes: ohne 0/O und 1/I, damit sich der Code am
# Telefon durchsagen lässt.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def code_normalisieren(roh: str | None) -> str | None:
    """Eingabe eines Codes auf die gespeicherte Form bringen (Großbuchstaben,
    Leerraum weg). Ungültige Zeichen → None (kein Treffer, kein Fehler)."""
    if not roh:
        return None
    w = "".join(roh.split()).upper()
    erlaubt = set(_CODE_ALPHABET + "01IO-")
    if not w or w[0] == "-" or any(ch not in erlaubt for ch in w):
        return None
    if len(w) < 3 or len(w) > 31:
        return None
    return w


def code_vorschlag(name: str) -> str:
    """Startcode aus dem Vornamen + 4 Zufallszeichen, z. B. `ANNA-K7P2`."""
    vorname = "".join(ch for ch in (name.split() or [""])[0].upper() if ch.isalnum())
    vorname = vorname[:8] or "PARTNER"
    zufall = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(4))
    return f"{vorname}-{zufall}"


def _hash(wert: str | None) -> str | None:
    if not wert:
        return None
    return hashlib.sha256(wert.encode("utf-8")).hexdigest()


def _domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower() if "@" in email else ""


def code_laden(db: Client, code: str) -> dict[str, Any] | None:
    """Aktiver Code samt Partner — oder None."""
    rows = (
        db.table("affiliate_referral_codes")
        .select("id, code, affiliate_id, active")
        .eq("code", code)
        .eq("active", True)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def klick_erfassen(
    db: Client,
    *,
    code: str | None,
    ip: str | None,
    user_agent: str | None,
    referrer: str | None,
    utm: dict[str, str] | None,
    landing: str | None,
) -> dict[str, str] | None:
    """Einen Klick auf einen Partner-Link festhalten.

    Gibt `{"code", "click_token"}` zurück oder None, wenn der Code unbekannt
    oder inaktiv ist (dann leitet die Marketing-Seite ohne Parameter weiter —
    ein toter Link soll den Besucher nicht auf einer Fehlerseite lassen).
    IP und User-Agent werden NUR gehasht gespeichert.
    """
    norm = code_normalisieren(code)
    if norm is None:
        return None
    eintrag = code_laden(db, norm)
    if eintrag is None:
        log.info("partner_klick_unbekannter_code", code=norm)
        return None
    token = secrets.token_urlsafe(18)
    db.table("affiliate_clicks").insert(
        {
            "code_id": eintrag["id"],
            "affiliate_id": eintrag["affiliate_id"],
            "click_token": token,
            "ip_hash": _hash(ip),
            "ua_hash": _hash(user_agent),
            "referrer": (referrer or "")[:500] or None,
            "utm": {k: str(v)[:120] for k, v in (utm or {}).items() if k.startswith("utm_")},
            "landing": (landing or "")[:500] or None,
        }
    ).execute()
    return {"code": norm, "click_token": token}


def _flags_bestimmen(*, partner_email: str, tenant_email: str) -> tuple[list[str], str]:
    """Betrugsregeln → (Flags, Status). Selbstwerbung ist eine Ablehnung, die
    übrigen Treffer halten die Zuordnung zur Prüfung an."""
    flags: list[str] = []
    p, t = partner_email.lower().strip(), tenant_email.lower().strip()
    if p == t:
        return ["self_referral"], "rejected"
    dp, dt = _domain(p), _domain(t)
    if dp and dp == dt and dp not in FREEMAILER:
        flags.append("same_email_domain")
    if ist_wegwerf_adresse(t):
        flags.append("disposable_email")
    return flags, ("held" if flags else "pending")


# Schwellen der Verkehrsprüfung (Anweisung 02.09.2026, Betrugsprüfung).
KLICK_HAEUFUNG_24H = 20  # gleicher ip_hash ODER ua_hash auf einem Code in 24 h
REGISTRIERUNGS_BURST_24H = 5  # Registrierungen eines Partners in 24 h


def _verkehrs_flags(
    db: Client, *, partner_id: str, code_id: str, click_id: str | None
) -> list[str]:
    """Häufungen, die auf gekaufte oder gefälschte Reichweite deuten:
    viele Klicks vom selben Gerät/Netz auf den Code, viele Registrierungen in
    kurzer Zeit. Ein Treffer hält die Zuordnung (Backoffice prüft), er lehnt
    nicht ab — echte Kampagnen sehen manchmal ähnlich aus."""
    flags: list[str] = []
    seit = (datetime.now(UTC) - timedelta(hours=24)).isoformat()
    if click_id:
        klick = (
            db.table("affiliate_clicks")
            .select("ip_hash, ua_hash")
            .eq("id", click_id)
            .limit(1)
            .execute()
        ).data or []
        if klick:
            for feld in ("ip_hash", "ua_hash"):
                wert = klick[0].get(feld)
                if not wert:
                    continue
                res = (
                    db.table("affiliate_clicks")
                    .select("id", count="exact")
                    .eq("code_id", code_id)
                    .eq(feld, wert)
                    .gte("created_at", seit)
                    .limit(1)
                    .execute()
                )
                if (res.count or 0) >= KLICK_HAEUFUNG_24H:
                    flags.append("click_cluster")
                    break
    res = (
        db.table("affiliate_referrals")
        .select("id", count="exact")
        .eq("affiliate_id", partner_id)
        .gte("created_at", seit)
        .limit(1)
        .execute()
    )
    if (res.count or 0) >= REGISTRIERUNGS_BURST_24H:
        flags.append("registration_burst")
    return flags


# --- Team (0520): Sponsor-Zuordnung eines Bewerbers ----------------------------------


def sponsor_flags(*, sponsor: dict[str, Any], bewerber_email: str) -> list[str]:
    """Selbst-Referral zwischen Sponsor und Team-Partner: gleiche E-Mail-Domain
    (außer Freemailer). Die IBAN-Prüfung läuft später beim Eintragen der
    Auszahlungsdaten (`iban_flag_pruefen`), weil sie bei der Bewerbung noch fehlt."""
    flags: list[str] = []
    sd, bd = _domain(sponsor["email"]), _domain(bewerber_email)
    if sd == bd and bd not in FREEMAILER:
        flags.append("same_email_domain")
    return flags


def _sponsor_pruefen(
    db: Client, *, affiliate_id: str, sponsor_code: str | None
) -> dict[str, Any] | None:
    """Sponsor-Zeile zum Code, wenn er als Team-Führung taugt; sonst None (geloggt)."""
    norm = code_normalisieren(sponsor_code)
    if norm is None:
        return None
    eintrag = code_laden(db, norm)
    if eintrag is None:
        log.info("partner_sponsor_unbekannter_code", code=norm, affiliate_id=affiliate_id)
        return None
    rows = (
        db.table("affiliates")
        .select("id, email, full_name, language, status, sponsor_affiliate_id, current_tier_id")
        .eq("id", eintrag["affiliate_id"])
        .limit(1)
        .execute()
    ).data or []
    sponsor = rows[0] if rows else None
    grund = None
    if sponsor is None:
        grund = "partner_sponsor_fehlt"
    elif sponsor["id"] == affiliate_id:
        grund = "partner_sponsor_selbst"
    elif sponsor.get("status") != "approved":
        grund = "partner_sponsor_nicht_freigegeben"
    elif sponsor.get("sponsor_affiliate_id"):
        grund = "partner_sponsor_zweite_ebene_abgelehnt"
    elif not rang_darf_team_fuehren(db, sponsor.get("current_tier_id")):
        # Untervermittler erst ab Aufsteiger (affiliate_tiers.team_allowed, 0525).
        # Die Bewerbung bleibt gültig, nur ohne Team-Zuordnung.
        grund = "partner_sponsor_rang_zu_niedrig"
    if grund:
        log.info(grund, code=norm, affiliate_id=affiliate_id)
        return None
    return sponsor


def rang_darf_team_fuehren(db: Client, tier_id: str | None) -> bool:
    """`affiliate_tiers.team_allowed` des Rangs — fail-closed: unbekannter Rang
    oder fehlende Spalte heißt NEIN."""
    if not tier_id:
        return False
    rows = (
        db.table("affiliate_tiers").select("team_allowed").eq("id", tier_id).limit(1).execute()
    ).data or []
    return bool(rows and rows[0].get("team_allowed"))


def sponsor_zuordnen(
    db: Client,
    *,
    affiliate_id: str,
    bewerber_email: str,
    sponsor_code: str | None,
    mails: PartnerMails | None = None,
    bewerber_name: str = "",
) -> dict[str, Any] | None:
    """Bewerber an seinen Sponsor hängen — einmalig, aus dem sichtbar
    bestätigten Code der Bewerbung. Bedingungen: Sponsor freigegeben, Sponsor
    hat selbst keinen Sponsor (eine Ebene; der DB-Trigger sichert das
    zusätzlich), Sponsor ≠ Bewerber. Unbekannter Code → keine Zuordnung, die
    Bewerbung bleibt gültig. Gibt die Sponsor-Zeile zurück oder None."""
    sponsor = _sponsor_pruefen(db, affiliate_id=affiliate_id, sponsor_code=sponsor_code)
    if sponsor is None:
        return None
    flags = sponsor_flags(sponsor=sponsor, bewerber_email=bewerber_email)
    try:
        db.table("affiliates").update(
            {
                "sponsor_affiliate_id": sponsor["id"],
                "sponsor_joined_at": datetime.now(UTC).isoformat(),
                "sponsor_flags": flags,
            }
        ).eq("id", affiliate_id).is_("sponsor_affiliate_id", "null").execute()
    except APIError as exc:
        # Trigger „eine Ebene“ (check_violation) → keine Zuordnung, Bewerbung bleibt.
        log.warning("partner_sponsor_zuordnung_abgelehnt", error=str(exc)[:200])
        return None
    log.info(
        "partner_sponsor_zugeordnet", affiliate_id=affiliate_id, sponsor=sponsor["id"], flags=flags
    )
    if mails is not None:
        try:
            mails.team_neu(
                email=sponsor["email"],
                name=sponsor["full_name"],
                sprache=sponsor.get("language") or "en",
                team_partner=bewerber_name,
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad
            log.warning("partner_sponsor_mail_fehlgeschlagen", error=str(exc)[:200])
    return sponsor


def iban_fingerabdruck(iban: str) -> str:
    """Nicht umkehrbarer Fingerabdruck einer IBAN.

    Seit 0522 liegt die Bankverbindung bei Stripe, nicht bei uns — die
    Betrugsprüfung „gleiche IBAN bei Sponsor und Mitglied" braucht aber einen
    Vergleichswert. Gespeichert wird deshalb NUR dieser Hash: er beantwortet
    „dieselbe wie dort?", ohne dass wir die IBAN halten (Datenminimierung).

    Gesalzen mit einem festen Programm-Salz, damit ein Datenbankleser nicht per
    Wörterbuch aus einer bekannten IBAN den Hash nachbaut. Das Salz ist bewusst
    KEIN Secret aus der Umgebung: es muss über Jahre stabil bleiben, sonst
    vergleichen alte und neue Zeilen aneinander vorbei.
    """
    norm = "".join(iban.split()).upper()
    return hashlib.sha256(f"nextdays-affiliate-iban:{norm}".encode()).hexdigest()


def iban_flag_pruefen(db: Client, *, affiliate_id: str, iban: str) -> None:
    """Gleiche IBAN bei Sponsor und Team-Partner → Flag `same_iban` auf der
    Team-Zuordnung (des Mitglieds); künftige Overrides entstehen `held`.

    Verglichen wird über `payout_details.iban_fp` (Fingerabdruck, 0522). Alte
    Zeilen tragen noch die IBAN im Klartext unter `iban` — die werden
    mitverglichen, damit die Prüfung für Bestandspartner nicht still ausfällt.
    """
    rows = (
        db.table("affiliates")
        .select("id, sponsor_affiliate_id, sponsor_flags")
        .eq("id", affiliate_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return
    me = rows[0]
    kandidaten = [me["sponsor_affiliate_id"]] if me.get("sponsor_affiliate_id") else []
    mitglieder = (
        db.table("affiliates")
        .select("id, sponsor_flags")
        .eq("sponsor_affiliate_id", affiliate_id)
        .execute()
    ).data or []
    kandidaten += [m["id"] for m in mitglieder]
    if not kandidaten:
        return
    andere = (
        db.table("affiliates").select("id, payout_details").in_("id", kandidaten).execute()
    ).data or []
    norm = "".join(iban.split()).upper()
    fp = iban_fingerabdruck(iban)

    def _passt(zeile: dict[str, Any]) -> bool:
        details = zeile.get("payout_details") or {}
        if str(details.get("iban_fp") or "") == fp:
            return True
        # Bestandszeile mit Klartext-IBAN (vor 0522).
        alt_iban = "".join(str(details.get("iban") or "").split()).upper()
        return bool(alt_iban) and alt_iban == norm

    treffer = [a["id"] for a in andere if _passt(a)]
    if not treffer:
        return
    # Flag gehört an das MITGLIED der Beziehung (dort entstehen die Overrides).
    if me.get("sponsor_affiliate_id") in treffer:
        flags = sorted({*(me.get("sponsor_flags") or []), "same_iban"})
        db.table("affiliates").update({"sponsor_flags": flags}).eq("id", affiliate_id).execute()
    for m in mitglieder:
        if m["id"] in treffer:
            flags = sorted({*(m.get("sponsor_flags") or []), "same_iban"})
            db.table("affiliates").update({"sponsor_flags": flags}).eq("id", m["id"]).execute()
    log.warning("partner_same_iban", affiliate_id=affiliate_id, treffer=treffer)


def zuordnen(
    db: Client,
    *,
    tenant_id: str,
    tenant_email: str,
    code: str | None,
    click_token: str | None,
    contact_opt_in: bool,
    mails: PartnerMails | None = None,
) -> dict[str, Any] | None:
    """Einen frisch registrierten Betrieb seinem Partner zuordnen.

    Läuft im Registrierungspfad NACH Tenant + Nutzer. Fehlt der Code oder ist
    er unbekannt/inaktiv, passiert nichts — die Registrierung ist davon
    unabhängig. Gibt die angelegte Zuordnung zurück (oder None).
    """
    norm = code_normalisieren(code)
    if norm is None:
        return None
    eintrag = code_laden(db, norm)
    if eintrag is None:
        log.info("partner_zuordnung_unbekannter_code", code=norm, tenant_id=tenant_id)
        return None
    partner = (
        db.table("affiliates")
        .select("id, email, full_name, language, status")
        .eq("id", eintrag["affiliate_id"])
        .limit(1)
        .execute()
    ).data or []
    if not partner:
        log.warning("partner_zuordnung_partner_fehlt", code=norm)
        return None
    p = partner[0]
    if p.get("status") != "approved":
        # Ein Bewerber hat noch keinen gültigen Link — sein Code zählt nicht.
        log.info(
            "partner_zuordnung_partner_nicht_freigegeben",
            code=norm,
            status=p.get("status"),
            tenant_id=tenant_id,
        )
        return None

    click_id: str | None = None
    post_id: str | None = None
    method = "code"
    if click_token:
        klick = (
            db.table("affiliate_clicks")
            .select("id, code_id, utm")
            .eq("click_token", click_token)
            .limit(1)
            .execute()
        ).data or []
        if klick and klick[0].get("code_id") == eintrag["id"]:
            click_id = klick[0]["id"]
            method = "url"
            # Beitrag (0521) JETZT auflösen — die Klickzeile wird nach 90 Tagen
            # gelöscht, die Zuordnung soll ihren Beitrag behalten.
            from .beitraege import beitrag_aus_klick  # noqa: PLC0415

            post_id = beitrag_aus_klick(db, code_id=eintrag["id"], utm=klick[0].get("utm"))

    flags, status = _flags_bestimmen(partner_email=p["email"], tenant_email=tenant_email)
    if status != "rejected":
        weitere = _verkehrs_flags(db, partner_id=p["id"], code_id=eintrag["id"], click_id=click_id)
        if weitere:
            flags = [*flags, *weitere]
            status = "held"
    zeile = {
        "affiliate_id": p["id"],
        "tenant_id": tenant_id,
        "code_id": eintrag["id"],
        "click_id": click_id,
        "post_id": post_id,
        "method": method,
        "status": status,
        "flags": flags,
        "contact_opt_in": bool(contact_opt_in),
    }
    try:
        res = db.table("affiliate_referrals").insert(zeile).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
            # Der Betrieb hat schon einen Partner — der erste gewinnt.
            log.info("partner_zuordnung_bereits_vorhanden", tenant_id=tenant_id, code=norm)
            return None
        raise
    angelegt = (res.data or [zeile])[0]
    log.info(
        "partner_zuordnung_angelegt",
        tenant_id=tenant_id,
        affiliate_id=p["id"],
        method=method,
        status=status,
        flags=flags,
        tenant_email=mask_email(tenant_email),
    )
    if mails is not None and status != "rejected":
        # Best-effort (Wurzel 5): die Mail ist Nebenpfad der Registrierung.
        try:
            nummer = (
                db.table("affiliate_referrals")
                .select("id", count="exact")
                .eq("affiliate_id", p["id"])
                .execute()
            ).count or 1
            mails.neuer_kunde(
                email=p["email"],
                name=p.get("full_name") or "",
                sprache=p.get("language") or "en",
                kunde=f"#{nummer}",
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, darf die Registrierung nie kippen
            log.warning("partner_zuordnung_mail_fehlgeschlagen", error=str(exc)[:200])
    return angelegt
