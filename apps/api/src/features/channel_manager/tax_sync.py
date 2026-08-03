"""Channex-Steuern und -Gebühren eines Objekts → Channex taxes + tax_sets.

Eigenes Modul, weil das ein abgeschlossenes Thema mit eigener Fachlogik ist: der
schlanke Sync-Pfad für reine Abgaben-Änderungen, die Buchführung über die
Channex-IDs und der Gegenzustand beim Löschen. Mixin des ChannelManagerService;
State (_db/_channex) kommt von der Fassade.

WAS an welches Portal geht, steht NICHT hier, sondern in `ota_abgaben.py` — das
ist der Branchenstandard als Regelwerk. Hier steht nur, WIE es zu Channex kommt.

Zentral dabei: jedes Portal bekommt sein EIGENES Channex-Steuer-/Gebühren-Objekt.
Channex führt `is_inclusive` und `logic` an der Steuer, nicht am Tax-Set — ein
gemeinsames Objekt könnte deshalb nicht gleichzeitig „bei Booking im Zimmerpreis"
und „bei Airbnb getrennt ausgewiesen" sein. Genau daran scheiterte der frühere
Aufbau: der Widerspruch wurde nur protokolliert und eine Seite still falsch
bespielt.

Channex-Vokabular (docs: taxes-and-tax-sets, live geprüft 03.08.2026):
`logic` ∈ percent | per_room | per_room_per_night | per_person |
per_person_per_night | per_night | per_booking, `type` ∈ tax | fee | city_tax.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from .channex_client import ChannexError
from .common import ChannelManagerError, ist_demo_mapping, log
from .ota_abgaben import (
    AIRBNB,
    PORTAL_REGELN,
    SZENARIO_INELIGIBLE,
    Abgabe,
    abgaben_je_portal,
    diagnose_protokollieren,
)
from .tax_regime import STANDARD, TaxRegimeMixin


class TaxSyncMixin(TaxRegimeMixin):
    """Steuer- und Gebühren-Sync eines Objekts nach Channex."""

    def _sync_taxes(  # pylint: disable=too-many-arguments,too-many-locals
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
        channex_tax_map.

        Steuern und Gebühren sind bei Channex DASSELBE Objekt (`/taxes`,
        unterschieden nur durch `type` ∈ tax|fee|city_tax), deshalb laufen sie
        durch denselben Upsert.

        Der Ablauf in einem Satz: für jedes Ziel (Standard-Set und je Portal mit
        eigenem Kanal-Plan) fragt der Sync das Regelwerk, welche Posten dieses
        Ziel bekommt, legt sie als eigene Channex-Objekte an und hängt sie in
        das Set dieses Ziels. Was kein Ziel mehr will, wird bei Channex
        gelöscht (Wurzel 1).
        """
        attrs = prop_row.get("type_attributes") or {}
        pricing = attrs.get("pricing") or {}
        taxes = [t for t in (pricing.get("taxes") or []) if isinstance(t, dict)]
        fees = [f for f in (pricing.get("fees") or []) if isinstance(f, dict)]

        # Steuerregime der verbundenen Portale — LIVE aus dem Channex-Katalog +
        # den echten Kanal-Einstellungen (tax_regime.py). Ein Portal, das die
        # Steuer selbst zum Gastpreis rechnet (Airbnb „Payout Amount", Expedia
        # „Collect Amount"), bekommt sie nicht zusätzlich.
        regime = self.regime_je_portal(db, tenant_id, property_id)
        airbnb_steuern_erlaubt = self._airbnb_steuern_erlaubt(
            db, tenant_id, property_id
        )

        ziele, standard_plans, plaene_je_portal = self._sync_ziele(
            db, tenant_id, property_id, channex_rate_plan_ids,
            taxes=taxes, fees=fees, regime=regime,
        )

        gesetzte_set_ids: list[str] = []
        lebende_map_ids: list[str] = []
        anzahl_posten = 0
        for portal in ziele:
            plaene = standard_plans if portal is None else plaene_je_portal[portal]
            reg = STANDARD if portal is None else regime.get(portal, STANDARD)
            posten, diagnose = abgaben_je_portal(
                portal=portal,
                taxes=taxes,
                fees=fees,
                currency=currency,
                objekt_inklusiv_erlaubt=reg.senden,
                airbnb_steuern_erlaubt=airbnb_steuern_erlaubt,
            )
            diagnose_protokollieren(
                tenant_id=tenant_id,
                property_id=property_id,
                portal=portal,
                diagnose=diagnose,
            )
            set_taxes: list[dict[str, Any]] = []
            for eintrag in posten:
                channex_tax_id, map_id = self._upsert_abgabe(
                    db, tenant_id, property_id, channex_property_id,
                    portal=portal, abgabe=eintrag,
                )
                if not channex_tax_id:
                    continue
                set_taxes.append({"id": channex_tax_id, "level": eintrag.level})
                if map_id:
                    lebende_map_ids.append(map_id)
            anzahl_posten += len(set_taxes)
            set_id = self._upsert_tax_set(
                db, tenant_id, property_id, channex_property_id, currency,
                portal=portal,
                titel="Standard" if portal is None else f"Standard · {portal}",
                taxes=set_taxes,
                rate_plan_ids=plaene,
            )
            if set_id:
                gesetzte_set_ids.append(set_id)

        # Portal-Sets, die es nicht mehr braucht (Kanal-Plan entfernt, Portal
        # abgeschaltet), abräumen — sonst bliebe bei Channex ein verwaistes Set
        # mit einer alten Zusammenstellung stehen (Wurzel 1).
        self._prune_portal_tax_sets(db, tenant_id, property_id, gesetzte_set_ids)
        # ERST danach die überzähligen Posten löschen: die Sets tragen jetzt nur
        # noch die aktuellen IDs, damit ist der alte Posten nicht mehr
        # referenziert und `DELETE /taxes/:id` wird von Channex akzeptiert
        # („can't be remove because used at TaxSet", live gemessen).
        self._prune_verwaiste_abgaben(db, tenant_id, property_id, lebende_map_ids)
        log.info(
            "channex_taxes_synced",
            tenant_id=tenant_id,
            property_id=property_id,
            taxes=len(taxes),
            fees=len([f for f in fees if not f.get("optional")]),
            posten=anzahl_posten,
            tax_sets=len(gesetzte_set_ids),
        )

    def _airbnb_steuern_erlaubt(
        self, db: Client, tenant_id: str, property_id: str
    ) -> bool:
        """Darf Airbnb die Steuern dieses Objekts überhaupt bekommen?

        Der Branchenstandard hängt die Steuerübertragung an Airbnb an drei
        Bedingungen: das Steuererhebungsszenario darf nicht „ineligible" sein
        (dann erhebt Airbnb selbst bzw. unterstützt keine Beherbergungssteuern),
        der Betrieb muss bestätigt haben, das Szenario verstanden zu haben, und
        „Benutzungssteuern senden" muss an sein.

        FAIL-CLOSED (Wurzel 5): ohne erfasstes Szenario gehen keine Steuern an
        Airbnb. Eine doppelt berechnete Kurtaxe zahlt der Gast; ein nicht
        übertragener Satz fällt beim Betrieb auf und ist ein Klick.
        """
        try:
            rows = (
                db.table("channex_channel_connection")
                .select(
                    "airbnb_tax_scenario, airbnb_tax_acknowledged, "
                    "airbnb_send_user_taxes"
                )
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .eq("ota_portal_code", AIRBNB)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fail-closed, siehe Docstring
            log.warning(
                "airbnb_steuerszenario_nicht_ladbar",
                property_id=property_id,
                error=str(exc),
            )
            return False
        if not rows:
            return False
        row = rows[0]
        szenario = row.get("airbnb_tax_scenario")
        if not szenario or szenario == SZENARIO_INELIGIBLE:
            return False
        return bool(row.get("airbnb_tax_acknowledged")) and bool(
            row.get("airbnb_send_user_taxes")
        )

    def _sync_ziele(  # pylint: disable=too-many-arguments
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        channex_rate_plan_ids: list[str],
        *,
        taxes: list[dict[str, Any]],
        fees: list[dict[str, Any]],
        regime: dict[str, Any],
    ) -> tuple[list[str | None], list[str], dict[str, list[str]]]:
        """Welche Sets dieser Lauf bespielt: `None` (Standard) plus je Portal.

        Ein Portal braucht ein EIGENES Set, sobald für es etwas anderes gilt als
        für den Rest — und das ist der Normalfall, nicht die Ausnahme:

        * es hat eine Sonderregel (Booking.com, Airbnb, Expedia),
        * ein Posten ist ausdrücklich auf es eingeschränkt (`portalScope`),
        * oder es rechnet die Steuer selbst zum Gastpreis (`regime.senden`).

        Ein eigenes Set gibt es nur an einem eigenen Kanal-Plan (Channex kennt
        keine Kanal-Achse an der Steuer, nur `tax_set_id` am Rate-Plan). Fehlt
        der Plan, legt der Sync ihn selbst an — mit offset_percent 0, denn
        gewollt ist kein anderer PREIS, nur eine andere Zusammenstellung.
        """
        gebraucht = {p for p in regime if p in PORTAL_REGELN}
        gebraucht |= {p for p, r in regime.items() if not r.senden}
        for eintrag in (*taxes, *fees):
            scope = eintrag.get("portalScope")
            if isinstance(scope, list):
                gebraucht |= {str(x) for x in scope if str(x) in regime}

        plan_ids = list(dict.fromkeys(channex_rate_plan_ids))
        scope_je_plan = self._portal_scope_je_channex_plan(
            db, tenant_id, property_id
        )
        fehlend = sorted(gebraucht - set(scope_je_plan.values()))
        if fehlend:
            neu = self._kanalplaene_nachziehen(
                db, tenant_id, property_id, fehlend
            )
            if neu:
                plan_ids = list(dict.fromkeys([*plan_ids, *neu]))
                scope_je_plan = self._portal_scope_je_channex_plan(
                    db, tenant_id, property_id
                )

        plaene_je_portal: dict[str, list[str]] = {}
        standard_plans: list[str] = []
        for rp in plan_ids:
            portal = scope_je_plan.get(rp)
            if portal:
                plaene_je_portal.setdefault(portal, []).append(rp)
            else:
                standard_plans.append(rp)

        # Ein Portal, für das eine Sonderregel gilt, das aber keinen eigenen
        # Kanal-Plan hat, hängt am Standard-Set und bekommt damit die falsche
        # Zusammenstellung. Sichtbar machen statt stumm falsch senden.
        for portal in sorted(gebraucht - set(plaene_je_portal)):
            log.warning(
                "channex_portal_ohne_kanalplan",
                tenant_id=tenant_id,
                property_id=property_id,
                portal=portal,
            )
        return (
            [None, *sorted(plaene_je_portal)],
            standard_plans,
            plaene_je_portal,
        )

    def _upsert_abgabe(  # pylint: disable=too-many-arguments
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        channex_property_id: str,
        *,
        portal: str | None,
        abgabe: Abgabe,
    ) -> tuple[str | None, str | None]:
        """Einen Posten bei Channex anlegen/aktualisieren und mappen.

        Der Schlüssel ist (Objekt, lokale Kennung, Portal): dasselbe lokale
        Objekt existiert bei Channex je Portal einmal, weil `is_inclusive` und
        `logic` an der Steuer hängen und sich je Portal unterscheiden.

        Gibt (Channex-ID, Mapping-Zeilen-ID) zurück. Die Mapping-ID braucht der
        Aufrufer, um am Ende zu wissen, welche Zeilen noch gebraucht werden.
        """
        attrs = {**abgabe.attrs, "property_id": channex_property_id}
        bestand = (
            db.table("channex_tax_map")
            .select("id, channex_tax_id")
            .eq("property_id", property_id)
            .eq("local_tax_id", abgabe.schluessel)
            .is_("deleted_at", "null")
        )
        bestand = (
            bestand.is_("portal_scope", "null")
            if portal is None
            else bestand.eq("portal_scope", portal)
        )
        vorhanden = (bestand.limit(1).execute()).data or []
        if vorhanden:
            channex_tax_id = str(vorhanden[0]["channex_tax_id"])
            self._channex.update_tax(channex_tax_id, attrs)
            return channex_tax_id, str(vorhanden[0]["id"])

        created = self._channex.create_tax(attrs)
        channex_tax_id = (created.get("data") or {}).get("id")
        if not channex_tax_id:
            return None, None
        # Eine früher stillgelegte Zeile desselben Schlüssels reaktivieren, statt
        # eine zweite anzulegen: die Unique-Indizes laufen OHNE deleted_at, ein
        # blinder Insert liefe in 23505. Tritt real auf, wenn eine Gebühr
        # gelöscht und dieselbe UI-Kennung neu verwendet wird (Wurzel 2).
        alt = (
            db.table("channex_tax_map")
            .select("id")
            .eq("property_id", property_id)
            .eq("local_tax_id", abgabe.schluessel)
        )
        alt = (
            alt.is_("portal_scope", "null")
            if portal is None
            else alt.eq("portal_scope", portal)
        )
        stillgelegt = (alt.limit(1).execute()).data or []
        if stillgelegt:
            map_id = str(stillgelegt[0]["id"])
            db.table("channex_tax_map").update(
                {"channex_tax_id": channex_tax_id, "deleted_at": None}
            ).eq("id", map_id).execute()
            return str(channex_tax_id), map_id
        try:
            neu = (
                db.table("channex_tax_map")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "local_tax_id": abgabe.schluessel,
                        "portal_scope": portal,
                        "channex_tax_id": channex_tax_id,
                    }
                )
                .execute()
            ).data or []
        except APIError as exc:
            # 23505 = ein paralleler Lauf war schneller (voller Content-Sync und
            # sync_taxes_only sind nur je Typ dedupliziert, nicht gegeneinander).
            # Das eigene, gerade angelegte Objekt ist dann das überzählige.
            if getattr(exc, "code", None) != "23505":
                raise
            log.info(
                "channex_abgabe_parallel_angelegt_verworfen",
                tenant_id=tenant_id,
                property_id=property_id,
                portal=portal,
                schluessel=abgabe.schluessel,
            )
            self._abgabe_verwerfen(str(channex_tax_id))
            return None, None
        return str(channex_tax_id), (str(neu[0]["id"]) if neu else None)

    def _abgabe_verwerfen(self, channex_tax_id: str) -> None:
        """Ein überzähliges Channex-Objekt entfernen (best-effort).

        Bleibt es stehen, hängt es in keinem Set (es wurde nie zugeordnet) und
        richtet keinen Schaden an — ein Fehler hier darf den Lauf nicht kippen.
        """
        try:
            self._channex.delete_tax(channex_tax_id)
        except ChannexError as exc:  # noqa: BLE001 — best-effort, siehe Docstring
            log.warning(
                "channex_abgabe_verwerfen_fehlgeschlagen",
                channex_tax_id=channex_tax_id,
                error=str(exc),
            )

    def _prune_verwaiste_abgaben(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        lebende_map_ids: list[str],
    ) -> None:
        """Posten löschen, die dieser Lauf für kein Ziel mehr gebraucht hat.

        Das deckt ALLE Wege ab, auf denen ein Posten verschwindet, ohne dass sie
        einzeln aufgezählt werden müssen (Wurzel 1): lokal gelöscht, auf
        `optional` gestellt, aus der Export-Matrix gefallen, von einer
        Kanal-Einschränkung ausgeschlossen, in einer summierten Kategorie
        aufgegangen, Portal-Verbindung getrennt. Wer nicht in dieser Runde
        gesetzt wurde, gehört nicht mehr zum Objekt.

        Erst bei Channex löschen, dann das Mapping stilllegen: nur wenn Channex
        den Posten wirklich los ist, darf die Zuordnung verschwinden. Sonst
        bliebe eine Gebühr am Portal aktiv, auf die wir keinen Zugriff mehr
        hätten. Ein bereits verschwundener Posten (404) gilt als erledigt.
        """
        lebend = set(lebende_map_ids)
        verwaiste = [
            row
            for row in (
                db.table("channex_tax_map")
                .select("id, local_tax_id, channex_tax_id, portal_scope")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .is_("deleted_at", "null")
                .execute()
            ).data
            or []
            if str(row["id"]) not in lebend
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
        # `channex_tax_map.channex_tax_set_id` wird BEWUSST nicht mehr
        # mitgeschrieben: welches Set zu welchem Portal gehört, steht in
        # channex_tax_set_map (0273). Die Altspalte hätte je Posten nur EINE
        # Set-ID tragen können — seit ein Posten je Portal existiert, wäre der
        # Wert nur noch irreführend. Eine Spalte, die geschrieben aber nirgends
        # gelesen wird, ist eine Attrappe; siehe Kommentar in 0274.
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

        Arbeitet für Standard- und Portal-Set über die übergebene `set_id`. Beim
        Standard-Set kommt das Lösen des Property-Defaults dazu (ein Portal-Set
        ist nie Default) und die stillgelegte Altspalte wird mitgenullt.
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
            # Altspalte mitnullen: sie wird nicht mehr gepflegt (siehe
            # _upsert_tax_set), und ein Bestandswert, der auf ein gelöschtes Set
            # zeigt, wäre beim Nachsehen in der DB irreführend.
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
