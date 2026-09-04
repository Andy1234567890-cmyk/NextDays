"""Dienste gegen das DB-Doppel: Scope, Akte, Dienstplan, Abwesenheit,
Zeiterfassung, Auswertung — die Gegenzustände und die Idempotenz."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from src.features.personal import akte_krypto
from src.features.personal._base import PersonalError
from src.features.personal.abwesenheiten import AbwesenheitenService
from src.features.personal.auswertung import AuswertungService
from src.features.personal.schemas import (
    AbwesenheitCreate,
    AbwesenheitEntscheiden,
    AkteUpdate,
    LohnExportRequest,
    SchichtCreate,
    SchichtUpdate,
    StempelEnde,
    StempelStart,
    UrlaubskontoSet,
    WocheKopieren,
    ZeitKorrektur,
)
from src.features.personal.schichten import SchichtenService
from src.features.personal.service import PersonalService
from src.features.personal.zeiterfassung import ZeiterfassungService

from ._fake import FakeDB, basis_tabellen, ctx, settings, stumm

MONTAG = date(2026, 9, 7)  # Montag


def _utc(d: date, h: int, m: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, h, m, tzinfo=UTC)


@pytest.fixture
def db() -> FakeDB:
    return FakeDB(basis_tabellen())


@pytest.fixture(autouse=True)
def _krypto(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(akte_krypto, "get_settings", settings)


# --- Scope --------------------------------------------------------------------


def test_scope_leitung_sieht_alle_planbaren(db: FakeDB) -> None:
    svc = PersonalService(db)
    ids = {m.user_id for m in svc.mitarbeiter(ctx()).items}
    assert ids == {"lead-1", "staff-1", "staff-2"}


def test_scope_schichtleitung_nur_gemeinsame_objekte(db: FakeDB) -> None:
    svc = PersonalService(db)
    items = svc.mitarbeiter(ctx("lead-1", "shift_lead")).items
    assert {m.user_id for m in items} == {"lead-1", "staff-1"}
    # Kein Finanz-/Aktenblick für die Schichtleitung (§4.3).
    assert all(m.email is None and m.wochenstunden is None for m in items)


def test_scope_mitarbeiter_nur_selbst(db: FakeDB) -> None:
    svc = PersonalService(db)
    assert {m.user_id for m in svc.mitarbeiter(ctx("staff-2", "staff")).items} == {"staff-2"}


def test_scope_owner_sieht_nichts(db: FakeDB) -> None:
    assert PersonalService(db).mitarbeiter(ctx("owner-1", "owner")).items == []


def test_scope_kommt_aus_der_db_nicht_aus_dem_token(db: FakeDB) -> None:
    # Token behauptet admin, DB sagt cleaner → nur sich selbst (Wurzel 7).
    items = PersonalService(db).mitarbeiter(ctx("staff-1", "admin")).items
    assert {m.user_id for m in items} == {"staff-1"}


# --- Akte -----------------------------------------------------------------------


def test_akte_verschluesselt_und_maskiert(db: FakeDB) -> None:
    svc = PersonalService(db)
    akte = svc.akte_speichern(
        ctx(),
        "staff-2",
        AkteUpdate(
            beschaeftigungsart="vollzeit",
            iban="DK5000400440116243",
            steuer_id="12345678",
            stundenlohn_minor=20000,
            currency="DKK",
        ),
    )
    row = db.tables["personal_akten"][-1]
    assert row["iban_enc"] != "DK5000400440116243"
    assert "iban" not in row
    assert akte.iban_maskiert == "••••••••••••••6243"
    assert svc.akte_klartext("t-1", "staff-2")["iban"] == "DK5000400440116243"


def test_akte_lohn_ohne_waehrung_422(db: FakeDB) -> None:
    with pytest.raises(PersonalError) as exc:
        PersonalService(db).akte_speichern(
            ctx(), "staff-2", AkteUpdate(beschaeftigungsart="vollzeit", stundenlohn_minor=1000)
        )
    assert exc.value.status_code == 422


def test_akte_extern_braucht_firma_und_keinen_lohn(db: FakeDB) -> None:
    svc = PersonalService(db)
    with pytest.raises(PersonalError):
        svc.akte_speichern(ctx(), "staff-2", AkteUpdate(beschaeftigungsart="extern"))
    firma = svc.fremdfirma_anlegen(
        ctx(),
        __import__("src.features.personal.schemas", fromlist=["FremdfirmaCreate"]).FremdfirmaCreate(
            name="Clean ApS",
            abrechnung="je_stunde",
            satz_minor=25000,
            currency="DKK",
        ),
    )
    akte = svc.akte_speichern(
        ctx(), "staff-2", AkteUpdate(beschaeftigungsart="extern", firma_id=firma.id)
    )
    assert akte.firma_name == "Clean ApS"
    with pytest.raises(PersonalError):
        svc.akte_speichern(ctx(), "staff-2", AkteUpdate(urlaubsanspruch_tage=20))


def test_akte_nur_fuer_planbare(db: FakeDB) -> None:
    with pytest.raises(PersonalError) as exc:
        PersonalService(db).akte("owner-1", "owner-1") if False else PersonalService(db).akte(
            ctx(), "owner-1"
        )
    assert exc.value.status_code == 422


def test_regel_vorschlag_daenemark(db: FakeDB) -> None:
    v = PersonalService(db).regel_vorschlag(ctx())
    assert v.land == "DK" and v.werte is not None
    assert v.werte.zeitzone == "Europe/Copenhagen"
    assert v.werte.urlaubsjahr_start_monat == 9


# --- Dienstplan -----------------------------------------------------------------


def test_schicht_anlegen_und_wochenplan(db: FakeDB, monkeypatch: pytest.MonkeyPatch) -> None:
    protokoll = stumm(monkeypatch)
    svc = SchichtenService(db)
    s = svc.anlegen(
        ctx(),
        SchichtCreate(
            user_id="staff-1", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12), property_id="p-1"
        ),
    )
    assert s.status == "entwurf" and s.netto_minuten == 360 and s.datum == MONTAG
    plan = svc.wochenplan(ctx(), MONTAG)
    assert [x.id for x in plan.schichten] == [s.id]
    assert plan.minuten_je_person == {"staff-1": 360}
    assert plan.regeln_bestaetigt
    assert protokoll == []
    assert db.tables["personal_schicht_aenderungen"][0]["art"] == "angelegt"


def test_schicht_ruhezeit_verletzt_422(db: FakeDB, monkeypatch: pytest.MonkeyPatch) -> None:
    stumm(monkeypatch)
    svc = SchichtenService(db)
    svc.anlegen(
        ctx(), SchichtCreate(user_id="staff-1", start_at=_utc(MONTAG, 14), end_at=_utc(MONTAG, 22))
    )
    with pytest.raises(PersonalError) as exc:
        svc.anlegen(
            ctx(),
            SchichtCreate(
                user_id="staff-1",
                start_at=_utc(MONTAG + timedelta(days=1), 6),
                end_at=_utc(MONTAG + timedelta(days=1), 12),
            ),
        )
    assert exc.value.status_code == 422
    assert exc.value.details and exc.value.details["konflikte"][0]["art"] == "ruhezeit"


def test_schicht_warnung_braucht_bestaetigung(db: FakeDB, monkeypatch: pytest.MonkeyPatch) -> None:
    stumm(monkeypatch)
    svc = SchichtenService(db)
    db.tables["personal_arbeitsbereiche"] = [
        {
            "id": "ab-1",
            "tenant_id": "t-1",
            "name": "Reinigung",
            "kurz": "R",
            "farbe": "#112233",
            "sort": 0,
        }
    ]
    req = SchichtCreate(
        user_id="staff-1",
        start_at=_utc(MONTAG, 6),
        end_at=_utc(MONTAG, 12),
        arbeitsbereich_id="ab-1",
    )
    with pytest.raises(PersonalError) as exc:
        svc.anlegen(ctx(), req)
    assert exc.value.status_code == 409  # Qualifikation fehlt → Warnung
    s = svc.anlegen(ctx(), req.model_copy(update={"warnungen_akzeptieren": True}))
    assert [k.art for k in s.konflikte] == ["qualifikation"]


def test_schichtleitung_plant_nur_eigene_leute(db: FakeDB, monkeypatch: pytest.MonkeyPatch) -> None:
    stumm(monkeypatch)
    svc = SchichtenService(db)
    with pytest.raises(PersonalError) as exc:
        svc.anlegen(
            ctx("lead-1", "shift_lead"),
            SchichtCreate(user_id="staff-2", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12)),
        )
    assert exc.value.status_code == 404
    s = svc.anlegen(
        ctx("lead-1", "shift_lead"),
        SchichtCreate(
            user_id="staff-1", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12), property_id="p-1"
        ),
    )
    assert s.user_id == "staff-1"


def test_veroeffentlichen_meldet_je_person_einmal(
    db: FakeDB, monkeypatch: pytest.MonkeyPatch
) -> None:
    protokoll = stumm(monkeypatch)
    svc = SchichtenService(db)
    svc.anlegen(
        ctx(), SchichtCreate(user_id="staff-1", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12))
    )
    svc.anlegen(
        ctx(),
        SchichtCreate(
            user_id="staff-1",
            start_at=_utc(MONTAG + timedelta(days=2), 6),
            end_at=_utc(MONTAG + timedelta(days=2), 12),
        ),
    )
    res = svc.veroeffentlichen(ctx(), MONTAG)
    assert (res.anzahl, res.benachrichtigt) == (2, 1)
    assert [p[0] for p in protokoll] == ["dienstplan"]
    assert all(r["status"] == "veroeffentlicht" for r in db.tables["personal_schichten"])
    # Bestätigen durch die Person selbst
    s = svc.bestaetigen(ctx("staff-1", "cleaner"), db.tables["personal_schichten"][0]["id"])
    assert s.status == "bestaetigt"
    # Fremde bestätigen nicht
    with pytest.raises(PersonalError):
        svc.bestaetigen(ctx("staff-2", "staff"), db.tables["personal_schichten"][1]["id"])


def test_geaenderte_veroeffentlichte_schicht_meldet_alte_und_neue_person(
    db: FakeDB, monkeypatch: pytest.MonkeyPatch
) -> None:
    protokoll = stumm(monkeypatch)
    svc = SchichtenService(db)
    s = svc.anlegen(
        ctx(), SchichtCreate(user_id="staff-1", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12))
    )
    svc.veroeffentlichen(ctx(), MONTAG)
    protokoll.clear()
    svc.aendern(ctx(), s.id, SchichtUpdate(user_id="staff-2"))
    empfaenger = sorted(kw["user_id"] for name, kw in protokoll if name == "dienstplan")
    assert empfaenger == ["staff-1", "staff-2"]
    assert db.tables["personal_schicht_aenderungen"][-1]["art"] == "zugewiesen"


def test_loeschen_veroeffentlichter_schicht_sagt_ab(
    db: FakeDB, monkeypatch: pytest.MonkeyPatch
) -> None:
    stumm(monkeypatch)
    svc = SchichtenService(db)
    s = svc.anlegen(
        ctx(), SchichtCreate(user_id="staff-1", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12))
    )
    svc.veroeffentlichen(ctx(), MONTAG)
    svc.loeschen(ctx(), s.id)
    assert db.tables["personal_schichten"][0]["status"] == "abgesagt"
    # Entwurf wird wirklich gelöscht
    e = svc.anlegen(
        ctx(), SchichtCreate(user_id="staff-2", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12))
    )
    svc.loeschen(ctx(), e.id)
    assert all(r["id"] != e.id for r in db.tables["personal_schichten"])


def test_woche_kopieren_ist_idempotent(db: FakeDB, monkeypatch: pytest.MonkeyPatch) -> None:
    stumm(monkeypatch)
    svc = SchichtenService(db)
    svc.anlegen(
        ctx(),
        SchichtCreate(
            user_id="staff-1", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12), property_id="p-1"
        ),
    )
    ziel = MONTAG + timedelta(days=7)
    r1 = svc.woche_kopieren(ctx(), WocheKopieren(quelle_woche_start=MONTAG, ziel_woche_start=ziel))
    r2 = svc.woche_kopieren(ctx(), WocheKopieren(quelle_woche_start=MONTAG, ziel_woche_start=ziel))
    assert (r1.angelegt, r2.angelegt, r2.vorhanden) == (1, 0, 1)
    kopie = [r for r in db.tables["personal_schichten"] if r["quelle"] == "kopie"][0]
    assert kopie["datum"] == ziel.isoformat()


def test_bedarf_aus_aufgaben_einmal_je_aufgabe(db: FakeDB, monkeypatch: pytest.MonkeyPatch) -> None:
    protokoll = stumm(monkeypatch)
    db.tables["tasks"] = [
        {
            "id": "task-1",
            "tenant_id": "t-1",
            "property_id": "p-1",
            "assignee_id": None,
            "title": "Endreinigung",
            "status": "open",
            "start_at": _utc(MONTAG, 8).isoformat(),
            "end_at": _utc(MONTAG, 11).isoformat(),
            "due_at": None,
        },
        {
            "id": "task-2",
            "tenant_id": "t-1",
            "property_id": "p-2",
            "assignee_id": "staff-2",
            "title": "Anreisecheck",
            "status": "open",
            "start_at": _utc(MONTAG, 13).isoformat(),
            "end_at": _utc(MONTAG, 15).isoformat(),
            "due_at": None,
        },
        # ohne Zeitfenster → kein erfundener Bedarf
        {
            "id": "task-3",
            "tenant_id": "t-1",
            "property_id": "p-1",
            "assignee_id": None,
            "title": "Ohne Zeit",
            "status": "open",
            "start_at": _utc(MONTAG, 9).isoformat(),
            "end_at": None,
            "due_at": None,
        },
    ]
    svc = SchichtenService(db)
    r1 = svc.bedarf_aus_aufgaben(ctx(), MONTAG)
    r2 = svc.bedarf_aus_aufgaben(ctx(), MONTAG)
    assert (r1.angelegt, r2.angelegt, r2.vorhanden) == (2, 0, 2)
    offen = [r for r in db.tables["personal_schichten"] if r["user_id"] is None]
    assert len(offen) == 1 and offen[0]["task_id"] == "task-1"
    assert [p[0] for p in protokoll] == ["schicht_offen"]
    # Mitarbeiterin mit Freigabe für p-1 sieht die offene Schicht und kann sich bewerben.
    plan = svc.wochenplan(ctx("staff-1", "cleaner"), MONTAG)
    assert [s.user_id for s in plan.schichten] == [None]
    s = svc.bewerben(ctx("staff-1", "cleaner"), offen[0]["id"])
    assert s.eigene_bewerbung == "offen" and s.bewerbungen == 1
    # staff-2 (nur p-2) sieht sie nicht
    with pytest.raises(PersonalError):
        svc.bewerben(ctx("staff-2", "staff"), offen[0]["id"])


def test_ohne_bestaetigte_regeln_kein_plan(db: FakeDB) -> None:
    db.tables["personal_regeln"][0]["bestaetigt_am"] = None
    with pytest.raises(PersonalError) as exc:
        SchichtenService(db).anlegen(
            ctx(),
            SchichtCreate(user_id="staff-1", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12)),
        )
    assert exc.value.status_code == 422 and exc.value.details == {"code": "regeln_fehlen"}
    assert not SchichtenService(db).wochenplan(ctx(), MONTAG).regeln_bestaetigt


# --- Abwesenheit ------------------------------------------------------------------


def test_antrag_rechnet_tage_und_meldet_leitung(
    db: FakeDB, monkeypatch: pytest.MonkeyPatch
) -> None:
    protokoll = stumm(monkeypatch)
    svc = AbwesenheitenService(db)
    # Mo 31.8. – Fr 4.9.2026, 1.9. ist Test-Feiertag → 4 Tage
    a = svc.beantragen(
        ctx("staff-1", "cleaner"),
        AbwesenheitCreate(art="urlaub", von=date(2026, 8, 31), bis=date(2026, 9, 4)),
    )
    assert a.tage_berechnet == 4.0 and a.status == "beantragt"
    assert protokoll[0][0] == "antrag"
    assert protokoll[0][1]["leitung_ids"] == {"admin-1", "lead-1"}


def test_genehmigung_sagt_schichten_ab(db: FakeDB, monkeypatch: pytest.MonkeyPatch) -> None:
    protokoll = stumm(monkeypatch)
    sch = SchichtenService(db)
    s = sch.anlegen(
        ctx(), SchichtCreate(user_id="staff-1", start_at=_utc(MONTAG, 6), end_at=_utc(MONTAG, 12))
    )
    sch.veroeffentlichen(ctx(), MONTAG)
    svc = AbwesenheitenService(db)
    a = svc.beantragen(
        ctx("staff-1", "cleaner"), AbwesenheitCreate(art="krank", von=MONTAG, bis=MONTAG)
    )
    protokoll.clear()
    e = svc.entscheiden(ctx(), a.id, AbwesenheitEntscheiden(genehmigen=True))
    assert e.status == "genehmigt" and e.schichten_im_zeitraum == 1
    row = next(r for r in db.tables["personal_schichten"] if r["id"] == s.id)
    assert row["status"] == "abgesagt" and row["abwesenheit_id"] == a.id
    assert sorted(p[0] for p in protokoll) == ["dienstplan", "entscheidung"]


def test_eigener_antrag_wird_nicht_selbst_entschieden(
    db: FakeDB, monkeypatch: pytest.MonkeyPatch
) -> None:
    stumm(monkeypatch)
    svc = AbwesenheitenService(db)
    a = svc.beantragen(
        ctx("lead-1", "shift_lead"), AbwesenheitCreate(art="krank", von=MONTAG, bis=MONTAG)
    )
    with pytest.raises(PersonalError) as exc:
        svc.entscheiden(ctx("lead-1", "shift_lead"), a.id, AbwesenheitEntscheiden(genehmigen=True))
    assert exc.value.status_code == 403


def test_urlaubskonto_rechnet_genommen_und_geplant(
    db: FakeDB, monkeypatch: pytest.MonkeyPatch
) -> None:
    stumm(monkeypatch)
    svc = AbwesenheitenService(db)
    a = svc.beantragen(
        ctx("staff-1", "cleaner"),
        AbwesenheitCreate(art="urlaub", von=MONTAG, bis=MONTAG + timedelta(days=1)),
    )
    konto = svc.urlaubskonto(ctx(), "staff-1", 2026)
    assert (konto.anspruch, konto.geplant, konto.rest) == (25.0, 2.0, 23.0)
    svc.entscheiden(ctx(), a.id, AbwesenheitEntscheiden(genehmigen=True))
    konto = svc.urlaubskonto(ctx(), "staff-1", 2026)
    assert (konto.genommen, konto.geplant, konto.rest) == (2.0, 0.0, 23.0)
    # Konto explizit setzen: Übertrag + Korrektur mit Grund
    konto = svc.urlaubskonto_setzen(
        ctx(),
        "staff-1",
        2026,
        UrlaubskontoSet(anspruch=25, uebertrag=3, korrektur=-1, korrektur_grund="Ausgleich"),
    )
    assert konto.rest == 25.0 and konto.konto_vorhanden


def test_urlaub_ueber_anspruch_422(db: FakeDB, monkeypatch: pytest.MonkeyPatch) -> None:
    stumm(monkeypatch)
    svc = AbwesenheitenService(db)
    with pytest.raises(PersonalError) as exc:
        svc.beantragen(
            ctx("staff-1", "cleaner"),
            AbwesenheitCreate(art="urlaub", von=date(2026, 10, 1), bis=date(2026, 11, 20)),
        )
    assert exc.value.details and exc.value.details["code"] == "anspruch"


def test_urlaubssperre_haelt_mitarbeiter_nicht_leitung(
    db: FakeDB, monkeypatch: pytest.MonkeyPatch
) -> None:
    stumm(monkeypatch)
    db.tables["personal_urlaubssperren"] = [
        {
            "id": "sp-1",
            "tenant_id": "t-1",
            "von": MONTAG.isoformat(),
            "bis": MONTAG.isoformat(),
            "grund": "Hochsaison",
            "arbeitsbereich_id": None,
        }
    ]
    svc = AbwesenheitenService(db)
    with pytest.raises(PersonalError) as exc:
        svc.beantragen(
            ctx("staff-1", "cleaner"), AbwesenheitCreate(art="urlaub", von=MONTAG, bis=MONTAG)
        )
    assert exc.value.details and exc.value.details["code"] == "urlaubssperre"
    a = svc.beantragen(
        ctx(), AbwesenheitCreate(user_id="staff-1", art="urlaub", von=MONTAG, bis=MONTAG)
    )
    assert a.status == "genehmigt"  # Leitung trägt direkt ein


# --- Zeiterfassung ------------------------------------------------------------------


def test_stempeln_start_pause_ende(db: FakeDB) -> None:
    svc = ZeiterfassungService(db)
    z = svc.start(ctx("staff-1", "cleaner"), StempelStart(property_id="p-1"))
    assert z.zustand == "laeuft" and z.status == "offen"
    with pytest.raises(PersonalError) as exc:
        svc.start(ctx("staff-1", "cleaner"), StempelStart())
    assert exc.value.status_code == 409
    z = svc.pause(ctx("staff-1", "cleaner"), beenden=False)
    assert z.zustand == "in_pause"
    z = svc.pause(ctx("staff-1", "cleaner"), beenden=False)  # idempotent
    assert len(z.pausen) == 1
    z = svc.pause(ctx("staff-1", "cleaner"), beenden=True)
    z = svc.ende(ctx("staff-1", "cleaner"), StempelEnde())
    assert z.zustand == "beendet" and z.status == "abgeschlossen"
    assert svc.offene(ctx("staff-1", "cleaner")) is None


def test_stempeln_idempotenz_key(db: FakeDB) -> None:
    svc = ZeiterfassungService(db)
    a = svc.start(ctx("staff-1", "cleaner"), StempelStart(idempotenz_key="k-1"))
    b = svc.start(ctx("staff-1", "cleaner"), StempelStart(idempotenz_key="k-1"))
    assert a.id == b.id and a.quelle == "app"
    assert len(db.tables["personal_zeiterfassung"]) == 1


def test_zeitpunkt_vom_geraet_nicht_in_der_zukunft(db: FakeDB) -> None:
    svc = ZeiterfassungService(db)
    with pytest.raises(PersonalError):
        svc.start(
            ctx("staff-1", "cleaner"),
            StempelStart(zeitpunkt=datetime.now(UTC) + timedelta(hours=1)),
        )
    frueher = datetime.now(UTC) - timedelta(hours=2)
    z = svc.start(ctx("staff-1", "cleaner"), StempelStart(zeitpunkt=frueher))
    assert abs((z.start_at - frueher).total_seconds()) < 1


def test_korrektur_braucht_grund_und_protokolliert(db: FakeDB) -> None:
    svc = ZeiterfassungService(db)
    start = datetime.now(UTC) - timedelta(hours=5)
    svc.start(ctx("staff-1", "cleaner"), StempelStart(zeitpunkt=start))
    z = svc.ende(ctx("staff-1", "cleaner"), StempelEnde())
    k = svc.korrigieren(
        ctx(),
        z.id,
        ZeitKorrektur(end_at=start + timedelta(hours=4), grund="Vergessen auszustempeln"),
    )
    assert k.netto_minuten == 240 and k.korrekturen == 1
    assert db.tables["personal_zeit_korrekturen"][0]["grund"] == "Vergessen auszustempeln"
    # Bestätigen durch Leitung, nicht durch die Person selbst
    with pytest.raises(PersonalError):
        svc.bestaetigen(ctx("staff-1", "cleaner"), z.id)
    assert svc.bestaetigen(ctx("lead-1", "shift_lead"), z.id).status == "bestaetigt"


def test_schichtleitung_sieht_nur_zeiten_ihrer_leute(db: FakeDB) -> None:
    svc = ZeiterfassungService(db)
    for uid, rolle in (("staff-1", "cleaner"), ("staff-2", "staff")):
        svc.start(ctx(uid, rolle), StempelStart())
        svc.ende(ctx(uid, rolle), StempelEnde())
    heute = date.today()
    liste = svc.liste(
        ctx("lead-1", "shift_lead"), heute - timedelta(days=1), heute + timedelta(days=1)
    )
    assert {z.user_id for z in liste.items} == {"staff-1"}
    with pytest.raises(PersonalError):
        svc.liste(ctx("lead-1", "shift_lead"), heute, heute, user_id="staff-2")


# --- Auswertung ------------------------------------------------------------------


def test_auswertung_zuschlaege_und_kosten(db: FakeDB) -> None:
    # Sonntag 6.9.2026, 04:00–10:00 UTC = 06:00–12:00 Ortszeit → 6 h Sonntag, 0 Nacht.
    db.tables["personal_zeiterfassung"] = [
        {
            "id": "z-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "start_at": _utc(date(2026, 9, 6), 4).isoformat(),
            "end_at": _utc(date(2026, 9, 6), 10).isoformat(),
            "pausen": [],
            "quelle": "web",
            "property_id": "p-1",
            "status": "abgeschlossen",
        }
    ]
    res = AuswertungService(db).auswerten(ctx(), date(2026, 9, 1), date(2026, 9, 30))
    p = next(x for x in res.personen if x.user_id == "staff-1")
    assert (p.ist_minuten, p.sonntag_minuten, p.nacht_minuten) == (360, 360, 0)
    # 180 DKK/h × 6 h = 1080,00 + 50 % Sonntag auf 6 h = 540,00 → 162000 Øre
    assert p.kosten_minor == 162000 and p.currency == "DKK"
    assert res.objekte[0].property_id == "p-1" and res.objekte[0].kosten_minor == 108000
    # staff-2 hat keinen Lohn hinterlegt und keine Zeiten → kein Hinweis nötig
    assert not any("Ohne Stundenlohn" in h for h in res.hinweise)


def test_datev_export_verweigert_ohne_lohnarten(db: FakeDB) -> None:
    with pytest.raises(PersonalError) as exc:
        AuswertungService(db).lohnexport(
            ctx(), LohnExportRequest(jahr=2026, monat=8, format="datev_lodas")
        )
    assert exc.value.status_code == 422
    hinweise = " ".join(exc.value.details["hinweise"])  # type: ignore[index]
    assert "Lohnarten" in hinweise and "Berater" in hinweise


def test_datev_export_mit_konfiguration(db: FakeDB) -> None:
    db.tables["personal_regeln"][0].update(
        {
            "datev_berater_nr": "12345",
            "datev_mandanten_nr": "67890",
            "lohnarten": {
                k: str(100 + i)
                for i, k in enumerate(
                    ("grundlohn", "nacht", "sonntag", "feiertag", "ueberstunden", "urlaub", "krank")
                )
            },
        }
    )
    db.tables["personal_zeiterfassung"] = [
        {
            "id": "z-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "start_at": _utc(date(2026, 8, 3), 6).isoformat(),
            "end_at": _utc(date(2026, 8, 3), 12).isoformat(),
            "pausen": [],
            "quelle": "web",
            "property_id": None,
            "status": "bestaetigt",
        }
    ]
    name, inhalt, mime = AuswertungService(db).lohnexport(
        ctx(), LohnExportRequest(jahr=2026, monat=8)
    )
    text = inhalt.decode("cp1252")
    assert name == "datev-lodas-2026-08.txt" and "windows-1252" in mime
    assert "BeraterNr=12345" in text and "[Bewegungsdaten]" in text
    assert "100;1001;01.08.2026;100;6,00;" in text
