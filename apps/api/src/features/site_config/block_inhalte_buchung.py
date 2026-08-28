"""Inhalts-Schemas der Buchungsstrecken-Bausteine (0474).

Die Bausteine der Seiten NACH der Objektseite: Buchung und Bestätigung, dazu die
vollständige Beitragsliste des Blogs.

WARUM SIE ÜBERHAUPT BAUSTEINE SIND
==================================
Bis 0474 waren ``/checkout/<id>``, ``/checkout/abgeschlossen`` und ``/blog``
Systemseiten OHNE Blöcke — fest programmierte Routen. Die Seitenliste führte
sie, aber ein Klick öffnete nur die SEO-Felder. Für die Objektseite war genau
das schon einmal der Fehler (0468): die Seite, auf der gebucht wird, ist der
eigentliche Wert des Baukastens, und eine Seite, die man nicht gestalten kann,
nimmt dem Vermieter genau das weg.

Für den Checkout gilt es doppelt: er ist der letzte Schritt vor dem Geld. Wer
dort keinen eigenen Vertrauens-Hinweis, keinen eigenen Ton und keine eigene
Reihenfolge setzen kann, verkauft mit einer fremden Seite.

WAS HIER GESTALTBAR IST — UND WAS NIE
=====================================
Dieselbe Trennung wie bei den Objekt-Bausteinen: Text und Anordnung gehören der
Seite, die FUNKTION gehört der Anwendung.

* Gestaltbar: Überschriften, Einleitungen, Reihenfolge, Spaltenbreite, ob die
  Zusammenfassung seitlich oder oben steht.
* Nie gestaltbar: welche Zahlungsarten es gibt (das entscheidet das
  Zahlungskonto des Betriebs), welcher Betrag fällig ist (das rechnet der
  Preis-Resolver) und was das Zahlungsergebnis war (das sagt Stripe).

Ein Feld, mit dem man den ANGEZEIGTEN Betrag verändern könnte, gibt es hier
deshalb nicht — es wäre eine zweite Wahrheit über Geld.

DER PFLICHT-BLOCK
=================
``checkout_form`` ist der Baustein, ohne den niemand buchen kann. Er lässt sich
nicht als letzter von der Buchungsseite löschen (:mod:`bloecke`) — nicht weil
Löschen technisch schwierig wäre, sondern weil das Ergebnis eine Website ist,
die aussieht wie eine Buchungsstrecke und keine ist. Ein solcher Zustand fällt
niemandem auf, bis ein Gast nicht buchen kann (Wurzel 5: fail-closed).
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

#: Wie viele Zeichen ein mehrsprachiges Textfeld je Sprache tragen darf.
#: Derselbe Deckel wie bei den übrigen Blöcken — kein unbegrenzter Bereich
#: (Wurzel 8).
MAX_TEXT = 400

#: Wo die Buchungs-Zusammenfassung neben dem Formular steht. Die drei Werte sind
#: nicht drei Geschmäcker, sondern die drei Bauformen, die die Vorbilder fahren
#: (docs/BUCHUNGSSTRECKE-VORBILDER.md): seitlich (Airbnb/Booking), oben
#: (Hostaway, weil mobil zuerst) und unten (Lodgify' Einseiter).
SUMMARY_POSITIONEN = ("side", "top", "bottom")

#: Wie viele Stufen der Buchungsabschluss hat. ``three`` ist der heutige Weg
#: (Zahlungszeitpunkt → Zahlungsart → Prüfen), ``one`` legt alles auf eine
#: Seite. Kein freier Zahlenwert: eine vierte Stufe gibt es im Renderer nicht,
#: und ein Feld, das mehr zulässt als es bewirkt, ist eine Attrappe (Wurzel 4).
CHECKOUT_STUFEN = ("three", "one")


def _kurz_pruefen(v: dict[str, str], was: str) -> dict[str, str]:
    """Jede Sprachfassung gegen ``MAX_TEXT`` prüfen.

    Eigene Funktion statt fünf gleicher Validatoren: die Meldung nennt das FELD,
    damit der Kunde weiß, welches Textfeld zu lang ist — eine Meldung
    „Text ist zu lang" an einem Formular mit vier Textfeldern ist keine.
    """
    for sprache, text in v.items():
        if len(text) > MAX_TEXT:
            raise ValueError(f"{was} in {sprache} ist länger als {MAX_TEXT} Zeichen.")
    return v


class CheckoutFormContent(BaseModel):
    """Der Buchungsabschluss — der PFLICHT-Block der Buchungsseite.

    Er trägt die Stufenführung, die Gastdaten-Felder und die Zahlungsauswahl.
    Was hier steht, ist ausschließlich Rahmen: Überschrift, Einleitung,
    Knopfbeschriftung und die Zahl der Stufen. Die Zahlungsarten selbst kommen
    aus dem Zahlungskonto des Betriebs — sie hier zu wiederholen hieße, dass ein
    Betrieb eine Zahlungsart anbieten kann, die sein Konto nicht kassiert.
    """

    #: Überschrift der Buchungsseite. Leer = der übersetzte Standard des
    #: Renderers, nicht etwa keine Überschrift.
    headline: dict[str, str] = Field(default_factory=dict)
    #: Einleitungstext unter der Überschrift. Leer = kein Text; hier ist der
    #: Leer-Zustand wirklich leer, denn ein erfundener Einleitungssatz vor einer
    #: Zahlung wäre eine Aussage im Namen des Betriebs.
    intro: dict[str, str] = Field(default_factory=dict)
    #: Beschriftung des Abschluss-Knopfes. Leer = übersetzter Standard.
    submit_label: dict[str, str] = Field(default_factory=dict)
    #: Hinweis direkt über dem Abschluss-Knopf — der Ort für „Sichere Zahlung
    #: über …" oder den Verweis auf die Stornobedingungen.
    trust_note: dict[str, str] = Field(default_factory=dict)
    #: Stufenführung, siehe ``CHECKOUT_STUFEN``.
    steps: str = "three"
    #: Die Stufennamen im Fortschrittsbalken anzeigen.
    show_step_labels: bool = True

    @field_validator("headline", "intro", "submit_label", "trust_note")
    @classmethod
    def _texte(cls, v: dict[str, str]) -> dict[str, str]:
        return _kurz_pruefen(v, "Text")

    @field_validator("steps")
    @classmethod
    def _steps(cls, v: str) -> str:
        if v not in CHECKOUT_STUFEN:
            raise ValueError(
                "Stufenführung muss " + " oder ".join(CHECKOUT_STUFEN) + " sein."
            )
        return v


class CheckoutSummaryContent(BaseModel):
    """Die Zusammenfassung dessen, was gebucht wird.

    Objekt, Zeitraum, Gästezahl, Preisaufstellung. Ein eigener Baustein neben
    ``checkout_form`` und kein Schalter daran, weil genau hier die
    Strecken-Vorlagen auseinandergehen: bei Airbnb steht sie seitlich und
    scrollt mit, bei Hostaway oben (mobil zuerst), bei Lodgify unten.

    KEIN Feld für Beträge. Der Preis kommt aus dem Preis-Resolver; ein hier
    eingetragener Betrag wäre eine zweite Wahrheit über Geld und im Streitfall
    die falsche.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    #: Wo sie steht, siehe ``SUMMARY_POSITIONEN``.
    position: str = "side"
    #: Das Titelfoto des Objekts mitzeigen.
    show_photo: bool = True
    #: Die Preisaufstellung aufklappen statt nur die Summe zu zeigen.
    show_breakdown: bool = True
    #: Die Stornobedingungen mit anzeigen. Standard an: sie stehen sonst nur in
    #: den AGB, und der Gast entscheidet hier.
    show_cancellation: bool = True

    @field_validator("headline")
    @classmethod
    def _texte(cls, v: dict[str, str]) -> dict[str, str]:
        return _kurz_pruefen(v, "Überschrift")

    @field_validator("position")
    @classmethod
    def _position(cls, v: str) -> str:
        if v not in SUMMARY_POSITIONEN:
            raise ValueError(
                "Position muss " + " oder ".join(SUMMARY_POSITIONEN) + " sein."
            )
        return v


