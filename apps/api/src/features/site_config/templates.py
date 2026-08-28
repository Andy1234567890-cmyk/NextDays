"""Start-Templates für den Page-Builder — voll designte, befüllte Seiten.

Jedes Template ist ein fertiges Seiten-Set (Seiten + Blöcke) mit echten
Beispieltexten und hochwertigen Platzhalter-Bildern (Unsplash). ``apply_template``
legt daraus tenant-scoped Seiten + Blöcke an — der Betrieb startet NICHT auf
einer leeren Canvas, sondern auf einer fertigen Website, die er nur noch ans
eigene Branding (Farben/Logo/Schrift über die CSS-Vars) anpassen muss.

Mehrsprachige Texte als ``{"de": "...", "en": "..."}`` (Locale → Text),
konsistent zu den content-Schemas (HeroContent.variant/eyebrow etc.).

Jede Vorlage trägt eine ``kategorie`` — nach BETRIEBSART, nicht nach Stimmung:

* ``agentur``    — Hausverwaltung/Agentur mit fremden Objekten. Verkauft
  zusätzlich SICH SELBST an Eigentümer („Ihr Objekt in unsere Verwaltung").
* ``vermietung`` — der eigene Bestand. Entweder ein einzelnes Objekt
  (``ferienhaus``) oder eine Handvoll gleichartiger (``bergchalet`` &Co.).
* ``hotel``      — Zimmertypen statt Häuser, Frühstück/Rezeption/Anreisezeiten.

Rechtsseiten (Impressum, Datenschutz, AGB, Widerruf, Cookies) hängen an JEDER
Vorlage, nicht nur an der Agentur-Vorlage: eine gewerbliche Website ohne
Impressum ist in der EU abmahnfähig, und wer die Seite nicht vorfindet, legt sie
erfahrungsgemäß nicht nachträglich an. Sie stehen in der FUSSZEILE
(``nav_area="footer"``) — dort sucht sie der Gast, und die Kopfzeile bleibt frei.

Was die Rechtsseiten NICHT enthalten: fertige Rechtstexte. Ein generierter
Datenschutztext, der zufällig nicht zur tatsächlichen Datenverarbeitung passt,
ist schlimmer als ein leeres Feld — er sieht richtig aus. Die Vorlagen liefern
die STRUKTUR (Überschriften in der üblichen Reihenfolge) plus einen Hinweis, was
in den Abschnitt gehört. Anschrift/Kontakt kommen über den ``contact``-Block aus
dem Firmenprofil (``konto_daten``), damit niemand sie zweimal pflegt.
"""
# Reines Daten-/Fixture-Modul: lange lokalisierte Marketing-Texte/HTML werden
# bewusst nicht umgebrochen (Lesbarkeit der Inhalte > Zeilenlänge).
# pylint: disable=line-too-long
from __future__ import annotations

from typing import Any

from .templates_rechtliches import rechtliche_seiten


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
# Hotel: Zimmer, Bad, Lobby, Pool — was ein Hotelgast vor der Buchung sehen will.
_HOTEL = [
    "1566073771259-6a8506099945",
    "1611892440504-42a792e24d32",
    "1590490360182-c33d57733427",
    "1445019980597-93fa8acb246c",
    "1582719478250-c89cae4dc85b",
    "1551882547-ff40c63fe5fa",
]
_BOUTIQUE = [
    "1618773928121-c32242e63f39",
    "1631049307264-da0ec9d70304",
    "1578683010236-d716f9a3f461",
    "1571003123894-1f0594d2b5d9",
    "1566073771259-6a8506099945",
    "1590490360182-c33d57733427",
]
# Agentur: Menschen und Arbeitsplätze. Eine Hausverwaltung verkauft eine
# DIENSTLEISTUNG — Bilder von fremden Häusern zeigen das Gegenteil.
_AGENTUR = [
    "1497366754035-f200968a6e72",
    "1521737604893-d14cc237f11d",
    "1524758631624-e2822e304c36",
    "1600880292203-757bb62b4baf",
    "1552664730-d307ca884978",
    "1497366811353-6870744d04b2",
]


def _gallery(ids: list[str]) -> dict[str, Any]:
    return {"images": [{"url": _img(i, 800, 800), "alt": {}} for i in ids[:6]]}


def _rt(de: str, en: str) -> dict[str, Any]:
    """Rich-Text-Inhalt aus zwei Sprachfassungen."""
    return {"html": {"de": de, "en": en}}


# ---------------------------------------------------------------------------
# Seiten-Gerüste je Betriebsart
# ---------------------------------------------------------------------------


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


def _anfrage_formular(
    *,
    headline: dict[str, str],
    intro: dict[str, str],
    form_name: str,
) -> dict[str, Any]:
    """Ein echtes Anfrageformular (0436) — nicht der reine Kontakt-Block.

    Die Felder sind bewusst wenige: jedes zusätzliche Pflichtfeld kostet
    Anfragen. Wer mehr braucht, ergänzt es im Editor."""
    return {
        "type": "form",
        "content": {
            "headline": headline,
            "intro": intro,
            "form_name": form_name,
            "submit_label": {"de": "Anfrage senden", "en": "Send enquiry"},
            "success_text": {
                "de": "Danke! Wir melden uns innerhalb eines Werktags.",
                "en": "Thank you! We will reply within one business day.",
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
                    "name": "zeitraum",
                    "type": "text",
                    "label": {"de": "Wunschzeitraum", "en": "Preferred dates"},
                    "placeholder": {"de": "z. B. 12.–19. Juli", "en": "e.g. 12–19 July"},
                },
                {
                    "name": "nachricht",
                    "type": "textarea",
                    "label": {"de": "Ihre Nachricht", "en": "Your message"},
                    "required": True,
                },
            ],
        },
    }


