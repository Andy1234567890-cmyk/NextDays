"""EU-Steuerlogik für Owner-Statements (Rechnungen der Agentur an den Eigentümer).

Bestimmt aus den drei beteiligten Ländern + dem Steuerprofil des Mandanten die
EN-16931-Steuerkategorie, den anzuwendenden Satz und die Aufschlüsselung
(Netto/Steuer/Brutto). Bewusst als reine Funktionen ohne DB-Zugriff, damit sie
isoliert testbar sind.

Rechtsgrundlagen (recherchiert):
  * Reverse Charge — Art. 196 RL 2006/112/EG: B2B-Dienstleistung an einen in
    einem ANDEREN EU-Land USt-registrierten Empfänger → ohne USt, der Empfänger
    schuldet die Steuer. Voraussetzung hier: Agentur-Land ≠ Owner-Land, beide in
    der EU, Owner hat eine USt-IdNr.  → Kategorie 'AE'.
  * Kleinunternehmer/Steuerbefreiung (§19 UStG-Äquivalent): tax_scheme des
    Mandanten ist 'small_business' → ohne USt.  → Kategorie 'E'.
  * Sonst Standardsatz des Mandanten-Landes auf die Provision (PM-Payout).
    → Kategorie 'S'.

WICHTIG: Diese Logik bildet den Regelfall ab. Der konkrete umsatzsteuerliche
Sachverhalt (worauf genau USt anfällt) ist mandanten-/fallabhängig und vom
Steuerberater zu bestätigen — daher keine erfundenen Sätze: der Satz kommt aus
der Mandanten-Konfiguration (default_tax_rate), nicht aus einer Annahme.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

_CENT = Decimal("0.01")

# EU-Mitgliedstaaten (ISO-3166-1 alpha-2) — für die Reverse-Charge-Prüfung.
EU_COUNTRIES = frozenset(
    {
        "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
        "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
        "SI", "ES", "SE",
    }
)


@dataclass(frozen=True)
class TaxResult:
    category: str  # EN BT-118: 'S' | 'AE' | 'E' | 'Z'
    rate: Decimal  # Prozentsatz (z. B. 19)
    net: Decimal
    tax: Decimal
    gross: Decimal
    exemption_reason: str | None  # EN BT-120


def _q(value: Decimal) -> Decimal:
    return value.quantize(_CENT)


def compute_tax(
    *,
    taxable_base: Decimal,
    tenant_tax_scheme: str,
    tenant_default_rate: Decimal,
    seller_country: str | None,
    buyer_country: str | None,
    buyer_vat_id: str | None,
) -> TaxResult:
    """Steuerkategorie + Aufschlüsselung für den steuerbaren Betrag (i. d. R. die
    Provision/der PM-Payout).

    Reihenfolge der Prüfung:
      1. Kleinunternehmer/steuerbefreit → 'E', 0 %.
      2. Grenzüberschreitend B2B in der EU mit USt-IdNr. des Käufers → 'AE'
         (Reverse Charge), 0 %.
      3. Sonst Standardsatz des Mandanten → 'S'.
    """
    base = _q(taxable_base)
    seller = (seller_country or "").upper()
    buyer = (buyer_country or "").upper()

    # 1) Kleinunternehmer / steuerbefreit (§19-Äquivalent).
    if tenant_tax_scheme == "small_business":
        return TaxResult(
            category="E",
            rate=Decimal("0"),
            net=base,
            tax=Decimal("0.00"),
            gross=base,
            exemption_reason=(
                "Steuerbefreit (Kleinunternehmerregelung / §19 UStG-Äquivalent)."
            ),
        )

    # 2) Reverse Charge: B2B, Verkäufer ≠ Käufer-Land, beide EU, Käufer hat USt-ID.
    reverse_charge = (
        bool(buyer_vat_id)
        and seller in EU_COUNTRIES
        and buyer in EU_COUNTRIES
        and seller != buyer
    )
    if reverse_charge:
        return TaxResult(
            category="AE",
            rate=Decimal("0"),
            net=base,
            tax=Decimal("0.00"),
            gross=base,
            exemption_reason=(
                "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, "
                "Art. 196 RL 2006/112/EG). VAT to be accounted for by the recipient."
            ),
        )

    # 3) Standardsatz des Mandanten-Landes.
    rate = _q(tenant_default_rate)
    tax = _q(base * rate / Decimal("100"))
    return TaxResult(
        category="S",
        rate=rate,
        net=base,
        tax=tax,
        gross=_q(base + tax),
        exemption_reason=None,
    )
