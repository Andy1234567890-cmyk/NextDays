"""Geteilte Validatoren und Konstanten des site_config-Slice.

Ausgelagert aus ``schemas.py``, weil dieses mit den Abschnitten aus 0431/0432/
0436 über die Zeilengrenze gelaufen ist, die `pylint` hier setzt (1500) — und
weil ``block_inhalte.py`` genau diese Funktionen braucht. Läge sie weiter in
``schemas``, wäre der Import ein Zirkel:
``schemas`` → ``block_inhalte`` → ``schemas``.

Hier steht, WAS erlaubt ist: Link-Schemata, HTML-Allowlists, Sprachcodes,
Social-Netzwerke, das Format einer Google-Kennung, die Normalisierung eines
Weiterleitungs-Pfads. Jede dieser Prüfungen hat eine Begründung an ihrer
Funktion — sie sind alle einmal an einem echten Problem entstanden.

Enthält zusätzlich ``BlockType``: das Enum wird von ``block_inhalte`` (für die
Zuordnung Typ → Modell) und von ``schemas`` (für die API-Modelle) gebraucht.

Seit 0446/0447 steht hier auch die **Theme-Ebene** vollständig: Designfarben,
Text-Rollen, Breite und Abstand — Modelle, Validatoren UND die beiden
Mischklassen, von denen ``BrandingBase`` und ``PublicSiteResponse`` erben.
Sie liegen beieinander, weil sie eine Einheit sind (eine Farbrolle ohne die
Palette, an der sie hängt, ist sinnlos) — und weil ``schemas.py`` sonst über
die Zeilengrenze läuft, die `pylint` hier setzt.
"""

from __future__ import annotations

import re
import unicodedata
from enum import StrEnum

import nh3
from pydantic import BaseModel, Field, field_validator, model_validator

_HEX_RE = r"^#[0-9a-fA-F]{6}$"

# Erlaubte Link-Schemata für gast-sichtbare hrefs (W-2, Stored-XSS-Schutz):
# nur http(s)/mailto/tel + relative Pfade. `javascript:`/`data:`/`vbscript:`
# u. a. werden abgelehnt. Fail-closed (Wurzel 5).
_SAFE_HREF_SCHEMES = ("http://", "https://", "mailto:", "tel:")


# Allowlist für gast-sichtbares Rich-Text (TipTap-Ausgabe). Nur Formatierung,
# keine Skript-/Einbettungs-Vektoren. nh3 (ammonia) parst echtes HTML statt
# Regex → entfernt <script>/<svg>/onerror/unquotierte javascript:-hrefs zuverlässig.
_RICH_TEXT_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
    "ul", "ol", "li", "blockquote", "code", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6", "a", "span",
    # --- 0480: was der Beitrags-Editor zusätzlich schreibt --------------------
    # Der Editor des Blog-CMS (`web/components/website/blog/
    # tiptap-erweiterungen.ts`) kann mehr als der Rich-Text-Abschnitt. Jedes
    # Tag hier steht für einen Knopf dort — und umgekehrt: was hier fehlt,
    # verschwindet beim Speichern, und der Knopf wäre eine Attrappe.
    #
    # Was BEWUSST nicht dabei ist: `iframe` (YouTube — fremder Code auf der
    # Kundenseite) und `input` (Aufgabenliste — ein Eingabefeld im Beitrag
    # speichert nichts). Beide Erweiterungen sind deshalb auch im Editor nicht
    # geladen.
    "hr", "sub", "sup", "mark", "img",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
}
# `rel` NICHT hier — nh3 setzt es selbst via link_rel (sonst ValueError).
#
# `style` steht NUR an `span` und `p`/`h1`–`h6`: TipTap schreibt die Textfarbe
# als `<span style="color:…">` und die Ausrichtung als `style="text-align:…">`
# am Absatz. Weiter geht es nicht — `style` an einem Bild oder einer Tabelle
# wäre eine Fläche für Layout-Angriffe (Überdecken der Seite), ohne dass ein
# Knopf des Editors sie je erzeugen würde.
_RICH_TEXT_ATTRS = {
    "a": {"href", "title", "target"},
    "span": {"style"},
    "p": {"style"},
    "h1": {"style"}, "h2": {"style"}, "h3": {"style"},
    "h4": {"style"}, "h5": {"style"}, "h6": {"style"},
    "mark": {"data-color", "style"},
    # `src` wird von nh3 gegen `url_schemes` geprüft (http/https) — ein
    # `javascript:`- oder `data:`-Bild kommt damit nicht durch.
    "img": {"src", "alt", "title", "width", "height"},
    "th": {"colspan", "rowspan", "colwidth"},
    "td": {"colspan", "rowspan", "colwidth"},
}


def _sanitize_rich_html(value: dict[str, str]) -> dict[str, str]:
    """TipTap-HTML je Locale serverseitig mit echtem Allowlist-Parser säubern
    (W-1, Stored-XSS). Ersetzt den umgehbaren Regex-Sanitizer im Renderer als
    verbindlichen Backstop beim Speichern (Wurzel 5, fail-closed)."""
    return {
        locale: nh3.clean(
            html or "",
            tags=_RICH_TEXT_TAGS,
            attributes=_RICH_TEXT_ATTRS,
            url_schemes={"http", "https", "mailto", "tel"},
            link_rel="noopener noreferrer nofollow",
        )
        for locale, html in (value or {}).items()
    }


def ascii_slug(titel: str) -> str:
    """Titel → Slug aus a-z, 0-9 und Bindestrichen.

    Umlaute werden UMGESCHRIEBEN und nicht weggeworfen: aus „Verfügbarkeit"
    wird `verfuegbarkeit`, nicht `verf-gbarkeit`. Und sie bleiben auch nicht
    stehen — `str.isalnum()` haelt „ü" fuer alphanumerisch, also entstand vorher
    ein Slug mit Umlaut mitten in einem technischen Schluessel.

    Die Tabelle deckt Deutsch und die nordischen Sprachen ab, weil dort die
    Kunden sitzen; alles andere zerlegt `NFKD` (é → e). Was danach uebrig
    bleibt, wird zum Bindestrich.

    Steht in `basis.py` und nicht in `seiten.py`, weil sie mehrere Aufrufer
    hat (Seiten- und Beitrags-Slugs, 0438). Zwei Kopien der Regel wären zwei
    Fassungen desselben Slugs — und damit zwei Adressen für einen Inhalt.
    """
    ersatz = {
        "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
        "å": "aa", "æ": "ae", "ø": "oe",
    }
    vor = "".join(ersatz.get(c, c) for c in titel.strip().lower())
    zerlegt = unicodedata.normalize("NFKD", vor)
    nur_ascii = "".join(c for c in zerlegt if not unicodedata.combining(c))
    return "".join(
        c if (c.isascii() and c.isalnum()) else "-" for c in nur_ascii
    ).strip("-")


