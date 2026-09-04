"""Prognose, Autoplanung und Assistent (0546, §2.3) gegen das DB-Doppel.

KEIN Netz: der Vertex-Client wird per Doppel eingesetzt. Ein Test, der eine
echte Anfrage stellt, prüft die Netzverbindung und nicht die Rechnung — und
kostet bei jedem Lauf Geld.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest

from src.core.ki import KiAntwort, KiError
from src.features.personal._base import PersonalError
from src.features.personal.ki_planung import (
    FUNKTION_ASSISTENT,
    FUNKTION_AUTOPLAN,
    FUNKTION_PROGNOSE,
    KiPlanungService,
)
from src.features.personal.ki_schemas import AssistentRequest, AutoplanRequest
from src.features.site_config import ki_nutzung

from ._fake import FakeDB, basis_tabellen, ctx

MONTAG = date(2026, 9, 7)
SONNTAG = MONTAG + timedelta(days=6)


class _KeinVertex:
    """Vertex ist nicht eingerichtet — die Prognose rechnet trotzdem."""

    is_configured = False
    modell = "keins"
    region = "keine"

    def erzeuge(self, **_kw: object) -> KiAntwort:
        msg = "Der KI-Assistent ist nicht eingerichtet."
        raise KiError(msg, status_code=503)


class _MitVertex:
    """Antwortet mit festem Text und zählt die Aufrufe."""

    is_configured = True
    modell = "gemini-test"
    region = "europe-west4"

    def __init__(self, text: str = "Am Samstag reisen viele ab.") -> None:
        self.text = text
        self.aufrufe: list[dict[str, Any]] = []

    def erzeuge(self, *, system: str, user: str, **_kw: object) -> KiAntwort:
        self.aufrufe.append({"system": system, "user": user})
        return KiAntwort(
            text=self.text,
            modell=self.modell,
            region=self.region,
            dauer_ms=42,
            tokens_ein=100,
            tokens_aus=20,
            abschlussgrund="STOP",
        )


def _utc(d: date, h: int) -> str:
    return datetime(d.year, d.month, d.day, h, tzinfo=UTC).isoformat()


def _tabellen() -> dict[str, list[dict]]:
    t = basis_tabellen()
    t["property_units"] = [
        {"id": "pu-1", "tenant_id": "t-1", "property_id": "p-1", "name": "Haus", "position": 0}
    ]
    t["personal_arbeitsbereiche"] = [
        {
            "id": "ab-1",
            "tenant_id": "t-1",
            "name": "Housekeeping",
            "kurz": "HK",
            "farbe": "#112233",
            "sort": 0,
            "archived_at": None,
        }
    ]
    t["personal_qualifikationen"] = [
        {
            "id": "q-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "stufe": "selbststaendig",
        },
        {
            "id": "q-2",
            "tenant_id": "t-1",
            "user_id": "staff-2",
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "stufe": "lernend",
        },
    ]
    t["reservations"] = [
        {
            "id": "r-1",
            "tenant_id": "t-1",
            "property_id": "p-1",
            "check_in": MONTAG.isoformat(),
            "check_out": (MONTAG + timedelta(days=3)).isoformat(),
            "status": "confirmed",
            "num_guests": 4,
            "total_amount": "900.00",
            "currency": "DKK",
            "channel": "portal",
            "is_owner_stay": False,
        }
    ]
    t["personal_produktivitaet"] = [
        {
            "id": "pv-1",
            "tenant_id": "t-1",
            "arbeitsbereich_id": "ab-1",
            "basis": "einheiten_belegt",
            "wert": 0.5,
            "min_stunden_tag": None,
            "max_stunden_tag": None,
            "notiz": None,
        }
    ]
    t["personal_schichten"] = []
    t["personal_zeiterfassung"] = []
    t["personal_bedarf"] = []
    t["personal_budget"] = []
    t["personal_umsatzbuch"] = []
    t["personal_prognosen"] = []
    t["personal_planungslaeufe"] = []
    t["personal_abwesenheiten"] = []
    t["personal_verfuegbarkeiten"] = []
    t["personal_fremdfirmen"] = []
    t["site_ai_usage"] = []
    return t


@pytest.fixture
def db() -> FakeDB:
    return FakeDB(_tabellen())


@pytest.fixture(autouse=True)
def _deckel(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tagesdeckel aus der Einstellung entkoppeln (nie umgebungsabhängig testen)."""
    monkeypatch.setattr(ki_nutzung, "tageslimit", lambda: 200)


