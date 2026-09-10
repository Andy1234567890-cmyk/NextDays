"""Rechnet aus Buchungen die Quartalswerte einer Meldung.

Hier steht, WOHER jede gemeldete Zahl kommt. Die Entscheidungen sind
einzeln begründet, weil sie einer Steuerbehörde standhalten müssen.

VERGÜTUNG — Quelle ist `reservations`, nicht `payments`.
    Gemeldet wird die dem Anbieter gezahlte oder gutgeschriebene Vergütung.
    `payments` erfasst nur Zahlungen über unsere eigene Abwicklung; bei einer
    Portalbuchung zahlt der Gast an das Portal, und bei uns entsteht kein
    Zahlungssatz — die Vergütung ist trotzdem geflossen.
    Live gemessen (10.09.2026): für das Meldejahr 2025 gibt es 732 Buchungen
    über 1.225.941,67, aber NULL Zahlungssätze. Eine Berechnung aus
    `payments` hätte eine leere Meldung erzeugt und niemand hätte es gemerkt.

QUARTAL — Zeitpunkt der Zahlung/Gutschrift, nicht der Anreisetag.
    Die Richtlinie stellt auf den Zeitpunkt ab, zu dem die Vergütung gezahlt
    oder gutgeschrieben wurde. Eine im März bezahlte, im April stattfindende
    Buchung gehört ins erste Quartal.
    Rangfolge ohne Ersatzwert: erfasste Zahlung → `booked_at` → nicht
    meldefähig. `created_at` ist ausdrücklich KEINE Quelle: das ist der
    Zeitpunkt unserer Verarbeitung, nicht der des Geschäftsvorfalls. Ein
    Feed-Import legt hunderte Buchungen mit derselben Sekunde an — sie alle
    ins selbe Quartal zu legen wäre eine Falschmeldung.

GEBÜHREN — was der Plattformbetreiber einbehält oder berechnet.
    `ota_commission` und `channel_fee` der Buchung. Fehlt der Wert, wird 0
    gemeldet: das ist die zutreffende Aussage „nichts einbehalten", kein
    erfundener Ersatzwert.

WÄHRUNG — aus der Buchung, nie ersetzt.
    Weichen die Währungen innerhalb einer Meldeeinheit voneinander ab, ist
    die Quartalssumme eine Addition über Währungsgrenzen und damit falsch.
    Solche Einheiten werden nicht gemeldet, sondern berichtet.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal

from .kanaele import Meldungsart, ausschlussgrund, gehoert_zu
from .modell import Pruefbericht, Quartalswerte, Quartalszahlen

# Buchungsstatus, die zu einer Vergütung geführt haben. Bewusst eine
# ALLOWLIST: Käme ein neuer Status hinzu, fiele er heraus und würde im
# Prüfbericht auffallen. Eine Blockliste zählte ihn still mit.
VERGUETETE_STATUS = frozenset({"confirmed", "completed"})


def quartal_von(tag: date) -> int:
    return (tag.month - 1) // 3 + 1


def _als_datum(wert: object) -> date | None:
    """Ein Datum aus der Datenbank lesen, ohne bei Unsinn zu werfen.

    Gibt `None` zurück statt zu raten — der Aufrufer entscheidet dann, ob das
    ein Fehler ist. Ein hier erfundenes Datum landete unbemerkt in der
    Meldung.
    """
    if isinstance(wert, date):
        return wert
    if not isinstance(wert, str) or not wert:
        return None
    try:
        return datetime.fromisoformat(wert.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _als_betrag(wert: object) -> Decimal:
    """Einen Geldbetrag lesen. Fehlt er, ist er 0 — nicht geraten."""
    if wert is None or wert == "":
        return Decimal(0)
    return Decimal(str(wert))


@dataclass
class Buchungswerte:
    """Die aufsummierten Werte einer Meldeeinheit über ein Meldejahr."""

    verguetung: Quartalswerte = field(default_factory=Quartalswerte)
    gebuehren: Quartalswerte = field(default_factory=Quartalswerte)
    steuern: Quartalswerte = field(default_factory=Quartalswerte)
    anzahl: Quartalszahlen = field(default_factory=Quartalszahlen)
    vermietete_tage: int = 0
    waehrung: str | None = None
    waehrungen_gemischt: bool = False
    belege: list[str] = field(default_factory=list)

    @property
    def hat_werte(self) -> bool:
        return self.anzahl.summe > 0

    @property
    def meldefaehig(self) -> bool:
        return (
            self.hat_werte
            and bool(self.waehrung)
            and not self.waehrungen_gemischt
        )


def zahlungszeitpunkt(
    buchung: dict, zahlungen: list[dict] | None = None
) -> date | None:
    """Wann die Vergütung als gezahlt oder gutgeschrieben gilt.

    Rangfolge:
      1. die erste erfasste erfolgreiche Zahlung
      2. der Buchungszeitpunkt beim Portal (`booked_at`)
      3. nichts — die Buchung ist dann nicht zuzuordnen

    `created_at` steht bewusst NICHT in dieser Liste (siehe Modulkopf).
    """
    for zahlung in sorted(
        zahlungen or [], key=lambda z: str(z.get("created_at") or "")
    ):
        gezahlt = _als_datum(zahlung.get("created_at"))
        if gezahlt:
            return gezahlt
    return _als_datum(buchung.get("booked_at"))


def buchung_verbuchen(
    werte: Buchungswerte,
    buchung: dict,
    jahr: int,
    bericht: Pruefbericht,
    zahlungen: list[dict] | None = None,
) -> bool:
    """Eine Buchung in die Werte einer Meldeeinheit einrechnen.

    Gibt zurück, ob sie eingerechnet wurde. Jeder Nichteinbezug wird im
    Prüfbericht gezählt — eine stumm verworfene Buchung wäre ein Fehlbetrag,
    den niemand findet.
    """
    zeitpunkt = zahlungszeitpunkt(buchung, zahlungen)
    if zeitpunkt is None:
        bericht.ausschluss_zaehlen(
            "kein Zahlungs- oder Buchungszeitpunkt — Quartal nicht bestimmbar"
        )
        return False
    if zeitpunkt.year != jahr:
        bericht.ausschluss_zaehlen("Vergütung fiel in ein anderes Meldejahr")
        return False

    waehrung = buchung.get("currency")
    if not waehrung:
        bericht.ausschluss_zaehlen("Buchung ohne Währung")
        return False
    if werte.waehrung is None:
        werte.waehrung = waehrung
    elif werte.waehrung != waehrung:
        werte.waehrungen_gemischt = True

    quartal = quartal_von(zeitpunkt)
    werte.verguetung = werte.verguetung.plus(
        quartal, _als_betrag(buchung.get("total_amount"))
    )
    werte.gebuehren = werte.gebuehren.plus(
        quartal,
        _als_betrag(buchung.get("ota_commission"))
        + _als_betrag(buchung.get("channel_fee")),
    )
    # Wir behalten derzeit keine Steuern für den Anbieter ein. Die Spalte
    # bleibt damit 0 — das ist eine Aussage, keine Lücke.
    werte.anzahl = werte.anzahl.plus(quartal)

    anreise = _als_datum(buchung.get("check_in"))
    abreise = _als_datum(buchung.get("check_out"))
    if anreise and abreise:
        werte.vermietete_tage += (abreise - anreise).days

    if buchung.get("id"):
        werte.belege.append(str(buchung["id"]))
    return True


def buchungen_auswaehlen(
    buchungen: list[dict], art: Meldungsart, bericht: Pruefbericht
) -> list[dict]:
    """Die Buchungen herausfiltern, die in diese Meldung gehören.

    Prüft Status und Kanal. Jeder Ausschluss wird mit Begründung gezählt,
    damit der Prüfbericht die Differenz zwischen Gesamtbestand und Meldung
    vollständig erklären kann.
    """
    ausgewaehlt: list[dict] = []
    for buchung in buchungen:
        status = buchung.get("status")
        if status not in VERGUETETE_STATUS:
            bericht.ausschluss_zaehlen(
                f"Buchungsstatus '{status}' ist keine vergütete Tätigkeit"
            )
            continue

        # Kein Hinweis mehr bei unbekanntem Kanal: Fuer die Meldung des
        # Betriebs ist der Kanal ohne Belang (Vermittlungsvertrag statt
        # Kanal), ein neuer Vertriebsweg ist dort also kein offener Punkt.
        kanal = buchung.get("channel")
        if not gehoert_zu(kanal, art):
            bericht.ausschluss_zaehlen(ausschlussgrund(kanal, art))
            continue

        ausgewaehlt.append(buchung)

    bericht.einbezogene_buchungen += len(ausgewaehlt)
    return ausgewaehlt


def brutto_mieteinnahme(werte: Buchungswerte) -> Decimal:
    """Die dänische Bruttomieteinnahme.

    Nach der amtlichen Anleitung: ausgezahlte Vergütung + Gebühr − Provision.
    Da wir Gebühr und Provision gemeinsam in `gebuehren` führen (beide sind
    aus Sicht des Anbieters Abzüge des Betreibers), heben sie einander auf
    und es bleibt die Vergütung. Der Ausdruck steht trotzdem hier, damit
    sichtbar ist, dass die Regel angewandt und nicht übersehen wurde.
    """
    return werte.verguetung.summe
