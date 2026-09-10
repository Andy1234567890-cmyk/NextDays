"""Die dänischen Steuernummern: CPR und CVR.

Vorgabe der amtlichen Anleitung von Skattestyrelsen (Feld `TIN`):

    „Skatteidentifikationsnummer. I Danmark er det for privatpersoner et
     CPR-nummer, hvor formatet skal følge eksemplet her: "1234567891".
     For danske virksomheder angives et CVR/SE nummer."

Daraus folgen drei Dinge, die alle drei falsch sein können, ohne dass es
auffällt:

1. **Die Art hängt am Anbieter, nicht am Feld.** Eine Privatperson meldet
   ihre CPR-Nummer, eine Gesellschaft ihre CVR-/SE-Nummer. Beides in eine
   Spalte zu werfen und zu hoffen, dass die richtige gemeint war, geht so
   lange gut, bis eine Person eine achtstellige Nummer trägt.

2. **Die CPR-Nummer wird MIT Bindestrich gemeldet: `DDMMJJ-XXXX`.** Der
   Feldkommentar zeigt zwar `"1234567891"` ohne Trennzeichen, die gelebte
   Meldung im Blatt `Indberetning` derselben Vorlage schreibt aber alle
   **18 von 18** Personennummern mit Bindestrich (`010190-1234`,
   `020291-2345`, `030392-3456` …) — keine einzige ohne. Wo das
   Formatbeispiel und die tatsächliche Belegung auseinandergehen, gilt die
   Belegung: Sie ist das, was die Behörde von diesem Betrieb entgegennimmt.
   Die CVR-Nummer bleibt davon unberührt, sie steht dort als reine
   Ziffernfolge (`44179377`, `34814643`).

3. **Die Prüfziffer ist prüfbar.** Eine CVR-Nummer trägt eine modulo-11-
   Prüfziffer; eine CPR-Nummer trägt ein gültiges Geburtsdatum in den
   ersten sechs Stellen. Ein Zahlendreher fällt damit hier auf statt bei
   der Behörde.

Warum die CPR-Prüfziffer NICHT geprüft wird: Sie wurde zum 01.01.2007
abgeschafft. Seither gibt es gültige CPR-Nummern, die die alte modulo-11-
Probe nicht bestehen — eine Prüfung darauf würde echte Nummern
zurückweisen. Geprüft wird deshalb nur, was seither noch gilt: Länge,
Ziffern und ein plausibles Datum.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

# Die Gewichte der dänischen CVR-Prüfziffer (modulo 11).
_CVR_GEWICHTE = (2, 7, 6, 5, 4, 3, 2)

_CPR_LAENGE = 10
_CVR_LAENGE = 8


@dataclass(frozen=True, slots=True)
class Nummernpruefung:
    """Das Ergebnis einer Formatprüfung."""

    wert: str | None
    art: str
    gueltig: bool
    grund: str | None = None


def ziffern(roh: str | None) -> str:
    """Alles außer Ziffern entfernen.

    Bindestriche, Leerzeichen und Punkte sind Schreibweisen, keine
    Bestandteile der Nummer — die Anleitung verlangt die reine Ziffernfolge.
    """
    if not roh:
        return ""
    return "".join(z for z in roh if z.isdigit())


def cpr_pruefen(roh: str | None) -> Nummernpruefung:
    """Eine CPR-Nummer (Privatperson) normalisieren und prüfen.

    Zehn Ziffern: TTMMJJ plus vierstellige laufende Nummer. Geprüft werden
    Länge und das Datum in den ersten sechs Stellen — die modulo-11-Probe
    gilt seit 2007 nicht mehr für alle Nummern.

    Geprüft wird auf der reinen Ziffernfolge, ZURÜCKGEGEBEN wird die
    Schreibweise der Meldung: `DDMMJJ-XXXX`. Beides ist nötig — eine
    Datenbank kann die Nummer mit oder ohne Bindestrich führen, die Datei
    trägt sie einheitlich mit.
    """
    rein = ziffern(roh)
    if not rein:
        return Nummernpruefung(None, "CPR", False, "keine CPR-Nummer erfasst")
    if len(rein) != _CPR_LAENGE:
        return Nummernpruefung(
            cpr_schreibweise(rein),
            "CPR",
            False,
            f"eine CPR-Nummer hat {_CPR_LAENGE} Ziffern, diese hat {len(rein)}",
        )
    if not _datum_plausibel(rein[:6]):
        return Nummernpruefung(
            cpr_schreibweise(rein),
            "CPR",
            False,
            "die ersten sechs Ziffern ergeben kein gültiges Geburtsdatum",
        )
    return Nummernpruefung(cpr_schreibweise(rein), "CPR", True)


def cpr_schreibweise(rein: str) -> str:
    """Die Meldeform einer CPR-Nummer: `DDMMJJ-XXXX`.

    Eine Nummer falscher Länge wird unverändert zurückgegeben — sie ist
    ohnehin ungültig, und ein erfundener Bindestrich mitten in einer
    fehlerhaften Zahl würde die Fehlermeldung nur unleserlich machen.
    """
    if len(rein) != _CPR_LAENGE:
        return rein
    return f"{rein[:6]}-{rein[6:]}"


def cvr_pruefen(roh: str | None) -> Nummernpruefung:
    """Eine CVR-/SE-Nummer (Gesellschaft) normalisieren und prüfen.

    Acht Ziffern mit modulo-11-Prüfziffer. Anders als bei der CPR-Nummer
    gilt diese Probe weiterhin, deshalb wird sie gerechnet: Ein Zahlendreher
    in einer Firmennummer fällt sonst erst bei der Behörde auf.
    """
    rein = ziffern(roh)
    if not rein:
        return Nummernpruefung(None, "CVR", False, "keine CVR-Nummer erfasst")
    if len(rein) != _CVR_LAENGE:
        return Nummernpruefung(
            rein,
            "CVR",
            False,
            f"eine CVR-Nummer hat {_CVR_LAENGE} Ziffern, diese hat {len(rein)}",
        )
    if not _cvr_pruefziffer_stimmt(rein):
        return Nummernpruefung(
            rein, "CVR", False, "die Prüfziffer stimmt nicht"
        )
    return Nummernpruefung(rein, "CVR", True)


def cvr_aus_vat_id(vat_id: str | None) -> str | None:
    """Die CVR-Nummer aus einer dänischen USt-IdNr. (`DK44179377`).

    In Dänemark ist die USt-IdNr. dieselbe Zahl wie die CVR-/SE-Nummer,
    nur mit vorangestelltem Länderkürzel — der Feldkommentar der Vorlage
    zum Feld `VAT` sagt es wörtlich: „I Danmark er det tilsvarende
    momsregistreringsnummeret dvs. SE nummer." Die Meldung selbst trägt in
    `TIN` die Nummer OHNE Präfix (`44179377`).

    Gibt `None` zurück, wenn die Zeichenkette keine dänische USt-IdNr. ist
    oder die Prüfziffer nicht stimmt — dann bleibt die Selbstauskunft
    Pflicht, statt eine unbrauchbare Nummer in die Datei zu schreiben.
    """
    if not vat_id:
        return None
    rein = "".join(z for z in vat_id if z.isalnum()).upper()
    if not rein.startswith("DK"):
        return None
    return rein[2:] if cvr_pruefen(rein[2:]).gueltig else None


def steuernummer_pruefen(
    roh: str | None, *, ist_person: bool
) -> Nummernpruefung:
    """Die richtige Prüfung nach Art des Anbieters wählen.

    Das ist der Einstiegspunkt: Welche Nummer gilt, entscheidet sich am
    Anbieter, nicht am Feld, in dem sie zufällig steht.
    """
    return cpr_pruefen(roh) if ist_person else cvr_pruefen(roh)


def _cvr_pruefziffer_stimmt(nummer: str) -> bool:
    summe = sum(
        int(ziffer) * gewicht
        for ziffer, gewicht in zip(nummer[:7], _CVR_GEWICHTE, strict=True)
    )
    rest = summe % 11
    if rest == 0:
        return int(nummer[7]) == 0
    if rest == 1:
        # Rest 1 ergäbe die Prüfziffer 10 — solche Nummern werden nicht
        # vergeben.
        return False
    return int(nummer[7]) == 11 - rest


def _datum_plausibel(ttmmjj: str) -> bool:
    """Ob die ersten sechs Ziffern ein Datum ergeben können.

    Das Jahrhundert steckt in der siebten Ziffer und ist für die
    Plausibilität ohne Belang: Der 29. Februar wird deshalb in einem
    Schaltjahr geprüft, damit ein gültiges Datum nicht an der
    Jahrhundertwahl scheitert.
    """
    try:
        tag, monat, jahr = (
            int(ttmmjj[:2]),
            int(ttmmjj[2:4]),
            int(ttmmjj[4:6]),
        )
        # 2000 ist ein Schaltjahr — die großzügigste Annahme.
        date(2000 if jahr % 4 == 0 else 1900 + jahr, monat, tag)
    except ValueError:
        return False
    return True
