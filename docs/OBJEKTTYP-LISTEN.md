# Objekttyp-Struktur (Airbnb ∪ Booking, vereint)

Drei abhängige Dropdowns + Zusatzfelder. Ebene 2 hängt von Ebene 1 ab, Ebene 3
variiert je Kategorie. Feintypen = Vereinigung aus Airbnb + Booking (Dubletten
entfernt). Booking-eigene Typen (Pension, Gasthof, Motel, Riad …) in die passende
Kategorie einsortiert.

## 1. Kategorie (Welcher Ort ähnelt Ihrem am meisten?)

- Wohnung
- Haus
- Sekundäreinheit
- Einzigartiger Raum
- Übernachtung mit Frühstück
- Hotel & Betriebe

## 2. Immobilientyp (abhängig von Kategorie)

**Wohnung:**
- Mietwohnung
- Eigentumswohnung
- Loft
- Serviced Apartment
- Casa particular
- Ferienwohnung

**Haus:**
- Heim
- Reihenhaus
- Bungalow
- Kabine
- Chalet
- Lehmhaus
- Hütte
- Leuchtturm
- Villa
- Kuppel
- Cottage
- Bauernhofurlaub
- Hausboot
- Minihaus
- Landhaus
- Ferienpark

**Sekundäreinheit:**
- Gästehaus
- Gäste-Suite

**Einzigartiger Raum:**
- Boot
- Schloss
- Höhle
- Erdhaus
- Hütte
- Iglu
- Insel
- Leuchtturm
- Flugzeug
- Wohnmobil / Camper
- Zelt
- Tipi
- Zug
- Baumhaus
- Jurte
- Kuppel
- Scheune
- Campingplatz / Stellplatz
- Windmühle
- Sonstiges

**Übernachtung mit Frühstück:**
- Bed & Breakfast
- Naturlodge
- Bauernhofurlaub

**Hotel & Betriebe:**
- Hotel
- Hotel garni
- Boutique-Hotel
- Aparthotel
- Hostel
- Pension / Gästehaus
- Gasthof
- Motel
- Resort
- Nature lodge
- Riad
- Ryokan

## 3. Angebotsart

- Der gesamte Ort
- Zimmer
- Geteiltes Zimmer

Sonderfälle:
- Bed & Breakfast / Naturlodge: nur „Zimmer" + „Geteiltes Zimmer"
- Bauernhofurlaub: alle drei

## 4. Zusatzfeld nur bei „Hotel & Betriebe"

- Wie viele Zimmer hat Ihre Unterkunft insgesamt? → 2-5 / 6-10 / 11-20 /
  21-30 / 31-40 / 41-50 / 50+

## 5. Zusatzfelder (alle Kategorien)

- Wie viele Stockwerke hat das Gebäude? (Stepper)
- In welcher Etage befindet sich das Angebot? (Stepper)
- Baujahr
- Wohnfläche + Einheit
