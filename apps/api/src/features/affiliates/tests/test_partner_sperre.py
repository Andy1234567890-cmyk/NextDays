"""Tests für die plattformweite Sperre des Partner-Dashboards (0727).

Warum das NICHT per curl nachweisbar ist, anders als beim Eigentümer-Portal:
Dort hängt die Sperre als Router-Dependency und läuft VOR der Anmeldung — ein
Aufruf ohne Token bekommt deshalb 403. Hier sitzt sie in
`require_approved_affiliate`, das einen bereits geprüften `AffiliateContext`
bekommt; ohne Token endet der Aufruf vorher mit 401.

Das ist die bessere Reihenfolge (ein Fremder erfährt nicht, dass gerade eine
Sperre läuft), macht den Nachweis aber zur Sache eines Tests.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.core.security import AffiliateContext, require_approved_affiliate
from src.features.plattform import schalter


def _client(rows: list) -> MagicMock:
    client = MagicMock()
    kette = client.table.return_value.select.return_value.limit.return_value.execute
    kette.return_value = MagicMock(data=rows)
    return client


def _zeile(partner_seit: str | None, hinweis: str | None = None) -> list:
    return [
        {
            "eigentuemer_portal_gesperrt_seit": None,
            "eigentuemer_portal_hinweis": None,
            "partner_portal_gesperrt_seit": partner_seit,
            "partner_portal_hinweis": hinweis,
        }
    ]


def _ctx(*, approved: bool) -> AffiliateContext:
    # `is_approved` ist eine abgeleitete Eigenschaft, kein Feld — gesetzt wird
    # `status`. Genau das hat den ersten Testlauf abgewiesen, und zwar zu Recht.
    return AffiliateContext(
        affiliate_id="a-1",
        email="partner@example.com",
        status="approved" if approved else "pending_review",
    )


@pytest.fixture(autouse=True)
def _puffer_leeren() -> None:
    schalter.puffer_leeren()


def test_offen_laesst_freigegebenen_partner_durch() -> None:
    with patch.object(
        schalter, "get_service_client", return_value=_client(_zeile(None))
    ):
        require_approved_affiliate(_ctx(approved=True))


def test_gesperrt_gibt_403_mit_eigenem_hinweis() -> None:
    with patch.object(
        schalter,
        "get_service_client",
        return_value=_client(_zeile("2026-09-20T00:11:43+00:00", "Wir rechnen ab.")),
    ):
        with pytest.raises(HTTPException) as exc:
            require_approved_affiliate(_ctx(approved=True))
    assert exc.value.status_code == 403
    assert exc.value.detail == "Wir rechnen ab."


def test_gesperrt_ohne_hinweis_nimmt_den_standardtext() -> None:
    """Leerer Hinweis heisst „gesperrt ohne eigenen Text" — NICHT offen."""
    with patch.object(
        schalter,
        "get_service_client",
        return_value=_client(_zeile("2026-09-20T00:11:43+00:00", None)),
    ):
        with pytest.raises(HTTPException) as exc:
            require_approved_affiliate(_ctx(approved=True))
    assert exc.value.status_code == 403
    assert "vorübergehend nicht verfügbar" in exc.value.detail


def test_bewerber_liest_waehrend_der_sperre_denselben_text() -> None:
    """Die Sperre wird VOR der Freigabe-Prüfung ausgewertet.

    Sonst bekäme ein nicht freigegebener Bewerber „Das Partner-Konto ist nicht
    freigegeben." und ein freigegebener den Sperrtext — an der Differenz liesse
    sich der eigene Antragsstatus ablesen, ohne dass ihn jemand mitteilt
    (Wurzel 9).
    """
    with patch.object(
        schalter,
        "get_service_client",
        return_value=_client(_zeile("2026-09-20T00:11:43+00:00", None)),
    ):
        with pytest.raises(HTTPException) as exc:
            require_approved_affiliate(_ctx(approved=False))
    assert "vorübergehend nicht verfügbar" in exc.value.detail
    assert "nicht freigegeben" not in exc.value.detail


def test_ohne_sperre_gilt_die_freigabe_weiter() -> None:
    """Die Sperre darf die bestehende Prüfung nicht ersetzen."""
    with patch.object(
        schalter, "get_service_client", return_value=_client(_zeile(None))
    ):
        with pytest.raises(HTTPException) as exc:
            require_approved_affiliate(_ctx(approved=False))
    assert exc.value.status_code == 403
    assert "nicht freigegeben" in exc.value.detail


def test_die_beiden_schalter_sind_unabhaengig() -> None:
    """Das Eigentümer-Portal zu sperren darf die Partner NICHT treffen — beide
    Schalter stehen in derselben Zeile, und ein vertauschtes Feld wäre hier der
    naheliegende Fehler."""
    zeile = [
        {
            "eigentuemer_portal_gesperrt_seit": "2026-09-19T23:33:33+00:00",
            "eigentuemer_portal_hinweis": None,
            "partner_portal_gesperrt_seit": None,
            "partner_portal_hinweis": None,
        }
    ]
    with patch.object(schalter, "get_service_client", return_value=_client(zeile)):
        require_approved_affiliate(_ctx(approved=True))
        assert schalter.eigentuemer_portal_sperre() is not None
        assert schalter.partner_portal_sperre() is None
