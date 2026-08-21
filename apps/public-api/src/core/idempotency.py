"""Idempotenz für schreibende Aufrufe (`Idempotency-Key`).

Warum das nicht optional ist: real kommt alles doppelt (Wurzel 2). Ein Client
mit Netzabbruch wiederholt seinen POST, ohne zu wissen, ob der erste ankam. Ohne
Schutz entstehen zwei Buchungen für denselben Aufenthalt — und die zweite sperrt
Nächte, die niemand bestellt hat.

Weder Lodgify noch Hostaway bieten dafür etwas an (Recherche 20.08.2026); dort
ist eine doppelte Buchung ein Kundendienst-Fall. Das Verfahren hier folgt dem
Muster, das Stripe etabliert hat und das Entwickler kennen: ein selbst gewählter
Schlüssel im Header, dessen erste Antwort 24 h lang wiederholt wird.

Der Ablauf ist bewusst „erst beanspruchen, dann handeln":

  1. `beanspruchen()` schreibt eine Zeile mit UNIQUE(api_client, key). Gewinnt
     der Aufruf das Rennen, darf er ausführen.
  2. Gewinnt er nicht, gibt es zwei Fälle: die Antwort steht schon (→ wortgleich
     wiederholen) oder der erste Aufruf läuft noch (→ 409, der Client soll
     warten statt eine zweite Buchung zu erzeugen).
  3. `antwort_festhalten()` legt die Antwort ab, sobald sie steht.

Der Anspruch entsteht damit VOR dem Seiteneffekt. Andersherum — erst buchen,
dann Schlüssel merken — wäre wirkungslos: genau zwischen beiden Schritten liegt
der Abbruch, der die Wiederholung auslöst.
"""
from __future__ import annotations

import hashlib
import json

from supabase import Client

from . import errors
from .logging import get_logger

log = get_logger("publicapi.idempotenz")

# Länge des Schlüssels, den ein Client mitgibt. Untergrenze, damit „1" nicht als
# Schlüssel durchgeht (der kollidiert bei jedem zweiten Client).
_MIN_LAENGE = 8
_MAX_LAENGE = 255

# PostgREST-Fehlercode für „unique constraint verletzt". Das ist hier ein
# KONTROLL-SIGNAL, kein Fehler: es bedeutet „jemand anderes war zuerst da".
# Darum wird es gezielt gefangen und nicht von einem breiten except verschluckt
# (Wurzel 5).
_UNIQUE_VERLETZUNG = "23505"


def _anfrage_fingerabdruck(pfad: str, koerper: dict[str, object]) -> str:
    """Stabiler Hash über Pfad + Nutzlast.

    Sortierte Schlüssel, damit dieselbe Nutzlast in anderer Feldreihenfolge
    denselben Abdruck ergibt — sonst würde ein Client, der ein dict neu
    serialisiert, seinen eigenen Wiederholschutz verlieren.
    """
    roh = json.dumps(
        {"pfad": pfad, "koerper": koerper}, sort_keys=True, ensure_ascii=False,
        default=str,
    )
    return hashlib.sha256(roh.encode("utf-8")).hexdigest()


def schluessel_pruefen(key: str | None, *, pflicht: bool) -> str | None:
    """Header-Wert prüfen. Bei Pflicht und fehlendem Wert: 422 mit Begründung.

    Pflicht ist er dort, wo eine Doppelausführung Geld oder Verkauf bewegt —
    also beim Anlegen einer Buchung. Bei allen anderen Schreibpfaden ist er
    freiwillig, weil sie ihre Wirkung selbst nur einmal haben können (eine Nacht
    zweimal auf denselben Preis zu setzen ändert nichts).
    """
    if key is None or not key.strip():
        if pflicht:
            raise errors.ungueltige_anfrage(
                "Der Header 'Idempotency-Key' ist bei diesem Aufruf Pflicht. "
                "Wähle einen eindeutigen Wert je Vorgang (z. B. eine UUID) und "
                "wiederhole ihn, wenn du denselben Aufruf erneut sendest."
            )
        return None
    wert = key.strip()
    if not _MIN_LAENGE <= len(wert) <= _MAX_LAENGE:
        raise errors.ungueltige_anfrage(
            f"'Idempotency-Key' muss zwischen {_MIN_LAENGE} und {_MAX_LAENGE} "
            "Zeichen lang sein."
        )
    return wert


