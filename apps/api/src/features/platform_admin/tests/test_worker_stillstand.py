"""Der Monitor muss zeigen, was AUSBLEIBT — nicht nur, was schiefging.

DER LIVE-BEFUND (13.08.2026): Der Worker erreichte Redis nicht (zwei Container
trugen im Docker-Netz denselben Alias `redis`, einer davon Coolifys eigener mit
anderem Passwort). Ohne Redis gab das Channex-Budget kein Token, also verzögerte
sich JEDER Job — und Verzögern ist ein GEPLANTER Ausgang, kein Fehler.

Ergebnis: 16 Stunden lang ging kein einziger Aufruf an die Portale raus, und der
Worker-Monitor meldete „1000 Vorgänge · 0 Fehler". Beide Zahlen stimmten. Real
blieb ein Booking-Storno 16 h liegen; bei einer NEUEN Buchung wäre daraus eine
Doppelbelegung geworden.

Diese Tests halten fest, dass ein solcher Stillstand als Befund erscheint.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from src.features.platform_admin import worker_stillstand
from src.features.platform_admin.worker_stillstand import (
    KERN_JOBS,
    TOLERANZ_FAKTOR,
)


class _Result:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Query:
    """Nur die Kette, die `stillstand()` wirklich nutzt."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows
        self._filter: list[tuple[str, Any]] = []

    def select(self, *_a: object, **_k: object) -> "_Query":
        return self

    def eq(self, spalte: str, wert: object) -> "_Query":
        self._filter.append((spalte, wert))
        return self

    def in_(self, spalte: str, werte: list) -> "_Query":
        self._filter.append((spalte, set(map(str, werte))))
        return self

    def gte(self, *_a: object) -> "_Query":
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        # `stillstand()` verlässt sich auf absteigende Sortierung.
        self._rows = sorted(
            self._rows, key=lambda r: str(r.get("erfasst_at")), reverse=True
        )
        return self

    def execute(self) -> _Result:
        passend = []
        for r in self._rows:
            ok = True
            for spalte, wert in self._filter:
                if isinstance(wert, set):
                    ok = ok and str(r.get(spalte)) in wert
                else:
                    ok = ok and str(r.get(spalte)) == str(wert)
            if ok:
                passend.append(r)
        return _Result(passend)


class _DB:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def table(self, _name: str) -> _Query:
        return _Query(self._rows)


def _lauf(vorgang: str, vor_sekunden: int, ergebnis: str = "ok") -> dict[str, Any]:
    zeit = datetime.now(UTC) - timedelta(seconds=vor_sekunden)
    return {
        "richtung": "job",
        "vorgang": vorgang,
        "ergebnis": ergebnis,
        "erfasst_at": zeit.isoformat(),
    }


def _alle_frisch() -> list[dict[str, Any]]:
    return [_lauf(v, 60) for v in KERN_JOBS]


# --------------------------------------------------------------------------
# Der Normalfall: alles läuft → kein Befund
# --------------------------------------------------------------------------


def test_alles_frisch_ergibt_keinen_befund() -> None:
    assert worker_stillstand.stillstand(_DB(_alle_frisch())) == []


def test_knapp_ueberfaellig_ist_noch_kein_alarm() -> None:
    """Ein einzelner verzögerter Lauf (Backoff, Deploy) darf nicht sofort
    Alarm auslösen — sonst schaut nach einer Woche niemand mehr hin."""
    rows = _alle_frisch()
    intervall = KERN_JOBS["sync_bookings_feed"][0]
    rows = [r for r in rows if r["vorgang"] != "sync_bookings_feed"]
    rows.append(_lauf("sync_bookings_feed", intervall * TOLERANZ_FAKTOR - 30))
    assert worker_stillstand.stillstand(_DB(rows)) == []


# --------------------------------------------------------------------------
# Der reale Ausfall: Jobs laufen, aber ohne Erfolg
# --------------------------------------------------------------------------


def test_stillstand_des_buchungsfeeds_wird_gemeldet() -> None:
    """Der 16-Stunden-Fall vom 13.08.2026."""
    rows = [r for r in _alle_frisch() if r["vorgang"] != "sync_bookings_feed"]
    rows.append(_lauf("sync_bookings_feed", 16 * 3600))
    befunde = worker_stillstand.stillstand(_DB(rows))
    assert [b.vorgang for b in befunde] == ["sync_bookings_feed"]
    b = befunde[0]
    assert b.ueberfaellig is True
    assert b.still_seit_sekunden is not None and b.still_seit_sekunden > 15 * 3600
    # Klartext statt Job-Name: wer das liest, muss nicht den Code kennen.
    assert "Storno" in b.beschreibung or "Buchungen" in b.beschreibung


