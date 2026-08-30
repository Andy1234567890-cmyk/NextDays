"""Die Wissensdatenbank der KI — zwei Ebenen, Suche, Filter, Herkunft.

Aus `anhaenge.py` herausgelöst, weil der Bereich mit 0496 von vier Feldern auf
eine eigene Oberfläche gewachsen ist: Objektliste mit Faktenzahl, Faktenliste
je Objekt, Volltextsuche, Filter nach Kategorie und Quelle, Sortierung,
Mehrfachauswahl und die Herkunft jedes Fakts.

Die ZWEI EBENEN sind kein Selbstzweck. Ein Betrieb mit 44 Objekten und ein paar
hundert Fakten sieht in einer flachen Liste nicht, WELCHE Objekte gepflegt sind
— und genau das ist die Frage, die er hat. Die Spalte „Fakten" in der
Objektliste beantwortet sie auf einen Blick.

Wurzel 3 gilt hier besonders: In den Fakten stehen WLAN-Passwörter und
Türcodes. Jeder Zugriff per ID läuft über `_own_fact`/`_own_property`, nie über
einen ungescopten Load mit nachträglichem Vergleich.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .errors import InboxError
from .schemas import (
    KnowledgeFact,
    KnowledgeFactList,
    KnowledgeFactUpsert,
    WissenObjekt,
    WissenObjektListe,
)

log = get_logger("nextdays.inbox")

# Die sieben Kategorien — dieselbe Menge wie der CHECK in 0496. Hier als
# Konstante, damit ein 422 mit klarer Meldung kommt, bevor die DB einen
# 23514 wirft (dessen Text niemand versteht).
KATEGORIEN: tuple[str, ...] = (
    "objekt",
    "anreise",
    "buchung",
    "umgebung",
    "stoerung",
    "ausstattung",
    "sonstiges",
)

QUELLEN: tuple[str, ...] = ("manual", "document", "message")

# Wurzel 8: jede Liste bekommt eine harte Obergrenze. 100 je Seite ist mehr,
# als ein Mensch am Stück durchsieht; wer mehr braucht, filtert.
MAX_PRO_SEITE = 100
VORGABE_PRO_SEITE = 20

# Wonach sortiert werden darf. Eine Allowlist, kein durchgereichter String:
# `order()` nimmt den Spaltennamen roh, und ein freier Parameter wäre die
# Einladung, nach einer Spalte zu sortieren, die niemand sehen soll.
_SORTIERBAR_FAKTEN = {
    "titel": "titel",
    "kategorie": "kategorie",
    "quelle": "source",
    "geaendert": "updated_at",
}
_SORTIERBAR_OBJEKTE = {"objekt": "title", "ort": "city", "geaendert": "updated_at"}

_FACT_COLS = (
    "id, property_id, titel, fact, kategorie, source, source_ref, quelle_id, "
    "created_at, updated_at"
)


def _erstes_foto(photos: object) -> str | None:
    """Das erste Objektfoto für die Listenzeile.

    `properties.photos` ist ein `text[]`, kein JSON — und kann leer sein. Fehlt
    ein Foto, liefert die Funktion None und die Oberfläche zeigt ein
    Platzhalter-Icon; ein erfundenes Bild gäbe es hier nicht (Wurzel 4)."""
    if isinstance(photos, list):
        for p in photos:
            if isinstance(p, str) and p.strip():
                return p.strip()
    return None


class KiWissenMixin:
    """Die Wissensdatenbank. Teil von `InboxService`."""

    # Vom Service gestellt; hier nur deklariert, damit die Typprüfung die
    # Zugriffe kennt. KEINE Stub-Implementierung von `_require`: die stünde in
    # der MRO vor der echten und würde bei jedem Aufruf werfen.
    _db: Client | None

    # -- Hilfen ----------------------------------------------------------------
    @staticmethod
    def _fact_row(r: dict, titel: dict[str, str], quellen: dict[str, dict]) -> KnowledgeFact:
        pid = str(r["property_id"]) if r.get("property_id") else None
        qid = str(r["quelle_id"]) if r.get("quelle_id") else None
        quelle = quellen.get(qid or "", {})
        return KnowledgeFact(
            id=str(r["id"]),
            property_id=pid,
            property_title=titel.get(pid or ""),
            titel=r.get("titel"),
            fact=r.get("fact") or "",
            kategorie=r.get("kategorie") or "sonstiges",
            source=r.get("source") or "manual",
            source_ref=r.get("source_ref"),
            quelle_id=qid,
            quelle_datei=quelle.get("datei_name"),
            created_at=r.get("created_at"),
            updated_at=r.get("updated_at"),
        )

    def _property_titel(self, db: Client, tenant_id: str) -> dict[str, str]:
        rows = (
            db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]): r.get("title") or "" for r in rows}

    def _quellen_map(self, db: Client, tenant_id: str, ids: set[str]) -> dict[str, dict]:
        """Dateinamen der Herkunft nachladen — nur für die Zeilen der Seite.

        Ein Join wäre schöner, aber PostgREST würde ihn über die gesperrte
        Tabelle führen; ein zweiter Aufruf mit einer kleinen `in`-Liste ist
        hier ehrlicher und bleibt unter dem Zeilendeckel."""
        if not ids:
            return {}
        rows = (
            db.table("ki_wissen_quelle")
            .select("id, art, datei_name, created_at")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(ids))
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _own_property(self, db: Client, tenant_id: str, property_id: str) -> None:
        """Objekt-Zugehörigkeit erzwingen (Wurzel 3): ohne diese Prüfung ließe
        sich ein Fakt an ein fremdes Objekt hängen — der Service-Role-Key umgeht
        RLS."""
        rows = (
            db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise InboxError("Objekt nicht gefunden.", status_code=404)

    @staticmethod
    def _pruefe_felder(req: KnowledgeFactUpsert) -> tuple[str, str, str | None]:
        """Titel, Text und Kategorie prüfen — vor der DB, mit klarer Meldung."""
        text = (req.fact or "").strip()
        if not text:
            raise InboxError("Der Fakt darf nicht leer sein.", status_code=422)
        if len(text) > 2000:
            raise InboxError(
                "Der Fakt ist zu lang (max. 2000 Zeichen).", status_code=422
            )
        kategorie = (req.kategorie or "sonstiges").strip()
        if kategorie not in KATEGORIEN:
            raise InboxError(
                f"Unbekannte Kategorie: {kategorie}", status_code=422
            )
        titel = (req.titel or "").strip() or None
        if titel and len(titel) > 200:
            raise InboxError(
                "Der Titel ist zu lang (max. 200 Zeichen).", status_code=422
            )
        return text, kategorie, titel

    # -- Ebene 1: Objektliste ---------------------------------------------------
    def wissen_objekte(
        self,
        ctx: AuthContext,
        *,
        suche: str | None = None,
        sortierung: str = "objekt",
        absteigend: bool = False,
        seite: int = 1,
        pro_seite: int = VORGABE_PRO_SEITE,
    ) -> WissenObjektListe:
        """Die Objekte mit ihrer Faktenzahl — Ebene 1 der Wissensdatenbank.

        Die Zeile „Betriebsweit" steht immer vorn und zählt die Fakten ohne
        Objektbezug. In der Vorlage gibt es sie nicht, weil dort jeder Fakt an
        einem Listing hängt; bei uns wären betriebsweite Fakten sonst
        unerreichbar."""
        db, tenant_id = self._require(ctx)
        pro_seite = max(1, min(pro_seite, MAX_PRO_SEITE))
        seite = max(1, seite)

        spalte = _SORTIERBAR_OBJEKTE.get(sortierung, "title")

        q = (
            db.table("properties")
            .select("id, title, city, photos", count="exact")
            .eq("tenant_id", tenant_id)
        )
        if suche and suche.strip():
            begriff = suche.strip().replace(",", " ")
            q = q.or_(f"title.ilike.%{begriff}%,city.ilike.%{begriff}%")

        von = (seite - 1) * pro_seite
        res = (
            q.order(spalte, desc=absteigend)
            .range(von, von + pro_seite - 1)
            .execute()
        )
        rows = res.data or []
        gesamt = res.count if res.count is not None else len(rows)

        zahlen, letzte = self._faktenzahlen(db, tenant_id)

        items = [
            WissenObjekt(
                property_id=str(r["id"]),
                titel=r.get("title") or "",
                ort=r.get("city"),
                foto_url=_erstes_foto(r.get("photos")),
                fakten=zahlen.get(str(r["id"]), 0),
                geaendert_at=letzte.get(str(r["id"])),
            )
            for r in rows
        ]
        return WissenObjektListe(
            items=items,
            total=gesamt,
            seite=seite,
            pro_seite=pro_seite,
            betriebsweit_fakten=zahlen.get("", 0),
            betriebsweit_geaendert_at=letzte.get(""),
        )

    def _faktenzahlen(
        self, db: Client, tenant_id: str
    ) -> tuple[dict[str, int], dict[str, str]]:
        """Fakten je Objekt zählen. Schlüssel "" = betriebsweit.

        Eine Zählung im Client statt `count` je Objekt: 44 Objekte wären 44
        Abfragen. Die Fakten eines Betriebs sind eine kleine Menge — der
        Deckel liegt darum hoch, aber er liegt (Wurzel 8)."""
        rows = (
            db.table("inbox_knowledge_fact")
            .select("property_id, updated_at")
            .eq("tenant_id", tenant_id)
            .limit(10000)
            .execute()
        ).data or []
        zahlen: dict[str, int] = {}
        letzte: dict[str, str] = {}
        for r in rows:
            key = str(r["property_id"]) if r.get("property_id") else ""
            zahlen[key] = zahlen.get(key, 0) + 1
            wann = r.get("updated_at")
            if wann and (key not in letzte or wann > letzte[key]):
                letzte[key] = wann
        return zahlen, letzte

    # -- Ebene 2: Fakten eines Objekts -----------------------------------------
    def list_knowledge(
        self,
        ctx: AuthContext,
        *,
        property_id: str | None = None,
        nur_dieses_objekt: bool = False,
        betriebsweit: bool = False,
        suche: str | None = None,
        kategorien: list[str] | None = None,
        quellen: list[str] | None = None,
        sortierung: str = "geaendert",
        absteigend: bool = True,
        seite: int = 1,
        pro_seite: int = VORGABE_PRO_SEITE,
    ) -> KnowledgeFactList:
        """Fakten — gefiltert, sortiert, seitenweise.

        `property_id` ohne `nur_dieses_objekt` liefert Objekt-Fakten UND die
        betriebsweiten: beim Beantworten gelten beide zusammen, und der
        KI-Pfad ruft genau so auf. Die Oberfläche setzt `nur_dieses_objekt`,
        weil sie die betriebsweiten in einer eigenen Zeile führt."""
        db, tenant_id = self._require(ctx)
        pro_seite = max(1, min(pro_seite, MAX_PRO_SEITE))
        seite = max(1, seite)

        q = (
            db.table("inbox_knowledge_fact")
            .select(_FACT_COLS, count="exact")
            .eq("tenant_id", tenant_id)
        )
        if betriebsweit:
            q = q.is_("property_id", "null")
        elif property_id and nur_dieses_objekt:
            q = q.eq("property_id", property_id)
        elif property_id:
            q = q.or_(f"property_id.eq.{property_id},property_id.is.null")

        if suche and suche.strip():
            begriff = suche.strip().replace(",", " ")
            q = q.or_(f"titel.ilike.%{begriff}%,fact.ilike.%{begriff}%")

        gewaehlt = [k for k in (kategorien or []) if k in KATEGORIEN]
        if gewaehlt:
            q = q.in_("kategorie", gewaehlt)

        gewaehlte_quellen = [s for s in (quellen or []) if s in QUELLEN]
        if gewaehlte_quellen:
            q = q.in_("source", gewaehlte_quellen)

        spalte = _SORTIERBAR_FAKTEN.get(sortierung, "updated_at")
        von = (seite - 1) * pro_seite
        res = (
            q.order(spalte, desc=absteigend)
            .range(von, von + pro_seite - 1)
            .execute()
        )
        rows = res.data or []
        gesamt = res.count if res.count is not None else len(rows)

        titel = self._property_titel(db, tenant_id)
        quellen_map = self._quellen_map(
            db, tenant_id, {str(r["quelle_id"]) for r in rows if r.get("quelle_id")}
        )
        items = [self._fact_row(r, titel, quellen_map) for r in rows]
        return KnowledgeFactList(
            items=items, total=gesamt, seite=seite, pro_seite=pro_seite
        )

    # -- Anlegen, ändern, löschen ----------------------------------------------
    def create_knowledge(
        self,
        ctx: AuthContext,
        req: KnowledgeFactUpsert,
        *,
        source: str = "manual",
        source_ref: str | None = None,
        quelle_id: str | None = None,
    ) -> KnowledgeFact:
        db, tenant_id = self._require(ctx)
        text, kategorie, titel = self._pruefe_felder(req)
        if req.property_id:
            self._own_property(db, tenant_id, req.property_id)
        ins = (
            db.table("inbox_knowledge_fact")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": req.property_id,
                    "titel": titel,
                    "fact": text,
                    "kategorie": kategorie,
                    "source": source,
                    "source_ref": source_ref,
                    "quelle_id": quelle_id,
                    "created_by": ctx.user_id if ctx.user_id != "cron" else None,
                }
            )
            .execute()
        ).data
        quellen = self._quellen_map(db, tenant_id, {quelle_id} if quelle_id else set())
        return self._fact_row(ins[0], self._property_titel(db, tenant_id), quellen)

    def update_knowledge(
        self, ctx: AuthContext, fact_id: str, req: KnowledgeFactUpsert
    ) -> KnowledgeFact:
        db, tenant_id = self._require(ctx)
        text, kategorie, titel = self._pruefe_felder(req)
        if req.property_id:
            self._own_property(db, tenant_id, req.property_id)
        upd = (
            db.table("inbox_knowledge_fact")
            .update(
                {
                    "titel": titel,
                    "fact": text,
                    "kategorie": kategorie,
                    "property_id": req.property_id,
                }
            )
            .eq("tenant_id", tenant_id)
            .eq("id", fact_id)
            .execute()
        ).data
        if not upd:
            raise InboxError("Fakt nicht gefunden.", status_code=404)
        quellen = self._quellen_map(
            db, tenant_id, {str(upd[0]["quelle_id"])} if upd[0].get("quelle_id") else set()
        )
        return self._fact_row(upd[0], self._property_titel(db, tenant_id), quellen)

    def delete_knowledge(self, ctx: AuthContext, fact_id: str) -> None:
        db, tenant_id = self._require(ctx)
        db.table("inbox_knowledge_fact").delete().eq("tenant_id", tenant_id).eq(
            "id", fact_id
        ).execute()

    def delete_knowledge_bulk(self, ctx: AuthContext, fact_ids: list[str]) -> int:
        """Sammellöschen aus der Mehrfachauswahl.

        Der Tenant-Filter steht MIT im selben Aufruf, nicht als nachträgliche
        Prüfung (Wurzel 3): eine untergeschobene fremde ID trifft dann keine
        Zeile, statt eine fremde zu löschen."""
        if not fact_ids:
            return 0
        # Wurzel 8: auch die Mehrfachauswahl bekommt einen Deckel.
        if len(fact_ids) > MAX_PRO_SEITE:
            raise InboxError(
                f"Höchstens {MAX_PRO_SEITE} Fakten auf einmal.", status_code=422
            )
        db, tenant_id = self._require(ctx)
        res = (
            db.table("inbox_knowledge_fact")
            .delete()
            .eq("tenant_id", tenant_id)
            .in_("id", fact_ids)
            .execute()
        )
        return len(res.data or [])
