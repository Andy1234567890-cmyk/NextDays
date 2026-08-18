"""Die `in_`-Filter des Dashboards muessen blockweise laufen.

Live passiert (18.08.2026): das Dashboard des Vorfuehr-Betriebs antwortete
`internal_error`. Ursache war HTTP 414 „URI too long" — die Uebernahme-Abfrage
packte alle offenen Reservierungs-IDs in EINEN `in_`-Filter, bei 242 Buchungen
also ueber 9.000 Zeichen Adresse. Kong deckelt bei 8 KB.

Geprueft wird deshalb nicht das Ergebnis, sondern die FORM der Abfrage: keine
`in_`-Liste ueberschreitet die Blockgroesse. Ein Test auf das Ergebnis waere
gruen geblieben — mit 8 Buchungen faellt die Laenge nie auf.
"""
from unittest.mock import MagicMock

from src.features.reservations.dashboard import _ID_CHUNK, DashboardMixin


class _Sammler:
    """Merkt sich jede `in_`-Liste, die durch die Kette laeuft."""

    def __init__(self) -> None:
        self.laengen: list[int] = []

    def table(self, _name: str) -> "_Sammler":
        return self

    def select(self, *_a: str, **_k: object) -> "_Sammler":
        return self

    def eq(self, *_a: object) -> "_Sammler":
        return self

    def neq(self, *_a: object) -> "_Sammler":
        return self

    def order(self, *_a: object, **_k: object) -> "_Sammler":
        return self

    def in_(self, _feld: str, werte: list) -> "_Sammler":
        self.laengen.append(len(werte))
        return self

    def execute(self) -> MagicMock:
        return MagicMock(data=[])


class _Dienst(DashboardMixin):
    """Nur der Mixin, mit dem Sammler als Datenbank."""

    def __init__(self, sammler: _Sammler) -> None:
        self._sammler = sammler

    def _db(self) -> _Sammler:
        return self._sammler


def _ids(anzahl: int) -> list[dict]:
    return [{"id": f"11111111-1111-1111-1111-{i:012d}"} for i in range(anzahl)]


def test_uebernahme_abfrage_ist_geblockt() -> None:
    """250 Buchungen ergaben ungeblockt HTTP 414 — jetzt Bloecke."""
    sammler = _Sammler()
    _Dienst(sammler)._dashboard_threads("t-1", _ids(250))
    assert sammler.laengen, "keine in_-Abfrage beobachtet"
    assert max(sammler.laengen) <= _ID_CHUNK


def test_zusatzleistungen_sind_geblockt() -> None:
    """Dieselbe Grenze, dieselbe Blockung — plus zwei weitere Filter."""
    sammler = _Sammler()
    _Dienst(sammler)._dashboard_addons([r["id"] for r in _ids(250)])
    assert sammler.laengen, "keine in_-Abfrage beobachtet"
    assert max(sammler.laengen) <= _ID_CHUNK


def test_blockgroesse_bleibt_unter_der_gemessenen_grenze() -> None:
    """Die Konstante selbst ist der Schutz.

    Gemessen: 200 UUIDs = 7.519 Zeichen (geht), 250 = 9.369 (414). Eine
    Erhoehung ueber 200 wuerde den Fehler zurueckholen, deshalb steht die
    Grenze hier als Zusicherung und nicht nur als Kommentar.
    """
    assert _ID_CHUNK <= 200
    assert _ID_CHUNK * 37 < 8000
