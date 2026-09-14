"""Der Versandtakt der Automails — das Claim und seine Gegenzustände.

`dispatch_due_automations` ist der eine Pfad, über den JEDE automatische
Gastnachricht hinausgeht. Er läuft ohne JWT, über den internen Cron, und je
uvicorn-Worker parallel. Drei Dinge müssen daran stimmen, und keines davon
sieht man der Funktion an:

1. **Das Claim steht VOR dem Senden** (Wurzel 2). Zwischen Auswahl und
   Statuswechsel liegt sonst ein vollständiger Netzwerk-Roundtrip zum Portal —
   jeder parallele Takt, der die Zeile in diesem Fenster sieht, schickt sie
   erneut. Dieselbe Wurzel wie bei der KI-Autoantwort, dort live gemeldet als
   „die e-mails gehen auch doppelt raus".

2. **Das Claim ist an `send_at` gebunden.** `status` bleibt bei einer
   Neuplanung (Umbuchung) 'pending'; nur Text und Zeitpunkt ändern sich. Ohne
   die Bedingung ginge der VERALTETE Text aus dem Snapshot sofort raus, und die
   korrekt verschobene Nachricht nie — die Zeile stünde auf 'sent'.

3. **Ein Abbruch zwischen Claim und Abschluss darf nicht ewig blockieren.**
   'sending' ist nicht überschreibbar und der Unique-Index verhindert eine
   zweite Zeile; ohne Reaper wäre das Paar (Regel, Thread) für immer tot.
   Deploys sind Routine — das sammelte sich still an.

Dazu der Meldeweg: ein ENDGÜLTIG fehlgeschlagener Versand meldet sich genau
einmal in der Glocke des Betriebs. Ein vorübergehender Fehler (429/5xx) meldet
sich gar nicht — eine Meldung, die sich von selbst erledigt, entwertet die
übrigen.

Die Fake-DB filtert hier WIRKLICH (eq/lte/lt): ein Claim, das seine Bedingungen
nicht setzt, fiele sonst nicht auf.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from src.features.inbox import planung
from src.features.inbox.errors import InboxError
from src.features.inbox.planung import PlanungMixin

TABELLE = "automation_scheduled_message"


def _jetzt() -> datetime:
    return datetime.now(UTC)


class _Res:
    def __init__(self, data: list) -> None:
        self.data = data


class _Query:
    """Minimaler PostgREST-Nachbau mit ECHTEN Filtern."""

    def __init__(self, db: _FakeDb, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._filter: list[tuple[str, str, Any]] = []
        self._modus = "select"
        self._werte: dict | None = None
        self._order: str | None = None
        self._limit: int | None = None

    # --- Aufbau ---------------------------------------------------------
    def select(self, *_a: Any, **_k: Any) -> _Query:
        self._modus = "select"
        return self

    def update(self, werte: dict) -> _Query:
        self._modus = "update"
        self._werte = werte
        return self

    def eq(self, spalte: str, wert: Any) -> _Query:
        self._filter.append((spalte, "eq", wert))
        return self

    def lte(self, spalte: str, wert: Any) -> _Query:
        self._filter.append((spalte, "lte", wert))
        return self

    def lt(self, spalte: str, wert: Any) -> _Query:
        self._filter.append((spalte, "lt", wert))
        return self

    def gte(self, spalte: str, wert: Any) -> _Query:
        self._filter.append((spalte, "gte", wert))
        return self

    def order(self, spalte: str, **_k: Any) -> _Query:
        self._order = spalte
        return self

    def limit(self, n: int) -> _Query:
        self._limit = n
        return self

    # --- Ausführung -----------------------------------------------------
    def _passt(self, zeile: dict) -> bool:
        for spalte, art, wert in self._filter:
            ist = zeile.get(spalte)
            if art == "eq":
                if str(ist) != str(wert):
                    return False
            elif ist is None:
                return False
            elif art == "lte" and not str(ist) <= str(wert):
                return False
            elif art == "lt" and not str(ist) < str(wert):
                return False
            elif art == "gte" and not str(ist) >= str(wert):
                return False
        return True

    def execute(self) -> _Res:
        zeilen = [z for z in self._db.tabellen.get(self._tabelle, []) if self._passt(z)]
        if self._modus == "update":
            for z in zeilen:
                z.update(self._werte or {})
            self._db.updates.append(
                (self._tabelle, dict(self._werte or {}), len(zeilen))
            )
            return _Res([dict(z) for z in zeilen])
        if self._order:
            zeilen.sort(key=lambda z: str(z.get(self._order) or ""))
        if self._limit is not None:
            zeilen = zeilen[: self._limit]
        kopien = [dict(z) for z in zeilen]
        # Der Wettlauf: ein zweiter Takt (oder eine Neuplanung) greift GENAU
        # zwischen Auswahl und Claim zu. Nur einmal, damit die Probe nicht in
        # jeder weiteren Abfrage erneut zuschlägt.
        if self._db.nach_auswahl is not None:
            haken, self._db.nach_auswahl = self._db.nach_auswahl, None
            haken(self._db)
        return _Res(kopien)


class _FakeDb:
    def __init__(self, **tabellen: list) -> None:
        self.tabellen = tabellen
        self.updates: list[tuple[str, dict, int]] = []
        self.nach_auswahl: Any = None

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def zeile(self, zeilen_id: str) -> dict:
        return next(z for z in self.tabellen[TABELLE] if z["id"] == zeilen_id)


class _Dienst(PlanungMixin):
    """Nur das Mixin, mit Fake-DB und zählbarem Versand."""

    def __init__(self, db: _FakeDb, fehler: dict[str, Exception] | None = None) -> None:
        self._db = db
        self._fehler = fehler or {}
        self.gesendet: list[tuple[str, str]] = []

    def send_message(  # noqa: PLR0913 — Signatur des echten Service
        self,
        ctx: Any,
        thread_id: str,
        body: str,
        *,
        enforce_reply: bool = True,
        quelle: str = "manuell",
        automation_id: str | None = None,
        **_weitere: Any,
    ) -> None:
        # `**_weitere` bewusst offen: der echte `send_message` wächst (zuletzt
        # um `automation_id`, den der Mailweg für den Betreff braucht). Ein
        # Double, das jedes neue Schlüsselwort mit TypeError quittiert, misst
        # dann nicht mehr das Claim, sondern nur noch seine eigene Signatur —
        # und der Fehler landet als `last_error` an der Zeile, sieht also wie
        # ein echter Versandfehler aus.
        assert quelle == "automation", "Automail muss als solche erkennbar sein"
        assert enforce_reply is False
        _ = automation_id
        if thread_id in self._fehler:
            raise self._fehler[thread_id]
        self.gesendet.append((thread_id, body))


def _faellig(**felder: object) -> dict:
    """Eine fällige Automail — send_at in der letzten Stunde.

    Bewusst nicht weiter zurück: alles Ältere ist ein Nachzügler
    (`planung.NACHZUEGLER_STUNDEN`) und wird gar nicht erst versendet. Diese
    Tests prüfen das Claim, nicht die Nachzügler-Schranke.
    """
    jetzt = _jetzt()
    basis = {
        "id": "a1",
        "tenant_id": "t1",
        "thread_id": "th1",
        "body": "Guten Tag Frau Meier,",
        "send_at": (jetzt - timedelta(minutes=5)).isoformat(),
        "status": "pending",
        "updated_at": (jetzt - timedelta(minutes=5)).isoformat(),
    }
    return {**basis, **felder}


@pytest.fixture(autouse=True)
def _nebenwege_still(monkeypatch: pytest.MonkeyPatch) -> list:
    """Verlauf und Glocke abfangen — beide schreiben sonst echt in die DB."""
    meldungen: list[dict] = []
    monkeypatch.setattr(
        planung.worker_verlauf, "merken", lambda *a, **k: None, raising=True
    )
    monkeypatch.setattr(
        planung,
        "melde_zustellproblem",
        lambda _db, **k: meldungen.append(k),
        raising=True,
    )
    return meldungen


# --- Der glückliche Fall ----------------------------------------------------
def test_faellige_automail_geht_einmal_hinaus() -> None:
    db = _FakeDb(**{TABELLE: [_faellig()]})
    dienst = _Dienst(db)

    ergebnis = dienst.dispatch_due_automations()

    assert ergebnis == {"sent": 1, "failed": 0, "considered": 1}
    assert dienst.gesendet == [("th1", "Guten Tag Frau Meier,")]
    assert db.zeile("a1")["status"] == "sent"
    # Und der Statuswechsel auf 'sending' stand VOR dem Versand, nicht danach.
    claims = [w for t, w, _n in db.updates if t == TABELLE and w.get("status") == "sending"]
    assert len(claims) == 1


def test_verlorener_claim_sendet_nicht() -> None:
    """Wurzel 2: wer die Zeile nicht claimen konnte, sendet NICHT.

    Gespielt wird der reale Wettlauf: ein zweiter Takt hat die Zeile zwischen
    Auswahl und Claim schon auf 'sending' gesetzt. Das bedingte UPDATE
    (`eq('status','pending')`) trifft dann nichts mehr.
    """
    db = _FakeDb(**{TABELLE: [_faellig()]})
    db.nach_auswahl = lambda d: d.zeile("a1").update({"status": "sending"})
    dienst = _Dienst(db)

    ergebnis = dienst.dispatch_due_automations()

    assert dienst.gesendet == [], "verlorener Claim darf nicht senden"
    assert ergebnis["sent"] == 0
    assert ergebnis["considered"] == 1
    # Die Zeile gehört dem anderen Takt — sie darf hier NICHT auf 'sent' landen.
    assert db.zeile("a1")["status"] == "sending"


def test_claim_ist_an_send_at_gebunden() -> None:
    """Eine Neuplanung zwischen Auswahl und Claim verhindert den ALTEN Text.

    Eine Umbuchung schreibt `body` und `send_at` neu; `status` bleibt dabei
    'pending'. Ohne die `eq('send_at', …)`-Bedingung ginge der veraltete Text
    aus dem Snapshot SOFORT raus („Ihre Anreise ist morgen" zum alten Datum),
    und die richtig verschobene Nachricht nie mehr — die Zeile stünde auf 'sent'
    und 'sent' ist nicht überschreibbar.
    """
    neuer_zeitpunkt = (_jetzt() + timedelta(days=2)).isoformat()
    db = _FakeDb(**{TABELLE: [_faellig()]})
    db.nach_auswahl = lambda d: d.zeile("a1").update(
        {"send_at": neuer_zeitpunkt, "body": "Neuer Text nach Umbuchung"}
    )
    dienst = _Dienst(db)

    ergebnis = dienst.dispatch_due_automations()

    assert dienst.gesendet == [], "der veraltete Text darf nicht hinausgehen"
    assert ergebnis["sent"] == 0
    zeile = db.zeile("a1")
    assert zeile["status"] == "pending", "die verschobene Nachricht bleibt fällig"
    assert zeile["send_at"] == neuer_zeitpunkt


def test_reaper_holt_haengende_sending_zeile_zurueck() -> None:
    """Ein Abbruch zwischen Claim und Abschluss blockiert sonst FÜR IMMER.

    'sending' ist nicht in `UEBERSCHREIBBAR`, und der Unique-Index je
    (Automation, Thread) verhindert eine zweite Zeile: ohne Reaper holt kein
    Pfad diese Nachricht zurück. Nach dem Freigeben geht sie im selben Takt
    hinaus — genau das ist der Sinn.
    """
    zu_alt = (_jetzt() - timedelta(minutes=60)).isoformat()
    db = _FakeDb(**{TABELLE: [_faellig(status="sending", updated_at=zu_alt)]})
    dienst = _Dienst(db)

    ergebnis = dienst.dispatch_due_automations()

    freigaben = [
        n for t, w, n in db.updates
        if t == TABELLE and w == {"status": "pending"} and n
    ]
    assert freigaben == [1], "die verwaiste Zeile muss freigegeben werden"
    assert ergebnis["sent"] == 1
    assert db.zeile("a1")["status"] == "sent"


def test_frische_sending_zeile_bleibt_unangetastet() -> None:
    """Der Reaper darf keinen laufenden Versand abräumen — sonst doppelt.

    Die Grenze ist `scheduler.SENDING_REAP_MINUTES`; eine Zeile, die gerade
    erst geclaimt wurde, gehört einem anderen, noch laufenden Takt.
    """
    frisch = (_jetzt() - timedelta(minutes=1)).isoformat()
    db = _FakeDb(**{TABELLE: [_faellig(status="sending", updated_at=frisch)]})
    dienst = _Dienst(db)

    ergebnis = dienst.dispatch_due_automations()

    assert dienst.gesendet == []
    assert ergebnis == {"sent": 0, "failed": 0, "considered": 0}
    assert db.zeile("a1")["status"] == "sending"


# --- Der Meldeweg -----------------------------------------------------------
def test_endgueltiger_fehler_meldet_genau_einmal(_nebenwege_still: list) -> None:
    """'failed' → EINE Meldung in der Glocke; 'pending' (Störung) → keine.

    Der Verlauf ist das Backoffice; der Betrieb selbst sieht nur die Glocke.
    Eine Meldung je vorübergehender Störung entwertete alle übrigen — ein 502
    des Portals erledigt sich beim nächsten Takt von selbst.
    """
    db = _FakeDb(
        **{
            TABELLE: [
                _faellig(id="a1", thread_id="th1"),
                _faellig(id="a2", thread_id="th2"),
            ]
        }
    )
    dienst = _Dienst(
        db,
        fehler={
            # 400: das Portal lehnt ab — auch beim zehnten Versuch.
            "th1": InboxError("Thread ist geschlossen.", status_code=400),
            # 502: eine Aussage über DIESEN Moment, nicht über die Nachricht.
            "th2": InboxError("Service Temporary Unavailable", status_code=502),
        },
    )

    ergebnis = dienst.dispatch_due_automations()

    assert ergebnis["failed"] == 2
    assert db.zeile("a1")["status"] == "failed"
    assert db.zeile("a2")["status"] == "pending", "Störung ist keine Endstation"
    assert len(_nebenwege_still) == 1, "genau eine Glockenmeldung"
    meldung = _nebenwege_still[0]
    assert meldung["quelle_id"] == "a1"
    assert meldung["tenant_id"] == "t1"
    assert meldung["endgueltig"] is True
    assert "geschlossen" in meldung["grund"]
