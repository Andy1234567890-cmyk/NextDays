"""Der Wechseltag muss je EINHEIT gelten, nicht je Objekt.

Ein Wechsel ist der Tag, an dem in DERSELBEN Einheit ein Gast abreist und ein
anderer anreist — der teuerste Reinigungstag, weil zwischen zwei Belegungen
gedreht werden muss.

Warum die Einheiten-Trennung der Kern dieser Datei ist: eine `properties`-Zeile
ist ein Einheiten-TYP mit n >= 1 Einheiten (CLAUDE.md, 0265). Objektweit
gerechnet meldete ein Betrieb mit fuenf gleichen Studios Wechseltage, die es
nicht gibt — Abreise in Studio A und Anreise in Studio B sind zwei unabhaengige
Vorgaenge, dort wird nichts gedreht. Ein Test, der nur ein Objekt mit einer
Einheit kennt, waere gegen genau diesen Fehler blind.
"""
from datetime import date

from src.features.reservations.dashboard import _wechsel_partner


def _r(
    rid: str,
    pid: str,
    uid: str | None,
    check_in: str,
    check_out: str,
    status: str = "confirmed",
) -> dict:
    return {
        "id": rid,
        "property_id": pid,
        "unit_id": uid,
        "check_in": check_in,
        "check_out": check_out,
        "status": status,
    }


def test_gleiche_einheit_abreise_trifft_anreise_ist_wechsel() -> None:
    """Der Grundfall: eine Einheit, Abreise und Anreise am selben Tag."""
    rows = [
        _r("a", "p1", "u1", "2026-09-01", "2026-09-05"),
        _r("b", "p1", "u1", "2026-09-05", "2026-09-09"),
    ]
    sicher, unbekannt = _wechsel_partner(rows)
    assert sicher == {"a", "b"}
    assert unbekannt == set()


def test_verschiedene_einheiten_am_selben_tag_ist_kein_wechsel() -> None:
    """Fuenf gleiche Studios: Abreise in u1, Anreise in u2 — nichts wird gedreht.

    Das ist der Fall, den eine objektweite Rechnung falsch meldet.
    """
    rows = [
        _r("a", "p1", "u1", "2026-09-01", "2026-09-05"),
        _r("b", "p1", "u2", "2026-09-05", "2026-09-09"),
    ]
    sicher, unbekannt = _wechsel_partner(rows)
    assert sicher == set()
    assert unbekannt == set()


def test_verschiedene_objekte_am_selben_tag_ist_kein_wechsel() -> None:
    rows = [
        _r("a", "p1", "u1", "2026-09-01", "2026-09-05"),
        _r("b", "p2", "u1", "2026-09-05", "2026-09-09"),
    ]
    assert _wechsel_partner(rows) == (set(), set())


def test_leere_nacht_dazwischen_ist_kein_wechsel() -> None:
    """Abreise am 05., naechste Anreise am 06. — eine Nacht Luft."""
    rows = [
        _r("a", "p1", "u1", "2026-09-01", "2026-09-05"),
        _r("b", "p1", "u1", "2026-09-06", "2026-09-09"),
    ]
    assert _wechsel_partner(rows) == (set(), set())


def test_fehlende_einheit_ist_unbekannt_nicht_nein() -> None:
    """`unit_id` ist nullable (0265) — dann ist die Frage offen, nicht beantwortet.

    Ein geratenes „nein" waere eine erfundene Aussage (Wurzel 4): der Betrieb
    saehe eine Reinigung nicht, die vielleicht ansteht. Ein geratenes „ja"
    ebenso falsch. Die Luecke gehoert sichtbar gemacht.
    """
    rows = [
        _r("a", "p1", None, "2026-09-01", "2026-09-05"),
        _r("b", "p1", "u1", "2026-09-05", "2026-09-09"),
    ]
    sicher, unbekannt = _wechsel_partner(rows)
    assert sicher == set()
    assert unbekannt == {"a", "b"}


def test_beide_ohne_einheit_ist_unbekannt() -> None:
    rows = [
        _r("a", "p1", None, "2026-09-01", "2026-09-05"),
        _r("b", "p1", None, "2026-09-05", "2026-09-09"),
    ]
    sicher, unbekannt = _wechsel_partner(rows)
    assert sicher == set()
    assert unbekannt == {"a", "b"}


