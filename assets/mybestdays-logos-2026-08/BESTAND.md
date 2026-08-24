# Bestand — heruntergeladen 24.08.2026 aus Figma

Quelle: Datei `Zz6U7tFTK8NayAq19hUZWC`, Seiten `mbd-seite-1..4`, Stand 21.08.2026.
Geholt über den Figma-MCP (`download_assets`) — die Frames selbst, NICHT nachgebaut.

| Datei (`roh/`)                          | Figma-Node | Größe   | Farben im SVG                          |
| --------------------------------------- | ---------- | ------- | -------------------------------------- |
| `mbd_lockup`                            | 56:281     | 247×71  | `#030203` `#CC0504` `#F6F6F6`          |
| `mbd_lockup_negativ`                    | 56:333     | 167×48  | `#262626` `#CC0504` + weiß             |
| `mbd_lockup_einfarbig_schwarz`          | 56:346     | 167×48  | schwarz                                |
| `mbd_lockup_einfarbig_weiss`            | 56:359     | 167×48  | `#262626` + weiß                       |
| `mbd_lockup_positiv-quadratflaeche`     | 56:372     | 160×46  | wie `mbd_lockup`                       |
| `mbd_bildmarke`                         | 56:392     | 159×81  | `#CC0504` `#F6F6F6`                    |
| `mbd_bildmarke_einfarbig`               | 56:405     | 159×81  | schwarz                                |
| `mbd_appicon_dunkel`                    | 56:171     | 139×96  | `#262626` + weiß                       |
| `mbd_appicon_hell`                      | 61:204     | 139×96  | **`#B82028`** + weiß                   |
| `mbd_favicon_16`                        | 56:444     | 24×12   | `#CC0504` `#F6F6F6`                    |
| `mbd_favicon_32`                        | 56:457     | 41×21   | `#CC0504` `#F6F6F6`                    |
| `mbd_favicon_48`                        | 56:470     | 57×29   | `#CC0504` `#F6F6F6`                    |

## Vier Punkte, die vor dem Einsetzen zu klären sind

**1. Das helle App-Icon trägt `#B82028`, nicht das Markenrot `#CC0504`.**
`#B82028` ist die Akzentfarbe von myNextDays (`globals.css` aller Frontends). Das
dunkle Icon und jede andere Fassung nutzen `#CC0504`. Entweder ist im hellen Icon
ein Rest der myNextDays-Vorlage stehen geblieben, oder es ist so gewollt. Nicht
selbst geändert — Regel 1 auf Seite 4 lässt nur die Originaldatei zu, und eine
Farbe zu tauschen wäre genau das Nachbauen, das ausgeschlossen ist.

**2. Die App-Icon-Frames sind 96×96, exportiert wird 139×96.**
Der Inhalt (`logo-positiv`, 125×58 bei x=14) ragt über den Rahmen, weil die
Frames `clipsContent` nicht gesetzt haben. Der Export nimmt deshalb die
Bounding-Box. Für ein App-Icon braucht es das quadratische Format —
entweder in Figma auf Clipping stellen oder die Ränder beim Erzeugen der
Icon-Größen abschneiden.

**3. `#F6F6F6` ist ein deckender Kartenhintergrund, keine Transparenz.**
`mbd_lockup`, `mbd_bildmarke` und die drei Favicons tragen ein Rechteck in
`#F6F6F6` unter dem Zeichen. Seite 4 verlangt aber „PNG mit transparentem
Hintergrund". Auf einer weißen Fläche fällt das nicht auf, auf einer farbigen
schon: dort erscheint ein hellgrauer Kasten. Die Fassungen `negativ`,
`einfarbig_schwarz` und `einfarbig_weiss` haben ihn nicht.

**4. Eine vertikale Fassung gibt es nicht als eigenes Asset.**
Seite 2 zeigt unter „Vertikale Ausrichtung" dieselbe horizontale Sperrung.
Node 56:372 ist deshalb hier als `..._positiv-quadratflaeche` abgelegt statt als
`vertikal` — ein Dateiname `mbd_lockup_vertikal` hätte etwas behauptet, was die
Datei nicht ist.
