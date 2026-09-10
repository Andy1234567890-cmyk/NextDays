"""Tests für den Nur-Lese-Riegel des öffentlichen Demo-Mandanten (0407).

Der Riegel ist die einzige Schicht zwischen einem öffentlich bekannten Login
und 536 schreibenden Routen — davon 76 ohne jeden Rollen-Guard. Geprüft wird
deshalb genau das, was ihn tragfähig macht:
  - schreibende Methoden werden abgelehnt, LESENDE nicht,
  - der Vorflug (OPTIONS) kommt durch, sonst wäre die Oberfläche im Browser tot,
  - ein normaler Mandant ist unberührt,
  - ein Datenbankfehler führt zu fail-CLOSED (503), nicht zu „darf schreiben".
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.core.security import AuthContext
from src.features.auth.demo_gate import demo_schreibzugriff_pruefen

SCHREIBEND = ("POST", "PUT", "PATCH", "DELETE")
LESEND = ("GET", "HEAD", "OPTIONS")


def _client(rows: list | Exception) -> MagicMock:
    client = MagicMock()
    kette = (
        client.table.return_value.select.return_value.eq.return_value
        .limit.return_value.execute
    )
    if isinstance(rows, Exception):
        kette.side_effect = rows
    else:
        kette.return_value = MagicMock(data=rows)
    return client


def _ctx(tenant: str | None = "t-demo") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


@pytest.mark.parametrize("methode", SCHREIBEND)
def test_demo_darf_nicht_schreiben(methode: str) -> None:
    """Jede schreibende Methode wird abgelehnt — unabhängig von der Rolle.

    Der Kontext trägt hier bewusst `admin`: genau das ist der Fall im Bestand
    (der Demo-Nutzer wurde vom Seed als admin angelegt), und genau deshalb
    reicht eine Rollenprüfung nicht.
    """
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_schreibzugriff_pruefen(methode, _ctx())
    assert exc.value.status_code == 405


@pytest.mark.parametrize("methode", LESEND)
def test_demo_darf_lesen(methode: str) -> None:
    """Lesen ist der Zweck der Demo — und kostet keine DB-Abfrage.

    Der Client wirft, wenn er doch befragt würde: die Methodenprüfung muss VOR
    der Abfrage greifen, sonst zahlt jeder Seitenaufruf eine DB-Runde.
    """
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("darf nicht abgefragt werden")),
    ):
        demo_schreibzugriff_pruefen(methode, _ctx())


@pytest.mark.parametrize("methode", SCHREIBEND)
def test_normaler_mandant_darf_schreiben(methode: str) -> None:
    """Ein zahlender Betrieb ist unberührt."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": False}]),
    ):
        demo_schreibzugriff_pruefen(methode, _ctx("t-echt"))


def test_lesefehler_ist_fail_closed() -> None:
    """DB-Ausfall → 503 für den Schreibversuch, nicht stillschweigend erlaubt.

    Andere Richtung als beim aktiv_gate (dort ist ein Ausfall eine Störung,
    die NICHT als Sperre ausgegeben werden darf): hier wäre fail-open die
    Erlaubnis zu schreiben. Lesen bleibt unberührt, die Demo läuft weiter.
    """
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("DB weg")),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_schreibzugriff_pruefen("POST", _ctx())
    assert exc.value.status_code == 503


def test_ohne_mandant_kein_riegel() -> None:
    """Plattform-Zugänge tragen keine tenant_id — es gibt nichts zu prüfen."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("darf nicht abgefragt werden")),
    ):
        demo_schreibzugriff_pruefen("POST", _ctx(None))


def test_api_client_token_wird_uebersprungen() -> None:
    """Hinter einem Client-Credentials-Token steht kein Demo-Besucher, sondern
    eine Integration mit eigenem Secret und eigenen Scopes."""
    ctx = AuthContext(
        user_id="c-1", tenant_id="t-demo", role=None, api_scopes=frozenset({"x"})
    )
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("darf nicht abgefragt werden")),
    ):
        demo_schreibzugriff_pruefen("POST", ctx)


def test_methode_wird_gross_geschrieben_verglichen() -> None:
    """Ein klein geschriebenes „post" darf den Riegel nicht umgehen."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_schreibzugriff_pruefen("post", _ctx())
    assert exc.value.status_code == 405


