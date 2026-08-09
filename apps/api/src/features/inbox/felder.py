"""Platzhalter (Felder) für Vorlagen, Automationen und geplante Nachrichten.

Ohne Platzhalter kann eine Automation nur Sätze verschicken, die für jeden Gast
gleich lauten — der Automations-Tab war damit praktisch unbenutzbar. Hier steht
der Katalog, der Ersetzer und die Prüfung.

Schreibweise: ``{{guest_name}}``. Die Schlüssel sind bewusst ENGLISCH und
sprachneutral: der Text der Vorlage schreibt der Betrieb in seiner Sprache, der
Schlüssel darin muss aber stabil bleiben — sonst wäre eine Vorlage nach einem
Sprachwechsel der Oberfläche kaputt. Übersetzt wird nur das Etikett im Picker
(Frontend, ``inbox.field_*``).

Zwei Regeln, die das Verhalten bestimmen:

1. **Ersetzt wird beim SENDEN, nicht beim Planen.** Eine Automation für den
   Anreisetag wird Tage vorher geplant; der Türcode entsteht oft erst kurz
   davor. Würde beim Planen ersetzt, stünde im Text für immer der Stand von
   damals. Deshalb liegt im Zeitplan der Rohtext, und erst der Versand löst auf.

2. **Fehlt der Wert eines BENUTZTEN Feldes, wird nicht gesendet** (Wurzel 4).
   „Hallo ," ist kein akzeptabler Ersatz für „Hallo Frau Meier,". Der Versand
   schlägt mit :class:`FeldFehlt` fehl und nennt die betroffenen Felder; der
   Grund landet sichtbar an der geplanten Nachricht (``last_error``), statt
   still eine kaputte Nachricht an einen Gast zu schicken.
"""
from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from html import unescape
from html.parser import HTMLParser

# {{ feld }} — Leerzeichen innen erlaubt, damit ein aus der UI eingefügtes Feld
# auch nach manuellem Nachtippen noch greift.
#
# GROSSBUCHSTABEN BEWUSST MIT: Vorher stand hier `[a-z0-9_]+`. Damit galt
# „{{WifiInformation}}" (so schreibt Lodgify) NICHT als Platzhalter — kein 422
# beim Speichern, keine Meldung beim Senden, und der Gast las wörtlich
# „{{WifiInformation}}". Was wir nicht erkennen, können wir auch nicht
# beanstanden; deshalb lieber erkennen und dann sauber ablehnen oder übersetzen
# (`aufloesen_schluessel`).
#
# WHITESPACE MITTENDRIN — auch ZEILENUMBRÜCHE: Seit der Editor HTML schreibt,
# kann ein Platzhalter über zwei BLÖCKE zerrissen werden. Wer mitten in
# `{{guest_name}}` Enter drückt, erzeugt `<p>Hallo {{guest</p><p>_name}}</p>`;
# nach `html_zu_text` steht dort „{{guest\n\n_name}}". Mit dem alten Muster (nur
# `[A-Za-z0-9_-]` innen) war das KEIN Platzhalter mehr: kein 422 beim Speichern,
# keine Meldung beim Versand — der Gast las wörtlich „{{guest". Der eingebettete
# Whitespace wird deshalb hier MIT erfasst und erst in
# `_schluessel_normalisieren` herausgenommen. Der Treffer selbst behält seine
# Rohform, damit `MUSTER.sub` genau das ersetzt, was im Text steht.
#
# Der einfache Fall (`{{guest<strong>_name</strong>}}`) löst sich schon dadurch,
# dass `html_zu_text` VOR der Prüfung läuft und die Tags ersatzlos entfernt —
# diese Reihenfolge ist deshalb zwingend (vorlagen.create_template).
MUSTER = re.compile(r"\{\{\s*([A-Za-z0-9_-][A-Za-z0-9_\-\s]*?)\s*\}\}")

# Innerer Whitespace eines Platzhalternamens (inkl. Umbruch) — der Riss, den ein
# Absatzwechsel mitten im Namen hinterlassen hat.
_INNEN_WHITESPACE = re.compile(r"\s+")


def _schluessel_normalisieren(roh: str) -> str:
    """Roher Musterfund → Name ohne eingebetteten Whitespace.

    „guest\\n\\n_name" → „guest_name". Ein Katalog-Schlüssel enthält NIE
    Whitespace; das Zusammenziehen kann also keinen gültigen Namen zerstören,
    rettet aber den im Editor zerrissenen.
    """
    return _INNEN_WHITESPACE.sub("", roh)


class FeldFehlt(Exception):
    """Ein im Text benutztes Feld hat für diesen Vorgang keinen Wert."""

    def __init__(self, felder: list[str]) -> None:
        self.felder = felder
        super().__init__(
            "Diese Felder haben für diese Reservierung keinen Wert: "
            + ", ".join(sorted(felder))
        )


@dataclass(frozen=True)
class Feld:
    schluessel: str
    gruppe: str  # guest | reservation | property | company
    aufloesen: Callable[[Kontext], object]


