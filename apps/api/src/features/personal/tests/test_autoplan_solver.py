"""Der Autoplan-Solver als reine Funktion (0546, §2.3).

Die harten Regeln werden EINZELN geprüft: eine Regel, die nur in der Summe
„irgendwie" hält, ist nicht geprüft. Jeder Test baut die Instanz so, dass die
Zuteilung ohne diese Regel möglich WÄRE — sonst beweist ein `unbesetzt == 1`
nur, dass niemand qualifiziert war.

Deterministisch: derselbe Seed gibt dasselbe Ergebnis (ein Suchthread, siehe
`autoplan_solver.planen`). Ohne das ließe sich die Variantenerklärung nicht
nachvollziehen.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from src.features.personal.autoplan_solver import (
    GEWICHTE,
    Block,
    Huelle,
    Person,
    SolverRegeln,
    planen,
)

MONTAG = date(2026, 9, 7)

REGELN = SolverRegeln(
    zeitzone="UTC",
    ruhezeit_stunden=11,
    max_tagesstunden=10,
    max_wochenstunden=48,
    jugendschutz_bis_alter=18,
    jugendschutz_max_tagesstunden=8,
    jugendschutz_nacht_von_min=20 * 60,
    jugendschutz_nacht_bis_min=6 * 60,
)


def _huelle(  # noqa: PLR0913 — eine Hülle mit allen Merkmalen
    hid: str,
    tag: date,
    stunde: int,
    *,
    dauer: int = 8,
    bereich: str | None = "hk",
    objekt: str | None = None,
) -> Huelle:
    start = datetime(tag.year, tag.month, tag.day, stunde, tzinfo=UTC)
    return Huelle(
        id=hid,
        datum=tag,
        start_at=start,
        end_at=start + timedelta(hours=dauer),
        pause_min=0,
        arbeitsbereich_id=bereich,
        property_id=objekt,
        bedarf_id=hid.split(":")[0],
    )


def _person(uid: str, **kw: object) -> Person:
    daten: dict[str, object] = {"qualifikationen": {"hk": "selbststaendig"}}
    daten.update(kw)
    return Person(user_id=uid, **daten)  # type: ignore[arg-type]


# --- Grundfall ----------------------------------------------------------------


def test_kleine_instanz_wird_vollstaendig_besetzt() -> None:
    """Drei Personen, vier Hüllen an vier Tagen — nichts bleibt offen."""
    huellen = [
        _huelle("a", MONTAG, 8),
        _huelle("b", MONTAG + timedelta(days=1), 8),
        _huelle("c", MONTAG + timedelta(days=2), 8),
        _huelle("d", MONTAG + timedelta(days=3), 8),
    ]
    personen = [_person("u1"), _person("u2"), _person("u3")]
    ergebnis = planen(
        huellen=huellen,
        personen=personen,
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.status in ("OPTIMAL", "FEASIBLE")
    assert len(ergebnis.zuteilungen) == 4
    assert ergebnis.kennzahlen.unbesetzt == 0
    assert ergebnis.kennzahlen.stunden == 32.0


def test_gleicher_seed_gibt_gleiches_ergebnis() -> None:
    huellen = [_huelle(f"h{i}", MONTAG + timedelta(days=i), 8) for i in range(4)]
    personen = [_person("u1"), _person("u2")]
    args = {
        "huellen": huellen,
        "personen": personen,
        "bestehende": [],
        "regeln": REGELN,
        "planungstyp": "alleskoenner",
        "zeitlimit_s": 5,
        "seed": 7,
    }
    a = planen(**args)  # type: ignore[arg-type]
    b = planen(**args)  # type: ignore[arg-type]
    assert sorted((z.huelle_id, z.user_id) for z in a.zuteilungen) == sorted(
        (z.huelle_id, z.user_id) for z in b.zuteilungen
    )


# --- Harte Regeln, jede einzeln -----------------------------------------------


def test_abwesenheit_verhindert_die_zuteilung() -> None:
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 8)],
        personen=[_person("u1", abwesenheits_tage=frozenset({MONTAG}))],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.unbesetzt == 1
    assert not ergebnis.zuteilungen


def test_gesperrte_verfuegbarkeit_verhindert_die_zuteilung() -> None:
    sperre = (
        datetime(2026, 9, 7, 6, tzinfo=UTC),
        datetime(2026, 9, 7, 20, tzinfo=UTC),
    )
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 8)],
        personen=[_person("u1", gesperrte_fenster=(sperre,))],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.unbesetzt == 1


def test_ohne_qualifikation_keine_zuteilung() -> None:
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 8, bereich="rezeption")],
        personen=[_person("u1")],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.unbesetzt == 1


def test_objektgebundene_qualifikation_gilt_nur_dort() -> None:
    person = _person("u1", quali_objekte={"hk": {"p-1"}})
    am_eigenen = planen(
        huellen=[_huelle("a", MONTAG, 8, objekt="p-1")],
        personen=[person],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    am_fremden = planen(
        huellen=[_huelle("a", MONTAG, 8, objekt="p-2")],
        personen=[person],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert am_eigenen.kennzahlen.unbesetzt == 0
    assert am_fremden.kennzahlen.unbesetzt == 1


def test_doppelbelegung_untereinander_ist_unmoeglich() -> None:
    """Zwei überlappende Hüllen, eine Person: eine bleibt offen."""
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 8), _huelle("b", MONTAG, 10, dauer=4)],
        personen=[_person("u1")],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert len(ergebnis.zuteilungen) == 1
    assert ergebnis.kennzahlen.unbesetzt == 1


def test_doppelbelegung_mit_bestehender_schicht_ist_unmoeglich() -> None:
    bestand = Block(
        user_id="u1",
        start_at=datetime(2026, 9, 7, 9, tzinfo=UTC),
        end_at=datetime(2026, 9, 7, 12, tzinfo=UTC),
    )
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 8)],
        personen=[_person("u1")],
        bestehende=[bestand],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.unbesetzt == 1


def test_ruhezeit_verhindert_zwei_dienste_am_selben_tag() -> None:
    """8–16 Uhr und 20–02 Uhr sind vier Stunden Abstand, verlangt sind elf."""
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 8), _huelle("b", MONTAG, 20, dauer=6)],
        personen=[_person("u1")],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert len(ergebnis.zuteilungen) == 1
    assert ergebnis.kennzahlen.unbesetzt == 1


def test_max_tagesstunden_deckelt_die_summe() -> None:
    """Zwei Sechsstundendienste ohne Überlappung ergäben 12 h — erlaubt sind 10."""
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 0, dauer=6), _huelle("b", MONTAG, 6, dauer=6)],
        personen=[_person("u1")],
        bestehende=[],
        regeln=SolverRegeln(
            zeitzone="UTC", ruhezeit_stunden=0, max_tagesstunden=10, max_wochenstunden=48
        ),
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert len(ergebnis.zuteilungen) == 1


def test_max_wochenstunden_deckelt_die_woche() -> None:
    huellen = [_huelle(f"h{i}", MONTAG + timedelta(days=i), 8) for i in range(6)]
    ergebnis = planen(
        huellen=huellen,
        personen=[_person("u1")],
        bestehende=[],
        regeln=SolverRegeln(
            zeitzone="UTC", ruhezeit_stunden=0, max_tagesstunden=10, max_wochenstunden=32
        ),
        planungstyp="faire",
        zeitlimit_s=5,
    )
    # 32 h Grenze bei 8-h-Diensten = höchstens vier.
    assert len(ergebnis.zuteilungen) == 4


def test_jugendschutz_nachtfenster_sperrt_die_huelle() -> None:
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 21, dauer=4)],
        personen=[_person("u1", alter=16)],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.unbesetzt == 1


def test_jugendschutz_tagesstunden_sperrt_die_lange_huelle() -> None:
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 8, dauer=10)],
        personen=[_person("u1", alter=16)],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.unbesetzt == 1


def test_jugendschutz_gilt_nicht_fuer_volljaehrige() -> None:
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 21, dauer=4)],
        personen=[_person("u1", alter=30)],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.unbesetzt == 0


def test_ohne_alter_keine_jugendschutz_pruefung() -> None:
    """Wurzel 4: ein fehlendes Geburtsdatum wird nicht geraten."""
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 21, dauer=4)],
        personen=[_person("u1")],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.unbesetzt == 0


def test_verdienstgrenze_ist_eine_harte_obergrenze() -> None:
    """Grenze 500 DKK, Dienst kostet 8 × 150 = 1200 DKK — er bleibt offen."""
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 8)],
        personen=[
            _person(
                "u1",
                stundenlohn_minor=15_000,
                currency="DKK",
                verdienstgrenze_minor=50_000,
            )
        ],
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.unbesetzt == 1


# --- Planungstypen ------------------------------------------------------------


def test_planungstyp_veraendert_die_zuteilung_sichtbar() -> None:
    """Skills-Typen nehmen den Profi, kostenbewusste die günstige Kraft.

    Ohne diesen Test wäre die Gewichtungstabelle eine Attrappe: sie stand im
    Vertrag, bewegte aber in der Rechnung nichts, weil die Lohnbeträge in Minor
    jede andere Skala überstiegen (gemessen am 04.09.2026).
    """
    huellen = [_huelle("a", MONTAG, 8)]
    personen = [
        Person(
            user_id="profi",
            qualifikationen={"hk": "anleitend"},
            stundenlohn_minor=20_000,
            currency="DKK",
        ),
        Person(
            user_id="lehrling",
            qualifikationen={"hk": "lernend"},
            stundenlohn_minor=10_000,
            currency="DKK",
        ),
    ]

    def wer(typ: str) -> str:
        ergebnis = planen(
            huellen=huellen,
            personen=personen,
            bestehende=[],
            regeln=REGELN,
            planungstyp=typ,
            zeitlimit_s=5,
        )
        return ergebnis.zuteilungen[0].user_id

    assert wer("talentscout") == "profi"
    assert wer("performer") == "profi"
    assert wer("zeitschwaermer") == "lehrling"


def test_fairness_verteilt_gleichmaessig(planungstyp: str = "faire") -> None:
    huellen = [_huelle(f"h{i}", MONTAG + timedelta(days=i), 8) for i in range(4)]
    personen = [_person("u1"), _person("u2")]
    ergebnis = planen(
        huellen=huellen,
        personen=personen,
        bestehende=[],
        regeln=REGELN,
        planungstyp=planungstyp,
        zeitlimit_s=5,
    )
    je_person: dict[str, int] = {}
    for z in ergebnis.zuteilungen:
        je_person[z.user_id] = je_person.get(z.user_id, 0) + 1
    assert sorted(je_person.values()) == [2, 2]
    assert ergebnis.kennzahlen.fairness_pct == 100.0


def test_fairness_ignoriert_nicht_einsetzbare_personen() -> None:
    """Wer für keine Hülle qualifiziert ist, verzerrt die Kennzahl nicht."""
    huellen = [_huelle("a", MONTAG, 8), _huelle("b", MONTAG + timedelta(days=1), 8)]
    personen = [_person("u1"), _person("u2"), Person(user_id="u3")]
    ergebnis = planen(
        huellen=huellen,
        personen=personen,
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.fairness_pct == 100.0


def test_alle_sieben_planungstypen_sind_hinterlegt() -> None:
    """Die Tabelle aus Vertrag §2.3 — vollständig und mit den Vertragsgewichten."""
    assert set(GEWICHTE) == {
        "performer",
        "alleskoenner",
        "superfaire",
        "zeitschwaermer",
        "talentscout",
        "faire",
        "philanthrop",
    }
    assert GEWICHTE["performer"] == {
        "soll": 3,
        "skills": 3,
        "wunsch": 1,
        "fairness": 1,
        "kosten": 1,
    }
    assert GEWICHTE["superfaire"]["kosten"] == 0


# --- Kennzahlen ---------------------------------------------------------------


def test_gemischte_waehrungen_geben_keine_kostensumme() -> None:
    """Wurzel 4: DKK + EUR ist keine Zahl."""
    huellen = [_huelle("a", MONTAG, 8), _huelle("b", MONTAG + timedelta(days=1), 8)]
    personen = [
        Person(
            user_id="u1",
            qualifikationen={"hk": "selbststaendig"},
            stundenlohn_minor=15_000,
            currency="DKK",
        ),
        Person(
            user_id="u2",
            qualifikationen={"hk": "selbststaendig"},
            stundenlohn_minor=2_000,
            currency="EUR",
        ),
    ]
    ergebnis = planen(
        huellen=huellen,
        personen=personen,
        bestehende=[],
        regeln=REGELN,
        planungstyp="faire",
        zeitlimit_s=5,
    )
    assert len(ergebnis.zuteilungen) == 2
    assert ergebnis.kennzahlen.kosten_minor is None
    assert ergebnis.kennzahlen.currency is None


def test_wunschzeiten_werden_gezaehlt() -> None:
    wunsch = (
        datetime(2026, 9, 7, 8, tzinfo=UTC),
        datetime(2026, 9, 7, 16, tzinfo=UTC),
    )
    ergebnis = planen(
        huellen=[_huelle("a", MONTAG, 8)],
        personen=[_person("u1", wunsch_fenster=(wunsch,))],
        bestehende=[],
        regeln=REGELN,
        planungstyp="superfaire",
        zeitlimit_s=5,
    )
    assert ergebnis.kennzahlen.wunsch_erfuellt_pct == 100.0
