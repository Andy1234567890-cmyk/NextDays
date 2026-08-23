"""Tests für Objektbereich, Bilder, Fotoalbum und Statistik im Eigentümer-Portal.

Die vier Flächen zu den Rechten pm_property_area, pm_view_property_images,
pm_photo_album und pm_nonrevenue_charts. Geprüft wird das, was bei einem Fehler
NICHT auffiele, weil die Oberfläche trotzdem plausibel aussähe:

  1. Der Guard prüft BEIDE Ebenen — die granulare Berechtigung aus der DB und
     die Fähigkeit inklusive Familien-Deckelung. Fehlte eine, wäre das Recht
     wieder ein Schalter ohne Funktion bzw. die Familienstufe wirkungslos.
  2. Ein fremdes Objekt ergibt 404, nicht 403: ein 403 verriete, dass es die ID
     gibt.
  3. Die Auslastung rechnet gegen EINHEITEN × Nächte (0265). Gegen die Nächte
     allein käme bei einem Typ mit fünf Studios 500 % heraus — eine Zahl, die
     niemand als Fehler liest, weil sie nur „hoch" wirkt.
  4. Kein Antwortfeld trägt Geld.
"""
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.auth.granular_permissions import Permission
from src.features.auth.permissions import (
    Capability,
    capabilities_for,
    effective_capabilities,
    owner_family_capabilities_for,
)
from src.features.auth.schemas import UserRole
from src.features.public_portal.dependencies import require_portal_recht
from src.features.public_portal.familie import OwnerFamilyService, familienstufe
from src.features.public_portal.service import (
    MAX_STATISTIK_TAGE,
    PortalError,
    PublicPortalService,
)
from src.main import create_app

OWNER = "owner-1"
FAMILIE = "familie-1"
PROP = "prop-1"
FREMD = "prop-fremd"
TENANT = "t-1"


def _ctx(user: str = OWNER) -> AuthContext:
    return AuthContext(user_id=user, tenant_id=TENANT, role="owner")


# --- Fake-PostgREST ----------------------------------------------------------
# Eigene Kopie wie in test_familie.py: dieser Test braucht `gt`/`lte`/`range`
# und mehrfaches `order`, die dortige Variante kennt nicht alles davon.


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._gt: tuple[str, str] | None = None
        self._lte: tuple[str, str] | None = None
        self._range: tuple[int, int] | None = None
        self._limit: int | None = None
        self._order: list[tuple[str, bool]] = []

    def select(self, *_a: object, **_k: object) -> "_Query":
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, list(vals))
        return self

    def gt(self, col: str, val: object) -> "_Query":
        self._gt = (col, str(val))
        return self

    def lte(self, col: str, val: object) -> "_Query":
        self._lte = (col, str(val))
        return self

    def order(self, col: str, *, desc: bool = False) -> "_Query":
        self._order.append((col, desc))
        return self

    def limit(self, n: int) -> "_Query":
        self._limit = n
        return self

    def range(self, start: int, end: int) -> "_Query":
        self._range = (start, end)
        return self

    def _match(self, row: dict) -> bool:
        for col, val in self._filters:
            if str(row.get(col)) != str(val):
                return False
        if self._in:
            col, vals = self._in
            if str(row.get(col)) not in {str(v) for v in vals}:
                return False
        if self._gt and not str(row.get(self._gt[0])) > self._gt[1]:
            return False
        if self._lte and not str(row.get(self._lte[0])) <= self._lte[1]:
            return False
        return True

    def execute(self) -> _Result:
        rows = [r for r in self._db.tables.get(self._table, []) if self._match(r)]
        for col, desc in reversed(self._order):
            rows.sort(key=lambda r, c=col: (r.get(c) is None, r.get(c)), reverse=desc)
        if self._range is not None:
            start, end = self._range
            rows = rows[start : end + 1]
        if self._limit is not None:
            rows = rows[: self._limit]
        return _Result(rows)


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _tables(**ueberschreiben: list[dict]) -> dict[str, list[dict]]:
    daten: dict[str, list[dict]] = {
        "users": [
            {"id": OWNER, "tenant_id": TENANT, "role": "owner",
             "permissions": [p.value for p in _OWNER_STANDARD]},
            {"id": FAMILIE, "tenant_id": TENANT, "role": "owner",
             "permissions": [p.value for p in _OWNER_STANDARD]},
        ],
        "owner_property_assignments": [
            {"tenant_id": TENANT, "user_id": OWNER, "property_id": PROP},
            {"tenant_id": TENANT, "user_id": FAMILIE, "property_id": PROP},
        ],
        "owner_family_members": [],
        "properties": [
            {"id": PROP, "tenant_id": TENANT, "title": "Feriehus Kornblomst",
             "description": "Am Wasser", "city": "Blåvand", "country": "DK",
             "max_guests": 6, "amenities": ["wifi"], "room_amenities": [],
             "status": "active", "deposit_amount": 500.0, "currency": "DKK"},
            {"id": FREMD, "tenant_id": TENANT, "title": "Fremdes Haus"},
        ],
        "property_units": [],
        "property_photos": [],
        "reservations": [],
    }
    daten.update(ueberschreiben)
    return daten


