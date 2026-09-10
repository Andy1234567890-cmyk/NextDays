"""Welche Mappenfelder ein PDF füllen kann — EIN Katalog für alle drei Ziele.

WARUM EIN KATALOG UND KEINE FALLUNTERSCHEIDUNG IM SERVICE: dieselbe Angabe hat
in diesem Projekt ZWEI Heimaten. Das WLAN-Passwort steht als Freitext im
Gästemappen-Block ``messaging.wifi`` UND strukturiert in
``property_guest_portal.wifi_password``; der Türcode ebenso
(``messaging.doorInstructions`` / ``door_code``). Die Vorlagen sprechen mal die
eine, mal die andere an.

Das ist live schon schiefgegangen: am 11.08.2026 gingen sechs Anreise-Mails
NICHT hinaus, weil die Vorlage ``{{wifi_ssid}}``/``{{door_code}}`` benutzte,
gepflegt war aber nur ``{{WifiInformation}}``/``{{DoorInstructions}}``. Ein
Vorschlag, der nur eine Heimat füllt, baut genau diesen Fehler nach — deshalb
trägt jeder Eintrag hier seine Ziele als LISTE, und der Nutzer bestätigt einmal
für beide.

WAS HIER NICHT STEHT: Preise. Ein Betrag aus einem PDF ist der teuerste
Fehlgriff (ein alter Preis sieht aus wie ein richtiger), und Preise haben in
diesem Projekt einen eigenen, geprüften Weg über den Preis-Resolver. Die Mappe
ist für Texte und Zugangsangaben.
"""
from __future__ import annotations

from dataclasses import dataclass

# Die drei Sprachfassungen der Gästemappe. Deckungsgleich mit
# `web/lib/policy-meta.ts:LANGS` — dort sind es dieselben drei, NICHT die 24
# Oberflächensprachen: die Mappe schreibt der Betrieb selbst.
SPRACHEN: tuple[str, ...] = ("de", "en", "da")


@dataclass(frozen=True)
class Ziel:
    """Wohin ein erkannter Wert geschrieben wird.

    `art` ist eines von ``messaging`` (Freitextblock in
    ``properties.type_attributes.messaging``), ``guest_portal`` (Spalte in
    ``property_guest_portal``) oder ``policies``
    (``type_attributes.policies``).
    """

    art: str
    feld: str


@dataclass(frozen=True)
class MappeFeld:
    """Ein Feld, das aus einem PDF gefüllt werden kann."""

    # Der Schlüssel, den das Modell zurückgeben soll.
    key: str
    # Klartext für den Menschen — steht so in der Bestätigungsliste.
    titel: str
    # Was das Modell suchen soll. Geht wörtlich in den Prompt.
    hinweis: str
    # Alle Heimaten dieser Angabe. Mehrere = eine Bestätigung füllt beide.
    ziele: tuple[Ziel, ...]
    # Kurzer Freitext (Türcode, WLAN-Name) oder ein ganzer Block (Hausordnung)?
    # Entscheidet über die Länge, die angenommen wird, und darüber, ob der Wert
    # als HTML-Absatz in den Freitextblock geht.
    kurz: bool = False
    # Trägt das Feld ein Geheimnis? Ein falscher Türcode fällt anders auf als
    # eine falsche Anfahrtsbeschreibung: der Gast steht vor der Tür. Solche
    # Felder sind in der Bestätigungsliste VORAB NICHT angehakt.
    heikel: bool = False