def _agentur_pages() -> list[dict[str, Any]]:
    """Agentur/Hausverwaltung: drei Seiten plus Rechtsseiten.

    Der Unterschied zu den Vermietungs-Vorlagen steckt in der ZWEITEN Zielgruppe:
    neben dem Gast liest hier der EIGENTÜMER mit, der eine Verwaltung sucht.
    Deshalb eine eigene Seite „Für Eigentümer" mit Leistungen und Formular —
    genau der Fall, den Hostaway in seinem Contact-Us-Leitfaden „owner leads"
    nennt."""
    kontakt = {
        "headline": {"de": "So erreichen Sie uns", "en": "How to reach us"},
        "show_form": False,
    }
    return [
        {
            "slug": "",
            "title": "Startseite",
            "is_home": True,
            "nav_area": "header",
            "blocks": [
                {
                    "type": "hero",
                    "content": {
                        "eyebrow": {"de": "Ferienvermietung mit Betreuung", "en": "Managed holiday rentals"},
                        "heading": {"de": "Ihre Auszeit — von uns vorbereitet", "en": "Your break — prepared by us"},
                        "subheading": {
                            "de": "Geprüfte Häuser und Wohnungen in unserer Region, betreut von einem Team vor Ort. Direkt beim Verwalter buchen.",
                            "en": "Vetted homes and apartments in our region, looked after by a local team. Book directly with the manager.",
                        },
                        "cta_label": {"de": "Unterkünfte ansehen", "en": "View stays"},
                        "cta_href": "#objekte",
                        "image_url": _img(_AGENTUR[2], 2000, 1200),
                        "variant": "fullscreen",
                    },
                },
                {
                    "type": "search",
                    "content": {
                        "placeholder": {"de": "Wohin soll die Reise gehen?", "en": "Where to?"},
                        "show_guests": True,
                        "show_dates": True,
                    },
                },
                {
                    "type": "properties_grid",
                    "content": {"headline": {"de": "Unsere Unterkünfte", "en": "Our stays"}},
                },
                {
                    "type": "features",
                    "content": {
                        "headline": {"de": "Warum direkt bei uns", "en": "Why book with us"},
                        "columns": 3,
                        "items": [
                            {
                                "icon": "ph:handshake",
                                "title": {"de": "Ansprechpartner vor Ort", "en": "A local contact"},
                                "text": {
                                    "de": "Ein Team in der Region — erreichbar vor, während und nach dem Aufenthalt.",
                                    "en": "A team in the region — reachable before, during and after your stay.",
                                },
                            },
                            {
                                "icon": "ph:sparkle",
                                "title": {"de": "Geprüfte Häuser", "en": "Vetted homes"},
                                "text": {
                                    "de": "Jedes Objekt haben wir selbst besichtigt und abgenommen.",
                                    "en": "We have visited and approved every property ourselves.",
                                },
                            },
                            {
                                "icon": "ph:tag",
                                "title": {"de": "Kein Portalaufschlag", "en": "No portal markup"},
                                "text": {
                                    "de": "Sie buchen beim Verwalter — ohne Vermittlungsgebühr der Portale.",
                                    "en": "You book with the manager — without portal booking fees.",
                                },
                            },
                        ],
                    },
                },
                {
                    "type": "testimonials",
                    "content": {
                        "headline": {"de": "Was Gäste sagen", "en": "What guests say"},
                        "items": [
                            {
                                "quote": {
                                    "de": "Ersetzen Sie diesen Text durch eine echte Rückmeldung Ihrer Gäste.",
                                    "en": "Replace this text with real feedback from your guests.",
                                },
                                "author": "Name",
                                "location": "Ort",
                            },
                            {
                                "quote": {
                                    "de": "Zwei bis drei kurze Stimmen wirken glaubwürdiger als eine lange.",
                                    "en": "Two or three short quotes are more credible than one long one.",
                                },
                                "author": "Name",
                                "location": "Ort",
                            },
                        ],
                    },
                },
                {"type": "contact", "content": kontakt},
            ],
        },
        {
            "slug": "ueber-uns",
            "title": "Über uns",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {
                    "type": "hero",
                    "content": {
                        "heading": {"de": "Über uns", "en": "About us"},
                        "subheading": {
                            "de": "Wer wir sind und wofür wir stehen.",
                            "en": "Who we are and what we stand for.",
                        },
                        "image_url": _img(_AGENTUR[1], 2000, 1000),
                        "variant": "centered",
                    },
                },
                {
                    "type": "rich_text",
                    "content": _rt(
                        "<h2>Unsere Geschichte</h2><p>Erzählen Sie hier, seit wann Sie Objekte betreuen, wie viele es heute sind und was Ihre Region ausmacht. Zwei bis drei Absätze genügen — Gäste und Eigentümer lesen das, bevor sie sich melden.</p>",
                        "<h2>Our story</h2><p>Tell readers how long you have been managing properties, how many you look after today and what makes your region special. Two or three paragraphs are enough.</p>",
                    ),
                },
                {
                    "type": "features",
                    "content": {
                        "headline": {"de": "Das Team", "en": "The team"},
                        "columns": 3,
                        "items": [
                            {
                                "icon": "ph:user",
                                "title": {"de": "Name, Rolle", "en": "Name, role"},
                                "text": {
                                    "de": "Ein Satz dazu, wofür diese Person zuständig ist.",
                                    "en": "One sentence about what this person is responsible for.",
                                },
                            },
                            {
                                "icon": "ph:user",
                                "title": {"de": "Name, Rolle", "en": "Name, role"},
                                "text": {
                                    "de": "Gäste buchen lieber bei Menschen als bei einer Firma.",
                                    "en": "Guests would rather book with people than with a company.",
                                },
                            },
                            {
                                "icon": "ph:user",
                                "title": {"de": "Name, Rolle", "en": "Name, role"},
                                "text": {
                                    "de": "Ein Foto je Person macht die Seite sofort persönlicher.",
                                    "en": "One photo per person makes the page far more personal.",
                                },
                            },
                        ],
                    },
                },
                {"type": "gallery", "content": _gallery(_AGENTUR)},
            ],
        },
        {
            "slug": "fuer-eigentuemer",
            "title": "Für Eigentümer",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {
                    "type": "hero",
                    "content": {
                        "eyebrow": {"de": "Für Eigentümer", "en": "For owners"},
                        "heading": {"de": "Ihr Objekt in guten Händen", "en": "Your property in good hands"},
                        "subheading": {
                            "de": "Wir übernehmen Vermarktung, Gästekommunikation, Reinigung und Abrechnung — Sie behalten den Überblick.",
                            "en": "We handle marketing, guest communication, cleaning and statements — you keep the overview.",
                        },
                        "cta_label": {"de": "Kennenlernen vereinbaren", "en": "Arrange an introduction"},
                        "cta_href": "#anfrage",
                        "image_url": _img(_AGENTUR[3], 2000, 1200),
                        "variant": "split",
                    },
                },
                {
                    "type": "features",
                    "content": {
                        "headline": {"de": "Unsere Leistungen", "en": "What we do"},
                        "columns": 3,
                        "items": [
                            {
                                "icon": "ph:megaphone",
                                "title": {"de": "Vermarktung", "en": "Marketing"},
                                "text": {
                                    "de": "Inserat, Fotos, Preise und die Verteilung auf die großen Portale.",
                                    "en": "Listing, photos, rates and distribution to the major portals.",
                                },
                            },
                            {
                                "icon": "ph:chats",
                                "title": {"de": "Gästebetreuung", "en": "Guest care"},
                                "text": {
                                    "de": "Anfragen, Anreise, Fragen während des Aufenthalts.",
                                    "en": "Enquiries, arrival and questions during the stay.",
                                },
                            },
                            {
                                "icon": "ph:broom",
                                "title": {"de": "Reinigung & Wäsche", "en": "Cleaning & linen"},
                                "text": {
                                    "de": "Feste Teams, Kontrolle nach jedem Wechsel.",
                                    "en": "Fixed teams and a check after every changeover.",
                                },
                            },
                            {
                                "icon": "ph:wrench",
                                "title": {"de": "Instandhaltung", "en": "Maintenance"},
                                "text": {
                                    "de": "Kleine Reparaturen sofort, Größeres nach Absprache.",
                                    "en": "Small repairs right away, larger ones after consultation.",
                                },
                            },
                            {
                                "icon": "ph:receipt",
                                "title": {"de": "Abrechnung", "en": "Statements"},
                                "text": {
                                    "de": "Monatliche Auswertung mit Buchungen, Erlösen und Kosten.",
                                    "en": "A monthly statement with bookings, revenue and costs.",
                                },
                            },
                            {
                                "icon": "ph:chart-line",
                                "title": {"de": "Preisgestaltung", "en": "Pricing"},
                                "text": {
                                    "de": "Saisonpreise und Mindestaufenthalte, laufend nachgeführt.",
                                    "en": "Seasonal rates and minimum stays, adjusted continuously.",
                                },
                            },
                        ],
                    },
                },
                {
                    "type": "faq",
                    "content": {
                        "headline": {"de": "Häufige Fragen von Eigentümern", "en": "Frequently asked by owners"},
                        "items": [
                            {
                                "question": {"de": "Was kostet die Verwaltung?", "en": "What does management cost?"},
                                "answer": {
                                    "de": "Nennen Sie hier Ihr Modell — Prozentsatz vom Umsatz oder Pauschale — und was darin enthalten ist.",
                                    "en": "State your model here — a percentage of revenue or a flat fee — and what it covers.",
                                },
                            },
                            {
                                "question": {"de": "Kann ich selbst noch nutzen?", "en": "Can I still use the property myself?"},
                                "answer": {
                                    "de": "Beschreiben Sie, wie Eigennutzung angemeldet wird und welche Fristen gelten.",
                                    "en": "Describe how owners book their own stays and which deadlines apply.",
                                },
                            },
                            {
                                "question": {"de": "Wie lange läuft der Vertrag?", "en": "How long does the contract run?"},
                                "answer": {
                                    "de": "Laufzeit, Kündigungsfrist und was bei einem Verkauf des Objekts passiert.",
                                    "en": "Term, notice period and what happens if the property is sold.",
                                },
                            },
                        ],
                    },
                },
                _anfrage_formular(
                    headline={"de": "Kennenlernen vereinbaren", "en": "Arrange an introduction"},
                    intro={
                        "de": "Erzählen Sie uns kurz von Ihrem Objekt — wir melden uns mit einer Einschätzung.",
                        "en": "Tell us briefly about your property — we will get back to you with an assessment.",
                    },
                    form_name="eigentuemer",
                ),
            ],
        },
        {
            "slug": "kontakt",
            "title": "Kontakt",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {"type": "contact", "content": kontakt},
                _anfrage_formular(
                    headline={"de": "Schreiben Sie uns", "en": "Send us a message"},
                    intro={
                        "de": "Wir antworten in der Regel innerhalb eines Werktags.",
                        "en": "We usually reply within one business day.",
                    },
                    form_name="kontakt",
                ),
                {
                    "type": "map",
                    "content": {
                        "headline": {"de": "So finden Sie uns", "en": "How to find us"},
                        "zoom": 14,
                        "height": 400,
                    },
                },
            ],
        },
        *rechtliche_seiten(),
    ]