# Der gespeicherte Standard der Rolle owner (die sechs Rechte aus 0356).
_OWNER_STANDARD = (
    Permission.PM_PROPERTY_AREA,
    Permission.PM_VIEW_PROPERTY_IMAGES,
    Permission.PM_PHOTO_ALBUM,
    Permission.PM_NONREVENUE_CHARTS,
)


def _dienste(**ueberschreiben: list[dict]) -> tuple[PublicPortalService, _DB]:
    db = _DB(_tables(**ueberschreiben))
    return PublicPortalService(service_client=db), db


# --- Rechte-Matrix: die zwei neuen Fähigkeiten -------------------------------


def test_owner_hat_die_neuen_faehigkeiten() -> None:
    caps = capabilities_for(UserRole.owner)
    assert Capability.VIEW_PROPERTY_AREA in caps
    assert Capability.VIEW_OCCUPANCY_STATS in caps


def test_familie_nutzung_sieht_das_haus_aber_keine_auslastung() -> None:
    """Stufe `nutzung`: Objektbereich/Bilder ja, Statistik nein.

    Die Auslastung ist die Geschäftsleistung des Betriebs — wer nur nutzt,
    bekommt sie nicht (Art. 25 Abs. 2 DSGVO, wie bei den Berichten).
    """
    caps = owner_family_capabilities_for("nutzung")
    assert Capability.VIEW_PROPERTY_AREA in caps
    assert Capability.VIEW_OCCUPANCY_STATS not in caps


def test_familie_nutzung_berichte_sieht_beides() -> None:
    caps = owner_family_capabilities_for("nutzung_berichte")
    assert Capability.VIEW_PROPERTY_AREA in caps
    assert Capability.VIEW_OCCUPANCY_STATS in caps


def test_deckelung_wirkt_ueber_effective_capabilities() -> None:
    """Der Weg, den der Guard geht — nicht nur die Sets darunter."""
    schmal = effective_capabilities(
        UserRole.owner, has_pm_access=False, family_access="nutzung"
    )
    breit = effective_capabilities(
        UserRole.owner, has_pm_access=False, family_access="nutzung_berichte"
    )
    assert Capability.VIEW_PROPERTY_AREA in schmal
    assert Capability.VIEW_OCCUPANCY_STATS not in schmal
    assert Capability.VIEW_OCCUPANCY_STATS in breit


# --- Der Guard ---------------------------------------------------------------


def _guard_aufrufen(
    perm: Permission,
    cap: Capability,
    db: _DB,
    user: str = OWNER,
) -> None:
    """Den Dependency-Guard direkt aufrufen (ohne HTTP-Schicht)."""

    class _Konto:
        """Ersatz für AccountService.role_and_permissions — liest dieselbe Zeile."""

        @staticmethod
        def role_and_permissions(ctx: AuthContext) -> tuple[UserRole | None, list]:
            zeile = next(
                (r for r in db.tables["users"] if r["id"] == ctx.user_id), {}
            )
            rolle = UserRole(zeile["role"]) if zeile.get("role") else None
            return rolle, list(zeile.get("permissions") or [])

    guard = require_portal_recht(perm, cap)
    guard(_ctx(user), _Konto(), OwnerFamilyService(service_client=db))


def test_guard_laesst_owner_mit_recht_durch() -> None:
    _, db = _dienste()
    _guard_aufrufen(
        Permission.PM_PROPERTY_AREA, Capability.VIEW_PROPERTY_AREA, db
    )


