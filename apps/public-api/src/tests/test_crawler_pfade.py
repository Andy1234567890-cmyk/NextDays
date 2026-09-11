"""Die Pfade, die ein Crawler abruft: Wurzel, robots.txt, sitemap.xml.

Warum das Tests braucht, obwohl keine Fachregel daran haengt: diese Klasse
Fehler ist von innen unsichtbar. `/` gab bis zum 11.09.2026 einen 404 und
`/docs` war Google unbekannt — gemerkt hat es niemand, weil kein Testlauf und
kein Monitoring diese Pfade abruft; sichtbar wurde es erst in den Daten der
Google Search Console (`pageFetchState: NOT_FOUND`, `URL ist Google nicht
bekannt`). Ein stiller Fehler in der Aussenwirkung ist derselbe Fehler wie ein
verschluckter Exception (Wurzel 5), nur langsamer.

Hier laeuft bewusst der HTTP-Weg samt Middleware: die drei Pfade SIND der
HTTP-Rand, und `SicherheitsKopfMiddleware` nimmt `/docs` und `/referenz`
ausdruecklich aus — eine Regel, die nur ueber echte Anfragen pruefbar ist.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.main import create_app


@pytest.fixture(name="client")
def _client() -> TestClient:
    with TestClient(create_app()) as c:
        yield c


def test_wurzel_fuehrt_auf_die_doku(client: TestClient) -> None:
    antwort = client.get("/", follow_redirects=False)
    assert antwort.status_code == 307
    assert antwort.headers["location"] == "/docs"


def test_wurzel_ist_kein_dauerhafter_redirect(client: TestClient) -> None:
    """301 waere unbegrenzt cachebar und damit nicht zurueckholbar."""
    assert client.get("/", follow_redirects=False).status_code != 301


def test_doku_ansichten_antworten(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    assert client.get("/referenz").status_code == 200


def test_robots_nennt_die_sitemap(client: TestClient) -> None:
    """Ohne diese Zeile findet Google die Doku-Seiten nicht: eine Allow-Regel
    erlaubt nur, was ein Crawler ohnehin schon kennt."""
    text = client.get("/robots.txt").text
    assert "Sitemap: https://open-api.mynextdays.com/sitemap.xml" in text
    assert "Disallow: /v1" in text


def test_sitemap_fuehrt_die_doku_seiten(client: TestClient) -> None:
    antwort = client.get("/sitemap.xml")
    assert antwort.status_code == 200
    assert antwort.headers["content-type"].startswith("application/xml")
    assert "<loc>https://open-api.mynextdays.com/docs</loc>" in antwort.text
    assert "<loc>https://open-api.mynextdays.com/referenz</loc>" in antwort.text


def test_sitemap_fuehrt_das_schema_nicht(client: TestClient) -> None:
    """`/openapi.json` ist rohes JSON ohne Titel und Text. Google ordnet es als
    `Gecrawlt – zurzeit nicht indexiert` ein, und das ist richtig; in der
    Sitemap wuerde daraus eine Dauer-Warnung im Bericht."""
    assert "openapi.json" not in client.get("/sitemap.xml").text


def test_v1_bleibt_fuer_crawler_gesperrt(client: TestClient) -> None:
    """Die Nutzdaten hinter Auth gehoeren in keinen Index: ohne Token
    antworten sie 401, ein Crawl-Budget nur aus Fehlerseiten."""
    assert "Disallow: /v1" in client.get("/robots.txt").text
