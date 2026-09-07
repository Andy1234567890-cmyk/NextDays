# Handoff — Gastgeber-Multikalender, Stand 06.09.2026

Für die nächste Sitzung. Alles unten ist **uncommitted**. Zwei Migrationen sind
**live in der Datenbank** und lassen sich nicht durch Wegwerfen von Dateien
zurücknehmen — siehe Abschnitt 6.

---

## 1. Was der Auftrag war

„Analysiere mit Claude Chrome `https://www.airbnb.de/multicalendar` und baue
den Multikalender 1:1 nach."

Zwei Anläufe gingen daneben, weil zu früh gebaut und zu flach geschaut wurde.
Die Regel des Nutzers, wörtlich: **erst Airbnb vollständig ansehen, dann
bauen.** Sie gilt weiter. Der dritte Anlauf hat die Analyse zuerst gemacht.

---

## 2. Die Analyse

`docs/AIRBNB-MULTIKALENDER-ANALYSE.md` — vollständig, mit gemessenen Maßen und
Farben (nicht geschätzt), Aufbau aller drei Panel-Zustände, dem kompletten
Regel-Editor und einem Abgleich gegen unser Backend.

Aufgenommen **nur lesend** auf dem Produktivkonto des Nutzers: Dialoge geöffnet
und mit „Abbrechen" geschlossen, nie „Speichern", nie „Löschen".

**Offen geblieben** (Abschnitt K der Analyse): Was der Knopf „Speichern" auf
einer Regelsatz-Karte auslöst, „Regeln hinzufügen …" im Auswahl-Panel, „Diese
Reihe von Regeln löschen", und die Tastaturbedienung des Rasters.

---

## 3. Was gebaut ist

### Backend

| Datei | Was |
| --- | --- |
| `supabase/migrations/0571_property_units_nachziehen.sql` | **live**: jedes Objekt bekommt seine Einheit, plus Trigger für neue |
| `supabase/migrations/0572_regelsatz_saison_ausbau.sql` | **live**: Saison wird vollständiger Regelsatz |
| `apps/api/src/features/calendar/schemas.py` | `RegelsatzVerfuegbarkeit` (min/max stay, gesperrte Wochentage), `DayAvailability.max_stay` |
| `apps/api/src/features/calendar/service.py` | `_materialize_regeln`, `_clear_regeln`, `_push_regeln`, Tagesregel schlägt Objektregel, 422 statt stillem No-Op beim Mindestaufenthalt ohne Preisplan |
| `apps/api/src/features/calendar/router.py` | Regelsatz-Felder an `create_season` |
| `apps/api/src/features/property_discounts/*` | `season_id` am Rabatt inkl. Objekt-Scope-Prüfung |
| `apps/api/src/features/properties/service.py` | nur Textänderung an der 409-Meldung |
| `apps/api/src/features/payments/router.py` | `GET /payments/connect/country-requirements/{land}` |
| `apps/api/src/features/payouts/*` | Auszahlungszeilen tragen Objekt, Gast, Zeitraum, Kanal |

Der Regelsatz bündelt jetzt wie im Vorbild: Name, Farbe, Preisänderung,
Rabatte (über `season_id`), Mindest-/Höchstaufenthalt und gesperrte An-/
Abreise-Wochentage. Beim Zuweisen eines Zeitraums werden die Regeln **je Tag**
nach `availability` materialisiert und gebündelt an die Portale gemeldet; beim
Lösen zurückgenommen.

### Frontend (`gastgeber`)

Neu:

```
app/(dashboard)/kalender/page.tsx
components/kalender/multi-kalender.tsx      Raster, Seitenleiste, Kopf, Ebenen
components/kalender/bearbeiten-panel.tsx    „Ausgewählte Reisedaten"
components/kalender/buchung-panel.tsx       Buchungsdetails + private Notiz
components/kalender/saison-panel.tsx        Regelsatz-Liste (Standardansicht)
components/kalender/regelsatz-karte.tsx     eine Karte mit allen Regelzeilen
components/kalender/regelsatz-editor.tsx    Dialog wie „Regeln bearbeiten"
components/kalender/filter-panel.tsx        Inserats-Filter
lib/kalender.ts  lib/kalender-actions.ts  lib/kalender-datum.ts  lib/kalender-mass.ts
```

Geändert: `components/host-topnav.tsx` (Kalender-Tab), `app/globals.css`
(Farb-Tokens `--color-buchung`, `--color-buchung-fahl`).

Gemessene Maße stehen in `lib/kalender-mass.ts`: Spalte 80 px, Zeile 48 px,
Seitenleiste 280 px, Panel 368 px, Balken 24 px als Pille, Balken beginnt in
der Mitte des Anreisetages (`left = idx×80 + 40 + 2`, `width = Nächte×80 − 4`).

---

## 4. Vorher am selben Tag gebaut (ebenfalls uncommitted)

Diese Arbeit hatte der Nutzer abgenommen, sie hängt nicht am Kalender:

- **Stripe im Gastgeber-Konto**: `components/konto/stripe-einrichtung.tsx`,
  vier Schritte bis zur Freischaltung, offene Anforderungen mit rohem
  Stripe-Pfad, Zustimmung als Dialog.
- **Reiter „Kontostand"**: `components/konto/kontostand-tab.tsx` und
  `components/kalender/…`-fremdes `geldweg-karten.tsx` (Flip-Karten).