def test_guard_verweigert_ohne_granulares_recht() -> None:
    """Das Recht ist der Schalter der Verwaltung — ohne ihn 403."""
    _, db = _dienste()
    db.tables["users"][0]["permissions"] = []
    with pytest.raises(HTTPException) as exc:
        _guard_aufrufen(
            Permission.PM_PROPERTY_AREA, Capability.VIEW_PROPERTY_AREA, db
        )
    assert exc.value.status_code == 403


def test_guard_liest_das_recht_aus_der_db_nicht_aus_dem_jwt() -> None:
    """Wurzel 7: Ein in der DB entzogenes Recht wirkt SOFORT.

    Der AuthContext bleibt unverändert `role='owner'` — käme die Antwort aus
    dem Token, ginge der Aufruf durch.
    """
    _, db = _dienste()
    db.tables["users"][0]["permissions"] = [
        p.value for p in _OWNER_STANDARD if p is not Permission.PM_NONREVENUE_CHARTS
    ]
    _guard_aufrufen(
        Permission.PM_PROPERTY_AREA, Capability.VIEW_PROPERTY_AREA, db
    )
    with pytest.raises(HTTPException) as exc:
        _guard_aufrufen(
            Permission.PM_NONREVENUE_CHARTS, Capability.VIEW_OCCUPANCY_STATS, db
        )
    assert exc.value.status_code == 403


def test_guard_deckelt_familienmitglied_auf_seine_stufe() -> None:
    """Stufe `nutzung`: Objektbereich ja, Statistik nein — trotz `role='owner'`
    und trotz gesetztem granularem Recht."""
    _, db = _dienste(
        owner_family_members=[
            {"id": "fam-1", "tenant_id": TENANT, "user_id": FAMILIE,
             "owner_user_id": OWNER, "property_id": PROP, "access": "nutzung"},
        ]
    )
    _guard_aufrufen(
        Permission.PM_PROPERTY_AREA,
        Capability.VIEW_PROPERTY_AREA,
        db,
        user=FAMILIE,
    )
    with pytest.raises(HTTPException) as exc:
        _guard_aufrufen(
            Permission.PM_NONREVENUE_CHARTS,
            Capability.VIEW_OCCUPANCY_STATS,
            db,
            user=FAMILIE,
        )
    assert exc.value.status_code == 403


def test_guard_laesst_familienstufe_berichte_zur_statistik() -> None:
    _, db = _dienste(
        owner_family_members=[
            {"id": "fam-1", "tenant_id": TENANT, "user_id": FAMILIE,
             "owner_user_id": OWNER, "property_id": PROP,
             "access": "nutzung_berichte"},
        ]
    )
    _guard_aufrufen(
        Permission.PM_NONREVENUE_CHARTS,
        Capability.VIEW_OCCUPANCY_STATS,
        db,
        user=FAMILIE,
    )


def test_guard_fail_closed_bei_unbekannter_stufe() -> None:
    """Wurzel 5: Ein Tippfehler in `access` sperrt, statt zu öffnen."""
    _, db = _dienste(
        owner_family_members=[
            {"id": "fam-1", "tenant_id": TENANT, "user_id": FAMILIE,
             "owner_user_id": OWNER, "property_id": PROP, "access": "quatsch"},
        ]
    )
    with pytest.raises(HTTPException) as exc:
        _guard_aufrufen(
            Permission.PM_PROPERTY_AREA,
            Capability.VIEW_PROPERTY_AREA,
            db,
            user=FAMILIE,
        )
    assert exc.value.status_code == 403


def test_guard_verraet_nicht_welche_pruefung_griff() -> None:
    """Beide Ablehnungen tragen denselben Text — sonst wäre die Meldung eine
    Landkarte des Rechtesystems."""
    _, ohne_recht = _dienste()
    ohne_recht.tables["users"][0]["permissions"] = []
    _, gedeckelt = _dienste(
        owner_family_members=[
            {"id": "fam-1", "tenant_id": TENANT, "user_id": FAMILIE,
             "owner_user_id": OWNER, "property_id": PROP, "access": "nutzung"},
        ]
    )
    with pytest.raises(HTTPException) as a:
        _guard_aufrufen(
            Permission.PM_PROPERTY_AREA, Capability.VIEW_PROPERTY_AREA, ohne_recht
        )
    with pytest.raises(HTTPException) as b:
        _guard_aufrufen(
            Permission.PM_NONREVENUE_CHARTS,
            Capability.VIEW_OCCUPANCY_STATS,
            gedeckelt,
            user=FAMILIE,
        )
    assert a.value.detail == b.value.detail


