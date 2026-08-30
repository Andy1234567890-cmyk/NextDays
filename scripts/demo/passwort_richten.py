"""Setzt die Passwörter der Demo-Logins auf `DEMO_PASSWORT` aus apps/api/.env.

Warum das ein eigenes Werkzeug ist und nicht `seed_demo.py --passwort …`:
`seed_demo.py` ist ein vollständiger Neuaufbau — es löscht beide Demo-Tenants
samt Buchungen, Gästen und hochgeladenen Objektfotos und baut sie neu. Wer nur
das Passwort geradeziehen will, verliert dabei minutenlang Bildmaterial, das
für die Aufnahmen schon steht.

Der Anlass (30.08.2026): `seed_demo.py` würfelt ohne `--passwort` bei JEDEM
Lauf ein neues Passwort (`Demo-{token_urlsafe(9)}`) und schreibt es NUR auf die
Konten — `apps/api/.env` bleibt auf dem alten stehen. Danach scheitert sowohl
der manuelle Login als auch `/auth/demo`, das genau diesen `.env`-Wert nutzt.

`DEMO_PASSWORT` ist hier die Quelle der Wahrheit, nicht ein frisch erzeugter
Wert: der Vorführ-Zugang der Marketing-Seite hängt daran (auth/router.py
`demo_zugang`). Ein neues Passwort zu würfeln würde die öffentliche Demo
brechen — deshalb wird die DB an `.env` angeglichen, nie umgekehrt.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

# pylint: disable=wrong-import-position
# Der sys.path-Eintrag oben muss VOR diesen Importen stehen: die Datei wird als
# Skript aufgerufen, nicht als Paket importiert (wie in seed_demo.py).
from katalog import BETRIEBE  # noqa: E402
from konfig import Supabase, demo_id  # noqa: E402


def main() -> int:
    """Beide Demo-Logins auf das Passwort aus der Umgebung setzen."""
    db = Supabase()  # lädt apps/api/.env
    passwort = os.environ.get("DEMO_PASSWORT")
    if not passwort:
        raise SystemExit(
            "DEMO_PASSWORT fehlt (weder in der Umgebung noch in apps/api/.env). "
            "Ohne den Wert gibt es nichts anzugleichen — ein erfundenes Passwort "
            "würde den Vorführ-Zugang /auth/demo brechen."
        )

    erwartet = os.environ.get("DEMO_LOGIN")
    logins = [b.login for b in BETRIEBE]
    if erwartet and erwartet not in logins:
        raise SystemExit(
            f"DEMO_LOGIN={erwartet} steht in keinem Betrieb des Katalogs "
            f"({', '.join(logins)}) — Katalog und .env sind auseinandergelaufen."
        )

    for betrieb in BETRIEBE:
        # Dieselbe Admin-API wie im Seed: ein UPDATE auf auth.users von Hand
        # leert Felder wie `aud` und macht den Account unbrauchbar.
        db.auth_user_sicherstellen(
            betrieb.login,
            passwort,
            {"tenant_id": db_tenant_id(betrieb), "role": "admin"},
        )
        print(f"  {betrieb.login}   Passwort gesetzt")
    return 0


def db_tenant_id(betrieb) -> str:
    """Dieselbe deterministische Tenant-UUID, die der Seed vergeben hat."""
    return demo_id(f"tenant:{betrieb.schluessel}")


if __name__ == "__main__":
    raise SystemExit(main())
