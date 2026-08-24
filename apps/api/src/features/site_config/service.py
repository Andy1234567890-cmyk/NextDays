"""Service-Schicht für site_config (White-Label-Branding + Custom-Domains).

CRUD über die Service-Role mit explizitem tenant-Scope (tenant_id stammt immer aus
dem JWT, nie aus User-Input — Muster wie addons/properties). Die Custom-Domain-
Operationen sprechen Cloudflare for SaaS (Custom Hostnames) an; der CF-Status wird
in die DB gespiegelt.

Der öffentliche Resolver ``resolve_site_by_domain`` läuft OHNE ctx/JWT (die
öffentliche Buchungs-Site ist nicht eingeloggt) über die Service-Role und gibt NUR
öffentliche Branding-Felder zurück (PublicSiteResponse) — kein cf_*-Feld, kein
Status, kein tenant-fremder Leak.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from datetime import UTC, datetime

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext

from . import konto_daten, seiten
from . import templates as site_templates
from .cloudflare_client import CloudflareClient, CloudflareError

# Re-Export: bestehende Importe `from .service import SiteConfigError` bleiben
# gültig. Die Klasse selbst liegt in `fehler.py`, weil die Mixins sie brauchen
# und ein Import aus `service` ein Zirkel wäre.
from .fehler import SiteConfigError
from .mediathek import MediathekMixin
from .schemas import (
    BlockCreate,
    BlockListResponse,
    BlockResponse,
    BlocksReplaceRequest,
    BlockType,
    BlockUpdate,
    BrandingResponse,
    BrandingUpdate,
    CustomDomainListResponse,
    CustomDomainResponse,
    DnsRecord,
    DomainCreate,
    DomainStatus,
    NavArea,
    PageCreate,
    PageListResponse,
    PageResponse,
    PageType,
    PageUpdate,
    PublicBlock,
    PublicNav,
    PublicOrganization,
    PublicPageMeta,
    PublicPageResponse,
    PublicSiteResponse,
    SliceHealth,
    validate_block_content,
)

log = get_logger("nextdays.site_config")


def _jetzt_iso() -> str:
    """Der aktuelle Zeitpunkt als ISO-Text.

    Für das Erscheinungsdatum eines neuen Blog-Beitrags (0438), wenn der Kunde
    keines angibt. Das ist KEIN Verstoß gegen Wurzel 5b: gefragt ist, wann
    DIESER Beitrag angelegt wurde, und das ist genau jetzt — es geht nicht um
    den Zeitpunkt eines fremden Ereignisses."""
    return datetime.now(UTC).isoformat()

# Alle Branding-Spalten. Sie werden AUFGEZÄHLT und nicht per `*` geholt:
# `select("*")` würde jede neue Spalte automatisch mitliefern — auch eine, die
# nur intern gedacht ist — und der öffentliche Resolver baut auf derselben Liste
# auf (`_PUBLIC_COLS`). Eine Aufzählung macht jedes zusätzliche Feld zu einer
# bewussten Entscheidung.
_BRANDING_COLS = (
    "site_name, tagline, logo_url, hero_image_url, favicon_url, theme, "
    "primary_color, secondary_color, background_color, foreground_color, "
    "font_family, heading_font, button_font, button_style, button_radius, "
    "logo_scale, about_text, contact_text, social_links, booking_mode, "
    # 0426: Farbrollen für Kopf-/Fußzeile, Links und Firmenname.
    "brand_name_color, header_background, header_link_color, link_color, "
    "footer_background, "
    # 0426: Typografie des Logo-Bereichs.
    "logo_name_font, logo_name_size, slogan_font, logo_link_url, "
    # 0426: Sprachen und Anzeigeverhalten der Website.
    "languages, default_language, show_guest_breakdown, show_base_prices, "
    # 0426: Code-Injection und Rechts-Schalter.
    "head_html, head_css, custom_js, checkout_js, cookie_banner, "
    "cookie_policy_page_id, privacy_consent, privacy_policy_page_id, is_offline, "
    # 0430: SEO/AEO site-weit, Google-Tag, strukturierte Daten, Core Web Vitals.
    "seo_title, seo_description, seo_keywords, noindex, gtag_id, "
    "schema_organization, schema_breadcrumbs, schema_lodging, schema_faq, "
    "lazy_loading, system_fonts_first, "
    # 0435: Theme-Breite und Schriftgrößen-Faktoren.
    "content_width, heading_scale, body_scale"
)
_DOMAIN_COLS = (
    "id, tenant_id, domain, cf_custom_hostname_id, status, ssl_status, "
    "last_synced_at"
)
# Öffentliche Felder + tenant_id, um vom Domain-Treffer aufs Branding zu joinen.
_PUBLIC_COLS = f"tenant_id, {_BRANDING_COLS}"
_PAGE_COLS = (
    "id, slug, title, seo_title, seo_description, og_image_url, is_home, "
    "is_published, nav_area, nav_order, languages, "
    # 0430: SEO je Seite.
    "seo_keywords, canonical_url, head_html, noindex, "
    # 0433: Seitentypen (externer Menüpunkt, Ordner, 404).
    "page_type, external_url, parent_id, "
    # 0437: Pop-up-Auslöser.
    "popup_trigger, popup_value, popup_device, popup_once, "
    # 0438: Blog-Beitrag.
    "published_at, author, cover_image_url, excerpt, tags"
)
_BLOCK_COLS = "id, page_id, type, position, content, settings"
_MEDIA_COLS = "id, url, filename, mime, bytes, created_at"


class SiteConfigService(MediathekMixin):
    slice_name = "site_config"

    def __init__(
        self, service_client: Client, cloudflare: CloudflareClient
    ) -> None:
        self._db = service_client
        self._cf = cloudflare

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise SiteConfigError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    # --- Branding (Dashboard, MANAGE_SITE_CONFIG) ----------------------------

    def get_branding(self, ctx: AuthContext) -> BrandingResponse:
        """Branding des Tenants, mit den Firmendaten des Kontos als Rückfall.

        Firmenname und Logo pflegt der Betrieb unter Konto → Profil. Sie im
        Baukasten noch einmal einzutragen wäre nicht nur Arbeit, sondern eine
        zweite Wahrheit: wer sein Logo im Konto austauscht, erwartet es auch auf
        der Website.

        Deshalb wird hier NICHT kopiert, sondern abgeleitet: was in der
        Site-Konfiguration steht, gewinnt — steht dort nichts, gilt das Konto.
        Damit bleibt beides automatisch in Deckung, und der Kunde kann für die
        Website trotzdem bewusst etwas anderes setzen."""
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("tenant_site_config")
            .select(_BRANDING_COLS)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        eigen = rows[0] if rows else {}
        return BrandingResponse(**self._mit_konto_rueckfall(tenant_id, eigen))

    def _mit_konto_rueckfall(self, tenant_id: str, eigen: dict) -> dict:
        """Leere Marken-Felder aus den Firmendaten des Kontos füllen.

        Nur `site_name` und `logo_url` — Farben, Schriften und Theme sind
        Website-Entscheidungen und haben im Konto kein Gegenstück."""
        aus = {k: v for k, v in eigen.items() if v is not None}
        if aus.get("site_name") and aus.get("logo_url"):
            # Beides gesetzt: das Konto muss nicht gelesen werden.
            return aus
        firma = konto_daten.firmendaten(self._db, tenant_id)
        for feld in ("site_name", "logo_url"):
            if not aus.get(feld) and firma.get(feld):
                aus[feld] = firma[feld]
        return aus

    def set_branding(
        self, ctx: AuthContext, req: BrandingUpdate
    ) -> BrandingResponse:
        """Branding upserten (1:1 pro Tenant). tenant_id NIE aus Input."""
        tenant_id = self._require_tenant(ctx)
        payload = req.model_dump(mode="json", exclude_unset=True)
        payload["tenant_id"] = tenant_id
        res = (
            self._db.table("tenant_site_config")
            .upsert(payload, on_conflict="tenant_id")
            .execute()
        )
        if not res.data:
            raise SiteConfigError(
                "Branding konnte nicht gespeichert werden.", status_code=500
            )
        return self.get_branding(ctx)

    # --- Custom-Domains (Dashboard, MANAGE_SITE_CONFIG) ----------------------

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

    # --- Öffentlicher Resolver (KEIN JWT, service-role) ----------------------

    def _tenant_id_for_host(self, host: str) -> str:
        """Host → tenant_id über eine AKTIVE Custom-Domain. 400 bei leerem Host,
        404 bei unbekannter/nicht-aktiver Domain. Service-role (kein JWT)."""
        host = (host or "").strip().lower().rstrip(".")
        if not host:
            raise SiteConfigError("Kein Host angegeben.", status_code=400)
        domain_rows = (
            self._db.table("tenant_custom_domains")
            .select("tenant_id")
            .eq("domain", host)
            .eq("status", DomainStatus.active.value)
            .limit(1)
            .execute()
        ).data or []
        if not domain_rows:
            raise SiteConfigError("Unbekannte Domain.", status_code=404)
        return domain_rows[0]["tenant_id"]

    def _public_branding(self, tenant_id: str) -> PublicSiteResponse:
        """Öffentliches Branding eines Tenants (nur öffentliche Felder)."""
        cfg_rows = (
            self._db.table("tenant_site_config")
            .select(_PUBLIC_COLS)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        base = cfg_rows[0] if cfg_rows else {}
        # Nur gelieferte Werte übernehmen (siehe _page_row): ein fehlender Key
        # darf nicht als None ein Enum-Feld kippen. Dazu derselbe Konto-Rückfall
        # wie im Dashboard — sonst zeigt die Vorschau ein Logo, das die
        # veröffentlichte Seite nicht hat.
        gesetzt = {
            k: v
            for k, v in self._mit_konto_rueckfall(tenant_id, base).items()
            if v is not None and k not in ("tenant_id", "nav")
        }
        # Die verlinkten Rechts-Seiten wandern als SLUG nach draußen, nicht als
        # ID: der Renderer baut daraus einen Pfad, mit einer ID müsste er die
        # Seite erst nachschlagen.
        for feld, ziel in (
            ("cookie_policy_page_id", "cookie_policy_slug"),
            ("privacy_policy_page_id", "privacy_policy_slug"),
        ):
            seiten_id = gesetzt.pop(feld, None)
            if seiten_id:
                slug = self._slug_von(tenant_id, str(seiten_id))
                if slug is not None:
                    gesetzt[ziel] = slug
        antwort = PublicSiteResponse(
            **gesetzt,
            tenant_id=tenant_id,
            nav=self._public_nav(tenant_id),
        )
        # Firmenangaben fürs Organization-Schema NUR laden, wenn der Schalter an
        # ist (0430). Sonst wären es zwei Datenbankabfragen pro Seitenansicht
        # für ein Ergebnis, das niemand ausliefert.
        if antwort.schema_organization:
            antwort.organization = self._organisation(tenant_id)
        antwort.payments_ready = self._zahlungen_bereit(tenant_id)
        return antwort

    def _zahlungen_bereit(self, tenant_id: str) -> bool:
        """Kann dieser Betrieb online Geld annehmen?

        Stripe ODER PayPal genügt. Beide werden geprüft, weil ein Betrieb sich
        für einen der beiden Wege entscheiden kann — und weil „nur PayPal" ein
        gültiger Zustand ist, in dem die Buchungsstrecke funktioniert.

        Bei Stripe zählt `stripe_charges_enabled` und nicht die bloße Existenz
        eines Kontos: ein angelegter Custom Account, dessen KYC noch aussteht,
        nimmt kein Geld an. Genau dieser Zustand dauert Tage und ist der Grund
        für die Prüfung.

        Fehlt die Zeile ganz (Betrieb ohne Abrechnungsprofil), ist die Antwort
        `False` — fail-closed (Wurzel 5). Eine Buchungsstrecke anzubieten, von
        der wir nicht wissen, ob sie kassieren kann, wäre die schlechtere
        Annahme."""
        rows = (
            self._db.table("tenant_billing_profile")
            .select("stripe_charges_enabled, paypal_email")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return False
        profil = rows[0]
        return bool(profil.get("stripe_charges_enabled")) or bool(
            (profil.get("paypal_email") or "").strip()
        )

    def _organisation(self, tenant_id: str) -> PublicOrganization | None:
        """Firmenangaben für strukturierte Daten, oder ``None``.

        ``None`` bei fehlendem Namen: ein ``Organization``-Schema ohne ``name``
        ist für Google unbrauchbar, und ein erfundener Name wäre eine
        Falschaussage in maschinenlesbarer Form (Wurzel 4). Die restlichen
        Felder dürfen einzeln fehlen — ein Schema mit Name und Ort ohne Telefon
        ist gültig und besser als keines."""
        daten = konto_daten.firmen_schema_daten(self._db, tenant_id)
        if not daten.get("name"):
            return None
        return PublicOrganization(**daten)

    def _slug_von(self, tenant_id: str, page_id: str) -> str | None:
        """Slug einer eigenen Seite. `None`, wenn sie nicht (mehr) existiert
        oder nicht veröffentlicht ist.

        Der Tenant-Filter ist nicht Zierde: die Spalte trägt eine
        Fremdschlüssel-Beziehung auf `site_pages`, aber eine ID, die per
        Direktpfad dort landet, könnte auf eine fremde Seite zeigen. Ein
        Cookie-Hinweis, der auf die Datenschutzseite eines anderen Betriebs
        verlinkt, wäre ein Datenleck mit Ansage (Wurzel 3).

        Unveröffentlichte Seiten geben `None`: der Banner zeigt dann keinen Link,
        statt den Gast auf eine 404 zu schicken."""
        rows = (
            self._db.table("site_pages")
            .select("slug")
            .eq("id", page_id)
            .eq("tenant_id", tenant_id)
            .eq("is_published", True)
            .limit(1)
            .execute()
        ).data or []
        return rows[0]["slug"] if rows else None

    def _ist_offline(self, tenant_id: str) -> bool:
        """Hauptschalter „Website offline" (0426).

        Eigene Abfrage und nicht aus dem Branding gelesen, weil sie VOR dem
        Branding laufen muss: ist die Site zu, soll gar nichts erst
        zusammengebaut werden."""
        rows = (
            self._db.table("tenant_site_config")
            .select("is_offline")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows and rows[0].get("is_offline"))

    def resolve_site_by_domain(self, host: str) -> PublicSiteResponse:
        """Host → Tenant + öffentliches Branding. NUR aktive Domains; unbekannt
        → 404. Gibt ausschließlich öffentliche Felder zurück (kein Leak).

        Steht der Hauptschalter „Website offline" (0426), antwortet auch eine
        gültige Domain mit 404. Ohne diese Zeile wäre der Schalter Deko: der
        Renderer bekäme sein Branding und würde die Seite bauen."""
        tenant_id = self._tenant_id_for_host(host)
        if self._ist_offline(tenant_id):
            raise SiteConfigError("Website ist offline.", status_code=404)
        return self._public_branding(tenant_id)

    # === Page-Builder: Seiten (Dashboard, MANAGE_SITE_CONFIG) ================

    def list_pages(self, ctx: AuthContext) -> PageListResponse:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("site_pages")
            .select(_PAGE_COLS)
            .eq("tenant_id", tenant_id)
            .order("nav_area")
            .order("nav_order")
            .order("created_at")
            .execute()
        ).data or []
        items = [PageResponse(**self._page_row(r)) for r in rows]
        return PageListResponse(items=items, total=len(items))

    def create_page(self, ctx: AuthContext, req: PageCreate) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        # Erste Seite eines Tenants wird automatisch Home.
        existing = (
            self._db.table("site_pages")
            .select("id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        # Deckel und Slug-Regeln stehen in `seiten_regeln` — dort auch, warum.
        if seiten.zaehle_seiten(self._db, tenant_id) >= (
            seiten.MAX_SEITEN
        ):
            raise SiteConfigError(
                f"Mehr als {seiten.MAX_SEITEN} Seiten sind nicht "
                "möglich.",
                status_code=422,
            )
        try:
            titel, slug = seiten.titel_und_slug(req)
        except ValueError as exc:
            raise SiteConfigError(str(exc), status_code=400) from exc
        # Slug-Kollision vorab abfangen (DB-unique ist der harte Backstop).
        if (
            self._db.table("site_pages")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("slug", slug)
            .limit(1)
            .execute()
        ).data:
            raise SiteConfigError(
                "Es gibt bereits eine Seite mit diesem Slug.", status_code=409
            )
        payload = {
            "tenant_id": tenant_id,
            "title": titel,
            "slug": slug,
            "is_home": not existing,
            "nav_area": req.nav_area.value,
            # Neue Seite hinten in ihrem Navigationsbereich einsortieren, damit
            # sie nicht auf Position 0 vor die Startseite springt.
            "nav_order": self._next_nav_order(tenant_id, req.nav_area.value),
            # 0433
            "page_type": req.page_type.value,
            "external_url": req.external_url,
            "parent_id": req.parent_id,
            # 0437 — nur beim Pop-up gesetzt; der CHECK in 0437 erzwingt das,
            # und das Schema hat es bereits geprüft.
            "popup_trigger": (
                req.popup_trigger.value if req.popup_trigger else None
            ),
            "popup_value": req.popup_value,
            "popup_device": req.popup_device,
            "popup_once": req.popup_once,
            # 0438 — nur beim Beitrag gesetzt (CHECK in 0438).
            #
            # `published_at` fällt bewusst auf JETZT zurück, wenn der Kunde kein
            # Datum angibt: ein Beitrag ohne Datum hätte keine Position in der
            # Reihenfolge und stünde je nach Abfrage irgendwo. Das ist kein
            # erfundener Wert — er legt ihn in diesem Moment an.
            "published_at": (
                req.published_at
                if req.page_type is not PageType.post
                else (req.published_at or _jetzt_iso())
            ),
            "author": req.author,
            "cover_image_url": req.cover_image_url,
            "excerpt": req.excerpt,
            "tags": req.tags,
        }
        if seiten.ist_ohne_inhalt(req.page_type):
            payload["is_home"] = False
        # `_own_page` erzwingt den Tenant-Scope (Wurzel 3), `pruefe_ordner` den
        # Typ. Ohne beides könnte eine Seite an einen fremden Ordner gehängt
        # werden oder an eine normale Seite — und die Navigation bekäme eine
        # Verschachtelung, die der CHECK aus 0433 verbietet.
        if req.parent_id:
            try:
                seiten.pruefe_ordner(
                    self._own_page(tenant_id, req.parent_id)
                )
            except ValueError as exc:
                raise SiteConfigError(str(exc), status_code=422) from exc
        res = self._db.table("site_pages").insert(payload).execute()
        if not res.data:
            raise SiteConfigError(
                "Seite konnte nicht angelegt werden.", status_code=500
            )
        neue_id = res.data[0]["id"]
        # Die Vorlage NACH dem Anlegen: sie braucht die page_id. Ein Fehler hier
        # lässt die Seite stehen (leer) statt sie zurückzurollen — eine
        # halbfertige Seite kann der Kunde sehen und löschen, eine verschluckte
        # nicht (Wurzel 5).
        if req.template:
            try:
                seiten.vorlage_anwenden(
                    self._db,
                    tenant_id,
                    neue_id,
                    req.template,
                    konto_daten.firmendaten(self._db, tenant_id),
                )
            except ValueError as exc:
                raise SiteConfigError(str(exc), status_code=422) from exc
        # Frisch laden, damit DB-Defaults (is_published/nav_order) gefüllt sind.
        return self._load_page(tenant_id, neue_id)

    def duplicate_page(self, ctx: AuthContext, page_id: str) -> PageResponse:
        """Eine Seite samt Blöcken kopieren (0433).

        Der Deckel gilt auch hier: Duplizieren ist der bequemste Weg, 200 Seiten
        zu erzeugen. Was NICHT mitkopiert wird (SEO-Felder, `is_published`,
        `is_home`) und warum jedes einzeln, steht in `seiten.duplizieren`."""
        tenant_id = self._require_tenant(ctx)
        if seiten.zaehle_seiten(self._db, tenant_id) >= seiten.MAX_SEITEN:
            raise SiteConfigError(
                f"Mehr als {seiten.MAX_SEITEN} Seiten sind nicht möglich.",
                status_code=422,
            )
        quelle = self._own_page(tenant_id, page_id)
        try:
            neu = seiten.duplizieren(self._db, tenant_id, quelle, page_id)
        except ValueError as exc:
            raise SiteConfigError(str(exc), status_code=409) from exc
        return self._load_page(tenant_id, neu["id"])

    def update_page(
        self, ctx: AuthContext, page_id: str, req: PageUpdate
    ) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        page = self._own_page(tenant_id, page_id)
        patch = req.model_dump(mode="json", exclude_unset=True)
        # Gegenzustand (Wurzel 1): wechselt die Seite den Navigationsbereich,
        # gilt ihre alte Position im neuen Bereich nicht mehr — sonst landet sie
        # dort auf einer schon belegten Stelle und die Reihenfolge ist zufällig.
        # Eine explizit mitgeschickte nav_order gewinnt.
        if (
            "nav_area" in patch
            and patch["nav_area"] != page.get("nav_area")
            and "nav_order" not in patch
        ):
            patch["nav_order"] = self._next_nav_order(tenant_id, patch["nav_area"])
        if "slug" in patch:
            clash = (
                self._db.table("site_pages")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("slug", patch["slug"])
                .neq("id", page_id)
                .limit(1)
                .execute()
            ).data or []
            if clash:
                raise SiteConfigError(
                    "Es gibt bereits eine Seite mit diesem Slug.", status_code=409
                )
        if patch:
            self._db.table("site_pages").update(patch).eq("id", page_id).eq(
                "tenant_id", tenant_id
            ).execute()
        return self._load_page(tenant_id, page_id)

    def _next_nav_order(self, tenant_id: str, nav_area: str) -> int:
        """Nächste freie Position innerhalb EINES Navigationsbereichs.

        Die Reihenfolge gilt je Bereich (Kopfzeile zählt eigen, Fußzeile eigen) —
        sonst würde eine neue Fußzeilen-Seite die Kopfzeilen-Reihenfolge
        durchmischen."""
        rows = (
            self._db.table("site_pages")
            .select("nav_order")
            .eq("tenant_id", tenant_id)
            .eq("nav_area", nav_area)
            .order("nav_order", desc=True)
            .limit(1)
            .execute()
        ).data or []
        return (rows[0]["nav_order"] + 1) if rows else 0

    def reorder_pages(
        self, ctx: AuthContext, nav_area: NavArea, ordered_ids: list[str]
    ) -> PageListResponse:
        """Seiten INNERHALB eines Navigationsbereichs neu sortieren.

        Die übergebene Liste muss exakt die Seiten dieses Bereichs sein — eine
        fremde oder fehlende ID ist ein 400, kein stilles Teil-Update (Wurzel 3:
        der Anfrage nicht vertrauen, Menge serverseitig gegenprüfen)."""
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("site_pages")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("nav_area", nav_area.value)
            .execute()
        ).data or []
        if {r["id"] for r in rows} != set(ordered_ids):
            raise SiteConfigError(
                "Die Seitenliste passt nicht zum Navigationsbereich.",
                status_code=400,
            )
        for pos, page_id in enumerate(ordered_ids):
            self._db.table("site_pages").update({"nav_order": pos}).eq(
                "id", page_id
            ).eq("tenant_id", tenant_id).execute()
        return self.list_pages(ctx)

    def set_home_page(self, ctx: AuthContext, page_id: str) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        # Erst alle anderen entkrönen (partieller Unique-Index ist der Backstop),
        # dann die Zielseite zur Home machen.
        self._db.table("site_pages").update({"is_home": False}).eq(
            "tenant_id", tenant_id
        ).neq("id", page_id).execute()
        self._db.table("site_pages").update({"is_home": True}).eq(
            "id", page_id
        ).eq("tenant_id", tenant_id).execute()
        return self._load_page(tenant_id, page_id)

    def publish_page(self, ctx: AuthContext, page_id: str) -> PageResponse:
        return self._set_published(ctx, page_id, True)

    def unpublish_page(self, ctx: AuthContext, page_id: str) -> PageResponse:
        return self._set_published(ctx, page_id, False)

    def delete_page(self, ctx: AuthContext, page_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        # Blöcke hängen per FK on delete cascade; Seite löschen genügt.
        self._db.table("site_pages").delete().eq("id", page_id).eq(
            "tenant_id", tenant_id
        ).execute()

    # === Page-Builder: Blöcke ================================================

    def list_blocks(self, ctx: AuthContext, page_id: str) -> BlockListResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        rows = (
            self._db.table("site_blocks")
            .select(_BLOCK_COLS)
            .eq("page_id", page_id)
            .order("position")
            .execute()
        ).data or []
        items = [BlockResponse(**r) for r in rows]
        return BlockListResponse(items=items, total=len(items))

    def add_block(
        self, ctx: AuthContext, page_id: str, req: BlockCreate
    ) -> BlockResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        roh = dict(req.content or {})
        if req.type is BlockType.contact:
            # Ein Kontakt-Abschnitt ohne Kontaktdaten ist nutzlos, und die Daten
            # liegen im Konto. Also gleich einsetzen statt den Kunden abtippen
            # zu lassen — was er selbst mitgeschickt hat, gewinnt.
            roh = konto_daten.kontakt_mit_firmendaten(
                roh, konto_daten.firmendaten(self._db, tenant_id), nur_leere=True
            )
        content = self._validate_content(req.type, roh)
        rows = (
            self._db.table("site_blocks")
            .select("position")
            .eq("page_id", page_id)
            .order("position", desc=True)
            .limit(1)
            .execute()
        ).data or []
        next_pos = (rows[0]["position"] + 1) if rows else 0
        payload = {
            "tenant_id": tenant_id,
            "page_id": page_id,
            "type": req.type.value,
            "position": next_pos,
            "content": content,
            "settings": req.settings or {},
        }
        res = self._db.table("site_blocks").insert(payload).execute()
        if not res.data:
            raise SiteConfigError(
                "Block konnte nicht angelegt werden.", status_code=500
            )
        return BlockResponse(**self._block_row(res.data[0]))

    def update_block(
        self, ctx: AuthContext, block_id: str, req: BlockUpdate
    ) -> BlockResponse:
        tenant_id = self._require_tenant(ctx)
        block = self._own_block(tenant_id, block_id)
        patch: dict = {}
        if req.content is not None:
            patch["content"] = self._validate_content(
                BlockType(block["type"]), req.content
            )
        if req.settings is not None:
            patch["settings"] = req.settings
        if patch:
            self._db.table("site_blocks").update(patch).eq("id", block_id).eq(
                "tenant_id", tenant_id
            ).execute()
        return self._load_block(tenant_id, block_id)

    def reorder_blocks(
        self, ctx: AuthContext, page_id: str, ordered_ids: list[str]
    ) -> BlockListResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        # Alle Block-IDs der Seite laden und prüfen, dass die übergebene Liste
        # exakt diese Menge ist (kein fremder/fehlender Block).
        rows = (
            self._db.table("site_blocks")
            .select("id")
            .eq("page_id", page_id)
            .execute()
        ).data or []
        actual = {r["id"] for r in rows}
        if set(ordered_ids) != actual:
            raise SiteConfigError(
                "Die Blockliste passt nicht zur Seite.", status_code=400
            )
        for pos, block_id in enumerate(ordered_ids):
            self._db.table("site_blocks").update({"position": pos}).eq(
                "id", block_id
            ).eq("tenant_id", tenant_id).execute()
        return self.list_blocks(ctx, page_id)

    def replace_blocks(
        self, ctx: AuthContext, page_id: str, req: BlocksReplaceRequest
    ) -> BlockListResponse:
        """ALLE Abschnitte einer Seite in EINEM Aufruf setzen.

        Der Editor speicherte bisher mit N+1 einzelnen Requests (löschen, dann
        updaten, dann anlegen, dann neu ordnen). Brach einer in der Mitte ab,
        blieb die Seite halb gespeichert — und ein Doppelklick auf „Speichern"
        lief zweimal durch dieselbe Sequenz. Hier ist der Speichervorgang EINE
        idempotente Operation: dieselbe Liste zweimal gesendet ergibt denselben
        Zustand (Wurzel 2).

        Jede mitgeschickte Block-ID muss zu DIESER Seite gehören — nicht bloß zum
        Tenant. Sonst könnte man mit einer fremden Block-ID aus einer anderen
        Seite des eigenen Kontos deren Abschnitt hierher umhängen (Wurzel 3:
        Scope serverseitig erzwingen, und zwar denselben wie im List-Pfad)."""
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)

        vorhanden = {
            r["id"]: r["type"]
            for r in (
                self._db.table("site_blocks")
                .select("id, type")
                .eq("page_id", page_id)
                .execute()
            ).data
            or []
        }

        gesendet: set[str] = set()
        for item in req.items:
            if item.id is None:
                continue
            if item.id not in vorhanden:
                log.warning(
                    "site_blocks_replace_fremder_abschnitt",
                    page_id=page_id,
                    block_id=item.id,
                    bekannt=sorted(vorhanden),
                )
                raise SiteConfigError(
                    "Ein Abschnitt gehört nicht zu dieser Seite.", status_code=400
                )
            if item.id in gesendet:
                log.warning(
                    "site_blocks_replace_doppelt",
                    page_id=page_id,
                    block_id=item.id,
                )
                raise SiteConfigError(
                    "Ein Abschnitt kommt doppelt vor.", status_code=400
                )
            if vorhanden[item.id] != item.type.value:
                # Typwechsel gibt es fachlich nicht (jeder Typ hat ein eigenes
                # content-Schema). Der Editor schickt das nie — klar fehlschlagen
                # statt still das falsche Schema zu validieren (Wurzel 5).
                log.warning(
                    "site_blocks_replace_typwechsel",
                    page_id=page_id,
                    block_id=item.id,
                    war=vorhanden[item.id],
                    neu=item.type.value,
                )
                raise SiteConfigError(
                    "Ein Abschnitt kann seinen Typ nicht wechseln.",
                    status_code=400,
                )
            gesendet.add(item.id)

        # 1) ALLES validieren, BEVOR irgendetwas geschrieben wird (Wurzel 5:
        #    fail-closed vor dem Seiteneffekt).
        #
        #    Vorher wurde zuerst gelöscht und dann in der Schreib-Schleife
        #    validiert. Schlug ein Abschnitt weiter hinten fehl, waren die
        #    Löschungen schon committet: der Aufrufer bekam 400 und glaubte,
        #    nichts sei passiert — der entfernte Abschnitt war aber unwiederbring-
        #    lich weg. Genau die Kombination trat real auf, weil eine E-Mail im
        #    Kontakt-Abschnitt zuverlässig einen 400 auslöste.
        geprueft = [
            (pos, item, self._validate_content(item.type, item.content))
            for pos, item in enumerate(req.items)
        ]

        # 2) Weggefallene Abschnitte löschen (der Gegenzustand zur neuen Liste,
        #    Wurzel 1 — sonst bleiben gelöschte Abschnitte auf der Seite stehen).
        entfallen = [bid for bid in vorhanden if bid not in gesendet]
        if entfallen:
            self._db.table("site_blocks").delete().in_("id", entfallen).eq(
                "tenant_id", tenant_id
            ).execute()

        # 3) Bestehende aktualisieren bzw. neue anlegen; Position = Array-Index.
        for pos, item, content in geprueft:
            if item.id is not None:
                self._db.table("site_blocks").update(
                    {
                        "position": pos,
                        "content": content,
                        "settings": item.settings or {},
                    }
                ).eq("id", item.id).eq("tenant_id", tenant_id).execute()
                continue
            self._db.table("site_blocks").insert(
                {
                    "tenant_id": tenant_id,
                    "page_id": page_id,
                    "type": item.type.value,
                    "position": pos,
                    "content": content,
                    "settings": item.settings or {},
                }
            ).execute()

        return self.list_blocks(ctx, page_id)

    def remove_block(self, ctx: AuthContext, block_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._own_block(tenant_id, block_id)
        self._db.table("site_blocks").delete().eq("id", block_id).eq(
            "tenant_id", tenant_id
        ).execute()

    def apply_template(
        self, ctx: AuthContext, template_id: str
    ) -> PageListResponse:
        tenant_id = self._require_tenant(ctx)
        tmpl = site_templates.TEMPLATES.get(template_id)
        if not tmpl:
            raise SiteConfigError("Unbekanntes Template.", status_code=404)
        existing_slugs = {
            r["slug"]
            for r in (
                self._db.table("site_pages")
                .select("slug")
                .eq("tenant_id", tenant_id)
                .execute()
            ).data
            or []
        }
        has_home = bool(
            (
                self._db.table("site_pages")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("is_home", True)
                .limit(1)
                .execute()
            ).data
        )
        # Die Vorlage bringt Beispieldaten mit („hallo@bergchalet.example",
        # „Alpenstraße 1"). Die stehen sonst auf der Kundenseite und müssten von
        # Hand überschrieben werden — obwohl die echten Angaben im Konto liegen.
        # Also einsetzen, wo vorhanden.
        firma = konto_daten.firmendaten(self._db, tenant_id)

        for page in tmpl["pages"]:
            if page["slug"] in existing_slugs:
                continue  # Slug schon vergeben → diese Template-Seite überspringen
            is_home = bool(page.get("is_home")) and not has_home
            if is_home:
                has_home = True
            nav_area = page.get("nav_area", NavArea.header.value)
            page_res = (
                self._db.table("site_pages")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "title": page["title"],
                        "slug": page["slug"],
                        "is_home": is_home,
                        "nav_area": nav_area,
                        "nav_order": self._next_nav_order(tenant_id, nav_area),
                    }
                )
                .execute()
            )
            page_id = page_res.data[0]["id"]
            for pos, block in enumerate(page.get("blocks", [])):
                btype = BlockType(block["type"])
                inhalt = dict(block.get("content", {}))
                if btype is BlockType.contact:
                    inhalt = konto_daten.kontakt_mit_firmendaten(inhalt, firma)
                self._db.table("site_blocks").insert(
                    {
                        "tenant_id": tenant_id,
                        "page_id": page_id,
                        "type": btype.value,
                        "position": pos,
                        "content": self._validate_content(btype, inhalt),
                        "settings": block.get("settings", {}),
                    }
                ).execute()
        # Design-Tokens der Vorlage UND die echten Marken-Angaben des Betriebs.
        # Name und Logo stehen im Konto — ohne diesen Schritt bleibt die
        # Kopfzeile der Kundenseite leer, obwohl beides vorhanden ist.
        vorgaben = dict(tmpl.get("branding") or {})
        if firma.get("site_name"):
            vorgaben["site_name"] = firma["site_name"]
        if firma.get("logo_url"):
            vorgaben["logo_url"] = firma["logo_url"]
        self._apply_template_branding(ctx, vorgaben)
        return self.list_pages(ctx)

    def _apply_template_branding(
        self, ctx: AuthContext, branding: dict[str, object]
    ) -> None:
        """Design-Tokens der Vorlage NUR in noch leere Branding-Felder schreiben.

        Ohne das steht der Kunde nach einem Vorlagen-Klick vor fertigen Seiten in
        einem fremden Standard-Look. Mit blindem Überschreiben würde er dagegen
        seine bereits gesetzte Marke verlieren — beides falsch, deshalb füllt die
        Vorlage nur die Lücken (Wurzel 1: den bestehenden Zustand mitpflegen,
        nicht plattmachen)."""
        if not branding:
            return
        vorhanden = self.get_branding(ctx).model_dump(mode="json")
        patch = {
            feld: wert
            for feld, wert in branding.items()
            if vorhanden.get(feld) is None
        }
        if patch:
            self.set_branding(ctx, BrandingUpdate.model_validate(patch))

    # === Page-Builder: öffentlicher Resolver (service-role, kein JWT) ========

    @staticmethod
    def _seo_meta(page: dict, branding: PublicSiteResponse) -> PublicPageMeta:
        """SEO-Angaben einer Seite mit dem site-weiten Rückfall auflösen (0430).

        Hostaway formuliert die Regel als „Site-SEO-Hierarchie": die Angaben der
        Seite haben Vorrang, die site-weiten gelten für alle Seiten ohne eigene.
        Sie steht GENAU HIER und nicht im Renderer — beide Resolver (veröffentlicht
        und Entwurf) gehen durch diese Methode, und der Renderer bekommt einen
        fertigen Wert. Die Alternative wäre dieselbe `coalesce`-Kette an drei
        Stellen, von denen zwei irgendwann abweichen.

        `title` bleibt IMMER der echte Seitentitel: er benennt die Seite im
        Baukasten und in der Navigation. Was in den Browser-Tab kommt, ist
        `seo_title` — dass der fehlen darf, ist der Normalfall.

        `canonical_url` bekommt bewusst KEINEN site-weiten Rückfall: eine
        kanonische Adresse zeigt auf EINE bestimmte Seite. Ein site-weiter Wert
        würde jede Unterseite als Duplikat der Startseite deklarieren und die
        Website aus dem Index nehmen — der Klassiker unter den SEO-Unfällen.

        `noindex` ist eine ODER-Verknüpfung, keine Hierarchie: steht die ganze
        Website auf „nicht indexieren", darf eine einzelne Seite das nicht
        aufheben. Andernfalls wäre der Hauptschalter wirkungslos, sobald irgendwo
        `noindex=false` gespeichert ist — und genau das ist der Default."""
        return PublicPageMeta(
            slug=page["slug"],
            title=page["title"],
            seo_title=page.get("seo_title") or branding.seo_title,
            seo_description=(
                page.get("seo_description") or branding.seo_description
            ),
            og_image_url=page.get("og_image_url"),
            seo_keywords=page.get("seo_keywords") or branding.seo_keywords,
            canonical_url=page.get("canonical_url"),
            head_html=page.get("head_html"),
            noindex=bool(page.get("noindex")) or branding.noindex,
        )

    def resolve_page(self, host: str, slug: str | None = None) -> PublicPageResponse:
        """Host → veröffentlichte Seite (Home bei slug=None) + geordnete Blöcke +
        Branding. NUR is_published, nur öffentliche Felder. Unbekannt → 404.

        Der Hauptschalter „Website offline" (0426) gilt auch hier — und zwar VOR
        der Seitensuche. Nur in `resolve_site_by_domain` zu prüfen hätte nichts
        gebracht: der Renderer holt seine Seiten über DIESEN Weg, und eine
        einzelne Unterseite wäre über ihren Direktlink weiter erreichbar
        gewesen. Der Entwurfs-Renderer (`resolve_page_draft`) ist bewusst NICHT
        betroffen — sonst könnte der Kunde die Seite nicht herrichten, während
        sie zu ist."""
        tenant_id = self._tenant_id_for_host(host)
        if self._ist_offline(tenant_id):
            raise SiteConfigError("Website ist offline.", status_code=404)
        query = (
            self._db.table("site_pages")
            .select(_PAGE_COLS)
            .eq("tenant_id", tenant_id)
            .eq("is_published", True)
        )
        # Ordner und die Fehlerseite haben keine Adresse (0433): ein Ordner ist
        # kein Ziel, und die 404-Seite ist die Antwort auf eine falsche Adresse.
        # Ohne diesen Filter wäre der Ordner unter seinem abgeleiteten Slug
        # („/ordner-umgebung") als leere Seite erreichbar — und die Fehlerseite
        # unter „/404" als normale Seite.
        query = query.eq("page_type", "normal")
        query = (
            query.eq("is_home", True)
            if slug is None or slug == ""
            else query.eq("slug", slug)
        )
        page_rows = query.limit(1).execute().data or []
        if not page_rows:
            raise SiteConfigError("Seite nicht gefunden.", status_code=404)
        page = page_rows[0]
        block_rows = (
            self._db.table("site_blocks")
            .select("type, content, settings")
            .eq("page_id", page["id"])
            .order("position")
            .execute()
        ).data or []
        branding = self._public_branding(tenant_id)
        return PublicPageResponse(
            tenant_id=tenant_id,
            page=self._seo_meta(page, branding),
            blocks=[
                PublicBlock(
                    type=BlockType(b["type"]),
                    content=b.get("content") or {},
                    settings=b.get("settings") or {},
                )
                for b in block_rows
            ],
            branding=branding,
        )

    def _public_nav(self, tenant_id: str) -> PublicNav:
        """Menüstruktur der Kunden-Site — nur VERÖFFENTLICHTE Seiten.

        Der Aufbau (Ordner, externe Menüpunkte, Rückfall bei unveröffentlichtem
        Ordner) steht in `seiten.navigation_bauen`: es ist Seitenstruktur, nicht
        Datenzugriff, und der Service liegt an der `pylint`-Zeilengrenze."""
        rows = (
            self._db.table("site_pages")
            .select(
                "id, slug, title, nav_area, page_type, external_url, parent_id"
            )
            .eq("tenant_id", tenant_id)
            .eq("is_published", True)
            .in_("nav_area", ["header", "footer"])
            .order("nav_order")
            .order("created_at")
            .execute()
        ).data or []
        return seiten.navigation_bauen(rows)

    # === Page-Builder: Draft-Vorschau (Editor-iframe) =======================

    # Token-Gültigkeit: 1 Stunde reicht für eine Editier-Sitzung; danach lädt der
    # iframe einen frischen Token. Kurzlebig, damit ein geleakter Token wenig wert ist.
    _DRAFT_TTL_SECONDS = 3600

    def _draft_secret(self) -> bytes:
        secret = get_settings().site_draft_secret.get_secret_value()
        # Fail-CLOSED (Wurzel 5): ein leeres SITE_DRAFT_SECRET darf NICHT auf ein
        # hartkodiertes Secret zurückfallen — sonst könnte jeder gültige Draft-
        # Vorschau-Tokens fälschen. Fehlt es, ist das ein Betriebs-/Config-Fehler.
        if not secret:
            raise SiteConfigError(
                "SITE_DRAFT_SECRET ist nicht konfiguriert.", status_code=503
            )
        return secret.encode()

    def create_draft_token(self, ctx: AuthContext, page_id: str) -> str:
        """Signiert einen kurzlebigen Token (tenant+page+exp) für die Live-
        Vorschau im Editor-iframe. Nur für eigene Seiten."""
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        exp = int(time.time()) + self._DRAFT_TTL_SECONDS
        return self._sign_draft(tenant_id, page_id, exp)

    def _sign_draft(self, tenant_id: str, page_id: str, exp: int) -> str:
        msg = f"{tenant_id}.{page_id}.{exp}".encode()
        sig = hmac.new(self._draft_secret(), msg, hashlib.sha256).hexdigest()
        return f"{exp}.{sig}"

    def resolve_page_draft(self, page_id: str, token: str) -> PublicPageResponse:
        """Rendert eine Seite (auch UNVERÖFFENTLICHT) für den Editor-iframe —
        nur mit gültigem, nicht abgelaufenem Token. Kein JWT (cross-origin
        iframe). Token bindet tenant_id + page_id."""
        # Seite + tenant aus der DB holen (service-role), dann Token verifizieren.
        # Eine syntaktisch ungültige ID (keine UUID) ist „nicht gefunden", kein 500.
        try:
            page_rows = (
                self._db.table("site_pages")
                .select(f"{_PAGE_COLS}, tenant_id")
                .eq("id", page_id)
                .limit(1)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — ungültige ID → 404
            raise SiteConfigError(
                "Seite nicht gefunden.", status_code=404
            ) from exc
        if not page_rows:
            raise SiteConfigError("Seite nicht gefunden.", status_code=404)
        page = page_rows[0]
        tenant_id = page["tenant_id"]
        if not self._verify_draft(tenant_id, page_id, token):
            raise SiteConfigError("Ungültiger Vorschau-Token.", status_code=403)
        block_rows = (
            self._db.table("site_blocks")
            .select("type, content, settings")
            .eq("page_id", page_id)
            .order("position")
            .execute()
        ).data or []
        branding = self._public_branding(tenant_id)
        return PublicPageResponse(
            tenant_id=tenant_id,
            page=self._seo_meta(page, branding),
            blocks=[
                PublicBlock(
                    type=BlockType(b["type"]),
                    content=b.get("content") or {},
                    settings=b.get("settings") or {},
                )
                for b in block_rows
            ],
            branding=branding,
        )

    def _verify_draft(self, tenant_id: str, page_id: str, token: str) -> bool:
        try:
            exp = int(token.split(".", 1)[0])
        except (ValueError, AttributeError, IndexError):
            return False
        if exp < int(time.time()):
            return False  # abgelaufen
        expected = self._sign_draft(tenant_id, page_id, exp)
        return hmac.compare_digest(expected, token)

    # --- Page-Builder intern -------------------------------------------------

    def _validate_content(self, block_type: BlockType, content: dict) -> dict:
        try:
            return validate_block_content(block_type, content or {})
        except ValueError as exc:
            # Mit Typ UND Schlüsseln loggen: die Meldung allein sagt nicht, an
            # welchem Feld es lag, und der Inhalt selbst gehört nicht ins Log.
            log.warning(
                "site_blocks_inhalt_ungueltig",
                block_type=block_type.value,
                schluessel=sorted((content or {}).keys()),
                fehler=str(exc),
            )
            raise SiteConfigError(
                f"Ungültiger Block-Inhalt: {exc}", status_code=400
            ) from exc

    def _own_page(self, tenant_id: str, page_id: str) -> dict:
        rows = (
            self._db.table("site_pages")
            .select(_PAGE_COLS)
            .eq("id", page_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise SiteConfigError(
                "Seite gehört nicht zu diesem Konto.", status_code=404
            )
        return rows[0]

    def _own_block(self, tenant_id: str, block_id: str) -> dict:
        rows = (
            self._db.table("site_blocks")
            .select(_BLOCK_COLS)
            .eq("id", block_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise SiteConfigError(
                "Block gehört nicht zu diesem Konto.", status_code=404
            )
        return rows[0]

    def _load_page(self, tenant_id: str, page_id: str) -> PageResponse:
        return PageResponse(**self._page_row(self._own_page(tenant_id, page_id)))

    def _load_block(self, tenant_id: str, block_id: str) -> BlockResponse:
        return BlockResponse(**self._block_row(self._own_block(tenant_id, block_id)))

    def _set_published(
        self, ctx: AuthContext, page_id: str, value: bool
    ) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        self._db.table("site_pages").update({"is_published": value}).eq(
            "id", page_id
        ).eq("tenant_id", tenant_id).execute()
        return self._load_page(tenant_id, page_id)

    @staticmethod
    def _page_row(row: dict) -> dict:
        # Nur tatsächlich gelieferte Werte übernehmen. Ein fehlender Key darf
        # NICHT als None durchgereicht werden: bei NOT-NULL-Spalten mit
        # DB-Default (nav_area, is_home, is_published) würde das Pydantic-Enum
        # sonst auf None validieren und die Antwort kippen — statt dass der
        # Schema-Default greift. Kein erfundener Ersatzwert, nur Weglassen.
        return {
            k: row[k]
            for k in PageResponse.model_fields
            if row.get(k) is not None
        }

    @staticmethod
    def _block_row(row: dict) -> dict:
        out = {k: row.get(k) for k in BlockResponse.model_fields}
        out["content"] = row.get("content") or {}
        out["settings"] = row.get("settings") or {}
        return out

    # --- intern --------------------------------------------------------------

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
