# myBestDays-Logos, Figma-Stand 24.08.2026 (2. Satz)

Quelle: Datei `Zz6U7tFTK8NayAq19hUZWC`, 13 Frames. Geholt über den Figma-MCP
(`download_assets`) — die Original-Frames, nichts nachgebaut.

`roh/` ist der unveränderte Bestand, `einsatz/` die daraus erzeugten
Zielformate. Ausgerollt wurde aus `einsatz/`.

## Bestand

| Datei (`roh/`) | Node | Größe | Farben | Rolle |
| --- | --- | --- | --- | --- |
| `84-31_mbd-lockup` | 84:31 | 210×60,36 | `#030203` `#CC0504` | Sperrung **positiv** |
| `84-53_mbd-lockup` | 84:53 | 210×60,36 | `#CC0504` + weiß | Sperrung **negativ** |
| `84-75_mbd-lockup` | 84:75 | 210×60,36 | schwarz | Sperrung einfarbig schwarz |
| `84-97_mbd-lockup` | 84:97 | 210×60,36 | weiß | Sperrung einfarbig weiß |
| `77-105_vertikal-lockup` | 77:105 | 172×144 | `#CC0505` | vertikal / quadratisch |
| `77-116` | 77:116 | 172×144 | `#CC0505` | vertikal, zweite Fassung |
| `77-135` | 77:135 | 159×81 | `#CC0505` | Bildmarke farbig |
| `77-144` | 77:144 | 159×81 | `#1A1A1A` | Bildmarke einfarbig |
| `77-160` | 77:160 | **96×96** | `#1A1A1A` + weiß | App-Icon dunkel |
| `77-165` | 77:165 | **96×96** | `#CC0505` + weiß | App-Icon hell |
| `77-177` | 77:177 | 13×7 | `#CC0504` | Favicon-Stufe klein |
| `77-184` | 77:184 | 26×14 | `#CC0504` | Favicon-Stufe mittel |
| `77-191` | 77:191 | 39×20 | `#CC0504` | Favicon-Stufe groß |

## Behoben gegenüber dem ersten Satz

- Die Sperrungen sind **transparent** — der deckende `#F6F6F6`-Kasten ist weg.
- Die App-Icons sind **96×96 und damit quadratisch**; der Clipping-Fehler
  (Export 139×96) ist behoben.
- Das helle App-Icon trägt kein `#B82028` mehr (das war myNextDays-Rot).

## Was beim Ausrollen zu beachten war

**Die 4x-PNG-Exporte haben einen deckenden Frame-Hintergrund** (`#F0F0F3` beim
positiven, `#1A1A1A` beim negativen), die SVGs dagegen nicht. Ausgerollt wurde
deshalb aus den **SVGs**: `magick -background none -density 900 … -trim +repage`.
Das Trimmen ist nötig, weil die Logo-Komponenten zusagen, das Bild sei „auf die
sichtbare BBox getrimmt", und ihr Seitenverhältnis daraus berechnen.

**Das Seitenverhältnis hat sich geändert**: 1461×578 (2,53:1) → 1461×403
(3,63:1). Regel 2 der Guidelines verbietet, es anzupassen — also folgt der Code
dem Bild, nicht umgekehrt. Nachgezogen in `plattform/`, `gastgeber/` und
`storybook/components/plattform/logo.tsx` (`ASPECT`) sowie in
`mobile-bestdays/screens/GuestLogin.tsx` (feste Breite). Alle übrigen
Einbindungen rendern mit `w-auto object-contain` und brauchten nichts.

## Zwei offene Punkte in den Assets selbst

1. **Zwei Rottöne.** Die vier Sperrungen und die drei Favicons tragen
   `#CC0504`, die vertikalen Fassungen, Bildmarken und App-Icons `#CC0505` —
   ein Zeichen Unterschied. Sichtbar ist das nicht, aber `#CC0504` ist das
   Markenrot aus den Guidelines (Seite 4). Nicht selbst geändert.
2. **Die Favicon-Stufen sind nicht quadratisch** (13×7, 26×14, 39×20). Ein
   Favicon braucht ein quadratisches Format; das sind die Proportionen der
   Bildmarke. Für 16/32/48 px müsste die Marke in eine quadratische Fläche
   gesetzt werden — eine Gestaltungsentscheidung, keine Konvertierung.

Nicht ausgerollt, weil keine Zielstelle sie erwartet: die einfarbigen
Sperrungen, die vertikalen Fassungen, die Bildmarken und die App-Icons. Sie
liegen hier bereit.