# --- Prognose -----------------------------------------------------------------


def test_prognose_ohne_annahmen_ist_422(db: FakeDB) -> None:
    db.tables["personal_produktivitaet"] = []
    svc = KiPlanungService(db, client=_KeinVertex())
    with pytest.raises(PersonalError) as exc:
        svc.prognose_erzeugen(ctx(), MONTAG)
    assert exc.value.status_code == 422
    assert (exc.value.details or {}).get("code") == "produktivitaet_fehlt"


def test_prognose_rechnet_je_basis(db: FakeDB) -> None:
    """0,5 belegte Einheiten je Stunde: eine belegte Einheit = 2 Stunden."""
    svc = KiPlanungService(db, client=_KeinVertex())
    prognose = svc.prognose_erzeugen(ctx(), MONTAG)
    je_tag = {t.datum: t for t in prognose.ausgabe.tage}
    montag = je_tag[MONTAG].bereiche[0]
    assert montag.basis == "einheiten_belegt"
    assert montag.basis_wert == 1.0
    assert montag.stunden == 2.0
    assert montag.anzahl == 1
    # Donnerstag ist Abreisetag, niemand im Haus → 0 Stunden, 0 Kräfte.
    donnerstag = je_tag[MONTAG + timedelta(days=3)].bereiche[0]
    assert donnerstag.stunden == 0.0
    assert donnerstag.anzahl == 0


def test_prognose_klemmt_an_min_und_max(db: FakeDB) -> None:
    db.tables["personal_produktivitaet"][0]["min_stunden_tag"] = 4
    db.tables["personal_produktivitaet"][0]["max_stunden_tag"] = 6
    svc = KiPlanungService(db, client=_KeinVertex())
    prognose = svc.prognose_erzeugen(ctx(), MONTAG)
    je_tag = {t.datum: t for t in prognose.ausgabe.tage}
    # Ungeklemmt wären es 2 h (Montag) bzw. 0 h (Donnerstag) — beide auf 4 h.
    assert je_tag[MONTAG].bereiche[0].stunden == 4.0
    assert je_tag[MONTAG + timedelta(days=3)].bereiche[0].stunden == 4.0
    db.tables["personal_produktivitaet"][0]["wert"] = 0.05
    prognose = KiPlanungService(db, client=_KeinVertex()).prognose_erzeugen(ctx(), MONTAG)
    je_tag = {t.datum: t for t in prognose.ausgabe.tage}
    # 1 / 0,05 = 20 h, gedeckelt auf 6.
    assert je_tag[MONTAG].bereiche[0].stunden == 6.0


def test_prognose_basis_fest_ignoriert_die_lage(db: FakeDB) -> None:
    db.tables["personal_produktivitaet"][0]["basis"] = "fest"
    db.tables["personal_produktivitaet"][0]["wert"] = 6
    prognose = KiPlanungService(db, client=_KeinVertex()).prognose_erzeugen(ctx(), MONTAG)
    assert all(t.bereiche[0].stunden == 6.0 for t in prognose.ausgabe.tage)


def test_prognose_ohne_vertex_hat_keine_erklaerung_aber_keinen_fehler(db: FakeDB) -> None:
    prognose = KiPlanungService(db, client=_KeinVertex()).prognose_erzeugen(ctx(), MONTAG)
    assert prognose.erklaerung is None
    assert prognose.status == "fertig"
    assert prognose.content_origin == "ki"
    assert prognose.ausgabe.tage
    # Kein Aufruf = keine Buchung.
    assert not db.tables["site_ai_usage"]


