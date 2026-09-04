"""Rechenkern ohne DB: Konflikte, Zuschläge, Pausen, Urlaub."""

from datetime import UTC, date, datetime, time
from decimal import Decimal

from src.features.personal import regelwerk as rw

REGELN = rw.Regeln(
    zeitzone="Europe/Copenhagen",
    ruhezeit_stunden=11,
    max_tagesstunden=10,
    max_wochenstunden=48,
    nacht_von=time(23, 0),
    nacht_bis=time(6, 0),
    zuschlag_nacht_pct=25,
    zuschlag_sonntag_pct=50,
    zuschlag_feiertag_pct=100,
    zuschlag_ueberstunden_pct=25,
    urlaubsjahr_start_monat=1,
    uebertrag_verfall_monat=3,
    uebertrag_max_tage=None,
    mindest_vorlauf_urlaub_tage=0,
)


def _utc(y: int, m: int, d: int, h: int, mi: int = 0) -> datetime:
    return datetime(y, m, d, h, mi, tzinfo=UTC)


def _block(id_: str, start: datetime, ende: datetime, pause: int = 0) -> rw.Zeitblock:
    return rw.Zeitblock(id=id_, user_id="u", start_at=start, end_at=ende, pause_min=pause)


def _pruefen(neu: rw.Zeitblock, andere: list[rw.Zeitblock], **kw: object) -> list[str]:
    k = rw.konflikte_pruefen(
        neu,
        regeln=REGELN,
        andere=andere,
        abwesenheits_tage=kw.get("abw", set()),  # type: ignore[arg-type]
        gesperrte_fenster=kw.get("gesperrt", []),  # type: ignore[arg-type]
        urlaubssperren_tage=set(),
        qualifiziert=kw.get("quali", None),  # type: ignore[arg-type]
    )
    return [x.art for x in k]


def test_keine_konflikte_bei_normaler_schicht() -> None:
    neu = _block("a", _utc(2026, 9, 7, 6), _utc(2026, 9, 7, 12))
    assert _pruefen(neu, []) == []


def test_doppelbelegung_ist_fehler() -> None:
    neu = _block("a", _utc(2026, 9, 7, 6), _utc(2026, 9, 7, 12))
    alt = _block("b", _utc(2026, 9, 7, 10), _utc(2026, 9, 7, 14))
    k = rw.konflikte_pruefen(
        neu,
        regeln=REGELN,
        andere=[alt],
        abwesenheits_tage=set(),
        gesperrte_fenster=[],
        urlaubssperren_tage=set(),
        qualifiziert=None,
    )
    assert [x.art for x in k] == ["doppelbelegung"]
    assert rw.hat_fehler(k)


def test_ruhezeit_unterschritten() -> None:
    # Vortag bis 22:00 UTC, heute ab 06:00 UTC = 8 h < 11 h.
    alt = _block("b", _utc(2026, 9, 6, 14), _utc(2026, 9, 6, 22))
    neu = _block("a", _utc(2026, 9, 7, 6), _utc(2026, 9, 7, 12))
    arten = _pruefen(neu, [alt])
    assert "ruhezeit" in arten
    assert "doppelbelegung" not in arten


def test_max_tagesstunden_zaehlt_pause_ab() -> None:
    # 11 h brutto mit 90 min Pause = 9,5 h netto → unter 10 h, kein Konflikt.
    neu = _block("a", _utc(2026, 9, 7, 6), _utc(2026, 9, 7, 17), pause=90)
    assert "max_tagesstunden" not in _pruefen(neu, [])
    # Ohne Pause 11 h → Fehler.
    neu2 = _block("a", _utc(2026, 9, 7, 6), _utc(2026, 9, 7, 17))
    assert "max_tagesstunden" in _pruefen(neu2, [])


def test_abwesenheit_am_tag_ist_fehler() -> None:
    neu = _block("a", _utc(2026, 9, 7, 6), _utc(2026, 9, 7, 12))
    assert "abwesenheit" in _pruefen(neu, [], abw={date(2026, 9, 7)})


def test_gesperrtes_fenster_ist_warnung() -> None:
    neu = _block("a", _utc(2026, 9, 7, 6), _utc(2026, 9, 7, 12))
    k = rw.konflikte_pruefen(
        neu,
        regeln=REGELN,
        andere=[],
        abwesenheits_tage=set(),
        gesperrte_fenster=[(_utc(2026, 9, 7, 8), _utc(2026, 9, 7, 9))],
        urlaubssperren_tage=set(),
        qualifiziert=False,
    )
    arten = {x.art: x.schwere for x in k}
    assert arten == {"gesperrt": "warnung", "qualifikation": "warnung"}
    assert not rw.hat_fehler(k)


def test_zuschlaege_minutenweise_und_zeitzone() -> None:
    # 20:00–02:00 Ortszeit Kopenhagen (Sommerzeit, UTC+2) = 18:00–00:00 UTC.
    # Nacht ab 23:00 Ortszeit → 3 h Nacht.
    z = rw.zuschlaege_berechnen(
        _utc(2026, 9, 7, 18), _utc(2026, 9, 8, 0), 0, regeln=REGELN, feiertage=set()
    )
    assert z.netto_min == 360
    assert z.nacht_min == 180
    assert z.sonntag_min == 0