@dataclass
class Kontext:
    """Alle Daten, aus denen sich Felder speisen. Rohwerte, kein Formatieren —
    das übernimmt der jeweilige Resolver."""

    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    guest_language: str | None = None
    check_in: str | None = None
    check_out: str | None = None
    checkin_time: str | None = None
    checkout_time: str | None = None
    adults: int | None = None
    children: int | None = None
    reservation_code: str | None = None
    channel: str | None = None
    total_amount: object = None  # Cent (int) oder Betrag (float/Decimal)
    currency: str | None = None
    property_name: str | None = None
    property_address: str | None = None
    property_city: str | None = None
    door_code: str | None = None
    wifi_ssid: str | None = None
    wifi_password: str | None = None
    company_name: str | None = None
    # --- Gast (weitere) ---
    guest_last_name: str | None = None
    guest_country: str | None = None
    # --- Reservierung (weitere) ---
    paid_amount: object = None
    # Positionsliste der Buchung: [{kind, label, amount}] — Übernachtung,
    # Abgaben, Zusatzleistungen. Bei OTA-Buchungen oft leer (Airbnb liefert
    # keine Aufstellung); die betroffenen Felder sind dann leer statt 0.
    quote_items: object = None
    payment_link: str | None = None
    # --- Objekt: Anschrift und Lage ---
    property_country: str | None = None
    property_zip: str | None = None
    property_lat: object = None
    property_lng: object = None
    property_phone: str | None = None
    emergency_phone: str | None = None
    security_deposit: object = None
    # --- Objekt: Freitexte für den Gast ---
    # Bereits IN DER SPRACHE DES GASTES aufgelöst (`service._messaging_texte`).
    # Gepflegt werden sie mehrsprachig unter `/objekte/{id}/nachrichten` in
    # `properties.type_attributes.messaging`.
    checkin_instructions: str | None = None
    checkout_instructions: str | None = None
    door_instructions: str | None = None
    directions: str | None = None
    house_rules: str | None = None
    local_guide: str | None = None
    wifi_text: str | None = None
    emergency_contact: str | None = None
    # --- Betrieb: Bankverbindung (Zahlungsaufforderungen) ---
    bank_iban: str | None = None
    bank_bic: str | None = None
    bank_name: str | None = None
    bank_holder: str | None = None
    payment_text: str | None = None
    tax_rate: object = None
    company_website: str | None = None


# Drei oder mehr Umbrüche → eine Leerzeile. Läuft ERST NACH der Absatz- und
# Listenbildung: davor wüsste man nicht, welcher Umbruch aus einer Absatzgrenze
# stammt und welcher aus dem Einrücken der Quelle.
_LEERZEILEN = re.compile(r"\n{3,}")

# Blöcke, deren ENDE eine Leerzeile bedeutet (ein Absatz steht für sich). `li`
# ist bewusst NICHT dabei — zwischen den Punkten EINER Liste gehört ein
# einfacher Umbruch, sonst zerfällt die Liste beim Zurücklesen in n Einzellisten
# (`textZuHtml` im Composer trennt Absätze an der Leerzeile).
_ABSATZ_TAGS = frozenset(
    {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "tr", "table"}
)
_LISTEN_TAGS = frozenset({"ul", "ol"})
# Ersatzlos entfernt, ohne Ersatzzeichen: ein „*fett*" im Portal-Chat wäre nur
# ein weiteres Zeichen, das der Gast mitliest — Airbnb rendert kein Markdown.
_INLINE_TAGS = frozenset({"strong", "b", "em", "i", "u", "s", "strike", "span", "code"})

# Tags, deren INHALT kein Text ist, sondern Programm bzw. Stilregeln.
# `HTMLParser` reicht diesen Inhalt als ganz normale Daten durch — ohne diese
# Sperre landete „alert(1)" aus einem `<script>` als sichtbarer Satz in der
# Nachricht an den Gast. Der frühere `nh3.clean(tags=set())`-Weg in
# `host_messages` verwarf ihn; dieser Parser muss dasselbe tun.
_STUMME_TAGS = frozenset({"script", "style", "template", "title", "head", "noscript"})

# Einrückung je Verschachtelungsebene einer Liste.
_EINRUECKUNG = "  "


@dataclass
class _Liste:
    """Eine offene Liste im Durchlauf: geordnet? und der nächste Zähler."""

    geordnet: bool
    zaehler: int = 1
    # Nur für die Einrückung: die Ebene ergibt sich aus der Stapeltiefe.
    ebene: int = 0


@dataclass
class _Sammler:
    """Der bisher erzeugte Klartext als Stücke (billiger als str-Konkatenation)."""

    stuecke: list[str] = field(default_factory=list)

    def text(self, wert: str) -> None:
        if wert:
            self.stuecke.append(wert)

    def umbruch(self, anzahl: int) -> None:
        """Am Ende so viele „\\n" sicherstellen, wie verlangt — ohne sie zu
        verdoppeln. Zwei aufeinanderfolgende `</p>` sollen EINE Leerzeile geben,
        nicht zwei."""
        vorhanden = 0
        for stueck in reversed(self.stuecke):
            rest = stueck
            while rest.endswith("\n"):
                vorhanden += 1
                rest = rest[:-1]
            if rest:
                break
        else:
            return  # noch nichts geschrieben → führende Umbrüche unterdrücken
        if anzahl > vorhanden:
            self.stuecke.append("\n" * (anzahl - vorhanden))

    def fertig(self) -> str:
        return "".join(self.stuecke)


