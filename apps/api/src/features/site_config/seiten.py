"""Die vier Seitentypen des Baukastens: Regeln und Duplizieren (0433).

Eigenes Modul, und der Anlass ist eine Zeilenzahl: mit der Typ-Logik direkt im
Service stand der bei 1520 Zeilen und damit über der Grenze, die `pylint` hier
setzt (1500). Der Schnitt ist aber nicht bloß Buchhaltung — hier steht, was ein
Seitentyp BEDEUTET, und das ist eine Frage für sich:

* Welcher Slug gehört zu einem Typ, der keine Adresse hat?
* Wie viele Seiten darf ein Betrieb haben?
* Wer darf an einem Ordner hängen?

Der Service ruft diese drei Funktionen und bleibt bei dem, was er sonst tut:
Zeilen lesen und schreiben.
"""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from . import konto_daten, seiten_vorlagen
from .schemas import PageCreate, PageType, PublicNav, PublicNavItem

# Höchstzahl der Seiten je Betrieb.
#
# Ohne Deckel ist die Seitenliste ein unbegrenzter Bereich (Wurzel 8): sie
# wandert vollständig in jede Baukasten-Ansicht, in die Navigation JEDER
# Gast-Seite und in die Sitemap. Hostaway zieht die Grenze bei 1000; für einen
# Betrieb mit ein paar Objekten sind 200 das Zehnfache dessen, was je gebraucht
# wird — und ein Menü mit 200 Einträgen ist ohnehin kein Menü mehr.
MAX_SEITEN = 200


def slug_fuer(page_type: PageType, slug: str, titel: str) -> str:
    """Der Slug, der zu diesem Typ gehört.

    Ein Ordner und die Fehlerseite haben KEINE eigene Adresse. Der Slug wird
    deshalb abgeleitet und nicht übernommen: einer am Ordner würde eine Seite
    versprechen, die es nicht gibt.

    Warum sie überhaupt einen bekommen: der bestehende UNIQUE
    ``(tenant_id, slug)`` aus 0087 verlangt einen Wert, und der leere gehört der
    Startseite. Er taucht in keiner Adresse auf — der Renderer findet beide über
    ``page_type``, nicht über den Pfad.
    """
    if page_type is PageType.error404:
        return "404"
    if page_type is PageType.folder and not slug:
        # Aus dem Titel, damit zwei Ordner sich nicht gegenseitig blockieren.
        roh = "".join(
            c if c.isalnum() else "-" for c in titel.strip().lower()
        ).strip("-")
        return f"ordner-{roh or 'neu'}"[:200]
    return slug


def titel_und_slug(req: PageCreate) -> tuple[str, str]:
    """Titel und Slug einer neuen Seite (0433/0434).

    Reihenfolge der Quellen, und sie ist nicht beliebig:

    1. Was der Kunde eingegeben hat. Er hat es getippt — das gewinnt immer.
    2. Der Vorschlag der gewählten Vorlage.
    3. Für Ordner und die Fehlerseite: der abgeleitete Slug (`slug_fuer`), weil
       diese Typen keine eigene Adresse haben.

    Wirft, wenn am Ende kein Titel dasteht. Eine Seite ohne Namen wäre in der
    Liste eine leere Zeile, und niemand fände sie wieder.
    """
    titel = req.title.strip()
    roh_slug = req.slug
    if req.template:
        v_titel, v_slug = vorlage_titel(req.template, "de")
        titel = titel or v_titel
        roh_slug = roh_slug or v_slug
    if not titel:
        raise ValueError("Die Seite braucht einen Titel.")
    return titel, slug_fuer(req.page_type, roh_slug, titel)


def zaehle_seiten(db: Client, tenant_id: str) -> int:
    """Wie viele Seiten der Betrieb hat. Liest höchstens ``MAX_SEITEN + 1``
    Zeilen — die genaue Zahl darüber interessiert nicht, nur dass die Grenze
    erreicht ist."""
    rows = (
        db.table("site_pages")
        .select("id")
        .eq("tenant_id", tenant_id)
        .limit(MAX_SEITEN + 1)
        .execute()
    ).data or []
    return len(rows)


