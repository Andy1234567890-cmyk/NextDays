"""Werkzeug-Beschreibungen des MCP-Servers — der Text für das MODELL.

Getrennt von `tools.py`, weil hier etwas anderes steht: dort die Fachlogik und
die RECHTE (`_WERKZEUGE`), hier die BESCHREIBUNGEN. Beide ändern sich
unabhängig voneinander — eine neue Formulierung ist keine Rechteänderung.

Die `description` ist für ein Modell geschrieben, nicht für einen Menschen: sie
sagt, wann das Werkzeug das richtige ist und was die Grenzen sind. Jede
Beschreibung eines schreibenden Werkzeugs nennt die Folge ausdrücklich („geht
live an die Portale") — das Modell entscheidet danach, ob es rückfragt.

`title` ist der ANZEIGENAME für den Betrieb. Ohne ihn formt der Client den
technischen `name` um und zeigt „Kalender verfuegbarkeit"; der `name` ist ASCII,
weil er programmatisch adressiert wird.
"""
from __future__ import annotations

from typing import Any

from .grenzen import (
    MAX_AUFGABEN,
    MAX_BEWERTUNGEN,
    MAX_BUCHUNGEN,
    MAX_GAESTE,
    MAX_NACHRICHT_ZEICHEN,
    MAX_TAGE,
    MAX_THREADS,
)

