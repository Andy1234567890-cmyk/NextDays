# Werkzeuge der Framer-Vollerfassung (05./06.09.2026)

Ergebnis: `docs/FRAMER-EDITOR-VOLLERFASSUNG-2026-09-05.md` (kuratierte Notizen + Roh-Dumps je Zustand).

- `empfaenger.mjs` — lokaler HTTP-Empfänger (127.0.0.1:8899, POST `/save?name=`), weil die Tool-Ausgabe der
  Chrome-Extension bei ~1.500 Zeichen abschneidet; die Seite schickt DOM-Dumps per `fetch` (Framer-CSP lässt es zu).
- `bericht.py` — baut die MD aus `notizen.md` (kuratiert) + `dumps/*.txt` (Rohdaten) + `titel.json` (Überschriften).
- Browser-Helfer wurden per `javascript_tool` in die Seite injiziert: `__dump` (DOM → Zeilen mit tag/role/text/aria/
  title/opts), `__snap`/`__diff`/`__rest` (Zustandsvergleich, sprach- und positionsneutral), `__fire` (volle
  Pointer-/Maus-Sequenz, weil Framer auf `pointerdown/up` hört, nicht auf `click()`), `__dragJS` (Pointer-Drag in
  Schritten), `__sec`/`__subWahl`/`__menuWahl` (Sektionsköpfe, Menüeinträge).
Regeln, die sich dabei bewährt haben, stehen in der Memory-Datei `framer-dom-erfassung-per-pointer-events`.
