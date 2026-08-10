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

from src.core.dates import nights as _nights
from src.core.einheiten_verfuegbar import freie_einheiten_spannen
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

# Status, die eine Nacht NICHT belegen — deckungsgleich mit der WHERE-Klausel
# des EXCLUDE-Constraints `reservations_no_local_overlap` (0184).
_NICHT_BELEGEND = frozenset({"cancelled", "declined", "expired"})


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




def anzeigename(r: dict) -> str:
    """Der Name, der zu dieser Reservierung im Kalender steht.

    Bei einer Eigennutzung gibt es KEINEN Gast: der Assistent schickt bewusst
    einen leeren Kontakt, weil der Personenbezug `owner_id` ist und ein
    mitgeschickter Kontakt neben dem Eigentümer noch eine Gast-Zeile in der
    Gästekartei anlegte. Damit blieb `guests.name` leer und der Balken zeigte
    nur „Eigentümer-Aufenthalt" — wer im Kalender wissen wollte, WER da wohnt,
    fand es nirgends (live gesehen am 10.08.2026, FeWo *Stjerneskud*).

    Der Name steht die ganze Zeit in `owners` und wird über `owners(name)`
    mitgeladen. Ein Helfer an EINER Stelle, weil drei Lesepfade (Liste, Detail,
    Antwort nach dem Anlegen) dieselbe Frage stellen — sonst zeigt der eine
    den Namen und der andere nicht.
    """
    if r.get("is_owner_stay"):
        # Vorrang hat die AUSDRÜCKLICH benannte Person: „Tochter Lisa" schlägt
        # den Eigentümer, denn sie ist die, die da wohnt. Ohne Angabe ist der
        # Eigentümer die beste bekannte Aussage — und ohne beides bleibt es
        # leer, damit der Balken sein Status-Label zeigt statt eines
        # erfundenen Platzhalters (Wurzel 4).
        benannt = (r.get("stay_name") or "").strip()
        if benannt:
            return benannt
        owner = r.get("owners") or {}
        name = owner.get("name", "") if isinstance(owner, dict) else ""
        if name:
            return str(name)
    guest = r.get("guests") or {}
    return str(guest.get("name", "") if isinstance(guest, dict) else "")


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
        self,
        property_id: str,
        days: list[str],
        exclude_reservation_id: str,
        unit_id: str | None = None,
    ) -> set[str]:
        """Von `days` diejenigen, die noch durch eine ANDERE aktive Reservierung
        belegt sind — auf DERSELBEN Einheit, wenn `unit_id` gegeben ist, sonst
        objektweit.

        Solche Tage dürfen beim Stornieren/Verschieben der eigenen Reservierung
        NICHT freigegeben und NICHT an Channex zurückgemeldet werden, sonst
        werden real belegte Tage wieder verkaufbar (z. B. eine importierte
        OTA-Buchung — die darf mit einer lokalen Buchung überlappen, der
        EXCLUDE-Constraint nimmt OTA-Buchungen aus).

        Seit 0265 hat ein Objekt n ≥ 1 Einheiten, und eine Buchung belegt GENAU
        EINE davon. Objektweit gezählt blockierte deshalb die Buchung auf
        Einheit 2 die Freigabe der Nacht auf Einheit 1: `release` blieb leer,
        die Nacht wurde nie zurückgegeben und die Einheit war dauerhaft
        unverkäuflich (Wurzel 1 — der Gegenzustand kam nie).

        Fail-closed (Wurzel 5): Zeilen OHNE `unit_id` (Altbestand vor 0266)
        zählen weiter als belegend — welche Einheit sie meinen, ist unbekannt,
        und eine Überbuchung wiegt schwerer als eine ungenutzte Nacht. Ohne
        `unit_id` des Aufrufers bleibt es beim objektweiten Verhalten.
        """
        if not days:
            return set()
        lo, hi = min(days), max(days)
        rows = (
            self._db()
            .table("reservations")
            .select("check_in, check_out, status, unit_id")
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
            # Dieselbe Menge, die der EXCLUDE-Constraint (0184) als „belegt"
            # führt. Der `cancelled`-Filter allein zählte auch `declined` und
            # `expired` mit: eine abgelehnte Anfrage hielt die Nacht dann für
            # immer besetzt — wurde die echte Buchung darauf storniert, blieb
            # der Tag lokal und bei den OTAs unverkäuflich, ohne dass irgendwo
            # eine gültige Buchung stand (Wurzel 1).
            if str(r.get("status") or "") in _NICHT_BELEGEND:
                continue
            fremde_einheit = r.get("unit_id")
            if unit_id and fremde_einheit and str(fremde_einheit) != str(unit_id):
                continue
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

    def _record_dynpricing_usage(
        self,
        tenant_id: str,
        reservation_id: str,
        gross_amount: float | None,
        currency: str | None,
    ) -> None:
        """Modul „Dynamische Preise" (0,5 %): Gebühr im `dynpricing_ledger`
        erfassen — mit der Währung DIESER Buchung, nicht der des Abos
        (24 Länder, Wurzel 4). Idempotent über die reservation_id (Wurzel 2,
        UNIQUE-Backstop in 0277). Ohne gebuchtes Modul tut der Service nichts.
        Best-effort: eine fehlgeschlagene Erfassung darf die vollzogene Buchung
        NICHT zurückdrehen (Wurzel 5) — sie wird geloggt."""
        if self._client is None or not gross_amount or gross_amount <= 0:
            return
        try:
            from src.features.subscriptions.service import (  # noqa: PLC0415
                SubscriptionsService,
            )

            SubscriptionsService(service_client=self._client).record_dynpricing_usage(
                tenant_id,
                reservation_id=reservation_id,
                gross_amount=float(gross_amount),
                currency=currency or "",
            )
        except Exception:  # noqa: BLE001 — best-effort, Buchung bleibt bestehen
            log.warning(
                "dynpricing_record_failed",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
            )

    def _cancel_dynpricing_usage(self, tenant_id: str, reservation_id: str) -> None:
        """Storno → offene 0,5 %-Zeile entfernen (Gegenzustand, Wurzel 1).
        Bereits fakturierte Zeilen bleiben. Best-effort wie die Erfassung."""
        if self._client is None:
            return
        try:
            from src.features.subscriptions.service import (  # noqa: PLC0415
                SubscriptionsService,
            )

            SubscriptionsService(service_client=self._client).cancel_dynpricing_usage(
                tenant_id, reservation_id=reservation_id
            )
        except Exception:  # noqa: BLE001 — best-effort, Storno bleibt bestehen
            log.warning(
                "dynpricing_cancel_failed",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
            )

    def _sync_task_rules(self, tenant_id: str, reservation_id: str) -> None:
        """Planmäßige Aufgaben-Regeln auf den neuen Buchungsstand bringen (0272).

        Anlegen erzeugt die Aufgaben, Verschieben verschiebt sie mit (Wurzel 1),
        Storno räumt sie weg. Best-effort: eine Reinigungsaufgabe, die nicht
        entstehen konnte, darf die bereits vollzogene Buchung/Storno NICHT
        zurückdrehen (`# noqa: BLE001`) — der Fehler wird geloggt und der
        Nachzügler-Endpunkt `POST /tasks/sync-reservation/{id}` holt ihn nach.
        """
        if self._client is None:
            return
        try:
            from src.features.tasks.engine import (  # noqa: PLC0415
                sync_for_reservation,
            )

            rows = (
                self._db()
                .table("reservations")
                .select(
                    "id, property_id, status, check_in, check_out, "
                    "checkin_time, checkout_time, created_at"
                )
                .eq("id", reservation_id)
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data
            if rows:
                sync_for_reservation(self._db(), tenant_id, rows[0])
        except Exception as exc:  # noqa: BLE001 — Aufgaben sind der Nebenpfad
            log.warning(
                "task_rules_sync_failed",
                reservation_id=reservation_id,
                error=str(exc),
            )

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
        # Der Eigentümer erfährt von Buchung/Umzug/Storno an SEINEM Objekt
        # (0331). Bewusst HIER und nicht an den neun Aufrufern in writes.py:
        # jedes Ereignis der Zeitleiste läuft durch diese eine Stelle, ein
        # zweiter Event-Pfad entstünde sonst von allein. Die Funktion filtert
        # selbst auf die Ereignisarten, die den Eigentümer angehen, und ist
        # best-effort (fängt intern breit, Wurzel 5).
        self._melde_eigentuemer(tenant_id, reservation_id, kind)

    def _melde_eigentuemer(
        self, tenant_id: str, reservation_id: str, kind: str
    ) -> None:
        """Objekt + maskierte Gastangaben nachladen und den Eigentümer melden.

        Nachladen statt Durchreichen: `_log_event` bekommt von seinen Aufrufern
        kein `property_id` und keinen Gastnamen, und diese neun Signaturen
        umzubauen wäre ein größerer Eingriff als eine Abfrage im Nebenpfad.

        Was mitgeht, ist der Datensplit (Wurzel 3): NUR Vorname und Kanal —
        `total_amount` wird gar nicht erst geladen, damit es auch niemand
        versehentlich in den Text nimmt.
        """
        from src.features.notification_settings.ereignisse import (  # noqa: PLC0415
            BUCHUNGS_EREIGNISSE,
            melde_buchungs_ereignis,
        )

        if kind not in BUCHUNGS_EREIGNISSE or self._client is None:
            return
        try:
            rows = (
                self._db()
                .table("reservations")
                .select("property_id, guest_id, channel, ota_name")
                .eq("id", reservation_id)
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data or []
            if not rows:
                return
            row = rows[0]
            melde_buchungs_ereignis(
                self._db(),
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                kind=kind,
                property_id=(
                    str(row["property_id"]) if row.get("property_id") else None
                ),
                # Der Name hängt an `guests`, nicht an der Reservierung. Der
                # volle Name wird geladen, aber `melde_buchungs_ereignis`
                # schneidet ihn auf den Vornamen zurück (§4.2) — die Maskierung
                # steht an EINER Stelle, nicht an jedem Aufrufer.
                gast_vorname=self._gast_name(tenant_id, row.get("guest_id")),
                # BEIDE getrennt, nicht vorher zusammengefallen: `ota_name` ist
                # ein Markenname und geht wörtlich hinaus, `channel` ist unser
                # Enum und muss übersetzt werden. Das frühere
                # `ota_name or channel` machte aus beidem denselben Rohtext —
                # der Eigentümer las bei einer Direktbuchung „direct".
                quelle=row.get("ota_name"),
                kanal=row.get("channel"),
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, kippt die Buchung nicht
            log.warning(
                "owner_benachrichtigung_fehlgeschlagen",
                reservation_id=reservation_id,
                kind=kind,
                error=str(exc)[:200],
            )

    def _gast_name(self, tenant_id: str, guest_id: str | None) -> str | None:
        """Gastname aus `guests` — tenant-gescopt (Wurzel 3).

        Ohne verknüpften Gast (OTA-Import ohne Gästezeile) bleibt es None; die
        Meldung nennt dann nur die Quelle. Kein Platzhalter-Name (Wurzel 4).
        """
        if not guest_id:
            return None
        rows = (
            self._db()
            .table("guests")
            .select("name")
            .eq("id", guest_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("name") if rows else None

    def _require_own_unit(
        self, tenant_id: str, property_id: str, unit_id: str | None
    ) -> str | None:
        """Die vorgegebene Einheit gehört zu DIESEM Objekt und Mandanten.

        Wurzel 3: Der Service läuft mit dem Service-Role-Key und umgeht RLS.
        Eine ungeprüft übernommene `unit_id` wanderte in die Reservierung und
        in die `availability`-Zeile — über eine geratene UUID ließe sich die
        Einheit eines FREMDEN Objekts belegen. Beide Filter in DERSELBEN
        Abfrage, damit Load und Scope nicht auseinanderfallen.

        `None` bleibt `None`: keine Angabe heißt „die RPC wählt die erste
        freie" (0275) und ist kein fehlender Wert (Wurzel 4).
        """
        if unit_id is None:
            return None
        rows = (
            self._db()
            .table("property_units")
            .select("id")
            .eq("id", unit_id)
            .eq("property_id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise ReservationError(
                "Einheit gehört nicht zu diesem Objekt.", status_code=422
            )
        return unit_id

    def _require_own_owner(
        self, tenant_id: str, property_id: str, owner_id: str | None
    ) -> str | None:
        """Der angegebene Eigentümer gehört zum Mandanten UND zu DIESEM Objekt.

        ZWEI Stufen, beide nötig (Wurzel 3/9):
        1. Der Eigentümer gehört dem Mandanten — sonst hinge über eine geratene
           UUID der Eigentümer eines fremden Betriebs an unserer Belegung.
        2. Ihm gehört DIESES Objekt (`owner_properties`, 0063/0073) — sonst
           könnte man dem Eigentümer von Objekt A eine Eigennutzung an Objekt B
           zuschreiben. Das ist nicht bloß eine falsche Zeile: „Eigennutzung"
           schließt Umsatz aus (0241) und taucht in der Abrechnung des Falschen
           auf.

        Fail-closed: kein Treffer → 422, kein stilles Verwerfen des Werts
        (das ergäbe einen Eigentümer-Aufenthalt ohne Eigentümer).
        """
        if not owner_id:
            return None
        rows = (
            self._db()
            .table("owner_properties")
            .select("owner_id, owners!inner(tenant_id)")
            .eq("owner_id", owner_id)
            .eq("property_id", property_id)
            .eq("owners.tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise ReservationError(
                "Eigentümer gehört nicht zu diesem Objekt.", status_code=422
            )
        return owner_id

    def _load_owned(self, tenant_id: str, reservation_id: str) -> dict:
        """Reservierung tenant-scoped laden (404, wenn fremd/fehlend)."""
        _require_uuid(reservation_id)
        rows = (
            self._db()
            .table("reservations")
            .select("*, guests(name), owners(name)")
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
        unit_id: str | None = None,
        push: bool = True,
    ) -> None:
        """Gibt geräumte Nächte einer Reservierung frei — die EINE Stelle, an der
        eine Reservierung Kalendertage zurückgibt (move-Resize, cancel, künftig
        jeder weitere Pfad). Zusammengeführt aus den zuvor kopierten Blöcken in
        move()/cancel(), damit der Alt-/Neu-Diff nie an einer neuen Stelle
        vergessen werden kann (Wurzel: „Vorwärts-Schritt ohne Gegenzustand").

        `unit_id` ist die Einheit DIESER Reservierung und begrenzt die Freigabe
        auf sie. Seit 0265 hat ein Objekt n ≥ 1 Einheiten; ohne diese Grenze
        öffnet ein Storno die Nacht auf ALLEN Einheiten und reißt die Sperre
        einer fremden Buchung mit — der Schwesterpfad
        `channel_manager.bookings_sync._free_ota_nights` hat genau das live
        erlebt („Buchung B storniert, Buchung A verlor ihre Sperre") und ist
        deshalb längst unit-genau. Fehlt der Wert (Altbestand ohne `unit_id`),
        bleibt es beim objektweiten Verhalten von vorher.

        Freigegeben wird NUR für Tage, die keine andere aktive Buchung noch
        belegt (sonst Überbuchung), und NUR Zeilen, die wirklich eine BELEGUNG
        sind (`status='booked'`). Rechnet danach Dynamic Pricing neu.

        `push=False` gibt lokal frei, meldet aber NICHT an die Portale — für
        Aufrufer, die im selben Vorgang noch belegen (move) und deshalb erst
        den fertigen Kalenderstand melden dürfen. Ein Push mitten im Vorgang
        meldete die gerade geräumten Tage als frei, obwohl sie Sekunden später
        wieder belegt sind (Überbuchungsfenster).
        """
        if not nights:
            return
        still = self._days_still_booked_by_others(
            property_id, nights, reservation_id, unit_id
        )
        release = [d for d in nights if d not in still]
        if not release:
            return
        # `status='booked'` ist der entscheidende Filter, nicht bloß eine
        # Optimierung: `availability` führt Belegung UND Sperre in derselben
        # Zeile (Enum 0004: open|booked|blocked). Eine Sperre steht als
        # 'blocked' — externer Kalender (`source='ical'`,
        # external_calendar/service.py) oder manueller Block. Ohne den Filter
        # setzte ein Storno auch sie auf 'open', und der anschließende
        # `_release_channex`-Push meldete den Tag als frei an die Portale:
        # Verkauf einer Nacht, die anderswo längst vergeben ist —
        # Überbuchung. `_days_still_booked_by_others` schützt davor NICHT, es
        # liest ausschließlich `reservations`, und eine iCal-/Manual-Sperre ist
        # keine Reservierung. Gleiches Muster wie
        # `bookings_sync._free_ota_nights` und der `occupied_now`-Check in
        # writes.py.
        if unit_id:
            # Nur die eigene Einheit öffnen. `update` statt `upsert`: es gibt
            # nichts anzulegen — die Zeile dieser Einheit existiert, weil die
            # Buchung sie belegt hat.
            for d in release:
                (
                    self._db()
                    .table("availability")
                    .update({"status": "open", "source": "manual"})
                    .eq("property_id", property_id)
                    .eq("unit_id", unit_id)
                    .eq("date", d)
                    .eq("status", "booked")
                    .execute()
                )
        else:
            # Altbestand ohne bekannte Einheit: objektweit, aber ebenfalls nur
            # belegte Zeilen. Vorher stand hier ein `upsert` — der konnte den
            # `status='booked'`-Filter gar nicht ausdrücken und legte für Tage
            # ohne Zeile sogar neue 'open'-Zeilen an, auf ALLEN Einheiten des
            # Typs. Ein `update` je Tag trifft genau die vorhandenen Zeilen.
            for d in release:
                (
                    self._db()
                    .table("availability")
                    .update({"status": "open", "source": "manual"})
                    .eq("property_id", property_id)
                    .eq("date", d)
                    .eq("status", "booked")
                    .execute()
                )
        if push:
            self._release_channex(tenant_id, property_id, release)
        if recompute:
            self._recompute_dynamic_pricing(tenant_id, property_id)

    def _push_einheiten_stand(
        self,
        tenant_id: str,
        property_id: str,
        von: date,
        bis: date,
        *,
        outbox_id: str | None = None,
    ) -> None:
        """Den FERTIGEN Kalenderstand eines Zeitraums an Channex melden — die
        eine Stelle, an der die Zahl freier Einheiten ermittelt und gepusht wird.

        Belegung und Freigabe sind dieselbe Frage („wie viele Einheiten sind an
        diesem Tag noch verkäuflich?") und dürfen deshalb nicht zwei Antworten
        haben. Der Belegungspfad meldete bis hierher pauschal `0` — bei einem
        Typ mit n Einheiten (0265) nahm damit die ERSTE Buchung dem ganzen Typ
        die Verfügbarkeit, die übrigen Einheiten waren bei Booking/Airbnb
        unverkäuflich. `freie_einheiten_spannen` liest den Kalender (die
        Wahrheit für Belegung) und liefert die Spannen gleicher Stückzahl fertig
        für den Push; derselbe Weg, den `bookings_sync` schon nutzt.

        `bis` ist INKLUSIV (letzte Nacht), `_push_channex_availability` nimmt
        das Ende exklusiv. Voraussetzung: der Kalender ist für den ganzen
        Zeitraum bereits geschrieben — sonst meldet der Push einen Zwischen-
        stand (zu viele freie Einheiten = Überbuchungsrisiko).

        `outbox_id` ist eine BEREITS geschriebene Outbox-Zeile (die RPC legt
        beim Anlegen eine an). Sie deckt den GANZEN Zeitraum mit EINEM Wert ab
        (dem Minimum, das die RPC kennt) — nicht eine einzelne Spanne. Zerfällt
        der Zeitraum hier in mehrere Stückzahl-Spannen, quittiert die ERSTE
        Spanne diese Zeile; die übrigen schreiben sich ihre eigene. Der Stand
        bleibt korrekt, weil die eigene Zeile jeder weiteren Spanne deren echte
        Zahl trägt und die pauschale Ausgangszeile nur nach unten abweichen
        kann (Minimum → nie zu viele freie Einheiten gemeldet). Sie mehrfach
        mitzugeben hieße dagegen, denselben Datensatz mit widersprüchlichen
        Zahlen zu quittieren.

        Best-effort (ari_outbox-Retry).
        """
        if bis < von:
            return
        for span_von, span_bis, frei in freie_einheiten_spannen(
            self._db(), tenant_id, property_id, von, bis
        ):
            self._push_channex_availability(
                tenant_id, property_id, span_von, span_bis + timedelta(days=1), frei,
                outbox_id=outbox_id,
            )
            outbox_id = None

    def _release_channex(
        self, tenant_id: str, property_id: str, days: list[str]
    ) -> None:
        """Freigegebene Tage an Channex melden — mit der ECHTEN Zahl freier
        Einheiten, nicht pauschal 1.

        Seit 0265 hat ein Objekt n ≥ 1 Einheiten, und Verfügbarkeit an die
        Portale ist eine ZAHL. Ein festes `1` war doppelt falsch: Bei drei
        Einheiten, von denen nach dem Storno zwei frei sind, meldete es 1 (zwei
        Einheiten blieben unverkauft); belegt eine andere Buchung den Tag noch,
        meldete es fälschlich 1 statt 0 — eine Überbuchung. `freie_einheiten_spannen`
        liest den Kalenderstand NACH der Freigabe und liefert die Spannen
        gleicher Stückzahl fertig für den Push; derselbe Weg, den
        `bookings_sync._free_ota_nights` schon nutzt.

        Best-effort (ari_outbox-Retry).
        """
        if not days:
            return
        ordered = [date.fromisoformat(d) for d in sorted(days)]
        self._push_einheiten_stand(
            tenant_id, property_id, ordered[0], ordered[-1]
        )

    def _quote(
        self,
        property_id: str,
        check_in: date,
        check_out: date,
        guests: int,
        channel: str,
        rate_plan_id: str | None = None,
        pets: int = 0,
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
                pets=max(0, pets),
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
        guest_name = anzeigename(r)
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
            # Eigentümer-Aufenthalt (0241): OHNE dieses Feld fiel die Antwort auf
            # den Standardwert False zurück, und der Kalender zeichnete den
            # Aufenthalt als normale Buchung — mit dem Kanal aus `channel`
            # ('direct'), also als „Direkt". Er sah damit aus wie eigener
            # Vertrieb und zählte für den Betrachter als Umsatzbuchung, obwohl
            # er per CHECK keinen Betrag tragen kann.
            is_owner_stay=bool(r.get("is_owner_stay")),
            stay_note=r.get("stay_note"),
        )
