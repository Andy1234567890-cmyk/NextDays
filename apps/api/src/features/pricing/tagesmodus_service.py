"""Tagesmodus je Zeitraum + Freigabe der berechneten Preise.

ZWEI FRAGEN, EINE DATEI
=======================
Beide beantworten "wer entscheidet, welcher Preis rausgeht":

  * TAGESMODUS — was gilt an einem bestimmten Tag? Der berechnete Preis
    ('dynamisch'), derselbe mit einem Auf-/Abschlag ('anpassung') oder ein
    fester Betrag ('manuell'). Vorher war das eine Ganz-oder-gar-nicht-Frage
    je Objekt: wer für eine Woche 10 % drauflegen wollte, musste entweder
    einen festen Preis eintragen (dann rechnet die Automatik dort nie wieder)
    oder die globale Regel verbiegen (dann gilt sie überall).

  * FREIGABE — gehen berechnete Preise sofort an die Portale, oder erst nach
    einem Blick darauf? Die Zahl landet bei Airbnb und Booking; ein Fehler ist
    dort sofort öffentlich und verkauft.

WARUM 'manuell' KEINEN EIGENEN PREISSPEICHER HAT
================================================
Der feste Preis geht in `price_overrides` — dieselbe Tabelle wie jeder von
Hand gesetzte Tagespreis. Ein zweiter Speicher für "manuell im DP-Kalender"
wäre eine zweite Wahrheit, und die Frage "welcher gilt?" müsste an jeder
Lesestelle neu beantwortet werden (Wurzel 1: ein Zustand, eine Quelle).
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.owner_scope import is_owner

from .resolver import PricingError

log = get_logger("nextdays.pricing.tagesmodus")

# Obergrenze je Aufruf. Wurzel 8: ein unbegrenzter Datumsbereich ist ein
# Angriff (und ein Versehen: ein vertippter Endtermin in ferner Zukunft würde
# hunderttausende Zeilen schreiben).
_MAX_TAGE = 400

_MODI = ("dynamisch", "anpassung", "manuell")


class TagesmodusService:
    """Setzt den Tagesmodus für einen Zeitraum und gibt Preise frei."""

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise PricingError("Preis-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_own_property(self, ctx: AuthContext, property_id: str) -> None:
        """Wurzel 3: Service-Role umgeht RLS — Eigentum explizit prüfen."""
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
        # §4.2: Eigentümer sehen nur zugeordnete Objekte und ändern nichts.
        if is_owner(ctx):
            raise PricingError(
                "Eigentümer können Preise nicht ändern.", status_code=403
            )

    @staticmethod
    def _zeitraum_pruefen(von: date, bis: date) -> list[date]:
        """Tage von `von` bis einschliesslich `bis` — mit harter Obergrenze."""
        if bis < von:
            raise PricingError(
                "Das Enddatum liegt vor dem Startdatum.", status_code=422
            )
        tage = (bis - von).days + 1
        if tage > _MAX_TAGE:
            raise PricingError(
                f"Höchstens {_MAX_TAGE} Tage auf einmal (angefragt: {tage}).",
                status_code=422,
            )
        return [von + timedelta(days=i) for i in range(tage)]

    # -- Tagesmodus setzen ----------------------------------------------------
    def setzen(
        self,
        ctx: AuthContext,
        property_id: str,
        *,
        von: date,
        bis: date,
        modus: str,
        adjust_pct: float | None = None,
        preis: float | None = None,
    ) -> int:
        """Modus für jeden Tag im Zeitraum setzen. Gibt die Tagesanzahl zurück.

        Der Gegenzustand wird mitgepflegt (Wurzel 1): ein Wechsel VON 'manuell'
        WEG muss den Override entfernen, sonst gewänne der alte feste Preis
        weiter gegen die Automatik — der Nutzer hätte "dynamisch" gewählt und
        bekäme unverändert den Handpreis.
        """
        self._require_own_property(ctx, property_id)
        if modus not in _MODI:
            raise PricingError(
                f"Unbekannter Modus '{modus}'. Erlaubt: {', '.join(_MODI)}.",
                status_code=422,
            )
        tage = self._zeitraum_pruefen(von, bis)

        if modus == "anpassung":
            if adjust_pct is None:
                raise PricingError(
                    "Für eine Anpassung fehlt der Prozentwert.", status_code=422
                )
            # Grenzen deckungsgleich mit dem DB-CHECK aus 0554 — sonst wirft
            # die Datenbank einen 500 auf etwas, das hier durchging.
            if not -90 <= adjust_pct <= 300:
                raise PricingError(
                    "Die Anpassung muss zwischen -90 % und +300 % liegen.",
                    status_code=422,
                )
        if modus == "manuell" and (preis is None or preis < 0):
            raise PricingError(
                "Für einen festen Preis fehlt der Betrag.", status_code=422
            )

        vorher_manuell = self._manuelle_tage(property_id, von, bis)

        if modus == "dynamisch":
            # Standard braucht keine Zeile — die Abwesenheit IST der Standard.
            self._db().table("dp_day_modes").delete().eq(
                "property_id", property_id
            ).gte("date", von.isoformat()).lte("date", bis.isoformat()).execute()
        else:
            self._db().table("dp_day_modes").upsert(
                [
                    {
                        "property_id": property_id,
                        "date": t.isoformat(),
                        "modus": modus,
                        "adjust_pct": adjust_pct if modus == "anpassung" else None,
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                    for t in tage
                ],
                on_conflict="property_id,date",
            ).execute()

        if modus == "manuell":
            self._override_setzen(property_id, tage, float(preis or 0))
        elif vorher_manuell:
            # Gegenzustand: die Tage, die eben noch manuell waren, geben ihren
            # festen Preis zurück. Ohne das bliebe er liegen und schlüge die
            # gerade gewählte Automatik.
            self._override_entfernen(property_id, vorher_manuell)

        log.info(
            "dp_tagesmodus_gesetzt",
            property_id=property_id,
            modus=modus,
            tage=len(tage),
            von=von.isoformat(),
            bis=bis.isoformat(),
            adjust_pct=adjust_pct,
            overrides_geloest=len(vorher_manuell) if modus != "manuell" else 0,
        )
        return len(tage)

    def _manuelle_tage(
        self, property_id: str, von: date, bis: date
    ) -> list[str]:
        """ISO-Tage im Zeitraum, die aktuell auf 'manuell' stehen."""
        res = (
            self._db()
            .table("dp_day_modes")
            .select("date")
            .eq("property_id", property_id)
            .eq("modus", "manuell")
            .gte("date", von.isoformat())
            .lte("date", bis.isoformat())
            .execute()
        ).data or []
        return [r["date"] for r in res if isinstance(r.get("date"), str)]

    def _override_setzen(
        self, property_id: str, tage: list[date], preis: float
    ) -> None:
        self._db().table("price_overrides").upsert(
            [
                {
                    "property_id": property_id,
                    "date": t.isoformat(),
                    "price": preis,
                }
                for t in tage
            ],
            on_conflict="property_id,date",
        ).execute()

    def _override_entfernen(self, property_id: str, iso_tage: list[str]) -> None:
        self._db().table("price_overrides").delete().eq(
            "property_id", property_id
        ).in_("date", iso_tage).execute()

    def lesen(
        self, ctx: AuthContext, property_id: str, von: date, bis: date
    ) -> dict[str, dict]:
        """Gesetzte Tagesmodi im Zeitraum ({ISO: {modus, adjust_pct}}).

        Tage ohne Eintrag fehlen bewusst in der Antwort — sie sind
        'dynamisch', und das Frontend soll den Standard nicht als Sonderfall
        anzeigen müssen.
        """
        self._require_own_property(ctx, property_id)
        res = (
            self._db()
            .table("dp_day_modes")
            .select("date, modus, adjust_pct")
            .eq("property_id", property_id)
            .gte("date", von.isoformat())
            .lte("date", bis.isoformat())
            .execute()
        ).data or []
        return {r["date"]: r for r in res if isinstance(r.get("date"), str)}

    # -- Freigabe -------------------------------------------------------------
    def offene_anzahl(self, ctx: AuthContext, property_id: str) -> int:
        """Wie viele berechnete Tage warten auf die Freigabe?"""
        self._require_own_property(ctx, property_id)
        heute = datetime.now(UTC).date()
        res = (
            self._db()
            .table("dynamic_prices")
            .select("date", count="exact")
            .eq("property_id", property_id)
            .is_("gesendet_am", "null")
            .gte("date", heute.isoformat())
            .execute()
        )
        return int(res.count or 0)

    def freigeben(self, ctx: AuthContext, property_id: str) -> int:
        """Alle wartenden Preise freigeben und an die Portale schicken.

        Idempotent (Wurzel 2): freigegeben wird nur, was `gesendet_am is null`
        hat. Ein zweiter Klick — Doppelklick, Retry, zwei offene Tabs — findet
        nichts mehr und schickt nichts erneut.
        """
        self._require_own_property(ctx, property_id)
        heute = datetime.now(UTC).date()
        offen = (
            self._db()
            .table("dynamic_prices")
            .select("date")
            .eq("property_id", property_id)
            .is_("gesendet_am", "null")
            .gte("date", heute.isoformat())
            .execute()
        ).data or []
        if not offen:
            return 0

        # ERST stempeln, DANN pushen: der Push liest die Soll-Kurve über den
        # Resolver, und der gibt bei Freigabepflicht nur gestempelte Tage
        # heraus. Andersherum stünde die Kurve beim Push noch leer da.
        self._db().table("dynamic_prices").update(
            {"gesendet_am": datetime.now(UTC).isoformat()}
        ).eq("property_id", property_id).is_("gesendet_am", "null").gte(
            "date", heute.isoformat()
        ).execute()

        from src.jobs.queue import try_enqueue_recompute  # noqa: PLC0415

        if ctx.tenant_id:
            # Als JOB, nicht synchron: der Worker fährt den Channex-Push mit
            # Token-Budget (kein Umgehen des kontoweiten Limits).
            try_enqueue_recompute(self._db(), ctx.tenant_id, property_id)

        log.info(
            "dp_preise_freigegeben", property_id=property_id, tage=len(offen)
        )
        return len(offen)
