"""Die Airbnb-Zuordnung wird geschrieben UND zurückgelesen.

Hintergrund (live gemessen 05.08.2026 am Beta-Betrieb): der Assistent meldete
„Airbnb verbunden und aktiviert", die Objektzeile blieb aber „Nicht verbunden".
Ursache war nicht die Nutzlast — jedes Objekt hat seinen eigenen Rate-Plan, das
Array war korrekt — sondern der WEG: `PUT channels/{id}` mit `rate_plans`
antwortet 200 und speichert bei Airbnb nichts. Der Kanal trug danach weiter nur
den einen Eintrag von „Feriehus Grævlinge".
"""
import pytest

from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.oauth_channels import OAuthChannelsMixin


class _ChannexDouble:
    """Channex-Ersatz: `POST …/mappings` speichert, `PUT` würde es nicht."""

    def __init__(self, vorhanden: list[str] | None = None, *, speichert: bool = True):
        self.rate_plan_ids: list[str] = list(vorhanden or [])
        self.speichert = speichert
        self.mapping_calls: list[tuple[str, dict[str, object]]] = []
        self.update_calls: list[dict[str, object]] = []

    def get_channel(self, channel_id: str) -> dict[str, object]:
        return {
            "data": {
                "attributes": {
                    "rate_plans": [
                        {"rate_plan_id": rid, "settings": {}}
                        for rid in self.rate_plan_ids
                    ]
                }
            }
        }

    def create_channel_mapping(
        self, channel_id: str, rate_plan_id: str, settings: dict[str, object]
    ) -> dict[str, object]:
        self.mapping_calls.append((rate_plan_id, settings))
        if self.speichert:
            self.rate_plan_ids.append(rate_plan_id)
        return {"data": {"id": "m1"}}

    def update_channel(
        self, channel_id: str, attrs: dict[str, object]
    ) -> dict[str, object]:
        self.update_calls.append(attrs)
        return {"data": {"id": channel_id}}


class _Service(OAuthChannelsMixin):
    """Nur der Mixin plus das, was die geprüfte Methode braucht."""

    def __init__(self, channex: _ChannexDouble):
        self._channex = channex

    @staticmethod
    def _wrap_channex(exc: Exception) -> ChannelManagerError:
        return ChannelManagerError(str(exc), status_code=502)


def _plan(rid: str, listing: str) -> dict[str, object]:
    return {"rate_plan_id": rid, "settings": {"listing_id": listing}}


def test_zuordnung_geht_ueber_mappings_nicht_ueber_put() -> None:
    """Geschrieben wird je Eintrag einzeln — das Array-PUT wird nicht benutzt."""
    channex = _ChannexDouble()
    service = _Service(channex)

    service._zuordnung_schreiben_und_pruefen(
        "kanal-1", [_plan("rp-neu", "1378994948547697321")]
    )

    assert channex.mapping_calls == [
        ("rp-neu", {"listing_id": "1378994948547697321"})
    ]
    assert channex.update_calls == []  # der Weg, der 200 liefert und nichts tut


def test_bestehende_zuordnung_bleibt_erhalten() -> None:
    """Ein zweites Objekt hängt sich an, ohne das erste zu verdrängen (Wurzel 1).

    Jedes Objekt hat seinen eigenen Rate-Plan; „Grævlinge" darf beim Verbinden
    von „Lille Lægehus" nicht aus dem Kanal fallen.
    """
    channex = _ChannexDouble(["rp-graevlinge"])
    service = _Service(channex)

    service._zuordnung_schreiben_und_pruefen(
        "kanal-1", [_plan("rp-laegehus", "1378994948547697321")]
    )

    assert set(channex.rate_plan_ids) == {"rp-graevlinge", "rp-laegehus"}


def test_vorhandene_zuordnung_wird_nicht_doppelt_geschrieben() -> None:
    """Idempotent (Wurzel 2): schon zugeordnet = nichts zu tun."""
    channex = _ChannexDouble(["rp-schon-da"])
    service = _Service(channex)

    service._zuordnung_schreiben_und_pruefen(
        "kanal-1", [_plan("rp-schon-da", "1654285285861524234")]
    )

    assert channex.mapping_calls == []


