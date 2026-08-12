"""Ein Objekt bei ALLEN Portalen aus dem Verkauf nehmen — und zurückholen.

DER ANLASS (12.08.2026): Im Drei-Punkte-Menü der Objekt-Karte soll ein Betrieb
sein Objekt inaktiv schalten UND den Buchungskalender bei allen OTAs abschalten.
Bisher gab es nur `properties.status = 'inactive'`, und das wirkt
AUSSCHLIESSLICH bei uns — `properties.status` wird im ganzen Channel-Manager
nirgends gelesen (siehe `veroeffentlichen.py`). Am 06.08.2026 stand deshalb die
Oberfläche auf „Inaktiv", während bei Airbnb alle 18 Objekte weiterverkauften:
ein fail-open-Geisterzustand, die gefährlichste Sorte (Wurzel 5).

ABGRENZUNG — das hier ist NICHT Stop-Sell. Stop-Sell sperrt TAGE im Kalender
(`ari_push.push_stop_sell_for_property`) und ist eine Verfügbarkeits-Aussage.
Hier wird das INSERAT geschaltet: aktiv/inaktiv. Zwei verschiedene Dinge, die
nicht vermischt werden dürfen.

ZWEI PORTALE, ZWEI HEBEL — live an „FeWo *Stjerneskud*" bewiesen (12.08.2026),
in beide Richtungen und jeweils durch Rücklesen bestätigt:

    Airbnb        `POST channels/{id}/execute/publish|unpublish` mit
                  `listing_id`. Antwort trägt `{"data":{"published":…}}`.
                  Der Zustand steht am Mapping (`channels/{id}` →
                  `attributes.rate_plans[].settings.published`).
    Booking.com   `POST channels/{id}/deactivate` bzw. `/activate` am KANAL.
                  Die Mapping-Settings tragen dort NUR die Zuordnung
                  (`room_type_code`, `rate_plan_code`, `occupancy`,
                  `pricing_type`, `primary_occ`) — kein Sichtbarkeits-Feld.
    myBestDays    `properties.listed_on_marketplace` (eigene Achse, kein Channex).

DREI WEGE ZU AIRBNB WAREN NÖTIG — die zwei falschen stehen hier, damit sie
niemand erneut versucht:
  * `PUT channels/{id}/mappings/{mid}` mit `{"settings":{"published":false}}`
    → **422** `{"mapping": ["rate_plan_id must be specified"]}`. Channex will
    dort den vollständigen Eintrag, kein Teil-Update.
  * `PUT channels/{id}` mit dem KOMPLETTEN `rate_plans`-Array, ein
    `settings.published` geändert → **200**, danach steht der Wert unverändert.
    Channex übernimmt beim Kanal-PUT die Mapping-`settings` bestehender Einträge
    NICHT. Der PUT ist für das ANHÄNGEN von Mappings verifiziert
    (`_attach_room_to_channel`), nicht für das Ändern ihrer Einstellungen —
    deshalb fiel nie auf, dass `veroeffentlichen.airbnb_sichtbarkeit_setzen`
    seinen Zweck nicht erfüllt. Es meldet den Fehlschlag korrekt; es war nur
    offenbar noch nie erfolgreich. (Bestandsdefekt, hier nicht behoben.)
  * Ebenfalls widerlegt: `GET channels/{id}/action/full_sync` → **400**
    `["action is not supported"]` (siehe `_ari_nachschub`).

WARUM AIRBNB NICHT ÜBER DEN KANAL: ein Airbnb-Kanal des Kontos trägt 18 Objekte
(Kanal 9a46827b…). `deactivate_channel` hätte 17 fremde Objekte mitabgeschaltet —
genau der Vorfall „warum sind alle objekte offline". Bei Booking.com hat dagegen
JEDES Objekt seinen eigenen Kanal mit eigener `hotel_id` (live: 18 Kanäle, jeder
mit genau 1 Objekt). Trotzdem wird VOR jedem Kanal-Abschalten gezählt: die
Struktur eines Kontos ist kein Naturgesetz (Wurzel 3).

WARUM NICHT `has_availability` am Airbnb-Listing: das ist Airbnbs Urlaubsmodus
und verlangt beim Abschalten ein Pflichtfeld `deactivation_reason`. Am 06.08.2026
stand „Feriehus Kornblomst" dadurch live und buchbar, und der Rückweg war erst
nach dem Fund dieses Pflichtfelds möglich. Und nicht `is_active` an der
Channex-Property: „Ability to deactivate Property is deprecated" (Changelog).

DER RÜCKWEG STELLT WIEDER HER, ER SCHALTET NICHT ALLES AN (Wurzel 1). Was vor
dem Abschalten galt, steht in `property_sales_pause` (0375). Ein Kanal, der schon
vorher aus war, bleibt aus. Ohne diese Sicherung würde „zurückholen" ein Portal
aktivieren, das der Betrieb absichtlich abgeschaltet hatte.

Danach EIN ARI-Nachschub je Objekt (`full_sync_property`), nicht je Kanal —
siehe `_ari_nachschub`.

EIN 200 IST KEIN BEWEIS. Channex quittiert verworfene Nutzlasten mit 200
(`create_channel_mapping` dokumentiert den Fall), und der `execute`-Namensraum
antwortet auf JEDEN Namen mit „Success", auch auf erfundene. Jeder Schaltvorgang
wird deshalb über `get_channel` ZURÜCKGELESEN und gilt nur dann als erfolgreich.
Das ist kein Debugging, sondern der Schutz gegen den stillen Fehlschlag: genau so
sind die beiden falschen Airbnb-Wege oben aufgefallen, statt als Erfolg
durchzugehen.
"""
from __future__ import annotations

