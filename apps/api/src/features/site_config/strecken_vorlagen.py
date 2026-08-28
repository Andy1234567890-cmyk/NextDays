"""Vorlagen für die BUCHUNGSSTRECKE — drei Formen, eine Wahl (0474).

WAS DAS IST
===========
Eine Strecken-Vorlage setzt die drei Seiten, die der Gast HINTEREINANDER
durchläuft: Objektseite → Buchung → Bestätigung. Sie werden gemeinsam gewählt
und nicht einzeln, weil sie zusammen einen Weg bilden. Eine moderne Objektseite
vor einem schmalen Behörden-Checkout wirkt wie zwei verschiedene Websites, und
genau dieser Bruch ist es, an dem ein Gast abbricht.

Der Blog gehört NICHT dazu. Er ist ein eigener Bereich mit eigenem CMS
(`/website/blog`), dessen Menüpunkt „Layouts" bereits auf die Bausteine der
Blog-Übersicht zeigt. Ihn hier mitzusetzen hieße, dass eine Wahl in der
Buchungsstrecke das Aussehen des Blogs ändert — zwei Orte für dieselbe
Entscheidung (Wurzel 2).

WARUM DREI UND NICHT FÜNF
=========================
Die drei sind keine Stimmungen, sondern die drei Bauformen, die die Vorbilder
real fahren (docs/BUCHUNGSSTRECKE-VORBILDER.md, erhoben am 25.08.2026):

* ``klassisch`` — Airbnb/Booking: Galerie-Raster, Buchungsfeld seitlich
  mitlaufend, Checkout in drei Stufen mit seitlicher Zusammenfassung.
* ``vollbild`` — Lodgify: randloses Titelbild, Buchung als Einseiter mit der
  Zusammenfassung unten. Lodgify ist der einzige Anbieter, der eine echte
  Inline-Buchung ohne Seitenwechsel bewirbt.
* ``sachlich`` — Hostaway/SiteMinder: schmale Spalte, Text vor Bild, die
  Zusammenfassung OBEN, weil mobil zuerst gedacht.

Eine vierte Variante wäre eine Mischung aus diesen, und eine Mischung, die
niemand betreibt, ist geraten. Wer sie will, baut sie: nach dem Anwenden ist
jede Vorlage ein normaler Startpunkt, den der Betrieb im Editor umbaut.

WAS EINE VORLAGE NICHT TUT
==========================
* Keine Marketing-Texte erfinden. Die Beispieltexte beschreiben, was an die
  Stelle gehört; sie sind Anleitung, nicht fertige Werbung, die jemand
  versehentlich veröffentlicht (dieselbe Regel wie in ``seiten_vorlagen.py``).
* Keine Preise, keine Zahlungsarten, keine Stornoregeln setzen. Das sind Daten
  des Betriebs, keine Gestaltung.
* Das Farbschema NICHT anfassen. Anders als die Website-Vorlagen in
  ``templates.py``, die eine ganze Marke setzen, greift eine Strecken-Vorlage
  in eine BESTEHENDE Website ein. Ihre Farben zu überschreiben wäre ein
  Gegenzustand, den niemand bestellt hat (Wurzel 1).

SPRACHEN DER BEISPIELTEXTE
==========================
Deutsch und Englisch, wie bei den Seiten-Vorlagen. Ein Platzhaltertext, den der
Betrieb ersetzt, in 24 Sprachen zu pflegen hieße, 24 Fassungen eines Textes zu
pflegen, den niemand behalten will. Die OBERFLÄCHE des Baukastens steht
vollständig in allen 24 Sprachen (`website.strecke.*`).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

#: Die Seiten, die eine Strecken-Vorlage setzt, in der Reihenfolge des Gastes.
#:
#: Die Objektseite ist eine DYNAMISCHE Seite (`dynamic_source='property'`), die
#: beiden anderen sind SYSTEMSEITEN (`system_key`). Deshalb steht hier beides:
#: der Anwender muss die Zeile finden, und sie wird über verschiedene Spalten
#: gefunden (0466 vs. 0468).
ZIELE: tuple[tuple[str, str], ...] = (
    ("dynamic_source", "property"),
    ("system_key", "checkout"),
    ("system_key", "checkout_abgeschlossen"),
)


@dataclass(frozen=True)
class Strecke:
    """Eine Buchungsstrecke: drei Seiten in einer Form."""

    key: str
    """Stabile Kennung. Sie steht in der Adresse des Endpunkts und im
    Übersetzungskatalog — nie ein Anzeigename, der in einer Sprache
    festgeschrieben wäre (Wurzel 4)."""

    objekt: list[dict[str, Any]]
    """Die Bausteine der Objektseite."""

    checkout: list[dict[str, Any]]
    """Die Bausteine der Buchungsseite. MUSS ``checkout_form`` enthalten — sonst
    legt die Vorlage eine Buchungsstrecke an, in der niemand buchen kann. Der
    Anwender prüft das (``pruefen``), damit ein Fehler hier beim Testlauf
    auffliegt und nicht beim ersten Gast."""

    bestaetigung: list[dict[str, Any]]
    """Die Bausteine der Bestätigungsseite."""


def _text(de: str, en: str) -> dict[str, str]:
    """Ein zweisprachiges Textfeld."""
    return {"de": de, "en": en}


# ===========================================================================
# 1) klassisch — das Airbnb/Booking-Muster
# ===========================================================================
# Das verbreitetste Muster und deshalb der Vorschlag: der Gast kennt es. Die
# Galerie als Raster oben, links die Beschreibung, rechts das mitlaufende
# Buchungsfeld. Im Checkout drei Stufen und die Zusammenfassung seitlich, damit
# der Preis während der Eingabe sichtbar bleibt.
_KLASSISCH = Strecke(
    key="klassisch",
    objekt=[
        {
            "type": "property_gallery",
            "content": {"layout": "grid", "max_images": 5, "lightbox": True},
        },
        {
            "type": "property_description",
            "content": {
                "headline": _text("Über dieses Objekt", "About this place"),
                # 900 Zeichen, dann „Mehr anzeigen": eine vollständige
                # Objektbeschreibung schiebt Ausstattung und Karte sonst aus
                # dem ersten Bildschirm.
                "truncate_at": 900,
            },
        },
        {
            "type": "property_amenities",
            "content": {
                "headline": _text("Ausstattung", "Amenities"),
                "columns": 2,
            },
        },
        {
            "type": "property_map",
            "content": {
                "headline": _text("Lage", "Location"),
                # Umkreis statt Nadel: die genaue Anschrift eines bewohnten
                # Hauses gehört nicht vor die Buchung (siehe
                # PropertyMapContent).
                "exact": False,
            },
        },
        {
            "type": "property_book_form",
            "content": {
                # Leer = das Objekt der aktuellen Seite. Auf der dynamischen
                # Objektseite ist das der einzige richtige Wert.
                "property_id": None,
                "show_price": True,
            },
        },
    ],
    checkout=[
        {
            "type": "checkout_summary",
            "content": {
                "headline": _text("Ihre Buchung", "Your booking"),
                "position": "side",
                "show_photo": True,
                "show_breakdown": True,
            },
        },
        {
            "type": "checkout_form",
            "content": {
                "headline": _text("Buchung abschließen", "Complete your booking"),
                "steps": "three",
                "show_step_labels": True,
                "trust_note": _text(
                    "Ihre Zahlung läuft verschlüsselt über unseren "
                    "Zahlungsdienstleister.",
                    "Your payment is processed securely by our payment provider.",
                ),
            },
        },
    ],
    bestaetigung=[
        {
            "type": "checkout_result",
            "content": {
                "success_headline": _text("Buchung bestätigt", "Booking confirmed"),
                "success_text": _text(
                    "Wir haben Ihre Buchung erhalten und freuen uns auf Ihren "
                    "Aufenthalt. Alle Angaben schicken wir Ihnen zusätzlich per "
                    "E-Mail.",
                    "We have received your booking and look forward to your "
                    "stay. We will also send you all details by email.",
                ),
                "show_booking_number": True,
                "show_portal_link": True,
            },
        },
    ],
)


# ===========================================================================
# 2) vollbild — das Lodgify-Muster
# ===========================================================================
# Das Bild trägt die Seite. Ein randloser Slider oben, darunter der Text in
# einer breiten Spalte, das Buchungsfeld im Fluss statt an der Seite. Der
# Checkout ist ein Einseiter: eine Stufe, alles untereinander, die
# Zusammenfassung ganz unten direkt über dem Abschluss-Knopf.
_VOLLBILD = Strecke(
    key="vollbild",
    objekt=[
        {
            "type": "property_gallery",
            # `slider` statt `grid`: eine Reihe zum Wischen, die die ganze
            # Breite nimmt. Mehr Bilder als beim Raster, weil jedes einzeln
            # groß gezeigt wird.
            "content": {"layout": "slider", "max_images": 12, "lightbox": True},
        },
        {
            "type": "property_description",
            "content": {
                "headline": _text("Willkommen", "Welcome"),
                # Nicht kürzen: bei dieser Form IST der Text der Inhalt, und
                # ein „Mehr anzeigen" mitten in der Erzählung bricht sie.
                "truncate_at": 0,
            },
        },
        {
            "type": "property_book_form",
            "content": {"property_id": None, "show_price": True},
        },
        {
            "type": "property_amenities",
            "content": {
                "headline": _text("Das ist alles da", "Everything you need"),
                # Vier Spalten: bei voller Breite stehen zwei Spalten weit
                # auseinander und lesen sich als zwei Listen.
                "columns": 4,
            },
        },
        {
            "type": "property_map",
            "content": {
                "headline": _text("So finden Sie uns", "How to find us"),
                "exact": False,
                # Höher als der Standard: die Karte ist hier ein Bildelement,
                # kein Nachweis.
                "height": 520,
            },
        },
    ],
    checkout=[
        {
            "type": "checkout_form",
            "content": {
                "headline": _text("Nur noch ein Schritt", "One last step"),
                "intro": _text(
                    "Tragen Sie Ihre Angaben ein — Sie sehen den Gesamtpreis "
                    "unten, bevor Sie bestätigen.",
                    "Enter your details — you will see the total below before "
                    "you confirm.",
                ),
                "steps": "one",
                # Ohne Stufen gibt es keinen Fortschritt zu benennen.
                "show_step_labels": False,
                "submit_label": _text("Jetzt buchen", "Book now"),
            },
        },
        {
            "type": "checkout_summary",
            "content": {
                "headline": _text("Übersicht", "Summary"),
                "position": "bottom",
                "show_photo": True,
                "show_breakdown": True,
            },
        },
    ],
    bestaetigung=[
        {
            "type": "checkout_result",
            "content": {
                "success_headline": _text(
                    "Wir freuen uns auf Sie", "We look forward to seeing you"
                ),
                "success_text": _text(
                    "Ihre Buchung steht. Kurz vor der Anreise melden wir uns "
                    "mit allem, was Sie für die Ankunft brauchen.",
                    "Your booking is confirmed. Shortly before arrival we will "
                    "get in touch with everything you need.",
                ),
                "show_booking_number": True,
                "show_portal_link": True,
            },
        },
    ],
)


# ===========================================================================
# 3) sachlich — das Hostaway/SiteMinder-Muster
# ===========================================================================
# Information vor Wirkung. Text zuerst, Bilder danach, alles in einer schmalen
# Spalte. Der Checkout hat zwei Stufen und die Zusammenfassung OBEN — Hostaway
# begründet das mit dem Telefon: seitlich rutscht sie dort unter das Formular
# und wird nie gesehen.
_SACHLICH = Strecke(
    key="sachlich",
    objekt=[
        {
            "type": "property_description",
            "content": {
                "headline": _text("Das Objekt", "The property"),
                "truncate_at": 0,
            },
        },
        {
            "type": "property_amenities",
            "content": {
                "headline": _text("Ausstattung im Überblick", "Amenities at a glance"),
                # Eine Spalte: in der schmalen Bahn stehen zwei Spalten zu eng.
                "columns": 1,
            },
        },
        {
            "type": "property_gallery",
            "content": {"layout": "grid", "max_images": 8, "lightbox": True},
        },
        {
            "type": "property_map",
            "content": {
                "headline": _text("Anfahrt", "Getting there"),
                "exact": False,
                "height": 300,
            },
        },
        {
            "type": "property_book_form",
            "content": {"property_id": None, "show_price": True},
        },
    ],
    checkout=[
        {
            "type": "checkout_summary",
            "content": {
                "headline": _text("Das buchen Sie", "What you are booking"),
                "position": "top",
                # Kein Foto: diese Form arbeitet mit Angaben, und das Foto
                # stand auf der Objektseite schon.
                "show_photo": False,
                "show_breakdown": True,
                "show_cancellation": True,
            },
        },
        {
            "type": "checkout_form",
            "content": {
                "headline": _text("Ihre Angaben", "Your details"),
                "steps": "three",
                "show_step_labels": True,
                "trust_note": _text(
                    "Mit dem Abschluss bestätigen Sie unsere "
                    "Buchungsbedingungen.",
                    "By completing the booking you accept our booking terms.",
                ),
            },
        },
    ],
    bestaetigung=[
        {
            "type": "checkout_result",
            "content": {
                "success_headline": _text("Buchung eingegangen", "Booking received"),
                "success_text": _text(
                    "Ihre Buchungsnummer finden Sie unten. Sie erhalten die "
                    "Bestätigung zusätzlich per E-Mail.",
                    "Your booking number is shown below. You will also receive "
                    "the confirmation by email.",
                ),
                "pending_headline": _text(
                    "Zahlung wird geprüft", "Payment being processed"
                ),
                "pending_text": _text(
                    "Ihre Zahlung ist unterwegs. Sobald sie eingegangen ist, "
                    "erhalten Sie die Bestätigung — das kann bei manchen "
                    "Zahlungsarten einige Stunden dauern.",
                    "Your payment is on its way. As soon as it arrives you will "
                    "receive the confirmation — with some payment methods this "
                    "can take a few hours.",
                ),
                "show_booking_number": True,
                "show_portal_link": True,
            },
        },
    ],
)


#: Reihenfolge im Auswahl-Fenster. ``klassisch`` steht vorn, weil es das Muster
#: ist, das der Gast von den Portalen kennt — nicht weil es „das beste" wäre.
STRECKEN: tuple[Strecke, ...] = (_KLASSISCH, _VOLLBILD, _SACHLICH)

_NACH_KEY = {s.key: s for s in STRECKEN}


def finde(key: str) -> Strecke | None:
    """Die Strecke zu einer Kennung, oder ``None`` bei unbekanntem Namen."""
    return _NACH_KEY.get(key)


def pruefen() -> None:
    """Selbstprüfung des Katalogs — jede Strecke kann buchen.

    Läuft im Test, nicht zur Laufzeit: der Katalog ist Quellcode, kein
    Kundeninput. Was hier auffliegt, ist ein Tippfehler beim Erweitern — eine
    Strecke ohne ``checkout_form`` würde eine Buchungsseite anlegen, auf der
    niemand buchen kann, und das fiele erst dem ersten Gast auf.

    Der Service prüft dieselbe Regel noch einmal beim ANWENDEN
    (``_pflicht_baustein_pruefen``). Doppelt und mit Absicht: hier gegen unseren
    eigenen Fehler, dort gegen den des Kunden.
    """
    for strecke in STRECKEN:
        typen = [b["type"] for b in strecke.checkout]
        if "checkout_form" not in typen:
            raise ValueError(
                f"Strecke {strecke.key!r} hat keinen checkout_form-Baustein — "
                "mit ihr könnte niemand buchen."
            )
