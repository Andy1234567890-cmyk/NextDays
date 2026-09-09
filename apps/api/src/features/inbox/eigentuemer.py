"""Eigentümer-Chat als gleichwertige Posteingang-Threads (0611).

WOZU: Zwischen Eigentümer und Verwaltung gab es keinen Nachrichtenweg im
System. Absprachen liefen über privates WhatsApp oder Telefon — ohne Bezug zum
Objekt, für Vertretungen unsichtbar, beim Personalwechsel verloren.

Für den Betrieb ist der Posteingang EIN Posteingang: er fragt „was liegt an",
nicht „aus welcher Tabelle kommt das". Ein eigener Bereich neben dem Postfach
hieße, dass eine unbeantwortete Eigentümerfrage genau dort liegt, wo niemand
routinemäßig hinsieht.

WAS HIER NICHT PASSIERT — gleiches Prinzip wie `marktplatz.py`/`uebernahme.py`:
Es wird KEINE Zeile nach `channex_booking` geschrieben. Dessen
`channex_booking_id` ist NOT NULL + unique; dort hineinzukommen hieße, eine
Channex-ID für ein Gespräch zu erfinden, das nie über Channex lief (Wurzel 4).
Gelesen wird aus `owner_threads`/`owner_messages` und in die `InboxThread`-Form
gebracht, die der Posteingang ohnehin spricht.

DER FADEN HÄNGT AM OBJEKT, nicht am Eigentümer (0611): `owner_properties` ist
n:m (Miteigentümer, 0601). Alle Miteigentümer eines Hauses lesen denselben
Verlauf; WER geschrieben hat, steht an der Nachricht (`sender_name`).

ZEITSTEMPEL (Wurzel 5b): `sent_at` ist hier zu Recht unsere Uhr — die Nachricht
ENTSTEHT in diesem System, wenn der Absender sie abschickt. Anders als bei
einem OTA-Feed, wo `created_at` nur unseren Abrufzeitpunkt beschreibt.
"""
from __future__ import annotations

from typing import Final

from supabase import Client

from src.core.logging import get_logger

from .errors import InboxError
from .schemas import InboxMessage, InboxMessagesResponse, InboxThread

log = get_logger(__name__)

# Stabiler ID-Präfix, damit ein Eigentümer-Thread von einem OTA-Thread
# unterscheidbar bleibt — im Router (welcher Lesepfad?) wie in der Oberfläche.
# Gleiches Prinzip wie `mb:` (Marktplatz), `ue:` (Übernahme), `wa:` (WhatsApp).
PREFIX: Final = "eig:"

# Das Kürzel, unter dem der Eigentümer-Chat in der Liste erscheint.
#
# SPRACHNEUTRAL, kein fertiges Wort: Der Server kennt die Sprache des
# Betrachters nicht (dieselbe Regel wie bei `[bild]` und den Event-Kürzeln in
# `schemas.py`). Stünde hier „Eigentümer", läse ein dänischer Betrieb das
# deutsche Wort — genau der Fehler, den `deutsche-restwerte-pruefen.mjs`
# projektweit jagt.
#
# BEWUSST KEIN Eintrag im Kanal-Enum (`calendar.channel.*`, fünf Stellen,
# `kanal-enums-pruefen.mjs`): Der Eigentümer-Chat ist KEIN Vertriebskanal.
# Ihn dort einzutragen hieße, ihn im Kalender, in der Auswertung und in den
# Kanal-Filtern als Buchungsquelle zu führen, die er nicht ist.
#
# Die Anzeige ist trotzdem sicher: `channelLabelLoose` gibt einen unbekannten
# Wert unverändert zurück (`?? name`) und `kanalAbzeichen` fällt auf ein
# neutrales Symbol zurück — es entsteht also KEIN falsches Portal-Logo (der
# Fehler, bei dem eine Expedia-Buchung wie myBestDays aussah).
KANAL: Final = "[eigentuemer]"

# Wurzel 8: harte Obergrenzen, wie in `marktplatz.py`/`uebernahme.py`.
MAX_THREADS: Final = 200
MAX_NACHRICHTEN: Final = 500


def ist_eigentuemer_thread(thread_id: str) -> bool:
    return thread_id.startswith(PREFIX)


def thread_aus_id(thread_id: str) -> str:
    """`eig:<uuid>` → die `owner_threads.id`."""
    return thread_id[len(PREFIX) :]


# KEINE Vorschau-Funktion — mit Absicht (ADR-0029). `body` trägt Chiffretext;
# ihn zu kürzen ergäbe eine sinnlose Zeichenfolge in der Liste. Die Oberfläche
# zeigt stattdessen ein Kürzel („neue Nachricht"), das sie selbst übersetzt.
# Wer hier je eine Vorschau einbaut, hat entweder den Chiffretext ausgegeben
# oder die Verschlüsselung aufgehoben.


