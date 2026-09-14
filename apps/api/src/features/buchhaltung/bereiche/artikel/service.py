"""Fachlogik des Bereichs »artikel«: Artikelstamm der Buchhaltung.

Was vom alten Werkzeug blieb, ist die FORM (Nummer, Bezeichnung, Einheit,
Preis, Steuersatz, Kategorie, Favoriten-Stern). Die REGELN stehen hier:

  * Die Artikelnummer zieht `next_document_number(tenant, 'item', 'ART-')`
    beim Anlegen; eine mitgegebene Nummer wird auf Eindeutigkeit geprüft, der
    Unique-Index (0668) fängt den Rest (23505 → 409, Wurzel 2).
  * Währung: Artikel → `tenants.currency` → 422. Nie „EUR" (Wurzel 4).
  * Steuersatz ist Pflicht im Schema — der Service ergänzt keinen.
  * Favorit ist ein Zielzustand (idempotent), Verwendung zählt die DB atomar
    (`billing_item_mark_used`, 0669).
  * Löschen nur, wenn der Artikel nie übernommen wurde (`usage_count = 0`);
    sonst 409 mit dem Hinweis, ihn zu deaktivieren — ein Beleg verweist per
    Text auf den Artikel, die Nummer soll auffindbar bleiben.

Jede per-ID-Ladung läuft über `load_scoped` (Wurzel 3); Listen filtern immer
auf `tenant_id`.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .schemas import (
    LIMIT_MAX,
    LIMIT_VORGABE,
    NUMMERNKREIS_DOC_TYPE,
    NUMMERNKREIS_PREFIX,
    BillingItemCreate,
    BillingItemResponse,
    BillingItemUpdate,
    CategoryResponse,
    UsedResponse,
)

log = get_logger("nextdays.buchhaltung.artikel")

TABELLE = "billing_items"
_ZWEI_STELLEN = Decimal("0.01")
_PG_UNIQUE_VIOLATION = "23505"


class ArtikelError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nicht_gefunden() -> ArtikelError:
    return ArtikelError("Artikel nicht gefunden.", status_code=404)


def _q(betrag: Decimal) -> Decimal:
    return betrag.quantize(_ZWEI_STELLEN, rounding=ROUND_HALF_UP)


def _dec(wert: object) -> Decimal:
    if wert is None or wert == "":
        return Decimal("0")
    return Decimal(str(wert))


def _like_muster(wert: str) -> str:
    """Nutzereingabe zu einem sicheren `ilike`-Muster für den `or_`-Filter.

    `%`/`_` sind LIKE-Platzhalter, `\\` das Fluchtzeichen — maskiert, sonst
    trifft „100%" jeden Artikel. In Anführungszeichen, weil Komma, Punkt und
    Klammern in PostgRESTs `or=(…)` die Filter-Syntax selbst sind.
    """
    maskiert = wert.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    in_anfuehrung = f"%{maskiert}%".replace('"', '\\"')
    return f'"{in_anfuehrung}"'


class ArtikelService:
    """Alle Operationen sind auf `ctx.tenant_id` gescopet."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ArtikelError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    def _tenant_waehrung(self, tenant_id: str) -> str:
        """Mandanten-Währung aus den Daten. Fehlt sie, ist das ein Datenfehler →
        422 statt eines erfundenen EUR im Artikelstamm (Wurzel 4)."""
        rows = (
            self._db.table("tenants").select("currency").eq("id", tenant_id).limit(1).execute()
        ).data or []
        currency = rows[0].get("currency") if rows else None
        if not currency:
            log.warning("artikel_tenant_ohne_waehrung", tenant_id=tenant_id)
            raise ArtikelError(
                "Keine Währung angegeben und im Konto keine Mandanten-Währung "
                "hinterlegt — bitte Währung setzen.",
                status_code=422,
            )
        return str(currency).upper()

    def _eigener(self, tenant_id: str, item_id: str) -> dict:
        return load_scoped(self._db, TABELLE, item_id, tenant_id, not_found=_nicht_gefunden())

    @staticmethod
    def _antwort(row: dict) -> BillingItemResponse:
        return BillingItemResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            item_number=str(row["item_number"]),
            name=str(row["name"]),
            description=row.get("description"),
            unit=str(row["unit"]),
            basis=str(row.get("basis") or "per_unit"),
            unit_price=_dec(row.get("unit_price")),
            tax_rate=_dec(row.get("tax_rate")),
            currency=str(row["currency"]),
            category=row.get("category"),
            is_active=bool(row.get("is_active", True)),
            is_favorite=bool(row.get("is_favorite", False)),
            usage_count=int(row.get("usage_count") or 0),
            last_used_at=row.get("last_used_at"),
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # ------------------------------------------------------------ Listen
    def list_items(
        self,
        ctx: AuthContext,
        *,
        search: str | None = None,
        category: str | None = None,
        only_active: bool = False,
        favorites_only: bool = False,
        limit: int = LIMIT_VORGABE,
    ) -> list[BillingItemResponse]:
        tenant_id = self._tenant(ctx)
        if limit < 1 or limit > LIMIT_MAX:
            raise ArtikelError(f"limit muss zwischen 1 und {LIMIT_MAX} liegen.", status_code=422)
        query = self._db.table(TABELLE).select("*").eq("tenant_id", tenant_id)
        if only_active:
            query = query.eq("is_active", True)
        if favorites_only:
            query = query.eq("is_favorite", True)
        if category:
            query = query.eq("category", category.strip())
        if search and search.strip():
            muster = _like_muster(search.strip())
            query = query.or_(
                f"name.ilike.{muster},item_number.ilike.{muster},"
                f"description.ilike.{muster},category.ilike.{muster}"
            )
        rows = (
            query.order("is_favorite", desc=True).order("name").limit(limit).execute()
        ).data or []
        return [self._antwort(r) for r in rows]

    def list_favorites(
        self, ctx: AuthContext, *, limit: int = LIMIT_VORGABE
    ) -> list[BillingItemResponse]:
        """Favoriten — nur AKTIVE, denn sie dienen der Übernahme in Positionen."""
        return self.list_items(ctx, only_active=True, favorites_only=True, limit=limit)

    def list_categories(self, ctx: AuthContext) -> list[CategoryResponse]:
        tenant_id = self._tenant(ctx)
        rows = (
            self._db.table(TABELLE)
            .select("category")
            .eq("tenant_id", tenant_id)
            .not_.is_("category", "null")
            .limit(5000)
            .execute()
        ).data or []
        zaehler: dict[str, int] = {}
        for r in rows:
            name = str(r.get("category") or "").strip()
            if name:
                zaehler[name] = zaehler.get(name, 0) + 1
        return [
            CategoryResponse(name=name, item_count=anzahl)
            for name, anzahl in sorted(zaehler.items(), key=lambda kv: kv[0].casefold())
        ]

    def get_item(self, ctx: AuthContext, item_id: str) -> BillingItemResponse:
        return self._antwort(self._eigener(self._tenant(ctx), item_id))

    # ----------------------------------------------------------- Anlegen
    def _nummer_ziehen(self, tenant_id: str) -> str:
        res = self._db.rpc(
            "next_document_number",
            {
                "p_tenant_id": tenant_id,
                "p_doc_type": NUMMERNKREIS_DOC_TYPE,
                "p_prefix": NUMMERNKREIS_PREFIX,
            },
        ).execute()
        row = (res.data or [{}])[0]
        nummer = row.get("formatted_number")
        if not nummer:
            raise ArtikelError("Artikelnummer konnte nicht vergeben werden.", status_code=500)
        return str(nummer)

    def _nummer_frei(self, tenant_id: str, nummer: str) -> None:
        rows = (
            self._db.table(TABELLE)
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("item_number", nummer)
            .limit(1)
            .execute()
        ).data or []
        if rows:
            raise ArtikelError(f"Artikelnummer {nummer} ist bereits vergeben.", status_code=409)

    def create_item(self, ctx: AuthContext, body: BillingItemCreate) -> BillingItemResponse:
        tenant_id = self._tenant(ctx)
        waehrung = body.currency or self._tenant_waehrung(tenant_id)
        if body.item_number:
            nummer = body.item_number
            self._nummer_frei(tenant_id, nummer)
        else:
            nummer = self._nummer_ziehen(tenant_id)
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "item_number": nummer,
            "name": body.name,
            "description": body.description,
            "unit": body.unit,
            "basis": body.basis,
            "unit_price": str(_q(body.unit_price)),
            "tax_rate": str(_q(body.tax_rate)),
            "currency": waehrung,
            "category": body.category,
            "is_active": body.is_active,
            "is_favorite": body.is_favorite,
            "usage_count": 0,
            "created_by": ctx.user_id,
        }
        try:
            res = self._db.table(TABELLE).insert(zeile).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == _PG_UNIQUE_VIOLATION:
                log.info("artikel_nummer_doppelt", tenant_id=tenant_id, item_number=nummer)
                raise ArtikelError(
                    f"Artikelnummer {nummer} ist bereits vergeben.", status_code=409
                ) from exc
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise ArtikelError("Artikel konnte nicht gespeichert werden.", status_code=500)
        log.info(
            "artikel_angelegt",
            tenant_id=tenant_id,
            item_id=neu["id"],
            item_number=nummer,
            currency=waehrung,
            tax_rate=zeile["tax_rate"],
        )
        return self._antwort(neu)

    # ------------------------------------------------------------ Ändern
    def update_item(
        self, ctx: AuthContext, item_id: str, body: BillingItemUpdate
    ) -> BillingItemResponse:
        tenant_id = self._tenant(ctx)
        self._eigener(tenant_id, item_id)
        gesetzt = body.model_dump(exclude_unset=True, by_alias=False)
        aenderung: dict[str, Any] = {}
        for feld in ("name", "unit", "category", "is_active", "is_favorite", "currency"):
            if feld in gesetzt:
                aenderung[feld] = gesetzt[feld]
        if "description" in gesetzt:
            aenderung["description"] = gesetzt["description"]
        if gesetzt.get("unit_price") is not None:
            aenderung["unit_price"] = str(_q(gesetzt["unit_price"]))
        if gesetzt.get("basis") is not None:
            aenderung["basis"] = gesetzt["basis"]
        if gesetzt.get("tax_rate") is not None:
            aenderung["tax_rate"] = str(_q(gesetzt["tax_rate"]))
        # Pflichtfelder dürfen per PATCH nicht auf null gesetzt werden.
        for pflicht in ("name", "unit", "currency"):
            if pflicht in aenderung and aenderung[pflicht] is None:
                raise ArtikelError(f"{pflicht} darf nicht leer sein.", status_code=422)
        if not aenderung:
            return self.get_item(ctx, item_id)
        self._db.table(TABELLE).update(aenderung).eq("id", item_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "artikel_geaendert", tenant_id=tenant_id, item_id=item_id, felder=sorted(aenderung)
        )
        return self.get_item(ctx, item_id)

    def set_favorite(
        self, ctx: AuthContext, item_id: str, is_favorite: bool
    ) -> BillingItemResponse:
        tenant_id = self._tenant(ctx)
        row = self._eigener(tenant_id, item_id)
        if bool(row.get("is_favorite")) == is_favorite:
            return self._antwort(row)  # idempotent (Wurzel 2)
        self._db.table(TABELLE).update({"is_favorite": is_favorite}).eq("id", item_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("artikel_favorit", tenant_id=tenant_id, item_id=item_id, is_favorite=is_favorite)
        return self.get_item(ctx, item_id)

    def mark_used(self, ctx: AuthContext, item_id: str) -> UsedResponse:
        """Verwendung zählen — atomar in der DB (0669). Ein Retry zählt bewusst
        noch einmal: der Zähler ist eine Nutzungsstatistik, keine Buchung, und
        ein fehlender Beleg-Bezug macht echte Idempotenz hier unmöglich."""
        tenant_id = self._tenant(ctx)
        res = self._db.rpc(
            "billing_item_mark_used", {"p_tenant_id": tenant_id, "p_item_id": item_id}
        ).execute()
        row = (res.data or [None])[0]
        if not row:
            raise _nicht_gefunden()
        log.info(
            "artikel_verwendet", tenant_id=tenant_id, item_id=item_id,
            usage_count=row.get("usage_count"),
        )
        return UsedResponse(
            id=str(row["id"]),
            usage_count=int(row.get("usage_count") or 0),
            last_used_at=row.get("last_used_at"),
        )

    def delete_item(self, ctx: AuthContext, item_id: str) -> None:
        tenant_id = self._tenant(ctx)
        row = self._eigener(tenant_id, item_id)
        if int(row.get("usage_count") or 0) > 0:
            raise ArtikelError(
                "Der Artikel wurde bereits in Positionen übernommen und kann nicht "
                "gelöscht werden — bitte deaktivieren.",
                status_code=409,
            )
        self._db.table(TABELLE).delete().eq("id", item_id).eq("tenant_id", tenant_id).execute()
        log.info(
            "artikel_geloescht", tenant_id=tenant_id, item_id=item_id,
            item_number=row.get("item_number"),
        )
