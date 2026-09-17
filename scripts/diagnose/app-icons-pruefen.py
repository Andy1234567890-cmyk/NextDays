#!/usr/bin/env python3
"""app-icons-pruefen.py — findet App-Icons mit Fremdfarbe in den Ecken und
fehlende adaptive Icons (Android).

HINTERGRUND (25.08.2026): Auf dem Startbildschirm eines Android-Telefons hatte
das myNextDays-Icon einen weissen Rahmen um seine abgerundeten Ecken. Ursache
waren ZWEI Dinge, die beide stumm blieben:

  1. Die Icon-Bitmaps waren ein schwarzes Rounded-Rect auf WEISSEM Grund. Auf
     iOS faellt das nie auf — dort maskiert das System jedes App-Icon selbst,
     die weissen Ecken werden immer abgeschnitten. Android ohne adaptives Icon
     malt das Bitmap dagegen unveraendert.
  2. `mipmap-anydpi-v26/` fehlte komplett, es gab also gar kein adaptives Icon.
     Damit war der Legacy-Pfad der einzige — und die weissen Ecken sichtbar.

Beides ist mit dem Auge nur auf einem echten Geraet zu sehen und in keinem Test
enthalten. Dieses Skript prueft es am Bild selbst.

GEPRUEFT WIRD
  * Ecken-Pixel jedes quadratischen Launcher-/AppIcons: sie muessen entweder
    transparent oder in der Flaechenfarbe des Icons sein — NICHT in einer
    dritten Farbe (typisch: Weiss aus einem Export mit Hintergrund).
  * Reste eines wegretuschierten Rounded-Rects: helle Pixel im aeusseren Rand,
    die weder Flaeche noch Motiv sind (der Anti-Aliasing-Bogen). Ein Icon, dem
    man die Ecken nur „uebermalt" hat, faellt hier durch — richtig ist, die
    Flaeche vollflaechig neu aufzubauen.
  * Android: existiert `mipmap-anydpi-v26/ic_launcher.xml` (+ `_round`) und je
    Dichte ein `ic_launcher_foreground.png` mit Alphakanal?

Aufruf:
    uv run python scripts/diagnose/app-icons-pruefen.py

Exit 0 = sauber, Exit 1 = mindestens ein Befund.
"""

from __future__ import annotations

import subprocess
import sys
from collections import Counter
from hashlib import md5
from pathlib import Path

# Alle DREI Apps. Bewusst alle: derselbe Export-Fehler traf myBestDays genauso,
# nur ist er dort nicht sichtbar (weisses Icon auf weissem Grund). `mobile-owner`
# kam am 09.09.2026 dazu — es fehlte hier, seit es die App gibt (ADR-0022), und
# genau deshalb blieb unbemerkt, dass ihre Symbole byte-identisch die von
# `mobile-nextdays` waren: geprueft wurde die Farbe der Ecken, nicht die Frage,
# ob zwei Apps dasselbe Bild tragen. Die stellt `pruefe_doppelt` seit demselben
# Tag.
APPS = ("mobile-nextdays", "mobile-owner")
DICHTEN = ("mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi")

# Ab dieser Helligkeitsdifferenz gilt ein Eckpixel als FREMDE Farbe (0..255 je
# Kanal). 12 laesst Kompressionsrauschen und JPEG-artige Artefakte durch,
# schlaegt aber bei einem weissen Eck (Differenz ~245) sofort an.
TOLERANZ = 12
# Breite des geprueften Randstreifens als Anteil der Kantenlaenge. 1/16 deckt
# den Radius eines ueblichen Rounded-Rect-Exports ab.
RAND_ANTEIL = 16


