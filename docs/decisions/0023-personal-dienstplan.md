# ADR-0023: Personal & Dienstplan als Slice `personal`, Rolle Schichtleitung

- Status: **ANGENOMMEN** (2026-09-03)
- Grundlage: `docs/PERSONAL-DIENSTPLAN-KONZEPT.md` (Analyse Gastromatic,
  Taskilo-Modul, myNextDays-Bestand) und die Entscheidungen des Betreibers vom
  03.09.2026.
- Migrationen: 0540 (Rolle), 0541 (Tabellen, Scope, Feiertage), 0542
  (Benachrichtigungs-Kategorien), 0543 (Kartei: Verträge, Disziplin,
  Gespräche, Nachweise, Schulungen, Lohnmerkmale), 0544–0548 (Ausbau vom
  04.09.2026: Planung, Tausch, Terminals, Bedarf und Kennzahlen, KI,
  Lohnläufe, vier weitere Benachrichtigungs-Kategorien — siehe unten).

## Frage

Der Betrieb braucht Dienstplan, Zeiterfassung, Abwesenheiten und Personalakte
für Reinigungs-, Wäsche- und Hausmeisterpersonal — „Gastromatic für Ferien-
objekte". Ein früheres Modul des Betreibers (Taskilo) existiert als Vorlage,
aber ohne funktionierendes Backend. Wie kommt das Modul in myNextDays?

## Entscheidung

1. **Eigener Slice `personal`** (`apps/api/src/features/personal`) nach
   Fachgebiet geteilt: Stammdaten (`service.py`), Dienstplan (`schichten.py`),
   Abwesenheit (`abwesenheiten.py`), Zeiterfassung (`zeiterfassung.py`),
   Auswertung/Lohn (`auswertung.py`), Rechenkern ohne DB (`regelwerk.py`).
   Aus Taskilo wird die **Struktur** übernommen (Akte-Reiter, Grid Personen ×
   Tage, Konfliktarten, Zuschlagsklassen), nicht der Code.
2. **Schicht ≠ Aufgabe, aber verzahnt.** Die Aufgaben-Engine erzeugt den
   Bedarf (Reinigung am Abreisetag); `bedarf_aus_aufgaben` macht daraus
   Schichten — je Aufgabe höchstens eine (UNIQUE `tenant_id, task_id`).
3. **Person = `users`-Zeile.** Akte 1:1 (`personal_akten.user_id`), sensible
   Kennungen AES-GCM-verschlüsselt (`PERSONAL_AKTE_KEY`), Anzeige maskiert.
   Externe Kräfte (Fremdfirma) sind Konten mit `beschaeftigungsart='extern'`
   und `firma_id`; ohne Lohn-/Urlaubsfelder (CHECK).
4. **Land ist Konfiguration für alle 27 EU-Länder.** Feiertage aus dem Paket
   `holidays` in `public.feiertage` (global, idempotent). Gesetzliche
   Mindestwerte je Land stehen als bestätigungspflichtiger Vorschlag in
   `laender.py` (Quelle je Zeile); ohne bestätigte `personal_regeln` gibt es
   keinen Plan, keine Konflikte, keine Zuschläge — 422, kein Default.
5. **Lohn nur vorbereiten.** Export als CSV und DATEV-LODAS-Bewegungsdaten;
   Berater-/Mandantennummer und Lohnarten aus den Regeln, sonst 422.
6. **Rolle `shift_lead`** (Schichtleitung) neben admin/co_admin: plant,
   entscheidet Abwesenheiten, bestätigt Zeiten — nur für Personen an gemeinsam
   freigegebenen Objekten (`personal_sieht_person`, SECURITY DEFINER). Keine
   Akte, kein Lohn, keine Finanzen. Alle Scope-Helfer (`staff_can_see_*`,
   `owner_can_see_property`) nennen die Rolle explizit; `scripts/i18n/
   rollen-pruefen.mjs` hält die sieben Stellen der Rollen-Kette gleich.
7. **Web = Planung, App = Mitarbeitende.** Alle fünf Etappen sind Web + API
   für die Leitung. Eine Mitarbeitersicht im Web gibt es nicht (Betreiber
   04.09.2026: „wir planen doch hier alles“); Stempeluhr, eigener Plan,
   Bestätigen, Bewerben und Anträge kommen mit der iOS-/Android-App als
   eigenem Projekt (Muster ADR-0022, eigener ADR). Die API dafür ist fertig
   (`/dienstplan/mein`, `/zeiterfassung/*`, `/schichten/{id}/bestaetigen|bewerben`,
   `idempotenz_key` + Geräte-Zeitpunkt). Bis dahin trägt die Leitung Zeiten
   (Nachtrag) und Abwesenheiten (für andere = sofort genehmigt) ein; Meldungen
   an Mitarbeitende gehen ohne Sprungziel hinaus.
