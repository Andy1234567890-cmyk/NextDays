"""Was Suchmaschinen und Antwortmaschinen von einer Kunden-Website brauchen (0430).

Drei Dateien entstehen daraus im Renderer — hier steht nur ihre Datengrundlage:

* ``sitemap.xml``  — welche Adressen es gibt, wann sie sich zuletzt änderten
* ``robots.txt``   — was gecrawlt werden darf, wo die Sitemap liegt
* ``llms.txt``     — dasselbe für Antwortmaschinen (AEO)

Warum ein eigenes Modul: der Service ist bei 1460 Zeilen (`pylint`-Grenze 1500),
und diese Abfragen lesen quer über den Baum — Seiten aus ``site_pages``, Objekte
aus ``properties``. Das ist die einzige Stelle des Slice, die beide Quellen
zusammenführt.

Warum ``llms.txt`` überhaupt: Hostaway nennt seinen Bereich „SEO/AEO", liefert
darin aber nur klassisches SEO — Titel, Beschreibung, Keywords, Schema. Eine
Antwortmaschine (ChatGPT, Perplexity, Google AI Overviews) liest keine
``sitemap.xml``, sondern sucht eine kurze, textuelle Übersicht der Website. Genau
das ist ``llms.txt``. Es ist kein W3C-Standard, sondern eine Konvention — deshalb
kostet sie nichts und schadet nichts, wenn eine Maschine sie ignoriert.
"""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from .konto_daten import firmen_schema_daten

# Wie viele Adressen eine Sitemap höchstens enthält. Die Protokoll-Grenze liegt
# bei 50 000 Adressen bzw. 50 MB je Datei; dieser Deckel liegt weit darunter und
# ist der Schutz gegen einen unbegrenzten Bereich (Wurzel 8) — ohne ihn baut ein
# Betrieb mit 3000 Objekten pro Sitemap-Abruf eine Antwort im Megabyte-Bereich.
#
# Wird er erreicht, ist das KEIN stiller Abschnitt: `sitemap_daten` meldet es im
# Rückgabewert, und der Renderer schreibt einen Kommentar in die XML-Datei. Eine
# unvollständige Sitemap, die vollständig aussieht, ist der schlechteste Zustand
# von allen — Google indexiert dann genau die Hälfte und niemand weiß, warum.
MAX_SITEMAP_ADRESSEN = 5_000