def test_prognose_mit_vertex_bucht_die_nutzung(db: FakeDB) -> None:
    client = _MitVertex()
    prognose = KiPlanungService(db, client=client).prognose_erzeugen(ctx(), MONTAG)
    assert prognose.erklaerung == "Am Samstag reisen viele ab."
    assert prognose.modell == "gemini-test"
    assert len(client.aufrufe) == 1
    gebucht = db.tables["site_ai_usage"]
    assert len(gebucht) == 1
    assert gebucht[0]["funktion"] == FUNKTION_PROGNOSE
    assert gebucht[0]["erfolg"] is True


def test_prognose_ki_fehler_kippt_die_rechnung_nicht(db: FakeDB) -> None:
    """Die Zahl ist gerechnet; ein fehlender Kommentar verwirft sie nicht (Wurzel 5)."""

    class _Kaputt(_MitVertex):
        def erzeuge(self, **_kw: object) -> KiAntwort:
            msg = "Der KI-Dienst ist nicht erreichbar."
            raise KiError(msg)

    prognose = KiPlanungService(db, client=_Kaputt()).prognose_erzeugen(ctx(), MONTAG)
    assert prognose.erklaerung is None
    assert prognose.ausgabe.tage
    # Der Fehler wird gebucht, nicht verschluckt.
    assert db.tables["site_ai_usage"][0]["erfolg"] is False


def test_prognose_uebernahme_ist_idempotent(db: FakeDB) -> None:
    """Zweite Übernahme derselben Prognose verdoppelt den Bedarf NICHT (Wurzel 1/2)."""
    svc = KiPlanungService(db, client=_KeinVertex())
    prognose = svc.prognose_erzeugen(ctx(), MONTAG)
    erste = svc.prognose_uebernehmen(ctx(), prognose.id)
    assert erste.angelegt > 0
    assert erste.vorhanden == 0
    bestand = len(db.tables["personal_bedarf"])
    zweite = svc.prognose_uebernehmen(ctx(), prognose.id)
    assert len(db.tables["personal_bedarf"]) == bestand
    assert zweite.vorhanden == bestand
    assert all(r["quelle"] == "prognose" for r in db.tables["personal_bedarf"])


def test_prognose_uebernahme_ersetzt_aeltere_prognose_zeilen(db: FakeDB) -> None:
    svc = KiPlanungService(db, client=_KeinVertex())
    alt = svc.prognose_erzeugen(ctx(), MONTAG)
    svc.prognose_uebernehmen(ctx(), alt.id)
    neu = svc.prognose_erzeugen(ctx(), MONTAG)
    svc.prognose_uebernehmen(ctx(), neu.id)
    prognose_ids = {r["prognose_id"] for r in db.tables["personal_bedarf"]}
    assert prognose_ids == {neu.id}


def test_prognose_uebernahme_laesst_manuelle_zeilen_stehen(db: FakeDB) -> None:
    db.tables["personal_bedarf"] = [
        {
            "id": "b-manuell",
            "tenant_id": "t-1",
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "wochentag": None,
            "datum": MONTAG.isoformat(),
            "zeit_von": "08:00:00",
            "zeit_bis": "12:00:00",
            "anzahl": 1,
            "quelle": "manuell",
            "prognose_id": None,
        }
    ]
    svc = KiPlanungService(db, client=_KeinVertex())
    prognose = svc.prognose_erzeugen(ctx(), MONTAG)
    svc.prognose_uebernehmen(ctx(), prognose.id)
    assert any(r["id"] == "b-manuell" for r in db.tables["personal_bedarf"])


def test_fremde_prognose_ist_404(db: FakeDB) -> None:
    db.tables["personal_prognosen"] = [
        {
            "id": "pr-fremd",
            "tenant_id": "t-2",
            "woche_start": MONTAG.isoformat(),
            "status": "fertig",
            "eingaben": {},
            "ausgabe": {},
            "content_origin": "ki",
        }
    ]
    with pytest.raises(PersonalError) as exc:
        KiPlanungService(db, client=_KeinVertex()).prognose_uebernehmen(ctx(), "pr-fremd")
    assert exc.value.status_code == 404


