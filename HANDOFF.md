# Handoff — Airbnb-Anbindung (Stand 05.08.2026)

**Nichts ist committet.** Der Nutzer committet selbst; nur ein wörtliches
„committe" autorisiert das.

---

## 1. Zwei harte Regeln, die in dieser Sitzung verletzt wurden

**Keine Schreibaufrufe an Live-Daten zum Ausprobieren.**
Ich habe `POST v2/listing_rooms` gegen die echte Airbnb-Anzeige „FeWo Lille
Lægehus" gesendet, um zu sehen, ob der Endpunkt existiert. Ergebnis: ein
zusätzliches Schlafzimmer (`817187121`) in der Live-Anzeige, `bedrooms` sprang
von 1 auf 2. Airbnb hat **kein** Löschen über die API (DELETE → 404,
`PUT v2/listings/{id}` → 200 ohne Wirkung, `api_proxy` → 404). Der Nutzer hat es
im Extranet entfernt; per API gemessen ist der Stand wieder korrekt (6 Zimmer,
`bedrooms: 1`).
→ Endpunkt-Existenz nie durch Schreiben prüfen. Nur lesen, oder gar nicht.

**`200` von Channex/Airbnb beweist nichts.**
Belegt und mehrfach reproduziert:
- `PUT channels/{id}` mit `rate_plans` → 200, speichert **nichts**
- `PUT v2/listings/{id}` → 200, ändert **nichts**
- `channels/{id}/execute/<name>` → 200 „Success" auf **jeden** Namen, auch auf
  `voelliger_unsinn_xyz123`
→ Nach jedem Schreibvorgang zurücklesen. Kontrolltest gegen einen Unsinns-Pfad
(erwartet 404 `route_not_found`) beweist, dass eine 200 echt ist.

---

## 2. Was gebaut und live gemessen ist

### Ausstattung
- Vollständige Zuordnung Airbnb → unsere zwei Kataloge (139-Merkmale-Katalog
  plus 15 Schlüssel, die im echten Konto vorkamen und beim ersten Durchlauf
  unter `airbnb_ausstattung_ohne_zuordnung` protokolliert wurden).
- 18/18 Objekte neu eingelesen. „Perlen" ging von 6+26 auf 7+36 Merkmale.
- Spaltenzuordnung: `EIGENE_AUSSTATTUNG_OBJEKT` in `web/lib/property-meta.ts`
  hält fest, welches eigene Merkmal in `amenities` statt `room_amenities`
  gehört. Ein Test misst das gegen die Backend-Tabellen.
- `nd_*` heißt **nur** „Channex kennt es nicht" — nicht „Airbnb kennt es nicht".
  Ein großer Teil davon sind Airbnb-Merkmale (Parkvarianten, Hängematte,
  Mülltrennung …). Der alte Kommentar behauptete das Gegenteil.

### Zimmer und Schlafgelegenheiten
- Airbnb liefert sie über Channex' `action/listing_details` (`rooms[]` mit
  `beds`). Airbnbs eigenes `v2/listings/{id}` hat `rooms: null` — dort steht es
  nicht.
- Der Import schrieb nach `type_attributes.rooms`; **gelesen** wird aber die
  Tabelle `property_rooms`. Deshalb stand „Noch keine Zimmer", obwohl Werte in
  der Spalte lagen. Jetzt schreibt `_zimmer_zeilen_anlegen` in die Tabelle,
  per Differenz (nur Fehlende einfügen, Überzählige löschen).
- `tenant_id` ist bei `property_rooms` NOT NULL — fehlte im Insert, 500er.

### Preise
- Der Preis geht raus, live gemessen: Grundpreis 950 DKK, Kanal-Plan +5 % →
  997,50 bei Channex, Airbnb zeigt 997. **Die Rundung macht Airbnb** (DKK ohne
  Nachkommastellen), nicht wir.
- Der Abruf las den Preis nur aus der Mapping-Antwort; die trägt ihn nicht
  immer. `listing_details` führte ihn (`default_daily_price: 504`) — jetzt als
  zweite belegte Quelle (`ersatz_preisteil`).

### Voller Abgleich statt Erstbefüllung (Wurzel 1)
Betten, Zimmer und die `airbnb*`-Spiegel wurden nur gefüllt, wenn leer. Eine
Änderung bei Airbnb kam damit nie an (2 Schlafsofas → 1 blieb bei 2). Jetzt
wird abgeglichen. **`base_price` bewusst ausgenommen**: der Resolver rechnet die
Kindkurve immer aus der Elternkurve plus Offset — die Spalte im Kind ist eine
tote Kopie, sie zu schreiben wäre eine zweite Preis-Wahrheit.

---

## 3. Behobene Ursachen (nicht Symptome)

