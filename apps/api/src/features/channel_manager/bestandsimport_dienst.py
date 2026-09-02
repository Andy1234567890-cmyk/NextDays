"""Serverseitiger Datei-Bestandsimport: Lauf starten, abarbeiten, Stand melden.

WARUM ES DIESEN WEG GIBT: Der Datei-Import lief bis zum 31.08.2026 in EINER
HTTP-Anfrage. Live gemessen an einem Booking.com-Export mit 252 Zeilen: 3,6 s je
Zeile, also rund 15 Minuten. Der Browser bricht lange vorher ab und zeigt
„Backend nicht erreichbar.", waehrend der Server unbeirrt weiterschreibt — der
Betrieb sah einen Fehler UND hatte einen halb angelegten Bestand. Gemeldet wurde
es als „Upload Booking Buchungsliste funktioniert nicht".

Derselbe Aufbau wie `airbnb_historie_dienst` (0301): der Klick reiht nur einen
Job ein, der Worker arbeitet ihn ab und schreibt nach JEDER Zeile seinen Stand
nach `bestandsimport_lauf`, die Oberflaeche liest ihn per Realtime. Die Seite
darf geschlossen werden.

Der Parser bleibt, wo er ist (`csv_import`): hier steht nur die Lauf-Steuerung.
"""
from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.jobs.queue import enqueue

from .common import ChannelManagerError, log

# Wie oft der Stand geschrieben wird. NICHT nach jeder Zeile: das waeren bei 252
# Zeilen 252 zusaetzliche UPDATEs auf dieselbe Zeile, also spuerbar mehr Last fuer
# eine Anzeige, die niemand in Einerschritten liest. Alle 5 Zeilen ist fein genug
# fuer einen fluessigen Balken (bei ~1,7 s/Zeile gut alle 8 s ein Sprung) und
# grob genug, um nicht selbst zum Kostenfaktor zu werden.
_TAKT = 5

# Ab wann ein Lauf ohne jede Regung als verwaist gilt. Grosszuegig gewaehlt: der
# Worker schreibt alle `_TAKT` Zeilen, bei ~3,5 s/Zeile also gut alle 18 s. Zehn
# Minuten Stille heissen daher zuverlaessig „da arbeitet niemand", nicht „das
# dauert gerade".
_VERWAIST_MIN = 10


