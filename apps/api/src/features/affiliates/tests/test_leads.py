"""Lead-Liste (0526): anlegen, filtern, importieren, verknüpfen — Backoffice-Sicht."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from src.features.affiliates.fehler import AffiliateError
from src.features.affiliates.leads_service import LeadsMixin
from src.features.affiliates.schemas import BackofficeLeadAendern, BackofficeLeadAnlegen

from .fakedb import FakeDb

ADMIN = SimpleNamespace(user_id="admin-1")
AFF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


class _Service(LeadsMixin):
    def __init__(self, db: FakeDb) -> None:
        self._db = db


def _svc(**tabellen: list[dict]) -> _Service:
    return _Service(FakeDb({"affiliate_leads": [], "affiliates": [], **tabellen}))


def test_anlegen_und_listen_mit_filter() -> None:
    svc = _svc()
    svc.bo_lead_anlegen(
        BackofficeLeadAnlegen(
            name="Coach A", category="A", channels=[{"platform": "youtube", "url": "https://y.t/a"}]
        ),
        ADMIN,
    )
    svc.bo_lead_anlegen(BackofficeLeadAnlegen(name="Agentur D", category="D"), ADMIN)
    assert svc.bo_leads().total == 2
    nur_a = svc.bo_leads(category="A")
    assert nur_a.total == 1 and nur_a.items[0].name == "Coach A"
    assert nur_a.items[0].channels[0].url == "https://y.t/a"
    assert svc.bo_leads(q="agentur").items[0].category == "D"
    assert svc.bo_leads(status="won").total == 0


def test_kanal_url_muss_http_sein() -> None:
    with pytest.raises(ValueError):
        BackofficeLeadAnlegen(
            name="X", category="B", channels=[{"platform": "website", "url": "javascript:x"}]
        )


def test_aendern_verknuepft_nur_existierende_partner() -> None:
    svc = _svc(affiliates=[{"id": AFF, "email": "p@x.example"}])
    lead = svc.bo_lead_anlegen(BackofficeLeadAnlegen(name="Coach", category="A"), ADMIN)
    with pytest.raises(AffiliateError) as exc:
        svc.bo_lead_aendern(
            lead.id,
            BackofficeLeadAendern(affiliate_id="ffffffff-0000-4000-8000-000000000000"),
            ADMIN,
        )
    assert exc.value.status_code == 422
    neu = svc.bo_lead_aendern(
        lead.id, BackofficeLeadAendern(status="won", affiliate_id=AFF), ADMIN
    )
    assert neu.status == "won" and neu.affiliate_id == AFF


def test_import_meldet_fehlerhafte_zeilen_statt_sie_zu_verschlucken() -> None:
    svc = _svc()
    csv_text = (
        "name;organisation;kategorie;reichweite;land;url;notizen\n"
        "Anna Coach;BRIGHT;A;120.000;DE;https://instagram.com/anna;Airbnb-Arbitrage\n"
        ";Ohne Namen;B;;;;\n"
        "Bernd;;X;;;;falsche Kategorie\n"
        "Clara;Fewo Coaching;b;5k;AT;;\n"
    )
    res = svc.bo_leads_importieren(csv_text, ADMIN)
    assert res.angelegt == 2
    assert len(res.fehler) == 2 and "Zeile 3" in res.fehler[0] and "Zeile 4" in res.fehler[1]
    leads = {lead.name: lead for lead in svc.bo_leads().items}
    assert leads["Anna Coach"].reach == 120000 and leads["Anna Coach"].country == "DE"
    assert leads["Anna Coach"].channels[0].url == "https://instagram.com/anna"
    assert leads["Clara"].category == "B" and leads["Clara"].reach == 5


def test_loeschen_nur_vorhandene() -> None:
    svc = _svc()
    with pytest.raises(AffiliateError):
        svc.bo_lead_loeschen("gibt-es-nicht", ADMIN)