def pruefe_ordner(eltern: dict) -> None:
    """Darf an dieser Zeile eine Seite hängen?

    Nur an einem echten Ordner. Der Aufrufer hat sie bereits per
    ``(id, tenant_id)`` geladen — der Tenant-Scope ist also erledigt (Wurzel 3);
    hier geht es allein um den Typ. Ohne diese Prüfung entstünde eine
    Verschachtelung, die der CHECK aus 0433 verbietet, und die Fehlermeldung
    wäre ein 23514 statt eines Satzes.
    """
    if eltern.get("page_type") != PageType.folder.value:
        raise ValueError("Übergeordnet kann nur ein Ordner sein.")


def popups_laden(db: Client, tenant_id: str) -> list[dict]:
    """Die veröffentlichten Pop-ups eines Betriebs mit ihren Auslösern (0437).

    Sie hängen an der WEBSITE und nicht an einer Seite: ein Pop-up erscheint
    überall, wo sein Auslöser greift. Eine Zuordnung „nur auf dieser Seite" gibt
    es bewusst nicht — sie wäre eine weitere Bedingung, die niemand mehr
    überblickt, und der häufigste Fall ist genau einer: ein Angebot, das jeder
    Besucher sehen soll.

    Nur VERÖFFENTLICHTE: ein Pop-up im Entwurf darf einem Gast nicht erscheinen.
    """
    rows = (
        db.table("site_pages")
        .select(
            "id, title, popup_trigger, popup_value, popup_device, popup_once"
        )
        .eq("tenant_id", tenant_id)
        .eq("page_type", PageType.popup.value)
        .eq("is_published", True)
        .order("nav_order")
        .limit(10)
        .execute()
    ).data or []
    return rows


def ist_ohne_inhalt(page_type: PageType) -> bool:
    """Typen, die NIE zur Startseite werden dürfen.

    Ein Ordner hat keinen Inhalt, die Fehlerseite als Startseite wäre die
    Website als Fehlermeldung, und ein Pop-up als Startseite wäre eine Website,
    die nur aus einem Fenster besteht. Alle drei passieren sonst automatisch,
    wenn eine solche Zeile die erste des Betriebs ist (``is_home = not
    existing``).
    """
    return page_type in (PageType.folder, PageType.error404, PageType.popup)


