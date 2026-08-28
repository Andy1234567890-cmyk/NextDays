"""Vorlagen für Pop-ups (0440).

Hostaway sagt beim Anlegen nur: „Select a pop-up type. The pop-up type
pre-populates the pop-up with widgets." Welche Typen es gibt, steht in keinem
Artikel — belegbar ist die Liste aus Dudas Produktankündigung „12 Fresh Popups"
(24.05.2021): Blank · Contact Us · Visit Us · Online Scheduling · Send Feedback ·
Welcome · New Store Item · Like Us on Facebook · Follow Us on Instagram ·
Promotion · Newsletter · More Info.

WAS WIR DAVON ÜBERNEHMEN UND WAS NICHT — dieselbe Zahl, andere Zuschnitte:

* ``new_store_item`` heißt bei uns ``neues_objekt``. Ein Ferienbetrieb hat
  keinen Warenkorb, aber sehr wohl ein neues Haus im Bestand.
* ``online_scheduling`` wird ``verfuegbarkeit``: der Gast will keinen Termin,
  er will Daten prüfen.
* ``visit_us`` wird ``anfahrt``. Ein Ladengeschäft sagt „wir haben offen", eine
  Unterkunft sagt „so kommen Sie her".
* ``like_us_on_facebook`` und ``follow_us_on_instagram`` bleiben, sind aber EIN
  Eintrag (``social``): zwei Vorlagen, die sich nur im Netzwerk unterscheiden,
  sind eine Vorlage mit einem Feld.
* Dazugekommen sind ``bewertung`` und ``letzte_chance`` — die zwei Fälle, die
  auf einer Unterkunfts-Website wirklich vorkommen und in Dudas Ladenbau-Liste
  fehlen.

Beispieltexte auf Deutsch und Englisch, wie bei den Seiten-Vorlagen (0434) und
aus demselben Grund: ein Platzhalter, den der Betrieb ersetzt, in 24 Sprachen zu
pflegen hieße 24 Fassungen eines Textes zu pflegen, den niemand behält.
"""

from __future__ import annotations

from typing import Any


def _text(de: str, en: str) -> dict[str, Any]:
    """Ein Rich-Text-Abschnitt."""
    return {"type": "rich_text", "content": {"html": {"de": de, "en": en}}}


def _knopf(de: str, en: str, ziel: str) -> dict[str, Any]:
    return {
        "type": "button",
        "content": {"label": {"de": de, "en": en}, "href": ziel},
    }