def sitemap_daten(db: Client, tenant_id: str) -> dict:
    """Alle indexierbaren Adressen einer Kunden-Website.

    Rückgabe:
        ``{"pages": [...], "properties": [...], "abgeschnitten": bool}``

    Enthalten sind NUR Adressen, die eine Suchmaschine auch aufnehmen darf:

    * Seiten: veröffentlicht UND nicht auf ``noindex``. Eine Seite mit
      ``noindex`` in die Sitemap zu schreiben ist ein Widerspruch in sich —
      Google meldet es als „eingereichte URL mit noindex-Tag" und wertet die
      ganze Sitemap ab.
    * Objekte: ``status='active'`` UND ``listed_on_website=true``. Dieselben
      zwei Bedingungen wie im Schaufenster (``booking_engine/schaufenster.py``);
      ein Objekt, das die Website nicht zeigt, hat auch keine Adresse.

    ``lastmod`` kommt aus ``updated_at`` der jeweiligen Zeile. Das ist hier
    korrekt und kein Verstoß gegen Wurzel 5b: gefragt ist, wann sich UNSERE
    Seite geändert hat — nicht, wann ein fremdes Ereignis stattfand.
    """
    seiten = (
        db.table("site_pages")
        .select("slug, title, updated_at, is_home, languages, page_type")
        .eq("tenant_id", tenant_id)
        .eq("is_published", True)
        .eq("noindex", False)
        # Nur echte Seiten (0433): ein Ordner hat keine Adresse, ein externer
        # Menüpunkt zeigt auf eine FREMDE Website (die gehört nicht in unsere
        # Sitemap), und die Fehlerseite ist die Antwort auf eine falsche
        # Adresse. Alle drei in der Sitemap wären für Google eine 404 bzw. eine
        # Weiterleitung — beides wertet die ganze Datei ab.
        .eq("page_type", "normal")
        .order("is_home", desc=True)
        .limit(MAX_SITEMAP_ADRESSEN)
        .execute()
    ).data or []

    rest = max(0, MAX_SITEMAP_ADRESSEN - len(seiten))
    objekte = []
    if rest:
        objekte = (
            db.table("properties")
            .select("id, updated_at")
            .eq("tenant_id", tenant_id)
            .eq("status", "active")
            .eq("listed_on_website", True)
            .limit(rest)
            .execute()
        ).data or []

    # Blog-Beiträge (0438). Sie sind Seiten mit `page_type='post'` und wurden
    # von der Abfrage oben ausgeschlossen (die filtert auf `normal`) — hier
    # kommen sie als eigene Liste dazu.
    #
    # Ohne sie stünde kein einziger Beitrag in der Sitemap, und ein Blog, den
    # niemand findet, ist die teuerste Art, Texte zu schreiben.
    beitraege = []
    rest_nach_seiten = max(0, MAX_SITEMAP_ADRESSEN - len(seiten) - len(objekte))
    if rest_nach_seiten:
        beitraege = (
            db.table("site_pages")
            .select("slug, title, updated_at, published_at")
            .eq("tenant_id", tenant_id)
            .eq("page_type", "post")
            .eq("is_published", True)
            .eq("noindex", False)
            .lte("published_at", datetime.now(UTC).isoformat())
            .order("published_at", desc=True)
            .limit(rest_nach_seiten)
            .execute()
        ).data or []

    return {
        "posts": [
            {
                "slug": row.get("slug") or "",
                "title": row.get("title") or "",
                # `lastmod` aus `updated_at`: hier ist unsere Uhr korrekt, denn
                # gefragt ist, wann sich UNSERE Seite geändert hat.
                "lastmod": str(row["updated_at"]) if row.get("updated_at") else None,
            }
            for row in beitraege
        ],
        "pages": [
            {
                # Die Startseite trägt den leeren Slug — der Renderer baut daraus
                # „/" und nicht „/{slug}". Hier steht der Rohwert, damit die
                # Pfad-Bildung an EINER Stelle liegt.
                "slug": (row.get("slug") or ""),
                # Der lesbare Name der Seite. Die Sitemap braucht ihn nicht —
                # `llms.txt` schon: eine Antwortmaschine liest „Über uns", kein
                # `/ueber-uns`. Deshalb reist er in derselben Antwort mit.
                "title": row.get("title") or "",
                "lastmod": str(row["updated_at"]) if row.get("updated_at") else None,
                "is_home": bool(row.get("is_home")),
                # Sprachen dieser Seite. Der Renderer baut daraus die
                # `hreflang`-Alternativen; `None` heißt „alle Sprachen der Site".
                "languages": row.get("languages"),
            }
            for row in seiten
        ],
        "properties": [
            {
                "id": str(row["id"]),
                "lastmod": str(row["updated_at"]) if row.get("updated_at") else None,
            }
            for row in objekte
        ],
        # Ehrlich melden, statt still zu kürzen.
        "abgeschnitten": (
            len(seiten) + len(objekte) + len(beitraege)
        ) >= MAX_SITEMAP_ADRESSEN,
    }


# === Befund-Liste (Etappe B) ================================================
# Hostaways SEO/AEO-Bereich zeigt „a summary of the site's SEO configuration,
# and it will highlight if there are any improvements to make" mit einem
# „Fix it"-Knopf. Das ist das eine Muster ihres SEO-Bereichs, das wir nicht
# hatten — und es ist das wertvollste: die Felder allein sagen niemandem, WO
# etwas fehlt, wenn eine Website zwölf Seiten hat.
#
# Was wir zusätzlich prüfen, weil wir die Daten haben und Hostaway nicht:
# doppelte Meta-Titel über mehrere Seiten, fehlende Objektbeschreibungen,
# fehlendes Firmenprofil (ohne das gibt es kein Organization-Schema).
#
# Was hier NICHT passiert: Texte erzeugen. Hostaway hat neben dem „Fix it" einen
# „Generate Meta Tags"-Knopf, der für alle Seiten auf einmal KI-Texte schreibt.
# Danach sieht die Liste vollständig aus, und niemand hat gelesen, was drin
# steht — bei dem Text, mit dem die Seite in Google auftritt. Die Befundliste
# führt deshalb zur Seite, nicht zu einem Generator.

# Wie viele Seiten je Befund namentlich genannt werden. Darüber wird nur noch
# gezählt: eine Liste mit 200 Einträgen ist keine Handlungsanweisung mehr, und
# der Deckel hält die Antwort klein (Wurzel 8).
MAX_BEFUND_SEITEN = 10


