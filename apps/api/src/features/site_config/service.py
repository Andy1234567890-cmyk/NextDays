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

from pydantic import ValidationError
from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext

from . import (
    baum,
    dynamische_seiten,
    formulare,
    ki_herkunft,
    konto_daten,
    seiten,
    seiten_zugang,
    systemseiten,
)
from .basis import farbrollen_anwenden, farbrollen_beruehrt
from .beitrag_eigene_felder import felder_laden as eigene_felder_laden
from .beitrag_oeffentlich import beitrag_fuer_vorschau
from .bloecke import BloeckeMixin
from .cloudflare_client import CloudflareClient
from .container import ContainerMixin
from .domains import DomainsMixin

# Re-Export: bestehende Importe `from .service import SiteConfigError` bleiben
# gültig. Die Klasse selbst liegt in `fehler.py`, weil die Mixins sie brauchen
# und ein Import aus `service` ein Zirkel wäre.
from .fehler import SiteConfigError
from .mediathek import MediathekMixin
from .mediathek_ordner import MediathekOrdnerMixin
from .mediathek_verwendung import MediathekVerwendungMixin
from .rss_widget import RssWidgetMixin
from .schemas import (
    BlockResponse,
    BlockSettings,
    BlockType,
    BrandingResponse,
    BrandingUpdate,
    DomainStatus,
    NavArea,
    PageCreate,
    PageListResponse,
    PageResponse,
    PageType,
    PageUpdate,
    PublicNav,
    PublicOrganization,
    PublicPageMeta,
    PublicPageResponse,
    PublicPostEigenesFeld,
    PublicSiteResponse,
    PublicTrailItem,
    SliceHealth,
    validate_block_content,
)
from .vorlagen import VorlagenMixin

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
    # 0570: Kopf-/Fußzeile als Ebenen (Sichtbarkeit, Sperre, Reihenfolge).
    "header_teile, footer_teile, "
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
    "content_width, heading_scale, body_scale, "
    # 0446: Designfarben-Palette und die feldweisen Verknüpfungen Rolle → Farbe.
    "theme_colors, theme_color_links, "
    # 0447: Text-Rollen, Breiten-Einheit, Full-width, Abschnitts-Abstand.
    "text_styles, content_width_unit, content_full_width, "
    "section_spacing_y, section_spacing_x"
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
    "popup_trigger, popup_value, popup_device, popup_once, popup_position, "
    "access_password_hash, last_single_publish_at, is_draft, "
    # 0438: Blog-Beitrag.
    "published_at, author, cover_image_url, excerpt, tags, "
    # 0480: Blog-CMS — Handsortierung, Kapitel, Aufrufe, Autor-Konto.
    "post_sort, parent_post_id, view_count, author_user_id, is_archived, "
    # 0481: zweite Sichtbarkeitsachse, getrennt von `is_published`.
    "show_on_homepage, "
    # 0483: Framer-Feldliste, aus der Konstanten erzeugt statt ausgeschrieben
    # (Wurzel 2). Auch hier noetig: `_PAGE_COLS` ist eine Liste, kein `*`.
    + "".join(f"post_{n}, " for n in seiten.BEITRAGSFELDER_MIT_PRAEFIX)
    # Der Beitragstext — die Tabelle zeigt daraus einen Auszug.
    + "content_html, "
    # 0457: Alternativtext des Vorschaubilds. `PublicPageMeta` trägt das Feld
    # seit damals, geladen wurde es nie — es kam also immer als `None` heraus,
    # und ein Bild ohne Alternativtext ist für Screenreader stumm.
    "og_image_alt, "
    # Wann die Zeile ANGELEGT wurde. Das Blog-CMS zeigt sie in der
    # Beitragsliste als „Erstellt: …" — und zwar NEBEN dem Erscheinungsdatum,
    # nicht statt seiner: ein Beitrag kann heute angelegt und auf nächste Woche
    # datiert sein, und beide Angaben beantworten verschiedene Fragen
    # (Wurzel 5b: unsere Uhr ist der Zeitpunkt UNSERER Verarbeitung, das
    # Erscheinungsdatum der des Betriebs).
    "created_at, "
    # Wann die Zeile zuletzt GEAENDERT wurde. Sie steht seit 0087 in der
    # Tabelle (Trigger `set_updated_at`), ausgeliefert wurde sie nie — die
    # Beitragstabelle hatte deshalb eine Spalte „Erstellt" und keine
    # „Zuletzt geaendert", obwohl das Vorbild BEIDE fuehrt (`Created` und
    # `Edited`, Analyse A4).
    #
    # Es ist UNSERE Uhr und beschreibt UNSERE Verarbeitung (Wurzel 5b):
    # sie heisst darum „zuletzt geaendert" und nie „zuletzt bearbeitet vom
    # Autor" — ein Import oder ein Massenlauf ruehrt sie genauso an.
    "updated_at, "
    # 0466: Systemseiten (Buchungsstrecke, Blog).
    "system_key, "
    # 0468: dynamische Objektseite.
    "dynamic_source"
)
_BLOCK_COLS = (
    "id, page_id, type, position, content, settings, "
    # 0472: der Baum. Der Editor braucht ihn, um Abschnitte, Spalten und
    # Bausteine auseinanderzuhalten — ohne diese drei Felder sah er nur
    # eine flache Liste und nannte jeden Container „Unbekannter
    # Abschnitt".
    "kind, parent_id, span"
)
_MEDIA_COLS = "id, url, filename, mime, bytes, created_at"