def test_sicherer_wechsel_schlaegt_unbekannt() -> None:
    """Steht eine Zeile ueber ihre eigene Einheit schon sicher fest, darf eine
    dritte Zeile ohne Einheit sie nicht zusaetzlich als „unbekannt" melden.

    Und umgekehrt: `c` MUSS „unbekannt" bekommen. Seine Einheit ist nicht
    hinterlegt, es koennte u1 sein — dann waere der 05.09. auch fuer `c` ein
    Wechseltag. Ein „nein" waere hier die erfundene Aussage.
    """
    rows = [
        _r("a", "p1", "u1", "2026-09-01", "2026-09-05"),
        _r("b", "p1", "u1", "2026-09-05", "2026-09-09"),
        _r("c", "p1", None, "2026-09-05", "2026-09-07"),
    ]
    sicher, unbekannt = _wechsel_partner(rows)
    assert sicher == {"a", "b"}
    assert unbekannt == {"c"}


def test_anreisende_zeile_ohne_einheit_wird_geprueft() -> None:
    """Beide KANTEN zaehlen, nicht nur die Abreise.

    Der Fehler, den dieser Test festhaelt: geprueft wurde nur `check_out`. Eine
    Zeile, die an einem Wechseltag ANREIST und deren eigene Abreise keinen
    Partner hat, kam nie zur Pruefung — sie bekam „nein". Ob das passierte,
    hing an einer dritten, fremden Zeile: mit `b` daneben „nein", ohne `b`
    „unbekannt". Dasselbe Datum, zwei Antworten.
    """
    ohne_dritte = _wechsel_partner([
        _r("a", "p1", "u1", "2026-09-01", "2026-09-05"),
        _r("c", "p1", None, "2026-09-05", "2026-09-07"),
    ])
    mit_dritter = _wechsel_partner([
        _r("a", "p1", "u1", "2026-09-01", "2026-09-05"),
        _r("b", "p1", "u1", "2026-09-05", "2026-09-09"),
        _r("c", "p1", None, "2026-09-05", "2026-09-07"),
    ])
    # `c` haengt an SEINER Datenlage, nicht daran, wer sonst noch dasteht.
    assert "c" in ohne_dritte[1]
    assert "c" in mit_dritter[1]


def test_unbekannt_bleibt_wenn_partner_anderweitig_sicher_ist() -> None:
    """`a` ohne Einheit trifft `b`, das ueber eine ANDERE Kante sicher wechselt.

    Dass `b` am 09.09. mit `c` einen echten Wechsel hat, sagt nichts darueber,
    ob `b` am 05.09. auch `a`s Partner war. `a` muss „unbekannt" bleiben —
    sonst rechnet die Gewissheit eines anderen die eigene Luecke weg.
    """
    rows = [
        _r("a", "p1", None, "2026-09-01", "2026-09-05"),
        _r("b", "p1", "u1", "2026-09-05", "2026-09-09"),
        _r("c", "p1", "u1", "2026-09-09", "2026-09-12"),
    ]
    sicher, unbekannt = _wechsel_partner(rows)
    assert sicher == {"b", "c"}
    assert unbekannt == {"a"}


def test_stornierte_zeile_belegt_nicht() -> None:
    """`cancelled`/`declined`/`expired` belegen keine Nacht (0184) — eine
    stornierte Anreise macht aus einer Abreise keinen Wechseltag."""
    for status in ("cancelled", "declined", "expired"):
        rows = [
            _r("a", "p1", "u1", "2026-09-01", "2026-09-05"),
            _r("b", "p1", "u1", "2026-09-05", "2026-09-09", status=status),
        ]
        assert _wechsel_partner(rows) == (set(), set()), status


def test_zeile_ohne_objekt_faellt_raus() -> None:
    rows = [
        _r("a", None, "u1", "2026-09-01", "2026-09-05"),
        _r("b", "p1", "u1", "2026-09-05", "2026-09-09"),
    ]
    assert _wechsel_partner(rows) == (set(), set())


def test_kette_von_drei_belegungen() -> None:
    """Zwei Wechseltage hintereinander: die mittlere Zeile ist bei beiden dabei."""
    rows = [
        _r("a", "p1", "u1", "2026-09-01", "2026-09-05"),
        _r("b", "p1", "u1", "2026-09-05", "2026-09-09"),
        _r("c", "p1", "u1", "2026-09-09", "2026-09-12"),
    ]
    sicher, unbekannt = _wechsel_partner(rows)
    assert sicher == {"a", "b", "c"}
    assert unbekannt == set()


