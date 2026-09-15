"""Deutsche Kennzahlen-Zuordnung der Umsatzsteuer-Voranmeldung (EIN Mapping-Modul).

Die Auswertung selbst ist länderneutral (`service.py`: Zeilen je Kategorie und
Steuersatz). Dieses Modul übersetzt sie in die Kennzahlen des deutschen
Formulars — und NUR dieses; für andere Länder gibt es (noch) kein Mapping, dort
zeigt die Oberfläche die neutralen Zeilen. Ein zweites Land bekommt sein eigenes
Modul nach demselben Muster (`funktion(zeilen) -> list[MappedFigure]`), nicht
ein `if country == …` in der Auswertung.

Quelle der Kennzahlen: Formular USt 1 A (Stand 2025). Netto-Kennzahlen tragen
die Bemessungsgrundlage in vollen Euro; hier bleiben Cent stehen, gerundet wird
beim Eintragen — die Werte hier sind die Rechenbasis, nicht das Formular.

  Kz 81  Umsätze 19 % (Netto; Steuer wird vom Finanzamt berechnet)
  Kz 86  Umsätze 7 %  (Netto)
  Kz 35  Umsätze zu anderen Steuersätzen (Netto)   + Kz 36 Steuer darauf
  Kz 48  steuerfreie Umsätze ohne Vorsteuerabzug
  Kz 43  steuerfreie Umsätze mit Vorsteuerabzug (Ausfuhr)
  Kz 41  innergemeinschaftliche Lieferungen
  Kz 21  nicht steuerbare sonstige Leistungen an EU-Unternehmer (§ 18b)
  Kz 60  steuerpflichtige Umsätze, für die der Empfänger die Steuer schuldet (§ 13b)
  Kz 45  übrige nicht steuerbare Umsätze
  Kz 66  abziehbare Vorsteuer
  Kz 83  verbleibende Zahllast / Erstattung

Umsätze zu 0 % innerhalb einer steuerpflichtigen Rechnung (z. B. Kurtaxe) landen
in Kz 48 mit Warnung — ob sie dort hingehören, entscheidet der Steuerberater.
Kleinunternehmer (§ 19) geben keine Voranmeldung ab: das Mapping bleibt leer.
"""

from __future__ import annotations

from decimal import Decimal

from .schemas import InputTaxLine, MappedFigure, SalesLine

SCHEME = "DE_USTVA"
COUNTRY = "DE"

_REGEL_KZ: dict[str, tuple[str, str]] = {
    "exempt": ("48", "Steuerfreie Umsätze ohne Vorsteuerabzug"),
    "reverse_charge_domestic": ("60", "Umsätze nach § 13b UStG (Steuerschuld beim Empfänger)"),
    "reverse_charge_eu": ("21", "Nicht steuerbare sonstige Leistungen an EU-Unternehmer (§ 18b)"),
    "intra_community_supply": ("41", "Innergemeinschaftliche Lieferungen"),
    "export": ("43", "Steuerfreie Umsätze mit Vorsteuerabzug (Ausfuhr)"),
    "out_of_scope": ("45", "Übrige nicht steuerbare Umsätze"),
    "oss": ("45", "Übrige nicht steuerbare Umsätze (OSS, im Bestimmungsland versteuert)"),
}

_SATZ_KZ: dict[Decimal, tuple[str, str]] = {
    Decimal("19"): ("81", "Steuerpflichtige Umsätze 19 %"),
    Decimal("7"): ("86", "Steuerpflichtige Umsätze 7 %"),
}


def _add(
    ziel: dict[str, MappedFigure], code: str, label: str, betrag: Decimal, kind: str, quelle: str
) -> None:
    if code in ziel:
        alt = ziel[code]
        ziel[code] = alt.model_copy(
            update={"amount": alt.amount + betrag, "source": f"{alt.source}, {quelle}"}
        )
        return
    ziel[code] = MappedFigure(
        code=code,
        label=label,
        amount=betrag,
        kind=kind,  # type: ignore[arg-type]
        source=quelle,
    )


def _umsatzzeile(ziel: dict[str, MappedFigure], zeile: SalesLine, warnungen: list[str]) -> None:
    if zeile.category == "taxable":
        satz = zeile.tax_rate if zeile.tax_rate is not None else Decimal("0")
        quelle = f"taxable {satz} %"
        if satz == 0:
            _add(ziel, "48", _REGEL_KZ["exempt"][1], zeile.net, "net", quelle)
            warnungen.append(
                "Umsätze zu 0 % in steuerpflichtigen Rechnungen wurden Kz 48 zugeordnet — "
                "bitte prüfen."
            )
            return
        if satz in _SATZ_KZ:
            code, label = _SATZ_KZ[satz]
            _add(ziel, code, label, zeile.net, "net", quelle)
            return
        _add(ziel, "35", "Umsätze zu anderen Steuersätzen", zeile.net, "net", quelle)
        _add(ziel, "36", "Steuer auf Umsätze zu anderen Steuersätzen", zeile.tax, "tax", quelle)
        return
    if zeile.category == "undetermined":
        warnungen.append(
            f"{zeile.invoice_count} Beleg(e) ohne ermittelbaren Steuersatz — "
            "nicht zugeordnet, bitte prüfen."
        )
        return
    code, label = _REGEL_KZ[zeile.category]
    _add(ziel, code, label, zeile.net, "net", zeile.category)


def kennzahlen(
    sales: list[SalesLine],
    input_tax: list[InputTaxLine],
    *,
    payable: Decimal,
    small_business: bool,
) -> tuple[list[MappedFigure], list[str]]:
    """Neutrale Zeilen → Kz-Liste (sortiert nach Kennzahl) plus Warnungen."""
    warnungen: list[str] = []
    if small_business:
        warnungen.append(
            "Kleinunternehmer (§ 19 UStG): keine Umsatzsteuer-Voranmeldung — Kennzahlen entfallen."
        )
        return [], warnungen
    ziel: dict[str, MappedFigure] = {}
    for zeile in sales:
        _umsatzzeile(ziel, zeile, warnungen)
    vorsteuer = sum((z.tax for z in input_tax), Decimal("0"))
    _add(ziel, "66", "Abziehbare Vorsteuerbeträge", vorsteuer, "tax", "input_tax")
    _add(
        ziel,
        "83",
        "Verbleibende Umsatzsteuer-Vorauszahlung / Überschuss",
        payable,
        "result",
        "sales_tax_total - input_tax_total",
    )
    return sorted(ziel.values(), key=lambda f: int(f.code)), warnungen
