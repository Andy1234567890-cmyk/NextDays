"""Welche planmäßigen Regeln bei einer EIGENTÜMERSPERRUNG greifen dürfen.

Eine genehmigte Sperre wird als Reservierung mit `is_owner_stay=true` gebucht
(0241/0353) — bewusst über den normalen Reservierungs-Schreibpfad, damit
Advisory-Lock, Einheitenwahl, Kalenderbelegung und ARI-Outbox EINEN Weg haben
(`calendar.sperrantraege._eigennutzung_anlegen`). An genau diesem Weg hängt aber
auch die Aufgaben-Automatik, und die kannte `is_owner_stay` bis 0510 nicht: der
Name kam im ganzen Aufgaben-Slice kein einziges Mal vor.

Die Folge war Arbeit ohne Auftrag. Fährt der Eigentümer in sein eigenes Haus,
entstanden trotzdem Anreise-Vorbereitung, Endreinigung und Wäsche — dieselbe
Kette wie bei einem Gast. Es gibt aber keinen Gast, der empfangen wird, und die
Reinigung nach seiner Abreise ist eine LEISTUNG, die jemand bestellt und die
jemand bezahlt, keine Folge des Kalenders. Die Aufgabe landete beim Personal und
wurde ausgeführt; abrechnen konnte der Betrieb sie nicht, weil niemand sie
bestellt hatte.

Die Umkehrung wäre genauso falsch: der Normalfall IST, dass nach dem Aufenthalt
gereinigt wird. Nur eben, weil der Eigentümer es bestellt hat. Deshalb kein
Schalter „Aufgaben bei Eigennutzung aus", sondern eine Bestellung
(`block_request_services`, 0510): angekreuzt = Aufgabe, nicht angekreuzt = keine.

**Bestellt ist nicht genehmigt (0538).** Die Agentur entscheidet ueber jede
bestellte Leistung einzeln (`block_request_services.status`); nur `genehmigt`
wird zur Aufgabe. Vorher fuhr die Bestellung mit der Genehmigung des Antrags
blind mit — die Agentur sah sie im Pruefdialog nicht einmal.

**Fail-closed (Wurzel 5).** Lässt sich die Bestellung nicht ermitteln — die
Reservierung trägt keine `block_request_id`, weil sie von Hand als Eigennutzung
erfasst wurde —, entsteht KEINE Aufgabe. Die Gegenrichtung wäre, im Zweifel zu
putzen: das ist genau der Zustand, der abgestellt werden soll.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.tasks.eigennutzung")

# PostgREST bekommt `in_`-Listen über die URL — in Blöcken wie überall in
# diesem Slice.
_BLOCK = 100


def ist_eigennutzung(reservation: dict[str, object]) -> bool:
    """Ist diese Reservierung eine Eigentümersperrung?

    Fehlt das Feld im übergebenen Ausschnitt, ist die Antwort `False` — und das
    ist hier KEIN stiller Ersatzwert, sondern eine Aussage über den Aufrufer:
    jeder Pfad, der Aufgaben erzeugt, MUSS `is_owner_stay` mitselektieren. Wer
    es vergisst, bekäme sonst die alte Behandlung zurück. Dagegen steht
    `test_jeder_engine_pfad_liest_is_owner_stay`.
    """
    return bool(reservation.get("is_owner_stay"))


def bestellte_regeln(
    db: Client, reservations: list[dict[str, object]]
) -> dict[str, set[str]]:
    """Je Eigennutzung die Regel-IDs, die ihr Eigentümer bestellt hat.

    Gebündelt über alle übergebenen Reservierungen, weil der Nachzug-Lauf
    seitenweise mit bis zu 200 Zeilen arbeitet — eine Abfrage je Reservierung
    wären 200 Roundtrips pro Seite.

    Rückgabe: `{reservation_id: {rule_id, …}}`. Eine Eigennutzung ohne Eintrag
    hat nichts bestellt; ihre Menge ist leer, nicht „alle".
    """
    antrag_je_reservierung = {
        str(r["id"]): str(r["block_request_id"])
        for r in reservations
        if ist_eigennutzung(r) and r.get("block_request_id")
    }
    if not antrag_je_reservierung:
        return {}

    bestellungen: dict[str, set[str]] = {}
    antrags_ids = list(set(antrag_je_reservierung.values()))
    # In Blöcken wie überall in diesem Slice: PostgREST bekommt `in_`-Listen
    # über die URL.
    for start in range(0, len(antrags_ids), _BLOCK):
        block = antrags_ids[start : start + _BLOCK]
        rows = (
            db.table("block_request_services")
            .select("block_request_id, rule_id, status")
            .in_("block_request_id", block)
            .execute()
        ).data or []
        for row in rows:
            # 0538: bestellt ist nicht genehmigt. Nur was die Agentur
            # freigegeben hat, wird zur Aufgabe. `angefragt` und `abgelehnt`
            # bleiben draussen — fail-closed (Wurzel 5): eine noch offene
            # Entscheidung ist keine Freigabe.
            if str(row.get("status") or "") != "genehmigt":
                continue
            bestellungen.setdefault(str(row["block_request_id"]), set()).add(
                str(row["rule_id"])
            )

    return {
        reservation_id: bestellungen.get(antrag_id, set())
        for reservation_id, antrag_id in antrag_je_reservierung.items()
    }


def regel_erlaubt(
    reservation: dict[str, object],
    rule_id: str,
    bestellt: dict[str, set[str]],
) -> bool:
    """Darf aus dieser Regel für diese Reservierung eine Aufgabe entstehen?

    Für jede gewöhnliche Buchung: ja, unverändert. Für eine Eigennutzung nur,
    wenn der Eigentümer genau diese Leistung bestellt hat.
    """
    if not ist_eigennutzung(reservation):
        return True
    reservation_id = str(reservation["id"])
    if reservation_id not in bestellt:
        # Eigennutzung ohne auffindbaren Antrag (von Hand erfasst oder der
        # Antrag wurde gelöscht). Fail-closed: keine Aufgabe. Laut protokolliert
        # — ein stiller Wegfall wäre derselbe Fehler wie ein verschluckter
        # Exception (Wurzel 5), und ein Betrieb, der eine Reinigung vermisst,
        # muss den Grund finden können.
        log.info(
            "eigennutzung_ohne_bestellung",
            reservation_id=reservation_id,
            rule_id=rule_id,
            grund="kein_sperrantrag",
        )
        return False
    return rule_id in bestellt[reservation_id]
