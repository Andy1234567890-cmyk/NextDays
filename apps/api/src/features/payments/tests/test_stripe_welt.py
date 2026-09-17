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


# --- Anlage des verbundenen Kontos: v1 (PMS) vs. v2 (Marktplatz) -------------
# Stripe nimmt fuer NEUE Connect-Integrationen kein `POST /v1/accounts` mehr an
# (400, 16.09.2026) — der Marktplatz stand deshalb still. Die Marktplatz-Welt
# legt jetzt ueber `POST /v2/core/accounts` an. Geprueft wird beides, weil ein
# Vertauschen in BEIDE Richtungen weh taete: der Marktplatz kaeme nicht mehr
# ans Konto, und das PMS bekaeme einen neuen Anlageweg, den niemand bestellt
# hat („wehe bei pms geht danach nichts mehr").


class _Konto:
    def __init__(self, kennung: str) -> None:
        self.id = kennung


class _Aufzeichnend:
    """Faelscht genau die zwei Anlage-Aufrufe und haelt fest, welcher kam."""

    def __init__(self) -> None:
        self.aufrufe: list[tuple[str, dict]] = []
        selbst = self

        class _V1Accounts:
            def create(self, params: dict) -> _Konto:
                selbst.aufrufe.append(("v1", params))
                return _Konto("acct_v1")

        class _V2Accounts:
            def create(self, params: dict) -> _Konto:
                selbst.aufrufe.append(("v2", params))
                return _Konto("acct_v2")

        self.v1 = type("_V1", (), {"accounts": _V1Accounts()})()
        self.v2 = type(
            "_V2", (), {"core": type("_Core", (), {"accounts": _V2Accounts()})()}
        )()


def _anlegen(sandbox: bool, business_type: str = "individual"):
    from src.features.payments.schemas import ConnectAccountCreate

    stripe = _Aufzeichnend()
    dienst = PaymentsService(
        service_client=_db(sandbox),  # type: ignore[arg-type]
        stripe=stripe,  # type: ignore[arg-type]
        tenant_id=TENANT,
    )
    antwort = dienst.create_connect_account(
        TENANT,
        ConnectAccountCreate(
            email="gastgeber@beispiel.de", country="DE", business_type=business_type
        ),
    )
    return stripe, antwort


def test_pms_legt_weiter_ueber_v1_an() -> None:
    """Der Live-Weg bleibt Zeichen fuer Zeichen der alte."""
    stripe, antwort = _anlegen(sandbox=False)
    assert [weg for weg, _ in stripe.aufrufe] == ["v1"]
    params = stripe.aufrufe[0][1]
    assert params["type"] == "custom"
    assert params["capabilities"] == {
        "card_payments": {"requested": True},
        "transfers": {"requested": True},
    }
    assert params["tos_acceptance"] == {"service_agreement": "full"}
    assert antwort.stripe_account_id == "acct_v1"


def test_marktplatz_legt_ueber_v2_an() -> None:
    stripe, antwort = _anlegen(sandbox=True)
    assert [weg for weg, _ in stripe.aufrufe] == ["v2"]
    assert antwort.stripe_account_id == "acct_v2"


def test_v2_traegt_dieselben_angaben_wie_v1() -> None:
    """Gleiche Absicht, andere Namen — sonst entstuende ein Konto mit anderen
    Eigenschaften als im PMS, und das faellt erst bei der Freischaltung auf."""
    stripe, _ = _anlegen(sandbox=True)
    p = stripe.aufrufe[0][1]
    assert p["contact_email"] == "gastgeber@beispiel.de"
    assert p["identity"] == {"country": "DE", "entity_type": "individual"}
    # Custom-Konto: der Gastgeber bekommt kein Stripe-Dashboard.
    assert p["dashboard"] == "none"
    # Entsprechung zu tos_acceptance.service_agreement='full'.
    assert p["defaults"]["responsibilities"] == {
        "fees_collector": "application",
        "losses_collector": "application",
    }
    assert p["configuration"]["merchant"]["mcc"] == "7011"
    assert p["configuration"]["merchant"]["capabilities"]["card_payments"] == {
        "requested": True
    }
    assert p["configuration"]["recipient"]["capabilities"]["stripe_balance"] == {
        "stripe_transfers": {"requested": True}
    }
    assert p["metadata"] == {"tenant_id": TENANT}
    # Kein geratener Waehrungs-Standard (Wurzel 4).
    assert "currency" not in p["defaults"]