# --- Autoplanung --------------------------------------------------------------


def _bedarf_anlegen(db: FakeDB, *, tage: int = 3, anzahl: int = 1) -> None:
    db.tables["personal_bedarf"] = [
        {
            "id": f"b-{i}",
            "tenant_id": "t-1",
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "wochentag": None,
            "datum": (MONTAG + timedelta(days=i)).isoformat(),
            "zeit_von": "08:00:00",
            "zeit_bis": "16:00:00",
            "anzahl": anzahl,
            "quelle": "manuell",
            "prognose_id": None,
        }
        for i in range(tage)
    ]


def test_autoplan_ohne_bedarf_ist_422(db: FakeDB) -> None:
    with pytest.raises(PersonalError) as exc:
        KiPlanungService(db, client=_KeinVertex()).autoplan(
            ctx(), MONTAG, AutoplanRequest(planungstyp="faire")
        )
    assert exc.value.status_code == 422
    assert (exc.value.details or {}).get("code") == "bedarf_fehlt"


def test_autoplan_verteilt_und_speichert_den_lauf(db: FakeDB) -> None:
    _bedarf_anlegen(db)
    lauf = KiPlanungService(db, client=_KeinVertex()).autoplan(
        ctx(), MONTAG, AutoplanRequest(planungstyp="faire", varianten=1, zeitlimit_s=5)
    )
    assert lauf.status == "fertig"
    assert lauf.solver == "ortools-cpsat"
    assert len(lauf.varianten) == 1
    assert len(lauf.varianten[0].schichten) == 3
    assert lauf.varianten[0].kennzahlen.unbesetzt == 0
    assert len(db.tables["personal_planungslaeufe"]) == 1


def test_autoplan_respektiert_abwesenheit(db: FakeDB) -> None:
    _bedarf_anlegen(db, tage=1)
    db.tables["personal_abwesenheiten"] = [
        {
            "id": "aw-1",
            "tenant_id": "t-1",
            "user_id": uid,
            "von": MONTAG.isoformat(),
            "bis": MONTAG.isoformat(),
            "status": "genehmigt",
            "art": "urlaub",
        }
        for uid in ("staff-1", "staff-2")
    ]
    lauf = KiPlanungService(db, client=_KeinVertex()).autoplan(
        ctx(), MONTAG, AutoplanRequest(planungstyp="faire", zeitlimit_s=5)
    )
    assert lauf.varianten[0].kennzahlen.unbesetzt == 1
    assert not lauf.varianten[0].schichten


def test_autoplan_drei_varianten_ohne_vertex_ohne_erklaerung(db: FakeDB) -> None:
    _bedarf_anlegen(db, tage=4)
    lauf = KiPlanungService(db, client=_KeinVertex()).autoplan(
        ctx(), MONTAG, AutoplanRequest(planungstyp="alleskoenner", varianten=3, zeitlimit_s=5)
    )
    assert len(lauf.varianten) == 3
    assert [v.name for v in lauf.varianten] == ["A", "B", "C"]
    assert lauf.erklaerung is None


def test_autoplan_mit_vertex_erklaert_die_varianten(db: FakeDB) -> None:
    _bedarf_anlegen(db, tage=4)
    client = _MitVertex("Variante A verteilt gleichmäßiger.")
    lauf = KiPlanungService(db, client=client).autoplan(
        ctx(), MONTAG, AutoplanRequest(planungstyp="faire", varianten=2, zeitlimit_s=5)
    )
    assert lauf.erklaerung == "Variante A verteilt gleichmäßiger."
    assert db.tables["site_ai_usage"][0]["funktion"] == FUNKTION_AUTOPLAN


