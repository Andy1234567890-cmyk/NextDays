"""Vorlagen für EINZELNE Seiten (0434, Etappe D).

Unterschied zu ``templates.py``: dort liegen SITE-Vorlagen — ein ganzes
Seiten-Set (bergchalet, kueste, stadt), mit dem ein Betrieb startet. Hier geht es
um die Seite, die er SPÄTER dazunimmt: „Über uns", „Anfahrt", „Hausordnung".

Hostaway löst denselben Fall über „Add Page → Designed Page" bzw. „Add Section →
Designed": eine leere Seite anlegen und dann einen fertigen Abschnitts-Satz
hineinlegen. Bei uns ist es ein Schritt — beim Anlegen wählt man die Vorlage.

Was die Vorlagen NICHT tun: Marketing-Text erfinden. Die Beispieltexte sind
erkennbar Beispiele und beschreiben, was hier hingehört („Wir vermieten seit …");
sie sind eine Struktur mit Anleitung, kein fertiger Werbetext, den jemand
versehentlich veröffentlicht.

Die Kontaktdaten füllt der Service aus dem FIRMENPROFIL nach
(``konto_daten.kontakt_mit_firmendaten``) — dieselbe Quelle wie überall, damit
niemand seine Anschrift zweimal pflegt.
"""

from __future__ import annotations

from typing import Any

# Sprachen der Beispieltexte: Deutsch und Englisch.
#
# NICHT alle 24. Ein Beispieltext ist ein Platzhalter, den der Betrieb ersetzt —
# ihn in 24 Sprachen zu pflegen hieße, 24 Fassungen eines Textes zu pflegen, den
# niemand behalten will. Der Renderer zeigt die Sprache, die vorhanden ist; fehlt
# sie, bleibt das Feld leer und der Kunde sieht sofort, wo er tippen muss.
#
# Die Oberfläche des Baukastens ist davon unberührt: sie steht in allen 24
# Sprachen (`website.vorlagen.*`).


def _h2(de: str, en: str) -> dict[str, dict[str, str]]:
    """Ein Rich-Text-Abschnitt mit Überschrift und Absatz."""
    return {
        "html": {
            "de": de,
            "en": en,
        }
    }


