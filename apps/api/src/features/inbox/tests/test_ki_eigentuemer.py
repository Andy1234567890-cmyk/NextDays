"""Tests des KI-Antwortvorschlags für den Eigentümer-Chat (0611, `eig:`).

Der Anlass war ein Fehler, den kein Test sehen konnte: Der KI-Knopf in der
PMS-App endete auf einem Eigentümer-Thread in „Kein Vorschlag — Konversation
nicht gefunden", weil `ai_reply` über `_load_thread` lud und ein `eig:`-Thread
keine Zeile in `channex_booking` hat.

Zwei Klassen von Fehlern sind hier teuer, und beide sehen im Betrieb harmlos
aus:

* **Zu wenig** — der Zweig greift nicht, und der Knopf wirft weiter 404. Das
  prüft `test_ai_reply_nimmt_den_eigentuemer_zweig`: Es fasst den Buchungspfad
  nicht an, also fällt ein Rückfall dorthin sofort auf.
* **Zu viel** — Beträge oder Gastnamen landen im Prompt. Der Knopf steht im
  Posteingang, den auch ein Mitarbeiter ohne Finanzeinblick bedient (§4.3);
  über die KI dürfen ihn keine Zahlen erreichen, die ihm die Oberfläche
  verwehrt.
"""

from __future__ import annotations

from datetime import date

import pytest

from src.features.inbox.eigentuemer import objekt_zu_thread
from src.features.inbox.errors import InboxError
from src.features.inbox.ki_eigentuemer import (
    VORSCHAU_TAGE,
    _system_prompt,
    kontext_bauen,
)

OBJEKT_ID = "11111111-1111-1111-1111-111111111111"
THREAD_ID = "eig:22222222-2222-2222-2222-222222222222"
MANDANT = "33333333-3333-3333-3333-333333333333"


class _Res:
    def __init__(self, data: list, count: int | None = None) -> None:
        self.data = data
        self.count = count


class _Query:
    """Kettbare Abfrage wie PostgREST — merkt sich, WONACH gefiltert wurde.

    Die Filter werden mitgeschrieben, weil die Mandantentrennung sonst
    ungeprüft bliebe: Ein Double, das `eq` verschluckt, liefert dieselben
    Zeilen, ob `tenant_id` an der Abfrage steht oder nicht (Wurzel 3).
    """

    def __init__(self, rows: list, protokoll: list[tuple[str, object]]) -> None:
        self._rows = rows
        self._protokoll = protokoll
        self._count = False

    def select(self, *_a, **kwargs) -> _Query:
        self._count = kwargs.get("count") == "exact"
        return self

    def eq(self, feld: str, wert: object) -> _Query:
        self._protokoll.append((feld, wert))
        return self

    def neq(self, *_a, **_k) -> _Query:
        return self

    def in_(self, *_a, **_k) -> _Query:
        return self

    def gte(self, *_a, **_k) -> _Query:
        return self

    def lte(self, *_a, **_k) -> _Query:
        return self

    def order(self, *_a, **_k) -> _Query:
        return self

    def limit(self, *_a, **_k) -> _Query:
        return self

    def execute(self) -> _Res:
        return _Res(self._rows, len(self._rows) if self._count else None)


class _FakeDb:
    """Nur so viel DB, wie der Eigentümer-Kontext anfasst."""

    def __init__(self, **tabellen: list) -> None:
        self._tabellen: dict[str, list] = {
            "properties": [
                {
                    "id": OBJEKT_ID,
                    "title": "FeWo Stjerneskud",
                    "address": "Strandvejen 4, Hirtshals",
                    "status": "active",
                }
            ],
            "property_units": [{"id": "u1"}],
            "owner_properties": [{"owner_id": "o1"}],
            "owners": [{"id": "o1", "name": "Torsten Ågaard"}],
            "tasks": [],
            "reservations": [],
            "owner_threads": [{"property_id": OBJEKT_ID}],
        }
        self._tabellen.update(tabellen)
        self.gefragt: list[str] = []
        self.filter: list[tuple[str, object]] = []

    def table(self, name: str) -> _Query:
        self.gefragt.append(name)
        return _Query(self._tabellen.get(name, []), self.filter)