# Die zwölf Vorlagen. Reihenfolge = Reihenfolge im Auswahldialog: erst die leere,
# dann die drei häufigsten, dann der Rest.
VORLAGEN: dict[str, dict[str, Any]] = {
    "leer": {
        "titel": {"de": "Pop-up", "en": "Popup"},
        "position": "mitte",
        "bloecke": [],
    },
    "willkommen": {
        "titel": {"de": "Willkommen", "en": "Welcome"},
        "position": "mitte",
        "bloecke": [
            _text(
                "<h2>Schön, dass Sie da sind</h2><p>Beschreiben Sie hier in "
                "zwei Sätzen, was Ihre Häuser besonders macht.</p>",
                "<h2>Good to see you</h2><p>Use two sentences to say what "
                "makes your places special.</p>",
            ),
            _knopf("Häuser ansehen", "See our places", "/"),
        ],
    },
    "angebot": {
        "titel": {"de": "Angebot", "en": "Promotion"},
        "position": "mitte",
        "bloecke": [
            _text(
                "<h2>10 % auf Ihren Aufenthalt</h2><p>Nennen Sie den Rabatt, "
                "den Zeitraum und den Code. Ohne Enddatum wirkt kein "
                "Angebot.</p>",
                "<h2>10% off your stay</h2><p>Name the discount, the period "
                "and the code. Without an end date, no offer works.</p>",
            ),
            _knopf("Jetzt buchen", "Book now", "/"),
        ],
    },
    "letzte_chance": {
        # Der Fall, den Duda nicht hat und der hier der häufigste ist: der Gast
        # ist auf der Objektseite und geht wieder. Gedacht für die
        # Verlassensabsicht als Auslöser.
        "titel": {"de": "Letzte Chance", "en": "Last chance"},
        "position": "mitte",
        "bloecke": [
            _text(
                "<h2>Noch frei — aber nicht mehr lange</h2><p>Sagen Sie, was "
                "knapp ist: der Termin, das Haus, der Preis.</p>",
                "<h2>Still available — but not for long</h2><p>Say what is "
                "scarce: the dates, the house, the price.</p>",
            ),
            _knopf("Verfügbarkeit prüfen", "Check availability", "/"),
        ],
    },
    "anfrage": {
        "titel": {"de": "Anfrage", "en": "Enquiry"},
        "position": "mitte",
        "bloecke": [
            _text(
                "<h2>Fragen zu Ihrem Aufenthalt?</h2><p>Schreiben Sie uns, "
                "wir antworten am selben Tag.</p>",
                "<h2>Questions about your stay?</h2><p>Write to us, we reply "
                "the same day.</p>",
            ),
            {
                "type": "form",
                "content": {
                    "form_name": "Pop-up-Anfrage",
                    "submit_label": {"de": "Senden", "en": "Send"},
                    "success_text": {
                        "de": "Danke, wir melden uns.",
                        "en": "Thank you, we will be in touch.",
                    },
                    "fields": [
                        {
                            "name": "name",
                            "type": "text",
                            "label": {"de": "Name", "en": "Name"},
                            "required": True,
                        },
                        {
                            "name": "email",
                            "type": "email",
                            "label": {"de": "E-Mail", "en": "Email"},
                            "required": True,
                        },
                        {
                            "name": "nachricht",
                            "type": "textarea",
                            "label": {"de": "Nachricht", "en": "Message"},
                        },
                        {
                            "name": "einwilligung",
                            "type": "consent",
                            "label": {
                                "de": "Ich bin mit der Verarbeitung meiner "
                                "Angaben einverstanden.",
                                "en": "I agree to my details being processed.",
                            },
                            "required": True,
                        },
                    ],
                },
            },
        ],
    },
    "kontakt": {
        "titel": {"de": "Kontakt", "en": "Contact us"},
        "position": "unten-rechts",
        "bloecke": [
            _text(
                "<h2>Wir sind erreichbar</h2><p>Rufen Sie an oder schreiben "
                "Sie — die Daten stehen unten.</p>",
                "<h2>We are here</h2><p>Call or write — the details are "
                "below.</p>",
            ),
            {"type": "contact", "content": {}},
        ],
    },
    "anfahrt": {
        "titel": {"de": "Anfahrt", "en": "How to find us"},
        "position": "mitte",
        "bloecke": [
            _text(
                "<h2>So finden Sie uns</h2><p>Ergänzen Sie Besonderheiten: "
                "Parkplatz, Fähre, letzte Kilometer.</p>",
                "<h2>How to find us</h2><p>Add what matters: parking, ferry, "
                "the last few kilometres.</p>",
            ),
            {"type": "map", "content": {}},
        ],
    },
    "verfuegbarkeit": {
        "titel": {"de": "Verfügbarkeit", "en": "Availability"},
        "position": "mitte",
        "bloecke": [
            _text(
                "<h2>Termin frei?</h2><p>Wählen Sie Ihre Daten — wir zeigen "
                "sofort, was möglich ist.</p>",
                "<h2>Dates free?</h2><p>Pick your dates — we show right away "
                "what is possible.</p>",
            ),
            {"type": "search", "content": {}},
        ],
    },
    "neues_objekt": {
        "titel": {"de": "Neu im Bestand", "en": "New in our portfolio"},
        "position": "mitte",
        "bloecke": [
            _text(
                "<h2>Neu bei uns</h2><p>Ein Satz, was das Haus ausmacht.</p>",
                "<h2>New with us</h2><p>One sentence on what makes it "
                "special.</p>",
            ),
            {"type": "featured_properties", "content": {"limit": 3}},
        ],
    },
    "bewertung": {
        # Ebenfalls nicht bei Duda: nach dem Aufenthalt um eine Bewertung
        # bitten. Für eine Unterkunft ist das die wertvollste Bitte überhaupt.
        "titel": {"de": "Ihre Bewertung", "en": "Your review"},
        "position": "unten-rechts",
        "bloecke": [
            _text(
                "<h2>Wie war Ihr Aufenthalt?</h2><p>Zwei Sätze helfen dem "
                "nächsten Gast bei seiner Entscheidung.</p>",
                "<h2>How was your stay?</h2><p>Two sentences help the next "
                "guest decide.</p>",
            ),
            _knopf("Bewertung schreiben", "Write a review", "/"),
        ],
    },
    "social": {
        "titel": {"de": "Folgen Sie uns", "en": "Follow us"},
        "position": "unten-links",
        "bloecke": [
            _text(
                "<h2>Folgen Sie uns</h2><p>Bilder aus den Häusern und kurze "
                "Hinweise auf freie Termine.</p>",
                "<h2>Follow us</h2><p>Photos from the houses and short notes "
                "on free dates.</p>",
            ),
            _knopf("Zu Instagram", "Go to Instagram", "https://instagram.com/"),
        ],
    },
    "mehr_infos": {
        "titel": {"de": "Mehr erfahren", "en": "More info"},
        "position": "mitte",
        "bloecke": [
            _text(
                "<h2>Gut zu wissen</h2><p>Für alles, was nicht auf die Seite "
                "passt: Hausordnung, Anreisezeiten, Haustiere.</p>",
                "<h2>Good to know</h2><p>For everything that does not fit on "
                "the page: house rules, arrival times, pets.</p>",
            ),
        ],
    },
}

#: Die Namen in der Reihenfolge des Auswahldialogs.
NAMEN: tuple[str, ...] = tuple(VORLAGEN)