def _ferienhaus_pages() -> list[dict[str, Any]]:
    """Einzelne Vermietung: EIN Objekt, kein Objekt-Raster.

    Wer ein Haus vermietet, braucht keine Suchmaske über einen Bestand von eins.
    Stattdessen: Ausstattung, Galerie, Lage, Bewertungen und ein Formular."""
    kontakt = {
        "headline": {"de": "Fragen? Melden Sie sich", "en": "Questions? Get in touch"},
        "show_form": False,
    }
    return [
        {
            "slug": "",
            "title": "Startseite",
            "is_home": True,
            "nav_area": "header",
            "blocks": [
                {
                    "type": "hero",
                    "content": {
                        "eyebrow": {"de": "Ferienhaus am Wasser", "en": "Holiday home by the water"},
                        "heading": {"de": "Unser Haus für Ihren Urlaub", "en": "Our home for your holiday"},
                        "subheading": {
                            "de": "Platz für sechs Gäste, großer Garten, zehn Minuten zum Strand — direkt bei uns buchen.",
                            "en": "Room for six guests, a large garden and ten minutes to the beach — book directly with us.",
                        },
                        "cta_label": {"de": "Verfügbarkeit prüfen", "en": "Check availability"},
                        "cta_href": "#objekte",
                        "image_url": _img(_KUESTE[0], 2000, 1200),
                        "variant": "fullscreen",
                    },
                },
                {
                    "type": "rich_text",
                    "content": _rt(
                        "<h2>Willkommen</h2><p>Beschreiben Sie Ihr Haus in wenigen Sätzen: für wen es sich eignet, was den Aufenthalt besonders macht und was Gäste vor Ort erwartet.</p>",
                        "<h2>Welcome</h2><p>Describe your home in a few sentences: who it suits, what makes a stay here special and what guests will find on site.</p>",
                    ),
                },
                {
                    "type": "features",
                    "content": {
                        "headline": {"de": "Ausstattung", "en": "Amenities"},
                        "columns": 4,
                        "items": [
                            {
                                "icon": "ph:wifi-high",
                                "title": {"de": "WLAN", "en": "Wi-Fi"},
                                "text": {"de": "Kostenfrei im ganzen Haus.", "en": "Free throughout the house."},
                            },
                            {
                                "icon": "ph:car",
                                "title": {"de": "Parkplatz", "en": "Parking"},
                                "text": {"de": "Zwei Stellplätze direkt am Haus.", "en": "Two spaces right by the house."},
                            },
                            {
                                "icon": "ph:dog",
                                "title": {"de": "Haustiere", "en": "Pets"},
                                "text": {"de": "Nach Absprache willkommen.", "en": "Welcome on request."},
                            },
                            {
                                "icon": "ph:fire",
                                "title": {"de": "Kamin", "en": "Fireplace"},
                                "text": {"de": "Holz liegt bereit.", "en": "Firewood provided."},
                            },
                        ],
                    },
                },
                {"type": "gallery", "content": _gallery(_KUESTE)},
                {
                    "type": "properties_grid",
                    "content": {"headline": {"de": "Verfügbarkeit & Preise", "en": "Availability & rates"}, "limit": 1},
                },
                {
                    "type": "reviews",
                    "content": {"headline": {"de": "Was Gäste sagen", "en": "What guests say"}, "limit": 6},
                },
                {
                    "type": "map",
                    "content": {
                        "headline": {"de": "Die Lage", "en": "The location"},
                        "zoom": 13,
                        "height": 400,
                    },
                },
                {"type": "contact", "content": kontakt},
            ],
        },
        {
            "slug": "das-haus",
            "title": "Das Haus",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {
                    "type": "hero",
                    "content": {
                        "heading": {"de": "Das Haus", "en": "The house"},
                        "image_url": _img(_KUESTE[1], 2000, 1000),
                        "variant": "centered",
                    },
                },
                {
                    "type": "rich_text",
                    "content": _rt(
                        "<h2>Räume</h2><p>Gehen Sie Raum für Raum durch: Wohnbereich, Küche, Schlafzimmer, Bad, Außenbereich. Nennen Sie Betten und Größen — genau danach suchen Gäste.</p><h2>Anreise</h2><p>Check-in ab 16 Uhr, Check-out bis 10 Uhr. Beschreiben Sie die Schlüsselübergabe.</p>",
                        "<h2>Rooms</h2><p>Walk through room by room: living area, kitchen, bedrooms, bathroom, outdoor space. Name beds and sizes — that is what guests search for.</p><h2>Arrival</h2><p>Check-in from 4 pm, check-out by 10 am. Describe the key handover.</p>",
                    ),
                },
                {"type": "gallery", "content": _gallery(_KUESTE)},
                {
                    "type": "faq",
                    "content": {
                        "headline": {"de": "Häufige Fragen", "en": "Frequently asked"},
                        "items": [
                            {
                                "question": {"de": "Ist Bettwäsche enthalten?", "en": "Is bed linen included?"},
                                "answer": {
                                    "de": "Beschreiben Sie, was gestellt wird und was Gäste mitbringen.",
                                    "en": "Describe what is provided and what guests should bring.",
                                },
                            },
                            {
                                "question": {"de": "Wie läuft die Anreise ab?", "en": "How does arrival work?"},
                                "answer": {
                                    "de": "Uhrzeiten, Schlüssel, Parken — kurz und konkret.",
                                    "en": "Times, keys, parking — short and concrete.",
                                },
                            },
                            {
                                "question": {"de": "Sind Haustiere erlaubt?", "en": "Are pets allowed?"},
                                "answer": {
                                    "de": "Ihre Regel und eventuelle Zusatzkosten.",
                                    "en": "Your rule and any extra charge.",
                                },
                            },
                        ],
                    },
                },
            ],
        },
        {
            "slug": "umgebung",
            "title": "Umgebung",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {
                    "type": "hero",
                    "content": {
                        "heading": {"de": "Umgebung", "en": "The area"},
                        "subheading": {
                            "de": "Was sich in der Nähe lohnt.",
                            "en": "What is worth seeing nearby.",
                        },
                        "image_url": _img(_KUESTE[2], 2000, 1000),
                        "variant": "centered",
                    },
                },
                {
                    "type": "features",
                    "content": {
                        "headline": {"de": "In der Nähe", "en": "Close by"},
                        "columns": 3,
                        "items": [
                            {
                                "icon": "ph:waves",
                                "title": {"de": "Strand", "en": "Beach"},
                                "text": {"de": "Entfernung und wie man hinkommt.", "en": "Distance and how to get there."},
                            },
                            {
                                "icon": "ph:fork-knife",
                                "title": {"de": "Essen gehen", "en": "Eating out"},
                                "text": {"de": "Zwei, drei Empfehlungen aus erster Hand.", "en": "Two or three first-hand recommendations."},
                            },
                            {
                                "icon": "ph:basket",
                                "title": {"de": "Einkaufen", "en": "Shopping"},
                                "text": {"de": "Supermarkt, Bäcker, Markttag.", "en": "Supermarket, bakery, market day."},
                            },
                        ],
                    },
                },
                {
                    "type": "map",
                    "content": {
                        "headline": {"de": "Auf der Karte", "en": "On the map"},
                        "zoom": 12,
                        "height": 450,
                    },
                },
            ],
        },
        {
            "slug": "kontakt",
            "title": "Kontakt",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {"type": "contact", "content": kontakt},
                _anfrage_formular(
                    headline={"de": "Anfrage senden", "en": "Send an enquiry"},
                    intro={
                        "de": "Sagen Sie uns Ihren Wunschzeitraum — wir antworten schnell.",
                        "en": "Tell us your preferred dates — we reply quickly.",
                    },
                    form_name="anfrage",
                ),
            ],
        },
        *rechtliche_seiten(),
    ]


