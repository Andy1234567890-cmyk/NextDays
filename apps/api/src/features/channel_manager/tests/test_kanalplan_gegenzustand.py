"""Ein Kanal-Plan, den kein Portal liest, ist ein Schalter ohne Funktion.

DER BEFUND (23.08.2026, live gemessen): 18 Zeilen in `rate_plans` mit
`portal_scope='BookingCom'`, Name „Grundpreis · BookingCom", ALLE mit
`offset_percent = 0.000`, alle mit Channex-Rate-Plan und eigenem Tax-Set — und
am Kanal las das Portal bei 17 von 18 nur die Standard-Rate. Wir pushten auf
zwei Channex-Rate-Plans, das Portal las einen: jeder ARI-Push lief doppelt, und
das portal-eigene Tax-Set hing an einer Rate, die kein Portal kannte.

Erzeuger war NICHT der Nutzer-Klickpfad (`set_portal_price_adjustment`, der zieht
die Zuordnung mit), sondern `tax_sync._kanalplaene_nachziehen`: die Methode legte
den Plan an und war fertig — `_swap_channel_rate_plan` rief sie nie. Der
Gegenzustand fehlte also nicht bloß im Fehlerfall, er war nie vorgesehen
(Wurzel 1).

Drei Stellen, drei Tests:
  1. `_kanalplaene_nachziehen` zieht die Zuordnung mit — oder legt nichts an.
  2. Der 0-%-Rückweg VERIFIZIERT, dass Rücktausch und Löschung gelandet sind.
  3. `_selected_rate_plan_ids` traut einer `portal_scope`-Zeile nicht.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.features.channel_manager.channels import ChannelsMixin
from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.objekt_kanal import ObjektKanalMixin
from src.features.channel_manager.tax_sync import TaxSyncMixin

BOOKING = "BookingCom"


class _Query:
    """Ein Supabase-Query-Zweig: sammelt Filter, liefert/verändert Zeilen."""

    def __init__(self, db: _Db, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._filter: dict[str, Any] = {}
        self._null: set[str] = set()
        self.data: list[dict[str, Any]] = []

    # -- Filter ---------------------------------------------------------------
    def select(self, *_a: str) -> _Query:
        return self

    def eq(self, feld: str, wert: Any) -> _Query:
        self._filter[feld] = str(wert)
        return self

    def is_(self, feld: str, wert: str) -> _Query:
        if wert == "null":
            self._null.add(feld)
        return self

    def not_(self) -> _Query:  # pragma: no cover — nicht gebraucht
        return self

    def order(self, *_a: str, **_k: Any) -> _Query:
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def in_(self, feld: str, werte: list[Any]) -> _Query:
        self._filter[feld] = [str(w) for w in werte]
        return self

    # -- Schreiben ------------------------------------------------------------
    def insert(self, zeile: dict[str, Any]) -> _Query:
        self._db.eingefuegt.append((self._tabelle, zeile))
        neu = dict(zeile)
        neu.setdefault("id", f"neu-{len(self._db.eingefuegt)}")
        self._db.daten.setdefault(self._tabelle, []).append(neu)
        return self

    def update(self, felder: dict[str, Any]) -> _Query:
        self._db.aktualisiert.append((self._tabelle, felder))
        for z in self._treffer():
            z.update(felder)
        return self

    def delete(self) -> _Query:
        self._db.geloescht.append(self._tabelle)
        self._loeschen = True  # pylint: disable=attribute-defined-outside-init
        return self

    # -- Ausführen ------------------------------------------------------------
    def _treffer(self) -> list[dict[str, Any]]:
        rows = self._db.daten.get(self._tabelle, [])
        out = []
        for z in rows:
            if any(z.get(f) is not None for f in self._null):
                continue
            passt = True
            for feld, wert in self._filter.items():
                if isinstance(wert, list):
                    if str(z.get(feld)) not in wert:
                        passt = False
                        break
                elif str(z.get(feld)) != wert:
                    passt = False
                    break
            if passt:
                out.append(z)
        return out

    def execute(self) -> _Query:
        treffer = self._treffer()
        if getattr(self, "_loeschen", False):
            self._db.daten[self._tabelle] = [
                z for z in self._db.daten.get(self._tabelle, [])
                if z not in treffer
            ]
        self.data = treffer
        return self


class _Db:
    """Supabase-Stub mit Schreibprotokoll."""

    def __init__(self, daten: dict[str, list[dict[str, Any]]]) -> None:
        self.daten = daten
        self.eingefuegt: list[tuple[str, dict[str, Any]]] = []
        self.aktualisiert: list[tuple[str, dict[str, Any]]] = []
        self.geloescht: list[str] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)


# ---------------------------------------------------------------------------
# 1. tax_sync._kanalplaene_nachziehen — Gegenzustand pflegen
# ---------------------------------------------------------------------------


class _TaxSync(TaxSyncMixin):
    """Nur die Bausteine, die `_kanalplaene_nachziehen` braucht."""

    def __init__(self, *, kanal: str | None, swap_wirft: Exception | None = None):
        self._kanal = kanal
        self._swap_wirft = swap_wirft
        self.swaps: list[tuple[str, str]] = []
        self.content_syncs = 0

    # Kanal-Stand
    def _kanal_id_fuer_portal(self, _db, _t, _p, _portal):  # type: ignore[override]
        return self._kanal

    def _primary_rate_plan_id(self, _db, _t, _p):  # type: ignore[override]
        return "rp-grund"

    def _channex_id_for_local_plan(self, _db, _t, lokal):  # type: ignore[override]
        return f"cx-{lokal}"

    def _swap_channel_rate_plan(self, _db, _t, _kanal, *, von_lokal, nach_lokal):
        if self._swap_wirft:
            raise self._swap_wirft
        self.swaps.append((von_lokal, nach_lokal))

    def sync_content(self, _tenant, *, property_id):  # type: ignore[override]
        self.content_syncs += 1
        return {"channex_property_id": property_id}

    def _portal_scope_je_channex_plan(self, db, _t, property_id):  # type: ignore[override]
        return {
            f"cx-{z['id']}": z["portal_scope"]
            for z in db.daten.get("rate_plans", [])
            if z.get("property_id") == property_id and z.get("portal_scope")
        }


def _rate_plans() -> dict[str, list[dict[str, Any]]]:
    return {
        "rate_plans": [
            {
                "id": "rp-grund", "property_id": "prop-1", "portal_scope": None,
                "name": "Grundpreis", "base_price": 900, "currency": "DKK",
                "min_stay": 2, "created_at": "2026-01-01",
            },
        ],
    }


def test_plan_wird_am_kanal_zugeordnet() -> None:
    """Der Regelfall: Plan angelegt UND am Kanal zugeordnet.

    Ohne den Swap wäre der Plan genau die Attrappe, die live 18-mal stand.
    """
    db = _Db(_rate_plans())
    dienst = _TaxSync(kanal="chan-1")

    wirksam = dienst._kanalplaene_nachziehen(db, "t1", "prop-1", [BOOKING])

    assert dienst.swaps, (
        "Der Plan muss am Kanal zugeordnet werden — sonst liest ihn kein "
        "Portal und jeder ARI-Push läuft doppelt."
    )
    von, nach = dienst.swaps[0]
    assert von == "rp-grund"
    assert wirksam, "Ein zugeordneter Plan muss als wirksam zurückkommen."
    assert nach in [z["id"] for z in db.daten["rate_plans"]]


def test_ohne_kanal_kein_plan() -> None:
    """Kein verbundener Kanal → gar kein Plan (Wurzel 1, alles oder nichts).

    Ein Plan ohne Kanal kann von Geburt an nichts tragen: sein Tax-Set erreicht
    kein Portal, sein Preis wird doppelt gepusht.
    """
    db = _Db(_rate_plans())
    dienst = _TaxSync(kanal=None)

    wirksam = dienst._kanalplaene_nachziehen(db, "t1", "prop-1", [BOOKING])

    assert wirksam == []
    assert not [
        z for z in db.daten["rate_plans"] if z.get("portal_scope") == BOOKING
    ], "Ohne Kanal darf keine portal_scope-Zeile entstehen."
    assert dienst.content_syncs == 0, (
        "Kein Plan, kein Content-Sync — sonst verbrennt der Lauf "
        "Channex-Budget für nichts."
    )


def test_fehlgeschlagene_zuordnung_wird_zurueckgenommen() -> None:
    """Scheitert der Swap, verschwindet der Plan wieder.

    Bliebe die Zeile stehen, hielte der nächste Lauf den Plan für vorhanden
    (Idempotenz-Prüfung) und legte ihn nie wieder an — die Attrappe wäre
    dauerhaft, genau wie live.
    """
    db = _Db(_rate_plans())
    dienst = _TaxSync(
        kanal="chan-1",
        swap_wirft=ChannelManagerError("keine Rate zugeordnet", status_code=422),
    )

    wirksam = dienst._kanalplaene_nachziehen(db, "t1", "prop-1", [BOOKING])

    assert wirksam == []
    assert not [
        z for z in db.daten["rate_plans"] if z.get("portal_scope") == BOOKING
    ], "Der nicht zugeordnete Plan MUSS zurückgenommen werden."
    assert "channex_rate_plan_map" in [t for t, _ in db.aktualisiert], (
        "Auch das Channex-Gegenstück wird stillgelegt, sonst bleibt bei "
        "Channex eine Rate ohne lokale Zeile stehen."
    )


def test_vorhandener_plan_wird_nicht_gedoppelt() -> None:
    """Idempotent (Wurzel 2): ein zweiter Lauf legt nichts nach."""
    daten = _rate_plans()
    daten["rate_plans"].append({
        "id": "rp-booking", "property_id": "prop-1", "portal_scope": BOOKING,
        "name": "Grundpreis · BookingCom", "offset_percent": 0,
        "created_at": "2026-01-02",
    })
    db = _Db(daten)
    dienst = _TaxSync(kanal="chan-1")

    dienst._kanalplaene_nachziehen(db, "t1", "prop-1", [BOOKING])

    assert not db.eingefuegt, "Ein vorhandener Kanal-Plan darf nicht gedoppelt werden."


# ---------------------------------------------------------------------------
# 2. objekt_kanal — der 0-%-Rückweg muss verifizieren
# ---------------------------------------------------------------------------


class _Channex:
    def __init__(self, plans: list[str]) -> None:
        self._plans = plans

    def get_channel(self, _cid: str) -> dict[str, Any]:
        return {
            "data": {
                "attributes": {
                    "rate_plans": [{"rate_plan_id": p} for p in self._plans]
                }
            }
        }


class _ObjektKanal(ObjektKanalMixin):
    def __init__(self, plans: list[str]) -> None:
        self._channex = _Channex(plans)  # type: ignore[assignment]

    def _primary_rate_plan_id(self, _db, _t, _p):  # type: ignore[override]
        return "rp-grund"

    @staticmethod
    def _channex_id_for_local_plan(_db, _t, lokal):  # type: ignore[override]
        return f"cx-{lokal}"


def test_rueckweg_ok_wenn_grundpreis_am_kanal_steht() -> None:
    """Der gewünschte Endzustand: Kanal-Rate weg, Grundpreis da."""
    db = _Db({"rate_plans": [{"id": "rp-grund", "property_id": "prop-1"}]})
    _ObjektKanal(["cx-rp-grund"])._rueckweg_pruefen(
        db, "t1", "prop-1", BOOKING,
        channel_id="chan-1", kanalplan_id="rp-booking",
        kanalplan_channex_id="cx-rp-booking",
    )


def test_rueckweg_faellt_laut_aus_wenn_zeile_bleibt() -> None:
    """Die lokale Zeile lebt weiter → laut fehlschlagen, nicht `percent: 0`.

    Genau das war der stille Pfad: die Detailsicht liest `offset_percent`
    dieser Zeile, `_selected_rate_plan_ids` nimmt sie als Primary. Ein
    unbelegtes „zurückgenommen" ist schlimmer als ein Fehler.
    """
    db = _Db({
        "rate_plans": [
            {"id": "rp-grund", "property_id": "prop-1"},
            {"id": "rp-booking", "property_id": "prop-1", "portal_scope": BOOKING},
        ]
    })
    with pytest.raises(ChannelManagerError) as fehler:
        _ObjektKanal(["cx-rp-grund"])._rueckweg_pruefen(
            db, "t1", "prop-1", BOOKING,
            channel_id="chan-1", kanalplan_id="rp-booking",
            kanalplan_channex_id="cx-rp-booking",
        )
    assert fehler.value.status_code == 500


def test_rueckweg_faellt_aus_wenn_kanal_die_rate_noch_liest() -> None:
    """Kanal trägt die Kanal-Rate weiter → doppelter Push, also Fehler."""
    db = _Db({"rate_plans": [{"id": "rp-grund", "property_id": "prop-1"}]})
    with pytest.raises(ChannelManagerError):
        _ObjektKanal(["cx-rp-grund", "cx-rp-booking"])._rueckweg_pruefen(
            db, "t1", "prop-1", BOOKING,
            channel_id="chan-1", kanalplan_id="rp-booking",
            kanalplan_channex_id="cx-rp-booking",
        )


def test_rueckweg_faellt_aus_wenn_kanal_leer_bleibt() -> None:
    """Leerer Kanal ist kein guter Endzustand.

    Channex-Doku: „if an unmapped rate is booked on a connected channel, the
    reservation will not be sent through" — eine unbelegte Rate verschluckt
    eine Buchung.
    """
    db = _Db({"rate_plans": [{"id": "rp-grund", "property_id": "prop-1"}]})
    with pytest.raises(ChannelManagerError):
        _ObjektKanal([])._rueckweg_pruefen(
            db, "t1", "prop-1", BOOKING,
            channel_id="chan-1", kanalplan_id="rp-booking",
            kanalplan_channex_id="cx-rp-booking",
        )


# ---------------------------------------------------------------------------
# 3. channels._kanalplan_mit_aufschlag — der Zuordnung nicht trauen
# ---------------------------------------------------------------------------


def test_null_prozent_plan_wird_nicht_primary() -> None:
    """0 % heißt: preislich identisch zum Grundpreis, kein Primary.

    Der Live-Zustand: alle 18 Zeilen trugen `offset_percent = 0.000`. Sie
    verdrängten trotzdem den Grundpreis aus dem Kanal-Array — der Kanal bekam
    einen Plan, den er nicht gemappt hatte, während der Plan, den er las, aus
    der Zuordnung fiel.
    """
    db = _Db({
        "rate_plans": [{
            "id": "rp-booking", "property_id": "prop-1", "portal_scope": BOOKING,
            "offset_percent": 0, "offset_amount": None,
        }]
    })
    assert ChannelsMixin._kanalplan_mit_aufschlag(db, "prop-1", BOOKING) is False


def test_echter_prozent_aufschlag_wird_primary() -> None:
    """Ein echter Aufschlag MUSS weiterhin Primary werden (0272 bleibt intakt)."""
    db = _Db({
        "rate_plans": [{
            "id": "rp-booking", "property_id": "prop-1", "portal_scope": BOOKING,
            "offset_percent": "12.500", "offset_amount": None,
        }]
    })
    assert ChannelsMixin._kanalplan_mit_aufschlag(db, "prop-1", BOOKING) is True


def test_betrags_aufschlag_zaehlt_auch() -> None:
    """Der Aufschlag kann ein BETRAG sein, nicht nur ein Prozentsatz."""
    db = _Db({
        "rate_plans": [{
            "id": "rp-booking", "property_id": "prop-1", "portal_scope": BOOKING,
            "offset_percent": None, "offset_amount": "50",
        }]
    })
    assert ChannelsMixin._kanalplan_mit_aufschlag(db, "prop-1", BOOKING) is True


def test_ohne_portal_kein_kanalplan() -> None:
    """`portal_code=None` (Standard-Zuordnung) hat nie einen Kanal-Plan."""
    db = _Db({"rate_plans": []})
    assert ChannelsMixin._kanalplan_mit_aufschlag(db, "prop-1", None) is False


def test_unlesbarer_wert_ist_kein_aufschlag() -> None:
    """Fail-closed (Wurzel 5): Müll im Feld beweist keinen Aufschlag."""
    db = _Db({
        "rate_plans": [{
            "id": "rp-booking", "property_id": "prop-1", "portal_scope": BOOKING,
            "offset_percent": "keine Zahl", "offset_amount": None,
        }]
    })
    assert ChannelsMixin._kanalplan_mit_aufschlag(db, "prop-1", BOOKING) is False
