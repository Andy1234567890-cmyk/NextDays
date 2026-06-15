# ADR-0005: Währungs- & Rundungs-Policy — glatte Beträge

- Status: **akzeptiert**
- Datum: 2026-06-15

## Kontext

Das Lastenheft (§1) verbietet strikt Cent-/Øre-Darstellungen. Alle Preise
systemweit (Schnittstellen, Widgets, Dashboards) müssen in **glatten Beträgen**
ausgegeben und gerundet werden.

## Entscheidung

- **Speicherung:** Beträge weiterhin als `numeric(12,2)` in der DB (Genauigkeit
  bewahren, korrekte Summen/Abrechnungen, OTA-Schnittstellen erwarten ggf. Dezimal).
- **Darstellung & nutzerseitige Eingabe:** auf **glatte Einheiten gerundet** (keine
  Nachkommastellen) — zentral in einer Formatierungs-Funktion pro Locale.
- **Rundungsregel:** kaufmännisches Runden (half-up) auf die ganze Währungseinheit
  für die Anzeige. Interne Berechnungen (Summen, Aufschläge) erfolgen exakt, erst
  die **Ausgabe** wird gerundet — keine kumulierten Rundungsfehler.
- **Konsistenz:** dieselbe Formatierung in Frontend (UI/Widgets) und Backend
  (E-Mails, PDFs, OTA-Payloads, soweit zulässig). Eine einzige Quelle der Wahrheit
  für die Formatierungslogik.

## Optionen

- **A) Cent-genau speichern als Integer (Minor Units)** — sauber, aber Umbau des
  bestehenden Schemas; Darstellung müsste trotzdem runden. Für später nicht
  ausgeschlossen.
- **B) numeric(12,2) speichern, glatt darstellen (gewählt)** — minimaler Umbau,
  erfüllt die Anforderung, behält Abrechnungsgenauigkeit.

## Konsequenz

- Shared-Formatierungs-Util (in `packages/shared` für TS, analog im Backend).
- Tests: Rundungsfälle (x.49 → x, x.50 → x+1), Locale-Format (DE/DK Komma vs. EN).
- OTA-/Gateway-Schnittstellen: wo das Gegenüber Dezimalbeträge verlangt, wird der
  exakte gespeicherte Wert übertragen, nicht der gerundete Anzeigewert.
