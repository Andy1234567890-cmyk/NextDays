"""Kanaele, die die Zuordnung SELBST machen (`mapping_mode: "direct"`).

Google Hotel Search hat kein Extranet und keine Zimmer-Codes: `mapping_details`
antwortet mit `{"data": {}}`, und das ist die RICHTIGE Antwort, kein Fehler.
Mitgeschickt werden nur die eigenen Preisplaene; das Portal erkennt die
Unterkunft an Adresse, Telefon und Objektname.

Der Fehler, den diese Tests festhalten (live 04.09.2026, FeWo *Stjerneskud*):
`prepare` gab `ota_rooms: []` zurueck, die Maske deutete das als
„Das Portal liefert keine Zimmer. Pruefe die Zugangsdaten." und bot KEINEN
Verbinden-Knopf — eine Sackgasse, obwohl `connect_channel` den Kanal ueber
`_build_rate_plans_direct` anlegen konnte. Der Modus stand im Katalog, wurde
aber nirgends an die Oberflaeche gegeben.

Live aus dem Channex-Katalog gelesen (04.09.2026): GoogleHotelARI traegt
`kind: "meta"`, `mapping_mode: "direct"`, `rate_params: null`,
`property_mapping: "single"`. ACHT Kanaele tragen `direct` — deshalb pruefen
diese Tests den MODUS, nie einen Portal-Code (Wurzel 4).

`_build_rate_plans` hatte bis hier keinen einzigen ausfuehrenden Test;
`docs/CHANNEX-FELDER.md` behauptete Unit-Test-Abdeckung fuer `direct`, im
Testverzeichnis stand dazu nichts.
"""
from __future__ import annotations

import inspect
import re
from typing import Any

import pytest

from src.features.channel_manager.channels import ChannelsMixin
from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.oauth_channels import OAuthChannelsMixin

GOOGLE = "GoogleHotelARI"
# Genau die Form, die der Live-Katalog fuer Google liefert.
SPEC_DIREKT: dict[str, Any] = {
    "code": GOOGLE,
    "kind": "meta",
    "mapping_mode": "direct",
    "rate_params": None,
    "property_mapping": "single",
}
# Booking.com: Zuordnung ueber OTA-Codes, `rate_params` gefuellt.
SPEC_CODES: dict[str, Any] = {
    "code": "BookingCom",
    "mapping_mode": "room_rate_multioccupancy",
    "rate_params": {
        "room_type_code": {"type": "string"},
        "rate_plan_code": {"type": "string"},
    },
}


class _Dienst(ChannelsMixin):
    """`_build_rate_plans` mit ersetzten Datenzugriffen: geprueft wird die
    Modus-Weiche, nicht PostgREST und nicht der Channex-Katalog."""

    def __init__(self, spec: dict[str, Any], plaene: list[str]) -> None:
        self._spec = spec
        self._plaene = plaene

    def _channel_spec(self, _code: str) -> dict[str, Any]:  # type: ignore[override]
        return self._spec

    def _selected_rate_plan_ids(  # type: ignore[override]
        self, _db: Any, _t: str, _p: str, _portal: str | None = None
    ) -> list[str]:
        return self._plaene


def test_direkter_kanal_schickt_nur_die_eigenen_preisplaene() -> None:
    """Ohne OTA-Zimmer und ohne `room_type_code` entsteht ein gueltiges Array."""
    dienst = _Dienst(SPEC_DIREKT, ["cx-grundpreis"])

    plaene = dienst._build_rate_plans(  # noqa: SLF001
        None, "t-1", GOOGLE,
        mappings=[{"local_property_id": "prop-1"}],
        ota_rooms=[],
    )

    assert plaene == [{"rate_plan_id": "cx-grundpreis"}]


