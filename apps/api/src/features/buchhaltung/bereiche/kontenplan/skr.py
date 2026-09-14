"""Standardkonten SKR03 / SKR04 für `POST /booking-accounts/import-standard`.

QUELLE: die Datendatei des alten Werkzeugs
`taskilo-platform/apps/frontend/app/src/data/complete-datev-accounts.ts`
(656 Konten „aus der HTML-Export-Datei"). Sie ist — anders als ihr Kommentar
vermuten lässt — nach SKR04 nummeriert (Erlöse 4xxx, Aufwand 6xxx/7xxx) und
trägt bei Anlage-/Geldkonten falsche Typen (Gebäude als EXPENSE). Übernommen
wurden daraus NUR die Konten, die ein Beherbergungsbetrieb in der Praxis
bebucht (Erlöse, Aufwand, Geld-/Steuerkonten) — mit korrigiertem Typ und der
SKR03-Entsprechung nach dem DATEV-Standardkontenrahmen. Nicht übernommen:
199 Erlös-Varianten ohne Unterschied im Namen, Anlagekonten, Sonderfälle.

Steuersatz: NUR dort gesetzt, wo der Kontenrahmen ihn im Kontonamen festlegt
(„Erlöse 19 % USt"). Alle anderen Konten bleiben ohne Satz — der Import
erfindet keinen (Wurzel 4). 19 % / 7 % sind hier Bestandteil des deutschen
Kontenrahmens, keine Vorgabe des Betriebs; ein Betrieb außerhalb Deutschlands
importiert diesen Kontenrahmen nicht.

Form je Eintrag: (SKR03-Nummer, SKR04-Nummer, Name, Typ, Steuersatz|None).
"""

from __future__ import annotations

from decimal import Decimal
from typing import NamedTuple


class StandardKonto(NamedTuple):
    skr03: str
    skr04: str
    name: str
    type: str
    tax_rate: Decimal | None


_19 = Decimal("19")
_7 = Decimal("7")

