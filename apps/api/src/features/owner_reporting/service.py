"""Service des owner_reporting-Slice — Bericht · Zahlung · Plan · Statistik.

Die Rechenkette wird hier NICHT neu erfunden. Jede Zahl über Geld entsteht in
``owner_statements.common`` (Portal-Abzug → provisionsfreie Gebühren raus →
Verwaltungsprovision → Pauschale → Eigentümer-Gebühren zurück); dieser Slice
gruppiert das Ergebnis nur anders: nach Objekt, nach Gebührenart, nach Kanal.
Eine zweite Formel hier hieße, dass Abrechnung und Bericht über denselben
Zeitraum verschiedene Beträge zeigen — der Fehler, den niemand als Bug erkennt,
weil beide Zahlen plausibel aussehen.

MEHRWÄHRUNG: Ein Bericht hat GENAU EINE Währung. Buchungen in einer anderen
Währung werden mit dem ECB-Tageskurs am Stichtag der Buchung umgerechnet
(``owner_statements.fx``, derselbe Dienst und derselbe Cache wie die
Abrechnung). Lässt sich ein Kurs nicht beschaffen, fällt die Zeile mit einer
benannten Warnung heraus — es wird NIE mit Kurs 1,0 weitergerechnet (Wurzel 4).

WARNUNGEN STATT STILLER LÜCKEN: Fehlt einer Buchung der Provisionssatz, ist
eine Gebührenart nicht zugeordnet oder fehlt ein Kurs, wird die Buchung nicht
kommentarlos übersprungen. Sie erscheint in ``warnungen`` mit Grund; die Maske
zeigt das an. Ein stiller Ausschluss ergäbe eine Summe, die zu niedrig, aber
nummeriert und damit unverdächtig ist (Wurzel 5).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows, load_scoped
from src.features.properties.gebuehren import FEE_TYPE_LABEL

from . import perioden
from .auswertung import (
    Auswerter,
    Auswertung,
    d,
    f,
    f_opt,
    iso,
    summe_opt,
)
from .empfaenger import EmpfaengerService
from .fehler import ReportingError
from .rollen import nur_eigene_berichte, verbiete_eigentuemer_schreiben
from .schemas import (
    Abschnitt,
    AmTag,
    BuchungPosten,
    BuchungsAufschluesselung,
    BuchungZeile,
    EmpfaengerListResponse,
    PaymentCreate,
    PaymentDetail,
    PaymentItem,
    PaymentListItem,
    PaymentListResponse,
    PaymentPart,
    PaymentPartCreate,
    PaymentUpdate,
    PlanZeitraum,
    RecurringItemCreate,
    RecurringItemListResponse,
    RecurringItemResponse,
    RecurringItemUpdate,
    ReportBasis,
    ReportCreate,
    ReportDetail,
    ReportListItem,
    ReportListResponse,
    ReportSummary,
    ReportUpdate,
    Rhythmus,
    ScheduleCreate,
    ScheduleListItem,
    ScheduleListResponse,
    ScheduleResponse,
    ScheduleRunResponse,
    ScheduleUpdate,
    SliceHealth,
    StatistikResponse,
    ZahlungsUebersicht,
)
from .statistik import StatistikRechner

log = get_logger("nextdays.owner_reporting")

_CENT = Decimal("0.01")
_NULL = Decimal("0")

_REPORT_COLUMNS = (
    "id, tenant_id, name, currency, period_from, period_to, basis, "
    "reservation_statuses, schedule_id, created_at, updated_at"
)
_SCHEDULE_COLUMNS = (
    "id, tenant_id, name, name_mit_datum, aktiv, rhythmus, am_tag, zeitraum, "
    "currency, basis, zuletzt_erzeugt_fuer, created_at, updated_at"
)
_PAYMENT_COLUMNS = (
    "id, tenant_id, report_id, owner_id, currency, summe_unterkunftspreis, "
    "summe_gebuehren, summe_steuern, summe_ausgaben, summe_andere, betrag, "
    "bezahlt_am, notiz, statement_id, created_at, updated_at"
)


class OwnerReportingService:  # pylint: disable=too-many-public-methods
    """Berichte, Zahlungen, Pläne und Statistik des Eigentümer-Reportings."""

    slice_name = "owner_reporting"

    def __init__(self, service_client: Client) -> None:
        self._db = service_client
        self._auswerter = Auswerter(service_client=service_client)
        self._statistik = StatistikRechner(service_client=service_client)
        self._empfaenger = EmpfaengerService(
            service_client=service_client, scope=self
        )

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    # ==================================================================
    # Scope-Helfer (Wurzel 3 / Wurzel 9)
    # ==================================================================

    def _tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ReportingError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _own_report(self, tenant_id: str, report_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db,
            "owner_reports",
            report_id,
            tenant_id,
            columns=_REPORT_COLUMNS,
            not_found=ReportingError("Bericht nicht gefunden.", status_code=404),
        )

    def _own_payment(self, tenant_id: str, payment_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db,
            "owner_report_payments",
            payment_id,
            tenant_id,
            columns=_PAYMENT_COLUMNS,
            not_found=ReportingError("Zahlung nicht gefunden.", status_code=404),
        )

    def _own_schedule(self, tenant_id: str, schedule_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db,
            "owner_report_schedules",
            schedule_id,
            tenant_id,
            columns=_SCHEDULE_COLUMNS,
            not_found=ReportingError(
                "Geplanter Bericht nicht gefunden.", status_code=404
            ),
        )

    def own_owner(self, tenant_id: str, owner_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db,
            "owners",
            owner_id,
            tenant_id,
            columns=(
                "id, name, email, iban, bic, bank_name, account_holder, "
                "tax_id, vat_id, phone, notes"
            ),
            not_found=ReportingError(
                "Empfänger nicht gefunden.", status_code=404
            ),
        )

    def pruefe_objekte(self, tenant_id: str, property_ids: list[str]) -> list[str]:
        """Nur Objekte DIESES Betriebs zulassen (Wurzel 3).

        Eine fremde ID still zu verwerfen wäre der bequeme Weg — dann stünde
        aber ein Bericht über „10 Objekte" da, der nur 9 auswertet.
        """
        ids = sorted(set(property_ids))
        if not ids:
            raise ReportingError("Mindestens ein Objekt auswählen.", status_code=422)
        rows = fetch_all_rows(
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .order("id")
        )
        gefunden = {str(r["id"]) for r in rows}
        fehlend = [i for i in ids if i not in gefunden]
        if fehlend:
            raise ReportingError(
                f"{len(fehlend)} ausgewählte Objekte gehören nicht zu diesem "
                "Konto.",
                status_code=404,
            )
        return ids

    # ==================================================================
    # A) Bericht — CRUD
    # ==================================================================

    def _report_property_ids(self, report_ids: list[str]) -> dict[str, list[str]]:
        if not report_ids:
            return {}
        rows = fetch_all_rows(
            self._db.table("owner_report_properties")
            .select("report_id, property_id")
            .in_("report_id", sorted(set(report_ids)))
            .order("report_id")
        )
        out: dict[str, list[str]] = defaultdict(list)
        for r in rows:
            out[str(r["report_id"])].append(str(r["property_id"]))
        return out

    def list_reports(self, ctx: AuthContext) -> ReportListResponse:
        tenant_id = self._tenant(ctx)
        rows = fetch_all_rows(
            self._db.table("owner_reports")
            .select(_REPORT_COLUMNS)
            .eq("tenant_id", tenant_id)
            .order("period_from", desc=True)
            .order("id")
        )
        objekte = self._report_property_ids([str(r["id"]) for r in rows])
        # Eigentümer sehen nur Berichte, die MINDESTENS EIN eigenes Objekt
        # betreffen (§4.2). Vorher war die Liste rein tenant-gescopt: ein
        # Eigentümer hätte die Auswertung ALLER Eigentümer des Betriebs gesehen,
        # inklusive fremder Auszahlungsbeträge. Gefiltert wird über dieselbe
        # Zuordnung wie in den übrigen Slices (`owner_property_assignments`).
        rows = nur_eigene_berichte(self._db, ctx, rows, objekte)
        zahlungen: dict[str, int] = defaultdict(int)
        for p in fetch_all_rows(
            self._db.table("owner_report_payments")
            .select("id, report_id")
            .eq("tenant_id", tenant_id)
            .order("id")
        ):
            zahlungen[str(p["report_id"])] += 1
        items = [
            ReportListItem(
                id=str(r["id"]),
                name=str(r["name"]),
                currency=str(r["currency"]),
                period_from=date.fromisoformat(str(r["period_from"])),
                period_to=date.fromisoformat(str(r["period_to"])),
                property_count=len(objekte.get(str(r["id"]), [])),
                auto_generated=bool(r.get("schedule_id")),
                schedule_id=iso(r.get("schedule_id")),
                payment_count=zahlungen.get(str(r["id"]), 0),
                created_at=iso(r.get("created_at")),
            )
            for r in rows
        ]
        return ReportListResponse(items=items, total=len(items))

    def create_report(self, ctx: AuthContext, req: ReportCreate) -> ReportDetail:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        ids = self.pruefe_objekte(tenant_id, req.property_ids)
        row = (
            self._db.table("owner_reports")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "name": req.name.strip(),
                    "currency": req.currency,
                    "period_from": req.period_from.isoformat(),
                    "period_to": req.period_to.isoformat(),
                    "basis": req.basis.value,
                    "reservation_statuses": req.reservation_statuses,
                    "erstellt_von": ctx.user_id,
                }
            )
            .execute()
        ).data[0]
        self._db.table("owner_report_properties").insert(
            [{"report_id": str(row["id"]), "property_id": p} for p in ids]
        ).execute()
        return self.get_report(ctx, str(row["id"]))

    def update_report(
        self, ctx: AuthContext, report_id: str, req: ReportUpdate
    ) -> ReportDetail:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        row = self._own_report(tenant_id, report_id)
        patch: dict[str, Any] = {}
        if req.name is not None:
            patch["name"] = req.name.strip()
        if req.currency is not None:
            patch["currency"] = req.currency
        if req.period_from is not None:
            patch["period_from"] = req.period_from.isoformat()
        if req.period_to is not None:
            patch["period_to"] = req.period_to.isoformat()
        if req.basis is not None:
            patch["basis"] = req.basis.value
        if req.reservation_statuses is not None:
            patch["reservation_statuses"] = req.reservation_statuses
        von = req.period_from or date.fromisoformat(str(row["period_from"]))
        bis = req.period_to or date.fromisoformat(str(row["period_to"]))
        if bis < von:
            raise ReportingError(
                "„Bis“ darf nicht vor „Von“ liegen.", status_code=422
            )
        if patch:
            patch["updated_at"] = "now()"
            self._db.table("owner_reports").update(patch).eq("id", report_id).eq(
                "tenant_id", tenant_id
            ).execute()
        if req.property_ids is not None:
            ids = self.pruefe_objekte(tenant_id, req.property_ids)
            # Alt/Neu-Diff über die einfachste ehrliche Form: die Zuordnung des
            # Berichts komplett ersetzen. Ein Teil-Update müsste den Gegenzustand
            # (entfernte Objekte) selbst pflegen (Wurzel 1) — die Tabelle hat
            # keine weiteren Spalten, also ist Ersetzen verlustfrei.
            self._db.table("owner_report_properties").delete().eq(
                "report_id", report_id
            ).execute()
            self._db.table("owner_report_properties").insert(
                [{"report_id": report_id, "property_id": p} for p in ids]
            ).execute()
        return self.get_report(ctx, report_id)

    def delete_report(self, ctx: AuthContext, report_id: str) -> None:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        self._own_report(tenant_id, report_id)
        # Eine bereits erzeugte Zahlung ist eine Forderung mit eigenem Beleg.
        # Sie mit dem Bericht wegzuräumen (cascade) hieße, Geldbewegungen
        # stillschweigend zu löschen — deshalb blockiert der Service das hier,
        # obwohl die DB es zuließe.
        offene = (
            self._db.table("owner_report_payments")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("report_id", report_id)
            .limit(1)
            .execute()
        ).data or []
        if offene:
            raise ReportingError(
                "Zu diesem Bericht bestehen Zahlungen. Erst die Zahlungen "
                "löschen, dann den Bericht.",
                status_code=409,
            )
        self._db.table("owner_reports").delete().eq("id", report_id).eq(
            "tenant_id", tenant_id
        ).execute()

    # ==================================================================
    # C) Bericht — Detail + Aufschlüsselungen
    # ==================================================================

    def get_report(self, ctx: AuthContext, report_id: str) -> ReportDetail:
        tenant_id = self._tenant(ctx)
        row = self._own_report(tenant_id, report_id)
        property_ids = self._report_property_ids([report_id]).get(report_id, [])
        currency = str(row["currency"])
        erg = self._auswerter.auswerten(
            tenant_id,
            property_ids=property_ids,
            period_from=date.fromisoformat(str(row["period_from"])),
            period_to=date.fromisoformat(str(row["period_to"])),
            basis=str(row["basis"]),
            statuses=list(row.get("reservation_statuses") or []),
            currency=currency,
        )

        summary = ReportSummary(
            currency=currency,
            income=f_opt(summe_opt([b.einnahmen for b in erg.buchungen])),
            rent=f(sum((b.miete for b in erg.buchungen), _NULL)),
            fees=f(sum((b.gebuehren_summe for b in erg.buchungen), _NULL)),
            addons=f(sum((b.addons for b in erg.buchungen), _NULL)),
            taxes=f(sum((b.steuern for b in erg.buchungen), _NULL)),
            channel_commission=f_opt(
                summe_opt([b.portal_abzug_gesamt for b in erg.buchungen])
            ),
            bookings=len(erg.buchungen),
            nights=sum(b.naechte for b in erg.buchungen),
            guests=sum(b.gaeste for b in erg.buchungen),
        )

        belegte = {str(b.row["property_id"]) for b in erg.buchungen}
        return ReportDetail(
            id=report_id,
            tenant_id=tenant_id,
            name=str(row["name"]),
            currency=currency,
            period_from=date.fromisoformat(str(row["period_from"])),
            period_to=date.fromisoformat(str(row["period_to"])),
            basis=ReportBasis(str(row["basis"])),
            reservation_statuses=list(row.get("reservation_statuses") or []),
            property_ids=property_ids,
            auto_generated=bool(row.get("schedule_id")),
            schedule_id=iso(row.get("schedule_id")),
            summary=summary,
            payments_summary=self._zahlungs_uebersicht(
                tenant_id, report_id, currency
            ),
            rent_rows=self._auswerter.miet_zeilen(erg),
            fee_rows=self._auswerter.gebuehr_zeilen(erg),
            commission_rows=self._auswerter.kanal_zeilen(erg, nur_provision=True),
            payment_method_rows=self._auswerter.zahlungsart_zeilen(erg),
            net_income_rows=self._auswerter.kanal_zeilen(erg, nur_provision=False),
            outstanding_total=f(sum((b.offen for b in erg.buchungen), _NULL)),
            empty_property_ids=[p for p in property_ids if p not in belegte],
            warnungen=erg.warnungen,
            channels_without_commission=erg.kanaele_ohne_provision,
            created_at=iso(row.get("created_at")),
            updated_at=iso(row.get("updated_at")),
        )

    def buchungs_aufschluesselung(
        self, ctx: AuthContext, report_id: str
    ) -> BuchungsAufschluesselung:
        tenant_id = self._tenant(ctx)
        row = self._own_report(tenant_id, report_id)
        property_ids = self._report_property_ids([report_id]).get(report_id, [])
        currency = str(row["currency"])
        erg = self._auswerter.auswerten(
            tenant_id,
            property_ids=property_ids,
            period_from=date.fromisoformat(str(row["period_from"])),
            period_to=date.fromisoformat(str(row["period_to"])),
            basis=str(row["basis"]),
            statuses=list(row.get("reservation_statuses") or []),
            currency=currency,
        )
        rows: list[BuchungZeile] = []
        for b in erg.buchungen:
            r = b.row
            pid = str(r["property_id"])
            posten = [
                BuchungPosten(
                    kind="lodging", label="Mietpreis", amount=f(b.miete)
                )
            ]
            posten += [
                BuchungPosten(
                    kind="fee",
                    label=FEE_TYPE_LABEL.get(art, art),
                    amount=f(betrag),
                )
                for art, betrag in b.gebuehren
            ]
            if b.addons > 0:
                posten.append(
                    BuchungPosten(
                        kind="addon", label="Zusatzleistungen", amount=f(b.addons)
                    )
                )
            if b.steuern > 0:
                posten.append(
                    BuchungPosten(kind="tax", label="Steuern", amount=f(b.steuern))
                )
            rows.append(
                BuchungZeile(
                    reservation_id=str(r["id"]),
                    property_id=pid,
                    property_name=erg.property_names.get(pid),
                    check_in=date.fromisoformat(str(r["check_in"])),
                    check_out=date.fromisoformat(str(r["check_out"])),
                    nights=b.naechte,
                    guests=b.gaeste,
                    guest_name=erg.guest_names.get(str(r.get("guest_id") or "")),
                    reference=iso(r.get("external_ref")),
                    channel=str(r.get("channel") or ""),
                    ota_name=iso(r.get("ota_name")),
                    currency=currency,
                    items=posten,
                    gross=f(b.brutto),
                    channel_commission=f_opt(b.portal_abzug_gesamt),
                    income=f_opt(b.einnahmen),
                )
            )
        rows.sort(key=lambda z: (z.property_name or z.property_id, z.check_in))
        return BuchungsAufschluesselung(
            report_id=report_id,
            currency=currency,
            rows=rows,
            warnungen=erg.warnungen,
            channels_without_commission=erg.kanaele_ohne_provision,
        )

    # ==================================================================
    # D) Zahlungen
    # ==================================================================

    def _teilzahlungen(self, payment_ids: list[str]) -> dict[str, Decimal]:
        """Eine Quelle für die Summe der Teilzahlungen — siehe StatistikRechner."""
        return self._statistik.teilzahlungen(payment_ids)

    @staticmethod
    def _bezahlt_pct(betrag: Decimal, gezahlt: Decimal) -> float:
        """Anteil der geleisteten Teilzahlungen.

        Bei Betrag 0 ist der Anteil NICHT 100 %: eine Zahlung über nichts ist
        weder bezahlt noch offen. 0 ist hier die ehrliche Auskunft, 100 wäre
        eine erfundene Vollständigkeit.
        """
        if betrag == 0:
            return 0.0
        return float(
            (gezahlt / betrag * 100).quantize(_CENT, rounding=ROUND_HALF_UP)
        )

    def _zahlungs_uebersicht(
        self, tenant_id: str, report_id: str, currency: str
    ) -> ZahlungsUebersicht:
        rows = fetch_all_rows(
            self._db.table("owner_report_payments")
            .select(_PAYMENT_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("report_id", report_id)
            .order("id")
        )
        # Zahlungen in einer FREMDEN Währung werden nicht mitaddiert — die
        # Übersicht führt die Berichtswährung. Sie stillschweigend zu
        # summieren ergäbe eine Zahl, die es nicht gibt (Wurzel 4).
        passend = [r for r in rows if str(r["currency"]).upper() == currency.upper()]
        return ZahlungsUebersicht(
            currency=currency,
            payout=f(sum((d(r["betrag"]) for r in passend), _NULL)),
            rent=f(
                sum((d(r["summe_unterkunftspreis"]) for r in passend), _NULL)
            ),
            fees=f(sum((d(r["summe_gebuehren"]) for r in passend), _NULL)),
            taxes=f(sum((d(r["summe_steuern"]) for r in passend), _NULL)),
            expenses=f(sum((d(r["summe_ausgaben"]) for r in passend), _NULL)),
            other=f(sum((d(r["summe_andere"]) for r in passend), _NULL)),
            payment_count=len(rows),
        )

    def create_payment(
        self, ctx: AuthContext, report_id: str, req: PaymentCreate
    ) -> PaymentDetail:
        """Aus dem Bericht die Auszahlung an EINEN Empfänger erzeugen.

        Idempotent (Wurzel 2): existiert die Zahlung für (Bericht, Empfänger)
        schon, wird sie zurückgegeben statt eine zweite Forderung über denselben
        Betrag anzulegen. Der UNIQUE-Index ist der DB-Backstop dahinter.
        """
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        report = self._own_report(tenant_id, report_id)
        owner = self.own_owner(tenant_id, req.owner_id)

        vorhanden = (
            self._db.table("owner_report_payments")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("report_id", report_id)
            .eq("owner_id", req.owner_id)
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            return self.get_payment(ctx, str(vorhanden[0]["id"]))

        currency = str(report["currency"])
        scope = self._report_property_ids([report_id]).get(report_id, [])
        owner_objekte = {
            pid
            for pid, oid in self._auswerter.owner_je_objekt(scope).items()
            if oid == req.owner_id
        }
        if not owner_objekte:
            raise ReportingError(
                f"„{owner['name']}“ ist keinem Objekt dieses Berichts "
                "zugeordnet — es gibt nichts auszuzahlen.",
                status_code=422,
            )

        erg = self._auswerter.auswerten(
            tenant_id,
            property_ids=sorted(owner_objekte),
            period_from=date.fromisoformat(str(report["period_from"])),
            period_to=date.fromisoformat(str(report["period_to"])),
            basis=str(report["basis"]),
            statuses=list(report.get("reservation_statuses") or []),
            currency=currency,
        )
        posten, summen = self._posten_bauen(
            tenant_id,
            erg,
            owner_id=req.owner_id,
            currency=currency,
            period_from=date.fromisoformat(str(report["period_from"])),
            period_to=date.fromisoformat(str(report["period_to"])),
        )
        betrag = sum(summen.values(), _NULL)

        row = (
            self._db.table("owner_report_payments")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "report_id": report_id,
                    "owner_id": req.owner_id,
                    "currency": currency,
                    "summe_unterkunftspreis": f(
                        summen[Abschnitt.unterkunftspreis]
                    ),
                    "summe_gebuehren": f(summen[Abschnitt.gebuehren]),
                    "summe_steuern": f(summen[Abschnitt.steuern]),
                    "summe_ausgaben": f(summen[Abschnitt.ausgaben]),
                    "summe_andere": f(summen[Abschnitt.andere]),
                    "betrag": f(betrag),
                    "erstellt_von": ctx.user_id,
                }
            )
            .execute()
        ).data[0]
        payment_id = str(row["id"])
        if posten:
            self._db.table("owner_report_payment_items").insert(
                [
                    {
                        "tenant_id": tenant_id,
                        "payment_id": payment_id,
                        "abschnitt": p["abschnitt"],
                        "label": p["label"],
                        "reservation_id": p.get("reservation_id"),
                        "property_id": p.get("property_id"),
                        "betrag": p["betrag"],
                        "currency": currency,
                        "position": i,
                    }
                    for i, p in enumerate(posten)
                ]
            ).execute()
        return self.get_payment(ctx, payment_id)

    def _posten_bauen(
        self,
        tenant_id: str,
        erg: Auswertung,
        *,
        owner_id: str,
        currency: str,
        period_from: date,
        period_to: date,
    ) -> tuple[list[dict[str, Any]], dict[Abschnitt, Decimal]]:
        """Die Posten der Zahlung — je Buchung eine Zeile, plus Verrechnung.

        Die Auszahlung je Buchung kommt aus ``common.auszahlung_berechnen``
        (Feld ``netto``). Fehlt sie (kein Abrechnungsvertrag am Stichtag),
        schlägt das Erzeugen FEHL statt die Buchung wegzulassen: eine Zahlung,
        in der zwei von zwölf Aufenthalten fehlen, sieht vollständig aus.
        """
        posten: list[dict[str, Any]] = []
        summen: dict[Abschnitt, Decimal] = {a: _NULL for a in Abschnitt}

        # Reihenfolge: die SPEZIFISCHERE Ursache zuerst. Ohne Provisionssatz
        # bleibt `auszahlung` ebenfalls None — die Vertragsmeldung schickte den
        # Betrieb dann zum falschen Formular.
        if erg.kanaele_ohne_provision:
            raise ReportingError(
                "Für "
                + ", ".join(erg.kanaele_ohne_provision)
                + " ist kein Provisionssatz hinterlegt. Ohne ihn steht nicht "
                "fest, was das Portal einbehält — Satz unter „Erweiterte "
                "Einstellungen“ eintragen.",
                status_code=422,
            )
        ohne_vertrag = [b for b in erg.buchungen if b.auszahlung is None]
        if ohne_vertrag:
            raise ReportingError(
                f"Für {len(ohne_vertrag)} Buchungen gilt am Stichtag kein "
                "Abrechnungsvertrag. Ohne Vertrag ist die Auszahlung nicht "
                "berechenbar — Vertrag unter „Eigentümer“ hinterlegen.",
                status_code=422,
            )
        if erg.warnungen:
            raise ReportingError(
                "Der Bericht enthält ungeklärte Buchungen: "
                + "; ".join(erg.warnungen[:3])
                + ("; …" if len(erg.warnungen) > 3 else ""),
                status_code=422,
            )

        for b in erg.buchungen:
            a = b.auszahlung
            if a is None:  # pragma: no cover — oben ausgeschlossen
                continue
            stichtag = self._auswerter.stichtag(b.row, "check_out")
            kurs = self._auswerter.kurs(str(b.row.get("currency") or ""), currency, stichtag)
            label = (
                f"{erg.property_names.get(str(b.row['property_id'])) or ''} · "
                f"{b.row['check_in']} – {b.row['check_out']}"
            ).strip(" ·")
            betrag = a.netto * kurs
            posten.append(
                {
                    "abschnitt": Abschnitt.unterkunftspreis.value,
                    "label": label,
                    "reservation_id": str(b.row["id"]),
                    "property_id": str(b.row["property_id"]),
                    "betrag": f(betrag),
                }
            )
            summens = summen[Abschnitt.unterkunftspreis] + betrag
            summen[Abschnitt.unterkunftspreis] = summens

        # Verrechnungsposten des Eigentümers im Zeitraum (0064/0344).
        for e in self._owner_expenses(tenant_id, owner_id, period_from, period_to):
            betrag = d(e["amount"])
            richtung = str(e.get("direction") or "from_owner")
            e_currency = str(e.get("currency") or currency).upper()
            kurs = self._auswerter.kurs(e_currency, currency, date.fromisoformat(str(e["date"])))
            wert = betrag * kurs
            if richtung == "from_owner":
                posten.append(
                    {
                        "abschnitt": Abschnitt.ausgaben.value,
                        "label": str(e["concept"]),
                        "property_id": iso(e.get("listing_id")),
                        "reservation_id": iso(e.get("reservation_id")),
                        "betrag": f(-wert),
                    }
                )
                summen[Abschnitt.ausgaben] -= wert
            else:
                posten.append(
                    {
                        "abschnitt": Abschnitt.andere.value,
                        "label": str(e["concept"]),
                        "property_id": iso(e.get("listing_id")),
                        "reservation_id": iso(e.get("reservation_id")),
                        "betrag": f(wert),
                    }
                )
                summen[Abschnitt.andere] += wert

        # Wiederkehrende Posten (Dauervereinbarung).
        for zeile, wert in self._recurring_betraege(
            tenant_id, owner_id, erg, currency, period_from, period_to
        ):
            abschnitt = Abschnitt(str(zeile["abschnitt"]))
            vorzeichen = -1 if abschnitt is Abschnitt.ausgaben else 1
            posten.append(
                {
                    "abschnitt": abschnitt.value,
                    "label": str(zeile["label"]),
                    "property_id": iso(zeile.get("property_id")),
                    "betrag": f(wert * vorzeichen),
                }
            )
            summen[abschnitt] += wert * vorzeichen
        return posten, summen

    def _owner_expenses(
        self, tenant_id: str, owner_id: str, period_from: date, period_to: date
    ) -> list[dict[str, Any]]:
        return fetch_all_rows(
            self._db.table("owner_expenses")
            .select(
                "id, concept, date, amount, direction, currency, listing_id, "
                "reservation_id, hidden_from_owner"
            )
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .gte("date", period_from.isoformat())
            .lte("date", period_to.isoformat())
            .order("id")
        )

    def _recurring_betraege(
        self,
        tenant_id: str,
        owner_id: str,
        erg: Auswertung,
        currency: str,
        period_from: date,
        period_to: date,
    ) -> list[tuple[dict[str, Any], Decimal]]:
        """Wiederkehrende Posten in konkrete Beträge übersetzen.

        ``je_buchung``/``je_nacht`` zählen nur die Buchungen der Objekte, für
        die der Posten gilt; ``je_zeitraum`` fällt einmal an. Die Währung wird
        NICHT umgerechnet, sondern muss zur Berichtswährung passen — 50 DKK
        sind 50 DKK, und ein stiller Kurs 1,0 wäre plausibel aussehender Unsinn
        (dieselbe Regel wie bei der Pauschale im Vertrag).
        """
        rows = fetch_all_rows(
            self._db.table("owner_recurring_items")
            .select(
                "id, label, abschnitt, modus, betrag, currency, property_id, aktiv"
            )
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .eq("aktiv", True)
            .order("id")
        )
        out: list[tuple[dict[str, Any], Decimal]] = []
        for zeile in rows:
            if str(zeile["currency"]).upper() != currency.upper():
                raise ReportingError(
                    f"Der wiederkehrende Posten „{zeile['label']}“ lautet auf "
                    f"{zeile['currency']}, der Bericht auf {currency}. Beträge "
                    "verschiedener Währungen werden nicht verrechnet.",
                    status_code=422,
                )
            betrag = d(zeile["betrag"])
            pid = iso(zeile.get("property_id"))
            betroffen = [
                b
                for b in erg.buchungen
                if pid is None or str(b.row["property_id"]) == pid
            ]
            modus = str(zeile["modus"])
            if modus == "je_buchung":
                wert = betrag * len(betroffen)
            elif modus == "je_nacht":
                wert = betrag * sum(b.naechte for b in betroffen)
            else:
                # `je_zeitraum` fällt einmal an — auch bei leerem Zeitraum, denn
                # eine Dauervereinbarung hängt nicht an einer Buchung.
                del period_from, period_to
                wert = betrag
            if wert != 0:
                out.append((zeile, wert))
        return out

    def get_payment(self, ctx: AuthContext, payment_id: str) -> PaymentDetail:
        tenant_id = self._tenant(ctx)
        row = self._own_payment(tenant_id, payment_id)
        report = self._own_report(tenant_id, str(row["report_id"]))
        owner = self.own_owner(tenant_id, str(row["owner_id"]))
        items = fetch_all_rows(
            self._db.table("owner_report_payment_items")
            .select(
                "id, abschnitt, label, reservation_id, property_id, betrag, "
                "currency, position"
            )
            .eq("tenant_id", tenant_id)
            .eq("payment_id", payment_id)
            .order("position")
            .order("id")
        )
        parts = fetch_all_rows(
            self._db.table("owner_report_payment_parts")
            .select("id, betrag, currency, bezahlt_am, notiz, created_at")
            .eq("tenant_id", tenant_id)
            .eq("payment_id", payment_id)
            .order("bezahlt_am")
            .order("id")
        )
        gezahlt = sum((d(p["betrag"]) for p in parts), _NULL)
        return PaymentDetail(
            id=payment_id,
            tenant_id=tenant_id,
            report_id=str(row["report_id"]),
            report_name=str(report["name"]),
            period_from=date.fromisoformat(str(report["period_from"])),
            period_to=date.fromisoformat(str(report["period_to"])),
            owner_id=str(row["owner_id"]),
            owner_name=iso(owner.get("name")),
            owner_email=iso(owner.get("email")),
            rechtliche_information=self._bankblock(owner),
            empfaenger_information=iso(owner.get("notes")),
            rechnungs_fusszeile=self._fusszeile(owner),
            currency=str(row["currency"]),
            summe_unterkunftspreis=float(row["summe_unterkunftspreis"]),
            summe_gebuehren=float(row["summe_gebuehren"]),
            summe_steuern=float(row["summe_steuern"]),
            summe_ausgaben=float(row["summe_ausgaben"]),
            summe_andere=float(row["summe_andere"]),
            betrag=float(row["betrag"]),
            bezahlt_pct=self._bezahlt_pct(d(row["betrag"]), gezahlt),
            bezahlt_am=(
                date.fromisoformat(str(row["bezahlt_am"]))
                if row.get("bezahlt_am")
                else None
            ),
            notiz=iso(row.get("notiz")),
            statement_id=iso(row.get("statement_id")),
            items=[
                PaymentItem(
                    id=str(i["id"]),
                    abschnitt=Abschnitt(str(i["abschnitt"])),
                    label=str(i["label"]),
                    reservation_id=iso(i.get("reservation_id")),
                    property_id=iso(i.get("property_id")),
                    betrag=float(i["betrag"]),
                    currency=str(i["currency"]),
                    position=int(i["position"]),
                )
                for i in items
            ],
            parts=[
                PaymentPart(
                    id=str(p["id"]),
                    betrag=float(p["betrag"]),
                    currency=str(p["currency"]),
                    bezahlt_am=date.fromisoformat(str(p["bezahlt_am"])),
                    notiz=iso(p.get("notiz")),
                    created_at=iso(p.get("created_at")),
                )
                for p in parts
            ],
            created_at=iso(row.get("created_at")),
            updated_at=iso(row.get("updated_at")),
        )

    @staticmethod
    def _bankblock(owner: dict[str, Any]) -> str | None:
        """Die Bankverbindung als Textblock — nur aus vorhandenen Feldern.

        Leere Felder werden WEGGELASSEN, nicht als „IBAN: —" gezeigt: eine
        Zeile mit Platzhalter sähe auf dem Beleg aus wie eine gepflegte Angabe.
        """
        zeilen = [
            f"{beschriftung}: {owner[feld]}"
            for feld, beschriftung in (
                ("bank_name", "Bank"),
                ("account_holder", "Kontoinhaber"),
                ("iban", "IBAN"),
                ("bic", "BIC"),
                ("vat_id", "USt-IdNr."),
            )
            if owner.get(feld)
        ]
        return "\n".join(zeilen) or None

    @staticmethod
    def _fusszeile(owner: dict[str, Any]) -> str | None:
        zeilen = [
            f"{beschriftung}: {owner[feld]}"
            for feld, beschriftung in (
                ("email", "Mail"),
                ("phone", "Tel"),
                ("tax_id", "Steuernummer"),
            )
            if owner.get(feld)
        ]
        return "\n".join(zeilen) or None

    def list_payments(
        self, ctx: AuthContext, *, nur_offene: bool = False, owner_id: str | None = None
    ) -> PaymentListResponse:
        tenant_id = self._tenant(ctx)
        query = (
            self._db.table("owner_report_payments")
            .select(_PAYMENT_COLUMNS)
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .order("id")
        )
        if owner_id:
            query = query.eq("owner_id", owner_id)
        rows = fetch_all_rows(query)
        teil = self._teilzahlungen([str(r["id"]) for r in rows])
        namen = self._owner_namen(tenant_id, [str(r["owner_id"]) for r in rows])
        berichte = self._report_namen(tenant_id, [str(r["report_id"]) for r in rows])

        items: list[PaymentListItem] = []
        for r in rows:
            pct = self._bezahlt_pct(
                d(r["betrag"]), teil.get(str(r["id"]), _NULL)
            )
            if nur_offene and pct >= 100:
                continue
            items.append(
                PaymentListItem(
                    id=str(r["id"]),
                    report_id=str(r["report_id"]),
                    report_name=berichte.get(str(r["report_id"]), ""),
                    owner_id=str(r["owner_id"]),
                    owner_name=namen.get(str(r["owner_id"])),
                    betrag=float(r["betrag"]),
                    currency=str(r["currency"]),
                    bezahlt_pct=pct,
                    bezahlt_am=(
                        date.fromisoformat(str(r["bezahlt_am"]))
                        if r.get("bezahlt_am")
                        else None
                    ),
                    has_invoice=bool(r.get("statement_id")),
                    statement_id=iso(r.get("statement_id")),
                    created_at=iso(r.get("created_at")),
                )
            )
        return PaymentListResponse(items=items, total=len(items))

    def _owner_namen(self, tenant_id: str, owner_ids: list[str]) -> dict[str, str]:
        ids = sorted({o for o in owner_ids if o})
        if not ids:
            return {}
        rows = fetch_all_rows(
            self._db.table("owners")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .order("id")
        )
        return {str(r["id"]): str(r.get("name") or "") for r in rows}

    def _report_namen(self, tenant_id: str, report_ids: list[str]) -> dict[str, str]:
        ids = sorted({r for r in report_ids if r})
        if not ids:
            return {}
        rows = fetch_all_rows(
            self._db.table("owner_reports")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .order("id")
        )
        return {str(r["id"]): str(r["name"]) for r in rows}

    def update_payment(
        self, ctx: AuthContext, payment_id: str, req: PaymentUpdate
    ) -> PaymentDetail:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        self._own_payment(tenant_id, payment_id)
        self._db.table("owner_report_payments").update(
            {"notiz": req.notiz, "updated_at": "now()"}
        ).eq("id", payment_id).eq("tenant_id", tenant_id).execute()
        return self.get_payment(ctx, payment_id)

    def mark_paid(
        self, ctx: AuthContext, payment_id: str, bezahlt_am: date
    ) -> PaymentDetail:
        """Als vollständig bezahlt markieren.

        Legt die FEHLENDE Restsumme als Teilzahlung an, statt nur ein Flag zu
        setzen: sonst zeigte die Liste 100 % bezahlt, während die Teilzahlungen
        30 % ergeben — zwei Wahrheiten über dasselbe Geld. Ist bereits alles
        beglichen, wird nichts angelegt (Wurzel 2: der zweite Klick darf keine
        zweite Zahlung erzeugen).
        """
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        row = self._own_payment(tenant_id, payment_id)
        gezahlt = self._teilzahlungen([payment_id]).get(payment_id, _NULL)
        rest = d(row["betrag"]) - gezahlt
        if rest > 0:
            self._db.table("owner_report_payment_parts").insert(
                {
                    "tenant_id": tenant_id,
                    "payment_id": payment_id,
                    "betrag": f(rest),
                    "currency": str(row["currency"]),
                    "bezahlt_am": bezahlt_am.isoformat(),
                    "notiz": "Restbetrag (als bezahlt markiert)",
                    "erstellt_von": ctx.user_id,
                }
            ).execute()
        self._db.table("owner_report_payments").update(
            {"bezahlt_am": bezahlt_am.isoformat(), "updated_at": "now()"}
        ).eq("id", payment_id).eq("tenant_id", tenant_id).execute()
        return self.get_payment(ctx, payment_id)

    def add_part(
        self, ctx: AuthContext, payment_id: str, req: PaymentPartCreate
    ) -> PaymentDetail:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        row = self._own_payment(tenant_id, payment_id)
        gezahlt = self._teilzahlungen([payment_id]).get(payment_id, _NULL)
        neu = gezahlt + d(req.betrag)
        if neu > d(row["betrag"]):
            raise ReportingError(
                "Die Teilzahlungen überschreiten den Zahlungsbetrag.",
                status_code=422,
            )
        self._db.table("owner_report_payment_parts").insert(
            {
                "tenant_id": tenant_id,
                "payment_id": payment_id,
                "betrag": req.betrag,
                "currency": str(row["currency"]),
                "bezahlt_am": req.bezahlt_am.isoformat(),
                "notiz": req.notiz,
                "erstellt_von": ctx.user_id,
            }
        ).execute()
        # Vollständig beglichen → das Zahlungsdatum mitpflegen (Wurzel 1: der
        # Gegenzustand zum neuen Teil). Ohne diesen Schritt bliebe die Statistik
        # („Im Laufe der Zeit gezahltes Geld") ohne diesen Betrag.
        if neu >= d(row["betrag"]):
            self._db.table("owner_report_payments").update(
                {"bezahlt_am": req.bezahlt_am.isoformat(), "updated_at": "now()"}
            ).eq("id", payment_id).eq("tenant_id", tenant_id).execute()
        return self.get_payment(ctx, payment_id)

    def delete_part(self, ctx: AuthContext, part_id: str) -> PaymentDetail:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        rows = (
            self._db.table("owner_report_payment_parts")
            .select("id, payment_id")
            .eq("tenant_id", tenant_id)
            .eq("id", part_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise ReportingError("Teilzahlung nicht gefunden.", status_code=404)
        payment_id = str(rows[0]["payment_id"])
        self._db.table("owner_report_payment_parts").delete().eq(
            "id", part_id
        ).eq("tenant_id", tenant_id).execute()
        # Der Gegenzustand (Wurzel 1): fällt die Zahlung unter 100 %, ist sie
        # nicht mehr bezahlt und das Datum muss weg — sonst zählte die
        # Statistik einen Betrag, den niemand bekommen hat.
        row = self._own_payment(tenant_id, payment_id)
        gezahlt = self._teilzahlungen([payment_id]).get(payment_id, _NULL)
        if gezahlt < d(row["betrag"]) and row.get("bezahlt_am"):
            self._db.table("owner_report_payments").update(
                {"bezahlt_am": None, "updated_at": "now()"}
            ).eq("id", payment_id).eq("tenant_id", tenant_id).execute()
        return self.get_payment(ctx, payment_id)

    def delete_payment(self, ctx: AuthContext, payment_id: str) -> None:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        row = self._own_payment(tenant_id, payment_id)
        if row.get("statement_id"):
            raise ReportingError(
                "Zu dieser Zahlung besteht bereits eine Rechnung. Erst die "
                "Rechnung stornieren.",
                status_code=409,
            )
        self._db.table("owner_report_payments").delete().eq(
            "id", payment_id
        ).eq("tenant_id", tenant_id).execute()


    # ==================================================================
    # G) Geplante Berichte
    # ==================================================================

    def _schedule_children(
        self, schedule_ids: list[str]
    ) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
        if not schedule_ids:
            return {}, {}
        ids = sorted(set(schedule_ids))
        objekte: dict[str, list[str]] = defaultdict(list)
        for r in fetch_all_rows(
            self._db.table("owner_report_schedule_properties")
            .select("schedule_id, property_id")
            .in_("schedule_id", ids)
            .order("schedule_id")
        ):
            objekte[str(r["schedule_id"])].append(str(r["property_id"]))
        empfaenger: dict[str, list[str]] = defaultdict(list)
        for r in fetch_all_rows(
            self._db.table("owner_report_schedule_recipients")
            .select("schedule_id, owner_id")
            .in_("schedule_id", ids)
            .order("schedule_id")
        ):
            empfaenger[str(r["schedule_id"])].append(str(r["owner_id"]))
        return objekte, empfaenger

    def list_schedules(self, ctx: AuthContext) -> ScheduleListResponse:
        tenant_id = self._tenant(ctx)
        rows = fetch_all_rows(
            self._db.table("owner_report_schedules")
            .select(_SCHEDULE_COLUMNS)
            .eq("tenant_id", tenant_id)
            .order("name")
        )
        objekte, empfaenger = self._schedule_children(
            [str(r["id"]) for r in rows]
        )
        return ScheduleListResponse(
            items=[
                ScheduleListItem(
                    id=str(r["id"]),
                    name=str(r["name"]),
                    rhythmus=Rhythmus(str(r["rhythmus"])),
                    currency=str(r["currency"]),
                    property_count=len(objekte.get(str(r["id"]), [])),
                    recipient_count=len(empfaenger.get(str(r["id"]), [])),
                    aktiv=bool(r["aktiv"]),
                    zuletzt_erzeugt_fuer=(
                        date.fromisoformat(str(r["zuletzt_erzeugt_fuer"]))
                        if r.get("zuletzt_erzeugt_fuer")
                        else None
                    ),
                )
                for r in rows
            ]
        )

    def get_schedule(self, ctx: AuthContext, schedule_id: str) -> ScheduleResponse:
        tenant_id = self._tenant(ctx)
        row = self._own_schedule(tenant_id, schedule_id)
        objekte, empfaenger = self._schedule_children([schedule_id])
        return ScheduleResponse(
            id=schedule_id,
            name=str(row["name"]),
            name_mit_datum=bool(row["name_mit_datum"]),
            aktiv=bool(row["aktiv"]),
            rhythmus=Rhythmus(str(row["rhythmus"])),
            am_tag=AmTag(str(row["am_tag"])),
            zeitraum=PlanZeitraum(str(row["zeitraum"])),
            currency=str(row["currency"]),
            basis=ReportBasis(str(row["basis"])),
            property_ids=objekte.get(schedule_id, []),
            recipient_ids=empfaenger.get(schedule_id, []),
            zuletzt_erzeugt_fuer=(
                date.fromisoformat(str(row["zuletzt_erzeugt_fuer"]))
                if row.get("zuletzt_erzeugt_fuer")
                else None
            ),
            created_at=iso(row.get("created_at")),
            updated_at=iso(row.get("updated_at")),
        )

    def create_schedule(
        self, ctx: AuthContext, req: ScheduleCreate
    ) -> ScheduleResponse:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        ids = self.pruefe_objekte(tenant_id, req.property_ids)
        for oid in req.recipient_ids:
            self.own_owner(tenant_id, oid)
        row = (
            self._db.table("owner_report_schedules")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "name": req.name.strip(),
                    "name_mit_datum": req.name_mit_datum,
                    "aktiv": req.aktiv,
                    "rhythmus": req.rhythmus.value,
                    "am_tag": req.am_tag.value,
                    "zeitraum": req.zeitraum.value,
                    "currency": req.currency,
                    "basis": req.basis.value,
                    "erstellt_von": ctx.user_id,
                }
            )
            .execute()
        ).data[0]
        sid = str(row["id"])
        self._schedule_kinder_setzen(sid, ids, sorted(set(req.recipient_ids)))
        return self.get_schedule(ctx, sid)

    def _schedule_kinder_setzen(
        self, schedule_id: str, property_ids: list[str], owner_ids: list[str]
    ) -> None:
        """Objekte und Empfänger als Ganzes ersetzen (Wurzel 1: Alt/Neu-Diff).

        Vollständiges Ersetzen statt Teil-Update, weil beide Tabellen nur den
        Schlüssel tragen — es gibt nichts, was beim Löschen verlorenginge.
        """
        self._db.table("owner_report_schedule_properties").delete().eq(
            "schedule_id", schedule_id
        ).execute()
        if property_ids:
            self._db.table("owner_report_schedule_properties").insert(
                [
                    {"schedule_id": schedule_id, "property_id": p}
                    for p in property_ids
                ]
            ).execute()
        self._db.table("owner_report_schedule_recipients").delete().eq(
            "schedule_id", schedule_id
        ).execute()
        if owner_ids:
            self._db.table("owner_report_schedule_recipients").insert(
                [{"schedule_id": schedule_id, "owner_id": o} for o in owner_ids]
            ).execute()

    def update_schedule(
        self, ctx: AuthContext, schedule_id: str, req: ScheduleUpdate
    ) -> ScheduleResponse:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        self._own_schedule(tenant_id, schedule_id)
        patch: dict[str, Any] = {"updated_at": "now()"}
        for feld, wert in (
            ("name", req.name.strip() if req.name is not None else None),
            ("name_mit_datum", req.name_mit_datum),
            ("aktiv", req.aktiv),
            ("currency", req.currency),
        ):
            if wert is not None:
                patch[feld] = wert
        for feld, enum_wert in (
            ("rhythmus", req.rhythmus),
            ("am_tag", req.am_tag),
            ("zeitraum", req.zeitraum),
            ("basis", req.basis),
        ):
            if enum_wert is not None:
                patch[feld] = enum_wert.value
        self._db.table("owner_report_schedules").update(patch).eq(
            "id", schedule_id
        ).eq("tenant_id", tenant_id).execute()

        if req.property_ids is not None or req.recipient_ids is not None:
            aktuell = self.get_schedule(ctx, schedule_id)
            ids = (
                self.pruefe_objekte(tenant_id, req.property_ids)
                if req.property_ids is not None
                else aktuell.property_ids
            )
            empfaenger = (
                sorted(set(req.recipient_ids))
                if req.recipient_ids is not None
                else aktuell.recipient_ids
            )
            for oid in empfaenger:
                self.own_owner(tenant_id, oid)
            self._schedule_kinder_setzen(schedule_id, ids, empfaenger)
        return self.get_schedule(ctx, schedule_id)

    def delete_schedule(self, ctx: AuthContext, schedule_id: str) -> None:
        verbiete_eigentuemer_schreiben(ctx)
        tenant_id = self._tenant(ctx)
        self._own_schedule(tenant_id, schedule_id)
        self._db.table("owner_report_schedules").delete().eq(
            "id", schedule_id
        ).eq("tenant_id", tenant_id).execute()

    # --- Cron-Lauf ---------------------------------------------------------

    def run_schedules(self, heute: date) -> ScheduleRunResponse:
        """Alle fälligen Pläne ausführen — mandantenübergreifend (Cron).

        Idempotent (Wurzel 2): ``zuletzt_erzeugt_fuer`` plus der UNIQUE-Index
        auf ``(schedule_id, period_from, period_to)`` verhindern, dass eine
        doppelte Zustellung denselben Bericht zweimal erzeugt.
        """
        plaene = fetch_all_rows(
            self._db.table("owner_report_schedules")
            .select(_SCHEDULE_COLUMNS)
            .eq("aktiv", True)
            .order("id")
        )
        geprueft = 0
        erzeugt = 0
        zahlungen = 0
        for plan in plaene:
            geprueft += 1
            if not perioden.laeuft_heute(
                str(plan["am_tag"]), str(plan["rhythmus"]), heute
            ):
                continue
            von, bis = perioden.periode(
                str(plan["rhythmus"]), str(plan["zeitraum"]), heute
            )
            if str(plan.get("zuletzt_erzeugt_fuer") or "") == von.isoformat():
                continue
            neu, anzahl = self._plan_ausfuehren(plan, von, bis)
            erzeugt += 1 if neu else 0
            zahlungen += anzahl
        return ScheduleRunResponse(
            geprueft=geprueft, erzeugt=erzeugt, zahlungen=zahlungen
        )

    def _plan_ausfuehren(
        self, plan: dict[str, Any], von: date, bis: date
    ) -> tuple[bool, int]:
        sid = str(plan["id"])
        tenant_id = str(plan["tenant_id"])
        objekte, empfaenger = self._schedule_children([sid])
        property_ids = objekte.get(sid, [])
        if not property_ids:
            log.warning("reporting_plan_ohne_objekte", schedule_id=sid)
            return False, 0

        name = str(plan["name"])
        if plan.get("name_mit_datum"):
            name = f"{von.strftime('%Y-%m')} {name}"
        try:
            row = (
                self._db.table("owner_reports")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "name": name,
                        "currency": str(plan["currency"]),
                        "period_from": von.isoformat(),
                        "period_to": bis.isoformat(),
                        "basis": str(plan["basis"]),
                        "reservation_statuses": [],
                        "schedule_id": sid,
                    }
                )
                .execute()
            ).data[0]
        except Exception as exc:  # noqa: BLE001 — 23505 = schon erzeugt
            # Der UNIQUE-Index hat zugeschlagen: ein paralleler Lauf war
            # schneller. Das ist der erwünschte Ausgang, kein Fehler — aber er
            # wird protokolliert, nicht verschluckt (Wurzel 5).
            log.info("reporting_plan_bereits_erzeugt", schedule_id=sid, error=str(exc))
            return False, 0

        report_id = str(row["id"])
        self._db.table("owner_report_properties").insert(
            [{"report_id": report_id, "property_id": p} for p in property_ids]
        ).execute()
        self._db.table("owner_report_schedules").update(
            {"zuletzt_erzeugt_fuer": von.isoformat(), "updated_at": "now()"}
        ).eq("id", sid).execute()

        anzahl = 0
        ctx = AuthContext(user_id="system", tenant_id=tenant_id)
        for oid in empfaenger.get(sid, []):
            try:
                self.create_payment(ctx, report_id, PaymentCreate(owner_id=oid))
                anzahl += 1
            except ReportingError as exc:
                # Ein Empfänger ohne Vertrag oder mit ungeklärten Buchungen
                # blockiert den Lauf der ÜBRIGEN nicht — der Grund wird
                # protokolliert, damit er nicht spurlos verschwindet.
                log.warning(
                    "reporting_plan_zahlung_uebersprungen",
                    schedule_id=sid,
                    owner_id=oid,
                    grund=exc.message,
                )
        return True, anzahl

    # ==================================================================
    # H) Statistik
    # ==================================================================

    def statistik(
        self,
        ctx: AuthContext,
        *,
        von: date,
        bis: date,
        currency: str | None = None,
        owner_ids: list[str] | None = None,
    ) -> StatistikResponse:
        """Bilanzstatistik — gerechnet in ``statistik.StatistikRechner``.

        Der Service prüft nur den Mandanten und reicht durch: die Frage „was ist
        tatsächlich geflossen" hat mit Berichts-CRUD nichts zu tun.
        """
        return self._statistik.statistik(
            self._tenant(ctx),
            von=von,
            bis=bis,
            currency=currency,
            owner_ids=owner_ids,
        )

    # ==================================================================
    # I) Empfänger + wiederkehrende Posten (siehe empfaenger.py)
    # ==================================================================

    def list_empfaenger(self, ctx: AuthContext) -> EmpfaengerListResponse:
        return self._empfaenger.list_empfaenger(self._tenant(ctx))

    def list_recurring(
        self, ctx: AuthContext, owner_id: str
    ) -> RecurringItemListResponse:
        return self._empfaenger.list_recurring(self._tenant(ctx), owner_id)

    def create_recurring(
        self, ctx: AuthContext, owner_id: str, req: RecurringItemCreate
    ) -> RecurringItemResponse:
        verbiete_eigentuemer_schreiben(ctx)
        return self._empfaenger.create_recurring(
            self._tenant(ctx), owner_id, req, user_id=ctx.user_id
        )

    def update_recurring(
        self, ctx: AuthContext, item_id: str, req: RecurringItemUpdate
    ) -> RecurringItemResponse:
        verbiete_eigentuemer_schreiben(ctx)
        return self._empfaenger.update_recurring(self._tenant(ctx), item_id, req)

    def delete_recurring(self, ctx: AuthContext, item_id: str) -> None:
        verbiete_eigentuemer_schreiben(ctx)
        self._empfaenger.delete_recurring(self._tenant(ctx), item_id)
