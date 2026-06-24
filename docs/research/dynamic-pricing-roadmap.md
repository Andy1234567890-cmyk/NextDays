# Roadmap: Auslastungs-Pricing auf Wettbewerbsniveau + KI ab Tag 1

> Stand: 2026-06-24. Grundlage: [dynamic-pricing-wettbewerb.md](dynamic-pricing-wettbewerb.md)
> (verifizierte Wettbewerbsrecherche) + geklärte Markt-Quellen-Strategie.
> Ziel: Den Auslastungs-Faktor unserer Engine
> ([apps/api/src/features/pricing/engine.py](../../apps/api/src/features/pricing/engine.py))
> von rein reaktiv (Ist-Belegung) auf antizipativ (Pickup/Vorlauf/Markt) heben und
> die Datenbasis fürs KI-Lernen ab dem ersten Tag aufzubauen.

## Strategische Entscheidungen (getroffen)

**Markt-Quelle:**
- **Jetzt:** Markt = eigene Plattform-Daten (SiteMinder-Prinzip). Der Vermieter wählt
  5–10 vergleichbare Plattform-Objekte (Comp-Set), deren echte Raten bilden den
  Markt-Median. 100 % legal, kostenlos, wächst mit jedem Vermieter.
- **Später:** Booking.com **Market Insights API** (offizieller Demand-Daten-Feed für
  Connectivity-Partner — genau das, was SiteMinder nutzt), sobald NextDays selbst
  Booking-Connectivity-Partner ist. Channex bleibt bis dahin reiner Channel-Sync;
  Channex reicht KEINE Marktdaten durch (faktisch geprüft).
- **Optional:** AirDNA-Datenpartner (Provider bereits angelegt) für breite Abdeckung.

**Warum kein Booking-Scraping:** SiteMinder selbst betont „no scraped data" — deren
Konkurrenz-Daten kommen aus dem offiziellen Booking Market Insights API + eigenem
Plattform-Datenpool. Scraping verstößt gegen Booking-AGB und ist instabil.

**Architektur-Vorteil:** Das `MarketSignalProvider`-Interface
([market/base.py](../../apps/api/src/features/pricing/market/base.py)) ist bereits ein
Plugin-Pattern. `MarketDay.comp_price` + `comp_refs` (Comp-Set) + `engine._market_factor`
(MPI: eigener Preis vs. Markt-Median) sind schon eingebaut — es fehlt nur die
Daten-Speisung. Jede neue Quelle = eine neue Provider-Klasse, kein Umbau.

## Phasen

### Phase 1 — Engine-Korrekturen (markt-unabhängig, sofort wirksam)

| # | Änderung | Beleg (Recherche) |
|---|---|---|
| 1.1 | **Anti-Über-Rabattierung**: bei mehreren Rabatten gilt der größte (nicht alle multiplizieren); Aufschläge stapeln; gemischt = größter Rabatt + Aufschlag | PriceLabs-Konfliktregel; unsere reine Multiplikation kann zu stark rabattieren (Last-Minute × Orphan × Auslastung) |
| 1.2 | **Asymmetrische Caps**: Rabatt bis −20 %, Aufschlag bis +15 % (getrennte Parameter) | PriceLabs-Default; „Auslastung füllen" wichtiger als „Spitze abschöpfen" |
| 1.3 | **Vorlauf-Buckets**: Auslastungs-Faktor wirkt je nach Tagen-bis-Anreise unterschiedlich stark (nahe Buckets reagieren stärker) | PriceLabs „horizontal occupancy" pro Buchungsfenster-Bucket |

Vollständig durch Unit-Tests in `tests/test_engine.py` absicherbar (reine Funktionen).

### Phase 2 — Pickup-Erfassung & -Faktor (KI-Fundament ab Tag 1)

| # | Änderung |
|---|---|
| 2.1 | **`dp_pickup_snapshots`** (neue Tabelle) + täglicher Job: hält pro `(property_id, anreisedatum)` die Zahl gebuchter Nächte + Preis fest. Quelle: `reservations` (check_in/check_out/created_at vorhanden). **Läuft ab Tag 1** → baut Lernhistorie auf. |
| 2.2 | **Pickup-Velocity-Faktor** in der Engine: füllt sich ein Datum schneller als der Schnitt (Tag-über-Tag-Delta der Vorausbelegung) → Aufschlag, bevor es voll ist. | Beyond/Wheelhouse-Signal |

### Phase 3 — Markt aus eigener Plattform (Markt-Faktor ab Tag 1 aktiv)

