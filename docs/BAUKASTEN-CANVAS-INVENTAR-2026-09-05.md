# Inventar: Canvas-/Arbeitsflächen-Funktionen des Website-Baukasten-Editors

Nur-lesende Bestandsaufnahme, Stand Code-Repo `/Users/andystaudinger/NextDays`
(Zeitpunkt der Untersuchung: 2026-09-05). Es wurden ausschließlich vorhandene
Dateien gelesen, nichts verändert.

**Wichtiger Vorbefund:** `docs/FRAMER-FEATURES.md` beschreibt unter „Bereits
gebaut" einen Prototyp mit Pan/Zoom/Multi-Frame/Snapping-Guides/Pins/
motion-Effekten. `docs/BAUKASTEN-FRAMER-PARITAET-PLAN.md` stellt dazu
ausdrücklich fest: **„Davon steht nichts im Repo"** (grep-Beleg dort dokumentiert)
— das ist ein nicht eingecheckter Prototyp, kein Ist-Stand. Die eigene
Verifikation in diesem Inventar bestätigt das: im tatsächlichen Editor
(`web/components/website/editor/abschnitts-editor.tsx` & Nachbardateien) gibt
es weder Zoom noch Pan noch Lineale/Guides/Snapping noch Pins/absolute
Positionierung noch Kommentare. Der Kopfkommentar in `abschnitts-editor.tsx`
(Zeile 5) nennt das explizit: „Das ist der Ersatz für den alten Framer-Canvas
(Kamera, Zoom, Frames mit x/y/w/h, Layer-Baum, Breakpoint-Flächen, Effects)."
Die zwei Framer-Analyse-Dokumente (`FRAMER-STYLE-PANEL-ANALYSE.md`,
`FRAMER-LAYERS-INSPEKTOR-ANALYSE.md`) sind reine Fremd-Vermessungen von
Framer selbst (Referenz/Vorbild), keine Beschreibung des eigenen Editors.

---

## Vorschau-Bühne

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 1 | Live-Vorschau im iframe (echter Renderer) | `web/components/website/vorschau.tsx:116-193,195-311` | `VorschauFlaeche`/`Inhalt` rendern einen `<iframe>` auf `NEXT_PUBLIC_BUILDER_URL/render/<pageId>?token=…`; es ist derselbe Renderer-Code, den der Gast sieht (kein zweiter Editor-Renderer). | Zugriff nur mit kurzlebigem HMAC-Draft-Token (1 h); ohne `NEXT_PUBLIC_BUILDER_URL` erscheint nur ein Hinweis „nicht konfiguriert". |
| 2 | Gerätebreiten-Umschalter (Desktop/Tablet/Mobil) | `web/components/website/vorschau.tsx:30-34,76-111` | `GERAET_BREITE` setzt feste Bühnenbreiten (100 % / 51.25rem / 24.375rem); `GeraeteUmschalter` in der Kopfzeile schaltet den Zustand `geraet` um, der die iframe-Breite bestimmt. | Nur 3 feste Breiten, keine benutzerdefinierten Breakpoints; Desktop erzwingt Mindestbreite 64rem (führt zu horizontalem Scroll bei schmalem Fenster). |
| 3 | Scrollen der Bühne | `web/components/website/vorschau.tsx:176` | Die Bühne (`overflow-x-auto overflow-y-hidden`) erlaubt horizontales Scrollen bei zu schmalem Editor-Fenster; vertikal scrollt der Inhalt IM iframe selbst. | Kein Scroll-zu-Zoom, kein Pan mit gedrückter Leertaste. |
| 4 | Automatisches Scrollen zu einem Abschnitt | `web/components/website/editor/use-canvas-bruecke.ts:170-193`, `builder/components/blocks/canvas-bridge.tsx:445-499` | Wählt man eine Ebene außerhalb der Vorschau (Ebenen-Baum, Kontextmenü), schickt der Editor `scrollTo` mit der Block-ID; die Brücke im iframe scrollt nur, wenn der Abschnitt nicht schon sichtbar ist (`nearest`-Semantik von Hand nachgerechnet). | Kein sanftes Scroll-Steuerelement für den Nutzer selbst, nur programmatisch ausgelöst. |
| 5 | Kein Zoom | — | — | Nicht vorhanden (siehe Abschnitt unten). |
| 6 | Kein Pan/Hand-Tool | — | — | Nicht vorhanden (siehe Abschnitt unten). |