def test_autoplan_eine_variante_ruft_vertex_nicht(db: FakeDB) -> None:
    """Eine Variante hat keine Unterschiede — ein bezahlter Aufruf dafür wäre sinnlos."""
    _bedarf_anlegen(db)
    client = _MitVertex()
    KiPlanungService(db, client=client).autoplan(
        ctx(), MONTAG, AutoplanRequest(planungstyp="faire", varianten=1, zeitlimit_s=5)
    )
    assert not client.aufrufe
    assert not db.tables["site_ai_usage"]


def test_uebernahme_legt_entwuerfe_mit_lauf_id_an(db: FakeDB) -> None:
    _bedarf_anlegen(db)
    svc = KiPlanungService(db, client=_KeinVertex())
    lauf = svc.autoplan(
        ctx(), MONTAG, AutoplanRequest(planungstyp="faire", zeitlimit_s=5)
    )
    antwort = svc.lauf_uebernehmen(ctx(), lauf.id, 0)
    assert antwort.angelegt == 3
    schichten = db.tables["personal_schichten"]
    assert len(schichten) == 3
    assert all(s["status"] == "entwurf" for s in schichten)
    assert all(s["quelle"] == "autoplan" for s in schichten)
    assert all(s["planungslauf_id"] == lauf.id for s in schichten)
    assert db.tables["personal_planungslaeufe"][0]["status"] == "uebernommen"


def test_uebernahme_zweimal_legt_nicht_doppelt_an(db: FakeDB) -> None:
    _bedarf_anlegen(db)
    svc = KiPlanungService(db, client=_KeinVertex())
    lauf = svc.autoplan(ctx(), MONTAG, AutoplanRequest(planungstyp="faire", zeitlimit_s=5))
    svc.lauf_uebernehmen(ctx(), lauf.id, 0)
    zweite = svc.lauf_uebernehmen(ctx(), lauf.id, 0)
    assert len(db.tables["personal_schichten"]) == 3
    assert zweite.angelegt == 0
    assert zweite.vorhanden == 3


def test_unbekannte_variante_ist_422(db: FakeDB) -> None:
    _bedarf_anlegen(db)
    svc = KiPlanungService(db, client=_KeinVertex())
    lauf = svc.autoplan(
        ctx(), MONTAG, AutoplanRequest(planungstyp="faire", varianten=1, zeitlimit_s=5)
    )
    with pytest.raises(PersonalError) as exc:
        svc.lauf_uebernehmen(ctx(), lauf.id, 2)
    assert exc.value.status_code == 422
    assert (exc.value.details or {}).get("code") == "variante_unbekannt"


def test_verwerfen_loescht_nur_eigene_entwuerfe(db: FakeDB) -> None:
    """Fremde und veröffentlichte Schichten bleiben — sonst räumt es fremde Arbeit weg."""
    _bedarf_anlegen(db, tage=2)
    svc = KiPlanungService(db, client=_KeinVertex())
    lauf = svc.autoplan(ctx(), MONTAG, AutoplanRequest(planungstyp="faire", zeitlimit_s=5))
    svc.lauf_uebernehmen(ctx(), lauf.id, 0)
    # Eine der beiden wurde freigegeben, dazu eine handgemachte Schicht.
    db.tables["personal_schichten"][0]["status"] = "veroeffentlicht"
    db.tables["personal_schichten"].append(
        {
            "id": "s-hand",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "datum": SONNTAG.isoformat(),
            "start_at": _utc(SONNTAG, 8),
            "end_at": _utc(SONNTAG, 12),
            "pause_min": 0,
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "status": "entwurf",
            "quelle": "manuell",
            "planungslauf_id": None,
        }
    )
    antwort = svc.lauf_verwerfen(ctx(), lauf.id)
    assert antwort.geloescht == 1
    uebrig = {s["id"] for s in db.tables["personal_schichten"]}
    assert "s-hand" in uebrig
    assert len(uebrig) == 2
    assert db.tables["personal_planungslaeufe"][0]["status"] == "fertig"


