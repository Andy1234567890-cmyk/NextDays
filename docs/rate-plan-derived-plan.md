# Preispläne nach SiteMinder-Modell — Umsetzungsplan (manual + derived)

Stand: 2026-07-17 · Status: PLAN (freigegeben wird phasenweise) · UI/UX-Referenz:
SiteMinder-Plattform (Screenshots des Nutzers, verbindlich; ans myNextDays-Branding
angleichen, nicht 1:1 kopieren). Datenmodell unverändert: **1 property = 1 buchbare
Einheit**; mehrere Rate-Pläne hängen am selben Objekt.

## 0. Recherche-Fundament (3 parallele Recherchen, 2026-07-17)

**Channex-API (docs.channex.io, HTML):** Channex kann derived nativ
(`rate_mode: derived|cascade`, `parent_rate_plan_id`, `derived_option.rate` mit 4
Operationen `increase/decrease_by_amount|percent`, sequentiell, Dezimal-Strings;
`inherit_*`-Flags **default-true** sobald Parent gesetzt; Push auf den Parent
propagiert automatisch). Nicht dokumentiert: Rundung, Push auf Kind-Plan,
Parent-Löschung, Ableitungstiefe.

**SiteMinder-Semantik (help-platform.siteminder.com, Volltexte):**
- Offset-Modi: Amount | Percentage | **Amount then percentage** | Keep rates the
  same. Wert ohne Vorzeichen + Richtungs-Dropdown (Increase/Decrease) je Modifikator.
- Reihenfolge: **erst Betrag, dann Prozent** — „+$25 −15%" = (Basis+25)·0,85.
- Grid: abgeleitete Preiszellen **ausgegraut + read-only** (Verboten-Icon bei
  Klick), Ketten-Icon + „Quell-Rate + Offset"-Text.
- Ableitung betrifft **nur Preise** — Restriktionen (Min/Max-Stay, Stop-Sell)
  bleiben pro Plan eigenständig pflegbar. Extra-Gast-Aufschläge werden NICHT abgeleitet.
- Cloudbeds: **keine Kaskade** (derived von derived unsupported), Parent nicht
  löschbar solange referenziert, Ergebnis ≤ 0 → Einheit unverkäuflich (fail-closed).
- **Kein System dokumentiert eine Rundungsregel** → wir definieren sie selbst.
- SiteMinder-PMS-Regel (wörtlich): „If you set up derived rates in your PMS, you
  must set the rate configuration in SiteMinder to **Manual**" — Doppel-Ableitung
  (PMS UND Channel-Manager) ist der dokumentierte Hauptfehler.

**Code-Kartierung:** Resolver `pricing/resolver.py:304/326/359`, rates-Slice
komplett (router/service/schemas), Push `ari_push.py:1026 push_rates_batch` +
`:1140 reconcile_rate_plan_prices` + `full_sync.py:248`, Grid-UI
`views/rates-view.tsx` (PlanRow, Drag-Auswahl, Inline-Editor), View-Registry
`calendar-views.tsx:39 VIEWS`, Wizard-Muster `channel-connect-button.tsx:33`
(4-Schritt-Modal), Realtime-Abos vorhanden.

## 1. Architektur-Entscheidung: Ableitung rechnet LOKAL, Channex bleibt „manual"

Der PMS-Resolver ist die einzige Preis-Wahrheit. Abgeleitete Pläne werden lokal
berechnet und ihre fertigen Tages-Kurven wie bisher pro Plan an Channex gepusht
(`rate_mode: "manual"` für ALLE Channex-Rate-Plans, unverändert).

Begründung (kein Nutzer-Entscheid nötig, folgt zwingend aus der Recherche):
1. SiteMinders eigene PMS-Regel: Ableitung in genau EINEM System, sonst
   Doppel-Ableitung.
