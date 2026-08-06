"""Etappenweises Lesen der Airbnb-Buchungshistorie.

WORAUF DIESE TESTS ZIELEN: Der Auftrag lautete „wir dürfen keine vergessen".
Alle drei Eigenheiten der Airbnb-API, die genau das gefährden, sind live
gemessen und hier festgenagelt — jede einzelne würde ohne Test unbemerkt
Buchungen verschlucken:

  1. `start_date` reicht nur 12 Monate weit → ein Aufruf holt NICHT alles
  2. `_limit` > 50 liefert 200 mit leerer Liste → „schneller" holt gar nichts
  3. `_offset` wird ignoriert → nur der Cursor blättert

Der teuerste Fehler wäre ein Lauf, der 26 von 27 Etappen schafft und sich
trotzdem „fertig" nennt. Dagegen `vollstaendig`.
"""
from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from src.features.channel_manager.airbnb_historie import (
    ETAPPEN_REICHWEITE_MONATE,
    ETAPPEN_SCHRITT_MONATE,
    MAX_SEITEN_JE_ETAPPE,
    SEITEN_GROESSE,
    AirbnbHistorieMixin,
    etappen_planen,
)
from src.features.channel_manager.common import ChannelManagerError

# --------------------------------------------------------------------------
# Etappen-Planung — hier entscheidet sich, ob etwas vergessen wird.
# --------------------------------------------------------------------------

def test_etappen_ueberlappen() -> None:
    """Schrittweite kleiner als Reichweite: sonst klaffen Lücken.

    Wären beide gleich (12/12), läge jede Buchung in genau einer Etappe — und
    ein Randfehler bei Airbnb (Buchung exakt am Übergang) hieße: weg.
    """
    assert ETAPPEN_SCHRITT_MONATE < ETAPPEN_REICHWEITE_MONATE
    plan = etappen_planen(date(2020, 1, 1), date(2026, 8, 6))
    for (start_a, ende_a), (start_b, _) in zip(plan, plan[1:], strict=False):
        assert start_b < ende_a, "Lücke zwischen zwei Etappen"
        assert start_b > start_a


def test_jede_buchung_liegt_in_mehreren_etappen() -> None:
    """Vierfache Abdeckung — der eigentliche Schutz gegen Vergessen."""
    plan = etappen_planen(date(2020, 1, 1), date(2026, 8, 6))
    stichtag = date(2024, 6, 15)
    treffer = [1 for start, ende in plan if start <= stichtag < ende]
    assert len(treffer) >= 3, "Ein Datum muss in mehreren Etappen liegen"


def test_zeitraum_2020_bis_heute_ergibt_27_etappen() -> None:
    """Der live gefahrene Lauf (Nutzer-Beispiel „01.01.2020 bis heute").

    Festgenagelt, weil die Zahl im Dialog steht: ändert jemand die Schrittweite,
    stimmt die Ansage „27 Etappen" nicht mehr mit der Wirklichkeit überein.
    """
    assert len(etappen_planen(date(2020, 1, 1), date(2026, 8, 6))) == 27


def test_kurzer_zeitraum_ergibt_eine_etappe() -> None:
    """Ein paar Tage brauchen keine Kette — aber mindestens eine Etappe."""
    assert len(etappen_planen(date(2026, 3, 15), date(2026, 3, 20))) == 1


def test_ende_vor_start_ist_fehler() -> None:
    """Vertauschte Eingabe zeigen, nicht stillschweigend umdeuten."""
    with pytest.raises(ChannelManagerError) as exc:
        etappen_planen(date(2026, 1, 1), date(2020, 1, 1))
    assert exc.value.status_code == 422


def test_absurder_zeitraum_wird_abgewiesen() -> None:
    """Wurzel 8: jeder unbegrenzte Bereich bekommt eine harte Obergrenze."""
    with pytest.raises(ChannelManagerError) as exc:
        etappen_planen(date(1900, 1, 1), date(2026, 1, 1))
    assert exc.value.status_code == 422


def test_seitengroesse_bleibt_50() -> None:
    """Live gemessen: `_limit=100` → 200 mit LEERER Liste, `_limit=50` → 50.

    Wer diese Konstante „optimiert", bekommt einen Import, der schweigend
    nichts findet. Deshalb steht sie hier fest.
    """
    assert SEITEN_GROESSE == 50


# --------------------------------------------------------------------------
# Lesen — Cursor, Filterung, Fehlerbehandlung.
# --------------------------------------------------------------------------

def _res(code: str, listing: str, start: str = "2024-05-01") -> dict[str, Any]:
    return {
        "confirmation_code": code,
        "listing_id": listing,
        "start_date": start,
        "end_date": "2024-05-05",
        "thread_id": f"t-{code}",
    }


class _Airbnb(AirbnbHistorieMixin):
    """Attrappe, die Airbnbs Cursor-Verhalten nachbildet."""

    def __init__(self, seiten: dict[str, list[list[dict[str, Any]]]]) -> None:
        # {start_date: [seite1, seite2, ...]}
        self._seiten = seiten
        self.aufrufe: list[tuple[str, str | None]] = []

    def _reservierungen_seite(
        self, token: str, start_date: str, cursor: str | None
    ) -> tuple[list[dict[str, Any]], str | None]:
        _ = token
        self.aufrufe.append((start_date, cursor))
        seiten = self._seiten.get(start_date, [])
        index = int(cursor) if cursor else 0
        if index >= len(seiten):
            return [], None
        weiter = str(index + 1) if index + 1 < len(seiten) else None
        return seiten[index], weiter


