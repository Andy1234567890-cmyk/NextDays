"""Airbnb-Anfragen als vollwertige Posteingang-Threads (0398).

WOZU DIESES MODUL:
Airbnb schickt drei handlungspflichtige Anfragen, die KEINE Buchung sind
(`inquiry`, `reservation_request`, `alteration_request`). Der komplette
Antwortweg dafür ist gebaut — Bauhelfer (`channel_manager.airbnb_anfragen`),
Service (`ota_extras.airbnb_anfrage_beantworten`) und Route
(`POST channel-manager/events/{id}/airbnb-antwort`).

Nur SEHEN konnte der Betrieb sie nicht, und das aus zwei getrennten Gründen:

1. Der Posteingang leitet seine Threads aus `channex_booking` ab. Eine Anfrage
   hat dort keine Zeile — es gibt ja noch keine Buchung. Der Chat des Gastes
   landete zwar in `portal_messages` (`booking_ref` ist genau dafür nullable,
   0293), aber KEIN Thread zeigte ihn.
2. Die Ereignisliste (`/channels/ereignisse`) kannte die Anfrage, hatte aber
   keinen Chat — und keinen einzigen Aktionsknopf.

Live nachgemessen am 18.08.2026: 28 Nachrichten in 4 Threads ohne `booking_ref`
waren im PMS unsichtbar. Die Gastgeberin hat die Sauna-Frage einer Voranfrage
in der Channex-Oberfläche beantwortet, weil unser Posteingang sie nicht zeigte.

DIE KLAMMER ZWISCHEN ANFRAGE UND CHAT — gemessen, nicht angenommen:
`channex_webhook_event.payload.message_thread_id` ist derselbe Wert wie
`portal_messages.thread_ref`. Über ihn hängt der Verlauf an der Anfrage; ohne
ihn gibt es keinen Chat, aber die Anfrage bleibt trotzdem beantwortbar.

WAS HIER NICHT PASSIERT (gleiches Prinzip wie `marktplatz.py`/`uebernahme.py`):
Es wird nichts nach `channex_booking` geschrieben. `channex_booking_id` ist dort
NOT NULL + unique — für eine Anfrage müsste man eine Channex-Buchungs-ID
erfinden (Wurzel 4). Gelesen wird aus dem Ereignis-Journal, geformt wird in die
`InboxThread`-Form, die der Posteingang ohnehin spricht.

ZEITSTEMPEL (Wurzel 5b): Die Anfrage-Payload trägt KEINEN eigenen Zeitpunkt der
Gasthandlung. `channex_webhook_event.created_at` ist UNSERE Schreibzeit und
taugt dafür nicht. Der echte Zeitpunkt steht in der ersten Gastnachricht des
Threads (`portal_messages.sent_at`, beim Portal entstanden) — deshalb sortiert
dieses Modul danach. Fehlt der Chat, bleibt `letzte_aktivitaet` LEER, statt die
eigene Uhr als fremdes Ereignis auszugeben.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Final

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.channel_manager.channex_client import ChannexClient
from src.features.channel_manager.common import ota_zeitstempel_utc

from .errors import InboxError
from .schemas import (
    AnfrageDetail,
    AnfrageEntscheidung,
    InboxEventFact,
    InboxMessage,
    InboxMessagesResponse,
    InboxThread,
)

log = get_logger(__name__)

# Stabiler ID-Präfix wie `mb:` (Marktplatz) und `ue:` (Übernahme). Dahinter
# steht die `channex_webhook_event.id` — nicht die Live-Feed-ID: der Antwortweg
# adressiert das Ereignis in UNSERER Tabelle, und nur die ist tenant-gescopt.
PREFIX: Final = "anfrage:"

# Die drei Anfragearten. Bewusst hier gespiegelt statt aus dem channel_manager
# importiert: dieses Modul liest, jenes schreibt — ein Import quer durch zwei
# Slices für eine Menge von drei Zeichenketten koppelte beide ohne Not.
# Der Gleichlauf ist testgesichert (`test_anfragen.py`).
EVENT_INQUIRY: Final = "inquiry"
EVENT_RESERVATION_REQUEST: Final = "reservation_request"
EVENT_ALTERATION_REQUEST: Final = "alteration_request"

ANFRAGE_EVENTS: Final[frozenset[str]] = frozenset(
    {EVENT_INQUIRY, EVENT_RESERVATION_REQUEST, EVENT_ALTERATION_REQUEST}
)

# Welche Aktion zu welcher Anfrageart gehört — die Leseseite dessen, was
# `channel_manager.airbnb_anfragen.AKTION_ZU_EVENT` beim Senden erzwingt.
# Sie steht hier, damit die Oberfläche nur Knöpfe zeigt, die der Service auch
# annimmt: eine Voranfrage kennt kein „annehmen" (dafür gibt es sie noch nicht),
# ein Änderungswunsch keinen Sonderpreis. Der Gleichlauf beider Tabellen ist
# testgesichert — würden sie auseinanderlaufen, böte die Oberfläche eine Aktion
# an, die der Service mit 422 abweist.
AKTIONEN_JE_ART: Final[dict[str, frozenset[str]]] = {
    EVENT_RESERVATION_REQUEST: frozenset({"annehmen", "ablehnen"}),
    EVENT_INQUIRY: frozenset({"vorab_genehmigen", "sonderpreis"}),
    EVENT_ALTERATION_REQUEST: frozenset(
        {"alteration_annehmen", "alteration_ablehnen", "alteration_zuruecknehmen"}
    ),
}

# Wurzel 8: harte Obergrenzen wie in den anderen Nebenquellen.
MAX_THREADS: Final = 200
MAX_NACHRICHTEN: Final = 500

# Groesste Seite, die die Channex-Messages-Collection annimmt (live gemessen:
# 101 => 422). Ein Anfrage-Thread hat wenige Nachrichten; mehr als eine Seite
# kam nie vor.
_PORTAL_SEITE: Final = 100

# Der Kanal, unter dem eine Anfrage in der Liste steht. Alle drei Arten kommen
# ausschliesslich von Airbnb (Channex' Live-Feed führt sie unter „Airbnb
# events"), deshalb ist der Name hier keine Erfindung, sondern der Kanal selbst.
KANAL: Final = "Airbnb"

# Absender aus dem Spiegel → Absender-Begriff des Posteingangs. `system` trägt
# die Portal-Hinweise im Anfrage-Thread und ist deshalb ein Ereignis, keine
# Gastnachricht (sonst gälte der Thread als unbeantwortet).
_SENDER: Final[dict[str, str]] = {
    "guest": "guest",
    "property": "property",
    "system": "event",
}


def ist_anfrage(thread_id: str) -> bool:
    return thread_id.startswith(PREFIX)


def event_id_aus(thread_id: str) -> str:
    """Die `channex_webhook_event.id` hinter der Thread-ID."""
    return thread_id[len(PREFIX):]


def thread_id_fuer(event_id: str) -> str:
    return f"{PREFIX}{event_id}"


def _text(wert: object) -> str | None:
    if not isinstance(wert, str):
        return None
    geputzt = wert.strip()
    return geputzt or None


def details_aus(payload: dict[str, Any] | None) -> dict[str, Any]:
    """Die `booking_details` — egal in welcher der beiden Payload-Formen.

    ZWEI FORMEN, EIN ZUGRIFF: Dasselbe Ereignis kommt auf zwei Wegen herein und
    liegt deshalb zweimal unterschiedlich verpackt in der Tabelle (live
    nachgemessen am 18.08.2026, beide Zeilen zur selben Anfrage):

      Webhook     {"event": "inquiry", "payload": {"booking_details": {…}}}
      Live-Feed   {"booking_details": {…}}                    (schon ausgepackt)

    Beide Formen hier aufzulösen ist billiger, als sie jeder Anzeigestelle
    zuzumuten — dieselbe Entscheidung wie in `nachrichten_eingang.payload_aus`.
    """
    if not isinstance(payload, dict):
        return {}
    innen = payload.get("payload")
    quelle = innen if isinstance(innen, dict) else payload
    details = quelle.get("booking_details")
    return details if isinstance(details, dict) else {}


def _kern(payload: dict[str, Any] | None) -> dict[str, Any]:
    """Die Ebene, auf der `message_thread_id`/`live_feed_event_id` stehen."""
    if not isinstance(payload, dict):
        return {}
    innen = payload.get("payload")
    return innen if isinstance(innen, dict) else payload


def thread_ref_aus(payload: dict[str, Any] | None) -> str | None:
    """Die Klammer zum Chat (`portal_messages.thread_ref`)."""
    return _text(_kern(payload).get("message_thread_id"))


def live_feed_id_aus(
    payload: dict[str, Any] | None, spalte: str | None = None
) -> str | None:
    """Die Channex-Ereignis-ID — Spalte zuerst, sonst aus dem Payload.

    WARUM BEIDES: `_require_airbnb_anfrage` verlangt die ID, um bei Airbnb zu
    antworten, und liest dafür die SPALTE `live_feed_event_id`. Die füllt aber
    nur der Live-Feed-Tick; die Webhook-Zeile derselben Anfrage lässt sie leer,
    obwohl der Wert in ihrem Payload steht (live geprüft: die Webhook-Zeile der
    Lisa-Anfrage trug die Spalte leer, `payload.live_feed_event_id` aber
    gefüllt). Ohne diesen Rückgriff zeigte die Oberfläche an der einen von zwei
    Zeilen derselben Anfrage einen toten Knopf.

    Kein erfundener Ersatzwert (Wurzel 4): ist beides leer, bleibt es `None`
    und die Anfrage gilt als nicht beantwortbar.
    """
    return _text(spalte) or _text(_kern(payload).get("live_feed_event_id"))


def frist_aus(payload: dict[str, Any] | None) -> str | None:
    """Bis wann Airbnb eine Antwort erwartet (`non_response_at`).

    DER WERT IST ECHT UND KOMMT VON AIRBNB — live gemessen (18.08.2026):
    `booking_details.non_response_at = "2026-08-18T18:57:40.719Z"` bei einer
    Anfrage von 18:57:41 des Vortages, also exakt 24 Stunden. Er ist damit die
    einzige zulässige Quelle für den Countdown: „created_at + 24 h" wäre
    unsere Uhr plus eine Faustregel und läge daneben, sobald Airbnb die Frist
    einmal anders setzt (Wurzel 5b).

    Fehlt er, gibt es keinen Countdown — die Oberfläche zeigt dann nichts statt
    einer geratenen Frist.
    """
    return _text(details_aus(payload).get("non_response_at"))


def _juengster(*werte: str | None) -> str | None:
    """Der jüngste von mehreren Zeitpunkten — `None`, wenn keiner da ist.

    Verglichen wird der ZEITPUNKT, nicht die Zeichenkette. Die Quellen hier
    schreiben dieselbe Sekunde unterschiedlich (`…+00:00` aus PostgREST, `…Z`
    aus `ota_zeitstempel_utc`), und im Zeichenvergleich ist „Z" > „+" — ein
    `max()` über die Strings kehrte die Reihenfolge genau dann um, wenn die
    Formate gemischt auftreten. Dieselbe Falle steht in
    `service._als_zeitpunkt` beschrieben; hier ist sie ohne Import auf die
    beiden Fälle dieses Moduls beschränkt.
    """
    vorhanden = [w for w in werte if w]
    if not vorhanden:
        return None

    def als_zeitpunkt(wert: str) -> datetime:
        try:
            gelesen = datetime.fromisoformat(wert.replace("Z", "+00:00"))
        except ValueError:
            return datetime.min.replace(tzinfo=UTC)
        return gelesen if gelesen.tzinfo else gelesen.replace(tzinfo=UTC)

    return max(vorhanden, key=als_zeitpunkt)


def gasthandlung_aus(payload: dict[str, Any] | None) -> str | None:
    """WANN der Gast diese Anfrage beim Portal gestellt hat — nie unsere Uhr.

    WARUM DAS EIN EIGENER GRIFF IST: Ohne ihn hing der Zeitpunkt einer Anfrage
    ALLEIN am Chat (`portal_messages.sent_at`). Ein Änderungswunsch bringt aber
    gar keine Chat-Nachricht mit — der Gast klickt in der Airbnb-App auf
    „Änderung anfragen", er schreibt nichts. Damit blieb `letzte_aktivitaet`
    leer, und weil zeitlose Threads ans ENDE einer absteigenden Sortierung
    fallen, stand die dringendste Anfrage im Posteingang ganz unten.

    Live passiert (19.08.2026): Lars Larsson bat für „Feriehus Britt" um
    1 → 8 Personen. Die Gastgeberin suchte die Anfrage im Posteingang, fand sie
    nicht und bestätigte sie direkt bei Airbnb; erst danach entdeckte sie sie
    als letzten Eintrag der Liste. Die Anfrage lief also am PMS vorbei, obwohl
    sie darin die ganze Zeit vorhanden war.

    DAS FELD IST GEMESSEN, NICHT GERATEN (dieselbe Anfrage, beide
    Payload-Formen): `bms.raw_message.reservation.updated_at` trug
    `2026-08-18T19:51:50.218Z` — Airbnbs Zeitpunkt der ÄNDERUNG. Daneben steht
    `booked_at` (19:31:29Z), der Zeitpunkt der ursprünglichen Buchung; er ist
    der Rückfall, wenn Airbnb kein `updated_at` mitschickt. Beide sind
    Fremdereignisse und damit zulässig (Wurzel 5b).

    Bewusst NICHT `payload.timestamp` (2026-08-18T19:52:00Z): das ist Channex'
    Eingang, zehn Sekunden nach Airbnbs Ereignis — der Aggregator ist keine
    Quelle für den Zeitpunkt einer Gasthandlung. Ebenso nicht unser
    `created_at`.

    Eine Voranfrage trägt keines dieser Felder (live geprüft: alle leer). Dort
    bleibt es bei `None` — ihren Zeitpunkt liefert die erste Gastnachricht, die
    es bei ihr immer gibt.
    """
    reservierung = _kern(payload).get("bms")
    if not isinstance(reservierung, dict):
        return None
    roh = reservierung.get("raw_message")
    if not isinstance(roh, dict):
        return None
    innen = roh.get("reservation")
    if not isinstance(innen, dict):
        return None
    # `updated_at` zuerst: bei einem Änderungswunsch ist die ÄNDERUNG das
    # Ereignis, nicht die Buchung, die geändert wird.
    for feld in ("updated_at", "booked_at"):
        wert = ota_zeitstempel_utc(innen.get(feld))
        if wert:
            return wert
    return None


def _gastname(details: dict[str, Any]) -> str | None:
    return _text(details.get("guest_name"))


def _betrag(details: dict[str, Any]) -> tuple[str | None, str | None]:
    """(Betrag, Währung) der Anfrage.

    `payout_amount` ist bei Airbnb der NETTO-Auszahlbetrag, nicht der Gastpreis
    — deshalb trägt die Fakten-Zeile ein eigenes Kürzel (`anfragePayout`) und
    nicht das allgemeine „Preis". Die Währung kommt aus der Payload, nie aus
    einer Annahme (Wurzel 4): fehlt sie, wird der Betrag ohne Symbol gezeigt.
    """
    return _text(details.get("payout_amount")), _text(details.get("currency"))


def _fakten(event: str, details: dict[str, Any], frist: str | None) -> list[InboxEventFact]:
    """Die Angaben der Anfrage als Kürzel/Wert-Paare.

    Die Worte macht die Oberfläche (24 Sprachen) — hier stehen nur Kürzel und
    Rohwerte, wie bei den übrigen Ereignissen im Verlauf.
    """
    fakten: list[InboxEventFact] = [InboxEventFact(label="anfrageArt", value=event)]
    betrag, waehrung = _betrag(details)

    paare: list[tuple[str, str | None]] = [
        ("anfrageObjekt", _text(details.get("listing_name"))),
        ("anfrageAnreise", _text(details.get("checkin_date"))),
        ("anfrageAbreise", _text(details.get("checkout_date"))),
        ("anfrageNaechte", _zahl(details.get("nights"))),
        ("anfrageGaeste", _zahl(details.get("number_of_guests"))),
        ("anfrageErwachsene", _zahl(details.get("number_of_adults"))),
        ("anfrageKinder", _zahl(details.get("number_of_children"))),
        ("anfrageKleinkinder", _zahl(details.get("number_of_infants"))),
        ("anfrageTiere", _zahl(details.get("number_of_pets"))),
        ("anfragePayout", betrag),
        ("anfrageWaehrung", waehrung),
        ("anfrageFrist", frist),
    ]
    fakten.extend(
        InboxEventFact(label=label, value=wert) for label, wert in paare if wert
    )
    return fakten


def _zahl(wert: object) -> str | None:
    """Zahlenwerte als Text — 0 ist eine Aussage, `None` nicht.

    `bool` ist in Python ein `int`; ohne die Abweisung würde aus `True` eine
    „1 Kinder"-Zeile.
    """
    if isinstance(wert, bool) or not isinstance(wert, int):
        return None
    return str(wert)


def _anfrage_zeilen(db: Client, tenant_id: str) -> list[dict[str, Any]]:
    """Offene Anfragen des Tenants (Wurzel 3: gescopt geladen).

    Nur `resolved = false`: eine beantwortete Anfrage ist entweder zur Buchung
    geworden (dann hat sie einen eigenen Thread) oder abgelehnt. Sie weiter als
    offenen Thread zu führen, forderte eine Antwort auf etwas Erledigtes.
    """
    try:
        return (
            db.table("channex_webhook_event")
            .select(
                "id, event, payload, created_at, property_id, "
                "live_feed_event_id, resolved"
            )
            .eq("tenant_id", tenant_id)
            .in_("event", sorted(ANFRAGE_EVENTS))
            .eq("resolved", False)
            .order("created_at", desc=True)
            .limit(MAX_THREADS)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — der Posteingang darf nie kippen
        log.warning("anfragen_threads_lesen_fehlgeschlagen", error=str(exc)[:200])
        return []


def _entdoppelt(zeilen: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Dieselbe Anfrage genau einmal (Wurzel 2 — real kommt alles doppelt).

    Webhook und Live-Feed-Tick schreiben BEIDE eine Zeile für dasselbe
    Ereignis; der UNIQUE-Index greift nicht, weil er auf `live_feed_event_id`
    liegt und die Webhook-Zeile sie leer lässt. Live nachgemessen: die
    Lisa-Anfrage stand zweimal in der Tabelle, vier Minuten auseinander.
    Ungefiltert stünde sie zweimal im Posteingang — mit zwei Knöpfen, von denen
    einer nach dem Klick auf den anderen 409 wirft.

    Zusammengefasst wird über die Channex-Ereignis-ID (die einzige ID, die
    beide Zeilen kennen). BEVORZUGT wird die Zeile mit gefüllter SPALTE: nur
    sie besteht die Prüfung in `_require_airbnb_anfrage`. Ist keine gefüllt,
    gewinnt die erste — dann trägt der Thread `beantwortbar = false` und die
    Oberfläche zeigt statt eines toten Knopfes den Grund.
    """
    beste: dict[str, dict[str, Any]] = {}
    for zeile in zeilen:
        live_id = live_feed_id_aus(zeile.get("payload"), zeile.get("live_feed_event_id"))
        # Ohne Channex-ID gibt es keinen gemeinsamen Schlüssel — solche Zeilen
        # (Altbestand vor 0284) bleiben je für sich stehen.
        schluessel = live_id or f"row:{zeile['id']}"
        vorhanden = beste.get(schluessel)
        if vorhanden is None or (
            not _text(vorhanden.get("live_feed_event_id"))
            and _text(zeile.get("live_feed_event_id"))
        ):
            beste[schluessel] = zeile
    return list(beste.values())