def lade(datei: Path) -> tuple[int, int, dict[tuple[int, int], tuple[int, int, int, int]]]:
    """Ein Bild EINMAL vollstaendig als Pixelraster lesen.

    Bewusst ein einziger `magick`-Aufruf je Datei: die erste Fassung dieses
    Skripts fragte jeden Punkt einzeln ab und startete dabei tausende Prozesse
    — es lief nach zwei Minuten noch. Ein Diagnose-Werkzeug, das niemand
    abwartet, wird nicht benutzt.
    """
    roh = subprocess.run(
        ["magick", str(datei), "-depth", "8", "txt:"],
        capture_output=True, text=True, check=True,
    ).stdout
    raster: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    breite = hoehe = 0
    for zeile in roh.splitlines():
        if zeile.startswith("#"):
            continue
        kopf, rest = zeile.split(":", 1)
        x, y = (int(t) for t in kopf.split(","))
        breite, hoehe = max(breite, x + 1), max(hoehe, y + 1)
        innen = rest[rest.find("(") + 1: rest.find(")")]
        werte = [int(float(t)) for t in innen.split(",")]
        if len(werte) == 2:      # graya
            raster[(x, y)] = (werte[0], werte[0], werte[0], werte[1])
        elif len(werte) == 3:    # srgb ohne Alpha
            raster[(x, y)] = (werte[0], werte[1], werte[2], 255)
        else:
            raster[(x, y)] = (werte[0], werte[1], werte[2], werte[3])
    return breite, hoehe, raster


