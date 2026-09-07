"""Dynamic-Pricing Recompute-Service.

Lädt je Objekt die Quellen (Basispreis, dp_settings, Saison-/Event-Perioden,
eigene Reservierungen/Verfügbarkeit), leitet pro Tag die Engine-Signale ab, ruft
die reine Engine (engine.py) und schreibt das Ergebnis nach dynamic_prices.
Anschließend wird der vorhandene Channex-ARI-Push (Preis + Min-Stay) für den
geänderten Bereich ausgelöst.

DP schreibt NUR in dynamic_prices — niemals in price_overrides (das bleibt die
manuelle Host-Überschreibung und gewinnt im Resolver). Nur Objekte mit
dp_settings.enabled werden berechnet.
"""
from __future__ import annotations

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows
from src.features.subscriptions.entitlements import modul_aktiv
from src.features.subscriptions.schemas import DYNPRICING_MODULE_KEY

from .engine import DayResult, DaySignals, DpSettings, compute_day
from .freigabe import gesendet_stempeln
from .market import MarketDay, MarketSignalProvider, get_market_provider
from .zusatzsignale import (
    anker_je_tag,
    feiertage_je_tag,
    objektland,
    preisgrenzen_je_tag,
    saison_untergrenze_je_tag,
    verlauf_schreiben,
)

log = get_logger("nextdays.pricing.recompute")

# Standard-Planungshorizont (Tage ab heute), wie im Channex-state_length-Init.
DEFAULT_HORIZON_DAYS = 540
# Horizont für den Min/Max-Vorschlag (suggest_range). Ein volles Jahr, damit
# JEDE Saison einmal vorkommt: mit 120 Tagen fehlte im Winter die Hochsaison
# komplett, und der vorgeschlagene Höchstpreis lag entsprechend zu niedrig.
VORSCHLAG_HORIZONT_TAGE = 365
# Fenster (Tage) für das Auslastungssignal um einen Tag herum.
_OCCUPANCY_WINDOW = 30
# Wie viele Tage je `in_`-Filter (Stempeln, Ausbuchen). Mehr sprengt die URL.
_IN_BLOCK = 100


def _as_date(value: object) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


