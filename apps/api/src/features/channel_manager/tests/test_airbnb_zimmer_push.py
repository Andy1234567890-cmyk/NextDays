"""Zimmer-Rückweg zu Airbnb: der Diff, der den gemeldeten Fehler verhindert.

Die Beispieldaten sind live gemessen (05.08.2026, „Holiday house Cornflower",
Listing 1675950565421151420). Der Fehler, den diese Tests festnageln:

  * Der Betrieb löschte in unserer Maske den Balkon → unsere DB 7 Zimmer ohne
    Balkon, Airbnb weiter 9 Räume MIT `balcony` (ID 792924440).
  * Er fügte ihn über unsere Maske wieder hinzu → unsere DB `balkon` um
    14:44:47, Airbnb unverändert 8 Räume OHNE `balcony`.

Beides ohne Fehlermeldung, weil nie etwas an Airbnb gesendet wurde.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from src.features.channel_manager.airbnb_listing_import import AIRBNB_RAUM_AUF_SLUG
from src.features.channel_manager.airbnb_zimmer_push import (
    SLUG_AUF_AIRBNB_RAUM,
    AirbnbZimmerPushMixin,
    _ist_stand,
    zimmer_diff,
)

# Airbnbs Räume von Cornflower, wie `GET v2/listing_rooms` sie geliefert hat.
AIRBNB_RAEUME = [
    {"id": "792022805", "room_type": "bedroom", "is_private": True},
    {"id": "792022806", "room_type": "bedroom", "is_private": True},
    {"id": "792022808", "room_type": "full_bathroom", "is_private": True},
    {"id": "792924434", "room_type": "exterior", "is_private": True},
    {"id": "792924436", "room_type": "patio", "is_private": True},
    {"id": "792924437", "room_type": "dining_room", "is_private": True},
    {"id": "792924438", "room_type": "kitchen", "is_private": True},
    {"id": "792924439", "room_type": "living_room", "is_private": True},
    {"id": "792924440", "room_type": "balcony", "is_private": True},
]

# Unsere sieben Zimmer nach dem Löschen des Balkons.
UNSER_STAND_OHNE_BALKON = {
    "schlafzimmer": 2, "badezimmer": 1, "esszimmer": 1,
    "kueche": 1, "wohnzimmer": 1, "terrasse": 1,
}


def test_geloeschter_balkon_wird_bei_airbnb_geloescht() -> None:
    """DER gemeldete Fehler: die Löschung muss bei Airbnb ankommen.

    Ein Diff, der nur über unseren Soll-Stand läuft, sieht den Balkon gar nicht
    — er steht in keiner unserer Zeilen. Deshalb geht der Diff über die
    VEREINIGUNG beider Seiten.
    """
    anlegen, loeschen = zimmer_diff(
        UNSER_STAND_OHNE_BALKON, _ist_stand(AIRBNB_RAEUME)
    )
    assert loeschen == ["792924440"]
    assert anlegen == []


def test_hinzugefuegter_balkon_wird_bei_airbnb_angelegt() -> None:
    """Die zweite Richtung: der Betrieb hakt den Balkon an, Airbnb hat keinen."""
    ohne_balkon = [r for r in AIRBNB_RAEUME if r["room_type"] != "balcony"]
    soll = {**UNSER_STAND_OHNE_BALKON, "balkon": 1}
    anlegen, loeschen = zimmer_diff(soll, _ist_stand(ohne_balkon))
    assert anlegen == ["balkon"]
    assert loeschen == []


def test_gleichstand_sendet_nichts() -> None:
    """Kein Unterschied → kein Fremdaufruf (Wurzel 2)."""
    soll = {**UNSER_STAND_OHNE_BALKON, "balkon": 1}
    assert zimmer_diff(soll, _ist_stand(AIRBNB_RAEUME)) == ([], [])


def test_fremde_raumarten_werden_nicht_geloescht() -> None:
    """`exterior` hat keinen Slug in unserer Liste und darf nicht verschwinden.

    Der Import überspringt ihn bewusst — der Gastgeber sieht ihn bei uns nie.
    Ihn zu löschen hieße, ihm ungefragt einen Raum aus der Anzeige zu nehmen.
    """
    ist = _ist_stand(AIRBNB_RAEUME)
    assert "792924434" not in [x for ids in ist.values() for x in ids]
    _anlegen, loeschen = zimmer_diff(
        {**UNSER_STAND_OHNE_BALKON, "balkon": 1}, ist
    )
    assert "792924434" not in loeschen


def test_mehrfaches_zimmer_zaehlt_stueckweise() -> None:
    """Aus zwei Schlafzimmern eines machen: genau EINES wird gelöscht."""
    soll = {**UNSER_STAND_OHNE_BALKON, "schlafzimmer": 1, "balkon": 1}
    anlegen, loeschen = zimmer_diff(soll, _ist_stand(AIRBNB_RAEUME))
    assert anlegen == []
    assert len(loeschen) == 1
    assert loeschen[0] in {"792022805", "792022806"}


def test_drittes_schlafzimmer_wird_angelegt() -> None:
    """Und die Gegenrichtung: eines mehr bei uns → eines anlegen."""
    soll = {**UNSER_STAND_OHNE_BALKON, "schlafzimmer": 3, "balkon": 1}
    anlegen, loeschen = zimmer_diff(soll, _ist_stand(AIRBNB_RAEUME))
    assert anlegen == ["schlafzimmer"]
    assert loeschen == []


def test_slug_ohne_airbnb_entsprechung_wird_nicht_geraten() -> None:
    """Ein Slug, den Airbnbs Vokabular nicht kennt, wird NICHT angelegt.

    Wurzel 4: lieber nichts senden als einen plausibel klingenden Raumtyp
    erfinden, den Airbnb dann ablehnt oder falsch einordnet.
    """
    anlegen, loeschen = zimmer_diff({"erfundenes_zimmer": 1}, {})
    assert anlegen == []
    assert loeschen == []


def test_jeder_airbnb_raumtyp_ist_ein_echter_wert() -> None:
    """Die Rückrichtung darf nur Werte senden, die der Import auch kennt.

    Beide Tabellen stammen aus Airbnbs Vokabular; ein Tippfehler hier würde
    live erst beim Schreibversuch auffallen.
    """
    for slug, airbnb_art in SLUG_AUF_AIRBNB_RAUM.items():
        assert AIRBNB_RAUM_AUF_SLUG.get(airbnb_art) == slug, (
            f"{slug} → {airbnb_art} ist keine saubere Umkehrung"
        )


# Airbnbs API-`room_type`-Werte, live gemessen über alle 18 Anzeigen des Kontos
# (`GET v2/listing_rooms`, 05.08.2026, 157 Räume). NICHT die UI-Labels aus
# „Choose a room or space" — die weichen für dieselben Räume ab (Dining area →
# dining_room, Full kitchen → kitchen, Laundry area → laundry_room).
API_RAUMARTEN_GEMESSEN = {
    "bedroom", "full_bathroom", "living_room", "exterior", "dining_room",
    "kitchen", "laundry_room", "patio", "deck", "garden", "sunroom",
    "game_room", "workspace",
}


def test_sendewerte_sind_gemessene_api_werte() -> None:
    """Jeder Sende-Wert muss aus der API-Messung stammen — oder aus Airbnbs
    Auswahlliste, wenn die Art im Konto (noch) nicht vorkommt.

    Der Test hält die Verwechslung fest, die hier fast passiert wäre: Airbnbs
    Extranet-Dropdown zeigt „Dining area"/„Full kitchen"/„Laundry area", die API
    liefert für DIESELBEN Raum-IDs `dining_room`/`kitchen`/`laundry_room`. Wer die
    Tabelle nach der UI-Liste umschreibt, sendet Werte, die der Import nicht
    zurücklesen kann — der nächste Abgleich hielte den Raum für unbekannt und
    legte ihn erneut an (Endlos-Duplikate).
    """
    # Im Konto nicht vorhanden, aber in Airbnbs Auswahlliste belegt.
    aus_auswahlliste = {"balcony", "half_bathroom"}
    erlaubt = API_RAUMARTEN_GEMESSEN | aus_auswahlliste
    for slug, art in SLUG_AUF_AIRBNB_RAUM.items():
        assert art in erlaubt, f"{slug} → {art} ist weder gemessen noch belegt"


def test_kein_unbelegter_sendewert() -> None:
    """`sleeping_area` darf NICHT zurück: 0× in der API-Messung und nicht in
    Airbnbs Auswahlliste (40 Einträge). Ein Sende-Wert ohne Beleg ist geraten
    (Wurzel 4) — im Import ist so ein Eintrag harmlos, beim Schreiben nicht.
    """
    assert "sleeping_area" not in SLUG_AUF_AIRBNB_RAUM.values()
    assert "schlafbereich" not in SLUG_AUF_AIRBNB_RAUM


def test_anlegen_schickt_flachen_payload() -> None:
    """Der Payload ist FLACH — keine `listing_room`-Hülle.

    Ursache von drei Fehlversuchen am Live-Listing (05.08.2026). Gemessen durch
    Weglassen von `room_type`, damit nichts angelegt werden kann und nur der
    Validator antwortet:

        {"listing_id": …}                   → 422 room_type is required.
        {"listing_room": {"listing_id": …}} → 422 listing_id is required.

    „room_type is required" beweist, dass die Kennung ankommt. Die Hülle ist
    naheliegend (die Leseantwort gruppiert unter `listing_rooms[]`), aber falsch.
    """
    from src.features.channel_manager.channex_airbnb_actions import (
        AirbnbActionsMixin,
    )

    gesehen: dict[str, object] = {}

    class _Client(AirbnbActionsMixin):
        def post(self, pfad: str, *, json: dict) -> dict:  # noqa: A002
            gesehen["pfad"] = pfad
            gesehen["request"] = json["request"]
            return {}

    _Client().create_airbnb_listing_room("ch-1", "listing-9", "balcony", privat=True)
    anfrage = gesehen["request"]
    assert anfrage["method"] == "post"
    assert anfrage["endpoint"] == "listing_rooms"
    # `params` bleibt leer: die Doku nennt es „GET Arguments".
    assert anfrage["params"] == {}
    # FLACH, keine Hülle — genau das war der Fehler.
    assert anfrage["payload"] == {
        "listing_id": "listing-9",
        "room_type": "balcony",
        "is_private": True,
    }


def test_loeschen_nutzt_pfad_mit_raum_id() -> None:
    """Die Raum-ID gehört in den Pfad, die Kennung flach in den Payload.

    ACHTUNG: diesen Weg gibt es bei Channex NICHT — alle vier gemessenen Formen
    antworten 422 `Route not found` (05.08.2026, mit erfundener Raum-ID
    gemessen). Der Test hält die Aufrufform fest, damit der Fehlschlag
    reproduzierbar bleibt und nicht als Tippfehler missdeutet wird.
    """
    from src.features.channel_manager.channex_airbnb_actions import (
        AirbnbActionsMixin,
    )

    gesehen: dict[str, object] = {}

    class _Client(AirbnbActionsMixin):
        def post(self, pfad: str, *, json: dict) -> dict:  # noqa: A002
            gesehen["request"] = json["request"]
            return {}

    _Client().delete_airbnb_listing_room("ch-1", "listing-9", "raum-7")
    anfrage = gesehen["request"]
    assert anfrage["method"] == "delete"
    assert anfrage["endpoint"] == "listing_rooms/raum-7"
    assert anfrage["params"] == {}
    assert anfrage["payload"] == {"listing_id": "listing-9"}


def test_frontend_und_backend_kennen_dieselben_lokalen_zimmer() -> None:
    """`ZIMMER_NUR_LOKAL` (Frontend) = was in `SLUG_AUF_AIRBNB_RAUM` fehlt.

    Zwei Listen, eine Wahrheit: die Maske schreibt „Bleibt bei myNextDays" unter
    eine Zeile, der Push entscheidet über dieselbe Frage neu. Driften sie
    auseinander, verspricht die Oberfläche etwas, das nicht passiert — oder
    verschweigt, dass ein Zimmer liegen bleibt.

    Live gemessen (05.08.2026): alle Arten außer `schlafbereich` laufen durch
    Airbnbs Validator; `sleeping_area` gibt es weder in der API-Messung noch in
    Airbnbs Auswahlliste.
    """
    import re
    from pathlib import Path

    quelle = (
        Path(__file__).resolve().parents[6] / "web" / "lib" / "property-meta.ts"
    ).read_text(encoding="utf-8")

    def _menge(name: str) -> set[str]:
        block = re.search(
            rf"export const {name}[^=]*= new Set\(\[(.*?)\]\)", quelle, re.S
        )
        assert block, f"{name} nicht in property-meta.ts gefunden"
        return set(re.findall(r'"([^"]+)"', block.group(1)))

    def _liste(name: str) -> set[str]:
        block = re.search(rf"export const {name} = \[(.*?)\] as const", quelle, re.S)
        assert block, f"{name} nicht in property-meta.ts gefunden"
        return set(re.findall(r'"([^"]+)"', block.group(1)))

    ohne_airbnb = _liste("ZIMMER_SLUGS") - set(SLUG_AUF_AIRBNB_RAUM)
    assert _menge("ZIMMER_NUR_LOKAL") == ohne_airbnb


# --- Räume ohne Foto -----------------------------------------------------
# Airbnb blendet die GESAMTE Photo tour aus, sobald ein Raum kein Foto hat
# („Guests only see your photo tour if every room has a photo"). Live so
# passiert: der neu angelegte Balkon hatte kein Bild, und die Tour war weg.
#
# WELCHE QUELLE ZÄHLT: der Foto-Stand kommt DIREKT von Airbnb, nicht aus
# unserer Cache-Tabelle `airbnb_foto_raum`. Die war live leer (16 Fotos
# importiert, bevor es sie gab) — und die Meldung führte daraufhin JEDES Zimmer
# als fotolos auf. Nicht-Wissen ist kein Befund (Wurzel 4).


def _stand_ohne_foto(raeume: list[dict], belegt: list[str]) -> list[str]:
    """`_airbnb_raeume_ohne_foto` mit ersetztem Airbnb-Lesepfad."""
    from src.features.channel_manager.airbnb_zimmer_push import (
        AirbnbZimmerPushMixin,
    )

    class _Mixin(AirbnbZimmerPushMixin):
        @staticmethod
        def _airbnb_listing_id(_db: object, _pid: str) -> str:
            return "listing-1"

        @staticmethod
        def _airbnb_kanal_des_betriebs(
            _db: object, _tid: str, _pid: str | None = None
        ) -> str:
            return "ch-1"

        @staticmethod
        def _airbnb_token(
            _db: object, _tid: str, _pid: str | None = None
        ) -> tuple[str, str]:
            return ("token", "user")

        def _airbnb_raeume_lesen(self, _c: str, _l: str) -> list[dict]:
            return raeume

        def airbnb_fotos_direkt(self, _t: str, _l: str) -> list[dict]:
            return [{"airbnb_photo_id": f"p-{i}", "airbnb_room_id": r}
                    for i, r in enumerate(belegt)]

    return _Mixin()._airbnb_raeume_ohne_foto(None, "t-1", "p-1")  # noqa: SLF001


def test_raum_ohne_foto_wird_gemeldet() -> None:
    """Der Balkon ohne Bild — genau der live aufgetretene Fall."""
    raeume = [
        {"id": "792022805", "room_type": "bedroom"},
        {"id": "817240083", "room_type": "balcony"},
    ]
    assert _stand_ohne_foto(raeume, ["792022805"]) == ["balkon"]


def test_alle_raeume_belegt_meldet_nichts() -> None:
    """Kein fehlendes Foto → keine Meldung (Wurzel 2: keine Dauerwarnung)."""
    raeume = [{"id": "792022805", "room_type": "bedroom"}]
    assert _stand_ohne_foto(raeume, ["792022805"]) == []


def test_raum_ohne_slug_zaehlt_trotzdem() -> None:
    """`exterior` hat keinen Slug — Airbnb verlangt trotzdem ein Foto.

    Ihn zu überspringen hieße, die Warnung zu verschweigen, während Airbnb die
    Tour weiter versteckt. Ohne Slug steht Airbnbs Rohwert in der Meldung.
    """
    raeume = [{"id": "792924434", "room_type": "exterior"}]
    assert _stand_ohne_foto(raeume, []) == ["exterior"]


def test_rest_nennt_das_zimmer_das_bei_airbnb_bleibt() -> None:
    """Was das Minus NICHT wegbekommt, muss die Oberfläche benennen können.

    Airbnb hat keinen Löschweg für Räume (16 Formen gemessen). Bei uns ist das
    Zimmer sofort weg, dort bleibt es stehen — ohne diese Liste sähe der Betrieb
    nur eine stimmige Anzeige und einen falschen Stand beim Portal.
    """
    raeume = [
        {"id": "792022805", "room_type": "bedroom"},
        {"id": "792924436", "room_type": "patio"},
    ]
    # Unser Soll kennt die Terrasse nicht mehr.
    _anlegen, rest = zimmer_diff({"schlafzimmer": 1}, _ist_stand(raeume))
    assert rest == ["792924436"]


def test_rest_ist_leer_bei_gleichstand() -> None:
    """Kein Rest → die Oberfläche darf keine Warnung zeigen (Wurzel 2)."""
    raeume = [{"id": "792022805", "room_type": "bedroom"}]
    _anlegen, rest = zimmer_diff({"schlafzimmer": 1}, _ist_stand(raeume))
    assert rest == []


def test_ohne_foto_stand_wird_nichts_gemeldet() -> None:
    """Der gemeldete Fehlalarm: leerer Stand ≠ „kein Zimmer hat ein Foto".

    Live gab es 16 Fotos an neun Räumen, unsere Cache-Tabelle war aber leer —
    und die Meldung listete jedes Zimmer auf. Ist der Foto-Stand nicht lesbar,
    ist die richtige Antwort Schweigen, nicht eine erfundene Vollmeldung.
    """
    from src.features.channel_manager.airbnb_zimmer_push import (
        AirbnbZimmerPushMixin,
    )

    class _OhneToken(AirbnbZimmerPushMixin):
        @staticmethod
        def _airbnb_listing_id(_db: object, _pid: str) -> str:
            return "listing-1"

        @staticmethod
        def _airbnb_kanal_des_betriebs(
            _db: object, _tid: str, _pid: str | None = None
        ) -> str:
            return "ch-1"

        @staticmethod
        def _airbnb_token(
            _db: object, _tid: str, _pid: str | None = None
        ) -> None:
            return None

        def _airbnb_raeume_lesen(self, _c: str, _l: str) -> list[dict]:
            return [
                {"id": "792022805", "room_type": "bedroom"},
                {"id": "817240083", "room_type": "balcony"},
            ]

    assert _OhneToken()._airbnb_raeume_ohne_foto(None, "t-1", "p-1") == []  # noqa: SLF001


# --- Empfaenger der Glocke = RECEIVE_SYSTEM_ALERTS (07.09.2026) --------------


def test_glocke_erreicht_auch_den_co_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    """Bis 07.09.2026 ging die Meldung nur an `role = 'admin'`. Der Co-Admin,
    dem §4.1 die System-Warnungen zuspricht, erfuhr nichts."""
    from src.features.notification_settings import dispatcher as disp_mod

    gesendet: list[dict] = []

    class _Dispatcher:
        def __init__(self, _db: object) -> None:
            pass

        def sende(self, **kw: object) -> None:
            gesendet.append(kw)

    monkeypatch.setattr(disp_mod, "NotificationDispatcher", _Dispatcher)

    class _Chain:
        def __init__(self, rows: list[dict]) -> None:
            self._rows = rows

        def __getattr__(self, _n: str) -> _Chain:
            return self

        def __call__(self, *_a: object, **_k: object) -> _Chain:
            return self

        def execute(self) -> SimpleNamespace:
            return SimpleNamespace(data=self._rows)

    class _DB:
        def table(self, name: str) -> _Chain:
            if name == "users":
                return _Chain([
                    {"id": "chef", "role": "admin", "tenant_id": "t-1"},
                    {"id": "vize", "role": "co_admin", "tenant_id": "t-1"},
                    {"id": "putz", "role": "cleaner", "tenant_id": "t-1"},
                ])
            return _Chain([{"title": "Haus"}])

    # Der Chain-Stub filtert nicht selbst — die Rollen-Eingrenzung passiert im
    # `in_("role", …)` der echten DB. Hier wird nachgestellt, was diese Eingrenzung
    # liefert, indem der Filter des Empfaenger-Helfers gegen die Zeilen laeuft.
    from src.features.notification_settings import ereignisse

    def _empfaenger(db: object, _tid: str) -> set[str]:
        rows = db.table("users").execute().data
        return {r["id"] for r in rows if r["role"] in ereignisse._ZUSTELL_ROLLEN}

    monkeypatch.setattr(ereignisse, "system_warnungs_empfaenger", _empfaenger)

    AirbnbZimmerPushMixin()._an_die_glocke(  # noqa: SLF001
        _DB(), "t-1", "p-1",
        betreff_key="airbnb.zimmer_ohne_foto", text_key="airbnb.rumpf_ohne_foto",
        anzahl=1, raeume="balkon", ziel_pfad="/objekte/p-1/fotos",
        dedup_key="airbnb_foto_fehlt:p-1",
    )
    assert {g["user_id"] for g in gesendet} == {"chef", "vize"}
