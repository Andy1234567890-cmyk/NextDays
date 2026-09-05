"""Tests der KI-Live-Diagnose (0568): je offener Bewertung GENAU EIN Grund.

Was ohne Test still danebenginge: eine Diagnose, die etwas anderes erklärt
als der Lauf tut. Deshalb prüfen die Fälle die Stufen in der Reihenfolge des
Laufs — Warteschlange schlägt Protokoll schlägt Bewertungsmerkmale schlägt
Betriebseinstellungen — und den Takt gegen den Worker.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from src.features.reviews.ki_diagnose import diagnose
from src.features.reviews.ki_lauf import MAX_JE_LAUF, TAKT_SEKUNDEN, BewertungsKiLauf
from src.features.reviews.ki_store import KiStore
from src.features.reviews.schemas import KiDiagnoseStufe

from .fake_db import FakeDB

TENANT = "t-1"
JETZT = datetime(2026, 9, 5, 12, 0, tzinfo=UTC)


def _review(rid: str, **extra: object) -> dict:
    zeile = {
        "id": rid,
        "tenant_id": TENANT,
        "ota": "AirBNB",
        "guest_name": "Gast",
        "overall_score": 10,
        "content": "Sehr schön.",
        "received_at": (JETZT - timedelta(days=2)).isoformat(),
        "reply_expires_at": None,
        "is_hidden": False,
        "is_replied": False,
        "is_expired": False,
        "property_id": "p-a",
    }
    zeile.update(extra)
    return zeile


def _db(*reviews: dict, settings: dict | None = None, katalog: bool = True) -> FakeDB:
    return FakeDB(
        {
            "channex_review": list(reviews),
            "guest_review_queue": [],
            "review_ki_protokoll": [],
            "review_ki_stand": [],
            "properties": [{"id": "p-a", "tenant_id": TENANT, "title": "Haus A"}],
            "review_ki_settings": [
                {"tenant_id": TENANT, "ki_aktiv": True, **(settings or {})}
            ],
            "review_ki_katalog": (
                [{"tenant_id": TENANT, "frage_schluessel": "lob_5_sterne", "antwort": "Danke!"}]
                if katalog
                else []
            ),
        },
        unique={"review_ki_stand": ("tenant_id",)},
    )


def _lauf_mit_zaehler(db: FakeDB) -> tuple[BewertungsKiLauf, list[str]]:
    """Lauf, dessen Modellaufruf gezählt statt gemacht wird (kein Vertex)."""
    lauf = BewertungsKiLauf(db)
    aufrufe: list[str] = []

    def _fake(_tenant: str, _s: object, _k: object, lage: object, *, bezug_id: str) -> None:
        del lage
        aufrufe.append(bezug_id)
        return None

    lauf._erzeugen = _fake  # type: ignore[method-assign]  # noqa: SLF001
    return lauf, aufrufe


def _stufe(db: FakeDB, rid: str = "r-1") -> KiDiagnoseStufe:
    d = diagnose(db, TENANT, jetzt=JETZT)
    return next(e.stufe for e in d.items if e.review_id == rid)


def test_takt_deckungsgleich_mit_worker() -> None:
    """„Nächster Lauf um …" rechnet mit diesem Takt — er MUSS der des Workers sein."""
    from src.worker import REVIEWS_TICK_SECONDS

    assert TAKT_SEKUNDEN == REVIEWS_TICK_SECONDS


def test_reine_sternevergabe_wartet_auf_lauf() -> None:
    """Sechs Booking-Bewertungen live: kein Text, aber sechs Kategorienoten.
    Seit 05.09.2026 beantwortet die KI auch die — die Diagnose darf sie
    nicht mehr als „nichts zu tun" führen."""
    db = _db(_review("r-1", content="", scores=[{"score": 7.5, "category": "clean"}]))
    assert _stufe(db) is KiDiagnoseStufe.wartet_auf_lauf


def test_verdeckt_schlaegt_alles_am_merkmal() -> None:
    db = _db(_review("r-1", content="", is_hidden=True))
    assert _stufe(db) is KiDiagnoseStufe.verdeckt


def test_frist_vorbei_trotz_is_expired_false() -> None:
    """Airbnb 25.07.: Channex `is_expired=false`, `expired_at` 24.08. — das
    Portal nimmt nichts mehr an, die KI darf keinen Aufruf dafür bezahlen."""
    db = _db(
        _review(
            "r-1",
            received_at=(JETZT - timedelta(days=20)).isoformat(),
            reply_expires_at=(JETZT - timedelta(days=1)).isoformat(),
        )
    )
    assert _stufe(db) is KiDiagnoseStufe.frist_vorbei
    lauf, aufrufe = _lauf_mit_zaehler(db)
    lauf.run(now=JETZT, only_tenant=TENANT)
    assert aufrufe == []


def test_zu_alt_ausserhalb_rueckblick() -> None:
    db = _db(_review("r-1", received_at=(JETZT - timedelta(days=40)).isoformat()))
    assert _stufe(db) is KiDiagnoseStufe.zu_alt


def test_ki_aus_und_katalog_leer() -> None:
    assert _stufe(_db(_review("r-1"), settings={"ki_aktiv": False})) is KiDiagnoseStufe.ki_aus
    assert _stufe(_db(_review("r-1"), katalog=False)) is KiDiagnoseStufe.katalog_leer


