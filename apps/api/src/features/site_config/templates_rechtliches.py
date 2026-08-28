"""Die Rechtsseiten, die jede Vorlage mitbringt (Impressum, Datenschutz, AGB,
Widerruf, Cookies).

Eigenes Modul und nicht Teil von ``templates.py``: es ist der Teil, der sich
unabhängig von Gestaltung und Betriebsart ändert — wenn ein Gesetz eine weitere
Pflichtangabe verlangt, wird HIER geändert, und zwar für alle Vorlagen auf
einmal.

Was hier NICHT steht: fertige Rechtstexte. Ein generierter Datenschutztext, der
zufällig nicht zur tatsächlichen Verarbeitung passt, ist schlimmer als ein
leeres Feld — er sieht richtig aus. Geliefert wird die GLIEDERUNG plus ein
Hinweis, was in den Abschnitt gehört.
"""
# Reines Daten-/Fixture-Modul: die langen Hinweistexte werden bewusst nicht
# umgebrochen (Lesbarkeit der Inhalte > Zeilenlänge).
# pylint: disable=line-too-long
from __future__ import annotations

from typing import Any


def _rt(de: str, en: str) -> dict[str, Any]:
    """Rich-Text-Inhalt aus zwei Sprachfassungen."""
    return {"html": {"de": de, "en": en}}


# Ein Absatz, der in JEDER Rechtsseite oben steht. Er ist bewusst unübersehbar:
# eine veröffentlichte Vorlage, die wie ein fertiger Rechtstext aussieht, wäre
# gefährlicher als eine leere Seite.
_RECHT_WARNUNG_DE = (
    "<p><strong>Diese Seite ist eine Vorlage.</strong> Ersetzen Sie die "
    "Platzhalter durch Ihre eigenen Angaben und lassen Sie den Text vor der "
    "Veröffentlichung prüfen. Wir stellen die Gliederung bereit, keine "
    "Rechtsberatung.</p>"
)
_RECHT_WARNUNG_EN = (
    "<p><strong>This page is a template.</strong> Replace the placeholders with "
    "your own details and have the text reviewed before publishing. We provide "
    "the structure, not legal advice.</p>"
)


def rechtsseite(
    *,
    slug: str,
    titel: str,
    titel_en: str,
    abschnitte_de: str,
    abschnitte_en: str,
    mit_kontakt: bool = False,
) -> dict[str, Any]:
    """Eine Rechtsseite: Kopf, Warnhinweis, Gliederung — optional Kontaktdaten.

    ``mit_kontakt`` hängt einen ``contact``-Block an. Der Service füllt ihn aus
    dem Firmenprofil (``konto_daten.kontakt_mit_firmendaten``) — im Impressum
    steht die Anschrift damit richtig da, ohne dass sie jemand abtippt."""
    blocks: list[dict[str, Any]] = [
        {
            "type": "hero",
            "content": {
                "heading": {"de": titel, "en": titel_en},
                "variant": "centered",
            },
        },
        {
            "type": "rich_text",
            "content": _rt(
                _RECHT_WARNUNG_DE + abschnitte_de,
                _RECHT_WARNUNG_EN + abschnitte_en,
            ),
        },
    ]
    if mit_kontakt:
        blocks.append(
            {
                "type": "contact",
                "content": {
                    "headline": {"de": "Anbieter", "en": "Provider"},
                    "show_form": False,
                },
            }
        )
    return {
        "slug": slug,
        "title": titel,
        "is_home": False,
        # Fußzeile: dort sucht der Gast Impressum und Datenschutz, und die
        # Kopfzeile bleibt für die verkaufenden Seiten frei.
        "nav_area": "footer",
        "blocks": blocks,
    }


