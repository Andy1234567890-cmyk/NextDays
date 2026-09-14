"""Fachlogik des Bereichs »steuer«: Umsatzsteuer-Auswertung, eingefrorene
Meldungen, EÜR-Vorschau, Steuer-Parameter.

LÄNDERNEUTRAL (27 Länder): die Auswertung liefert Summen je Kategorie und
Steuersatz aus Ausgangsbelegen (`invoices`) und Eingangsbelegen (`expenses`).
Die deutsche Kennzahlen-Zuordnung (Kz 81/86/66/83) hängt nur bei Land `DE`
aus `de_ustva.py` an. UStVA/EÜR/ELSTER sind deutsche Formen — hier heißt es
„Umsatzsteuer-Meldung" und „Einnahmen-Ausgaben-Vorschau".

Regeln der Umsatzseite (alle serverseitig, nichts kommt vom Client):
  * Belegdatum = `issue_date` in der Periode; Entwürfe (`draft`) zählen nie.
  * Storno (`invoice_type='storno'`) und Gutschrift (`credit_note`) zählen
    NEGATIV. Der Bestand (`storno.py`) setzt das Original beim Storno auf
    `status='cancelled'` UND legt eine negative Storno-Rechnung an. Zählte man
    nur die Storno-Zeile, stünde die Periode doppelt im Minus. Deshalb: ein
    `cancelled`-Original zählt genau dann, wenn eine Storno-Rechnung darauf
    verweist (Original + Storno heben sich auf, ggf. über zwei Perioden hinweg —
    so, wie es gemeldet wurde). Ein `cancelled` OHNE Storno-Beleg war nie ein
    gemeldeter Umsatz und bleibt draußen.
  * Steuersatz je POSITION (`invoice_line_items.tax_rate`); ohne Positionen der
    Satz der Rechnung; ohne beides und mit Steuer ≠ 0 → Zeile `undetermined`
    mit Warnung — kein geratener Satz (Wurzel 4).
  * Die Steuerregel der Rechnung (`tax_rule`) entscheidet die Kategorie:
    `DE_TAXABLE`/leer → steuerpflichtig je Satz; Reverse-Charge, steuerfrei,
    Ausfuhr, OSS → Netto in ihrer Kategorie, ohne Steuer.
  * Währung: JEDER Beleg muss die Mandantenwährung tragen. Gemischte oder
    fehlende Währungen → 422 mit Nennung — kein stilles Addieren von DKK zu EUR.

Vorsteuer aus `expenses` (baut der Bereich »ausgaben«, Migration 0655; hier
werden `expense_date, net_amount, tax_amount, gross_amount, tax_rate, currency,
status` erwartet). Fehlt die Tabelle noch (`42P01`), liefert die Auswertung
Vorsteuer 0 mit WARNUNG — sichtbar, nicht stumm (Wurzel 5).

Eingefrorene Meldungen (`tax_returns`, 0675): ein Freeze ist idempotent — ein
zweiter Aufruf mit gleichen Werten gibt denselben Entwurf zurück; ein Entwurf
mit abweichenden Werten wird AKTUALISIERT (ein Entwurf ist noch keine Tatsache);
ist die letzte Version `submitted`, entsteht Version n+1 und die alte wird
`corrected` (Wurzel 1: der Gegenzustand wird mitgepflegt).
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import de_ustva
from .perioden import Periode, PeriodeUngueltig, periode_parsen
from .schemas import (
    RETURN_STATUSES,
    FreezeRequest,
    InputTaxLine,
    MappedFigure,
    ProfitEstimateResponse,
    ProfitMonth,
    SalesLine,
    TaxReturnListResponse,
    TaxReturnResponse,
    TaxReturnUpdate,
    TaxSettingsResponse,
    TaxSettingsUpdate,
    VatReturnResponse,
)

log = get_logger("nextdays.buchhaltung.steuer")

_ZWEI = Decimal("0.01")
_NEGATIVE_BELEGARTEN: frozenset[str] = frozenset({"storno", "credit_note"})
_RETURN_KIND = "vat"
_MAX_LISTE = 500
# PostgreSQL: undefined_table — die Ausgaben-Tabelle des Nachbar-Bereichs fehlt noch.
_PG_UNDEFINED_TABLE = "42P01"
# Ausgaben-Status, die als Eingangsbeleg zählen. `draft` nie; storniert nie.
_AUSGABEN_STATUS_AUS: frozenset[str] = frozenset({"draft", "cancelled", "rejected"})

# Steuerregel der Rechnung → Kategorie der neutralen Zeile.
_REGEL_KATEGORIE: dict[str, str] = {
    "DE_TAXABLE": "taxable",
    "DE_EXEMPT_4_USTG": "exempt",
    "DE_REVERSE_13B": "reverse_charge_domestic",
    "EU_REVERSE_18B": "reverse_charge_eu",
    "EU_INTRACOMMUNITY_SUPPLY": "intra_community_supply",
    "EU_OSS": "oss",
    "NON_EU_EXPORT": "export",
    "NON_EU_OUT_OF_SCOPE": "out_of_scope",
}

_STATUS_UEBERGAENGE: dict[str, frozenset[str]] = {
    "draft": frozenset({"draft", "submitted"}),
    "submitted": frozenset({"submitted"}),
    "corrected": frozenset({"corrected"}),
}


def _q(betrag: Decimal) -> Decimal:
    return betrag.quantize(_ZWEI, rounding=ROUND_HALF_UP)


def _dec(wert: object) -> Decimal:
    if wert is None or wert == "":
        return Decimal("0")
    return Decimal(str(wert))


def _satz(wert: object) -> Decimal | None:
    if wert is None or wert == "":
        return None
    return Decimal(str(wert)).normalize()


def _vorzeichen(row: dict, betrag: Decimal) -> Decimal:
    """Storno/Gutschrift zählen negativ — auch wenn die Zeile positiv gespeichert wurde."""
    if row.get("invoice_type") in _NEGATIVE_BELEGARTEN:
        return -abs(betrag)
    return betrag


class SteuerError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nicht_gefunden(was: str) -> SteuerError:
    return SteuerError(f"{was} nicht gefunden.", status_code=404)


def _periode(roh: str) -> Periode:
    try:
        return periode_parsen(roh)
    except PeriodeUngueltig as exc:
        raise SteuerError(str(exc), status_code=422) from exc


class _Sammler:
    """Summen je Schlüssel (Kategorie, Satz) mit Belegzähler."""

    def __init__(self) -> None:
        self.net: dict[tuple[str, Decimal | None], Decimal] = defaultdict(Decimal)
        self.tax: dict[tuple[str, Decimal | None], Decimal] = defaultdict(Decimal)
        self.count: dict[tuple[str, Decimal | None], set[str]] = defaultdict(set)

    def add(
        self, key: tuple[str, Decimal | None], beleg_id: str, net: Decimal, tax: Decimal
    ) -> None:
        self.net[key] += net
        self.tax[key] += tax
        self.count[key].add(beleg_id)

    def sales(self) -> list[SalesLine]:
        zeilen = [
            SalesLine(
                category=k[0],  # type: ignore[arg-type]
                tax_rate=k[1],
                net=_q(self.net[k]),
                tax=_q(self.tax[k]),
                invoice_count=len(self.count[k]),
            )
            for k in self.net
        ]
        return sorted(
            zeilen, key=lambda z: (z.category != "taxable", z.category, -(z.tax_rate or 0))
        )

    def input_tax(self) -> list[InputTaxLine]:
        zeilen = [
            InputTaxLine(
                tax_rate=k[1],
                net=_q(self.net[k]),
                tax=_q(self.tax[k]),
                expense_count=len(self.count[k]),
            )
            for k in self.net
        ]
        return sorted(zeilen, key=lambda z: -(z.tax_rate or 0))


class SteuerService:
    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    # ---------------------------------------------------------------- Stammdaten

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise SteuerError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _stammdaten(self, tenant_id: str) -> tuple[str, str, bool]:
        """(Land, Währung, Kleinunternehmer) aus `tenants` + `tenant_billing_profile`.
        Land/Währung fehlen → 422 (Wurzel 4: nie EUR/DE raten)."""
        rows = (
            self._db.table("tenants")
            .select("country, currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        tenant = rows[0] if rows else {}
        country = (tenant.get("country") or "").strip().upper()
        currency = (tenant.get("currency") or "").strip().upper()
        if not country or not currency:
            raise SteuerError(
                "Land oder Währung des Betriebs fehlen — bitte im Konto setzen.", status_code=422
            )
        profil = (
            self._db.table("tenant_billing_profile")
            .select("is_kleinunternehmer")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        klein = bool(profil and profil[0].get("is_kleinunternehmer"))
        return country, currency, klein

    # ------------------------------------------------------------ Umsatzseite

    def _rechnungen_laden(self, tenant_id: str, start: date, end: date) -> list[dict]:
        rows = (
            self._db.table("invoices")
            .select(
                "id, invoice_type, status, issue_date, net_amount, tax_amount, gross_amount, "
                "tax_rate, tax_rule, currency, original_invoice_id, is_kleinunternehmer"
            )
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .neq("status", "draft")
            .gte("issue_date", start.isoformat())
            .lte("issue_date", end.isoformat())
            .execute()
        ).data or []
        storniert = [r["id"] for r in rows if r.get("status") == "cancelled"]
        mit_storno: set[str] = set()
        if storniert:
            stornos = (
                self._db.table("invoices")
                .select("original_invoice_id")
                .eq("tenant_id", tenant_id)
                .eq("invoice_type", "storno")
                .in_("original_invoice_id", storniert)
                .execute()
            ).data or []
            mit_storno = {s["original_invoice_id"] for s in stornos if s.get("original_invoice_id")}
        return [r for r in rows if r.get("status") != "cancelled" or r["id"] in mit_storno]

    def _positionen_laden(self, invoice_ids: list[str]) -> dict[str, list[dict]]:
        if not invoice_ids:
            return {}
        rows = (
            self._db.table("invoice_line_items")
            .select("invoice_id, tax_rate, net_amount, tax_amount")
            .in_("invoice_id", invoice_ids)
            .execute()
        ).data or []
        je_rechnung: dict[str, list[dict]] = defaultdict(list)
        for r in rows:
            je_rechnung[r["invoice_id"]].append(r)
        return je_rechnung

    @staticmethod
    def _steuerpflichtig_sammeln(
        sammler: _Sammler, rechnung: dict, positionen: list[dict], warnungen: list[str]
    ) -> None:
        if positionen:
            for p in positionen:
                sammler.add(
                    ("taxable", _satz(p.get("tax_rate")) or Decimal("0")),
                    rechnung["id"],
                    _vorzeichen(rechnung, _dec(p.get("net_amount"))),
                    _vorzeichen(rechnung, _dec(p.get("tax_amount"))),
                )
            return
        net = _vorzeichen(rechnung, _dec(rechnung.get("net_amount")))
        tax = _vorzeichen(rechnung, _dec(rechnung.get("tax_amount")))
        satz = _satz(rechnung.get("tax_rate"))
        if satz is None and tax == 0:
            satz = Decimal("0")
        if satz is None:
            sammler.add(("undetermined", None), rechnung["id"], net, tax)
            warnungen.append(f"Beleg {rechnung['id']}: Steuer ohne Steuersatz — bitte prüfen.")
            return
        sammler.add(("taxable", satz), rechnung["id"], net, tax)

    def _umsatzzeilen(
        self, tenant_id: str, periode: Periode, currency: str, warnungen: list[str]
    ) -> list[SalesLine]:
        rechnungen = self._rechnungen_laden(tenant_id, periode.start, periode.end)
        _waehrungen_pruefen(rechnungen, currency, "Rechnungen")
        positionen = self._positionen_laden([r["id"] for r in rechnungen])
        sammler = _Sammler()
        for r in rechnungen:
            regel = (r.get("tax_rule") or "DE_TAXABLE").upper()
            kategorie = _REGEL_KATEGORIE.get(regel)
            if kategorie is None:
                sammler.add(
                    ("undetermined", None),
                    r["id"],
                    _vorzeichen(r, _dec(r.get("net_amount"))),
                    Decimal("0"),
                )
                warnungen.append(
                    f"Beleg {r['id']}: unbekannte Steuerregel »{regel}« — nicht zugeordnet."
                )
                continue
            if kategorie == "taxable":
                self._steuerpflichtig_sammeln(sammler, r, positionen.get(r["id"], []), warnungen)
                continue
            sammler.add(
                (kategorie, None), r["id"], _vorzeichen(r, _dec(r.get("net_amount"))), Decimal("0")
            )
        return sammler.sales()

    # ---------------------------------------------------------- Vorsteuerseite

    def _ausgaben_laden(
        self, tenant_id: str, start: date, end: date, warnungen: list[str]
    ) -> list[dict]:
        try:
            rows = (
                self._db.table("expenses")
                .select(
                    "id, expense_date, net_amount, tax_amount, gross_amount, tax_rate, "
                    "currency, status"
                )
                .eq("tenant_id", tenant_id)
                .gte("expense_date", start.isoformat())
                .lte("expense_date", end.isoformat())
                .execute()
            ).data or []
        except APIError as exc:
            if getattr(exc, "code", None) != _PG_UNDEFINED_TABLE:
                raise
            log.warning("steuer_ausgaben_tabelle_fehlt", tenant_id=tenant_id)
            warnungen.append(
                "Ausgaben-Tabelle noch nicht vorhanden (Bereich Ausgaben, Migration 0655) — "
                "Vorsteuer = 0."
            )
            return []
        return [r for r in rows if (r.get("status") or "") not in _AUSGABEN_STATUS_AUS]

    def _vorsteuerzeilen(
        self, tenant_id: str, periode: Periode, currency: str, warnungen: list[str]
    ) -> list[InputTaxLine]:
        ausgaben = self._ausgaben_laden(tenant_id, periode.start, periode.end, warnungen)
        _waehrungen_pruefen(ausgaben, currency, "Ausgaben")
        sammler = _Sammler()
        for a in ausgaben:
            tax = _dec(a.get("tax_amount"))
            satz = _satz(a.get("tax_rate"))
            if satz is None:
                satz = Decimal("0") if tax == 0 else None
            if satz is None:
                warnungen.append(f"Ausgabe {a['id']}: Vorsteuer ohne Steuersatz — bitte prüfen.")
            sammler.add(("input", satz), str(a["id"]), _dec(a.get("net_amount")), tax)
        return sammler.input_tax()

    # ------------------------------------------------------------- Auswertung

    def vat_return(self, ctx: AuthContext, period_raw: str) -> VatReturnResponse:
        tenant_id = self._tenant(ctx)
        periode = _periode(period_raw)
        country, currency, klein = self._stammdaten(tenant_id)
        warnungen: list[str] = []
        sales = self._umsatzzeilen(tenant_id, periode, currency, warnungen)
        input_tax = self._vorsteuerzeilen(tenant_id, periode, currency, warnungen)
        antwort = _antwort_bauen(periode, country, currency, klein, sales, input_tax, warnungen)
        letzte = self._letzte_version(tenant_id, periode.key)
        if letzte:
            antwort.frozen_version = int(letzte["version"])
        log.info(
            "steuer_auswertung",
            tenant_id=tenant_id,
            period=periode.key,
            country=country,
            currency=currency,
            payable=str(antwort.payable),
            warnungen=len(warnungen),
        )
        return antwort

    # ---------------------------------------------------------------- Meldungen

    def _letzte_version(self, tenant_id: str, period: str) -> dict | None:
        rows = (
            self._db.table("tax_returns")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("kind", _RETURN_KIND)
            .eq("period", period)
            .order("version", desc=True)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def freeze(self, ctx: AuthContext, body: FreezeRequest) -> TaxReturnResponse:
        tenant_id = self._tenant(ctx)
        live = self.vat_return(ctx, body.period)
        werte = _werte_json(live)
        mapping = {
            "scheme": live.mapping_scheme,
            "figures": [m.model_dump(mode="json") for m in live.mapping],
        }
        letzte = self._letzte_version(tenant_id, live.period)
        if letzte and letzte.get("status") == "draft":
            if letzte.get("values") == werte:
                log.info(
                    "steuer_freeze_idempotent",
                    tenant_id=tenant_id,
                    period=live.period,
                    return_id=letzte["id"],
                    version=letzte["version"],
                )
                return _return_response(letzte)
            return self._entwurf_aktualisieren(tenant_id, letzte, live, werte, mapping, body.note)
        version = int(letzte["version"]) + 1 if letzte else 1
        zeile = _return_zeile(tenant_id, ctx.user_id, live, werte, mapping, version, body.note)
        try:
            res = self._db.table("tax_returns").insert(zeile).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == "23505":
                # Paralleler Freeze hat dieselbe Version angelegt — den geben wir zurück.
                doppel = self._letzte_version(tenant_id, live.period)
                if doppel:
                    log.info("steuer_freeze_race", tenant_id=tenant_id, period=live.period)
                    return _return_response(doppel)
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise SteuerError("Meldung konnte nicht gespeichert werden.", status_code=500)
        if letzte and letzte.get("status") == "submitted":
            # Wurzel 1: die eingereichte Vorgängerversion ist jetzt korrigiert.
            self._db.table("tax_returns").update({"status": "corrected"}).eq("id", letzte["id"]).eq(
                "tenant_id", tenant_id
            ).execute()
        log.info(
            "steuer_freeze",
            tenant_id=tenant_id,
            period=live.period,
            return_id=neu["id"],
            version=version,
            payable=str(live.payable),
            currency=live.currency,
        )
        return _return_response(neu)

    def _entwurf_aktualisieren(
        self,
        tenant_id: str,
        entwurf: dict,
        live: VatReturnResponse,
        werte: dict,
        mapping: dict,
        note: str | None,
    ) -> TaxReturnResponse:
        patch = _return_zeile(tenant_id, None, live, werte, mapping, int(entwurf["version"]), note)
        for k in ("tenant_id", "kind", "period", "version", "created_by"):
            patch.pop(k, None)
        if note is None:
            patch.pop("note", None)
        res = (
            self._db.table("tax_returns")
            .update(patch)
            .eq("id", entwurf["id"])
            .eq("tenant_id", tenant_id)
            .execute()
        )
        neu = (res.data or [None])[0] or {**entwurf, **patch}
        log.info(
            "steuer_entwurf_aktualisiert",
            tenant_id=tenant_id,
            period=live.period,
            return_id=entwurf["id"],
            version=entwurf["version"],
        )
        return _return_response(neu)

    def list_returns(self, ctx: AuthContext, *, limit: int = 100) -> TaxReturnListResponse:
        tenant_id = self._tenant(ctx)
        limit = max(1, min(limit, _MAX_LISTE))
        rows = (
            self._db.table("tax_returns")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("period_start", desc=True)
            .order("version", desc=True)
            .limit(limit)
            .execute()
        ).data or []
        return TaxReturnListResponse(items=[_return_response(r) for r in rows], total=len(rows))

    def _eigene_meldung(self, tenant_id: str, return_id: str) -> dict:
        return load_scoped(
            self._db, "tax_returns", return_id, tenant_id, not_found=_nicht_gefunden("Meldung")
        )

    def get_return(self, ctx: AuthContext, return_id: str) -> TaxReturnResponse:
        return _return_response(self._eigene_meldung(self._tenant(ctx), return_id))

    def update_return(
        self, ctx: AuthContext, return_id: str, body: TaxReturnUpdate
    ) -> TaxReturnResponse:
        tenant_id = self._tenant(ctx)
        alt = self._eigene_meldung(tenant_id, return_id)
        patch: dict[str, Any] = {}
        if body.status is not None:
            if body.status not in RETURN_STATUSES:
                raise SteuerError("Unbekannter Status.", status_code=422)
            if body.status not in _STATUS_UEBERGAENGE[alt["status"]]:
                raise SteuerError(
                    f"Statuswechsel {alt['status']} → {body.status} nicht erlaubt.", status_code=409
                )
            patch["status"] = body.status
            if body.status == "submitted" and not alt.get("submitted_at"):
                patch["submitted_at"] = (body.submitted_at or datetime.now(UTC)).isoformat()
        if body.submitted_at is not None:
            patch["submitted_at"] = body.submitted_at.isoformat()
        if body.note is not None:
            patch["note"] = body.note
        if not patch:
            return _return_response(alt)
        res = (
            self._db.table("tax_returns")
            .update(patch)
            .eq("id", return_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        neu = (res.data or [None])[0] or {**alt, **patch}
        log.info(
            "steuer_meldung_geaendert",
            tenant_id=tenant_id,
            return_id=return_id,
            patch=sorted(patch),
        )
        return _return_response(neu)

    # ------------------------------------------------------------------ Export

    def export_json(self, ctx: AuthContext, return_id: str) -> dict:
        return _return_response(self._eigene_meldung(self._tenant(ctx), return_id)).model_dump(
            mode="json"
        )

    def export_csv(self, ctx: AuthContext, return_id: str) -> tuple[str, str]:
        """(Dateiname, CSV) — Semikolon-getrennt, UTF-8 mit BOM (Tabellenkalkulationen
        in DE/DK/AT öffnen es dann direkt richtig)."""
        m = self._eigene_meldung(self._tenant(ctx), return_id)
        puffer = io.StringIO()
        w = csv.writer(puffer, delimiter=";", lineterminator="\r\n")
        w.writerow(
            ["section", "code", "label", "category", "taxRate", "net", "tax", "amount", "currency"]
        )
        werte = m.get("values") or {}
        for z in werte.get("sales", []):
            w.writerow(
                [
                    "sales",
                    "",
                    "",
                    z.get("category"),
                    z.get("taxRate") or "",
                    z.get("net"),
                    z.get("tax"),
                    "",
                    m["currency"],
                ]
            )
        for z in werte.get("inputTax", []):
            w.writerow(
                [
                    "inputTax",
                    "",
                    "",
                    "input",
                    z.get("taxRate") or "",
                    z.get("net"),
                    z.get("tax"),
                    "",
                    m["currency"],
                ]
            )
        w.writerow(
            [
                "result",
                "",
                "payable",
                "",
                "",
                werte.get("salesNetTotal"),
                werte.get("salesTaxTotal"),
                werte.get("payable"),
                m["currency"],
            ]
        )
        for f in (m.get("mapping") or {}).get("figures", []):
            w.writerow(
                [
                    "mapping",
                    f.get("code"),
                    f.get("label"),
                    f.get("kind"),
                    "",
                    "",
                    "",
                    f.get("amount"),
                    m["currency"],
                ]
            )
        name = f"umsatzsteuer-{m['period']}-v{m['version']}.csv"
        log.info("steuer_export_csv", tenant_id=m["tenant_id"], return_id=return_id)
        return name, "﻿" + puffer.getvalue()

    # ------------------------------------------------------------- EÜR-Vorschau

    def profit_estimate(self, ctx: AuthContext, year: int) -> ProfitEstimateResponse:
        tenant_id = self._tenant(ctx)
        periode = _periode(str(year))
        _, currency, _ = self._stammdaten(tenant_id)
        warnungen: list[str] = []
        einnahmen: dict[int, Decimal] = defaultdict(Decimal)
        rechnungen = self._rechnungen_laden(tenant_id, periode.start, periode.end)
        _waehrungen_pruefen(rechnungen, currency, "Rechnungen")
        for r in rechnungen:
            einnahmen[_monat(r.get("issue_date"))] += _vorzeichen(r, _dec(r.get("net_amount")))
        ausgaben: dict[int, Decimal] = defaultdict(Decimal)
        for a in self._ausgaben_laden(tenant_id, periode.start, periode.end, warnungen):
            ausgaben[_monat(a.get("expense_date"))] += _dec(a.get("net_amount"))
        einstellungen = self._settings_row(tenant_id)
        satz = _gesamtsatz(einstellungen)
        return _profit_bauen(year, currency, einnahmen, ausgaben, satz, einstellungen, warnungen)

    # ------------------------------------------------------------ Einstellungen

    def _settings_row(self, tenant_id: str) -> dict:
        rows = (
            self._db.table("tax_settings").select("*").eq("tenant_id", tenant_id).limit(1).execute()
        ).data or []
        return rows[0] if rows else {}

    def get_settings(self, ctx: AuthContext) -> TaxSettingsResponse:
        tenant_id = self._tenant(ctx)
        country, currency, klein = self._stammdaten(tenant_id)
        return _settings_response(self._settings_row(tenant_id), country, currency, klein)

    def put_settings(self, ctx: AuthContext, body: TaxSettingsUpdate) -> TaxSettingsResponse:
        tenant_id = self._tenant(ctx)
        country, currency, klein = self._stammdaten(tenant_id)
        zeile = {
            "tenant_id": tenant_id,
            "income_tax_rate": _str_or_none(body.income_tax_rate),
            "trade_tax_rate": _str_or_none(body.trade_tax_rate),
            "vat_period": body.vat_period,
            "reserve_rate": _str_or_none(body.reserve_rate),
            "note": body.note,
        }
        res = self._db.table("tax_settings").upsert(zeile, on_conflict="tenant_id").execute()
        neu = (res.data or [None])[0] or zeile
        log.info(
            "steuer_einstellungen_gespeichert",
            tenant_id=tenant_id,
            income_tax_rate=zeile["income_tax_rate"],
            vat_period=zeile["vat_period"],
        )
        return _settings_response(neu, country, currency, klein)


# ---------------------------------------------------------------- Modul-Helfer


def _waehrungen_pruefen(rows: list[dict], currency: str, was: str) -> None:
    fremd = sorted({(r.get("currency") or "—").upper() for r in rows} - {currency})
    if fremd:
        raise SteuerError(
            f"{was} in anderer Währung als die Mandantenwährung {currency}: {', '.join(fremd)}. "
            "Die Auswertung addiert keine Währungen — bitte Belege prüfen.",
            status_code=422,
        )


def _antwort_bauen(
    periode: Periode,
    country: str,
    currency: str,
    klein: bool,
    sales: list[SalesLine],
    input_tax: list[InputTaxLine],
    warnungen: list[str],
) -> VatReturnResponse:
    sales_net = _q(sum((z.net for z in sales), Decimal("0")))
    sales_tax = _q(sum((z.tax for z in sales), Decimal("0")))
    vorsteuer = _q(sum((z.tax for z in input_tax), Decimal("0")))
    payable = _q(sales_tax - vorsteuer)
    mapping: list[MappedFigure] = []
    scheme: str | None = None
    if country == de_ustva.COUNTRY:
        scheme = de_ustva.SCHEME
        mapping, mehr = de_ustva.kennzahlen(sales, input_tax, payable=payable, small_business=klein)
        warnungen.extend(mehr)
    elif klein:
        warnungen.append(
            "Kleinunternehmer-Regelung aktiv — die Umsatzsteuer-Meldung entfällt in der Regel."
        )
    return VatReturnResponse(
        period=periode.key,
        period_kind=periode.kind,
        period_start=periode.start,
        period_end=periode.end,  # type: ignore[arg-type]
        country=country,
        currency=currency,
        small_business=klein,
        sales=sales,
        input_tax=input_tax,
        sales_net_total=sales_net,
        sales_tax_total=sales_tax,
        input_tax_total=vorsteuer,
        payable=payable,
        mapping_scheme=scheme,
        mapping=mapping,
        warnings=warnungen,
    )


def _werte_json(live: VatReturnResponse) -> dict:
    return {
        "sales": [z.model_dump(mode="json") for z in live.sales],
        "inputTax": [z.model_dump(mode="json") for z in live.input_tax],
        "salesNetTotal": str(live.sales_net_total),
        "salesTaxTotal": str(live.sales_tax_total),
        "inputTaxTotal": str(live.input_tax_total),
        "payable": str(live.payable),
        "warnings": list(live.warnings),
    }


def _return_zeile(
    tenant_id: str,
    user_id: str | None,
    live: VatReturnResponse,
    werte: dict,
    mapping: dict,
    version: int,
    note: str | None,
) -> dict:
    return {
        "tenant_id": tenant_id,
        "kind": _RETURN_KIND,
        "period": live.period,
        "period_kind": live.period_kind,
        "period_start": live.period_start.isoformat(),
        "period_end": live.period_end.isoformat(),
        "version": version,
        "status": "draft",
        "country": live.country,
        "currency": live.currency,
        "small_business": live.small_business,
        "values": werte,
        "mapping": mapping,
        "sales_net_total": str(live.sales_net_total),
        "sales_tax_total": str(live.sales_tax_total),
        "input_tax_total": str(live.input_tax_total),
        "payable": str(live.payable),
        "note": note,
        "created_by": user_id,
    }


def _return_response(row: dict) -> TaxReturnResponse:
    return TaxReturnResponse(
        id=str(row["id"]),
        period=row["period"],
        period_kind=row["period_kind"],
        period_start=row["period_start"],
        period_end=row["period_end"],
        version=int(row["version"]),
        status=row["status"],
        country=row["country"],
        currency=row["currency"],
        small_business=bool(row.get("small_business")),
        values=row.get("values") or {},
        mapping=row.get("mapping") or {},
        sales_net_total=_dec(row.get("sales_net_total")),
        sales_tax_total=_dec(row.get("sales_tax_total")),
        input_tax_total=_dec(row.get("input_tax_total")),
        payable=_dec(row.get("payable")),
        submitted_at=row.get("submitted_at"),
        note=row.get("note"),
        created_at=row.get("created_at") or datetime.now(UTC),
        updated_at=row.get("updated_at") or row.get("created_at") or datetime.now(UTC),
    )


def _monat(datum: object) -> int:
    return int(str(datum)[5:7])


def _str_or_none(wert: Decimal | None) -> str | None:
    return None if wert is None else str(wert)


def _gesamtsatz(einstellungen: dict) -> Decimal | None:
    """Ertrag- + Gewerbe-/Kommunalsteuer; None, wenn der Ertragsatz fehlt (keine Schätzung)."""
    if einstellungen.get("income_tax_rate") in (None, ""):
        return None
    return _dec(einstellungen.get("income_tax_rate")) + _dec(einstellungen.get("trade_tax_rate"))


def _profit_bauen(
    year: int,
    currency: str,
    einnahmen: dict[int, Decimal],
    ausgaben: dict[int, Decimal],
    satz: Decimal | None,
    einstellungen: dict,
    warnungen: list[str],
) -> ProfitEstimateResponse:
    monate: list[ProfitMonth] = []
    kumuliert = Decimal("0")
    for m in range(1, 13):
        e, a = _q(einnahmen.get(m, Decimal("0"))), _q(ausgaben.get(m, Decimal("0")))
        gewinn = _q(e - a)
        kumuliert = _q(kumuliert + gewinn)
        steuer = (
            _q(max(kumuliert, Decimal("0")) * satz / Decimal(100)) if satz is not None else None
        )
        monate.append(
            ProfitMonth(
                month=m,
                income_net=e,
                expenses_net=a,
                profit=gewinn,
                cumulative_profit=kumuliert,
                estimated_tax=steuer,
            )
        )
    e_sum = _q(sum((x.income_net for x in monate), Decimal("0")))
    a_sum = _q(sum((x.expenses_net for x in monate), Decimal("0")))
    gewinn_sum = _q(e_sum - a_sum)
    steuer_sum = (
        _q(max(gewinn_sum, Decimal("0")) * satz / Decimal(100)) if satz is not None else None
    )
    ruecklage = None
    if steuer_sum is not None and einstellungen.get("reserve_rate") not in (None, ""):
        ruecklage = _q(steuer_sum * _dec(einstellungen["reserve_rate"]) / Decimal(100))
    if satz is None:
        warnungen.append(
            "Kein Ertragsteuersatz hinterlegt — die Vorschau zeigt Einnahmen und Ausgaben, "
            "aber keine Steuerschätzung."
        )
    return ProfitEstimateResponse(
        year=year,
        currency=currency,
        months=monate,
        income_net_total=e_sum,
        expenses_net_total=a_sum,
        profit_total=gewinn_sum,
        estimated_tax_total=steuer_sum,
        estimated_reserve=ruecklage,
        tax_rate_total=satz,
        settings_complete=satz is not None,
        warnings=warnungen,
    )


def _settings_response(row: dict, country: str, currency: str, klein: bool) -> TaxSettingsResponse:
    return TaxSettingsResponse(
        income_tax_rate=_satz(row.get("income_tax_rate")),
        trade_tax_rate=_satz(row.get("trade_tax_rate")),
        vat_period=row.get("vat_period"),
        reserve_rate=_satz(row.get("reserve_rate")),
        note=row.get("note"),
        country=country,
        currency=currency,
        small_business=klein,
        configured=row.get("income_tax_rate") not in (None, ""),
        updated_at=row.get("updated_at"),
    )
