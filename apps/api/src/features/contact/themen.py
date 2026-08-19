"""Wer bekommt welche Anfrage — die EINE Zuordnungstabelle.

Zwei Postfächer, zwei Zuständigkeiten:
  · **info@** — alles Kaufmännische und Redaktionelle: allgemeine Fragen,
    Vertrieb, Rechnungen, Presse, Partnerschaften, Datenschutzauskünfte. Die
    Datenschutzauskunft gehört hierher, weil `info@` die im Impressum und in der
    Datenschutzerklärung veröffentlichte Adresse ist — eine Auskunftsanfrage an
    ein anderes Postfach zu leiten, würde der eigenen Erklärung widersprechen.
  · **developer@** — alles Technische: Störungen, API/Entwickler,
    Sicherheitsmeldungen.

Die Tabelle steht bewusst SERVERSEITIG und getrennt von den Adressen selbst: die
Adressen kommen aus der Konfiguration (`CONTACT_RECIPIENT_GENERAL` /
`CONTACT_RECIPIENT_TECHNICAL`), die Zuordnung aus dem Code. Ein Postfachwechsel
ist damit eine Umgebungsvariable, kein Deploy.
"""
from __future__ import annotations

from enum import Enum

from src.core.config import Settings

from .schemas import KontaktThema


class Empfaengerart(Enum):
    """Welches der beiden Postfächer zuständig ist."""

    ALLGEMEIN = "allgemein"
    TECHNIK = "technik"


# Jedes Thema aus `KontaktThema` MUSS hier stehen. Kein `.get(..., DEFAULT)` beim
# Lesen: ein neues Thema ohne Eintrag soll auffallen (Wurzel 4), nicht still im
# allgemeinen Postfach landen.
EMPFAENGERART: dict[KontaktThema, Empfaengerart] = {
    KontaktThema.ALLGEMEIN: Empfaengerart.ALLGEMEIN,
    KontaktThema.VERTRIEB: Empfaengerart.ALLGEMEIN,
    KontaktThema.ABRECHNUNG: Empfaengerart.ALLGEMEIN,
    KontaktThema.PRESSE: Empfaengerart.ALLGEMEIN,
    KontaktThema.PARTNER: Empfaengerart.ALLGEMEIN,
    KontaktThema.DATENSCHUTZ: Empfaengerart.ALLGEMEIN,
    KontaktThema.TECHNIK: Empfaengerart.TECHNIK,
    KontaktThema.API: Empfaengerart.TECHNIK,
    KontaktThema.SICHERHEIT: Empfaengerart.TECHNIK,
}

# Klartext für die Betreffzeile der internen Mail. Deutsch, weil diese Mail in
# UNSEREM Postfach landet — sie ist keine Nachricht an den Besucher und läuft
# deshalb nicht über den 24-Sprachen-Katalog (`core.mail_texte`).
BEZEICHNUNG: dict[KontaktThema, str] = {
    KontaktThema.ALLGEMEIN: "Allgemeine Anfrage",
    KontaktThema.VERTRIEB: "Vertrieb / Angebot",
    KontaktThema.ABRECHNUNG: "Rechnung & Abo",
    KontaktThema.PRESSE: "Presse & Medien",
    KontaktThema.PARTNER: "Partnerschaft",
    KontaktThema.DATENSCHUTZ: "Datenschutz",
    KontaktThema.TECHNIK: "Technische Frage / Störung",
    KontaktThema.API: "API & Entwickler",
    KontaktThema.SICHERHEIT: "Sicherheitsmeldung",
}


class EmpfaengerFehlt(Exception):
    """Das zuständige Postfach ist nicht konfiguriert.

    Eigener Typ, weil der Router daraus eine 503 macht: das ist ein
    Betriebsfehler bei uns, nicht ein Fehler des Absenders.
    """


def empfaenger_fuer(thema: KontaktThema, settings: Settings) -> str:
    """Die Zieladresse für ein Thema. Wirft, wenn sie nicht konfiguriert ist.

    Kein Rückfall auf das jeweils andere Postfach und kein erfundener Default:
    eine Sicherheitsmeldung, die wegen eines fehlenden Eintrags im allgemeinen
    Posteingang landet, ist schlimmer als eine, die klar abgewiesen wird
    (Wurzel 4).
    """
    art = EMPFAENGERART[thema]
    if art is Empfaengerart.TECHNIK:
        adresse = settings.contact_recipient_technical.strip()
        variable = "CONTACT_RECIPIENT_TECHNICAL"
    else:
        adresse = settings.contact_recipient_general.strip()
        variable = "CONTACT_RECIPIENT_GENERAL"
    if not adresse:
        raise EmpfaengerFehlt(
            f"Kontaktformular ist nicht vollständig konfiguriert ({variable} fehlt)."
        )
    return adresse
