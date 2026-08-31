"""Lodgify-API-Import (NUR LESEND): Buchungen aus dem alten PMS „Lodgify" des
Wechselkunden übernehmen.

Der Kunde gibt seinen EIGENEN Lodgify-API-Key ein (Settings → Public API). Wir
lesen damit ausschließlich (GET /v2/reservations/bookings), schreiben NICHTS
nach Lodgify zurück und speichern den Key NICHT persistent (nur transient im
Request). Autorisierter Zugriff des Nutzers auf seine eigenen Daten.

Belegte Roh-Feldnamen (echter Produktivcode, snake_case): items[], id, arrival,
departure, total_amount, guest.name, rooms[].people/guest_breakdown. Weitere
Felder (currency_code, property_id, source, guest.email/phone, status) sind
plausibel, aber nicht verifiziert → defensiv per .get(); fehlt Pflicht (Währung),
wird NICHT geraten, sondern die Zeile schlägt fehl (Wurzel 4/5). Deshalb gibt es
einen Vorschau-Schritt (preview_*), der die Rohdaten holt und zeigt, BEVOR
geschrieben wird — so verifiziert der Nutzer live gegen sein echtes Konto.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from src.core.security import AuthContext

from .common import ChannelManagerError, log
from .schemas import (
    CsvBookingImportResponse,
    LodgifyBookingPreview,
    LodgifyPreviewResponse,
)

_LODGIFY_BASE = "https://api.lodgify.com"
_PAGE_SIZE = 50
_MAX_PAGES = 100  # harte Obergrenze (Wurzel 8): max 5000 Buchungen je Import
_RETRY_BACKOFF = (1.0, 3.0, 8.0)  # 429/5xx: exponentiell mit Deckel
_TIMEOUT = 30.0
# Importierbar: bestätigte Buchungen UND Stornos (für vollständige Historie —
# Storno gibt Nächte frei, blockiert nicht). NICHT importierbar: Anfragen/
# Optionen (open/tentative), die noch keine echte Buchung sind.
_IMPORTABLE_STATUS = {"booked", "confirmed", "cancelled"}


class LodgifyImportMixin:
    """Nur-lesender Buchungs-Import aus der Lodgify Public API v2."""

    # -- HTTP (nur lesend) -----------------------------------------------------
    @staticmethod
    def _lodgify_get(
        api_key: str, path: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Ein GET gegen die Lodgify-API mit dem NUTZER-Key. 429/5xx → Backoff.
        api_key wird NUR im Header verwendet, nie geloggt/gespeichert."""
        url = f"{_LODGIFY_BASE}{path}"
        headers = {"X-ApiKey": api_key, "accept": "application/json"}
        for attempt in range(len(_RETRY_BACKOFF) + 1):
            try:
                with httpx.Client(timeout=_TIMEOUT) as client:
                    resp = client.get(url, headers=headers, params=params)
            except httpx.HTTPError as exc:
                raise ChannelManagerError(
                    "Lodgify ist nicht erreichbar (Netzwerkfehler).",
                    status_code=502,
                ) from exc
            if resp.status_code == 429 or resp.status_code >= 500:
                if attempt < len(_RETRY_BACKOFF):
                    # Retry-After bevorzugen, falls Lodgify ihn sendet.
                    retry_after = resp.headers.get("Retry-After")
                    wait = (
                        float(retry_after)
                        if retry_after and retry_after.isdigit()
                        else _RETRY_BACKOFF[attempt]
                    )
                    log.warning(
                        "lodgify_rate_limited",
                        status=resp.status_code, retry_in=wait,
                    )
                    time.sleep(wait)
                    continue
                raise ChannelManagerError(
                    "Lodgify-Limit erreicht oder Dienst gestört — bitte später "
                    "erneut versuchen.",
                    status_code=502,
                )
            if resp.status_code in (401, 403):
                raise ChannelManagerError(
                    "Der Lodgify-API-Schlüssel wurde nicht akzeptiert. Bitte "
                    "prüfe den Schlüssel (Lodgify → Einstellungen → Public API).",
                    status_code=400,
                )
            if resp.status_code >= 400:
                raise ChannelManagerError(
                    f"Lodgify meldete einen Fehler ({resp.status_code}).",
                    status_code=502,
                )
            try:
                return resp.json()
            except ValueError as exc:
                raise ChannelManagerError(
                    "Lodgify lieferte eine unerwartete Antwort.", status_code=502
                ) from exc
        # unreachable (Schleife endet über return/raise)
        raise ChannelManagerError("Lodgify-Abruf fehlgeschlagen.", status_code=502)

    def _fetch_lodgify_bookings(
        self, api_key: str, *, include_past: bool
    ) -> list[dict[str, Any]]:
        """Alle Buchungen paginiert holen. include_past=False → nur künftige/
        laufende (stayFilter=Upcoming), True → alle (stayFilter=All)."""
        stay_filter = "All" if include_past else "Upcoming"
        out: list[dict[str, Any]] = []
        for page in range(1, _MAX_PAGES + 1):
            resp = self._lodgify_get(
                api_key,
                "/v2/reservations/bookings",
                {
                    "stayFilter": stay_filter,
                    "page": page,
                    "size": _PAGE_SIZE,
                    "includeExternal": "true",
                    "trash": "false",
                },
            )
            items = resp.get("items") or []
            out.extend(items)
            count = resp.get("count") or 0
            if not items or page * _PAGE_SIZE >= count:
                break
        return out

    # -- Mapping ---------------------------------------------------------------
    @staticmethod
    def _lodgify_booking_to_attrs(b: dict[str, Any]) -> dict[str, Any] | None:
        """Eine Lodgify-Buchung → OTA-Buchungs-attrs (dieselbe Projektion wie
        OTA/CSV). Defensiv: fehlt Pflicht (id/arrival/departure), None → skip.
        currency wird NICHT geraten (kein EUR-Fallback); fehlt sie, greift beim
        Schreiben die Objektwährung, sonst schlägt die Zeile fehl (Wurzel 4)."""
        bid = b.get("id")
        arrival = b.get("arrival")
        departure = b.get("departure")
        if not (bid and arrival and departure):
            return None
        guest = b.get("guest") or {}
        # Gast-Name in Vor-/Nachname trennen (Lodgify liefert nur guest.name).
        full = (guest.get("name") or "").strip()
        first, _, last = full.partition(" ")
        rooms = b.get("rooms") or []
        people = rooms[0].get("people") if rooms else None
        # Storno zuverlässig über canceled_at (live verifiziertes Feld) — nicht
        # nur über den Status. Stornos werden MIT importiert (vollständige
        # Historie: Zeitleiste, Gastprofil, Statistik), aber als „cancelled"
        # projiziert → sie blockieren KEINE Kalendernächte und geben belegte frei
        # (Wurzel 1, der Storno-Pfad in _project_booking_to_reservation).
        raw_status = str(b.get("status") or "").strip().lower()
        canceled = bool(b.get("canceled_at")) or raw_status == "declined"
        return {
            "booking_id": f"lodgify:{bid}",
            "arrival_date": str(arrival),
            "departure_date": str(departure),
            # cancelled → Storno-Pfad (Nächte frei); sonst als bestätigte Buchung
            # projizieren (Kalender geblockt). Anfragen/Optionen kommen gar nicht
            # bis hierher (der Aufrufer filtert nicht-importable vorher raus).
            "status": "cancelled" if canceled else "new",
            "ota_name": b.get("source") or b.get("source_text") or "Lodgify",
            "ota_reservation_code": str(bid),
            "amount": b.get("total_amount"),
            "currency": b.get("currency_code"),
            "customer": {
                "name": first or full,
                "surname": last or None,
                "mail": guest.get("email"),
                "phone": guest.get("phone"),
            },
            "occupancy": people,
            # Effektiver Status für die Import-Entscheidung des Aufrufers:
            # cancelled (Storno) und booked/confirmed sind importierbar;
            # open/tentative (Anfrage/Option) nicht.
            "_lodgify_status": "cancelled" if canceled else raw_status,
            "_lodgify_property_ref": b.get("property_id"),
        }

    # -- Preview (schreibt NICHTS) --------------------------------------------
    def preview_lodgify_import(
        self, ctx: AuthContext, *, api_key: str, include_past: bool = False
    ) -> LodgifyPreviewResponse:
        """Buchungen bei Lodgify lesen und eine Vorschau zurückgeben — ES WIRD
        NICHTS GESCHRIEBEN. Der Nutzer sieht, was ankommt (Live-Verifikation der
        Feldnamen gegen sein echtes Konto), bevor er importiert."""
        self._require_tenant(ctx)
        if not api_key.strip():
            raise ChannelManagerError(
                "Bitte den Lodgify-API-Schlüssel eingeben.", status_code=400
            )
        raw = self._fetch_lodgify_bookings(api_key.strip(), include_past=include_past)
        previews: list[LodgifyBookingPreview] = []
        importable = 0
        for b in raw:
            attrs = self._lodgify_booking_to_attrs(b)
            if attrs is None:
                continue
            ok = attrs["_lodgify_status"] in _IMPORTABLE_STATUS
            if ok:
                importable += 1
            cust = attrs["customer"]
            previews.append(
                LodgifyBookingPreview(
                    external_id=attrs["ota_reservation_code"],
                    guest_name=(
                        f"{cust['name']} {cust['surname'] or ''}".strip()
                    ),
                    arrival=attrs["arrival_date"],
                    departure=attrs["departure_date"],
                    total=attrs["amount"],
                    currency=attrs["currency"],
                    source=attrs["ota_name"],
                    status=attrs["_lodgify_status"],
                    importable=ok,
                )
            )
        return LodgifyPreviewResponse(
            total=len(previews), importable=importable, items=previews[:200]
        )

    # -- Import (schreibt) -----------------------------------------------------
    def import_lodgify_bookings(
        self, ctx: AuthContext, *, api_key: str, include_past: bool = False
    ) -> CsvBookingImportResponse:
        """Buchungen aus Lodgify lesen und als Reservierungen anlegen. Dedup über
        source_channex_booking_id=lodgify:<id> (erneuter Lauf legt nichts doppelt
        an). Der Nutzer mappt die Objekte NICHT einzeln: die Lodgify-Buchung wird
        dem lokalen Objekt gleichen Titels/derselben Referenz zugeordnet; findet
        sich keins, ist die Zeile ein Fehler (kein Fremd-Objekt raten)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if not api_key.strip():
            raise ChannelManagerError(
                "Bitte den Lodgify-API-Schlüssel eingeben.", status_code=400
            )

        # Objekt-Auflösung: nur EIGENE Objekte des Tenants (Wurzel 3/6).
        props = (
            db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        titles = {
            (p.get("title") or "").strip().lower(): p["id"]
            for p in props
            if p.get("title")
        }
        # Genau EIN Objekt → alle Buchungen dorthin (häufigster FeWo-Fall).
        sole_property = props[0]["id"] if len(props) == 1 else None

        raw = self._fetch_lodgify_bookings(api_key.strip(), include_past=include_past)
        total = imported = skipped = failed = 0
        errors: list[str] = []
        for b in raw:
            attrs = self._lodgify_booking_to_attrs(b)
            if attrs is None:
                continue
            total += 1
            if attrs["_lodgify_status"] not in _IMPORTABLE_STATUS:
                skipped += 1  # Anfrage/Option (open/tentative) → keine Buchung
                continue
            property_id = sole_property or self._lodgify_resolve_property(
                attrs, titles
            )
            if not property_id:
                failed += 1
                errors.append(
                    f"Buchung {attrs['ota_reservation_code']}: kein passendes "
                    "Objekt gefunden (Titel stimmt nicht überein)."
                )
                continue
            # Marker für die Projektions-Vorprüfung.
            attrs["property_id"] = property_id
            try:
                if self._project_booking_to_reservation(
                    db, tenant_id, attrs, local_property_id=property_id,
                    # Uebernahme aus dem alten PMS = Bestand, kein Ereignis.
                    bestandsimport=True,
                ):
                    imported += 1
                else:
                    skipped += 1
            except Exception as exc:  # noqa: BLE001 — eine Buchung kippt nicht alle
                failed += 1
                errors.append(f"Buchung {attrs['ota_reservation_code']}: {exc}")
        log.info(
            "lodgify_import_done",
            tenant_id=tenant_id, total=total, imported=imported,
            skipped=skipped, failed=failed,
        )
        return CsvBookingImportResponse(
            total_rows=total, imported=imported, skipped=skipped,
            failed=failed, errors=errors[:100],
        )

    @staticmethod
    def _lodgify_resolve_property(
        attrs: dict[str, Any], titles: dict[str, str]
    ) -> str | None:
        """Lodgify-Buchung → lokales Objekt. Ohne verlässliche property-Referenz
        in der Lodgify-Antwort bleibt nur der Titel-Abgleich; matcht keiner,
        None (Fehlerzeile, kein Raten)."""
        ref = attrs.get("_lodgify_property_ref")
        if ref is not None:
            # Falls die lokale property_id direkt der Lodgify-Referenz entspricht
            # (Nutzer hat sie so benannt) — sonst greift der Titel-Weg nicht und
            # der Aufrufer meldet die Zeile als Fehler.
            hit = titles.get(str(ref).strip().lower())
            if hit:
                return hit
        return None