| # | Änderung |
|---|---|
| 3.1 | **`PlatformProvider`** (neuer Markt-Provider): Comp-Set = vom Vermieter gewählte Plattform-Objekte; deren echte Tagespreise → `comp_price` (Markt-Median pro Tag). MPI (`_market_factor`) greift damit. |
| 3.2 | **Comp-Set-Auswahl-UI**: Vermieter wählt 5–10 Vergleichsobjekte (`comp_refs` existiert im Edit-Sheet bereits). |

### Phase 4 — Echtes KI-Lernen (datengetrieben, wenn Historie trägt) ✅ umgesetzt

| # | Änderung | Status |
|---|---|---|
| 4.1 | Lern-Datensatz aus `dp_pickup_snapshots` (täglicher Snapshot je Objekt/Anreisetag). | ✅ [forecast.py](../../apps/api/src/features/pricing/forecast.py) |
| 4.2 | Erwartete **Pickup-Kurve pro Objekt/Saison** (Anreise-Monat × Vorlauf-Bucket) gelernt → Ist-vs-Erwartung treibt den Preis (Beyond-Ansatz). Ersetzt das grobe Phase-2-Velocity-Signal, wo die Kurve trägt. | ✅ `PickupCurveModel` |
| 4.3 | Preiselastizität — verschoben: braucht gepreiste Buchungs-Outcomes mit Varianz, die erst mit Datenmasse entstehen (Cold-Start: `_MIN_OBSERVATIONS`). | ⏳ später |

**Cold-Start (keine Fallbacks):** Unter `_MIN_OBSERVATIONS=8` Beobachtungen je Zelle
liefert das Modell KEIN Signal (None) → die Engine bleibt dort neutral, statt einen
Erwartungswert zu erfinden. Mit jeder Nacht Snapshots wächst die Abdeckung.

### Phase 5 — RateBoard-Bausteine (eigene Plattform, Booking später) ✅ umgesetzt

| # | Änderung | Status |
|---|---|---|
| 5.1 | **Autopilot** (`dp_settings.autopilot_enabled`): berechnete Preise automatisch an OTAs pushen, oder nur als Empfehlung halten. enabled = rechnen, autopilot = veröffentlichen. | ✅ Push-Gate im Recompute |
| 5.2 | **Wetter-Faktor** via DWD/Bright Sky (amtlich, frei, kein Key): gutes Wetter am Anreisetag → Aufschlag, gedeckelt. Nur im Forecast-Horizont (~10 Tage), ferne Tage neutral. | ✅ [weather.py](../../apps/api/src/features/pricing/weather.py) |
| 5.3 | **Rate Rules** (`dp_settings.rate_rules`): manuelle Regeln (weekday/month/Vorlauf-Fenster → adjust_pct), als bewusster Override OBENDRAUF auf die Auto-Faktoren (KI + Fachwissen). | ✅ engine `_rate_rules_factor` |

> Realität (Stand 2026-06): erst ~13 Buchungen / 2 Tage Historie in der DB. Echtes
> Lernen braucht Masse — deshalb startet Phase 2 die Erfassung SOFORT, damit Phase 4
> später überhaupt möglich wird. „KI ab Tag 1" = Datenerfassung + Markt-Signal ab Tag 1,
> nicht ein trainiertes Modell ab Tag 1.

## Reihenfolge & Risiko

| Phase | Aufwand | Risiko | Sofort-Effekt |
|---|---|---|---|
| 1.1 Anti-Über-Rabattierung | klein | niedrig | Korrektheit |
| 1.2 Asymmetrie | klein | niedrig | ja |
| 1.3 Vorlauf-Buckets | mittel | mittel | ja |
| 2 Pickup | mittel | mittel | Daten ab sofort, Preis-Effekt wächst |
| 3 Plattform-Markt | mittel | mittel | Markt-Faktor aktiv |
| 4 KI-Lernen | groß | hoch | erst mit Datenmasse |

## Gap zur heutigen Engine

- Auslastung: reaktiv (Ist-Belegung ±15 Tage) → **antizipativ** (Pickup + Vorlauf-Buckets).
- Kombination: alle Faktoren multiplikativ → **Anti-Über-Rabattierung**.
- Symmetrisch → **asymmetrisch**.
- Markt: nur Slot vorhanden → **mit eigenen Plattform-Daten gespeist**.
- Kein Lernen → **Pickup-Erfassung ab Tag 1** als Fundament.
