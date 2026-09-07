"""Struktur ändern: Container verschieben und duplizieren (0479).

Eigenes Modul und kein weiterer Abschnitt in ``bloecke.py``: die Datei stand bei
1518 Zeilen und damit über der Grenze, die ``pylint`` hier setzt (1500). Der
Schnitt ist aber auch der richtige — ``bloecke.py`` beantwortet „welche
Bausteine hat diese Seite und was steht darin", hier steht die Frage „wie ist
die Seite AUFGEBAUT": Rang eines Abschnitts, Kopie einer ganzen Reihe.

**Warum es diese zwei Wege überhaupt gibt.** Bis 0479 war ein Container eine
Sache, die man ANLEGEN konnte und danach nicht mehr anfassen: `reorder_blocks`
verlangt die vollständige Baustein-Liste einer Seite und kennt Container nicht,
`add_block` vergibt eine Position nur beim Anlegen, und „duplizieren" gab es
ausschließlich für einzelne Bausteine. Ein zweispaltiger Abschnitt ließ sich
also weder verschieben noch verdoppeln — in jedem üblichen Page Builder sind
das die zwei häufigsten Handgriffe beim Bauen einer Seite.

Das Mixin setzt voraus, dass die Basisklasse ``_db``, ``_require_tenant``,
``_own_block``, ``_load_block``, ``_block_row`` und ``_TIEFE`` mitbringt —
dasselbe Muster wie der Split von ``mediathek.py``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from src.core.logging import get_logger

from .fehler import SiteConfigError
from .schemas import BlockResponse

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import AuthContext

log = get_logger("nextdays.site_config.container")

#: Spalten einer Block-Zeile. Aufgezählt und nicht `*`: eine neue Spalte soll
#: eine bewusste Entscheidung sein, keine automatische Mitlieferung.
_BLOCK_COLS = (
    "id, page_id, type, position, content, settings, kind, parent_id, span"
)

#: Harte Obergrenze für ZEILEN je Seite — Container mitgezählt (Wurzel 8).
#:
#: Der Editor deckelt die BAUSTEINE bei 60. Mit ihren Hüllen (Abschnitt +
#: Spalte je Baustein) sind das bis zu 180 Zeilen, mehrspaltige Abschnitte
#: kommen dazu. 400 lässt reichlich Luft und verhindert trotzdem, dass ein
#: Kopiervorgang eine Seite ins Unbegrenzte wachsen lässt: `duplicate_container`
#: ist der erste Weg, der mit EINEM Aufruf beliebig viele Zeilen anlegen kann.
MAX_ZEILEN_JE_SEITE = 400




class ContainerMixin:
    """Abschnitte und Spalten verschieben und duplizieren."""

    def move_container(
        self, ctx: AuthContext, block_id: str, position: int
    ) -> BlockResponse:
        """Einen Container an einen anderen Rang unter seinen Geschwistern.

        Das ist „Abschnitt hoch/runter" und „Spalte nach links" — bis hierher
        gab es dafür KEINEN Weg: `reorder_blocks` verlangt die vollständige
        Baustein-Liste einer Seite und kennt Container gar nicht, und
        `add_block` konnte eine Position nur beim Anlegen vergeben. Ein
        Abschnitt, den man angelegt hat, blieb also für immer dort, wo er lag.

        Gepflegt wird die Ordnung der GESCHWISTER mit (Wurzel 1): der Container
        wird herausgenommen, an der Zielstelle eingesetzt, und alle bekommen
        ihren neuen Rang lückenlos von 0 an. Nur die betroffene Ebene — ein
        Abschnitt bewegt sich unter Abschnitten, eine Spalte unter Spalten
        desselben Abschnitts.

        Bausteine gehen hier NICHT durch: ihre Reihenfolge steht am Abschnitt
        (siehe `replace_blocks`), und zwei Wege auf dieselbe Ordnung wären der
        Fehler, den Wurzel 2 beschreibt.
        """
        tenant_id = self._require_tenant(ctx)
        block = self._own_block(tenant_id, block_id)
        self._sperre_pruefen(block)
        art = block.get("kind") or "widget"
        if art == "widget":
            raise SiteConfigError(
                "Bausteine werden über die Abschnittsliste geordnet.",
                status_code=422,
            )
        eltern_id = block.get("parent_id")
        abfrage = self._db.table("site_blocks").select("id, position")
        abfrage = (
            abfrage.eq("page_id", block["page_id"]).is_("parent_id", "null")
            if eltern_id is None
            else abfrage.eq("parent_id", eltern_id)
        )
        geschwister = [
            g["id"] for g in (abfrage.order("position").execute()).data or []
        ]
        if block_id not in geschwister:
            # Kann nur passieren, wenn zwischen Load und Abfrage etwas gelöscht
            # wurde. Dann ist die Reihenfolge nicht mehr die, auf die sich der
            # Aufrufer bezog — abbrechen statt raten.
            raise SiteConfigError("Der Block ist nicht mehr da.", status_code=409)
        geschwister.remove(block_id)
        ziel = max(0, min(position, len(geschwister)))
        geschwister.insert(ziel, block_id)
        for rang, gid in enumerate(geschwister):
            self._db.table("site_blocks").update({"position": rang}).eq(
                "id", gid
            ).eq("tenant_id", tenant_id).execute()
        log.info(
            "site_block_moved", tenant_id=tenant_id, block_id=block_id, rang=ziel
        )
        return self._load_block(tenant_id, block_id)

    def duplicate_container(
        self, ctx: AuthContext, block_id: str
    ) -> BlockResponse:
        """Einen Container mit ALLEM darin kopieren, direkt dahinter.

        „Abschnitt duplizieren" war im Editor nur für Bausteine da — ein
        zweispaltiger Abschnitt ließ sich nicht verdoppeln, obwohl genau das
        der häufigste Handgriff beim Bauen einer Seite ist (dieselbe Reihe
        nochmal, dann Inhalt austauschen).

        Kopiert wird der TEILBAUM: Abschnitt, seine Spalten, deren Bausteine,
        rekursiv. Reihenfolge und Breiten bleiben; die Kopie steht direkt nach
        dem Original, und die Geschwister dahinter wandern mit.

        Der Deckel (`MAX_ZEILEN_JE_SEITE`) wird VOR dem ersten Insert geprüft: eine halb
        kopierte Reihe wäre schlimmer als eine abgelehnte (Wurzel 5).
        """
        tenant_id = self._require_tenant(ctx)
        block = self._own_block(tenant_id, block_id)
        self._sperre_pruefen(block)
        if (block.get("kind") or "widget") == "widget":
            raise SiteConfigError(
                "Diesen Baustein duplizierst du in der Abschnittsliste.",
                status_code=422,
            )
        page_id = str(block["page_id"])
        alle = (
            self._db.table("site_blocks")
            .select(_BLOCK_COLS)
            .eq("page_id", page_id)
            .eq("tenant_id", tenant_id)
            .order("position")
            .execute()
        ).data or []
        kinder_von: dict[str | None, list[dict]] = {}
        for zeile in alle:
            kinder_von.setdefault(zeile.get("parent_id"), []).append(zeile)

        def zaehle(zeile: dict) -> int:
            return 1 + sum(
                zaehle(k) for k in kinder_von.get(zeile["id"], [])
            )

        if len(alle) + zaehle(block) > MAX_ZEILEN_JE_SEITE:
            raise SiteConfigError(
                f"Mehr als {MAX_ZEILEN_JE_SEITE} Blöcke je Seite sind nicht "
                "möglich.",
                status_code=422,
            )

        # Platz machen: alles hinter dem Original rutscht eine Stelle weiter.
        eltern_id = block.get("parent_id")
        eigene_position = int(block.get("position") or 0)
        for g in kinder_von.get(eltern_id, []):
            if int(g.get("position") or 0) > eigene_position:
                self._db.table("site_blocks").update(
                    {"position": int(g["position"]) + 1}
                ).eq("id", g["id"]).eq("tenant_id", tenant_id).execute()

        def kopiere(zeile: dict, neuer_eltern: str | None, position: int) -> str:
            payload = {
                "tenant_id": tenant_id,
                "page_id": page_id,
                "type": zeile["type"],
                "kind": zeile.get("kind") or "widget",
                "tiefe": self._TIEFE.get(zeile.get("kind") or "widget", 3),
                "parent_id": neuer_eltern,
                "position": position,
                "content": zeile.get("content") or {},
                "settings": zeile.get("settings") or {},
            }
            if zeile.get("span") is not None:
                payload["span"] = zeile["span"]
            res = self._db.table("site_blocks").insert(payload).execute()
            if not res.data:
                raise SiteConfigError(
                    "Der Abschnitt konnte nicht kopiert werden.",
                    status_code=500,
                )
            neue_id = str(res.data[0]["id"])
            for rang, kind in enumerate(kinder_von.get(zeile["id"], [])):
                kopiere(kind, neue_id, rang)
            return neue_id

        kopie_id = kopiere(block, eltern_id, eigene_position + 1)
        log.info(
            "site_block_duplicated",
            tenant_id=tenant_id,
            block_id=block_id,
            kopie=kopie_id,
        )
        return self._load_block(tenant_id, kopie_id)

    def _umhaengen_planen(
        self,
        tenant_id: str,
        page_id: str,
        geprueft: list,
    ) -> dict[str, str]:
        """Welche BESTEHENDEN Bausteine in eine andere Spalte sollen (0479).

        Rückgabe: ``widget_id -> neue Spalten-ID``, nur für die, bei denen das
        Item eine Spalte nennt. Ob sie sich vom heutigen Elternteil
        unterscheidet, ist hier gleich — ein Update auf denselben Wert kostet
        nichts, und ein Vergleich bräuchte eine zusätzliche Abfrage.

        Geprüft wird JEDE genannte Spalte (Wurzel 3): eigener Betrieb, dieselbe
        Seite, und wirklich eine Spalte. Ein Widget direkt in einer Section
        verbietet `site_blocks_tiefe_check` — das hier ist der 422 davor, statt
        eines 500 aus Client-Input (Wurzel 5).
        """
        ziele = {
            str(i.parent_id)
            for _, i, _, _ in geprueft
            if i.id is not None and i.parent_id
        }
        if not ziele:
            return {}
        erlaubt: dict[str, str] = {}
        for row in (
            self._db.table("site_blocks")
            .select("id, kind, page_id")
            .in_("id", sorted(ziele))
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []:
            if row.get("page_id") != page_id:
                raise SiteConfigError(
                    "Die Spalte gehört zu einer anderen Seite.", status_code=422
                )
            if (row.get("kind") or "widget") not in ("column", "inner_column"):
                raise SiteConfigError(
                    "Ein Baustein steht in einer Spalte.", status_code=422
                )
            erlaubt[str(row["id"])] = str(row["kind"])
        fehlend = ziele - set(erlaubt)
        if fehlend:
            raise SiteConfigError(
                "Die Spalte gehört nicht zu diesem Konto.", status_code=404
            )
        return {
            str(i.id): str(i.parent_id)
            for _, i, _, _ in geprueft
            if i.id is not None and i.parent_id
        }

    def _tiefe_fuer_spalte(self, tenant_id: str, spalte_id: str) -> int:
        """Tiefe eines Widgets in dieser Spalte: 2 in einer Spalte, 3 in einer
        inneren. Fest geschrieben wäre sie ein 23514 aus
        `site_blocks_tiefe_check`, sobald jemand in eine innere Spalte zieht."""
        row = self._own_block(tenant_id, spalte_id)
        return 3 if (row.get("kind") == "inner_column") else 2

    def _verlassene_huellen_aufraeumen(
        self,
        tenant_id: str,
        page_id: str,
        verlassene_spalten: set[str],
    ) -> set[str]:
        """Abschnitte löschen, aus denen der LETZTE Baustein weggezogen wurde.

        Der Gegenzustand zum Umhängen (Wurzel 1). Wer einen Baustein in eine
        andere Spalte zieht, gibt seine alte Hülle frei — bis 28.08.2026 blieb
        sie stehen, und zwar als vollwertiger Abschnitt: im Ebenen-Baum eine
        Zeile „Abschnitt" ohne Inhalt, im Canvas ein leeres Feld. Live gemeldet
        als „hier sind 4 abschnitte es stimmt gar nichts" — die Seite trug zwei
        Bausteine und vier Abschnitte, zwei davon Reste zweier Umzüge.

        Es fällt NUR der ganz leere Abschnitt, samt seiner Spalten. Eine
        einzelne leere Spalte in einem mehrspaltigen Abschnitt BLEIBT: sie ist
        das Layout, das der Kunde gebaut hat, und in das er als Nächstes etwas
        legen will. Sie wegzuräumen wäre dieselbe Bevormundung wie ein
        Formular, das leere Felder löscht.

        Rückgabe: die IDs, die wirklich weg sind — der Aufrufer muss seine
        Rangliste um sie bereinigen, sonst vergibt er Positionen an Zeilen, die
        es nicht mehr gibt.
        """
        if not verlassene_spalten:
            return set()
        zeilen = (
            self._db.table("site_blocks")
            .select("id, parent_id, kind")
            .eq("page_id", page_id)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        kinder: dict[str, list[dict]] = {}
        nach_id: dict[str, dict] = {}
        for r in zeilen:
            nach_id[str(r["id"])] = r
            eltern = r.get("parent_id")
            if eltern:
                kinder.setdefault(str(eltern), []).append(r)

        def hat_baustein(knoten_id: str) -> bool:
            """Steht unter diesem Knoten (irgendwo) noch ein Baustein?"""
            for k in kinder.get(knoten_id, []):
                if (k.get("kind") or "widget") == "widget":
                    return True
                if hat_baustein(str(k["id"])):
                    return True
            return False

        weg: set[str] = set()
        for spalte_id in verlassene_spalten:
            zeile = nach_id.get(spalte_id)
            if zeile is None:
                continue
            abschnitt_id = zeile.get("parent_id")
            # Die Spalte hängt nicht in einem Abschnitt (innere Spalte, oder
            # eine Bestandszeile ohne saubere Kette) — dann ist hier nichts zu
            # entscheiden. Lieber stehen lassen als raten (Wurzel 4).
            if not abschnitt_id or abschnitt_id not in nach_id:
                continue
            if hat_baustein(str(abschnitt_id)):
                continue
            weg.add(str(abschnitt_id))
        if not weg:
            return set()
        # Die Nachkommen AUSDRÜCKLICH mitnehmen und nicht `on delete cascade`
        # überlassen: die Regel steht zwar an `parent_id` (0472), aber sie ist
        # eine Eigenschaft der Datenbank — im Test läuft eine Fake-DB ohne sie,
        # und dort bliebe die Spalte als Waise stehen. Eine Aufräumung, die nur
        # in der Produktion vollständig ist, ist keine.
        def nachkommen(knoten_id: str) -> list[str]:
            gesammelt: list[str] = []
            for k in kinder.get(knoten_id, []):
                gesammelt.append(str(k["id"]))
                gesammelt.extend(nachkommen(str(k["id"])))
            return gesammelt

        for abschnitt_id in sorted(weg):
            weg.update(nachkommen(abschnitt_id))
        # LAUT protokollieren: ein Löschen lässt sich nachträglich nicht mehr
        # untersuchen, die Zeilen sind dann weg (Wurzel 5).
        log.info(
            "site_blocks_leere_huelle_entfernt",
            page_id=page_id,
            zeilen=sorted(weg),
            anlass="umhaengen",
        )
        self._db.table("site_blocks").delete().in_("id", sorted(weg)).eq(
            "tenant_id", tenant_id
        ).execute()
        return weg

    def _wirklich_entfallen(
        self,
        page_id: str,
        vorhanden: dict,
        gesendet: set[str],
        bekannte_ids: list[str] | None,
    ) -> list[str]:
        """Welche Bausteine der Client WIRKLICH weggenommen hat.

        Ohne `bekannte_ids` ist der Vollersatz eine Waffe: alles, was nicht in
        der Liste steht, gilt als gelöscht — auch ein Baustein, den in der
        Zwischenzeit ein zweiter Editor, ein anderer Reiter oder die Mobil-App
        angelegt hat. Der Client kann ihn gar nicht mitschicken, er weiß nichts
        von ihm. Live nachgewiesen am 28.08.2026: bei geöffnetem Editor
        angelegte Abschnitte verschwanden beim nächsten Speichern wieder.

        `None` heißt „der Aufrufer führt keine Liste" (Vorlagen, Skripte) — dann
        bleibt es beim bisherigen Vollersatz.
        """
        bekannt = set(bekannte_ids) if bekannte_ids is not None else None
        entfallen = [
            bid
            for bid in vorhanden
            if bid not in gesendet and (bekannt is None or bid in bekannt)
        ]
        if bekannt is not None:
            fremde = [
                bid
                for bid in vorhanden
                if bid not in gesendet and bid not in bekannt
            ]
            if fremde:
                # LAUT: sonst wundert sich später jemand, warum die Seite mehr
                # Bausteine hat als der Editor geschickt hat (Wurzel 5).
                log.info(
                    "site_blocks_fremde_bausteine_behalten",
                    page_id=page_id,
                    bausteine=sorted(fremde),
                    anzahl=len(fremde),
                )
        return entfallen
