"""OTA-Kanäle inhouse: Katalog, Connect, An/Aus, Persistenz, Webhooks.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
# pylint: disable=too-many-lines
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import ChannelManagerError, _booking_room_type, log


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

    def list_supported_portals(
        self, ctx: AuthContext | None = None
    ) -> list[dict[str, Any]]:
        """Verbindbare Portale + die Eingabefelder, die der Kunde ausfüllt.
        Felder werden aus dem Channex-Channel-Katalog (`params`, ohne `hidden`)
        abgeleitet — so raten wir nichts und bleiben aktuell. ALLE sichtbaren
        String-Pflichtfelder werden abgefragt (z.B. Hotel-ID UND Property-E-Mail;
        Autovermieter mehrere IDs), nicht nur ein Hauptfeld.

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
            # Sandbox-Testkanal: keine Eingaben — Service setzt alles selbst
            # (credential-Flow, Service injiziert endpoint/hotel_code/api_key).
            if portal["code"] == self._SANDBOX_CODE:
                out.append(
                    {**portal, "fields": [], "connection_type": "credential",
                     "setup_hint": None}
                )
                continue
            spec = by_code.get(portal["code"]) or {}
            params = spec.get("params") or {}
            # ALLE sichtbaren String-Pflichtfelder (ohne `default`), nach Position
            # sortiert. `rules` (Validierungsregeln, z.B. bei E-Mail) schließt ein
            # Feld NICHT mehr aus — es ist trotzdem Pflicht und muss abgefragt
            # werden, sonst lehnt Channex die Verbindung ab.
            essential = sorted(
                (
                    (key, meta)
                    for key, meta in params.items()
                    if meta.get("type") == "string" and "default" not in meta
                ),
                key=lambda kv: kv[1].get("position", 99),
            )
            fields = [
                {
                    "key": key,
                    "label": self._humanize_field(meta.get("title"), portal["label"]),
                    "placeholder": "",
                    "required": True,
                    # E-Mail-Felder als solche kennzeichnen (Frontend: type=email);
                    # sonst normales Textfeld. Der Katalog liefert nur "string".
                    "type": "email" if "email" in key.lower() else "text",
                    # E-Mail-Felder mit der Betriebs-E-Mail vorbefüllen (sonst
                    # leer). Kein Default für Hotel-ID o.ä. — die ist kundenspezifisch.
                    "default": (
                        default_email if "email" in key.lower() and default_email
                        else None
                    ),
                }
                for key, meta in essential
            ]
            # OAuth ⇔ kein abfragbares Credential-Feld außer der Property-E-Mail
            # (z.B. Airbnb) ODER explizit in der Allowlist. E-Mail allein ist kein
            # Credential-Login → solche Kanäle laufen über die OAuth-URL.
            credential_fields = [f for f in fields if "email" not in f["key"].lower()]
            is_oauth = portal["code"] in self._OAUTH_PORTALS or not credential_fields
            out.append(
                {
                    "code": portal["code"],
                    "label": portal["label"],
                    "icon": portal["icon"],
                    "fields": [] if is_oauth else fields,
                    "connection_type": "oauth" if is_oauth else "credential",
                    "setup_hint": self._SETUP_HINTS.get(portal["code"]),
                }
            )
        return out

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

    @staticmethod
    def _humanize_field(title: str | None, portal_label: str) -> str:
        """Channex-Feldtitel ggf. white-label machen (z.B. 'Hotel ID' →
        'Booking.com Hotel-ID'). Kein Provider-Name durchsickern lassen."""
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
        settings: dict[str, Any],
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
        settings = self._inject_sandbox_settings(portal_code, property_id, settings)

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
        """mapping_details kommt je OTA in zwei Formen — auf eine einheitliche
        Struktur [{id, title, rates:[{id, title, pricing, max_persons}]}] bringen:
          a) Booking.com: data.rooms[].rates[]
          b) OpenChannel/„attributes": data.attributes.room_types[].rate_plans[]"""
        data = details.get("data") or {}
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
        if not mappings:
            raise ChannelManagerError(
                "Mindestens eine Zimmer/Raten-Zuordnung ist nötig.", status_code=422
            )

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
        rate_plans = self._build_rate_plans(
            db, tenant_id, portal_code, mappings, ota_rooms
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
        Rate-Plan hat oder ein OTA-Zimmer keine Rate liefert."""
        is_sandbox = portal_code == self._SANDBOX_CODE
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

            local_rate_maps = self._rate_plan_maps_for_property(
                db, tenant_id, local_property_id
            )
            if not local_rate_maps:
                raise ChannelManagerError(
                    "Das zugeordnete Zimmer hat keinen Preisplan.", status_code=422
                )
            channex_rate_plan_ids = [
                self._channex_rate_plan_id_for_map(db, tenant_id, mid)
                for mid in local_rate_maps
            ]
            channex_rate_plan_ids = [c for c in channex_rate_plan_ids if c]
            if not channex_rate_plan_ids:
                raise ChannelManagerError(
                    "Preisplan des Zimmers nicht bei den Portalen registriert.",
                    status_code=422,
                )
            log.info(
                "build_rate_plans_debug_row",
                local_property_id=local_property_id,
                mapping_room_type_code=m.get("room_type_code"),
                ota_room_title=ota_room.get("title"),
                ota_rate_ids=[r.get("id") for r in ota_rates],
                local_rate_map_ids=local_rate_maps,
                channex_rate_plan_ids=channex_rate_plan_ids,
            )

            room_code = (
                m.get("room_type_code") if is_sandbox
                else self._as_int(m.get("room_type_code"))
            )
            occupancy = self._as_int(m.get("occupancy")) or 2
            pricing_type = m.get("pricing_type") or "Standard"

            # Standard ist der GRUNDPREIS: der erste (Standard-)Preis des Zimmers
            # geht immer an die Portale — pro Zimmer GENAU EIN Eintrag auf die
            # Standard-Rate (erste OTA-Rate). Zusätzliche Preise gehen NUR mit, wenn
            # der Kunde sie je Preis freigeschaltet hat (rate_plans.send_to_portals,
            # 0177). channex_rate_plan_ids ist bereits nach Alter sortiert (der erste
            # = Grundpreis); der Filter behält den ersten IMMER und von den weiteren
            # nur die freigeschalteten.
            portal_ids = self._portal_enabled_rate_plan_ids(
                db, tenant_id, local_property_id
            )
            selected = [
                cid for i, cid in enumerate(channex_rate_plan_ids)
                if i == 0 or cid in portal_ids
            ]
            # Jede gewählte Rate auf eine eigene OTA-Rate paaren (Standard zuerst).
            pairs = list(zip(ota_rates, selected, strict=False))

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
                        "settings": {
                            "room_type_code": room_code,
                            "rate_plan_code": rate_code,
                            "occupancy": occupancy,
                            "pricing_type": pricing_type,
                            # Nur der erste Eintrag trägt die Restriktionen.
                            "primary_occ": not primary_used,
                            "readonly": False,
                        },
                    }
                )
                primary_used = True
        if not rate_plans:
            raise ChannelManagerError(
                "Bitte mindestens ein Zimmer zuordnen.", status_code=422
            )
        return rate_plans

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

    def disconnect_channel(self, ctx: AuthContext, channel_id: str) -> None:
        """Kanal trennen: erst deaktivieren (sonst 422 'is active'), dann löschen."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        # ZUERST Tenant-Eigentum prüfen (IDOR-Schutz): der channel_id kommt aus
        # dem Pfad. Ohne diese Prüfung könnte ein Tenant über eine fremde
        # Channex-Channel-ID den OTA-Kanal eines ANDEREN Betriebs deaktivieren/
        # löschen (die Channex-Calls laufen mit dem geteilten Account-Key).
        owns = (
            db.table("channex_channel_connection")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("channex_channel_id", channel_id)
            .limit(1)
            .execute()
        ).data
        if not owns:
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
        row = (
            db.table("channex_channel_connection")
            .select("channex_channel_id, ota_hotel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .eq("ota_portal_code", portal_code)
            .limit(1)
            .execute()
        ).data
        if not row:
            raise ChannelManagerError("Kanal-Verbindung nicht gefunden.", status_code=404)

        channel_id = row[0].get("channex_channel_id")
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
        ).eq("tenant_id", tenant_id).eq("property_id", property_id).eq(
            "ota_portal_code", portal_code
        ).execute()
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
            "is_active": is_active,
            "last_error": last_error,
        }
        try:
            db.table("channex_channel_connection").upsert(
                row, on_conflict="property_id,ota_portal_code"
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
        for r in conns:
            if not r.get("is_active"):
                continue
            active_props_by_portal.setdefault(
                r.get("ota_portal_code") or "", set()
            ).add(r.get("property_id"))

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

        # Basis: alle aktiven Objekte des Tenants (jede Zeile = ein Objekt).
        props = (
            db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .eq("status", "active")
            .order("title")
            .execute()
        ).data or []
        property_ids = [p["id"] for p in props]

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

        mappings: list[dict[str, Any]] = []
        for p in props:
            pid = p["id"]
            c = conn_by_property.get(pid, {})
            m = sync_by_property.get(pid, {})
            mappings.append(
                {
                    "property_id": pid,
                    "property_title": p.get("title"),
                    "ota_hotel_id": c.get("ota_hotel_id"),
                    "ota_room_type_code": c.get("ota_room_type_code"),
                    "ota_room_title": c.get("ota_room_title"),
                    "is_active": bool(c.get("is_active")),
                    "connected": bool(c),  # existiert eine Verbindung dieses Portals?
                    "sync_enabled": bool(m.get("sync_enabled")),
                    "last_sync_status": m.get("last_sync_status"),
                    "last_sync_error": m.get("last_sync_error") or c.get("last_error"),
                    "updated_at": c.get("updated_at"),
                }
            )

        # Bei Hotels teilen sich alle Zimmer EINEN Channex-Kanal (eine Hotel-ID) —
        # die channel_id einer beliebigen bestehenden Verbindung reicht zum
        # Trennen des ganzen Portals („alles lösen").
        channel_id = next(
            (
                c.get("channex_channel_id")
                for c in conn_by_property.values()
                if c.get("channex_channel_id")
            ),
            None,
        )
        return {
            "portal_code": portal_code,
            "portal": self._portal_label(portal_code),
            "connected": any(m["is_active"] for m in mappings),
            "connected_count": sum(1 for m in mappings if m["is_active"]),
            "total_count": len(mappings),
            "channel_id": channel_id,
            "mappings": mappings,
        }

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
                "ota_portal_code, ota_hotel_id, channex_channel_id, "
                "is_active, last_error, updated_at"
            )
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        )
        out: list[dict[str, Any]] = []
        for r in res.data or []:
            code = r.get("ota_portal_code")
            out.append(
                {
                    "portal_code": code,
                    "portal": self._portal_label(code),
                    "hotel_id": r.get("ota_hotel_id"),
                    "channel_id": r.get("channex_channel_id"),
                    "is_active": bool(r.get("is_active")),
                    "last_error": r.get("last_error"),
                    "updated_at": r.get("updated_at"),
                }
            )
        return out

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
        # HOTEL: alle aktiven Zimmer des Betriebs registrieren, nicht nur das
        # aufgerufene — sonst wäre die Mapping-Liste (welches Booking-Zimmer ist
        # welches Objekt) unvollständig. Die Zimmer landen als Room-Types unter
        # DERSELBEN Property (eine Booking-Hotel-ID), jedes mit eigener Rate. Bei
        # vacation_rental nur das eine Objekt (eigene Property/ID pro FeWo).
        if self._is_hotel_tenant(db, tenant_id):
            self._register_all_hotel_rooms(db, tenant_id)

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

    def _register_all_hotel_rooms(self, db: Client, tenant_id: str) -> None:
        """HOTEL: jedes aktive Zimmer-Objekt bei Channex registrieren (idempotent),
        damit alle als Room-Types unter DERSELBEN Property (eine Booking-Hotel-ID)
        landen. Best-effort je Zimmer — ein Zimmer ohne Preis (sync_content 422)
        stoppt die übrigen nicht; es fehlt dann nur in der Mapping-Liste, bis ein
        Preis hinterlegt ist. Der Hauptpfad (das aufgerufene Objekt) prüft danach
        selbst, ob seine Registrierung wirklich entstand."""
        rooms = (
            db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
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
        fällt sonst auf die Group zurück, die diese Property bei Channex besitzt."""
        grp = (
            db.table("channex_group_map")
            .select("channex_group_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if grp.data:
            return grp.data[0]["channex_group_id"]
        # Fallback: Group ermitteln, die die Property enthält.
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
            .select("id, title, property_type")
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
    _WEBHOOK_EVENTS = (
        "ari;booking_new;booking_modification;booking_cancellation;"
        "booking_unmapped_room;booking_unmapped_rate;non_acked_booking;message;"
        "sync_error;sync_warning;rate_error;"
        "reservation_request;alteration_request;inquiry;review;updated_review;"
        "activate_channel;deactivate_channel;disconnect_channel;disconnect_listing"
    )

    # Events, die einen kontoweiten Booking-Feed-Pull auslösen.
    _BOOKING_PULL_EVENTS = frozenset(
        {"booking", "booking_new", "booking_modification", "booking_cancellation",
         "non_acked_booking", "reservation_request", "alteration_request"}
    )
    # Events, die auf ein Problem hinweisen (severity=error in der Ereignisliste).
    _ERROR_EVENTS = frozenset(
        {"booking_unmapped_room", "booking_unmapped_rate", "non_acked_booking",
         "sync_error", "rate_error", "deactivate_channel", "disconnect_channel",
         "disconnect_listing"}
    )
    # Handlungspflichtige Ereignisse mit Frist (Airbnb-Anfragen: Auto-Decline
    # nach ~24h). severity='action' → im UI hervorheben, von der Retention
    # ausgenommen (worker.py), solange unresolved.
    _ACTION_EVENTS = frozenset(
        {"reservation_request", "alteration_request", "inquiry"}
    )
    # Hochvolumige Events, die NICHT in die Ereignisliste persistiert werden
    # (ari feuert bei jeder Preis-/Verfügbarkeitsänderung; message läuft über
    # den Posteingang).
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

        return {"status": "accepted", "event": event}

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
        try:
            self._db.table("channex_webhook_event").insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "event": event,
                    "payload": payload,
                    "severity": severity,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Persistenz nie den Ingest kippen
            log.warning("webhook_event_persist_failed", error=str(exc)[:200])

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
        """import_ari_property-Job einreihen (coalesced je Property+5-min-Bucket)."""
        if self._db is None:
            return
        try:
            import time as _time

            from src.jobs.queue import enqueue

            bucket = int(_time.time() // 300)
            enqueue(
                self._db, "import_ari_property", tenant_id=tenant_id,
                payload={"tenant_id": tenant_id,
                         "channex_property_id": channex_property_id},
                dedup_key=f"ari_import:{channex_property_id}:{bucket}",
            )
        except Exception as exc:  # noqa: BLE001 — Reconcile-Tick holt es nach
            log.warning("webhook_ari_enqueue_failed", error=str(exc)[:200])
