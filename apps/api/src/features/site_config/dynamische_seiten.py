"""Dynamische Seiten: EIN Layout, viele Adressen (0468).

WAS DAS IST
===========
Eine dynamische Seite ist eine Master-Vorlage. Man baut sie EINMAL, und der
Renderer erzeugt daraus eine Seite je Objekt — Text, Galerie, Lage und Preise
kommen aus den Live-Daten des Objekts, nicht aus dem Block.

Das Vorbild ist Hostaways „Dynamic Page" (docs/BUCHUNGSSTRECKE-VORBILDER.md):

    „In Booking Website Pro fungiert eine dynamische Seite als intelligente,
     wiederverwendbare Masterseite."

WARUM NICHT EINE SYSTEMSEITE (der Fehler aus 0466)
==================================================
Anfangs war die Objekt-Detailseite als Systemseite geführt — nicht gestaltbar,
nur mit SEO-Feldern. Das war falsch. Sie ist die Seite, auf der gebucht wird;
sie ist der eigentliche Wert des Baukastens für einen Vermieter. Eine Seite, die
man nicht gestalten kann, nimmt ihm genau das weg.

WAS EINE DYNAMISCHE SEITE ANDERS MACHT
======================================
* Ihr Slug ist ein MUSTER (``inserat/[id]``), keine Adresse.
* Sie wird nie veröffentlicht — sie existiert, sobald es Objekte gibt.
* Ihre Blöcke tragen VERWEISE auf Datenfelder statt fester Texte
  (:mod:`verbundene_daten`).
* In der Sitemap steht nicht sie, sondern eine Adresse je Objekt.

WAS SIE NICHT KANN, UND WARUM DAS RICHTIG IST
=============================================
Kein eigenes Layout je Objekt. Hostaway erzwingt dasselbe und begründet es mit
dem einheitlichen Markenauftritt; der praktische Grund wiegt schwerer: ein
Betrieb mit 30 Objekten pflegt keine 30 Layouts. Wer einzelne Bausteine je
Objekt aus- oder einblenden will, nutzt die Sichtbarkeitsregeln.
"""

from __future__ import annotations

from dataclasses import dataclass

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.site_config.dynamische_seiten")


@dataclass(frozen=True)
class DynamischeSeite:
    """Eine Master-Vorlage und die Quelle, aus der ihre Vielzahl entsteht."""

    quelle: str
    """Wert von ``dynamic_source``. Heute gibt es genau einen."""

    slug: str
    """Das Routen-MUSTER. ``[id]`` bleibt als Platzhalter stehen: die Seite ist
    nicht EINE Adresse, sondern eine Familie von Adressen."""

    titel_schluessel: str
    """Schlüssel im Übersetzungskatalog des Dashboards. Kein deutscher Text in
    der DB — die Seitenliste bedient 24 Sprachen (Wurzel 4)."""


DYNAMISCHE_SEITEN: tuple[DynamischeSeite, ...] = (
    DynamischeSeite(
        quelle="property",
        slug="inserat/[id]",
        titel_schluessel="dynamischeSeiten.property",
    ),
)


def ist_dynamisch(row: dict) -> bool:
    """Ist diese Zeile eine dynamische Seite?"""
    return row.get("page_type") == "dynamic"


def sicherstellen(db: Client, tenant_id: str) -> None:
    """Fehlende dynamische Seiten dieses Betriebs anlegen.

    Wird beim Lesen der Seitenliste gerufen, aus demselben Grund wie bei den
    Systemseiten: eine Migration hätte nur die HEUTIGEN Betriebe bedacht.

    Idempotent über ``dynamic_source``; der eindeutige Index aus 0468 ist der
    Backstop für zwei gleichzeitige Aufrufe (Wurzel 2).
    """
    vorhanden = {
        r["dynamic_source"]
        for r in (
            db.table("site_pages")
            .select("dynamic_source")
            .eq("tenant_id", tenant_id)
            .eq("page_type", "dynamic")
            .execute()
        ).data
        or []
        if r.get("dynamic_source")
    }
    for seite in DYNAMISCHE_SEITEN:
        if seite.quelle in vorhanden:
            continue
        try:
            db.table("site_pages").insert(
                {
                    "tenant_id": tenant_id,
                    "page_type": "dynamic",
                    "dynamic_source": seite.quelle,
                    "slug": seite.slug,
                    # Titel leer: er kommt aus dem Katalog, siehe Dataclass.
                    "title": "",
                    "is_published": True,
                    "is_home": False,
                    # In keiner Navigation: ein Menüpunkt „Objekt" ohne
                    # gewähltes Objekt führt ins Leere.
                    "nav_area": "none",
                }
            ).execute()
        except APIError as exc:
            if getattr(exc, "code", None) != "23505":
                raise
            # Zwei Aufrufe gleichzeitig, der andere war schneller — das
            # gewünschte Ergebnis. Eine Slug-Kollision ist hier anders als bei
            # den Systemseiten praktisch ausgeschlossen: `inserat/[id]` enthält
            # eckige Klammern, die der Slug-Filter einer normalen Seite gar
            # nicht durchlässt. Sollte es doch einmal auftreten, wird es laut.
            log.info(
                "dynamische_seite_bereits_vorhanden",
                tenant_id=tenant_id,
                quelle=seite.quelle,
            )
