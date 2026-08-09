"""Tests für owner_billing — Klassifikation + Abrechnungsvertrag.

Geprüft wird, was an diesem Slice fachlich tragen muss und nicht schon von der
DB erzwungen wird: der tenant-Scope (die Service-Role umgeht RLS, Wurzel 3),
das Vorrangprinzip Objekt-vor-Eigentümer auf BEIDEN Ebenen, die Auswahl nach
Stichtag auf der Zeitachse, und dass eine fehlende Klassifikation zu einem
Fehler führt statt zu einem geratenen Wert (Wurzel 4).

Die In-Memory-Attrappe bildet nur die Operatoren nach, die der Service
wirklich benutzt. Was sie NICHT nachbildet, steht als CHECK/EXCLUDE in der
Migration und ist live gegen die Server-DB belegt — ein Test gegen die
Attrappe wäre dort ein Test der Attrappe.
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.owner_billing.schemas import (
    FeeClassificationBatchUpsert,
    FeeClassificationUpsert,
    OwnerBillingTermsCreate,
    OwnerBillingTermsUpdate,
)
from src.features.owner_billing.service import (
    BillingError,
    KlassifikationFehlt,
    OwnerBillingService,
)
from src.main import create_app

client = TestClient(create_app())


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    """Nachbau der PostgREST-Kette — nur die benutzten Operatoren."""

    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._is_null: list[str] = []
        self._lte: list[tuple[str, str]] = []
        self._order: str | None = None
        self._desc = False

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._op = "select"
        return self

    def insert(self, payload: dict) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict) -> "_Query":
        self._op = "update"
        self._payload = payload
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def is_(self, col: str, _val: str) -> "_Query":
        # Der Service ruft `is_("property_id", "null")` — der einzige Weg, in
        # PostgREST auf NULL zu filtern. Ein `eq(col, None)` wäre etwas
        # anderes und träfe nichts.
        self._is_null.append(col)
        return self

    def lte(self, col: str, val: str) -> "_Query":
        self._lte.append((col, val))
        return self

    def order(self, col: str, desc: bool = False, **_k: object) -> "_Query":
        self._order = col
        self._desc = desc
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def _match(self, row: dict) -> bool:
        if not all(str(row.get(c)) == str(v) for c, v in self._filters):
            return False
        if not all(row.get(c) is None for c in self._is_null):
            return False
        return all(str(row.get(c) or "") <= v for c, v in self._lte)

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            row = dict(self._payload or {})
            row.setdefault("id", f"{self._table}-{self._db.next_id()}")
            row.setdefault("created_at", "2026-08-09T00:00:00Z")
            row.setdefault("updated_at", "2026-08-09T00:00:00Z")
            row.setdefault("zugeordnet_am", "2026-08-09T00:00:00Z")
            rows.append(row)
            return _Result([row])
        selected = [r for r in rows if self._match(r)]
        if self._op == "update":
            for r in selected:
                r.update(self._payload or {})
            return _Result(selected)
        if self._op == "delete":
            self._db.tables[self._table] = [
                r for r in rows if not self._match(r)
            ]
            return _Result(selected)
        if self._order:
            selected = sorted(
                selected,
                key=lambda r: str(r.get(self._order) or ""),
                reverse=self._desc,
            )
        return _Result(selected)


class _DB:
    def __init__(self, tables: dict[str, list[dict]] | None = None) -> None:
        self.tables: dict[str, list[dict]] = tables or {}
        self._counter = 0

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _svc(tables: dict[str, list[dict]] | None = None) -> OwnerBillingService:
    base: dict[str, list[dict]] = {
        "owners": [{"id": "o-1", "tenant_id": "t-1", "name": "Hansen"}],
        "owner_properties": [{"owner_id": "o-1", "property_id": "p-1"}],
        "properties": [
            {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
            {"id": "p-2", "tenant_id": "t-1", "title": "Hütte"},
        ],
        "property_pricing_config": [],
        "fee_classification": [],
        "owner_billing_terms": [],
    }
    if tables:
        base.update(tables)
    return OwnerBillingService(service_client=_DB(base))  # type: ignore[arg-type]


# ----------------------------------------------------------------------
# Health / Mount
# ----------------------------------------------------------------------


def test_health_ist_gemountet() -> None:
    res = client.get("/api/v1/owner-billing/health")
    assert res.status_code == 200
    assert res.json()["slice"] == "owner_billing"


def test_endpunkte_verlangen_authentifizierung() -> None:
    """Ohne Token kein Zugriff — die Konditionen sind kein offener Bereich."""
    for methode, pfad in (
        ("get", "/api/v1/owner-billing/fee-classification"),
        ("get", "/api/v1/owner-billing/owners/o-1/terms"),
        ("delete", "/api/v1/owner-billing/terms/x"),
    ):
        res = getattr(client, methode)(pfad)
        assert res.status_code in (401, 403), f"{methode} {pfad}"


# ----------------------------------------------------------------------
# Tenant-Scope (Wurzel 3)
# ----------------------------------------------------------------------


def test_ohne_tenant_kein_zugriff() -> None:
    with pytest.raises(BillingError) as exc:
        _svc().uebersicht(_ctx(tenant=None))
    assert exc.value.status_code == 400


def test_fremder_eigentuemer_ist_nicht_gefunden() -> None:
    """Ein fremder Mandant ergibt 404, nicht 403.

    Ein 403 wäre die Auskunft, dass es die ID gibt.
    """
    svc = _svc({"owners": [{"id": "o-9", "tenant_id": "t-FREMD", "name": "X"}]})
    with pytest.raises(BillingError) as exc:
        svc.vertraege_liste(_ctx(), "o-9")
    assert exc.value.status_code == 404


def test_fremder_vertrag_ist_nicht_aenderbar() -> None:
    """Item-Scope = List-Scope (Wurzel 9): kein IDOR über die reine ID."""
    svc = _svc(
        {
            "owner_billing_terms": [
                {
                    "id": "v-fremd",
                    "tenant_id": "t-FREMD",
                    "owner_id": "o-9",
                    "property_id": None,
                    "gueltig_ab": "2026-01-01",
                    "gueltig_bis": None,
                    "provisions_pct": 20,
                }
            ]
        }
    )
    with pytest.raises(BillingError) as exc:
        svc.vertrag_aendern(
            _ctx(), "v-fremd", OwnerBillingTermsUpdate(provisions_pct=0)
        )
    assert exc.value.status_code == 404
    # Und die fremde Zeile steht unverändert.
    assert svc._db.tables["owner_billing_terms"][0]["provisions_pct"] == 20  # noqa: SLF001


def test_fremdes_objekt_kann_nicht_klassifiziert_werden() -> None:
    svc = _svc({"properties": [{"id": "p-x", "tenant_id": "t-FREMD"}]})
    with pytest.raises(BillingError) as exc:
        svc.klassifikation_setzen(
            _ctx(),
            FeeClassificationBatchUpsert(
                items=[
                    FeeClassificationUpsert(
                        fee_type="cleaning_fee",
                        property_id="p-x",
                        gehoert_zu="betrieb",
                        provisionspflichtig=False,
                    )
                ]
            ),
        )
    assert exc.value.status_code == 404


# ----------------------------------------------------------------------
# Klassifikation
# ----------------------------------------------------------------------


def test_uebersicht_zeigt_bestandsarten_mit_anzahl() -> None:
    """Die Maske zeigt, wie viele Gebühren eine Entscheidung betrifft."""
    svc = _svc(
        {
            "property_pricing_config": [
                {
                    "tenant_id": "t-1",
                    "fees": [
                        {"feeType": "cleaning_fee", "name": "Reinigung"},
                        {"feeType": "resort", "name": "Nebenkosten"},
                    ],
                },
                {
                    "tenant_id": "t-1",
                    "fees": [{"feeType": "cleaning_fee", "name": "Reinigung"}],
                },
                # Fremder Mandant darf die Maske nicht mitprägen.
                {"tenant_id": "t-2", "fees": [{"feeType": "pet_fee"}]},
            ]
        }
    )
    uebersicht = svc.uebersicht(_ctx())
    nach_art = {i.fee_type: i for i in uebersicht.items}
    assert nach_art["cleaning_fee"].anzahl == 2
    assert nach_art["resort"].anzahl == 1
    assert "pet_fee" not in nach_art
    assert nach_art["cleaning_fee"].beispiel_namen == ["Reinigung"]
    # Beide Arten sind unzugeordnet → beide offen.
    assert uebersicht.offen == 2


def test_gebuehr_ohne_feetype_laeuft_unter_unknown() -> None:
    """Altbestand verschwindet nicht still, sondern wird eine offene Aufgabe."""
    svc = _svc(
        {
            "property_pricing_config": [
                {"tenant_id": "t-1", "fees": [{"name": "Irgendwas"}]}
            ]
        }
    )
    uebersicht = svc.uebersicht(_ctx())
    assert [i.fee_type for i in uebersicht.items] == ["unknown"]
    assert uebersicht.offen == 1


def test_zuordnung_senkt_die_zahl_der_offenen_punkte() -> None:
    svc = _svc(
        {
            "property_pricing_config": [
                {"tenant_id": "t-1", "fees": [{"feeType": "cleaning_fee"}]}
            ]
        }
    )
    assert svc.uebersicht(_ctx()).offen == 1
    nachher = svc.klassifikation_setzen(
        _ctx(),
        FeeClassificationBatchUpsert(
            items=[
                FeeClassificationUpsert(
                    fee_type="cleaning_fee",
                    gehoert_zu="betrieb",
                    provisionspflichtig=False,
                )
            ]
        ),
    )
    assert nachher.offen == 0
    eintrag = nachher.items[0].klassifikation
    assert eintrag is not None
    assert eintrag.gehoert_zu == "betrieb"
    assert eintrag.provisionspflichtig is False
    assert eintrag.zugeordnet_von == "u-1"


def test_zweites_setzen_aendert_statt_zu_verdoppeln() -> None:
    """Idempotenz (Wurzel 2): Doppelklick legt keine zweite Regel an."""
    svc = _svc()
    req = FeeClassificationBatchUpsert(
        items=[
            FeeClassificationUpsert(
                fee_type="resort",
                gehoert_zu="eigentuemer",
                provisionspflichtig=False,
            )
        ]
    )
    svc.klassifikation_setzen(_ctx(), req)
    svc.klassifikation_setzen(_ctx(), req)
    assert len(svc._db.tables["fee_classification"]) == 1  # noqa: SLF001


def test_doppelte_art_im_selben_aufruf_ist_422() -> None:
    with pytest.raises(BillingError) as exc:
        _svc().klassifikation_setzen(
            _ctx(),
            FeeClassificationBatchUpsert(
                items=[
                    FeeClassificationUpsert(
                        fee_type="resort",
                        gehoert_zu="betrieb",
                        provisionspflichtig=True,
                    ),
                    FeeClassificationUpsert(
                        fee_type="resort",
                        gehoert_zu="eigentuemer",
                        provisionspflichtig=False,
                    ),
                ]
            ),
        )
    assert exc.value.status_code == 422


def test_unbekannte_gebuehrenart_ist_422() -> None:
    """Eine Regel für eine erfundene Art wäre eine Zeile, die nie greift."""
    with pytest.raises(BillingError) as exc:
        _svc().klassifikation_setzen(
            _ctx(),
            FeeClassificationBatchUpsert(
                items=[
                    FeeClassificationUpsert(
                        fee_type="gibt_es_nicht",
                        gehoert_zu="betrieb",
                        provisionspflichtig=True,
                    )
                ]
            ),
        )
    assert exc.value.status_code == 422


def test_nichts_wird_geschrieben_wenn_eine_zeile_faellt() -> None:
    """Alles-oder-nichts: keine halb gespeicherte Maske."""
    svc = _svc()
    with pytest.raises(BillingError):
        svc.klassifikation_setzen(
            _ctx(),
            FeeClassificationBatchUpsert(
                items=[
                    FeeClassificationUpsert(
                        fee_type="cleaning_fee",
                        gehoert_zu="betrieb",
                        provisionspflichtig=False,
                    ),
                    FeeClassificationUpsert(
                        fee_type="gibt_es_nicht",
                        gehoert_zu="betrieb",
                        provisionspflichtig=True,
                    ),
                ]
            ),
        )
    assert svc._db.tables["fee_classification"] == []  # noqa: SLF001


def test_fehlende_klassifikation_wirft_statt_zu_raten() -> None:
    """Der Kern von Wurzel 4 an dieser Stelle.

    Die naheliegende Unterstellung wäre „eigentuemer + provisionspflichtig".
    Sie sähe plausibel aus und wäre bei jeder Reinigungsgebühr falsch.
    """
    with pytest.raises(KlassifikationFehlt) as exc:
        _svc().klassifikation_aufloesen("t-1", "cleaning_fee", None)
    assert exc.value.fee_type == "cleaning_fee"


def test_objekt_ausnahme_schlaegt_betriebsregel() -> None:
    svc = _svc(
        {
            "fee_classification": [
                {
                    "id": "k-1",
                    "tenant_id": "t-1",
                    "fee_type": "cleaning_fee",
                    "property_id": None,
                    "gehoert_zu": "betrieb",
                    "provisionspflichtig": False,
                },
                {
                    "id": "k-2",
                    "tenant_id": "t-1",
                    "fee_type": "cleaning_fee",
                    "property_id": "p-1",
                    "gehoert_zu": "eigentuemer",
                    "provisionspflichtig": True,
                },
            ]
        }
    )
    # Objekt mit Ausnahme.
    assert svc.klassifikation_aufloesen("t-1", "cleaning_fee", "p-1") == (
        "eigentuemer",
        True,
    )
    # Objekt ohne Ausnahme fällt auf die Betriebsregel.
    assert svc.klassifikation_aufloesen("t-1", "cleaning_fee", "p-2") == (
        "betrieb",
        False,
    )
    # Ohne Objektbezug gilt die Betriebsregel.
    assert svc.klassifikation_aufloesen("t-1", "cleaning_fee", None) == (
        "betrieb",
        False,
    )


def test_klassifikation_ist_tenant_gescoped() -> None:
    """Die Regel eines fremden Betriebs darf hier nicht greifen."""
    svc = _svc(
        {
            "fee_classification": [
                {
                    "id": "k-9",
                    "tenant_id": "t-FREMD",
                    "fee_type": "resort",
                    "property_id": None,
                    "gehoert_zu": "betrieb",
                    "provisionspflichtig": False,
                }
            ]
        }
    )
    with pytest.raises(KlassifikationFehlt):
        svc.klassifikation_aufloesen("t-1", "resort", None)


def test_die_beiden_achsen_sind_unabhaengig() -> None:
    """Nebenkosten und Miete gehören beide dem Eigentümer — nur eine ist
    provisionspflichtig. Mit einer einzigen Achse wäre das nicht darstellbar."""
    svc = _svc()
    svc.klassifikation_setzen(
        _ctx(),
        FeeClassificationBatchUpsert(
            items=[
                FeeClassificationUpsert(
                    fee_type="resort",
                    gehoert_zu="eigentuemer",
                    provisionspflichtig=False,
                ),
                FeeClassificationUpsert(
                    fee_type="rent",
                    gehoert_zu="eigentuemer",
                    provisionspflichtig=True,
                ),
                FeeClassificationUpsert(
                    fee_type="cleaning_fee",
                    gehoert_zu="betrieb",
                    provisionspflichtig=False,
                ),
            ]
        ),
    )
    assert svc.klassifikation_aufloesen("t-1", "resort", None) == (
        "eigentuemer",
        False,
    )
    assert svc.klassifikation_aufloesen("t-1", "rent", None) == (
        "eigentuemer",
        True,
    )
    assert svc.klassifikation_aufloesen("t-1", "cleaning_fee", None) == (
        "betrieb",
        False,
    )


def test_loeschen_macht_die_art_wieder_offen() -> None:
    svc = _svc(
        {
            "property_pricing_config": [
                {"tenant_id": "t-1", "fees": [{"feeType": "resort"}]}
            ]
        }
    )
    svc.klassifikation_setzen(
        _ctx(),
        FeeClassificationBatchUpsert(
            items=[
                FeeClassificationUpsert(
                    fee_type="resort",
                    gehoert_zu="eigentuemer",
                    provisionspflichtig=False,
                )
            ]
        ),
    )
    zeile = svc._db.tables["fee_classification"][0]  # noqa: SLF001
    nachher = svc.klassifikation_loeschen(_ctx(), str(zeile["id"]))
    assert nachher.offen == 1


def test_fremde_zuordnung_ist_nicht_loeschbar() -> None:
    svc = _svc(
        {
            "fee_classification": [
                {
                    "id": "k-9",
                    "tenant_id": "t-FREMD",
                    "fee_type": "resort",
                    "property_id": None,
                    "gehoert_zu": "betrieb",
                    "provisionspflichtig": True,
                }
            ]
        }
    )
    with pytest.raises(BillingError) as exc:
        svc.klassifikation_loeschen(_ctx(), "k-9")
    assert exc.value.status_code == 404
    assert len(svc._db.tables["fee_classification"]) == 1  # noqa: SLF001


# ----------------------------------------------------------------------
# Abrechnungsvertrag — Schema-Zusammenhänge
# ----------------------------------------------------------------------


def test_provisions_pct_hat_keinen_default() -> None:
    """Ein Vertrag ohne Satz ist kein Vertrag — und kein 0-%-Vertrag."""
    with pytest.raises(ValidationError):
        OwnerBillingTermsCreate(gueltig_ab=date(2026, 1, 1))  # type: ignore[call-arg]


def test_gueltig_bis_muss_nach_gueltig_ab_liegen() -> None:
    with pytest.raises(ValidationError):
        OwnerBillingTermsCreate(
            provisions_pct=20,
            gueltig_ab=date(2026, 7, 1),
            gueltig_bis=date(2026, 7, 1),
        )


def test_mindestprovision_braucht_betrag_und_waehrung() -> None:
    """Eine Zahl ohne Währung ist kein Geldbetrag (Wurzel 4)."""
    with pytest.raises(ValidationError):
        OwnerBillingTermsCreate(
            provisions_pct=20,
            gueltig_ab=date(2026, 1, 1),
            min_provision_betrag=250,
        )


def test_pauschale_ist_alles_oder_nichts() -> None:
    """Ein Betrag ohne Zeitpunkt wäre nicht ausrechenbar."""
    with pytest.raises(ValidationError):
        OwnerBillingTermsCreate(
            provisions_pct=20,
            gueltig_ab=date(2026, 1, 1),
            pauschale_betrag=50,
            pauschale_currency="DKK",
            pauschale_basis="je_buchung",
        )


def test_pauschale_vollstaendig_ist_gueltig() -> None:
    req = OwnerBillingTermsCreate(
        provisions_pct=20,
        gueltig_ab=date(2026, 1, 1),
        pauschale_betrag=50,
        pauschale_currency="dkk",
        pauschale_basis="je_buchung",
        pauschale_zeitpunkt="nach_provision",
    )
    # Der Code wird normalisiert, nicht ersetzt.
    assert req.pauschale_currency == "DKK"


def test_waehrung_muss_iso_4217_sein() -> None:
    with pytest.raises(ValidationError):
        OwnerBillingTermsCreate(
            provisions_pct=20,
            gueltig_ab=date(2026, 1, 1),
            min_provision_betrag=250,
            min_provision_currency="Kronen",
        )


def test_keine_pauschale_ist_ein_gueltiger_vertrag() -> None:
    """Die Pauschale ist bewusst optional."""
    req = OwnerBillingTermsCreate(
        provisions_pct=20, gueltig_ab=date(2026, 1, 1)
    )
    assert req.pauschale_betrag is None
    assert req.min_provision_betrag is None


# ----------------------------------------------------------------------
# Abrechnungsvertrag — Zeitachse und Vorrang
# ----------------------------------------------------------------------


def _vertrag(
    svc: OwnerBillingService,
    *,
    ab: date,
    bis: date | None = None,
    pct: float = 20,
    property_id: str | None = None,
) -> str:
    res = svc.vertrag_anlegen(
        _ctx(),
        "o-1",
        OwnerBillingTermsCreate(
            provisions_pct=pct,
            gueltig_ab=ab,
            gueltig_bis=bis,
            property_id=property_id,
        ),
    )
    return res.id


def test_vertrag_anlegen_und_historie_lesen() -> None:
    svc = _svc()
    _vertrag(svc, ab=date(2026, 1, 1), bis=date(2026, 7, 1), pct=15)
    _vertrag(svc, ab=date(2026, 7, 1), pct=20)
    historie = svc.vertraege_liste(_ctx(), "o-1")
    # Neuester zuerst — und BEIDE sind da, nicht nur der aktuelle.
    assert [v.provisions_pct for v in historie.items] == [20, 15]


def test_zeitachse_waehlt_nach_stichtag() -> None:
    """Ein Juli-Statement rechnet mit dem Juli-Vertrag, egal wann es entsteht."""
    svc = _svc()
    _vertrag(svc, ab=date(2026, 1, 1), bis=date(2026, 7, 1), pct=15)
    _vertrag(svc, ab=date(2026, 7, 1), pct=20)

    juni = svc.vertrag_aufloesen("t-1", "o-1", None, date(2026, 6, 15))
    juli = svc.vertrag_aufloesen("t-1", "o-1", None, date(2026, 7, 15))
    assert juni is not None and float(juni["provisions_pct"]) == 15
    assert juli is not None and float(juli["provisions_pct"]) == 20


def test_intervall_ist_halb_offen() -> None:
    """Der Endtag gehört schon zum Folgevertrag — kein Tag mit zwei Verträgen."""
    svc = _svc()
    _vertrag(svc, ab=date(2026, 1, 1), bis=date(2026, 7, 1), pct=15)
    _vertrag(svc, ab=date(2026, 7, 1), pct=20)
    am_stichtag = svc.vertrag_aufloesen("t-1", "o-1", None, date(2026, 7, 1))
    assert am_stichtag is not None
    assert float(am_stichtag["provisions_pct"]) == 20


def test_vor_dem_ersten_vertrag_gibt_es_keinen() -> None:
    """`None` statt eines Standardsatzes — beim Umstieg ein klarer Fehler."""
    svc = _svc()
    _vertrag(svc, ab=date(2026, 7, 1), pct=20)
    assert svc.vertrag_aufloesen("t-1", "o-1", None, date(2026, 6, 1)) is None


def test_objektvertrag_schlaegt_eigentuemervertrag() -> None:
    svc = _svc()
    _vertrag(svc, ab=date(2026, 1, 1), pct=20)
    _vertrag(svc, ab=date(2026, 1, 1), pct=12, property_id="p-1")

    mit_objekt = svc.vertrag_aufloesen("t-1", "o-1", "p-1", date(2026, 6, 1))
    ohne = svc.vertrag_aufloesen("t-1", "o-1", "p-2", date(2026, 6, 1))
    assert mit_objekt is not None and float(mit_objekt["provisions_pct"]) == 12
    # Ein Objekt ohne eigenen Vertrag fällt auf den Eigentümer-Vertrag.
    assert ohne is not None and float(ohne["provisions_pct"]) == 20


def test_ueberlappende_vertraege_werden_abgelehnt() -> None:
    """Zwei gültige Verträge am selben Tag ließen die Auflösung raten."""
    svc = _svc()
    _vertrag(svc, ab=date(2026, 1, 1), bis=date(2026, 7, 1))
    with pytest.raises(BillingError) as exc:
        _vertrag(svc, ab=date(2026, 6, 1), bis=date(2026, 9, 1))
    assert exc.value.status_code == 409


def test_unbefristeter_vertrag_blockt_jeden_spaeteren() -> None:
    svc = _svc()
    _vertrag(svc, ab=date(2026, 1, 1))
    with pytest.raises(BillingError) as exc:
        _vertrag(svc, ab=date(2027, 1, 1))
    assert exc.value.status_code == 409


def test_lueckenloser_anschluss_ist_erlaubt() -> None:
    """Der Normalfall der Ablösung darf nicht als Überlappung gelten."""
    svc = _svc()
    _vertrag(svc, ab=date(2026, 1, 1), bis=date(2026, 7, 1))
    _vertrag(svc, ab=date(2026, 7, 1))
    assert len(svc.vertraege_liste(_ctx(), "o-1").items) == 2


def test_objektvertrag_kollidiert_nicht_mit_eigentuemervertrag() -> None:
    """Verschiedene Geltungen sind getrennte Achsen — sonst könnte ein Objekt
    nie abweichend abgerechnet werden."""
    svc = _svc()
    _vertrag(svc, ab=date(2026, 1, 1))
    _vertrag(svc, ab=date(2026, 1, 1), property_id="p-1")
    assert len(svc.vertraege_liste(_ctx(), "o-1").items) == 2


def test_vertrag_auf_fremdes_objekt_wird_abgelehnt() -> None:
    """Er würde nie greifen — die Auflösung steigt über den Eigentümer ein."""
    svc = _svc()
    with pytest.raises(BillingError) as exc:
        _vertrag(svc, ab=date(2026, 1, 1), property_id="p-2")
    assert exc.value.status_code == 422


def test_aktuell_flag_kommt_vom_server() -> None:
    svc = _svc()
    _vertrag(svc, ab=date(2020, 1, 1), bis=date(2020, 7, 1))
    aktuell_id = _vertrag(svc, ab=date(2020, 7, 1))
    nach_flag = {v.id: v.aktuell for v in svc.vertraege_liste(_ctx(), "o-1").items}
    assert nach_flag[aktuell_id] is True
    assert sum(1 for v in nach_flag.values() if v) == 1


# ----------------------------------------------------------------------
# Abrechnungsvertrag — Ändern
# ----------------------------------------------------------------------


def test_satz_korrigieren() -> None:
    svc = _svc()
    vertrag_id = _vertrag(svc, ab=date(2026, 1, 1), pct=20)
    neu = svc.vertrag_aendern(
        _ctx(), vertrag_id, OwnerBillingTermsUpdate(provisions_pct=17.5)
    )
    assert neu.provisions_pct == 17.5
    # Die Geltung bleibt unangetastet.
    assert neu.gueltig_ab == date(2026, 1, 1)


def test_befristung_nachtragen_und_wieder_aufheben() -> None:
    """Ohne den Schalter `unbefristet` ließe sich eine Befristung nie
    entfernen: ein gesendetes `null` ist nicht von „nicht gesendet" zu
    unterscheiden."""
    svc = _svc()
    vertrag_id = _vertrag(svc, ab=date(2026, 1, 1))
    befristet = svc.vertrag_aendern(
        _ctx(),
        vertrag_id,
        OwnerBillingTermsUpdate(gueltig_bis=date(2026, 7, 1)),
    )
    assert befristet.gueltig_bis == date(2026, 7, 1)

    wieder_offen = svc.vertrag_aendern(
        _ctx(), vertrag_id, OwnerBillingTermsUpdate(unbefristet=True)
    )
    assert wieder_offen.gueltig_bis is None


def test_mindestprovision_setzen_und_entfernen() -> None:
    svc = _svc()
    vertrag_id = _vertrag(svc, ab=date(2026, 1, 1))
    mit = svc.vertrag_aendern(
        _ctx(),
        vertrag_id,
        OwnerBillingTermsUpdate(
            min_provision_betrag=250, min_provision_currency="DKK"
        ),
    )
    assert mit.min_provision_betrag == 250
    assert mit.min_provision_currency == "DKK"

    ohne = svc.vertrag_aendern(
        _ctx(), vertrag_id, OwnerBillingTermsUpdate(ohne_min_provision=True)
    )
    assert ohne.min_provision_betrag is None
    assert ohne.min_provision_currency is None


def test_patch_nur_betrag_behaelt_die_waehrung() -> None:
    """Ein PATCH mit nur dem Betrag darf nicht in den DB-CHECK laufen."""
    svc = _svc()
    vertrag_id = _vertrag(svc, ab=date(2026, 1, 1))
    svc.vertrag_aendern(
        _ctx(),
        vertrag_id,
        OwnerBillingTermsUpdate(
            min_provision_betrag=250, min_provision_currency="DKK"
        ),
    )
    neu = svc.vertrag_aendern(
        _ctx(), vertrag_id, OwnerBillingTermsUpdate(min_provision_betrag=300)
    )
    assert neu.min_provision_betrag == 300
    assert neu.min_provision_currency == "DKK"


def test_patch_nur_waehrung_ohne_betrag_ist_422() -> None:
    svc = _svc()
    vertrag_id = _vertrag(svc, ab=date(2026, 1, 1))
    with pytest.raises(BillingError) as exc:
        svc.vertrag_aendern(
            _ctx(),
            vertrag_id,
            OwnerBillingTermsUpdate(min_provision_currency="DKK"),
        )
    assert exc.value.status_code == 422


def test_pauschale_halb_gesendet_ist_422() -> None:
    svc = _svc()
    vertrag_id = _vertrag(svc, ab=date(2026, 1, 1))
    with pytest.raises(BillingError) as exc:
        svc.vertrag_aendern(
            _ctx(), vertrag_id, OwnerBillingTermsUpdate(pauschale_betrag=50)
        )
    assert exc.value.status_code == 422


def test_aendern_darf_keine_ueberlappung_erzeugen() -> None:
    svc = _svc()
    _vertrag(svc, ab=date(2026, 1, 1), bis=date(2026, 7, 1))
    zweiter = _vertrag(svc, ab=date(2026, 7, 1))
    with pytest.raises(BillingError) as exc:
        svc.vertrag_aendern(
            _ctx(), zweiter, OwnerBillingTermsUpdate(gueltig_ab=date(2026, 5, 1))
        )
    assert exc.value.status_code == 409


def test_vertrag_loeschen() -> None:
    svc = _svc()
    vertrag_id = _vertrag(svc, ab=date(2026, 1, 1))
    svc.vertrag_loeschen(_ctx(), vertrag_id)
    assert svc.vertraege_liste(_ctx(), "o-1").items == []


def test_fremder_vertrag_ist_nicht_loeschbar() -> None:
    svc = _svc(
        {
            "owner_billing_terms": [
                {
                    "id": "v-fremd",
                    "tenant_id": "t-FREMD",
                    "owner_id": "o-9",
                    "gueltig_ab": "2026-01-01",
                    "provisions_pct": 20,
                }
            ]
        }
    )
    with pytest.raises(BillingError) as exc:
        svc.vertrag_loeschen(_ctx(), "v-fremd")
    assert exc.value.status_code == 404
    assert len(svc._db.tables["owner_billing_terms"]) == 1  # noqa: SLF001
