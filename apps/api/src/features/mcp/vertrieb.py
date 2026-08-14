"""Preise, Saisons, Zusatzleistungen und Kartei als MCP-Werkzeuge.

Die zweite Hälfte der Objektpflege: was in der Oberfläche unter den Reitern
Preise, Saisonpreise, Zusatzleistungen und Kartei liegt. Die Stammdaten
(Übersicht, Standort, Fotos, Zimmer) stehen in `stammdaten.py`, die RECHTE
für beide in der Registry in `tools.py`.

DREI DINGE, DIE HIER ANDERS SIND ALS BEI DEN STAMMDATEN:

* Die Saison-Methoden nehmen `tenant_id: str`, nicht `AuthContext` — sie
  prüfen also weder Rolle noch Objekt-Scope. Der Riegel in `tools.py` ist
  dort die einzige Schranke.
* Die Kartei (`property_dossier`) nimmt den Kontext im KONSTRUKTOR und prüft
  damit selbst den Objekt-Scope (`is_owner`/`is_staff`). Sie muss deshalb
  `self.ctx()` bekommen — mit `role=None` wäre der Scope still übersprungen,
  und in der Kartei stehen IBAN, Steuer-ID und CPR-Nummer.
* Preise, Saisons und Rabatte gehen an die Portale, die Kartei nicht. Sie ist
  ein internes Betriebshandbuch.
"""
from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, Any

from pydantic import ValidationError

from src.features.addons.service import AddonError, AddonsService
from src.features.calendar.schemas import DateRange
from src.features.calendar.service import CalendarError, CalendarService
from src.features.property_discounts.service import (
    DiscountError,
    PropertyDiscountsService,
)
from src.features.property_dossier.service import (
    DossierError,
    PropertyDossierService,
)
from src.features.rates.service import RateError, RatesService

from .grenzen import MAX_ADDONS, MAX_RABATTE, MAX_SAISONS
from .helfer import _pflicht, _validierung_lesbar

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import AuthContext

# Die Abschnitte der Kartei — je einer ein Schritt im Kartei-Assistenten.
# Abgelesen aus den Routen (`PUT /property-dossier/{pid}/<abschnitt>`), nicht
# geraten: ein erfundener Name wäre ein Abschnitt ohne Oberfläche.
_KARTEI_ABSCHNITTE = ("process", "access", "emergency_authority",
                      "marketing", "housebook")


