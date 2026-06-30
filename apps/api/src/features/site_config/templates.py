"""Start-Templates für den Page-Builder.

Jedes Template ist ein fertiges Seiten-Set (Seiten + Blöcke), das eine Agentur per
``apply_template`` als Ausgangspunkt anlegen kann. Reine Daten-Konstanten — der
Service legt daraus tenant-scoped Seiten + Blöcke an. Mehrsprachige Texte als
``{"de": "...", "en": "..."}`` (Locale → Text), konsistent zu den content-Schemas.
"""
from __future__ import annotations

from typing import Any

# Ein Template: id → {name, pages: [{slug, title, is_home, blocks: [{type, content}]}]}
TEMPLATES: dict[str, dict[str, Any]] = {
    "klassik": {
        "name": {"de": "Klassik", "en": "Classic"},
        "pages": [
            {
                "slug": "",
                "title": "Startseite",
                "is_home": True,
                "blocks": [
                    {
                        "type": "hero",
                        "content": {
                            "heading": {"de": "Herzlich willkommen"},
                            "subheading": {
                                "de": "Ihre Unterkünfte direkt beim Gastgeber buchen."
                            },
                            "cta_label": {"de": "Unterkünfte ansehen"},
                            "cta_href": "#objekte",
                        },
                    },
                    {
                        "type": "properties_grid",
                        "content": {"headline": {"de": "Unsere Unterkünfte"}},
                    },
                    {
                        "type": "rich_text",
                        "content": {
                            "html": {
                                "de": "<p>Erzählen Sie hier etwas über Ihr Haus.</p>"
                            }
                        },
                    },
                ],
            },
            {
                "slug": "ueber-uns",
                "title": "Über uns",
                "is_home": False,
                "blocks": [
                    {
                        "type": "rich_text",
                        "content": {
                            "html": {"de": "<h2>Über uns</h2><p>Ihre Geschichte.</p>"}
                        },
                    }
                ],
            },
            {
                "slug": "kontakt",
                "title": "Kontakt",
                "is_home": False,
                "blocks": [
                    {
                        "type": "contact",
                        "content": {
                            "headline": {"de": "Kontakt"},
                            "show_form": True,
                        },
                    }
                ],
            },
        ],
    },
    "vermittler": {
        "name": {"de": "Vermittler", "en": "Agency"},
        "pages": [
            {
                "slug": "",
                "title": "Startseite",
                "is_home": True,
                "blocks": [
                    {
                        "type": "hero",
                        "content": {
                            "heading": {"de": "Finden Sie Ihre Unterkunft"},
                            "subheading": {"de": "Direkt & provisionsfrei buchen."},
                        },
                    },
                    {
                        "type": "search",
                        "content": {
                            "placeholder": {"de": "Reiseziel suchen"},
                            "show_guests": True,
                            "show_dates": True,
                        },
                    },
                    {
                        "type": "featured_properties",
                        "content": {
                            "headline": {"de": "Empfohlene Unterkünfte"},
                            "property_ids": [],
                        },
                    },
                ],
            },
        ],
    },
    "minimal": {
        "name": {"de": "Minimal", "en": "Minimal"},
        "pages": [
            {
                "slug": "",
                "title": "Startseite",
                "is_home": True,
                "blocks": [
                    {
                        "type": "hero",
                        "content": {"heading": {"de": "Willkommen"}},
                    },
                    {
                        "type": "properties_grid",
                        "content": {"headline": {"de": "Unterkünfte"}},
                    },
                ],
            },
        ],
    },
}
