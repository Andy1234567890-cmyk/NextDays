"""Tests für die Schloss-Anbindung (0573).

Geprüft werden die Stellen, an denen ein Fehler NICHT auffällt, sondern still
falsch wird:

* Der Widerruf eines OFFLINE-Codes darf nie „widerrufen" melden. Das ist der
  wichtigste Test der Datei — genau hier entsteht sonst die stille
  Falschaussage aus Wurzel 5b: das PMS zeigt „zurückgezogen", der Code öffnet
  weiter die Tür.
* Rundung nach oben beim Ende, nach unten beim Beginn: ein Gast darf nie
  einen Code bekommen, der KÜRZER gilt als sein Aufenthalt.
* Idempotenz (Wurzel 2): derselbe `reservation_key` erzeugt keinen zweiten
  Grant — bei igloohome sind pro Tag nur drei PINs möglich.
* Fehlende Konfiguration schlägt SICHTBAR fehl statt stumm zu bleiben.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from src.features.affiliates.tests.fakedb import FakeDb
from src.features.schloesser.seam_client import (
    SeamClient,
    SeamNichtKonfiguriert,
    SeamZugang,
)
from src.features.schloesser.service import (
    SchloesserFehler,
    SchloesserService,
    als_ortszeit,
    als_zeitpunkt,
    objekt_zone,
    uhrzeit,
)

_TENANT = "t1"


class _SeamStub:
    """Ein Seam, der nicht ins Netz geht.

    Merkt sich die Aufrufe, damit die Tests prüfen können, ob überhaupt
    gerufen wurde — bei einem Offline-Widerruf darf NICHT gerufen werden.
    """

    def __init__(self, *, code: str | None = "483921") -> None:
        self.angelegt: list[dict] = []
        self.widerrufen: list[str] = []
        self.verschoben: list[tuple] = []
        self._code = code

    def zugang_anlegen(self, **kwargs: Any) -> SeamZugang:
        self.angelegt.append(kwargs)
        return SeamZugang(
            grant_id=f"grant-{len(self.angelegt)}",
            code=self._code,
            status="active",
        )

    def zugang_lesen(self, grant_id: str) -> SeamZugang:
        return SeamZugang(grant_id=grant_id, code=self._code, status="active")

    def zugang_verschieben(
        self, grant_id: str, *, beginn_iso: str, ende_iso: str
    ) -> None:
        self.verschoben.append((grant_id, beginn_iso, ende_iso))

    def zugang_widerrufen(self, grant_id: str) -> None:
        self.widerrufen.append(grant_id)


def _service(db: FakeDb, seam: _SeamStub | None = None) -> SchloesserService:
    dienst = SchloesserService(db)
    if seam is not None:
        dienst._client = seam  # noqa: SLF001 - Testdoppel statt Netzaufruf
    return dienst


def _grunddaten(
    db: FakeDb,
    *,
    kann_widerrufen: bool | None,
    zeitraster: str = "free",
    check_in: str = "2026-10-01",
    check_out: str = "2026-10-05",
) -> tuple[str, str]:
    """Ein Objekt mit Einheit, Schloss und Buchung. Gibt (buchung, geraet)."""
    db.rows.setdefault("properties", []).extend([
        {"id": "p1", "tenant_id": _TENANT, "building_id": None},
    ])
    db.rows.setdefault("property_units", []).extend([
        {"id": "u1", "property_id": "p1", "properties": {"tenant_id": _TENANT}},
    ])
    db.rows.setdefault("seam_device", []).extend([
        {
            "id": "d1",
            "tenant_id": _TENANT,
            "seam_device_id": "seam-d1",
            "display_name": "Haustür",
            "can_revoke": kann_widerrufen,
            "is_offline_capable": kann_widerrufen is not True,
            "time_granularity": zeitraster,
        },
    ])
    db.rows.setdefault("seam_device_zuordnung", []).extend([
        {
            "id": "z1",
            "tenant_id": _TENANT,
            "device_id": "d1",
            "unit_id": "u1",
            "building_id": None,
        },
    ])
    db.rows.setdefault("reservations", []).extend([
        {
            "id": "r1",
            "tenant_id": _TENANT,
            "property_id": "p1",
            "unit_id": "u1",
            "check_in": check_in,
            "check_out": check_out,
            "status": "booked",
            "is_owner_stay": False,
            "stay_name": None,
            "guests": {"name": "Otto Meyer"},
            "owners": None,
        },
    ])
    return "r1", "d1"


# =========================================================================
# Der wichtigste Fall: Offline-Code ist NICHT widerrufbar
# =========================================================================
def test_offline_code_wird_nicht_als_widerrufen_gemeldet() -> None:
    """Ein algoPIN läuft nach dem Storno weiter — das MUSS so gesagt werden.

    Seam wörtlich: „you cannot revoke a created offline access code before
    the configured expiration date". Ein PMS, das hier „widerrufen" meldet,
    behauptet Sicherheit, die es nicht gibt.
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=False)
    db.rows.setdefault("seam_zugang", []).extend([
        {
            "id": "zg1",
            "tenant_id": _TENANT,
            "reservation_id": "r1",
            "reservation_key": "nextdays-r1",
            "seam_grant_id": "grant-1",
            "code": "483921",
            "status": "aktiv",
            "starts_at": "2026-10-01T14:00:00+00:00",
            "ends_at": "2026-10-05T11:00:00+00:00",
        },
    ])
    seam = _SeamStub()
    ergebnis = _service(db, seam).zugang_widerrufen(_TENANT, "r1")

    assert ergebnis is not None
    assert ergebnis["status"] == "nicht_widerrufbar"
    # Seam wurde NICHT gerufen: ein Aufruf, der nichts bewirken kann, ist
    # kein Fortschritt, sondern eine irreführende Erfolgsmeldung.
    assert seam.widerrufen == []
    # Der Grund nennt das Ablaufdatum im Klartext — sonst weiß der Betrieb
    # nicht, wie lange der Code noch geht.
    assert "05.10.2026" in ergebnis["grund"]
    gespeichert = db.rows["seam_zugang"][0]
    assert gespeichert["status"] == "nicht_widerrufbar"


