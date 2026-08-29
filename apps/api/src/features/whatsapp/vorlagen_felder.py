"""Übersetzung zwischen unserem Platzhalter-System und Metas Positionen.

myNextDays hat EIN Platzhalter-System: die benannten Felder aus dem Katalog in
``inbox.felder`` (``{{guest_first_name}}``, ``{{property_name}}`` …). Sie sind
die einzige Schreibweise, die ein Betrieb je zu Gesicht bekommt — im
Vorlagen-Reiter, in den Automationen und ab jetzt auch in den WhatsApp-Vorlagen.

Meta kennt sie nicht. Die Cloud API nimmt in Vorlagen ausschliesslich
POSITIONELLE Platzhalter (``{{1}}``, ``{{2}}`` …) und gibt sie genauso zurück;
beim Versand werden die Werte der Reihe nach eingesetzt. Diese Datei ist die
einzige Stelle, an der beide Formen aufeinandertreffen:

    Betrieb schreibt   "Hallo {{guest_first_name}}, Ihr Aufenthalt in
                        {{property_name}} ist bestaetigt."
    Meta bekommt       "Hallo {{1}}, Ihr Aufenthalt in {{2}} ist bestaetigt."
    Wir merken uns     [guest_first_name, property_name]

Die Reihenfolge ist das Stueck Wissen, das Meta nirgends speichert. Ohne sie
zeigt die Oberflaeche beim Bearbeiten ``{{1}}``, und der Versand setzt den
Gastnamen an die Stelle des Objektnamens — ohne dass irgendetwas fehlschlaegt.
Deshalb liegt sie bei uns (``whatsapp_template_field``, Migration 0489).

Ein Platzhalter, den der Katalog nicht kennt, ist ein Fehler und keine
Auslegungssache: er wuerde bei Meta als Text durchgehen und beim Gast woertlich
ankommen. Deshalb 422 beim Speichern, solange der Autor noch davorsitzt.
"""
from __future__ import annotations

import re

from src.features.inbox.felder import (
    NACH_SCHLUESSEL,
    aufloesen_schluessel,
    benutzte_felder,
    unbekannte_felder,
)

# Metas Form: {{1}}, {{2}} … Bewusst getrennt vom Muster des Katalogs, damit
# beide Formen nie durcheinandergeraten.
META_MUSTER = re.compile(r"\{\{\s*(\d+)\s*\}\}")

# Beispielwerte fuer Metas Pruefung. Meta verlangt zu jedem Platzhalter einen —
# ohne ihn wird die Vorlage abgelehnt. Es sind AUSDRUECKLICH Beispiele, keine
# Ersatzwerte fuer fehlende Daten: sie gehen an Metas Pruefer, nie an einen Gast
# (dort setzt `felder.rendern` die echten Werte ein). Wurzel 4 ist damit nicht
# beruehrt.
BEISPIELE: dict[str, str] = {
    "guest_name": "Anna Meier",
    "guest_first_name": "Anna",
    "guest_last_name": "Meier",
    "guest_email": "anna.meier@example.com",
    "guest_phone": "+49 151 23456789",
    "guest_country": "Deutschland",
    "check_in": "01.09.2026",
    "check_out": "05.09.2026",
    "checkin_time": "15:00",
    "checkout_time": "10:00",
    "nights": "4",
    "guests": "2",
    "adults": "2",
    "children": "0",
    "reservation_code": "AB-123456",
    "channel": "Booking.com",
    "total_amount": "480,00",
    "currency": "EUR",
    "property_name": "Ferienhaus Kornblomst",
    "property_address": "Strandvej 4",
    "property_city": "Bindslev",
    "property_zip": "9881",
    "property_country": "Daenemark",
    "property_phone": "+45 12 34 56 78",
    "company_name": "AirSmil",
}


def _beispiel(feld: str) -> str:
    """Beispielwert fuer Metas Pruefung. Ohne Eintrag der Feldname selbst —
    das ist ehrlich („hier steht der Objektname") und wird von Meta akzeptiert,
    waehrend ein erfundener Wert Fragen aufwerfen kann."""
    return BEISPIELE.get(feld, feld.replace("_", " "))


