"""Schemas der Abschnitte (Blöcke) einer Seite.

Ausgelagert aus `schemas.py`, weil die Datei die 1500-Zeilen-Grenze von `pylint`
überschritt — und weil der Schnitt derselbe ist wie im Dienst: die Methoden dazu
stehen seit demselben Anlass in `bloecke.py`.

Re-exportiert wird alles über `schemas.py`, damit bestehende Importe
(`from .schemas import BlockCreate`) unverändert weiterlaufen. Dasselbe Muster
wie bei `schemas_mediathek.py`.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from .basis import BlockType


# --- Blöcke (Dashboard) ------------------------------------------------------
class BlockCreate(BaseModel):
    type: BlockType
    content: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)

    # --- Baum (0472) --------------------------------------------------------
    #
    # Diese drei Felder fehlten hier, und damit fehlte dem Editor der Weg zum
    # SPALTENLAYOUT: die DB kennt `section`/`column`/`inner_column`/`widget` samt
    # `span` seit 0472, der Renderer zeichnet `span` als Anteil von zwölf
    # (`block-renderer.tsx`) — aber `add_block` konnte nur Bausteine anlegen.
    # Jeder Baustein landete deshalb in seiner eigenen einspaltigen Reihe, und
    # zwei Dinge nebeneinander zu setzen war im Baukasten unmöglich.
    #
    # Was NICHT hierher gehört: eine eigene „Spalte anlegen"-Route. Der Baum ist
    # ein Baum aus derselben Tabelle; ihn über einen zweiten Endpunkt zu füllen
    # wären zwei Schreibwege auf dieselben Zeilen (Wurzel 2).
    #: Was die neue Zeile IST. Ohne Angabe ein Baustein — das bisherige
    #: Verhalten, damit bestehende Aufrufer unverändert funktionieren
    #: (Wurzel 1).
    kind: str = "widget"
    #: Der Elternteil. `None` = an der Seite (nur für `section` erlaubt).
    parent_id: str | None = None
    #: Breitenanteil in Zwölfteln. Nur an Spalten sinnvoll; 6 = halbe Breite.
    #: Ohne Angabe teilen sich die Geschwister die Breite gleichmäßig.
    span: int | None = Field(default=None, ge=1, le=12)
    #: WO der Container einsortiert wird — der Rang unter seinen Geschwistern.
    #: `None` heißt ans Ende (das bisherige Verhalten).
    #:
    #: Nötig, weil ein Layout an einer bestimmten NAHT eingesetzt wird: wer
    #: oben auf das „+" klickt, will den Abschnitt oben. Ohne dieses Feld
    #: landete er immer unten, und die geklickte Stelle war wirkungslos.
    #:
    #: Der Weg über `reorder_blocks` wäre der falsche: der verlangt ALLE IDs
    #: der Seite in einer Liste und ist für Bausteine gedacht — ihn für einen
    #: einzelnen Container zu benutzen hieße, die ganze Ordnung neu zu senden,
    #: nur um eine Zeile einzuschieben.
    #:
    #: Obergrenze, weil `MAX_ABSCHNITTE` bei 60 liegt und ein unbegrenzter
    #: Wert ein Bereich ohne Deckel wäre (Wurzel 8).
    position: int | None = Field(default=None, ge=0, le=200)

    @field_validator("kind")
    @classmethod
    def _art(cls, v: str) -> str:
        """Nur die vier Arten, die der CHECK der Tabelle zulässt (0472).

        Ein anderer Wert wäre sonst ein 23514 aus der DB — also ein 500 aus
        angreiferkontrolliertem Input, genau was Wurzel 5 verbietet."""
        if v not in ("section", "column", "inner_column", "widget"):
            raise ValueError(
                "Art muss section, column, inner_column oder widget sein."
            )
        return v


class BlockUpdate(BaseModel):
    content: dict | None = None
    settings: dict | None = None
    #: Breitenanteil einer SPALTE in Zwölfteln (0479-Nachtrag zu 0472).
    #:
    #: Er war bisher nur beim ANLEGEN setzbar. Damit war die Spaltenbreite eine
    #: Entscheidung, die man beim Klick auf ein Layout traf und danach nie mehr
    #: ändern konnte — in jedem Baukasten ist genau das ein Feld im Inspektor.
    #:
    #: Nur an Spalten: der Dienst weist `span` an einer Section oder einem
    #: Baustein mit 422 ab. Ein stilles Ignorieren wäre schlimmer — die
    #: Oberfläche bekäme „gespeichert" und die Breite bliebe, wie sie war
    #: (Wurzel 5).
    span: int | None = Field(default=None, ge=1, le=12)


class ContainerMoveRequest(BaseModel):
    """Neuer Rang eines Containers unter seinen Geschwistern (0479).

    Nur die ZAHL, nicht die Liste aller Geschwister: der Dienst pflegt die
    Ordnung der Nachbarn selbst (Wurzel 1). Käme die ganze Liste vom Client,
    wäre jedes Verschieben ein Vollersatz — und ein zweiter Weg auf dieselbe
    Ordnung (Wurzel 2)."""

    position: int = Field(ge=0, le=200)


class BlockResponse(BaseModel):
    id: str
    page_id: str
    type: BlockType
    position: int
    content: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)

    # --- Baum (0472) --------------------------------------------------------
    #: Was diese Zeile IST. Der Editor entscheidet daran, ob er einen Abschnitt,
    #: eine Spalte oder einen Baustein zeigt.
    #:
    #: `None` wird zu `widget`: die Fake-DB der Tests liefert das Feld nicht,
    #: und ein Block ohne Angabe IST ein Baustein. Ein hartes `str` hätte hier
    #: sechs Tests gekippt, die mit dem Baum nichts zu tun haben.
    kind: str | None = "widget"
    #: Der Elternteil. `None` = ein Abschnitt, direkt an der Seite.
    parent_id: str | None = None
    #: Breitenanteil einer Spalte in Zwölfteln.
    span: int | None = None

    @field_validator("kind", mode="before")
    @classmethod
    def _kind_standard(cls, v: str | None) -> str:
        return v or "widget"


class BlockListResponse(BaseModel):
    items: list[BlockResponse]
    total: int


class ReorderRequest(BaseModel):
    ordered_ids: list[str] = Field(min_length=1)


class BlockReplaceItem(BaseModel):
    """Ein Abschnitt im Voll-Ersatz einer Seite. ``id`` gesetzt = bestehende Zeile
    weiterverwenden (Inhalt aktualisieren), ``None`` = neuer Abschnitt."""

    id: str | None = None
    type: BlockType
    content: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)
    #: In WELCHE Spalte dieser Baustein gehört (0472).
    #:
    #: ``None`` = der Server legt ihm eine eigene Hülle an
    #: (``_huelle_fuer_widget``: ein Abschnitt mit einer Spalte darin) — das
    #: bisherige Verhalten, und der Normalfall für einen Baustein, der
    #: untereinander steht.
    #:
    #: Gesetzt heißt: der Kunde hat ihn in eine BESTEHENDE Spalte gezogen. Ohne
    #: dieses Feld war das unmöglich, und damit war das ganze Spaltenlayout
    #: unbenutzbar: die Spalten ließen sich anlegen (0472 + 27.08.2026), aber
    #: jeder Baustein landete in seiner eigenen Reihe daneben statt darin. Zwei
    #: Dinge nebeneinander zu setzen ging im Baukasten nicht.
    parent_id: str | None = None


class BlocksReplaceRequest(BaseModel):
    """Ersetzt ALLE Abschnitte einer Seite in EINEM Aufruf.

    Der Editor speicherte bisher mit N+1 einzelnen HTTP-Calls (löschen, updaten,
    anlegen, neu ordnen) ohne Transaktion — brach einer in der Mitte ab, blieb
    die Seite halb gespeichert. Dieser Endpunkt macht den Speichervorgang zu EINER
    idempotenten Operation: dieselbe Liste zweimal gesendet ergibt denselben
    Zustand (Wurzel 2), und die Reihenfolge ist der Array-Index.

    Obergrenze, damit eine Seite nicht unbegrenzt viele Abschnitte rendert
    (Wurzel 8) — 60 ist weit jenseits jeder echten Kunden-Seite."""

    items: list[BlockReplaceItem] = Field(default_factory=list, max_length=60)

    #: Welche Bausteine der Editor KANNTE, als er diesen Stand gebaut hat.
    #:
    #: Ohne dieses Feld ist der Vollersatz eine Waffe: alles, was nicht in
    #: `items` steht, gilt als gelöscht — auch ein Baustein, den in der
    #: Zwischenzeit ein ZWEITER Editor, ein anderer Reiter oder die Mobil-App
    #: angelegt hat. Der Client kann ihn gar nicht mitschicken, er weiß nichts
    #: von ihm. Live nachgewiesen am 28.08.2026: bei geöffnetem Editor
    #: angelegte Abschnitte verschwanden beim nächsten Tastendruck wieder,
    #: samt ihrer Hüllen — für den Kunden „meine Arbeit ist weg".
    #:
    #: Mit dieser Liste löscht der Server nur, was der Client WIRKLICH
    #: weggenommen hat (`bekannt - gesendet`). Was er nie gesehen hat, bleibt
    #: stehen (Wurzel 1: der Gegenzustand gilt für die eigene Änderung, nicht
    #: für fremde).
    #:
    #: `None` = das alte Verhalten. Es bleibt für Aufrufer, die diese Liste
    #: nicht führen (Vorlagen anwenden, Tests) — dort ist der Vollersatz
    #: gewollt und es gibt keinen zweiten Schreiber.
    #:
    #: Obergrenze wie bei `items`, plus Luft für die gelöschten: eine Seite
    #: trägt höchstens 60 Bausteine, und mehr als das Doppelte kann ein Client
    #: nicht ehrlich „gekannt" haben (Wurzel 8).
    bekannte_ids: list[str] | None = Field(default=None, max_length=120)
