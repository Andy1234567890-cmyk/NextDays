# Personal & Dienstplan für myNextDays — Konzept

Stand: 04.09.2026 — **gebaut** (ADR-0023, Migrationen 0540–0548, Slice `personal`, `/hr/*`; Ausbau siehe Abschnitt 8). Grundlage: drei parallele Analysen (Gastromatic als Referenz,
das Taskilo-Modul `/Users/andystaudinger/taskilo-platform`, der myNextDays-
Bestand) mit acht Teilberichten. Die vier offenen Fragen hat der Betreiber am
03.09.2026 entschieden (Abschnitt 7); wird mit Etappe 1 zu ADR-0023.

## 1. Zielbild in einem Satz

Gastromatic für Reinigungs-, Wäsche- und Hausmeisterpersonal eines
Ferienwohnungs-Verwalters: Dienstplan, Zeiterfassung, Abwesenheiten, Konten,
Personalakte, Lohnvorbereitung — als Slice von myNextDays, zuerst im Web
(Planung und Mitarbeitersicht), die iOS-/Android-App für die Mitarbeitenden
folgt später als eigenes Projekt (E5).

Der entscheidende Unterschied zur Gastronomie: **der Bedarf kommt nicht aus
Umsatz, sondern aus Abreisen und Wechseltagen.** Die Aufgaben-Engine erzeugt
den Bedarf bereits (Reinigung am Abreisetag, Anreisecheck, Wäsche); der
Dienstplan macht daraus Einsätze mit Personen und Zeiten.

## 2. Was aus Taskilo übernommen wird — und was nicht

Das Taskilo-Modul (~24.600 Zeilen Frontend) ist ein reich ausgebautes
Datenmodell und eine fertige Oberflächenstruktur **ohne funktionierendes
Backend**: Schichten, Wunschzeiten, Abwesenheiten, Zeiterfassung und Lohn
laufen auf Catch-all-Routen ohne Mandantenfilter, PATCH/DELETE wirken nicht,
eAU/GPS/KI/Integrationen sind Fassaden, beide Login-Endpunkte lassen jeden
ein. Übernommen wird deshalb die **fachliche Struktur**, nicht der Code.

| Aus Taskilo | Übernahme |
|---|---|
| Personalakte als Tabs: Grunddaten, Vertrag, Arbeitszeit, Urlaub, Dokumente, Qualifikationen, Compliance (Belehrungen, Gesundheitszeugnis, Führungszeugnis) | Struktur ja; Felder gegen unser Modell gesiebt |
| Dienstplan-Grid Mitarbeiter × Wochentage, Schichttypen mit Farbe, Quick-Create, Woche kopieren, Stunden Soll/Ist je Zeile | Bauform ja; Schichttyp wird ECHTES Feld (Taskilo riet ihn aus Notizen) |
| Abwesenheit → materialisierte Ganztags-Schicht; Genehmigung ändert Schichten | Prinzip ja, serverseitig |
| Rechenkern: Ostern/Feiertage (Gauß korrekt), Konfliktprüfung (Ruhezeit, Höchstarbeitszeit, Pausen), Zuschlagsstruktur, Kostenformel | Als Python-Modul mit Tests neu geschrieben; Werte aus Konfiguration je Land/Betrieb, keine deutschen Hardcodes |
| Wunsch-/Sperrzeiten mit `dateType` einzeln/wiederkehrend | Ja, mit Wirkung im Plan (in Taskilo ohne) |
| App-Zugang mit 4 Rechten, Firmencode, PIN | Nein — wir haben Nutzer, Rollen, Capabilities, Einladung, MFA |
| Lohnberechnung (25 % Steuer, erfundene SV-Anteile), „DATEV-Export" | Nein — nur Lohn-VORBEREITUNG und Export, Abrechnung bleibt extern |
| KI-Planung, eAU, Integrations-Seite, Analytics, Mobile-Marketing-Seite | Nein |

## 3. Kernentscheidungen (zur Freigabe)

