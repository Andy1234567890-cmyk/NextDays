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

import nh3
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field, field_validator
from supabase import Client

from src.core.logging import get_logger
from src.features.auth.permissions import Capability, has_capability

from . import (
    beitrag_eigene_felder,
    konto_daten,
    popup_vorlagen,
    seiten_vorlagen,
)
from .basis import (
    _RICH_TEXT_ATTRS,
    _RICH_TEXT_TAGS,
    _validate_href,
    ascii_slug,
)
from .schemas import PageCreate, PageType, PublicNav, PublicNavItem

# Höchstzahl der Seiten je Betrieb.
#
# Ohne Deckel ist die Seitenliste ein unbegrenzter Bereich (Wurzel 8): sie
# wandert vollständig in jede Baukasten-Ansicht, in die Navigation JEDER
# Gast-Seite und in die Sitemap.
#
# 1000, dieselbe Grenze wie bei Hostaway. Vorher standen hier 200 mit der
# Begründung, ein Menü mit 200 Einträgen sei ohnehin keines mehr — das stimmt,
# geht aber am Fall vorbei: die meisten Seiten eines großen Betriebs stehen gar
# nicht im Menü (`nav_area = none`). Es sind Landingpages für Kampagnen,
# Objektbeschreibungen, saisonale Seiten. Eine Verwaltung mit 60 Häusern kommt
# damit über 200, und die Grenze hätte sie ausgesperrt, ohne dass jemand den
# Grund gesehen hätte.
MAX_SEITEN = 1000


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
    if page_type in (PageType.folder, PageType.popup) and not slug:
        # Aus dem Titel, damit zwei Ordner bzw. zwei Pop-ups sich nicht
        # gegenseitig blockieren.
        #
        # Fuer Pop-ups seit 0440, und der Anlass war ein echter Fehlschlag: ein
        # Pop-up ohne Slug bekam den LEEREN — und der gehoert der Startseite.
        # Das Anlegen brach mit „Es gibt bereits eine Seite mit diesem Slug" ab,
        # einer Meldung, die auf ein Problem zeigt, das der Kunde nicht hat.
        # Ein Pop-up hat ohnehin keine eigene Adresse: der Slug ist hier nur ein
        # technischer Schluessel fuer den UNIQUE aus 0087.
        praefix = "ordner" if page_type is PageType.folder else "popup"
        return f"{praefix}-{ascii_slug(titel) or 'neu'}"[:200]
    return slug


def slug_belegt(
    db: Client,
    tenant_id: str,
    slug: str,
    page_type: str,
    *,
    ausser_id: str | None = None,
) -> bool:
    """Ist dieser Slug im ADRESSRAUM dieses Seitentyps schon vergeben? (0484)

    Beiträge und Seiten haben getrennte Adressräume, und zwar schon im
    Renderer::

        Seite    →  /<slug>          (builder/app/[slug]/page.tsx)
        Beitrag  →  /blog/<slug>     (builder/app/blog/[slug]/page.tsx)

    Ein Beitrag „Kontakt" und eine Seite „Kontakt" sind deshalb KEIN Konflikt.
    Bis 0484 waren sie einer: der UNIQUE lief über alle Typen, und das Anlegen
    brach mit „Es gibt bereits eine Seite mit diesem Slug" ab — einer Meldung,
    die auf ein Problem zeigt, das der Kunde nicht hat.

    Die Prüfung steht HIER und nicht zweimal im Service: Anlegen und Ändern
    fragen dieselbe Frage, und zwei Kopien wären zwei Wahrheiten, von denen
    beim nächsten Seitentyp nur eine gepflegt wird (Wurzel 2).

    Sie ist der VORLAUF zur DB, nicht ihr Ersatz: die beiden Teil-Indizes aus
    0484 sind der harte Backstop. Diese Abfrage liefert nur die Meldung, die
    der Kunde lesen kann, statt eines nackten 23505.
    """
    ist_beitrag = page_type == PageType.post.value
    query = (
        db.table("site_pages")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("slug", slug)
    )
    # Genau die Trennlinie der beiden Teil-Indizes: der Blog gegen alles
    # andere. NICHT `eq("page_type", …)` — sonst dürften eine normale Seite
    # und ein Ordner denselben Slug tragen, obwohl beide unter `/<slug>`
    # liegen.
    query = (
        query.eq("page_type", PageType.post.value)
        if ist_beitrag
        else query.neq("page_type", PageType.post.value)
    )
    if ausser_id:
        query = query.neq("id", ausser_id)
    return bool((query.limit(1).execute()).data)


def slug_konflikt_text(page_type: str) -> str:
    """Die Meldung zum Slug-Konflikt — im Wortlaut des betroffenen Raums.

    „Es gibt bereits eine Seite mit diesem Slug" war fuer einen Beitrag
    irrefuehrend: der Kunde sucht danach in der Seitenliste, wo nichts steht.
    Ein Konflikt im Blog nennt den Blog.
    """
    if page_type == PageType.post.value:
        return "Es gibt bereits einen Beitrag mit dieser Adresse."
    return "Es gibt bereits eine Seite mit diesem Slug."


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
        # Der Katalog haengt am TYP. Ohne diese Unterscheidung wuerde ein
        # Pop-up seinen Titel im Seiten-Katalog suchen: bei `kontakt` faende es
        # ihn zufaellig (der Name steht in beiden), bei `willkommen` nicht — und
        # das Anlegen braeche mit „Die Seite braucht einen Titel" ab, obwohl der
        # Kunde eine Vorlage gewaehlt hat.
        if req.page_type is PageType.popup:
            titel = titel or popup_vorlage_titel(req.template, "de")
        else:
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


#: Wie viele Ebenen die Navigation tief sein darf. Dieselbe Grenze wie bei
#: Hostaway („Navigation can have up to three levels").
#:
#: Warum überhaupt eine: ein Menü, das sich beliebig tief schachtelt, ist auf
#: dem Telefon nicht mehr bedienbar — man müsste vier Aufklapp-Ebenen treffen.
#: Und die Brotkrumen-Zeile würde länger als die Überschrift.
MAX_EBENEN = 3


