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
    from src.features.channel_manager.objekt_kanal import ObjektKanalMixin

    cx = _Channex(bestand)
    db = _Db(daten)

    class _Dienst(ObjektKanalMixin):
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
            "name": "Wochenrate",
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
        }
    ],
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
