"""Der lokale Nachrichten-Spiegel des Posteingangs (`portal_messages`).

Alles, was den Verlauf zwischen unserer DB und dem Aggregator vermittelt:
schreiben, lesen, zusammenführen und das Realtime-Signal setzen. Bis 0305 stand
das verstreut in `service.py`; herausgelöst, weil es eine eigene Zuständigkeit
ist — der Service beantwortet Anfragen, dieses Modul hält den Verlauf vor.

Wer den Spiegel FÜLLT, wenn eine Nachricht neu eintrifft, steht bewusst nicht
hier, sondern in `channel_manager.nachrichten_eingang`: das ist der
Eingangspfad (Webhook + Journal-Tick) und gehört zum Kanal, nicht zur Anzeige.
Dieses Modul ist die Leseseite plus der Nachtrag, der beim Öffnen eines Threads
anfällt.
"""
from __future__ import annotations

from typing import Final
from urllib.parse import urlparse, urlunparse

from supabase import Client

from src.core.logging import get_logger
from src.features.channel_manager.common import (
    NUR_ANHANG_TEXT,
    ota_zeitstempel_utc,
)

from .schemas import InboxMessage

log = get_logger("nextdays.inbox")

# Wie viele Nachrichten ein Thread-Verlauf höchstens aus dem Spiegel lädt.
# Harte Obergrenze statt unbegrenztem Bereich (Wurzel 8); ein Verlauf mit mehr
# als 500 Nachrichten ist real nicht vorgekommen, und die Anzeige rendert sie
# ohnehin nicht sinnvoll.
_MAX_VERLAUF = 500

# Dieselbe Grenze wie im Eingangspfad, damit ein Text nicht je nach Weg
# unterschiedlich abgeschnitten in der Tabelle landet.
_MAX_BODY = 4000

# Hosts, von denen ein Bildanhang im Verlauf stammen darf. Channex legt die
# Dateien unter seiner eigenen Domain ab (live nachgemessen 07.08.2026:
# `https://app.channex.io/api/v1/attachments/<uuid>/<uuid>/<uuid>.jpeg`,
# ohne Auth abrufbar).
_ANHANG_HOSTS: Final[frozenset[str]] = frozenset({"app.channex.io"})

# Mehr Bilder hängt niemand an eine Chat-Nachricht; die Zahl deckelt eine
# Antwort, die sonst allein von der Gegenseite bestimmt wäre (Wurzel 8).
_MAX_ANHAENGE: Final = 20


def sichere_anhaenge(wert: object) -> list[str]:
    """Bildanhänge einer Portal-Nachricht auf das Anzeigbare eindampfen.

    Der Wert kommt von der Gegenseite und landet im `src` eines `<img>`. Alles,
    was nicht nachweislich eine `https`-URL auf einem bekannten Channex-Host
    ist, fliegt RAUS statt „schon irgendwie" gerendert zu werden (Wurzel 8):
    ein `javascript:`- oder `data:`-Eintrag wäre sonst ein XSS-Träger, ein
    fremder Host eine Wanze, die dem Absender jedes Öffnen des Threads meldet.

    `http` wird auf `https` gehoben, nicht verworfen: Channex liefert die URL
    live mit `http://`, derselbe Pfad antwortet über `https` (nachgemessen).
    Ungehoben blockte der Browser das Bild als Mixed Content — die Blase bliebe
    leer, also genau der Fehler, der hier behoben wird.
    """
    if not isinstance(wert, list):
        return []
    raus: list[str] = []
    for eintrag in wert[:_MAX_ANHAENGE]:
        if not isinstance(eintrag, str) or not eintrag.strip():
            continue
        zerlegt = urlparse(eintrag.strip())
        if zerlegt.scheme not in ("http", "https"):
            continue
        if zerlegt.hostname not in _ANHANG_HOSTS:
            log.warning("inbox_anhang_fremder_host", host=zerlegt.hostname)
            continue
        raus.append(urlunparse(zerlegt._replace(scheme="https")))
    return raus


def _vorschau(m: InboxMessage) -> str:
    """Der Text, mit dem eine Nachricht im Spiegel steht.

    Leer = nichts zu spiegeln (weder Text noch Bild) — die Zeile fiele mit
    23502 auf `body NOT NULL`.
    """
    text = (m.message or "").strip()
    if text:
        return text[:_MAX_BODY]
    # Nur Bilder: sprachneutrales Kürzel statt eines erfundenen Satzes; ohne
    # das fiel die Nachricht ganz aus dem Spiegel und die Thread-Liste zeigte
    # die VORLETZTE als neueste (Wurzel 4).
    return NUR_ANHANG_TEXT if m.attachments else ""


