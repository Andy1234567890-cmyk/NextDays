"""Tests für die Familienzugänge des Eigentümers (0389).

Schwerpunkt sind die drei Stellen, an denen ein Fehler NICHT auffiele, weil die
Oberfläche trotzdem plausibel aussähe:

  1. Die Agentur darf einen Antrag mit offener Familien-Freigabe weder in der
     Liste sehen NOCH über seine ID entscheiden (Wurzel 9). Ohne den zweiten
     Teil wäre die ganze Stufe bloße Anzeige-Kosmetik.
  2. Die Berichte-Sperre hängt an der ZUORDNUNG, nicht an der Rolle — ein
     Familienmitglied ist `role='owner'` und trüge die Capability sonst.
  3. Ein Familienmitglied darf selbst niemanden einladen und nichts freigeben,
     obwohl es dieselbe Capability (REQUEST_BLOCK) am Endpunkt trägt.

Eigene Fake-DB statt der aus test_public_portal.py: diese hier braucht
`update`, `upsert`, `delete` und `count`, die dort fehlen.
"""

import fnmatch

import pytest

from src.core.security import AuthContext
from src.features.auth.permissions import (
    Capability,
    owner_family_capabilities_for,
)
from src.features.public_portal.familie import (
    MAX_FAMILIE_JE_OBJEKT,
    FamilieError,
    OwnerFamilyService,
)
from src.features.public_portal.service import PortalError, PublicPortalService


class _Result:
    def __init__(self, data: list[dict], count: int | None = None) -> None:
        self.data = data
        self.count = count


class _Query:
    """Fake-PostgREST mit den Operationen, die dieser Slice benutzt."""

    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._gte: tuple[str, str] | None = None
        self._lte: tuple[str, str] | None = None
        self._range: tuple[int, int] | None = None
        self._count = False
        self._on_conflict: str | None = None

    def select(self, *_a: object, **kw: object) -> "_Query":
        self._op = "select"
        self._count = kw.get("count") == "exact"
        return self

    def insert(self, payload: dict) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict) -> "_Query":
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload: dict, on_conflict: str | None = None) -> "_Query":
        self._op = "upsert"
        self._payload = payload
        self._on_conflict = on_conflict
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def ilike(self, col: str, val: object) -> "_Query":
        self._filters.append((col, str(val).lower()))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, vals)
        return self

    # Der Berichts-Pfad grenzt den Zeitraum ein; ohne diese beiden bricht
    # `earnings` mit AttributeError, bevor die Freigabe-Prüfung greift.
    def gte(self, col: str, val: object) -> "_Query":
        self._gte = (col, str(val))
        return self

    def lte(self, col: str, val: object) -> "_Query":
        self._lte = (col, str(val))
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    # Der Berichts-Pfad blättert seitenweise (core.supabase).
    def range(self, start: int, end: int) -> "_Query":
        self._range = (start, end)
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def like(self, col: str, pattern: str) -> "_Query":
        # PostgREST `like` mit `%`-Platzhalter — hier als Muster-Filter.
        self._like = (col, pattern)
        return self

    def _match(self, row: dict) -> bool:
        muster = getattr(self, "_like", None)
        if muster is not None:
            like_col, like_pat = muster
            if not fnmatch.fnmatchcase(
                str(row.get(like_col) or ""), like_pat.replace("%", "*")
            ):
                return False
        ok = all(str(row.get(c)).lower() == str(v).lower() for c, v in self._filters)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        if ok and self._gte:
            ok = str(row.get(self._gte[0])) >= self._gte[1]
        if ok and self._lte:
            ok = str(row.get(self._lte[0])) <= self._lte[1]
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            row = dict(self._payload or {})
            row.setdefault("id", f"{self._table}-{self._db.next_id()}")
            row.setdefault("created_at", "2026-08-13T00:00:00Z")
            rows.append(row)
            return _Result([row])
        if self._op == "upsert":
            payload = dict(self._payload or {})
            schluessel = (self._on_conflict or "").split(",")
            for bestehend in rows:
                if schluessel and all(
                    str(bestehend.get(k)) == str(payload.get(k)) for k in schluessel
                ):
                    bestehend.update(payload)
                    return _Result([bestehend])
            payload.setdefault("id", f"{self._table}-{self._db.next_id()}")
            payload.setdefault("created_at", "2026-08-13T00:00:00Z")
            rows.append(payload)
            return _Result([payload])
        treffer = [r for r in rows if self._match(r)]
        if self._op == "select" and self._range is not None:
            start, end = self._range
            treffer = treffer[start : end + 1]  # PostgREST-range ist inklusiv
        if self._op == "update":
            for r in treffer:
                r.update(self._payload or {})
            return _Result(treffer)
        if self._op == "delete":
            for r in treffer:
                rows.remove(r)
            return _Result(treffer)
        return _Result(treffer, count=len(treffer) if self._count else None)