def _validate_href(value: str | None) -> str | None:
    """href/cta_href darf beim Gast-Klick kein Skript auslösen. Ein absoluter
    Link muss ein erlaubtes Schema tragen; relative Pfade (beginnen mit / oder #
    oder enthalten vor dem ersten / kein ':') sind erlaubt."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    lower = v.lower()
    if lower.startswith(_SAFE_HREF_SCHEMES):
        return v
    # Relativ/anchor: erlaubt, solange KEIN Schema (kein ':' vor dem ersten '/').
    scheme_sep = v.find(":")
    slash = v.find("/")
    is_relative = scheme_sep == -1 or (slash != -1 and slash < scheme_sep)
    if v.startswith(("/", "#", "?")) or is_relative:
        return v
    raise ValueError("Nicht erlaubtes Link-Schema (nur http(s)/mailto/tel/relativ).")


# Sprachen, in denen eine Kunden-Website stehen kann: die 24 EU-Amtssprachen.
# Muss mit `LOCALES` in `web/i18n/locales.ts` deckungsgleich sein — eine Sprache,
# für die es keine Oberfläche gibt, wäre eine halbe Website.
_SITE_LOCALES = frozenset(
    {
        "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
        "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
    }
)

def slug_pruefen(v: str) -> str:
    """Ein Seiten-Slug: klein, nur a-z/0-9/-, und KEIN Sprachkürzel.

    Warum die Sprachkürzel gesperrt sind (0476): die Adresse einer
    Sprachfassung ist ein Pfad-Präfix — `/da/kontakt` ist die dänische Fassung
    von `/kontakt`. Eine Seite mit dem Slug `da` wäre unter `/da` nicht mehr
    erreichbar: die Middleware liest das erste Segment als Sprache, schneidet
    es ab und sucht die Startseite.

    Das ist genau der Fehler, der niemandem auffällt, bevor er passiert — ein
    Betrieb legt eine Seite „es" für seine spanischen Angebote an, sie
    speichert sich anstandslos, und ab dann zeigt ihre Adresse etwas anderes.
    Deshalb 422 beim ANLEGEN und nicht ein Rätsel beim Aufrufen (Wurzel 5:
    fail-closed, statt eine Falschaussage auszuliefern).

    Betroffen sind nur die 24 Kürzel selbst. `dansk`, `de-angebote` oder
    `spanien` bleiben frei — gesperrt ist ausschließlich, was mit einem
    Sprachpräfix verwechselbar IST.
    """
    v = v.strip().lower()
    if v and not all(c.isalnum() or c == "-" for c in v):
        raise ValueError("Slug darf nur a-z, 0-9 und - enthalten.")
    if v in _SITE_LOCALES:
        raise ValueError(
            f"'{v}' ist ein Sprachkürzel und als Adresse reserviert — unter "
            f"/{v}/ liegt die {v}-Fassung der Website. Bitte einen anderen "
            "Slug wählen."
        )
    return v


# Tags, die im Kunden-HTML des <head> erlaubt sind.
#
# BEWUSST OHNE `script`: der Zweck dieses Feldes ist Verifizierung und
# Ressourcen-Verweise (google-site-verification, ein Preconnect, ein
# Canonical-Link). Für Code gibt es `custom_js`, und das lässt die
# Zahlungsstrecke aus. Wäre `script` hier erlaubt, wäre das HTML-Feld der Weg,
# an genau dieser Trennung vorbei ein Skript in den Checkout zu bekommen.
_HEAD_TAGS = frozenset({"meta", "link", "title"})

# `http-equiv` ist BEWUSST nicht dabei. Damit fällt `<meta http-equiv="refresh"
# content="0;url=…">` weg — eine Weiterleitung der ganzen Kundenseite, die als
# „Verifizierungs-Tag" getarnt in diesem Feld steht und beim nächsten Ansehen
# niemandem auffällt. Wer seine Seite weiterleiten will, tut das im DNS oder in
# der Domain-Einstellung, wo es sichtbar ist.
_HEAD_ATTRS: dict[str, set[str]] = {
    "meta": {"name", "property", "content", "charset"},
    "link": {"rel", "href", "type", "sizes", "crossorigin", "as", "media"},
    "title": set(),
}


def _validate_head_html(value: str | None) -> str | None:
    """Kunden-HTML für den <head> auf eine Tag-Allowlist einschränken.

    Mit `nh3` und nicht per Regex: HTML per Zeichenkettenprüfung zu säubern ist
    der Klassiker unter den umgehbaren Filtern (`<img/onerror=…` kommt an jedem
    `<script`-Verbot vorbei). `nh3` parst und baut neu — was nicht in der
    Allowlist steht, existiert danach nicht mehr.

    Wird der Inhalt dabei VOLLSTÄNDIG entfernt, ist das ein Fehler und kein
    stiller Erfolg: der Kunde hätte sonst ein leeres Feld gespeichert und würde
    den Grund nie erfahren (Wurzel 5)."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    sauber = nh3.clean(
        v,
        tags=set(_HEAD_TAGS),
        attributes={k: set(a) for k, a in _HEAD_ATTRS.items()},
        # Nur http(s): ein `javascript:` in einem link-href ist kein Verweis,
        # sondern Code.
        url_schemes={"http", "https"},
        # Kein `rel="noopener"` anhängen — das ist eine Regel für Links im
        # Seiteninhalt und hätte im <head> nichts zu bedeuten; sie würde nur ein
        # vom Kunden gesetztes `rel` überschreiben.
        link_rel=None,
    ).strip()
    if not sauber:
        raise ValueError(
            "Im Kopfzeilen-HTML sind nur <meta>, <link> und <title> erlaubt. "
            "Skripte gehören in das JavaScript-Feld."
        )
    # Hat der Parser Attribute VERWORFEN, ist das ein Fehler und kein Erfolg.
    #
    # Der Fall, der es nötig macht: `<link rel=stylesheet href="javascript:…">`
    # kommt als `<link rel="stylesheet">` zurück — sicher, aber sinnlos. Ohne
    # diese Prüfung hätte der Kunde einen Verweis ohne Ziel gespeichert und
    # nichts hätte ihm gesagt, dass sein href verworfen wurde (Wurzel 5).
    #
    # Das ist KEINE Säuberung per Zeichenkette (die wäre umgehbar), sondern ein
    # Vergleich NACH dem echten Parser: gezählt wird, ob gleich viele
    # Nutzlast-Attribute übrig sind.
    # `http-equiv` steht mit in der Liste, obwohl es kein Nutzlast-Attribut ist:
    # es ist nicht erlaubt, und ohne diese Zeile bliebe ein
    # `<meta http-equiv="refresh" content="…">` als wirkungsloses
    # `<meta content="…">` stehen — gespeichert, ohne Wirkung, ohne Hinweis.
    for attribut in ("href", "content", "src", "http-equiv"):
        if v.lower().count(attribut + "=") > sauber.lower().count(attribut + "="):
            raise ValueError(
                f"Ein {attribut}-Wert wurde verworfen — erlaubt sind nur "
                "vollständige http(s)-Adressen."
            )
    return sauber