def test_nur_das_eigene_listing_kommt_mit() -> None:
    """DIE Kernprüfung für den Objekt-Import.

    Der Airbnb-Kanal trägt alle Objekte des Kontos (live 462 Buchungen über 41
    Inserate). Ein Objekt-Import, der fremde mitnimmt, schriebe Buchungen an
    das falsche Haus — Belegung und Umsatz wären danach falsch.
    """
    dienst = _Airbnb({
        "2024-01-01": [[_res("A", "L1"), _res("B", "L2"), _res("C", "L1")]],
    })
    erg = dienst.airbnb_historie_lesen(
        "tok", "L1", von=date(2024, 1, 1), bis=date(2024, 2, 1)
    )
    assert {b["confirmation_code"] for b in erg.buchungen} == {"A", "C"}
    assert erg.fremde == 1, "Fremde werden gezählt, nicht verschwiegen"


def test_ueberlappung_erzeugt_keine_dubletten() -> None:
    """Dieselbe Buchung kommt durch die Überlappung mehrfach — gespeichert
    wird sie einmal (Wurzel 2: real kommt alles doppelt)."""
    doppelt = [[_res("A", "L1")]]
    dienst = _Airbnb({
        "2024-01-01": doppelt, "2024-04-01": doppelt,
        "2024-07-01": doppelt, "2024-10-01": doppelt,
    })
    erg = dienst.airbnb_historie_lesen(
        "tok", "L1", von=date(2024, 1, 1), bis=date(2024, 12, 1)
    )
    assert len(erg.buchungen) == 1
    # In der ersten Etappe neu, danach nur noch „gefunden" — genau das zeigt
    # der Fortschritt im Dialog.
    assert erg.etappen[0].neu == 1
    assert sum(e.neu for e in erg.etappen) == 1
    assert sum(e.gefunden for e in erg.etappen) == 4


def test_cursor_blaettert_bis_zum_ende() -> None:
    """Ohne Cursor-Schleife blieben Buchungen ab Nr. 51 liegen."""
    dienst = _Airbnb({
        "2024-01-01": [[_res("A", "L1")], [_res("B", "L1")], [_res("C", "L1")]],
    })
    erg = dienst.airbnb_historie_lesen(
        "tok", "L1", von=date(2024, 1, 1), bis=date(2024, 1, 15)
    )
    assert len(erg.buchungen) == 3
    assert erg.etappen[0].seiten == 3


def test_eine_kaputte_etappe_stoppt_den_lauf_nicht() -> None:
    """Die übrigen Etappen laufen weiter — aber der Lauf ist NICHT vollständig.

    Der teuerste denkbare Fehler wäre „fertig" zu melden, obwohl eine Etappe
    ausgefallen ist: dann fehlen Buchungen, und niemand weiß es (Wurzel 5).
    """
    class _Wackelig(_Airbnb):
        def _reservierungen_seite(
            self, token: str, start_date: str, cursor: str | None
        ) -> tuple[list[dict[str, Any]], str | None]:
            if start_date == "2024-04-01":
                raise ChannelManagerError("Airbnb antwortete 503.", status_code=502)
            return super()._reservierungen_seite(token, start_date, cursor)

    dienst = _Wackelig({
        "2024-01-01": [[_res("A", "L1")]],
        "2024-07-01": [[_res("B", "L1")]],
    })
    erg = dienst.airbnb_historie_lesen(
        "tok", "L1", von=date(2024, 1, 1), bis=date(2024, 8, 1)
    )
    assert len(erg.buchungen) == 2, "Die intakten Etappen liefern weiter"
    assert erg.vollstaendig is False
    assert len(erg.fehlgeschlagene) == 1
    assert "503" in (erg.fehlgeschlagene[0].fehler or "")


def test_vollstaendig_nur_wenn_alles_lief() -> None:
    """Der Normalfall: keine Etappe gescheitert → vollständig."""
    dienst = _Airbnb({"2024-01-01": [[_res("A", "L1")]]})
    erg = dienst.airbnb_historie_lesen(
        "tok", "L1", von=date(2024, 1, 1), bis=date(2024, 1, 15)
    )
    assert erg.vollstaendig is True


def test_endlose_seiten_werden_gedeckelt_und_gemeldet() -> None:
    """Wurzel 8 verlangt die Grenze, Wurzel 5 verlangt, sie zu benennen.

    Ein stilles Abschneiden bei Seite 60 sähe aus wie „mehr gab es nicht".
    """
    class _Endlos(_Airbnb):
        def _reservierungen_seite(
            self, token: str, start_date: str, cursor: str | None
        ) -> tuple[list[dict[str, Any]], str | None]:
            _ = (token, start_date)
            nr = int(cursor) if cursor else 0
            return [_res(f"C{nr}", "L1")], str(nr + 1)

    erg = _Endlos({}).airbnb_historie_lesen(
        "tok", "L1", von=date(2024, 1, 1), bis=date(2024, 1, 15)
    )
    assert erg.etappen[0].seiten == MAX_SEITEN_JE_ETAPPE
    assert erg.vollstaendig is False
    assert "Zeitraum" in (erg.etappen[0].fehler or "")


def test_fortschritt_wird_je_etappe_gemeldet() -> None:
    """Ohne diese Meldung säße der Betrieb 27 Etappen lang vor einem toten
    Knopf. Der Rückruf trägt die Zahlen, die das Popup anzeigt."""
    dienst = _Airbnb({"2024-01-01": [[_res("A", "L1")]]})
    gesehen: list[tuple[int, int]] = []
    dienst.airbnb_historie_lesen(
        "tok", "L1", von=date(2024, 1, 1), bis=date(2024, 6, 1),
        melden=lambda e: gesehen.append((e.nummer, e.neu)),
    )
    assert gesehen[0] == (1, 1)
    assert len(gesehen) == len(
        etappen_planen(date(2024, 1, 1), date(2024, 6, 1))
    )
