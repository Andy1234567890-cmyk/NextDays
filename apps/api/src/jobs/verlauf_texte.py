"""Aus einem echten Channex-Request beschreiben, WAS gesendet wurde (0381).

WOZU: Der Verlauf unter `/worker` zeigte `taxes · POST · ok · 214 ms`. Damit ist
die Frage „sendet er die Reinigungsgebühr?" nicht beantwortet — man musste den
Request-Body in `channex_debug_log` von Hand nachlesen.

Hier entsteht der Satz, der stattdessen in der Tabelle steht:

    Reinigungsgebühr · 795,00 DKK · pro Buchung · exklusiv

QUELLE IST IMMER DER ECHTE BODY, DER RAUSGING. Nichts wird aus dem lokalen
Zustand ergänzt oder geraten: Wenn im Request `rate: "795.0"` steht, steht 795,00
im Verlauf — auch wenn die Objekt-Einstellung inzwischen 850 sagt. Der Verlauf
soll belegen, was das Portal bekommen hat, nicht was es hätte bekommen sollen.
Fehlt ein Feld, fehlt es auch im Text (Wurzel 4) — kein „EUR" als Notwährung,
kein erfundenes „pro Nacht".

WARUM HIER UND NICHT IM CLIENT-SINK: Diese Übersetzung wächst mit jedem
Aufruftyp. Im Sink stünde sonst eine Kette von if-Zweigen mitten im Push-Pfad,
wo sie bei jedem neuen Endpunkt angefasst werden müsste.

DIE TEXTE SIND DIAGNOSE, NICHT OBERFLÄCHE: Sie stehen im Backoffice hinter
`is_platform_admin` und werden absichtlich NICHT übersetzt — sie sollen genau die
Feldnamen tragen, die im Body stehen, damit man sie gegen die Channex-Doku halten
kann.
"""

from __future__ import annotations

from typing import Any

# Channex' `logic`-Werte in Klartext. Fehlt einer, wird der ROHWERT gezeigt
# statt eine Beschreibung geraten — ein unbekanntes `logic` ist eine
# Produktfrage, keine Anzeigefrage.
_LOGIK = {
    "per_booking": "pro Buchung",
    "per_night": "pro Nacht",
    "per_person": "pro Person",
    "per_person_per_night": "pro Person und Nacht",
    "percent": "prozentual",
}

# Wie viele Einzelposten ein Satz-Text aufzählt, bevor gekürzt wird. Genug für
# den Normalfall (USt. + Kurtaxe + Reinigung + Haustier), kurz genug für eine
# Tabellenzeile.
_MAX_POSTEN = 6


def _betrag(wert: object, currency: str | None) -> str:
    """Einen Channex-Betrag lesbar machen: "795.0" → "795,00 DKK".

    Ohne Währung wird der Betrag OHNE Symbol gezeigt, nicht mit einem geratenen
    (Wurzel 4). Ein unparsbarer Wert wird rohgezeigt — er ist dann selbst der
    Befund.
    """
    try:
        zahl = f"{float(str(wert)):.2f}".replace(".", ",")
    except (TypeError, ValueError):
        zahl = str(wert)
    return f"{zahl} {currency}" if currency else zahl


def _abgabe(tax: dict[str, Any]) -> str:
    """Eine einzelne Abgabe/Gebühr: Titel · Betrag · Logik · inklusiv?

    `is_inclusive` wird ausgeschrieben, weil daran die häufigste Verwechslung
    hängt: eine inklusive Gebühr erhöht den Portalpreis NICHT, eine exklusive
    kommt oben drauf. Im Body steht dazu ein blankes `false`.
    """
    teile = [str(tax.get("title") or "Abgabe ohne Titel")]
    if tax.get("rate") is not None:
        teile.append(_betrag(tax["rate"], tax.get("currency")))
    logik = tax.get("logic")
    if logik:
        teile.append(_LOGIK.get(str(logik), str(logik)))
    if tax.get("is_inclusive") is not None:
        teile.append("inklusiv" if tax["is_inclusive"] else "exklusiv")
    return " · ".join(teile)


