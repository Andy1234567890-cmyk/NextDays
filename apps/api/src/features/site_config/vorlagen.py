"""Vorlagen-Galerie des Website-Baukastens: auflisten und vorab ansehen.

Als MIXIN und nicht als eigener Service — dieselbe Begründung wie bei
``MediathekMixin``: der Router ruft ``service.list_templates``, und ein zweiter
Dienst nur für Vorlagen wäre eine zweite Dependency und ein zweiter Ort, an dem
man den Tenant-Scope vergessen kann. Der Anlass war auch hier eine Zeilenzahl:
``service.py`` lief über die 1500-Zeilen-Grenze von ``pylint``.

Der Schnitt ist trotzdem der richtige: das Anwenden einer Vorlage
(``apply_template``) schreibt in die Datenbank und gehört zum Seiten-CRUD, das
AUFLISTEN und die VORSCHAU dagegen lesen nur Fixtures und signieren einen Token.

Das Mixin setzt voraus, dass die Basisklasse ``_require_tenant``,
``_public_branding``, ``_validate_content``, ``_draft_secret`` und
``_DRAFT_TTL_SECONDS`` mitbringt.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from typing import TYPE_CHECKING

from . import seiten_vorlagen, strecken_vorlagen
from . import templates as site_templates
from .fehler import SiteConfigError
from .schemas import (
BlockType,
    NavArea,
    PublicBlock,
    PublicNav,
    PublicNavItem,
    PublicPageMeta,
    PublicPageResponse,
    PublicSiteResponse,
    SeitenVorlagenListResponse,
    SeitenVorlageSummary,
    StreckenListResponse,
    StreckeSummary,
    TemplateListResponse,
    TemplatePageSummary,
    TemplateSummary,
)

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import AuthContext


class VorlagenMixin:
    """Welche Vorlagen es gibt und wie eine aussieht, BEVOR man sie anwendet."""

    def list_templates(self, ctx: AuthContext) -> TemplateListResponse:
        """Die Vorlagen-Galerie. Der Server ist die einzige Quelle der IDs."""
        self._require_tenant(ctx)
        eintraege: list[TemplateSummary] = []
        for tid in site_templates.TEMPLATE_REIHENFOLGE:
            tmpl = site_templates.TEMPLATES.get(tid)
            if not tmpl:
                # Ein Eintrag in der Reihenfolge ohne Vorlage wäre eine leere
                # Kachel. Überspringen statt raten (Wurzel 4).
                continue
            eintraege.append(
                TemplateSummary(
                    id=tid,
                    kategorie=str(tmpl.get("kategorie") or "vermietung"),
                    name=dict(tmpl.get("name") or {}),
                    description=dict(tmpl.get("description") or {}),
                    preview_image=self._template_vorschaubild(tmpl),
                    primary_color=(tmpl.get("branding") or {}).get("primary_color"),
                    pages=[
                        TemplatePageSummary(
                            slug=p["slug"],
                            title=p["title"],
                            nav_area=NavArea(p.get("nav_area", NavArea.header.value)),
                            block_count=len(p.get("blocks", [])),
                        )
                        for p in tmpl.get("pages", [])
                    ],
                )
            )
        return TemplateListResponse(
            templates=eintraege, kategorien=list(site_templates.KATEGORIEN)
        )

    @staticmethod
    def _template_vorschaubild(tmpl: dict) -> str | None:
        """Das Hero-Bild der Startseite — oder nichts.

        Kein Ersatzbild aus einer anderen Seite: ein Vorschaubild, das nicht
        zeigt, was oben steht, führt in die Irre (Wurzel 4)."""
        for page in tmpl.get("pages", []):
            if not page.get("is_home"):
                continue
            for block in page.get("blocks", []):
                if block.get("type") == "hero":
                    return (block.get("content") or {}).get("image_url")
        return None

    def list_seiten_vorlagen(
        self, ctx: AuthContext
    ) -> SeitenVorlagenListResponse:
        """Vorlagen für EINZELNE Seiten (0434) — dieselbe Quelle wie beim Anlegen."""
        self._require_tenant(ctx)
        return SeitenVorlagenListResponse(
            vorlagen=[
                SeitenVorlageSummary(
                    id=vid,
                    title=dict(v.get("titel") or {}),
                    slug=str(v.get("slug") or ""),
                    block_count=len(v.get("blocks", [])),
                    block_types=[b["type"] for b in v.get("blocks", [])],
                )
                for vid in seiten_vorlagen.VORLAGEN_REIHENFOLGE
                if (v := seiten_vorlagen.VORLAGEN.get(vid)) is not None
            ]
        )

    # --- Vorschau einer Vorlage, BEVOR sie angewendet wird -------------------
    # Derselbe Weg wie die Entwurfs-Vorschau: der Renderer läuft als eigener
    # Dienst ohne Nutzer-JWT, also hängt der Zugriff an einem kurzlebigen
    # HMAC-Token. Der Token trägt hier zusätzlich die tenant_id, weil es — anders
    # als bei einer Seite — keine DB-Zeile gibt, aus der man sie lesen könnte.
    def create_template_preview_token(
        self, ctx: AuthContext, template_id: str
    ) -> str:
        tenant_id = self._require_tenant(ctx)
        if template_id not in site_templates.TEMPLATES:
            raise SiteConfigError("Unbekanntes Template.", status_code=404)
        exp = int(time.time()) + self._DRAFT_TTL_SECONDS
        sig = self._sign_template(tenant_id, template_id, exp)
        return f"{tenant_id}.{exp}.{sig}"

    def _sign_template(self, tenant_id: str, template_id: str, exp: int) -> str:
        # Eigener Namensraum („tpl"): ein Seiten-Token darf nie als
        # Vorlagen-Token durchgehen und umgekehrt.
        msg = f"tpl.{tenant_id}.{template_id}.{exp}".encode()
        return hmac.new(self._draft_secret(), msg, hashlib.sha256).hexdigest()

    def resolve_template_draft(
        self, template_id: str, slug: str | None, token: str
    ) -> PublicPageResponse:
        """Rendert EINE Seite einer Vorlage, ohne sie anzulegen.

        Fail-CLOSED: ein fehlender, abgelaufener oder gefälschter Token gibt 403,
        nie eine Seite. Angreiferkontrollierter Input darf keinen 500 werfen
        (Wurzel 5) — deshalb wird das Token-Format defensiv zerlegt."""
        tmpl = site_templates.TEMPLATES.get(template_id)
        if not tmpl:
            raise SiteConfigError("Unbekanntes Template.", status_code=404)
        tenant_id = self._verify_template_token(template_id, token)
        seiten_liste = list(tmpl.get("pages", []))
        gesucht = slug or ""
        page = next(
            (p for p in seiten_liste if p["slug"] == gesucht),
            None,
        )
        if page is None:
            raise SiteConfigError("Seite nicht gefunden.", status_code=404)
        return PublicPageResponse(
            tenant_id=tenant_id,
            page=PublicPageMeta(slug=page["slug"], title=page["title"], noindex=True),
            # Vorlagen-Blöcke stehen als JSON in der Vorlage und tragen (noch)
            # keine Baum-Felder. Sie werden deshalb hier in die Form gebracht,
            # die der Renderer erwartet: jeder Block als eigener Abschnitt mit
            # einer Spalte über die volle Breite — dieselbe Einordnung, die
            # 0472 mit dem Bestand gemacht hat.
            #
            # Sobald die Vorlagen selbst Spalten führen, entfällt das hier und
            # `baum.baum_bauen` übernimmt auch sie.
            blocks=[
                _als_abschnitt(
                    PublicBlock(
                        type=BlockType(b["type"]),
                        content=self._validate_content(
                            BlockType(b["type"]), dict(b.get("content") or {})
                        ),
                        settings=dict(b.get("settings") or {}),
                    )
                )
                for b in page.get("blocks", [])
            ],
            branding=self._template_branding(tenant_id, tmpl, seiten_liste),
        )

    def _verify_template_token(self, template_id: str, token: str) -> str:
        """Token → tenant_id. Wirft 403, wenn irgendetwas nicht stimmt."""
        teile = (token or "").split(".")
        if len(teile) != 3:
            raise SiteConfigError("Ungültiger Vorschau-Token.", status_code=403)
        tenant_id, exp_text, _sig = teile
        try:
            exp = int(exp_text)
        except ValueError as exc:
            raise SiteConfigError(
                "Ungültiger Vorschau-Token.", status_code=403
            ) from exc
        if exp < int(time.time()):
            raise SiteConfigError("Vorschau-Token abgelaufen.", status_code=403)
        erwartet = f"{tenant_id}.{exp}.{self._sign_template(tenant_id, template_id, exp)}"
        if not hmac.compare_digest(erwartet, token):
            raise SiteConfigError("Ungültiger Vorschau-Token.", status_code=403)
        return tenant_id

    def list_strecken(self, ctx: AuthContext) -> StreckenListResponse:
        """Die Strecken-Vorlagen (0474) — EINE Quelle für die Auswahl.

        Ohne Anzeigenamen: die stehen im Übersetzungskatalog des Dashboards.
        Ein Name in dieser Antwort wäre in genau einer Sprache und damit für 23
        andere falsch.
        """
        self._require_tenant(ctx)
        return StreckenListResponse(
            strecken=[
                StreckeSummary(
                    key=s.key,
                    objekt_bloecke=len(s.objekt),
                    checkout_bloecke=len(s.checkout),
                    bestaetigung_bloecke=len(s.bestaetigung),
                )
                for s in strecken_vorlagen.STRECKEN
            ]
        )

    # --- Vorschau einer BUCHUNGSSTRECKE, bevor sie angewendet wird (0474) ----
    # Warum eine echte Vorschau und keine gezeichnete Skizze: die drei Strecken
    # unterscheiden sich in Anordnung UND Wirkung — ob die Zusammenfassung
    # seitlich mitläuft oder oben klebt, sieht man erst mit einem echten Objekt
    # darin. Eine Skizze aus Rechtecken zeigt die Anordnung und verschweigt,
    # wie es sich anfühlt.
    #
    # Der Preis dafür ist ein Beispielobjekt: ohne Objekt hat die Objektseite
    # nichts zu zeigen. Es kommt aus dem BESTAND des Betriebs (das zuletzt
    # angelegte aktive), nicht aus erfundenen Daten — eine Vorschau mit einem
    # Fantasie-Haus für 149 € wäre genau der plausible Ersatzwert, den Wurzel 4
    # verbietet. Hat der Betrieb kein aktives Objekt, sagt die Antwort das
    # ausdrücklich (`beispiel_objekt_id is None`), und die Oberfläche zeigt den
    # Grund statt einer leeren Fläche.
    def create_strecke_preview_token(
        self, ctx: AuthContext, strecke_key: str
    ) -> tuple[str, str | None]:
        """Token und Beispielobjekt für die Vorschau einer Strecken-Vorlage.

        Gibt ``(token, beispiel_objekt_id)`` zurück. Die Objekt-ID ist ``None``,
        wenn der Betrieb kein aktives Objekt hat — das ist eine Aussage und kein
        Fehler: die Buchung lässt sich dann trotzdem ansehen, nur die
        Objektseite nicht.
        """
        tenant_id = self._require_tenant(ctx)
        if strecken_vorlagen.finde(strecke_key) is None:
            raise SiteConfigError(
                "Unbekannte Vorlage für die Buchungsstrecke.", status_code=404
            )
        exp = int(time.time()) + self._DRAFT_TTL_SECONDS
        sig = self._sign_strecke(tenant_id, strecke_key, exp)
        # DASSELBE Kriterium, das der Renderer anlegt (`schaufenster.py`):
        # `status='active'` UND `listed_on_website=true`. Nur `status` zu prüfen
        # war falsch — es gibt aktive Objekte, die der Betrieb im Reiter
        # „Objekte" bewusst von seiner Website genommen hat. Die Vorschau hätte
        # dann ein Objekt gezeigt, das dort nie erscheint.
        #
        # Fehlt die Spalte an einer alten Zeile, gilt sie als NICHT gelistet:
        # das ist der Spalten-Default, und im Zweifel weniger zu zeigen ist hier
        # die richtige Richtung.
        zeilen = (
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("status", "active")
            .eq("listed_on_website", True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        objekt_id = zeilen[0]["id"] if zeilen else None
        return f"{tenant_id}.{exp}.{sig}", objekt_id

    def _sign_strecke(self, tenant_id: str, strecke_key: str, exp: int) -> str:
        # Eigener Namensraum („str"): weder ein Seiten- noch ein Vorlagen-Token
        # darf hier durchgehen.
        msg = f"str.{tenant_id}.{strecke_key}.{exp}".encode()
        return hmac.new(self._draft_secret(), msg, hashlib.sha256).hexdigest()

    def resolve_strecke_draft(
        self, strecke_key: str, seite: str, token: str
    ) -> PublicPageResponse:
        """Rendert EINE Seite einer Strecken-Vorlage, ohne sie anzulegen.

        ``seite`` ist ``objekt``, ``checkout`` oder ``bestaetigung`` — der
        Abschnitt der Strecke, nicht ein Slug: eine Strecke hat keine Slugs, sie
        setzt die Bausteine bestehender Seiten.

        Fail-CLOSED wie bei der Vorlagen-Vorschau: fehlender, abgelaufener oder
        gefälschter Token gibt 403, nie eine Seite.
        """
        strecke = strecken_vorlagen.finde(strecke_key)
        if strecke is None:
            raise SiteConfigError(
                "Unbekannte Vorlage für die Buchungsstrecke.", status_code=404
            )
        tenant_id = self._verify_strecke_token(strecke_key, token)
        bausteine = {
            "objekt": strecke.objekt,
            "checkout": strecke.checkout,
            "bestaetigung": strecke.bestaetigung,
        }.get(seite)
        if bausteine is None:
            raise SiteConfigError("Unbekannter Abschnitt.", status_code=404)
        return PublicPageResponse(
            tenant_id=tenant_id,
            # `noindex`, weil diese Antwort eine Vorschau ist und keine Seite,
            # die es gibt. Der Slug ist der Abschnittsname und keine Adresse —
            # es gibt für ihn bewusst keine öffentliche Route.
            #
            # `title` ist ein leerer STRING und kein leeres Dict: das Feld ist
            # einsprachig (der Renderer nimmt es für `aktiverSlug`, nicht für
            # eine Anzeige). Ein Dict hier warf einen 500 aus einem Aufruf mit
            # gültigem Token — also aus angreiferkontrollierbarem Input, genau
            # was Wurzel 5 verbietet.
            page=PublicPageMeta(slug=seite, title="", noindex=True),
            blocks=[
                _als_abschnitt(
                    PublicBlock(
                        type=BlockType(b["type"]),
                        content=self._validate_content(
                            BlockType(b["type"]), dict(b.get("content") or {})
                        ),
                        settings=dict(b.get("settings") or {}),
                    )
                )
                for b in bausteine
            ],
            # Das ECHTE Branding des Betriebs. Anders als eine Website-Vorlage
            # bringt eine Strecken-Vorlage keine Farben mit (siehe
            # strecken_vorlagen), es gibt hier also nichts zu überlagern.
            branding=self._public_branding(tenant_id),
        )

    def _verify_strecke_token(self, strecke_key: str, token: str) -> str:
        """Token → tenant_id. Wirft 403, wenn irgendetwas nicht stimmt."""
        teile = (token or "").split(".")
        if len(teile) != 3:
            raise SiteConfigError("Ungültiger Vorschau-Token.", status_code=403)
        tenant_id, exp_text, _sig = teile
        try:
            exp = int(exp_text)
        except ValueError as exc:
            raise SiteConfigError(
                "Ungültiger Vorschau-Token.", status_code=403
            ) from exc
        if exp < int(time.time()):
            raise SiteConfigError("Vorschau-Token abgelaufen.", status_code=403)
        erwartet = (
            f"{tenant_id}.{exp}.{self._sign_strecke(tenant_id, strecke_key, exp)}"
        )
        if not hmac.compare_digest(erwartet, token):
            raise SiteConfigError("Ungültiger Vorschau-Token.", status_code=403)
        return tenant_id

    def _template_branding(
        self, tenant_id: str, tmpl: dict, seiten_liste: list[dict]
    ) -> PublicSiteResponse:
        """Branding der Vorschau = was nach dem Anwenden WIRKLICH dastünde.

        Also: das echte Branding des Betriebs, und die Tokens der Vorlage nur
        dort, wo bisher nichts gesetzt ist — dieselbe Regel wie in
        ``_apply_template_branding``. Eine Vorschau, die die Vorlagenfarben zeigt
        und danach die eigenen behält, wäre eine Falschaussage."""
        branding = self._public_branding(tenant_id)
        for feld, wert in (tmpl.get("branding") or {}).items():
            if getattr(branding, feld, "fehlt") is None:
                setattr(branding, feld, wert)
        # Die Navigation kommt aus der VORLAGE, nicht aus den bestehenden
        # Seiten: die Vorschau soll das Menü zeigen, das die Vorlage mitbringt.
        branding.nav = PublicNav(
            header=[
                PublicNavItem(slug=p["slug"], title=p["title"])
                for p in seiten_liste
                if p.get("nav_area", NavArea.header.value) == NavArea.header.value
            ],
            footer=[
                PublicNavItem(slug=p["slug"], title=p["title"])
                for p in seiten_liste
                if p.get("nav_area") == NavArea.footer.value
            ],
        )
        return branding


def _als_abschnitt(widget: PublicBlock) -> PublicBlock:
    """Einen einzelnen Baustein in `Abschnitt > Spalte > Baustein` einpacken.

    Der Renderer kennt seit 0472 nur noch den Baum. Ein Baustein, der direkt an
    der Seite hinge, wäre der eine Sonderfall, den er zusätzlich behandeln
    müsste — und Sonderfälle im Renderer sind die Stellen, an denen Layout und
    Wirklichkeit auseinanderlaufen.

    Die Darstellungs-Einstellungen wandern an den ABSCHNITT: Hintergrund und
    Abstände wirken dort. Der Baustein behält sie zusätzlich, damit nichts
    verloren geht, was ein Block-Renderer daraus liest.
    """
    spalte = PublicBlock(
        type=BlockType("container"),
        kind="column",
        span=12,
        children=[widget],
    )
    return PublicBlock(
        type=BlockType("container"),
        kind="section",
        settings=dict(widget.settings),
        children=[spalte],
    )