def _validate_kein_html(value: str | None) -> str | None:
    """CSS-/JS-Feld: nur Länge und Leerraum, KEINE Struktur-Prüfung.

    Ein `</style>`-Ausbruch im CSS wäre ein Problem — der Renderer verhindert ihn
    dort, wo er entsteht, indem er den Inhalt nicht in ein Element schreibt,
    sondern über eine CSS-Datei-Route ausliefert. Hier zu „säubern" würde
    gültiges CSS zerstören (ein `>` im Selektor ist normal)."""
    if value is None:
        return None
    v = value.strip()
    return v or None


def _nur_text(value: str | None) -> str | None:
    """Alle Auszeichnung entfernen, den Text behalten.

    NICHT zu verwechseln mit ``_validate_kein_html`` darüber: das ist für CSS-
    und JS-Felder und schneidet nur Leerraum ab — der Name sagt, was das Feld
    NICHT enthalten soll, nicht was die Funktion tut. Genau diese Verwechslung
    ist beim Bau der Hinweisleiste (0440) passiert: `<script>alert(1)</script>`
    ging unverändert durch, und die Leiste steht über JEDER Seite.

    Hier wird mit demselben Allowlist-Parser gearbeitet wie beim Rich-Text, nur
    mit LEERER Erlaubnisliste: `nh3` entfernt jedes Element und behält den
    Textinhalt. Ein Regex wäre hier wieder die falsche Antwort — er sieht
    `<scr<script>ipt>` nicht.
    """
    if value is None:
        return None
    sauber = nh3.clean(value, tags=set(), attributes={}).strip()
    return sauber or None


def _nur_text_mehrsprachig(value: dict[str, str]) -> dict[str, str]:
    """``_nur_text`` über eine Sprachtabelle. Leere Werte bleiben leer."""
    return {
        locale: (_nur_text(text) or "") for locale, text in (value or {}).items()
    }


def _validate_locales(value: list[str] | None) -> list[str] | None:
    """Sprachliste prüfen: bekannte Codes, keine Dubletten, mindestens eine.

    Eine leere Liste wird zu `None` — „keine Sprache" ist kein gültiger Zustand
    für eine Website, „noch nicht gewählt" schon."""
    if value is None:
        return None
    gesehen: list[str] = []
    for roh in value:
        code = (roh or "").strip().lower()
        if not code:
            continue
        if code not in _SITE_LOCALES:
            raise ValueError(f"Unbekannte Sprache: {roh}")
        if code not in gesehen:
            gesehen.append(code)
    return gesehen or None


# Social-Netzwerke, die die Fußzeile der Kunden-Site rendert. Die Liste ist die
# Allowlist: ein unbekannter Schlüssel wird abgelehnt statt still gespeichert und
# nie angezeigt — sonst tippt der Kunde seinen Threads-Link ein, sieht ihn
# nirgends und hält den Baukasten für kaputt.
#
# Muss mit `SOCIAL` in `builder/components/site-footer.tsx` deckungsgleich sein.
_SOCIAL_KEYS = frozenset(
    {"instagram", "facebook", "youtube", "linkedin", "pinterest", "tiktok"}
)


def _validate_social(value: dict[str, str]) -> dict[str, str]:
    """Social-Links prüfen: bekannter Schlüssel, absolute http(s)-Adresse.

    Diese Werte landen ungeprüft in einem `href` der Gast-Fußzeile. Der Renderer
    hat einen eigenen Backstop, aber der Schutz gehört ans SPEICHERN — sonst
    liegt ein `javascript:`-Wert in der Datenbank und wartet auf die erste
    Anzeigestelle, die ihn ohne Prüfung ausgibt (Wurzel 8).

    Leere Werte werden entfernt, nicht als Leerstring gespeichert: „kein
    Instagram" ist das Fehlen des Schlüssels, nicht ein leerer Link."""
    out: dict[str, str] = {}
    for key, raw in (value or {}).items():
        if key not in _SOCIAL_KEYS:
            raise ValueError(f"Unbekanntes Netzwerk: {key}")
        v = (raw or "").strip()
        if not v:
            continue
        if not v.lower().startswith(("http://", "https://")):
            raise ValueError(
                f"{key}: nur vollständige http(s)-Adressen (z. B. https://…)."
            )
        out[key] = v
    return out


# Google-Tag-Kennungen: Analytics (G-), Altbestand (UA-), Ads (AW-),
# Campaign Manager (DC-). Derselbe Ausdruck steht als CHECK in der DB (0430) —
# hier, damit der Kunde eine Meldung bekommt statt eines 23514-Fehlers.
_GTAG_RE = r"^(G|UA|AW|DC)-[A-Za-z0-9-]{4,24}$"


def _validate_source_path(value: str) -> str:
    """Quellpfad einer Weiterleitung normalisieren.

    Hostaway lässt hier reihenweise Kunden auflaufen (ihre Fehlersuche listet
    sieben Ursachen, fünf davon sind Formfehler): volle Adresse statt Pfad,
    Query-Anhang, Schluss-Schrägstrich, Groß-/Kleinschreibung. Statt daraus eine
    Anleitung zu machen, wird hier normalisiert — was eindeutig gemeint ist,
    wird angenommen, alles andere klar abgelehnt.

    Was NICHT toleriert wird: eine fremde Domain. `https://fremd.de/x` als
    Quelle ist keine Weiterleitung dieser Website, sondern ein Missverständnis
    — und stillschweigend als Pfad `/x` zu deuten wäre geraten (Wurzel 4)."""
    v = (value or "").strip()
    if not v:
        raise ValueError("Quellpfad fehlt.")
    lower = v.lower()
    if lower.startswith(("http://", "https://")):
        raise ValueError(
            "Nur der Pfad, ohne Adresse: aus https://beispiel.de/alt wird /alt."
        )
    # Query und Anker abschneiden: der Renderer vergleicht ohnehin nur den Pfad,
    # weil `/seite` und `/seite?ref=mail` dieselbe Seite sind. Ein Kunde, der
    # `?ref=…` einträgt, meint die Seite — nicht „nur mit diesem Parameter".
    for trenner in ("?", "#"):
        if trenner in v:
            v = v.split(trenner, 1)[0]
    v = v.strip().lower()
    if not v.startswith("/"):
        v = "/" + v
    # Schluss-Schrägstrich weg, aber „/" selbst bleibt: die Startseite
    # weiterzuleiten ist zulässig (Umzug der ganzen Site).
    if len(v) > 1:
        v = v.rstrip("/") or "/"
    if len(v) > 500:
        raise ValueError("Quellpfad ist zu lang (max. 500 Zeichen).")
    return v


