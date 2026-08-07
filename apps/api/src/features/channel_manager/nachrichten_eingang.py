"""Eingehende Portal-Nachrichten in den lokalen Spiegel schreiben (0293/0305).

WARUM DIESES MODUL EXISTIERT:
`portal_messages` wurde in 0293 als Speicher angelegt, damit eine Gastnachricht
nicht verloren ist, wenn der Webhook ausfällt. Gefüllt hat den Speicher jedoch
NIEMAND automatisch: der einzige Schreiber war der Posteingang selbst, und der
schreibt erst, wenn ein Mensch den Thread anklickt. Der in 0293 angekündigte
„regelmäßige Abgleich" fehlte, der Webhook warf den Text sogar aktiv weg
(`message` stand in `_UNPERSISTED_EVENTS`).

Live sichtbar am 07.08.2026: Eine Airbnb-Support-Nachricht von 09:02 lag ab
07:05 UTC im Ereignis-Journal, erschien aber in keinem Posteingang.

DIE EINE ÜBERSETZUNGSSTELLE:
Beide Eingangswege — der Webhook (schnell) und der Live-Feed-Tick (Backstop,
alle 5 Minuten) — liefern DIESELBE Payload-Form und laufen deshalb durch
dieselbe Funktion `nachricht_spiegeln`. Ein zweiter, eigener Parser je Weg wäre
genau die Sorte Doppelpflege, aus der die Zeitstempel-Bugs von 0291/0292
entstanden sind: Der Feldname gehört EINMAL notiert, nicht an jeder Aufrufstelle.

Gemessene Payload-Form (aus `channex_webhook_event`, Produktivkonto):
    {"id": "d17f69e4-…",                      # Nachrichten-ID des Aggregators
     "meta": {"name": "Mathias", "role": "GUEST"},
     "sender": "guest",                       # 'guest' | 'property'
     "message": "Guten Morgen liebe Jeanine, …",
     "booking_id": "484c66f1-…",              # NULL bei Support/Voranfrage
     "inserted_at": "2026-08-07T07:53:44.000000",
     "ota_message_id": "32120138668",         # ID BEIM PORTAL
     "have_attachment": false,
     "message_thread_id": "d3082659-…"}

ZUM ZEITSTEMPEL (Wurzel 5b): `inserted_at` ist hier ausnahmsweise die richtige
Quelle — und das ist belegt, nicht angenommen. Die Nachricht oben trägt
07:53:44 UTC; in der Airbnb-Oberfläche steht sie als „9:53 AM"
(Europe/Copenhagen, UTC+2). Der Wert beschreibt also den Zeitpunkt BEIM PORTAL,
nicht unseren Eingang — anders als der gleichnamige Wert am Buchungs-Objekt,
der Channex' eigenen Eingang meint. Es gibt kein zweites Zeitfeld im Payload;
fehlt `inserted_at`, wird die Nachricht NICHT mit unserer Uhr datiert, sondern
verworfen und geloggt (Wurzel 4: kein plausibler Ersatzwert).
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from .common import NUR_ANHANG_TEXT, log, ota_zeitstempel_utc

# Maximale Länge des gespiegelten Textes. Dieselbe Grenze wie im Posteingang
# (`inbox.service._spiegel_schreiben`), damit ein Text nicht je nach Eingangsweg
# unterschiedlich abgeschnitten in der Tabelle landet.
_MAX_BODY = 4000

# Absender, die Channex liefert — alle drei dokumentiert und im Verlauf echt:
#   guest     der Gast
#   property  wir (bzw. der Gastgeber-Account beim Portal)
#   system    das Portal selbst; trägt u. a. Airbnb-Anfragen
#             („Messages collection", Beispiel mit `reservation`-Payload)
#
# `system` gehört ausdrücklich dazu: Anfrage-Threads sind genau der Fall, den
# 0305 als „Anfrage vor der Buchung" retten will. Sie zählen wie Fremdnachrichten
# NICHT als eigene Antwort, machen den Thread aber auch nicht ungelesen — nur
# der Gast tut das (siehe `_eingang_signalisieren`).
#
# Alles darüber hinaus wäre neues Portal-Verhalten, das wir sehen wollen, statt
# es still auf 'guest' zu raten: ein falscher Absender macht aus unserer eigenen
# Antwort eine ungelesene Gastnachricht.
_SENDER = frozenset({"guest", "property", "system"})


def _text(wert: object) -> str | None:
    """Nicht-leerer Text oder None."""
    if not isinstance(wert, str):
        return None
    geputzt = wert.strip()
    return geputzt or None


def payload_aus(roh: dict[str, Any]) -> dict[str, Any]:
    """Den Nachrichten-Teil auspacken — egal von welchem Eingangsweg.

    Der Webhook verpackt ihn in `payload`, das Ereignis-Journal legt genau
    diesen Inhalt flach in `channex_webhook_event.payload` ab. Beide Formen hier
    aufzulösen ist billiger, als den Aufrufern die Unterscheidung zuzumuten.
    """
    innen = roh.get("payload")
    if isinstance(innen, dict):
        return innen
    return roh


def geprueft(payload: dict[str, Any]) -> dict[str, str] | None:
    """Die Pflichtfelder einer Nachricht — oder None, wenn eines fehlt.

    Eigene Funktion, weil das Prüfen und das Speichern zwei Dinge sind: hier
    steht, was eine Nachricht ausmacht, und beim Aufrufer, wohin sie gehört.
    Jede Ablehnung wird geloggt — ein stiller Verlust wäre genau der Zustand,
    den 0293 beenden sollte.
    """
    # DIE IDENTITÄT DER NACHRICHT — und der Grund, warum hier `id` steht und
    # nicht `ota_message_id`, obwohl letztere die „echtere" Portal-ID ist:
    #
    # Es schreiben ZWEI Pfade in dieselbe Tabelle. Der Eingang (hier) sieht den
    # Webhook-/Journal-Payload, der beide IDs trägt. Der Posteingang spiegelt
    # beim Öffnen zusätzlich den Verlauf aus `GET bookings/:id/messages` — und
    # diese Collection liefert NUR `id`, kein `ota_message_id` (Channex-Doku,
    # „Messages collection"). Nähme der Eingang `ota_message_id`, hätte dieselbe
    # Nachricht je nach Weg zwei verschiedene `message_ref` und stünde damit
    # zweimal in der Tabelle — der UNIQUE greift nur bei gleichem Schlüssel.
    #
    # Genau das ist live passiert (07.08.2026, vor diesem Fix): 30 gespiegelte
    # Nachrichten, davon acht doppelt — einmal unter `32120138668`, einmal
    # unter `d17f69e4-…`. Im Verlauf hätte jede Nachricht doppelt gestanden und
    # `ist_erste_nachricht` wäre nie wieder wahr geworden.
    #
    # Also: die Channex-`id` ist der Schlüssel, weil sie die einzige ID ist, die
    # BEIDE Quellen kennen. `ota_message_id` bleibt im `raw` erhalten.
    message_ref = _text(payload.get("id"))
    if not message_ref:
        log.warning("nachricht_ohne_id_verworfen", schluessel=sorted(payload.keys()))
        return None

    body = _text(payload.get("message"))
    if not body:
        # Reine Anhang-Nachricht: der Gast hat NUR ein Foto geschickt (live am
        # 07.08.2026 nachgemessen — Channex setzt dann `message: ""` und füllt
        # `attachments`). Sie ist echt und muss in die Tabelle, sonst zeigt die
        # Thread-Liste die VORLETZTE Nachricht als neueste und der Eingang löst
        # keine Folgeaktion aus.
        #
        # `body` ist NOT NULL, deshalb ein sprachneutrales Kürzel statt eines
        # erfundenen Satzes: die Worte macht die Oberfläche, der Server kennt
        # die Sprache des Betrachters nicht (Wurzel 4). Der Verlauf selbst zeigt
        # dieses Kürzel nie — dort gewinnt der Portal-Stand mit den echten
        # Bild-URLs (`spiegel._vereinen`).
        if not (payload.get("have_attachment") or payload.get("attachments")):
            log.info("nachricht_ohne_text_uebersprungen", message_ref=message_ref)
            return None
        body = NUR_ANHANG_TEXT

    sender = _text(payload.get("sender")) or ""
    if sender not in _SENDER:
        log.warning(
            "nachricht_unbekannter_absender", message_ref=message_ref,
            sender=sender[:32],
        )
        return None

    # Wurzel 5b: der Zeitpunkt kommt aus der Quelle oder gar nicht.
    sent_at = ota_zeitstempel_utc(payload.get("inserted_at"))
    if not sent_at:
        log.warning("nachricht_ohne_zeitpunkt_verworfen", message_ref=message_ref)
        return None

    return {
        "message_ref": message_ref,
        "body": body[:_MAX_BODY],
        "sender": sender,
        "sent_at": sent_at,
    }


class NachrichtenEingangMixin:
    """Portal-Nachrichten spiegeln — geteilt von Webhook und Journal-Tick."""

    _db: Client | None

    def nachricht_spiegeln(
        self, tenant_id: str, roh: dict[str, Any]
    ) -> str | None:
        """Eine eingegangene Nachricht in `portal_messages` ablegen.

        Rückgabe ist die lokale Thread-ID (`channex_booking.id`), wenn die
        Nachricht einer Buchung zugeordnet werden konnte — sonst None. Der
        Aufrufer nutzt sie, um Folgeschritte (Abwesenheitsantwort) genau dann
        auszulösen, wenn es einen Thread gibt, in dem sie sichtbar würde.

        Idempotent über `(tenant_id, message_ref)` (Wurzel 2): Webhook und
        5-Minuten-Tick bringen dieselbe Nachricht regelmäßig doppelt, und das
        ist der Normalfall, kein Fehler. Der UNIQUE-Index aus 0293 ist der
        Backstop, falls beide exakt gleichzeitig schreiben.

        Best effort im Sinne von Wurzel 5: Fehler werden geloggt und
        weitergereicht als None, aber nie geworfen — der Webhook muss mit 200
        antworten (sonst wiederholt Channex bis ~24 h und gibt dann auf), und
        ein einzelner kaputter Datensatz darf den Journal-Tick nicht abbrechen,
        der noch 99 weitere Ereignisse abzuarbeiten hat.
        """
        if self._db is None:
            return None
        payload = payload_aus(roh)
        felder = geprueft(payload)
        if felder is None:
            return None

        booking_ref = _text(payload.get("booking_id"))
        portal_thread = _text(payload.get("message_thread_id"))
        thread_id = (
            self._thread_zu_buchung(tenant_id, booking_ref) if booking_ref else None
        )

        # `thread_ref` ist NOT NULL und meint die lokale Buchungszeile. Fehlt
        # sie (Support-Nachricht, Anfrage vor der Buchung), tritt der
        # Portal-Thread an ihre Stelle: die Nachricht ist echt und wird
        # gespeichert, taucht aber in keiner Thread-Liste auf — dort hängt
        # jeder Eintrag an einer Buchung. Ohne diesen Zweig wäre sie verloren,
        # sobald das Journal sie nach einem Monat vergisst.
        if not thread_id and not portal_thread:
            log.info(
                "nachricht_ohne_thread_bezug", message_ref=felder["message_ref"]
            )
            return None

        zeile = {
            "tenant_id": tenant_id,
            "thread_ref": thread_id or portal_thread,
            "booking_ref": booking_ref,
            "portal_thread_ref": portal_thread,
            "raw": payload,
            **felder,
        }
        try:
            self._db.table("portal_messages").upsert(
                zeile, on_conflict="tenant_id,message_ref"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Webhook/Tick nie kippen
            log.warning(
                "nachricht_spiegeln_fehlgeschlagen",
                message_ref=felder["message_ref"], error=str(exc)[:200],
            )
            return None

        if thread_id:
            if portal_thread:
                self._vorgeschichte_nachziehen(tenant_id, portal_thread, thread_id)
            self._eingang_signalisieren(
                tenant_id, thread_id, felder["sender"], felder["sent_at"]
            )
        return thread_id

    def _vorgeschichte_nachziehen(
        self, tenant_id: str, portal_thread: str, thread_id: str
    ) -> None:
        """Ältere Nachrichten desselben Portal-Threads an die Buchung hängen.

        Der Fall: Ein Gast fragt an, BEVOR er bucht. Die Nachrichten kommen
        ohne `booking_id` und werden am Portal-Thread abgelegt (`thread_ref =
        message_thread_id`) — sichtbar in keiner Liste, weil dort jeder Eintrag
        an einer Buchung hängt. Bucht er später, entsteht die Thread-Zeile, und
        genau dann gehört die Vorgeschichte umgehängt: sonst beginnt der
        Verlauf mitten im Gespräch.

        Läuft nur, wenn die Buchung bekannt ist — also höchstens einmal je
        Thread mit Wirkung; danach findet das Update nichts mehr.
        """
        if self._db is None:
            return
        try:
            (
                self._db.table("portal_messages")
                .update({"thread_ref": thread_id})
                .eq("tenant_id", tenant_id)
                .eq("portal_thread_ref", portal_thread)
                .eq("thread_ref", portal_thread)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Nachtrag kippt den Eingang nicht
            log.warning(
                "nachricht_vorgeschichte_nachziehen_fehlgeschlagen",
                thread_id=thread_id, error=str(exc)[:200],
            )

    def _thread_zu_buchung(self, tenant_id: str, booking_ref: str) -> str | None:
        """Buchungs-ID beim Aggregator → unsere Thread-Zeile. Tenant-gescopt
        (Wurzel 3: das Channex-Konto ist kontoweit, die Zeile darf nicht die
        eines fremden Mandanten sein)."""
        if self._db is None:
            return None
        try:
            treffer = (
                self._db.table("channex_booking")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("channex_booking_id", booking_ref)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — Zuordnung ist nicht der Hauptpfad
            log.warning("nachricht_thread_suche_fehlgeschlagen", error=str(exc)[:200])
            return None
        return str(treffer[0]["id"]) if treffer else None

    def _eingang_signalisieren(
        self, tenant_id: str, thread_id: str, sender: str, sent_at: str
    ) -> None:
        """Das Realtime-Signal setzen (`channex_booking.last_message_at`, 0305).

        Hier hängt die gesamte Live-Aktualisierung des Posteingangs dran: der
        Nachrichteninhalt bleibt hinter der API (Wurzel 6 — ein
        `authenticated`-SELECT auf `portal_messages` würde den Rollen-Split per
        PostgREST-Direktpfad umgehen), also ist dieses inhaltsfreie Feld das
        einzige, was die UI direkt beobachten darf.

        ZWEI Schreibvorgänge, nicht einer — das ist Absicht. Sie tragen
        verschiedene Bedingungen und dürfen sich nicht gegenseitig blockieren:

        * `last_message_at` darf nie ZURÜCK. Das Journal garantiert keine
          Reihenfolge (deshalb ist es ein Trigger, kein Datenlieferant); eine
          nachgereichte ältere Nachricht dürfte den Thread nicht zurückdatieren.
        * `is_read = false` gilt IMMER, wenn der Gast geschrieben hat — auch
          wenn die Nachricht ein Nachzügler ist. Lägen beide im selben Patch,
          würde der Zeitstempel-Guard die Ungelesen-Markierung mit abweisen: der
          Gast hätte geschrieben, und der Thread sähe gelesen aus.

        Unsere eigene Antwort setzt `is_read` ausdrücklich nicht — sonst
        markiert sich ein Thread beim Antworten selbst als ungelesen (Wurzel 1:
        der Gegenzustand gehört zum Eingang, nicht zum Senden).
        """
        if self._db is None:
            return
        try:
            (
                self._db.table("channex_booking")
                .update({"last_message_at": sent_at})
                .eq("tenant_id", tenant_id)
                .eq("id", thread_id)
                .or_(f"last_message_at.is.null,last_message_at.lt.{sent_at}")
                .execute()
            )
            if sender == "guest":
                (
                    self._db.table("channex_booking")
                    .update({"is_read": False})
                    .eq("tenant_id", tenant_id)
                    .eq("id", thread_id)
                    .execute()
                )
        except Exception as exc:  # noqa: BLE001 — Signal kippt den Eingang nicht
            log.warning(
                "nachricht_signal_fehlgeschlagen",
                thread_id=thread_id, error=str(exc)[:200],
            )
