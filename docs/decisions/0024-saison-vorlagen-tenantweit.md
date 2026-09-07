# ADR-0024: Saison-Vorlagen tenant-weit — eine Zeile, materialisiert über den Übertragungspfad

- Status: **ANGENOMMEN** (2026-09-07)
- Grundlage: Lastenheft §2.3 („globale Templates per Checkbox auf Unterkünfte“),
  Befund `docs/REQUIREMENTS-GAP.md` §2.3 („Template-Modell aus 0011 per 0053
  stillgelegt — Abweichung ohne ADR“), Plan `docs/PLAN-LASTENHEFT-LUECKEN.md`
  Etappe 3.
- Migrationen: 0584 (`season_templates` erweitert), 0583 (Sonder-Events:
  Objektzuweisung + Realtime, derselben Etappe).
- Betrifft: `apps/api/src/features/calendar/saison_vorlagen.py`,
  `calendar/service.py::saison_uebernehmen`, `calendar/router.py`
  (`/calendar/season-templates*`), `web/components/einstellungen/
  saison-vorlagen.tsx`, `web/components/objekte/als-vorlage-speichern.tsx`.

## Kontext: 0011 → 0053 → 0138

1. **0011** legte ein Vorlagenmodell mit vier Tabellen an: `season_templates`
   → `seasons` (Kategorie A–G, Farbe, Prozent) → `season_periods`, plus
   `season_assignments` (Vorlage ↔ Objekt). Preise sollten daraus zur Laufzeit
   gerechnet werden.
2. **0053** stellte fest: nichts liest diese Tabellen. Die eine Preis-Wahrheit
   war `price_overrides`, tagesgenau, vom Kalender gelesen, an Channex
   gepusht. Das Parallelmodell wurde per COMMENT deprecatet, nicht gelöscht.
3. **0138** baute die Saisons OBJEKTGEBUNDEN: `property_seasons` (Name, Farbe,
   percent|fixed, seit 0572/0576 auch Aufenthaltsregeln) und
   `property_season_assignments` (Zeiträume). Die Anwendung **materialisiert**
   je Tag nach `price_overrides` und pusht. Diese Tabellen sind die
   bearbeitbare Quelle, `price_overrides` das Ergebnis — ausdrücklich „KEINE
   Reaktivierung der 0011-Tabellen“.
4. Danach kam das Kopieren EINER Saison auf andere Objekte
   (`POST /calendar/seasons/{id}/apply`, `_apply_season_to_one`): Upsert auf
   `(property_id, name)`, Zeiträume ersetzen mit Freigabe der alten Tage,
   materialisieren, pushen — mit Grund-Slugs je übersprungenem Ziel.

Was fehlte: der Betrieb pflegt „Standard“ und „Skagen“ EINMAL und wendet
sie per Checkbox auf 18 Häuser an — als ganzen Satz aus mehreren Kategorien
mit Zeiträumen, nicht Saison für Saison.

## Entscheidung

1. **Die Vorlage ist eine eigenständige Definition in EINER Zeile.**
   `season_templates` (0011) wird erweitert (0584): `farbe`, `kategorien
   jsonb` (volle Regelsätze: name, mode, amount, color, min_stay, max_stay,
   closed_*_weekdays, min_stay_by_weekday), `zeitraeume jsonb`
   (`kategorie_index`, start_date, end_date inklusiv), UNIQUE `(tenant_id,
   name)`. Die Kindtabellen aus 0011 (`seasons`, `season_periods`,
   `season_assignments`) bleiben deprecatet und leer — keine Reaktivierung,
   kein Drop (nichts hängt daran, ein Drop wäre Aufwand ohne Nutzen).
2. **Anwenden = Materialisieren über den bestehenden Übertragungspfad.**
   `POST /calendar/season-templates/{id}/apply` mit `property_ids` und
   `zeitraeume_mitnehmen` ruft je (Objekt, Kategorie)
   `CalendarService.saison_uebernehmen` — die öffentliche Fassade von
   `_apply_season_to_one`. Damit gelten dieselben Zusagen wie beim
   Saison-Kopieren: Wurzel 2 (Upsert statt Dublette, der zweite Klick
   aktualisiert), Wurzel 1 (alte Zeiträume der gleichnamigen Ziel-Saison werden
   freigegeben, Overlaps rematerialisiert, Portale gepusht), Wurzel 4/5 (kein
   Basispreis → benannt übersprungen, nie ein erfundener Preis). Es gibt KEINE
   zweite Materialisierung.
3. **Kopie, keine Verknüpfung.** Nach dem Anwenden ist jede Saison am Objekt
   eigenständig (Hausmuster: Gebühren, Steuern, Aktionen, Saison-Kopie). Eine
   Änderung an der Vorlage wirkt erst beim nächsten Anwenden; das Löschen einer
   Vorlage nimmt keinem Objekt seine Saison. Eine „lebende“ Verknüpfung hätte
   den Materialisierungs-Gegenzustand an jeder Vorlagenänderung für alle
   Objekte verlangt — genau die Fehlerklasse aus Wurzel 1, für die es hier
   keinen fachlichen Bedarf gibt.
4. **Beide Richtungen.** „Als Vorlage speichern“ aus einem Objekt heraus
   (`POST /calendar/season-templates/from-property`) nimmt dessen Saisons +
   Zeiträume; gleicher Name → Update.
5. **Prozent UND Fixpreis** sind in Kategorien erlaubt. Anders als beim
   Kopieren einer einzelnen Saison (nur percent) ist die Vorlage eine
   bewusste Betriebsentscheidung für eine Gruppe vergleichbarer Objekte
   („Skagen“). Der Fixbetrag wird am Objekt in DESSEN Währung materialisiert;
   die Vorlagen-UI zeigt ihn ohne Währungssymbol (Wurzel 4).
6. **Sonder-Events** (0011 `events`/`event_periods`) sind KEINE Saisons und
   bleiben ein Faktor im Dynamic Pricing (`pricing/recompute.py`). Sie bekommen
   in derselben Etappe Schreibpfad, UI und eine Objektzuweisung
   (`event_property_assignments`, 0583; leer = alle Objekte). Ihr Gegenzustand
   ist der `recompute_property`-Job für ALTE und NEUE betroffene Objekte.

## Konsequenzen

- 0053 gilt weiter für die drei Kindtabellen; für `season_templates` ist die
  Stilllegung mit 0584 aufgehoben. Der COMMENT auf der Tabelle sagt das.
- Rechte: wie die Saison-Routen — Lesen `VIEW_CALENDAR`, Schreiben
  `MANAGE_CALENDAR` + `EDIT_CALENDAR_BOOKINGS`. RLS tenant (0015),
  Schreibpfad nur Server (revoke 0224), SELECT für `authenticated` und
  Realtime-Publikation (0584).
- Deckel (Wurzel 8): 50 Kategorien, 200 Zeiträume je 366 Tage, 200 Zielobjekte
  je Aufruf.
- Tests: `calendar/tests/test_saison_vorlagen.py` (idempotentes Anwenden,
  Basispreis des Ziels, Scope, Grund-Slugs, from-property),
  `calendar/tests/test_events.py`.
- UI: `/einstellungen/saison-vorlagen` (Liste, Anlegen, Bearbeiten, Anwenden
  mit Objekt-Checkboxen) und der Knopf „Als Vorlage speichern“ im
  Saison-Kalender des Objekts.
