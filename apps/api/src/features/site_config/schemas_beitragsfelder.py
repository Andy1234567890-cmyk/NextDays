"""Die Beitragsfelder der Framer-Feldliste als eigenes Schema-Stueck (0483).

WARUM EINE EIGENE DATEI
=======================
Diese achtzehn Felder gehoeren in ZWEI Antworten:

  * ``PageResponse``   (``schemas.py``) — die Beitragstabelle des Blog-CMS
    liest die SEITENLISTE, nicht den Beitrags-Endpunkt. Fehlten sie dort,
    blieben die Spalten leer, obwohl die Werte in der DB stehen (live gesehen
    am 28.08.2026).
  * ``BeitragResponse`` (``seiten.py``) — der Dialog.

Zweimal ausgeschrieben waeren sie zwei Wahrheiten, von denen beim naechsten
Feld nur eine gepflegt wird (Wurzel 2). Als Mixin stehen sie EINMAL da.

Die eigene Datei statt eines Blocks in ``schemas.py`` hat einen zweiten Grund:
``schemas.py`` liegt an der 1500-Zeilen-Grenze, die ``pylint`` zieht. Ein
Modul, das ueber jede Sammelantwort weiterwaechst, wird irgendwann
unlesbar — die Grenze ist kein Formalismus.

In der DB tragen die Spalten den Praefix ``post_`` (sie teilen ``site_pages``
mit den Spalten normaler Seiten, und ``client`` oder ``industry`` ohne Praefix
laesen sich dort wie Angaben zur SEITE). Nach aussen heissen sie ohne;
uebersetzt wird an genau zwei Stellen, ``_page_row`` und ``beitrag_pflegen``.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class BeitragsFelder(BaseModel):
    """Die Felder aus der Framer-Feldliste (0483).

    Zwei Arten Bildfeld: ``gallery_top``/``gallery_bottom`` tragen MEHRERE
    Bilder, ``gallery_left``/``gallery_right`` je EINES — so wie im Vorbild
    (Analyse C, Feld 14/15: „Image (nicht Gallery!)"). Wer alle vier gleich
    baut, baut zwei davon falsch.
    """

    industry: str | None = None
    client: str | None = None
    #: Der volle Titel neben dem kurzen Listentitel — ZWEI Felder und nicht
    #: ein gekuerztes (Analyse G).
    full_title: str | None = None
    intro_heading: str | None = None
    intro_body: str | None = None
    button_text: str | None = None
    website_link: str | None = None
    gallery_top: list[str] | None = None
    gallery_left: str | None = None
    gallery_right: str | None = None
    gallery_bottom: list[str] | None = None
    final_heading: str | None = None
    final_body: str | None = None
    show_carousel: bool = False
    carousel_1: str | None = None
    carousel_2: str | None = None
    carousel_3: str | None = None
    carousel_4: str | None = None
    #: Die Werte der EIGENEN Felder (0485). Schluessel = `feld_key` aus
    #: `site_post_custom_fields`. `{}` heisst „nichts gesetzt" — nie `None`:
    #: „kein eigenes Feld befuellt" ist ein leeres Objekt und kein fehlender
    #: Wert.
    custom: dict[str, object] = Field(default_factory=dict)
