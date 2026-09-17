"""Kanal-Einträge, die Arbeit MELDEN, ohne welche zu SEIN — der Leerlauf-Sync.

Anlass (17.09.2026, Beta-Betrieb AirSmil): fünf von zwanzig Objekten reihten
~4,4 Content-Syncs PRO TAG ein, die nichts taten — 31 je Objekt in sieben Tagen,
während die übrigen fünfzehn bei null lagen. Jeder dieser Läufe ist ein voller
Channex-Content-Push gegen das Budget.

Ursache war ein Livelock zwischen zwei Definitionen von „versorgt":
`portal_raten_abgleich._belegte_ratencodes` zählt den EINTRAG, aber
`objekt_kanal.freigegebene_plaene_zuordnen` zählt den PLAN. Stand am Kanal eine
Attrappe (Eintrag ohne `occupancy`/`primary_occ`) NEBEN einem vollwertigen
Träger derselben Rate, meldete der Zähler `zu_heilen = 1` und reihte einen Sync
ein — den der Heiler dann übersprang, weil er den Plan über den gesunden
Eintrag bereits als zugeordnet fand. Jeden Tag neu.

WARUM ES DIESES SKRIPT GIBT: der Befund ist in KEINEM Log und in keinem Test
sichtbar. Beide Seiten tun genau das, was in ihrem Docstring steht; falsch ist
erst ihr Zusammenspiel, und das sieht man nur am echten Kanal-Objekt von
Channex. Der Unit-Test prüft die Zählung gegen nachgebaute Einträge — er kann
nicht wissen, welche Form die Kanäle live tragen.

Das Skript ruft die ECHTE `_belegte_ratencodes` gegen die echten Kanäle auf
(nicht nachgebaut) und meldet je Objekt die drei Terme, an denen der Lauf
entscheidet, ob er einen Content-Sync einreiht:

    Raten     = was das Portal unter dieser Kennung führt
    belegt    = Raten, die ihren eigenen Plan als Träger haben
    offen     = Raten ohne eigenen Plan  → Arbeit (Plan anlegen)
    zu_heilen = Raten, die NUR eine Attrappe haben → Arbeit (Zuordnung heilen)

Ein Objekt mit `offen = 0` UND `zu_heilen = 0` darf keinen Sync auslösen.
Exit 1, sobald eines das tut, ohne dass echte Arbeit dahintersteht.

Nur GET (`mapping_details` ist bei Channex eine reine Leseabfrage) — schreibt
weder in die DB noch bei Channex.

Aufruf:
    uv run --project apps/api python scripts/diagnose/attrappen-leerlauf-pruefen.py
    uv run --project apps/api python scripts/diagnose/attrappen-leerlauf-pruefen.py <tenant_id>
"""
# pylint: disable=invalid-name        # Dateiname kebab-case wie alle Pruefer hier
# pylint: disable=import-error         # `src.*` aufloest erst der sys.path unten
# pylint: disable=protected-access     # Sinn des Skripts: die ECHTEN internen
#   Leser aufrufen. Ein oeffentlicher Nachbau waere eine zweite Lese-Regel und
#   damit genau der Fehler, den das Skript sucht.
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

WURZEL = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(WURZEL / "apps" / "api"))

from supabase import create_client  # noqa: E402  # pylint: disable=wrong-import-position,wrong-import-order

