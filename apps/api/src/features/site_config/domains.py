"""Eigene Domains eines Betriebs: anlegen, mit Cloudflare abgleichen, entfernen.

Als MIXIN und nicht als eigener Dienst — dasselbe Muster und derselbe Grund wie
bei `BloeckeMixin`: der Router ruft `service.add_domain`, und ein zweiter
Dienst nur fuer Domains waere eine zweite Dependency, eine zweite Factory und
ein zweiter Ort, an dem man den Tenant-Scope vergessen kann.

Der Anlass war eine Zeilenzahl: `service.py` stand bei 1539 Zeilen und damit
ueber der Grenze, die `pylint` hier setzt (1500). Der Schnitt ist aber der
richtige — die Domains sind der einzige Teil des Slice, der einen FREMDEN
Dienst schreibt (Cloudflare Custom Hostnames). Sie haben deshalb als einzige
einen Rueckweg zu pflegen: schlaegt das Anlegen in unserer DB fehl, nachdem
Cloudflare den Hostnamen schon kennt, muss der dort wieder weg
(`_rollback_cf_hostname`) — sonst blockiert ein verwaister Eintrag die Domain
fuer immer (Wurzel 1).

Das Mixin setzt voraus, dass die Basisklasse `_db`, `_cf` und
`_require_tenant` mitbringt.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from src.core.logging import get_logger

from .cloudflare_client import CloudflareError
from .fehler import SiteConfigError
from .schemas import (
    CustomDomainListResponse,
    CustomDomainResponse,
    DnsRecord,
    DomainCreate,
    DomainStatus,
)

if TYPE_CHECKING:  # pragma: no cover — nur fuer die Typpruefung
    from src.core.security import AuthContext

log = get_logger("nextdays.site_config.domains")

#: Spalten einer Domain-Zeile. Aufgezaehlt und nicht `*`: eine neue Spalte soll
#: eine bewusste Entscheidung sein, keine automatische Mitlieferung.
_DOMAIN_COLS = (
    "id, tenant_id, domain, cf_custom_hostname_id, status, ssl_status, "
    "last_synced_at"
)


class DomainsMixin:
    """Die eigenen Domains eines Betriebs."""

    def list_domains(self, ctx: AuthContext) -> CustomDomainListResponse:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("tenant_custom_domains")
            .select(_DOMAIN_COLS)
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        ).data or []
        items = [self._domain_row(r) for r in rows]
        return CustomDomainListResponse(items=items, total=len(items))

    def add_domain(
        self, ctx: AuthContext, req: DomainCreate
    ) -> CustomDomainResponse:
        """Registriert eine Custom-Domain bei Cloudflare (TXT-SSL) und legt sie
        tenant-gescoped an. Gibt CNAME + TXT-Validierungs-Record zurück."""
        tenant_id = self._require_tenant(ctx)
        domain = req.domain  # bereits lowercase/validiert im Schema

        # Vorab-Prüfung gegen Doppelvergabe (DB-unique ist der harte Backstop).
        existing = (
            self._db.table("tenant_custom_domains")
            .select("id")
            .eq("domain", domain)
            .limit(1)
            .execute()
        ).data or []
        if existing:
            raise SiteConfigError("Domain ist bereits vergeben.", status_code=409)

        try:
            cf = self._cf.create_custom_hostname(domain)
        except CloudflareError as exc:
            raise SiteConfigError(exc.message, status_code=exc.status_code) from exc

        cf_id = cf.get("id")
        ssl = cf.get("ssl") or {}
        payload = {
            "tenant_id": tenant_id,
            "domain": domain,
            "cf_custom_hostname_id": cf_id,
            "status": DomainStatus.pending.value,
            "ssl_status": ssl.get("status"),
        }
        # Der CF-Hostname ist bereits angelegt. Schlägt der DB-Insert fehl (leere
        # Rückgabe ODER Unique-Verletzung durch eine parallele Registrierung —
        # die Vorab-Prüfung oben ist TOCTOU), würde er sonst als Waise bei
        # Cloudflare zurückbleiben (nie über remove_domain aufräumbar, blockiert
        # ggf. eine spätere legitime Registrierung). Daher: bei jedem Fehler den
        # CF-Hostname wieder löschen (best-effort), dann sauber melden.
        try:
            res = self._db.table("tenant_custom_domains").insert(payload).execute()
        except Exception as exc:  # noqa: BLE001 — DB-Fehler → CF-Rollback
            self._rollback_cf_hostname(cf_id)
            # Unique-Verletzung (parallele Registrierung) als 409 melden.
            if "duplicate" in str(exc).lower() or "unique" in str(exc).lower():
                raise SiteConfigError(
                    "Domain ist bereits vergeben.", status_code=409
                ) from exc
            raise SiteConfigError(
                "Domain konnte nicht gespeichert werden.", status_code=500
            ) from exc
        if not res.data:
            self._rollback_cf_hostname(cf_id)
            raise SiteConfigError(
                "Domain konnte nicht gespeichert werden.", status_code=500
            )
        row = res.data[0]
        return self._domain_row(row, dns_records=self._dns_records(domain, ssl))

    def _rollback_cf_hostname(self, cf_id: str | None) -> None:
        """Verwaisten Cloudflare-Custom-Hostname wieder entfernen (best-effort —
        ein Fehler beim Aufräumen darf den ursprünglichen Fehler nicht überdecken)."""
        if not cf_id:
            return
        try:
            self._cf.delete_custom_hostname(cf_id)
        except Exception as exc:  # noqa: BLE001
            log.warning("cf_hostname_rollback_failed", cf_id=cf_id, error=str(exc)[:200])

    def sync_domain(
        self, ctx: AuthContext, domain_id: str
    ) -> CustomDomainResponse:
        """Holt den aktuellen CF-Status und spiegelt ihn in die DB (pending→active
        /error).

        Kein Zwischenspeicher zu leeren: `resolve_site_by_domain` fragt bei
        jedem Aufruf die Datenbank. Der Satz „invalidiert den by-domain-Cache"
        stand hier, obwohl es diesen Cache nie gab — nachgeprüft am 24.08.2026
        gegen den ganzen Slice und gegen HEAD. Er bleibt hier als Warnung
        stehen: ein Kommentar, der eine Vorkehrung beschreibt, die es nicht
        gibt, ist gefährlicher als gar keiner — er beendet die Suche."""
        tenant_id = self._require_tenant(ctx)
        row = self._own_domain(tenant_id, domain_id)
        cf_id = row.get("cf_custom_hostname_id")
        if not cf_id:
            raise SiteConfigError(
                "Domain ist nicht mit Cloudflare verknüpft.", status_code=409
            )
        try:
            cf = self._cf.get_custom_hostname(cf_id)
        except CloudflareError as exc:
            raise SiteConfigError(exc.message, status_code=exc.status_code) from exc

        ssl = cf.get("ssl") or {}
        new_status = self._map_cf_status(cf.get("status"), ssl.get("status"))
        update = {
            "status": new_status,
            "ssl_status": ssl.get("status"),
            "last_synced_at": datetime.now(UTC).isoformat(),
        }
        res = (
            self._db.table("tenant_custom_domains")
            .update(update)
            .eq("id", domain_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        updated = (res.data or [row])[0]
        return self._domain_row(
            updated, dns_records=self._dns_records(row["domain"], ssl)
        )

    def remove_domain(self, ctx: AuthContext, domain_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        row = self._own_domain(tenant_id, domain_id)
        cf_id = row.get("cf_custom_hostname_id")
        if cf_id:
            try:
                self._cf.delete_custom_hostname(cf_id)
            except CloudflareError as exc:
                # CF-404 ist ok (schon weg); andere Fehler durchreichen.
                if exc.status_code != 404:
                    raise SiteConfigError(
                        exc.message, status_code=exc.status_code
                    ) from exc
        (
            self._db.table("tenant_custom_domains")
            .delete()
            .eq("id", domain_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )

    def _own_domain(self, tenant_id: str, domain_id: str) -> dict:
        rows = (
            self._db.table("tenant_custom_domains")
            .select(_DOMAIN_COLS + ", domain")
            .eq("id", domain_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise SiteConfigError(
                "Domain gehört nicht zu diesem Konto.", status_code=404
            )
        return rows[0]

    @staticmethod
    def _map_cf_status(hostname_status: str | None, ssl_status: str | None) -> str:
        """CF-Status → unser status. 'active' nur wenn Hostname aktiv UND Zert
        ausgestellt; 'failed'/'…_timed_out' → error; sonst pending."""
        if hostname_status == "active" and ssl_status == "active":
            return DomainStatus.active.value
        bad = {"failed", "deleted"}
        if hostname_status in bad or (ssl_status and "timed_out" in ssl_status):
            return DomainStatus.error.value
        return DomainStatus.pending.value

    def _dns_records(self, domain: str, ssl: dict) -> list[DnsRecord]:
        """CNAME (auf den CF-Fallback-Origin) + TXT-Validierungs-Record(s)."""
        records = [
            DnsRecord(type="CNAME", name=domain, value=self._cf.fallback_origin),
        ]
        for vr in ssl.get("validation_records") or []:
            name = vr.get("txt_name")
            value = vr.get("txt_value")
            if name and value:
                records.append(DnsRecord(type="TXT", name=name, value=value))
        return records

    @staticmethod
    def _domain_row(
        row: dict, *, dns_records: list[DnsRecord] | None = None
    ) -> CustomDomainResponse:
        return CustomDomainResponse(
            id=row["id"],
            domain=row["domain"],
            status=row["status"],
            ssl_status=row.get("ssl_status"),
            dns_records=dns_records or [],
        )
