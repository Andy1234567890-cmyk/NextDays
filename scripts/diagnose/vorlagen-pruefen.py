#!/usr/bin/env python3
"""Prüft die Website-Vorlagen — statisch und, wenn die API läuft, live.

Warum ein eigenes Skript: eine Vorlage ist ein Fixture aus mehreren hundert
verschachtelten Feldern. Ein Tippfehler darin fällt in `pytest` nur auf, wenn
zufällig ein Test genau diese Vorlage anwendet — im Betrieb dagegen sofort, als
422 beim Klick auf „Vorlage übernehmen", und dann steht der Kunde vor einer halb
angelegten Website.

Geprüft wird:

  1. Jeder Block validiert gegen sein content-Schema (dieselbe Funktion, die der
     Service beim Anlegen benutzt).
  2. Jede Vorlage hat genau eine Startseite und keine doppelten Slugs.
  3. Jede Vorlage bringt die Rechtsseiten in der Fußzeile mit.
  4. `TEMPLATE_REIHENFOLGE` und `TEMPLATES` sind deckungsgleich — ein Eintrag in
     der Reihenfolge ohne Vorlage wäre eine leere Kachel, eine Vorlage ohne
     Eintrag wäre unsichtbar.
  5. Jede Bild-URL antwortet (nur mit --bilder: 40+ Netzabrufe).
  6. Live (nur mit --live): der öffentliche Vorschau-Endpunkt ist fail-closed —
     Müll-Token → 403, unbekannte Vorlage → 404, fehlender Token → 422.

Aufruf aus `apps/api` (das Skript importiert den Slice, daher PYTHONPATH):

    PYTHONPATH=. uv run python ../../scripts/diagnose/vorlagen-pruefen.py
    PYTHONPATH=. uv run python ../../scripts/diagnose/vorlagen-pruefen.py --live
    PYTHONPATH=. uv run python ../../scripts/diagnose/vorlagen-pruefen.py --bilder
"""
from __future__ import annotations

import sys
import urllib.error
import urllib.request

from src.features.site_config import templates as site_templates
from src.features.site_config.basis import BlockType
from src.features.site_config.block_inhalte import validate_block_content

API = "http://localhost:8000/api/v1"
RECHTSSEITEN = {"impressum", "datenschutz", "agb", "widerruf", "cookie-richtlinie"}


def _status(url: str) -> int:
    """HTTP-Status einer Adresse. 0 = keine Antwort."""
    req = urllib.request.Request(url, method="GET")  # noqa: S310 — feste http(s)-Adressen
    try:
        with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310
            return int(res.status)
    except urllib.error.HTTPError as exc:
        return int(exc.code)
    except OSError:
        return 0


def pruefe_statisch() -> list[str]:
    fehler: list[str] = []
    reihenfolge = set(site_templates.TEMPLATE_REIHENFOLGE)
    vorhanden = set(site_templates.TEMPLATES)
    if reihenfolge != vorhanden:
        fehler.append(
            "TEMPLATE_REIHENFOLGE und TEMPLATES sind nicht deckungsgleich: "
            f"nur in der Reihenfolge {sorted(reihenfolge - vorhanden)}, "
            f"nur in TEMPLATES {sorted(vorhanden - reihenfolge)}"
        )

    bloecke = 0
    for tid, tmpl in site_templates.TEMPLATES.items():
        seiten = tmpl.get("pages", [])
        slugs = [p["slug"] for p in seiten]
        if len(slugs) != len(set(slugs)):
            fehler.append(f"{tid}: doppelte Slugs — {slugs}")
        homes = [p for p in seiten if p.get("is_home")]
        if len(homes) != 1:
            fehler.append(f"{tid}: {len(homes)} Startseiten, erwartet genau eine")
        fuss = {p["slug"] for p in seiten if p.get("nav_area") == "footer"}
        if not RECHTSSEITEN <= fuss:
            fehler.append(
                f"{tid}: Rechtsseiten fehlen in der Fußzeile — {sorted(RECHTSSEITEN - fuss)}"
            )
        if tmpl.get("kategorie") not in site_templates.KATEGORIEN:
            fehler.append(f"{tid}: unbekannte Kategorie {tmpl.get('kategorie')!r}")
        for page in seiten:
            for pos, block in enumerate(page.get("blocks", [])):
                bloecke += 1
                try:
                    validate_block_content(
                        BlockType(block["type"]), dict(block.get("content") or {})
                    )
                except (ValueError, KeyError) as exc:
                    fehler.append(
                        f"{tid} · /{page['slug']} · Abschnitt {pos} ({block.get('type')}): {exc}"
                    )
    print(
        f"  {len(site_templates.TEMPLATES)} Vorlagen, "
        f"{sum(len(t.get('pages', [])) for t in site_templates.TEMPLATES.values())} Seiten, "
        f"{bloecke} Abschnitte geprüft"
    )
    return fehler


