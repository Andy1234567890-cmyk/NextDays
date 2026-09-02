"""Verbundkonto (Stripe Connect) des Partners — einziger Auszahlungsweg (0522).

WAS HIER LEBT: Anlage des Connected Accounts, die eigene KYC-Erfassung
(Account-Update, Personen, Bank, ToS), der Status-Abgleich und der Transfer des
Auszahlungslaufs. Die Provisionsrechnung selbst steht unverändert in
`provision.py`, der Lauf in `auszahlung.py` — hier geht es ausschließlich um den
Geldweg zum Partner.

KONTOFORM (gemessen, nicht angenommen — Stripes Anforderungs-API für
Plattformland DK, 02.09.2026):
  * `type='custom'`, Dashboard `none` — voll white-label, wie bei den Betrieben
    (`payments/service.py`). Der Partner sieht nie ein Stripe-Dashboard.
  * `tos_acceptance.service_agreement='full'`. Der `recipient`-Weg existiert für
    eine dänische Plattform NICHT (alle 43 Kontoländer melden `tos_types=['full']`)
    und schlösse EWR-Überweisungen aus.
  * Capability NUR `transfers`. Der Partner nimmt keine Gästezahlungen an —
    `card_payments` anzufordern würde die KYC-Last ohne Nutzen erhöhen (MCC,
    Website-Anforderungen, Statement-Descriptor).

PFLICHTFELDER, die daraus folgen (DK-Plattform, EWR-Konto, `transfers`):
  * `individual`: Name, Geburtsdatum, Adresse, Nationalität, Telefon,
    `business_profile.url`, Bankkonto, ToS — 14 Felder.
  * `company`: zusätzlich Firmenname/-adresse, `company.tax_id`, ein
    vertretungsberechtigter Mensch (`representative`) sowie Geschäftsführer und
    wirtschaftlich Berechtigte — 39 Felder.
Die genaue Liste je Land holt `pflichtfelder()` LIVE aus Stripe
(`country_specs`), damit sich eine Änderung bei Stripe nicht als stiller
Fehlschlag zeigt (Wurzel 4: kein Hardcode).

WURZEL 2: `konto_anlegen` ist idempotent — ein zweiter Aufruf gibt das
vorhandene Konto zurück, statt ein zweites anzulegen (Doppelklick im Formular).
Der Transfer trägt einen `idempotency_key` MIT Betrag, damit ein Retry nach
geänderter Summe nicht still am alten Key hängen bleibt.

WURZEL 5: Stripe-Fehler werden spezifisch gefangen und als `AffiliateError` mit
passendem Status weitergereicht (4xx = Eingabefehler des Partners, sonst 502) —
nie als 500-Stacktrace und nie stumm verschluckt.
"""

from __future__ import annotations

import contextlib
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from stripe import StripeClient
from stripe import StripeError as _StripeError

from src.core.logging import get_logger
from src.features.payments.stripe_client import (
    StripeNotConfiguredError,
    get_stripe,
)

from .fehler import AffiliateError

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.affiliates.connect")

# Nur diese Capability. Siehe Modul-Docstring.
_CAPABILITIES = {"transfers": {"requested": True}}
# Branchencode 7311 = Werbedienstleistungen — was ein Partner tatsächlich tut.
# Ohne MCC bleibt ein Requirement offen und blockiert die Freischaltung.
_MCC = "7311"


@contextlib.contextmanager
def _stripe_fehler():  # noqa: ANN202
    """Stripe-SDK-Fehler → AffiliateError (Muster `payments._stripe_errors`).

    Stripes eigene `user_message` wird 1:1 durchgereicht: sie benennt den echten
    Grund („invalid postal code") besser als jeder Text, den wir erfinden
    könnten (Wurzel 4). 4xx = Daten-/Eingabefehler → durchreichen; alles andere
    ist ein Upstream-Problem → 502.
    """
    try:
        yield
    except _StripeError as exc:
        msg = getattr(exc, "user_message", None) or str(exc) or "Stripe-Fehler."
        http_status = getattr(exc, "http_status", None)
        code = 400 if isinstance(http_status, int) and 400 <= http_status < 500 else 502
        log.warning(
            "affiliate_stripe_fehler",
            status=http_status,
            param=getattr(exc, "param", None),
            fehler=msg[:300],
        )
        raise AffiliateError(msg, status_code=code) from exc