def test_familienstufe_ohne_zeile_ist_none() -> None:
    _, db = _dienste()
    assert familienstufe(db, TENANT, OWNER) is None


def test_familienstufe_nimmt_die_hoechste() -> None:
    """Zwei Objekte, zwei Stufen — der Guard entscheidet über die Fläche."""
    _, db = _dienste(
        owner_family_members=[
            {"id": "f1", "tenant_id": TENANT, "user_id": FAMILIE,
             "owner_user_id": OWNER, "property_id": PROP, "access": "nutzung"},
            {"id": "f2", "tenant_id": TENANT, "user_id": FAMILIE,
             "owner_user_id": OWNER, "property_id": FREMD,
             "access": "nutzung_berichte"},
        ]
    )
    assert familienstufe(db, TENANT, FAMILIE) == "nutzung_berichte"


# --- Objektbereich -----------------------------------------------------------


def test_objektbereich_liefert_stammdaten() -> None:
    service, _ = _dienste()
    detail = service.property_detail(_ctx(), PROP)
    assert detail.title == "Feriehus Kornblomst"
    assert detail.city == "Blåvand"
    assert detail.amenities == ["wifi"]
    assert detail.units_total == 1  # keine Zeile in property_units = eine Einheit


def test_objektbereich_traegt_kein_geldfeld() -> None:
    """§4.2/§4.3: keine Kaution, kein Preis, keine Währung — auch nicht
    versehentlich über ein `select("*")`."""
    service, _ = _dienste()
    felder = service.property_detail(_ctx(), PROP).model_dump()
    for verboten in (
        "deposit_amount", "currency", "price", "total_amount", "payout",
    ):
        assert verboten not in felder


def test_objektbereich_fremdes_objekt_ist_404() -> None:
    """404, nicht 403 — die Existenz fremder Objekte wird nicht verraten."""
    service, _ = _dienste()
    with pytest.raises(PortalError) as exc:
        service.property_detail(_ctx(), FREMD)
    assert exc.value.status_code == 404


def test_objektbereich_unbekannte_id_ist_404() -> None:
    service, _ = _dienste()
    with pytest.raises(PortalError) as exc:
        service.property_detail(_ctx(), "gibt-es-nicht")
    assert exc.value.status_code == 404


def test_objektbereich_zaehlt_einheiten() -> None:
    """1 Objekt = 1 Typ mit n ≥ 1 Einheiten (0265)."""
    service, _ = _dienste(
        property_units=[
            {"id": f"u{i}", "tenant_id": TENANT, "property_id": PROP,
             "name": f"Studio {i}", "position": i}
            for i in range(5)
        ]
    )
    assert service.property_detail(_ctx(), PROP).units_total == 5


# --- Bilder und Fotoalbum ----------------------------------------------------


def _fotos() -> list[dict]:
    return [
        {"id": "f-2", "property_id": PROP, "url": "https://s/2.jpg",
         "sort_order": 2, "is_cover": False, "caption": {"de": "Küche"},
         "author": None},
        {"id": "f-1", "property_id": PROP, "url": "https://s/1.jpg",
         "sort_order": 1, "is_cover": True, "caption": {}, "author": "Ole"},
        {"id": "f-x", "property_id": FREMD, "url": "https://s/x.jpg",
         "sort_order": 1, "is_cover": True, "caption": {}, "author": None},
    ]


def test_bilder_nach_sortierung_und_nur_eigene() -> None:
    service, _ = _dienste(property_photos=_fotos())
    liste = service.property_images(_ctx(), PROP)
    assert [b.id for b in liste.items] == ["f-1", "f-2"]
    assert liste.total == 2
    assert liste.items[0].is_cover is True
    assert liste.items[1].caption == {"de": "Küche"}


def test_bilder_fremdes_objekt_ist_404() -> None:
    service, _ = _dienste(property_photos=_fotos())
    with pytest.raises(PortalError) as exc:
        service.property_images(_ctx(), FREMD)
    assert exc.value.status_code == 404


def test_titelbild_im_objektbereich() -> None:
    service, _ = _dienste(property_photos=_fotos())
    assert service.property_detail(_ctx(), PROP).cover_image_url == "https://s/1.jpg"


def test_kein_titelbild_ist_none_statt_platzhalter() -> None:
    service, _ = _dienste()
    assert service.property_detail(_ctx(), PROP).cover_image_url is None