class CheckoutResultContent(BaseModel):
    """Das Zahlungsergebnis auf der Rückkehr-Seite.

    Stripe leitet nach einer umleitungsbasierten Zahlung (iDEAL, Giropay, …)
    hierher zurück und hängt ``redirect_status`` und ``payment_intent`` an die
    Adresse. Dieser Baustein wertet sie aus.

    Gestaltbar sind die Texte für die drei Ausgänge — geglückt, offen,
    fehlgeschlagen. Das ERGEBNIS selbst nie: es kommt von Stripe, und ein
    Betrieb, der „geglückt" über eine fehlgeschlagene Zahlung schreiben kann,
    hat einen Gast, der ohne Buchung anreist.

    Die Texte dürfen Platzhalter tragen (``{buchungsnummer}``, ``{objekt}``,
    ``{anreise}``) — dieselben, die auch die Bestätigungsmail kennt. Sie werden
    beim Rendern gesetzt, nicht beim Speichern: eine Buchungsnummer, die beim
    Speichern eingesetzt würde, wäre für jeden Gast dieselbe.
    """

    #: Überschrift bei geglückter Zahlung. Leer = übersetzter Standard.
    success_headline: dict[str, str] = Field(default_factory=dict)
    #: Text bei geglückter Zahlung — der Ort für „Wir freuen uns auf Sie".
    success_text: dict[str, str] = Field(default_factory=dict)
    #: Überschrift, solange die Zahlung noch läuft (``processing``).
    pending_headline: dict[str, str] = Field(default_factory=dict)
    pending_text: dict[str, str] = Field(default_factory=dict)
    #: Überschrift bei fehlgeschlagener Zahlung.
    failed_headline: dict[str, str] = Field(default_factory=dict)
    failed_text: dict[str, str] = Field(default_factory=dict)
    #: Die Buchungsnummer anzeigen. Standard an: der Gast braucht sie für jede
    #: Rückfrage.
    show_booking_number: bool = True
    #: Den Link ins Gast-Portal anzeigen.
    show_portal_link: bool = True

    @field_validator(
        "success_headline",
        "success_text",
        "pending_headline",
        "pending_text",
        "failed_headline",
        "failed_text",
    )
    @classmethod
    def _texte(cls, v: dict[str, str]) -> dict[str, str]:
        return _kurz_pruefen(v, "Text")


