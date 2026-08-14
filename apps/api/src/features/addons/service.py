"""Service-Schicht für addons (Zusatzleistungen/Upsells).

CRUD über die Service-Role mit explizitem tenant-Scope (tenant_id stammt immer
aus dem JWT, nie aus User-Input — Muster wie properties.service). Katalog je
Objekt (``property_addons``) plus gekaufte Extras (``reservation_addons``) mit
serverseitiger Preisberechnung und Payment-gegatetem Zahlstatus.
"""
from __future__ import annotations

import secrets
from datetime import UTC, date, datetime

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import public_storage_url

from .pricing import addon_total, vorbelegte_menge
from .schemas import (
    AddonCreate,
    AddonListResponse,
    AddonResponse,
    AddonStatus,
    AddonUpdate,
    ReservationAddonListResponse,
    ReservationAddonResponse,
    SliceHealth,
)
from .verteilung import VerteilungMixin

log = get_logger("nextdays.addons")

_ADDON_COLS = (
    "id, property_id, name, description, media, price, basis, mandatory, "
    "appears_in, available_until, tax_rate, active, sort_order"
)
_RES_ADDON_COLS = (
    "id, reservation_id, addon_id, name, price, basis, tax_rate, qty, total, "
    "status, charged_at, created_at, cancel_reason, cancelled_by, cancelled_at"
)

# Grund-Freitext bei Storno/Rücknahme (0397). Die Grenzen spiegeln den
# CHECK-Constraint der Spalte — ohne sie käme der Verstoß als roher 500 statt
# als fachlicher 422 zurück.
_REASON_MIN_LEN = 3
_REASON_MAX_LEN = 500

# Die Spuren einer Storno-/Rücknahme-Handlung. Wird eine Zeile danach wieder in
# einen normalen Zustand gebracht (bezahlt, Menge geändert), müssen sie weg —
# sonst behauptet der Beleg einen Grund, der zum vorigen Vorgang gehörte, und die
# Zeile widerspricht sich selbst (Wurzel 1). Als Konstante, damit kein
# Schreibpfad eines der drei Felder vergisst.
_STORNO_SPUREN_LEER = {
    "cancel_reason": None,
    "cancelled_by": None,
    "cancelled_at": None,
}

# Obergrenze der Menge je gebuchter Zusatzleistung (Wurzel 8: kein unbegrenzter
# Bereich). Großzügig genug für jede reale Bestellung — ein Gruppenhaus mit 30
# Betten bleibt darunter —, aber ein Tippfehler (1000 statt 10) läuft nicht als
# vierstellige Rechnung durch.
_MAX_ADDON_QTY = 99