def test_nicht_gespeicherte_zuordnung_schlaegt_fehl() -> None:
    """Der eigentliche Bug: 200 ohne Wirkung darf nicht „verbunden" heißen.

    `speichert=False` bildet genau das gemessene Verhalten nach — der Aufruf
    kommt durch, der Kanal trägt die Zuordnung danach aber nicht. Dann muss
    dieser Pfad abbrechen (fail-closed), damit der Aufrufer den Kanal nicht
    aktiviert und keinen grünen Haken zeigt.
    """
    channex = _ChannexDouble(["rp-graevlinge"], speichert=False)
    service = _Service(channex)

    with pytest.raises(ChannelManagerError) as fehler:
        service._zuordnung_schreiben_und_pruefen(
            "kanal-1", [_plan("rp-laegehus", "1378994948547697321")]
        )

    assert fehler.value.status_code == 502
    assert "nicht gespeichert" in str(fehler.value.message)


class _DbDouble:
    """Nur `rate_plans`-Abfragen — mehr braucht der Preis-Nachhol-Pfad nicht."""

    def __init__(self, plaene: list[dict[str, object]]):
        self.plaene = plaene

    def table(self, name: str) -> "_DbDouble":
        assert name == "rate_plans"
        return self

    def select(self, *_args: str) -> "_DbDouble":
        return self

    def eq(self, *_args: object) -> "_DbDouble":
        return self

    def limit(self, *_args: int) -> "_DbDouble":
        return self

    def execute(self) -> object:
        return type("R", (), {"data": self.plaene})()


class _PreisService(OAuthChannelsMixin):
    """Mixin plus ein Abruf-Double, das den Aufruf nur protokolliert."""

    _OAUTH_PORTALS = frozenset({"AirBNB"})

    def __init__(self, ergebnis: dict[str, object] | None = None):
        self.abrufe: list[str] = []
        self._ergebnis = ergebnis or {
            "preis_uebernommen": True, "base_price": 500, "waehrung": "DKK",
        }

    def airbnb_objekt_abrufen(
        self, ctx: object, property_id: str
    ) -> dict[str, object]:
        self.abrufe.append(property_id)
        return self._ergebnis


def test_ohne_preisplan_wird_der_airbnb_abruf_geholt() -> None:
    """Airbnb LIEFERT den Grundpreis — der Kunde tippt ihn nicht ab.

    Belegt: `GET channels/{id}/mappings/{mappingId}/pricing_settings`
    (docs/OTA/Airbnb/Pricing Settings.pdf) und live gemessen 05.08.2026 für
    „FeWo Lille Lægehus": `default_daily_price: 500`, `currency: "DKK"`.
    Ohne diesen Schritt endete „Verbinden" für jedes übernommene Objekt in
    „Setze unter „Preise" den Grundpreis" — eine Sackgasse.
    """
    service = _PreisService()

    service._preis_von_airbnb_nachholen(_DbDouble([]), object(), "t1", "prop-16")

    assert service.abrufe == ["prop-16"]


def test_vorhandener_preis_wird_nicht_ueberschrieben() -> None:
    """Ein selbst gesetzter Preis ist die Wahrheit (Wurzel 2)."""
    service = _PreisService()

    service._preis_von_airbnb_nachholen(
        _DbDouble([{"id": "rp-1"}]), object(), "t1", "prop-graevlinge"
    )

    assert service.abrufe == []


def test_abruf_fehler_kippt_das_verbinden_nicht() -> None:
    """Best effort: scheitert der Abruf, greift danach der reguläre 422."""

    class _Kaputt(_PreisService):
        def airbnb_objekt_abrufen(
            self, ctx: object, property_id: str
        ) -> dict[str, object]:
            raise ChannelManagerError("Airbnb nicht erreichbar", status_code=502)

    service = _Kaputt()

    service._preis_von_airbnb_nachholen(_DbDouble([]), object(), "t1", "prop-16")


def test_already_exists_gilt_als_zielzustand() -> None:
    """Channex kennt die Zuordnung besser als unsere Sicht auf den Kanal."""

    class _Meckert(_ChannexDouble):
        def create_channel_mapping(
            self, channel_id: str, rate_plan_id: str, settings: dict[str, object]
        ) -> dict[str, object]:
            self.mapping_calls.append((rate_plan_id, settings))
            self.rate_plan_ids.append(rate_plan_id)
            raise ChannexError("rate plan already exists", channex_status=422)

    channex = _Meckert()
    service = _Service(channex)

    service._zuordnung_schreiben_und_pruefen(
        "kanal-1", [_plan("rp-neu", "1378994948547697321")]
    )

    assert "rp-neu" in channex.rate_plan_ids