def test_online_code_wird_wirklich_widerrufen() -> None:
    """Das Gegenstück: bei einem Online-Schloss wird tatsächlich gerufen."""
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    db.rows.setdefault("seam_zugang", []).extend([
        {
            "id": "zg1",
            "tenant_id": _TENANT,
            "reservation_id": "r1",
            "reservation_key": "nextdays-r1",
            "seam_grant_id": "grant-1",
            "code": "483921",
            "status": "aktiv",
            "starts_at": "2026-10-01T14:00:00+00:00",
            "ends_at": "2026-10-05T11:00:00+00:00",
        },
    ])
    seam = _SeamStub()
    ergebnis = _service(db, seam).zugang_widerrufen(_TENANT, "r1")

    assert ergebnis["status"] == "widerrufen"
    assert seam.widerrufen == ["grant-1"]
    assert db.rows["seam_zugang"][0]["status"] == "widerrufen"


def test_unbekannte_widerrufbarkeit_gilt_als_nicht_widerrufbar() -> None:
    """`can_revoke = None` heißt „unbekannt" — und wird fail-closed behandelt.

    Ein Widerruf zu versprechen, den man nicht belegen kann, ist schlimmer
    als ihn zu verneinen: der Betrieb würde sich darauf verlassen.
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=None)
    db.rows.setdefault("seam_zugang", []).extend([
        {
            "id": "zg1",
            "tenant_id": _TENANT,
            "reservation_id": "r1",
            "reservation_key": "nextdays-r1",
            "seam_grant_id": "grant-1",
            "code": "1",
            "status": "aktiv",
            "starts_at": "2026-10-01T14:00:00+00:00",
            "ends_at": "2026-10-05T11:00:00+00:00",
        },
    ])
    seam = _SeamStub()
    ergebnis = _service(db, seam).zugang_widerrufen(_TENANT, "r1")
    assert ergebnis["status"] == "nicht_widerrufbar"
    assert seam.widerrufen == []


def test_zugang_ohne_grant_ist_sofort_sauber() -> None:
    """Ein nur geplanter Zugang war nie am Schloss — nichts zu widerrufen."""
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=False)
    db.rows.setdefault("seam_zugang", []).extend([
        {
            "id": "zg1",
            "tenant_id": _TENANT,
            "reservation_id": "r1",
            "reservation_key": "nextdays-r1",
            "seam_grant_id": None,
            "code": None,
            "status": "geplant",
            "starts_at": "2026-10-01T14:00:00+00:00",
            "ends_at": "2026-10-05T11:00:00+00:00",
        },
    ])
    seam = _SeamStub()
    ergebnis = _service(db, seam).zugang_widerrufen(_TENANT, "r1")
    # Trotz Offline-Gerät: ohne ausgegebenen Code ist „widerrufen" korrekt.
    assert ergebnis["status"] == "widerrufen"
    assert seam.widerrufen == []


# =========================================================================
# Gültigkeit: Puffer und Rundung
# =========================================================================
def test_puffer_wird_angewendet() -> None:
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    db.rows.setdefault("seam_einstellungen", []).extend([
        {
            "property_id": "p1",
            "tenant_id": _TENANT,
            "puffer_vor_min": 60,
            "puffer_nach_min": 120,
            "vorlauf_stunden": 72,
            "aktiv": True,
        },
    ])
    dienst = _service(db, _SeamStub())
    zugang = dienst.zugang_planen(_TENANT, "r1")
    assert zugang is not None
    # Ohne Policy-Uhrzeiten gilt der TAG: Anreise ab 00:00, Abreise BIS
    # Mitternacht. Ein Code, der am Abreisetag um 00:00 endet, wäre wertlos —
    # der Gast reist an diesem Tag erst ab.
    # check_in 00:00 minus 60 min = Vortag 23:00
    assert zugang["starts_at"].startswith("2026-09-30T23:00")
    # check_out 05.10. 24:00 plus 120 min = 06.10. 02:00
    assert zugang["ends_at"].startswith("2026-10-06T02:00")


def test_stundenraster_rundet_ende_nach_oben() -> None:
    """igloohome nimmt nur ganze Stunden — der Code darf nie kürzer gelten.

    Beginn ab, Ende auf. Andersherum stünde ein Gast mit gültiger Buchung
    vor verschlossener Tür.
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True, zeitraster="hour")
    db.rows.setdefault("seam_einstellungen", []).extend([
        {
            "property_id": "p1",
            "tenant_id": _TENANT,
            # 30 Minuten Puffer erzeugt genau den krummen Wert, um den es geht
            "puffer_vor_min": 30,
            "puffer_nach_min": 30,
            "vorlauf_stunden": 72,
            "aktiv": True,
        },
    ])
    zugang = _service(db, _SeamStub()).zugang_planen(_TENANT, "r1")
    assert zugang is not None
    # 2026-09-30 23:30 -> abgerundet auf 23:00 (früher, nicht später)
    assert zugang["starts_at"].startswith("2026-09-30T23:00")
    # Abreisetag bis Mitternacht + 30 min = 06.10. 00:30 -> auf 01:00
    assert zugang["ends_at"].startswith("2026-10-06T01:00")


