"""Storno-PARTEI und Grund-Kategorie (0410).

WARUM DIESE TESTS: Die Partei entscheidet ab Etappe 3, ob die 8 %-Provision
einer myBestDays-Buchung bei uns bleibt (Gast-Storno) oder zurückgebucht wird
(Storno des Betriebs). Sie ist damit ein GELD-Feld, das kein Nutzer je direkt
sieht — ein falsch gesetzter Wert fällt niemandem auf und verteilt trotzdem
echte Beträge um. Geprüft wird deshalb je Storno-Pfad, WELCHE Partei wirklich
in der Zeile landet, nicht nur dass der Aufruf durchläuft.

Der Gast-Pfad ist der eigentliche Anlass: dort stand vorher `cancelled_by =
NULL`, ununterscheidbar von „Auslöser unbekannt" (ein Portal-Gast ist keine
`public.users`-Zeile).
"""
from __future__ import annotations

import pytest

from src.core.security import AuthContext
from src.features.reservations._base import ReservationError
from src.features.reservations.schemas import CancelParty, CancelReasonCode
from src.features.reservations.storno_partei import partei_aus_rolle

from .test_reservations import RID, _move_db, _move_store

_CTX = AuthContext(user_id="u", tenant_id="t1", role="admin")


# --- Ableitung aus der Rolle -------------------------------------------------

@pytest.mark.parametrize(
    ("rolle", "erwartet"),
    [
        ("admin", CancelParty.betrieb),
        ("co_admin", CancelParty.betrieb),
        ("staff", CancelParty.betrieb),
        ("cleaner", CancelParty.betrieb),
        ("owner", CancelParty.eigentuemer),
    ],
)
def test_partei_aus_rolle(rolle: str, erwartet: CancelParty) -> None:
    assert partei_aus_rolle(rolle) is erwartet


@pytest.mark.parametrize("rolle", [None, "", "platform_admin", "gast"])
def test_partei_aus_unbekannter_rolle_ist_fail_closed(rolle: str | None) -> None:
    """WURZEL 5 — es gibt hier keine harmlose Annahme.

    „betrieb" verschenkt unsere Provision, „gast" nimmt sie dem Gast weg. Wer
    nicht zuordenbar ist, storniert nicht (403) — statt eines Ersatzwerts, der
    später Geld verschiebt.
    """
    with pytest.raises(ReservationError) as exc:
        partei_aus_rolle(rolle)
    assert exc.value.status_code == 403


# --- Was in der Zeile und in der Historie landet -----------------------------

def test_storno_schreibt_partei_und_grundcode() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    svc.cancel(
        _CTX, RID, "Wasserschaden im Bad",
        partei=CancelParty.betrieb,
        reason_code=CancelReasonCode.schaden_instandsetzung,
    )
    r = next(x for x in store["reservations"] if x["id"] == RID)
    assert r["cancelled_by_party"] == "betrieb"
    assert r["cancel_reason_code"] == "schaden_instandsetzung"
    # Der Freitext bleibt die Pflichtangabe — der Code tritt daneben, nicht an
    # seine Stelle.
    assert r["cancel_reason"] == "Wasserschaden im Bad"
    # Und dieselbe Zuordnung in der append-only Historie: `reservations` trägt
    # nur den LETZTEN Storno, das Log jeden einzelnen.
    log_zeile = store["reservation_cancellation_log"][0]
    assert log_zeile["cancelled_by_party"] == "betrieb"
    assert log_zeile["cancel_reason_code"] == "schaden_instandsetzung"


def test_storno_ohne_grundcode_laesst_die_spalte_leer() -> None:
    """WURZEL 4 — kein erfundener Ersatzcode.

    Nicht jeder Storno-Weg kennt eine Kategorie. Dann bleibt die Spalte `null`
    und die Auswertung sagt „nicht angegeben" — statt eines plausiblen
    „sonstiges", das wie eine Angabe des Nutzers aussieht.
    """
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    svc.cancel(_CTX, RID, "Ohne Kategorie", partei=CancelParty.betrieb)
    r = next(x for x in store["reservations"] if x["id"] == RID)
    assert r["cancel_reason_code"] is None
    assert store["reservation_cancellation_log"][0]["cancel_reason_code"] is None


def test_unbekannte_partei_scheitert_vor_dem_ersten_seiteneffekt() -> None:
    """WURZEL 5 — prüfen, BEVOR etwas passiert.

    Ein Aufrufer ohne Type-Checking (MCP-Werkzeug, Job) kann einen rohen String
    übergeben. Käme die Prüfung erst beim INSERT ins Log, wäre der Status
    bereits auf 'cancelled' gesetzt und die Nächte freigegeben — ein halb
    vollzogener Storno, der genau nicht auffällt.
    """
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.cancel(_CTX, RID, "Grund", partei="hausmeister")  # type: ignore[arg-type]
    assert exc.value.status_code == 500
    assert store["reservations"][0]["status"] == "confirmed"
    assert not store.get("reservation_cancellation_log")


def test_partei_ist_pflicht() -> None:
    """Kein Default am Service: der nächste neue Aufrufer MUSS sich entscheiden.

    Ein Default hieße, dass eine Geldentscheidung stillschweigend die bequemste
    Partei bekommt — dieselbe Lücke, die `cancelled_by` mit seinem NULL hatte.
    """
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(TypeError):
        svc.cancel(_CTX, RID, "Grund")  # type: ignore[call-arg]


def test_eigentuemer_partei_bei_owner_rolle() -> None:
    """Der Weg über die Rolle bis in die Zeile — nicht nur die Ableitung.

    Ein Eigentümer erreicht `cancel` heute nicht (kein MANAGE_CALENDAR); der
    Test hält fest, dass die Kette Rolle → Partei → Spalte trotzdem stimmt,
    falls er je Zugang bekommt (Eigennutzung).
    """
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    svc.cancel(
        _CTX, RID, "Eigennutzung geplant",
        partei=partei_aus_rolle("owner"),
        reason_code=CancelReasonCode.eigennutzung,
    )
    r = next(x for x in store["reservations"] if x["id"] == RID)
    assert r["cancelled_by_party"] == "eigentuemer"
