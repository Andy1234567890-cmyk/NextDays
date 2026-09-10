"""Aus flachen Block-Zeilen einen Baum bauen (0472).

DIE EINE STELLE
===============
Sieben Orte im Slice bauen `PublicBlock`-Listen: der öffentliche Resolver, die
Entwurfs-Vorschau, die Fehlerseite, die Objekt-Vorlage, die Pop-ups, die
Regel-Flächen und die Vorlagen-Vorschau. Würde jeder von ihnen die
Eltern-Kind-Beziehung selbst auflösen, gäbe es sieben Fassungen derselben
Logik — und sechs davon würden beim nächsten Feld vergessen.

Deshalb steht der Aufbau hier, und die sieben rufen ihn.

WARUM DER RENDERER EINEN BAUM BEKOMMT UND KEINE FLACHE LISTE
============================================================
Er müsste sie ohnehin als Erstes zu einem Baum zusammensetzen — die Reihenfolge
der Spalten und ihre Zugehörigkeit zum Abschnitt sind die Grundlage jedes
Layouts. Ihn das tun zu lassen hieße, dieselbe Arbeit ein zweites Mal zu
schreiben, in einer anderen Sprache, ohne Zugriff auf die Regeln, die sie
gültig machen.

WAS MIT VERWAISTEN ZEILEN PASSIERT
==================================
Eine Zeile, deren Elternteil nicht in der Ergebnismenge liegt, wird
ÜBERSPRUNGEN und LAUT gemeldet. Sie stillschweigend an die Wurzel zu hängen
wäre der bequeme Weg — und er würde eine Spalte über die volle Breite eines
Abschnitts rendern, an einer Stelle, an der niemand sie erwartet. Ein
Datenfehler, der wie ein Layoutfehler aussieht, ist der teuerste (Wurzel 5).

Die Fremdschlüssel-Regel (`on delete cascade`) macht das zum Ausnahmefall: ein
gelöschter Elternteil nimmt seine Kinder mit. Übrig bleibt der Fall, dass eine
Abfrage nur einen Teilbaum liest — und genau dann ist das Melden richtig.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING

from supabase import Client

from src.core.logging import get_logger

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from .schemas import PublicBlock

log = get_logger("nextdays.site_config.baum")


def baum_bauen(
    zeilen: list[dict],
    *,
    kennung: Callable[[str, dict], str | None] | None = None,
    tenant_id: str | None = None,
) -> list[PublicBlock]:
    """Flache Zeilen in einen Baum von :class:`PublicBlock` verwandeln.

    ``zeilen`` sind die Roh-Zeilen aus ``site_blocks`` — sie MÜSSEN ``id``,
    ``parent_id``, ``kind``, ``position``, ``type``, ``content`` und ``settings``
    enthalten. ``span`` ist freiwillig (nur Spalten haben eines).

    ``kennung`` entscheidet je Block, ob seine DB-Kennung mit nach draußen darf
    (``formulare.block_kennung``). Ohne sie reist keine.

    Die Reihenfolge kommt aus ``position``, und zwar INNERHALB des Elternteils.
    Sie ist nach 0472 nicht mehr seitenweit eindeutig: drei Spalten in drei
    verschiedenen Abschnitten tragen alle die 0.
    """
    from .schemas import PublicBlock  # noqa: PLC0415 — Zirkelbezug vermeiden

    # Erst ALLE Knoten anlegen, dann verbinden. Ein Durchlauf, der gleich
    # verbindet, käme mit einem Kind vor seinem Elternteil nicht zurecht — und
    # die Reihenfolge der Zeilen ist die der Abfrage, nicht die des Baums.
    nach_id: dict[str, PublicBlock] = {}
    for z in zeilen:
        nach_id[str(z["id"])] = PublicBlock(
            id=kennung(z["type"], z) if kennung else None,
            type=z["type"],
            content=z.get("content") or {},
            settings=z.get("settings") or {},
            kind=z.get("kind") or "widget",
            span=z.get("span"),
            children=[],
        )

    wurzeln: list[PublicBlock] = []
    verwaist = 0
    for z in zeilen:
        eltern_id = z.get("parent_id")
        knoten_obj = nach_id[str(z["id"])]
        if eltern_id is None:
            wurzeln.append(knoten_obj)
            continue
        eltern = nach_id.get(str(eltern_id))
        if eltern is None:
            verwaist += 1
            continue
        eltern.children.append(knoten_obj)

    if verwaist:
        log.warning(
            "site_blocks_verwaiste_zeilen",
            anzahl=verwaist,
            tenant_id=tenant_id,
            hinweis=(
                "Zeilen mit einem Elternteil außerhalb der Ergebnismenge wurden "
                "übersprungen. Sie an die Wurzel zu hängen hätte sie über die "
                "volle Breite gerendert und wie ein Layoutfehler ausgesehen."
            ),
        )
    return wurzeln


def flach(bloecke: list[PublicBlock]) -> list[PublicBlock]:
    """Den Baum wieder flach durchlaufen — Tiefensuche, Reihenfolge erhalten.

    Gebraucht von allem, was jeden Baustein EINMAL sehen will, ohne sich für
    die Struktur zu interessieren: die Bildnachweise, die Formular-Kennungen,
    die Zählung für die Obergrenze.
    """
    aus: list[PublicBlock] = []
    for b in bloecke:
        aus.append(b)
        aus.extend(flach(b.children))
    return aus


def huelle_anlegen(
    db: Client,
    tenant_id: str,
    page_id: str,
    position: int,
    settings: dict | None = None,
) -> str:
    """`section > column` anlegen und die Spalten-ID zurückgeben.

    DIE EINE STELLE FÜR DEN SCHREIBWEG, so wie `baum_bauen` die eine Stelle für
    den Leseweg ist.

    Seit 0472 hängt jeder Baustein in einer Spalte und die in einem Abschnitt.
    Vier DB-Regeln erzwingen das; die Spalten-DEFAULTS der Migration
    (`kind='widget'`, `tiefe=0`, `parent_id=NULL`) sind ausgerechnet eine
    Kombination, die `site_blocks_wurzel_check` UND `site_blocks_tiefe_check`
    gleichzeitig verbieten. Ein Insert, der die drei Felder nicht selbst setzt,
    scheitert deshalb IMMER — nicht nur in Randfällen.

    Genau das war am 25.08./26.08.2026 an fünf Stellen gleichzeitig der Fall:
    das Speichern im Editor, das Duplizieren einer Seite, „Seite aus Vorlage",
    „Pop-up aus Vorlage" und der RSS-Import. Alle fünf antworteten mit 500, und
    alle fünf hatten dieselbe Ursache. Sie stand nur fünfmal getrennt im Code.

    Die Einstellungen wandern an den ABSCHNITT — Hintergrund, Abstände und
    Gerätesichtbarkeit wirken dort. Das ist dieselbe Zuordnung, die 0472 für
    den Bestand vorgenommen hat: ein neu angelegter Baustein sieht damit aus
    wie ein migrierter.
    """
    section = (
        db.table("site_blocks")
        .insert(
            {
                "tenant_id": tenant_id,
                "page_id": page_id,
                "type": "container",
                "kind": "section",
                "tiefe": 0,
                "position": position,
                "content": {},
                "settings": settings or {},
            }
        )
        .execute()
    ).data
    if not section:
        raise RuntimeError("Abschnitt konnte nicht angelegt werden.")
    spalte = (
        db.table("site_blocks")
        .insert(
            {
                "tenant_id": tenant_id,
                "page_id": page_id,
                "type": "container",
                "kind": "column",
                "tiefe": 1,
                "position": 0,
                "span": 12,
                "content": {},
                "settings": {},
                "parent_id": section[0]["id"],
            }
        )
        .execute()
    ).data
    if not spalte:
        raise RuntimeError("Spalte konnte nicht angelegt werden.")
    return spalte[0]["id"]


def widget_zeile(
    tenant_id: str,
    page_id: str,
    typ: str,
    spalte_id: str,
    content: dict,
    settings: dict | None = None,
) -> dict:
    """Die fertige INSERT-Zeile eines Bausteins unter seiner Spalte.

    Damit die drei Baum-Felder nicht an jedem Aufrufer einzeln stehen — genau
    dieses Abschreiben war der Fehler.
    """
    return {
        "tenant_id": tenant_id,
        "page_id": page_id,
        "type": typ,
        "kind": "widget",
        "tiefe": 2,
        "parent_id": spalte_id,
        "position": 0,
        "content": content,
        "settings": settings or {},
    }


def huellen_kaskade(
    entfallen: set[str],
    eltern: dict[str, str | None],
    ziele: set[str],
) -> set[str]:
    """Welche Huellen (Spalte, Abschnitt) mit den Bausteinen mitgehen.

    Reine Mengenlogik, herausgezogen am 10.09.2026 aus `replace_blocks`: dort
    stand sie als vierfach verschachtelte Schleife mitten in einer
    492-Zeilen-Funktion. Loeschen ist die eine Operation, die man nicht
    nachtraeglich untersuchen kann — die Zeilen sind dann weg. Genau deshalb
    gehoert die Entscheidung, WAS mitgeht, einzeln pruefbar.

    Zwei Regeln, beide aus realen Fehlern:

    1. Spalten, die ein GESENDETER Baustein als Ziel nennt, sind tabu — auch
       wenn ihr bisheriger Inhalt entfaellt. Ohne das riss das Aufraeumen
       genau die Spalte weg, in die der Kunde gerade etwas gezogen hatte:
       `parent_id` zeigte danach ins Leere. Der Fall entsteht beim
       Verschieben zwischen zwei Spalten, also beim ersten Handgriff, den
       ein Spaltenlayout ueberhaupt nahelegt.

    2. Die Huelle faellt nur, wenn sie AUSSCHLIESSLICH entfallende Bausteine
       traegt. Eine Spalte mit zwei Bausteinen, von denen einer bleibt,
       gehoert nicht geloescht — sonst risse das Entfernen des einen den
       anderen mit (dasselbe `cascade`, das hier nuetzt, waere dann der
       Schaden).
    """
    zu_loeschen = set(entfallen)
    for wid in entfallen:
        spalte_id = eltern.get(wid)
        if spalte_id in ziele:
            continue
        section_id = eltern.get(spalte_id) if spalte_id else None
        if spalte_id and all(
            kind_eltern != spalte_id or bid in zu_loeschen
            for bid, kind_eltern in eltern.items()
        ):
            zu_loeschen.add(spalte_id)
            if section_id and all(
                kind_eltern != section_id or bid in zu_loeschen
                for bid, kind_eltern in eltern.items()
            ):
                zu_loeschen.add(section_id)
    return zu_loeschen