2. Channex' Rundung ist undokumentiert → OTA-Preis könnte von unserem
   Plattform-/Booking-Engine-Preis abweichen (Wurzel-4-Verstoß: zwei Wahrheiten).
3. Booking-Engine/Plattform/Portal rufen den Resolver ohnehin lokal — die
   Ableitungslogik bräuchten wir also in jedem Fall.
4. Alle bestehenden Push-/Reconcile-/Drift-Heil-Pfade (`push_rates_batch`,
   `reconcile_rate_plan_prices`, `rate_plan_sync_state`) funktionieren unverändert
   weiter, weil jeder Plan weiter seine eigene Kurve bekommt.

## 2. Ableitungs-Semantik (verbindlich)

- **Modi:** `rate_mode ∈ {manual, derived}` pro Plan.
- **Parent:** `derived_from_rate_plan_id` → Plan **desselben Objekts**, Parent
  MUSS `manual` sein (**keine Kaskade**, wie Cloudbeds; Channex-Tiefe undokumentiert).
- **Offsets:** `offset_amount` (signiert, Währungseinheit) und `offset_percent`
  (signiert) — beide optional, beide kombinierbar, beide null = „Keep rates the
  same" (1:1-Spiegel).
- **Formel (Reihenfolge wie SiteMinder):**
  `preis(d) = round2( (parent_effektiv(d) + offset_amount) × (1 + offset_percent/100) )`
  – `parent_effektiv(d)` = volle Resolver-Kurve des Parents (inkl. dessen
  Datumspreisen/override/dynamic/weekday/base).
  – Rundung: kaufmännisch auf 2 Nachkommastellen (dokumentiert, deterministisch).