class _FakeAdmin:
    """Nimmt `delete_user` entgegen, ohne GoTrue zu brauchen."""

    def delete_user(self, _user_id: str) -> None:
        return None


class _FakeAuth:
    def __init__(self) -> None:
        self.admin = _FakeAdmin()


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self._counter = 0

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)


# --- Ausgangslage ------------------------------------------------------------
# owner-1 ist der Eigentümer von prop-1. familie-1 ist seine Tochter mit der
# Stufe 'nutzung' (ohne Berichte). Beide tragen die Rolle 'owner' — genau das
# macht die Tests unten nötig.

OWNER = "owner-1"
FAMILIE = "familie-1"
PROP = "prop-1"
TENANT = "t-1"


def _ctx(user: str) -> AuthContext:
    return AuthContext(user_id=user, tenant_id=TENANT, role="owner")


def _tables(access: str = "nutzung") -> dict[str, list[dict]]:
    return {
        # `tenant_id` ist Pflicht: `_login_zu_email` scoped darauf (Wurzel 3),
        # sonst fände es die Zeile nicht — und ohne Fund liefe die Einladung in
        # den Neuanlage-Pfad statt in die Verknüpfung.
        "users": [
            {"id": OWNER, "tenant_id": TENANT, "role": "owner",
             "email": "vater@example.dk", "full_name": "Vater",
             "permissions": []},
            {"id": FAMILIE, "tenant_id": TENANT, "role": "owner",
             "email": "tochter@example.dk", "full_name": "Tochter",
             "permissions": []},
        ],
        "owner_property_assignments": [
            {"tenant_id": TENANT, "user_id": OWNER, "property_id": PROP},
            {"tenant_id": TENANT, "user_id": FAMILIE, "property_id": PROP},
        ],
        "owner_family_members": [
            {
                "id": "fam-1",
                "tenant_id": TENANT,
                "user_id": FAMILIE,
                "owner_user_id": OWNER,
                "property_id": PROP,
                "access": access,
            }
        ],
        "block_requests": [],
        "properties": [{"id": PROP, "tenant_id": TENANT, "title": "Feriehus"}],
        # Pflicht, kein Testschmuck: `earnings` verlangt die Währung aus den
        # Daten und wirft sonst 422 (Wurzel 4 — es gibt keinen EUR-Fallback).
        "tenants": [{"id": TENANT, "currency": "DKK"}],
        "reservations": [],
    }


def _dienste(access: str = "nutzung") -> tuple[OwnerFamilyService, PublicPortalService, _DB]:
    db = _DB(_tables(access))
    return (
        OwnerFamilyService(service_client=db),
        PublicPortalService(service_client=db),
        db,
    )


# --- Rechte-Matrix -----------------------------------------------------------


def test_stufe_nutzung_hat_keine_berichte() -> None:
    """Die engere Stufe darf den Kalender, aber keine Finanzen."""
    caps = owner_family_capabilities_for("nutzung")
    assert Capability.VIEW_CALENDAR in caps
    assert Capability.REQUEST_BLOCK in caps
    assert Capability.VIEW_OWNER_REPORTS not in caps


