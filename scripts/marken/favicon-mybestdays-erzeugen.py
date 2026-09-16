#!/usr/bin/env python3
"""favicon-mybestdays-erzeugen.py — Browser-Symbole der myBestDays-Oberflaechen.

WARUM ES DIESES SKRIPT GIBT UND NICHT NUR ZWEI PNGs:
`gastgeber` und `plattform` hatten bis zum 16.09.2026 GAR KEIN Symbol — Next.js
liefert nur aus, was als `app/icon.png` bzw. `app/apple-icon.png` im Baum liegt,
und beide Ordner waren leer. Im Tab stand deshalb der graue Standard-Globus des
Browsers, waehrend `web` und `marketing` (myNextDays) ihre Symbole seit jeher
haben. Gemeldet hat es der Nutzer, nicht ein Gate.

Die Marke wird aus `public/mybestdays-logo.png` ABGELEITET, nicht danebengelegt:
ein zweites, handgeschnittenes PNG waere eine Kopie, die beim naechsten
Logo-Wechsel still veraltet.

DREI ENTSCHEIDUNGEN, die nicht Geschmack sind:

1. NUR DAS „B", nicht der Schriftzug. Das Logo ist 1461 x 403 — im Tab
   landet es bei 16 px Hoehe und ist dort kein Wort mehr, sondern ein Strich.
   Genommen wird die rote Signatur; sie steht im Logo zwischen x=140 und der
   Luecke bei x~600, wo „est" beginnt (gemessen ueber das Spaltenprofil der
   roten Pixel, nicht geschaetzt). Das schwarze „my" faellt ueber die
   Rot-Maske weg.

2. WEISS AUF ROTER KACHEL, nicht rot auf weiss. Bei 16 px zerfallen die duennen
   Schwuenge der Schreibschrift: rot auf weiss ergibt einen blassen Fleck. Die
   volle Kachel traegt die Erkennbarkeit, das B liegt als Aussparung darauf —
   dieselbe Ueberlegung wie bei der Eigentuemer-App (`icon-eigentuemer-
   erzeugen.py`): „bei 48 px liest man eine Kachelfarbe, kein Detail".

3. DAS ROT KOMMT AUS DEM LOGO (#CC0504), nicht aus der PMS-Palette (#B82028).
   Die beiden sind verschieden, und das ist die Markengrenze: myBestDays ist
   der Marktplatz, myNextDays das PMS (CLAUDE.md, „Zwei Marken"). Ein
   uebernommener Rotwert haette die Symbole beider Welten angeglichen.

`apple-icon.png` ist VOLLFLAECHIG ohne runde Ecken: iOS legt seine eigene Maske
darueber und fuellt durchsichtige Ecken mit Schwarz — eine abgerundete Vorlage
bekaeme dort schwarze Zwickel. `icon.png` behaelt die runden Ecken, weil der
Browser nichts maskiert.

Aufruf (vom Repo-Wurzelverzeichnis):
    apps/api/.venv/bin/python scripts/marken/favicon-mybestdays-erzeugen.py
    … --pruefen    # schreibt nichts, meldet Abweichungen (fuer CI)
"""

from __future__ import annotations

import argparse
import hashlib
import pathlib
import sys

from PIL import Image, ImageDraw

WURZEL = pathlib.Path(__file__).resolve().parents[2]
QUELLE = WURZEL / "gastgeber" / "public" / "mybestdays-logo.png"
ZIELE = ("gastgeber", "plattform")

# Die Signatur im Logo. Linke Kante grosszuegig, rechte Kante an der gemessenen
# Luecke vor „est" — beides in Pixeln der 1461x403-Vorlage.
AUSSCHNITT = (140, 0, 605, 403)
ROT = (204, 5, 4, 255)          # #CC0504, aus dem Logo ausgezaehlt
KANTE = 440                      # wie web/app/icon.png
FUELLUNG = 0.80                  # Anteil der Kachel, den die Marke einnimmt


