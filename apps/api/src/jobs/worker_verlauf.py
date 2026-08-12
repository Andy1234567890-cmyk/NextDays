"""Den Worker-Verlauf mitschreiben (0379).

WOZU: Der Worker hinterlässt seine Spuren in drei Tabellen (`jobs`,
`channex_debug_log`, `channex_webhook_event`), und keine davon ist abonnierbar —
sie tragen vollständige Nutzlasten und dürfen für `authenticated` nicht geöffnet
werden (Wurzel 6). Ohne eine abonnierbare Spur bliebe ein Backoffice-Verlauf auf
Polling angewiesen.

`worker_ereignis` ist diese Spur: nur Metadaten, mit Verweis auf die Quellzeile.
Was der Verlauf anzeigt, kommt von hier; was in einer Zeile steht, holt die
Oberfläche über den Backoffice-Endpunkt nach (service-role, `is_platform_admin`).

WARUM BEST EFFORT UND NICHT IM JOB-TRANSAKTIONSPFAD:
Ein Verlauf, der den Worker kippen kann, ist schlimmer als kein Verlauf. Jede
Funktion hier fängt breit und loggt — der Job gilt weiter als erledigt, wenn nur
seine Verlaufszeile fehlt. Umgekehrt gilt das NICHT: ein Job-Fehler wird
selbstverständlich als Verlaufszeile geschrieben, sonst wäre die Ansicht eine
Beschönigung (Wurzel 5).

WARUM KEINE NUTZLASTEN: Zwei Gründe, und der zweite ist der wichtigere.
Erstens Wurzel 6 — die Tabelle ist per Grant für `authenticated` lesbar (nötig
fürs Abo), also darf dort nichts stehen, was ein Betriebs-Nutzer nicht sehen
soll. Zweitens: die Nutzlasten liegen ohnehin schon in den Quelltabellen. Sie
hier zu kopieren erzeugte eine zweite Wahrheit, die mit der Zeit abweicht.
"""

from __future__ import annotations

import time
from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.worker.verlauf")

# Wie viel Fehlertext im Verlauf steht. Großzügig: die Ansicht soll den Grund
# NENNEN, nicht auf die Quelltabelle verweisen. Der Deckel schützt nur davor,
# dass ein Stacktrace die Zeile sprengt.
_FEHLER_MAX = 2000


class Stoppuhr:
    """Laufzeit EINES Jobs. Fürs Verlaufs-Feld `dauer_ms`.

    Warum überhaupt gemessen wird: `jobs` hat nur `created_at`/`updated_at`, und
    deren Differenz enthält die WARTEZEIT in der Warteschlange mit — ein Job, der
    zehn Minuten auf einen Slot wartete und dann 200 ms lief, sähe darin aus wie
    ein Langläufer.
    """

    def __init__(self) -> None:
        self._start = time.monotonic()

    def ms(self) -> int:
        return int((time.monotonic() - self._start) * 1000)


def merken(  # noqa: PLR0913 — jedes Feld ist eine eigene Achse der Ansicht
    db: Client,
    *,
    richtung: str,
    vorgang: str,
    ergebnis: str,
    tenant_id: str | None = None,
    property_id: str | None = None,
    quelle_tabelle: str | None = None,
    quelle_id: str | None = None,
    http_methode: str | None = None,
    http_pfad: str | None = None,
    http_status: int | None = None,
    dauer_ms: int | None = None,
    fehler_text: str | None = None,
    versuche: int | None = None,
) -> None:
    """Eine Verlaufszeile schreiben. Fehler hier kippen den Aufrufer nie.

    Der UNIQUE-Index (quelle_tabelle, quelle_id, ergebnis) ist der Backstop
    gegen Doppelschreiben nach einem Retry (Wurzel 2) — eine Kollision ist
    deshalb der NORMALFALL und kein Fehler: derselbe Job hat denselben Abschluss
    schon gemeldet. Sie wird verschluckt, aber nur sie.
    """
    zeile: dict[str, Any] = {
        "richtung": richtung,
        "vorgang": vorgang,
        "ergebnis": ergebnis,
        "tenant_id": tenant_id,
        "property_id": property_id,
        "quelle_tabelle": quelle_tabelle,
        "quelle_id": quelle_id,
        "http_methode": http_methode,
        "http_pfad": http_pfad,
        "http_status": http_status,
        "dauer_ms": dauer_ms,
        "fehler_text": fehler_text[:_FEHLER_MAX] if fehler_text else None,
        "versuche": versuche,
    }
    try:
        db.table("worker_ereignis").insert(zeile).execute()
    except Exception as exc:  # noqa: BLE001 — der Verlauf darf den Worker nie kippen
        text = str(exc)
        # Die Dublette ist erwartet (Retry desselben Abschlusses) und kein
        # Befund. Alles andere schon: eine fehlende Spalte oder eine
        # RLS-Ablehnung würde den Verlauf still leerlaufen lassen.
        if "worker_ereignis_quelle_uidx" in text or "23505" in text:
            return
        log.warning(
            "worker_verlauf_nicht_geschrieben",
            richtung=richtung,
            vorgang=vorgang,
            fehler=text[:300],
        )


