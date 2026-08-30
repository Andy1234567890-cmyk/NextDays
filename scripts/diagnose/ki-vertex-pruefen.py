#!/usr/bin/env python3
"""Prueft die Vertex-AI-Anbindung des Website-Baukastens END-TO-END.

WARUM ES DIESES SKRIPT GIBT
---------------------------
Eine KI-Anbindung kann auf sechs verschiedene Arten kaputt sein, und fuenf davon
sehen im Log gleich aus („KI-Dienst nicht erreichbar"):

  1. Die Umgebungsvariable fehlt          -> Funktion erscheint gar nicht
  2. Der Base64-Schluessel ist unlesbar   -> Funktion erscheint gar nicht
  3. Der Service-Account hat keine Rolle  -> 403 beim ersten echten Aufruf
  4. Die API ist im Projekt nicht aktiv   -> 403 mit anderem Text
  5. Das Modell gibt es in der Region nicht -> 404 auf den Modellpfad
  6. Alles laeuft, aber ueber den GLOBALEN Endpunkt -> keine Datenresidenz

Nummer 6 ist die gefaehrlichste: sie funktioniert. Niemand merkt, dass die
Daten eines EU-Betriebs ausserhalb der EU verarbeitet werden -- bis jemand
fragt. Dieses Skript prueft deshalb nicht nur „geht es", sondern auch „geht es
DORT, wo es hin soll".

WAS GEPRUEFT WIRD
-----------------
  * Sind alle vier Einstellungen gesetzt? (Schluessel, Projekt, Region, Modell)
  * Laesst sich der Schluessel dekodieren und enthaelt er client_email?
  * Laesst sich damit ein Zugriffstoken holen? (IAM-Rolle vorhanden)
  * Antwortet der REGIONALE Endpunkt? (nicht der globale)
  * Ist die Antwort plausibel? (ein Testsatz, den man nachlesen kann)
  * Stehen die drei Migrationen (0463-0465) live in der Datenbank?

AUFRUF
------
    python3 scripts/diagnose/ki-vertex-pruefen.py            # ohne Testaufruf
    python3 scripts/diagnose/ki-vertex-pruefen.py --aufruf   # MIT Testaufruf

Ohne `--aufruf` kostet der Lauf nichts (nur Konfiguration + Token). Mit
`--aufruf` geht EIN Aufruf an das Modell -- ein paar Zehntelcent.

Der Datenbankteil braucht SSH-Zugang zum Server; ohne ihn wird er
uebersprungen, nicht als Fehler gewertet.

Exit 1, sobald etwas fehlt oder nicht antwortet.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
API = REPO / "apps" / "api"

GRUEN = "\033[32m"
ROT = "\033[31m"
GELB = "\033[33m"
AUS = "\033[0m"

fehler: list[str] = []


def ok(text: str) -> None:
    print(f"{GRUEN}✓{AUS} {text}")


def warn(text: str) -> None:
    print(f"{GELB}!{AUS} {text}")


def bad(text: str) -> None:
    print(f"{ROT}✗{AUS} {text}")
    fehler.append(text)


def _einstellungen() -> dict[str, str]:
    """Die vier Werte aus der App-Konfiguration lesen.

    Ueber die echte `Settings`-Klasse und nicht per `os.environ`: nur so gilt
    dieselbe Reihenfolge (`.env` -> Umgebung) wie im laufenden Dienst. Eine
    Diagnose, die anders liest als der Dienst, kann ihn gruen melden, waehrend
    er rot ist.
    """
    sys.path.insert(0, str(API))
    from src.core.config import get_settings  # noqa: PLC0415

    s = get_settings()
    return {
        "schluessel": s.vertex_service_account_b64.get_secret_value().strip(),
        "projekt": s.vertex_project_id,
        "region": s.vertex_location,
        "modell": s.vertex_model,
        "tageslimit": str(s.ki_tageslimit_je_tenant),
        "ratelimit": s.rate_limit_website_ki,
    }


def _konfiguration_pruefen(e: dict[str, str]) -> dict | None:
    print("\n== 1. Konfiguration ==")
    if not e["schluessel"]:
        bad(
            "VERTEX_SERVICE_ACCOUNT_B64 ist nicht gesetzt. Der KI-Assistent "
            "erscheint im Baukasten GAR NICHT (das ist das gewollte Verhalten, "
            "kein Absturz) -- aber er kann auch nichts."
        )
        return None
    ok(f"VERTEX_SERVICE_ACCOUNT_B64 gesetzt ({len(e['schluessel'])} Zeichen)")

    try:
        info = json.loads(base64.b64decode(e["schluessel"], validate=True))
    except Exception as exc:  # noqa: BLE001 -- Diagnose meldet JEDE Ursache
        bad(
            f"Der Schluessel laesst sich nicht dekodieren ({type(exc).__name__}). "
            "Er muss EINZEILIGES Base64 des JSON-Service-Account-Schluessels "
            "sein -- mehrzeilige Werte zerbrechen ausserdem den Coolify-Deploy."
        )
        return None
    fehlend = [
        f for f in ("client_email", "private_key", "project_id") if not info.get(f)
    ]
    if fehlend:
        bad(f"Im Schluessel fehlen Felder: {', '.join(fehlend)}")
        return None
    ok(f"Service-Account: {info['client_email']}")

    if not e["projekt"]:
        bad("VERTEX_PROJECT_ID ist nicht gesetzt.")
    else:
        ok(f"Projekt: {e['projekt']}")
        if info.get("project_id") and info["project_id"] != e["projekt"]:
            warn(
                f"Der Schluessel gehoert zu Projekt {info['project_id']}, "
                f"konfiguriert ist {e['projekt']}. Das kann richtig sein "
                "(Service-Account aus einem anderen Projekt), ist aber meistens "
                "ein Vertipper."
            )
    if not e["region"]:
        bad("VERTEX_LOCATION ist nicht gesetzt.")
    elif not e["region"].startswith("europe-"):
        bad(
            f"Region {e['region']} liegt NICHT in der EU. Damit gibt es keine "
            "Zusage zur Verarbeitung in der EU-Jurisdiktion -- Kundendaten "
            "duerfen dort nicht hin."
        )
    else:
        ok(f"Region: {e['region']} (EU)")
    ok(f"Modell: {e['modell']}")
    ok(f"Tagesdeckel je Betrieb: {e['tageslimit']} Aufrufe")
    ok(f"Rate-Limit-Eimer: {e['ratelimit']} je IP")
    return info


def _token_pruefen() -> str | None:
    print("\n== 2. Anmeldung (IAM) ==")
    sys.path.insert(0, str(API))
    from src.core.ki import (  # noqa: PLC0415
        KiError,
        VertexClient,
    )

    client = VertexClient()
    if not client.is_configured:
        bad("VertexClient meldet is_configured=False -- siehe Schritt 1.")
        return None
    try:
        token = client._access_token()  # noqa: SLF001 -- Diagnose darf tiefer
    except KiError as exc:
        bad(
            f"Kein Zugriffstoken: {exc.message} "
            "Pruefen: hat der Service-Account die Rolle roles/aiplatform.user? "
            "Ist der Schluessel noch gueltig (nicht geloescht/rotiert)?"
        )
        return None
    ok(f"Zugriffstoken erhalten ({len(token)} Zeichen)")
    return token


def _endpunkt_pruefen(e: dict[str, str]) -> None:
    print("\n== 3. Regionaler Endpunkt ==")
    host = f"{e['region']}-aiplatform.googleapis.com"
    ok(f"Erwarteter Host: {host}")
    if "aiplatform.googleapis.com" == host:
        bad(
            "Der Host hat KEIN Regionspraefix -- das ist der globale Endpunkt, "
            "und fuer den gibt es ausdruecklich keine Zusage zum Ort der "
            "Verarbeitung."
        )


def _testaufruf() -> None:
    print("\n== 4. Testaufruf ==")
    sys.path.insert(0, str(API))
    from src.core.ki import (  # noqa: PLC0415
        KiError,
        VertexClient,
    )

    client = VertexClient()
    # Ein Auftrag mit EINER richtigen Antwort. „Sag hallo" waere kein Test:
    # jede Antwort saehe richtig aus. Hier ist nachpruefbar, ob das Modell die
    # Anweisung befolgt hat.
    try:
        antwort = client.erzeuge(
            system=(
                "Antworte ausschliesslich mit dem Wort BEREIT, in "
                "Grossbuchstaben, ohne Satzzeichen."
            ),
            user="Bereitschaftspruefung.",
            temperature=0.0,
            max_tokens=16,
        )
    except KiError as exc:
        bad(
            f"Testaufruf fehlgeschlagen ({exc.status_code}): {exc.message}\n"
            "  403 -> IAM-Rolle oder aiplatform.googleapis.com nicht aktiviert\n"
            "  404 -> Modell in dieser Region nicht verfuegbar\n"
            "  429 -> Kontingent des Projekts erschoepft"
        )
        return
    ok(
        f"Antwort in {antwort.dauer_ms} ms, Modell {antwort.modell}, "
        f"Region {antwort.region}, Tokens {antwort.tokens_ein}/"
        f"{antwort.tokens_aus}, Abschluss {antwort.abschlussgrund}"
    )
    if "BEREIT" in antwort.text.upper():
        ok(f"Antwort plausibel: {antwort.text!r}")
    else:
        bad(
            f"Antwort NICHT plausibel: {antwort.text!r} -- erwartet war BEREIT. "
            "Das Modell antwortet, befolgt die Systemanweisung aber nicht; "
            "meist ein falscher Modellname oder ein Reasoning-Budget-Problem."
        )


_DB_ABFRAGE = """
select
  (select count(*) from public.schema_migrations
    where version in ('0463_website_ki_herkunft',
                      '0464_website_ki_geschaeftsprofil',
                      '0465_website_ki_nutzung')) as migrationen,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='site_pages'
      and column_name in ('content_origin','ai_model','ai_generated_at',
                          'ai_reviewed_at','ai_reviewed_by')) as seiten_spalten,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='site_blocks'
      and column_name in ('content_origin','ai_model','ai_generated_at',
                          'ai_reviewed_at','ai_reviewed_by')) as block_spalten,
  (select count(*) from information_schema.role_table_grants
    where table_schema='public'
      and table_name in ('site_ai_profile','site_ai_usage')
      and grantee in ('anon','authenticated')
      and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')) as offene_grants,
  (select count(*) from public.site_ai_usage where tag = (now() at time zone 'utc')::date) as heute
"""


def _datenbank_pruefen() -> None:
    print("\n== 5. Datenbank ==")
    server = os.environ.get("MIGRATE_SSH", "root@65.21.144.136")
    fern = (
        'docker exec -i $(docker ps --format "{{.Names}}" '
        '| grep -E "^db-cdqxi" | head -1) '
        "psql -U supabase_admin -d postgres -tAq -f -"
    )
    try:
        lauf = subprocess.run(  # noqa: S603
            ["ssh", "-o", "ConnectTimeout=10", server, fern],
            input=_DB_ABFRAGE,
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        warn(f"Kein SSH-Zugang zur Datenbank ({type(exc).__name__}) -- uebersprungen.")
        return
    if lauf.returncode != 0:
        warn(f"Datenbankabfrage fehlgeschlagen: {lauf.stderr.strip()[:200]}")
        return
    zeile = (lauf.stdout or "").strip().split("|")
    if len(zeile) < 5:
        warn(f"Unerwartete Antwort der Datenbank: {lauf.stdout.strip()[:200]}")
        return
    migrationen, seiten, bloecke, grants, heute = (int(x or 0) for x in zeile)
    if migrationen == 3:
        ok("Migrationen 0463-0465 sind eingespielt.")
    else:
        bad(f"Nur {migrationen} von 3 KI-Migrationen sind eingespielt.")
    if seiten == 5:
        ok("site_pages traegt alle fuenf Herkunftsspalten.")
    else:
        bad(f"site_pages hat nur {seiten} von 5 Herkunftsspalten.")
    if bloecke == 5:
        ok("site_blocks traegt alle fuenf Herkunftsspalten.")
    else:
        bad(f"site_blocks hat nur {bloecke} von 5 Herkunftsspalten.")
    if grants == 0:
        ok("site_ai_profile und site_ai_usage sind fuer anon/authenticated zu.")
    else:
        bad(
            f"{grants} offene Rechte auf site_ai_profile/site_ai_usage fuer "
            "anon/authenticated. Wurzel 6: das Verbrauchsprotokoll ist die "
            "Vorstufe einer Rechnung und gehoert dem Server allein."
        )
    ok(f"KI-Aufrufe heute (alle Betriebe): {heute}")


def main() -> int:
    print("Vertex-AI-Anbindung des Website-Baukastens")
    print("=" * 55)
    e = _einstellungen()
    info = _konfiguration_pruefen(e)
    if info is not None:
        if _token_pruefen():
            _endpunkt_pruefen(e)
            if "--aufruf" in sys.argv:
                _testaufruf()
            else:
                print("\n== 4. Testaufruf ==")
                warn("Uebersprungen. Mit --aufruf wird wirklich aufgerufen.")
    _datenbank_pruefen()

    print("\n" + "=" * 55)
    if fehler:
        print(f"{ROT}{len(fehler)} Befund(e):{AUS}")
        for f in fehler:
            print(f"  - {f.splitlines()[0]}")
        return 1
    print(f"{GRUEN}Alles in Ordnung.{AUS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