# ---------------------------------------------------------------------------
# Bereichs-Sperre (reiner Code-Riegel, keine Migration)
# ---------------------------------------------------------------------------
# Anders als der Schreib-Riegel gilt sie auch fuer LESENDE Anfragen: die
# gesperrten Bereiche sollen gar nicht einsehbar sein. Geprueft wird deshalb
# genau die Trennung — gesperrter Pfad vs. erlaubter Pfad, Demo vs. Kunde.
from src.features.auth.demo_gate import (  # noqa: E402
    GESPERRTE_PRAEFIXE,
    demo_bereich_pruefen,
)

GESPERRT_BEISPIELE = (
    "/api/v1/buchhaltung",
    "/api/v1/buchhaltung/zahlungen",
    "/api/v1/channel-manager/mappings",
    "/api/v1/owners/17",
    "/api/v1/owner-reporting/monat",
    "/api/v1/subscriptions/aktuell",
    # Am 02.09.2026 nachgezogen: trugen in der Sidebar ein Schloss, waren per
    # URL aber ladbar.
    "/api/v1/tasks",
    "/api/v1/tasks/42",
    "/api/v1/booking-conditions",
    "/api/v1/calendar/block-requests",
    "/api/v1/calendar/block-requests/9/approve",
    # Dynamic Pricing — einzelne Endpunkte, NICHT das ganze `/pricing`.
    "/api/v1/pricing/overview",
    "/api/v1/pricing/settings/abc",
    "/api/v1/pricing/explain/abc",
)
ERLAUBT_BEISPIELE = (
    "/api/v1/calendar/monat",
    "/api/v1/reservations",
    "/api/v1/inbox/threads",
    "/api/v1/properties",
    "/api/v1/dashboard",
    # Diese vier sind die eigentliche Falle: `/pricing` traegt die Preise, die
    # Promotions und das Rate-Grid — also das, was die Vorfuehrung ZEIGEN soll.
    # Waere `/pricing` als Praefix gesperrt worden statt der drei
    # Dynamic-Pricing-Endpunkte, haette die Demo ihren Kern verloren.
    "/api/v1/pricing/effective",
    "/api/v1/pricing/quote",
    "/api/v1/pricing/discounts",
    "/api/v1/rates",
    # `/calendar` selbst bleibt offen — nur `block-requests` darunter ist zu.
    "/api/v1/calendar",
)


@pytest.mark.parametrize("pfad", GESPERRT_BEISPIELE)
def test_demo_sieht_gesperrten_bereich_nicht(pfad: str) -> None:
    """403 auch beim LESEN — der Bereich ist nicht freigegeben."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_bereich_pruefen(pfad, _ctx())
    assert exc.value.status_code == 403


@pytest.mark.parametrize("pfad", ERLAUBT_BEISPIELE)
def test_demo_darf_freigegebene_bereiche_sehen(pfad: str) -> None:
    """Was die Vorfuehrung zeigen SOLL, bleibt unberuehrt."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        demo_bereich_pruefen(pfad, _ctx())


