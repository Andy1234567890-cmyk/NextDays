"""Service-Schicht für calendar — das Herzstück (Lastenheft §2.2).

Verfügbarkeitslogik + Double-Booking-Schutz über die availability-Tabelle
(eine Zeile pro property_id/date). Manuelle Preisüberschreibung pro Tag.

Der Supabase-Client wird injiziert → im Test mockbar; echte DB-Calls beim
laufenden Stack. Kein stilles Exception-Swallowing (PROJECT.md).
"""
# pylint: disable=too-many-lines  # kohärente Kalender-Domäne (Verfügbarkeit/
# Preis/Stop-Sell/Saisons/Bulk) — ein Split zerrisse die eng gekoppelte
# Spiegelungs- und Push-Logik (gleiches Muster wie ari_push.py).
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING, Any

from supabase import Client

from src.core.dates import merge_day_ranges
from src.core.einheiten import AVAILABILITY_CONFLICT, je_einheit
from src.core.einheiten_verfuegbar import einheiten_zahl, freie_einheiten_spannen
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.features.auth.guest_masking import load_guest_mask
from src.features.auth.owner_scope import is_owner, owner_property_ids
from src.jobs.queue import try_enqueue_ari

from .schemas import (
    AvailabilityCheck,
    AvailabilitySource,
    AvailabilityStatus,
    BlockRequest,
    BoardProperty,
    BoardResponse,
    BulkEditRequest,
    BulkEditResult,
    DateRange,
    DayAvailability,
    FreieEinheitenResponse,
    FreieEinheitenSpanne,
    MultiRestrictionRowsRequest,
    PriceOverrideRequest,
    RestrictionRow,
    RestrictionRowsRequest,
    SeasonMode,
    SliceHealth,
    StopSellDay,
)

if TYPE_CHECKING:
    from src.features.pricing.resolver import EffectivePriceDay, PricingResolver

log = get_logger("nextdays.calendar")

# Kanal- und Plan-Dimension am Stop-Sell (Migrationen 0145 + 0152, beide live
# verifiziert). scope/channels = Kanal-Scope; rate_plan_id = plan-genauer Stopp
# (Hotel, null = Objekt-Ebene). Deploy-Reihenfolge: 0152 MUSS vor diesem Code
# eingespielt sein (PostgREST wirft sonst „column does not exist").
_STOP_SELL_SCOPE_COLS = "scope,channels,rate_plan_id,"

# Sperr-Herkünfte, die der Betrieb aus dem Kalender heraus wieder aufheben darf.
#
# `manual` ist die selbst gesetzte Sperre. `portal` sieht nach fremder Herkunft
# aus, ist aber KEINE: die Zeile entsteht, wenn der Channex-Import unsere eigene
# Vorgabe zurückspiegelt (`bookings_sync`: availability=0 → status='blocked',
# source='portal'). Unsere Plattform gibt die Vorgabe, Channex reicht sie nur an
# die OTAs weiter. Solange nur `manual` aufhebbar war, wurde eine Sperre
# unlöschbar, sobald ein Sync-Lauf sie einmal zurückgeholt hatte — live gefunden
# am 10.08.2026 (Rævehulen 14.–19.08.): der Kalender öffnete das Kontextmenü,
# aber ohne den Punkt „Aufheben", und der Nutzer kam an seine eigene Sperre
# nicht mehr heran.
#
# `ical` bleibt bewusst DRAUSSEN: diese Zeilen gehören einem abonnierten
# Fremdkalender (external_calendar). Sie hier zu öffnen wäre ein Scheinerfolg —
# der nächste Feed-Lauf schriebe sie zurück, während der Nutzer glaubt, der
# Zeitraum sei frei. Der Weg dorthin führt über das Abo, nicht über den Balken.
#
# `contract_end` bleibt aus demselben Grund DRAUSSEN, aber mit schwererer Folge
# (0355): diese Sperre sagt „für dieses Objekt gibt es ab hier keinen
# Vermarktungsvertrag". Wäre sie per Balken aufhebbar, machte ein Klick das
# Objekt bei Booking/Airbnb wieder verkäuflich — es käme eine Buchung für einen
# Zeitraum, für den wir nicht mehr vermarkten dürfen. Der Weg dorthin führt
# ausschließlich über das Enddatum in der Objektkartei (Wurzel 1: derselbe
# Schalter setzt und hebt auf).
_AUFHEBBARE_SPERRQUELLEN = (
    AvailabilitySource.manual.value,
    AvailabilitySource.portal.value,
)


def _default_stop_sell_scope(row: dict) -> None:
    """scope/channels auf den Default (all/[]) setzen, wenn die Spalten (noch)
    nicht mitgelesen wurden — hält StopSellDay valide und das Verhalten
    rückwärtskompatibel (all = alle Kanäle, wie bisher)."""
    row.setdefault("scope", "all")
    row.setdefault("channels", [])


def _ohne_preise(days: list[DayAvailability]) -> list[DayAvailability]:
    """Geldwerte aus den Tagen entfernen (Verfügbarkeit/Min-Stay bleiben).

    `price_source="none"` statt des echten Ursprungs: sonst verriete das Feld,
    dass es einen Preis GIBT und woher er stammt — für eine Rolle ohne
    Betrags-Recht wäre das dieselbe Information einen Schritt später.
    """
    return [
        d.model_copy(
            update={"price": None, "price_source": "none", "price_factors": None}
        )
        for d in days
    ]


