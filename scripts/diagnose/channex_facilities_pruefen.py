"""Facility-Maps gegen die LIVE-Kataloge von Channex prüfen.

Anlass (06.09.2026): `_CHANNEX_ROOM_FACILITY` trug 191 UUIDs, von denen KEINE
im Live-Katalog `/room_facilities` existierte. Channex quittiert unbekannte IDs
mit 200 und legt nichts ab — der Content-Sync meldete „39 Facilities gesendet",
jeder Room-Type stand bei allen Portalen ohne Zimmer-Ausstattung. Der Fehler war
weder im Log noch im Test sichtbar: der Test prüfte die Map gegen sich selbst.

Prüft je Katalog (Objekt: `/property_facilities/options`, Zimmer:
`/room_facilities/options`, beide ohne Seitenwechsel):
  * jede UUID der Map existiert live;
  * jeder Live-Eintrag hat einen Slug in der Map (sonst fehlt ein Merkmal);
  * keine zwei Slugs zeigen auf dieselbe UUID, und kein Slug zeigt auf einen
    Eintrag, dessen eigener Titel-Slug bereits ein ANDERER Schlüssel der Map ist
    (vertauschte IDs). Die Objekt-Slugs sind bewusst gekürzt
    (`all_non_smoking` für „All Spaces Non-Smoking …"), ein reiner Titelvergleich
    wäre dort 25-mal falsch.
Exit 1 bei jedem Befund. Nur GET — schreibt nichts.

Aufruf (Schlüssel aus apps/api/.env):
    uv run --project apps/api python scripts/diagnose/channex_facilities_pruefen.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import httpx

WURZEL = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(WURZEL / "apps" / "api"))

from src.features.channel_manager.common import (  # noqa: E402  # pylint: disable=wrong-import-position
    _CHANNEX_FACILITY,
    _CHANNEX_ROOM_FACILITY,
)


def _env(name: str) -> str:
    wert = os.environ.get(name)
    if not wert:
        for zeile in (WURZEL / "apps" / "api" / ".env").read_text().splitlines():
            if zeile.startswith(f"{name}="):
                wert = zeile.split("=", 1)[1].strip().strip('"').strip("'")
                break
    if not wert:
        sys.exit(f"{name} fehlt (Umgebung oder apps/api/.env)")
    return wert


def _slug(titel: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", titel.lower())).strip("_")


def _katalog(client: httpx.Client, pfad: str) -> dict[str, tuple[str, str]]:
    antwort = client.get(f"/{pfad}/options")
    antwort.raise_for_status()
    return {
        x["id"]: (x["attributes"]["title"], x["attributes"].get("category") or "")
        for x in antwort.json()["data"]
    }


def _pruefen(name: str, live: dict[str, tuple[str, str]], karte: dict[str, str]) -> int:
    befunde = 0
    live_ids = set(live)
    je_uuid: dict[str, list[str]] = {}
    for slug, uid in karte.items():
        je_uuid.setdefault(uid, []).append(slug)
        if uid not in live_ids:
            print(f"  {name}: UUID zu '{slug}' existiert live NICHT ({uid})")
            befunde += 1
            continue
        titel_slug = _slug(live[uid][0])
        # Doppelte Titel tragen bei uns das Suffix _2, _3 …
        kern = re.sub(r"_\d+$", "", slug)
        if titel_slug not in (slug, kern) and titel_slug in karte and karte[titel_slug] != uid:
            print(f"  {name}: '{slug}' zeigt auf '{live[uid][0]}' — vertauscht?")
            befunde += 1
    for uid, slugs in je_uuid.items():
        if len(slugs) > 1:
            print(f"  {name}: {slugs} teilen eine UUID ({uid})")
            befunde += 1
    unsere_ids = set(karte.values())
    for uid, (titel, kategorie) in live.items():
        if uid not in unsere_ids:
            print(f"  {name}: Live-Eintrag ohne Slug bei uns: '{titel}' [{kategorie}] {uid}")
            befunde += 1
    print(f"{name}: {len(karte)} Slugs, {len(live)} live, {befunde} Befund(e)")
    return befunde


def main() -> int:
    basis = _env("CHANNEX_BASE_URL").rstrip("/")
    with httpx.Client(
        base_url=basis, headers={"user-api-key": _env("CHANNEX_API_KEY")}, timeout=30,
    ) as client:
        befunde = _pruefen(
            "Objekt", _katalog(client, "property_facilities"), _CHANNEX_FACILITY,
        )
        befunde += _pruefen(
            "Zimmer", _katalog(client, "room_facilities"), _CHANNEX_ROOM_FACILITY,
        )
    return 1 if befunde else 0


if __name__ == "__main__":
    sys.exit(main())