def test_zuschlaege_sonntag_und_feiertag_ausschliessend() -> None:
    # Sonntag 6.9.2026, 08:00–12:00 Ortszeit.
    z = rw.zuschlaege_berechnen(
        _utc(2026, 9, 6, 6), _utc(2026, 9, 6, 10), 0, regeln=REGELN, feiertage=set()
    )
    assert z.sonntag_min == 240
    # Derselbe Tag als Feiertag zählt als Feiertag, nicht doppelt.
    z2 = rw.zuschlaege_berechnen(
        _utc(2026, 9, 6, 6), _utc(2026, 9, 6, 10), 0, regeln=REGELN, feiertage={date(2026, 9, 6)}
    )
    assert (z2.feiertag_min, z2.sonntag_min) == (240, 0)


def test_pause_proportional_abgezogen() -> None:
    z = rw.zuschlaege_berechnen(
        _utc(2026, 9, 7, 18), _utc(2026, 9, 8, 0), 60, regeln=REGELN, feiertage=set()
    )
    assert z.netto_min == 300
    assert z.nacht_min == 150


def test_pause_automatisch_nicht_kumulativ() -> None:
    modelle = [(360, 30), (540, 45)]
    assert rw.pause_automatisch(300, modelle) == 0
    assert rw.pause_automatisch(400, modelle) == 30
    assert rw.pause_automatisch(600, modelle) == 45


def test_zuschlag_betrag_rundet_kaufmaennisch() -> None:
    # 180,00 DKK/h, 90 min, 25 % → 67,50 → 68 (Minor: 6750 → 6750? Minor ist Øre)
    assert rw.zuschlag_betrag_minor(18000, 90, 25) == 6750


def test_abwesenheitstage_mit_feiertag_und_halbtag() -> None:
    # Mo 7.9. – Fr 11.9.2026, Mittwoch Feiertag, halber erster Tag.
    tage = rw.abwesenheitstage(
        date(2026, 9, 7),
        date(2026, 9, 11),
        halbtag_start=True,
        halbtag_ende=False,
        arbeitstage={0, 1, 2, 3, 4},
        feiertage={date(2026, 9, 9)},
    )
    assert tage == Decimal("3.50")


def test_abwesenheit_am_wochenende_zaehlt_nicht() -> None:
    tage = rw.abwesenheitstage(
        date(2026, 9, 5),
        date(2026, 9, 6),
        halbtag_start=False,
        halbtag_ende=False,
        arbeitstage={0, 1, 2, 3, 4},
        feiertage=set(),
    )
    assert tage == Decimal("0")


def test_anspruch_anteilig_zwoelftelung() -> None:
    voll = Decimal("24")
    # Eintritt 1. Juli → 6 volle Monate → 12 Tage.
    tage, anteilig = rw.anspruch_anteilig(
        voll,
        jahr_von=date(2026, 1, 1),
        jahr_bis=date(2026, 12, 31),
        eintritt=date(2026, 7, 1),
        austritt=None,
    )
    assert (tage, anteilig) == (Decimal("12.00"), True)
    # Eintritt 15. Juli → angebrochener Juli zählt nicht → 5 Monate → 10 Tage.
    tage2, _ = rw.anspruch_anteilig(
        voll,
        jahr_von=date(2026, 1, 1),
        jahr_bis=date(2026, 12, 31),
        eintritt=date(2026, 7, 15),
        austritt=None,
    )
    assert tage2 == Decimal("10.00")
    # Ganzjährig → voll, nicht anteilig.
    tage3, anteilig3 = rw.anspruch_anteilig(
        voll,
        jahr_von=date(2026, 1, 1),
        jahr_bis=date(2026, 12, 31),
        eintritt=date(2020, 1, 1),
        austritt=None,
    )
    assert (tage3, anteilig3) == (voll, False)


def test_urlaubsjahr_daenemark_beginnt_september() -> None:
    assert rw.urlaubsjahr(2026, 9) == (date(2026, 9, 1), date(2027, 8, 31))
    assert rw.urlaubsjahr(2026, 1) == (date(2026, 1, 1), date(2026, 12, 31))


def test_sperrfenster_wiederkehrend_in_ortszeit() -> None:
    # Jeden Sonntag (6) ganztags, Woche 7.–13.9.2026 → genau ein Fenster am 13.9.
    fenster = rw.sperrfenster(
        wochentag=6,
        datum_von=None,
        datum_bis=None,
        zeit_von=None,
        zeit_bis=None,
        ganztags=True,
        von=date(2026, 9, 7),
        bis=date(2026, 9, 13),
        zeitzone="Europe/Copenhagen",
    )
    assert len(fenster) == 1
    start, ende = fenster[0]
    # 00:00 Ortszeit = 22:00 UTC am Vortag (Sommerzeit).
    assert start == _utc(2026, 9, 12, 22)
    assert ende == _utc(2026, 9, 13, 22)


def test_ortstag_nutzt_zone() -> None:
    # 22:30 UTC = 00:30 Ortszeit am Folgetag.
    assert rw.ortstag(_utc(2026, 9, 7, 22, 30), "Europe/Copenhagen") == date(2026, 9, 8)