def test_fotoalbum_gruppiert_nur_eigene_objekte() -> None:
    service, _ = _dienste(property_photos=_fotos())
    album = service.photo_album(_ctx())
    assert [g.property_id for g in album.groups] == [PROP]
    assert album.total == 2
    assert album.groups[0].title == "Feriehus Kornblomst"


def test_fotoalbum_traegt_den_ort() -> None:
    """Zwei gleich benannte Häuser sind nur über den Ort zu unterscheiden."""
    service, _ = _dienste(property_photos=_fotos())
    assert service.photo_album(_ctx()).groups[0].city == "Bl\u00e5vand"


def test_fotoalbum_ohne_ort_ist_none_statt_leerstring() -> None:
    """Wurzel 4: fehlt der Ort, bleibt die Zeile leer statt einen zu erfinden."""
    service, db = _dienste(property_photos=_fotos())
    db.tables["properties"][0].pop("city")
    assert service.photo_album(_ctx()).groups[0].city is None


def test_fotoalbum_ohne_zuordnung_ist_leer() -> None:
    """Fail-closed: ein Login ohne Objektzuordnung sieht nichts."""
    service, db = _dienste(property_photos=_fotos())
    db.tables["owner_property_assignments"] = []
    album = service.photo_album(_ctx())
    assert album.groups == []
    assert album.total == 0


# --- Statistik ---------------------------------------------------------------


def _res(
    res_id: str,
    check_in: str,
    check_out: str,
    *,
    property_id: str = PROP,
    channel: str = "airbnb",
    ota_name: str | None = "Airbnb",
    booked_at: str | None = None,
    owner_stay: bool = False,
) -> dict:
    return {
        "id": res_id,
        "tenant_id": TENANT,
        "property_id": property_id,
        "check_in": check_in,
        "check_out": check_out,
        "status": "confirmed",
        "channel": channel,
        "ota_name": ota_name,
        "booked_at": booked_at,
        "is_owner_stay": owner_stay,
    }


def test_statistik_zaehlt_naechte_und_belegung() -> None:
    service, _ = _dienste(
        reservations=[_res("r1", "2026-01-05", "2026-01-10")]  # 5 Nächte
    )
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 1, 10))
    assert stats.nights_booked == 5
    assert stats.reservations == 1
    assert stats.capacity_unit_nights == 10
    assert stats.occupancy_rate == 50.0
    assert stats.avg_stay_nights == 5.0


def test_statistik_rechnet_gegen_einheiten_nicht_gegen_naechte() -> None:
    """0265: Ein Typ mit fünf Studios hat je Tag FÜNF Einheiten-Nächte.

    Ohne diesen Nenner läge die Auslastung bei 100 %, obwohl vier von fünf
    Einheiten leer stehen — eine plausibel aussehende Falschaussage.
    """
    service, _ = _dienste(
        property_units=[
            {"id": f"u{i}", "tenant_id": TENANT, "property_id": PROP,
             "name": f"Studio {i}", "position": i}
            for i in range(5)
        ],
        reservations=[_res("r1", "2026-01-01", "2026-01-11")],  # 10 Nächte
    )
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 1, 10))
    assert stats.units_total == 5
    assert stats.capacity_unit_nights == 50
    assert stats.occupancy_rate == 20.0


def test_statistik_schneidet_naechte_am_zeitraum_ab() -> None:
    """Der Silvestergast trägt zu beiden Monaten bei — je mit seinem Anteil."""
    service, _ = _dienste(
        reservations=[_res("r1", "2025-12-28", "2026-01-04")]
    )
    dez = service.statistics(_ctx(), PROP, date(2025, 12, 1), date(2025, 12, 31))
    jan = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 1, 31))
    assert dez.nights_booked == 4  # 28.–31.12.
    assert jan.nights_booked == 3  # 01.–03.01.
    # Angereist ist er im Dezember — die Buchung zählt dort, nicht doppelt.
    assert dez.reservations == 1
    assert jan.reservations == 0


def test_statistik_trennt_eigennutzung_von_gastbuchungen() -> None:
    """Die eigene Ferienwoche belegt den Kalender, ist aber keine Leistung."""
    service, _ = _dienste(
        reservations=[
            _res("r1", "2026-01-01", "2026-01-06"),
            _res("r2", "2026-01-06", "2026-01-11", owner_stay=True),
        ]
    )
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 1, 10))
    assert stats.nights_booked == 5
    assert stats.owner_stay_nights == 5
    assert stats.reservations == 1  # nur die Gastbuchung
    assert stats.occupancy_rate == 100.0