def _chat_stand(
    db: Client, tenant_id: str, thread_refs: list[str]
) -> dict[str, dict[str, Any]]:
    """Je Thread: erste Gastnachricht, letzte Nachricht, Absender.

    EIN Query für die ganze Liste, nicht einer je Thread — bei 200 Anfragen
    wären es sonst 200 Abfragen.
    """
    refs = sorted({r for r in thread_refs if r})
    if not refs:
        return {}
    try:
        zeilen = (
            db.table("portal_messages")
            .select("thread_ref, sender, body, sent_at")
            .eq("tenant_id", tenant_id)
            .in_("thread_ref", refs)
            .order("sent_at", desc=False)
            .limit(MAX_NACHRICHTEN)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — ohne Chat bleibt die Anfrage sichtbar
        log.warning("anfragen_chat_lesen_fehlgeschlagen", error=str(exc)[:200])
        return {}

    stand: dict[str, dict[str, Any]] = {}
    for zeile in zeilen:  # aufsteigend → letzte Zuweisung gewinnt
        ref = zeile.get("thread_ref")
        if not ref:
            continue
        eintrag = stand.setdefault(str(ref), {"erste_gast": None, "letzte": None})
        if zeile.get("sender") == "guest" and eintrag["erste_gast"] is None:
            eintrag["erste_gast"] = zeile.get("sent_at")
        eintrag["letzte"] = zeile
    return stand


def _property_titel(
    db: Client, tenant_id: str, property_ids: list[str]
) -> dict[str, str]:
    """Objekt-Titel je `properties.id` — gescopt (Wurzel 3)."""
    ids = sorted({p for p in property_ids if p})
    if not ids:
        return {}
    try:
        zeilen = (
            db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — der Titel ist Beiwerk
        log.warning("anfragen_objekt_lesen_fehlgeschlagen", error=str(exc)[:200])
        return {}
    return {str(z["id"]): z["title"] for z in zeilen if z.get("id") and z.get("title")}


def threads_lesen(db: Client, tenant_id: str) -> list[InboxThread]:
    """Offene Airbnb-Anfragen als Posteingang-Threads."""
    zeilen = _entdoppelt(_anfrage_zeilen(db, tenant_id))
    if not zeilen:
        return []

    refs = [thread_ref_aus(z.get("payload")) or "" for z in zeilen]
    stand = _chat_stand(db, tenant_id, refs)
    titel = _property_titel(db, tenant_id, [str(z.get("property_id") or "") for z in zeilen])

    items: list[InboxThread] = []
    for zeile in zeilen:
        payload = zeile.get("payload")
        details = details_aus(payload)
        ref = thread_ref_aus(payload)
        chat = stand.get(ref or "", {})
        letzte = chat.get("letzte") or {}
        prop_id = _text(zeile.get("property_id"))

        # Wurzel 5b: der Zeitpunkt kommt aus dem Chat ODER aus der
        # Anfrage-Payload — beides beim Portal entstanden, NIE aus `created_at`
        # (unsere Schreibzeit). Der jüngere von beiden gewinnt, denn beide sind
        # Ereignisse in DIESEM Thread: schreibt der Gast nach seinem
        # Änderungswunsch noch etwas, ist die Nachricht das Neuere; klickt er
        # nur auf „Änderung anfragen" (kein Chat), trägt die Payload den
        # Zeitpunkt allein. Vorher stand hier nur der Chat, weshalb ein
        # chatloser Änderungswunsch ohne jeden Zeitpunkt ans Listenende fiel —
        # s. `gasthandlung_aus`.
        letzte_aktivitaet = _juengster(
            _text(letzte.get("sent_at")),
            _text(chat.get("erste_gast")),
            gasthandlung_aus(payload),
        )

        items.append(
            InboxThread(
                id=thread_id_fuer(str(zeile["id"])),
                property_id=prop_id,
                property_title=titel.get(prop_id or ""),
                ota_name=KANAL,
                guest_name=_gastname(details),
                # Die Anfrage IST der Status — sie ist keine Buchung.
                status=str(zeile.get("event") or ""),
                arrival_date=_text(details.get("checkin_date")),
                departure_date=_text(details.get("checkout_date")),
                last_message=_text(letzte.get("body")),
                last_sender=_SENDER.get(str(letzte.get("sender") or ""), None),
                letzte_aktivitaet=letzte_aktivitaet,
                # Ungelesen, solange der Gast zuletzt geschrieben hat ODER es
                # noch gar keinen Chat gibt: eine offene Anfrage ohne jede
                # Reaktion ist das Gegenteil von „erledigt".
                is_read=letzte.get("sender") == "property",
                inbox_status="active",
            )
        )
    return items


def _portal_verlauf(
    client: ChannexClient | None, thread_ref: str
) -> list[dict[str, Any]] | None:
    """Den VOLLEN Verlauf beim Portal holen — `None`, wenn das nicht geht.

    WARUM DAS SEIN MUSS (live nachgemessen, 18.08.2026):
    Der Webhook-Payload trägt den Nachrichtentext NUR ANGESCHNITTEN. Gemessen
    an derselben Nachricht:

        Webhook  `message`: "Hallo , gibt es in dem Haus eine Sauna ?\nViele..."
        Portal   `message`: "Hallo , gibt es in dem Haus eine Sauna ?\nViele Grüße "

    Der Spiegel (`portal_messages`) speichert, was der Webhook liefert — also
    den Anschnitt. Er allein reicht für die Vorschauzeile einer Liste, NICHT
    für den Verlauf: der Gastgeber las „Viele..." und hätte den Rest nie
    gesehen. Der reguläre Posteingang hat dieses Problem nicht, weil er den
    Verlauf ohnehin live holt (`_portal_nachrichten`); der Anfrage-Thread
    braucht denselben Zug über die Thread-Collection.

    `None` heißt „Portal antwortet nicht" — dann trägt der Spiegel die
    Anzeige. Lieber ein angeschnittener Text als ein leerer Chat (Wurzel 5:
    der Nebenweg kippt den Hauptpfad nicht).
    """
    if client is None:
        return None
    try:
        # HARTE GRENZE DES PORTALS: 100. Channex weist alles darueber mit 422
        # ab („limit must be less than or equal to 100") — der Abruf fiel dann
        # auf den Spiegel zurueck und zeigte weiter den Webhook-Anschnitt.
        # `MAX_NACHRICHTEN` (500) ist UNSER Deckel fuer die eigene Abfrage und
        # taugt hier nicht.
        res = client.get_thread_messages(thread_ref, limit=_PORTAL_SEITE)
    except Exception as exc:  # noqa: BLE001 — der Spiegel faengt das auf
        log.warning(
            "anfrage_portal_verlauf_fehlgeschlagen",
            thread_ref=thread_ref, error=str(exc)[:200],
        )
        return None
    daten = (res or {}).get("data")
    return daten if isinstance(daten, list) else None


# Die Status-Werte, die Airbnb einer Anfrage geben kann. Bewusst eine
# GESCHLOSSENE Menge: ein unbekannter Wert wird gemeldet statt geraten — er
# wäre ein Hinweis auf neues Portal-Verhalten, das wir sehen wollen (Wurzel 4).
#
# `active` ist der einzige Zustand, in dem noch etwas zu entscheiden ist. Alle
# anderen bedeuten: der Vorgang ist beim Portal abgeschlossen, egal wie.
STATUS_AKTIV: Final = "active"
BEKANNTE_STATUS: Final[frozenset[str]] = frozenset(
    {STATUS_AKTIV, "accepted", "declined", "expired", "withdrawn", "cancelled"}
)


def portal_status_aus(roh: list[dict[str, Any]] | None) -> str | None:
    """Der AKTUELLE Anfrage-Status aus der System-Nachricht des Threads.

    WARUM NICHT AUS DEM LIVE-FEED-EREIGNIS (live nachgemessen, 18.08.2026):
    `channex_webhook_event.payload.status` ist der Stand bei EINGANG des
    Ereignisses und wird nie nachgezogen — er stand einen Tag nach der Antwort
    der Gastgeberin unverändert auf `"active"`. Ihn als aktuellen Zustand
    auszugeben, ist eine Falschaussage über ein fremdes System (Wurzel 5b).

    Die Channex-Doku (Messages Collection) nennt den richtigen Ort: „Inside
    Messages you will see special message with information about Inquiry" —
    eine SYSTEM-Nachricht im Thread, deren `meta.status` den Vorgang
    fortschreibt. Der Verlaufs-Abruf holt sie ohnehin mit; hier wird sie nur
    ausgewertet.

    Die JÜNGSTE gewinnt: der Vorgang kann mehrfach fortgeschrieben werden
    (aktiv → angenommen), und die letzte Aussage ist die gültige.

    `None` = keine System-Nachricht im Thread. Das ist der Normalfall, solange
    der Vorgang läuft — dann sagt das Portal (noch) nichts, und der Aufrufer
    fällt auf das zurück, was er selbst weiß.
    """
    if not roh:
        return None
    gefunden: list[tuple[str, str]] = []
    for eintrag in roh:
        attrs = eintrag.get("attributes") or {}
        meta = attrs.get("meta")
        if not isinstance(meta, dict):
            continue
        status = _text(meta.get("status"))
        if not status:
            continue
        wert = status.lower()
        if wert not in BEKANNTE_STATUS:
            # Nicht raten, aber auch nicht schlucken: ein neuer Wert gehört
            # gesehen, damit er hier eingetragen werden kann.
            log.info("anfrage_unbekannter_portal_status", status=wert)
            continue
        gefunden.append((_text(attrs.get("inserted_at")) or "", wert))
    if not gefunden:
        return None
    return max(gefunden, key=lambda x: x[0])[1]


def _portal_nachricht(roh: dict[str, Any]) -> InboxMessage | None:
    """Eine Portal-Zeile in die Verlaufsform — ohne Text und Zeit: verwerfen."""
    attrs = roh.get("attributes") or {}
    text = _text(attrs.get("message"))
    zeit = ota_zeitstempel_utc(attrs.get("inserted_at") or attrs.get("sent_at"))
    if not text or not zeit:
        return None
    return InboxMessage(
        id=_text(roh.get("id")),
        message=text,
        sender=_SENDER.get(str(attrs.get("sender") or ""), "guest"),
        sent_at=zeit,
    )


def verlauf_antwort(
    db: Client,
    tenant_id: str,
    thread_id: str,
    *,
    client: ChannexClient | None = None,
) -> InboxMessagesResponse:
    """Der Verlauf einer Anfrage: die Anfrage selbst plus der Chat.

    Die Anfrage steht als erstes Ereignis im Strang — genau wie ein
    Buchungseingang im regulären Thread. Ohne sie sähe der Gastgeber nur „gibt
    es eine Sauna?" und wüsste weder Datum noch Preis noch Frist.
    """
    event_id = event_id_aus(thread_id)
    try:
        zeilen = (
            db.table("channex_webhook_event")
            .select("id, event, payload, created_at, live_feed_event_id, resolved")
            .eq("id", event_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001
        log.warning("anfrage_verlauf_lesen_fehlgeschlagen", error=str(exc)[:200])
        zeilen = []
    if not zeilen:
        # Der Aufrufer wandelt `None`-Fälle in 404; hier ist die Zeile weg oder
        # gehört einem anderen Tenant — beides ist „nicht gefunden".
        return InboxMessagesResponse(items=[], total=0)

    zeile = zeilen[0]
    payload = zeile.get("payload")
    details = details_aus(payload)
    event = str(zeile.get("event") or "")
    frist = frist_aus(payload)

    # Die Anfrage als Ereignis. `sent_at` kommt aus der Payload (Airbnbs Uhr,
    # s. `gasthandlung_aus`) und bleibt LEER, wenn das Portal keinen Zeitpunkt
    # mitschickt — `created_at` ist unsere Uhr (Wurzel 5b). Der Wert entscheidet
    # hier auch die EINSORTIERUNG: `_chronologisch` schiebt zeitlose Einträge
    # ans Ende, ein Änderungswunsch ohne ihn stand also unter dem Chat, den er
    # ausgelöst hat.
    items: list[InboxMessage] = [
        InboxMessage(
            id=f"anfrage-{zeile['id']}",
            message="",
            sender="event",
            sent_at=gasthandlung_aus(payload),
            event_title=event,
            event_detail=_text(details.get("listing_name")),
            event_facts=_fakten(event, details, frist),
            event_channel=KANAL,
        )
    ]

    ref = thread_ref_aus(payload)
    if ref:
        # DAS PORTAL ZUERST: nur dort steht der VOLLSTÄNDIGE Text. Der Spiegel
        # trägt den Webhook-Anschnitt („…Viele...") und ist deshalb der
        # Rückfall, nicht die Quelle — genau umgekehrt wie bei einer Buchung,
        # wo beide Wege denselben Text liefern.
        verlauf: list[InboxMessage] = []
        roh = _portal_verlauf(client, ref)
        if roh is not None:
            verlauf = [
                m for m in (_portal_nachricht(r) for r in roh) if m is not None
            ]
        if not verlauf:
            verlauf = _spiegel_verlauf(db, tenant_id, ref)

        # Chronologisch: die Thread-Collection liefert das Neueste zuerst.
        verlauf.sort(key=lambda m: m.sent_at or "")

        # Der Anfrage-Zeitpunkt ist der der ersten Nachricht — dann steht das
        # Ereignis im Strang an der richtigen Stelle statt ganz ohne Zeit.
        if verlauf:
            items[0].sent_at = verlauf[0].sent_at
        items.extend(verlauf)

    return InboxMessagesResponse(items=items, total=len(items))


def _spiegel_verlauf(
    db: Client, tenant_id: str, thread_ref: str
) -> list[InboxMessage]:
    """Der lokale Spiegel als Rückfall, wenn das Portal nicht antwortet.

    Der Text ist hier der Webhook-Anschnitt — unvollständig, aber besser als
    ein leerer Chat.
    """
    try:
        zeilen = (
            db.table("portal_messages")
            .select("id, sender, body, sent_at")
            .eq("tenant_id", tenant_id)
            .eq("thread_ref", thread_ref)
            .order("sent_at", desc=False)
            .limit(MAX_NACHRICHTEN)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — die Anfrage bleibt lesbar
        log.warning("anfrage_chat_lesen_fehlgeschlagen", error=str(exc)[:200])
        return []
    return [
        InboxMessage(
            id=_text(z.get("id")),
            message=str(z.get("body") or ""),
            sender=_SENDER.get(str(z.get("sender") or ""), "guest"),
            sent_at=_text(z.get("sent_at")),
        )
        for z in zeilen
    ]


def antwort_senden(
    db: Client, tenant_id: str, thread_id: str, text: str,
    client: ChannexClient,
) -> InboxMessage:
    """Im Anfrage-Thread antworten (`POST message_threads/:id/messages`).

    WARUM EIN EIGENER SENDEWEG: `service.send_message` adressiert die Buchung
    (`bookings/:id/messages`) und weist einen Thread ohne
    `channex_booking_id` ausdrücklich mit 422 ab. Eine Anfrage HAT keine
    Buchung — der Chat hängt am Thread, nicht an ihr. Channex hat dafür einen
    zweiten Endpunkt, den der Client schon kennt; er ist der Weg, den auch die
    Channex-Oberfläche nimmt.

    Der Aufrufer hat die Sendeberechtigung bereits geprüft (`can_reply`) —
    diese Funktion prüft die Sachlage: gibt es überhaupt einen Chat, an den
    gesendet werden kann?
    """
    sauber = (text or "").strip()
    if not sauber:
        raise InboxError("Nachricht darf nicht leer sein.", status_code=422)

    event_id = event_id_aus(thread_id)
    zeilen = (
        db.table("channex_webhook_event")
        .select("id, payload")
        .eq("id", event_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise InboxError("Thread nicht gefunden.", status_code=404)

    ref = thread_ref_aus(zeilen[0].get("payload"))
    if not ref:
        # Kein erfundener Ersatz (Wurzel 4): ohne Channex-Thread gibt es keinen
        # Weg zum Gast. Der Grund gehört genannt, nicht als 404 verkleidet.
        raise InboxError(
            "Zu dieser Anfrage gibt es keinen Nachrichten-Thread beim Portal.",
            status_code=422,
        )

    res = client.send_thread_message(ref, sauber)
    data = (res or {}).get("data") or {}
    attrs = data.get("attributes") or {}

    gesendet = InboxMessage(
        id=_text(data.get("id")),
        message=sauber,
        sender="property",
        # Der Zeitpunkt kommt vom Portal, nie von unserer Uhr (Wurzel 5b).
        # Fehlt das Echo, bleibt das Feld leer — die Nachricht ist trotzdem raus.
        sent_at=_text(attrs.get("inserted_at")),
    )

    # Die eigene Antwort sofort spiegeln: sonst steht in der Thread-Liste
    # weiter die Gastnachricht, als hätte niemand geantwortet, und der Thread
    # gilt beim nächsten Laden erneut als ungelesen (Wurzel 1 — der
    # Gegenzustand gehört mitgepflegt).
    #
    # Nur mit echter ID UND echtem Zeitpunkt: `message_ref` ist der
    # Idempotenz-Schlüssel, und eine Zeile ohne `sent_at` wäre im Verlauf nicht
    # einsortierbar (`sent_at` ist NOT NULL). Ohne Echo übernimmt der
    # Eingangspfad die Zeile, wenn das Portal sie zurückspielt.
    if gesendet.id and gesendet.sent_at:
        try:
            db.table("portal_messages").upsert(
                {
                    "tenant_id": tenant_id,
                    "thread_ref": ref,
                    "booking_ref": None,
                    "message_ref": gesendet.id,
                    "sender": "property",
                    "body": sauber,
                    "sent_at": gesendet.sent_at,
                    "quelle": "manuell",
                },
                on_conflict="tenant_id,message_ref",
            ).execute()
        except Exception as exc:  # noqa: BLE001 — der Spiegel kippt den Chat nicht
            log.warning(
                "anfrage_antwort_spiegel_fehlgeschlagen",
                thread_ref=ref, error=str(exc)[:200],
            )

    return gesendet


def _selbst_geantwortet(
    db: Client, tenant_id: str, thread_ref: str | None
) -> bool:
    """Steht im Thread schon eine eigene Nachricht?

    Das ist die einzige VERLÄSSLICHE Auskunft darüber, ob der Vorgang bearbeitet
    ist: der Aggregator zieht den Anfrage-Status nicht nach (siehe
    `detail_lesen`), unser `resolved`-Flag kennt nur Antworten aus dieser
    Anwendung — eine Antwort, die in der Portal-App geschrieben wurde, steht
    aber im Verlauf.

    Fail-closed (Wurzel 5): kippt die Abfrage, gilt die Anfrage als NICHT
    beantwortet. Lieber eine Aktion zu viel anbieten (der Server weist sie ggf.
    ab) als eine wartende Anfrage stumm zu schalten.
    """
    if not thread_ref:
        return False
    try:
        treffer = (
            db.table("portal_messages")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("thread_ref", thread_ref)
            .eq("sender", "property")
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — fail-closed, s. Docstring
        log.warning("anfrage_eigene_antwort_pruefung", error=str(exc)[:200])
        return False
    return bool(treffer)


def detail_lesen(
    db: Client,
    tenant_id: str,
    thread_id: str,
    *,
    client: ChannexClient | None = None,
) -> AnfrageDetail:
    """Die Anfrage-Karte über dem Chat: Frist, Betrag, mögliche Aktionen.

    ZWECK: Der Gastgeber entscheidet hier — er braucht dieselben Angaben, die
    Airbnb rechts neben dem Verlauf zeigt (Zeitraum, Gäste, Betrag), und vor
    allem die FRIST. Ohne sie ist die Anfrage nur eine Nachricht unter vielen,
    und Airbnbs Auto-Decline ist die eigentliche Antwort.
    """
    event_id = event_id_aus(thread_id)
    zeilen = (
        db.table("channex_webhook_event")
        .select("id, event, payload, created_at, live_feed_event_id, resolved")
        .eq("id", event_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise InboxError("Anfrage nicht gefunden.", status_code=404)

    zeile = zeilen[0]
    payload = zeile.get("payload")
    details = details_aus(payload)
    event = str(zeile.get("event") or "")
    betrag, waehrung = _betrag(details)

    # Beantwortbar heißt: es gibt einen Weg zu Airbnb UND es wurde noch nicht
    # entschieden. Beides muss die Oberfläche wissen, sonst zeigt sie einen
    # Knopf, der 409 wirft (Wurzel 5: fail-closed statt fail-open).
    live_id = live_feed_id_aus(payload, zeile.get("live_feed_event_id"))

    # WARUM `resolved` ALLEIN NICHT REICHT (live nachgemessen, 18.08.2026):
    # Die Spalte setzen NUR WIR — beim Beantworten über diese Anwendung. Was
    # beim Portal passiert, kommt dort nie an, und der Aggregator zieht den
    # Zustand seines Ereignisses NICHT nach: `payload.status` stand einen Tag
    # nach der Antwort der Gastgeberin unverändert auf `"active"`, obwohl der
    # Vorgang bei Airbnb längst ein anderer war.
    #
    # Der Payload ist also eine MOMENTAUFNAHME VOM EINGANG, kein lebender
    # Status. Ihn als aktuellen Zustand anzuzeigen — mit Countdown und
    # Aktionsknöpfen — behauptet etwas über ein fremdes System, das wir nicht
    # wissen (Wurzel 5b).
    #
    # Was wir WISSEN, steht im Verlauf: hat zuletzt die Gastgeberseite
    # geschrieben, ist der Vorgang aus unserer Sicht bearbeitet. Genau daran
    # erkennt der reguläre Posteingang seit jeher einen erledigten Thread
    # (`service._ist_gelesen`) — niemand antwortet auf etwas, das er nicht
    # gelesen hat. Diese Anfrage gilt deshalb als beantwortet, sobald eine
    # eigene Nachricht im Thread steht.
    # DREI QUELLEN, in dieser Rangfolge — die verlässlichste zuerst:
    #
    # 1. Das PORTAL selbst (System-Nachricht im Thread, `meta.status`). Das ist
    #    die einzige Aussage darüber, wie AIRBNB den Vorgang führt. Sie fehlt,
    #    solange er läuft.
    # 2. Unser `resolved`-Flag — gesetzt, wenn über DIESE Anwendung entschieden
    #    wurde.
    # 3. Eine eigene Nachricht im Verlauf. Deckt den Fall ab, dass in der
    #    Portal-App geantwortet wurde; sie ist eine Ableitung, keine Auskunft.
    ref = thread_ref_aus(payload)
    portal_status = portal_status_aus(_portal_verlauf(client, ref) if ref else None)
    if portal_status is not None:
        erledigt = portal_status != STATUS_AKTIV
    else:
        erledigt = bool(zeile.get("resolved")) or _selbst_geantwortet(
            db, tenant_id, ref
        )

    return AnfrageDetail(
        thread_id=thread_id,
        event_id=str(zeile["id"]),
        art=event,
        # Die Aktionen, die zu GENAU dieser Anfrageart gehören. Die Oberfläche
        # rät nicht: eine Voranfrage kennt kein „annehmen", ein Änderungswunsch
        # keinen Sonderpreis (die Formen sind bei Airbnb verschieden).
        aktionen=sorted(AKTIONEN_JE_ART.get(event, ())),
        beantwortbar=bool(live_id) and not erledigt,
        # Der Grund gehört genannt, nicht geraten — sonst steht in der
        # Oberfläche ein grauer Knopf ohne Erklärung.
        # Der Grund ist ein KÜRZEL, das die Oberfläche in Worte fasst. Kennt
        # das Portal den Vorgang, steht hier SEIN Wert (`accepted`, `declined`,
        # `expired` …) — nicht unsere Zusammenfassung. Nur wenn es schweigt,
        # sagen wir, was wir selbst wissen: „beantwortet".
        grund_gesperrt=(
            (portal_status if portal_status and erledigt else "beantwortet")
            if erledigt
            else (None if live_id else "keine_channex_id")
        ),
        # Woher die Aussage stammt — die Oberfläche unterscheidet damit
        # „Airbnb sagt es" von „wir leiten es ab". Ohne diese Trennung sähe
        # eine Vermutung aus wie eine Auskunft des Portals.
        status_quelle="portal" if portal_status else "abgeleitet",
        frist=frist_aus(payload),
        objekt=_text(details.get("listing_name")),
        gastname=_gastname(details),
        anreise=_text(details.get("checkin_date")),
        abreise=_text(details.get("checkout_date")),
        naechte=_zahl(details.get("nights")),
        gaeste=_zahl(details.get("number_of_guests")),
        erwachsene=_zahl(details.get("number_of_adults")),
        kinder=_zahl(details.get("number_of_children")),
        kleinkinder=_zahl(details.get("number_of_infants")),
        tiere=_zahl(details.get("number_of_pets")),
        payout_betrag=betrag,
        waehrung=waehrung,
    )


class AnfragenMixin:
    """Die Anfrage-Endpunkte des Posteingang-Service.

    Als Mixin und nicht in `service.py`: die Anfrage ist ein eigener Gegenstand
    mit eigener Sprache (Frist, Entscheidung, Airbnb-Form), und `service.py`
    hatte die 1500-Zeilen-Grenze bereits erreicht. Dieselbe Aufteilung wie bei
    `planung.py`/`vorlagen.py`/`nebenquellen.py` — der Slice wächst in die
    Breite, nicht in die Tiefe einer Gott-Klasse.

    Die Mixin-Methoden nutzen `self._require`/`self.access` aus dem
    Basis-Service; die reinen Lese- und Formfunktionen stehen als Funktionen
    oben im Modul und sind ohne Service testbar.
    """

    def anfrage_detail(self, ctx: AuthContext, thread_id: str) -> AnfrageDetail:
        """Die Anfrage-Karte über dem Chat (0398).

        Eigener Endpunkt statt einer Erweiterung von `get_reservation_detail`:
        das dort beschreibt eine RESERVIERUNG (Listing, Preis, Gast). Eine
        Anfrage ist keine — sie hat eine Frist und offene Entscheidungen, und
        beide Formen in ein Schema zu zwingen hieße, die Hälfte der Felder in
        beiden Fällen leer zu lassen.
        """
        if not ist_anfrage(thread_id):
            raise InboxError("Das ist keine Anfrage.", status_code=422)
        db, tenant_id = self._require(ctx)
        # Wurzel 9: derselbe Scope wie im Listenpfad — sonst sähe ein Nutzer
        # mit „assigned"-Posteingang hier Anfragen, die seine Liste nicht zeigt.
        if self.access(ctx).scope != "all":
            raise InboxError("Anfrage nicht gefunden.", status_code=404)
        # Der Channex-Client wandert mit: nur über ihn kommt der AKTUELLE
        # Status des Portals (die System-Nachricht im Thread).
        return detail_lesen(
            db, tenant_id, thread_id, client=getattr(self, "_channex", None)
        )

    def anfrage_entscheiden(
        self, ctx: AuthContext, thread_id: str, entscheidung: AnfrageEntscheidung
    ) -> dict:
        """Eine Anfrage bei Airbnb annehmen/ablehnen/vorab genehmigen.

        HIER WIRD NICHT GESENDET: Die Entscheidung geht durch den bestehenden
        Weg im channel_manager (`airbnb_anfrage_beantworten`) — der kennt die je
        Anfrageart unterschiedliche Airbnb-Form, den Doppelklick-Guard und die
        Reihenfolge „erst Airbnb, dann unsere Quittung". Eine zweite Sendelogik
        im Posteingang wäre genau die Doppelpflege, an der die Formen
        auseinanderlaufen (Boolean vs. String).

        Der Posteingang trägt nur den Ortswechsel bei: der Gastgeber entscheidet
        dort, wo der Chat steht, statt in einer technischen Ereignisliste.
        """
        if not ist_anfrage(thread_id):
            raise InboxError("Das ist keine Anfrage.", status_code=422)
        if not self.access(ctx).can_reply:
            raise InboxError("Keine Berechtigung.", status_code=403)
        if self.access(ctx).scope != "all":
            raise InboxError("Anfrage nicht gefunden.", status_code=404)

        # Lokaler Import: der channel_manager-Service zieht den halben
        # Slice nach, und der Posteingang braucht ihn nur an dieser einen
        # Stelle. Ein Modul-Import machte jeden Posteingang-Start davon abhängig.
        from src.features.channel_manager.schemas import AirbnbAnfrageAntwort
        from src.features.channel_manager.service import (
            ChannelManagerError,
            ChannelManagerService,
        )

        # Den DB-Client MITGEBEN: `ChannelManagerService()` ohne
        # `service_client` hat kein `self._db`, und sein erster Schritt ist
        # `_require_db()` — die Entscheidung schlug deshalb ausnahmslos mit 500
        # „Datenbank nicht verfügbar." fehl, bevor überhaupt etwas an Airbnb
        # ging (live 19.08.2026 beim Annehmen eines Änderungswunsches). Der
        # Posteingang hält denselben Service-Client, den die Route dort per
        # Dependency baut; ihn weiterzureichen ist derselbe Zustand, keine
        # zweite Quelle. Channex wandert mit, damit der Trace-Sink des
        # Posteingangs erhalten bleibt statt einen zweiten Client aufzubauen.
        db, _ = self._require(ctx)
        event_id = event_id_aus(thread_id)
        antwort = AirbnbAnfrageAntwort(**entscheidung.model_dump())
        try:
            dienst = ChannelManagerService(
                service_client=db, channex=getattr(self, "_channex", None)
            )
            return dienst.airbnb_anfrage_beantworten(ctx, event_id, antwort)
        except ChannelManagerError as exc:
            # Den Status der Gegenseite durchreichen, nicht auf 500 verflachen:
            # 409 („schon beantwortet") und 422 („Aktion passt nicht") sind
            # Aussagen, die der Gastgeber lesen muss (Wurzel 5).
            raise InboxError(exc.message, status_code=exc.status_code) from exc