# --- Thread → Objekt --------------------------------------------------------
def test_objekt_zu_thread_liefert_die_objekt_id() -> None:
    db = _FakeDb()
    assert objekt_zu_thread(db, MANDANT, THREAD_ID) == OBJEKT_ID
    # Load und Scope gehören zusammen: der Mandant steht AN der Abfrage.
    assert ("tenant_id", MANDANT) in db.filter


def test_objekt_zu_thread_ist_404_wenn_es_den_thread_nicht_gibt() -> None:
    db = _FakeDb(owner_threads=[])
    with pytest.raises(InboxError) as fehler:
        objekt_zu_thread(db, MANDANT, THREAD_ID)
    assert fehler.value.status_code == 404


def test_objekt_zu_thread_ist_404_statt_leerem_objektbezug() -> None:
    """Eine Zeile ohne `property_id` gilt als nicht gefunden.

    Sie durchzulassen hieße, den Kontext auf einem leeren String zu bauen —
    das Modell bekäme die Daten irgendeines oder keines Objekts (Wurzel 4).
    """
    db = _FakeDb(owner_threads=[{"property_id": None}])
    with pytest.raises(InboxError) as fehler:
        objekt_zu_thread(db, MANDANT, THREAD_ID)
    assert fehler.value.status_code == 404


# --- Kontext ----------------------------------------------------------------
def test_kontext_nennt_objekt_eigentuemer_und_einheiten() -> None:
    db = _FakeDb(property_units=[{"id": "u1"}, {"id": "u2"}])
    kontext = kontext_bauen(db, MANDANT, OBJEKT_ID, heute=date(2026, 9, 15))
    text = kontext.text
    assert "FeWo Stjerneskud" in text
    assert "Strandvejen 4" in text
    assert "Torsten Ågaard" in text
    # Ein Objekt ist EIN Typ mit n Einheiten — „ausgebucht" heißt bei zwei
    # Studios etwas anderes als bei einem.
    assert "Einheiten: 2" in text


def test_kontext_nennt_alle_miteigentuemer() -> None:
    """`owner_properties` ist n:m (0601) — alle lesen denselben Verlauf."""
    db = _FakeDb(
        owner_properties=[{"owner_id": "o1"}, {"owner_id": "o2"}],
        owners=[{"id": "o1", "name": "Torsten Ågaard"}, {"id": "o2", "name": "Mette Ågaard"}],
    )
    kontext = kontext_bauen(db, MANDANT, OBJEKT_ID, heute=date(2026, 9, 15))
    assert "Torsten Ågaard" in kontext.text
    assert "Mette Ågaard" in kontext.text
    assert "Miteigentum" in kontext.text


def test_kontext_fuehrt_offene_aufgaben_mit_faelligkeit() -> None:
    db = _FakeDb(
        tasks=[{"title": "Wasserschaden Bad", "status": "open", "due_at": "2026-09-20T08:00:00Z"}]
    )
    kontext = kontext_bauen(db, MANDANT, OBJEKT_ID, heute=date(2026, 9, 15))
    assert "Wasserschaden Bad" in kontext.text
    assert "2026-09-20" in kontext.text


def test_kontext_meldet_belegung_als_zeitraum_ohne_gastnamen() -> None:
    """Wer dort wohnt, geht den Eigentümer als Zahl an, nicht als Name."""
    db = _FakeDb(
        reservations=[
            {"check_in": "2026-09-20", "check_out": "2026-09-27", "status": "confirmed"}
        ]
    )
    kontext = kontext_bauen(db, MANDANT, OBJEKT_ID, heute=date(2026, 9, 15))
    assert "2026-09-20 bis 2026-09-27" in kontext.text
    assert "1 Anreisen" in kontext.text


