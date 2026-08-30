"""Ereignis-Journal von Channex nachziehen (LiveFeedEvents).

WARUM DIESES MODUL EXISTIERT:
Für Buchungen hat die Architektur zwei Wege — den Webhook (schnell) und den
Revisions-Feed als Backstop (verlässlich). Für ALLES ANDERE gab es nur den
Webhook. Ging der verloren (unser Server kurz weg, Secret-Drift, Channex gibt
nach ~24 h auf), war das Ereignis unwiederbringlich weg: Sync-Fehler,
Systemmeldungen von Airbnb — und vor allem die handlungspflichtigen Anfragen.

Airbnbs `live_feed` ist genau dieser fehlende zweite Weg. Anders als der
Revisions-Feed ist es ein JOURNAL: es verschwindet nichts durch ein Ack, man kann
nachträglich filtern (`filter[event]`, `filter[property_id]`), und es enthält alle
Ereignisarten — von denen Buchungen nur drei sind.

Live gegen den Produktivaccount gemessen (05.08.2026, Konto AirSmil):
    GET live_feed                        → 200, total=4
    GET live_feed?filter[event]=review   → 200, total=4  (echte Gästebewertungen)
    GET live_feed?filter[event]=erfunden → 422 {"filter":["is_invalid"]}
    GET erfundene_kontrolle_zzz          → 404 resource_not_found
Der 422 auf einen erfundenen Ereignisnamen ist der Beleg, dass der Filter
serverseitig wirklich greift — eine 200 mit leerer Liste hätte auch „still
ignoriert" heißen können. Die vier Ereignisse waren Bewertungen mit
Kategoriescores und Airbnb-Bewertungsschlagworten, eine davon bereits mit
Gastgeber-Antwort.

WAS DIESES MODUL NICHT TUT:
Es wendet keine Payload-Daten an. Das Journal ist wie der Webhook ein Trigger:
Buchungen holt der Revisions-Feed, Bewertungen der Bewertungs-Sync. Hier wird nur
festgehalten, DASS etwas passiert ist — und bei Anfragen die Ereignis-ID gesichert,
ohne die keine Antwort an Airbnb möglich ist.
"""
from __future__ import annotations

from typing import Any

from .airbnb_anfragen import AUFLOESBARE_EVENTS
from .common import log

# Eine Seite je Abruf. Das Journal hält laut Channex einen Monat Historie — wir
# holen bewusst nur die jüngsten Seiten, nicht die ganze Historie: der Tick läuft
# regelmäßig, und ein Nachlauf über Monate wäre teuer ohne Nutzen.
_SEITEN_GROESSE = 100
_MAX_SEITEN = 5


def _attrs(zeile: dict[str, Any]) -> dict[str, Any]:
    attrs = zeile.get("attributes")
    return attrs if isinstance(attrs, dict) else {}


def _property_id_aus(attrs: dict[str, Any]) -> str | None:
    """Die Channex-Property-ID eines Ereignisses.

    Airbnbs Dokument zeigt sie NEBEN `payload`, nicht darin — beide Orte werden
    gelesen, weil die gemessenen Bewertungs-Ereignisse sie im Payload trugen.
    """
    direkt = attrs.get("property_id")
    if isinstance(direkt, str) and direkt.strip():
        return direkt.strip()
    payload = attrs.get("payload")
    if isinstance(payload, dict):
        innen = payload.get("property_id")
        if isinstance(innen, str) and innen.strip():
            return innen.strip()
    return None