def test_fremder_lauf_ist_404(db: FakeDB) -> None:
    db.tables["personal_planungslaeufe"] = [
        {
            "id": "pl-fremd",
            "tenant_id": "t-2",
            "woche_start": MONTAG.isoformat(),
            "planungstyp": "faire",
            "status": "fertig",
            "varianten": [],
            "content_origin": "ki",
        }
    ]
    svc = KiPlanungService(db, client=_KeinVertex())
    with pytest.raises(PersonalError) as exc:
        svc.lauf_verwerfen(ctx(), "pl-fremd")
    assert exc.value.status_code == 404


# --- Assistent ----------------------------------------------------------------


def test_assistent_ohne_vertex_ist_503(db: FakeDB) -> None:
    """Kein Sprachmodell = nichts zu sagen; das ist der einzige harte 503 hier."""
    svc = KiPlanungService(db, client=_KeinVertex())
    with pytest.raises(PersonalError) as exc:
        svc.assistent(ctx(), AssistentRequest(frage="Wer kann Samstag?", woche=MONTAG))
    assert exc.value.status_code == 503
    assert (exc.value.details or {}).get("code") == "ki_nicht_eingerichtet"
    assert not db.tables["site_ai_usage"]


def test_assistent_antwortet_und_bucht(db: FakeDB) -> None:
    client = _MitVertex("Mette Rein ist am Samstag verfügbar.")
    antwort = KiPlanungService(db, client=client).assistent(
        ctx(), AssistentRequest(frage="Wer kann Samstag Housekeeping?", woche=MONTAG)
    )
    assert antwort.antwort == "Mette Rein ist am Samstag verfügbar."
    assert antwort.content_origin == "ki"
    assert antwort.quellen
    assert db.tables["site_ai_usage"][0]["funktion"] == FUNKTION_ASSISTENT


def test_assistent_kontext_enthaelt_keinen_lohn_und_keine_kennungen(db: FakeDB) -> None:
    """§4.3: der Kontext geht an einen Fremddienst — ohne Gehälter und user_ids."""
    db.tables["personal_schichten"] = [
        {
            "id": "s-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "datum": MONTAG.isoformat(),
            "start_at": _utc(MONTAG, 8),
            "end_at": _utc(MONTAG, 16),
            "pause_min": 0,
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "status": "veroeffentlicht",
            "quelle": "manuell",
        }
    ]
    client = _MitVertex()
    KiPlanungService(db, client=client).assistent(
        ctx(), AssistentRequest(frage="Wer arbeitet Montag?", woche=MONTAG)
    )
    prompt = client.aufrufe[0]["user"]
    assert "Mette Rein" in prompt
    assert "Housekeeping" in prompt
    assert "staff-1" not in prompt
    assert "18000" not in prompt
    assert "stundenlohn" not in prompt.lower()


def test_assistent_deckel_gibt_429(db: FakeDB, monkeypatch: pytest.MonkeyPatch) -> None:
    """Der Deckel greift VOR dem Aufruf — er soll den bezahlten Aufruf verhindern.

    Der Zählerstand wird gesetzt statt über 200 Zeilen erzeugt: das DB-Doppel
    liefert `count` NACH dem `limit(1)`, echtes PostgREST davor. Der Test würde
    also grün werden, ohne den Deckel geprüft zu haben — deshalb hier der
    direkte Stand. Die Schwäche gehört zu `tests/_fake.py` (kein Paketbesitz)
    und ist im Abschlussbericht benannt.
    """
    monkeypatch.setattr(ki_nutzung, "verbrauch_heute", lambda *_a, **_k: 200)
    svc = KiPlanungService(db, client=_MitVertex())
    with pytest.raises(PersonalError) as exc:
        svc.assistent(ctx(), AssistentRequest(frage="Wer kann Samstag?", woche=MONTAG))
    assert exc.value.status_code == 429
    assert (exc.value.details or {}).get("code") == "ki_deckel"


def test_frage_ueber_500_zeichen_wird_abgelehnt() -> None:
    with pytest.raises(ValueError, match="500"):
        AssistentRequest(frage="x" * 501, woche=MONTAG)


