"""Router für taxpayer. Gemountet unter /api/v1/taxpayer.

Steuerzahler-Angaben des Betriebs (DAC7/PStTG). Scope über ctx.tenant_id im
Service (Wurzel 3/9). Schreiben verlangt `manage_billing` — Steuerdaten gehören
nicht in die Hand von staff/cleaner (Wurzel 9, §4.3 Rollen-Datensplit).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from src.core.security import CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import (
    ObjektangabenServiceDep,
    RegimeServiceDep,
    TaxpayerServiceDep,
)
from .schemas import (
    LandRegelAusgabe,
    MeldeeinheitAusgabe,
    MeldeUebersicht,
    ObjektAngabe,
    ObjektAngabeStatus,
    TaxpayerCreate,
    TaxpayerEntry,
    TaxpayerOverview,
)
from .service import TaxpayerError

router = APIRouter(prefix="/taxpayer", tags=["taxpayer"])

# Wurzel 8: kein unbegrenzter Bereich. DAC7 gilt ab 2023 (Inkrafttreten des
# PStTG); ein Jahr weit in der Zukunft waere kein Meldezeitraum.
_MELDEJAHR_MIN = 2023
_MELDEJAHR_MAX = 2100


def _fehler(exc: TaxpayerError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get(
    "",
    response_model=TaxpayerOverview,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def get_overview(
    ctx: CurrentUser, service: TaxpayerServiceDep
) -> TaxpayerOverview:
    """Eintraege, fehlende Laender (aus den Objekten abgeleitet) und USt-IdNr."""
    try:
        return service.overview(ctx)
    except TaxpayerError as exc:
        raise _fehler(exc) from exc


@router.put(
    "",
    response_model=TaxpayerEntry,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def upsert_entry(
    daten: TaxpayerCreate, ctx: CurrentUser, service: TaxpayerServiceDep
) -> TaxpayerEntry:
    """Angaben für ein Land anlegen oder ersetzen (Selbstauskunft)."""
    try:
        return service.upsert(ctx, daten)
    except TaxpayerError as exc:
        raise _fehler(exc) from exc


@router.get(
    "/laender",
    response_model=list[LandRegelAusgabe],
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def list_laender(service: RegimeServiceDep) -> list[LandRegelAusgabe]:
    """Alle Länder mit hinterlegter Steuerregel.

    Der Wizard leitet daraus ab, welche Felder er zeigt — er kennt selbst
    KEIN Steuerrecht. Eine zweite Kopie der Regeln im Client liefe
    auseinander, und die Sätze sind geldwirksam.
    """
    return [
        LandRegelAusgabe(
            country=r.country,
            regime=r.regime.value,
            reporting_authority=r.reporting_authority,
            required_ids=[k.value for k in r.required_ids],
            birthplace_substitutes_id=r.birthplace_substitutes_id,
            erhebt_steuerangaben=r.erhebt_steuerangaben,
            id_erhebung_verboten=r.id_erhebung_verboten,
            host_tax_bps_with_id=r.host_tax_bps_with_id,
            host_tax_bps_without_id=r.host_tax_bps_without_id,
            legal_basis=r.legal_basis,
            notes=r.notes,
        )
        for r in service.unterstuetzte_laender()
    ]


@router.get(
    "/objekte",
    response_model=list[ObjektAngabeStatus],
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def list_objektangaben(
    ctx: CurrentUser, service: TaxpayerServiceDep
) -> list[ObjektAngabeStatus]:
    """Stand der Grundbuchnummern je Objekt (§ 14 Abs. 4 Nr. 6 PStTG)."""
    try:
        return service.objektangaben(ctx)
    except TaxpayerError as exc:
        raise _fehler(exc) from exc


@router.put(
    "/objekte/{property_id}",
    response_model=ObjektAngabeStatus,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def upsert_objektangabe(
    property_id: str,
    daten: ObjektAngabe,
    ctx: CurrentUser,
    service: TaxpayerServiceDep,
) -> ObjektAngabeStatus:
    """Grundbuchnummer setzen oder erklaeren, dass keine existiert.

    Wurzel 9: derselbe Scope wie die Liste — ein fremdes Objekt ist hier
    nicht auffindbar, nicht nur nicht aenderbar.
    """
    try:
        return service.objektangabe_speichern(ctx, property_id, daten)
    except TaxpayerError as exc:
        raise _fehler(exc) from exc


@router.get(
    "/meldung/{jahr}",
    response_model=MeldeUebersicht,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def get_meldung(
    jahr: int, ctx: CurrentUser, service: ObjektangabenServiceDep
) -> MeldeUebersicht:
    """Der objektbezogene Meldedatensatz eines Kalenderjahres.

    Fasst nach § 6 Abs. 7 PStTG zusammen: Objekte an derselben Anschrift mit
    demselben Eigentuemer sind EINE inserierte Immobilieneinheit.
    """
    if not _MELDEJAHR_MIN <= jahr <= _MELDEJAHR_MAX:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Meldezeitraum muss zwischen {_MELDEJAHR_MIN} und "
                f"{_MELDEJAHR_MAX} liegen."
            ),
        )
    einheiten = [
        MeldeeinheitAusgabe(
            anschrift=e.anschrift,
            country=e.country,
            property_ids=e.property_ids,
            art=e.art,
            land_registration_number=e.land_registration_number,
            verguetung_je_quartal=e.verguetung_je_quartal,
            verguetung_gesamt=e.verguetung_gesamt,
            anzahl_taetigkeiten=e.anzahl_taetigkeiten,
            vermietete_tage=e.vermietete_tage,
            currency=e.currency,
            meldefaehig=e.meldefaehig,
        )
        for e in service.fuer_jahr(ctx, jahr)
    ]
    return MeldeUebersicht(
        jahr=jahr,
        einheiten=einheiten,
        nicht_meldefaehig=sum(1 for e in einheiten if not e.meldefaehig),
    )


@router.delete(
    "/{country}",
    status_code=204,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def delete_entry(
    country: str, ctx: CurrentUser, service: TaxpayerServiceDep
) -> None:
    """Angaben eines Landes entfernen."""
    try:
        service.delete(ctx, country)
    except TaxpayerError as exc:
        raise _fehler(exc) from exc
