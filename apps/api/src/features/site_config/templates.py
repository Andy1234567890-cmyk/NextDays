"""Start-Templates für den Page-Builder — voll designte, befüllte Seiten.

Jedes Template ist ein fertiges Seiten-Set (Seiten + Blöcke) mit echten
Beispieltexten und hochwertigen Platzhalter-Bildern (Unsplash). ``apply_template``
legt daraus tenant-scoped Seiten + Blöcke an — die Agentur startet NICHT auf
einer leeren Canvas, sondern auf einer beeindruckenden Seite, die sie nur noch
ans eigene Branding (Farben/Logo/Schrift über die CSS-Vars) anpassen muss.

Mehrsprachige Texte als ``{"de": "...", "en": "..."}`` (Locale → Text),
konsistent zu den content-Schemas (HeroContent.variant/eyebrow etc.).
"""
# Reines Daten-/Fixture-Modul: lange lokalisierte Marketing-Texte/HTML werden
# bewusst nicht umgebrochen (Lesbarkeit der Inhalte > Zeilenlänge).
# pylint: disable=line-too-long
from __future__ import annotations

from typing import Any


def _img(photo_id: str, w: int, h: int) -> str:
    """Deterministische Unsplash-URL (Crop/Qualität), wie builder/lib/stock-images."""
    return (
        f"https://images.unsplash.com/photo-{photo_id}"
        f"?auto=format&fit=crop&w={w}&h={h}&q=80"
    )


# Stimmungs-Bilder (gleiche IDs wie im Renderer-Stock, damit Editor + Live gleich).
_BERG = [
    "1568605114967-8130f3a36994",
    "1502672260266-1c1ef2d93688",
    "1521783988139-89397d761dce",
    "1610641818989-c2051b5e2cfd",
    "1449158743715-0a90ebb6d2d8",
    "1586375300773-8384e3e4916f",
]
_KUESTE = [
    "1507525428034-b723cf961d3e",
    "1505142468610-359e7d316be0",
    "1499793983690-e29da59ef1c2",
    "1471922694854-ff1b63b20054",
    "1559827260-dc66d52bef19",
    "1520250497591-112f2f40a3f4",
]
_STADT = [
    "1493809842364-78817add7ffb",
    "1522708323590-d24dbb6b0267",
    "1556020685-ae41abfc9365",
    "1560448204-e02f11c3d0e2",
    "1505691938895-1758d7feb511",
    "1502672260266-1c1ef2d93688",
]


def _gallery(ids: list[str]) -> dict[str, Any]:
    return {"images": [{"url": _img(i, 800, 800), "alt": {}} for i in ids[:6]]}


def _common_pages(
    *,
    hero: dict[str, Any],
    grid_headline: dict[str, str],
    about_html: dict[str, str],
    about_image: str,
    gallery_ids: list[str],
    contact: dict[str, Any],
) -> list[dict[str, Any]]:
    """Gemeinsames Seiten-Gerüst (Home + Über-uns + Kontakt) für alle Templates.

    ``nav_area`` steht bewusst an jeder Seite: eine Vorlage, deren Unterseiten in
    keinem Menü auftauchen, wäre für den Gast eine Sackgasse."""
    return [
        {
            "slug": "",
            "title": "Startseite",
            "is_home": True,
            "nav_area": "header",
            "blocks": [
                {"type": "hero", "content": hero},
                {
                    "type": "search",
                    "content": {
                        "placeholder": {"de": "Wohin soll die Reise gehen?", "en": "Where to?"},
                        "show_guests": True,
                        "show_dates": True,
                    },
                },
                {"type": "properties_grid", "content": {"headline": grid_headline}},
                {"type": "image", "content": {"url": about_image, "alt": {}}},
                {"type": "rich_text", "content": {"html": about_html}},
                {"type": "gallery", "content": _gallery(gallery_ids)},
                {"type": "contact", "content": contact},
            ],
        },
        {
            "slug": "ueber-uns",
            "title": "Über uns",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {"type": "rich_text", "content": {"html": about_html}},
                {"type": "gallery", "content": _gallery(gallery_ids)},
            ],
        },
        {
            "slug": "kontakt",
            "title": "Kontakt",
            "is_home": False,
            "nav_area": "header",
            "blocks": [{"type": "contact", "content": contact}],
        },
    ]