def test_date_objekte_werden_wie_strings_behandelt() -> None:
    """`check_in`/`check_out` sind DATE-Spalten; die Bibliothek liefert je nach
    Weg `str` oder `date`. Beides muss dieselbe Antwort geben — sonst haengt der
    Wechseltag daran, ueber welchen Pfad die Zeile kam."""
    rows = [
        {
            "id": "a",
            "property_id": "p1",
            "unit_id": "u1",
            "check_in": date(2026, 9, 1),
            "check_out": date(2026, 9, 5),
            "status": "confirmed",
        },
        {
            "id": "b",
            "property_id": "p1",
            "unit_id": "u1",
            "check_in": date(2026, 9, 5),
            "check_out": date(2026, 9, 9),
            "status": "confirmed",
        },
    ]
    sicher, _ = _wechsel_partner(rows)
    assert sicher == {"a", "b"}


def test_leere_menge() -> None:
    assert _wechsel_partner([]) == (set(), set())


# --- Aufrufebene: reicht der DB-Vorfilter weit genug? ------------------------
# Die Tests oben pruefen die reine Funktion mit handgebauten Zeilen. Damit
# bleibt unbelegt, ob der Aufrufer ihr ueberhaupt die noetigen Zeilen liefert —
# und genau dort sass der Fehler: `dashboard_liste` beschnitt die Menge mit
# `check_in <= ende`, sodass der Anreise-Partner am oberen Fensterrand fehlte.
# Eine Abreise am letzten Fenstertag stand dann faelschlich auf „kein Wechsel".

class _FilterSammler:
    """Merkt sich die `lte`-Grenzen, die durch die Abfragekette laufen."""

    def __init__(self) -> None:
        self.grenzen: list[tuple[str, str]] = []

    def table(self, _name: str) -> "_FilterSammler":
        return self

    def select(self, *_a: object, **_k: object) -> "_FilterSammler":
        return self

    def eq(self, *_a: object) -> "_FilterSammler":
        return self

    def in_(self, *_a: object) -> "_FilterSammler":
        return self

    def gte(self, *_a: object) -> "_FilterSammler":
        return self

    def lte(self, feld: str, wert: str) -> "_FilterSammler":
        self.grenzen.append((feld, wert))
        return self

    def order(self, *_a: object, **_k: object) -> "_FilterSammler":
        return self

    def range(self, *_a: object) -> "_FilterSammler":
        return self

    def execute(self) -> object:
        class _Leer:
            data: list[dict] = []

        return _Leer()


def test_vorfilter_reicht_einen_tag_ueber_das_fenster() -> None:
    """Der Anreise-Partner am Fensterrand muss mitgeladen werden.

    Ohne den Zusatztag: Fenster „7 Tage" ab dem 05.09. endet am 12.09.; eine
    Abreise am 13.09., die dort auf eine Anreise trifft, faellt aus der Menge,
    und die im Fenster sichtbare Zeile meldet „kein Wechsel". Geprueft wird die
    FORM der Abfrage, nicht das Ergebnis — mit wenigen Testzeilen faellt eine
    zu enge Grenze nie auf.
    """
    from datetime import timedelta
    from unittest.mock import MagicMock

    from src.features.reservations.dashboard import DashboardMixin
    from src.features.reservations.schemas import DashboardFenster, DashboardListe

    sammler = _FilterSammler()

    class _Dienst(DashboardMixin):
        def __init__(self) -> None:
            self._client = MagicMock()

        def _db(self) -> _FilterSammler:
            return sammler

        def _require_tenant(self, _ctx: object) -> str:
            return "t-1"

        def _owner_scope_pids(self, _ctx: object) -> None:
            return None

    _Dienst().dashboard_liste(
        MagicMock(user_id="u-1"),
        DashboardListe.checkins,
        DashboardFenster.d7,
    )

    grenzen = [w for f, w in sammler.grenzen if f == "check_in"]
    assert grenzen, "keine check_in-Grenze beobachtet"
    fenster_ende = date.today() + timedelta(days=7)
    assert grenzen[0] == (fenster_ende + timedelta(days=1)).isoformat(), (
        "Der Vorfilter muss einen Tag ueber das Fenster hinausreichen, "
        "sonst fehlt der Wechselpartner am Rand."
    )
