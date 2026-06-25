"""Service-Schicht für owner_statements (Owner-Statements + Auszahlungsformel).

Auszahlungsformel (mirror Hostaway), serverseitig in Decimal (kaufmännisch
gerundet, 2 Nachkommastellen):

    Total Price   = Σ reservations.total_amount  (Owner-Objekte, Zeitraum, Filter)
    Total Payout  = Σ (total_amount − channel_fee)
    Owner Expenses= Σ owner_expenses, die dem Owner zugeordnet sind (amount)
    Owner Payout  = (Total Payout − Owner Expenses) × (1 − commission_pct/100)
    PM Payout     = Total Payout − Owner Payout
    Grand total   = Rental Revenue (Total Price) − Expenses; „Deduct percentage"
                    = commission_pct.

CRUD/Erzeugung über Service-Role mit explizitem tenant-Scope (tenant_id aus dem
verifizierten JWT). Beträge nie als float gerechnet — float nur an der API-Grenze.
"""
from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .currencies import currency_for_country
from .fx import FxError, FxService
from .schemas import (
    AutoStatementRunResponse,
    CurrencyAmount,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    ListingRow,
    RentalRow,
    SliceHealth,
    StatementGenerateRequest,
    StatementHeader,
    StatementListItem,
    StatementListResponse,
    StatementResponse,
    StatementSummary,
    StatementUpdate,
    TaxBreakdown,
)
from .tax import compute_tax

log = get_logger("nextdays.owner_statements")

_CENT = Decimal("0.01")