STANDARDKONTEN: tuple[StandardKonto, ...] = (
    # --- Geld- und Bestandskonten (ASSET) -------------------------------------
    StandardKonto("1000", "1600", "Kasse", "ASSET", None),
    StandardKonto("1200", "1800", "Bank", "ASSET", None),
    StandardKonto("1210", "1810", "Bank 2 (z. B. PayPal, Stripe)", "ASSET", None),
    StandardKonto("1360", "1460", "Geldtransit", "ASSET", None),
    StandardKonto("1400", "1200", "Forderungen aus Lieferungen und Leistungen", "ASSET", None),
    StandardKonto("1571", "1401", "Abziehbare Vorsteuer 7 %", "ASSET", _7),
    StandardKonto("1576", "1406", "Abziehbare Vorsteuer 19 %", "ASSET", _19),
    StandardKonto("1590", "1370", "Durchlaufende Posten", "ASSET", None),
    # --- Verbindlichkeiten, Steuern, Privat (LIABILITY) ------------------------
    StandardKonto(
        "1600", "3300", "Verbindlichkeiten aus Lieferungen und Leistungen", "LIABILITY", None
    ),
    StandardKonto("1771", "3801", "Umsatzsteuer 7 %", "LIABILITY", _7),
    StandardKonto("1776", "3806", "Umsatzsteuer 19 %", "LIABILITY", _19),
    StandardKonto("1780", "3820", "Umsatzsteuer-Vorauszahlungen", "LIABILITY", None),
    StandardKonto("1800", "2100", "Privatentnahmen allgemein", "LIABILITY", None),
    StandardKonto("1890", "2180", "Privateinlagen", "LIABILITY", None),
    # --- Erlöse (INCOME) -------------------------------------------------------
    StandardKonto("8100", "4100", "Steuerfreie Umsätze § 4 Nr. 8 ff. UStG", "INCOME", None),
    StandardKonto("8110", "4110", "Sonstige steuerfreie Umsätze Inland", "INCOME", None),
    StandardKonto("8120", "4120", "Steuerfreie Umsätze Drittland", "INCOME", None),
    StandardKonto("8125", "4125", "Steuerfreie innergemeinschaftliche Lieferungen", "INCOME", None),
    StandardKonto("8200", "4200", "Erlöse", "INCOME", None),
    StandardKonto("8300", "4300", "Erlöse 7 % USt", "INCOME", _7),
    StandardKonto("8400", "4400", "Erlöse 19 % USt", "INCOME", _19),
    StandardKonto("8700", "4700", "Erlösschmälerungen", "INCOME", None),
    StandardKonto("8731", "4731", "Gewährte Skonti 7 % USt", "INCOME", _7),
    StandardKonto("8736", "4736", "Gewährte Skonti 19 % USt", "INCOME", _19),
    StandardKonto("2700", "4830", "Sonstige betriebliche Erträge", "INCOME", None),
    StandardKonto("2660", "4840", "Erträge aus der Währungsumrechnung", "INCOME", None),
    StandardKonto("2730", "4925", "Erträge aus abgeschriebenen Forderungen", "INCOME", None),
    StandardKonto("2750", "4860", "Grundstückserträge", "INCOME", None),
    # --- Aufwand (EXPENSE) -----------------------------------------------------
    StandardKonto("3100", "5900", "Fremdleistungen", "EXPENSE", None),
    StandardKonto("3300", "5300", "Wareneingang 7 % Vorsteuer", "EXPENSE", _7),
    StandardKonto("3400", "5400", "Wareneingang 19 % Vorsteuer", "EXPENSE", _19),
    StandardKonto("4100", "6000", "Löhne und Gehälter", "EXPENSE", None),
    StandardKonto("4130", "6110", "Gesetzliche soziale Aufwendungen", "EXPENSE", None),
    StandardKonto("4210", "6310", "Miete (unbewegliche Wirtschaftsgüter)", "EXPENSE", None),
    StandardKonto("4230", "6320", "Heizung", "EXPENSE", None),
    StandardKonto("4240", "6325", "Gas, Strom, Wasser", "EXPENSE", None),
    StandardKonto("4250", "6330", "Reinigung", "EXPENSE", None),
    StandardKonto("4260", "6335", "Instandhaltung betrieblicher Räume", "EXPENSE", None),
    StandardKonto("4280", "6345", "Sonstige Raumkosten", "EXPENSE", None),
    StandardKonto("4360", "6400", "Versicherungen", "EXPENSE", None),
    StandardKonto("4380", "6420", "Beiträge", "EXPENSE", None),
    StandardKonto("4390", "6430", "Sonstige Abgaben", "EXPENSE", None),
    StandardKonto("4520", "6520", "Kfz-Versicherungen", "EXPENSE", None),
    StandardKonto("4530", "6530", "Laufende Kfz-Betriebskosten", "EXPENSE", None),
    StandardKonto("4540", "6540", "Kfz-Reparaturen", "EXPENSE", None),
    StandardKonto("4600", "6600", "Werbekosten", "EXPENSE", None),
    StandardKonto("4650", "6640", "Bewirtungskosten", "EXPENSE", None),
    StandardKonto("4660", "6650", "Reisekosten Arbeitnehmer", "EXPENSE", None),
    StandardKonto("4670", "6670", "Reisekosten Unternehmer", "EXPENSE", None),
    StandardKonto("4760", "6770", "Verkaufsprovisionen (z. B. Portale)", "EXPENSE", None),
    StandardKonto("4806", "6495", "Wartungskosten für Hard- und Software", "EXPENSE", None),
    StandardKonto("4830", "6220", "Abschreibungen auf Sachanlagen", "EXPENSE", None),
    StandardKonto(
        "4855", "6260", "Sofortabschreibung geringwertiger Wirtschaftsgüter", "EXPENSE", None
    ),
    StandardKonto("4910", "6800", "Porto", "EXPENSE", None),
    StandardKonto("4920", "6805", "Telefon", "EXPENSE", None),
    StandardKonto("4930", "6815", "Bürobedarf", "EXPENSE", None),
    StandardKonto("4940", "6820", "Zeitschriften, Bücher (Fachliteratur)", "EXPENSE", None),
    StandardKonto("4950", "6825", "Rechts- und Beratungskosten", "EXPENSE", None),
    StandardKonto("4955", "6830", "Buchführungskosten", "EXPENSE", None),
    StandardKonto("4957", "6827", "Abschluss- und Prüfungskosten", "EXPENSE", None),
    StandardKonto("4970", "6855", "Nebenkosten des Geldverkehrs", "EXPENSE", None),
    StandardKonto("4980", "6850", "Sonstiger Betriebsbedarf", "EXPENSE", None),
    StandardKonto("4985", "6845", "Werkzeuge und Kleingeräte", "EXPENSE", None),
    StandardKonto("2100", "7300", "Zinsen und ähnliche Aufwendungen", "EXPENSE", None),
    StandardKonto(
        "2110", "7310", "Zinsaufwendungen für kurzfristige Verbindlichkeiten", "EXPENSE", None
    ),
    StandardKonto(
        "2120", "7320", "Zinsaufwendungen für langfristige Verbindlichkeiten", "EXPENSE", None
    ),
)


def standardkonten(kontenrahmen: str) -> list[dict]:
    """Konten eines Kontenrahmens als Insert-fertige Dicts (ohne tenant_id).

    `skr_reference` trägt die Nummer im JEWEILS ANDEREN Kontenrahmen — so lässt
    sich ein SKR03-Betrieb später nach SKR04 exportieren und umgekehrt.
    """
    if kontenrahmen not in ("SKR03", "SKR04"):
        raise ValueError(f"Unbekannter Kontenrahmen '{kontenrahmen}'.")
    konten: list[dict] = []
    for k in STANDARDKONTEN:
        nummer, referenz = (k.skr03, k.skr04) if kontenrahmen == "SKR03" else (k.skr04, k.skr03)
        konten.append(
            {
                "number": nummer,
                "name": k.name,
                "type": k.type,
                "tax_rate": str(k.tax_rate) if k.tax_rate is not None else None,
                "kontenrahmen": kontenrahmen,
                "skr_reference": referenz,
                "is_system": True,
                "automatic_booking": False,
                "active": True,
            }
        )
    return konten