def _letzte_nachrichten(db: Client, thread_ids: list[str]) -> dict[str, dict]:
    """Je Thread die jüngste Nachricht (Absender + Anhang-Kennzeichen)."""
    if not thread_ids:
        return {}
    # KEIN gemeinsames Limit über alle Threads (bis 09.09.2026 stand hier
    # `.limit(MAX_NACHRICHTEN)`): Ein einziger aktiver Thread mit 500+
    # Nachrichten füllte es allein aus, und für JEDEN anderen Thread blieb
    # `neueste` leer. Folge: `last_sender` wurde None, und `_ungelesen`
    # übersprang den Thread — eine unbeantwortete Eigentümerfrage verschwand
    # still aus der Ungelesen-Anzeige, also genau dort, wo dieses Modul sie
    # hinbringen soll (Wurzel 5).
    #
    # Stattdessen je Thread nur die JÜNGSTE Zeile. Das sind bis zu
    # MAX_THREADS Abfragen — der Preis für eine Liste, die stimmt. Sinkt die
    # Antwortzeit spürbar, gehört hier eine RPC mit `distinct on (thread_id)`
    # hin, kein größeres Limit: das verschöbe den Fehler nur.
    neueste: dict[str, dict] = {}
    for tid in thread_ids:
        treffer = (
            db.table("owner_messages")
            .select("thread_id, body, sender, sent_at, attachments")
            .eq("thread_id", tid)
            .order("sent_at", desc=True)
            .limit(1)
            .execute()
        ).data or []
        if treffer:
            neueste[str(tid)] = treffer[0]
    return neueste


def _ungelesen(zeilen: list[dict], neueste: dict[str, dict]) -> set[str]:
    """Threads mit einer Eigentümer-Nachricht neuer als `agency_read_at`.

    Aus den bereits geladenen Daten gerechnet statt per Zusatzabfrage: beide
    Werte liegen vor, eine weitere Runde je Thread wäre reine Last.
    """
    offen: set[str] = set()
    for z in zeilen:
        tid = str(z["id"])
        letzte = neueste.get(tid)
        if not letzte or letzte.get("sender") != "owner":
            continue
        gelesen = z.get("agency_read_at")
        if not gelesen or str(letzte.get("sent_at") or "") > str(gelesen):
            offen.add(tid)
    return offen


def _objekt_namen(db: Client, property_ids: list[str]) -> dict[str, str]:
    """Objekt-Titel je id — die Liste zeigt das Haus, nicht seine UUID."""
    if not property_ids:
        return {}
    zeilen = (
        db.table("properties")
        .select("id, title")
        .in_("id", property_ids)
        .execute()
    ).data or []
    return {str(z["id"]): str(z.get("title") or "") for z in zeilen}


def _eigentuemer_namen(db: Client, property_ids: list[str]) -> dict[str, str]:
    """Namen der Eigentümer je Objekt, kommasepariert.

    Ein Objekt kann MEHRERE Eigentümer haben (`owner_properties`, 0601) — die
    Liste nennt sie alle, sonst führte die Anzeige eines einzelnen Namens bei
    einem geteilten Haus in die Irre.
    """
    if not property_ids:
        return {}
    zuordnung = (
        db.table("owner_properties")
        .select("property_id, owner_id")
        .in_("property_id", property_ids)
        .execute()
    ).data or []
    owner_ids = sorted({str(z["owner_id"]) for z in zuordnung})
    if not owner_ids:
        return {}
    besitzer = (
        db.table("owners")
        .select("id, name")
        .in_("id", owner_ids)
        .execute()
    ).data or []
    name_je_id = {str(z["id"]): str(z.get("name") or "") for z in besitzer}
    je_objekt: dict[str, list[str]] = {}
    for z in zuordnung:
        pid = str(z["property_id"])
        name = name_je_id.get(str(z["owner_id"]), "")
        if name:
            je_objekt.setdefault(pid, []).append(name)
    return {pid: ", ".join(sorted(namen)) for pid, namen in je_objekt.items()}


