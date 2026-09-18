"""Property-Mapping (CRUD) + Channex→DB-Reconcile.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.countries import normalize_country
from src.core.security import AuthContext

from .channex_client import ChannexClient, ChannexError
from .common import ChannelManagerError, ist_demo_mapping, log
from .schemas import (
    PropertyConnectRequest,
    PropertyMapListResponse,
    PropertyMapResponse,
)


def _normal(wert: object) -> str:
    """Adress-Text zum Vergleichen normieren (Groß/Klein, Leerraum)."""
    return " ".join(str(wert or "").split()).strip().lower()


def _ist_firmenadresse(
    attrs: dict[str, Any], firmenadresse: dict[str, Any] | None
) -> bool:
    """Ist die von Channex gelieferte Adresse die FIRMENADRESSE des Betriebs?

    Verglichen wird Straße + PLZ, beide normiert. Beide müssen übereinstimmen —
    eine gleiche PLZ allein bedeutet nur, dass Betrieb und Ferienhaus im selben
    Ort liegen (bei einem regionalen Vermieter der Normalfall) und wäre kein
    Grund, eine echte Hausadresse zu verwerfen.

    Ohne Firmenadresse (kein Firmenprofil) ist nichts zu vergleichen → False,
    also wird übernommen. Das ist bewusst nicht fail-closed: eine Adresse zu
    verwerfen, die wir nicht als Firmenadresse belegen können, würde echte Daten
    löschen.
    """
    if not firmenadresse:
        return False
    firma_strasse = _normal(firmenadresse.get("address"))
    firma_plz = _normal(firmenadresse.get("zip_code"))
    if not firma_strasse or not firma_plz:
        return False
    return (
        _normal(attrs.get("address")) == firma_strasse
        and _normal(attrs.get("zip_code")) == firma_plz
    )


class PropertyMappingMixin:
    """Property-Mapping (CRUD) + Channex→DB-Reconcile."""

    # -- Property-Mapping ------------------------------------------------------
    def list_property_maps(self, ctx: AuthContext) -> PropertyMapListResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        # KEIN Channex→DB-Abgleich am Seitenaufruf. Früher wurde hier je Aufruf
        # (und nach jeder Server-Action) ein Tenant-Reconcile eingereiht — das
        # erzeugte Channex-Requests im Takt der Klicks. Der Abgleich läuft jetzt
        # ausschließlich im Tages-Tick des Workers; die Seite zeigt den DB-Stand,
        # Änderungen kommen per Realtime nach.
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

    def _channex_verwaiste_abraeumen(
        self,
        db: Client,
        tenant_id: str,
        active: list[dict[str, Any]],
        live_by_id: dict[str, dict[str, Any]],
    ) -> int:
        """Bei Channex gefuehrt, bei uns archiviert/geloescht → dort entfernen.

        DER GRUND: Channex rechnet je gefuehrter Property ab. Fehlte dieser
        Lauf, blieb ein gekuendigtes Objekt dort auf Dauer stehen und kostete
        jeden Monat — und ein noch aktiver Kanal verkaufte weiter, waehrend von
        uns keine Pushes mehr kamen (Blindverkauf).

        Der Handgriff im Archivieren/Loeschen macht dasselbe sofort; DIESER Lauf
        ist das Netz darunter. Er greift, wenn das Abraeumen dort scheiterte
        (Channex nicht erreichbar, Kanal-Abbau 502) oder wenn ein Objekt auf
        einem Weg verschwand, der die Abraeumung nicht kennt. Bei einem Betrieb
        faellt so ein Fall auf, bei tausend nicht — deshalb automatisch.

        Gibt die Zahl der abgeraeumten Properties zurueck. Wirft nicht: ein
        Fehler hier darf den uebrigen Abgleich nicht kippen (Wurzel 5), er steht
        im Log.
        """
        # Nur Maps, deren Property bei Channex WIRKLICH noch lebt — die anderen
        # hat der Zweig darueber schon geschlossen.
        kandidaten = [
            m for m in active if m["channex_property_id"] in live_by_id
        ]
        if not kandidaten:
            return 0
        eigene_ids = [m["property_id"] for m in kandidaten if m.get("property_id")]
        if not eigene_ids:
            return 0

        # Welche dieser Objekte sind noch gefuehrt? Alles, was hier NICHT
        # zurueckkommt, ist entweder geloescht (Zeile weg) oder archiviert.
        gefuehrt = {
            str(r["id"])
            for r in (
                db.table("properties")
                .select("id")
                .eq("tenant_id", tenant_id)
                .in_("id", eigene_ids)
                .is_("archived_at", "null")
                .execute()
            ).data or []
        }

        # Spaeter Import, kein Modul-Import: `properties` importiert seinerseits
        # aus diesem Slice — ein Zyklus.
        from src.features.properties.archiv import (  # noqa: PLC0415
            channex_abraeumen,
        )

        anzahl = 0
        for m in kandidaten:
            pid = str(m.get("property_id") or "")
            if not pid or pid in gefuehrt:
                continue
            try:
                befund = channex_abraeumen(db, tenant_id, pid)
            except Exception as exc:  # noqa: BLE001 — kippt den Abgleich nicht
                log.warning(
                    "reconcile_verwaiste_abraeumen_fehlgeschlagen",
                    tenant_id=tenant_id, property_id=pid, error=str(exc)[:200],
                )
                continue
            anzahl += 1
            # Auf INFO, nicht DEBUG: das ist eine Kostenaenderung am
            # Channex-Konto und muss im Betriebslog auffindbar sein.
            log.info(
                "reconcile_verwaiste_property_abgeraeumt",
                tenant_id=tenant_id,
                property_id=pid,
                channex_property_id=m["channex_property_id"],
                befund=befund,
            )
        return anzahl

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
        firmenadresse: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """Channex-Property-Attribute → properties-Spalten (invers zu
        _property_attrs). title ist NOT NULL → fehlt es, gibt None zurück
        (Property überspringen, KEIN Titel erfinden). Optionale Felder nur, wenn
        Channex sie liefert; sonst NULL/DB-Default (kein Fallback raten).
        property_type wird bewusst NICHT übernommen — Channex-Werte (apartment,
        hotel, …) entsprechen nicht dem lokalen property_type-Enum.

        `firmenadresse` schließt einen KREISLAUF, der live echten Schaden gemacht
        hat: hat ein Objekt keine eigene Adresse, sendet `_billing_property_attrs`
        die FIRMENADRESSE des Betriebs an Channex (nötig, weil Booking & Co. eine
        Property-Adresse zur Aktivierung verlangen). Channex speichert sie. Beim
        nächsten Reconcile kam sie hier zurück und wurde als HAUSADRESSE in die
        DB geschrieben — aus der Geschäftsadresse des Betriebs wurde die Adresse
        des Ferienhauses, und die ging an alle Portale raus.

        Live nachgewiesen am Beta-Betrieb: zwei von 18 Objekten trugen
        „Hirtshalsvej 21, 9881 Bindslev" (die Firmenadresse aus den AGB), obwohl
        das eine Haus tatsächlich in 9800 Hjørring steht. Niemand hatte das
        eingetippt — der Kreislauf hatte es erzeugt. Genau das ist Wurzel 4: ein
        Rückfallwert, der zur Tatsache wird.

        Stimmt die von Channex gelieferte Adresse mit der Firmenadresse überein,
        wird sie deshalb NICHT übernommen. Das Objekt behält seine leere Adresse —
        leer ist ehrlich, falsch ist Schaden.
        """
        title = attrs.get("title")
        if not title or not str(title).strip():
            return None
        row: dict[str, Any] = {"title": str(title).strip()}
        eigene = not _ist_firmenadresse(attrs, firmenadresse)
        if attrs.get("address") and eigene:
            row["address"] = attrs["address"]
        if attrs.get("city"):
            row["city"] = attrs["city"]
        if attrs.get("zip_code") and eigene:
            row["postal_code"] = attrs["zip_code"]
        if attrs.get("country"):
            # Invariante halten: properties.country ist IMMER ISO-2 (auch aus
            # dem Reverse-Import). Channex liefert bereits ISO-2; defensiv normen.
            row["country"] = normalize_country(attrs["country"]) or attrs["country"]
        # Koordinaten gehören zur Adresse: stammt die Adresse von der Firma, sind
        # es die Koordinaten der Geschäftsstelle. Die Karte auf der Objekt-Seite
        # zeigte damit auf das Büro statt auf das Ferienhaus.
        if attrs.get("latitude") is not None and eigene:
            row["lat"] = attrs["latitude"]
        if attrs.get("longitude") is not None and eigene:
            row["lng"] = attrs["longitude"]
        content = attrs.get("content") or {}
        if content.get("description"):
            row["description"] = content["description"]
        return row

    @staticmethod
    def _ensure_default_unit(
        db: Client, tenant_id: str, property_id: str, titel: str | None
    ) -> None:
        """Genau EINE Einheit für ein gespiegeltes Objekt sicherstellen (0265).

        Ein aus Channex gespiegeltes Objekt (Wechselkunde: Airbnb-Listing) ist
        ohne `property_units`-Zeile unverkäuflich — `create_reservation_atomic`
        (0275) lehnt jede Buchung mit 22023 ab, und `availability.unit_id` ist
        NOT NULL. Eine eingehende OTA-Buchung würde also ins Leere laufen.

        Bewusst KEIN Upsert: auf `property_units` liegt kein Unique-Index über
        (property_id, position) — ein `on_conflict` darauf wirft 42P10 (genau der
        Fehler, der `create_reservation_atomic` nach 0267 lahmgelegt hat).
        Stattdessen Existenzprüfung; damit bleibt der Reconcile idempotent
        (Wurzel 2), ohne bei einem Objekt mit MEHREREN Einheiten die zweite zu
        überschreiben.
        """
        vorhanden = (
            db.table("property_units")
            .select("id")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data
        if vorhanden:
            return
        db.table("property_units").insert(
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                # Der Objekttitel ist der sprechendste Name; fehlt er, bleibt es
                # bei der neutralen "1" statt einer erfundenen Bezeichnung.
                "name": titel or "1",
                "position": 0,
            }
        ).execute()
        log.info(
            "reconcile_default_unit_created",
            tenant_id=tenant_id, property_id=property_id,
        )

    def _map_verknuepfen(
        self,
        db: Client,
        *,
        tenant_id: str,
        property_id: str,
        channex_id: str,
        now: str,
        map_id: str | None,
        zuruecknehmen: bool,
    ) -> None:
        """Die Map-Zeile eines frisch gespiegelten Objekts schreiben.

        Bewusst KEIN Upsert auf `channex_property_id`: die Spalte ist seit 0158
        NICHT mehr unique. Ein Hotel ist bei Channex EINE Property mit n
        Room-Types, also zeigen n Map-Zeilen auf dieselbe ID (dieselbe Begründung
        steht in `content_sync`). Ein `on_conflict` darauf wirft 42P10 — es gibt
        schlicht keinen passenden Index mehr.

        Live passiert am 17.09.2026: der Tenant-Reconcile starb an genau dieser
        Zeile, und zwar NACH dem Anlegen des Objekts. Die Map-Zeile fehlte
        dadurch, der nächste Versuch fand kein Mapping und legte wieder eines an
        — zehn Wiederholungen (`_BACKOFF_MINUTES`) ergaben zehn gleichnamige
        Karteileichen in der Inserate-Liste des Betriebs. Zwei Mandanten
        gleichzeitig betroffen.

        Geschrieben wird deshalb über den Schlüssel, der WIRKLICH eindeutig ist:
        die Map-Zeile je Objekt (`channex_property_map_property_uidx`, partiell
        auf `deleted_at is null`). Ein reaktiviertes Mapping wird per `id`
        aktualisiert, ein neues eingefügt.
        """
        zeile = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "channex_property_id": channex_id,
            "sync_enabled": True,
            "last_sync_status": "ok",
            "last_sync_at": now,
            "deleted_at": None,
        }
        try:
            self._map_zeile_schreiben(
                db, tenant_id, property_id, zeile, map_id=map_id
            )
        except APIError:
            if zuruecknehmen:
                self._halbes_objekt_zuruecknehmen(
                    db, tenant_id, property_id, channex_id
                )
            raise

    @staticmethod
    def _map_zeile_schreiben(
        db: Client,
        tenant_id: str,
        property_id: str,
        zeile: dict[str, Any],
        *,
        map_id: str | None,
    ) -> list[dict[str, Any]]:
        """Die Map-Zeile EINES Objekts schreiben: vorhandene aktualisieren,
        sonst anlegen.

        Geschrieben wird nie über `channex_property_id` (nicht eindeutig, s.
        `_map_verknuepfen`), sondern über die Zeile je Objekt.

        Der parallele Zweitaufruf ist real (Wurzel 2): zwei gleichzeitige
        Verbinden-Klicks für dasselbe Objekt kommen beide an der
        Existenzprüfung vorbei. Den zweiten fängt der partielle Unique-Index
        `channex_property_map_property_uidx` mit 23505 ab. Das ist kein Fehler,
        sondern „war schon da" — die vorhandene Zeile wird nachgelesen und
        zurückgegeben, statt dem Aufrufer einen 500 zu zeigen.
        """
        if map_id:
            return (
                db.table("channex_property_map")
                .update(zeile)
                .eq("id", map_id)
                .eq("tenant_id", tenant_id)
                .execute()
            ).data or []
        try:
            return (
                db.table("channex_property_map").insert(zeile).execute()
            ).data or []
        except APIError as exc:
            if "23505" not in str(exc):
                raise
            return (
                db.table("channex_property_map")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data or []

    @staticmethod
    def _halbes_objekt_zuruecknehmen(
        db: Client, tenant_id: str, property_id: str, channex_id: str
    ) -> None:
        """Ein eben angelegtes, noch unverknüpftes Objekt wieder entfernen.

        Der Gegenzustand zum Anlegen (Wurzel 1). Ohne ihn bleibt bei JEDEM
        Fehler zwischen Objekt und Mapping ein Entwurf stehen, den kein späterer
        Lauf wiederfindet: er trägt keine Channex-Kennung, also sieht der
        nächste Abgleich „kein Mapping" und legt das nächste an.

        Das Entfernen ist eng begrenzt und deshalb ungefährlich: die Zeile ist
        Sekunden alt, stammt aus DIESEM Lauf, steht auf `draft` und kann noch
        keine Buchung tragen. Die Einheit fällt per `ON DELETE CASCADE` mit.

        Best-effort: scheitert das Aufräumen, darf es den echten Fehler nicht
        verdecken (Wurzel 5) — er wird oben weitergereicht, hier bleibt eine
        laute Spur.
        """
        try:
            db.table("properties").delete().eq("id", property_id).eq(
                "tenant_id", tenant_id
            ).execute()
            log.warning(
                "reconcile_halbes_objekt_zurueckgenommen",
                tenant_id=tenant_id,
                property_id=property_id,
                channex_property_id=channex_id,
            )
        except Exception as exc:  # noqa: BLE001 — verdeckt den echten Fehler nicht
            log.error(
                "reconcile_zuruecknehmen_fehlgeschlagen",
                tenant_id=tenant_id,
                property_id=property_id,
                channex_property_id=channex_id,
                error=str(exc)[:200],
            )

    def reconcile_own_tenant(self, ctx: AuthContext) -> dict[str, int]:
        """Channex→DB-Spiegelung für den Tenant aus dem JWT sofort ausführen
        (On-Demand aus dem Onboarding-Import). Tenant-Scope aus dem Kontext, dann
        an reconcile_properties_for_tenant delegieren."""
        return self.reconcile_properties_for_tenant(self._require_tenant(ctx))

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

        # Kanal-Verbindungen ZUERST abgleichen (Gegenzustand, Wurzel 1): ein bei
        # Channex gelöschter/aufgeräumter OTA-Kanal MUSS lokal geschlossen werden,
        # sonst zeigt der Channel-Manager „verbunden" für einen Kanal, den es nicht
        # mehr gibt. Bewusst VOR dem budget-intensiven Property-/ARI-Reconcile: ein
        # einzelner GET /channels ist billig und darf nicht daran scheitern, dass
        # das Channex-Budget später von ARI-Pushes aufgebraucht wird. Best-effort,
        # fail-closed (bei Channex-Ausfall wird nichts geschlossen).
        try:
            self._reconcile_channel_connections(db, tenant_id)
        except Exception as exc:  # noqa: BLE001 — kippt den Reconcile nicht
            log.warning(
                "reconcile_channel_connections_failed",
                tenant_id=tenant_id, error=str(exc)[:200],
            )

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

        # Einmal je Reconcile geladen, nicht je Property: die Firmenadresse ist
        # tenant-weit dieselbe. Sie dient nur dem Vergleich — kommt sie von
        # Channex zurück, ist sie NICHT die Adresse des Hauses (siehe
        # `_channex_attrs_to_property_row`).
        firmenadresse = self._billing_property_attrs(db, tenant_id)

        for channex_id, attrs in live_by_id.items():
            row = self._channex_attrs_to_property_row(attrs, firmenadresse)
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
                    .select("id, archived_at")
                    .eq("id", soft[0]["property_id"])
                    .eq("tenant_id", tenant_id)
                    .limit(1)
                    .execute()
                ).data
                # ARCHIVIERTE Objekte NICHT reaktivieren (0416).
                #
                # Ohne diese Prüfung macht der Abgleich das Archivieren
                # rückgängig: die Property existiert bei Channex noch (das
                # Löschen dort kann fehlschlagen oder Channex räumt erst nach
                # 90 Tagen), der Abgleich findet sie „live", reanimiert das
                # Mapping und spiegelt die Inhalte zurück — das gekündigte
                # Objekt wäre wieder verbunden und würde weiter abgerechnet.
                # Der Betrieb hätte es archiviert und es käme von allein zurück.
                if prop and not prop[0].get("archived_at"):
                    reuse_property_id = prop[0]["id"]
                elif prop:
                    log.info(
                        "reconcile_skip_archiviert",
                        tenant_id=tenant_id,
                        property_id=prop[0]["id"],
                        channex_property_id=channex_id,
                    )
                    skipped += 1
                    continue

            if reuse_property_id:
                db.table("properties").update(row).eq(
                    "id", reuse_property_id
                ).eq("tenant_id", tenant_id).execute()
                property_id = reuse_property_id
            else:
                row["tenant_id"] = tenant_id
                # Aus Channex reingespiegeltes Objekt: status bleibt DB-Default
                # 'draft', damit es nicht ungeprüft verkauft wird. Der Marktplatz
                # ist seit 0527 Pflichtkanal (immer true) — sichtbar wird das
                # Objekt dort erst über publish() UND die Freigabe des Betreibers
                # (moderation_status), nicht über dieses Flag.
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

            # EINHEIT (0265) — sonst ist das gespiegelte Objekt unverkäuflich.
            # Eine `properties`-Zeile ist ein Einheiten-TYP; verkauft wird die
            # EINHEIT. Ohne `property_units`-Zeile lehnt
            # `create_reservation_atomic` (0275) jede Buchung mit 22023 ab —
            # also käme eine eingehende Airbnb-Buchung für ein frisch
            # gespiegeltes Objekt nicht an. Genau der Weg, den ein Wechselkunde
            # geht: Listing spiegeln → Buchung kommt rein → nichts passiert.
            # Der Reconcile ist idempotent, das Anlegen der Einheit muss es
            # auch sein (Wurzel 2) — per Existenzprüfung, NICHT per Upsert;
            # warum, steht in `_ensure_default_unit`.
            self._ensure_default_unit(db, tenant_id, property_id, row.get("title"))

            self._map_verknuepfen(
                db,
                tenant_id=tenant_id,
                property_id=property_id,
                channex_id=channex_id,
                now=now,
                map_id=soft[0]["id"] if reuse_property_id and soft else None,
                zuruecknehmen=not reuse_property_id,
            )
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

        # DIE GEGENRICHTUNG: bei Channex noch da, bei uns archiviert/weg.
        #
        # Bis hierher kannte der Abgleich nur „Channex weg → Map schliessen".
        # Der umgekehrte Fall fehlte vollstaendig — und genau der kostet Geld:
        # Channex rechnet je gefuehrter Property ab. Ein gekuendigtes Objekt
        # blieb dort auf Dauer stehen, ohne dass es irgendwo auffiel.
        #
        # Warum ein WAECHTER und nicht nur der Handgriff im Archivieren: das
        # Abraeumen dort kann scheitern (Channex nicht erreichbar, Kanal-Abbau
        # 502) — dann bleibt die Property stehen und niemand merkt es. Bei einem
        # Betrieb faellt das auf, bei tausend nicht. Dieser Lauf holt jeden
        # solchen Fall beim naechsten Tick nach, ohne dass jemand etwas tun muss.
        #
        # `archived_at` UND „Objekt-Zeile ganz weg" gelten gleich: beides heisst
        # „wird nicht mehr geführt". Bewusst NICHT `status='draft'` — ein Entwurf
        # ist ein Objekt in Arbeit, kein aufgegebenes.
        aufgeraeumt = self._channex_verwaiste_abraeumen(
            db, tenant_id, active, live_by_id
        )
        if aufgeraeumt:
            soft_deleted += aufgeraeumt

        # Preis-Abgleich je noch aktivem Objekt: DB-Soll vs. lokaler Schatten des
        # zuletzt Gepushten (channex_ari_shadow, 0246) → nur die Differenz pushen.
        # Liest NICHT bei Channex (Push-only, siehe ari_push.reconcile_rate_plan_
        # prices). Ohne Differenz entstehen hier null Channex-Requests.
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

        # Gäste-Chat nachziehen: Objekte, die vor der Automatik verbunden wurden
        # (oder deren Freischaltung beim Verbinden fehlschlug), bekommen sie hier.
        # Ein GET + höchstens ein POST je fehlendem Objekt — best effort.
        self._chat_nachziehen(
            [m["channex_property_id"] for m in active if m["channex_property_id"] in live_by_id]
        )

        return {
            "created": created,
            "updated": updated,
            "soft_deleted": soft_deleted,
            "skipped": skipped,
        }

    def _chat_nachziehen(self, channex_property_ids: list[str]) -> None:
        """Fehlende Chat-Freischaltungen nachholen (Selbstheilung des Reconcile).

        Ohne das bliebe ein Objekt, dessen Freischaltung beim Verbinden einmal
        gescheitert ist, für immer stumm — und niemand würde es merken, weil
        Buchungen weiter ankommen.
        """
        offen = [p for p in channex_property_ids if p and not ist_demo_mapping(p)]
        if not offen or not self._channex.is_configured:
            return
        try:
            installiert = self._channex.list_installed_applications().get("data") or []
        except ChannexError as exc:
            log.warning("chat_app_list_failed", error=exc.message)
            return
        aktiv = {
            str((row.get("attributes") or {}).get("property_id"))
            for row in installiert
            if ((row.get("attributes") or {}).get("application_code")
                or (row.get("attributes") or {}).get("code")) == ChannexClient.CHAT_APP_CODE
        }
        for channex_property_id in offen:
            if channex_property_id in aktiv:
                continue
            self._chat_freischalten(channex_property_id)

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
            res_channels = self._channex.list_channels()
            data = res_channels.get("data") or []
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
        # FAIL-CLOSED gegen eine unvollständige Liste (Wurzel 5).
        #
        # Diese Methode LÖSCHT Verbindungen — sie setzt `channex_channel_id` auf
        # NULL, und danach steht das Objekt in der Oberfläche auf „nicht
        # verbunden". Eine zu kurze Liste ist deshalb kein Schönheitsfehler,
        # sondern Datenverlust: `list_channels()` ging ohne Seitenangabe raus und
        # lieferte zehn statt fünfzehn Kanäle, worauf vier Objekte geschlossen
        # wurden, deren Kanäle bei Channex aktiv liefen (live 10.08.2026).
        #
        # Die Pagination ist im Client behoben. Hier steht der Riegel dahinter:
        # Wenn Channex weniger Zeilen liefert, als es selbst als `total` meldet,
        # ist die Liste NICHT vollständig — dann wird nichts geschlossen. Lieber
        # eine verwaiste Zeile stehen lassen (der nächste Lauf räumt sie) als
        # eine lebende Verbindung kappen.
        gesamt = (res_channels.get("meta") or {}).get("total")
        if isinstance(gesamt, int) and len(data) < gesamt:
            log.warning(
                "reconcile_channels_liste_unvollstaendig",
                tenant_id=tenant_id, geliefert=len(data), gesamt=gesamt,
            )
            return

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

    def seed_ari_shadow_all_tenants(self) -> dict[str, Any]:
        """Den ARI-Schatten (0246) für alle gemappten Objekte einmalig aus dem
        Soll befüllen — reiner DB-Vorgang, kein einziger Channex-Request.
        Ein Objekt-Fehler bricht den Lauf nicht ab."""
        totals: dict[str, Any] = {"properties": 0, "rate_plans": 0, "days": 0}
        if self._db is None:
            return totals
        rows = (
            self._db.table("channex_property_map")
            .select("tenant_id, property_id")
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        for r in rows:
            try:
                res = self.seed_ari_shadow(r["tenant_id"], r["property_id"])
            except Exception as exc:  # noqa: BLE001 — ein Objekt kippt den Lauf nicht
                log.warning(
                    "seed_ari_shadow_failed",
                    tenant_id=r["tenant_id"], property_id=r["property_id"],
                    error=str(exc)[:200],
                )
                continue
            totals["properties"] += 1
            totals["rate_plans"] += res["rate_plans"]
            totals["days"] += res["days"]
        log.info("seed_ari_shadow_all_done", **totals)
        return totals

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
                # KEIN periodischer ARI-Import mehr: import_ari_for_property las je
                # Property die komplette Verfügbarkeit/Preiskurve aus Channex
                # zurück. Channex hat genau das untersagt („push only changes …
                # you are the source of truth"). Der Import läuft nur noch dort,
                # wo er fachlich nötig ist: beim Verbinden/Re-Aktivieren eines
                # Objekts (channels.py, oauth_channels.py). Laufende Änderungen
                # kommen als Push von uns, Buchungen per Webhook/Revisions-Feed.
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

        # Fremdübernahme verhindern: ohne diese Prüfung hängte ein Tenant per
        # client-übergebener external_property_ref sein Objekt an die
        # Channex-Property eines FREMDEN Tenants. Belegt eine noch nicht
        # gelöschte Zeile eines anderen Tenants diese ID → 409. Innerhalb EINES
        # Tenants ist die Mehrfachnutzung dagegen erlaubt und gewollt (Hotel:
        # n Zimmertypen unter einer Channex-Property, 0158).
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
        # KEIN Upsert auf `channex_property_id` — seit 0158 ohne eindeutigen
        # Index, ein `on_conflict` darauf wirft 42P10 (Begründung und Vorfall in
        # `_map_verknuepfen`). Eindeutig ist die Zeile je OBJEKT, also wird
        # danach gesucht und dann aktualisiert oder eingefügt.
        vorhanden = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", req.property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        saved = self._map_zeile_schreiben(
            db, tenant_id, req.property_id, row,
            map_id=vorhanden[0]["id"] if vorhanden else None,
        )
        if not saved:
            raise ChannelManagerError("Mapping konnte nicht gespeichert werden.", status_code=500)
        self._chat_freischalten(channex_id)
        return self._to_property_map(saved[0])

    def _chat_freischalten(self, channex_property_id: str) -> None:
        """Gäste-Chat der Portale für ein frisch verbundenes Objekt einschalten.

        Der Chat ist bei Channex eine Anwendung, die JE PROPERTY installiert sein
        muss — ohne sie antwortet die Nachrichten-API mit 403 und der Posteingang
        bleibt bei jeder Buchung stumm. Das ist Teil des Dienstes, den der Betrieb
        bei uns bucht, also gehört es an das Verbinden und nicht an einen Knopf,
        den jemand suchen und verstehen muss.

        Best effort: eine fehlgeschlagene Freischaltung darf das Verbinden nicht
        umwerfen (die Distribution funktioniert auch ohne Chat) — sie wird
        geloggt und beim nächsten Reconcile nachgeholt. Idempotent: Channex
        antwortet auf eine erneute Installation ohne Nebenwirkung, doppelt
        angelegt wird nichts (Wurzel 2).
        """
        if ist_demo_mapping(channex_property_id) or not self._channex.is_configured:
            return
        try:
            self._channex.install_application(
                channex_property_id=channex_property_id,
                application_code=ChannexClient.CHAT_APP_CODE,
            )
        except ChannexError as exc:
            log.warning(
                "chat_app_install_failed",
                channex_property_id=channex_property_id,
                error=exc.message,
                channex_status=exc.channex_status,
            )

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
