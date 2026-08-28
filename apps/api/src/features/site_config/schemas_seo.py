"""Weiterleitungen, Sitemap und SEO-Befunde des Website-Baukastens (0430).

WARUM EINE EIGENE DATEI
=======================
Ausgelagert aus `schemas.py`, das mit 1522 Zeilen ueber pylints Grenze von
1500 lag (C0302). Die Grenze ist kein Selbstzweck: in einem Modul dieser
Groesse findet niemand mehr, ob ein Feld schon existiert, und es entstehen
zwei Modelle fuer dieselbe Sache.

Der Schnitt laeuft entlang der RESSOURCE und nicht entlang der Zeilenzahl:
Weiterleitung, Sitemap und SEO-Pruefung sind ein zusammenhaengender Bereich
(Reiter „SEO" im Baukasten, Router `weiterleitungen.py`). Ein Schnitt mitten
durch die Seitenmodelle haette dieselbe Zeilenzahl gebracht und den
Zusammenhang zerrissen.

Die Namen werden in `schemas.py` re-exportiert — bestehende Importe
(`from .schemas import RedirectCreate`) bleiben gueltig.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator

from .basis import _validate_redirect_target, _validate_source_path


# === URL-Weiterleitungen (0430) =============================================
# Warum eine eigene Ressource und kein Feld an der Config: eine Weiterleitung
# wird einzeln angelegt, einzeln gelöscht, muss eindeutig sein und wird pro
# 404 GESUCHT. Als JSON-Array müsste der Renderer bei jedem Fehlschlag die
# ganze Liste laden und in Python durchsuchen.
class RedirectType(StrEnum):
    """301 = dauerhaft (überträgt die Platzierung), 302 = vorübergehend.

    Als Enum und nicht als int, damit die Oberfläche zwei benannte Optionen
    zeigt statt eines Zahlenfeldes. Die DB speichert die Zahl (0430)."""

    permanent = "301"
    temporary = "302"


class RedirectCreate(BaseModel):
    source_path: str = Field(min_length=1, max_length=500)
    target: str = Field(min_length=1, max_length=2_000)
    redirect_type: RedirectType = RedirectType.permanent
    is_active: bool = True

    _v_source = field_validator("source_path")(_validate_source_path)
    _v_target = field_validator("target")(_validate_redirect_target)

    @model_validator(mode="after")
    def _keine_selbstschleife(self) -> RedirectCreate:
        """Quelle und Ziel dürfen nicht dieselbe Adresse sein.

        Hostaway listet „Redirect loops and self-references" als Fehlerursache
        und schreibt dazu: eine solche Konfiguration blockiert ALLE beteiligten
        Weiterleitungen. Die einstufige Selbstschleife lässt sich hier beim
        Speichern erkennen — und sie ist der Fall, der wirklich passiert
        (Kunde trägt /alt → /alt ein, weil er die Richtung verwechselt).

        Längere Ketten (A→B→C→A) fängt der Renderer beim Auflösen ab: er folgt
        einer Weiterleitung genau EINMAL. Sie hier zu prüfen hieße, den ganzen
        Graphen im Speicher zu halten und bei jedem Schreiben neu zu bewerten."""
        # Beide Felder sind zur Laufzeit `str`. Weil ihr Default als
        # `Field(...)` geschrieben ist, hält astroid sie statisch für
        # `FieldInfo` und meldet `rstrip` als fehlend — dasselbe Muster steht
        # ungemeldet in anderen Validatoren des Slices, deren Felder ohne
        # `Field(...)` deklariert sind.
        # pylint: disable=no-member
        if self.source_path.rstrip("/").lower() == self.target.rstrip("/").lower():
            raise ValueError("Quelle und Ziel sind identisch — das ist eine Schleife.")
        return self


class RedirectUpdate(BaseModel):
    """Teil-Update. `source_path` ist NICHT änderbar: der Pfad IST die Identität
    der Weiterleitung (unique je Tenant). Wer ihn ändern will, legt eine neue an
    und löscht die alte — dann ist der Zwischenzustand sichtbar statt still."""

    target: str | None = Field(default=None, max_length=2_000)
    redirect_type: RedirectType | None = None
    is_active: bool | None = None

    _v_target = field_validator("target")(_validate_redirect_target)


class RedirectResponse(BaseModel):
    id: str
    source_path: str
    target: str
    redirect_type: RedirectType
    is_active: bool
    created_at: str | None = None


class RedirectListResponse(BaseModel):
    items: list[RedirectResponse]
    total: int


class RedirectImportRequest(BaseModel):
    """Mehrere Weiterleitungen in einem Zug (CSV-Import der Oberfläche).

    Der Deckel liegt bei 200 Zeilen wie bei Hostaway — nicht als Nachahmung,
    sondern weil jeder unbegrenzte Bereich eine Obergrenze braucht (Wurzel 8):
    ohne sie ist eine 50-MB-CSV ein Datenbank-Schreibsturm über eine einzige
    HTTP-Anfrage."""

    items: list[RedirectCreate] = Field(min_length=1, max_length=200)
    # Vorhandene Einträge mit demselben Quellpfad überschreiben statt den ganzen
    # Import abzulehnen. Standard AUS: ein Import, der bestehende Weiterleitungen
    # still ändert, ist die unangenehmere Überraschung.
    overwrite: bool = False


class RedirectImportResult(BaseModel):
    """Was der Import wirklich getan hat — getrennt nach Wirkung.

    Drei Zahlen und nicht eine: „12 importiert" verschweigt, dass 8 davon
    bestehende Einträge überschrieben haben. Die Fehlerliste trägt die
    Zeilennummer, damit der Kunde sie in seiner Datei findet."""

    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)


# === Sitemap / robots / llms (0430) =========================================
class SitemapPage(BaseModel):
    """Eine Seite in der Sitemap. `slug` ist leer für die Startseite — den Pfad
    baut der Renderer, damit die Pfad-Bildung an einer Stelle liegt."""

    slug: str
    title: str = ""
    lastmod: str | None = None
    is_home: bool = False
    languages: list[str] | None = None


class SitemapProperty(BaseModel):
    id: str
    lastmod: str | None = None


class SitemapPost(BaseModel):
    """Ein Blog-Beitrag in der Sitemap (0438)."""

    slug: str
    title: str = ""
    lastmod: str | None = None


class SitemapResponse(BaseModel):
    """Datengrundlage für sitemap.xml, robots.txt und llms.txt.

    `abgeschnitten` ist bewusst Teil der Antwort: eine Sitemap, die nur die
    Hälfte enthält und vollständig aussieht, lässt Google die andere Hälfte
    ignorieren, ohne dass jemand die Ursache findet. Der Renderer schreibt es
    als Kommentar in die Datei."""

    pages: list[SitemapPage] = Field(default_factory=list)
    properties: list[SitemapProperty] = Field(default_factory=list)
    posts: list[SitemapPost] = Field(default_factory=list)
    abgeschnitten: bool = False
    # Site-weite Angaben, die der Renderer für robots.txt und llms.txt braucht,
    # ohne dafür einen zweiten Request zu stellen.
    noindex: bool = False
    site_name: str | None = None
    seo_description: str | None = None
    default_language: str | None = None
    languages: list[str] | None = None


class RedirectResolveResponse(BaseModel):
    """Antwort des öffentlichen Weiterleitungs-Lesepfads.

    `target` ist `None`, wenn es für diesen Pfad keine aktive Weiterleitung gibt
    — der Renderer zeigt dann seine 404-Seite. Ein 404 der API wäre hier falsch:
    „keine Weiterleitung" ist die normale Antwort, nicht ein Fehler."""

    target: str | None = None
    redirect_type: int | None = None


