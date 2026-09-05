"""Router für pricing. Gemountet unter /api/v1/pricing.

Zentrale Preis-Endpunkte: Effektivpreis pro Tag und vollständiger Buchungs-Quote.
Lesend (VIEW_CALENDAR genügt) — die Berechnung verändert keine Daten. Dazu die
Dynamic-Pricing-Einstellungen je Objekt (dp_settings) und der tägliche Cron-
Recompute (per Secret abgesichert).
"""
from datetime import date
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
)

from src.core.security import AuthContext, require_internal_cron_secret
from src.core.supabase import get_service_client
from src.features.auth.dependencies import (
    require_granular_permission,
    require_permission,
)
from src.features.auth.granular_permissions import Permission
from src.features.auth.permissions import Capability
from src.jobs.queue import try_enqueue_recompute

from .auskunft import AuskunftService
from .ki_berater import DpKiBerater
from .ki_schemas import (
    Forecast,
    FreigabeStand,
    KiPruefung,
    KiVorschlaegeResponse,
    KiVorschlag,
    KiVorschlagAnnehmen,
    MarktStand,
    Portalstand,
    Preisbericht,
    Preisgrenze,
    PreisgrenzeAnlegen,
    StufenVorschau,
    TagesmodusAntwort,
    TagesmodusEintrag,
    TagesmodusSetzen,
    VerlaufEintrag,
    VorschauTag,
)
from .market.stand import marktstand_bauen
from .portalstand import PortalstandService
from .preisbericht import PreisberichtService
from .preisgrenzen_service import PreisgrenzenService
from .recompute import DynamicPricingRecompute
from .resolver import PricingError, PricingResolver
from .schemas import (
    DpOverviewResponse,
    DpSettingsResponse,
    DpSettingsUpdate,
    EffectivePriceDay,
    PriceExplainResponse,
    PriceSuggestResponse,
    QuoteRequest,
    QuoteResponse,
    RecomputeResponse,
    SliceHealth,
)
from .settings_service import DpSettingsService
from .tagesmodus_service import TagesmodusService

router = APIRouter(prefix="/pricing", tags=["pricing"])


def get_pricing_resolver() -> PricingResolver:
    return PricingResolver(service_client=get_service_client())


def get_dp_settings_service() -> DpSettingsService:
    return DpSettingsService(service_client=get_service_client())


PricingResolverDep = Annotated[PricingResolver, Depends(get_pricing_resolver)]
DpSettingsServiceDep = Annotated[DpSettingsService, Depends(get_dp_settings_service)]


@router.get("/health", response_model=SliceHealth)
def health() -> SliceHealth:
    return SliceHealth(slice="pricing")


