#!/usr/bin/env python3
"""icon-eigentuemer-erzeugen.py — App-Symbol der Eigentuemer-App aus der Bildmarke.

WARUM ES DIESES SKRIPT GIBT UND NICHT NUR PNGs:
`mobile-owner` trug bis zum 09.09.2026 BYTE-IDENTISCH die Symbole von
`mobile-nextdays` — in allen fuenf Android-Dichten und allen neun iOS-Groessen
(nachgemessen: md5 `beae8ce4…` bei xxxhdpi/ic_launcher.png hier wie dort). Zwei
Apps desselben Herstellers waren im Launcher nicht auseinanderzuhalten, und im
Play Store stehen sie nebeneinander.

Der Unterschied ist die FLAECHE, nicht das Motiv: myNextDays sitzt auf
`#0A0A0A`, die Eigentuemer-App auf dem Logo-Rot `#B82028`. Bei 48 px liest man
eine Kachelfarbe, kein Detail — ein zusaetzlicher Strich im selben Schwarz waere
keine Unterscheidung gewesen (Entscheidung vom 09.09.2026). Dieselbe Bildmarke,
weil es dieselbe MARKE ist (`theme/marke.ts`: id `mynextdays`); nur die
Chevron-Farben tauschen, damit auf Rot beides trennscharf bleibt.

Die Geometrie stammt NICHT aus einem Augenmass, sondern aus zwei Quellen:
  * die Pfade aus `mobile-owner/assets/img/mnd_bildmarke.svg` (dieselbe Vorlage,
    aus der die Splash-Wortmarke kommt),
  * die AUSGEMESSENEN Verhaeltnisse der bestehenden Symbole: das Motiv ist in
    `ic_launcher`/`AppIcon` 51,2 % der Kantenlaenge breit und mittig, im
    adaptiven `ic_launcher_foreground` 55,1 % (dort schneidet der Launcher noch
    seine eigene Form heraus). Wer die Zahlen aendert, aendert sie hier — nicht
    in einem Bildprogramm.

Erzeugt wird alles, was die beiden Plattformen und der Store brauchen:
  mobile-owner/android/.../mipmap-*/ic_launcher.png            (ohne Alpha)
  mobile-owner/android/.../mipmap-*/ic_launcher_round.png      (Kreis, Alpha)
  mobile-owner/android/.../mipmap-*/ic_launcher_foreground.png (nur Motiv, Alpha)
  mobile-owner/ios/.../AppIcon.appiconset/AppIcon-*.png        (ohne Alpha)
  docs/store-assets/eigentuemer/play-icon-512.png              (32 Bit mit Alpha)
  docs/store-assets/eigentuemer/play-feature-1024x500.png      (ohne Alpha)

`values/colors.xml` traegt den Hintergrund des adaptiven Symbols und wird
MITGEAENDERT — sonst sitzt das Motiv auf Rot und der adaptive Grund bleibt
schwarz (der Fehler, den man erst auf einem echten Geraet sieht).

Aufruf (vom Repo-Wurzelverzeichnis):
    uv run --project apps/api python scripts/mobile/icon-eigentuemer-erzeugen.py
Danach zwingend:
    uv run --project apps/api python scripts/diagnose/app-icons-pruefen.py
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WURZEL = Path(__file__).resolve().parents[2]
APP = WURZEL / "mobile-owner"
RES = APP / "android/app/src/main/res"
IOS_ICONS = APP / "ios/MyNextDaysOwner/Images.xcassets/AppIcon.appiconset"
STORE = WURZEL / "docs/store-assets/eigentuemer"

# --- Farben ------------------------------------------------------------------
# Logo-Rot aus `mnd_bildmarke.svg` (Stroke des vorderen Chevrons), nicht der
# Oberflaechen-Akzent `#C42B3A` aus theme/marke.ts: das Symbol gehoert zum LOGO,
# und die Vorlage fuehrt dort #B82028.
GRUND = (184, 32, 40)  # #B82028
# EINE Regel fuer alle roten Flaechen dieses Auftritts: was in der
# Negativ-Fassung ROT ist, wird auf rotem Grund `#0A0A0A`; was weiss ist, bleibt
# weiss. Damit stimmen Symbol und Feature-Grafik ueberein, ohne dass jemand zwei
# Farbregeln im Kopf halten muss — und die Rolle der Chevrons bleibt dieselbe wie
# auf Schwarz: das hintere (links) ist das zurueckhaltende, das vordere (rechts)
# traegt den Akzent.
CHEVRON_HINTEN = (255, 255, 255)  # war weiss -> bleibt weiss
CHEVRON_VORNE = (10, 10, 10)  # war #B82028 -> #0A0A0A

# --- Geometrie der Bildmarke (aus mnd_bildmarke.svg, viewBox 0 0 73 54) ------
# Zwei kubische Bezier-Zuege je Chevron, Strichstaerke 8, runde Enden und Ecken.
STRICH = 8.0
CHEVRON_PFADE = (
    # hinten (links)
    ((4.00098, 4.00085), (12.001, 8.00085), (19.3343, 14.3342), (26.001, 23.0009),
     (19.3343, 31.6675), (12.001, 38.0009), (4.00098, 42.0009)),
    # vorne (rechts)
    ((39.001, 4.00085), (47.001, 8.00085), (54.3343, 14.3342), (61.001, 23.0009),
     (54.3343, 31.6675), (47.001, 38.0009), (39.001, 42.0009)),
)

# Dieselben Chevrons in der Wortmarken-Fassung (`mnd_lockup_negativ.svg`,
# viewBox 245 x 44, transform translate(2 2), Strichstaerke 4). Sie stehen hier,
# weil ImageMagicks SVG-Renderer gestrichene Pfade OHNE Fuellung stillschweigend
# weglaesst — die gerenderte Wortmarke kommt ohne Chevrons zurueck, und das faellt
# nur auf, wenn man hinsieht. Gezeichnet werden sie deshalb wie im Symbol.
LOCKUP_STRICH = 4.0
LOCKUP_VERSATZ = 2.0
LOCKUP_BREITE = 245.0
LOCKUP_CHEVRON_PFADE = (
    ((2.00049, 7.0), (6.66715, 9.0), (11.0005, 12.6667), (15.0005, 18.0),
     (11.0005, 23.3333), (6.66715, 27.0), (2.00049, 29.0)),
    ((21.0005, 7.0), (25.6672, 9.0), (30.0005, 12.6667), (34.0005, 18.0),
     (30.0005, 23.3333), (25.6672, 27.0), (21.0005, 29.0)),
)

# Ausgemessen an den bestehenden Symbolen (siehe Kopf).
BREITE_LEGACY = 0.512
BREITE_FOREGROUND = 0.551

# Vierfache Ueberabtastung. Die Chevrons werden als Kette runder Stempel
# gezeichnet — das gibt exakt die runden Enden und Ecken der Vorlage, ohne einen
# SVG-Renderer, dessen `stroke-linecap` je nach Delegate anders ausfaellt.
UEBER = 4

ANDROID_DICHTEN = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}

IOS_GROESSEN = {
    "AppIcon-20@2x.png": 40,
    "AppIcon-20@3x.png": 60,
    "AppIcon-29@2x.png": 58,
    "AppIcon-29@3x.png": 87,
    "AppIcon-40@2x.png": 80,
    "AppIcon-40@3x.png": 120,
    "AppIcon-60@2x.png": 120,
    "AppIcon-60@3x.png": 180,
    "AppIcon-1024.png": 1024,
}


def _kubisch(p0, p1, p2, p3, t: float) -> tuple[float, float]:
    u = 1.0 - t
    a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t
    return (
        a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
        a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    )


def _chevron(
    zeichner: ImageDraw.ImageDraw,
    punkte,
    farbe,
    skala: float,
    strich: float = STRICH,
    versatz: tuple[float, float] = (0.0, 0.0),
) -> None:
    """Einen Chevron als Kette runder Stempel zeichnen.

    Dicht genug abgetastet, dass zwischen zwei Stempeln keine Kerbe bleibt:
    900 Schritte je Bezier-Segment sind bei jeder hier erzeugten Groesse
    deutlich unter einem Pixel Abstand.
    """
    radius = strich / 2.0 * skala
    segmente = ((punkte[0], punkte[1], punkte[2], punkte[3]),
                (punkte[3], punkte[4], punkte[5], punkte[6]))
    for p0, p1, p2, p3 in segmente:
        for schritt in range(901):
            x, y = _kubisch(p0, p1, p2, p3, schritt / 900.0)
            x = x * skala + versatz[0]
            y = y * skala + versatz[1]
            zeichner.ellipse(
                (x - radius, y - radius, x + radius, y + radius),
                fill=farbe,
            )


def motiv(hoehe_px: int) -> Image.Image:
    """Die Bildmarke freigestellt, auf ihre eigene Bounding-Box beschnitten.

    Beschnitten wird auf das, was WIRKLICH gezeichnet wurde, nicht auf die
    rechnerische Pfad-Box: die runden Enden ragen ueber den letzten Pfadpunkt
    hinaus, und zwar in Richtung der Tangente. Wer die Box ausrechnet statt sie
    zu messen, setzt das Motiv um bis zu einem halben Strich versetzt.
    """
    skala = hoehe_px * UEBER / 54.0
    bild = Image.new("RGBA", (int(73 * skala) + 1, int(54 * skala) + 1), (0, 0, 0, 0))
    zeichner = ImageDraw.Draw(bild)
    _chevron(zeichner, CHEVRON_PFADE[0], (*CHEVRON_HINTEN, 255), skala)
    _chevron(zeichner, CHEVRON_PFADE[1], (*CHEVRON_VORNE, 255), skala)
    box = bild.getbbox()
    if box is None:
        raise RuntimeError("Bildmarke leer gezeichnet — Pfade pruefen.")
    return bild.crop(box)


def _mit_motiv(kante: int, anteil: int, grund, rund: bool) -> Image.Image:
    """Ein quadratisches Symbol bauen: Flaeche + mittig gesetztes Motiv."""
    gross = kante * UEBER
    if grund is None:
        bild = Image.new("RGBA", (gross, gross), (0, 0, 0, 0))
    else:
        bild = Image.new("RGBA", (gross, gross), (*grund, 255))
        if rund:
            maske = Image.new("L", (gross, gross), 0)
            ImageDraw.Draw(maske).ellipse((0, 0, gross - 1, gross - 1), fill=255)
            bild.putalpha(maske)

    ziel_breite = int(round(gross * anteil / 100.0))
    roh = motiv(max(64, kante))
    hoehe = max(1, int(round(ziel_breite * roh.height / roh.width)))
    marke = roh.resize((ziel_breite, hoehe), Image.LANCZOS)
    bild.alpha_composite(marke, ((gross - ziel_breite) // 2, (gross - hoehe) // 2))
    return bild.resize((kante, kante), Image.LANCZOS)


def schreibe(bild: Image.Image, ziel: Path, *, alpha: bool) -> None:
    ziel.parent.mkdir(parents=True, exist_ok=True)
    if not alpha:
        flach = Image.new("RGB", bild.size, GRUND)
        flach.paste(bild, mask=bild.split()[3])
        flach.save(ziel, "PNG")
    else:
        bild.save(ziel, "PNG")
    print(f"  {ziel.relative_to(WURZEL)}  {bild.size[0]}x{bild.size[1]}")


def _wortmarke(breite_px: int) -> Image.Image:
    """Chevrons + Wortmarke fuer den roten Grund.

    Quelle ist `assets/img/mnd_lockup_negativ.svg` — die Fassung fuer dunkle
    Flaechen (Chevron hinten und „my"/„Days" weiss, Chevron vorne `#B82028`,
    „Next" `#E24B4A`). Auf unserem roten Grund verschwaenden die beiden
    Rottoene; sie werden nach `#0A0A0A` gezogen, dieselbe Regel wie im Symbol.

    NICHT aus `mynextdays-logo.png`/`-light.png`: beide sind vollflaechig
    deckend auf WEISS (nachgemessen — Alpha ist ueberall 255), auf rotem Grund
    also ein weisser Kasten. Die Schrift nachzusetzen scheidet ebenfalls aus:
    die Buchstabenabstaende der Marke sind gesetzt, nicht gerechnet.

    Umgefaerbt wird die SVG-QUELLE, nicht das fertige Bitmap — ein Farbtausch am
    Bitmap liesse an jeder Antialiasing-Kante einen roten Saum stehen.
    """
    quelle = APP / "assets/img/mnd_lockup_negativ.svg"
    text = quelle.read_text(encoding="utf-8")
    if 'fill="#E24B4A"' not in text:
        raise SystemExit(f"{quelle}: 'fill=\"#E24B4A\"' fehlt — Vorlage geaendert?")
    text = text.replace('fill="#E24B4A"', 'fill="#0A0A0A"')

    ordner = Path(tempfile.mkdtemp())
    svg = ordner / "lockup.svg"
    svg.write_text(text, encoding="utf-8")
    png = ordner / "lockup.png"
    skala = breite_px / LOCKUP_BREITE
    subprocess.run(
        ["magick", "-background", "none", "-density", str(int(round(72 * skala))),
         str(svg), f"png32:{png}"],
        check=True, capture_output=True,
    )
    bild = Image.open(png).convert("RGBA")

    # Die fehlenden Chevrons in DERSELBEN Koordinatenlage nachziehen.
    zeichner = ImageDraw.Draw(bild)
    versatz = (LOCKUP_VERSATZ * skala, LOCKUP_VERSATZ * skala)
    _chevron(zeichner, LOCKUP_CHEVRON_PFADE[0], (*CHEVRON_HINTEN, 255),
             skala, LOCKUP_STRICH, versatz)
    _chevron(zeichner, LOCKUP_CHEVRON_PFADE[1], (*CHEVRON_VORNE, 255),
             skala, LOCKUP_STRICH, versatz)

    box = bild.getbbox()
    return bild.crop(box) if box else bild


def feature_grafik() -> Image.Image:
    """1024x500 fuer den Store-Eintrag.

    Google verlangt hier KEINEN Alphakanal, warnt vor Motiven an den Raendern
    („Avoid placing key elements … in the cutoff zones") und raet davon ab, das
    App-Symbol zu wiederholen. Deshalb: Wortmarke mittig, der Zusatz
    „Eigentuemer" darunter — die Grafik sagt, WELCHE der beiden myNextDays-Apps
    das ist. Genau diese Frage stellt sich der Betrachter, wenn beide
    nebeneinander stehen.
    """
    breite, hoehe = 1024, 500
    bild = Image.new("RGBA", (breite * 2, hoehe * 2), (*GRUND, 255))

    marke = _wortmarke(1180)
    bild.alpha_composite(marke, ((breite * 2 - marke.width) // 2, 300))

    schrift = ImageFont.truetype(
        str(APP / "assets/fonts/SchibstedGrotesk_500Medium.ttf"), 96
    )
    zeichner = ImageDraw.Draw(bild)
    wort = "Eigentümer"
    # Etwas Laufweite: gesperrt liest sich ein einzelnes Wort unter einer
    # Wortmarke als Beischrift und nicht als zweite Zeile derselben.
    sperrung = 14
    gesamt = sum(
        zeichner.textlength(z, font=schrift) for z in wort
    ) + sperrung * (len(wort) - 1)
    x = (breite * 2 - gesamt) / 2
    y = 300 + marke.height + 90
    for zeichen in wort:
        zeichner.text((x, y), zeichen, font=schrift, fill=(255, 255, 255, 255))
        x += zeichner.textlength(zeichen, font=schrift) + sperrung

    return bild.resize((breite, hoehe), Image.LANCZOS)


def farben_xml() -> None:
    """Den Hintergrund des adaptiven Symbols mitziehen (Wurzel 1)."""
    datei = RES / "values/colors.xml"
    text = datei.read_text(encoding="utf-8")
    alt = '<color name="ic_launcher_background">#0A0A0A</color>'
    neu = '<color name="ic_launcher_background">#B82028</color>'
    if neu in text:
        print("  values/colors.xml bereits auf #B82028")
        return
    if alt not in text:
        raise SystemExit(
            f"{datei}: erwartete Zeile '{alt}' nicht gefunden — bitte von Hand pruefen."
        )
    datei.write_text(text.replace(alt, neu), encoding="utf-8")
    print(f"  {datei.relative_to(WURZEL)}  ic_launcher_background -> #B82028")


def main() -> int:
    if not APP.is_dir():
        print(f"{APP} fehlt", file=sys.stderr)
        return 1

    print("Android:")
    for dichte, (legacy, vorder) in ANDROID_DICHTEN.items():
        ordner = RES / f"mipmap-{dichte}"
        schreibe(
            _mit_motiv(legacy, int(BREITE_LEGACY * 100), GRUND, rund=False),
            ordner / "ic_launcher.png",
            alpha=False,
        )
        schreibe(
            _mit_motiv(legacy, int(BREITE_LEGACY * 100), GRUND, rund=True),
            ordner / "ic_launcher_round.png",
            alpha=True,
        )
        schreibe(
            _mit_motiv(vorder, int(BREITE_FOREGROUND * 100), None, rund=False),
            ordner / "ic_launcher_foreground.png",
            alpha=True,
        )
    farben_xml()

    print("iOS:")
    for name, kante in IOS_GROESSEN.items():
        schreibe(
            _mit_motiv(kante, int(BREITE_LEGACY * 100), GRUND, rund=False),
            IOS_ICONS / name,
            alpha=False,
        )

    print("Store:")
    schreibe(
        _mit_motiv(512, int(BREITE_LEGACY * 100), GRUND, rund=False),
        STORE / "play-icon-512.png",
        alpha=True,
    )
    schreibe(feature_grafik(), STORE / "play-feature-1024x500.png", alpha=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
