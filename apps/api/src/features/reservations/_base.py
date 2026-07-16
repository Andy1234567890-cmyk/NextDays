"""Reservations-Service: gemeinsame Basis (Zustand + geteilte Helfer).

Aufgeteilt nach Domäne (der Service war eine >1400-Zeilen-Gottklasse): diese
Basis hält den Supabase-Client, das Tenant-/Owner-Scoping und die von Schreib-
UND Lesepfad geteilten Helfer (Kalender-Freigabe, Channex-Push, Quote, Gast-
Upsert, Row-Mapping). `reads.py` und `writes.py` mischen ihre Methoden dazu,
`service.py` komponiert alles zu `ReservationsService`.

Modul-Ebene liegen hier auch die geteilten Fehler-/Datums-Helfer (ReservationError,
_as_date, _nights, _require_uuid, _map_booking_conflict), damit alle drei Module
und die Tests sie aus einer Quelle importieren.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import TYPE_CHECKING
from uuid import UUID

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

# load_guest_mask ist hier der KANONISCHE Bezugspunkt: reads.py/writes.py/service.py
# importieren ihn von hier (ein Patch-Ort in Tests). Deshalb re-exportiert, auch
# wenn _base ihn selbst nicht aufruft.
from src.features.auth.guest_masking import GuestMask, load_guest_mask
from src.features.auth.owner_scope import is_owner, owner_property_ids
from src.features.guests.identity import (
    GuestContact as ResolverContact,
)
from src.features.guests.identity import (
    resolve_or_create_guest,
)
from src.jobs.queue import try_enqueue_ari, try_enqueue_recompute

from .schemas import (
    ReservationCreate,
    ReservationResponse,
    SliceHealth,
)

if TYPE_CHECKING:
    from src.features.pricing.schemas import QuoteResponse

# Re-Exporte (von reads/writes/service + Tests genutzt) — hält ruff davon ab,
# den nur weitergereichten load_guest_mask-Import zu entfernen.
__all__ = [
    "GuestMask",
    "ReservationError",
    "ReservationsBase",
    "_as_date",
    "_map_booking_conflict",
    "_nights",
    "_require_uuid",
    "load_guest_mask",
    "log",
]

log = get_logger("nextdays.reservations")


def _as_date(value: object) -> date:
    """Supabase liefert Datumsspalten als ISO-String; date bleibt date."""
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _require_uuid(reservation_id: str) -> None:
    """Reservierungs-ID MUSS eine UUID sein → sonst 404 (nicht 500).

    Die Route /reservierungen/{id} fängt in Next.js auch nicht existierende
    Unterpfade (z. B. „einstellungen"). Ohne diesen Guard reicht Postgres den
    Nicht-UUID-Wert bis zur DB durch und wirft 22P02 → ein nutzer-/pfad-
    getriebener 500 (CLAUDE.md Wurzel 5: Fehl-Input darf keinen 500 werfen,
    fail-closed). Fachlich ist eine unbekannte ID schlicht „nicht gefunden"."""
    try:
        UUID(str(reservation_id))
    except (ValueError, AttributeError, TypeError) as exc:
        raise ReservationError(
            "Reservierung nicht gefunden.", status_code=404
        ) from exc


class ReservationError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _map_booking_conflict(exc: APIError) -> Exception:
    """Fehler der atomaren Buchung (RPC 0104) auf fachliche Fehler mappen.

    RS409 = Konflikt aus create_reservation_atomic (belegt bzw. Stop-Sell, die
    Message unterscheidet die Fälle). 23P01 = EXCLUDE-Constraint
    reservations_no_local_overlap (DB-Backstop gegen Doppelbuchung). Alles
    andere unverändert weiterreichen.
    """
    if exc.code == "RS409":
        return ReservationError(exc.message, status_code=409)
    if exc.code == "23P01":
        return ReservationError(
            "Zeitraum enthält bereits belegte/gesperrte Tage.", status_code=409
        )
    return exc


def _nights(check_in: date, check_out: date) -> list[date]:
    days: list[date] = []
    cur = check_in
    while cur < check_out:
        days.append(cur)
        cur += timedelta(days=1)
    return days


class ReservationsBase:
    """Geteilter Zustand + Helfer für die Reservations-Mixins."""

    slice_name = "reservations"

    def __init__(self, service_client: Client | None = None) -> None:
        # client optional, damit der Health-Endpoint ohne Supabase-Key läuft.
        self._client = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise ReservationError("Reservierungs-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ReservationError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _owner_scope_pids(self, ctx: AuthContext) -> list[str] | None:
        """Objekt-IDs, auf die ein Eigentümer eingeschränkt ist (§4.2).

        None = keine Einschränkung (admin/co_admin sehen den ganzen Tenant).
        Liste (ggf. leer) = nur diese Objekte. Der Service läuft mit Service-
        Role (RLS umgangen), also muss der Owner-Self-Scope hier greifen — sonst
        sieht ein Eigentümer die Buchungen fremder Objekte desselben Tenants."""
        if not is_owner(ctx):
            return None
        return list(owner_property_ids(self._db(), ctx))

    def _days_still_booked_by_others(
        self, property_id: str, days: list[str], exclude_reservation_id: str
    ) -> set[str]:
        """Von `days` diejenigen, die noch durch eine ANDERE aktive Reservierung
        desselben Objekts belegt sind (z. B. eine importierte OTA-Buchung — die
        darf mit einer lokalen Buchung überlappen, der EXCLUDE-Constraint nimmt
        OTA-Buchungen aus). Solche Tage dürfen beim Stornieren/Verschieben der
        lokalen Reservierung NICHT freigegeben und NICHT an Channex zurück-
        gemeldet werden, sonst werden real belegte Tage wieder verkaufbar."""
        if not days:
            return set()
        lo, hi = min(days), max(days)
        rows = (
            self._db()
            .table("reservations")
            .select("check_in, check_out")
            .eq("property_id", property_id)
            .neq("id", exclude_reservation_id)
            .neq("status", "cancelled")
            .lte("check_in", hi)
            .gt("check_out", lo)
            .execute()
        ).data or []
        occupied: set[str] = set()
        wanted = set(days)
        for r in rows:
            for d in _nights(_as_date(r["check_in"]), _as_date(r["check_out"])):
                iso = d.isoformat()
                if iso in wanted:
                    occupied.add(iso)
        return occupied

    def _write_ari_outbox(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to_incl: date,
        availability: int,
    ) -> str | None:
        """Push-Absicht VOR dem Job-Enqueue in der ari_outbox persistieren:
        scheitert das Einreihen (DB-Hiccup), zieht der process_ari_outbox-Tick
        die Zeile nach — der Push geht nie ersatzlos verloren. Best-effort:
        ohne Outbox-Zeile legt der Worker beim Push selbst eine an (Altpfad)."""
        try:
            ins = (
                self._db()
                .table("ari_outbox")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "date_from": date_from.isoformat(),
                        "date_to": date_to_incl.isoformat(),
                        "availability": availability,
                        "status": "pending",
                    }
                )
                .execute()
            )
            return ins.data[0]["id"] if ins.data else None
        except Exception as exc:  # noqa: BLE001 — Outbox darf den Request nie kippen
            log.warning(
                "ari_outbox_write_failed",
                property_id=property_id,
                error=str(exc)[:200],
            )
            return None

    def _push_channex_availability(
        self,
        tenant_id: str,
        property_id: str,
        check_in: date,
        check_out: date,
        availability: int,
        outbox_id: str | None = None,
    ) -> None:
        """Verfügbarkeit der belegten/freigegebenen Nächte als ARI-Push-Job
        einreihen (Phase 2). Doppelbuchungsschutz: die Belegung geht so ohne
        Request-Blockade an Channex. KEIN coalesce — jede Buchung/Freigabe betrifft
        einen eigenen Zeitraum, ein pauschaler dedup_key würde disjunkte Ranges
        verschmelzen. Die Push-Absicht liegt VOR dem Enqueue in der ari_outbox
        (übergeben oder hier geschrieben) — verlorene Enqueues holt der Cron nach."""
        if self._client is None:
            return
        if outbox_id is None:
            outbox_id = self._write_ari_outbox(
                tenant_id, property_id, check_in,
                check_out - timedelta(days=1), availability,
            )
        fields: dict[str, object] = {
            "date_from": check_in.isoformat(),
            "date_to": (check_out - timedelta(days=1)).isoformat(),  # Abreise exkl.
            "availability": availability,
        }
        if outbox_id:
            fields["outbox_id"] = outbox_id
        try_enqueue_ari(
            self._client, tenant_id, property_id, "availability", fields,
        )

    def _recompute_dynamic_pricing(self, tenant_id: str, property_id: str) -> None:
        """Dynamic-Pricing-Recompute als Job einreihen (Phase 2) — eine Buchung/
        Storno ändert Auslastung + Orphan-Lücken. Der Worker rechnet den Horizont
        neu und pusht die Tagespreise. Coalesced je Objekt: mehrere Buchungen
        desselben Objekts kurz hintereinander erzeugen nur EINEN Recompute. Der Job
        rechnet den vollen Horizont — funktional eine Obermenge des früheren
        ±2-Tage-Fensters um die Buchung."""
        if self._client is None:
            return
        try_enqueue_recompute(self._client, tenant_id, property_id)

    def _log_event(
        self,
        tenant_id: str,
        reservation_id: str,
        kind: str,
        *,
        by_user_id: str | None = None,
        detail: dict | None = None,
    ) -> None:
        """Ein Ereignis in die Buchungs-Zeitleiste schreiben (0122).

        Append-only, best-effort: ein fehlgeschlagener Log-Insert darf die
        auslösende Aktion (Buchung/Move/Storno/Check-in-out) NIEMALS kippen
        (Wurzel 5 — Audit ist Best-Effort, `# noqa: BLE001`). Die Zeitleiste
        ist eine Anzeige-/Nachvollziehbarkeits-Schicht, keine Transaktions-
        wahrheit; Basis-Events für Altbuchungen synthetisiert der Lesepfad.
        """
        if self._client is None:
            return
        try:
            self._db().table("reservation_events").insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "kind": kind,
                    "by_user_id": by_user_id,
                    "detail": detail or {},
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Zeitleiste ist best-effort
            log.warning(
                "reservation_event_log_failed",
                reservation_id=reservation_id,
                kind=kind,
                error=str(exc)[:200],
            )

    def _load_owned(self, tenant_id: str, reservation_id: str) -> dict:
        """Reservierung tenant-scoped laden (404, wenn fremd/fehlend)."""
        _require_uuid(reservation_id)
        rows = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
        return rows[0]

    def _release_nights(
        self,
        tenant_id: str,
        property_id: str,
        nights: list[str],
        reservation_id: str,
        *,
        recompute: bool = True,
    ) -> None:
        """Gibt geräumte Nächte einer Reservierung frei — die EINE Stelle, an der
        eine Reservierung Kalendertage zurückgibt (move-Resize, cancel, künftig
        jeder weitere Pfad). Zusammengeführt aus den zuvor kopierten Blöcken in
        move()/cancel(), damit der Alt-/Neu-Diff nie an einer neuen Stelle
        vergessen werden kann (Wurzel: „Vorwärts-Schritt ohne Gegenzustand").

        1 Objekt = 1 Einheit: binäre availability-Freigabe (status='open' +
        Channex availability=1), NUR für Tage, die keine andere aktive Buchung
        noch belegt (sonst Überbuchung). Rechnet danach Dynamic Pricing neu.
        """
        if not nights:
            return
        still = self._days_still_booked_by_others(property_id, nights, reservation_id)
        release = [d for d in nights if d not in still]
        if not release:
            return
        self._db().table("availability").upsert(
            [
                {"property_id": property_id, "date": d,
                 "status": "open", "source": "manual"}
                for d in release
            ],
            on_conflict="property_id,date",
        ).execute()
        self._release_channex(tenant_id, property_id, release)
        if recompute:
            self._recompute_dynamic_pricing(tenant_id, property_id)

    def _release_channex(
        self, tenant_id: str, property_id: str, days: list[str]
    ) -> None:
        """Freigegebene Tage zusammenhängend an Channex melden (availability=1).

        Sortierte ISO-Tage werden zu Intervallen gebündelt; jedes Intervall wird
        als [von, bis] (inklusiv) gepusht. Best-effort (ari_outbox-Retry).
        """
        if not days:
            return
        ordered = [date.fromisoformat(d) for d in sorted(days)]
        start = prev = ordered[0]
        for cur in ordered[1:]:
            if (cur - prev).days == 1:
                prev = cur
                continue
            self._push_channex_availability(
                tenant_id, property_id, start, prev + timedelta(days=1), 1
            )
            start = prev = cur
        self._push_channex_availability(
            tenant_id, property_id, start, prev + timedelta(days=1), 1
        )

    def _quote(
        self,
        property_id: str,
        check_in: date,
        check_out: date,
        guests: int,
        channel: str,
        rate_plan_id: str | None = None,
    ) -> QuoteResponse:
        """Buchungs-Quote über den zentralen Resolver (eine Preis-Wahrheit).

        rate_plan_id (Hotel): der KONKRETE Plan der Buchung — ohne ihn bepreist
        der Resolver property-weit (FeWo) und würde beim Hotel den falschen
        (ältesten) Plan rechnen."""
        from src.features.pricing.resolver import PricingResolver
        from src.features.pricing.schemas import QuoteRequest

        return PricingResolver(service_client=self._db()).quote(
            QuoteRequest(
                property_id=property_id,
                check_in=check_in,
                check_out=check_out,
                guests=max(1, guests),
                channel=channel,
                rate_plan_id=rate_plan_id,
            )
        )

    def _upsert_guest(self, tenant_id: str, req: ReservationCreate) -> str | None:
        # 1) Fest zugeordneter Gast (z. B. aus der Gästekarte): nur übernehmen,
        #    wenn er DIESEM Tenant gehört — sonst ignorieren (kein Fremd-Link).
        if req.guest_id:
            owned = (
                self._db()
                .table("guests")
                .select("id")
                .eq("id", req.guest_id)
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            )
            if owned.data:
                return owned.data[0]["id"]
        # 2) Sonst zentraler Resolver (E-Mail→Telefon→Neuanlage), ein Pfad für
        #    alle Kanäle. Keine Dublette bei wiederkehrendem Gast.
        return resolve_or_create_guest(
            self._db(),
            tenant_id,
            ResolverContact(
                first_name=req.contact.first_name,
                last_name=req.contact.last_name,
                email=req.contact.email,
                phone=req.contact.phone,
                channel="direct",
                # Gästemappen-Stammdaten (0046): strukturiert mitgeben, damit
                # die Gästekartei nicht nur den zusammengesetzten Namen hat.
                language=req.contact.language,
                country=req.contact.country,
            ),
        )

    def _row(self, r: dict, mask: GuestMask) -> ReservationResponse:
        guest = r.get("guests") or {}
        guest_name = guest.get("name", "") if isinstance(guest, dict) else ""
        amount = mask.amount(float(r.get("total_amount") or 0))
        paid = mask.amount(float(r.get("paid_amount") or 0))
        return ReservationResponse(
            id=r["id"],
            property_id=r["property_id"],
            guest_id=r.get("guest_id"),
            guest_name=mask.name(guest_name) or "",
            channel=r["channel"],
            check_in=r["check_in"],
            check_out=r["check_out"],
            status=r["status"],
            total_amount=amount,
            paid_amount=paid,
            currency=(r.get("currency") or "") if mask.amounts else "",
            ota_name=mask.source_value(r.get("ota_name")),
            external_ref=r.get("external_ref"),
            num_guests=int(r.get("num_guests") or 1),
            adults=int(r.get("adults") or 1),
            children=int(r.get("children") or 0),
            checked_in_at=r.get("checked_in_at"),
            checked_out_at=r.get("checked_out_at"),
        )