def test_v2_uebernimmt_den_gewerblichen_typ() -> None:
    """Privat UND gewerblich muessen gehen — der Typ bestimmt die KYC-Felder."""
    stripe, _ = _anlegen(sandbox=True, business_type="company")
    assert stripe.aufrufe[0][1]["identity"]["entity_type"] == "company"


# --- Hintergrundlaeufe: die Welt gilt je BETRIEB, nicht je Lauf --------------
# Live im Worker aufgeschlagen (17.09.2026), eine Stunde nach dem ersten
# Marktplatz-Konto:
#   „The account acct_1UGJ4D… was a test account created with a testmode key,
#    and therefore can only be used with testmode keys."
# Der Aufruf scheiterte LAUT, wie dieses Modul es verspricht — aber er
# scheiterte, und der Betrieb waere nie ausgezahlt worden. Ursache: Laeufe, die
# ueber ALLE Betriebe gehen, bauten EINEN Client vor der Schleife.


class _Zeile:
    def __init__(self, daten: list[dict]) -> None:
        self.data = daten


class _Tabelle:
    def __init__(self, daten: list[dict]) -> None:
        self._daten = daten

    def select(self, *_s: str) -> "_Tabelle":
        return self

    def eq(self, *_a: object) -> "_Tabelle":
        return self

    def lte(self, *_a: object) -> "_Tabelle":
        return self

    def execute(self) -> _Zeile:
        return _Zeile(self._daten)


class _ZahlungsDB:
    def __init__(self, zeilen: list[dict]) -> None:
        self._zeilen = zeilen
        self.gelesen: list[str] = []

    def table(self, name: str) -> _Tabelle:
        self.gelesen.append(name)
        return _Tabelle(self._zeilen)


def test_faellige_restzahlungen_tragen_ihren_betrieb() -> None:
    """Ohne den Mandanten kann der Lauf die Welt nicht waehlen."""
    db = _ZahlungsDB(
        [{"id": "pay-1", "tenant_id": TENANT}, {"id": "pay-2", "tenant_id": "t-2"}]
    )
    dienst = PaymentsService(service_client=db)  # type: ignore[arg-type]
    assert dienst.due_balance_payments() == [("pay-1", TENANT), ("pay-2", "t-2")]


def test_auszahlungslauf_fragt_die_welt_JE_betrieb(monkeypatch) -> None:
    """Der Lauf geht ueber alle Betriebe — er muss die Entscheidung so oft
    treffen, wie es Betriebe gibt, nicht einmal fuer alle."""
    from src.features.payouts import stripe_saldo

    gefragt: list[str | None] = []
    monkeypatch.setattr(
        stripe_saldo.welt,
        "client_fuer",
        lambda _db, tenant_id: gefragt.append(tenant_id) or None,
    )
    monkeypatch.setattr(
        stripe_saldo.sc,
        "retrieve_balance",
        lambda **_k: {"available": []},
    )
    # Was danach ausgezahlt wuerde, ist hier nicht die Frage — nur, mit welchem
    # Client gelesen wird.
    monkeypatch.setattr(
        stripe_saldo.sicherheitseinlage, "auszahlbar", lambda *_a, **_k: {}
    )

    betriebe = [
        {"tenant_id": TENANT, "stripe_account_id": "acct_a",
         "stripe_payouts_enabled": True},
        {"tenant_id": "t-2", "stripe_account_id": "acct_b",
         "stripe_payouts_enabled": True},
    ]
    einstellungen = [{"verbund_interval": "daily"}]

    class _T:
        def __init__(self, daten: list[dict]) -> None:
            self._d = daten

        def select(self, *_s: str) -> "_T":
            return self

        def eq(self, *_a: object) -> "_T":
            return self

        def limit(self, *_a: object) -> "_T":
            return self

        @property
        def not_(self) -> "_T":
            return self

        def is_(self, *_a: object) -> "_T":
            return self

        def in_(self, *_a: object) -> "_T":
            return self

        def gte(self, *_a: object) -> "_T":
            return self

        def lte(self, *_a: object) -> "_T":
            return self

        def order(self, *_a: object, **_k: object) -> "_T":
            return self

        def execute(self) -> _Zeile:
            return _Zeile(self._d)

    class _DBLauf:
        def table(self, name: str) -> _T:
            return _T(betriebe if name == "tenant_billing_profile" else einstellungen)

    stripe_saldo.run_verbund_auszahlungen(_DBLauf())  # type: ignore[arg-type]
    assert gefragt == [TENANT, "t-2"]
