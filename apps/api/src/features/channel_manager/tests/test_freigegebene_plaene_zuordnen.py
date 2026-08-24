"""Der Haken „an die Buchungsportale senden" muss den Plan auch dorthin bringen.

DIE ATTRAPPE (13.08.2026, an der Live-DB gezählt): `send_to_portals` wird nur von
`channels._selected_rate_plan_ids` gelesen, und die läuft AUSSCHLIESSLICH beim
Verbinden eines Kanals. Wer den Kanal schon verbunden hatte und danach einen
Preisplan mit Haken anlegte, bekam einen Channex-Rate-Plan mit Preisen, den kein
Portal liest — der Eintrag im `rate_plans`-Array des KANALS fehlte.

    Pläne mit send_to_portals = true    32
    davon bei Channex                    0

Alle 32 lagen bei Demo-Betrieben, die nie synchronisieren; beim echten Betrieb
hatte kein Objekt einen Zusatz-Plan. Der Weg war nie durchlaufen worden, deshalb
fiel es nicht auf. `connect_channel` half nicht: es kehrt bei bestehender
Verbindung früh zurück, bevor das Mapping neu gebaut wird.
"""

from __future__ import annotations

from typing import Any

from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.common import ChannelManagerError


class _Tabelle:
    """Nur so viel PostgREST, wie der Zuordnungslauf benutzt."""

    def __init__(self, daten: dict[str, list[dict[str, Any]]], name: str) -> None:
        self._daten = daten
        self._name = name
        self._filter: list[tuple[str, Any]] = []
        # `not_` ist beim echten Client ein Zustands-Umschalter für den NÄCHSTEN
        # Aufruf, keine eigene Abfrage. Ohne diese Unterscheidung filterte das
        # Double `not_.is_(x, "null")` als „IS NULL" — genau umgekehrt, und der
        # Kerntest schlug an, obwohl der Code stimmte.
        self._negiert = False

    def select(self, *_: str) -> _Tabelle:
        return self

    def eq(self, spalte: str, wert: Any) -> _Tabelle:  # noqa: ANN401 — Testdaten
        self._filter.append((spalte, wert))
        return self

    @property
    def not_(self) -> _Tabelle:
        self._negiert = True
        return self

    def is_(self, spalte: str, _wert: str) -> _Tabelle:
        marke = "is_not_null" if self._negiert else "is_null"
        self._negiert = False
        self._filter.append((f"{marke}:{spalte}", None))
        return self

    def limit(self, _n: int) -> _Tabelle:
        return self

    def execute(self) -> _Tabelle:
        zeilen = list(self._daten.get(self._name, []))
        for spalte, wert in self._filter:
            if spalte.startswith("is_null:"):
                feld = spalte.split(":", 1)[1]
                zeilen = [z for z in zeilen if z.get(feld) is None]
            elif spalte.startswith("is_not_null:"):
                feld = spalte.split(":", 1)[1]
                zeilen = [z for z in zeilen if z.get(feld) is not None]
            else:
                zeilen = [z for z in zeilen if z.get(spalte) == wert]
        self.data = zeilen  # noqa: B010 — Attribut wie beim echten Client
        return self


class _Db:
    def __init__(self, daten: dict[str, list[dict[str, Any]]]) -> None:
        self._daten = daten

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self._daten, name)


