"""Der 422 „rate plan already exists" ist der ZIELZUSTAND, nicht ein Fehler.

GEMESSEN am 24.08.2026 06:50 am Beta-Betrieb, Objekt „FeWo *Stjerneskud*",
Airbnb-Kanal 21ec5429-c796-41c2-b6d2-2b2f74ad0522:

    POST channels/21ec5429…/mappings  → HTTP 422
    Nutzlast: {"mapping": {"settings": {"listing_id": "54087677"},
                           "rate_plan_id": "b7df3e35-…"}}
    Antwort:  {"errors": {"code": "validation_error",
                          "details": {"mapping": ["rate plan already exists"]}}}
    channex_debug_log: step "hotel_policy", ok: false

ZWEI Befunde in einem Vorgang:

1. `airbnb_objekt_abruf._listing_mapping_setzen` hatte keine
   „already exists"-Behandlung — anders als die beiden anderen Aufrufer
   derselben Client-Methode (`objekt_kanal._portal_anpassung_mappings`,
   `oauth_channels._zuordnung_schreiben_und_pruefen`), die den Fall seit
   laengerem als Zielzustand fuehren (Wurzel 2). Der ganze Abruf brach damit an
   einer BESTEHENDEN Zuordnung ab.

2. Der Schritt im Protokoll war FALSCH. `content_sync` setzt `hotel_policy` als
   letzten Trace-Schritt und raeumte ihn nicht; der Trace-Kontext gilt aber, bis
   er neu gesetzt wird. Der Mapping-Aufruf trug deshalb ein fremdes Etikett —
   der Fehler war fuer den Betrieb unter diesem Namen nicht auffindbar.

WORAUF DIESE TESTS BEWUSST NICHT HEREINFALLEN: „schon zugeordnet" heisst nicht
„die Werte liegen vor". Ein 422 hat keine Antwort-Nutzlast, und das Kanal-Objekt
traegt in `rate_plans[].settings` nur `listing_id`/`published` — NICHT
`pricing_setting`. Genau deshalb liest der Ablauf sie ueber die Mapping-
Endpunkte nach, und wenn auch das nichts ergibt, sagt er das (`None`) statt
weiterzulaufen, als haette er sie (Wurzel 4/5).
"""
from __future__ import annotations

from typing import Any

import pytest

from src.features.channel_manager.airbnb_mapping_nachlesen import (
    AirbnbMappingNachlesenMixin,
)
from src.features.channel_manager.airbnb_objekt_abruf import (
    AirbnbObjektAbrufMixin,
)
from src.features.channel_manager.channex_client import ChannexError

KANAL = "21ec5429-c796-41c2-b6d2-2b2f74ad0522"
LISTING = "54087677"
RATE_PLAN = "b7df3e35-4483-494f-85fc-476aa14d8d6e"
MAPPING = "9218322c-1111-2222-3333-444455556666"

# Der gemessene Wortlaut, unveraendert.
BESTEHT_SCHON = ChannexError(
    "rate plan already exists", status_code=422, channex_status=422
)