class _KlartextParser(HTMLParser):
    """HTML → Klartext mit erhaltener Gliederung.

    WARUM EIN PARSER UND KEIN REGEX: Nummerierung ist ein ZUSTAND. Ein `<li>`
    weiß aus sich heraus nicht, ob es das zweite oder das siebte seiner Liste
    ist, ob seine Liste geordnet ist und auf welcher Ebene sie liegt — ein
    einzelnes `re.sub` kann das prinzipiell nicht wissen und machte deshalb aus
    JEDEM `<li>` ein „- ". Aus „1. 2. 3." im Editor wurde beim Gast „- - -",
    und beim Zurücklesen war die Nummerierung endgültig weg.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._aus = _Sammler()
        self._listen: list[_Liste] = []
        # Ziel des offenen `<a>`: wird beim `</a>` als „ (URL)" nachgestellt.
        self._link_ziel: str | None = None
        self._link_text: list[str] = []
        # True zwischen dem Setzen einer Listenmarke und dem ersten Textzeichen
        # dahinter (siehe `_absatz_umbrueche`).
        self._nach_marke = False
        # Tiefe offener `_STUMME_TAGS` — solange > 0 wird nichts ausgegeben.
        self._stumm = 0

    # -- Ausgabe ----------------------------------------------------------
    def _schreiben(self, wert: str) -> None:
        """Text an die richtige Senke — im Link erst sammeln, sonst direkt."""
        if self._link_ziel is not None:
            self._link_text.append(wert)
            self._nach_marke = False
            return
        self._aus.text(wert)

    # -- HTMLParser-Haken --------------------------------------------------
    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        name = tag.lower()
        if name in _STUMME_TAGS:
            self._stumm += 1
            return
        if self._stumm:
            return
        if name == "br":
            # Weicher Umbruch INNERHALB eines Absatzes: genau ein „\n". Im
            # offenen Link gehört er in den gesammelten Linktext, sonst direkt
            # in die Ausgabe (dort ohne zu verdoppeln).
            if self._link_ziel is not None:
                self._schreiben("\n")
            else:
                self._aus.umbruch(1)
            return
        if name in _LISTEN_TAGS:
            self._liste_oeffnen(name, attrs)
            return
        if name == "li":
            self._punkt_oeffnen()
            return
        if name == "a":
            self._link_ziel = self._href(attrs)
            self._link_text = []
            return
        if name in _ABSATZ_TAGS:
            self._aus.umbruch(self._absatz_umbrueche())

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        # `<br/>` erreicht `handle_starttag` NICHT — ohne diesen Zweig fielen
        # alle selbstschließenden Umbrüche still unter den Tisch.
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        name = tag.lower()
        if name in _STUMME_TAGS:
            self._stumm = max(0, self._stumm - 1)
            return
        if self._stumm:
            return
        if name == "a":
            self._link_schliessen()
        elif name in _LISTEN_TAGS:
            if self._listen:
                self._listen.pop()
            # Nach der Liste beginnt ein neuer Absatz — es sei denn, sie steckte
            # in einem Punkt der äußeren Liste. Dort würde die Leerzeile die
            # äußere Liste in zwei Listen zerschneiden.
            self._aus.umbruch(1 if self._listen else 2)
        elif name == "li":
            # Zwischen den Punkten EINER Liste nur ein Umbruch.
            self._aus.umbruch(1)
        elif name in _ABSATZ_TAGS:
            self._aus.umbruch(self._absatz_umbrueche())
        # `_INLINE_TAGS` (strong/em/u/…) fallen ersatzlos durch: kein „*", kein
        # „_" — die Portale rendern im Gast-Chat kein Markdown.

    def handle_data(self, data: str) -> None:
        if self._stumm:
            return  # Skript-/Stil-Inhalt ist kein Text für den Gast
        # Der Zeilenumbruch der QUELLE ist Formatierung des Markups, nicht des
        # Textes (`<p>\n  Hallo\n</p>`). Er wird zu einem Leerzeichen — die
        # echten Umbrüche kommen ausschließlich aus den Tags.
        wert = re.sub(r"\s+", " ", data.replace("\xa0", " "))
        if not wert.strip():
            # Reiner Zwischenraum zwischen zwei Blöcken: nur behalten, wenn
            # mitten in einer Zeile (sonst entstünden führende Leerzeichen).
            if wert and self._aus.stuecke and not self._aus.fertig().endswith("\n"):
                self._schreiben(" ")
            return
        self._nach_marke = False
        self._schreiben(wert)

    # -- Zustand ------------------------------------------------------------
    def _absatz_umbrueche(self) -> int:
        """Wie viele Umbrüche eine Absatzgrenze hier bedeutet.

        TipTap verpackt jeden Listenpunkt in ein eigenes `<p>`
        (`<li><p>Nicht rauchen</p></li>`). Nähme man dieses `<p>` wörtlich als
        Absatz, risse es den Punkt von seiner Marke los — aus „- Nicht rauchen"
        wurde „-\\n\\nNicht rauchen", also ein leerer Aufzählungspunkt gefolgt
        von einer Textwand. INNERHALB einer Liste zählt eine Absatzgrenze
        deshalb nur als einfacher Umbruch.
        """
        if not self._listen:
            return 2
        # Direkt HINTER der Marke („- ", „1. ") darf gar nicht umgebrochen
        # werden — sonst stünde die Marke allein auf ihrer Zeile.
        return 0 if self._nach_marke else 1

    def _liste_oeffnen(self, name: str, attrs: list[tuple[str, str | None]]) -> None:
        start = 1
        if name == "ol":
            for schluessel, wert in attrs:
                if schluessel.lower() == "start" and wert:
                    try:
                        start = int(wert.strip())
                    except ValueError:
                        start = 1  # kaputtes Attribut → normale Zählung
        self._listen.append(
            _Liste(geordnet=name == "ol", zaehler=start, ebene=len(self._listen))
        )
        # Eine Liste beginnt einen neuen Block. Steckt sie IN einem Punkt
        # (Verschachtelung), reicht ein einfacher Umbruch — sonst risse die
        # Leerzeile die äußere Liste auseinander.
        self._aus.umbruch(1 if len(self._listen) > 1 else 2)

    def _punkt_oeffnen(self) -> None:
        self._aus.umbruch(1)
        if not self._listen:
            # `<li>` ohne Liste (kommt aus fremdem Markup vor) — wie `ul`.
            self._aus.text("- ")
            self._nach_marke = True
            return
        aktuell = self._listen[-1]
        if aktuell.geordnet:
            marke = f"{aktuell.zaehler}. "
            aktuell.zaehler += 1
        else:
            marke = "- "
        self._aus.text(_EINRUECKUNG * aktuell.ebene + marke)
        self._nach_marke = True

    @staticmethod
    def _href(attrs: list[tuple[str, str | None]]) -> str:
        for schluessel, wert in attrs:
            if schluessel.lower() == "href" and wert:
                return wert.strip()
        return ""

    def _link_schliessen(self) -> None:
        ziel = self._link_ziel or ""
        text = "".join(self._link_text)
        self._link_ziel = None
        self._link_text = []
        if not text.strip():
            # Linktext leer → wenigstens die URL, sonst wäre der Link weg.
            self._aus.text(ziel)
            return
        # Ziel in Klammern HINTER den Text — außer der Text IST schon die URL.
        # Dieselbe Regel wie `knotenText` im Composer (composer-editor.tsx),
        # damit Hin- und Rückweg dasselbe Ergebnis liefern.
        self._aus.text(text if not ziel or ziel == text.strip() else f"{text} ({ziel})")

    def ergebnis(self) -> str:
        return self._aus.fertig()


def html_zu_text(roh: str) -> str:
    """Rich-Text aus Editor/Objektpflege → Klartext für eine Chat-Nachricht.

    DER GRUND: Die Objekt-Texte („Hausordnung", „Check-out") und seit dem
    Formatierungs-Editor auch die Nachrichten-VORLAGEN liegen als HTML vor
    (`<p>`, `<strong>`, `<ul><li>`, `<a href>`). Unverändert in eine
    Portal-Nachricht gesetzt, liest der Gast die Tags mit — Airbnb und
    Booking.com übertragen reinen Text.

    Kein Tag-Strippen allein (`nh3.clean(tags=set())`): das ergäbe eine
    Textwand, in der eine zwölfpunktige Hausordnung zu einem Absatz verklebt.
    Die GLIEDERUNG ist hier die Information. Vier Regeln machen sie aus:

    * `<ol>` zählt („1. ", „2. ") und achtet auf `start`; `<ul>` setzt „- ".
    * `</p>` ist eine LEERZEILE, `<br>` nur ein Umbruch.
    * Zwischen den Punkten EINER Liste steht ein einfacher Umbruch — mit einer
      Leerzeile zerfiele die Liste beim Zurücklesen in n Einzellisten.
    * `<a href="URL">Text</a>` wird zu „Text (URL)": ein Ziel, das nur im
      `href` steht, wäre im Portal-Chat verloren.

    Diese Funktion ist damit die exakte Umkehrung von `textZuHtml`/
    `dokumentZuText` im Composer — die Rundreise Klartext → HTML → Klartext
    muss ab der ersten Generation stabil sein.
    """
    if not roh:
        return ""
    parser = _KlartextParser()
    parser.feed(roh)
    parser.close()
    # `convert_charrefs=True` löst die Entitäten bereits im Parser auf; der
    # zweite Durchgang fängt nur, was in Attributwerten steckte (Link-Ziele).
    text = unescape(parser.ergebnis())
    # Zeilenweise trimmen — aber die Einrückung verschachtelter Listenpunkte
    # bleibt: sie IST die Gliederung, kein Markup-Rest.
    zeilen = [z.rstrip() if z.startswith(_EINRUECKUNG) else z.strip()
              for z in text.split("\n")]
    return _LEERZEILEN.sub("\n\n", "\n".join(zeilen)).strip()


def _text(wert: object) -> str | None:
    """Rohwert → getrimmter Text, leer wird zu None (= „kein Wert")."""
    if wert is None:
        return None
    s = str(wert).strip()
    return s or None


def _vorname(k: Kontext) -> str | None:
    ganz = _text(k.guest_name)
    return ganz.split()[0] if ganz else None


def _datum(roh: str | None) -> str | None:
    """ISO-Datum → TT.MM.JJJJ. Kein Locale-Rateversuch: das Zielformat hängt an
    der Sprache des Gastes, die wir hier nicht zuverlässig kennen. Das ISO-Datum
    unverändert stehen zu lassen wäre für einen Gast schlechter lesbar."""
    s = str(roh).strip() if roh is not None else ""
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10]).strftime("%d.%m.%Y")
    except ValueError:
        return s


