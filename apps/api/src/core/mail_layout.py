"""Das Layout jeder ausgehenden E-Mail — EINE Quelle der Wahrheit.

Bis hierher gingen alle Mails als nackter Text raus: kein Logo, keine Fußzeile,
keine Pflichtangaben. Dieses Modul baut aus einem Inhalt (`MailInhalt`) BEIDE
Teile einer Mail: das HTML und die dazu passende Text-Alternative. Jeder
Absender im Repo geht durch `mail_rendern()` — es gibt bewusst keine zweite
Stelle, an der ein Mail-Rumpf entsteht.

WARUM TABELLEN UND INLINE-STYLES (und nicht modernes CSS):
Outlook 2016/2019/2021 rendert mit der Word-Engine — kein Flexbox, kein Grid,
keine `<style>`-Kaskade, auf die man sich verlassen könnte. Ein Tabellen-Layout
mit ausschließlich inline gesetzten Eigenschaften ist der einzige Aufbau, der in
Apple Mail, Gmail (Web/App) und Outlook gleich ankommt. Die 600 px Breite sind
der Standardwert, unter dem keine Vorschauspalte umbricht.

WARUM DAS LOGO ALS CID-ANHANG MITREIST (und nicht als URL):
Drei Wege standen zur Wahl. Ein Data-URI (`src="data:image/png;base64,…"`) wird
von Gmail und Outlook schlicht verworfen — das Bild erscheint nie. Eine
gehostete URL ergibt die kleinste Mail, setzt aber einen öffentlich erreichbaren
Host mit gültigem Zertifikat voraus. Genau daran scheiterte der erste Versuch,
live belegt am 08.08.2026: die Testmail zeigte in Apple Mail nur den leeren
Rahmen. Nachgemessen ergab sich zweierlei — `www.mynextdays.com` liefert das
Logo zwar mit 200/image/png aus, die damals für den Marktplatz eingetragene
Adresse antwortete aber mit einem SELBSTSIGNIERTEN Zertifikat, und kein
Mail-Client lädt darüber ein Bild. Dazu kommt, dass lokal und auf Staging
überhaupt keine öffentliche Adresse existiert. Eine Einbindung, die nur in einer
von drei Umgebungen und nur für eine von zwei Marken funktioniert, ist keine.
Nachtrag 17.08.2026: jene Adresse war eine `.com` und gehört uns nicht (fremder
Registrar). Der Marktplatz myBestDays läuft unter **`mybestdays.dk`** — `.dk` ist
Pflicht, `.com` ist für diese Marke in der Konfiguration immer ein Fehler. Der
Messwert bleibt gültig, nur seine Deutung war falsch; am Ergebnis ändert es
nichts: der CID-Anhang bleibt der einzige Weg ohne Host-Abhängigkeit.

Der CID-Anhang hat diese Abhängigkeit nicht: das Bild liegt IN der Mail, braucht
keinen erreichbaren Host, kein Zertifikat und keine konfigurierte Domain — es
funktioniert lokal, auf Staging und in Produktion gleich. Der Preis sind ~90 KB
je Mail; das ist bei transaktionalen Einzelmails ohne Belang.

Unabhängig vom Weg bleibt das Layout so gebaut, dass es OHNE das Bild
vollständig funktioniert: der `alt`-Text trägt den Markennamen, und keine
Aussage der Mail steht nur im Bild.

HELL/DUNKEL:
Apple Mail invertiert dunkle Darstellung eigenmächtig. Der Kopf bekommt deshalb
eine eigene, dunkle Fläche mit der hellen Logo-Variante darauf — die trägt in
BEIDEN Modi, weil die Fläche selbst gesetzt ist und nicht vom Client kommt. Ein
Logo auf transparentem Weiß wäre nach der Invertierung unsichtbar.

Wurzeln (CLAUDE.md):
- W4: Firmen-/Registerdaten werden NICHT im Code erfunden. Sie kommen aus
  `Settings` (ENV). Fehlen sie, entfällt der jeweilige Block — es wird nie eine
  plausible Adresse oder CVR-Nummer eingesetzt. Fehlt die Firmierung ganz, ist
  das ein Konfigurationsfehler und die Fußzeile sagt das, statt zu schweigen.
- W8: JEDER eingesetzte Wert (Name, Freitext, Betreff, URL) läuft durch
  `escape()` bzw. die URL-Prüfung. Ein Nutzername `<script>` ergibt hier Text,
  keine Injektion. Link-Ziele akzeptieren nur http(s)/mailto — ein
  `javascript:`-Ziel wird abgewiesen, nicht „bereinigt".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from html import escape
from pathlib import Path
from urllib.parse import urlsplit

from src.core.config import Settings, get_settings
from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import text

# Breite des Inhalts. 600 px ist der Wert, unter dem keine gängige
# Vorschauspalte umbricht; darüber schneidet Outlooks Lesebereich ab.
_BREITE = 600

# Erlaubte Schemata für JEDES Link-Ziel in einer Mail (W8). Ein `javascript:`-
# oder `data:`-Ziel wird abgewiesen, nicht stillschweigend entschärft: eine
# solche URL entsteht nur durch einen Fehler oder einen Angriff, und beides
# soll auffallen statt in einer halb funktionierenden Mail zu landen.
_ERLAUBTE_SCHEMATA = frozenset({"http", "https", "mailto"})

# Schriftstapel ohne Webfont: Mail-Clients laden keine externen Schriften
# (und ein `@font-face` würde bei Gmail ohnehin entfernt). Die Liste trifft auf
# jedem Zielsystem eine vorhandene Schrift.
_SCHRIFT = (
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
)


def _feld(quelle: object, name: str) -> str:
    """Ein Konfigurationsfeld als getrimmter String — oder leer.

    Nimmt NUR echte Strings an. Alles andere (None, eine Zahl, ein Testdouble)
    gilt als „nicht gesetzt" und ergibt einen Leerstring, worauf die betroffene
    Fußzeile entfällt. Der Grund ist Wurzel 4 in ihrer strengen Lesart: ein
    Wert, der kein Text ist, ist keine Anbieterangabe — ihn per `str()` in die
    Mail zu zwingen würde eine Zeichenkette wie `<MagicMock …>` oder `None` als
    Firmensitz ausgeben. Eine fehlende Zeile ist ehrlich, eine falsche nicht.
    """
    wert = getattr(quelle, name, "")
    return wert.strip() if isinstance(wert, str) else ""


class MailLayoutError(Exception):
    """Der Inhalt lässt sich nicht zu einer Mail rendern.

    Wird geworfen, wenn ein Link-Ziel kein erlaubtes Schema hat (W8) — nie, um
    fehlende Firmendaten zu melden: die sind ein Konfigurations-, kein
    Inhaltsfehler und werden über die Fußzeile sichtbar (siehe `_Fussdaten`).
    """


# Wurzel des Repos — von hier aus liegen die Logodateien der beiden Marken.
# `mail_layout.py` steht im Repo unter `apps/api/src/core/`, also vier Ebenen
# tiefer. Im Container gibt es diese Ebenen NICHT: das Image kopiert nur
# `apps/api` nach `/app`, die Datei liegt dort auf `/app/src/core/` und hat nur
# vier Vorfahren (Index 0–3). `parents[4]` warf deshalb beim IMPORT einen
# IndexError und riss den ganzen API-Prozess mit hoch — am 09.08.2026 live:
# uvicorn-Worker starteten in Dauerschleife, der Healthcheck blieb unhealthy.
# Fehlt die Ebene, gibt es hier keine Repo-Wurzel und damit keine Logos; das
# ist derselbe fail-soft-Fall, den `_logo_datei` ohnehin abfängt (Kopf zeigt
# den Markennamen als Text). Kein erfundener Ersatzpfad (Wurzel 4).
_PFAD = Path(__file__).resolve()
_REPO = _PFAD.parents[4] if len(_PFAD.parents) > 4 else None

# Die Logodateien. ACHTUNG, die beiden Marken legen sie UNTERSCHIEDLICH ab —
# derselbe Pfad für beide anzunehmen wäre falsch (am 08.08.2026 geprüft):
#   myNextDays → marketing/public/marketing/brand/  (nur im Repo-Checkout)
#   myBestDays → src/core/assets/  (IM Paket, also auch im Container)
# Die Asymmetrie ist seit dem 17.09.2026 gewollt. Der Marktplatz ist aus diesem
# Repo ausgezogen, seine Gast-Mails verschickt aber weiterhin dieses Backend —
# das Logo muss also mitreisen, statt an einem Pfad zu hängen, den es hier nicht
# mehr gibt. Nebeneffekt: die Marktplatz-Mail trägt ihr Logo damit ERSTMALS auch
# produktiv. Vorher lief `_REPO` im Container ins Leere (siehe oben) und der Kopf
# zeigte für beide Marken nur den Namen als Text.
# Verwendet wird jeweils die helle/negative Variante: sie sitzt im Layout auf
# einer schwarzen Kopffläche und ist nur hell lesbar.
#
# WARUM PNG UND NICHT DAS SVG (22.08.2026):
# Die neuen Marken-Assets liegen als SVG vor (`mnd_lockup_negativ.svg`). In einer
# E-Mail ist SVG jedoch nicht verwendbar: Gmail (Web und App) und Outlook zeigen
# es überhaupt nicht an — der Kopf wäre leer. Für Mails wird deshalb eine
# gerasterte Fassung desselben Vektors eingebettet:
# `mnd_lockup_negativ_mail.png` (980×176, aus `mnd_lockup_negativ.svg`
# gerendert). Sie trägt die dunkle Kopffläche #0a0a0a fest eingebrannt statt
# Transparenz — das ist Absicht: die Wortmarke ist in der Negativ-Fassung weiß,
# und ein Client, der einen transparenten PNG-Hintergrund hell unterlegt (Apple
# Mail im Hell-Modus tut das), würde weiße Schrift auf Weiß zeigen. Die Fläche
# der Mail ist an dieser Stelle ohnehin #0a0a0a, siehe `_kopf`.
#
# WARUM NICHT MEHR `mynextdays-logo-light.png`:
# In dieser Datei war der Zusatz „powered by AirSmil" ins Pixelbild eingebrannt.
# myNextDays ApS ist ein reines Softwarehaus; der Zusatz gehört nicht in die
# Kundenkommunikation — und dieses Logo ging als CID-Anhang an JEDEN Empfänger.
_LOGO_NEXTDAYS = (
    _REPO / "marketing/public/marketing/brand/mnd_lockup_negativ_mail.png"
    if _REPO is not None
    else None
)
_LOGO_BESTDAYS = _PFAD.parent / "assets" / "mybestdays-logo-light.png"

# Anzeigebreite des Logos in der Mail. Die Dateien sind deutlich breiter als
# das (myNextDays 980 px, myBestDays ~1470 px); bei 180 px Anzeige bleibt also
# mindestens das Fünffache an Pixeln übrig, das Logo ist auf Retina-Schirmen
# scharf. Ohne gesetzte Breite skaliert Apple Mail das Bild auf seine native
# Größe und sprengt das 600-px-Layout.
_LOGO_BREITE = 180

# Die Content-ID, unter der das Logo in der Mail hängt. Im HTML verweist
# `src="cid:…"` darauf. Der Wert ist fest und ohne spitze Klammern notiert —
# `MailService` setzt den Header daraus zusammen.
LOGO_CID = "nd-logo"


@dataclass(frozen=True, slots=True)
class Marke:
    """Die absendende Marke — myNextDays ODER myBestDays.

    Das Layout ist markenfähig statt doppelt vorhanden (CLAUDE.md „Zwei
    Marken"): Kopfbild, Name und Zielseite unterscheiden sich, der Aufbau
    nicht. Welche Marke gilt, entscheidet der Absender am Ereignis — eine
    Verwaltungsmail an den Betrieb ist myNextDays, eine Mail an einen Gast des
    Marktplatzes ist myBestDays.

    `logo_datei` ist ein PFAD, keine URL: das Logo wird als CID-Anhang in die
    Mail eingebettet (siehe `logo_anhang`). Fehlt die Datei, bleibt das Feld
    None und der Kopf trägt den Markennamen als Text.
    """

    name: str
    logo_datei: Path | None
    website_url: str


def marke_nextdays(settings: Settings | None = None) -> Marke:
    """Die Marke des PMS: Verwaltung, Kanalmanager, Abrechnung des Betriebs."""
    s = settings or get_settings()
    return Marke(
        name="myNextDays",
        logo_datei=_logo_datei(_LOGO_NEXTDAYS),
        website_url=_feld(s, "marketing_base_url").rstrip("/"),
    )


def marke_bestdays(settings: Settings | None = None) -> Marke:
    """Die Marke des Marktplatzes: alles, was Gast und Gastgeber dort sehen."""
    s = settings or get_settings()
    return Marke(
        name="myBestDays",
        logo_datei=_logo_datei(_LOGO_BESTDAYS),
        website_url=_feld(s, "marketplace_base_url").rstrip("/"),
    )


def _logo_datei(pfad: Path | None) -> Path | None:
    """Der Logopfad — oder None, wenn es ihn nicht gibt.

    Fail-soft und bewusst nicht fail-closed: ein fehlendes Logo ist ein
    Schönheitsfehler, kein Grund, eine Einladung oder einen Passwort-Reset
    nicht zuzustellen. Der Kopf zeigt dann den Markennamen als Text.

    `None` kommt herein, wenn schon die Repo-Wurzel fehlt (im Container liegt
    nur `apps/api` unter `/app`) — derselbe Fall wie eine fehlende Datei.
    """
    if pfad is None:
        return None
    return pfad if pfad.is_file() else None


@dataclass(frozen=True, slots=True)
class Aktion:
    """Der Call-to-Action einer Mail: ein Button mit Ziel.

    Der Text steht ZUSÄTZLICH als nackte URL in der Mail. Das ist kein
    Doppelgemoppel: ein Button ist in der Text-Alternative nicht klickbar, und
    manche Clients zeigen Buttons ohne Hintergrund — die URL im Klartext ist
    der Weg, der immer funktioniert.
    """

    text: str
    url: str


@dataclass(frozen=True, slots=True)
class MailInhalt:
    """Was in der Mail steht — ohne jede Formatierung.

    `absaetze` sind reiner Text; Absatzumbrüche macht das Layout. Wer hier HTML
    hineingibt, bekommt es escaped zurück (W8) — das ist Absicht: es gibt
    keinen Weg, aus einem Absender heraus Markup in eine Mail zu bringen.

    `hinweise` sind die kleiner gesetzten Nachsätze unter dem Hauptteil
    (Gültigkeitsdauer eines Links, „warst du das nicht"). `abmelde_url` setzt
    die Abmeldezeile in die Fußzeile — sie gehört AUSSCHLIESSLICH an
    Marketing-Mails: eine Einladung oder ein Passwort-Reset ist transaktional,
    von so einer Mail kann und darf sich niemand abmelden.

    `sprache` bestimmt NICHT nur das `lang`-Attribut, sondern auch jedes Wort,
    das dieses Modul selbst beisteuert: Gruß, Absenderzeile, „Falls der Button
    nicht funktioniert", Impressum/Datenschutz/Abmelden. Vorher standen die
    hart deutsch hier — eine dänische Mail hatte damit einen deutschen Gruß und
    eine deutsche Fußzeile. Die Wörter kommen aus `core.mail_texte`; die
    SPRACHE selbst löst der Absender über `core.mail_empfaenger` auf.

    `gruss=None` heißt „nimm den Gruß der Sprache" (der Normalfall). Nur wer
    bewusst etwas anderes will (die Bewertungsmail sagt „Vielen Dank!" statt
    „Viele Grüße"), setzt hier einen eigenen Text — dann ist er allerdings
    selbst dafür zuständig, dass er in der richtigen Sprache steht.
    """

    titel: str
    absaetze: list[str]
    aktion: Aktion | None = None
    hinweise: list[str] = field(default_factory=list)
    gruss: str | None = None
    absender_zeile: str | None = None
    abmelde_url: str | None = None
    sprache: str = FALLBACK
    # Optionales Bild über der Überschrift (Angebotsmail: Titelbild des Objekts,
    # 0701). Eine externe URL, kein CID-Anhang: Objektfotos liegen im Storage,
    # nicht im Repo. Blockiert ein Client Bilder, bleibt der alt-Text — die Mail
    # verliert Optik, keine Aussage. Die Textfassung kennt das Bild nicht.
    bild_url: str | None = None
    bild_alt: str = ""


@dataclass(frozen=True, slots=True)
class GerenderteMail:
    """Das Ergebnis: beide Darstellungen derselben Nachricht.

    `logo_datei` ist das Bild, das als CID-Anhang mitgeschickt werden MUSS,
    damit der `cid:`-Verweis im HTML ein Ziel hat. Ist es None, kommt das HTML
    ohne `<img>` aus — dann darf auch nichts angehängt werden.
    """

    text: str
    html: str
    logo_datei: Path | None = None

    @property
    def inline_bilder(self) -> dict[str, Path]:
        """Die Bilder für `OutboundMessage.inline_bilder` — fertig zugeordnet.

        Absender geben das Ergebnis unverändert weiter, statt die Content-ID
        selbst zu kennen: der `cid:`-Verweis im HTML und der Anhang müssen
        zusammenpassen, und diese Kopplung gehört an EINE Stelle. Sonst
        entstünde ein leerer Bildrahmen, sobald ein Absender den Anhang
        vergisst — genau der Fehler, der am 08.08.2026 live auftrat.
        """
        return {LOGO_CID: self.logo_datei} if self.logo_datei else {}


def mail_rendern(
    inhalt: MailInhalt,
    *,
    marke: Marke | None = None,
    settings: Settings | None = None,
) -> GerenderteMail:
    """Baut HTML UND Text-Alternative aus einem Inhalt.

    Beide Teile entstehen aus DERSELBEN Quelle. Getrennt gepflegte Fassungen
    laufen sonst auseinander — und die Text-Fassung ist kein Beiwerk: Clients
    mit abgeschalteter HTML-Darstellung zeigen sie, und ein zu dünner Textteil
    verschlechtert die Spam-Bewertung (das Verhältnis Text zu HTML ist ein
    gewichtetes Merkmal gängiger Filter).
    """
    s = settings or get_settings()
    m = marke or marke_nextdays(s)
    fuss = _Fussdaten.aus_settings(s)
    _pruefe_links(inhalt)
    return GerenderteMail(
        text=_text_bauen(inhalt, m, fuss),
        html=_html_bauen(inhalt, m, fuss),
        logo_datei=m.logo_datei,
    )


# -- Firmendaten ------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class _Fussdaten:
    """Die rechtlichen Pflichtangaben der Fußzeile.

    QUELLE: ausschließlich `Settings` (ENV). Die Werte im Code zu hinterlegen
    hieße, dass eine Registeränderung (Sitz, Direktion, Momsregistrierung) ein
    Code-Deploy braucht und dass zwei Wahrheiten nebeneinander stehen — die
    Rechtstexte der Frontends ziehen ihre Angaben bereits aus einer eigenen
    Datei (`marketing/content/legal/anbieter.ts`, gegen cvrapi.dk geprüft).
    Der Betrieb setzt dieselben Werte hier als ENV; fehlen sie, entfällt die
    betroffene Zeile. Es wird NIE eine Adresse oder CVR-Nummer erfunden (W4).

    `ust_id` ist bewusst optional und getrennt von `cvr`: die CVR-Nummer ist
    8-stellig und existiert ab Gründung, die Umsatzsteuer-Identifikationsnummer
    (Momsnummer, „DK" + CVR) gibt es erst mit der Momsregistrierung. § 7 der
    dänischen e-handelslov verlangt sie NUR, wenn sie besteht — eine nicht
    existierende Nummer zu veröffentlichen wäre falsch.
    """

    firma: str
    rechtsform: str
    strasse: str
    ort: str
    land: str
    cvr: str
    ust_id: str
    email: str
    telefon: str
    impressum_url: str
    datenschutz_url: str

    @classmethod
    def aus_settings(cls, s: Settings) -> _Fussdaten:
        basis = _feld(s, "marketing_base_url").rstrip("/")
        return cls(
            firma=_feld(s, "company_legal_name"),
            rechtsform=_feld(s, "company_legal_form"),
            strasse=_feld(s, "company_street"),
            ort=_feld(s, "company_city"),
            land=_feld(s, "company_country"),
            cvr=_feld(s, "company_registration_number"),
            ust_id=_feld(s, "company_vat_id"),
            email=_feld(s, "company_contact_email"),
            telefon=_feld(s, "company_contact_phone"),
            impressum_url=f"{basis}/impressum" if basis else "",
            datenschutz_url=f"{basis}/datenschutz" if basis else "",
        )

    @property
    def konfiguriert(self) -> bool:
        """Mindestens die Firmierung muss stehen, sonst gibt es keine Angabe.

        Ohne Firmennamen ist jede weitere Zeile sinnlos — eine Adresse ohne
        Rechtsträger benennt niemanden.
        """
        return bool(self.firma)

    def anschrift(self) -> str:
        """Eine Zeile: Firma, Rechtsform, Straße, Ort, Land — ohne Lücken."""
        teile = [
            t
            for t in (self.firma, self.rechtsform, self.strasse, self.ort, self.land)
            if t
        ]
        return " · ".join(teile)

    def register(self) -> str:
        """Register- und Steuerangaben — jede nur, wenn vorhanden."""
        teile = []
        if self.cvr:
            teile.append(f"CVR-nr. {self.cvr}")
        if self.ust_id:
            teile.append(f"USt-IdNr. {self.ust_id}")
        return " · ".join(teile)

    def kontakt(self) -> str:
        """Kontaktkanäle — jeder nur, wenn hinterlegt."""
        return " · ".join(t for t in (self.email, self.telefon) if t)


# Steht in der Fußzeile, wenn die Firmendaten NICHT konfiguriert sind. Bewusst
# als sichtbarer Satz statt als stille Leerstelle: eine geschäftliche Mail ohne
# Anbieterangabe ist ein Mangel, und ein leerer Fuß sähe aus wie Absicht. So
# fällt es beim ersten Blick in eine Testmail auf (W4: klar benennen, nichts
# erfinden).
_FUSS_FEHLT = (
    "Anbieterangaben sind auf diesem Server nicht hinterlegt "
    "(COMPANY_LEGAL_NAME fehlt)."
)


# -- Link-Prüfung (W8) ------------------------------------------------------


def _pruefe_links(inhalt: MailInhalt) -> None:
    """Jedes Link-Ziel der Mail gegen die Schema-Allowlist prüfen.

    Fail-closed: ein unbekanntes Schema führt zum Fehler, nicht zu einer Mail
    mit entschärftem Link. Ein `javascript:`-Ziel in einer Mail entsteht nicht
    versehentlich — es wäre der Rest eines Angriffs auf eine Eingabe, die
    ungeprüft bis hierher durchgereicht wurde.
    """
    ziele = []
    if inhalt.aktion:
        ziele.append(inhalt.aktion.url)
    if inhalt.abmelde_url:
        ziele.append(inhalt.abmelde_url)
    for url in ziele:
        _pruefe_url(url)


def _pruefe_url(url: str) -> str:
    """Gibt die URL zurück, wenn ihr Schema erlaubt ist — sonst Fehler."""
    schema = urlsplit((url or "").strip()).scheme.lower()
    if schema not in _ERLAUBTE_SCHEMATA:
        msg = (
            f"Unerlaubtes Link-Schema in einer E-Mail: {schema or '(keines)'!r}. "
            f"Erlaubt sind {sorted(_ERLAUBTE_SCHEMATA)}."
        )
        raise MailLayoutError(msg)
    return url.strip()


# -- Text-Alternative -------------------------------------------------------


def _text_bauen(inhalt: MailInhalt, marke: Marke, fuss: _Fussdaten) -> str:
    """Die reine Textfassung — vollwertig, nicht als Notnagel gedacht.

    Sie enthält dieselben Aussagen wie das HTML, inklusive Link-Ziel und
    Fußzeile. Wer sie liest, hat nichts weniger als der HTML-Leser.
    """
    sprache = inhalt.sprache
    zeilen: list[str] = [inhalt.titel, ""]
    for absatz in inhalt.absaetze:
        zeilen.extend((absatz, ""))
    if inhalt.aktion:
        zeilen.extend((f"{inhalt.aktion.text}:", inhalt.aktion.url, ""))
    for hinweis in inhalt.hinweise:
        zeilen.extend((hinweis, ""))
    zeilen.append(inhalt.gruss or text("layout.gruss", sprache))
    zeilen.append(
        inhalt.absender_zeile
        or text("layout.absender", sprache, marke=marke.name)
    )

    zeilen.extend(("", "—", ""))
    if fuss.konfiguriert:
        for teil in (fuss.anschrift(), fuss.register(), fuss.kontakt()):
            if teil:
                zeilen.append(teil)
    else:
        zeilen.append(_FUSS_FEHLT)
    if fuss.impressum_url:
        zeilen.append(f"{text('layout.impressum', sprache)}: {fuss.impressum_url}")
    if fuss.datenschutz_url:
        zeilen.append(
            f"{text('layout.datenschutz', sprache)}: {fuss.datenschutz_url}"
        )
    if inhalt.abmelde_url:
        zeilen.append(f"{text('layout.abmelden', sprache)}: {inhalt.abmelde_url}")
    return "\n".join(zeilen).rstrip() + "\n"


# -- HTML -------------------------------------------------------------------


def _html_bauen(inhalt: MailInhalt, marke: Marke, fuss: _Fussdaten) -> str:
    """Die HTML-Fassung: Tabellen, Inline-Styles, 600 px.

    Der `<style>`-Block trägt NUR das, was inline nicht geht (Media Query für
    schmale Schirme, `color-scheme` für die Dark-Mode-Erkennung). Alles
    Layout-Relevante steht inline, weil Gmail den Block je nach Weg entfernt.
    """
    kopf = _kopf(marke)
    rumpf = _rumpf(inhalt, marke)
    fusszeile = _fuss(inhalt, fuss)
    titel = escape(inhalt.titel)
    # `lang` MUSS die Sprache des Textes nennen — Screenreader wählen danach
    # ihre Aussprache. Hier stand `or "de"`: war `sprache` leer, behauptete das
    # Dokument „deutsch", während der Text aus dem Katalog längst englisch war
    # (Wurzel 4). `MailInhalt.sprache` trägt bereits FALLBACK als Vorgabe, ein
    # zweiter Ersatzwert an dieser Stelle kann daher nur falsch sein.
    sprache = escape(inhalt.sprache or FALLBACK)
    return f"""<!DOCTYPE html>
<html lang="{sprache}" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{titel}</title>
<style>
  :root {{ color-scheme: light dark; supported-color-schemes: light dark; }}
  @media only screen and (max-width:620px) {{
    .nd-huelle {{ width:100% !important; }}
    .nd-pad {{ padding-left:24px !important; padding-right:24px !important; }}
    .nd-btn a {{ display:block !important; text-align:center !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f4f4f5;
 -webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
{escape(_vorschautext(inhalt))}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
 style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="nd-huelle" width="{_BREITE}" cellpadding="0"
 cellspacing="0" border="0"
 style="width:{_BREITE}px;max-width:100%;background-color:#ffffff;
 border-radius:12px;overflow:hidden;">
{kopf}
{rumpf}
{fusszeile}
</table>
</td></tr>
</table>
</body>
</html>
"""


def _vorschautext(inhalt: MailInhalt) -> str:
    """Der Text, den die Postfach-Liste unter dem Betreff zeigt.

    Ohne ihn zeigen Gmail und Apple Mail den Anfang des HTML-Rumpfs — bei
    diesem Layout also den Markennamen aus dem Logo-`alt`, bei jeder Mail
    denselben. Der erste Absatz ist die bessere Auskunft.
    """
    return inhalt.absaetze[0] if inhalt.absaetze else inhalt.titel


def _kopf(marke: Marke) -> str:
    """Kopfbereich: Logo mittig auf dunkler Fläche.

    Die Fläche ist gesetzt und wird nicht vom Client gestellt — dadurch trägt
    die helle Logo-Variante in hellem UND dunklem Modus. Fehlt die Logodatei,
    steht der Markenname als Text an derselben Stelle: die Mail verliert Optik,
    keine Aussage.

    Die Breite steht als HTML-Attribut UND im Inline-Style: Outlook liest das
    Attribut, moderne Clients den Style, und ohne beides skaliert Apple Mail
    das Bild auf seine native Größe (~1000 px und mehr) und sprengt das Layout.
    Die Höhe bleibt `auto`, damit das Seitenverhältnis erhalten bleibt.

    Der `alt`-Text ist bewusst gestylt: bei blockierten Bildern zeigen die
    Clients ihn an derselben Stelle an — ohne Farbangabe stünde dunkler
    Standardtext auf der schwarzen Fläche und wäre unlesbar.
    """
    name = escape(marke.name)
    if marke.logo_datei is not None:
        bild = (
            f'<img src="cid:{LOGO_CID}" alt="{name}" '
            f'width="{_LOGO_BREITE}" '
            f'style="display:block;border:0;outline:none;text-decoration:none;'
            f"width:{_LOGO_BREITE}px;max-width:60%;height:auto;"
            f'font-family:{_SCHRIFT};font-size:20px;font-weight:600;'
            f'color:#ffffff;">'
        )
        inneres = (
            f'<a href="{escape(marke.website_url, quote=True)}" '
            f'style="text-decoration:none;">{bild}</a>'
            if marke.website_url
            else bild
        )
    else:
        inneres = (
            f'<span style="font-family:{_SCHRIFT};font-size:22px;'
            f'font-weight:600;color:#ffffff;">{name}</span>'
        )
    return f"""<tr>
<td align="center" style="background-color:#0a0a0a;padding:28px 32px;">
{inneres}
</td>
</tr>"""


def _rumpf(inhalt: MailInhalt, marke: Marke) -> str:
    """Der Inhaltsbereich: Überschrift, Absätze, Button, Hinweise, Gruß."""
    teile: list[str] = []
    if inhalt.bild_url and inhalt.bild_url.startswith("https://"):
        teile.append(
            f'<img src="{escape(inhalt.bild_url, quote=True)}" '
            f'alt="{escape(inhalt.bild_alt, quote=True)}" width="520" '
            f'style="display:block;border:0;outline:none;width:100%;max-width:520px;'
            f'height:auto;border-radius:12px;margin:0 0 20px 0;">'
        )
    teile.append(
        f'<h1 style="margin:0 0 20px 0;font-family:{_SCHRIFT};font-size:22px;'
        f'line-height:1.3;font-weight:600;color:#0a0a0a;">'
        f"{escape(inhalt.titel)}</h1>"
    )
    for absatz in inhalt.absaetze:
        teile.append(
            f'<p style="margin:0 0 16px 0;font-family:{_SCHRIFT};font-size:16px;'
            f'line-height:1.6;color:#27272a;">{escape(absatz)}</p>'
        )
    if inhalt.aktion:
        teile.append(_button(inhalt.aktion, inhalt.sprache))
    for hinweis in inhalt.hinweise:
        teile.append(
            f'<p style="margin:0 0 12px 0;font-family:{_SCHRIFT};font-size:14px;'
            f'line-height:1.6;color:#71717a;">{escape(hinweis)}</p>'
        )
    gruss = inhalt.gruss or text("layout.gruss", inhalt.sprache)
    absender = inhalt.absender_zeile or text(
        "layout.absender", inhalt.sprache, marke=marke.name
    )
    teile.append(
        f'<p style="margin:24px 0 0 0;font-family:{_SCHRIFT};font-size:16px;'
        f'line-height:1.6;color:#27272a;">{escape(gruss)}<br>'
        f"{escape(absender)}</p>"
    )
    inneres = "\n".join(teile)
    return f"""<tr>
<td class="nd-pad" style="background-color:#ffffff;padding:32px 40px 36px 40px;">
{inneres}
</td>
</tr>"""


def _button(aktion: Aktion, sprache: str) -> str:
    """Der Call-to-Action als Tabellenzelle mit Hintergrund — kein `<button>`.

    Ein echtes Button-Element gibt es in E-Mail nicht; ein `<div>` mit
    Hintergrund fällt in Outlook in sich zusammen. Eine einzellige Tabelle mit
    `bgcolor` ist der Aufbau, der überall als Fläche ankommt. Die URL steht
    darunter zusätzlich im Klartext: sie funktioniert auch dann, wenn der
    Client die Fläche verschluckt oder der Leser sie kopieren will.
    """
    url = escape(_pruefe_url(aktion.url), quote=True)
    # NICHT `text` nennen: das verdeckt die importierte Katalogfunktion.
    beschriftung = escape(aktion.text)
    roh = escape(aktion.url)
    return f"""<table role="presentation" class="nd-btn" cellpadding="0"
 cellspacing="0" border="0" style="margin:8px 0 20px 0;">
<tr>
<td align="center" bgcolor="#b82028" style="border-radius:9999px;">
<a href="{url}" style="display:inline-block;padding:14px 32px;
 font-family:{_SCHRIFT};font-size:16px;font-weight:600;color:#ffffff;
 text-decoration:none;border-radius:9999px;">{beschriftung}</a>
</td>
</tr>
</table>
<p style="margin:0 0 20px 0;font-family:{_SCHRIFT};font-size:13px;
 line-height:1.5;color:#71717a;word-break:break-all;">
{escape(text("layout.button_hinweis", sprache))}<br>
<a href="{url}" style="color:#b82028;">{roh}</a>
</p>"""


def _fuss(inhalt: MailInhalt, fuss: _Fussdaten) -> str:
    """Fußzeile mit den rechtlichen Pflichtangaben.

    Reihenfolge: Anschrift (Firma, Rechtsform, Sitz), Register-/Steuerangaben,
    Kontakt, dann die Links. Der Abmeldelink erscheint NUR, wenn der Absender
    einen mitgibt — er gehört an Marketing-Mails und nicht an eine Einladung
    oder einen Passwort-Reset (von einer transaktionalen Mail kann sich
    niemand abmelden, ein Link dorthin wäre eine falsche Zusage).
    """
    sprache = inhalt.sprache
    zeilen: list[str] = []
    if fuss.konfiguriert:
        for teil in (fuss.anschrift(), fuss.register(), fuss.kontakt()):
            if teil:
                zeilen.append(escape(teil))
    else:
        zeilen.append(escape(_FUSS_FEHLT))

    links = []
    if fuss.impressum_url:
        links.append(
            _fusslink(fuss.impressum_url, text("layout.impressum", sprache))
        )
    if fuss.datenschutz_url:
        links.append(
            _fusslink(fuss.datenschutz_url, text("layout.datenschutz", sprache))
        )
    if inhalt.abmelde_url:
        links.append(
            _fusslink(
                _pruefe_url(inhalt.abmelde_url), text("layout.abmelden", sprache)
            )
        )
    if links:
        zeilen.append(" &middot; ".join(links))

    inneres = "<br>".join(zeilen)
    return f"""<tr>
<td class="nd-pad" style="background-color:#fafafa;padding:24px 40px;
 border-top:1px solid #e4e4e7;">
<p style="margin:0;font-family:{_SCHRIFT};font-size:12px;line-height:1.7;
 color:#71717a;">{inneres}</p>
</td>
</tr>"""


def _fusslink(url: str, beschriftung: str) -> str:
    """Ein Link in der Fußzeile — Ziel geprüft, Beschriftung escaped.

    Der Parameter heißt bewusst NICHT `text`: dieses Modul importiert die
    Katalogfunktion `mail_texte.text`, und ein gleichnamiger Parameter würde
    sie innerhalb der Funktion verdecken.
    """
    return (
        f'<a href="{escape(_pruefe_url(url), quote=True)}" '
        f'style="color:#71717a;text-decoration:underline;">'
        f"{escape(beschriftung)}</a>"
    )