def test_direkter_kanal_ignoriert_einen_mitgesendeten_zimmercode() -> None:
    """`room_type_code` ist hier bedeutungslos — er darf nichts veraendern.

    Wichtig, weil die Maske dieselbe Zeilenform fuer beide Kanalarten nutzt.
    """
    dienst = _Dienst(SPEC_DIREKT, ["cx-grundpreis"])

    ohne = dienst._build_rate_plans(  # noqa: SLF001
        None, "t-1", GOOGLE,
        mappings=[{"local_property_id": "prop-1", "room_type_code": None}],
        ota_rooms=[],
    )
    mit = dienst._build_rate_plans(  # noqa: SLF001
        None, "t-1", GOOGLE,
        mappings=[{"local_property_id": "prop-1", "room_type_code": "99"}],
        ota_rooms=[],
    )

    assert ohne == mit == [{"rate_plan_id": "cx-grundpreis"}]


def test_mehrere_objekte_jedes_mit_seinen_plaenen_ohne_dubletten() -> None:
    """Mehrere Einheiten unter einer Kennung: jeder Plan nur EINMAL im Array."""
    dienst = _Dienst(SPEC_DIREKT, ["cx-grund", "cx-woche"])

    plaene = dienst._build_rate_plans(  # noqa: SLF001
        None, "t-1", GOOGLE,
        mappings=[
            {"local_property_id": "prop-1"},
            {"local_property_id": "prop-2"},
        ],
        ota_rooms=[],
    )

    assert plaene == [{"rate_plan_id": "cx-grund"}, {"rate_plan_id": "cx-woche"}]


def test_fehlende_objektzuordnung_faellt_klar_durch() -> None:
    """Kein Objekt zugeordnet → 422 mit umsetzbarer Meldung, nicht leises []."""
    dienst = _Dienst(SPEC_DIREKT, ["cx-grundpreis"])

    with pytest.raises(ChannelManagerError) as exc:
        dienst._build_rate_plans(  # noqa: SLF001
            None, "t-1", GOOGLE, mappings=[{}], ota_rooms=[],
        )

    assert exc.value.status_code == 422


def test_kanal_ohne_rate_params_zaehlt_ebenfalls_als_direkt() -> None:
    """Kein `mapping_mode`, keine `rate_params` (z.B. Payless): auch direkt.

    Dieselbe Bedingung nutzt die Maske — sonst zeigt sie eine Zuordnung, die
    der Anlege-Pfad nicht auswertet.
    """
    dienst = _Dienst({"code": "Payless", "rate_params": None}, ["cx-grundpreis"])

    plaene = dienst._build_rate_plans(  # noqa: SLF001
        None, "t-1", "Payless",
        mappings=[{"local_property_id": "prop-1"}],
        ota_rooms=[],
    )

    assert plaene == [{"rate_plan_id": "cx-grundpreis"}]


def test_kanal_mit_ota_codes_bleibt_beim_zimmerweg() -> None:
    """Gegenprobe: ein Portal MIT `rate_params` darf nicht in den direct-Zweig.

    Sonst verloere Booking.com die Zimmer/Raten-Zuordnung — dort ist der
    OTA-Code Pflicht, und ein unbekannter Code muss auffallen statt zu wirken.
    """
    dienst = _Dienst(SPEC_CODES, ["cx-grundpreis"])

    with pytest.raises(ChannelManagerError) as exc:
        dienst._build_rate_plans(  # noqa: SLF001
            None, "t-1", "BookingCom",
            mappings=[{"local_property_id": "prop-1", "room_type_code": "4711"}],
            ota_rooms=[],  # Code 4711 ist darin nicht enthalten
        )

    assert exc.value.status_code == 422
    assert "nicht gefunden" in exc.value.message


class _ModusDienst(ChannelsMixin):
    """Nur die Modus-Erkennung, ohne Datenzugriffe."""