def test_zu_langer_zeitraum_wird_abgelehnt() -> None:
    """Wurzel 8: ein unbegrenzter Datums-Span bekommt eine harte Obergrenze."""
    db = FakeDb()
    _grunddaten(
        db,
        kann_widerrufen=True,
        check_in="2026-01-01",
        check_out="2028-01-01",  # ~730 Tage
    )
    with pytest.raises(SchloesserFehler) as fehler:
        _service(db, _SeamStub()).zugang_planen(_TENANT, "r1")
    assert fehler.value.status_code == 422
    assert "367" in str(fehler.value.detail)


def test_buchung_ohne_datum_schlaegt_klar_fehl() -> None:
    """Kein erfundenes Ersatzdatum (Wurzel 4)."""
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    db.rows["reservations"][0]["check_in"] = None
    with pytest.raises(SchloesserFehler) as fehler:
        _service(db, _SeamStub()).zugang_planen(_TENANT, "r1")
    assert fehler.value.status_code == 422


# =========================================================================
# Idempotenz (Wurzel 2)
# =========================================================================
def test_zweites_planen_erzeugt_keinen_zweiten_zugang() -> None:
    """Doppelklick/Retry darf keinen zweiten PIN-Slot verbrauchen.

    Bei igloohome sind pro Tag nur DREI PINs möglich, und auch stornierte
    verbrauchen einen — ein zweiter Grant wäre also nicht nur unsauber,
    sondern teuer.
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    dienst = _service(db, _SeamStub())
    dienst.zugang_planen(_TENANT, "r1")
    dienst.zugang_planen(_TENANT, "r1")
    assert len(db.rows["seam_zugang"]) == 1


def test_anlegen_ist_idempotent_gegen_doppelten_grant() -> None:
    """Ein bereits angelegter Zugang wird nicht zweimal an Seam gegeben."""
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    db.rows.setdefault("seam_zugang", []).extend([
        {
            "id": "zg1",
            "tenant_id": _TENANT,
            "reservation_id": "r1",
            "reservation_key": "nextdays-r1",
            "seam_grant_id": "grant-1",
            "code": "483921",
            "status": "angelegt",
            "starts_at": "2026-10-01T14:00:00+00:00",
            "ends_at": "2026-10-05T11:00:00+00:00",
        },
    ])
    seam = _SeamStub()
    _service(db, seam).zugang_anlegen(_TENANT, "zg1")
    assert seam.angelegt == []


# =========================================================================
# Zuordnung: Einheit ODER Gebäude
# =========================================================================
def test_zuordnung_braucht_genau_eine_ebene() -> None:
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    dienst = _service(db, _SeamStub())
    with pytest.raises(SchloesserFehler):
        dienst.zuordnen(_TENANT, "d1", unit_id="u1", building_id="b1")
    with pytest.raises(SchloesserFehler):
        dienst.zuordnen(_TENANT, "d1")


def test_fremde_einheit_wird_abgelehnt() -> None:
    """Wurzel 3: kein Schloss an eine Einheit eines fremden Betriebs."""
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    db.rows.setdefault("property_units", []).extend([
        {
            "id": "u-fremd",
            "property_id": "p-fremd",
            "properties": {"tenant_id": "t2"},
        },
    ])
    with pytest.raises(SchloesserFehler) as fehler:
        _service(db, _SeamStub()).zuordnen(_TENANT, "d1", unit_id="u-fremd")
    assert fehler.value.status_code == 404


def test_gemeinschaftstuer_gilt_fuer_alle_einheiten_des_gebaeudes() -> None:
    """Ein Gebäude-Schloss muss für die Buchung mitgeliefert werden.

    Ein Gast, der die Wohnungstür öffnen kann, aber nicht die Haustür, steht
    draußen — deshalb sind beide Ebenen zusammen die Antwort.
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    db.rows["properties"][0]["building_id"] = "b1"
    db.rows.setdefault("buildings", []).extend([{"id": "b1", "tenant_id": _TENANT}])
    db.rows.setdefault("seam_device", []).extend([
        {
            "id": "d2",
            "tenant_id": _TENANT,
            "seam_device_id": "seam-d2",
            "display_name": "Hauseingang",
            "can_revoke": True,
            "is_offline_capable": False,
            "time_granularity": "free",
        },
    ])
    db.rows.setdefault("seam_device_zuordnung", []).extend([
        {
            "id": "z2",
            "tenant_id": _TENANT,
            "device_id": "d2",
            "unit_id": None,
            "building_id": "b1",
        },
    ])
    seam = _SeamStub()
    dienst = _service(db, seam)
    zugang = dienst.zugang_planen(_TENANT, "r1")
    assert zugang is not None
    # Die Buchung liegt weit in der Zukunft, deshalb ist sie hier nur GEPLANT —
    # an Seam geht sie erst im Vorlauffenster (72 h). Das Anlegen wird darum
    # ausdrücklich angestossen, um den Grant zu prüfen.
    assert zugang["status"] == "geplant"
    dienst.zugang_anlegen(_TENANT, str(zugang["id"]))
    assert len(seam.angelegt) == 1
    # BEIDE Geräte im selben Grant: der Gast bekommt EINEN Code für alle Türen.
    assert sorted(seam.angelegt[0]["geraete_ids"]) == ["seam-d1", "seam-d2"]