def _d(value: object) -> Decimal:
    """In Decimal wandeln (über str, um Float-Artefakte zu vermeiden)."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _money(value: Decimal) -> float:
    """Kaufmännisch auf 2 Nachkommastellen runden, als float für die API."""
    return float(value.quantize(_CENT, rounding=ROUND_HALF_UP))


class StatementError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class OwnerStatementsService:
    slice_name = "owner_statements"

    def __init__(self, service_client: Client) -> None:
        self._db = service_client
        self._fx = FxService(service_client)

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise StatementError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    # --- Owner + Objekte ----------------------------------------------------

    def _owner(self, tenant_id: str, owner_id: str) -> dict:
        rows = (
            self._db.table("owners")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", owner_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise StatementError("Eigentümer nicht gefunden.", status_code=404)
        return rows[0]

    def _owner_property_ids(self, owner_id: str) -> list[str]:
        rows = (
            self._db.table("owner_properties")
            .select("property_id")
            .eq("owner_id", owner_id)
            .execute()
        ).data or []
        return [str(r["property_id"]) for r in rows]

    def _commission_map(self, owner: dict) -> dict[str, Decimal]:
        """Effektive Provision je Objekt aus den Stammdaten.

        Pro Objekt gilt ``owner_properties.commission_override_pct``; ist kein
        Override gesetzt, der ``owners.default_commission_pct``. So fließt die in
        den Stammdaten je Objekt konfigurierte Provision in die Abrechnung —
        nicht ein pauschaler Owner-Default.
        """
        default = _d(owner.get("default_commission_pct"))
        rows = (
            self._db.table("owner_properties")
            .select("property_id, commission_override_pct")
            .eq("owner_id", str(owner["id"]))
            .execute()
        ).data or []
        out: dict[str, Decimal] = {}
        for r in rows:
            override = r.get("commission_override_pct")
            out[str(r["property_id"])] = (
                _d(override) if override is not None else default
            )
        return out

    @staticmethod
    def _effective_pct(
        commission_map: dict[str, Decimal], rental_rows: list[RentalRow]
    ) -> Decimal:
        """Anzuzeigender Provisionssatz: sind alle betroffenen Objekte gleich,
        dieser Satz; bei gemischten Sätzen der gewichtete Schnitt über den Payout.
        Nur für die Anzeige (commission_pct im Response) — die Rechnung selbst
        läuft pro Objekt über die commission_map."""
        rates = {commission_map.get(r.listing_id, Decimal("0")) for r in rental_rows}
        if len(rates) == 1:
            return next(iter(rates))
        if not rental_rows:
            return Decimal("0")
        base = sum((_d(r.total_payout) for r in rental_rows), Decimal("0"))
        if base == 0:
            return Decimal("0")
        weighted = sum(
            (
                _d(r.total_payout) * commission_map.get(r.listing_id, Decimal("0"))
                for r in rental_rows
            ),
            Decimal("0"),
        )
        return (weighted / base).quantize(Decimal("0.01"))

    @staticmethod
    def _effective_rate_from_rows(rental_rows: list[RentalRow]) -> Decimal:
        """Effektiver Provisionssatz aus den fertigen Zeilen (1 − owner/total),
        gewichtet über den Payout — für die Kürzung der Owner-Expense vor
        Provision. 0 bei leerer/abwesender Bemessungsgrundlage."""
        base = sum((_d(r.total_payout) for r in rental_rows), Decimal("0"))
        if base == 0:
            return Decimal("0")
        owner = sum((_d(r.owner_payout) for r in rental_rows), Decimal("0"))
        return ((base - owner) / base * Decimal("100")).quantize(Decimal("0.01"))

    def _owner_currency(self, owner: dict, tenant_id: str) -> str:
        """Zielwährung des Owners aus seinem Herkunftsland; fehlt das Land oder
        ist es unbekannt, die Tenant-Währung (kein stiller EUR-Fallback)."""
        return currency_for_country(owner.get("country")) or self._tenant_currency(
            tenant_id
        )

    def _property_titles(self, property_ids: list[str]) -> dict[str, str]:
        if not property_ids:
            return {}
        rows = (
            self._db.table("properties")
            .select("id, title")
            .in_("id", property_ids)
            .execute()
        ).data or []
        return {str(r["id"]): r.get("title") or "" for r in rows}

    def _tenant_name(self, tenant_id: str) -> str | None:
        rows = (
            self._db.table("tenants")
            .select("name, currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("name") if rows else None

    def _tenant_currency(self, tenant_id: str) -> str:
        rows = (
            self._db.table("tenants")
            .select("currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return (rows[0].get("currency") if rows else None) or "EUR"

    def _tenant_tax_profile(self, tenant_id: str) -> dict:
        """Steuerprofil des Mandanten (Aussteller). Quelle ist das vorhandene
        Buchhaltungs-Profil (tenant_billing_profile aus 0023) plus das Land aus
        tenants.country. Vereinheitlicht zu: tax_scheme, default_tax_rate, vat_id,
        tax_number, country, e_invoice_format."""
        billing = (
            self._db.table("tenant_billing_profile")
            .select(
                "tax_number, vat_id, is_kleinunternehmer, default_tax_rate, "
                "e_invoice_format, company_country"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        tenant = (
            self._db.table("tenants")
            .select("country")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        b = billing[0] if billing else {}
        # Aussteller-Land bevorzugt aus dem Firmenprofil (/konto), sonst Tenant.
        country = b.get("company_country") or (tenant[0].get("country") if tenant else None)
        return {
            "country": country,
            "tax_scheme": (
                "small_business" if b.get("is_kleinunternehmer") else "vat"
            ),
            "default_tax_rate": b.get("default_tax_rate"),
            "vat_id": b.get("vat_id"),
            "tax_number": b.get("tax_number"),
            "e_invoice_format": b.get("e_invoice_format"),
        }

    # --- Reservierungen + Rental activity -----------------------------------

    def _reservations(
        self,
        tenant_id: str,
        property_ids: list[str],
        period_from: date,
        period_to: date,
        basis: str,
        statuses: list[str],
    ) -> list[dict]:
        """Reservierungen der Owner-Objekte im Zeitraum (nach basis gefiltert)."""
        if not property_ids:
            return []
        basis_col = "check_in" if basis == "check_in" else "check_out"
        query = (
            self._db.table("reservations")
            .select(
                "id, property_id, guest_id, channel, check_in, check_out, "
                "status, total_amount, channel_fee, currency"
            )
            .eq("tenant_id", tenant_id)
            .in_("property_id", property_ids)
            .gte(basis_col, period_from.isoformat())
            .lte(basis_col, period_to.isoformat())
        )
        if statuses:
            query = query.in_("status", statuses)
        return query.execute().data or []

    @staticmethod
    def _nights(check_in: str, check_out: str) -> int:
        try:
            d_in = date.fromisoformat(check_in)
            d_out = date.fromisoformat(check_out)
            return max((d_out - d_in).days, 0)
        except (ValueError, TypeError):
            return 0

    def _guest_names(self, guest_ids: list[str]) -> dict[str, str]:
        ids = [g for g in guest_ids if g]
        if not ids:
            return {}
        rows = (
            self._db.table("guests")
            .select("id, name")
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): r.get("name") or "" for r in rows}

    def _addon_sums(self, reservation_ids: list[str]) -> dict[str, Decimal]:
        """Extra-Umsatz (Zusatzleistungen) je Reservierung → in den Owner-Split.

        Zählt pending UND paid (ohne Stripe gilt „zahlbar bei Anreise" — der
        Umsatz ist dennoch entstanden); cancelled bleibt außen vor. Add-ons sind
        provisionsfrei am OTA vorbei verkauft, fließen aber wie Mietumsatz in den
        Provisions-/Auszahlungs-Split der Hausverwaltung."""
        ids = [r for r in reservation_ids if r]
        if not ids:
            return {}
        try:
            rows = (
                self._db.table("reservation_addons")
                .select("reservation_id, total, status")
                .in_("reservation_id", ids)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = kein Extra-Umsatz
            log.warning("statement_addons_unavailable", error=str(exc))
            return {}
        sums: dict[str, Decimal] = {}
        for a in rows:
            if (a.get("status") or "pending") == "cancelled":
                continue
            rid = str(a["reservation_id"])
            sums[rid] = sums.get(rid, Decimal("0")) + _d(a.get("total"))
        return sums

    def _rental_rows(
        self,
        reservations: list[dict],
        titles: dict[str, str],
        owner_currency: str,
        override: Decimal | None,
        commission_map: dict[str, Decimal] | None,
    ) -> list[RentalRow]:
        """Rental-Activity-Zeilen inkl. Buchungssatz und Währungsumrechnung.

        Je Reservierung: Auszahlung = total_amount − channel_fee (Quellwährung);
        Owner-Auszahlung (Buchungssatz) = Auszahlung × (1 − Provision); die
        Provision ist der manuelle Override, sonst der Objekt-Satz aus der Map.
        Der Buchungssatz wird mit dem ECB-Tageskurs am CHECK-OUT in die
        Owner-Währung umgerechnet (kein Fallback — FxError bricht ab).
        """
        guest_names = self._guest_names(
            [str(r["guest_id"]) for r in reservations if r.get("guest_id")]
        )
        addon_sums = self._addon_sums([str(r["id"]) for r in reservations])
        cmap = commission_map or {}
        rows: list[RentalRow] = []
        for r in reservations:
            listing_id = str(r["property_id"])
            src_currency = (r.get("currency") or owner_currency).upper()
            # Extra-Umsatz aus Zusatzleistungen fließt in Preis + Auszahlung
            # (provisionsfrei verkauft → keine channel_fee darauf).
            addon_total = addon_sums.get(str(r["id"]), Decimal("0"))
            price = _d(r.get("total_amount")) + addon_total
            payout = price - _d(r.get("channel_fee"))
            pct = override if override is not None else cmap.get(listing_id, Decimal("0"))
            owner_payout = payout * ((Decimal("100") - pct) / Decimal("100"))

            # Buchungssatz in Owner-Währung umrechnen (Stichtag = Check-out).
            checkout = r.get("check_out")
            rate = Decimal("1")
            fx_date: date | None = None
            if src_currency != owner_currency:
                fx_date = date.fromisoformat(checkout) if checkout else None
                if fx_date is None:
                    raise StatementError(
                        "Reservierung ohne Check-out-Datum kann nicht in die "
                        "Owner-Währung umgerechnet werden.",
                        status_code=422,
                    )
                try:
                    rate = self._fx.get_rate(fx_date, src_currency, owner_currency)
                except FxError as exc:
                    raise StatementError(str(exc), status_code=502) from exc
            owner_payout_conv = owner_payout * rate

            rows.append(
                RentalRow(
                    reservation_id=str(r["id"]),
                    guest=guest_names.get(str(r.get("guest_id"))),
                    nights=self._nights(r.get("check_in"), checkout),
                    listing_id=listing_id,
                    listing=titles.get(listing_id),
                    channel=r.get("channel") or "direct",
                    total_price=_money(price),
                    total_payout=_money(payout),
                    currency=src_currency,
                    owner_payout=_money(owner_payout),
                    owner_payout_converted=_money(owner_payout_conv),
                    fx_rate=float(rate),
                    fx_date=fx_date,
                )
            )
        return rows

    @staticmethod
    def _listing_rows(
        rental_rows: list[RentalRow], titles: dict[str, str]
    ) -> list[ListingRow]:
        agg: dict[str, dict] = {}
        for row in rental_rows:
            a = agg.setdefault(
                row.listing_id,
                {"nights": 0, "reservations": 0, "price": Decimal("0"), "payout": Decimal("0")},
            )
            a["nights"] += row.nights
            a["reservations"] += 1
            a["price"] += _d(row.total_price)
            a["payout"] += _d(row.total_payout)
        return [
            ListingRow(
                listing_id=lid,
                listing=titles.get(lid),
                nights=a["nights"],
                reservations=a["reservations"],
                total_price=_money(a["price"]),
                total_payout=_money(a["payout"]),
            )
            for lid, a in agg.items()
        ]

    # --- Expenses ------------------------------------------------------------

    def _expenses_for_statement(self, statement_id: str) -> list[dict]:
        return (
            self._db.table("owner_expenses")
            .select("*")
            .eq("statement_id", statement_id)
            .order("date")
            .execute()
        ).data or []

    def _owner_unbound_expenses(
        self, tenant_id: str, owner_id: str, period_from: date, period_to: date
    ) -> list[dict]:
        """Owner-Ausgaben im Zeitraum, die (noch) an KEINE Abrechnung gebunden
        sind — für die Live-Vorschau der Owner-Seite."""
        return (
            self._db.table("owner_expenses")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .is_("statement_id", "null")
            .gte("date", period_from.isoformat())
            .lte("date", period_to.isoformat())
            .order("date")
            .execute()
        ).data or []

    # --- Auszahlungsformel ---------------------------------------------------

    def _compute_summary(
        self,
        rental_rows: list[RentalRow],
        expenses: list[dict],
        owner_id: str,
        currency: str,
        owner_currency: str,
    ) -> StatementSummary:
        """Summen aus den (bereits provisioniert + umgerechnet) Rental-Zeilen.

        Owner-Payout = Σ owner_payout_converted (in Owner-Währung) + Owner-
        Expenses (in Owner-Währung erfasst, ungekürzt zum Owner). Verwaltungs-
        Auszahlung bleibt je QUELLWÄHRUNG getrennt (= total_payout − owner_payout
        je Reservierung), da Beträge verschiedener Währungen nicht addiert werden
        dürfen. total_price/total_payout (Anzeige) ebenfalls je Quellwährung.
        """
        total_price = sum((_d(r.total_price) for r in rental_rows), Decimal("0"))
        total_payout = sum((_d(r.total_payout) for r in rental_rows), Decimal("0"))
        expenses_total = sum((_d(e.get("amount")) for e in expenses), Decimal("0"))
        owner_expenses = sum(
            (_d(e.get("amount")) for e in expenses if str(e.get("owner_id")) == owner_id),
            Decimal("0"),
        )

        # Owner-Payout: umgerechnete Buchungssätze (in Owner-Währung) + Owner-
        # Expenses. Die Expense mindert die Bemessungsgrundlage VOR Provision —
        # daher mit dem effektiven Satz gekürzt (konsistent zur Per-Reservierung-
        # Provision; bei einheitlichem Satz = (payout − expense) × factor).
        eff = self._effective_rate_from_rows(rental_rows)
        owner_payout = owner_expenses * ((Decimal("100") - eff) / Decimal("100")) + sum(
            (_d(r.owner_payout_converted) for r in rental_rows), Decimal("0")
        )

        # Verwaltungs-Auszahlung + Roh-Summen je Quellwährung gruppieren.
        pm_by: dict[str, Decimal] = {}
        tot_by: dict[str, Decimal] = {}
        for r in rental_rows:
            pm_by[r.currency] = pm_by.get(r.currency, Decimal("0")) + (
                _d(r.total_payout) - _d(r.owner_payout)
            )
            tot_by[r.currency] = tot_by.get(r.currency, Decimal("0")) + _d(r.total_payout)
        # Single-Currency UND Owner-Währung == Quellwährung: die Owner-Expense
        # fließt in den Verwaltungsanteil (pm = total_payout − owner_payout, beide
        # in derselben Währung). Sonst (Mehrwährung oder abweichende Owner-Währung)
        # bleibt der PM-Anteil je Quellwährung roh, da owner_payout in einer
        # ANDEREN Währung steht und nicht abgezogen werden darf.
        same_unit = len(pm_by) == 1 and next(iter(pm_by)) == owner_currency
        if same_unit:
            only = next(iter(pm_by))
            pm_by[only] = total_payout - owner_payout
        pm_by_list = [
            CurrencyAmount(currency=c, amount=_money(a)) for c, a in pm_by.items()
        ]
        tot_by_list = [
            CurrencyAmount(currency=c, amount=_money(a)) for c, a in tot_by.items()
        ]
        # pm_payout (Skalar, Kompat): nur bei gleicher Einheit der korrekte
        # Verwaltungsanteil; sonst nicht als Mischsumme darstellbar → 0, Detail in
        # pm_payout_by_currency.
        pm_payout = (total_payout - owner_payout) if same_unit else Decimal("0")

        return StatementSummary(
            total_price=_money(total_price),
            total_payout=_money(total_payout),
            expenses_total=_money(expenses_total),
            owner_payout=_money(owner_payout),
            pm_payout=_money(pm_payout),
            currency=currency,
            booking_count=len(rental_rows),
            owner_currency=owner_currency,
            pm_payout_by_currency=pm_by_list,
            totals_by_currency=tot_by_list,
        )

    # --- Erzeugen / Lesen / Aktualisieren -----------------------------------

    def preview(
        self, ctx: AuthContext, req: StatementGenerateRequest
    ) -> StatementResponse:
        """Live-Auswertung für Owner + Zeitraum + Filter OHNE DB-Insert. Liefert
        dieselbe Struktur wie eine Abrechnung (Aktivität, Ausgaben, Summen), aber
        mit id='' (nicht gespeichert). Die Owner-Seite zeigt damit den Umsatz-
        Überblick; eine echte Abrechnung entsteht erst über generate()."""
        tenant_id = self._require_tenant(ctx)
        owner = self._owner(tenant_id, req.owner_id)
        # Expliziter Editor-Override gewinnt; sonst Provision je Objekt aus Stammdaten.
        override = _d(req.commission_pct) if req.commission_pct is not None else None
        commission_map = self._commission_map(owner)
        currency = self._tenant_currency(tenant_id)
        owner_currency = self._owner_currency(owner, tenant_id)
        header = self._header_from_stammdaten(tenant_id, owner)

        property_ids = self._owner_property_ids(req.owner_id)
        titles = self._property_titles(property_ids)
        reservations = self._reservations(
            tenant_id,
            property_ids,
            req.period_from,
            req.period_to,
            req.basis.value,
            req.reservation_statuses,
        )
        rental_rows = self._rental_rows(
            reservations, titles, owner_currency, override, commission_map
        )
        listing_rows = self._listing_rows(rental_rows, titles)
        # Nicht an eine Abrechnung gebundene Owner-Ausgaben im Zeitraum einbeziehen.
        expenses = self._owner_unbound_expenses(
            tenant_id, req.owner_id, req.period_from, req.period_to
        )
        summary = self._compute_summary(
            rental_rows, expenses, req.owner_id, currency, owner_currency
        )
        # Für die Anzeige: effektiver Satz (einheitlich → dieser Satz, sonst gemischt).
        commission = override if override is not None else self._effective_pct(
            commission_map, rental_rows
        )
        # Zusammengesetzte, NICHT gespeicherte Statement-Antwort (id='').
        row = {
            "id": "",
            "tenant_id": tenant_id,
            "owner_id": req.owner_id,
            "period_from": req.period_from.isoformat(),
            "period_to": req.period_to.isoformat(),
            "basis": req.basis.value,
            "reservation_statuses": req.reservation_statuses,
            "status": "draft",
            "kind": "invoice",
            "commission_pct": float(commission),
            "currency": currency,
            **header.model_dump(),
        }
        return _to_response(
            row, summary, rental_rows, listing_rows, expenses, commission
        )

    def generate(
        self, ctx: AuthContext, req: StatementGenerateRequest
    ) -> StatementResponse:
        tenant_id = self._require_tenant(ctx)
        owner = self._owner(tenant_id, req.owner_id)
        # NULL = Provision je Objekt aus Stammdaten; Zahl = manueller Override.
        commission = (
            float(_d(req.commission_pct))
            if req.commission_pct is not None
            else None
        )
        currency = self._tenant_currency(tenant_id)
        header = self._header_from_stammdaten(tenant_id, owner)

        row = {
            "tenant_id": tenant_id,
            "owner_id": req.owner_id,
            "period_from": req.period_from.isoformat(),
            "period_to": req.period_to.isoformat(),
            "basis": req.basis.value,
            "reservation_statuses": req.reservation_statuses,
            "status": "draft",
            "commission_pct": commission,
            "currency": currency,
            **header.model_dump(),
        }
        res = self._db.table("owner_statements").insert(row).execute()
        if not res.data:
            raise StatementError("Statement konnte nicht angelegt werden.", status_code=500)
        statement_id = str(res.data[0]["id"])
        self._refresh_summary(tenant_id, statement_id)
        log.info(
            "owner_statement_generated",
            tenant_id=tenant_id,
            owner_id=req.owner_id,
            statement_id=statement_id,
        )
        return self.get(ctx, statement_id)

    def _header_from_stammdaten(self, tenant_id: str, owner: dict) -> StatementHeader:
        owner_addr = ", ".join(
            p
            for p in [
                " ".join(
                    x for x in [owner.get("street"), owner.get("house_number")] if x
                ).strip(),
                " ".join(
                    x for x in [owner.get("postal_code"), owner.get("city")] if x
                ).strip(),
                owner.get("country"),
            ]
            if p
        ) or None
        # PM/Agentur-Daten aus dem Buchhaltungs-Firmenprofil (0023 + 0026).
        billing = (
            self._db.table("tenant_billing_profile")
            .select(
                "legal_name, tax_number, vat_id, email, phone_number, "
                "company_street, company_house_number, company_postal_code, "
                "company_city, company_country, company_logo_url"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        b = billing[0] if billing else {}
        pm_addr = ", ".join(
            p
            for p in [
                " ".join(
                    x
                    for x in [b.get("company_street"), b.get("company_house_number")]
                    if x
                ).strip(),
                " ".join(
                    x
                    for x in [b.get("company_postal_code"), b.get("company_city")]
                    if x
                ).strip(),
                b.get("company_country"),
            ]
            if p
        ) or None
        return StatementHeader(
            pm_name=b.get("legal_name") or self._tenant_name(tenant_id),
            pm_email=b.get("email"),
            pm_phone=b.get("phone_number"),
            pm_address=pm_addr,
            pm_tax_id=b.get("vat_id") or b.get("tax_number"),
            pm_logo_url=b.get("company_logo_url"),
            owner_name=owner.get("name"),
            owner_email=owner.get("email"),
            owner_phone=owner.get("phone"),
            owner_address=owner_addr,
            owner_tax_id=owner.get("tax_id"),
        )

    def _statement_row(self, tenant_id: str, statement_id: str) -> dict:
        rows = (
            self._db.table("owner_statements")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", statement_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise StatementError("Statement nicht gefunden.", status_code=404)
        return rows[0]

    def _build_activity(
        self, tenant_id: str, row: dict
    ) -> tuple[list[RentalRow], list[ListingRow], dict[str, str]]:
        owner = self._owner(tenant_id, str(row["owner_id"]))
        owner_currency = self._owner_currency(owner, tenant_id)
        override, cmap = self._commission_for_row(tenant_id, row)
        property_ids = self._owner_property_ids(str(row["owner_id"]))
        titles = self._property_titles(property_ids)
        reservations = self._reservations(
            tenant_id,
            property_ids,
            date.fromisoformat(row["period_from"]),
            date.fromisoformat(row["period_to"]),
            row.get("basis") or "check_in",
            list(row.get("reservation_statuses") or []),
        )
        rental_rows = self._rental_rows(
            reservations, titles, owner_currency, override, cmap
        )
        listing_rows = self._listing_rows(rental_rows, titles)
        return rental_rows, listing_rows, titles

    def _commission_for_row(
        self, tenant_id: str, row: dict
    ) -> tuple[Decimal | None, dict[str, Decimal] | None]:
        """Provisions-Eingang für _compute_summary aus einer Statement-Zeile.

        commission_pct gesetzt → (Override, None); NULL → (None, Stammdaten-Map
        je Objekt). So gilt für gespeicherte Abrechnungen dieselbe Per-Objekt-
        Logik wie in der Vorschau.
        """
        pct = row.get("commission_pct")
        if pct is not None:
            return _d(pct), None
        owner = self._owner(tenant_id, str(row["owner_id"]))
        return None, self._commission_map(owner)

    def _refresh_summary(self, tenant_id: str, statement_id: str) -> StatementSummary:
        """Summen aus aktueller Aktivität + Expenses neu berechnen und im draft
        persistieren. Finalisierte Statements werden NICHT verändert."""
        row = self._statement_row(tenant_id, statement_id)
        rental_rows, _listings, _titles = self._build_activity(tenant_id, row)
        expenses = self._expenses_for_statement(statement_id)
        owner = self._owner(tenant_id, str(row["owner_id"]))
        owner_currency = self._owner_currency(owner, tenant_id)
        summary = self._compute_summary(
            rental_rows,
            expenses,
            str(row["owner_id"]),
            row.get("currency") or "EUR",
            owner_currency,
        )
        if row.get("status") != "finalized":
            self._db.table("owner_statements").update(
                {
                    "total_price": summary.total_price,
                    "total_payout": summary.total_payout,
                    "expenses_total": summary.expenses_total,
                    "owner_payout": summary.owner_payout,
                    "pm_payout": summary.pm_payout,
                    "owner_currency": summary.owner_currency,
                }
            ).eq("tenant_id", tenant_id).eq("id", statement_id).execute()
        return summary

    def get(self, ctx: AuthContext, statement_id: str) -> StatementResponse:
        tenant_id = self._require_tenant(ctx)
        row = self._statement_row(tenant_id, statement_id)
        rental_rows, listing_rows, _titles = self._build_activity(tenant_id, row)
        expenses = self._expenses_for_statement(statement_id)
        override, cmap = self._commission_for_row(tenant_id, row)
        owner = self._owner(tenant_id, str(row["owner_id"]))
        owner_currency = self._owner_currency(owner, tenant_id)
        # Anzuzeigender Satz: Override, sonst effektiver Satz aus den Stammdaten.
        commission_display = (
            override
            if override is not None
            else self._effective_pct(cmap or {}, rental_rows)
        )
        if row.get("status") != "draft":
            # Eingefrorene Summen aus dem Snapshot (finalized, cancelled, Storno).
            summary = StatementSummary(
                total_price=_money(_d(row.get("total_price"))),
                total_payout=_money(_d(row.get("total_payout"))),
                expenses_total=_money(_d(row.get("expenses_total"))),
                owner_payout=_money(_d(row.get("owner_payout"))),
                pm_payout=_money(_d(row.get("pm_payout"))),
                currency=row.get("currency") or "EUR",
                booking_count=len(rental_rows),
                owner_currency=row.get("owner_currency") or owner_currency,
            )
        else:
            summary = self._compute_summary(
                rental_rows,
                expenses,
                str(row["owner_id"]),
                row.get("currency") or "EUR",
                owner_currency,
            )
        return _to_response(
            row, summary, rental_rows, listing_rows, expenses, commission_display
        )

    def list(self, ctx: AuthContext, owner_id: str | None = None) -> StatementListResponse:
        tenant_id = self._require_tenant(ctx)
        query = (
            self._db.table("owner_statements")
            .select(
                "id, owner_id, period_from, period_to, status, owner_payout, "
                "pm_payout, currency, invoice_number, owner_name, created_at"
            )
            .eq("tenant_id", tenant_id)
        )
        if owner_id:
            query = query.eq("owner_id", owner_id)
        rows = query.order("created_at", desc=True).execute().data or []
        items = [
            StatementListItem(
                id=str(r["id"]),
                owner_id=str(r["owner_id"]),
                owner_name=r.get("owner_name"),
                period_from=date.fromisoformat(r["period_from"]),
                period_to=date.fromisoformat(r["period_to"]),
                status=r.get("status") or "draft",
                owner_payout=_money(_d(r.get("owner_payout"))),
                pm_payout=_money(_d(r.get("pm_payout"))),
                currency=r.get("currency") or "EUR",
                invoice_number=r.get("invoice_number"),
                created_at=str(r["created_at"]) if r.get("created_at") else None,
            )
            for r in rows
        ]
        return StatementListResponse(items=items, total=len(items))

    def update(
        self, ctx: AuthContext, statement_id: str, req: StatementUpdate
    ) -> StatementResponse:
        tenant_id = self._require_tenant(ctx)
        row = self._statement_row(tenant_id, statement_id)
        if row.get("status") != "draft":
            raise StatementError(
                "Nur Entwürfe können geändert werden. Finalisierte/stornierte "
                "Belege sind unveränderbar.",
                status_code=409,
            )
        changes: dict = {}
        if req.header is not None:
            changes.update(req.header.model_dump(exclude_unset=True))
        if req.commission_pct is not None:
            changes["commission_pct"] = req.commission_pct
        if req.basis is not None:
            changes["basis"] = req.basis.value
        if req.reservation_statuses is not None:
            changes["reservation_statuses"] = req.reservation_statuses
        if req.period_from is not None:
            changes["period_from"] = req.period_from.isoformat()
        if req.period_to is not None:
            changes["period_to"] = req.period_to.isoformat()
        if changes:
            self._db.table("owner_statements").update(changes).eq(
                "tenant_id", tenant_id
            ).eq("id", statement_id).execute()
        self._refresh_summary(tenant_id, statement_id)
        return self.get(ctx, statement_id)

    def _next_invoice_number(self, tenant_id: str, doc_type: str, prefix: str) -> str:
        """Fortlaufende Rechnungsnummer atomar über die VORHANDENE Buchhaltungs-
        Funktion next_document_number (0025, Row-Lock) vergeben — gemeinsamer
        Nummernkreis-Mechanismus, kein Parallelsystem."""
        res = self._db.rpc(
            "next_document_number",
            {"p_tenant_id": tenant_id, "p_doc_type": doc_type, "p_prefix": prefix},
        ).execute()
        row = (res.data or [{}])[0]
        number = row.get("formatted_number")
        if not number:
            raise StatementError(
                "Rechnungsnummer konnte nicht vergeben werden.", status_code=500
            )
        return str(number)

    def finalize(self, ctx: AuthContext, statement_id: str) -> StatementResponse:
        """Beleg festschreiben: fortlaufende Rechnungsnummer vergeben (§14 UStG /
        Art. 226 RL 2006/112), Steuer aus den drei Ländern berechnen, Summen +
        Steuerwerte einfrieren. Danach unveränderbar."""
        tenant_id = self._require_tenant(ctx)
        row = self._statement_row(tenant_id, statement_id)
        if row.get("status") == "finalized":
            return self.get(ctx, statement_id)
        if row.get("status") == "cancelled":
            raise StatementError(
                "Stornierter Beleg kann nicht finalisiert werden.", status_code=409
            )
        # Summen vor dem Einfrieren auf den letzten Stand bringen.
        summary = self._refresh_summary(tenant_id, statement_id)

        # Steuer auf den Provisions-/PM-Payout (steuerbarer Umsatz der Agentur).
        profile = self._tenant_tax_profile(tenant_id)
        owner = self._owner(tenant_id, str(row["owner_id"]))
        tax = compute_tax(
            taxable_base=_d(summary.pm_payout),
            tenant_tax_scheme=profile.get("tax_scheme") or "vat",
            tenant_default_rate=_d(profile.get("default_tax_rate")),
            seller_country=profile.get("country"),
            buyer_country=owner.get("country"),
            buyer_vat_id=owner.get("vat_id"),
        )

        today = date.today()
        number = self._next_invoice_number(tenant_id, "owner_statement", "RE-")
        self._db.table("owner_statements").update(
            {
                "status": "finalized",
                "invoice_number": number,
                "invoice_date": today.isoformat(),
                "supply_country": profile.get("country"),
                "buyer_vat_id": owner.get("vat_id"),
                "tax_category": tax.category,
                "tax_rate": float(tax.rate),
                "net_amount": float(tax.net),
                "tax_amount": float(tax.tax),
                "gross_amount": float(tax.gross),
                "tax_exemption_reason": tax.exemption_reason,
            }
        ).eq("tenant_id", tenant_id).eq("id", statement_id).execute()
        log.info(
            "owner_statement_finalized",
            tenant_id=tenant_id,
            statement_id=statement_id,
            invoice_number=number,
            tax_category=tax.category,
        )
        return self.get(ctx, statement_id)

    def cancel(self, ctx: AuthContext, statement_id: str) -> StatementResponse:
        """Storniert einen finalisierten Beleg GoBD-konform: erzeugt eine NEUE
        Stornorechnung (eigene Nummer, negierte Beträge, Verweis aufs Original)
        und markiert das Original als 'cancelled'. Das Original bleibt unverändert
        erhalten; die neue Stornorechnung wird zurückgegeben."""
        tenant_id = self._require_tenant(ctx)
        row = self._statement_row(tenant_id, statement_id)
        if row.get("status") != "finalized":
            raise StatementError(
                "Nur finalisierte Belege können storniert werden.", status_code=409
            )
        if row.get("cancelled_by_statement_id"):
            raise StatementError("Beleg ist bereits storniert.", status_code=409)

        today = date.today()
        number = self._next_invoice_number(
            tenant_id, "owner_statement_storno", "ST-"
        )
        orig_no = row.get("invoice_number")
        reason = (
            f"Stornorechnung – hebt Rechnung {orig_no} vom "
            f"{row.get('invoice_date')} vollständig auf."
        )
        # Storno-Beleg = Kopie des Originals mit negierten Beträgen.
        storno = {
            "tenant_id": tenant_id,
            "owner_id": row["owner_id"],
            "period_from": row["period_from"],
            "period_to": row["period_to"],
            "basis": row.get("basis") or "check_in",
            "reservation_statuses": list(row.get("reservation_statuses") or []),
            "status": "finalized",
            "kind": "cancellation",
            "cancels_statement_id": statement_id,
            "commission_pct": row.get("commission_pct") or 0,
            "currency": row.get("currency") or "EUR",
            "invoice_number": number,
            "invoice_date": today.isoformat(),
            "supply_country": row.get("supply_country"),
            "buyer_vat_id": row.get("buyer_vat_id"),
            "tax_category": row.get("tax_category") or "S",
            "tax_rate": row.get("tax_rate") or 0,
            # Beträge negiert (Gegenbuchung).
            "total_price": -_d(row.get("total_price")),
            "total_payout": -_d(row.get("total_payout")),
            "expenses_total": -_d(row.get("expenses_total")),
            "owner_payout": -_d(row.get("owner_payout")),
            "pm_payout": -_d(row.get("pm_payout")),
            "net_amount": -_d(row.get("net_amount")),
            "tax_amount": -_d(row.get("tax_amount")),
            "gross_amount": -_d(row.get("gross_amount")),
            "tax_exemption_reason": row.get("tax_exemption_reason"),
            "notes": reason,
            # Kopf-Snapshot übernehmen.
            "pm_name": row.get("pm_name"),
            "pm_email": row.get("pm_email"),
            "pm_phone": row.get("pm_phone"),
            "pm_address": row.get("pm_address"),
            "pm_tax_id": row.get("pm_tax_id"),
            "pm_logo_url": row.get("pm_logo_url"),
            "owner_name": row.get("owner_name"),
            "owner_email": row.get("owner_email"),
            "owner_phone": row.get("owner_phone"),
            "owner_address": row.get("owner_address"),
            "owner_tax_id": row.get("owner_tax_id"),
        }
        res = self._db.table("owner_statements").insert(storno).execute()
        if not res.data:
            raise StatementError(
                "Stornorechnung konnte nicht angelegt werden.", status_code=500
            )
        storno_id = str(res.data[0]["id"])
        # Original als storniert markieren + Rückverweis setzen.
        self._db.table("owner_statements").update(
            {"status": "cancelled", "cancelled_by_statement_id": storno_id}
        ).eq("tenant_id", tenant_id).eq("id", statement_id).execute()
        log.info(
            "owner_statement_cancelled",
            tenant_id=tenant_id,
            statement_id=statement_id,
            storno_id=storno_id,
            invoice_number=number,
        )
        return self.get(ctx, storno_id)

    def delete(self, ctx: AuthContext, statement_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        row = self._statement_row(tenant_id, statement_id)
        if row.get("status") != "draft":
            # Finalisierte/stornierte Belege sind unveränderbar (GoBD) und dürfen
            # nicht gelöscht werden — nur Entwürfe.
            raise StatementError(
                "Nur Entwürfe können gelöscht werden. Finalisierte Rechnungen "
                "müssen storniert werden.",
                status_code=409,
            )
        res = (
            self._db.table("owner_statements")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", statement_id)
            .execute()
        )
        if not res.data:
            raise StatementError("Statement nicht gefunden.", status_code=404)
        log.info(
            "owner_statement_deleted", tenant_id=tenant_id, statement_id=statement_id
        )

    # --- Expenses CRUD ------------------------------------------------------

    def add_expense(self, ctx: AuthContext, req: ExpenseCreate) -> ExpenseResponse:
        tenant_id = self._require_tenant(ctx)
        payload = req.model_dump(mode="json")
        payload["tenant_id"] = tenant_id
        res = self._db.table("owner_expenses").insert(payload).execute()
        if not res.data:
            raise StatementError("Position konnte nicht angelegt werden.", status_code=500)
        if req.statement_id:
            self._refresh_summary(tenant_id, req.statement_id)
        return _expense(res.data[0])

    def update_expense(
        self, ctx: AuthContext, expense_id: str, req: ExpenseUpdate
    ) -> ExpenseResponse:
        tenant_id = self._require_tenant(ctx)
        existing = (
            self._db.table("owner_expenses")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", expense_id)
            .limit(1)
            .execute()
        ).data or []
        if not existing:
            raise StatementError("Position nicht gefunden.", status_code=404)
        changes = req.model_dump(mode="json", exclude_unset=True)
        if changes:
            self._db.table("owner_expenses").update(changes).eq(
                "tenant_id", tenant_id
            ).eq("id", expense_id).execute()
        statement_id = existing[0].get("statement_id")
        if statement_id:
            self._refresh_summary(tenant_id, str(statement_id))
        updated = (
            self._db.table("owner_expenses")
            .select("*")
            .eq("id", expense_id)
            .limit(1)
            .execute()
        ).data
        return _expense(updated[0] if updated else existing[0])

    def delete_expense(self, ctx: AuthContext, expense_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        existing = (
            self._db.table("owner_expenses")
            .select("statement_id")
            .eq("tenant_id", tenant_id)
            .eq("id", expense_id)
            .limit(1)
            .execute()
        ).data or []
        if not existing:
            raise StatementError("Position nicht gefunden.", status_code=404)
        self._db.table("owner_expenses").delete().eq("tenant_id", tenant_id).eq(
            "id", expense_id
        ).execute()
        statement_id = existing[0].get("statement_id")
        if statement_id:
            self._refresh_summary(tenant_id, str(statement_id))

    # --- Auto-Statements -----------------------------------------------------

    def run_auto_statements(self, period_from: date, period_to: date) -> AutoStatementRunResponse:
        """Für jeden Owner mit statement_frequency='monthly' ein Statement je
        Zeitraum erzeugen — sofern für diesen Zeitraum noch keines existiert
        (1/Monat). Expenses werden nach Datum+Listing/Owner automatisch dem
        Statement zugeordnet. Änderungen wirken nur auf KÜNFTIGE Statements
        (bestehende werden nie angefasst)."""
        owners = (
            self._db.table("owners")
            .select("id, tenant_id, default_commission_pct, name, email, phone, "
                    "street, house_number, postal_code, city, country, tax_id")
            .eq("statement_frequency", "monthly")
            .execute()
        ).data or []
        generated = 0
        for owner in owners:
            tenant_id = str(owner["tenant_id"])
            owner_id = str(owner["id"])
            existing = (
                self._db.table("owner_statements")
                .select("id")
                .eq("owner_id", owner_id)
                .eq("period_from", period_from.isoformat())
                .eq("period_to", period_to.isoformat())
                .limit(1)
                .execute()
            ).data or []
            if existing:
                continue  # 1/Monat — bestehendes nie überschreiben.
            currency = self._tenant_currency(tenant_id)
            header = self._header_from_stammdaten(tenant_id, owner)
            ins = (
                self._db.table("owner_statements")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "owner_id": owner_id,
                        "period_from": period_from.isoformat(),
                        "period_to": period_to.isoformat(),
                        "basis": "check_in",
                        "reservation_statuses": ["confirmed", "completed"],
                        "status": "draft",
                        "commission_pct": float(_d(owner.get("default_commission_pct"))),
                        "currency": currency,
                        **header.model_dump(),
                    }
                )
                .execute()
            ).data
            if not ins:
                continue
            statement_id = str(ins[0]["id"])
            self._auto_assign_expenses(tenant_id, owner_id, statement_id, period_from, period_to)
            self._refresh_summary(tenant_id, statement_id)
            generated += 1
        log.info("owner_statements_auto_run", generated=generated, owners=len(owners))
        return AutoStatementRunResponse(generated=generated, owners=len(owners))

    def _auto_assign_expenses(
        self,
        tenant_id: str,
        owner_id: str,
        statement_id: str,
        period_from: date,
        period_to: date,
    ) -> None:
        """Noch nicht zugeordnete Expenses im Zeitraum, die per Owner ODER per
        Listing des Owners passen, diesem Statement zuordnen (Datum+Owner/Listing)."""
        property_ids = set(self._owner_property_ids(owner_id))
        rows = (
            self._db.table("owner_expenses")
            .select("id, owner_id, listing_id")
            .eq("tenant_id", tenant_id)
            .is_("statement_id", "null")
            .gte("date", period_from.isoformat())
            .lte("date", period_to.isoformat())
            .execute()
        ).data or []
        for e in rows:
            matches = str(e.get("owner_id")) == owner_id or (
                e.get("listing_id") and str(e["listing_id"]) in property_ids
            )
            if matches:
                self._db.table("owner_expenses").update(
                    {"statement_id": statement_id}
                ).eq("id", e["id"]).execute()


def _expense(r: dict) -> ExpenseResponse:
    return ExpenseResponse(
        id=str(r["id"]),
        tenant_id=str(r["tenant_id"]),
        statement_id=str(r["statement_id"]) if r.get("statement_id") else None,
        concept=r["concept"],
        date=date.fromisoformat(r["date"]) if isinstance(r["date"], str) else r["date"],
        category=r.get("category"),
        listing_id=str(r["listing_id"]) if r.get("listing_id") else None,
        reservation_id=str(r["reservation_id"]) if r.get("reservation_id") else None,
        owner_id=str(r["owner_id"]) if r.get("owner_id") else None,
        amount=_money(_d(r.get("amount"))),
        attachment_url=r.get("attachment_url"),
        hidden_from_owner=bool(r.get("hidden_from_owner")),
        created_at=str(r["created_at"]) if r.get("created_at") else None,
        updated_at=str(r["updated_at"]) if r.get("updated_at") else None,
    )


def _to_response(
    row: dict,
    summary: StatementSummary,
    rental_rows: list[RentalRow],
    listing_rows: list[ListingRow],
    expenses: list[dict],
    commission_display: Decimal | None = None,
) -> StatementResponse:
    header = StatementHeader(
        pm_name=row.get("pm_name"),
        pm_email=row.get("pm_email"),
        pm_phone=row.get("pm_phone"),
        pm_address=row.get("pm_address"),
        pm_tax_id=row.get("pm_tax_id"),
        pm_logo_url=row.get("pm_logo_url"),
        owner_name=row.get("owner_name"),
        owner_email=row.get("owner_email"),
        owner_phone=row.get("owner_phone"),
        owner_address=row.get("owner_address"),
        owner_tax_id=row.get("owner_tax_id"),
        invoice_number=row.get("invoice_number"),
        notes=row.get("notes"),
    )
    tax = TaxBreakdown(
        category=row.get("tax_category") or "S",
        rate=_money(_d(row.get("tax_rate"))),
        net=_money(_d(row.get("net_amount"))),
        tax=_money(_d(row.get("tax_amount"))),
        gross=_money(_d(row.get("gross_amount"))),
        exemption_reason=row.get("tax_exemption_reason"),
    )
    return StatementResponse(
        id=str(row["id"]),
        tenant_id=str(row["tenant_id"]),
        owner_id=str(row["owner_id"]),
        period_from=date.fromisoformat(row["period_from"]),
        period_to=date.fromisoformat(row["period_to"]),
        basis=row.get("basis") or "check_in",
        reservation_statuses=list(row.get("reservation_statuses") or []),
        status=row.get("status") or "draft",
        kind=row.get("kind") or "invoice",
        commission_pct=_money(
            commission_display
            if commission_display is not None
            else _d(row.get("commission_pct"))
        ),
        header=header,
        summary=summary,
        invoice_date=(
            date.fromisoformat(row["invoice_date"]) if row.get("invoice_date") else None
        ),
        due_date=date.fromisoformat(row["due_date"]) if row.get("due_date") else None,
        supply_country=row.get("supply_country"),
        buyer_vat_id=row.get("buyer_vat_id"),
        tax=tax,
        cancels_statement_id=(
            str(row["cancels_statement_id"])
            if row.get("cancels_statement_id")
            else None
        ),
        cancelled_by_statement_id=(
            str(row["cancelled_by_statement_id"])
            if row.get("cancelled_by_statement_id")
            else None
        ),
        rental_rows=rental_rows,
        listing_rows=listing_rows,
        expenses=[_expense(e) for e in expenses],
        created_at=str(row["created_at"]) if row.get("created_at") else None,
        updated_at=str(row["updated_at"]) if row.get("updated_at") else None,
    )