@pytest.mark.parametrize(
    ("spec", "erwartet"),
    [
        ({"mapping_mode": "direct", "rate_params": None}, True),
        ({"mapping_mode": "direct", "rate_params": {"x": {}}}, True),
        ({"mapping_mode": None, "rate_params": None}, True),
        ({"mapping_mode": "room_rate_multioccupancy", "rate_params": None}, True),
        ({"mapping_mode": "listing", "rate_params": {"listing_id": {}}}, False),
        (
            {
                "mapping_mode": "room_rate_multioccupancy",
                "rate_params": {"room_type_code": {}},
            },
            False,
        ),
        ({}, True),  # Katalog nicht erreichbar: `_channel_spec` gibt {}
    ],
)
def test_modus_erkennung(spec: dict[str, Any], erwartet: bool) -> None:
    """Ein Kanal ohne Raten-Parameter kennt keine Codes zum Zuordnen.

    Der leere Katalog-Eintrag zaehlt bewusst als direkt: dann gibt es keine
    `rate_params`, aus denen sich eine Zimmer-Zuordnung bauen liesse — und der
    Zimmerweg wuerfe „Portal-Zimmer nicht gefunden" fuer jede Zeile.
    """
    dienst = _ModusDienst()

    assert dienst._ist_direktzuordnung(spec) is erwartet  # noqa: SLF001


@pytest.mark.parametrize(
    "code",
    [None, "", "   "],
)
def test_leerer_zimmercode_wird_nicht_gespeichert(code: str | None) -> None:
    """Ohne OTA-Code bleibt die Verbindungszeile leer statt `""` zu tragen.

    Ein Leerstring landete sonst als `ota_room_type_code` in
    `channex_channel_connection` und erschien in der Objekt-Ansicht als leeres
    Feld — ein erfundener Ersatzwert statt der Wahrheit „dieser Kanal kennt
    keine Zimmer-Codes" (Wurzel 4).
    """
    treffer = ChannelsMixin._mapped_room_for_property(  # noqa: SLF001
        "prop-1",
        [{"local_property_id": "prop-1", "room_type_code": code}],
        [],
    )

    assert treffer == (None, None)


def test_echter_zimmercode_wird_weiterhin_gespeichert() -> None:
    """Gegenprobe: bei einem Portal MIT Codes bleibt Code und Titel erhalten."""
    treffer = ChannelsMixin._mapped_room_for_property(  # noqa: SLF001
        "prop-1",
        [{"local_property_id": "prop-1", "room_type_code": 1220760101}],
        [{"id": 1220760101, "title": "Twin Room"}],
    )

    assert treffer == ("1220760101", "Twin Room")


class _ReadinessDienst(OAuthChannelsMixin):
    """Nur `_readiness_offen` mit gefaelschter Channex-Antwort.

    Der Helfer liegt in `OAuthChannelsMixin`; `connect_channel` erreicht ihn
    ueber die gemeinsame Service-Klasse (beide Mixins, eine MRO).
    """

    def __init__(self, antwort: list[dict[str, Any]] | Exception) -> None:
        self._antwort = antwort

        class _Client:
            def check_readiness(_self, _channel_id: str) -> list[dict[str, Any]]:
                if isinstance(antwort, Exception):
                    raise antwort
                return antwort

        self._channex = _Client()  # type: ignore[assignment]


def test_offene_punkte_kommen_als_klartext() -> None:
    """Google verlangt den ganzen Objekt-Inhalt — fehlt etwas, muss es DASTEHEN.

    Live gemessene Antwortform (04.08.2026):
        [{"field": "timezone", "error_code": "required", "entity": "Property"}]
    """
    dienst = _ReadinessDienst([
        {"field": "hotel_policy_id", "error_code": "required", "entity": "Property"},
        {"field": "latitude", "error_code": "required", "entity": "Property"},
        {"field": "longitude", "error_code": "required", "entity": "Property"},
    ])

    offen = dienst._readiness_offen("ch-1")  # noqa: SLF001

    # latitude+longitude ergeben denselben Text und erscheinen nur EINMAL.
    assert offen == "Hausregeln, Standort auf der Karte"


