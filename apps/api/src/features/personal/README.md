# personal — Personal & Dienstplan

Gemountet unter `/api/v1/personal`. Konzept: `docs/PERSONAL-DIENSTPLAN-KONZEPT.md`,
Entscheidung: ADR-0023. Migrationen 0540–0543.

| Modul | Zweck |
|---|---|
| `service.py` | Mitarbeiterliste, Akte (verschlüsselte Kennungen), Fremdfirmen, Arbeitsbereiche, Qualifikationen, Dokumente (privater Bucket), Regeln + Länder-Vorschlag, Pausenmodelle, Schichtvorlagen |
| `schichten.py` | Wochenplan, Schicht anlegen/ändern/absagen mit Konfliktprüfung, Woche kopieren, veröffentlichen + Lesebestätigung, Bewerbungen, Bedarf aus Aufgaben |
| `abwesenheiten.py` | Anträge, Entscheidung (sagt Schichten ab), Urlaubskonten (gerechnet), Sperren, Wunsch-/Sperrzeiten, Krankenstand |
| `zeiterfassung.py` | Stempeluhr (eine offene je Person, idempotent), Korrektur mit Grund, Nachtrag, Bestätigung, AZK, Monatsabschluss |
| `auswertung.py` | Soll/Plan/Ist, Zuschläge minutenweise, Kosten je Person/Objekt, CSV + DATEV-LODAS |
| `kartei.py` | Kartei-Reiter (0543): Verträge + Nachträge, Maßnahmen, Vorfälle, Gespräche, Nachweise, Schulungen — EIN generischer Pfad über `TABELLEN`; Übersicht für den Akte-Kopf |
| `regelwerk.py` | Rechenkern ohne DB (Konflikte, Zuschläge, Pausen, Urlaubstage, Zwölftelung) |
| `laender.py` | Vorschlagswerte je EU-Land mit Quelle |
| `feiertage.py` | Import aus `holidays`, Abfrage mit lautem Fehlen |
| `tick.py` | Worker-Lauf stündlich |
| `benachrichtigungen.py` | fünf Kategorien, dedup_key je Meldung |

Scope: `_base.py::_personen_im_scope` — admin/co_admin alle, `shift_lead` sich
selbst + Personen an gemeinsam freigegebenen Objekten, staff/cleaner nur sich
selbst; deckungsgleich mit `public.personal_sieht_person`.

Tests: `uv run pytest src/features/personal -q` (Fake-DB in `tests/_fake.py`).
Umgebung: `PERSONAL_AKTE_KEY` (32 Byte base64) in api UND worker.