def _tax_set(satz: dict[str, Any]) -> str:
    """Ein tax_set: der Satz selbst plus die Abgaben, die er bündelt.

    Der Satz ist das, was am Rate-Plan hängt — er entscheidet, WELCHE der
    angelegten Abgaben ein Portal überhaupt sieht. Nur die Anzahl zu zeigen wäre
    hier zu wenig: „4 Abgaben" beantwortet nicht, ob die Reinigung dabei ist.
    """
    posten = satz.get("taxes")
    titel = str(satz.get("title") or "Abgaben-Satz")
    if not isinstance(posten, list) or not posten:
        return titel
    namen: list[str] = []
    for p in posten[:_MAX_POSTEN]:
        if isinstance(p, dict):
            # Im tax_set steht je Posten meist nur {id, level} — der Titel
            # kommt nur mit, wenn Channex ihn mitschickt. Dann die ID, damit die
            # Zeile auf die Abgabe zeigt statt "unbekannt" zu behaupten.
            namen.append(str(p.get("title") or p.get("id") or "?"))
    rest = len(posten) - len(namen)
    text = ", ".join(namen) + (f" +{rest} weitere" if rest > 0 else "")
    return f"{titel} · {len(posten)} Abgaben · {text}"


def _ari_werte(values: list[Any], art: str) -> str:
    """Availability/Restrictions: über welche Zeiträume und mit welchen Werten.

    Ein ARI-Push trägt bis zu Hunderte Einträge (ein Jahr, mehrere Rate-Plans).
    Statt sie aufzuzählen wird verdichtet, WAS gesendet wurde — die Einzelheiten
    stehen im Body, der beim Aufklappen ungekürzt daneben liegt.
    """
    if not values:
        return f"{art}: keine Werte"
    tage = 0
    felder: dict[str, Any] = {}
    for v in values:
        if not isinstance(v, dict):
            continue
        # Channex nimmt entweder ein Einzeldatum oder eine Spanne.
        tage += 1
        for schluessel, wert in v.items():
            if schluessel in {
                "date", "date_from", "date_to", "days", "property_id",
                "room_type_id", "rate_plan_id",
            }:
                continue
            # Nur den ERSTEN Wert je Feld zeigen: ein Push trägt oft denselben
            # Preis über Wochen, und "1.150 DKK" ist die Aussage — nicht 365x.
            felder.setdefault(schluessel, wert)
    teile = [f"{tage} {'Eintrag' if tage == 1 else 'Einträge'}"]
    for schluessel, wert in list(felder.items())[:_MAX_POSTEN]:
        teile.append(f"{schluessel}={wert}")
    return " · ".join(teile)


def beschreiben(  # noqa: PLR0911  # pylint: disable=too-many-return-statements
    pfad: str | None, body: object
) -> str | None:
    """Den Satz für die Verlaufszeile bauen — oder `None`.

    `None` heisst: zu diesem Aufruf gibt es nichts zu sagen, was über
    Methode+Pfad hinausgeht (die stehen schon in eigenen Spalten). Lieber ein
    leeres Feld als eine Wiederholung der Spalte daneben.
    """
    if not isinstance(body, dict) or not pfad:
        return None

    # --- Abgaben und Gebühren -------------------------------------------
    if isinstance(body.get("tax"), dict):
        return _abgabe(body["tax"])
    if isinstance(body.get("tax_set"), dict):
        return _tax_set(body["tax_set"])

    # --- ARI -------------------------------------------------------------
    for schluessel, art in (("availability", "Verfügbarkeit"), ("values", "Werte")):
        werte = body.get(schluessel)
        if isinstance(werte, list):
            art = "Verfügbarkeit" if pfad.startswith("availability") else art
            if pfad.startswith("restrictions"):
                art = "Restriktionen"
            return _ari_werte(werte, art)

    # --- Stammdaten -------------------------------------------------------
    # Was an einem Objekt/Zimmertyp/Rate-Plan geändert wurde: Titel plus die
    # gesendeten Feldnamen. Die Feldnamen sind hier die Aussage — sie zeigen,
    # ob ein Push die Belegung, den Preis oder nur die Beschreibung anfasste.
    for schluessel in ("property", "room_type", "rate_plan", "hotel_policy"):
        rumpf = body.get(schluessel)
        if isinstance(rumpf, dict):
            titel = str(rumpf.get("title") or schluessel)
            felder = [k for k in rumpf if k not in {"title", "property_id", "id"}]
            if not felder:
                return titel
            gezeigt = ", ".join(sorted(felder)[:_MAX_POSTEN])
            rest = len(felder) - min(len(felder), _MAX_POSTEN)
            return (
                f"{titel} · {len(felder)} Felder · {gezeigt}"
                + (f" +{rest}" if rest else "")
            )

    return None