class VertriebMixin:
    """Werkzeuge für Preise, Saisons, Zusatzleistungen und Kartei.

    Erwartet vom Träger (`McpTools`): `_db`, `ctx()`, `_tenant()`
    und `_schreib_zeitraum()`.
    """

    # Der Träger (`McpTools`) stellt diese drei bereit. Sie werfen hier, statt
    # `...` zurückzugeben: ein leerer Rumpf sähe für die Prüfwerkzeuge wie
    # „gibt None zurück" aus, und jede Zuweisung des Ergebnisses wäre ein
    # Fehlbefund. Erreicht wird der Rumpf nie — `McpTools` überschreibt alle
    # drei; wer das Mixin allein verwendet, soll es sofort merken.
    _db: Any

    def ctx(self) -> AuthContext:
        raise NotImplementedError("Vom Träger bereitzustellen.")

    def _tenant(self) -> str:
        raise NotImplementedError("Vom Träger bereitzustellen.")

    def _schreib_zeitraum(self, args: dict[str, Any]) -> DateRange:
        raise NotImplementedError("Vom Träger bereitzustellen.")

    # -- Preise und Raten ---------------------------------------------------

    def _raten_service(self) -> RatesService:
        return RatesService(service_client=self._db)

    def _objektwaehrung(self, objekt_id: str) -> str:
        """Die Währung DES OBJEKTS — nie eine geratene (Wurzel 4).

        In 27 EU-Ländern wäre ein voreingestelltes „EUR" schlicht falsch, und
        ein falscher Währungscode am Preisplan geht als falscher Preis an die
        Portale. Fehlt sie, ist das ein Datenfehler und wird als solcher
        gemeldet.
        """
        zeile = (
            self._db.table("properties")
            .select("currency")
            .eq("id", objekt_id)
            .eq("tenant_id", self._tenant())
            .limit(1)
            .execute()
        ).data
        waehrung = str((zeile[0] if zeile else {}).get("currency") or "")
        if not waehrung:
            raise ValueError(
                "Das Objekt hat keine Währung. Sie muss zuerst gesetzt werden "
                "(objekt_aendern mit currency), sonst wäre jeder Preis "
                "mehrdeutig."
            )
        return waehrung

    def _raten(self, args: dict[str, Any]) -> dict[str, Any]:
        try:
            out = self._raten_service().list(
                self.ctx(), _pflicht(args, "objekt_id")
            )
        except RateError as exc:
            raise ValueError(exc.message) from exc
        return {
            "anzahl": len(out.items),
            "raten": [r.model_dump(mode="json") for r in out.items],
        }

    def _grundpreis_setzen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.rates.schemas import RatePlanCreate

        objekt_id = _pflicht(args, "objekt_id")
        preis = args.get("preis")
        if preis is None:
            raise ValueError("preis fehlt")
        # Die Währung ist im Schema PFLICHT und darf nicht geraten werden
        # (Wurzel 4). Sie steht am Objekt — fehlt sie dort, ist das ein
        # Datenfehler, der benannt gehört, kein Fall für „EUR".
        waehrung = str(args.get("waehrung") or "") or self._objektwaehrung(objekt_id)
        try:
            plan = self._raten_service().set_base_price(
                self.ctx(),
                RatePlanCreate(
                    property_id=objekt_id,
                    base_price=float(preis),
                    currency=waehrung,
                ),
            )
        except RateError as exc:
            # 409, wenn das Objekt mehrere Preispläne hat — dann ist der
            # Grundpreis nicht eindeutig und muss je Plan gesetzt werden.
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {
            "objekt_id": objekt_id,
            "rate_id": plan.id,
            "grundpreis": preis,
            "hinweis": "Der Grundpreis ist an die Portale gemeldet.",
        }

    def _tagespreise_setzen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.rates.schemas import RatePlanPriceSet

        rate_id = _pflicht(args, "rate_id")
        rng = self._schreib_zeitraum(args)
        preis = args.get("preis")
        if preis is None:
            raise ValueError("preis fehlt")
        try:
            out = self._raten_service().set_prices(
                self.ctx(), rate_id,
                RatePlanPriceSet(start=rng.start, end=rng.end, price=float(preis)),
            )
        except RateError as exc:
            # Abgeleitete Raten haben keinen eigenen Preis — das ist eine
            # fachliche Aussage, kein technischer Fehler.
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {
            "rate_id": rate_id,
            "gesetzte_tage": len(out.items),
            "hinweis": "Die Preise sind an die Portale gemeldet.",
        }

    def _mindestaufenthalt_setzen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.rates.schemas import RatePlanMinStaySet

        rate_id = _pflicht(args, "rate_id")
        rng = self._schreib_zeitraum(args)
        naechte = args.get("naechte")
        if naechte is None:
            raise ValueError("naechte fehlt")
        try:
            out = self._raten_service().set_min_stays(
                self.ctx(), rate_id,
                RatePlanMinStaySet(
                    start=rng.start, end=rng.end, min_stay=int(naechte)
                ),
            )
        except RateError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {
            "rate_id": rate_id,
            "gesetzte_tage": len(out.items),
            "hinweis": "Der Mindestaufenthalt ist an die Portale gemeldet.",
        }

    # -- Saisonpreise -------------------------------------------------------

    def _kalender_service(self) -> CalendarService:
        return CalendarService(client=self._db)

    def _saisons(self, args: dict[str, Any]) -> dict[str, Any]:
        try:
            saisons = self._kalender_service().list_seasons(
                self.ctx(), _pflicht(args, "objekt_id")
            )
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {"anzahl": len(saisons), "saisons": saisons[:MAX_SAISONS]}

    def _saison_anlegen(self, args: dict[str, Any]) -> dict[str, Any]:
        modus = str(args.get("modus") or "fixed")
        if modus not in {"fixed", "percent"}:
            raise ValueError("modus muss 'fixed' oder 'percent' sein")
        betrag = args.get("betrag")
        if betrag is None:
            raise ValueError("betrag fehlt")
        try:
            saison = self._kalender_service().create_season(
                self._tenant(), _pflicht(args, "objekt_id"),
                name=_pflicht(args, "name"),
                # Die Farbe ist reine Anzeige im Kalender; ohne Angabe ein
                # neutrales Grau statt einer geratenen Bedeutung.
                color=str(args.get("farbe") or "#94a3b8"),
                mode=modus,
                amount=float(betrag),
            )
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {"saison": saison, "angelegt": True}

    def _saison_aendern(self, args: dict[str, Any]) -> dict[str, Any]:
        patch: dict[str, Any] = {}
        for arg, spalte in (("name", "name"), ("farbe", "color"),
                            ("modus", "mode"), ("betrag", "amount")):
            if args.get(arg) is not None:
                patch[spalte] = args[arg]
        if not patch:
            raise ValueError("Keine Änderung angegeben.")
        try:
            saison = self._kalender_service().update_season(
                self._tenant(), _pflicht(args, "saison_id"), patch
            )
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {"saison": saison, "geaendert": sorted(patch)}

    def _saison_loeschen(self, args: dict[str, Any]) -> dict[str, Any]:
        saison_id = _pflicht(args, "saison_id")
        try:
            self._kalender_service().delete_season(self._tenant(), saison_id)
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {"saison_id": saison_id, "geloescht": True}

    def _saison_zuordnen(self, args: dict[str, Any]) -> dict[str, Any]:
        objekt_id = _pflicht(args, "objekt_id")
        saison_id = _pflicht(args, "saison_id")
        rng = self._schreib_zeitraum(args)
        try:
            tage = self._kalender_service().assign_season(
                self._tenant(), objekt_id, saison_id, rng
            )
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {
            "objekt_id": objekt_id,
            "saison_id": saison_id,
            "belegte_tage": tage,
            "hinweis": "Die Saisonpreise sind an die Portale gemeldet.",
        }

    def _saison_zeitraum_leeren(self, args: dict[str, Any]) -> dict[str, Any]:
        objekt_id = _pflicht(args, "objekt_id")
        rng = self._schreib_zeitraum(args)
        try:
            tage = self._kalender_service().clear_season_range(
                self._tenant(), objekt_id, rng
            )
        except CalendarError as exc:
            raise ValueError(exc.message) from exc
        return {"objekt_id": objekt_id, "geleerte_tage": tage}

    # -- Zusatzleistungen ---------------------------------------------------

    def _addon_service(self) -> AddonsService:
        return AddonsService(service_client=self._db)

    def _zusatzleistungen(self, args: dict[str, Any]) -> dict[str, Any]:
        try:
            out = self._addon_service().list_for_property(
                self.ctx(), _pflicht(args, "objekt_id")
            )
        except AddonError as exc:
            raise ValueError(exc.message) from exc
        return {
            "anzahl": len(out.items[:MAX_ADDONS]),
            "zusatzleistungen": [
                a.model_dump(mode="json") for a in out.items[:MAX_ADDONS]
            ],
        }

    @staticmethod
    def _addon_felder(args: dict[str, Any]) -> dict[str, Any]:
        """Werkzeug-Argumente auf die Schema-Felder abbilden.

        Ausdrücklich statt durchreichen: `name` und `description` sind
        SPRACH-Wörterbücher (`{"de": "…", "en": "…"}`), kein Text. Ein
        durchgereichter String würde die Eingabeprüfung erst spät und
        unverständlich abweisen.
        """
        felder: dict[str, Any] = {}
        for arg, feld in (
            ("name", "name"), ("beschreibung", "description"),
            ("preis", "price"), ("basis", "basis"),
            ("pflicht", "mandatory"), ("steuersatz", "tax_rate"),
            ("aktiv", "active"),
        ):
            wert = args.get(arg)
            if wert is None:
                continue
            if feld in {"name", "description"} and isinstance(wert, str):
                # Ein einzelner Text gilt für die Standardsprache des Betriebs.
                felder[feld] = {"de": wert}
            else:
                felder[feld] = wert
        return felder

    def _zusatzleistung_anlegen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.addons.schemas import AddonCreate

        objekt_id = _pflicht(args, "objekt_id")
        felder = self._addon_felder(args)
        if not felder.get("name"):
            raise ValueError("name fehlt")
        try:
            addon = self._addon_service().create(
                self.ctx(), objekt_id, AddonCreate(**felder)
            )
        except AddonError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {"id": addon.id, "objekt_id": objekt_id, "angelegt": True}

    def _zusatzleistung_aendern(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.addons.schemas import AddonUpdate

        addon_id = _pflicht(args, "zusatzleistung_id")
        felder = self._addon_felder(args)
        if not felder:
            raise ValueError("Keine Änderung angegeben.")
        try:
            addon = self._addon_service().update(
                self.ctx(), addon_id, AddonUpdate(**felder)
            )
        except AddonError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {"id": addon.id, "geaendert": sorted(felder)}

    def _zusatzleistung_loeschen(self, args: dict[str, Any]) -> dict[str, Any]:
        addon_id = _pflicht(args, "zusatzleistung_id")
        try:
            self._addon_service().delete(self.ctx(), addon_id)
        except AddonError as exc:
            raise ValueError(exc.message) from exc
        return {"id": addon_id, "geloescht": True}

    def _zusatzleistung_buchen(self, args: dict[str, Any]) -> dict[str, Any]:
        buchung_id = _pflicht(args, "buchung_id")
        addon_id = _pflicht(args, "zusatzleistung_id")
        menge = int(args.get("menge") or 1)
        if menge < 1:
            raise ValueError("menge muss mindestens 1 sein")
        try:
            out = self._addon_service().add_to_reservation(
                self.ctx(), buchung_id, addon_id, menge
            )
        except AddonError as exc:
            raise ValueError(exc.message) from exc
        return {
            "buchung_id": buchung_id,
            "zusatzleistung_id": addon_id,
            "menge": menge,
            "gebucht": len(out.items),
            "hinweis": (
                "Kostenpflichtige Leistungen erscheinen auf der Rechnung des "
                "Gastes."
            ),
        }

    # -- Rabatte ------------------------------------------------------------

    def _rabatt_service(self) -> PropertyDiscountsService:
        return PropertyDiscountsService(service_client=self._db)

    def _rabatte(self, args: dict[str, Any]) -> dict[str, Any]:
        try:
            out = self._rabatt_service().list_for_property(
                self.ctx(), _pflicht(args, "objekt_id")
            )
        except DiscountError as exc:
            raise ValueError(exc.message) from exc
        posten = getattr(out, "items", out)
        return {
            "anzahl": len(posten[:MAX_RABATTE]),
            "rabatte": [
                p.model_dump(mode="json") if hasattr(p, "model_dump") else p
                for p in posten[:MAX_RABATTE]
            ],
        }

    # -- Kartei (property_dossier) ------------------------------------------

    def _kartei_service(self) -> PropertyDossierService:
        # Der Kontext MIT Rolle gehört in den Konstruktor: die Kartei prüft
        # den Objekt-Scope selbst (`is_owner`/`is_staff`), und in ihr stehen
        # IBAN, Steuer-ID und CPR-Nummer. Mit `role=None` wäre die Prüfung
        # still übersprungen.
        return PropertyDossierService(client=self._db, ctx=self.ctx())

    def _kartei_lesen(self, args: dict[str, Any]) -> dict[str, Any]:
        try:
            voll = self._kartei_service().get_full(
                self._tenant(), _pflicht(args, "objekt_id")
            )
        except DossierError as exc:
            raise ValueError(exc.message) from exc
        return voll.model_dump(mode="json")

    def _kartei_schreiben(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.property_dossier import schemas as ds

        objekt_id = _pflicht(args, "objekt_id")
        abschnitt = _pflicht(args, "abschnitt")
        if abschnitt not in _KARTEI_ABSCHNITTE:
            erlaubt = ", ".join(_KARTEI_ABSCHNITTE)
            raise ValueError(
                f"Unbekannter Abschnitt '{abschnitt}'. Möglich: {erlaubt}"
            )
        daten = args.get("daten")
        if not isinstance(daten, dict):
            raise ValueError("daten fehlt oder ist kein Objekt")

        dienst = self._kartei_service()
        modelle = {
            "process": ds.ProcessData,
            "access": ds.AccessData,
            "emergency_authority": ds.EmergencyAuthority,
            "marketing": ds.MarketingData,
            "housebook": ds.HousebookData,
        }
        # Bestand lesen und mischen — wie bei den Objekt-Abschnitten: ein
        # PUT ersetzt den GANZEN Abschnitt, wer nur ein Feld schickt, verlöre
        # den Rest (Wurzel 1).
        holen = getattr(dienst, f"get_{abschnitt}")
        setzen = getattr(dienst, f"put_{abschnitt}")
        try:
            vorher = holen(self._tenant(), objekt_id).model_dump(mode="json")
            neu = modelle[abschnitt](**{**vorher, **daten})
            setzen(self._tenant(), objekt_id, neu)
            # ZURÜCKLESEN statt die Eingabe zu spiegeln: `put_*` gibt `req`
            # zurück, also genau das, was hineinging — ein Echo, kein Beweis.
            # Was zurückkommt, ist damit der Stand aus der Datenbank.
            danach = holen(self._tenant(), objekt_id)
        except DossierError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {
            "objekt_id": objekt_id,
            "abschnitt": abschnitt,
            "gespeichert": True,
            "stand": danach.model_dump(mode="json"),
        }

    def _kartei_handwerker_anlegen(self, args: dict[str, Any]) -> dict[str, Any]:
        from src.features.property_dossier.schemas import TradespersonBase

        objekt_id = _pflicht(args, "objekt_id")
        felder = {
            k: v for k, v in args.items() if k != "objekt_id" and v is not None
        }
        try:
            out = self._kartei_service().add_tradesperson(
                self._tenant(), objekt_id, TradespersonBase(**felder)
            )
        except DossierError as exc:
            raise ValueError(exc.message) from exc
        except ValidationError as exc:
            raise ValueError(_validierung_lesbar(exc)) from exc
        return {"objekt_id": objekt_id, "id": out.id, "angelegt": True}

    def _kartei_handwerker_loeschen(self, args: dict[str, Any]) -> dict[str, Any]:
        objekt_id = _pflicht(args, "objekt_id")
        eintrag_id = _pflicht(args, "eintrag_id")
        try:
            self._kartei_service().delete_tradesperson(
                self._tenant(), objekt_id, eintrag_id
            )
        except DossierError as exc:
            raise ValueError(exc.message) from exc
        return {"objekt_id": objekt_id, "eintrag_id": eintrag_id,
                "geloescht": True}


__all__ = ["VertriebMixin", "date"]