def test_statistik_vorlaufzeit_nur_aus_booked_at() -> None:
    """Wurzel 5b: Ohne `booked_at` wird nichts geraten.

    Die Buchung ohne Quell-Zeitstempel fällt aus dem Durchschnitt heraus, und
    `avg_lead_time_basis` sagt, auf wie vielen er beruht.
    """
    service, _ = _dienste(
        reservations=[
            _res("r1", "2026-01-11", "2026-01-13",
                 booked_at="2026-01-01T10:00:00Z"),   # 10 Tage
            _res("r2", "2026-01-21", "2026-01-23",
                 booked_at="2026-01-01T10:00:00Z"),   # 20 Tage
            _res("r3", "2026-01-25", "2026-01-27"),   # kein booked_at
        ]
    )
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 1, 31))
    assert stats.avg_lead_time_days == 15.0
    assert stats.avg_lead_time_basis == 2


def test_statistik_ohne_booked_at_ist_none_statt_null() -> None:
    service, _ = _dienste(reservations=[_res("r1", "2026-01-05", "2026-01-07")])
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 1, 31))
    assert stats.avg_lead_time_days is None
    assert stats.avg_lead_time_basis == 0


def test_statistik_kanalverteilung_nur_anzahlen() -> None:
    service, _ = _dienste(
        reservations=[
            _res("r1", "2026-01-02", "2026-01-05"),
            _res("r2", "2026-01-06", "2026-01-08"),
            _res("r3", "2026-01-10", "2026-01-12",
                 channel="portal", ota_name="myBestDays"),
        ]
    )
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 1, 31))
    verteilung = {k.channel: k for k in stats.by_channel}
    assert verteilung["airbnb"].reservations == 2
    assert verteilung["airbnb"].nights == 5
    assert verteilung["portal"].ota_name == "myBestDays"
    for kanal in stats.by_channel:
        felder = kanal.model_dump()
        assert "amount" not in felder
        assert "currency" not in felder


def test_statistik_antwort_traegt_kein_geldfeld() -> None:
    service, _ = _dienste(reservations=[_res("r1", "2026-01-02", "2026-01-05")])
    felder = service.statistics(
        _ctx(), PROP, date(2026, 1, 1), date(2026, 1, 31)
    ).model_dump()
    for verboten in ("revenue", "amount", "payout", "currency", "total_amount"):
        assert verboten not in felder


def test_statistik_ueber_alle_objekte_ohne_property_id() -> None:
    service, db = _dienste(reservations=[_res("r1", "2026-01-02", "2026-01-05")])
    db.tables["owner_property_assignments"].append(
        {"tenant_id": TENANT, "user_id": OWNER, "property_id": FREMD}
    )
    stats = service.statistics(_ctx(), None, date(2026, 1, 1), date(2026, 1, 10))
    assert stats.property_id is None
    assert stats.units_total == 2  # zwei Objekte mit je einer Einheit
    assert stats.capacity_unit_nights == 20


def test_statistik_filtert_auf_genau_ein_eigenes_objekt() -> None:
    """Bei MEHREREN eigenen Objekten schränkt `property_id` wirklich ein.

    Ohne diesen Test belegt nichts, dass die Objektwahl in der Oberfläche mehr
    ist als Zierde: bei einem Eigentümer mit genau einem Objekt liefern
    „alle Objekte" und „dieses Objekt" dieselben Zahlen, der Filter sieht also
    auch dann richtig aus, wenn er gar nichts tut.
    """
    service, db = _dienste(reservations=[_res("r1", "2026-01-02", "2026-01-05")])
    db.tables["owner_property_assignments"].append(
        {"tenant_id": TENANT, "user_id": OWNER, "property_id": FREMD}
    )
    db.tables["property_units"].append({"id": "u-fremd", "property_id": FREMD})

    alle = service.statistics(_ctx(), None, date(2026, 1, 1), date(2026, 1, 10))
    eines = service.statistics(
        _ctx(), PROP, date(2026, 1, 1), date(2026, 1, 10)
    )

    assert alle.property_id is None
    assert eines.property_id == PROP
    # Der Filter halbiert die Bezugsgröße — sonst wirkt er nicht.
    assert alle.units_total == 2
    assert eines.units_total == 1
    assert eines.capacity_unit_nights == alle.capacity_unit_nights // 2