def duplizieren(
    db: Client, tenant_id: str, quelle: dict, page_id: str
) -> dict:
    """Eine Seite samt Blöcken kopieren (0433).

    Was NICHT mitkopiert wird, und warum jedes davon einzeln:

    * ``is_home`` — es gibt genau eine Startseite (partieller UNIQUE aus 0087).
      Eine Kopie mit ``is_home=true`` würde das Anlegen abbrechen.
    * ``is_published`` — die Kopie beginnt als ENTWURF. Sonst stünde beim ersten
      Klick auf „Duplizieren" eine zweite, halbfertige Seite live, und der
      Gast fände zwei fast gleiche Seiten (für Google: Duplicate Content).
    * ``slug`` — er ist eindeutig je Betrieb. Die Kopie bekommt ``-kopie``
      angehängt, bei Bedarf mit Zähler.
    * SEO-Felder (``seo_title``, ``seo_description``, ``canonical_url``) — sie
      beschreiben die ORIGINALSEITE. Kopiert wären sie sofort ein doppelter
      Meta-Titel, also genau der Befund, den die SEO-Prüfung meldet.
      ``head_html`` fällt aus demselben Grund weg: es enthält typischerweise das
      JSON-LD dieser einen Seite.

    Der Titel bekommt einen Zusatz, damit die Kopie in der Liste unterscheidbar
    ist. Er ist absichtlich deutsch-neutral gehalten („(Kopie)") — die
    Oberfläche kann ihn umbenennen, und ein übersetzter Titel aus dem Backend
    wäre in einem dänischen Dashboard falsch.
    """
    # Die Blöcke der Vorlage. Hier geholt und nicht übergeben, damit der
    # Aufrufer nur die Absicht kennt („diese Seite kopieren") und nicht die
    # Tabellenstruktur.
    blocks = (
        db.table("site_blocks")
        .select("type, position, content, settings")
        .eq("page_id", page_id)
        .order("position")
        .execute()
    ).data or []

    basis = quelle.get("slug") or "seite"
    slug = f"{basis}-kopie"[:200]
    # Freien Slug suchen. Der Zähler ist nötig, weil man dieselbe Seite zweimal
    # duplizieren kann — beim zweiten Mal wäre `-kopie` schon belegt und das
    # UNIQUE würde brechen (Wurzel 2).
    for n in range(2, 50):
        belegt = (
            db.table("site_pages")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("slug", slug)
            .limit(1)
            .execute()
        ).data
        if not belegt:
            break
        slug = f"{basis}-kopie-{n}"[:200]
    else:
        raise ValueError(
            "Es gibt schon zu viele Kopien dieser Seite. Bitte eine umbenennen."
        )

    neu = (
        db.table("site_pages")
        .insert(
            {
                "tenant_id": tenant_id,
                "title": f"{quelle.get('title') or ''} (Kopie)".strip(),
                "slug": slug,
                "is_home": False,
                "is_published": False,
                "page_type": quelle.get("page_type") or PageType.normal.value,
                "external_url": quelle.get("external_url"),
                "parent_id": quelle.get("parent_id"),
                "nav_area": quelle.get("nav_area") or "header",
                # Direkt hinter das Original, nicht ans Ende: eine Kopie gehört
                # neben ihre Vorlage, sonst sucht man sie in der Liste.
                "nav_order": int(quelle.get("nav_order") or 0) + 1,
                "languages": quelle.get("languages"),
                "og_image_url": quelle.get("og_image_url"),
                "noindex": bool(quelle.get("noindex")),
            }
        )
        .execute()
    ).data
    if not neu:
        raise ValueError("Die Kopie konnte nicht angelegt werden.")
    neue_id = neu[0]["id"]

    if blocks:
        db.table("site_blocks").insert(
            [
                {
                    "tenant_id": tenant_id,
                    "page_id": neue_id,
                    "type": b["type"],
                    "position": b.get("position") or i,
                    "content": b.get("content") or {},
                    "settings": b.get("settings") or {},
                }
                for i, b in enumerate(blocks)
            ]
        ).execute()
    return neu[0]


