# Ebenen-Bereich („Layers") — Befundliste vom 05.09.2026

Anlass: *„der ganze layer/ebenenbereich hat bugs"*. Code-Prüfung (nur lesen) von
`web/components/website/ebenen-liste.tsx`, `ebenen-baum.ts`,
`editor/abschnitts-editor.tsx`, `editor/flaechen-overlay.tsx`,
`builder/components/blocks/canvas-bridge.tsx`, `editor/sichtbarkeit.ts` und dem
Backend `site_config/{router,container,bloecke}.py`. Zeilenangaben Stand HEAD
`5ea59220`. Behebung in Etappe 1 von `BAUKASTEN-FRAMER-PARITAET-PLAN.md`.

## A · Zwei Bestände, einer wird nie nachgeführt (Wurzel der meisten Symptome)

1. **Der Baum sieht keine Baustein-Änderung.** `abschnitts-editor.tsx:1341`
   rendert `blocks={baumBlocks}`; `baumBlocks` kommt nur aus der Server-Prop
   (`:493-496`) und ändert sich nur nach `router.refresh()`. `schreibe`
   (`:594-735`) endet bei `setNeuLaden` (iframe) — kein Refresh. Hinzufügen,
   Löschen, Duplizieren, Umsortieren, Verstecken, Sperren eines Bausteins
   erscheinen im Baum erst nach einem Seiten-Reload. **Fehler (schwer).**
2. **Kontextmenü schreibt in `zeilen`, der Baum liest `baumBlocks`.**
   `:1372-1396` → `setZeilen` (`:1164-1243`); Schloss/Auge in der Zeile lesen aus
   `baumBlocks` (`ebenen-liste.tsx:459, 464`) → Klick zeigt im Baum nichts.
   Der Container-Pfad macht es richtig (`:1669-1671, 1709, 1716, 1754`). **Fehler.**
3. **Auge an einem Container ist eine Attrappe.** `:1364-1367` sucht `zeilen`
   (nur Widgets, `:150-151`) → für Abschnitt/Spalte `undefined`, stiller
   No-Op. Renderer könnte es (`block-renderer.tsx:650, 726`). **Attrappe.**
4. **`mitGetauschtemRang` wirkungslos** — `ebenen-baum.ts:29-46` sortiert nicht
   nach `position`; nur `bausteinReihenfolge` (`:108-109`). Optimistisches
   Hoch/Runter bewegt im Baum nichts. **Fehler.**
5. **`baumBlocks` übernimmt Serverdaten ohne `offen`-Guard** (`:494-496` vs.
   `:845-852`) → Baum und Liste zeigen nach Refresh Verschiedenes. **Inkonsistenz.**

## B · Auswahl Baum ↔ Fläche ↔ Inspektor

6. **Gewählter Container ohne Rahmen/Sprung auf der Fläche.** `containerId`
   wird nie an `FlaechenOverlay` gereicht (`:2300`); `aktivRect` nur aus
   `zeilen` (`flaechen-overlay.tsx:187, 456`); `scrolleZu` nur an `aktiv`
   (`:1027-1031`). **Fehler.**
7. **Container-Klick auf der Fläche markiert keine Baumzeile.** `:1342`
   `aktiv={aktiveZeile?.id ?? null}`; Canvas-Klick auf Container setzt
   `containerId` und `setAktiv(null)` (`:973-978`). **Fehler.**
8. **Keine Zeile wird ins Sichtfeld gescrollt** — kein `scrollIntoView` in
   `ebenen-liste.tsx`/`abschnitts-editor.tsx`. **Fehler.**
9. **Container ohne Hover-Rahmen** — `canvas-bridge.tsx:89-105, 245` liefert
   nur Widget-Indizes. **Inkonsistenz.**

## C · Drag & Drop

10. **Endlosschleife bei zyklischer `parent_id`** — `ebenen-liste.tsx:351-355`
    ohne `gesehen`-Set, läuft in `onDragOver` pro Mausbewegung; Backend hat
    den Schutz (`bloecke.py:294-304`). **Fehler (Tab friert).**
