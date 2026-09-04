"""Kennzahlen über dem Dienstplan (0545, §2.1) gegen das DB-Doppel.

Geprüft wird, was ohne Test still falsch wäre und plausibel aussähe:
der Abreisetag als „im Haus", eine Summe über zwei Währungen, Geld an eine
Rolle ohne Finanzrecht, eine Tagesübersteuerung, die die Vorlage verdoppelt.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from src.features.personal.kennzahlen import KennzahlenService

from ._fake import FakeDB, basis_tabellen, ctx

MONTAG = date(2026, 9, 7)
SONNTAG = MONTAG + timedelta(days=6)


def _utc(d: date, h: int, m: int = 0) -> str:
    return datetime(d.year, d.month, d.day, h, m, tzinfo=UTC).isoformat()


def _tabellen() -> dict[str, list[dict]]:
    t = basis_tabellen()
    t["property_units"] = [
        {"id": "pu-1", "tenant_id": "t-1", "property_id": "p-1", "name": "Haus", "position": 0},
        {"id": "pu-2", "tenant_id": "t-1", "property_id": "p-2", "name": "Haus", "position": 0},
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
    t["reservations"] = []
    t["personal_schichten"] = []
    t["personal_zeiterfassung"] = []
    t["personal_bedarf"] = []
    t["personal_budget"] = []
    t["personal_umsatzbuch"] = []
    t["personal_fremdfirmen"] = []
    return t


def _buchung(  # noqa: PLR0913 — eine Zeile mit allen Feldern der Hotel-Zeile
    rid: str,
    ein: date,
    aus: date,
    *,
    gaeste: int = 2,
    betrag: str = "700.00",
    currency: str = "DKK",
    status: str = "confirmed",
    eigennutzung: bool = False,
    property_id: str = "p-1",
) -> dict:
    return {
        "id": rid,
        "tenant_id": "t-1",
        "property_id": property_id,
        "check_in": ein.isoformat(),
        "check_out": aus.isoformat(),
        "status": status,
        "num_guests": gaeste,
        "total_amount": betrag,
        "currency": currency,
        "channel": "portal",
        "is_owner_stay": eigennutzung,
    }


@pytest.fixture
def db() -> FakeDB:
    return FakeDB(_tabellen())


# --- Hotel-Zeile --------------------------------------------------------------


def test_hotel_zeile_abreisetag_ist_nicht_im_haus(db: FakeDB) -> None:
    """Anreise Mo, Abreise Do: im Haus Mo–Mi, am Do nur Abreise.

    Der Grenzfall, der ohne Test plausibel falsch wäre — `check_out` als
    „im Haus" mitzuzählen macht jede Belegung um einen Tag zu lang.
    """
    db.tables["reservations"] = [
        _buchung("r-1", MONTAG, MONTAG + timedelta(days=3), gaeste=3, betrag="900.00")
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    je_tag = {t.datum: t for t in antwort.tage}
    assert je_tag[MONTAG].anreisen == 1
    assert je_tag[MONTAG].einheiten_belegt == 1
    assert je_tag[MONTAG].gaeste_im_haus == 3
    assert je_tag[MONTAG + timedelta(days=2)].einheiten_belegt == 1
    donnerstag = je_tag[MONTAG + timedelta(days=3)]
    assert donnerstag.abreisen == 1
    assert donnerstag.einheiten_belegt == 0
    assert donnerstag.gaeste_im_haus == 0
    # 900 DKK auf drei Nächte = 30000 Öre je Nacht.
    assert je_tag[MONTAG].umsatz_ist_minor == 30_000
    assert antwort.summe.anreisen == 1
    assert antwort.summe.abreisen == 1


def test_hotel_zeile_belegung_und_einheiten_gesamt(db: FakeDB) -> None:
    db.tables["reservations"] = [
        _buchung("r-1", MONTAG, MONTAG + timedelta(days=2), property_id="p-1")
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    montag = next(t for t in antwort.tage if t.datum == MONTAG)
    assert montag.einheiten_gesamt == 2
    assert montag.belegung_pct == 50.0


def test_hotel_zeile_ohne_bestaetigung_zaehlt_nicht(db: FakeDB) -> None:
    db.tables["reservations"] = [
        _buchung("r-1", MONTAG, MONTAG + timedelta(days=2), status="pending"),
        _buchung("r-2", MONTAG, MONTAG + timedelta(days=2), status="cancelled"),
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    assert all(t.einheiten_belegt == 0 for t in antwort.tage)


def test_eigennutzung_belegt_aber_ohne_umsatz(db: FakeDB) -> None:
    """Das Haus ist voll (es muss geputzt werden), Umsatz gibt es keinen."""
    db.tables["reservations"] = [
        _buchung(
            "r-1", MONTAG, MONTAG + timedelta(days=2), betrag="0.00", eigennutzung=True
        )
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    montag = next(t for t in antwort.tage if t.datum == MONTAG)
    assert montag.einheiten_belegt == 1
    assert montag.umsatz_ist_minor == 0


# --- Währung ------------------------------------------------------------------


def test_gemischte_waehrungen_geben_none_und_hinweis(db: FakeDB) -> None:
    """DKK + EUR ist keine Summe, sondern eine Falschaussage (Wurzel 4)."""
    db.tables["reservations"] = [
        _buchung("r-1", MONTAG, MONTAG + timedelta(days=2), currency="DKK"),
        _buchung("r-2", MONTAG, MONTAG + timedelta(days=2), currency="EUR"),
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    montag = next(t for t in antwort.tage if t.datum == MONTAG)
    assert montag.umsatz_ist_minor is None
    assert antwort.currency is None
    assert any("Währungen" in h for h in antwort.hinweise)


def test_buchung_ohne_waehrung_wird_benannt(db: FakeDB) -> None:
    zeile = _buchung("r-1", MONTAG, MONTAG + timedelta(days=2))
    zeile["currency"] = ""
    db.tables["reservations"] = [zeile]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    assert any("ohne Betrag oder Währung" in h for h in antwort.hinweise)


# --- Rollen -------------------------------------------------------------------


def test_rolle_ohne_export_lohn_sieht_keine_finanzfelder(db: FakeDB) -> None:
    """Die Schichtleitung sieht die Hotel-Zeile, aber kein Geld (§4.3, Wurzel 3)."""
    db.tables["reservations"] = [_buchung("r-1", MONTAG, MONTAG + timedelta(days=2))]
    db.tables["personal_schichten"] = [
        {
            "id": "s-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "datum": MONTAG.isoformat(),
            "start_at": _utc(MONTAG, 8),
            "end_at": _utc(MONTAG, 16),
            "pause_min": 30,
            "arbeitsbereich_id": "ab-1",
            "property_id": "p-1",
            "status": "veroeffentlicht",
        }
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx("lead-1", "shift_lead"), MONTAG, SONNTAG)
    montag = next(t for t in antwort.tage if t.datum == MONTAG)
    assert montag.einheiten_belegt == 1
    assert montag.plan_minuten == 450
    assert montag.umsatz_ist_minor is None
    assert montag.personalkosten_plan_minor is None
    assert montag.personalkostenquote_pct is None
    assert montag.produktivitaet_minor_je_stunde is None
    assert antwort.currency is None
    assert antwort.summe.personalkosten_plan_minor is None


def test_leitung_sieht_kosten_und_quote(db: FakeDB) -> None:
    db.tables["reservations"] = [
        _buchung("r-1", MONTAG, MONTAG + timedelta(days=1), betrag="1000.00")
    ]
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
            "property_id": "p-1",
            "status": "veroeffentlicht",
        }
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    montag = next(t for t in antwort.tage if t.datum == MONTAG)
    # 8 h × 180 DKK = 1440 DKK = 144000 Öre.
    assert montag.personalkosten_plan_minor == 144_000
    assert montag.umsatz_ist_minor == 100_000
    assert montag.personalkostenquote_pct == 144.0
    assert antwort.currency == "DKK"


def test_person_ohne_lohn_wird_benannt_nicht_null_gerechnet(db: FakeDB) -> None:
    """staff-2 hat keine Akte — Kosten von 0 wären eine stille Falschaussage."""
    db.tables["personal_schichten"] = [
        {
            "id": "s-1",
            "tenant_id": "t-1",
            "user_id": "staff-2",
            "datum": MONTAG.isoformat(),
            "start_at": _utc(MONTAG, 8),
            "end_at": _utc(MONTAG, 16),
            "pause_min": 0,
            "arbeitsbereich_id": "ab-1",
            "property_id": "p-2",
            "status": "veroeffentlicht",
        }
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    assert any("ohne Lohn" in h for h in antwort.hinweise)
    assert any("Ole Haus" in h for h in antwort.hinweise)


# --- Besetzung Soll/Ist -------------------------------------------------------


def test_besetzung_tageszeile_ersetzt_wochentag_vorlage(db: FakeDB) -> None:
    """Wurzel 1: die Übersteuerung ERSETZT, sie kommt nicht dazu.

    Ohne diese Regel verlangte der Plan am übersteuerten Tag drei Kräfte
    (2 aus der Vorlage + 1 vom Tag) statt der gewollten einen.
    """
    db.tables["personal_bedarf"] = [
        {
            "id": "b-vorlage",
            "tenant_id": "t-1",
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "wochentag": 0,
            "datum": None,
            "zeit_von": "08:00:00",
            "zeit_bis": "12:00:00",
            "anzahl": 2,
            "quelle": "vorlage",
        },
        {
            "id": "b-tag",
            "tenant_id": "t-1",
            "arbeitsbereich_id": "ab-1",
            "property_id": None,
            "wochentag": None,
            "datum": MONTAG.isoformat(),
            "zeit_von": "08:00:00",
            "zeit_bis": "12:00:00",
            "anzahl": 1,
            "quelle": "manuell",
        },
    ]
    db.tables["personal_schichten"] = [
        {
            "id": "s-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "datum": MONTAG.isoformat(),
            "start_at": _utc(MONTAG, 8),
            "end_at": _utc(MONTAG, 12),
            "pause_min": 0,
            "arbeitsbereich_id": "ab-1",
            "property_id": "p-1",
            "status": "veroeffentlicht",
        }
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    bereich = next(b for b in antwort.bereiche if b.arbeitsbereich_id == "ab-1")
    montag = next(t for t in bereich.tage if t.datum == MONTAG)
    assert montag.soll_anzahl == 1
    assert montag.soll_minuten == 240
    assert montag.ist_anzahl == 1
    assert montag.einsaetze == 1
    # Der nächste Montag liegt außerhalb; im Fenster gilt die Vorlage nur am 7.9.
    naechster = next(
        t for t in bereich.tage if t.datum == MONTAG + timedelta(days=1)
    )
    assert naechster.soll_anzahl == 0


def test_abgesagte_schicht_ist_keine_besetzung(db: FakeDB) -> None:
    db.tables["personal_schichten"] = [
        {
            "id": "s-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "datum": MONTAG.isoformat(),
            "start_at": _utc(MONTAG, 8),
            "end_at": _utc(MONTAG, 12),
            "pause_min": 0,
            "arbeitsbereich_id": "ab-1",
            "property_id": "p-1",
            "status": "abgesagt",
        }
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    montag = next(t for t in antwort.tage if t.datum == MONTAG)
    assert montag.plan_minuten == 0
    assert montag.einsaetze == 0


# --- Stundenlimit, Umsatzbuch, Budget -----------------------------------------


def test_stundenlimit_aus_ziel_produktivitaet(db: FakeDB) -> None:
    """Stundenlimit = Plan-Umsatz / Ziel-Produktivität × 60 Minuten."""
    db.tables["personal_regeln"][0]["ziel_umsatzproduktivitaet_minor"] = 50_000
    db.tables["personal_regeln"][0]["kennzahlen_currency"] = "DKK"
    db.tables["reservations"] = [
        _buchung("r-1", MONTAG, MONTAG + timedelta(days=1), betrag="2000.00")
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    montag = next(t for t in antwort.tage if t.datum == MONTAG)
    assert montag.umsatz_plan_minor == 200_000
    assert montag.ziel_produktivitaet_minor == 50_000
    # 200000 / 50000 = 4 Stunden = 240 Minuten.
    assert montag.stundenlimit_minuten == 240


def test_umsatzbuch_uebersteuert_die_buchungen(db: FakeDB) -> None:
    db.tables["reservations"] = [
        _buchung("r-1", MONTAG, MONTAG + timedelta(days=1), betrag="1000.00")
    ]
    db.tables["personal_umsatzbuch"] = [
        {
            "id": "u-1",
            "tenant_id": "t-1",
            "datum": MONTAG.isoformat(),
            "arbeitsbereich_id": None,
            "plan_minor": 500_000,
            "ist_minor": 450_000,
            "currency": "DKK",
            "quelle": "manuell",
        }
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    montag = next(t for t in antwort.tage if t.datum == MONTAG)
    assert montag.umsatz_ist_minor == 450_000
    assert montag.umsatz_plan_minor == 500_000
    assert montag.umsatz_quelle == "manuell"


def test_budget_tageszeile_schlaegt_vorlage_und_rechnet_abweichung(db: FakeDB) -> None:
    db.tables["personal_budget"] = [
        {
            "id": "bu-vorlage",
            "tenant_id": "t-1",
            "wochentag": 0,
            "datum": None,
            "stunden": 10,
            "betrag_minor": None,
            "currency": None,
        },
        {
            "id": "bu-tag",
            "tenant_id": "t-1",
            "wochentag": None,
            "datum": MONTAG.isoformat(),
            "stunden": 8,
            "betrag_minor": 100_000,
            "currency": "DKK",
        },
    ]
    db.tables["personal_schichten"] = [
        {
            "id": "s-1",
            "tenant_id": "t-1",
            "user_id": "staff-1",
            "datum": MONTAG.isoformat(),
            "start_at": _utc(MONTAG, 8),
            "end_at": _utc(MONTAG, 20),
            "pause_min": 0,
            "arbeitsbereich_id": "ab-1",
            "property_id": "p-1",
            "status": "entwurf",
        }
    ]
    antwort = KennzahlenService(db).kennzahlen(ctx(), MONTAG, SONNTAG)
    montag = next(t for t in antwort.tage if t.datum == MONTAG)
    assert montag.budget_stunden == 8.0
    assert montag.budget_minor == 100_000
    # 12 h geplant gegen 8 h Budget = +50 %.
    assert montag.abweichung_budget_pct == 50.0


# --- Deckel -------------------------------------------------------------------


def test_zeitraum_ueber_42_tage_ist_422(db: FakeDB) -> None:
    with pytest.raises(Exception, match="42 Tage") as exc:
        KennzahlenService(db).kennzahlen(ctx(), MONTAG, MONTAG + timedelta(days=42))
    assert getattr(exc.value, "status_code", None) == 422


def test_bis_vor_von_ist_422(db: FakeDB) -> None:
    with pytest.raises(Exception, match="Zeitraum") as exc:
        KennzahlenService(db).kennzahlen(ctx(), SONNTAG, MONTAG)
    assert getattr(exc.value, "status_code", None) == 422