class LiveFeedSyncMixin:
    """Journal-Abruf als Backstop für alles, was kein Buchungs-Ereignis ist."""

    def live_feed_nachziehen(self, *, seiten: int = _MAX_SEITEN) -> dict[str, int]:
        """Das Journal durchgehen und Ereignisse spiegeln, die uns fehlen.

        Idempotent (Wurzel 2): jedes Ereignis wird über seine Channex-ID erkannt,
        Doppelte werden nicht erneut geschrieben — der UNIQUE-Index aus 0284 ist
        der Backstop, falls zwei Ticks gleichzeitig laufen.
        """
        client = self._channex
        gesehen = 0
        neu = 0
        uebersprungen = 0

        for seite in range(1, max(1, seiten) + 1):
            antwort = client.get_live_feed(page=seite, limit=_SEITEN_GROESSE)
            zeilen = antwort.get("data")
            if not isinstance(zeilen, list) or not zeilen:
                break

            for zeile in zeilen:
                gesehen += 1
                if self._journal_ereignis_spiegeln(zeile):
                    neu += 1
                else:
                    uebersprungen += 1

            meta = antwort.get("meta") if isinstance(antwort.get("meta"), dict) else {}
            gesamt = meta.get("total")
            if isinstance(gesamt, int) and seite * _SEITEN_GROESSE >= gesamt:
                break
        else:
            # Kein stilles Kappen (Wurzel 5): wenn die Seitengrenze greift, steht
            # im Log, dass wir NICHT vollständig waren.
            log.warning("live_feed_seitengrenze_erreicht", seiten=seiten)

        log.info(
            "live_feed_nachgezogen", gesehen=gesehen, neu=neu,
            uebersprungen=uebersprungen,
        )
        return {"gesehen": gesehen, "neu": neu, "uebersprungen": uebersprungen}

    @staticmethod
    def _kennung(zeile: dict[str, Any]) -> tuple[str, str] | None:
        """(Ereignis-ID, Ereignisname) — oder None, wenn eines fehlt.

        Ohne Ereignis-ID ist später keine Antwort an Airbnb möglich; ohne Namen
        wüssten wir nicht, was passiert ist. Beides ist ein Grund, das Ereignis
        NICHT zu speichern, statt es halb abzulegen.
        """
        attrs = _attrs(zeile)
        live_id = attrs.get("id") or zeile.get("id")
        event = attrs.get("event")
        if not isinstance(live_id, str) or not live_id.strip():
            return None
        if not isinstance(event, str) or not event.strip():
            return None
        return live_id.strip(), event.strip()

    def _nachricht_nachziehen(self, tenant_id: str, payload: dict[str, Any]) -> None:
        """Nachricht spiegeln UND die Abwesenheitsantwort planen.

        Der Tick ist der Backstop für ausgefallene Webhooks — bis hierher zog er
        aber nur den Spiegel nach, nicht die Automation. Fiel der Webhook-
        Endpunkt aus (real passiert: elf Minuten 503 am 06.08.2026), bekam kein
        Gast eine Abwesenheitsantwort, obwohl die Nachrichten ankamen: das
        Feature existierte auf diesem Weg schlicht nicht.

        Wie im Webhook gilt: Zählstand VOR dem Spiegeln nehmen (danach steht die
        neue Nachricht schon in der Tabelle und kein Thread wäre je „neu"), und
        nur auf Gastnachrichten antworten. Mehrfaches Feuern ist über den
        Unique-Index (automation_id, thread_id) ausgeschlossen — der Tick darf
        dieselbe Nachricht also gefahrlos erneut sehen.
        """
        if self._db is None:
            return
        try:
            from src.features.inbox.service import InboxService  # noqa: PLC0415

            svc = InboxService(service_client=self._db)
            ref = self._booking_ref_aus_message(payload)
            vorher = svc.zaehle_gastnachrichten_je_buchung(tenant_id, ref) if ref else 0

            thread_id = self.nachricht_spiegeln(tenant_id, payload)
            if thread_id is None:
                return
            if (payload.get("sender") or "").strip().lower() != "guest":
                return

            svc.schedule_message_received(
                tenant_id, thread_id, ist_erste_nachricht=vorher == 0
            )
            # Zwei Gegenzustände in EINEM Schritt (Wurzel 1): eine neue
            # Gastnachricht macht eine wartende KI-Antwort ungültig — sie
            # beantwortet dann die vorige Frage, während der Gast schon
            # nachgeschoben hat. Erst abräumen, dann neu planen.
            svc.autoantwort_abbrechen(
                tenant_id, thread_id, "Neue Gastnachricht eingegangen"
            )
            svc.autoantwort_planen(tenant_id, thread_id)
        except Exception as exc:  # noqa: BLE001 — Tick nie kippen
            log.warning(
                "journal_nachricht_verarbeitung_fehlgeschlagen", error=str(exc)[:300]
            )

    def _journal_ereignis_spiegeln(self, zeile: dict[str, Any]) -> bool:
        """Ein Journal-Ereignis in die Ereignisliste schreiben. True = neu."""
        if self._db is None:
            return False
        kennung = self._kennung(zeile)
        if kennung is None:
            return False
        live_id, event = kennung
        attrs = _attrs(zeile)

        channex_property_id = _property_id_aus(attrs)
        tenant_id, property_id = self._resolve_webhook_property(channex_property_id)
        if tenant_id is None:
            # Ereignis einer Property, die uns nicht gehört (das Channex-Konto ist
            # kontoweit, white-label). Nicht persistieren — Wurzel 3.
            return False

        # Nachrichten VOR dem Dedup-Check spiegeln (0305). Der Check fragt die
        # EREIGNISLISTE — für Nachrichten ist sie aber gar nicht der Speicher
        # (`_UNPERSISTED_EVENTS`), also stünde dort nie ein Treffer und ein
        # späterer Aufruf käme trotzdem hier durch. Umgekehrt gilt: stünde der
        # Spiegel-Aufruf HINTER dem Check, würde er beim ersten Durchlauf laufen
        # und danach nie wieder — und genau das Nachziehen, für das dieser Tick
        # existiert, fiele aus. Die Idempotenz sitzt deshalb dort, wo sie
        # hingehört: am UNIQUE-Index von `portal_messages` (Wurzel 2).
        if event == "message":
            self._nachricht_nachziehen(str(tenant_id), attrs.get("payload") or {})

        if self._journal_ereignis_bekannt(str(tenant_id), live_id):
            return False

        severity = self._journal_severity(event)
        try:
            self._db.table("channex_webhook_event").insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "event": event,
                    "payload": attrs.get("payload") or {},
                    "severity": severity,
                    "live_feed_event_id": live_id,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — der Tick darf nie kippen
            # Häufigster Fall: der UNIQUE-Index hat einen Doppelten abgewehrt
            # (zwei Ticks gleichzeitig). Das ist der gewünschte Ausgang.
            log.info(
                "live_feed_ereignis_nicht_gespeichert",
                live_feed_event_id=live_id, error=str(exc)[:200],
            )
            return False

        if event in AUFLOESBARE_EVENTS:
            log.warning(
                "airbnb_anfrage_offen", webhook_event=event,
                live_feed_event_id=live_id, tenant_id=tenant_id,
                property_id=property_id,
            )
            # Die Anfrage MELDEN, nicht nur loggen (0398). Ein Logeintrag
            # erreicht niemanden im Betrieb, und Airbnb lehnt nach der in
            # `non_response_at` genannten Frist selbst ab — eine unbemerkte
            # Anfrage ist damit eine verlorene Buchung ohne jede Spur.
            #
            # Erst NACH dem erfolgreichen Insert: der Thread des Posteingangs
            # heisst `anfrage:<id unserer Zeile>`, den gibt es vorher nicht.
            self._anfrage_melden(str(tenant_id), attrs.get("payload") or {}, event)
        return True

    def _anfrage_melden(
        self, tenant_id: str, payload: dict[str, Any], event: str
    ) -> None:
        """Glocke + Mail fuer eine neu eingetroffene Anfrage.

        Best-effort (Wurzel 5): der Tick darf daran nie kippen — die Anfrage
        steht dann trotzdem im Posteingang, nur die Meldung fehlt.

        Die Zeile wird ueber die Channex-Ereignis-ID zurueckgelesen statt aus
        dem Insert-Ergebnis: derselbe Vorgang kommt auf ZWEI Wegen herein
        (Webhook zuerst, Tick danach), und gemeldet werden soll der Thread, den
        der Posteingang auch fuehrt — sonst zeigt die Glocke auf einen zweiten,
        gleich aussehenden Eintrag.
        """
        if self._db is None:
            return
        try:
            from src.features.inbox import anfragen  # noqa: PLC0415
            from src.features.notification_settings.ereignisse import (  # noqa: PLC0415
                melde_offene_anfrage,
            )

            live_id = anfragen.live_feed_id_aus(payload)
            if not live_id:
                return
            zeilen = (
                self._db.table("channex_webhook_event")
                .select("id, property_id")
                .eq("tenant_id", tenant_id)
                .eq("live_feed_event_id", live_id)
                .limit(1)
                .execute()
            ).data or []
            if not zeilen:
                return

            details = anfragen.details_aus(payload)
            an = details.get("checkin_date")
            ab = details.get("checkout_date")
            melde_offene_anfrage(
                self._db,
                tenant_id=tenant_id,
                thread_id=anfragen.thread_id_fuer(str(zeilen[0]["id"])),
                art=event,
                property_id=zeilen[0].get("property_id"),
                objekt=details.get("listing_name"),
                # Der Zeitraum als Rohwerte des Portals — kein Datumsformat
                # erfinden, das die Sprache des Empfaengers nicht kennt.
                zeitraum=f"{an} – {ab}" if an and ab else None,
            )
        except Exception as exc:  # noqa: BLE001 — der Tick darf nie kippen
            log.warning("anfrage_melden_fehlgeschlagen", error=str(exc)[:200])

    def _journal_ereignis_bekannt(self, tenant_id: str, live_id: str) -> bool:
        """Haben wir dieses Ereignis schon? Gescopt auf den Tenant (Wurzel 3)."""
        if self._db is None:
            return False
        try:
            treffer = (
                self._db.table("channex_webhook_event")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("live_feed_event_id", live_id)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — lieber doppelt prüfen als kippen
            log.warning("live_feed_dedup_pruefung_fehlgeschlagen", error=str(exc)[:200])
            return False
        return bool(treffer)

    def _journal_severity(self, event: str) -> str:
        """Dieselbe Einordnung wie beim Webhook — eine Quelle, eine Bedeutung."""
        if event in self._ERROR_EVENTS:
            return "error"
        if event in self._ACTION_EVENTS:
            return "action"
        return "info"