11. **Stumme Drops** — Container nur unter direkten Geschwistern (`:362-364`),
    keine Rückmeldung; `move_container` (`container.py:57-111`) ändert nur
    `position`, nie `parent_id`. **Inkonsistenz.**
12. **Baustein-Drop lädt nicht neu** — Widget-Zweig `:1815-1845` nur
    `setZeilen`; Container-Zweig ruft `containerGeaendert()` (`:1811`). **Fehler.**
13. **Gesperrtes Ziel nimmt Abwürfe an** — `:489` sperrt nur die Quelle,
    `zugErlaubt` (`:344-365`) prüft `locked` des Ziels nicht. **Fehler.**
14. **`EBENEN_DRAG_TYP` wird nie gelesen** (`:103, :496`); Kommentar `:493-495`
    beschreibt einen Schutz, den es nicht gibt. **Attrappe (harmlos).**

## D · Kontextmenü und Tastenkürzel

15. **„Umbenennen" am Baustein**: leerer Zweig `:1392-1394`, im Menü gefiltert
    (`ebenen-liste.tsx:85, 877-879`). **Attrappe (dokumentiert).**
16. **⌘R lädt den Browser neu** — `:239` verlangt `istContainer`, das aus
    `aktiv` (immer Widget, Befund 7) nie `true` wird; kein `preventDefault`.
    **Fehler.**
17. **⌘D/⌘L/⌘; nur für Bausteine** — `onContainerAktion`-Zweig `:233` toter
    Code, gleiche Wurzel. **Fehler.**
18. **⌫ löscht ohne Rückfrage, auch mit ⌘** — `:244` ohne Modifier-Prüfung;
    `window`-Listener aktiv, solange Panel offen und Baustein gewählt
    (`:221-226, 249`). **Fehler.**
19. **„Sperren" ohne Wirkung** — nur Symbol + `draggable` (`:464`); weder
    `flaechen-overlay.tsx` noch `canvas-bridge.tsx` prüfen `locked`;
    `schemas_darstellung.py:31-32` behauptet das Gegenteil. **Attrappe.**

## E · Baumaufbau

20. **Verwaiste Zeilen werden Wurzeln**, optisch wie Abschnitte
    (`ebenen-baum.ts:41-43`). **Inkonsistenz.**
21. **Leerer Container = zugeklappter Container** — Pfeil nur bei Kindern
    (`:581`), kein Hinweis „leer". **Inkonsistenz.**
22. **Beitrag mit einem Block verliert seine Felder** — `:1324`
    (`baumBlocks.length === 0`) vs. `:1430` (`zeilen.length === 0`): zwei
    Bedingungen, zwei Wahrheiten. **Fehler (Randfall).**

## F · Umbenennen

23. `settings.name` (`:1753` → `schemas.py:570` → `service.py:1268-1278`),
    Renderer gibt ihn nirgends aus. **Kein Fehler.**
24. Escape im Umbenenn-Feld verwirft; Panelwechsel während des Tippens
    unmountet das Feld kommentarlos. **Inkonsistenz (klein).**

## G · Auge je Gerät

25. **Desktop-Breite nicht garantiert** — `vorschau.tsx:30-34` `desktop:
    "100%"`, kein `min-width`; auf schmalem Fenster rendert der iframe die
    Tablet-Sichtbarkeit, der Umschalter sagt „Desktop". **Inkonsistenz.**
26. **Auge geräteweise, Menü „Verstecken" alles-oder-nichts** auf demselben
    Feld (`ebenen-liste.tsx:718` vs. `:1381-1386, 1664-1667`). **Inkonsistenz.**
27. **`mitVersteckt` löscht den Schlüssel, Server schreibt `hidden_on: []`
    zurück** (`sichtbarkeit.ts:50` vs. `schemas.py:558`, `service.py:1278`
    `exclude_none`); gleiches für `locked: false`. **Inkonsistenz.**

## H · Diagnose

28. **Der Ebenen-Bereich protokolliert nichts** — kein `protokoll` in
    `ebenen-liste.tsx`; `ebenenZiehen`, `containerAktion`,
    `containerUmbenennen`, `onVersteckt` stumm. Verstößt gegen die
    Debugging-Pflicht. **Inkonsistenz.**