class _Channex:
    """Channex-Ersatz. `rate_plans[]` traegt NUR das schmale `settings` —

    genau wie live: `id`, `rate_plan_id` und `settings.listing_id`. Preis- und
    Regelwerte liegen NICHT hier, sondern hinter den Mapping-Endpunkten.
    """

    def __init__(
        self,
        *,
        fehler: Exception | None = None,
        listing_am_kanal: str | None = None,
        preis: dict[str, Any] | None = None,
        regeln: dict[str, Any] | None = None,
        preis_fehler: Exception | None = None,
    ) -> None:
        self.fehler = fehler
        self.listing_am_kanal = listing_am_kanal
        self.preis = preis
        self.regeln = regeln
        self.preis_fehler = preis_fehler
        self.mapping_calls: list[tuple[str, dict[str, Any]]] = []
        self.gelesen: list[str] = []

    def get_channel(self, channel_id: str) -> dict[str, Any]:
        return {
            "data": {
                "attributes": {
                    "rate_plans": [
                        {
                            "id": MAPPING,
                            "rate_plan_id": RATE_PLAN,
                            "settings": (
                                {"listing_id": self.listing_am_kanal}
                                if self.listing_am_kanal
                                else {}
                            ),
                        }
                    ]
                }
            }
        }

    def create_channel_mapping(
        self, channel_id: str, rate_plan_id: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        self.mapping_calls.append((rate_plan_id, settings))
        if self.fehler is not None:
            raise self.fehler
        return {"data": {"attributes": {"settings": {"listing_id": LISTING}}}}

    def get_listing_pricing_settings(
        self, channel_id: str, mapping_id: str
    ) -> dict[str, Any]:
        self.gelesen.append(f"pricing:{mapping_id}")
        if self.preis_fehler is not None:
            raise self.preis_fehler
        return {"data": {"attributes": self.preis or {}}}

    def get_listing_availability_settings(
        self, channel_id: str, mapping_id: str
    ) -> dict[str, Any]:
        self.gelesen.append(f"availability:{mapping_id}")
        return {"data": {"attributes": self.regeln or {}}}


class _Service(AirbnbObjektAbrufMixin, AirbnbMappingNachlesenMixin):
    """Die beiden Mixins plus das, was `_listing_mapping_setzen` braucht.

    Zwei, weil das Nachlesen bewusst ein eigenes Modul ist
    (`airbnb_mapping_nachlesen`) — der Service setzt sie genauso zusammen.
    """

    def __init__(self, channex: _Channex) -> None:
        self._channex = channex
        self.trace_steps: list[str | None] = []

    def _selected_rate_plan_ids(self, *_args: Any, **_kw: Any) -> list[str]:
        return [RATE_PLAN]

    def _trace_step(
        self, *, tenant_id: str | None, property_id: str | None = None, step: str
    ) -> None:
        self.trace_steps.append(step)


def _setzen(service: _Service) -> dict[str, Any] | None:
    return service._listing_mapping_setzen(
        None, "t-1", "p-1", KANAL, LISTING  # type: ignore[arg-type]
    )


def test_bestehende_zuordnung_gilt_als_erfolg_nicht_als_fehler() -> None:
    """Der gemessene Zustand: 422 „already exists" → der Ablauf laeuft weiter.

    Die Zuordnung BESTEHT, also ist der Zielzustand erreicht (Wurzel 2). Der
    Aufruf darf nicht durchschlagen und den ganzen Abruf abbrechen — und die
    Werte kommen aus den Mapping-Endpunkten, nicht aus einer Antwort-Nutzlast,
    die es bei einem 422 nicht gibt.
    """
    channex = _Channex(
        fehler=BESTEHT_SCHON,
        preis={"default_daily_price": 504, "listing_currency": "DKK"},
        regeln={"default_min_nights": 2},
    )
    service = _Service(channex)

    settings = _setzen(service)

    assert settings is not None, "bestehende Zuordnung ist kein Fehlschlag"
    assert settings["pricing_setting"]["default_daily_price"] == 504
    assert settings["availability_rule"]["default_min_nights"] == 2
    # Nachgelesen wurde ueber die Mapping-ID des Kanal-Eintrags.
    assert channex.gelesen == [f"pricing:{MAPPING}", f"availability:{MAPPING}"]


def test_preis_aus_bestehender_zuordnung_wird_uebernommen() -> None:
    """Die nachgelesenen Werte sind fuer `_preise_von_airbnb` verwertbar.

    Der Beweis, dass die Rueckgabe DIE FORM der Mapping-Antwort hat: derselbe
    Auswerte-Code zieht den Nachtpreis heraus. Waere die Form anders, brauchte
    es eine zweite Auswertung — und zwei Auswertungen driften auseinander.
    """
    channex = _Channex(
        fehler=BESTEHT_SCHON,
        preis={"default_daily_price": 504, "listing_currency": "DKK"},
        regeln={"default_min_nights": 2},
    )
    settings = _setzen(_Service(channex))
    assert settings is not None

    assert AirbnbObjektAbrufMixin._nachtpreis(settings["pricing_setting"]) == 504.0


def test_anderer_422_schlaegt_weiterhin_durch() -> None:
    """Nicht alles verschlucken (Wurzel 5): nur DAS eine Signal ist Zielzustand.

    Ein 422 aus anderem Grund ist ein echter Fehler und muss beim Aufrufer
    ankommen — sonst wuerde ein misslungenes Zuordnen als „fertig" gemeldet.
    """
    channex = _Channex(
        fehler=ChannexError(
            "Room type photos limit exceeded", status_code=422, channex_status=422
        )
    )
    with pytest.raises(ChannexError, match="photos limit"):
        _setzen(_Service(channex))


def test_ohne_nachlesbare_werte_kein_stiller_erfolg() -> None:
    """Kein erfundener Wert (Wurzel 4): keine Werte lesbar → `None`.

    Der Ablauf darf NICHT so tun, als haette er Airbnbs Preis. `None` bedeutet
    beim Aufrufer „nicht zugeordnet/keine Werte" und fuehrt zu einem Hinweis an
    den Betrieb, nicht zu einem gemeldeten Erfolg.
    """
    channex = _Channex(
        fehler=BESTEHT_SCHON,
        preis_fehler=ChannexError(
            "not found", status_code=404, channex_status=404
        ),
        regeln={},
    )
    assert _setzen(_Service(channex)) is None


def test_kanal_objekt_allein_traegt_den_preis_nicht() -> None:
    """Der Beleg fuer die `settings`-Frage — warum ueberhaupt nachgelesen wird.

    Das Kanal-Objekt traegt in `rate_plans[].settings` nur `listing_id`. Waere
    das die Quelle der Preise, muesste dieser Zustand einen Preis liefern; er
    liefert keinen. Im Haus belegt durch
    `airbnb_gebuehren._airbnb_pricing_settings`, das aus genau diesem Grund
    erst die Mapping-ID aus `rate_plans[]` liest und die Preise DANACH per
    `GET .../mappings/{mid}/pricing_settings` holt.
    """
    kanal = _Channex(listing_am_kanal=LISTING).get_channel(KANAL)
    eintrag = kanal["data"]["attributes"]["rate_plans"][0]

    assert eintrag["settings"] == {"listing_id": LISTING}
    assert "pricing_setting" not in eintrag["settings"]
    assert AirbnbObjektAbrufMixin._nachtpreis(eintrag["settings"]) is None


def test_vorab_erkannte_zuordnung_ruft_gar_nicht_an() -> None:
    """Schritt 1 der Idempotenz bleibt: bekanntes Listing → kein POST."""
    channex = _Channex(listing_am_kanal=LISTING)
    service = _Service(channex)

    settings = _setzen(service)

    assert channex.mapping_calls == []
    assert settings == {"listing_id": LISTING}


def test_mapping_aufruf_hat_eigenen_trace_schritt() -> None:
    """Teil C: der Aufruf traegt seinen EIGENEN Namen im Verlauf.

    Vorher lief er unter `hotel_policy` (dem letzten Content-Schritt), weil der
    Trace-Kontext gilt, bis er neu gesetzt wird. Ein Fehler unter fremdem Namen
    ist im Betrieb nicht auffindbar — genau das ist am 24.08.2026 passiert.
    """
    service = _Service(_Channex(fehler=BESTEHT_SCHON, preis={}, regeln={}))
    _setzen(service)

    assert service.trace_steps == ["airbnb_listing_mapping"]
    assert "hotel_policy" not in service.trace_steps
