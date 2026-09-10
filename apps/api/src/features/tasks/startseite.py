"""Die Bestaende der Teamaufgaben — die Zahlen der Startseiten-Kachel.

WARUM EIN EIGENES MODUL: `service.py` fuehrt den Aufgaben-Lebenszyklus
(anlegen, planen, zuweisen, abhaken, abschliessen, inspizieren) und steht mit
3373 Zeilen unter `# pylint: disable=too-many-lines`. Diese Datei beantwortet
eine ANDERE Frage: nicht „was passiert mit einer Aufgabe", sondern „wie viele
Aufgaben liegen an". Dieselbe Trennung wie `calendar/sperrantrag_vorgaenge.py`
und `tasks/abrechnung.py`.

WARUM DIE ZAHLEN GEBRAUCHT WERDEN: Das Aufgaben-Modul ist vollstaendig gebaut
und hat seine Seiten unter /reservierungen/aufgaben — die Startseite zeigte
davon nichts. Genau dieselbe Luecke wie beim Sperrantrags-Workflow im
September: wer nicht weiss, dass dort etwas liegt, ruft die Seite nie auf. Eine
Benachrichtigung ist ein Ereignis, das vorbeizieht; ein Bestand gehoert auf die
Startseite.

WAS HIER BEWUSST NICHT PASSIERT: kein Aufruf von `list_team_tasks`. Dort
haengen Objekttitel, Nutzernamen, Buchungsreferenzen, Checklisten-Zaehler und
uebersetzte Regelnamen dran (fuenf weitere Abfragen), nur um am Ende fuenf
Zahlen anzuzeigen. Hier wird ausschliesslich gezaehlt — mit genau den Spalten,
die dafuer noetig sind.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger

from .schemas import TaskStatus, TeamaufgabenStand

logger = get_logger(__name__)

# Statuswerte, die „liegt noch an" bedeuten. Dieselbe Menge wie in
# `TasksService._filter_bucket`: alles ausser `done` und `cancelled`. Sie hier
# als Liste zu wiederholen waere eine zweite Wahrheit — deshalb aus dem Enum
# abgeleitet, damit ein neuer Arbeitszustand (wie `accepted` in 0360) die
# Kachel automatisch erreicht.
_ERLEDIGT = (TaskStatus.done, TaskStatus.cancelled)
OFFENE_STATUS: tuple[str, ...] = tuple(
    s.value for s in TaskStatus if s not in _ERLEDIGT
)


def _zeitpunkt(wert: object) -> datetime | None:
    """Ein Zeitstempel aus PostgREST als `datetime`; unlesbar → `None`.

    Kein Ersatzwert: ein erfundenes „jetzt" liesse die aelteste ueberfaellige
    Aufgabe frisch aussehen und genau die Dringlichkeit verschwinden, die die
    Zahl transportieren soll (Wurzel 4).
    """
    if isinstance(wert, datetime):
        return wert if wert.tzinfo else wert.replace(tzinfo=UTC)
    if not isinstance(wert, str) or not wert:
        return None
    try:
        gelesen = datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError:
        # Ein unlesbarer Zeitstempel in der eigenen DB ist ein Datenfehler, kein
        # Normalfall — er wird gemeldet, nicht still verschluckt (Wurzel 5).
        logger.warning("startseite.zeitpunkt_unlesbar", extra={"wert": str(wert)[:64]})
        return None
    return gelesen if gelesen.tzinfo else gelesen.replace(tzinfo=UTC)


def _faellig(zeile: dict[str, object]) -> datetime | None:
    """Wann die Aufgabe dran ist: `start_at`, sonst `due_at`.

    Dieselbe Rangfolge wie `_filter_bucket` — dort entscheidet
    `t.start_at or t.due_at` ueber AKTUELL/BEVORSTEHEND. Eine andere Rangfolge
    hier wuerde die Kachel und die Liste, in die sie fuehrt, auseinanderlaufen
    lassen: die Kachel meldete „3 ueberfaellig", der Reiter zeigte zwei.

    EIN Unterschied ist Absicht: `_filter_bucket` faellt am Ende auf `now`
    zurueck (`start_at or due_at or now`) und legt eine Aufgabe OHNE jeden
    Termin damit unter „aktuell". Hier gibt es diesen Rueckfall nicht — eine
    Aufgabe ohne Termin kann keinen Termin reissen, und eine erfundene
    Faelligkeit „jetzt" machte sie faelschlich dringend (Wurzel 4). Sie zaehlt
    im Bestand (`offen`), nicht in `ueberfaellig`/`heute`. Wer von „5 heute
    faellig" in die Liste springt, kann unter „Aktuell" deshalb mehr Zeilen
    sehen als die Kachel meldet; die gemeldete Zahl bleibt richtig.
    """
    return _zeitpunkt(zeile.get("start_at")) or _zeitpunkt(zeile.get("due_at"))


def teamaufgaben_stand(
    db: Client,
    tenant_id: str,
    *,
    tagesbeginn: datetime | None = None,
    tagesende: datetime | None = None,
) -> TeamaufgabenStand:
    """Zaehlt die offenen Teamaufgaben EINES Mandanten.

    `tagesbeginn`/`tagesende` sind die Grenzen des laufenden Tages BEIM NUTZER
    und kommen vom Client, nicht aus einer hier gerechneten Zone. Grund wie in
    `TasksService._filter_bucket`: der Kalendertag einer Aufgabe ist in der Zone
    des OBJEKTS definiert, und live haben 24 von 43 Objekten keine gepflegte
    Zone — eine hier zu unterstellen waere ein erfundener Wert (Wurzel 4).

    Fehlt eine der beiden Grenzen, bleiben `ueberfaellig` und `heute` bei 0 und
    die Kachel zeigt nur den Bestand. Das ist die ehrliche Auskunft: ohne zu
    wissen, welcher Tag beim Leser laeuft, ist „ueberfaellig" nicht bestimmbar.
    Kein Rueckfall auf die Serveruhr, die im Zweifel acht Stunden danebenliegt.

    Der Mandanten-Filter ist die Autorisierung (Wurzel 3): die Service-Rolle
    umgeht RLS, deshalb steht `tenant_id` hier hart in der Abfrage. Weiter
    eingegrenzt wird NICHT — der Aufrufer ist per `MANAGE_TASKS` gebunden,
    genau wie der List-Pfad `/tasks/team`, dessen Zahlen die Kachel meldet
    (Wurzel 9).
    """
    zeilen = (
        db.table("tasks")
        .select("assignee_id, start_at, due_at, inspection_state, status")
        .eq("tenant_id", tenant_id)
        .in_("status", list(OFFENE_STATUS))
        .execute()
    ).data or []

    offen = len(zeilen)
    ohne_zustaendige = sum(1 for z in zeilen if not z.get("assignee_id"))
    # Abnahme: `inspection_state='to_review'` ist derselbe Filter wie der
    # Reiter „Zu pruefen" in `list_inspection`. Bewusst aus DIESER Menge (nur
    # offene Aufgaben), nicht aus allen: eine abgeschlossene Aufgabe wartet
    # nicht mehr auf einen Handgriff.
    zur_abnahme = sum(1 for z in zeilen if z.get("inspection_state") == "to_review")

    ueberfaellig = 0
    heute = 0
    aeltester: datetime | None = None
    # BEIDE Grenzen oder keine: mit `tagesende` allein liesse sich „ueberfaellig"
    # nicht von „heute faellig" trennen, und alles vor der Grenze landete in
    # einem der beiden Toepfe — eine drei Wochen alte Aufgabe stuende dann unter
    # „heute". Lieber beide Zahlen auf 0 und den reinen Bestand zeigen, als eine
    # plausibel aussehende Falschaussage (Wurzel 4).
    if tagesbeginn is not None and tagesende is not None:
        for zeile in zeilen:
            wann = _faellig(zeile)
            if wann is None:
                # Eine Aufgabe ohne jeden Termin ist nicht ueberfaellig — sie
                # hat keinen Termin, den sie reissen koennte. Sie zaehlt im
                # Bestand, nicht in der Dringlichkeit.
                continue
            if wann < tagesbeginn:
                ueberfaellig += 1
                if aeltester is None or wann < aeltester:
                    aeltester = wann
            elif wann < tagesende:
                heute += 1

    return TeamaufgabenStand(
        offen=offen,
        ueberfaellig=ueberfaellig,
        heute=heute,
        ohne_zustaendige=ohne_zustaendige,
        zur_abnahme=zur_abnahme,
        aeltester_faellig_am=aeltester,
    )
