"""Der Onboarding-Fortschritt darf keinen HALBFERTIGEN Zustand als fertig zeigen.

ANLASS (live gemessen am 29.08.2026, frisches Testkonto `beb72997`):
Die Oberflaeche behauptete „Ein Portal ist schon verbunden — du musst hier
nichts erneut verbinden" und „1 Objekt uebernommen", waehrend DERSELBE Server
jeden Abruf der Airbnb-Inserate mit 409 „nicht autorisiert" ablehnte.

Der Zustand in der Live-DB war eindeutig:

    properties          : 1 Zeile, Titel „Airbnb-Uebernahme laeuft",
                          status=draft, airbnb_listing_id=NULL   (07:33:15)
    channex_property_map: 1 Zeile                                 (07:33:18)
    ota_account         : connected_at=NULL, is_active=true,
                          token_invalid=false                     (07:33:19)
    Channex-Kanal       : settings={}, hat_tokens=False

Alle drei Zeilen entstehen beim KLICK auf „Airbnb verbinden", nicht bei der
Zustimmung: `uebernahme_starten` legt ein Geruest-Objekt an und registriert es
bei Channex, weil Channex ein Ziel braucht, auf das die Airbnb-Anzeigen spaeter
gemappt werden. Bleibt die Zustimmung aus, bleiben die Zeilen trotzdem stehen.

Die alte Messung fragte nur „steht eine Zeile in `channex_property_map`?" und
„gibt es eine `properties`-Zeile?" — beides war wahr, beides bedeutete nichts.
Die ehrliche Angabe ist `ota_account.connected_at`: gesetzt, wenn das PORTAL
bestaetigt hat (Wurzel 5b — unsere Uhr ist nicht der Zeitpunkt eines fremden
Ereignisses).
"""
from __future__ import annotations

from typing import Any

from src.features.dashboard.service import DashboardService

GERUEST = {"id": "p1", "title": "Airbnb-Übernahme läuft", "airbnb_listing_id": None}
ECHTES_OBJEKT = {"id": "p2", "title": "Feriehus Kornblomst", "airbnb_listing_id": "113312"}

KONTO_UNBESTAETIGT = {
    "id": "k1",
    "ota_portal_code": "AirBNB",
    "connected_at": None,
    "is_active": True,
    "token_invalid": False,
}
KONTO_AUTORISIERT = {
    "id": "k2",
    "ota_portal_code": "AirBNB",
    "connected_at": "2026-08-29T07:40:00+00:00",
    "is_active": True,
    "token_invalid": False,
}
KONTO_TOKEN_VERFALLEN = {
    "id": "k3",
    "ota_portal_code": "AirBNB",
    "connected_at": "2026-08-01T09:00:00+00:00",
    "is_active": True,
    "token_invalid": True,
}
KONTO_ABGESCHALTET = {
    "id": "k4",
    "ota_portal_code": "AirBNB",
    "connected_at": "2026-08-01T09:00:00+00:00",
    "is_active": False,
    "token_invalid": False,
}


