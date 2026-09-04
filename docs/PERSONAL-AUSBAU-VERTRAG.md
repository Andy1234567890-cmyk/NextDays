# Personal-Ausbau 04.09.2026 — Schnittstellenvertrag und Dateibesitz

Freigabe des Betreibers am 04.09.2026: alle Taskilo-Lücken nachziehen, Hotel-
Zeile (Anreisen / Abreisen / Gäste im Haus / Belegung) über dem Dienstplan,
Gastromatic-Funktionsumfang (Kennzahlen je Bereich, Bedarfsplanung, Umsatzbuch,
Terminal, zweistufige Genehmigung, Auswertungen/Listen, Lohnlauf) und KI über
Google Cloud (Vertex AI Gemini für Erklärung/Assistent, OR-Tools für die
Zuteilung). Datenmodell: Migrationen **0544–0548, live eingespielt**.

Dieses Dokument ist der Vertrag zwischen den parallel arbeitenden Bau-Paketen.
Wer eine Form hier ändert, ändert sie HIER zuerst. Alles, was nicht hier steht,
folgt den bestehenden Mustern des Slice `personal` (0541/0543):

* Dienste erben von `PersonalBase` (`_base.py`), laden per ID ausschließlich
  über gescopte Helfer (`_require_person_im_scope`, `_own_*`), werfen
  `PersonalError(message, status_code, details={"code": ...})`.
