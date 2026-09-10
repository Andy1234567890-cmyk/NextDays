"""Die Preise als LIVE-Kontext für den Produktberater.

WARUM NICHT EINGEBETTET wie das übrige Wissen: Die Beträge stehen in Stripe,
nicht in einer Textdatei — mit Ansage (`marketing/lib/preise.ts`): sie in die
24 Sprachdateien zu schreiben hieße, 24 Kopien einer Preisliste zu pflegen,
und beim ersten Preiswechsel bewirbt die Seite einen Preis, den die Abrechnung
nicht kennt (Wurzel 4).

Genau derselbe Fehler entstünde, wenn die Preise als Vektor-Wissensstück
abgelegt würden: eine eingefrorene Kopie, die niemand nachzieht. Ein Chatbot,
der „19,90 € im Monat" sagt, während Stripe 24,90 abrechnet, ist teurer als
einer, der es gar nicht weiß.

Deshalb: bei JEDER Preisfrage frisch geholt (der Endpunkt cacht 10 Minuten,
dieselbe TTL wie die Preisseite), als Text in den Prompt gelegt und mit der
Währung ausgewiesen, die tatsächlich geliefert wurde.

Fehlt die Preisliste (Stripe nicht erreichbar), gibt es KEINEN Preistext —
der Bot antwortet dann ohne Zahlen und übergibt an den Support, statt eine
plausible zu erfinden.
"""

from __future__ import annotations

from src.core.logging import get_logger

log = get_logger("nextdays.produktwissen.preise")

#: Wörter, die eine Preisfrage anzeigen. Bewusst mehrsprachig und knapp:
#: Der Preiskontext kostet einen zusätzlichen Aufruf, er soll nicht bei jeder
#: Frage anfallen. Falsch-positive sind harmlos (ein Absatz mehr im Prompt),
#: falsch-negative sind der eigentliche Schaden — deshalb im Zweifel drin.
_PREIS_WOERTER = (
    # de
    "kost", "preis", "tarif", "abo", "gebühr", "gebuehr", "provision",
    "teuer", "zahlen", "rechnung", "monatlich", "euro",
    # en
    "cost", "pric", "fee", "subscription", "commission", "plan", "billing",
    "expensive", "pay", "month",
    # weitere EU-Sprachen, die häufigsten Stämme
    "pris", "prix", "precio", "prezzo", "preço", "cena", "hind", "hinta",
    "ár", "kaina", "cijena", "cost", "tarif", "abonnement", "abonnemang",
)


#: Modulschlüssel → verständlicher Name.
#:
#: Ohne diese Zuordnung nennt der Bot die Datenbankschlüssel („modul3
#: buchhaltung") — am 10.09.2026 live gesehen. Die Namen sind bewusst hier
#: und nicht aus den Sprachdateien geholt: der Prompt ist ein interner Text,
#: die Antwort formuliert das Modell ohnehin in der Zielsprache neu. Ein
#: Nachladen der 24 Sprachdateien für sechs Wörter wäre Aufwand ohne Nutzen.
_MODULNAMEN = {
    "modul3_buchhaltung": "Buchhaltung (DATEV-/e-conomic-Export)",
    "modul4_mitarbeiter": "Mitarbeiter (Schicht- und Einsatzplanung)",
    "modul4_per_seat": "Mitarbeiter — je Nutzer",
    "modul6_hotel": "Hotel (Rezeptionsbetrieb, Front Desk)",
    "modul6_per_room": "Hotel — je Zimmer",
    "modul7_avatar": "Avatar (KI-Concierge mit Sprachsteuerung)",
}


def ist_preisfrage(frage: str) -> bool:
    """Grobe Vorauswahl, ob die Preisliste in den Prompt gehört."""
    klein = frage.lower()
    return any(w in klein for w in _PREIS_WOERTER)


def _betrag_cent(cent: int, waehrung: str) -> str:
    """Cent → lesbarer Betrag. Für die Stripe-Beträge (die stehen in Cent)."""
    return f"{cent / 100:.2f} {waehrung}".replace(".", ",")


