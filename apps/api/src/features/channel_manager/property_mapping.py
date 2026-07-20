"""Property-Mapping (CRUD) + Channex→DB-Reconcile.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.countries import normalize_country
from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import ChannelManagerError, log
from .schemas import (
    PropertyConnectRequest,
    PropertyMapListResponse,
    PropertyMapResponse,
)


class PropertyMappingMixin:
    """Property-Mapping (CRUD) + Channex→DB-Reconcile."""


    # -- Property-Mapping ------------------------------------------------------
    def list_property_maps(self, ctx: AuthContext) -> PropertyMapListResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        # Channex→DB-Abgleich NICHT inline im Request: der volle Tenant-Reconcile
        # (Channex-Liste + Preis-Reconcile je Objekt inkl. Channex-Reads) lief
        # früher bei JEDEM Seitenaufbau und nach jeder Server-Action erneut —
        # sichtbare Request-Flut und er fraß das Channex-API-Budget der echten
        # Pushes leer. Stattdessen koalesziert als Job einreihen (Dedup je
        # 15-min-Fenster, wie der Worker-Tick); die Seite zeigt den DB-Stand,
        # Änderungen kommen per Realtime nach.
        try:
            import time

            from src.jobs.queue import enqueue

            bucket = int(time.time() // 900)
            enqueue(
                db, "reconcile_tenant", tenant_id=tenant_id,
                payload={"tenant_id": tenant_id},
                dedup_key=f"reconcile_tick:{tenant_id}:{bucket}",
            )
        except Exception as exc:  # noqa: BLE001 — Einreihen kippt die Seite nie
            log.warning(
                "reconcile_enqueue_on_pageview_failed",
                tenant_id=tenant_id, error=str(exc)[:200],
            )

        res = (
            db.table("channex_property_map")
            .select("*")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        )
        rows = res.data or []
        # Objekt-Titel nachladen (für die UI; ersetzt die interne Provider-ID).
        # titles enthält NUR noch existierende Properties dieses Tenants.
        titles = self._property_titles(db, tenant_id, [r["property_id"] for r in rows])

        # Lokale Waise (Property gelöscht, Map blieb stehen) → ausblenden + soft-
        # löschen. Die Channex-Seite des Abgleichs erledigt der Reconcile oben.
        orphan_ids = [r["id"] for r in rows if r["property_id"] not in titles]
        if orphan_ids:
            db.table("channex_property_map").update(
                {"deleted_at": datetime.now(UTC).isoformat(), "sync_enabled": False}
            ).in_("id", orphan_ids).eq("tenant_id", tenant_id).execute()
            log.info(
                "channex_property_map_orphans_pruned",
                tenant_id=tenant_id,
                count=len(orphan_ids),
            )

        orphan_set = set(orphan_ids)
        items = [
            self._to_property_map(r, titles[r["property_id"]])
            for r in rows
            if r["id"] not in orphan_set
        ]
        return PropertyMapListResponse(items=items, total=len(items))

    # -- Channex→DB Spiegelung (1:1-Reconcile, Channex = Quelle der Wahrheit) ---
    def _tenant_group_id(self, db: Client, tenant_id: str) -> str | None:
        """channex_group_id des Tenants (oder None). Non-raising — anders als
        _require_group, das beim Channel-Create einen 409 wirft."""
        res = (
            db.table("channex_group_map")
            .select("channex_group_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        return res.data[0]["channex_group_id"] if res.data else None

    def _live_channex_properties_for_group(
        self, group_id: str
    ) -> list[dict[str, Any]] | None:
        """Alle Channex-Property-Objekte (id + attributes) EINER Group über alle
        Seiten. Gibt None zurück, wenn Channex nicht erreichbar/konfiguriert ist
        — der Aufrufer ändert dann NICHTS (kein Datenverlust bei Ausfall)."""
        if not self._channex.is_configured:
            return None
        out: list[dict[str, Any]] = []
        page = 1
        try:
            while True:
                resp = self._channex.list_properties(
                    page=page, limit=100, group_id=group_id
                )
                data = resp.get("data") or []
                out.extend(data)
                # Channex paginiert über total/limit/page (kein total_pages).
                meta = resp.get("meta") or {}
                total = meta.get("total") or 0
                limit = meta.get("limit") or 100
                if not data or page * limit >= total:
                    break
                page += 1
        except ChannexError as exc:
            log.warning(
                "channex_list_group_properties_failed",
                group_id=group_id,
                error=exc.message,
            )
            return None
        return out

    @staticmethod
    def _sync_stamp_stale(existing: dict[str, Any], now_iso: str) -> bool:
        """True, wenn der ok-Stempel der Map aufgefrischt werden darf: Status war
        nicht 'ok' ODER der letzte Stempel ist älter als das 15-min-Dedup-Fenster.
        Häufigeres Stempeln triggerte über Realtime-Refresh der Kanäle-Seite eine
        Reconcile-Endlosschleife."""
        if existing.get("last_sync_status") != "ok":
            return True
        last = existing.get("last_sync_at")
        if not last:
            return True
        try:
            last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
            now_dt = datetime.fromisoformat(now_iso)
        except ValueError:
            return True
        return (now_dt - last_dt).total_seconds() >= 900

    @staticmethod
    def _channex_attrs_to_property_row(
        attrs: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Channex-Property-Attribute → properties-Spalten (invers zu
        _property_attrs). title ist NOT NULL → fehlt es, gibt None zurück
        (Property überspringen, KEIN Titel erfinden). Optionale Felder nur, wenn
        Channex sie liefert; sonst NULL/DB-Default (kein Fallback raten).
        property_type wird bewusst NICHT übernommen — Channex-Werte (apartment,
        hotel, …) entsprechen nicht dem lokalen property_type-Enum."""
        title = attrs.get("title")
        if not title or not str(title).strip():
            return None
        row: dict[str, Any] = {"title": str(title).strip()}
        if attrs.get("address"):
            row["address"] = attrs["address"]
        if attrs.get("city"):
            row["city"] = attrs["city"]
        if attrs.get("zip_code"):
            row["postal_code"] = attrs["zip_code"]
        if attrs.get("country"):
            # Invariante halten: properties.country ist IMMER ISO-2 (auch aus
            # dem Reverse-Import). Channex liefert bereits ISO-2; defensiv normen.
            row["country"] = normalize_country(attrs["country"]) or attrs["country"]
        if attrs.get("latitude") is not None:
            row["lat"] = attrs["latitude"]
        if attrs.get("longitude") is not None:
            row["lng"] = attrs["longitude"]
        content = attrs.get("content") or {}
        if content.get("description"):
            row["description"] = content["description"]
        return row

    def reconcile_properties_for_tenant(self, tenant_id: str) -> dict[str, int]:
        """Spiegelt Channex→DB für EINEN Tenant (Channex = Wahrheit). Idempotent
        über channex_property_id. Channex-Ausfall → keine Änderung. Spiegelt
        Existenz UND Inhalte (Titel/Adresse/Koordinaten); lokale-nur-Felder
        (Fotos, Ausstattung, Preise, max_guests, status) bleiben unberührt."""
        zero = {"created": 0, "updated": 0, "soft_deleted": 0, "skipped": 0}
        if not self._channex.is_configured or self._db is None:
            return zero
        db = self._db

        group_id = self._tenant_group_id(db, tenant_id)
        if not group_id:
            return zero

        live = self._live_channex_properties_for_group(group_id)
        if live is None:
            return zero  # Channex nicht erreichbar → NICHTS anlegen/löschen.
        live_by_id = {
            p["id"]: (p.get("attributes") or {}) for p in live if p.get("id")
        }

        # Aktive Maps des Tenants (inkl. Sync-Stempel für den Nur-bei-Änderung-
        # Schreibpfad unten).
        active = (
            db.table("channex_property_map")
            .select("id, property_id, channex_property_id, last_sync_at,"
                    " last_sync_status")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        active_by_channex = {m["channex_property_id"]: m for m in active}

        now = datetime.now(UTC).isoformat()
        created = updated = soft_deleted = skipped = 0

        for channex_id, attrs in live_by_id.items():
            row = self._channex_attrs_to_property_row(attrs)
            if row is None:
                log.warning(
                    "reconcile_skip_no_title",
                    tenant_id=tenant_id,
                    channex_property_id=channex_id,
                )
                skipped += 1
                continue

            existing = active_by_channex.get(channex_id)
            if existing:
                # Inhalte spiegeln, ABER nur Felder, die CHANNEX führt. title und
                # description führt der NUTZER lokal (Wurzel 1) — Channex ist dafür
                # NICHT die Wahrheit. Sie hier zu überschreiben zementierte jeden an
                # Channex geleakten Falschwert dauerhaft in die DB (der „Unbenannt"-
                # Bug). Ein BESTEHENDES Objekt behält daher seinen lokalen Namen/Text.
                mirror = {
                    k: v for k, v in row.items()
                    if k not in ("title", "description")
                }
                # NUR bei echter Abweichung schreiben: Die Seite /channels lauscht
                # per Realtime auf channex_property_map/properties und lädt bei
                # jedem Write die Server-Components neu — deren GET reiht wieder
                # einen Reconcile ein. Ein bedingungsloser Stempel je Lauf machte
                # daraus eine Endlosschleife (Job alle ~2 s). No-op-Läufe müssen
                # deshalb schreibfrei bleiben; der ok-Stempel wird höchstens alle
                # 15 min aufgefrischt (Job-Dedup-Fenster).
                if mirror:
                    cur = (
                        db.table("properties")
                        .select(", ".join(mirror))
                        .eq("id", existing["property_id"])
                        .eq("tenant_id", tenant_id)
                        .limit(1)
                        .execute()
                    ).data
                    if not cur or any(
                        cur[0].get(k) != v for k, v in mirror.items()
                    ):
                        db.table("properties").update(mirror).eq(
                            "id", existing["property_id"]
                        ).eq("tenant_id", tenant_id).execute()
                if self._sync_stamp_stale(existing, now):
                    db.table("channex_property_map").update(
                        {"last_sync_at": now, "last_sync_status": "ok"}
                    ).eq("id", existing["id"]).execute()
                updated += 1
                continue

            # Kein aktives Mapping → evtl. soft-gelöschtes mit lebender Property
            # reaktivieren, sonst neu anlegen.
            soft = (
                db.table("channex_property_map")
                .select("id, property_id")
                .eq("tenant_id", tenant_id)
                .eq("channex_property_id", channex_id)
                .not_.is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            reuse_property_id = None
            if soft:
                prop = (
                    db.table("properties")
                    .select("id")
                    .eq("id", soft[0]["property_id"])
                    .eq("tenant_id", tenant_id)
                    .limit(1)
                    .execute()
                ).data
                if prop:
                    reuse_property_id = prop[0]["id"]

            if reuse_property_id:
                db.table("properties").update(row).eq(
                    "id", reuse_property_id
                ).eq("tenant_id", tenant_id).execute()
                property_id = reuse_property_id
            else:
                row["tenant_id"] = tenant_id
                # Aus Channex reingespiegeltes Objekt gehört NICHT automatisch auf
                # den eigenen Marktplatz (0159): status bleibt DB-Default 'draft'
                # UND der Marktplatz-Kanal bleibt aus. Sonst würde ein späterer
                # manueller status='active' das Objekt sofort listen, obwohl der
                # Betreiber die Marktplatz-Listung nie bewusst gewählt hat. Die
                # OTA-Seite (Channex) ist über das Mapping ohnehin schon aktiv.
                row["listed_on_marketplace"] = False
                ins = db.table("properties").insert(row).execute()
                if not ins.data:
                    log.error(
                        "reconcile_property_insert_failed",
                        tenant_id=tenant_id,
                        channex_property_id=channex_id,
                    )
                    skipped += 1
                    continue
                property_id = ins.data[0]["id"]

            db.table("channex_property_map").upsert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "channex_property_id": channex_id,
                    "sync_enabled": True,
                    "last_sync_status": "ok",
                    "last_sync_at": now,
                    "deleted_at": None,
                },
                on_conflict="channex_property_id",
            ).execute()
            created += 1
            log.info(
                "reconcile_property_created",
                tenant_id=tenant_id,
                channex_property_id=channex_id,
            )

        # Channex-Property weg → Map soft-löschen.
        orphan_ids = [
            m["id"] for m in active if m["channex_property_id"] not in live_by_id
        ]
        if orphan_ids:
            db.table("channex_property_map").update(
                {"deleted_at": now, "sync_enabled": False}
            ).in_("id", orphan_ids).eq("tenant_id", tenant_id).execute()
            soft_deleted = len(orphan_ids)
            log.info(
                "reconcile_maps_soft_deleted",
                tenant_id=tenant_id,
                count=soft_deleted,
            )

        # Kanal-Verbindungen abgleichen (Gegenzustand, Wurzel 1): ein bei Channex
        # gelöschter/verschwundener OTA-Kanal (z. B. aufgeräumter Test-Kanal) MUSS
        # lokal geschlossen werden, sonst zeigt der Channel-Manager „verbunden" für
        # einen Kanal, den es nicht mehr gibt. Best-effort, fail-closed.
        try:
            self._reconcile_channel_connections(db, tenant_id)
        except Exception as exc:  # noqa: BLE001 — kippt den Reconcile nicht
            log.warning(
                "reconcile_channel_connections_failed",
                tenant_id=tenant_id, error=str(exc)[:200],
            )

        # Desired-State-Abgleich der Rate-Plan-Datumspreise je noch aktivem Objekt:
        # DB-Soll vs. autoritativer Channex-Ist → Differenz pushen (selbstheilend).
        # Best-effort pro Objekt (ein Objekt-Fehler kippt nicht den Tenant-Reconcile).
        for m in active:
            if m["channex_property_id"] not in live_by_id:
                continue  # gerade soft-gelöscht
            try:
                self.reconcile_rate_plan_prices(tenant_id, m["property_id"])
            except Exception as exc:  # noqa: BLE001 — ein Objekt darf den Tick nicht kippen
                log.warning(
                    "reconcile_rate_prices_property_failed",
                    tenant_id=tenant_id,
                    property_id=m["property_id"],
                    error=str(exc)[:200],
                )

        return {
            "created": created,
            "updated": updated,
            "soft_deleted": soft_deleted,
            "skipped": skipped,
        }

    def _reconcile_channel_connections(self, db: Client, tenant_id: str) -> None:
        """Lokale OTA-Kanal-Verbindungen gegen die AUTORITATIVE Channex-Liste
        abgleichen. Ein Kanal, den Channex nicht (mehr) kennt, wird lokal
        geschlossen (channex_channel_id genullt, deaktiviert) — Gegenzustand zu
        „Kanal existiert" (Wurzel 1). Ein aufgeräumter Zertifizierungs-/Test-Kanal
        oder ein im Channex-UI entfernter Kanal darf im PMS nicht als „verbunden"
        stehenbleiben.

        FAIL-CLOSED gegen Datenverlust: die lokale Zeile wird NUR geschlossen, wenn
        wir die Channex-Kanalliste sicher (erreichbar) gelesen haben. Ein Channex-
        Ausfall/Netzfehler darf NIE alle Verbindungen kappen (Wurzel 5) — bei
        Fehler wird nichts angefasst."""
        local = (
            db.table("channex_channel_connection")
            .select("id, channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .not_.is_("channex_channel_id", "null")
            .execute()
        ).data or []
        if not local:
            return

        # Channex ist die Quelle der Wahrheit. Bei Ausfall NICHT schließen.
        try:
            data = self._channex.list_channels().get("data") or []
        except ChannexError as exc:
            log.warning(
                "reconcile_channels_list_unreachable",
                tenant_id=tenant_id, error=exc.message,
            )
            return
        live_channel_ids = {
            ch.get("id") or (ch.get("attributes") or {}).get("id")
            for ch in data
        }

        orphan_ids = [
            row["id"]
            for row in local
            if row["channex_channel_id"] not in live_channel_ids
        ]
        if not orphan_ids:
            return
        db.table("channex_channel_connection").update(
            {"is_active": False, "channex_channel_id": None}
        ).in_("id", orphan_ids).eq("tenant_id", tenant_id).execute()
        log.info(
            "reconcile_channel_connections_closed",
            tenant_id=tenant_id, count=len(orphan_ids),
        )

    def reconcile_all_tenants(self) -> dict[str, Any]:
        """Iteriert ALLE Tenants aus channex_group_map und spiegelt jeden einzeln.
        Ein Fehler pro Tenant bricht den Gesamtlauf nicht ab. Für den Cron."""
        totals: dict[str, Any] = {
            "tenants": 0,
            "created": 0,
            "updated": 0,
            "soft_deleted": 0,
            "skipped": 0,
            "errors": [],
        }
        if not self._channex.is_configured or self._db is None:
            return totals
        rows = (
            self._db.table("channex_group_map").select("tenant_id").execute()
        ).data or []
        for r in rows:
            tid = r["tenant_id"]
            try:
                res = self.reconcile_properties_for_tenant(tid)
                totals["tenants"] += 1
                for k in ("created", "updated", "soft_deleted", "skipped"):
                    totals[k] += res[k]
                # ARI laufend nachziehen: Preise/Verfügbarkeit/stop_sell je aktiver
                # Property dieses Tenants (idempotent; Fehler pro Property isoliert).
                active = (
                    self._db.table("channex_property_map")
                    .select("channex_property_id")
                    .eq("tenant_id", tid)
                    .is_("deleted_at", "null")
                    .execute()
                ).data or []
                for pm in active:
                    try:
                        self.import_ari_for_property(tid, pm["channex_property_id"])
                    except Exception as exc:  # noqa: BLE001
                        log.error(
                            "reconcile_ari_failed",
                            tenant_id=tid,
                            channex_property_id=pm["channex_property_id"],
                            error=str(exc),
                        )
            except Exception as exc:  # noqa: BLE001 — ein Tenant darf nicht killen
                totals["errors"].append(f"{tid}: {exc}")
                log.error("reconcile_tenant_failed", tenant_id=tid, error=str(exc))
        # Offene Verfügbarkeits-Pushes (ari_outbox) erneut versuchen (Retry).
        try:
            totals["ari_outbox"] = self.process_ari_outbox()
        except Exception as exc:  # noqa: BLE001
            log.error("ari_outbox_run_failed", error=str(exc))
        log.info(
            "reconcile_all_done",
            tenants=totals["tenants"],
            created=totals["created"],
            updated=totals["updated"],
            soft_deleted=totals["soft_deleted"],
            skipped=totals["skipped"],
        )
        return totals

    def _property_titles(
        self, db: Client, tenant_id: str, property_ids: list[str]
    ) -> dict[str, str]:
        if not property_ids:
            return {}
        res = (
            db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .in_("id", property_ids)
            .execute()
        )
        return {r["id"]: r.get("title") for r in (res.data or [])}

    def connect_property(
        self, ctx: AuthContext, req: PropertyConnectRequest
    ) -> PropertyMapResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        # Property muss dem Tenant gehören (Schutz vor Fremd-Referenzen).
        # properties hat KEINE currency-Spalte — die echte Objektwährung liegt im
        # Rate-Plan (Migration 0003, NOT NULL). Nicht EUR erfinden (Wurzel 4).
        prop = (
            db.table("properties")
            .select("id, title")
            .eq("id", req.property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not prop.data:
            raise ChannelManagerError("Property nicht gefunden.", status_code=404)
        local = prop.data[0]

        channex_id = req.external_property_ref
        if not channex_id:
            currency = req.currency or self._property_currency(db, req.property_id)
            if not currency:
                raise ChannelManagerError(
                    "Objektwährung fehlt (kein Preisplan) — bitte zuerst einen "
                    "Preisplan mit Währung anlegen.",
                    status_code=422,
                )
            # Neu in Channex anlegen.
            attributes = {
                "title": req.title or local.get("title") or "Unbenannt",
                "currency": currency.upper(),
            }
            try:
                created = self._channex.create_property(attributes)
            except ChannexError as exc:
                raise self._wrap_channex(exc) from exc
            channex_id = (created.get("data") or {}).get("id")
            if not channex_id:
                raise ChannelManagerError(
                    "Channex lieferte keine Property-ID zurück.", status_code=502
                )

        # Fremdübernahme verhindern: die channex_property_id ist im upsert der
        # Konflikt-Schlüssel (on_conflict="channex_property_id"). Ohne diese
        # Prüfung könnte ein Tenant per client-übergebener external_property_ref
        # das Mapping eines FREMDEN Tenants überschreiben/übernehmen. Belegt eine
        # noch nicht gelöschte Zeile eines anderen Tenants diese ID → 409.
        clash = (
            db.table("channex_property_map")
            .select("tenant_id")
            .eq("channex_property_id", channex_id)
            .is_("deleted_at", "null")
            .neq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if clash.data:
            raise ChannelManagerError(
                "Diese Channex-Property ist bereits einem anderen Konto "
                "zugeordnet.",
                status_code=409,
            )

        row = {
            "tenant_id": tenant_id,
            "property_id": req.property_id,
            "channex_property_id": channex_id,
            "sync_enabled": True,
            "last_sync_status": "ok",
        }
        saved = (
            db.table("channex_property_map")
            .upsert(row, on_conflict="channex_property_id")
            .execute()
        )
        if not saved.data:
            raise ChannelManagerError("Mapping konnte nicht gespeichert werden.", status_code=500)
        return self._to_property_map(saved.data[0])

    def disconnect_property(self, ctx: AuthContext, map_id: str) -> None:
        """Objekt von Channex trennen. Löschkette (Wurzel 1 — Gegenzustand):
        VOR dem Soft-Delete des Mappings alle Channex-Kanäle des Objekts
        deaktivieren — sonst verkauft die OTA weiter, während unsere Pushes
        aufhören (Blindverkauf → Overbooking). Schlägt eine Deaktivierung fehl,
        bricht die Trennung ab (fail-closed); Channex räumt die Property nach
        90 Tagen ohne Kanal selbst ab (Retention-Doku)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        row = (
            db.table("channex_property_map")
            .select("id, channex_property_id, channex_hotel_policy_id")
            .eq("id", map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not row:
            raise ChannelManagerError("Verbindung nicht gefunden.", status_code=404)
        channex_property_id = row[0].get("channex_property_id")
        if channex_property_id and self._channex.is_configured:
            try:
                channels = (
                    self._channex.list_channels(property_id=channex_property_id)
                    .get("data") or []
                )
                for ch in channels:
                    ch_id = ch.get("id") or (ch.get("attributes") or {}).get("id")
                    if ch_id:
                        self._channex.deactivate_channel(str(ch_id))
            except ChannexError as exc:
                raise ChannelManagerError(
                    "Trennung abgebrochen: Kanal-Deaktivierung bei Channex "
                    f"fehlgeschlagen ({exc.message}). Bitte erneut versuchen.",
                    status_code=502,
                ) from exc
            # Lokale Kanal-Verbindungen als inaktiv spiegeln (Gegenzustand).
            db.table("channex_channel_connection").update(
                {"is_active": False}
            ).eq("tenant_id", tenant_id).eq(
                "channex_property_id", channex_property_id
            ).execute()
            # Hotel Policy abräumen (Wurzel 1): die Policy gehört zur Property —
            # best effort, ein Fehler blockiert die Trennung nicht (Channex
            # räumt die Property nach 90 Tagen ohne Kanal ohnehin ab).
            policy_id = row[0].get("channex_hotel_policy_id")
            if policy_id:
                try:
                    self._channex.delete_hotel_policy(policy_id)
                except ChannexError as exc:
                    log.warning(
                        "hotel_policy_delete_failed",
                        policy_id=policy_id, error=exc.message,
                    )
        # channex_hotel_policy_id mit-nullen: die Policy wurde oben (falls
        # vorhanden) bei Channex gelöscht. Bliebe die ID stehen, würde ein
        # Reconnect dieselbe Map-Zeile reanimieren und content_sync riefe
        # update_hotel_policy(tote_id) → 404 → Content-Sync dauerhaft im Fehler.
        db.table("channex_property_map").update(
            {
                "deleted_at": datetime.now(UTC).isoformat(),
                "sync_enabled": False,
                "channex_hotel_policy_id": None,
            }
        ).eq("id", map_id).eq("tenant_id", tenant_id).execute()

    # -- Row → Schema ----------------------------------------------------------
    @staticmethod
    def _to_property_map(
        row: dict[str, Any], property_title: str | None = None
    ) -> PropertyMapResponse:
        return PropertyMapResponse(
            id=row["id"],
            property_id=row["property_id"],
            property_title=property_title,
            sync_enabled=row.get("sync_enabled", True),
            last_sync_at=row.get("last_sync_at"),
            last_sync_status=row.get("last_sync_status"),
            last_sync_error=row.get("last_sync_error"),
        )
