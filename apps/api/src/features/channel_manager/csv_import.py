"""CSV-Bestandsimport von Buchungen (Wechselkunde: Alt-/Direkt-/vergangene
Buchungen, die NICHT über die OTA-API kommen).

Belegter Branchen-Standard (Hostaway/Cloudbeds/Beds24/OwnerRez, recherchiert):
Vorlage mit festen Spalten, Datum YYYY-MM-DD, Dedup über eine eindeutige
externe ID, Storno/No-Show werden NICHT importiert, Betrag mit Punkt ODER Komma.

Mixin des ChannelManagerService (siehe service.py-Fassade). Projiziert jede
Zeile über die bestehende Reservierungs-Projektion (_project_booking_to_reservation)
mit direkt gemapptem lokalem Objekt — so gilt derselbe Kalender-Block +
Alt/Neu-Diff + Idempotenz-Pfad wie beim OTA-Import (kein zweiter Schreibweg).
"""
from __future__ import annotations

import csv
import io
from collections.abc import Callable
from datetime import date
from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .common import ChannelManagerError, log
from .schemas import CsvBookingImportResponse

# Feste Vorlagen-Spalten (Header der herunterladbaren CSV). property/Gast/
# Zeitraum sind Pflicht; der Rest optional. Reihenfolge = Vorlagen-Reihenfolge.
CSV_COLUMNS: tuple[str, ...] = (
    "property",          # Objekt-Titel ODER Objekt-ID (exakter Treffer)
    "guest_first_name",
    "guest_last_name",
    "arrival",           # YYYY-MM-DD
    "departure",         # YYYY-MM-DD
    "guest_email",
    "guest_phone",
    "num_guests",
    "total_amount",      # Punkt oder Komma
    "currency",          # ISO-4217 (leer → Objektwährung)
    "source",            # OTA-Name/„Direkt" (Freitext)
    "external_id",       # eindeutige Quell-ID (Dedup); leer → aus Zeile abgeleitet
)
_REQUIRED = ("property", "guest_first_name", "guest_last_name", "arrival", "departure")
_MAX_ROWS = 1000  # Obergrenze je Upload (Wurzel 8: unbegrenzte Liste → 422)


