"""Die Blog-Schemas des Website-Baukastens (0438/0457).

Ausgelagert aus `schemas.py` — aus demselben Grund wie `basis.py`,
`block_inhalte.py`, `schemas_bloecke.py` und `schemas_mediathek.py`: die Datei
stand ueber der `pylint`-Grenze von 1500 Zeilen. Der Blog ist dafuer der
natuerliche Schnitt: fuenf Modelle, die einen abgeschlossenen Bereich
beschreiben.

Der Import geht in DIESE Richtung — `schemas_blog` holt sich `PublicBlock`,
`PublicPageMeta` und `PublicSiteResponse` aus `schemas`, nicht umgekehrt. Der
Re-Export am Ende von `schemas.py` haelt `from .schemas import PublicPost` fuer
die uebrigen Module gueltig.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from .schemas import PublicBlock, PublicPageMeta, PublicSiteResponse


# === Blog (0438, Etappe H) ==================================================
class PublicPostFelder(BaseModel):
    """Die Vorlagenfelder eines Beitrags, wie die Website sie braucht (0483).

    Die Namen sind die des CMS ohne `post_`-Praefix — dieselben, die im
    Dashboard an den Spalten stehen. Eine zweite Benennung fuer den Renderer
    waere eine zweite Wahrheit darueber, wie ein Feld heisst (Wurzel 2).
    """

    industry: str | None = None
    client: str | None = None
    full_title: str | None = None
    intro_heading: str | None = None
    intro_body: str | None = None
    button_text: str | None = None
    website_link: str | None = None
    gallery_top: list[str] = Field(default_factory=list)
    gallery_left: str | None = None
    gallery_right: str | None = None
    gallery_bottom: list[str] = Field(default_factory=list)
    final_heading: str | None = None
    final_body: str | None = None
    show_carousel: bool = False
    carousel: list[str] = Field(default_factory=list)
    #: Die Werte der EIGENEN Felder (0485). Als Objekt und nicht als Liste:
    #: welche es gibt, weiss nur der Betrieb, und der Renderer sucht sie ueber
    #: ihren Schluessel.
    custom: dict[str, object] = Field(default_factory=dict)


class PublicPost(BaseModel):
    """Ein Beitrag in der Liste.

    OHNE Blöcke: die Liste zeigt Titel, Anriss und Bild. Die Abschnitte eines
    Beitrags wären bei zwanzig Einträgen zwanzig Block-Bäume in einer Antwort —
    für eine Übersicht, die davon nichts anzeigt."""

    slug: str
    title: str
    excerpt: str | None = None
    author: str | None = None
    cover_image_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    published_at: str | None = None
    # --- Blog-CMS (0480) -----------------------------------------------------
    #: Der Beitragstext als gesäubertes HTML. In der LISTE ist er `None` — sie
    #: zeigt ihn nicht, und zwanzig volle Texte in einer Übersichtsantwort
    #: wären zwanzigmal Ballast (Wurzel 8).
    content_html: str | None = None
    #: Das Buch, dessen Kapitel dieser Beitrag ist.
    parent_post_id: str | None = None
    # --- Vorlagenfelder (0483) und eigene Felder (0485) ----------------------
    #: NUR auf der Detailseite gefuellt (`mit_text`), wie `content_html`: die
    #: Uebersicht zeigt Titel, Anriss und Bild — zwanzig Galerien und
    #: Karussells in einer Listenantwort waeren Ballast (Wurzel 8).
    #:
    #: Sie standen bis 28.08.2026 in KEINER oeffentlichen Antwort. Im CMS
    #: liessen sie sich pflegen, auf der Website erschien nichts davon.
    felder: PublicPostFelder | None = None


class PublicPostNachbar(BaseModel):
    """Der ältere bzw. neuere Beitrag unter einem Beitrag (0457).

    Nur Slug und Titel — mehr braucht ein Navigationslink nicht, und mehr
    auszuliefern hieße, Felder eines Beitrags zu zeigen, den der Gast noch
    nicht geöffnet hat.
    """

    slug: str
    title: str


class PublicBlogAngaben(BaseModel):
    """Blogname und RSS-Angaben für den Renderer (0457).

    Sie stehen im Antwortobjekt des Beitrags und der Beitragsliste, damit der
    Renderer den Blognamen in der Überschrift und die RSS-Angaben im Feed
    ausgeben kann, ohne eine zweite Abfrage zu stellen.

    Alle Textfelder dürfen `None` sein: nicht gepflegt ist ein gültiger
    Zustand, und der Renderer entscheidet dann selbst, was er zeigt — ein
    erfundener Blogname wäre die schlechtere Antwort (Wurzel 4).
    """

    blog_name: str | None = None
    #: Nächster/Vorheriger unter einem Beitrag. Spalten-Default ist `true`.
    prev_next: bool = True
    rss_title: str | None = None
    rss_description: str | None = None
    rss_image_url: str | None = None


class PublicPostListResponse(BaseModel):
    items: list[PublicPost] = Field(default_factory=list)
    total: int = 0
    # Alle vorkommenden Schlagwörter, für die Filterleiste. Aus DIESER Seite der
    # Liste und nicht aus allen Beiträgen: eine zweite Abfrage über den ganzen
    # Bestand nur für die Leiste wäre der teurere Teil des Aufrufs.
    tags: list[str] = Field(default_factory=list)


class PublicPostEigenesFeld(BaseModel):
    """Name und Schluessel EINES eigenen Feldes (0485) fuer die Website.

    Nur diese beiden: der Renderer braucht den Schluessel, um den Wert in
    `post.felder.custom` zu finden, und den Namen, um ihn zu beschriften.
    Beschreibung, Pflicht und Platzhalter sind Sache der Eingabemaske und
    haben auf der oeffentlichen Seite nichts zu suchen.
    """

    feld_key: str
    label: str


class PublicPostResponse(BaseModel):
    """Ein einzelner Beitrag mit seinen Abschnitten."""

    tenant_id: str
    post: PublicPost
    page: PublicPageMeta
    blocks: list[PublicBlock] = Field(default_factory=list)
    branding: PublicSiteResponse
    #: Blogname und Naechster/Vorheriger-Schalter (0457).
    #:
    #: Sie standen bis 28.08.2026 NICHT im Modell, wurden aber uebergeben —
    #: pydantic verwirft unbekannte Argumente stillschweigend, also kamen sie
    #: nie beim Renderer an. Die Naechster/Vorheriger-Leiste unter einem
    #: Beitrag war damit tot, ohne dass irgendwo ein Fehler stand (Wurzel 5:
    #: was still verschwindet, sucht niemand).
    blog: PublicBlogAngaben = Field(default_factory=PublicBlogAngaben)
    vorheriger: PublicPostNachbar | None = None
    naechster: PublicPostNachbar | None = None
    #: Die EIGENEN Felder des Betriebs (0485) — Schluessel und Name. Ohne sie
    #: stuende auf der Seite der technische Schluessel ueber dem Wert.
    eigene_felder: list[PublicPostEigenesFeld] = Field(default_factory=list)