def test_readiness_ausfall_kippt_den_connect_nicht() -> None:
    """Die Pruefung ist Diagnose. Faellt sie aus, bleibt die Verbindung gueltig.

    Sonst haenge das Verbinden an einem undokumentierten Diagnose-Endpunkt
    (Wurzel 5: best effort darf den Hauptpfad nicht kippen).
    """
    dienst = _ReadinessDienst(ChannexError("Channex weg", status_code=502))

    assert dienst._readiness_offen("ch-1") == ""  # noqa: SLF001


class _ZaehlerDienst(ChannelsMixin):
    """`_zimmerzahlen_ergaenzen` mit einem Objekt aus dem Speicher."""

    def __init__(self, attrs: dict[str, Any]) -> None:
        self._attrs = attrs

        class _Result:
            data = [{"type_attributes": attrs}]

        class _Query:
            def select(self, *_a: Any, **_k: Any) -> _Query:
                return self

            def eq(self, *_a: Any) -> _Query:
                return self

            def limit(self, *_a: Any) -> _Query:
                return self

            def execute(self) -> _Result:
                return _Result()

        class _Db:
            def table(self, _name: str) -> _Query:
                return _Query()

        self._db_fake = _Db()


# Genau die Felder, die der Live-Katalog fuer Google fuehrt (mit Default 1).
PARAMS_GOOGLE: dict[str, Any] = {
    "bedrooms_count": {"type": "number", "default": 1},
    "bathrooms_count": {"type": "number", "default": 1},
    "beds_count": {"type": "number", "default": 1},
    "email": {"type": "string"},
}


def test_zimmerzahlen_kommen_aus_dem_objekt() -> None:
    """Der Katalog-Default 1 wuerde JEDES Ferienobjekt als Ein-Zimmer melden.

    Live gemessen (04.09.2026, FeWo *Stjerneskud*): 2 Schlafzimmer, 1 Bad,
    2 Betten. Mit dem Default stuende 1/1/1 im Google-Inserat — plausibel und
    falsch, also unerkennbar (Wurzel 4).

    `badezimmer` steht als FLOAT in den Daten (`airbnb_listing_import` schreibt
    `float(bad)`) — genau die Form, die der Schreibpfad wirklich produziert.
    """
    dienst = _ZaehlerDienst({"schlafzimmer": 2, "badezimmer": 1.0, "betten": 2})

    out = dienst._zimmerzahlen_ergaenzen(  # noqa: SLF001
        dienst._db_fake, "t-1", "prop-1",  # noqa: SLF001
        {"params": PARAMS_GOOGLE}, {"email": "x@y.dk"},
    )

    assert out == {
        "email": "x@y.dk",
        "bedrooms_count": 2,
        "bathrooms_count": 1,
        "beds_count": 2,
    }


def test_eingabe_des_kunden_wird_nicht_ueberschrieben() -> None:
    """Wer den Wert selbst setzt, behaelt ihn — wir korrigieren nicht nach."""
    dienst = _ZaehlerDienst({"schlafzimmer": 2})

    out = dienst._zimmerzahlen_ergaenzen(  # noqa: SLF001
        dienst._db_fake, "t-1", "prop-1",  # noqa: SLF001
        {"params": PARAMS_GOOGLE}, {"bedrooms_count": 5},
    )

    assert out["bedrooms_count"] == 5


def test_kanal_ohne_diese_felder_bleibt_unberuehrt() -> None:
    """Booking.com fuehrt keine Zimmerzahlen — nichts hineinschreiben."""
    dienst = _ZaehlerDienst({"schlafzimmer": 2, "badezimmer": 1, "betten": 2})

    out = dienst._zimmerzahlen_ergaenzen(  # noqa: SLF001
        dienst._db_fake, "t-1", "prop-1",  # noqa: SLF001
        {"params": {"hotel_id": {"type": "string"}}}, {"hotel_id": "123"},
    )

    assert out == {"hotel_id": "123"}