def rechtliche_seiten() -> list[dict[str, Any]]:
    """Die fünf Seiten, die eine gewerbliche Vermietungs-Website in der EU braucht."""
    return [
        rechtsseite(
            slug="impressum",
            titel="Impressum",
            titel_en="Legal notice",
            mit_kontakt=True,
            abschnitte_de=(
                "<h2>Angaben gemäß § 5 DDG</h2><p>Firmenname, Rechtsform, "
                "Anschrift, vertretungsberechtigte Person. Diese Angaben zieht "
                "der Abschnitt unten automatisch aus Ihrem Firmenprofil.</p>"
                "<h2>Kontakt</h2><p>Telefonnummer und E-Mail-Adresse, unter der "
                "Sie erreichbar sind.</p>"
                "<h2>Registereintrag</h2><p>Registergericht und Registernummer, "
                "sofern vorhanden.</p>"
                "<h2>Umsatzsteuer-Identifikationsnummer</h2><p>Ihre USt-IdNr. "
                "gemäß § 27 a UStG, sofern vorhanden.</p>"
                "<h2>Aufsichtsbehörde</h2><p>Zuständige Behörde, wenn Ihre "
                "Tätigkeit einer Zulassung bedarf.</p>"
                "<h2>Verbraucherstreitbeilegung</h2><p>Hinweis, ob Sie an einem "
                "Streitbeilegungsverfahren vor einer Verbraucher"
                "schlichtungsstelle teilnehmen.</p>"
            ),
            abschnitte_en=(
                "<h2>Company details</h2><p>Company name, legal form, address "
                "and authorised representative. The section below pulls these "
                "details from your company profile automatically.</p>"
                "<h2>Contact</h2><p>Phone number and email address where you "
                "can be reached.</p>"
                "<h2>Commercial register</h2><p>Register court and number, if "
                "applicable.</p>"
                "<h2>VAT identification number</h2><p>Your VAT ID, if "
                "applicable.</p>"
                "<h2>Supervisory authority</h2><p>The competent authority, if "
                "your activity requires a licence.</p>"
                "<h2>Consumer dispute resolution</h2><p>Whether you take part "
                "in dispute resolution before a consumer arbitration board.</p>"
            ),
        ),
        rechtsseite(
            slug="datenschutz",
            titel="Datenschutz",
            titel_en="Privacy policy",
            abschnitte_de=(
                "<h2>Verantwortlicher</h2><p>Wer über die Verarbeitung Ihrer "
                "Daten entscheidet — in der Regel der Betrieb aus dem "
                "Impressum.</p>"
                "<h2>Welche Daten wir verarbeiten</h2><p>Buchungsdaten, "
                "Kontaktangaben, Zahlungsdaten, Server-Protokolle. Beschreiben "
                "Sie hier, was Sie tatsächlich erheben.</p>"
                "<h2>Zweck und Rechtsgrundlage</h2><p>Vertragserfüllung "
                "(Art. 6 Abs. 1 lit. b DSGVO), gesetzliche Pflichten, "
                "berechtigtes Interesse, Einwilligung.</p>"
                "<h2>Empfänger</h2><p>Zahlungsdienstleister, Buchungsportale, "
                "Reinigungsdienste — alle, die Daten von Ihnen erhalten.</p>"
                "<h2>Speicherdauer</h2><p>Wie lange Sie welche Daten "
                "aufbewahren, und warum.</p>"
                "<h2>Ihre Rechte</h2><p>Auskunft, Berichtigung, Löschung, "
                "Einschränkung, Datenübertragbarkeit, Widerspruch und "
                "Beschwerde bei einer Aufsichtsbehörde.</p>"
                "<h2>Cookies und Reichweitenmessung</h2><p>Verweis auf Ihre "
                "Cookie-Richtlinie.</p>"
            ),
            abschnitte_en=(
                "<h2>Controller</h2><p>Who decides how your data is processed — "
                "usually the business named in the legal notice.</p>"
                "<h2>What data we process</h2><p>Booking data, contact details, "
                "payment data, server logs. Describe what you actually "
                "collect.</p>"
                "<h2>Purpose and legal basis</h2><p>Performance of a contract "
                "(Art. 6(1)(b) GDPR), legal obligations, legitimate interest, "
                "consent.</p>"
                "<h2>Recipients</h2><p>Payment providers, booking portals, "
                "cleaning services — everyone who receives data from you.</p>"
                "<h2>Retention</h2><p>How long you keep which data, and why.</p>"
                "<h2>Your rights</h2><p>Access, rectification, erasure, "
                "restriction, portability, objection and the right to lodge a "
                "complaint with a supervisory authority.</p>"
                "<h2>Cookies and analytics</h2><p>Reference to your cookie "
                "policy.</p>"
            ),
        ),
        rechtsseite(
            slug="agb",
            titel="AGB",
            titel_en="Terms and conditions",
            abschnitte_de=(
                "<h2>Geltungsbereich</h2><p>Für welche Buchungen diese "
                "Bedingungen gelten.</p>"
                "<h2>Vertragsschluss</h2><p>Wann die Buchung verbindlich wird — "
                "mit Ihrer Bestätigung, nicht mit der Anfrage.</p>"
                "<h2>Preise und Zahlung</h2><p>Anzahlung, Restzahlung, "
                "Zahlungsmittel, Kurtaxe und weitere Abgaben.</p>"
                "<h2>Stornierung und Nichtanreise</h2><p>Ihre Fristen und "
                "Sätze. Diese Angaben müssen zu den Stornobedingungen passen, "
                "die im Buchungsvorgang angezeigt werden.</p>"
                "<h2>An- und Abreise</h2><p>Zeiten für Check-in und Check-out, "
                "Schlüsselübergabe.</p>"
                "<h2>Pflichten des Gastes</h2><p>Belegungszahl, Haustiere, "
                "Rauchen, Feiern, Hausordnung.</p>"
                "<h2>Haftung</h2><p>Ihre Haftung und die des Gastes für "
                "Schäden.</p>"
                "<h2>Schlussbestimmungen</h2><p>Anwendbares Recht und "
                "Gerichtsstand.</p>"
            ),
            abschnitte_en=(
                "<h2>Scope</h2><p>Which bookings these terms apply to.</p>"
                "<h2>Conclusion of contract</h2><p>When a booking becomes "
                "binding — on your confirmation, not on the enquiry.</p>"
                "<h2>Prices and payment</h2><p>Deposit, balance, payment "
                "methods, tourist tax and other charges.</p>"
                "<h2>Cancellation and no-show</h2><p>Your deadlines and rates. "
                "These must match the cancellation terms shown during "
                "booking.</p>"
                "<h2>Arrival and departure</h2><p>Check-in and check-out times, "
                "key handover.</p>"
                "<h2>Guest obligations</h2><p>Occupancy, pets, smoking, "
                "parties, house rules.</p>"
                "<h2>Liability</h2><p>Your liability and the guest's liability "
                "for damage.</p>"
                "<h2>Final provisions</h2><p>Applicable law and place of "
                "jurisdiction.</p>"
            ),
        ),
        rechtsseite(
            slug="widerruf",
            titel="Widerruf",
            titel_en="Right of withdrawal",
            abschnitte_de=(
                "<h2>Kein Widerrufsrecht bei Beherbergung</h2><p>Bei Verträgen "
                "über die Vermietung von Unterkünften zu einem bestimmten "
                "Termin besteht nach § 312 g Abs. 2 Nr. 9 BGB in der Regel "
                "<strong>kein</strong> Widerrufsrecht. Es gelten stattdessen "
                "Ihre Stornobedingungen aus den AGB.</p>"
                "<h2>Wann doch ein Widerrufsrecht gilt</h2><p>Für andere "
                "Leistungen, die Sie über diese Website verkaufen — etwa "
                "Gutscheine oder Zusatzleistungen ohne festen Termin — kann ein "
                "Widerrufsrecht bestehen. Beschreiben Sie diesen Fall hier "
                "samt Widerrufsbelehrung und Muster-Widerrufsformular.</p>"
                "<h2>Stornierung Ihrer Buchung</h2><p>Verweisen Sie auf die "
                "Fristen und Sätze in Ihren AGB und darauf, an wen sich der "
                "Gast wendet.</p>"
            ),
            abschnitte_en=(
                "<h2>No right of withdrawal for accommodation</h2><p>For "
                "contracts covering accommodation on a specific date there is "
                "generally <strong>no</strong> statutory right of withdrawal "
                "(Art. 16(l) of the Consumer Rights Directive). Your "
                "cancellation terms apply instead.</p>"
                "<h2>When a right of withdrawal does apply</h2><p>Other things "
                "you sell through this site — vouchers or extras without a "
                "fixed date — may carry a right of withdrawal. Describe that "
                "case here, including the withdrawal form.</p>"
                "<h2>Cancelling your booking</h2><p>Point to the deadlines and "
                "rates in your terms, and to whom the guest should turn.</p>"
            ),
        ),
        rechtsseite(
            slug="cookie-richtlinie",
            titel="Cookie-Richtlinie",
            titel_en="Cookie policy",
            abschnitte_de=(
                "<h2>Was Cookies sind</h2><p>Kleine Dateien, die Ihr Browser "
                "speichert, damit die Website funktioniert oder gemessen "
                "werden kann.</p>"
                "<h2>Notwendige Cookies</h2><p>Sitzung, Warenkorb, "
                "Sicherheit — sie sind ohne Einwilligung zulässig.</p>"
                "<h2>Statistik und Marketing</h2><p>Reichweitenmessung und "
                "Werbung. Diese setzen wir nur mit Ihrer Einwilligung. Listen "
                "Sie hier auf, welche Dienste Sie einsetzen.</p>"
                "<h2>Einwilligung ändern</h2><p>Wie der Gast seine Auswahl "
                "später widerruft.</p>"
                "<h2>Speicherdauer</h2><p>Wie lange die einzelnen Cookies "
                "gültig sind.</p>"
            ),
            abschnitte_en=(
                "<h2>What cookies are</h2><p>Small files your browser stores so "
                "the website works or can be measured.</p>"
                "<h2>Necessary cookies</h2><p>Session, cart, security — these "
                "are allowed without consent.</p>"
                "<h2>Statistics and marketing</h2><p>Analytics and advertising. "
                "We only set these with your consent. List the services you "
                "use here.</p>"
                "<h2>Changing your consent</h2><p>How a guest can withdraw "
                "their choice later.</p>"
                "<h2>Storage period</h2><p>How long each cookie stays "
                "valid.</p>"
            ),
        ),
    ]