def hat_alpha(datei: Path) -> bool:
    roh = subprocess.run(
        ["magick", str(datei), "-format", "%[channels]", "info:"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return "a" in roh


def pruefe_icon(datei: Path) -> list[str]:
    """Ein quadratisches Icon auf Fremdfarbe im Rand pruefen."""
    befunde: list[str] = []
    breite, hoehe, raster = lade(datei)
    if breite != hoehe or breite == 0:
        return befunde  # nur quadratische Launcher-Icons

    # Die Flaechenfarbe ist die HAEUFIGSTE Farbe des Bildes, nicht der Wert an
    # einem festen Punkt. Die erste Fassung las bei (breite/4, hoehe/2) — bei
    # myBestDays liegt dort die Wortmarke, und das Skript meldete jedes Icon als
    # Befund, weil es einen Buchstaben mit der Flaeche verglich. Ein fester
    # Erwartungswert waere ausserdem ein Hardcode: myNextDays ist schwarz,
    # myBestDays weiss (Wurzel 4).
    haeufig = Counter(
        (r, g, b) for (r, g, b, a) in raster.values() if a > 0
    ).most_common(1)
    if not haeufig:
        return befunde  # vollstaendig transparent — nichts zu pruefen
    (fr, fg, fb), _ = haeufig[0]
    fa = 255
    er, eg, eb, ea = raster[(1, 1)]
    if ea > 0 and fa > 0:
        abstand = max(abs(er - fr), abs(eg - fg), abs(eb - fb))
        if abstand > TOLERANZ:
            befunde.append(
                f"{datei}: Ecke ({er},{eg},{eb}) weicht von der Flaeche "
                f"({fr},{fg},{fb}) ab (Abstand {abstand}). Weisse/fremde Ecken "
                "zeigt Android ohne adaptives Icon unmaskiert."
            )
            return befunde

    # Reste eines uebermalten Rounded-Rects: helle Pixel im Randstreifen. Nur
    # auf DUNKLER Flaeche ein Befund — auf hellem Grund ist ein heller Rand
    # keine Auffaelligkeit.
    if fa > 0 and max(fr, fg, fb) < 60:
        rand = max(2, breite // RAND_ANTEIL)
        treffer = 0
        for (x, y), (r, g, b, a) in raster.items():
            am_rand = x < rand or y < rand or x >= breite - rand or y >= hoehe - rand
            if am_rand and a > 0 and max(r, g, b) > max(fr, fg, fb) + 30:
                treffer += 1
        if treffer > 3:
            befunde.append(
                f"{datei}: {treffer} helle Pixel im aeusseren Rand — sieht nach "
                "einem uebermalten Rounded-Rect aus. Flaeche vollflaechig neu "
                "aufbauen, nicht die Ecken flicken."
            )
    return befunde


def pruefe_android(app: Path) -> list[str]:
    """Adaptive Icons vorhanden und vollstaendig?"""
    befunde: list[str] = []
    res = app / "android/app/src/main/res"
    if not res.is_dir():
        return befunde
    anydpi = res / "mipmap-anydpi-v26"
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        if not (anydpi / name).is_file():
            befunde.append(
                f"{app.name}: {anydpi/name} fehlt — ohne adaptives Icon malt "
                "Android 8+ das Legacy-Bitmap unmaskiert (weisse Ecken)."
            )
    if not (anydpi / "ic_launcher.xml").is_file():
        return befunde  # Foreground-Pruefung waere sinnlos
    for dichte in DICHTEN:
        vorder = res / f"mipmap-{dichte}" / "ic_launcher_foreground.png"
        if not vorder.is_file():
            befunde.append(f"{app.name}: {vorder} fehlt (adaptives Foreground).")
        elif not hat_alpha(vorder):
            befunde.append(
                f"{vorder}: kein Alphakanal — ein Foreground OHNE Transparenz "
                "verdeckt den Hintergrund und macht das adaptive Icon wirkungslos."
            )
    return befunde


def pruefe_doppelt(wurzel: Path) -> list[str]:
    """Tragen zwei Apps dasselbe Symbol?

    Der Befund vom 09.09.2026: `mobile-owner` und `mobile-nextdays` hatten in
    allen fuenf Android-Dichten UND allen neun iOS-Groessen byte-identische
    Dateien (md5 `beae8ce4…` bei xxxhdpi/ic_launcher.png). Im Launcher waren die
    beiden Apps damit nicht auseinanderzuhalten, und im Play Store stehen sie
    nebeneinander. Kein bestehender Test sah das: jedes Icon war fuer sich
    korrekt.

    Verglichen wird der INHALT, nicht der Pfad — eine Kopie unter anderem Namen
    waere derselbe Fehler.
    """
    befunde: list[str] = []
    gesehen: dict[str, list[Path]] = {}
    for app_name in APPS:
        app = wurzel / app_name
        if not app.is_dir():
            continue
        for datei in sorted([
            *(app / "android/app/src/main/res").glob("mipmap-*/ic_launcher.png"),
            *(app / "ios").glob("*/Images.xcassets/AppIcon.appiconset/*.png"),
        ]):
            gesehen.setdefault(md5(datei.read_bytes()).hexdigest(), []).append(datei)

    for summe, dateien in gesehen.items():
        apps = {d.relative_to(wurzel).parts[0] for d in dateien}
        if len(apps) > 1:
            befunde.append(
                f"{sorted(apps)} tragen dasselbe Symbol (md5 {summe[:8]}…): "
                + ", ".join(str(d.relative_to(wurzel)) for d in dateien)
                + " — zwei Apps desselben Herstellers sind so nicht "
                "unterscheidbar."
            )
    return befunde


def main() -> int:
    wurzel = Path(__file__).resolve().parents[2]
    alle: list[str] = pruefe_doppelt(wurzel)
    for app_name in APPS:
        app = wurzel / app_name
        if not app.is_dir():
            continue
        alle += pruefe_android(app)
        muster = [
            *(app / "android/app/src/main/res").glob("mipmap-*/ic_launcher.png"),
            *(app / "ios").glob("*/Images.xcassets/AppIcon.appiconset/*.png"),
        ]
        for datei in sorted(muster):
            alle += pruefe_icon(datei)

    if alle:
        print("BEFUNDE:", file=sys.stderr)
        for b in alle:
            print(f"  - {b}", file=sys.stderr)
        return 1
    print("Ergebnis: sauber — keine Fremdfarbe in den Ecken, adaptive Icons da.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