def test_ohne_schloss_kein_zugang_und_kein_fehler() -> None:
    """Der Normalfall: die meisten Betriebe haben keine Smart Locks."""
    db = FakeDb()
    db.rows.setdefault("properties", []).extend([
        {"id": "p1", "tenant_id": _TENANT, "building_id": None},
    ])
    db.rows.setdefault("reservations", []).extend([
        {
            "id": "r1",
            "tenant_id": _TENANT,
            "property_id": "p1",
            "unit_id": None,
            "check_in": "2026-10-01",
            "check_out": "2026-10-05",
            "status": "booked",
            "is_owner_stay": False,
            "stay_name": None,
            "guests": {"name": "Otto"},
            "owners": None,
        },
    ])
    assert _service(db, _SeamStub()).zugang_planen(_TENANT, "r1") is None


# =========================================================================
# Konfiguration und Client
# =========================================================================
def test_fehlender_api_key_schlaegt_sichtbar_fehl() -> None:
    """Ein Konfigurationsmangel darf nicht wie ein Netzfehler aussehen.

    Sonst wird er nie behoben — die Lehre aus der Mail-Variablen-Drift
    zwischen api und worker (25.08.2026).
    """
    client = SeamClient(None)
    assert client.konfiguriert is False
    with pytest.raises(SeamNichtKonfiguriert) as fehler:
        client.geraete_lesen("konto-1")
    # Die Handlungsanweisung steht IN der Meldung, nicht im Code.
    assert "SEAM_API_KEY" in str(fehler.value)
    assert "worker" in str(fehler.value)
    assert fehler.value.status_code == 503


def test_leerer_api_key_gilt_als_nicht_gesetzt() -> None:
    """Kein Fallback auf einen Platzhalter (Wurzel 4)."""
    assert SeamClient("   ").konfiguriert is False