def _betrag_einheit(wert: float, waehrung: str) -> str:
    """Schon in ganzer Währungseinheit → lesbarer Betrag.

    ZWEI Funktionen, weil die Preisliste ZWEI Einheiten mischt: die
    Stripe-Beträge (`flat_amount`, `unit_amount`, Module) kommen in Cent, der
    Provisionsdeckel kommt als `COMMISSION_CAP_EUR` in Euro. Beide durch 100 zu
    teilen machte aus 250 EUR Deckel „2,50 EUR" — am 10.09.2026 im Live-Test
    gesehen. Der Unterschied gehört in den Namen, nicht in einen Kommentar an
    der Aufrufstelle.
    """
    return f"{wert:.2f} {waehrung}".replace(".", ",")


def preistext(preisliste: dict | None) -> str | None:
    """Die Preisliste als Fließtext für den Prompt — oder None.

    None heißt: keine Preisangaben verfügbar. Der Aufrufer legt dann nichts
    bei; der Bot sagt, dass er die Preise nicht kennt (Wurzel 4/5).
    """
    if not preisliste:
        return None

    waehrung = preisliste.get("currency")
    stufen = preisliste.get("grundtarif_tiers") or []
    if not waehrung or not stufen:
        # Ohne Währung ist jeder Betrag bedeutungslos, ohne Staffel gibt es
        # keinen Grundpreis. Beides ist ein Datenfehler, kein Sonderfall.
        log.warning(
            "preistext_unvollstaendig",
            hat_waehrung=bool(waehrung),
            stufen=len(stufen),
        )
        return None

    zeilen: list[str] = ["Aktuelle Preise (live aus der Abrechnung):"]

    # Die Staffel ist „graduated": die erste Stufe ist der Grundbetrag, die
    # weiteren gelten je zusätzlichem Objekt bis zur jeweiligen Grenze.
    for i, stufe in enumerate(stufen):
        bis = stufe.get("up_to")
        pauschal = stufe.get("flat_amount")
        je_stueck = stufe.get("unit_amount")
        if i == 0 and pauschal is not None:
            zeilen.append(
                f"- Grundgebühr {_betrag_cent(pauschal, waehrung)} im Monat, "
                f"das erste Objekt ist enthalten."
            )
        elif je_stueck is not None:
            grenze = f"bis {bis} Objekte" if bis else "ab da"
            zeilen.append(
                f"- Jedes weitere Objekt {_betrag_cent(je_stueck, waehrung)} "
                f"im Monat ({grenze})."
            )

    markt = preisliste.get("commission_marketplace_percent")
    extern = preisliste.get("commission_external_percent")
    deckel = preisliste.get("commission_external_cap_amount")
    deckel_w = preisliste.get("commission_external_cap_currency")

    zeilen.append("- Buchungen über die eigene Website: 0 % Provision.")
    if extern is not None:
        satz = f"- Buchungen über Portale (Booking, Airbnb & Co.): {extern} % Provision"
        if deckel and deckel_w:
            satz += f", gedeckelt bei {_betrag_einheit(deckel, deckel_w)} im Monat"
        zeilen.append(satz + ".")
    if markt is not None:
        zeilen.append(f"- Buchungen über myBestDays: {markt} % Provision.")

    module = preisliste.get("modules") or []
    bezahlt = [m for m in module if m.get("unit_amount")]
    if bezahlt:
        zeilen.append("- Zusatzmodule (optional, monatlich):")
        for m in bezahlt:
            schluessel = m.get("module_key", "")
            name = _MODULNAMEN.get(schluessel, schluessel.replace("_", " "))
            je = m.get("per_unit_label")
            zusatz = f" je {je}" if je else ""
            zeilen.append(
                f"  · {name}: {_betrag_cent(m['unit_amount'], waehrung)}{zusatz}"
            )

    zeilen.append(
        "- 14 Tage kostenlos testen, keine Mindestlaufzeit, "
        "keine Einrichtungsgebühr. Alle Beträge netto zzgl. Umsatzsteuer."
    )
    return "\n".join(zeilen)
