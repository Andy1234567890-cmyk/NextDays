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

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Final, NamedTuple
from urllib.parse import urlparse, urlunparse

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.channel_manager.common import (
    NUR_ANHANG_TEXT,
    ota_zeitstempel_utc,
)

from .schemas import InboxMessage

if TYPE_CHECKING:
    from .authz import InboxAccess

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

# Wie viele Spiegel-Zeilen die Thread-Liste in EINEM Zug liest. Der Deckel ist
# nötig (Wurzel 8), aber er gilt über ALLE Threads zusammen — ein „letzte
# Nachricht je Thread" lässt sich per PostgREST nicht anfragen. Wird er
# erreicht, verlieren die ÄLTESTEN Threads Vorschau und Lesestand-Vergleich,
# also wird das geloggt statt still abgeschnitten (Wurzel 5).
_MAX_SPIEGEL_ZEILEN: Final = 2000


class ThreadStand(NamedTuple):
    """Was der Spiegel über EINEN Thread weiß.

    Alles aus einer einzigen Abfrage: Vorschau, Absender und die beiden
    Zeitpunkte, aus denen der Lesestand entsteht. Vorher waren das zwei
    Abfragen über dieselben Zeilen, und die jüngste EIGENE Nachricht fehlte
    ganz — deshalb galt ein Thread als ungelesen, in dem wir längst geantwortet
    hatten (`InboxService._ist_gelesen`).
    """

    body: str
    """Vorschautext der jüngsten Nachricht (leer = keine)."""
    sender: str
    """Absender der jüngsten Nachricht: guest | property | system."""
    sent_at: str
    """Zeitpunkt der jüngsten Nachricht (leer = unbekannt)."""
    letzte_gast: str
    """Zeitpunkt der jüngsten GAST-Nachricht (leer = keine)."""
    letzte_eigene: str
    """Zeitpunkt der jüngsten EIGENEN Nachricht (leer = keine)."""