def test_stufe_berichte_erweitert_nur_um_geschaeftszahlen() -> None:
    """Die höhere Stufe ist die engere PLUS die Geschäftszahlen — nichts sonst.

    Zwei Fähigkeiten, eine Begründung: Umsatz/Abrechnung (VIEW_OWNER_REPORTS)
    und Auslastung (VIEW_OCCUPANCY_STATS) sind beides Geschäftsleistung des
    Betriebs, nicht Nutzungsplanung der Familie. Die Auslastung steht bewusst
    NICHT in `nutzung`: sie ist zusammen mit dem Grundpreis eine Schätzung des
    Jahresumsatzes und würde die Berichts-Sperre über eine Nebenkennzahl
    umgehen.
    """
    schmal = owner_family_capabilities_for("nutzung")
    breit = owner_family_capabilities_for("nutzung_berichte")
    assert breit - schmal == {
        Capability.VIEW_OWNER_REPORTS,
        Capability.VIEW_OCCUPANCY_STATS,
    }


def test_unbekannte_stufe_gibt_keine_rechte() -> None:
    """Fail-closed: ein Tippfehler in der DB vergibt nichts (Wurzel 5)."""
    assert owner_family_capabilities_for("quatsch") == frozenset()
    assert owner_family_capabilities_for(None) == frozenset()
    assert owner_family_capabilities_for("") == frozenset()


# --- Berichte-Sperre ---------------------------------------------------------


def test_familienmitglied_ohne_freigabe_sieht_keine_berichte() -> None:
    """Die Rolle allein darf die Finanzen NICHT öffnen.

    Das ist der Kern: `role='owner'` trägt VIEW_OWNER_REPORTS aus der
    Rollenmatrix. Ohne die Prüfung an der Zuordnung käme das Mitglied durch.
    """
    _, portal, _ = _dienste(access="nutzung")
    with pytest.raises(PortalError) as exc:
        portal.earnings(_ctx(FAMILIE), __import__("datetime").date(2026, 1, 1),
                        __import__("datetime").date(2026, 12, 31))
    assert exc.value.status_code == 403


def test_familienmitglied_mit_freigabe_sieht_berichte() -> None:
    """Schaltet der Eigentümer die Berichte frei, greift die Sperre nicht mehr."""
    _, portal, _ = _dienste(access="nutzung_berichte")
    # Kein Fehler = durchgelassen. Das Ergebnis selbst prüft der Portal-Test.
    portal.earnings(_ctx(FAMILIE), __import__("datetime").date(2026, 1, 1),
                    __import__("datetime").date(2026, 12, 31))


def test_eigentuemer_selbst_sieht_berichte_immer() -> None:
    """Wer keine Familien-Zeile hat, ist der Eigentümer — er wird nie gesperrt."""
    _, portal, _ = _dienste()
    portal.earnings(_ctx(OWNER), __import__("datetime").date(2026, 1, 1),
                    __import__("datetime").date(2026, 12, 31))


# --- Stufe 1: Freigabe -------------------------------------------------------


def test_antrag_des_mitglieds_wartet_auf_freigabe() -> None:
    """Ein Antrag der Familie startet auf 'offen', nicht bei der Agentur."""
    from datetime import date

    from src.features.public_portal.schemas import BlockRequestCreate

    _, portal, db = _dienste()
    portal.request_block(
        _ctx(FAMILIE),
        BlockRequestCreate(
            property_id=PROP,
            start_date=date(2026, 7, 3),
            end_date=date(2026, 7, 10),
            reason="Sommerferie",
        ),
    )
    zeile = db.tables["block_requests"][0]
    assert zeile["owner_freigabe"] == "offen"
    # Der Status bleibt 'pending' — die Agentur-Stufe ist unberührt.
    assert zeile["status"] == "pending"


def test_antrag_des_eigentuemers_geht_direkt_an_die_agentur() -> None:
    """Sich selbst freizugeben wäre ein Klick ohne Erkenntniswert."""
    from datetime import date

    from src.features.public_portal.schemas import BlockRequestCreate

    _, portal, db = _dienste()
    portal.request_block(
        _ctx(OWNER),
        BlockRequestCreate(
            property_id=PROP,
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 5),
        ),
    )
    assert db.tables["block_requests"][0]["owner_freigabe"] == "nicht_noetig"


