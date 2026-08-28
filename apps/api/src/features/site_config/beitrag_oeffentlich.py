"""Ein Beitrag, wie ihn die WEBSITE bekommt (0483/0485).

Eigenes Modul und kein weiterer Abschnitt in ``seiten.py``: die Datei stand bei
1 508 von 1 500 erlaubten Zeilen, und ``pylint`` zieht dort (C0302). Der
Schnitt ist auch fachlich richtig — hier steht die Umrechnung von den
``post_``-Spalten der Datenbank in die oeffentliche Antwort, und sonst nichts.

Sie steht an EINER Stelle, weil drei Wege sie brauchen: die oeffentliche
Beitragsseite, der Entwurfs-Render des Editors und (ueber ihn) die Vorschau im
Baukasten. Drei Kopien waeren die Stelle, an der beim naechsten Feld zwei
vergessen werden (Wurzel 2).
"""

from __future__ import annotations

from .schemas import PublicPost, PublicPostFelder


def beitrag_felder_oeffentlich(row: dict) -> PublicPostFelder:
    """Die Vorlagenfelder einer Beitragszeile fuer die oeffentliche Antwort.

    Die DB-Namen tragen den `post_`-Praefix, die Antwort nicht — dieselbe
    Uebersetzung wie im Dashboard (`beitragsfelder_ohne_praefix`), nur fuer die
    Teilmenge, die die Website wirklich braucht.

    Die vier Karussellbilder werden zu EINER Liste: fuer den Renderer sind sie
    ein Karussell und keine vier Felder. Leere Plaetze fallen weg — ein
    Karussell mit einer Luecke in der Mitte waere eine leere Folie.
    """
    karussell = [row.get(f"post_carousel_{n}") for n in (1, 2, 3, 4)]
    return PublicPostFelder(
        industry=row.get("post_industry"),
        client=row.get("post_client"),
        full_title=row.get("post_full_title"),
        intro_heading=row.get("post_intro_heading"),
        intro_body=row.get("post_intro_body"),
        button_text=row.get("post_button_text"),
        website_link=row.get("post_website_link"),
        gallery_top=list(row.get("post_gallery_top") or []),
        gallery_left=row.get("post_gallery_left"),
        gallery_right=row.get("post_gallery_right"),
        gallery_bottom=list(row.get("post_gallery_bottom") or []),
        final_heading=row.get("post_final_heading"),
        final_body=row.get("post_final_body"),
        show_carousel=bool(row.get("post_show_carousel")),
        carousel=[b for b in karussell if b],
        custom=dict(row.get("post_custom") or {}),
    )


def beitrag_fuer_vorschau(row: dict) -> PublicPost:
    """Eine Beitragszeile fuer den ENTWURFS-Render des Editors.

    Immer MIT Text und MIT Feldern — anders als in der oeffentlichen Liste,
    wo beides fehlt (Wurzel 8: eine Uebersicht braucht keine zwanzig
    Beitragstexte). Hier ist es genau EIN Beitrag, und die Vorschau soll ihn
    ganz zeigen.

    Sie steht neben `beitrag_felder_oeffentlich`, weil beide dieselbe
    Umrechnung von `post_`-Spalten machen. Zwei Kopien waeren die Stelle, an
    der beim naechsten Feld eine vergessen wird (Wurzel 2).
    """
    return PublicPost(
        slug=row.get("slug") or "",
        title=row.get("title") or "",
        excerpt=row.get("excerpt"),
        author=row.get("author"),
        cover_image_url=row.get("cover_image_url"),
        tags=list(row.get("tags") or []),
        published_at=(
            str(row["published_at"]) if row.get("published_at") else None
        ),
        content_html=row.get("content_html"),
        parent_post_id=(
            str(row["parent_post_id"]) if row.get("parent_post_id") else None
        ),
        felder=beitrag_felder_oeffentlich(row),
    )
