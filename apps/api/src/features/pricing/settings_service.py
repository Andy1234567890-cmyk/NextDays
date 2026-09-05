"""Dynamic-Pricing-Einstellungen je Objekt (dp_settings) — tenant-scoped CRUD.

Liest/schreibt die dp_settings-Zeile eines Objekts. Property-Eigentum wird gegen
den Tenant geprüft (kein Fremd-Zugriff). Beim Aktivieren/Ändern wird KEIN
Recompute erzwungen — das macht der tägliche Cron bzw. der Reservierungs-Hook;
der Aufrufer kann nach dem Speichern gezielt recompute_property() auslösen.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.features.auth.owner_scope import is_owner, owner_property_ids
from src.features.subscriptions.entitlements import modul_aktiv
from src.features.subscriptions.schemas import DYNPRICING_MODULE_KEY

from .engine import DpSettings
from .freigabe import freigabe_fenster, freigabe_noetig, freigabe_regel, gesendet_stempeln
from .resolver import PricingError
from .schemas import (
    DpOverviewItem,
    DpOverviewResponse,
    DpSettingsResponse,
    DpSettingsUpdate,
)
from .zusatzsignale import (
    saison_untergrenze_je_tag,
    saison_untergrenzen_bulk,
    saison_vorhanden,
    verlauf_schreiben,
)

if TYPE_CHECKING:
    from .resolver import PricingResolver

log = get_logger("nextdays.pricing.settings")

# Wie weit in die Zukunft die Preise beim Umlegen des DP-Schalters neu an die
# Portale gemeldet werden. Deckt die übliche Buchungsvorlaufzeit ab; weiter
# entfernte Tage zieht der reconcile-Cron nach (der Autopilot-Horizont selbst
# ist mit 540 Tagen deutlich länger, siehe recompute.DEFAULT_HORIZON_DAYS).
_UMSCHALT_HORIZONT_TAGE = 365

# Spalten-Defaults spiegeln Migration 0055 (ein Ort der Wahrheit für die API).
_DEFAULTS = {
    "enabled": False,
    "min_price": None,
    "max_price": None,
    "weekend_uplift_pct": 15.0,
    "last_minute": [
        {"days_before": 7, "discount_pct": 10},
        {"days_before": 3, "discount_pct": 20},
    ],
    "orphan_gap_discount_pct": 15.0,
    "occupancy_sensitivity": 30.0,
    "min_stay_min": 1,
    "min_stay_max": 7,
    "market_enabled": False,
    "market_sensitivity": 20.0,
    "market_max_adjust_pct": 25.0,
    "market_key": None,
    "comp_refs": [],
    "base_mode": "data_driven",
    "base_rate_mode": "recommended",
    "manual_base_price": None,
    "autopilot_enabled": False,
    "weather_enabled": False,
    "weather_max_adjust_pct": 10.0,
    "rate_rules": [],
    "occupancy_steps": [],
    "freigabe_noetig": False,
    "far_future": [],
    # 0562
    "freigabe_ab_tagen": None,
    "anker_enabled": False,
    "anker_max_pct": 20.0,
    "saison_mindestpreis": False,
    "rate_plan_id": None,
    "feiertag_uplift_pct": 0.0,
    "ferien_uplift_pct": 0.0,
    "quellmaerkte": [],
    "occupancy_discount_cap_pct": 20.0,
    "occupancy_premium_cap_pct": 15.0,
    "occupancy_lead_buckets": [],
}


def _laender_normalisieren(werte: list[str]) -> list[str]:
    """ISO-3166-1 alpha-2, gross, ohne Doppelte — ein „de" und ein „DE" sind
    dasselbe Land, kein zweiter Quellmarkt. Alles andere ist 422."""
    out: list[str] = []
    for w in werte:
        code = str(w).strip().upper()
        if len(code) != 2 or not code.isalpha():
            raise PricingError(
                f"Quellmarkt '{w}' ist kein Laendercode (ISO-2, z. B. DE).",
                status_code=422,
            )
        if code not in out:
            out.append(code)
    return out


class DpSettingsService:
    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise PricingError("Preis-DB nicht verfügbar.", status_code=500)
        return self._client

    def _resolver(self) -> PricingResolver:
        """Zentraler Preis-Resolver — dieselbe Preis-Wahrheit wie Kalender/Quote."""
        from .resolver import PricingResolver  # noqa: PLC0415

        return PricingResolver(service_client=self._db())

    def require_own_property(self, ctx: AuthContext, property_id: str) -> None:
        """Öffentlicher Scope-Guard für Router (Tenant-Eigentum + Owner-§4.2).
        Wirft PricingError(404), wenn das Objekt fremd/nicht sichtbar ist."""
        self._require_own_property(ctx, property_id)

    def _require_own_property(self, ctx: AuthContext, property_id: str) -> None:
        if not ctx.tenant_id:
            raise PricingError("Kein Tenant im Konto.", status_code=400)
        res = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise PricingError("Objekt nicht gefunden.", status_code=404)
        # Eigentümer dürfen nur ihre zugeordneten Objekte sehen (§4.2).
        if is_owner(ctx) and property_id not in owner_property_ids(self._db(), ctx):
            raise PricingError("Objekt nicht gefunden.", status_code=404)

    def get(self, ctx: AuthContext, property_id: str) -> DpSettingsResponse:
        """dp_settings eines Objekts (oder Defaults, falls noch keine Zeile)."""
        self._require_own_property(ctx, property_id)
        res = (
            self._db()
            .table("dp_settings")
            .select("*")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        row = {**_DEFAULTS, **(res[0] if res else {})}
        antwort = self._to_response(property_id, row)
        # Ob die Saison-Regel waehlbar ist, entscheidet der Kalender, nicht die
        # Zeile: die Oberflaeche sperrt den Schalter danach.
        antwort.saison_verfuegbar = saison_vorhanden(self._db(), property_id)
        if antwort.saison_mindestpreis and not antwort.saison_verfuegbar:
            log.warning(
                "dp_saison_regel_ohne_kalender",
                property_id=property_id,
            )
        if antwort.saison_verfuegbar:
            # Sichtbar machen, was die Regel tut: Spanne und Tage der Saison-
            # Untergrenze im Push-Horizont. Ohne das stand neben dem Schalter
            # weiter „Mindestpreis 541,45" und der Betrieb hielt die Regel fuer
            # wirkungslos (05.09.2026).
            from .recompute import DynamicPricingRecompute  # noqa: PLC0415

            basis = DynamicPricingRecompute(service_client=self._db()).load_base_price(
                property_id
            )
            heute = datetime.now(UTC).date()
            preise = saison_untergrenze_je_tag(
                self._db(), property_id, basis, heute, heute + timedelta(days=365)
            )
            antwort.saison_tage = len(preise)
            if preise:
                antwort.saison_preis_von = min(preise.values())
                antwort.saison_preis_bis = max(preise.values())
        return antwort

    def update(
        self, ctx: AuthContext, property_id: str, req: DpSettingsUpdate
    ) -> DpSettingsResponse:
        """dp_settings setzen (Upsert). Nur gesetzte Felder werden übernommen."""
        # Eigentümer-Sicht ist read-only (Lastenheft §4.2): kein Schreibzugriff.
        if is_owner(ctx):
            raise PricingError(
                "Eigentümer können Dynamic Pricing nicht ändern.", status_code=403
            )
        self._require_own_property(ctx, property_id)
        patch = req.model_dump(mode="json", exclude_none=True)
        # Ein leerer Patch ist immer ein Fehler des Aufrufers, nie eine
        # Absicht: er erzeugt einen Upsert ohne Inhalt und quittiert mit 200,
        # sodass der Nutzer eine gespeicherte Einstellung sieht, die es nicht
        # gibt (live passiert, als occupancy_steps im Schema fehlte).
        if not patch:
            raise PricingError(
                "Keine Einstellung übermittelt — nichts gespeichert.",
                status_code=422,
            )
        # Einschalten geht nur mit gebuchtem Modul (0,5 % vom Buchungsumsatz).
        # Ohne das Modul rechnet die Engine nicht (recompute-Gate) — ein Toggle,
        # der auf „an" steht und nichts tut, wäre eine Attrappe. Deshalb hier
        # fail-CLOSED mit 402, statt still zu speichern.
        if patch.get("enabled") and not self._modul_gebucht(ctx):
            raise PricingError(
                "Dynamische Preise ist ein kostenpflichtiges Modul. "
                "Bitte zuerst unter Erweiterungen aktivieren.",
                status_code=402,
            )
        # Stand VOR dem Schreiben: nur eine echte Änderung des Schalters löst den
        # Umschalt-Push aus (ein Speichern ohne Wechsel darf keine Portal-Last
        # erzeugen).
        # 0562: DP je Ratenplan — der Plan muss zum Objekt gehoeren und darf
        # nicht abgeleitet sein (SiteMinder: „rate plan must not be derived";
        # ein abgeleiteter Plan folgt seinem Parent, zwei Quellen waeren Wurzel 4).
        if patch.get("rate_plan_id"):
            self._ratenplan_pruefen(property_id, str(patch["rate_plan_id"]))
        # 0565: die Saison-Regel braucht einen Saisonkalender. Ohne ihn gibt es
        # keine Untergrenze, die sie setzen koennte — ein „an" waere eine
        # Attrappe (fail-closed, wie das Modul-Gate oben).
        if patch.get("saison_mindestpreis") and not saison_vorhanden(
            self._db(), property_id
        ):
            raise PricingError(
                "Kein Saisonkalender angelegt — die Regel 'Mindestpreis aus dem "
                "Saisonkalender' braucht mindestens eine Saison mit Zeitraum.",
                status_code=422,
            )
        if "quellmaerkte" in patch and patch["quellmaerkte"] is not None:
            patch["quellmaerkte"] = _laender_normalisieren(patch["quellmaerkte"])
        vorher = self._ist_aktiv(property_id)
        freigabe_vorher = freigabe_noetig(self._db(), property_id)
        row = {"property_id": property_id, **patch}
        self._db().table("dp_settings").upsert(
            row, on_conflict="property_id"
        ).execute()
        log.info(
            "dp_settings_updated",
            property_id=property_id,
            fields=sorted(patch.keys()),
        )
        # Verlauf (0562): welche Felder, von wem. Der Schalter bekommt einen
        # eigenen Eintrag — er ist die Handlung, die man spaeter sucht.
        heute = datetime.now(UTC).date()
        if "enabled" in patch and bool(patch["enabled"]) is not vorher:
            verlauf_schreiben(
                self._db(), property_id, von=heute, bis=heute,
                ereignis="automatik_an" if patch["enabled"] else "automatik_aus",
                user_id=ctx.user_id,
            )
        felder = sorted(k for k in patch if k != "enabled")
        if felder:
            verlauf_schreiben(
                self._db(), property_id, von=heute, bis=heute,
                ereignis="einstellungen",
                details={"felder": felder},
                user_id=ctx.user_id,
            )
        if "freigabe_noetig" in patch and bool(patch["freigabe_noetig"]) is not (
            freigabe_vorher
        ):
            if patch["freigabe_noetig"]:
                self._bestand_als_gesendet_stempeln(property_id)
            else:
                # Freigabe AUS = zurück zum Normalfall „DP ändert den Preis".
                # Der aufgestaute Rückstand muss jetzt raus, sonst verkaufen die
                # Portale weiter zum alten Preis und niemand sieht es. Wurzel 1:
                # der Schalter hat einen Gegenzustand in BEIDE Richtungen —
                # bisher pflegte ihn nur die Einschalt-Richtung.
                self._preise_neu_verteilen(property_id, eingeschaltet=True)
        if "enabled" in patch and bool(patch["enabled"]) is not vorher:
            self._preise_neu_verteilen(
                property_id, eingeschaltet=bool(patch["enabled"])
            )
        return self.get(ctx, property_id)

    def _bestand_als_gesendet_stempeln(self, property_id: str) -> None:
        """Beim EINSCHALTEN der Freigabe: was schon draußen ist, bleibt draußen.

        Wurzel 1 — der Gegenzustand zum Schalter. Ohne das erfand jedes
        Einschalten einen Rückstau aus der Vergangenheit: die bereits an die
        Portale gemeldeten Tage trugen keinen Stempel (den setzte der Push
        früher nicht), galten ab dem Klick also als „wartet auf Freigabe".
        Live am 04.09.2026 waren das 540 Tage, die längst bei Channex lagen —
        die Leiste verlangte eine Freigabe für etwas bereits Verkauftes.

        Die Freigabe gilt ab JETZT, für künftige Änderungen. Sie ist keine
        rückwirkende Prüfpflicht für Preise, die der Betrieb nie zurückhalten
        wollte.
        """
        von, bis = freigabe_fenster(ab_tagen=freigabe_regel(self._db(), property_id)[1])
        try:
            res = (
                self._db()
                .table("dynamic_prices")
                .update({"gesendet_am": datetime.now(UTC).isoformat()})
                .eq("property_id", property_id)
                .is_("gesendet_am", "null")
                .gte("date", von)
                .lte("date", bis)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "dp_bestand_stempeln_fehlgeschlagen",
                property_id=property_id,
                error=str(exc)[:200],
            )
            return
        log.info(
            "dp_freigabe_eingeschaltet_bestand_gestempelt",
            property_id=property_id,
            tage=len(res.data or []),
        )

    def stufen_vorschau(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, float | None]:
        """Durchschnittlicher Tagespreis je Aggressivitäts-Stufe.

        Die drei Stufen (konservativ / empfohlen / aggressiv) dämpfen bzw.
        verstärken die abweichungsbasierten Faktoren. Als Wort allein ist das
        keine Entscheidungsgrundlage — „aggressiv" sagt niemandem, ob daraus
        520 oder 700 Kronen werden. Deshalb rechnet der Server jede Stufe
        einmal durch und gibt den Schnitt zurück.

        None je Stufe, wenn kein Basispreis hinterlegt ist — kein geratener
        Ersatzwert (Wurzel 4).
        """
        self._require_own_property(ctx, property_id)
        from .engine import DpSettings as EngineSettings  # noqa: PLC0415
        from .recompute import DynamicPricingRecompute  # noqa: PLC0415

        rc = DynamicPricingRecompute(service_client=self._db())
        basis = rc.load_base_price(property_id)
        zeile = (
            self._db()
            .table("dp_settings")
            .select("*")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or [{}]
        if basis is None:
            return {m: None for m in ("conservative", "recommended", "aggressive")}

        heute = datetime.now(UTC).date()
        # 90 Tage genügen für einen belastbaren Schnitt und halten die drei
        # Durchläufe schnell — die Vorschau lädt beim Öffnen des Panels.
        bis = heute + timedelta(days=90)
        out: dict[str, float | None] = {}
        for modus in ("conservative", "recommended", "aggressive"):
            try:
                kurve = rc.preis_kurve(
                    property_id,
                    basis,
                    EngineSettings.from_row({**zeile[0], "base_rate_mode": modus}),
                    heute,
                    heute,
                    bis,
                )
            except Exception as exc:  # noqa: BLE001 — Vorschau darf nicht kippen
                log.warning(
                    "dp_stufen_vorschau_fehlgeschlagen",
                    property_id=property_id,
                    modus=modus,
                    error=str(exc)[:200],
                )
                out[modus] = None
                continue
            preise = [r.price for _, r in kurve]
            out[modus] = round(sum(preise) / len(preise), 2) if preise else None
        return out

    def _ratenplan_pruefen(self, property_id: str, rate_plan_id: str) -> None:
        """Wurzel 3 + 4: der Plan gehoert zum Objekt und ist nicht abgeleitet."""
        res = (
            self._db()
            .table("rate_plans")
            .select("id, rate_mode")
            .eq("id", rate_plan_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not res:
            raise PricingError(
                "Der Ratenplan gehoert nicht zu diesem Objekt.", status_code=422
            )
        if (res[0].get("rate_mode") or "manual") == "derived":
            raise PricingError(
                "Ein abgeleiteter Ratenplan folgt seinem Basisplan — waehle den "
                "Basisplan fuer Dynamic Pricing.",
                status_code=422,
            )

    def _ist_aktiv(self, property_id: str) -> bool:
        """Aktueller Schalterstand (fail-CLOSED: keine Zeile = aus)."""
        res = (
            self._db()
            .table("dp_settings")
            .select("enabled")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(res) and bool(res[0].get("enabled"))

    def _preise_neu_verteilen(
        self, property_id: str, *, eingeschaltet: bool
    ) -> None:
        """Nach dem Umlegen des Schalters die jetzt gültigen Preise an die Portale
        melden — in BEIDE Richtungen.

        Der Schalter ändert die Rangfolge im Resolver sofort (dynamic gewinnt bei
        „an", der manuelle Tagespreis bei „aus"), aber die Portale erfahren davon
        nichts von allein: dort liegt weiter der zuletzt gesendete Preis. Ohne
        diesen Push verkauft Booking/Airbnb nach dem Abschalten weiter zum
        Autopilot-Preis, obwohl im Kalender längst wieder der manuelle steht
        (Gegenzustand, Wurzel 1).

        Beim EINSCHALTEN rechnet zusätzlich der Autopilot; sein eigener Push
        folgt aus `recompute_property`. Hier wird der bereits berechnete Bestand
        verteilt, damit die Umstellung nicht bis zum nächsten Cron-Lauf wartet.

        `price_overrides` wird dabei NIE angefasst — die manuellen Tagespreise
        bleiben stehen und greifen beim Abschalten unverändert wieder.
        """
        # Lokale Importe: der Kalender-Slice importiert seinerseits pricing —
        # ein Modul-Import oben wäre ein Zyklus.
        from src.features.calendar.service import CalendarService  # noqa: PLC0415

        heute = datetime.now(UTC).date()
        bis = heute + timedelta(days=_UMSCHALT_HORIZONT_TAGE)
        try:
            kalender = CalendarService(client=self._db())
            tage = self._resolver().effective_prices(property_id, heute, bis)
            for start, end, cents in kalender.preisbloecke(tage):
                kalender.push_channex_rate(property_id, start, end, cents)
        except Exception as exc:  # noqa: BLE001 — Schalter darf nicht kippen
            # LAUT loggen statt still kürzen: der Schalter steht dann zwar
            # richtig, die Portale hinken aber nach, bis der reconcile-Cron
            # greift. Das muss sichtbar sein.
            log.warning(
                "dp_umschalt_push_fehlgeschlagen",
                property_id=property_id,
                eingeschaltet=eingeschaltet,
                error=str(exc)[:200],
            )
            return
        # STEMPELN, was dynamisch rausging (Wurzel 1, Gegenzustand des Pushs).
        # Ohne das behauptete der Zähler nach dem Umlegen auf „Sofort" weiter
        # „366 Tage nicht gesendet" — live am 05.09.2026, obwohl der Schatten
        # zu 100 % stimmte. Beim ABschalten der Automatik gehen Overrides und
        # Grundpreis hinaus, keine dynamischen Preise: dann gibt es nichts zu
        # stempeln.
        if eingeschaltet:
            gesendet_stempeln(
                self._db(),
                property_id,
                [t.date.isoformat() for t in tage if t.source == "dynamic"],
            )
        log.info(
            "dp_umschalt_push",
            property_id=property_id,
            eingeschaltet=eingeschaltet,
            bis=bis.isoformat(),
        )

    def overview(self, ctx: AuthContext) -> DpOverviewResponse:
        """Alle Objekte des Kontos + ihr Dynamic-Pricing-Status (Hostaway-Tabelle).

        Eine Zeile je Objekt: Aktiv-Status, Basispreis-Modus + effektiver Basispreis
        (manueller Wert oder Grundpreis aus dem Rate-Plan; None = kein Grundpreis,
        kein Fallback), Min/Max. dp_settings fehlt → Defaults (DP aus)."""
        if not ctx.tenant_id:
            raise PricingError("Kein Tenant im Konto.", status_code=400)
        gebucht = self._modul_gebucht(ctx)
        query = (
            self._db()
            .table("properties")
            .select("id, title, photos, status")
            .eq("tenant_id", ctx.tenant_id)
        )
        # Eigentümer sehen nur ihre zugeordneten Objekte (Lastenheft §4.2).
        if is_owner(ctx):
            owned = owner_property_ids(self._db(), ctx)
            if not owned:
                return DpOverviewResponse(items=[], module_active=gebucht)
            query = query.in_("id", list(owned))
        props = query.order("title").execute().data or []
        if not props:
            return DpOverviewResponse(items=[], module_active=gebucht)

        ids = [p["id"] for p in props]
        settings_by_prop = self._settings_by_property(ids)
        rate_by_prop = self._rate_plan_by_property(ids)
        channels_by_prop = self._active_channels_by_property(ids)
        # Wie viele berechnete Tage warten je Objekt auf die Freigabe? Als
        # EINE Abfrage für alle — die Liste zeigt bis zu hunderte Objekte,
        # eine Abfrage je Zeile wäre ein N+1.
        offen_by_prop = self._offene_freigaben(ids)
        # 0565: Spanne der Saison-Untergrenze je Objekt mit eingeschalteter
        # Regel — sonst stand in der Liste weiter nur der Mindestpreis ohne
        # Saison und die Regel schien wirkungslos (05.09.2026).
        mit_saison = {
            pid: _opt_float((rate_by_prop.get(pid) or {}).get("base_price"))
            for pid in ids
            if DpSettings.from_row(settings_by_prop.get(pid)).saison_mindestpreis
        }
        heute = datetime.now(UTC).date()
        saison_by_prop = saison_untergrenzen_bulk(
            self._db(), mit_saison, heute, heute + timedelta(days=365)
        )

        items: list[DpOverviewItem] = []
        for p in props:
            pid = p["id"]
            s = DpSettings.from_row(settings_by_prop.get(pid))
            rate = rate_by_prop.get(pid, {})
            rate_base = _opt_float(rate.get("base_price"))
            saison = saison_by_prop.get(pid)
            # Effektiver Anker: manuell gesetzt oder Grundpreis (kein Erfinden).
            base_rate = (
                s.manual_base_price
                if s.base_mode == "manual" and s.manual_base_price is not None
                else rate_base
            )
            photos = p.get("photos") or []
            status = p.get("status") or "draft"
            # Eigene Plattform zählt als Kanal, sobald das Objekt aktiv ist
            # (booking_engine zeigt nur status=active). OTA-Kanäle aus Channex.
            channels = list(channels_by_prop.get(pid, []))
            if status == "active":
                channels = ["platform", *channels]
            items.append(
                DpOverviewItem(
                    property_id=pid,
                    title=p.get("title") or "Objekt",
                    photo=photos[0] if photos else None,
                    status=status,
                    currency=rate.get("currency"),
                    enabled=s.enabled,
                    base_mode=s.base_mode,
                    base_rate_mode=s.base_rate_mode,
                    base_rate=base_rate,
                    min_price=s.min_price,
                    max_price=s.max_price,
                    saison_mindestpreis=s.saison_mindestpreis,
                    saison_preis_von=saison[0] if saison else None,
                    saison_preis_bis=saison[1] if saison else None,
                    channels=channels,
                    freigabe_noetig=s.freigabe_noetig,
                    offene_tage=offen_by_prop.get(pid, 0),
                )
            )
        return DpOverviewResponse(items=items, module_active=gebucht)

    def _offene_freigaben(self, property_ids: list[str]) -> dict[str, int]:
        """Je Objekt: wie viele berechnete Tage sind noch nicht gesendet?

        Nur Objekte mit Freigabepflicht interessieren — bei allen anderen geht
        der Preis ohnehin sofort raus, eine Zahl dort wäre irreführend.
        """
        if not property_ids:
            return {}
        von, bis = freigabe_fenster()
        try:
            # Paginiert: je Objekt bis zu 366 offene Tage — schon ab drei
            # Objekten reisst PostgREST bei 1000 Zeilen still ab, und die
            # Liste zeigte dann für die hinteren Objekte zu wenig an.
            res = fetch_all_rows(
                self._db()
                .table("dynamic_prices")
                .select("property_id")
                .in_("property_id", property_ids)
                .is_("gesendet_am", "null")
                .gte("date", von)
                .lte("date", bis)
                .order("property_id")
            )
        except Exception as exc:  # noqa: BLE001 — Zusatzinfo, kein Hauptpfad
            log.warning("dp_offene_freigaben_unlesbar", error=str(exc)[:200])
            return {}
        out: dict[str, int] = {}
        for r in res:
            pid = r.get("property_id")
            if isinstance(pid, str):
                out[pid] = out.get(pid, 0) + 1
        return out

    def _modul_gebucht(self, ctx: AuthContext) -> bool:
        """Ist „Dynamische Preise" für diesen Betrieb gebucht? (eine Quelle:
        `subscriptions.entitlements`, fail-CLOSED)."""
        return modul_aktiv(self._db(), ctx.tenant_id, DYNPRICING_MODULE_KEY)

    def explain_input(
        self, ctx: AuthContext, property_id: str, tag: str
    ) -> tuple[float, float, dict[str, float], str]:
        """Eingangsdaten für die Preis-Begründung: (basispreis, preis, faktoren,
        währung).

        Liegt im Service, nicht im Router: hier hängen Scope-Prüfung, zwei
        DB-Abfragen und die Basispreis-/Währungsableitung zusammen — ein Router
        soll transportieren, nicht rechnen. Wirft PricingError (404), wenn für
        den Tag kein dynamischer Preis existiert.
        """
        self._require_own_property(ctx, property_id)

        rows = (
            self._db()
            .table("dynamic_prices")
            .select("price, factors")
            .eq("property_id", property_id)
            .eq("date", tag)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise PricingError(
                "Für diesen Tag gibt es keinen dynamischen Preis "
                "(DP aus oder noch nicht berechnet).",
                status_code=404,
            )
        preis = float(rows[0].get("price") or 0)
        faktoren = {k: float(v) for k, v in (rows[0].get("factors") or {}).items()}

        rate_rows = (
            self._db()
            .table("rate_plans")
            .select("base_price, currency, created_at")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        # Ohne Rate-Plan gibt es keinen Anker — dann ist der berechnete Preis
        # selbst der Vergleichswert (kein erfundener Basispreis).
        basispreis = (
            float(rate_rows[0]["base_price"])
            if rate_rows and rate_rows[0].get("base_price") is not None
            else preis
        )
        # rate_plans.currency ist NOT NULL — existiert ein Rate-Plan, ist die
        # Währung gesetzt. Fehlt der Plan, keine Währung erfinden (Wurzel 4):
        # leer lassen, die Formatierung rendert dann symbollos.
        waehrung = (rate_rows[0].get("currency") if rate_rows else None) or ""
        return basispreis, preis, faktoren, waehrung

    def _settings_by_property(self, ids: list[str]) -> dict[str, dict]:
        rows = (
            self._db()
            .table("dp_settings")
            .select("*")
            .in_("property_id", ids)
            .execute()
        ).data or []
        return {r["property_id"]: r for r in rows}

    def _rate_plan_by_property(self, ids: list[str]) -> dict[str, dict]:
        """Pro Objekt der (älteste) Rate-Plan mit Grundpreis + Währung."""
        rows = (
            self._db()
            .table("rate_plans")
            .select("property_id, base_price, currency, created_at")
            .in_("property_id", ids)
            .order("created_at")
            .execute()
        ).data or []
        out: dict[str, dict] = {}
        for r in rows:  # erster (ältester) je Objekt gewinnt
            out.setdefault(r["property_id"], r)
        return out

    def _active_channels_by_property(self, ids: list[str]) -> dict[str, list[str]]:
        """Aktive OTA-Portal-Codes je Objekt aus channex_channel_connection.

        Nur is_active=true. Fehlt die Tabelle (Env ohne Migration 0035), liefert
        das leer zurück — kein erfundener Kanal."""
        try:
            rows = (
                self._db()
                .table("channex_channel_connection")
                .select("property_id, ota_portal_code, is_active")
                .in_("property_id", ids)
                .eq("is_active", True)
                .execute()
            ).data or []
        # Fehlende/nicht-migrierte Channex-Tabelle = keine Verbindungen (leere Map);
        # die Übersicht bleibt ohne Channel-Status nutzbar.
        except Exception:  # noqa: BLE001  pylint: disable=broad-exception-caught
            return {}
        out: dict[str, list[str]] = {}
        for r in rows:
            code = r.get("ota_portal_code")
            if not code:
                continue
            out.setdefault(r["property_id"], []).append(code)
        return out

    @staticmethod
    def _to_response(property_id: str, row: dict) -> DpSettingsResponse:
        return DpSettingsResponse(
            property_id=property_id,
            enabled=bool(row.get("enabled")),
            min_price=_opt_float(row.get("min_price")),
            max_price=_opt_float(row.get("max_price")),
            weekend_uplift_pct=float(row.get("weekend_uplift_pct") or 0),
            last_minute=[
                r for r in (row.get("last_minute") or []) if isinstance(r, dict)
            ],
            orphan_gap_discount_pct=float(row.get("orphan_gap_discount_pct") or 0),
            occupancy_sensitivity=float(row.get("occupancy_sensitivity") or 0),
            min_stay_min=int(row.get("min_stay_min") or 1),
            min_stay_max=int(row.get("min_stay_max") or 7),
            market_enabled=bool(row.get("market_enabled")),
            market_sensitivity=float(row.get("market_sensitivity") or 0),
            market_max_adjust_pct=float(row.get("market_max_adjust_pct") or 0),
            market_key=row.get("market_key"),
            comp_refs=[str(r) for r in (row.get("comp_refs") or [])],
            base_mode=_choice(
                row.get("base_mode"), ("data_driven", "market", "manual"), "data_driven"
            ),
            base_rate_mode=_choice(
                row.get("base_rate_mode"),
                ("conservative", "recommended", "aggressive"),
                "recommended",
            ),
            manual_base_price=_opt_float(row.get("manual_base_price")),
            weather_enabled=bool(row.get("weather_enabled")),
            weather_max_adjust_pct=float(row.get("weather_max_adjust_pct") or 0),
            rate_rules=[
                r for r in (row.get("rate_rules") or []) if isinstance(r, dict)
            ],
            occupancy_steps=[
                r for r in (row.get("occupancy_steps") or []) if isinstance(r, dict)
            ],
            freigabe_noetig=bool(row.get("freigabe_noetig")),
            far_future=[
                r for r in (row.get("far_future") or []) if isinstance(r, dict)
            ],
            freigabe_ab_tagen=(
                int(row["freigabe_ab_tagen"])
                if row.get("freigabe_ab_tagen") is not None
                else None
            ),
            anker_enabled=bool(row.get("anker_enabled")),
            anker_max_pct=float(row.get("anker_max_pct") or 0),
            saison_mindestpreis=bool(row.get("saison_mindestpreis")),
            rate_plan_id=(str(row["rate_plan_id"]) if row.get("rate_plan_id") else None),
            feiertag_uplift_pct=float(row.get("feiertag_uplift_pct") or 0),
            ferien_uplift_pct=float(row.get("ferien_uplift_pct") or 0),
            quellmaerkte=[str(c) for c in (row.get("quellmaerkte") or []) if c],
            occupancy_discount_cap_pct=float(row.get("occupancy_discount_cap_pct") or 0),
            occupancy_premium_cap_pct=float(row.get("occupancy_premium_cap_pct") or 0),
            occupancy_lead_buckets=[
                r for r in (row.get("occupancy_lead_buckets") or []) if isinstance(r, dict)
            ],
        )


def _opt_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _choice(value: object, allowed: tuple[str, ...], default: str) -> str:
    s = str(value) if value is not None else ""
    return s if s in allowed else default
