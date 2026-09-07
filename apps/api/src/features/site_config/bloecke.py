"""Abschnitte einer Seite: lesen, anlegen, ändern, ordnen, ersetzen (Page-Builder).

Als MIXIN und nicht als eigener Dienst — dasselbe Muster und derselbe Grund wie
bei `MediathekMixin`: der Router ruft `service.replace_blocks`, und ein zweiter
Dienst nur für Abschnitte wäre eine zweite Dependency, eine zweite Factory und
ein zweiter Ort, an dem man den Tenant-Scope vergessen kann.

Der Anlass war wieder eine Zeilenzahl: `service.py` stand bei 1690 Zeilen und
damit über der Grenze, die `pylint` hier setzt (1500). Der Schnitt ist aber der
richtige — die Abschnitte sind der einzige Teil des Slice, der Block-INHALTE
validiert, und sie haben ihre eigenen Regeln: Typprüfung je Blocktyp,
Positionsvergabe, das Ersetzen des ganzen Satzes in einem Rutsch.

Das Mixin setzt voraus, dass die Basisklasse `_db`, `_require_tenant`,
`_own_page`, `_own_block`, `_load_block`, `_block_row`, `_next_nav_order`,
`_validate_content` und `_validate_settings` mitbringt.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from src.core.logging import get_logger

from . import (
    dynamische_seiten,
    konto_daten,
    ordnung,
    strecken_vorlagen,
    systemseiten,
)
from . import templates as site_templates
from .fehler import SiteConfigError
from .schemas import (
    BlockCreate,
    BlockListResponse,
    BlockResponse,
    BlocksReplaceRequest,
    BlockType,
    BlockUpdate,
    BrandingUpdate,
    NavArea,
    PageListResponse,
)

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import AuthContext

log = get_logger("nextdays.site_config.bloecke")

#: Spalten einer Abschnitts-Zeile. Aufgezählt und nicht `*`: eine neue Spalte
#: soll eine bewusste Entscheidung sein, keine automatische Mitlieferung.
_BLOCK_COLS = (
    "id, page_id, type, position, content, settings, "
    # 0472: der Baum. Der Editor braucht ihn, um Abschnitte, Spalten und
    # Bausteine auseinanderzuhalten — ohne diese drei Felder sah er nur
    # eine flache Liste und nannte jeden Container „Unbekannter
    # Abschnitt".
    "kind, parent_id, span"
)


#: Bausteine, ohne die ihre Seite ihre AUFGABE verliert (0474).
#:
#: Der Wert je Seiten-Kennung ist der Bausteintyp, der dort mindestens einmal
#: stehen muss. Heute genau einer: die Buchungsseite ohne Buchungsformular.
#:
#: WARUM ES DIESE SPERRE GIBT
#: Eine Buchungsseite ohne `checkout_form` sieht aus wie eine Buchungsseite. Sie
#: hat Überschrift, Fotos, Preis — nur keinen Weg, zu buchen. Der Betrieb merkt
#: es nicht beim Speichern, sondern daran, dass Buchungen ausbleiben, und das
#: kann Wochen dauern. Genau diese Klasse Fehler verbietet Wurzel 5:
#: fail-closed, statt still einen Zustand zuzulassen, der lebendig aussieht.
#:
#: WARUM IM SERVICE UND NICHT IN DER DB
#: Eine DB-Bedingung müsste beim Löschen eines BELIEBIGEN Blocks zählen, wäre
#: also ein Trigger auf `site_blocks`. Ein Trigger, der beim Auswerten seiner
#: eigenen Bedingung wirft, legt jede Änderung an der Tabelle lahm — der Schaden
#: vom 23.08.2026 (0418→0424). Die Regel gehört an die Stelle, die löscht, mit
#: einer Meldung, die den Grund nennt.
PFLICHT_BAUSTEIN: dict[str, BlockType] = {
    "checkout": BlockType.checkout_form,
}


class BloeckeMixin:
    """Die Abschnitte einer Seite."""

    def _pflicht_baustein_pruefen(
        self,
        tenant_id: str,
        page_id: str,
        bleibende_typen: list[str],
    ) -> None:
        """Wirft, wenn der Pflicht-Baustein dieser Seite verschwinden würde.

        ``bleibende_typen`` sind die Typen, die NACH der Operation noch an der
        Seite stehen — der Aufrufer rechnet sie aus, denn nur er weiß, ob
        gelöscht, ersetzt oder ausgelassen wird.

        Seiten ohne Pflicht-Baustein laufen ohne Abfrage durch. Das ist der
        Normalfall: die Sperre gilt EINER Seite, und jede andere darf leer sein
        — eine leere Seite ist ein Entwurf, keine kaputte Buchungsstrecke.
        """
        seite = (
            self._db.table("site_pages")
            .select("system_key")
            .eq("id", page_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        # Keine Zeile heißt hier nicht „unbekannte Seite": der Aufrufer hat den
        # Scope schon geprüft. Es heißt, dass zwischen Prüfung und hier gelöscht
        # wurde — dann gibt es auch keinen Pflicht-Baustein mehr zu schützen.
        if not seite:
            return
        pflicht = PFLICHT_BAUSTEIN.get(seite[0].get("system_key") or "")
        if pflicht is None:
            return
        if pflicht.value in bleibende_typen:
            return
        raise SiteConfigError(
            "Diese Seite ist die Buchungsseite. Ohne den Baustein "
            "Buchungsabschluss kann kein Gast mehr buchen. Setzen Sie zuerst "
            "einen neuen Buchungsabschluss ein, dann lässt sich der alte "
            "entfernen.",
            status_code=422,
        )

    # === Page-Builder: Blöcke ================================================

    def _ziel_spalte(
        self,
        tenant_id: str,
        page_id: str,
        gewuenscht: str | None,
        position: int,
        settings: dict,
    ) -> tuple[str, int]:
        """Die Spalte, in die ein NEUER Baustein gehört — und seine TIEFE.

        Die Tiefe kommt mit, weil sie am Ziel hängt: in einer ``column`` sitzt
        der Baustein auf 2, in einer ``inner_column`` auf 3. Sie fest zu
        schreiben wäre ein 23514 aus ``site_blocks_tiefe_check``, sobald jemand
        in eine innere Spalte zieht — also ein 500 aus Client-Input (Wurzel 5).

        Ohne Wunsch: eine eigene Hülle (``_huelle_fuer_widget``) — der
        Normalfall, ein Baustein untereinander.

        MIT Wunsch: die gewünschte Spalte, nachdem geprüft ist, dass sie
        existiert, dem eigenen Betrieb gehört, zu DIESER Seite gehört und
        wirklich eine Spalte ist. Alle vier Prüfungen sind nötig, und zwar
        hier und nicht im Schema:

        * fremder Betrieb → sonst hängte man einen Baustein in die Seite eines
          anderen Kunden (Wurzel 3: Scope serverseitig erzwingen, denselben wie
          im List-Pfad);
        * fremde Seite → derselbe Fehler eine Ebene kleiner, innerhalb des
          eigenen Kontos;
        * kein Container → ein Baustein unter einem Baustein verletzt
          ``site_blocks_tiefe_check``, also ein 23514 als 500 aus
          Client-Input (Wurzel 5).

        Ein ungültiger Wunsch wird ABGEWIESEN und nicht still auf eine eigene
        Hülle gedreht: der Kunde hat in eine bestimmte Spalte gezogen, und ihn
        stattdessen woanders landen zu lassen wäre eine plausible Falschauskunft
        (Wurzel 4).
        """
        if gewuenscht is None:
            return (
                self._huelle_fuer_widget(tenant_id, page_id, position, settings),
                2,
            )
        # Über `_own_block`, nicht per rohem Load — Load und Scope bleiben
        # zusammen.
        ziel = self._own_block(tenant_id, gewuenscht)
        if ziel.get("page_id") != page_id:
            raise SiteConfigError(
                "Die Spalte gehört zu einer anderen Seite.", status_code=422
            )
        art = ziel.get("kind") or "widget"
        if art not in ("column", "inner_column"):
            raise SiteConfigError(
                "Ein Baustein kann dort nicht stehen.", status_code=422
            )
        return gewuenscht, 3 if art == "inner_column" else 2

    def _huelle_fuer_widget(
        self, tenant_id: str, page_id: str, position: int, settings: dict
    ) -> str:
        """Legt `section > column` an und gibt die Spalten-ID zurück.

        Seit 0472 ist eine Seite ein BAUM: ein Baustein hängt in einer Spalte,
        die Spalte in einem Abschnitt, der Abschnitt an der Seite. Die
        DB-Regeln erzwingen das (`site_blocks_wurzel_check`,
        `site_blocks_tiefe_check`) — ein `kind='widget'` ohne `parent_id` ist
        keine Zeile, die man speichern und später aufräumen kann, sondern eine,
        die der Constraint sofort ablehnt.

        Warum diese Methode überhaupt existiert: die Spalten-DEFAULTS der
        Migration sind `kind='widget'` und `tiefe=0` — eine Kombination, die
        derselbe Constraint verbietet (ein Widget muss auf Tiefe 2 oder 3
        sitzen). Ein Insert, der die drei Baum-Felder nicht selbst setzt,
        scheitert deshalb IMMER, nicht nur in Randfällen. Genau das ist live
        passiert (25.08.2026): `PUT …/blocks` warf 23514
        `site_blocks_tiefe_check` als 500, und zwar für jeden neu
        hinzugefügten Baustein — der Lesepfad war nach 0472 nachgezogen
        worden, die beiden SCHREIB-Pfade nicht.

        Die Einstellungen wandern an den ABSCHNITT (Hintergrund, Abstände,
        Gerätesichtbarkeit wirken dort), genau wie es die Migration für den
        Bestand gemacht hat — damit sieht ein neu angelegter Baustein aus wie
        ein migrierter.
        """
        section = (
            self._db.table("site_blocks")
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
            raise SiteConfigError(
                "Abschnitt konnte nicht angelegt werden.", status_code=500
            )
        spalte = (
            self._db.table("site_blocks")
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
            raise SiteConfigError(
                "Spalte konnte nicht angelegt werden.", status_code=500
            )
        return spalte[0]["id"]

    def list_blocks(
        self, ctx: AuthContext, page_id: str, *, mit_containern: bool = False
    ) -> BlockListResponse:
        """Die BAUSTEINE einer Seite, in der Reihenfolge ihrer Abschnitte.

        Container (`section`, `column`, `inner_column`) sind Struktur und kein
        Inhalt (0472) — sie tragen `type = 'container'` und ein leeres
        `content`. Sie mitzuliefern hieße, dem Editor Zeilen zu geben, für die
        er kein Formular hat: er zeigte sie als „Unbekannter Abschnitt" und der
        Kunde sähe seine acht Bausteine als vierundzwanzig.

        SORTIERT wird nach der Position des ABSCHNITTS, nicht des Bausteins:
        seit 0472 ist jedes Widget Position 0 in seiner Spalte, `order` auf der
        eigenen Zeile ergäbe also eine beliebige Reihenfolge (alle Werte
        gleich). Der Weg dorthin führt über `parent_id` — Widget → Spalte →
        Abschnitt.
        """
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        rows = (
            self._db.table("site_blocks")
            .select(_BLOCK_COLS)
            .eq("page_id", page_id)
            .order("position")
            .execute()
        ).data or []

        # Position je Block-ID — für Container ihre eigene, für Bausteine die
        # ihres Abschnitts.
        pos_von = {r["id"]: r.get("position") or 0 for r in rows}
        eltern_von = {r["id"]: r.get("parent_id") for r in rows}

        def abschnitts_position(row: dict) -> int:
            """Position des Abschnitts, unter dem dieser Baustein hängt."""
            gesehen: set[str] = set()
            aktuell = row["id"]
            # Höchstens drei Schritte (widget → column → section); die Schleife
            # bricht bei einer defekten Kette ab, statt endlos zu laufen.
            while aktuell and aktuell not in gesehen:
                gesehen.add(aktuell)
                elter = eltern_von.get(aktuell)
                if not elter:
                    return pos_von.get(aktuell, 0)
                aktuell = elter
            return pos_von.get(row["id"], 0)

        def baum_rang(row: dict) -> tuple[int, int, int]:
            """Die VOLLE Ordnung einer Zeile: Abschnitt, Spalte, eigener Rang.

            Nach Abschnitt allein zu sortieren reichte, solange in jeder Spalte
            genau ein Baustein stand. Seit zwei nebeneinander (verschiedene
            Spalten) und zwei übereinander (dieselbe Spalte) möglich sind,
            entscheidet erst diese Kette: die Spalte bestimmt links/rechts, die
            eigene Position oben/unten. Ohne sie wäre die Reihenfolge innerhalb
            eines Abschnitts die der Datenbank — also zufällig (0479).
            """
            spalte_id = eltern_von.get(row["id"])
            return (
                abschnitts_position(row),
                pos_von.get(spalte_id, 0) if spalte_id else 0,
                row.get("position") or 0,
            )

        if mit_containern:
            # Die Ebenen-Ansicht braucht die STRUKTUR, nicht nur die Blaetter:
            # ohne die Container findet `baumBauen` zu keinem Baustein den
            # Elternteil und haengt alles als Wurzel an.
            #
            # Sortiert wird nach der Position des Abschnitts (dieselbe Kette wie
            # unten), und innerhalb eines Abschnitts steht der Container VOR
            # seinem Inhalt — sonst haengt im Baum ein Kind ueber dem Elternteil.
            # `position` bleibt hier die ECHTE Zeilen-Position: ein Rang ueber
            # alle Zeilen wuerde die Spalten mitzaehlen und die Nummern der
            # Abschnitte verfaelschen.
            rang = {"section": 0, "column": 1, "inner_column": 2, "widget": 3}
            alle = sorted(
                rows,
                key=lambda r: (
                    abschnitts_position(r),
                    rang.get(r.get("kind") or "widget", 9),
                    # Innerhalb einer Ebene die eigene Position: sonst stünden
                    # zwei Spalten desselben Abschnitts in der Reihenfolge der
                    # Datenbank, und der Ebenen-Baum zeigte links, was rechts
                    # steht.
                    r.get("position") or 0,
                ),
            )
            return BlockListResponse(
                items=[BlockResponse(**r) for r in alle], total=len(alle)
            )

        bausteine = [
            r for r in rows if (r.get("kind") or "widget") == "widget"
        ]
        bausteine.sort(key=baum_rang)
        # `position` NACH AUSSEN ist der Rang in der Seite, nicht der in der
        # Spalte. Innen ist jedes Widget Position 0 (0472); gäbe man das so
        # heraus, stünde im Editor an jedem Abschnitt „0" und ein Aufrufer,
        # der nach `position` sortiert, bekäme eine zufällige Reihenfolge.
        # Der Rang wird deshalb hier vergeben — aus der bereits sortierten
        # Liste, damit Anzeige und Wert dasselbe sagen.
        items = [
            BlockResponse(**{**r, "position": rang})
            for rang, r in enumerate(bausteine)
        ]
        return BlockListResponse(items=items, total=len(items))

    #: Erlaubte Kind-Arten je Elternteil (0472). Der Baum ist genau drei Ebenen
    #: tief; `inner_column` ist die letzte, darunter stehen nur Bausteine.
    _KIND_UNTER: dict[str, tuple[str, ...]] = {
        "section": ("column",),
        "column": ("inner_column",),
    }

    #: Tiefe je Art — dieselben Werte, die `site_blocks_tiefe_check` erzwingt.
    _TIEFE: dict[str, int] = {
        "section": 0,
        "column": 1,
        "inner_column": 2,
    }

    def _container_anlegen(
        self,
        ctx: AuthContext,
        tenant_id: str,
        page_id: str,
        req: BlockCreate,
    ) -> BlockResponse:
        """Einen Abschnitt, eine Spalte oder eine innere Spalte anlegen.

        Die Prüfungen sind nicht Zierrat, sondern der Unterschied zwischen einem
        422 und einem 500: `site_blocks_wurzel_check` und
        `site_blocks_tiefe_check` lehnen eine falsche Kombination in der DB ab,
        und ein 23514 aus angreiferkontrolliertem Input ist genau das, was
        Wurzel 5 verbietet. Also hier fangen, mit einem Satz, der sagt was
        falsch ist.

        `span` in Zwölfteln, wie der Renderer es liest (`flexBasis:
        span/12*100%`): 6 ist die halbe Breite, 4 ein Drittel. Ohne Angabe
        teilen sich die Geschwister die Breite gleichmäßig — das ist kein
        erfundener Standardwert, sondern das Verhalten von `flex` ohne
        `flex-basis`.
        """
        art = req.kind
        eltern_id = req.parent_id

        if art == "section":
            if eltern_id is not None:
                raise SiteConfigError(
                    "Ein Abschnitt hängt an der Seite, nicht an einem "
                    "anderen Block.",
                    status_code=422,
                )
            eltern_art = None
        else:
            if eltern_id is None:
                raise SiteConfigError(
                    "Eine Spalte braucht einen Abschnitt, in dem sie steht.",
                    status_code=422,
                )
            # Über `_own_block`, nicht per rohem Load: der Elternteil MUSS dem
            # eigenen Betrieb gehören (Wurzel 3).
            eltern = self._own_block(tenant_id, eltern_id)
            if eltern.get("page_id") != page_id:
                # Sonst hängte man eine Spalte einer Seite unter den Abschnitt
                # einer anderen — derselbe Scope-Fehler, den `replace_blocks`
                # für Bausteine schon abfängt.
                raise SiteConfigError(
                    "Der Abschnitt gehört zu einer anderen Seite.",
                    status_code=422,
                )
            eltern_art = eltern.get("kind") or "widget"
            if art not in self._KIND_UNTER.get(eltern_art, ()):
                raise SiteConfigError(
                    "Diese Spalte kann dort nicht stehen.", status_code=422
                )

        # WOHIN. `position` ist bei Kindern die Ordnung IM Elternteil, bei
        # Abschnitten die in der Seite.
        #
        # Ohne Angabe ans Ende. MIT Angabe wird eingeschoben — und dann müssen
        # die Geschwister dahinter mitwandern (Wurzel 1: wer eine Ordnung neu
        # setzt, pflegt die dadurch verschobene alte mit). Ohne das Nachziehen
        # gäbe es zwei Zeilen mit derselben Position, und welche zuerst steht,
        # entschiede die Datenbank.
        abfrage = self._db.table("site_blocks").select("id, position")
        abfrage = (
            abfrage.eq("page_id", page_id).is_("parent_id", "null")
            if eltern_id is None
            else abfrage.eq("parent_id", eltern_id)
        )
        geschwister = (abfrage.order("position").execute()).data or []

        if req.position is None:
            position = (geschwister[-1]["position"] + 1) if geschwister else 0
        else:
            # Geklemmt auf den möglichen Bereich: eine Position hinter dem Ende
            # ist „ans Ende", eine negative gibt es nicht. Ein 422 dafür wäre
            # zu streng — der Editor rechnet die Naht aus einer Liste, die sich
            # zwischen Klick und Request geändert haben kann.
            position = max(0, min(req.position, len(geschwister)))
            for g in geschwister:
                if g["position"] >= position:
                    (
                        self._db.table("site_blocks")
                        .update({"position": g["position"] + 1})
                        .eq("id", g["id"])
                        .execute()
                    )

        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "page_id": page_id,
            # Ein Container trägt den Typ `container` — sein Aussehen steht in
            # eigenen SPALTEN (`kind`, `span`), nicht im `content`-JSON (0472).
            "type": BlockType.container.value,
            "kind": art,
            "tiefe": self._TIEFE[art],
            "parent_id": eltern_id,
            "position": position,
            "content": {},
            "settings": self._validate_settings(req.settings),
        }
        # `span` NUR an Spalten: an einem Abschnitt wäre es wirkungslos (der
        # Renderer wertet es dort nicht aus), und ein gespeicherter Wert ohne
        # Wirkung ist eine Zusage, die niemand einlöst (Wurzel 4).
        if art != "section" and req.span is not None:
            payload["span"] = req.span

        res = self._db.table("site_blocks").insert(payload).execute()
        if not res.data:
            raise SiteConfigError(
                "Spalte konnte nicht angelegt werden.", status_code=500
            )
        angelegt = self._block_row(res.data[0])
        return BlockResponse(**angelegt)

    def add_block(
        self, ctx: AuthContext, page_id: str, req: BlockCreate
    ) -> BlockResponse:
        tenant_id = self._require_tenant(ctx)
        # Der Rückgabewert wird nicht gebraucht — der Aufruf prüft das Eigentum
        # (Wurzel 3) und wirft, wenn die Seite einem anderen Betrieb gehört.
        self._own_page(tenant_id, page_id)
        # Bis 0474 wies diese Stelle jede Systemseite ab (0466: „ihr Inhalt ist
        # die Anwendung selbst"). Seit 0474 lesen die Renderer-Routen ihre
        # Vorlage über `system-vorlage` — ein Baustein an einer Systemseite wird
        # also gezeichnet, und die Abweisung war ab da der Fehler.
        #
        # Sie ist beim Umbau nur an EINER von drei Stellen gefallen:
        # `replace_blocks` (der Weg des Editors) hat sie verloren, `add_block`
        # und `reorder_blocks` trugen sie weiter. Die Folge war die stille
        # Variante — die Blog-Übersicht sah gestaltbar aus, blieb aber leer,
        # weil kein Baustein darauf entstehen konnte. Genau deshalb hatte
        # „Layouts" im Blog-CMS nichts zu bedienen.
        #
        # Der Schutz fällt damit nicht weg, er sitzt an der Frage, die zählt:
        # bleibt die Seite funktionsfähig (`_pflicht_baustein_pruefen` beim
        # Löschen).
        # --- Container (Spalte, halbe Spalte, Abschnitt) --------------------
        #
        # Eigener Zweig, weil ein Container das Gegenteil eines Bausteins ist:
        # er hat keinen Inhalt (`ContainerContent` ist leer, 0472), er braucht
        # keine Hülle, und seine Tiefe ergibt sich aus dem Elternteil.
        #
        # Ohne diesen Zweig konnte der Editor überhaupt keine Spalten anlegen:
        # die DB kennt `section`/`column`/`inner_column` samt `span` seit 0472
        # und der Renderer zeichnet `span` als Anteil von zwölf — aber der
        # einzige Schreibweg legte immer `kind='widget'` an. Jeder Baustein
        # landete deshalb in seiner eigenen einspaltigen Reihe, und zwei Dinge
        # nebeneinander zu setzen war unmöglich.
        if req.kind != "widget":
            return self._container_anlegen(ctx, tenant_id, page_id, req)

        roh = dict(req.content or {})
        if req.type is BlockType.contact:
            # Ein Kontakt-Abschnitt ohne Kontaktdaten ist nutzlos, und die Daten
            # liegen im Konto. Also gleich einsetzen statt den Kunden abtippen
            # zu lassen — was er selbst mitgeschickt hat, gewinnt.
            roh = konto_daten.kontakt_mit_firmendaten(
                roh, konto_daten.firmendaten(self._db, tenant_id), nur_leere=True
            )
        content = self._validate_content(req.type, roh)
        settings = self._validate_settings(req.settings)

        # IN EINE BESTEHENDE SPALTE, wenn eine mitgeschickt wurde (0479).
        #
        # Vorher wurde `parent_id` für Bausteine schlicht ignoriert: der
        # Baustein bekam IMMER seine eigene Hülle, also eine neue Reihe über
        # die ganze Breite. Damit gab es über diesen Weg keine Möglichkeit,
        # etwas in eine vorhandene Spalte zu legen — der einzige Weg dorthin
        # war der Vollersatz `replace_blocks`, und ein zweiter Baustein in
        # derselben Spalte war überhaupt nicht möglich.
        if req.parent_id:
            eltern = self._own_block(tenant_id, req.parent_id)
            if eltern.get("page_id") != page_id:
                raise SiteConfigError(
                    "Die Spalte gehört zu einer anderen Seite.", status_code=422
                )
            eltern_art = eltern.get("kind") or "widget"
            if eltern_art not in ("column", "inner_column"):
                # Ein Baustein hängt in einer SPALTE. Direkt in einem Abschnitt
                # verbietet ihn `site_blocks_tiefe_check` — das hier ist der
                # 422 davor, statt eines 23514 als 500 (Wurzel 5).
                raise SiteConfigError(
                    "Ein Baustein steht in einer Spalte.", status_code=422
                )
            geschwister = (
                self._db.table("site_blocks")
                .select("position")
                .eq("parent_id", req.parent_id)
                .order("position", desc=True)
                .limit(1)
                .execute()
            ).data or []
            in_spalte = (
                (geschwister[0]["position"] + 1) if geschwister else 0
            )
            return self._widget_einsetzen(
                ctx,
                tenant_id,
                page_id,
                req.type,
                content,
                settings,
                parent_id=str(req.parent_id),
                position=in_spalte,
            )

        rows = (
            self._db.table("site_blocks")
            .select("position")
            .eq("page_id", page_id)
            .order("position", desc=True)
            .limit(1)
            .execute()
        ).data or []
        next_pos = (rows[0]["position"] + 1) if rows else 0
        # Der Baustein braucht seine Hülle (0472): section > column > widget.
        spalte_id = self._huelle_fuer_widget(
            tenant_id, page_id, next_pos, settings
        )
        return self._widget_einsetzen(
            ctx,
            tenant_id,
            page_id,
            req.type,
            content,
            settings,
            parent_id=spalte_id,
            position=0,
        )

    def _widget_einsetzen(  # noqa: PLR0913 — alle Werte sind Pflichtangaben
        self,
        ctx: AuthContext,
        tenant_id: str,
        page_id: str,
        typ: BlockType,
        content: dict,
        settings: dict,
        *,
        parent_id: str,
        position: int,
    ) -> BlockResponse:
        """Einen Baustein in eine SPALTE schreiben und mit Rang zurückgeben.

        Eine Methode für beide Wege aus ``add_block`` (frische Hülle bzw.
        vorhandene Spalte): der Insert und die Rang-Rückgabe sind identisch, und
        zwei Kopien davon wären zwei Orte, an denen man den Rang vergisst.
        """
        payload = {
            "tenant_id": tenant_id,
            "page_id": page_id,
            "type": typ.value,
            "kind": "widget",
            "tiefe": 2,
            "parent_id": parent_id,
            "position": position,
            "content": content,
            "settings": settings,
        }
        res = self._db.table("site_blocks").insert(payload).execute()
        if not res.data:
            raise SiteConfigError(
                "Block konnte nicht angelegt werden.", status_code=500
            )
        # Die Antwort trägt denselben `position`-Begriff wie die Liste: den
        # Rang in der SEITE. Roh aus der Zeile käme die Position in der Spalte —
        # der Aufrufer hätte zwei Wahrheiten über dieselbe Reihenfolge
        # (Wurzel 2).
        angelegt = self._block_row(res.data[0])
        rang = next(
            (
                b.position
                for b in self.list_blocks(ctx, page_id).items
                if b.id == angelegt["id"]
            ),
            angelegt.get("position", 0),
        )
        return BlockResponse(**{**angelegt, "position": rang})

    def update_block(
        self, ctx: AuthContext, block_id: str, req: BlockUpdate
    ) -> BlockResponse:
        tenant_id = self._require_tenant(ctx)
        block = self._own_block(tenant_id, block_id)
        patch: dict = {}
        if req.content is not None:
            patch["content"] = self._validate_content(
                BlockType(block["type"]), req.content
            )
        if req.settings is not None:
            patch["settings"] = self._validate_settings(req.settings)
        if req.span is not None:
            # Nur Spalten haben eine Breite. An einer Section wäre `span`
            # bedeutungslos (sie ist immer voll breit), an einem Baustein
            # gehört die Breite der Spalte darüber. Beides wird abgewiesen und
            # nicht still verworfen: der Kunde soll nicht „gespeichert" lesen,
            # während sich nichts ändert (Wurzel 5).
            if (block.get("kind") or "widget") not in ("column", "inner_column"):
                raise SiteConfigError(
                    "Eine Breite hat nur eine Spalte.", status_code=422
                )
            patch["span"] = req.span
        if patch:
            self._db.table("site_blocks").update(patch).eq("id", block_id).eq(
                "tenant_id", tenant_id
            ).execute()
        return self._load_block(tenant_id, block_id)

    def reorder_blocks(
        self, ctx: AuthContext, page_id: str, ordered_ids: list[str]
    ) -> BlockListResponse:
        tenant_id = self._require_tenant(ctx)
        # Nur die Eigentumsprüfung (Wurzel 3), der Rückgabewert wird hier nicht
        # gebraucht.
        self._own_page(tenant_id, page_id)
        # Wie bei `add_block`: die Systemseiten-Abweisung ist seit 0474 falsch
        # (siehe dort). Wer Bausteine anlegen darf, muss sie auch ordnen können.
        # Alle BAUSTEIN-IDs der Seite laden und prüfen, dass die übergebene
        # Liste exakt diese Menge ist (kein fremder/fehlender Block).
        #
        # Nur Bausteine: der Editor kennt seit 0472 keine Container, er schickt
        # also die Liste, die er auch bekommen hat. Zählte man die Container
        # mit, passte die Menge nie und jedes Sortieren endete mit 400.
        rows = (
            self._db.table("site_blocks")
            .select("id, kind, parent_id")
            .eq("page_id", page_id)
            .execute()
        ).data or []
        bausteine = {
            r["id"]: r.get("parent_id")
            for r in rows
            if (r.get("kind") or "widget") == "widget"
        }
        if set(ordered_ids) != set(bausteine):
            raise SiteConfigError(
                "Die Blockliste passt nicht zur Seite.", status_code=400
            )
        # Die Reihenfolge steht am ABSCHNITT (siehe `replace_blocks`): der
        # Baustein ist Position 0 in seiner Spalte.
        eltern_von = {r["id"]: r.get("parent_id") for r in rows}
        for pos, block_id in enumerate(ordered_ids):
            spalte_id = bausteine.get(block_id)
            section_id = eltern_von.get(spalte_id) if spalte_id else None
            # Ein Baustein OHNE Hülle trägt seine Reihenfolge selbst — er hängt
            # direkt an der Seite, also ist seine eigene `position` der Rang.
            # Solche Zeilen gibt es real (angelegt vor 0472, von der Migration
            # nicht erfasst) und im Test. Sie zu überspringen hieße: der Kunde
            # sortiert, die Liste springt zurück, und niemand sagt warum.
            ziel = section_id or block_id
            self._db.table("site_blocks").update({"position": pos}).eq(
                "id", ziel
            ).eq("tenant_id", tenant_id).execute()
        return self.list_blocks(ctx, page_id)

    def replace_blocks(
        self, ctx: AuthContext, page_id: str, req: BlocksReplaceRequest
    ) -> BlockListResponse:
        """ALLE Abschnitte einer Seite in EINEM Aufruf setzen.

        Der Editor speicherte bisher mit N+1 einzelnen Requests (löschen, dann
        updaten, dann anlegen, dann neu ordnen). Brach einer in der Mitte ab,
        blieb die Seite halb gespeichert — und ein Doppelklick auf „Speichern"
        lief zweimal durch dieselbe Sequenz. Hier ist der Speichervorgang EINE
        idempotente Operation: dieselbe Liste zweimal gesendet ergibt denselben
        Zustand (Wurzel 2).

        Jede mitgeschickte Block-ID muss zu DIESER Seite gehören — nicht bloß zum
        Tenant. Sonst könnte man mit einer fremden Block-ID aus einer anderen
        Seite des eigenen Kontos deren Abschnitt hierher umhängen (Wurzel 3:
        Scope serverseitig erzwingen, und zwar denselben wie im List-Pfad)."""
        tenant_id = self._require_tenant(ctx)
        self._own_page(tenant_id, page_id)
        # Bis 0474 wies diese Stelle jede Systemseite ab, mit der
        # Begründung „ihr Inhalt ist die Anwendung selbst" (0466). Das
        # galt, solange die Renderer-Routen ihr Aussehen fest eingebaut
        # hatten. Seit 0474 lesen sie ihre Vorlage — Blöcke an einer
        # Systemseite werden also gerendert, und die Abweisung wäre jetzt
        # die Attrappe: der Editor öffnet die Seite, der Kunde baut, und
        # das Speichern schlägt fehl.
        #
        # Was NICHT wegfällt, ist der Schutz. Er sitzt nur nicht mehr an
        # der Frage „ist das eine Systemseite", sondern an der Frage, die
        # wirklich zählt: bleibt die Seite funktionsfähig
        # (`_pflicht_baustein_pruefen`, unten beim Löschen).

        # NUR die Bausteine. Abschnitte und Spalten sind Struktur (0472) und
        # kommen in der gesendeten Liste gar nicht vor — sie hier mitzuzählen
        # hieße, sie im nächsten Schritt als „weggefallen" zu löschen.
        #
        # GENAU DAS IST PASSIERT (25.08.2026): direkt nach der Migration schickte
        # der Editor seine Liste, `entfallen` enthielt alle 16 Abschnitte und
        # alle 16 Spalten, und deren Löschung riss über `on delete cascade` die
        # Bausteine mit. Von 16 Bausteinen blieben 4 übrig.
        #
        # Der Filter steht deshalb an der QUELLE und nicht erst beim Löschen:
        # `vorhanden` beantwortet die Frage „welche Blöcke verwaltet diese
        # Liste", und die Antwort war nie „auch die Container".
        vorhanden = {
            r["id"]: r["type"]
            for r in (
                self._db.table("site_blocks")
                .select("id, type, kind")
                .eq("page_id", page_id)
                .execute()
            ).data
            or []
            # Fehlendes `kind` heißt `widget` — dieselbe Regel wie der
            # Spalten-Default. Gefiltert wird HIER und nicht in der Abfrage:
            # eine Zeile ohne das Feld (ältere Fassung, Testdaten) fiele bei
            # `.eq("kind", "widget")` heraus und würde damit zum Löschen
            # freigegeben. Ein Filter, der im Zweifel MEHR löscht, ist an
            # dieser Stelle der gefährlichste (Wurzel 5: fail-closed).
            if (r.get("kind") or "widget") == "widget"
        }

        gesendet: set[str] = set()
        # Eine ID, die diese Seite NICHT MEHR trägt, ist der Normalfall von
        # Rückgängig: der Verlauf spielt einen Stand ein, der vor dem Löschen
        # lag, und trägt damit zwangsläufig die ID des gelöschten Bausteins.
        #
        # Bis 27.08.2026 wies diese Stelle die ganze Nutzlast dafür ab, und
        # Rückgängig war damit vollständig funktionslos — nicht nur der eine
        # Schritt: der Editor blieb danach im Fehlerzustand stehen und ließ
        # sich weder speichern noch verlassen. Gemeldet im Prüfbericht als A1;
        # der Kommentar in `use-verlauf.ts` nennt genau diesen Rückweg als
        # Begründung dafür, dass es den Verlauf überhaupt gibt.
        #
        # Der Scope-Schutz (Wurzel 3) fällt damit NICHT weg, er wandert nur
        # auf die Frage, die wirklich zählt: gehört die Zeile diesem Tenant?
        # Eine fremde Block-ID aus einer anderen Seite DESSELBEN Kontos
        # bleibt abgewiesen — sonst hängte man deren Abschnitt hierher um.
        # Eine gelöschte Zeile ist in `wiederbelebbar` gar nicht enthalten
        # (sie ist weg), sie wird deshalb unten als NEU angelegt.
        fremde = [i.id for i in req.items if i.id is not None and i.id not in vorhanden]
        wiederbelebbar: set[str] = set()
        if fremde:
            # Was von diesen IDs überhaupt (noch) existiert, und wo. Nur
            # Zeilen, die es NICHT mehr gibt, dürfen als Wiederherstellung
            # durchgehen; alles Existierende gehört zu einer anderen Seite
            # und bleibt verboten.
            belegt = {
                r["id"]: r.get("page_id")
                for r in (
                    self._db.table("site_blocks")
                    .select("id, page_id")
                    .in_("id", sorted(set(fremde)))
                    .eq("tenant_id", tenant_id)
                    .execute()
                ).data
                or []
            }
            for bid in fremde:
                if bid in belegt:
                    log.warning(
                        "site_blocks_replace_fremder_abschnitt",
                        page_id=page_id,
                        block_id=bid,
                        liegt_auf=belegt[bid],
                        bekannt=sorted(vorhanden),
                    )
                    raise SiteConfigError(
                        "Ein Abschnitt gehört nicht zu dieser Seite.",
                        status_code=400,
                    )
                wiederbelebbar.add(bid)
            log.info(
                "site_blocks_replace_wiederhergestellt",
                page_id=page_id,
                bausteine=sorted(wiederbelebbar),
                anzahl=len(wiederbelebbar),
            )
        for item in req.items:
            if item.id is None:
                continue
            # Doppelt bleibt doppelt, auch bei einer wiederhergestellten ID:
            # zweimal dieselbe Zeile wäre zweimal derselbe Baustein.
            if item.id in gesendet:
                log.warning(
                    "site_blocks_replace_doppelt",
                    page_id=page_id,
                    block_id=item.id,
                )
                raise SiteConfigError(
                    "Ein Abschnitt kommt doppelt vor.", status_code=400
                )
            if item.id in wiederbelebbar:
                # Kein Typvergleich: die Zeile ist gelöscht, es gibt keinen
                # alten Typ, gegen den man prüfen könnte. Ihr Inhalt läuft
                # unten durch dieselbe Schema-Validierung wie jeder Neuling.
                gesendet.add(item.id)
                continue
            if vorhanden[item.id] != item.type.value:
                # Typwechsel gibt es fachlich nicht (jeder Typ hat ein eigenes
                # content-Schema). Der Editor schickt das nie — klar fehlschlagen
                # statt still das falsche Schema zu validieren (Wurzel 5).
                log.warning(
                    "site_blocks_replace_typwechsel",
                    page_id=page_id,
                    block_id=item.id,
                    war=vorhanden[item.id],
                    neu=item.type.value,
                )
                raise SiteConfigError(
                    "Ein Abschnitt kann seinen Typ nicht wechseln.",
                    status_code=400,
                )
            gesendet.add(item.id)

        # 1) ALLES validieren, BEVOR irgendetwas geschrieben wird (Wurzel 5:
        #    fail-closed vor dem Seiteneffekt).
        #
        #    Vorher wurde zuerst gelöscht und dann in der Schreib-Schleife
        #    validiert. Schlug ein Abschnitt weiter hinten fehl, waren die
        #    Löschungen schon committet: der Aufrufer bekam 400 und glaubte,
        #    nichts sei passiert — der entfernte Abschnitt war aber unwiederbring-
        #    lich weg. Genau die Kombination trat real auf, weil eine E-Mail im
        #    Kontakt-Abschnitt zuverlässig einen 400 auslöste.
        #    Die Darstellungs-Settings laufen hier durch DIESELBE Vorprüfung
        #    wie der Inhalt. Sie erst in der Schreib-Schleife zu prüfen hätte
        #    die Lücke wieder aufgemacht, die der Absatz oben beschreibt: die
        #    Löschungen wären schon geschrieben, wenn Abschnitt sieben an einer
        #    Farbe scheitert.
        geprueft = [
            (
                pos,
                item,
                self._validate_content(item.type, item.content),
                self._validate_settings(item.settings),
            )
            for pos, item in enumerate(req.items)
        ]

        # 2) Weggefallene Abschnitte löschen (der Gegenzustand zur neuen Liste,
        #    Wurzel 1 — sonst bleiben gelöschte Abschnitte auf der Seite stehen).
        #
        #    MIT IHRER HÜLLE. Ein Baustein hängt seit 0472 in einer Spalte und
        #    die in einem Abschnitt (`section > column > widget`); nur das
        #    Widget zu löschen ließe beide als leere Container stehen. Sichtbar
        #    wäre das als Lücke an der Stelle, an der der entfernte Abschnitt
        #    war — und der Kunde, der „Entfernen" geklickt hat, sähe seinen
        #    Baustein verschwinden, aber den Platz bleiben. Gemeldet am
        #    25.08.2026 als „rechte Maustaste und entfernen geht nicht".
        #
        #    Gelöscht wird von OBEN: `on delete cascade` an `parent_id` nimmt
        #    Spalte und Widget mit, wenn der Abschnitt fällt. Bleibt die Kette
        #    unvollständig (Bestandszeile ohne Hülle), wird wenigstens das
        #    Widget selbst entfernt — nie weniger als vorher.
        # Nur, was der Client wirklich WEGGENOMMEN hat. Ein Baustein, den er
        # nie gesehen hat (angelegt, während sein Stand schon stand), ist
        # keine Löschung — er ist ein zweiter Schreiber (Wurzel 1).
        #
        # Ohne diese Einschränkung war jeder Vollersatz ein „nur mein Stand
        # zählt": zwei offene Reiter, Editor plus Mobil-App, oder auch nur ein
        # zweites Fenster — der zuletzt Speichernde löschte die Arbeit des
        # anderen. Live nachgewiesen am 28.08.2026 (Abschnitte verschwanden
        # bei geöffnetem Editor wieder, samt Hüllen).
        entfallen = self._wirklich_entfallen(
            page_id, vorhanden, gesendet, req.bekannte_ids
        )
        # Der Pflicht-Baustein (0474). Auslassen IST hier Löschen: was nicht
        # in der gesendeten Liste steht, wird gleich entfernt. Ohne diese
        # Prüfung wäre die Sperre an `remove_block` wirkungslos — der Editor
        # speichert die Seite ohnehin über diesen Weg, und ein Kunde, der den
        # Buchungsabschluss im Editor herauszieht, hätte ihn damit gelöscht.
        #
        # Gezählt werden die Typen, die BLEIBEN: die neu gesendeten (auch die
        # ohne ID, also gerade eingesetzte) plus die behaltenen Bestandsblöcke.
        bleibende_typen = [
            item.type.value
            for item in req.items
            if item.id is None or item.id in wiederbelebbar
        ]
        bleibende_typen += [
            typ for bid, typ in vorhanden.items() if bid in gesendet
        ]
        self._pflicht_baustein_pruefen(tenant_id, page_id, bleibende_typen)
        if entfallen:
            zu_loeschen = set(entfallen)
            eltern = {
                r["id"]: r.get("parent_id")
                for r in (
                    self._db.table("site_blocks")
                    .select("id, parent_id")
                    .eq("page_id", page_id)
                    .eq("tenant_id", tenant_id)
                    .execute()
                ).data
                or []
            }
            # Spalten, die ein GESENDETER Baustein als Ziel nennt, sind
            # tabu — auch wenn ihr bisheriger Inhalt entfällt.
            #
            # Ohne das riss das Aufräumen genau die Spalte weg, in die der
            # Kunde gerade etwas gezogen hatte: `parent_id` zeigte danach ins
            # Leere. Der Fall entsteht beim Verschieben zwischen zwei Spalten,
            # also beim ersten Handgriff, den ein Spaltenlayout überhaupt
            # nahelegt.
            ziele = {
                item.parent_id for item in req.items if item.parent_id is not None
            }
            for wid in entfallen:
                spalte_id = eltern.get(wid)
                if spalte_id in ziele:
                    continue
                section_id = eltern.get(spalte_id) if spalte_id else None
                # Die Hülle fällt nur, wenn sie AUSSCHLIESSLICH diesen
                # Baustein trägt. Eine Spalte mit zwei Bausteinen, von denen
                # einer bleibt, gehört nicht gelöscht — sonst risse das
                # Entfernen des einen den anderen mit (dasselbe `cascade`,
                # das hier nützt, wäre dann der Schaden).
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
            # LAUT protokollieren, was mitgeht. Ein Löschen ist die eine
            # Operation, die man nicht nachträglich untersuchen kann — die
            # Zeilen sind dann weg. Ohne diese Zeile war „mein Abschnitt ist
            # noch da" und „mein Abschnitt ist zu viel weg" derselbe stumme
            # Befund (Wurzel 5).
            log.info(
                "site_blocks_entfernt",
                page_id=page_id,
                bausteine=sorted(entfallen),
                mit_huelle=sorted(zu_loeschen - set(entfallen)),
                anzahl=len(zu_loeschen),
            )
            self._db.table("site_blocks").delete().in_(
                "id", sorted(zu_loeschen)
            ).eq("tenant_id", tenant_id).execute()

        # 3) Bestehende aktualisieren bzw. neue anlegen.
        #
        #    Die REIHENFOLGE der Seite steht seit 0472 am ABSCHNITT, nicht am
        #    Baustein: ein Widget ist Position 0 in seiner Spalte, die Spalte
        #    Position 0 in ihrem Abschnitt, und erst die Abschnitte sind
        #    untereinander sortiert. `position` auf das Widget zu schreiben
        #    verschöbe deshalb nichts, was man sieht — die Liste käme in
        #    unveränderter Reihenfolge zurück, und das Umsortieren im Editor
        #    wäre eine Bewegung ohne Wirkung.
        #
        #    Der Weg nach oben führt über `parent_id` (Widget → Spalte →
        #    Abschnitt). Er wird für die Bestandsblöcke EINMAL aufgelöst statt
        #    je Schleifendurchlauf zweimal abzufragen.
        bestehende = [
            i.id
            for _, i, _, _ in geprueft
            if i.id is not None and i.id not in wiederbelebbar
        ]
        abschnitt_von: dict[str, str] = {}
        spalten_von_bestand: dict[str, str] = {}
        abschnitt_von_spalte: dict[str, str] = {}
        if bestehende:
            spalten_von_bestand = {
                r["id"]: r["parent_id"]
                for r in (
                    self._db.table("site_blocks")
                    .select("id, parent_id")
                    .in_("id", bestehende)
                    .eq("tenant_id", tenant_id)
                    .execute()
                ).data
                or []
                if r.get("parent_id")
            }
            if spalten_von_bestand:
                abschnitt_von_spalte = {
                    r["id"]: r["parent_id"]
                    for r in (
                        self._db.table("site_blocks")
                        .select("id, parent_id")
                        .in_("id", sorted(set(spalten_von_bestand.values())))
                        .eq("tenant_id", tenant_id)
                        .execute()
                    ).data
                    or []
                    if r.get("parent_id")
                }
                abschnitt_von = {
                    wid: abschnitt_von_spalte[sid]
                    for wid, sid in spalten_von_bestand.items()
                    if abschnitt_von_spalte.get(sid)
                }

        # UMHÄNGEN: hat der Kunde einen bestehenden Baustein in eine andere
        # Spalte gezogen, kommt deren ID im Item mit. Bis 0479 wurde
        # `parent_id` an Bestandszeilen bewusst NICHT angefasst — mit dem Effekt,
        # dass sich nichts, was einmal gebaut war, je wieder umsortieren ließ:
        # ein Baustein blieb für immer in seiner Spalte.
        #
        # Geprüft wird das Ziel wie beim Anlegen (Wurzel 3): eigener Betrieb,
        # dieselbe Seite, und eine SPALTE — ein Widget direkt in einer Section
        # verbietet `site_blocks_tiefe_check` in der DB.
        umgehaengt = self._umhaengen_planen(tenant_id, page_id, geprueft)
        spalte_von_widget = {**spalten_von_bestand, **umgehaengt}

        # Die zwei Positionsebenen aus der gesendeten Reihenfolge. Sie stehen
        # in `ordnung.py`, weil sie reine Rechnerei sind — und weil man sich
        # genau dort verrechnet.
        rang_widget, rang_belegt = ordnung.ordnung_planen(
            [
                (str(i.id), spalte_von_widget.get(str(i.id)))
                for _, i, _, _ in geprueft
                if i.id is not None and i.id not in wiederbelebbar
            ],
            abschnitt_von_spalte,
        )
        # LEERE Abschnitte mit einordnen. `ordnung_planen` kennt nur die, in
        # denen ein Baustein liegt — die anderen behielten sonst ihre alten
        # Zahlen, und dann trügen zwei Zeilen dieselbe Position. Live gesehen
        # am 28.08.2026: ein Baustein wurde in eine andere Spalte gezogen, und
        # die leeren Abschnitte sprangen dabei an den Seitenanfang.
        alte_abschnitte = [
            str(r["id"])
            for r in (
                self._db.table("site_blocks")
                .select("id, position")
                .eq("page_id", page_id)
                .eq("tenant_id", tenant_id)
                .eq("kind", "section")
                .order("position")
                .execute()
            ).data
            or []
        ]
        rang_abschnitt = ordnung.abschnitte_einordnen(
            alte_abschnitte, rang_belegt
        )
        #: Welche Abschnitte ihre Position schon bekommen haben. Die LEEREN
        #: kommen weiter unten dran — sie hängen an keinem Baustein und würden
        #: in der Schleife darüber nie berührt.
        geschriebene_abschnitte: set[str] = set()

        for pos, item, content, settings in geprueft:
            if item.id is not None and item.id not in wiederbelebbar:
                aenderung: dict[str, Any] = {
                    "content": content,
                    "settings": settings,
                }
                # Der Rang IN DER SPALTE. Er war bis 0479 immer 0 — solange in
                # jeder Spalte genau ein Baustein stand, fiel das nicht auf.
                # Bei zweien entschied danach die Datenbank, welcher oben steht.
                if item.id in rang_widget:
                    aenderung["position"] = rang_widget[item.id]
                if item.id in umgehaengt:
                    aenderung["parent_id"] = umgehaengt[item.id]
                    aenderung["tiefe"] = self._tiefe_fuer_spalte(
                        tenant_id, umgehaengt[item.id]
                    )
                self._db.table("site_blocks").update(aenderung).eq(
                    "id", item.id
                ).eq("tenant_id", tenant_id).execute()
                # Die Reihenfolge der ABSCHNITTE. Fehlt die Kette (ein
                # Bestandsblock, den 0472 nicht erwischt hat), wird sie NICHT
                # ersatzweise ans Widget geschrieben: das sähe aus wie
                # sortiert und wäre es nicht (Wurzel 4).
                section_id = abschnitt_von.get(item.id)
                if section_id:
                    self._db.table("site_blocks").update(
                        {"position": rang_abschnitt.get(section_id, pos)}
                    ).eq("id", section_id).eq("tenant_id", tenant_id).execute()
                    geschriebene_abschnitte.add(section_id)
                else:
                    log.warning(
                        "site_blocks_ohne_huelle",
                        page_id=page_id,
                        block_id=item.id,
                    )
                continue
            # Neu hinzugekommener Baustein.
            #
            # Hat der Kunde ihn in eine BESTEHENDE Spalte gezogen, kommt deren
            # ID mit (`item.parent_id`) und die Zeile hängt sich dort ein.
            # Ohne dieses Feld war das unmöglich: jeder neue Baustein bekam
            # seine eigene Hülle, also seine eigene Reihe — das Spaltenlayout
            # ließ sich anlegen, aber nicht füllen.
            #
            # Sonst wie bisher: eine eigene Hülle (0472). Bestehende Bausteine
            # (oben, `item.id is not None`) behalten ihre — deren `parent_id`
            # wird bewusst NICHT angefasst, sonst risse jedes Speichern die vom
            # Kunden gebaute Verschachtelung ein.
            spalte_id, tiefe = self._ziel_spalte(
                tenant_id, page_id, item.parent_id, pos, settings
            )
            neue_zeile: dict[str, Any] = {
                "tenant_id": tenant_id,
                "page_id": page_id,
                "type": item.type.value,
                "kind": "widget",
                # Die Tiefe kommt vom ZIEL: 2 in einer Spalte, 3 in einer
                # inneren. Fest geschrieben wäre sie ein 23514 aus
                # `site_blocks_tiefe_check`, sobald jemand in eine innere
                # Spalte zieht (Wurzel 5: kein 500 aus Client-Input).
                "tiefe": tiefe,
                "parent_id": spalte_id,
                "position": 0,
                "content": content,
                "settings": settings,
            }
            # Wiederherstellung durch Rückgängig: die ID wird MITGESCHRIEBEN,
            # nicht neu vergeben. Sonst kämen aus der Antwort andere IDs
            # zurück als der Verlauf in seinen früheren Ständen hält, und der
            # nächste Klick auf ↺ wollte wieder eine ID wiederbeleben, die es
            # gerade erst als neue gab — bei jedem Schritt eine Zeile mehr.
            if item.id is not None:
                neue_zeile["id"] = item.id
            self._db.table("site_blocks").insert(neue_zeile).execute()

        # Der Gegenzustand zum Umhängen: die HÜLLE, die der Baustein verlassen
        # hat (Wurzel 1). Steht in ihrem Abschnitt danach kein Baustein mehr,
        # ist er ein Rest — gemeldet am 28.08.2026 als „hier sind 4 abschnitte
        # es stimmt gar nichts" (zwei Bausteine, vier Abschnitte).
        verlassene_spalten = {
            alt
            for wid, alt in spalten_von_bestand.items()
            if wid in umgehaengt and umgehaengt[wid] != alt
        }
        entsorgt = self._verlassene_huellen_aufraeumen(
            tenant_id, page_id, verlassene_spalten
        )
        if entsorgt:
            rang_abschnitt = ordnung.raenge_verdichten(rang_abschnitt, entsorgt)
            # ALLE Abschnitte kommen unten noch einmal dran: die in der
            # Schleife oben geschriebenen tragen den Rang aus der Liste VOR dem
            # Aufräumen. Sie stehen zu lassen hieße, zwei Nummerierungen zu
            # mischen (Wurzel 1).
            geschriebene_abschnitte.clear()

        # Die ABSCHNITTE, die kein Baustein berührt hat: leere Reihen, gerade
        # angelegte Layouts. Ohne diese Schleife behielten sie ihre alten
        # Positionen und kollidierten mit den neu vergebenen — live zu sehen
        # als „die leeren Abschnitte springen an den Seitenanfang" (Wurzel 1).
        #
        # Sie läuft NACH dem Aufräumen: die Ränge stehen erst dann fest.
        for abschnitt_id, rang in rang_abschnitt.items():
            if abschnitt_id in geschriebene_abschnitte:
                continue
            self._db.table("site_blocks").update({"position": rang}).eq(
                "id", abschnitt_id
            ).eq("tenant_id", tenant_id).execute()

        return self.list_blocks(ctx, page_id)

    def remove_block(self, ctx: AuthContext, block_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        block = self._own_block(tenant_id, block_id)
        self._sperre_pruefen(block)
        # Der Pflicht-Baustein (0474). Geprüft wird mit dem Stand NACH dem
        # Löschen: alle Typen der Seite außer diesem einen. Wäre der letzte
        # `checkout_form` darunter, bricht es hier ab — vor dem Löschen, nicht
        # danach mit einer Meldung über eine Zeile, die schon weg ist.
        seiten_id = block.get("page_id")
        if seiten_id:
            bleiben = [
                r["type"]
                for r in (
                    self._db.table("site_blocks")
                    .select("id, type")
                    .eq("tenant_id", tenant_id)
                    .eq("page_id", seiten_id)
                    .execute()
                ).data
                or []
                if r["id"] != block_id
            ]
            self._pflicht_baustein_pruefen(tenant_id, seiten_id, bleiben)
        self._db.table("site_blocks").delete().eq("id", block_id).eq(
            "tenant_id", tenant_id
        ).execute()

    # === Buchungsstrecke: eine Form für drei Seiten (0474) ====================

    def apply_strecke(
        self, ctx: AuthContext, strecke_key: str
    ) -> PageListResponse:
        """Eine Strecken-Vorlage auf Objektseite, Buchung und Bestätigung legen.

        ERSETZT, nicht ergänzt. Die bestehenden Bausteine der drei Seiten fallen
        weg, und das ist der einzige richtige Weg: die Vorlage bringt Galerie,
        Beschreibung und Buchungsfeld mit — untereinandergelegt stünde alles
        doppelt, ohne dass jemand sähe, warum (dieselbe Begründung, mit der die
        Objektseite ihre Vorlage nicht ergänzt, sondern ersetzt).

        Weil es ein Ersetzen ist, ist der Gegenzustand Teil der Operation
        (Wurzel 1): das Löschen der alten Bausteine und das Anlegen der neuen
        gehören zusammen. Bricht es nach dem Löschen ab, hätte die Seite
        gar nichts mehr — deshalb wird JE SEITE erst angelegt und dann das Alte
        entfernt, nicht umgekehrt.

        Der Pflicht-Baustein wird hier NICHT geprüft: jede Katalog-Strecke
        enthält ihn (``strecken_vorlagen.pruefen``), und die neue Fassung steht
        schon, bevor die alte fällt. Eine Prüfung gegen den Zwischenzustand
        würde eine Reihenfolge erzwingen, die es hier nicht braucht.
        """
        tenant_id = self._require_tenant(ctx)
        strecke = strecken_vorlagen.finde(strecke_key)
        if not strecke:
            raise SiteConfigError(
                "Unbekannte Vorlage für die Buchungsstrecke.", status_code=404
            )
        # Die drei Zielseiten sicherstellen, BEVOR nach ihnen gesucht wird.
        #
        # Sie entstehen sonst erst beim Lesen der Seitenliste (0466/0468) — und
        # das passiert hier zuletzt, im `return`. Ohne diese zwei Zeilen fand
        # der erste Aufruf eines frischen Betriebs nur die Seiten, die schon
        # jemand geöffnet hatte: die Vorlage wäre halb angewendet worden, mit
        # einer Erfolgsmeldung darüber. Aufgedeckt vom Test
        # `test_strecke_ersetzt_statt_zu_ergaenzen` (27 Bausteine beim zweiten
        # Anwenden statt 6, weil der zweite Lauf drei Seiten sah und der erste
        # eine).
        systemseiten.sicherstellen(self._db, tenant_id)
        dynamische_seiten.sicherstellen(self._db, tenant_id)

        zuordnung = (
            ("dynamic_source", "property", strecke.objekt),
            ("system_key", "checkout", strecke.checkout),
            ("system_key", "checkout_abgeschlossen", strecke.bestaetigung),
        )
        gesetzt: list[str] = []
        for spalte, wert, bausteine in zuordnung:
            zeilen = (
                self._db.table("site_pages")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq(spalte, wert)
                .limit(1)
                .execute()
            ).data
            # Fehlt die Seite, wird sie NICHT hier angelegt. Sie entsteht beim
            # Lesen der Seitenliste (`systemseiten.sicherstellen` bzw.
            # `dynamische_seiten.sicherstellen`) — ein zweiter Ort, der dasselbe
            # anlegt, wäre eine zweite Wahrheit über die Seitenstruktur.
            # Übersprungen und LAUT protokolliert: still zu überspringen hieße,
            # dem Kunden „Vorlage angewendet" zu melden, während eine der drei
            # Seiten unverändert blieb (Wurzel 5).
            if not zeilen:
                log.warning(
                    "strecke_seite_fehlt",
                    tenant_id=tenant_id,
                    spalte=spalte,
                    wert=wert,
                    strecke=strecke_key,
                )
                continue
            page_id = zeilen[0]["id"]
            alt = [
                r["id"]
                for r in (
                    self._db.table("site_blocks")
                    .select("id")
                    .eq("tenant_id", tenant_id)
                    .eq("page_id", page_id)
                    .execute()
                ).data
                or []
            ]
            # Erst das Neue, dann das Alte weg: bricht es dazwischen ab, steht
            # die Seite doppelt da — unschön, aber buchbar. Umgekehrt wäre sie
            # leer, und das ist der Zustand, den 0474 verhindert.
            for position, baustein in enumerate(bausteine):
                inhalt = self._validate_content(
                    BlockType(baustein["type"]), baustein.get("content") or {}
                )
                einstellungen = self._validate_settings(
                    baustein.get("settings") or {}
                )
                spalten_id = self._huelle_fuer_widget(
                    tenant_id, page_id, position, einstellungen
                )
                self._db.table("site_blocks").insert(
                    {
                        "tenant_id": tenant_id,
                        "page_id": page_id,
                        "type": baustein["type"],
                        "kind": "widget",
                        "tiefe": 2,
                        "parent_id": spalten_id,
                        "position": 0,
                        "content": inhalt,
                        "settings": einstellungen,
                    }
                ).execute()
            if alt:
                # `in_` statt einer Schleife: ein Abbruch mitten in einer
                # Schleife ließe die Seite halb ersetzt zurück.
                self._db.table("site_blocks").delete().in_("id", alt).eq(
                    "tenant_id", tenant_id
                ).execute()
            gesetzt.append(page_id)

        log.info(
            "strecke_angewendet",
            tenant_id=tenant_id,
            strecke=strecke_key,
            seiten=len(gesetzt),
        )
        return self.list_pages(ctx)

    def apply_template(
        self, ctx: AuthContext, template_id: str
    ) -> PageListResponse:
        tenant_id = self._require_tenant(ctx)
        tmpl = site_templates.TEMPLATES.get(template_id)
        if not tmpl:
            raise SiteConfigError("Unbekanntes Template.", status_code=404)
        existing_slugs = {
            r["slug"]
            for r in (
                self._db.table("site_pages")
                .select("slug")
                .eq("tenant_id", tenant_id)
                .execute()
            ).data
            or []
        }
        has_home = bool(
            (
                self._db.table("site_pages")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("is_home", True)
                .limit(1)
                .execute()
            ).data
        )
        # Die Vorlage bringt Beispieldaten mit („hallo@bergchalet.example",
        # „Alpenstraße 1"). Die stehen sonst auf der Kundenseite und müssten von
        # Hand überschrieben werden — obwohl die echten Angaben im Konto liegen.
        # Also einsetzen, wo vorhanden.
        firma = konto_daten.firmendaten(self._db, tenant_id)

        for page in tmpl["pages"]:
            if page["slug"] in existing_slugs:
                continue  # Slug schon vergeben → diese Template-Seite überspringen
            is_home = bool(page.get("is_home")) and not has_home
            if is_home:
                has_home = True
            nav_area = page.get("nav_area", NavArea.header.value)
            page_res = (
                self._db.table("site_pages")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "title": page["title"],
                        "slug": page["slug"],
                        "is_home": is_home,
                        "nav_area": nav_area,
                        "nav_order": self._next_nav_order(tenant_id, nav_area),
                    }
                )
                .execute()
            )
            page_id = page_res.data[0]["id"]
            for pos, block in enumerate(page.get("blocks", [])):
                btype = BlockType(block["type"])
                inhalt = dict(block.get("content", {}))
                if btype is BlockType.contact:
                    inhalt = konto_daten.kontakt_mit_firmendaten(inhalt, firma)
                einstellungen = self._validate_settings(block.get("settings"))
                # Auch die Vorlage legt Bausteine im Baum an (0472) — sonst
                # scheitert jede „Vorlage anwenden" an derselben Regel wie das
                # Speichern im Editor.
                spalte_id = self._huelle_fuer_widget(
                    tenant_id, page_id, pos, einstellungen
                )
                self._db.table("site_blocks").insert(
                    {
                        "tenant_id": tenant_id,
                        "page_id": page_id,
                        "type": btype.value,
                        "kind": "widget",
                        "tiefe": 2,
                        "parent_id": spalte_id,
                        "position": 0,
                        "content": self._validate_content(btype, inhalt),
                        "settings": einstellungen,
                    }
                ).execute()
        # Design-Tokens der Vorlage UND die echten Marken-Angaben des Betriebs.
        # Name und Logo stehen im Konto — ohne diesen Schritt bleibt die
        # Kopfzeile der Kundenseite leer, obwohl beides vorhanden ist.
        vorgaben = dict(tmpl.get("branding") or {})
        if firma.get("site_name"):
            vorgaben["site_name"] = firma["site_name"]
        if firma.get("logo_url"):
            vorgaben["logo_url"] = firma["logo_url"]
        self._apply_template_branding(ctx, vorgaben)
        return self.list_pages(ctx)

    def _apply_template_branding(
        self, ctx: AuthContext, branding: dict[str, object]
    ) -> None:
        """Design-Tokens der Vorlage NUR in noch leere Branding-Felder schreiben.

        Ohne das steht der Kunde nach einem Vorlagen-Klick vor fertigen Seiten in
        einem fremden Standard-Look. Mit blindem Überschreiben würde er dagegen
        seine bereits gesetzte Marke verlieren — beides falsch, deshalb füllt die
        Vorlage nur die Lücken (Wurzel 1: den bestehenden Zustand mitpflegen,
        nicht plattmachen)."""
        if not branding:
            return
        vorhanden = self.get_branding(ctx).model_dump(mode="json")
        patch = {
            feld: wert
            for feld, wert in branding.items()
            if vorhanden.get(feld) is None
        }
        if patch:
            self.set_branding(ctx, BrandingUpdate.model_validate(patch))