class CsvImportMixin:
    """CSV-Bestandsimport von Buchungen."""

    def csv_booking_template(self) -> str:
        """Die leere Vorlagen-CSV (nur Kopfzeile) als Text — Download im UI."""
        buf = io.StringIO()
        csv.writer(buf).writerow(CSV_COLUMNS)
        return buf.getvalue()

    def import_bookings_csv(
        self,
        # `None` ist erlaubt, WENN `tenant_id` gesetzt ist — der Worker hat
        # keine Sitzung. Beides zugleich fehlen zu lassen faellt in
        # `_require_tenant` auf, nicht still.
        ctx: AuthContext | None,
        *,
        content: str,
        fortschritt: Callable[[int, int, str], None] | None = None,
        tenant_id: str | None = None,
    ) -> CsvBookingImportResponse:
        """CSV-Text parsen und als Reservierungen anlegen. Tenant-scoped; jede
        Zeile isoliert (eine Fehlerzeile kippt den Import nicht). Idempotent über
        die externe ID (erneuter Upload derselben Datei legt nichts doppelt an).

        `fortschritt(fertig, gesamt, bezeichnung)`: optionaler Rückruf nach jeder
        Zeile. Ihn hier hineinzureichen ist der Grund, warum der Worker die
        Schleife NICHT kopieren muss — zwei Schleifen über dieselbe Datei wären
        zwei Auslegungen davon, und die Anzeige zählte anderes als der Import
        schreibt.

        `tenant_id`: nur für den Worker-Weg, der keine Sitzung hat. Ist er
        gesetzt, gilt er; sonst kommt der Tenant wie immer aus dem Kontext. Er
        wird beim Einreihen aus dem `AuthContext` gesetzt, nie aus einer Anfrage
        (Wurzel 3).
        """
        tenant_id = tenant_id or self._require_tenant(ctx)
        db = self._require_db()

        # BOM strippen (Excel schreibt ﻿ an den Anfang → sonst kollidiert es
        # mit dem ersten Header „property"). Trennzeichen automatisch erkennen:
        # EU-Excel nutzt Semikolon (Komma ist dort Dezimaltrenner), US-Excel Komma.
        content = content.lstrip("﻿")
        sample = content[:2048]
        delimiter = ";" if sample.count(";") > sample.count(",") else ","
        try:
            reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
        except csv.Error as exc:
            raise ChannelManagerError(
                f"CSV konnte nicht gelesen werden: {exc}", status_code=422
            ) from exc
        if reader.fieldnames is None:
            raise ChannelManagerError("Die CSV ist leer.", status_code=422)
        missing = [c for c in _REQUIRED if c not in reader.fieldnames]
        if missing:
            raise ChannelManagerError(
                "In der CSV fehlen Pflichtspalten: " + ", ".join(missing),
                status_code=422,
            )

        # Objekt-Auflösung: Titel ODER ID → property_id (tenant-scoped, kein
        # Fremdzugriff). Einmal laden, dann je Zeile nachschlagen.
        props = (
            db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        by_id = {p["id"]: p["id"] for p in props}
        by_title = {
            (p.get("title") or "").strip().lower(): p["id"]
            for p in props
            if p.get("title")
        }

        # Zähler/Fehler lokal führen und am Ende einmalig zuweisen — Pylint
        # erkennt das Pydantic-Field .errors sonst statisch als FieldInfo (ohne
        # .append). Gleiches Muster wie in bookings_sync._sync_feed.
        total = imported = skipped = failed = 0
        errors: list[str] = []
        # Fuer den Balken: die Gesamtzahl MUSS vor der ersten Zeile feststehen,
        # sonst zeigt die Anzeige „7 von 7", waehrend noch 245 kommen. Der
        # DictReader ist ein Iterator ueber denselben Text — einmal
        # materialisieren, dann daraus zaehlen und arbeiten.
        alle_zeilen = list(reader)
        gesamt = len(alle_zeilen)
        for idx, raw in enumerate(alle_zeilen, start=2):  # Zeile 1 = Kopf
            if total >= _MAX_ROWS:
                raise ChannelManagerError(
                    f"Zu viele Zeilen (max. {_MAX_ROWS} je Upload).",
                    status_code=422,
                )
            total += 1
            try:
                outcome = self._import_csv_row(
                    db, tenant_id, raw, by_id, by_title, idx
                )
            except _RowError as exc:
                failed += 1
                errors.append(str(exc))
                if fortschritt:
                    fortschritt(total, gesamt, self._zeilen_bezeichnung(raw))
                continue
            if outcome:
                imported += 1
            else:
                skipped += 1
            if fortschritt:
                # NACH dem Schreiben melden: „Zeile 7 fertig" soll heissen, dass
                # sie in der DB steht, nicht dass sie gleich versucht wird.
                fortschritt(total, gesamt, self._zeilen_bezeichnung(raw))

        log.info(
            "csv_booking_import_done",
            tenant_id=tenant_id, total=total,
            imported=imported, skipped=skipped, failed=failed,
        )
        return CsvBookingImportResponse(
            total_rows=total, imported=imported, skipped=skipped,
            failed=failed, errors=errors,
        )

    def _import_csv_row(  # noqa: PLR0913 — feste Signatur, alle Argumente nötig
        self,
        db: Client,
        tenant_id: str,
        raw: dict[str, Any],
        by_id: dict[str, str],
        by_title: dict[str, str],
        line: int,
    ) -> bool:
        """Eine CSV-Zeile → Reservierung. Wirft _RowError mit Zeilennummer bei
        Validierungsfehlern; gibt True bei angelegt/aktualisiert, False bei skip."""
        def cell(key: str) -> str:
            return (raw.get(key) or "").strip()

        prop_ref = cell("property")
        property_id = by_id.get(prop_ref) or by_title.get(prop_ref.lower())
        if not property_id:
            raise _RowError(f"Zeile {line}: Objekt „{prop_ref}“ nicht gefunden.")

        arrival = self._parse_iso_date(cell("arrival"))
        departure = self._parse_iso_date(cell("departure"))
        if not arrival or not departure:
            raise _RowError(
                f"Zeile {line}: Anreise/Abreise muss YYYY-MM-DD sein."
            )
        if departure <= arrival:
            raise _RowError(
                f"Zeile {line}: Abreise muss nach der Anreise liegen."
            )

        first = cell("guest_first_name")
        last = cell("guest_last_name")
        if not (first or last):
            raise _RowError(f"Zeile {line}: Gastname fehlt.")

        # external_id = Dedup-Schlüssel. Fehlt er, aus stabilen Feldern ableiten,
        # damit ein erneuter Upload derselben Zeile nichts doppelt anlegt.
        ext = cell("external_id") or (
            f"{property_id}:{arrival}:{departure}:{(first + last).lower()}"
        )
        booking_id = f"csv:{ext}"

        # attrs im OTA-Buchungs-Format bauen → dieselbe Projektion nutzen.
        attrs: dict[str, Any] = {
            "booking_id": booking_id,
            # Marker, damit _projection_precheck durchläuft; die echte Auflösung
            # überspringt local_property_id.
            "property_id": property_id,
            "arrival_date": str(arrival),
            "departure_date": str(departure),
            "status": "new",
            "ota_name": cell("source") or "Direkt",
            "ota_reservation_code": cell("external_id") or None,
            "amount": self._parse_amount(cell("total_amount")),
            "currency": cell("currency") or None,
            "customer": {
                "name": first,
                "surname": last,
                "mail": cell("guest_email") or None,
                "phone": cell("guest_phone") or None,
            },
            "occupancy": self._parse_int(cell("num_guests")),
        }
        return self._project_booking_to_reservation(
            db, tenant_id, attrs, local_property_id=property_id,
            # Bestand nachtragen, kein frisches Ereignis: keine Mail/Glocke an
            # Eigentuemer und Betrieb, keine Aufgaben fuer abgereiste Gaeste.
            bestandsimport=True,
        )

    @staticmethod
    def _zeilen_bezeichnung(raw: dict[str, Any]) -> str:
        """Was unter dem Fortschrittsbalken steht: Objekt und Gast dieser Zeile.

        Bewusst kurz und ohne Kontaktdaten — die Anzeige laeuft im Browser des
        Betriebs, und eine Mailadresse gehoert nicht in eine Laufzeile, die
        nebenbei durchrauscht. Fehlt beides, bleibt es leer statt einen
        Platzhalter zu erfinden (Wurzel 4).
        """
        def zelle(key: str) -> str:
            return (raw.get(key) or "").strip()

        objekt = zelle("property")
        gast = " ".join(
            t for t in (zelle("guest_first_name"), zelle("guest_last_name")) if t
        )
        return " · ".join(t for t in (objekt, gast) if t)

    @staticmethod
    def _parse_iso_date(value: str) -> date | None:
        try:
            return date.fromisoformat(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_amount(value: str) -> float | None:
        """Betrag mit Punkt ODER Komma als Dezimaltrenner (belegt: Hostaway/
        Beds24). Leer → None (kein erfundener 0-Preis)."""
        if not value:
            return None
        try:
            return float(value.replace(",", "."))
        except ValueError:
            return None

    @staticmethod
    def _parse_int(value: str) -> int | None:
        try:
            return int(value)
        except (ValueError, TypeError):
            return None


class _RowError(Exception):
    """Validierungsfehler einer einzelnen CSV-Zeile (mit Zeilennummer)."""