def _naechte(k: Kontext) -> int | None:
    if not (k.check_in and k.check_out):
        return None
    try:
        a = date.fromisoformat(str(k.check_in)[:10])
        b = date.fromisoformat(str(k.check_out)[:10])
    except ValueError:
        return None
    return (b - a).days or None


def _gaeste(k: Kontext) -> int | None:
    summe = (k.adults or 0) + (k.children or 0)
    return summe or None


def _dezimal(roh: object) -> Decimal | None:
    """Rohwert → Decimal, unbrauchbares → None."""
    if roh is None:
        return None
    try:
        return Decimal(str(roh))
    except (InvalidOperation, ValueError):
        return None


def _geld(roh: object) -> str | None:
    """Betrag mit zwei Nachkommastellen, deutsches Komma. Ohne Währungszeichen —
    dafür gibt es `{{currency}}` (Wurzel 4: kein hartkodiertes €)."""
    wert = _dezimal(roh)
    return None if wert is None else f"{wert:.2f}".replace(".", ",")


def _restbetrag(k: Kontext) -> str | None:
    """Was noch offen ist: Gesamt minus bereits bezahlt.

    Beides muss bekannt sein. Fehlt der Bezahlt-Stand, ist die Antwort None und
    nicht „= Gesamtbetrag": Eine Zahlungsaufforderung über einen Betrag, den der
    Gast womöglich schon überwiesen hat, ist schlimmer als gar keine (Wurzel 4).
    """
    gesamt = _dezimal(k.total_amount)
    bezahlt = _dezimal(k.paid_amount)
    if gesamt is None or bezahlt is None:
        return None
    offen = gesamt - bezahlt
    return f"{offen:.2f}".replace(".", ",")