def test_halbe_badezimmer_gehen_als_ganzzahl_mit() -> None:
    """Airbnb kennt Halbbaeder (1.5). Das Portal fuehrt Ganzzahlen.

    Der Fehler, den das verhindert: ein int-Guard verwarf jeden float still,
    also JEDES aus Airbnb uebernommene Objekt (dort ist `badezimmer` immer
    float, auch `1.0`). Google bekam dann seinen Default 1 — bei 2,5 Baedern
    eine falsche Angabe im Inserat, die niemand als Fehler erkennt.
    """
    dienst = _ZaehlerDienst({"badezimmer": 2.5})

    out = dienst._zimmerzahlen_ergaenzen(  # noqa: SLF001
        dienst._db_fake, "t-1", "prop-1",  # noqa: SLF001
        {"params": PARAMS_GOOGLE}, {},
    )

    assert out["bathrooms_count"] == 2
    assert isinstance(out["bathrooms_count"], int)


def test_lesefehler_kippt_den_connect_nicht() -> None:
    """Die Zahlen sind eine Anreicherung — ihr Ausfall darf nichts kippen.

    Sonst haengt das Verbinden an einem Nachschlagen, das mit der Verbindung
    selbst nichts zu tun hat (Wurzel 5).
    """
    class _KaputtesDb:
        def table(self, _name: str) -> object:
            raise RuntimeError("PostgREST weg")

    dienst = _ZaehlerDienst({"schlafzimmer": 2})

    out = dienst._zimmerzahlen_ergaenzen(  # noqa: SLF001
        _KaputtesDb(), "t-1", "prop-1",
        {"params": PARAMS_GOOGLE}, {"email": "x@y.dk"},
    )

    assert out == {"email": "x@y.dk"}


@pytest.mark.parametrize(
    "attrs",
    [
        {},                                    # nichts gepflegt
        {"schlafzimmer": 0},                   # 0 ist keine Angabe
        {"schlafzimmer": 0.0},
        {"schlafzimmer": "zwei"},              # Text statt Zahl
        {"schlafzimmer": True},                # bool ist in Python ein int
        {"schlafzimmer": None},
    ],
)
def test_fehlender_wert_wird_nicht_erfunden(attrs: dict[str, Any]) -> None:
    """Ohne belastbaren Wert bleibt das Feld leer — kein Ersatzwert von uns."""
    dienst = _ZaehlerDienst(attrs)

    out = dienst._zimmerzahlen_ergaenzen(  # noqa: SLF001
        dienst._db_fake, "t-1", "prop-1",  # noqa: SLF001
        {"params": PARAMS_GOOGLE}, {},
    )

    assert "bedrooms_count" not in out


class _OhnePreisDienst(ChannelsMixin):
    """Objekt ohne Preisplan: `_selected_rate_plan_ids` schlaegt fehl."""

    def _rate_plan_maps_for_property(  # type: ignore[override]
        self, _db: Any, _t: str, _p: str
    ) -> list[str]:
        return []


def test_meldung_ohne_preis_nennt_bei_google_nicht_airbnb() -> None:
    """Der Airbnb-Weg gilt nur bei Airbnb — sonst schickt er ins Leere.

    Google zeigte bis 04.09.2026 „Rufe das Objekt unter Synchronisierung
    erneut bei Airbnb ab", und der Kunde suchte eine Airbnb-Funktion, die sein
    Objekt nichts angeht.
    """
    dienst = _OhnePreisDienst()

    with pytest.raises(ChannelManagerError) as exc:
        dienst._selected_rate_plan_ids(None, "t-1", "prop-1", GOOGLE)  # noqa: SLF001

    assert exc.value.status_code == 422
    assert "Airbnb" not in exc.value.message
    assert "Preise" in exc.value.message


