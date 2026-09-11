#!/usr/bin/env python3
"""Googles EIGENE Sicht auf unsere Domänen abfragen — nicht unsere.

Warum das ein eigenes Werkzeug braucht: Ein `curl` auf eine URL beweist, dass
SIE antwortet. Es beweist nicht, was Google gesehen hat, wann, und wie Google
es eingeordnet hat. Am 11.09.2026 meldete die Search Console für
`open-api.mynextdays.com/openapi.json` „Überprüfung fehlgeschlagen"; von außen
antwortete die URL mit HTTP 200 und die robots.txt erlaubte sie ausdrücklich.
Aus dem Außenbefund ließ sich die Meldung nicht erklären — die Diagnose kam
erst aus Googles Daten:

  * `openapi.json`: `verdict NEUTRAL`, `pageFetchState SUCCESSFUL`,
    `Gecrawlt – zurzeit nicht indexiert`. Kein Fehler; Google indexiert rohes
    JSON ohne Titel und Text nicht. Die Validierung konnte deshalb nie
    bestehen — sie prüft, ob ein Problem behoben ist, und es gab keins.
  * `/` (die Wurzel): `NOT_FOUND`. Der eigentliche Befund, unsichtbar von
    innen, weil kein Test und kein Monitoring die Wurzel abruft.
  * `/docs`, `/referenz`, `/robots.txt`: „URL ist Google nicht bekannt" —
    Google hatte sie NIE abgerufen, weil nichts dorthin verlinkte. Eine
    `Allow`-Regel lädt nichts ein; sie erlaubt nur, was ein Crawler schon
    gefunden hat.

ZUGANG
======
Dienstkonto mit nachgewiesenem Domain-Eigentum (DNS-TXT über die Site
Verification API). Schlüssel: `~/.config/mynextdays/search-console-key.json`
oder `$SEARCH_CONSOLE_KEY`. Das Dienstkonto ist `siteOwner` der Property —
ein Nutzer-Login ist nicht nötig und wäre nicht automatisierbar.

AUFRUF
======
    python3 scripts/diagnose/search-console-pruefen.py
    python3 scripts/diagnose/search-console-pruefen.py --property sc-domain:open-api.mynextdays.com

Exit 1, sobald eine geprüfte URL einen echten Abruffehler hat
(`pageFetchState` weder SUCCESSFUL noch unbekannt) oder die Sitemap Fehler
meldet. „Nicht indexiert" allein ist KEIN Exit-1-Fall: bei `openapi.json` ist
es die richtige Einordnung, und ein Gate, das dauerhaft rot steht, wird
ignoriert statt gelesen.
"""
# pylint: disable=invalid-name  # scripts/diagnose/ nutzt durchgehend Bindestriche
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Die Pfade, die ein Crawler dieser Domäne abruft. `/v1/...` steht bewusst
# nicht drin: es ist in der robots.txt gesperrt und antwortet ohne Token 401.
PFADE = ("/", "/docs", "/referenz", "/openapi.json", "/robots.txt", "/sitemap.xml")

STANDARD_PROPERTY = "sc-domain:open-api.mynextdays.com"
STANDARD_BASIS = "https://open-api.mynextdays.com"

# Ein Abruf, den Google nie versucht hat, ist kein Fehler — nur eine Lücke in
# der Entdeckung. Ein fehlgeschlagener Abruf ist einer.
ABRUF_OK = frozenset({"SUCCESSFUL", "PAGE_FETCH_STATE_UNSPECIFIED"})


def _schluessel() -> dict[str, str]:
    for kandidat in (
        os.environ.get("SEARCH_CONSOLE_KEY"),
        Path.home() / ".config" / "mynextdays" / "search-console-key.json",
    ):
        if kandidat and Path(kandidat).is_file():
            return json.loads(Path(kandidat).read_text(encoding="utf-8"))
    sys.exit(
        "Kein Dienstkonto-Schluessel gefunden.\n"
        "Erwartet: ~/.config/mynextdays/search-console-key.json oder "
        "$SEARCH_CONSOLE_KEY.\n"
        "Anlegen: gcloud iam service-accounts keys create <datei> "
        "--iam-account=nextdays-vertex@project-460d8aaf-4b7d-4d13-b3a"
        ".iam.gserviceaccount.com"
    )


def _b64(rohdaten: bytes) -> bytes:
    """Base64url ohne Auffuellzeichen — so verlangt es die JWT-Kodierung."""
    return base64.urlsafe_b64encode(rohdaten).rstrip(b"=")