# Design-Tokens je Vorlage. Damit ist ein Vorlagen-Klick wirklich fertig: Layout,
# Farben und Schriften passen zusammen, der Kunde muss nichts mehr einstellen.
# ``apply_template`` schreibt diese Werte NUR in noch leere Branding-Felder — ein
# Kunde, der seine Marke schon gesetzt hat, verliert sie nicht (Wurzel 1: die
# Vorlage darf den bestehenden Gegenzustand nicht überschreiben).
# Farben kommen aus der Vorlage, nicht aus einem Fallback: fehlt ein Wert, bleibt
# die Spalte NULL und der Renderer entscheidet (Wurzel 4).
_BERG_BRANDING: dict[str, Any] = {
    "theme": "klar",
    "primary_color": "#8a5a2b",
    "secondary_color": "#f3ece3",
    "background_color": "#fdfbf8",
    "foreground_color": "#2a211a",
    "heading_font": "Fraunces",
    "font_family": "Inter",
    "button_style": "solid",
    "button_radius": "pill",
}
_KUESTE_BRANDING: dict[str, Any] = {
    "theme": "mitte",
    "primary_color": "#1f7a8c",
    "secondary_color": "#e6f2f5",
    "background_color": "#ffffff",
    "foreground_color": "#12313a",
    "heading_font": "Fraunces",
    "font_family": "Inter",
    "button_style": "solid",
    "button_radius": "pill",
}
_STADT_BRANDING: dict[str, Any] = {
    "theme": "karte",
    "primary_color": "#111827",
    "secondary_color": "#f3f4f6",
    "background_color": "#ffffff",
    "foreground_color": "#111827",
    "heading_font": "Inter",
    "font_family": "Inter",
    "button_style": "solid",
    "button_radius": "rounded",
}

