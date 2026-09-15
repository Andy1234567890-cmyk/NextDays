"""Holt die Zielgruppen-Fotos der Marketing-Startseite und legt sie versioniert ab.

Je Unterkunftsart EIN Foto für die Karten der Sektion „Für jede kleine
Unterkunft gemacht" (`marketing/components/marketing/marketing-zielgruppen.tsx`).

Die Fotos sind **von Hand kuratiert** (Pexels-IDs unten), nicht automatisch
gesucht: die Karte behauptet „so sieht ein Motel aus", und ein Zufallstreffer,
der thematisch danebenliegt, entwertet die Aussage. Gleiches Vorgehen wie bei den
Demo-Objektfotos (`scripts/demo/fotos.py`).

Warum Stockfotos und nicht Aufnahmen aus der Software: die Kachel ist halb so
breit wie die Karte; eine 1600er-Oberfläche darin heruntergerechnet ist ein
grauer Fleck. Aufnahmen der Software stehen weiter in der Sektion „Einblicke",
wo sie ganze Breite haben.

Nicht verwendbar sind Fotos echter Kunden (AirSmil-Bestand) — fremde
Objektfotos und Gäste auf einer Verkaufsseite sind ohne Einwilligung
datenschutzrechtlich tabu.

Pexels-Lizenz: kommerzielle Nutzung frei, keine Namensnennung nötig
(https://www.pexels.com/license/). Die Herkunft jedes Bildes steht trotzdem in
`manifest.json` neben den Dateien — nachprüfbar und versioniert.

Aufruf:
    apps/api/.venv/bin/python scripts/marketing/zielgruppen_fotos.py         # fehlende laden
    apps/api/.venv/bin/python scripts/marketing/zielgruppen_fotos.py --neu   # alles neu laden
"""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

import httpx
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
ZIEL = REPO / "marketing" / "public" / "marketing" / "zielgruppen"
MANIFEST = ZIEL / "manifest.json"

# Zielmaß: die Karte zeigt das Foto auf höchstens ~500 logischen Pixeln Breite,
# 1200 px reichen damit auch für Retina — und halten die Seite leicht.
MAX_BREITE = 1200
WEBP_QUALITAET = 82

# Kuratierte Pexels-Fotos je Unterkunftsart. Reihenfolge = Reihenfolge der
# Karten in der Sektion. Der Text daneben beschreibt, was das Bild zeigen MUSS —
# wer eine ID austauscht, prüft das Bild gegen diese Beschreibung.
KURATIERT: dict[str, tuple[int, str]] = {
    "hotel": (18651505, "Modernes Hotelzimmer mit Sesseln, Schreibtisch und Fernseher"),
    "bnb": (6429527, "Frühstückstablett mit Croissants auf einem gemachten Bett"),
    "gaestehaus": (7587467, "Gästehaus aus Backstein mit Garten und Bäumen"),
    "motel": (30171418, "Motel-Leuchtschild an einer Straße im Abendlicht"),
    "lodge": (18013524, "Lodge aus Holz mitten im Wald, von oben gesehen"),
    "ferienwohnung": (11167661, "Helles Wohnzimmer einer Ferienwohnung mit Balkontür"),
    "resort": (6821435, "Resort-Pool mit Palmen und Liegen"),
    "huette": (7185634, "Almhütte auf einer Wiese vor Bergen"),
    "pension": (11757072, "Zimmer einer Pension mit hölzernem Bettkopfteil und Nachttischlampen"),
}


def _url(foto_id: int) -> str:
    return (
        f"https://images.pexels.com/photos/{foto_id}/pexels-photo-{foto_id}.jpeg"
        f"?auto=compress&cs=tinysrgb&w={MAX_BREITE}"
    )


def main() -> int:
    """Fehlende (oder mit --neu alle) Fotos laden und das Manifest neu schreiben."""
    zerleger = argparse.ArgumentParser(description=__doc__)
    zerleger.add_argument("--neu", action="store_true", help="vorhandene Dateien überschreiben")
    argumente = zerleger.parse_args()

    ZIEL.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, object]] = []

    with httpx.Client(follow_redirects=True, timeout=60) as client:
        for typ, (foto_id, beschreibung) in KURATIERT.items():
            datei = ZIEL / f"{typ}.webp"
            manifest.append(
                {
                    "typ": typ,
                    "datei": datei.name,
                    "zeigt": beschreibung,
                    "direkt_url": _url(foto_id),
                    "quelle_url": f"https://www.pexels.com/photo/{foto_id}/",
                    "lizenz": "Pexels License",
                    "lizenz_url": "https://www.pexels.com/license/",
                    "anbieter": "pexels",
                }
            )
            if datei.exists() and not argumente.neu:
                print(f"= {datei.name} (vorhanden)")
                continue

            antwort = client.get(_url(foto_id))
            antwort.raise_for_status()
            bild = Image.open(io.BytesIO(antwort.content)).convert("RGB")
            if bild.width > MAX_BREITE:
                bild.thumbnail((MAX_BREITE, MAX_BREITE * 2))
            bild.save(datei, "WEBP", quality=WEBP_QUALITAET)
            print(f"+ {datei.name} {bild.width}×{bild.height} (Pexels {foto_id})")

    MANIFEST.write_text(f"{json.dumps(manifest, indent=2, ensure_ascii=False)}\n", encoding="utf-8")
    print(f"Manifest: {MANIFEST.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