from typing import Any, Final

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .channex_client import ChannexError
from .common import ChannelManagerError, log

# Der eigene Marktplatz läuft NICHT über Channex (eigene Achse
# `properties.listed_on_marketplace`, 0159) und wird hier mitgeschaltet, weil
# „bei allen Portalen abschalten" sonst eine Lüge wäre: myBestDays ist ein
# gleichrangiger Buchungskanal, kein Sonderfall (Marken-/Kanalregeln).
MARKTPLATZ: Final = "myBestDays"

# Portale, deren Sichtbarkeit am LISTING hängt (Airbnb). Alle anderen laufen
# über den Kanal. Bewusst eine Allowlist und kein „alles außer Booking":
# ein neues Portal soll den vorsichtigeren Kanal-Weg mit Objekt-Zählung nehmen,
# bis jemand seinen Listing-Schalter live nachgewiesen hat (7 OTAs, jede eigene
# Einstellung — nie ein Portal aus einem anderen ableiten).
_MAPPING_PORTALE: Final[frozenset[str]] = frozenset({"AirBNB"})

# Das Feld, das bei Airbnb die Sichtbarkeit trägt.
_PUBLISHED: Final = "published"

HEBEL_MAPPING: Final = "mapping_published"
HEBEL_KANAL: Final = "channel_active"