def job_beendet(
    db: Client,
    job: dict[str, Any],
    *,
    status: str,
    fehler: str | None = None,
    dauer_ms: int | None = None,
) -> None:
    """Abschluss eines Jobs in den Verlauf schreiben.

    `status` ist der Worker-Zustand (`done`, `dead`, `queued` nach Retry,
    `deferred`). Übersetzt auf die drei Verlaufs-Ergebnisse, damit die Ansicht
    lesbar bleibt:

      done              → ok
      dead              → fehler   (endgültig aufgegeben)
      queued (Retry)    → fehler   (dieser Versuch ging schief)
      deferred (Budget) → ok       (KEIN Fehler: der Job wartet auf ein Token)

    Der Budget-Aufschub ist bewusst `ok`. Ihn als Fehler zu führen hieße, jede
    Ansicht mit Rot zu füllen, sobald der Betrieb unter Last steht — und der
    echte Fehler ginge darin unter (Wurzel 5).
    """
    payload = job.get("payload") or {}
    merken(
        db,
        richtung="job",
        vorgang=str(job.get("job_type") or "?"),
        ergebnis="fehler" if status in {"dead", "queued"} else "ok",
        tenant_id=_uuid(job.get("tenant_id")) or _uuid(payload.get("tenant_id")),
        property_id=_uuid(payload.get("property_id")),
        quelle_tabelle="jobs",
        quelle_id=_uuid(job.get("id")),
        dauer_ms=dauer_ms,
        fehler_text=fehler,
        versuche=job.get("attempts"),
    )


def _uuid(wert: object) -> str | None:
    """Einen UUID-Wert übernehmen — oder `None`.

    Payloads sind nicht typisiert; ein leerer String würde die Spalte mit
    `invalid input syntax for type uuid` sprengen und die ganze Verlaufszeile
    kosten. Nichts wird geraten (Wurzel 4).
    """
    if not wert:
        return None
    text = str(wert).strip()
    return text or None


def job_ausgang(
    db: Client,
    job: dict[str, Any],
    uhr: Stoppuhr,
    *,
    ausgang: str,
    fehler: str | None = None,
    retry_after: int | None = None,
) -> None:
    """DER eine Eingang für den Worker — er meldet nur den Ausgang.

    Was ein Ausgang für den Verlauf bedeutet (rot oder nicht, welcher Text),
    steht hier und nicht im Worker: dort lägen sonst drei Aufrufstellen, die
    jeweils selbst entscheiden, und die erste, die vergessen wird, macht die
    Ansicht still unvollständig.

      'done'       → ok
      'aufschub'   → ok      (Budget erschöpft — Warten, kein Fehler)
      'fehler'     → fehler  (dead oder erneuter Versuch)
    """
    if ausgang == "aufschub":
        job_aufgeschoben(db, job, retry_after=retry_after or 0, dauer_ms=uhr.ms())
    elif ausgang == "fehler":
        job_fehlgeschlagen(db, job, fehler=fehler or "", dauer_ms=uhr.ms())
    else:
        job_beendet(db, job, status="done", dauer_ms=uhr.ms())


def job_aufgeschoben(
    db: Client, job: dict[str, Any], *, retry_after: int, dauer_ms: int
) -> None:
    """Budget-Aufschub in den Verlauf — als `ok`, NICHT als Fehler.

    Ein erschöpftes Portal-Budget ist kein Fehler, sondern Warten: der Job läuft
    nach `retry_after` weiter, ab dem bereits erledigten Punkt. Ihn rot zu führen
    hieße, die Ansicht unter Last komplett rot zu machen — und der echte Fehler
    ginge darin unter (Wurzel 5).

    Der Grund steht trotzdem in `fehler_text`, weil man sonst nicht sähe, WARUM
    ein Job mehrfach auftaucht.
    """
    merken(
        db,
        richtung="job",
        vorgang=str(job.get("job_type") or "?"),
        ergebnis="ok",
        quelle_tabelle="jobs",
        quelle_id=_uuid(job.get("id")),
        dauer_ms=dauer_ms,
        fehler_text=f"Portal-Budget erschöpft, neuer Versuch in {retry_after}s",
        versuche=job.get("attempts"),
    )


def job_fehlgeschlagen(
    db: Client, job: dict[str, Any], *, fehler: str, dauer_ms: int
) -> None:
    """Fehlversuch in den Verlauf.

    Ob der Job endgültig aufgibt (`dead`) oder es erneut versucht (`queued`),
    entscheidet dieselbe Grenze wie in `Worker._retry`: das Versuchs-Budget. Für
    den Verlauf ist beides ein fehlgeschlagener Versuch — die Unterscheidung
    steht in `versuche` und in der Quellzeile.
    """
    erschoepft = (job.get("attempts") or 0) >= (job.get("max_attempts") or 10)
    job_beendet(
        db,
        job,
        status="dead" if erschoepft else "queued",
        fehler=fehler,
        dauer_ms=dauer_ms,
    )