def _geraet(**felder: Any) -> Any:
    """Ein Seam-Gerät nachbauen — das SDK liefert Objekte, keine dicts.

    Bewusst ein simples Objekt statt einer SDK-Klasse: die echten Modelle
    unterscheiden sich je Gerätetyp, und `_geraet_uebersetzen` liest nur die
    gemeinsamen Felder per `getattr`. Ein Stub, der genau das nachbildet,
    prüft dieselbe Oberfläche.
    """
    return type("Geraet", (), {"device_id": "x", **felder})()


def test_offline_faehigkeit_kommt_aus_seams_feld() -> None:
    """Seam sagt es je GERÄT — keine Marken-Heuristik mehr.

    `can_program_offline_access_codes` ist die Wahrheit. Die frühere Fassung
    riet es aus dem Gerätetyp und lag bei `dormakaba_oracode_door` und
    `keynest_key` falsch, weil beide nicht auf `_lock` enden.
    """
    geraet = SeamClient._geraet_uebersetzen(  # noqa: SLF001
        _geraet(
            device_manufacturer="igloohome",
            can_program_offline_access_codes=True,
            can_program_online_access_codes=False,
            properties={},
        )
    )
    assert geraet.ist_offline_faehig is True
    # Offline ohne Online-Codes und ohne Netz -> der Code laeuft bis zum Ende.
    assert geraet.kann_widerrufen is False


def test_offline_geraet_mit_bridge_kann_widerrufen() -> None:
    """Dieselbe Marke, andere Antwort — der Grund für `can_revoke` je Gerät.

    Kann ein Offline-Gerät ZUSÄTZLICH Online-Codes, hängt eine Bridge dran:
    dann ist der Widerruf möglich.
    """
    geraet = SeamClient._geraet_uebersetzen(  # noqa: SLF001
        _geraet(
            device_manufacturer="igloohome",
            can_program_offline_access_codes=True,
            can_program_online_access_codes=True,
            properties={},
        )
    )
    assert geraet.ist_offline_faehig is True
    assert geraet.kann_widerrufen is True


def test_online_geraet_ist_widerrufbar() -> None:
    geraet = SeamClient._geraet_uebersetzen(  # noqa: SLF001
        _geraet(
            device_manufacturer="nuki",
            can_program_offline_access_codes=False,
            can_program_online_access_codes=True,
            properties={"online": True},
        )
    )
    assert geraet.ist_offline_faehig is False
    assert geraet.kann_widerrufen is True


def test_dormakaba_wird_ueber_die_marke_erkannt() -> None:
    """Rückfall auf die Markenliste, wenn Seam die Fähigkeit nicht liefert.

    `dormakaba_oracode` ist genau der Fall, an dem die alte Typ-Zerlegung
    scheiterte: der Gerätetyp heißt `dormakaba_oracode_door`, nicht `_lock`.
    Über `device_manufacturer` stimmt es.
    """
    geraet = SeamClient._geraet_uebersetzen(  # noqa: SLF001
        _geraet(device_manufacturer="dormakaba_oracode", properties={})
    )
    assert geraet.ist_offline_faehig is True


def test_igloo_ist_nicht_igloohome() -> None:
    """Zwei verschiedene Hersteller — ein Präfix-Vergleich verwechselte sie.

    `igloo` ist eine eigene Marke in Seams Liste, `igloohome` eine andere.
    Nur `igloohome` arbeitet mit algoPIN.
    """
    geraet = SeamClient._geraet_uebersetzen(  # noqa: SLF001
        _geraet(device_manufacturer="igloo", properties={})
    )
    assert geraet.ist_offline_faehig is False


def test_unbekannte_faehigkeit_bleibt_unbekannt() -> None:
    """Offline-Gerät, laut Seam online: `None`, keine Behauptung.

    `online` kann auch ein kurzer Bluetooth-Sync sein — daraus einen
    Widerruf zu versprechen wäre geraten, nicht gewusst.
    """
    geraet = SeamClient._geraet_uebersetzen(  # noqa: SLF001
        _geraet(
            device_manufacturer="igloohome",
            can_program_offline_access_codes=True,
            properties={"online": True},
        )
    )
    assert geraet.kann_widerrufen is None


def test_batteriestand_ausserhalb_des_bereichs_ist_unbekannt() -> None:
    """Kein plausibler Ersatzwert für einen unsinnigen Messwert (Wurzel 4)."""
    geraet = SeamClient._geraet_uebersetzen(  # noqa: SLF001
        _geraet(
            device_manufacturer="nuki",
            properties={"battery_level": 42},  # Prozent statt Anteil
        )
    )
    assert geraet.batterie is None