# --- Status -------------------------------------------------------------------


def test_status_meldet_konfiguration_und_verbrauch(
    db: FakeDB, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Stand gesetzt, nicht über Zeilen erzeugt — siehe test_assistent_deckel_gibt_429.
    monkeypatch.setattr(ki_nutzung, "verbrauch_heute", lambda *_a, **_k: 1)
    status = KiPlanungService(db, client=_KeinVertex()).status(ctx())
    assert status.konfiguriert is False
    assert status.verbrauch_heute == 1
    assert status.tageslimit == 200
    assert status.solver == "ortools"
    assert KiPlanungService(db, client=_MitVertex()).status(ctx()).konfiguriert is True


def test_funktionsnamen_stehen_im_katalog() -> None:
    """Die zweite Stelle (Wurzel 5): fehlt ein Name dort, bucht `_schreiben` ins Leere."""
    assert FUNKTION_PROGNOSE in ki_nutzung.FUNKTIONEN
    assert FUNKTION_AUTOPLAN in ki_nutzung.FUNKTIONEN
    assert FUNKTION_ASSISTENT in ki_nutzung.FUNKTIONEN


# --- Nachtrag: die zwei Vertragszusagen ohne eigenen Fall oben ----------------


def test_prognose_warnt_bei_ueberschrittener_hoechstarbeitszeit(db: FakeDB) -> None:
    """Pflicht-Hinweis, wenn die Stunden je Kraft über `max_tagesstunden` liegen.

    Sonst übernimmt jemand einen Bedarf, der die Höchstarbeitszeit reißt, und
    erfährt es erst am Konflikt der einzelnen Schicht — also nach der
    Entscheidung statt vor ihr.
    """
    # 7,9 h liegen unter 8 (also EINE Kraft), aber über den hier erlaubten 6.
    db.tables["personal_produktivitaet"][0]["min_stunden_tag"] = 7.9
    db.tables["personal_regeln"][0]["max_tagesstunden"] = 6
    tag = KiPlanungService(db, client=_KeinVertex()).prognose_erzeugen(
        ctx(), MONTAG
    ).ausgabe.tage[0]
    assert tag.bereiche[0].anzahl == 1
    assert any("Höchstarbeitszeit" in h for h in tag.hinweise)


def test_autoplan_nur_offene_zieht_gedeckte_huellen_ab(db: FakeDB) -> None:
    """`nur_offene`: eine schon besetzte Hülle wird nicht ein zweites Mal geplant.

    Ohne diesen Abzug stünde nach dem Autoplan die doppelte Besetzung im Plan —
    dieselbe Klasse wie ein fehlender Gegenzustand (Wurzel 1).
    """
    _bedarf_anlegen(db, tage=3)
    # Montag 08:00–16:00 Kopenhagen = 06:00–14:00 UTC, deckt Hülle b-0.
    db.tables["personal_schichten"] = [
        {
            "id": "sc-vorhanden",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "datum": MONTAG.isoformat(),
            "start_at": _utc(MONTAG, 6),
            "end_at": _utc(MONTAG, 14),
            "pause_min": 0,
            "arbeitsbereich_id": "ab-1",
            "status": "veroeffentlicht",
            "planungslauf_id": None,
        }
    ]
    svc = KiPlanungService(db, client=_KeinVertex())
    offen = svc.autoplan(
        ctx(), MONTAG, AutoplanRequest(planungstyp="faire", varianten=1, zeitlimit_s=5)
    )
    alle = svc.autoplan(
        ctx(),
        MONTAG,
        AutoplanRequest(
            planungstyp="faire", varianten=1, zeitlimit_s=5, nur_offene=False
        ),
    )
    offene_huellen = len(offen.varianten[0].schichten) + offen.varianten[0].kennzahlen.unbesetzt
    alle_huellen = len(alle.varianten[0].schichten) + alle.varianten[0].kennzahlen.unbesetzt
    assert offene_huellen == 2
    assert alle_huellen == 3
