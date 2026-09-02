"""Provision aus bezahlten Abo-Rechnungen — und ihre Gegenbuchung.

AUSLÖSER ist `invoice.paid` (nicht `invoice.payment_succeeded`: das feuert bei
`paid_out_of_band` nicht). Der Handler läuft im try des Webhook-Dispatchers:
ein Fehler hier gibt den Event-Claim frei, Stripe liefert erneut, und die
UNIQUE-Indizes aus 0517 (Rechnung, Event) machen den zweiten Lauf unschädlich.

BASIS ist der Nettobetrag der ABO-POSITIONEN der Rechnung: Positionen mit
`parent.type = subscription_item_details` (Grundtarif, Module, Prorations),
abzüglich Rabatte und inklusiver Steuern. NICHT dabei: die OTA-Provision und
das Modul „Dynamische Preise" (beides `invoice_items`, die der Monatslauf auf
DIESELBE Rechnung setzt), Zusatzleistungen, Nachberechnungen. Hostaway rechnet
genauso („Net Revenue ohne Add-ons/Steuern/Refunds").

SATZ UND RANG kommen zum Buchungszeitpunkt aus `affiliates.current_tier_id` →
`affiliate_tiers.rate` und werden an die Zeile geschrieben — eine spätere
Änderung der Staffel interpretiert alte Zeilen nicht neu (Wurzel 4).

ZEIT (Wurzel 5b): Zahlungszeitpunkt ist Stripes `status_transitions.paid_at`,
nicht unsere Uhr. Die zwölf Monate laufen ab der ERSTEN bezahlten Rechnung
des Betriebs; Rechnungen, deren Periode danach beginnt, tragen keine
Provision mehr.

MASTER-STRATEGIE (0525): Zur Ertragszeile entstehen KINDER mit `parent_id`:
  * `override`  — Team-Provision des Sponsors = DIFFERENZ seines Satzes zum
                  Satz des Team-Partners (beide zum Rechnungszeitpunkt);
                  gleicher Rang → 0 → keine Zeile.
  * `lifetime`  — Superprovision (affiliate_tiers.lifetime_rate, 2,5 % ab
                  Elite) für den Partner selbst UND für seinen Sponsor, ohne
                  12-Monats-Grenze — sie entsteht auch, wenn der Ertrag wegen
                  Laufzeitende NICHT mehr entsteht (dann ohne parent_id, mit
                  stripe_invoice_id als Backstop).
  * `booking_share` — Markt-Turbo: 0,5 % (affiliate_program_rates) je bezahlter
                  myBestDays-Buchung eines geworbenen Betriebs, für Partner UND
                  Sponsor je eine Zeile; Auslöser ist `payment_intent.succeeded`,
                  nicht die Abo-Rechnung.
Die Gegenbuchung folgt IMMER dem Elternteil (Wurzel 1): wird der Ertrag
zurückgenommen, gehen override und lifetime anteilig mit.

GEGENBUCHUNG: Erstattung (`charge.refunded`), Gutschrift (`credit_note.created`)
und verlorener Chargeback erzeugen eine NEGATIVE Zeile mit `parent_id` auf
den Ertrag — der Ertrag selbst wird nie überschrieben. Ist er schon
ausgezahlt, verrechnet die Gegenzeile die nächste Auszahlung (kein Rückholen
vom Konto, dasselbe Modell wie `payouts`).
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError

from src.core.logging import get_logger

if TYPE_CHECKING:
    from supabase import Client

    from .mails import PartnerMails

log = get_logger("nextdays.affiliates.provision")

# Erstattungsfenster: so lange bleibt eine Ertragszeile `pending`, danach ist
# sie `approved` und auszahlbar (Rewardful: 30 Tage; FirstPromoter NET-30).
KARENZ_TAGE = 30
# Provisionsdauer je geworbenem Betrieb (Lodgify/Hostaway/Uplisting: 12 Monate).
LAUFZEIT_MONATE = 12

_UNIQUE_VIOLATION = "23505"
_CENT = Decimal("0.01")


def _field(obj: Any, key: str, default: Any = None) -> Any:  # noqa: ANN401
    """Feld aus StripeObject ODER Dict (Tests) lesen — wie payments.webhook."""
    if isinstance(obj, Mapping):
        return obj.get(key, default)
    try:
        return obj[key]
    except (KeyError, AttributeError, TypeError):
        return default


def _ts(wert: Any) -> datetime | None:  # noqa: ANN401
    if isinstance(wert, (int, float)) and wert > 0:
        return datetime.fromtimestamp(int(wert), tz=UTC)
    return None


def _dt(wert: Any) -> datetime | None:  # noqa: ANN401
    """ISO-Zeichenkette aus der DB → aware datetime."""
    if isinstance(wert, datetime):
        return wert if wert.tzinfo else wert.replace(tzinfo=UTC)
    if isinstance(wert, str) and wert:
        return datetime.fromisoformat(wert.replace("Z", "+00:00"))
    return None


def plus_monate(start: datetime, monate: int) -> datetime:
    """Kalendermonate addieren; ein 31. wird auf den letzten Tag des Zielmonats
    gekappt (31.01. + 1 Monat = 28./29.02.)."""
    monat0 = start.month - 1 + monate
    jahr = start.year + monat0 // 12
    monat = monat0 % 12 + 1
    # Letzter Tag des Zielmonats.
    if monat == 12:
        letzter = 31
    else:
        letzter = (datetime(jahr, monat + 1, 1, tzinfo=UTC) - timedelta(days=1)).day
    return start.replace(year=jahr, month=monat, day=min(start.day, letzter))


def _geld(cents: int) -> Decimal:
    return (Decimal(cents) / 100).quantize(_CENT, rounding=ROUND_HALF_UP)


def ist_abo_position(line: Any) -> bool:  # noqa: ANN401
    """Abo-Position (Grundtarif/Modul/Proration) vs. Einzelposten (OTA-Provision,
    Dyn. Preise, Zusatzleistung). API ≥ basil: `parent.type`; davor `type`."""
    parent = _field(line, "parent")
    if parent:
        return _field(parent, "type") == "subscription_item_details"
    return _field(line, "type") == "subscription"


def abo_basis_cents(lines: list[Any]) -> int:
    """Netto der Abo-Positionen in Cent: Betrag − Rabatte − inklusive Steuern."""
    summe = 0
    for line in lines:
        if not ist_abo_position(line):
            continue
        betrag = int(_field(line, "amount", 0) or 0)
        rabatte = sum(
            int(_field(d, "amount", 0) or 0) for d in (_field(line, "discount_amounts") or [])
        )
        steuern = _field(line, "taxes") or _field(line, "tax_amounts") or []
        inklusiv = 0
        for t in steuern:
            if _field(t, "inclusive") is True or _field(t, "tax_behavior") == "inclusive":
                inklusiv += int(_field(t, "amount", 0) or 0)
        summe += betrag - rabatte - inklusiv
    return max(summe, 0)


def _positionen(
    invoice: Any,  # noqa: ANN401
    lines_loader: Callable[[str], list[Any]] | None,
) -> list[Any]:
    """Alle Positionen der Rechnung. Das Event trägt die ersten zehn; bei
    `has_more` werden die übrigen nachgeladen — sonst fehlte bei einem Betrieb
    mit vielen Modulen ein Teil der Basis, ohne dass es jemand sähe."""
    lines = _field(invoice, "lines") or {}
    daten = list(_field(lines, "data") or [])
    if _field(lines, "has_more") and lines_loader is not None:
        return lines_loader(str(_field(invoice, "id")))
    return daten


def _stripe_lines_loader(invoice_id: str) -> list[Any]:
    from src.features.payments import stripe_client as sc  # noqa: PLC0415

    client = sc.get_stripe()
    seite = client.v1.invoices.line_items.list(invoice_id, params={"limit": 100})
    alle: list[Any] = list(_field(seite, "data") or [])
    while _field(seite, "has_more"):
        letzte = _field(alle[-1], "id")
        seite = client.v1.invoices.line_items.list(
            invoice_id, params={"limit": 100, "starting_after": letzte}
        )
        alle.extend(_field(seite, "data") or [])
    return alle


def _zahlungsreferenzen(invoice: Any) -> tuple[str | None, str | None]:  # noqa: ANN401
    """Charge- und PaymentIntent-ID der Rechnung — API ≥ basil unter
    `payments.data[].payment`, davor direkt an der Rechnung."""
    charge = _field(invoice, "charge")
    pi = _field(invoice, "payment_intent")
    zahlungen = _field(_field(invoice, "payments") or {}, "data") or []
    for z in zahlungen:
        p = _field(z, "payment") or {}
        charge = charge or _field(p, "charge")
        pi = pi or _field(p, "payment_intent")
    return (str(charge) if charge else None), (str(pi) if pi else None)


def _tenant_fuer_customer(db: Client, customer_id: str) -> str | None:
    rows = (
        db.table("tenant_subscription")
        .select("tenant_id")
        .eq("stripe_customer_id", customer_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0]["tenant_id"] if rows else None


def _referral_fuer_tenant(db: Client, tenant_id: str) -> dict[str, Any] | None:
    rows = (
        db.table("affiliate_referrals")
        .select("*")
        .eq("tenant_id", tenant_id)
        .in_("status", ["pending", "approved", "held"])
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def tier_laden(db: Client, tier_id: str) -> dict[str, Any] | None:
    rows = (db.table("affiliate_tiers").select("*").eq("id", tier_id).limit(1).execute()).data or []
    return rows[0] if rows else None


def _zuordnung_fuer_rechnung(
    db: Client,
    invoice: Any,  # noqa: ANN401
) -> tuple[str, dict[str, Any], dict[str, Any]] | None:
    """Betrieb, Zuordnung und Partner zu einer Rechnung — oder None, wenn die
    Rechnung niemanden betrifft (der Normalfall: die meisten Betriebe haben
    keinen Empfehler)."""
    customer_id = _field(invoice, "customer")
    if not customer_id:
        return None
    tenant_id = _tenant_fuer_customer(db, str(customer_id))
    if not tenant_id:
        return None
    referral = _referral_fuer_tenant(db, tenant_id)
    if referral is None:
        return None
    partner = (
        db.table("affiliates")
        .select("id, email, full_name, language, status, current_tier_id, sponsor_affiliate_id")
        .eq("id", referral["affiliate_id"])
        .limit(1)
        .execute()
    ).data or []
    if not partner:
        log.warning("partner_provision_partner_fehlt", referral=referral["id"])
        return None
    return tenant_id, referral, partner[0]


def verbuche_rechnung(
    db: Client,
    invoice: Any,  # noqa: ANN401
    *,
    event_id: str | None,
    lines_loader: Callable[[str], list[Any]] | None = _stripe_lines_loader,
    mails: PartnerMails | None = None,
) -> str:
    """`invoice.paid` → Ertragszeile. Gibt das Ergebnis als Wort zurück
    (Diagnose im Log/Backoffice): kein_partner | ausgelaufen | leer |
    duplikat | gebucht | gebucht_held."""
    kontext = _zuordnung_fuer_rechnung(db, invoice)
    if kontext is None:
        return "kein_partner"
    tenant_id, referral, p = kontext

    paid_at = _ts(_field(_field(invoice, "status_transitions") or {}, "paid_at")) or _ts(
        _field(invoice, "created")
    )
    if paid_at is None:
        # Ohne Zeitpunkt aus der Quelle keine Buchung mit erfundener Zeit (Wurzel 4/5b).
        log.error("partner_provision_ohne_zeitpunkt", invoice=_field(invoice, "id"))
        raise ValueError("Rechnung ohne Zahlungszeitpunkt.")
    period_start = _ts(_field(invoice, "period_start")) or paid_at

    basis_cents = abo_basis_cents(_positionen(invoice, lines_loader))
    currency = str(_field(invoice, "currency") or "").upper()
    if not currency:
        raise ValueError("Rechnung ohne Währung — keine Provision ohne Währung.")

    tier = tier_laden(db, p["current_tier_id"])
    if tier is None:
        raise ValueError(f"Rang {p['current_tier_id']!r} nicht in affiliate_tiers.")
    rate = Decimal(str(tier["rate"]))

    if basis_cents <= 0:
        # Eine Rechnung ohne Abo-Basis (nur Einzelposten, 100-%-Rabatt) ist
        # keine „erste zahlungspflichtige" Rechnung: sie startet die zwölf
        # Monate NICHT (Zettel: Laufzeit ab dem ersten zahlungspflichtigen Monat).
        log.info("partner_provision_leer", tenant_id=tenant_id, invoice=_field(invoice, "id"))
        return "leer"

    basis = _geld(basis_cents)
    # Angehalten, solange die Zuordnung geprüft wird oder der Partner nicht
    # (mehr) freigegeben ist — die Zeile entsteht trotzdem, sichtbar (Wurzel 5).
    status = "pending"
    if referral.get("status") == "held" or p.get("status") != "approved":
        status = "held"
    charge_id, pi_id = _zahlungsreferenzen(invoice)
    gemeinsam = {
        "referral_id": referral["id"],
        "tenant_id": tenant_id,
        "stripe_invoice_id": str(_field(invoice, "id")),
        "stripe_charge_id": charge_id,
        "stripe_payment_intent": pi_id,
        "currency": currency,
        "base_amount": str(basis),
        "status": status,
        "matures_at": (paid_at + timedelta(days=KARENZ_TAGE)).isoformat(),
        "period": paid_at.strftime("%Y-%m"),
    }

    bis = _dt(referral.get("commission_until"))
    if bis is not None and period_start >= bis:
        log.info(
            "partner_provision_ausgelaufen",
            tenant_id=tenant_id,
            invoice=_field(invoice, "id"),
            bis=bis.isoformat(),
        )
        # Die Superprovision kennt kein Laufzeitende — sie läuft weiter (0525).
        lifetime_buchen(db, gemeinsam, partner=p, parent_id=None)
        return "ausgelaufen"

    # Erste bezahlte Rechnung → Laufzeit starten (Gegenzustand: Zuordnung
    # pending → approved, sofern keine Flags sie halten).
    erste_zahlung = referral.get("first_paid_at") is None
    if erste_zahlung:
        update: dict[str, Any] = {
            "first_paid_at": paid_at.isoformat(),
            "commission_until": plus_monate(paid_at, LAUFZEIT_MONATE).isoformat(),
        }
        if referral.get("status") == "pending":
            update["status"] = "approved"
            referral["status"] = "approved"
        db.table("affiliate_referrals").update(update).eq("id", referral["id"]).execute()

    betrag = (basis * rate).quantize(_CENT, rounding=ROUND_HALF_UP)
    zeile = {
        **gemeinsam,
        "affiliate_id": p["id"],
        "kind": "earn",
        "stripe_event_id": event_id,
        "rate": str(rate),
        "tier_id": tier["id"],
        "amount": str(betrag),
    }
    try:
        res = db.table("affiliate_commissions").insert(zeile).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
            log.info("partner_provision_duplikat", invoice=_field(invoice, "id"))
            return "duplikat"
        raise
    earn = (res.data or [None])[0] or zeile
    if earn.get("id"):
        override_buchen(db, earn, partner=p, mails=mails)
        lifetime_buchen(db, gemeinsam, partner=p, parent_id=earn["id"])
    log.info(
        "partner_provision_gebucht",
        tenant_id=tenant_id,
        affiliate_id=p["id"],
        invoice=_field(invoice, "id"),
        basis=str(basis),
        rate=str(rate),
        betrag=str(betrag),
        currency=currency,
        status=status,
    )
    if erste_zahlung and mails is not None and status == "pending":
        try:
            nummer = (
                db.table("affiliate_referrals")
                .select("id", count="exact")
                .eq("affiliate_id", p["id"])
                .lte("created_at", referral.get("created_at") or paid_at.isoformat())
                .execute()
            ).count or 1
            mails.kunde_zahlt(
                email=p["email"],
                name=p.get("full_name") or "",
                sprache=p.get("language") or "en",
                kunde=f"#{nummer}",
                satz_prozent=f"{(rate * 100).normalize():f}",
            )
        except Exception as exc:  # noqa: BLE001 — Mail ist Nebenpfad der Buchung
            log.warning("partner_provision_mail_fehlgeschlagen", error=str(exc)[:200])
    return "gebucht" if status == "pending" else "gebucht_held"


# --- Superprovision (lifetime) ------------------------------------------------


def _lifetime_zeile(
    db: Client,
    gemeinsam: dict[str, Any],
    *,
    empfaenger: dict[str, Any],
    parent_id: str | None,
    grund: str,
) -> dict[str, Any] | None:
    tier = tier_laden(db, empfaenger["current_tier_id"])
    if tier is None:
        log.error("partner_lifetime_rang_fehlt", affiliate_id=empfaenger["id"])
        return None
    rate = Decimal(str(tier.get("lifetime_rate") or "0"))
    if rate <= 0:
        return None
    basis = Decimal(str(gemeinsam["base_amount"]))
    betrag = (basis * rate).quantize(_CENT, rounding=ROUND_HALF_UP)
    if betrag <= 0:
        return None
    status = gemeinsam["status"]
    if empfaenger.get("status") != "approved":
        status = "held"
    zeile = {
        **gemeinsam,
        "affiliate_id": empfaenger["id"],
        "kind": "lifetime",
        "parent_id": parent_id,
        "stripe_event_id": None,
        "rate": str(rate),
        "tier_id": tier["id"],
        "amount": str(betrag),
        "status": status,
        "reason": grund,
    }
    if parent_id is None:
        # Ohne Ertragszeile (Laufzeit vorbei) ist die Rechnung der Backstop:
        # eine lifetime-Zeile je Rechnung und Empfänger.
        vorhanden = (
            db.table("affiliate_commissions")
            .select("id")
            .eq("kind", "lifetime")
            .eq("affiliate_id", empfaenger["id"])
            .eq("stripe_invoice_id", gemeinsam["stripe_invoice_id"])
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            return None
    try:
        res = db.table("affiliate_commissions").insert(zeile).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
            log.info("partner_lifetime_duplikat", parent=parent_id, affiliate_id=empfaenger["id"])
            return None
        raise
    log.info(
        "partner_lifetime_gebucht",
        affiliate_id=empfaenger["id"],
        betrag=str(betrag),
        rate=str(rate),
        parent=parent_id,
        status=status,
    )
    return (res.data or [zeile])[0]


def lifetime_buchen(
    db: Client,
    gemeinsam: dict[str, Any],
    *,
    partner: dict[str, Any],
    parent_id: str | None,
) -> list[dict[str, Any]]:
    """Superprovision (0525) zu einer bezahlten Abo-Rechnung: für den Partner
    selbst (eigener Kunde) UND für seinen Sponsor (Team-Kunde), jeweils nur,
    wenn der Empfänger zum Rechnungszeitpunkt einen Rang mit `lifetime_rate`
    hält (Elite). Ohne Laufzeitgrenze — `parent_id` ist None, wenn die
    Ertragszeile wegen Laufzeitende nicht mehr entsteht."""
    zeilen: list[dict[str, Any]] = []
    eigene = _lifetime_zeile(
        db, gemeinsam, empfaenger=partner, parent_id=parent_id, grund="lifetime:own"
    )
    if eigene:
        zeilen.append(eigene)
    sponsor = _sponsor_laden(db, partner)
    if sponsor is not None:
        gehalten = dict(gemeinsam)
        if partner.get("sponsor_flags"):
            gehalten["status"] = "held"
        team = _lifetime_zeile(
            db,
            gehalten,
            empfaenger=sponsor,
            parent_id=parent_id,
            grund=f"team:{partner['id']}",
        )
        if team:
            zeilen.append(team)
    return zeilen


# --- Markt-Turbo (booking_share) -----------------------------------------------


def booking_share_rate(db: Client) -> Decimal:
    """Satz aus `affiliate_program_rates` — fehlt die Zeile, gibt es keinen
    Anteil (0), laut geloggt; nie ein erfundener Wert (Wurzel 4)."""
    rows = (
        db.table("affiliate_program_rates")
        .select("rate")
        .eq("key", "booking_share")
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        log.error("partner_booking_share_satz_fehlt", key="booking_share")
        return Decimal("0")
    return Decimal(str(rows[0]["rate"]))


def _booking_share_zeile(
    db: Client,
    basis_zeile: dict[str, Any],
    *,
    empfaenger: dict[str, Any],
    rate: Decimal,
    grund: str,
    held: bool,
) -> dict[str, Any] | None:
    tier = tier_laden(db, empfaenger["current_tier_id"])
    if tier is None:
        log.error("partner_booking_share_rang_fehlt", affiliate_id=empfaenger["id"])
        return None
    basis = Decimal(str(basis_zeile["base_amount"]))
    betrag = (basis * rate).quantize(_CENT, rounding=ROUND_HALF_UP)
    if betrag <= 0:
        return None
    zeile = {
        **basis_zeile,
        "affiliate_id": empfaenger["id"],
        "kind": "booking_share",
        "rate": str(rate),
        "tier_id": tier["id"],
        "amount": str(betrag),
        "status": "held" if held or empfaenger.get("status") != "approved" else "pending",
        "reason": grund,
    }
    try:
        res = db.table("affiliate_commissions").insert(zeile).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
            log.info(
                "partner_booking_share_duplikat",
                charge=basis_zeile.get("stripe_charge_id"),
                affiliate_id=empfaenger["id"],
            )
            return None
        raise
    log.info(
        "partner_booking_share_gebucht",
        affiliate_id=empfaenger["id"],
        betrag=str(betrag),
        currency=basis_zeile["currency"],
        charge=basis_zeile.get("stripe_charge_id"),
    )
    return (res.data or [zeile])[0]


def _partner_fuer_buchung(db: Client, tenant_id: str) -> dict[str, Any] | None:
    """Partner (mit `referral`) zu einem Betrieb — None, wenn niemand geworben
    hat oder die Zuordnung noch nicht bestätigt ist."""
    referral = _referral_fuer_tenant(db, tenant_id)
    if referral is None or referral.get("status") == "pending":
        return None
    rows = (
        db.table("affiliates")
        .select("id, status, current_tier_id, sponsor_affiliate_id, sponsor_flags")
        .eq("id", referral["affiliate_id"])
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return None
    return {**rows[0], "referral": referral}


def buchungsanteil_buchen(
    db: Client,
    *,
    tenant_id: str,
    charge_id: str | None,
    payment_intent: str | None,
    amount_cents: int,
    currency: str,
    paid_at: datetime,
    event_id: str | None,
) -> str:
    """Markt-Turbo (0525): eine bezahlte myBestDays-Buchung eines geworbenen
    Betriebs → je eine `booking_share`-Zeile für den Partner UND für dessen
    Sponsor, Basis = gezahlter Bruttobetrag in Buchungswährung. Keine
    Laufzeitgrenze (solange die Zuordnung besteht), Karenz wie alle Zeilen.
    Ergebniswort: kein_partner | leer | gebucht | duplikat."""
    if not charge_id:
        # Ohne Charge kein Backstop (UNIQUE) — lieber keine Zeile als eine
        # doppelte bei Redelivery (Wurzel 2).
        log.warning("partner_booking_share_ohne_charge", tenant_id=tenant_id)
        return "leer"
    p = _partner_fuer_buchung(db, tenant_id)
    if p is None:
        return "kein_partner"
    referral = p["referral"]
    rate = booking_share_rate(db) if amount_cents > 0 and currency else Decimal("0")
    if rate <= 0:
        return "leer"
    basis_zeile = {
        "referral_id": referral["id"],
        "tenant_id": tenant_id,
        "stripe_invoice_id": None,
        "stripe_event_id": None,
        "stripe_charge_id": charge_id,
        "stripe_payment_intent": payment_intent,
        "currency": currency.upper(),
        "base_amount": str(_geld(amount_cents)),
        "matures_at": (paid_at + timedelta(days=KARENZ_TAGE)).isoformat(),
        "period": paid_at.strftime("%Y-%m"),
    }
    held = referral.get("status") == "held"
    eigene = _booking_share_zeile(
        db, basis_zeile, empfaenger=p, rate=rate, grund="booking:own", held=held
    )
    sponsor = _sponsor_laden(db, p)
    team = None
    if sponsor is not None:
        team = _booking_share_zeile(
            db,
            basis_zeile,
            empfaenger=sponsor,
            rate=rate,
            grund=f"team:{p['id']}",
            held=held or bool(p.get("sponsor_flags")),
        )
    if eigene is None and team is None:
        return "duplikat"
    if event_id:
        log.info("partner_booking_share_event", event_id=event_id, tenant_id=tenant_id)
    return "gebucht"


def _booking_share_zeilen(db: Client, charge_id: str) -> list[dict[str, Any]]:
    return (
        db.table("affiliate_commissions")
        .select("*")
        .eq("kind", "booking_share")
        .eq("stripe_charge_id", charge_id)
        .execute()
    ).data or []


# --- Gegenbuchungen -----------------------------------------------------------


def _sponsor_laden(db: Client, partner: dict[str, Any]) -> dict[str, Any] | None:
    """Sponsor-Zeile des Partners; None ohne Team-Zuordnung."""
    sponsor_id = partner.get("sponsor_affiliate_id")
    if not sponsor_id:
        rows = (
            db.table("affiliates")
            .select("sponsor_affiliate_id, sponsor_flags")
            .eq("id", partner["id"])
            .limit(1)
            .execute()
        ).data or []
        if not rows or not rows[0].get("sponsor_affiliate_id"):
            return None
        partner["sponsor_affiliate_id"] = rows[0]["sponsor_affiliate_id"]
        partner["sponsor_flags"] = rows[0].get("sponsor_flags") or []
        sponsor_id = partner["sponsor_affiliate_id"]
    rows = (
        db.table("affiliates")
        .select("id, status, current_tier_id, email, full_name, language")
        .eq("id", sponsor_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def override_buchen(
    db: Client,
    earn: dict[str, Any],
    *,
    partner: dict[str, Any],
    mails: PartnerMails | None = None,
) -> dict[str, Any] | None:
    """Team-Provision (0520, Differenzmodell seit 0525): zur Ertragszeile eines
    Team-Partners die Override-Zeile seines Sponsors. Basis = base_amount der
    Ertragszeile, Satz = rate(Sponsor-Rang) − rate(Team-Partner, wie an der
    Ertragszeile). Gleicher Rang → Differenz 0 → keine Zeile; der Deckel von
    30 % ist damit von selbst eingehalten (Partner + Sponsor = Sponsor-Satz).
    `held`, wenn Sponsor oder Team-Partner nicht freigegeben sind oder die
    Team-Zuordnung Betrugsflags trägt. Idempotent über den Unique-Index
    (parent_id, override)."""
    sponsor = _sponsor_laden(db, partner)
    if sponsor is None:
        return None
    tier = tier_laden(db, sponsor["current_tier_id"])
    if tier is None:
        log.error("partner_override_rang_fehlt", sponsor=sponsor["id"])
        return None
    rate = max(Decimal(str(tier["rate"])) - Decimal(str(earn["rate"])), Decimal("0"))
    basis = Decimal(str(earn["base_amount"]))
    betrag = (basis * rate).quantize(_CENT, rounding=ROUND_HALF_UP)
    if betrag <= 0:
        return None
    status = "pending"
    if (
        sponsor.get("status") != "approved"
        or partner.get("status") != "approved"
        or partner.get("sponsor_flags")
        or earn.get("status") == "held"
    ):
        status = "held"
    zeile = {
        "referral_id": earn["referral_id"],
        "affiliate_id": sponsor["id"],
        "tenant_id": earn["tenant_id"],
        "kind": "override",
        "parent_id": earn["id"],
        "stripe_invoice_id": earn.get("stripe_invoice_id"),
        "stripe_event_id": None,
        "stripe_charge_id": earn.get("stripe_charge_id"),
        "stripe_payment_intent": earn.get("stripe_payment_intent"),
        "currency": earn["currency"],
        "base_amount": str(basis),
        "rate": str(rate),
        "tier_id": tier["id"],
        "amount": str(betrag),
        "status": status,
        "matures_at": earn.get("matures_at"),
        "period": earn.get("period"),
        "reason": f"team:{partner['id']}",
    }
    try:
        res = db.table("affiliate_commissions").insert(zeile).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
            log.info("partner_override_duplikat", earn=earn["id"])
            return None
        raise
    angelegt = (res.data or [zeile])[0]
    log.info(
        "partner_override_gebucht",
        sponsor=sponsor["id"],
        team_partner=partner["id"],
        earn=earn["id"],
        betrag=str(betrag),
        rate=str(rate),
        status=status,
    )
    if mails is not None and status == "pending":
        # Erste Team-Provision aus diesem Team-Partner → Mail an den Sponsor.
        try:
            vorher = (
                db.table("affiliate_commissions")
                .select("id", count="exact")
                .eq("affiliate_id", sponsor["id"])
                .eq("kind", "override")
                .like("reason", f"team:{partner['id']}")
                .execute()
            )
            if (vorher.count or 0) <= 1:
                mails.team_provision(
                    email=sponsor["email"],
                    name=sponsor["full_name"],
                    sprache=sponsor.get("language") or "en",
                    team_partner=partner.get("full_name") or "",
                    satz_prozent=f"{(rate * 100).normalize():f}",
                )
        except Exception as exc:  # noqa: BLE001 — Mail ist Nebenpfad
            log.warning("partner_override_mail_fehlgeschlagen", error=str(exc)[:200])
    return angelegt


def _kind_zeilen(db: Client, earn_id: str) -> list[dict[str, Any]]:
    """Alle Kinder einer Ertragszeile (override + lifetime) — sie folgen ihr
    bei Gegenbuchung und Chargeback (Wurzel 1)."""
    return (
        db.table("affiliate_commissions")
        .select("*")
        .in_("kind", ["override", "lifetime"])
        .eq("parent_id", earn_id)
        .execute()
    ).data or []


def _earn_zeile(db: Client, **filter_: str) -> dict[str, Any] | None:
    q = db.table("affiliate_commissions").select("*").eq("kind", "earn")
    for spalte, wert in filter_.items():
        q = q.eq(spalte, wert)
    rows = q.limit(1).execute().data or []
    return rows[0] if rows else None


def _bereits_gegengebucht(db: Client, earn_id: str) -> Decimal:
    rows = (
        db.table("affiliate_commissions")
        .select("amount")
        .eq("parent_id", earn_id)
        .eq("kind", "reversal")
        .execute()
    ).data or []
    return sum((Decimal(str(r["amount"])) for r in rows), Decimal("0"))


def gegenbuchen(
    db: Client,
    earn: dict[str, Any],
    *,
    anteil: Decimal,
    event_id: str | None,
    grund: str,
) -> Decimal:
    """Negative Zeile zum Ertrag anlegen; gibt den gebuchten Betrag (positiv)
    zurück, 0 wenn nichts mehr offen war. Idempotent über das Event."""
    ertrag = Decimal(str(earn["amount"]))
    offen = ertrag + _bereits_gegengebucht(db, earn["id"])  # Gegenzeilen sind negativ
    if offen <= 0:
        return Decimal("0")
    anteil = min(max(anteil, Decimal("0")), Decimal("1"))
    betrag = min(offen, (ertrag * anteil).quantize(_CENT, rounding=ROUND_HALF_UP))
    if betrag <= 0:
        return Decimal("0")
    zeile = {
        "referral_id": earn["referral_id"],
        "affiliate_id": earn["affiliate_id"],
        "tenant_id": earn["tenant_id"],
        "kind": "reversal",
        "parent_id": earn["id"],
        "stripe_invoice_id": earn.get("stripe_invoice_id"),
        "stripe_event_id": event_id,
        "stripe_charge_id": earn.get("stripe_charge_id"),
        "stripe_payment_intent": earn.get("stripe_payment_intent"),
        "currency": earn["currency"],
        "base_amount": "0.00",
        "rate": str(earn["rate"]),
        "tier_id": earn["tier_id"],
        "amount": str(-betrag),
        # Sofort wirksam: eine Erstattung wartet auf kein Fenster.
        "status": "approved",
        "period": earn.get("period"),
        "reason": grund,
    }
    try:
        db.table("affiliate_commissions").insert(zeile).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
            log.info("partner_gegenbuchung_duplikat", event_id=event_id)
            return Decimal("0")
        raise
    # Voll zurückgenommen und noch nicht ausgezahlt → der Ertrag ist erledigt.
    if betrag >= offen and earn.get("status") in ("pending", "approved", "held"):
        db.table("affiliate_commissions").update({"status": "reversed"}).eq(
            "id", earn["id"]
        ).execute()
    log.info(
        "partner_gegenbuchung",
        earn=earn["id"],
        betrag=str(betrag),
        currency=earn["currency"],
        grund=grund,
    )
    # Gegenzustand (Wurzel 1): Override und Superprovision folgen ihrer Ertragszeile.
    if earn.get("kind") == "earn":
        for kind_zeile in _kind_zeilen(db, earn["id"]):
            gegenbuchen(
                db,
                kind_zeile,
                anteil=anteil,
                event_id=(
                    f"{event_id}:{kind_zeile['kind']}:{kind_zeile['affiliate_id']}"
                    if event_id
                    else None
                ),
                grund=grund,
            )
    return betrag


def storniere_fuer_charge(db: Client, charge: Any, *, event_id: str | None) -> None:  # noqa: ANN401
    """`charge.refunded` → anteilige Gegenbuchung. Die Charge trägt seit API
    basil keine `invoice` mehr; der Ertrag wird über Charge-/PaymentIntent-ID
    gefunden, die beim Buchen gespeichert wurden."""
    charge_id = str(_field(charge, "id") or "")
    gesamt = int(_field(charge, "amount", 0) or 0)
    erstattet = int(_field(charge, "amount_refunded", 0) or 0)
    if gesamt <= 0 or erstattet <= 0:
        return
    anteil = Decimal(erstattet) / Decimal(gesamt)
    # Markt-Turbo (0525): Gast-Erstattung einer Marktplatz-Buchung nimmt den
    # Buchungsanteil von Partner UND Sponsor anteilig zurück.
    for share in _booking_share_zeilen(db, charge_id) if charge_id else []:
        gegenbuchen(
            db,
            share,
            anteil=anteil,
            event_id=f"{event_id}:share:{share['affiliate_id']}" if event_id else None,
            grund="refund",
        )
    earn = _earn_zeile(db, stripe_charge_id=charge_id) if charge_id else None
    if earn is None:
        pi = _field(charge, "payment_intent")
        earn = _earn_zeile(db, stripe_payment_intent=str(pi)) if pi else None
    if earn is None:
        return
    gegenbuchen(db, earn, anteil=anteil, event_id=event_id, grund="refund")


def storniere_fuer_gutschrift(
    db: Client,
    credit_note: Any,  # noqa: ANN401
    *,
    event_id: str | None,
    invoice_total_loader: Callable[[str], int] | None = None,
) -> None:
    """`credit_note.created` → Gegenbuchung im Verhältnis Gutschrift/Rechnung."""
    invoice_id = _field(credit_note, "invoice")
    if not invoice_id:
        return
    earn = _earn_zeile(db, stripe_invoice_id=str(invoice_id))
    if earn is None:
        return
    gutschrift = int(_field(credit_note, "total", 0) or _field(credit_note, "amount", 0) or 0)
    if gutschrift <= 0:
        return
    if invoice_total_loader is None:
        invoice_total_loader = _stripe_invoice_total
    gesamt = invoice_total_loader(str(invoice_id))
    if gesamt <= 0:
        log.warning("partner_gutschrift_ohne_rechnungssumme", invoice=invoice_id)
        return
    gegenbuchen(
        db,
        earn,
        anteil=Decimal(gutschrift) / Decimal(gesamt),
        event_id=event_id,
        grund="credit_note",
    )


def _stripe_invoice_total(invoice_id: str) -> int:
    from src.features.payments import stripe_client as sc  # noqa: PLC0415

    inv = sc.get_stripe().v1.invoices.retrieve(invoice_id)
    return int(_field(inv, "total", 0) or 0)


def chargeback_eroeffnet(db: Client, charge: Any) -> None:  # noqa: ANN401
    """`charge.dispute.created` → Ertrag anhalten (nicht auszahlen, solange offen)."""
    charge_id = _field(charge, "charge") or _field(charge, "id")
    if not charge_id:
        return
    for share in _booking_share_zeilen(db, str(charge_id)):
        if share.get("status") in ("pending", "approved"):
            db.table("affiliate_commissions").update(
                {"status": "held", "reason": "dispute_open"}
            ).eq("id", share["id"]).execute()
    earn = _earn_zeile(db, stripe_charge_id=str(charge_id))
    if earn is None or earn.get("status") not in ("pending", "approved"):
        return
    for kind_zeile in _kind_zeilen(db, earn["id"]):
        if kind_zeile.get("status") in ("pending", "approved"):
            db.table("affiliate_commissions").update(
                {"status": "held", "reason": "dispute_open"}
            ).eq("id", kind_zeile["id"]).execute()
    db.table("affiliate_commissions").update({"status": "held", "reason": "dispute_open"}).eq(
        "id", earn["id"]
    ).execute()
    log.info("partner_provision_chargeback_hold", earn=earn["id"])


def chargeback_entschieden(
    db: Client,
    dispute: Any,  # noqa: ANN401
    *,
    event_id: str | None,
) -> None:
    """`charge.dispute.closed`: verloren → volle Gegenbuchung; gewonnen → Hold auf."""
    charge_id = _field(dispute, "charge")
    if not charge_id:
        return
    ausgang = str(_field(dispute, "status") or "")
    gewonnen = ausgang in ("won", "warning_closed")
    for share in _booking_share_zeilen(db, str(charge_id)):
        if ausgang == "lost":
            gegenbuchen(
                db,
                share,
                anteil=Decimal("1"),
                event_id=f"{event_id}:share:{share['affiliate_id']}" if event_id else None,
                grund="dispute_lost",
            )
        elif gewonnen and share.get("reason") == "dispute_open":
            db.table("affiliate_commissions").update(
                {"status": "pending", "reason": "booking:own"}
            ).eq("id", share["id"]).execute()
    earn = _earn_zeile(db, stripe_charge_id=str(charge_id))
    if earn is None:
        return
    if ausgang == "lost":
        gegenbuchen(db, earn, anteil=Decimal("1"), event_id=event_id, grund="dispute_lost")
        return
    if gewonnen and earn.get("status") == "held" and (earn.get("reason") == "dispute_open"):
        db.table("affiliate_commissions").update({"status": "pending", "reason": None}).eq(
            "id", earn["id"]
        ).execute()
        for kind_zeile in _kind_zeilen(db, earn["id"]):
            if kind_zeile.get("reason") == "dispute_open":
                db.table("affiliate_commissions").update(
                    {"status": "pending", "reason": f"team:{earn['affiliate_id']}"}
                ).eq("id", kind_zeile["id"]).execute()
        log.info("partner_provision_chargeback_aufgehoben", earn=earn["id"])