def test_alles_erfuellt_wartet_auf_lauf_ohne_erfundenen_termin() -> None:
    """Kein Lauf bisher → kein „nächster Lauf" (Wurzel 4)."""
    d = diagnose(_db(_review("r-1")), TENANT, jetzt=JETZT)
    assert d.items[0].stufe is KiDiagnoseStufe.wartet_auf_lauf
    assert d.letzter_lauf_at is None
    assert d.naechster_lauf_at is None
    assert d.takt_minuten == TAKT_SEKUNDEN // 60


def test_warteschlange_schlaegt_alles() -> None:
    """Ein Eintrag in der Schlange ist die Wahrheit über den Stand — auch
    wenn die Bewertung inzwischen ohne Text dastünde."""
    db = _db(_review("r-1", content=""))
    db.tables["guest_review_queue"].append(
        {
            "tenant_id": TENANT,
            "richtung": "antwort",
            "antwort_auf_id": "r-1",
            "status": "geplant",
            "zustellart": "entwurf",
            "send_at": JETZT.isoformat(),
        }
    )
    assert _stufe(db) is KiDiagnoseStufe.entwurf_wartet
    db.tables["guest_review_queue"][0]["zustellart"] = "automatisch"
    assert _stufe(db) is KiDiagnoseStufe.geplant
    db.tables["guest_review_queue"][0]["status"] = "gesendet"
    assert _stufe(db) is KiDiagnoseStufe.gesendet
    db.tables["guest_review_queue"][0]["status"] = "fehler"
    db.tables["guest_review_queue"][0]["error"] = "Portal 500"
    d = diagnose(db, TENANT, jetzt=JETZT)
    assert d.items[0].stufe is KiDiagnoseStufe.fehler
    assert d.items[0].fehler == "Portal 500"


def test_protokoll_ohne_eintrag_heisst_ki_abgelehnt() -> None:
    """Die KI hat es angesehen und bewusst nichts angelegt (Mensch prüfen /
    KI-Fehler). Der Grund aus dem Protokoll steht an der Zeile."""
    db = _db(_review("r-1"))
    db.tables["review_ki_protokoll"].append(
        {
            "tenant_id": TENANT,
            "richtung": "antwort",
            "bezug_id": "r-1",
            "grund": "Menschliche Prüfung nötig: Bewertung auf Italienisch",
            "created_at": JETZT.isoformat(),
        }
    )
    d = diagnose(db, TENANT, jetzt=JETZT)
    assert d.items[0].stufe is KiDiagnoseStufe.ki_abgelehnt
    assert "Italienisch" in (d.items[0].protokoll_grund or "")


def test_stand_signal_wird_fortgeschrieben() -> None:
    """Der Lauf schreibt das Realtime-Signal — Start und Ende, mit Zähler."""
    db = _db(_review("r-1", content=""))
    lauf, aufrufe = _lauf_mit_zaehler(db)
    lauf.run(now=JETZT, only_tenant=TENANT)
    stand = KiStore(db).stand(TENANT)
    assert stand is not None
    assert stand["letzter_lauf_at"]
    assert stand["letzter_schritt"].startswith("Lauf beendet")
    assert stand["laeufe"] == 1
    # Nur Note, kein Text, keine Kategorien: die Gesamtnote reicht als Anlass.
    assert aufrufe == ["r-1"]
    d = diagnose(db, TENANT, jetzt=JETZT)
    assert d.naechster_lauf_at is not None


def test_only_tenant_arbeitet_fremde_betriebe_nicht_ab() -> None:
    db = _db(_review("r-1", content="", overall_score=None))
    db.tables["review_ki_settings"].append({"tenant_id": "t-2", "ki_aktiv": True})
    BewertungsKiLauf(db).run(now=JETZT, only_tenant=TENANT)
    assert {z["tenant_id"] for z in db.tables["review_ki_stand"]} == {TENANT}


def test_erledigte_neuere_verdraengen_die_aeltesten_nicht() -> None:
    """Live 05.09.2026: vier Bewertungen vom 07.–09.08. warteten fünf Läufe.

    Das Limit stand VOR der Aussiebung an der Kandidaten-Abfrage (neueste
    zuerst). Sobald 15 neuere schon protokolliert waren, blieben die älteren
    ohne jeden Versuch. Sah aus wie ein Rate-Limit, war eine Auswahl."""
    neuere = [
        _review(f"neu-{i}", received_at=(JETZT - timedelta(hours=i)).isoformat())
        for i in range(MAX_JE_LAUF)
    ]
    alte = _review("alt", received_at=(JETZT - timedelta(days=25)).isoformat())
    db = _db(*neuere, alte)
    db.tables["review_ki_protokoll"] = [
        {"tenant_id": TENANT, "richtung": "antwort", "bezug_id": r["id"]} for r in neuere
    ]
    lauf, aufrufe = _lauf_mit_zaehler(db)
    lauf.run(now=JETZT, only_tenant=TENANT)
    assert aufrufe == ["alt"]


def test_deckel_zaehlt_modellaufrufe_und_nimmt_die_fristnaechsten_zuerst() -> None:
    zeilen = [
        _review(f"r-{i}", received_at=(JETZT - timedelta(days=i)).isoformat())
        for i in range(MAX_JE_LAUF + 5)
    ]
    db = _db(*zeilen)
    lauf, aufrufe = _lauf_mit_zaehler(db)
    lauf.run(now=JETZT, only_tenant=TENANT)
    assert len(aufrufe) == MAX_JE_LAUF
    # Älteste zuerst: r-19 (19 Tage alt) vor r-0 (heute).
    assert aufrufe[0] == f"r-{MAX_JE_LAUF + 4}"
    assert "r-0" not in aufrufe
    stand = KiStore(db).stand(TENANT)
    assert stand is not None