def test_statistik_fremdes_objekt_ist_404() -> None:
    service, _ = _dienste()
    with pytest.raises(PortalError) as exc:
        service.statistics(_ctx(), FREMD, date(2026, 1, 1), date(2026, 1, 10))
    assert exc.value.status_code == 404


def test_statistik_ohne_zuordnung_hat_keine_quote() -> None:
    """Keine Kapazität → `None`, keine 0 % (Wurzel 4: 0 % wäre eine Aussage
    über Leistung, wo nichts messbar ist)."""
    service, db = _dienste()
    db.tables["owner_property_assignments"] = []
    stats = service.statistics(_ctx(), None, date(2026, 1, 1), date(2026, 1, 10))
    assert stats.occupancy_rate is None
    assert stats.capacity_unit_nights == 0


# --- Monatsreihe -------------------------------------------------------------


def test_monatsreihe_ist_lückenlos() -> None:
    """Jeder Monat kommt vor — auch der ohne jede Buchung.

    Ein fehlender Monat sähe im Diagramm aus wie eine Zeitreise: die Kurve
    spränge über ihn hinweg, ohne dass es der Zeichnung anzusehen wäre.
    """
    service, _ = _dienste(reservations=[_res("r1", "2026-01-05", "2026-01-08")])
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 4, 30))
    assert [m.month for m in stats.months] == [
        "2026-01", "2026-02", "2026-03", "2026-04",
    ]
    leer = stats.months[1]
    assert leer.nights_booked == 0
    assert leer.capacity_unit_nights == 28  # echte Kapazität, keine Lücke
    assert leer.occupancy_rate == 0.0


def test_monatsreihe_schneidet_die_randmonate_an() -> None:
    """Der Nenner eines Randmonats zaehlt NUR die abgefragten Tage.

    Ohne den Schnitt teilte die Quote zwölf gemessene Nächte durch
    einunddreißig Tage, von denen neunzehn nie abgefragt wurden — der erste
    Balken sähe systematisch nach schwacher Saison aus.
    """
    service, _ = _dienste(reservations=[_res("r1", "2026-01-20", "2026-02-01")])
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 20), date(2026, 2, 10))
    januar, februar = stats.months
    assert januar.month == "2026-01"
    assert januar.capacity_unit_nights == 12   # 20.-31.01., nicht 31
    assert januar.nights_booked == 12
    assert januar.occupancy_rate == 100.0
    assert februar.capacity_unit_nights == 10  # 01.-10.02., nicht 28


def test_monatsreihe_naechte_summieren_sich_zum_gesamtwert() -> None:
    """Die Reihe und die Summe sind dieselbe Bezugsgröße — sonst widersprechen
    sich Diagramm und Kennzahl auf demselben Schirm."""
    service, _ = _dienste(
        reservations=[
            _res("r1", "2025-12-28", "2026-01-04"),                  # über die Grenze
            _res("r2", "2026-02-25", "2026-03-05"),                  # über die Grenze
            _res("r3", "2026-03-10", "2026-03-14", owner_stay=True),  # Eigennutzung
        ]
    )
    stats = service.statistics(_ctx(), PROP, date(2025, 12, 1), date(2026, 3, 31))
    assert sum(m.nights_booked for m in stats.months) == stats.nights_booked
    assert sum(m.owner_stay_nights for m in stats.months) == stats.owner_stay_nights
    assert sum(m.capacity_unit_nights for m in stats.months) == (
        stats.capacity_unit_nights
    )


def test_monatsreihe_anreisen_summieren_sich_zum_gesamtwert() -> None:
    """Eine Buchung ist EIN Ereignis — sie darf in keinem Monat doppelt und in
    keinem gar nicht stehen."""
    service, _ = _dienste(
        reservations=[
            _res("r1", "2026-01-05", "2026-01-08"),
            _res("r2", "2026-01-28", "2026-02-03"),   # Anreise Januar
            _res("r3", "2026-03-30", "2026-04-02"),   # Anreise März
        ]
    )
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 3, 31))
    assert sum(m.reservations for m in stats.months) == stats.reservations
    assert stats.reservations == 3
    je_monat = {m.month: m.reservations for m in stats.months}
    assert je_monat == {"2026-01": 2, "2026-02": 0, "2026-03": 1}