from src.features.channel_manager.channels import (  # noqa: E402  # pylint: disable=wrong-import-position,wrong-import-order
    ChannelsMixin,
)
from src.features.channel_manager.channex_client import (  # noqa: E402  # pylint: disable=wrong-import-position,wrong-import-order
    ChannexClient,
)
from src.features.channel_manager.portal_raten_abgleich import (  # noqa: E402  # pylint: disable=wrong-import-position,wrong-import-order
    PORTALE_MIT_RATEN,
    PortalRatenAbgleichMixin,
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


class _Leser(PortalRatenAbgleichMixin, ChannelsMixin):  # pylint: disable=too-few-public-methods
    """Nur die zwei LESENDEN Bausteine des Abgleichs, ohne den Schreibpfad.

    Beide Mixins werden gebraucht: `_portal_raten` (Abgleich) ruft
    `_normalize_mapping_rooms` (Channels). Ein Nachbau einer der beiden hieße,
    das Skript gegen eine zweite Lese-Regel zu prüfen statt gegen die echte.
    """

    def __init__(self, channex: ChannexClient) -> None:
        self._channex = channex


def _objekte(db: Any, tenant_id: str) -> dict[str, str]:
    zeilen = (
        db.table("properties").select("id, title").eq("tenant_id", tenant_id).execute()
    ).data or []
    return {str(z["id"]): str(z.get("title") or z["id"]) for z in zeilen}


def _verbindungen(db: Any, tenant_id: str) -> list[dict[str, Any]]:
    """Nur Kanäle MIT Raten-Ebene — dieselbe Allowlist wie der Abgleich.

    Airbnb gehört nicht dazu: dort ist die Listing-ID der Code, und
    `POST /channels/mapping_details` antwortet für ein Airbnb-Konto mit 400.
    Ohne diesen Filter fragt der Prüfer je Objekt einen Kanal ab, den es nicht
    gibt — 19 sinnlose Calls gegen das Channex-Budget, also genau die
    Verschwendung, die er aufdecken soll. (Der Abgleich filtert an derselben
    Stelle, `_kanaele_mit_raten`.)
    """
    zeilen = (
        db.table("channex_channel_connection")
        .select("property_id, channex_channel_id, ota_hotel_id, ota_portal_code")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    return [
        z for z in zeilen
        if str(z.get("ota_portal_code") or "") in PORTALE_MIT_RATEN
    ]


def _eine_verbindung(
    db: Any, leser: _Leser, tenant_id: str, conn: dict[str, Any], name: str
) -> bool:
    """Eine Kanal-Verbindung messen und ausgeben; True = Leerlauf gefunden."""
    pid = str(conn["property_id"])
    portal = str(conn.get("ota_portal_code") or "")
    raten = leser._portal_raten(conn)  # noqa: SLF001 — genau die echte Lesung
    if not raten:
        # Fail-closed wie im Abgleich: leer heißt „Abruf lieferte nichts".
        print(f"  {name[:32]:32s} {portal:12s}  -- keine Raten --")
        return False
    titel_je_code = {str(r.get("id")): (r.get("title") or "") for r in raten}
    gelesen = leser._belegte_ratencodes(  # noqa: SLF001
        db, tenant_id, pid, conn, titel_je_code
    )
    if gelesen is None:
        print(f"  {name[:32]:32s} {portal:12s}  -- Kanal unlesbar --")
        return False
    belegt, attrappen, _ = gelesen
    offen = [r for r in raten if str(r.get("id")) not in belegt]
    # Genau die Bedingung aus `portal_raten_abgleich` (Zeile 331 + 388): ohne
    # offene Raten kann weder `angelegt` noch `nachgezogen` steigen, also
    # entscheidet dann `zu_heilen` allein über den Content-Sync.
    leerlauf = not offen and bool(attrappen)
    print(f"  {name[:32]:32s} {portal:12s} {len(raten):5d} {len(belegt):6d} "
          f"{len(offen):5d} {len(attrappen):9d}"
          f"{'   <-- LEERLAUF' if leerlauf else ''}")
    return leerlauf


def _pruefen(db: Any, leser: _Leser, tenant_id: str) -> int:
    namen = _objekte(db, tenant_id)
    conns = _verbindungen(db, tenant_id)
    if not conns:
        print(f"  keine Kanal-Verbindungen für {tenant_id}")
        return 0

    print(f"  {'Objekt':32s} {'Portal':12s} {'Raten':>5s} {'belegt':>6s} "
          f"{'offen':>5s} {'zu_heilen':>9s}")
    print("  " + "-" * 76)
    return sum(
        _eine_verbindung(
            db, leser, tenant_id, conn,
            namen.get(str(conn["property_id"]), str(conn["property_id"])),
        )
        for conn in sorted(conns, key=lambda c: namen.get(str(c["property_id"]), ""))
    )


def main() -> int:
    """Alle Betriebe (oder den übergebenen) prüfen; Exit 1 bei jedem Befund."""
    db = create_client(_env("SUPABASE_URL"), _env("SUPABASE_SERVICE_ROLE_KEY"))
    leser = _Leser(
        ChannexClient(api_key=_env("CHANNEX_API_KEY"), base_url=_env("CHANNEX_BASE_URL"))
    )
    if len(sys.argv) > 1:
        tenants = [{"id": sys.argv[1], "name": sys.argv[1]}]
    else:
        tenants = (db.table("tenants").select("id, name").execute()).data or []

    befunde = 0
    for tenant in tenants:
        print(f"\n{tenant.get('name') or tenant['id']}")
        befunde += _pruefen(db, leser, str(tenant["id"]))

    if befunde:
        print(
            f"\n{befunde} Objekt(e) melden Arbeit, ohne welche zu haben — jeder "
            "tägliche Lauf reiht dort einen folgenlosen Content-Sync ein."
        )
        return 1
    print("\n✓ Kein Objekt meldet Arbeit ohne Arbeit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