def _validate_redirect_target(value: str) -> str:
    """Ziel einer Weiterleitung: eigener Pfad oder absolute http(s)-Adresse.

    Die Schema-Prüfung ist hier keine Formalie: eine Weiterleitung schickt den
    Gast, der die KUNDENDOMAIN aufgerufen hat, irgendwohin. Ein `javascript:`
    oder `data:`-Ziel wäre ausführbarer Code unter fremdem Vertrauen — genau
    der Vektor aus Wurzel 8. Fail-closed: was nicht eindeutig erlaubt ist,
    wird abgelehnt."""
    v = (value or "").strip()
    if not v:
        raise ValueError("Ziel fehlt.")
    if v.lower().startswith(("http://", "https://")):
        if len(v) > 2000:
            raise ValueError("Ziel-Adresse ist zu lang (max. 2000 Zeichen).")
        return v
    if not v.startswith("/"):
        raise ValueError(
            "Ziel muss ein Pfad dieser Website (/neue-seite) oder eine "
            "vollständige https-Adresse sein."
        )
    if len(v) > 500:
        raise ValueError("Ziel-Pfad ist zu lang (max. 500 Zeichen).")
    return v


class BlockType(StrEnum):
    """Die ersten Block-Typen des Page-Builders. Erweiterbar (DB nutzt check,
    kein enum, damit weitere Typen ohne ALTER TYPE dazukommen können)."""

    hero = "hero"
    rich_text = "rich_text"
    image = "image"
    gallery = "gallery"
    button = "button"
    spacer = "spacer"
    contact = "contact"
    search = "search"
    properties_grid = "properties_grid"
    featured_properties = "featured_properties"
    reviews = "reviews"
    # 0431. Existiert nicht nur als Abschnitt: ohne ihn wäre der Schalter
    # „Fragen und Antworten" unter SEO → Strukturierte Daten wirkungslos, weil
    # ein `FAQPage`-JSON-LD Frage und Antwort GETRENNT braucht.
    faq = "faq"
    # 0432 — die drei, die auf fast jeder Unterkunfts-Website stehen.
    map = "map"
    testimonials = "testimonials"
    features = "features"
    # 0436 — ein echtes Formular. `contact` zeigt Kontaktdaten AN; hier tippt
    # der Gast etwas ein.
    form = "form"
    # 0438 — die letzten Blog-Beiträge auf einer Seite. Der Blog selbst hat
    # eine feste Route (/blog); dieser Abschnitt bringt ihn auf die Startseite.
    posts = "posts"
    # --- 0450: die Basis-Widgets, die Hostaway hat und wir nicht hatten -------
    # Reine Text-/Link-/Bild-Abschnitte. Keiner von ihnen holt etwas Fremdes
    # nach, keiner rendert Kunden-HTML ungefiltert — die Inhalte laufen durch
    # dieselbe Allowlist wie der Rest des Slice (`block_inhalte_basis.py`).
    accordion = "accordion"
    tabs = "tabs"
    countdown = "countdown"
    table = "table"
    list = "list"
    file = "file"
    copyright = "copyright"
    breadcrumbs = "breadcrumbs"
    # --- 0451: die Medien-Widgets --------------------------------------------
    # Zwei davon holen etwas von einem FREMDEN Host (Video, Audio). Die
    # Host-Allowlist und das Auslösen der Kennung stehen in
    # `block_inhalte_medien.py`; der Renderer setzt die Einbettungs-Adresse
    # selbst zusammen und reicht nie eine Kundeneingabe in ein `src` durch.
    media_slider = "media_slider"
    video = "video"
    audio = "audio"
    before_after = "before_after"
    shape = "shape"
    # --- 0452: die Business-Widgets ------------------------------------------
    # Betriebsdaten statt Gestaltung. Bei dreien ist das leere Feld der
    # Normalfall: dann gilt, was im Firmenprofil steht.
    business_hours = "business_hours"
    click_to_call = "click_to_call"
    click_to_email = "click_to_email"
    multi_location = "multi_location"
    # 0458 — die Beitragssuche. Ein eigener Typ neben `search` und kein
    # Schalter daran: `search` sucht OBJEKTE (Verfügbarkeit, Preis), dieser hier
    # sucht in den TITELN der Blog-Beiträge. Ein Abschnitt mit zwei
    # grundverschiedenen Betriebsarten sind zwei Abschnitte in einem.
    search_posts = "search_posts"

    # --- Objektseite (0468) ------------------------------------------------
    # Die Bausteine der dynamischen Objektseite. Sie ziehen ihre Inhalte aus dem
    # ANGEZEIGTEN Objekt, nicht aus dem Block — deshalb tragen sie kaum eigenen
    # Inhalt, sondern nur Darstellungsangaben.
    #
    # `property_book_form` ist der Buchungs-Block. Bei Hostaway heißt er
    # „Property book-form": Datumsfeld, Gästezahl, und zwei Knöpfe — Anfrage und
    # Buchen. Er ist bewusst NICHT auf die Objektseite beschränkt: ein Betrieb
    # mit EINEM Ferienhaus setzt ihn auf die Startseite.
    property_book_form = "property_book_form"
    property_gallery = "property_gallery"
    property_description = "property_description"
    property_amenities = "property_amenities"
    property_map = "property_map"

    # --- Struktur (0472) ----------------------------------------------------
    # Der einzige Typ, der KEINEN Inhalt trägt. Er steht an Abschnitten,
    # Spalten und inneren Spalten — also an allem, was andere Blöcke ENTHÄLT.
    #
    # Ein eigener Typ und nicht `NULL`: die Spalte ist NOT NULL, und sie dafür
    # zu lockern hieße, dass auch ein Baustein ohne Typ entstehen könnte. Die
    # Datenbank erzwingt seit 0472, dass `container` und `kind` zusammenpassen.
    container = "container"

    # --- 0471: Social-/Sonstiges-Widgets ------------------------------------
    # Die letzten sechs aus dem Hostaway-Vergleich. `social_icons` trägt keinen
    # eigenen Link-Satz — es zeigt `branding.social_links`, dieselbe Quelle wie
    # die Fußzeile. `whatsapp_chat`/`share_button` brauchen kein Fremdformat:
    # ein `wa.me`-Link bzw. der Browser-eigene Teilen-Mechanismus. `rss_feed`
    # und `facebook_feed` betten Fremdes ein — Ersteres über einen serverseitig
    # gecachten, SSRF-harten Abruf, Zweiteres über Facebooks eigenes iframe.
    # `html_widget` ist Kundeneingabe, beim Speichern mit `nh3` bereinigt.
    social_icons = "social_icons"
    share_button = "share_button"
    whatsapp_chat = "whatsapp_chat"
    rss_feed = "rss_feed"
    facebook_feed = "facebook_feed"
    html_widget = "html_widget"

    # --- Buchungsstrecke (0474) ---------------------------------------------
    # Die Bausteine der Seiten NACH der Objektseite. Bis 0474 waren Checkout
    # und Bestätigung fest programmierte Renderer-Routen ohne Blöcke — der
    # Betrieb sah in der Seitenliste, DASS es sie gibt, und konnte nichts damit
    # tun. Jetzt sind sie Block-Seiten wie jede andere.
    #
    # `checkout_form` ist der PFLICHT-Block der Buchungsseite: ohne ihn kann
    # niemand buchen. Er lässt sich deshalb nicht als letzter von der Seite
    # löschen (`bloecke.py`, Wurzel 5: fail-closed statt einer stillen
    # Buchungsstrecke, die nur noch aussieht wie eine).
    checkout_form = "checkout_form"
    # Die Zusammenfassung dessen, was gebucht wird — Objekt, Zeitraum, Preis.
    # Ein eigener Block und kein Teil von `checkout_form`: bei Airbnb steht sie
    # seitlich, bei Hostaway oben, und genau darin unterscheiden sich die
    # Strecken-Vorlagen.
    checkout_summary = "checkout_summary"
    # Das Zahlungsergebnis auf der Rückkehr-Seite. Er liest `redirect_status`
    # und `payment_intent` aus der Adresse — der Text darüber und darunter ist
    # gestaltbar, das Ergebnis selbst nie.
    checkout_result = "checkout_result"
    # Die vollständige Beitragsliste mit Blättern. Ein eigener Typ neben
    # `posts`: `posts` ist der Teaser („die letzten drei") für eine beliebige
    # Seite, dieser hier ist die Übersicht MIT Paginierung. Ein Teaser mit
    # Blätter-Schalter wären zwei Bausteine in einem.
    post_list = "post_list"


