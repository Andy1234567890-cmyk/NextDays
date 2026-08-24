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
"""

from __future__ import annotations

from enum import StrEnum

import nh3

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
}
# `rel` NICHT hier — nh3 setzt es selbst via link_rel (sonst ValueError).
_RICH_TEXT_ATTRS = {"a": {"href", "title", "target"}, "span": {"style"}}


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
