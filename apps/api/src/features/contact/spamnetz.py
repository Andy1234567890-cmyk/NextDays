"""Spam-Heuristik des Kontaktformulars — die Stufe NACH dem Captcha.

WARUM ES DIESE STUFE ÜBERHAUPT GIBT: Ein score-basiertes reCAPTCHA weist nichts
ab, es bewertet. Ein Bot, der einen echten Browser fernsteuert (Playwright,
Puppeteer, ein gekaperter Chrome), holt sich ein GÜLTIGES Token — er ist ja ein
echter Browser. Ob er durchkommt, entscheidet allein die Score-Schwelle, und
Google liefert für solche Fälle typisch 0.3–0.7. Alles, was oberhalb der Schwelle
landet, ist bis hierher ungeprüft.

Diese Prüfungen greifen deshalb dort, wo ein Skript sich verrät, ohne dass ein
Mensch es merkt:

  * **Zeitfalle** — wie lange war das Formular offen. Niemand tippt Name,
    Adresse und zwanzig Zeichen Nachricht in unter drei Sekunden; ein Skript
    füllt in Millisekunden.
  * **Wegwerf-Adressen** — Domains, die es nur gibt, um eine Antwort NICHT zu
    lesen. Wer uns schreibt und antworten lassen will, nimmt keine.
  * **Link-Häufung** — der klassische Werbetext. Drei oder mehr URLs in einer
    Kontaktanfrage ist kein Anliegen, das ist ein Aussand.

WAS BEWUSST NICHT DRIN IST: Eine Wortliste („viagra", „casino"). Sie altert
schlecht, trifft echte Nachrichten (jemand fragt nach unserer „Casino"-Zielgruppe)
und ist in 24 Sprachen nicht pflegbar. Die drei Signale oben sind
sprachunabhängig.

WURZEL 4/5: Jede Prüfung ist eine ABLEHNUNG mit Grund, kein stilles Verwerfen und
kein Ersatzwert. Fehlt der Zeitstempel ganz, gilt das NICHT als Verstoß — alte
Formulare im Cache eines Besuchers sollen weiter funktionieren; das Captcha und
die anderen Prüfungen greifen dort weiter.
"""
from __future__ import annotations

import re

# Wie lange ein Mensch mindestens braucht. Bewusst niedrig: Die Grenze soll
# Skripte fangen, nicht schnelle Tipper. Gemessen an der Untergrenze der
# Nachricht (20 Zeichen) plus Name und Adresse ist alles unter 3 Sekunden
# maschinell.
MIN_SEKUNDEN = 3.0

# Obergrenze gegen einen manipulierten Zeitstempel: Ein Bot, der einfach eine
# riesige Dauer behauptet, um die Untergrenze zu umgehen, fällt hier auf. 12
# Stunden lässt einen echten Besucher durch, der den Tab über Nacht offen hatte
# — mehr ist kein offenes Formular mehr, sondern ein erfundener Wert.
MAX_SEKUNDEN = 12 * 60 * 60.0

# Wie viele Links eine echte Kontaktanfrage höchstens enthält. Zwei ist
# großzügig: jemand nennt seine Website und ein Inserat. Ab drei ist es Werbung.
MAX_LINKS = 2

# Wegwerf-Adressdienste. Bewusst kurz und auf die verbreiteten beschränkt — eine
# vollständige Liste ist unmöglich (es entstehen täglich neue) und der Zweck ist
# nicht Vollständigkeit, sondern die häufigsten Fälle billig auszusortieren.
# Wer uns schreibt, um eine Antwort zu bekommen, benutzt keine dieser Domains.
WEGWERF_DOMAINS = frozenset(
    {
        "10minutemail.com",
        "20minutemail.com",
        "guerrillamail.com",
        "guerrillamail.info",
        "guerrillamail.net",
        "sharklasers.com",
        "mailinator.com",
        "trashmail.com",
        "trashmail.de",
        "yopmail.com",
        "yopmail.fr",
        "temp-mail.org",
        "tempmail.com",
        "tempr.email",
        "throwawaymail.com",
        "getnada.com",
        "dispostable.com",
        "maildrop.cc",
        "fakeinbox.com",
        "mytemp.email",
        "email-temp.com",
        "moakt.com",
        "mohmal.com",
        "spam4.me",
        "byom.de",
        "wegwerfemail.de",
        "muellmail.com",
    }
)

# URLs im Freitext. Zählt auch schemalose Angaben („www.x.de", „x.de/y"), weil
# genau die in Spam stehen, um einfache Filter zu umgehen.
# Nur Endungen, die in Spam auffällig häufig sind — bewusst NICHT `.de`/`.dk`:
# ein deutscher Satz endet mit einem Punkt, und „Rückruf. Vielen Dank" darf keine
# Domain sein.
_SPAM_TLD = "com|net|org|ru|cn|top|xyz|info|biz|shop|click|link"
_LINK = re.compile(
    r"(?:https?://|www\.)[^\s]+"
    rf"|\b[a-z0-9-]+\.(?:{_SPAM_TLD})\b",
    re.IGNORECASE,
)


class SpamVerdacht(Exception):
    """Anfrage sieht automatisiert aus.

    `grund` ist für UNSER Log — er benennt, welche Prüfung angesprochen hat.
    `antwort` ist der Text für den Absender und sagt bewusst NICHT, welche
    Prüfung es war: ein Bot soll nicht erfahren, an welcher Schraube er drehen
    muss (dieselbe Überlegung wie beim Honigtopf, der freundlich antwortet).
    """

    def __init__(self, grund: str) -> None:
        super().__init__(grund)
        self.grund = grund
        self.antwort = (
            "Die Anfrage wurde als automatisiert eingestuft und nicht "
            "angenommen."
        )


def links_zaehlen(text: str) -> int:
    """Wie viele URLs stehen im Text."""
    return len(_LINK.findall(text))


def ist_wegwerf_adresse(email: str) -> bool:
    """Gehört die Adresse zu einem Wegwerf-Dienst?

    Vergleich auf der vollständigen Domain, NICHT als Teilstring: „gmail.com"
    darf nicht an „tempmail.com" hängen bleiben, und eine echte Firma
    „mailinator-consulting.de" ist kein Wegwerf-Dienst.
    """
    _, _, domain = email.rpartition("@")
    return domain.strip().lower() in WEGWERF_DOMAINS


def pruefen(*, email: str, nachricht: str, dauer_sekunden: float | None) -> None:
    """Wirft `SpamVerdacht`, wenn die Anfrage maschinell aussieht.

    `dauer_sekunden` ist `None`, wenn das Formular keinen Zeitstempel mitschickt
    (alter Cache, JavaScript aus). Das ist ausdrücklich KEIN Verstoß — die Regel
    prüft eine Angabe, die da ist, und erfindet nichts, wo keine ist (Wurzel 4).
    """
    if dauer_sekunden is not None:
        if dauer_sekunden < MIN_SEKUNDEN:
            raise SpamVerdacht(
                f"zu_schnell ({dauer_sekunden:.2f}s < {MIN_SEKUNDEN}s)"
            )
        if dauer_sekunden > MAX_SEKUNDEN:
            raise SpamVerdacht(f"dauer_unglaubwuerdig ({dauer_sekunden:.0f}s)")

    if ist_wegwerf_adresse(email):
        raise SpamVerdacht("wegwerf_adresse")

    anzahl = links_zaehlen(nachricht)
    if anzahl > MAX_LINKS:
        raise SpamVerdacht(f"zu_viele_links ({anzahl} > {MAX_LINKS})")