def _marke() -> Image.Image:
    """Die rote Signatur aus dem Logo, freigestellt und eng beschnitten."""
    if not QUELLE.exists():
        raise SystemExit(f"Logo fehlt: {QUELLE}")
    aus = Image.open(QUELLE).convert("RGBA").crop(AUSSCHNITT)
    px = aus.load()
    for y in range(aus.height):
        for x in range(aus.width):
            r, g, b, a = px[x, y]
            # Nur wo Rot dominiert. Die weichen Kanten des B bleiben (sie sind
            # rot mit Alpha), das schwarze „my" faellt weg (r ~ g ~ b).
            if a == 0 or (r - max(g, b)) < 20:
                px[x, y] = (0, 0, 0, 0)
    rahmen = aus.getbbox()
    if rahmen is None:
        raise SystemExit("Nach der Rot-Maske ist nichts uebrig — Logo geaendert?")
    return aus.crop(rahmen)


def _weiss(bild: Image.Image) -> Image.Image:
    """Dieselbe Form in Weiss — die Deckkraft traegt die Zeichnung."""
    hell = bild.copy()
    px = hell.load()
    for y in range(hell.height):
        for x in range(hell.width):
            px[x, y] = (255, 255, 255, px[x, y][3])
    return hell


def _kachel(marke: Image.Image, *, runde_ecken: bool) -> Image.Image:
    bild = Image.new("RGBA", (KANTE, KANTE), (0, 0, 0, 0))
    zeichner = ImageDraw.Draw(bild)
    if runde_ecken:
        zeichner.rounded_rectangle(
            [0, 0, KANTE - 1, KANTE - 1], radius=int(KANTE * 0.22), fill=ROT
        )
    else:
        zeichner.rectangle([0, 0, KANTE - 1, KANTE - 1], fill=ROT)
    skala = (KANTE * FUELLUNG) / max(marke.size)
    m = marke.resize(
        (max(1, round(marke.width * skala)), max(1, round(marke.height * skala))),
        Image.Resampling.LANCZOS,
    )
    bild.alpha_composite(m, ((KANTE - m.width) // 2, (KANTE - m.height) // 2))
    return bild


def main(argv: list[str]) -> int:
    """Symbole schreiben — oder mit --pruefen nur vergleichen."""
    p = argparse.ArgumentParser()
    p.add_argument("--pruefen", action="store_true",
                   help="nichts schreiben, nur Abweichungen melden")
    args = p.parse_args(argv[1:])

    marke = _weiss(_marke())
    erzeugt = {
        "icon.png": _kachel(marke, runde_ecken=True),
        "apple-icon.png": _kachel(marke, runde_ecken=False),
    }

    abweichung = False
    for app in ZIELE:
        ordner = WURZEL / app / "app"
        if not ordner.is_dir():
            raise SystemExit(f"Kein app/-Ordner: {ordner}")
        for name, bild in erzeugt.items():
            ziel = ordner / name
            roh = bild.tobytes()
            neu = hashlib.sha256(roh).hexdigest()[:12]
            if args.pruefen:
                if not ziel.exists():
                    print(f"FEHLT   {ziel.relative_to(WURZEL)}", file=sys.stderr)
                    abweichung = True
                    continue
                alt = hashlib.sha256(
                    Image.open(ziel).convert("RGBA").tobytes()
                ).hexdigest()[:12]
                if alt != neu:
                    print(f"ANDERS  {ziel.relative_to(WURZEL)} ({alt} != {neu})",
                          file=sys.stderr)
                    abweichung = True
            else:
                bild.save(ziel)
                print(f"geschrieben: {ziel.relative_to(WURZEL)} "
                      f"({bild.width}x{bild.height}, {neu})")

    if args.pruefen:
        if abweichung:
            print("\nSymbole weichen von der Vorlage ab — Skript erneut laufen "
                  "lassen und das Ergebnis einchecken.", file=sys.stderr)
            return 1
        print(f"OK — {len(ZIELE) * len(erzeugt)} Symbole decken sich mit dem Logo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