def verlauf_antwort(
    db: Client, tenant_id: str, thread_id: str
) -> InboxMessagesResponse:
    """Nachrichtenverlauf EINES Eigentümer-Threads, chronologisch.

    Der Thread wird per (id, tenant_id) geladen — Load und Scope bleiben
    zusammen (Wurzel 3).
    """
    roh_id = thread_aus_id(thread_id)
    treffer = (
        db.table("owner_threads")
        .select("id")
        .eq("id", roh_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not treffer:
        raise InboxError("Thread nicht gefunden.", status_code=404)

    zeilen = (
        db.table("owner_messages")
        .select("id, sender, sender_name, body, attachments, sent_at")
        .eq("thread_id", roh_id)
        .eq("tenant_id", tenant_id)
        .order("sent_at")
        .limit(MAX_NACHRICHTEN)
        .execute()
    ).data or []

    # `message` trägt den CHIFFRETEXT unverändert weiter — die Entschlüsselung
    # passiert im Client, nicht hier (ADR-0029). Der Server reicht durch, was
    # er nicht lesen kann.
    nachrichten = [
        InboxMessage(
            id=str(z["id"]),
            message=str(z.get("body") or ""),
            # Der Posteingang kennt "guest" und "property" als Seiten. Der
            # Eigentümer nimmt hier die Gegenseite ein ("guest"), die Agentur
            # unsere ("property") — so richtet die vorhandene Oberfläche die
            # Blasen ohne Sonderfall aus.
            sender="guest" if z.get("sender") == "owner" else "property",
            sent_at=str(z.get("sent_at") or "") or None,
            author_name=str(z.get("sender_name") or "") or None,
            attachments=_anhang_pfade(z.get("attachments")),
        )
        for z in zeilen
    ]
    return InboxMessagesResponse(messages=nachrichten)


def _anhang_pfade(roh: object) -> list[str]:
    """Bildpfade aus der jsonb-Spalte, defensiv.

    Der Wert ist Client-Input zweiter Ordnung: er wurde beim Upload geprüft,
    steht aber in einer freien jsonb-Spalte. Nur Zeichenketten passieren
    (Wurzel 8) — die signierte Adresse baut der Router, nicht diese Zeile.
    """
    if not isinstance(roh, list):
        return []
    return [p for p in roh if isinstance(p, str) and p]


def threads_lesen(db: Client, tenant_id: str) -> list[InboxThread]:
    """Alle Eigentümer-Threads des Mandanten in Posteingang-Form."""
    zeilen = (
        db.table("owner_threads")
        .select("id, property_id, last_message_at, agency_read_at")
        .eq("tenant_id", tenant_id)
        .order("last_message_at", desc=True)
        .limit(MAX_THREADS)
        .execute()
    ).data or []
    if not zeilen:
        return []

    # Zeilen ohne die Pflichtfelder werden ÜBERSPRUNGEN, nicht ergänzt: ein
    # erfundener Objektbezug wäre eine Falschaussage (Wurzel 4). Der harte
    # Zugriff `z["property_id"]` warf hier einen KeyError — und der riss nicht
    # nur diesen Thread, sondern den GANZEN Posteingang mit sich, weil diese
    # Quelle in `list_threads` eingemischt wird. Ein defekter Datensatz darf
    # eine Liste nicht leeren (Wurzel 5).
    brauchbar = [z for z in zeilen if z.get("id") and z.get("property_id")]
    if len(brauchbar) != len(zeilen):
        log.warning(
            "owner_chat_thread_ohne_objektbezug",
            extra={"tenant_id": tenant_id, "anzahl": len(zeilen) - len(brauchbar)},
        )
    zeilen = brauchbar
    if not zeilen:
        return []

    ids = [str(z["id"]) for z in zeilen]
    property_ids = sorted({str(z["property_id"]) for z in zeilen})
    neueste = _letzte_nachrichten(db, ids)
    offen = _ungelesen(zeilen, neueste)
    titel = _objekt_namen(db, property_ids)
    besitzer = _eigentuemer_namen(db, property_ids)

    threads: list[InboxThread] = []
    for z in zeilen:
        tid = str(z["id"])
        pid = str(z["property_id"])
        letzte = neueste.get(tid) or {}
        anhaenge = len(_anhang_pfade(letzte.get("attachments")))
        threads.append(
            InboxThread(
                id=f"{PREFIX}{tid}",
                property_id=pid,
                property_title=titel.get(pid) or None,
                ota_name=KANAL,
                # Im Namensfeld steht, mit WEM die Agentur spricht. Bei einem
                # geteilten Haus sind das mehrere Menschen.
                guest_name=besitzer.get(pid) or None,
                # Der Server kann den Inhalt nicht lesen (ADR-0029). Statt
                # eines Textes steht hier ein Kürzel, das die Oberfläche in
                # ihrer Sprache ausschreibt — nie der Chiffretext.
                last_message=("[e2e_bild]" if anhaenge else "[e2e]")
                if letzte
                else None,
                last_sender=(
                    "guest" if letzte.get("sender") == "owner" else "property"
                )
                if letzte
                else None,
                letzte_aktivitaet=str(z.get("last_message_at") or "") or None,
                updated_at=str(z.get("last_message_at") or "") or None,
                is_read=tid not in offen,
            )
        )
    return threads
