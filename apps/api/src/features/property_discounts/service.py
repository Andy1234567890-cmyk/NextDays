"""Service für Aktionen/Rabatte (property_discounts, 0185 + 0276).

CRUD über die Service-Role mit explizitem Tenant-Scope (Wurzel 3: Service-Role
umgeht RLS). Owner ist read-only (§4.2), staff/cleaner sehen Vertriebsdaten gar
nicht — das Gating passiert im Router über die Permissions.

Seit 0276 trägt eine Zeile BELIEBIG VIELE Bedingungen (Aufenthaltsdaten,
Buchungsfenster, Vorlauf, Mindestnächte, Angebotscodes, Kanäle) statt genau einer
je Typ. Die Eingabe-Altform `days_before` wird in den Schemas auf
`lead_min_days`/`lead_max_days` gehoben und in der Antwort daraus abgeleitet —
gespeichert wird nur die allgemeine Achse.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped
from src.features.properties.gebuehren import clean_description
from src.jobs.queue import try_enqueue_airbnb_aktionen, try_enqueue_recompute

from .schemas import DiscountCreate, DiscountResponse, DiscountUpdate, StayRange

_COLUMNS = (
    "id, property_id, discount_type, discount_kind, discount_bps, "
    "discount_amount, active, min_nights, lead_min_days, lead_max_days, "
    "stay_ranges, booked_from, booked_to, promo_codes, portal_scope, name, "
    "description_html, photo_url, created_at, updated_at"
)


# Die Felder, die eine Aktion fachlich AUSMACHEN — ohne Kennung, Objekt und
# Zeitstempel. Grundlage für „liegt das schon da?" (Idempotenz beim Übertragen)
# UND für die Auswahlliste (dieselbe Aktion auf zehn Objekten erscheint EINMAL).
_WIRKENDE_FELDER = (
    "discount_type", "discount_kind", "discount_bps", "discount_amount",
    "min_nights", "lead_min_days", "lead_max_days", "stay_ranges",
    "booked_from", "booked_to", "promo_codes", "portal_scope", "name",
)


def _aktion_signatur(regel: dict[str, Any]) -> str:
    """Stabiler Vergleichsschlüssel über die wirkenden Felder."""
    return "|".join(repr(regel.get(f)) for f in _WIRKENDE_FELDER)


class DiscountError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PropertyDiscountsService:
    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise DiscountError("Kein DB-Client verfügbar.", status_code=500)
        return self._client

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise DiscountError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _assert_own_property(self, tenant_id: str, property_id: str) -> None:
        rows = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise DiscountError(
                "Objekt gehört nicht zu diesem Konto.", status_code=404
            )

    @staticmethod
    def _row(r: dict) -> DiscountResponse:
        typ = str(r["discount_type"])
        # `days_before` ist eine ABLEITUNG für Bestandsclients: beim Frühbucher die
        # Untergrenze, bei Last Minute die Obergrenze. Für alles andere gibt es sie
        # nicht — dann bleibt sie leer, statt eine der beiden Grenzen zu erfinden.
        days_before = None
        if typ == "early_booker":
            days_before = r.get("lead_min_days")
        elif typ == "last_minute":
            days_before = r.get("lead_max_days")
        return DiscountResponse(
            id=r["id"],
            property_id=r["property_id"],
            discount_type=typ,
            discount_kind=str(r.get("discount_kind") or "percent"),
            discount_bps=int(r["discount_bps"]),
            discount_amount=(
                float(r["discount_amount"])
                if r.get("discount_amount") is not None
                else None
            ),
            active=bool(r["active"]),
            min_nights=r.get("min_nights"),
            lead_min_days=r.get("lead_min_days"),
            lead_max_days=r.get("lead_max_days"),
            stay_ranges=[
                StayRange(**z)
                for z in (r.get("stay_ranges") or [])
                if isinstance(z, dict) and z.get("from") and z.get("to")
            ],
            booked_from=r.get("booked_from"),
            booked_to=r.get("booked_to"),
            promo_codes=list(r.get("promo_codes") or []),
            portal_scope=list(r.get("portal_scope") or []),
            name=r.get("name") or {},
            description_html=r.get("description_html"),
            photo_url=r.get("photo_url"),
            days_before=days_before,
            created_at=str(r["created_at"]) if r.get("created_at") else None,
            updated_at=str(r["updated_at"]) if r.get("updated_at") else None,
        )

    @staticmethod
    def _stay_ranges_json(ranges: list[StayRange]) -> list[dict[str, str]]:
        """Aufenthaltszeiträume für die jsonb-Spalte — reine Datumsstrings, damit
        die Zeile so aussieht, wie der Kommentar an der Spalte es zusagt."""
        return [{"from": z.from_.isoformat(), "to": z.to.isoformat()} for z in ranges]

    def health(self) -> dict[str, str]:
        return {"slice": "property_discounts", "status": "ok"}

    def list_for_property(
        self, ctx: AuthContext, property_id: str
    ) -> list[DiscountResponse]:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        rows = (
            self._db()
            .table("property_discounts")
            .select(_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        ).data or []
        return [self._row(r) for r in rows]

    def create(
        self, ctx: AuthContext, property_id: str, req: DiscountCreate
    ) -> DiscountResponse:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        try:
            ins = (
                self._db()
                .table("property_discounts")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "discount_type": req.discount_type,
                        "discount_kind": req.discount_kind,
                        "discount_bps": req.discount_bps,
                        "discount_amount": req.discount_amount,
                        "active": req.active,
                        "min_nights": req.min_nights,
                        "lead_min_days": req.lead_min_days,
                        "lead_max_days": req.lead_max_days,
                        "stay_ranges": self._stay_ranges_json(req.stay_ranges),
                        "booked_from": (
                            req.booked_from.isoformat() if req.booked_from else None
                        ),
                        "booked_to": (
                            req.booked_to.isoformat() if req.booked_to else None
                        ),
                        "promo_codes": req.promo_codes,
                        "portal_scope": req.portal_scope,
                        "name": req.name,
                        "description_html": clean_description(req.description_html),
                        "photo_url": req.photo_url,
                    }
                )
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001 — Singleton-UNIQUE fängt Duplikat
            # 23505 = der partielle UNIQUE-Index (eine aktive Regel je Nicht-custom-
            # Typ). Doppelklick/Retry landet hier → 409 statt 500 (Wurzel 2).
            if "23505" in str(exc) or "duplicate" in str(exc).lower():
                raise DiscountError(
                    "Für diesen Rabatt-Typ existiert bereits eine aktive Regel.",
                    status_code=409,
                ) from exc
            raise
        if not ins:
            raise DiscountError("Rabatt konnte nicht angelegt werden.", status_code=500)
        self._an_die_portale(tenant_id, property_id)
        return self._row(ins[0])

    def update(
        self,
        ctx: AuthContext,
        property_id: str,
        discount_id: str,
        req: DiscountUpdate,
    ) -> DiscountResponse:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        # tenant-scoped laden (Wurzel 3/9: gleicher Scope wie die Liste) + prüfen,
        # dass die Regel zu genau diesem Objekt gehört.
        current = load_scoped(
            self._db(),
            "property_discounts",
            discount_id,
            tenant_id,
            columns=_COLUMNS,
            not_found=DiscountError("Rabatt nicht gefunden.", status_code=404),
        )
        if current["property_id"] != property_id:
            raise DiscountError("Rabatt nicht gefunden.", status_code=404)
        # Nur GESENDETE Felder setzen — `model_fields_set` statt „is not None",
        # sonst ließe sich eine Bedingung nie wieder LEEREN (eine gesendete null
        # käme nicht an) und eine Aktion bliebe für immer eingeschränkt.
        gesetzt = req.model_fields_set
        patch: dict[str, Any] = {}
        for feld in (
            "discount_kind", "discount_bps", "discount_amount", "active",
            "min_nights", "lead_min_days", "lead_max_days", "promo_codes",
            "portal_scope", "name", "photo_url",
        ):
            if feld in gesetzt:
                patch[feld] = getattr(req, feld)
        if "stay_ranges" in gesetzt:
            patch["stay_ranges"] = self._stay_ranges_json(req.stay_ranges or [])
        for feld in ("booked_from", "booked_to"):
            if feld in gesetzt:
                wert = getattr(req, feld)
                patch[feld] = wert.isoformat() if wert else None
        if "description_html" in gesetzt:
            patch["description_html"] = clean_description(req.description_html)
        if not patch:
            return self._row(current)
        try:
            upd = (
                self._db()
                .table("property_discounts")
                .update(patch)
                .eq("id", discount_id)
                .eq("tenant_id", tenant_id)
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001 — Aktivierung kann Singleton verletzen
            if "23505" in str(exc) or "duplicate" in str(exc).lower():
                raise DiscountError(
                    "Für diesen Rabatt-Typ existiert bereits eine aktive Regel.",
                    status_code=409,
                ) from exc
            raise
        if not upd:
            raise DiscountError("Rabatt konnte nicht geändert werden.", status_code=500)
        self._an_die_portale(tenant_id, property_id)
        return self._row(upd[0])

    def delete(
        self, ctx: AuthContext, property_id: str, discount_id: str
    ) -> None:
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        current = load_scoped(
            self._db(),
            "property_discounts",
            discount_id,
            tenant_id,
            columns="id, property_id",
            not_found=DiscountError("Rabatt nicht gefunden.", status_code=404),
        )
        if current["property_id"] != property_id:
            raise DiscountError("Rabatt nicht gefunden.", status_code=404)
        self._db().table("property_discounts").delete().eq(
            "id", discount_id
        ).eq("tenant_id", tenant_id).execute()
        # Gegenzustand (Wurzel 1): die gelöschte Aktion muss ihren Rabatt bei den
        # Portalen auch wieder VERLIEREN — der Tagespreis muss zurück auf den
        # ungerabatteten Stand, die Airbnb-Regel muss verschwinden.
        self._an_die_portale(tenant_id, property_id)

    def apply_to_properties(
        self, ctx: AuthContext, property_id: str, discount_id: str,
        targets: list[str],
    ) -> dict[str, Any]:
        """Eine Aktion auf weitere eigene Objekte übertragen.

        Gegenstück zu `apply_fee_to_properties`/`apply_tax_to_properties`: der
        Branchenstandard führt den Block „Zu anderen Unterkünften hinzufügen" in
        JEDEM dieser drei Editoren.

        Jede Ziel-ID wird EINZELN tenant-gescopt geprüft (Wurzel 3) — eine fremde
        ID ist ein Fehler, kein stilles Überspringen. Die Kopie bekommt eine EIGENE
        Kennung: eine Aktion gehört zu genau einem Objekt, und dieselbe Kennung
        zweimal zu vergeben hieße, dass Ändern am einen Objekt das andere trifft.

        IDEMPOTENT (Wurzel 2): am Ziel wird eine fachlich gleiche Aktion (gleiche
        Art, gleicher Betrag, gleiche Bedingungen) NICHT ein zweites Mal angelegt —
        sonst rabattierte ein Doppelklick nicht doppelt (bester Einzelrabatt), aber
        die Liste des Betriebs wäre voller Dubletten.
        """
        tenant_id = self._require_tenant(ctx)
        self._assert_own_property(tenant_id, property_id)
        quelle = load_scoped(
            self._db(),
            "property_discounts",
            discount_id,
            tenant_id,
            columns=_COLUMNS,
            not_found=DiscountError("Aktion nicht gefunden.", status_code=404),
        )
        if quelle["property_id"] != property_id:
            raise DiscountError("Aktion nicht gefunden.", status_code=404)

        vorlage = {
            k: quelle.get(k)
            for k in (
                "discount_type", "discount_kind", "discount_bps", "discount_amount",
                "active", "min_nights", "lead_min_days", "lead_max_days",
                "stay_ranges", "booked_from", "booked_to", "promo_codes",
                "portal_scope", "name", "description_html", "photo_url",
            )
        }
        angewendet: list[str] = []
        for ziel_id in dict.fromkeys(targets):
            if ziel_id == property_id:
                continue
            self._assert_own_property(tenant_id, ziel_id)
            if self._gleiche_aktion_vorhanden(tenant_id, ziel_id, vorlage):
                angewendet.append(ziel_id)
                continue
            try:
                self._db().table("property_discounts").insert(
                    {"tenant_id": tenant_id, "property_id": ziel_id, **vorlage}
                ).execute()
            except Exception as exc:  # noqa: BLE001 — Singleton-UNIQUE der Kurven
                # Die drei Kurven-Typen (LOS/Frühbucher/Last Minute) dürfen je
                # Objekt nur EINMAL aktiv sein. Am Ziel gibt es schon eine → das
                # ist eine Aussage, kein Serverfehler: sie würde überschrieben,
                # und das entscheidet der Betrieb, nicht wir (Wurzel 5).
                if "23505" in str(exc) or "duplicate" in str(exc).lower():
                    raise DiscountError(
                        "Ein Objekt hat für diese Art schon eine aktive Aktion — "
                        "dort zuerst entfernen.",
                        status_code=409,
                    ) from exc
                raise
            angewendet.append(ziel_id)
            self._an_die_portale(tenant_id, ziel_id)
        return {"applied_to": angewendet}

    def _an_die_portale(self, tenant_id: str, property_id: str) -> None:
        """Eine geänderte Aktion auf BEIDEN Wegen zu den Portalen nachziehen.

        1. `recompute_property` — rechnet die Tagespreise neu und pusht sie; das
           ist der Träger für Zeitraum-Aktionen und gilt für alle Portale
           (channel_manager/ota_aktionen.py).
        2. `sync_airbnb_aktionen` — schreibt Mindestaufenthalt/Frühbucher/Last
           Minute in Airbnbs eigene Rabattregeln (channel_manager/airbnb_aktionen.py).

        Beides als Job (nicht im Request-Pfad) und beides coalesced: die Jobs
        übertragen den VOLLEN Stand des Objekts, „letzter gewinnt" verliert
        nichts. Ein Fehler beim Einreihen kippt das Speichern nicht — die
        Wrapper fangen selbst und protokollieren.
        """
        db = self._db()
        try_enqueue_recompute(db, tenant_id, property_id)
        try_enqueue_airbnb_aktionen(db, tenant_id, property_id)

    def library(self, ctx: AuthContext, property_id: str) -> dict[str, Any]:
        """Bestehende Promotions des Betriebs zur Übernahme auf DIESES Objekt.

        Der Branchenstandard zeigt beim „+ Hinzufügen" zuerst eine Auswahl:
        „Neue Werbeaktion erstellen" ODER eine bereits bestehende auf diese
        Vermietung anwenden (live abgelesen 03.08.2026). Genauso läuft es bei den
        Gebühren (`properties.fee_library`) — dieselbe Mechanik, damit der Betrieb
        nicht dieselbe Sommeraktion zwanzigmal tippt.

        Zwei Filter, beide fachlich nötig:

        * Eine PAUSCHALE ist ohne ihre Währung keine übernehmbare Zahl. Sie kommt
          nur aus Objekten DERSELBEN Objektwährung — „200" von einem DKK- auf ein
          EUR-Objekt zu kopieren wäre eine stille Preisänderung um den Faktor 7,5
          (Wurzel 4). Prozent-Promotions sind währungsfrei.
        * Was auf DIESEM Objekt fachlich schon liegt, fehlt bewusst: es
          „hinzuzufügen" wäre eine Dublette.
        """
        tenant_id = self._require_tenant(ctx)
        ziel = load_scoped(
            self._db(),
            "properties",
            property_id,
            tenant_id,
            columns="id, currency",
            not_found=DiscountError("Objekt nicht gefunden.", status_code=404),
        )
        ziel_currency = str(ziel.get("currency") or "").upper() or None

        objekte = (
            self._db()
            .table("properties")
            .select("id, title, currency")
            .eq("tenant_id", tenant_id)
            .order("title")
            .execute()
        ).data or []
        titel = {str(o["id"]): o.get("title") for o in objekte}
        waehrung = {
            str(o["id"]): (str(o.get("currency") or "").upper() or None)
            for o in objekte
        }

        rows = (
            self._db()
            .table("property_discounts")
            .select(_COLUMNS)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        eigene = {
            _aktion_signatur(r) for r in rows if r.get("property_id") == property_id
        }
        items: list[dict[str, Any]] = []
        gesehen: set[str] = set()
        for r in rows:
            quelle = str(r.get("property_id") or "")
            if quelle == property_id:
                continue
            if (
                str(r.get("discount_kind") or "percent") == "fixed"
                and waehrung.get(quelle) != ziel_currency
            ):
                continue
            signatur = _aktion_signatur(r)
            if signatur in eigene or signatur in gesehen:
                continue
            gesehen.add(signatur)
            items.append(
                {
                    "promotion": self._row(r),
                    "property_id": quelle,
                    "property_title": titel.get(quelle),
                }
            )
        return {"currency": ziel_currency, "items": items}

    def _gleiche_aktion_vorhanden(
        self, tenant_id: str, ziel_id: str, vorlage: dict[str, Any]
    ) -> bool:
        """Liegt am Ziel schon eine fachlich identische Aktion?

        Verglichen wird über die WIRKENDEN Felder, nicht über die Kennung: dieselbe
        Aktion hat auf jedem Objekt eine eigene `id`, sonst wäre der Vergleich
        immer negativ und jede Übertragung legte eine Dublette an.
        """
        rows = (
            self._db()
            .table("property_discounts")
            .select(_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("property_id", ziel_id)
            .execute()
        ).data or []
        for r in rows:
            if all(r.get(f) == vorlage.get(f) for f in _WIRKENDE_FELDER):
                return True
        return False
