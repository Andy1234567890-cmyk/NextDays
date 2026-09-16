"""Zwei Stripe-Welten in einem Prozess (16.09.2026).

myBestDays kann gegen die Stripe-SANDBOX laufen, waehrend myNextDays echtes
Geld bewegt. Geprueft wird hier genau das, was bei einem Fehler NICHT auffiele,
weil beide Wege oberflaechlich gleich aussehen:

  1. Ein Sandbox-Mandant bekommt NIE den Live-Client — auch dann nicht, wenn
     der Marktplatz-Schluessel fehlt. Dann gibt es einen Fehler, keinen
     Rueckfall. Das ist der eine Fall, der echtes Geld kosten wuerde.
  2. Ein normaler Mandant bekommt weiter den Live-Client. Ein Service ohne
     `tenant_id` ebenso — sonst waere jede bestehende Aufrufstelle still
     umgebogen worden.
  3. Die Entscheidung faellt an EINER Stelle (`welt.py`) und liest genau das
     Feld, das die Migration anlegt. Ein Tippfehler im Spaltennamen waere fuer
     Python eine Zeichenkette und fuer die Fake-DB unsichtbar.
"""

import pytest
from pydantic import SecretStr

from src.core.config import get_settings
from src.features.payments import stripe_client as sc_modul
from src.features.payments import welt
from src.features.payments.service import PaymentsConfigError, PaymentsService
from src.features.payments.stripe_client import (
    StripeMarktplatzNichtKonfiguriertError,
    get_stripe,
    get_stripe_marktplatz,
)

TENANT = "11111111-1111-1111-1111-111111111111"


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, zeilen: list[dict], gesehen: dict) -> None:
        self._zeilen = zeilen
        self._gesehen = gesehen

    def select(self, *spalten: str) -> "_Query":
        # Festhalten, WELCHE Spalte gelesen wurde: ein Tippfehler waere sonst
        # unsichtbar, weil die Fake-DB jede erfundene Spalte annimmt.
        self._gesehen["spalten"] = spalten
        return self

    def eq(self, feld: str, wert: str) -> "_Query":
        self._gesehen.setdefault("filter", []).append((feld, wert))
        self._zeilen = [z for z in self._zeilen if str(z.get(feld)) == str(wert)]
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def execute(self) -> _Result:
        return _Result(self._zeilen)


class _DB:
    def __init__(self, zeilen: list[dict]) -> None:
        self._zeilen = zeilen
        self.gesehen: dict = {}

    def table(self, name: str) -> _Query:
        self.gesehen["tabelle"] = name
        return _Query(list(self._zeilen), self.gesehen)


def _db(sandbox: bool | None) -> _DB:
    if sandbox is None:          # kein Abrechnungsprofil
        return _DB([])
    return _DB([{"tenant_id": TENANT, "stripe_sandbox": sandbox}])


@pytest.fixture(autouse=True)
def _caches_leeren():
    """Beide Client-Fabriken sind gecacht — sonst truege ein Test den Client
    des vorigen weiter und das Ergebnis waere zufaellig."""
    get_stripe.cache_clear()
    get_stripe_marktplatz.cache_clear()
    get_settings.cache_clear()
    yield
    get_stripe.cache_clear()
    get_stripe_marktplatz.cache_clear()
    get_settings.cache_clear()


class _Einstellungen:
    """Nur die zwei Felder, um die es hier geht."""

    def __init__(self, pms: str, marktplatz: str) -> None:
        self.stripe_secret_key = SecretStr(pms)
        self.stripe_marktplatz_secret_key = SecretStr(marktplatz)


def _schluessel(monkeypatch, *, pms: str, marktplatz: str) -> None:
    """Die Schluessel STELLEN, nicht ueber die Umgebung setzen.

    `monkeypatch.setenv`/`delenv` reicht hier NICHT: `pydantic-settings` liest
    zusaetzlich `apps/api/.env`, und dort steht auf einem Arbeitsplatz mit
    eingerichtetem Marktplatz-Weg ein echter Schluessel. Genau daran sind zwei
    dieser Tests am 16.09.2026 zerbrochen — im Slice-Lauf gruen, im vollen Lauf
    rot, je nachdem was auf der Maschine liegt. Ein Test, dessen Ergebnis vom
    Arbeitsplatz abhaengt, beweist nichts.
    """
    einst = _Einstellungen(pms, marktplatz)
    monkeypatch.setattr(sc_modul, "get_settings", lambda: einst)


