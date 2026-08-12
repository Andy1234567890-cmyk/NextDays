"""Empfänger-Übersicht und wiederkehrende Posten.

Zwei Dinge, die zum Reporting gehören, aber weder Bericht noch Zahlung sind:

* Die **Empfänger-Übersicht** — wer bekommt Geld, wie viel bisher (je Währung
  getrennt) und gilt für ihn heute ein Abrechnungsvertrag. Sie beantwortet die
  Frage VOR dem Erzeugen einer Zahlung; ohne Vertrag ist keine berechenbar.
* Die **wiederkehrenden Posten** — die Dauervereinbarung je Empfänger
  („Willkommensgebühr 50 je Buchung"). Abgegrenzt von ``owner_expenses``: das
  sind Einzelfälle mit Datum und Beleg, hier steht die Regel.

Beide Bereiche lesen nur eigene Tabellen und brauchen die Auswertungskette
nicht — deshalb ein eigenes Modul und nicht noch ein Abschnitt im Service.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any, Protocol

from supabase import Client

from src.core.supabase import fetch_all_rows, load_scoped

from .auswertung import NULL, d, f, iso
from .fehler import ReportingError
from .schemas import (
    Abschnitt,
    EmpfaengerListResponse,
    EmpfaengerZeile,
    RecurringItemCreate,
    RecurringItemListResponse,
    RecurringItemResponse,
    RecurringItemUpdate,
    WaehrungsBetrag,
)


class Scope(Protocol):
    """Die Scope-Prüfungen, die dieses Modul vom Service erbt.

    Als Protocol und nicht als Import des Service: sonst importierten sich
    beide Module gegenseitig. Wichtiger noch — so ist im Code sichtbar, dass
    dieses Modul den Mandanten-Scope NICHT selbst erfindet, sondern genau die
    zwei Prüfungen benutzt, die der Service für alle Pfade führt (Wurzel 3).
    """

    def own_owner(self, tenant_id: str, owner_id: str) -> dict[str, Any]: ...

    def pruefe_objekte(
        self, tenant_id: str, property_ids: list[str]
    ) -> list[str]: ...


class EmpfaengerService:
    """Empfänger-Übersicht + CRUD der wiederkehrenden Posten."""

    def __init__(self, service_client: Client, scope: Scope) -> None:
        self._db = service_client
        self._owner = scope


    def list_empfaenger(self, tenant_id: str) -> EmpfaengerListResponse:
        owners = fetch_all_rows(
            self._db.table("owners")
            .select("id, name, email")
            .eq("tenant_id", tenant_id)
            .order("name")
        )
        owner_ids = [str(o["id"]) for o in owners]
        objekte: dict[str, int] = defaultdict(int)
        if owner_ids:
            for r in fetch_all_rows(
                self._db.table("owner_properties")
                .select("owner_id, property_id")
                .in_("owner_id", owner_ids)
                .order("owner_id")
            ):
                objekte[str(r["owner_id"])] += 1
        zahlungen: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for p in fetch_all_rows(
            self._db.table("owner_report_payments")
            .select("owner_id, betrag, currency")
            .eq("tenant_id", tenant_id)
            .order("owner_id")
        ):
            zahlungen[str(p["owner_id"])].append(p)
        mit_vertrag = self._owner_mit_vertrag(tenant_id, date.today())

        items: list[EmpfaengerZeile] = []
        for o in owners:
            oid = str(o["id"])
            je_waehrung: dict[str, Decimal] = defaultdict(lambda: NULL)
            for p in zahlungen.get(oid, []):
                je_waehrung[str(p["currency"])] += d(p["betrag"])
            items.append(
                EmpfaengerZeile(
                    owner_id=oid,
                    name=str(o.get("name") or ""),
                    email=iso(o.get("email")),
                    payment_count=len(zahlungen.get(oid, [])),
                    payment_total=[
                        WaehrungsBetrag(currency=c, amount=f(v))
                        for c, v in sorted(je_waehrung.items())
                    ],
                    property_count=objekte.get(oid, 0),
                    hat_vertrag=oid in mit_vertrag,
                )
            )
        return EmpfaengerListResponse(items=items, total=len(items))

    def _owner_mit_vertrag(self, tenant_id: str, stichtag: date) -> set[str]:
        """Welche Eigentümer haben am Stichtag einen gültigen Vertrag?

        Halb offenes Intervall ``[ab, bis)`` — dieselbe Auslegung wie in
        ``OwnerBillingService.vertrag_aufloesen``; sie hier anders zu lesen
        ergäbe für denselben Tag zwei verschiedene Aussagen.
        """
        rows = fetch_all_rows(
            self._db.table("owner_billing_terms")
            .select("owner_id, gueltig_ab, gueltig_bis")
            .eq("tenant_id", tenant_id)
            .lte("gueltig_ab", stichtag.isoformat())
            .order("owner_id")
        )
        out: set[str] = set()
        for r in rows:
            bis = r.get("gueltig_bis")
            if bis and date.fromisoformat(str(bis)) <= stichtag:
                continue
            out.add(str(r["owner_id"]))
        return out

    # ==================================================================
    # F) Wiederkehrende Posten
    # ==================================================================

    def list_recurring(
        self, tenant_id: str, owner_id: str
    ) -> RecurringItemListResponse:
        self._owner.own_owner(tenant_id, owner_id)
        rows = fetch_all_rows(
            self._db.table("owner_recurring_items")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .order("created_at")
            .order("id")
        )
        return RecurringItemListResponse(
            items=[self._recurring_row(r) for r in rows]
        )

    @staticmethod
    def _recurring_row(row: dict[str, Any]) -> RecurringItemResponse:
        return RecurringItemResponse(
            id=str(row["id"]),
            owner_id=str(row["owner_id"]),
            label=str(row["label"]),
            abschnitt=Abschnitt(str(row["abschnitt"])),
            modus=row["modus"],
            betrag=float(row["betrag"]),
            currency=str(row["currency"]),
            property_id=iso(row.get("property_id")),
            aktiv=bool(row["aktiv"]),
            notiz=iso(row.get("notiz")),
            created_at=iso(row.get("created_at")),
            updated_at=iso(row.get("updated_at")),
        )

    def create_recurring(
        self,
        tenant_id: str,
        owner_id: str,
        req: RecurringItemCreate,
        *,
        user_id: str,
    ) -> RecurringItemResponse:
        self._owner.own_owner(tenant_id, owner_id)
        if req.property_id:
            self._owner.pruefe_objekte(tenant_id, [req.property_id])
        row = (
            self._db.table("owner_recurring_items")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "owner_id": owner_id,
                    "label": req.label.strip(),
                    "abschnitt": req.abschnitt.value,
                    "modus": req.modus.value,
                    "betrag": req.betrag,
                    "currency": req.currency,
                    "property_id": req.property_id,
                    "aktiv": req.aktiv,
                    "notiz": req.notiz,
                    "erstellt_von": user_id,
                }
            )
            .execute()
        ).data[0]
        return self._recurring_row(row)

    def update_recurring(
        self, tenant_id: str, item_id: str, req: RecurringItemUpdate
    ) -> RecurringItemResponse:
        load_scoped(
            self._db,
            "owner_recurring_items",
            item_id,
            tenant_id,
            columns="id",
            not_found=ReportingError("Posten nicht gefunden.", status_code=404),
        )
        patch: dict[str, Any] = {"updated_at": "now()"}
        if req.label is not None:
            patch["label"] = req.label.strip()
        if req.abschnitt is not None:
            if req.abschnitt is Abschnitt.steuern:
                raise ReportingError(
                    "Steuern sind kein wiederkehrender Posten.", status_code=422
                )
            patch["abschnitt"] = req.abschnitt.value
        if req.modus is not None:
            patch["modus"] = req.modus.value
        if req.betrag is not None:
            patch["betrag"] = req.betrag
        if req.currency is not None:
            patch["currency"] = req.currency
        if req.aktiv is not None:
            patch["aktiv"] = req.aktiv
        if req.notiz is not None:
            patch["notiz"] = req.notiz
        if req.fuer_alle_objekte:
            patch["property_id"] = None
        elif req.property_id is not None:
            self._owner.pruefe_objekte(tenant_id, [req.property_id])
            patch["property_id"] = req.property_id
        row = (
            self._db.table("owner_recurring_items")
            .update(patch)
            .eq("id", item_id)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data[0]
        return self._recurring_row(row)

    def delete_recurring(self, tenant_id: str, item_id: str) -> None:
        load_scoped(
            self._db,
            "owner_recurring_items",
            item_id,
            tenant_id,
            columns="id",
            not_found=ReportingError("Posten nicht gefunden.", status_code=404),
        )
        self._db.table("owner_recurring_items").delete().eq("id", item_id).eq(
            "tenant_id", tenant_id
        ).execute()