8. **Die Akte ist die Taskilo-Kartei** (Freigabe 04.09.2026: „ich hatte doch
   in taskilo eine mitarbeiter kartei"). Reiter Grunddaten, Vertrag &
   Arbeitszeit, Verträge (+ Nachträge mit Feld-Diff), Qualifikationen
   (Einsatz-Qualifikation + Nachweise: Ausbildung, Zertifikate, Sprachen,
   Fähigkeiten, Erfahrung), Dokumente, Compliance (rechtliche Nachweise mit
   Nummer/Behörde/Ablauf + Schulungen), Urlaub & Anträge, Arbeitszeit
   (Soll/Plan/Ist, kommende Schichten, Zeiten), Verfügbarkeit, Gespräche,
   Disziplin (Maßnahmen + Vorfälle), Zugang (Einladung, letzter Login,
   Sperren). Kopf mit Kurzinfo-Karten aus EINER Abfrage
   (`/mitarbeiter/{id}/uebersicht`). Liste als Karten-Grid mit Kennzahl-
   Kacheln, „Mitarbeiter hinzufügen" (Nutzer-Wizard, Rolle vorbelegt) und
   CSV-Export. Bewusst NICHT 1:1: Steuerklasse & Co. sind freie
   `lohnmerkmale` je Land, Zuschläge bleiben Betriebsregel, Kosten nur mit
   erfasstem `arbeitgeber_aufschlag_pct` (kein hartes 19,5 %). Alle sieben
   Kartei-Tabellen sind (§) service_role-only; Nachweise/Schulungen liest die
   Schichtleitung im Scope, alles andere nur die Leitung (Rolle aus der DB).
   Slice-Modul `kartei.py` mit EINEM generischen Pfad über eine
   Tabellen-Registry statt sieben Kopien.

## Schutzmodell (Wurzel 6)

- (§) nur service_role: Akte, Dokumente, Urlaubskonten, Zeitkorrekturen,
  Arbeitszeitkonten, Monatsabschlüsse, Regeln, Fremdfirmen, Verträge +
  Nachträge, Maßnahmen, Vorfälle, Gespräche, Nachweise, Schulungen (0543).
- (R) Realtime-Quellen `personal_schichten`, `personal_abwesenheiten`,
  `personal_zeiterfassung`, `personal_veroeffentlichungen`: `grant select` +
  restriktive `for all`-Policy (Lesen nach Personen-Scope, `with check false`).
- (G) `feiertage` global lesbar.
- Dokumente im privaten Bucket `personal-dokumente`, Auslieferung nur signiert,
  Typ aus Magic-Bytes.

## Konsequenzen

- Sechs Sidebar-Einträge unter „Personal" (Mitarbeitende, Dienstplan,
  Abwesenheit, Zeiterfassung, Auswertung, Einstellungen), Gate über
  Capabilities `view_team_schedule`,
  `plan_schichten`, `approve_absence`, `confirm_time`, `manage_personal`,
  `export_lohn`.
- Fünf Benachrichtigungs-Kategorien (`dienstplan`, `abwesenheit_antrag`,
  `abwesenheit_entscheidung`, `schicht_offen`, `zeit_hinweis`), Mailtexte in
  24 Sprachen (`core/mail_texte_personal.py`, generiert).
- Worker-Tick stündlich: Feiertage je Betriebsland sicherstellen, offene
  Stempelungen > 16 h und ablaufende Dokumente, Nachweise und Schulungen
  melden.
- Betriebsauflage: `PERSONAL_AKTE_KEY` in api UND worker setzen (32 Byte
  base64); ohne ihn ist die Akte 503 (fail-closed).
- Offen (bewusst): Feiertags-Regionen in der Oberfläche, weitere Lohnformate
  (Danløn/Dataløn/Zenegy).
- KORREKTUR vom 04.09.2026: hier stand, `properties` trage keine Koordinaten.
  Das ist falsch — die Tabelle hat `lat` und `lng` seit 0003. Die Annahme hat
  live Schaden angerichtet: der Wetter-Abruf des Dienstplans griff auf
  `latitude`/`longitude` zu, und PostgREST antwortete
  `column properties.latitude does not exist` — der ganze Wochenplan gab 500,
  nicht nur das Wetter. Zwei Lehren: ein Spaltenname wird an der Migration
  geprüft, nicht aus dem Gedächtnis geschrieben; und eine Nebeninformation
  (Wetter) darf den Hauptpfad (Plan) nicht kippen.

## Ausbau 04.09.2026 (0544–0548)

