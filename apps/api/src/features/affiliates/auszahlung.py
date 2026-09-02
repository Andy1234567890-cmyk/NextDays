"""Auszahlungslauf des Partnerprogramms — Stufe 1: Sammel-CSV + Gutschrift.

ABLAUF (Monatserster, Worker → `lauf_vorbereiten`):
  1. Alle `approved`-Zeilen ohne Auszahlung je (Partner, Währung) summieren —
     Erträge positiv, Gegenbuchungen negativ, Korrekturen mit Vorzeichen.
  2. Nur wenn der Partner freigegeben ist, einen Auszahlungsweg hat, als
     Unternehmen eine VIES-bestätigte USt-IdNr. trägt (fail-closed) und die
     Summe den Mindestbetrag DIESER WÄHRUNG erreicht (Daten aus
     `affiliate_payout_minimums`, kein Code-Wert): eine `affiliate_payouts`-
     Zeile `pending` anlegen, die Provisionszeilen daran hängen.
  3. Das Backoffice lädt die CSV (Wise-Batch / SEPA-Liste / PayPal-Payouts),
     überweist, und bestätigt mit der Referenz → `paid`, Zeilen `paid`, Mail
     mit Gutschriftsnummer an den Partner.
  Schlägt eine Überweisung fehl → `failed`, die Zeilen werden wieder frei.

KEINE UMRECHNUNG: je Währung eine Auszahlung. Ein negativer Saldo in einer
Währung wird vorgetragen, nie vom Konto eingezogen (Modell `payouts`).

GUTSCHRIFT (Self-Billing): Der Anbieter sitzt in Dänemark → das Dokument ist
ein „afregningsbilag" nach momsloven § 52a mit dem Vermerk „selvfakturering /
self-billing". Unternehmer mit EU-USt-IdNr.: Reverse Charge (Art. 196
MwStSystRL). Privatperson: ohne USt, Hinweis auf eigene Steuerpflicht. Die
Wortlaute stehen als Konstanten hier, bis der Steuerberater die Vorlage
freigibt — das ist im Plan als offener Punkt benannt.
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError

from src.core.config import Settings, get_settings
from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from . import connect
from .fehler import AffiliateError

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.affiliates.auszahlung")

_UNIQUE_VIOLATION = "23505"
STATEMENT_PREFIX = "PA"


class AuszahlungError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _d(wert: Any) -> Decimal:  # noqa: ANN401
    return Decimal(str(wert))


def _minimums(db: Client) -> dict[str, Decimal]:
    return {
        r["currency"].upper(): _d(r["minimum"])
        for r in fetch_all_rows(db.table("affiliate_payout_minimums").select("*"))
    }


def _offene_zeilen(db: Client) -> list[dict[str, Any]]:
    return fetch_all_rows(
        db.table("affiliate_commissions")
        .select("id, affiliate_id, currency, amount, created_at, kind, status, payout_id")
        .eq("status", "approved")
        .is_("payout_id", "null")
    )


def _naechste_nummer(db: Client, jahr: int) -> str:
    """Fortlaufende Gutschriftsnummer je Jahr (`PA-2026-00001`)."""
    res = (
        db.table("affiliate_payouts")
        .select("statement_no", count="exact")
        .like("statement_no", f"{STATEMENT_PREFIX}-{jahr}-%")
        .execute()
    )
    return f"{STATEMENT_PREFIX}-{jahr}-{(res.count or 0) + 1:05d}"


def lauf_vorbereiten(db: Client, *, jetzt: datetime | None = None) -> dict[str, int]:
    jetzt = jetzt or datetime.now(UTC)
    minimums = _minimums(db)
    zeilen = _offene_zeilen(db)
    gruppen: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for z in zeilen:
        gruppen[(z["affiliate_id"], z["currency"].upper())].append(z)
    partner_ids = sorted({a for a, _ in gruppen})
    partner: dict[str, dict[str, Any]] = {}
    for i in range(0, len(partner_ids), 200):
        for p in fetch_all_rows(
            db.table("affiliates")
            .select(
                "id, status, legal_form, vat_id_verified_at, payout_method, "
                "email, full_name, language, stripe_account_id, "
                "stripe_payouts_enabled"
            )
            .in_("id", partner_ids[i : i + 200])
        ):
            partner[p["id"]] = p
    bilanz = {"gruppen": len(gruppen), "angelegt": 0, "unter_minimum": 0, "gesperrt": 0}
    for (aff_id, waehrung), posten in gruppen.items():
        p = partner.get(aff_id)
        grund = _sperrgrund(p, waehrung, minimums)
        if grund:
            bilanz["gesperrt"] += 1
            log.info(
                "partner_auszahlung_uebersprungen",
                affiliate_id=aff_id,
                currency=waehrung,
                grund=grund,
            )
            continue
        summe = sum((_d(z["amount"]) for z in posten), Decimal("0"))
        if summe < minimums[waehrung] or summe <= 0:
            bilanz["unter_minimum"] += 1
            continue
        if _anlegen(db, p, waehrung, posten, summe, jetzt):
            bilanz["angelegt"] += 1
    log.info("partner_auszahlungslauf", **bilanz)
    return bilanz


def _sperrgrund(
    p: dict[str, Any] | None, waehrung: str, minimums: dict[str, Decimal]
) -> str | None:
    if p is None or p.get("status") != "approved":
        return "partner_nicht_freigegeben"
    # Ab 0522 ist das Verbundkonto der EINZIGE Weg. Ohne freigeschaltetes Konto
    # wird nichts angelegt — und der Grund steht sichtbar im Dashboard des
    # Partners und im Backoffice, statt dass die Zeile still liegen bleibt.
    if not p.get("stripe_account_id"):
        return "kein_verbundkonto"
    if not p.get("stripe_payouts_enabled"):
        return "verbundkonto_nicht_freigeschaltet"
    if p.get("legal_form") == "company" and not p.get("vat_id_verified_at"):
        return "ust_id_nicht_bestaetigt"
    if waehrung not in minimums:
        log.error(
            "partner_auszahlung_minimum_fehlt",
            currency=waehrung,
            hinweis="affiliate_payout_minimums um diese Währung ergänzen.",
        )
        return "minimum_unbekannt"
    return None


def _anlegen(
    db: Client,
    p: dict[str, Any],
    waehrung: str,
    posten: list[dict[str, Any]],
    summe: Decimal,
    jetzt: datetime,
) -> bool:
    daten = sorted(str(z["created_at"])[:10] for z in posten)
    payout_id: str | None = None
    for _ in range(3):
        nummer = _naechste_nummer(db, jetzt.year)
        try:
            res = (
                db.table("affiliate_payouts")
                .insert(
                    {
                        "affiliate_id": p["id"],
                        "currency": waehrung,
                        "amount": f"{summe:.2f}",
                        # Ab 0522 immer 'stripe'. Der alte payout_method-Wert
                        # eines Bestandspartners darf hier NICHT mehr landen —
                        # er beschriebe einen Weg, den der Lauf nicht mehr geht.
                        "method": "stripe",
                        "status": "pending",
                        "period_from": daten[0],
                        "period_to": daten[-1],
                        "statement_no": nummer,
                    }
                )
                .execute()
            )
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
                continue  # Nummer parallel vergeben → nächste
            raise
        payout_id = (res.data or [{}])[0].get("id")
        break
    if not payout_id:
        log.error("partner_auszahlung_nummer_kollision", affiliate_id=p["id"])
        return False
    db.table("affiliate_payout_items").insert(
        [{"payout_id": payout_id, "commission_id": z["id"]} for z in posten]
    ).execute()
    db.table("affiliate_commissions").update({"payout_id": payout_id}).in_(
        "id", [z["id"] for z in posten]
    ).execute()
    log.info(
        "partner_auszahlung_angelegt",
        affiliate_id=p["id"],
        payout_id=payout_id,
        currency=waehrung,
        betrag=str(summe),
        posten=len(posten),
    )
    return True


# --- Backoffice-Aktionen ------------------------------------------------------


def _payout(db: Client, payout_id: str) -> dict[str, Any]:
    rows = (
        db.table("affiliate_payouts").select("*").eq("id", payout_id).limit(1).execute().data or []
    )
    if not rows:
        raise AuszahlungError("Auszahlung nicht gefunden.", status_code=404)
    return rows[0]


def _partner(db: Client, affiliate_id: str) -> dict[str, Any]:
    rows = db.table("affiliates").select("*").eq("id", affiliate_id).limit(1).execute().data or []
    if not rows:
        raise AuszahlungError("Partner nicht gefunden.", status_code=404)
    return rows[0]


def bestaetigen(
    db: Client,
    payout_id: str,
    *,
    external_ref: str,
    admin_id: str,
    mails: Any = None,  # noqa: ANN401
) -> dict[str, Any]:
    zahlung = _payout(db, payout_id)
    if zahlung["status"] not in ("pending", "processing"):
        raise AuszahlungError("Auszahlung ist nicht offen.", status_code=409)
    jetzt = datetime.now(UTC).isoformat()
    db.table("affiliate_payouts").update(
        {"status": "paid", "external_ref": external_ref, "paid_at": jetzt, "created_by": admin_id}
    ).eq("id", payout_id).execute()
    db.table("affiliate_commissions").update({"status": "paid"}).eq(
        "payout_id", payout_id
    ).execute()
    p = _partner(db, zahlung["affiliate_id"])
    if mails is not None:
        try:
            mails.auszahlung_erstellt(
                email=p["email"],
                name=p["full_name"],
                sprache=p.get("language") or "en",
                betrag=f"{_d(zahlung['amount']):.2f}",
                waehrung=zahlung["currency"],
                nummer=zahlung.get("statement_no") or "",
            )
        except Exception as exc:  # noqa: BLE001 — Mail ist Nebenpfad
            log.warning("partner_auszahlung_mail_fehlgeschlagen", error=str(exc)[:200])
    log.info("partner_auszahlung_bestaetigt", payout_id=payout_id, ref=external_ref, by=admin_id)
    return _payout(db, payout_id)


def ausfuehren(
    db: Client,
    payout_ids: list[str],
    *,
    admin_id: str,
    mails: Any = None,  # noqa: ANN401
    stripe: Any = None,  # noqa: ANN401 — injizierbar für Tests
) -> dict[str, Any]:
    """Löst für die ausgewählten Auszahlungen den Transfer aufs Verbundkonto aus.

    Ersetzt ab 0522 den Weg „CSV ziehen → bei der Bank hochladen → Referenz von
    Hand zurücktragen". Der Transfer geht sofort raus; `paid` wird erst gesetzt,
    wenn Stripe die Transfer-Id quittiert hat.

    WURZEL 2: Vor dem Transfer wird der Status auf `processing` geklemmt (nur
    von `pending` aus). Ein zweiter Klick findet dann keine `pending`-Zeile mehr
    und läuft ins Leere, statt ein zweites Mal Geld zu schicken. Zusätzlich hält
    der Idempotency-Key in `connect.transfer_ausloesen` den Doppelversand ab, und
    `affiliate_payouts.stripe_transfer_id` ist UNIQUE (Backstop in der DB).

    WURZEL 5: Ein Fehlschlag bei EINEM Partner darf die übrigen nicht mitreißen —
    jede Auszahlung wird einzeln gefangen, auf `failed` gesetzt (Gegenzustand:
    die Provisionszeilen werden wieder frei) und im Ergebnis benannt. Verschluckt
    wird nichts.
    """
    ergebnis: dict[str, Any] = {"bezahlt": 0, "fehlgeschlagen": 0, "fehler": []}
    for payout_id in payout_ids:
        zahlung = _payout(db, payout_id)
        if zahlung["status"] != "pending":
            ergebnis["fehler"].append(
                {"payout_id": payout_id, "grund": "nicht_offen"}
            )
            continue
        p = _partner(db, zahlung["affiliate_id"])
        # Claim-Guard: nur wer die Zeile von 'pending' auf 'processing' dreht,
        # darf überweisen (Wurzel 2 — vor dem Seiteneffekt, nicht danach).
        geklemmt = (
            db.table("affiliate_payouts")
            .update({"status": "processing"})
            .eq("id", payout_id)
            .eq("status", "pending")
            .execute()
        ).data
        if not geklemmt:
            ergebnis["fehler"].append(
                {"payout_id": payout_id, "grund": "parallel_bearbeitet"}
            )
            continue
        try:
            transfer_id = connect.transfer_ausloesen(
                db,
                {
                    "id": payout_id,
                    "affiliate_id": zahlung["affiliate_id"],
                    "amount": zahlung["amount"],
                    "currency": zahlung["currency"],
                    "statement_no": zahlung.get("statement_no"),
                    "stripe_account_id_ziel": p.get("stripe_account_id"),
                },
                stripe=stripe,
            )
        except AffiliateError as exc:
            fehlgeschlagen(db, payout_id, grund=exc.message[:500], admin_id=admin_id)
            ergebnis["fehlgeschlagen"] += 1
            ergebnis["fehler"].append({"payout_id": payout_id, "grund": exc.message[:200]})
            log.error(
                "partner_transfer_fehlgeschlagen",
                payout_id=payout_id,
                affiliate_id=zahlung["affiliate_id"],
                grund=exc.message[:200],
            )
            continue
        jetzt = datetime.now(UTC).isoformat()
        db.table("affiliate_payouts").update(
            {
                "status": "paid",
                "stripe_transfer_id": transfer_id,
                "external_ref": transfer_id,
                "paid_at": jetzt,
                "created_by": admin_id,
            }
        ).eq("id", payout_id).execute()
        db.table("affiliate_commissions").update({"status": "paid"}).eq(
            "payout_id", payout_id
        ).execute()
        ergebnis["bezahlt"] += 1
        if mails is not None:
            try:
                mails.auszahlung_erstellt(
                    email=p["email"],
                    name=p["full_name"],
                    sprache=p.get("language") or "en",
                    betrag=f"{_d(zahlung['amount']):.2f}",
                    waehrung=zahlung["currency"],
                    nummer=zahlung.get("statement_no") or "",
                )
            except Exception as exc:  # noqa: BLE001 — Mail ist Nebenpfad
                log.warning(
                    "partner_auszahlung_mail_fehlgeschlagen", error=str(exc)[:200]
                )
    log.info("partner_auszahlungen_ausgefuehrt", **{
        k: v for k, v in ergebnis.items() if k != "fehler"
    })
    return ergebnis


def fehlgeschlagen(db: Client, payout_id: str, *, grund: str, admin_id: str) -> dict[str, Any]:
    zahlung = _payout(db, payout_id)
    if zahlung["status"] == "paid":
        raise AuszahlungError(
            "Eine bezahlte Auszahlung kann nicht fehlschlagen — Korrekturzeile buchen.",
            status_code=409,
        )
    db.table("affiliate_payouts").update(
        {"status": "failed", "failed_reason": grund, "created_by": admin_id}
    ).eq("id", payout_id).execute()
    # Gegenzustand (Wurzel 1): die Zeilen werden wieder frei für den nächsten Lauf.
    db.table("affiliate_commissions").update({"payout_id": None}).eq(
        "payout_id", payout_id
    ).execute()
    db.table("affiliate_payout_items").delete().eq("payout_id", payout_id).execute()
    log.info("partner_auszahlung_fehlgeschlagen", payout_id=payout_id, grund=grund, by=admin_id)
    return _payout(db, payout_id)


def in_bearbeitung(db: Client, payout_ids: list[str]) -> None:
    if payout_ids:
        db.table("affiliate_payouts").update({"status": "processing"}).in_("id", payout_ids).eq(
            "status", "pending"
        ).execute()


# --- Exporte --------------------------------------------------------------------


def _details(p: dict[str, Any]) -> dict[str, str]:
    return {k: str(v) for k, v in (p.get("payout_details") or {}).items()}


def export_csv(db: Client, payout_ids: list[str], *, format_: str) -> str:
    """CSV für Wise-Batch, SEPA-Liste oder PayPal-Payouts.

    AUSSER DIENST seit 0522 — der Auszahlungsweg ist das Verbundkonto
    (`ausfuehren`). Keine Route ruft das mehr auf. Die Funktion bleibt stehen,
    weil Bestands-Auszahlungen mit `method` wise/sepa/paypal in der Historie
    liegen und im Zweifel (Rückfrage der Buchhaltung, Steuerprüfung) noch einmal
    als Liste gebraucht werden können. Nicht für neue Läufe verwenden.
    """
    if format_ not in ("wise", "sepa", "paypal"):
        raise AuszahlungError("Unbekanntes Format.", status_code=422)
    zahlungen = [
        z
        for z in fetch_all_rows(db.table("affiliate_payouts").select("*").in_("id", payout_ids))
        if z["method"] == format_
    ]
    partner = (
        {
            p["id"]: p
            for p in fetch_all_rows(
                db.table("affiliates")
                .select("*")
                .in_("id", sorted({z["affiliate_id"] for z in zahlungen}))
            )
        }
        if zahlungen
        else {}
    )
    puffer = io.StringIO()
    w = csv.writer(puffer)
    if format_ == "wise":
        w.writerow(
            [
                "name",
                "recipientEmail",
                "paymentReference",
                "receiverType",
                "amountCurrency",
                "amount",
                "sourceCurrency",
                "targetCurrency",
                "IBAN",
            ]
        )
        for z in zahlungen:
            p = partner[z["affiliate_id"]]
            d = _details(p)
            w.writerow(
                [
                    p.get("company") or p["full_name"],
                    d.get("email", ""),
                    z.get("statement_no") or z["id"],
                    "BUSINESS" if p.get("legal_form") == "company" else "PERSON",
                    z["currency"],
                    f"{_d(z['amount']):.2f}",
                    z["currency"],
                    z["currency"],
                    d.get("iban", ""),
                ]
            )
    elif format_ == "sepa":
        w.writerow(["name", "iban", "amount", "currency", "reference"])
        for z in zahlungen:
            p = partner[z["affiliate_id"]]
            d = _details(p)
            w.writerow(
                [
                    d.get("account_holder") or p["full_name"],
                    d.get("iban", ""),
                    f"{_d(z['amount']):.2f}",
                    z["currency"],
                    z.get("statement_no") or z["id"],
                ]
            )
    else:
        w.writerow(["email", "amount", "currency", "reference", "note"])
        for z in zahlungen:
            p = partner[z["affiliate_id"]]
            d = _details(p)
            w.writerow(
                [
                    d.get("email", ""),
                    f"{_d(z['amount']):.2f}",
                    z["currency"],
                    z.get("statement_no") or z["id"],
                    "myNextDays Partnerprogramm",
                ]
            )
    in_bearbeitung(db, [z["id"] for z in zahlungen])
    return puffer.getvalue()


# --- Gutschrift ------------------------------------------------------------------

_REVERSE_CHARGE = (
    "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, Art. 196 "
    "MwStSystRL) — omvendt betalingspligt. Der Betrag versteht sich ohne Umsatzsteuer."
)
_PRIVAT = (
    "Ohne Umsatzsteuer (Leistung einer Privatperson). Die Provision ist vom "
    "Empfänger selbst zu versteuern."
)


# Positionsbezeichnungen auf der Gutschrift (Team-Provision = Override, 0520;
# Superprovision, Markt-Turbo und Aufstiegsbonus, 0525).
_ART = {
    "earn": "Provision",
    "override": "Team-Provision",
    "lifetime": "Superprovision",
    "booking_share": "Buchungsanteil",
    "bonus": "Aufstiegsbonus",
    "reversal": "Rücknahme",
    "adjustment": "Korrektur",
}


def gutschrift_rendern(db: Client, payout_id: str, settings: Settings | None = None) -> str:
    """Gutschrift/afregningsbilag als Klartext. Selbstfakturierung nach
    momsloven § 52a: Aussteller ist der Leistungsempfänger (wir)."""
    s = settings or get_settings()
    zahlung = _payout(db, payout_id)
    p = _partner(db, zahlung["affiliate_id"])
    posten = fetch_all_rows(
        db.table("affiliate_commissions").select("*").eq("payout_id", payout_id).order("created_at")
    )
    zeilen = [
        "GUTSCHRIFT / SELF-BILLING INVOICE / AFREGNINGSBILAG (selvfakturering)",
        f"Nummer: {zahlung.get('statement_no') or zahlung['id']}",
        f"Datum: {(zahlung.get('paid_at') or zahlung['created_at'])[:10]}",
        f"Zeitraum: {zahlung.get('period_from')} – {zahlung.get('period_to')}",
        "",
        "Aussteller (Leistungsempfänger):",
        f"  {s.company_legal_name} {s.company_legal_form}".rstrip(),
        f"  {s.company_street}, {s.company_city}, {s.company_country}",
        f"  CVR: {s.company_registration_number}   USt-IdNr.: {s.company_vat_id}",
        "",
        "Leistender (Partner):",
        f"  {p.get('company') or p['full_name']}"
        + (f" ({p['full_name']})" if p.get("company") else ""),
        f"  Land: {p['country']}" + (f"   USt-IdNr.: {p['vat_id']}" if p.get("vat_id") else ""),
        f"  E-Mail: {p['email']}",
        "",
        "Leistung: Vermittlung von Neukunden für myNextDays (Partnerprogramm).",
        "",
        f"{'Datum':<12}{'Art':<16}{'Kunde/Betrieb':<40}{'Betrag':>14}",
    ]
    for z in posten:
        zeilen.append(
            f"{str(z['created_at'])[:10]:<12}{_ART.get(z['kind'], z['kind']):<16}"
            f"{z['tenant_id'][:36]:<40}{_d(z['amount']):>11.2f} {z['currency']}"
        )
    zeilen += [
        "",
        f"SUMME: {_d(zahlung['amount']):.2f} {zahlung['currency']}",
        "",
        _REVERSE_CHARGE if p.get("legal_form") == "company" else _PRIVAT,
        "",
        f"Auszahlung per {zahlung['method'].upper()}"
        + (f", Referenz {zahlung['external_ref']}" if zahlung.get("external_ref") else "")
        + ".",
    ]
    return "\n".join(zeilen) + "\n"