# =========================================================================
# Zeit-Hilfsfunktion
# =========================================================================
def test_reines_datum_wird_als_mitternacht_utc_gelesen() -> None:
    zeit = als_zeitpunkt("2026-10-01")
    assert zeit == datetime(2026, 10, 1, tzinfo=UTC)


def test_unlesbares_datum_gibt_none() -> None:
    """Kein Rückfall auf „jetzt" (Wurzel 4/5b)."""
    assert als_zeitpunkt("übermorgen") is None
    assert als_zeitpunkt("") is None
    assert als_zeitpunkt(None) is None


def test_naive_zeit_wird_als_utc_gelesen() -> None:
    zeit = als_zeitpunkt("2026-10-01T14:00:00")
    assert zeit is not None
    assert zeit.tzinfo is not None


# =========================================================================
# Terminänderung: verschieben statt neu anlegen
# =========================================================================
def test_terminaenderung_verschiebt_statt_neu_anzulegen() -> None:
    """Ein bestehender Grant wird VERSCHOBEN — kein zweiter angelegt.

    Der Fehler, den erst das offizielle SDK sichtbar gemacht hat: die erste
    Fassung setzte den Zustand auf `geplant` zurück, worauf der Tick einen
    ZWEITEN Grant angelegt hätte. Bei igloohome ist das einer von drei
    PIN-Slots des Tages, verbraucht für nichts.
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    db.rows.setdefault("seam_zugang", []).extend([
        {
            "id": "zg1",
            "tenant_id": _TENANT,
            "reservation_id": "r1",
            "reservation_key": "nextdays-r1",
            "seam_grant_id": "grant-1",
            "code": "483921",
            "status": "aktiv",
            "starts_at": "2026-09-30T23:30:00+00:00",
            "ends_at": "2026-10-05T00:30:00+00:00",
        },
    ])
    # Termin verschieben -> neue Gültigkeit
    db.rows["reservations"][0]["check_out"] = "2026-10-07"

    seam = _SeamStub()
    _service(db, seam).zugang_planen(_TENANT, "r1")

    assert seam.angelegt == [], "kein zweiter Grant"
    assert len(seam.verschoben) == 1
    grant_id, _, neues_ende = seam.verschoben[0]
    assert grant_id == "grant-1"
    # check_out 07.10., ohne Uhrzeit also bis Mitternacht, plus 30 min Puffer
    assert neues_ende.startswith("2026-10-08T00:30")
    # Zurück auf `angelegt`: dass die neue Gültigkeit am Gerät ankam,
    # bestätigt erst der Webhook.
    assert db.rows["seam_zugang"][0]["status"] == "angelegt"


def test_terminaenderung_bei_offline_code_bleibt_ehrlich() -> None:
    """Ein Offline-Code lässt sich nicht verschieben — das muss dastehen."""
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=False)
    db.rows.setdefault("seam_zugang", []).extend([
        {
            "id": "zg1",
            "tenant_id": _TENANT,
            "reservation_id": "r1",
            "reservation_key": "nextdays-r1",
            "seam_grant_id": "grant-1",
            "code": "483921",
            "status": "aktiv",
            "starts_at": "2026-09-30T23:00:00+00:00",
            "ends_at": "2026-10-05T01:00:00+00:00",
        },
    ])
    db.rows["reservations"][0]["check_out"] = "2026-10-07"

    seam = _SeamStub()
    _service(db, seam).zugang_planen(_TENANT, "r1")

    # Weder verschoben noch neu angelegt: der alte Code läuft weiter, und
    # genau das wird gesagt.
    assert seam.verschoben == []
    zeile = db.rows["seam_zugang"][0]
    assert zeile["status"] == "nicht_widerrufbar"
    assert "05.10.2026" in zeile["status_grund"]


# =========================================================================
# Provider-Auswahl: keine fremden PMS
# =========================================================================
def test_keine_fremd_pms_in_der_providerliste() -> None:
    """Seams Kategorie `connectors` darf NICHT im Webview auftauchen.

    Live passiert (06.09.2026): im Connect Webview stand „Ical" als wählbarer
    Anbieter, weil `accepted_capabilities=["lock"]` die Konnektoren nicht
    ausfiltert. Für uns sind sie schädlich, nicht nur nutzlos — wir SIND das
    PMS; ein hier verbundenes Lodgify oder Guesty würde Buchungen aus einem
    Konkurrenzsystem in unser Türcode-System spiegeln.
    """
    from src.features.schloesser.seam_client import SCHLOSS_PROVIDER

    verboten = {"ical", "lodgify", "hostaway", "guesty", "acuity_scheduling"}
    assert not (set(SCHLOSS_PROVIDER) & verboten)


def test_wichtige_schlossmarken_sind_waehlbar() -> None:
    """Die Marken, um die es fachlich geht, müssen drin sein.

    igloohome war der Anlass der ganzen Anbindung; Nuki, TTLock und Salto sind
    die Hersteller, deren Direktintegration wir uns damit erspart haben.
    KeyNest deckt die Objekte ab, an denen gar kein Smart Lock möglich ist.
    """
    from src.features.schloesser.seam_client import SCHLOSS_PROVIDER

    for marke in ("igloohome", "nuki", "ttlock", "salto_ks", "keynest"):
        assert marke in SCHLOSS_PROVIDER, marke


# =========================================================================
# Zeitzone des Objekts (der Fund, der Gäste ausgeschlossen hätte)
# =========================================================================
def test_zeitzone_des_objekts_wird_verwendet() -> None:
    """Athen, UTC+3: Check-in 16:00 vor Ort ist 13:00 UTC.

    Der Fehler, den ein Review-Agent gefunden hat: die erste Fassung las das
    reine Datum als Mitternacht UTC und rechnete den Puffer darauf. Für Athen
    lief der Code damit am Abreisetag um 03:30 Ortszeit aus — der Gast kam am
    letzten Morgen nicht mehr in die Wohnung.
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    db.rows["properties"][0]["timezone"] = "Europe/Athens"
    db.rows["reservations"][0]["checkin_time"] = "16:00"
    db.rows["reservations"][0]["checkout_time"] = "11:00"
    db.rows.setdefault("seam_einstellungen", []).extend([
        {
            "property_id": "p1",
            "tenant_id": _TENANT,
            "puffer_vor_min": 0,
            "puffer_nach_min": 0,
            "vorlauf_stunden": 72,
            "aktiv": True,
        },
    ])
    zugang = _service(db, _SeamStub()).zugang_planen(_TENANT, "r1")
    assert zugang is not None
    # 01.10.2026 16:00 Athen (UTC+3 im Sommer) = 13:00 UTC
    assert zugang["starts_at"].startswith("2026-10-01T13:00")
    # 05.10.2026 11:00 Athen = 08:00 UTC — NICHT 03:30 wie in der Fehlfassung
    assert zugang["ends_at"].startswith("2026-10-05T08:00")