def _leer(wert: object) -> bool:
    """Ist die Angabe praktisch nicht vorhanden? Ein Leerstring zählt als
    fehlend — er ist kein gepflegter Wert, sondern ein leergeräumtes Feld."""
    return not (isinstance(wert, str) and wert.strip())


def seo_befunde(db: Client, tenant_id: str) -> list[dict]:
    """Was an der Auffindbarkeit dieser Website noch fehlt.

    Rückgabe: Liste von Befunden, jeweils
    ``{"code": str, "schwere": "fehler"|"warnung"|"hinweis",
       "anzahl": int, "seiten": [{"id","titel","slug"}]}``.

    Sortiert nach Schwere, damit die Oberfläche nichts umsortieren muss:

    * ``fehler``  — die Website ist so nicht findbar (noindex, keine Domain).
    * ``warnung`` — ein wichtiger Teil fehlt (Meta-Angaben, doppelte Titel).
    * ``hinweis`` — verbesserungsfähig, aber nichts ist kaputt.

    Ein leeres Ergebnis heißt: alles Prüfbare ist gepflegt. Es heißt NICHT, dass
    die Website gut rankt — das entscheidet Google, nicht diese Liste. Genau
    deshalb nennt die Oberfläche sie „Befunde" und nicht „SEO-Punktzahl": eine
    Zahl von 87/100 wäre eine erfundene Bewertung (Wurzel 4).
    """
    befunde: list[dict] = []

    cfg_rows = (
        db.table("tenant_site_config")
        .select("noindex, gtag_id, seo_description, schema_organization")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    cfg = cfg_rows[0] if cfg_rows else {}

    seiten = (
        db.table("site_pages")
        .select("id, slug, title, seo_title, seo_description, is_published, noindex")
        .eq("tenant_id", tenant_id)
        .limit(1000)
        .execute()
    ).data or []
    # Nur VERÖFFENTLICHTE Seiten: an einem Entwurf ist ein fehlender Meta-Titel
    # kein Befund, sondern unfertige Arbeit. Ihn zu melden würde die Liste mit
    # Dingen füllen, die der Kunde gerade selbst in der Hand hat.
    live = [s for s in seiten if s.get("is_published")]

    def seiten_liste(auswahl: list[dict]) -> list[dict]:
        return [
            {
                "id": str(s["id"]),
                "titel": s.get("title") or "",
                "slug": s.get("slug") or "",
            }
            for s in auswahl[:MAX_BEFUND_SEITEN]
        ]

    # --- fehler: die Website ist nicht findbar ------------------------------
    if cfg.get("noindex") and live:
        befunde.append(
            {
                "code": "site_noindex",
                "schwere": "fehler",
                "anzahl": len(live),
                "seiten": [],
            }
        )

    domains = (
        db.table("tenant_custom_domains")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    ).data or []
    if not domains and live:
        # Ohne eigene Domain gibt es keine sitemap.xml, keine robots.txt und
        # keine llms.txt — sie hängen an der Adresse, nicht am Baukasten.
        befunde.append(
            {"code": "keine_domain", "schwere": "fehler", "anzahl": 0, "seiten": []}
        )

    # --- warnung: wichtige Angaben fehlen ----------------------------------
    ohne_titel = [s for s in live if _leer(s.get("seo_title"))]
    if ohne_titel:
        befunde.append(
            {
                "code": "seiten_ohne_titel",
                "schwere": "warnung",
                "anzahl": len(ohne_titel),
                "seiten": seiten_liste(ohne_titel),
            }
        )

    ohne_beschreibung = [s for s in live if _leer(s.get("seo_description"))]
    # Der site-weite Rückfall zählt: ist er gesetzt, hat jede Seite eine
    # Beschreibung — nur eben überall dieselbe. Das ist ein HINWEIS, kein
    # fehlender Wert.
    if ohne_beschreibung:
        befunde.append(
            {
                "code": (
                    "seiten_gleiche_beschreibung"
                    if not _leer(cfg.get("seo_description"))
                    else "seiten_ohne_beschreibung"
                ),
                "schwere": (
                    "hinweis"
                    if not _leer(cfg.get("seo_description"))
                    else "warnung"
                ),
                "anzahl": len(ohne_beschreibung),
                "seiten": seiten_liste(ohne_beschreibung),
            }
        )

    # Doppelte Meta-Titel. Hostaway prüft das nicht, und es ist der Befund, den
    # Google in der Search Console selbst meldet: zwei Seiten mit demselben
    # Titel konkurrieren um dieselbe Suchanfrage.
    gesehen: dict[str, list[dict]] = {}
    for s in live:
        titel = (s.get("seo_title") or "").strip().lower()
        if titel:
            gesehen.setdefault(titel, []).append(s)
    doppelt = [s for gruppe in gesehen.values() if len(gruppe) > 1 for s in gruppe]
    if doppelt:
        befunde.append(
            {
                "code": "doppelte_titel",
                "schwere": "warnung",
                "anzahl": len(doppelt),
                "seiten": seiten_liste(doppelt),
            }
        )

    # --- hinweis ----------------------------------------------------------
    if cfg.get("schema_organization", True):
        # Der Schalter steht an, aber ohne Namen im Firmenprofil liefert der
        # Renderer kein Schema. Das ist die häufigste Ursache für „mein Betrieb
        # erscheint nicht als Unternehmen bei Google" — und niemand sucht sie
        # im Firmenprofil, weil der Schalter im Baukasten steht.
        daten = firmen_schema_daten(db, tenant_id)
        if not daten.get("name"):
            befunde.append(
                {
                    "code": "kein_firmenname",
                    "schwere": "hinweis",
                    "anzahl": 0,
                    "seiten": [],
                }
            )
        elif not (daten.get("city") or daten.get("street")):
            befunde.append(
                {
                    "code": "keine_anschrift",
                    "schwere": "hinweis",
                    "anzahl": 0,
                    "seiten": [],
                }
            )

    # Kann der Betrieb überhaupt Geld annehmen? Der Befund mit der größten
    # Wirkung überhaupt — und der einzige, bei dem die Website funktioniert und
    # trotzdem kein Geschäft zustande kommt.
    #
    # Ohne abrechnungsfähiges Konto durchläuft ein Gast die ganze
    # Buchungsstrecke, eine Reservierung entsteht, und der Zahlungsschritt
    # scheitert. Der Renderer fängt das inzwischen ab (er schaltet auf den
    # Anfrage-Weg), aber der Betrieb soll es WISSEN: eine Direktbuchungs-Website
    # ohne Zahlung ist eine halbe Website.
    #
    # `warnung` und nicht `fehler`: die Website ist findbar und der Anfrage-Weg
    # funktioniert. Es fehlt der Abschluss, nicht die Seite.
    zahlung = (
        db.table("tenant_billing_profile")
        .select("stripe_charges_enabled, paypal_email")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    profil = zahlung[0] if zahlung else {}
    bereit = bool(profil.get("stripe_charges_enabled")) or bool(
        (profil.get("paypal_email") or "").strip()
    )
    if not bereit and live:
        befunde.append(
            {
                "code": "zahlung_nicht_bereit",
                "schwere": "warnung",
                "anzahl": 0,
                "seiten": [],
            }
        )

    if _leer(cfg.get("gtag_id")):
        befunde.append(
            {"code": "keine_messung", "schwere": "hinweis", "anzahl": 0, "seiten": []}
        )

    # Objekte auf der Website ohne Beschreibung. Eine Objektseite ohne Text ist
    # für Google eine „dünne Seite" — sie besteht aus Bildern, einem Preis und
    # einem Kalender. Die Beschreibung ist der einzige Inhalt, den sie hat.
    objekte = (
        db.table("properties")
        .select("id, title, description")
        .eq("tenant_id", tenant_id)
        .eq("status", "active")
        .eq("listed_on_website", True)
        .limit(500)
        .execute()
    ).data or []
    duenn = [o for o in objekte if _leer(o.get("description"))]
    if duenn:
        befunde.append(
            {
                "code": "objekte_ohne_text",
                "schwere": "warnung",
                "anzahl": len(duenn),
                # Objekte, nicht Seiten — dieselbe Form, damit die Oberfläche
                # nur eine Darstellung braucht. `slug` bleibt leer: eine
                # Objektseite hat keinen, ihre Adresse ist /inserat/<id>.
                "seiten": [
                    {"id": str(o["id"]), "titel": o.get("title") or "", "slug": ""}
                    for o in duenn[:MAX_BEFUND_SEITEN]
                ],
            }
        )

    rang = {"fehler": 0, "warnung": 1, "hinweis": 2}
    befunde.sort(key=lambda b: rang.get(str(b["schwere"]), 9))
    return befunde
