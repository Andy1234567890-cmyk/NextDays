"""Vorschlagswerte je Land: alle 27 EU-Länder, kein stiller Rückfall."""

from src.features.personal import laender


def test_alle_eu_laender_haben_zeitzone() -> None:
    assert set(laender.ZEITZONE) == laender.EU_LAENDER
    assert len(laender.EU_LAENDER) == 27


def test_daenemark_ist_landesspezifisch() -> None:
    v, spezifisch = laender.vorschlag_fuer("dk")
    assert v is not None and spezifisch
    assert v.urlaubstage == 25
    assert v.urlaubsjahr_start_monat == 9
    assert "Ferieloven" in v.quelle


def test_land_ohne_eigene_zeile_bekommt_eu_basis_mit_hinweis() -> None:
    v, spezifisch = laender.vorschlag_fuer("MT")
    assert v is not None and not spezifisch
    assert v.ruhezeit_stunden == 11
    assert v.max_wochenstunden == 48
    assert any("Mindestwerte" in h for h in v.hinweise)


def test_nicht_eu_bekommt_nichts() -> None:
    assert laender.vorschlag_fuer("CH") == (None, False)
    assert laender.vorschlag_fuer(None) == (None, False)
    assert laender.zeitzone_fuer("US") is None


def test_jeder_vorschlag_nennt_seine_quelle() -> None:
    for code, v in laender.VORSCHLAEGE.items():
        assert code in laender.EU_LAENDER
        assert v.quelle, code
        assert 0 <= v.urlaubsjahr_start_monat - 1 < 12
