"""Ein Portal, ein Objekt — alles, was zu diesem Paar gehört.

Die Kanal-Detailseite zeigt ALLE Objekte eines Portals, die Objekt-Sicht
„Synchronisierung" ALLE Portale eines Objekts. Hier steht das Paar selbst:
unter welcher Kennung dieses Objekt bei diesem Portal läuft, ob dorthin
verkauft wird und wann zuletzt abgeglichen wurde — dasselbe, was Lodgify hinter
dem Stift seiner Kanalzeile zeigt.

Bewusst NICHT enthalten: eine „Inserats-Qualität" — Channex kennt kein solches
Maß (die API-Doku führt „score" nur bei Gästebewertungen, und
`GET /properties/{id}/scores` antwortet am Staging-Server mit 404).

Alle Angaben kommen aus UNSEREN Daten, nicht aus einem Rückruf beim
Aggregator.
"""

from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped
from src.jobs.queue import dedup_key, enqueue, try_enqueue_tax_sync

from .channex_client import ChannexError
from .common import ChannelManagerError, log
from .ota_abgaben import AIRBNB, AIRBNB_SZENARIEN, SZENARIO_INELIGIBLE


class ObjektKanalMixin:
    """Detailsicht Portal × Objekt (`channel_property_detail`)."""

    def channel_property_detail(
        self, ctx: AuthContext, property_id: str, portal_code: str
    ) -> dict[str, Any]:
        """Was dieses Objekt bei diesem einen Portal ist und tut.

        Wurzel 3: Objekt per ID NUR mit Tenant-Scope laden. Wurzel 9: derselbe
        Scope wie die Liste — `list_channel_connections` filtert auf
        (tenant_id, property_id), also tut es diese Detailsicht auch.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        prop = load_scoped(
            db,
            "properties",
            property_id,
            tenant_id,
            columns="id, title, currency",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )

        conn_rows = (
            db.table("channex_channel_connection")
            .select(
                "ota_hotel_id, ota_room_type_code, ota_room_title, "
                "channex_channel_id, channex_property_id, is_active, "
                "last_error, updated_at, airbnb_tax_scenario, "
                "airbnb_tax_acknowledged, airbnb_send_user_taxes"
            )
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data or []
        if not conn_rows:
            raise ChannelManagerError(
                "Dieses Objekt ist mit diesem Portal nicht verbunden.",
                status_code=404,
            )
        conn = conn_rows[0]

        map_rows = (
            db.table("channex_property_map")
            .select("id, sync_enabled, last_sync_at, last_sync_status, last_sync_error")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data or []
        pmap = map_rows[0] if map_rows else {}

        return {
            "portal_code": portal_code,
            "portal": self._portal_label(portal_code),
            "property_id": property_id,
            "property_title": prop.get("title"),
            "currency": prop.get("currency"),
            "hotel_id": conn.get("ota_hotel_id"),
            "ota_room_type_code": conn.get("ota_room_type_code"),
            "ota_room_title": conn.get("ota_room_title"),
            "channel_id": conn.get("channex_channel_id"),
            "is_active": bool(conn.get("is_active")),
            "last_error": conn.get("last_error"),
            "updated_at": conn.get("updated_at"),
            "map_id": pmap.get("id"),
            "sync_enabled": bool(pmap.get("sync_enabled")),
            "last_sync_at": pmap.get("last_sync_at"),
            "last_sync_status": pmap.get("last_sync_status"),
            "last_sync_error": pmap.get("last_sync_error"),
            "property_photo": self._cover_photo(db, property_id),
            "rate_plans": self._rate_plans_of_property(db, tenant_id, property_id),
            "dynamic_pricing_enabled": self._dynamic_pricing_enabled(
                db, property_id
            ),
            # Preisänderung dieses Portals (Lodgify-Modell): der offset_percent
            # des automatisch gepflegten Kanal-Plans; 0 = kein Aufschlag.
            "price_adjustment_percent": self._portal_adjustment_percent(
                db, property_id, portal_code
            ),
            # Airbnb-Steuererhebung. Nur bei Airbnb gepflegt; bei anderen
            # Portalen bleiben die Werte auf ihren Spalten-Defaults und die
            # Oberfläche zeigt den Block nicht.
            "airbnb_tax_scenario": conn.get("airbnb_tax_scenario"),
            "airbnb_tax_acknowledged": bool(conn.get("airbnb_tax_acknowledged")),
            "airbnb_send_user_taxes": bool(conn.get("airbnb_send_user_taxes")),
        }

    def set_airbnb_tax_settings(  # pylint: disable=too-many-arguments
        self,
        ctx: AuthContext,
        property_id: str,
        portal_code: str,
        *,
        scenario: str | None,
        acknowledged: bool,
        send_user_taxes: bool,
    ) -> dict[str, Any]:
        """Airbnb-Steuererhebung dieses Inserats pflegen.

        Drei Werte, wie im Branchenstandard: das Szenario (was Airbnb selbst
        tut), die Bestätigung, es verstanden zu haben, und der Schalter
        „Benutzungssteuern senden". Erst wenn alle drei passen, gehen Steuern an
        Airbnb (siehe tax_sync._airbnb_steuern_erlaubt).

        Zwei Abhängigkeiten werden hier erzwungen, nicht nur in der Oberfläche
        (Wurzel 3 — der Anfrage nicht vertrauen):

        * `ineligible` heißt, Airbnb erhebt selbst bzw. unterstützt keine
          Beherbergungssteuern — ein Export ist dort GAR NICHT möglich, also
          fallen beide Schalter aus.
        * „Senden" ohne Bestätigung gibt es nicht.
        """
        if portal_code != AIRBNB:
            raise ChannelManagerError(
                "Steuererhebungs-Einstellungen gibt es nur für Airbnb.",
                status_code=422,
            )
        if scenario is not None and scenario not in AIRBNB_SZENARIEN:
            raise ChannelManagerError(
                f"Unbekanntes Steuererhebungsszenario: {scenario}",
                status_code=422,
            )
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        # Wurzel 3/9: dieselbe Achse wie die Detailsicht — Tenant UND Objekt.
        vorhanden = (
            db.table("channex_channel_connection")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data or []
        if not vorhanden:
            raise ChannelManagerError(
                "Dieses Objekt ist mit diesem Portal nicht verbunden.",
                status_code=404,
            )
        if scenario == SZENARIO_INELIGIBLE:
            acknowledged = False
            send_user_taxes = False
        elif not acknowledged:
            send_user_taxes = False
        db.table("channex_channel_connection").update(
            {
                "airbnb_tax_scenario": scenario,
                "airbnb_tax_acknowledged": acknowledged,
                "airbnb_send_user_taxes": send_user_taxes,
            }
        ).eq("id", vorhanden[0]["id"]).execute()
        # Der Schalter ändert, WAS Airbnb bekommt — also muss das Set neu
        # zusammengestellt werden. Ohne diesen Anstoß wirkte die Änderung erst
        # beim nächsten Preis-/Content-Update (Wurzel 1: Gegenzustand pflegen).
        try_enqueue_tax_sync(db, tenant_id, property_id)
        log.info(
            "airbnb_steuererhebung_gesetzt",
            tenant_id=tenant_id,
            property_id=property_id,
            scenario=scenario,
            acknowledged=acknowledged,
            send_user_taxes=send_user_taxes,
        )
        return {
            "portal_code": portal_code,
            "property_id": property_id,
            "airbnb_tax_scenario": scenario,
            "airbnb_tax_acknowledged": acknowledged,
            "airbnb_send_user_taxes": send_user_taxes,
        }

    @staticmethod
    def _portal_adjustment_percent(
        db: Client, property_id: str, portal_code: str
    ) -> float:
        """offset_percent des Kanal-Plans dieses Portals (0 = keiner).

        property_id ist beim Aufrufer bereits tenant-gescoped (Wurzel 3)."""
        rows = (
            db.table("rate_plans")
            .select("offset_percent")
            .eq("property_id", property_id)
            .eq("portal_scope", portal_code)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return 0.0
        try:
            return float(rows[0].get("offset_percent") or 0)
        except (TypeError, ValueError):
            return 0.0

    def set_portal_price_adjustment(
        self, ctx: AuthContext, property_id: str, portal_code: str,
        percent: float,
    ) -> dict[str, Any]:
        """Preisänderung je Portal setzen (Lodgify-Modell) — EIN Mechanismus.

        Umgesetzt über einen automatisch gepflegten KANAL-PLAN: ein abgeleiteter
        Rate-Plan (derived vom Grundpreis-Plan, offset_percent = Aufschlag,
        `portal_scope` = Portal), dessen Channex-Rate am Kanal dieses Portals
        die Standard-Rate ERSETZT. Damit gilt der Aufschlag auf die komplette
        effektive Tageskurve (inkl. Dynamic Pricing) — der Resolver rechnet
        abgeleitete Kurven längst, der ARI-Push pusht sie längst.

        percent == 0 nimmt den Gegenzustand vollständig zurück (Wurzel 1):
        Mapping zurück auf den Standard, Kanal-Plan gelöscht, Channex-Rest
        über den Content-Sync abgeräumt.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        load_scoped(
            db, "properties", property_id, tenant_id, columns="id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        conn = (
            db.table("channex_channel_connection")
            .select("channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data or []
        if not conn or not conn[0].get("channex_channel_id"):
            raise ChannelManagerError(
                "Dieses Objekt ist mit diesem Portal nicht verbunden.",
                status_code=404,
            )
        channel_id = conn[0]["channex_channel_id"]

        primary_id = self._primary_rate_plan_id(db, tenant_id, property_id)
        if not primary_id:
            raise ChannelManagerError(
                "Das Objekt hat keinen bei den Portalen registrierten Preisplan.",
                status_code=422,
            )
        standard_rows = (
            db.table("rate_plans")
            .select("id, name, base_price, currency, min_stay")
            .eq("id", primary_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not standard_rows:
            raise ChannelManagerError(
                "Grundpreis-Plan nicht gefunden.", status_code=422
            )
        standard = standard_rows[0]

        kanalplan = (
            db.table("rate_plans")
            .select("id, offset_percent")
            .eq("property_id", property_id)
            .eq("portal_scope", portal_code)
            .limit(1)
            .execute()
        ).data or []

        if percent == 0:
            if kanalplan:
                kp_id = kanalplan[0]["id"]
                kp_cx = self._channex_id_for_local_plan(db, tenant_id, kp_id)
                # Gegenzustand: ERST das Mapping zurück auf den Standard —
                # ein am Kanal hängender Plan darf nicht gelöscht werden
                # (Löschkette fail-closed), und das Portal braucht lückenlos
                # eine Rate.
                self._swap_channel_rate_plan(
                    db, tenant_id, channel_id,
                    von_lokal=kp_id, nach_lokal=primary_id,
                )
                db.table("rate_plans").delete().eq("id", kp_id).execute()
                # Channex-seitigen Rest abräumen + Kurve neu abgleichen.
                self.sync_content(tenant_id, property_id=property_id)
                self._enqueue_price_reconcile(db, tenant_id, property_id)
                # Gegenzustand VERIFIZIEREN, nicht annehmen (Wurzel 1 + 5).
                # Vorher gab dieser Zweig unbesehen `percent: 0` zurück — die
                # Oberfläche meldete „kein Aufschlag", während der Kanal-Plan
                # weiterlief. Genau dieser Zustand lag live vor (23.08.2026):
                # 18 Zeilen mit `offset_percent = 0`, die nie zurückgetauscht
                # wurden. Eine unbelegte Behauptung „zurückgenommen" ist
                # schlimmer als ein Fehler, weil niemand nachsieht.
                self._rueckweg_pruefen(
                    db, tenant_id, property_id, portal_code,
                    channel_id=channel_id, kanalplan_id=kp_id,
                    kanalplan_channex_id=kp_cx,
                )
            return {"portal_code": portal_code, "percent": 0.0}

        if kanalplan:
            db.table("rate_plans").update({"offset_percent": percent}).eq(
                "id", kanalplan[0]["id"]
            ).execute()
            self.sync_content(tenant_id, property_id=property_id)
            # Auch hier die Zuordnung sicherstellen: existiert der Kanal-Plan
            # schon, lief bisher NUR das Update — ob er am Kanal überhaupt
            # zugeordnet ist, prüfte niemand. Bei „Feriehus Grævlinge" war er es
            # nicht (Kanal mit 0 Mappings), der Aufschlag blieb eine reine
            # Bildschirmangabe. Der Swap unten ist idempotent: ist die Rate
            # bereits zugeordnet, ändert er nichts.
            self._swap_channel_rate_plan(
                db, tenant_id, channel_id,
                von_lokal=primary_id, nach_lokal=kanalplan[0]["id"],
            )
        else:
            db.table("rate_plans").insert({
                "property_id": property_id,
                "name": (
                    f"{standard.get('name') or 'Standard'}"
                    f" · {self._portal_label(portal_code)}"
                ),
                "base_price": standard.get("base_price"),
                "currency": standard.get("currency"),
                "min_stay": standard.get("min_stay"),
                "rate_mode": "derived",
                "derived_from_rate_plan_id": primary_id,
                "offset_percent": percent,
                "offset_amount": None,
                # NICHT über die Zusatz-Freigabe mappen — der Kanal-Plan geht
                # ausschließlich über portal_scope an SEIN Portal.
                "send_to_portals": False,
                "portal_scope": portal_code,
            }).execute()
            # Channex-Rate-Plan synchron anlegen — gleich danach wird gemappt.
            self.sync_content(tenant_id, property_id=property_id)
            neu = (
                db.table("rate_plans")
                .select("id")
                .eq("property_id", property_id)
                .eq("portal_scope", portal_code)
                .limit(1)
                .execute()
            ).data or []
            if not neu:
                raise ChannelManagerError(
                    "Kanal-Plan konnte nicht angelegt werden.", status_code=500
                )
            self._swap_channel_rate_plan(
                db, tenant_id, channel_id,
                von_lokal=primary_id, nach_lokal=neu[0]["id"],
            )
        self._enqueue_price_reconcile(db, tenant_id, property_id)
        return {"portal_code": portal_code, "percent": float(percent)}

    def _rueckweg_pruefen(  # pylint: disable=too-many-arguments
        self, db: Client, tenant_id: str, property_id: str, portal_code: str,
        *, channel_id: str, kanalplan_id: str,
        kanalplan_channex_id: str | None,
    ) -> None:
        """Nachweisen, dass die Rücknahme auf 0 % wirklich gelandet ist.

        Drei Stellen, die alle stimmen müssen — geprüft wird die Wirkung, nicht
        der Aufruf:

        1. Die lokale Zeile ist weg. Bleibt sie stehen, zeigt die Detailsicht
           beim nächsten Laden wieder einen Aufschlag (`_portal_adjustment_percent`
           liest genau diese Zeile), und `_selected_rate_plan_ids` schiebt den
           Plan weiter als Primary an das Portal.
        2. Der Kanal trägt die Kanal-Rate nicht mehr. Sonst pushen wir auf zwei
           Channex-Rate-Plans, während das Portal einen liest — jeder ARI-Push
           doppelt (live gemessen 23.08.2026 an 17 von 18 Booking-Kanälen).
        3. Der Kanal trägt STATTDESSEN den Grundpreis. Eine ungemappte Rate
           verschluckt laut Channex-Doku eine Buchung („if an unmapped rate is
           booked on a connected channel, the reservation will not be sent
           through") — ein leerer Kanal ist also kein akzeptabler Endzustand.

        Schlägt eine Prüfung fehl, wird das GESAGT (500), nicht still
        quittiert: der Betrieb muss wissen, dass der Aufschlag beim Portal noch
        steht. Ein Fehler beim LESEN des Kanals ist dagegen kein Beweis für
        einen kaputten Zustand — er wird protokolliert und nicht als Erfolg
        ausgegeben.
        """
        rest = (
            db.table("rate_plans")
            .select("id")
            .eq("id", kanalplan_id)
            .limit(1)
            .execute()
        ).data or []
        if rest:
            raise ChannelManagerError(
                "Die Preisänderung konnte nicht zurückgenommen werden — der "
                "Kanal-Preisplan besteht weiter. Bitte erneut versuchen.",
                status_code=500,
            )
        primary_id = self._primary_rate_plan_id(db, tenant_id, property_id)
        primary_cx = (
            self._channex_id_for_local_plan(db, tenant_id, primary_id)
            if primary_id else None
        )
        try:
            aktuell = self._channex.get_channel(channel_id)
        except ChannexError as exc:
            # Nicht lesbar heißt nicht kaputt. Kein stiller Erfolg, aber auch
            # kein erfundener Fehlerzustand (Wurzel 4).
            log.warning(
                "portal_adjustment_rueckweg_ungeprueft",
                property_id=property_id, portal=portal_code,
                channel_id=channel_id, error=str(exc)[:200],
            )
            return
        plans = (
            ((aktuell.get("data") or {}).get("attributes") or {}).get("rate_plans")
            or []
        )
        am_kanal = {str(p.get("rate_plan_id")) for p in plans}
        if kanalplan_channex_id and str(kanalplan_channex_id) in am_kanal:
            raise ChannelManagerError(
                "Die Preisänderung konnte nicht zurückgenommen werden — das "
                "Portal liest weiter den Kanal-Preisplan. Bitte erneut "
                "versuchen.",
                status_code=500,
            )
        if primary_cx and str(primary_cx) not in am_kanal:
            raise ChannelManagerError(
                "Nach dem Zurücknehmen liegt am Portal kein Preisplan mehr. "
                "Bitte die Zuordnung unter „Synchronisierung“ prüfen — eine "
                "nicht zugeordnete Rate nimmt keine Buchung an.",
                status_code=500,
            )
        log.info(
            "portal_adjustment_rueckweg_verifiziert",
            property_id=property_id, portal=portal_code,
            channel_id=channel_id,
        )

    def _swap_channel_rate_plan(
        self, db: Client, tenant_id: str, channel_id: str,
        *, von_lokal: str, nach_lokal: str,
    ) -> None:
        """Im rate_plans-Array eines Channex-Kanals jede Zuordnung von einem
        lokalen Plan auf einen anderen umhängen (Standard ↔ Kanal-Plan).

        PUT ersetzt das Array komplett — gelesen wird der Ist-Stand, nur die
        rate_plan_id der betroffenen Einträge wechselt, die OTA-settings
        (Zimmer-/Raten-Codes) bleiben unangetastet (Wurzel 1)."""
        von_cx = self._channex_id_for_local_plan(db, tenant_id, von_lokal)
        nach_cx = self._channex_id_for_local_plan(db, tenant_id, nach_lokal)
        if not von_cx or not nach_cx:
            raise ChannelManagerError(
                "Preisplan ist nicht bei den Portalen registriert.",
                status_code=422,
            )
        try:
            current = self._channex.get_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        attrs = (current.get("data") or {}).get("attributes") or {}
        plans = attrs.get("rate_plans") or []
        getauscht = 0
        neu_plans: list[dict[str, Any]] = []
        for p in plans:
            rid = p.get("rate_plan_id")
            if rid == von_cx:
                rid = nach_cx
                getauscht += 1
            neu_plans.append(
                {"rate_plan_id": rid, "settings": p.get("settings") or {}}
            )
        if not getauscht:
            # Nichts zu tauschen. Zwei sehr verschiedene Lagen — die Reihenfolge
            # der Prüfung ist der Punkt:
            #
            # (a) Die ZIEL-Rate ist bereits zugeordnet. Dann ist alles in
            #     Ordnung und es gibt nichts zu tun. Ohne diese Prüfung lief der
            #     Code in `POST …/mappings` und Channex antwortete 422 „rate plan
            #     already exists" — das Speichern schlug fehl, obwohl der Zustand
            #     stimmte (Wurzel 2).
            # (b) Der Kanal trägt für dieses Objekt gar keine Rate. Dann wird die
            #     Zuordnung angelegt, statt still zurückzukehren: sonst stünde
            #     der Aufschlag in der Oberfläche und ginge an kein Portal.
            #
            # Angelegt wird über `POST …/mappings` — NICHT über das rate_plans-
            # Array unten: `PUT channels/{id}` antwortet darauf 200 und speichert
            # nichts (live gemessen, siehe `create_channel_mapping`).
            if any(p.get("rate_plan_id") == nach_cx for p in plans):
                return
            self._kanal_zuordnung_anlegen(
                db, channel_id, nach_cx, nach_lokal, bestand=plans,
            )
            return
        try:
            self._channex.update_channel(channel_id, {"rate_plans": neu_plans})
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

    def _kanal_zuordnung_anlegen(
        self, db: Client, channel_id: str, channex_rate_plan_id: str,
        lokaler_plan_id: str, *, bestand: list[dict[str, Any]] | None = None,
        nur_paar: dict[str, Any] | None = None,
    ) -> None:
        """Den Kanal-Plan erstmalig am Kanal zuordnen (`POST …/mappings`).

        Nötig, wenn der Kanal für dieses Objekt noch keine Rate trägt — dann
        gibt es nichts zu tauschen, und ohne diesen Schritt bliebe der Aufschlag
        eine reine Bildschirmangabe.

        ZWEI PORTALE, ZWEI SCHLÜSSEL — und genau daran fehlte der halbe Weg
        (13.08.2026): Diese Methode verlangte ZWINGEND eine
        `properties.airbnb_listing_id` und sendete `{"listing_id": …}`. Für
        Booking.com gab es damit keinen Pfad: der Aufschlag stand in der
        Oberfläche und lief in eine Airbnb-Fehlermeldung, obwohl das Objekt gar
        keine Airbnb-Anzeige sein musste.

          Airbnb      GENAU EINE Rate je Anzeige („Airbnb allows you to map only
                      1 rate plan") → Schlüssel ist die Listing-ID.
          Booking &   MEHRERE Raten je Zimmer (live bei „Feriehus Rævehulen":
          alle andere Standard Rate 64513248 UND Wochenrate 65402734) →
                      Schlüssel ist das Paar `room_type_code` + `rate_plan_code`.

        WOHER DIE CODES KOMMEN: aus dem BESTEHENDEN Kanal-Mapping (`bestand`),
        nicht aus einem neuen `mapping_details`-Abruf und schon gar nicht aus
        einer geratenen Zahl. Die Codes gehören dem Portal; wir kennen sie nur,
        weil sie beim Verbinden gemappt wurden. Steht dort nichts, wird das
        gesagt statt eine Zuordnung zu erfinden (Wurzel 4).

        JEDE Rate des Portals bekommt den Kanal-Plan, nicht nur die erste: sonst
        gilt der Aufschlag für die Standard Rate und die Wochenrate verkauft
        weiter zum alten Preis. Der Channex-Skill warnt zusätzlich, dass eine
        UNGEMAPPTE Rate eine Buchung verschluckt („if an unmapped rate is booked
        on a connected channel, the reservation will not be sent through") —
        deshalb darf keine Rate unbelegt zurückbleiben.

        `nur_paar` KEHRT DAS UM, für genau einen Fall: einen Plan, der EINE
        Portal-Rate abbildet (`portal_raten_plaene`). Der Aufschlag oben gilt
        dem ZIMMER, ein Portal-Raten-Plan gilt SEINER RATE. Ohne diese
        Einschränkung legte der Lauf den Wochen-Plan (min_stay 7) auch auf die
        Standard Rate — nachgerechnet an Rævlingehuset, Zimmer 1220760101:
        Booking verkaufte die Standard-Rate dann erst ab sieben Nächten. Es
        verstieße zusätzlich gegen die Channex-Eindeutigkeit („One OTA room+rate
        pair should map to at most one local rate plan").
        """
        plan = (
            db.table("rate_plans")
            .select("property_id")
            .eq("id", lokaler_plan_id)
            .limit(1)
            .execute()
        ).data or []
        if not plan:
            raise ChannelManagerError("Preisplan nicht gefunden.", status_code=422)
        prop = (
            db.table("properties")
            .select("airbnb_listing_id")
            .eq("id", plan[0]["property_id"])
            .limit(1)
            .execute()
        ).data or []
        listing_id = prop[0].get("airbnb_listing_id") if prop else None

        if nur_paar is not None:
            # Genau die eine Rate dieses Portal-Raten-Plans (s. Docstring).
            ziele = [nur_paar]
        else:
            ziele = self._zuordnungs_ziele(bestand or [], listing_id)
        if not ziele:
            raise ChannelManagerError(
                "Für dieses Objekt ist an diesem Portal keine Rate zugeordnet. "
                "Verbinde das Objekt zuerst unter „Synchronisierung“ mit dem "
                "Portal.",
                status_code=422,
            )
        for settings in ziele:
            if not self._paar_vom_alten_traeger_loesen(
                channel_id, bestand or [], settings,
                neue_channex_rate_plan_id=channex_rate_plan_id,
            ):
                # Der alte Traeger liess sich nicht loesen → NICHT anlegen.
                # Sonst hat das Paar zwei primaere Eintraege und der alte
                # gewinnt (der gemessene Fehlzustand, s. u.).
                continue
            try:
                self._channex.create_channel_mapping(  # type: ignore[attr-defined]
                    channel_id, channex_rate_plan_id, settings
                )
            except ChannexError as exc:
                # „rate plan already exists" ist kein Fehler, sondern der
                # Zielzustand (Wurzel 2). Channex kennt die Zuordnung besser als
                # unsere Sicht auf das Kanal-Objekt — daraus einen 422 an den
                # Nutzer zu machen hieße, ein gelungenes Speichern als
                # gescheitert zu melden.
                if "already exists" in str(exc).lower():
                    log.info(
                        "portal_adjustment_mapping_bestand_bereits",
                        channel_id=channel_id,
                        rate_plan_id=channex_rate_plan_id,
                    )
                    continue
                raise self._wrap_channex(exc) from exc
            log.info(
                "portal_adjustment_mapping_angelegt",
                channel_id=channel_id, rate_plan_id=channex_rate_plan_id,
                settings=settings,
            )

    @staticmethod
    def _eintrag_ist_vollwertig(eintrag: dict[str, Any]) -> bool:
        """Traegt dieser Kanal-Eintrag ueberhaupt etwas?

        Bei einem PAAR-Kanal (Booking/Expedia: `room_type_code` +
        `rate_plan_code`) nur mit `occupancy` UND `pricing_type` — ohne die
        sendet Channex an dem Eintrag nichts (der gemessene Attrappen-Zustand,
        siehe `_paar_vom_alten_traeger_loesen`).

        Bei Airbnb gibt es diese Felder NICHT: dort ist der Schluessel die
        `listing_id`, und der Bestand fuehrt statt Belegung die Airbnb-Bloecke
        (`pricing_setting`, `availability_rule`, …) — live gegengeprueft am Kanal
        21ec5429. Ein Listing-Eintrag ist deshalb aus sich heraus vollwertig;
        ihn an `occupancy` zu messen hiesse, jede Airbnb-Zuordnung als Attrappe
        zu lesen und bei jedem Lauf erneut anzulegen.
        """
        settings = eintrag.get("settings") or {}
        if settings.get("rate_plan_code") is None:
            return True  # Airbnb & Co. — kein Paar-Kanal
        return (
            settings.get("occupancy") is not None
            and bool(settings.get("pricing_type"))
        )

    def _paar_vom_alten_traeger_loesen(
        self, channel_id: str, bestand: list[dict[str, Any]],
        settings: dict[str, Any], *, neue_channex_rate_plan_id: str,
    ) -> bool:
        """Das OTA-Paar von seinem ALTEN Restriktions-Traeger loesen.

        DER GEGENZUSTAND (Wurzel 1). Ein neuer Eintrag mit `primary_occ: True`
        macht das Paar nicht neu, er verdoppelt es: Channex traegt je OTA-Paar
        hoechstens EINEN lokalen Plan („One OTA room+rate pair should map to at
        most one local rate plan"), und live gewinnt der ALTE. Gemessen am
        23.08.2026 am Kanal von „FeWo *Stjerneskud*"
        (6194a921-b1c8-41b3-8971-f8bf0a645efc): Rate 63941996 hatte drei
        Eintraege, darunter der Grundpreis mit `primary_occ: true` — und das
        Booking-Extranet zeigte an der Wochenrate weiter Mindestaufenthalt 2.

        Geloescht wird EINZELN per `DELETE …/mappings/{mapping_id}` und nicht
        per `PUT channels/{id}` mit neuem Array: der PUT aendert bestehende
        `settings` nachweislich nicht (zweimal live belegt, siehe
        `channex_client`) — er haengt nur an.

        Rueckgabe `True` = es kann angelegt werden (geloest oder nichts zu
        loesen). `False` = fail-closed, NICHT anlegen (Wurzel 5): entweder ist
        kein loeschbarer Traeger auffindbar, oder Channex lehnte das Loeschen
        ab. In beiden Faellen waere das Anlegen der Doppel-Primary-Zustand.

        HEILT DEN LIVE-BESTAND MIT: der kaputte dritte Eintrag (unser Plan ohne
        `primary_occ`) ist selbst kein Traeger — `restriktions_traeger`
        verlangt `primary_occ is True` PLUS `occupancy`. Der naechste Lauf
        findet also den Grundpreis-Eintrag als Traeger, loescht ihn und legt
        unseren Plan mit vollen settings neu an. Der Attrappen-Eintrag bleibt
        dabei stehen; er wird beim naechsten additiven PUT nach der
        Channex-Eindeutigkeit ohnehin nicht mehr gebraucht, und ihn hier
        blindlings mitzuloeschen hiesse, aus einem Fehlzustand eine
        Loesch-Heuristik zu machen.
        """
        from .portal_raten_plaene import NICHTS_ZU_LOESEN, alter_traeger_mapping_id

        mapping_id = alter_traeger_mapping_id(
            bestand,
            settings.get("room_type_code"),
            settings.get("rate_plan_code"),
            neue_channex_rate_plan_id=neue_channex_rate_plan_id,
        )
        if mapping_id is NICHTS_ZU_LOESEN:
            return True
        if not isinstance(mapping_id, str):
            return False
        try:
            self._channex.delete_channel_mapping(  # type: ignore[attr-defined]
                channel_id, mapping_id
            )
        except ChannexError as exc:
            # 404 = schon weg, also Zielzustand (Wurzel 2 — der Lauf kommt
            # taeglich wieder). Alles andere ist ein echtes Nein.
            if exc.channex_status == 404:
                return True
            log.warning(
                "portal_paar_alter_traeger_nicht_geloest",
                channel_id=channel_id, mapping_id=mapping_id,
                rate_plan_code=settings.get("rate_plan_code"),
                error=str(exc)[:200],
            )
            return False
        log.info(
            "portal_paar_alter_traeger_geloest",
            channel_id=channel_id, mapping_id=mapping_id,
            rate_plan_code=settings.get("rate_plan_code"),
            neuer_plan=neue_channex_rate_plan_id,
        )
        return True

    @staticmethod
    def _zuordnungs_ziele(
        bestand: list[dict[str, Any]], airbnb_listing_id: object,
    ) -> list[dict[str, Any]]:
        """Die `settings`, unter denen der Kanal-Plan zugeordnet werden muss.

        Gelesen wird aus den Einträgen, die schon am Kanal hängen — dort stehen
        die Codes des Portals. Für Airbnb genügt die Listing-ID des Objekts, weil
        dort nur EINE Rate je Anzeige möglich ist; sie wird auch dann genommen,
        wenn der Kanal noch leer ist (das ist bei Airbnb der Normalfall nach
        einem OAuth-Anschluss).

        Rückgabe ist dedupliziert und stabil sortiert: dieselbe Rate zweimal
        anzulegen wäre ein 422 „already exists" für nichts.
        """
        from .portal_raten_plaene import settings_fuer_paar

        gesehen: set[tuple[str, ...]] = set()
        ziele: list[dict[str, Any]] = []
        for eintrag in bestand:
            s = eintrag.get("settings") or {}
            raum = s.get("room_type_code")
            rate = s.get("rate_plan_code")
            if raum is None or rate is None:
                continue
            # Codes sind bei Channex INTEGER (Skill: Strings landen unter
            # „removed rates"). Als str vergleichen, im Payload den Originalwert
            # weitergeben — er kam ohnehin von Channex.
            schluessel = ("paar", str(raum), str(rate))
            if schluessel in gesehen:
                continue
            gesehen.add(schluessel)
            # VOLLE settings, nicht nur das Paar: `occupancy`, `pricing_type`
            # und `primary_occ` gehoeren dazu, sonst sendet Channex an dem
            # Eintrag keine Restriktionen (siehe `settings_fuer_paar` und
            # `paar_fuer_portal_plan` fuer den gemessenen Beleg).
            volle = settings_fuer_paar(bestand, raum, rate)
            if volle is None:
                # Kein Restriktions-Traeger fuer dieses Paar → nichts anlegen.
                # Ein Eintrag ohne `occupancy` waere eine Attrappe, und eine
                # geratene Belegung waere ein anderer Preis fuer dieselbe Rate
                # (fail-closed, Wurzel 4/5).
                log.warning(
                    "zuordnungs_ziel_ohne_traeger_uebersprungen",
                    room_type_code=raum, rate_plan_code=rate,
                )
                continue
            ziele.append(volle)
        if ziele:
            return ziele
        # Kein Paar im Bestand → Airbnb-Weg über die Listing-ID.
        if airbnb_listing_id:
            return [{"listing_id": str(airbnb_listing_id)}]
        return []

    @staticmethod
    def _channex_id_for_local_plan(
        db: Client, tenant_id: str, local_rate_plan_id: str
    ) -> str | None:
        rows = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .eq("local_rate_plan_id", local_rate_plan_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("channex_rate_plan_id") if rows else None

    @staticmethod
    def _enqueue_price_reconcile(
        db: Client, tenant_id: str, property_id: str
    ) -> None:
        """Tageskurve bei Channex neu abgleichen (coalesced, wie rates-Slice)."""
        enqueue(
            db,
            "reconcile_rate_plan_prices",
            tenant_id=tenant_id,
            payload={"tenant_id": tenant_id, "property_id": property_id},
            dedup_key=dedup_key(
                tenant_id, property_id, "reconcile_rate_plan_prices"
            ),
        )

    @staticmethod
    def _dynamic_pricing_enabled(db: Client, property_id: str) -> bool:
        """Ist Dynamic Pricing für das Objekt an? Dann sind die Portalpreise
        die dynamischen Tagespreise — der base_price der Pläne ist nur der
        Anker. Ohne diese Angabe suggeriert die Seite, der statische
        Grundpreis stünde beim Portal. `dp_settings` hat keinen tenant —
        die property_id ist oben bereits tenant-gescoped geladen (Wurzel 3)."""
        rows = (
            db.table("dp_settings")
            .select("enabled")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows and rows[0].get("enabled"))

    @staticmethod
    def _primary_rate_plan_id(
        db: Client, tenant_id: str, property_id: str
    ) -> str | None:
        """Lokaler Plan hinter der ältesten Channex-Zuordnung des Objekts.

        Kette property_map → room_type_maps → älteste rate_plan_map — dieselbe
        Reihenfolge wie `channels._rate_plan_maps_for_property` (dort werden
        Map-IDs gebraucht, hier der lokale Plan dahinter)."""
        pm = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return None
        rts = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("property_map_id", pm[0]["id"])
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        rt_ids = [r["id"] for r in rts]
        if not rt_ids:
            return None
        rps = (
            db.table("channex_rate_plan_map")
            .select("local_rate_plan_id, created_at")
            .in_("room_type_map_id", rt_ids)
            .is_("deleted_at", "null")
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        return rps[0].get("local_rate_plan_id") if rps else None

    def _cover_photo(self, db: Client, property_id: str) -> str | None:
        """Titelbild des Objekts (Cover, sonst erstes Foto) — sonst None."""
        rows = (
            db.table("property_photos")
            .select("url, is_cover, sort_order")
            .eq("property_id", property_id)
            .order("is_cover", desc=True)
            .order("sort_order")
            .limit(1)
            .execute()
        ).data or []
        return rows[0]["url"] if rows else None

    # Sentinel: „das ist ein Portal-Raten-Plan, aber seine Rate ist nicht
    # eindeutig zuordenbar" — unterscheidbar von None (= alle Paare, das
    # bisherige Verhalten fuer Zusatz-Plaene). Ohne diese Unterscheidung waere
    # der fail-closed-Fall nicht von „normal zuordnen" zu trennen.
    _KEIN_ZIEL: object = object()

    def _portal_rate_titel(self, conn: dict[str, Any]) -> dict[str, str]:
        """{rate_plan_code: Titel} der Raten, die das Portal aktuell fuehrt.

        Aus `POST /channels/mapping_details` — lesend, der einzige Weg an die
        TITEL. Das bestehende Kanal-Mapping traegt nur Codes, und ein
        Portal-Raten-Plan ist nur ueber seinen Namen (= Rate-Titel) seiner Rate
        zuzuordnen.

        Leeres dict bei jedem Fehlschlag: dann findet
        `paar_fuer_portal_plan` kein Paar und der Plan wird NICHT zugeordnet
        (fail-closed) — statt auf „alle Paare" zurueckzufallen und die
        Restriktion einer Wochenrate auf die Standard-Rate zu legen.

        NUR PORTALE MIT RATEN-EBENE (gemessen 24.08.2026, „FeWo *Stjerneskud*"):
        fuer einen Airbnb-Kanal lief hier
            POST channels/mapping_details
            {"channel":"AirBNB","settings":{"hotel_id":"226976381"}}  -> HTTP 400
        Zwei Gruende, warum dieser Aufruf strukturell nie gelingen kann:
        1. `hotel_id` ist kein Airbnb-Feld. Der Airbnb-Katalog fuehrt als
           `params` nur code, email, min_stay_type, send_email_notifications,
           booking_amount_settings, cohost_payout_calculations
           (`airbnb_oauth.airbnb_settings_bauen`, `channex_client` Zeile 1673);
           die Konto-Identitaet steckt bei OAuth in den Tokens am KANAL, nicht
           in einer Kennung. Channex-Doku (channel-api-examples/airbnb):
           „There is no `hotel_id` field — Airbnb uses `listing_id` instead."
        2. Selbst mit den richtigen Settings gaebe es hier nichts zu holen:
           Airbnb hat keine Raten-EBENE. Channex-Doku
           (channel-mapping-guides/airbnb): „Airbnb allows you to map only 1
           rate plan." `_normalize_mapping_rooms` liefert je Listing genau EINE
           Rate mit der Listing-ID als Code, und Rate-Titel je Ratencode gibt es
           dort nicht.
        Der Aufruf kostete also bei JEDEM Content-Sync Channex-Kontingent und
        schrieb eine Fehlerzeile in `channex_debug_log`, wo sie echte Fehler
        unauffindbar macht. Deshalb frueh und BENANNT ueberspringen — dasselbe
        Muster (und dieselbe Allowlist) wie `portal_raten_abgleich`: ein neues
        Portal laeuft erst nach einer Messung mit, nicht per Vermutung.
        """
        from .portal_raten_abgleich import PORTALE_MIT_RATEN

        hotel_id = conn.get("ota_hotel_id")
        portal = conn.get("ota_portal_code")
        if not hotel_id or not portal:
            return {}
        if str(portal) not in PORTALE_MIT_RATEN:
            # Kein Fehler, sondern „hier gibt es nichts zu fragen" (s. o.).
            log.info(
                "portal_rate_titel_uebersprungen_ohne_raten_ebene",
                portal=portal,
            )
            return {}
        try:
            details = self._channex.get_channel_mapping_details(
                channel=portal, settings={"hotel_id": str(hotel_id)}
            )
        except ChannexError as exc:
            log.warning(
                "portal_rate_titel_unlesbar",
                portal=portal, hotel_id=hotel_id, error=str(exc)[:200],
            )
            return {}
        from .portal_raten_plaene import portal_titel_je_code

        # `_normalize_mapping_rooms` liegt am Schwester-Mixin `ChannelsMixin`;
        # beide setzen denselben Dienst zusammen, `self` traegt es also. Ueber
        # die Klasse zu gehen waere ein Zugriff auf fremdes Innenleben.
        return portal_titel_je_code(self._normalize_mapping_rooms(details))

    def _portal_raten_plan_ziel(
        self, bestand: list[dict[str, Any]], plan_name: str,
        titel_je_code: dict[str, str],
    ) -> dict[str, Any] | object | None:
        """Wohin dieser Plan gehoert — drei Antworten, drei Bedeutungen.

        `dict`        genau dieses OTA-Paar (der Plan traegt den Namen einer
                      Portal-Rate, also gehoert er ihr allein).
        `_KEIN_ZIEL`  Portal-Raten-Plan, Rate aber nicht eindeutig auffindbar →
                      gar nicht zuordnen (fail-closed).
        `None`        kein Portal-Raten-Plan → bisheriges Verhalten (alle Paare
                      des Zimmers), richtig fuer einen Zusatz-Plan.

        Die Unterscheidung laeuft am Namen: `plan_fuer_portal_rate` benennt den
        Plan nach der Rate, dieser Name ist die Verbindung. Traegt kein Titel
        des Portals diesen Namen, ist es ein normaler Zusatz-Plan
        („Frühbucher", „Langzeit") — der gilt fuer das ganze Zimmer.

        OHNE TITEL ist die Namensprobe BLIND (gefunden 24.08.2026 beim
        Nachverfolgen des `mapping_details`-400). Faellt der Titel-Abruf aus,
        ist `titel_je_code` leer, kein Name trifft je zu — und die Antwort waere
        pauschal `None` = „alle Paare des Zimmers". Fuer einen Plan, der wie eine
        Portal-Rate heisst, ist das genau die Zuordnung, die
        `paar_fuer_portal_plan` als den GROESSEREN Schaden ausrechnet: der
        Wochen-Plan mit min_stay 7 laege auch auf der Standard-Rate, Booking
        verkaufte sie erst ab sieben Naechten, und es verstiesse gegen Channex'
        Eindeutigkeit („One OTA room+rate pair should map to at most one local
        rate plan"). Unwissen darf nicht als Freigabe gelesen werden (Wurzel 4/5).

        Entschieden wird darum am NAMEN, nicht am leeren dict: heisst der Plan
        wie eine Portal-Ratenkategorie (`_klingt_wie_portal_rate` — dieselbe
        Vorpruefung, die den Plan ueberhaupt in diesen Lauf geholt hat), ist er
        ohne Titel nicht sicher zuzuordnen → `_KEIN_ZIEL`. Ein Plan, der NICHT so
        heisst („Frühbucher", „Langzeit"), ist ein echter Zusatz-Plan fuer das
        ganze Zimmer; der braucht die Titel gar nicht und behaelt seinen Weg —
        sonst haetten Portale ohne Raten-Ebene (Airbnb, s. `_portal_rate_titel`)
        ab jetzt gar keine Zuordnung mehr bekommen.
        """
        gesucht = (plan_name or "").strip().lower()
        if not gesucht:
            return None
        if not titel_je_code:
            return (
                self._KEIN_ZIEL
                if _klingt_wie_portal_rate(plan_name)
                else None
            )
        namen = {(t or "").strip().lower() for t in titel_je_code.values()}
        if gesucht not in namen:
            return None  # kein Portal-Raten-Plan
        from .portal_raten_plaene import paar_fuer_portal_plan

        paar = paar_fuer_portal_plan(
            bestand, plan_name, portal_titel_je_code=titel_je_code
        )
        return paar if paar else self._KEIN_ZIEL

    def freigegebene_plaene_zuordnen(
        self, tenant_id: str, property_id: str
    ) -> dict[str, int]:
        """Freigegebene Zusatz-Preispläne an JEDEM verbundenen Kanal zuordnen.

        DIE LÜCKE, die das schliesst (13.08.2026): Der Haken „Diesen Preis an die
        Buchungsportale senden" (`rate_plans.send_to_portals`, 0177) wird nur von
        `channels._selected_rate_plan_ids` gelesen — und die läuft AUSSCHLIESSLICH
        beim VERBINDEN eines Kanals. Wer den Kanal schon verbunden hatte und danach
        einen Plan anlegte, bekam:

            Channex-Rate-Plan angelegt            ✓
            Zeile in channex_rate_plan_map        ✓
            Preise/Restriktionen gepusht          ✓
            Eintrag im rate_plans-Array des KANALS ✗

        Der Plan lag also bei Channex, bekam Preise — und kein Portal las ihn.
        `connect_channel` half nicht: es kehrt bei bestehender Verbindung früh
        zurück, bevor das Mapping neu gebaut wird. Damit hing die Wirkung an der
        Klick-Reihenfolge (Plan zuerst = wirkt, Kanal zuerst = wirkungslos), was
        nirgends stand und niemand erzwang. Live bestätigt: 32 Pläne mit dem Haken,
        davon 0 bei Channex.

        Gebaut wird auf denselben Bausteinen wie der Portal-Aufschlag
        (`_kanal_zuordnung_anlegen`): die OTA-Codes kommen aus dem BESTEHENDEN
        Mapping des Kanals, nicht aus einem geratenen Wert. Ein Kanal ohne jede
        Zuordnung wird übersprungen statt zu werfen — dieser Lauf hängt am
        Content-Sync und darf ihn nicht kippen (Wurzel 5: Nebenpfad).

        Rückgabe: was zugeordnet und was übersprungen wurde (für den Verlauf).
        """
        db = self._require_db()
        # Kein Filter auf `send_to_portals` in der Abfrage: ein Portal-Raten-Plan
        # muss auch dann seine Zuordnung bekommen, wenn sein Flag verloren ging.
        #
        # WARUM (live gemessen 23.08.2026, „FeWo *Stjerneskud*"): der Plan
        # „Wochenrate" wurde um 17:28 mit `send_to_portals: true` angelegt und
        # stand 49 Sekunden spaeter auf `false`; nach dem Nachziehen um 18:09
        # war er um 18:22 erneut `false`. Kein `update` im Code setzt das Flag
        # zurueck (drei Fundstellen, alle `insert` fuer andere Plan-Arten) — der
        # Schreiber sitzt ausserhalb der Dienste. Mit dem Filter in der Abfrage
        # war der Plan in genau diesen Fenstern unsichtbar und verlor seine
        # Kanal-Zuordnung wieder; die Wochenrate verkaufte dann ohne
        # Mindestaufenthalt.
        #
        # Fachlich ist das Flag hier ohnehin die falsche Frage: es schaltet
        # ZUSAETZLICHE Preise frei, die der Betrieb selbst angelegt hat. Die
        # Rate eines Portal-Raten-Plans verkauft beim Portal aber bereits (der
        # Betrieb hat sie im Extranet gebaut) — sie NICHT zu versorgen heisst
        # nicht „nicht senden", sondern „ohne Restriktionen verkaufen lassen".
        alle = (
            db.table("rate_plans")
            .select("id, name, send_to_portals")
            .eq("property_id", property_id)
            .is_("portal_scope", "null")
            .execute()
        ).data or []
        # Freigegebene Plaene — PLUS die, deren Name eine Portal-Rate benennt.
        #
        # Ein Portal-Raten-Plan darf nicht am Flag haengen (Begruendung oben),
        # aber ein pauschales „alle Plaene" waere zu teuer: dann rief JEDER
        # Content-Sync den Kanal ab, auch wenn nichts zuzuordnen ist
        # (`test_ohne_freigegebene_plaene_kein_kanal_abruf` haelt das fest, und
        # der Abruf zaehlt gegen das Channex-Budget).
        #
        # Der Name ist das Erkennungsmerkmal: `plan_fuer_portal_rate` benennt
        # den Plan nach dem Titel der Portal-Rate („Wochenrate"), und
        # `_portal_raten_plan_ziel` loest darueber sein Paar auf. Ein Plan mit
        # gesetztem Flag ODER einem solchen Namen ist Arbeit; alles andere
        # nicht, und dann bleibt der Kanal-Abruf aus.
        offen = [
            p for p in alle
            if p.get("send_to_portals") or _klingt_wie_portal_rate(p.get("name"))
        ]
        if not offen:
            return {"geprueft": 0, "zugeordnet": 0}

        conns = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, ota_portal_code, ota_hotel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .not_.is_("channex_channel_id", "null")
            .execute()
        ).data or []
        if not conns:
            return {"geprueft": len(offen), "zugeordnet": 0}

        zugeordnet = 0
        for conn in conns:
            channel_id = str(conn["channex_channel_id"])
            try:
                aktuell = self._channex.get_channel(channel_id)
            except ChannexError as exc:  # noqa: PERF203 — je Kanal einzeln
                log.warning(
                    "freigegebene_plaene_kanal_unlesbar",
                    channel_id=channel_id, error=str(exc)[:200],
                )
                continue
            attrs = (aktuell.get("data") or {}).get("attributes") or {}
            bestand = attrs.get("rate_plans") or []
            # „Schon da" heisst NICHT „irgendein Eintrag traegt unsere
            # rate_plan_id" — es heisst „unser Plan ist ein vollwertiger
            # Eintrag". Der Unterschied ist der Befund vom 23.08.2026: am Kanal
            # von „FeWo *Stjerneskud*" stand unsere Wochenrate als Eintrag OHNE
            # `occupancy`/`primary_occ` (die Attrappe, die dieser Lauf selbst
            # hinterlassen hatte). Mit der alten Pruefung galt sie als „schon
            # zugeordnet", und der taegliche Lauf konnte den Zustand nie heilen —
            # der Grundpreis blieb Traeger, das Extranet zeigte weiter
            # Mindestaufenthalt 2. Ein Eintrag ohne diese Felder sendet nichts
            # und zaehlt deshalb nicht.
            schon_da = {
                str(p.get("rate_plan_id")) for p in bestand
                if self._eintrag_ist_vollwertig(p)
            }
            # Die Rate-TITEL des Portals — gebraucht, um einen Portal-Raten-Plan
            # an genau SEINE Rate zu haengen (`_portal_raten_plan_ziel`).
            # LAZY: erst beim ersten Plan, der wirklich zugeordnet werden muss.
            # Im Normalfall ist alles schon zugeordnet, und dann darf dieser Lauf
            # keinen zusaetzlichen Channex-Abruf je Objekt und Kanal kosten — er
            # haengt an JEDEM Content-Sync.
            titel_je_code: dict[str, str] | None = None
            for plan in offen:
                cx = self._channex_id_for_local_plan(db, tenant_id, plan["id"])
                if not cx or cx in schon_da:
                    continue
                if titel_je_code is None:
                    titel_je_code = self._portal_rate_titel(conn)
                ziel = self._portal_raten_plan_ziel(
                    bestand, str(plan.get("name") or ""), titel_je_code
                )
                if ziel is self._KEIN_ZIEL:
                    # Portal-Raten-Plan, dessen Rate nicht eindeutig zuordenbar
                    # ist → LIEBER GAR NICHT zuordnen (fail-closed, Wurzel 5).
                    # Begruendung siehe `portal_raten_plaene.paar_fuer_portal_plan`.
                    log.warning(
                        "portal_raten_plan_nicht_zugeordnet",
                        channel_id=channel_id, rate_plan_id=cx,
                        plan_name=plan.get("name"),
                        portal=conn.get("ota_portal_code"),
                    )
                    continue
                try:
                    self._kanal_zuordnung_anlegen(
                        db, channel_id, cx, plan["id"], bestand=bestand,
                        # Gesetzt = NUR dieses eine OTA-Paar (Portal-Raten-Plan).
                        # None = das bisherige Verhalten (alle Paare des Zimmers),
                        # richtig fuer einen Zusatz-Plan, der das ganze Zimmer
                        # betrifft.
                        nur_paar=ziel,
                    )
                except (ChannelManagerError, ChannexError) as exc:
                    # Ein Kanal ohne zuordenbare Rate (oder ein Portal, das die
                    # Zuordnung ablehnt) darf die anderen nicht aufhalten.
                    log.warning(
                        "freigegebener_plan_nicht_zuordenbar",
                        channel_id=channel_id, rate_plan_id=cx,
                        portal=conn.get("ota_portal_code"),
                        error=str(exc)[:200],
                    )
                    continue
                zugeordnet += 1
        if zugeordnet:
            log.info(
                "freigegebene_plaene_zugeordnet",
                property_id=property_id, geprueft=len(offen),
                zugeordnet=zugeordnet, kanaele=len(conns),
            )
        return {"geprueft": len(offen), "zugeordnet": zugeordnet}

    def _rate_plans_of_property(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, Any]]:
        """Aktive Tarifpläne dieses Objekts, wie sie ans Portal gehen.

        Drei Angaben, weil sie zusammen den Preis erklären: die KONDITION
        (Zahlungs-/Stornoregel, `booking_conditions`), der NAME samt Typ
        (`rate_mode`: eigener Preis oder abgeleitet) und die PREISÄNDERUNG
        (`offset_percent`/`offset_amount` eines abgeleiteten Plans).

        ALLE Tarifpläne des Objekts, nicht nur die freigegebenen: ein Filter auf
        `send_to_portals` ließ die Liste leer wirken, obwohl Pläne existieren —
        die Freigabe steht als eigene Angabe je Zeile.

        Kanal-Pläne (`portal_scope`, 0272) erscheinen NICHT als eigene Zeile:
        ihr Aufschlag ist die „Preisänderung" des Portals und steht in der
        Detailsicht editierbar am Grundpreis-Plan — eine zweite Zeile wäre
        dieselbe Information doppelt (und die anderer Portale falsch).
        """
        plans = (
            db.table("rate_plans")
            .select(
                "id, name, base_price, currency, min_stay, rate_mode, "
                "offset_amount, offset_percent, booking_condition_id, "
                "send_to_portals, portal_scope"
            )
            .eq("property_id", property_id)
            .order("name")
            .execute()
        ).data or []
        plans = [p for p in plans if not p.get("portal_scope")]
        if not plans:
            return []

        bedingungen: dict[str, str] = {}
        cond_ids = [p["booking_condition_id"] for p in plans if p.get("booking_condition_id")]
        if cond_ids:
            for c in (
                db.table("booking_conditions")
                .select("id, internal_name")
                .eq("tenant_id", tenant_id)
                .in_("id", cond_ids)
                .execute()
            ).data or []:
                bedingungen[c["id"]] = c.get("internal_name")

        # Grundpreis-Plan = älteste Channex-Zuordnung (dieselbe Definition wie
        # channels._selected_rate_plan_ids): er geht IMMER ans Portal,
        # `send_to_portals` schaltet nur ZUSÄTZLICHE Pläne frei. Ohne dieses
        # Wissen stünde am Standard-Plan „nicht für Portale freigegeben",
        # obwohl genau er die Portalpreise trägt.
        primary_id = self._primary_rate_plan_id(db, tenant_id, property_id)

        return [
            {
                "id": p["id"],
                "name": p.get("name"),
                "base_price": p.get("base_price"),
                "currency": p.get("currency"),
                "min_stay": p.get("min_stay"),
                "rate_mode": p.get("rate_mode"),
                "offset_amount": p.get("offset_amount"),
                "offset_percent": p.get("offset_percent"),
                "condition": bedingungen.get(p.get("booking_condition_id")),
                "send_to_portals": bool(p.get("send_to_portals")),
                "is_primary": p["id"] == primary_id,
            }
            for p in plans
        ]

    def portal_verbindung_trennen(
        self, ctx: AuthContext, *, property_id: str, portal_code: str
    ) -> dict[str, Any]:
        """Ein Objekt von EINEM Portal trennen — die falsche Zuordnung lösen.

        Abgrenzung zu den beiden bestehenden Wegen:
          * `set_connection_active(False)` PAUSIERT nur (Kanal bleibt, Zuordnung
            bleibt) — damit lässt sich eine falsche Zuordnung nicht korrigieren.
          * `disconnect_property` trennt das Objekt von CHANNEX komplett, also
            von allen Portalen.
        Gebraucht wird der Fall dazwischen: Der Betrieb hat eine Airbnb-Anzeige
        dem falschen Objekt zugeordnet und muss genau diese Zuordnung lösen,
        ohne die anderen Portale anzufassen.

        NICHT den Kanal abschalten. Live gemessen (05.08.2026): bei Airbnb
        trägt EIN Channex-Kanal alle Objekte des Kontos — ein Kanal, 18 Objekte,
        17 Zuordnungen. `deactivate_channel` hätte also 17 fremde Objekte
        mitgetrennt. Channex verweigert es ohnehin, solange Zuordnungen
        bestehen: 422 `{"channel": ["remove mappings before"]}`.

        LÖSCHKETTE, Reihenfolge ist der Punkt (Wurzel 1 — Gegenzustand):
          1. Die Zuordnung(en) DIESES Objekts am Kanal löschen
             (`DELETE channels/{id}/mappings/{mapping_id}`). Das ist der
             Verkaufsstopp beim Portal für genau dieses Objekt — der Kanal und
             alle anderen Objekte bleiben unberührt.
          2. Listing-Zuordnung bei Channex lösen (`disconnect_listing`). Bleibt
             sie stehen, ist der Rate-Plan-Titel weiter belegt und ein späteres
             Verbinden scheitert an „Duplication in Rate Plan title is not
             allowed" — genau so live passiert.
          3. Kanal-Plan dieses Portals (`portal_scope`) samt Aufschlag entfernen:
             er beschreibt einen Preis für ein Portal, an das nichts mehr geht.
          4. Unsere Verbindungszeile auf inaktiv und OHNE Kanal-/Listing-Bezug.
             Die Hotel-ID bleibt stehen, damit ein Neu-Verbinden sie vorbefüllt.

        Fail-closed: Scheitert Schritt 1, bricht die Trennung ab — ein Portal,
        das weiterverkauft, während wir uns für getrennt halten, ist der
        gefährlichste Zustand. Schritt 2 ist best effort mit Protokoll: dort ist
        der Verkauf schon gestoppt.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()  # type: ignore[attr-defined]
        load_scoped(
            db, "properties", property_id, tenant_id, columns="id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        # `id` mitlesen: getrennt wird GENAU DIESE Verbindung. Vorher lief der
        # Update über (tenant, property, portal) und nullte die Kanal-ID ALLER
        # Zeilen — bei zwei Konten (0304) wäre die Verbindung des zweiten in
        # unserer DB unwiederbringlich weg, während sie bei Channex weiterläuft.
        row = (
            db.table("channex_channel_connection")
            .select("id, channex_channel_id, ota_hotel_id, ota_room_type_code")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        if not row:
            raise ChannelManagerError(
                "Kanal-Verbindung nicht gefunden.", status_code=404
            )
        channel_id = row[0].get("channex_channel_id")

        if channel_id:
            self._kanal_zuordnungen_loesen(db, tenant_id, property_id, channel_id)

            listing_id = self._airbnb_listing_id(db, property_id)
            if listing_id:
                try:
                    self._channex.disconnect_listing(  # type: ignore[attr-defined]
                        channel_id, listing_id
                    )
                except ChannexError as exc:
                    log.warning(
                        "portal_trennen_listing_blieb",
                        property_id=property_id, listing_id=listing_id,
                        error=exc.message,
                    )

        self._kanalplan_entfernen(db, property_id, portal_code)

        db.table("channex_channel_connection").update(
            {
                "is_active": False,
                "channex_channel_id": None,
                "ota_room_type_code": None,
                "last_error": None,
            }
        ).eq("tenant_id", tenant_id).eq("id", row[0]["id"]).execute()
        log.info(
            "portal_verbindung_getrennt",
            tenant_id=tenant_id, property_id=property_id, portal_code=portal_code,
        )
        return {
            "portal_code": portal_code,
            "portal": self._portal_label(portal_code),
            "hotel_id": row[0].get("ota_hotel_id"),
            "channel_id": None,
            "is_active": False,
            "last_error": None,
        }

    def _kanal_zuordnungen_loesen(
        self, db: Client, tenant_id: str, property_id: str, channel_id: str
    ) -> None:
        """Alle Kanal-Zuordnungen DIESES Objekts löschen, fremde nicht anfassen.

        Der Kanal ist bei Airbnb kontoweit — welche seiner Zuordnungen zu
        diesem Objekt gehören, sagt allein die Kette
        `channex_property_map` → `channex_room_type_map` →
        `channex_rate_plan_map.channex_rate_plan_id`, abgeglichen gegen
        `attributes.rate_plans[].rate_plan_id` am Kanal.

        Wurzel 5 — fail-closed: Lässt sich der Ist-Stand nicht lesen oder eine
        Zuordnung nicht löschen, bricht die Trennung ab. Wer hier weitermacht,
        setzt unsere Zeile auf „getrennt", während das Portal weiterverkauft.
        """
        eigene = self._channex_rate_plan_ids(db, tenant_id, property_id)
        if not eigene:
            return
        try:
            kanal = self._channex.get_channel(channel_id)  # type: ignore[attr-defined]
        except ChannexError as exc:
            raise ChannelManagerError(
                "Trennung abgebrochen: Der Stand beim Portal ließ sich nicht "
                f"lesen ({exc.message}). Bitte erneut versuchen — solange "
                "bleibt der Verkauf dort aktiv.",
                status_code=502,
            ) from exc
        attrs = ((kanal or {}).get("data") or {}).get("attributes") or {}
        for eintrag in attrs.get("rate_plans") or []:
            if str(eintrag.get("rate_plan_id") or "") not in eigene:
                continue
            mapping_id = str(eintrag.get("id") or "")
            if not mapping_id:
                continue
            try:
                self._channex.delete_channel_mapping(  # type: ignore[attr-defined]
                    channel_id, mapping_id
                )
            except ChannexError as exc:
                # 404 = schon weg: Zielzustand erreicht, kein Fehler (Wurzel 2,
                # der Knopf ist wiederholbar).
                if exc.channex_status == 404:
                    continue
                raise ChannelManagerError(
                    "Trennung abgebrochen: Die Zuordnung beim Portal ließ sich "
                    f"nicht lösen ({exc.message}). Bitte erneut versuchen — "
                    "solange bleibt der Verkauf dort aktiv.",
                    status_code=502,
                ) from exc
            log.info(
                "portal_zuordnung_geloest",
                property_id=property_id, channel_id=channel_id,
                mapping_id=mapping_id,
            )

    @staticmethod
    def _channex_rate_plan_ids(
        db: Client, tenant_id: str, property_id: str
    ) -> set[str]:
        """Channex-Rate-Plan-IDs des Objekts (alle, nicht nur die primäre)."""
        pm = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return set()
        rts = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("property_map_id", pm[0]["id"])
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        rt_ids = [r["id"] for r in rts]
        if not rt_ids:
            return set()
        rps = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id")
            .in_("room_type_map_id", rt_ids)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        return {
            str(r["channex_rate_plan_id"])
            for r in rps
            if r.get("channex_rate_plan_id")
        }

    @staticmethod
    def _airbnb_listing_id(db: Client, property_id: str) -> str | None:
        """Die Airbnb-Listing-ID des Objekts, falls es eine Airbnb-Anzeige ist."""
        rows = (
            db.table("properties")
            .select("airbnb_listing_id")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        kennung = rows[0].get("airbnb_listing_id") if rows else None
        return str(kennung) if kennung else None

    @staticmethod
    def _kanalplan_entfernen(
        db: Client, property_id: str, portal_code: str
    ) -> None:
        """Den Kanal-Plan dieses Portals löschen (Gegenzustand zum Aufschlag).

        Bliebe er stehen, gäbe es einen Preisplan mit Aufschlag für ein Portal,
        an das nichts mehr geht — und beim Neu-Verbinden träfe man auf einen
        alten Aufschlag, den niemand mehr gesetzt hat.
        """
        db.table("rate_plans").delete().eq("property_id", property_id).eq(
            "portal_scope", portal_code
        ).execute()


def _klingt_wie_portal_rate(name: str | None) -> bool:
    """Benennt dieser Planname eine Portal-Ratenkategorie?

    `plan_fuer_portal_rate` benennt einen Portal-Raten-Plan nach dem TITEL der
    Rate beim Portal („Wochenrate", „Weekly Rate"). Diese Vorpruefung
    entscheidet nur, ob es sich lohnt, den Kanal ueberhaupt abzurufen — die
    verbindliche Zuordnung macht danach `_portal_raten_plan_ziel` ueber den
    echten Titel-Abgleich. Ein falsch-positiver Treffer kostet also einen
    Lese-Abruf, nie eine falsche Zuordnung.

    Absichtlich dieselben Wortstaemme wie `portal_raten_plaene.min_stay_aus_titel`
    — dort bestimmen sie den Mindestaufenthalt, hier die Sichtbarkeit. Wer einen
    Stamm ergaenzt, muss beide Listen pflegen; sie getrennt zu halten waere die
    Doppelpflege, aus der die Namens-Fehlschluesse dieses Tages entstanden sind.
    """
    from .portal_raten_plaene import min_stay_aus_titel

    return min_stay_aus_titel(name) is not None