class PostListContent(BaseModel):
    """Die vollständige Beitragsliste mit Blättern.

    Ein eigener Typ neben ``posts``: dieser hier ist die ÜBERSICHT, ``posts``
    der Teaser („die letzten drei") für eine beliebige Seite. Der Unterschied
    ist nicht die Zahl, sondern das Blättern und die Filter — ein Teaser mit
    Seitenschaltern wären zwei Bausteine in einem.

    Er gehört auf die Blog-Übersichtsseite. Deren Layout wird im Blog-CMS unter
    „Layouts" gewählt, und dieser Baustein ist das, was dort gewählt wird —
    keine zweite Maske mit denselben Werten.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    #: Beiträge je Seite. Kein unbegrenzter Bereich (Wurzel 8); der Deckel
    #: darüber steht im Service (``MAX_BEITRAEGE``).
    per_page: int = Field(default=9, ge=1, le=50)
    #: Spalten der Kachelwand. 1 = Liste untereinander.
    columns: int = Field(default=3, ge=1, le=4)
    #: Das Titelbild je Beitrag zeigen.
    show_cover: bool = True
    #: Den Anriss zeigen.
    show_excerpt: bool = True
    #: Das Erscheinungsdatum zeigen. Gemeint ist ``published_at`` — NICHT
    #: ``created_at``: „erschienen" ist eine Aussage über die Website,
    #: „angelegt" eine über unsere Datenbank (Wurzel 5b).
    show_date: bool = True
    #: Den Autor zeigen.
    show_author: bool = False
    #: Die Schlagwort-Filter über der Liste zeigen.
    show_tags: bool = True

    @field_validator("headline")
    @classmethod
    def _texte(cls, v: dict[str, str]) -> dict[str, str]:
        return _kurz_pruefen(v, "Überschrift")