LEERER_STAND = ThreadStand("", "", "", "", "")
"""Ein Thread, über den der Spiegel nichts weiß (noch keine Nachricht)."""


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

    # Vom Service gestellt; hier nur deklariert, damit die Typprüfung den
    # Zugriff kennt (dasselbe Muster wie in `PlanungMixin`).
    list_threads: Any

    @staticmethod
    def _ist_gelesen(row: dict, spiegel: ThreadStand) -> bool:
        """Ist dieser Thread gelesen?

        `is_read` allein reicht NICHT: es ist ein Handflag, das beim Öffnen
        eines Threads auf `true` gesetzt wird und dort für immer stehen bleibt.
        Schreibt der Gast danach erneut, bliebe der Thread „gelesen" — und der
        Betrieb sieht die neue Nachricht nur, wenn er zufällig hineinschaut.
        Live war das der Zustand: alle 22 Threads `is_read = true`, während in
        der Liste bei jedem „Neu" stand (das war der BUCHUNGS-Status, s.
        `StatusBadge`) — beides zusammen ergab eine Anzeige, die nichts
        unterschied.

        Regel: gelesen = seit der jüngsten Gastnachricht ist etwas passiert,
        das nur passiert, wenn jemand sie gesehen hat —
        * der Thread wurde markiert (`read_at`), ODER
        * WIR haben danach geantwortet.

        Die eigene Antwort gehört ausdrücklich dazu: niemand antwortet auf eine
        Nachricht, die er nicht gelesen hat. Ohne sie trugen live vier von neun
        „ungelesenen" Threads eine EIGENE Nachricht als letzte — der Betrieb
        hatte längst geantwortet und wurde weiter zur Arbeit aufgefordert. Das
        greift auch für Wege, die `read_at` nie berühren: die
        Abwesenheitsantwort des Schedulers und eine Antwort, die direkt in der
        Portal-App geschrieben wurde.

        Verglichen werden ZEITPUNKTE, nicht Zeichenketten: dieselbe Sekunde
        kommt in zwei Schreibweisen an („…+00:00" aus PostgREST, „…Z" aus
        `ota_zeitstempel_utc`), und im Zeichenvergleich ist „Z" > „+" — genau
        der Fehler, den `_letzte_aktivitaet` daneben schon beschreibt.

        Gibt es keine Gastnachricht, gilt das Flag unverändert — kein
        erfundener Zustand (Wurzel 4).
        """
        # Lokaler Import wie in `_nebenquellen_lesestand_anwenden`: `spiegel.py`
        # ist ein Mixin DERSELBEN Klasse wie `service.py`, ein Modul-Import
        # waere ein Zirkelbezug.
        from .service import _als_zeitpunkt  # noqa: PLC0415

        gast = spiegel.letzte_gast
        if not gast:
            return bool(row.get("is_read", True))
        wann_gast = _als_zeitpunkt(gast)
        if spiegel.letzte_eigene and _als_zeitpunkt(spiegel.letzte_eigene) >= wann_gast:
            return True
        seit = row.get("read_at")
        if not seit:
            # Kein Lesezeitpunkt bekannt (Altbestand vor 0302): dann bleibt nur
            # das Flag.
            return bool(row.get("is_read", True))
        return wann_gast <= _als_zeitpunkt(str(seit))

    def _nebenquelle_lesestand_setzen(
        self, ctx: AuthContext, thread_id: str, *, is_read: bool | None
    ) -> None:
        """Lesestand eines Verlaufs ohne `channex_booking`-Zeile schreiben.

        Nur `is_read` wird unterstuetzt. Favorit, Notiz, Archiv und Erinnerung
        haengen an Spalten von `channex_booking`, die es hier nicht gibt — sie
        still zu schlucken waere schlimmer als sie zu ignorieren, deshalb
        bleiben sie schlicht wirkungslos und der Aufrufer bekommt kein falsches
        „gespeichert" (die Oberflaeche bietet sie fuer diese Verlaeufe nicht an).

        `is_read=False` LOESCHT die Zeile, statt einen alten Zeitpunkt stehen zu
        lassen: „wieder auf ungelesen" heisst, dass der letzte Lesevorgang nicht
        mehr gilt (Wurzel 1 — der Gegenzustand gehoert gepflegt).
        """
        if is_read is None:
            return
        db, tenant_id = self._require(ctx)
        if is_read:
            db.table("inbox_nebenquelle_lesestand").upsert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "read_at": datetime.now(UTC).isoformat(),
                    "updated_at": datetime.now(UTC).isoformat(),
                },
                on_conflict="tenant_id,thread_id",
            ).execute()
        else:
            db.table("inbox_nebenquelle_lesestand").delete().eq(
                "tenant_id", tenant_id
            ).eq("thread_id", thread_id).execute()

    def nebenquellen_lesestaende(
        self, tenant_id: str, thread_ids: list[str]
    ) -> dict[str, str]:
        """thread_id → `read_at` fuer die uebergebenen Verlaeufe.

        EIN Abruf fuer die ganze Liste, nicht einer je Zeile: der Posteingang
        zeigt bis zu 128 Verlaeufe, und der Lesestand ist eine Nebensache, die
        keine 128 Abfragen wert ist.
        """
        if not thread_ids or self._db is None:
            return {}
        zeilen = (
            self._db
            .table("inbox_nebenquelle_lesestand")
            .select("thread_id, read_at")
            .eq("tenant_id", tenant_id)
            .in_("thread_id", thread_ids)
            .execute()
        ).data or []
        return {
            str(z["thread_id"]): str(z["read_at"])
            for z in zeilen
            if z.get("thread_id") and z.get("read_at")
        }

    def _nebenquellen_lesestand_anwenden(
        self, tenant_id: str, threads: list
    ) -> None:
        """Gespeicherten Lesestand ueber die abgeleiteten `is_read` legen.

        Die Nebenquellen LEITEN ihr `is_read` aus dem Verlauf ab (bei Anfragen:
        „hat zuletzt der Betrieb geschrieben?") — eine Ableitung, die kein
        Oeffnen kennt. Solange der Gast der Letzte war, stand der Verlauf
        dauerhaft auf ungelesen, egal wie oft ihn jemand las (live gemeldet am
        31.08.2026: zwei Anfragen, Zaehler blieb bei 2).

        Der gespeicherte Zeitpunkt schlaegt die Ableitung nur in EINE Richtung:
        er kann „ungelesen" zu „gelesen" machen, nie umgekehrt. Dieselbe Regel
        wie bei `channex_booking` (`_ist_gelesen`): gelesen gilt, bis der Gast
        wieder schreibt — danach ist der Verlauf zu Recht erneut ungelesen,
        ohne dass jemand etwas zuruecksetzen muss.
        """
        # Lokaler Import: `spiegel.py` ist ein Mixin DERSELBEN Klasse wie
        # `service.py`. Ein Import auf Modulebene waere ein Zirkelbezug.
        from .service import _als_zeitpunkt  # noqa: PLC0415

        if not threads:
            return
        stand = self.nebenquellen_lesestaende(tenant_id, [t.id for t in threads])
        if not stand:
            return
        for t in threads:
            gelesen_am = stand.get(t.id)
            if not t.is_read and gelesen_am:
                t.is_read = _als_zeitpunkt(t.letzte_aktivitaet) <= _als_zeitpunkt(
                    gelesen_am
                )

    def unread_count(
        self, ctx: AuthContext, *, access: InboxAccess | None = None
    ) -> int:
        """Zahl fürs Sidebar-Abzeichen: offene Konversationen der AKTIVEN Ansicht.

        Hier und nicht in `service.py`, weil der Lesestand (`_ist_gelesen`,
        `_spiegel_stand`) in diesem Modul zu Hause ist — und weil `service.py`
        mit dieser Methode über die pylint-Grenze von 1500 Zeilen lief.

        Bewusst über `list_threads` statt über ein eigenes
        `count(is_read = false)` in SQL. Der ausgelieferte Lesestand ist
        ABGELEITET: das Flag allein steht nach dem ersten Öffnen für immer auf
        `true`, und eine danach eingegangene Gastnachricht fiele aus einer
        reinen Spaltenzählung heraus — das Abzeichen bliebe stumm, während in
        der Liste daneben „ungelesen" steht. Eine zweite Zählweise wäre also
        nicht schneller, sondern eine zweite Wahrheit über denselben Zustand.

        Archiv und Papierkorb zählen nicht mit: das Abzeichen fordert zur
        Arbeit auf, und was archiviert wurde, ist erledigt. Der Scope kommt aus
        `access` und gilt unverändert (Wurzel 9) — wer nur zugewiesene Threads
        sehen darf, bekommt auch nur deren Zahl.
        """
        liste = self.list_threads(ctx, status="active", access=access)
        return sum(1 for t in liste.items if not t.is_read)

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
        *, quelle: str = "portal",
    ) -> None:
        """Den geholten Verlauf lokal spiegeln (`portal_messages`, 0293).

        `quelle` (0400) sagt, WER die Zeile ausgelöst hat — der Default
        `portal` gilt für den Verlaufs-Abgleich, der fremde Nachrichten vom
        Aggregator holt. Der Sendepfad übergibt `manuell` bzw. `automation`;
        nur dort ist der Auslöser bekannt.

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
                # Woher die Nachricht kam (0400). Der Aufrufer weiß es: der
                # Sendepfad kennt seinen Auslöser (Hand oder Automation), der
                # Verlaufs-Abgleich holt fremde Zeilen vom Portal. An der
                # Nachricht selbst ist es sonst nicht mehr feststellbar —
                # Automail und Handnachricht laufen durch dieselbe
                # `send_message` und kommen beide als `sender='property'`
                # zurück.
                "quelle": quelle,
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
    def _spiegel_stand(
        db: Client, tenant_id: str, thread_ids: list[str]
    ) -> dict[str, ThreadStand]:
        """Der Stand des Spiegels je Thread — EIN Query für die ganze Liste.

        Quelle ist der lokale Spiegel `portal_messages` (0293). Direkt beim
        Portal wäre es ein Request PRO Thread; bei 200 Einträgen ist das keine
        Liste mehr, die jemand öffnet.

        Was daraus entsteht, beantwortet zwei verschiedene Fragen, deshalb
        stehen beide Zeitpunkte in `ThreadStand`:
        * „Worum geht es, und habe ich geantwortet?" → Vorschau + Absender der
          jüngsten Nachricht. Ohne den Absender sieht ein Thread, in dem der
          Gast wartet, genauso aus wie ein erledigter.
        * „Ist hier noch etwas offen?" → jüngste Gast- UND jüngste eigene
          Nachricht (`InboxService._ist_gelesen`).

        Der Zeitpunkt der jüngsten Nachricht ist der ECHTE Wert hinter „letzte
        Aktivität" — der Buchungszeitpunkt ist er ausdrücklich nicht
        (s. `list_threads`).

        Best effort wie der ganze Spiegel: diese Methode läuft im HAUPTPFAD von
        `list_threads`. Ohne das Fangen führte ein Spiegel-Fehler zu einer
        500er-Posteingangsseite, obwohl nur Vorschau und Lesestand betroffen
        sind — und ohne Liste ist der Posteingang unbenutzbar.
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
                .limit(_MAX_SPIEGEL_ZEILEN)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Spiegel kippt die Liste nicht
            log.warning(
                "inbox_spiegel_stand_fehlgeschlagen",
                tenant_id=tenant_id, error=str(exc)[:200],
            )
            return {}
        zeilen = res.data or []
        if len(zeilen) >= _MAX_SPIEGEL_ZEILEN:
            # Kein stilles Kappen: die ältesten Threads dieser Liste stehen
            # jetzt ohne Vorschau und ohne Lesestand-Vergleich da.
            log.warning(
                "inbox_spiegel_deckel_erreicht",
                tenant_id=tenant_id, threads=len(thread_ids),
                grenze=_MAX_SPIEGEL_ZEILEN,
            )
        out: dict[str, ThreadStand] = {}
        for m in zeilen:
            ref = str(m["thread_ref"])
            sender = str(m.get("sender") or "guest")
            wann = str(m.get("sent_at") or "")
            vorhanden = out.get(ref)
            if vorhanden is None:
                # Absteigend sortiert → der erste Treffer je Thread ist der
                # jüngste und trägt damit Vorschau und Absender.
                vorhanden = ThreadStand(
                    (m.get("body") or "").strip(), sender, wann, "", ""
                )
            if sender == "guest" and not vorhanden.letzte_gast:
                vorhanden = vorhanden._replace(letzte_gast=wann)
            elif sender == "property" and not vorhanden.letzte_eigene:
                vorhanden = vorhanden._replace(letzte_eigene=wann)
            out[ref] = vorhanden
        return out
