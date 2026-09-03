"""Bookings Gebuehrenart-Kataloge — reine Daten, kein Verhalten.

AUS `gebuehren_quelle.py` HERAUSGEZOGEN (03.09.2026), als der vollstaendige
Extranet-Katalog dazukam und jene Datei die Zeilengrenze riss. Die Trennung ist
nicht nur Kosmetik: hier stehen ABGELESENE Werte, dort die Logik. Wer eine Art
nachtraegt, aendert Daten und keinen Code — und sieht in diesen drei Namen
sofort, in welche der drei Kategorien sie gehoert.

Herkunft der Werte: Booking-Extranet, Unterkunft -> Richtlinien -> „Weitere
Gebuehren und Kosten", Auswahlfeld „Gebuehrenart". Booking bietet dort GENAU
diese Arten an — es ist kein Freitextfeld, die Liste ist also endlich.
"""

from __future__ import annotations

_BOOKING_ARTEN = {
    # VOLLSTÄNDIGER Katalog aus dem Booking-Extranet, abgelesen am 03.09.2026
    # (Unterkunft → Richtlinien → „Weitere Gebühren und Kosten", Auswahlfeld
    # „Gebührenart"). Booking bietet dort GENAU DIESE Arten an — es ist kein
    # Freitextfeld. Die Liste ist damit endlich und hier abbildbar.
    #
    # WARUM VOLLSTÄNDIG UND NICHT NUR DIE BEKANNTEN: bis 03.09.2026 standen
    # hier vier Arten (Reinigung, Resort, Haustier, Wäsche). Die übrigen neun
    # fielen in das `portal:<name>`-Auffangnetz — und eine so erzeugte Art
    # entsteht erst zur LAUFZEIT, ist also in der Zuordnungsmaske nicht
    # anlegbar. Die Abrechnung verlangte dann eine Zuordnung, die niemand
    # vornehmen konnte: bei Feriehus Kornblomst (Booking 5522296055) blockierte
    # „Stromkosten" die Auszahlung, und die Meldung nannte einen Wert
    # (`portal:stromkosten`), der in keiner Tabelle steht.
    #
    # WARUM DER NAME UND KEIN SCHLÜSSEL: Booking liefert keinen brauchbaren.
    # Live gemessen über 82 Posten: `code` 14 trägt Reinigung, Resort UND Strom;
    # er ist nicht einmal stabil typisiert (14, 19, 3, 5034 — und in zwei Fällen
    # steht dort wörtlich „Haustiergebühr"). `charge_frequency` ist nur
    # „je Nacht/je Aufenthalt". Der Anzeigename ist die einzige Unterscheidung.
    #
    # Deutsch UND Englisch je Art, weil der Name in der Sprache des INSERATS
    # kommt: derselbe Betrieb führt Objekte mit deutschem und englischem
    # Anzeigenamen (belegt: „Reinigungsgebühr" 25 Buchungen, „Cleaning fee" 11).
    # Dänisch dort, wo der Betrieb Objekte auf Dänisch führt.
    #
    # Die Zielwerte sind BESTEHENDE Katalogwerte (`FEE_TYPE_CATEGORY` in
    # `properties/gebuehren.py`) — keine neue Art wird hier erfunden.
    # ---- Servicegebühr ----
    "servicegebühr": "service_fee",
    "service fee": "service_fee",
    # ---- Resortgebühr ----
    "resortgebühr": "resort",
    "resort fee": "resort",
    # ---- Reinigung ----
    "reinigung": "cleaning_fee",
    "reinigungsgebühr": "cleaning_fee",
    "cleaning": "cleaning_fee",
    "cleaning fee": "cleaning_fee",
    "rengøringsgebyr": "cleaning_fee",
    "rengøring": "cleaning_fee",
    # ---- Handtücher ----
    "handtücher": "linens_bath",
    "towels": "linens_bath",
    "håndklæder": "linens_bath",
    # ---- Strom ----
    "strom": "electricity",
    "stromkosten": "electricity",
    "electricity": "electricity",
    "elektrizität": "electricity",
    "strøm": "electricity",
    # ---- Bettwäsche ----
    "bettwäsche": "linens_bed",
    "bed linen": "linens_bed",
    "sengelinned": "linens_bed",
    # Wäschegebühr allgemein (nicht im Dropdown, aber im Bestand). Zielwert
    # `linens` und NICHT `linen_fee`: letzteres stand hier seit Einführung,
    # existiert aber in KEINER der beiden Katalogkarten
    # (`FEE_TYPE_CATEGORY`/`FEE_TYPE_ALTBESTAND` in `properties/gebuehren.py`) —
    # `fee_category` hätte dafür `None` geliefert, also keine Kategorie und
    # damit keine Portal-Zuordnung. Live noch nie vorgekommen (03.09.2026 in
    # fee_classification, reservation_portal_gebuehren und den Stammdaten
    # geprüft: kein Treffer), der Fehler war also latent.
    "wäschegebühr": "linens",
    "linen fee": "linens",
    # ---- Gas ----
    "gas": "gas",
    # ---- Öl ----
    "öl": "oil",
    "oil": "oil",
    "olie": "oil",
    # ---- Holz ----
    "holz": "wood",
    "wood": "wood",
    "træ": "wood",
    # ---- Wasserverbrauch ----
    "wasserverbrauch": "water",
    "water usage": "water",
    "water": "water",
    "vandforbrug": "water",
    # ---- Transfergebühr ----
    "transfergebühr": "transportation",
    "transfer fee": "transportation",
    # ---- Haustiergebühr (nicht im Dropdown, aber live vorhanden) ----
    "haustiergebühr": "pet_fee",
    "pet fee": "pet_fee",
}