class AddonError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class AddonsService(VerteilungMixin):
    """Katalog, Verkauf und Verteilung der Zusatzleistungen.

    Die Verteilung auf mehrere Objekte (Bibliothek + „Zu anderen Objekten
    hinzufügen") liegt als Mixin in `verteilung.py` — dieselbe Trennung, die
    `PropertiesService` für Gebühren und Steuern fährt.
    """

    slice_name = "addons"

    IMAGE_BUCKET = "property-images"
    MEDIA_MIME = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
    MEDIA_MIN_BYTES = 10 * 1024
    MEDIA_MAX_BYTES = 20 * 1024 * 1024
    MEDIA_MAX_COUNT = 5

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise AddonError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _assert_own_property(self, tenant_id: str, property_id: str) -> None:
        rows = (
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AddonError("Objekt gehört nicht zu diesem Konto.", status_code=404)

    def _property_currency(self, property_id: str) -> str | None:
        """Währung des Objekts aus dem (ersten) Rate-Plan. Kein Fallback — None,
        wenn keine hinterlegt ist (27 EU-Länder/Mehrwährung; nie € erfinden)."""
        try:
            rows = (
                self._db.table("rate_plans")
                .select("currency")
                .eq("property_id", property_id)
                .order("created_at")
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = keine Währung
            log.warning("addon_currency_unavailable", error=str(exc))
            return None
        return (rows[0].get("currency") or None) if rows else None

    # --- Katalog (Dashboard, MANAGE_PROPERTIES) ------------------------------

    def list_for_property(
        self, ctx: AuthContext, property_id: str
    ) -> AddonListResponse:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        rows = (
            self._db.table("property_addons")
            .select(_ADDON_COLS)
            .eq("property_id", property_id)
            .order("sort_order")
            .execute()
        ).data or []
        items = [AddonResponse(**_addon_row(r)) for r in rows]
        return AddonListResponse(
            items=items,
            total=len(items),
            currency=self._property_currency(property_id),
        )

    def create(
        self, ctx: AuthContext, property_id: str, req: AddonCreate
    ) -> AddonResponse:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        payload = req.model_dump(mode="json")
        payload["property_id"] = property_id
        res = self._db.table("property_addons").insert(payload).execute()
        if not res.data:
            raise AddonError("Zusatzleistung konnte nicht angelegt werden.", status_code=500)
        log.info("addon_created", tenant_id=tenant_id, property_id=property_id)
        return AddonResponse(**_addon_row(res.data[0]))

    def _get_addon(self, tenant_id: str, addon_id: str) -> dict:
        rows = (
            self._db.table("property_addons")
            .select(_ADDON_COLS + ", properties!inner(tenant_id)")
            .eq("id", addon_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows or str(rows[0].get("properties", {}).get("tenant_id")) != tenant_id:
            raise AddonError("Zusatzleistung nicht gefunden.", status_code=404)
        return rows[0]

    def update(
        self, ctx: AuthContext, addon_id: str, req: AddonUpdate
    ) -> AddonResponse:
        tenant_id = self._require_tenant(ctx)
        self._get_addon(tenant_id, addon_id)  # 404, wenn fremd
        changes = req.model_dump(mode="json", exclude_unset=True)
        if changes:
            res = (
                self._db.table("property_addons")
                .update(changes)
                .eq("id", addon_id)
                .execute()
            )
            if not res.data:
                raise AddonError("Zusatzleistung nicht gefunden.", status_code=404)
        row = self._get_addon(tenant_id, addon_id)
        log.info("addon_updated", tenant_id=tenant_id, addon_id=addon_id)
        return AddonResponse(**_addon_row(row))

    def delete(self, ctx: AuthContext, addon_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._get_addon(tenant_id, addon_id)  # 404, wenn fremd
        self._db.table("property_addons").delete().eq("id", addon_id).execute()
        log.info("addon_deleted", tenant_id=tenant_id, addon_id=addon_id)

    def add_media(
        self, ctx: AuthContext, addon_id: str, content: bytes, content_type: str
    ) -> AddonResponse:
        """Ein Medium (Bild) hochladen → property-images-Bucket + an media anhängen."""
        tenant_id = self._require_tenant(ctx)
        row = self._get_addon(tenant_id, addon_id)
        ext = self.MEDIA_MIME.get(content_type)
        if not ext:
            raise AddonError("Nur JPEG/PNG/WebP erlaubt.", status_code=415)
        if len(content) < self.MEDIA_MIN_BYTES:
            raise AddonError("Bild ist zu klein (min. 10 KB).", status_code=413)
        if len(content) > self.MEDIA_MAX_BYTES:
            raise AddonError("Bild ist zu groß (max. 20 MB).", status_code=413)
        media = list(row.get("media") or [])
        if len(media) >= self.MEDIA_MAX_COUNT:
            raise AddonError("Maximal 5 Medien je Zusatzleistung.", status_code=409)

        property_id = str(row["property_id"])
        name = secrets.token_hex(8)
        path = f"{tenant_id}/{property_id}/addons/{name}.{ext}"
        storage = self._db.storage.from_(self.IMAGE_BUCKET)
        try:
            storage.upload(path, content, {"content-type": content_type})
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning("addon_media_upload_failed", addon_id=addon_id, error=str(exc))
            raise AddonError("Upload fehlgeschlagen.", status_code=502) from exc
        url = public_storage_url(self.IMAGE_BUCKET, path)
        media.append(url)
        self._db.table("property_addons").update({"media": media}).eq(
            "id", addon_id
        ).execute()
        log.info("addon_media_added", tenant_id=tenant_id, addon_id=addon_id)
        return AddonResponse(**_addon_row(self._get_addon(tenant_id, addon_id)))

    # --- Verkauf / Käufe (auth-gescoped Dashboard-Sicht) ---------------------

    def list_for_reservation(
        self, ctx: AuthContext, reservation_id: str
    ) -> ReservationAddonListResponse:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("reservation_addons")
            .select(_RES_ADDON_COLS)
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .order("created_at")
            .execute()
        ).data or []
        items = [ReservationAddonResponse(**_res_addon_row(r)) for r in rows]
        total = round(sum(i.total for i in items), 2)
        currency = None
        guests: int | None = None
        res_rows = (
            self._db.table("reservations")
            # `num_guests` speist die Mengen-Vorbelegung „pro Gast" im Frontend.
            .select("property_id, currency, num_guests")
            .eq("tenant_id", tenant_id)
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if res_rows:
            # Reservierungs-Währung bevorzugt (so wurde gebucht), sonst Objekt-Plan.
            currency = res_rows[0].get("currency") or self._property_currency(
                str(res_rows[0]["property_id"])
            )
            roh = res_rows[0].get("num_guests")
            guests = int(roh) if roh is not None else None
        return ReservationAddonListResponse(
            items=items, total=total, currency=currency, guests=guests
        )

    def _own_reservation(self, tenant_id: str, reservation_id: str) -> dict:
        rows = (
            self._db.table("reservations")
            .select("id, tenant_id, property_id, check_in, check_out, num_guests")
            .eq("tenant_id", tenant_id)
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AddonError("Reservierung nicht gefunden.", status_code=404)
        return rows[0]

    def available_for_reservation(
        self, ctx: AuthContext, reservation_id: str
    ) -> AddonListResponse:
        """Aktive Katalog-Add-ons des Objekts dieser Reservierung — für die
        Schnell-Hinzufügen-Auswahl im Reservierungs-Detail (Dashboard)."""
        tenant_id = self._require_tenant(ctx)
        res = self._own_reservation(tenant_id, reservation_id)
        rows = (
            self._db.table("property_addons")
            .select(_ADDON_COLS)
            .eq("property_id", str(res["property_id"]))
            .eq("active", True)
            .order("sort_order")
            .execute()
        ).data or []
        items = [AddonResponse(**_addon_row(r)) for r in rows]
        return AddonListResponse(
            items=items,
            total=len(items),
            currency=self._property_currency(str(res["property_id"])),
        )

    def add_to_reservation(
        self, ctx: AuthContext, reservation_id: str, addon_id: str, qty: int
    ) -> ReservationAddonListResponse:
        """Zusatzleistung als Schnelltaste zu einer bestehenden Buchung hinzufügen
        (Dashboard/Agentur). Betrag serverseitig aus dem Katalog; löst den
        Task-Trigger aus. Verkaufsfläche „checkin" → keine appears_in-Schranke
        für den manuellen Verkauf durch die Hausverwaltung."""
        tenant_id = self._require_tenant(ctx)
        res = self._own_reservation(tenant_id, reservation_id)
        addon = self._addon_for_property(str(res["property_id"]), addon_id)
        check_in = date.fromisoformat(str(res["check_in"]))
        check_out = date.fromisoformat(str(res["check_out"]))
        nights = max((check_out - check_in).days, 1)
        guests = int(res.get("num_guests") or 1)
        tax_rate = (
            float(addon["tax_rate"]) if addon.get("tax_rate") is not None else None
        )
        basis = str(addon.get("basis") or "per_stay")
        # Ohne Mengenangabe die Basis-Vorbelegung nehmen (per_guest = Gästezahl),
        # sonst die gewünschte Menge. `qty=0` heißt „nicht angegeben" — eine echte
        # 0 wäre keine Bestellung.
        menge = int(qty) if int(qty) > 0 else vorbelegte_menge(basis, guests=guests)
        _net, gross = addon_total(
            float(addon.get("price") or 0),
            basis,
            tax_rate,
            nights=nights,
            qty=menge,
        )
        names = addon.get("name") or {}
        try:
            self._db.table("reservation_addons").insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "addon_id": addon_id,
                    "name": names,
                    "price": float(addon.get("price") or 0),
                    "basis": basis,
                    "tax_rate": tax_rate,
                    "qty": menge,
                    "total": gross,
                    "status": AddonStatus.pending.value,
                }
            ).execute()
        except APIError as exc:
            # Idempotenz (0109-Unique-Index): diese Zusatzleistung ist für die
            # Buchung schon aktiv gebucht → fachlicher 409 statt rohem 500
            # (Doppelklick auf die Schnelltaste).
            if "reservation_addons_active_uidx" not in str(exc):
                raise
            raise AddonError(
                "Diese Zusatzleistung ist für die Buchung bereits gebucht.",
                status_code=409,
            ) from exc
        # Trigger „addon_purchased": Vorbereitungs-Aufgabe (best-effort).
        label = names.get("de") or next(iter(names.values()), "Zusatzleistung")
        try:
            from src.features.tasks.service import TasksService  # noqa: PLC0415

            TasksService(client=self._db).generate_for_addon(
                tenant_id,
                str(res["property_id"]),
                reservation_id,
                label,
                check_in.isoformat(),
            )
        except Exception as exc:  # noqa: BLE001 — Task-Fehler darf Kauf nicht killen
            log.warning("addon_task_failed", reservation_id=reservation_id, error=str(exc))
        log.info("addon_added_to_reservation", tenant_id=tenant_id, id=reservation_id)
        return self.list_for_reservation(ctx, reservation_id)

    def _addon_for_property(self, property_id: str, addon_id: str) -> dict:
        rows = (
            self._db.table("property_addons")
            .select(_ADDON_COLS)
            .eq("id", addon_id)
            .eq("property_id", property_id)
            .eq("active", True)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AddonError(
                "Zusatzleistung gehört nicht zu diesem Objekt.", status_code=404
            )
        return rows[0]

    def mark_paid(self, ctx: AuthContext, res_addon_id: str) -> ReservationAddonResponse:
        """Manuell als bezahlt markieren (solange kein Payment-Provider live ist).

        Nur aus ``pending``: Ohne diesen Filter überschrieb der Aufruf JEDEN
        Status — auch ``cancelled``. Eine stornierte Position wäre damit per
        Doppelklick wieder „bezahlt" gewesen, mitsamt Grund und Storno-Datum in
        der Zeile (der Beleg hätte sich selbst widersprochen). Ein zweiter Klick
        auf eine bereits bezahlte Position ist ein No-op und gibt die Zeile
        zurück, statt ``charged_at`` auf jetzt zu verschieben (Wurzel 2: real
        kommt alles doppelt).
        """
        tenant_id = self._require_tenant(ctx)
        row = self._own_res_addon(tenant_id, res_addon_id)
        status = str(row.get("status"))
        if status == AddonStatus.paid.value:
            return ReservationAddonResponse(**_res_addon_row(row))
        if status == AddonStatus.cancelled.value:
            raise AddonError(
                "Diese Zusatzleistung ist storniert. Bitte neu hinzufügen, statt "
                "das Storno zu überschreiben.",
                status_code=409,
            )
        res = (
            self._db.table("reservation_addons")
            .update(
                {
                    "status": AddonStatus.paid.value,
                    "charged_at": _now_iso(),
                    # Wurzel 1: Die Rücknahme-Spuren gehören zum VORIGEN Vorgang.
                    # Bleiben sie stehen, zeigt die bezahlte Zeile „Grund: falsch
                    # erfasst" — eine Falschaussage am Beleg — und
                    # `addon-storno-pruefen.sh` meldet für zwei normale Klicks
                    # (zurücknehmen, dann bar bezahlt) einen DB-Direktzugriff.
                    **_STORNO_SPUREN_LEER,
                }
            )
            .eq("tenant_id", tenant_id)
            .eq("id", res_addon_id)
            # Zwischen Lesen und Schreiben kann ein anderer Weg die Zeile
            # storniert oder bezahlt haben (Wurzel 2).
            .eq("status", AddonStatus.pending.value)
            .execute()
        )
        if not res.data:
            raise AddonError(
                "Die Zusatzleistung wurde zwischenzeitlich geändert. Bitte die "
                "Seite neu laden.",
                status_code=409,
            )
        log.info("reservation_addon_marked_paid", tenant_id=tenant_id, id=res_addon_id)
        self._log_timeline(
            tenant_id,
            str(row["reservation_id"]),
            "addon_marked_paid",
            ctx,
            {"name": row.get("name") or {}, "total": float(row.get("total") or 0)},
        )
        return ReservationAddonResponse(**_res_addon_row(res.data[0]))

    def unmark_paid(
        self, ctx: AuthContext, res_addon_id: str, reason: str
    ) -> ReservationAddonResponse:
        """Eine FÄLSCHLICH gesetzte Bezahlt-Markierung zurücknehmen (→ pending).

        Der Anlass (14.08.2026, live): Bei einer Booking-Buchung wurde
        „Wäschepaket, 600 DKK" versehentlich auf bezahlt gesetzt. Danach war die
        Zeile eine Sackgasse — Storno und Mengenänderung lehnen eine bezahlte
        Position beide mit 409 ab und verweisen auf eine Rückabwicklung, die es
        als Route nicht gab.

        Fachlich ist das die Korrektur einer FEHLEINGABE, nicht eine
        Rückzahlung: Es ist kein Geld geflossen, das zurückfließen müsste — es
        wurde nur der falsche Haken gesetzt. Danach ist die Position wieder
        offen und kann normal storniert oder in der Menge geändert werden.

        Deshalb zwei Schranken:
        * War die Zahlung ECHT (per Zahlungslink über Stripe eingegangen, also
          ``charged_at`` mit einem bezahlten Link), ist das keine Fehleingabe →
          409. Sonst verschwände eine vereinnahmte Kartenzahlung aus der
          Abrechnung, während das Geld auf dem Stripe-Konto liegt.
        * Steht die Position auf einer festgeschriebenen Rechnung, gilt GoBD →
          409 mit Verweis auf die Korrekturrechnung.

        Der Grund ist Pflicht und landet am Datensatz UND in der Zeitleiste:
        ein Betrag, der wieder offen wird, muss erklärbar bleiben.
        """
        tenant_id = self._require_tenant(ctx)
        grund = self._pruefe_grund(reason)
        row = self._own_res_addon(tenant_id, res_addon_id)
        status = str(row.get("status"))
        if status == AddonStatus.pending.value:
            # Idempotent (Wurzel 2): schon offen → nichts zu tun.
            return ReservationAddonResponse(**_res_addon_row(row))
        if status == AddonStatus.cancelled.value:
            raise AddonError(
                "Diese Zusatzleistung ist storniert, nicht bezahlt.",
                status_code=409,
            )
        self._assert_keine_echte_zahlung(tenant_id, row)
        self._assert_not_invoiced(tenant_id, str(row["reservation_id"]))

        res = (
            self._db.table("reservation_addons")
            .update(
                {
                    "status": AddonStatus.pending.value,
                    # Der Zahl-Zeitpunkt gehörte zu einer Zahlung, die es nicht
                    # gab — er darf nicht stehen bleiben (Wurzel 1: der
                    # Gegenzustand wird mitgepflegt).
                    "charged_at": None,
                    "cancel_reason": grund,
                    "cancelled_by": ctx.user_id,
                    "cancelled_at": _now_iso(),
                }
            )
            .eq("tenant_id", tenant_id)
            .eq("id", res_addon_id)
            .eq("status", AddonStatus.paid.value)
            .execute()
        )
        if not res.data:
            raise AddonError(
                "Die Zusatzleistung wurde zwischenzeitlich geändert. Bitte die "
                "Seite neu laden.",
                status_code=409,
            )
        # Wurzel 1: Der Entwurf hat den Addon-Betrag als `paid_amount` mitgezählt
        # (`status == 'paid'`); wieder offen muss er dort verschwinden, sonst
        # schreibt der Check-out ein zu hohes „bereits bezahlt" fest. Auch hier
        # steht die Änderung schon — ein Fehler wird geloggt, nicht als
        # Fehlschlag des Vorgangs gemeldet (s. `_baue_rechnungsentwurf_neu`).
        self._baue_rechnungsentwurf_neu(
            tenant_id, str(row["reservation_id"]), storno_steht_schon=True
        )
        log.info(
            "reservation_addon_unmarked_paid",
            tenant_id=tenant_id,
            id=res_addon_id,
            by=ctx.user_id,
        )
        self._log_timeline(
            tenant_id,
            str(row["reservation_id"]),
            "addon_unmarked_paid",
            ctx,
            {
                "name": row.get("name") or {},
                "total": float(row.get("total") or 0),
                "reason": grund,
            },
        )
        return ReservationAddonResponse(**_res_addon_row(res.data[0]))

    def _pruefe_grund(self, reason: str) -> str:
        """Pflicht-Grund prüfen und normalisieren.

        Ein leerer oder aus Leerzeichen bestehender Grund wird abgelehnt (422),
        nicht durch einen Platzhalter ersetzt: „kein Grund angegeben" als
        Ersatztext wäre eine erfundene Auskunft und würde die Nachvollziehbar-
        keit vortäuschen, um die es hier geht (Wurzel 4). Die Obergrenze
        spiegelt den CHECK der Spalte (Wurzel 8).
        """
        grund = (reason or "").strip()
        if len(grund) < _REASON_MIN_LEN:
            raise AddonError(
                f"Bitte einen Grund angeben (mindestens {_REASON_MIN_LEN} "
                "Zeichen) — er wird am Vorgang protokolliert.",
                status_code=422,
            )
        if len(grund) > _REASON_MAX_LEN:
            raise AddonError(
                f"Der Grund darf höchstens {_REASON_MAX_LEN} Zeichen haben.",
                status_code=422,
            )
        return grund

    def _own_res_addon(self, tenant_id: str, res_addon_id: str) -> dict:
        """Eine gekaufte Zusatzleistung tenant-gescoped laden (Wurzel 3).

        Load und Scope bleiben zusammen — die Service-Role umgeht RLS, ein
        ungescopter Load nach ID würde fremde Buchungen ausliefern.
        """
        rows = (
            self._db.table("reservation_addons")
            .select(_RES_ADDON_COLS)
            .eq("tenant_id", tenant_id)
            .eq("id", res_addon_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AddonError("Gekaufte Zusatzleistung nicht gefunden.", status_code=404)
        return rows[0]

    def _assert_keine_echte_zahlung(self, tenant_id: str, row: dict) -> None:
        """409, wenn zu dieser Position eine ECHTE Kartenzahlung eingegangen ist.

        Unterscheidet die beiden Fälle, die im Status ``paid`` zusammenfallen:
        der manuell gesetzte Haken (Fehleingabe, rücknehmbar) und ein über den
        Stripe-Zahlungslink wirklich eingegangener Betrag (nicht rücknehmbar —
        dafür braucht es eine Erstattung, damit Geldfluss und Abrechnung nicht
        auseinanderlaufen).

        Geprüft wird genau DIESE Position (über die Link-Positionen, 0386), nicht
        die Buchung: Eine Buchung kann mehrere Extras haben, von denen nur einige
        über einen bezahlten Link liefen. Ein Filter auf die Reservierung hätte
        die manuell falsch gehakte Position mitgesperrt, sobald irgendein
        anderes Extra derselben Buchung per Karte bezahlt wurde — also genau die
        Sackgasse wieder aufgebaut, die hier aufgelöst wird.

        Geprüft werden `paid` UND `open`-Links (fail-closed, Wurzel 5): Unser
        Link-Status ist NICHT die Wahrheit über den Geldfluss, sondern nur unser
        Wissensstand. Zahlt der Gast per Karte und der Connect-Webhook stellt
        nicht zu, bleibt der Link bei uns `open`, obwohl das Geld schon auf dem
        Stripe-Konto liegt (genau dafür existiert der Nachlese-Abgleich in
        `zahlung.lesen`). Ein Check nur auf `status='paid'` hätte in diesem Fall
        nichts gefunden und die Rücknahme durchgelassen — 600 DKK vereinnahmt,
        Position storniert, niemand sieht einen Fehler. Bei einem offenen Link
        wird deshalb Stripe selbst gefragt.

        Antwortet die Link-Tabelle nicht, wird NICHT zurückgenommen. Ein stilles
        Durchwinken könnte eine vereinnahmte Zahlung aus der Abrechnung nehmen.
        """
        try:
            links = (
                self._db.table("addon_payment_links")
                .select("id, status, stripe_payment_link_id, stripe_account_id")
                .eq("tenant_id", tenant_id)
                .eq("reservation_id", str(row["reservation_id"]))
                .in_("status", ["paid", "open"])
                .execute()
            ).data or []
            rows: list[dict] = []
            if links:
                rows = (
                    self._db.table("addon_payment_link_items")
                    .select("link_id, reservation_addon_id")
                    .in_("link_id", [str(link["id"]) for link in links])
                    .eq("reservation_addon_id", str(row["id"]))
                    .execute()
                ).data or []
        except APIError as exc:
            log.warning(
                "addon_unmark_paid_link_check_failed",
                reservation_id=row.get("reservation_id"),
                error=str(exc)[:200],
            )
            raise AddonError(
                "Zahlungsstand konnte nicht geprüft werden — Rücknahme "
                "abgebrochen.",
                status_code=503,
            ) from exc
        if not rows:
            return
        betroffene = {str(r["link_id"]) for r in rows}
        for link in links:
            if str(link["id"]) not in betroffene:
                continue
            if str(link.get("status")) == "paid":
                raise self._bezahlt_fehler()
            if self._stripe_sagt_bezahlt(link):
                raise self._bezahlt_fehler()

    @staticmethod
    def _bezahlt_fehler() -> AddonError:
        return AddonError(
            "Diese Zusatzleistung wurde per Karte bezahlt. Bitte den Betrag "
            "erstatten, statt die Markierung zurückzunehmen.",
            status_code=409,
        )

    def _stripe_sagt_bezahlt(self, link: dict) -> bool:
        """Liegt zu einem bei uns OFFENEN Link doch schon eine Zahlung bei Stripe?

        Der Nachlese-Weg, den `zahlung.lesen` ohnehin fährt — hier als Sperre.
        Fail-closed (Wurzel 5): Antwortet Stripe nicht, wird die Position als
        „möglicherweise bezahlt" behandelt und die Rücknahme abgebrochen. Lieber
        eine Position, die der Betrieb nach dem Abgleich erneut anfasst, als ein
        vereinnahmter Betrag, der lautlos aus der Abrechnung fällt.
        """
        from src.features.payments import (  # noqa: PLC0415 — s. _schliesse_offenen_zahlungslink
            stripe_client as sc,
        )

        try:
            session = sc.find_paid_session(
                str(link["stripe_payment_link_id"]),
                acct=str(link["stripe_account_id"]),
            )
        except Exception as exc:  # noqa: BLE001 — jede Stripe-Störung sperrt
            log.warning(
                "addon_unmark_paid_stripe_abgleich_fehlgeschlagen",
                link_id=str(link.get("id")),
                error=str(exc)[:200],
            )
            raise AddonError(
                "Der Zahlungsstand bei Stripe konnte nicht geprüft werden — "
                "Vorgang abgebrochen. Bitte später erneut versuchen.",
                status_code=503,
            ) from exc
        return session is not None

    def _baue_rechnungsentwurf_neu(
        self, tenant_id: str, reservation_id: str, *, storno_steht_schon: bool = False
    ) -> None:
        """Einen noch nicht nummerierten Rechnungsentwurf auf den neuen Stand ziehen.

        Nummerierte Rechnungen sind hier nie betroffen — die lehnt
        `_assert_not_invoiced` vorher mit 409 ab (GoBD). Der Entwurf ist genau
        der Zustand, der sich noch ändern DARF, und muss es deshalb auch.

        `storno_steht_schon=True` heißt: Der Statuswechsel ist BEREITS geschrieben
        (der Neuaufbau muss danach laufen, sonst rechnet er den alten Stand). Ein
        Fehler darf dann nicht als Fehlschlag des Vorgangs zurückgemeldet werden —
        das Storno gilt ja. Sonst sähe der Nutzer einen roten Hinweis auf eine
        Aktion, die stattgefunden hat, und würde sie erneut auslösen.
        Stattdessen: laut loggen. Der Entwurf ist selbstheilend, weil jeder
        weitere Vorgang an dieser Buchung ihn erneut aufbaut, und
        `scripts/diagnose/addon-storno-pruefen.sh` findet den Rückstand.

        Beide heutigen Aufrufer setzen das Flag, weil der Neuaufbau den NEUEN
        Stand braucht und deshalb zwingend nach dem Schreiben läuft. Der
        Default bleibt dennoch `False`: Ein künftiger Aufrufer, der VOR dem
        Schreiben prüfen kann, soll hart abbrechen — das ist die sicherere
        Voreinstellung, und sie muss bewusst abgewählt werden.
        """
        from src.features.buchhaltung.reservation_invoice import (  # noqa: PLC0415
            BuchhaltungError,
            rebuild_draft_for_reservation,
        )

        try:
            rebuild_draft_for_reservation(self._db, tenant_id, reservation_id)
        except BuchhaltungError as exc:
            if not storno_steht_schon:
                raise AddonError(exc.message, status_code=exc.status_code) from exc
            log.error(
                "addon_storno_rechnungsentwurf_nicht_aktualisiert",
                reservation_id=reservation_id,
                grund=exc.message,
            )

    def _schliesse_offenen_zahlungslink(
        self, tenant_id: str, reservation_id: str, res_addon_id: str
    ) -> None:
        """Einen offenen Stripe-Zahlungslink über diese Position schließen.

        Der Import liegt in der Methode, weil `zahlung` den Stripe-Client zieht:
        auf Modulebene würde jeder Verkaufspfad, der nur `purchase_addons`
        braucht (booking_engine, public_portal), Stripe mitladen.

        NICHT best-effort (Wurzel 5): `ZahlungslinkFehler` wird in einen
        `AddonError` übersetzt und bricht das Storno ab. Nur der Fall „kein Link
        vorhanden" ist still — dann gibt es nichts zu schließen.
        """
        from .zahlung import (  # noqa: PLC0415 — bewusst lokal, s. Docstring
            ZahlungslinkFehler,
            ziehe_link_zurueck_bei_storno,
        )

        try:
            ziehe_link_zurueck_bei_storno(
                self._db,
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                res_addon_id=res_addon_id,
            )
        except ZahlungslinkFehler as exc:
            raise AddonError(exc.message, status_code=exc.status_code) from exc

    def _log_timeline(
        self,
        tenant_id: str,
        reservation_id: str,
        kind: str,
        ctx: AuthContext,
        detail: dict,
    ) -> None:
        """Ein Ereignis in die Buchungs-Zeitleiste schreiben (0122).

        Dieselbe Tabelle, die der Reservierungs-Slice schreibt — kein zweiter
        Ereignis-Pfad. Best-effort (Wurzel 5): Die Zeitleiste ist eine
        Anzeigeschicht; der Grund selbst steht am Datensatz und ist damit auch
        ohne diese Zeile erhalten. Ein Log-Fehler darf ein Storno nicht kippen.
        """
        try:
            self._db.table("reservation_events").insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "kind": kind,
                    "by_user_id": ctx.user_id,
                    "detail": detail,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Zeitleiste ist best-effort
            log.warning(
                "addon_timeline_log_failed",
                reservation_id=reservation_id,
                kind=kind,
                error=str(exc)[:200],
            )

    def change_qty(
        self, ctx: AuthContext, res_addon_id: str, qty: int
    ) -> ReservationAddonResponse:
        """Menge einer OFFENEN Zusatzleistung ändern und neu bepreisen.

        Der Anlass (14.08.2026): Eine Buchung über 4 Personen bestellt nur 2
        Wäschepakete. Bis dahin ging das nur über Storno + Neuanlage — und weil
        `per_guest` die Gästezahl multiplizierte, ließ sie sich dabei nicht
        einmal unterschreiten. Ein falscher Betrag stand also entweder in der
        Rechnung oder die Position fehlte ganz.

        Neu berechnet wird IMMER serverseitig aus dem gespeicherten Preis und
        der Basis der Zeile (nicht aus dem Katalog): Ändert der Betrieb später
        seinen Katalogpreis, darf das eine bestehende Buchung nicht rückwirkend
        verteuern. Ein Client-Betrag wird nicht angenommen (Wurzel 3).

        Dieselben zwei Schranken wie beim Storno — bezahlt und festgeschrieben
        abgerechnet ist unveränderlich (GoBD).
        """
        tenant_id = self._require_tenant(ctx)
        menge = int(qty)
        if menge < 1:
            raise AddonError("Die Menge muss mindestens 1 sein.", status_code=422)
        # Wurzel 8: harte Obergrenze. Ohne sie ließe sich über die Menge ein
        # beliebig großer Betrag erzeugen (Tippfehler wie 1000 statt 10).
        if menge > _MAX_ADDON_QTY:
            raise AddonError(
                f"Höchstens {_MAX_ADDON_QTY} Einheiten je Zusatzleistung.",
                status_code=422,
            )
        row = self._own_res_addon(tenant_id, res_addon_id)
        status = str(row.get("status"))
        if status == AddonStatus.cancelled.value:
            raise AddonError(
                "Diese Zusatzleistung ist storniert und kann nicht mehr geändert "
                "werden.",
                status_code=409,
            )
        if status == AddonStatus.paid.value:
            raise AddonError(
                "Diese Zusatzleistung ist als bezahlt markiert. Bitte zuerst die "
                "Bezahlt-Markierung zurücknehmen (bei Fehleingabe) oder den "
                "Betrag erstatten.",
                status_code=409,
            )
        self._assert_not_invoiced(tenant_id, str(row["reservation_id"]))

        res_row = self._own_reservation(tenant_id, str(row["reservation_id"]))
        check_in = date.fromisoformat(str(res_row["check_in"]))
        check_out = date.fromisoformat(str(res_row["check_out"]))
        nights = max((check_out - check_in).days, 1)
        tax_rate = (
            float(row["tax_rate"]) if row.get("tax_rate") is not None else None
        )
        _net, gross = addon_total(
            float(row.get("price") or 0),
            str(row.get("basis") or "per_stay"),
            tax_rate,
            nights=nights,
            qty=menge,
        )
        res = (
            self._db.table("reservation_addons")
            .update({"qty": menge, "total": gross})
            .eq("tenant_id", tenant_id)
            .eq("id", res_addon_id)
            # Nur solange offen: zwischen Lesen und Schreiben kann ein anderer
            # Weg die Zeile bezahlt oder storniert haben (Wurzel 2).
            .eq("status", AddonStatus.pending.value)
            .execute()
        )
        if not res.data:
            raise AddonError(
                "Die Zusatzleistung wurde zwischenzeitlich geändert. Bitte die "
                "Seite neu laden.",
                status_code=409,
            )
        log.info(
            "reservation_addon_qty_changed",
            tenant_id=tenant_id,
            id=res_addon_id,
            qty=menge,
        )
        return ReservationAddonResponse(**_res_addon_row(res.data[0]))

    def cancel_reservation_addon(
        self, ctx: AuthContext, res_addon_id: str, reason: str
    ) -> ReservationAddonResponse:
        """Eine versehentlich gebuchte Zusatzleistung stornieren (status=cancelled).

        Fachlich ein Storno, keine Löschung: die Zeile bleibt als Beleg stehen und
        fällt überall dort heraus, wo bereits ``status != 'cancelled'`` gilt
        (Rechnungspositionen, Eigentümer-Abrechnung, Gast-Portal). Der partielle
        Unique-Index (0109) klammert stornierte Zeilen aus, dieselbe Leistung ist
        danach also erneut buchbar.

        Der GRUND ist Pflicht (0397) und landet am Datensatz sowie in der
        Buchungs-Zeitleiste. Vorher protokollierte der Storno nur, DASS storniert
        wurde — bei einem Betrag, der aus Rechnung und Eigentümer-Abrechnung
        verschwindet, ließ sich später nicht mehr unterscheiden, ob die Leistung
        nie erbracht, kulanz-erlassen oder falsch erfasst wurde.

        Auch eine BEZAHLT markierte Position ist stornierbar (der Fall vom
        14.08.2026): Vorher gab es hier nur einen 409 mit dem Verweis auf eine
        Rückabwicklung, für die keine Route existierte — die Zeile war eine
        Sackgasse. Ist wirklich Geld per Karte eingegangen, greift weiterhin die
        Sperre (``_assert_keine_echte_zahlung``); dann ist eine Erstattung der
        richtige Weg, nicht ein Storno, der den Betrag lautlos aus der
        Abrechnung nimmt.

        Bleibende Schranke: Steht die Position auf einer FESTGESCHRIEBENEN
        Rechnung (Nummer gezogen), wäre ein stilles Verschwinden ein GoBD-Bruch →
        409 mit dem Hinweis auf die Storno-Rechnung. Ein Entwurf (ohne Nummer)
        darf sich noch ändern.

        Idempotent (Wurzel 2): ein zweites Storno derselben Zeile ist ein No-op und
        gibt die bereits stornierte Zeile zurück, statt 404/500 zu werfen.
        """
        tenant_id = self._require_tenant(ctx)
        grund = self._pruefe_grund(reason)
        row = self._own_res_addon(tenant_id, res_addon_id)
        status = str(row.get("status"))
        if status == AddonStatus.cancelled.value:
            return ReservationAddonResponse(**_res_addon_row(row))
        if status == AddonStatus.paid.value:
            # Manuell gehakt → stornierbar. Echt per Karte bezahlt → 409.
            self._assert_keine_echte_zahlung(tenant_id, row)
        self._assert_not_invoiced(tenant_id, str(row["reservation_id"]))
        # Wurzel 1 — VOR dem Status-Wechsel: Deckt ein OFFENER Zahlungslink diese
        # Position, muss er geschlossen werden, sonst nimmt seine URL weiter Geld
        # für eine stornierte Leistung an. Scheitert das bei Stripe, bricht das
        # Storno ab (fail-closed) statt die offene URL stehen zu lassen.
        self._schliesse_offenen_zahlungslink(
            tenant_id, str(row["reservation_id"]), res_addon_id
        )

        res = (
            self._db.table("reservation_addons")
            .update(
                {
                    "status": AddonStatus.cancelled.value,
                    "cancel_reason": grund,
                    "cancelled_by": ctx.user_id,
                    "cancelled_at": _now_iso(),
                }
            )
            .eq("tenant_id", tenant_id)
            .eq("id", res_addon_id)
            .neq("status", AddonStatus.cancelled.value)
            .execute()
        )
        if not res.data:
            raise AddonError("Gekaufte Zusatzleistung nicht gefunden.", status_code=404)
        # Wurzel 1 — NACH dem Statuswechsel, damit der Entwurf den neuen Stand
        # sieht: Ein noch nicht nummerierter Rechnungsentwurf trägt die Position
        # samt Betrag; `_finalize_reservation_draft` zieht beim Check-out nur die
        # Nummer und übernimmt die Beträge unverändert. Ohne diesen Neuaufbau
        # stünde die stornierte Position als nummerierte GoBD-Position auf der
        # Rechnung.
        self._baue_rechnungsentwurf_neu(
            tenant_id, str(row["reservation_id"]), storno_steht_schon=True
        )
        self._close_addon_task(tenant_id, row)
        log.info(
            "reservation_addon_cancelled",
            tenant_id=tenant_id,
            id=res_addon_id,
            by=ctx.user_id,
            war_bezahlt=status == AddonStatus.paid.value,
        )
        self._log_timeline(
            tenant_id,
            str(row["reservation_id"]),
            "addon_cancelled",
            ctx,
            {
                "name": row.get("name") or {},
                "total": float(row.get("total") or 0),
                "reason": grund,
                "war_bezahlt": status == AddonStatus.paid.value,
            },
        )
        return ReservationAddonResponse(**_res_addon_row(res.data[0]))

    def _assert_not_invoiced(self, tenant_id: str, reservation_id: str) -> None:
        """409, wenn zur Buchung schon eine festgeschriebene Rechnung existiert.

        Festgeschrieben = Rechnungsnummer gezogen (GoBD). Entwürfe ohne Nummer
        dürfen sich noch ändern — aber NICHT, weil sie beim Check-out neu
        aufgebaut würden: `_finalize_reservation_draft` zieht nur die Nummer und
        übernimmt Positionen und Beträge unverändert (Fund vom 14.08.2026, die
        alte Begründung hier war falsch). Der Aufrufer pflegt den Entwurf daher
        selbst nach (`_baue_rechnungsentwurf_neu`)."""
        try:
            rows = (
                self._db.table("invoices")
                .select("invoice_number")
                .eq("tenant_id", tenant_id)
                .eq("reservation_id", reservation_id)
                .eq("invoice_type", "invoice")
                .neq("status", "cancelled")
                .is_("deleted_at", "null")
                .not_.is_("invoice_number", "null")
                .limit(1)
                .execute()
            ).data or []
        except APIError as exc:
            # Kein stilles Durchwinken: ohne belastbare Auskunft der Rechnungs-
            # tabelle darf nicht storniert werden (fail-closed, Wurzel 5).
            log.warning(
                "addon_cancel_invoice_check_failed",
                reservation_id=reservation_id,
                error=str(exc),
            )
            raise AddonError(
                "Rechnungsstand konnte nicht geprüft werden — Storno abgebrochen.",
                status_code=503,
            ) from exc
        if rows:
            raise AddonError(
                f"Zu dieser Buchung existiert bereits die Rechnung "
                f"{rows[0].get('invoice_number')}. Bitte die Position über eine "
                "Storno-/Korrekturrechnung ausbuchen.",
                status_code=409,
            )

    def _close_addon_task(self, tenant_id: str, row: dict) -> None:
        """Die beim Kauf erzeugte Vorbereitungs-Aufgabe mit stornieren.

        Sonst bleibt „Zusatzleistung vorbereiten: X" offen stehen und die
        Reinigung bereitet etwas vor, das storniert wurde (Wurzel 1: der
        Gegenzustand muss mitgepflegt werden). Best-effort — ein Task-Fehler
        darf das Storno nicht kippen."""
        names = row.get("name") or {}
        label = names.get("de") or next(iter(names.values()), "Zusatzleistung")
        try:
            self._db.table("tasks").update({"status": "cancelled"}).eq(
                "tenant_id", tenant_id
            ).eq("reservation_id", str(row["reservation_id"])).eq(
                "title", f"Zusatzleistung vorbereiten: {label}"
            ).in_("status", ["open", "accepted", "in_progress"]).execute()
        except Exception as exc:  # noqa: BLE001 — Task-Fehler darf Storno nicht killen
            log.warning(
                "addon_cancel_task_cleanup_failed",
                reservation_id=row.get("reservation_id"),
                error=str(exc),
            )


def purchase_addons(
    db: Client,
    *,
    tenant_id: str,
    reservation_id: str,
    property_id: str,
    surface: str,
    selections: list[tuple[str, int]],
    nights: int,
    guests: int,
    check_in_iso: str,
    is_before_checkin: bool,
) -> list[dict]:
    """Gewählte Upsells serverseitig bepreisen + als reservation_addons anlegen.

    Gemeinsame Verkaufslogik für Buchungsstrecke (surface=booking_engine) und
    Gäste-Portal (surface=guest_portal). Beträge kommen IMMER aus dem Katalog
    (kein Vertrauen auf Client-Preise). Es werden nur aktive Add-ons des Objekts
    berücksichtigt, die für ``surface`` freigegeben sind und deren „wann
    anzeigen"-Regel erfüllt ist (before_checkin nur vor Anreise). Löst je Kauf
    den Task-Trigger ``addon_purchased`` aus (best-effort).

    Gibt die angelegten reservation_addons-Zeilen zurück (leer = nichts gekauft).
    """
    if not selections:
        return []
    ids = [aid for aid, _ in selections]
    rows = (
        db.table("property_addons")
        .select("id, name, price, basis, tax_rate, appears_in, available_until")
        .eq("property_id", property_id)
        .eq("active", True)
        .in_("id", ids)
        .execute()
    ).data or []
    catalog = {str(r["id"]): r for r in rows}

    payload: list[dict] = []
    labels: list[str] = []
    for addon_id, qty in selections:
        addon = catalog.get(addon_id)
        if not addon:
            continue
        if surface not in (addon.get("appears_in") or []):
            continue
        # „Wann anzeigen": before_checkin nur, solange noch vor Anreise.
        if addon.get("available_until") == "before_checkin" and not is_before_checkin:
            continue
        tax_rate = (
            float(addon["tax_rate"]) if addon.get("tax_rate") is not None else None
        )
        basis = str(addon.get("basis") or "per_stay")
        # Wie beim manuellen Hinzufügen: keine Menge angegeben → Vorbelegung der
        # Basis (per_guest = Gästezahl). Der Gast wählt in der Buchungsstrecke
        # eine Stückzahl; sie gilt jetzt als Personenzahl, nicht als Faktor.
        menge = int(qty) if int(qty) > 0 else vorbelegte_menge(basis, guests=guests)
        _net, gross = addon_total(
            float(addon.get("price") or 0),
            basis,
            tax_rate,
            nights=nights,
            qty=menge,
        )
        names = addon.get("name") or {}
        labels.append(names.get("de") or next(iter(names.values()), "Zusatzleistung"))
        payload.append(
            {
                "tenant_id": tenant_id,
                "reservation_id": reservation_id,
                "addon_id": addon_id,
                "name": names,
                "price": float(addon.get("price") or 0),
                "basis": basis,
                "tax_rate": tax_rate,
                "qty": menge,
                "total": gross,
                "status": AddonStatus.pending.value,
            }
        )
    if not payload:
        return []
    # Idempotenz gegen Doppelklick/Retry: der partielle Unique-Index
    # reservation_addons_active_uidx (0109) verhindert eine zweite aktive Zeile
    # je (reservation_id, addon_id). Kollidiert der Insert, war der Kauf bereits
    # gebucht — dann die BESTEHENDE Zeile zurückgeben statt doppelt zu berechnen.
    #
    # WICHTIG: pro Addon EINZELN inserten, nicht als ein atomarer Batch. Kollidiert
    # in einem Batch nur EIN Addon, würde der gesamte Insert fehlschlagen und die
    # genuin NEUEN Addons desselben Batches gingen verloren (geräuschlos nie
    # berechnet). Einzel-Inserts halten jedes neue Addon, egal welches im Batch
    # bereits existiert.
    created: list[dict] = []
    for item in payload:
        try:
            rows_ins = (
                db.table("reservation_addons").insert(item).execute()
            ).data or []
        except APIError as exc:
            if "reservation_addons_active_uidx" not in str(exc):
                raise
            log.info(
                "addon_purchase_idempotent_skip",
                reservation_id=reservation_id,
                addon_id=item["addon_id"],
            )
            rows_ins = (
                db.table("reservation_addons")
                .select("*")
                .eq("reservation_id", reservation_id)
                .eq("addon_id", item["addon_id"])
                .neq("status", "cancelled")
                .execute()
            ).data or []
        created.extend(rows_ins)

    # Trigger „addon_purchased": je Item eine Vorbereitungs-Aufgabe (best-effort,
    # lazy import → kein Slice-Importzyklus).
    try:
        from src.features.tasks.service import TasksService  # noqa: PLC0415

        tasks = TasksService(client=db)
        for label in labels:
            tasks.generate_for_addon(
                tenant_id, property_id, reservation_id, label, check_in_iso
            )
    except Exception as exc:  # noqa: BLE001 — Task-Fehler darf Kauf nicht killen
        log.warning("addon_tasks_failed", reservation_id=reservation_id, error=str(exc))

    log.info(
        "addons_purchased",
        tenant_id=tenant_id,
        reservation_id=reservation_id,
        count=len(created),
    )
    return created


def _addon_row(r: dict) -> dict:
    """DB-Zeile → Katalog-Response (None-/Typ-Glättung)."""
    return {
        "id": str(r["id"]),
        "property_id": str(r["property_id"]),
        "name": r.get("name") or {},
        "description": r.get("description") or {},
        "media": list(r.get("media") or []),
        "price": float(r.get("price") or 0),
        "basis": r.get("basis") or "per_stay",
        "mandatory": bool(r.get("mandatory")),
        "appears_in": list(r.get("appears_in") or []),
        "available_until": r.get("available_until") or "anytime",
        "tax_rate": (float(r["tax_rate"]) if r.get("tax_rate") is not None else None),
        "active": bool(r.get("active")),
        "sort_order": int(r.get("sort_order") or 0),
    }


def _res_addon_row(r: dict) -> dict:
    """DB-Zeile → gekauftes-Add-on-Response."""
    return {
        "id": str(r["id"]),
        "reservation_id": str(r["reservation_id"]),
        "addon_id": (str(r["addon_id"]) if r.get("addon_id") else None),
        "name": r.get("name") or {},
        "price": float(r.get("price") or 0),
        "basis": r.get("basis") or "per_stay",
        "tax_rate": (float(r["tax_rate"]) if r.get("tax_rate") is not None else None),
        "qty": int(r.get("qty") or 1),
        "total": float(r.get("total") or 0),
        "status": r.get("status") or "pending",
        "charged_at": r.get("charged_at"),
        "created_at": r.get("created_at"),
        "cancel_reason": r.get("cancel_reason"),
        "cancelled_by": (str(r["cancelled_by"]) if r.get("cancelled_by") else None),
        "cancelled_at": r.get("cancelled_at"),
    }


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


# Re-Export, damit Verkaufs-Pfade (booking_engine/public_portal) eine Wahrheit
# für die Betragsberechnung + den Kauf nutzen.
__all__ = ["AddonError", "AddonsService", "addon_total", "purchase_addons"]