class SpiegelMixin:
    """Lesen und Nachtragen des lokalen Verlaufs."""

    @staticmethod
    def _vereinen(
        vom_portal: list[InboxMessage], gespiegelt: list[InboxMessage]
    ) -> list[InboxMessage]:
        """Portal-Stand und Spiegel zu einem Verlauf, ohne Doppelte.

        Der Portal-Stand gewinnt bei gleicher ID: er kann eine Nachricht
        enthalten, die wir noch nicht gespiegelt haben, und trägt Felder, die
        der Spiegel nicht speichert (Anhänge).
        """
        bekannt = {str(m.id) for m in vom_portal if m.id}
        return vom_portal + [
            m for m in gespiegelt if m.id and str(m.id) not in bekannt
        ]

    def _spiegel_schreiben(
        self, db: Client, tenant_id: str, thread_id: str, cbid: str,
        items: list[InboxMessage],
    ) -> None:
        """Den geholten Verlauf lokal spiegeln (`portal_messages`, 0293).

        Der Spiegel speist die Vorschauzeile der Thread-Liste: EIN Query für
        alle Threads statt ein Portal-Request pro Zeile. Er wurde bisher nur
        GELESEN und nie geschrieben — deshalb war die Tabelle leer und in der
        Liste stand unter keinem Namen ein Vorschautext.

        Idempotent über `message_ref` (UNIQUE je Tenant): derselbe Verlauf darf
        beliebig oft geholt werden, ohne den Spiegel zu vervielfachen
        (Wurzel 2 — der Abruf passiert bei jedem Öffnen des Threads).

        Best-effort: der Chat ist die Hauptsache. Scheitert das Spiegeln, sieht
        der Betrieb seine Nachrichten trotzdem — nur die Vorschau bleibt leer
        (Wurzel 5: kein Nebenweg kippt den Hauptpfad).
        """
        zeilen = [
            {
                "tenant_id": tenant_id,
                "thread_ref": thread_id,
                "booking_ref": cbid,
                "message_ref": str(m.id),
                "sender": m.sender,
                "body": _vorschau(m),
                "sent_at": m.sent_at,
                # Die Bild-URLs mit in den Spiegel: sonst ist das Foto weg,
                # sobald der Verlauf aus ihm allein kommt — bei einem Ausfall
                # des Portals und bei Threads ohne `channex_booking_id`. Dann
                # stünde nur noch das Kürzel da, also wieder eine Blase ohne
                # Bild (Wurzel 1: der Spiegel muss tragen, was er ersetzt).
                #
                # Nur DIESER Schlüssel, und nur wenn es Anhänge gibt: `raw`
                # trägt beim Eingangspfad die volle Webhook-Payload
                # (`nachrichten_eingang`), die ein pauschales Überschreiben
                # verlöre.
                **({"raw": {"attachments": m.attachments}} if m.attachments else {}),
            }
            for m in items
            # `body` ist NOT NULL: ohne Text UND ohne Anhang gäbe es nichts zu
            # zeigen, und der Upsert kippte mit 23502 — dann fehlten auch die
            # Nachrichten daneben im Spiegel.
            if m.id and m.sent_at and _vorschau(m)
        ]
        if not zeilen:
            return
        try:
            db.table("portal_messages").upsert(
                zeilen, on_conflict="tenant_id,message_ref"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Spiegel kippt den Chat nicht
            log.warning(
                "inbox_spiegel_fehlgeschlagen",
                tenant_id=tenant_id, thread_id=thread_id,
                error=str(exc)[:200],
            )
            return
        # Das Realtime-Signal auch auf diesem Weg nachziehen (0305). Sonst
        # hinge die Sortierung „letzte Aktivität" davon ab, über WELCHEN Weg
        # eine Nachricht hereinkam: der Eingangspfad setzt sie, der Abruf beim
        # Öffnen nicht — und ein Verlauf, den nur dieser Weg kennt (Airbnb
        # liefert Ältestes teils nur am Buchungspfad), bliebe ohne Zeitstempel.
        neuster = max((z["sent_at"] for z in zeilen if z["sent_at"]), default=None)
        if neuster:
            self._letzte_aktivitaet_setzen(db, tenant_id, thread_id, str(neuster))

    @staticmethod
    def _letzte_aktivitaet_setzen(
        db: Client, tenant_id: str, thread_id: str, sent_at: str
    ) -> None:
        """`channex_booking.last_message_at` hochsetzen — nie zurück.

        Kein `is_read`-Eingriff hier: dieser Pfad läuft, WEIL jemand den Thread
        gerade offen hat. Ihn dabei als ungelesen zu markieren wäre falsch
        herum (Wurzel 1 — der Gegenzustand gehört zum Eingang, nicht zum Lesen).
        """
        try:
            (
                db.table("channex_booking")
                .update({"last_message_at": sent_at})
                .eq("tenant_id", tenant_id)
                .eq("id", thread_id)
                .or_(f"last_message_at.is.null,last_message_at.lt.{sent_at}")
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Signal kippt den Chat nicht
            log.warning(
                "inbox_signal_fehlgeschlagen",
                tenant_id=tenant_id, thread_id=thread_id, error=str(exc)[:200],
            )

    @staticmethod
    def _spiegel_lesen(
        db: Client, tenant_id: str, thread_id: str
    ) -> list[InboxMessage]:
        """Den lokal gespiegelten Verlauf eines Threads laden (0305).

        Best effort wie der Spiegel selbst: ist er nicht lesbar, bleibt der
        Live-Abruf die Quelle — das ist der Stand vor 0305 und immer noch
        besser als eine Fehlerseite.
        """
        try:
            res = (
                db.table("portal_messages")
                .select("message_ref, body, sender, sent_at, raw")
                .eq("tenant_id", tenant_id)
                .eq("thread_ref", thread_id)
                .order("sent_at", desc=False)
                .limit(_MAX_VERLAUF)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Spiegel kippt den Chat nicht
            log.warning(
                "inbox_spiegel_lesen_fehlgeschlagen",
                tenant_id=tenant_id, thread_id=thread_id, error=str(exc)[:200],
            )
            return []
        return [
            InboxMessage(
                id=m["message_ref"],
                # Das Kürzel einer reinen Bildnachricht ist KEIN Text, den
                # jemand lesen soll — es ersetzt nur den NOT-NULL-Body. Im
                # Verlauf trägt das Bild die Nachricht; bliebe das Kürzel
                # stehen, stünde dort wörtlich „[attachment]".
                message="" if m.get("body") == NUR_ANHANG_TEXT else (m.get("body") or ""),
                sender=str(m.get("sender") or "guest"),
                sent_at=ota_zeitstempel_utc(m.get("sent_at")),
                # Erneut durch dieselbe Prüfung wie beim Portal-Abruf: was in
                # der Tabelle steht, ist gespeicherter Fremdinput und darf
                # nicht ungeprüft in ein `src` (Wurzel 8).
                attachments=sichere_anhaenge((m.get("raw") or {}).get("attachments")),
            )
            for m in (res.data or [])
        ]

    @staticmethod
    def _letzte_gastnachricht(
        db: Client, tenant_id: str, thread_ids: list[str]
    ) -> dict[str, str]:
        """Zeitpunkt der jüngsten GAST-Nachricht je Thread (aus dem Spiegel).

        EIN Query für die ganze Liste, wie bei der Vorschau. Nur `sender =
        'guest'`: unsere eigenen Antworten dürfen einen Thread nicht ungelesen
        machen.
        """
        if not thread_ids:
            return {}
        try:
            res = (
                db.table("portal_messages")
                .select("thread_ref, sent_at")
                .eq("tenant_id", tenant_id)
                .eq("sender", "guest")
                .in_("thread_ref", thread_ids)
                .order("sent_at", desc=True)
                .limit(2000)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Spiegel kippt die Liste nicht
            # Diese Methode läuft im HAUPTPFAD von `list_threads`. Ohne das
            # Fangen führte ein Spiegel-Fehler zu einer 500er-Posteingangsseite
            # — obwohl nur die Ungelesen-Markierung betroffen ist.
            log.warning(
                "inbox_letzte_gastnachricht_fehlgeschlagen",
                tenant_id=tenant_id, error=str(exc)[:200],
            )
            return {}
        out: dict[str, str] = {}
        for m in res.data or []:
            # Absteigend sortiert → der erste Treffer je Thread ist der jüngste.
            out.setdefault(m["thread_ref"], str(m.get("sent_at") or ""))
        return out

    @staticmethod
    def _last_messages(
        db: Client, tenant_id: str, thread_ids: list[str]
    ) -> dict[str, tuple[str, str, str]]:
        """Letzte Nachricht je Thread: (Vorschautext, Absender, Zeitpunkt).

        Quelle ist der lokale Spiegel `portal_messages` (0293) — EIN Query für
        die ganze Liste. Direkt beim Portal wäre es ein Request PRO Thread; bei
        200 Einträgen ist das keine Liste mehr, die jemand öffnet.

        Der Absender gehört dazu, weil er die Frage beantwortet, die man vor
        einer langen Liste wirklich hat: „habe ich schon geantwortet?". Ohne
        ihn sieht ein Thread, in dem der Gast wartet, genauso aus wie einer,
        der erledigt ist.

        Der Zeitpunkt ist der ECHTE Wert hinter „letzte Aktivität" — der
        Buchungszeitpunkt ist er ausdrücklich nicht (s. `list_threads`).
        """
        if not thread_ids:
            return {}
        try:
            res = (
                db.table("portal_messages")
                .select("thread_ref, body, sender, sent_at")
                .eq("tenant_id", tenant_id)
                .in_("thread_ref", thread_ids)
                .order("sent_at", desc=True)
                .limit(2000)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Spiegel kippt die Liste nicht
            # Wie oben: Hauptpfad von `list_threads`. Ohne Vorschautext ist die
            # Liste unvollständig, ohne Liste ist sie unbenutzbar.
            log.warning(
                "inbox_vorschau_fehlgeschlagen",
                tenant_id=tenant_id, error=str(exc)[:200],
            )
            return {}
        out: dict[str, tuple[str, str, str]] = {}
        for m in res.data or []:
            # Absteigend sortiert → der erste Treffer je Thread ist der jüngste.
            out.setdefault(
                m["thread_ref"],
                (
                    (m.get("body") or "").strip(),
                    str(m.get("sender") or "guest"),
                    str(m.get("sent_at") or ""),
                ),
            )
        return out