class CalendarError(Exception):
    """Fachlicher Kalender-Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _preis_spannen(days: list) -> list[tuple[date, date, int]]:
    """Aufeinanderfolgende Tage gleichen Preises zu (von, bis_exklusiv, cents).

    Tage ohne Preis (None — kein Rate-Plan) werden übersprungen: es gibt
    nichts zu pushen, und ein erfundener Wert wäre Wurzel 4.
    """
    spannen: list[tuple[date, date, int]] = []
    for tag in days:
        if tag.price is None:
            continue
        cents = round(tag.price * 100)
        if spannen and spannen[-1][2] == cents and spannen[-1][1] == tag.date:
            von, _, _ = spannen[-1]
            spannen[-1] = (von, tag.date + timedelta(days=1), cents)
        else:
            spannen.append((tag.date, tag.date + timedelta(days=1), cents))
    return spannen

class CalendarService:
    slice_name = "calendar"

    def __init__(self, client: Client | None = None) -> None:
        # client optional, damit der Health-Endpoint ohne Supabase-Key läuft.
        self._client = client
        # property_id → tenant_id bzw. (base_price, min_stay), nur für die
        # Lebensdauer EINES Requests (der Service wird je Request neu gebaut).
        self._tenant_cache: dict[str, str | None] = {}
        self._rate_plan_cache: dict[str, tuple[float | None, int | None]] = {}

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise CalendarError("Kalender-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_own_property(self, ctx: AuthContext, property_id: str) -> None:
        """Stellt sicher, dass das Objekt sichtbar ist (sonst 404).

        Der Service nutzt den Service-Role-Key und umgeht damit RLS — der Scope
        MUSS hier explizit erzwungen werden, sonst lassen sich über geratene
        property_id fremde Verfügbarkeiten/Preise/Stop-Sells lesen oder ändern.
        Zwei Ebenen: (1) Tenant-Scope für alle, (2) Owner sieht laut §4.2 NUR
        seine zugeordneten Objekte (owner_property_assignments), nicht die
        anderer Eigentümer desselben Tenants. Einmal am Eintritt geprüft, sind
        die nachgelagerten property_id-Reads sicher.
        """
        if not ctx.tenant_id:
            raise CalendarError("Kein Tenant im Konto.", status_code=400)
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
            raise CalendarError("Objekt nicht gefunden.", status_code=404)
        # Eigentümer dürfen nur ihre zugeordneten Objekte sehen (§4.2) — fremde
        # Objekte wie „nicht gefunden" behandeln (keine Existenz verraten).
        if is_owner(ctx) and property_id not in owner_property_ids(self._db(), ctx):
            raise CalendarError("Objekt nicht gefunden.", status_code=404)

    def _require_tenant_property(self, tenant_id: str, property_id: str) -> None:
        """Tenant-Scope-Prüfung für SCHREIB-Pfade (block/price/stop-sell/season).

        Diese Endpunkte verlangen MANAGE_CALENDAR/EDIT_CALENDAR_BOOKINGS — die
        owner-Rolle besitzt keine davon und erreicht sie nie. Deshalb reicht hier
        der reine Tenant-Scope; der Owner-Self-Scope liegt auf den Lese-Pfaden
        (_require_own_property mit ctx)."""
        if not tenant_id:
            raise CalendarError("Kein Tenant im Konto.", status_code=400)
        res = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise CalendarError("Objekt nicht gefunden.", status_code=404)

    def _darf_preise_sehen(self, ctx: AuthContext) -> bool:
        """Betrags-Recht aus der DB (Rolle + effektive Permissions), fail-closed.

        Früher hing das allein an `is_owner(ctx)` — damit sah JEDE andere Rolle
        die vollen Tagespreise, auch `staff` und `cleaner`, die laut §4.3 keinen
        Finanz-/Vertriebseinblick haben. `load_guest_mask` ist dieselbe Quelle,
        die der reservations-Slice für Beträge nutzt (PM_BOOKING_TOTAL, von
        HIDE_PRICES überstimmbar) und liest die Rolle aus der DB statt aus dem
        evtl. veralteten JWT (Wurzel 7).
        """
        return load_guest_mask(self._client, ctx.user_id).amounts

    def _strip_prices(
        self, ctx: AuthContext, days: list[DayAvailability]
    ) -> list[DayAvailability]:
        """Tagespreise/Preisfaktoren entfernen, wenn die Rolle kein Betrags-Recht
        hat (§4.2 owner, §4.3 staff/cleaner). Verfügbarkeit, Min-Stay und
        Belegung bleiben sichtbar — nur der Geldwert fällt weg."""
        if self._darf_preise_sehen(ctx):
            return days
        return _ohne_preise(days)

    def _resolver(self) -> "PricingResolver":
        """Zentraler Preis-Resolver (eine Preis-Wahrheit für Kalender + Quote)."""
        from src.features.pricing.resolver import PricingResolver

        return PricingResolver(service_client=self._db())

    def get_availability(
        self, ctx: AuthContext, property_id: str, rng: DateRange
    ) -> list[DayAvailability]:
        """Tagesstatus im Zeitraum inkl. Preis + Min-Stay. Fehlende Tage = offen.

        Preis je Tag kommt aus dem zentralen Preis-Resolver (override > weekday >
        base) — DIESELBE Wahrheit wie der Buchungs-Quote, damit Kalender und Quote
        nie auseinanderlaufen. Min-Stay kommt aus dem Rate-Plan (per-Tag-
        Restriktionen sind v2). Ohne Rate-Plan/Override bleibt der Preis None
        (kein erfundener Fallback-Preis).
        """
        self._require_own_property(ctx, property_id)
        days = self._days_for(property_id, rng)
        return self._strip_prices(ctx, days)

    def _days_for(self, property_id: str, rng: DateRange) -> list[DayAvailability]:
        """Tagesstatus + Preis + Min-Stay OHNE Scope-Prüfung — interner Helfer für
        get_availability (nach Scope-Check) und die Schreib-Pfade (block), die den
        Scope bereits über _require_tenant_property erzwungen haben."""
        rows = self._fetch_days(property_id, rng)
        effective = {
            d.date.isoformat(): d
            for d in self._resolver().effective_prices(property_id, rng.start, rng.end)
        }
        _base, min_stay = self._fetch_rate_plan(property_id)
        return self._build_days(
            rng,
            rows,
            effective,
            min_stay,
            self._wetter(property_id, rng),
            self._wartende_tage(property_id, rng),
        )

    def _wartende_tage(self, property_id: str, rng: DateRange) -> set[str]:
        """Tage, deren berechneter Preis noch nicht an die Portale ging.

        Der Preis GILT lokal bereits (Kalender, Angebot, eigene Plattform);
        nur die Portale kennen ihn noch nicht. Ohne diese Kennzeichnung stuende
        im Kalender eine Zahl, von der niemand weiss, ob Airbnb sie hat.

        Nutzt den Client DIESES Service, statt sich selbst einen zu holen: ein
        eigener Verbindungsaufbau liefe auch im Unit-Test los.
        """
        from src.features.pricing.freigabe import gesperrte_tage  # noqa: PLC0415

        try:
            return gesperrte_tage(self._db(), property_id, rng.start, rng.end)
        except Exception as exc:  # noqa: BLE001 - Kennzeichnung ist Beiwerk
            log.warning("kalender_wartende_tage_unlesbar", error=str(exc)[:200])
            return set()

    def _wetter(self, property_id: str, rng: DateRange) -> dict[str, object]:
        """Wetter je Tag am STANDORT DES OBJEKTS — für die Anzeige im Kalender.

        Best-effort und bewusst leise: das Wetter ist Beiwerk der Kalenderansicht,
        ein Ausfall der Wetterquelle darf den Kalender nie kippen. Die Quelle
        selbst loggt laut, wenn sie nicht arbeiten kann (fehlender Schlüssel,
        abgelehnter Abruf) — hier bleibt nur die leere Menge.
        """
        try:
            from src.features.pricing.weather import (  # noqa: PLC0415
                WeatherProvider,
            )

            row = (
                self._db()
                .table("properties")
                .select("lat, lng")
                .eq("id", property_id)
                .limit(1)
                .execute()
            ).data or []
            if not row or row[0].get("lat") is None or row[0].get("lng") is None:
                return {}
            heute = datetime.now(UTC).date()
            tage = list(rng.nights())
            return WeatherProvider().wetter_tage(
                row[0]["lat"], row[0]["lng"], tage, heute,
                normalwerte=self._klima_normalwerte(property_id, tage),
            )
        except Exception as exc:  # noqa: BLE001 — Anzeige-Beiwerk, nie den Kalender kippen
            log.warning("kalender_wetter_nicht_ladbar", error=str(exc)[:200])
            return {}

    def _klima_normalwerte(
        self, property_id: str, tage: "list[date]"
    ) -> dict[str, object]:
        """Langjährige Tagesmittel des Objekts als WetterTag je ISO-Datum.

        Deckt die Tage jenseits des Vorhersagehorizonts ab (Kalendertag-genau,
        jahresunabhängig — der Wert für den 14. Mai gilt in jedem Jahr)."""
        from src.features.pricing.weather import WetterTag  # noqa: PLC0415

        rows = (
            self._db()
            .table("klima_normalwerte")
            .select("monat, tag, score, temp_c, niederschlag_mm, bewoelkung_pct")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        if not rows:
            return {}
        je_kalendertag = {(r["monat"], r["tag"]): r for r in rows}
        out: dict[str, object] = {}
        for d in tage:
            r = je_kalendertag.get((d.month, d.day))
            if r is None:
                continue
            out[d.isoformat()] = WetterTag(
                score=float(r["score"]),
                quelle="saisonal",
                temp_c=float(r["temp_c"]) if r.get("temp_c") is not None else None,
                niederschlag_mm=(
                    float(r["niederschlag_mm"])
                    if r.get("niederschlag_mm") is not None
                    else None
                ),
                bewoelkung_pct=(
                    float(r["bewoelkung_pct"])
                    if r.get("bewoelkung_pct") is not None
                    else None
                ),
            )
        return out

    @staticmethod
    def _build_days(
        rng: DateRange,
        rows: list[dict],
        effective: dict,
        min_stay: int | None,
        wetter: dict[str, object] | None = None,
        wartende: set[str] | None = None,
    ) -> list[DayAvailability]:
        """Tagesliste aus availability-Zeilen + effektiven Preisen bauen. Eine
        Quelle für Einzel- (get_availability) und Batch-Pfad (get_board), damit
        beide identische DayAvailability liefern."""
        # Seit dem Einheiten-Modell (0266) liegt je Tag EINE ZEILE JE EINHEIT
        # vor. Ein blosses Dictionary behielte davon die zuletzt gelesene —
        # welche das ist, bestimmt die Reihenfolge, die PostgREST ohne `order`
        # zufällig liefert. Ein Typ mit fünf Einheiten zeigte denselben Tag
        # deshalb mal gesperrt, mal frei (Wurzel 4: kein Zufallswert).
        #
        # Der Kalender zeigt EINE Zeile je Objekt, also braucht er einen
        # deterministischen Vorrang: der restriktivste Zustand gewinnt. Eine
        # gebuchte Einheit macht den Tag „gebucht", eine gesperrte „gesperrt" —
        # nur wenn ALLE Einheiten offen sind, ist der Tag offen. Die tatsächlich
        # freie Stückzahl geht ohnehin getrennt an die Portale
        # (`freie_einheiten_spannen`); hier geht es allein um die Anzeige.
        vorrang = {
            AvailabilityStatus.booked.value: 3,
            AvailabilityStatus.blocked.value: 2,
            AvailabilityStatus.open.value: 1,
        }
        by_date: dict[str, dict] = {}
        for r in rows:
            vorhanden = by_date.get(r["date"])
            if vorhanden is None or vorrang.get(r["status"], 0) > vorrang.get(
                vorhanden["status"], 0
            ):
                by_date[r["date"]] = r
        result: list[DayAvailability] = []
        for day in rng.nights():
            key = day.isoformat()
            row = by_date.get(key)
            eff = effective.get(key)
            w = (wetter or {}).get(key)
            result.append(
                DayAvailability(
                    date=day,
                    status=(
                        AvailabilityStatus(row["status"])
                        if row is not None
                        else AvailabilityStatus.open
                    ),
                    source=(
                        AvailabilitySource(row["source"])
                        if row is not None
                        else AvailabilitySource.manual
                    ),
                    price=eff.price if eff else None,
                    price_source=eff.source if eff else "none",
                    price_factors=eff.factors if eff else None,
                    preis_wartet_auf_freigabe=bool(
                        wartende and key in wartende
                    ),
                    wetter_score=getattr(w, "score", None),
                    wetter_quelle=getattr(w, "quelle", None),
                    wetter_temp_c=getattr(w, "temp_c", None),
                    wetter_niederschlag_mm=getattr(w, "niederschlag_mm", None),
                    wetter_bewoelkung_pct=getattr(w, "bewoelkung_pct", None),
                    # Die Regel DIESER Nacht schlägt die des Rate-Plans: ein
                    # Regelsatz („Hochsommer, mindestens 7 Nächte") gilt für
                    # seine Tage, der Plan für den Rest (0572). Fehlt der
                    # Tageswert, bleibt es beim objektweiten.
                    min_stay=(
                        row.get("min_stay")
                        if row and row.get("min_stay") is not None
                        else min_stay
                    ),
                    max_stay=row.get("max_stay") if row else None,
                    closed_to_arrival=bool(
                        row.get("closed_to_arrival") if row else False
                    ),
                    closed_to_departure=bool(
                        row.get("closed_to_departure") if row else False
                    ),
                )
            )
        return result

    def get_board(
        self, ctx: AuthContext, property_ids: list[str], rng: DateRange
    ) -> BoardResponse:
        """Kalender-Batch: Availability + Preise + Min-Stay + Stop-Sell für ALLE
        angefragten Objekte des Tenants in EINEM Aufruf.

        Ersetzt die N+1-Einzelabrufe (früher 2 HTTP-Calls × je 6 DB-Queries pro
        Objekt) durch wenige gebündelte `.in_(property_ids)`-Queries. Nur Objekte,
        die DIESEM Tenant gehören, werden geladen (Tenant-Scope wie überall, da der
        Service-Role-Key RLS umgeht); ein Eigentümer sieht laut §4.2 zusätzlich
        NUR seine zugeordneten Objekte. Fremde/unbekannte IDs werden still
        verworfen; Tagespreise werden für Eigentümer entfernt (kein Preis-Recht).
        """
        if not ctx.tenant_id:
            raise CalendarError("Kein Tenant im Konto.", status_code=400)
        if not property_ids:
            return BoardResponse(items=[])
        # 1 Query: eigene Objekte des Tenants (zugleich Scope-Filter).
        owned = {
            r["id"]
            for r in (
                self._db()
                .table("properties")
                .select("id")
                .eq("tenant_id", ctx.tenant_id)
                .in_("id", property_ids)
                .execute()
            ).data or []
        }
        # Owner: zusätzlich auf die zugeordneten Objekte einschränken (§4.2).
        if is_owner(ctx):
            owned &= owner_property_ids(self._db(), ctx)
        # Eingabereihenfolge beibehalten, aber nur sichtbare IDs.
        pids = [p for p in property_ids if p in owned]
        if not pids:
            return BoardResponse(items=[])

        start_iso, end_iso = rng.start.isoformat(), rng.end.isoformat()
        # 1 Query: availability aller Objekte im Zeitraum.
        # PAGINIERT (Wurzel 4/5): PostgREST cappt jede Antwort bei 1000 Zeilen.
        # Der Kalender fragt 19 Objekte × 120 Tage = 2280 Zeilen an — die Antwort
        # brach also nach 1000 ab, und ALLES danach fehlte lautlos. Live
        # beobachtet: eine gesetzte Sperre stand korrekt in der Datenbank, kam
        # aber nie in der Oberfläche an, weil ihre Zeilen jenseits des Caps
        # lagen. Kein Fehler, keine Warnung — die fehlenden Tage wurden schlicht
        # als „offen" ergänzt, der Kalender zeigte verkäuflich, was gesperrt war.
        # `fetch_all_rows` verlangt eine stabile Sortierung, sonst kann die
        # Seitenbildung Zeilen doppeln oder überspringen.
        avail_rows = fetch_all_rows(
            self._db()
            .table("availability")
            .select(
                "property_id,date,status,source,min_stay,max_stay,"
                "closed_to_arrival,closed_to_departure"
            )
            .in_("property_id", pids)
            .gte("date", start_iso)
            .lt("date", end_iso)
            .order("property_id")
            .order("date")
        )
        avail_by_pid: dict[str, list[dict]] = {}
        for r in avail_rows:
            avail_by_pid.setdefault(r["property_id"], []).append(r)

        # 1 Query: Rate-Plans (Min-Stay + Währung je Objekt; ältester gewinnt).
        min_stay_by_pid, currency_by_pid = self._fetch_rate_plan_bulk(pids)
        # 4 Queries (im Resolver): effektive Preise aller Objekte.
        prices = self._resolver().effective_prices_bulk(pids, rng.start, rng.end)
        # 1 Query: Stop-Sells aller Objekte im Zeitraum.
        stop_by_pid = self._list_stop_sell_bulk(pids, rng)

        # EINMAL laden, nicht je Objekt: die Maske ist eine DB-Abfrage und für
        # alle Objekte dieselbe (sie hängt am Nutzer, nicht am Objekt).
        darf_preise = self._darf_preise_sehen(ctx)
        items: list[BoardProperty] = []
        for pid in pids:
            effective = {d.date.isoformat(): d for d in prices.get(pid, [])}
            days = self._build_days(
                rng, avail_by_pid.get(pid, []), effective, min_stay_by_pid.get(pid)
            )
            items.append(
                BoardProperty(
                    property_id=pid,
                    # Ohne Preis-Recht auch keine Währung — ein Währungslabel
                    # ohne Betrag ist ein Rest, der nichts aussagt.
                    currency=currency_by_pid.get(pid) if darf_preise else None,
                    days=days if darf_preise else _ohne_preise(days),
                    stop_sell=stop_by_pid.get(pid, []),
                )
            )
        return BoardResponse(items=items)

    def _fetch_rate_plan_bulk(
        self, property_ids: list[str]
    ) -> tuple[dict[str, int | None], dict[str, str | None]]:
        """Min-Stay UND Währung je Objekt aus dem ältesten Rate-Plan (eine
        `.in_()`-Query). Die Währung reicht das Board ans Frontend durch, damit
        die Tagespreise korrekt formatiert werden (nicht mehr aus Reservierungen
        abgeleitet — Objekte ohne Buchung hätten sonst keine Währung)."""
        rows = (
            self._db()
            .table("rate_plans")
            .select("property_id,min_stay,currency,created_at")
            .in_("property_id", property_ids)
            .order("created_at")
            .execute()
        ).data or []
        min_stay: dict[str, int | None] = {}
        currency: dict[str, str | None] = {}
        for r in rows:
            pid = r.get("property_id")
            if isinstance(pid, str) and pid not in min_stay:  # erster = ältester
                ms = r.get("min_stay")
                min_stay[pid] = int(ms) if ms is not None else None
                currency[pid] = r.get("currency") or None
        return min_stay, currency

    def _list_stop_sell_bulk(
        self, property_ids: list[str], rng: DateRange
    ) -> dict[str, list[StopSellDay]]:
        """Stop-Sells aller Objekte im Zeitraum (eine `.in_()`-Query) inkl.
        travel_agencies-Name fürs Balken-Label — gruppiert nach property_id."""
        # Paginiert wie die Verfügbarkeit: bei vielen Objekten × langem Zeitraum
        # reißt der 1000-Zeilen-Cap sonst die späteren Stopps ab.
        rows = fetch_all_rows(
            self._db()
            .table("stop_sell")
            .select(
                f"id,property_id,date,reason,source,{_STOP_SELL_SCOPE_COLS}"
                "agency_id,travel_agencies(name)"
            )
            .in_("property_id", property_ids)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .order("property_id")
            .order("date")
        )
        out: dict[str, list[StopSellDay]] = {}
        for row in rows:
            agency = row.pop("travel_agencies", None) or {}
            row["agency_name"] = agency.get("name") if isinstance(agency, dict) else None
            _default_stop_sell_scope(row)
            out.setdefault(row["property_id"], []).append(StopSellDay(**row))
        return out

    def check_availability(
        self, ctx: AuthContext, property_id: str, rng: DateRange
    ) -> AvailabilityCheck:
        """Double-Booking-Schutz: frei nur, wenn KEIN Tag booked/blocked ODER
        per Stop-Sell gesperrt ist."""
        conflicts: list[date] = [
            d.date
            for d in self.get_availability(ctx, property_id, rng)
            if d.status != AvailabilityStatus.open
        ]
        # Stop-Sell zählt als Konflikt (Wurzel 1): Er lebt in einer eigenen
        # Tabelle und taucht in `availability` nicht auf, blockt die Buchung
        # aber hart (RPC wirft RS409). Ohne diesen Zweig meldete `/calendar/check`
        # für einen komplett gestoppten Zeitraum `available: true` — jeder
        # Konsument sah einen freien Zeitraum, der beim Buchen mit 409 abbrach.
        # Nur die Objekt-Ebene: ein plan-genauer Hotel-Stopp sperrt nicht den Typ.
        belegt = {d.isoformat() for d in conflicts}
        for row in (
            self._db()
            .table("stop_sell")
            .select("date")
            .eq("property_id", property_id)
            .is_("rate_plan_id", "null")
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .execute()
        ).data or []:
            if row["date"] not in belegt:
                conflicts.append(date.fromisoformat(row["date"]))
        conflicts.sort()
        return AvailabilityCheck(
            property_id=property_id,
            available=not conflicts,
            conflicting_days=conflicts,
        )

    def freie_einheiten(
        self, ctx: AuthContext, property_id: str, rng: DateRange
    ) -> FreieEinheitenResponse:
        """Freie Einheiten je Zeitraum als ZAHL, tenant-/owner-gescoped.

        `core.einheiten_verfuegbar.freie_einheiten_spannen` ist eine reine
        Rechenfunktion für den ARI-Push: sie nimmt eine `tenant_id` entgegen,
        prüft aber weder Kontext noch Rolle noch Objekt-Zuordnung — direkt
        aufgerufen ließe sie sich mit einer geratenen `property_id` fremd
        auslesen (Wurzel 3). Diese Methode ist der gescopete Weg dorthin.

        Der STOP-SELL steckt seit dem 15.08.2026 in `freie_einheiten_spannen`
        selbst und wird hier NICHT mehr nachgerechnet. Vorher lag die
        Verrechnung allein in dieser Anzeigemethode — der ARI-Push rief die
        rohen Spannen und meldete an Booking.com weiterhin einen Bestand > 0,
        obwohl der Tag gesperrt war. Genau daran ging eine Sperre live verloren
        (siehe Modul-Docstring von `core.einheiten_verfuegbar`). Eine zweite
        Verrechnung an dieser Stelle wäre jetzt doppelt gemoppelt und würde die
        eine Wahrheit wieder aufspalten.
        """
        self._require_own_property(ctx, property_id)
        if not ctx.tenant_id:
            raise CalendarError("Kein Tenant im Konto.", status_code=400)
        # `bis` ist bei freie_einheiten_spannen INKLUSIV, DateRange.end exklusiv.
        letzter_tag = rng.end - timedelta(days=1)
        gesamt = einheiten_zahl(self._db(), ctx.tenant_id, property_id)
        spannen = [
            FreieEinheitenSpanne(von=v, bis=b, frei=f, gesamt=gesamt)
            for v, b, f in freie_einheiten_spannen(
                self._db(), ctx.tenant_id, property_id, rng.start, letzter_tag
            )
        ]
        return FreieEinheitenResponse(
            property_id=property_id, gesamt=gesamt, spannen=spannen
        )

    def _stop_sell_tage(self, property_id: str, rng: DateRange) -> set[date]:
        """Objekt-weite Stop-Sell-Tage im Zeitraum (ohne plan-genaue Stopps).

        Nur `rate_plan_id is null`: ein Stopp für EINEN Rate-Plan schließt den
        Einheiten-Typ nicht — die anderen Pläne bleiben verkäuflich.
        """
        rows = (
            self._db()
            .table("stop_sell")
            .select("date")
            .eq("property_id", property_id)
            .is_("rate_plan_id", "null")
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .execute()
        ).data or []
        return {date.fromisoformat(str(r["date"])[:10]) for r in rows}

    def block(
        self,
        tenant_id: str,
        req: BlockRequest,
        *,
        block_request_id: str | None = None,
    ) -> int:
        """Tage sperren (manuell). Idempotenter Upsert pro Tag. Gibt Anzahl zurück.

        Schützt vor Double-Booking: bereits gebuchte Tage werden NICHT überschrieben.

        `block_request_id` verknüpft die gesperrten Nächte mit dem GENEHMIGTEN
        Eigentümer-Antrag (0337), damit sein Widerruf gezielt nur diese Zeilen
        wieder freigibt. `None` ist der Normalfall und kein fehlender Wert: eine
        Agentur-Sperre (Renovierung) entsteht ohne Antrag. Der Parameter steht
        BEWUSST nicht im HTTP-`BlockRequest` — er darf nicht vom Client kommen,
        sonst hängte jemand seine Sperre an einen fremden Antrag (Wurzel 3).

        FREMDE SPERREN BLEIBEN FREMD: Der Upsert läuft auf
        `(property_id, unit_id, date)`. Eine Nacht, die schon von jemand
        anderem gesperrt ist, würde durch ein blindes Schreiben SEINE Zeile
        übernehmen — die Agentur-Sperre trüge danach die Antrags-ID und der
        Widerruf des Antrags löschte sie doch wieder mit. Solche Tage werden
        deshalb ausgelassen: sie sind bereits gesperrt, die Sperre ist der
        Zielzustand, und der Antrag beansprucht nur die Nächte, die es OHNE
        ihn nicht gäbe.

        `req.unit_id` (0353) begrenzt die Sperre auf EINE Einheit des Typs:
        beim Typ mit fünf gleichen Studios nimmt die Eigennutzung eines Studios
        nur dieses aus dem Verkauf, die übrigen vier bleiben buchbar. Ohne
        Angabe gilt die Sperre wie bisher dem ganzen Typ (alle Einheiten).
        """
        self._require_tenant_property(tenant_id, req.property_id)
        unit_id = self._require_tenant_unit(
            tenant_id, req.property_id, req.unit_id
        )
        booked = self._belegte_tage(req.property_id, req.range, unit_id)
        if booked:
            raise CalendarError(
                "Zeitraum enthält bereits gebuchte Tage.", status_code=409
            )
        fremd = (
            self._fremde_sperrtage(
                req.property_id, req.range, block_request_id, unit_id
            )
            if block_request_id is not None
            else frozenset()
        )
        payload = [
            {
                "property_id": req.property_id,
                "date": day.isoformat(),
                "status": AvailabilityStatus.blocked.value,
                "source": AvailabilitySource.manual.value,
                "block_request_id": block_request_id,
            }
            for day in req.range.nights()
            if day.isoformat() not in fremd
        ]
        if not payload:
            # Alles im Zeitraum ist bereits anderweitig gesperrt. Der
            # Zielzustand steht — es wird nichts geschrieben und nichts an
            # Channex gemeldet, aber auch kein Fehler erfunden.
            log.info(
                "calendar_block_bereits_gesperrt",
                property_id=req.property_id,
                block_request_id=block_request_id,
            )
            return 0
        # Ohne benannte Einheit gilt die Sperre dem ganzen Typ → je Einheit eine
        # Zeile (0266); mit Einheit genau deren Zeile (0353).
        self._db().table("availability").upsert(
            je_einheit(
                self._db(), req.property_id, payload,
                tenant_id=tenant_id, unit_id=unit_id,
            ),
            on_conflict=AVAILABILITY_CONFLICT,
        ).execute()
        # Realtime: den fertigen Stand an die Portale. Hier stand ein festes `0`
        # — richtig, solange eine Sperre immer ALLE Einheiten traf. Seit die
        # Sperre eine einzelne Einheit meinen kann (0353), nähme das dem ganzen
        # Typ die Verfügbarkeit; gemeldet wird die echte Zahl der übrigen
        # freien Einheiten. Der Upsert ist bereits geschrieben, der Helfer sieht
        # also den Zustand NACH der Sperre.
        self._push_einheiten_stand(req.property_id, req.range)
        log.info("calendar_block", property_id=req.property_id, days=len(payload))
        return len(payload)

    def _require_tenant_unit(
        self, tenant_id: str, property_id: str, unit_id: str | None
    ) -> str | None:
        """Die benannte Einheit gehört zu DIESEM Objekt und DIESEM Mandanten.

        Wurzel 3: Der Service läuft mit dem Service-Role-Key und umgeht RLS.
        Eine ungeprüft übernommene `unit_id` aus dem Request wanderte direkt in
        die `availability`-Zeile — damit ließe sich über eine geratene UUID die
        Einheit eines FREMDEN Objekts sperren (und über den Widerruf wieder
        freigeben). Beide Filter in DERSELBEN Abfrage, damit Load und Scope
        nicht auseinanderfallen.

        `None` bleibt `None`: keine Angabe heißt „der ganze Typ" und ist kein
        fehlender Wert, der zu ersetzen wäre (Wurzel 4).
        """
        if unit_id is None:
            return None
        rows = (
            self._db()
            .table("property_units")
            .select("id")
            .eq("id", unit_id)
            .eq("property_id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise CalendarError(
                "Einheit gehört nicht zu diesem Objekt.", status_code=422
            )
        return unit_id

    def _belegte_tage(
        self, property_id: str, rng: DateRange, unit_id: str | None
    ) -> list[str]:
        """Gebuchte Tage, die einer Sperre im Weg stehen.

        OHNE Einheit gilt die Sperre dem ganzen Typ: JEDE gebuchte Nacht
        irgendeiner Einheit steht ihr im Weg (das bisherige Verhalten über
        `_days_for`). MIT Einheit zählt nur deren eigene Belegung — die Buchung
        auf Studio 1 darf die Eigennutzung von Studio 3 nicht verhindern.
        """
        query = (
            self._db()
            .table("availability")
            .select("date, unit_id")
            .eq("property_id", property_id)
            .eq("status", AvailabilityStatus.booked.value)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
        )
        if unit_id is not None:
            query = query.eq("unit_id", unit_id)
        return [str(r["date"]) for r in (query.execute()).data or []]

    def _fremde_sperrtage(
        self,
        property_id: str,
        rng: DateRange,
        block_request_id: str,
        unit_id: str | None = None,
    ) -> frozenset[str]:
        """Tage im Zeitraum, die eine ANDERE Sperre bereits hält.

        „Andere" heißt: `block_request_id` ist NULL (Agentur-Sperre) oder eine
        andere Antrags-ID. Die eigenen Zeilen sind ausgenommen — sonst könnte
        ein Retry derselben Genehmigung seine eigene Sperre nicht mehr
        auffrischen (Wurzel 2: retrybar bleiben).

        `unit_id` grenzt die Frage auf die zu sperrende Einheit ein: eine
        fremde Sperre auf Studio 1 darf den Antrag auf Studio 3 nicht um seine
        Nächte bringen (sonst schriebe er gar nichts und meldete „bereits
        gesperrt", obwohl Studio 3 offen ist).
        """
        query = (
            self._db()
            .table("availability")
            .select("date, block_request_id")
            .eq("property_id", property_id)
            .eq("status", AvailabilityStatus.blocked.value)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
        )
        if unit_id is not None:
            query = query.eq("unit_id", unit_id)
        rows = (query.execute()).data or []
        return frozenset(
            str(r["date"])
            for r in rows
            if r.get("block_request_id") != block_request_id
        )

    def set_price_override(self, tenant_id: str, req: PriceOverrideRequest) -> None:
        """Tagespreis im Kalenderblatt setzen/zurücknehmen (Lastenheft §2.2).

        price=None nimmt die Überschreibung zurück (Tag folgt wieder dem Rate-Plan).
        In beiden Fällen wird der jetzt gültige Tagespreis an Channex gepusht: beim
        Setzen der neue Wert, beim Zurücknehmen der wieder greifende Rate-Plan-Preis
        (Gegenzustand, Wurzel 1) — sonst behielten die OTAs den alten Override.
        """
        self._require_tenant_property(tenant_id, req.property_id)
        # Ein Tag oder ein Bereich [date, end) — die Obergrenze (366 Tage)
        # erzwingt das Schema, hier kommt nie ein unbegrenzter Bereich an.
        tage = req.tage()
        self._db().table("price_overrides").upsert(
            [
                {
                    "property_id": req.property_id,
                    "date": tag.isoformat(),
                    "price": req.price,
                }
                for tag in tage
            ],
            on_conflict="property_id,date",
        ).execute()
        # Realtime an Channex: beim Setzen EIN Push über den ganzen Bereich,
        # beim Zurücknehmen der neu aufgelöste effektive Preis je Tag
        # (dynamic/weekday/base) — zusammengefasst zu Spannen gleichen Preises,
        # damit ein Jahr nicht 365 Jobs erzeugt, sondern einen je Saison.
        end = tage[-1] + timedelta(days=1)
        if req.price is not None:
            self._push_channex_rate(
                req.property_id, req.date, end, round(req.price * 100)
            )
        else:
            days = self._resolver().effective_prices(req.property_id, req.date, end)
            for von, bis, cents in _preis_spannen(days):
                self._push_channex_rate(req.property_id, von, bis, cents)
        log.info(
            "calendar_price_override",
            property_id=req.property_id,
            date=req.date.isoformat(),
            end=end.isoformat(),
            tage=len(tage),
            cleared=req.price is None,
        )

    def _fetch_days(self, property_id: str, rng: DateRange) -> list[dict[str, str]]:
        res = (
            self._db()
            .table("availability")
            .select(
                "date,status,source,min_stay,max_stay,"
                "closed_to_arrival,closed_to_departure"
            )
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .execute()
        )
        return res.data or []

    def _booked_dates(self, property_id: str, rng: DateRange) -> set[str]:
        """Gebuchte Tage (availability.status='booked') im Range als ISO-Strings.
        Eine Quelle der Wahrheit für „welche Tage sind belegt" — jeder Buchungs-
        pfad schreibt synchron booked, jeder Storno setzt zurück auf open, also
        ist die availability-Tabelle die kanonische, für-Range-abfragbare Wahrheit.
        Genutzt vom Stop-Sell-Guard: auf einem gebuchten Tag darf NIE ein
        Stop-Sell liegen (der Tag ist bereits verkauft)."""
        return {
            row["date"]
            for row in self._fetch_days(property_id, rng)
            if row.get("status") == AvailabilityStatus.booked.value
        }

    def _fetch_rate_plan(
        self, property_id: str
    ) -> tuple[float | None, int | None]:
        """Basispreis + Min-Stay aus dem (ersten) Rate-Plan des Objekts.

        Ohne Rate-Plan → (None, None); es wird kein Preis erfunden.

        Pro Request gecacht (wie _tenant_of): Saison-Aktionen materialisieren
        mehrere Zeiträume DESSELBEN Objekts und lasen den Plan sonst je Zeitraum.
        """
        if property_id in self._rate_plan_cache:
            return self._rate_plan_cache[property_id]
        res = (
            self._db()
            .table("rate_plans")
            .select("base_price,min_stay")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            self._rate_plan_cache[property_id] = (None, None)
            return None, None
        row = rows[0]
        base = row.get("base_price")
        min_stay = row.get("min_stay")
        plan = (
            float(base) if base is not None else None,
            int(min_stay) if min_stay is not None else None,
        )
        self._rate_plan_cache[property_id] = plan
        return plan

    # -- Stop-Sell (Verkaufsstopp je Tag) -------------------------------------
    def list_stop_sell(
        self, ctx: AuthContext, property_id: str, rng: DateRange
    ) -> list[dict[str, object]]:
        self._require_own_property(ctx, property_id)
        res = (
            self._db()
            .table("stop_sell")
            # travel_agencies-Embed: der Kalender zeigt am Stop-Sale-Balken,
            # an WEN sich der Stopp richtet (z. B. TUI) — nicht nur „Gesperrt".
            .select(
                f"id,property_id,date,reason,source,{_STOP_SELL_SCOPE_COLS}"
                "agency_id,travel_agencies(name)"
            )
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .order("date")
            .execute()
        )
        rows = res.data or []
        for row in rows:
            agency = row.pop("travel_agencies", None) or {}
            row["agency_name"] = (
                agency.get("name") if isinstance(agency, dict) else None
            )
            _default_stop_sell_scope(row)
        return rows

    def set_stop_sell(
        self,
        tenant_id: str,
        property_id: str,
        rng: DateRange,
        reason: str | None,
        weekdays: list[int] | None = None,
        agency_id: str | None = None,
    ) -> dict[str, int]:
        """Verkaufsstopp manuell setzen (idempotent pro Tag) und als
        stop_sell-Restriction an Channex pushen. `weekdays` (ISO 0=Mo … 6=So)
        beschränkt optional auf Wochentage im Zeitraum (z. B. nur Wochenenden).
        `agency_id` dokumentiert den Adressaten der Stop-Sale-Meldung
        (Reisebüro/Veranstalter); None = gilt allen Kanälen.

        Gibt ``{stopped_days, skipped_booked}`` zurück: gebuchte Tage werden
        NIE gestoppt (der Tag ist bereits verkauft) und stattdessen gemeldet,
        damit die UI die Überschneidung anzeigen kann."""
        self._require_tenant_property(tenant_id, property_id)
        if agency_id is not None:
            # Tenant-Scope explizit prüfen (Service-Role umgeht RLS) — sonst
            # ließen sich fremde Agenturen referenzieren/als Orakel abfragen.
            owned = (
                self._db()
                .table("travel_agencies")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("id", agency_id)
                .limit(1)
                .execute()
            ).data
            if not owned:
                raise CalendarError("Reisebüro nicht gefunden.", status_code=404)
        days = [d for d in rng.nights() if not weekdays or d.weekday() in weekdays]
        if not days:
            return {"stopped_days": 0, "skipped_booked": 0}
        # Gebuchte Tage NIE stoppen: ein gebuchter Tag ist verkauft, ein
        # Stop-Sell darüber wäre bedeutungslos und würde die Verfügbarkeits-
        # Wahrheit verfälschen. Übersprungene Tage separat melden (UI-Hinweis).
        booked = self._booked_dates(property_id, rng)
        before = len(days)
        days = [d for d in days if d.isoformat() not in booked]
        skipped_booked = before - len(days)
        # Channex-seitige Stops (source=channex) nie überschreiben — der Upsert
        # würde sonst ihre source auf manual kippen und ein späteres Aufheben
        # würde OTA-Stops öffnen. Nur die OBJEKT-Ebene (rate_plan_id null) zählt:
        # ein plan-genauer OTA-Stop kollidiert nicht mit dem Objekt-Upsert.
        channex_days = {
            row["date"]
            for row in (
                self._db()
                .table("stop_sell")
                .select("date")
                .eq("property_id", property_id)
                .eq("source", "channex")
                .is_("rate_plan_id", "null")
                .gte("date", rng.start.isoformat())
                .lt("date", rng.end.isoformat())
                .execute()
            ).data
            or []
        }
        days = [d for d in days if d.isoformat() not in channex_days]
        if not days:
            return {"stopped_days": 0, "skipped_booked": skipped_booked}
        # `reason`/`agency_id` nur mitschreiben, wenn sie auch gesetzt sind
        # (Wurzel 1): PostgREST erzeugt `ON CONFLICT DO UPDATE SET` für JEDE
        # gelieferte Spalte, also überschrieb ein späterer Stopp ohne Grund die
        # Angaben eines früheren still mit NULL — ein Stopp „Renovierung, TUI"
        # verlor Grund und Adressat, sobald jemand denselben Tag erneut stoppte.
        # Der Upsert bleibt einheitlich (eine Payload-Form für alle Zeilen);
        # ein explizites Leeren geht weiterhin über clear_stop_sell.
        felder: dict[str, Any] = {"source": "manual"}
        if reason is not None:
            felder["reason"] = reason
        if agency_id is not None:
            felder["agency_id"] = agency_id
        payload = [
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "date": day.isoformat(),
                **felder,
            }
            for day in days
        ]
        # Konfliktziel = unique nulls not distinct (0152): rate_plan_id fehlt im
        # Payload → null → trifft die bestehende Objekt-Zeile des Tages.
        self._db().table("stop_sell").upsert(
            payload, on_conflict="property_id,date,rate_plan_id"
        ).execute()
        # Push NUR die tatsächlich gesetzten Tage (gebuchte/channex-Tage sind
        # raus) — als komprimierte Spannen. Kein roher Range-Push mehr, sonst
        # würde Stop-Sell für gebuchte Tage an die OTAs gemeldet.
        self._push_channex_stop_sell(
            property_id,
            merge_day_ranges(days, end_exclusive=False),
            stop_sell=True,
        )
        # Und die Stückzahl hinterher (Wurzel 1): die stop_sell-Restriction
        # allein lässt `/availability` unverändert stehen, und Booking.com
        # verkauft, solange dort ein Bestand > 0 gemeldet ist. NACH dem Upsert,
        # damit `freie_einheiten_spannen` den gerade gesetzten Stopp sieht.
        self._push_einheiten_stand(property_id, rng)
        log.info(
            "calendar_stop_sell_set",
            property_id=property_id,
            days=len(payload),
            skipped_booked=skipped_booked,
        )
        return {"stopped_days": len(payload), "skipped_booked": skipped_booked}

    def clear_stop_sell(
        self,
        tenant_id: str,
        property_id: str,
        rng: DateRange,
        weekdays: list[int] | None = None,
        *,
        include_portal: bool = False,
        include_rate_plans: bool = False,
    ) -> dict[str, int]:
        """Verkaufsstopp aufheben. Standard: nur manuelle Stops — Channex-Stops
        (source=channex) bleiben, die spiegeln den OTA-Stand und werden per Import
        gepflegt. Mit include_portal=True werden AUCH Portal-Stops entfernt (für
        versehentlich/über einen Test gesetzte Stops); die Tage werden dann auch an
        den OTAs geöffnet. An Channex wird stop_sell=false NUR für Tage gepusht, die
        danach wirklich keinen Stop mehr haben (sonst würden OTA-Stops geöffnet).

        `include_rate_plans` hebt zusätzlich die plan-genauen Stopps desselben
        Tages auf. Der Belegungsplan BRAUCHT das: er zeigt eine Zeile je OBJEKT
        und kennt keine Rate-Pläne — sein Balken steht auch dann da, wenn der
        Stopp an einem Plan hängt. Ohne das Flag lief der Klick dort ins Leere
        (der Filter unten warf die Zeile weg), der Balken blieb stehen, und es
        sah aus, als täte der Knopf nichts. Für die plan-genaue Hotel-Ansicht
        bleibt der Standard `False`, damit das Aufheben eines Objekt-Stopps
        nicht die Stopps einzelner Raten mitreißt (Wurzel 1)."""
        self._require_tenant_property(tenant_id, property_id)
        wanted = [d for d in rng.nights() if not weekdays or d.weekday() in weekdays]
        if not wanted:
            return {"cleared_days": 0}
        query = (
            self._db().table("stop_sell").delete().eq("property_id", property_id)
        )
        if not include_rate_plans:
            # NUR die Objekt-Ebene (Wurzel 1): `set_stop_sell` schreibt bewusst
            # ausschließlich Zeilen mit rate_plan_id IS NULL. Ohne diesen Filter
            # riss das Aufheben eines Objekt-Stopps alle plan-genauen Hotel-
            # Stopps desselben Tages mit (über bulk_restrictions gesetzt) und
            # pushte sie zusätzlich als stop_sell=false an die OTAs — die
            # gestoppte Rate war wieder verkäuflich, ohne Weg zurück.
            query = query.is_("rate_plan_id", "null")
        # Standard: nur manuelle Stops löschen. include_portal: auch Channex/Portal.
        if not include_portal:
            query = query.eq("source", "manual")
        if weekdays:
            query = query.in_("date", [d.isoformat() for d in wanted])
        else:
            query = query.gte("date", rng.start.isoformat()).lt(
                "date", rng.end.isoformat()
            )
        # Anzahl der WIRKLICH gelöschten Zeilen — sie geht an den Aufrufer
        # zurück. Ein DELETE, der nichts trifft, ist für PostgREST kein Fehler:
        # die Route meldete deshalb „ok", während der Balken im Kalender stehen
        # blieb (live beobachtet). Ohne diese Zahl kann die Oberfläche „nichts
        # gefunden" nicht von „aufgehoben" unterscheiden (Wurzel 5).
        geloescht = len(query.execute().data or [])
        # Verbleibende Stops dürfen nicht geöffnet werden — aber NUR die, die
        # denselben Zuschnitt haben wie der Push.
        #
        # WARUM DER FILTER (Wurzel 1): `_push_channex_stop_sell` meldet den
        # Stand des OBJEKTS. Eine verbliebene Zeile mit `rate_plan_id` sagt
        # nichts über die Objekt-Ebene aus; sie hier mitzuzählen unterdrückte
        # den Push für diesen Tag. Und wenn `include_portal` gesetzt ist, hat
        # der DELETE oben die Portal-Zeilen bereits mitgenommen — was jetzt
        # noch dasteht, ist ein Stop einer ANDEREN Ebene.
        #
        # Live gefunden am 10.08.2026 (FeWo *Stjerneskud*): Am 28.08. lag ein
        # plan-genauer Stopp. Beim Aufheben zählte er als „bleibt gesperrt",
        # `open_days` wurde leer, und es ging KEIN einziger `stop_sell=false`
        # an Channex. Lokal war der Stopp weg, bei Channex stand er weiter —
        # der nächste Import holte ihn als `source='channex'` zurück. Für den
        # Nutzer sah es aus, als setze Channex ununterbrochen neue Stop-Sells:
        # in Wahrheit hallte seine eigene, nie zugestellte Löschung nach.
        rest_query = (
            self._db()
            .table("stop_sell")
            .select("date")
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
        )
        if not include_rate_plans:
            # Ohne das Flag hat der DELETE die plan-genauen Zeilen bewusst
            # stehen lassen — dann sind sie echte verbleibende Stopps.
            rest_query = rest_query.is_("rate_plan_id", "null")
        remaining = {
            row["date"] for row in (rest_query.execute()).data or []
        }
        open_days = [d for d in wanted if d.isoformat() not in remaining]
        # Symmetrisch zu `set_stop_sell` (Wurzel 1): NUR die tatsächlich
        # geöffneten Tage pushen, als komprimierte Spannen. Der frühere
        # Sonderfall „nichts bleibt gesperrt → EIN roher Range-Push über
        # rng.start..rng.end" meldete `stop_sell=false` auch für Tage, die nie
        # gesperrt waren — inklusive GEBUCHTER Nächte (Überbuchungsrisiko) und
        # inklusive fremder Portal-Stops außerhalb unseres Wissens. Ein Stopp am
        # 05.06. aufzuheben öffnete so den ganzen Juni.
        self._push_channex_stop_sell(
            property_id,
            merge_day_ranges(open_days, end_exclusive=False),
            stop_sell=False,
        )
        # Gegenstück zu `set_stop_sell` (Wurzel 1): die Stückzahl stand während
        # des Stopps auf 0 und muss beim Aufheben zurück auf die echte Zahl
        # freier Einheiten — sonst bleibt das Objekt bei den Portalen
        # unverkäuflich, obwohl der Stopp weg ist. NACH dem DELETE, damit
        # `freie_einheiten_spannen` den neuen Stand sieht.
        self._push_einheiten_stand(property_id, rng)
        log.info(
            "calendar_stop_sell_cleared",
            property_id=property_id,
            geloescht=geloescht,
        )
        return {"cleared_days": geloescht}

    def reset_all_stop_sell(
        self, tenant_id: str, property_id: str | None = None
    ) -> dict[str, int]:
        """ALLE (auch Portal-/Channex-)Stop-Sells ab heute zurücksetzen — für
        versehentlich/über einen Test gesetzte Stops. property_id=None → alle
        Objekte des Tenants. Öffnet die betroffenen Tage auch an den OTAs
        (stop_sell=false), begrenzt auf die WIRKLICH vorhandenen Stop-Tage (kein
        erfundener Horizont, Wurzel 4). Gibt {properties, days} zurück."""
        if not tenant_id:
            raise CalendarError("Kein Tenant im Konto.", status_code=400)
        if property_id is not None:
            self._require_tenant_property(tenant_id, property_id)
            property_ids = [property_id]
        else:
            rows = (
                self._db()
                .table("properties")
                .select("id")
                .eq("tenant_id", tenant_id)
                .execute()
            ).data or []
            property_ids = [r["id"] for r in rows]
        today = date.today()
        total_days = 0
        for pid in property_ids:
            # Nur ZUKÜNFTIGE Stops (Channex nimmt keine Vergangenheit an); genau
            # deren Tage öffnen.
            existing = (
                self._db()
                .table("stop_sell")
                .select("date")
                .eq("property_id", pid)
                .gte("date", today.isoformat())
                .execute()
            ).data or []
            days = sorted(
                {date.fromisoformat(r["date"]) for r in existing if r.get("date")}
            )
            if not days:
                continue
            self._db().table("stop_sell").delete().eq(
                "property_id", pid
            ).gte("date", today.isoformat()).execute()
            self._push_channex_stop_sell(
                pid, merge_day_ranges(days, end_exclusive=False), stop_sell=False
            )
            # Auch hier die Stückzahl nachziehen (Wurzel 1) — sonst bleiben die
            # geöffneten Tage bei den Portalen auf 0 stehen. Der Zeitraum deckt
            # genau die aufgehobenen Tage ab; `DateRange.end` ist exklusiv.
            self._push_einheiten_stand(
                pid, DateRange(start=days[0], end=days[-1] + timedelta(days=1))
            )
            total_days += len(days)
        log.info(
            "calendar_stop_sell_reset",
            tenant_id=tenant_id,
            properties=len(property_ids),
            days=total_days,
        )
        return {"properties": len(property_ids), "days": total_days}

    def _tenant_of(self, property_id: str) -> str | None:
        """tenant_id eines Objekts (für die ARI-Push-Jobs). None, wenn das Objekt
        nicht existiert, keine tenant_id trägt oder keine DB verfügbar ist —
        best-effort, damit das Einreihen die Kalenderaktion nie kippt.

        Pro Request gecacht: Zeitraum-Aktionen reihen viele Jobs für DASSELBE
        Objekt ein; ohne Cache kostete jeder einzelne einen eigenen SELECT."""
        if self._client is None:
            return None
        if property_id in self._tenant_cache:
            return self._tenant_cache[property_id]
        rows = (
            self._db()
            .table("properties")
            .select("tenant_id")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        tenant_id = rows[0].get("tenant_id") if rows else None
        self._tenant_cache[property_id] = tenant_id
        return tenant_id

    def _push_channex_stop_sell(
        self,
        property_id: str,
        spans: list[tuple[date, date]],
        *,
        stop_sell: bool,
        days: list[str] | None = None,
    ) -> None:
        """Verkaufsstopp als stop_sell-ARI-Push-Job einreihen (Phase 2). Die `spans`
        sind bereits gefiltert (gebuchte/channex-Tage raus) → als ISO-Paare
        serialisiert ins Payload. KEIN coalesce (span-spezifisch)."""
        tenant_id = self._tenant_of(property_id) if spans else None
        if tenant_id is None:
            return
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "stop_sell",
            {"spans": [[a.isoformat(), b.isoformat()] for a, b in spans],
             "stop_sell": stop_sell, "days": days},
        )

    # -- Saisonpreise (Tagespreise je Zeitraum → price_overrides + Channex) ----
    def list_season_prices(
        self, ctx: AuthContext, property_id: str, rng: DateRange
    ) -> list[dict[str, object]]:
        self._require_own_property(ctx, property_id)
        # Ohne Betrags-Recht leer (§4.2 owner, §4.3 staff/cleaner): Saisonpreise
        # bestehen AUSSCHLIESSLICH aus Preisen — anders als die Tagesreihe bleibt
        # hier nach dem Maskieren nichts übrig, das man zeigen könnte.
        if not self._darf_preise_sehen(ctx):
            return []
        res = (
            self._db()
            .table("price_overrides")
            .select("date, price")
            .eq("property_id", property_id)
            .gte("date", rng.start.isoformat())
            .lt("date", rng.end.isoformat())
            .not_.is_("price", "null")
            .order("date")
            .execute()
        )
        return res.data or []

    def set_season_price(
        self, tenant_id: str, property_id: str, rng: DateRange, price: float,
        *, push_channex: bool = True,
    ) -> int:
        """Tagespreis für jeden Tag im Zeitraum setzen (price_overrides) und an
        Channex pushen (Restrictions/rate). `push_channex=False`, wenn der Preis
        in einer kombinierten Bulk-Aktion bereits mit Min-Stay/CTA/CTD in EINEM
        Call gepusht wird (Test 8). Gibt Anzahl Tage zurück."""
        self._require_tenant_property(tenant_id, property_id)
        payload = [
            {
                "property_id": property_id,
                "date": day.isoformat(),
                "price": price,
            }
            for day in rng.nights()
        ]
        self._db().table("price_overrides").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        # Realtime an Channex: Tagespreis (Cent) für den Zeitraum.
        if push_channex:
            self._push_channex_rate(
                property_id, rng.start, rng.end, round(price * 100)
            )
        log.info(
            "calendar_season_price_set", property_id=property_id, days=len(payload)
        )
        return len(payload)

    def adjust_season_price_pct(
        self, tenant_id: str, property_id: str, rng: DateRange, pct: float
    ) -> int:
        """Effektiven Tagespreis je Tag um `pct` Prozent anpassen (z. B. +10/-15)
        und als Override schreiben — derselbe Pfad wie set_season_price, nur mit
        je Tag individuellem Preis. Tage ohne auflösbaren Preis werden übersprungen
        (kein Crash, kein erfundener Basiswert). Gibt Anzahl geänderter Tage zurück.
        """
        self._require_tenant_property(tenant_id, property_id)
        days = self._resolver().effective_prices(property_id, rng.start, rng.end)
        factor = 1 + pct / 100
        payload = [
            {
                "property_id": property_id,
                "date": d.date.isoformat(),
                "price": round(d.price * factor, 2),
            }
            for d in days
            if d.price is not None
        ]
        if not payload:
            return 0
        self._db().table("price_overrides").upsert(
            payload, on_conflict="property_id,date"
        ).execute()
        # Channex je Tag (unterschiedliche Preise) — Best-Effort, wie sonst auch.
        for row in payload:
            day = date.fromisoformat(row["date"])
            self._push_channex_rate(
                property_id, day, day + timedelta(days=1), round(row["price"] * 100)
            )
        log.info(
            "calendar_season_price_pct",
            property_id=property_id, pct=pct, days=len(payload),
        )
        return len(payload)

    # -- Benannte Saisons (Jahres-Kalender, Drag&Drop) ------------------------
    def list_seasons(self, ctx: AuthContext, property_id: str) -> list[dict]:
        """Alle benannten Saisons eines Objekts inkl. ihrer Zeitraum-Zuweisungen.
        Owner-/Tenant-Scope über _require_own_property (Lesepfad, Wurzel 3)."""
        self._require_own_property(ctx, property_id)
        seasons = (
            self._db()
            .table("property_seasons")
            .select("*")
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        ).data or []
        assigns = (
            self._db()
            .table("property_season_assignments")
            .select("id, season_id, start_date, end_date")
            .eq("property_id", property_id)
            .order("start_date")
            .execute()
        ).data or []
        by_season: dict[str, list[dict]] = {}
        for a in assigns:
            by_season.setdefault(a["season_id"], []).append(a)
        for s in seasons:
            s["assignments"] = by_season.get(s["id"], [])
        return seasons

    def create_season(
        self, tenant_id: str, property_id: str, *,
        name: str, color: str, mode: str, amount: float,
        regeln: dict | None = None,
    ) -> dict:
        """Neuen Regelsatz anlegen (noch ohne Zeitraum).

        `regeln` trägt die Verfügbarkeits-Regeln des Satzes (min_stay,
        max_stay, gesperrte An-/Abreise-Wochentage, 0572; Mindestaufenthalt je
        Anreisetag, 0576). Sie wirken erst, wenn dem Satz ein Zeitraum
        zugewiesen wird — vorher gibt es keine Tage, auf die sie sich beziehen
        könnten.
        """
        self._require_tenant_property(tenant_id, property_id)
        row = (
            self._db()
            .table("property_seasons")
            .insert({
                "property_id": property_id, "name": name,
                "color": color, "mode": mode, "amount": amount,
                **(regeln or {}),
            })
            .execute()
        ).data
        if not row:
            raise CalendarError("Saison konnte nicht angelegt werden.", status_code=500)
        out = row[0]
        out["assignments"] = []
        return out

    def update_season(
        self, tenant_id: str, season_id: str, patch: dict,
    ) -> dict:
        """Saison-Stammdaten ändern (Name/Farbe/Modus/Betrag) und alle ihre
        Zuweisungen neu materialisieren — sonst zeigte der Kalender die neue Farbe,
        aber Channex noch den alten Preis (Gegenzustand, Wurzel 1)."""
        season = self._own_season(tenant_id, season_id)
        # `None` heißt „nicht gesendet"; eine LEERE Liste heißt dagegen „keine
        # Sperre mehr" und muss geschrieben werden — sonst ließe sich eine
        # einmal gesetzte Wochentag-Sperre nie wieder aufheben (Wurzel 1).
        clean = {k: v for k, v in patch.items() if v is not None}
        if clean:
            self._db().table("property_seasons").update(clean).eq(
                "id", season_id
            ).execute()
            season = {**season, **clean}
        self._rematerialize_season(tenant_id, season)
        season["assignments"] = self._season_assignments(season_id)
        return season

    def delete_season(self, tenant_id: str, season_id: str) -> None:
        """Saison löschen. Die zugewiesenen Tage fallen auf den Basispreis zurück —
        die Overrides dieser Tage werden entfernt und der wieder greifende Preis an
        Channex gepusht (Gegenzustand, Wurzel 1)."""
        season = self._own_season(tenant_id, season_id)
        spans = self._season_spans(season_id)
        # FK cascade räumt die assignments; erst die Overrides der Tage zurücknehmen.
        self._db().table("property_seasons").delete().eq("id", season_id).execute()
        for start, end_excl in spans:
            self._clear_overrides_to_base(
                season["property_id"], start, end_excl
            )

    def apply_season_to_properties(
        self, tenant_id: str, season_id: str, targets: list[str],
        *, mit_zeitraeumen: bool = True,
    ) -> dict[str, object]:
        """Eine Prozent-Saison auf weitere eigene Objekte übertragen (KOPIE).

        Wer 18 Häuser in derselben Region führt, hat dieselbe Hochsaison für alle
        und malte sie bisher 18-mal von Hand. Nach dem Übertragen ist jede Saison
        eigenständig: eine spätere Änderung an der Quelle zieht NICHT nach — das
        ist das Hausmuster (Gebühren, Steuern, Aktionen).

        NUR `percent`: ein Fixbetrag ist objektspezifisch (140 DKK für ein Studio
        sind für ein 8-Personen-Haus falsch). Ein Prozentsatz rechnet am Ziel
        gegen dessen EIGENEN Rate-Plan-Basispreis und ergibt dort automatisch den
        passenden Betrag — der einzige Modus, der objektübergreifend stimmt.
        """
        quelle = self._own_season(tenant_id, season_id)
        if quelle["mode"] != SeasonMode.percent.value:
            raise CalendarError(
                "Nur prozentuale Saisons lassen sich übertragen: ein fester "
                "Nachtpreis gilt nur für dieses Objekt.",
                status_code=422,
            )
        spans = self._season_spans(season_id) if mit_zeitraeumen else []
        if mit_zeitraeumen and not spans:
            # Eine UNBEMALTE Quelle „mit Zeiträumen" zu übertragen hieß faktisch
            # „Zeiträume am Ziel löschen": `_replace_season_spans` gab die alten
            # Tage der gleichnamigen Ziel-Saison frei und setzte nichts an ihre
            # Stelle — mit grünem Erfolgs-Toast, während am Ziel Tage gelöscht
            # und Basispreise an die Portale rausgingen. Das ist nie das, was der
            # Knopf verspricht: „übertragen" überträgt, es löscht nicht.
            # Deshalb fail-closed (Wurzel 5) statt stiller Datenverlust — wer am
            # Ziel wirklich aufräumen will, tut das dort bewusst.
            raise CalendarError(
                "Diese Saison hat keine bemalten Zeiträume. Ohne Zeiträume "
                "gäbe es am Zielobjekt nichts zu setzen — bemale sie zuerst "
                "oder übertrage nur die Definition ohne Zeiträume.",
                status_code=422,
            )
        uebertragen = 0
        uebersprungen: list[dict[str, str]] = []
        for ziel_id in dict.fromkeys(targets):
            if ziel_id == quelle["property_id"]:
                continue  # die Quelle selbst ist kein Ziel
            # Jede Ziel-ID EINZELN scopen: der Service-Role-Key umgeht RLS, eine
            # fremde ID ist ein Fehler, kein stilles Überspringen (Wurzel 3).
            # Das steht bewusst VOR der Klammer unten: eine fremde ID ist kein
            # „Ziel hat Pech gehabt", sondern ein 404 für den ganzen Aufruf.
            self._require_tenant_property(tenant_id, ziel_id)
            grund = self._apply_season_to_one(
                tenant_id, quelle, ziel_id, spans, mit_zeitraeumen=mit_zeitraeumen
            )
            if grund is None:
                uebertragen += 1
            else:
                uebersprungen.append({"property_id": ziel_id, "grund": grund})
        log.info(
            "calendar_season_applied", season_id=season_id,
            uebertragen=uebertragen, uebersprungen=len(uebersprungen),
        )
        return {"uebertragen": uebertragen, "uebersprungen": uebersprungen}

    def _apply_season_to_one(
        self, tenant_id: str, quelle: dict, ziel_id: str,
        spans: list[tuple[date, date]], *, mit_zeitraeumen: bool,
    ) -> str | None:
        """Ein einzelnes Ziel bedienen. `None` = übertragen, sonst der Grund-Slug.

        Die Klammer um EIN Ziel ist der eigentliche Punkt: ohne sie riss ein
        Fehler am 5. von 18 Objekten den ganzen Aufruf als 500 mit — Ziele 1-4
        waren geschrieben, Ziel 5 halb (Saison und Zuweisungen da, price_overrides
        leer), und der Betrieb sah nur „fehlgeschlagen" ohne zu wissen, welche
        Objekte betroffen sind. Ein Ziel scheitert ab jetzt für sich und kommt
        benannt als `uebersprungen` zurück.

        Bei einem Fehler wird NICHT zurückgerollt — der Teilzustand bleibt stehen
        und wird als solcher gemeldet. Das ist eine bewusste Entscheidung gegen
        den vorherigen „Rollback", der selbst der schlimmere Datenverlust war:
        er rief `_replace_season_spans` mit leerer Liste auf und löschte damit
        ALLES, was unter dem Namen der Saison am Ziel stand — auch den seit
        Monaten von Hand bemalten Kalender einer gleichnamigen ALTEN Saison des
        Ziels, die mit diesem Aufruf nie etwas zu tun hatte. Der Betrieb las
        „übersprungen — erneut versuchen" und hatte real einen Monat Hochsaison
        verloren, während die Portale den Basispreis bekamen.

        Ein ECHTER Rollback (Alt-Zustand vorher sichern, im Fehlerfall
        zurückschreiben) wäre hier kein Gewinn: PostgREST gibt uns keine
        Transaktion, das Zurückschreiben wäre selbst eine mehrschrittige
        Schreibfolge, die auf halber Strecke scheitern kann — ein zweiter
        Datenverlust-Pfad für denselben Fehlerfall.

        Dass der Teilzustand ungefährlich ist, ist allerdings KEINE Eigenschaft
        des Fehlerpfads, sondern eine, die sich der Normalpfad verdienen muss:
        Solange `_replace_season_spans` erst löschte und dann einfügte, war ein
        Abbruch dazwischen der schlimmste denkbare Ausgang — der vorbestehende
        Kalender des Ziels weg, die neuen Zeiträume nie geschrieben, und ein
        erneuter Versuch heilte nichts, weil er die Zeiträume der QUELLE schreibt.
        Deshalb ist die Schreibfolge dort so geordnet, dass jeder Abbruch einen
        Überschuss hinterlässt statt einer Lücke (siehe dort). Zu viel ist
        reparabel, zu wenig nicht.

        Was nach einem Abbruch stehen bleiben kann, ist damit genau zweierlei:
        die Saison mit ihren Zeiträumen, deren Tage noch auf dem Basispreis
        liegen (gescheitert ist `_rematerialize_season`, also der idempotente
        Schritt), und/oder ein alter Zeitraum des Ziels, der noch nicht abgeräumt
        wurde. Beides ist zu viel oder zu wenig Aufschlag, nie ein erfundener
        Preis (Wurzel 4), und beides räumt derselbe Aufruf beim nächsten Mal auf.

        Damit das keine stille Falschaussage wird (Wurzel 5), sagt der
        Grund-Slug `teilweise_uebertragen` genau das: die Saison steht am Ziel,
        die Tagespreise sind noch unvollständig, ein erneuter Versuch
        vervollständigt sie.

        Wurzel 5: KEIN breites `except Exception` über alles. Kontroll-Signale
        (ChannexBudgetExhausted → der Worker muss den Job verzögern statt ihn
        still als „done" zu markieren) und die Scope-/Fach-Fehler CalendarError
        schlagen unverändert nach oben durch.
        """
        # Lokaler Import wie an den übrigen Channex-Berührungspunkten des
        # Repos (recompute.py:725, worker.py:796) — der Kalender-Slice hängt
        # sonst am Start am Channel-Manager.
        from src.features.channel_manager.channex_client import (  # noqa: PLC0415
            ChannexBudgetExhausted,
        )

        base, _min = self._fetch_rate_plan(ziel_id)
        if base is None:
            # percent ohne Basispreis kann nicht materialisieren
            # (_season_price_for_day gibt None). Kein Serverfehler, aber es
            # muss sichtbar sein statt still zu verschwinden (Wurzel 5).
            return "kein_basispreis"
        if not base:
            # base_price = 0 ist ein DATENFEHLER (Objekt in Vorbereitung), kein
            # Preis: `0 * 1,30` ergibt 0,00 und würde als Nachtpreis in
            # price_overrides landen UND an die Portale gepusht — ein Objekt für
            # 0,00 bei Booking.com ist der teuerste denkbare Ausgang. Deshalb
            # fail-closed mit eigenem Grund statt eines plausiblen Werts
            # (Wurzel 4). Der Vergleich ist bewusst `not base` und nicht
            # `base is None`: 0.0 besteht jede None-Prüfung.
            return "basispreis_null"
        ziel_saison = self._upsert_season_copy(ziel_id, quelle)
        try:
            if mit_zeitraeumen:
                self._replace_season_spans(tenant_id, ziel_saison, spans)
            # Ohne Rematerialisierung stünden Saison und price_overrides
            # auseinander: die UI zeigte die Saison, Kalender und Portale hätten
            # weiter den Basispreis (der Prozentsatz wird materialisiert, 0138).
            self._rematerialize_season(tenant_id, ziel_saison)
        except (ChannexBudgetExhausted, CalendarError):
            # Kontroll-Signal bzw. fachlicher Fehler: MUSS durchschlagen, sonst
            # meldeten wir „übertragen", während der Push nie passiert ist.
            raise
        except Exception as exc:  # noqa: BLE001 — je Ziel klammern, siehe Docstring
            # KEIN Rollback (siehe Docstring): der Teilzustand bleibt stehen und
            # wird benannt. Ein „Aufräumen" hätte hier den vorbestehenden
            # Kalender des Ziels gelöscht, nicht den halben Zustand DIESES
            # Aufrufs.
            log.warning(
                "calendar_season_apply_target_partial",
                season_id=quelle["id"], property_id=ziel_id, error=str(exc),
            )
            return "teilweise_uebertragen"
        return None

    def _upsert_season_copy(self, ziel_id: str, quelle: dict) -> dict:
        """Die Saison am Ziel anlegen ODER die gleichnamige aktualisieren.

        `property_seasons` trägt UNIQUE (property_id, name) (0138). Select-dann-
        Insert wäre hier eine Race: zwei gleichzeitige Klicks lesen beide „nicht
        vorhanden" und laufen beide in den Insert — der zweite bekäme 23505 als
        500. Deshalb der UNIQUE als Backstop im SELBEN Statement (Wurzel 2): der
        Konflikt wird von der DB entschieden, nicht von unserem Lesestand.
        """
        # Ein Regelsatz ist EIN Ding: Farbe, Preisänderung UND Aufenthaltsregeln
        # (0572/0576). Wurden hier nur die drei Preisfelder kopiert, hieß
        # „übertragen" am Ziel etwas anderes als an der Quelle — der
        # Mindestaufenthalt der Hochsaison fiel still weg, und die Portale
        # bekamen für das Zielobjekt keine Restriktion.
        werte = {
            "color": quelle["color"], "mode": quelle["mode"],
            "amount": quelle["amount"],
            "min_stay": quelle.get("min_stay"),
            "max_stay": quelle.get("max_stay"),
            "closed_arrival_weekdays": quelle.get("closed_arrival_weekdays") or [],
            "closed_departure_weekdays": (
                quelle.get("closed_departure_weekdays") or []
            ),
            "min_stay_by_weekday": quelle.get("min_stay_by_weekday") or {},
        }
        row = (
            self._db()
            .table("property_seasons")
            .upsert(
                {"property_id": ziel_id, "name": quelle["name"], **werte},
                on_conflict="property_id,name",
            )
            .execute()
        ).data
        if not row:
            raise CalendarError(
                "Saison konnte am Zielobjekt nicht angelegt werden.",
                status_code=500,
            )
        # Der Upsert liefert die Zeile MIT ihrer id zurück — auch im Konfliktfall
        # die der bestehenden. Genau die brauchen die Zeiträume unten.
        return row[0]

    def _replace_season_spans(
        self, tenant_id: str, ziel_saison: dict, spans: list[tuple[date, date]],
    ) -> None:
        """Die Zeiträume der Ziel-Saison durch die der Quelle ersetzen.

        Gegenzustand (Wurzel 1): die ALTEN Zeiträume dieser Saison müssen VOR dem
        Setzen der neuen freigegeben werden — sonst blieben Tage einer früheren
        Übertragung stehen und überlagerten sich mit den neuen. Nach dem groben
        Basispreis-Reset werden überlappende ANDERE Saisons des Ziels wieder
        materialisiert, damit deren Tage die Übertragung überleben.

        ERSETZEN heißt: es muss etwas zum Setzen geben. Die leere Liste steigt
        deshalb GANZ OBEN aus, VOR dem Löschen — sonst ist diese Methode ein
        „Kalender des Ziels leeren" mit ersetzendem Namen. Genau daran hingen
        drei Befunde derselben Wurzel: der Prüfpunkt stand früher NACH dem
        Delete, also löschte jeder Aufruf mit leerer Liste erst alles und stellte
        dann fest, dass er nichts zu setzen hat. Wer Tage bewusst freigeben will,
        nimmt `clear_season_range`/`unassign_season` — die heißen so und melden
        es auch so.

        REIHENFOLGE: erst INSERT, dann DELETE — und zwar gezielt nur die vorher
        gelesenen ALTEN Zeilen (per id), nie pauschal über `season_id`.

        Der Grund ist der Abbruch auf halber Strecke. PostgREST gibt uns keine
        Transaktion über mehrere Requests: bricht diese Folge irgendwo ab
        (Timeout/504 — genau der Fall, für den die Fehlerklammer in
        `_apply_season_to_one` existiert), entscheidet allein die Reihenfolge,
        was der Betrieb danach vorfindet. Mit Delete zuerst war das Ergebnis
        TOTALVERLUST: die eigene, gleichnamige Saison des Ziels (seit Monaten von
        Hand bemalt) war weg, die neuen Zeiträume nie geschrieben, und der
        Kalender ging als nackter Basispreis an die Portale. Ein erneuter Versuch
        heilte das NICHT — er schrieb die Zeiträume der Quelle, der alte Zeitraum
        des Ziels war unwiederbringlich.

        Mit Insert zuerst ist der Zwischenzustand ein ÜBERSCHUSS statt einer
        Lücke: kurzzeitig stehen alte und neue Zuweisungen nebeneinander. Das ist
        ausdrücklich erlaubter Normalzustand — 0138 lässt Overlaps zu und löst
        sie beim Materialisieren als „last win" auf, genau wie das Übermalen im
        Kalender. Ein Abbruch kostet damit höchstens einen zu viel gefärbten
        Zeitraum, den der nächste Versuch (oder das Aufräumen von Hand) korrigiert
        — nie einen verlorenen. Zu viel ist reparabel, zu wenig nicht.

        Das gezielte Löschen per id ist dabei der tragende Teil: ein
        `delete().eq("season_id", …)` nach dem Insert würde die gerade
        geschriebenen neuen Zeilen gleich mit entfernen.

        Das Löschen der alten Zeilen steht VOR dem Zurücksetzen ihrer
        Tagespreise, und diese Reihenfolge ist erzwungen, nicht beliebig:
        `_rematerialize_overlaps` fragt die Zuweisungen, wem ein Tag noch gehört.
        Stünden die alten Zeilen dabei noch, malte es genau die Tage sofort
        wieder mit dem alten Saisonpreis, die es gerade freigeben soll — der
        Gegenzustand (Wurzel 1) fiele still aus.

        Der Preis dafür: bricht das Zurücksetzen danach ab, bleiben für diesen
        Zeitraum Overrides ohne Zuweisung stehen (zu VIEL Aufschlag an den
        Portalen, siehe `_apply_season_to_one`). Das ist der bewusst gewählte
        Rest — sichtbar im Kalender, jederzeit über `clear_season_range`
        korrigierbar und beim erneuten Übertragen desselben Zeitraums ohnehin
        überschrieben. Ein verlorener Kalender wäre es nicht.
        """
        if not spans:
            return
        property_id = ziel_saison["property_id"]
        alt = self._season_assignments(ziel_saison["id"])
        self._db().table("property_season_assignments").insert([
            {
                "property_id": property_id, "season_id": ziel_saison["id"],
                "start_date": start.isoformat(),
                "end_date": (end_excl - timedelta(days=1)).isoformat(),  # inklusiv
            }
            for start, end_excl in spans
        ]).execute()
        if alt:
            self._db().table("property_season_assignments").delete().in_(
                "id", [a["id"] for a in alt]
            ).execute()
        for a in alt:
            start = date.fromisoformat(a["start_date"])
            end_excl = date.fromisoformat(a["end_date"]) + timedelta(days=1)
            self._clear_overrides_to_base(property_id, start, end_excl)
            # Nach dem groben Basispreis-Reset die Tage zurückholen, die noch
            # einer Saison gehören — seit dem Insert oben zählen die NEUEN
            # Zeiträume dieser Saison dazu, überlappende Tage behalten also
            # direkt ihren Saisonpreis statt kurz auf den Basispreis zu fallen.
            self._rematerialize_overlaps(tenant_id, property_id, start, end_excl)

    def assign_season(
        self, tenant_id: str, property_id: str, season_id: str, rng: DateRange,
    ) -> int:
        """Einen Datumsbereich einer Saison zuweisen und die effektiven Tagespreise
        materialisieren (price_overrides + Channex-Push). end exklusiv. Gibt die
        Anzahl betroffener Tage zurück. Spätere Zuweisung auf denselben Tag
        gewinnt (last win, wie Kalender-Übermalen)."""
        season = self._own_season(tenant_id, season_id)
        if season["property_id"] != property_id:
            raise CalendarError("Saison gehört nicht zum Objekt.", status_code=400)
        self._db().table("property_season_assignments").insert({
            "property_id": property_id, "season_id": season_id,
            "start_date": rng.start.isoformat(),
            "end_date": (rng.end - timedelta(days=1)).isoformat(),  # inklusiv
        }).execute()
        return self._materialize(tenant_id, season, rng.start, rng.end)

    def unassign_season(self, tenant_id: str, assignment_id: str) -> None:
        """Eine Zeitraum-Zuweisung entfernen; die Tage fallen auf den Basispreis
        zurück (Overrides zurücknehmen + Channex-Push; Wurzel 1)."""
        row = (
            self._db()
            .table("property_season_assignments")
            .select("id, property_id, start_date, end_date, "
                    "properties!inner(tenant_id)")
            .eq("id", assignment_id)
            .limit(1)
            .execute()
        ).data
        if not row or row[0]["properties"]["tenant_id"] != tenant_id:
            raise CalendarError("Zuweisung nicht gefunden.", status_code=404)
        a = row[0]
        self._db().table("property_season_assignments").delete().eq(
            "id", assignment_id
        ).execute()
        end_excl = date.fromisoformat(a["end_date"]) + timedelta(days=1)
        self._clear_overrides_to_base(
            a["property_id"], date.fromisoformat(a["start_date"]), end_excl
        )

    def clear_season_range(
        self, tenant_id: str, property_id: str, rng: DateRange,
    ) -> int:
        """Einen Datumsbereich aus ALLEN Saisons lösen (Rechtsklick im Kalender).

        Anders als `unassign_season` (kippt die ganze Zuweisung) wird hier nur der
        gewählte Ausschnitt entfernt: überlappende Zuweisungen werden gekürzt, bei
        einem Schnitt in der Mitte gesplittet. Die freigewordenen Tage fallen auf
        den Basispreis zurück (Overrides zurücknehmen + Channex-Push, Wurzel 1).
        Gibt die Anzahl gelöster Tage zurück. end exklusiv."""
        self._require_tenant_property(tenant_id, property_id)
        last_day = rng.end - timedelta(days=1)
        rows = (
            self._db()
            .table("property_season_assignments")
            .select("id, season_id, start_date, end_date")
            .eq("property_id", property_id)
            .lte("start_date", last_day.isoformat())
            .gte("end_date", rng.start.isoformat())
            .execute()
        ).data or []
        cleared: set[date] = set()
        rest_rows: list[dict] = []
        for a in rows:
            a_start = date.fromisoformat(a["start_date"])
            a_end = date.fromisoformat(a["end_date"])  # inklusiv
            cut_lo = max(a_start, rng.start)
            cut_hi = min(a_end, last_day)
            cur = cut_lo
            while cur <= cut_hi:
                cleared.add(cur)
                cur += timedelta(days=1)
            # Rest-Stücke links/rechts des Schnitts sammeln (alte Zeile fällt weg).
            rest_rows.extend(
                {
                    "property_id": property_id, "season_id": a["season_id"],
                    "start_date": s.isoformat(), "end_date": e.isoformat(),
                }
                for s, e in (
                    (a_start, cut_lo - timedelta(days=1)),
                    (cut_hi + timedelta(days=1), a_end),
                ) if s <= e
            )
        if not cleared:
            return 0
        # Alle getroffenen Zuweisungen in EINEM Call weg, Reste in EINEM zurück —
        # nicht je Zuweisung ein eigener Round-Trip.
        self._db().table("property_season_assignments").delete().in_(
            "id", [a["id"] for a in rows]
        ).execute()
        if rest_rows:
            self._db().table("property_season_assignments").insert(
                rest_rows
            ).execute()
        span_start = min(cleared)
        span_end = max(cleared) + timedelta(days=1)
        self._clear_overrides_to_base(property_id, span_start, span_end)
        # Tage, die durch andere (überlappende) Saisons weiterhin belegt sind,
        # wieder materialisieren — der Basispreis-Reset oben war zeitraumweit.
        self._rematerialize_overlaps(tenant_id, property_id, span_start, span_end)
        return len(cleared)

    def _rematerialize_overlaps(
        self, tenant_id: str, property_id: str, start: date, end: date,
    ) -> None:
        """Nach einem Basispreis-Reset über [start, end) die Tage, die noch einer
        Saison gehören, erneut materialisieren (Gegenzustand zum groben Reset)."""
        rows = (
            self._db()
            .table("property_season_assignments")
            .select("season_id, start_date, end_date")
            .eq("property_id", property_id)
            .lte("start_date", (end - timedelta(days=1)).isoformat())
            .gte("end_date", start.isoformat())
            .order("start_date")
            .execute()
        ).data or []
        if not rows:
            return
        # Alle beteiligten Saisons in EINEM tenant-gescopten Query (statt je
        # Zuweisung ein _own_season) — Load und Scope bleiben zusammen (Wurzel 3).
        seasons = {
            s["id"]: s
            for s in (
                self._db()
                .table("property_seasons")
                .select("*, properties!inner(tenant_id)")
                .in_("id", sorted({a["season_id"] for a in rows}))
                .eq("properties.tenant_id", tenant_id)
                .execute()
            ).data or []
        }
        for a in rows:
            season = seasons.get(a["season_id"])
            if season is None:
                continue  # gehört nicht zum Tenant → nichts materialisieren
            lo = max(date.fromisoformat(a["start_date"]), start)
            hi = min(date.fromisoformat(a["end_date"]) + timedelta(days=1), end)
            if lo < hi:
                self._materialize(tenant_id, season, lo, hi)

    # -- Saison-Helfer --------------------------------------------------------
    def _own_season(self, tenant_id: str, season_id: str) -> dict:
        """Saison per ID laden UND auf den Tenant scopen (Load+Scope zusammen,
        Wurzel 3 — kein ungescopter Load)."""
        row = (
            self._db()
            .table("property_seasons")
            .select("*, properties!inner(tenant_id)")
            .eq("id", season_id)
            .limit(1)
            .execute()
        ).data
        if not row or row[0]["properties"]["tenant_id"] != tenant_id:
            raise CalendarError("Saison nicht gefunden.", status_code=404)
        row[0].pop("properties", None)
        return row[0]

    def _season_assignments(self, season_id: str) -> list[dict]:
        return (
            self._db()
            .table("property_season_assignments")
            .select("id, season_id, start_date, end_date")
            .eq("season_id", season_id)
            .order("start_date")
            .execute()
        ).data or []

    def _season_spans(self, season_id: str) -> list[tuple[date, date]]:
        """(start, end_exklusiv) je Zuweisung der Saison."""
        return [
            (date.fromisoformat(a["start_date"]),
             date.fromisoformat(a["end_date"]) + timedelta(days=1))
            for a in self._season_assignments(season_id)
        ]

    def _season_price_for_day(
        self, season: dict, base: float | None
    ) -> float | None:
        """Effektiver Nachtpreis eines Saison-Tags. fixed → Festpreis; percent →
        Basispreis ± %. Ohne Basispreis bei percent: kein Preis (nichts erfinden)."""
        mode, amount = season["mode"], float(season["amount"])
        if mode == "fixed":
            return round(amount, 2)
        if base is None:
            return None
        return round(base * (1 + amount / 100), 2)

    def _materialize(
        self, tenant_id: str, season: dict, start: date, end: date,
    ) -> int:
        """Tagespreise einer Saison für [start, end) nach price_overrides schreiben
        und an Channex pushen. Bei percent bezieht sich der Aufschlag auf den
        Rate-Plan-Basispreis (vorhersehbar, kein Stapeln auf schon-Overrides)."""
        property_id = season["property_id"]
        # Die Aufenthaltsregeln hängen NICHT am Preis: ein Regelsatz ohne
        # Basispreis (percent ohne Rate-Plan) hat trotzdem einen
        # Mindestaufenthalt zu setzen. Deshalb zuerst und unabhängig.
        self._materialize_regeln(season, start, end)
        base, _min = self._fetch_rate_plan(property_id)
        price = self._season_price_for_day(season, base)
        if price is None:
            return 0  # percent ohne Basispreis → kein Preis zu materialisieren
        rng = DateRange(start=start, end=end)
        return self.set_season_price(tenant_id, property_id, rng, price)

    def _materialize_regeln(self, season: dict, start: date, end: date) -> None:
        """Aufenthaltsregeln des Regelsatzes je Tag nach `availability` schreiben.

        Der Preis einer Saison landet in `price_overrides`, ihre Regeln hier —
        beides materialisierte Ergebnisse derselben bearbeitbaren Quelle. Die
        Wochentags-Sperren werden dabei je Tag AUSGERECHNET: `closed_to_arrival`
        ist eine Tages-Eigenschaft, kein Wochentag.

        Tage OHNE Regel bekommen ausdrücklich `None`/`False` — sonst bliebe die
        Regel eines früheren Satzes stehen, obwohl der neue keine hat
        (Gegenzustand, Wurzel 1).
        """
        property_id = season["property_id"]
        min_stay = season.get("min_stay")
        max_stay = season.get("max_stay")
        an = set(season.get("closed_arrival_weekdays") or [])
        ab = set(season.get("closed_departure_weekdays") or [])
        # Mindestaufenthalt je ANREISETAG (0576). Der Wert des Wochentags
        # schlägt den allgemeinen `min_stay`; fehlt er, gilt dieser weiter —
        # ein fehlender Schlüssel ist keine 0 (Wurzel 4). Die Schlüssel kommen
        # als JSON-Objekt aus der DB und sind dort Zeichenketten.
        je_wochentag = {
            int(k): int(v)
            for k, v in (season.get("min_stay_by_weekday") or {}).items()
        }
        zeilen = []
        tag = start
        while tag < end:
            zeilen.append({
                "property_id": property_id,
                "date": tag.isoformat(),
                "min_stay": je_wochentag.get(tag.weekday(), min_stay),
                "max_stay": max_stay,
                "closed_to_arrival": tag.weekday() in an,
                "closed_to_departure": tag.weekday() in ab,
            })
            tag += timedelta(days=1)
        if not zeilen:
            return
        self._db().table("availability").upsert(
            je_einheit(self._db(), property_id, zeilen),
            on_conflict=AVAILABILITY_CONFLICT,
        ).execute()
        # Lokal geschrieben ist nicht bei den Portalen angekommen. Ohne diesen
        # Push kennte Channex den Mindestaufenthalt der Saison nicht, und ein
        # Gast könnte über ein Portal drei Nächte buchen, wo sieben gefordert
        # sind — die stille Divergenz, gegen die Wurzel 1 steht.
        self._push_regeln(property_id, zeilen)
        log.info(
            "saison_regeln_materialisiert",
            property_id=property_id, season_id=season.get("id"), tage=len(zeilen),
        )

    def _push_regeln(self, property_id: str, zeilen: list[dict]) -> None:
        """Aufenthaltsregeln als GEBÜNDELTE Restriktions-Zeilen an Channex.

        Aufeinanderfolgende Tage mit identischer Regel werden zu einer Zeile
        zusammengefasst — eine Woche mit gleichem Mindestaufenthalt ist EIN
        Eintrag, nicht sieben (dieselbe Verdichtung wie bei den Preisen).
        """
        if not zeilen:
            return
        bloecke: list[tuple[tuple, str, str]] = []
        for z in zeilen:
            regel = (
                z["min_stay"], z["max_stay"],
                z["closed_to_arrival"], z["closed_to_departure"],
            )
            if bloecke and bloecke[-1][0] == regel:
                bloecke[-1] = (regel, bloecke[-1][1], z["date"])
            else:
                bloecke.append((regel, z["date"], z["date"]))
        nutzlast = [
            {
                "date_from": von,
                "date_to": bis,  # inklusiv, wie der Channex-Payload
                "rate_plan_id": None,
                "min_stay": regel[0],
                "max_stay": regel[1],
                "closed_to_arrival": regel[2],
                "closed_to_departure": regel[3],
            }
            for regel, von, bis in bloecke
        ]
        tenant_id = self._tenant_of_property(property_id)
        if tenant_id:
            try_enqueue_ari(
                self._db(), tenant_id, property_id,
                "restriction_rows", {"rows": nutzlast},
            )

    def _tenant_of_property(self, property_id: str) -> str | None:
        """Mandant eines Objekts — für Jobs, die ihn brauchen, der Aufrufer ihn
        aber nicht zur Hand hat. `None`, wenn es das Objekt nicht (mehr) gibt;
        dann wird kein Job eingereiht statt einer mit geratenem Mandanten."""
        rows = (
            self._db().table("properties").select("tenant_id")
            .eq("id", property_id).limit(1).execute()
        ).data
        return str(rows[0]["tenant_id"]) if rows else None

    def _clear_regeln(self, property_id: str, start: date, end: date) -> None:
        """Aufenthaltsregeln in [start, end) zurücknehmen (Gegenzustand zu
        `_materialize_regeln`). Der Status der Nacht bleibt unberührt — gelöst
        wird die REGEL, nicht die Buchung oder Sperre."""
        self._db().table("availability").update({
            "min_stay": None, "max_stay": None,
            "closed_to_arrival": False, "closed_to_departure": False,
        }).eq("property_id", property_id).gte(
            "date", start.isoformat()
        ).lt("date", end.isoformat()).execute()

    def _rematerialize_season(self, tenant_id: str, season: dict) -> None:
        """Alle Zeiträume einer Saison neu berechnen (nach Stammdaten-Änderung)."""
        for start, end_excl in self._season_spans(season["id"]):
            self._materialize(tenant_id, season, start, end_excl)

    def _clear_overrides_to_base(
        self, property_id: str, start: date, end: date,
    ) -> None:
        """Overrides in [start, end) löschen und den je Tag wieder greifenden Preis
        (dynamic/weekday/base) an Channex pushen (Gegenzustand, Wurzel 1)."""
        self._db().table("price_overrides").delete().eq(
            "property_id", property_id
        ).gte("date", start.isoformat()).lt("date", end.isoformat()).execute()
        # Mit dem Preis fällt auch die Aufenthaltsregel des Satzes weg — sonst
        # bliebe ein Mindestaufenthalt stehen, dessen Saison es nicht mehr gibt.
        self._clear_regeln(property_id, start, end)
        days = self._resolver().effective_prices(property_id, start, end)
        # Zusammenhängende Tage MIT GLEICHEM Preis in EINEN Job bündeln: der
        # Basispreis ist über den Zeitraum meist konstant, ein Job je Tag hätte
        # den Request auf so viele Round-Trips gestreckt wie der Zeitraum Tage hat.
        for block_start, block_end, cents in self._preisbloecke(days):
            self._push_channex_rate(property_id, block_start, block_end, cents)

    def preisbloecke(
        self, days: "list[EffectivePriceDay]"
    ) -> list[tuple[date, date, int]]:
        """Öffentliche Fassade für `_preisbloecke` (Pricing-Slice nutzt sie beim
        Umlegen des Dynamic-Pricing-Schalters, damit die Verdichtungsregel nicht
        ein zweites Mal entsteht)."""
        return self._preisbloecke(days)

    def push_channex_rate(
        self, property_id: str, start: date, end: date, rate_cents: int | None
    ) -> None:
        """Öffentliche Fassade für `_push_channex_rate` (end EXKLUSIV), damit der
        Pricing-Slice denselben Push-Weg nutzt statt eines zweiten."""
        self._push_channex_rate(property_id, start, end, rate_cents)

    def saison_uebernehmen(
        self, tenant_id: str, quelle: dict, ziel_id: str,
        spans: list[tuple[date, date]], *, mit_zeitraeumen: bool,
    ) -> str | None:
        """Öffentliche Fassade für `_apply_season_to_one` — die Saison-Vorlagen
        (saison_vorlagen.py, ADR-0024) materialisieren jede Kategorie über
        GENAU diesen Pfad (Upsert auf (property_id, name), Zeiträume ersetzen,
        Tagespreise + Portal-Push), statt eine zweite Übertragung zu bauen.
        `quelle` braucht id, name, color, mode, amount und optional die
        Regelsatz-Felder; `spans` ist (start, end_exklusiv). Der Aufrufer hat
        `ziel_id` bereits auf den Mandanten gescopt (Wurzel 3)."""
        return self._apply_season_to_one(
            tenant_id, quelle, ziel_id, spans, mit_zeitraeumen=mit_zeitraeumen
        )

    @staticmethod
    def _preisbloecke(
        days: "list[EffectivePriceDay]",
    ) -> list[tuple[date, date, int]]:
        """Tage mit Preis zu (start, end_exklusiv, cents)-Blöcken verdichten.
        Ein Block bricht bei Preiswechsel ODER einer Lücke (Tag ohne Preis)."""
        blocks: list[tuple[date, date, int]] = []
        cur_start: date | None = None
        cur_end: date | None = None
        cur_cents = 0
        for d in days:
            if d.price is None:
                if cur_start is not None and cur_end is not None:
                    blocks.append((cur_start, cur_end, cur_cents))
                cur_start, cur_end = None, None
                continue
            cents = round(d.price * 100)
            if cur_start is not None and cents == cur_cents and d.date == cur_end:
                cur_end = d.date + timedelta(days=1)
                continue
            if cur_start is not None and cur_end is not None:
                blocks.append((cur_start, cur_end, cur_cents))
            cur_start, cur_end, cur_cents = d.date, d.date + timedelta(days=1), cents
        if cur_start is not None and cur_end is not None:
            blocks.append((cur_start, cur_end, cur_cents))
        return blocks

    def set_restrictions(
        self,
        tenant_id: str,
        property_id: str,
        rng: DateRange,
        *,
        cta: bool | None = None,
        ctd: bool | None = None,
        min_stay: int | None = None,
        max_stay: int | None = None,
        rate_cents: int | None = None,
    ) -> int:
        """CTA/CTD-Restriktionen je Tag setzen (availability-Upsert pro Tag) und
        an Channex pushen. Nur gesetzte Felder ändern sich (None = unverändert).
        `min_stay`/`max_stay`/`rate_cents` werden — falls gesetzt — im SELBEN
        Channex-Call mitgepusht (kombinierte Bulk-Aktion, Zertifizierung Test 7/8);
        die lokale Persistenz von Min-Stay/Preis macht der Aufrufer (_set_min_stay /
        set_season_price). Max-Stay ist rein Channex-seitig (kein lokaler
        availability-Zustand). availability-Zeilen werden wie bei Preis/Block auch
        für offene Tage angelegt. Gibt Anzahl Tage zurück."""
        self._require_tenant_property(tenant_id, property_id)
        # Nichts zu pushen, wenn KEINE der kombinierbaren Restriktionen gesetzt ist.
        if cta is None and ctd is None and max_stay is None and min_stay is None \
                and rate_cents is None:
            return 0
        flags: dict[str, bool] = {}
        if cta is not None:
            flags["closed_to_arrival"] = cta
        if ctd is not None:
            flags["closed_to_departure"] = ctd
        # availability-Zeilen nur bei CTA/CTD anlegen (das ist der lokale Zustand);
        # max/min_stay/Preis sind reine Channex-Restriktionen ohne availability-Flag.
        if flags:
            payload = [
                {"property_id": property_id, "date": day.isoformat(), **flags}
                for day in rng.nights()
            ]
            self._db().table("availability").upsert(
                je_einheit(self._db(), property_id, payload),
                on_conflict=AVAILABILITY_CONFLICT,
            ).execute()
        self._push_channex_restrictions(
            property_id, rng.start, rng.end, cta, ctd,
            min_stay=min_stay, max_stay=max_stay, rate_cents=rate_cents,
        )
        log.info(
            "calendar_set_restrictions",
            property_id=property_id, cta=cta, ctd=ctd, max_stay=max_stay,
            days=len(list(rng.nights())),
        )
        return len(list(rng.nights()))

    def _push_channex_restrictions(
        self,
        property_id: str,
        start: date,
        end: date,
        cta: bool | None,
        ctd: bool | None,
        *,
        min_stay: int | None = None,
        max_stay: int | None = None,
        rate_cents: int | None = None,
    ) -> None:
        """CTA/CTD (+ optional Min-Stay/Max-Stay/Preis, kombinierte Bulk-Aktion) als
        EINEN ARI-Push-Job einreihen (Phase 2). KEIN coalesce (zeitraum-spezifisch).
        Max-Stay wandert in denselben restrictions-Call — so gehen CTA/CTD/min/max/
        Preis gemeinsam an Channex (Zertifizierung Test 7: 1 API-Call)."""
        tenant_id = self._tenant_of(property_id)
        if tenant_id is None:
            return
        fields: dict[str, object] = {
            "date_from": start.isoformat(),
            "date_to": (end - timedelta(days=1)).isoformat(),  # end exklusiv→inkl.
            "closed_to_arrival": cta, "closed_to_departure": ctd,
        }
        if min_stay is not None:
            fields["min_stay"] = min_stay
        if max_stay is not None:
            fields["max_stay"] = max_stay
        if rate_cents is not None:
            fields["rate_cents"] = rate_cents
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "restrictions", fields,
        )

    # -- Bulk-Edit (mehrere Objekte × ein Zeitraum) ---------------------------
    def _set_min_stay(
        self, property_id: str, rng: DateRange, min_stay: int,
        *, push_channex: bool = True,
    ) -> None:
        """Mindestaufenthalt des Objekts setzen (rate_plans, property-weit) und
        als Restriktion für den Zeitraum an Channex pushen. Per-Tag-Min-Stay
        ist v2 — hier gilt der Wert objektweit (so wie der Rate-Plan).
        `push_channex=False`, wenn der Wert in einer kombinierten Bulk-Aktion
        bereits mit CTA/CTD in EINEM Call gepusht wird (Test 7)."""
        # Ohne Preisplan gibt es nichts zu aktualisieren: das `update` träfe
        # null Zeilen und meldete trotzdem Erfolg. Der Kalender sagte dann
        # „Gespeichert", und der Mindestaufenthalt stand nirgends (live am
        # 06.09.2026 an einem Entwurfs-Objekt gesehen). Laut fehlschlagen mit
        # einer Meldung, die den nächsten Schritt nennt (Wurzel 5).
        if not self._own_rate_plan_ids(property_id):
            raise CalendarError(
                "Für dieses Objekt gibt es noch keinen Preis. Lege zuerst einen "
                "Preis an — der Mindestaufenthalt hängt am Preisplan.",
                status_code=422,
            )
        self._db().table("rate_plans").update({"min_stay": min_stay}).eq(
            "property_id", property_id
        ).execute()
        self._rate_plan_cache.pop(property_id, None)  # Cache-Gegenzustand (Wurzel 1)
        if push_channex:
            self._push_channex_rate(
                property_id, rng.start, rng.end, None, min_stay=min_stay
            )

    def bulk_edit(self, tenant_id: str, req: BulkEditRequest) -> BulkEditResult:
        """Preis/Min-Stay/Sperre/Verkaufsstopp über mehrere Objekte × Zeitraum
        in einem Rutsch setzen. Nur gesetzte Felder werden angewendet. Jedes
        Objekt muss DIESEM Tenant gehören (sonst 404 für die ganze Operation).
        """
        owned = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("id", req.property_ids)
            .execute()
        ).data or []
        owned_ids = {p["id"] for p in owned}
        missing = [pid for pid in req.property_ids if pid not in owned_ids]
        if missing:
            raise CalendarError("Objekt nicht gefunden.", status_code=404)

        applied: list[str] = []
        for pid in req.property_ids:
            if req.block is True:
                self.block(tenant_id, BlockRequest(property_id=pid, range=req.range))
            elif req.block is False:
                self._unblock(pid, req.range)
            if req.stop_sell is True:
                self.set_stop_sell(tenant_id, pid, req.range, None)
            elif req.stop_sell is False:
                self.clear_stop_sell(tenant_id, pid, req.range)
            # Eine Bulk-Aktion = EIN Channex-Call (Zertifizierung Test 7/8):
            # Preis und Min-Stay wandern mit in den CTA/CTD/Max-Stay-Push; ohne
            # CTA/CTD/Max-Stay gehen Preis+Min-Stay gemeinsam in einen Rate-Push.
            # Max-Stay bündelt IMMER in den restrictions-Call (Test 7).
            has_restrictions = (
                req.closed_to_arrival is not None
                or req.closed_to_departure is not None
                or req.max_stay is not None
            )
            price_cents = (
                round(req.price * 100) if req.price is not None else None
            )
            combine_into_restrictions = has_restrictions and (
                req.min_stay is not None or price_cents is not None
            )
            combine_rate_min_stay = (
                not has_restrictions
                and price_cents is not None
                and req.min_stay is not None
            )
            combined = combine_into_restrictions or combine_rate_min_stay
            if req.price is not None:
                self.set_season_price(
                    tenant_id, pid, req.range, req.price,
                    push_channex=not combined,
                )
            elif req.price_adjust_pct is not None:
                self.adjust_season_price_pct(
                    tenant_id, pid, req.range, req.price_adjust_pct
                )
            if req.min_stay is not None:
                self._set_min_stay(
                    pid, req.range, req.min_stay,
                    push_channex=not combined,
                )
            if has_restrictions:
                self.set_restrictions(
                    tenant_id, pid, req.range,
                    cta=req.closed_to_arrival, ctd=req.closed_to_departure,
                    min_stay=req.min_stay, max_stay=req.max_stay,
                    rate_cents=price_cents if combine_into_restrictions else None,
                )
            elif combine_rate_min_stay:
                self._push_channex_rate(
                    pid, req.range.start, req.range.end,
                    price_cents, min_stay=req.min_stay,
                )

        if req.block is True:
            applied.append("block")
        elif req.block is False:
            applied.append("unblock")
        if req.stop_sell is True:
            applied.append("stop_sell")
        elif req.stop_sell is False:
            applied.append("clear_stop_sell")
        if req.price is not None:
            applied.append("price")
        elif req.price_adjust_pct is not None:
            applied.append("price_pct")
        if req.min_stay is not None:
            applied.append("min_stay")
        if req.closed_to_arrival is not None:
            applied.append(
                "cta_on" if req.closed_to_arrival else "cta_off"
            )
        if req.closed_to_departure is not None:
            applied.append(
                "ctd_on" if req.closed_to_departure else "ctd_off"
            )

        log.info(
            "calendar_bulk_edit",
            properties=len(req.property_ids),
            applied=applied,
        )
        return BulkEditResult(
            properties=len(req.property_ids),
            days=len(req.range.nights()),
            applied=applied,
        )

    def _own_rate_plan_ids(self, property_id: str) -> set[str]:
        """Die Rate-Plan-IDs GENAU dieses Objekts (Wurzel 3: der Request darf keinen
        fremden Plan bestimmen — Service-Role umgeht RLS, der property_id-Filter ist
        der einzige Backstop)."""
        rows = (
            self._db()
            .table("rate_plans")
            .select("id")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        return {r["id"] for r in rows}

    def _mirror_stop_sell_row(
        self, tenant_id: str, property_id: str, row: RestrictionRow
    ) -> None:
        """Lokalen stop_sell-Gegenzustand einer Restriktions-Zeile pflegen
        (Wurzel 1: der Channex-Push allein ließe eigene Plattform und Rezeption
        offen). row.rate_plan_id gesetzt → Stopp NUR für diesen Plan (Hotel);
        None → Objekt-Ebene wie set_stop_sell. Channex-importierte Stops
        derselben Ebene werden nie überschrieben/gelöscht."""
        start_iso = row.range.start.isoformat()
        end_iso = row.range.end.isoformat()

        def _plan_scoped(query):  # noqa: ANN001, ANN202 — postgrest-Builder
            return (
                query.eq("rate_plan_id", row.rate_plan_id)
                if row.rate_plan_id
                else query.is_("rate_plan_id", "null")
            )

        if row.stop_sell:
            # source=channex derselben Ebene nie zu manual kippen (sonst würde
            # ein Aufheben später OTA-Stops öffnen) — diese Tage auslassen.
            channex_days = {
                r["date"]
                for r in (
                    _plan_scoped(
                        self._db()
                        .table("stop_sell")
                        .select("date")
                        .eq("property_id", property_id)
                        .eq("source", "channex")
                    )
                    .gte("date", start_iso)
                    .lt("date", end_iso)
                    .execute()
                ).data
                or []
            }
            payload = [
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "date": d.isoformat(),
                    "reason": row.reason,
                    "source": "manual",
                    **(
                        {"rate_plan_id": row.rate_plan_id}
                        if row.rate_plan_id
                        else {}
                    ),
                }
                for d in row.range.nights()
                if d.isoformat() not in channex_days
            ]
            if payload:
                self._db().table("stop_sell").upsert(
                    payload, on_conflict="property_id,date,rate_plan_id"
                ).execute()
        else:
            _plan_scoped(
                self._db()
                .table("stop_sell")
                .delete()
                .eq("property_id", property_id)
                .eq("source", "manual")
            ).gte("date", start_iso).lt("date", end_iso).execute()

    def bulk_restrictions(self, tenant_id: str, req: RestrictionRowsRequest) -> int:
        """Mehrere heterogene Restriktions-Zeilen eines Objekts in EINEM Channex-
        Call setzen (Zertifizierung Test 3-8). Spiegelt lokal (Preis→price_overrides
        bzw. rate_plan_price_overrides, CTA/CTD→availability, stop_sell→stop_sell)
        und reiht EINEN restriction_rows-ARI-Job ein, der alle Zeilen gebündelt an
        Channex pusht. Zeilen mit `rate_plan_id` treffen NUR diesen Plan (Hotel).
        Gibt die Anzahl Zeilen zurück."""
        self._require_tenant_property(tenant_id, req.property_id)
        pid = req.property_id
        # Fremde/erfundene Rate-Plan-IDs hart abweisen, BEVOR gespiegelt oder
        # gepusht wird — kein stiller Fallback auf „alle Pläne" (Wurzel 4).
        requested_plans = {r.rate_plan_id for r in req.rows if r.rate_plan_id}
        if requested_plans:
            own = self._own_rate_plan_ids(pid)
            unknown = requested_plans - own
            if unknown:
                raise CalendarError(
                    "Preisplan gehört nicht zu diesem Objekt.", status_code=422
                )
        rows_payload = [
            self._mirror_restriction_row(tenant_id, pid, row) for row in req.rows
        ]
        # EIN Job → EIN gebündelter Channex-Call für alle Zeilen (Test 3-8).
        try_enqueue_ari(
            self._db(), tenant_id, pid, "restriction_rows", {"rows": rows_payload},
        )
        log.info("calendar_bulk_restrictions", property_id=pid, rows=len(rows_payload))
        return len(rows_payload)

    def bulk_restrictions_multi(
        self, tenant_id: str, req: MultiRestrictionRowsRequest
    ) -> int:
        """Zimmer-ÜBERGREIFENDE Bulk-Restriktionen (Hotel): eine UI-Aktion über
        mehrere Zimmer × Rate-Plans wird lokal je Zeile gespiegelt und als EIN
        Job eingereiht, der alle values je Channex-Property in EINEM Call pusht
        (Zertifizierung Tests 3-8: „1 API call" über Room-Types hinweg — die
        Zimmer eines Hotels teilen sich EINE Channex-Property, 0158). Jede Zeile
        wird auf Tenant-Objekt UND Plan-Zugehörigkeit geprüft (Wurzel 3/9).
        Gibt die Anzahl Zeilen zurück."""
        groups: dict[str, list[RestrictionRow]] = {}
        for row in req.rows:
            groups.setdefault(row.property_id, []).append(row)
        # ERST alle Objekte/Pläne prüfen (fail-closed, bevor irgendetwas
        # gespiegelt wird), DANN spiegeln + einreihen.
        for pid, rows in groups.items():
            self._require_tenant_property(tenant_id, pid)
            requested_plans = {r.rate_plan_id for r in rows if r.rate_plan_id}
            if requested_plans and (requested_plans - self._own_rate_plan_ids(pid)):
                raise CalendarError(
                    "Preisplan gehört nicht zu diesem Objekt.", status_code=422
                )
        rows_by_property = {
            pid: [self._mirror_restriction_row(tenant_id, pid, row) for row in rows]
            for pid, rows in groups.items()
        }
        first_pid = next(iter(rows_by_property))
        try_enqueue_ari(
            self._db(), tenant_id, first_pid, "restriction_rows_multi",
            {"rows_by_property": rows_by_property},
        )
        log.info(
            "calendar_bulk_restrictions_multi",
            properties=len(rows_by_property), rows=len(req.rows),
        )
        return len(req.rows)

    def _mirror_restriction_row(
        self, tenant_id: str, pid: str, row: RestrictionRow
    ) -> dict[str, object]:
        """Eine Restriktions-Zeile lokal spiegeln (Gegenzustand, Wurzel 1) und
        als Channex-Payload-Zeile zurückgeben — die Channex-Wahrheit kommt aus
        dem gebündelten Push, die lokalen Tabellen bleiben konsistent."""
        start, end = row.range.start, row.range.end  # end exklusiv
        if row.price is not None:
            if row.rate_plan_id:
                # Hotel: der Preis gehört an den Plan, NICHT an das Objekt —
                # sonst überschriebe eine BAR-Zeile den Preis aller Pläne.
                self._db().table("rate_plan_price_overrides").upsert(
                    [{"rate_plan_id": row.rate_plan_id, "date": d.isoformat(),
                      "price": row.price}
                     for d in row.range.nights()],
                    on_conflict="rate_plan_id,date",
                ).execute()
            else:
                self._db().table("price_overrides").upsert(
                    [{"property_id": pid, "date": d.isoformat(), "price": row.price}
                     for d in row.range.nights()],
                    on_conflict="property_id,date",
                ).execute()
        cta_ctd_set = (
            row.closed_to_arrival is not None
            or row.closed_to_departure is not None
        )
        if (cta_ctd_set or row.max_stay is not None) and row.rate_plan_id:
            # Hotel: CTA/CTD/Max-Stay gehören plan-genau in die Override-Tabelle
            # (0153) — NICHT objekt-weit in availability, sonst überschriebe eine
            # BAR-Zeile die Restriktion aller Pläne, und die UI könnte sie nie
            # plan-genau zurücklesen/bearbeiten.
            fields: dict[str, object] = {}
            if row.closed_to_arrival is not None:
                fields["closed_to_arrival"] = row.closed_to_arrival
            if row.closed_to_departure is not None:
                fields["closed_to_departure"] = row.closed_to_departure
            if row.max_stay is not None:
                fields["max_stay"] = row.max_stay
            self._db().table("rate_plan_restriction_overrides").upsert(
                [{"rate_plan_id": row.rate_plan_id, "date": d.isoformat(), **fields}
                 for d in row.range.nights()],
                on_conflict="rate_plan_id,date",
            ).execute()
        elif cta_ctd_set:
            # Objekt-Ebene (Ferienwohnung, kein Plan): CTA/CTD wie bisher in
            # availability (max_stay hat dort keine Spalte — nur Plan-Ebene).
            flags: dict[str, bool] = {}
            if row.closed_to_arrival is not None:
                flags["closed_to_arrival"] = row.closed_to_arrival
            if row.closed_to_departure is not None:
                flags["closed_to_departure"] = row.closed_to_departure
            self._db().table("availability").upsert(
                je_einheit(
                    self._db(), pid,
                    [{"property_id": pid, "date": d.isoformat(), **flags}
                     for d in row.range.nights()],
                ),
                on_conflict=AVAILABILITY_CONFLICT,
            ).execute()
        if row.min_stay is not None and row.rate_plan_id:
            # Hotel: datumsgenauer Mindestaufenthalt gehört an den Plan.
            self._db().table("rate_plan_min_stay_overrides").upsert(
                [{"rate_plan_id": row.rate_plan_id, "date": d.isoformat(),
                  "min_stay": row.min_stay}
                 for d in row.range.nights()],
                on_conflict="rate_plan_id,date",
            ).execute()
        if row.stop_sell is not None:
            self._mirror_stop_sell_row(tenant_id, pid, row)
        return {
            "date_from": start.isoformat(),
            "date_to": (end - timedelta(days=1)).isoformat(),  # inklusiv
            "rate_plan_id": row.rate_plan_id,
            "rate_cents": round(row.price * 100) if row.price is not None else None,
            "min_stay": row.min_stay,
            "max_stay": row.max_stay,
            "closed_to_arrival": row.closed_to_arrival,
            "closed_to_departure": row.closed_to_departure,
            "stop_sell": row.stop_sell,
        }

    def unblock(
        self,
        tenant_id: str,
        property_id: str,
        rng: DateRange,
        *,
        block_request_id: str | None = None,
        unit_id: str | None = None,
    ) -> int:
        """Manuelle Sperre im Zeitraum aufheben (öffentlicher, tenant-gescopter
        Einstieg — Wurzel 3). Gibt die Anzahl der Tage im Zeitraum zurück.

        `block_request_id` schränkt die Freigabe auf die Nächte GENAU DIESES
        genehmigten Antrags ein (0337). Ohne ihn gilt der alte, breite Weg: der
        Agentur-Knopf „Sperre aufheben" meint tatsächlich jede manuelle Sperre
        im gewählten Zeitraum, und das ist dort richtig.

        `unit_id` ist der Gegenzustand zur einheiten-genauen Sperre (0353):
        wurde nur Studio 3 gesperrt, darf das Aufheben auch nur Studio 3 öffnen
        — sonst risse es die Sperren der Schwestereinheiten mit auf (Wurzel 1).
        Die Zugehörigkeit wird serverseitig geprüft.
        """
        self._require_tenant_property(tenant_id, property_id)
        geprueft = self._require_tenant_unit(tenant_id, property_id, unit_id)
        self._unblock(
            property_id, rng,
            block_request_id=block_request_id, unit_id=geprueft,
        )
        return len(list(rng.nights()))

    def _unblock(
        self,
        property_id: str,
        rng: DateRange,
        *,
        block_request_id: str | None = None,
        unit_id: str | None = None,
    ) -> None:
        """Manuelle Sperre im Zeitraum aufheben (nur source=manual; gebuchte Tage
        bleiben unberührt). Meldet danach den ECHTEN Kalenderstand an die
        Portale — je Tag die Zahl der freien Einheiten.

        WURZEL 1 — AUF `open` SETZEN, NICHT LÖSCHEN: Ein DELETE hinterliess
        einen Tag OHNE Zeile. Für die Portale ist das offen (`full_sync`:
        „Tage ohne Zeile sind offen"), im Belegungsplan aber ein Loch, das
        einen durchgehenden Sperrbalken in zwei zerreisst. Live gefunden am
        10.08.2026 (Rævehulen, Sperre 14.–19.08.): der 15.08. hatte weder eine
        `availability`- noch eine `stop_sell`-Zeile und war mitten in der
        Sperre auf allen Portalen buchbar — ein Überbuchungsfenster, das wie
        ein Anzeigefehler aussah. Der Gegenzustand einer Sperre ist der offene
        Tag, nicht die Abwesenheit einer Aussage; deshalb hier dasselbe
        `update(status='open')` wie in `_release_nights` und
        `_free_ota_nights`. `block_request_id` wird mitgeleert, damit der Tag
        keinem Antrag mehr zugerechnet bleibt.

        WURZEL 1 — nur den EIGENEN Gegenzustand aufheben: Mit
        `block_request_id` wird ausschliesslich freigegeben, was dieser Antrag
        gesperrt hat. Ohne die Einschränkung riss der Widerruf eines
        Eigentümer-Antrags (5.–7.) eine im selben Zeitraum liegende
        AGENTUR-Sperre (1.–20., Handwerker) mit auf — beide tragen
        `status='blocked' AND source='manual'`, es gab kein Unterscheidungs-
        merkmal. Das Objekt war danach über Channex wieder verkäuflich.

        DER MELDE-FEHLER, DEN 0353 SCHLIESST: Hier ging je zusammenhängender
        offener Spanne ein festes `availability=1` raus. Bei einem Typ mit n
        Einheiten (0265/0266) sind nach dem Aufheben aber bis zu n Einheiten
        frei — die übrigen n−1 blieben bei den Portalen unverkäuflich, bis
        irgendein anderer Vorgang den Stand zufällig korrigierte. Umgekehrt
        deckte die Spannen-Rechnung („belegt = irgendeine Zeile gebucht oder
        gesperrt") einen Tag komplett zu, an dem nur EINE von fünf Einheiten
        belegt war. `_push_einheiten_stand` beantwortet beides mit derselben
        Rechnung wie der Buchungs- und der OTA-Pfad: die echte Stückzahl je
        Tag, gruppiert in Spannen gleichen Werts. Die Sonderbehandlung
        „gebuchte Tage aus dem Push aussparen" entfällt damit ersatzlos — ein
        voll belegter Tag ergibt schlicht die Zahl 0.

        `unit_id` grenzt die Freigabe auf EINE Einheit ein — der Gegenzustand
        zur einheiten-genauen Sperre (0353). Der Aufrufer hat sie bereits
        gescopt (`unblock`); dieser interne Weg prüft nicht erneut.
        """
        query = (
            self._db().table("availability")
            .update({
                "status": AvailabilityStatus.open.value,
                "block_request_id": None,
            })
            .eq("property_id", property_id)
            .eq("status", "blocked")
            .in_("source", _AUFHEBBARE_SPERRQUELLEN)
        )
        if block_request_id is not None:
            query = query.eq("block_request_id", block_request_id)
        if unit_id is not None:
            query = query.eq("unit_id", unit_id)
        query.gte("date", rng.start.isoformat()).lt(
            "date", rng.end.isoformat()
        ).execute()
        # Das UPDATE lief VOR diesem Push — der Stand, den `_push_einheiten_stand`
        # gleich liest, ist also der Zustand NACH der Freigabe. Umgekehrt meldete
        # er die eben freigegebenen Nächte weiter als belegt.
        self._push_einheiten_stand(property_id, rng)

    def _push_channex_rate(
        self,
        property_id: str,
        start: date,
        end: date,
        rate_cents: int | None,
        *,
        min_stay: int | None = None,
    ) -> None:
        """Tagespreis und/oder Min-Stay als ARI-Push-Job einreihen (Phase 2). KEIN
        coalesce (zeitraum-/wert-spezifisch). tenant_id über die property."""
        tenant_id = self._tenant_of(property_id)
        if tenant_id is None:
            return
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "rate",
            {"date_from": start.isoformat(),
             "date_to": (end - timedelta(days=1)).isoformat(),  # end exklusiv
             "rate_cents": rate_cents, "min_stay": min_stay},
        )

    def _push_einheiten_stand(self, property_id: str, rng: DateRange) -> None:
        """Den FERTIGEN Kalenderstand eines Zeitraums an die Portale melden —
        mit der ECHTEN Zahl freier Einheiten je Tag.

        WARUM NICHT MEHR 0/1: Ein Objekt ist seit 0265 ein Einheiten-TYP mit
        n >= 1 Einheiten, und Verfügbarkeit an die Portale ist eine ZAHL
        (SiteMinder `BookingLimit`, Booking.com „rooms available to sell"). Ein
        festes `1` beim Aufheben einer Sperre war bei n > 1 zu WENIG: die
        übrigen n−1 Einheiten blieben unverkäuflich, obwohl der Kalender sie
        offen führte. Ein festes `0` beim Sperren wird zu VIEL, sobald eine
        Sperre nur eine einzelne Einheit betrifft (0353) — sie nähme dem ganzen
        Typ die Verfügbarkeit.

        `freie_einheiten_spannen` liest den Kalender (die Wahrheit für Belegung)
        und liefert die Spannen gleicher Stückzahl fertig für den Push. Es ist
        derselbe Weg, den `reservations._push_einheiten_stand` und
        `bookings_sync` schon gehen — die Frage „wie viele Einheiten sind an
        diesem Tag noch verkäuflich?" darf nicht zwei Antworten haben.

        VORAUSSETZUNG: Der Kalender ist für den ganzen Zeitraum bereits
        geschrieben. Der Helfer meldet den IST-Stand; wird er vor dem Schreiben
        gerufen, meldet er den Zustand von VORHER (beim Sperren zu viele freie
        Einheiten = Überbuchungsrisiko, beim Freigeben zu wenige = verschenkter
        Verkauf).

        ENDE-KONVENTION: `rng.end` ist EXKLUSIV (der ganze Kalender rechnet so),
        `freie_einheiten_spannen` nimmt `bis` INKLUSIV und gibt seine Spannen
        ebenfalls mit inklusivem Ende zurück. Beide Grenzen werden deshalb hier
        umgerechnet — an genau EINER Stelle, statt die Konvention über den Slice
        zu verteilen. `rng` hat mindestens eine Nacht (DateRange erzwingt
        end > start), `rng.end - 1` liegt also nie vor `rng.start`.
        """
        tenant_id = self._tenant_of(property_id)
        if tenant_id is None:
            return
        for span_von, span_bis, frei in freie_einheiten_spannen(
            self._db(), tenant_id, property_id,
            rng.start, rng.end - timedelta(days=1),
        ):
            self._push_channex_availability(
                property_id, span_von, span_bis + timedelta(days=1), frei
            )

    def _push_channex_availability(
        self, property_id: str, start: date, end: date, availability: int
    ) -> None:
        """Verfügbarkeit der Tage [start, end) als ARI-Push-Job einreihen (Phase 2).
        Doppelbuchungsschutz ohne Request-Blockade. KEIN coalesce — verschiedene
        Kalenderaktionen betreffen disjunkte Zeiträume. tenant_id über die property."""
        tenant_id = self._tenant_of(property_id)
        if tenant_id is None:
            return
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "availability",
            {"date_from": start.isoformat(),
             "date_to": (end - timedelta(days=1)).isoformat(),  # end exklusiv
             "availability": availability},
        )