def test_monatsreihe_ohne_kapazitaet_ist_none_statt_null() -> None:
    """Keine Kapazität → `None`, NIE 0 %: eine 0 behauptete Leerstand, wo
    nichts messbar war."""
    service, db = _dienste()
    db.tables["owner_property_assignments"] = []
    stats = service.statistics(_ctx(), None, date(2026, 1, 1), date(2026, 2, 28))
    assert [m.occupancy_rate for m in stats.months] == [None, None]


def test_monatsreihe_ueber_den_jahreswechsel() -> None:
    """Dezember → Januar: der Monatszähler darf nicht auf Monat 13 laufen."""
    service, _ = _dienste()
    stats = service.statistics(_ctx(), PROP, date(2025, 11, 15), date(2026, 2, 3))
    assert [m.month for m in stats.months] == [
        "2025-11", "2025-12", "2026-01", "2026-02",
    ]


def test_monatsreihe_rechnet_mit_einheiten() -> None:
    """Auch der Monats-Nenner ist Einheiten × Tage (0265)."""
    service, _ = _dienste(
        property_units=[
            {"id": f"u{i}", "tenant_id": TENANT, "property_id": PROP,
             "name": f"Studio {i}", "position": i}
            for i in range(3)
        ]
    )
    stats = service.statistics(_ctx(), PROP, date(2026, 1, 1), date(2026, 1, 31))
    assert stats.months[0].capacity_unit_nights == 93  # 3 Einheiten × 31 Tage


# --- Datums-Spanne (Wurzel 8) ------------------------------------------------


def test_statistik_spanne_ueber_730_tage_ist_422() -> None:
    service, _ = _dienste()
    von = date(2024, 1, 1)
    with pytest.raises(PortalError) as exc:
        service.statistics(_ctx(), PROP, von, von + timedelta(days=MAX_STATISTIK_TAGE))
    assert exc.value.status_code == 422


def test_statistik_spanne_genau_730_tage_geht_durch() -> None:
    service, _ = _dienste()
    von = date(2024, 1, 1)
    stats = service.statistics(
        _ctx(), PROP, von, von + timedelta(days=MAX_STATISTIK_TAGE - 1)
    )
    assert (stats.date_to - stats.date_from).days + 1 == MAX_STATISTIK_TAGE


def test_statistik_to_vor_from_ist_422() -> None:
    service, _ = _dienste()
    with pytest.raises(PortalError) as exc:
        service.statistics(_ctx(), PROP, date(2026, 5, 1), date(2026, 4, 1))
    assert exc.value.status_code == 422


def test_statistik_halber_zeitraum_ist_422() -> None:
    """Nur `from` oder nur `to` → 422 statt einer stillschweigend ergänzten
    Grenze, die niemand angefordert hat."""
    service, _ = _dienste()
    with pytest.raises(PortalError) as exc:
        service.statistics(_ctx(), PROP, date(2026, 5, 1), None)
    assert exc.value.status_code == 422


def test_statistik_ohne_zeitraum_sind_zwölf_monate() -> None:
    service, _ = _dienste()
    stats = service.statistics(_ctx(), PROP, None, None)
    assert (stats.date_to - stats.date_from).days == 364
    assert stats.date_to == date.today()


# --- HTTP-Ebene: fail-closed und read-only -----------------------------------
# Belegt am echten Router, nicht am Service: dass es die vier Pfade gibt, dass
# sie ohne Anmeldung nichts herausgeben und dass es KEINEN Schreibpfad gibt.
# Ein „es steht kein Knopf da" ist kein Beweis (Wurzel 3).

# EIN Client fuer alle HTTP-Faelle: `create_app()` je Test baute die App
# zwanzigmal und machte aus 0,8 s Laufzeit 54 s.
_client = TestClient(create_app())

_BASIS = "/api/v1/public-portal"
_PFADE = (
    f"{_BASIS}/properties/{PROP}",
    f"{_BASIS}/properties/{PROP}/images",
    f"{_BASIS}/photo-album",
    f"{_BASIS}/statistics",
)


@pytest.mark.parametrize("pfad", _PFADE)
def test_ohne_anmeldung_401(pfad: str) -> None:
    assert _client.get(pfad).status_code == 401


@pytest.mark.parametrize("pfad", _PFADE)
@pytest.mark.parametrize("methode", ("post", "put", "patch", "delete"))
def test_kein_schreibpfad(pfad: str, methode: str) -> None:
    """Schreiben gibt es schlicht nicht → 405, noch vor jeder Rechteprüfung."""
    antwort = getattr(_client, methode)(pfad)
    assert antwort.status_code == 405