LESE_KATALOG: list[dict[str, Any]] = [
    {
        "name": "raten_liste",
        "title": "Preispläne",
        "annotations": {"title": "Preispläne"},
        "description": (
            "Die Preispläne (Raten) eines Objekts mit Grundpreis, Währung und "
            "Mindestaufenthalt. Liefert die rate_id, die zum Setzen von "
            "Tagespreisen gebraucht wird. Abgeleitete Pläne folgen einem "
            "Basisplan und haben keinen eigenen Preis."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "saisons_liste",
        "title": "Saisons",
        "annotations": {"title": "Saisons"},
        "description": (
            "Die Saisons eines Objekts (Hochsaison, Nebensaison) mit Auf- "
            "oder Abschlag und den bemalten Zeiträumen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "zusatzleistungen_liste",
        "title": "Zusatzleistungen",
        "annotations": {"title": "Zusatzleistungen"},
        "description": (
            "Buchbare Zusatzleistungen eines Objekts (Endreinigung, "
            "Wäschepaket, Haustier) mit Preis, Berechnungsbasis und ob sie "
            "verpflichtend sind."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "rabatte_liste",
        "title": "Rabatte",
        "annotations": {"title": "Rabatte"},
        "description": (
            "Rabattregeln eines Objekts (Frühbucher, Last-Minute, "
            "Langzeit) mit Höhe und Bedingungen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "kartei_lesen",
        "title": "Kartei",
        "annotations": {"title": "Kartei"},
        "description": (
            "Die interne Objektkartei: Ablauf der Aufnahme, Schlüssel und "
            "Zugang, Notfallvollmacht, Vermarktung, Hausbuch, "
            "Dienstleistungsverträge, Handwerker und Portal-Starts. "
            "ENTHÄLT SENSIBLE DATEN (Bankverbindung, Steuer-ID, "
            "Personennummer) und erfordert die Freigabe für Freitexte. Rein "
            "intern — nichts davon geht an die Portale."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "eigentuemer_liste",
        "title": "Eigentümer",
        "annotations": {"title": "Eigentümer"},
        "description": (
            "Alle Eigentümer des Betriebs mit Name, E-Mail, Zahl ihrer "
            "Objekte und ob sie einen Portalzugang haben. Der Einstieg für "
            "jede Frage, die eine eigentuemer_id braucht."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "eigentuemer_detail",
        "title": "Eigentümer im Detail",
        "annotations": {"title": "Eigentümer im Detail"},
        "description": (
            "Alle Angaben zu EINEM Eigentümer: Anschrift, Bankverbindung, "
            "Provision, zugeordnete Objekte, Abrechnungsrhythmus."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"eigentuemer_id": {"type": "string"}},
            "required": ["eigentuemer_id"],
        },
    },
    {
        "name": "kalender_verfuegbarkeit",
        "title": "Kalender-Verfügbarkeit",
        "annotations": {
            "title": "Kalender-Verfügbarkeit",
            "readOnlyHint": True,
        },
        "description": (
            "Belegung und freie Einheiten eines Objekts je Tag. "
            "Liefert die ZAHL freier Einheiten (ein Objekt kann mehrere "
            "identische Einheiten haben), Stop-Sell ist eingerechnet. "
            "Für die Frage 'ist X frei / wie viel ist frei'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {
                    "type": "string",
                    "description": "UUID des Objekts (property).",
                },
                "start": {
                    "type": "string",
                    "description": "ISO-Datum, Standard: heute.",
                },
                "ende": {
                    "type": "string",
                    "description": (
                        "ISO-Datum, exklusiv. Standard: start + 30 Tage. "
                        f"Maximal {MAX_TAGE} Tage Spanne."
                    ),
                },
            },
            "required": ["objekt_id"],
        },
    },
    {
        "name": "buchungen_liste",
        "title": "Buchungen",
        "annotations": {"title": "Buchungen", "readOnlyHint": True},
        "description": (
            "Buchungen des Betriebs, neueste Anreise zuerst. Optional "
            "auf ein Objekt und einen Anreise-Zeitraum eingegrenzt. "
            "Beträge erscheinen nur, wenn die Rolle sie sehen darf."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "anreise_ab": {"type": "string"},
                "anreise_bis": {"type": "string"},
                "limit": {
                    "type": "integer",
                    "description": f"Standard 20, maximal {MAX_BUCHUNGEN}.",
                },
            },
        },
    },
    {
        "name": "buchung_detail",
        "title": "Buchung im Detail",
        "annotations": {"title": "Buchung im Detail", "readOnlyHint": True},
        "description": (
            "Alle Angaben zu EINER Buchung: Gast, Zeitraum, Status, "
            "Objekt, Beträge (rollenabhängig)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"buchung_id": {"type": "string"}},
            "required": ["buchung_id"],
        },
    },
    {
        "name": "posteingang_liste",
        "title": "Posteingang",
        "annotations": {"title": "Posteingang", "readOnlyHint": True},
        "description": (
            "Konversationen ALLER Kanäle in einer Liste — Booking.com, "
            "Airbnb, myBestDays-Marktplatz und übernommene Verläufe. "
            "Der Kanal steht je Thread im Feld 'kanal'. Sortiert nach "
            "letzter Aktivität. Für 'was hat der Gast geschrieben'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "nur_ungelesen": {"type": "boolean"},
                "limit": {
                    "type": "integer",
                    "description": f"Standard 20, maximal {MAX_THREADS}.",
                },
            },
        },
    },
    {
        "name": "posteingang_verlauf",
        "title": "Nachrichtenverlauf",
        "annotations": {"title": "Nachrichtenverlauf", "readOnlyHint": True},
        "description": (
            "Nachrichtenverlauf EINER Konversation, chronologisch. "
            "Die thread_id stammt aus posteingang_liste. Erfordert die "
            "Freigabe für Freitexte in dieser Verbindung."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"thread_id": {"type": "string"}},
            "required": ["thread_id"],
        },
    },
    {
        "name": "buchung_notizen",
        "title": "Buchungsnotizen",
        "annotations": {"title": "Buchungsnotizen", "readOnlyHint": True},
        "description": (
            "Interner Notiz-Verlauf einer Buchung (Autor, Zeit, Text). "
            "Erfordert das Recht, Notizen zu sehen, UND die Freigabe "
            "für Freitexte in dieser Verbindung — sonst gesperrt."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"buchung_id": {"type": "string"}},
            "required": ["buchung_id"],
        },
    },
    {
        "name": "objekte_liste",
        "title": "Objekte",
        "annotations": {"title": "Objekte"},
        "description": (
            "Alle Objekte des Betriebs mit Kennung, Name, Status und "
            "Einheitenzahl. Ein Objekt ist EIN Typ (Zimmertyp oder "
            "Ferienobjekt) mit einer oder mehreren gleichen Einheiten. "
            "Der Einstieg für jede Frage, die eine objekt_id braucht."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "objekt_detail",
        "title": "Objekt im Detail",
        "annotations": {"title": "Objekt im Detail"},
        "description": (
            "Stammdaten EINES Objekts: Adresse, Kapazität, Ausstattung, "
            "Einheiten, Status, Währung."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "preise_lesen",
        "title": "Preise",
        "annotations": {"title": "Preise"},
        "description": (
            "Preisraster eines Objekts je Tag und Rate: Preis, "
            "Mindestaufenthalt, An-/Abreisesperren. Für 'was kostet X "
            "am Datum Y'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "start": {"type": "string",
                          "description": "ISO-Datum, Standard: heute."},
                "ende": {
                    "type": "string",
                    "description": (
                        "ISO-Datum, exklusiv. Standard: start + 30 Tage. "
                        f"Maximal {MAX_TAGE} Tage."
                    ),
                },
            },
            "required": ["objekt_id"],
        },
    },
    {
        "name": "aufgaben_liste",
        "title": "Aufgaben",
        "annotations": {"title": "Aufgaben"},
        "description": (
            "Operative Aufgaben (Reinigung, Wartung, Kontrolle) mit "
            "Status, Fälligkeit, Objekt und zuständiger Person."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "nur_offene": {"type": "boolean"},
                "limit": {
                    "type": "integer",
                    "description": f"Standard 20, maximal {MAX_AUFGABEN}.",
                },
            },
        },
    },
    {
        "name": "gaeste_liste",
        "title": "Gäste",
        "annotations": {"title": "Gäste"},
        "description": (
            "Gäste-Stammdaten des Betriebs. Felder erscheinen nur, "
            "soweit die Rolle sie sehen darf — eingeschränkte Rollen "
            "bekommen maskierte Werte."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "suche": {"type": "string"},
                "limit": {
                    "type": "integer",
                    "description": f"Standard 20, maximal {MAX_GAESTE}.",
                },
            },
        },
    },
    {
        "name": "bewertungen_liste",
        "title": "Bewertungen",
        "annotations": {"title": "Bewertungen"},
        "description": (
            "Bewertungen aller Kanäle mit Note, Text, Kanal und Objekt. "
            "Optional nur die unbeantworteten."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "nur_unbeantwortet": {"type": "boolean"},
                "limit": {
                    "type": "integer",
                    "description": f"Standard 20, maximal {MAX_BEWERTUNGEN}.",
                },
            },
        },
    },
]