@router.get("/effective", response_model=list[EffectivePriceDay])
def effective_prices(
    resolver: PricingResolverDep,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
    property_id: Annotated[str, Query()],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> list[EffectivePriceDay]:
    """Effektivpreis je Tag [start, end) — override > dynamic > weekday > base.

    Preis-Sichtbarkeit (PM_BOOKING_TOTAL) ist Pflicht: ein Eigentümer sieht laut
    Daten-Split §4.2 keine Preise/Gesamtbeträge — deshalb reicht VIEW_CALENDAR
    hier NICHT (sonst umginge der Owner die Preis-Maskierung über /effective).

    Tenant-Scope: der Resolver liest nur nach property_id (Service-Role-Key umgeht
    RLS), daher muss das Objekt-Eigentum HIER geprüft werden, bevor Preise eines
    fremden Objekts ausgegeben werden könnten."""
    try:
        settings.require_own_property(ctx, property_id)
        return resolver.effective_prices(property_id, start, end)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/quote", response_model=QuoteResponse)
def quote(
    req: QuoteRequest,
    resolver: PricingResolverDep,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> QuoteResponse:
    """Vollständige Preisaufschlüsselung eines Aufenthalts (Wizard/Buchung).

    Preis-Sichtbarkeit (PM_BOOKING_TOTAL) ist Pflicht (wie /effective): der Quote
    gibt Gesamtpreis + Aufschlüsselung aus, die ein Owner laut §4.2 nicht sehen
    darf. Tenant-Scope: Eigentum am Objekt prüfen, bevor ein vollständiger Quote
    (inkl. Konfig/Gebühren/Add-ons eines fremden Objekts) berechnet wird."""
    try:
        settings.require_own_property(ctx, req.property_id)
        return resolver.quote(req)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# -- Dynamic Pricing: Objekt-Übersicht (Hostaway-Tabelle) --------------------
@router.get("/overview", response_model=DpOverviewResponse)
def dp_overview(
    service: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> DpOverviewResponse:
    """Alle Objekte des Kontos mit ihrem Dynamic-Pricing-Status (eine Zeile je
    Objekt: Aktiv, Basispreis-Modus + effektiver Basispreis, Min/Max)."""
    try:
        return service.overview(ctx)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# -- Dynamic Pricing: Einstellungen je Objekt --------------------------------
@router.get("/settings/{property_id}", response_model=DpSettingsResponse)
def get_dp_settings(
    property_id: str,
    service: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> DpSettingsResponse:
    """Dynamic-Pricing-Einstellungen eines Objekts (Defaults, falls leer)."""
    try:
        return service.get(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/settings/{property_id}/suggest", response_model=PriceSuggestResponse)
def suggest_price_range(
    property_id: str,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> PriceSuggestResponse:
    """Empfohlene Smart-Pricing-Spanne (min/max) aus der ECHTEN Dynamic-Pricing-
    Engine — die Extrema der nachfrage-/saison-/wochenend-getriebenen Tagespreise
    über 365 Tage (ein volles Jahr, jede Saison einmal). Kein erfundener
    Multiplikator (Wurzel 4).

    Owner-Scope + PM_BOOKING_TOTAL wie /effective: ein Owner ohne Preis-Recht darf
    keine Preise ableiten; der Resolver liest ungescopet (Service-Role) → Eigentum
    hier prüfen."""
    try:
        settings.require_own_property(ctx, property_id)
        rng = DynamicPricingRecompute(get_service_client()).suggest_range(property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if not rng:
        return PriceSuggestResponse(property_id=property_id, available=False)
    return PriceSuggestResponse(
        property_id=property_id,
        available=True,
        min_price=rng["min"],
        max_price=rng["max"],
    )


@router.get(
    "/settings/{property_id}/ki-vorschlaege",
    response_model=KiVorschlaegeResponse,
)
def ki_vorschlaege(
    property_id: str,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> KiVorschlaegeResponse:
    """Regel-Vorschläge des KI-Beraters — EINSTELLUNGEN, keine Preise.

    Der Server rechnet die Vorschläge aus der eigenen Buchungshistorie; das
    Sprachmodell steuert nur den erklärenden Satz bei. Eine leere Liste ist ein
    gültiges Ergebnis (zu dünne Datenlage oder die Regeln passen bereits) und
    wird mit `hinweis` begründet — sonst sähe sie wie ein Fehler aus.

    Gleicher Scope wie /suggest: Eigentum prüfen (der Berater liest ungescopet
    über die Service-Role) und Preis-Recht verlangen.
    """
    try:
        settings.require_own_property(ctx, property_id)
        berater = DpKiBerater(get_service_client())
        vorschlaege = berater.vorschlaege(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    # Der Hinweis nennt den zutreffenden Grund, statt zwei mögliche
    # aufzuzählen. Welcher es je Regel ist, steht in `pruefungen`.
    duenn = sum(1 for p in berater.pruefungen if p.ergebnis == "zu_wenig_daten")
    hinweis = None
    if not vorschlaege:
        hinweis = (
            "Für alle geprüften Regeln fehlen noch Buchungsdaten."
            if duenn and duenn == len(berater.pruefungen)
            else "Die geprüften Regeln passen bereits — Einzelheiten unten."
        )
    return KiVorschlaegeResponse(
        property_id=property_id,
        vorschlaege=[KiVorschlag(**vars(v)) for v in vorschlaege],
        hinweis=hinweis,
        pruefungen=[KiPruefung(**vars(p)) for p in berater.pruefungen],
    )


@router.post(
    "/settings/{property_id}/ki-vorschlaege/annehmen",
    response_model=DpSettingsResponse,
)
def ki_vorschlag_annehmen(
    property_id: str,
    req: KiVorschlagAnnehmen,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> DpSettingsResponse:
    """Genau EINEN Vorschlag übernehmen — er wird VORHER neu berechnet.

    Der Client schickt nur, WELCHES Feld er annimmt; den Wert nimmt der Server
    aus seiner eigenen, frisch gerechneten Empfehlung. Würde der Client den Wert
    liefern, wäre dies ein zweiter Schreibweg in dp_settings an der Validierung
    vorbei — ein Klient könnte einen Wochenendaufschlag von 900 % setzen und ihn
    „KI-Vorschlag" nennen (Wurzel 3).
    """
    try:
        settings.require_own_property(ctx, property_id)
        # Ohne KI-Begründung: hier zählt nur der Wert, nicht der Erklärtext —
        # das spart einen bezahlten Modellaufruf beim Annehmen.
        aktuell = DpKiBerater(get_service_client()).vorschlaege(
            ctx, property_id, mit_begruendung=False
        )
        passend = next((v for v in aktuell if v.feld == req.feld), None)
        if passend is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Dieser Vorschlag gilt nicht mehr — die Datenlage hat sich "
                    "geändert. Bitte die Vorschläge neu laden."
                ),
            )
        # Wurzel 5: Ein Feld, das DpSettingsUpdate nicht kennt, wird von
        # Pydantic still verworfen — `update` speichert dann NICHTS und meldet
        # trotzdem 200. Genau so ist es live mit `occupancy_steps` passiert:
        # der Nutzer klickte "Übernehmen", bekam Erfolg, und die Regel war nie
        # da. Der Vorschlag muss also ein echtes Schema-Feld benennen.
        patch = DpSettingsUpdate(**{passend.feld: passend.wert_neu})
        if passend.feld not in patch.model_dump(exclude_none=True):
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Die Einstellung '{passend.feld}' kann nicht gespeichert "
                    "werden — bitte den Vorschlag nicht übernehmen."
                ),
            )
        antwort = settings.update(ctx, property_id, patch)
        # Wie beim regulären PUT: die neue Regel muss auch WIRKEN. Ohne diesen
        # Job stünde die Einstellung in dp_settings, dynamic_prices trüge aber
        # weiter die alten Werte — der Dialog hat gerade "+21 % Ø-Preis"
        # versprochen, und im Kalender änderte sich bis zum nächsten Cron
        # nichts. Als JOB, nicht synchron: der Worker fährt den Channex-Push
        # mit Token-Budget (Wurzel 2/5).
        if antwort.enabled and ctx.tenant_id:
            try_enqueue_recompute(get_service_client(), ctx.tenant_id, property_id)
        # Erst NACH dem erfolgreichen Speichern protokollieren: eine gemerkte
        # Annahme, deren Einstellung gar nicht ankam, wäre eine Falschaussage
        # in der Entscheidungshistorie.
        DpKiBerater(get_service_client()).entscheidung_merken(
            ctx, property_id, passend, angenommen=True
        )
        return antwort
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/settings/{property_id}/ki-vorschlaege/ablehnen",
    status_code=204,
)
def ki_vorschlag_ablehnen(
    property_id: str,
    req: KiVorschlagAnnehmen,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> None:
    """Einen Vorschlag ablehnen — er ruht dann, bis sich die Zahl deutlich ändert.

    Nicht „für immer verwerfen": ändert sich die Datenlage wesentlich, darf
    derselbe Rat mit neuer Zahl wiederkommen. Ein Berater, der nach einer
    Ablehnung dauerhaft zu einem Thema schweigt, verliert mit der Zeit seinen
    Nutzen — einer, der unverändert nervt, ebenso.
    """
    try:
        settings.require_own_property(ctx, property_id)
        berater = DpKiBerater(get_service_client())
        aktuell = berater.vorschlaege(ctx, property_id, mit_begruendung=False)
        passend = next((v for v in aktuell if v.feld == req.feld), None)
        if passend is None:
            # Kein Fehler: der Vorschlag ist ohnehin weg. Ein 409 hier zwänge
            # die Oberfläche zu einer Fehlermeldung für einen Zustand, der
            # genau das gewünschte Ergebnis ist.
            return
        berater.entscheidung_merken(ctx, property_id, passend, angenommen=False)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.put(
    "/settings/{property_id}",
    response_model=DpSettingsResponse,
    dependencies=[Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS))],
)
def put_dp_settings(
    property_id: str,
    req: DpSettingsUpdate,
    service: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> DpSettingsResponse:
    """Dynamic-Pricing-Einstellungen setzen. Recompute läuft per Cron/Hook."""
    try:
        result = service.update(ctx, property_id, req)
        # Bei aktiviertem DP einmal rechnen, damit der Kalender direkt dynamische
        # Preise zeigt. NICHT synchron im Request (würde am Channex-Push/Rate-Limit
        # hängen) und NICHT als budgetloser Background-Task: als Recompute-JOB
        # einreihen, damit der Worker den Rate-Push mit Channex-Token-Budget fährt
        # (kein Umgehen des kontoweiten 20/min-Limits, wenn mehrere Objekte
        # gleichzeitig aktiviert werden — Wurzel 2/5, Channex-Zertifizierung Test 12).
        if result.enabled and ctx.tenant_id:
            try_enqueue_recompute(get_service_client(), ctx.tenant_id, property_id)
        return result
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/explain/{property_id}", response_model=PriceExplainResponse)
def explain_dynamic_price(
    property_id: str,
    day: Annotated[date, Query(description="Aufenthaltstag (ISO)")],
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> PriceExplainResponse:
    """KI-Klartext-Begründung für den berechneten dynamischen Preis eines Tages
    (on-demand, 'Warum dieser Preis?'). Liest den fertig berechneten Preis +
    Faktor-Aufschlüsselung aus dynamic_prices und lässt das LLM sie ausformulieren —
    es rechnet nicht selbst. Ohne dynamischen Preis (DP aus / kein Recompute) oder
    ohne Groq-Key gibt es einen klaren Fehler (keine erfundene Erklärung)."""
    from .explain import PriceExplainError, explain_price

    db = get_service_client()
    if db is None:
        raise HTTPException(status_code=500, detail="Preis-DB nicht verfügbar.")
    service = DpSettingsService(service_client=db)
    try:
        # Scope-Prüfung, DB-Zugriffe und Basispreis-Ableitung liegen im Service.
        base_price, price, factors, currency = service.explain_input(
            ctx, property_id, day.isoformat()
        )
        explanation = explain_price(
            base_price=base_price,
            final_price=price,
            factors=factors,
            currency=currency,
            day=day.isoformat(),
        )
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except PriceExplainError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return PriceExplainResponse(
        property_id=property_id, date=day, price=price, explanation=explanation
    )


# -- Dynamic Pricing: täglicher Recompute (Cron, per Secret) -----------------
@router.post("/recompute", response_model=RecomputeResponse, include_in_schema=False)
def recompute(
    x_internal_cron_secret: Annotated[str | None, Header()] = None,
) -> RecomputeResponse:
    """Interner Cron-Trigger: berechnet die dynamischen Preise ALLER Objekte mit
    aktiviertem Dynamic Pricing neu (Horizont 540 Tage) und pusht sie an Channex.
    Kein JWT — via eigenem INTERNAL_CRON_SECRET abgesichert (nie das outbound
    geteilte Channex-Webhook-Secret), getriggert durch einen
    Coolify-Scheduled-Task / Host-crontab (curl)."""
    require_internal_cron_secret(x_internal_cron_secret)
    result = DynamicPricingRecompute(
        service_client=get_service_client()
    ).recompute_all()
    return RecomputeResponse(**result)


# ---------------------------------------------------------------------------
# Tagesmodus + Freigabe
#
# Beide beantworten "wer entscheidet, welcher Preis rausgeht": der Tagesmodus
# je Datum, die Freigabe je Objekt. Dieselbe Rechteschwelle wie /suggest —
# wer Preise sieht, darf sie hier steuern.
# ---------------------------------------------------------------------------


def get_tagesmodus_service() -> TagesmodusService:
    return TagesmodusService(service_client=get_service_client())


TagesmodusServiceDep = Annotated[
    TagesmodusService, Depends(get_tagesmodus_service)
]


@router.put(
    "/tagesmodus/{property_id}",
    response_model=TagesmodusAntwort,
    dependencies=[
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS))
    ],
)
def tagesmodus_setzen(
    property_id: str,
    req: TagesmodusSetzen,
    service: TagesmodusServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> TagesmodusAntwort:
    """Preis-Modus für einen Datumsbereich setzen.

    'dynamisch' (berechneter Preis), 'anpassung' (berechnet ± Prozent) oder
    'manuell' (fester Betrag). Der Wechsel weg von 'manuell' löst den festen
    Preis wieder auf — sonst schlüge er weiter die Automatik (Wurzel 1).
    """
    try:
        tage = service.setzen(
            ctx,
            property_id,
            von=req.von,
            bis=req.bis,
            modus=req.modus,
            adjust_pct=req.adjust_pct,
            preis=req.preis,
        )
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    # Der Preis hat sich geändert — neu rechnen und (ohne Freigabepflicht)
    # senden. Als Job, damit der Channex-Push im Token-Budget läuft.
    if ctx.tenant_id:
        try_enqueue_recompute(get_service_client(), ctx.tenant_id, property_id)
    return TagesmodusAntwort(
        property_id=property_id, tage=tage, modus=req.modus
    )


@router.get(
    "/tagesmodus/{property_id}",
    response_model=list[TagesmodusEintrag],
)
def tagesmodus_lesen(
    property_id: str,
    von: Annotated[date, Query(description="Erster Tag (ISO)")],
    bis: Annotated[date, Query(description="Letzter Tag (ISO, inklusive)")],
    service: TagesmodusServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> list[TagesmodusEintrag]:
    """Gesetzte Tagesmodi im Zeitraum. Tage ohne Eintrag sind 'dynamisch'."""
    try:
        modi = service.lesen(ctx, property_id, von, bis)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return [TagesmodusEintrag(**v) for v in modi.values()]


@router.get("/freigabe/{property_id}", response_model=FreigabeStand)
def freigabe_stand(
    property_id: str,
    service: TagesmodusServiceDep,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> FreigabeStand:
    """Wie viele berechnete Tage sind noch nicht an den Portalen?

    Im SOFORT-Modus (keine Freigabepflicht) darf hier keine Frage an den
    Betrieb entstehen: stehen Tage ohne Stempel, reiht der Abruf den Lauf
    ein (coalesced je Objekt, Wurzel 2), der pusht und stempelt — die
    Software macht es, nicht der Nutzer. `sendet` sagt der Oberfläche, dass
    es läuft.
    """
    try:
        stand = settings.get(ctx, property_id)
        offen = service.offene_anzahl(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    sendet = False
    if offen and not stand.freigabe_noetig and stand.enabled and ctx.tenant_id:
        try_enqueue_recompute(get_service_client(), ctx.tenant_id, property_id)
        sendet = True
    return FreigabeStand(
        property_id=property_id,
        freigabe_noetig=stand.freigabe_noetig,
        offen=offen,
        sendet=sendet,
    )


@router.post(
    "/freigabe/{property_id}",
    response_model=FreigabeStand,
    dependencies=[
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS))
    ],
)
def freigabe_erteilen(
    property_id: str,
    service: TagesmodusServiceDep,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
    ],
) -> FreigabeStand:
    """Wartende Preise freigeben und an die Portale schicken.

    Idempotent: ein zweiter Klick findet nichts Offenes mehr (Wurzel 2).
    """
    try:
        service.freigeben(ctx, property_id)
        stand = settings.get(ctx, property_id)
        offen = service.offene_anzahl(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return FreigabeStand(
        property_id=property_id,
        freigabe_noetig=stand.freigabe_noetig,
        offen=offen,
    )


@router.get("/stufen-vorschau/{property_id}", response_model=StufenVorschau)
def stufen_vorschau(
    property_id: str,
    service: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> StufenVorschau:
    """Was die drei Aggressivitäts-Stufen im Schnitt kosten würden.

    Die Wörter konservativ/empfohlen/aggressiv sagen nichts über den Betrag.
    Der Server rechnet jede Stufe über 90 Tage durch und liefert den Schnitt.
    """
    try:
        werte = service.stufen_vorschau(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return StufenVorschau(property_id=property_id, **werte)


@router.get("/markt-stand/{property_id}", response_model=MarktStand)
def markt_stand(
    property_id: str,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> MarktStand:
    """Gibt es vergleichbare Objekte im Umkreis, und wie teuer sind sie?

    Ohne diese Auskunft ist "Marktdaten nutzen" ein Schalter, dessen Wirkung
    niemand sehen kann: er stand live an, ohne dass je ein Signal vorlag.
    """
    try:
        settings.require_own_property(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return marktstand_bauen(get_service_client(), property_id, ctx.tenant_id)


@router.get("/preisbericht/{property_id}", response_model=Preisbericht)
def preisbericht(
    property_id: str,
    settings: DpSettingsServiceDep,
    ctx: Annotated[
        AuthContext,
        Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL)),
    ],
) -> Preisbericht:
    """Die Auswertung des Dynamic Pricing: Preis gegen Markt je Stichtag,
    Uplift gegen den Grundpreis, Umgang mit den Berater-Vorschlägen.

    Gleicher Scope wie /markt-stand: Eigentum prüfen, Preis-Recht verlangen.
    """
    try:
        settings.require_own_property(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return PreisberichtService(get_service_client()).bericht(property_id)


# ---------------------------------------------------------------------------
# 0562 — Preisgrenzen je Zeitraum, Soll/Ist an den Portalen, Vorschau,
# Forecast, Verlauf. Lesen: PM_BOOKING_TOTAL (Preise sind Vertriebsdaten);
# Schreiben: MANAGE_CALENDAR + EDIT_CALENDAR_BOOKINGS wie der Tagesmodus.
# ---------------------------------------------------------------------------


def get_preisgrenzen_service() -> PreisgrenzenService:
    return PreisgrenzenService(service_client=get_service_client())


def get_portalstand_service() -> PortalstandService:
    return PortalstandService(service_client=get_service_client())


def get_auskunft_service() -> AuskunftService:
    return AuskunftService(service_client=get_service_client())


PreisgrenzenDep = Annotated[PreisgrenzenService, Depends(get_preisgrenzen_service)]
PortalstandDep = Annotated[PortalstandService, Depends(get_portalstand_service)]
AuskunftDep = Annotated[AuskunftService, Depends(get_auskunft_service)]
_LesenDep = Annotated[
    AuthContext, Depends(require_granular_permission(Permission.PM_BOOKING_TOTAL))
]
_SchreibenDep = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_CALENDAR))
]


@router.get("/preisgrenzen/{property_id}", response_model=list[Preisgrenze])
def preisgrenzen_liste(
    property_id: str, service: PreisgrenzenDep, ctx: _LesenDep
) -> list[Preisgrenze]:
    """Mindest-/Hoechstpreise je Zeitraum (SiteMinder „Floor and ceiling overrides")."""
    try:
        return service.liste(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/preisgrenzen/{property_id}",
    response_model=Preisgrenze,
    dependencies=[
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS))
    ],
)
def preisgrenze_anlegen(
    property_id: str, req: PreisgrenzeAnlegen, service: PreisgrenzenDep, ctx: _SchreibenDep
) -> Preisgrenze:
    try:
        return service.anlegen(ctx, property_id, req)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete(
    "/preisgrenzen/{property_id}/{grenze_id}",
    status_code=204,
    dependencies=[
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS))
    ],
)
def preisgrenze_loeschen(
    property_id: str, grenze_id: str, service: PreisgrenzenDep, ctx: _SchreibenDep
) -> None:
    """Idempotent (Wurzel 2): eine fehlende Grenze ist kein Fehler."""
    try:
        service.loeschen(ctx, property_id, grenze_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/portalstand/{property_id}", response_model=Portalstand)
def portalstand(
    property_id: str,
    von: Annotated[date, Query(description="Erster Tag (ISO)")],
    bis: Annotated[date, Query(description="Letzter Tag (ISO, inklusive)")],
    service: PortalstandDep,
    ctx: _LesenDep,
) -> Portalstand:
    """Was wir berechnet haben gegen das, was laut Schatten bei den Portalen steht."""
    try:
        return service.stand(ctx, property_id, von, bis)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post(
    "/portalstand/{property_id}/angleichen",
    status_code=202,
    dependencies=[
        Depends(require_granular_permission(Permission.EDIT_CALENDAR_BOOKINGS))
    ],
)
def portalstand_angleichen(
    property_id: str, service: PortalstandDep, ctx: _SchreibenDep
) -> dict[str, str]:
    """Die Differenz jetzt nachsenden — als Job im Channex-Budget."""
    try:
        service.angleichen(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"status": "eingereiht"}


@router.get("/vorschau/{property_id}", response_model=list[VorschauTag])
def vorschau(
    property_id: str,
    von: Annotated[date, Query(description="Erster Tag (ISO)")],
    bis: Annotated[date, Query(description="Letzter Tag (ISO, inklusive)")],
    service: AuskunftDep,
    ctx: _LesenDep,
) -> list[VorschauTag]:
    """So saehe die Kurve mit eingeschalteter Automatik aus — nichts wird
    gespeichert oder gesendet (Hostaway „Subscribe & Review")."""
    try:
        return service.vorschau(ctx, property_id, von, bis)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/forecast/{property_id}", response_model=Forecast)
def forecast(property_id: str, service: AuskunftDep, ctx: _LesenDep) -> Forecast:
    """Belegt vs. gelernte Erwartung der naechsten 90 Tage, dazu die
    Angebotsdichte der Umgebung."""
    try:
        return service.forecast(ctx, property_id)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/verlauf/{property_id}", response_model=list[VerlaufEintrag])
def verlauf(
    property_id: str,
    service: AuskunftDep,
    ctx: _LesenDep,
    tag: Annotated[
        date | None, Query(description="Nur Eintraege, die diesen Tag enthalten")
    ] = None,
) -> list[VerlaufEintrag]:
    """Wer hat wann was gesetzt, wann ging was raus (SiteMinder „History")."""
    try:
        return service.verlauf(ctx, property_id, tag)
    except PricingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