def _bankblock(k: Kontext) -> str | None:
    """Die Bankverbindung als fertiger Absatz für eine Zahlungsaufforderung.

    Nur vollständig oder gar nicht: Ohne IBAN kann niemand überweisen, und eine
    halbe Bankverbindung im Text sieht aus wie ein Fehler des Betriebs. Der
    Verwendungszweck ist die Buchungsnummer — ohne ihn lässt sich der Eingang
    nicht zuordnen.
    """
    if not (k.bank_iban and k.bank_holder):
        return None
    zeilen = [f"Empfänger: {k.bank_holder}", f"IBAN: {k.bank_iban}"]
    if k.bank_bic:
        zeilen.append(f"BIC: {k.bank_bic}")
    if k.bank_name:
        zeilen.append(f"Bank: {k.bank_name}")
    if k.reservation_code:
        zeilen.append(f"Verwendungszweck: {k.reservation_code}")
    return "\n".join(zeilen)


# `quote_items`-Arten, wie sie in der Reservierung stehen (belegt in
# `buchhaltung.reservation_invoice`): der Übernachtungspreis, Abgaben wie
# Kurtaxe, und alles Zubuchbare (Endreinigung, Wäschepaket, Haustier).
_ART_UEBERNACHTUNG = "lodging"
_ART_ABGABE = "tax"
_ART_ZUSATZ = "addon"


def _posten(k: Kontext, art: str) -> list[dict]:
    """Die Positionen einer Art aus der Buchung ([] wenn keine)."""
    if not isinstance(k.quote_items, list):
        return []
    return [
        p for p in k.quote_items
        if isinstance(p, dict) and str(p.get("kind") or "") == art
    ]


def _posten_summe(k: Kontext, art: str) -> str | None:
    """Summe einer Positionsart. None, wenn es KEINE solche Position gibt.

    Kein „0,00" als Ersatz: „Steuern: 0,00" behauptet, es seien Abgaben
    berechnet und sie betrügen null — tatsächlich weist die Buchung gar keine
    aus (Airbnb liefert die Aufstellung nicht mit). Der Versand meldet dann
    „Feld ohne Wert", und der Betrieb sieht, dass sein Text nicht passt.
    """
    posten = _posten(k, art)
    if not posten:
        return None
    summe = sum((_dezimal(p.get("amount")) or Decimal(0)) for p in posten)
    return f"{summe:.2f}".replace(".", ",")


def _posten_liste(k: Kontext, art: str) -> str | None:
    """Die Positionen einer Art als Zeilen: „Endreinigung: 60,00"."""
    zeilen = [
        f"{p.get('label') or '—'}: {_geld(p.get('amount')) or '—'}"
        for p in _posten(k, art)
    ]
    return "\n".join(zeilen) or None


def _reinigung(k: Kontext) -> str | None:
    """Die Reinigungsposition — an ihrem Text erkannt.

    Es gibt KEINE eigene `kind`-Art dafür: Endreinigung ist ein `addon` wie
    Wäschepaket oder Haustiergebühr. Deshalb über das Label, und bewusst
    mehrsprachig — der Betrieb ist dänisch, seine Gäste sind es nicht.
    """
    for p in _posten(k, _ART_ZUSATZ):
        label = str(p.get("label") or "").lower()
        if any(w in label for w in ("reinig", "cleaning", "rengør", "schoonmaak")):
            return _geld(p.get("amount"))
    return None


def _wlan(k: Kontext) -> str | None:
    """Netz und Passwort in einer Zeile: „NetzName / geheim123".

    Nur das, was da ist: fehlt das Passwort, steht der Netzname allein. Fehlt
    beides, ist das Feld leer — der Versand schlägt dann mit `FeldFehlt` fehl,
    statt „Internet: " an den Gast zu schicken.
    """
    teile = [x for x in (k.wifi_ssid, k.wifi_password) if x]
    return " / ".join(teile) or None