# =========================================================================
# Theme: Designfarben als benannte Rollen (0446) und Text-Rollen (0447)
# =========================================================================
#
# Hostaway führt „bis zu 30 Designfarben", die man frei benennt und mit denen
# man einzelne Widgets VERKNÜPFT; ändert sich die Farbe, ändern sich alle
# verknüpften Stellen mit. Genau diese Mechanik steht hier — mit EINEM
# bewussten Unterschied, der die Frage „tragen 30 frei benennbare Rollen eine
# Unterkunfts-Website?" beantwortet:
#
#   · Die PALETTE darf 30 Einträge haben. Hostaways Zahl wird übernommen und
#     nicht durch eine eigene ersetzt: ein Paletteneintrag ist ein Listenposten
#     und kostet keine Bedienfläche. Wer 30 Marken-Farben führt, soll sie führen.
#   · Die ROLLEN bleiben ein FESTER, benannter Satz. Eine Rolle sagt, WO die
#     Farbe wirkt („Kopfzeilen-Hintergrund"). Eine frei benannte Rolle, die
#     nirgends im Renderer vorkommt, ist eine Zeile in der Oberfläche, die nichts
#     tut — und der Kunde sucht die Wirkung, die es nie gab. Hostaway kann sich
#     freie Rollen leisten, weil dort JEDES Widget einzeln an eine Farbe
#     gebunden wird; unser Renderer bindet Farben an Rollen, damit ein neuer
#     Abschnitt automatisch markenkonform ist (siehe builder/lib/theme.ts).
#
# Die Verknüpfung ist FELDWEISE und nicht widgetweise — das ist der Punkt, den
# Hostaways Artikel ausdrücklich nennt: ändert man am Element die Farbe von
# Hand, gilt dort die Theme-Farbe nicht mehr, die Theme-GRÖSSE aber weiter.
# Übersetzt auf uns: wer eine Rolle direkt setzt, löst genau DIESE Verknüpfung
# (``_ROLLE_ZIEL`` unten), alle anderen bleiben.

# Wie viele benannte Farben eine Palette führen darf. Hostaways Zahl.
MAX_THEME_FARBEN = 30

# Kennung eines Paletteneintrags. Kurz und ohne Sonderzeichen, weil sie als
# Teil eines CSS-Variablennamens (`--theme-farbe-<id>`) im Renderer landet: ein
# `"` oder `;` darin wäre ein Ausbruch aus der Style-Angabe (Wurzel 8).
_FARB_ID_RE = r"^[a-z0-9][a-z0-9_-]{0,31}$"

# Text-Rollen wie bei Hostaway: DFLT (alles ohne eigene Zuordnung), PAR (der
# Absatz) und H1–H6.
TEXT_ROLLEN: tuple[str, ...] = (
    "dflt", "par", "h1", "h2", "h3", "h4", "h5", "h6",
)

# Rolle → wohin ihr verknüpfter Farbwert geschrieben wird.
#
# Zwei Ziele, weil die Farben an zwei Orten wohnen: die neun Flächen-/Marken-
# Rollen sind eigene SPALTEN (Bestand seit 0086/0426), die Schriftfarben der
# Text-Rollen liegen in ``text_styles``. Diese Tabelle ist die EINZIGE Stelle,
# die das weiß — der Durchschreiber im Service liest nur sie.
_ROLLE_ZIEL: dict[str, tuple[str, ...]] = {
    "brand_name_color": ("spalte", "brand_name_color"),
    "header_background": ("spalte", "header_background"),
    "header_link_color": ("spalte", "header_link_color"),
    "primary_color": ("spalte", "primary_color"),
    "link_color": ("spalte", "link_color"),
    "footer_background": ("spalte", "footer_background"),
    "background_color": ("spalte", "background_color"),
    "foreground_color": ("spalte", "foreground_color"),
    "secondary_color": ("spalte", "secondary_color"),
    # Schriftfarbe je Text-Rolle (0447).
    **{f"text_{r}": ("text", r, "color") for r in TEXT_ROLLEN},
    # Die drei Link-Zustände der DFLT-Rolle. Hostaway führt sie dort ebenfalls
    # („hier auch Linkfarbe und Unterstreichung, dazu die drei Zustände").
    "link_normal": ("text", "dflt", "link_color"),
    "link_hover": ("text", "dflt", "link_hover_color"),
    "link_besucht": ("text", "dflt", "link_visited_color"),
}

# Die Spalten-Rollen als eigene Liste: der Service muss wissen, welche Felder
# eines Teil-Updates eine Verknüpfung LÖSEN.
FARB_SPALTEN_ROLLEN: tuple[str, ...] = tuple(
    rolle for rolle, ziel in _ROLLE_ZIEL.items() if ziel[0] == "spalte"
)


def rolle_ziel(rolle: str) -> tuple[str, ...] | None:
    """Wohin der Wert dieser Rolle gehört. ``None`` = unbekannte Rolle.

    Als Funktion und nicht als offene Tabelle, damit der Service nicht über
    eine veränderliche Abbildung stolpert."""
    return _ROLLE_ZIEL.get(rolle)


def alle_farb_rollen() -> tuple[str, ...]:
    """Alle verknüpfbaren Rollen, in Definitionsreihenfolge."""
    return tuple(_ROLLE_ZIEL)