## Auswahl

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 7 | Klick-Auswahl eines Bausteins | `builder/components/blocks/canvas-bridge.tsx:325-371`, `web/components/website/editor/abschnitts-editor.tsx:1158-1194` | Klick im iframe meldet `select` mit Block-ID (über `data-block-id`, nicht Index) an den Editor; `setAktiv` markiert die Zeile. | Auswahl läuft über DB-ID; ein noch nie gespeicherter Baustein hat keine ID und wird über Zähl-Index behelfsweise zugeordnet. |
| 8 | Klick-Auswahl eines leeren Containers (Abschnitt/Spalte) | `builder/components/blocks/canvas-bridge.tsx:373-387`, `web/components/website/editor/abschnitts-editor.tsx:1185-1191` | Trifft der Klick keinen Baustein, aber einen Container, wird `containerId`/`containerKind` gemeldet; der Editor setzt `containerId` statt `aktiv`. | Nur der innerste Container wird gemeldet; „Elternteil wählen" ist eine separate Handlung im Inspektor/Ebenenbaum. |
| 9 | Rechtsklick öffnet Kontextmenü | `builder/components/blocks/canvas-bridge.tsx:302-323`, `web/components/website/editor/abschnitts-editor.tsx:1092-1136` | `contextmenu`-Ereignis im iframe wird abgefangen (`preventDefault`), Koordinaten + Block-/Container-ID gehen an den Editor; das native Browsermenü erscheint nur außerhalb der Seite. | Nur EIN Menütyp für Bausteine (siehe Kontextmenü unten); für Container gibt es kein eigenes Rechtsklick-Menü (Container wird nur ausgewählt). |
| 10 | Hover-Hervorhebung | `builder/components/blocks/canvas-bridge.tsx:268-300`, `web/components/website/editor/flaechen-overlay.tsx:461-467` | `mousemove` im iframe meldet den überfahrenen Block-Index gedrosselt; Overlay zeichnet einen orangen durchgezogenen Rahmen um das überfahrene Element (blau = Auswahl, orange = Hover). | Nur für Bausteine mit `data-block-index`; kein Hover-Rahmen für Container separat vom Auswahlmechanismus. |
| 11 | Container-Auswahl mit eigenem Rahmen | `web/components/website/editor/flaechen-overlay.tsx:469-475` | Gewählter Container bekommt gestrichelten Markenfarben-Rahmen (`containerRect`), unabhängig vom Baustein-Auswahlrahmen. | Kein Griffe-Set (Resize-Handles) an Containern in der Fläche selbst; Größenänderung nur über den Inspektor (Zahlenfelder). |
| 12 | Gesperrte Ebenen blockieren Auswahl auf der Fläche | `web/components/website/editor/abschnitts-editor.tsx:214-231,1160-1177` | `gesperrteEbene()` prüft `settings.locked` in der Elternkette; ein Klick auf eine gesperrte Ebene wird ignoriert bzw. an den nächsten freien Elternteil weitergereicht. | Sperrung wirkt nur auf Klicks in der Vorschau; im Ebenen-Baum bleibt die Ebene über das Kontextmenü trotzdem entsperrbar. |
| 13 | Auswahl von Kopf-/Fußzeile und deren Teilen | `builder/components/blocks/canvas-bridge.tsx:389-402`, `web/components/website/editor/abschnitts-editor.tsx:1138-1156` | Klick auf `[data-region]`/`[data-teil]` meldet `region`/`teil`; Editor setzt `regionAuswahl` statt `aktiv`/`containerId`. | Kopf-/Fußzeile-Teile sind aus dem Theme vorgegeben, nicht frei strukturierbar (kein Hinzufügen neuer Teile). |