def test_eigentuemer_sieht_offenen_antrag_seiner_familie() -> None:
    familie, portal, db = _dienste()
    db.tables["block_requests"].append(
        {
            "id": "br-1", "tenant_id": TENANT, "property_id": PROP,
            "requested_by": FAMILIE, "start_date": "2026-07-03",
            "end_date": "2026-07-10", "status": "pending",
            "owner_freigabe": "offen", "reason": "Sommerferie",
        }
    )
    offen = familie.offene_antraege(_ctx(OWNER))
    assert [a["id"] for a in offen] == ["br-1"]
    # Der Name statt einer UUID — sonst schaut der Eigentümer auf Kauderwelsch.
    assert familie.antragsteller_namen(offen) == {FAMILIE: "Tochter"}


def test_freigabe_aendert_den_status_nicht() -> None:
    """Stufe 1 hat KEINE Kalenderwirkung.

    Das ist der wichtigste Test der Datei: Würde die Freigabe `status` auf
    'approved' setzen, legte der Kalender-Slice eine Reservierung an und pushte
    sie an die Portale — das Haus wäre gesperrt, bevor die Agentur es je
    gesehen hat.
    """
    familie, _, db = _dienste()
    db.tables["block_requests"].append(
        {
            "id": "br-1", "tenant_id": TENANT, "property_id": PROP,
            "requested_by": FAMILIE, "start_date": "2026-07-03",
            "end_date": "2026-07-10", "status": "pending",
            "owner_freigabe": "offen",
        }
    )
    familie.entscheiden(_ctx(OWNER), "br-1", freigeben=True)
    zeile = db.tables["block_requests"][0]
    assert zeile["owner_freigabe"] == "freigegeben"
    assert zeile["status"] == "pending"  # unangetastet
    assert zeile["owner_decided_by"] == OWNER


def test_zweite_entscheidung_ist_ein_konflikt() -> None:
    """Doppelklick: einer gewinnt, der andere bekommt 409 (Wurzel 2)."""
    familie, _, db = _dienste()
    db.tables["block_requests"].append(
        {
            "id": "br-1", "tenant_id": TENANT, "property_id": PROP,
            "requested_by": FAMILIE, "start_date": "2026-07-03",
            "end_date": "2026-07-10", "status": "pending",
            "owner_freigabe": "offen",
        }
    )
    familie.entscheiden(_ctx(OWNER), "br-1", freigeben=True)
    with pytest.raises(FamilieError) as exc:
        familie.entscheiden(_ctx(OWNER), "br-1", freigeben=False)
    assert exc.value.status_code == 409


def test_mitglied_kann_nicht_selbst_freigeben() -> None:
    """Sonst umginge die Tochter die Zustimmung ihres Vaters."""
    familie, _, db = _dienste()
    db.tables["block_requests"].append(
        {
            "id": "br-1", "tenant_id": TENANT, "property_id": PROP,
            "requested_by": FAMILIE, "start_date": "2026-07-03",
            "end_date": "2026-07-10", "status": "pending",
            "owner_freigabe": "offen",
        }
    )
    # Das Mitglied ist für niemanden `owner_user_id` → leerer Scope → 404.
    assert familie.offene_antraege(_ctx(FAMILIE)) == []
    with pytest.raises(FamilieError) as exc:
        familie.entscheiden(_ctx(FAMILIE), "br-1", freigeben=True)
    assert exc.value.status_code == 404


def test_fremder_eigentuemer_kann_nicht_entscheiden() -> None:
    """Wurzel 9: derselbe Scope im Item-Pfad wie in der Liste."""
    familie, _, db = _dienste()
    db.tables["block_requests"].append(
        {
            "id": "br-1", "tenant_id": TENANT, "property_id": PROP,
            "requested_by": FAMILIE, "start_date": "2026-07-03",
            "end_date": "2026-07-10", "status": "pending",
            "owner_freigabe": "offen",
        }
    )
    with pytest.raises(FamilieError) as exc:
        familie.entscheiden(_ctx("fremder-owner"), "br-1", freigeben=True)
    assert exc.value.status_code == 404


