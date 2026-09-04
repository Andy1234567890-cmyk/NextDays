"""Kartei (0543): Scope der Akteninhalte, generischer Pfad, Übersicht, Kosten."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from src.features.personal import akte_krypto
from src.features.personal._base import PersonalError, jetzt
from src.features.personal.kartei import KarteiService
from src.features.personal.schemas import (
    AkteUpdate,
    GespraechCreate,
    MassnahmeCreate,
    MassnahmeUpdate,
    NachtragCreate,
    NachweisCreate,
    Paar,
    SchulungCreate,
    VertragCreate,
    VertragUpdate,
    VorfallCreate,
)
from src.features.personal.service import PersonalService, monatskosten

from ._fake import FakeDB, basis_tabellen, ctx, settings


@pytest.fixture
def db() -> FakeDB:
    return FakeDB(basis_tabellen())


@pytest.fixture(autouse=True)
def _krypto(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(akte_krypto, "get_settings", settings)


# --- Scope -------------------------------------------------------------------


def test_schichtleitung_sieht_keine_vertraege(db: FakeDB) -> None:
    svc = KarteiService(db)
    with pytest.raises(PersonalError) as exc:
        svc.vertraege(ctx("lead-1", "shift_lead"), "staff-1")
    assert exc.value.status_code == 403


def test_schichtleitung_liest_nachweise_nur_ihrer_leute(db: FakeDB) -> None:
    svc = KarteiService(db)
    svc.nachweis_anlegen(ctx(), "staff-1", NachweisCreate(art="sprache", titel="Dansk", stufe="c1"))
    svc.nachweis_anlegen(ctx(), "staff-2", NachweisCreate(art="sprache", titel="Deutsch"))
    assert len(svc.nachweise(ctx("lead-1", "shift_lead"), "staff-1")) == 1
    with pytest.raises(PersonalError) as exc:
        svc.nachweise(ctx("lead-1", "shift_lead"), "staff-2")
    assert exc.value.status_code == 404
    with pytest.raises(PersonalError):
        svc.nachweis_anlegen(
            ctx("lead-1", "shift_lead"), "staff-1", NachweisCreate(art="faehigkeit", titel="x")
        )


def test_rolle_kommt_aus_der_db(db: FakeDB) -> None:
    # Token sagt admin, DB sagt cleaner → kein Zugriff (Wurzel 7).
    with pytest.raises(PersonalError) as exc:
        KarteiService(db).vertraege(ctx("staff-1", "admin"), "staff-1")
    assert exc.value.status_code == 403


def test_kartei_nur_fuer_planbare(db: FakeDB) -> None:
    with pytest.raises(PersonalError) as exc:
        KarteiService(db).vertrag_anlegen(
            ctx(), "owner-1", VertragCreate(art="sonstiges", titel="x")
        )
    assert exc.value.status_code == 422


# --- Verträge -----------------------------------------------------------------


def test_vertrag_mit_nachtrag_und_aenderung(db: FakeDB) -> None:
    svc = KarteiService(db)
    v = svc.vertrag_anlegen(
        ctx(),
        "staff-1",
        VertragCreate(
            art="arbeitsvertrag",
            titel="Arbeitsvertrag 2026",
            gueltig_ab=date(2026, 1, 1),
            unterzeichner=["Mette Rein", "Anna Admin"],
            bedingungen=[Paar(schluessel="Stunden", wert="20")],
        ),
    )
    assert v.status == "aktiv"
    assert db.tables["personal_vertraege"][0]["erstellt_von"] == "admin-1"
    v2 = svc.nachtrag_anlegen(
        ctx(),
        v.id,
        NachtragCreate(datum=date(2026, 6, 1), beschreibung="Stunden erhöht", aenderungen=[]),
    )
    assert len(v2.nachtraege) == 1
    assert v2.nachtraege[0].autorisiert_von_name == "Anna Admin"
    v3 = svc.vertrag_aendern(ctx(), v.id, VertragUpdate(status="beendet", geleert=["gueltig_bis"]))
    assert v3.status == "beendet"
    assert len(v3.nachtraege) == 1


def test_vertrag_ende_vor_beginn_422() -> None:
    with pytest.raises(ValueError):
        VertragCreate(
            art="sonstiges", titel="x", gueltig_ab=date(2026, 2, 1), gueltig_bis=date(2026, 1, 1)
        )


def test_dokument_muss_zur_selben_person_gehoeren(db: FakeDB) -> None:
    db.tables["personal_dokumente"] = [
        {"id": "d-1", "tenant_id": "t-1", "user_id": "staff-2", "titel": "Fremd", "art": "vertrag"}
    ]
    with pytest.raises(PersonalError) as exc:
        KarteiService(db).vertrag_anlegen(
            ctx(), "staff-1", VertragCreate(art="arbeitsvertrag", titel="x", dokument_id="d-1")
        )
    assert exc.value.status_code == 422


# --- Disziplin / Gespräche -----------------------------------------------------


def test_massnahme_loesen_setzt_datum(db: FakeDB) -> None:
    svc = KarteiService(db)
    m = svc.massnahme_anlegen(
        ctx(), "staff-1", MassnahmeCreate(art="abmahnung", datum=date(2026, 8, 1), grund="Zu spät")
    )
    assert m.ausgestellt_von_name == "Anna Admin"
    assert m.geloest is False
    m2 = svc.massnahme_aendern(ctx(), m.id, MassnahmeUpdate(geloest=True, loesung="Gespräch"))
    assert m2.geloest is True
    assert m2.geloest_am is not None
    m3 = svc.massnahme_aendern(ctx(), m.id, MassnahmeUpdate(geloest=False))
    assert m3.geloest_am is None
    assert m3.loesung is None


def test_vorfall_und_gespraech_listen(db: FakeDB) -> None:
    svc = KarteiService(db)
    svc.vorfall_anlegen(
        ctx(),
        "staff-1",
        VorfallCreate(
            datum=date(2026, 8, 2),
            art="unfall",
            schwere="hoch",
            beschreibung="Sturz",
            zeugen=["Ole"],
        ),
    )
    g = svc.gespraech_anlegen(
        ctx(),
        "staff-1",
        GespraechCreate(datum=date(2026, 8, 3), bewertung=4, ziele=["Pünktlich"], notizen="Gut"),
    )
    assert svc.vorfaelle(ctx(), "staff-1")[0].zeugen == ["Ole"]
    assert g.gefuehrt_von_name == "Anna Admin"
    assert g.ziele == ["Pünktlich"]
    svc.loeschen(ctx(), "gespraeche", g.id)
    assert svc.gespraeche(ctx(), "staff-1") == []
    with pytest.raises(PersonalError):
        svc.loeschen(ctx(), "unbekannt", g.id)


# --- Nachweise / Schulungen: Zustand -------------------------------------------


def test_zustand_nach_ablauf(db: FakeDB) -> None:
    svc = KarteiService(db)
    heute = jetzt().date()
    a = svc.nachweis_anlegen(
        ctx(),
        "staff-1",
        NachweisCreate(art="zertifikat", titel="Alt", ablauf_am=heute - timedelta(days=1)),
    )
    b = svc.schulung_anlegen(
        ctx(),
        "staff-1",
        SchulungCreate(
            titel="Brandschutz", abgeschlossen_am=heute, gueltig_bis=heute + timedelta(days=10)
        ),
    )
    c = svc.nachweis_anlegen(ctx(), "staff-1", NachweisCreate(art="ausbildung", titel="Ohne"))
    assert a.zustand == "abgelaufen"
    assert b.zustand == "laeuft_ab"
    assert c.zustand == "ohne_ablauf"


# --- Übersicht -----------------------------------------------------------------


def test_uebersicht_leitung_und_schichtleitung(db: FakeDB) -> None:
    svc = KarteiService(db)
    heute = jetzt().date()
    db.tables["login_devices"] = [
        {"id": "ld-1", "user_id": "staff-1", "last_seen_at": "2026-09-01T10:00:00+00:00"},
        {"id": "ld-2", "user_id": "staff-1", "last_seen_at": "2026-09-03T10:00:00+00:00"},
    ]
    db.tables["user_auth_tokens"] = [
        {
            "id": "tok-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "zweck": "invite",
            "created_at": "2026-08-01T00:00:00+00:00",
            "expires_at": "2026-08-08T00:00:00+00:00",
            "used_at": "2026-08-02T00:00:00+00:00",
            "created_by": "admin-1",
        }
    ]
    start = datetime(heute.year, heute.month, heute.day, 8, tzinfo=UTC) + timedelta(days=1)
    db.tables["personal_schichten"] = [
        {
            "id": "s-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "datum": (heute + timedelta(days=1)).isoformat(),
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=6)).isoformat(),
            "pause_min": 30,
            "status": "veroeffentlicht",
            "property_id": "p-1",
        }
    ]
    svc.massnahme_anlegen(
        ctx(), "staff-1", MassnahmeCreate(art="ermahnung", datum=heute, grund="x")
    )
    u = svc.uebersicht(ctx(), "staff-1")
    assert u.letzter_login == datetime(2026, 9, 3, 10, tzinfo=UTC)
    assert u.einladung == "angenommen"
    assert u.eingeladen_von_name == "Anna Admin"
    assert u.massnahmen_offen == 1
    assert u.kommende_schichten[0].property_title == "Feriehus Nord"
    assert u.monat_soll_minuten == round(20 * 60 * 52 / 12)
    assert u.kosten_hinweis == "lohn_oder_aufschlag_fehlt"  # kein Aufschlag in der Akte
    lead = svc.uebersicht(ctx("lead-1", "shift_lead"), "staff-1")
    assert lead.email is None
    assert lead.letzter_login is None
    assert lead.einladung is None
    assert lead.massnahmen_offen == 0


def test_kosten_nur_mit_aufschlag_und_waehrung(db: FakeDB) -> None:
    assert (
        monatskosten({"stundenlohn_minor": 18000, "wochenstunden": 20, "currency": "DKK"}) is None
    )
    cur, minor = monatskosten(
        {
            "stundenlohn_minor": 18000,
            "wochenstunden": 20,
            "currency": "DKK",
            "arbeitgeber_aufschlag_pct": 10,
        }
    ) or ("", 0)
    assert cur == "DKK"
    assert minor == round(18000 * 20 * 52 / 12 * 1.1)
    assert monatskosten(
        {"gehalt_minor": 300000, "currency": "EUR", "arbeitgeber_aufschlag_pct": 0}
    ) == (
        "EUR",
        300000,
    )
    svc = PersonalService(db)
    svc.akte_speichern(
        ctx(),
        "staff-1",
        AkteUpdate(
            arbeitgeber_aufschlag_pct=10,
            lohnmerkmale=[Paar(schluessel="Skattekort", wert="Hovedkort")],
            familienstand="ledig",
        ),
    )
    liste = svc.mitarbeiter(ctx())
    assert liste.kosten_monat[0].currency == "DKK"
    assert liste.kosten_monat[0].personen == 1
    akte = svc.akte(ctx(), "staff-1")
    assert akte.lohnmerkmale[0].wert == "Hovedkort"
    assert akte.familienstand == "ledig"
    # Schichtleitung: keine Kosten
    assert svc.mitarbeiter(ctx("lead-1", "shift_lead")).kosten_monat == []