def test_verzoegerte_laeufe_zaehlen_nicht_als_erfolg() -> None:
    """DER KERN DES BEFUNDS: Der Job lief alle 5 Minuten und meldete brav
    „aufschub" — genau deshalb stand die Fehlerzahl auf 0. Nur ein `ok` zählt.
    """
    rows = [r for r in _alle_frisch() if r["vorgang"] != "sync_bookings_feed"]
    # Sein letzter ECHTER Erfolg ist Stunden her …
    rows.append(_lauf("sync_bookings_feed", 16 * 3600))
    # … seither nur Verzögerungen, im Minutentakt, alle „ohne Fehler".
    rows += [
        _lauf("sync_bookings_feed", m * 300, ergebnis="aufschub")
        for m in range(1, 12)
    ]
    befunde = worker_stillstand.stillstand(_DB(rows))
    assert [b.vorgang for b in befunde] == ["sync_bookings_feed"]


def test_ohne_jeden_lauf_wird_gemeldet_ohne_erfundene_dauer() -> None:
    """Kein Lauf im Fenster → Befund, aber `zuletzt=None`.

    Eine Dauer zu erfinden („seit 0 min still") wäre hier die gefährlichste
    Aussage — sie sähe harmlos aus (Wurzel 4).
    """
    befunde = worker_stillstand.stillstand(_DB([]))
    assert {b.vorgang for b in befunde} == set(KERN_JOBS)
    for b in befunde:
        assert b.zuletzt is None
        assert b.still_seit_sekunden is None
        assert b.ueberfaellig is True


def test_mehrere_stillstaende_laengster_zuerst() -> None:
    rows = [
        _lauf("process_ari_outbox", 2 * 3600),
        _lauf("sync_bookings_feed", 9 * 3600),
        _lauf("process_restriction_outbox", 60),
        _lauf("sync_live_feed", 60),
    ]
    befunde = worker_stillstand.stillstand(_DB(rows))
    assert [b.vorgang for b in befunde] == [
        "sync_bookings_feed",
        "process_ari_outbox",
    ]


def test_fremde_richtung_zaehlt_nicht_als_job_erfolg() -> None:
    """Ein Portal-Aufruf (`richtung='gesendet'`) ist kein Job-Lauf. Sonst
    hielte ein beliebiger Channex-Call den Buchungs-Feed für gesund."""
    rows = [r for r in _alle_frisch() if r["vorgang"] != "sync_bookings_feed"]
    rows.append(_lauf("sync_bookings_feed", 16 * 3600))
    fremd = _lauf("sync_bookings_feed", 30)
    fremd["richtung"] = "gesendet"
    rows.append(fremd)
    assert [b.vorgang for b in worker_stillstand.stillstand(_DB(rows))] == [
        "sync_bookings_feed"
    ]


# --------------------------------------------------------------------------
# Der Wächter: Erwartungswerte müssen zum Worker passen
# --------------------------------------------------------------------------


def test_stillstand_intervalle_passen_zum_worker() -> None:
    """Die Tick-Intervalle stehen doppelt (hier und in `worker.py`).

    Das ist Absicht — der Monitor soll `worker.py` nicht importieren müssen,
    das den halben Channel-Manager mitzieht. Eine Kopie, die auseinanderläuft,
    wäre allerdings schlimmer als keine: Der Monitor meldete dann Stillstand,
    wo keiner ist, oder — schlimmer — schwiege bei echtem. Also wird die Quelle
    textuell gegengelesen.
    """
    import re
    from pathlib import Path

    quelle = (
        Path(__file__).resolve().parents[3] / "worker.py"
    ).read_text(encoding="utf-8")

    def sekunden(name: str) -> int:
        treffer = re.search(rf"^{name} = (.+?)(?:\s+#.*)?$", quelle, re.M)
        assert treffer, f"{name} nicht in worker.py gefunden"
        return int(eval(treffer.group(1)))  # noqa: S307 — feste Zahlenausdrücke

    erwartet = {
        "sync_bookings_feed": sekunden("BOOKINGS_TICK_SECONDS"),
        "sync_live_feed": sekunden("LIVE_FEED_TICK_SECONDS"),
        "process_ari_outbox": sekunden("OUTBOX_TICK_SECONDS"),
        "process_restriction_outbox": sekunden("OUTBOX_TICK_SECONDS"),
    }
    tatsaechlich = {job: intervall for job, (intervall, _) in KERN_JOBS.items()}
    assert tatsaechlich == erwartet