**E1 — Schicht ≠ Aufgabe, aber verzahnt.** Eine *Schicht* ist der Arbeitszeitblock
einer Person (wann sie arbeitet, an welchem Objekt/Gebäude, in welchem
Arbeitsbereich). Eine *Aufgabe* ist, was sie tut. Der Dienstplan zeigt
Schichten und darin die Aufgaben desselben Tages. Aus Aufgaben ohne
Schichtdeckung entsteht **Bedarf** („Schichthülle" bei Gastromatic): unbesetzt
sichtbar, ausschreibbar, per Zuweisung geschlossen. Zuweisung einer Aufgabe an
eine Person ohne Schicht/Verfügbarkeit → Warnung, kein Verbot.

**E2 — Person = `users`-Zeile.** Jede Mitarbeiterin hat ein Konto (Rolle
`staff`/`cleaner`); Dienstplan, Stempeln und Anträge laufen zuerst im Web,
später in der eigenen iOS-/Android-App (E5).
Die Personalakte hängt 1:1 daran (`personal_akten.user_id`), sensible Felder
in eigener Tabelle mit Wurzel-6-Schutz (revoke + admin/co_admin-Policy;
`owner` sieht nichts). Keine zweite Personen-Entität ohne Login.
**Externe Kräfte** (Fremdfirma, Entscheidung 4) sind ebenfalls `users`-Zeilen
(Rolle `cleaner`, Konto per Einladung) mit `personal_akten.beschaeftigungsart =
'extern'` und `firma_id` auf eine Zeile `personal_fremdfirmen` (Name, Kontakt,
Abrechnung je Einsatz/Stunde). Für sie gibt es keine Lohnfelder, kein
Urlaubskonto, kein Arbeitszeitkonto und keinen Lohnexport; Schichten,
Zeiterfassung und Bedarf laufen identisch. Die Fremdfirma bleibt Kostenstelle
für die Personalkosten je Objekt (Etappe 5).

**E3 — Land ist Konfiguration, nicht Code — für alle 27 EU-Länder.** Der
Beta-Betrieb ist Dänemark (DKK, Ferieloven), das Modul gilt aber wie die
Währungsregel für die ganze EU (Entscheidung 1). Das Land kommt aus dem
Tenant (`tenants.country`), nie aus einer Annahme. Feiertage kommen aus der
Tabelle `feiertage` je Land/Region/Jahr; befüllt wird sie über einen
Import aus einer gepflegten Quelle (Python-Paket `holidays`, deckt alle EU-
Länder samt Regionen; Skript `scripts/personal/feiertage-importieren.py`,
Jahr voraus, idempotent per UNIQUE land/region/datum). Ohne Eintrag für das
Land des Betriebs ist die Feiertagsprüfung ein 422 in der Regel-Einrichtung,
kein stiller Leerlauf (Wurzel 4/5). Zuschlagssätze, Pausenmodelle,
Urlaubsanspruch, Ruhezeiten und Höchstarbeitszeit stehen in `personal_regeln`
je Betrieb; gesetzliche Mindestwerte je Land liegen als versionierte
Vorschlagsdatei `apps/api/src/features/personal/laender.py` bei (Quelle und
Stand je Land als Kommentar), die der Betrieb beim Einrichten sieht und
bestätigt — ein Vorschlag, kein Fallback. Länder ohne Datensatz bekommen
keinen Vorschlag und müssen die Werte selbst eintragen.

**E4 — Lohn nur vorbereiten, erster Export DATEV.** Stunden, Zuschläge,
Abwesenheiten, Konten → Export, keine Netto-/Steuerberechnung. Erstes und in
Etappe 5 einziges Format ist der **DATEV-Lohnimport** (Entscheidung 3:
Bewegungsdaten LODAS/Lohn und Gehalt als ASCII-Import, Personalnummer =
`employee_number`, Lohnarten je Betrieb konfigurierbar, kein erfundenes
Mapping). Weitere Formate (Danløn, Dataløn, Zenegy, …) entscheidet der
Betreiber später; der Export ist deshalb als Schnittstelle mit einem
Formatierer je Lohnprogramm gebaut, nicht als DATEV-Sonderfall.

**E5 — Erst Web, die Mitarbeiter-App (iOS/Android) später und separat.** Das Modul wird
zuerst vollständig im Web gebaut (`/hr/*`, Sidebar-Gruppe „Personal" existiert
bereits, 24 Sprachen fertig, heute per `HIDDEN_AT_LAUNCH` ausgeblendet):
Planung und Verwaltung durch die Leitung. Die Mitarbeitersicht (eigener
Plan, Stempeln, Anträge) gibt es im Web NICHT (Betreiber 04.09.2026: „wir
planen doch hier alles“) — die API dafür ist fertig und so geschnitten, dass
die App sie ohne Umbau nutzt; bis dahin trägt die Leitung Zeiten und
Abwesenheiten der Mitarbeitenden selbst ein. Die **Mitarbeiter-App** kommt danach als
**eigenes Projekt** (Entscheidung des Betreibers 03.09.2026, analog
`mobile-owner`/ADR-0022; eigener ADR), nicht als Tabs in `mobile-nextdays`
und nicht in diesen fünf Etappen.

**E6 — Schichtleitung ist eine eigene Rolle** (Entscheidung 2): Rollen im
Personalbereich sind Admin, Co-Admin, Schichtleitung. `users.role` bekommt
den Wert `shift_lead` (Migration: CHECK-Constraint, Pydantic-Literal,
Frontend-Unions und Rollen-Labels in 24 Sprachen deckungsgleich — dieselbe
Kette wie bei Kanal-Enums, geprüft per Skript). Rechte: `plan_schichten`,
`view_team_schedule`, Abwesenheiten entscheiden, Zeiten bestätigen —
für die Personen und Objekte, die ihr zugewiesen sind (`user_property_assignments`,
Item-Level-Scope wie die Liste, Wurzel 9). Keine Akte, kein Lohn, keine
Finanzen (§4.3). Alle DB-Scope-Helfer bleiben fail-closed: `shift_lead` wird
dort explizit aufgenommen, nicht über einen Default erlaubt (Wurzel 6).

## 4. Datenmodell (Slice `personal`, Migrationen ab 0540)

Alle Tabellen tenant-gescoped, RLS + Tenant-Policy; markierte (§) zusätzlich
`revoke all from anon, authenticated` + restriktive Rollen-Policy.

| Tabelle | Zweck | Kern |
|---|---|---|
| `personal_akten` § | Personalakte 1:1 zu `users` | employee_number, eintritt, austritt, beschaeftigungsart (vollzeit, teilzeit, aushilfe, extern), firma_id?, wochenstunden, tagesstunden, stundenlohn_minor + currency, gehalt_minor, urlaubsanspruch_tage, geburtsdatum, adresse, notfallkontakt, steuer-/sv-kennungen (verschlüsselt), bank (verschlüsselt); bei `extern` sind Lohn-/Urlaubsfelder leer und per CHECK gesperrt |
| `personal_fremdfirmen` | Externe Dienstleister (Reinigungsfirma …) | name, kontakt, abrechnung (je_einsatz, je_stunde), satz_minor + currency, notiz |
| `personal_arbeitsbereiche` | Reinigung, Wäsche, Hausmeister, Anreise-Service … je Betrieb | name, farbe, sort |
| `personal_qualifikationen` | Zuordnung Person ↔ Arbeitsbereich/Objekt | user_id, arbeitsbereich_id, property_id? |
| `personal_schichtvorlagen` | Früh/Spät/… je Betrieb | name, kurz, start, ende, pause_min, farbe, arbeitsbereich_id |
| `personal_schichten` | Einsätze | user_id (null = offen/Bedarf), datum, start_at, end_at (tz-fest über Objektzone), pause_min, arbeitsbereich_id, property_id/building_id, vorlage_id, status (entwurf, veroeffentlicht, bestaetigt, abgesagt), quelle (manuell, vorlage, bedarf_aufgabe, abwesenheit), abwesenheit_id?, notiz |
| `personal_schicht_aenderungen` | Protokoll je Änderung (wer, was, wann) | Wurzel 5b: Zeitpunkt der Handlung |
| `personal_veroeffentlichungen` | Plan-Veröffentlichung je Woche + Lesebestätigungen | woche, veroeffentlicht_von/am; `personal_lesebestaetigungen` |
| `personal_verfuegbarkeiten` | Wunsch-/Sperrzeiten | art (wunsch, gesperrt), wiederkehrend_wochentag?, datum_von/bis?, zeit_von/bis?, ganztags, status |
| `personal_abwesenheiten` § | Anträge | art (urlaub, krank, unbezahlt, sonderurlaub, schulung, frei), von, bis, halbtag_start/ende, tage_berechnet, status (beantragt, genehmigt, abgelehnt, storniert), entschieden_von/am, kommentar, attest_asset? |
| `personal_urlaubssperren` | Zeiträume ohne Urlaub, mit Grund, je Arbeitsbereich | |
| `personal_urlaubskonten` § | Jahreskonto je Person | jahr, anspruch, uebertrag, verfall_am, genommen, geplant |
| `personal_zeiterfassung` § | Stempelungen | user_id, start_at, end_at, pausen[] (jsonb), quelle (app, web, korrektur), schicht_id?, task_id?, property_id?, standort_start/ende (lat, lng, distanz_m), status (offen, abgeschlossen, bestaetigt), bestaetigt_von/am |
| `personal_zeit_korrekturen` § | jede Korrektur mit Grund, alt/neu | Audit |
| `personal_pausenmodelle` | automatische Pausen je Betrieb/Arbeitsbereich | ab_stunden → minuten |
| `personal_arbeitszeitkonten` § | AZK-Buchungen | user_id, datum, minuten, grund, bezug |
| `personal_regeln` | Betriebseinstellungen | land, ruhezeit_std, max_tagesstunden, nacht_von/bis, zuschlaege (nacht/sonntag/feiertag in %), urlaubsjahr_start, uebertrag_regel |
| `feiertage` | je Land/Region/Jahr, importiert (alle EU-Länder) | land, region?, datum, name, quelle, UNIQUE(land, region, datum) |
| `personal_dokumente` § | Dokumente der Akte (Assets privat, signierte URLs) | art (inkl. datenschutz, betriebsvereinbarung), ablauf_am, angefragt_am, eingereicht_am, geprueft_von, dokument_nummer, ausgestellt_am, behoerde (0543) |
| `personal_vertraege` § + `personal_vertrag_nachtraege` § | Verträge & Vereinbarungen mit Nachträgen (Feld-Diff) | art, titel, status, version, unterzeichnet_am, gueltig_ab/bis, unterzeichner, bedingungen, verlaengerung, kuendigung, dokument_id (0543) |
| `personal_massnahmen` § | Disziplinarmaßnahmen | art (ermahnung … kuendigung), datum, grund, ausgestellt_von, zeuge, stellungnahme, folgetermin, geloest/geloest_am/loesung (0543) |
| `personal_vorfaelle` § | Arbeitsplatzvorfälle | datum, art, schwere, ort, beschreibung, zeugen, massnahmen, praevention, gemeldet_von, folge_noetig (0543) |
| `personal_gespraeche` § | Feedback-/Mitarbeitergespräche | datum, art, bewertung 1–5, notizen, ziele, erfolge, entwicklung, gefuehrt_von, naechstes_am (0543) |
| `personal_nachweise` § | Ausbildung, Zertifikate (mit Ablauf), Sprachen, Fähigkeiten, Berufserfahrung | art, titel, stelle, stufe, von, bis, ablauf_am, kennung, dokument_id (0543) |
| `personal_schulungen` § | Sicherheitsschulungen/Belehrungen | titel, trainer, abgeschlossen_am, gueltig_bis, dokument_id (0543) |
| `personal_akten` (0543) | + `lohnmerkmale` (Paare je Land), `arbeitgeber_aufschlag_pct` (Kostenkachel), `familienstand`, `kinder_anzahl` | |

Realtime: `personal_schichten`, `personal_abwesenheiten` (Status), `personal_zeiterfassung`
(offene Stempelung) — mit eigener Lese-Policy statt Grant-Öffnung; Prüfung
`scripts/realtime/abos-pruefen.sh`.

Capabilities (neu): `manage_personal` (admin, co_admin), `plan_schichten`
und `view_team_schedule` (admin, co_admin, shift_lead), `view_own_schedule`,
`track_own_time`, `request_absence` (shift_lead, staff, cleaner); vorhanden
und dann genutzt: `manage_own_availability`, `request_substitute`. Sidebar:
`req` an den vier HR-Einträgen (fehlt heute), `"staff"` aus `HIDDEN_AT_LAUNCH`.

Benachrichtigungen (Katalog, je Empfänger eine Kategorie): Dienstplan
veröffentlicht/geändert (an Mitarbeitende, Push + Lesebestätigung),
Abwesenheit beantragt (an Leitung), Abwesenheit entschieden (an
Antragsteller), offene Schicht ausgeschrieben (an passende Mitarbeitende),
Stempelung fehlt/auffällig (an Leitung). Mailtexte in `mail_texte_personal.py`
× 24 Sprachen.

## 5. Etappen

**Etappe 1 — Fundament (Web)**: Slice-Gerüst, Migration Akte/Fremdfirmen/
Arbeitsbereiche/Regeln/Feiertage, Rolle `shift_lead` durch alle fünf Stellen,
Capabilities, Sidebar frei, Mitarbeiterliste + Akte mit Tabs (Grunddaten,
Vertrag & Arbeitszeit, Qualifikationen, Dokumente; Reiter „Fremdfirma" bei
extern) aus der Benutzerverwaltung heraus, Feiertags-Import für alle EU-Länder
(Jahr laufend + folgend), Länder-Vorschlagswerte mit Quelle, i18n.

**Etappe 1b — Kartei (04.09.2026, 0543, ADR-0023 Punkt 8)**: die Akte auf
den Stand der Taskilo-Kartei — Kopf mit Kurzinfo-Karten (eine Abfrage
`/mitarbeiter/{id}/uebersicht`), zwölf Reiter (Grunddaten, Vertrag &
Arbeitszeit, Verträge, Qualifikationen, Dokumente, Compliance, Urlaub &
Anträge, Arbeitszeit, Verfügbarkeit, Gespräche, Disziplin, Zugang), Liste als
Karten-Grid mit Kennzahl-Kacheln, „Mitarbeiter hinzufügen" über den
Nutzer-Wizard (Rolle vorbelegt, Sprung zur Akte) und CSV-Export.

**Etappe 2 — Dienstplan (Web)**: Schichten CRUD, Wochenansicht Personen ×
Tage (neue Bauform: Personen als Zeilen, Tag/Woche/Monat nach
`calendar-views.tsx`; Zeitzonen-/DnD-Muster aus `tasks-calendar.tsx`),
Vorlagen, Woche kopieren, Bedarf aus Aufgaben (Abreisen) als offene Schichten,
Konfliktprüfung serverseitig (Ruhezeit, Höchststunden, Abwesenheit,
Doppelbelegung, Qualifikation), Veröffentlichen mit Benachrichtigung und
Lesebestätigung, Schicht ausschreiben/bewerben; Mitarbeitersicht „Mein
Dienstplan" im Web (bestätigen, bewerben, Deep-Links aus Mail/Push).

**Etappe 3 — Abwesenheit & Verfügbarkeit (Web)**: Antrag durch die
Mitarbeitenden (Urlaub, krank mit Attest-Upload, unbezahlt), Genehmigung mit Konfliktanzeige
(geplante Schichten), Urlaubskonto (anteilig bei Ein-/Austritt, Übertrag,
Verfall nach Betriebsregel), Urlaubssperren, Wunsch-/Sperrzeiten mit Wirkung
im Plan, Krankenstand-Übersicht.

**Etappe 4 — Zeiterfassung (Web)**: Stempeluhr im Browser (Start/Pause/Ende,
Standort per Browser-Geolocation mit Abgleich zum Objekt, Hinweis bei
Planabweichung), Korrektur mit Pflichtgrund und Protokoll, Pausenmodelle,
Soll-Ist je Schicht/Aufgabe, AZK-Buchungen, Monatsfreigabe. Die API-Verträge
für Stempeln sind so gebaut, dass die spätere App mit Offline-Warteschlange
(Zeitstempel vom Gerät, Idempotenz-Schlüssel je Stempelung, Wurzel 2/5b)
ohne Änderung andockt.

**Etappe 5 — Auswertung & Lohnvorbereitung (Web)**: Stunden, Zuschläge
(Nacht/Sonntag/Feiertag nach Betriebsregel), Abwesenheiten, Konten je Person
und Zeitraum; Personalkosten je Objekt inkl. Fremdfirmen (Anschluss an
Dienstleistungspreise/Eigentümer-Abrechnung 0531); Export CSV + DATEV-
Lohnimport über eine Formatierer-Schnittstelle (weitere Formate später).

Nicht geplant: KI-Planung, eAU-Abruf, umsatzbasierte Bedarfsplanung,
Kassenschnittstellen, Netto-Lohnberechnung.

## 6. Mitarbeiter-App iOS/Android (später, eigenes Projekt)

Befund im Bestand: `mobile-nextdays` hat für Mitarbeitende heute nur Aufgaben
+ Profil; es fehlen Geolocation-Paket und -Rechte, Offline-Speicher (kein
AsyncStorage/MMKV), Hintergrundlauf, i18n (alle Texte hartcodiert deutsch),
und der Erlebnis-Router zeigt `staff`/`cleaner` auf einen nicht existierenden
Tab `Dashboard`. Nichts davon wird in den Etappen 1–5 angefasst. Die
Mitarbeiter-App entsteht danach als eigenes React-Native-Projekt mit eigenem
ADR (Muster `mobile-owner`, ADR-0022: Kopie der Schwesterdateien, CI-Diff);
sie braucht Geolocation, Offline-Warteschlange fürs Stempeln, Push für
Planänderungen und die hier gebaute API unverändert.

## 7. Entscheidungen des Betreibers (03.09.2026)

1. **Länder:** alle EU-Länder von Anfang an (→ E3).
2. **Schichtleitung:** eigene Rolle neben Admin und Co-Admin (→ E6).
3. **Lohnprogramm:** DATEV-Export zuerst; weitere Formate später (→ E4).
4. **Fremdfirmen:** ja, externe Reinigungskräfte werden im Dienstplan
   geführt, ohne Lohn- und Urlaubsfelder (→ E2, `personal_fremdfirmen`).
5. **Mitarbeiter-App:** später und separat als eigenes Projekt; alle fünf
   Etappen sind Web + API (→ E5, Abschnitt 6).

## 8. Ausbau 04.09.2026 (0544–0548) — Taskilo-Lücken, Hotel-Zeile, Gastromatic, KI

Freigabe des Betreibers am 04.09.2026, nach einem Datei-für-Datei-Abgleich
gegen das Taskilo-Modul und einer Recherche über zehn Gastromatic-Produktseiten,
30 Screenshots und das archivierte Hilfe-Center. Auftrag wörtlich: *„bitte alles
nachziehen und oben müssen wir auch im haus gäste / An und abreisen und alle
funktionen wie bei gastromatic einbauen"*, dazu *„besonderst die ganzen
auswertungen, listen etc"* und *„besonders die AI Funktion die können wir mit
gcloud alles umsetzetn"*.

Der Schnittstellenvertrag, gegen den die sieben Bau-Pakete parallel gearbeitet
haben, liegt in `docs/PERSONAL-AUSBAU-VERTRAG.md` (Dateibesitz, alle Endpunkte,
JSON-Formen, Spaltenschlüssel der Berichte, Gewichtungstabelle der
Planungstypen). Er bleibt als Referenz stehen: er beschreibt, WAS zugesagt war,
und die Abschnitte hier, was daraus wurde.

### 8.1 Was neu ist

**Dienstplan (0544).** Tages-, Wochen- und Monatsansicht plus Liste,
Gruppierung nach Arbeitsbereich mit einklappbaren Blöcken, Filter (Bereich,
Objekt, Person, Suche) mit Zustand in der URL, Mehrfachauswahl mit Verschieben,
Zuweisen, Freigeben und Löschen, Woche leeren, Wochenvorlagen (Gerüst
speichern und anwenden), Schichttausch zwischen zwei Personen mit Freigabe
durch die Planung, CSV-Export und Druck als PDF, Legende als eigenes Element.
Wunsch- und Sperrzeiten, Geburtstage, Schichtleitungs-Marker, Arbeitszeitkonto,
Zuschlagssumme und Verdienstgrenze stehen in der Zeile bzw. der Summenspalte;
Wetter je Tag kommt aus Open-Meteo mit Cache (`wetter_tage`) und der Koordinate
des Objekts, nicht aus einer festen Stadt.

Die Wetterlage wird an EINER Stelle benannt: `personal.terminal.wetterLage.*`,
und die Namen dort entsprechen exakt den elf Rückgaben von `wetterName()` in
`web/lib/personal-planung-typen.ts`. Der Block `personal.wetter.*` daneben ist
VERWAIST — er trägt andere Namen (`leichtBewolkt`, `bewolkt`, `hagel`, dafür
kein `heiter`/`bedeckt`/`schneeschauer`) und war deshalb nie zu treffen: der
Dienstplan-Kopf zeigte am 04.09.2026 `MISSING_MESSAGE personal.wetter.bedeckt`,
weil er dorthin auflöste. Er ist absichtlich stehengelassen (nichts löschen
ohne Auftrag), darf aber NICHT benutzt werden; ein neuer Wettercode gehört zu
`wetterLage` und zu `wetterName()`, nicht hierher.

**Zwei neue Konfliktarten** im Rechenkern: `jugendschutz` (Fehler, aus dem
Geburtsdatum und den Landesregeln) und `verdienstgrenze` (Warnung, aus
geplanten plus bestätigten Minuten mal Stundenlohn). Beide Werte sind
Konfiguration je Betrieb, kein Hardcode (Wurzel 4).

**Kennzahlen (0545).** Über dem Plan die Hotel-Zeile je Tag: Anreisen,
Abreisen, Gäste im Haus, belegte von gesamten Einheiten, Belegung in Prozent.
Sie rechnet aus UNSEREN Buchungen — Gastromatic hat diese Zahlen nur über eine
PMS-Schnittstelle (Protel, SIHOT, ASA, ibelsa), wir sind das PMS. Darunter,
nur mit Finanzrecht: Umsatz (Ist und Plan), Personalkosten, Personalkostenquote,
Umsatzproduktivität mit Zielmarke, Stundenlimit und Budget mit Abweichung. Je
Arbeitsbereich zeigt der Plan Soll- gegen Ist-Besetzung, Stundenlimit und
Anzahl Einsätze; welche Zeilen erscheinen, steht in `personal_regeln.kennzahlen_zeilen`.

**Bedarfsplanung (0545).** Schichthüllen (`personal_bedarf`): Soll-Besetzung je
Bereich, Wochentag oder Datum und Zeitfenster. Eine Tageszeile ERSETZT die
Wochentag-Vorlage desselben Bereichs an diesem Tag — dieselbe Regel in den
Kennzahlen und in der Hüllen-Expansion, damit Plan und Auswertung nicht
verschieden zählen (Wurzel 1). Dazu Produktivitätsannahmen je Bereich (Basis:
belegte Einheiten, Abreisen, Anreisen, Gäste, Umsatz oder feste Stunden),
Budget-Leitplanken und ein Umsatzbuch mit Plan- und Ist-Umsatz je Tag.

**KI über Google Cloud (0546).** Drei Werkzeuge, ehrlich getrennt:
* Die **Bedarfsprognose** rechnet der Server deterministisch aus der
  Buchungslage und den Produktivitätsannahmen; Gemini (Vertex AI, regional
  europe-west4) erklärt nur das Ergebnis. Ohne Annahmen antwortet sie 422
  `produktivitaet_fehlt` statt eine Zahl zu erfinden.
* Die **Autoplanung** verteilt die Hüllen mit einem Solver (OR-Tools CP-SAT),
  NICHT mit dem Sprachmodell: ein Sprachmodell hält Ruhezeit,
  Doppelbelegung und Jugendschutz nicht verlässlich ein. Die sieben
  Planungstypen von Gastromatic (Performer, Alleskönner, Superfaire,
  Zeitschwärmer, Talentscout, Faire, Philanthrop) sind Gewichtungen der
  weichen Ziele. Ergebnis sind Varianten als ENTWURF; veröffentlicht wird von
  Hand.
* Der **Assistent** beantwortet Fragen zum Plan aus den Plandaten — ohne Lohn
  und ohne Kennungen im Kontext.
Jede erzeugte Ausgabe trägt `content_origin='ki'` (EU AI Act Art. 50 Abs. 2)
und läuft über den Tagesdeckel je Betrieb (`site_ai_usage`, Funktionsnamen
`personal_prognose`, `personal_autoplan`, `personal_assistent`).

**Zeiterfassung (0544).** Stempel-Terminals: ein Gerät je Standort mit eigenem
Token, Personen weisen sich mit vierstelliger Stempel-ID und PIN aus — kein
Nutzer-Login an einem Bildschirm, der an der Wand hängt. Fünf Fehlversuche
sperren die Stempel-ID 15 Minuten. Dazu die Regel „Arbeitszeit erst ab
Schichtbeginn", GPS-Pflicht mit Radius, Verspätungsmeldung an die Leitung
(einzige Personal-Kategorie mit Push), Stempeluhr im Browser für die eigene
Person, Zusammenfassung je Person und die Liste „unbestätigt und verpasst".
Überstundenanträge buchen bei Genehmigung auf das Arbeitszeitkonto; Guttage
sind ein eigenes Konto.

**Abwesenheit (0544).** Optional zweistufige Genehmigung (Schichtleitung
vorgenehmigt, Leitung entscheidet), Höchstdauer zusammenhängenden Urlaubs,
Urlaubskalender als Gantt über Woche, Monat und Jahr, und eine Vorschau im
Antrag, die Tage, Restanspruch, Sperren, betroffene Schichten und gleichzeitig
abwesende Kollegen zeigt, bevor abgeschickt wird.

**Akte (0544).** Verdienstgrenze je Person (Monat oder Jahr), Terminal-Zugang,
und terminierte Änderungen: „ab 01.07. dreißig statt vierzig Stunden" liegt als
Zeile mit Stichtag, der Worker wendet sie am Tag an. Wer es sofort in die Akte
schreibt, verfälscht Soll, Kosten und Urlaubsanspruch der Vergangenheit.

**Berichte und Lohnlauf (0547).** Fünfzehn Berichte in einem Rahmen mit
gemeinsamen Filtern, CSV und Druck: Stundenkonten, Soll gegen Ist, Zuschläge,
Personalkosten, Verlauf der Personalkostenquote, Produktivität, Urlaub, Krank,
Abwesenheiten, Verdienstgrenzen, Fristen, Monatsabschlüsse, Lohnvorschau,
Dienstplan und Mitarbeitende. Der Lohnlauf ist ein Vorgang je Monat mit der
Kette Entwurf → geprüft → freigegeben → exportiert; der Monatsabschluss-Assistent
prüft vorher auf unbestätigte Zeiten, offene Stempelungen, fehlende
Monatsabschlüsse, fehlenden Lohn oder fehlende Währung, fehlende Lohnarten und
überschrittene Verdienstgrenzen. Exportiert wird nur aus einem freigegebenen
Lauf und nur mit bestätigten Zeiten.

### 8.2 Was bewusst NICHT gebaut wurde

* **eAU-Abruf** (elektronische Arbeitsunfähigkeit): braucht Zertifikat und
  Krankenkassen-Anbindung, ist ein eigenes Vorhaben.
* **Kassenanbindung** als Umsatzquelle: für ein Hotel ist die Buchungslage die
  bessere Quelle, und die haben wir selbst.
* **Lohnabrechnung als Dienstleistung** und **Lohnscheinversand**: wir bereiten
  vor und exportieren, die Abrechnung bleibt extern.
* **Weitere Lohnformate** (Lexware, ADDISON, eurodata …): ohne offizielle
  Spezifikation wird kein Satzaufbau geraten (Wurzel 4).
* **App-Funktionen** (Tausch bestätigen, Dokumente unterschreiben): gehören in
  die Mitarbeiter-App, nicht ins Web (E5, Abschnitt 6).

### 8.3 Was von Gastromatic NICHT belegbar war

Die Recherche hat auch Grenzen gefunden, und die stehen hier, damit sie nicht
später als Tatsache zitiert werden: ob und wie Gastromatic Hotel-Kennzahlen als
eigene Zeile im Dienstplan zeigt, ist **nicht belegt** — belegt ist nur, dass
die PMS-Schnittstellen Belegung, Gästezahl sowie anreisende, abreisende und
aktuelle Gäste liefern. Ebenfalls unbelegt: Druck- und PDF-Ausgabe des
Dienstplans, Mehrfachauswahl und eine Legende. Wir haben alle drei trotzdem
gebaut, weil der Betreiber sie ausdrücklich verlangt hat.

### 8.4 Demo-Bestand

Der Personalbereich des Demo-Hotels („Hotel Seeblick Warnemünde", Admin
`jonas.reimers@mynextdays.com`) entsteht über `scripts/demo/personal.py`,
eingehängt in `scripts/demo/seed_demo.py`. Der Schalter `--nur-personal` baut
ihn auf, ohne Buchungen und Fotos neu zu würfeln — sonst zeigten die
Marketing-Screenshots danach andere Zahlen. Zweimal laufen ergibt denselben
Bestand.