def _hotel_pages(
    *,
    ids: list[str],
    hero: dict[str, Any],
    intro_html: dict[str, str],
    zimmer_headline: dict[str, str],
    leistungen: list[dict[str, Any]],
    restaurant: bool,
) -> list[dict[str, Any]]:
    """Hotel-Gerüst: Zimmer (= Objekte), Haus, Anreise, Kontakt.

    „Zimmer" ist hier der Objekt-Raster: ein Objekt = ein Zimmertyp mit seinen
    Einheiten (Datenmodell). Deshalb steht dort ``properties_grid`` und keine
    erfundene Kategorie-Ebene."""
    kontakt = {
        "headline": {"de": "Rezeption", "en": "Reception"},
        "show_form": False,
    }
    seiten: list[dict[str, Any]] = [
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
                        "placeholder": {"de": "Anreise, Abreise, Gäste", "en": "Arrival, departure, guests"},
                        "show_guests": True,
                        "show_dates": True,
                    },
                },
                {"type": "rich_text", "content": {"html": intro_html}},
                {"type": "properties_grid", "content": {"headline": zimmer_headline}},
                {
                    "type": "features",
                    "content": {
                        "headline": {"de": "Im Haus", "en": "In the house"},
                        "columns": 3,
                        "items": leistungen,
                    },
                },
                {"type": "gallery", "content": _gallery(ids)},
                {
                    "type": "reviews",
                    "content": {"headline": {"de": "Gästestimmen", "en": "Guest reviews"}, "limit": 6},
                },
                {"type": "contact", "content": kontakt},
            ],
        },
        {
            "slug": "zimmer",
            "title": "Zimmer",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {
                    "type": "hero",
                    "content": {
                        "heading": zimmer_headline,
                        "subheading": {
                            "de": "Jede Kategorie mit Größe, Belegung und Ausstattung.",
                            "en": "Every category with size, occupancy and amenities.",
                        },
                        "image_url": _img(ids[1], 2000, 1000),
                        "variant": "centered",
                    },
                },
                {"type": "properties_grid", "content": {"headline": zimmer_headline}},
                {
                    "type": "rich_text",
                    "content": _rt(
                        "<h2>Was in jedem Zimmer steckt</h2><p>Nennen Sie, was überall gleich ist — Bad, WLAN, Klimaanlage, Safe. Die Unterschiede stehen dann bei der jeweiligen Kategorie.</p>",
                        "<h2>What every room includes</h2><p>List what is the same everywhere — bathroom, Wi-Fi, air conditioning, safe. The differences belong with each category.</p>",
                    ),
                },
            ],
        },
        {
            "slug": "haus",
            "title": "Das Haus",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {
                    "type": "hero",
                    "content": {
                        "heading": {"de": "Das Haus", "en": "The house"},
                        "image_url": _img(ids[3], 2000, 1000),
                        "variant": "centered",
                    },
                },
                {
                    "type": "rich_text",
                    "content": _rt(
                        "<h2>Unsere Geschichte</h2><p>Seit wann gibt es das Haus, wer führt es, was ist Ihnen wichtig? Gäste buchen ein Hotel auch wegen der Menschen dahinter.</p>",
                        "<h2>Our story</h2><p>How long has the house existed, who runs it, what matters to you? Guests book a hotel for the people behind it, too.</p>",
                    ),
                },
                {"type": "gallery", "content": _gallery(ids)},
                {
                    "type": "features",
                    "content": {
                        "headline": {"de": "Ausstattung & Service", "en": "Facilities & service"},
                        "columns": 3,
                        "items": leistungen,
                    },
                },
            ],
        },
        {
            "slug": "anreise",
            "title": "Anreise",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {
                    "type": "hero",
                    "content": {
                        "heading": {"de": "Anreise", "en": "Getting here"},
                        "image_url": _img(ids[4], 2000, 1000),
                        "variant": "centered",
                    },
                },
                {
                    "type": "features",
                    "content": {
                        "headline": {"de": "So kommen Sie zu uns", "en": "How to reach us"},
                        "columns": 3,
                        "items": [
                            {
                                "icon": "ph:car",
                                "title": {"de": "Mit dem Auto", "en": "By car"},
                                "text": {"de": "Anfahrt und Parkmöglichkeiten, mit Preis je Nacht.", "en": "Directions and parking, including the nightly rate."},
                            },
                            {
                                "icon": "ph:train",
                                "title": {"de": "Mit der Bahn", "en": "By train"},
                                "text": {"de": "Nächster Bahnhof und der Weg von dort.", "en": "Nearest station and how to get here from there."},
                            },
                            {
                                "icon": "ph:airplane",
                                "title": {"de": "Mit dem Flugzeug", "en": "By plane"},
                                "text": {"de": "Nächster Flughafen und Transfermöglichkeiten.", "en": "Nearest airport and transfer options."},
                            },
                        ],
                    },
                },
                {
                    "type": "faq",
                    "content": {
                        "headline": {"de": "Gut zu wissen", "en": "Good to know"},
                        "items": [
                            {
                                "question": {"de": "Wann kann ich einchecken?", "en": "When can I check in?"},
                                "answer": {
                                    "de": "Check-in ab 15 Uhr, Check-out bis 11 Uhr. Passen Sie die Zeiten an Ihr Haus an.",
                                    "en": "Check-in from 3 pm, check-out by 11 am. Adjust the times to your house.",
                                },
                            },
                            {
                                "question": {"de": "Ist Frühstück enthalten?", "en": "Is breakfast included?"},
                                "answer": {
                                    "de": "Sagen Sie, was enthalten ist, was dazugebucht wird und zu welchen Zeiten serviert wird.",
                                    "en": "State what is included, what can be added and at which times it is served.",
                                },
                            },
                            {
                                "question": {"de": "Gibt es Parkplätze?", "en": "Is there parking?"},
                                "answer": {
                                    "de": "Anzahl, Preis und ob reserviert werden kann.",
                                    "en": "Number of spaces, price and whether they can be reserved.",
                                },
                            },
                        ],
                    },
                },
                {
                    "type": "map",
                    "content": {
                        "headline": {"de": "Auf der Karte", "en": "On the map"},
                        "zoom": 15,
                        "height": 420,
                    },
                },
            ],
        },
    ]
    if restaurant:
        seiten.append(
            {
                "slug": "restaurant",
                "title": "Restaurant",
                "is_home": False,
                "nav_area": "header",
                "blocks": [
                    {
                        "type": "hero",
                        "content": {
                            "heading": {"de": "Restaurant & Bar", "en": "Restaurant & bar"},
                            "subheading": {
                                "de": "Küche, Öffnungszeiten und Reservierung.",
                                "en": "Kitchen, opening hours and reservations.",
                            },
                            "image_url": _img(ids[5], 2000, 1000),
                            "variant": "split",
                        },
                    },
                    {
                        "type": "rich_text",
                        "content": _rt(
                            "<h2>Unsere Küche</h2><p>Was Sie kochen, woher die Zutaten kommen, wann geöffnet ist. Ergänzen Sie die Speisekarte als Datei oder als Text.</p>",
                            "<h2>Our kitchen</h2><p>What you cook, where the ingredients come from, when you are open. Add the menu as a file or as text.</p>",
                        ),
                    },
                    {"type": "gallery", "content": _gallery(ids)},
                    _anfrage_formular(
                        headline={"de": "Tisch reservieren", "en": "Reserve a table"},
                        intro={
                            "de": "Nennen Sie Datum, Uhrzeit und Personenzahl.",
                            "en": "Tell us the date, time and number of people.",
                        },
                        form_name="reservierung",
                    ),
                ],
            }
        )
    seiten.append(
        {
            "slug": "kontakt",
            "title": "Kontakt",
            "is_home": False,
            "nav_area": "header",
            "blocks": [
                {"type": "contact", "content": kontakt},
                _anfrage_formular(
                    headline={"de": "Schreiben Sie uns", "en": "Send us a message"},
                    intro={
                        "de": "Für Gruppen, Veranstaltungen und besondere Wünsche.",
                        "en": "For groups, events and special requests.",
                    },
                    form_name="kontakt",
                ),
            ],
        }
    )
    seiten.extend(rechtliche_seiten())
    return seiten


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
# Agentur: sachlich und vertrauenswürdig. Eine Verwaltung verkauft Verlässlichkeit,
# keine Urlaubsstimmung — deshalb ein ruhiges Blau statt einer Fotokulisse-Farbe.
_AGENTUR_BRANDING: dict[str, Any] = {
    "theme": "karte",
    "primary_color": "#1d4ed8",
    "secondary_color": "#eef2ff",
    "background_color": "#ffffff",
    "foreground_color": "#0f172a",
    "heading_font": "Inter",
    "font_family": "Inter",
    "button_style": "solid",
    "button_radius": "rounded",
}
_FERIENHAUS_BRANDING: dict[str, Any] = {
    "theme": "klar",
    "primary_color": "#2f6f4e",
    "secondary_color": "#eaf3ed",
    "background_color": "#fcfdfc",
    "foreground_color": "#1b2a22",
    "heading_font": "Fraunces",
    "font_family": "Inter",
    "button_style": "solid",
    "button_radius": "pill",
}
# Hotel klassisch: dunkles Grün-Gold, serifenbetont — die Anmutung, die Häuser
# mit Tradition erwarten.
_HOTEL_BRANDING: dict[str, Any] = {
    "theme": "mitte",
    "primary_color": "#14532d",
    "secondary_color": "#f2f6f1",
    "background_color": "#ffffff",
    "foreground_color": "#132018",
    "heading_font": "Fraunces",
    "font_family": "Inter",
    "button_style": "solid",
    "button_radius": "rounded",
}
# Boutique: knapp, kontrastreich, viel Weißraum.
_BOUTIQUE_BRANDING: dict[str, Any] = {
    "theme": "seitlich",
    "primary_color": "#1c1917",
    "secondary_color": "#f5f5f4",
    "background_color": "#ffffff",
    "foreground_color": "#1c1917",
    "heading_font": "Fraunces",
    "font_family": "Inter",
    "button_style": "outline",
    "button_radius": "square",
}