def test_code_endet_nie_vor_dem_auschecken() -> None:
    """Die Kernzusage: der Code gilt nie kürzer als der Aufenthalt.

    Geprüft über mehrere Zonen, weil genau hier die Vorzeichenfehler sitzen.
    """
    for zone, checkout in (
        ("Europe/Athens", "11:00"),
        ("Europe/Lisbon", "10:00"),
        ("Atlantic/Reykjavik", "12:00"),  # UTC ohne Sommerzeit
        ("Asia/Kolkata", "11:00"),  # halbe Stunde Versatz
    ):
        db = FakeDb()
        _grunddaten(db, kann_widerrufen=True)
        db.rows["properties"][0]["timezone"] = zone
        db.rows["reservations"][0]["checkin_time"] = "15:00"
        db.rows["reservations"][0]["checkout_time"] = checkout
        zugang = _service(db, _SeamStub()).zugang_planen(_TENANT, "r1")
        assert zugang is not None
        ende = als_zeitpunkt(zugang["ends_at"])
        # Der Auscheck-Zeitpunkt in Ortszeit, als UTC
        soll = als_ortszeit(
            "2026-10-05", uhrzeit(checkout), objekt_zone(zone)
        )
        assert ende is not None and soll is not None
        assert ende >= soll, f"{zone}: Code endet VOR dem Auschecken"