VORLAGEN: dict[str, dict[str, Any]] = {
    "ueber_uns": {
        # Der Titel ist ein VORSCHLAG: der Service setzt ihn nur, wenn der Kunde
        # keinen eingegeben hat. Sonst hieße jede Seite so wie die Vorlage.
        "titel": {"de": "Über uns", "en": "About us"},
        "slug": "ueber-uns",
        "blocks": [
            {
                "type": "hero",
                "content": {
                    "heading": {"de": "Über uns", "en": "About us"},
                    "subheading": {
                        "de": "Wer wir sind und warum wir vermieten.",
                        "en": "Who we are and why we host.",
                    },
                    "variant": "centered",
                },
            },
            {
                "type": "rich_text",
                "content": _h2(
                    "<h2>Unsere Geschichte</h2><p>Erzählen Sie hier, seit wann "
                    "Sie vermieten, wie Sie zu Ihren Objekten gekommen sind und "
                    "was Gäste bei Ihnen erwartet. Zwei bis drei Absätze "
                    "genügen — Gäste lesen das, bevor sie buchen.</p>",
                    "<h2>Our story</h2><p>Tell guests since when you have been "
                    "hosting, how you came to your properties and what to "
                    "expect. Two or three paragraphs are enough — guests read "
                    "this before they book.</p>",
                ),
            },
            {
                "type": "features",
                "content": {
                    "headline": {
                        "de": "Was uns wichtig ist",
                        "en": "What matters to us",
                    },
                    "columns": 3,
                    "items": [
                        {
                            "icon": "herz",
                            "title": {"de": "Persönlich", "en": "Personal"},
                            "text": {
                                "de": "Wir sind erreichbar — vor, während und "
                                "nach dem Aufenthalt.",
                                "en": "We are reachable — before, during and "
                                "after your stay.",
                            },
                        },
                        {
                            "icon": "haus",
                            "title": {"de": "Gepflegt", "en": "Well kept"},
                            "text": {
                                "de": "Beschreiben Sie, wie Sie Ihre Objekte "
                                "instand halten.",
                                "en": "Describe how you maintain your "
                                "properties.",
                            },
                        },
                        {
                            "icon": "karte",
                            "title": {"de": "Von hier", "en": "Local"},
                            "text": {
                                "de": "Was Sie über die Gegend wissen und was "
                                "Sie empfehlen.",
                                "en": "What you know about the area and what "
                                "you recommend.",
                            },
                        },
                    ],
                },
            },
            {"type": "testimonials", "content": {
                "headline": {"de": "Was Gäste sagen", "en": "What guests say"},
                "items": [],
            }},
        ],
    },
    "kontakt": {
        "titel": {"de": "Kontakt", "en": "Contact"},
        "slug": "kontakt",
        "blocks": [
            {
                "type": "hero",
                "content": {
                    "heading": {"de": "Kontakt", "en": "Contact"},
                    "subheading": {
                        "de": "Fragen zur Buchung oder zur Anreise? Schreiben "
                        "Sie uns.",
                        "en": "Questions about booking or arrival? Write to us.",
                    },
                    "variant": "centered",
                },
            },
            # `contact` füllt der Service aus dem Firmenprofil (E-Mail,
            # Telefon, Anschrift) — hier bleibt es leer, damit keine
            # Beispieladresse auf einer Kundenseite landet.
            {"type": "contact", "content": {}},
            {"type": "map", "content": {
                "headline": {"de": "So finden Sie uns", "en": "How to find us"},
                # Ohne Adresse nimmt der Renderer die aus dem Firmenprofil.
                "zoom": 14,
                "height": 400,
            }},
        ],
    },
    "anfahrt": {
        "titel": {"de": "Anfahrt", "en": "Getting here"},
        "slug": "anfahrt",
        "blocks": [
            {
                "type": "hero",
                "content": {
                    "heading": {"de": "Anfahrt", "en": "Getting here"},
                    "variant": "centered",
                },
            },
            {"type": "map", "content": {"zoom": 13, "height": 450}},
            {
                "type": "features",
                "content": {
                    "headline": {"de": "Ihre Wege zu uns", "en": "Ways to get here"},
                    "columns": 3,
                    "items": [
                        {
                            "icon": "parken",
                            "title": {"de": "Mit dem Auto", "en": "By car"},
                            "text": {
                                "de": "Beschreiben Sie die Anfahrt und wo "
                                "geparkt wird.",
                                "en": "Describe the route and where to park.",
                            },
                        },
                        {
                            "icon": "uhr",
                            "title": {
                                "de": "Mit Bahn und Bus",
                                "en": "By train and bus",
                            },
                            "text": {
                                "de": "Nächster Bahnhof, Linie, Fußweg.",
                                "en": "Nearest station, line, walking time.",
                            },
                        },
                        {
                            "icon": "schluessel",
                            "title": {"de": "Ankunft", "en": "Arrival"},
                            "text": {
                                "de": "Wie der Schlüssel übergeben wird und ab "
                                "wann.",
                                "en": "How the key is handed over and from when.",
                            },
                        },
                    ],
                },
            },
        ],
    },
    "hausordnung": {
        "titel": {"de": "Hausordnung", "en": "House rules"},
        "slug": "hausordnung",
        "blocks": [
            {
                "type": "hero",
                "content": {
                    "heading": {"de": "Hausordnung", "en": "House rules"},
                    "subheading": {
                        "de": "Damit sich alle wohlfühlen.",
                        "en": "So everyone feels at home.",
                    },
                    "variant": "centered",
                },
            },
            # Als FAQ und nicht als Fließtext: eine Hausordnung ist eine Liste
            # von Fragen, die Gäste wirklich stellen — und aufklappbar liest sie
            # niemand als Vertragstext. Nebenwirkung: das FAQPage-JSON-LD.
            {
                "type": "faq",
                "content": {
                    "headline": {
                        "de": "Das Wichtigste in Kürze",
                        "en": "The essentials",
                    },
                    "items": [
                        {
                            "question": {
                                "de": "Wann können wir anreisen?",
                                "en": "When can we check in?",
                            },
                            "answer": {
                                "de": "Tragen Sie hier Ihre Zeiten für An- und "
                                "Abreise ein.",
                                "en": "Enter your check-in and check-out times "
                                "here.",
                            },
                        },
                        {
                            "question": {
                                "de": "Sind Haustiere erlaubt?",
                                "en": "Are pets allowed?",
                            },
                            "answer": {
                                "de": "Antworten Sie klar mit Ja oder Nein — "
                                "und mit den Bedingungen.",
                                "en": "Answer clearly yes or no — and state the "
                                "conditions.",
                            },
                        },
                        {
                            "question": {
                                "de": "Gilt eine Ruhezeit?",
                                "en": "Are there quiet hours?",
                            },
                            "answer": {
                                "de": "Wenn ja: von wann bis wann.",
                                "en": "If so: from when to when.",
                            },
                        },
                    ],
                },
            },
        ],
    },
    "umgebung": {
        "titel": {"de": "Umgebung", "en": "The area"},
        "slug": "umgebung",
        "blocks": [
            {
                "type": "hero",
                "content": {
                    "heading": {"de": "Die Umgebung", "en": "The area"},
                    "subheading": {
                        "de": "Was sich in der Nähe lohnt.",
                        "en": "What is worth seeing nearby.",
                    },
                    "variant": "split",
                },
            },
            {
                "type": "rich_text",
                "content": _h2(
                    "<h2>Was Sie hier erwartet</h2><p>Beschreiben Sie die "
                    "Gegend so, wie Sie sie einem Freund beschreiben würden. "
                    "Das ist der Text, über den Gäste Ihre Seite bei Google "
                    "finden — „Ferienhaus in der Nähe von …“ suchen mehr "
                    "Menschen als Ihren Betriebsnamen.</p>",
                    "<h2>What to expect</h2><p>Describe the area the way you "
                    "would describe it to a friend. This is the text guests "
                    "find your site with — more people search for „holiday "
                    "home near …“ than for your business name.</p>",
                ),
            },
            {"type": "gallery", "content": {"images": []}},
            {"type": "map", "content": {"zoom": 11, "height": 400}},
        ],
    },
    "faq": {
        "titel": {"de": "Häufige Fragen", "en": "Frequently asked questions"},
        "slug": "faq",
        "blocks": [
            {
                "type": "hero",
                "content": {
                    "heading": {
                        "de": "Häufige Fragen",
                        "en": "Frequently asked questions",
                    },
                    "variant": "centered",
                },
            },
            {
                "type": "faq",
                "content": {
                    "headline": {},
                    "items": [
                        {
                            "question": {
                                "de": "Wie kann ich bezahlen?",
                                "en": "How can I pay?",
                            },
                            "answer": {
                                "de": "Nennen Sie die Zahlungsarten, die Sie "
                                "annehmen.",
                                "en": "Name the payment methods you accept.",
                            },
                        },
                        {
                            "question": {
                                "de": "Kann ich kostenlos stornieren?",
                                "en": "Can I cancel free of charge?",
                            },
                            "answer": {
                                "de": "Beschreiben Sie Ihre Stornobedingungen "
                                "in einem Satz.",
                                "en": "Describe your cancellation terms in one "
                                "sentence.",
                            },
                        },
                        {
                            "question": {
                                "de": "Ist Bettwäsche inklusive?",
                                "en": "Is bed linen included?",
                            },
                            "answer": {
                                "de": "Ja oder nein — und was es sonst kostet.",
                                "en": "Yes or no — and what it costs otherwise.",
                            },
                        },
                    ],
                },
            },
        ],
    },
}

# Die Reihenfolge der Auswahl in der Oberfläche. Nach Häufigkeit, nicht
# alphabetisch: „Über uns" und „Kontakt" legt fast jeder Betrieb an, „Umgebung"
# und „FAQ" sind der zweite Schritt.
VORLAGEN_REIHENFOLGE = [
    "ueber_uns",
    "kontakt",
    "anfahrt",
    "hausordnung",
    "umgebung",
    "faq",
]