def _betrag(k: Kontext) -> str | None:
    """Betrag mit zwei Nachkommastellen. Ohne Währungszeichen — dafür gibt es
    ``{{currency}}``; ein hier hartkodiertes € wäre in 26 der 27 EU-Länder
    falsch (Wurzel 4)."""
    roh = k.total_amount
    if roh is None:
        return None
    try:
        wert = Decimal(str(roh))
    except (InvalidOperation, ValueError):
        return None
    return f"{wert:.2f}".replace(".", ",")


FELDER: tuple[Feld, ...] = (
    Feld("guest_name", "guest", lambda k: _text(k.guest_name)),
    Feld("guest_first_name", "guest", _vorname),
    Feld("guest_email", "guest", lambda k: _text(k.guest_email)),
    Feld("guest_phone", "guest", lambda k: _text(k.guest_phone)),
    Feld("guest_language", "guest", lambda k: _text(k.guest_language)),
    Feld("check_in", "reservation", lambda k: _datum(k.check_in)),
    Feld("check_out", "reservation", lambda k: _datum(k.check_out)),
    Feld("checkin_time", "reservation", lambda k: _text(k.checkin_time)),
    Feld("checkout_time", "reservation", lambda k: _text(k.checkout_time)),
    Feld("nights", "reservation", _naechte),
    Feld("guests", "reservation", _gaeste),
    Feld("adults", "reservation", lambda k: k.adults or None),
    Feld("children", "reservation", lambda k: k.children),
    Feld("reservation_code", "reservation", lambda k: _text(k.reservation_code)),
    Feld("channel", "reservation", lambda k: _text(k.channel)),
    Feld("total_amount", "reservation", _betrag),
    Feld("currency", "reservation", lambda k: _text(k.currency)),
    Feld("property_name", "property", lambda k: _text(k.property_name)),
    Feld("property_address", "property", lambda k: _text(k.property_address)),
    Feld("property_city", "property", lambda k: _text(k.property_city)),
    Feld("door_code", "property", lambda k: _text(k.door_code)),
    # WLAN getrennt in Netz und Passwort (0296): eine Vorlage schreibt oft nur
    # eines von beidem („Das Netz heißt X, das Passwort steht am Kühlschrank"),
    # und der QR-Code des Gastportals braucht die Teile ohnehin einzeln.
    Feld("wifi_ssid", "property", lambda k: _text(k.wifi_ssid)),
    Feld("wifi_password", "property", lambda k: _text(k.wifi_password)),
    # Beides in einer Zeile — das, was „Internet: {{WifiInformation}}" in den
    # übernommenen Vorlagen meinte. Die Einzelfelder bleiben daneben bestehen;
    # wer nur das Netz nennen will, nimmt `{{wifi_ssid}}`.
    # Der GEPFLEGTE WLAN-Text aus `/objekte/{id}/nachrichten` (mehrsprachig).
    # Das ist es, was `{{WifiInformation}}` in den übernommenen Vorlagen meint:
    # ein ganzer Satz („Netz X, Passwort Y, Router steht im Flur"), nicht zwei
    # Werte. Fehlt der Text, springt die Zusammensetzung aus den strukturierten
    # Feldern ein — besser die nackten Zugangsdaten als eine leere Zeile.
    Feld("wifi", "property", lambda k: _text(k.wifi_text) or _wlan(k)),
    Feld("company_name", "company", lambda k: _text(k.company_name)),
    # --- Gast (weitere) ---
    Feld("guest_last_name", "guest", lambda k: _text(k.guest_last_name)),
    Feld("guest_country", "guest", lambda k: _text(k.guest_country)),
    # --- Reservierung: Beträge ---
    # Der offene Betrag ist das, was in einer Zahlungsaufforderung steht. Drei
    # Lodgify-Namen meinen dasselbe (AmountToPay/AmountDueAfterPay/
    # ResidualAmount) — EIN Feld, drei Alt-Namen zeigen darauf.
    Feld("amount_due", "reservation", _restbetrag),
    Feld("paid_amount", "reservation", lambda k: _geld(k.paid_amount)),
    # --- Objekt: Anschrift und Lage ---
    Feld("property_country", "property", lambda k: _text(k.property_country)),
    Feld("property_zip", "property", lambda k: _text(k.property_zip)),
    Feld("property_lat", "property", lambda k: _text(k.property_lat)),
    Feld("property_lng", "property", lambda k: _text(k.property_lng)),
    Feld("property_phone", "property", lambda k: _text(k.property_phone)),
    Feld("emergency_phone", "property", lambda k: _text(k.emergency_phone)),
    Feld("security_deposit", "property", lambda k: _geld(k.security_deposit)),
    # --- Objekt: Freitexte für den Gast (0298) ---
    Feld("checkin_instructions", "property",
         lambda k: _text(k.checkin_instructions)),
    Feld("checkout_instructions", "property",
         lambda k: _text(k.checkout_instructions)),
    Feld("door_instructions", "property", lambda k: _text(k.door_instructions)),
    Feld("directions", "property", lambda k: _text(k.directions)),
    Feld("house_rules", "property", lambda k: _text(k.house_rules)),
    Feld("local_guide", "property", lambda k: _text(k.local_guide)),
    Feld("emergency_contact", "property", lambda k: _text(k.emergency_contact)),
    # --- Betrieb: Bankverbindung ---
    # Der fertige Block ist der Normalfall in einer Zahlungsaufforderung; die
    # Einzelfelder daneben, wenn jemand seinen Satz selbst bauen will.
    Feld("bank_details", "company", _bankblock),
    Feld("bank_iban", "company", lambda k: _text(k.bank_iban)),
    Feld("bank_bic", "company", lambda k: _text(k.bank_bic)),
    Feld("bank_name", "company", lambda k: _text(k.bank_name)),
    Feld("bank_holder", "company", lambda k: _text(k.bank_holder)),
    Feld("payment_text", "company", lambda k: _text(k.payment_text)),
    Feld("tax_rate", "company", lambda k: _text(k.tax_rate)),
    Feld("company_website", "company", lambda k: _text(k.company_website)),
    # --- Positionen der Buchung (aus `quote_items`) ---
    Feld("addons", "reservation", lambda k: _posten_liste(k, _ART_ZUSATZ)),
    Feld("addons_total", "reservation",
         lambda k: _posten_summe(k, _ART_ZUSATZ)),
    Feld("taxes", "reservation", lambda k: _posten_summe(k, _ART_ABGABE)),
    Feld("cleaning_fee", "reservation", _reinigung),
    Feld("payment_link", "reservation", lambda k: _text(k.payment_link)),
)