class _FakeTable:
    """Nimmt jede Filterkette an und liefert die Zeilen ihrer Tabelle."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def select(self, *_a: Any, **_k: Any) -> _FakeTable:
        return self

    def eq(self, *_a: Any, **_k: Any) -> _FakeTable:
        return self

    def is_(self, *_a: Any, **_k: Any) -> _FakeTable:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _FakeTable:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._rows})()


class _FakeDb:
    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self._t = tabellen

    def table(self, name: str) -> _FakeTable:
        return _FakeTable(self._t.get(name, []))


def _fortschritt(
    properties: list[dict[str, Any]],
    konten: list[dict[str, Any]],
    rate_plans: list[dict[str, Any]] | None = None,
) -> dict[str, bool]:
    svc = DashboardService.__new__(DashboardService)
    db = _FakeDb(
        {
            "properties": properties,
            "ota_account": konten,
            "rate_plans": rate_plans or [],
        }
    )
    svc._require_db = lambda: db  # type: ignore[attr-defined]  # noqa: SLF001
    return svc._real_progress("beb72997-1c28-4730-88dd-2e050084842d")  # noqa: SLF001


def test_der_live_fall_geruest_plus_unbestaetigtes_konto() -> None:
    """DER Fall vom 29.08.2026: nichts davon ist fertig."""
    r = _fortschritt([GERUEST], [KONTO_UNBESTAETIGT])
    assert r["has_registered"] is False, "connected_at fehlt → nicht verbunden"
    assert r["has_property"] is False, "das Gerüst ist kein Objekt des Kunden"


def test_konto_ohne_bestaetigung_zaehlt_nicht() -> None:
    """`is_active=true` allein ist keine Autorisierung — es steht auch auf einem
    Konto, das nie zustande kam."""
    assert _fortschritt([ECHTES_OBJEKT], [KONTO_UNBESTAETIGT])["has_registered"] is False


def test_bestaetigtes_konto_zaehlt() -> None:
    assert _fortschritt([ECHTES_OBJEKT], [KONTO_AUTORISIERT])["has_registered"] is True


def test_verfallene_tokens_zaehlen_nicht() -> None:
    """Einmal verbunden bleibt nicht verbunden: zieht das Portal die
    Autorisierung zurück, muss der Schritt wieder offen sein."""
    assert (
        _fortschritt([ECHTES_OBJEKT], [KONTO_TOKEN_VERFALLEN])["has_registered"] is False
    )


def test_abgeschaltetes_konto_zaehlt_nicht() -> None:
    assert _fortschritt([ECHTES_OBJEKT], [KONTO_ABGESCHALTET])["has_registered"] is False


def test_geruest_neben_echtem_objekt_stoert_nicht() -> None:
    """Während einer laufenden Übernahme stehen beide nebeneinander — gezählt
    wird nur das echte."""
    r = _fortschritt([GERUEST, ECHTES_OBJEKT], [KONTO_AUTORISIERT])
    assert r["has_property"] is True
    assert r["has_registered"] is True


def test_gefuelltes_geruest_zaehlt_wieder_mit() -> None:
    """Sobald das Gerüst seine Airbnb-Daten bekommen hat, IST es ein Objekt —
    erkennbar an `airbnb_listing_id`. Der Titel allein darf nicht ausschließen,
    sonst verschwände ein echtes Objekt, das zufällig so heißt."""
    gefuellt = {**GERUEST, "airbnb_listing_id": "998877"}
    assert _fortschritt([gefuellt], [KONTO_AUTORISIERT])["has_property"] is True


def test_ohne_konten_nichts_verbunden() -> None:
    assert _fortschritt([ECHTES_OBJEKT], [])["has_registered"] is False


# --------------------------------------------------------- Firmendaten ----
#
# ANLASS (29.08.2026): Das Onboarding meldete „Firmendaten gespeichert!",
# obwohl im Testkonto NICHTS gespeichert war. Live gemessen:
#
#     tenant_billing_profile : 1 Zeile in der GANZEN Datenbank
#     tenant_onboarding      : 4 Betriebe mit company_data_set = true
#
# Das Flag stammte aus einem frueheren Durchlauf und wurde seither nie gegen
# die Daten geprueft. Dieselbe Wurzel wie bei `has_registered`: ein Flag sagt,
# was jemand VORHATTE, die Zeile sagt, was PASSIERT ist.


def _mit_profil(
    profile: list[dict[str, Any]],
) -> dict[str, Any]:
    """Fortschritt mit einem gegebenen Abrechnungsprofil messen."""
    svc = DashboardService.__new__(DashboardService)
    db = _FakeDb(
        {
            "properties": [],
            "ota_account": [],
            "rate_plans": [],
            "tenant_billing_profile": profile,
        }
    )
    svc._require_db = lambda: db  # type: ignore[attr-defined]  # noqa: SLF001
    return svc._real_progress("beb72997-1c28-4730-88dd-2e050084842d")  # noqa: SLF001


def test_ohne_abrechnungsprofil_keine_firmendaten() -> None:
    """DER Live-Fall: kein Profil → `has_company` ist False."""
    assert _mit_profil([])["has_company"] is False, (
        "Ohne tenant_billing_profile meldet das Onboarding weiterhin "
        "'Firmendaten gespeichert!' — eine Falschaussage."
    )


def test_mit_abrechnungsprofil_sind_firmendaten_da() -> None:
    """Die Gegenprobe: ein echtes Profil zaehlt."""
    assert _mit_profil([{"tenant_id": "beb72997"}])["has_company"] is True


# ---------------------------------------------------------- Testphase -----
#
# ANLASS (29.08.2026): Die Marketing-Seite warb an 14 Stellen je Sprache mit
# „14 Tage kostenlos testen", gebaut war davon nichts. Beim Nachbau ist die
# entscheidende Unterscheidung, dass `trialing` ZWEI verschiedene Fragen
# verschieden beantwortet:
#
#     „darf der Betrieb arbeiten?"  -> ja, auch im Test
#     „wurde schon gezahlt?"        -> nein
#
# Wer beides in ein Flag legt, zeigt entweder die Testphase als bezahltes Abo
# oder sperrt sie aus. Deshalb `in_trial` getrennt von `subscription_active`.


def _mit_abo(abo: list[dict[str, Any]]) -> dict[str, Any]:
    """Fortschritt mit einer gegebenen tenant_subscription-Zeile messen."""
    svc = DashboardService.__new__(DashboardService)
    db = _FakeDb(
        {
            "properties": [],
            "ota_account": [],
            "rate_plans": [],
            "tenant_billing_profile": [],
            "tenant_subscription": abo,
        }
    )
    svc._require_db = lambda: db  # type: ignore[attr-defined]  # noqa: SLF001
    return svc._real_progress("beb72997-1c28-4730-88dd-2e050084842d")  # noqa: SLF001


def test_testphase_zaehlt_als_aktives_abo() -> None:
    """Waehrend der Testphase muss der Betrieb arbeiten koennen — sonst
    testet er nichts."""
    stand = _mit_abo([{"status": "trialing", "current_period_end": "2026-09-12"}])
    assert stand["subscription_active"] is True


def test_testphase_ist_als_solche_erkennbar() -> None:
    """Und sie muss trotzdem von einem bezahlten Abo unterscheidbar bleiben,
    sonst kann die Oberflaeche nicht warnen."""
    stand = _mit_abo([{"status": "trialing", "current_period_end": "2026-09-12"}])
    assert stand["in_trial"] is True
    assert stand["trial_ends_at"] == "2026-09-12"


def test_bezahltes_abo_ist_keine_testphase() -> None:
    """Die Gegenprobe: `active` darf nie als Testphase erscheinen — sonst
    stuende bei zahlenden Kunden dauerhaft ein Ablauf-Hinweis."""
    stand = _mit_abo([{"status": "active", "current_period_end": "2026-09-12"}])
    assert stand["subscription_active"] is True
    assert stand["in_trial"] is False
    assert stand["trial_ends_at"] is None


def test_ohne_abo_keine_testphase() -> None:
    """Kein Abo = nichts zu melden."""
    stand = _mit_abo([])
    assert stand["subscription_active"] is False
    assert stand["in_trial"] is False
    assert stand["trial_ends_at"] is None
