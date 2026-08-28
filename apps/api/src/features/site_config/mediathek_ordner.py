"""Ordner der Mediathek: anlegen, umbenennen, verschieben, löschen (0460).

Eigenes Modul und nicht ein weiterer Abschnitt in ``mediathek.py``: Ordner haben
eine Eigenschaft, die Bilder nicht haben — sie zeigen auf sich selbst. Daraus
folgt alles, was hier steht und was mit dem Hochladen eines Bildes nichts zu tun
hat: eine Tiefengrenze, ein Zyklus-Schutz beim Verschieben und ein benannter
Gegenzustand beim Löschen.

Die drei Regeln, und warum jede im DIENST steht und nicht im Schema:

* **Tiefe höchstens drei Ebenen.** Das ist eine Produktentscheidung (Hostaway
  erlaubt bei Seiten genau drei), keine Integritätsregel. Ein rekursiver
  Check-Constraint bräuchte eine SECURITY-DEFINER-Funktion bei JEDEM Insert.
* **Kein Zyklus.** „Ordner A unter seinen eigenen Unterordner B schieben" macht
  einen Ast, der sich selbst enthält: er verschwindet aus dem Baum, seine Bilder
  sind unerreichbar, und keine Abfrage findet ihn je wieder. Postgres hat dafür
  keinen eingebauten Schutz.
* **Löschen nimmt die Bilder NICHT mit.** Das steht im Schema
  (``on delete set null``) — hier steht die Zahl davor: der Aufrufer erfährt
  VOR dem Löschen, wie viele Bilder in die Wurzel rutschen und wie viele
  Unterordner mitgehen (Wurzel 1).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from src.core.logging import get_logger

from .fehler import SiteConfigError
from .schemas_mediathek import (
    MediaFolderCreate,
    MediaFolderListResponse,
    MediaFolderResponse,
    MediaFolderUpdate,
    MediaFolderVorschau,
)

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from src.core.security import AuthContext

log = get_logger("nextdays.site_config.mediathek_ordner")

_ORDNER_COLS = "id, parent_id, name, created_at"

#: Höchste Schachtelungstiefe. 1 = Wurzelordner. Drei Ebenen wie Hostaways
#: Seitenbaum — tiefer wird ein Ordnerbaum in einer Seitenspalte unlesbar, und
#: eine Grenze ist Pflicht: ohne sie ist die Tiefe unbegrenzt (Wurzel 8).
MAX_ORDNER_TIEFE = 3

#: Höchstzahl Ordner je Betrieb. Derselbe Gedanke wie ``MEDIA_MAX_COUNT``.
MAX_ORDNER = 200


class MediathekOrdnerMixin:
    """Ordnerbaum des Betriebs."""

    # === Lesen ==============================================================

    def list_media_folders(
        self, ctx: AuthContext, *, art: str | None = None
    ) -> MediaFolderListResponse:
        """Alle Ordner des Betriebs, flach und mit Zählern.

        ``art`` zählt NUR eine Medienart (0479). Das ist keine Bequemlichkeit,
        sondern die Bedingung dafür, dass die Zahl stimmt: die Oberfläche zeigt
        immer EINEN Reiter (Bilder, Symbole, Videos, Audio, Dateien), und ein
        Ordner mit „2" neben dem Namen, in dem im offenen Reiter nichts liegt,
        ist eine Falschaussage (Wurzel 4). Ohne ``art`` zählt sie alles — für
        Aufrufer, die keinen Reiter haben.

        Flach und nicht als Baum: die Oberfläche baut den Baum ohnehin selbst,
        weil sie auf- und zuklappbare Knoten führt. Eine geschachtelte Antwort
        wäre dieselbe Information in einer Form, die man vor dem Anzeigen wieder
        flach machen muss.

        Die Zähler kommen aus EINER Abfrage über alle Bilder des Betriebs und
        nicht aus einer Abfrage je Ordner: bei 40 Ordnern wären das 40
        Rundreisen für eine Zahl."""
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("site_media_folders")
            .select(_ORDNER_COLS)
            .eq("tenant_id", tenant_id)
            .order("name")
            .execute()
        ).data or []
        belegung = self._ordner_belegung(tenant_id, art)
        items = [
            MediaFolderResponse(
                id=str(r["id"]),
                parent_id=str(r["parent_id"]) if r.get("parent_id") else None,
                name=r["name"],
                media_count=belegung.get(str(r["id"]), 0),
                created_at=str(r["created_at"]) if r.get("created_at") else None,
            )
            for r in rows
        ]
        return MediaFolderListResponse(
            items=items,
            total=len(items),
            # Wie viele Bilder in KEINEM Ordner liegen. Ohne diese Zahl müsste
            # die Oberfläche sie aus Gesamtzahl minus Summe rechnen — und läge
            # falsch, sobald ein Bild zwischen zwei Abfragen verschoben wird.
            root_media_count=belegung.get("", 0),
        )

    def _ordner_belegung(
        self, tenant_id: str, art: str | None = None
    ) -> dict[str, int]:
        """``ordner_id -> Anzahl Medien``; der leere Schlüssel ist die Wurzel.

        Mit ``art`` nur diese Medienart — siehe ``list_media_folders``."""
        q = (
            self._db.table("site_media")
            .select("folder_id")
            .eq("tenant_id", tenant_id)
        )
        if art:
            q = q.eq("kind", art)
        rows = (q.limit(self.MEDIA_MAX_COUNT).execute()).data or []
        zaehler: dict[str, int] = {}
        for r in rows:
            schluessel = str(r.get("folder_id") or "")
            zaehler[schluessel] = zaehler.get(schluessel, 0) + 1
        return zaehler

    # === Schreiben ==========================================================

    def create_media_folder(
        self, ctx: AuthContext, daten: MediaFolderCreate
    ) -> MediaFolderResponse:
        """Ordner anlegen. Leer — genau das ist der Sinn der eigenen Tabelle."""
        tenant_id = self._require_tenant(ctx)
        eltern = self._eigener_ordner(tenant_id, daten.parent_id)
        if eltern is not None and self._tiefe(tenant_id, str(eltern["id"])) >= (
            MAX_ORDNER_TIEFE
        ):
            raise SiteConfigError(
                f"Mehr als {MAX_ORDNER_TIEFE} Ordnerebenen sind nicht möglich.",
                status_code=422,
            )
        self._ordner_platz_pruefen(tenant_id)
        name = daten.name.strip()
        self._name_frei(tenant_id, daten.parent_id, name, ausser=None)
        res = (
            self._db.table("site_media_folders")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "parent_id": daten.parent_id,
                    "name": name,
                }
            )
            .execute()
        )
        if not res.data:
            raise SiteConfigError("Ordner konnte nicht angelegt werden.", status_code=500)
        log.info("site_media_folder_created", tenant_id=tenant_id)
        row = res.data[0]
        return MediaFolderResponse(
            id=str(row["id"]),
            parent_id=str(row["parent_id"]) if row.get("parent_id") else None,
            name=row["name"],
            media_count=0,
            created_at=str(row.get("created_at")) if row.get("created_at") else None,
        )

    def update_media_folder(
        self, ctx: AuthContext, folder_id: str, daten: MediaFolderUpdate
    ) -> MediaFolderResponse:
        """Umbenennen und/oder verschieben.

        Beides in EINEM Aufruf, weil beides dasselbe UPDATE ist — und weil zwei
        getrennte Aufrufe einen Zwischenzustand hätten, in dem der Ordner schon
        verschoben, aber noch alt benannt ist und damit mit einem Nachbarn
        kollidiert."""
        tenant_id = self._require_tenant(ctx)
        row = self._eigener_ordner_pflicht(tenant_id, folder_id)
        felder = daten.model_dump(exclude_unset=True)
        neuer_name = (felder.get("name") or row["name"]).strip()
        neues_eltern = (
            felder["parent_id"] if "parent_id" in felder else row.get("parent_id")
        )
        neues_eltern = str(neues_eltern) if neues_eltern else None

        if "parent_id" in felder and neues_eltern != (
            str(row["parent_id"]) if row.get("parent_id") else None
        ):
            self._verschieben_pruefen(tenant_id, folder_id, neues_eltern)
        self._name_frei(tenant_id, neues_eltern, neuer_name, ausser=folder_id)

        aenderung: dict[str, object] = {"name": neuer_name}
        if "parent_id" in felder:
            aenderung["parent_id"] = neues_eltern
        self._db.table("site_media_folders").update(aenderung).eq(
            "id", folder_id
        ).eq("tenant_id", tenant_id).execute()
        log.info("site_media_folder_updated", tenant_id=tenant_id, folder_id=folder_id)
        # OHNE Art: die Zahl an der zurückgegebenen Zeile meint den ganzen
        # Ordnerinhalt. Ein Filter wäre hier falsch — der Aufrufer hat gerade
        # umbenannt, nicht einen Reiter geöffnet.
        belegung = self._ordner_belegung(tenant_id)
        return MediaFolderResponse(
            id=folder_id,
            parent_id=neues_eltern,
            name=neuer_name,
            media_count=belegung.get(folder_id, 0),
            created_at=str(row.get("created_at")) if row.get("created_at") else None,
        )

    def preview_media_folder_delete(
        self, ctx: AuthContext, folder_id: str
    ) -> MediaFolderVorschau:
        """Was ein Löschen anrichten würde — VOR dem Löschen (Wurzel 1).

        Ein Ordner mit 80 Fotos sieht in der Oberfläche genauso aus wie ein
        leerer. Ohne diese Vorschau ist „Ordner löschen" eine Aktion, deren
        Folgen der Kunde erst danach sieht."""
        tenant_id = self._require_tenant(ctx)
        self._eigener_ordner_pflicht(tenant_id, folder_id)
        ast = self._ast(tenant_id, folder_id)
        # OHNE Art, und das ist der Kern der Vorschau: beim Löschen rutschen
        # ALLE Medien des Ordners in die Wurzel, nicht nur die des offenen
        # Reiters. Eine gefilterte Zahl hier würde die Folgen kleinreden
        # (Wurzel 1).
        belegung = self._ordner_belegung(tenant_id)
        return MediaFolderVorschau(
            folder_id=folder_id,
            subfolder_count=len(ast) - 1,
            media_count=sum(belegung.get(f, 0) for f in ast),
        )

    def delete_media_folder(self, ctx: AuthContext, folder_id: str) -> None:
        """Ordner löschen. Die Bilder BLEIBEN und rutschen in die Wurzel.

        Der Schemateil davon ist ``on delete set null``; hier steht, warum das
        die richtige Wahl ist: ein Bild kann in Blöcken einer veröffentlichten
        Seite stehen. Es mit dem Ordner zu löschen hieße, eine lebende Website
        zu ändern, weil jemand seine Ablage umsortiert."""
        tenant_id = self._require_tenant(ctx)
        self._eigener_ordner_pflicht(tenant_id, folder_id)
        # Unterordner gehen per `on delete cascade` mit; deren Bilder ebenfalls
        # per `set null` in die Wurzel. Ein eigener Rekursions-Lauf hier wäre
        # eine zweite Wahrheit neben dem Fremdschlüssel.
        self._db.table("site_media_folders").delete().eq("id", folder_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info("site_media_folder_deleted", tenant_id=tenant_id, folder_id=folder_id)

    # === Hilfen =============================================================

    def _alle_ordner(self, tenant_id: str) -> list[dict]:
        return (
            self._db.table("site_media_folders")
            .select("id, parent_id, name")
            .eq("tenant_id", tenant_id)
            .limit(MAX_ORDNER)
            .execute()
        ).data or []

    def _eigener_ordner(self, tenant_id: str, folder_id: str | None) -> dict | None:
        """Ordner laden UND scopen in einem Schritt. ``None`` bei ``None``.

        Nicht laden und danach vergleichen (Wurzel 3): der Vergleich ist die
        Stelle, die man vergisst."""
        if not folder_id:
            return None
        return self._eigener_ordner_pflicht(tenant_id, folder_id)

    def _eigener_ordner_pflicht(self, tenant_id: str, folder_id: str) -> dict:
        rows = (
            self._db.table("site_media_folders")
            .select("id, parent_id, name, created_at")
            .eq("id", folder_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise SiteConfigError(
                "Ordner gehört nicht zu diesem Konto.", status_code=404
            )
        return rows[0]

    def _ordner_platz_pruefen(self, tenant_id: str) -> None:
        vorhanden = (
            self._db.table("site_media_folders")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if (vorhanden.count or 0) >= MAX_ORDNER:
            raise SiteConfigError(
                f"Mehr als {MAX_ORDNER} Ordner sind nicht möglich.", status_code=409
            )

    def _name_frei(
        self,
        tenant_id: str,
        parent_id: str | None,
        name: str,
        *,
        ausser: str | None,
    ) -> None:
        """Kein zweiter Ordner gleichen Namens auf derselben Ebene.

        Der Unique-Index in der DB ist der Backstop; diese Prüfung ist die
        VERSTÄNDLICHE Fehlermeldung. Ohne sie bekäme der Kunde einen 23505 als
        500 — technisch geschützt, praktisch unbrauchbar."""
        vergleich = name.strip().casefold()
        for r in self._alle_ordner(tenant_id):
            gleiche_ebene = (str(r["parent_id"]) if r.get("parent_id") else None) == (
                parent_id
            )
            if (
                gleiche_ebene
                and str(r["id"]) != ausser
                and str(r["name"]).strip().casefold() == vergleich
            ):
                raise SiteConfigError(
                    f"Es gibt hier schon einen Ordner „{name}“.", status_code=409
                )

    def _tiefe(self, tenant_id: str, folder_id: str) -> int:
        """Ebene eines Ordners: 1 = Wurzel. Läuft am ELTERN-Pfad nach oben.

        Die Schleife ist gedeckelt, obwohl es keine Zyklen geben soll — genau
        das ist der Grund: wäre je einer entstanden, würde eine ungedeckelte
        Schleife den Prozess aufhängen statt den Fehler zu zeigen (Wurzel 5)."""
        nach_eltern = {
            str(r["id"]): (str(r["parent_id"]) if r.get("parent_id") else None)
            for r in self._alle_ordner(tenant_id)
        }
        tiefe = 1
        aktuell = nach_eltern.get(folder_id)
        while aktuell and tiefe <= MAX_ORDNER_TIEFE + 1:
            tiefe += 1
            aktuell = nach_eltern.get(aktuell)
        return tiefe

    def _ast(self, tenant_id: str, wurzel: str) -> set[str]:
        """Der Ordner selbst und alles darunter."""
        kinder: dict[str, list[str]] = {}
        for r in self._alle_ordner(tenant_id):
            eltern = str(r["parent_id"]) if r.get("parent_id") else ""
            kinder.setdefault(eltern, []).append(str(r["id"]))
        gefunden = {wurzel}
        offen = [wurzel]
        while offen:
            aktuell = offen.pop()
            for kind in kinder.get(aktuell, []):
                if kind not in gefunden:
                    gefunden.add(kind)
                    offen.append(kind)
        return gefunden

    def _verschieben_pruefen(
        self, tenant_id: str, folder_id: str, neues_eltern: str | None
    ) -> None:
        """Zyklus- und Tiefenschutz beim Verschieben.

        Ein Ordner unter sich selbst ist kein Fehler, den man später sieht — der
        Ast verschwindet aus dem Baum, weil kein Weg von der Wurzel mehr dorthin
        führt, und die Bilder darin sind für immer unerreichbar."""
        if neues_eltern is None:
            return
        if neues_eltern == folder_id:
            raise SiteConfigError(
                "Ein Ordner kann nicht in sich selbst liegen.", status_code=422
            )
        if neues_eltern in self._ast(tenant_id, folder_id):
            raise SiteConfigError(
                "Ein Ordner kann nicht in einen seiner eigenen Unterordner "
                "verschoben werden.",
                status_code=422,
            )
        self._eigener_ordner_pflicht(tenant_id, neues_eltern)
        # Die Tiefe des VERSCHOBENEN Astes zählt mit: ein zweistufiger Ast unter
        # einen Ordner auf Ebene 2 zu hängen ergäbe Ebene 4.
        eigene_hoehe = self._asthoehe(tenant_id, folder_id)
        if self._tiefe(tenant_id, neues_eltern) + eigene_hoehe > MAX_ORDNER_TIEFE:
            raise SiteConfigError(
                f"Mehr als {MAX_ORDNER_TIEFE} Ordnerebenen sind nicht möglich.",
                status_code=422,
            )

    def _asthoehe(self, tenant_id: str, wurzel: str) -> int:
        """Wie viele Ebenen der Ast unter ``wurzel`` selbst hoch ist (mind. 1)."""
        kinder: dict[str, list[str]] = {}
        for r in self._alle_ordner(tenant_id):
            eltern = str(r["parent_id"]) if r.get("parent_id") else ""
            kinder.setdefault(eltern, []).append(str(r["id"]))

        def hoehe(knoten: str, rest: int) -> int:
            if rest <= 0:
                return 1
            unter = kinder.get(knoten, [])
            return 1 + max((hoehe(k, rest - 1) for k in unter), default=0)

        return hoehe(wurzel, MAX_ORDNER_TIEFE)