class ObjektVerkaufMixin:
    """Objekt bei allen Portalen aus dem Verkauf nehmen / zurückholen."""

    # ---- öffentliche Wege ---------------------------------------------------

    def objekt_verkauf_pausieren(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Objekt inaktiv schalten UND bei allen Portalen abschalten.

        Reihenfolge ist Absicht (Wurzel 5 — fail-closed): ZUERST die Portale,
        DANN unser Status. Wäre es umgekehrt und ein Portal-Aufruf scheitert,
        stünde das Objekt bei uns auf „inaktiv", während das Portal
        weiterverkauft — genau der Zustand, der niemandem auffällt, bis ein Gast
        eine Buchung für ein abgeschaltetes Objekt hat.

        Portale werden EINZELN behandelt: Scheitert eines, laufen die anderen
        weiter und der Fehler steht im Ergebnis. Ein Abbruch beim ersten Fehler
        ließe die restlichen Portale verkaufen, ohne dass jemand es merkt.
        Der Status wird nur auf `inactive` gesetzt, wenn KEIN Portal
        fehlgeschlagen ist.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()  # type: ignore[attr-defined]
        objekt = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, title, status, listed_on_marketplace",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        # Jeder Channex-Call dieses Vorgangs landet über den Client-Trace-Sink in
        # `channex_debug_log` (Nutzlast + Antwort) — der reguläre Weg des Slices,
        # nicht ein eigener Debug-Aufbau.
        self._trace_step(  # type: ignore[attr-defined]
            tenant_id=tenant_id, property_id=property_id, step="verkauf_pausieren",
        )

        verbindungen = self._verkauf_verbindungen(db, tenant_id, property_id)
        ergebnisse = [
            self._portal_abschalten(
                db, tenant_id, property_id, verbindung, ctx.user_id
            )
            for verbindung in verbindungen
        ]
        ergebnisse.append(
            self._marktplatz_schalten(
                db, tenant_id, property_id, objekt,
                aktiv=False, user_id=ctx.user_id,
            )
        )

        gescheitert = [e for e in ergebnisse if e.get("fehler")]
        if gescheitert:
            # Der Status bleibt, wie er war: „inaktiv" bei uns anzuzeigen,
            # während ein Portal weiterverkauft, ist die Lüge, die dieser ganze
            # Slice verhindern soll (Wurzel 5).
            log.warning(
                "verkauf_pausieren_teilweise",
                tenant_id=tenant_id, property_id=property_id,
                titel=objekt.get("title"),
                portale=[e["portal_code"] for e in gescheitert],
                gruende=[e.get("fehler") for e in gescheitert],
                user_id=ctx.user_id,
            )
        else:
            db.table("properties").update({"status": "inactive"}).eq(
                "tenant_id", tenant_id
            ).eq("id", property_id).execute()
            log.info(
                "verkauf_pausiert",
                tenant_id=tenant_id, property_id=property_id,
                titel=objekt.get("title"),
                portale=[e["portal_code"] for e in ergebnisse],
                user_id=ctx.user_id,
            )

        return {
            "property_id": property_id,
            "status": objekt.get("status") if gescheitert else "inactive",
            "pausiert": not gescheitert,
            "portale": ergebnisse,
        }

    def objekt_verkauf_fortsetzen(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Objekt aktiv schalten und die Portale WIEDERHERSTELLEN.

        Wiederherstellen heißt: nur das zurückdrehen, was wir abgeschaltet
        haben, und nur dort, wo es vorher an war (`war_aktiv`). Ein Portal, das
        der Betrieb selbst abgeschaltet hatte, bleibt aus — es einzuschalten
        wäre eine Entscheidung, die uns nicht zusteht.

        Reihenfolge umgekehrt zum Pausieren: ZUERST unser Status auf `active`,
        DANN die Portale. Ein Portal, das wieder verkauft, während unser Objekt
        noch „inaktiv" ist, wäre derselbe Widerspruch — nur diesmal in der
        Richtung, in der eine hereinkommende Buchung auf ein inaktives Objekt
        trifft.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()  # type: ignore[attr-defined]
        objekt = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, title, status, listed_on_marketplace",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        self._trace_step(  # type: ignore[attr-defined]
            tenant_id=tenant_id, property_id=property_id, step="verkauf_fortsetzen",
        )

        pausen = (
            db.table("property_sales_pause")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("beendet_at", "null")
            .execute()
        ).data or []
        if not pausen:
            raise ChannelManagerError(
                "Für dieses Objekt ist keine Portal-Pause gespeichert. "
                "Es wurde nicht über diesen Weg abgeschaltet.",
                status_code=409,
            )

        db.table("properties").update({"status": "active"}).eq(
            "tenant_id", tenant_id
        ).eq("id", property_id).execute()

        ergebnisse = [
            self._portal_wiederherstellen(
                db, tenant_id, property_id, pause, ctx.user_id
            )
            for pause in pausen
        ]

        # ARI-Nachschub EINMAL für das Objekt, nachdem alle Portale wieder an
        # sind: während der Pause gingen dorthin keine Pushes, das Inserat stünde
        # sonst online mit dem Stand von vor der Pause. Nur wenn überhaupt ein
        # Portal wiederhergestellt wurde — nach lauter Fehlschlägen gibt es
        # nichts zu versorgen.
        if any(e.get("wiederhergestellt") for e in ergebnisse):
            self._ari_nachschub(tenant_id, property_id)

        gescheitert = [e for e in ergebnisse if e.get("fehler")]
        if gescheitert:
            log.warning(
                "verkauf_fortsetzen_teilweise",
                tenant_id=tenant_id, property_id=property_id,
                titel=objekt.get("title"),
                portale=[e["portal_code"] for e in gescheitert],
                gruende=[e.get("fehler") for e in gescheitert],
                user_id=ctx.user_id,
            )
        else:
            log.info(
                "verkauf_fortgesetzt",
                tenant_id=tenant_id, property_id=property_id,
                titel=objekt.get("title"),
                portale=[e["portal_code"] for e in ergebnisse],
                user_id=ctx.user_id,
            )

        return {
            "property_id": property_id,
            "status": "active",
            "pausiert": False,
            "portale": ergebnisse,
        }

    def objekt_verkauf_stand(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Ist-Stand LIVE bei den Portalen — rein lesend, ändert nichts.

        Zeigt je Portal den Hebel, den bei Channex gelesenen Wert (`published`
        bzw. `is_active`), die Zahl der Objekte am Kanal und ob eine Pause
        gespeichert ist. Der Weg, um zu prüfen, ob unsere Sicht und das Portal
        übereinstimmen — eine Abweichung ist hier sichtbar statt unentdeckt.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()  # type: ignore[attr-defined]
        objekt = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, title, status, listed_on_marketplace",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )

        pausen_je_portal = {
            str(p.get("portal_code")): p
            for p in (
                db.table("property_sales_pause")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .is_("beendet_at", "null")
                .execute()
            ).data or []
        }

        portale: list[dict[str, Any]] = []
        for verbindung in self._verkauf_verbindungen(db, tenant_id, property_id):
            code = verbindung["portal_code"]
            channel_id = verbindung["channel_id"]
            eintrag: dict[str, Any] = {
                "portal_code": code,
                "portal": self._portal_label(code),  # type: ignore[attr-defined]
                "channel_id": channel_id,
                "hebel": (
                    HEBEL_MAPPING if code in _MAPPING_PORTALE else HEBEL_KANAL
                ),
                "pause_gespeichert": bool(pausen_je_portal.get(code)),
            }
            try:
                attrs = self._kanal_attribute(channel_id)
                eintrag["kanal_aktiv"] = attrs.get("is_active")
                eintrag["objekte_am_kanal"] = len(attrs.get("properties") or [])
                if code in _MAPPING_PORTALE:
                    mapping = self._mapping_des_objekts(
                        db, tenant_id, property_id, attrs
                    )
                    settings = (mapping or {}).get("settings") or {}
                    eintrag["mapping_id"] = (mapping or {}).get("id")
                    eintrag["published"] = settings.get(_PUBLISHED)
                    eintrag["listing_id"] = settings.get("listing_id")
            except ChannexError as exc:
                eintrag["fehler"] = exc.message
                eintrag["channex_status"] = exc.channex_status
            portale.append(eintrag)

        portale.append({
            "portal_code": MARKTPLATZ,
            "portal": MARKTPLATZ,
            "hebel": "listed_on_marketplace",
            "gelistet": bool(objekt.get("listed_on_marketplace")),
            "pause_gespeichert": bool(pausen_je_portal.get(MARKTPLATZ)),
        })

        return {
            "property_id": property_id,
            "titel": objekt.get("title"),
            "status": objekt.get("status"),
            "portale": portale,
        }

    # ---- Portale abschalten -------------------------------------------------

    def _portal_abschalten(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        verbindung: dict[str, Any],
        user_id: str | None,
    ) -> dict[str, Any]:
        """EIN Portal abschalten — Hebel je Portal, mit Rücklesung."""
        if verbindung["portal_code"] in _MAPPING_PORTALE:
            return self._mapping_abschalten(
                db, tenant_id, property_id, verbindung, user_id
            )
        return self._kanal_abschalten(
            db, tenant_id, property_id, verbindung, user_id
        )

    def _mapping_abschalten(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        verbindung: dict[str, Any],
        user_id: str | None,
    ) -> dict[str, Any]:
        """Airbnb: das Listing DIESES Objekts zurückziehen.

        Trifft nur die eine Anzeige — auch wenn 18 Objekte am selben Kanal
        hängen. Das ist der Grund, warum Airbnb diesen Weg bekommt.
        """
        code = verbindung["portal_code"]
        channel_id = verbindung["channel_id"]
        ergebnis: dict[str, Any] = {
            "portal_code": code,
            "portal": self._portal_label(code),  # type: ignore[attr-defined]
            "hebel": HEBEL_MAPPING,
            "channel_id": channel_id,
        }
        try:
            attrs = self._kanal_attribute(channel_id)
        except ChannexError as exc:
            log.warning(
                "verkauf_kanal_nicht_lesbar", tenant_id=tenant_id,
                property_id=property_id, portal_code=code,
                channel_id=channel_id, fehler=exc.message,
            )
            return {**ergebnis, "fehler": exc.message}

        mapping = self._mapping_des_objekts(db, tenant_id, property_id, attrs)
        if not mapping:
            # Keine Zuordnung = dieses Objekt geht über diesen Kanal nicht ans
            # Portal. Nichts abzuschalten, und das ist kein Fehler.
            return {**ergebnis, "uebersprungen": "keine Zuordnung an diesem Kanal"}

        mapping_id = str(mapping.get("id") or "")
        settings = mapping.get("settings") or {}
        war_aktiv = bool(settings.get(_PUBLISHED))
        ergebnis |= {"mapping_id": mapping_id, "war_aktiv": war_aktiv}

        if not war_aktiv:
            # Schon aus. Trotzdem eine Pause sichern, damit der Rückweg weiß:
            # dieses Portal war vorher aus und bleibt aus (Wurzel 1).
            self._pause_sichern(
                db, tenant_id, property_id, user_id=user_id,
                portal_code=code, hebel=HEBEL_MAPPING,
                channel_id=channel_id, mapping_id=mapping_id, war_aktiv=False,
            )
            return {**ergebnis, "uebersprungen": "war bereits abgeschaltet"}

        # Sichern VOR dem Schalten: bricht der Aufruf danach ab, ist der
        # Vorzustand trotzdem bekannt (Wurzel 2 — der Seiteneffekt darf nie
        # ohne die Absicherung passieren).
        self._pause_sichern(
            db, tenant_id, property_id, user_id=user_id,
            portal_code=code, hebel=HEBEL_MAPPING,
            channel_id=channel_id, mapping_id=mapping_id, war_aktiv=True,
        )
        return self._published_schalten(
            db, tenant_id, property_id,
            channel_id=channel_id,
            listing_id=str(settings.get("listing_id") or ""),
            mapping_id=mapping_id, sichtbar=False, portal_code=code,
            ergebnis=ergebnis,
        )

    def _published_schalten(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        *,
        channel_id: str,
        listing_id: str,
        mapping_id: str,
        sichtbar: bool,
        portal_code: str,
        ergebnis: dict[str, Any],
    ) -> dict[str, Any]:
        """Ein Airbnb-Listing veröffentlichen / zurückziehen.

        `POST channels/{id}/execute/publish|unpublish` — der einzige Weg, der
        wirkt; die beiden widerlegten stehen im Modul-Docstring. Die Antwort
        trägt `{"data":{"published":…}}`, wird aber NICHT als Beweis genommen:
        der `execute`-Namensraum quittiert jeden Namen mit Erfolg. Es zählt die
        Rücklesung über `get_channel`.

        `pause_verwerfen` NUR beim Abschalten (`sichtbar=False`): dort wurde die
        Pause unmittelbar vorher angelegt und beschreibt nach einem Fehlschlag
        nichts. Beim Wiedereinschalten ist die Pause der GESICHERTE Vorzustand —
        sie zu löschen, weil das Zurückschreiben scheiterte, würde den Rückweg
        vernichten und das Portal dauerhaft abgeschaltet zurücklassen.
        """
        if not listing_id:
            log.warning(
                "verkauf_mapping_ohne_listing", tenant_id=tenant_id,
                property_id=property_id, portal_code=portal_code,
                mapping_id=mapping_id,
            )
            if not sichtbar:
                self._pause_verwerfen(db, tenant_id, property_id, portal_code)
            return {
                **ergebnis,
                "fehler": "Die Portal-Zuordnung trägt keine Anzeigen-Kennung.",
            }

        try:
            self._channex.set_listing_published(  # type: ignore[attr-defined]
                channel_id, listing_id, published=sichtbar
            )
        except ChannexError as exc:
            log.warning(
                "verkauf_listing_senden_fehler", tenant_id=tenant_id,
                property_id=property_id, portal_code=portal_code,
                listing_id=listing_id, sichtbar=sichtbar,
                fehler=exc.message, channex_status=exc.channex_status,
            )
            if not sichtbar:
                self._pause_verwerfen(db, tenant_id, property_id, portal_code)
            return {**ergebnis, "fehler": exc.message}

        nachher = self._mapping_zuruecklesen(channel_id, mapping_id)
        ergebnis["ist_aktiv"] = nachher
        if nachher is not sichtbar:
            log.warning(
                "verkauf_listing_nicht_uebernommen", tenant_id=tenant_id,
                property_id=property_id, portal_code=portal_code,
                listing_id=listing_id, soll=sichtbar, ist=nachher,
            )
            return {
                **ergebnis,
                "fehler": (
                    "Das Portal hat die Änderung nicht übernommen "
                    f"(published={nachher})."
                ),
            }
        return {
            **ergebnis,
            ("wiederhergestellt" if sichtbar else "abgeschaltet"): True,
        }

    def _kanal_abschalten(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        verbindung: dict[str, Any],
        user_id: str | None,
    ) -> dict[str, Any]:
        """Booking.com & Co.: den Kanal deaktivieren — nach Objekt-Zählung.

        Die Zählung ist der Schutz, der am 12.08.2026 gefehlt hat: trägt der
        Kanal mehr als dieses Objekt, wird NICHT geschaltet, sondern gemeldet.
        Lieber ein Portal, das weiterverkauft und das der Betrieb sieht, als 17
        fremde Objekte, die still offline gehen.
        """
        code = verbindung["portal_code"]
        channel_id = verbindung["channel_id"]
        ergebnis: dict[str, Any] = {
            "portal_code": code,
            "portal": self._portal_label(code),  # type: ignore[attr-defined]
            "hebel": HEBEL_KANAL,
            "channel_id": channel_id,
        }
        try:
            attrs = self._kanal_attribute(channel_id)
        except ChannexError as exc:
            log.warning(
                "verkauf_kanal_nicht_lesbar", tenant_id=tenant_id,
                property_id=property_id, portal_code=code,
                channel_id=channel_id, fehler=exc.message,
            )
            return {**ergebnis, "fehler": exc.message}

        objekte = self._kanal_objekt_ids(attrs)
        war_aktiv = bool(attrs.get("is_active"))
        ergebnis |= {"war_aktiv": war_aktiv, "objekte_am_kanal": len(objekte)}

        fremde = [o for o in objekte if o != verbindung.get("channex_property_id")]
        if fremde:
            log.warning(
                "verkauf_kanal_geteilt", tenant_id=tenant_id,
                property_id=property_id, portal_code=code,
                channel_id=channel_id, objekte_am_kanal=len(objekte),
                fremde_objekte=len(fremde),
            )
            return {
                **ergebnis,
                "fehler": (
                    f"Dieser Kanal trägt {len(objekte)} Objekte. Abschalten "
                    f"würde {len(fremde)} weitere Objekte mit abschalten — "
                    "deshalb wurde nichts geändert."
                ),
            }

        if not war_aktiv:
            self._pause_sichern(
                db, tenant_id, property_id, user_id=user_id,
                portal_code=code, hebel=HEBEL_KANAL,
                channel_id=channel_id, mapping_id=None, war_aktiv=False,
            )
            return {**ergebnis, "uebersprungen": "war bereits abgeschaltet"}

        self._pause_sichern(
            db, tenant_id, property_id, user_id=user_id,
            portal_code=code, hebel=HEBEL_KANAL,
            channel_id=channel_id, mapping_id=None, war_aktiv=True,
        )
        try:
            self._channex.deactivate_channel(channel_id)  # type: ignore[attr-defined]
        except ChannexError as exc:
            log.warning(
                "verkauf_kanal_senden_fehler", tenant_id=tenant_id,
                property_id=property_id, portal_code=code,
                channel_id=channel_id, fehler=exc.message,
                channex_status=exc.channex_status,
            )
            self._pause_verwerfen(db, tenant_id, property_id, code)
            return {**ergebnis, "fehler": exc.message}

        nachher = self._kanal_zuruecklesen(channel_id)
        ergebnis["ist_aktiv"] = nachher
        if nachher is not False:
            log.warning(
                "verkauf_kanal_nicht_uebernommen", tenant_id=tenant_id,
                property_id=property_id, portal_code=code,
                channel_id=channel_id, ist=nachher,
            )
            return {
                **ergebnis,
                "fehler": (
                    "Das Portal hat die Änderung nicht übernommen "
                    f"(is_active={nachher})."
                ),
            }

        db.table("channex_channel_connection").update({"is_active": False}).eq(
            "tenant_id", tenant_id
        ).eq("id", verbindung["id"]).execute()
        return {**ergebnis, "abgeschaltet": True}

    def _marktplatz_schalten(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        objekt: dict[str, Any],
        *,
        aktiv: bool,
        user_id: str | None,
    ) -> dict[str, Any]:
        """myBestDays — eigene Achse, kein Channex.

        Gehört mit dazu, weil „bei allen Portalen abschalten" sonst unvollständig
        wäre: der eigene Marktplatz ist ein gleichrangiger Buchungskanal.
        """
        war_gelistet = bool(objekt.get("listed_on_marketplace"))
        ergebnis = {
            "portal_code": MARKTPLATZ,
            "portal": MARKTPLATZ,
            "hebel": "listed_on_marketplace",
            "war_aktiv": war_gelistet,
        }
        if war_gelistet == aktiv:
            return {**ergebnis, "uebersprungen": "stand bereits so"}

        if not aktiv:
            self._pause_sichern(
                db, tenant_id, property_id, user_id=user_id,
                portal_code=MARKTPLATZ, hebel=HEBEL_KANAL,
                channel_id=MARKTPLATZ, mapping_id=None, war_aktiv=war_gelistet,
            )
        db.table("properties").update({"listed_on_marketplace": aktiv}).eq(
            "tenant_id", tenant_id
        ).eq("id", property_id).execute()
        return {**ergebnis, "ist_aktiv": aktiv,
                "abgeschaltet": not aktiv, "wiederhergestellt": aktiv}

    # ---- Portale wiederherstellen ------------------------------------------

    def _portal_wiederherstellen(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        pause: dict[str, Any],
        user_id: str | None,
    ) -> dict[str, Any]:
        """Den gesicherten Zustand EINES Portals zurückschreiben."""
        code = str(pause.get("portal_code") or "")
        ergebnis: dict[str, Any] = {
            "portal_code": code,
            "portal": (
                MARKTPLATZ if code == MARKTPLATZ
                else self._portal_label(code)  # type: ignore[attr-defined]
            ),
            "hebel": pause.get("hebel"),
            "war_aktiv": pause.get("war_aktiv"),
        }
        if not pause.get("war_aktiv"):
            # War vorher aus → bleibt aus. Die Pause wird geschlossen, damit sie
            # nicht ewig offen steht.
            self._pause_schliessen(db, tenant_id, pause["id"], user_id)
            return {**ergebnis, "uebersprungen": "war vor der Pause abgeschaltet"}

        if code == MARKTPLATZ:
            db.table("properties").update({"listed_on_marketplace": True}).eq(
                "tenant_id", tenant_id
            ).eq("id", property_id).execute()
            self._pause_schliessen(db, tenant_id, pause["id"], user_id)
            return {**ergebnis, "ist_aktiv": True, "wiederhergestellt": True}

        channel_id = str(pause.get("channex_channel_id") or "")
        ergebnis["channel_id"] = channel_id

        if pause.get("hebel") == HEBEL_MAPPING:
            fertig = self._mapping_wieder_an(db, tenant_id, pause, channel_id)
        else:
            fertig = self._kanal_wieder_an(db, tenant_id, pause, channel_id)

        if fertig.get("fehler"):
            return {**ergebnis, **fertig}
        self._pause_schliessen(db, tenant_id, pause["id"], user_id)
        return {**ergebnis, **fertig}

    def _mapping_wieder_an(
        self, db: Client, tenant_id: str, pause: dict[str, Any], channel_id: str
    ) -> dict[str, Any]:
        """Airbnb: das Listing wieder veröffentlichen.

        WELCHE Zuordnung, steht in der gesicherten Pause (`channex_mapping_id`) —
        genau dafür ist sie da. Die Rate-Plan-Kette erneut abzulaufen könnte eine
        ANDERE Zuordnung treffen, falls sich am Kanal zwischenzeitlich etwas
        geändert hat.

        Die `listing_id` steht NICHT in der Pause und wird über die gesicherte
        `mapping_id` frisch am Kanal gelesen: geschaltet wird über die Anzeige,
        nicht über die Mapping-ID. Ist die Zuordnung inzwischen weg, bricht es
        hier ab statt eine fremde zu treffen.
        """
        code = str(pause.get("portal_code") or "")
        property_id = str(pause["property_id"])
        mapping_id = str(pause.get("channex_mapping_id") or "")
        if not mapping_id:
            return {"fehler": "Zur Pause ist keine Zuordnung gespeichert."}

        try:
            attrs = self._kanal_attribute(channel_id)
        except ChannexError as exc:
            log.warning(
                "verkauf_kanal_nicht_lesbar", tenant_id=tenant_id,
                property_id=property_id, portal_code=code,
                channel_id=channel_id, fehler=exc.message,
            )
            return {"fehler": exc.message}

        listing_id = ""
        for eintrag in attrs.get("rate_plans") or []:
            if str(eintrag.get("id") or "") == mapping_id:
                listing_id = str(
                    (eintrag.get("settings") or {}).get("listing_id") or ""
                )
                break
        if not listing_id:
            log.warning(
                "verkauf_mapping_verschwunden", tenant_id=tenant_id,
                property_id=property_id, portal_code=code, mapping_id=mapping_id,
            )
            return {
                "fehler": (
                    "Die gesicherte Portal-Zuordnung existiert nicht mehr. "
                    "Bitte das Portal neu verbinden."
                )
            }

        return self._published_schalten(
            db, tenant_id, property_id,
            channel_id=channel_id, listing_id=listing_id, mapping_id=mapping_id,
            sichtbar=True, portal_code=code, ergebnis={},
        )

    def _kanal_wieder_an(
        self, db: Client, tenant_id: str, pause: dict[str, Any], channel_id: str
    ) -> dict[str, Any]:
        """Booking.com & Co.: Kanal aktivieren und zurücklesen.

        Der ARI-Nachschub läuft NICHT hier, sondern EINMAL je Objekt am Ende von
        `objekt_verkauf_fortsetzen` — siehe `_ari_nachschub`.
        """
        code = str(pause.get("portal_code") or "")
        property_id = str(pause["property_id"])
        try:
            self._channex.activate_channel(channel_id)  # type: ignore[attr-defined]
        except ChannexError as exc:
            log.warning(
                "verkauf_kanal_senden_fehler", tenant_id=tenant_id,
                property_id=property_id, portal_code=code,
                channel_id=channel_id, fehler=exc.message,
                channex_status=exc.channex_status,
            )
            return {"fehler": exc.message}

        nachher = self._kanal_zuruecklesen(channel_id)
        if nachher is not True:
            log.warning(
                "verkauf_kanal_nicht_uebernommen", tenant_id=tenant_id,
                property_id=property_id, portal_code=code,
                channel_id=channel_id, ist=nachher,
            )
            return {
                "ist_aktiv": nachher,
                "fehler": (
                    "Das Portal hat die Wiederaufnahme nicht übernommen "
                    f"(is_active={nachher})."
                ),
            }
        db.table("channex_channel_connection").update({"is_active": True}).eq(
            "tenant_id", tenant_id
        ).eq("channex_channel_id", channel_id).eq(
            "property_id", property_id
        ).execute()
        return {"ist_aktiv": True, "wiederhergestellt": True}

    def _ari_nachschub(self, tenant_id: str, property_id: str) -> None:
        """Verfügbarkeit/Preise nach der Pause neu an die Portale geben.

        „Full Sync" ist bei Channex NICHTS, was man dort auslöst — es ist etwas,
        das WIR senden. Die Zertifizierungs-Doku sagt es wörtlich: „Full sync
        means you should send 500 days of Availability, rates and restrictions
        for all rooms and rates on the property… 2 API calls". Genau das tut
        `full_sync_property` (live bestätigt: POST availability + POST
        restrictions, beide mit Channex-Task-ID zurück).

        Der naheliegende `GET channels/{id}/action/full_sync` antwortet dagegen
        **400 `["action is not supported"]`** — der `action`-Namensraum kennt den
        Namen nicht, und im `execute`-Namensraum hätte ein 200 nichts bewiesen,
        weil dieser jeden Namen quittiert.

        EINMAL JE OBJEKT, nicht je Kanal: `full_sync_property` pusht die ARI der
        Channex-Property, an der ALLE Kanäle dieses Objekts hängen. Ein Aufruf je
        Portal hätte denselben Push doppelt gesendet.

        Best effort MIT Protokoll (Wurzel 5): scheitert es, sind die Inserate
        trotzdem wieder online — der Hauptzweck ist erreicht, und der nächtliche
        Voll-Abgleich holt den Stand nach. Verschluckt wird es nicht: ohne die
        Warnung würde niemand merken, dass ein Portal mit einem alten Stand
        verkauft.
        """
        try:
            self.full_sync_property(tenant_id, property_id)  # type: ignore[attr-defined]
        except (ChannexError, ChannelManagerError) as exc:
            log.warning(
                "verkauf_ari_nachschub_fehlgeschlagen",
                tenant_id=tenant_id, property_id=property_id,
                fehler=getattr(exc, "message", str(exc)),
                hinweis=(
                    "Inserate sind online, Preise/Verfügbarkeit ggf. veraltet — "
                    "der nächtliche Voll-Abgleich holt sie nach."
                ),
            )

    # ---- Sicherung (property_sales_pause) ----------------------------------

    def _pause_sichern(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        *,
        user_id: str | None,
        portal_code: str,
        hebel: str,
        channel_id: str,
        mapping_id: str | None,
        war_aktiv: bool,
    ) -> None:
        """Den Vorzustand festhalten — VOR dem Schalten.

        Läuft schon eine offene Pause für (Objekt, Portal), wird sie NICHT
        überschrieben: der erste gesicherte Stand ist der echte Vorzustand. Ein
        zweiter Aufruf (Doppelklick, Retry) würde sonst den bereits
        abgeschalteten Zustand als „vorher" sichern und den Rückweg vernichten
        (Wurzel 2). Der unique Index in 0375 ist der Backstop dahinter.
        """
        vorhanden = (
            db.table("property_sales_pause")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("portal_code", portal_code)
            .is_("beendet_at", "null")
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            return

        db.table("property_sales_pause").insert({
            "tenant_id": tenant_id,
            "property_id": property_id,
            "portal_code": portal_code,
            "hebel": hebel,
            "channex_channel_id": channel_id,
            "channex_mapping_id": mapping_id,
            "war_aktiv": war_aktiv,
            "pausiert_von": user_id,
        }).execute()

    def _pause_verwerfen(
        self, db: Client, tenant_id: str, property_id: str, portal_code: str
    ) -> None:
        """Sicherung löschen, wenn das Schalten scheiterte.

        Sonst bliebe eine Pause stehen, die nichts beschreibt: das Portal
        verkauft weiter, wir hätten aber einen „Vorzustand" gespeichert und der
        Wiederaufnahme-Weg würde später etwas zurückschreiben, das nie geändert
        wurde (Wurzel 1 — der Gegenzustand muss mitgepflegt werden).
        """
        db.table("property_sales_pause").delete().eq("tenant_id", tenant_id).eq(
            "property_id", property_id
        ).eq("portal_code", portal_code).is_("beendet_at", "null").execute()

    def _pause_schliessen(
        self, db: Client, tenant_id: str, pause_id: str, user_id: str | None
    ) -> None:
        db.table("property_sales_pause").update(
            {"beendet_at": "now()", "beendet_von": user_id}
        ).eq("tenant_id", tenant_id).eq("id", pause_id).execute()

    # ---- Lesen ------------------------------------------------------------

    def _verkauf_verbindungen(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, Any]]:
        """Portale dieses Objekts, die WIRKLICH einen Kanal haben.

        Eine Zeile in `channex_channel_connection` ohne `channex_channel_id` ist
        eine Absichtserklärung, kein Kanal (live: 78 Zeilen, 18 mit Kanal-ID).
        Sie hier mitzunehmen würde „abgeschaltet" für ein Portal melden, an das
        nie etwas ging (Wurzel 4).
        """
        rows = (
            db.table("channex_channel_connection")
            .select(
                "id, ota_portal_code, channex_channel_id, channex_property_id, "
                "is_active, ota_hotel_id"
            )
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
        return [
            {
                "id": r["id"],
                "portal_code": str(r.get("ota_portal_code") or ""),
                "channel_id": str(r.get("channex_channel_id") or ""),
                "channex_property_id": str(r.get("channex_property_id") or ""),
                "is_active": bool(r.get("is_active")),
                "hotel_id": r.get("ota_hotel_id"),
            }
            for r in rows
            if r.get("channex_channel_id") and r.get("ota_portal_code")
        ]

    def _kanal_attribute(self, channel_id: str) -> dict[str, Any]:
        """`attributes` eines Kanals — der einzige Ist-Stand, den Channex gibt.

        Es gibt KEINEN GET-Pfad für Mappings (`channels/{id}/mappings` → 404);
        der Stand steht ausschließlich hier unter `rate_plans[]`.
        """
        kanal = self._channex.get_channel(channel_id)  # type: ignore[attr-defined]
        return ((kanal or {}).get("data") or {}).get("attributes") or {}

    @staticmethod
    def _kanal_objekt_ids(attrs: dict[str, Any]) -> list[str]:
        """Channex-Property-IDs am Kanal — die Liste ist mal Strings, mal Objekte."""
        ids: list[str] = []
        for eintrag in attrs.get("properties") or []:
            if isinstance(eintrag, str):
                ids.append(eintrag)
            elif isinstance(eintrag, dict):
                wert = eintrag.get("id")
                if wert:
                    ids.append(str(wert))
        return ids

    def _mapping_des_objekts(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        attrs: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Die Zuordnung DIESES Objekts am Kanal finden.

        Über unsere Rate-Plan-IDs (`channex_property_map` →
        `channex_room_type_map` → `channex_rate_plan_map`), abgeglichen gegen
        `attributes.rate_plans[].rate_plan_id`. Bei einem geteilten Airbnb-Kanal
        ist das der einzige Weg, die eigene Zuordnung von 17 fremden zu
        unterscheiden.
        """
        eigene = self._channex_rate_plan_ids(  # type: ignore[attr-defined]
            db, tenant_id, property_id
        )
        if not eigene:
            return None
        for eintrag in attrs.get("rate_plans") or []:
            if str(eintrag.get("rate_plan_id") or "") in eigene:
                return eintrag
        return None

    def _mapping_zuruecklesen(
        self, channel_id: str, mapping_id: str
    ) -> bool | None:
        """`published` nach dem Schalten frisch vom Kanal lesen.

        Der eigentliche Erfolgsnachweis: ein 200 von Channex bedeutet nichts (der
        `execute`-Namensraum quittiert jeden Namen, und ein Kanal-PUT nimmt
        Mapping-Settings gar nicht an). `None` heißt: nicht feststellbar, und
        wird vom Aufrufer wie ein Fehlschlag behandelt.

        Sucht über die `mapping_id`, nicht über unsere Rate-Plan-Kette: welche
        Zuordnung geschaltet wurde, steht bereits fest.
        """
        try:
            attrs = self._kanal_attribute(channel_id)
        except ChannexError as exc:
            log.warning(
                "verkauf_ruecklesen_fehlgeschlagen", channel_id=channel_id,
                mapping_id=mapping_id, fehler=exc.message,
            )
            return None
        for eintrag in attrs.get("rate_plans") or []:
            if str(eintrag.get("id") or "") == mapping_id:
                wert = (eintrag.get("settings") or {}).get(_PUBLISHED)
                return bool(wert) if wert is not None else None
        log.warning(
            "verkauf_mapping_nach_schalten_fehlt", channel_id=channel_id,
            mapping_id=mapping_id,
        )
        return None

    def _kanal_zuruecklesen(self, channel_id: str) -> bool | None:
        """`is_active` nach dem Schalten frisch vom Kanal lesen."""
        try:
            attrs = self._kanal_attribute(channel_id)
        except ChannexError as exc:
            log.warning(
                "verkauf_ruecklesen_fehlgeschlagen", channel_id=channel_id,
                fehler=exc.message,
            )
            return None
        wert = attrs.get("is_active")
        return bool(wert) if wert is not None else None