# --- Theme: Designfarben, Text-Rollen, Breite und Abstand (0446/0447) --------
class TextSchatten(StrEnum):
    """Textschatten als drei benannte Stufen statt vier Zahlenfeldern.

    Hostaway lässt Versatz, Weichzeichnung und Farbe einzeln einstellen. Das
    sind vier weitere Regler für einen Effekt, dessen einziger legitimer Zweck
    Lesbarkeit auf einem Bild ist — und dessen freie Form die häufigste Art ist,
    eine Überschrift unlesbar zu machen. Drei Stufen decken den Zweck ab und
    können ihn nicht verfehlen."""

    keiner = "keiner"
    weich = "weich"   # weiche dunkle Aura — Text auf Fotos
    hart = "hart"     # harter versetzter Schatten — Plakat-Optik


class Breiteneinheit(StrEnum):
    """Einheit der Inhaltsbreite. Hostaway bietet px und vw an.

    ``px`` ist der Bestand: bis 0447 hatte ``content_width`` keine Einheit und
    der Renderer schrieb ``px``. Der Default ist deshalb ``px`` und kein NULL —
    das ist kein erfundener Wert, sondern die Einheit, in der die vorhandenen
    Werte bereits stehen (Wurzel 1)."""

    px = "px"
    vw = "vw"


class ThemeFarbe(BaseModel):
    """Ein benannter Eintrag der Designfarben-Palette (0446).

    ``id`` ist stabil und wandert in einen CSS-Variablennamen des Renderers;
    ``name`` ist frei und nur für die Oberfläche."""

    id: str = Field(pattern=_FARB_ID_RE)
    name: str = Field(min_length=1, max_length=40)
    color: str = Field(pattern=_HEX_RE)

    @field_validator("name")
    @classmethod
    def _name_ohne_markup(cls, v: str) -> str:
        """Der Name steht in der Oberfläche und im Tooltip des Farbwählers.
        Auszeichnung darin wäre nichts als ein Vektor (Wurzel 8)."""
        sauber = _nur_text(v)
        if not sauber:
            raise ValueError("Der Name der Farbe darf nicht leer sein.")
        return sauber


class TextStil(BaseModel):
    """Eine Text-Rolle (DFLT · PAR · H1–H6) mit ihren Einstellungen (0447).

    Jedes Feld darf fehlen. Fehlt es, gilt genau das, was der Renderer heute
    ohne diese Rolle tut — eine bestehende Kundenseite sieht danach unverändert
    aus (Wurzel 1). Es wird KEIN Default erfunden.

    Was Hostaway hier zusätzlich hat und wir BEWUSST nicht:

      · **Schriftformat/Ausrichtung.** Sie gehört an den Abschnitt, nicht an die
        Rolle: dieselbe H2 steht im Hero zentriert und im Textabschnitt links.
        Als Theme-Wert wäre sie an einer der beiden Stellen immer falsch.
      · **Textrichtung.** Sie folgt der SPRACHE, nicht dem Geschmack. Unsere 24
        Sprachen sind alle LTR; eine per Rolle einstellbare Richtung wäre ein
        Schalter, der entweder nichts tut oder die Seite kaputt macht (Wurzel 4).
    """

    # Familie aus dem Schriftkatalog (derselbe Schlüssel wie `font_family`).
    font: str | None = None
    # Größe in px, getrennt für Desktop/Tablet und Mobil — wie bei Hostaway.
    # Fehlt die Mobilgröße, rechnet der Renderer sie automatisch aus der
    # Desktop-Größe (globals.css, Abschnitt „Automatische Größenanpassung").
    size_desktop: int | None = Field(default=None, ge=8, le=200)
    size_mobile: int | None = Field(default=None, ge=8, le=200)
    # „Text skalieren": die Größe folgt der Breite des Inhaltsbereichs statt
    # fest zu stehen. Gedacht gegen Zeilenumbrüche in Überschriften.
    scale_text: bool = False
    color: str | None = Field(default=None, pattern=_HEX_RE)
    weight: int | None = Field(default=None, ge=100, le=900)
    line_height: float | None = Field(default=None, ge=0.8, le=3.0)
    # In em, damit die Laufweite mit der Schriftgröße mitgeht.
    letter_spacing: float | None = Field(default=None, ge=-0.1, le=0.5)
    uppercase: bool = False
    shadow: TextSchatten = TextSchatten.keiner
    # --- Nur für die Rolle DFLT: die drei Link-Zustände ---------------------
    # Hostaway führt Linkfarbe und Unterstreichung unter DFLT, mit den Zuständen
    # normal/hover/besucht. Auf einer anderen Rolle wären sie wirkungslos —
    # deshalb weist der Validator sie dort ab, statt sie still zu schlucken.
    link_color: str | None = Field(default=None, pattern=_HEX_RE)
    link_hover_color: str | None = Field(default=None, pattern=_HEX_RE)
    link_visited_color: str | None = Field(default=None, pattern=_HEX_RE)
    link_underline: bool | None = None

    @field_validator("weight")
    @classmethod
    def _hunderterschritt(cls, v: int | None) -> int | None:
        """Schriftstärken gibt es in Hundertern (100–900). Ein 450 wäre bei
        einer nicht-variablen Schrift ein stiller Rückfall auf 400 — der Kunde
        stellt etwas ein und sieht nichts."""
        if v is not None and v % 100:
            raise ValueError("Schriftstärke in Hundertern (100–900).")
        return v

    def hat_linkfelder(self) -> bool:
        """Trägt diese Rolle Link-Angaben? (Nur DFLT darf das.)"""
        return any(
            wert is not None
            for wert in (
                self.link_color,
                self.link_hover_color,
                self.link_visited_color,
                self.link_underline,
            )
        )


def _validate_theme_colors(value: list[ThemeFarbe]) -> list[ThemeFarbe]:
    """Palette prüfen: keine doppelten Kennungen.

    Zwei Einträge mit derselben ``id`` sind kein Schönheitsfehler: die
    Verknüpfung einer Rolle zeigt dann auf zwei Farben, und welche gewinnt,
    entscheidet die Reihenfolge im JSON. Das wäre eine Website, deren Farbe sich
    beim Speichern ändern kann."""
    gesehen: set[str] = set()
    for eintrag in value or []:
        if eintrag.id in gesehen:
            raise ValueError(f"Doppelte Farb-Kennung: {eintrag.id}")
        gesehen.add(eintrag.id)
    return list(value or [])


