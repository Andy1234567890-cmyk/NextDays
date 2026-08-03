"""Channex-Steuern: lokale Steuern eines Objekts → Channex taxes + tax_set.

Eigenes Modul, weil Steuern ein abgeschlossenes Thema mit eigener Fachlogik
sind: die Abbildung unserer Steuerarten auf die Channex-Enums, der schlanke
Sync-Pfad für reine Steuer-Änderungen und der Gegenzustand beim Löschen.
Mixin des ChannelManagerService; State (_db/_channex) kommt von der Fassade.

Channex-Vokabular (docs: taxes-and-tax-sets, live geprüft 03.08.2026):
`logic` ∈ percent | per_room | per_room_per_night | per_person |
per_person_per_night | per_night | per_booking, `type` ∈ tax | fee | city tax.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from .channex_client import ChannexError
from .common import ChannelManagerError, ist_demo_mapping, log
from .tax_regime import STANDARD, TaxRegimeMixin


class TaxSyncMixin(TaxRegimeMixin):
    """Steuer- und Gebühren-Sync eines Objekts nach Channex."""

    # Betrags-Steuern: (chargeBasis, period) → Channex tax.logic. Die vier
    # Kombinationen sind exakt die Channex-Enums (docs: taxes-and-tax-sets,
    # logic ∈ percent|per_room|per_room_per_night|per_person|
    # per_person_per_night|per_night|per_booking) — damit geht „2,50 € pro Gast
    # pro Nacht" unverfälscht an die Portale statt wie früher pauschal als
    # per_night.
    _TAX_AMOUNT_LOGIC = {
        ("SingleCharge", "PerStay"): "per_booking",
        ("SingleCharge", "PerNight"): "per_night",
        ("PerPerson", "PerStay"): "per_person",
        ("PerPerson", "PerNight"): "per_person_per_night",
    }
    # Lokale Steuerart (Airbnb-Taxonomie) → Channex type ∈ tax|fee|city_tax.
    # Ortsbezogene Abgaben sind „city_tax", Beherbergungs-/Zimmersteuern „tax".
    #
    # ACHTUNG, live gemessen (Sandbox, 03.08.2026): der Wert heißt `city_tax`
    # mit UNTERSTRICH. Die Channex-Doku schreibt „city tax" mit Leerzeichen und
    # Responses liefern „City Tax" — beide werden bei POST /taxes mit
    # `422 {"type": ["is invalid"]}` abgelehnt. Nicht nach der Doku „korrigieren".
    _TAX_TYPE_BY_LOCAL_KIND = {
        "HotelTax": "tax",
        "LodgingTax": "tax",
        "RoomTax": "tax",
        "TourismAssessment": "city_tax",
        "TouristTax": "city_tax",
        "TransientOccupancyTax": "city_tax",
        "Unknown": "tax",
    }
    # Fallback auf der gröberen Achse (kind), wenn keine Steuerart gesetzt ist
    # (Altdatensatz) — unverändertes Verhalten für den Bestand.
    _TAX_TYPE = {"vat": "tax", "local": "city_tax"}

    # Gebühren-Basis → Channex `logic`. Alle vier Ziele sind live gegen
    # POST /taxes mit type=fee geprüft (03.08.2026); Channex akzeptiert für
    # `fee` dieselben sieben logic-Werte wie für `tax`.
    _FEE_LOGIC = {
        "per_stay": "per_booking",
        "per_night": "per_night",
        "per_guest_stay": "per_person",
        "per_guest_night": "per_person_per_night",
    }

    # Channex kennt für `type` nur tax|fee|city_tax (live geprüft: cleaning_fee,
    # resort_fee, service_fee, pet_fee werden mit 422 abgelehnt). Unsere
    # feinere Gebührenart lebt deshalb im TITEL, nicht im Typ — das ist die
    # einzige Stelle, an der das Portal sie überhaupt sehen kann.
    _FEE_TYPE_LABEL = {
        "cleaning": "Reinigungsgebühr",
        "pet": "Haustiergebühr",
        "resort": "Resortgebühr",
        "management": "Verwaltungsgebühr",
        "community": "Gemeinschaftsgebühr",
        "linen": "Wäscheservice",
        "other": "Gebühr",
    }

    # Level der Kaskade (Channex rechnet von der höchsten Zahl zur niedrigsten).
    # Gebühren liegen UNTER den Steuern, damit eine prozentuale USt auf
    # Grundpreis + Gebühr rechnet — live bestätigt am Beispiel aus der Doku
    # (Reinigung level 1, USt level 0).
    _LEVEL_FEE = 1
    _LEVEL_TAX = 0

    @classmethod
    def _fee_logic(cls, fee: dict[str, Any]) -> str:
        """Channex-`logic` einer Gebühr aus ihrer Basis."""
        return cls._FEE_LOGIC.get(str(fee.get("basis") or "per_stay"), "per_booking")

    @classmethod
    def _fee_title(cls, fee: dict[str, Any]) -> str:
        """Titel der Gebühr beim Portal.

        Der vom Betrieb vergebene Name gewinnt (er steht so auf der Rechnung).
        Fehlt er, tritt die Gebührenart als Bezeichnung ein — nie ein blankes
        „Gebühr", solange die Art bekannt ist (Wurzel 4)."""
        name = str(fee.get("name") or "").strip()
        if name:
            return name[:255]
        art = str(fee.get("feeType") or "other")
        return cls._FEE_TYPE_LABEL.get(art, "Gebühr")

    @classmethod
    def _tax_logic(cls, tax: dict[str, Any]) -> str:
        """Channex-`logic` einer Steuer. Ohne gespeicherte Basis gilt bei
        Betrags-Steuern „einmalig pro Nacht" — genau das, was bisher gesendet
        wurde; nichts wird geraten."""
        if str(tax.get("mode") or "percent") == "percent":
            return "percent"
        schluessel = (
            str(tax.get("chargeBasis") or "SingleCharge"),
            str(tax.get("period") or "PerNight"),
        )
        return cls._TAX_AMOUNT_LOGIC.get(schluessel, "per_night")

    @classmethod
    def _tax_type(cls, tax: dict[str, Any]) -> str:
        """Channex-`type` einer Steuer: aus der Steuerart, sonst aus `kind`."""
        art = tax.get("taxType")
        if art:
            return cls._TAX_TYPE_BY_LOCAL_KIND.get(str(art), "tax")
        return cls._TAX_TYPE.get(str(tax.get("kind") or ""), "tax")

    def _sync_taxes(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        channex_property_id: str,
        channex_rate_plan_ids: list[str],
        currency: str,
        prop_row: dict[str, Any],
    ) -> None:
        """Steuern UND Gebühren (type_attributes.pricing) → Channex taxes +
        tax_sets, die an die Rate-Plans gehängt werden. Idempotent über
        channex_tax_map. Ohne Einträge: nur noch der Abgleich gelöschter.

        Steuern und Gebühren sind bei Channex DASSELBE Objekt (`/taxes`,
        unterschieden nur durch `type` ∈ tax|fee|city_tax), deshalb laufen sie
        hier durch denselben Upsert. Gebühren liegen in der Kaskade eine Ebene
        tiefer (`level`), damit eine prozentuale USt auf Grundpreis + Gebühr
        rechnet statt nur auf den Grundpreis.
        """
        attrs = prop_row.get("type_attributes") or {}
        pricing = attrs.get("pricing") or {}
        taxes = pricing.get("taxes") or []
        fees = [f for f in (pricing.get("fees") or []) if isinstance(f, dict)]

        # Steuern und Gebühren in EINER Liste. Der Rest der Methode kennt nur
        # noch diese Form: (local_id, channex-attrs, level, nur_diese_portale).
        # `nur_diese_portale` ist die ausdrückliche Wahl des Betriebs
        # (portalScope). Die zweite Einschränkungs-Achse — das Portal zieht die
        # Steuer selbst ein — steht NICHT am Posten, sondern kommt pro Portal aus
        # `regime` und wird erst in `posten_fuer` ausgewertet.
        posten: list[tuple[str, dict[str, Any], int, list[str]]] = []

        for t in taxes:
            local_id = t.get("id")
            if not local_id:
                continue
            logic = self._tax_logic(t)
            # Gastseitiger Name, wenn gepflegt (names[locale]) — das ist der
            # Text, den der Gast beim Portal sieht.
            names = t.get("names") if isinstance(t.get("names"), dict) else {}
            titel = (
                names.get("de")
                or next((v for v in names.values() if v), None)
                or t.get("name")
                # Die USt trägt bewusst keinen eigenen Namen (normalize_taxes
                # verlangt ihn nur für lokale Steuern — sie IST die Umsatzsteuer
                # des Objekts). Ohne diesen Zweig stand beim Portal „Steuer",
                # also genau der Platzhalter, den Wurzel 4 verbietet; live
                # gesehen im E2E-Lauf. „USt." ist keine Erfindung, sondern der
                # Sachverhalt der Zeile (kind == "vat").
                or ("USt." if str(t.get("kind")) == "vat" else None)
                or "Steuer"
            )
            tax_attrs: dict[str, Any] = {
                "title": str(titel)[:255],
                "logic": logic,
                "type": self._tax_type(t),
                "rate": str(t.get("value") or 0),
                "is_inclusive": bool(t.get("includedInPrice")),
                "property_id": channex_property_id,
            }
            if logic != "percent":
                tax_attrs["currency"] = currency
            posten.append(
                (str(local_id), tax_attrs, self._LEVEL_TAX, self._scope_of(t))
            )

        for f in fees:
            local_id = f.get("id")
            if not local_id:
                continue
            # Optionale Gebühren (Gast wählt sie ab) dürfen NICHT als
            # Pflichtaufschlag ans Portal: der Gast bekäme sie dort ohne
            # Wahlmöglichkeit berechnet. Sie bleiben in Direktbuchung/Rechnung.
            if f.get("optional"):
                continue
            fee_logic = self._fee_logic(f)
            posten.append(
                (
                    str(local_id),
                    {
                        "title": self._fee_title(f),
                        "logic": fee_logic,
                        "type": "fee",
                        "rate": str(f.get("amount") or 0),
                        "is_inclusive": False,
                        "property_id": channex_property_id,
                        "currency": currency,
                    },
                    self._LEVEL_FEE,
                    self._scope_of(f),
                )
            )

        channex_tax_ids: list[str] = []
        # (channex_id, level, nur_diese_portale) für den Set-Bau unten.
        gemappt: list[tuple[str, int, list[str]]] = []
        for local_id, tax_attrs, level, scope in posten:

            existing = (
                db.table("channex_tax_map")
                .select("id, channex_tax_id")
                .eq("property_id", property_id)
                .eq("local_tax_id", local_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            if existing:
                channex_tax_id = existing[0]["channex_tax_id"]
                self._channex.update_tax(channex_tax_id, tax_attrs)
            else:
                created = self._channex.create_tax(tax_attrs)
                channex_tax_id = (created.get("data") or {}).get("id")
                if not channex_tax_id:
                    continue
                # `deleted_at` MUSS mit zurückgesetzt werden: der Unique-Index
                # läuft über (property_id, local_tax_id) OHNE deleted_at, der
                # Upsert trifft also eine früher stillgelegte Zeile derselben
                # Steuer. Ohne das Zurücksetzen bliebe die Zeile unsichtbar —
                # der nächste Sync fände kein Mapping und legte die Steuer bei
                # Channex ein ZWEITES Mal an (Wurzel 2). Tritt real auf, wenn
                # eine Steuer gelöscht und dieselbe UI-Kennung neu verwendet wird.
                db.table("channex_tax_map").upsert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "local_tax_id": local_id,
                        "channex_tax_id": channex_tax_id,
                        "deleted_at": None,
                    },
                    on_conflict="property_id,local_tax_id",
                ).execute()
            channex_tax_ids.append(channex_tax_id)
            gemappt.append((channex_tax_id, level, scope))

        # Wurzel 1 (Gegenzustand): eine im Objekt GELÖSCHTE Steuer muss auch bei
        # den Portalen verschwinden — sonst kassiert Booking eine Kurtaxe weiter,
        # die es hier längst nicht mehr gibt.
        #
        # REIHENFOLGE (live gemessen): erst das Tax-Set vom alten Eintrag
        # befreien, DANN die Steuer löschen. Channex lehnt `DELETE /taxes/:id`
        # sonst mit „can't be remove because used at TaxSet" ab — eine Steuer,
        # die noch in einem Set referenziert ist, lässt sich nicht entfernen.
        if not channex_tax_ids:
            # Letzte Steuer entfernt: Set abhängen und löschen. Die noch
            # gemappten Channex-IDs müssen dabei mitgegeben werden — das Set
            # verlangt beim Aktualisieren ein nicht-leeres `taxes` (Wurzel 1:
            # der Zwischenzustand muss gültig bleiben).
            alt_ids = [
                str(r["channex_tax_id"])
                for r in (
                    db.table("channex_tax_map")
                    .select("channex_tax_id")
                    .eq("tenant_id", tenant_id)
                    .eq("property_id", property_id)
                    .is_("deleted_at", "null")
                    .execute()
                ).data
                or []
                if r.get("channex_tax_id")
            ]
            self._drop_tax_set(
                db, tenant_id, property_id, channex_property_id, currency, alt_ids
            )
            # Portal-Sets mit abräumen: `_drop_tax_set` kennt nur das
            # Standard-Set aus der Altspalte. Ohne diese Zeile blieben die
            # Portal-Sets bei Channex stehen — und die Standard-Zeile in
            # channex_tax_set_map als Waise „aktiv" zurück, worauf der nächste
            # Lauf ein längst gelöschtes Set aktualisieren würde (live gesehen
            # in Stufe D des E2E-Laufs).
            self._prune_portal_tax_sets(db, tenant_id, property_id, [])
            self._tax_set_map_stilllegen(db, tenant_id, property_id)
            self._prune_removed_taxes(db, tenant_id, property_id, taxes, fees)
            return

        # Kanal-Einschränkung (Wurzel 1: der Gegenzustand ist hier „das Portal
        # bekommt sie NICHT"). Channex kennt keine Einschränkung an der Steuer
        # selbst — live geprüft: `channels`/`excluded_channels`/… werden beim
        # POST stillschweigend angenommen und verworfen. Die Einschränkung geht
        # deshalb über die Rate-Plans: `tax_set_id` hängt am Rate-Plan, und wir
        # führen ohnehin je Portal einen eigenen Kanal-Plan (rate_plans.
        # portal_scope, 0272). Ein Portal-Plan bekommt sein EIGENES Set mit nur
        # den für dieses Portal erlaubten Posten.
        scope_je_plan = self._portal_scope_je_channex_plan(
            db, tenant_id, property_id
        )
        # Steuerregime der verbundenen Portale — LIVE aus dem Channex-Katalog +
        # den echten Kanal-Einstellungen (tax_regime.py). Damit erkennt das
        # System selbst, wie eine Steuer an Agoda/Expedia/Airbnb gehört; es ist
        # bewusst keine Frontend-Einstellung. Portale, die die Steuer selbst zum
        # Gastpreis rechnen (`senden=False`), bekommen sie nicht zusätzlich.
        regime = self.regime_je_portal(db, tenant_id, property_id)
        # Rate-Plans ohne portal_scope tragen das Standard-Set (alle Posten,
        # die nicht eingeschränkt sind).
        standard_plans = [
            rp for rp in channex_rate_plan_ids if rp not in scope_je_plan
        ]
        # Portal-Code → seine Channex-Rate-Plans.
        plaene_je_portal: dict[str, list[str]] = {}
        for rp in channex_rate_plan_ids:
            portal = scope_je_plan.get(rp)
            if portal:
                plaene_je_portal.setdefault(portal, []).append(rp)
        # Portale mit eigenem Kanal-Plan: nur für sie kann eine Einschränkung
        # überhaupt wirken (sie haben ein eigenes Set).
        abgedeckte_portale = frozenset(plaene_je_portal)

        # Welche Portale BRAUCHEN ein eigenes Set, weil ein Posten auf sie
        # eingeschränkt ist oder sie die Steuer selbst einziehen? Fehlt der
        # Kanal-Plan, kann die Einschränkung nur greifen, indem der Posten
        # NIRGENDS gesendet wird — die Kurtaxe „nur an Booking" käme dann bei
        # keinem Portal an (kein Set für Booking, und aus dem Standard-Set fällt
        # sie heraus). Kanal-Pläne entstehen sonst ausschließlich über eine
        # Preisänderung (objekt_kanal.set_portal_price_adjustment), die hier
        # niemand gesetzt haben muss. Deshalb legt der Sync den fehlenden Plan
        # selbst an — mit offset_percent 0, denn gewollt ist kein anderer PREIS,
        # nur eine andere Steuer-Zusammenstellung.
        gebraucht: set[str] = set()
        for _cx, _lvl, scope in gemappt:
            gebraucht.update(scope)
        gebraucht.update(p for p, r in regime.items() if not r.senden)
        fehlend = sorted(
            p for p in gebraucht - abgedeckte_portale if p in regime
        )
        if fehlend:
            neu_gemappt = self._kanalplaene_nachziehen(
                db, tenant_id, property_id, fehlend
            )
            # Nur neu bauen, wenn wirklich Pläne entstanden sind — sonst bleibt
            # es beim bisherigen Stand (und der Warnung weiter unten).
            if neu_gemappt:
                scope_je_plan = self._portal_scope_je_channex_plan(
                    db, tenant_id, property_id
                )
                alle_plan_ids = [*channex_rate_plan_ids, *neu_gemappt]
                standard_plans = [
                    rp for rp in alle_plan_ids if rp not in scope_je_plan
                ]
                plaene_je_portal = {}
                for rp in alle_plan_ids:
                    portal = scope_je_plan.get(rp)
                    if portal:
                        plaene_je_portal.setdefault(portal, []).append(rp)
                abgedeckte_portale = frozenset(plaene_je_portal)

        def posten_fuer(portal: str | None) -> list[dict[str, Any]]:
            """Die Posten, die für diesen Kanal gelten.

            `portal=None` ist das Standard-Set: es hängt an allen Rate-Plans
            ohne portal_scope und ist damit der Weg zu JEDEM Kanal, für den es
            keinen eigenen Plan gibt. Ein eingeschränkter Posten darf dort
            deshalb nicht hinein — sonst liefe die Einschränkung ins Leere.
            """
            gewaehlt: list[dict[str, Any]] = []
            for cx_id, level, scope in gemappt:
                if scope and (portal is None or portal not in scope):
                    continue
                # Automatisch erkanntes Regime dieses Portals: rechnet es die
                # Steuer selbst zum Gastpreis (Airbnb „Payout Amount", Expedia
                # „Collect Amount"), darf sie hier nicht zusätzlich hinein.
                if portal is not None and not regime.get(portal, STANDARD).senden:
                    continue
                gewaehlt.append({"id": cx_id, "level": level})
            return gewaehlt

        # Ein Portal, das die Steuer selbst zum Gastpreis rechnet, braucht einen
        # EIGENEN Kanal-Plan — nur dann gibt es ein Set, aus dem die Steuer
        # herausbleiben kann. Ohne eigenen Plan hängt es am Standard-Set und
        # bekommt die Steuer doch. Das ist genau die doppelte Besteuerung, die
        # hier verhindert werden soll, also sichtbar machen statt stumm falsch
        # zu senden.
        # Erkanntes inklusiv/exklusiv anwenden. Channex führt `is_inclusive` an
        # der STEUER, nicht am Set — ein Posten kann also nicht gleichzeitig für
        # Agoda inklusiv und für Expedia exklusiv sein. Verlangen zwei Portale
        # Gegenteiliges, gewinnt keines: dann bleibt die Pflege am Objekt
        # (`includedInPrice`) stehen und der Widerspruch wird protokolliert,
        # statt eine der beiden Seiten still falsch zu bespielen (Wurzel 4).
        wuensche = {
            r.inclusive
            for p, r in regime.items()
            if r.senden and r.inclusive is not None and p in abgedeckte_portale
        }
        if len(wuensche) == 1:
            gewuenscht = next(iter(wuensche))
            for cx_id, _lvl, _scope in gemappt:
                self._channex.update_tax(cx_id, {"is_inclusive": gewuenscht})
        elif len(wuensche) > 1:
            log.warning(
                "channex_steuerregime_widerspruch",
                tenant_id=tenant_id,
                property_id=property_id,
                regime={p: r.quelle for p, r in sorted(regime.items())},
            )

        for portal, reg in sorted(regime.items()):
            if not reg.senden and portal not in abgedeckte_portale:
                log.warning(
                    "channex_steuer_doppelt_moeglich_ohne_kanalplan",
                    tenant_id=tenant_id,
                    property_id=property_id,
                    portal=portal,
                    regime=reg.quelle,
                )

        gesetzte_ids: list[str] = []
        # Standard-Set: Titel bleibt „Standard" (Bestand hängt daran).
        std_id = self._upsert_tax_set(
            db, tenant_id, property_id, channex_property_id, currency,
            portal=None, titel="Standard",
            taxes=posten_fuer(None), rate_plan_ids=standard_plans,
        )
        if std_id:
            gesetzte_ids.append(std_id)
        for portal, plaene in sorted(plaene_je_portal.items()):
            pid = self._upsert_tax_set(
                db, tenant_id, property_id, channex_property_id, currency,
                portal=portal, titel=f"Standard · {portal}",
                taxes=posten_fuer(portal), rate_plan_ids=plaene,
            )
            if pid:
                gesetzte_ids.append(pid)
        # Portal-Sets, die es nicht mehr braucht (Kanal-Plan entfernt), abräumen.
        self._prune_portal_tax_sets(db, tenant_id, property_id, gesetzte_ids)
        # Erst JETZT die entfernten Steuern löschen: die Sets oben tragen nur
        # noch die aktuellen IDs, damit ist die alte Steuer nicht mehr
        # referenziert und `DELETE /taxes/:id` wird von Channex akzeptiert.
        self._prune_removed_taxes(db, tenant_id, property_id, taxes, fees)
        log.info(
            "channex_taxes_synced",
            tenant_id=tenant_id,
            property_id=property_id,
            taxes=len(taxes),
            fees=len([f for f in fees if not f.get("optional")]),
            tax_sets=len(gesetzte_ids),
        )

    @staticmethod
    def _scope_of(eintrag: dict[str, Any]) -> list[str]:
        """Kanal-Einschränkung eines Postens; leer = alle Kanäle.

        Das ist die AUSDRÜCKLICHE Einschränkung (z. B. „diese Ortstaxe nur an
        Booking"). Das Steuerregime des Portals — wer die Abgabe einzieht, ob
        inklusiv oder exklusiv — wird NICHT hier gepflegt, sondern live aus dem
        Kanal erkannt (tax_regime.py).
        """
        scope = eintrag.get("portalScope")
        if not isinstance(scope, list):
            return []
        return [str(x) for x in scope if str(x).strip()]

    @staticmethod
    def _portal_scope_je_channex_plan(
        db: Client, tenant_id: str, property_id: str
    ) -> dict[str, str]:
        """channex_rate_plan_id → portal_scope für die Kanal-Pläne des Objekts.

        Gleiche Auflösung wie `_portal_scoped_channex_ids` im channels-Mixin;
        hier eigenständig, damit der Steuer-Sync nicht am Kanal-Mixin hängt.
        """
        rows = [
            r
            for r in (
                db.table("rate_plans")
                .select("id, portal_scope")
                .eq("property_id", property_id)
                .execute()
            ).data
            or []
            if r.get("portal_scope")
        ]
        if not rows:
            return {}
        maps = (
            db.table("channex_rate_plan_map")
            .select("local_rate_plan_id, channex_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .in_("local_rate_plan_id", [r["id"] for r in rows])
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        scope_von_lokal = {r["id"]: r["portal_scope"] for r in rows}
        return {
            m["channex_rate_plan_id"]: scope_von_lokal[m["local_rate_plan_id"]]
            for m in maps
            if m.get("channex_rate_plan_id")
            and m.get("local_rate_plan_id") in scope_von_lokal
        }

    def _upsert_tax_set(  # pylint: disable=too-many-arguments
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        channex_property_id: str,
        currency: str,
        *,
        portal: str | None,
        titel: str,
        taxes: list[dict[str, Any]],
        rate_plan_ids: list[str],
    ) -> str | None:
        """Ein Tax-Set anlegen/aktualisieren und in channex_tax_set_map führen.

        Ohne Posten wird KEIN Set angelegt: Channex lehnt ein Set mit leerem
        `taxes` ab („can't be blank"). Ein bereits vorhandenes Set wird in dem
        Fall abgeräumt, damit an dem Kanal-Plan nicht die alte Zusammenstellung
        hängen bleibt (Wurzel 1).
        """
        bestand = (
            db.table("channex_tax_set_map")
            .select("id, channex_tax_set_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
        )
        bestand = (
            bestand.is_("portal_scope", "null")
            if portal is None
            else bestand.eq("portal_scope", portal)
        )
        vorhanden = (bestand.limit(1).execute()).data or []
        set_id = vorhanden[0]["channex_tax_set_id"] if vorhanden else None

        if not taxes:
            if set_id:
                self._drop_single_tax_set(
                    db, tenant_id, property_id, channex_property_id,
                    set_id, portal,
                )
            return None

        set_attrs = {
            "title": titel[:255],
            "property_id": channex_property_id,
            "currency": currency,
            "taxes": taxes,
            "associated_rate_plan_ids": rate_plan_ids,
        }
        if set_id:
            self._channex.update_tax_set(set_id, set_attrs)
        else:
            created = self._channex.create_tax_set(set_attrs)
            set_id = (created.get("data") or {}).get("id")
            if not set_id:
                return None
            # KEIN upsert/on_conflict: die Unique-Indizes sind PARTIELL
            # (`where portal_scope is not null` bzw. `is null`), und Postgres
            # akzeptiert für ON CONFLICT nur einen Index ohne WHERE — live
            # bestätigt mit 42P10 „no unique or exclusion constraint matching
            # the ON CONFLICT specification". Stattdessen die stillgelegte Zeile
            # reaktivieren, sonst eine neue anlegen; beides trifft denselben
            # Schlüssel (Objekt + Portal) und bleibt damit idempotent (Wurzel 2).
            alt = db.table("channex_tax_set_map").select("id").eq(
                "tenant_id", tenant_id
            ).eq("property_id", property_id)
            alt = (
                alt.is_("portal_scope", "null")
                if portal is None
                else alt.eq("portal_scope", portal)
            )
            stillgelegt = (alt.limit(1).execute()).data or []
            if stillgelegt:
                db.table("channex_tax_set_map").update(
                    {"channex_tax_set_id": set_id, "deleted_at": None}
                ).eq("id", stillgelegt[0]["id"]).execute()
            else:
                try:
                    db.table("channex_tax_set_map").insert(
                        {
                            "tenant_id": tenant_id,
                            "property_id": property_id,
                            "portal_scope": portal,
                            "channex_tax_set_id": set_id,
                        }
                    ).execute()
                except APIError as exc:
                    # 23505 = ein paralleler Lauf war schneller (voller
                    # Content-Sync und sync_taxes_only sind nur je Typ
                    # dedupliziert, nicht gegeneinander — jobs/queue.py). Der
                    # Unique-Index ist hier der Backstop, den read-then-write
                    # allein nicht bietet. Das eigene, gerade angelegte Set ist
                    # dann das überzählige: aufräumen und den Lauf beenden, der
                    # Gewinner hat schon ein gültiges Set gesetzt (Wurzel 2).
                    if getattr(exc, "code", None) != "23505":
                        raise
                    log.info(
                        "channex_tax_set_parallel_angelegt_verworfen",
                        tenant_id=tenant_id,
                        property_id=property_id,
                        portal=portal,
                    )
                    self._tax_set_verwerfen(set_id)
                    return None
            # Das Standard-Set zusätzlich in der Altspalte führen: der
            # Löschpfad (_drop_tax_set) und Bestandscode lesen es von dort.
        if portal is None and set_id:
            # AUSSERHALB des else-Zweigs: auch beim Aktualisieren müssen neu
            # hinzugekommene channex_tax_map-Zeilen die Set-ID tragen. Lag das
            # nur im Anlege-Zweig, blieb die Spalte bei jeder später ergänzten
            # Steuer NULL — und _drop_tax_set fand das Set nicht mehr.
            db.table("channex_tax_map").update(
                {"channex_tax_set_id": set_id}
            ).eq("tenant_id", tenant_id).eq(
                "property_id", property_id
            ).is_("deleted_at", "null").execute()
        return set_id

    def _taxes_eines_sets(self, set_id: str) -> list[dict[str, Any]]:
        """Die aktuelle `taxes`-Liste eines Tax-Sets bei Channex (id + level).

        Gebraucht, weil `PUT /tax_sets/:id` das Feld immer verlangt (live: leer
        oder fehlend → 422). Die Wahrheit steht bei Channex, nicht in unserer
        Map: dort kennen wir nur die Steuern des Objekts, nicht die eines
        einzelnen Sets. Ist das Set nicht lesbar, kommt eine leere Liste zurück
        und der Aufrufer läuft in den bekannten 422 statt in einen AttributeError.
        """
        try:
            got = self._channex.get_tax_set(set_id)
        except ChannexError:
            return []
        attrs = (got.get("data") or {}).get("attributes") or {}
        return [
            {"id": t["id"], "level": t.get("level", 0)}
            for t in (attrs.get("taxes") or [])
            if t.get("id")
        ]

    def _tax_set_verwerfen(self, set_id: str) -> None:
        """Ein gerade angelegtes, überzähliges Tax-Set bei Channex entfernen.

        Best-effort: bleibt es stehen, hängt es an keinem Rate-Plan (es wurde nie
        zugeordnet) und richtet keinen Schaden an — ein Fehler hier darf den
        Lauf nicht kippen.
        """
        try:
            self._channex.delete_tax_set(set_id)
        except ChannexError as exc:  # noqa: BLE001 — best-effort, siehe Docstring
            log.warning(
                "channex_tax_set_verwerfen_fehlgeschlagen",
                tax_set_id=set_id,
                error=str(exc),
            )

    def _kanalplaene_nachziehen(
        self, db: Client, tenant_id: str, property_id: str, portale: list[str]
    ) -> list[str]:
        """Fehlende Kanal-Pläne für Portale anlegen, die ein eigenes Tax-Set
        brauchen. Gibt die neuen Channex-Rate-Plan-IDs zurück.

        `offset_percent = 0`: gewollt ist kein anderer Preis, nur eine andere
        Steuer-Zusammenstellung. Gibt es keinen Grundpreis-Plan, wird NICHTS
        angelegt (kein erfundener Preis, Wurzel 4) — dann bleibt es bei der
        Warnung des Aufrufers.
        """
        standard = (
            db.table("rate_plans")
            .select("id, name, base_price, currency, min_stay")
            .eq("property_id", property_id)
            .is_("portal_scope", "null")
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        if not standard:
            return []
        basis = standard[0]
        angelegt = False
        for portal in portale:
            # Idempotent: einen vorhandenen Plan nicht doppeln (Wurzel 2). Der
            # Unique-Index (property_id, portal_scope) wäre der Backstop.
            if (
                db.table("rate_plans")
                .select("id")
                .eq("property_id", property_id)
                .eq("portal_scope", portal)
                .limit(1)
                .execute()
            ).data:
                continue
            db.table("rate_plans").insert(
                {
                    "property_id": property_id,
                    "name": f"{basis.get('name') or 'Standard'} · {portal}",
                    "base_price": basis.get("base_price"),
                    "currency": basis.get("currency"),
                    "min_stay": basis.get("min_stay"),
                    "rate_mode": "derived",
                    "derived_from_rate_plan_id": basis["id"],
                    "offset_percent": 0,
                    "offset_amount": None,
                    # Wie bei der Preisänderung: der Kanal-Plan geht
                    # ausschließlich über portal_scope an SEIN Portal.
                    "send_to_portals": False,
                    "portal_scope": portal,
                }
            ).execute()
            angelegt = True
            log.info(
                "channex_kanalplan_fuer_steuer_angelegt",
                tenant_id=tenant_id,
                property_id=property_id,
                portal=portal,
            )
        if not angelegt:
            return []
        # Die neuen Pläne brauchen ihr Channex-Gegenstück, bevor ein Tax-Set
        # daran hängen kann. Das erledigt der Content-Sync; danach stehen sie
        # in der rate_plan_map.
        self.sync_content(tenant_id, property_id=property_id)  # type: ignore[attr-defined]
        return [
            cx
            for cx, portal in self._portal_scope_je_channex_plan(
                db, tenant_id, property_id
            ).items()
            if portal in portale
        ]

    @staticmethod
    def _tax_set_map_stilllegen(
        db: Client, tenant_id: str, property_id: str
    ) -> None:
        """Alle Set-Zuordnungen des Objekts stilllegen (nichts mehr zu senden).

        Gegenstück zum „letzte Steuer entfernt"-Zweig: die Sets sind bei Channex
        weg, also darf hier keine Zeile mehr auf sie zeigen — der nächste Lauf
        würde sonst eine gelöschte Set-ID aktualisieren.
        """
        db.table("channex_tax_set_map").update(
            {"deleted_at": datetime.now(UTC).isoformat()}
        ).eq("tenant_id", tenant_id).eq("property_id", property_id).is_(
            "deleted_at", "null"
        ).execute()

    def _prune_portal_tax_sets(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        behalten: list[str],
    ) -> None:
        """Portal-Sets abräumen, die dieser Lauf nicht mehr gesetzt hat.

        Tritt auf, wenn der Kanal-Plan eines Portals entfällt (Preisänderung
        zurück auf 0). Ohne das Abräumen bliebe bei Channex ein verwaistes Set
        stehen, das eine andere Steuerzusammenstellung trägt (Wurzel 1).
        Best-effort je Set: ein Fehler an einem verwaisten Set darf den
        eigentlichen Sync nicht kippen.
        """
        verwaist = [
            r
            for r in (
                db.table("channex_tax_set_map")
                .select("id, channex_tax_set_id, portal_scope")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .not_.is_("portal_scope", "null")
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
            if r.get("channex_tax_set_id") not in behalten
        ]
        for row in verwaist:
            set_id = str(row["channex_tax_set_id"])
            try:
                # ERST vom Rate-Plan abhängen, dann löschen — ein Set, das noch
                # an einem Plan hängt, lehnt Channex mit „Can't remove TaxSet
                # associated with at least one RatePlan" ab (live gesehen). Und
                # `taxes` muss beim Abhängen mit, sonst „can't be blank".
                self._channex.update_tax_set(
                    set_id,
                    {
                        "taxes": self._taxes_eines_sets(set_id),
                        "associated_rate_plan_ids": [],
                    },
                )
                self._channex.delete_tax_set(set_id)
            except ChannexError as exc:
                # 404 = bei Channex längst weg, alles andere protokollieren und
                # das Mapping trotzdem stilllegen: ein hängendes Set würde sonst
                # bei jedem Lauf erneut scheitern.
                if getattr(exc, "channex_status", None) != 404:
                    log.warning(
                        "channex_tax_set_verwaist_nicht_geloescht",
                        tenant_id=tenant_id,
                        property_id=property_id,
                        portal=row.get("portal_scope"),
                        error=str(exc),
                    )
            db.table("channex_tax_set_map").update(
                {"deleted_at": datetime.now(UTC).isoformat()}
            ).eq("id", row["id"]).execute()

    def _drop_single_tax_set(  # pylint: disable=too-many-arguments
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        channex_property_id: str,
        set_id: str,
        portal: str | None,
    ) -> None:
        """Ein einzelnes Set entfernen (Posten dieses Kanals alle weggefallen).

        Arbeitet für BEIDE Fälle über die übergebene `set_id` — bewusst nicht
        über `_drop_tax_set`: das liest die Set-ID aus der Altspalte
        `channex_tax_map.channex_tax_set_id` und sendet ein hart leeres
        `taxes: []`, was Channex mit `422 taxes: can't be blank` ablehnt. Für den
        Standard-Fall kommt zusätzlich das Lösen des Property-Defaults dazu (ein
        Portal-Set ist nie Default), und die Altspalte muss mitgenullt werden.
        """
        try:
            if portal is None:
                # (1) Property-Default lösen — sonst „Can't remove Tax Set used
                # as default at Property" (live gemessene Reihenfolge).
                self._channex.update_property(
                    channex_property_id, {"default_tax_set_id": None}
                )
            # (2) Vom Rate-Plan abhängen. `taxes` MUSS mit und darf nicht leer
            # sein — live gemessen: sowohl `{"taxes": []}` als auch das komplette
            # Weglassen enden in `422 taxes: can't be blank`. Also die aktuelle
            # Zusammenstellung vom Set selbst lesen und unverändert
            # zurückschicken; gelöscht wird es im nächsten Schritt ohnehin.
            self._channex.update_tax_set(
                set_id,
                {
                    "taxes": self._taxes_eines_sets(set_id),
                    "associated_rate_plan_ids": [],
                },
            )
            # (3) Erst jetzt ist das Set löschbar.
            self._channex.delete_tax_set(set_id)
        except ChannexError as exc:
            if getattr(exc, "channex_status", None) != 404:
                raise
        # Zuordnung stilllegen — für BEIDE Fälle. Bliebe die Standard-Zeile
        # aktiv, aktualisierte der nächste Lauf ein gelöschtes Set (Wurzel 1).
        weg = (
            db.table("channex_tax_set_map")
            .update({"deleted_at": datetime.now(UTC).isoformat()})
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
        )
        weg = (
            weg.is_("portal_scope", "null")
            if portal is None
            else weg.eq("portal_scope", portal)
        )
        weg.execute()
        if portal is None:
            # Altspalte mitnullen: `_drop_tax_set` liest von dort, und eine
            # Zeile, die auf ein gelöschtes Set zeigt, ist eine Waise.
            db.table("channex_tax_map").update({"channex_tax_set_id": None}).eq(
                "tenant_id", tenant_id
            ).eq("property_id", property_id).execute()

    def sync_taxes_only(self, tenant_id: str, property_id: str) -> dict[str, Any]:
        """Nur die Steuern eines Objekts nach Channex spiegeln.

        Schlanker Pfad für reine Steuer-Änderungen: zwei Channex-Calls statt
        des vollen Content-Syncs. Setzt ein bestehendes Mapping voraus — ohne
        registriertes Objekt gibt es keine Channex-Property, an der eine Steuer
        hängen könnte; dann wird der volle Sync gebraucht (der legt sie an), und
        dieser Job meldet das statt still nichts zu tun.
        """
        db = self._db
        if db is None or not self._channex.is_configured:
            return {"synced": False, "reason": "not_configured"}
        pm = (
            db.table("channex_property_map")
            .select("id, channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        channex_property_id = pm[0]["channex_property_id"] if pm else None
        if not channex_property_id or ist_demo_mapping(channex_property_id):
            log.info(
                "tax_sync_uebersprungen_ohne_mapping",
                tenant_id=tenant_id, property_id=property_id,
            )
            return {"synced": False, "reason": "no_mapping"}

        prop = (
            db.table("properties")
            .select("id, type_attributes, currency")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not prop:
            raise ChannelManagerError("Objekt nicht gefunden.", status_code=404)
        prop_row = prop[0]

        # Währung wie im vollen Sync: Objektwährung, sonst der älteste Plan.
        # Kein erfundener Ersatz (Wurzel 4) — ohne Währung kein Betrags-Push.
        rate_plans = (
            db.table("rate_plans")
            .select("currency")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        currency = str(
            prop_row.get("currency")
            or (rate_plans[0].get("currency") if rate_plans else "")
            or ""
        ).upper()
        if not currency:
            raise ChannelManagerError(
                "Objektwährung fehlt — Steuern können nicht übertragen werden.",
                status_code=422,
            )

        # Channex-Rate-Plan-IDs für die Tax-Set-Verknüpfung (Kette
        # property_map → room_type_maps → rate_plan_maps, wie im vollen Sync).
        rt_ids = [
            r["id"]
            for r in (
                db.table("channex_room_type_map")
                .select("id")
                .eq("property_map_id", pm[0]["id"])
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
        ]
        channex_rate_plan_ids = [
            r["channex_rate_plan_id"]
            for r in (
                db.table("channex_rate_plan_map")
                .select("channex_rate_plan_id")
                .in_("room_type_map_id", rt_ids)
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
            if r.get("channex_rate_plan_id")
        ] if rt_ids else []

        try:
            self._sync_taxes(
                db, tenant_id, property_id, channex_property_id,
                channex_rate_plan_ids, currency, prop_row,
            )
        except ChannexError as exc:
            # Denselben Sichtbarkeits-Stempel setzen wie der volle Sync, damit
            # der Heilungs-Tick (worker._enqueue_failed_content_syncs) das
            # Objekt findet, falls dieser Job endgültig stirbt.
            self._mark_property_sync(db, tenant_id, property_id, "error", exc.message)
            raise self._wrap_channex(exc) from exc
        log.info("channex_taxes_only_synced", tenant_id=tenant_id,
                 property_id=property_id)
        return {"synced": True, "channex_property_id": channex_property_id}

    def _prune_removed_taxes(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        taxes: list[dict[str, Any]],
        fees: list[dict[str, Any]] | None = None,
    ) -> None:
        """Lokal gelöschte Steuern UND Gebühren bei Channex entfernen (Wurzel 1).

        Erst bei Channex löschen (`DELETE /taxes/:id` — der dokumentierte Weg),
        dann das Mapping stilllegen: Nur wenn Channex die Steuer wirklich los
        ist, darf die Zuordnung verschwinden. Andernfalls bliebe eine Steuer am
        Portal aktiv, auf die wir keinen Zugriff mehr hätten (verwaiste ID).
        Eine bereits verschwundene Steuer (404) gilt als erledigt.

        `fees` MUSS mitgegeben werden, seit Gebühren mitsynchronisiert werden:
        sie liegen in derselben channex_tax_map, und was hier nicht als „noch
        aktuell" gilt, wird gelöscht. Ohne die Gebühren würde jeder Lauf die
        gerade angelegten Gebühren sofort wieder entfernen.

        Eine Gebühr, die auf `optional` umgestellt wurde, zählt bewusst als
        entfernt — sie wird oben nicht mehr gesendet, also darf sie auch beim
        Portal nicht stehen bleiben.
        """
        aktuelle_ids = {str(t["id"]) for t in taxes if t.get("id")}
        aktuelle_ids |= {
            str(f["id"])
            for f in (fees or [])
            if f.get("id") and not f.get("optional")
        }
        verwaiste = [
            row
            for row in (
                db.table("channex_tax_map")
                .select("id, local_tax_id, channex_tax_id")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
            if str(row.get("local_tax_id")) not in aktuelle_ids
        ]
        entfernt: list[str] = []
        for row in verwaiste:
            channex_tax_id = row.get("channex_tax_id")
            if channex_tax_id:
                try:
                    self._channex.delete_tax(str(channex_tax_id))
                except ChannexError as exc:
                    if exc.channex_status != 404:
                        # Nicht verschlucken (Wurzel 5): das Mapping bleibt
                        # stehen, der nächste Sync versucht es erneut.
                        raise
            entfernt.append(row["id"])
        if entfernt:
            db.table("channex_tax_map").update(
                {"deleted_at": datetime.now(UTC).isoformat()}
            ).in_("id", entfernt).execute()
            log.info(
                "channex_taxes_pruned",
                tenant_id=tenant_id,
                property_id=property_id,
                pruned=len(entfernt),
            )

    def _drop_tax_set(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        channex_property_id: str,
        currency: str,
        channex_tax_ids: list[str],
    ) -> None:
        """Tax-Set entfernen, wenn das Objekt keine Steuer mehr führt.

        Channex hängt ein Tax-Set an ZWEI Stellen fest, die beide gelöst sein
        müssen, bevor `DELETE /tax_sets/:id` durchgeht (live gemessen, nicht
        dokumentiert):

        1. `properties.default_tax_set_id` → sonst
           „Can't remove Tax Set used as default at Property"
        2. `associated_rate_plan_ids` → sonst
           „Can't remove TaxSet associated with at least one RatePlan";
           beim Leeren muss `taxes` mitgeschickt werden, sonst
           „taxes: can't be blank".

        Ohne bestehendes Set: no-op (nie eines nur zum Löschen anlegen).
        """
        vorhanden = (
            db.table("channex_tax_map")
            .select("channex_tax_set_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .not_.is_("channex_tax_set_id", "null")
            .limit(1)
            .execute()
        ).data
        tax_set_id = (vorhanden or [{}])[0].get("channex_tax_set_id")
        if not tax_set_id:
            return
        try:
            # (1) Property-Default lösen.
            self._channex.update_property(
                channex_property_id, {"default_tax_set_id": None}
            )
            # (2) Rate-Plan-Verknüpfung lösen (taxes muss mit).
            self._channex.update_tax_set(
                str(tax_set_id),
                {
                    "title": "Standard",
                    "property_id": channex_property_id,
                    "currency": currency,
                    "taxes": [{"id": tid, "level": 0} for tid in channex_tax_ids],
                    "associated_rate_plan_ids": [],
                },
            )
            # (3) Erst jetzt ist das Set löschbar.
            self._channex.delete_tax_set(str(tax_set_id))
        except ChannexError as exc:
            if exc.channex_status != 404:
                raise
        db.table("channex_tax_map").update({"channex_tax_set_id": None}).eq(
            "tenant_id", tenant_id
        ).eq("property_id", property_id).execute()
        log.info(
            "channex_tax_set_dropped",
            tenant_id=tenant_id,
            property_id=property_id,
        )