def navigation_bauen(rows: list[dict]) -> PublicNav:
    """Veröffentlichte Seiten → Menüstruktur der Kunden-Website (0433).

    Reine Umformung, kein Datenzugriff: der Service holt die Zeilen, hier
    entsteht der Baum. Drei Entscheidungen stecken darin, und jede verhindert
    einen sichtbaren Fehler:

    * Die **404-Seite** steht in keiner Navigation. Sie ist die Antwort auf eine
      falsche Adresse, kein Ziel — ein Menüpunkt „404" wäre der Beweis, dass
      niemand die Seite angesehen hat.
    * Ein Kind, dessen **Ordner nicht veröffentlicht** ist, rutscht in die
      oberste Ebene. Sonst wäre es unerreichbar, obwohl der Betrieb es
      veröffentlicht hat — und niemand würde die Ursache im Ordner suchen.
    * Ein **Ordner ohne veröffentlichte Kinder** fliegt raus. Er wäre ein
      Menüpunkt, der sich aufklappt und nichts zeigt.
    """
    # Die 404-Seite und Pop-ups stehen in KEINER Navigation: die eine ist die
    # Antwort auf eine falsche Adresse, das andere erscheint über einen
    # Auslöser. Ein Menüpunkt „404" oder „Angebot-Pop-up" wäre der Beweis, dass
    # niemand die Seite angesehen hat.
    ohne_menue = {PageType.error404.value, PageType.popup.value}
    sichtbar = [r for r in rows if r.get("page_type") not in ohne_menue]

    def eintrag(r: dict) -> PublicNavItem:
        return PublicNavItem(
            slug=r["slug"],
            title=r["title"],
            external_url=r.get("external_url"),
            is_folder=(r.get("page_type") or "") == PageType.folder.value,
        )

    # Ordner zuerst, damit ihre Kinder eingehängt werden können.
    ordner = {
        str(r["id"]): eintrag(r)
        for r in sichtbar
        if r.get("page_type") == PageType.folder.value
    }
    kopf: list[PublicNavItem] = []
    fuss: list[PublicNavItem] = []
    for r in sichtbar:
        eltern = r.get("parent_id")
        if eltern and str(eltern) in ordner:
            ordner[str(eltern)].children.append(eintrag(r))
            continue
        ziel = fuss if r["nav_area"] == "footer" else kopf
        ziel.append(
            ordner[str(r["id"])]
            if r.get("page_type") == PageType.folder.value
            else eintrag(r)
        )
    return PublicNav(
        header=[e for e in kopf if not e.is_folder or e.children],
        footer=[e for e in fuss if not e.is_folder or e.children],
    )


