"""Stop-Sell muss die VERFÜGBARKEIT zumachen, nicht nur die Restriction.

DER VORFALL (15.08.2026, „Feriehus Rævehulen"): Ein Stop-Sell für den
15.–21.08. stand seit dem 10.08. korrekt bei Channex — auf Rate-Plan-Ebene.
Der Availability-Push meldete für denselben Zeitraum aber unverändert
`availability: 1`, weil `freie_einheiten_spannen` nur den Kalender
(`availability`-Status) las und die Tabelle `stop_sell` nicht kannte.
Booking.com hört auf den BESTAND: am 14.08. kam eine Buchung über 17.–27.08.
herein, mitten im gesperrten Zeitraum.

Die Verrechnung existierte damals schon, aber ausschließlich im Lesepfad der
Oberfläche (`calendar.service._spannen_ohne_stop_sell`) — die drei ARI-Push-
Pfade riefen die rohe Funktion. Deshalb prüfen diese Tests die KERNFUNKTION:
sie ist die eine Stelle, durch die alle Push-Pfade laufen.

Jeder Test hier bricht, wenn die Änderung zurückgenommen wird.
"""
from datetime import date, timedelta

from src.core.einheiten_verfuegbar import freie_einheiten_spannen


class _Query:
    """Minimaler PostgREST-Stub für die zwei Tabellen, die der Helfer liest."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self._eq: dict = {}
        self._is_null: list[str] = []
        self._gte: str | None = None
        self._lte: str | None = None

    def select(self, *_a, **_k) -> "_Query":
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._eq[col] = val
        return self

    def is_(self, col: str, val: str) -> "_Query":
        if val == "null":
            self._is_null.append(col)
        return self

    def gte(self, _col: str, val: str) -> "_Query":
        self._gte = val
        return self

    def lte(self, _col: str, val: str) -> "_Query":
        self._lte = val
        return self

    def order(self, *_a, **_k) -> "_Query":
        return self

    def execute(self) -> "_Query":
        return self

    @property
    def data(self) -> list[dict]:
        out = []
        for r in self._rows:
            if any(r.get(c) != v for c, v in self._eq.items()):
                continue
            if any(r.get(c) is not None for c in self._is_null):
                continue
            tag = str(r.get("date", ""))
            if self._gte is not None and tag and tag < self._gte:
                continue
            if self._lte is not None and tag and tag > self._lte:
                continue
            out.append(r)
        return out


class _Db:
    def __init__(self, store: dict[str, list[dict]]) -> None:
        self._store = store

    def table(self, name: str) -> _Query:
        return _Query(self._store.get(name, []))


def _store(*, einheiten: int = 1, gebucht: list[str] | None = None,
           gestoppt: list[str] | None = None,
           stop_rate_plan: list[str] | None = None) -> dict:
    return {
        "property_units": [
            {"id": f"u{i}", "property_id": "p1", "tenant_id": "t1", "position": i}
            for i in range(1, einheiten + 1)
        ],
        "availability": [
            {"property_id": "p1", "unit_id": "u1", "date": tag,
             "status": "booked", "source": "booking"}
            for tag in (gebucht or [])
        ],
        "stop_sell": [
            {"property_id": "p1", "date": tag, "rate_plan_id": None,
             "source": "manual"}
            for tag in (gestoppt or [])
        ] + [
            {"property_id": "p1", "date": tag, "rate_plan_id": "rp-1",
             "source": "manual"}
            for tag in (stop_rate_plan or [])
        ],
    }


def _frei_je_tag(db: _Db, von: str, bis: str) -> dict[str, int]:
    """Spannen auf Tage auflösen — so liest sich die Erwartung als Tabelle."""
    out: dict[str, int] = {}
    for v, b, frei in freie_einheiten_spannen(
        db, "t1", "p1", date.fromisoformat(von), date.fromisoformat(bis)
    ):
        tag = v
        while tag <= b:
            out[tag.isoformat()] = frei
            tag += timedelta(days=1)
    return out


def test_stop_sell_macht_den_tag_unverkaeuflich() -> None:
    """DER Regressionstest: gestoppter Tag → 0 freie Einheiten.

    Vor dem Fix stand hier 1, und genau diese 1 ging an Booking.com.
    """
    db = _Db(_store(gestoppt=["2026-08-15", "2026-08-16"]))
    frei = _frei_je_tag(db, "2026-08-14", "2026-08-17")
    assert frei["2026-08-15"] == 0, "gestoppter Tag muss 0 melden"
    assert frei["2026-08-16"] == 0, "gestoppter Tag muss 0 melden"
    # Die Nachbartage bleiben unberührt — ein Stopp ist tagesgenau.
    assert frei["2026-08-14"] == 1
    assert frei["2026-08-17"] == 1


def test_stop_sell_schliesst_auch_mehrere_einheiten() -> None:
    """Bei n > 1 nimmt ein objektweiter Stopp den GANZEN Typ aus dem Verkauf.

    Sonst meldete ein Dreier-Typ am gestoppten Tag weiter 3 verkäufliche
    Einheiten — der Stopp wäre für die Portale unsichtbar.
    """
    db = _Db(_store(einheiten=3, gestoppt=["2026-08-15"]))
    frei = _frei_je_tag(db, "2026-08-14", "2026-08-16")
    assert frei["2026-08-15"] == 0
    assert frei["2026-08-14"] == 3


def test_plan_genauer_stopp_schliesst_den_typ_nicht() -> None:
    """Ein Stopp an EINEM Rate-Plan (rate_plan_id gesetzt) senkt den Bestand NICHT.

    Der Einheiten-Typ bleibt über die übrigen Pläne verkäuflich; dieser Stopp
    wirkt allein über die stop_sell-Restriction. Würde er den Bestand auf 0
    ziehen, nähme das Stoppen einer einzelnen Rate das ganze Objekt vom Markt.
    """
    db = _Db(_store(einheiten=2, stop_rate_plan=["2026-08-15"]))
    frei = _frei_je_tag(db, "2026-08-15", "2026-08-15")
    assert frei["2026-08-15"] == 2


def test_stop_sell_und_buchung_zusammen_bleiben_null() -> None:
    """Stopp auf einem ohnehin gebuchten Tag → weiterhin 0, nie negativ."""
    db = _Db(_store(gebucht=["2026-08-15"], gestoppt=["2026-08-15"]))
    frei = _frei_je_tag(db, "2026-08-15", "2026-08-15")
    assert frei["2026-08-15"] == 0


# ── Je Regel ein Test ────────────────────────────────────────────────────────
# Sechs Regeln machen eine Nacht unverkäuflich (Tabelle im Modul-Docstring von
# `core.einheiten_verfuegbar`). Fünf davon schreiben Kalenderzeilen, eine lebt
# in einer eigenen Tabelle. JEDE bekommt hier ihren eigenen Test: nur so fällt
# auf, wenn eine künftig an der Stückzahl vorbeiläuft — genau der Fehler, der
# den Stop-Sell monatelang wirkungslos machte.


def _kalendertag(status: str, source: str) -> dict:
    return {
        "property_units": [
            {"id": "u1", "property_id": "p1", "tenant_id": "t1", "position": 1}
        ],
        "availability": [
            {"property_id": "p1", "unit_id": "u1", "date": "2026-08-15",
             "status": status, "source": source}
        ],
        "stop_sell": [],
    }


def test_regel_buchung_macht_unverkaeuflich() -> None:
    """Regel 1 — Buchung (`status='booked'`)."""
    frei = _frei_je_tag(_Db(_kalendertag("booked", "booking")),
                        "2026-08-15", "2026-08-15")
    assert frei["2026-08-15"] == 0


def test_regel_handsperre_macht_unverkaeuflich() -> None:
    """Regel 2 — manuelle Sperre (`status='blocked'`)."""
    frei = _frei_je_tag(_Db(_kalendertag("blocked", "manual")),
                        "2026-08-15", "2026-08-15")
    assert frei["2026-08-15"] == 0


def test_regel_vertragsende_macht_unverkaeuflich() -> None:
    """Regel 3 — Vertragsende (0355) sperrt die Folgezeit.

    Es schreibt `blocked`-Nächte mit `source='contract_end'`; ab dem Enddatum
    darf nirgends mehr verkauft werden. Der Test hält fest, dass die Sperre
    auch an der STÜCKZAHL ankommt und nicht nur im Kalender steht.
    """
    frei = _frei_je_tag(_Db(_kalendertag("blocked", "contract_end")),
                        "2026-08-15", "2026-08-15")
    assert frei["2026-08-15"] == 0


def test_regel_sperrantrag_macht_unverkaeuflich() -> None:
    """Regel 4 — genehmigter Sperrantrag (schreibt `blocked`)."""
    frei = _frei_je_tag(_Db(_kalendertag("blocked", "manual")),
                        "2026-08-15", "2026-08-15")
    assert frei["2026-08-15"] == 0


def test_regel_ical_fremdbelegung_macht_unverkaeuflich() -> None:
    """Regel 5 — iCal-Fremdbelegung (`status='booked'`, `source='ical'`)."""
    frei = _frei_je_tag(_Db(_kalendertag("booked", "ical")),
                        "2026-08-15", "2026-08-15")
    assert frei["2026-08-15"] == 0


def test_freier_tag_bleibt_verkaeuflich() -> None:
    """Gegenprobe: ohne Regel bleibt der Tag verkäuflich.

    Ohne diesen Test würde eine Funktion, die stumpf immer 0 liefert, alle
    Tests oben bestehen — und das Objekt wäre überall unverkäuflich.
    """
    frei = _frei_je_tag(_Db(_kalendertag("open", "manual")),
                        "2026-08-15", "2026-08-15")
    assert frei["2026-08-15"] == 1