## Gegenüber Framers Layers-Panel fehlt

| Framer | Hier |
|---|---|
| Breakpoints als Wurzeln mit Breitenbereich | fehlt; Gerät ist globaler Umschalter (`vorschau.tsx:61-99`) |
| Seitenwahl oben im Panel | eigenes Panel `seiten` (`:1313-1318`) |
| Suchfeld | vorhanden (`:769-793`), gleichwertig |
| Symbole Frame/Stack/Komponente | vier Symbole (`:114-119`); keine Stack↔Frame-Unterscheidung (`layout_richtung`), keine Komponenten |
| Sperren ⌘L wirkt auf Canvas + Bewegung | Symbol ohne Wirkung (19) |
| Ausblenden je Breakpoint-Baum | Auge je Gerät; an Containern Attrappe (3) |
| Inline umbenennen jeder Ebene, ⌘R | nur Container, ⌘R unerreichbar (16) |
| Shift/⌘-Mehrfachauswahl, Sammelaktionen, Gruppieren | fehlt (`aktiv: string | null`, `:376`) |
| Scroll-to-selected, ↑/↓/→/← im Baum, „Elternteil wählen" | fehlt |

## Reihenfolge der Behebung

1. Befund 1+2: eine Quelle für Baum und Liste (oder `router.refresh()` am Ende
   von `schreibe`).
2. Befund 16+17: `aktiv` und `containerId` gemeinsam an `EbenenListe`.
3. Befund 10: `gesehen`-Set in `zugErlaubt`.
Danach der Rest in Nummernfolge, gemeinsam mit dem Framer-Umbau (Plan, Etappe 1).

## Stand nach Etappe 1 (05.09.2026, uncommitted)

| Nr | Stand | Wie |
|---|---|---|
| 1, 2, 12 | behoben | `anzeigeBloecke()` (ebenen-baum.ts): Baum = Container vom Server + Bausteine aus `zeilen`; jede Bausteinänderung sofort sichtbar |
| 3 | behoben | `containerVersteckt()` im Editor schreibt `hidden_on` per `updateBlock` |
| 4 | behoben | `baumSortiert()` ordnet nach `position` |
| 5 | entfällt | Bausteine kommen nicht mehr aus `baumBlocks`; Container haben keinen offenen Bearbeitungsstand |
| 6 | behoben | `FlaechenOverlay` Prop `containerId`, gestrichelter Rahmen; `scrolleZu(containerId)` |
| 7 | behoben | `aktiv` der Ebenen = Baustein-Kennung ODER `containerId` |
| 8 | behoben | `scrollIntoView` + Aufklappen der Vorfahren beim Wechsel von `aktiv` |
| 9 | offen | Hover-Rahmen für Container braucht `canvas-bridge.tsx` (Renderer); Etappe 2 mit dem Stil-Modell |
| 10 | behoben | `elternKette()` mit `gesehen`-Set, `zugPruefen()` nutzt sie |
| 11 | behoben | `zugPruefen()` liefert einen Grund; Zeile zeigt ihn als `title`, `dropEffect = none`, Protokollzeile |
| 13 | behoben | `zugPruefen()` prüft `locked` an Quelle UND Ziel |
| 14 | behoben | `EBENEN_DRAG_TYP` wird in `onDragOver` geprüft |
| 15 | behoben | Umbenennen für jede Ebene; Bausteine schreiben `settings.name` über den Speicherweg |
| 16, 17 | behoben | Kürzel wirken auf `aktiv` jeder Art; ⌘R öffnet das Feld, `preventDefault` |
| 18 | behoben | ⌫/Delete nur ohne ⌘/⌥ |
| 19 | behoben | `gesperrteEbene()`: Klick und Rechtsklick auf der Fläche gehen an den ersten freien Container; Ziehen gesperrt |
| 20 | behoben | Abzeichen „ohne Elternteil" |
| 21 | behoben | Abzeichen „leer" |
| 22 | behoben | `beitragOhneBloecke` als EINE Bedingung |
| 23 | kein Fehler | — |
| 24 | offen | klein; Umbenenn-Zwischenstand bei Panelwechsel |
| 25 | behoben | `buehnenStil()`: Desktop `min-width: 64rem`, Bühne `overflow-x-auto` |
| 26 | dokumentiert | Auge = je Gerät, Menü/⌘; = alle Geräte; Menüeintrag heißt bei versteckter Ebene „Einblenden" |
| 27 | offen | `hidden_on: []` vom Server harmlos; Normalisierung in Etappe 2 mit dem Stil-Schema |
| 28 | behoben | `protokoll("klick", …)` an Handgriff, Ziehen (Start/Abwurf/Ablehnung), Umbenennen, Auge, Seitenwechsel, gesperrte Klicks |

