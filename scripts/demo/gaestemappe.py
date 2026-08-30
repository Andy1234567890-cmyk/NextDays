"""Gästemappe und Richtlinien der Demo-Objekte (`properties.type_attributes`).

WARUM ES DAS BRAUCHT: die KI-Antwort speist sich NICHT aus einer
Wissensdatenbank, sondern liest bei jeder Frage frisch aus
`properties.type_attributes` (`inbox/ki_kontext.py`). Der Seed liess das Feld
leer — die KI antwortete deshalb in allen Demo-Konten ausweichend
("Wir reichen die Informationen zur Anreisezeit schnellstmöglich nach",
30.08.2026) und meldete "Der KI fehlt eine Angabe: Check-in Zeit".

Die Struktur ist von `ki_kontext.py` vorgegeben, nicht frei gewählt:

* `messaging.<abschnitt>` — die acht Abschnitte aus `_MESSAGING_ABSCHNITTE`
  (checkIn, checkOut, wifi, directions, doorInstructions, rules, localGuide,
  emergency). Fliesstext; die KI wählt sie stichwortabhängig aus.
* `policies.<feld>`      — die kurzen Werte aus `_POLICY_FELDER` (Check-in-Zeit,
  Storno, Kaution, Haustiere …). Sie kommen IMMER vollständig mit.
* `schlafzimmer`/`betten`/`badezimmer` — die harten Zahlen, die `_objekt_block`
  direkt von der obersten Ebene liest.

Ein Abschnitt, den es hier nicht gibt, existiert für die KI nicht. Deshalb
tragen alle Objekte alle acht — ein Demo-Betrieb, bei dem die Hälfte der Fragen
ins Leere läuft, führt die Funktion schlechter vor als gar keine Demo.

ZUGANGSDATEN (wifi, doorInstructions) stehen hier bewusst mit drin: der Sammler
gibt sie nur bei BESTÄTIGTER Buchung heraus (`_STATUS_MIT_ZUGANG`), die Sperre
sitzt dort und nicht in den Daten. Es sind erfundene Codes für erfundene
Häuser — sie öffnen nichts.
"""
from __future__ import annotations

from typing import Any

from katalog import Betrieb, Objekt

# Zeiten je Betriebsart. Ein Hotel hat eine Rezeption und andere Zeiten als ein
# Ferienhaus mit Schlüsselsafe — dieselben Werte für beide wären der erste
# Widerspruch, den ein Betrachter im Screenshot findet.
_ZEITEN = {
    "hotel": {"an": "15:00", "an_bis": "23:00", "ab": "11:00"},
    "vacation_rental": {"an": "16:00", "an_bis": "20:00", "ab": "10:00"},
}


def _wlan(objekt: Objekt) -> tuple[str, str]:
    """Netzname und Passwort — je Objekt eigen, nicht einmal für alle."""
    netz = "".join(w.capitalize() for w in objekt.schluessel.split("_"))[:16]
    return f"{netz}-Gast", f"Ferien{abs(hash(objekt.schluessel)) % 9000 + 1000}!"