# Acht Mixins statt pylints Vorgabe von sieben Vorfahren. Die Zahl ist hier
# kein Zeichen von Vererbungs-Tiefe, sondern von BREITE: jedes Mixin ist eine
# eigene Ressource des Slice (Abschnitte, Container, Domains, Mediathek,
# Ordner, Verwendung, RSS, Vorlagen) und erbt selbst von nichts. Der Aufrufer
# sieht weiterhin genau einen Dienst. Die Alternative — ein Modul mit allem —
# war der Zustand, den `max-module-lines` gerade verboten hat.
# pylint: disable=too-many-ancestors
class SiteConfigService(
    BloeckeMixin,
    ContainerMixin,
    DomainsMixin,
    MediathekMixin,
    MediathekOrdnerMixin,
    MediathekVerwendungMixin,
    RssWidgetMixin,
    VorlagenMixin,
):
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
        self._farbrollen_aufloesen(tenant_id, payload)
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

    # --- Designfarben: Palette, Verknüpfung, Gegenzustand (0446/0447) --------

    def _farbrollen_aufloesen(self, tenant_id: str, payload: dict) -> None:
        """Verknüpfungen anwenden und `payload` um die abgeleiteten Werte
        ergänzen.

        Die Regeln stehen in ``basis.farbrollen_anwenden`` — sie sind reine
        Logik über zwei Wörterbüchern und brauchen keine Datenbank. Hier steht
        nur, WOHER der gespeicherte Stand kommt."""
        if not farbrollen_beruehrt(payload):
            return
        farbrollen_anwenden(payload, self._theme_stand(tenant_id))

    def _theme_stand(self, tenant_id: str) -> dict:
        """Der gespeicherte Theme-Zustand, den die Auflösung braucht.

        Eigene, schmale Abfrage statt `get_branding`: dort läuft der
        Konto-Rückfall mit (Firmenname/Logo), und der hat mit Farben nichts zu
        tun. Fehlt die Zeile ganz (Betrieb ohne Site-Konfiguration), ist der
        Stand leer — kein Fehler, sondern der erste Speichervorgang."""
        rows = (
            self._db.table("tenant_site_config")
            .select("theme_colors, theme_color_links, text_styles")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else {}

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

    def _public_branding(
        self, tenant_id: str, *, entwurf: bool = False
    ) -> PublicSiteResponse:
        """Öffentliches Branding eines Tenants (nur öffentliche Felder).

        `entwurf=True` nimmt auch unveröffentlichte Seiten ins Menü — siehe
        `_public_nav`. Nur der token-geschützte Vorschaupfad darf das."""
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
            nav=self._public_nav(tenant_id, nur_veroeffentlicht=not entwurf),
        )
        # Firmenangaben fürs Organization-Schema NUR laden, wenn der Schalter an
        # ist (0430). Sonst wären es zwei Datenbankabfragen pro Seitenansicht
        # für ein Ergebnis, das niemand ausliefert.
        if antwort.schema_organization:
            antwort.organization = self._organisation(tenant_id)
        antwort.payments_ready = self._zahlungen_bereit(tenant_id)
        # Bildnachweise der Stock-Fotos (0461) — Vertragspflicht, Begründung im
        # Docstring von `MediathekMixin.bildnachweise`.
        antwort.image_credits = self.bildnachweise(tenant_id)
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
        # Die Systemseiten der Buchungsstrecke existieren, weil es ihre Routen
        # gibt — nicht, weil jemand sie angelegt hat (0466). Hier ist die eine
        # Stelle, an der sie entstehen: beim ersten Blick in die Seitenliste.
        # Eine Migration hätte nur die HEUTIGEN Betriebe bedacht.
        systemseiten.sicherstellen(self._db, tenant_id)
        # Die dynamische Objektseite (0468) — dieselbe Begründung: eine
        # Migration hätte nur die heutigen Betriebe bedacht.
        dynamische_seiten.sicherstellen(self._db, tenant_id)
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
        # Slug-Kollision vorab abfangen (die beiden Teil-Indizes aus 0484 sind
        # der harte Backstop). Geprüft wird im ADRESSRAUM des Typs: ein
        # Beitrag liegt unter `/blog/<slug>`, eine Seite unter `/<slug>` —
        # gleiche Slugs sind dort kein Konflikt (Wurzel 4: keine erfundene
        # Einschränkung).
        if seiten.slug_belegt(self._db, tenant_id, slug, req.page_type.value):
            raise SiteConfigError(
                seiten.slug_konflikt_text(req.page_type.value), status_code=409
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
            "popup_position": req.popup_position,
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
        # `_own_page` erzwingt den Tenant-Scope (Wurzel 3), `pruefe_eltern` den
        # Typ UND die Tiefe. Ohne beides könnte eine Seite an einen fremden
        # Ordner gehängt werden oder das Menü beliebig tief werden — auf dem
        # Telefon müsste man dann vier Aufklapp-Ebenen treffen.
        if req.parent_id:
            try:
                seiten.pruefe_eltern(
                    self._db, tenant_id, self._own_page(tenant_id, req.parent_id)
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
                # Zwei Kataloge, getrennt nach Seitentyp: ein Pop-up bekommt
                # eine Pop-up-Vorlage (0440), alles andere eine Seiten-Vorlage
                # (0434). Ein gemeinsamer Namensraum hiesse, dass jemand einen
                # ganzseitigen Abschnitts-Satz in ein Fenster legen kann.
                if req.page_type is PageType.popup:
                    position = seiten.popup_vorlage_anwenden(
                        self._db, tenant_id, neue_id, req.template
                    )
                    # Die Position gehoert zur Vorlage: ein Kontakt-Pop-up sitzt
                    # unten rechts, ein Willkommen in der Mitte. Eine eigene
                    # Angabe des Kunden gewinnt trotzdem — er hat sie getippt.
                    if position and not req.popup_position:
                        (
                            self._db.table("site_pages")
                            .update({"popup_position": position})
                            .eq("id", neue_id)
                            .eq("tenant_id", tenant_id)
                            .execute()
                        )
                else:
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
        # An einer Systemseite sind nur die SEO-Angaben veränderbar (0466). Ihr
        # Slug ist das Muster ihrer Route; ein umbenannter Slug beschriebe eine
        # Seite, die es nicht gibt. Ihr Typ, ihre Navigation und „Startseite"
        # ergeben ebenso wenig Sinn — sie steht in keinem Menü und ist ohne
        # gewähltes Objekt nicht erreichbar.
        #
        # Abgewiesen wird ausdrücklich, statt still zu ignorieren: ein Feld, das
        # sich speichern lässt und danach unverändert dasteht, sieht aus wie ein
        # Fehler im Speichern (Wurzel 5).
        if systemseiten.ist_systemseite(page) or dynamische_seiten.ist_dynamisch(
            page
        ):
            gesperrt = {
                "slug",
                "page_type",
                "nav_area",
                "nav_order",
                "parent_id",
                "is_home",
                "external_url",
                "is_draft",
            } & set(patch)
            if gesperrt:
                raise SiteConfigError(
                    "An dieser Seite lassen sich nur die SEO-Angaben "
                    f"ändern (abgewiesen: {', '.join(sorted(gesperrt))}).",
                    status_code=422,
                )
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
            # Derselbe Helfer wie beim Anlegen (0484). Der Typ kommt aus der
            # GESPEICHERTEN Zeile und nicht aus dem Patch: `page_type` lässt
            # sich hier nicht ändern, und ein aus dem Rumpf gelesener Wert
            # wäre eine zweite Quelle für dieselbe Aussage.
            typ = str(page.get("page_type") or "")
            if seiten.slug_belegt(
                self._db, tenant_id, patch["slug"], typ, ausser_id=page_id
            ):
                raise SiteConfigError(
                    seiten.slug_konflikt_text(typ), status_code=409
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
        """Eine Seite live stellen.

        Hebt einen Entwurf auf: wer diese Seite ausdruecklich veroeffentlicht,
        will sie live haben — den Entwurfs-Zustand danach stehen zu lassen
        hiesse, dass sie beim naechsten Gesamt-Veroeffentlichen wieder
        uebersprungen wuerde, und der CHECK aus 0443 verbietet beides
        gleichzeitig ohnehin.
        """
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        # Freigabe-Zahn (0463, EU AI Act Art. 50 Abs. 4). Begruendung und
        # Abgrenzung zum check-Constraint stehen in `ki_herkunft`.
        ki_herkunft.veroeffentlichung_pruefen(self._db, tenant_id, page_id)
        (
            self._db.table("site_pages")
            .update({"is_published": True, "is_draft": False})
            .eq("id", page_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return self._load_page(tenant_id, page_id)

    def unpublish_page(self, ctx: AuthContext, page_id: str) -> PageResponse:
        return self._set_published(ctx, page_id, False)

    def delete_page(self, ctx: AuthContext, page_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        zeile = self._own_page(tenant_id, page_id)
        # Die Startseite ist nicht löschbar: ohne sie liefert die Domain nur
        # „noch nicht eingerichtet". Erst eine andere Seite zur Startseite
        # machen (`set_home_page`), dann diese löschen. Bis 05.09.2026 stand
        # dieser Riegel nur im Frontend — der API-Pfad war offen (Wurzel 3).
        if zeile.get("is_home"):
            raise SiteConfigError(
                "Die Startseite lässt sich nicht löschen — zuerst eine andere "
                "Seite als Startseite festlegen.",
                status_code=422,
            )
        # Eine Systemseite kann man nicht löschen — ihre Route antwortet
        # weiterhin. Sie zu entfernen hieße nur, ihre SEO-Angaben zu verlieren
        # und sie beim nächsten Blick in die Liste neu und leer anzulegen.
        if systemseiten.ist_systemseite(zeile):
            raise SiteConfigError(
                "Systemseiten gehören zur Buchungsstrecke und lassen sich "
                "nicht löschen.",
                status_code=422,
            )
        # Dieselbe Sperre für die dynamische Seite — und aus demselben Grund:
        # die Route antwortet weiter, gelöscht würden nur das Layout und die
        # SEO-Angaben, und die Seite entstünde beim nächsten Blick in die Liste
        # neu und leer.
        if dynamische_seiten.ist_dynamisch(zeile):
            raise SiteConfigError(
                "Die Objektseite ist die Vorlage für alle Objekte und lässt "
                "sich nicht löschen.",
                status_code=422,
            )
        # Blöcke hängen per FK on delete cascade; Seite löschen genügt.
        self._db.table("site_pages").delete().eq("id", page_id).eq(
            "tenant_id", tenant_id
        ).execute()

    # === Page-Builder: öffentlicher Resolver (service-role, kein JWT) ========

    @staticmethod
    def _seo_meta(
        page: dict,
        branding: PublicSiteResponse,
        trail: list[dict] | None = None,
        fassung: dict | None = None,
    ) -> PublicPageMeta:
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
        `noindex=false` gespeichert ist — und genau das ist der Default.

        `fassung` ist die Sprachfassung dieser Seite (0476), falls eine für die
        angeforderte Sprache existiert. Sie steht in der Rangfolge GANZ VORN —
        vor der Seite und vor dem site-weiten Rückfall:

            Fassung → Seite → Website

        Eine fehlende Fassung ist kein Fehler: dann gilt der bisherige Weg, und
        die Seite erscheint in ihrer Ausgangssprache. Das ist bei den
        Metadaten zulässig (Google bewertet den Hauptinhalt, und der kommt aus
        den Abschnitten), beim `title` aber sichtbar — deshalb wird eine
        Sprachfassung nur angelegt, wenn sie einen Titel hat.

        Ein LEERES Feld der Fassung zählt nicht als Wert. `or` statt eines
        `is not None`-Vergleichs ist hier Absicht: ein leerer Meta-Titel in der
        dänischen Fassung soll den deutschen durchlassen, nicht einen leeren
        `<title>` erzeugen."""
        f = fassung or {}
        return PublicPageMeta(
            slug=page["slug"],
            # Der Titel der Fassung gewinnt: er ist der Menüpunkt und die <h1>,
            # also genau das, was der Gast in seiner Sprache erwartet.
            title=f.get("title") or page["title"],
            # Der Brotkrumen-Pfad (0450). Leer, wenn die Seite keine
            # übergeordnete hat — der Abschnitt zeigt dann nichts, statt eine
            # einstufige Krume zu rendern, die nichts aussagt.
            trail=[PublicTrailItem(**t) for t in (trail or [])],
            seo_title=(
                f.get("seo_title") or page.get("seo_title") or branding.seo_title
            ),
            seo_description=(
                f.get("seo_description")
                or page.get("seo_description")
                or branding.seo_description
            ),
            og_image_url=page.get("og_image_url"),
            # Der Alternativtext folgt derselben Rangfolge wie die übrigen
            # Textfelder: Fassung vor Original. Er ist Prosa und gehört
            # übersetzt — ein Screenreader liest ihn vor.
            og_image_alt=f.get("og_image_alt") or page.get("og_image_alt"),
            seo_keywords=(
                f.get("seo_keywords")
                or page.get("seo_keywords")
                or branding.seo_keywords
            ),
            canonical_url=page.get("canonical_url"),
            head_html=page.get("head_html"),
            noindex=bool(page.get("noindex")) or branding.noindex,
        )

    def sprachfassung(self, page_id: str, sprache: str | None) -> dict | None:
        """Die Sprachfassung einer Seite (0476), falls es eine gibt.

        `None` bei fehlender Sprache, fehlender Zeile oder Fehler — der Aufrufer
        faellt dann auf die Felder der Seite zurueck. KEIN Rueckfall auf eine
        ANDERE Sprache: eine daenische Anfrage mit schwedischem Titel zu
        beantworten waere eine Falschaussage, die niemand als Fehler erkennt
        (dieselbe Klasse wie Wurzel 5b).

        Auch `geprueft`/`quelle_hash` werden NICHT geprueft: eine veraltete
        Fassung ist immer noch die richtige Sprache, und ein Gast, der wegen
        eines nachgezogenen deutschen Halbsatzes wieder Deutsch zu lesen bekaeme,
        waere schlechter dran. Veraltet zu SEHEN ist die Aufgabe des Baukastens,
        nicht des Renderers.
        """
        if not sprache:
            return None
        rows = (
            self._db.table("site_page_translations")
            .select(
                "title, seo_title, seo_description, seo_keywords, "
                "excerpt, og_image_alt"
            )
            .eq("page_id", page_id)
            .eq("sprache", sprache)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def resolve_page(
        self,
        host: str,
        slug: str | None = None,
        ticket: str | None = None,
        sprache: str | None = None,
    ) -> PublicPageResponse:
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
        # Passwortschutz (0442). Der Riegel sitzt HIER und nicht im Renderer:
        # der Renderer ist eine zweite Anwendung, die dieselbe API benutzt, und
        # eine Prüfung dort wäre mit einem direkten Aufruf dieses Endpunkts
        # umgangen. Ohne gültiges Ticket kommen die Blöcke gar nicht erst aus
        # der Datenbank — ein 401 mit gefüllter Antwort wäre kein Schutz.
        if page.get("access_password_hash") and not seiten_zugang.ticket_gilt(
            self._draft_secret(), str(page["id"]), ticket
        ):
            raise SiteConfigError(
                "Diese Seite ist mit einem Passwort geschützt.", status_code=401
            )
        block_rows = (
            self._db.table("site_blocks")
            .select("id, parent_id, kind, span, type, content, settings")
            .eq("page_id", page["id"])
            .order("position")
            .execute()
        ).data or []
        branding = self._public_branding(tenant_id)
        return PublicPageResponse(
            tenant_id=tenant_id,
            page=self._seo_meta(
                page,
                branding,
                seiten.pfad_bauen(self._db, tenant_id, page),
                # Die Sprachfassung (0476). Ohne sie stand hier der deutsche
                # Titel auch auf der daenischen Adresse — und was in der
                # Trefferliste steht, sind Titel und Beschreibung.
                self.sprachfassung(str(page["id"]), sprache),
            ),
            # Der Baum entsteht an EINER Stelle (`baum.baum_bauen`) — sonst
            # löste jeder der sieben Resolver die Eltern-Kind-Beziehung selbst
            # auf, und sechs davon würden beim nächsten Feld vergessen.
            blocks=baum.baum_bauen(
                block_rows,
                kennung=formulare.block_kennung,
                tenant_id=tenant_id,
            ),
            branding=branding,
        )

    def _public_nav(
        self, tenant_id: str, *, nur_veroeffentlicht: bool = True
    ) -> PublicNav:
        """Menüstruktur der Kunden-Site.

        Auf einer GAST-Seite nur veröffentlichte Seiten — ein Entwurf hat im
        Menü einer öffentlichen Website nichts zu suchen.

        Im ENTWURF (`nur_veroeffentlicht=False`) alle: die Vorschau soll zeigen,
        wie die Seite aussieht, und der Editor listet daneben genau diese
        Seiten unter „Kopfzeile". Vorher lief der Entwurf über denselben Filter
        und zeigte deshalb eine leere Kopfzeile, während links vier Seiten
        standen — gemeldet am 26.08.2026 („Kopfzeile zeigt die Unterseiten
        nicht an"); alle vier trugen `is_published = false`, also war die
        Vorschau formal richtig und trotzdem unbrauchbar.

        Der Aufbau (Ordner, externe Menüpunkte, Rückfall bei unveröffentlichtem
        Ordner) steht in `seiten.navigation_bauen`: es ist Seitenstruktur, nicht
        Datenzugriff, und der Service liegt an der `pylint`-Zeilengrenze."""
        abfrage = (
            self._db.table("site_pages")
            .select(
                "id, slug, title, nav_area, page_type, external_url, parent_id"
            )
            .eq("tenant_id", tenant_id)
        )
        if nur_veroeffentlicht:
            abfrage = abfrage.eq("is_published", True)
        rows = (
            abfrage.in_("nav_area", ["header", "footer"])
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

    # === Zugang, Entwurf, Einzelveroeffentlichung (0442/0443) =============
    # Duenne Delegationen: die Logik steht in `seiten_zugang`, weil dieser
    # Service sonst ueber die Zeilengrenze laeuft, die `pylint` hier setzt.
    # Der Tenant-Scope und das Laden der Zeile bleiben HIER — sie sind die
    # Aufgabe des Service (Wurzel 3), nicht die des Fachmoduls.

    def set_page_access(
        self, ctx: AuthContext, page_id: str, passwort: str | None
    ) -> None:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        seiten_zugang.zugang_setzen(self._db, tenant_id, page_id, passwort)

    def set_page_draft(
        self, ctx: AuthContext, page_id: str, entwurf: bool
    ) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        seite = self._own_page(tenant_id, page_id)
        seiten_zugang.entwurf_setzen(
            self._db, tenant_id, page_id, seite, entwurf
        )
        return self._load_page(tenant_id, page_id)

    def publish_page_single(self, ctx: AuthContext, page_id: str) -> PageResponse:
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        # Derselbe Zahn: die Einzelveroeffentlichung ist ein zweiter Weg live,
        # kein anderer Massstab.
        ki_herkunft.veroeffentlichung_pruefen(self._db, tenant_id, page_id)
        seiten_zugang.einzeln_veroeffentlichen(self._db, tenant_id, page_id)
        return self._load_page(tenant_id, page_id)

    def seite_freischalten(
        self, host: str, slug: str | None, passwort: str
    ) -> str:
        """Der einzige oeffentliche Weg (kein JWT). Der Host wird hier
        aufgeloest — inklusive des Schalters „Website offline"."""
        tenant_id = self._tenant_id_for_host(host)
        if self._ist_offline(tenant_id):
            raise SiteConfigError("Website ist offline.", status_code=404)
        return seiten_zugang.freischalten(
            self._db, tenant_id, slug, passwort, self._draft_secret()
        )

    def resolve_page_draft(
        self, page_id: str, token: str, sprache: str | None = None
    ) -> PublicPageResponse:
        """Rendert eine Seite (auch UNVERÖFFENTLICHT) für den Editor-iframe —
        nur mit gültigem, nicht abgelaufenem Token. Kein JWT (cross-origin
        iframe). Token bindet tenant_id + page_id.

        `sprache` wirkt hier GENAUSO wie im öffentlichen Pfad (0476): die
        Vorschau muss zeigen, was der Gast sieht. Stellte der Baukasten auf
        Dänisch um und die Vorschau zeigte weiter den deutschen Titel, wäre der
        Umschalter eine Attrappe — man würde die fehlende Fassung erst nach dem
        Veröffentlichen bemerken."""
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
            .select("id, parent_id, kind, span, type, content, settings")
            .eq("page_id", page_id)
            .order("position")
            .execute()
        ).data or []
        # `entwurf=True`: die Vorschau zeigt das Menü so, wie es der Editor
        # daneben listet — auch mit noch unveröffentlichten Seiten. Auf einer
        # Gast-Seite bleibt der Filter (siehe `_public_nav`).
        branding = self._public_branding(tenant_id, entwurf=True)
        return PublicPageResponse(
            tenant_id=tenant_id,
            page=self._seo_meta(
                page, branding, None, self.sprachfassung(str(page["id"]), sprache)
            ),
            # Der Baum entsteht an EINER Stelle (`baum.baum_bauen`) — sonst
            # löste jeder der sieben Resolver die Eltern-Kind-Beziehung selbst
            # auf, und sechs davon würden beim nächsten Feld vergessen.
            blocks=baum.baum_bauen(
                block_rows,
                # Im ENTWURF reist die DB-Kennung JEDES Knotens mit.
                #
                # Auf einer Gast-Seite gibt `formulare.block_kennung` sie nur
                # dort heraus, wo sie gebraucht wird (Formular-Absenden) — eine
                # interne ID hat auf einer öffentlichen Seite nichts zu suchen.
                # Der Entwurf ist aber KEINE Gast-Seite: er läuft nur im
                # Editor-iframe, hinter einem Token, und dort ist die ID die
                # einzige verlässliche Zuordnung zwischen Renderer und Editor.
                #
                # Vorher galt hier dieselbe Regel wie öffentlich, also kam
                # KEINE ID an. Jede Stelle, die „über die ID zuordnen, Index
                # nur als Notweg" tut (Brücke, Overlay, Zeilenfindung), fiel
                # damit immer auf den Notweg zurück — und der zählt im
                # Renderer-Raum (0..17) statt im Editor-Raum (0..5). Live
                # nachgemessen am 26.08.2026: 18 Knoten in der Vorschau, kein
                # einziger mit `data-block-id`.
                kennung=lambda _typ, zeile: str(zeile["id"]),
                tenant_id=tenant_id,
            ),
            branding=branding,
            # Ist die Seite ein BEITRAG, reist er mit. Ein Beitrag hat keine
            # Abschnitte — sein Inhalt steht in `content_html` und den
            # Beitragsfeldern (0483/0485). Ohne diese Zeilen zeigte der
            # Editor-iframe fuer einen Beitrag eine weisse Flaeche, und „Im
            # Editor oeffnen" fuehrte ins Leere (28.08.2026).
            #
            # `beitrag_fuer_vorschau` steht in `weiterleitungen` neben dem
            # oeffentlichen Weg: dieselbe Umrechnung von `post_`-Spalten in
            # die Antwort, an genau einer Stelle (Wurzel 2).
            post=(
                beitrag_fuer_vorschau(page)
                if page.get("page_type") == PageType.post.value
                else None
            ),
            eigene_felder=(
                [
                    PublicPostEigenesFeld(feld_key=f.feld_key, label=f.label)
                    for f in eigene_felder_laden(
                        self._db, tenant_id
                    ).felder
                    if not f.versteckt
                ]
                if page.get("page_type") == PageType.post.value
                else []
            ),
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

    def _validate_settings(self, settings: dict | None) -> dict:
        """Die Darstellungs-Settings eines Abschnitts prüfen und normalisieren.

        BISHER GAB ES DAS NICHT. `BlockSettings` stand im Schema, wurde aber an
        keiner Stelle aufgerufen: `settings` ging als roher `dict` vom Client in
        die Datenbank und von dort in den Renderer. Damit war der Kommentar im
        Renderer („die Adresse ist beim Speichern gegen die href-Allowlist
        geprüft") schlicht falsch — `background_image_url` landete ungeprüft in
        einem `url()`, und `background_color` ungeprüft in einem `style`
        (Wurzel 8: Client-Input, der serverseitig gerendert wird, ist ein
        Angriff).

        Unbekannte Schlüssel bleiben erhalten (`extra="allow"` im Modell): das
        Feld, das ein anderer Teil des Editors gerade dazubaut, darf hier nicht
        stillschweigend verschwinden.
        """
        try:
            geprueft = BlockSettings.model_validate(settings or {})
        except ValidationError as exc:
            log.warning(
                "site_blocks_settings_ungueltig",
                schluessel=sorted((settings or {}).keys()),
                fehler=str(exc),
            )
            raise SiteConfigError(
                "Ungültige Abschnitts-Einstellung.", status_code=400
            ) from exc
        return geprueft.model_dump(mode="json", exclude_none=True)

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

    @staticmethod
    def _sperre_pruefen(block: dict) -> None:
        """Eine GESPERRTE Ebene (``settings.locked``) bewegt, kopiert und löscht
        sich nicht — auch nicht per API.

        Bis 05.09.2026 prüfte das Flag niemand: es stand nur in der
        Oberfläche, und ein Aufruf an ``/blocks/{id}/move``, ``/duplicate``
        oder ``DELETE`` ging ungehindert durch. Ein Schutz, der nur wirkt,
        solange man die React-Oberfläche benutzt, ist keiner (Wurzel 6).
        Entsperren geht weiterhin über ``update_block`` (``locked: false``).
        """
        settings = block.get("settings") or {}
        if isinstance(settings, dict) and settings.get("locked") is True:
            raise SiteConfigError(
                "Diese Ebene ist gesperrt — zuerst entsperren.", status_code=422
            )

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
        daten = {
            k: row[k]
            for k in PageResponse.model_fields
            if row.get(k) is not None
        }
        # DB-Praefix `post_` (0483) nach aussen abstreifen.
        daten.update(seiten.beitragsfelder_ohne_praefix(row))
        # Der Hash geht NIE nach draussen (0442) — nur die Tatsache, dass es
        # einen gibt. `_page_row` ist die eine Stelle, an der Zeilen zu
        # Antworten werden; hier abzuleiten heisst, es nirgends zu vergessen.
        daten["hat_passwort"] = bool(row.get("access_password_hash"))
        return daten

    @staticmethod
    def _block_row(row: dict) -> dict:
        out = {k: row.get(k) for k in BlockResponse.model_fields}
        out["content"] = row.get("content") or {}
        out["settings"] = row.get("settings") or {}
        return out