Freigabe des Betreibers am 04.09.2026 nach einem vollständigen Abgleich gegen
Taskilo und Gastromatic. Die fachliche Beschreibung steht in
`docs/PERSONAL-DIENSTPLAN-KONZEPT.md` Abschnitt 8, der Schnittstellenvertrag
der sieben parallelen Bau-Pakete in `docs/PERSONAL-AUSBAU-VERTRAG.md`.

Entscheidungen, die über das Konzept hinausgehen:

9. **Die Hotel-Zeile rechnet aus eigenen Buchungen, nicht aus einer
   Fremdschnittstelle.** Gastromatic bezieht Belegung, Gästezahl und An- und
   Abreisen über ein PMS (Protel, SIHOT, ASA, ibelsa). Wir SIND das PMS; die
   Zahlen kommen aus `reservations` und `property_units`. Definition wie im
   Buchungs-Dashboard: im Haus heißt `check_in <= Tag < check_out`, der
   Abreisetag zählt nicht mit. Eine zweite Definition an einer zweiten Stelle
   wäre eine zweite Wahrheit.
10. **Die Zuteilung der Autoplanung rechnet ein Solver, nicht das
    Sprachmodell.** OR-Tools CP-SAT hält Ruhezeit, Doppelbelegung,
    Qualifikation, Höchstarbeitszeit und Jugendschutz als HARTE Bedingungen
    ein; ein Sprachmodell tut das nicht verlässlich, und ein Dienstplan, der
    gegen das Arbeitszeitgesetz verstößt, ist schlimmer als keiner. Gemini
    erklärt das Ergebnis und beantwortet Fragen — beides Text, kein Beschluss.
    Der Solver läuft mit einem Suchthread und festem Seed, damit dieselbe
    Eingabe dieselbe Zuteilung ergibt: eine Erklärung zu einem nicht
    reproduzierbaren Ergebnis ist wertlos.
11. **Das Stempel-Terminal hat eine eigene Auth-Welt.** Der Bildschirm hängt an
    der Wand und hat keinen angemeldeten Nutzer: das Gerät weist sich mit einem
    Token im Header aus (gespeichert nur als SHA-256), die Person mit
    vierstelliger Stempel-ID und PIN (PBKDF2, 200 000 Runden). Ein Nutzer-Login
    dort wäre ein Dauer-Login für jeden, der vorbeigeht. Fail-closed: fehlender
    Token, unbekanntes Gerät, deaktiviertes Gerät und nicht freigegebene
    Terminals ergeben je 401 mit eigenem Grund. Eigener Rate-Limit-Eimer
    (`rate_limit_personal_terminal`, 30/60 je IP), und `/terminal` steht in der
    Ausnahmeliste der Web-Middleware — sonst hätte jeder Aufruf am Wandgerät
    das Refresh-Cookie der zuletzt angemeldeten Person verbraucht.
12. **Terminierte Aktenänderungen statt sofortiger Übernahme.** Eine
    Vertragsänderung „ab 01.07." liegt als Zeile mit Stichtag; der Worker
    wendet sie am Tag über denselben Schreibkern an wie ein Klick auf
    Speichern. Sofort schreiben würde Soll, Kosten und Urlaubsanspruch der
    Vergangenheit verfälschen; sich vormerken heißt vergessen.
13. **Der Lohnexport braucht einen freigegebenen Lauf.** Der Monatsabschluss-
    Assistent prüft sieben Fehlerarten; solange eine offen ist, bleibt der Lauf
    ein Entwurf und die Freigabe antwortet 409. Exportiert werden nur bestätigte
    Zeiten. Vorher war der Export ein Knopf ohne Zustand — wer wann was
    exportiert hatte, stand nirgends.
- Vier neue Benachrichtigungs-Kategorien (0548): `schicht_tausch`,
  `ueberstunden_antrag`, `ueberstunden_entscheidung`, `verspaetung`. Die
  Verspätung ist die einzige Personal-Kategorie mit Push, weil eine Schicht,
  die unbesetzt anläuft, JETZT jemanden braucht.
- Betriebsauflage bleibt: `PERSONAL_AKTE_KEY` in api UND worker.
  `VERTEX_SERVICE_ACCOUNT_B64` und `VERTEX_PROJECT_ID` braucht NUR die api:
  Prognose, Autoplanung und Assistent laufen ausschließlich auf Knopfdruck,
  der stündliche Worker-Tick ruft kein Modell (geprüft am Code, nicht
  angenommen). Sollte später ein Tick eine Prognose erzeugen, gehören beide
  Variablen auch in den Worker — sonst schweigt die Funktion dort still
  (`is_configured` ist dann `false`).