def fehlerseite_laden(db: Client, tenant_id: str) -> dict | None:
    """Die eigene, VERÖFFENTLICHTE 404-Seite eines Betriebs (0433).

    ``None``, wenn keine angelegt ist — der Normalfall. Der Renderer zeigt dann
    seine eingebaute Fehlerseite.

    Warum „veröffentlicht" hier zählt: eine Fehlerseite im Entwurf wäre der eine
    Fall, in dem unveröffentlichte Arbeit live ausgeliefert würde. Sie erscheint
    in keiner Vorschau-Liste und in keinem Menü — niemand würde merken, dass die
    halbfertige Fassung draußen ist.
    """
    rows = (
        db.table("site_pages")
        .select("id, title")
        .eq("tenant_id", tenant_id)
        .eq("page_type", PageType.error404.value)
        .eq("is_published", True)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def vorlage_anwenden(
    db: Client,
    tenant_id: str,
    page_id: str,
    name: str,
    firma: dict[str, str | None],
) -> None:
    """Die Abschnitte einer Seiten-Vorlage in eine frisch angelegte Seite legen
    (0434, Etappe D).

    Läuft NACH dem Anlegen der Seite und nur dann: eine Vorlage in eine Seite zu
    legen, die schon Abschnitte hat, würde sie überschreiben oder verdoppeln —
    beides wäre Datenverlust bzw. Chaos, und beides würde der Kunde erst in der
    Vorschau merken.

    Der Kontakt-Abschnitt wird aus dem FIRMENPROFIL gefüllt (`firma`), damit auf
    der Kundenseite keine Beispieladresse steht. Fehlt eine Angabe im Profil,
    bleibt das Feld leer — der Kunde sieht dann, wo er tippen muss (Wurzel 4).

    Ein unbekannter Vorlagenname ist ein Fehler des Aufrufers und wirft: still
    eine leere Seite anzulegen würde vortäuschen, die Vorlage sei angewendet
    worden.
    """
    vorlage = seiten_vorlagen.VORLAGEN.get(name)
    if not vorlage:
        raise ValueError(f"Unbekannte Seiten-Vorlage: {name}")

    zeilen = []
    for i, block in enumerate(vorlage["blocks"]):
        inhalt = dict(block.get("content") or {})
        if block["type"] == "contact":
            # Dieselbe Quelle wie überall: `kontakt_mit_firmendaten` setzt
            # E-Mail, Telefon und Anschrift aus dem Konto ein.
            inhalt = konto_daten.kontakt_mit_firmendaten(inhalt, firma)
        zeilen.append(
            {
                "tenant_id": tenant_id,
                "page_id": page_id,
                "type": block["type"],
                "position": i,
                "content": inhalt,
                "settings": block.get("settings") or {},
            }
        )
    if zeilen:
        db.table("site_blocks").insert(zeilen).execute()


def vorlage_titel(name: str, sprache: str) -> tuple[str, str]:
    """Titel und Slug-Vorschlag einer Vorlage.

    Der Titel kommt in der Sprache des Dashboards, mit Englisch als Rückfall —
    nicht Deutsch: der Fall tritt nur bei einer Sprache ein, für die die Vorlage
    keinen Text hat, und Englisch versteht in dieser Lage mehr.

    ``("", "")`` bei unbekanntem Namen; der Aufrufer behandelt das wie „keine
    Vorlage" und lässt den Titel des Kunden stehen.
    """
    vorlage = seiten_vorlagen.VORLAGEN.get(name)
    if not vorlage:
        return "", ""
    titel = vorlage["titel"]
    return titel.get(sprache) or titel.get("en") or "", vorlage["slug"]


# === Blog (0438, Etappe H) ==================================================
# Wie viele Beiträge eine Liste höchstens liefert. Ohne Deckel ist die
# Beitragsliste ein unbegrenzter Bereich (Wurzel 8) — sie wandert vollständig in
# die Blog-Seite und in den RSS-Feed.
MAX_BEITRAEGE = 100


def beitraege_laden(
    db: Client,
    tenant_id: str,
    *,
    limit: int = 20,
    offset: int = 0,
    tag: str | None = None,
) -> list[dict]:
    """Veröffentlichte Blog-Beiträge, neueste zuerst (0438).

    Sortiert nach ``published_at`` und NICHT nach ``created_at``: das eine ist
    das Datum des Textes, das andere der Zeitpunkt, zu dem die Zeile entstand.
    Ein Betrieb, der einen älteren Text nachträgt, will ihn an der richtigen
    Stelle sehen (Wurzel 5b — unsere Uhr ist nicht der Zeitpunkt des
    Ereignisses).

    Beiträge mit einem Datum in der ZUKUNFT bleiben aus: das ist die
    Vorplanung. Sie erscheinen von selbst, sobald der Zeitpunkt erreicht ist —
    ohne Hintergrundlauf, weil die Abfrage ihn bei jedem Aufruf neu vergleicht.
    """
    query = (
        db.table("site_pages")
        .select(
            "id, slug, title, excerpt, author, cover_image_url, tags, "
            "published_at, seo_description"
        )
        .eq("tenant_id", tenant_id)
        .eq("page_type", PageType.post.value)
        .eq("is_published", True)
        .lte("published_at", datetime.now(UTC).isoformat())
    )
    if tag:
        # `contains` auf text[]: „dieser Beitrag trägt dieses Schlagwort".
        query = query.contains("tags", [tag])
    rows = (
        query.order("published_at", desc=True)
        .range(offset, offset + min(limit, MAX_BEITRAEGE) - 1)
        .execute()
    ).data or []
    return rows


def beitrag_laden(db: Client, tenant_id: str, slug: str) -> dict | None:
    """Ein einzelner Beitrag über seinen Slug.

    Auch hier zählt das Erscheinungsdatum: ein vorgeplanter Beitrag ist über
    seine Adresse NICHT erreichbar, bevor er dran ist. Sonst wäre die Planung
    wirkungslos, sobald jemand den Link kennt — und Links werden geteilt.
    """
    rows = (
        db.table("site_pages")
        .select(
            "id, slug, title, excerpt, author, cover_image_url, tags, "
            "published_at, seo_title, seo_description, og_image_url, noindex"
        )
        .eq("tenant_id", tenant_id)
        .eq("page_type", PageType.post.value)
        .eq("is_published", True)
        .eq("slug", slug)
        .lte("published_at", datetime.now(UTC).isoformat())
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None