# Reihenfolge = Anzeigereihenfolge in der Bestätigungsliste.
KATALOG: tuple[MappeFeld, ...] = (
    MappeFeld(
        key="wifi_ssid",
        titel="WLAN-Name",
        hinweis="Der Name des WLAN-Netzes (SSID).",
        kurz=True,
        ziele=(Ziel("guest_portal", "wifi_ssid"),),
    ),
    MappeFeld(
        key="wifi_password",
        titel="WLAN-Passwort",
        hinweis="Das WLAN-Passwort, genau wie es dasteht.",
        kurz=True,
        heikel=True,
        ziele=(Ziel("guest_portal", "wifi_password"),),
    ),
    MappeFeld(
        key="wifi",
        titel="WLAN-Hinweise (Text)",
        hinweis=(
            "Der zusammenhängende Text zum WLAN, wie er dem Gast angezeigt "
            "wird."
        ),
        ziele=(Ziel("messaging", "wifi"), Ziel("guest_portal", "wifi_text")),
    ),
    MappeFeld(
        key="door_code",
        titel="Türcode",
        hinweis="Der Zahlencode für Tür oder Schlüsselsafe.",
        kurz=True,
        heikel=True,
        ziele=(Ziel("guest_portal", "door_code"),),
    ),
    MappeFeld(
        key="doorInstructions",
        titel="Türzugang (Text)",
        hinweis="Wie der Gast hineinkommt: Schlüsselsafe, Codeschloss, Übergabe.",
        heikel=True,
        ziele=(
            Ziel("messaging", "doorInstructions"),
            Ziel("guest_portal", "door_instructions"),
        ),
    ),
    MappeFeld(
        key="checkIn",
        titel="Check-in-Anweisungen",
        hinweis="Was der Gast bei der Anreise tun soll.",
        ziele=(
            Ziel("messaging", "checkIn"),
            Ziel("guest_portal", "checkin_instructions"),
        ),
    ),
    MappeFeld(
        key="checkOut",
        titel="Check-out-Anweisungen",
        hinweis="Was der Gast bei der Abreise tun soll.",
        ziele=(
            Ziel("messaging", "checkOut"),
            Ziel("guest_portal", "checkout_instructions"),
        ),
    ),
    MappeFeld(
        key="checkInTime",
        titel="Check-in-Zeit",
        hinweis="Ab wann angereist werden kann, als Uhrzeit (z. B. 16:00).",
        kurz=True,
        ziele=(Ziel("policies", "checkInTime"),),
    ),
    MappeFeld(
        key="checkOutTime",
        titel="Check-out-Zeit",
        hinweis="Bis wann abgereist sein muss, als Uhrzeit (z. B. 10:00).",
        kurz=True,
        ziele=(Ziel("policies", "checkOutTime"),),
    ),
    MappeFeld(
        key="directions",
        titel="Anfahrt",
        hinweis="Anfahrtsbeschreibung, Parken, öffentliche Verkehrsmittel.",
        ziele=(
            Ziel("messaging", "directions"),
            Ziel("guest_portal", "directions"),
        ),
    ),
    MappeFeld(
        key="rules",
        titel="Hausordnung",
        hinweis="Regeln im Haus: Ruhezeiten, Rauchen, Haustiere, Müll.",
        ziele=(Ziel("messaging", "rules"), Ziel("guest_portal", "house_rules")),
    ),
    MappeFeld(
        key="emergency",
        titel="Notfallkontakt",
        hinweis="Wen der Gast im Notfall erreicht, mit Telefonnummer.",
        ziele=(Ziel("messaging", "emergency"),),
    ),
    MappeFeld(
        key="contact_phone",
        titel="Telefon (Ansprechpartner)",
        hinweis="Die Telefonnummer des Ansprechpartners vor Ort.",
        kurz=True,
        ziele=(Ziel("guest_portal", "contact_phone"),),
    ),
    MappeFeld(
        key="maintenance_phone",
        titel="Telefon (Technik/Hausmeister)",
        hinweis="Die Nummer für technische Störungen.",
        kurz=True,
        ziele=(Ziel("guest_portal", "maintenance_phone"),),
    ),
    MappeFeld(
        key="localGuide",
        titel="Reiseführer / Tipps",
        hinweis="Empfehlungen in der Umgebung: Essen, Einkaufen, Ausflüge.",
        ziele=(
            Ziel("messaging", "localGuide"),
            Ziel("guest_portal", "local_guide"),
        ),
    ),
)

NACH_KEY: dict[str, MappeFeld] = {f.key: f for f in KATALOG}

# Längen, die angenommen werden. Wurzel 8: ohne Deckel schriebe ein
# 400-seitiges PDF seinen halben Inhalt in ein Feld.
MAX_KURZ = 200
MAX_LANG = 5_000


def laenge_fuer(key: str) -> int:
    feld = NACH_KEY.get(key)
    if feld is None:
        return MAX_KURZ
    return MAX_KURZ if feld.kurz else MAX_LANG


# Die Hausmappe ist die INTERNE Mappe (Personal, Technik). Sie kennt dieselben
# Felder wie die Gästemappe — der Unterschied liegt darin, WER das PDF sehen
# darf, nicht darin, was drinsteht. Deshalb EIN Katalog und keine zweite Liste,
# die auseinanderläuft.
MAPPEN: tuple[str, ...] = ("gast", "haus")