def test_stundenraster_rundet_in_der_ortszeit() -> None:
    """Bei halbstündigem Zonenversatz muss die Rundung ortszeitgenau sein.

    Kolkata liegt auf UTC+5:30. In UTC gerundet läge die Stundengrenze mitten
    in der Ortsstunde — das Schloss erwartet aber die volle Stunde vor Ort.
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True, zeitraster="hour")
    db.rows["properties"][0]["timezone"] = "Asia/Kolkata"
    db.rows["reservations"][0]["checkin_time"] = "15:30"
    db.rows["reservations"][0]["checkout_time"] = "10:30"
    zugang = _service(db, _SeamStub()).zugang_planen(_TENANT, "r1")
    assert zugang is not None
    zone = objekt_zone("Asia/Kolkata")
    beginn = als_zeitpunkt(zugang["starts_at"])
    ende = als_zeitpunkt(zugang["ends_at"])
    assert beginn is not None and ende is not None and zone is not None
    # Volle Stunde in der ORTSZEIT, nicht in UTC
    assert beginn.astimezone(zone).minute == 0
    assert ende.astimezone(zone).minute == 0


def test_unbekannte_zeitzone_faellt_auf_utc_zurueck() -> None:
    """Kein Raten: eine unlesbare Zone ergibt UTC plus Logeintrag."""
    assert objekt_zone("Nicht/Existent") is None
    assert objekt_zone("") is None
    assert objekt_zone(None) is None
    assert objekt_zone("Europe/Berlin") is not None


def test_uhrzeit_parser() -> None:
    """Policy-Zeiten sind Freitext (0049) — unlesbares ergibt None."""
    from datetime import time as _t

    assert uhrzeit("16:00") == _t(16, 0)
    assert uhrzeit("16:00:00") == _t(16, 0)
    assert uhrzeit("nachmittags") is None
    assert uhrzeit("") is None
    assert uhrzeit(None) is None


# =========================================================================
# Kapazität: 199 Codes bei igloohome, Stornos geben nichts frei
# =========================================================================
def test_volles_schloss_wird_klar_abgelehnt() -> None:
    """Kein stiller Seam-Fehler, sondern eine Meldung mit Handlungsanweisung.

    Der Fall ist real: igloohome fasst 199 Codes, und ein stornierter
    Offline-Code gibt seinen Platz NICHT frei — er läuft bis zum Ablauf
    weiter. Ein Objekt mit viel Wechsel füllt den Speicher also wirklich.
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=False)
    db.rows["seam_device"][0]["capacity_total"] = 2
    # Zwei aktive Zugänge an diesem Gerät = Speicher voll.
    for i in (1, 2):
        db.rows.setdefault("reservations", []).append({
            "id": f"alt{i}",
            "tenant_id": _TENANT,
            "property_id": "p1",
            "unit_id": "u1",
            "check_in": "2026-08-01",
            "check_out": "2026-08-03",
            "status": "booked",
            "is_owner_stay": False,
            "stay_name": None,
            "guests": {"name": "Alt"},
            "owners": None,
        })
        db.rows.setdefault("seam_zugang", []).append({
            "id": f"zga{i}",
            "tenant_id": _TENANT,
            "reservation_id": f"alt{i}",
            "reservation_key": f"nextdays-alt{i}",
            "seam_grant_id": f"g{i}",
            "code": "1",
            # `nicht_widerrufbar` zählt MIT: der Code läuft weiter.
            "status": "nicht_widerrufbar",
            "starts_at": "2026-08-01T00:00:00+00:00",
            "ends_at": "2027-08-01T00:00:00+00:00",
        })
    db.rows.setdefault("seam_zugang", []).append({
        "id": "zgneu",
        "tenant_id": _TENANT,
        "reservation_id": "r1",
        "reservation_key": "nextdays-r1",
        "seam_grant_id": None,
        "code": None,
        "status": "geplant",
        "starts_at": "2026-10-01T00:00:00+00:00",
        "ends_at": "2026-10-06T00:00:00+00:00",
    })
    seam = _SeamStub()
    with pytest.raises(SchloesserFehler) as fehler:
        _service(db, seam).zugang_anlegen(_TENANT, "zgneu")
    assert fehler.value.status_code == 422
    text = str(fehler.value.detail)
    assert "keinen freien Code-Platz" in text
    # Die Zahlen stehen drin, damit der Betrieb den Zustand einschätzen kann.
    assert "von 2" in text
    # Und Seam wurde NICHT belastet.
    assert seam.angelegt == []


def test_unbekannte_kapazitaet_blockiert_nicht() -> None:
    """Nuki: die Grenze hängt an der Schloss-Generation, wir kennen sie nicht.

    Eine geratene Grenze wäre schlechter als keine — sie würde Zugänge
    ablehnen, die das Schloss problemlos aufnimmt (Wurzel 4).
    """
    db = FakeDb()
    _grunddaten(db, kann_widerrufen=True)
    db.rows["seam_device"][0]["capacity_total"] = None
    db.rows.setdefault("seam_zugang", []).extend([
        {
            "id": "zg1",
            "tenant_id": _TENANT,
            "reservation_id": "r1",
            "reservation_key": "nextdays-r1",
            "seam_grant_id": None,
            "code": None,
            "status": "geplant",
            "starts_at": "2026-10-01T00:00:00+00:00",
            "ends_at": "2026-10-06T00:00:00+00:00",
        },
    ])
    seam = _SeamStub()
    _service(db, seam).zugang_anlegen(_TENANT, "zg1")
    assert len(seam.angelegt) == 1