# --- Verwaltung der Zugänge --------------------------------------------------


def test_stufe_nachtraeglich_aendern() -> None:
    familie, _, db = _dienste(access="nutzung")
    familie.stufe_aendern(_ctx(OWNER), "fam-1", "nutzung_berichte")
    assert db.tables["owner_family_members"][0]["access"] == "nutzung_berichte"


def test_fremde_zeile_nicht_aenderbar() -> None:
    """Ein Eigentümer verwaltet nur SEINE Zugänge, nicht die eines anderen."""
    familie, _, _ = _dienste()
    with pytest.raises(FamilieError) as exc:
        familie.stufe_aendern(_ctx("fremder-owner"), "fam-1", "nutzung_berichte")
    assert exc.value.status_code == 404


def test_unbekannte_stufe_wird_abgelehnt() -> None:
    familie, _, _ = _dienste()
    with pytest.raises(FamilieError) as exc:
        familie.stufe_aendern(_ctx(OWNER), "fam-1", "alles_duerfen")
    assert exc.value.status_code == 422


def test_entfernen_nimmt_auch_die_sicht_weg() -> None:
    """Wurzel 1: der Gegenzustand gehört mitgepflegt.

    Bliebe die Objekt-Sichtbarkeit stehen, sähe der entfernte Zugang das Haus
    weiter — und `darf()` läse die fehlende Stufe als „Eigentümer". Löschen
    würde damit Rechte AUSWEITEN.
    """
    familie, _, db = _dienste()
    familie.entfernen(_ctx(OWNER), "fam-1")
    assert db.tables["owner_family_members"] == []
    verbleibend = {
        r["user_id"] for r in db.tables["owner_property_assignments"]
    }
    assert verbleibend == {OWNER}


def test_grenze_je_objekt() -> None:
    """Wurzel 8: ein unbegrenzter Einladungs-Endpunkt in Kundenhand."""
    familie, _, db = _dienste()
    db.tables["owner_family_members"] = [
        {
            "id": f"fam-{i}", "tenant_id": TENANT, "user_id": f"u-{i}",
            "owner_user_id": OWNER, "property_id": PROP, "access": "nutzung",
        }
        for i in range(MAX_FAMILIE_JE_OBJEKT)
    ]
    with pytest.raises(FamilieError) as exc:
        familie.einladen(
            _ctx(OWNER), property_id=PROP, email="noch-einer@example.dk",
            full_name="Zu viel", access="nutzung",
        )
    assert exc.value.status_code == 422


def test_selbsteinladung_wird_abgelehnt() -> None:
    """Sonst entstünde ein Zyklus: der Antrag wartete auf sich selbst."""
    familie, _, _ = _dienste()
    with pytest.raises(FamilieError) as exc:
        familie.einladen(
            _ctx(OWNER), property_id=PROP, email="vater@example.dk",
            full_name="Vater", access="nutzung",
        )
    assert exc.value.status_code == 422


def test_bestehender_login_wird_verknuepft_ohne_mail() -> None:
    """Idempotenz (Wurzel 2) und ehrliche Rückmeldung (Wurzel 4).

    Existiert die Adresse schon im Betrieb, entsteht KEIN zweiter Auth-User und
    keine zweite Mail — und die Oberfläche darf nicht „Einladung verschickt"
    behaupten.
    """
    familie, _, db = _dienste()
    db.tables["owner_family_members"] = []
    zeile, versendet = familie.einladen(
        _ctx(OWNER), property_id=PROP, email="tochter@example.dk",
        full_name="Tochter", access="nutzung",
    )
    assert versendet is False
    assert zeile["user_id"] == FAMILIE
    assert zeile["access"] == "nutzung"