class BestandsimportDienstMixin:
    """Lauf-Steuerung des Datei-Bestandsimports."""

    def bestandsimport_starten(
        self, ctx: AuthContext, *, content: str, quelle: str | None = None
    ) -> dict[str, Any]:
        """Einen Lauf einreihen und seine Zeile zurueckgeben.

        Der Klick wartet NICHT auf den Import. Laeuft schon einer, wird DIESER
        zurueckgegeben statt ein zweiter gestartet: zwei parallele Laeufe
        schrieben dieselben Buchungen gleichzeitig (Wurzel 2). Der partielle
        Unique-Index ist der Backstop.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]

        # VOR dem Einreihen pruefen, nicht erst im Worker: eine Datei mit
        # fehlender Pflichtspalte soll sofort 422 geben, solange der Nutzer
        # davorsitzt — nicht drei Sekunden spaeter als Lauf im Status „fehler".
        zeilen = self._bestandsimport_zeilen_zaehlen(content)
        if zeilen == 0:
            raise ChannelManagerError(
                "Die Datei enthaelt keine uebernehmbare Zeile.", status_code=422
            )

        try:
            offen = (
                db.table("bestandsimport_lauf")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("status", "laeuft")
                .limit(1)
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001 — Supabase-Client, Typ variiert
            # Die Tabelle kommt aus Migration 0507. Ist der Code deployt, die
            # Migration aber noch nicht eingespielt, warf dieser Aufruf einen
            # nackten 500 („Internal Server Error"), und in der Oberflaeche
            # stand nichts, womit jemand etwas anfangen kann — live passiert am
            # 31.08.2026. Ein fehlender Migrationsstand ist ein Betriebs-, kein
            # Programmfehler: er gehoert benannt, nicht verschluckt (Wurzel 5).
            if "PGRST205" not in str(exc) and "does not exist" not in str(exc):
                raise
            raise ChannelManagerError(
                "Der Datei-Import ist noch nicht eingerichtet: die Tabelle "
                "`bestandsimport_lauf` fehlt (Migration 0507). Bitte die "
                "Migration einspielen.",
                status_code=503,
            ) from exc
        if offen:
            # Ein Lauf, den nie ein Worker abgeholt hat, blockiert sonst JEDEN
            # weiteren Start — der partielle Unique-Index laesst nur einen
            # offenen zu. Live am 31.08.2026: der Worker lief nicht, der Lauf
            # stand auf `laeuft`, und jeder neue Versuch bekam stumm diese
            # Zeile zurueck statt zu starten. Nach `_VERWAIST_MIN` ohne jede
            # Regung gilt er als verwaist und wird freigegeben, damit ein
            # zweiter Versuch moeglich ist (Wurzel 5: kein stiller Dauerhaenger).
            if self._bestandsimport_verwaist(offen[0]):
                self._bestandsimport_abschliessen(
                    db, str(offen[0]["id"]), status="fehler",
                    fehler=(
                        "Der Import wurde nie von einem Verarbeiter "
                        "abgeholt — laeuft der Worker?"
                    ),
                )
                log.warning(
                    "bestandsimport_lauf_verwaist",
                    tenant_id=tenant_id, lauf_id=str(offen[0]["id"]),
                )
            else:
                return dict(offen[0])

        try:
            zeile = (
                db.table("bestandsimport_lauf")
                .insert({
                    "tenant_id": tenant_id,
                    "gestartet_von": getattr(ctx, "user_id", None),
                    "quelle": quelle,
                    "zeilen_gesamt": zeilen,
                })
                .execute()
            ).data[0]
        except Exception as exc:  # noqa: BLE001 — Supabase-Client, Typ variiert
            # 23505 = der Unique-Index hat einen parallelen Start abgefangen.
            # Das ist der ZIELZUSTAND: den bestehenden Lauf liefern.
            if "23505" not in str(exc):
                raise
            bestehend = (
                db.table("bestandsimport_lauf")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("status", "laeuft")
                .limit(1)
                .execute()
            ).data
            if bestehend:
                return dict(bestehend[0])
            raise

        # Der Dateiinhalt geht in die Job-Payload, nicht in die Lauf-Zeile: die
        # Tabelle ist fuer den Betrieb lesbar (RLS-select), der Rohtext enthaelt
        # Gastnamen und Kontaktdaten. Die Job-Payload liest nur der Worker.
        enqueue(
            db, "bestandsimport",
            payload={"lauf_id": str(zeile["id"]), "tenant_id": tenant_id,
                     "content": content},
            tenant_id=tenant_id,
            # Der Schluessel traegt die LAUF-ID, nicht nur den Tenant.
            #
            # `enqueue` fasst Jobs mit gleichem offenen dedup_key zusammen
            # („letzter gewinnt" auf die Payload). Bei einem Tenant-Schluessel
            # hiesse das: liegt noch irgendein aelterer Import-Job in der
            # Queue, wird der neue STILL verworfen — die Lauf-Zeile steht dann
            # auf `laeuft`, aber niemand arbeitet sie je ab. Genau so passiert
            # am 31.08.2026: Lauf 05:34 mit 252 Zeilen existierte, der einzige
            # Job stammte von 05:29, und der Balken blieb auf 0/252 stehen.
            #
            # Gegen den Doppelstart schuetzt bereits der partielle Unique-Index
            # `bestandsimport_lauf_offen_uq` (nur EIN Lauf mit status='laeuft'
            # je Betrieb) — dafuer braucht es den dedup_key nicht.
            dedup_key=f"bestandsimport:{zeile['id']}",
            # Minutenarbeit mit Schreibwirkung: ein haengengebliebener Versuch
            # soll nicht zehnmal wiederholt werden.
            max_attempts=3,
        )
        log.info(
            "bestandsimport_lauf_gestartet",
            tenant_id=tenant_id, lauf_id=str(zeile["id"]),
            zeilen=zeilen, quelle=quelle,
        )
        return dict(zeile)

    def bestandsimport_aktuell(self, ctx: AuthContext) -> dict[str, Any] | None:
        """Der juengste Lauf dieses Betriebs — fuer die Anzeige beim Seitenaufruf.

        Ohne diesen Weg wuesste eine frisch geladene Seite nichts von einem
        laufenden Import und boete den Knopf an, als sei nichts los.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        try:
            zeilen = (
                db.table("bestandsimport_lauf")
                .select("*")
                .eq("tenant_id", tenant_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001 — Supabase-Client, Typ variiert
            if "PGRST205" not in str(exc) and "does not exist" not in str(exc):
                raise
            # Hier NICHT werfen: dieser Abruf laeuft bei JEDEM Aufruf der
            # Kanalseite. Fehlt die Migration, gaebe ein Fehler die ganze Seite
            # auf, obwohl nur die Fortschrittsanzeige betroffen ist. „Kein Lauf"
            # ist die richtige Auskunft — und der Startpfad sagt dann deutlich,
            # was fehlt.
            log.warning("bestandsimport_lauf_tabelle_fehlt", tenant_id=tenant_id)
            return None
        return dict(zeilen[0]) if zeilen else None

    @staticmethod
    def _bestandsimport_zeilen_zaehlen(content: str) -> int:
        """Wie viele Datenzeilen hat die Datei? Fuer `zeilen_gesamt` beim Start.

        Nutzt dieselbe BOM-/Trennzeichen-Erkennung wie `import_bookings_csv` —
        eine zweite Auslegung derselben Datei waere eine zweite Wahrheit, und der
        Balken zeigte dann eine andere Gesamtzahl als der Import abarbeitet.
        """
        text = content.lstrip("﻿")
        sample = text[:2048]
        delimiter = ";" if sample.count(";") > sample.count(",") else ","
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        if reader.fieldnames is None:
            return 0
        return sum(1 for _ in reader)

    def bestandsimport_ausfuehren(
        self, lauf_id: str, *, payload_content: str | None = None
    ) -> dict[str, Any]:
        """Den eingereihten Lauf abarbeiten — laeuft im WORKER, ohne Sitzung.

        Der Stand wird waehrend des Laufs geschrieben (alle `_TAKT` Zeilen), nicht
        erst am Ende: genau dafuer ist die Tabelle da. Bricht der Worker mitten
        drin ab, steht der letzte erreichte Stand da statt einer Zeile, die ewig
        auf 0 zeigt.
        """
        db = self._require_db()  # type: ignore[attr-defined]
        lauf = (
            db.table("bestandsimport_lauf")
            .select("*")
            .eq("id", lauf_id)
            .limit(1)
            .execute()
        ).data
        if not lauf:
            raise ChannelManagerError("Lauf nicht gefunden.", status_code=404)
        lauf = lauf[0]
        tenant_id = str(lauf["tenant_id"])

        # Der Dateiinhalt steht in der Job-Payload (nicht in der Lauf-Zeile,
        # siehe `bestandsimport_starten`). Der Worker reicht ihn durch.
        content = str(payload_content or "")
        if not content:
            self._bestandsimport_abschliessen(
                db, lauf_id, status="fehler",
                fehler="Der Dateiinhalt fehlt in der Job-Payload.",
            )
            raise ChannelManagerError(
                "Der Dateiinhalt fehlt in der Job-Payload.", status_code=422
            )

        letzter_schreib = [0]

        def melden(fertig: int, gesamt: int, bezeichnung: str) -> None:
            # Nur alle `_TAKT` Zeilen schreiben (und immer die letzte), sonst
            # kostet die Anzeige mehr als der Import selbst.
            if fertig - letzter_schreib[0] < _TAKT and fertig != gesamt:
                return
            letzter_schreib[0] = fertig
            db.table("bestandsimport_lauf").update({
                "zeilen_fertig": fertig,
                "zeilen_gesamt": gesamt,
                "aktuelle_zeile": bezeichnung or None,
                "updated_at": datetime.now(UTC).isoformat(),
            }).eq("id", lauf_id).execute()

        try:
            ergebnis = self.import_bookings_csv(  # type: ignore[attr-defined]
                None, content=content, fortschritt=melden, tenant_id=tenant_id,
            )
        except ChannelManagerError as exc:
            # Ein Abbruch mit Grund (422: Pflichtspalte fehlt, zu viele Zeilen)
            # gehoert SICHTBAR in die Lauf-Zeile — sonst steht sie ewig auf
            # „laeuft" und niemand erfaehrt, woran es lag (Wurzel 5).
            self._bestandsimport_abschliessen(
                db, lauf_id, status="fehler", fehler=exc.message
            )
            raise

        # Fehlerhafte Zeilen namentlich mit Grund: der Betrieb muss wissen,
        # WELCHE Zeile er nachbessern soll. `errors` traegt bereits die
        # Zeilennummer aus `_RowError`.
        gescheitert = [{"grund": e} for e in (ergebnis.errors or [])]
        status = "fertig" if not gescheitert else "unvollstaendig"
        self._bestandsimport_abschliessen(
            db, lauf_id, status=status,
            zeilen_fertig=ergebnis.total_rows,
            zeilen_gesamt=ergebnis.total_rows,
            angelegt=ergebnis.imported,
            aktualisiert=ergebnis.updated,
            uebersprungen=ergebnis.skipped,
            portal=ergebnis.portal,
            fehlerhaft=ergebnis.failed,
            gescheitert=gescheitert,
        )
        log.info(
            "bestandsimport_lauf_fertig",
            tenant_id=tenant_id, lauf_id=lauf_id, status=status,
            zeilen=ergebnis.total_rows, angelegt=ergebnis.imported,
            aktualisiert=ergebnis.updated,
            uebersprungen=ergebnis.skipped, portal=ergebnis.portal,
            fehlerhaft=ergebnis.failed,
        )
        return {
            "status": status,
            "zeilen": ergebnis.total_rows,
            "angelegt": ergebnis.imported,
            "aktualisiert": ergebnis.updated,
            "uebersprungen": ergebnis.skipped,
            "portal": ergebnis.portal,
            "fehlerhaft": ergebnis.failed,
            "gescheitert": gescheitert,
        }

    @staticmethod
    def _bestandsimport_verwaist(lauf: dict[str, Any]) -> bool:
        """Hat sich an diesem Lauf seit `_VERWAIST_MIN` nichts mehr getan?"""
        roh = lauf.get("updated_at") or lauf.get("created_at")
        if not roh:
            return False
        try:
            stand = datetime.fromisoformat(str(roh).replace("Z", "+00:00"))
        except ValueError:
            # Unlesbarer Zeitstempel: NICHT freigeben. Ein laufender Import
            # waere sonst mitten in der Arbeit als „verwaist" abgeraeumt.
            return False
        if stand.tzinfo is None:
            stand = stand.replace(tzinfo=UTC)
        return (datetime.now(UTC) - stand).total_seconds() > _VERWAIST_MIN * 60

    @staticmethod
    def _bestandsimport_abschliessen(
        db: Client, lauf_id: str, *, status: str, **felder: object
    ) -> None:
        """Endzustand des Laufs schreiben. EINE Stelle, damit kein Abbruchpfad
        die Zeile auf „laeuft" stehen laesst."""
        db.table("bestandsimport_lauf").update({
            "status": status,
            "aktuelle_zeile": None,
            "beendet_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
            **felder,
        }).eq("id", lauf_id).execute()
