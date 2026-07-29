"""Schutz der Webhook-Registrierung gegen Secret-Überschreiben.

`register_global_webhook` arbeitet DESTRUKTIV: es löscht die bestehende
Registrierung auf dieselbe callback_url und legt sie mit dem Secret DIESER
Umgebung neu an. Läuft das versehentlich lokal (abweichendes
CHANNEX_WEBHOOK_SECRET), sendet Channex danach ein Secret, das der laufende
Server nicht kennt — jedes Event liefe in 401, ohne dass jemand es merkt.

Nicht die Ursache des Ausfalls vom 25./26.07.2026 (das war der Host-Header,
s. src/core/tests/test_trusted_hosts.py), aber derselbe Wirkmechanismus:
eine Fehlkonfiguration legt den Kanal still lahm.
"""
import pytest

from src.features.channel_manager.common import ChannelManagerError

_URL = "https://api.example.test/api/v1/channel-manager/webhook"
_SERVER_SECRET = "s" * 48
_ALTES_SECRET = "a" * 48


class _ChannexStub:
    """Minimaler Channex-Doppelgänger: merkt sich, ob zerstörerisch gearbeitet
    wurde (delete/create), damit der Test das Ausbleiben beweisen kann."""

    def __init__(self, webhooks: list[dict]) -> None:
        self._webhooks = webhooks
        self.deleted: list[str] = []
        self.created: list[dict] = []

    def list_webhooks(self) -> dict:
        return {"data": self._webhooks}

    def delete_webhook(self, wid: str) -> None:
        self.deleted.append(wid)

    def create_webhook(self, body: dict) -> dict:
        self.created.append(body)
        return {"data": {"id": "neu", **body}}


def _wh(secret: str | None, *, aktiv: bool = True, url: str = _URL) -> dict:
    kopf = {"X-Channex-Webhook-Secret": secret} if secret else {}
    return {
        "id": "bestehend",
        "attributes": {"callback_url": url, "is_active": aktiv, "headers": kopf},
    }


def _service(webhooks: list[dict], secret: str, monkeypatch):
    """ChannelsMixin mit gestubbtem Channex-Client und fixem Secret."""
    from src.features.channel_manager.channels import ChannelsMixin

    svc = ChannelsMixin.__new__(ChannelsMixin)
    svc._channex = _ChannexStub(webhooks)  # noqa: SLF001
    svc._db = None  # noqa: SLF001

    class _Cfg:
        class channex_webhook_secret:  # noqa: N801
            @staticmethod
            def get_secret_value() -> str:
                return secret

    # register_global_webhook importiert get_settings LOKAL aus src.core.config —
    # deshalb dort patchen, nicht im channels-Modul.
    monkeypatch.setattr("src.core.config.get_settings", lambda: _Cfg())
    return svc


def test_abweichendes_secret_bricht_ab_und_zerstoert_nichts(monkeypatch) -> None:
    """KRITISCH: das ist der Vorfall. Läuft die Registrierung mit dem ALTEN
    Secret, darf sie die funktionierende Registrierung NICHT ersetzen."""
    svc = _service([_wh(_SERVER_SECRET)], _ALTES_SECRET, monkeypatch)
    with pytest.raises(ChannelManagerError) as exc:
        svc.register_global_webhook(callback_url=_URL)
    assert exc.value.status_code == 409
    # Kein Löschen, kein Neuanlegen → der laufende Webhook bleibt heil.
    assert svc._channex.deleted == []  # noqa: SLF001
    assert svc._channex.created == []  # noqa: SLF001


def test_gleiches_secret_registriert_normal(monkeypatch) -> None:
    """Idempotenter Normalfall: gleiches Secret → alte Zeile weg, neue angelegt."""
    svc = _service([_wh(_SERVER_SECRET)], _SERVER_SECRET, monkeypatch)
    svc.register_global_webhook(callback_url=_URL)
    assert svc._channex.deleted == ["bestehend"]  # noqa: SLF001
    assert len(svc._channex.created) == 1  # noqa: SLF001


def test_inaktive_registrierung_blockiert_nicht(monkeypatch) -> None:
    """Ein deaktivierter Alt-Webhook ist kein Grund zu blockieren."""
    svc = _service([_wh(_ALTES_SECRET, aktiv=False)], _SERVER_SECRET, monkeypatch)
    svc.register_global_webhook(callback_url=_URL)
    assert len(svc._channex.created) == 1  # noqa: SLF001


def test_andere_callback_url_blockiert_nicht(monkeypatch) -> None:
    """Fremde URL (anderes Deployment) darf die eigene Registrierung nicht stoppen."""
    svc = _service(
        [_wh(_ALTES_SECRET, url="https://andere.test/hook")], _SERVER_SECRET, monkeypatch
    )
    svc.register_global_webhook(callback_url=_URL)
    assert len(svc._channex.created) == 1  # noqa: SLF001


def test_erstregistrierung_ohne_bestand(monkeypatch) -> None:
    """Nichts registriert → anlegen, nichts zu löschen."""
    svc = _service([], _SERVER_SECRET, monkeypatch)
    svc.register_global_webhook(callback_url=_URL)
    assert svc._channex.deleted == []  # noqa: SLF001
    assert len(svc._channex.created) == 1  # noqa: SLF001


def test_leeres_secret_wird_abgelehnt(monkeypatch) -> None:
    """Ohne Secret gar nicht erst registrieren (sonst Webhook ohne Schutz)."""
    svc = _service([], "", monkeypatch)
    with pytest.raises(ChannelManagerError) as exc:
        svc.register_global_webhook(callback_url=_URL)
    assert exc.value.status_code == 400