_HOTEL_LEISTUNGEN: list[dict[str, Any]] = [
    {
        "icon": "ph:coffee",
        "title": {"de": "Frühstück", "en": "Breakfast"},
        "text": {"de": "Uhrzeiten, Buffet oder à la carte, Preis je Person.", "en": "Times, buffet or à la carte, price per person."},
    },
    {
        "icon": "ph:clock",
        "title": {"de": "Rezeption", "en": "Reception"},
        "text": {"de": "Besetzungszeiten und wie später anreisende Gäste hereinkommen.", "en": "Staffed hours and how late arrivals get in."},
    },
    {
        "icon": "ph:wifi-high",
        "title": {"de": "WLAN", "en": "Wi-Fi"},
        "text": {"de": "Kostenfrei im ganzen Haus.", "en": "Free throughout the house."},
    },
    {
        "icon": "ph:car",
        "title": {"de": "Parken", "en": "Parking"},
        "text": {"de": "Eigene Plätze, Anzahl und Preis je Nacht.", "en": "Own spaces, number and price per night."},
    },
    {
        "icon": "ph:barbell",
        "title": {"de": "Wellness", "en": "Wellness"},
        "text": {"de": "Sauna, Fitness, Öffnungszeiten.", "en": "Sauna, gym, opening hours."},
    },
    {
        "icon": "ph:users-three",
        "title": {"de": "Tagungen", "en": "Meetings"},
        "text": {"de": "Räume, Bestuhlung, Technik — auf Anfrage.", "en": "Rooms, seating, equipment — on request."},
    },
]