* Router: eigene `APIRouter()` je Paket **ohne prefix** (der Hauptrouter
  `router.py` inkludiert sie unter `/personal`), Guards wie in `router.py`
  (`Manage`, `Plan`, `Team`, `Own`, `Time`, `Absence`, `Approve`, `Confirm`,
  `Export` — aus `router.py` importieren: `from .router import Manage, ...`
  ist NICHT möglich (Zirkel) → die Annotated-Guards in `_guards.py` anlegen,
  siehe unten „Gemeinsame Dateien").
* Tests mit `tests/_fake.py` (`FakeDB`, `ctx()`), Datei `tests/test_<paket>.py`.
* Geld immer in Minor + `currency`; fehlt sie → `None` + Hinweis, nie Ersatz.
* Fremde Zeitpunkte aus der Quelle, nicht `created_at` (Wurzel 5b).
* Alle Realtime-Tabellen: `grant select` + restriktive Policy sind in den
  Migrationen gesetzt; Finanztabellen (umsatzbuch, budget, lohnlaeufe,
  prognosen, planungslaeufe) haben KEINEN Grant → nach eigener Aktion
  `router.refresh()`/Nachladen, kein Abo.

---

## 0. Gemeinsame Dateien und Besitz

| Datei | Besitzer | Regel für andere |
|---|---|---|
| `apps/api/src/features/personal/router.py`, `dependencies.py` | Integrator | nicht anfassen; jedes Paket liefert `<paket>_router.py` mit `router = APIRouter()` und Service-Factory in `<paket>.py` |
| `_guards.py` (neu, Integrator legt an) | Integrator | `from ._guards import Manage, Plan, Team, Own, Time, Absence, Approve, Confirm, Export, Current, fehler` |
| `schemas.py` | B1: `RegelnSet`/`Regeln`/`RegelVorschlag`, `WochenplanResponse`, `PlanPerson`, `Schicht`, `Abwesenheit`, `AbwesenheitCreate`; B3: `Akte`, `AkteUpdate`, `Zeiterfassung`, `StempelStart` | nur mit `Edit` (String-Ersetzung), nie `Write`; neue Klassen in die EIGENE `<paket>_schemas.py` |
| `_base.py` | B1 (`_regeln`, `Regeln`-Dataclass in `regelwerk.py`) | andere lesen `_regeln_row()` für Felder, die nicht in `Regeln` stehen |
| `regelwerk.py` | B1 | B2 importiert Funktionen, ändert nichts |
| `schichten.py`, `abwesenheiten.py`, `laender.py`, `tick.py` | B1 | — |
| `zeiterfassung.py`, `service.py` (Akte), `kartei.py` | B3 | — |
| `auswertung.py` | B4 | B2 importiert `_satz`-Logik über eine öffentliche Funktion `kosten_satz(akte, firma)` die B4 anlegt; bis dahin lokal rechnen |
| `benachrichtigungen.py` | niemand | neue Meldungen in `benachrichtigungen_planung.py` (B1) bzw. `benachrichtigungen_zeit.py` (B3) |
| `scripts/i18n/mail_texte_personal.de.json` | B1, B3 (nur neue Schlüssel anhängen, `Edit`) | Integrator generiert + übersetzt |
| `apps/api/src/features/site_config/ki_nutzung.py` (`FUNKTIONEN`) | B2 | die drei Namen aus 0546 |
| `web/lib/personal.ts`, `web/lib/personal-typen.ts`, `web/lib/personal-zeit.ts` | niemand | jedes Frontend-Paket legt `web/lib/personal-<paket>.ts` (`"use server"`, NUR async functions) und `web/lib/personal-<paket>-typen.ts` an |
| `web/messages/de.json` und alle Sprachdateien | Integrator | Pakete schreiben Deutsch nach `web/messages/_neu/<paket>.de.json` (verschachteltes Objekt unter `personal`), Integrator merged und übersetzt |
| `web/components/app-sidebar.tsx`, `web/lib/rollen-guard.ts` | Integrator | Pakete nennen im Abschlussbericht ihre Routen + Capability |
| `web/components/personal/dienstplan*.tsx`, `schicht-dialog.tsx`, `konflikte.ts` | F1 | — |
| `web/components/personal/zeiterfassung.tsx`, `abwesenheiten.tsx`, `mitarbeiter-akte.tsx`, `akte-*.tsx`, `personal-einstellungen.tsx`, `kartei-helfer.tsx` | F2 | — |
| `web/components/personal/berichte/**`, `lohn/**` | F3 | — |
| `web/app/(dashboard)/hr/schichtplan/**` | F1 | — |
| `web/app/(dashboard)/hr/{zeiterfassung,abwesenheit,mitarbeiter,einstellungen,stempeluhr}/**`, `web/app/terminal/**` | F2 | — |
| `web/app/(dashboard)/hr/{berichte,lohn}/**` | F3 | — |
| `scripts/demo/personal.py` | Integrator | — |

Konfliktcodes in `details.code` sind Teil des Vertrags — das Frontend
übersetzt sie (`personal.fehlercode.<code>`).

---

## 1. Paket B1 — Dienstplan-Ausbau, Regeln, Abwesenheit (Backend)

### 1.1 Betriebsregeln (Felder aus 0544/0545)
`RegelnSet`/`Regeln` (schemas.py) erhalten, alle optional mit den DB-Defaults:

```
jugendschutz_bis_alter: int|None  jugendschutz_max_tagesstunden: float|None
jugendschutz_nacht_von: time|None jugendschutz_nacht_bis: time|None
zweistufige_genehmigung: bool=False  max_urlaub_zusammenhaengend_tage: int|None
gps_pflicht: bool=False  gps_radius_m: int=250  stempel_ab_schichtbeginn: bool=False
verspaetung_melden_min: int|None  terminal_aktiv: bool=False  wetter_anzeigen: bool=True
ziel_umsatzproduktivitaet_minor: int|None  ziel_personalkostenquote_pct: float|None
kennzahlen_currency: str|None  kennzahlen_zeilen: list[str]=["besetzung","stundenlimit"]
```
`kennzahlen_zeilen` ⊂ {besetzung, stundenlimit, einsaetze, kosten, umsatz,
produktivitaet, quote, budget} — sonst 422. Die Dataclass `regelwerk.Regeln`
bekommt dieselben Felder (Defaults erlaubt, weil sie aus der DB kommen).
`RegelVorschlag` (laender.py): Jugendschutz-Werte je Land mit Quelle
(DE: 18 / 8 h / 20:00–06:00 JArbSchG; andere Länder nur mit Quelle, sonst null).

### 1.2 Konflikte (regelwerk.konflikte_pruefen, neue Parameter mit Default)
* `jugendschutz` (fehler): Person unter `jugendschutz_bis_alter` (aus
  `personal_akten.geburtsdatum`), Schicht länger als `jugendschutz_max_tagesstunden`
  oder im Jugend-Nachtfenster. `werte = {alter, max_stunden, ist_stunden}` bzw.
  `{alter, nacht_von, nacht_bis}`. Ohne Geburtsdatum keine Prüfung.
* `verdienstgrenze` (warnung): geplante + bestätigte Minuten × Stundenlohn im
  Zeitraum (Monat/Jahr der Schicht) überschreiten `verdienstgrenze_minor`.
  `werte = {grenze_minor, geplant_minor, currency}`. Nur bei Stundenlohn.
Beide in `schichten._konflikte_fuer_row` und `konflikte_vorschau` einhängen.
`web/components/personal/konflikte.ts` (F1) bekommt die zwei Texte.

### 1.3 Wochenplan-Antwort (WochenplanResponse, GET /dienstplan?woche= und /dienstplan/mein)
Zusätzliche Felder:
```
bis: date                                   # letzter Tag des Fensters
personen[].geburtstag_am: date|None         # Geburtstag im Fenster (Tag/Monat des Jahres), sonst None
personen[].ist_schichtleitung: bool         # role == shift_lead
personen[].azk_minuten: int|None            # Saldo Arbeitszeitkonto
personen[].guttage: float|None              # Saldo Guttage
personen[].verdienstgrenze: {minor, zeitraum, currency, verbraucht_minor, geplant_minor}|None
                                            # nur Leitung (admin/co_admin), sonst None
personen[].zuschlaege_minor: int|None       # Zuschlagssumme der Woche, nur Leitung
verfuegbarkeiten: [{user_id, art: 'wunsch'|'gesperrt', datum, zeit_von: 'HH:MM'|None, zeit_bis, ganztags}]
                                            # je Tag im Fenster AUFGELÖST (wiederkehrend expandiert)
wetter: {datum: {temp_min, temp_max, code, niederschlag_mm}}  # {} wenn aus/keine Koordinate
tausch: [Tausch]                            # offene (angefragt/angenommen) im Fenster, Scope wie Personen
schichten[].tausch_status: 'angefragt'|'angenommen'|None
```
`GET /dienstplan/zeitraum?von=&bis=` (Team): dieselbe Antwort für ein freies
Fenster, `woche_start = von`, höchstens 42 Tage (sonst 422 `zeitraum_zu_lang`).
Tages- und Monatsansicht laufen darüber.

### 1.4 Neue Endpunkte (planung_router.py)
| Methode | Pfad | Guard | Request → Response |
|---|---|---|---|
| POST | `/dienstplan/leeren?woche=&arbeitsbereich_id=` | Plan | → `{geloescht: n, abgesagt: n}` — Entwürfe löschen, veröffentlichte/bestätigte absagen (+ `melde_dienstplan(geaendert=True)`) |
| POST | `/schichten/mehrfach` | Plan | `{ids: [uuid] (≤200), aktion: 'verschieben'|'loeschen'|'zuweisen'|'freigeben', tage: int|None, user_id: str|None, warnungen_akzeptieren: bool}` → `{geaendert: n, konflikte: [{schicht_id, konflikte: [Konflikt]}]}`; 409 mit derselben Liste, wenn Warnungen und nicht akzeptiert; 422 bei Fehlern |
| GET | `/wochenvorlagen` | Team | → `[{id, name, notiz, anzahl_schichten, created_at}]` |
| POST | `/wochenvorlagen` | Plan | `{name, notiz, aus_woche: date, mit_personen: bool}` → `Wochenvorlage` (Schichten der Woche ohne abgesagte) |
| GET | `/wochenvorlagen/{id}` | Team | → `{…, schichten: [{id, wochentag, start_zeit, end_zeit, pause_min, arbeitsbereich_id, property_id, user_id, schichtvorlage_id, notiz}]}` |
| PATCH | `/wochenvorlagen/{id}` | Plan | `{name?, notiz?}` |
| DELETE | `/wochenvorlagen/{id}` | Plan | 204 |
| POST | `/wochenvorlagen/{id}/anwenden?woche=` | Plan | `{mit_personen: bool, warnungen_akzeptieren: bool}` → `BedarfResponse {angelegt, vorhanden}`; Schichten `quelle='wochenvorlage'`, `status='entwurf'`; vorhanden = gleiche Person/Zeit/Bereich schon da |
| POST | `/schichten/{id}/tausch` | Own | `{an_user_id, gegen_schicht_id?: str, grund?: str}` → `Tausch`; Own nur eigene Schicht, Plan jede; Ziel muss im Bereich qualifiziert sein (sonst 422 `qualifikation`); 409 `tausch_offen` wenn schon eine offene Anfrage |
| GET | `/tausch?woche=&status=` | Own | → `[Tausch]` (Own: eigene als Geber/Nehmer; Team: Scope) |
| POST | `/tausch/{id}/annehmen` | Own | nur `an_user_id` → status angenommen (+ Meldung an Leitung) |
| POST | `/tausch/{id}/ablehnen` | Own | nur `an_user_id` |
| POST | `/tausch/{id}/zurueckziehen` | Own | nur `von_user_id`, solange nicht freigegeben |
| POST | `/tausch/{id}/entscheiden` | Plan | `{freigeben: bool, kommentar?: str, warnungen_akzeptieren: bool}` → `Tausch`; freigeben schreibt BEIDE Schichten in einem Schritt (Konfliktprüfung für beide, 409/422 wie Schicht), setzt `quelle='tausch'`, Meldung an beide |
| GET | `/dienstplan/export.csv?woche=` | Team | text/csv (Semikolon, BOM, `\r\n`): Datum;Wochentag;Person;Personalnummer;Bereich;Objekt;Von;Bis;Pause;Netto;Status;Notiz |
| POST | `/abwesenheiten/vorschau` | Absence | `{user_id?: str, art, von, bis, halbtag_start, halbtag_ende}` → `{tage, rest_vorher: float|None, rest_nachher: float|None, sperre: {grund, von, bis}|None, schichten_betroffen: int, kollegen_abwesend: [{user_id, full_name, art}], fehler: [code]}` — der Live-Zähler des Antrags |

`Tausch = {id, schicht_id, von_user_id, von_name, an_user_id, an_name, gegen_schicht_id, status, grund, kommentar, angenommen_am, entschieden_von, entschieden_am, created_at, schicht: {datum, start_at, end_at, arbeitsbereich_id, property_title}}`

### 1.5 Abwesenheit
* `zweistufige_genehmigung`: `entscheiden` durch `shift_lead` setzt `vorgenehmigt`
  (+ `vorentschieden_*`), Schichten bleiben; `admin/co_admin` setzt `genehmigt`
  (aus beantragt ODER vorgenehmigt). Ohne Regel wie bisher. Meldungen: Antragsteller
  bei jeder Stufe, Leitung bei `vorgenehmigt`.
* `max_urlaub_zusammenhaengend_tage`: `beantragen` → 422 `max_zusammenhaengend`
  `{max, tage}` für `art='urlaub'`.
* Guttage: genehmigter `art='frei'`-Antrag mit `grund` „Guttag" bucht NICHT
  automatisch — B3 stellt `guttage_buchen()` bereit; B1 ruft es NICHT (Handbuchung).
* `AbwesenheitListResponse`-Einträge tragen `vorentschieden_von`, `vorentschieden_am`.

### 1.6 Wetter (`wetter.py`)
Open-Meteo, fester Host `api.open-meteo.com`, Pfad `/v1/forecast`, Parameter
`latitude, longitude, daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum, timezone=<Betriebszone>, start_date, end_date`; Timeout 5 s;
Cache `wetter_tage` (lat/lng auf 2 Stellen), Neuabruf wenn `geholt_am` älter
als 6 h; Fehler → `{}` + `log.warning`. Koordinate: erstes aktives Objekt des
Betriebs mit `lat/lng` (Sortierung `title`); Objekt der Woche, wenn alle
Schichten dasselbe Objekt haben. Nur wenn `wetter_anzeigen`.

### 1.7 Tick (tick.py, stündlich)
* `akte_aenderungen.aenderungen_anwenden(db, heute)` (B3 liefert die Funktion)
* `verspaetung.verspaetungen_melden(db, jetzt)` (B3 liefert)
* Tausch-Anfragen, deren Schicht begonnen hat → `verworfen`.

### 1.8 Meldungen (`benachrichtigungen_planung.py`)
Kategorie `schicht_tausch`: an `an_user_id` bei Anfrage, an Leitung bei
`angenommen`, an beide bei Entscheidung. Mailschlüssel
`personal.tausch_anfrage`, `personal.tausch_angenommen`,
`personal.tausch_freigegeben`, `personal.tausch_verworfen` (je `.betreff`/`.text`,
Platzhalter `{name}`, `{datum}`, `{zeit}`), `ziel_pfad=/hr/schichtplan?woche=`.

---

## 2. Paket B2 — Bedarf, Kennzahlen, Umsatzbuch, Budget, KI (Backend)

Dateien: `bedarf.py` (+ `bedarf_router.py`, `bedarf_schemas.py`),
`kennzahlen.py`, `ki_planung.py` (+ `ki_router.py`, `ki_schemas.py`),
`autoplan_solver.py` (OR-Tools CP-SAT, reine Funktion ohne DB, eigene Tests).

### 2.1 Kennzahlen — `GET /dienstplan/kennzahlen?von=&bis=` (Team; ≤ 42 Tage)
Finanzfelder (`*_minor`, `quote`, `produktivitaet`, `budget_minor`) sind für
Aufrufer ohne `EXPORT_LOHN` `None`; die Hotel-Zeile sieht jede Schichtleitung.
```
{
  von, bis, currency: str|None, hinweise: [str],
  tage: [{
    datum, feiertag: str|None,
    anreisen: int, abreisen: int, gaeste_im_haus: int,
    einheiten_belegt: int, einheiten_gesamt: int, belegung_pct: float|None,
    umsatz_ist_minor: int|None, umsatz_plan_minor: int|None,
    umsatz_quelle: 'buchungen'|'manuell'|'prognose'|None,
    plan_minuten: int, ist_minuten: int, einsaetze: int, personen: int,
    personalkosten_plan_minor: int|None, personalkosten_ist_minor: int|None,
    personalkostenquote_pct: float|None,          # Kosten(plan, Zukunft: plan / Vergangenheit: ist) / Umsatz
    produktivitaet_minor_je_stunde: int|None,     # Umsatz / Stunden (Regel wie Gastromatic: Vergangenheit Ist/Ist, Zukunft Plan/Plan)
    ziel_produktivitaet_minor: int|None,
    stundenlimit_minuten: int|None,               # Umsatz(plan) / Ziel-Produktivität × 60
    budget_stunden: float|None, budget_minor: int|None,
    abweichung_budget_pct: float|None
  }],
  bereiche: [{arbeitsbereich_id, tage: [{datum, soll_anzahl: int, ist_anzahl: int, soll_minuten: int, ist_minuten: int, einsaetze: int, stundenlimit_minuten: int|None}]}],
  summe: {anreisen, abreisen, gaeste_im_haus, plan_minuten, ist_minuten, einsaetze, umsatz_ist_minor, umsatz_plan_minor, personalkosten_plan_minor, personalkosten_ist_minor, personalkostenquote_pct, produktivitaet_minor_je_stunde, stundenlimit_minuten, budget_stunden, budget_minor}
}
```
Quellen:
* Buchungen: `reservations` des Tenants, `status in ('confirmed','completed')`,
  nicht `owner_stay`-Kanal für Umsatz. anreisen = `check_in = d`, abreisen =
  `check_out = d`, im Haus = `check_in <= d < check_out`, gaeste = Σ `num_guests`
  im Haus, einheiten_belegt = Anzahl Reservierungen im Haus, einheiten_gesamt =
  Anzahl `property_units` aller aktiven (`status <> 'archived'`) Objekte.
  Umsatz je Nacht = `total_amount / nächte` in der Objektwährung; verschiedene
  Währungen → `umsatz_* = None` + Hinweis; Umsatzbuch-Zeile (manuell/prognose)
  übersteuert den Buchungswert (`umsatz_quelle`).
* Kosten: Σ Schichten (plan) bzw. bestätigte Zeiten (ist) × Satz aus Akte/Fremdfirma
  (`stundenlohn` oder `gehalt / (wochenstunden × 52/12)`) × (1 + `arbeitgeber_aufschlag_pct`/100);
  fehlender Satz → Hinweis „{n} Personen ohne Lohn", nicht 0.
* Soll-Besetzung je Bereich/Tag aus `personal_bedarf`: Zeilen mit `datum`
  ersetzen an dem Tag die `wochentag`-Vorlagen desselben Bereichs. Ist-Besetzung
  = Schichten (nicht abgesagt) im Bereich, die das Zeitfenster überlappen.

### 2.2 Bedarf / Produktivität / Budget / Umsatzbuch
| Methode | Pfad | Guard | Form |
|---|---|---|---|
| GET | `/bedarf?von=&bis=` | Team | → `{vorlagen: [BedarfZeile(wochentag)], tage: [BedarfZeile(datum)]}` |
| PUT | `/bedarf/vorlagen` | Plan | `[BedarfZeile ohne id, mit wochentag]` → ersetzt ALLE Vorlagen-Zeilen des Betriebs |
| PUT | `/bedarf/tage?von=&bis=` | Plan | `[BedarfZeile mit datum im Fenster]` → ersetzt die manuellen Tages-Zeilen im Fenster (Prognose-Zeilen bleiben) |
| DELETE | `/bedarf/{id}` | Plan | 204 |
| GET/PUT | `/produktivitaet` | Manage | `[{arbeitsbereich_id, basis, wert, min_stunden_tag, max_stunden_tag, notiz}]` (PUT ersetzt) |
| GET | `/budget?von=&bis=` | Export | `{vorlagen: [BudgetZeile(wochentag)], tage: [BudgetZeile(datum)]}` |
| PUT | `/budget/vorlagen`, `/budget/tage?von=&bis=` | Export | wie Bedarf |
| GET | `/umsatzbuch?von=&bis=` | Export | `[{datum, arbeitsbereich_id, plan_minor, ist_minor, currency, quelle, buchungen_ist_minor: int|None, notiz}]` — je Tag im Fenster eine Zeile (auch ohne DB-Zeile, dann quelle None) |
| PUT | `/umsatzbuch` | Export | `[{datum, arbeitsbereich_id|None, plan_minor|None, ist_minor|None, currency, notiz}]` → upsert manuell; beide None löscht die Zeile |

`BedarfZeile = {id?, arbeitsbereich_id, property_id|None, wochentag|None, datum|None, zeit_von: 'HH:MM', zeit_bis: 'HH:MM', anzahl, quelle, notiz}`
`BudgetZeile = {id?, wochentag|None, datum|None, stunden|None, betrag_minor|None, currency|None, notiz}`

### 2.3 KI
| Methode | Pfad | Guard | Form |
|---|---|---|---|
| POST | `/ki/prognose?woche=` | Plan | → `Prognose` |
| GET | `/ki/prognosen?woche=` | Team | → `[Prognose]` (neueste zuerst) |
| POST | `/ki/prognosen/{id}/uebernehmen` | Plan | → `BedarfResponse {angelegt, vorhanden}`; schreibt `personal_bedarf` `quelle='prognose'` für die Woche, ersetzt ältere Prognose-Zeilen der Woche; `uebernommen_am` |
| POST | `/ki/autoplan?woche=` | Plan | `{planungstyp, varianten: int (1–3), zeitlimit_s: int (≤30), nur_offene: bool}` → `Planungslauf` (synchron) |
| GET | `/ki/planungslaeufe?woche=` | Team | → `[Planungslauf]` |
| POST | `/ki/planungslaeufe/{id}/uebernehmen` | Plan | `{variante: int}` → `BedarfResponse`; Entwurf-Schichten `quelle='autoplan'`, `planungslauf_id`; status `uebernommen` |
| POST | `/ki/planungslaeufe/{id}/verwerfen` | Plan | → `{geloescht: n}` — löscht NUR Entwurf-Schichten mit dieser `planungslauf_id` |
| POST | `/ki/assistent` | Team | `{frage: str (≤500), woche: date}` → `{antwort, content_origin: 'ki', quellen: [str]}`; 503 ohne Vertex |
| GET | `/ki/status` | Team | → `{konfiguriert: bool, verbrauch_heute: int, tageslimit: int, solver: 'ortools'}` |

```
Prognose = {id, woche_start, status: 'fertig'|'fehler', eingaben: {tage: [{datum, anreisen, abreisen, gaeste_im_haus, einheiten_belegt, einheiten_gesamt, feiertag}], historie_wochen: int},
            ausgabe: {tage: [{datum, bereiche: [{arbeitsbereich_id, stunden: float, anzahl: int, basis: str, basis_wert: float}], stundenlimit_minuten: int|None, hinweise: [str]}]},
            erklaerung: str|None, content_origin, modell, region, dauer_ms, fehler, uebernommen_am, created_at}
Planungslauf = {id, woche_start, planungstyp, status, solver, varianten: [{name, schichten: [{bedarf_id|None, user_id, start_at, end_at, pause_min, arbeitsbereich_id, property_id}],
            kennzahlen: {stunden: float, kosten_minor: int|None, currency, fairness_pct: float, wunsch_erfuellt_pct: float, unbesetzt: int, konflikte: int}}],
            gewaehlte_variante, erklaerung, content_origin, dauer_ms, fehler, uebernommen_am, created_at}
```
Prognose-Rechnung (deterministisch, Server): je Tag und Bereich
`stunden = basis_wert / wert` (basis `einheiten_belegt|abreisen|anreisen|gaeste`),
`umsatz`: `umsatz_plan_minor / wert`, `fest`: `wert`; geklemmt an
`min/max_stunden_tag`; `anzahl = ceil(stunden / 8)` (Pflicht-Hinweis, wenn
> max Tagesstunden der Regeln). Ohne `personal_produktivitaet` für einen
Bereich → Hinweis je Bereich; ohne jede Annahme → 422 `produktivitaet_fehlt`.
Gemini bekommt Eingaben + Ausgabe + Historie (letzte 8 Wochen: Plan-/Ist-Minuten
je Tag) und liefert `erklaerung` (≤ 1200 Zeichen, Deutsch nach Betriebssprache
später); ohne Vertex `erklaerung=None`, kein Fehler. Zähler `personal_prognose`.

Autoplan (autoplan_solver.py, CP-SAT): Variablen x[hülle,slot,person]; harte
Regeln: Qualifikation, Abwesenheit, gesperrte Verfügbarkeit, Doppelbelegung mit
bestehenden Schichten, Ruhezeit, max Tagesstunden, max Wochenstunden,
Jugendschutz; weiche Ziele mit Gewichten je Planungstyp:

| Typ | Sollstunden | Skills (Stufe) | Wunschzeiten | Fairness (Wochenenden, Verteilung) | Kosten |
|---|---|---|---|---|---|
| performer | 3 | 3 | 1 | 1 | 1 |
| alleskoenner | 2 | 2 | 2 | 2 | 1 |
| superfaire | 1 | 1 | 3 | 3 | 0 |
| zeitschwaermer | 3 | 1 | 2 | 1 | 1 |
| talentscout | 1 | 3 | 1 | 1 | 1 |
| faire | 3 | 1 | 1 | 3 | 0 |
| philanthrop | 2 | 3 | 1 | 3 | 0 |

Varianten: Lauf 1 mit den Gewichten, Lauf 2/3 mit leicht verschobenen
Gewichten (±1 auf Wunsch/Fairness) und anderem Seed. Gemini erklärt die
Unterschiede (`erklaerung`), Zähler `personal_autoplan`. Assistent: Kontext =
Wochenplan, Abwesenheiten, Verfügbarkeiten, Qualifikationen, offene Hüllen —
KEIN Lohn, KEINE Kennungen; Zähler `personal_assistent`. Alle drei prüfen
`ki_nutzung.deckel_pruefen` und buchen `ki_nutzung`.

---

## 3. Paket B3 — Zeiterfassung (Terminal, Regeln, Listen), Überstunden, Guttage, Akte (Backend)

Dateien: `terminal.py` (+ `terminal_router.py`, `terminal_schemas.py`),
`ueberstunden.py` (+ `ueberstunden_router.py`, `ueberstunden_schemas.py`; enthält Guttage),
`akte_aenderungen.py` (+ Routen in `ueberstunden_router.py` oder eigenem
`akte_router.py`), `verspaetung.py`, Änderungen in `zeiterfassung.py`, `service.py`.

### 3.1 Akte
`Akte`/`AkteUpdate`: `verdienstgrenze_minor: int|None`, `verdienstgrenze_zeitraum:
'monat'|'jahr'|None` (Paar, Währung Pflicht → 422 `waehrung_fehlt`), Antwort
zusätzlich `stempel_id: str|None`, `hat_terminal_pin: bool`.
| Methode | Pfad | Guard | Form |
|---|---|---|---|
| POST | `/mitarbeiter/{id}/terminal-zugang` | Manage | `{stempel_id?: '0000'-'9999', pin: 4–6 Ziffern}` → `{stempel_id}`; ohne stempel_id nächste freie; 409 `stempel_id_vergeben` |
| DELETE | `/mitarbeiter/{id}/terminal-zugang` | Manage | 204 |
| GET | `/mitarbeiter/{id}/aenderungen` | Manage | → `[{id, gueltig_ab, felder, grund, angewendet_am, erstellt_von_name, created_at}]` |
| POST | `/mitarbeiter/{id}/aenderungen` | Manage | `{gueltig_ab (≥ heute), felder: dict (nur AkteUpdate-Felder, sonst 422 `feld_unbekannt`), grund?}` |
| DELETE | `/kartei/aenderungen/{id}` | Manage | nur nicht angewendete |
`aenderungen_anwenden(db, heute) -> int` (Modulfunktion für den Tick): wendet
fällige Zeilen über `PersonalService.akte_speichern`-Logik an, setzt
`angewendet_am`; ein Fehler kippt die anderen nicht.
PIN-Hash: `hashlib.pbkdf2_hmac('sha256', pin, salt=tenant_id+user_id, 200_000)`
hex; Vergleich über `core.security.secrets_match`.

### 3.2 Terminals
| Methode | Pfad | Guard | Form |
|---|---|---|---|
| GET | `/terminals` | Manage | → `[{id, name, property_id, aktiv, letzter_kontakt_am, created_at}]` |
| POST | `/terminals` | Manage | `{name, property_id?}` → `{…, token}` (nur hier sichtbar; 32 Byte urlsafe, gespeichert als SHA-256) |
| PATCH | `/terminals/{id}` | Manage | `{name?, aktiv?, property_id?}` |
| POST | `/terminals/{id}/token` | Manage | → `{token}` (rotiert) |
| DELETE | `/terminals/{id}` | Manage | 204 |

Terminal-Routen OHNE Nutzer-JWT, Header `X-Terminal-Token` (Prefix
`/terminal`, Guard: Token-Hash in `personal_terminals`, `aktiv`, Regel
`terminal_aktiv`; sonst 401; `letzter_kontakt_am` setzen):
| Methode | Pfad | Form |
|---|---|---|
| GET | `/terminal/info` | → `{terminal: {name, property_title}, betrieb: {name, zeitzone}, wetter_heute: {...}|None}` |
| POST | `/terminal/status` | `{stempel_id}` → `{anzeige_name: 'Vorname N.', offen: Zeiterfassung|None, schicht_heute: {start_at, end_at, arbeitsbereich_kurz}|None}`; unbekannte ID → 404 `stempel_id_unbekannt` |
| POST | `/terminal/stempeln` | `{stempel_id, pin, aktion: 'start'|'pause'|'pause_ende'|'ende'}` → `Zeiterfassung`; falsche PIN → 401 `pin_falsch`; 5 Fehlversuche je stempel_id → 15 min 423 `gesperrt` (Zähler im Prozessspeicher mit Ablauf, dokumentiert) |
Stempelung: `quelle='terminal'`, `terminal_id`, `property_id` des Terminals.
Rate-Limit-Bucket `personal_terminal` 30/60/IP (core.ratelimit wie vorhanden).

### 3.3 Zeiterfassung-Regeln (zeiterfassung.py)
* `stempel_ab_schichtbeginn`: bei `start` mit passender Schicht (gleiche Person,
  Schicht beginnt ±3 h) `start_at = max(jetzt, schicht.start_at)`, `schicht_id`
  setzen, `verspaetung_min = max(0, jetzt − schicht.start_at)`.
* `gps_pflicht`: `start`/`ende` aus `quelle in ('web','app')` ohne `standort`
  → 422 `gps_pflicht`; Distanz > `gps_radius_m` → Warnung im `notiz`-Feld
  („Standort {distanz} m entfernt") + Hinweis an Leitung (`zeit_hinweis`).
* `verspaetungen_melden(db, jetzt) -> int` (Modulfunktion, `verspaetung.py`):
  Schichten mit Status veröffentlicht/bestätigt, `start_at + verspaetung_melden_min < jetzt`,
  keine Stempelung der Person, die die Schicht überlappt → Kategorie
  `verspaetung` an Leitung, `dedup_key=verspaetung:{schicht_id}`.

### 3.4 Listen
| Methode | Pfad | Guard | Form |
|---|---|---|---|
| GET | `/zeiterfassung/zusammenfassung?von=&bis=` | Team | → `[{user_id, full_name, arbeitstage, netto_minuten, soll_minuten: int|None, ueberstunden_minuten, krank_tage, urlaub_tage, unbestaetigt: int, verspaetungen: int}]` |
| GET | `/zeiterfassung/unbestaetigt` | Confirm | → `[{user_id, full_name, unbestaetigt: int, verpasst: int, aelteste: date|None}]`; verpasst = veröffentlichte/bestätigte Schichten der letzten 14 Tage ohne überlappende Stempelung |
Bestehende `GET /zeiterfassung` bleibt; die Ansicht Tag/Woche/Monat rechnet das Frontend über `von/bis`.

### 3.5 Überstunden & Guttage
| Methode | Pfad | Guard | Form |
|---|---|---|---|
| POST | `/ueberstunden` | Time | `{datum, minuten (1–720), grund (≥3), zeiterfassung_id?}` → `Ueberstundenantrag`; Meldung `ueberstunden_antrag` an Leitung |
| GET | `/ueberstunden?von=&bis=&status=` | Own | Own = eigene, Team = Scope |
| POST | `/ueberstunden/{id}/entscheiden` | Confirm | `{genehmigen: bool, kommentar?}`; genehmigt → AZK-Buchung `grund='korrektur'`, `notiz='Überstundenantrag {datum}'`, `bezug_id`; Meldung `ueberstunden_entscheidung` |
| GET | `/mitarbeiter/{id}/guttage` | Own | → `{saldo_tage: float, buchungen: [{id, datum, tage, grund, notiz, abwesenheit_id, created_at}]}` |
| POST | `/guttage` | Confirm | `{user_id, datum, tage (≠0), grund, notiz?, abwesenheit_id?}` |
`Ueberstundenantrag = {id, user_id, full_name, datum, minuten, grund, status, kommentar, zeiterfassung_id, entschieden_von, entschieden_am, created_at}`
Meldungen in `benachrichtigungen_zeit.py`, Mailschlüssel `personal.ueberstunden_antrag`,
`personal.ueberstunden_entscheidung`, `personal.verspaetung` (je `.betreff/.text`).

---

## 4. Paket B4 — Berichte und Lohnlauf (Backend)

Dateien: `berichte.py` (+ `berichte_router.py`, `berichte_schemas.py`),
`lohnlauf.py` (+ Routen in `berichte_router.py`), `auswertung.py` (öffentliche
Funktion `kosten_satz(akte, firma) -> tuple[int|None, str|None]` herausziehen).

### 4.1 Katalog — `GET /berichte` (Team)
`[{name, gruppe: 'zeit'|'abwesenheit'|'finanzen'|'personal'|'plan', filter: ['zeitraum','arbeitsbereich','objekt','person','beschaeftigungsart'], capability: 'view_team_schedule'|'export_lohn', formate: ['json','csv']}]`
— nur die Berichte, die der Aufrufer sehen darf.

### 4.2 Bericht — `GET /berichte/{name}?von=&bis=&arbeitsbereich_id=&property_id=&user_id=&beschaeftigungsart=&format=json|csv`
```
BerichtResponse = {name, von, bis, currency: str|None, hinweise: [str], erzeugt_am,
  spalten: [{key, typ: 'text'|'zahl'|'minuten'|'geld'|'prozent'|'datum'|'tage'|'status', summe: bool}],
  zeilen: [{<key>: wert, ...}], summen: {<key>: wert}|None, anzahl: int}
```
Spaltenschlüssel (`key`) sind stabil und werden vom Frontend über
`personal.berichte.spalten.<key>` beschriftet. `format=csv` → text/csv
(Semikolon, BOM, `\r\n`, Zahlen mit Komma nach `de`-Regeln NICHT — immer Punkt,
Excel-Import per Locale), Dateiname `<name>_<von>_<bis>.csv`.

| name | Guard | Zeile = | Spalten (key) |
|---|---|---|---|
| stundenkonten | Team | Person | person, personalnummer, beschaeftigungsart, soll_minuten, ist_minuten, saldo_monat_minuten, azk_saldo_minuten, guttage, urlaub_rest |
| soll_ist | Team | Person × Tag | datum, person, plan_minuten, ist_minuten, differenz_minuten, status (`ok`/`abweichung`/`fehlt`/`ohne_plan`) |
| zuschlaege | Export | Person | person, nacht_minuten, sonntag_minuten, feiertag_minuten, ueberstunden_minuten, nacht_minor, sonntag_minor, feiertag_minor, ueberstunden_minor, summe_minor |
| personalkosten | Export | Tag × Bereich | datum, arbeitsbereich, objekt, plan_minuten, ist_minuten, kosten_plan_minor, kosten_ist_minor, davon_fremd_minor |
| pkq_verlauf | Export | Tag | datum, umsatz_minor, kosten_minor, quote_pct, ziel_quote_pct, produktivitaet_minor, ziel_produktivitaet_minor, stundenlimit_minuten, plan_minuten |
| produktivitaet | Export | Bereich | arbeitsbereich, minuten, umsatz_anteil_minor, produktivitaet_minor, einsaetze, personen |
| urlaub | Team | Person | person, anspruch, uebertrag, genommen, beantragt, rest, verfall_am |
| krank | Team | Person | person, krank_tage, kind_krank_tage, faelle, letzter_fall |
| abwesenheiten | Team | Antrag | person, art, von, bis, tage, status, entschieden_von, entschieden_am |
| verdienstgrenzen | Export | Person mit Grenze | person, zeitraum, grenze_minor, verbraucht_minor, geplant_minor, rest_minor, status (`ok`/`knapp`/`ueberschritten`) |
| fristen | Team | Dokument/Nachweis/Schulung | person, art, titel, ablauf_am, tage_bis_ablauf, status (`gueltig`/`bald`/`abgelaufen`) |
| monatsabschluesse | Team | Person × Monat | person, monat, soll_minuten, ist_minuten, saldo_minuten, freigegeben_am, fehlt (bool) |
| lohnvorschau | Export | Person | person, personalnummer, grund_minuten, nacht_minuten, sonntag_minuten, feiertag_minuten, ueberstunden_minuten, urlaub_tage, krank_tage, unbezahlt_tage, brutto_minor, hinweise |
| dienstplan | Team | Schicht | datum, wochentag, person, arbeitsbereich, objekt, von, bis, pause_min, netto_minuten, status, notiz |
| mitarbeiter | Team | Person | person, personalnummer, rolle, position, beschaeftigungsart, firma, eintritt, austritt, wochenstunden, arbeitsbereiche, status |
Scope: Team-Berichte zeigen nur Personen aus `_personen_im_scope`; Export-Berichte
verlangen zusätzlich Rolle admin/co_admin frisch aus der DB (wie `auswerten`).

### 4.3 Lohnlauf
| Methode | Pfad | Guard | Form |
|---|---|---|---|
| GET | `/lohnlaeufe?jahr=` | Export | → `[Lohnlauf]` |
| POST | `/lohnlaeufe` | Export | `{jahr, monat}` → `Lohnlauf` (vorhanden → vorhandenen zurück, 200) |
| POST | `/lohnlaeufe/{id}/pruefen` | Export | → `Lohnlauf` mit `pruefungen`; ohne Fehler → `geprueft`, sonst bleibt `entwurf` |
| POST | `/lohnlaeufe/{id}/freigeben` | Export | nur `geprueft` → `freigegeben`; sonst 409 `nicht_geprueft` |
| POST | `/lohnlaeufe/{id}/exportieren` | Export | `{format: 'csv'|'datev_lodas'}` → `{inhalt_base64, mime, name}`; nur `freigegeben`/`exportiert`; setzt `exportiert`; nutzt `AuswertungService.lohnexport` mit NUR bestätigten Zeiten |
| POST | `/lohnlaeufe/{id}/zuruecksetzen` | Export | `{grund}` → `entwurf` (auch aus exportiert, mit Notiz) |
```
Lohnlauf = {id, jahr, monat, status, pruefungen: {geprueft_am, personen, zeiten, fehler: [Pruefung], warnungen: [Pruefung]},
            geprueft_am, freigegeben_am, exportiert_am, export_format, export_name, notiz, created_at}
Pruefung = {art, user_id|None, name|None, werte: dict}
```
Prüfarten (fehler): `zeit_unbestaetigt`, `stempelung_offen`, `monatsabschluss_fehlt`,
`lohn_fehlt`, `waehrung_fehlt`, `lohnart_fehlt`, `verdienstgrenze_ueberschritten`;
(warnung): `schicht_ohne_zeit`, `zeit_ohne_schicht`, `ueberstunden_offen`.

---

## 5. Paket F1 — Dienstplan (Web)

Baut gegen §1, §2. Dateien: `web/components/personal/dienstplan.tsx` (Kern),
`dienstplan-kopf.tsx` (Kennzahlen-Kopf), `dienstplan-bereich.tsx` (Bereichs-Block
mit KPI-Zeilen), `dienstplan-liste.tsx`, `dienstplan-monat.tsx`, `dienstplan-tag.tsx`,
`dienstplan-filter.tsx`, `dienstplan-legende.tsx`, `tausch-dialog.tsx`,
`tausch-liste.tsx`, `wochenvorlagen-dialog.tsx`, `bedarf-editor.tsx`,
`ki-panel.tsx`, `dienstplan-druck.ts` (HTML→PDF wie `statement-pdf.ts` über
`/api/v1/generate-pdf-single`), `web/lib/personal-planung.ts` (+ `-typen.ts`),
`web/app/(dashboard)/hr/schichtplan/page.tsx`.

Pflicht-Funktionen: Ansicht Tag / Woche / Monat (Segmented), Grid / Liste,
Gruppierung nach Arbeitsbereich mit einklappbaren Blöcken und KPI-Zeilen je
Bereich (`kennzahlen_zeilen` der Regeln: Besetzung Soll/Ist mit Farbe rot bei
Unter-, amber bei Überbesetzung; Stundenlimit `x/y` mit Balken grün/gelb;
Einsätze), Kennzahlen-Kopf über dem Plan (Hotel-Zeile: Anreisen · Abreisen ·
Gäste im Haus · Belegung `belegt/gesamt`; darunter je nach Recht Umsatz,
Personalkosten, Quote, Produktivität mit Zielmarke, Budget), Summenspalte
rechts (Soll/Plan, AZK-Saldo, Zuschläge, Verdienstgrenze-Balken), Filter
(Bereich, Objekt, Person, Suche), Mehrfachauswahl (Checkbox-Modus → Leiste:
verschieben ±Tage, zuweisen, freigeben, löschen), Woche leeren (Rückfrage mit
Zahlen), Wochenvorlage speichern/anwenden, Wunsch-/Sperrzeiten in der Zelle
(grüner/roter Punkt mit Tooltip), Schichtleiter-Marker, Geburtstags-Kuchen,
Wetter je Tag im Spaltenkopf (Symbol + °C), Tausch (Kontextmenü auf Pille →
Dialog; Liste offener Tausche mit Freigabe), CSV-Export, Druck (PDF A4 quer,
Woche, ohne Finanzzahlen), Legende als eigenes Element, KI-Panel (Prognose
erzeugen/übernehmen mit Erklärung und KI-Kennzeichen; Autoplan mit
Planungstyp-Auswahl und Variantenvergleich; Assistent-Eingabe). Bedarf-Editor
(Hüllen je Bereich/Wochentag/Zeitfenster, Tagesübersteuerung). Realtime-Abos
zusätzlich `personal_schicht_tausch`, `personal_bedarf`. Diagnose-Panel
erweitern (Kennzahlen-Antwort, KI-Läufe). Alle Texte über `useTranslations("personal")`,
Deutsch in `web/messages/_neu/planung.de.json`.

## 6. Paket F2 — Zeiterfassung, Terminal, Abwesenheit, Akte, Einstellungen (Web)

Baut gegen §1.5, §3, §2.2 (Produktivität, Budget, Umsatzbuch, Bedarfsvorlagen in
den Einstellungen). Dateien: `zeiterfassung.tsx` (+ Segmented Tag/Woche/Monat,
Zusammenfassung-Tab, Liste unbestätigt/verpasst, Stempeluhr-Karte für die
eigene Person, Überstundenanträge-Tab), `stempeluhr.tsx`,
`web/app/(dashboard)/hr/stempeluhr/page.tsx` (Own: eigene Stempeluhr, eigene
Zeiten, eigene Anträge), `web/app/terminal/[token]/page.tsx` (öffentliche
Terminal-Oberfläche: große Uhr, Ziffernblock, Stempel-ID → PIN → Aktion,
Vollbild, kein Login; Token aus der URL wird als `X-Terminal-Token` gesendet;
Route-Gruppe ohne Dashboard-Layout), `abwesenheiten.tsx` (+ Sicht „Kalender":
Gantt Woche/Monat/Jahr mit Personalnummer, gestrichelt = beantragt,
vorgenehmigt = eigene Farbe; Live-Vorschau im Antrag über `/abwesenheiten/vorschau`),
`akte-*.tsx` (Vertrag: Verdienstgrenze; Zugang: Stempel-ID/PIN; neuer Reiter
„Änderungen" mit terminierten Änderungen; Arbeitszeit: Guttage, Überstunden),
`personal-einstellungen.tsx` (Regeln: alle neuen Felder gruppiert; Tabs
Terminals, Produktivität, Budget, Umsatzbuch, Bedarfsvorlagen), Libs
`web/lib/personal-betrieb.ts` (+ `-typen.ts`), Deutsch in
`web/messages/_neu/betrieb.de.json`.

## 7. Paket F3 — Berichte und Lohnlauf (Web)

Baut gegen §4. Dateien: `web/app/(dashboard)/hr/berichte/page.tsx` (Katalog
als Karten je Gruppe), `web/app/(dashboard)/hr/berichte/[name]/page.tsx`,
`web/components/personal/berichte/bericht-seite.tsx` (Filterleiste Zeitraum +
Bereich + Objekt + Person + Beschäftigungsart, Tabelle mit Summenzeile,
Sortierung je Spalte, CSV-Download, Druck als PDF über
`/api/v1/generate-pdf-single`), `bericht-tabelle.tsx` (typgerechte Zellen:
Minuten als `h:mm`, Geld über `formatCurrency` aus `lib/currency`, Prozent,
Datum), `web/app/(dashboard)/hr/lohn/page.tsx` + `lohn/lohnlauf.tsx`
(Monatsliste mit Statuskette, Prüfen → Fehler-/Warnliste mit Sprungzielen,
Freigeben, Exportieren, Zurücksetzen mit Grund), Libs
`web/lib/personal-berichte.ts` (+ `-typen.ts`), Deutsch in
`web/messages/_neu/berichte.de.json`.

---

## 8. Sidebar und Rollen (Integrator)
Neue Einträge unter „Personal": `berichte` (`/hr/berichte`, `view_team_schedule`),
`lohn` (`/hr/lohn`, `export_lohn`), `stempeluhr` (`/hr/stempeluhr`,
`track_own_time`). `STAFF_ALLOWED_HREFS` + `/hr/stempeluhr`; `SHIFT_LEAD_ALLOWED_HREFS`
+ `/hr/berichte`. Terminal-Seite `/terminal/<token>` liegt außerhalb des
Dashboards (kein Login, kein Layout).

## 9. Gates je Paket
Backend: `uv run ruff check <dateien>`, `uv run pylint <dateien>` 10.00/10,
`uv run pytest src/features/personal -q` (NUR der Slice, EINMAL am Ende).
Web: `bunx tsc --noEmit` und `bun run lint` in `web` — fehlerfrei. Kein
`next build`. Keine Datei außerhalb des eigenen Besitzes anfassen; was fehlt,
im Abschlussbericht benennen.