- **Vermieterdaten** privat/gewerblich statt nur gewerblich:
  `components/konto/unternehmen-tab.tsx`.
- **Livegang-Sperre ohne Stripe**: `components/objekt-publish.tsx`,
  Dashboard-Karte in `app/(dashboard)/page.tsx`.
- **Konto-Zeilen wieder klickbar**: `components/konto/konto-zeile.tsx` — die
  Zeitzone ließ sich nicht einstellen, weil `pointer-events-none` auf der
  ganzen gedimmten Zeile lag.

---

## 5. Prüfstand

| Gate | Ergebnis |
| --- | --- |
| `bunx tsc --noEmit` (gastgeber) | sauber |
| `bun run lint` (gastgeber) | 0 Fehler, 3 alte Warnungen |
| `node scripts/i18n/pruefe-uebersetzungen.mjs gastgeber` | 1923 Keys × 44 Sprachen, 0 fehlerhaft |
| `node scripts/diagnose/tote-knoepfe-pruefen.mjs` | keine Attrappen |
| `pytest src/features/calendar properties property_discounts payouts payments` | grün |
| `ruff` / `pylint` auf berührten Modulen | sauber, 10.00 |

Live geprüft (Claude Chrome, eingeloggt als Demo-Gastgeber): Raster,
Rechteck-Auswahl über Objekte × Tage, Preis setzen und zurücknehmen, Sperren
und Freigeben, Filter, Saison-Ebene, Saison zuweisen, Regelsatz mit
Aufenthaltsregeln über die API.

**Nicht mehr geprüft**: die letzte Design-Anpassung der Karte (Radius 12 px,
Farbfleck mit 10 % Deckkraft, Name fett) — die Chrome-Erweiterung war zu dem
Zeitpunkt getrennt.

---

## 6. Was NICHT durch Wegwerfen zurückgeht

1. **Migration 0571 ist live.** Sie hat 70 Objekten ihre fehlende Einheit
   gegeben und einen Trigger auf `properties` gesetzt. Ohne sie scheitert
   jede Kalendersperre mit einem rohen 500 — auch im PMS.
2. **Migration 0572 ist live.** Neue Spalten an `property_seasons`,
   `property_discounts.season_id`, `availability.min_stay/max_stay`. Alle
   NULL-bar; Bestand unverändert.
3. **Der Migrationslauf hat zwei FREMDE offene Migrationen mitgespielt**:
   `0572_module_freischaltung` und `0573_schloesser_seam`. Die lagen
   unangewendet im Ordner; `supabase/apply-migrations.sh` nimmt alles Offene.
   Das war nicht beabsichtigt und gehört geprüft.
4. **Nummernkollision**: es gibt zwei Dateien mit Präfix `0572`. Angewendet
   sind beide unter ihrem vollen Namen, technisch läuft es.

---

## 7. Bekannte offene Punkte

- Die Regelsatz-Karte hat **keinen** „Speichern"-Knopf. Bei Airbnb gibt es ihn,
  was er tut ließ sich ohne Klick auf dem Produktivkonto nicht feststellen.
  Ein Knopf mit geratener Wirkung wäre eine Attrappe.
- „Verfügbare Chancen" (Airbnbs Empfehlungs-Engine) und die **private Notiz je
  Kalendertag** fehlen: für Letztere hat `availability` keine Spalte.
- Der Mindestaufenthalt im Auswahl-Panel geht weiterhin über
  `/calendar/bulk-edit` und gilt damit **objektweit**. Der Panel-Text sagt das
  ausdrücklich. Der neue per-Tag-Weg existiert, hängt aber am Regelsatz.
- `rate_plan_min_stay_overrides` (Hotel, plan-genau) und der neue
  `availability.min_stay` (Objekt-Ebene) stehen nebeneinander. Für ein Hotel
  mit mehreren Plänen ist noch nicht entschieden, welcher gewinnt.

---

## 8. Arbeitsregeln, die in dieser Sitzung teuer waren

- **Erst Airbnb ansehen, dann bauen.** Zweimal missachtet, zweimal umsonst
  gebaut.
- **RAM messen mit `top -l 1 -o mem`, nicht mit `ps rss`.** `ps` zeigte 0,15 GB
  für einen Dev-Server, der real 3,5 GB belegte. Der Rechner hat 8 GB.
- **Dev-Server nach langen Läufen neu starten.** Der gastgeber-Server war nach
  vier Stunden bei 3,6 GB.
- **`tsc` und `lint` einmal am Ende**, nicht nach jedem Schritt.
- **Claude Chrome, nicht der Debug-Port.** Ausdrückliche Ansage des Nutzers.
  Der Debug-Chrome aus früheren Sitzungen lief mit und wurde beendet.
- Klicks der Erweiterung erreichen `localhost:3300` nicht zuverlässig
  (`pointerdown` kommt nicht an). Was funktioniert: `element.click()` bzw.
  `PointerEvent`-Sequenzen über `javascript_tool`.
- Der lokale `STRIPE_SECRET_KEY` ist ein **Live**-Schlüssel.

---

## 9. Demo-Zugang

```
developer@mynextdays.dk
*zKBrBG!tjT18SQBEBY3TerY
```

Tenant `cd962b7d-1d31-5412-9525-6b92cb5288b4`, `account_type='marketplace'`,
20 Objekte, alle Entwürfe ohne Preisplan. Testdaten aus dieser Sitzung
(Saison, vier Rabatte, Preis-Overrides, Sperren) sind **alle zurückgenommen**.