# Die SCHREIB-Werkzeuge. Eigene Liste, damit auf einen Blick zu sehen ist,
# was verändert — und damit der Warnhinweis in jeder Beschreibung steht.
SCHREIB_KATALOG: list[dict[str, Any]] = [
    {
        "name": "kalender_sperren",
        "title": "Kalender sperren",
        "annotations": {"title": "Kalender sperren"},
        "description": (
            "Sperrt einen Zeitraum für den Verkauf (Eigennutzung, Wartung). "
            "WIRKT SOFORT AUF ALLEN PORTALEN — die Nächte verschwinden bei "
            "Booking.com, Airbnb und im Marktplatz. Ohne unit_id werden alle "
            "Einheiten des Objekts gesperrt. Bereits gebuchte Nächte bleiben "
            "unberührt. Rückgängig mit kalender_entsperren."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "start": {"type": "string", "description": "ISO-Datum."},
                "ende": {"type": "string",
                         "description": "ISO-Datum, exklusiv."},
                "einheit_id": {
                    "type": "string",
                    "description": (
                        "Optional. Nur DIESE Einheit sperren; sonst alle."
                    ),
                },
            },
            "required": ["objekt_id", "start", "ende"],
        },
    },
    {
        "name": "kalender_entsperren",
        "title": "Sperre aufheben",
        "annotations": {"title": "Sperre aufheben"},
        "description": (
            "Hebt eine Sperre auf und gibt die Nächte wieder zum Verkauf "
            "frei. WIRKT SOFORT AUF ALLEN PORTALEN."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "start": {"type": "string"},
                "ende": {"type": "string"},
                "einheit_id": {"type": "string"},
            },
            "required": ["objekt_id", "start", "ende"],
        },
    },
    {
        "name": "preis_setzen",
        "title": "Preis setzen",
        "annotations": {"title": "Preis setzen"},
        "description": (
            "Setzt den Übernachtungspreis für einen Zeitraum. GEHT LIVE AN "
            "DIE PORTALE — der Gast sieht ihn binnen Minuten. Der Betrag ist "
            "in der Währung des Objekts (siehe objekt_detail); es gibt keine "
            "Umrechnung. Ein Preis von 0 ist unzulässig."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "start": {"type": "string"},
                "ende": {"type": "string", "description": "ISO-Datum, exklusiv."},
                "preis": {
                    "type": "number",
                    "description": "Pro Nacht, in der Währung des Objekts.",
                },
            },
            "required": ["objekt_id", "start", "ende", "preis"],
        },
    },
    {
        "name": "stop_sell_setzen",
        "title": "Verkaufsstopp",
        "annotations": {"title": "Verkaufsstopp"},
        "description": (
            "Stoppt oder erlaubt den Verkauf für einen Zeitraum. Anders als "
            "eine Sperre bleibt die Verfügbarkeit bestehen, nur die "
            "Buchbarkeit ruht. WIRKT AUF ALLEN KANÄLEN — es gibt keinen "
            "kanalweisen Verkaufsstopp."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "start": {"type": "string"},
                "ende": {"type": "string"},
                "aktiv": {
                    "type": "boolean",
                    "description": "true = Verkauf stoppen, false = wieder freigeben.",
                },
                "grund": {"type": "string"},
            },
            "required": ["objekt_id", "start", "ende", "aktiv"],
        },
    },
    {
        "name": "restriktionen_setzen",
        "title": "Aufenthaltsregeln",
        "annotations": {"title": "Aufenthaltsregeln"},
        "description": (
            "Setzt Mindest-/Höchstaufenthalt und An-/Abreisesperren für "
            "einen Zeitraum. GEHT LIVE AN DIE PORTALE. Nur die angegebenen "
            "Felder werden geändert."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "start": {"type": "string"},
                "ende": {"type": "string"},
                "min_aufenthalt": {"type": "integer"},
                "max_aufenthalt": {"type": "integer"},
                "keine_anreise": {"type": "boolean"},
                "keine_abreise": {"type": "boolean"},
            },
            "required": ["objekt_id", "start", "ende"],
        },
    },
    {
        "name": "buchung_stornieren",
        "title": "Buchung stornieren",
        "annotations": {"title": "Buchung stornieren"},
        "description": (
            "Storniert eine Buchung und gibt die Nächte wieder frei. "
            "SCHWERWIEGEND UND NICHT RÜCKGÄNGIG ZU MACHEN. Buchungen, die "
            "über ein Portal kamen, lassen sich hier NICHT stornieren — das "
            "muss beim Portal geschehen, sonst laufen die Stände "
            "auseinander. Ein Grund ist Pflicht."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "buchung_id": {"type": "string"},
                "grund": {"type": "string", "description": "Pflicht."},
            },
            "required": ["buchung_id", "grund"],
        },
    },
    {
        "name": "buchung_verschieben",
        "title": "Buchung verschieben",
        "annotations": {"title": "Buchung verschieben"},
        "description": (
            "Verlegt eine Buchung auf einen anderen Zeitraum oder ein "
            "anderes Objekt. Alte Nächte werden frei, neue belegt — beides "
            "geht an die Portale. Portal-Buchungen und bereits angereiste "
            "Gäste lassen sich nicht verschieben."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "buchung_id": {"type": "string"},
                "anreise": {"type": "string"},
                "abreise": {"type": "string"},
                "objekt_id": {
                    "type": "string",
                    "description": "Optional: Umzug in ein anderes Objekt.",
                },
            },
            "required": ["buchung_id", "anreise", "abreise"],
        },
    },
    {
        "name": "notiz_anlegen",
        "title": "Notiz anlegen",
        "annotations": {"title": "Notiz anlegen"},
        "description": (
            "Legt eine interne Notiz an einer Buchung an. Nur für das Team "
            "sichtbar, der Gast sieht sie nie. Erfordert die Freigabe für "
            "Freitexte."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "buchung_id": {"type": "string"},
                "text": {"type": "string"},
                "kategorie": {"type": "string"},
            },
            "required": ["buchung_id", "text"],
        },
    },
    {
        "name": "nachricht_senden",
        "title": "Nachricht senden",
        "annotations": {"title": "Nachricht senden"},
        "description": (
            "Sendet eine Nachricht an den Gast über den Kanal der Buchung "
            "(Booking.com, Airbnb, Marktplatz). GEHT SOFORT RAUS UND IST "
            "NICHT ZURÜCKZUHOLEN. Die thread_id stammt aus "
            "posteingang_liste. Erfordert die Freigabe für Freitexte."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "thread_id": {"type": "string"},
                "text": {
                    "type": "string",
                    "description": f"Maximal {MAX_NACHRICHT_ZEICHEN} Zeichen.",
                },
            },
            "required": ["thread_id", "text"],
        },
    },
    {
        "name": "aufgabe_anlegen",
        "title": "Aufgabe anlegen",
        "annotations": {"title": "Aufgabe anlegen"},
        "description": (
            "Legt eine operative Aufgabe an (Reinigung, Wartung, Kontrolle) "
            "und benachrichtigt die zuständige Person. Wirkt nur intern, "
            "nicht auf den Portalen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "titel": {"type": "string"},
                "faellig_am": {"type": "string", "description": "ISO-Datum."},
                "beschreibung": {"type": "string"},
                "zustaendig_user_id": {"type": "string"},
            },
            "required": ["objekt_id", "titel"],
        },
    },
    {
        "name": "aufgabe_abschliessen",
        "title": "Aufgabe abschließen",
        "annotations": {"title": "Aufgabe abschließen"},
        "description": (
            "Markiert eine Aufgabe als erledigt. Aufgaben mit Fotopflicht "
            "lassen sich so nicht abschließen — dafür braucht es die App."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"aufgabe_id": {"type": "string"}},
            "required": ["aufgabe_id"],
        },
    },
    # -- Objektverwaltung ----------------------------------------------------
    {
        "name": "objekt_anlegen",
        "title": "Objekt anlegen",
        "annotations": {"title": "Objekt anlegen"},
        "description": (
            "Legt ein neues Objekt als ENTWURF an. Ein Objekt ist EIN Typ — "
            "ein Zimmertyp (Hotel) oder ein Ferienobjekt — mit einer oder "
            "mehreren gleichen Einheiten. Pflicht ist nur der Name; alles "
            "andere kann später ergänzt werden. Die Währung wird bewusst NICHT "
            "geraten: fehlt sie, muss sie gesetzt werden, bevor Preise "
            "möglich sind. Das Objekt ist erst nach "
            "'objekt_veroeffentlichen' auf den Portalen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Name des Objekts."},
                "description": {"type": "string"},
                "property_type": {
                    "type": "string",
                    "description": "z. B. ferienhaus, ferienwohnung, hotelzimmer.",
                },
                "max_guests": {"type": "integer", "description": "1 bis 99."},
                "currency": {
                    "type": "string",
                    "description": (
                        "ISO-Code, z. B. DKK oder EUR. Nur setzen, wenn "
                        "bekannt — kein Standardwert."
                    ),
                },
                "address": {"type": "string"},
                "city": {"type": "string"},
                "country": {"type": "string", "description": "ISO-2, z. B. DK."},
                "bedrooms": {"type": "integer"},
                "bathrooms": {"type": "integer"},
            },
            "required": ["title"],
        },
    },
    {
        "name": "objekt_aendern",
        "title": "Objekt ändern",
        "annotations": {"title": "Objekt ändern"},
        "description": (
            "Ändert Stammdaten eines Objekts. Nur die angegebenen Felder "
            "werden geändert. ACHTUNG: Beschreibung, Ausstattung, Kapazität "
            "und Bilder GEHEN AN DIE PORTALE — der Text steht danach bei "
            "Booking.com und Airbnb. Hier wird auch das Vertragsende gesetzt "
            "(contract_end_date): danach sperrt das System die Nächte "
            "automatisch und meldet das den Portalen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "status": {
                    "type": "string",
                    "description": "draft, active oder inactive.",
                },
                "max_guests": {"type": "integer"},
                "currency": {"type": "string"},
                "address": {"type": "string"},
                "city": {"type": "string"},
                "postal_code": {"type": "string"},
                "country": {"type": "string"},
                "bedrooms": {"type": "integer"},
                "bathrooms": {"type": "integer"},
                "listed_on_marketplace": {
                    "type": "boolean",
                    "description": "Sichtbarkeit auf dem myBestDays-Marktplatz.",
                },
                "listed_on_website": {"type": "boolean"},
                "contract_end_date": {
                    "type": "string",
                    "description": (
                        "ISO-Datum. Ab da wird nicht mehr verkauft. Leeren "
                        "hebt die Sperre wieder auf."
                    ),
                },
                "abschnitt": {
                    "type": "string",
                    "description": (
                        "Für die Reiter der Objektseite: location (Standort), "
                        "contact (Kontakt), compliance, policies "
                        "(Richtlinien), messaging (Nachrichten-Platzhalter), "
                        "pricing, availability, occupancy, beds. Zusammen mit "
                        "abschnitt_daten angeben. Die übrigen Abschnitte "
                        "bleiben unberührt."
                    ),
                },
                "abschnitt_daten": {
                    "type": "object",
                    "description": (
                        "Die Angaben dieses Abschnitts. Nur die genannten "
                        "Felder werden geändert, der Rest des Abschnitts "
                        "bleibt stehen."
                    ),
                },
            },
            "required": ["objekt_id"],
        },
    },
    {
        "name": "objekt_loeschen",
        "title": "Objekt löschen",
        "annotations": {"title": "Objekt löschen"},
        "description": (
            "Löscht ein Objekt endgültig. SCHWERWIEGEND UND NICHT RÜCKGÄNGIG "
            "ZU MACHEN. Die Portal-Verbindungen werden dabei abgebaut. Ein "
            "Objekt mit Buchungen lässt sich nicht löschen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "objekt_veroeffentlichen",
        "title": "Objekt veröffentlichen",
        "annotations": {"title": "Objekt veröffentlichen"},
        "description": (
            "Stellt ein Objekt auf die Portale und den Marktplatz: Stammdaten, "
            "Zimmertyp, Preisplan und die Verfügbarkeit der nächsten ~500 "
            "Tage gehen an Channex. Verlangt mindestens einen Preisplan und "
            "eine abgeschlossene Zahlungseinrichtung."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "objekt_duplizieren",
        "title": "Objekt duplizieren",
        "annotations": {"title": "Objekt duplizieren"},
        "description": (
            "Legt eine Kopie eines Objekts als Entwurf an — für mehrere "
            "ähnliche Objekte. Die Kopie ist NICHT veröffentlicht."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "objekt_einheiten_setzen",
        "title": "Einheitenzahl setzen",
        "annotations": {"title": "Einheitenzahl setzen"},
        "description": (
            "Setzt, wie viele gleichartige Einheiten dieses Objekt hat (z. B. "
            "fünf identische Studios unter einem Typ). Die Zahl IST die "
            "Verfügbarkeit, die an die Portale gemeldet wird. Verkleinern "
            "schlägt fehl, solange wegfallende Einheiten belegt sind."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "anzahl": {"type": "integer", "description": "1 bis 200."},
            },
            "required": ["objekt_id", "anzahl"],
        },
    },
    {
        "name": "objekt_inhalte_neu_senden",
        "title": "Inhalte neu senden",
        "annotations": {"title": "Inhalte neu senden"},
        "description": (
            "Sendet Stammdaten und Bilder eines Objekts erneut an die "
            "Portale. Für den Fall, dass dort etwas veraltet ist."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"objekt_id": {"type": "string"}},
            "required": ["objekt_id"],
        },
    },
    {
        "name": "objekt_fotos_ordnen",
        "title": "Fotos sortieren",
        "annotations": {"title": "Fotos sortieren"},
        "description": (
            "Setzt die Reihenfolge der Fotos. Die Liste muss GENAU alle "
            "vorhandenen Foto-IDs enthalten — keine fehlenden, keine "
            "fremden. Die IDs stammen aus objekt_detail. Geht an die Portale."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "foto_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Alle Foto-IDs in der Wunschreihenfolge.",
                },
            },
            "required": ["objekt_id", "foto_ids"],
        },
    },
    {
        "name": "objekt_foto_aendern",
        "title": "Foto ändern",
        "annotations": {"title": "Foto ändern"},
        "description": (
            "Setzt Bildtext oder macht ein Foto zum Titelbild. Das bisherige "
            "Titelbild verliert die Markierung. Geht an die Portale."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "foto_id": {"type": "string"},
                "bildtext": {"type": "string"},
                "ist_titelbild": {"type": "boolean"},
            },
            "required": ["objekt_id", "foto_id"],
        },
    },
    {
        "name": "objekt_foto_loeschen",
        "title": "Foto löschen",
        "annotations": {"title": "Foto löschen"},
        "description": (
            "Löscht ein Foto endgültig, auch bei den Portalen. Neue Fotos "
            "HOCHLADEN geht hier nicht — dafür braucht es die Oberfläche."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "foto_id": {"type": "string"},
            },
            "required": ["objekt_id", "foto_id"],
        },
    },
    {
        "name": "objekt_zimmer_anlegen",
        "title": "Zimmer anlegen",
        "annotations": {"title": "Zimmer anlegen"},
        "description": (
            "Fügt dem Objekt einen Raum hinzu (Schlafzimmer, Bad, Küche). "
            "Beschreibt die INNERE Aufteilung eines Ferienobjekts — nicht zu "
            "verwechseln mit Hotelzimmern, die eigene Objekte sind. Geht an "
            "Airbnb und die übrigen Portale."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "raum_typ": {
                    "type": "string",
                    "description": "z. B. schlafzimmer, badezimmer, kueche.",
                },
                "privat": {
                    "type": "boolean",
                    "description": "Nur für die Gäste dieses Objekts (Standard: ja).",
                },
            },
            "required": ["objekt_id", "raum_typ"],
        },
    },
    {
        "name": "objekt_zimmer_aendern",
        "title": "Zimmer ändern",
        "annotations": {"title": "Zimmer ändern"},
        "description": "Ändert Art oder Privatheit eines Raums. Geht an die Portale.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "zimmer_id": {"type": "string"},
                "raum_typ": {"type": "string"},
                "privat": {"type": "boolean"},
            },
            "required": ["objekt_id", "zimmer_id"],
        },
    },
    {
        "name": "objekt_zimmer_loeschen",
        "title": "Zimmer löschen",
        "annotations": {"title": "Zimmer löschen"},
        "description": "Entfernt einen Raum aus dem Objekt. Geht an die Portale.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "zimmer_id": {"type": "string"},
            },
            "required": ["objekt_id", "zimmer_id"],
        },
    },
    # -- Eigentümerverwaltung -------------------------------------------------
    {
        "name": "eigentuemer_anlegen",
        "title": "Eigentümer anlegen",
        "annotations": {"title": "Eigentümer anlegen"},
        "description": (
            "Legt einen Eigentümer an. Pflicht ist nur der Name. Mit "
            "portalzugang=true bekommt er zusätzlich einen LOGIN fürs "
            "Eigentümerportal — das verlangt das Recht, Benutzer zu "
            "verwalten, und setzt eine E-Mail voraus."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "email": {"type": "string"},
                "phone": {"type": "string"},
                "address": {"type": "string"},
                "city": {"type": "string"},
                "country": {"type": "string"},
                "language": {
                    "type": "string",
                    "description": "Sprache des Portals, z. B. da oder de.",
                },
                "default_commission_pct": {
                    "type": "number",
                    "description": "Provision in Prozent (0 bis 100).",
                },
                "portalzugang": {
                    "type": "boolean",
                    "description": "Login fürs Eigentümerportal anlegen.",
                },
                "property_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Objekte, die ihm sofort gehören sollen.",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "eigentuemer_aendern",
        "title": "Eigentümer ändern",
        "annotations": {"title": "Eigentümer ändern"},
        "description": (
            "Ändert die Stammdaten eines Eigentümers. Nur angegebene Felder. "
            "Die E-Mail zu ändern ist ein Eingriff in den Login und verlangt "
            "zusätzlich das Recht, Benutzer zu verwalten."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "eigentuemer_id": {"type": "string"},
                "name": {"type": "string"},
                "email": {"type": "string"},
                "phone": {"type": "string"},
                "address": {"type": "string"},
                "city": {"type": "string"},
                "country": {"type": "string"},
                "language": {"type": "string"},
                "default_commission_pct": {"type": "number"},
            },
            "required": ["eigentuemer_id"],
        },
    },
    {
        "name": "eigentuemer_loeschen",
        "title": "Eigentümer löschen",
        "annotations": {"title": "Eigentümer löschen"},
        "description": (
            "Löscht einen Eigentümer samt Portalzugang und den Zugängen "
            "seiner Familienmitglieder. NICHT RÜCKGÄNGIG. Hat er "
            "Eigennutzungen im Kalender, schlägt der Aufruf fehl und nennt "
            "die Anzahl — mit_eigennutzungen=true storniert sie und gibt die "
            "Nächte an die Portale frei."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "eigentuemer_id": {"type": "string"},
                "mit_eigennutzungen": {
                    "type": "boolean",
                    "description": "Eigennutzungen stornieren und mitlöschen.",
                },
            },
            "required": ["eigentuemer_id"],
        },
    },
    {
        "name": "eigentuemer_objekt_zuordnen",
        "title": "Objekt zuordnen",
        "annotations": {"title": "Objekt zuordnen"},
        "description": (
            "Ordnet ein Objekt einem Eigentümer zu. Ein Objekt hat GENAU "
            "EINEN Eigentümer — gehört es bereits jemand anderem, schlägt der "
            "Aufruf fehl und nennt dessen Namen. Erst entziehen, dann neu "
            "zuordnen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "eigentuemer_id": {"type": "string"},
                "objekt_id": {"type": "string"},
                "anteil_prozent": {
                    "type": "number",
                    "description": "Eigentumsanteil, Standard 100.",
                },
                "provision_prozent": {
                    "type": "number",
                    "description": "Abweichende Provision nur für dieses Objekt.",
                },
            },
            "required": ["eigentuemer_id", "objekt_id"],
        },
    },
    {
        "name": "eigentuemer_objekt_entziehen",
        "title": "Objekt entziehen",
        "annotations": {"title": "Objekt entziehen"},
        "description": (
            "Nimmt einem Eigentümer ein Objekt weg. Seine Portalsicht darauf "
            "und die seiner Familienmitglieder werden mit entfernt."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "eigentuemer_id": {"type": "string"},
                "objekt_id": {"type": "string"},
            },
            "required": ["eigentuemer_id", "objekt_id"],
        },
    },
    {
        "name": "eigentuemer_portalzugang_einladen",
        "title": "Portalzugang einladen",
        "annotations": {"title": "Portalzugang einladen"},
        "description": (
            "Legt für einen bestehenden Eigentümer einen Login fürs "
            "Eigentümerportal an und schickt ihm die Einladung per E-Mail. "
            "Setzt eine hinterlegte E-Mail voraus."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"eigentuemer_id": {"type": "string"}},
            "required": ["eigentuemer_id"],
        },
    },
    # -- Preise, Saisons, Zusatzleistungen, Kartei ---------------------------
    {
        "name": "grundpreis_setzen",
        "title": "Grundpreis setzen",
        "annotations": {"title": "Grundpreis setzen"},
        "description": (
            "Setzt den Grundpreis eines Objekts — die Basis, von der Saisons "
            "und Rabatte rechnen. GEHT AN DIE PORTALE. Die Währung wird dem "
            "Objekt entnommen; fehlt sie dort, schlägt der Aufruf fehl statt "
            "zu raten. Hat das Objekt mehrere Preispläne, ist der Grundpreis "
            "nicht eindeutig — dann je Plan über tagespreise_setzen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "preis": {"type": "number", "description": "Pro Nacht."},
                "waehrung": {
                    "type": "string",
                    "description": "Nur nötig, wenn das Objekt noch keine hat.",
                },
            },
            "required": ["objekt_id", "preis"],
        },
    },
    {
        "name": "tagespreise_setzen",
        "title": "Tagespreise setzen",
        "annotations": {"title": "Tagespreise setzen"},
        "description": (
            "Setzt den Preis eines Preisplans für einen Zeitraum. GEHT AN DIE "
            "PORTALE. Die rate_id stammt aus raten_liste. Bei abgeleiteten "
            "Plänen nicht möglich — deren Preis folgt dem Basisplan."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "rate_id": {"type": "string"},
                "start": {"type": "string"},
                "ende": {"type": "string", "description": "ISO-Datum, exklusiv."},
                "preis": {"type": "number"},
            },
            "required": ["rate_id", "start", "ende", "preis"],
        },
    },
    {
        "name": "mindestaufenthalt_setzen",
        "title": "Mindestaufenthalt setzen",
        "annotations": {"title": "Mindestaufenthalt setzen"},
        "description": (
            "Setzt den Mindestaufenthalt eines Preisplans für einen Zeitraum. "
            "GEHT AN DIE PORTALE. Die häufigste kurzfristige Stellschraube, "
            "etwa drei Nächte über ein langes Wochenende."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "rate_id": {"type": "string"},
                "start": {"type": "string"},
                "ende": {"type": "string"},
                "naechte": {"type": "integer", "description": "Mindestnächte."},
            },
            "required": ["rate_id", "start", "ende", "naechte"],
        },
    },
    {
        "name": "saison_anlegen",
        "title": "Saison anlegen",
        "annotations": {"title": "Saison anlegen"},
        "description": (
            "Legt eine Saison an (Hochsaison, Nebensaison). modus 'percent' "
            "rechnet prozentual auf den Grundpreis, 'fixed' setzt einen festen "
            "Nachtpreis. Die Saison wirkt erst, wenn sie mit saison_zuordnen "
            "auf einen Zeitraum gelegt wird."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "name": {"type": "string"},
                "modus": {
                    "type": "string",
                    "description": "percent (Aufschlag in %) oder fixed (Festpreis).",
                },
                "betrag": {
                    "type": "number",
                    "description": "Bei percent z. B. 25 für +25 %, bei fixed der Nachtpreis.",
                },
                "farbe": {
                    "type": "string",
                    "description": "Hex-Farbe im Kalender, z. B. #ef4444.",
                },
            },
            "required": ["objekt_id", "name", "modus", "betrag"],
        },
    },
    {
        "name": "saison_aendern",
        "title": "Saison ändern",
        "annotations": {"title": "Saison ändern"},
        "description": (
            "Ändert Name, Farbe, Modus oder Betrag einer Saison. Die "
            "zugeordneten Zeiträume bleiben; die Preise werden neu gerechnet "
            "und GEHEN AN DIE PORTALE."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "saison_id": {"type": "string"},
                "name": {"type": "string"},
                "modus": {"type": "string"},
                "betrag": {"type": "number"},
                "farbe": {"type": "string"},
            },
            "required": ["saison_id"],
        },
    },
    {
        "name": "saison_loeschen",
        "title": "Saison löschen",
        "annotations": {"title": "Saison löschen"},
        "description": (
            "Löscht eine Saison. Die betroffenen Tage fallen auf den "
            "Grundpreis zurück — das GEHT AN DIE PORTALE."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"saison_id": {"type": "string"}},
            "required": ["saison_id"],
        },
    },
    {
        "name": "saison_zuordnen",
        "title": "Saison auf Zeitraum legen",
        "annotations": {"title": "Saison auf Zeitraum legen"},
        "description": (
            "Legt eine Saison auf einen Zeitraum — erst dadurch wirkt sie auf "
            "den Preis. GEHT AN DIE PORTALE. Überlappende Zuordnungen sind "
            "erlaubt; die zuletzt gelegte gewinnt."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "saison_id": {"type": "string"},
                "start": {"type": "string"},
                "ende": {"type": "string", "description": "ISO-Datum, exklusiv."},
            },
            "required": ["objekt_id", "saison_id", "start", "ende"],
        },
    },
    {
        "name": "saison_zeitraum_leeren",
        "title": "Saison-Zeitraum leeren",
        "annotations": {"title": "Saison-Zeitraum leeren"},
        "description": (
            "Nimmt alle Saison-Zuordnungen in einem Zeitraum weg; die Tage "
            "fallen auf den Grundpreis zurück. GEHT AN DIE PORTALE."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "start": {"type": "string"},
                "ende": {"type": "string"},
            },
            "required": ["objekt_id", "start", "ende"],
        },
    },
    {
        "name": "zusatzleistung_anlegen",
        "title": "Zusatzleistung anlegen",
        "annotations": {"title": "Zusatzleistung anlegen"},
        "description": (
            "Legt eine buchbare Zusatzleistung an (Endreinigung, "
            "Wäschepaket, Haustier). basis bestimmt die Berechnung: per_stay "
            "(je Aufenthalt), per_night, per_guest oder per_unit. Wirkt in "
            "der Buchungsstrecke, nicht auf den Portalen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "name": {"type": "string"},
                "beschreibung": {"type": "string"},
                "preis": {"type": "number"},
                "basis": {
                    "type": "string",
                    "description": "per_stay, per_night, per_guest oder per_unit.",
                },
                "pflicht": {
                    "type": "boolean",
                    "description": "Verpflichtend statt wählbar.",
                },
                "steuersatz": {"type": "number", "description": "In Prozent."},
            },
            "required": ["objekt_id", "name"],
        },
    },
    {
        "name": "zusatzleistung_aendern",
        "title": "Zusatzleistung ändern",
        "annotations": {"title": "Zusatzleistung ändern"},
        "description": "Ändert eine Zusatzleistung. Nur angegebene Felder.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "zusatzleistung_id": {"type": "string"},
                "name": {"type": "string"},
                "beschreibung": {"type": "string"},
                "preis": {"type": "number"},
                "basis": {"type": "string"},
                "pflicht": {"type": "boolean"},
                "steuersatz": {"type": "number"},
                "aktiv": {"type": "boolean"},
            },
            "required": ["zusatzleistung_id"],
        },
    },
    {
        "name": "zusatzleistung_loeschen",
        "title": "Zusatzleistung löschen",
        "annotations": {"title": "Zusatzleistung löschen"},
        "description": (
            "Löscht eine Zusatzleistung aus dem Katalog. Bereits gebuchte "
            "Leistungen an bestehenden Buchungen bleiben davon unberührt."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"zusatzleistung_id": {"type": "string"}},
            "required": ["zusatzleistung_id"],
        },
    },
    {
        "name": "zusatzleistung_buchen",
        "title": "Zusatzleistung zur Buchung",
        "annotations": {"title": "Zusatzleistung zur Buchung"},
        "description": (
            "Fügt einer bestehenden Buchung eine Zusatzleistung hinzu. "
            "Kostenpflichtige Posten erscheinen auf der Rechnung des Gastes — "
            "das ist eine Geldwirkung, keine Notiz."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "buchung_id": {"type": "string"},
                "zusatzleistung_id": {"type": "string"},
                "menge": {"type": "integer", "description": "Standard 1."},
            },
            "required": ["buchung_id", "zusatzleistung_id"],
        },
    },
    {
        "name": "kartei_schreiben",
        "title": "Kartei pflegen",
        "annotations": {"title": "Kartei pflegen"},
        "description": (
            "Schreibt einen Abschnitt der internen Objektkartei: process "
            "(Ablauf der Aufnahme), access (Schlüssel und Zugang), "
            "emergency_authority (Notfallvollmacht), marketing (Fotograf, "
            "Begehung), housebook (Hausbuch). Nur die angegebenen Felder "
            "werden geändert, der Rest des Abschnitts bleibt stehen. Rein "
            "intern — nichts geht an die Portale. Erfordert die Freigabe für "
            "Freitexte."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "abschnitt": {
                    "type": "string",
                    "description": (
                        "process, access, emergency_authority, marketing "
                        "oder housebook."
                    ),
                },
                "daten": {
                    "type": "object",
                    "description": "Die Felder dieses Abschnitts.",
                },
            },
            "required": ["objekt_id", "abschnitt", "daten"],
        },
    },
    {
        "name": "kartei_handwerker_anlegen",
        "title": "Handwerker eintragen",
        "annotations": {"title": "Handwerker eintragen"},
        "description": (
            "Trägt einen Handwerker in die Objektkartei ein (Gewerk, Name, "
            "Telefon). Für den Fall, dass am Objekt etwas kaputtgeht."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "trade": {
                    "type": "string",
                    "description": "Gewerk, z. B. Elektriker oder Klempner.",
                },
                "name": {"type": "string"},
                "phone": {"type": "string"},
                "notes": {"type": "string"},
            },
            "required": ["objekt_id", "trade"],
        },
    },
    {
        "name": "kartei_handwerker_loeschen",
        "title": "Handwerker entfernen",
        "annotations": {"title": "Handwerker entfernen"},
        "description": "Entfernt einen Handwerker aus der Objektkartei.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "objekt_id": {"type": "string"},
                "eintrag_id": {"type": "string"},
            },
            "required": ["objekt_id", "eintrag_id"],
        },
    },
]