def _validate_color_links(value: dict[str, str]) -> dict[str, str]:
    """Verknüpfungen prüfen: bekannte Rolle, gültige Farb-Kennung.

    Eine unbekannte Rolle wird ABGELEHNT und nicht still gespeichert: sie wäre
    eine Verknüpfung, die nie wirkt, und niemand würde je erfahren, warum die
    Farbe nicht mitzieht (Wurzel 4/5).

    Ob die Kennung auch wirklich in der Palette steht, prüft der Service — er
    ist die Stelle, die den GESAMTZUSTAND kennt (bei einem Teil-Update kommt die
    Palette womöglich gar nicht mit)."""
    erlaubt = set(alle_farb_rollen())
    aus: dict[str, str] = {}
    for rolle, farb_id in (value or {}).items():
        if rolle not in erlaubt:
            raise ValueError(f"Unbekannte Farbrolle: {rolle}")
        kennung = (farb_id or "").strip()
        if not kennung:
            continue  # leer = nicht verknüpft; kein Eintrag statt Leerstring
        if not re.match(_FARB_ID_RE, kennung):
            raise ValueError(f"Ungültige Farb-Kennung: {farb_id}")
        aus[rolle] = kennung
    return aus


def _validate_text_styles(value: dict[str, TextStil]) -> dict[str, TextStil]:
    """Text-Rollen prüfen: bekannter Schlüssel, Link-Felder nur bei DFLT."""
    for rolle, stil in (value or {}).items():
        if rolle not in TEXT_ROLLEN:
            raise ValueError(f"Unbekannte Text-Rolle: {rolle}")
        if rolle != "dflt" and stil.hat_linkfelder():
            raise ValueError(
                "Linkfarbe und Unterstreichung gehören zur Rolle DFLT — "
                f"auf {rolle} wären sie wirkungslos."
            )
    return dict(value or {})


# --- Theme-Ebene: die Felder, von denen die Branding-Modelle erben -----------
class ThemeFelder(BaseModel):
    """Alles, was das Theme ausmacht — Breite, Größen, Abstand, Designfarben,
    Text-Rollen.

    Eine eigene Klasse und kein Block in ``BrandingBase``: die Felder gehören
    fachlich zusammen, ihre Validatoren brauchen einander (die Breite ihre
    Einheit), und die öffentliche Antwort erbt eine ANDERE, kleinere Auswahl
    (``ThemeOeffentlich``) — als loser Block wäre die Grenze zwischen beiden
    nur ein Kommentar."""

    # Grenzen wie die CHECKs in 0435/0447. Sie stehen hier ZUSÄTZLICH, damit der
    # Kunde eine Meldung bekommt statt eines 23514-Fehlers.
    #
    # Die untere Schranke ist mit 0447 von 960 auf 50 gefallen, weil die Breite
    # seither auch in `vw` stehen darf (50–100). Welches Paar gilt, entscheidet
    # `content_width_unit` — geprüft im Modell-Validator unten, nicht hier: ein
    # `Field`-Constraint kann eine ANDERE Spalte nicht lesen.
    content_width: int | None = Field(default=None, ge=50, le=1920)
    content_width_unit: Breiteneinheit = Breiteneinheit.px
    # Hostaways Schalter „Full width": der Inhalt läuft über die ganze Breite,
    # unabhängig vom eingestellten Höchstwert. `False` ist der Bestand.
    content_full_width: bool = False
    heading_scale: int | None = Field(default=None, ge=80, le=130)
    body_scale: int | None = Field(default=None, ge=80, le=130)

    # --- Theme: Abstand der Abschnitte (0447) -------------------------------
    # Hostaway hat drei Ebenen (Abschnitt · Spalte · innere Spalte). Wir haben
    # ZWEI Werte, und das ist keine Sparmaßnahme, sondern die Abbildung unseres
    # Layouts: unser Renderer stapelt ABSCHNITTE, eine allgemeine Spalten-Ebene
    # gibt es nicht (Spalten entstehen innerhalb eines Abschnitts-Typs, z. B. im
    # Objekt-Raster, und ihr Abstand gehört zu dessen Gestaltung). Ein Regler
    # „Spaltenabstand", der auf nichts wirkt, wäre eine Attrappe (Wurzel 4).
    #
    # NULL = wie bisher, also KEIN zusätzlicher Abstand. Der Wert kommt oben
    # drauf und ersetzt nicht — genauso wie das `padding` je Abschnitt (0432).
    section_spacing_y: int | None = Field(default=None, ge=0, le=200)
    section_spacing_x: int | None = Field(default=None, ge=0, le=200)

    # --- Theme: Designfarben als benannte Rollen (0446) ---------------------
    # Die Palette (bis 30 Einträge) und die feldweisen Verknüpfungen Rolle →
    # Palette. Beide sind LISTEN/TABELLEN und keine Spalten: eine Palette ist
    # ihrem Wesen nach variabel lang, und 30 Spalten wären 30 Migrationen.
    theme_colors: list[ThemeFarbe] = Field(
        default_factory=list, max_length=MAX_THEME_FARBEN
    )
    theme_color_links: dict[str, str] = Field(default_factory=dict)

    # --- Theme: Text-Rollen DFLT · PAR · H1–H6 (0447) -----------------------
    text_styles: dict[str, TextStil] = Field(default_factory=dict)

    _v_theme_colors = field_validator("theme_colors")(_validate_theme_colors)
    _v_color_links = field_validator("theme_color_links")(_validate_color_links)
    _v_text_styles = field_validator("text_styles")(_validate_text_styles)

    @model_validator(mode="after")
    def _breite_passt_zur_einheit(self) -> ThemeFelder:
        """Die Inhaltsbreite muss zur gewählten Einheit passen.

        960–1920 px oder 50–100 vw — Hostaways Bereiche. Ohne diese Prüfung
        könnte `content_width = 60` mit Einheit `px` gespeichert werden: eine
        Website, deren Inhalt 60 Pixel breit ist. Die DB hat denselben CHECK
        (0447); hier steht er, damit der Kunde eine Meldung bekommt statt eines
        23514-Fehlers."""
        if self.content_width is None:
            return self
        if self.content_width_unit is Breiteneinheit.vw:
            if not 50 <= self.content_width <= 100:
                raise ValueError("Inhaltsbreite in vw: 50 bis 100.")
        elif not 960 <= self.content_width <= 1920:
            raise ValueError("Inhaltsbreite in px: 960 bis 1920.")
        return self