## Auswahlrahmen

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 14 | Gestrichelter Auswahlrahmen mit 8 Griffen | `web/components/website/editor/flaechen-overlay.tsx:624-639,987-1014` | `AktiverRahmen`/`Griffe` zeichnen blauen gestrichelten Rahmen + 8 quadratische Punkte (4 Ecken, 4 Kantenmitten) über dem gemeldeten Rechteck. | Die Griffe sind **rein dekorativ** (`pointer-events-none`) — kein Ziehen zum Verändern der Größe; Breite gehört laut Kommentar „dem Theme". |
| 15 | Etikett mit Bausteinnamen | `web/components/website/editor/flaechen-overlay.tsx:641-664` | Zeigt den übersetzten Namen des Bausteintyps oberhalb des Rahmens; dynamische Bausteine (datengetrieben) erhalten violette statt blaue Farbe. | Nur Name, keine weiteren Metadaten (z. B. keine Pixel-Maße). |
| 16 | Schwebende Aktionsleiste am Rahmen | `web/components/website/editor/flaechen-overlay.tsx:705-787` | Leiste mit Verschieben-Menü (hoch/runter), „Inhalt bearbeiten", „Design bearbeiten", „Danach einfügen" (+), „Duplizieren", „Ausblenden auf Gerät", „Entfernen" (Papierkorb). | Kein direkter „Ausschneiden"/„Kopieren"-Knopf in der Leiste (nur Duplizieren); Position kippt bei schmalem Abschnitt von rechts- auf linksbündig. |
| 17 | Sichtbarkeits-Hinweis pro Gerät | `web/components/website/editor/flaechen-overlay.tsx:666-703` | Ist ein Abschnitt für das aktuelle Gerät ausgeblendet, erscheint ein oranges Abzeichen mit Geräteliste + Einblenden-Knopf direkt am Rahmen. | Einblenden wirkt nur für den gerade gezeigten Breakpoint, nicht für alle auf einmal. |
| 18 | Rechtsklick-Kontextmenü am Rahmen | `web/components/website/editor/flaechen-teile.tsx:184-333` | Dunkle Kopfzeile mit Bausteinname, darunter: Inhalt bearbeiten, Design bearbeiten, Duplizieren, Nach oben, Nach unten, Ausblenden-auf-Untermenü, Entfernen. | Kein „Verschieben in anderen Container per Menü“; Reihenfolge-Änderung nur „einen Schritt hoch/runter", kein „ganz nach oben/unten". |

