"""Abgleich Feed-Staging ↔ Reservierungen — die Selbstheilung, kein Handgriff.

WARUM ES DIESEN ABGLEICH GIBT: Die Staging-Tabelle `channex_booking` haelt den
Original-Payload jeder Portal-Buchung. Die Reservierung daneben ist eine
PROJEKTION daraus — und die kann auseinanderlaufen, ohne dass es jemand sieht:

  * Ein CSV-Bestandsimport ueberschrieb am 31.08.2026 54 Feed-Buchungen ueber
    den Bestaetigungscode (Quelle `csv:`, Payload-Bezug weg, `booked_at` leer).
    Die Abrechnung meldete danach „Portal hat keine Gebuehren gemeldet", der
    Betrieb fand es am Objekt Rævlingehuset von Hand, Channex danebengelegt.
  * Eine Feed-Zeile kann ohne Reservierung bleiben, wenn die Projektion beim
    Eingang scheiterte (Objekt noch nicht gemappt, keine freie Einheit, Fehler
    im Nachlauf). Die Revision ist geackt — Channex liefert sie nie wieder.

Beide Faelle wurden bisher von Hand gefunden und von Hand repariert. Das
skaliert nicht auf 100 Betriebe. Dieser Abgleich laeuft taeglich je Betrieb
(Worker-Tick, Job `abgleich_feed_buchungen`) und schickt jede abweichende Zeile
erneut durch DIESELBE Projektion wie beim Live-Eingang — kein zweiter
Schreibpfad. Die Feld-Regel der Projektion (Live-Feed vollstaendig, Channex-
Import ohne Gebuehren → CSV-Gesamtpreis bleibt) gilt damit automatisch.

Sichtbar: strukturiertes Log je Lauf (`feed_abgleich_done`) und Rueckgabe mit
Zaehlern; `scripts/diagnose/csv-ueberschreibt-feed-pruefen.sh` bleibt das
Gate, das 0 zeigen muss.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from .common import ist_frisch, log, ota_buchungszeitpunkt

# Staging-Status, die eine Reservierung erwarten. `cancelled` ohne Reservierung
# ist kein Mangel: eine vor dem Anschluss stornierte Buchung braucht keine Zeile.
_AKTIVE_STATUS = ("new", "modified")

# Ab wann gilt eine Buchung als Bestand? Dieser Job laeuft TAEGLICH; eine
# Buchung, die er findet, lag also hoechstens 24 Stunden unprojiziert. 48
# Stunden lassen einen ausgefallenen Tageslauf zu, ohne dass eine Buchung von
# vor Wochen je als „neu" durchkommt.
BESTAND_AB_STUNDEN = 48


class BuchungsAbgleichMixin:
    """Feed-Staging gegen Reservierungen abgleichen und Abweichungen heilen."""

    def feed_buchungen_abgleichen(self, tenant_id: str) -> dict[str, Any]:
        """Ein Betrieb: CSV-ueberschriebene Feed-Buchungen zurueckholen, fehlende
        Reservierungen projizieren. Gibt Zaehler zurueck; Fehler je Zeile stehen
        im Log und im Ergebnis, kippen aber den Lauf nicht (Wurzel 5)."""
        db: Client = self._require_db()  # type: ignore[attr-defined]
        staging = (
            db.table("channex_booking")
            .select("channex_booking_id, ota_reservation_code, status, guest_id, raw")
            .eq("tenant_id", tenant_id)
            .in_("status", list(_AKTIVE_STATUS))
            .execute()
        ).data or []
        reservierungen = (
            db.table("reservations")
            .select("id, source_channex_booking_id, external_ref")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        nach_quelle = {
            str(r["source_channex_booking_id"]): r
            for r in reservierungen
            if r.get("source_channex_booking_id")
        }
        nach_code = {
            str(r["external_ref"]): r for r in reservierungen if r.get("external_ref")
        }

        ergebnis: dict[str, Any] = {
            "tenant_id": tenant_id,
            "staging": len(staging),
            "csv_zurueckgeholt": 0,
            "fehlend_projiziert": 0,
            "fehler": [],
        }
        for zeile in staging:
            cbid = str(zeile.get("channex_booking_id") or "")
            code = str(zeile.get("ota_reservation_code") or "")
            raw = zeile.get("raw")
            if not cbid or not isinstance(raw, dict):
                continue
            if str(zeile.get("status") or "") not in _AKTIVE_STATUS:
                continue  # Storno ohne Zeile ist kein Mangel (siehe oben).
            if cbid in nach_quelle:
                continue  # Projektion stimmt: Reservierung traegt die Feed-ID.
            treffer = nach_code.get(code) if code else None
            if treffer is not None:
                quelle = str(treffer.get("source_channex_booking_id") or "")
                if not quelle.startswith("csv:"):
                    # Fremde Quelle mit demselben Code (Airbnb-Historie traegt
                    # den Bestaetigungscode): kein Fall fuer diesen Abgleich.
                    continue
                art = "csv_zurueckgeholt"
            else:
                art = "fehlend_projiziert"
            try:
                geschrieben = self._project_booking_to_reservation(  # type: ignore[attr-defined]
                    db,
                    tenant_id,
                    raw,
                    zeile.get("guest_id"),
                    # Dieser Job HEILT Altlasten: was er findet, fehlte in
                    # `reservations` und ist damit per Definition Bestand, den
                    # der Betrieb kennt. Gemessen am Buchungszeitpunkt der
                    # Quelle, nicht an der Anreise (siehe `_bestand`).
                    bestandsimport=_bestand(raw),
                )
            except Exception as exc:  # noqa: BLE001 — eine Zeile kippt den Lauf nicht
                ergebnis["fehler"].append(f"{code or cbid}: {str(exc)[:160]}")
                log.warning(
                    "feed_abgleich_zeile_fehlgeschlagen",
                    tenant_id=tenant_id, channex_booking_id=cbid,
                    ota_reservation_code=code, art=art, error=str(exc)[:200],
                )
                continue
            if geschrieben:
                ergebnis[art] += 1
                log.info(
                    "feed_abgleich_zeile_geheilt",
                    tenant_id=tenant_id, channex_booking_id=cbid,
                    ota_reservation_code=code, art=art,
                )
        log.info(
            "feed_abgleich_done",
            **{k: v for k, v in ergebnis.items() if k != "fehler"},
            fehler=len(ergebnis["fehler"]),
        )
        return ergebnis

    def feed_buchungen_abgleichen_alle(self) -> dict[str, Any]:
        """Alle Betriebe mit aktivem Channex-Mapping — fuer den Tages-Tick."""
        db: Client = self._require_db()  # type: ignore[attr-defined]
        rows = (
            db.table("channex_property_map")
            .select("tenant_id")
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        tenants = sorted({str(r["tenant_id"]) for r in rows if r.get("tenant_id")})
        summe: dict[str, Any] = {
            "tenants": 0, "csv_zurueckgeholt": 0, "fehlend_projiziert": 0, "fehler": 0,
        }
        for tid in tenants:
            try:
                res = self.feed_buchungen_abgleichen(tid)
            except Exception as exc:  # noqa: BLE001 — ein Betrieb kippt die anderen nicht
                summe["fehler"] += 1
                log.error(
                    "feed_abgleich_tenant_fehlgeschlagen",
                    tenant_id=tid, error=str(exc)[:200],
                )
                continue
            summe["tenants"] += 1
            summe["csv_zurueckgeholt"] += res["csv_zurueckgeholt"]
            summe["fehlend_projiziert"] += res["fehlend_projiziert"]
            summe["fehler"] += len(res["fehler"])
        return summe


def _bestand(raw: dict[str, Any]) -> bool:
    """Ist diese Buchung Bestand, den der Betrieb schon kennt?

    Gemessen am BUCHUNGSZEITPUNKT der Quelle (`ota_buchungszeitpunkt`), nicht
    an der Anreise (Wurzel 5b).

    DER FEHLER, DEN DAS ERSETZT (live gemeldet 09.09.2026): Die Vorgaenger-
    Fassung fragte `arrival_date < heute`. Eine im Maerz gebuchte Reise mit
    Anreise im Juli 2027 galt damit als „nicht Bestand" und loeste den vollen
    Nachlauf aus — „Neue Buchung" an Eigentuemer und Betriebsleitung, plus
    Mail, und das bei JEDEM Tageslauf dieses Jobs. In der Glocke standen
    dutzende Buchungen mit Anreisen von 2026-08 bis 2027-07; dass darin keine
    einzige vergangene Anreise vorkam, war der Fingerabdruck dieser Zeile.

    FAIL-CLOSED (Wurzel 5): Nur ein klares „ja, frisch" macht daraus ein
    Ereignis. Fehlt der Buchungszeitpunkt, ist er unlesbar oder liegt er in der
    Zukunft (`ist_frisch` gibt dann `None`), gilt `True` — Bestand, keine
    Meldung. Die alte Vorgabe war die umgekehrte („lieber eine Meldung zu viel
    als eine verpasste Buchung") und genau darin lag der Fehler: dieser Job
    laeuft ausschliesslich auf Zeilen, die schon im Staging stehen und nur in
    `reservations` fehlten. Eine verpasste Meldung ist hier folgenlos (der
    Kalender wird korrekt), eine falsche Meldung ist fuer den Empfaenger nicht
    als falsch erkennbar.

    Die Fail-Richtung steht bewusst HIER und nicht im Helfer: sie ist an den
    drei Aufrufstellen des Frische-Fensters eine andere, und im Helfer versteckt
    war sie die eigentliche Falle (siehe `common.ist_frisch`).
    """
    return ist_frisch(
        ota_buchungszeitpunkt(raw), stunden=BESTAND_AB_STUNDEN
    ) is not True