def test_darf_prueft_die_stufe_je_objekt() -> None:
    familie, _, _ = _dienste(access="nutzung")
    ctx = _ctx(FAMILIE)
    assert familie.darf(ctx, PROP, Capability.VIEW_CALENDAR) is True
    assert familie.darf(ctx, PROP, Capability.VIEW_OWNER_REPORTS) is False
    # Der Eigentümer hat keine Familien-Zeile → nicht eingeschränkt.
    assert familie.darf(_ctx(OWNER), PROP, Capability.VIEW_OWNER_REPORTS) is True


# --- Befunde aus dem Review (nachträglich geschlossen) -----------------------
# Diese drei Tests decken Lücken ab, die ein unabhängiges Review gefunden hat.
# Sie stehen bewusst zusammen und mit ihrer Vorgeschichte: Alle drei sahen
# geschlossen aus, weil je EIN Filter griff — sie waren es nicht.


def test_mitglied_kann_niemanden_einladen() -> None:
    """Sonst vergibt der Neffe Rechte, die der Onkel nie erlaubt hat.

    Der Objekt-Filter allein reicht hier nicht: Ein Mitglied besteht ihn, weil
    es das Objekt sehen DARF. Es könnte damit jemanden mit Berichte-Stufe
    einladen und würde als `owner_user_id` selbst zum Freigabe-Anker — die
    Anträge des Eingeladenen entschiede es dann selbst, und der echte
    Eigentümer sähe sie nie.
    """
    familie, _, _ = _dienste()
    with pytest.raises(FamilieError) as exc:
        familie.einladen(
            _ctx(FAMILIE), property_id=PROP, email="kumpel@example.dk",
            full_name="Kumpel", access="nutzung_berichte",
        )
    assert exc.value.status_code == 404


def test_mitglied_ohne_berichte_sieht_keinen_payout_im_kalender() -> None:
    """Der Kalender hängt an VIEW_CALENDAR, nicht an VIEW_OWNER_REPORTS.

    Ein Mitglied der Stufe 'nutzung' kommt also herein — und soll das auch, es
    plant seine Nutzung. Der Netto-Payout je Nacht gehört ihm aber nicht: über
    ein Jahr summiert ist er exakt der Jahresumsatz, den `earnings` derselben
    Person mit 403 verweigert. Die Beträge werden deshalb einzeln unterdrückt,
    statt den Kalender zu sperren.
    """
    _, portal, _ = _dienste(access="nutzung")
    assert portal._darf_berichte(_ctx(FAMILIE)) is False
    # Der Eigentümer selbst und ein Mitglied MIT Freigabe sehen die Beträge.
    _, portal_frei, _ = _dienste(access="nutzung_berichte")
    assert portal_frei._darf_berichte(_ctx(FAMILIE)) is True
    assert portal_frei._darf_berichte(_ctx(OWNER)) is True


def test_geloeschter_eigentuemer_macht_mitglied_nicht_zum_eigentuemer() -> None:
    """Wurzel 1, in der gefährlichsten Ausprägung: Löschen weitet Rechte AUS.

    Die Familien-Zeilen cascaden mit dem Eigentümer-Login weg. Bliebe die
    Objekt-Sicht des Mitglieds stehen, wäre es danach ununterscheidbar vom
    Eigentümer selbst — `_darf_berichte` gäbe die Finanzen frei und
    `_freigabe_stufe` schickte seine Anträge ohne Stufe 1 zur Agentur.
    """
    from src.features.owners.portalzugang import portalzugang_entfernen

    _, portal, db = _dienste()
    # Vor dem Löschen: das Mitglied ist eingeschränkt.
    assert portal._darf_berichte(_ctx(FAMILIE)) is False

    # Der GoTrue-Löschpfad ist hier nicht der Prüfgegenstand — er muss nur
    # durchlaufen, damit der Rest der Funktion überhaupt erreicht wird.
    db.auth = _FakeAuth()
    portalzugang_entfernen(
        db, tenant_id=TENANT, user_id=OWNER, fehler=RuntimeError
    )

    # Die Sicht des Mitglieds ist mitgegangen — es sieht nichts mehr, statt
    # unbemerkt zum Voll-Eigentümer aufzusteigen.
    verbleibend = {
        r["user_id"] for r in db.tables["owner_property_assignments"]
    }
    assert FAMILIE not in verbleibend