## Einfügen

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 19 | „+"-Naht zwischen Abschnitten | `web/components/website/editor/flaechen-overlay.tsx:808-970` | Zwischen zwei Abschnitten erscheint (nur am ausgewählten/überfahrenen) ein „+"-Knopf; Klick öffnet Mini-Menü mit Layout-Vorschlägen (`LAYOUT_BAUSTEINE`) und dem Weg zum vollen Katalog. | Nur an EINER Naht sichtbar zugleich (kein „+" an jeder Grenze); Naht-Erkennung per Geometrie-Näherung (44 px Toleranz). |
| 20 | Naht über dem ersten Abschnitt | `web/components/website/editor/flaechen-overlay.tsx:542-552` | Eigene Sonderbehandlung, damit auch VOR dem ersten Abschnitt eingefügt werden kann. | Erfordert Zeigernähe an der Oberkante des ersten Rechtecks. |
| 21 | Drag-Abwurf aus dem Bausteinkatalog auf die Fläche | `web/components/website/hinzufuegen-panel.tsx:280-281`, `web/components/website/editor/flaechen-overlay.tsx:371-425` | Katalogkarten sind `draggable`; die Overlay-Fläche berechnet beim `dragover` die Ziel-Naht (blauer Balken) bzw. Zielspalte und fügt bei `drop` ein. | Ziehen funktioniert nur vom Katalog-Panel zur Fläche, nicht umgekehrt (kein Herausziehen eines Bausteins aus der Seite). |
| 22 | Abwurf in eine leere Spalte | `web/components/website/editor/flaechen-overlay.tsx:324-342,427-441` | `spalteUnter()` findet die innerste Spalte unter dem Zeiger; ein blau umrandetes Feld hebt sie hervor, der Baustein landet darin statt in eigener Zeile. | Nur „innerste" Spalte zählt bei Verschachtelung; Erkennung rein geometrisch über gemeldete Rechtecke. |
| 23 | Abwurf in eine bereits gefüllte Spalte | `web/components/website/editor/flaechen-overlay.tsx:400-408` | Balken erscheint zwischen zwei vorhandenen Bausteinen derselben Spalte (nicht nur am Ende). | Nur zwischen Bausteinen; kein Einfügen „vor dem allerersten" per Drag in eine Spalte separat markiert (läuft über allgemeine Nahtlogik). |
| 24 | Layout direkt an der Naht einfügen | `web/components/website/editor/flaechen-overlay.tsx:916-945` | Im „+"-Menü stehen Layout-Bausteine (Spaltenaufteilungen wie „6·6", „4·8") als Sofortwahl, bevor man in den vollen Katalog wechselt. | Layout-Liste ist eine feste, kuratierte Auswahl (`LAYOUT_BAUSTEINE`), keine Freiform-Rastererstellung. |
| 25 | Spalte manuell hinzufügen (Inspektor) | `web/components/website/editor/container-inspektor.tsx:276-349` | „Spalte hinzufügen"-Knopf im Container-Inspektor teilt die Breite gleichmäßig neu auf (max. 6 Spalten). | Nur bis 6 Spalten je Abschnitt; kein Drag zum Erzeugen einer neuen Spalte direkt auf der Fläche. |

## Verschieben / Umsortieren

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 26 | Baustein einen Schritt hoch/runter | `web/components/website/editor/flaechen-overlay.tsx:726-750`, `flaechen-teile.tsx:285-302` | Menü-Knöpfe in Leiste und Kontextmenü rufen `onVerschiebe(key, -1/1)` — vertauscht die Position mit dem Nachbarn. | Kein Drag-and-Drop der Bausteine direkt in der Vorschau-Fläche selbst (nur über Ebenen-Baum, s.u.); keine Mehrfachauswahl-Verschiebung in der Fläche. |
| 27 | Ebenen im Baum per Drag verschieben (vor/nach/hinein) | `web/components/website/ebenen-liste.tsx:522-679` | HTML5-Drag mit eigenem MIME-Typ `application/x-nextdays-ebene`; `zugPruefen()` verhindert Zyklen und Ablage in gesperrte Ziele, Ablehnungsgrund wird angezeigt statt zu verschwinden. | Nur im Ebenen-Baum, nicht auf der Vorschau-Fläche; ein abgelehnter Zug zeigt nur einen Tooltip-Grund, keine Animation. |
| 28 | Container umsortieren (Struktur-Karte) | `web/components/website/editor/container-inspektor.tsx:462-508` | „Hoch"/„Runter"-Knöpfe rufen `moveContainer(id, rang±1)`. | Nur ein Schritt je Klick, keine Zahleneingabe für Zielposition. |

## Inline-Textbearbeitung (data-feld)

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 29 | Direktes Bearbeiten von Text in der Vorschau | `builder/components/blocks/canvas-bridge.tsx:512-527,405-436` | Elemente mit `data-feld` bekommen `contentEditable="true"`; bei `blur` wird `textContent` als `text`-Meldung an den Editor geschickt. | Nur einzeilige Textfelder (Enter wird abgefangen und löst `blur` aus, kein Zeilenumbruch); kein Rich-Text (Fett/Kursiv) inline. |
| 30 | Schutz vor versehentlichem Navigieren/Absenden | `builder/components/blocks/canvas-bridge.tsx:325-341,542-546` | Klicks auf `<a>` und `submit`-Ereignisse innerhalb der Vorschau werden verhindert, damit der iframe die Entwurfsansicht nicht verlässt. | Formulare lassen sich ausfüllen, aber nicht wirklich absenden — das ist Absicht, keine Lücke. |
| 31 | Übernahme in den Editor-Zustand mit Autospeichern | `web/components/website/editor/abschnitts-editor.tsx:1196-1224,832-836` | `text`-Meldung schreibt in `zeilen[...].content[feld][locale]`; Änderung löst die 900-ms-Entprellung zum Server aus. | Nur Felder, die der Katalog-Typ für diesen Baustein kennt, werden angenommen (Whitelist gegen manipulierte Nachrichten). |

## Kontextmenü

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 32 | Baustein-Kontextmenü (Rechtsklick in Vorschau) | `web/components/website/editor/flaechen-teile.tsx:184-333` | Siehe Nr. 18 — Inhalt/Design/Duplizieren/Hoch/Runter/Ausblenden/Entfernen, positioniert relativ zum Fenster mit Randkorrektur. | Nur für Bausteine (Zeilen mit `zeile !== null`); kein separates Container-Kontextmenü in der Vorschau. |
| 33 | Ebenen-Kontextmenü (Rechtsklick im Baum) | `web/components/website/ebenen-liste.tsx:112-178,1074-1151` | Menü mit Suchfeld und Gruppen: Elternteil wählen, Duplizieren ⌘D, Entfernen ⌫, Umbenennen ⌘R, Sperren ⌘L, Verstecken ⌘;, Nach oben ⌥↑, Nach unten ⌥↓. | Gilt für jede Ebene (Container + Baustein), aber nicht für die Vorschau-Fläche selbst; kein Framer-Umfang (kein „Copy CSS", „Select Siblings" etc.). |

## Kürzel (Tastatur)

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 34 | ⌘D Duplizieren (Ebene) | `web/components/website/ebenen-liste.tsx:465-481` | `tastatur()`-Handler auf `window`, nur wirksam wenn zuletzt im Baum geklickt wurde. | Gilt nur im Ebenen-Baum, nicht wenn Fokus in einem Formularfeld liegt. |
| 35 | ⌘L Sperren (Ebene) | `web/components/website/ebenen-liste.tsx:472` | s.o. | s.o. |
| 36 | ⌘; Verstecken (Ebene) | `web/components/website/ebenen-liste.tsx:473` | s.o. | s.o. |
| 37 | ⌘R Umbenennen (Ebene) | `web/components/website/ebenen-liste.tsx:474` | s.o. | s.o. |
| 38 | ⌫/Delete Entfernen (Ebene, ohne ⌘/⌥) | `web/components/website/ebenen-liste.tsx:475-480` | Absichtlich NUR ohne Zusatztaste, weil macOS ⌘⌫ als „in den Papierkorb" reserviert. | s.o. |
| 39 | ⌥↑ / ⌥↓ Ebene hoch/runter | `web/components/website/ebenen-liste.tsx:481-482` | s.o. | s.o. |
| 40 | ↑/↓ Zeilen wechseln im Baum | `web/components/website/ebenen-liste.tsx:483-493` | Wandert zur vorherigen/nächsten sichtbaren Zeile in `reihenfolge`. | s.o. |
| 41 | →/← Auf-/Zuklappen bzw. Elternteil wählen | `web/components/website/ebenen-liste.tsx:494-504` | → klappt eine zugeklappte Ebene auf; ← klappt zu oder springt zum Elternteil, wenn schon zu/ohne Kinder. | s.o. |
| 42 | Escape schließt Kontextmenü/Auswahl (Fläche) | `web/components/website/editor/flaechen-overlay.tsx:262-273` | Erster Escape schließt ein offenes Kontextmenü, zweiter hebt die Auswahl auf. | Nur für das Fläche-Overlay, unabhängig vom Ebenen-Baum-Escape. |
| 43 | Escape schließt Naht-Menü | `web/components/website/editor/flaechen-overlay.tsx:840-847` | Eigener Effekt je offener Naht. | — |
| 44 | Enter/Escape bei Inline-Umbenennung | `web/components/website/ebenen-liste.tsx:778-781` | Enter bestätigt (blur), Escape verwirft. | Nur im Ebenen-Baum-Umbenennungsfeld. |
| 45 | ⇧-Klick Mehrfachauswahl (Ebene) | `web/components/website/ebenen-liste.tsx:687-699` | Shift-Klick fügt/entfernt eine Ebene aus `mitgewaehlt`; `aktiv` bleibt primär. | Nur im Ebenen-Baum, nicht in der Vorschau-Fläche. |

## Geräte-Umschalter

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 46 | Umschalter in der Kopfzeile | `web/components/website/vorschau.tsx:69-114`, `abschnitts-editor.tsx:2485` | Drei Knöpfe (Desktop/Tablet/Mobil-Symbole), setzt `geraet`-Zustand, der Bühnenbreite UND Ebenen-Baum-Wurzel steuert. | Nur 3 feste Stufen, keine Zwischenwerte/eigene Breiten. |
| 47 | Breakpoint-Wurzeln im Ebenen-Baum | `web/components/website/ebenen-liste.tsx:890-1053` | Desktop/Tablet/Mobil als aufklappbare Wurzeln mit Breitenbereich-Anzeige; Klick auf eine Wurzel schaltet `onGeraet`. | Nur die aktive Wurzel zeigt den vollen Baum; die anderen sind reine Klick-Ziele ohne eigenen Inhalt. |

## Undo/Redo

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 48 | Rückgängig/Wiederholen für Abschnittsliste | `web/components/website/use-verlauf.ts` (gesamt), `abschnitts-editor.tsx:847-893,2511-2516` | `useVerlauf` beobachtet `zeilen` und merkt Stände nach 700 ms Ruhe (JSON-Vergleich ohne `id`); Knöpfe ↺/↻ in der Kopfzeile rufen `verlauf.zurueck()/vor()`. | Maximal 50 Schritte; deckt nur die Bausteinliste ab, NICHT Container-Strukturänderungen (Spalte hinzufügen/löschen, Layout einfügen) — die laufen direkt über Server-Calls ohne Verlauf. |

## Zoom

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| — | **Nicht vorhanden** | — | — | Siehe Abschnitt „Nicht vorhanden" unten. |

## Lineale / Guides / Snapping

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| — | **Nicht vorhanden** | — | — | Siehe Abschnitt „Nicht vorhanden" unten. |

## Pins / absolute Positionierung

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| — | **Nicht vorhanden** | — | — | Siehe Abschnitt „Nicht vorhanden" unten. Container-Inspektor kennt nur Flex-artige Layout-Einstellungen (Richtung/Verteilen/Ausrichten/Abstand/Umbruch, `container-inspektor.tsx:356-433`), keine Position-Typen (relative/absolute/fixed/sticky) oder X/Y-Pins. |

## Breakpoint-Darstellung

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 49 | Sichtbarkeit je Gerät (Auge-Umschalter) | `web/components/website/editor/sichtbarkeit.ts:30-51`, `flaechen-overlay.tsx`, `ebenen-liste.tsx:834-878` | `settings.hidden_on` (Array `desktop`/`tablet`/`mobil`) steuert, auf welchen Geräten ein Baustein/Container ausgeblendet ist; Auge-Symbol in Leiste, Kontextmenü und Ebenen-Baum schaltet es um. | Ein Wert gilt je Gerät als Ja/Nein — keine gestaffelten Style-Overrides je Breakpoint (kein „Schriftgröße auf Mobil anders", nur Sichtbarkeit). |
| 50 | Breite-Bereichsanzeige je Breakpoint im Baum | `web/components/website/ebenen-liste.tsx:891-896` | Zeigt z. B. „ab 1024" oder „767–0" neben der Breakpoint-Wurzel (`GERAETE_BEREICHE` aus `@nextdays/baukasten-stil`). | Rein informativ, nicht editierbar (keine eigenen Breakpoint-Grenzen definierbar). |

## Vorschau-/Preview-Modus

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 51 | „Website ansehen" (Live-Vorschau außerhalb Editor) | `web/components/website/kopfleiste.tsx` (Komponente `WebsiteAnsehen`), verwendet in `abschnitts-editor.tsx:2556` | Öffnet die veröffentlichte/Entwurfs-Domain in neuem Tab. | Kein separater „Vorschau-Modus" INNERHALB des Editors, der die Bearbeitungs-Overlays ausblendet (Editieren ist immer über die Fläche gelegt, solange `editierbar` gesetzt ist). |
| 52 | Vorlagen-Vorschau in derselben Fläche | `web/components/website/editor/abschnitts-editor.tsx:2616-2629`, `vorschau.tsx` (`fremdeUrl`) | Beim Ansehen einer Vorlage zeigt dieselbe `VorschauFlaeche` eine fremde Renderer-URL statt der eigenen Seite. | Kein Bearbeiten möglich, solange eine Vorlage angesehen wird (reine Ansicht). |

## Mehrfachauswahl

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 53 | Mehrfachauswahl im Ebenen-Baum | `web/components/website/ebenen-liste.tsx:261-298,404-442` | ⇧-Klick sammelt Ebenen in `mitgewaehlt`; Duplizieren/Entfernen/Sperren/Verstecken wirken dann auf alle gewählten (mit Reihenfolge-Logik gegen Indexverschiebung). | **Nur im Ebenen-Baum.** Auf der Vorschau-Fläche selbst gibt es keine Mehrfachauswahl (kein Shift-Klick auf mehrere Abschnitte, kein Rahmen-Aufziehen zum Markieren mehrerer Elemente). |

## Kopieren/Einfügen

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| 54 | Duplizieren (Baustein) | `web/components/website/editor/abschnitts-editor.tsx` (Funktion `dupliziere`, referenziert in `flaechen-overlay.tsx` `onDuplizieren`) | Kopiert einen Baustein direkt darunter in dieselbe Liste. | Kein System-Clipboard-Kopieren (kein ⌘C/⌘V zwischen Seiten oder Projekten); „Duplizieren" ist der einzige Kopiermechanismus. |
| 55 | Duplizieren (Container) | `web/components/website/editor/container-inspektor.tsx:480-487`, `abschnitts-editor.tsx` (`duplicateContainer`) | Serverseitiger Aufruf `duplicateContainer(id)` dupliziert Abschnitt/Spalte samt Kindern. | Kein Ausschneiden/Einfügen an anderer Stelle — Duplikat entsteht immer direkt neben dem Original. |

## Größe ziehen (Resize per Maus)

| Nr | Funktion | Datei:Zeile | Wie sie funktioniert | Einschränkung |
|---|---|---|---|---|
| — | **Nicht vorhanden** auf der Fläche | `web/components/website/editor/flaechen-overlay.tsx:972-986` (Kommentar) | Die 8 Auswahl-Griffe sind laut Code-Kommentar bewusst `pointer-events-none`: „Ziehen kann man daran NICHT ... ein Griff, an dem man ziehen kann und der nichts bewirkt, wäre schlechter als keiner." | Größe/Breite wird stattdessen über Zahlenfelder/Segmente im Container-Inspektor gesetzt (`container-inspektor.tsx:241-270,435-460`: Spaltenbreite als Zwölftel-Auswahl, Mindesthöhe/Maximalbreite als Zahlenfelder) — kein direktes Ziehen an Kanten oder Ecken. |

---

## Nicht vorhanden (im Code gesucht, nichts gefunden)

Suchbegriffe (case-insensitive, über `web/components/website/**/*.{ts,tsx}`,
`builder/components/blocks/canvas-bridge.tsx`, ausgenommen `docs/`):
`\bzoom\b`, `lineal`, `ruler`, `snap`, `guide`, `\bpin\b`, `comment`,
`kommentar`, `absolute positionierung`, `draggable`+Resize-Handle-Muster,
`onDragStart` außerhalb Katalog/Ebenenbaum, `wheel`/`Cmd+Wheel`, `pan`+Space-Taste.

Ergebnis — folgende Framer-typischen Canvas-Funktionen fehlen im tatsächlichen
Editor-Code (nur in `docs/FRAMER-FEATURES.md` als Prototyp-Behauptung bzw. in
den Framer-Fremdanalysen als Vorbild erwähnt):

- **Zoom** (Cmd/Ctrl+Wheel, Pinch, +/−, Shift+0/1/2) — keine einzige Fundstelle
  im Editor; `docs/BAUKASTEN-FRAMER-PARITAET-PLAN.md:9-13` bestätigt explizit
  das Fehlen im Repo.
- **Pan/Hand-Tool** (Space+Drag, „H"-Taste) — nicht vorhanden.
- **Lineale/Guides/Snapping** (rote Ausrichtungslinien, pinke Abstandsmaße,
  Alt-Measure-on-hover, Distribution-Guides) — nicht vorhanden; das
  Overlay kennt nur feste Rahmen/Nähte/Balken, keine dynamischen
  Ausrichtungshilfen zwischen beliebigen Elementen.
- **Pins/Constraints und absolute Positionierung** (Top/Right/Bottom/Left,
  Center-H/V, Position-Typ relative/absolute/fixed/sticky) — der
  Container-Inspektor bietet nur Flexbox-Richtung/Verteilung/Ausrichtung,
  keine Pins oder Positions-Typen.
- **Freies Ziehen zur Größenänderung** (Resize-Handles) — die 8 Griffe am
  Auswahlrahmen sind laut Code-Kommentar bewusst funktionslos
  (`pointer-events-none`); Größe nur über Formularfelder im Inspektor.
- **Kommentare/Anmerkungen** — `flaechen-overlay.tsx:31-35` listet „Add
  Comment" ausdrücklich als bewusst NICHT übernommenes Framer-Feature.
- **Mehrfachauswahl auf der Vorschau-Fläche** (Shift-Klick auf mehrere
  Abschnitte, Rahmen-Aufziehen) — Mehrfachauswahl existiert nur im
  Ebenen-Baum (`ebenen-liste.tsx`), nicht auf dem iframe-Overlay.
  „Select All"/„Select Siblings"-Kürzel aus Framer fehlen komplett.
  Zulässig ist auf der Fläche nur die Wahl eines einzelnen Bausteins,
  Containers oder Regionsteils gleichzeitig (`abschnitts-editor.tsx:522-538`
  erzwingt sogar exklusive Auswahl zwischen Block/Container/Region).
- **System-Zwischenablage kopieren/einfügen** (⌘C/⌘V zwischen Seiten,
  Copy Style/Copy CSS/Copy Fill/Paste in Place aus dem Framer-Kontextmenü)
  — nur „Duplizieren" existiert, kein echtes Kopieren mit Einfügen an
  beliebiger Stelle oder in eine andere Seite.
- **Variants/Interaktionen/Animationen** (Trigger, Actions, Transitions,
  Effects wie Hover/Press/Scroll/Parallax) — laut
  `docs/BAUKASTEN-FRAMER-PARITAET-PLAN.md:9-13` ebenfalls nicht im Repo,
  obwohl `FRAMER-FEATURES.md` sie als „gebaut“ listet.
- **Editor-Vollbild-„Preview"-Umschalter, der die Bearbeitungs-Overlays
  ausblendet** — es gibt nur „Website ansehen" (neuer Tab, echte Domain)
  und die Vorlagenvorschau (read-only, andere URL); kein Umschalter, der
  in derselben Fläche zwischen „Bearbeiten" und „nur Ansehen" wechselt.