def _messaging(betrieb: Betrieb, objekt: Objekt) -> dict[str, str]:
    """Die acht Abschnitte der Gästemappe für EIN Objekt."""
    z = _ZEITEN[betrieb.accommodation_type]
    netz, passwort = _wlan(objekt)
    hotel = betrieb.accommodation_type == "hotel"
    f = betrieb.firma

    if hotel:
        anreise = (
            f"Der Check-in ist ab {z['an']} Uhr möglich, unsere Rezeption ist "
            f"rund um die Uhr besetzt. Bei Ankunft vor {z['an']} Uhr lagern wir "
            "das Gepäck gern ein, bis das Zimmer fertig ist. Bitte halten Sie "
            "einen Lichtbildausweis bereit — die Meldepflicht verlangt ihn."
        )
        tuer = (
            "Die Zimmerkarte erhalten Sie an der Rezeption. Sie öffnet Ihr "
            "Zimmer, den Aufzug und die Haustür, die ab 22:00 Uhr verschlossen "
            "ist. Bei Verlust melden Sie sich bitte sofort an der Rezeption."
        )
    else:
        anreise = (
            f"Der Check-in ist ab {z['an']} Uhr möglich, die Schlüsselübergabe "
            f"läuft über einen Schlüsselsafe direkt am Haus — Sie sind also "
            f"nicht an eine Uhrzeit gebunden und können auch spät anreisen. "
            f"Den Code senden wir Ihnen am Anreisetag per Nachricht. Eine "
            f"frühere Anreise ab 13:00 Uhr ist möglich, wenn die Reinigung "
            f"durch ist; fragen Sie am Vortag kurz nach."
        )
        tuer = (
            "Der Schlüsselsafe hängt rechts neben der Haustür. Sie öffnen ihn "
            "mit dem vierstelligen Code aus unserer Nachricht: Klappe nach "
            "unten schieben, Code eingeben, Knopf drücken. Im Safe liegen zwei "
            "Haustürschlüssel. Beim Abreisen legen Sie beide wieder hinein und "
            "verdrehen die Zahlen."
        )

    abreise = (
        f"Check-out ist bis {z['ab']} Uhr. "
        + ("Die Zimmerkarte geben Sie bitte an der Rezeption ab. "
           if hotel else
           "Bitte stellen Sie Geschirr in die Spülmaschine und starten Sie "
           "sie, den Müll nehmen Sie bitte mit hinaus. Betten müssen Sie nicht "
           "abziehen. ")
        + "Ein späterer Check-out ist nach Absprache oft möglich — fragen Sie "
          "gern am Vorabend."
    )

    return {
        "checkIn": anreise,
        "checkOut": abreise,
        "wifi": (
            f"WLAN ist kostenfrei und im ganzen Haus verfügbar. "
            f"Netzname: {netz}. Passwort: {passwort} "
            "(Groß- und Kleinschreibung beachten). Sollte die Verbindung "
            "einmal stehen bleiben, hilft ein Neustart des Routers — er steht "
            "im Flur, Stecker 20 Sekunden ziehen."
        ),
        "directions": (
            f"Die Adresse lautet {objekt.strasse} {objekt.hausnummer}, "
            f"{objekt.plz} {objekt.stadt}. Mit dem Auto folgen Sie der "
            f"Navigation bis vor das Haus; ein eigener Stellplatz gehört dazu "
            f"und ist kostenfrei. Mit der Bahn fahren Sie bis "
            f"{objekt.stadt}, von dort sind es rund zehn Minuten mit dem Bus "
            f"oder Taxi. Wer zu Fuß kommt: das Haus liegt gut sichtbar an der "
            f"{objekt.strasse}."
        ),
        "doorInstructions": tuer,
        "rules": (
            f"Das ganze Haus ist Nichtraucherbereich; auf der Terrasse und dem "
            f"Balkon darf geraucht werden. Von 22:00 bis 07:00 Uhr gilt "
            f"Nachtruhe. Feiern und Veranstaltungen sind nicht gestattet. "
            f"Belegt werden darf mit höchstens {objekt.max_gaeste} Personen — "
            f"mehr erlaubt die Versicherung nicht. Haustiere nach Absprache; "
            f"für die Endreinigung kommen dann 25 € dazu."
        ),
        "localGuide": (
            f"{objekt.stadt} lässt sich gut zu Fuß erkunden. Bäcker und "
            f"Supermarkt liegen in wenigen Minuten Entfernung, ebenso zwei "
            f"Gasthäuser mit regionaler Küche — eine Tischreservierung lohnt "
            f"sich am Wochenende. Für Ausflüge empfehlen wir die Umgebung: "
            f"Wanderwege beginnen direkt am Ort, und Fahrräder lassen sich "
            f"vor Ort leihen. Unsere persönlichen Tipps liegen als Mappe im "
            f"Wohnzimmer aus."
        ),
        "emergency": (
            f"Bei Problemen erreichen Sie uns unter {f.telefon} — auch "
            f"abends. Der europäische Notruf ist 112 (Feuerwehr und "
            f"Rettungsdienst), die Polizei erreichen Sie unter 110"
            + (" bzw. 133 in Österreich" if f.land == "AT" else "")
            + ". Die nächste Notaufnahme und der ärztliche Bereitschaftsdienst "
              "stehen in der Hausmappe. Bei einem Defekt im Haus rufen Sie "
              "bitte an, statt selbst zu reparieren."
        ),
    }


def _policies(betrieb: Betrieb, objekt: Objekt) -> dict[str, Any]:
    """Die kurzen Richtlinien-Werte; sie gehen IMMER vollständig in den Prompt."""
    z = _ZEITEN[betrieb.accommodation_type]
    return {
        "checkInTime": z["an"],
        "checkInTimeEnd": z["an_bis"],
        "checkOutTime": z["ab"],
        "cancellation": (
            "Bis 30 Tage vor Anreise kostenfrei stornierbar. Danach werden "
            "50 % des Gesamtpreises fällig, ab 7 Tagen vor Anreise 90 %."
        ),
        "payment": (
            "30 % Anzahlung bei Buchung, der Rest 14 Tage vor Anreise. "
            "Zahlung per Karte, Überweisung oder PayPal."
        ),
        "depositText": (
            f"Kaution {int(objekt.grundpreis)} €, per Karte vorgemerkt und "
            "binnen 7 Tagen nach Abreise freigegeben."
        ),
        "haustiereErlaubt": True,
        "haustiereMax": 1,
        "rauchenErlaubt": False,
        "feiernErlaubt": False,
        "kinderErlaubt": True,
        "babysErlaubt": True,
    }


def type_attributes(betrieb: Betrieb, objekt: Objekt) -> dict[str, Any]:
    """Das vollständige `type_attributes` eines Demo-Objekts.

    Die Zahlen stehen auf der OBERSTEN Ebene (nicht unter `policies`): so liest
    sie `ki_kontext._objekt_block`, das daraus die Zeile "Schlafzimmer 3,
    Betten 4, Badezimmer 2" baut.
    """
    # Aus der Kapazität abgeleitet statt frei erfunden: zwei Gäste je
    # Schlafzimmer ist die Rechnung, mit der auch die Portale arbeiten.
    schlafzimmer = max(1, round(objekt.max_gaeste / 2))
    return {
        "schlafzimmer": schlafzimmer,
        "betten": max(schlafzimmer, round(objekt.max_gaeste / 1.5)),
        "badezimmer": max(1, schlafzimmer // 2),
        "occupancy": objekt.max_gaeste,
        "messaging": _messaging(betrieb, objekt),
        "policies": _policies(betrieb, objekt),
    }
