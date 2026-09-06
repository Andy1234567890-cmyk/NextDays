#!/usr/bin/env python3
"""Die Seam-Webhook-Kette live prüfen — vom Secret bis zur Verarbeitung.

WARUM ES DIESES SKRIPT GIBT (Anlass 06.09.2026): im Seam-Dashboard standen
12 Zustellungen auf „Failed", und der Endpunkt antwortete auf jede mit 401.
Sichtbar war nur „geht nicht". Die Ursache lag an zwei Stellen gleichzeitig,
und beide sind von außen nicht zu sehen:

  1. Das live gesetzte `SEAM_WEBHOOK_SECRET` gehörte zu einem ANDEREN
     Webhook-Endpunkt als dem, der sendete. Ein falsches Secret ist von einem
     fehlenden nicht zu unterscheiden — beide ergeben denselben 401.
  2. Die gesendeten Ereignisse (`connected_account.*`) wurden vom Handler
     gar nicht behandelt. Selbst mit richtigem Secret wäre nichts passiert,
     und die Antwort wäre `{"status":"ok"}` gewesen — ein stiller Ausfall,
     der wie Erfolg aussieht.

Das Skript beantwortet daher BEIDE Fragen getrennt, statt nur „erreichbar?".

  ./scripts/diagnose/seam-webhook-pruefen.py
  ./scripts/diagnose/seam-webhook-pruefen.py --url https://api.mynextdays.com

Es sendet ausschließlich ein SIGNIERTES NO-OP-Ereignis mit einer festen
Diagnose-Kennung. Das ist absichtlich kein Schreibtest: der Typ `noop.probe`
wird von keinem Zweig verarbeitet, verändert also keinen Zustand.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PFAD = "/api/v1/schloesser/webhook"
# Feste Kennung: eine Wiederholung läuft in die Idempotenz-Sperre und wird
# mit „bereits_verarbeitet" beantwortet — das ist ein GÜLTIGES Ergebnis und
# beweist die Signatur genauso wie „ok".
PROBE_ID = "diagnose-seam-webhook-probe"

GRUEN, ROT, GELB, AUS = "\033[32m", "\033[31m", "\033[33m", "\033[0m"


def env_lesen(datei: Path, schluessel: str) -> str:
    if not datei.exists():
        return ""
    for zeile in datei.read_text().splitlines():
        if zeile.startswith(f"{schluessel}="):
            return zeile.split("=", 1)[1].strip()
    return ""


def signiert_senden(basis: str, secret: str) -> tuple[int, str]:
    """Ein korrekt signiertes No-Op schicken und die Antwort zurückgeben."""
    key = base64.b64decode(secret.split("_", 1)[1])
    rumpf = json.dumps(
        {
            "event_id": PROBE_ID,
            "event_type": "noop.probe",
            "occurred_at": "2026-01-01T00:00:00.000Z",
        }
    ).encode()
    msg_id, ts = "msg_diagnoseprobe", str(int(time.time()))
    sig = base64.b64encode(
        hmac.new(
            key, f"{msg_id}.{ts}.".encode() + rumpf, hashlib.sha256
        ).digest()
    ).decode()
    req = urllib.request.Request(
        basis.rstrip("/") + PFAD,
        data=rumpf,
        headers={
            "content-type": "application/json",
            "svix-id": msg_id,
            "svix-timestamp": ts,
            "svix-signature": f"v1,{sig}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode()[:300]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except OSError as e:
        return 0, str(e)[:300]


def behandelte_typen() -> set[str]:
    """Die Präfixe, die der Handler wirklich verarbeitet — aus dem Quelltext.

    Bewusst aus der Datei gelesen und nicht hier gepflegt: eine zweite Liste
    wäre genau die Kopie, die auseinanderläuft (Wurzel 1).
    """
    quelle = (
        Path(__file__).resolve().parents[1].parent
        / "apps/api/src/features/schloesser/webhook.py"
    )
    if not quelle.exists():
        return set()
    treffer = set()
    for zeile in quelle.read_text().splitlines():
        if 'startswith("' in zeile:
            treffer.add(zeile.split('startswith("')[1].split('"')[0])
    return treffer


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://api.mynextdays.com")
    ap.add_argument(
        "--secret",
        action="append",
        default=[],
        metavar="whsec_…",
        help=(
            "Ein Signing Secret direkt prüfen, ohne es in .env zu schreiben. "
            "Mehrfach angebbar. Genau der Fall, wenn das Secret zu einem "
            "Workspace gehört, dessen API-Key hier nicht vorliegt "
            "(Sandbox) — im Seam-Dashboard aufdecken, hier einsetzen."
        ),
    )
    args = ap.parse_args()

    wurzel = Path(__file__).resolve().parents[2]
    # --secret schlägt alles: es ist der Weg für ein Secret, das nirgends
    # hinterlegt ist und auch nicht hinterlegt werden soll.
    secret = ",".join(args.secret) if args.secret else (
        os.environ.get("SEAM_WEBHOOK_SECRET")
        or env_lesen(wurzel / ".env", "SEAM_WEBHOOK_SECRET")
    )

    fehler = 0
    print(f"Endpunkt: {args.url}{PFAD}\n")

    # -- 1. Sind Secrets da und haben sie das Svix-Format? ----------------
    # Kommagetrennt: Sandbox und Produktion senden an dieselbe URL, jeder
    # Endpunkt hat sein eigenes Signing Secret.
    secrets = [t.strip() for t in secret.split(",") if t.strip()]
    if not secrets:
        print(f"{ROT}✗{AUS} Kein SEAM_WEBHOOK_SECRET (weder Umgebung noch .env)")
        return 1
    schlecht = [x for x in secrets if not x.startswith("whsec_")]
    if schlecht:
        print(f"{ROT}✗{AUS} {len(schlecht)} Secret(s) ohne Svix-Format (whsec_…)")
        return 1
    print(
        f"{GRUEN}✓{AUS} {len(secrets)} Secret(s) vorhanden, Format whsec_ "
        f"({', '.join(str(len(x)) + ' Z.' for x in secrets)})"
    )

    # -- 2. Lehnt der Endpunkt ohne Signatur ab? (fail-closed, Wurzel 5) ---
    req = urllib.request.Request(
        args.url.rstrip("/") + PFAD,
        data=b'{"event_id":"x","event_type":"noop.probe"}',
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            code = r.status
    except urllib.error.HTTPError as e:
        code = e.code
    except OSError as e:
        print(f"{ROT}✗{AUS} Endpunkt nicht erreichbar: {e}")
        return 1
    if code == 401:
        print(f"{GRUEN}✓{AUS} Ohne Signatur: 401 (fail-closed, richtig)")
    else:
        print(f"{ROT}✗{AUS} Ohne Signatur: {code} — erwartet 401. OFFEN!")
        fehler += 1

    # -- 3. Nimmt der Endpunkt JEDES konfigurierte Secret an? -------------
    # Jedes einzeln, denn genau hier lag der reale Fehler: das eine passte,
    # das andere nicht, und von außen sah beides gleich aus.
    angenommen = 0
    for i, s_wert in enumerate(secrets, 1):
        code, rumpf = signiert_senden(args.url, s_wert)
        name = f"Secret {i}/{len(secrets)}"
        if code == 200:
            print(f"{GRUEN}✓{AUS} {name} signiert: 200 {rumpf}")
            angenommen += 1
        elif code == 401:
            print(f"{ROT}✗{AUS} {name} signiert: 401 — live nicht hinterlegt")
        else:
            print(f"{ROT}✗{AUS} {name} signiert: {code} {rumpf}")

    if angenommen == 0:
        print(
            f"\n{ROT}Kein einziges Secret wird angenommen.{AUS} Häufigster\n"
            "    Fall: der sendende Endpunkt gehört zu einem anderen\n"
            "    Seam-Workspace (Sandbox vs. Produktion), und jeder Endpunkt\n"
            "    hat sein EIGENES Signing Secret.\n"
            "    Prüfen: Seam-Dashboard → Endpoints → Signing Secret, dann in\n"
            "    Coolify bei `api` eintragen — mehrere kommagetrennt."
        )
        fehler += 1
    elif angenommen < len(secrets):
        print(
            f"\n{GELB}!{AUS} {angenommen} von {len(secrets)} Secrets werden\n"
            "    angenommen. Ereignisse des nicht hinterlegten Endpunkts\n"
            "    laufen in 401 — und Svix wiederholt bei 401 NICHT, sie sind\n"
            "    also endgültig verloren, nicht nur verzögert."
        )
        fehler += 1

    # -- 4. Welche Ereignisse werden überhaupt verarbeitet? ---------------
    typen = behandelte_typen()
    if typen:
        print(f"\n{GRUEN}✓{AUS} Behandelte Ereignisfamilien: {', '.join(sorted(typen))}")
        for pflicht in ("access_grant.", "device.", "connected_account."):
            if pflicht not in typen:
                print(
                    f"{GELB}!{AUS} `{pflicht}*` wird NICHT verarbeitet — solche\n"
                    "    Zustellungen werden mit 200 quittiert und ignoriert."
                )
    else:
        print(f"{GELB}!{AUS} Handler nicht gefunden — Typen ungeprüft")

    print()
    if fehler:
        print(f"{ROT}{fehler} Punkt(e) offen.{AUS}")
        return 1
    print(f"{GRUEN}Kette vollständig.{AUS}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