TEMPLATES: dict[str, dict[str, Any]] = {
    "bergchalet": {
        "name": {"de": "Bergchalet", "en": "Mountain Chalet"},
        "description": {"de": "Warm, holzig — für Chalets & Berghütten."},
        "branding": _BERG_BRANDING,
        "pages": _common_pages(
            hero={
                "eyebrow": {"de": "Willkommen in den Bergen", "en": "Welcome to the mountains"},
                "heading": {"de": "Ihr Rückzugsort im Bergchalet", "en": "Your retreat in the mountains"},
                "subheading": {
                    "de": "Knisterndes Kaminfeuer, Panoramablick und echte Ruhe — direkt beim Gastgeber buchen.",
                    "en": "Crackling fireplace, panoramic views and true calm — book directly with the host.",
                },
                "cta_label": {"de": "Verfügbarkeit prüfen", "en": "Check availability"},
                "cta_href": "#objekte",
                "image_url": _img(_BERG[0], 2000, 1200),
                "variant": "fullscreen",
            },
            grid_headline={"de": "Unsere Chalets & Hütten", "en": "Our chalets & cabins"},
            about_html={
                "de": "<h2>Gastgeber aus Leidenschaft</h2><p>Seit Generationen empfangen wir Gäste in unseren Bergchalets. Jedes Haus ist liebevoll mit heimischem Holz eingerichtet — für Urlaub, der sich anfühlt wie nach Hause kommen.</p>",
                "en": "<h2>Hosts by heart</h2><p>For generations we have welcomed guests to our mountain chalets, each lovingly furnished with local wood.</p>",
            },
            about_image=_img(_BERG[1], 1400, 1000),
            gallery_ids=_BERG,
            contact={
                "headline": {"de": "Sprechen Sie mit uns", "en": "Talk to us"},
                "email": "hallo@bergchalet.example",
                "phone": "+49 8000 000000",
                "address": {"de": "Alpenstraße 1\n83700 Bergdorf"},
                "show_form": True,
            },
        ),
    },
    "kueste": {
        "name": {"de": "Küste & See", "en": "Coast & Lake"},
        "description": {"de": "Hell, luftig — für Strand- & Seehäuser."},
        "branding": _KUESTE_BRANDING,
        "pages": _common_pages(
            hero={
                "eyebrow": {"de": "Am Wasser zu Hause", "en": "At home by the water"},
                "heading": {"de": "Auszeit am Meer", "en": "Time out by the sea"},
                "subheading": {
                    "de": "Weite Horizonte, frische Brise und helle Häuser direkt am Wasser — provisionsfrei buchen.",
                    "en": "Wide horizons, fresh breeze and bright homes by the water — book commission-free.",
                },
                "cta_label": {"de": "Unterkünfte ansehen", "en": "View stays"},
                "cta_href": "#objekte",
                "image_url": _img(_KUESTE[0], 2000, 1200),
                "variant": "centered",
            },
            grid_headline={"de": "Häuser am Wasser", "en": "Homes by the water"},
            about_html={
                "de": "<h2>Salz in der Luft, Ruhe im Herzen</h2><p>Unsere Strand- und Seehäuser sind hell, modern und nur wenige Schritte vom Wasser entfernt. Ideal für alle, die abschalten und durchatmen wollen.</p>",
                "en": "<h2>Salt in the air, calm in your heart</h2><p>Our beach and lake houses are bright, modern and just steps from the water.</p>",
            },
            about_image=_img(_KUESTE[2], 1400, 1000),
            gallery_ids=_KUESTE,
            contact={
                "headline": {"de": "Wir freuen uns auf Sie", "en": "We look forward to you"},
                "email": "hallo@kueste.example",
                "phone": "+49 8000 000001",
                "address": {"de": "Strandweg 7\n23730 Seebad"},
                "show_form": True,
            },
        ),
    },
    "stadt": {
        "name": {"de": "Stadt-Apartments", "en": "City Apartments"},
        "description": {"de": "Modern, urban — für City-Apartments."},
        "branding": _STADT_BRANDING,
        "pages": _common_pages(
            hero={
                "eyebrow": {"de": "Mitten in der Stadt", "en": "In the heart of the city"},
                "heading": {"de": "Stilvoll wohnen auf Zeit", "en": "Stylish stays in the city"},
                "subheading": {
                    "de": "Design-Apartments in bester Lage — perfekt für Städtetrips und Business. Direkt buchen.",
                    "en": "Design apartments in prime locations — perfect for city trips and business.",
                },
                "cta_label": {"de": "Jetzt buchen", "en": "Book now"},
                "cta_href": "#objekte",
                "image_url": _img(_STADT[0], 2000, 1200),
                "variant": "split",
            },
            grid_headline={"de": "Unsere Apartments", "en": "Our apartments"},
            about_html={
                "de": "<h2>Ankommen & loslegen</h2><p>Zentral, modern ausgestattet und mit allem, was man braucht: unsere Apartments machen den Aufenthalt in der Stadt unkompliziert und stilvoll.</p>",
                "en": "<h2>Arrive & get going</h2><p>Central, modern and fully equipped — our apartments make your city stay effortless.</p>",
            },
            about_image=_img(_STADT[1], 1400, 1000),
            gallery_ids=_STADT,
            contact={
                "headline": {"de": "Fragen? Schreiben Sie uns", "en": "Questions? Write to us"},
                "email": "hallo@stadt.example",
                "phone": "+49 8000 000002",
                "address": {"de": "Hauptstraße 100\n10115 Berlin"},
                "show_form": True,
            },
        ),
    },
}