def _client(stripe: StripeClient | None = None) -> StripeClient:
    """StripeClient — injiziert (Test) oder aus der Config.

    Fehlt der Key, ist das ein BETRIEBSMANGEL, kein Nutzerfehler: 503 mit klarer
    Ansage, statt eines kryptischen Auth-Fehlers aus dem SDK (Wurzel 5).
    """
    if stripe is not None:
        return stripe
    try:
        return get_stripe()
    except StripeNotConfiguredError as exc:
        raise AffiliateError(
            "Stripe ist nicht konfiguriert — Auszahlungen sind nicht möglich.",
            status_code=503,
        ) from exc


def _partner(db: Client, affiliate_id: str) -> dict[str, Any]:
    rows = (
        db.table("affiliates")
        .select(
            "id, email, full_name, company, legal_form, country, language, status, "
            "stripe_account_id, stripe_payouts_enabled, stripe_details_submitted, "
            "stripe_requirements, stripe_disabled_reason"
        )
        .eq("id", affiliate_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise AffiliateError("Partner nicht gefunden.", status_code=404)
    return rows[0]


def _protokoll(
    db: Client,
    affiliate_id: str,
    event: str,
    *,
    stripe_id: str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    """Protokollzeile schreiben. Best-effort: ein Protokollfehler darf den
    Hauptpfad (Konto anlegen, Geld überweisen) nicht kippen."""
    try:
        db.table("affiliate_stripe_events").insert(
            {
                "affiliate_id": affiliate_id,
                "event": event,
                "stripe_id": stripe_id,
                "detail": detail or {},
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Protokoll ist Nebenpfad
        log.warning("affiliate_stripe_protokoll_fehlgeschlagen", error=str(exc)[:200])


# --- Konto anlegen und abgleichen --------------------------------------------


def konto_anlegen(
    db: Client, affiliate_id: str, *, stripe: StripeClient | None = None
) -> dict[str, Any]:
    """Legt den Connected Account an — oder gibt den vorhandenen zurück.

    Idempotent (Wurzel 2): Doppelklick im Formular oder ein Retry nach Timeout
    darf keinen zweiten Account erzeugen. Ein zweiter Account wäre besonders
    teuer, weil Geld an den falschen wandern könnte und ein Custom Account sich
    nicht löschen lässt, sobald er Guthaben trug.
    """
    p = _partner(db, affiliate_id)
    if p.get("stripe_account_id"):
        return status_abgleichen(db, affiliate_id, stripe=stripe)
    if p.get("status") != "approved":
        raise AffiliateError(
            "Das Verbundkonto steht erst nach der Freigabe zur Verfügung.",
            status_code=409,
        )
    land = (p.get("country") or "").upper()
    if not land:
        # Wurzel 4: kein Fantasie-Land. Ohne Land kann Stripe nicht anlegen.
        raise AffiliateError(
            "Für das Verbundkonto fehlt das Land im Profil.", status_code=422
        )
    art = "company" if p.get("legal_form") == "company" else "individual"
    sc = _client(stripe)
    with _stripe_fehler():
        account = sc.v1.accounts.create(
            params={
                "type": "custom",
                "country": land,
                "email": p["email"],
                "business_type": art,
                "business_profile": {"mcc": _MCC},
                "capabilities": _CAPABILITIES,
                "tos_acceptance": {"service_agreement": "full"},
                "metadata": {"affiliate_id": affiliate_id},
            }
        )
    db.table("affiliates").update(
        {"stripe_account_id": account.id, "payout_method": "stripe"}
    ).eq("id", affiliate_id).execute()
    _protokoll(db, affiliate_id, "account_created", stripe_id=account.id,
               detail={"country": land, "business_type": art})
    log.info(
        "affiliate_connect_konto_angelegt",
        affiliate_id=affiliate_id,
        account=account.id,
        land=land,
        art=art,
    )
    return status_abgleichen(db, affiliate_id, stripe=stripe)


def status_abgleichen(
    db: Client, affiliate_id: str, *, stripe: StripeClient | None = None
) -> dict[str, Any]:
    """Liest den Live-Stand bei Stripe und spiegelt ihn in `affiliates`.

    Der gespiegelte Stand ist das Gate des Auszahlungslaufs; er darf nicht
    veralten. Bisher schrieb ihn nur der Webhook — bleibt der aus (lokale
    Entwicklung, Zustellausfall), stünde ein altes `true`, obwohl Stripe den
    Account längst gesperrt hat, und der Lauf liefe gegen eine Wand. Deshalb
    schreibt auch jeder Statusabruf gegen (Muster `_mirror_account_flags`).
    """
    p = _partner(db, affiliate_id)
    konto = p.get("stripe_account_id")
    if not konto:
        return _stand(p, verbunden=False)
    sc = _client(stripe)
    with _stripe_fehler():
        account = sc.v1.accounts.retrieve(konto)
    return _uebernehmen(db, affiliate_id, account)


def _uebernehmen(db: Client, affiliate_id: str, account: Any) -> dict[str, Any]:  # noqa: ANN401
    """Stripe-Antwort in die Spiegel-Spalten schreiben und den Stand liefern."""
    reqs = getattr(account, "requirements", None)
    offen = sorted(set(list(getattr(reqs, "currently_due", None) or [])))
    payouts = bool(getattr(account, "payouts_enabled", False))
    felder = {
        "stripe_payouts_enabled": payouts,
        "stripe_details_submitted": bool(getattr(account, "details_submitted", False)),
        "stripe_requirements": offen,
        "stripe_disabled_reason": getattr(reqs, "disabled_reason", None),
        "stripe_synced_at": datetime.now(UTC).isoformat(),
    }
    vorher = (
        db.table("affiliates")
        .select("stripe_payouts_enabled")
        .eq("id", affiliate_id)
        .limit(1)
        .execute()
        .data
        or [{}]
    )
    db.table("affiliates").update(felder).eq("id", affiliate_id).execute()
    war = bool(vorher[0].get("stripe_payouts_enabled"))
    if war != payouts:
        # Der Wechsel ist das, was jemanden interessiert — nicht der Poll.
        _protokoll(
            db,
            affiliate_id,
            "payouts_enabled" if payouts else "payouts_disabled",
            stripe_id=getattr(account, "id", None),
            detail={"offen": offen, "grund": felder["stripe_disabled_reason"]},
        )
        log.info(
            "affiliate_connect_freischaltung_geaendert",
            affiliate_id=affiliate_id,
            payouts_enabled=payouts,
            offen=offen,
        )
    p = _partner(db, affiliate_id)
    return _stand(p, verbunden=True)


def _stand(p: dict[str, Any], *, verbunden: bool) -> dict[str, Any]:
    return {
        "verbunden": verbunden,
        "stripe_account_id": p.get("stripe_account_id"),
        "auszahlbar": bool(p.get("stripe_payouts_enabled")),
        "daten_vollstaendig": bool(p.get("stripe_details_submitted")),
        "offene_felder": list(p.get("stripe_requirements") or []),
        "gesperrt_grund": p.get("stripe_disabled_reason"),
    }


def pflichtfelder(land: str, art: str, *, stripe: StripeClient | None = None) -> dict[str, Any]:
    """Pflicht-/Zusatzfelder für dieses Land LIVE aus Stripe.

    Kein Hardcode (Wurzel 4): Stripe ändert Anforderungen, und eine gepflegte
    Liste im Code wäre irgendwann falsch, ohne dass es jemand merkt. Das
    Formular baut sich daraus auf.
    """
    if art not in ("individual", "company"):
        raise AffiliateError("Unbekannte Rechtsform.", status_code=422)
    sc = _client(stripe)
    with _stripe_fehler():
        spec = sc.v1.country_specs.retrieve(land.upper())
    vf = getattr(spec, "verification_fields", None) or {}
    block = vf.get(art) if isinstance(vf, dict) else getattr(vf, art, None)
    if block is None:
        return {"minimum": [], "zusaetzlich": []}
    hole = block.get if isinstance(block, dict) else lambda k: getattr(block, k, None)
    return {
        "minimum": list(hole("minimum") or []),
        "zusaetzlich": list(hole("additional") or []),
    }


# --- KYC-Erfassung ------------------------------------------------------------


def _konto_von(db: Client, affiliate_id: str) -> tuple[dict[str, Any], str]:
    p = _partner(db, affiliate_id)
    konto = p.get("stripe_account_id")
    if not konto:
        raise AffiliateError(
            "Es besteht noch kein Verbundkonto.", status_code=409
        )
    return p, str(konto)


def daten_senden(
    db: Client,
    affiliate_id: str,
    felder: dict[str, Any],
    *,
    stripe: StripeClient | None = None,
) -> dict[str, Any]:
    """Geschäfts-/Personendaten an den Account senden (eigene Onboarding-UI).

    `felder` ist das von der UI zusammengestellte Account-Update
    (business_profile, individual, company). Personen für company-Konten laufen
    NICHT hierüber, sondern über `person_setzen` — Stripe verlangt dafür die
    Persons-API.
    """
    _p, konto = _konto_von(db, affiliate_id)
    if not felder:
        raise AffiliateError("Keine Daten übergeben.", status_code=422)
    sc = _client(stripe)
    with _stripe_fehler():
        sc.v1.accounts.update(konto, params=felder)
    _protokoll(db, affiliate_id, "account_updated", stripe_id=konto,
               detail={"felder": sorted(felder)})
    return status_abgleichen(db, affiliate_id, stripe=stripe)


def person_setzen(
    db: Client,
    affiliate_id: str,
    person: dict[str, Any],
    *,
    stripe: StripeClient | None = None,
) -> dict[str, Any]:
    """Vertretungsberechtigte Person eines company-Kontos anlegen/aktualisieren.

    Stripe verlangt bei `business_type != individual` einen Menschen über die
    Persons-API; im Account-Update kann er nicht stecken. Idempotent (Wurzel 2):
    eine vorhandene representative-Person wird AKTUALISIERT, nicht dupliziert —
    sonst sammelt der Account bei jedem Speichern eine weitere Person, und
    Stripe fragt endlos nach.

    Danach die `*_provided`-Flags attestieren, damit Stripe nicht weiter
    directors/owners/executives anfordert. Deckt die Personalunion ab
    (Ein-Personen-Agentur); mehrere wirtschaftlich Berechtigte werden über
    zusätzliche Aufrufe mit eigenem `relationship` gesetzt.
    """
    p, konto = _konto_von(db, affiliate_id)
    if p.get("legal_form") != "company":
        raise AffiliateError(
            "Personen werden nur bei Unternehmen erfasst.", status_code=409
        )
    if not person:
        raise AffiliateError("Keine Personendaten übergeben.", status_code=422)
    sc = _client(stripe)
    with _stripe_fehler():
        vorhanden = sc.v1.accounts.persons.list(konto, params={"limit": 100})
        rep_id: str | None = None
        for eintrag in vorhanden.data:
            rel = getattr(eintrag, "relationship", None)
            if rel and getattr(rel, "representative", False):
                rep_id = eintrag.id
                break
        if rep_id:
            sc.v1.accounts.persons.update(konto, rep_id, params=person)
        else:
            sc.v1.accounts.persons.create(konto, params=person)
        sc.v1.accounts.update(
            konto,
            params={
                "company": {
                    "directors_provided": True,
                    "executives_provided": True,
                    "owners_provided": True,
                }
            },
        )
    _protokoll(db, affiliate_id, "person_set", stripe_id=konto)
    return status_abgleichen(db, affiliate_id, stripe=stripe)


def bank_setzen(
    db: Client,
    affiliate_id: str,
    *,
    iban: str,
    kontoinhaber: str,
    waehrung: str,
    stripe: StripeClient | None = None,
) -> dict[str, Any]:
    """Auszahlungskonto (IBAN) am Verbundkonto hinterlegen.

    Die Währung MUSS mitkommen und wird nicht aus dem Land geraten (Wurzel 4):
    ein dänischer Partner kann ein EUR-Konto führen, und ein falsch geratenes
    `currency` legt ein zweites externes Konto an, das Stripe nie bedient.
    """
    p, konto = _konto_von(db, affiliate_id)
    if not iban or not kontoinhaber:
        raise AffiliateError("IBAN und Kontoinhaber sind Pflicht.", status_code=422)
    if not waehrung:
        raise AffiliateError("Für das Bankkonto fehlt die Währung.", status_code=422)
    land = (p.get("country") or "").upper()
    sc = _client(stripe)
    with _stripe_fehler():
        sc.v1.accounts.update(
            konto,
            params={
                "external_account": {
                    "object": "bank_account",
                    "country": land,
                    "currency": waehrung.lower(),
                    "account_holder_name": kontoinhaber,
                    "account_number": iban,
                }
            },
        )
    # Die IBAN liegt ab hier bei Stripe, nicht bei uns. Wir behalten NUR einen
    # Fingerabdruck — er beantwortet die Betrugsfrage „gleiche Bankverbindung
    # wie der Sponsor?" (Team-Flag `same_iban`), ohne dass wir Bankdaten halten.
    # Ohne ihn wäre die Prüfung aus Etappe 5 nach der Umstellung still tot.
    from . import attribution  # noqa: PLC0415 — Zirkelbezug vermeiden

    details = dict(p.get("payout_details") or {})
    details.pop("iban", None)  # Klartext aus der Bestandszeile entfernen
    details["iban_fp"] = attribution.iban_fingerabdruck(iban)
    details["iban_ende"] = iban[-4:]
    db.table("affiliates").update({"payout_details": details}).eq(
        "id", affiliate_id
    ).execute()
    attribution.iban_flag_pruefen(db, affiliate_id=affiliate_id, iban=iban)

    _protokoll(db, affiliate_id, "bank_set", stripe_id=konto,
               detail={"currency": waehrung.upper(), "iban_ende": iban[-4:]})
    log.info("affiliate_connect_bank_gesetzt", affiliate_id=affiliate_id)
    return status_abgleichen(db, affiliate_id, stripe=stripe)


def bank_vorhanden(
    db: Client, affiliate_id: str, *, stripe: StripeClient | None = None
) -> bool:
    """True, wenn schon ein externes Konto hängt.

    Der Update-Pfad darf die IBAN nur senden, wenn noch KEINE existiert — sonst
    legt Stripe ein zweites externes Konto an (derselbe Fallstrick wie bei den
    Betrieben).
    """
    _p, konto = _konto_von(db, affiliate_id)
    sc = _client(stripe)
    with _stripe_fehler():
        account = sc.v1.accounts.retrieve(konto)
    ext = getattr(account, "external_accounts", None)
    daten = getattr(ext, "data", None) if ext is not None else None
    return bool(daten)


def bedingungen_annehmen(
    db: Client,
    affiliate_id: str,
    *,
    ip: str,
    zeitpunkt: int,
    stripe: StripeClient | None = None,
) -> dict[str, Any]:
    """Stripe-Services-Vereinbarung für den Account akzeptieren.

    `ip` und `zeitpunkt` müssen die ECHTE Nutzer-IP und der echte Zeitpunkt der
    Zustimmung sein — das ist der Compliance-Nachweis und wird nie geraten
    (Wurzel 5b: unsere Uhr ist nicht der Zeitpunkt einer fremden Handlung).
    """
    _p, konto = _konto_von(db, affiliate_id)
    if not ip:
        raise AffiliateError("IP für die Zustimmung fehlt.", status_code=422)
    sc = _client(stripe)
    with _stripe_fehler():
        sc.v1.accounts.update(
            konto, params={"tos_acceptance": {"date": zeitpunkt, "ip": ip}}
        )
    _protokoll(db, affiliate_id, "tos_accepted", stripe_id=konto,
               detail={"ip": ip, "date": zeitpunkt})
    stand = status_abgleichen(db, affiliate_id, stripe=stripe)
    # Sichtbar machen, dass die Zustimmung durchging, der Account aber trotzdem
    # gesperrt bleiben kann — sonst liest man nur „200 OK" und hält es für fertig.
    log.info(
        "affiliate_connect_tos",
        affiliate_id=affiliate_id,
        auszahlbar=stand["auszahlbar"],
        offen=stand["offene_felder"],
    )
    return stand


def identitaets_link(
    db: Client,
    affiliate_id: str,
    *,
    rueckkehr_url: str,
    erneut_url: str,
    stripe: StripeClient | None = None,
) -> str:
    """Gehostete Stripe-Strecke für das, was ein Formular NICHT einsammeln kann.

    GRUND (gemessen am 02.09.2026 gegen Stripes Anforderungs-API, Plattform DK):
    Auch eine Privatperson braucht `individual.verification.document` (Ausweis),
    `…additional_document` und `…proof_of_liveness`; ein Unternehmen zusätzlich
    Handelsregisterauszug und Nachweis der wirtschaftlich Berechtigten. Stripe
    dazu wörtlich: „We recommend using Stripe-hosted or embedded onboarding to
    satisfy all variations of the proof_of_liveness requirement." Ein
    Datei-Upload ginge zwar über die Files-API, der Lebendnachweis NICHT — er
    verlangt Stripes eigene Strecke (Dokument + Selfie).

    Deshalb die Arbeitsteilung: unser Formular sammelt alles Tippbare (Name,
    Anschrift, Geburtsdatum, Bank, Firmendaten) — der Partner bleibt für den
    Regelfall im myNextDays-Dashboard. Nur für Ausweis und Lebendnachweis wird
    er einmalig zu Stripe geschickt. Die Alternative wäre, den Partner mit
    einem dauerhaft gesperrten Konto stehen zu lassen: das Formular wäre
    vollständig ausgefüllt und die Auszahlung ginge trotzdem nie los — eine
    Attrappe (Wurzel 4).

    `collection_options.fields='currently_due'` holt genau das Offene, nicht das
    ganze Onboarding noch einmal.
    """
    _p, konto = _konto_von(db, affiliate_id)
    if not rueckkehr_url or not erneut_url:
        raise AffiliateError(
            "Für die Identitätsprüfung fehlen die Rücksprung-Adressen.",
            status_code=422,
        )
    sc = _client(stripe)
    with _stripe_fehler():
        link = sc.v1.account_links.create(
            params={
                "account": konto,
                "refresh_url": erneut_url,
                "return_url": rueckkehr_url,
                "type": "account_onboarding",
                "collection_options": {"fields": "currently_due"},
            }
        )
    _protokoll(db, affiliate_id, "identity_link", stripe_id=konto)
    log.info("affiliate_connect_identitaets_link", affiliate_id=affiliate_id)
    return str(link.url)


# --- Transfer (Auszahlungslauf) ----------------------------------------------


def transfer_ausloesen(
    db: Client,
    payout: dict[str, Any],
    *,
    stripe: StripeClient | None = None,
) -> str:
    """Überweist eine vorbereitete Auszahlung an das Verbundkonto des Partners.

    Idempotenz (Wurzel 2): der Key enthält Auszahlungs-Id UND Betrag. Nur die
    Id würde bei einer nachträglich geänderten Summe stumm den alten Transfer
    zurückgeben — Stripe antwortet auf denselben Key mit abweichenden
    Parametern mit HTTP 400, was als Fehlschlag sichtbar ist statt als falsch
    ausgezahlter Betrag.

    Der Betrag steht in der kleinsten Einheit. Alle zugelassenen Währungen des
    Programms sind zweistellig (EU27 + CHF/GBP), deshalb Faktor 100 — ein
    Zero-Decimal-Sonderfall (JPY) wäre toter Code.
    """
    konto = payout.get("stripe_account_id_ziel")
    if not konto:
        raise AffiliateError(
            "Der Partner hat kein Verbundkonto — Auszahlung nicht möglich.",
            status_code=409,
        )
    betrag = Decimal(str(payout["amount"]))
    if betrag <= 0:
        raise AffiliateError("Auszahlungsbetrag ist nicht positiv.", status_code=422)
    cents = int(betrag * 100)
    sc = _client(stripe)
    with _stripe_fehler():
        transfer = sc.v1.transfers.create(
            params={
                "amount": cents,
                "currency": payout["currency"].lower(),
                "destination": konto,
                "description": payout.get("statement_no") or str(payout["id"]),
                "metadata": {
                    "affiliate_id": str(payout["affiliate_id"]),
                    "payout_id": str(payout["id"]),
                    "statement_no": payout.get("statement_no") or "",
                },
            },
            options={"idempotency_key": f"aff_payout_{payout['id']}_{cents}"},
        )
    _protokoll(
        db,
        str(payout["affiliate_id"]),
        "transfer_created",
        stripe_id=transfer.id,
        detail={
            "payout_id": str(payout["id"]),
            "amount": str(betrag),
            "currency": payout["currency"],
        },
    )
    log.info(
        "affiliate_transfer_ausgeloest",
        affiliate_id=str(payout["affiliate_id"]),
        payout_id=str(payout["id"]),
        transfer=transfer.id,
        betrag=str(betrag),
        waehrung=payout["currency"],
    )
    return str(transfer.id)


def webhook_verarbeiten(db: Client, event: dict[str, Any]) -> str | None:
    """Connect-Webhook: Kontostand spiegeln, fehlgeschlagene Transfers melden.

    Gibt den Namen der ausgeführten Aktion zurück (für das Protokoll des
    Aufrufers) oder None, wenn das Ereignis hier nichts auslöst.
    """
    typ = str(event.get("type") or "")
    objekt = (event.get("data") or {}).get("object") or {}
    if typ == "account.updated":
        konto = str(objekt.get("id") or "")
        if not konto:
            return None
        rows = (
            db.table("affiliates")
            .select("id")
            .eq("stripe_account_id", konto)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            return None  # Betriebs-Account, nicht unserer
        _uebernehmen(db, rows[0]["id"], _Sicht(objekt))
        return "account_updated"
    if typ in ("transfer.failed", "transfer.reversed"):
        return _transfer_fehlgeschlagen(db, objekt, typ)
    return None


def _transfer_fehlgeschlagen(db: Client, objekt: dict[str, Any], typ: str) -> str | None:
    """Gegenzustand (Wurzel 1): Ein fehlgeschlagener Transfer muss die
    Auszahlung UND ihre Provisionszeilen wieder freigeben — sonst gilt Geld als
    ausgezahlt, das nie ankam."""
    transfer_id = str(objekt.get("id") or "")
    if not transfer_id:
        return None
    rows = (
        db.table("affiliate_payouts")
        .select("id, affiliate_id, status")
        .eq("stripe_transfer_id", transfer_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    payout = rows[0]
    db.table("affiliate_payouts").update(
        {"status": "failed", "failed_reason": f"stripe:{typ}"}
    ).eq("id", payout["id"]).execute()
    db.table("affiliate_commissions").update({"payout_id": None, "status": "approved"}).eq(
        "payout_id", payout["id"]
    ).execute()
    db.table("affiliate_payout_items").delete().eq("payout_id", payout["id"]).execute()
    _protokoll(
        db,
        str(payout["affiliate_id"]),
        "transfer_failed",
        stripe_id=transfer_id,
        detail={"payout_id": str(payout["id"]), "typ": typ},
    )
    log.error(
        "affiliate_transfer_fehlgeschlagen",
        payout_id=str(payout["id"]),
        transfer=transfer_id,
        typ=typ,
    )
    return "transfer_failed"


class _Sicht:
    """Dünne Attribut-Sicht auf ein Webhook-dict.

    `_uebernehmen` liest Attribute (SDK-Objekt); der Webhook liefert ein dict.
    StripeObject ist kein dict (und dict() darauf wirft) — deshalb hier eine
    eigene, offensichtliche Umhüllung statt einer Typprüfung an jeder Lesestelle.
    """

    def __init__(self, daten: dict[str, Any]) -> None:
        self._d = daten

    def __getattr__(self, name: str) -> Any:  # noqa: ANN401
        wert = self._d.get(name)
        return _Sicht(wert) if isinstance(wert, dict) else wert