| Symptom | Ursache |
|---|---|
| „Duplication in Rate Plan title" | Der Sync suchte vorhandene Channex-Pläne nur über unsere Map-Tabelle. Fehlte die Zeile, legte er neu an → Titel belegt. Jetzt Titel-Suche bei Channex vor dem Anlegen. Zwei verwaiste Pläne gelöscht (mit Zustimmung, zurückgelesen). |
| Aufschlag ging an kein Portal | `_swap_channel_rate_plan` fand keinen Eintrag zum Tauschen, loggte und kehrte **still** zurück. Jetzt wird die Zuordnung über `POST …/mappings` angelegt. |
| Speichern tat nichts | Das Frontend verglich mit dem Wert in **unserer** DB und sendete bei Gleichheit nichts. „Bei uns gleich" ≠ „beim Portal angekommen". |
| 422 „rate plan already exists" | Mein eigener Fehler: neu angelegt, obwohl zugeordnet. Die `rate_plan_id` steht im Kanal-Eintrag neben einer eigenen Mapping-`id`. Jetzt Ziel-Prüfung zuerst; „already exists" gilt als Zielzustand. |
| Rauswurf zum Login-Bildschirm | `getMe()` machte aus **jedem** Fehler `null` — 503/500/Timeout sah aus wie „abgemeldet". Neu: `getSession()` unterscheidet; nur 401/403 melden ab. |
| Zwei Preispläne in der Liste | Kanal-Pläne (`portal_scope`) gehören in „Preisänderung je Portal". Sie machten das Objekt zudem fälschlich zum Multi-Plan-Objekt, wodurch die Grundpreis-Eingabe verschwand. |
| Massenübernahme im Einzel-Dialog | „Objekte übernehmen" (alle 18) erschien auch bei gewähltem Objekt. Jetzt nur ohne `propertyId`. `objectImportMsg` wird in `reset()` geleert. |

i18n: 24 Sprachen × (5 + 9 eigene Merkmale, 10 + 6 Feld-Labels, 1 Zimmertyp).
Die Feldnamen der Erfolgsmeldung kommen aus **vier** Backend-Quellen — die UI
fällt jetzt auf den Rohnamen zurück statt abzustürzen.

---

## 4. Offen

1. **Bildunterschriften**: Hin- und Rückweg funktionieren (17/17 importiert,
   dieselben 17 bei Channex mit `description`). Aber nur **2 von 18 Objekten**
   haben überhaupt Fotos bei uns (49 statt 426) — die anderen 16 wurden nie
   abgerufen. Außerdem sind einige Airbnb-Captions Dateinamen-Müll
   (`379e224d dc79 4576…`, `0 B2 A9711`) und gehen unverändert an die Portale.
2. **Dritter Rate-Plan bei Grævlinge**: `3d92b34e…` mit ebenfalls 997,50, vom
   Steuer-Sync angelegt (`channex_kanalplan_fuer_steuer_angelegt`). Zwei
   Kanal-Pläne mit gleichem Preis sind einer zu viel.
3. **`send_to_portals: false`** steht bei beiden Plänen von Grævlinge. Beim
   Kanal-Plan gewollt (läuft über `portal_scope`), beim Grundplan fraglich.
4. **19 von 57 gemessenen Airbnb-Ausstattungsschlüsseln** haben weiter kein
   Gegenstück (`SKI_IN_SKI_OUT`, `LAUNDROMAT_NEARBY` …) — protokolliert, nicht
   geraten.
5. **Airbnb-Rückweg der Ausstattung ist NICHT belegt.** `airbnb_ausstattung_
   schreiben` benutzt `PUT v2/listings/{id}` — genau den Aufruf, der 200 ohne
   Wirkung liefert. Import und Nutzlast-Aufbau sind gemessen, der Schreibpfad
   nur durch Tests gedeckt. Ich habe ihn früher als „verbunden" bezeichnet; das
   war nicht gedeckt.
6. **DNS-Störung** gegen `supabase-kong.65.21.144.136.sslip.io` aus dem
   Supabase-Client, reproduzierbar. Umgangen durch direkte httpx-Aufrufe.

---

## 5. Arbeitsweise

- Deutsch. Keine `&&`/`;`-Ketten in Bash — ein Befehl pro Aufruf.
- Doku unter `docs/OTA/Airbnb` **vor** jeder Änderung lesen (8 PDFs + 3 YAMLs).
  Die dokumentierten Schreibwege sind ausschließlich:
  `PUT channels/{id}/execute/update_booking_setting`,
  `…/update_availability_rule`, `…/update_pricing_settings`,
  `POST channels/{id}/action/api_proxy`, `POST live_feed/{id}/resolve`.
  Zimmer, Betten und Ausstattung stehen in **keinem** davon.
- DB-Zugriff nur über SSH (`root@65.21.144.136`); Migrationen über
  `supabase/apply-migrations.sh`.
- Gate vor „fertig": `pytest` (1653 grün), `ruff check`, `pylint` 10.00/10 auf
  geänderten Modulen, `tsc --noEmit` + `bun run lint` (0 Fehler) in `web`.

## 6. Geänderte Dateien

**Backend** (`apps/api/src/`): `features/channel_manager/airbnb_direkt.py`,
`airbnb_listing_import.py`, `airbnb_objekt_abruf.py`, `airbnb_uebernahme.py`,
`objekt_kanal.py`, `content_sync.py`, `abgaben_status.py`,
`tests/test_airbnb_ausstattung.py`, `tests/test_airbnb_objekt_abruf.py`,
`features/properties/service.py`, `jobs/queue.py`, `worker.py`

**Frontend** (`web/`): `lib/property-meta.ts`, `lib/use-amenity-labels.ts`,
`lib/auth.ts`, `components/objekte/property-overview.tsx`, `pricing-form.tsx`,
`policies-form.tsx`, `property-sync.tsx`,
`components/channel-manager/channel-connect-button.tsx`,
`app/(dashboard)/layout.tsx`, `messages/*.json` (24 Sprachen)

**Migrationen** (live eingespielt): `0284_airbnb_anfragen_live_feed.sql`,
`0285_diagnose_leseregel_fail_closed.sql`,
`0286_airbnb_titel_intern_trennen.sql`