@pytest.mark.parametrize("pfad", GESPERRT_BEISPIELE)
def test_zahlender_betrieb_sieht_alles(pfad: str) -> None:
    """Der Riegel darf NUR den Vorfuehr-Mandanten treffen."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": False}]),
    ):
        demo_bereich_pruefen(pfad, _ctx("t-echt"))


def test_praefix_endet_am_segment() -> None:
    """`/owners` darf nicht `/owners-public` mitsperren.

    Ohne die Segmentgrenze sperrte ein kurzer Praefix fremde Bereiche mit —
    ein Fehler, der erst auffaellt, wenn ein Kunde etwas nicht mehr sieht.
    """
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        demo_bereich_pruefen("/api/v1/owners-public/liste", _ctx())


def test_bereich_lesefehler_sperrt_nicht() -> None:
    """DB-Ausfall darf ZAHLENDE Betriebe nicht aussperren.

    Andere Richtung als beim Schreib-Riegel, und zwar bewusst: dort waere
    fail-open die Erlaubnis zu schreiben; hier waere fail-closed eine Sperre
    fuer Kunden, sobald die Abfrage einmal nicht antwortet.
    """
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("DB weg")),
    ):
        demo_bereich_pruefen("/api/v1/buchhaltung", _ctx())


def test_api_client_token_ist_nicht_betroffen() -> None:
    """Hinter einem Client-Credentials-Token steht kein Demo-Besucher."""
    ctx = AuthContext(
        user_id="c-1", tenant_id="t-demo", role=None, api_scopes=frozenset({"x"})
    )
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client(RuntimeError("darf nicht abgefragt werden")),
    ):
        demo_bereich_pruefen("/api/v1/buchhaltung", ctx)


def test_jeder_gesperrte_praefix_greift() -> None:
    """Gegenprobe ueber die ganze Liste — kein Eintrag ist toter Text."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        for praefix in GESPERRTE_PRAEFIXE:
            with pytest.raises(HTTPException) as exc:
                demo_bereich_pruefen(f"/api/v1{praefix}/irgendwas", _ctx())
            assert exc.value.status_code == 403, praefix


# --- POSTs, die nichts speichern -------------------------------------------
# Der Riegel urteilt nach der METHODE. Bei drei Endpunkten ist das falsch:
# sie lesen ein hochgeladenes PDF und geben Vorschlaege zurueck, die erst ein
# zweiter, echter Schreibaufruf uebernimmt. Ohne die Ausnahme ist die
# Vorfuehrung genau dort stumm, wo sie am meisten zeigt.

LESENDE_POSTS = (
    "/api/v1/property-dossier/p-1/inventar/import",
    "/api/v1/property-dossier/p-1/mappe/gast/dokumente/lesen",
    "/api/v1/property-dossier/p-1/mappe/haus/dokumente/lesen",
)


@pytest.mark.parametrize("pfad", LESENDE_POSTS)
def test_demo_darf_pdf_lesen_obwohl_post(pfad: str) -> None:
    """Ein POST, der nichts speichert, kommt durch — ohne DB-Abfrage.

    Die Ausnahme greift VOR dem Tenant-Blick: waere es andersherum, kostete
    jeder dieser Aufrufe eine Runde, um am Ende doch durchzulassen.
    """
    client = _client([{"is_demo": True}])
    with patch(
        "src.features.auth.demo_gate.get_service_client", return_value=client
    ):
        demo_schreibzugriff_pruefen("POST", _ctx(), pfad)
    client.table.assert_not_called()


def test_ausnahme_gilt_nur_fuer_das_genaue_endstueck() -> None:
    """Kein Praefix-Freibrief: was UNTER dem Pfad haengt, bleibt gesperrt.

    Sonst oeffnete ein spaeter ergaenzter echter Schreib-Endpunkt unter
    demselben Praefix die Demo still mit.
    """
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_schreibzugriff_pruefen(
                "POST", _ctx(), "/api/v1/property-dossier/p-1/inventar/import/uebernehmen"
            )
    assert exc.value.status_code == 405


def test_ohne_pfad_bleibt_jeder_post_gesperrt() -> None:
    """Der Vorgabewert ist die sichere Seite: kein Pfad → kein Freibrief."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_schreibzugriff_pruefen("POST", _ctx())
    assert exc.value.status_code == 405


def test_echter_schreib_endpunkt_im_selben_slice_bleibt_gesperrt() -> None:
    """Die Ausnahme darf den Nachbarn nicht mitnehmen: `POST /inventar` legt
    an und muss in der Vorfuehrung weiterhin scheitern."""
    with patch(
        "src.features.auth.demo_gate.get_service_client",
        return_value=_client([{"is_demo": True}]),
    ):
        with pytest.raises(HTTPException) as exc:
            demo_schreibzugriff_pruefen(
                "POST", _ctx(), "/api/v1/property-dossier/p-1/inventar"
            )
    assert exc.value.status_code == 405