def test_kontext_sagt_leere_belegung_ausdruecklich() -> None:
    """Kein Block wäre eine Lücke, die wie ein Fehler aussieht (Wurzel 5)."""
    kontext = kontext_bauen(_FakeDb(), MANDANT, OBJEKT_ID, heute=date(2026, 9, 15))
    assert f"Keine Anreisen in den nächsten {VORSCHAU_TAGE} Tagen" in kontext.text
    assert "Keine offenen Aufgaben" in kontext.text


def test_kontext_traegt_keine_finanzdaten_und_sagt_das() -> None:
    """§4.3: Der Knopf darf kein Auskunftsloch um die Rollentrennung sein.

    Die Weglassung steht ausdrücklich in `weggelassen` — sonst sähe eine
    Antwort ohne Zahl wie ein Modellfehler aus, statt wie die Regel, die sie
    ist.
    """
    db = _FakeDb()
    kontext = kontext_bauen(db, MANDANT, OBJEKT_ID, heute=date(2026, 9, 15))
    assert "owner_statements" not in db.gefragt
    assert "payments" not in db.gefragt
    assert "commission_ledger" not in db.gefragt
    assert any("Abrechnungen" in w for w in kontext.weggelassen)


def test_kontext_erfindet_kein_objekt_wenn_es_fehlt() -> None:
    """Kein Ersatzwert (Wurzel 4) — der Mangel wird benannt."""
    kontext = kontext_bauen(_FakeDb(properties=[]), MANDANT, OBJEKT_ID)
    assert "Objektstammdaten" not in kontext.quellen
    assert any("nicht lesbar" in w for w in kontext.weggelassen)


# --- Prompt -----------------------------------------------------------------
def test_prompt_verbietet_betraege_ausdruecklich() -> None:
    """Ein Modell ohne Zahlen neigt dazu, eine plausible zu nennen.

    Deshalb steht die Sperre im Prompt und nicht nur im Kontext.
    """
    prompt = _system_prompt(None)
    assert "KEINE Daten" in prompt
    assert "Nenne niemals eine Summe" in prompt


def test_prompt_spricht_den_eigentuemer_nicht_als_gast_an() -> None:
    prompt = _system_prompt(None)
    assert "EIGENTÜMER" in prompt
    assert "Geschäftspartner" in prompt
    assert "Aufenthalt" not in prompt


# --- Verdrahtung ------------------------------------------------------------
def test_ai_reply_nimmt_den_eigentuemer_zweig() -> None:
    """Der Zweig muss VOR dem Buchungspfad greifen — das war der Fehler.

    Geprüft wird die Weiche, nicht das Modell: Ein Rückfall auf `_load_thread`
    wäre wieder der 404 „Konversation nicht gefunden".
    """
    from src.features.inbox.vorlagen import VorlagenMixin

    gerufen: list[str] = []

    class _Dienst(VorlagenMixin):
        def _ai_reply_eigentuemer(self, _ctx, thread_id):  # type: ignore[override]
            gerufen.append(thread_id)
            return "vorschlag"

        def _require(self, _ctx):
            raise AssertionError("Der Buchungspfad darf hier nicht laufen.")

    assert _Dienst().ai_reply(None, THREAD_ID) == "vorschlag"
    assert gerufen == [THREAD_ID]


def test_ai_reply_laesst_buchungs_threads_unveraendert() -> None:
    """Die Weiche darf den regulären Pfad nicht kapern."""
    from src.features.inbox.vorlagen import VorlagenMixin

    class _Dienst(VorlagenMixin):
        def _ai_reply_eigentuemer(self, _ctx, _thread_id):  # type: ignore[override]
            raise AssertionError("Kein Eigentümer-Thread.")

        def _require(self, _ctx):
            raise RuntimeError("bis hierher und nicht weiter")

    with pytest.raises(RuntimeError):
        _Dienst().ai_reply(None, "3f0c9d1e-1111-4111-8111-111111111111")
