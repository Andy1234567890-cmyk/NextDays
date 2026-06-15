# ADR-0007: Universelles Unterkunfts-Ökosystem (property_type)

- Status: **akzeptiert**
- Datum: 2026-06-15

## Kontext

Lastenheft-Ergänzung (§7.2): NextDays soll nicht nur klassische Ferienhäuser,
sondern **jede Art von Kurzzeitvermietung weltweit** abbilden (Glamping, Tiny
Houses, Wohnmobilstellplätze, Hausboote, …). Ein Beherbergungs-Typ steuert
Checklisten, Shortcodes und Onboarding-Schritte.

## Entscheidung

- Neues Pflichtfeld **`properties.property_type`** (Enum), gesetzt beim Anlegen:
  `ferienhaus`, `appartement`, `glamping`, `tiny_house`, `stellplatz`, `hausboot`
  (erweiterbar).
- **Typ-spezifische Daten** als `properties.type_attributes` (`jsonb`) — flexibel,
  ohne pro Typ eine eigene Tabelle. Beispiele:
  - Glamping/Tiny House: Whirlpool/Sauna-Wartung, Brennholz-Option,
    wetterabhängige Sonder-Saisons.
  - Stellplatz: QR-Check-in, Stellplatznummer-Pool, Schranken-Öffnungscode.
  - Hausboot: Liegeplatz-Vorschriften, Fäkalientank, Stromversorgung.
- **Typ steuert Templates:** Checklisten- und Shortcode-Vorlagen sowie die
  Onboarding-Schritte werden über den `property_type` ausgewählt (Template-Mapping),
  nicht hartkodiert.

## Optionen

- **A) Eine Tabelle pro Typ** — starr, viele Joins, schlecht erweiterbar. Verworfen.
- **B) Enum + jsonb `type_attributes` (gewählt)** — ein Modell, flexibel, neue Typen
  ohne Schema-Migration der Detailfelder. Validierung der jsonb-Struktur im Service
  (Pydantic) pro Typ.
- **C) EAV (Entity-Attribute-Value)** — überkomplex für den Bedarf. Verworfen.

## Konsequenz

- Migration: `property_type`-Enum + `type_attributes jsonb` an `properties`.
- `properties`-Slice validiert `type_attributes` typabhängig (explizite Pydantic-
  Modelle pro Typ — kein `Any`).
- Checklisten/Shortcodes/Onboarding referenzieren `property_type` über
  Template-Tabellen (siehe Datenmodell-Erweiterung in REQUIREMENTS-GAP.md).
- DK-Spezifika (BFE/CPR/Boligtype) bleiben nullable — nur für DK-Ferienhäuser
  relevant, global nicht erzwungen.