class VorlagenFeldFehler(Exception):
    """Der Text benutzt Platzhalter, die der Katalog nicht kennt."""

    def __init__(self, felder: list[str]) -> None:
        self.felder = felder
        super().__init__(
            "Diese Platzhalter gibt es nicht: "
            + ", ".join("{{" + f + "}}" for f in felder)
            + ". Erlaubt sind nur die Felder aus der Platzhalter-Liste."
        )


def nach_meta(text: str) -> tuple[str, list[str], list[str]]:
    """Katalog-Text → (Meta-Text, Feldreihenfolge, Beispielwerte).

    Mehrfach benutzte Felder bekommen DIESELBE Position: Meta zaehlt Parameter,
    nicht Vorkommen, und ``{{1}} … {{1}}`` ist bei ihm zulaessig. Ein zweiter
    Parameter fuer denselben Wert waere nur eine weitere Stelle, an der etwas
    auseinanderlaufen kann.
    """
    if fehlend := unbekannte_felder(text):
        raise VorlagenFeldFehler(fehlend)
    reihenfolge = [aufloesen_schluessel(f) for f in benutzte_felder(text)]
    if not reihenfolge:
        return text, [], []

    position = {feld: i + 1 for i, feld in enumerate(reihenfolge)}

    def ersetze(treffer: re.Match[str]) -> str:
        # `benutzte_felder` normalisiert den im Editor zerrissenen Namen; hier
        # muss dieselbe Normalisierung greifen, sonst bliebe genau dieser
        # Platzhalter als Rohtext stehen.
        from src.features.inbox.felder import _schluessel_normalisieren  # noqa: PLC0415

        name = aufloesen_schluessel(_schluessel_normalisieren(treffer.group(1)))
        return "{{" + str(position[name]) + "}}"

    from src.features.inbox.felder import MUSTER  # noqa: PLC0415

    meta_text = MUSTER.sub(ersetze, text)
    return meta_text, reihenfolge, [_beispiel(f) for f in reihenfolge]


def nach_katalog(meta_text: str, reihenfolge: list[str]) -> str:
    """Meta-Text → Katalog-Text. Die Umkehrung, fuer die Anzeige im Editor.

    Fehlt die Zuordnung (Vorlage bei Meta angelegt, bevor es diese Tabelle gab),
    bleibt ``{{1}}`` stehen. Das ist die ehrliche Anzeige: wir wissen dann
    wirklich nicht, welches Feld gemeint war, und ein geratener Name waere
    schlimmer als ein sichtbar unaufgeloester Platzhalter.
    """
    if not reihenfolge:
        return meta_text

    def ersetze(treffer: re.Match[str]) -> str:
        nummer = int(treffer.group(1))
        if 1 <= nummer <= len(reihenfolge):
            return "{{" + reihenfolge[nummer - 1] + "}}"
        return treffer.group(0)

    return META_MUSTER.sub(ersetze, meta_text)


def werte_fuer(reihenfolge: list[str], kontext: object) -> list[str]:
    """Die Parameterwerte einer Vorlage in Metas Reihenfolge.

    Aufloesen ueber denselben Katalog wie ueberall sonst — eine zweite
    Auswertung waere eine zweite Wahrheit. Fehlt der Wert eines benutzten
    Feldes, wirft der Katalog ``FeldFehlt``; das ist gewollt: „Hallo ," ist
    kein zulaessiger Ersatz (Wurzel 4).
    """
    from src.features.inbox.felder import FeldFehlt  # noqa: PLC0415

    werte: list[str] = []
    fehlt: list[str] = []
    for feld in reihenfolge:
        eintrag = NACH_SCHLUESSEL.get(feld)
        roh = eintrag.aufloesen(kontext) if eintrag else None  # type: ignore[arg-type]
        if roh is None or str(roh).strip() == "":
            fehlt.append(feld)
        else:
            werte.append(str(roh))
    if fehlt:
        raise FeldFehlt(fehlt)
    return werte
