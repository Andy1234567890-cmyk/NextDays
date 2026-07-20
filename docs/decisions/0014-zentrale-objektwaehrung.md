# ADR-0014: Zentrale Währung pro Objekt

- Status: **akzeptiert**
- Datum: 2026-07-20
- Migration: `0161_property_currency.sql`

## Kontext

Die Währung lag bisher ausschließlich je Preisplan (`rate_plans.currency`,
NOT NULL, kein Default seit Migration 0003). Es gab **keine zentrale Stelle**, an
der ein Betrieb die Währung eines Objekts einstellt. Folgen:

- Ein Objekt konnte pro Rate-Plan theoretisch verschiedene Währungen tragen,
  obwohl Channex **1 Objekt = 1 Währung** verlangt (`content_sync` pusht die
  Währung des ältesten Plans).
- Im Preise-Formular war die Währung nur im Basispreis-Editor versteckt und wurde
  pro Plan gesetzt — bei Hotel-Objekten mit mehreren Plänen (BAR/B&B/derived) gab
  es keine sichtbare, verbindliche Objektwährung.

Betrifft FeWo (i.d.R. 1 Plan) **und** Hotel (1 Objekt = 1 Zimmer, mehrere Pläne)
gleich — dasselbe Datenmodell (jede `properties`-Zeile = genau eine buchbare
Einheit).

## Entscheidung

Die Währung ist **zentral am Objekt** (`properties.currency`) und gilt für **alle**
Rate-Plans dieses Objekts.

- **DB:** `properties.currency` (ISO-4217, **nullable, kein Default** — keine
  erfundene EUR, Wurzel 4). Backfill aus dem ältesten Rate-Plan je Objekt (real
  existierende Werte, kein Raten). Objekte ohne Plan bleiben leer.
- **`rate_plans.currency` bleibt bestehen** (Bestandskompatibilität + Fallback),
  wird aber aus der Objektwährung abgeleitet/erzwungen — es ist nicht länger die
  Wahrheit.
- **Vererbung + Guard (`rates/service.py`):** Rate-Plan-Anlage/-Update übernimmt
  die Objektwährung; eine abweichende Währung im Request wird mit **422**
  abgewiesen (`_effective_currency`). Hat das Objekt noch keine zentrale Währung,
  wird sie beim ersten Basispreis-Setzen aus dem Request am Objekt festgeschrieben.
- **Gegenzustand (Wurzel 1):** Ändert der Nutzer die Objektwährung
  (`PATCH /properties/{id}`), ziehen **alle** Rate-Plans des Objekts mit
  (`_apply_currency_to_rate_plans`) und der Channex-Content wird neu synchronisiert.
  Die Preiszahlen bleiben unverändert (nur die Währung wechselt, keine erfundene
  Umrechnung).
- **Lese-Priorität (alles echte Werte, kein Fallback-Ersatz):** Objektwährung →
  Rate-Plan → leer. Umgesetzt in `pricing/resolver.py`,
  `channel_manager/content_sync.py`, `channel_manager/bookings_sync.py`. Der
  frühere `|| "EUR"`-Hardcode in `properties/service.py::publish` ist entfernt.
- **Frontend:** eigene Sektion „Währung des Objekts" oben im Preise-Formular
  (`pricing-form.tsx`), speichert `properties.currency`. Das Währungs-Select im
  Basispreis-Editor ist **read-only** (zeigt nur die Objektwährung).

## Konsequenz

- Genau eine Währungs-Wahrheit pro Objekt; Channex-Push konsistent.
- Kanon der wählbaren Währungen zentral in
  `owner_statements/currencies.py::SUPPORTED_CURRENCIES` (EU27+CH/GB plus
  USD/GBP), spiegelt `apps/web/lib/pricing-meta.ts::CURRENCY_OPTIONS`.
- Bestands-USD-Testobjekte auf dem Staging-Server wurden auf EUR korrigiert
  (Objekt **und** Rate-Plans) für den Booking.com-EUR-Testfall.