- **Fail-closed (Wurzel 4/5):** Ergebnis ≤ 0 oder Parent-Tag ohne Preis → Tag hat
  KEINEN Preis (wird beim Push übersprungen wie heute „kein 0-€-Verkauf"), kein
  Clamp, kein Fantasie-Boden.
- **Währung:** Kind erbt IMMER die Parent-Währung (create/update erzwingt Gleichheit, 422).
- **Nur Preise werden abgeleitet.** Min-Stay-/Restriktions-/Stop-Sell-Pflege pro
  Plan (0150/0152/0153) bleibt für derived Pläne voll editierbar.
- **Datumspreise auf derived Plänen:** in v1 verboten (422) — Grid-Zellen
  read-only. (SiteMinder-Datums-Offset-Overrides = v2.)

## 3. Datenbank — Migration 0157 (nicht auto-einspielen)

```sql
alter table public.rate_plans
  add column rate_mode text not null default 'manual'
    check (rate_mode in ('manual','derived')),
  add column derived_from_rate_plan_id uuid
    references public.rate_plans(id) on delete restrict,
  add column offset_amount numeric(10,2),
  add column offset_percent numeric(7,3);

alter table public.rate_plans add constraint rate_plans_derived_consistent check (
  (rate_mode = 'manual' and derived_from_rate_plan_id is null
    and offset_amount is null and offset_percent is null)
  or
  (rate_mode = 'derived' and derived_from_rate_plan_id is not null
    and derived_from_rate_plan_id <> id)
);
```

- `on delete restrict` = DB-Backstop gegen Parent-Löschung mit Kindern (Service
  antwortet 409 mit klarer Meldung).
- Gleiches Objekt + Parent-ist-manual wird im Service erzwungen (load_scoped,
  Wurzel 3); RLS der Tabelle bleibt unverändert gültig (keine neue Tabelle).

## 4. Backend

### 4.1 Resolver (`pricing/resolver.py`)
- `effective_prices(..., rate_plan_id)` und `effective_price(...)`: ist der Plan
  derived → Parent-Kurve auflösen (ein zusätzlicher Lookup), Formel anwenden,
  Quelle `"derived"` je Tag ausweisen. `effective_prices_bulk` (ohne
  rate_plan_id) bleibt unberührt.

### 4.2 rates-Slice
- `schemas.py`: `rate_mode`, `derived_from_rate_plan_id`, `offset_amount`,
  `offset_percent` in Create/Update/Response; `RateGridPlan` + `rate_mode`,
  `derived_from_name`, Offsets, `price_read_only`-Flag.
- `service.py create/update`: Guards — Parent gehört demselben Objekt (sonst 404
  via scoped load), Parent ist manual (422 „Kaskade nicht unterstützt"), Währung
  = Parent-Währung (422), Titel eindeutig je Objekt (422, Channex-Zwang).
  `update` erlaubt manual→derived und zurück (danach Voll-Reconcile des Plans
  enqueuen).
- `service.py delete`: Parent mit Kindern → 409 („Zuerst abgeleitete Pläne
  löschen oder umhängen").
- `set_prices` auf derived → 422. `set_min_stays`/`set_restrictions` bleiben erlaubt.
- **Propagation (Wurzel 1):** JEDER Punkt, der heute einen Rate-Push für Plan X
  enqueued (`_enqueue_rate_plan_push`, `set_base_price`, `set_prices`,
  `clear_all_prices`, Dynamic-Pricing-Recompute), enqueued zusätzlich Pushes für
  alle derived-Kinder von X (eine Query). `reconcile_rate_plan_prices` und
  `full_sync` nutzen den Resolver und decken Kinder damit automatisch ab.

### 4.3 Channel-Manager
- `content_sync._upsert_channex_rate_plan`: bleibt `rate_mode: "manual"` für alle
  Pläne + Kommentar mit der SiteMinder-PMS-Regel (bewusst KEIN Channex-derived).
- Push-Pfade unverändert (Kurve pro Plan).

## 5. Frontend

### 5.1 Ansicht „Preise & Bestand" (Umbau `views/rates-view.tsx`, SiteMinder-Inventory-Grid)
- `hotelOnly`-Gate am `rates`-Eintrag in `calendar-views.tsx:39` entfernen (auch
  FeWo profitieren; Preise werden NUR hier gepflegt — Nutzer-Entscheid).
- **Objekt-Kopfzeile** je Objekt: Titel + VERFÜGBARKEIT-Zeile (read-only
  Status-Punkte frei/belegt/gesperrt pro Tag aus availability; Belegung wird im
  Belegungsplan gepflegt, NICHT hier — Nutzer: „kein hotel system zeigt die
  preise im belegungsplan an", umgekehrt gilt das auch) + Ein-/Ausklappen („Hide").
- **Rate-Plan-Zeilen** darunter:
  - manual: Zellen editierbar wie heute (Drag-Auswahl + Inline-Editor bleibt).
  - derived: Zellen **ausgegraut, read-only** (berechneter Preis sichtbar),
    Ketten-Icon + Badge „Abgeleitet von {Parent} · +25 € · −15 %"; Klick zeigt
    Tooltip statt Editor. Min-Stay-/Restriktions-Modus bleibt editierbar.
- **Quick-Bulk-Update** (Popover wie Screenshot): Wert, Von–Bis (einschließlich),
  **Wochentags-Chips Mo–So**, „+ weiteren Zeitraum". Backend: die drei
  PUT-Endpunkte (`/prices`, `/min-stays`, `/restrictions`) bekommen ein optionales
  `weekdays`-Feld (Liste 0–6); Server expandiert Bereich × Maske (harte
  Obergrenze bleibt, Wurzel 8).
- Realtime: bestehende Abos decken rate_plans-Änderungen bereits ab.

### 5.2 Preisplan-Verwaltung im Objekt-Tab (`pricing-form.tsx`)
- multiPlanHint-Card ersetzen durch **Preisplan-Liste** (Stil SiteMinder
  „Rate plans", eine Zeile pro Plan): Name · Modus-Badge (Manuell / Abgeleitet
  von X +25 € −15 %) · Grundpreis bzw. „berechnet" · Min-Stay · Sync-Status ·
  Aktionen (Bearbeiten, Löschen mit 409-Handling).
- Button „Preisplan anlegen" → Wizard. Deep-Link „Preise pflegen" →
  `/kalender?view=rates`.
- Ein-Plan-Fall: bisheriges Grundpreis-Feld bleibt + Liste/Anlegen-Button.

### 5.3 Wizard „Preisplan anlegen" (Dialog, Muster `channel-connect-button.tsx`)
4 Schritte (SiteMinder-Step „Direct Booking Controls" entfällt in v1 — kein
Pendant, als v2 notiert):
1. **Allgemein:** Name (eindeutig je Objekt, live geprüft).
2. **Aufenthalt:** Mindestaufenthalt (Standard; datumsgenau weiter im Grid).
3. **Preisgestaltung:** Währung (aus Objekt/Parent, nur Anzeige — Wurzel 4);
   Radio „Preise manuell pflegen" / „Von einem Basis-Plan ableiten"; bei
   Ableitung: Parent-Auswahl (nur manuelle Pläne), Betrag-Feld + Richtung,
   Prozent-Feld + Richtung, Hinweis „erst Betrag, dann Prozent",
   **Live-Vorschau** (Basis 100 € → Ergebnis); bei Manuell: Grundpreis.
4. **Prüfen & Speichern:** Zusammenfassung.

### 5.4 i18n
Neue Keys (ratesView-Grid, Plan-Liste, Wizard) zuerst DE+EN, `tsc`, committen,
DANACH die 22 Sprachen (Memory-Workflow). Nie „Channex" im UI („Portale").

## 6. Phasen (strikt sequenziell, jede Phase mit Gates + Freigabe)

| Phase | Inhalt | Gates |
|---|---|---|
| P1 | Migration 0157 + Resolver-derived + rates-Slice (Guards, Propagation-Enqueue) + Tests | pytest, ruff, pylint 10; Migration NICHT eingespielt |
| P2 | Deploy P1 + Migration einspielen + **Live-Verifikation** am Objekt 956747c8: derived Plan anlegen, Kurve bei Channex gegenlesen (PUT+GET, relationships!) | Live-Beweis |
| P3 | Grid-Umbau rates-view (Verfügbarkeitszeile, derived read-only, Bulk-Popover + weekdays-API) | tsc web, Realtime-Check |
| P4 | Wizard + Preisplan-Liste im Objekt-Tab | tsc, Screenshots |
| P5 | i18n DE/EN→22 · 2 Review-Loops · Doku (Architektur/ER) · Deploy | alle Gates |

## 7. Bewusste v1-Grenzen (v2-Kandidaten)
- Datums-Offset-Overrides auf derived Plänen (SiteMinder „+Add rate override").
- Direct-Booking-Controls (Applicable/Advertised dates, Dynamic discounts).
- Verpflegungs-Inklusionen (meal_type) am Plan.
- Kaskade (derived von derived) — bewusst verboten.
- Extra-Gast-Aufschläge pro Plan (heute property-weit) — wie SiteMinder nicht abgeleitet.

## 8. Testplan (Kern)
- Resolver: Betrag-dann-Prozent, Rundung, ≤0 → kein Preis, Parent-Datumspreis
  propagiert, Spiegel (beide Offsets null), Parent ohne Preis → Kind ohne Preis.
- Service: Parent fremdes Objekt (404), Parent derived (422), Währung ungleich
  (422), Titel-Duplikat (422), Parent löschen mit Kind (409), set_prices auf
  derived (422), manual→derived Umschalten enqueued Reconcile.
- Propagation: set_prices/set_base_price am Parent enqueued Kind-Pushes.
- Grid-API: derived Plan liefert berechnete Kurve + price_read_only.
- weekdays-Expansion: Maske × Bereich, Obergrenze 422.