def test_liest_genau_die_spalte_der_migration() -> None:
    db = _db(False)
    welt.ist_sandbox(db, TENANT)
    assert db.gesehen["tabelle"] == "tenant_billing_profile"
    assert db.gesehen["spalten"] == ("stripe_sandbox",)
    assert ("tenant_id", TENANT) in db.gesehen["filter"]


def test_ohne_profil_ist_live() -> None:
    """Kein Abrechnungsprofil = kein verbundenes Konto = der gewohnte Weg."""
    assert welt.ist_sandbox(_db(None), TENANT) is False


def test_ohne_mandant_ist_live() -> None:
    """Ein Service ohne `tenant_id` darf sich nicht still aendern."""
    assert welt.ist_sandbox(_db(True), None) is False
    assert welt.ist_sandbox(None, TENANT) is False


def test_sandbox_ohne_schluessel_faellt_NICHT_auf_live_zurueck(monkeypatch) -> None:
    """DER Test, um den es hier geht.

    Ein Sandbox-Mandant ohne Marktplatz-Schluessel muss scheitern. Faellt er
    auf `stripe_secret_key` zurueck, belastet ein Testlauf echte Karten — und
    zwar lautlos, weil der Aufruf dann ja funktioniert.
    """
    _schluessel(monkeypatch, pms="sk_test_lebendig", marktplatz="")
    with pytest.raises(StripeMarktplatzNichtKonfiguriertError):
        welt.client_fuer(_db(True), TENANT)


def test_sandbox_mandant_bekommt_den_marktplatz_schluessel(monkeypatch) -> None:
    _schluessel(monkeypatch, pms="sk_test_pms", marktplatz="sk_test_marktplatz")
    client = welt.client_fuer(_db(True), TENANT)
    assert client is get_stripe_marktplatz()
    assert client is not get_stripe()


def test_normaler_mandant_bekommt_KEINEN_client(monkeypatch) -> None:
    """`None` ist hier die richtige Antwort, nicht ein fertiger Live-Client.

    `None` heisst „nimm den gewohnten Weg" — die Helfer in `stripe_client`
    machen daraus `client or get_stripe()`, und zwar erst beim echten Aufruf.
    Gaebe diese Funktion hier einen Client zurueck, wuerde er schon beim Bauen
    des Arguments erzeugt, auch wo der Aufruf danach nie bei Stripe landet.
    Genau daran sind am 16.09.2026 vierzehn Auszahlungs-Tests zerbrochen, die
    ihre Stripe-Helfer faelschen und den Client nie bauen.

    Der Test haelt damit fest, dass der LIVE-Pfad von diesem Umbau
    unberuehrt bleibt.
    """
    _schluessel(monkeypatch, pms="sk_test_pms", marktplatz="sk_test_marktplatz")
    assert welt.client_fuer(_db(False), TENANT) is None


def test_service_ohne_tenant_bleibt_auf_dem_alten_weg(monkeypatch) -> None:
    """Die Gegenprobe zur Migration: alle bestehenden Aufrufstellen, die keinen
    Mandanten mitgeben, muessen sich exakt wie vorher verhalten."""
    _schluessel(monkeypatch, pms="sk_test_pms", marktplatz="")
    dienst = PaymentsService(service_client=_db(True))  # type: ignore[arg-type]
    assert dienst._stripe is get_stripe()  # noqa: SLF001


def test_service_mit_sandbox_mandant_ohne_schluessel_gibt_503(monkeypatch) -> None:
    """Der Mangel muss als Konfigurationsfehler ankommen, nicht als 500."""
    _schluessel(monkeypatch, pms="sk_test_pms", marktplatz="")
    dienst = PaymentsService(service_client=_db(True), tenant_id=TENANT)  # type: ignore[arg-type]
    with pytest.raises(PaymentsConfigError) as fehler:
        _ = dienst._stripe  # noqa: SLF001
    assert fehler.value.status_code == 503


def test_sandbox_wird_nur_einmal_gelesen(monkeypatch) -> None:
    """Die Abfrage haengt an jedem Stripe-Zugriff — sie darf nicht je Aufruf
    erneut in die Datenbank gehen."""
    _schluessel(monkeypatch, pms="sk_test_pms", marktplatz="")
    db = _db(False)
    dienst = PaymentsService(service_client=db, tenant_id=TENANT)  # type: ignore[arg-type]
    treffer = []
    echt = db.table

    def zaehlend(name: str):
        treffer.append(name)
        return echt(name)

    db.table = zaehlend  # type: ignore[assignment]
    _ = dienst._stripe  # noqa: SLF001
    _ = dienst._stripe  # noqa: SLF001
    assert treffer == ["tenant_billing_profile"]
