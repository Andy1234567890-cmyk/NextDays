"""Lesestand des Gastes vom Portal holen (0297).

WAS DAMIT BEANTWORTET WIRD: „Hat der Gast meine Nachricht gelesen?" Bisher war
das im Posteingang nicht zu sehen — eine gesendete Nachricht sah genauso aus,
ob sie angekommen war oder ins Leere ging.

WER ES LIEFERT: Nur Airbnb, und nur direkt. Channex führt gar keinen Lesestand
(nachgemessen: die Nachricht trägt `sender`, `message`, `inserted_at`,
`updated_at`, `attachments`; der Thread `is_closed`, `last_message`,
`last_message_received_at`, `message_count` — nichts davon sagt etwas über
Lesen). Airbnb hat es am Thread:

    GET v2/threads/{id} → "last_message_reads": [
      {"message_id": "…", "user_id": "6776750", "created_at": "…T08:13:03Z"}]

WIE ES ZU LESEN IST: Das ist EIN LESESTAND je Teilnehmer, keine Liste gelesener
Nachrichten — „dieser Nutzer war bis hierher". Alles Ältere ist damit ebenfalls
gelesen. Wer daraus eine Menge von IDs machte, zeigte für jede ältere Nachricht
faelschlich „ungelesen".

WELCHER EINTRAG ZÄHLT: der des GASTES. Die Rolle steht in `thread.users[]`
(`GUEST`/`HOST`); die Host-Zeile ist unser eigener Lesestand und für die Frage
belanglos. Ohne diese Unterscheidung stünde am eigenen Text ein Häkchen, sobald
der Betrieb selbst den Thread geöffnet hat — eine Bestätigung, die nichts
bestätigt.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Final

from supabase import Client

from .airbnb_konten import kontoweise
from .common import ChannelManagerError, log, ota_zeitstempel_utc

# Obergrenze je Lauf: ein Thread-Abruf pro Buchung, das summiert sich.
_GRENZE_JE_LAUF: Final = 50

# Wie lange nach der Abreise ein Thread noch beobachtet wird. 30 Tage deckt die
# Nachkorrespondenz ab (Airbnbs Bewertungsfrist sind 14 Tage); danach ändert sich
# der Lesestand nicht mehr und ein weiterer Abruf wäre sichere Verschwendung.
_NACHLAUF_TAGE: Final = 30

# Wie weit VOR der Anreise ein Thread beobachtet wird. 90 Tage: die
# Gastkorrespondenz (Anreisezeit, Schlüssel, Fragen) läuft in den Wochen vor der
# Ankunft, nicht ein Jahr davor. Grosszügig gewählt, weil ein zu enges Fenster
# einen echten Lesestand übersehen würde — und das Häkchen im Posteingang ist
# genau dann falsch, wenn es fehlt.
_VORLAUF_TAGE: Final = 90


def gast_lesestand(thread: dict[str, Any]) -> tuple[str | None, str | None]:
    """Airbnb-Thread → (message_id, Zeitpunkt) des GASTES; (None, None) ohne.

    Die Rolle entscheidet, nicht die Reihenfolge: `last_message_reads` ist nicht
    sortiert, und welcher Eintrag zuerst kommt, wechselt.
    """
    gast_ids = {
        str(u.get("id"))
        for u in (thread.get("users") or [])
        if isinstance(u, dict) and str(u.get("role") or "").upper() == "GUEST"
    }
    if not gast_ids:
        return None, None
    for eintrag in thread.get("last_message_reads") or []:
        if not isinstance(eintrag, dict):
            continue
        if str(eintrag.get("user_id")) in gast_ids:
            return (
                str(eintrag.get("message_id") or "") or None,
                ota_zeitstempel_utc(eintrag.get("created_at")),
            )
    return None, None


class AirbnbLesestandMixin:
    """Lesestände nachziehen — als Teil des ChannelManagerService."""

    def airbnb_lesestand_lesen(
        self, token: str, thread_id: str
    ) -> tuple[str | None, str | None]:
        """Den Lesestand EINES Airbnb-Threads holen."""
        antwort = self._airbnb_get(  # type: ignore[attr-defined]
            token, f"v2/threads/{thread_id}", {"_format": "for_api_partners"}
        )
        thread = (antwort or {}).get("thread")
        return gast_lesestand(thread) if isinstance(thread, dict) else (None, None)

    def lesestaende_aktualisieren(
        self, grenze: int = _GRENZE_JE_LAUF
    ) -> dict[str, int]:
        """Lesestände der jüngsten Threads auffrischen (Worker-Tick).

        Anders als die übrigen Heilungen füllt das keine LÜCKE, sondern hält
        einen Wert aktuell: Ein Gast liest auch morgen noch, und ein Häkchen,
        das beim ersten Mal gesetzt wurde und danach nie wieder, wäre schlimmer
        als keins. Deshalb werden die JÜNGSTEN Threads erneut geprüft, nicht die
        ohne Wert.

        Grenze je Tenant, nicht global — sonst verdrängt ein großer Betrieb alle
        anderen dauerhaft (live passiert: 13 von 23 Anreisezeiten gesetzt, weil
        fremde Zeilen das Kontingent füllten).
        """
        db = self._require_db()  # type: ignore[attr-defined]
        je_tenant = self._juengste_threads(db, grenze)
        if not je_tenant:
            return {"geprueft": 0, "gesetzt": 0}

        gesetzt = 0
        geprueft = 0
        for tenant_id, zeilen in je_tenant.items():
            geprueft += len(zeilen)
            try:
                gesetzt += self._lesestaende_eines_tenants(db, tenant_id, zeilen)
            except (ChannelManagerError, OSError) as exc:
                log.warning(
                    "lesestand_tenant_fehlgeschlagen",
                    tenant_id=tenant_id, error=str(exc)[:200],
                )
        log.info(
            "lesestaende_aktualisiert",
            geprueft=geprueft, gesetzt=gesetzt, tenants=len(je_tenant),
        )
        return {"geprueft": geprueft, "gesetzt": gesetzt}

    @staticmethod
    def _juengste_threads(
        db: Client, grenze: int
    ) -> dict[str, list[dict[str, Any]]]:
        """Die Airbnb-Threads je Tenant, deren Lesestand sich noch ändern kann.

        WARUM NICHT EINFACH „DIE JÜNGSTEN" (12.08.2026, live gemessen): Vorher
        stand hier nur `eq("ota_name", "AirBNB")` — ohne jede weitere Einschränkung
        wurden alle 22 Airbnb-Buchungen des Betriebs bei JEDEM Tick abgerufen, ein
        `GET v2/threads/{id}` pro Zeile, alle fünf Minuten. Das Log zeigte über 15
        Läufe in Folge `{"geprueft": 22, "gesetzt": 0}`.

        Der Vergleich `guest_read_message_ref == ref` weiter unten spart nur den
        SCHREIBaufruf — der HTTP-Aufruf ist da längst passiert. Gefiltert werden
        muss also HIER, vor dem Abruf.

        Das Fenster hat ZWEI Ränder, beide live gemessen (5,0 s je Thread-Abruf):

          hinten  `_NACHLAUF_TAGE` nach der Abreise. Danach schreibt und liest im
                  Thread praktisch niemand mehr; ein Lesestand von damals bleibt
                  für immer, wie er ist.
          vorne   `_VORLAUF_TAGE` vor der Anreise. Von den 22 Threads des
                  Beta-Betriebs reisten 8 erst im Folgejahr an (bis 15.07.2027) —
                  deren Lesestand alle fünf Minuten abzufragen kostete 40 s je
                  Tick für eine Auskunft, die sich Monate lang nicht ändert.

        Buchungen ohne Datumsangabe bleiben drin — eine fehlende Angabe darf nicht
        dazu führen, dass etwas nie geprüft wird (Wurzel 4: keine Annahme an der
        Stelle einer fehlenden Angabe).
        """
        heute = date.today()
        nachlauf = (heute - timedelta(days=_NACHLAUF_TAGE)).isoformat()
        vorlauf = (heute + timedelta(days=_VORLAUF_TAGE)).isoformat()
        # `check_out`/`check_in` stehen an der Reservierung, nicht an der Buchung.
        # Ein Join geht über PostgREST nicht ohne Fremdschlüssel-Einbettung,
        # deshalb zwei Schritte: erst die relevanten Referenzen, dann die
        # Buchungen dazu.
        frisch = (
            db.table("reservations")
            .select("external_ref")
            .eq("channel", "airbnb")
            .gte("check_out", nachlauf)
            .lte("check_in", vorlauf)
            .not_.is_("external_ref", "null")
            .limit(grenze * 50)
            .execute()
        ).data or []
        codes = [str(r["external_ref"]) for r in frisch if r.get("external_ref")]
        if not codes:
            return {}

        zeilen = (
            db.table("channex_booking")
            .select("id, tenant_id, ota_reservation_code, guest_read_message_ref")
            .eq("ota_name", "AirBNB")
            .in_("ota_reservation_code", codes)
            .order("booked_at", desc=True, nullsfirst=False)
            .limit(grenze * 50)
            .execute()
        ).data or []
        je_tenant: dict[str, list[dict[str, Any]]] = {}
        for zeile in zeilen:
            tid = str(zeile.get("tenant_id") or "")
            if tid and len(je_tenant.setdefault(tid, [])) < grenze:
                je_tenant[tid].append(zeile)
        return je_tenant

    def _lesestaende_eines_tenants(
        self, db: Client, tenant_id: str, zeilen: list[dict[str, Any]]
    ) -> int:
        """Die Lesestände eines Betriebs holen — je verbundenem Konto einmal.

        Ein Betrieb kann mehrere Airbnb-Konten führen (0304). Der Bestandsabruf
        gilt immer für GENAU EIN Konto: mit dem Token von Konto A findet man
        die Threads von Konto B nicht. Deshalb läuft die Schleife über die
        Konten, und jede Buchung wird nur mit dem Token ihres eigenen Kontos
        gesucht.
        """
        return kontoweise(db, tenant_id, zeilen, self._lesestaende_eines_kontos)

    def _lesestaende_eines_kontos(
        self, db: Client, tenant_id: str, zeilen: list[dict[str, Any]],
        channel_id: str,
    ) -> int:
        """Die Lesestände EINES Kontos holen und setzen."""
        zugang = self._airbnb_token_am_kanal(channel_id)  # type: ignore[attr-defined]
        if not zugang:
            return 0
        token = zugang[0]

        # Bestätigungscode → Airbnb-Thread-ID. Ein Bestandsabruf statt eines
        # Aufrufs je Buchung; die Reservierung führt `thread_id` mit.
        threads = self._thread_ids_des_kontos(db, token)

        gesetzt = 0
        for zeile in zeilen:
            thread_id = threads.get(str(zeile.get("ota_reservation_code") or ""))
            if not thread_id:
                continue
            ref, gelesen_am = self.airbnb_lesestand_lesen(token, thread_id)
            if not gelesen_am:
                continue
            # Unverändert? Dann kein Schreibaufruf — der Tick läuft alle fünf
            # Minuten über dieselben Threads.
            if zeile.get("guest_read_message_ref") == ref:
                continue
            (
                db.table("channex_booking")
                .update(
                    {"guest_read_message_ref": ref, "guest_read_at": gelesen_am}
                )
                .eq("tenant_id", tenant_id)
                .eq("id", zeile["id"])
                .execute()
            )
            gesetzt += 1
        return gesetzt

    def _thread_ids_des_kontos(self, db: Client, token: str) -> dict[str, str]:
        """Bestätigungscode → Airbnb-Thread-ID, für den ganzen Bestand.

        Channex reicht die Airbnb-Thread-ID nicht durch (`raw` führt sie nicht),
        und sein eigener `message_thread`-Bezug ist bei diesen Buchungen leer
        (live geprüft: `relationships.message_thread` = null). Bei Airbnb steht
        sie an der Reservierung.
        """
        gelesen = self.nachpflege_bestand(db, token)  # type: ignore[attr-defined]
        if gelesen is None:
            return {}
        ids: dict[str, str] = {}
        for buchung in gelesen.buchungen:
            code = str(buchung.get("confirmation_code") or "")
            thread = buchung.get("thread_id")
            if code and thread:
                ids[code] = str(thread)
        return ids
