"""Posteingang-Threads aus Quellen NEBEN `channex_booking`.

Der Posteingang baut seine Threads aus `channex_booking` — dort liegt aber nur,
was über Channex lief. Konversationen anderer Herkunft haben eigene Tabellen:

* `reservation_nachricht_uebernahme` (0382) — eingefrorene Verläufe aus einem
  fremden PMS nach einem Umzug.
* `guest_message_threads`/`guest_messages` (0181/0196) — der myBestDays-
  Marktplatz, ein Buchungskanal wie Booking oder Airbnb, den wir selbst
  betreiben.
* `channex_webhook_event` (0284/0398) — offene Airbnb-Anfragen (Voranfrage,
  Buchungsanfrage, Änderungswunsch). Sie sind KEINE Buchung und haben deshalb
  keine `channex_booking`-Zeile, verlangen aber innerhalb von 24 Stunden eine
  Entscheidung.

Sie werden GELESEN und in die `InboxThread`-Form gebracht; es wandert nichts
(`channex_booking.channex_booking_id` ist NOT NULL + unique — dort hineinzu-
kommen hieße, eine Channex-ID zu erfinden, Wurzel 4). Jede Quelle trägt einen
eigenen ID-Präfix, damit der Lesepfad sie wiedererkennt.

WOZU DIESES MODUL: Die Einmisch-Regeln (welcher Scope? welche Ansicht?) sind je
Quelle verschieden und wachsen mit jedem Kanal. Stünden sie in `list_threads`,
wüchse diese Methode mit jeder Anbindung weiter — hier stehen sie an EINER
Stelle, und ein neuer Kanal ist ein Eintrag statt eines weiteren `if`-Blocks
mitten im Lesepfad.
"""
from __future__ import annotations

from supabase import Client

from . import anfragen, marktplatz, uebernahme
from .errors import InboxError
from .schemas import InboxMessagesResponse, InboxThread


class NebenquellenMixin:
    """Threads der Nicht-Channex-Quellen für `list_threads`."""

    def _nebenquelle_verlauf(
        self, db: Client, tenant_id: str, thread_id: str, *, scope: str
    ) -> InboxMessagesResponse | None:
        """Verlauf, wenn der Thread aus einer Nebenquelle stammt — sonst `None`.

        `None` heißt „nicht meine Zuständigkeit"; der Aufrufer geht dann den
        normalen `channex_booking`-Weg. Diese Quellen haben dort keine Zeile,
        der reguläre Ladepfad fände sie also gar nicht.
        """
        if uebernahme.ist_uebernahme(thread_id):
            return uebernahme.verlauf_antwort(
                db, tenant_id, thread_id, scope=scope
            )
        if anfragen.ist_anfrage(thread_id):
            # Scope wie in der Liste (Wurzel 9): ein Nutzer mit
            # „assigned"-Posteingang sieht Anfragen dort nicht, also auch hier
            # nicht — sonst wäre die Detailansicht offener als die Liste.
            if scope != "all":
                raise InboxError("Thread nicht gefunden.", status_code=404)
            # Der Channex-Client wandert mit: nur ueber ihn kommt der
            # VOLLSTAENDIGE Nachrichtentext (der Spiegel traegt den
            # Webhook-Anschnitt). `getattr`, weil dieses Mixin den Client nicht
            # deklariert — er gehoert dem Service.
            antwort = anfragen.verlauf_antwort(
                db, tenant_id, thread_id,
                client=getattr(self, "_channex", None),
            )
            if not antwort.items:
                raise InboxError("Thread nicht gefunden.", status_code=404)
            return antwort
        if marktplatz.ist_marktplatz(thread_id):
            # Scope wie in der Liste (Wurzel 9): sonst wäre die Detailansicht
            # offener als die Liste, die diesen Thread gar nicht zeigt.
            if scope != "all":
                raise InboxError("Thread nicht gefunden.", status_code=404)
            return marktplatz.verlauf_antwort(db, tenant_id, thread_id)
        return None

    @staticmethod
    def _nebenquelle_antwort_ablehnen(thread_id: str) -> None:
        """Antworten auf Nebenquellen-Threads sauber abweisen.

        Beide Quellen haben einen Grund, warum hier nichts rausgeht — und der
        gehört benannt, statt „nicht gefunden" zu behaupten oder eine Nachricht
        zu schreiben, die nie ankommt (Wurzel 5).
        """
        if uebernahme.ist_uebernahme(thread_id):
            # Eingefrorenes Archiv: der Kanal, über den es lief, gehört uns
            # nicht mehr.
            raise InboxError(
                "Übernommener Verlauf — hier kann nicht geantwortet werden.",
                status_code=422,
            )
        if marktplatz.ist_marktplatz(thread_id):
            # Der Marktplatz hat seinen EIGENEN Sendeweg (host_messages, 0196):
            # er schreibt nach `guest_messages`, aktualisiert `last_message_at`
            # und benachrichtigt den Gast. Ein zweiter Pfad hier würde entweder
            # die halbe Logik verdoppeln oder eine Nachricht schreiben, die der
            # Gast nie sieht.
            raise InboxError(
                "Marktplatz-Konversation — Antwort über den Marktplatz-Posteingang.",
                status_code=422,
            )

    @staticmethod
    def _nebenquellen_threads(
        db: Client, tenant_id: str, *, status: str, scope: str
    ) -> list[InboxThread]:
        """Threads aller Nebenquellen für diese Ansicht.

        SCOPE (Wurzel 9, fail-closed): nur bei `scope="all"`. „assigned" heißt
        „nur die MIR zugewiesenen Threads" — keine dieser Quellen kennt eine
        Zuweisung. Sie trotzdem zu zeigen gäbe einem Mitarbeiter mit
        eingeschränktem Posteingang Gastkorrespondenz, die er im OTA-Pfad nicht
        bekäme. Im Zweifel lieber nicht anzeigen.
        """
        if scope != "all":
            return []

        out: list[InboxThread] = []

        # Übernahme: ein eingefrorenes Archiv kennt weder „archiviert" noch
        # „Papierkorb" — es gehört nur in die aktive Ansicht.
        if status == "active":
            out.extend(uebernahme.threads_lesen(db, tenant_id))

        # Marktplatz: kennt sehr wohl ein Archiv (`host_archived`), also wird
        # gefiltert statt die Quelle wegzulassen.
        if status in ("active", "archived"):
            archiv = status == "archived"
            out.extend(
                t for t in marktplatz.threads_lesen(db, tenant_id)
                if t.is_archived == archiv
            )

        # Airbnb-Anfragen: eine OFFENE Anfrage ist per Definition unerledigt und
        # gehört nur in die aktive Ansicht. Beantwortete werden gar nicht erst
        # gelesen — sie sind entweder zur Buchung geworden (eigener Thread) oder
        # abgelehnt.
        if status == "active":
            out.extend(anfragen.threads_lesen(db, tenant_id))

        return out
