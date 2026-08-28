"""Die Konfiguration der FESTEN Blog-Beitragsfelder (0481).

Grundlage: `docs/FRAMER-CMS-ANALYSE.md`, Abschnitt C1 — dort trägt jedes Feld
Name, Beschreibung, Pflicht, ein-/mehrzeilig, Platzhalter und Maximallänge.
Abschnitt G hält fest, warum das ins PRODUKT gehört und nicht in eine
Migration: es ist eine Einstellung des Betriebs, keine Struktur.

WAS HIER KONFIGURIERBAR IST — UND WAS NICHT
===========================================
Die Felder eines Blogbeitrags bleiben FEST (Titel, Anriss, Autor, Titelbild,
Schlagwörter, Datum, Text). Kundendefinierte Sammlungen bauen wir ausdrücklich
nicht — das ist Framers Produkt, nicht unseres, und `beitraege_manager.tsx`
begründet die Entscheidung schon in seinem Kopf.

Konfigurierbar ist, wie ein festes Feld HEISST und sich VERHÄLT. Deshalb eine
Zeile je (Betrieb, Feldschlüssel) und kein Schema-Generator.

Der Schlüssel wird gegen eine Allowlist geprüft. Ein unbekannter Schlüssel ist
ein 422 und kein stilles Ignorieren: eine Konfiguration, die gespeichert wird
und nie wirkt, ist schlimmer als eine abgelehnte — niemand sucht den Fehler im
Schlüssel (Wurzel 4/5).
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from supabase import Client

# Die konfigurierbaren Felder. Diese Liste ist die EINE Wahrheit gegenüber dem
# Frontend (`web/components/website/blog/felder.ts`) — der Prüflauf
# `scripts/i18n/blog-felder-pruefen.mjs` hält beide deckungsgleich.
#
# `title` und `status` stehen bewusst NICHT darin:
#   · der Titel ist die Identität des Beitrags — ein Beitrag ohne Titel ist in
#     keiner Liste auffindbar, „nicht Pflicht" wäre also keine echte Option;
#   · der Status ist im Vorbild ausdrücklich nicht konfigurierbar (C1: „kein
#     Popover — das Feld ist nicht konfigurierbar").
BEITRAG_FELDER: frozenset[str] = frozenset(
    {
        # Kopf: Bild und Sichtbarkeit
        "cover",
        "show_on_homepage",
        # Einordnung
        "industry",
        "client",
        "full_title",
        # Einleitung
        "intro_heading",
        "intro_body",
        # Handlungsaufforderung
        "button_text",
        "website_link",
        # Galerien — `top`/`bottom` sind MEHRERE Bilder, `left`/`right` je
        # EINES (Framer-Analyse C, Feld 14/15: „Image (nicht Gallery!)").
        "gallery_top",
        "gallery_left",
        "gallery_right",
        "gallery_bottom",
        # Abschluss
        "final_heading",
        "final_body",
        # Bildkarussell
        "show_carousel",
        "carousel_1",
        "carousel_2",
        "carousel_3",
        "carousel_4",
        # Unsere bestehenden Beitragsfelder
        "excerpt",
        "author",
        "tags",
        "published",
        "content",
        # Beitrags-SEO
        "seo_title",
        "seo_description",
        "og_image",
    }
)

#: Felder, die man NICHT verstecken darf, weil ohne sie kein Beitrag entsteht,
#: den man wiederfindet. Ein verstecktes Pflichtfeld wäre ein Dialog, den man
#: nicht abschicken kann, ohne zu sehen warum (Wurzel 5).
NICHT_VERSTECKBAR: frozenset[str] = frozenset({"content"})


class FeldKonfig(BaseModel):
    """Die Einstellungen EINES festen Beitragsfeldes."""

    feld_key: str = Field(max_length=40)
    #: Abweichender Name. `None` = der eingebaute Name aus dem Katalog, in der
    #: Sprache des Betrachters. Ein hier gesetzter Name steht in EINER Sprache;
    #: das ist die Entscheidung des Betriebs und wird nicht übersetzt.
    label: str | None = Field(default=None, max_length=60)
    beschreibung: str | None = Field(default=None, max_length=300)
    platzhalter: str | None = Field(default=None, max_length=120)
    #: `None` = keine Grenze. Eine 0 wäre „null Zeichen erlaubt" und damit ein
    #: Feld, das nichts annimmt — deshalb erst ab 1 (DB-CHECK gleichlautend).
    max_zeichen: int | None = Field(default=None, ge=1, le=10000)
    pflicht: bool = False
    mehrzeilig: bool = False
    versteckt: bool = False
    #: Fester Vorgabewert (0486). Wirkt beim ANLEGEN eines Beitrags und beim
    #: Zurücksetzen — nie als Ersatzwert beim Lesen (Wurzel 4).
    standard_wert: str | None = Field(default=None, max_length=500)
    #: Vorgabe ABGELEITET aus einem anderen Feld (Framers „Based on"). Der
    #: Schlüssel des Quellfeldes; genau eines von beiden darf gesetzt sein.
    standard_feld: str | None = Field(default=None, max_length=40)

    @field_validator("feld_key")
    @classmethod
    def _bekanntes_feld(cls, v: str) -> str:
        """Nur Felder, die es wirklich gibt.

        422 und kein stilles Verwerfen: eine gespeicherte Konfiguration, die
        nie wirkt, schickt den Kunden auf die Suche an der falschen Stelle.
        """
        if v not in BEITRAG_FELDER:
            erlaubt = ", ".join(sorted(BEITRAG_FELDER))
            raise ValueError(
                f"Unbekanntes Beitragsfeld '{v}'. Erlaubt sind: {erlaubt}."
            )
        return v

    @field_validator("standard_feld")
    @classmethod
    def _quellfeld(cls, v: str | None) -> str | None:
        """Das Quellfeld einer abgeleiteten Vorgabe muss es geben.

        Ein unbekannter Schlüssel wäre eine Ableitung, die nie greift — und
        weil sie still nicht greift, sucht niemand den Fehler hier (Wurzel 5).
        """
        if v is None:
            return None
        wert = v.strip()
        if not wert:
            return None
        if wert not in BEITRAG_FELDER and wert != "title":
            raise ValueError(
                f"'{wert}' ist kein Beitragsfeld. Die Vorgabe kann sich nur "
                "auf ein vorhandenes Feld beziehen."
            )
        return wert

    @field_validator("label", "beschreibung", "platzhalter", "standard_wert")
    @classmethod
    def _leer_ist_none(cls, v: str | None) -> str | None:
        """Ein leer gemachtes Feld heisst „wieder die Vorgabe", nicht „leer".

        Ohne diese Zeile stünde ein leerer String in der DB, und die Maske
        zeigte ein Feld ganz ohne Beschriftung statt des eingebauten Namens.
        """
        if v is None:
            return None
        sauber = v.strip()
        return sauber or None


class FeldKonfigListe(BaseModel):
    """Die Konfiguration aller Felder eines Betriebs."""

    felder: list[FeldKonfig] = Field(
        default_factory=list, max_length=len(BEITRAG_FELDER)
    )


_SPALTEN = (
    "feld_key, label, beschreibung, platzhalter, max_zeichen, pflicht, "
    "mehrzeilig, versteckt, standard_wert, standard_feld"
)

#: Feldarten, die KEINEN Vorgabewert bekommen (0486).
#:
#: Ein Schalter hat nur zwei Zustände und damit schon einen Grundzustand; ein
#: Bild, eine Galerie und eine Schlagwortliste sind keine Eingabe, die man
#: vorschreiben könnte. Eine Vorgabe an ihnen wäre ein Feld in der Maske, das
#: nichts bewirkt — eine Attrappe.
OHNE_VORGABE: frozenset[str] = frozenset(
    {"cover", "og_image", "show_on_homepage", "show_carousel", "tags",
     "gallery_top", "gallery_bottom", "gallery_left", "gallery_right",
     "carousel_1", "carousel_2", "carousel_3", "carousel_4"}
)


def konfig_laden(db: Client, tenant_id: str) -> FeldKonfigListe:
    """Die gespeicherte Feldkonfiguration eines Betriebs.

    Tenant-gescoped (Wurzel 3): die Service-Rolle umgeht RLS, also ist diese
    Bedingung die ganze Zugangskontrolle.

    Zurück kommen NUR gespeicherte Zeilen — kein aufgefüllter Satz mit
    Vorgabewerten. Welche Vorgabe ein Feld ohne Eintrag hat, weiss der Katalog
    im Frontend; hier einen zweiten, erfundenen Satz zu bauen wären zwei
    Wahrheiten (Wurzel 2/4).
    """
    rows = (
        db.table("site_post_field_config")
        .select(_SPALTEN)
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    return FeldKonfigListe(
        felder=[
            FeldKonfig(
                feld_key=row["feld_key"],
                label=row.get("label"),
                beschreibung=row.get("beschreibung"),
                platzhalter=row.get("platzhalter"),
                max_zeichen=row.get("max_zeichen"),
                pflicht=bool(row.get("pflicht")),
                mehrzeilig=bool(row.get("mehrzeilig")),
                versteckt=bool(row.get("versteckt")),
                standard_wert=row.get("standard_wert"),
                standard_feld=row.get("standard_feld"),
            )
            # Ein Schlüssel, der nicht mehr in der Allowlist steht (ein Feld
            # wurde umbenannt oder entfernt), wird beim LESEN übergangen. Beim
            # Schreiben ist derselbe Fall ein 422 — hier nicht, weil sonst eine
            # alte Zeile die ganze Maske unerreichbar machte.
            for row in rows
            if row.get("feld_key") in BEITRAG_FELDER
        ]
    )


def konfig_setzen(
    db: Client, tenant_id: str, req: FeldKonfig
) -> FeldKonfig:
    """Die Konfiguration EINES Feldes setzen. Gibt den frischen Stand zurück.

    `upsert` auf (tenant_id, feld_key) und kein Lesen-Prüfen-Schreiben: die
    UNIQUE-Bedingung aus 0481 ist der Backstop, und ein doppelt abgeschicktes
    Formular darf keine zweite Zeile erzeugen (Wurzel 2). Ohne sie läse die
    Oberfläche willkürlich eine von beiden.

    Der Tenant-Scope steht in der Nutzlast UND wäre in jeder Bedingung nötig —
    hier reicht die Nutzlast, weil `upsert` genau die Zeile trifft, die den
    eindeutigen Schlüssel (tenant_id, feld_key) trägt.
    """
    if req.versteckt and req.feld_key in NICHT_VERSTECKBAR:
        raise ValueError(
            f"Das Feld '{req.feld_key}' laesst sich nicht ausblenden — ohne "
            "es entsteht kein Beitrag."
        )
    # Ein verstecktes Pflichtfeld ist ein Dialog, den man nicht abschicken
    # kann, ohne zu sehen warum. Lieber hier ein klarer Fehler als dort ein
    # stummer (Wurzel 5).
    if req.versteckt and req.pflicht:
        raise ValueError(
            "Ein Pflichtfeld laesst sich nicht ausblenden. Erst die Pflicht "
            "aufheben, dann ausblenden."
        )
    if req.standard_wert and req.standard_feld:
        raise ValueError(
            "Ein Feld hat entweder einen festen Vorgabewert ODER eine "
            "Ableitung aus einem anderen Feld — nicht beides."
        )
    if req.standard_feld == req.feld_key:
        raise ValueError("Ein Feld kann seine Vorgabe nicht aus sich selbst beziehen.")
    if (req.standard_wert or req.standard_feld) and req.feld_key in OHNE_VORGABE:
        raise ValueError(
            f"Das Feld '{req.feld_key}' nimmt keinen Vorgabewert an."
        )
    nutzlast = req.model_dump(mode="json")
    nutzlast["tenant_id"] = tenant_id
    (
        db.table("site_post_field_config")
        .upsert(nutzlast, on_conflict="tenant_id,feld_key")
        .execute()
    )
    for feld in konfig_laden(db, tenant_id).felder:
        if feld.feld_key == req.feld_key:
            return feld
    # Kommt die eben geschriebene Zeile nicht zurück, ist etwas anderes kaputt
    # als diese Anfrage — dann lieber laut als ein erfundener Rueckgabewert.
    raise ValueError("Die Feldkonfiguration liess sich nicht zurücklesen.")


def konfig_zuruecksetzen(db: Client, tenant_id: str, feld_key: str) -> None:
    """Ein Feld auf die eingebaute Vorgabe zurücksetzen — Zeile löschen.

    Löschen und nicht „alle Werte auf null": eine Zeile voller Nullwerte wäre
    nicht von einer bewussten Einstellung zu unterscheiden, und der Katalog im
    Frontend soll wieder greifen.

    Das `delete` trägt BEIDE Bedingungen. Ohne `tenant_id` würde es die
    gleichnamige Konfiguration jedes anderen Betriebs mitlöschen — die
    Service-Rolle umgeht RLS (Wurzel 3), und ein ungescoptes `delete` ist
    genau der Fall, den CLAUDE.md ausdrücklich verbietet.
    """
    if feld_key not in BEITRAG_FELDER:
        raise ValueError(f"Unbekanntes Beitragsfeld '{feld_key}'.")
    (
        db.table("site_post_field_config")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("feld_key", feld_key)
        .execute()
    )