TEMPLATES: dict[str, dict[str, Any]] = {
    "agentur": {
        "kategorie": "agentur",
        "name": {"de": "Agentur & Hausverwaltung", "en": "Agency & property management"},
        "description": {
            "de": "Vier Seiten plus Rechtsseiten — mit eigener Seite für Eigentümer.",
            "en": "Four pages plus legal pages — including an owner-acquisition page.",
        },
        "branding": _AGENTUR_BRANDING,
        "pages": _agentur_pages(),
    },
    "ferienhaus": {
        "kategorie": "vermietung",
        "name": {"de": "Einzelne Vermietung", "en": "Single rental"},
        "description": {
            "de": "Für EIN Haus oder EINE Wohnung: Ausstattung, Galerie, Lage, Anfrage.",
            "en": "For ONE home or apartment: amenities, gallery, location, enquiry.",
        },
        "branding": _FERIENHAUS_BRANDING,
        "pages": _ferienhaus_pages(),
    },
    "hotel_klassisch": {
        "kategorie": "hotel",
        "name": {"de": "Hotel klassisch", "en": "Classic hotel"},
        "description": {
            "de": "Zimmer, Haus, Restaurant, Anreise — für Häuser mit Tradition.",
            "en": "Rooms, house, restaurant, arrival — for houses with tradition.",
        },
        "branding": _HOTEL_BRANDING,
        "pages": _hotel_pages(
            ids=_HOTEL,
            hero={
                "eyebrow": {"de": "Willkommen", "en": "Welcome"},
                "heading": {"de": "Ankommen und bleiben", "en": "Arrive and stay"},
                "subheading": {
                    "de": "Ein Haus mit Geschichte, geführt von Menschen, die es lieben. Zimmer direkt beim Hotel buchen.",
                    "en": "A house with history, run by people who love it. Book rooms directly with the hotel.",
                },
                "cta_label": {"de": "Zimmer ansehen", "en": "View rooms"},
                "cta_href": "#objekte",
                "image_url": _img(_HOTEL[0], 2000, 1200),
                "variant": "fullscreen",
            },
            intro_html={
                "de": "<h2>Unser Haus</h2><p>Beschreiben Sie das Hotel in drei bis vier Sätzen: Lage, Charakter, wofür Gäste wiederkommen. Dieser Text steht direkt unter der Suche und wird häufiger gelesen als jede Unterseite.</p>",
                "en": "<h2>Our house</h2><p>Describe the hotel in three or four sentences: location, character, why guests return. This text sits directly below the search and is read more often than any subpage.</p>",
            },
            zimmer_headline={"de": "Unsere Zimmer", "en": "Our rooms"},
            leistungen=_HOTEL_LEISTUNGEN,
            restaurant=True,
        ),
    },
    "hotel_boutique": {
        "kategorie": "hotel",
        "name": {"de": "Hotel Boutique", "en": "Boutique hotel"},
        "description": {
            "de": "Knapp, bildstark, ohne Restaurant-Seite — für kleine Häuser.",
            "en": "Concise and image-led, without a restaurant page — for small houses.",
        },
        "branding": _BOUTIQUE_BRANDING,
        "pages": _hotel_pages(
            ids=_BOUTIQUE,
            hero={
                "eyebrow": {"de": "Boutique-Hotel", "en": "Boutique hotel"},
                "heading": {"de": "Wenige Zimmer. Viel Aufmerksamkeit.", "en": "Few rooms. Plenty of attention."},
                "subheading": {
                    "de": "Ein kleines Haus mit eigener Handschrift — jedes Zimmer anders eingerichtet.",
                    "en": "A small house with its own signature — every room furnished differently.",
                },
                "cta_label": {"de": "Zimmer ansehen", "en": "View rooms"},
                "cta_href": "#objekte",
                "image_url": _img(_BOUTIQUE[0], 2000, 1200),
                "variant": "split",
            },
            intro_html={
                "de": "<h2>Das Haus</h2><p>Was macht Ihr Haus besonders? Zwei, drei Sätze reichen — ein Boutique-Hotel verkauft sich über Bilder und über den Ton, nicht über Aufzählungen.</p>",
                "en": "<h2>The house</h2><p>What makes your house special? Two or three sentences are enough — a boutique hotel sells through images and tone, not through bullet lists.</p>",
            },
            zimmer_headline={"de": "Die Zimmer", "en": "The rooms"},
            leistungen=[
                _HOTEL_LEISTUNGEN[0],
                _HOTEL_LEISTUNGEN[1],
                _HOTEL_LEISTUNGEN[2],
            ],
            restaurant=False,
        ),
    },
    "bergchalet": {
        "kategorie": "vermietung",
        "name": {"de": "Bergchalet", "en": "Mountain Chalet"},
        "description": {"de": "Warm, holzig — für Chalets & Berghütten."},
        "branding": _BERG_BRANDING,
        "pages": [
            *_common_pages(
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
            *rechtliche_seiten(),
        ],
    },
    "kueste": {
        "kategorie": "vermietung",
        "name": {"de": "Küste & See", "en": "Coast & Lake"},
        "description": {"de": "Hell, luftig — für Strand- & Seehäuser."},
        "branding": _KUESTE_BRANDING,
        "pages": [
            *_common_pages(
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
            *rechtliche_seiten(),
        ],
    },
    "stadt": {
        "kategorie": "vermietung",
        "name": {"de": "Stadt-Apartments", "en": "City Apartments"},
        "description": {"de": "Modern, urban — für City-Apartments."},
        "branding": _STADT_BRANDING,
        "pages": [
            *_common_pages(
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
            *rechtliche_seiten(),
        ],
    },
}

# Reihenfolge der Galerie im Vorlagen-Reiter. Nach Betriebsart gruppiert und
# innerhalb der Gruppe nach Häufigkeit — NICHT alphabetisch: wer eine Agentur
# führt, soll seine Vorlage nicht zwischen drei Stimmungsvarianten suchen.
TEMPLATE_REIHENFOLGE = [
    "agentur",
    "ferienhaus",
    "hotel_klassisch",
    "hotel_boutique",
    "bergchalet",
    "kueste",
    "stadt",
]

# Kategorien in der Reihenfolge der Filterleiste.
KATEGORIEN = ["agentur", "vermietung", "hotel"]
