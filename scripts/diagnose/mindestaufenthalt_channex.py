"""Channex-Seite der Mindestaufenthalt-Kette: settings.min_stay_type je Property.

Liest JSON von stdin (Antwort von GET /properties) und stellt den Wert je
Objekt dar. "both" ist der RICHTIGE Wert und wird nur informativ ausgewiesen. Am
23.08.2026 wurde "arrival" versucht und am gesendeten OTA-XML als schaedlich
belegt (GET /channel_events/{id}/logs): bei "arrival" sendet Channex die
through-Achse mit 1 und die arrival-Achse LEER an Booking.com — der
Mindestaufenthalt war damit aus. Bei "both" gehen beide Achsen mit dem echten
Wert raus.

Die Spalte "Mindestaufenthalt" in Bookings Ratenkategorie-Uebersicht zeigt den
gesendeten Wert NIE an: Booking laesst das Ratenplan-Feld bei
Channel-Manager-Raten absichtlich leer, weil ein Wert dort die tagesgenauen
Werte ueberschreiben wuerde. Sichtbar ist der echte Wert nur unter
Raten & Verfuegbarkeit -> Kalender -> Listenansicht -> Datum -> Rate ->
Einschraenkungen -> Mindestaufenthalt.
"""
import json
import os
import sys

filter_text = os.environ.get("FILTER", "").lower()
daten = json.load(sys.stdin)
zeilen = [
    p for p in daten.get("data", [])
    if not filter_text
    or filter_text in ((p.get("attributes") or {}).get("title") or "").lower()
]
if not zeilen:
    print("  keine Property passt auf den Filter")
    sys.exit(0)

schlecht = 0
for p in zeilen:
    attrs = p.get("attributes") or {}
    typ = (attrs.get("settings") or {}).get("min_stay_type", "(fehlt)")
    titel = (attrs.get("title") or "?")[:36]
    warnung = ""
    if typ == "arrival":
        warnung = "  <== ARRIVAL SCHALTET DEN MINDESTAUFENTHALT BEI BOOKING AUS"
        schlecht += 1
    print(f"  {titel:38s} {typ:9s} {p.get('id')}{warnung}")
print(f"\n  {len(zeilen)} Property(s), davon {schlecht} auf \"arrival\" (fehlerhaft).")