def _token(scope: str) -> str:
    """JWT-Bearer-Flow ohne google-auth: der Schluessel signiert selbst.

    Absichtlich ohne die `google-auth`-Bibliothek — dieses Skript laeuft als
    Diagnose auf einem Entwicklerrechner und soll keine Abhaengigkeit eines
    Dienstes mitziehen. `cryptography` liegt ueber `apps/api` ohnehin vor.
    """
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    key = _schluessel()
    jetzt = int(time.time())
    kopf = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    rumpf = _b64(
        json.dumps(
            {
                "iss": key["client_email"],
                "scope": scope,
                "aud": "https://oauth2.googleapis.com/token",
                "iat": jetzt,
                "exp": jetzt + 3600,
            }
        ).encode()
    )
    zu_signieren = kopf + b"." + rumpf
    privat = serialization.load_pem_private_key(
        key["private_key"].encode(), password=None
    )
    signatur = privat.sign(zu_signieren, padding.PKCS1v15(), hashes.SHA256())
    jwt = (zu_signieren + b"." + _b64(signatur)).decode()
    nutzlast = urllib.parse.urlencode(
        {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": jwt,
        }
    ).encode()
    with urllib.request.urlopen(  # noqa: S310
        "https://oauth2.googleapis.com/token", nutzlast
    ) as antwort:
        return json.load(antwort)["access_token"]


def _hole(url: str, token: str, rumpf: bytes | None = None) -> dict:
    kopfzeilen = {"Authorization": "Bearer " + token}
    if rumpf is not None:
        kopfzeilen["Content-Type"] = "application/json"
    # S310: die URL ist in diesem Skript immer eine googleapis.com-Adresse
    # aus den Konstanten oben, kein Nutzereingabe-Ziel.
    anfrage = urllib.request.Request(url, data=rumpf, headers=kopfzeilen)  # noqa: S310
    try:
        with urllib.request.urlopen(anfrage) as antwort:  # noqa: S310
            return json.load(antwort)
    except urllib.error.HTTPError as fehler:
        return {"_fehler": fehler.code, "_text": fehler.read().decode()[:300]}


def main() -> int:
    zerleger = argparse.ArgumentParser(description=__doc__)
    zerleger.add_argument("--property", default=STANDARD_PROPERTY)
    zerleger.add_argument("--basis", default=STANDARD_BASIS)
    argumente = zerleger.parse_args()

    token = _token("https://www.googleapis.com/auth/webmasters")
    fehler: list[str] = []

    print(f"Property: {argumente.property}\n")
    for pfad in PFADE:
        url = argumente.basis.rstrip("/") + pfad
        ergebnis = _hole(
            "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
            token,
            json.dumps(
                {
                    "inspectionUrl": url,
                    "siteUrl": argumente.property,
                    "languageCode": "de",
                }
            ).encode(),
        )
        if "_fehler" in ergebnis:
            print(f"  {pfad:14} HTTP {ergebnis['_fehler']} {ergebnis['_text']}")
            fehler.append(f"{pfad}: HTTP {ergebnis['_fehler']}")
            continue
        stand = ergebnis.get("inspectionResult", {}).get("indexStatusResult", {})
        abruf = stand.get("pageFetchState", "?")
        marke = "✗" if abruf not in ABRUF_OK else "·"
        print(f"  {marke} {pfad:14} {stand.get('coverageState', '?')}")
        print(
            f"      abruf={abruf} robots={stand.get('robotsTxtState', '?')} "
            f"crawl={stand.get('lastCrawlTime', '—')}"
        )
        if abruf not in ABRUF_OK:
            fehler.append(f"{pfad}: {abruf}")

    site = urllib.parse.quote(argumente.property, safe="")
    sitemaps = _hole(
        f"https://searchconsole.googleapis.com/webmasters/v3/sites/{site}/sitemaps",
        token,
    )
    print("\nSitemaps:")
    for eintrag in sitemaps.get("sitemap", []) or [{}]:
        if not eintrag:
            print("  (keine eingereicht)")
            fehler.append("keine Sitemap eingereicht")
            break
        anzahl = int(eintrag.get("errors", 0))
        print(
            f"  {'✗' if anzahl else '·'} {eintrag.get('path')} "
            f"fehler={eintrag.get('errors')} warnungen={eintrag.get('warnings')} "
            f"eingereicht={eintrag.get('lastSubmitted', '—')}"
        )
        if anzahl:
            fehler.append(f"Sitemap {eintrag.get('path')}: {anzahl} Fehler")

    if fehler:
        print("\nBefunde:")
        for eintrag in fehler:
            print(f"  - {eintrag}")
        return 1
    print("\nAlles grün.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
