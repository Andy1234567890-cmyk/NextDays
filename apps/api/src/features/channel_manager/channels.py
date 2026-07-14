"""OTA-Kanäle inhouse: Katalog, Connect, An/Aus, Persistenz, Webhooks.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import ChannelManagerError, log


class ChannelsMixin:
    """OTA-Kanäle inhouse: Katalog, Connect, An/Aus, Persistenz, Webhooks."""


    # -- Kanäle (OTA) inhouse: Channel-API nach Skill --------------------------
    # White-label: der interne Channel-Code (z.B. "BookingCom") wird dem Kunden
    # nie erklärt; angezeigt wird nur der menschliche Name (label). Die Portal-
    # Felder kommen LIVE aus /channels/list (params, nicht-`hidden`) — nicht raten.
    # Welche Portale wir anbieten (kuratiert; menschliche Labels + Icons):
    _PORTAL_CATALOG: list[dict[str, str]] = [
        {"code": "BookingCom", "label": "Booking.com", "icon": "simple-icons:bookingdotcom"},
        {"code": "AirBNB", "label": "Airbnb", "icon": "simple-icons:airbnb"},
        {"code": "Expedia", "label": "Expedia", "icon": "simple-icons:expedia"},
        {"code": "VRBO", "label": "Vrbo", "icon": "ph:house"},
    ]
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
        """Sichtbare Portale — im Sandbox-Modus inkl. Test-Kanäle."""
        from src.core.config import get_settings

        catalog = list(self._PORTAL_CATALOG)
        if get_settings().channex_sandbox_portals:
            catalog = catalog + self._SANDBOX_CATALOG
        return catalog

    @property
    def _portal_labels(self) -> dict[str, str]:
        return {p["code"]: p["label"] for p in self._portal_catalog()}

    def list_supported_portals(self) -> list[dict[str, Any]]:
        """Verbindbare Portale + die Eingabefelder, die der Kunde ausfüllt.
        Felder werden aus dem Channex-Channel-Katalog (`params`, ohne `hidden`)
        abgeleitet — so raten wir nichts und bleiben aktuell."""
        try:
            catalog = self._channex.list_channel_catalog().get("data") or []
        except ChannexError:
            catalog = []
        by_code = {c.get("code"): c for c in catalog}

        out: list[dict[str, Any]] = []
        for portal in self._portal_catalog():
            # Sandbox-Testkanal: keine Eingaben — Service setzt alles selbst
            # (credential-Flow, Service injiziert endpoint/hotel_code/api_key).
            if portal["code"] == self._SANDBOX_CODE:
                out.append({**portal, "fields": [], "connection_type": "credential"})
                continue
            spec = by_code.get(portal["code"]) or {}
            params = spec.get("params") or {}
            # Nur das EINE Haupt-Auth-Feld abfragen (z.B. Hotel-ID). Optionale/
            # versteckte Felder (email, notifications, payout …) lassen wir weg —
            # der Kunde soll nichts Unnötiges sehen. Heuristik: sichtbares
            # String-Feld ohne `default`/`rules`, mit der kleinsten `position`.
            essential = [
                (key, meta)
                for key, meta in params.items()
                if meta.get("type") == "string"
                and "default" not in meta
                and not meta.get("rules")
            ]
            essential.sort(key=lambda kv: kv[1].get("position", 99))
            fields = [
                {
                    "key": key,
                    "label": self._humanize_field(meta.get("title"), portal["label"]),
                    "placeholder": "",
                    "required": True,
                }
                for key, meta in essential[:1]  # nur das Hauptfeld
            ]
            # OAuth ⇔ kein abfragbares Credential-Hauptfeld (z.B. Airbnb) ODER
            # explizit in der Allowlist. OAuth-Portale zeigen keine Credential-
            # Eingabe — der Connect läuft über die OAuth-URL (begin_channel_oauth).
            is_oauth = portal["code"] in self._OAUTH_PORTALS or not fields
            out.append(
                {
                    "code": portal["code"],
                    "label": portal["label"],
                    "icon": portal["icon"],
                    "fields": [] if is_oauth else fields,
                    "connection_type": "oauth" if is_oauth else "credential",
                }
            )
        return out

    @staticmethod
    def _humanize_field(title: str | None, portal_label: str) -> str:
        """Channex-Feldtitel ggf. white-label machen (z.B. 'Hotel ID' →
        'Booking.com Hotel-ID'). Kein Provider-Name durchsickern lassen."""
        t = (title or "").strip() or "Wert"
        if t.lower() in ("hotel id", "hotel_id", "hotel code"):
            return f"{portal_label} Hotel-ID"
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
                    "portal": self._portal_labels.get(a.get("channel"), "Kanal"),
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
        if portal_code not in self._portal_labels:
            raise ChannelManagerError("Unbekanntes Portal.", status_code=400)

        channex_property_id = self._require_property_mapping(db, tenant_id, property_id)
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

        # Unsere lokalen (gemappten) Rate-Plans dieser Property anbieten.
        local_rate_plans = self._local_rate_plan_options(
            db, tenant_id, channex_property_id
        )
        return {
            "portal": self._portal_labels[portal_code],
            "ota_rooms": rooms,            # [{id, title, rates:[{id, title, …}]}]
            "rate_plans": local_rate_plans,  # [{rate_plan_map_id, title}]
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
        """Skill-Schritte 3+4: Kanal mit Zimmer/Raten-Zuordnung anlegen und
        aktivieren. `mappings` = [{rate_plan_map_id, room_type_code(int),
        rate_plan_code(int), occupancy, pricing_type, primary_occ}]."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        if portal_code not in self._portal_labels:
            raise ChannelManagerError("Unbekanntes Portal.", status_code=400)
        if not mappings:
            raise ChannelManagerError(
                "Mindestens eine Zimmer/Raten-Zuordnung ist nötig.", status_code=422
            )

        channex_property_id = self._require_property_mapping(db, tenant_id, property_id)

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
        if existing and existing[0].get("channex_channel_id"):
            return {
                "id": existing[0]["channex_channel_id"],
                "portal": self._portal_labels[portal_code],
                "title": title or self._portal_labels[portal_code],
                "is_active": bool(existing[0].get("is_active")),
            }

        group_id = self._require_group(db, tenant_id, channex_property_id)
        settings = self._inject_sandbox_settings(portal_code, property_id, settings)

        # rate_plans-Array bauen (gemeinsamer Helfer; echte OTAs INTEGER-Codes,
        # OpenChannel/Sandbox String-Codes — Helfer unterscheidet das).
        rate_plans = self._build_rate_plans(db, tenant_id, portal_code, mappings)

        attrs: dict[str, Any] = {
            "channel": portal_code,
            "group_id": group_id,                 # Pflicht
            "is_active": False,                    # wird inaktiv erstellt
            "title": title or self._portal_labels[portal_code],
            "properties": [channex_property_id],
            "settings": settings or {},
            "rate_plans": rate_plans,
        }
        try:
            created = self._channex.create_channel(attrs)
        except ChannexError as exc:
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
        self._save_channel_connection(
            db, tenant_id,
            property_id=property_id,
            channex_property_id=channex_property_id,
            portal_code=portal_code,
            settings=settings,
            channel_id=channel_id,
            is_active=is_active,
            last_error=activate_error,
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

        return {
            "id": channel_id,
            "portal": self._portal_labels[portal_code],
            "title": a.get("title") or title or self._portal_labels[portal_code],
            "is_active": is_active,
        }

    def _build_rate_plans(
        self, db: Client, tenant_id: str, portal_code: str,
        mappings: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """rate_plans-Array aus Mapping-Zeilen (gemeinsam von connect_channel und
        finalize_oauth_channel). Wirft bei unbekanntem Preisplan/Duplikat."""
        is_sandbox = portal_code == self._SANDBOX_CODE
        seen_pairs: set[tuple[Any, Any]] = set()
        rate_plans: list[dict[str, Any]] = []
        for m in mappings:
            channex_rate_plan_id = self._channex_rate_plan_id_for_map(
                db, tenant_id, m.get("rate_plan_map_id")
            )
            if not channex_rate_plan_id:
                raise ChannelManagerError(
                    "Unbekannter Preisplan in der Zuordnung.", status_code=422
                )
            if is_sandbox:
                room_code = m.get("room_type_code")
                rate_code = m.get("rate_plan_code")
            else:
                room_code = self._as_int(m.get("room_type_code"))
                rate_code = self._as_int(m.get("rate_plan_code"))
            if room_code is None or rate_code is None:
                raise ChannelManagerError(
                    "Zimmer-/Raten-Code fehlt oder ist ungültig.", status_code=422
                )
            pair = (room_code, rate_code)
            if pair in seen_pairs:
                raise ChannelManagerError(
                    "Eine OTA-Zimmer/Raten-Kombination darf nur einmal zugeordnet "
                    "werden.", status_code=422,
                )
            seen_pairs.add(pair)
            rate_plans.append(
                {
                    "rate_plan_id": channex_rate_plan_id,
                    "settings": {
                        "room_type_code": room_code,
                        "rate_plan_code": rate_code,
                        "occupancy": self._as_int(m.get("occupancy")) or 2,
                        "pricing_type": m.get("pricing_type") or "Standard",
                        "primary_occ": bool(m.get("primary_occ", True)),
                        "readonly": bool(m.get("readonly", False)),
                    },
                }
            )
        return rate_plans

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
            "portal": self._portal_labels.get(portal_code, "Kanal"),
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

    def _save_channel_connection(
        self, db: Client, tenant_id: str, *, property_id: str,
        channex_property_id: str, portal_code: str, settings: dict[str, Any],
        channel_id: str | None, is_active: bool, last_error: str | None,
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
                    "portal": self._portal_labels.get(code, "Kanal"),
                    "hotel_id": r.get("ota_hotel_id"),
                    "channel_id": r.get("channex_channel_id"),
                    "is_active": bool(r.get("is_active")),
                    "last_error": r.get("last_error"),
                    "updated_at": r.get("updated_at"),
                }
            )
        return out

    def _require_property_mapping(
        self, db: Client, tenant_id: str, property_id: str
    ) -> str:
        pm = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not pm.data:
            raise ChannelManagerError(
                "Objekt ist noch nicht mit dem Channel-Manager verbunden.",
                status_code=409,
            )
        return pm.data[0]["channex_property_id"]

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

    def _local_rate_plan_options(
        self, db: Client, tenant_id: str, channex_property_id: str
    ) -> list[dict[str, Any]]:
        """Gemappte Rate-Plans dieser Property (für die Zuordnungs-Auswahl)."""
        pm = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .limit(1)
            .execute()
        )
        if not pm.data:
            return []
        rts = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("property_map_id", pm.data[0]["id"])
            .is_("deleted_at", "null")
            .execute()
        )
        rt_ids = [r["id"] for r in (rts.data or [])]
        if not rt_ids:
            return []
        rps = (
            db.table("channex_rate_plan_map")
            .select("id, title")
            .in_("room_type_map_id", rt_ids)
            .is_("deleted_at", "null")
            .execute()
        )
        return [
            {"rate_plan_map_id": r["id"], "title": r.get("title") or "Preisplan"}
            for r in (rps.data or [])
        ]

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
        severity = "error" if event in self._ERROR_EVENTS else "info"
        if severity == "error":
            log.error(
                "channex_webhook_problem", webhook_event=event,
                tenant_id=tenant_id, property_id=property_id,
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