class DynamicPricingRecompute:
    """Berechnet dynamische Preise und verteilt sie (Channex-Push)."""

    def __init__(
        self, service_client: Client | None = None, channex_budget: object = None
    ) -> None:
        self._client = service_client
        # Optionales Channex-Token-Budget: der Recompute pusht die MEISTEN Rate-
        # Calls (Tagespreise über den 365-Tage-Horizont je Objekt). Ohne Budget
        # (before_call=None) umgingen diese Pushes das kontoweite Rate-Limit — bei
        # Churn über viele Objekte überfahren sie Channex' Konto-Limit. Der Worker
        # reicht sein ChannexBudget durch; der synchrone Hintergrund-Task (nach
        # dem Speichern) läuft ohne (einzelnes Objekt, kein Batch-Risiko).
        self._channex_budget = channex_budget
        # Rohzeile der zuletzt geladenen dp_settings (für market_key/comp_refs,
        # die nicht in der Rechen-Dataclass DpSettings liegen).
        self._settings_row: dict | None = None

    def _db(self) -> Client:
        if self._client is None:
            raise RuntimeError("Pricing-Recompute-DB nicht verfügbar.")
        return self._client

    # -- Öffentliche Einstiegspunkte -----------------------------------------
    def recompute_all(self, *, horizon_days: int = DEFAULT_HORIZON_DAYS) -> dict:
        """Alle Objekte mit aktiviertem Dynamic Pricing neu berechnen (Cron)."""
        rows = (
            self._db()
            .table("dp_settings")
            .select("property_id")
            .eq("enabled", True)
            .execute()
        ).data or []
        total_days = 0
        for r in rows:
            total_days += self.recompute_property(
                r["property_id"], horizon_days=horizon_days
            )
        result = {"properties": len(rows), "days": total_days}
        log.info("dynamic_pricing_recompute_all", **result)
        return result

    def recompute_property(
        self,
        property_id: str,
        *,
        start: date | None = None,
        end: date | None = None,
        horizon_days: int = DEFAULT_HORIZON_DAYS,
    ) -> int:
        """Ein Objekt für [start, end) (Default: heute .. +horizon) neu rechnen.

        No-op (0), wenn DP für das Objekt aus ist oder kein Basispreis existiert
        (kein erfundener Preis). Gibt die Anzahl geschriebener Tage zurück."""
        today = datetime.now(UTC).date()
        rng_start = start or today
        rng_end = end or (today + timedelta(days=horizon_days))
        if rng_end <= rng_start:
            return 0

        settings = self._load_settings(property_id)
        if not settings.enabled:
            return 0
        # Feature-Gate: „Dynamische Preise" ist ein kostenpflichtiges Modul
        # (0,5 % vom Buchungsumsatz). Ohne gebuchtes Modul rechnet die Engine
        # nicht — sonst bekäme der Betrieb die Leistung, ohne dass jemals eine
        # Nutzung gemeldet (und abgerechnet) würde.
        if not self._modul_gebucht(property_id):
            return 0
        base = self._load_base_price(property_id)
        if base is None:
            log.info("dynamic_pricing_skip_no_base", property_id=property_id)
            return 0

        results = self._price_curve(property_id, base, settings, today, rng_start, rng_end)
        tenant_id = self._tenant_for_property(property_id)
        # Tagesmodus je Datum: 'anpassung' verschiebt den berechneten Preis um
        # einen Prozentsatz, 'manuell' nimmt den Tag ganz aus der Automatik.
        # Der ANGEPASSTE Wert wird gespeichert, nicht der rohe — sonst müsste
        # jeder Leser (Resolver, Channex-Push, Kalender, Quote) die Anpassung
        # selbst nachrechnen, und wer es vergisst, sendet den falschen Preis.
        modi = self._tagesmodi(property_id, rng_start, rng_end)
        rows = []
        manuell: list[tuple[str, int]] = []
        for cur, res in results:
            iso = cur.isoformat()
            eintrag = modi.get(iso)
            modus = (eintrag or {}).get("modus", "dynamisch")
            if modus == "manuell":
                # Der feste Preis steht in price_overrides. Hier NICHT
                # schreiben — aber auch nicht einfach überspringen: der Resolver
                # lässt `dynamic` vor `override` gewinnen, und die ALTE
                # dynamic_prices-Zeile dieses Tags stand weiter da. Ergebnis
                # (04.09.2026): „Fester Preis 800" gesetzt, Kalender und
                # Portale zeigten unverändert den alten Automatikpreis. Der Tag
                # wird deshalb unten ausgebucht und sein fester Preis gepusht.
                manuell.append((iso, res.min_stay))
                continue
            preis = res.price
            faktoren = {k: round(v, 4) for k, v in res.factors.items()}
            if modus == "anpassung":
                pct = float((eintrag or {}).get("adjust_pct") or 0.0)
                preis = round(preis * (1 + pct / 100), 2)
                # Als eigener Faktor sichtbar: „Warum dieser Preis?" muss die
                # Handanpassung nennen, sonst wirkt sie wie ein Rechenfehler.
                faktoren["tagesanpassung"] = round(1 + pct / 100, 4)
            rows.append(
                {
                    "property_id": property_id,
                    "date": iso,
                    "price": preis,
                    "min_stay": res.min_stay,
                    "factors": faktoren,
                    "computed_at": datetime.now(UTC).isoformat(),
                }
            )

        manuell_rows = self._manuell_ausbuchen(property_id, manuell)

        if rows:
            # In dynamic_prices schreiben → Kalender, Quote UND die eigene
            # Plattform (booking_engine) lesen den Preis automatisch über den
            # Resolver (Pull). KEIN Push dorthin nötig. Nur externe OTAs
            # (Channex) müssen den Preis aktiv geschickt bekommen — das macht
            # _push_to_channex.
            #
            # `gesendet_am` (0554) trennt „gerechnet" von „an die Portale
            # übergeben". Zwei Fehler stecken sonst darin (live 04.09.2026:
            # „540 Tage nicht gesendet", obwohl alle 540 längst draußen waren):
            #   * Der normale Push stempelte nie → nach dem Einschalten der
            #     Freigabe galt ALLES als ungesendet, der Reconciler nahm es
            #     aus dem Soll.
            #   * Ein einmal gestempelter Tag blieb gestempelt, auch wenn der
            #     Preis sich änderte → die Freigabe schützte nur beim ersten Mal.
            # Deshalb: geänderte Preise verlieren den Stempel (Wurzel 1, der
            # Gegenzustand), gesendete bekommen ihn.
            bestand = self._bestand_preise(property_id, rng_start, rng_end)
            geaendert = [
                r for r in rows if bestand.get(r["date"]) != float(r["price"])
            ]
            unveraendert = [
                r for r in rows if bestand.get(r["date"]) == float(r["price"])
            ]
            if unveraendert:
                self._db().table("dynamic_prices").upsert(
                    unveraendert, on_conflict="property_id,date"
                ).execute()
            if geaendert:
                self._db().table("dynamic_prices").upsert(
                    [{**r, "gesendet_am": None} for r in geaendert],
                    on_conflict="property_id,date",
                ).execute()
        # An die Portale geht die berechnete Kurve PLUS die festen Tage — ein
        # fester Preis, der nur lokal gilt, wäre auf Airbnb und Booking ein
        # anderer Preis als im Kalender.
        zu_senden = rows + manuell_rows
        if zu_senden:
            # Freigabe verlangt? Dann gehen nur die bereits freigegebenen Tage
            # raus. Gerechnet und gespeichert ist alles — der Kalender zeigt
            # weiterhin die echten Preise, nur die Portale warten.
            #
            # Die Sperre liegt in `freigabe.gesperrte_tage`, weil ALLE drei
            # Push-Wege sie brauchen (hier, ari_push, full_sync). Ein Gate in
            # nur einem wäre die Attrappe, an der schon der frühere
            # "Autopilot"-Modus scheiterte.
            from .freigabe import gesperrte_tage  # noqa: PLC0415

            gesperrt = gesperrte_tage(self._db(), property_id, rng_start, rng_end)
            if gesperrt:
                zu_senden = [r for r in zu_senden if r["date"] not in gesperrt]
                if not zu_senden:
                    log.info(
                        "dynamic_pricing_alles_wartet_auf_freigabe",
                        property_id=property_id,
                        gesperrt=len(gesperrt),
                    )
                    return len(gesperrt)
            # EIN Schalter, EINE Wahrheit: enabled heißt, die dynamischen
            # Tagespreise gelten überall — lokal (Resolver-Pull) UND auf den
            # Portalen. Der frühere Autopilot-Zwischenmodus („rechnen, aber
            # nicht veröffentlichen") war eine Attrappe: Reconcile und
            # Full-Sync bauen ihre Soll-Kurve aus demselben Resolver und
            # pushten die Preise ohnehin. Ein Gate nur hier gaukelte eine
            # Kontrolle vor, die es nie gab.
            if self._push_to_channex(
                tenant_id, property_id, zu_senden, rate_plan_id=self._dp_rate_plan_id()
            ):
                # Verlauf (SiteMinder „History"): EIN Eintrag je Push.
                gesendet = sorted(str(r["date"])[:10] for r in zu_senden)
                verlauf_schreiben(
                    self._db(),
                    property_id,
                    von=date.fromisoformat(gesendet[0]),
                    bis=date.fromisoformat(gesendet[-1]),
                    ereignis="gesendet",
                    details={
                        "tage": len(gesendet),
                        "min": min(float(r["price"]) for r in zu_senden),
                        "max": max(float(r["price"]) for r in zu_senden),
                    },
                )
                # Gestempelt wird, was WIRKLICH rausging, nicht der ganze
                # Bereich. Der frühere Zusatz `and not gesperrt` war der
                # Zirkel hinter „540 Tage nicht gesendet": bei Freigabepflicht
                # ist `gesperrt` nie leer (dort steht jeder ungestempelte Tag),
                # also stempelte der Lauf NIE, also blieben die Tage
                # ungestempelt, also standen sie beim nächsten Lauf wieder in
                # `gesperrt`. Ein freigegebener Tag, dessen Preis sich änderte,
                # verlor seinen Stempel (oben, Wurzel 1) und bekam ihn nie
                # zurück — obwohl er soeben gepusht wurde.
                # Feste Tage haben keine dynamic_prices-Zeile; für sie trifft
                # das Update nichts, was korrekt ist.
                self._gesendet_stempeln(
                    property_id, [str(r["date"])[:10] for r in zu_senden]
                )
        log.info(
            "dynamic_pricing_recompute_property",
            property_id=property_id,
            days=len(rows),
        )
        return len(rows)

    def _manuell_ausbuchen(
        self, property_id: str, tage: list[tuple[str, int]]
    ) -> list[dict]:
        """Feste Tage aus der Automatik nehmen — der Gegenzustand (Wurzel 1).

        Zwei Dinge, die vorher beide fehlten:
          1. Die alte dynamic_prices-Zeile des Tags löschen. Solange sie steht,
             gewinnt sie im Resolver gegen den festen Preis, und der Nutzer
             sieht nach „Fester Preis" weiter die Automatik.
          2. Den festen Preis für den Portal-Push zurückgeben. `_push_to_channex`
             kennt nur die berechneten Zeilen; ohne diese Rückgabe erreichte der
             feste Preis Airbnb und Booking nie.
        Rückgabe: Push-Zeilen {property_id, date, price, min_stay} der Tage, die
        einen festen Preis in `price_overrides` haben.
        """
        if not tage:
            return []
        isos = [iso for iso, _ in tage]
        try:
            for i in range(0, len(isos), _IN_BLOCK):
                self._db().table("dynamic_prices").delete().eq(
                    "property_id", property_id
                ).in_("date", isos[i : i + _IN_BLOCK]).execute()
        except Exception as exc:  # noqa: BLE001 — laut, aber der Lauf geht weiter
            log.warning(
                "dynamic_prices_manuell_ausbuchen_fehlgeschlagen",
                property_id=property_id,
                error=str(exc)[:200],
            )
        fest: dict[str, float] = {}
        try:
            for i in range(0, len(isos), _IN_BLOCK):
                res = (
                    self._db()
                    .table("price_overrides")
                    .select("date, price")
                    .eq("property_id", property_id)
                    .in_("date", isos[i : i + _IN_BLOCK])
                    .not_.is_("price", "null")
                    .execute()
                ).data or []
                for r in res:
                    if r.get("price") is not None:
                        fest[str(r["date"])[:10]] = float(r["price"])
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "price_overrides_fuer_feste_tage_unlesbar",
                property_id=property_id,
                error=str(exc)[:200],
            )
            return []
        if len(fest) < len(isos):
            # Modus 'manuell' ohne Betrag: das darf der Service nicht zulassen
            # (422) — steht es trotzdem so da, wird es benannt, nicht erfunden.
            log.warning(
                "dp_manuell_ohne_preis",
                property_id=property_id,
                tage=sorted(set(isos) - set(fest)),
            )
        return [
            {"property_id": property_id, "date": iso, "price": fest[iso], "min_stay": ms}
            for iso, ms in tage
            if iso in fest
        ]

    def _bestand_preise(
        self, property_id: str, von: date, bis: date
    ) -> dict[str, float]:
        """Bereits gespeicherte Tagespreise {ISO: preis} — um zu erkennen,
        welche Tage sich WIRKLICH ändern. Fail-soft leer: dann gilt alles als
        geändert und verliert den Stempel — der vorsichtige Fehler."""
        try:
            rows = fetch_all_rows(
                self._db()
                .table("dynamic_prices")
                .select("date, price")
                .eq("property_id", property_id)
                .gte("date", von.isoformat())
                .lt("date", bis.isoformat())
                .order("date")
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("dynamic_prices_bestand_unlesbar", error=str(exc)[:200])
            return {}
        out: dict[str, float] = {}
        for r in rows:
            try:
                out[str(r["date"])[:10]] = float(r["price"])
            except (TypeError, ValueError, KeyError):
                continue
        return out

    def _gesendet_stempeln(self, property_id: str, tage: list[str]) -> None:
        """Genau die übergebenen Tage als gesendet markieren — über den EINEN
        Helfer in `freigabe.py`, den auch der Umschalt-Push nutzt."""
        gesendet_stempeln(self._db(), property_id, tage)

    def _tagesmodi(
        self, property_id: str, von: date, bis: date
    ) -> dict[str, dict]:
        """Tagesmodus je ISO-Datum. Keine Zeile = 'dynamisch' (Standard).

        Fail-SOFT bewusst: fehlt die Tabelle (Migration nicht eingespielt),
        rechnet die Automatik wie bisher weiter. Das ist hier richtig, weil
        der Standard ohnehin 'dynamisch' ist — ein leeres Ergebnis bedeutet
        dasselbe wie "keine Sonderbehandlung", nicht "Regel verloren".
        """
        try:
            res = (
                self._db()
                .table("dp_day_modes")
                .select("date, modus, adjust_pct")
                .eq("property_id", property_id)
                .gte("date", von.isoformat())
                .lt("date", bis.isoformat())
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — kein Modus = Standard
            log.warning("dp_day_modes_unavailable", error=str(exc))
            return {}
        return {r["date"]: r for r in res if isinstance(r.get("date"), str)}

    # -- Öffentliche Fassade für Vorschauen -----------------------------------
    # Der KI-Regel-Berater rechnet mit DENSELBEN Funktionen eine Wirkungs-
    # vorschau ("was macht dieser Vorschlag mit den Preisen?"). Eigene
    # Nachbauten dort würden abweichen, sobald hier etwas geändert wird — die
    # Vorschau zeigte dann etwas anderes als der spätere Lauf.
    def load_base_price(self, property_id: str) -> float | None:
        """Basispreis des Objekts (None = keiner hinterlegt)."""
        return self._load_base_price(property_id)

    def load_settings(self, property_id: str) -> DpSettings:
        """Einstellungen des Objekts — laedt auch `_settings_row` (Comp-Set,
        Quellmaerkte, Ratenplan), das die Kurve braucht."""
        return self._load_settings(property_id)

    def booked_dates(self, property_id: str, start: date, end: date) -> set[str]:
        """Belegte/gesperrte Tage als ISO-Set (dieselbe Quelle wie die Engine)."""
        return self._booked_dates(property_id, start, end)

    def preis_kurve(
        self,
        property_id: str,
        base: float,
        settings: DpSettings,
        today: date,
        rng_start: date,
        rng_end: date,
    ) -> list[tuple[date, DayResult]]:
        """Tageskurve für Vorschauen (Stufen-Vorschau, KI-Berater).

        Schreibt KEINE dynamic_prices. Der Pfad legt aber wie der echte Lauf
        Pickup-Snapshots ab (idempotent je Tag) — die Vorschau soll denselben
        Weg gehen wie der Lauf, sonst zeigt sie etwas anderes.

        `_settings_row` wird nachgeladen, falls der Aufrufer die Zeile nicht
        selbst geladen hat: `_market_by_date` liest `market_key`/`comp_refs`
        daraus. Ohne diesen Schritt rechnete jede Vorschau ein von Hand
        gepflegtes Comp-Set stillschweigend als „kein Comp-Set" (Umgebung) —
        und der KI-Berater hätte eine andere Wirkung gezeigt als der Lauf."""
        if self._settings_row is None:
            self._load_settings(property_id)
        return self._price_curve(
            property_id, base, settings, today, rng_start, rng_end
        )

    def _price_curve(
        self,
        property_id: str,
        base: float,
        settings: DpSettings,
        today: date,
        rng_start: date,
        rng_end: date,
    ) -> list[tuple[date, DayResult]]:
        """Die Dynamic-Pricing-Tageskurve [rng_start, rng_end) berechnen (Signals
        + compute_day), OHNE zu speichern. Geteilt von recompute_property (schreibt)
        und suggest_range (nur lesen). EINE Rechenwahrheit."""
        tenant_id = self._tenant_for_property(property_id)
        event_pct = self._event_pct_by_date(
            tenant_id, rng_start, rng_end, property_id=property_id
        )
        booked = self._booked_dates(property_id, rng_start, rng_end)
        market = self._market_by_date(
            property_id, settings, tenant_id, rng_start, rng_end
        )

        # Pickup: heutigen Belegungs-Snapshot je Aufenthaltstag persistieren
        # (Lern-Fundament + Velocity-Quelle). Best-effort — fehlt die Tabelle/
        # Historie, bleibt das Velocity-Signal None (neutral).
        self._write_pickup_snapshots(property_id, today, rng_start, rng_end, booked)
        # Velocity-Quelle: primär die gelernte KI-Forecast-Kurve (Phase 4), sonst
        # das einfache Lookback-Signal (Phase 2). Keine Fallbacks (neutral bei leer).
        velocity = self._pickup_velocity_by_date(property_id, today, rng_start, rng_end)
        velocity.update(
            self._forecast_velocity_by_date(property_id, today, rng_start, rng_end)
        )
        # Wetter (RateBoard): nur wenn aktiviert; ferne Tage → kein Score (neutral).
        weather = self._weather_by_date(property_id, settings, today, rng_start, rng_end)
        # 0562: Preisgrenzen je Zeitraum, Vorjahresanker, Feiertage/Ferien.
        # Alle drei lesen nur; fehlt eine Tabelle, bleibt das Signal leer.
        grenzen = preisgrenzen_je_tag(self._db(), property_id, rng_start, rng_end)
        anker = (
            anker_je_tag(self._db(), property_id, rng_start, rng_end)
            if settings.anker_enabled
            else {}
        )
        feiertage = self._feiertage_by_date(property_id, settings, rng_start, rng_end)
        # 0565: Saisonpreis als Untergrenze — Prozent-Saisons beziehen sich auf
        # den Grundpreis des Ratenplans (`base`), nicht auf die Marktbasis.
        saison = (
            saison_untergrenze_je_tag(self._db(), property_id, base, rng_start, rng_end)
            if settings.saison_mindestpreis
            else {}
        )
        if settings.saison_mindestpreis:
            log.info(
                "dp_saison_untergrenze_geladen",
                property_id=property_id,
                saisontage=len(saison),
            )

        out: list[tuple[date, DayResult]] = []
        cur = rng_start
        while cur < rng_end:
            md = market.get(cur.isoformat())
            grenze = grenzen.get(cur.isoformat(), (None, None))
            frei = feiertage.get(cur.isoformat(), {})
            signals = DaySignals(
                day=cur,
                event_pct=event_pct.get(cur.isoformat(), 0.0),
                occupancy=self._occupancy_signal(cur, booked, today),
                days_before=(cur - today).days,
                is_orphan_gap=self._is_orphan_gap(cur, booked),
                comp_price=md.comp_price if md else None,
                demand_index=md.demand_index if md else None,
                market_event_pct=md.event_uplift_pct if md else None,
                pickup_velocity=velocity.get(cur.isoformat()),
                weather_score=weather.get(cur.isoformat()),
                anker_price=anker.get(cur.isoformat()),
                ist_feiertag=bool(frei.get("feiertag")),
                ist_ferien=bool(frei.get("ferien")),
                min_price_tag=grenze[0],
                max_price_tag=grenze[1],
                saison_min_price=saison.get(cur.isoformat()),
            )
            out.append((cur, compute_day(base, settings, signals)))
            cur += timedelta(days=1)
        return out

    def suggest_range(
        self, property_id: str, *, horizon_days: int = VORSCHLAG_HORIZONT_TAGE
    ) -> dict[str, float] | None:
        """Empfohlene Preisspanne (min/max) für Smart Pricing aus der ECHTEN
        Dynamic-Pricing-Engine über den Horizont — die Extrema der von Nachfrage/
        Saison/Wochenende/Auslastung getriebenen Tagespreise. KEIN erfundener
        Multiplikator (Wurzel 4). Rechnet OHNE min/max-Klammer (die will der Host
        ja gerade erst setzen) und OHNE zu speichern.

        None, wenn kein Basispreis existiert (kein Vorschlag ohne Datengrundlage)."""
        today = datetime.now(UTC).date()
        base = self._load_base_price(property_id)
        if base is None:
            return None
        settings = self._load_settings(property_id)
        # Für den Vorschlag die eigene Klammer ignorieren: wir wollen die
        # ungeklammerte Nachfrage-Spanne sehen (sonst schlägt die Engine nur den
        # bereits gesetzten Rahmen zurück).
        settings = replace(settings, min_price=None, max_price=None)
        curve = self._price_curve(
            property_id, base, settings, today, today, today + timedelta(days=horizon_days)
        )
        prices = [res.price for _, res in curve if res.price is not None]
        if not prices:
            return None
        return {"min": round(min(prices)), "max": round(max(prices))}

    def _market_by_date(
        self,
        property_id: str,
        settings: DpSettings,
        tenant_id: str | None,
        start: date,
        end: date,
    ) -> dict[str, MarketDay]:
        """Markt-Signal je Tag über den konfigurierten Provider — NUR wenn der
        Vermieter Marktdaten aktiviert hat (market_enabled). Ohne Aktivierung oder
        ohne Provider-Signal leer → der Markt-Faktor bleibt neutral (Phase-1-Parität).

        market_key/comp_refs liegen in dp_settings; sie kommen NICHT aus der
        Engine-DpSettings (die hält nur Rechenparameter), daher hier direkt aus
        der Zeile gelesen."""
        if not settings.market_enabled:
            return {}
        row = self._settings_row
        market_key = (row or {}).get("market_key")
        comp_refs = [str(r) for r in ((row or {}).get("comp_refs") or [])]
        days: list[date] = []
        cur = start
        while cur < end:
            days.append(cur)
            cur += timedelta(days=1)
        try:
            provider = self._market_provider(
                property_id, comp_refs, tenant_id
            )
            return provider.market_signal(market_key, comp_refs, days)
        except Exception as exc:  # noqa: BLE001 — Markt-Signal ist best-effort
            log.warning("market_signal_failed", error=str(exc))
            return {}

    def _market_provider(
        self, property_id: str, comp_refs: list[str], tenant_id: str | None
    ) -> MarketSignalProvider:
        """Markt-Provider wählen.

        Reihenfolge, vom Speziellen zum Allgemeinen:
          1. Ein von Hand gepflegtes Comp-Set gewinnt — wer Objekte ausdrücklich
             benennt, will genau die verglichen haben (PlatformProvider).
          2. Sonst die MARKTBEOBACHTUNG: das Preisniveau der Umgebung, das der
             tägliche Lauf im Raster abgelegt hat (`markt_beobachtung`). Das ist
             der Normalfall.
          3. Ist für die Zelle nichts hinterlegt, der UMKREIS über die eigene
             Plattform. Er bleibt als Rückfall, greift aber selten: gemessen am
             04.09.2026 haben 40 von 44 aktiven Objekten keinen einzigen
             Nachbarn eines fremden Betriebs, weil erst fünf Betriebe auf der
             Plattform sind.
          4. Ein ausdrücklich konfigurierter externer Anbieter (AirDNA) hat
             Vorrang vor allem — wer dafür zahlt, will ihn nutzen.

        Kein Provider ruft hier eine Fremdquelle ab: alle lesen nur. Eine
        Preisberechnung hängt damit nie an der Erreichbarkeit eines Dritten.
        """
        from src.core.config import get_settings

        env_choice = (get_settings().market_data_provider or "").strip().lower()
        if env_choice not in ("", "null", "platform", "umkreis", "umgebung"):
            return get_market_provider()
        if self._client is None:
            return get_market_provider()
        if comp_refs:
            from .market.platform import PlatformProvider

            return PlatformProvider(self._client, tenant_id)
        from .market.umgebung import UmgebungProvider

        umgebung = UmgebungProvider(self._client, property_id)
        if umgebung.hat_daten():
            return umgebung
        from .market.umkreis import UmkreisProvider

        return UmkreisProvider(self._client, property_id, tenant_id)

    # -- Pickup (Roadmap-Phase 2) -------------------------------------------
    # Fenster (Tage), über das die Pickup-Geschwindigkeit gemessen wird: Stand
    # heute vs. Stand vor PICKUP_LOOKBACK_DAYS für denselben Aufenthaltstag.
    _PICKUP_LOOKBACK_DAYS = 7

    def _write_pickup_snapshots(
        self,
        property_id: str,
        today: date,
        start: date,
        end: date,
        booked: set[str],
    ) -> None:
        """Heutigen Belegungs-Snapshot je Aufenthaltstag schreiben (idempotent
        per Unique-Key). Das ist das Lern-Fundament + die Velocity-Quelle. Best-
        effort: fehlt die Tabelle (Migration 0060 nicht angewendet), wird nur
        geloggt — der Recompute läuft normal weiter."""
        snaps: list[dict] = []
        cur = start
        while cur < end:
            iso = cur.isoformat()
            snaps.append(
                {
                    "property_id": property_id,
                    "stay_date": iso,
                    "snapshot_date": today.isoformat(),
                    "days_before": (cur - today).days,
                    "booked": iso in booked,
                }
            )
            cur += timedelta(days=1)
        if not snaps:
            return
        try:
            self._db().table("dp_pickup_snapshots").upsert(
                snaps, on_conflict="property_id,stay_date,snapshot_date"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Pickup-Erfassung ist best-effort
            log.warning("pickup_snapshot_write_failed", error=str(exc))

    def _pickup_velocity_by_date(
        self, property_id: str, today: date, start: date, end: date
    ) -> dict[str, float]:
        """Pickup-Geschwindigkeit je Aufenthaltstag aus der Snapshot-Historie.

        Vergleicht den heutigen Belegungsstand mit dem Stand vor ~LOOKBACK Tagen
        für denselben Aufenthaltstag. Wurde der Tag seither belegt (0→1), ist das
        ein schneller Pickup → positives Signal; war er schon belegt, neutral.
        Ohne Vergleichs-Snapshot (frische DB) → kein Eintrag → Engine neutral.

        Rückgabe: ISO-Aufenthaltsdatum → velocity in grob [-1, +1]. Die
        eigentliche Reaktion deckelt die Engine über die Auslastungs-Caps."""
        ref_day = today - timedelta(days=self._PICKUP_LOOKBACK_DAYS)
        try:
            rows = (
                self._db()
                .table("dp_pickup_snapshots")
                .select("stay_date, booked")
                .eq("property_id", property_id)
                .eq("snapshot_date", ref_day.isoformat())
                .gte("stay_date", start.isoformat())
                .lt("stay_date", end.isoformat())
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.warning("pickup_velocity_read_failed", error=str(exc))
            return {}
        # Belegt-Stand des Referenztags je Aufenthaltsdatum.
        was_booked = {r["stay_date"]: bool(r.get("booked")) for r in rows}
        out: dict[str, float] = {}
        # Aktuellen Stand laden (heute), um die Veränderung zu messen.
        booked_now = self._booked_dates(property_id, start, end)
        for iso, prev in was_booked.items():
            now = iso in booked_now
            if now and not prev:
                out[iso] = 1.0   # seit dem Referenztag neu gebucht → schneller Pickup
            elif not now and not prev:
                out[iso] = -0.25  # weiterhin frei → leicht langsamer als „normal"
            # bereits zuvor belegt → kein Velocity-Signal (neutral, nicht gesetzt)
        return out

    # -- KI-Forecast (Roadmap-Phase 4) --------------------------------------
    # Wie weit zurück Snapshots fürs Kurven-Lernen geladen werden (Tage). Mehr
    # Historie = stabilere Kurve; gedeckelt, um die Abfrage klein zu halten.
    _FORECAST_TRAIN_DAYS = 365

    def _forecast_velocity_by_date(
        self, property_id: str, today: date, start: date, end: date
    ) -> dict[str, float]:
        """KI-Forecast-Velocity je Aufenthaltstag aus der gelernten Pickup-Kurve.

        Trainiert das PickupCurveModel aus der Snapshot-Historie des Objekts und
        vergleicht den heutigen Belegungs-Ist je Aufenthaltstag mit der erwarteten
        Belegung bei diesem Vorlauf. Über Erwartung → positives Signal (Aufschlag),
        darunter → negatives. Ungelernte Zellen (Cold-Start) liefern KEIN Signal
        (kein Eintrag) — die Engine bleibt dort neutral (keine Fallbacks).

        Ersetzt das grobe Lookback-Velocity-Signal (Phase 2), wo die Kurve trägt;
        wo nicht, greift weiter das Lookback-Signal."""
        from .forecast import PickupCurveModel, PickupObservation

        train_from = today - timedelta(days=self._FORECAST_TRAIN_DAYS)
        # VOLLSTÄNDIG paginiert laden (fetch_all_rows): ein Objekt schreibt pro
        # Recompute je Tag im Horizont (bis 540 Tage) einen Snapshot, die 365-Tage-
        # Trainingsmenge übersteigt das PostgREST-Default-Limit (1000 Zeilen) also
        # bei weitem. Ohne Pagination würde die Kurve stillschweigend auf einem
        # willkürlichen 1000-Zeilen-Ausschnitt trainieren → verzerrte Velocity.
        try:
            rows = fetch_all_rows(
                self._db()
                .table("dp_pickup_snapshots")
                .select("stay_date, days_before, booked")
                .eq("property_id", property_id)
                .gte("snapshot_date", train_from.isoformat())
                .order("id")  # eindeutig → stabile Pagination
            )
        except Exception as exc:  # noqa: BLE001 — Forecast ist best-effort
            log.warning("forecast_train_read_failed", error=str(exc))
            return {}
        observations = [
            PickupObservation(
                stay_date=_as_date(r["stay_date"]),
                days_before=int(r.get("days_before") or 0),
                booked=bool(r.get("booked")),
            )
            for r in rows
            if r.get("stay_date") is not None
        ]
        if not observations:
            return {}
        model = PickupCurveModel().train(observations)
        if not model.is_trained:
            return {}
        booked_now = self._booked_dates(property_id, start, end)
        out: dict[str, float] = {}
        cur = start
        while cur < end:
            iso = cur.isoformat()
            v = model.forecast_velocity(
                stay=cur,
                days_before=(cur - today).days,
                occupied_now=iso in booked_now,
            )
            if v is not None:
                out[iso] = v
            cur += timedelta(days=1)
        return out

    # -- Wetter (RateBoard-Baustein) ----------------------------------------
    def _weather_by_date(
        self,
        property_id: str,
        settings: DpSettings,
        today: date,
        start: date,
        end: date,
    ) -> dict[str, float]:
        """Wetter-Score je Anreisetag aus DWD/Bright Sky — nur wenn der Vermieter
        Wetter aktiviert hat (weather_enabled) UND das Objekt Koordinaten hat.
        Ferne Tage (außerhalb Forecast-Horizont) bleiben ohne Score → neutral."""
        if not settings.weather_enabled:
            return {}
        lat, lng = self._coords_for_property(property_id)
        if lat is None or lng is None:
            return {}
        from .weather import WeatherProvider

        days: list[date] = []
        cur = start
        while cur < end:
            days.append(cur)
            cur += timedelta(days=1)
        try:
            return WeatherProvider().weather_scores(lat, lng, days, today)
        except Exception as exc:  # noqa: BLE001 — Wetter ist best-effort
            log.warning("weather_signal_failed", error=str(exc))
            return {}

    def _coords_for_property(
        self, property_id: str
    ) -> tuple[float | None, float | None]:
        res = (
            self._db()
            .table("properties")
            .select("lat, lng")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not res:
            return None, None
        row = res[0]
        lat = row.get("lat")
        lng = row.get("lng")
        return (
            float(lat) if lat is not None else None,
            float(lng) if lng is not None else None,
        )

    # -- Quellen laden -------------------------------------------------------
    def _feiertage_by_date(
        self, property_id: str, settings: DpSettings, start: date, end: date
    ) -> dict[str, dict[str, bool]]:
        """Feiertage/Ferien je Tag — nur wenn ein Aufschlag eingestellt ist,
        sonst wird gar nicht erst gelesen. Laender: Objektland + Quellmaerkte
        (`dp_settings.quellmaerkte`)."""
        if settings.feiertag_uplift_pct <= 0 and settings.ferien_uplift_pct <= 0:
            return {}
        laender: list[str] = []
        land = objektland(self._db(), property_id)
        if land:
            laender.append(land)
        row = self._settings_row or {}
        laender.extend(str(c) for c in (row.get("quellmaerkte") or []) if c)
        if not laender:
            log.info("dp_feiertage_ohne_land", property_id=property_id)
            return {}
        return feiertage_je_tag(self._db(), laender, start, end)

    def _load_settings(self, property_id: str) -> DpSettings:
        res = (
            self._db()
            .table("dp_settings")
            .select("*")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        self._settings_row = res[0] if res else None
        return DpSettings.from_row(self._settings_row)

    def _load_base_price(self, property_id: str) -> float | None:
        res = (
            self._db()
            .table("rate_plans")
            .select("base_price")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        if not res or res[0].get("base_price") is None:
            return None
        try:
            return float(res[0]["base_price"])
        except (TypeError, ValueError):
            return None

    def _modul_gebucht(self, property_id: str) -> bool:
        """Hat der Betrieb des Objekts das Modul „Dynamische Preise" gebucht?

        Fail-CLOSED (Wurzel 5): ohne auflösbaren Tenant oder ohne aktive
        Entitlement-Zeile wird NICHT gerechnet. Eine stillschweigend erbrachte
        Leistung wäre nie abrechenbar — der Betrieb sieht stattdessen, dass das
        Modul fehlt.
        """
        tenant_id = self._tenant_for_property(property_id)
        if not tenant_id:
            log.info("dynamic_pricing_skip_kein_tenant", property_id=property_id)
            return False
        if not modul_aktiv(self._db(), tenant_id, DYNPRICING_MODULE_KEY):
            log.info(
                "dynamic_pricing_skip_modul_nicht_gebucht",
                property_id=property_id,
                tenant_id=tenant_id,
            )
            return False
        return True

    def _tenant_for_property(self, property_id: str) -> str | None:
        res = (
            self._db()
            .table("properties")
            .select("tenant_id")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return res[0].get("tenant_id") if res else None

    def _event_pct_by_date(
        self, tenant_id: str | None, start: date, end: date,
        property_id: str | None = None,
    ) -> dict[str, float]:
        """Event-Aufschlag je Tag. events(tenant) → event_periods.

        Seit 0583 trägt ein Event eine Objektzuweisung
        (`event_property_assignments`): OHNE Zeile gilt es für alle Objekte des
        Mandanten, MIT Zeilen nur für die genannten. Ein Event ohne
        Zuweisung und ein Event, das dieses Objekt nennt, zählen — ein Event,
        das ANDERE Objekte nennt, nicht (die „DANA CUP" in Hjørring hob vorher
        auch den Preis auf Bornholm).
        """
        if not tenant_id:
            return {}
        events = (
            self._db()
            .table("events")
            .select("id, percent")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        pct_by_event = {e["id"]: float(e.get("percent") or 0) for e in events}
        if not pct_by_event:
            return {}
        assigns = (
            self._db()
            .table("event_property_assignments")
            .select("event_id, property_id")
            .in_("event_id", list(pct_by_event.keys()))
            .execute()
        ).data or []
        zugewiesen: dict[str, set[str]] = {}
        for a in assigns:
            zugewiesen.setdefault(a["event_id"], set()).add(a["property_id"])
        pct_by_event = {
            eid: pct for eid, pct in pct_by_event.items()
            if eid not in zugewiesen or property_id in zugewiesen[eid]
        }
        if not pct_by_event:
            return {}
        periods = (
            self._db()
            .table("event_periods")
            .select("event_id, start_date, end_date")
            .in_("event_id", list(pct_by_event.keys()))
            .execute()
        ).data or []
        return self._spread_periods(periods, pct_by_event, "event_id", start, end)

    @staticmethod
    def _spread_periods(
        periods: list[dict],
        pct_by_id: dict[str, float],
        id_key: str,
        start: date,
        end: date,
    ) -> dict[str, float]:
        """Perioden auf Tage verteilen; überlappende Perioden → höchster Aufschlag."""
        out: dict[str, float] = {}
        for p in periods:
            pct = pct_by_id.get(p.get(id_key))
            if pct is None:
                continue
            p_start = max(start, _as_date(p["start_date"]))
            p_end = min(end - timedelta(days=1), _as_date(p["end_date"]))
            cur = p_start
            while cur <= p_end:
                key = cur.isoformat()
                out[key] = max(out.get(key, 0.0), pct)
                cur += timedelta(days=1)
        return out

    def _booked_dates(self, property_id: str, start: date, end: date) -> set[str]:
        """Belegte/gesperrte Tage als ISO-Set — aus ZWEI Quellen kombiniert:

        (1) availability.status != open (Sperren/Sync-Status), UND
        (2) aktive Reservierungen (status confirmed/pending), aufgelöst über
            check_in..check_out (check_out exklusiv = Abreisetag wieder frei).

        Reservierungen sind die Buchungs-Wahrheit; availability ist davon
        abgeleitet und kann je nach Sync lückenhaft sein. Läse die Engine nur
        availability, wäre sie bei nicht-gespiegelten Buchungen blind und ergäbe
        fälschlich „leer → Rabatt". cancelled zählt NICHT als belegt."""
        booked: set[str] = set()
        avail = (
            self._db()
            .table("availability")
            .select("date, status")
            .eq("property_id", property_id)
            .gte("date", start.isoformat())
            .lt("date", end.isoformat())
            .execute()
        ).data or []
        booked |= {
            r["date"] for r in avail if r.get("status") and r["status"] != "open"
        }
        res = (
            self._db()
            .table("reservations")
            .select("check_in, check_out, status")
            .eq("property_id", property_id)
            .lt("check_in", end.isoformat())
            .gte("check_out", start.isoformat())
            .execute()
        ).data or []
        for r in res:
            if (r.get("status") or "").lower() == "cancelled":
                continue
            try:
                ci = _as_date(r["check_in"])
                co = _as_date(r["check_out"])
            except (KeyError, ValueError, TypeError):
                continue
            cur = max(ci, start)
            stop = min(co, end)
            while cur < stop:
                booked.add(cur.isoformat())
                cur += timedelta(days=1)
        return booked

    # -- Signal-Ableitung ----------------------------------------------------
    @staticmethod
    def _occupancy_signal(day: date, booked: set[str], today: date) -> float:
        """Auslastung im Vorlauf-Fenster um den Tag (Anteil belegter Tage, 0..1).

        NUR zukünftige Tage zählen (ab `today`): die Belegung, die einen künftigen
        Preis treibt, ist die noch buchbare/schon gebuchte ZUKUNFT. Vergangene
        Belegung ist für die Preissetzung irrelevant und würde den Faktor sonst
        verfälschen (ein künftig leeres Objekt sähe wegen alter Buchungen „voll"
        aus). Fenster: [max(day−half, today) .. day+half]."""
        half = _OCCUPANCY_WINDOW // 2
        start = max(day - timedelta(days=half), today)
        last = day + timedelta(days=half)
        if last < start:
            return 0.0
        total = 0
        taken = 0
        cur = start
        while cur <= last:
            total += 1
            if cur.isoformat() in booked:
                taken += 1
            cur += timedelta(days=1)
        return taken / total if total else 0.0

    @staticmethod
    def _is_orphan_gap(day: date, booked: set[str]) -> bool:
        """True, wenn dieser freie Tag in einer 1–2-Nächte-Lücke zwischen zwei
        Belegungen liegt (schwer einzeln zu füllen → Rabatt)."""
        if day.isoformat() in booked:
            return False
        prev1 = (day - timedelta(days=1)).isoformat() in booked
        next1 = (day + timedelta(days=1)).isoformat() in booked
        # 1-Nacht-Lücke: beide Nachbarn belegt.
        if prev1 and next1:
            return True
        # 2-Nächte-Lücke: ein Nachbar belegt, der übernächste auf der anderen
        # Seite ebenfalls (day ist Teil einer genau-2-Tage-Lücke).
        next2 = (day + timedelta(days=2)).isoformat() in booked
        prev2 = (day - timedelta(days=2)).isoformat() in booked
        free_next = (day + timedelta(days=1)).isoformat() not in booked
        free_prev = (day - timedelta(days=1)).isoformat() not in booked
        if prev1 and free_next and next2:
            return True
        return bool(next1 and free_prev and prev2)

    # -- Verteilung ----------------------------------------------------------
    def _apply_overrides(  # noqa: F811  # verwaist, siehe Docstring
        self, property_id: str, rows: list[dict]
    ) -> list[dict]:
        """VERWAIST — hat seit dem 04.09.2026 keinen Aufrufer mehr.

        Überlagerte die berechneten Tagespreise vor dem Channex-Push mit
        `price_overrides` (alte Rangfolge override > dynamic). Genau das ist
        entfallen: bei eingeschaltetem Dynamic Pricing gewinnt jetzt der
        berechnete Preis, sonst wird gar nicht erst gerechnet. Nicht wieder
        einhängen, ohne die Rangfolge in `PricingResolver._effective_for_day`
        gleichzeitig zu ändern — sonst widersprechen sich Anzeige und Portal-Push.

        Bleibt vorerst stehen (kein Löschauftrag)."""
        span = [_as_date(r["date"]) for r in rows]
        overrides = (
            self._db()
            .table("price_overrides")
            .select("date, price")
            .eq("property_id", property_id)
            .gte("date", min(span).isoformat())
            .lte("date", max(span).isoformat())
            .not_.is_("price", "null")
            .execute()
        ).data or []
        by_date = {
            o["date"]: float(o["price"])
            for o in overrides
            if o.get("date") and o.get("price") is not None
        }
        if not by_date:
            return rows
        return [
            {**r, "price": by_date[r["date"]]} if r["date"] in by_date else r
            for r in rows
        ]

    def _dp_rate_plan_id(self) -> str | None:
        """Auf welchen Ratenplan DP wirkt (0562). None = alle Plaene des Objekts."""
        row = self._settings_row or {}
        rp = row.get("rate_plan_id")
        return str(rp) if rp else None

    def _push_to_channex(
        self,
        tenant_id: str | None,
        property_id: str,
        rows: list[dict],
        *,
        rate_plan_id: str | None = None,
    ) -> bool:
        """Geänderte Tage als Restrictions (Preis in Cent + Min-Stay) an Channex
        pushen. Run-Length-Encoding: aufeinanderfolgende Tage mit gleichem
        (price, min_stay) werden zu einem Intervall gebündelt. Best-effort —
        Fehler dürfen das Schreiben nicht kippen (reconcile-Cron gleicht ab).

        True = die Absicht liegt in der Outbox (übergeben), False = nichts
        übergeben. Der Aufrufer stempelt nur bei True."""
        if not tenant_id or self._client is None or not rows:
            return False
        # KEINE Überlagerung mit price_overrides mehr: hierher kommt man nur aus
        # `recompute_property`, das bei `not settings.enabled` schon vorher
        # abbricht — an dieser Stelle ist Dynamic Pricing also per Definition AN,
        # und dann gilt der berechnete Preis. Würde hier weiter der manuelle
        # Tagespreis daraufgelegt, ginge an die Portale genau der Wert, den der
        # Autopilot ersetzen soll (live belegt am 04.09.2026: ein Saisonpreis von
        # 577,50 DKK vom 07.08. verdeckte die berechneten 569–715 DKK).
        # Der Resolver hält dieselbe Rangfolge (`_effective_for_day`); die
        # price_overrides-Zeilen bleiben unangetastet und greifen sofort wieder,
        # sobald die Agentur Dynamic Pricing abschaltet.
        try:
            from src.features.channel_manager.channex_client import (
                ChannexBudgetExhausted,
                ChannexClient,
            )
            from src.features.channel_manager.service import ChannelManagerService

            # Budget-gebundener Channex-Client (falls der Worker ein Budget durch-
            # reicht), damit jeder Rate-Push ein Token zieht (kein Umgehen des
            # kontoweiten Limits). Ohne Budget → unveränderter Client.
            before_call = (
                self._channex_budget.try_consume
                if self._channex_budget is not None
                else None
            )
            cm = ChannelManagerService(
                service_client=self._client,
                channex=ChannexClient(before_call=before_call),
            )
            ordered = sorted(rows, key=lambda r: r["date"])
            # RLE: aufeinanderfolgende Tage mit gleichem (price, min_stay) zu
            # einem Intervall bündeln, dann ALLE Intervalle in EINEM gebatchten
            # Channex-Push schicken (statt pro Intervall ein Request → 429-Flut).
            segments: list[dict] = []
            seg_start = 0
            for i in range(1, len(ordered) + 1):
                same = (
                    i < len(ordered)
                    and ordered[i]["price"] == ordered[seg_start]["price"]
                    and ordered[i]["min_stay"] == ordered[seg_start]["min_stay"]
                    and _as_date(ordered[i]["date"])
                    == _as_date(ordered[i - 1]["date"]) + timedelta(days=1)
                )
                if same:
                    continue
                first = ordered[seg_start]
                last = ordered[i - 1]
                segment = {
                    "date_from": _as_date(first["date"]),
                    "date_to": _as_date(last["date"]),  # inklusiv
                    "rate_cents": round(float(first["price"]) * 100),
                    "min_stay": first.get("min_stay"),
                }
                # DP je Ratenplan (0562): mit rate_plan_id pusht
                # `push_rates_batch` NUR an diesen Plan; ohne an alle.
                if rate_plan_id:
                    segment["rate_plan_id"] = rate_plan_id
                segments.append(segment)
                seg_start = i
            cm.push_rates_batch(tenant_id, property_id, segments)
            return True
        except ChannexBudgetExhausted:
            # MUSS bis _run_job durchschlagen, damit der Job DEFERRED wird (statt
            # fälschlich 'done'): das kontoweite Channex-Budget ist erschöpft, der
            # Rate-Push soll nach retry_after ab dem erledigten Punkt weiterlaufen.
            # Das breite except unten würde ihn sonst als „best-effort-Fehler"
            # schlucken → die neu berechneten Preise erreichen Channex nie.
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "dynamic_pricing_channex_push_failed",
                property_id=property_id,
                error=str(exc),
            )
            return False