class ThemeOeffentlich(BaseModel):
    """Die Theme-Felder, die der Renderer bekommt.

    Bewusst OHNE ``theme_color_links``: welche Rolle an welchem Palettenposten
    hängt, ist eine Redaktions-Information. Der Renderer braucht nur den
    aufgelösten Wert, und den trägt die Rolle selbst — der Service schreibt ihn
    beim Speichern durch.

    Die Zahlenfelder tragen hier bewusst KEINE Wertebereiche: sie sind beim
    Speichern geprüft, und eine zweite Schranke würde nur dazu führen, dass eine
    Bestandszeile, die eine später verschärfte Regel verletzt, die ganze Website
    mit einem 500 lahmlegt statt sie anzuzeigen.

    ``theme_colors`` und ``text_styles`` verwenden dieselben Modelle wie das
    Dashboard und prüfen daher weiter das FORMAT (Hex, Kennung). Das ist keine
    Unachtsamkeit: schreiben kann diese Spalten nur der Server über den geprüften
    Pfad — `anon` und `authenticated` haben auf `tenant_site_config` nur
    `select`. Ein Formfehler dort wäre also kein Kundenwert, sondern ein
    Eingriff an der Datenbank vorbei, und dann ist ein lauter Fehler richtig."""

    content_width: int | None = None
    content_width_unit: Breiteneinheit = Breiteneinheit.px
    content_full_width: bool = False
    heading_scale: int | None = None
    body_scale: int | None = None
    section_spacing_y: int | None = None
    section_spacing_x: int | None = None
    theme_colors: list[ThemeFarbe] = Field(default_factory=list)
    text_styles: dict[str, TextStil] = Field(default_factory=dict)


# --- Designfarben: Palette, Verknüpfung, Gegenzustand (0446/0447) --------
#
# Die Mechanik, die Hostaway „Widgets mit einer Designfarbe verknüpfen"
# nennt, in EINEM Durchlauf und an EINER Stelle:
#
#   1. Wer eine Rolle von Hand auf einen anderen Wert setzt, LÖST damit ihre
#      Verknüpfung. Das ist Hostaways ausdrückliche Regel („eine manuelle
#      Änderung überschreibt das Theme dauerhaft") — und sie gilt feldweise:
#      die Farbe löst sich, die Größe derselben Rolle bleibt verknüpft.
#   2. Zeigt eine Verknüpfung auf einen Palettenposten, den es nicht mehr
#      gibt, fällt SIE weg — der zuletzt gültige Wert bleibt in der Spalte
#      stehen. Das ist der Gegenzustand zum Löschen einer Farbe (Wurzel 1):
#      die Seite sieht danach unverändert aus, die Bindung ist nur gelöst.
#      Die Alternative — die Rolle mitzuleeren — würde beim Aufräumen der
#      Palette stillschweigend das Aussehen der Website ändern.
#   3. Jede verbleibende Verknüpfung schreibt ihren Palettenwert in die
#      Rolle. Damit gibt es genau EINE Wahrheit: die Spalte trägt immer den
#      geltenden Wert, und Renderer, Resolver und Vorschau brauchen die
#      Palette gar nicht zu kennen, um richtig zu zeichnen.
#
# Verglichen wird gegen den ALTEN aufgelösten Wert, nicht gegen den neuen:
# ändert der Kunde eine Palettenfarbe, schickt die Oberfläche die
# unveränderte Rollenfarbe mit. Gegen den neuen Wert geprüft, sähe das wie
# eine Handänderung aus und würde jede Verknüpfung beim ersten Farbwechsel
# lösen — genau das Gegenteil der Funktion.


def rollen_wert(payload: dict, rolle: str) -> str | None:
    """Welchen Wert bringt der Request für diese Farbrolle mit? ``None`` = keinen.

    Die Rolle weiß selbst, wo sie wohnt (``basis.rolle_ziel``): neun von ihnen
    sind eigene Spalten, die übrigen stecken in ``text_styles``. Diese Funktion
    ist die einzige Stelle, die beide Orte kennt — und ihr Gegenstück
    ``setze_rollen_wert`` die einzige, die dorthin schreibt."""
    ziel = rolle_ziel(rolle)
    if ziel is None:
        return None
    if ziel[0] == "spalte":
        wert = payload.get(ziel[1])
        return wert if isinstance(wert, str) else None
    stil = (payload.get("text_styles") or {}).get(ziel[1]) or {}
    wert = stil.get(ziel[2])
    return wert if isinstance(wert, str) else None


def setze_rollen_wert(
    payload: dict, text_styles: dict, rolle: str, wert: str
) -> None:
    """Den verknüpften Palettenwert in seine Rolle schreiben.

    ``text_styles`` wird als bereits verschmolzene Tabelle hereingereicht und
    hier nur ergänzt — der Aufrufer entscheidet danach, ob sie überhaupt
    gespeichert werden muss."""
    ziel = rolle_ziel(rolle)
    if ziel is None:
        return
    if ziel[0] == "spalte":
        payload[ziel[1]] = wert
        return
    eintrag = dict(text_styles.get(ziel[1]) or {})
    eintrag[ziel[2]] = wert
    text_styles[ziel[1]] = eintrag


def farbrollen_beruehrt(payload: dict) -> bool:
    """Berührt dieses Teil-Update überhaupt Farbrollen oder die Palette?

    Ohne diese Frage würde jeder Speichervorgang — auch einer, der nur den
    Seitentitel ändert — eine zusätzliche Abfrage auslösen."""
    return any(
        feld in payload
        for feld in ("theme_colors", "theme_color_links", "text_styles")
    ) or any(rolle in payload for rolle in FARB_SPALTEN_ROLLEN)


def farbrollen_anwenden(payload: dict, stand: dict) -> None:
    """Verknüpfungen anwenden. Ändert ``payload`` an Ort und Stelle.

    ``stand`` ist die gespeicherte Zeile mit ``theme_colors``,
    ``theme_color_links`` und ``text_styles``."""
    alt_palette = {
        str(e.get("id")): str(e.get("color"))
        for e in (stand.get("theme_colors") or [])
        if e.get("id") and e.get("color")
    }
    neue_palette = {
        str(e.get("id")): str(e.get("color"))
        for e in (payload.get("theme_colors", stand.get("theme_colors")) or [])
        if e.get("id") and e.get("color")
    }
    links = dict(
        payload.get("theme_color_links", stand.get("theme_color_links")) or {}
    )
    # Text-Rollen: der gespeicherte Stand, mit dem überlagert, was der Request
    # mitbringt. Ohne diese Verschmelzung würde ein Durchschreiben in eine leere
    # Tabelle schreiben und die übrigen Rollen löschen.
    text_styles: dict = dict(stand.get("text_styles") or {})
    for rolle, stil in (payload.get("text_styles") or {}).items():
        text_styles[rolle] = stil

    for rolle in list(links):
        alt_wert = alt_palette.get(links[rolle])
        neu_wert = rollen_wert(payload, rolle)
        # 1. Handänderung löst die Verknüpfung.
        if (
            neu_wert is not None
            and alt_wert is not None
            and neu_wert.lower() != alt_wert.lower()
        ):
            del links[rolle]
            continue
        # 2. Verwaister Verweis: Bindung weg, Wert bleibt.
        if links[rolle] not in neue_palette:
            del links[rolle]

    # 3. Durchschreiben.
    for rolle, farb_id in links.items():
        setze_rollen_wert(payload, text_styles, rolle, neue_palette[farb_id])

    if links != (stand.get("theme_color_links") or {}):
        payload["theme_color_links"] = links
    if text_styles != (stand.get("text_styles") or {}):
        payload["text_styles"] = text_styles