# Arten aus dem Booking-Dropdown, die KEINE Gebühr des Betriebs sind, sondern
# eingesammelt und weitergeleitet werden: sie gehören nicht in die
# Eigentümer-Auszahlung, sondern werden wie die Mehrwertsteuer übersprungen
# (Entscheidung des Betreibers, 03.09.2026).
#
# Warum getrennt von `_BOOKING_ARTEN` und nicht mit einem Steuer-Zielwert:
# beide Wege enden verschieden. Eine Gebühr braucht eine Zuordnung („wem
# gehört sie?"), eine Abgabe braucht keine — sie ist durchlaufend. Stünden sie
# in derselben Karte, verlangte die Abrechnung für die Kurtaxe eine
# Zuordnungsentscheidung, die es sachlich nicht gibt.
# STEUERN in Bookings Preisaufstellung, erkannt am NAMEN.
#
# Warum nicht am `type`-Feld: dort steht bei ALLEN 82 Posten „Inclusive"
# (gemessen 03.09.2026) — es unterscheidet nichts. Warum nicht am `code`:
# Gebühren tragen 14, die Mehrwertsteuer 19, die Übernachtungssteuer 3 — das
# sieht nach einer Regel aus, ist aber nirgends dokumentiert, und derselbe
# `code` 14 trägt schon drei verschiedene Arten. Ein undokumentiertes
# Zahlenfeld als Steuer-Entscheidung zu nehmen hiesse, eine Steuer bei einer
# Code-Änderung still als Eigentümer-Ertrag zu verbuchen.
#
# Der Name traegt „(25%)" mit, deshalb Praefix-Vergleich und keine
# Gleichheit: Booking setzt den Satz in den Anzeigenamen.
_BOOKING_STEUER_NAMEN = (
    "mehrwertsteuer",
    "value added tax",
    "vat",
    "übernachtungssteuer",
    "overnight tax",
    "city tax",
    "tourist tax",
    "sales tax",
    "goods and services tax",
    "gst",
)


_BOOKING_ABGABEN_NAMEN = frozenset({
    "kurtaxe",
    "city tax",
    "tourist tax",
    "kurafgift",
    "umweltabgabe",
    "environmental fee",
    "environmental tax",
    "miljøafgift",
})