def test_meldung_ohne_preis_nennt_bei_airbnb_den_abruf() -> None:
    """Gegenprobe: bei Airbnb bleibt der Hinweis auf den Abruf erhalten."""
    dienst = _OhnePreisDienst()

    with pytest.raises(ChannelManagerError) as exc:
        dienst._selected_rate_plan_ids(None, "t-1", "prop-1", "AirBNB")  # noqa: SLF001

    assert "Airbnb" in exc.value.message


def test_direkter_kanal_ohne_preis_verlangt_kein_zimmer() -> None:
    """Ein Kanal ohne Zimmer-Auswahl darf nicht nach einem Zimmer fragen.

    Der Kunde koennte der Aufforderung nicht folgen — es gibt keine Auswahl.
    """
    class _Dienst2(_Dienst):
        def _selected_rate_plan_ids(  # type: ignore[override]
            self, _db: Any, _t: str, _p: str, _portal: str | None = None
        ) -> list[str]:
            return []

    dienst = _Dienst2(SPEC_DIREKT, [])

    with pytest.raises(ChannelManagerError) as exc:
        dienst._build_rate_plans(  # noqa: SLF001
            None, "t-1", GOOGLE,
            mappings=[{"local_property_id": "prop-1"}],
            ota_rooms=[],
        )

    assert exc.value.status_code == 422
    assert "Zimmer zuordnen" not in exc.value.message
    assert "Preis" in exc.value.message


def test_durchgegebene_spec_spart_den_katalogabruf() -> None:
    """`_build_rate_plans` darf den Katalog nicht erneut holen.

    Jeder `_channel_spec` ist ein eigener `channels/list`-Aufruf (der Client
    cached nicht). Der Aufrufer hat die Spec bereits — sie durchzugeben spart
    eine HTTP-Runde je Verbinden-Klick.
    """
    class _ZaehlDienst(_Dienst):
        abrufe = 0

        def _channel_spec(self, code: str) -> dict[str, Any]:  # type: ignore[override]
            type(self).abrufe += 1
            return super()._channel_spec(code)

    dienst = _ZaehlDienst(SPEC_DIREKT, ["cx-grundpreis"])

    dienst._build_rate_plans(  # noqa: SLF001
        None, "t-1", GOOGLE,
        mappings=[{"local_property_id": "prop-1"}],
        ota_rooms=[], spec=SPEC_DIREKT,
    )
    assert _ZaehlDienst.abrufe == 0

    # Ohne Durchgabe holt er sie weiterhin selbst (finalize_oauth_channel).
    dienst._build_rate_plans(  # noqa: SLF001
        None, "t-1", GOOGLE,
        mappings=[{"local_property_id": "prop-1"}],
        ota_rooms=[],
    )
    assert _ZaehlDienst.abrufe == 1


def test_jeder_rueckgabeweg_von_connect_nennt_die_offenen_punkte() -> None:
    """BEIDE Wege aus `connect_channel` muessen `readiness_offen` tragen.

    Der zweite Weg ist der Idempotenz-Zweig (Wurzel 2) — und der ist bei einem
    Kanal, der wegen fehlender Angaben auf „Disabled" haengt, der Regelfall:
    der Betrieb klickt erneut, weil nichts passiert ist. Fehlte das Feld dort,
    bekaeme er beim zweiten Klick den Erfolgstext statt der Liste dessen, was
    fehlt — also wieder das stille Nichts.

    Statisch geprueft, weil `connect_channel` ohne echtes Channex-Konto nicht
    durchlaeuft: ein neuer Rueckgabeweg ohne das Feld fliegt so trotzdem auf.
    """
    quelle = inspect.getsource(ChannelsMixin.connect_channel)
    bloecke = re.findall(r"return \{\s*\n\s*\"id\":.*?\n\s*\}", quelle, re.S)

    assert len(bloecke) >= 2, "Rueckgabewege nicht erkannt — Muster pruefen"
    ohne = [b for b in bloecke if "readiness_offen" not in b]
    assert not ohne, f"Rueckgabeweg ohne readiness_offen: {ohne}"