NACH_SCHLUESSEL: dict[str, Feld] = {f.schluessel: f for f in FELDER}

# Platzhalternamen aus ALTSYSTEMEN, die in übernommenen Vorlagen stehen.
#
# DER ANLASS (06.08.2026): Die aus Lodgify übernommene Vorlage „Anreisetag"
# enthält „Internet: {{WifiInformation}}". Diesen Namen kennt unser Katalog
# nicht — und weil `MUSTER` nur Kleinbuchstaben erfasste, wurde er nicht einmal
# als Platzhalter ERKANNT: kein 422 beim Speichern, keine Meldung beim Senden.
# Der Gast hätte wörtlich „{{WifiInformation}}" gelesen.
#
# Zwei Konsequenzen, beide hier: `MUSTER` erkennt jetzt auch Groß-/Binnen-
# schreibung (sonst rutscht der nächste Alt-Name genauso durch), und bekannte
# Alt-Namen werden auf unseren Schlüssel abgebildet, statt 18 Vorlagen von Hand
# umschreiben zu lassen.
#
# Schlüssel hier IMMER klein vergleichen — Lodgify schreibt „WifiInformation",
# andere Systeme „wifi_information" oder „WIFI_INFORMATION".
# Vollständig gegen die Lodgify-Liste des Betriebs geprüft (65 Namen). Mehrere
# Lodgify-Namen zeigen bewusst auf DASSELBE Feld — etwa die drei Schreibweisen
# für den offenen Restbetrag. Sie dort zu trennen hieße, denselben Wert dreimal
# zu pflegen.
_ALTNAMEN: dict[str, str] = {
    # Gast
    "guestfirstname": "guest_first_name",
    "guestfullname": "guest_name",
    "guestname": "guest_name",
    "guestlastname": "guest_last_name",
    "guestemail": "guest_email",
    "guestphone": "guest_phone",
    "guestcountry": "guest_country",
    # Reservierung
    "arrival": "check_in",
    "departure": "check_out",
    "checkintime": "checkin_time",
    "checkouttime": "checkout_time",
    "numberofnights": "nights",
    "numberofpeople": "guests",
    "bookingid": "reservation_code",
    "banktransferconcept": "reservation_code",  # Verwendungszweck = Buchungsnr.
    "source": "channel",
    "totalamount": "total_amount",
    "totalpaid": "paid_amount",
    "currencycode": "currency",
    # Drei Namen, ein Betrag: was noch offen ist.
    "amounttopay": "amount_due",
    "amountdueafterpay": "amount_due",
    "residualamount": "amount_due",
    # Objekt
    "housename": "property_name",
    "roomtypename": "property_name",  # 1 Objekt = 1 Typ (Datenmodell)
    "propertyname": "property_name",
    "houseaddress": "property_address",
    "housecity": "property_city",
    "housecountry": "property_country",
    "houseregion": "property_city",
    "housezipcode": "property_zip",
    "houselatitude": "property_lat",
    "houselongitude": "property_lng",
    "housephone": "property_phone",
    "emergencycontact": "emergency_contact",
    "securitydeposit": "security_deposit",
    "keycode": "door_code",
    "doorcode": "door_code",
    # Freitexte (0298)
    "checkininstructions": "checkin_instructions",
    "checkoutinstructions": "checkout_instructions",
    "doorinstructions": "door_instructions",
    # Lodgify kennt zwei Namen für die Anfahrt — wir führen EINEN Text.
    "housedirections": "directions",
    "rentaldirections": "directions",
    "rentalrules": "house_rules",
    "localguide": "local_guide",
    # WLAN (0296)
    "wifiinformation": "wifi",
    "wifi_information": "wifi",
    "wifiname": "wifi_ssid",
    "wifipassword": "wifi_password",
    # Betrieb / Bank
    "ownername": "company_name",
    "ownerurl": "company_website",
    "bankiban": "bank_iban",
    "bankswift": "bank_bic",
    "bankname": "bank_name",
    "banktransferrecipient": "bank_holder",
    "bankaccounttext": "payment_text",
    "banktransferpaymentibantemplate": "bank_details",
    "banktransferpaymentothertemplate": "bank_details",
    "taxespercentage": "tax_rate",
    # Positionen der Buchung. Lodgify unterscheidet „Template" (fertige Zeilen)
    # von „Total" (nur die Summe) — beides bilden wir ab; die
    # Prozent-/Nacht-Varianten laufen auf denselben Wert, weil unsere
    # Positionen als Betrag gespeichert sind, nicht als Rechenregel.
    "addonsdescription": "addons",
    "addondescriptionstemplate": "addons",
    "addonstotal": "addons_total",
    "addonstotaltemplate": "addons_total",
    "misccharges": "addons",
    "misccharsesnightlyamount": "addons_total",
    "miscchargesnightlyamount": "addons_total",
    "miscchargespercentage": "addons_total",
    "cleaningcharge": "cleaning_fee",
    "taxes": "taxes",
    "taxesnightlyamount": "taxes",
    "securitydepositpercentage": "security_deposit",
    "paymentlink": "payment_link",
    "creditcardpaymenttemplate": "payment_link",
}