def pruefe_eltern(db: Client, tenant_id: str, eltern: dict) -> None:
    """Darf an dieser Zeile eine Seite hängen? (0433, erweitert 0443)

    Zwei Fragen, und beide müssen ja sein:

    1. **Der Typ.** Ein Ordner oder eine normale Seite dürfen Kinder haben.
       Ein externer Menüpunkt nicht (er führt nach draußen), ein Pop-up nicht
       (es steht in keinem Menü), die Fehlerseite nicht.

       Bis 0442 durfte NUR ein Ordner Elternteil sein. Das war zu eng: Hostaway
       lässt eine Seite unter einer Seite hängen, und das ist der Normalfall —
       „Häuser" mit „Haus am See" darunter braucht keinen leeren Ordner
       dazwischen.

    2. **Die Tiefe.** Höchstens drei Ebenen. Gezählt wird nach OBEN: wie viele
       Eltern hat die Zeile schon über sich? Zwei sind erlaubt, denn das Kind
       wird die dritte.

    Der Aufstieg ist gedeckelt und bricht bei einer Wiederholung ab. Der
    Fremdschlüssel verhindert keine Kreise (A → B → A), und ein ungedeckelter
    Aufstieg würde bei einem solchen Kreis ewig laufen — im Zweifel im
    Web-Prozess, mitten in einer Anfrage.
    """
    erlaubt = (PageType.folder.value, PageType.normal.value)
    if eltern.get("page_type") not in erlaubt:
        raise ValueError(
            "Übergeordnet kann nur ein Ordner oder eine normale Seite sein."
        )

    gesehen = {str(eltern["id"])}
    tiefe = 1
    aktuell = eltern
    while aktuell.get("parent_id"):
        eltern_id = str(aktuell["parent_id"])
        if eltern_id in gesehen:
            raise ValueError("Die Seiten hängen im Kreis ineinander.")
        gesehen.add(eltern_id)
        tiefe += 1
        if tiefe >= MAX_EBENEN:
            raise ValueError(
                f"Mehr als {MAX_EBENEN} Menü-Ebenen sind nicht möglich."
            )
        rows = (
            db.table("site_pages")
            .select("id, parent_id")
            .eq("id", eltern_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            # Der Elternteil gehört einem anderen Betrieb oder ist weg. Beides
            # ist kein Grund weiterzusteigen — und kein Grund, die neue Seite
            # abzulehnen: die Kette endet hier.
            break
        aktuell = rows[0]


def pfad_bauen(db: Client, tenant_id: str, seite: dict) -> list[dict]:
    """Der Weg von oben bis zur ELTERN-Seite — für den Brotkrumen-Abschnitt (0450).

    Die aktuelle Seite steht NICHT darin: sie ist der Endpunkt, und ob sie
    angezeigt wird, entscheidet der Abschnitt selbst (`show_current`). Der
    Renderer hat ihren Titel ohnehin.

    Aufgestiegen wird über ``parent_id``, gedeckelt auf ``MAX_EBENEN`` und mit
    Kreis-Erkennung — aus demselben Grund wie in ``pruefe_eltern``: der
    Fremdschlüssel verhindert A → B → A nicht, und ein ungedeckelter Aufstieg
    liefe mitten in einer Anfrage endlos.

    Ein Eintrag OHNE ``slug`` ist ein Ordner. Ordner haben keine Adresse (0433),
    also rendert der Renderer sie als Text statt als Link. Ihn wegzulassen wäre
    falsch — der Ordner ist die Ebene, in der die Seite liegt, und genau das
    soll die Krume zeigen.

    Unveröffentlichte Eltern bleiben ebenfalls als Text stehen: ihr Titel ist
    Teil der Struktur, aber ein Link dorthin ginge auf eine Seite, die der Gast
    nicht sehen darf.
    """
    pfad: list[dict] = []
    gesehen = {str(seite["id"])}
    eltern_id = seite.get("parent_id")
    while eltern_id and len(pfad) < MAX_EBENEN:
        eltern_id = str(eltern_id)
        if eltern_id in gesehen:
            break
        gesehen.add(eltern_id)
        rows = (
            db.table("site_pages")
            .select("id, slug, title, parent_id, page_type, is_published")
            .eq("id", eltern_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            # Elternteil weg oder fremder Betrieb: die Kette endet hier. Kein
            # erfundener Platzhalter (Wurzel 4).
            break
        row = rows[0]
        verlinkbar = (
            row.get("page_type") == PageType.normal.value
            and bool(row.get("is_published"))
        )
        pfad.append(
            {
                "title": row.get("title") or "",
                "slug": row.get("slug") if verlinkbar else None,
            }
        )
        eltern_id = row.get("parent_id")
    # Aufgestiegen wurde von unten nach oben; angezeigt wird von oben nach unten.
    pfad.reverse()
    return pfad


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
            "id, title, popup_trigger, popup_value, popup_device, popup_once, "
            "popup_position"
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
    return page_type in (
        PageType.folder,
        PageType.error404,
        PageType.popup,
        # 0466: Eine Systemseite als Startseite wäre eine Website, die mit einer
        # Objekt-Detailseite ohne gewähltes Objekt beginnt.
        PageType.system,
    )


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


def popup_vorlage_anwenden(
    db: Client,
    tenant_id: str,
    page_id: str,
    name: str,
) -> str | None:
    """Die Abschnitte einer POP-UP-Vorlage in ein frisch angelegtes Pop-up legen
    (0440).

    Getrennt von `vorlage_anwenden` und nicht als Sonderfall darin: die beiden
    Kataloge haben verschiedene Einträge, verschiedene Blocktypen und einen
    verschiedenen Zweck. Ein gemeinsamer Namensraum hiesse, dass ein Kunde
    versehentlich die Seiten-Vorlage `kontakt` in ein Pop-up legen kann — mit
    einem ganzseitigen Abschnitts-Satz in einem Fenster.

    Gibt die vorgeschlagene POSITION zurück, damit der Aufrufer sie an der Seite
    speichern kann: ein Kontakt-Pop-up gehoert unten rechts, ein Willkommen in
    die Mitte. Das ist Teil der Vorlage und keine zweite Entscheidung.

    Ein unbekannter Name wirft — still ein leeres Pop-up anzulegen wuerde
    vortaeuschen, die Vorlage sei angewendet worden.
    """
    vorlage = popup_vorlagen.VORLAGEN.get(name)
    if not vorlage:
        raise ValueError(f"Unbekannte Pop-up-Vorlage: {name}")
    zeilen = [
        {
            "tenant_id": tenant_id,
            "page_id": page_id,
            "type": block["type"],
            "position": i,
            "content": dict(block.get("content") or {}),
            "settings": block.get("settings") or {},
        }
        for i, block in enumerate(vorlage["bloecke"])
    ]
    if zeilen:
        db.table("site_blocks").insert(zeilen).execute()
    return vorlage.get("position")


def popup_vorlage_titel(name: str, sprache: str) -> str:
    """Titelvorschlag einer Pop-up-Vorlage; leer bei unbekanntem Namen."""
    vorlage = popup_vorlagen.VORLAGEN.get(name)
    if not vorlage:
        return ""
    titel = vorlage["titel"]
    return titel.get(sprache) or titel.get("en") or ""


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

# Zeichen, die in einem Suchbegriff KEINE Suche sind, sondern Muster: `%` und
# `_` sind SQL-Platzhalter, `*` ist PostgREST' Schreibweise für `%`. Sie werden
# entfernt und nicht maskiert — PostgREST kennt für `ilike` keine
# Escape-Syntax, und wer nach einem Unterstrich sucht, sucht nach nichts.
_SUCH_MUSTERZEICHEN = str.maketrans({"%": None, "_": None, "*": None, "\\": None})


def suchbegriff_saeubern(roh: str | None) -> str | None:
    """Ein Suchbegriff ohne Musterzeichen, oder ``None``.

    ``None`` heißt „nicht gesucht" und ist etwas anderes als „nichts gefunden":
    ein Feld, in dem nur ein `%` stand, darf nicht die ganze Liste als Treffer
    ausgeben.
    """
    if roh is None:
        return None
    wert = roh.translate(_SUCH_MUSTERZEICHEN).strip()
    return wert or None


def beitraege_laden(
    db: Client,
    tenant_id: str,
    *,
    limit: int = 20,
    offset: int = 0,
    tag: str | None = None,
    tags: list[str] | None = None,
    q: str | None = None,
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

    ``tag`` filtert auf EIN Schlagwort (die Filterleiste der Blog-Seite),
    ``tags`` auf eine Auswahl MEHRERER (der „Alle Beiträge"-Abschnitt, 0457).
    Die Auswahl ist ein ODER: der Kunde stellt eine Kachel „Angebote und Tipps"
    zusammen, kein Beitrag trägt beide Schlagwörter, und ein UND würde eine leere
    Kachel ergeben.

    ``q`` sucht NUR im Titel — nicht im Inhalt. Der liegt als Abschnitts-JSONB je
    Sprache und wäre ein Scan über alle Blöcke aller Beiträge bei jedem
    Tastendruck; und ein Treffer mitten im Text zeigt in der Ergebnisliste
    trotzdem nur den Titel.
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
        # Die ZWEITE Sichtbarkeitsachse (0481). Sie gilt fuer die UEBERSICHT
        # und nicht fuer die Adresse: ein Beitrag, den der Betrieb aus der
        # Liste genommen hat, bleibt ueber seinen Link erreichbar — sonst
        # waeren geteilte Links plötzlich tot, und „nicht in der Uebersicht"
        # hiesse in Wahrheit „zurueckgezogen". Genau diese Trennung ist der
        # Grund fuer die zweite Achse (Framer-Analyse Abschnitt G); deshalb
        # steht in `beitrag_laden` bewusst KEIN solcher Filter.
        .eq("show_on_homepage", True)
        .lte("published_at", datetime.now(UTC).isoformat())
    )
    if tag:
        # `contains` auf text[]: „dieser Beitrag trägt dieses Schlagwort".
        query = query.contains("tags", [tag])
    if tags:
        # `overlaps` = Schnittmenge nicht leer: „trägt EINES dieser
        # Schlagwörter". Der Deckel ist derselbe wie am Beitrag (acht) — eine
        # längere Auswahl kann es nicht geben, weil es nicht mehr gibt.
        query = query.overlaps("tags", tags[:8])
    begriff = suchbegriff_saeubern(q)
    if begriff:
        query = query.ilike("title", f"%{begriff}%")
    rows = (
        query.order("published_at", desc=True)
        .range(offset, offset + min(limit, MAX_BEITRAEGE) - 1)
        .execute()
    ).data or []
    return rows


#: Die Felder aus 0483, die in der DB einen `post_`-Praefix tragen.
#:
#: Nach aussen heissen sie ohne (`industry`), in `site_pages` mit
#: (`post_industry`) — dort teilen sie die Tabelle mit den Spalten normaler
#: Seiten, und `client` oder `industry` ohne Praefix laesen sich dort wie
#: Angaben zur SEITE.
BEITRAGSFELDER_MIT_PRAEFIX = (
    "industry",
    "client",
    "full_title",
    "intro_heading",
    "intro_body",
    "button_text",
    "website_link",
    "gallery_top",
    "gallery_left",
    "gallery_right",
    "gallery_bottom",
    "final_heading",
    "final_body",
    "show_carousel",
    "carousel_1",
    "carousel_2",
    "carousel_3",
    "carousel_4",
    # 0485 — die Werte der EIGENEN Felder. Sie stehen in derselben Liste, weil
    # sie dieselbe Umbenennung brauchen (`post_custom` → `custom`): Lesen,
    # Schreiben und die Spaltenliste ziehen alle aus dieser einen Quelle. Eine
    # zweite Sonderbehandlung daneben waere die Stelle, die beim naechsten
    # Feld vergessen wird (Wurzel 2).
    "custom",
)


#: Die Spalten der OEFFENTLICHEN Beitragsseite.
#:
#: Sie traegt seit 0483/0485 die Vorlagenfelder und die eigenen Werte mit.
#: Bis dahin lud dieser Weg sie gar nicht — im CMS liessen sie sich pflegen,
#: auf der Website erschien nichts davon. Ein Feld, das man ausfuellen kann
#: und das nie erscheint, ist eine Attrappe mit Datenhaltung (gemeldet am
#: 28.08.2026: „das alles wird im Preview nicht angezeigt").
#:
#: Erzeugt aus `BEITRAGSFELDER_MIT_PRAEFIX` und nicht ausgeschrieben: dieselbe
#: Liste speist Lesen, Schreiben und die Dashboard-Spalten (Wurzel 2).
_OEFFENTLICHER_BEITRAG = (
    "id, slug, title, excerpt, author, cover_image_url, tags, "
    "published_at, seo_title, seo_description, og_image_url, "
    "og_image_alt, noindex, content_html, parent_post_id, view_count"
    + "".join(f", post_{n}" for n in BEITRAGSFELDER_MIT_PRAEFIX)
)


def beitrag_laden(db: Client, tenant_id: str, slug: str) -> dict | None:
    """Ein einzelner Beitrag über seinen Slug.

    Auch hier zählt das Erscheinungsdatum: ein vorgeplanter Beitrag ist über
    seine Adresse NICHT erreichbar, bevor er dran ist. Sonst wäre die Planung
    wirkungslos, sobald jemand den Link kennt — und Links werden geteilt.
    """
    rows = (
        db.table("site_pages")
        .select(_OEFFENTLICHER_BEITRAG)
        .eq("tenant_id", tenant_id)
        .eq("page_type", PageType.post.value)
        .eq("is_published", True)
        .eq("slug", slug)
        .lte("published_at", datetime.now(UTC).isoformat())
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return None
    _aufruf_zaehlen(db, str(rows[0]["id"]))
    return rows[0]


def _aufruf_zaehlen(db: Client, page_id: str) -> None:
    """Einen Aufruf zählen — EINE Anweisung in der Datenbank (0480).

    Nicht lesen-rechnen-schreiben: zwei gleichzeitige Besucher läsen beide
    denselben Stand und schrieben beide denselben Nachfolger, und ein Aufruf
    wäre verloren (Wurzel 2). Das Vorbild macht genau diesen Fehler.

    Best-effort mit Absicht — ein Zähler darf die Seite nicht kosten. Aber
    LAUT protokolliert und nicht stumm verschluckt: ein Zähler, der dauerhaft
    stehen bleibt, ist sonst nicht zu bemerken (Wurzel 5).
    """
    try:
        db.rpc("bump_page_view", {"p_page_id": page_id}).execute()
    except APIError as exc:  # noqa: BLE001  # pragma: no cover - Nebenpfad
        log.warning("Aufrufzähler nicht erhöht (%s): %s", page_id, exc)


def beitraege_ordnen(db: Client, tenant_id: str, ids: list[str]) -> None:
    """Die Handsortierung der Beitragsliste setzen (Ziehgriff an der Zeile).

    EINE Anweisung (`set_post_order`, 0480) und keine Schleife über
    Einzel-Updates: eine Liste mit 200 Beiträgen wäre sonst je Verschiebung
    200 Netzwerkrunden, von denen jede für sich scheitern kann — ein Abbruch
    in der Mitte ließe die Liste halb sortiert zurück.
    """
    if not ids:
        return
    db.rpc(
        "set_post_order",
        {"p_tenant_id": tenant_id, "p_ids": ids[:MAX_BEITRAEGE]},
    ).execute()


# --- Beitrags-Pflege (0457) --------------------------------------------------
# Der Blog aus 0438 konnte einen Beitrag ZEIGEN, aber nicht pflegen: `PageUpdate`
# kennt die Beitragsfelder nicht, also war ein Beitrag nach dem Anlegen in Datum,
# Autor, Titelbild, Anriss und Schlagwörtern eingefroren. Genau das braucht ein
# Blog aber am häufigsten — „das Datum verschieben", „den Autor korrigieren".
#
# Eigenes Schema und ein eigener Endpunkt statt einer Erweiterung von
# `PageUpdate`: die Beitragsfelder gelten NUR für `page_type='post'` (der CHECK
# aus 0438 erzwingt das). An `PageUpdate` gehängt wären sie an jeder Seite
# sichtbar und würden dort mit einem Datenbankfehler enden statt mit einer
# Antwort, die den Grund nennt.

# Höchstlänge eines Schlagworts. Ohne Deckel wandert ein beliebig langer Text in
# jede Filterleiste und in jede Beitragskarte (Wurzel 8).
log = get_logger("nextdays.site_config.seiten")

MAX_TAG_LAENGE = 60
#: Wie viele Bilder in EINE Galerie passen (0483).
#:
#: Eine harte Obergrenze und kein offenes Feld: jede unbegrenzte Liste ist ein
#: Angriffspunkt (Wurzel 8 — „Jeder unbegrenzte Bereich bekommt eine harte
#: Obergrenze → 422"). 24 ist grosszuegig fuer eine Bildstrecke und klein
#: genug, dass eine Beitragszeile nicht ins Uferlose waechst.
MAX_GALERIE = 24

#: Höchstlänge des Beitragstextes in Zeichen (0480). Ein Feld ohne Grenze ist
#: eines, in das jemand ein Megabyte schreibt — und das steht danach in JEDER
#: Antwort, die den Beitrag trägt (Wurzel 8).
MAX_BEITRAG_HTML = 200_000


def beitrags_slug(titel: str) -> str:
    """Der Slug eines Beitrags aus seinem Titel.

    Öffentlich, weil der RSS-Import ihn braucht: er ist dort der Schlüssel, an
    dem ein zweiter Importlauf erkennt, dass es diesen Beitrag schon gibt. Die
    Regel muss dieselbe sein wie beim Anlegen von Hand — zwei Slug-Bildungen
    hießen zwei Fassungen desselben Beitrags."""
    return ascii_slug(titel)[:200].strip("-")


class BeitragUpdate(BaseModel):
    """Die Felder EINES Beitrags — Planung, Details und Beitrags-SEO.

    ``exclude_unset`` beim Anwenden ist hier tragend: ein Feld, das der Client
    nicht schickt, bleibt unverändert; ein ausdrücklich als ``null`` gesendetes
    wird geleert. Ohne diese Unterscheidung würde das Speichern des SEO-Reiters
    den Autor löschen, weil das Formular ihn gar nicht kennt.
    """

    # Erscheinungsdatum. In der ZUKUNFT = geplant: der Beitrag erscheint von
    # selbst, sobald der Zeitpunkt erreicht ist (`beitraege_laden`/`beitrag_laden`
    # vergleichen bei jedem Aufruf gegen `now()`), und ist vorher weder in der
    # Liste noch über seine Adresse noch im Feed zu sehen.
    published_at: datetime | None = None
    author: str | None = Field(default=None, max_length=120)
    cover_image_url: str | None = None
    excerpt: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = Field(default=None, max_length=8)
    # --- Blog-CMS (0480) -----------------------------------------------------
    #: Der Beitragstext als HTML. Er wird beim Speichern gegen dieselbe
    #: Allowlist gesäubert wie der Rich-Text-Abschnitt — was der Editor
    #: schreiben darf, steht in `web/.../blog/tiptap-erweiterungen.ts`, und
    #: beide Listen gehören zusammen (Wurzel 8).
    content_html: str | None = Field(default=None, max_length=MAX_BEITRAG_HTML)
    #: Die Werte der EIGENEN Felder (0485). Ein Teil-Objekt: gesendete
    #: Schluessel werden gesetzt, nicht gesendete bleiben, ein ausdrueckliches
    #: `null` leert das Feld. Ein VOLLSTAENDIGES Objekt zu verlangen hiesse,
    #: dass ein Formular, das nur ein Feld kennt, alle anderen loescht — genau
    #: die Falle, gegen die `exclude_unset` am ganzen Modell steht.
    custom: dict[str, object] | None = None
    #: Das Buch, dessen Kapitel dieser Beitrag ist.
    parent_post_id: str | None = None
    #: Der Autor als Konto des Betriebs.
    author_user_id: str | None = None
    is_archived: bool | None = None
    # --- Zweite Sichtbarkeitsachse (0481) ------------------------------------
    #: Erscheint der Beitrag in der Beitragsuebersicht? Getrennt von
    #: `is_published`: „fertig" und „wo sichtbar" sind zwei Fragen. Ein
    #: fertiger Beitrag laesst sich damit von der Uebersicht nehmen, ohne ihn
    #: zurueckzuziehen — dasselbe Muster wie `listed_on_marketplace` beim
    #: Objekt.
    show_on_homepage: bool | None = None
    # --- Beitragsfelder aus der Framer-Feldliste (0483) ---------------------
    #
    # Zwei Arten Bildfeld: `gallery_top`/`gallery_bottom` tragen MEHRERE
    # Bilder, `gallery_left`/`gallery_right` je EINES. Das Vorbild macht das
    # ausdrücklich so (Analyse C, Feld 14/15) — wer alle vier gleich baut,
    # baut zwei davon falsch.
    industry: str | None = Field(default=None, max_length=120)
    client: str | None = Field(default=None, max_length=120)
    full_title: str | None = Field(default=None, max_length=300)
    intro_heading: str | None = Field(default=None, max_length=300)
    intro_body: str | None = Field(default=None, max_length=5000)
    button_text: str | None = Field(default=None, max_length=80)
    website_link: str | None = None
    gallery_top: list[str] | None = Field(default=None, max_length=MAX_GALERIE)
    gallery_left: str | None = None
    gallery_right: str | None = None
    gallery_bottom: list[str] | None = Field(
        default=None, max_length=MAX_GALERIE
    )
    final_heading: str | None = Field(default=None, max_length=300)
    final_body: str | None = Field(default=None, max_length=5000)
    show_carousel: bool | None = None
    carousel_1: str | None = None
    carousel_2: str | None = None
    carousel_3: str | None = None
    carousel_4: str | None = None

    _v_website_link = field_validator("website_link")(_validate_href)
    _v_gal_left = field_validator("gallery_left")(_validate_href)
    _v_gal_right = field_validator("gallery_right")(_validate_href)
    _v_car1 = field_validator("carousel_1")(_validate_href)
    _v_car2 = field_validator("carousel_2")(_validate_href)
    _v_car3 = field_validator("carousel_3")(_validate_href)
    _v_car4 = field_validator("carousel_4")(_validate_href)

    @field_validator("gallery_top", "gallery_bottom")
    @classmethod
    def _galerie_pruefen(cls, v: list[str] | None) -> list[str] | None:
        """Jede Bildadresse einer Galerie einzeln prüfen.

        Eine Liste ist kein Freibrief: ohne diese Prüfung käme
        `javascript:…` an der Galerie durch, während dasselbe Ziel am
        Einzelbild abgewiesen wird (Wurzel 8). Leere Einträge fliegen raus —
        eine leere Adresse ist kein Bild, sondern eine Lücke im Raster.
        """
        if v is None:
            return None
        sauber: list[str] = []
        for roh in v:
            wert = (roh or "").strip()
            if not wert:
                continue
            sauber.append(_validate_href(wert))
        return sauber

    # --- Beitrags-SEO -------------------------------------------------------
    seo_title: str | None = Field(default=None, max_length=200)
    seo_description: str | None = Field(default=None, max_length=500)
    og_image_url: str | None = None
    og_image_alt: str | None = Field(default=None, max_length=200)
    noindex: bool | None = None

    _v_cover = field_validator("cover_image_url")(_validate_href)
    _v_og = field_validator("og_image_url")(_validate_href)

    @field_validator("content_html")
    @classmethod
    def _text_saeubern(cls, v: str | None) -> str | None:
        """Den Beitragstext mit einem echten Allowlist-Parser säubern.

        NICHT per Regex und NICHT erst beim Rendern: der Wert wird gespeichert
        und danach von mehreren Stellen gelesen (Seite, Feed, Vorschau). Wer
        ihn beim Ausliefern säubert, säubert ihn irgendwann an einer Stelle
        nicht (Wurzel 8). `nh3` parst echtes HTML und entfernt damit auch
        `<svg onload=…>` und unquotierte `javascript:`-Ziele.
        """
        if v is None:
            return None
        sauber = nh3.clean(
            v,
            tags=_RICH_TEXT_TAGS,
            attributes=_RICH_TEXT_ATTRS,
            url_schemes={"http", "https", "mailto", "tel"},
            link_rel="noopener noreferrer nofollow",
        ).strip()
        return sauber or None

    @field_validator("tags")
    @classmethod
    def _schlagwoerter(cls, v: list[str] | None) -> list[str] | None:
        """Leere Einträge fliegen raus, Duplikate auch.

        Kein Fehler dafür: ein doppelt getipptes Schlagwort ist ein Vertipper,
        kein Angriff — und zwei gleiche Filterknöpfe wären das Ergebnis. Zu lang
        ist dagegen ein Fehler: eine stille Kürzung würde ein Schlagwort
        erfinden, das der Kunde nie eingegeben hat (Wurzel 4)."""
        if v is None:
            return None
        sauber: list[str] = []
        for roh in v:
            wert = roh.strip()
            if not wert:
                continue
            if len(wert) > MAX_TAG_LAENGE:
                raise ValueError(
                    f"Ein Schlagwort darf höchstens {MAX_TAG_LAENGE} Zeichen "
                    "haben."
                )
            if wert not in sauber:
                sauber.append(wert)
        return sauber


class BeitragResponse(BeitragUpdate):
    """Ein Beitrag, wie ihn das Dashboard liest und zurückbekommt.

    Erbt die Felder von `BeitragUpdate` und ergänzt, was nur der Server weiß:
    die Kennung, den Slug und ob der Beitrag live ist. Der Slug reist mit, weil
    das Dashboard daraus den Permalink baut — und der ist der Grund, warum ein
    Kunde diesen Dialog überhaupt öffnet."""

    id: str
    slug: str
    title: str
    is_published: bool = False
    #: Aufrufe der öffentlichen Beitragsseite (0480). Nur lesbar — erhöht wird
    #: sie in der Datenbank beim öffentlichen Abruf, nicht über diese Antwort.
    view_count: int = 0


# Die Spalten eines Beitrags. Eine Liste und kein `*`: `select("*")` würde bei
# jeder neuen Spalte an `site_pages` stillschweigend mehr ausliefern, als diese
# Antwort verspricht.
_BEITRAG_SPALTEN = (
    "id, slug, title, is_published, published_at, author, cover_image_url, "
    "excerpt, tags, seo_title, seo_description, og_image_url, og_image_alt, "
    "noindex, "
    # 0480: Text, Kapitel, Autor-Konto, Archiv.
    "content_html, parent_post_id, author_user_id, is_archived, view_count, "
    # 0481: die zweite Sichtbarkeitsachse.
    "show_on_homepage, "
    # 0483: die Felder aus der Framer-Feldliste.
    "post_industry, post_client, post_full_title, post_intro_heading, "
    "post_intro_body, post_button_text, post_website_link, "
    "post_gallery_top, post_gallery_left, post_gallery_right, "
    "post_gallery_bottom, post_final_heading, post_final_body, "
    "post_show_carousel, post_carousel_1, post_carousel_2, "
    "post_carousel_3, post_carousel_4, "
    # 0485: die Werte der EIGENEN Felder.
    "post_custom"
)


def beitragsfelder_ohne_praefix(row: dict) -> dict:
    """Die Beitragsfelder einer DB-Zeile ohne ihren ``post_``-Praefix (0483).

    In ``site_pages`` heissen sie ``post_industry``, nach aussen ``industry``.
    Der Praefix ist dort noetig, weil die Tabelle sich mit den Spalten normaler
    Seiten teilt und ``client`` ohne ihn wie eine Angabe zur SEITE laese.

    Nur gesetzte Werte: ein fehlender Schluessel laesst den Schema-Default
    greifen, ``None`` wuerde ihn ueberschreiben (dieselbe Regel wie in
    ``_page_row``).
    """
    return {
        name: row[f"post_{name}"]
        for name in BEITRAGSFELDER_MIT_PRAEFIX
        if row.get(f"post_{name}") is not None
    }


def _beitrag_zeile(row: dict) -> BeitragResponse:
    return BeitragResponse(
        id=str(row.get("id") or ""),
        slug=row.get("slug") or "",
        title=row.get("title") or "",
        is_published=bool(row.get("is_published")),
        published_at=row.get("published_at"),
        author=row.get("author"),
        cover_image_url=row.get("cover_image_url"),
        excerpt=row.get("excerpt"),
        tags=row.get("tags"),
        seo_title=row.get("seo_title"),
        seo_description=row.get("seo_description"),
        og_image_url=row.get("og_image_url"),
        og_image_alt=row.get("og_image_alt"),
        noindex=bool(row.get("noindex")),
        content_html=row.get("content_html"),
        parent_post_id=(
            str(row["parent_post_id"]) if row.get("parent_post_id") else None
        ),
        author_user_id=(
            str(row["author_user_id"]) if row.get("author_user_id") else None
        ),
        is_archived=bool(row.get("is_archived")),
        # Vorgabe `True` und nicht `False`: die Spalte hat in der DB genau
        # diesen Default, und ein fehlender Wert heisst „sichtbar", nicht
        # „versteckt". Ein `bool(None)` waere hier ein stiller Ruecksprung auf
        # das Gegenteil (Wurzel 4).
        show_on_homepage=(
            True if row.get("show_on_homepage") is None
            else bool(row["show_on_homepage"])
        ),
        view_count=int(row.get("view_count") or 0),
        # 0485: die Werte der eigenen Felder. `{}` und nicht `None` bei einer
        # leeren Zeile — „keine eigenen Werte" ist ein leeres Objekt, kein
        # fehlendes.
        custom=row.get("post_custom") or {},
        # 0483: die Felder der Framer-Feldliste. In der DB tragen sie den
        # Praefix `post_`, damit an `site_pages` klar bleibt, was nur an einem
        # Beitrag gilt; nach aussen heissen sie ohne — die Oberflaeche kennt
        # kein `post_post_industry`.
        industry=row.get("post_industry"),
        client=row.get("post_client"),
        full_title=row.get("post_full_title"),
        intro_heading=row.get("post_intro_heading"),
        intro_body=row.get("post_intro_body"),
        button_text=row.get("post_button_text"),
        website_link=row.get("post_website_link"),
        gallery_top=row.get("post_gallery_top"),
        gallery_left=row.get("post_gallery_left"),
        gallery_right=row.get("post_gallery_right"),
        gallery_bottom=row.get("post_gallery_bottom"),
        final_heading=row.get("post_final_heading"),
        final_body=row.get("post_final_body"),
        show_carousel=bool(row.get("post_show_carousel")),
        carousel_1=row.get("post_carousel_1"),
        carousel_2=row.get("post_carousel_2"),
        carousel_3=row.get("post_carousel_3"),
        carousel_4=row.get("post_carousel_4"),
    )


def beitrag_details(db: Client, tenant_id: str, page_id: str) -> BeitragResponse:
    """Die Beitragsfelder EINER Seite lesen — tenant-gescoped (Wurzel 3)."""
    return _beitrag_zeile(_eigener_beitrag(db, tenant_id, page_id))


def _eigener_beitrag(db: Client, tenant_id: str, page_id: str) -> dict:
    """Die Zeile eines Beitrags dieses Betriebs. Laden und Scope in EINEM
    Schritt — getrennt vergisst man den Scope (Wurzel 3)."""
    rows = (
        db.table("site_pages")
        .select(f"{_BEITRAG_SPALTEN}, page_type")
        .eq("id", page_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise ValueError("Seite gehört nicht zu diesem Konto.")
    if rows[0].get("page_type") != PageType.post.value:
        raise TypeError("Diese Seite ist kein Blog-Beitrag.")
    return rows[0]


def beitrag_pflegen(
    db: Client, tenant_id: str, page_id: str, req: BeitragUpdate
) -> BeitragResponse:
    """Die Beitragsfelder EINER Seite setzen. Gibt die frische Zeile zurück.

    Der Tenant-Scope steht in JEDER Bedingung (Wurzel 3): geladen wird mit
    ``tenant_id``, geschrieben wird mit ``tenant_id``. Die Service-Rolle umgeht
    RLS — ohne diese zweite Bedingung könnte ein Aufrufer mit einer fremden
    ``page_id`` den Beitrag eines anderen Betriebs umdatieren.

    422 statt 404, wenn die Seite kein Beitrag ist: die Seite GIBT es, sie hat
    nur keine Beitragsfelder. Ein 404 würde den Kunden im Baukasten suchen
    lassen, was er längst vor sich hat.
    """
    row = _eigener_beitrag(db, tenant_id, page_id)
    patch = req.model_dump(mode="json", exclude_unset=True)
    # 0485 — die EIGENEN Felder. Sie werden GEMISCHT und nicht ersetzt: der
    # Client schickt die Schluessel, die er geaendert hat, und alles andere
    # bleibt stehen. Ein Ersetzen loeschte jedes Feld, das das sendende
    # Formular nicht kennt — dieselbe Falle wie bei `exclude_unset`, nur eine
    # Ebene tiefer.
    #
    # Ein Schluessel mit `null` LOESCHT: „leer" ist eine Aussage, und ein
    # `null` im Objekt zu behalten waere ein Wert, den kein Leser als „nicht
    # gesetzt" erkennt (Wurzel 4).
    if "custom" in patch:
        gesendet = patch.pop("custom") or {}
        geprueft = beitrag_eigene_felder.werte_pruefen(
            db, tenant_id, gesendet
        )
        bestand = dict(row.get("post_custom") or {})
        for key, wert in geprueft.items():
            if wert is None:
                bestand.pop(key, None)
            else:
                bestand[key] = wert
        patch["post_custom"] = bestand
    # Die Felder aus 0483 heissen in der DB mit `post_`-Praefix. Die
    # Uebersetzung steht HIER und an genau einer Stelle: verteilt auf Lesen
    # und Schreiben waeren es zwei Tabellen, von denen die zweite beim
    # naechsten Feld vergessen wird (Wurzel 2).
    for name in BEITRAGSFELDER_MIT_PRAEFIX:
        if name in patch:
            patch[f"post_{name}"] = patch.pop(name)
    if not patch:
        return _beitrag_zeile(row)
    db.table("site_pages").update(patch).eq("id", page_id).eq(
        "tenant_id", tenant_id
    ).execute()
    return beitrag_details(db, tenant_id, page_id)


def autorenliste(db: Client, tenant_id: str) -> list[str]:
    """Die Namen der Benutzer, die den Blog pflegen dürfen.

    Eine Bequemlichkeit ÜBER dem Freitextfeld, kein Ersatz dafür — und das ist
    Absicht: 0438 hält ausdrücklich fest, warum der Autor ein NAME und kein
    Benutzerverweis ist (ein Beitrag ist oft von „Familie Jensen" gezeichnet,
    und ein gelöschter Benutzer würde den Beitrag anonymisieren). Diese Liste
    füllt das Feld also vor, sie bindet es nicht.

    Zurück kommen NUR Namen: keine ID, keine E-Mail, keine Rolle. Wer den Blog
    pflegt, braucht die Namensliste — ein Benutzerverzeichnis mit Adressen wäre
    Aufklärung für einen Angreifer (Wurzel 9), und der Autor eines Beitrags ist
    ohnehin ein öffentlicher Text.
    """
    rows = (
        db.table("users")
        .select("full_name, role, deactivated_at")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    namen: list[str] = []
    for row in rows:
        # Ein deaktivierter Benutzer kann sich nicht anmelden — er als
        # Vorschlag anzubieten hieße, einen Namen vorzuschlagen, der im Betrieb
        # nicht mehr arbeitet.
        if row.get("deactivated_at"):
            continue
        if not has_capability(row.get("role"), Capability.MANAGE_SITE_CONFIG):
            continue
        name = (row.get("full_name") or "").strip()
        if name and name not in namen:
            namen.append(name)
    return sorted(namen)


def nachbarbeitraege(
    db: Client, tenant_id: str, veroeffentlicht_am: str | None
) -> tuple[dict | None, dict | None]:
    """Der vorherige und der nächste Beitrag — (älter, neuer).

    Die Reihenfolge ist das Erscheinungsdatum und sonst nichts. Sie ist bewusst
    nicht einstellbar: ein Blog ist eine Zeitachse, und wer eine kuratierte
    Abfolge will, meint eine Liste und keinen Blog. Hostaway hält es genauso.

    Der „nächste" Beitrag ist zusätzlich auf ``<= now()`` begrenzt. Ohne diese
    Bedingung wäre die Navigation das Leck, durch das die Planung fällt: der
    letzte veröffentlichte Beitrag würde auf den noch geplanten zeigen und
    dessen Titel und Adresse verraten.
    """
    if not veroeffentlicht_am:
        return None, None
    jetzt = datetime.now(UTC).isoformat()
    basis = (
        db.table("site_pages")
        .select("slug, title")
        .eq("tenant_id", tenant_id)
        .eq("page_type", PageType.post.value)
        .eq("is_published", True)
    )
    aelter = (
        basis.lt("published_at", veroeffentlicht_am)
        .order("published_at", desc=True)
        .limit(1)
        .execute()
    ).data or []
    neuer = (
        db.table("site_pages")
        .select("slug, title")
        .eq("tenant_id", tenant_id)
        .eq("page_type", PageType.post.value)
        .eq("is_published", True)
        .gt("published_at", veroeffentlicht_am)
        .lte("published_at", jetzt)
        .order("published_at", desc=False)
        .limit(1)
        .execute()
    ).data or []
    return (aelter[0] if aelter else None), (neuer[0] if neuer else None)


# --- Blog-Einstellungen (0457) ----------------------------------------------
# Sie hängen am BETRIEB und nicht an einem Beitrag: Blogname und RSS-Angaben
# gelten für den ganzen Blog. Deshalb Spalten in `tenant_site_config` und keine
# eigene Tabelle — es ist genau eine Zeile je Betrieb, und die gibt es dort
# bereits.
_BLOG_SPALTEN = (
    "blog_name, blog_prev_next, rss_title, rss_description, rss_image_url"
)


class BlogEinstellungen(BaseModel):
    """Blogname, Nächster/Vorheriger-Navigation und die RSS-Angaben."""

    blog_name: str | None = Field(default=None, max_length=120)
    blog_prev_next: bool = True
    rss_title: str | None = Field(default=None, max_length=200)
    rss_description: str | None = Field(default=None, max_length=500)
    rss_image_url: str | None = None

    _v_rss_image = field_validator("rss_image_url")(_validate_href)


def blog_einstellungen_lesen(db: Client, tenant_id: str) -> BlogEinstellungen:
    """Die Blog-Einstellungen eines Betriebs.

    Fehlt die Zeile (ein Konto, das noch nie etwas an der Website gespeichert
    hat), kommen die Vorgaben des Schemas zurück — nicht ein Fehler. „Noch nichts
    eingestellt" ist ein gültiger Zustand, und der Baukasten soll ihn zeigen
    können.
    """
    rows = (
        db.table("tenant_site_config")
        .select(_BLOG_SPALTEN)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return BlogEinstellungen()
    row = rows[0]
    return BlogEinstellungen(
        blog_name=row.get("blog_name"),
        # Der Spalten-Default ist `true`; `None` kann hier nur stehen, wenn eine
        # Zeile aus der Zeit vor 0457 gelesen wird, bevor der Default griff.
        blog_prev_next=bool(row.get("blog_prev_next", True)),
        rss_title=row.get("rss_title"),
        rss_description=row.get("rss_description"),
        rss_image_url=row.get("rss_image_url"),
    )


def blog_einstellungen_setzen(
    db: Client, tenant_id: str, req: BlogEinstellungen
) -> BlogEinstellungen:
    """Blog-Einstellungen speichern (upsert auf die eine Zeile des Betriebs).

    `upsert` mit `on_conflict='tenant_id'` und kein Insert-oder-Update-Zweig:
    zwei gleichzeitig offene Reiter würden sonst beide „keine Zeile" sehen und
    beide einfügen — der UNIQUE fängt das zwar ab, aber als 409 auf einer
    Speicherung, die richtig war (Wurzel 2).
    """
    db.table("tenant_site_config").upsert(
        {"tenant_id": tenant_id, **req.model_dump(mode="json")},
        on_conflict="tenant_id",
    ).execute()
    return blog_einstellungen_lesen(db, tenant_id)


def standardsprache(db: Client, tenant_id: str) -> str:
    """Die Standardsprache der Website — oder ein Fehler.

    Der RSS-Import braucht sie: er schreibt den importierten Text in EINE
    Sprache, und welche das ist, entscheidet der Betrieb. Ein Rückfall auf
    Deutsch oder Englisch wäre ein erfundener Wert (Wurzel 4) — der Text stünde
    danach unter einer Sprachfahne, die niemand gewählt hat, und in der
    richtigen Sprache gar nicht.

    Deshalb fail-closed: ist keine Standardsprache gesetzt, bricht der Import
    mit einer Meldung ab, die sagt, was zu tun ist.
    """
    rows = (
        db.table("tenant_site_config")
        .select("default_language, languages")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if rows:
        sprache = (rows[0].get("default_language") or "").strip()
        if sprache:
            return sprache
        gefuehrt = rows[0].get("languages") or []
        # Führt die Website GENAU EINE Sprache, ist sie eindeutig die
        # Standardsprache — das ist keine Annahme, sondern die einzige
        # Möglichkeit. Bei mehreren wäre die Wahl geraten.
        if len(gefuehrt) == 1:
            return str(gefuehrt[0])
    raise ValueError(
        "Bitte zuerst die Standardsprache der Website festlegen — der Import "
        "muss wissen, in welcher Sprache die Beiträge stehen."
    )