def beanspruchen(
    db: Client,
    *,
    tenant_id: str,
    client_pk: str,
    key: str,
    pfad: str,
    koerper: dict[str, object],
) -> dict | None:
    """Schlüssel beanspruchen. Rückgabe:

      * ``None`` — der Anspruch ist neu, der Aufrufer darf ausführen.
      * ``dict`` — die gespeicherte Antwort eines früheren, identischen Aufrufs;
        sie ist wortgleich zurückzugeben.

    Wirft 409, wenn derselbe Schlüssel noch in Arbeit ist, und 422, wenn er mit
    einer ANDEREN Nutzlast wiederverwendet wird — Letzteres ist fast immer ein
    Fehler im Client (ein wiederverwendeter Schlüssel für einen neuen Vorgang)
    und darf nicht stillschweigend als „schon erledigt" quittiert werden.
    """
    abdruck = _anfrage_fingerabdruck(pfad, koerper)
    try:
        db.table("public_api_idempotency").insert(
            {
                "tenant_id": tenant_id,
                "api_client_id": client_pk,
                "idempotency_key": key,
                "request_fingerprint": abdruck,
                "pfad": pfad,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 — nur der Unique-Fall wird behandelt
        if _UNIQUE_VERLETZUNG not in str(exc):
            # Etwas anderes ist schiefgegangen: NICHT als „schon erledigt"
            # deuten und weiterlaufen (das wäre ein verschlucktes Signal,
            # Wurzel 5), sondern durchlassen.
            raise
        return _vorhandenen_anspruch_lesen(
            db, tenant_id=tenant_id, client_pk=client_pk, key=key, abdruck=abdruck
        )
    return None


def _vorhandenen_anspruch_lesen(
    db: Client, *, tenant_id: str, client_pk: str, key: str, abdruck: str
) -> dict:
    zeilen = (
        db.table("public_api_idempotency")
        .select("request_fingerprint, response_status, response_body")
        .eq("tenant_id", tenant_id)
        .eq("api_client_id", client_pk)
        .eq("idempotency_key", key)
        .limit(1)
        .execute()
    ).data
    if not zeilen:
        # Zwischen Insert-Konflikt und Lesen wurde die Zeile entfernt
        # (Aufräumjob). Der Aufrufer soll es erneut versuchen, nicht blind
        # ausführen.
        raise errors.konflikt(
            "idempotenz_rennen",
            "Der Schlüssel wird gerade verarbeitet. Bitte den Aufruf wiederholen.",
        )
    zeile = zeilen[0]
    if zeile.get("request_fingerprint") != abdruck:
        raise errors.ungueltige_anfrage(
            "Dieser 'Idempotency-Key' wurde bereits mit einer anderen Nutzlast "
            "verwendet. Für einen neuen Vorgang einen neuen Schlüssel wählen."
        )
    if zeile.get("response_status") is None:
        raise errors.konflikt(
            "idempotenz_in_arbeit",
            "Ein Aufruf mit diesem 'Idempotency-Key' läuft noch. "
            "Kurz warten und erneut versuchen.",
        )
    return {
        "status": int(zeile["response_status"]),
        "body": zeile.get("response_body") or {},
    }


def antwort_festhalten(
    db: Client,
    *,
    tenant_id: str,
    client_pk: str,
    key: str,
    status: int,
    body: dict[str, object],
) -> None:
    """Antwort zum Schlüssel ablegen, damit die Wiederholung sie erhält.

    Best effort: schlägt das Festhalten fehl, ist die Buchung trotzdem
    entstanden und der Client bekommt seine 201. Die Wiederholung landet dann
    im 409 „läuft noch" statt in einer Doppelbuchung — das ist die richtige
    Richtung, wenn etwas schiefgeht (fail-closed, Wurzel 5).
    """
    try:
        db.table("public_api_idempotency").update(
            {"response_status": status, "response_body": body}
        ).eq("tenant_id", tenant_id).eq("api_client_id", client_pk).eq(
            "idempotency_key", key
        ).execute()
    except Exception:  # noqa: BLE001 — best effort, Hauptpfad ist schon fertig
        log.warning("idempotenz_antwort_nicht_gespeichert", key=key[:12])
