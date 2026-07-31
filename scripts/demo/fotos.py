"""Holt die Objektfotos für den Demo-Bestand und legt sie lokal ab.

Quelle ist eine **von Hand kuratierte Liste** von Pexels-Fotos je Objekt
(`fotos_kuratiert.json`). Kuratiert, weil automatische Bildsuche für diesen Zweck
nicht taugt: die Bilder landen in Screenshots auf der Verkaufsseite, und ein
Zufallstreffer, der thematisch danebenliegt, entwertet das ganze Bild. Die
Pexels-Lizenz erlaubt kommerzielle Nutzung ohne Namensnennung — deshalb ist auch
keine Attributionszeile in der App nötig, die dort niemand pflegen würde.
Jede Herkunft steht trotzdem in `fotos/manifest.json`: versioniert und
nachprüfbar.

Fällt ein Objekt aus der kuratierten Liste heraus, greift Openverse (CC0) als
Notnagel — brauchbar für die Vollständigkeit, nicht für die Bildwirkung.

Aufruf:
    apps/api/.venv/bin/python scripts/demo/fotos.py            # fehlende laden
    apps/api/.venv/bin/python scripts/demo/fotos.py --neu      # alles neu laden
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
from pathlib import Path
from typing import Any

import httpx
from PIL import Image

# Nachbarmodul im selben Ordner; das Skript läuft per Pfad, nicht als Paket —
# der Pfad-Eintrag steht deshalb absichtlich vor dem Import.
sys.path.insert(0, str(Path(__file__).resolve().parent))
# pylint: disable=wrong-import-position
from katalog import BETRIEBE, Objekt  # noqa: E402
# pylint: enable=wrong-import-position

FOTO_ORDNER = Path(__file__).resolve().parent / "fotos"
MANIFEST = FOTO_ORDNER / "manifest.json"
KURATIERT = Path(__file__).resolve().parent / "fotos_kuratiert.json"

# Zielmaß: breit genug für Objekt-Detail und Marktplatz-Kachel im Screenshot,
# klein genug, dass 100+ Bilder den Bucket nicht zumüllen.
MAX_BREITE = 1600
WEBP_QUALITAET = 82

# Was als Objektfoto durchgeht. Hochformate und Briefmarken fallen raus, weil
# die Kachel-Layouts der App auf Querformat ausgelegt sind.
MIN_BREITE = 1100
MIN_SEITENVERHAELTNIS = 1.2
MAX_SEITENVERHAELTNIS = 2.1


def _kuratiert(schluessel: str, anzahl: int) -> list[dict[str, Any]]:
    """Die gepflegte Pexels-Liste für ein Objekt in Manifest-Einträge übersetzen."""
    liste = json.loads(KURATIERT.read_text(encoding="utf-8")).get(schluessel) or []
    return [
        {
            "direkt_url": (
                f"https://images.pexels.com/photos/{foto_id}/pexels-photo-{foto_id}.jpeg"
                f"?auto=compress&cs=tinysrgb&w={MAX_BREITE}"
            ),
            "quelle_url": f"https://www.pexels.com/photo/{foto_id}/",
            "titel": "",
            "urheber": "",
            "lizenz": "Pexels License",
            "lizenz_url": "https://www.pexels.com/license/",
            "anbieter": "pexels",
        }
        for foto_id in liste[:anzahl]
    ]


def _openverse(client: httpx.Client, suche: str, anzahl: int) -> list[dict[str, Any]]:
    antwort = client.get(
        "https://api.openverse.org/v1/images/",
        params={
            "q": suche,
            "license": "cc0",
            "extension": "jpg",
            "size": "large",
            "mature": "false",
            # 20 ist die Obergrenze für nicht registrierte Zugriffe — mehr
            # beantwortet Openverse mit 401, nicht mit einer kürzeren Liste.
            "page_size": 20,
        },
        headers={"User-Agent": "nextdays-demo-seed/1.0"},
    )
    antwort.raise_for_status()
    treffer: list[dict[str, Any]] = []
    for eintrag in antwort.json().get("results", []):
        breite, hoehe = eintrag.get("width") or 0, eintrag.get("height") or 0
        if breite < MIN_BREITE or not hoehe:
            continue
        verhaeltnis = breite / hoehe
        if not MIN_SEITENVERHAELTNIS <= verhaeltnis <= MAX_SEITENVERHAELTNIS:
            continue
        treffer.append({
            "direkt_url": eintrag["url"],
            "quelle_url": eintrag.get("foreign_landing_url", ""),
            "titel": eintrag.get("title") or "",
            "urheber": eintrag.get("creator") or "",
            "lizenz": "CC0 1.0",
            "lizenz_url": "https://creativecommons.org/publicdomain/zero/1.0/",
            "anbieter": eintrag.get("source", "openverse"),
        })
        if len(treffer) >= anzahl:
            break
    return treffer


def _pexels(client: httpx.Client, suche: str, anzahl: int, key: str) -> list[dict[str, Any]]:
    antwort = client.get(
        "https://api.pexels.com/v1/search",
        params={"query": suche, "per_page": max(anzahl * 2, 15), "orientation": "landscape"},
        headers={"Authorization": key},
    )
    antwort.raise_for_status()
    return [
        {
            "direkt_url": foto["src"]["large2x"],
            "quelle_url": foto["url"],
            "titel": foto.get("alt") or "",
            "urheber": foto.get("photographer") or "",
            "lizenz": "Pexels License",
            "lizenz_url": "https://www.pexels.com/license/",
            "anbieter": "pexels",
        }
        for foto in antwort.json().get("photos", [])[:anzahl]
    ]


def _aufbereiten(rohdaten: bytes) -> bytes:
    """Auf Zielbreite skalieren und als WebP kodieren."""
    bild = Image.open(io.BytesIO(rohdaten))
    if bild.mode not in ("RGB", "L"):
        bild = bild.convert("RGB")
    if bild.width > MAX_BREITE:
        hoehe = round(bild.height * MAX_BREITE / bild.width)
        bild = bild.resize((MAX_BREITE, hoehe), Image.Resampling.LANCZOS)
    puffer = io.BytesIO()
    bild.save(puffer, format="WEBP", quality=WEBP_QUALITAET, method=5)
    return puffer.getvalue()


def _objekt_laden(client: httpx.Client, objekt: Objekt, key: str | None,
                  neu: bool) -> list[dict[str, Any]]:
    ziel = FOTO_ORDNER / objekt.schluessel
    ziel.mkdir(parents=True, exist_ok=True)
    vorhanden = sorted(ziel.glob("*.webp"))
    if vorhanden and not neu:
        print(f"  {objekt.schluessel}: {len(vorhanden)} Fotos im Cache")
        return []

    kandidaten = _kuratiert(objekt.schluessel, objekt.foto_anzahl)
    if not kandidaten:
        kandidaten = (
            _pexels(client, objekt.foto_suche, objekt.foto_anzahl, key) if key
            else _openverse(client, objekt.foto_suche, objekt.foto_anzahl)
        )
    if len(kandidaten) < objekt.foto_anzahl:
        # Kein stiller Ersatz: zu wenige Treffer sind ein echtes Problem
        # (leere Galerie im Screenshot) und müssen sichtbar sein.
        print(f"  ! {objekt.schluessel}: nur {len(kandidaten)}/{objekt.foto_anzahl} "
              f"Treffer für „{objekt.foto_suche}\"")

    eintraege: list[dict[str, Any]] = []
    for nummer, kandidat in enumerate(kandidaten, start=1):
        try:
            rohdaten = client.get(kandidat["direkt_url"], follow_redirects=True,
                                  headers={"User-Agent": "nextdays-demo-seed/1.0"})
            rohdaten.raise_for_status()
            bild = _aufbereiten(rohdaten.content)
        except (httpx.HTTPError, OSError) as fehler:
            print(f"  ! {objekt.schluessel}/{nummer}: {fehler}")
            continue
        datei = ziel / f"{nummer:02d}.webp"
        datei.write_bytes(bild)
        eintraege.append({
            "objekt": objekt.schluessel,
            "datei": f"{objekt.schluessel}/{datei.name}",
            **kandidat,
        })
    print(f"  {objekt.schluessel}: {len(eintraege)} Fotos geladen")
    return eintraege


def main() -> int:
    """Fehlende Objektfotos laden und das Manifest fortschreiben."""
    parser = argparse.ArgumentParser(description="Objektfotos für den Demo-Bestand laden")
    parser.add_argument("--neu", action="store_true", help="Cache ignorieren, alles neu laden")
    parser.add_argument("--objekt", help="nur dieses Objekt (Schlüssel aus katalog.py)")
    argumente = parser.parse_args()

    key = os.environ.get("PEXELS_API_KEY")
    print(f"Quelle: kuratierte Pexels-Liste "
          f"(Notnagel: {'Pexels-Suche' if key else 'Openverse CC0'})")

    FOTO_ORDNER.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, Any]] = []
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    with httpx.Client(timeout=60.0) as client:
        for betrieb in BETRIEBE:
            print(f"{betrieb.name}:")
            for objekt in betrieb.objekte:
                if argumente.objekt and objekt.schluessel != argumente.objekt:
                    continue
                neue = _objekt_laden(client, objekt, key, argumente.neu)
                if neue:
                    manifest = [e for e in manifest if e["objekt"] != objekt.schluessel]
                    manifest += neue

    manifest.sort(key=lambda e: (e["objekt"], e["datei"]))
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    print(f"\nManifest: {len(manifest)} Fotos → {MANIFEST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
