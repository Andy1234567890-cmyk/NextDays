# Recherche: Auslastungsbasiertes Dynamic Pricing der Wettbewerber

> Stand: 2026-06-24. Quelle: Multi-Source-Recherche mit adversarialer Verifikation
> (21 Behauptungen bestätigt, 4 widerlegt). Primärquellen: PriceLabs-Hilfe-Doku,
> Beyond-Blog, Wheelhouse-Engine-Artikel (2020), AirDNA-Doku.
> Zweck: Best Practices für den **Auslastungs-Faktor** unserer eigenen Engine
> ([apps/api/src/features/pricing/engine.py](../../apps/api/src/features/pricing/engine.py)).

## Kernbefund

Auslastungsbasierte Preisgestaltung wird durchweg als **prozentualer, multiplikativer
Faktor** relativ zu einem Basispreis umgesetzt, **gedeckelt durch Min/Max**. Zwei
dominierende Mechaniken:

**(A) Markt-relativ** (PriceLabs „Market-Driven", Wheelhouse) — eigene Belegung gegen
**Markt-Belegung** im ~60-Tage-Vorlauffenster. Über Markt → Aufschlag, unter Markt →
Rabatt. PriceLabs nennt das MPI (Market Penetration Index = eigene ÷ Markt-Belegung;
Farbschwellen: Rot <80 %, Gelb 80–100 %, Grün 100–120 %, Blau >120 %).

**(B) Eigene Belegung pro Buchungsfenster-Bucket** (PriceLabs Manual/Portfolio) —
Belegung in sequenziellen Vorlauf-Buckets (Tag 0–15, 16–30, 31–60), je Bucket eine
eigene Schwellen-Tabelle. **Nahe Buckets reagieren stärker.**

## Konkrete, belegte Zahlen (übernehmbar)

| Mechanik | Beleg (PriceLabs-Doku, konfigurierbare Defaults) |
|---|---|
| Hohe Belegung nah | 97 % am Tag 0 → **+15 %** Aufschlag |
| Niedrige Belegung nah | 27 % am Tag 15 → **−10 %** Rabatt (Pickup fördern) |
| Asymmetrische Caps | Rabatte bis **−20 %**, Aufschläge bis **+15 %** |
| Last-Minute (Default) | **30 %** Rabatt graduell über die nächsten **15 Tage** |
| Orphan-Gap (Default) | **20 %** Rabatt bei 1–2 freien Tagen zwischen Buchungen |
| Wheelhouse-Multiplikator | „Normalnachfrage" (~40 % Markt-Belegung) = 1,0; darüber grob
  linear, dann exponentiell; bei Niedrignachfrage nur leicht runter, nicht unter Floor |

## Zwei entscheidende Erkenntnisse

1. **Pickup/Velocity statt nur Ist-Belegung** (Beyond, Wheelhouse): Sie messen die
   **Tag-über-Tag-Änderung der Vorausbelegung** (wie schnell sich ein Datum füllt) und
   heben den Preis, **sobald ein Anstieg kommt** — antizipativ, nicht erst wenn voll.
   Wheelhouse: Booking-Pace gegen dasselbe Fenster im Vorjahr.

2. **Konfliktauflösung gegen Über-Rabattierung** (PriceLabs): NICHT alle Prozente
   addieren/multiplizieren. Regel: *mehrere Rabatte → nur der größte gilt; mehrere
   Aufschläge → alle stapeln; gemischt → größter Rabatt + Aufschlag.* Worked Example:
   drei Rabatte 40/30/20 % → nur 40 % gilt.

## Stacking & Leitplanken (Konsens)

- Auslastungsfaktor **stapelt** auf Saison, Wochentag, Event/Feiertag.
- Immer **Min/Max-Clamp**.
- **Fixpreis-Override** deaktiviert die Auslastungsanpassung (manuell gewinnt).
- **Asymmetrie ist Absicht**: runter aggressiver als rauf (Auslastung füllen wichtiger
  als Spitzen abschöpfen).

## Wichtige Caveats

- **Beyond** veröffentlicht KEINE Zahlen/Kurven (proprietär) — nur die Mechanik.
- **Wheelhouse**-Zahlen sind von 2020, evtl. nachjustiert.
- **AirDNA Rates** beschreibt Occupancy-Mechanik nicht explizit — nur Comp-Set/Guardrail.
- **DPGO, Airbnb Smart Pricing, Hostaway, Lodgify, Guesty**: in den verifizierten
  Claims KEINE belastbaren Mechanik-Details (nicht ausreichend recherchiert).
- Single-Unit-Ferienwohnungen: Eigenbelegung springt 0/100 % → PriceLabs weicht hier
  auf Markt-/Portfolio-Belegung aus. **Für uns relevant** (viele Objekte sind Single-Unit).
- Widerlegt (NICHT übernehmen): Beyonds „Availability Yielding/Seasonal Pacing",
  Wheelhouse-„RevPAR-Fokus", div. Blog-Preis-/Positionierungsaussagen.

## Gap-Analyse vs. unsere Engine (Stand 2026-06)

| Aspekt | Unsere Engine | Best Practice | Lücke |
|---|---|---|---|
| Auslastungssignal | Ist-Belegung ±15 Tage, Pivot 0.5 | + Vorlauf-Buckets + Pickup-Velocity | **antizipativ fehlt** |
| Markt-relativ | nur bei `market_enabled` | MPI (eigene vs. Markt) | ok, ausbaubar |
| Faktor-Kombination | **alle multiplikativ** | „größter Rabatt gilt" | **Über-Rabattierung** |
| Asymmetrie | symmetrisch (±sensitivity) | runter > rauf | **fehlt** |
| Min/Max-Clamp | vorhanden | Standard | ok |
| Lernen aus Historie | keins | Pickup-Kurven, Elastizität | **Daten-Erfassung fehlt** |

## Quellen (Primär)

- PriceLabs — Occupancy Based Adjustments: https://help.pricelabs.co/portal/en/kb/articles/occupancy-based-adjustments
- PriceLabs — Portfolio Occupancy Based Adjustments: https://help.pricelabs.co/portal/en/kb/articles/portfolio-occupancy-based-adjustments
- PriceLabs — Pricing Customizations: https://help.pricelabs.co/portal/en/kb/articles/pricing-customizations
- PriceLabs — How PriceLabs works (MPI): https://hello.pricelabs.co/blog/how-pricelabs-works-understanding-its-various-metrics-and-graphs/
- Beyond — How the algorithm works: https://www.beyondpricing.com/eu-blog/how-beyonds-dynamic-pricing-algorithm-works-for-you
- Wheelhouse — Pricing Engine (2020): https://medium.com/wheelhouse/wheelhouse-pricing-engine-98dd9170d275
- AirDNA Rates: https://help.airdna.co/en/articles/10011583-airdna-rates
