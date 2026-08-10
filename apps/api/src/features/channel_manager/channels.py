"""OTA-Kanäle inhouse: Katalog, Connect, An/Aus, Persistenz, Webhooks.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
# pylint: disable=too-many-lines
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext, secrets_match

from .channex_client import ChannexError
from .common import ChannelManagerError, _booking_room_type, log
from .ota_konten import (
    KontoNichtGefunden,
    gehoert_kanal_dem_betrieb,
    konten_des_betriebs,
    konto_sicherstellen,
    konto_umbenennen,
    konto_zum_kanal_loesen,
    objekte_je_konto_zaehlen,
)


class ChannelsMixin:
    """OTA-Kanäle inhouse: Katalog, Connect, An/Aus, Persistenz, Webhooks."""


    # -- Kanäle (OTA) inhouse: Channel-API nach Skill --------------------------
    # White-label: der interne Channel-Code (z.B. "BookingCom") wird dem Kunden
    # nie erklärt; angezeigt wird nur der menschliche Name (label). Die Portal-
    # Felder kommen LIVE aus /channels/list (params, nicht-`hidden`) — nicht raten.
    # Kuratierte Anzeige-Metadaten (Label + Icon) NUR für Kanäle, für die wir ein
    # schöneres Label/Logo wollen. Die Portal-LISTE selbst kommt live aus dem
    # Channex-Katalog (channels/list) — nichts hardcoden/erfinden (Wurzel 4), so
    # erscheinen genau die Kanäle, die der Account wirklich verbinden kann.
    _CURATED_META: dict[str, dict[str, str]] = {
        "BookingCom": {"label": "Booking.com", "icon": "simple-icons:bookingdotcom"},
        "AirBNB": {"label": "Airbnb", "icon": "simple-icons:airbnb"},
        "Expedia": {"label": "Expedia", "icon": "simple-icons:expedia"},
        "Agoda": {"label": "Agoda", "icon": "simple-icons:agoda"},
        "Hostelworld": {"label": "Hostelworld", "icon": "ph:bed"},
        "GoogleHotelARI": {"label": "Google", "icon": "simple-icons:google"},
        "CTrip": {"label": "Trip.com", "icon": "ph:airplane-tilt"},
        "Ostrovok": {"label": "Ostrovok", "icon": "ph:buildings"},
    }
    # Sandbox-Testkanal (NUR wenn channex_sandbox_portals=True): OpenChannel ruft
    # UNSEREN Mock-OTA-Endpoint (sandbox_ota.py) auf → kompletter Connect-Flow
    # ohne echtes OTA-Konto. endpoint/hotel_code/api_key setzt der Service selbst.
    _SANDBOX_CODE = "OpenChannel"
    _SANDBOX_CATALOG: list[dict[str, str]] = [
        {"code": _SANDBOX_CODE, "label": "Testkanal (Sandbox)", "icon": "ph:flask"},
    ]
    # OAuth-Portale: KEIN eingebbares Credential, Verbindung per OAuth-URL (Airbnb).
    # Allowlist als Absicherung — zusätzlich erkennt list_supported_portals OAuth
    # automatisch daran, dass der Katalog kein abfragbares Credential-Feld hat.
    _OAUTH_PORTALS: frozenset[str] = frozenset({"AirBNB"})

    def _portal_catalog(self) -> list[dict[str, str]]:
        """Verbindbare Portale — LIVE aus dem Channex-Katalog (channels/list),
        nicht hardcoded. Label/Icon aus _CURATED_META, sonst aus dem Katalog-
        Titel + generisches Icon. Der Sandbox-Testkanal (OpenChannel) erscheint
        nur, wenn channex_sandbox_portals=True. Ist der Katalog nicht erreichbar,
        fallen wir auf die kuratierten Kern-OTAs zurück (keine leere Liste, aber
        auch nichts Erfundenes — nur bekannte, real existierende Codes)."""
        from src.core.config import get_settings

        sandbox_on = get_settings().channex_sandbox_portals
        try:
            raw = self._channex.list_channel_catalog().get("data") or []
        except ChannexError:
            raw = []

        catalog: list[dict[str, str]] = []
        for entry in raw:
            code = entry.get("code")
            if not code:
                continue
            # Testkanal nur im Sandbox-Modus zeigen.
            if code == self._SANDBOX_CODE and not sandbox_on:
                continue
            meta = self._CURATED_META.get(code, {})
            catalog.append(
                {
                    "code": code,
                    "label": meta.get("label") or entry.get("title") or code,
                    "icon": meta.get("icon", "ph:broadcast"),
                }
            )

        if not catalog:
            # Katalog nicht erreichbar → kuratierte Kern-OTAs (bekannte Codes).
            catalog = [
                {"code": code, "label": m["label"], "icon": m["icon"]}
                for code, m in self._CURATED_META.items()
                if code in ("BookingCom", "AirBNB", "Expedia")
            ]
            if sandbox_on:
                catalog.extend(self._SANDBOX_CATALOG)
        return catalog

    def _portal_label(self, code: str | None) -> str:
        """Menschliches Label für einen Kanal-Code — OHNE Channex-Call (wird auf
        heißen Pfaden wie Connections/Detail genutzt). Kuratiert, sonst der Code
        selbst als lesbarer Fallback. Kein Provider-Interna nach außen."""
        if not code:
            return "Kanal"
        meta = self._CURATED_META.get(code)
        return meta["label"] if meta else code

    def _channel_spec(self, code: str) -> dict[str, Any]:
        """Katalog-Eintrag eines Kanals (params, mapping_mode, rate_params,
        channel_restrictions …). Leeres Dict, wenn der Katalog nicht erreichbar
        ist — die Aufrufer behandeln das als „keine Zusatzangaben", statt sich
        etwas auszudenken."""
        try:
            raw = self._channex.list_channel_catalog().get("data") or []
        except ChannexError:
            return {}
        for entry in raw:
            if entry.get("code") == code:
                return entry
        return {}

    def _is_known_portal(self, code: str) -> bool:
        """Ist `code` ein real verbindbarer Kanal? Gegen den LIVE-Katalog geprüft
        (alle vom Account unterstützten Kanäle, nicht nur die kuratierten). Bei
        Katalog-Ausfall fallen wir auf die kuratierten Codes zurück (fail-closed
        für Unbekanntes, aber die Kern-OTAs bleiben nutzbar)."""
        try:
            raw = self._channex.list_channel_catalog().get("data") or []
        except ChannexError:
            return code in self._CURATED_META
        codes = {c.get("code") for c in raw}
        return code in codes

    # Vorab-Anleitung je Kanal (white-label): was der Kunde ZUERST im OTA-Extranet
    # tun muss. ACHTUNG: der genaue Extranet-Pfad, der Provider-Anzeigename
    # (Channex vs. myNextDays) und der Schrittname („XML-Vereinbarung") sind
    # NOCH ZU VERIFIZIEREN (Recherche/Live-Prüfung offen) — bis dahin nur als
    # vorläufig behandeln, nicht als belegte Wahrheit. Kein Hint = besser als ein
    # falscher (Wurzel 4/keine erfundenen Aussagen). Kein „Channex" im Kundentext.
    _SETUP_HINTS: dict[str, str] = {
        # Belegt (help.channex.io „Connect with Booking.com" + Booking-Partner-
        # Doku): der Provider heißt im Extranet real „Channex" und MUSS so
        # ausgewählt werden — White-Label endet an der OTA-Extranet-Grenze, der
        # Hotelier findet den Eintrag sonst nicht. Ausdrücklich freigegebene
        # Ausnahme zur „nie Channex im Kundentext"-Regel. Schritt heißt „XML
        # Service Agreement" (Zustimmen), danach Waiting-Status bis zur Annahme.
        "BookingCom": (
            "Gib im Booking.com-Extranet unter „Konto → Connectivity-Anbieter“ "
            "im Suchfeld „Channex“ ein, wähle den Eintrag aus und stimme dem "
            "„XML Service Agreement“ zu („Yes, I accept“). Kopiere oben im "
            "Extranet deine Booking.com-Hotel-ID und trage sie hier ein — die "
            "Verbindung wird danach automatisch freigeschaltet."
        ),
        # Belegt (docs.channex.io Expedia-Guide + Expedia Partner Central):
        # Provider heißt „Channex" und wird für BEIDE Optionen gewählt (Rates &
        # Availability + Reservations). 2FA ist NUR Login-Schutz der Seite, keine
        # „Provider-Bestätigung". Ausnahme zur „nie Channex im Kundentext"-Regel
        # (freigegeben, sonst findet der Hotelier den Eintrag nicht).
        "Expedia": (
            "Wähle im Expedia Partner Central unter „Zimmer & Preise → "
            "Connectivity-Einstellungen“ (ggf. mit 2-Faktor-Login) „Channex“ als "
            "Anbieter für BEIDE Optionen — Verfügbarkeit & Preise sowie "
            "Reservierungen — und bestätige. Trage dann hier deine Expedia-"
            "Property-ID ein."
        ),
        # Airbnb läuft über OAuth (Button „Verbinden"), keine Extranet-ID-Eingabe.
        "AirBNB": (
            "Verbinde dein Airbnb-Konto über den Button „Verbinden“ und bestätige "
            "den Zugriff im Airbnb-Login. Das Inserat darf noch mit keinem "
            "anderen Channel-Manager verbunden sein."
        ),
    }

    # Katalog-Feldtyp → Render-Hinweis fürs Frontend. `hidden` erscheint nie in
    # der Maske (Channex setzt diese Felder selbst), `slug` ist ein Textfeld.
    _FIELD_TYPES: dict[str, str] = {
        "string": "text",
        "slug": "text",
        "password": "password",
        "boolean": "checkbox",
        "select": "select",
        "switch": "switch",
        "number": "number",
        "integer": "number",
    }
    # Feldtypen, die als ZUGANGSDATEN zählen: hat ein Kanal keines davon (außer
    # der reinen Benachrichtigungs-E-Mail), läuft er über OAuth.
    _CREDENTIAL_TYPES: frozenset[str] = frozenset({"text", "password"})

    def list_supported_portals(
        self, ctx: AuthContext | None = None
    ) -> list[dict[str, Any]]:
        """Verbindbare Portale + die komplette Eingabemaske je Portal.

        Die Felder kommen 1:1 aus `params` des Kanal-Katalogs — ALLE Typen
        (Text, Passwort, Auswahl, Schalter, Zahl), nicht nur Text. `hidden`
        bleibt außen vor (das setzt der Provider selbst). Pflicht ist ein Feld
        genau dann, wenn es keinen Katalog-Default hat; Felder MIT Default sind
        optionale Einstellungen und landen im Bereich „Erweitert". Die
        Sichtbarkeitsregeln (`rules`) reicht der Server durch, das Frontend
        wertet sie live aus — sonst fragen wir Felder ab, die der Kanal in
        dieser Konstellation gar nicht kennt.

        Mit ctx wird das E-Mail-Feld mit der hinterlegten Betriebs-E-Mail
        vorbefüllt (`default`), damit der Kunde sie nicht abtippen muss. Fehlt
        sie, bleibt das Feld leer (kein erfundener Wert, Wurzel 4)."""
        try:
            catalog = self._channex.list_channel_catalog().get("data") or []
        except ChannexError:
            catalog = []
        by_code = {c.get("code"): c for c in catalog}
        default_email = self._tenant_company_email(ctx) if ctx else None

        out: list[dict[str, Any]] = []
        for portal in self._portal_catalog():
            spec = by_code.get(portal["code"]) or {}
            restrictions = spec.get("channel_restrictions") or {}
            base = {
                "code": portal["code"],
                "label": portal["label"],
                "icon": portal["icon"],
                "setup_hint": self._SETUP_HINTS.get(portal["code"]),
                "mapping_mode": spec.get("mapping_mode"),
                "mapping_required": not spec.get("mapping_is_not_required", False),
                "min_price_currency": restrictions.get("currency"),
                "min_price": restrictions.get("min_price"),
            }
            # Sandbox-Testkanal: keine Eingaben — Service setzt alles selbst
            # (credential-Flow, Service injiziert endpoint/hotel_code/api_key).
            if portal["code"] == self._SANDBOX_CODE:
                out.append({**base, "fields": [], "connection_type": "credential"})
                continue

            fields = self._portal_fields(
                spec.get("params") or {}, portal["label"], default_email
            )
            # OAuth ⇔ kein abfragbares Zugangsdaten-Feld außer der Property-E-Mail
            # (z.B. Airbnb) ODER explizit in der Allowlist. E-Mail allein ist kein
            # Credential-Login → solche Kanäle laufen über die OAuth-URL.
            credential_fields = [
                f for f in fields
                if f["required"]
                and f["type"] in self._CREDENTIAL_TYPES
                and "email" not in f["key"].lower()
            ]
            is_oauth = portal["code"] in self._OAUTH_PORTALS or not credential_fields
            out.append(
                {
                    **base,
                    "fields": [] if is_oauth else fields,
                    "connection_type": "oauth" if is_oauth else "credential",
                }
            )
        return out

    def _portal_fields(
        self, params: dict[str, Any], portal_label: str, default_email: str | None
    ) -> list[dict[str, Any]]:
        """`params` des Katalogs in unsere Maske übersetzen (siehe
        list_supported_portals). Reihenfolge wie im Katalog (`position`)."""
        fields: list[dict[str, Any]] = []
        for key, meta in sorted(
            params.items(), key=lambda kv: kv[1].get("position", 99)
        ):
            render = self._FIELD_TYPES.get(meta.get("type") or "")
            if render is None:  # hidden & unbekannte Typen: nicht abfragen
                continue
            if render == "text" and "email" in key.lower():
                render = "email"
            has_default = "default" in meta
            default = meta.get("default")
            if render == "email" and default_email and not default:
                default = default_email
            fields.append(
                {
                    "key": key,
                    "label": self._humanize_field(
                        meta.get("title"), portal_label, key
                    ),
                    "placeholder": "",
                    # Ohne Katalog-Default ist das Feld eine Pflichtangabe des
                    # Kunden; mit Default eine optionale Einstellung.
                    "required": not has_default,
                    "type": render,
                    "default": default,
                    "options": list(meta.get("options") or []),
                    "advanced": has_default,
                    "rules": [
                        {
                            "apply": r.get("apply", "hidden"),
                            "when": r.get("when"),
                            "influence_field": r.get("influence_field", ""),
                        }
                        for r in meta.get("rules") or []
                        # Ältere Katalog-Einträge tragen an dieser Stelle keinen
                        # Regelsatz, sondern nur ein Flag — dann gibt es nichts
                        # auszuwerten.
                        if isinstance(r, dict) and r.get("influence_field")
                    ],
                }
            )
        return fields

    def _tenant_company_email(self, ctx: AuthContext) -> str | None:
        """Hinterlegte Betriebs-E-Mail des Tenants (tenant_billing_profile.email)
        zum Vorbefüllen des Portal-E-Mail-Felds. Über den Server (service_role),
        weil die Tabelle am anon-/authenticated-Direktpfad gesperrt ist (Wurzel 6).
        None, wenn keine hinterlegt ist — kein erfundener Wert (Wurzel 4)."""
        try:
            tenant_id = self._require_tenant(ctx)
            db = self._require_db()
        except ChannelManagerError:
            return None
        row = (
            db.table("tenant_billing_profile")
            .select("email")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return (row[0].get("email") if row else None) or None

    # Wiederkehrende Katalog-Felder in Klartext (der Katalog liefert englische
    # Titel). Nur belegte Schlüssel — unbekannte behalten ihren Katalog-Titel,
    # statt dass wir eine Bedeutung erfinden (Wurzel 4).
    _FIELD_LABELS: dict[str, str] = {
        "send_email_notifications": "Buchungsbenachrichtigung per E-Mail senden",
        "min_stay_type": "Mindestaufenthalt gilt für",
        "booking_amount_settings": "Buchungsbetrag",
        "booking_tax_settings": "Steuerbetrag",
        "rate_plans_enabled": "Preispläne verwenden",
        "pricing_type": "Preisart",
        "api_key": "API-Schlüssel",
        "access_token": "Zugriffs-Token",
        "endpoint": "API-Adresse",
        "hotel_code": "Hotel-Code",
        "cohost_payout_calculations": "Auszahlung des Co-Gastgebers berechnen",
    }

    @classmethod
    def _humanize_field(
        cls, title: str | None, portal_label: str, key: str = ""
    ) -> str:
        """Channex-Feldtitel ggf. white-label machen (z.B. 'Hotel ID' →
        'Booking.com Hotel-ID'). Kein Provider-Name durchsickern lassen."""
        known = cls._FIELD_LABELS.get(key)
        if known:
            return known
        t = (title or "").strip() or "Wert"
        low = t.lower()
        if low in ("hotel id", "hotel_id", "hotel code"):
            return f"{portal_label} Hotel-ID"
        if low in ("property email", "email"):
            return "Objekt-E-Mail (für Benachrichtigungen)"
        return t

    def list_channels(self, ctx: AuthContext) -> list[dict[str, Any]]:
        """Verbundene Kanäle des Tenants (white-label)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        prop_ids = self._tenant_channex_property_ids(db, tenant_id)
        if not prop_ids:
            return []
        try:
            data = self._channex.list_channels().get("data") or []
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        out: list[dict[str, Any]] = []
        for ch in data:
            a = ch.get("attributes") or ch
            if not set(a.get("properties") or []).intersection(prop_ids):
                continue  # fremder Kanal — nicht dieses Tenants
            out.append(
                {
                    "id": ch.get("id") or a.get("id"),
                    "portal": self._portal_label(a.get("channel")),
                    "title": a.get("title"),
                    "is_active": bool(a.get("is_active")),
                }
            )
        return out

    def prepare_channel(
        self, ctx: AuthContext, *, property_id: str, portal_code: str,
        settings: dict[str, Any], account_id: str | None = None,
    ) -> dict[str, Any]:
        """Skill-Schritte 1+2: Zugangsdaten prüfen (test_connection) und die
        OTA-seitigen Zimmer/Raten holen (mapping_details). Liefert die OTA-Zimmer
        UND unsere lokalen Rate-Plans zurück, damit die UI zuordnen kann.
        Legt NOCH NICHTS an."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if not self._is_known_portal(portal_code):
            raise ChannelManagerError("Unbekanntes Portal.", status_code=400)

        # Objekt bei Channex registrieren, falls noch nicht geschehen. Ein Objekt
        # kann aktiv sein, ohne dass der (best-effort/asynchrone) Content-Sync je
        # durchlief (z. B. beim Anlegen fehlte noch ein Preis) → dann existiert
        # keine channex_property_map-Zeile und prepare/test_connection wäre nicht
        # möglich. Statt hier mit 409 in eine Sackgasse zu laufen, holen wir die
        # Registrierung nach: sync_content ist idempotent und legt Property +
        # Room-Type + Rate-Plans an. Fehlt ein Preis, wirft sync_content ein
        # klares 422 („Kein Preisplan vorhanden …") — die präzise, umsetzbare
        # Meldung statt des irreführenden „noch nicht verbunden".
        channex_property_id = self._ensure_property_registered(
            db, tenant_id, property_id
        )
        # Trace-Kontext setzen, damit `test_connection` und `mapping_details`
        # in `channex_debug_log` landen. Ohne ihn schreibt der Sink nichts (er
        # braucht einen Tenant) — und dann ist NICHT nachvollziehbar, welche
        # Kennung abgefragt wurde und was das Portal geantwortet hat. Genau das
        # fehlte am 07.08.2026 bei Booking.com: die Maske bot „Two-Bedroom
        # Apartment" an, im Log stand zu diesem Portal kein einziger Aufruf.
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="prepare"
        )
        settings = self._inject_sandbox_settings(portal_code, property_id, settings)

        # OAuth-Portale (Airbnb): die maßgeblichen Settings liegen am KANAL bei
        # Channex — dort stehen nach dem Autorisieren die Tokens. Das Frontend
        # kann sie nicht liefern (es gibt keine Eingabefelder, das ist der Sinn
        # von OAuth), und mit einem leeren `settings` lehnt Channex
        # `mapping_details` mit HTTP 400 ab. Live belegt:
        #     request_body '{"channel":"AirBNB","settings":{}}' → 400
        # Deshalb hier die echten Kanal-Settings nachladen statt zu raten.
        if portal_code in self._OAUTH_PORTALS:
            kanal_settings = self._oauth_channel_settings(
                db, tenant_id, property_id, portal_code, account_id=account_id
            )
            log.info("prepare_oauth_settings",
                     portal_code=portal_code, property_id=property_id,
                     gefunden=kanal_settings is not None,
                     keys=sorted((kanal_settings or {}).keys()),
                     token_keys=sorted(
                         ((kanal_settings or {}).get("tokens") or {}).keys()),
                     token_invalid=(kanal_settings or {}).get("token_invalid"))
            settings = kanal_settings or settings

        # 1) Zugangsdaten prüfen. ACHTUNG (live verifiziert): Channex liefert
        #    HTTP 200 AUCH bei falschen Daten — der Erfolg steht in data.success.
        try:
            res = self._channex.test_channel_connection(
                channel=portal_code, settings=settings
            )
        except ChannexError as exc:
            raise ChannelManagerError(
                f"Zugangsdaten abgelehnt: {exc.message}", status_code=422
            ) from exc
        data = res.get("data") or {}
        if data.get("success") is False:
            errs = data.get("errors")
            detail = (
                "; ".join(str(e) for e in errs)
                if isinstance(errs, list) and errs
                else "Die Zugangsdaten konnten nicht bestätigt werden. Bitte "
                "prüfe die eingegebene Kennung."
            )
            raise ChannelManagerError(f"Zugangsdaten abgelehnt: {detail}", status_code=422)

        # 2) OTA-Zimmer/Raten lesen.
        try:
            details = self._channex.get_channel_mapping_details(
                channel=portal_code, settings=settings
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        log.info("prepare_mapping_details_RAW",
                 portal_code=portal_code, property_id=property_id, raw=details)
        rooms = self._normalize_mapping_rooms(details)

        # Zuordnung auf ZIMMER-Ebene (Cloudbeds/SiteMinder-Standard: Zimmer→Zimmer,
        # die Raten des Zimmers verbindet der Server automatisch). Wir bieten die
        # ZIMMER (Objekte) dieser Property an — bei einer geteilten Hotel-Property
        # alle Zimmer des Hotels, bei einer FeWo das eine Objekt.
        local_rooms = self._local_room_options(db, tenant_id, channex_property_id)
        log.info("prepare_debug", portal_code=portal_code,
                 channex_property_id=channex_property_id,
                 ota_rooms=[{"id": r.get("id"), "title": r.get("title")}
                            for r in rooms],
                 local_rooms=local_rooms)
        return {
            "portal": self._portal_label(portal_code),
            "ota_rooms": rooms,        # [{id, title, rates:[{id, title, …}]}]
            "rooms": local_rooms,      # [{local_property_id, title}]
        }

    @staticmethod
    def _normalize_mapping_rooms(details: dict[str, Any]) -> list[dict[str, Any]]:
        """mapping_details kommt je OTA in drei Formen — auf eine einheitliche
        Struktur [{id, title, rates:[{id, title, pricing, max_persons}]}] bringen:
          a) Booking.com: data.rooms[].rates[]
          b) OpenChannel/„attributes": data.attributes.room_types[].rate_plans[]
          c) Airbnb (`mapping_mode: "listing"`):
             data.listing_id_dictionary.values[] — eine flache LISTING-Liste
             ohne Raten-Ebene. Live gemessen (04.08.2026, 18 Listings):
             {id, title, type, city, country_code, occupancies, quality_status,
              synchronization_category}. Fehlte diese Form, lief prepare mit
             `ota_rooms=[]` und die UI meldete „Das Portal liefert keine
             Zimmer", obwohl der Abruf 200 lieferte."""
        data = details.get("data") or {}
        listings = (data.get("listing_id_dictionary") or {}).get("values")
        if isinstance(listings, list) and listings:
            return [
                {
                    "id": lst.get("id"),
                    "title": lst.get("title"),
                    # Ein Airbnb-Listing hat keine Raten-Ebene: eine Rate je
                    # Listing, dieselbe ID — so ordnet auch Channex' eigene
                    # Maske zu (`rate_params.listing_id`).
                    "rates": [
                        {
                            "id": lst.get("id"),
                            "title": lst.get("title"),
                            "pricing": None,
                            "max_persons": max(
                                (b for b in (lst.get("occupancies") or [])
                                 if isinstance(b, int)),
                                default=None,
                            ),
                            "occupancies": lst.get("occupancies") or [],
                        }
                    ],
                }
                for lst in listings
                if isinstance(lst, dict) and lst.get("id")
            ]
        if data.get("rooms"):
            out = []
            for r in data["rooms"]:
                out.append(
                    {
                        "id": r.get("id"),
                        "title": r.get("title"),
                        "rates": [
                            {
                                "id": rt.get("id"),
                                "title": rt.get("title"),
                                "pricing": rt.get("pricing"),
                                "max_persons": rt.get("max_persons"),
                                "occupancies": rt.get("occupancies") or [],
                            }
                            for rt in (r.get("rates") or [])
                        ],
                    }
                )
            return out
        # attributes.room_types[].rate_plans[]
        attrs = data.get("attributes") or {}
        out = []
        for r in attrs.get("room_types") or []:
            out.append(
                {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "rates": [
                        {
                            "id": rp.get("id"),
                            "title": rp.get("title"),
                            "pricing": rp.get("sell_mode"),
                            "max_persons": rp.get("max_persons"),
                            "occupancies": [],
                        }
                        for rp in (r.get("rate_plans") or [])
                    ],
                }
            )
        return out

    def connect_channel(
        self, ctx: AuthContext, *, property_id: str, portal_code: str,
        title: str | None, settings: dict[str, Any],
        mappings: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Skill-Schritte 3+4: Kanal mit Zimmer-Zuordnung anlegen und aktivieren.
        `mappings` = [{local_property_id, room_type_code, occupancy, pricing_type}]
        — Zuordnung Zimmer→Zimmer; die Raten werden serverseitig expandiert."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        log.info("connect_debug_start", tenant_id=tenant_id,
                 property_id=property_id, portal_code=portal_code,
                 mappings=mappings, settings_keys=list((settings or {}).keys()))
        if not self._is_known_portal(portal_code):
            raise ChannelManagerError("Unbekanntes Portal.", status_code=400)
        spec = self._channel_spec(portal_code)
        # Manche Kanäle (Mietwagen & Co.) kennen gar keine Zimmer-Zuordnung —
        # der Katalog sagt das über `mapping_is_not_required`. Nur dort ist ein
        # leeres Mapping erlaubt.
        mapping_required = not spec.get("mapping_is_not_required", False)
        if mapping_required and not mappings:
            raise ChannelManagerError(
                "Mindestens eine Zimmer/Raten-Zuordnung ist nötig.", status_code=422
            )
        # KEINE Währungsprüfung: `channel_restrictions.currency` ist NICHT die
        # Pflichtwährung des Kanals, sondern die Bezugswährung des Mindestpreises.
        # Live belegt — ein Booking.com-Kanal auf ein GBP-Testhotel an einem
        # EUR-Objekt wurde mit HTTP 201 angelegt (01.08.2026).

        channex_property_id = self._require_property_mapping(db, tenant_id, property_id)
        log.info("connect_debug_property_mapping",
                 property_id=property_id, channex_property_id=channex_property_id)

        # Idempotenz (Wurzel 2): existiert für (property_id, portal_code) bereits
        # eine Verbindung mit einem Channex-Kanal, den bestehenden zurückgeben statt
        # bei Doppelklick/Retry einen ZWEITEN Channex-Kanal anzulegen (der DB-UNIQUE
        # channex_channel_connection_property_portal_uidx griffe erst NACH dem
        # Channex-create, sodass ein verwaister Zweit-Kanal bei Channex zurückbliebe).
        existing = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, is_active, ota_portal_code")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data
        log.info("connect_debug_existing_db_row", found=bool(existing),
                 row=existing[0] if existing else None)
        if existing and existing[0].get("channex_channel_id"):
            log.info("connect_debug_reuse_db_channel",
                     channel_id=existing[0]["channex_channel_id"])
            return {
                "id": existing[0]["channex_channel_id"],
                "portal": self._portal_label(portal_code),
                "title": title or self._portal_label(portal_code),
                "is_active": bool(existing[0].get("is_active")),
            }

        group_id = self._require_group(db, tenant_id, channex_property_id)
        settings = self._inject_sandbox_settings(portal_code, property_id, settings)
        # Wie im prepare-Pfad: bei OAuth-Portalen sind die Kanal-Settings mit den
        # Tokens maßgeblich, ein leeres `settings` führt zu 400.
        if portal_code in self._OAUTH_PORTALS:
            settings = self._oauth_channel_settings(
                db, tenant_id, property_id, portal_code
            ) or settings
        log.info("connect_debug_group_and_settings", group_id=group_id,
                 settings=settings)

        # OTA-Zimmer/Raten erneut holen: der Nutzer hat auf ZIMMER-Ebene zugeordnet
        # (Booking-Zimmer → mein Zimmer). Für Channex muss jede Rate des OTA-Zimmers
        # gemappt werden — die Raten expandiert _build_rate_plans aus diesen Details.
        try:
            details = self._channex.get_channel_mapping_details(
                channel=portal_code, settings=settings
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        log.info("connect_debug_mapping_details_RAW", raw=details)
        ota_rooms = self._normalize_mapping_rooms(details)
        log.info("connect_debug_ota_rooms_normalized", ota_rooms=ota_rooms)

        # rate_plans-Array bauen: je zugeordnetem Zimmer werden die OTA-Raten des
        # zugewiesenen OTA-Zimmers auf die Rate-Plans des Objekts gemappt (Primary
        # zuerst). Echte OTAs INTEGER-Codes, Sandbox String-Codes — Helfer trennt das.
        rate_plans = (
            self._build_rate_plans(db, tenant_id, portal_code, mappings, ota_rooms)
            if mapping_required
            else []
        )

        # Mehrere Zimmer, EINE Hotel-ID = EIN Channex-Kanal (live+Doku verifiziert:
        # Booking lehnt einen zweiten POST /channels mit derselben hotel_id mit 422
        # „already exists" ab). Existiert für dieses Portal beim Tenant schon ein
        # lebender Kanal MIT DERSELBEN Hotel-ID, wird dieses Zimmer nicht per POST
        # (neuer Kanal) angehängt, sondern additiv per PUT in den bestehenden Kanal
        # aufgenommen. PUT ERSETZT das rate_plans-Array (kein Merge) → die
        # bestehenden Einträge MÜSSEN mitgesendet werden (Wurzel 1: Gegenzustand
        # mitpflegen), sonst gehen die anderen Zimmer verloren.
        hotel_id = self._extract_hotel_id(settings)
        existing_channel_id = self._existing_channel_for_hotel(
            db, tenant_id, portal_code, hotel_id, channex_property_id
        )
        log.info("connect_debug_existing_channel_for_hotel",
                 hotel_id=hotel_id, existing_channel_id=existing_channel_id,
                 rate_plans=rate_plans)
        if existing_channel_id:
            return self._attach_room_to_channel(
                db, tenant_id,
                property_id=property_id,
                channex_property_id=channex_property_id,
                portal_code=portal_code,
                settings=settings,
                channel_id=existing_channel_id,
                new_rate_plans=rate_plans,
                mappings=mappings,
                ota_rooms=ota_rooms,
                title=title,
            )

        attrs: dict[str, Any] = {
            "channel": portal_code,
            "group_id": group_id,                 # Pflicht
            "is_active": False,                    # wird inaktiv erstellt
            "title": title or self._portal_label(portal_code),
            "properties": [channex_property_id],
            "settings": settings or {},
            "rate_plans": rate_plans,
        }
        log.info("connect_debug_create_channel_payload", attrs=attrs)
        try:
            created = self._channex.create_channel(attrs)
        except ChannexError as exc:
            log.error("connect_debug_create_channel_failed",
                      error=exc.message,
                      channex_status=getattr(exc, "channex_status", None),
                      channex_payload=getattr(exc, "payload", None),
                      attrs=attrs)
            # „channel with the same settings already exists": diese Booking-Hotel-ID
            # ist bei Channex bereits mit einem Kanal verbunden — entweder in einem
            # anderen Konto (bei den geteilten Booking-TEST-Hotel-IDs der Normalfall)
            # oder das Objekt wurde bereits verbunden. Klare, umsetzbare Meldung
            # statt des rohen „Validation Error" (Wurzel 5: präzise behandeln).
            if "already exists" in (exc.message or "").lower():
                raise ChannelManagerError(
                    "Diese Hotel-ID ist bei den Buchungsportalen bereits mit einer "
                    "Verbindung belegt. Prüfe, ob das Objekt schon verbunden ist — "
                    "oder verwende die korrekte Hotel-ID deines Portal-Kontos.",
                    status_code=409,
                ) from exc
            raise self._wrap_channex(exc) from exc

        channel_id = (created.get("data") or {}).get("id")
        a = (created.get("data") or {}).get("attributes") or {}
        is_active = bool(a.get("is_active"))

        # 4) Aktivieren (Kanäle starten inaktiv).
        activate_error: str | None = None
        if channel_id and not is_active:
            try:
                self._channex.activate_channel(channel_id)
                is_active = True
            except ChannexError as exc:
                # Anlegen hat geklappt — Aktivierung kann der Kunde wiederholen.
                activate_error = exc.message
                log.warning("channex_channel_activate_failed",
                            channel_id=channel_id, error=exc.message)

        # Verbindung persistieren: Hotel-ID + erzeugter Channel pro (Objekt, Portal).
        # So bleibt die Verbindung sichtbar/verwaltbar (Status, Trennen, Re-Connect)
        # und nach Reload nachvollziehbar. Persistenz-Fehler dürfen den erfolgreichen
        # Connect nicht scheitern lassen.
        # OTA-Zimmertyp dieses Objekts (Code + Klarname) für die Anzeige festhalten:
        # 1 Objekt = 1 OTA-Zimmertyp unter der Hotel-ID. Aus dem Mapping dieses
        # Objekts + den OTA-Zimmerdetails auflösen (nicht raten).
        room_code, room_title = self._mapped_room_for_property(
            property_id, mappings, ota_rooms
        )
        self._save_channel_connection(
            db, tenant_id,
            property_id=property_id,
            channex_property_id=channex_property_id,
            portal_code=portal_code,
            settings=settings,
            channel_id=channel_id,
            is_active=is_active,
            last_error=activate_error,
            ota_room_type_code=room_code,
            ota_room_title=room_title,
        )

        # Bestehende Reservierungen beim PORTAL ANSTOSSEN — vor dem Abholen.
        #
        # `import_bookings_for_property` (gleich darunter) FRAGT Channex nach dem,
        # was Channex bereits gesehen hat. Ein soeben angelegter Kanal hat aber
        # nichts gesehen: Booking.com schickt die vorhandenen Reservierungen erst,
        # wenn man sie anfordert („Pull Future Reservations"). Ohne diesen Schritt
        # holte der Connect zuverlässig NICHTS und der Betrieb stand vor einem
        # frisch verbundenen Objekt ohne eine einzige Buchung — live 10.08.2026 bei
        # „Feriehus Britt": Kanal angelegt und aktiv, Buchungen im Extranet
        # vorhanden, bei Channex null.
        #
        # Reihenfolge ist der ganze Punkt: erst anstoßen, dann abholen. Der Kanal
        # steht zu diesem Zeitpunkt bereits (angelegt + aktiviert), sonst hätte die
        # Aktion kein Ziel.
        #
        # Nur wenn der Katalog die Aktion für dieses Portal führt — nicht jedes
        # Portal kennt sie, und ein erfundener Aufruf wäre ein 404 im Log
        # (Wurzel 4: nichts raten, den Katalog fragen).
        _aktionen = self._channel_spec(portal_code).get("actions") or []
        log.info(
            "connect_pull_future_pruefung",
            portal_code=portal_code, channel_id=channel_id,
            katalog_aktionen=_aktionen,
            wird_angestossen=bool(
                channel_id and "load_future_reservations" in _aktionen
            ),
        )
        if channel_id and "load_future_reservations" in _aktionen:
            try:
                self._channex.run_channel_action(
                    channel_id, "load_future_reservations"
                )
                log.info(
                    "connect_pull_future_angestossen",
                    channel_id=channel_id, portal_code=portal_code,
                    hotel_id=settings.get("hotel_id"),
                )
            except ChannexError as exc:
                # Best effort: das Portal liefert die Buchungen sonst mit dem
                # nächsten Knopfdruck oder über den Feed — der Connect selbst darf
                # daran nicht scheitern (Wurzel 5).
                log.warning(
                    "channex_pull_future_failed",
                    channel_id=channel_id, error=exc.message,
                )

        # Initial-Vollimport (best effort): bestehende Buchungen, ARI/Preise,
        # Room-Types/Rate-Plans. Channel ist live; ein Import-Fehler darf den
        # Connect NICHT scheitern lassen (per Cron/erneutem Connect nachholbar).
        try:
            self.import_bookings_for_property(tenant_id, channex_property_id)
            self.import_rooms_rates_for_property(tenant_id, channex_property_id)
            self.import_ari_for_property(tenant_id, channex_property_id)
        except (ChannexError, ChannelManagerError) as exc:
            log.warning(
                "channex_initial_import_failed",
                channex_property_id=channex_property_id,
                error=getattr(exc, "message", str(exc)),
            )

        # Go-Live-Push DB→Channex: beim Start eines Kanals den kompletten Stand
        # (Verfügbarkeit + Preise/Restriktionen, 500 Tage) einreihen — das PMS
        # ist Availability-Master, der neue Kanal darf nie mit leerem/altem ARI
        # starten. Best effort: der Nightly-Full-Sync holt Verpasstes nach.
        try:
            from src.jobs.queue import dedup_key, enqueue

            enqueue(
                db, "full_sync_property", tenant_id=tenant_id,
                payload={"tenant_id": tenant_id, "property_id": property_id},
                dedup_key=dedup_key(tenant_id, property_id, "full_sync_property"),
            )
            # NACHHOLEN, verzögert: Der Anstoß oben ist ein AUFTRAG ans Portal,
            # keine Antwort. Booking.com stellt die Reservierungen erst danach
            # bereit — der Import wenige Zeilen später kommt zwangsläufig zu früh
            # und holt null. Ohne diesen zweiten Lauf bliebe ein frisch
            # verbundenes Objekt leer, bis jemand von Hand nachfasst (live
            # 10.08.2026 „Feriehus Britt": Kanal aktiv, Buchungen im Extranet,
            # bei Channex null).
            #
            # `vollstaendig=True`: derselbe Weg wie der manuelle Voll-Abgleich —
            # ALLE Buchungen ohne 3-Tage-Fenster plus die Gespräche. Eigener
            # dedup-Suffix, damit er weder den Go-Live-Push oben noch den
            # nächtlichen Lauf verdrängt.
            enqueue(
                db, "full_sync_property", tenant_id=tenant_id,
                payload={
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "vollstaendig": True,
                },
                dedup_key=dedup_key(
                    tenant_id, property_id, "full_sync_property",
                    suffix="nach-connect",
                ),
                delay_seconds=180,
            )
            log.info(
                "connect_nachhollauf_eingereiht",
                property_id=property_id, channel_id=channel_id,
                portal_code=portal_code, verzoegerung_s=180,
            )
        except Exception as exc:  # noqa: BLE001 — Connect nie am Enqueue kippen
            log.warning(
                "channel_golive_full_sync_enqueue_failed",
                property_id=property_id, error=str(exc)[:200],
            )

        return {
            "id": channel_id,
            "portal": self._portal_label(portal_code),
            "title": a.get("title") or title or self._portal_label(portal_code),
            "is_active": is_active,
        }

    def _build_rate_plans(
        self, db: Client, tenant_id: str, portal_code: str,
        mappings: list[dict[str, Any]], ota_rooms: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """rate_plans-Array aus ZIMMER-Zuordnungen bauen (gemeinsam von
        connect_channel und finalize_oauth_channel).

        Der Nutzer ordnet Zimmer→Zimmer zu (Booking-Zimmer → mein Objekt). Booking/
        Channex verlangen aber, dass JEDE Rate des OTA-Zimmers gemappt ist. Wir
        expandieren deshalb je Zuordnung: die Raten des OTA-Zimmers werden auf die
        Rate-Plans des Objekts gepaart — der erste Rate-Plan ist die Primary/
        Standard-Rate; hat das OTA-Zimmer mehr Raten als das Objekt Rate-Plans,
        laufen die überzähligen ebenfalls auf die Primary (Standard-Verhalten, s.
        Booking „derived rate plan"). Wirft, wenn ein zugeordnetes Objekt keinen
        Rate-Plan hat oder ein OTA-Zimmer keine Rate liefert.

        Die Feldnamen der Zuordnung sind NICHT fix: jeder Kanal deklariert sie im
        Katalog unter `rate_params` (Booking/Expedia: room_type_code +
        rate_plan_code + occupancy …, Airbnb: listing_id + airbnb_rate_plan_id).
        Gebaut wird deshalb genau das, was der Kanal deklariert.

        AIRBNB-BESONDERHEIT — `airbnb_rate_plan_id` bleibt LEER. Der Katalog
        deklariert das Feld, aber es gehört zu Airbnbs optionalen „Rate Plans",
        die erst existieren, wenn man sie bei Airbnb ANLEGT (Channex' eigene
        Maske tut das über `channels/{id}/action/create_rate_plan` und liest sie
        mit `action/retrieve_rate_plans`; live gegen unseren Kanal geprüft:
        `retrieve_rate_plans` → `{"data": []}`, es gibt keine). Ohne aktivierte
        Rate Plans setzt Channex' Maske nur `{listing_id, primary_occ}` — kein
        Ersatzwert, und insbesondere NICHT die Listing-ID ein zweites Mal.
        Deshalb liefert `_normalize_mapping_rooms` für ein Listing bewusst eine
        Rate mit derselben ID: `_rate_plan_settings` setzt daraus `listing_id`,
        und `airbnb_rate_plan_id` fällt weg, weil Channex es aus dem Katalog
        kennt, aber ohne Rate Plans nicht erwartet. Airbnb akzeptiert ohnehin nur
        EINEN Preis je Listing („Airbnb allows you to map only 1 rate plan").

        OFFEN (nicht verifiziert, weil ich bei Channex nichts anlegen darf): das
        SPA baut für Airbnb KEIN `rate_plans`-Array im Kanal-Update, sondern
        schickt jede Zuordnung einzeln an `POST channels/{id}/mappings` mit
        `{mapping: {rate_plan_id, settings: {listing_id, primary_occ}}}`. Sollte
        der `rate_plans`-Weg hier bei Airbnb scheitern, ist DAS der nächste
        Schritt — der Pfad antwortet auf GET mit 404, was nichts über POST sagt.
        """
        is_sandbox = portal_code == self._SANDBOX_CODE
        spec = self._channel_spec(portal_code)
        rate_params: dict[str, Any] = spec.get("rate_params") or {}
        # `direct` (z.B. Google): der Kanal kennt keine OTA-Codes, die Zuordnung
        # macht der Provider selbst — es geht nur die Rate-Plan-ID mit.
        direct_mode = spec.get("mapping_mode") == "direct" or not rate_params
        if direct_mode:
            return self._build_rate_plans_direct(
                db, tenant_id, mappings, portal_code
            )
        rooms_by_code = {str(r.get("id")): r for r in ota_rooms}
        seen_local: set[str] = set()
        # Channex/Booking-Eindeutigkeit gilt auf dem OTA-Paar (room_type_code,
        # rate_plan_code): dasselbe Paar darf im Array NUR EINMAL stehen (Doku:
        # „One OTA room+rate pair should map to at most one local rate plan").
        # Dedup deshalb auf DIESEM Paar (nicht auf der Channex-rate_plan_id) —
        # sonst landet dieselbe OTA-Rate doppelt und der Kanal ist inkonsistent.
        seen_pairs: set[tuple[Any, Any]] = set()
        # Genau EINE Rate trägt die Restriktionen (min_stay/stop_sell), weil Booking
        # pro Zimmer nur EINEN Restriktions-Träger kennt (Doku). Der erste erzeugte
        # Eintrag ist primary_occ=True, alle weiteren False.
        primary_used = False
        rate_plans: list[dict[str, Any]] = []
        for m in mappings:
            local_property_id = m.get("local_property_id")
            if not local_property_id:
                continue
            if local_property_id in seen_local:
                raise ChannelManagerError(
                    "Jedes Zimmer darf nur einem Portal-Zimmer zugeordnet werden.",
                    status_code=422,
                )
            seen_local.add(local_property_id)

            ota_room = rooms_by_code.get(str(m.get("room_type_code")))
            if not ota_room:
                raise ChannelManagerError(
                    "Zugeordnetes Portal-Zimmer nicht gefunden.", status_code=422
                )
            ota_rates = ota_room.get("rates") or []
            if not ota_rates:
                raise ChannelManagerError(
                    "Das Portal-Zimmer liefert keine Rate.", status_code=422
                )

            # Standard ist der GRUNDPREIS: der erste (Standard-)Preis des Zimmers
            # geht immer an die Portale; zusätzliche Preise nur, wenn der Kunde sie
            # je Preis freigeschaltet hat (rate_plans.send_to_portals, 0177).
            selected = self._selected_rate_plan_ids(
                db, tenant_id, local_property_id, portal_code
            )
            log.info(
                "build_rate_plans_debug_row",
                local_property_id=local_property_id,
                mapping_room_type_code=m.get("room_type_code"),
                ota_room_title=ota_room.get("title"),
                ota_rate_ids=[r.get("id") for r in ota_rates],
                channex_rate_plan_ids=selected,
            )

            room_code = (
                m.get("room_type_code") if is_sandbox
                else self._as_int(m.get("room_type_code"))
            )
            occupancy = self._as_int(m.get("occupancy")) or 2
            pricing_type = m.get("pricing_type") or "Standard"

            # Jede gewählte Rate auf eine eigene OTA-Rate paaren (Standard zuerst)
            # — und dann JEDE übrige OTA-Rate ebenfalls auf den ersten (Primary-)
            # Preisplan legen. Ohne diesen zweiten Teil blieben Raten unzugeordnet,
            # sobald das Portal-Zimmer mehr Raten führt als das Objekt Preispläne
            # hat: ein Ferienobjekt hat EINEN Preis, eine Booking-Kennung
            # regelmäßig drei (standard · special · non-refundable). `zip` allein
            # bricht bei der kürzeren Liste ab und ließ zwei davon liegen — und
            # eine nicht zugeordnete Rate verhindert die Aktivierung des Kanals
            # (Channex-Mapping-Anleitung: „Channel wont be activated unless you
            # map rooms and rates", „Map all rates even the derived ones").
            # Erlaubt ist das, weil die Eindeutigkeit auf dem OTA-PAAR
            # (Zimmer + Rate) liegt, nicht auf unserem Preisplan: mehrere
            # OTA-Raten dürfen auf denselben lokalen Plan zeigen, dieselbe
            # OTA-Rate aber nie zweimal (seen_pairs unten).
            pairs = list(zip(ota_rates, selected, strict=False))
            pairs += [(rate, selected[0]) for rate in ota_rates[len(pairs):]]

            for rate, channex_rate_plan_id in pairs:
                rate_code = (
                    rate.get("id") if is_sandbox else self._as_int(rate.get("id"))
                )
                if room_code is None or rate_code is None:
                    raise ChannelManagerError(
                        "Zimmer-/Raten-Code fehlt oder ist ungültig.",
                        status_code=422,
                    )
                # Dasselbe OTA-Paar nie zweimal ins Array.
                pair = (room_code, rate_code)
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                rate_plans.append(
                    {
                        "rate_plan_id": channex_rate_plan_id,
                        "settings": self._rate_plan_settings(
                            rate_params,
                            portal_code=portal_code,
                            room_code=room_code,
                            rate_code=rate_code,
                            occupancy=occupancy,
                            pricing_type=pricing_type,
                            primary=not primary_used,
                        ),
                    }
                )
                primary_used = True
        if not rate_plans:
            raise ChannelManagerError(
                "Bitte mindestens ein Zimmer zuordnen.", status_code=422
            )
        return rate_plans

    # Bedeutung der Katalog-Felder aus `rate_params` — welcher unserer Werte in
    # welches Feld gehört. Nur belegte Schlüssel; alles andere lassen wir weg,
    # statt einen Wert zu erfinden (Wurzel 4).
    _RATE_PARAM_ROOM_KEYS: frozenset[str] = frozenset({"room_type_code", "listing_id"})
    _RATE_PARAM_RATE_KEYS: frozenset[str] = frozenset({"rate_plan_code"})
    # `airbnb_rate_plan_id` steht im Katalog, wird aber NIE von uns gefüllt —
    # es meint Airbnbs optionale „Rate Plans", die bei uns nicht existieren
    # (`action/retrieve_rate_plans` → leer). Der Docstring von
    # `_build_rate_plans` versprach genau das schon immer; der Code hat es
    # nicht eingehalten und die LISTING-ID hineingeschrieben. Folge (live,
    # 07.08.2026, Stjerneskud): Channex schaltete auf Rate-Plan-Pushes um,
    # konnte die erfundene Rate nicht auflösen und sendete in jedem
    # `RatePlanInventoryUpdate` ein leeres `rate_plans: []` — Verfügbarkeit
    # kam an, PREISE NIE, Airbnb blieb dauerhaft auf dem Grundpreis. Die 17
    # funktionierenden Bestands-Mappings haben das Feld nicht.
    _RATE_PARAM_NIE_SETZEN: frozenset[str] = frozenset({"airbnb_rate_plan_id"})

    def _rate_plan_settings(
        self, rate_params: dict[str, Any], *, portal_code: str,
        room_code: int | str, rate_code: int | str, occupancy: int,
        pricing_type: str,
        primary: bool,
    ) -> dict[str, Any]:
        """Die Zuordnungs-Settings EINES Eintrags — gebaut aus den Feldern, die
        der Kanal im Katalog deklariert. Booking/Expedia bekommen so
        room_type_code/rate_plan_code/occupancy/pricing_type/primary_occ,
        Airbnb listing_id/airbnb_rate_plan_id. Felder, deren Bedeutung wir nicht
        kennen, bleiben leer (der Kanal setzt seinen Katalog-Default)."""
        settings: dict[str, Any] = {}
        unbekannt: list[str] = []
        for key, meta in rate_params.items():
            if key in self._RATE_PARAM_NIE_SETZEN:
                # Bewusst weglassen — siehe Kommentar an _RATE_PARAM_NIE_SETZEN.
                continue
            if key in self._RATE_PARAM_ROOM_KEYS:
                settings[key] = room_code
            elif key in self._RATE_PARAM_RATE_KEYS:
                settings[key] = rate_code
            elif key == "occupancy":
                settings[key] = occupancy
            elif key == "primary_occ":
                settings[key] = primary
            elif key == "readonly":
                settings[key] = False
            elif key == "pricing_type":
                options = list(meta.get("options") or [])
                # Nur einen vom Kanal angebotenen Wert senden; sonst dessen
                # eigenen Default (der Katalog-Default ist bei Booking.com
                # nachweislich verschrieben, „Standart" — dann lieber der erste
                # angebotene Wert, statt einen ungültigen zu senden).
                if not options or pricing_type in options:
                    settings[key] = pricing_type
                else:
                    settings[key] = options[0]
            else:
                unbekannt.append(key)
        if unbekannt:
            log.info(
                "channex_rate_param_unbekannt",
                portal_code=portal_code, fields=sorted(unbekannt),
            )
        return settings

    def _build_rate_plans_direct(
        self, db: Client, tenant_id: str, mappings: list[dict[str, Any]],
        portal_code: str | None = None,
    ) -> list[dict[str, Any]]:
        """Zuordnung für Kanäle ohne OTA-Codes (`mapping_mode: direct`, z.B.
        Google): es gehen nur die eigenen Preispläne mit, die Zuordnung macht
        der Kanal selbst. Ein `settings`-Objekt gibt es hier nicht — der Katalog
        deklariert für diese Kanäle keine `rate_params`."""
        rate_plans: list[dict[str, Any]] = []
        gesehen: set[str] = set()
        for m in mappings:
            local_property_id = m.get("local_property_id")
            if not local_property_id:
                continue
            for channex_rate_plan_id in self._selected_rate_plan_ids(
                db, tenant_id, local_property_id, portal_code
            ):
                if channex_rate_plan_id in gesehen:
                    continue
                gesehen.add(channex_rate_plan_id)
                rate_plans.append({"rate_plan_id": channex_rate_plan_id})
        if not rate_plans:
            raise ChannelManagerError(
                "Bitte mindestens ein Zimmer zuordnen.", status_code=422
            )
        return rate_plans

    def _selected_rate_plan_ids(
        self, db: Client, tenant_id: str, local_property_id: str,
        portal_code: str | None = None,
    ) -> list[str]:
        """Die Channex-Rate-Plan-IDs eines Objekts, die an das Portal gehen:
        immer der Grundpreis (der erste) und zusätzlich jeder Preis, den der
        Kunde ausdrücklich freigeschaltet hat (send_to_portals, 0177).

        Preisänderung je Portal (0272): existiert für `portal_code` ein
        Kanal-Plan (`rate_plans.portal_scope`), ERSETZT er den Grundpreis als
        Primary an genau diesem Kanal — Kanal-Pläne anderer Portale gehen hier
        nie mit."""
        local_rate_maps = self._rate_plan_maps_for_property(
            db, tenant_id, local_property_id
        )
        if not local_rate_maps:
            # UMSETZBARE Meldung: Channex verlangt beim Zuordnen ausdrücklich
            # BEIDES („Sie müssen sowohl ein Zimmer als auch einen Tarif
            # auswählen") — ohne Preis gibt es keinen Tarif und die Anzeige
            # bleibt „Not mapped".
            #
            # Bei Airbnb ist das im Normalfall KEIN Fall für Handarbeit: Airbnb
            # liefert den Grundpreis (`GET channels/{id}/mappings/{mappingId}/
            # pricing_settings`, docs/OTA/Airbnb/Pricing Settings.pdf; live
            # gemessen 05.08.2026: `default_daily_price: 500`, DKK), und
            # `_preis_von_airbnb_nachholen` holt ihn vor diesem Punkt. Wer hier
            # ankommt, hat einen Abruf hinter sich, der keinen Preis fand —
            # deshalb nennt die Meldung beide Wege statt nur das Formular.
            raise ChannelManagerError(
                "Für dieses Objekt liegt noch kein Preis vor — das Portal "
                "verlangt beim Zuordnen einen Preis. Rufe das Objekt unter "
                "„Synchronisierung“ erneut bei Airbnb ab, oder setze den "
                "Grundpreis unter „Preise“ selbst.",
                status_code=422,
            )
        # Scope je lokalem Plan auflösen, um Kanal-Pläne richtig einzusortieren.
        scoped = self._portal_scoped_channex_ids(db, tenant_id, local_property_id)
        ids: list[str] = []
        for mid in local_rate_maps:
            cid = self._channex_rate_plan_id_for_map(db, tenant_id, mid)
            if not cid:
                continue
            scope = scoped.get(cid)
            if scope is not None and scope != portal_code:
                continue  # Kanal-Plan eines ANDEREN Portals
            ids.append(cid)
        if not ids:
            raise ChannelManagerError(
                "Preisplan des Zimmers nicht bei den Portalen registriert.",
                status_code=422,
            )
        eigener_kanalplan = next(
            (cid for cid in ids if scoped.get(cid) == portal_code
             and portal_code is not None),
            None,
        )
        portal_ids = self._portal_enabled_rate_plan_ids(
            db, tenant_id, local_property_id
        )
        if eigener_kanalplan:
            # Kanal-Plan ersetzt den Grundpreis als Primary dieses Portals.
            rest = [
                cid for cid in ids
                if cid != eigener_kanalplan and cid in portal_ids
            ]
            return [eigener_kanalplan, *rest]
        return [cid for i, cid in enumerate(ids) if i == 0 or cid in portal_ids]

    def _portal_scoped_channex_ids(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, str]:
        """channex_rate_plan_id → portal_scope für alle Kanal-Pläne des Objekts
        (0272). Leeres Dict, wenn das Objekt keine Kanal-Pläne führt."""
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

    def _portal_enabled_rate_plan_ids(
        self, db: Client, tenant_id: str, property_id: str
    ) -> set[str]:
        """Channex-Rate-Plan-IDs der Preise eines Objekts, die der Kunde
        ausdrücklich an die Portale schickt (rate_plans.send_to_portals=true, 0177).

        Der Grundpreis (Standard-Preis) geht ohnehin immer — dieses Set steuert nur
        die ZUSÄTZLICHEN Preise. Auflösung lokaler Preis → Channex-Rate-Plan-ID über
        die rate_plan_map (wie _rate_plan_maps_for_property). Leeres Set, wenn keiner
        freigeschaltet ist (dann geht nur der Grundpreis)."""
        enabled = (
            db.table("rate_plans")
            .select("id")
            .eq("property_id", property_id)
            .eq("send_to_portals", True)
            .execute()
        ).data or []
        local_ids = [r["id"] for r in enabled if r.get("id")]
        if not local_ids:
            return set()
        # local_rate_plan_id → channex_rate_plan_id direkt über die Map-Tabelle.
        maps = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .in_("local_rate_plan_id", local_ids)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        return {m["channex_rate_plan_id"] for m in maps if m.get("channex_rate_plan_id")}

    def _inject_sandbox_settings(
        self, portal_code: str, property_id: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        """Für den Sandbox-Kanal (OpenChannel) die settings automatisch setzen:
        endpoint = unser Mock-OTA, hotel_code = lokale property_id, api_key =
        geteiltes Secret. Der Tester gibt nichts ein."""
        if portal_code != self._SANDBOX_CODE:
            return settings
        from src.core.config import get_settings

        cfg = get_settings()
        base = (cfg.public_api_url or "").rstrip("/")
        if not base:
            raise ChannelManagerError(
                "PUBLIC_API_URL fehlt — der Sandbox-Mock braucht eine öffentliche "
                "HTTPS-URL, die Channex erreichen kann.",
                status_code=400,
            )
        # WICHTIG: endpoint muss mit '/' enden — Channex hängt test_connection/,
        # mapping_details/, changes/ direkt an.
        endpoint = f"{base}/api/v1/channel-manager/sandbox-ota/"
        return {
            "endpoint": endpoint,
            "hotel_code": property_id,
            "api_key": cfg.channex_webhook_secret.get_secret_value(),
        }

    def run_channel_action(
        self, ctx: AuthContext, *, channel_id: str, action: str
    ) -> dict[str, str | int]:
        """Eine kanal-eigene Aktion auslösen — z.B. „zukünftige Buchungen laden"
        (`load_future_reservations`) bei einem Objekt, das VOR der Verbindung
        schon Buchungen im Portal hatte.

        Scope wie beim Trennen (Wurzel 3/9): die channel_id kommt aus dem Pfad,
        also erst Eigentum am Kanal prüfen. Erlaubt sind NUR Aktionen, die der
        Katalog für diesen Kanal ausweist — keine geratenen Aktionsnamen."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        owns = (
            db.table("channex_channel_connection")
            .select("id, ota_portal_code, channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_channel_id", channel_id)
            .limit(1)
            .execute()
        ).data
        if not owns:
            raise ChannelManagerError("Kanal nicht gefunden.", status_code=404)
        portal_code = owns[0].get("ota_portal_code") or ""
        erlaubt = self._channel_spec(portal_code).get("actions") or []
        if action not in erlaubt:
            raise ChannelManagerError(
                "Diese Aktion bietet das Portal nicht an.", status_code=422
            )
        try:
            self._channex.run_channel_action(channel_id, action)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        # „Zukünftige Buchungen laden" holt die Buchungen bei Channex ab — in
        # UNSERE Datenbank kommen sie erst mit dem Buchungs-Import (Wurzel 1:
        # der zweite Zustand muss mitgepflegt werden, sonst sieht der Kunde die
        # Buchungen im Portal, aber nicht bei uns).
        channex_property_id = owns[0].get("channex_property_id")
        geholt = {"fetched": 0, "saved": 0, "skipped": 0}
        if channex_property_id:
            try:
                geholt = self._nach_aktion_einsammeln(
                    tenant_id, channex_property_id, action
                )
            except (ChannexError, ChannelManagerError) as exc:
                log.warning(
                    "channex_action_import_failed",
                    channel_id=channel_id, action=action,
                    error=getattr(exc, "message", str(exc)),
                )
        log.info(
            "channex_channel_action", channel_id=channel_id, action=action,
            **geholt,
        )
        # Die ECHTE Zahl zurückgeben, nicht nur „ok": die Oberfläche soll sagen
        # können, was angekommen ist (siehe _nach_aktion_einsammeln).
        return {"status": "ok", "action": action, **geholt}

    # Wie lange nach einem Portal-Auftrag auf dessen Ergebnis gewartet wird.
    #
    # `load_future_reservations` ist ein AUFTRAG, keine Antwort: Channex quittiert
    # mit `{"data": null}` (live gemessen) und liefert die Buchungen erst, wenn das
    # Portal sie geschickt hat. Live am 10.08.2026 bei „Feriehus Britt": Auftrag um
    # 18:07:50.498, unser Abruf 18:07:50.731 → 2 Buchungen; die 10 echten trafen
    # 18:07:51.190 ein, also 460 ms NACH dem Abruf. Der Knopf meldete „nichts
    # Neues", während zehn Buchungen unterwegs waren — genau daraus entsteht der
    # Fehlschluss „das Portal hat keine".
    #
    # Deshalb kurz nachfassen statt einmal ins Leere greifen. Die Obergrenze ist
    # bewusst klein: der Aufruf hängt an einem Knopfdruck, und was länger braucht,
    # holt ohnehin der Webhook bzw. der Feed-Tick nach (beides live belegt — die
    # zehn Buchungen standen eine Minute später vollständig in der DB).
    _AKTION_WARTE_RUNDEN = 4
    _AKTION_WARTE_SEKUNDEN = 2.0

    def _nach_aktion_einsammeln(
        self, tenant_id: str, channex_property_id: str, action: str
    ) -> dict[str, int]:
        """Nach einem Portal-Auftrag die Buchungen einsammeln — mit Nachfassen.

        Nur für Aktionen, die beim Portal etwas ANFORDERN. Alles andere wird
        wie bisher genau einmal abgeholt: ein Warteschleifen-Aufruf ohne Anlass
        würde den Knopfdruck grundlos verzögern.

        Abgebrochen wird, sobald etwas ankommt — im Normalfall ist das die
        zweite Runde. Kommt nichts, war beim Portal wirklich nichts; das ist
        dann eine belegte Aussage und keine Vermutung mehr.
        """
        import time  # noqa: PLC0415 — nur hier gebraucht

        geholt = self.import_bookings_for_property(tenant_id, channex_property_id)
        if action != "load_future_reservations" or geholt.get("fetched"):
            return geholt

        for runde in range(1, self._AKTION_WARTE_RUNDEN + 1):
            time.sleep(self._AKTION_WARTE_SEKUNDEN)
            geholt = self.import_bookings_for_property(
                tenant_id, channex_property_id
            )
            log.info(
                "channex_action_nachgefasst",
                channex_property_id=channex_property_id, runde=runde,
                **geholt,
            )
            if geholt.get("fetched"):
                return geholt
        return geholt

    def disconnect_channel(self, ctx: AuthContext, channel_id: str) -> None:
        """Kanal trennen: erst deaktivieren (sonst 422 'is active'), dann löschen."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        # ZUERST Tenant-Eigentum prüfen (IDOR-Schutz): der channel_id kommt aus
        # dem Pfad. Ohne diese Prüfung könnte ein Tenant über eine fremde
        # Channex-Channel-ID den OTA-Kanal eines ANDEREN Betriebs deaktivieren/
        # löschen (die Channex-Calls laufen mit dem geteilten Account-Key).
        # Auch das KONTO belegt das Eigentum (0304): ein frisch verbundener
        # Zugang ohne abgeschlossene Autorisierung hat noch keine Objekte, und
        # ohne diesen zweiten Beleg ließe er sich nicht mehr trennen.
        if not gehoert_kanal_dem_betrieb(db, tenant_id, channel_id):
            raise ChannelManagerError("Kanal nicht gefunden.", status_code=404)
        try:
            self._channex.deactivate_channel(channel_id)
        except ChannexError as exc:
            # Schon inaktiv/nicht aktivierbar → weiter zum Delete.
            log.info("channex_channel_deactivate_skip",
                     channel_id=channel_id, error=exc.message)
        try:
            self._channex.delete_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        # Persistierte Verbindung auf inaktiv setzen (der Channel existiert bei
        # Channex nicht mehr). Wir behalten die Zeile mit der Hotel-ID, damit der
        # Vermieter sie für einen Re-Connect nicht neu eingeben muss.
        db.table("channex_channel_connection").update(
            {"is_active": False, "channex_channel_id": None}
        ).eq("tenant_id", tenant_id).eq("channex_channel_id", channel_id).execute()

        # Und den Gegenzustand am Konto (Wurzel 1): der Kanal ist bei Channex
        # gelöscht, ein Konto, das darauf zeigt, wäre eine Karteileiche, die
        # sich nicht mehr trennen lässt.
        konto_zum_kanal_loesen(db, tenant_id, channel_id)

    def activate_channel(self, ctx: AuthContext, channel_id: str) -> dict[str, Any]:
        """Einen VERBUNDENEN, aber inaktiven Channex-Kanal live schalten.

        Warum es diesen Weg gibt: Channex legt jeden Kanal INAKTIV an
        (`channex_client.py`: „4) /channels/:id/activate → live (startet
        inaktiv)"). Aktiviert wird er im Verbinde-Fluss
        (`oauth_channels.py`) — scheitert der dortige Readiness-Check aber an
        einer behebbaren Lücke (live gemessen: fehlende `timezone`), bricht der
        Fluss mit 422 ab und der Kanal bleibt für immer auf „Disabled".
        Ergänzt der Betrieb die Angabe später, führte KEIN Weg zurück zur
        Aktivierung — genau so stand die Airbnb-Verbindung des Beta-Betriebs
        (Kanal seit 04.08.2026 14:40 `is_active: false`, Token gültig,
        `check_readiness` inzwischen leer).

        Idempotent (Wurzel 2): ist der Kanal schon aktiv, wird NICHT erneut
        aktiviert, sondern der Zustand zurückgemeldet.
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        # Wurzel 3: nur einen Kanal aktivieren, der diesem Betrieb gehört —
        # die Channex-Calls laufen mit dem geteilten Account-Key.
        if not gehoert_kanal_dem_betrieb(db, tenant_id, channel_id):
            raise ChannelManagerError("Kanal nicht gefunden.", status_code=404)

        aktiv, offen = self._channel_live_zustand(channel_id)
        if aktiv:
            return {"channel_active": True, "readiness_offen": None}
        if offen:
            # Der Grund wird GENANNT statt still zu scheitern: Channex lehnt die
            # Aktivierung ohne diese Angaben ab.
            raise ChannelManagerError(
                "Das Portal kann noch nicht aktiviert werden, weil Angaben "
                f"fehlen: {offen}. Ergänze sie am Objekt und versuche es erneut.",
                status_code=422,
            )
        try:
            self._channex.activate_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        # Rücklesen, nicht dem 200 vertrauen (Wurzel 5): nur eine gemessene
        # Änderung ist der Beweis, dass der Kanal wirklich live ist.
        neu_aktiv, neu_offen = self._channel_live_zustand(channel_id)
        log.info(
            "channex_channel_aktiviert",
            tenant_id=tenant_id, channel_id=channel_id, is_active=neu_aktiv,
        )
        return {"channel_active": neu_aktiv, "readiness_offen": neu_offen}

    def set_connection_active(
        self, ctx: AuthContext, *, property_id: str, portal_code: str, is_active: bool
    ) -> dict[str, Any]:
        """Kanal pro (Objekt × Portal) an-/abschalten (selektiver Verkaufsstopp).

        Anders als disconnect_channel bleibt der Channex-Channel bestehen
        (sofortiges Re-Aktivieren). „Aus" = kein ARI/Preis-Push mehr UND der
        Channex-Channel wird hart deaktiviert, damit das OTA wirklich stoppt;
        eingehende Buchungen werden weiterhin importiert."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        # `id` mitlesen: geschrieben wird GENAU DIE Zeile, deren Kanal hier
        # geschaltet wird. Vorher lief der Update über
        # (tenant, property, portal) — bei zwei Konten am selben Objekt (0304)
        # wurde ein Kanal real deaktiviert, aber BEIDE Zeilen zeigten „aus":
        # das zweite Konto verkauft weiter, während die Oberfläche Stopp meldet
        # (fail-open, Wurzel 5).
        row = (
            db.table("channex_channel_connection")
            .select("id, channex_channel_id, ota_hotel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .order("created_at")
            .limit(1)
            .execute()
        ).data
        if not row:
            raise ChannelManagerError("Kanal-Verbindung nicht gefunden.", status_code=404)

        channel_id = row[0].get("channex_channel_id")
        # Ohne Kanal beim Provider gibt es nichts zu aktivieren. Würden wir hier
        # nur unsere Zeile auf `true` drehen, zeigte die Oberfläche
        # „Synchronisiert", während gar kein Kanal existiert — ein fail-open-
        # Geisterzustand (Wurzel 5). Nach dem Trennen bleibt die Zeile bewusst
        # mit der Hotel-ID stehen, damit der Re-Connect sie vorbefüllt.
        if is_active and not channel_id:
            raise ChannelManagerError(
                "Diese Verbindung wurde getrennt. Bitte das Portal neu verbinden.",
                status_code=409,
            )
        if channel_id:
            try:
                if is_active:
                    self._channex.activate_channel(channel_id)
                else:
                    self._channex.deactivate_channel(channel_id)
            except ChannexError as exc:
                raise self._wrap_channex(exc) from exc

        db.table("channex_channel_connection").update(
            {"is_active": is_active}
        ).eq("tenant_id", tenant_id).eq("id", row[0]["id"]).execute()
        log.info(
            "channex_connection_toggled",
            tenant_id=tenant_id, property_id=property_id,
            portal_code=portal_code, is_active=is_active,
        )
        return {
            "portal_code": portal_code,
            "portal": self._portal_label(portal_code),
            "hotel_id": row[0].get("ota_hotel_id"),
            "channel_id": channel_id,
            "is_active": is_active,
            "last_error": None,
        }

    def resync_property_ari(self, tenant_id: str, property_id: str) -> None:
        """Nach Re-Aktivierung eines Kanals frische ARI für das Objekt herstellen.

        Sonst stünde der Kanal wieder auf „an", aber Verfügbarkeit/Preise am OTA
        wären so alt wie beim Abschalten. Nutzt die bestehenden, getesteten Pfade:
        - import_ari_for_property gleicht Verfügbarkeit/Preise mit Channex ab,
        - recompute_property rechnet die dynamischen Preise neu (no-op, wenn DP
          aus) und pusht sie via push_rates_batch.
        Best-effort: ein Fehler darf den Toggle nicht nachträglich kippen — der
        reconcile-Cron gleicht ohnehin periodisch ab."""
        if self._db is None:
            return
        try:
            channex_property_id = self._require_property_mapping(
                self._db, tenant_id, property_id
            )
            self.import_ari_for_property(tenant_id, channex_property_id)
        except (ChannelManagerError, ChannexError) as exc:
            log.warning(
                "reactivation_resync_import_failed",
                property_id=property_id,
                error=getattr(exc, "message", str(exc)),
            )
        try:
            from src.features.pricing.recompute import DynamicPricingRecompute

            DynamicPricingRecompute(
                service_client=self._db
            ).recompute_property(property_id)
        except Exception as exc:  # noqa: BLE001 — Resync ist best-effort, nie blockierend
            log.warning(
                "reactivation_resync_recompute_failed",
                property_id=property_id, error=str(exc),
            )

    # Settings-Schlüssel, unter denen die OTA-Hotel-ID je nach Portal steht.
    _HOTEL_ID_KEYS = ("hotel_id", "hotel_code", "property_id", "property_code")

    @classmethod
    def _extract_hotel_id(cls, settings: dict[str, Any]) -> str | None:
        """Hotel-ID robust aus den Connect-Settings ziehen (Schlüssel je OTA
        verschieden). Kein Fallback/Raten — None, wenn nichts Passendes da ist."""
        for key in cls._HOTEL_ID_KEYS:
            val = settings.get(key)
            if val not in (None, ""):
                return str(val)
        return None

    @staticmethod
    def _mapped_room_for_property(
        property_id: str,
        mappings: list[dict[str, Any]],
        ota_rooms: list[dict[str, Any]],
    ) -> tuple[str | None, str | None]:
        """OTA-Zimmertyp (Code + Klarname), auf den dieses Objekt gemappt ist.
        Aus dem Mapping dieses Objekts (room_type_code) + den OTA-Zimmerdetails
        (Titel per Code). None/None, wenn kein Mapping für das Objekt existiert
        (kein Raten, Wurzel 4)."""
        entry = next(
            (m for m in mappings if m.get("local_property_id") == property_id), None
        )
        if not entry:
            return None, None
        code = entry.get("room_type_code")
        if code is None:
            return None, None
        code_str = str(code)
        title = next(
            (r.get("title") for r in ota_rooms if str(r.get("id")) == code_str), None
        )
        return code_str, title

    def _merge_channel_rate_plans(
        self, channel_id: str, new_rate_plans: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Bestehendes rate_plans-Array eines Kanals per GET lesen und die neuen
        Einträge anhängen (PUT ersetzt das Array, kein Merge → Wurzel 1). Je
        rate_plan_id genau EIN Eintrag (Channex-Regel, sonst 422); bereits
        vorhandene werden nicht dupliziert (Wurzel 2, idempotent)."""
        try:
            current = self._channex.get_channel(channel_id)
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        attrs = (current.get("data") or {}).get("attributes") or {}
        existing_plans = attrs.get("rate_plans") or []
        merged: list[dict[str, Any]] = [
            {"rate_plan_id": p.get("rate_plan_id"), "settings": p.get("settings") or {}}
            for p in existing_plans
            if p.get("rate_plan_id")
        ]
        seen = {p["rate_plan_id"] for p in merged}
        for plan in new_rate_plans:
            if plan.get("rate_plan_id") in seen:
                continue
            merged.append(plan)
            seen.add(plan.get("rate_plan_id"))
        return merged

    def _existing_channel_for_hotel(
        self, db: Client, tenant_id: str, portal_code: str, hotel_id: str | None,
        channex_property_id: str | None = None,
    ) -> str | None:
        """Channex-Channel-ID eines bereits bestehenden Kanals DERSELBEN Hotel-ID.
        None, wenn keiner existiert.

        Ein Hotel = eine Hotel-ID = ein Channex-Kanal; weitere Zimmer hängen sich
        additiv daran. Es wird in ZWEI Quellen gesucht, weil die eine allein den
        Kanal verfehlen kann (genau der 422-„already exists"-Bug):
        1) lokale DB (channex_channel_connection) mit Existenz-Gegenprüfung bei
           Channex (tote Referenz → überspringen);
        2) Channex selbst — ALLE Kanäle des Tenants (Property gefiltert) mit
           passender settings.hotel_id. Nötig, weil ein Kanal bei Channex
           existieren kann, ohne dass die lokale DB ihn (noch) kennt (Zeile
           gelöscht, andere Session, Reconcile-Lücke). Ohne diese zweite Quelle
           läuft der Connect in POST /channels → 422, obwohl der Kanal da ist."""
        if not hotel_id:
            return None
        # DEBUG: ALLE Kanäle, die dieser Channex-Key überhaupt sieht (konto-weit,
        # ohne Property-Filter) — mit ihrer hotel_id. Zeigt schwarz auf weiß, ob
        # 6519420 irgendwo im Konto hängt oder ob das Konto wirklich leer ist.
        try:
            all_ch = self._channex.list_channels().get("data") or []
            log.info(
                "existing_channel_debug_ALL_channels_in_account",
                count=len(all_ch),
                channels=[
                    {"id": c.get("id"),
                     "channel": (c.get("attributes") or c).get("channel"),
                     "hotel_id": ((c.get("attributes") or c).get("settings")
                                  or {}).get("hotel_id"),
                     "properties": (c.get("attributes") or c).get("properties")}
                    for c in all_ch
                ],
            )
        except ChannexError as exc:
            log.warning("existing_channel_debug_all_failed", error=exc.message)
        # 1) Lokale DB.
        rows = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, ota_hotel_id")
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", portal_code)
            .eq("ota_hotel_id", hotel_id)
            .execute()
        ).data or []
        log.info("existing_channel_debug_db_rows", hotel_id=hotel_id, rows=rows)
        for row in rows:
            channel_id = row.get("channex_channel_id")
            if not channel_id:
                continue
            try:
                self._channex.get_channel(channel_id)
            except ChannexError:
                continue  # Kanal existiert bei Channex nicht mehr — überspringen
            return channel_id

        # 2) Channex-seitig: die Kanäle dieser Property durchsuchen (der geteilte
        #    Account-Key sieht nur Kanäle dieses Tenants, wenn auf die eigene
        #    channex_property_id gefiltert wird → kein fremder Kanal). Passt die
        #    settings.hotel_id, diesen Kanal wiederverwenden statt neu anzulegen.
        if not channex_property_id:
            return None
        try:
            listed = self._channex.list_channels(
                property_id=channex_property_id
            ).get("data") or []
        except ChannexError as exc:
            log.warning("existing_channel_debug_list_failed", error=exc.message)
            return None
        log.info("existing_channel_debug_channex_list",
                 channex_property_id=channex_property_id, count=len(listed),
                 channels=[
                     {"id": c.get("id"),
                      "channel": (c.get("attributes") or c).get("channel"),
                      "hotel_id": ((c.get("attributes") or c).get("settings")
                                   or {}).get("hotel_id")}
                     for c in listed
                 ])
        for ch in listed:
            a = ch.get("attributes") or ch
            if a.get("channel") != portal_code:
                continue
            ch_settings = a.get("settings") or {}
            if str(ch_settings.get("hotel_id") or "") == str(hotel_id):
                return ch.get("id") or a.get("id")
        return None

    def _attach_room_to_channel(
        self, db: Client, tenant_id: str, *, property_id: str,
        channex_property_id: str, portal_code: str, settings: dict[str, Any],
        channel_id: str, new_rate_plans: list[dict[str, Any]],
        mappings: list[dict[str, Any]], ota_rooms: list[dict[str, Any]],
        title: str | None,
    ) -> dict[str, Any]:
        """Ein weiteres Zimmer additiv in einen bestehenden Channex-Kanal aufnehmen
        (statt einen zweiten Kanal für dieselbe Hotel-ID anzulegen).

        PUT /channels/:id ersetzt das rate_plans-Array (verifiziert, kein Merge) →
        die bestehenden Einträge werden per GET gelesen und die neuen ANGEHÄNGT.
        Idempotent (Wurzel 2): bereits vorhandene rate_plan_ids werden nicht
        dupliziert — ein erneuter Connect desselben Zimmers ändert das Array nicht."""
        merged = self._merge_channel_rate_plans(channel_id, new_rate_plans)
        try:
            self._channex.update_channel(channel_id, {"rate_plans": merged})
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        # Der Kanal war (bei einem verbundenen ersten Zimmer) bereits aktiv; sicher
        # gehen, dass er nach dem PUT aktiv bleibt. Best effort — ein Aktivierungs-
        # fehler kippt das erfolgreiche Anhängen nicht.
        is_active = True
        try:
            self._channex.activate_channel(channel_id)
        except ChannexError as exc:
            log.warning("channex_channel_activate_failed",
                        channel_id=channel_id, error=exc.message)

        room_code, room_title = self._mapped_room_for_property(
            property_id, mappings, ota_rooms
        )
        self._save_channel_connection(
            db, tenant_id,
            property_id=property_id,
            channex_property_id=channex_property_id,
            portal_code=portal_code,
            settings=settings,
            channel_id=channel_id,
            is_active=is_active,
            last_error=None,
            ota_room_type_code=room_code,
            ota_room_title=room_title,
        )

        # Go-Live-Push für das neu angehängte Zimmer (Verfügbarkeit + Preise), wie
        # beim regulären Connect — der neue Room-Type darf nie mit leerem ARI starten.
        try:
            from src.jobs.queue import dedup_key, enqueue

            enqueue(
                db, "full_sync_property", tenant_id=tenant_id,
                payload={"tenant_id": tenant_id, "property_id": property_id},
                dedup_key=dedup_key(tenant_id, property_id, "full_sync_property"),
            )
        except Exception as exc:  # noqa: BLE001 — Connect nie am Enqueue kippen
            log.warning(
                "channel_golive_full_sync_enqueue_failed",
                property_id=property_id, error=str(exc)[:200],
            )

        return {
            "id": channel_id,
            "portal": self._portal_label(portal_code),
            "title": title or self._portal_label(portal_code),
            "is_active": is_active,
        }

    def _save_channel_connection(
        self, db: Client, tenant_id: str, *, property_id: str,
        channex_property_id: str, portal_code: str, settings: dict[str, Any],
        channel_id: str | None, is_active: bool, last_error: str | None,
        ota_room_type_code: str | None = None, ota_room_title: str | None = None,
    ) -> None:
        """Upsert der OTA-Verbindung pro (Objekt, Portal). Best-effort: ein
        Persistenz-Fehler darf den erfolgreichen Connect nicht scheitern lassen."""
        hotel_id = self._extract_hotel_id(settings)
        if not hotel_id:
            # Ohne Hotel-ID gibt es nichts Sinnvolles zu speichern (kein Raten).
            log.warning(
                "channex_connection_no_hotel_id",
                property_id=property_id, portal_code=portal_code,
            )
            return
        row = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "channex_property_id": channex_property_id,
            "ota_portal_code": portal_code,
            "ota_hotel_id": hotel_id,
            "ota_room_type_code": ota_room_type_code,
            "ota_room_title": ota_room_title,
            "channex_channel_id": channel_id,
            # Kontozuordnung (0304): ohne sie überschriebe ein zweites Konto
            # die Verbindung des ersten, statt danebenzustehen.
            "ota_account_id": konto_sicherstellen(
                db, tenant_id, portal_code=portal_code,
                channel_id=channel_id, host_id=hotel_id,
            ),
            "is_active": is_active,
            "last_error": last_error,
        }
        try:
            db.table("channex_channel_connection").upsert(
                row, on_conflict="property_id,ota_portal_code,ota_account_id"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Persistenz darf Connect nicht killen
            log.warning(
                "channex_connection_persist_failed",
                property_id=property_id, portal_code=portal_code, error=str(exc),
            )

    def channel_overview(self, ctx: AuthContext) -> dict[str, Any]:
        """Kanal-zentrierte Übersicht für die Channel-Manager-Seite (Karten je
        Kanal mit Status + Objektzahl). Aggregiert AUS DER DB (tenant-lokal, kein
        Channex-Call → günstig und realtime-fähig):

        - OTA-Portale (Katalog): je Portal, an wie vielen Objekten es verbunden
          und aktiv ist. `connected` = mind. eine aktive Verbindung.
        - Eigener Marktplatz (/plattform): Zahl der aktiv gelisteten Objekte
          (status='active' AND listed_on_marketplace).
        - iCal: Zahl der Objekte mit mindestens einem aktiven externen Kalender.

        Keine erfundenen Zahlen — fehlt eine Quelle, ist der Count 0."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        # OTA-Verbindungen je Portal zählen (aktive Objekte je ota_portal_code).
        conns = (
            db.table("channex_channel_connection")
            .select("property_id, ota_portal_code, is_active")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        active_props_by_portal: dict[str, set[str]] = {}
        # ZWEITE Achse, bewusst getrennt von `is_active`: „Konto verbunden" ist
        # NICHT dasselbe wie „Abgleich läuft". `is_active` wird erst true, wenn der
        # Kanal bei Channex aktiviert ist, und das setzt eine fertige Zuordnung
        # voraus. Ein Airbnb-Konto kann also autorisiert sein (Token gültig, 18
        # Objekte am Kanal) und `is_active` trotzdem überall false — dann zeigte die
        # Kanal-Karte „Verbinden", der Onboarding-Schritt „Aktion nötig" und die
        # Objekt-Seite „Pausiert". Live passiert: der Betrieb verband Airbnb
        # wieder und wieder, weil die Oberfläche die bestehende Verbindung nicht
        # zugab. Mit `linked_count` sagt sie jetzt die Wahrheit: verbunden, aber
        # Zuordnung noch offen.
        linked_props_by_portal: dict[str, set[str]] = {}
        for r in conns:
            portal = r.get("ota_portal_code") or ""
            linked_props_by_portal.setdefault(portal, set()).add(r.get("property_id"))
            if not r.get("is_active"):
                continue
            active_props_by_portal.setdefault(portal, set()).add(r.get("property_id"))

        # Vom Tenant in die Sidebar geholte Kanäle (Dropdown „Kanal hinzufügen").
        pinned_codes = self._pinned_codes(db, tenant_id)

        ota_channels = [
            {
                "kind": "ota",
                "code": p["code"],
                "label": p["label"],
                "icon": p["icon"],
                "connection_type": (
                    "oauth" if p["code"] in self._OAUTH_PORTALS else "credential"
                ),
                "connected_count": len(active_props_by_portal.get(p["code"], set())),
                # Objekte, für die eine Verbindung zu diesem Portal BESTEHT —
                # unabhängig davon, ob der Abgleich schon läuft (siehe oben).
                "linked_count": len(linked_props_by_portal.get(p["code"], set())),
                "pinned": p["code"] in pinned_codes,
            }
            for p in self._portal_catalog()
        ]

        # Eigener Marktplatz: aktiv gelistete Objekte (0159).
        marketplace_count = len(
            (
                db.table("properties")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("status", "active")
                .eq("listed_on_marketplace", True)
                .execute()
            ).data or []
        )

        # iCal: Objekte mit mind. einem aktiven externen Kalender.
        ical_props = {
            r.get("property_id")
            for r in (
                db.table("external_calendar")
                .select("property_id, is_active")
                .eq("tenant_id", tenant_id)
                .eq("is_active", True)
                .execute()
            ).data or []
        }

        return {
            "ota": ota_channels,
            "marketplace": {
                "kind": "marketplace",
                "code": "mybestdays",
                "label": "myBestDays Marktplatz",
                "listed_count": marketplace_count,
            },
            "ical": {
                "kind": "ical",
                "code": "iCal",
                "label": "Kalender-Sync (iCal)",
                "synced_count": len(ical_props),
            },
        }

    def _pinned_codes(self, db: Client, tenant_id: str) -> set[str]:
        """Kanal-Codes, die der Tenant in die Sidebar geholt hat (tenant-scoped)."""
        rows = (
            db.table("tenant_pinned_channel")
            .select("portal_code")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {r["portal_code"] for r in rows if r.get("portal_code")}

    def list_pinned_channels(self, ctx: AuthContext) -> list[str]:
        """Die vom Tenant gepinnten Kanal-Codes (Sidebar-Zusatzzeilen)."""
        tenant_id = self._require_tenant(ctx)
        return sorted(self._pinned_codes(self._require_db(), tenant_id))

    def pin_channel(self, ctx: AuthContext, portal_code: str) -> None:
        """Kanal in die Sidebar holen. Idempotent (unique tenant+code): ein
        erneutes Pinnen ist ein No-op. Nur real verbindbare Kanäle (Katalog)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if not self._is_known_portal(portal_code):
            raise ChannelManagerError("Unbekanntes Portal.", status_code=400)
        db.table("tenant_pinned_channel").upsert(
            {"tenant_id": tenant_id, "portal_code": portal_code},
            on_conflict="tenant_id,portal_code",
        ).execute()

    def unpin_channel(self, ctx: AuthContext, portal_code: str) -> None:
        """Kanal aus der Sidebar entfernen (tenant-scoped)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        db.table("tenant_pinned_channel").delete().eq(
            "tenant_id", tenant_id
        ).eq("portal_code", portal_code).execute()

    def portal_konten(self, ctx: AuthContext, portal_code: str) -> dict[str, Any]:
        """Die verbundenen Konten eines Portals samt Objektzahl (0304)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        konten = konten_des_betriebs(db, tenant_id, portal_code)
        zaehler = objekte_je_konto_zaehlen(db, tenant_id)
        items = [
            {
                "id": str(k["id"]),
                "portal_code": k["ota_portal_code"],
                "portal": self._portal_label(k["ota_portal_code"]),
                "hotel_id": k.get("ota_hotel_id"),
                "channel_id": k.get("channex_channel_id"),
                "display_name": k.get("display_name"),
                "is_active": bool(k.get("is_active", True)),
                "token_invalid": bool(k.get("token_invalid")),
                "last_error": k.get("last_error"),
                "connected_at": k.get("connected_at"),
                "properties": zaehler.get(str(k["id"]), 0),
            }
            for k in konten
        ]
        return {"items": items, "total": len(items)}

    def konto_umbenennen(
        self, ctx: AuthContext, account_id: str, display_name: str | None
    ) -> dict[str, Any]:
        """Anzeigename eines Portal-Kontos setzen."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        try:
            zeile = konto_umbenennen(db, tenant_id, account_id, display_name)
        except KontoNichtGefunden as exc:
            raise ChannelManagerError(
                "Konto nicht gefunden.", status_code=404
            ) from exc
        zaehler = objekte_je_konto_zaehlen(db, tenant_id)
        return {
            "id": str(zeile["id"]),
            "portal_code": zeile["ota_portal_code"],
            "portal": self._portal_label(zeile["ota_portal_code"]),
            "hotel_id": zeile.get("ota_hotel_id"),
            "channel_id": zeile.get("channex_channel_id"),
            "display_name": zeile.get("display_name"),
            "is_active": bool(zeile.get("is_active", True)),
            "token_invalid": bool(zeile.get("token_invalid")),
            "last_error": zeile.get("last_error"),
            "connected_at": zeile.get("connected_at"),
            "properties": zaehler.get(str(zeile["id"]), 0),
        }

    def channel_detail(self, ctx: AuthContext, portal_code: str) -> dict[str, Any]:
        """Detailfläche EINES Kanals: eine Zuordnungszeile JE OBJEKT des Tenants
        (Objekt-Titel ↔ OTA-Hotel-ID ↔ Sync-Status) — die Mapping-Tabelle der
        Kanal-Detailseite (SiteMinder/Hostaway-Muster, belegt: alle Objekte, nicht
        nur verbundene; nicht verbundene bekommen im UI einen „Verbinden"-Button).

        Aggregiert tenant-lokal aus der DB:
        - properties (aktiv): die Basis-Zeilen (jedes Objekt = eine buchbare Einheit).
        - channex_channel_connection (dieses Portal): OTA-Hotel-ID + is_active.
        - channex_property_map: Sync-Status (nur nicht-gelöschte).

        Kein erfundener Zustand (Wurzel 4): ohne Verbindung ist ein Objekt
        „nicht verbunden" (ota_hotel_id=None, is_active=False). Scope streng auf
        tenant_id (Wurzel 3)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        # Basis: alle NICHT archivierten Objekte des Tenants (jede Zeile = ein
        # Objekt). Bewusst NICHT auf `status='active'` gefiltert: die Zuordnung
        # kommt VOR dem Aktivieren. Ein aus Airbnb übernommenes Objekt ist `draft`
        # (richtig — ohne Preis darf es nicht verkaufen), und mit dem alten Filter
        # sagte diese Seite „Du hast noch keine aktiven Objekte. Lege zuerst ein
        # Objekt an", während 18 übernommene Objekte in der DB standen. Damit war
        # die Zuordnung genau dort unmöglich, wo sie hingehört — und der Betrieb
        # verband Airbnb immer wieder neu, statt zuordnen zu können.
        # `inactive` bleibt draußen: ein stillgelegtes Objekt gehört an kein Portal.
        # Der Enum `property_status` kennt genau drei Werte (`draft, active,
        # inactive`) — ein Filter auf einen erfundenen Wert antwortet 400 und
        # kippte die ganze Seite auf 422.
        # `building_id` mit in die Zeile: es entscheidet, ob ein Objekt seine
        # Portal-Kennung mit einem anderen TEILT (Gebäude, 0264) oder eine eigene
        # hat. Die Oberfläche braucht das, um beim Verbinden nicht die Hotel-ID
        # eines FREMDEN Objekts vorzugeben — siehe `shares_building` unten.
        props = (
            db.table("properties")
            .select("id, title, status, building_id")
            .eq("tenant_id", tenant_id)
            .in_("status", ["draft", "active"])
            .order("title")
            .execute()
        ).data or []
        property_ids = [p["id"] for p in props]

        # Titelbild je Objekt: die Zuordnungsliste zeigt das Objekt so, wie es
        # der Betrieb kennt (Lodgify-Muster) — ein Name allein lässt bei 15
        # gleichnamigen Ferienhäusern raten. Kein Ersatzbild: fehlt eines,
        # bleibt die Zelle leer.
        cover_by_property: dict[str, str] = {}
        if property_ids:
            for ph in (
                db.table("property_photos")
                .select("property_id, url, is_cover, sort_order")
                .in_("property_id", property_ids)
                .order("is_cover", desc=True)
                .order("sort_order")
                .execute()
            ).data or []:
                cover_by_property.setdefault(ph["property_id"], ph["url"])

        # Verbindung dieses Portals je Objekt (falls vorhanden).
        conn_by_property: dict[str, dict[str, Any]] = {}
        for c in (
            db.table("channex_channel_connection")
            .select(
                "property_id, ota_hotel_id, ota_room_type_code, ota_room_title, "
                "channex_channel_id, is_active, last_error, updated_at"
            )
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", portal_code)
            .execute()
        ).data or []:
            if c.get("property_id"):
                conn_by_property[c["property_id"]] = c

        # Welche Objekte sind bei CHANNEX wirklich zugeordnet? (siehe
        # _objekte_mit_channex_ziel — unsere Verbindungszeile beweist es nicht).
        # `None` = konnten wir nicht abrufen; dann bleibt es bei der bisherigen
        # Aussage statt „nicht verbunden" zu behaupten.
        mit_ziel = self._objekte_mit_channex_ziel(
            db,
            tenant_id,
            property_ids,
            {
                str(c["channex_channel_id"])
                for c in conn_by_property.values()
                if c.get("channex_channel_id")
            },
            portal_code=portal_code,
        )

        # Sync-Status je Objekt aus der Property-Map (nur nicht-gelöschte).
        sync_by_property: dict[str, dict[str, Any]] = {}
        if property_ids:
            for m in (
                db.table("channex_property_map")
                .select("property_id, sync_enabled, last_sync_status, last_sync_error")
                .eq("tenant_id", tenant_id)
                .in_("property_id", property_ids)
                .is_("deleted_at", "null")
                .execute()
            ).data or []:
                sync_by_property[m["property_id"]] = m

        # Welche Gebäude haben schon eine verbundene Hotel-ID? Nur INNERHALB
        # eines Gebäudes darf die Oberfläche eine bestehende Kennung für ein
        # weiteres Objekt vorschlagen (ein Hotel: mehrere Zimmertypen, EINE
        # Hotel-ID). Objekte ohne Gebäude teilen NICHTS.
        #
        # WARUM DAS HIER STEHT: Die Oberfläche leitete die vorzuschlagende
        # Hotel-ID aus der ERSTEN verbundenen Zeile der Liste ab — ohne jeden
        # Bezug zum Gebäude. Beim Beta-Betrieb (live geprüft 10.08.2026: 19
        # Objekte, ALLE ohne `building_id`, jedes ein eigenes Ferienhaus mit
        # eigener Booking.com-Hotel-ID) hieß das: sobald EIN Objekt verbunden
        # war, übernahm der Assistent für jedes weitere dessen Hotel-ID,
        # übersprang die Eingabe und zeigte die Zimmer des falschen Hauses. Die
        # verbleibenden 16 Objekte ließen sich gar nicht mehr verbinden — es gab
        # keine Fläche, ihre eigene Kennung einzutragen.
        gebaeude_mit_kennung = {
            str(p["building_id"])
            for p in props
            if p.get("building_id")
            and conn_by_property.get(p["id"], {}).get("ota_hotel_id")
        }

        mappings: list[dict[str, Any]] = []
        for p in props:
            pid = p["id"]
            c = conn_by_property.get(pid, {})
            m = sync_by_property.get(pid, {})
            # EINE Wahrheit für alle vier Statusfelder dieser Zeile: gibt es bei
            # Channex ein Ziel? Nur dann kann etwas gesendet oder synchronisiert
            # sein. Ohne Kanal-ID gibt es dort gar kein Gegenstück (live
            # gemessen: 22 Zeilen `is_active = true`, davon 20 ohne Kanal-ID);
            # mit Kanal-ID, aber ohne Zuordnung, steht das Listing bei Channex
            # auf „Not mapped" (`013 Rævlingevej`). `mit_ziel is None` heißt
            # „Channex nicht erreichbar" — dann NICHT behaupten, es sei nichts
            # zugeordnet (Wurzel 4/5).
            hat_ziel = bool(c.get("channex_channel_id")) and (
                mit_ziel is None or pid in mit_ziel
            )
            mappings.append(
                {
                    "property_id": pid,
                    "property_title": p.get("title"),
                    "property_photo": cover_by_property.get(pid),
                    # Teilt dieses Objekt seine Portal-Kennung mit einem schon
                    # verbundenen? Nur dann darf die Oberfläche dessen Hotel-ID
                    # übernehmen; sonst hat das Objekt eine EIGENE (siehe
                    # gebaeude_mit_kennung).
                    "shares_building": bool(
                        p.get("building_id")
                        and str(p["building_id"]) in gebaeude_mit_kennung
                    ),
                    "ota_hotel_id": c.get("ota_hotel_id"),
                    "ota_room_type_code": c.get("ota_room_type_code"),
                    "ota_room_title": c.get("ota_room_title"),
                    "is_active": bool(c.get("is_active")) and hat_ziel,
                    "connected": hat_ziel,
                    # Auch der Sync-Stand hängt an der Zuordnung bei Channex:
                    # ohne Zuordnung gibt es dort kein Ziel, also kann NICHTS
                    # synchronisiert sein. `channex_property_map.sync_enabled`
                    # allein sagte „Synchronisiert" für `013 Rævlingevej`,
                    # während Channex dasselbe Listing als „Not mapped" führt
                    # (live gemessen 04.08.2026). Ein grünes „Synchronisiert"
                    # auf einer Zeile, die nichts sendet, ist die schlimmste
                    # Variante: der Betrieb prüft dort nicht mehr nach.
                    "sync_enabled": bool(m.get("sync_enabled")) and hat_ziel,
                    "last_sync_status": m.get("last_sync_status") if hat_ziel else None,
                    "last_sync_error": (
                        m.get("last_sync_error") or c.get("last_error")
                    ),
                    "updated_at": c.get("updated_at"),
                }
            )

        # ALLE Kanäle dieses Portals — je eigener Portal-Kennung einer.
        #
        # Bei einem Hotel teilen sich die Zimmertypen EINEN Kanal (eine
        # Hotel-ID); bei einzelnen Ferienhäusern hat JEDES seinen eigenen. Wer
        # eine portalweite Aktion auf „irgendeinem" Kanal auslöst, trifft dann
        # genau ein Haus. Deshalb die vollständige Liste, stabil sortiert.
        channel_ids = sorted(
            {
                str(c["channex_channel_id"])
                for c in conn_by_property.values()
                if c.get("channex_channel_id")
            }
        )
        # `channel_id` bleibt der erste — „Verbindung trennen" auf Portal-Ebene
        # und der Readiness-Blick brauchen genau einen Vertreter.
        channel_id = channel_ids[0] if channel_ids else None
        # Läuft der Kanal bei Channex überhaupt? Verbunden ≠ aktiv (siehe
        # ChannelDetailResponse.channel_active). Best effort: fällt der Abruf
        # aus, bleibt das Feld None und die UI zeigt keinen Zustand statt einen
        # falschen (Wurzel 4/5 — kein erfundener Ersatzwert).
        channel_active: bool | None = None
        readiness_offen: str | None = None
        if channel_id:
            channel_active, readiness_offen = self._channel_live_zustand(
                str(channel_id)
            )
        return {
            "portal_code": portal_code,
            "portal": self._portal_label(portal_code),
            "connected": any(m["is_active"] for m in mappings),
            "connected_count": sum(1 for m in mappings if m["is_active"]),
            "total_count": len(mappings),
            "channel_id": channel_id,
            "channel_ids": channel_ids,
            "actions": self._channel_spec(portal_code).get("actions") or [],
            "channel_active": channel_active,
            "readiness_offen": readiness_offen,
            "mappings": mappings,
        }

    def _objekte_mit_channex_ziel(
        self,
        db: Client,
        tenant_id: str,
        property_ids: list[str],
        channel_ids: set[str],
        *,
        portal_code: str = "AirBNB",
    ) -> set[str] | None:
        """Objekte, die bei CHANNEX wirklich zugeordnet sind.

        Gefragt wird Channex, nicht unsere eigene Tabelle: `013 Rævlingevej` und
        `020 Lille Lægehus` sind in `channex_channel_connection` Feld für Feld
        identisch (Kanal-ID gesetzt, `sync_enabled = true`), aber bei Channex ist
        nur 020 zugeordnet — 013 steht dort auf „Not mapped" (live gemessen
        04.08.2026, Channex meldet „Count: 1"). Wer unsere Zeile als Beweis
        nimmt, zählt Zuordnungen, die es nicht gibt.

        Der Ist-Stand steht ausschließlich im Kanal-Objekt unter `rate_plans[]`;
        einen GET-Pfad für Mappings gibt es nicht (alle 404, gemessen). Jeder
        Eintrag trägt `settings.listing_id` — das ist die Verbindung zu unserem
        Objekt über `properties.airbnb_listing_id`.

        Rückgabe `None` = unbekannt (Abruf fehlgeschlagen). Dann darf der
        Aufrufer NICHT „nicht verbunden" behaupten (Wurzel 4/5).
        """
        if not property_ids or not channel_ids:
            return set()
        # WORÜBER wird zugeordnet? Das hängt am Portal:
        #   Airbnb      → `settings.listing_id`, unsere `airbnb_listing_id`
        #   alle übrigen → `settings.room_type_code`, unser `ota_room_type_code`
        #
        # Vorher galt für ALLE der Airbnb-Weg. Bei Booking.com gibt es kein
        # `listing_id`, also blieb die Menge leer und JEDES Objekt stand auf
        # „nicht verbunden" — obwohl der Kanal aktiv war und beide Raten
        # sauber gemappt (live am 07.08.2026, Hotel 12645792, Zimmertyp
        # 1264579201 „Two-Bedroom Apartment" mit Standard Rate und Wochenrate).
        # Die Folge war schlimmer als eine falsche Anzeige: `sync_enabled` hängt
        # an derselben Größe, es lief also gar kein Abgleich.
        ist_airbnb = portal_code == "AirBNB"
        feld = "listing_id" if ist_airbnb else "room_type_code"
        gemappte: set[str] = set()
        for channel_id in channel_ids:
            try:
                kanal = self._channex.get_channel(channel_id)
            except ChannexError as exc:  # noqa: BLE001 — Anzeige, nicht Hauptpfad
                log.warning(
                    "channex_mappings_unbekannt",
                    channel_id=channel_id, error=exc.message,
                )
                return None
            attrs = ((kanal.get("data") or {}).get("attributes")) or {}
            for eintrag in attrs.get("rate_plans") or []:
                wert = ((eintrag or {}).get("settings") or {}).get(feld)
                if wert:
                    gemappte.add(str(wert))
        if not gemappte:
            return set()
        if ist_airbnb:
            rows = (
                db.table("properties")
                .select("id, airbnb_listing_id")
                .eq("tenant_id", tenant_id)
                .in_("id", property_ids)
                .execute()
            ).data or []
            return {
                str(r["id"])
                for r in rows
                if r.get("airbnb_listing_id")
                and str(r["airbnb_listing_id"]) in gemappte
            }
        # Nicht-Airbnb: die Zimmer-Kennung steht in der Verbindungszeile, nicht
        # am Objekt — ein Objekt kann bei zwei Portalen unter verschiedenen
        # Kennungen laufen.
        zeilen = (
            db.table("channex_channel_connection")
            .select("property_id, ota_room_type_code")
            .eq("tenant_id", tenant_id)
            .eq("ota_portal_code", portal_code)
            .in_("property_id", property_ids)
            .execute()
        ).data or []
        return {
            str(z["property_id"])
            for z in zeilen
            if z.get("ota_room_type_code")
            and str(z["ota_room_type_code"]) in gemappte
        }

    def _channel_live_zustand(
        self, channel_id: str
    ) -> tuple[bool | None, str | None]:
        """`is_active` des Channex-Kanals + was der Aktivierung noch fehlt.

        Zwei Aufrufe, beide nur lesend. Scheitert einer, ist die Antwort None
        (= „unbekannt") und NICHT False — sonst behauptet die Oberfläche
        „inaktiv", wo sie es nur nicht wissen konnte.
        """
        aktiv: bool | None = None
        try:
            kanal = self._channex.get_channel(channel_id)
            attrs = ((kanal.get("data") or {}).get("attributes")) or {}
            if "is_active" in attrs:
                aktiv = bool(attrs["is_active"])
        except ChannexError as exc:  # noqa: BLE001 — nur Anzeige, nicht der Hauptpfad
            log.warning(
                "channex_kanal_zustand_unbekannt",
                channel_id=channel_id, error=exc.message,
            )
            return None, None
        if aktiv:
            return True, None
        return aktiv, self._readiness_offen(channel_id)

    def list_channel_connections(
        self, ctx: AuthContext, property_id: str
    ) -> list[dict[str, Any]]:
        """Gespeicherte OTA-Verbindungen eines Objekts (white-label).

        Liefert nur Portal-Label, Hotel-ID und Status — keine rohen Credentials,
        kein Provider-Branding."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        res = (
            db.table("channex_channel_connection")
            .select(
                "ota_portal_code, ota_hotel_id, ota_room_type_code, "
                "ota_room_title, channex_channel_id, is_active, last_error, "
                "updated_at"
            )
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        )
        # Sync-Stand des Objekts (gilt für alle Portale dieses Objekts): er
        # gehört in dieselbe Zeile wie die Verbindung, sonst muss man ihn sich
        # auf einer anderen Seite zusammensuchen.
        pm = (
            db.table("channex_property_map")
            .select("sync_enabled, last_sync_status, last_sync_error")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data or []
        sync = pm[0] if pm else {}
        out: list[dict[str, Any]] = []
        for r in res.data or []:
            code = r.get("ota_portal_code")
            out.append(
                {
                    "portal_code": code,
                    "portal": self._portal_label(code),
                    "hotel_id": r.get("ota_hotel_id"),
                    "channel_id": r.get("channex_channel_id"),
                    # Zimmer/Einheit beim Portal — die Angabe, mit der man im
                    # Extranet nachsieht (Hotel-ID gilt für alle Zimmer).
                    "ota_room_type_code": r.get("ota_room_type_code"),
                    "ota_room_title": r.get("ota_room_title"),
                    "is_active": bool(r.get("is_active")),
                    "sync_enabled": bool(sync.get("sync_enabled")),
                    "last_sync_status": sync.get("last_sync_status"),
                    "last_sync_error": sync.get("last_sync_error"),
                    "last_error": r.get("last_error"),
                    "updated_at": r.get("updated_at"),
                }
            )
        return out

    @staticmethod
    def _kanal_dieses_objekts(
        db: Client, tenant_id: str, property_id: str, portal_code: str
    ) -> str | None:
        """Der Channex-Kanal, über den DIESES Objekt verkauft wird.

        Bei einer Agentur mit mehreren Zugängen je Portal (0304) ist das die
        Frage, an der alles hängt: welches der Konten gehört zu diesem Objekt?
        Die Antwort steht in seiner Verbindungszeile — nicht in „dem" Kanal des
        Betriebs, denn den gibt es dann nicht mehr.

        Bevorzugt wird die Zeile mit KONTO. Eine Zeile ohne Konto ist ein
        angefangener oder abgebrochener Verbindungsversuch; nähme man sie,
        liefe der Abruf mit dem Token des falschen Zugangs und lieferte die
        Anzeigen eines fremden Vermieters. Live am 07.08.2026: der
        Verbinden-Dialog zeigte für Torstens Objekt „Host-ID 529591717" und
        siebzehn Anzeigen von AirSmil.

        Der Scope bleibt der Mandant (Wurzel 3): eine Agentur sieht ALLE ihre
        Konten, aber niemals die einer anderen.
        """
        zeilen = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, ota_account_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .not_.is_("channex_channel_id", "null")
            .execute()
        ).data or []
        if not zeilen:
            return None
        mit_konto = next(
            (z for z in zeilen if z.get("ota_account_id")), None
        )
        gewaehlt = mit_konto or zeilen[0]
        return str(gewaehlt["channex_channel_id"])

    def _oauth_channel_settings(
        self, db: Client, tenant_id: str, property_id: str, portal_code: str,
        *, account_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Settings des OAuth-Kanals bei Channex lesen (dort liegen die Tokens).

        Nötig für `test_connection`/`mapping_details` bei Airbnb: diese Aufrufe
        identifizieren das Portal-Konto über `settings`, und bei OAuth steckt die
        Identität in den Tokens — nicht in einer eingegebenen Kennung. Ohne sie
        antwortet Channex mit 400.

        None, wenn kein Kanal registriert ist oder Channex nicht erreichbar ist
        (dann behält der Aufrufer seine bisherigen Settings; ein Fehler hier darf
        den Ablauf nicht kippen, der eigentliche Aufruf meldet ihn ohnehin)."""
        # Ein BENANNTES Konto schlägt die Zeile des Objekts. Es kommt aus der
        # Kontoauswahl im Verbinden-Dialog und ist damit die Angabe des
        # Betriebs — die Zeile des Objekts ist dagegen nur der bisherige Stand
        # (und bei einem noch nicht zugeordneten Objekt schlicht falsch).
        channel_id = None
        if account_id:
            zeile = (
                db.table("ota_account")
                .select("channex_channel_id")
                .eq("tenant_id", tenant_id)
                .eq("id", account_id)
                .eq("ota_portal_code", portal_code)
                .limit(1)
                .execute()
            ).data
            if not zeile:
                raise ChannelManagerError(
                    "Dieses Portal-Konto gibt es nicht.", status_code=404
                )
            channel_id = zeile[0].get("channex_channel_id")
        if not channel_id:
            channel_id = self._kanal_dieses_objekts(
                db, tenant_id, property_id, portal_code
            )
        if not channel_id:
            return None
        try:
            kanal = self._channex.get_channel(channel_id)
        except ChannexError:
            return None
        attrs = (kanal.get("data") or {}).get("attributes") or {}
        settings = attrs.get("settings")
        return settings if isinstance(settings, dict) and settings else None

    def _lookup_property_mapping(
        self, db: Client, tenant_id: str, property_id: str
    ) -> str | None:
        """Channex-Property-UUID der Registrierung lesen — None, wenn keine."""
        pm = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        return pm.data[0]["channex_property_id"] if pm.data else None

    def _require_property_mapping(
        self, db: Client, tenant_id: str, property_id: str
    ) -> str:
        channex_property_id = self._lookup_property_mapping(db, tenant_id, property_id)
        if channex_property_id is None:
            raise ChannelManagerError(
                "Objekt ist noch nicht mit dem Channel-Manager verbunden.",
                status_code=409,
            )
        return channex_property_id

    def _ensure_property_registered(
        self, db: Client, tenant_id: str, property_id: str
    ) -> str:
        """Registrierung sicherstellen: existiert die Map-Zeile, sie zurückgeben;
        sonst den (idempotenten) Content-Sync nachholen, der Property + Room-Type
        + Rate-Plans anlegt und die Map schreibt. sync_content wirft ein präzises
        422, wenn Voraussetzungen fehlen (kein Preis/Titel/Währung) — das ist die
        umsetzbare Meldung, die die UI dem Nutzer zeigen soll (statt 409)."""
        # GEBÄUDE (0264): alle aktiven Einheiten DESSELBEN Gebäudes registrieren,
        # nicht nur die aufgerufene — sonst wäre die Zuordnungsliste (welche
        # Portal-Einheit ist welches Objekt) unvollständig. Sie landen als
        # Room-Types unter DERSELBEN Property (eine Portal-Kennung), jede mit
        # eigener Rate. Ein Objekt ohne Gebäude bringt nur sich selbst mit.
        building_id = self._building_of(db, tenant_id, property_id)
        if building_id:
            self._register_building_units(db, tenant_id, building_id)

        existing = self._lookup_property_mapping(db, tenant_id, property_id)
        if existing is not None:
            return existing
        # Nachregistrieren. Währung lädt sync_content selbst aus der DB (Wurzel 4).
        self.sync_content(tenant_id, property_id=property_id, currency=None)
        registered = self._lookup_property_mapping(db, tenant_id, property_id)
        if registered is None:
            # sync_content lief ohne Fehler durch, schrieb aber keine Map — echter
            # Datenfehler, nicht verschlucken (Wurzel 5).
            raise ChannelManagerError(
                "Objekt konnte nicht mit dem Channel-Manager verbunden werden.",
                status_code=409,
            )
        return registered

    def _register_building_units(
        self, db: Client, tenant_id: str, building_id: str
    ) -> None:
        """Jede aktive Einheit DIESES Gebäudes bei Channex registrieren
        (idempotent), damit alle als Room-Types unter DERSELBEN Property (eine
        Portal-Kennung) landen. Best-effort je Einheit — eine ohne Preis
        (sync_content 422) stoppt die übrigen nicht; sie fehlt dann nur in der
        Zuordnungsliste, bis ein Preis hinterlegt ist. Der Hauptpfad (das
        aufgerufene Objekt) prüft danach selbst, ob seine Registrierung entstand.
        """
        rooms = (
            db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("building_id", building_id)
            .eq("status", "active")
            .execute()
        ).data or []
        for room in rooms:
            rid = room["id"]
            if self._lookup_property_mapping(db, tenant_id, rid) is not None:
                continue
            try:
                self.sync_content(tenant_id, property_id=rid, currency=None)
            except ChannelManagerError as exc:
                # z. B. „Kein Preisplan vorhanden" (422) — dieses Zimmer erst nach
                # Preis-Anlage registrierbar. Andere Zimmer laufen weiter.
                log.warning(
                    "hotel_room_register_skipped",
                    tenant_id=tenant_id, property_id=rid,
                    error=getattr(exc, "message", str(exc)),
                )

    def _require_group(
        self, db: Client, tenant_id: str, channex_property_id: str
    ) -> str:
        """group_id für den Channel-Create (Pflicht). Bevorzugt die Tenant-Group;
        fällt sonst auf die Group zurück, die diese Property bei Channex besitzt.

        Fehlt beides, ist der Betrieb nicht bei Channex angelegt — das ist ein
        Konfigurationsfehler und wird als solcher gemeldet, nicht geraten."""
        grp = (
            db.table("channex_group_map")
            .select("channex_group_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if grp.data:
            return grp.data[0]["channex_group_id"]
        try:
            for g in self._channex.list_groups().get("data") or []:
                rel = (g.get("relationships") or {}).get("properties") or {}
                ids = {p.get("id") for p in (rel.get("data") or [])}
                if channex_property_id in ids:
                    return g.get("id")
        except ChannexError:
            pass
        raise ChannelManagerError(
            "Keine Channex-Gruppe für dieses Konto gefunden.", status_code=409
        )

    def _local_room_options(
        self, db: Client, tenant_id: str, channex_property_id: str
    ) -> list[dict[str, Any]]:
        """Zimmer (Objekte) dieser Channex-Property für die Zuordnungs-Auswahl —
        je Zimmer EIN Eintrag. Bei einer geteilten Hotel-Property alle Zimmer des
        Hotels (mehrere property_map-Zeilen, alle einbeziehen), bei einer FeWo das
        eine Objekt. Der Nutzer ordnet Booking-Zimmer → Zimmer zu; die Raten des
        Zimmers verbindet der Server automatisch."""
        pm = (
            db.table("channex_property_map")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        prop_ids = [row["property_id"] for row in pm]
        if not prop_ids:
            return []
        props = (
            db.table("properties")
            .select("id, title, property_type, airbnb_listing_id")
            .eq("tenant_id", tenant_id)
            .in_("id", prop_ids)
            .execute()
        ).data or []
        out: list[dict[str, Any]] = []
        for p in props:
            # Passenden Booking-Zimmertyp (BCRT) aus dem lokalen property_type
            # vorschlagen, damit die UI das richtige OTA-Zimmer vorwählt (der Kunde
            # kennt keine Booking-Zimmer-IDs). Ohne Entsprechung → None (kein Raten).
            suggestion = _booking_room_type(p.get("property_type"))
            out.append(
                {
                    "local_property_id": p["id"],
                    "title": p.get("title") or "Zimmer",
                    "suggested_bcrt_code": suggestion[0] if suggestion else None,
                    "suggested_bcrt_name": suggestion[1] if suggestion else None,
                    # Bei einem aus Airbnb ÜBERNOMMENEN Objekt ist die Zuordnung
                    # bereits eindeutig bekannt: die Listing-ID steht am Objekt.
                    # Die UI kann damit exakt vorwählen, statt über Namen zu
                    # raten — bei 18 Anzeigen ist Namensraten aussichtslos, und
                    # ohne Vorauswahl blieb `mappings` leer (finalize → 422).
                    "airbnb_listing_id": p.get("airbnb_listing_id"),
                }
            )
        return out

    def _rate_plan_maps_for_property(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[str]:
        """Alle rate_plan_map-IDs eines Zimmers (Objekts), Primary zuerst (älteste
        Map = Standard-Rate). Für die automatische Raten-Verbindung: Booking
        verlangt jede Rate gemappt, wir expandieren das Zimmer auf seine Raten."""
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
            return []
        rts = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("property_map_id", pm[0]["id"])
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        rt_ids = [r["id"] for r in rts]
        if not rt_ids:
            return []
        rps = (
            db.table("channex_rate_plan_map")
            .select("id, created_at")
            .in_("room_type_map_id", rt_ids)
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        ).data or []
        return [r["id"] for r in rps]

    def _channex_rate_plan_id_for_map(
        self, db: Client, tenant_id: str, rate_plan_map_id: str | None
    ) -> str | None:
        if not rate_plan_map_id:
            return None
        rp = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id")
            .eq("id", rate_plan_map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        return rp.data[0]["channex_rate_plan_id"] if rp.data else None

    @staticmethod
    def _as_int(value: object) -> int | None:
        """OTA-Codes MÜSSEN als Integer gesendet werden (Strings → 'Not mapped')."""
        if value is None or isinstance(value, bool):
            return None
        try:
            return int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None

    # -- Webhook-Registrierung bei Channex (Admin) -----------------------------
    # Vollständiges Event-Abo (Webhook-Collection-Doku). Webhooks sind nur
    # TRIGGER — Daten werden gepullt (Reihenfolge nicht garantiert):
    #   booking_*            → Feed-Pull-Job (sync_bookings_feed)
    #   booking_unmapped_*   → Mapping-Problem, hohe Prio (Overbooking-Gefahr)
    #   non_acked_booking    → Buchung 30 min nicht ge-ackt (Feed-Pull erneut)
    #   ari                  → ARI-Import-Job je Property (Änderung außerhalb PMS)
    #   sync_error/warning,
    #   rate_error           → sichtbares Flow-Debugging + Live-Ereignisse
    #   reservation_request,
    #   alteration_request,
    #   inquiry              → Airbnb-Anfragen (Ereignisliste fürs UI)
    #   review/updated_~     → neue Gäste-Bewertung eingetroffen
    #   *_channel/listing    → Kanal-Statuswechsel (Deaktivierung sichtbar machen)
    # Die fünf zuletzt ergänzten Namen stehen in Airbnbs eigener Ereignisliste
    # („LiveFeedEvents HTTP API", 16 Typen) und fehlten hier: ohne Abo kommen sie
    # gar nicht an, und ohne Journal-Abruf gäbe es keinen zweiten Weg.
    #   booking_without_property_id      Buchung ohne zuordenbare Property
    #   new_booking_after_modification   Änderung wurde zu einer NEUEN Buchung
    #   general_error                    allgemeiner Fehler des Kanals
    #   airbnb_notification              Systemmeldung von Airbnb
    #   wubook_flooding_detected         Fremdkanal-Schutzmeldung (nur Vollzähligkeit)
    _WEBHOOK_EVENTS = (
        "ari;booking_new;booking_modification;booking_cancellation;"
        "booking_unmapped_room;booking_unmapped_rate;non_acked_booking;message;"
        "booking_without_property_id;new_booking_after_modification;"
        "sync_error;sync_warning;rate_error;general_error;"
        "wubook_flooding_detected;airbnb_notification;"
        "reservation_request;alteration_request;inquiry;review;updated_review;"
        "activate_channel;deactivate_channel;disconnect_channel;disconnect_listing"
    )

    # Events, die einen kontoweiten Booking-Feed-Pull auslösen.
    #
    # `reservation_request`/`alteration_request` stehen hier NICHT mehr: eine
    # unbestätigte Anfrage ist keine Buchung und erzeugt deshalb keine Revision
    # — der Pull war wirkungslos. Diese beiden laufen jetzt über das
    # Ereignis-Journal (`live_feed`) und werden dort aufgelöst.
    # `new_booking_after_modification` und `booking_without_property_id` sind
    # dagegen echte Buchungs-Ereignisse und lösen den Pull aus.
    _BOOKING_PULL_EVENTS = frozenset(
        {"booking", "booking_new", "booking_modification", "booking_cancellation",
         "non_acked_booking", "new_booking_after_modification",
         "booking_without_property_id"}
    )
    # Events, die auf ein Problem hinweisen (severity=error in der Ereignisliste).
    _ERROR_EVENTS = frozenset(
        {"booking_unmapped_room", "booking_unmapped_rate", "non_acked_booking",
         "sync_error", "rate_error", "general_error",
         "booking_without_property_id", "wubook_flooding_detected",
         "deactivate_channel", "disconnect_channel",
         "disconnect_listing"}
    )
    # Handlungspflichtige Ereignisse mit Frist (Airbnb-Anfragen: Auto-Decline
    # nach ~24h). severity='action' → im UI hervorheben, von der Retention
    # ausgenommen (worker.py), solange unresolved.
    _ACTION_EVENTS = frozenset(
        {"reservation_request", "alteration_request", "inquiry"}
    )
    # Hochvolumige Events, die NICHT in die EREIGNISLISTE persistiert werden
    # (ari feuert bei jeder Preis-/Verfügbarkeitsänderung).
    #
    # `message` stand hier bis 0305 ebenfalls drin, mit der Begründung „läuft
    # über den Posteingang". Das war der Denkfehler: der Posteingang HOLTE den
    # Verlauf nur beim Öffnen und speicherte ihn nirgends. Der Ausschluss hieß
    # damit nicht „woanders abgelegt", sondern „weggeworfen" — eine Nachricht
    # existierte für uns erst, wenn jemand klickte. Nachrichten gehören
    # weiterhin NICHT in die Ereignisliste (sie sind kein Systemereignis), aber
    # sehr wohl in ihren eigenen Speicher: das erledigt jetzt Schritt 4.
    _UNPERSISTED_EVENTS = frozenset({"ari", "message"})

    def register_global_webhook(self, *, callback_url: str) -> dict[str, Any]:
        """Registriert (idempotent) EINEN globalen Webhook bei Channex, der alle
        Buchungs-/ARI-Events an unseren Callback schickt. Vorhandene globale
        Webhooks mit derselben callback_url werden vorher entfernt (kein Dup)."""
        from src.core.config import get_settings

        secret = get_settings().channex_webhook_secret.get_secret_value()
        if not secret:
            raise ChannelManagerError(
                "CHANNEX_WEBHOOK_SECRET fehlt — ohne Secret kein Webhook.",
                status_code=400,
            )
        # Registrierung ist DESTRUKTIV (löscht die bestehende Callback-URL und
        # legt sie mit UNSEREM Secret neu an). Läuft sie versehentlich aus einer
        # Umgebung mit abweichendem Secret (lokale .env), lehnt der Server danach
        # jedes echte Event mit 401 ab — genau der Ausfall, der unbemerkt blieb.
        # Deshalb: unterscheidet sich das Secret von dem der bestehenden aktiven
        # Registrierung, fail-CLOSED statt sie zu zerschießen.
        self._guard_secret_ueberschreibt_aktive_registrierung(callback_url, secret)
        try:
            # Vorhandene gleiche Callback-URL aufräumen (idempotent).
            existing = self._channex.list_webhooks().get("data") or []
            for wh in existing:
                attrs = wh.get("attributes") or wh
                if attrs.get("callback_url") == callback_url:
                    self._channex.delete_webhook(wh.get("id") or attrs.get("id"))

            created = self._channex.create_webhook(
                {
                    "callback_url": callback_url,
                    "event_mask": self._WEBHOOK_EVENTS,
                    "property_id": None,
                    "is_global": True,
                    "is_active": True,
                    "send_data": True,
                    "headers": {"X-Channex-Webhook-Secret": secret},
                }
            )
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        return created.get("data") or {}

    def _guard_secret_ueberschreibt_aktive_registrierung(
        self, callback_url: str, secret: str
    ) -> None:
        """Bricht ab, wenn bei Channex bereits eine aktive Registrierung auf
        dieselbe callback_url mit einem ANDEREN Secret liegt. Ohne diesen Guard
        macht ein Aufruf aus einer Umgebung mit veraltetem Secret den Webhook
        kaputt: die neue Registrierung sendet dann ein Secret, das der laufende
        Server nicht kennt → alle Events laufen in 401.

        Das Auslesen der bestehenden Liste ist best effort: erreichen wir Channex
        nicht, ist das KEIN Grund, die Registrierung zu blockieren (dann schlägt
        ohnehin der eigentliche Call fehl)."""
        try:
            existing = self._channex.list_webhooks().get("data") or []
        except ChannexError:
            return
        for wh in existing:
            attrs = wh.get("attributes") or wh
            if attrs.get("callback_url") != callback_url:
                continue
            if not attrs.get("is_active", True):
                continue
            kopf = attrs.get("headers") or {}
            vorhanden = next(
                (str(v) for k, v in kopf.items() if "secret" in str(k).lower()), None
            )
            if vorhanden and not secrets_match(vorhanden, secret):
                raise ChannelManagerError(
                    "Registrierung abgebrochen: bei Channex liegt bereits ein "
                    "aktiver Webhook auf diese URL mit einem ANDEREN Secret. "
                    "Ein Überschreiben würde alle Events auf 401 laufen lassen. "
                    "CHANNEX_WEBHOOK_SECRET dieser Umgebung mit dem Server "
                    "abgleichen (oder den alten Webhook bewusst löschen).",
                    status_code=409,
                )

    def list_registered_webhooks(self) -> list[dict[str, Any]]:
        try:
            data = self._channex.list_webhooks().get("data") or []
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc
        out: list[dict[str, Any]] = []
        for wh in data:
            attrs = wh.get("attributes") or wh
            out.append(
                {
                    "id": wh.get("id") or attrs.get("id"),
                    "callback_url": attrs.get("callback_url"),
                    "event_mask": attrs.get("event_mask"),
                    "is_global": bool(attrs.get("is_global")),
                    "is_active": bool(attrs.get("is_active", True)),
                }
            )
        return out

    def ingest_webhook(self, payload: dict[str, Any]) -> dict[str, str]:
        """Webhook von Channex verarbeiten. Wir nutzen das Event nur als TRIGGER
        und ziehen den aktuellen Stand (Channex garantiert keine Reihenfolge —
        Doku: Webhooks können out-of-order kommen, deshalb nie Payload-Daten
        direkt anwenden). Alle Schritte sind best effort: der Webhook wird IMMER
        mit 200 bestätigt (sonst wiederholt Channex bis ~24h und gibt dann auf);
        die Backstop-Ticks holen Verlorenes nach."""
        event = str(payload.get("event", "unknown"))
        channex_property_id = payload.get("property_id")
        # 'event' ist bei structlog für die Message reserviert → eigenes Feld.
        log.info("channex_webhook", webhook_event=event, property=channex_property_id)

        tenant_id, property_id = self._resolve_webhook_property(channex_property_id)

        # 1) Ereignis persistieren (Live-Ereignisliste, tenant-scoped; hoch-
        #    volumige Events ausgenommen). Fehler-Events zusätzlich als error.
        if event not in self._UNPERSISTED_EVENTS:
            self._persist_webhook_event(
                event, payload, tenant_id=tenant_id, property_id=property_id
            )

        # 2) Buchungs-Events → kontoweiten Feed-Pull einreihen (coalesced pro
        #    Minute: viele Webhooks kurz hintereinander = EIN Pull).
        if event in self._BOOKING_PULL_EVENTS or event == "booking":
            self._enqueue_bookings_pull()

        # 3) ARI-Änderung außerhalb unseres PMS → Import-Job für die Property.
        if event == "ari" and tenant_id and channex_property_id:
            self._enqueue_ari_import(tenant_id, str(channex_property_id))

        # 4) Gastnachricht → Abwesenheitsantworten prüfen (message_received).
        if event == "message" and tenant_id:
            self._nachricht_eingegangen(str(tenant_id), payload)

        # 5) Bewertung → aktuellen Stand ziehen und spiegeln (channex_review).
        if event in self._REVIEW_EVENTS:
            self._bewertung_eingegangen(payload)

        return {"status": "accepted", "event": event}

    # Bewertungs-Events: `review` = neu eingetroffen, `updated_review` = der Gast
    # hat nachgelegt oder das Portal hat die Sichtbarkeit geändert. Beide führen
    # zum selben Schritt (Stand ziehen), weil Channex keine Reihenfolge zusichert.
    _REVIEW_EVENTS = frozenset({"review", "updated_review"})

    def _bewertung_eingegangen(self, payload: dict[str, Any]) -> None:
        """Bewertungs-Webhook → die eine Bewertung frisch ziehen und spiegeln.

        Best effort: der Ingest antwortet immer mit 200, sonst wiederholt Channex
        bis zu 24 h. Was hier verloren geht, holt der Backstop-Tick nach."""
        inner = payload.get("payload") if isinstance(payload.get("payload"), dict) else {}
        review_id = inner.get("id") or payload.get("id")
        if not isinstance(review_id, str) or not review_id.strip():
            log.warning("channex_review_webhook_ohne_id", keys=sorted(inner))
            return
        try:
            self.sync_single_review(review_id.strip())
        except Exception as exc:  # noqa: BLE001 — Ingest nie kippen (200 zurück)
            log.warning("channex_review_webhook_failed", error=str(exc)[:200])

    # Schlüssel, unter denen die Booking-Referenz einer Nachricht ankommen kann.
    #
    # Die Feldnamen stammen jetzt aus Airbnbs eigenem Dokument
    # („LiveFeedEvents HTTP API", `docs/OTA/Airbnb/LiveFeedEvents.pdf`), das die
    # `payload`-Form eines Ereignisses wörtlich zeigt: `booking_id`,
    # `booking_revision_id`, `booking_unique_id` — daneben, NICHT darin,
    # `property_id`.
    #
    # Zwei früher geratene Schlüssel waren nachweislich falsch und sind entfernt:
    #   `revision_id`  heißt in Wahrheit `booking_revision_id` → traf nie.
    #   `id`           ist die EREIGNIS-ID, nicht die Buchung. Als Fallback war
    #                  sie schädlich: `id` existiert in praktisch jedem Payload,
    #                  also lieferte die Suche eine FALSCHE Referenz statt `None`
    #                  — die Thread-Suche schlug fehl und das Diagnose-Logging,
    #                  das die echte Feldform hätte zeigen sollen, lief nie an.
    # Ein fehlender Bezug ist harmlos (Abwesenheitsantwort entfällt), ein
    # falscher hängt die Nachricht an die falsche Buchung (Wurzel 4/5).
    _MESSAGE_BOOKING_KEYS = (
        "booking_id",
        "booking_revision_id",
        "booking_unique_id",
        "booking",
    )

    def _booking_ref_aus_message(self, payload: dict[str, Any]) -> str | None:
        inner = payload.get("payload") if isinstance(payload.get("payload"), dict) else {}
        for quelle in (inner, payload):
            for key in self._MESSAGE_BOOKING_KEYS:
                wert = quelle.get(key)
                if isinstance(wert, str) and wert.strip():
                    return wert.strip()
                if isinstance(wert, dict) and isinstance(wert.get("id"), str):
                    return wert["id"]
        return None

    def _nachricht_eingegangen(self, tenant_id: str, payload: dict[str, Any]) -> None:
        """Eingegangene Gastnachricht: SPEICHERN, dann Abwesenheitsantwort.

        Die Reihenfolge ist der Kern dieser Methode. Bis 0305 tat sie nur das
        Zweite — die Nachricht selbst wurde verworfen, und als am 06.08.2026 der
        Endpunkt elf Minuten lang mit 503 antwortete, waren die betroffenen
        Nachrichten endgültig weg. Gespeichert wird deshalb ZUERST und
        unabhängig davon, ob eine Automation greift.

        Der Zähl-Stand für „erste Nachricht" wird VOR dem Spiegeln genommen:
        danach steht die neue Nachricht bereits in der Tabelle und jeder Thread
        sähe aus, als hätte er schon einmal Kontakt gehabt.

        Best effort: der Webhook wird IMMER mit 200 quittiert (sonst wiederholt
        Channex bis ~24 h und gibt dann auf). Was hier verloren geht, holt der
        Journal-Tick nach — er läuft durch dieselbe `nachricht_spiegeln`.
        """
        if self._db is None:
            return
        try:
            from src.features.inbox.service import InboxService  # noqa: PLC0415

            svc = InboxService(service_client=self._db)
            ref = self._booking_ref_aus_message(payload)
            vorher = (
                svc.zaehle_gastnachrichten_je_buchung(tenant_id, ref) if ref else 0
            )

            thread_id = self.nachricht_spiegeln(tenant_id, payload)
            if thread_id is None:
                # Ohne Buchungsbezug (Airbnb-Support, Anfrage vor der Buchung)
                # gibt es keinen Thread, in dem eine Antwort erscheinen könnte.
                # Die Nachricht IST gespeichert — nur die Automation entfällt.
                return

            # NUR auf Gastnachrichten antworten. Channex liefert über denselben
            # Webhook auch 'property' (unsere eigene Antwort, etwa direkt aus der
            # Airbnb-App getippt) und 'system' — ungefiltert schickte die
            # Abwesenheitsantwort dem Gast „Wir melden uns bald", nachdem die
            # Gastgeberin ihm gerade selbst geschrieben hatte. Zusätzlich läuft
            # das Webhook-Echo unserer EIGENEN Abwesenheitsantwort wieder hier
            # durch (sender='property'). Der Absender ist die einzige Angabe, die
            # das trennt — er wird deshalb hier geprüft, nicht erst in der
            # Planung: `schedule_message_received` kennt die Nachricht nicht.
            if (payload.get("sender") or "").strip().lower() != "guest":
                return

            svc.schedule_message_received(
                tenant_id, thread_id, ist_erste_nachricht=vorher == 0
            )
        except Exception as exc:  # noqa: BLE001 — Ingest nie kippen (200 zurück)
            log.warning("message_webhook_verarbeitung_fehlgeschlagen", error=str(exc)[:300])

    def _resolve_webhook_property(
        self, channex_property_id: object
    ) -> tuple[str | None, str | None]:
        """Channex-Property-ID des Webhooks → (tenant_id, lokale property_id).
        (None, None), wenn kein aktives Mapping existiert (z. B. Objekt bereits
        getrennt) — das Ereignis wird dann ohne Tenant-Bezug geloggt."""
        if not channex_property_id or self._db is None:
            return None, None
        try:
            rows = (
                self._db.table("channex_property_map")
                .select("tenant_id, property_id")
                .eq("channex_property_id", str(channex_property_id))
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — Ingest nie kippen (200 zurück)
            log.warning("webhook_property_resolve_failed", error=str(exc)[:200])
            return None, None
        if not rows:
            return None, None
        return rows[0].get("tenant_id"), rows[0].get("property_id")

    def _persist_webhook_event(
        self,
        event: str,
        payload: dict[str, Any],
        *,
        tenant_id: str | None,
        property_id: str | None,
    ) -> None:
        """Webhook-Ereignis in channex_webhook_event schreiben (Live-Ereignis-
        liste: Airbnb-Anfragen, Sync-/Rate-Fehler, unmapped Bookings, Reviews,
        Kanal-Statuswechsel). Ohne Tenant-Mapping wird NICHT persistiert (die
        Tabelle ist tenant-scoped; kontolose Events stehen im Log)."""
        if self._db is None or tenant_id is None:
            return
        if event in self._ERROR_EVENTS:
            severity = "error"
        elif event in self._ACTION_EVENTS:
            severity = "action"
        else:
            severity = "info"
        if severity in ("error", "action"):
            log.warning(
                "channex_webhook_actionable", webhook_event=event,
                severity=severity, tenant_id=tenant_id, property_id=property_id,
            )
        # Payload-Deckel: rohe Webhook-Payloads (send_data) können groß sein
        # und enthalten Gast-PII. Über 32 KB nur einen Marker speichern — die
        # Wahrheit wird ohnehin gepullt (Webhook = Trigger, nie Datenquelle).
        try:
            import json as _json

            if len(_json.dumps(payload, default=str)) > 32_000:
                payload = {"event": event, "truncated": True}
        except (TypeError, ValueError):
            payload = {"event": event, "unserializable": True}
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "event": event,
            "payload": payload,
            "severity": severity,
        }
        # Die Channex-Ereignis-ID ist der EINZIGE Weg, eine Airbnb-Anfrage später
        # zu beantworten (`POST live_feed/{id}/resolve`). Sie wird deshalb aus dem
        # Rohpayload gezogen, BEVOR der 32-KB-Deckel oben ihn ersetzt hätte.
        live_id = self._live_feed_event_id(payload)
        if live_id:
            zeile["live_feed_event_id"] = live_id
        try:
            self._db.table("channex_webhook_event").insert(zeile).execute()
        except Exception as exc:  # noqa: BLE001 — Persistenz nie den Ingest kippen
            log.warning("webhook_event_persist_failed", error=str(exc)[:200])

    @staticmethod
    def _live_feed_event_id(payload: dict[str, Any]) -> str | None:
        """Die LiveFeedEvent-ID aus einem Webhook-Payload.

        Airbnbs Dokument zeigt das Ereignis mit `id` auf der Attribut-Ebene und
        `type: "live_feed_event"`. Der Webhook liefert daneben `payload` mit den
        Sachdaten — die dortige `id` ist die der SACHE (Bewertung, Buchung), nicht
        die des Ereignisses. Deshalb wird hier ausdrücklich der ausgewiesene
        Ereignis-Schlüssel gelesen und NICHT irgendein `id` geraten: eine falsche
        ID würde eine fremde Anfrage beantworten.
        """
        for key in ("live_feed_event_id", "event_id"):
            wert = payload.get(key)
            if isinstance(wert, str) and wert.strip():
                return wert.strip()
        return None

    def _enqueue_bookings_pull(self) -> None:
        """sync_bookings_feed-Job einreihen (coalesced je Minuten-Bucket)."""
        if self._db is None:
            return
        try:
            from src.jobs.queue import enqueue

            # Konstanter Dedup-Key (gleiche Familie wie der Backstop-Tick):
            # koalesziert Webhook-Stürme UND verhindert zwei parallel laufende
            # Feed-Jobs aus getrennten Key-Familien.
            enqueue(
                self._db, "sync_bookings_feed",
                payload={}, dedup_key="sync_bookings_feed",
            )
        except Exception as exc:  # noqa: BLE001 — Backstop-Tick holt es nach
            log.warning("webhook_bookings_enqueue_failed", error=str(exc)[:200])

    def _enqueue_ari_import(self, tenant_id: str, channex_property_id: str) -> None:
        """import_ari_property-Job einreihen — EIN Job JE ZIMMER.

        Ein Lauf über eine geteilte Hotel-Property braucht mehr Channex-Anfragen,
        als das Property-Budget je Minute hergibt (gemessen: 3 Zimmer = 30 Calls
        gegen 20/Minute). Der Job brach deshalb immer beim selben Stand ab, begann
        beim nächsten Versuch von vorn und wurde NIE fertig — Jobs vom 30.07.
        liefen am 01.08. noch im Kreis und verbrannten dabei Budget. Je Zimmer
        bleibt ein Lauf unter der Grenze und geht durch.

        Der Dedup-Schlüssel trägt bewusst KEINEN Zeit-Bucket mehr: sonst
        sammelten sich mit jedem Webhook neue Jobs desselben Zimmers an, die
        einander das Budget wegnahmen. Coalescing greift nur auf `queued` —
        ein Webhook während eines laufenden Imports erzeugt weiterhin einen
        frischen Job."""
        if self._db is None:
            return
        try:
            from src.jobs.queue import enqueue

            zimmer = (
                self._db.table("channex_property_map")
                .select("property_id")
                .eq("tenant_id", tenant_id)
                .eq("channex_property_id", channex_property_id)
                .is_("deleted_at", "null")
                .execute()
            ).data or []
            for row in zimmer:
                property_id = row.get("property_id")
                if not property_id:
                    continue
                enqueue(
                    self._db, "import_ari_property", tenant_id=tenant_id,
                    payload={"tenant_id": tenant_id,
                             "channex_property_id": channex_property_id,
                             "property_id": property_id},
                    dedup_key=f"ari_import:{channex_property_id}:{property_id}",
                )
        except Exception as exc:  # noqa: BLE001 — Reconcile-Tick holt es nach
            log.warning("webhook_ari_enqueue_failed", error=str(exc)[:200])