Dazu aus dem Framer-Zielbild: Seitenwahl im Kopf, Breakpoint-Wurzeln mit
Breitenbereich (`GERAETE_BEREICHE`), 30-px-Zeilen mit 21-px-Einrückung,
Symbol je Art (Stapel/Rahmen/Katalog), Auswahl Vollton + Teilbaum hell,
Kontextmenü mit Suchfeld und Gruppen, ↑/↓/→/← im Baum, ⇧-Mehrfachauswahl mit
Sammelaktionen. Tests: `bun test web/components/website/ebenen-baum.test.ts`.

## Prüfung des Umbaus (Agent, 05.09.2026) und Nacharbeit

| Prüfbefund | Stand |
|---|---|
| A1 Nach dem Speichern stand ein neuer Baustein als „ohne Elternteil" an der Wurzel (Container nur per `router.refresh()` nachgezogen) | behoben: `schreibe()` lädt nach einem Speichern mit neuen Bausteinen die Container per `listBlocks(page.id, true)` nach |
| A2 `containerAktion("umbenennen")` fiel in den `else` → `removeBlock` (latent) | behoben: expliziter Zweig, `umbenennen` tut hier nichts |
| A3 Mehrfachauswahl + ⌥↑ war ein No-Op (falsche Reihenfolge) | behoben: „hoch" von oben nach unten, alles andere von unten nach oben |
| A4 Mehrfachauswahl + Sperren/Verstecken kippte je Ebene | behoben: Zustand der geklickten Ebene gibt das Ziel vor |
| A5/A6 ⌘R/⌘D/⌫ griffen im ganzen Editor, auch mit Fokus auf `<select>` im Inspektor | behoben: Kürzel nur, wenn der letzte Mausklick im Baum lag; `SELECT`, `combobox`, `dialog`, `menu` ausgenommen |
| A7 ⌫ löscht Container samt Inhalt ohne Rückfrage | behoben: Rückfrage bei Container mit Kindern (`ebenen.containerLoeschenFrage`) |
| A9 Tote Kennungen in der Mehrfachauswahl | behoben: gegen `nachId` gefiltert |
| A11 `alleGewaehlt` fehlte in den Hook-Abhängigkeiten | behoben |
| A14 `verschiebe` tauschte flach über Spaltengrenzen — im Baum bewegte sich nichts | behoben: Tausch mit dem Nachbarn derselben Spalte |
| A16 `locked` prüfte das Backend nirgends (Wurzel 6) | behoben: `_sperre_pruefen` in `move_container`, `duplicate_container`, `remove_block` → 422; Test `test_gesperrte_ebene_laesst_sich_nicht_loeschen_oder_bewegen` |
| A18 `containerVersteckt` schrieb ohne Unverändert-Guard | behoben |
| A8 `zeilenRefs` bei gefilterter Zeile leer — Sprung fällt still aus | offen (klein) |
| A20 Overlay-Versatz bei waagerecht gescrollter Desktop-Bühne | offen — im Browser prüfen (schmales Fenster, Desktop, Baustein wählen) |
| A21 Verwaiste Schlüssel `ebenen.abschnitte`, `ebenen.buchenKnopf`, `ebenen.logo` in 24 Sprachdateien | offen — Löschen nur auf Ansage |
| Befund 5, 9, 24, 26, 27 | wie oben: offen bzw. Etappe 2 |
