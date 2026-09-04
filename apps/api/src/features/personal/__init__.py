"""Slice `personal` — Personal & Dienstplan (Migrationen 0540/0541, ADR-0023).

Gastromatic für Reinigungs-, Wäsche- und Hausmeisterpersonal eines
Ferienwohnungs-Verwalters: Personalakte, Dienstplan, Abwesenheit und
Verfügbarkeit, Zeiterfassung, Konten, Lohnvorbereitung (DATEV).

Aufbau nach Fachgebiet (docs/PERSONAL-DIENSTPLAN-KONZEPT.md):
- `service.py`        Stammdaten: Mitarbeiterliste, Akte, Fremdfirmen,
                      Arbeitsbereiche, Qualifikationen, Dokumente, Regeln,
                      Pausenmodelle, Schichtvorlagen
- `schichten.py`      Dienstplan: Wochenplan, Konflikte, Bedarf aus Aufgaben,
                      Veröffentlichung, Bewerbungen
- `abwesenheiten.py`  Anträge, Urlaubskonten, Sperren, Wunsch-/Sperrzeiten
- `zeiterfassung.py`  Stempeluhr, Korrekturen, Arbeitszeitkonto, Monatsabschluss
- `auswertung.py`     Stunden, Zuschläge, Kosten je Objekt, DATEV-Export
- `regelwerk.py`      der reine Rechenkern (ohne DB)
- `laender.py`        gesetzliche Vorschlagswerte je EU-Land (Quelle je Zeile)
- `feiertage.py`      Import aus dem Paket `holidays`
"""