class _Channex:
    """Zeichnet auf, was zugeordnet würde — schickt nichts."""

    def __init__(self, bestand: list[dict[str, Any]]) -> None:
        self._bestand = bestand
        self.angelegt: list[tuple[str, str, dict[str, Any]]] = []
        self.geloest: list[tuple[str, str]] = []
        # Womit `mapping_details` aufgerufen wurde — je (channel, settings).
        # Aufgezeichnet, weil ein Aufruf, der nie gelingen kann, selbst der
        # Fehler ist (Airbnb-400 vom 24.08.2026): nur an der Aufzeichnung ist
        # zu pruefen, dass er AUSBLEIBT.
        self.details_aufrufe: list[tuple[str, dict[str, Any]]] = []

    def get_channel_mapping_details(
        self, *, channel: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        """Die Rate-TITEL, die das Portal fuehrt (Booking-Form).

        Der Stub fehlte hier ganz. Weil die Verbindungszeile zugleich ohne
        `ota_hotel_id` stand, brach `_portal_rate_titel` vor dem Aufruf ab und
        die Luecke fiel nicht auf — die Tests liefen gruen gegen leere Titel.
        """
        self.details_aufrufe.append((channel, settings))
        return {
            "data": {
                "rooms": [
                    {
                        "id": 1621321801,
                        "title": "Ferienhaus",
                        "rates": [
                            {"id": 64513248, "title": "Standard Rate"},
                            {"id": 65402734, "title": "Wochenrate"},
                        ],
                    }
                ]
            }
        }

    def get_channel(self, channel_id: str) -> dict[str, Any]:
        return {
            "data": {
                "id": channel_id,
                "attributes": {"rate_plans": self._bestand},
            }
        }

    def create_channel_mapping(
        self, channel_id: str, rate_plan_id: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        self.angelegt.append((channel_id, rate_plan_id, settings))
        return {"data": {"attributes": {"settings": settings}}}

    def delete_channel_mapping(
        self, channel_id: str, mapping_id: str
    ) -> dict[str, Any]:
        """Der Gegenzustand: das Paar von seinem alten Traeger loesen."""
        self.geloest.append((channel_id, mapping_id))
        return {}


def _dienst(
    daten: dict[str, list[dict[str, Any]]], bestand: list[dict[str, Any]]
) -> tuple[Any, _Channex]:
    """Den echten Mixin mit Test-Doubles bestücken."""
    from src.features.channel_manager.channels import ChannelsMixin
    from src.features.channel_manager.objekt_kanal import ObjektKanalMixin

    cx = _Channex(bestand)
    db = _Db(daten)

    # BEIDE Mixins, wie im echten Dienst: `_portal_rate_titel` nutzt
    # `_normalize_mapping_rooms` vom Schwester-Mixin.
    class _Dienst(ObjektKanalMixin, ChannelsMixin):
        _channex = cx

        def _require_db(self) -> Any:  # noqa: ANN401 — Test-Double
            return db

    return _Dienst(), cx


# Vollstaendig wie am Kanal (zurueckgelesen 23.08.2026): `occupancy`,
# `pricing_type`, `primary_occ`, `readonly` gehoeren dazu. Ein Ziel ohne diese
# Felder sendet am Kanal keine Restriktionen (siehe
# `portal_raten_plaene.paar_fuer_portal_plan`).
BOOKING_BESTAND: list[dict[str, Any]] = [
    {
        "id": "map-wochenrate",
        "rate_plan_id": "cx-grundpreis",
        "settings": {"room_type_code": 1621321801, "rate_plan_code": 65402734,
                     "occupancy": 6, "pricing_type": "Standard",
                     "primary_occ": True, "readonly": False},
    },
    {
        "id": "map-standard",
        "rate_plan_id": "cx-grundpreis",
        "settings": {"room_type_code": 1621321801, "rate_plan_code": 64513248,
                     "occupancy": 6, "pricing_type": "Standard",
                     "primary_occ": True, "readonly": False},
    },
]

DATEN: dict[str, list[dict[str, Any]]] = {
    "rate_plans": [
        {
            "id": "lokal-wochenrate",
            # BEWUSST KEIN Name einer Portal-Ratenkategorie. Vorher hiess dieser
            # Plan „Wochenrate" — und damit pruefte der Test das Gegenteil
            # dessen, was `paar_fuer_portal_plan` verlangt: ein Plan, der eine
            # Portal-Rate benennt, gehoert NUR ihr (sonst trueg Bookings
            # Standard-Rate den min_stay der Wochenrate). Der Fall „gilt fuer
            # JEDE Rate" ist der ZUSATZ-Plan, und der heisst nicht wie eine
            # Rate. Die rate-eigene Zuordnung haelt
            # `test_portal_raten_plan_zuordnung.py` fest.
            "name": "Frühbucher",
            "property_id": "prop-1",
            "send_to_portals": True,
            "portal_scope": None,
        },
        {
            "id": "lokal-grundpreis",
            "name": "Grundpreis",
            "property_id": "prop-1",
            "send_to_portals": False,
            "portal_scope": None,
        },
        {
            "id": "lokal-aufschlag",
            "name": "Grundpreis · BookingCom",
            "property_id": "prop-1",
            "send_to_portals": True,
            "portal_scope": "BookingCom",  # Kanal-Plan: gehört NICHT hierher
        },
    ],
    "channex_channel_connection": [
        {
            "channex_channel_id": "kanal-booking",
            "ota_portal_code": "BookingCom",
            "tenant_id": "t-1",
            "property_id": "prop-1",
            # `ota_hotel_id` gehoert dazu, sonst ist die Zeile ein Zustand, den
            # es live nicht gibt: `_persist_connection` (channels.py) kehrt ohne
            # Hotel-ID FRUEH zurueck und schreibt gar keine Zeile. Ohne das Feld
            # brach `_portal_rate_titel` schon am ersten Guard ab, die
            # Rate-Titel blieben leer — und der Test pruefte damit unbemerkt den
            # blinden Fall statt den echten Booking-Weg.
            "ota_hotel_id": "226976381",
        }
    ],
    # OHNE Airbnb-Kennung: das ist der Booking-Normalfall, auf dem die
    # meisten Tests hier stehen (u. a.
    # `test_kanal_ohne_zuordenbare_rate_haelt_den_lauf_nicht_auf`, dessen
    # ganzer Sinn ein Objekt ohne diese Kennung ist). Die Airbnb-Tests
    # setzen sie ueber `_daten_airbnb()` gezielt dazu.
    "properties": [{"id": "prop-1", "airbnb_listing_id": None}],
    "channex_rate_plan_map": [
        {
            "local_rate_plan_id": "lokal-wochenrate",
            "channex_rate_plan_id": "cx-wochenrate",
            "tenant_id": "t-1",
            "deleted_at": None,
        },
        # Der Kanal-Plan ist bei Channex ebenfalls registriert. Ohne diese Zeile
        # fiel er im Test nur deshalb heraus, weil er keine Channex-ID hatte —
        # der `portal_scope`-Filter wäre ungeprüft geblieben (Umkehrprobe: ihn zu
        # entfernen liess alle Tests grün).
        {
            "local_rate_plan_id": "lokal-aufschlag",
            "channex_rate_plan_id": "cx-aufschlag",
            "tenant_id": "t-1",
            "deleted_at": None,
        },
    ],
}


def test_freigegebener_plan_wird_an_allen_raten_zugeordnet() -> None:
    """Der Kern: Haken gesetzt → Plan landet an JEDER Rate des Portals."""
    dienst, cx = _dienst(DATEN, BOOKING_BESTAND)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert ergebnis["zugeordnet"] == 1
    assert len(cx.angelegt) == 2, (
        "Booking führt zwei Raten (Standard + Wochenrate) — beide brauchen die "
        "Zuordnung, sonst verkauft eine weiter zum alten Preis."
    )
    codes = sorted(s["rate_plan_code"] for _, _, s in cx.angelegt)
    assert codes == [64513248, 65402734]
    assert all(rp == "cx-wochenrate" for _, rp, _ in cx.angelegt)
    # Gegenzustand (Wurzel 1): jedes Paar wird VORHER von seinem alten Traeger
    # geloest. Ohne das haette jedes Paar zwei primaere Eintraege, und Channex
    # laesst dann den ALTEN gewinnen (live gemessen an „FeWo *Stjerneskud*").
    assert sorted(m for _, m in cx.geloest) == ["map-standard", "map-wochenrate"]


def test_kanal_plan_wird_nicht_mitgemappt() -> None:
    """`portal_scope`-Pläne sind der Aufschlag, kein Verkaufsplan.

    Sie haben ihren eigenen Weg (`set_portal_price_adjustment`). Liefen sie hier
    mit, ersetzten sie den Grundpreis am Kanal — mit einem Aufschlag von 0 % also
    grundlos.
    """
    dienst, cx = _dienst(DATEN, BOOKING_BESTAND)
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    assert all(rp != "cx-aufschlag" for _, rp, _ in cx.angelegt)


def test_plan_ohne_haken_bleibt_draussen() -> None:
    """Ohne Haken geht nichts ans Portal — der Haken ist die Freigabe."""
    dienst, cx = _dienst(DATEN, BOOKING_BESTAND)
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    assert all(rp != "cx-grundpreis" for _, rp, _ in cx.angelegt)


def test_schon_zugeordnet_wird_nicht_erneut_angelegt() -> None:
    """Idempotenz (Wurzel 2): ein zweiter Lauf darf keinen 422 auslösen."""
    bestand = [
        *BOOKING_BESTAND,
        {
            "id": "map-wochenrate-neu",
            "rate_plan_id": "cx-wochenrate",
            "settings": {"room_type_code": 1621321801, "rate_plan_code": 65402734,
                         "occupancy": 6, "pricing_type": "Standard",
                         "primary_occ": True, "readonly": False},
        },
    ]
    dienst, cx = _dienst(DATEN, bestand)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    assert cx.angelegt == []
    assert ergebnis["zugeordnet"] == 0
    # Und der Gegenzustand loescht nichts: der Plan ist schon am Kanal, es gibt
    # keinen fremden Traeger zu loesen (Wurzel 2).
    assert cx.geloest == []


def test_ohne_freigegebene_plaene_kein_kanal_abruf() -> None:
    """Kein Haken irgendwo → gar kein Channex-Aufruf (kein Budget verbrennen)."""
    daten = {**DATEN, "rate_plans": [
        {"id": "x", "property_id": "prop-1", "send_to_portals": False,
         "portal_scope": None},
    ]}
    dienst, cx = _dienst(daten, BOOKING_BESTAND)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    assert ergebnis == {"geprueft": 0, "zugeordnet": 0}
    assert cx.angelegt == []


def test_ohne_verbundenen_kanal_passiert_nichts() -> None:
    """Ein Objekt ohne Kanal hat nichts zuzuordnen — und wirft deswegen nicht."""
    daten = {**DATEN, "channex_channel_connection": []}
    dienst, cx = _dienst(daten, BOOKING_BESTAND)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    assert ergebnis["zugeordnet"] == 0
    assert cx.angelegt == []


def test_kanal_ohne_zuordenbare_rate_haelt_den_lauf_nicht_auf() -> None:
    """Ein leerer Kanal ohne Airbnb-Kennung ist übergehbar, kein Abbruch.

    Der Lauf hängt am Content-Sync — er darf ihn nicht kippen (Wurzel 5).
    """
    dienst, cx = _dienst(DATEN, [])  # Kanal ohne jede Rate
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    assert ergebnis["zugeordnet"] == 0
    assert cx.angelegt == []


def test_plan_ohne_channex_id_wird_uebersprungen() -> None:
    """Ein Plan, den Channex nicht kennt, kann nicht gemappt werden.

    Das ist der Zustand direkt nach dem Insert und vor dem Content-Sync — er darf
    keinen Fehler erzeugen, sondern beim nächsten Lauf nachgezogen werden.
    """
    daten = {**DATEN, "channex_rate_plan_map": []}
    dienst, cx = _dienst(daten, BOOKING_BESTAND)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    assert ergebnis["zugeordnet"] == 0
    assert cx.angelegt == []


def test_fehler_eines_kanals_stoppt_die_anderen_nicht() -> None:
    """Ein ablehnendes Portal darf die übrigen nicht mitnehmen."""
    dienst, cx = _dienst(DATEN, BOOKING_BESTAND)

    def _wirft(*_: object, **__: object) -> dict[str, Any]:
        raise ChannelManagerError("Portal lehnt ab.", status_code=422)

    cx.create_channel_mapping = _wirft  # type: ignore[assignment]
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    assert ergebnis["zugeordnet"] == 0  # kein Absturz, klar gezählt


# Airbnb-Bestand am Kanal: der Schluessel ist die `listing_id`, und es gibt
# WEDER `room_type_code`/`rate_plan_code` NOCH Belegung — statt ihrer fuehrt
# Airbnb seine eigenen Bloecke (`pricing_setting`, `availability_rule`).
# Deshalb ist ein Listing-Eintrag aus sich heraus vollwertig
# (`_eintrag_ist_vollwertig`), und deshalb gibt es dort keine Rate-Titel.
AIRBNB_BESTAND: list[dict[str, Any]] = [
    {
        "id": "map-listing",
        "rate_plan_id": "cx-grundpreis",
        "settings": {"listing_id": "54087677", "pricing_setting": {}},
    },
]


def _daten_airbnb() -> dict[str, list[dict[str, Any]]]:
    """Dasselbe Objekt, aber an einem AIRBNB-Kanal.

    Airbnb ist ein OAuth-Portal: die Verbindungszeile traegt zwar eine
    `ota_hotel_id` (der Host, aus den Tokens nachgetragen), aber `hotel_id` ist
    KEIN Airbnb-Settings-Feld — genau daran scheiterte der Live-Aufruf mit 400.
    """
    return {
        **DATEN,
        "properties": [{"id": "prop-1", "airbnb_listing_id": "54087677"}],
        "channex_channel_connection": [
            {
                "channex_channel_id": "kanal-airbnb",
                "ota_portal_code": "AirBNB",
                "tenant_id": "t-1",
                "property_id": "prop-1",
                "ota_hotel_id": "226976381",
            }
        ],
    }


def _daten_mit_portal_rate() -> dict[str, list[dict[str, Any]]]:
    """Wie DATEN, aber der freigegebene Plan heisst wie eine PORTAL-Rate.

    Das ist der Fall, um den es bei den Titeln ueberhaupt geht: nur ein Plan,
    der eine Portal-Rate benennt, gehoert ihr allein.
    """
    return {
        **DATEN,
        "rate_plans": [
            {**p, "name": "Wochenrate"} if p["id"] == "lokal-wochenrate" else p
            for p in DATEN["rate_plans"]
        ],
    }


def test_airbnb_kanal_fragt_keine_rate_titel_ab() -> None:
    """DER GEMESSENE FEHLER (24.08.2026, „FeWo *Stjerneskud*").

    Live lief bei jedem Content-Sync eines Airbnb-Objekts
        POST channels/mapping_details
        {"channel":"AirBNB","settings":{"hotel_id":"226976381"}}  -> HTTP 400
    Der Aufruf kann strukturell nie gelingen: `hotel_id` ist kein Airbnb-Feld
    (Channex-Doku: „There is no `hotel_id` field — Airbnb uses `listing_id`
    instead"), und Airbnb hat gar keine Raten-EBENE, deren Titel zu holen waeren
    („Airbnb allows you to map only 1 rate plan"). Er kostete damit bei jedem
    Sync Channex-Kontingent und schrieb eine Fehlerzeile in den Verlauf des
    Betriebs, wo sie echte Fehler unauffindbar macht.

    Geprueft wird das AUSBLEIBEN des Aufrufs — nur daran ist es zu sehen.
    """
    dienst, cx = _dienst(_daten_airbnb(), AIRBNB_BESTAND)
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert cx.details_aufrufe == [], (
        "Fuer einen Airbnb-Kanal darf `mapping_details` nicht gefragt werden — "
        f"gefragt wurde aber: {cx.details_aufrufe}"
    )


def test_airbnb_zusatzplan_wird_trotzdem_zugeordnet() -> None:
    """Das Ueberspringen darf die Zuordnung nicht mitnehmen.

    Airbnb bekommt keine Rate-Titel mehr (Test oben) — ein Zusatz-Plan muss
    seinen Weg an die Anzeige aber behalten. Sonst haette das Schliessen des
    400 die Funktion gekostet, die der Lauf ueberhaupt hat.
    """
    dienst, cx = _dienst(_daten_airbnb(), AIRBNB_BESTAND)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert ergebnis["zugeordnet"] == 1
    assert [rp for _, rp, _ in cx.angelegt] == ["cx-wochenrate"]


def test_booking_kanal_fragt_die_rate_titel_weiter_ab() -> None:
    """Die Gegenprobe: ein Portal MIT Raten-Ebene wird nicht mitgesperrt.

    Booking fuehrt mehrere Raten je Zimmer, und nur ihre Titel verbinden einen
    Portal-Raten-Plan mit seiner Rate. Faellt dieser Abruf aus, ist der Fix zu
    breit geraten.
    """
    dienst, cx = _dienst(_daten_mit_portal_rate(), BOOKING_BESTAND)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert cx.details_aufrufe == [("BookingCom", {"hotel_id": "226976381"})]
    # Und der Plan landet NUR auf seiner eigenen Rate (nicht auf der Standard).
    assert ergebnis["zugeordnet"] == 1
    codes = [s["rate_plan_code"] for _, _, s in cx.angelegt]
    assert codes == [65402734]


def test_ohne_titel_bleibt_ein_portal_raten_plan_unzugeordnet() -> None:
    """FAIL-CLOSED (Wurzel 4/5) — der Folgefehler hinter dem 400.

    Faellt der Titel-Abruf aus, ist `titel_je_code` leer und die Namensprobe
    BLIND. Vorher hiess das Ergebnis dann `None` = „kein Portal-Raten-Plan" =
    ALLE Paare des Zimmers: der Wochen-Plan mit min_stay 7 laege auch auf
    Bookings Standard-Rate, die dann erst ab sieben Naechten verkauft. Genau der
    Schaden, den `paar_fuer_portal_plan` als den groesseren ausrechnet.
    Unwissen ist keine Freigabe — ohne Titel wird gar nicht zugeordnet.
    """
    dienst, cx = _dienst(_daten_mit_portal_rate(), BOOKING_BESTAND)

    def _wirft(**_: object) -> dict[str, Any]:
        raise ChannexError("mapping_details nicht verfuegbar")

    cx.get_channel_mapping_details = _wirft  # type: ignore[assignment]
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert ergebnis["zugeordnet"] == 0
    assert cx.angelegt == [], (
        "Ohne Rate-Titel darf ein Portal-Raten-Plan NICHT auf alle Raten des "
        f"Zimmers gelegt werden — angelegt wurde aber: {cx.angelegt}"
    )
