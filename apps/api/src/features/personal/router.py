"""Router des Slice `personal` — gemountet unter /api/v1/personal.

Autorisierung (Wurzel 9): jede Route trägt die Fähigkeit, die ihr Fachgebiet
verlangt — nicht nur `get_current_user`. Der Personen-Scope (wen darf ich
sehen?) sitzt zusätzlich im Dienst (`_personen_im_scope`), deckungsgleich mit
der DB-Policy `personal_sieht_person`.

  MANAGE_PERSONAL     Akte, Fremdfirmen, Arbeitsbereiche, Regeln, Dokumente
                      (Rolle frisch aus der DB, Wurzel 7)
  PLAN_SCHICHTEN      Dienstplan schreiben, Bedarf, Veröffentlichen, Bewerbungen
  VIEW_TEAM_SCHEDULE  Wochenplan/Abwesenheiten/Zeiten des Teams lesen
  VIEW_OWN_SCHEDULE   eigener Plan, bestätigen, bewerben, Lesebestätigung
  TRACK_OWN_TIME      Stempeluhr
  REQUEST_ABSENCE     eigene Anträge, eigene Verfügbarkeit
  APPROVE_ABSENCE     Anträge entscheiden, Sperren
  CONFIRM_TIME        Zeiten korrigieren/bestätigen/nachtragen, AZK, Monat
  EXPORT_LOHN         Auswertung mit Kosten, Lohnexport (Rolle frisch aus DB)

Kartei (0543, `/mitarbeiter/{id}/{vertraege|massnahmen|vorfaelle|gespraeche}`
sowie `/kartei/{bereich}/{id}`): MANAGE_PERSONAL. Nachweise und Schulungen
liest zusätzlich die Schichtleitung im Scope (Team), schreibt sie aber nicht.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse

from src.core.security import AuthContext, get_current_user
from src.core.uploads import read_upload_named
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from ._base import PersonalError
from .akte_krypto import AkteKryptoFehler
from .bedarf_router import router as bedarf_router
from .berichte_router import router as berichte_router
from .dependencies import (
    AbwesenheitenServiceDep,
    AuswertungServiceDep,
    KarteiServiceDep,
    PersonalServiceDep,
    SchichtenServiceDep,
    ZeiterfassungServiceDep,
)
from .ki_router import router as ki_router
from .planung_router import router as planung_router
from .schemas import (
    Abwesenheit,
    AbwesenheitCreate,
    AbwesenheitEntscheiden,
    AbwesenheitListResponse,
    Akte,
    AkteUpdate,
    Arbeitsbereich,
    ArbeitsbereichCreate,
    ArbeitsbereichUpdate,
    Arbeitszeitkonto,
    AuswertungResponse,
    AzkBuchungCreate,
    BedarfResponse,
    BewerbungEntscheiden,
    Dokument,
    DokumentAnfrage,
    DokumentUpdate,
    FeiertagsImportResponse,
    Fremdfirma,
    FremdfirmaCreate,
    FremdfirmaUpdate,
    Gespraech,
    GespraechCreate,
    GespraechUpdate,
    Konflikt,
    Krankenstand,
    LohnExportRequest,
    Massnahme,
    MassnahmeCreate,
    MassnahmeUpdate,
    MitarbeiterListResponse,
    Monatsabschluss,
    MonatsabschlussRequest,
    NachtragCreate,
    Nachweis,
    NachweisCreate,
    NachweisUpdate,
    Pausenmodell,
    PausenmodellSet,
    PersonUebersicht,
    PlanPerson,
    Qualifikation,
    QualifikationSet,
    Regeln,
    RegelnSet,
    RegelVorschlag,
    Schicht,
    SchichtCreate,
    SchichtUpdate,
    Schichtvorlage,
    SchichtvorlageCreate,
    SchichtvorlageUpdate,
    Schulung,
    SchulungCreate,
    SchulungUpdate,
    SliceHealth,
    StempelEnde,
    StempelStart,
    Urlaubskonto,
    UrlaubskontoSet,
    Urlaubssperre,
    UrlaubssperreCreate,
    Verfuegbarkeit,
    VerfuegbarkeitCreate,
    VeroeffentlichenResponse,
    Vertrag,
    VertragCreate,
    VertragUpdate,
    Vorfall,
    VorfallCreate,
    VorfallUpdate,
    WocheKopieren,
    WochenplanResponse,
    Zeiterfassung,
    ZeitKorrektur,
    ZeitListResponse,
    ZeitManuell,
)
from .terminal_router import router as terminal_router
from .ueberstunden_router import router as ueberstunden_router

router = APIRouter(prefix="/personal", tags=["personal"])

# pylint: disable=invalid-name
_MANAGE = require_permission(Capability.MANAGE_PERSONAL)
_PLAN = require_permission(Capability.PLAN_SCHICHTEN)
_TEAM = require_permission(Capability.VIEW_TEAM_SCHEDULE)
_OWN = require_permission(Capability.VIEW_OWN_SCHEDULE)
_TIME = require_permission(Capability.TRACK_OWN_TIME)
_ABSENCE = require_permission(Capability.REQUEST_ABSENCE)
_APPROVE = require_permission(Capability.APPROVE_ABSENCE)
_CONFIRM = require_permission(Capability.CONFIRM_TIME)
_EXPORT = require_permission(Capability.EXPORT_LOHN)
# pylint: enable=invalid-name

Manage = Annotated[AuthContext, Depends(_MANAGE)]
Plan = Annotated[AuthContext, Depends(_PLAN)]
Team = Annotated[AuthContext, Depends(_TEAM)]
Own = Annotated[AuthContext, Depends(_OWN)]
Time = Annotated[AuthContext, Depends(_TIME)]
Absence = Annotated[AuthContext, Depends(_ABSENCE)]
Approve = Annotated[AuthContext, Depends(_APPROVE)]
Confirm = Annotated[AuthContext, Depends(_CONFIRM)]
Export = Annotated[AuthContext, Depends(_EXPORT)]
Current = Annotated[AuthContext, Depends(get_current_user)]


def _fehler(exc: PersonalError) -> HTTPException:
    detail: object = exc.message
    if exc.details:
        detail = {"message": exc.message, **exc.details}
    return HTTPException(status_code=exc.status_code, detail=detail)


@router.get("/health", response_model=SliceHealth)
def health(service: PersonalServiceDep) -> SliceHealth:
    return service.health()


# --- Mitarbeitende & Akte -------------------------------------------------


@router.get("/mitarbeiter", response_model=MitarbeiterListResponse)
def mitarbeiter(ctx: Team, service: PersonalServiceDep) -> MitarbeiterListResponse:
    try:
        return service.mitarbeiter(ctx)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/mitarbeiter/{user_id}/akte", response_model=Akte)
def akte(user_id: str, ctx: Manage, service: PersonalServiceDep) -> Akte:
    try:
        return service.akte(ctx, user_id)
    except (PersonalError, AkteKryptoFehler) as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put("/mitarbeiter/{user_id}/akte", response_model=Akte)
def akte_speichern(user_id: str, req: AkteUpdate, ctx: Manage, service: PersonalServiceDep) -> Akte:
    try:
        return service.akte_speichern(ctx, user_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/mitarbeiter/{user_id}/qualifikationen", response_model=list[Qualifikation])
def qualifikationen(user_id: str, ctx: Team, service: PersonalServiceDep) -> list[Qualifikation]:
    try:
        return service.qualifikationen(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.put("/mitarbeiter/{user_id}/qualifikationen", response_model=list[Qualifikation])
def qualifikationen_setzen(
    user_id: str, req: list[QualifikationSet], ctx: Manage, service: PersonalServiceDep
) -> list[Qualifikation]:
    try:
        return service.qualifikationen_setzen(ctx, user_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/mitarbeiter/{user_id}/dokumente", response_model=list[Dokument])
def dokumente(user_id: str, ctx: Own, service: PersonalServiceDep) -> list[Dokument]:
    # Eigene Dokumente sieht jede Person (Attest hochladen); fremde nur im Scope
    # — der Dienst prüft `_require_person_im_scope`, die Akte bleibt MANAGE.
    try:
        return service.dokumente(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/mitarbeiter/{user_id}/dokumente/anfragen", response_model=Dokument, status_code=201)
def dokument_anfragen(
    user_id: str, req: DokumentAnfrage, ctx: Manage, service: PersonalServiceDep
) -> Dokument:
    try:
        return service.dokument_anfragen(ctx, user_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/mitarbeiter/{user_id}/dokumente", response_model=Dokument, status_code=201)
async def dokument_hochladen(  # noqa: PLR0913 — Multipart-Felder
    user_id: str,
    request: Request,
    ctx: Own,
    service: PersonalServiceDep,
    art: Annotated[str, Query(max_length=40)] = "sonstiges",
    titel: Annotated[str | None, Query(max_length=200)] = None,
    ablauf_am: Annotated[date | None, Query()] = None,
    dokument_id: Annotated[str | None, Query(max_length=40)] = None,
) -> Dokument:
    content, _ct, name = await read_upload_named(request)
    try:
        return service.dokument_hochladen(
            ctx,
            user_id,
            content=content,
            dateiname=name or "",
            art=art,
            titel=titel,
            ablauf_am=ablauf_am,
            dokument_id=dokument_id,
        )
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/dokumente/{dokument_id}", response_model=Dokument)
def dokument_aendern(
    dokument_id: str, req: DokumentUpdate, ctx: Manage, service: PersonalServiceDep
) -> Dokument:
    try:
        return service.dokument_aendern(ctx, dokument_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.delete("/dokumente/{dokument_id}", status_code=204)
def dokument_loeschen(dokument_id: str, ctx: Manage, service: PersonalServiceDep) -> Response:
    try:
        service.dokument_loeschen(ctx, dokument_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Stammdaten -----------------------------------------------------------


@router.get("/fremdfirmen", response_model=list[Fremdfirma])
def fremdfirmen(ctx: Team, service: PersonalServiceDep) -> list[Fremdfirma]:
    try:
        return service.fremdfirmen(ctx)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/fremdfirmen", response_model=Fremdfirma, status_code=201)
def fremdfirma_anlegen(
    req: FremdfirmaCreate, ctx: Manage, service: PersonalServiceDep
) -> Fremdfirma:
    try:
        return service.fremdfirma_anlegen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/fremdfirmen/{firma_id}", response_model=Fremdfirma)
def fremdfirma_aendern(
    firma_id: str, req: FremdfirmaUpdate, ctx: Manage, service: PersonalServiceDep
) -> Fremdfirma:
    try:
        return service.fremdfirma_aendern(ctx, firma_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/arbeitsbereiche", response_model=list[Arbeitsbereich])
def arbeitsbereiche(
    ctx: Own, service: PersonalServiceDep, mit_archiv: bool = False
) -> list[Arbeitsbereich]:
    try:
        return service.arbeitsbereiche(ctx, mit_archiv=mit_archiv)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/arbeitsbereiche", response_model=Arbeitsbereich, status_code=201)
def arbeitsbereich_anlegen(
    req: ArbeitsbereichCreate, ctx: Manage, service: PersonalServiceDep
) -> Arbeitsbereich:
    try:
        return service.arbeitsbereich_anlegen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/arbeitsbereiche/{bereich_id}", response_model=Arbeitsbereich)
def arbeitsbereich_aendern(
    bereich_id: str, req: ArbeitsbereichUpdate, ctx: Manage, service: PersonalServiceDep
) -> Arbeitsbereich:
    try:
        return service.arbeitsbereich_aendern(ctx, bereich_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/regeln", response_model=Regeln | None)
def regeln(ctx: Team, service: PersonalServiceDep) -> Regeln | None:
    try:
        return service.regeln(ctx)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/regeln/vorschlag", response_model=RegelVorschlag)
def regel_vorschlag(ctx: Manage, service: PersonalServiceDep) -> RegelVorschlag:
    try:
        return service.regel_vorschlag(ctx)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.put("/regeln", response_model=Regeln)
def regeln_bestaetigen(req: RegelnSet, ctx: Manage, service: PersonalServiceDep) -> Regeln:
    try:
        return service.regeln_bestaetigen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/pausenmodelle", response_model=list[Pausenmodell])
def pausenmodelle(ctx: Team, service: PersonalServiceDep) -> list[Pausenmodell]:
    try:
        return service.pausenmodelle(ctx)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.put("/pausenmodelle", response_model=list[Pausenmodell])
def pausenmodelle_setzen(
    req: list[PausenmodellSet], ctx: Manage, service: PersonalServiceDep
) -> list[Pausenmodell]:
    try:
        return service.pausenmodelle_setzen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/vorlagen", response_model=list[Schichtvorlage])
def vorlagen(
    ctx: Own, service: PersonalServiceDep, mit_archiv: bool = False
) -> list[Schichtvorlage]:
    try:
        return service.vorlagen(ctx, mit_archiv=mit_archiv)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/vorlagen", response_model=Schichtvorlage, status_code=201)
def vorlage_anlegen(
    req: SchichtvorlageCreate, ctx: Manage, service: PersonalServiceDep
) -> Schichtvorlage:
    try:
        return service.vorlage_anlegen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/vorlagen/{vorlage_id}", response_model=Schichtvorlage)
def vorlage_aendern(
    vorlage_id: str, req: SchichtvorlageUpdate, ctx: Manage, service: PersonalServiceDep
) -> Schichtvorlage:
    try:
        return service.vorlage_aendern(ctx, vorlage_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/feiertage/import", response_model=FeiertagsImportResponse)
def feiertage_import(
    ctx: Manage,
    service: PersonalServiceDep,
    jahr: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> FeiertagsImportResponse:
    """Feiertage des Betriebslandes für laufendes + nächstes Jahr (oder `jahr`)."""
    from . import feiertage as feiertage_mod  # noqa: PLC0415 — nur hier gebraucht

    try:
        tenant_id = service._require_tenant(ctx)  # noqa: SLF001 — Router-Helfer  # pylint: disable=protected-access
        land = service._tenant_land(tenant_id)  # noqa: SLF001  # pylint: disable=protected-access
        jahre = [jahr] if jahr else [date.today().year, date.today().year + 1]
        eingefuegt, vorhanden = feiertage_mod.importieren(service._db, land, jahre)  # noqa: SLF001  # pylint: disable=protected-access
    except PersonalError as exc:
        raise _fehler(exc) from exc
    except feiertage_mod.FeiertageFehlen as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return FeiertagsImportResponse(
        land=land, jahre=jahre, eingefuegt=eingefuegt, vorhanden=vorhanden
    )


# --- Dienstplan -----------------------------------------------------------


@router.get("/dienstplan", response_model=WochenplanResponse)
def wochenplan(
    ctx: Team, service: SchichtenServiceDep, woche: Annotated[date, Query()]
) -> WochenplanResponse:
    try:
        return service.wochenplan(ctx, woche)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/dienstplan/mein", response_model=WochenplanResponse)
def mein_plan(
    ctx: Own, service: SchichtenServiceDep, woche: Annotated[date, Query()]
) -> WochenplanResponse:
    try:
        return service.wochenplan(ctx, woche, nur_eigene=True)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/dienstplan/konflikte", response_model=list[Konflikt])
def konflikte_vorschau(
    req: SchichtCreate, ctx: Plan, service: SchichtenServiceDep
) -> list[Konflikt]:
    try:
        return service.konflikte_vorschau(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/schichten", response_model=Schicht, status_code=201)
def schicht_anlegen(req: SchichtCreate, ctx: Plan, service: SchichtenServiceDep) -> Schicht:
    try:
        return service.anlegen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/schichten/{schicht_id}", response_model=Schicht)
def schicht_aendern(
    schicht_id: str, req: SchichtUpdate, ctx: Plan, service: SchichtenServiceDep
) -> Schicht:
    try:
        return service.aendern(ctx, schicht_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.delete("/schichten/{schicht_id}", status_code=204)
def schicht_loeschen(schicht_id: str, ctx: Plan, service: SchichtenServiceDep) -> Response:
    try:
        service.loeschen(ctx, schicht_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/schichten/{schicht_id}/bestaetigen", response_model=Schicht)
def schicht_bestaetigen(schicht_id: str, ctx: Own, service: SchichtenServiceDep) -> Schicht:
    try:
        return service.bestaetigen(ctx, schicht_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/schichten/{schicht_id}/bewerben", response_model=Schicht)
def schicht_bewerben(
    schicht_id: str, ctx: Own, service: SchichtenServiceDep, zurueck: bool = False
) -> Schicht:
    try:
        return service.bewerben(ctx, schicht_id, zurueck=zurueck)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/schichten/{schicht_id}/bewerbungen", response_model=list[PlanPerson])
def schicht_bewerbungen(
    schicht_id: str, ctx: Plan, service: SchichtenServiceDep
) -> list[PlanPerson]:
    try:
        return service.bewerbungen(ctx, schicht_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/schichten/{schicht_id}/bewerbungen/entscheiden", response_model=Schicht)
def bewerbung_entscheiden(
    schicht_id: str, req: BewerbungEntscheiden, ctx: Plan, service: SchichtenServiceDep
) -> Schicht:
    try:
        return service.bewerbung_entscheiden(ctx, schicht_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/dienstplan/kopieren", response_model=BedarfResponse)
def woche_kopieren(req: WocheKopieren, ctx: Plan, service: SchichtenServiceDep) -> BedarfResponse:
    try:
        return service.woche_kopieren(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/dienstplan/veroeffentlichen", response_model=VeroeffentlichenResponse)
def veroeffentlichen(
    ctx: Plan, service: SchichtenServiceDep, woche: Annotated[date, Query()]
) -> VeroeffentlichenResponse:
    try:
        return service.veroeffentlichen(ctx, woche)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/dienstplan/gelesen", status_code=204)
def lesebestaetigung(
    ctx: Own, service: SchichtenServiceDep, woche: Annotated[date, Query()]
) -> Response:
    try:
        service.lesebestaetigung(ctx, woche)
    except PersonalError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/dienstplan/bedarf", response_model=BedarfResponse)
def bedarf(
    ctx: Plan, service: SchichtenServiceDep, woche: Annotated[date, Query()]
) -> BedarfResponse:
    try:
        return service.bedarf_aus_aufgaben(ctx, woche)
    except PersonalError as exc:
        raise _fehler(exc) from exc


# --- Abwesenheit & Verfügbarkeit -----------------------------------------


@router.get("/abwesenheiten", response_model=AbwesenheitListResponse)
def abwesenheiten(
    ctx: Own,
    service: AbwesenheitenServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> AbwesenheitListResponse:
    try:
        return service.liste(ctx, von, bis, status=status_filter)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/abwesenheiten", response_model=Abwesenheit, status_code=201)
def abwesenheit_beantragen(
    req: AbwesenheitCreate, ctx: Absence, service: AbwesenheitenServiceDep
) -> Abwesenheit:
    try:
        return service.beantragen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/abwesenheiten/{antrag_id}/entscheiden", response_model=Abwesenheit)
def abwesenheit_entscheiden(
    antrag_id: str, req: AbwesenheitEntscheiden, ctx: Approve, service: AbwesenheitenServiceDep
) -> Abwesenheit:
    try:
        return service.entscheiden(ctx, antrag_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/abwesenheiten/{antrag_id}/stornieren", response_model=Abwesenheit)
def abwesenheit_stornieren(
    antrag_id: str, ctx: Absence, service: AbwesenheitenServiceDep
) -> Abwesenheit:
    try:
        return service.stornieren(ctx, antrag_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/urlaubskonten", response_model=list[Urlaubskonto])
def urlaubskonten(
    ctx: Team, service: AbwesenheitenServiceDep, jahr: Annotated[int, Query(..., ge=2000, le=2100)]
) -> list[Urlaubskonto]:
    try:
        return service.urlaubskonten(ctx, jahr)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/mitarbeiter/{user_id}/urlaubskonto", response_model=Urlaubskonto)
def urlaubskonto(
    user_id: str,
    ctx: Own,
    service: AbwesenheitenServiceDep,
    jahr: Annotated[int, Query(..., ge=2000, le=2100)],
) -> Urlaubskonto:
    try:
        return service.urlaubskonto(ctx, user_id, jahr)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.put("/mitarbeiter/{user_id}/urlaubskonto", response_model=Urlaubskonto)
def urlaubskonto_setzen(
    user_id: str,
    req: UrlaubskontoSet,
    ctx: Manage,
    service: AbwesenheitenServiceDep,
    jahr: Annotated[int, Query(..., ge=2000, le=2100)],
) -> Urlaubskonto:
    try:
        return service.urlaubskonto_setzen(ctx, user_id, jahr, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/urlaubssperren", response_model=list[Urlaubssperre])
def sperren(ctx: Own, service: AbwesenheitenServiceDep) -> list[Urlaubssperre]:
    try:
        return service.sperren(ctx)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/urlaubssperren", response_model=Urlaubssperre, status_code=201)
def sperre_anlegen(
    req: UrlaubssperreCreate, ctx: Approve, service: AbwesenheitenServiceDep
) -> Urlaubssperre:
    try:
        return service.sperre_anlegen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.delete("/urlaubssperren/{sperre_id}", status_code=204)
def sperre_loeschen(sperre_id: str, ctx: Approve, service: AbwesenheitenServiceDep) -> Response:
    try:
        service.sperre_loeschen(ctx, sperre_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/mitarbeiter/{user_id}/verfuegbarkeiten", response_model=list[Verfuegbarkeit])
def verfuegbarkeiten(
    user_id: str, ctx: Own, service: AbwesenheitenServiceDep
) -> list[Verfuegbarkeit]:
    try:
        return service.verfuegbarkeiten(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/verfuegbarkeiten", response_model=Verfuegbarkeit, status_code=201)
def verfuegbarkeit_anlegen(
    req: VerfuegbarkeitCreate, ctx: Absence, service: AbwesenheitenServiceDep
) -> Verfuegbarkeit:
    try:
        return service.verfuegbarkeit_anlegen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.delete("/verfuegbarkeiten/{verf_id}", status_code=204)
def verfuegbarkeit_loeschen(
    verf_id: str, ctx: Absence, service: AbwesenheitenServiceDep
) -> Response:
    try:
        service.verfuegbarkeit_loeschen(ctx, verf_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/krankenstand", response_model=list[Krankenstand])
def krankenstand(
    ctx: Team,
    service: AbwesenheitenServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> list[Krankenstand]:
    try:
        return service.krankenstand(ctx, von, bis)
    except PersonalError as exc:
        raise _fehler(exc) from exc


# --- Zeiterfassung --------------------------------------------------------


@router.get("/zeiterfassung/offen", response_model=Zeiterfassung | None)
def zeit_offen(ctx: Time, service: ZeiterfassungServiceDep) -> Zeiterfassung | None:
    try:
        return service.offene(ctx)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/zeiterfassung/start", response_model=Zeiterfassung, status_code=201)
def zeit_start(req: StempelStart, ctx: Time, service: ZeiterfassungServiceDep) -> Zeiterfassung:
    try:
        return service.start(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/zeiterfassung/pause", response_model=Zeiterfassung)
def zeit_pause(ctx: Time, service: ZeiterfassungServiceDep, beenden: bool = False) -> Zeiterfassung:
    try:
        return service.pause(ctx, beenden=beenden)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/zeiterfassung/ende", response_model=Zeiterfassung)
def zeit_ende(req: StempelEnde, ctx: Time, service: ZeiterfassungServiceDep) -> Zeiterfassung:
    try:
        return service.ende(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/zeiterfassung", response_model=ZeitListResponse)
def zeiten(
    ctx: Own,
    service: ZeiterfassungServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
    user_id: Annotated[str | None, Query()] = None,
) -> ZeitListResponse:
    try:
        return service.liste(ctx, von, bis, user_id=user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/zeiterfassung/{zeit_id}", response_model=Zeiterfassung)
def zeit_korrigieren(
    zeit_id: str, req: ZeitKorrektur, ctx: Confirm, service: ZeiterfassungServiceDep
) -> Zeiterfassung:
    try:
        return service.korrigieren(ctx, zeit_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/zeiterfassung/nachtrag", response_model=Zeiterfassung, status_code=201)
def zeit_nachtragen(
    req: ZeitManuell, ctx: Confirm, service: ZeiterfassungServiceDep
) -> Zeiterfassung:
    try:
        return service.nachtragen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/zeiterfassung/{zeit_id}/bestaetigen", response_model=Zeiterfassung)
def zeit_bestaetigen(zeit_id: str, ctx: Confirm, service: ZeiterfassungServiceDep) -> Zeiterfassung:
    try:
        return service.bestaetigen(ctx, zeit_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.delete("/zeiterfassung/{zeit_id}", status_code=204)
def zeit_loeschen(
    zeit_id: str,
    ctx: Confirm,
    service: ZeiterfassungServiceDep,
    grund: Annotated[str, Query(..., min_length=3, max_length=500)],
) -> Response:
    try:
        service.loeschen(ctx, zeit_id, grund=grund)
    except PersonalError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/mitarbeiter/{user_id}/arbeitszeitkonto", response_model=Arbeitszeitkonto)
def arbeitszeitkonto(user_id: str, ctx: Own, service: ZeiterfassungServiceDep) -> Arbeitszeitkonto:
    try:
        return service.arbeitszeitkonto(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/arbeitszeitkonto", response_model=Arbeitszeitkonto)
def azk_buchen(
    req: AzkBuchungCreate, ctx: Confirm, service: ZeiterfassungServiceDep
) -> Arbeitszeitkonto:
    try:
        return service.azk_buchen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/monatsabschluesse", response_model=list[Monatsabschluss])
def monatsabschluesse(
    ctx: Team,
    service: ZeiterfassungServiceDep,
    jahr: Annotated[int, Query(..., ge=2000, le=2100)],
    monat: Annotated[int, Query(..., ge=1, le=12)],
) -> list[Monatsabschluss]:
    try:
        return service.monatsabschluesse(ctx, jahr, monat)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/monatsabschluesse", response_model=list[Monatsabschluss])
def monat_abschliessen(
    req: MonatsabschlussRequest, ctx: Confirm, service: ZeiterfassungServiceDep
) -> list[Monatsabschluss]:
    try:
        return service.monat_abschliessen(ctx, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


# --- Auswertung & Lohn ----------------------------------------------------


@router.get("/auswertung", response_model=AuswertungResponse)
def auswertung(
    ctx: Export,
    service: AuswertungServiceDep,
    von: Annotated[date, Query()],
    bis: Annotated[date, Query()],
) -> AuswertungResponse:
    try:
        return service.auswerten(ctx, von, bis)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/lohnexport")
def lohnexport(req: LohnExportRequest, ctx: Export, service: AuswertungServiceDep) -> Response:
    try:
        name, inhalt, mime = service.lohnexport(ctx, req)
    except PersonalError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": {"message": exc.message, **(exc.details or {})}},
        )
    except AkteKryptoFehler as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return Response(
        content=inhalt,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


__all__ = ["Current", "router"]


# --- Kartei (0543) ---------------------------------------------------------


@router.get("/mitarbeiter/{user_id}/uebersicht", response_model=PersonUebersicht)
def uebersicht(user_id: str, ctx: Team, service: KarteiServiceDep) -> PersonUebersicht:
    try:
        return service.uebersicht(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/mitarbeiter/{user_id}/vertraege", response_model=list[Vertrag])
def vertraege(user_id: str, ctx: Manage, service: KarteiServiceDep) -> list[Vertrag]:
    try:
        return service.vertraege(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/mitarbeiter/{user_id}/vertraege", response_model=Vertrag, status_code=201)
def vertrag_anlegen(
    user_id: str, req: VertragCreate, ctx: Manage, service: KarteiServiceDep
) -> Vertrag:
    try:
        return service.vertrag_anlegen(ctx, user_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/kartei/vertraege/{zeile_id}", response_model=Vertrag)
def vertrag_aendern(
    zeile_id: str, req: VertragUpdate, ctx: Manage, service: KarteiServiceDep
) -> Vertrag:
    try:
        return service.vertrag_aendern(ctx, zeile_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/kartei/vertraege/{zeile_id}/nachtraege", response_model=Vertrag, status_code=201)
def nachtrag_anlegen(
    zeile_id: str, req: NachtragCreate, ctx: Manage, service: KarteiServiceDep
) -> Vertrag:
    try:
        return service.nachtrag_anlegen(ctx, zeile_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.delete("/kartei/nachtraege/{nachtrag_id}", status_code=204)
def nachtrag_loeschen(nachtrag_id: str, ctx: Manage, service: KarteiServiceDep) -> Response:
    try:
        service.nachtrag_loeschen(ctx, nachtrag_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/mitarbeiter/{user_id}/massnahmen", response_model=list[Massnahme])
def massnahmen(user_id: str, ctx: Manage, service: KarteiServiceDep) -> list[Massnahme]:
    try:
        return service.massnahmen(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/mitarbeiter/{user_id}/massnahmen", response_model=Massnahme, status_code=201)
def massnahme_anlegen(
    user_id: str, req: MassnahmeCreate, ctx: Manage, service: KarteiServiceDep
) -> Massnahme:
    try:
        return service.massnahme_anlegen(ctx, user_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/kartei/massnahmen/{zeile_id}", response_model=Massnahme)
def massnahme_aendern(
    zeile_id: str, req: MassnahmeUpdate, ctx: Manage, service: KarteiServiceDep
) -> Massnahme:
    try:
        return service.massnahme_aendern(ctx, zeile_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/mitarbeiter/{user_id}/vorfaelle", response_model=list[Vorfall])
def vorfaelle(user_id: str, ctx: Manage, service: KarteiServiceDep) -> list[Vorfall]:
    try:
        return service.vorfaelle(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/mitarbeiter/{user_id}/vorfaelle", response_model=Vorfall, status_code=201)
def vorfall_anlegen(
    user_id: str, req: VorfallCreate, ctx: Manage, service: KarteiServiceDep
) -> Vorfall:
    try:
        return service.vorfall_anlegen(ctx, user_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/kartei/vorfaelle/{zeile_id}", response_model=Vorfall)
def vorfall_aendern(
    zeile_id: str, req: VorfallUpdate, ctx: Manage, service: KarteiServiceDep
) -> Vorfall:
    try:
        return service.vorfall_aendern(ctx, zeile_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/mitarbeiter/{user_id}/gespraeche", response_model=list[Gespraech])
def gespraeche(user_id: str, ctx: Manage, service: KarteiServiceDep) -> list[Gespraech]:
    try:
        return service.gespraeche(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/mitarbeiter/{user_id}/gespraeche", response_model=Gespraech, status_code=201)
def gespraech_anlegen(
    user_id: str, req: GespraechCreate, ctx: Manage, service: KarteiServiceDep
) -> Gespraech:
    try:
        return service.gespraech_anlegen(ctx, user_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/kartei/gespraeche/{zeile_id}", response_model=Gespraech)
def gespraech_aendern(
    zeile_id: str, req: GespraechUpdate, ctx: Manage, service: KarteiServiceDep
) -> Gespraech:
    try:
        return service.gespraech_aendern(ctx, zeile_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/mitarbeiter/{user_id}/nachweise", response_model=list[Nachweis])
def nachweise(user_id: str, ctx: Team, service: KarteiServiceDep) -> list[Nachweis]:
    try:
        return service.nachweise(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/mitarbeiter/{user_id}/nachweise", response_model=Nachweis, status_code=201)
def nachweis_anlegen(
    user_id: str, req: NachweisCreate, ctx: Manage, service: KarteiServiceDep
) -> Nachweis:
    try:
        return service.nachweis_anlegen(ctx, user_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/kartei/nachweise/{zeile_id}", response_model=Nachweis)
def nachweis_aendern(
    zeile_id: str, req: NachweisUpdate, ctx: Manage, service: KarteiServiceDep
) -> Nachweis:
    try:
        return service.nachweis_aendern(ctx, zeile_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.get("/mitarbeiter/{user_id}/schulungen", response_model=list[Schulung])
def schulungen(user_id: str, ctx: Team, service: KarteiServiceDep) -> list[Schulung]:
    try:
        return service.schulungen(ctx, user_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.post("/mitarbeiter/{user_id}/schulungen", response_model=Schulung, status_code=201)
def schulung_anlegen(
    user_id: str, req: SchulungCreate, ctx: Manage, service: KarteiServiceDep
) -> Schulung:
    try:
        return service.schulung_anlegen(ctx, user_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.patch("/kartei/schulungen/{zeile_id}", response_model=Schulung)
def schulung_aendern(
    zeile_id: str, req: SchulungUpdate, ctx: Manage, service: KarteiServiceDep
) -> Schulung:
    try:
        return service.schulung_aendern(ctx, zeile_id, req)
    except PersonalError as exc:
        raise _fehler(exc) from exc


@router.delete("/kartei/{bereich}/{zeile_id}", status_code=204)
def kartei_loeschen(
    bereich: str, zeile_id: str, ctx: Manage, service: KarteiServiceDep
) -> Response:
    try:
        service.loeschen(ctx, bereich, zeile_id)
    except PersonalError as exc:
        raise _fehler(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Teil-Router des Ausbaus (0544–0547, Vertrag §0) ------------------------
#
# Die Pakete bringen eigene `APIRouter()` ohne prefix mit; hier werden sie
# unter demselben `/personal` eingehängt. Ein Teil-Router kann die Guards nicht
# aus dieser Datei importieren (Import-Zirkel) — sie stehen deshalb in
# `_guards.py`.
#
# REIHENFOLGE IST BEDEUTUNG: `ueberstunden_router` trägt
# `/kartei/aenderungen/{id}`, und weiter oben steht der Sammelpfad
# `/kartei/{bereich}/{zeile_id}`. FastAPI nimmt den ERSTEN Treffer — stünde der
# Teil-Router hinten, landete jedes Löschen einer terminierten Änderung im
# Kartei-Löschweg und käme dort als unbekannter Bereich mit 422 zurück.
# Dasselbe gilt für `/dienstplan/zeitraum`, `/dienstplan/kennzahlen` und
# `/dienstplan/leeren` gegenüber `/dienstplan`.
router.include_router(planung_router)
router.include_router(bedarf_router)
router.include_router(ki_router)
router.include_router(terminal_router)
router.include_router(ueberstunden_router)
router.include_router(berichte_router)