# === SEO-Befunde (Etappe B) =================================================
class SeoBefundSeite(BaseModel):
    """Eine Seite (oder ein Objekt) in einem Befund. `slug` ist bei Objekten
    leer — ihre Adresse ist /inserat/<id> und hat keinen."""

    id: str
    titel: str = ""
    slug: str = ""


class SeoBefund(BaseModel):
    """Ein Befund der SEO-Prüfung.

    `code` und nicht ein fertiger Satz: die Oberfläche übersetzt ihn in 24
    Sprachen. Ein Text aus dem Backend wäre auf Deutsch — und der Betrieb kann
    sein Dashboard auf Dänisch führen.

    `anzahl` ist die VOLLE Zahl, `seiten` höchstens die ersten zehn. Sonst
    stünde bei 200 betroffenen Seiten „10" da, und die Zahl wäre eine
    Falschaussage."""

    code: str
    schwere: str  # "fehler" | "warnung" | "hinweis"
    anzahl: int = 0
    seiten: list[SeoBefundSeite] = Field(default_factory=list)


class SeoPruefungResponse(BaseModel):
    """Ergebnis der SEO-Prüfung.

    Bewusst OHNE Punktzahl. Eine Zahl wie „87/100" wäre eine erfundene
    Bewertung (Wurzel 4): niemand kann sagen, was die fehlenden 13 Punkte sind,
    und Google bewertet ohnehin anders. Was zählt, ist die Liste."""

    items: list[SeoBefund] = Field(default_factory=list)
    # Wie viele veröffentlichte Seiten geprüft wurden. Ohne diese Zahl ist eine
    # leere Befundliste zweideutig: alles gepflegt — oder es gibt noch keine
    # veröffentlichte Seite?
    geprueft: int = 0