def aufloesen_schluessel(roh: str) -> str:
    """Geschriebener Name → unser Katalog-Schlüssel.

    Erst wörtlich (der Normalfall), dann über die Alt-Namen-Tabelle. Unbekanntes
    kommt unverändert zurück und wird vom Aufrufer als unbekanntes Feld
    behandelt — kein stilles Verschlucken.
    """
    if roh in NACH_SCHLUESSEL:
        return roh
    return _ALTNAMEN.get(roh.lower().replace("-", "_"), roh)

# Früher stand `children` hier, damit „0 Kinder" als Aussage durchgeht. Das war
# überflüssig und schädlich zugleich: die Prüfung darunter fragt `wert is None`,
# und 0 ist nicht None — eine echte Null kam also ohnehin durch. Der Eintrag
# griff einzig, wenn die Kinderzahl GAR NICHT geliefert wurde (OTA-Payload ohne
# `occupancy.children`), und machte daraus die Behauptung „mit 0 Kindern"
# (Wurzel 4: kein erfundener Ersatzwert). Fehlt die Angabe, fehlt sie — dann
# meldet der Versand das Feld wie jedes andere.
_NULL_IST_GUELTIG: frozenset[str] = frozenset()


def benutzte_felder(text: str) -> list[str]:
    """Alle Feldschlüssel, die im Text vorkommen (Reihenfolge, ohne Dubletten).

    Ein im Editor über zwei Absätze zerrissener Name kommt hier ZUSAMMENGEZOGEN
    an („{{guest\\n\\n_name}}" → „guest_name") — sonst gälte er weder als
    bekannt noch als unbekannt und der Gast läse den Rohtext.
    """
    gesehen: list[str] = []
    for treffer in MUSTER.findall(text or ""):
        name = _schluessel_normalisieren(treffer)
        if name and name not in gesehen:
            gesehen.append(name)
    return gesehen


def unbekannte_felder(text: str) -> list[str]:
    """Benutzte Schlüssel, die es im Katalog nicht gibt. Beim Speichern einer
    Vorlage/Automation ein 422 wert: ein Tippfehler soll auffallen, solange der
    Autor davorsitzt — nicht Wochen später beim Versand an einen Gast."""
    return [
        f
        for f in benutzte_felder(text)
        if aufloesen_schluessel(f) not in NACH_SCHLUESSEL
    ]


def rendern(text: str, kontext: Kontext) -> str:
    """Platzhalter ersetzen. Wirft :class:`FeldFehlt`, wenn ein benutztes Feld
    für diesen Vorgang keinen Wert hat.

    Ein Schlüssel, den der Katalog nicht kennt, bleibt unverändert stehen statt
    zu werfen: beim Speichern ist er bereits abgewiesen worden, und eine von
    Hand getippte Nachricht, die zufällig `{{...}}` enthält, soll nicht am
    Versand scheitern.
    """
    fehlt: list[str] = []
    werte: dict[str, str] = {}
    for geschrieben in benutzte_felder(text):
        # Der Name im Text kann ein Alt-Name sein („WifiInformation"); ersetzt
        # wird trotzdem unter dem GESCHRIEBENEN Namen, denn genau der steht im
        # Text und muss verschwinden.
        schluessel = aufloesen_schluessel(geschrieben)
        feld = NACH_SCHLUESSEL.get(schluessel)
        if feld is None:
            continue
        wert = feld.aufloesen(kontext)
        if wert is None and schluessel not in _NULL_IST_GUELTIG:
            fehlt.append(schluessel)
            continue
        werte[geschrieben] = str(wert)
    if fehlt:
        raise FeldFehlt(fehlt)
    # Nachgeschlagen wird der NORMALISIERTE Name, ersetzt der ROHE Treffer —
    # ein zerrissenes „{{guest\\n\\n_name}}" verschwindet damit vollständig, statt
    # seinen zweiten Teil im Text stehen zu lassen.
    return MUSTER.sub(
        lambda m: werte.get(_schluessel_normalisieren(m.group(1)), m.group(0)), text
    )