def sammle_bilder() -> set[str]:
    """Jede Bild-Adresse, die in einer Vorlage steht."""
    urls: set[str] = set()

    def aus(wert: object) -> None:
        if isinstance(wert, dict):
            for schluessel, inhalt in wert.items():
                if schluessel in ("url", "image_url") and isinstance(inhalt, str):
                    urls.add(inhalt)
                else:
                    aus(inhalt)
        elif isinstance(wert, list):
            for eintrag in wert:
                aus(eintrag)

    for tmpl in site_templates.TEMPLATES.values():
        aus(tmpl.get("pages"))
    return urls


def pruefe_bilder() -> list[str]:
    fehler = []
    urls = sorted(sammle_bilder())
    for url in urls:
        code = _status(url)
        if code != 200:
            fehler.append(f"Bild antwortet {code}: {url}")
    print(f"  {len(urls)} Bild-Adressen geprüft")
    return fehler


def pruefe_live() -> list[str]:
    """Der Vorschau-Endpunkt muss fail-closed sein (Wurzel 5)."""
    faelle = [
        ("template_id=agentur&token=x", 403, "Müll-Token"),
        ("template_id=agentur&token=t.1.2", 403, "gefälschte Signatur"),
        ("template_id=gibtsnicht&token=x.1.2", 404, "unbekannte Vorlage"),
        ("template_id=agentur", 422, "fehlender Token"),
    ]
    fehler = []
    for query, erwartet, was in faelle:
        code = _status(f"{API}/site/template/draft?{query}")
        if code == 0:
            return [f"API antwortet nicht auf {API} — läuft uvicorn?"]
        zeichen = "✓" if code == erwartet else "✗"
        print(f"  {zeichen} {was}: {code} (erwartet {erwartet})")
        if code != erwartet:
            fehler.append(f"{was}: {code} statt {erwartet}")
    # Die Galerie selbst braucht ein JWT — ohne eines muss sie 401 geben und
    # nicht etwa die Liste.
    code = _status(f"{API}/site-config/templates")
    print(f"  {'✓' if code == 401 else '✗'} Galerie ohne Anmeldung: {code} (erwartet 401)")
    if code != 401:
        fehler.append(f"Galerie ohne Anmeldung: {code} statt 401")
    return fehler


def main() -> int:
    live = "--live" in sys.argv
    bilder = "--bilder" in sys.argv

    print("Vorlagen — statisch")
    fehler = pruefe_statisch()

    if bilder:
        print("Vorlagen — Bild-Adressen")
        fehler += pruefe_bilder()

    if live:
        print("Vorlagen — Vorschau-Endpunkt (fail-closed)")
        fehler += pruefe_live()

    if fehler:
        print(f"\n{len(fehler)} Befund(e):")
        for f in fehler:
            print(f"  ✗ {f}")
        return 1
    print("\n✓ alles in Ordnung")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
