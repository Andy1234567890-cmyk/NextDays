"""Auto-Bewertungs-Vorlagen — anlegen, ändern, kopieren, löschen.

Was eine Vorlage ist: der Text, mit dem der Betrieb seine Gäste automatisch
bewertet, samt Note, Vorlauf und Objektzuordnung. Bis 0503 gab es davon EINE
je Betrieb; jetzt beliebig viele, je Objekt.

Der Grund für die MEHRZAHL DER TEXTE ist der wichtigste Teil dieses Moduls
und keine Geschmacksfrage. Hostaway schreibt es in seiner eigenen Doku:

    „Airbnb may penalize this practice, and it may affect the SEO."

Wer 500-mal denselben Satz an dasselbe Portal schickt, sieht aus wie ein Bot.
Deshalb hält eine Vorlage mehrere Texte und der Versand zieht zufällig einen
(``ReviewQueue._text_waehlen``).

Warum trotzdem kein harter Zwang zu drei Texten wie bei Hostaway: ein Betrieb
mit fünf Buchungen im Jahr braucht keine drei Varianten, und ein Formular, das
ohne erkennbaren Grund blockiert, wird umgangen statt befolgt. Die Oberfläche
warnt, sie verbietet nicht.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger

from .common import plaintext
from .schemas import AutoTemplate, AutoTemplateRequest

if TYPE_CHECKING:
    from .service import ReviewError

log = get_logger("nextdays.reviews.vorlagen")

_SPALTEN = (
    "id, tenant_id, name, aktiv, nach_tagen, note, min_gastnote, texte, "
    "privater_text, created_at"
)

# Der Fehlercode, mit dem der Trigger aus 0503 eine zweite aktive Vorlage
# auf demselben Objekt abweist.
_SCHON_AKTIV = "23505"
_CHECK_VERLETZT = "23514"


class VorlagenStore:
    """CRUD auf ``review_auto_template`` samt Objektzuordnung."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------- lesen
    def liste(self, tenant_id: str) -> list[AutoTemplate]:
        zeilen = (
            self._db.table("review_auto_template")
            .select(_SPALTEN + ", review_auto_template_property(property_id)")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return [self._zu_modell(z) for z in zeilen]

    def eine(self, tenant_id: str, vorlagen_id: str) -> AutoTemplate:
        return self._zu_modell(self._roh(tenant_id, vorlagen_id))

    def _roh(self, tenant_id: str, vorlagen_id: str) -> dict:
        """Eine Zeile, IMMER tenant-gescopt geladen (Wurzel 3): Laden und
        Scope nicht trennen, sonst vergisst man den Scope."""
        from .service import ReviewError

        zeilen = (
            self._db.table("review_auto_template")
            .select(_SPALTEN + ", review_auto_template_property(property_id)")
            .eq("id", vorlagen_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise ReviewError("Vorlage nicht gefunden.", status_code=404)
        return zeilen[0]

    # ---------------------------------------------------------- schreiben
    def anlegen(
        self, tenant_id: str, req: AutoTemplateRequest, *, eigene: list[str] | None
    ) -> AutoTemplate:
        nutzlast = self._nutzlast(req)
        nutzlast["tenant_id"] = tenant_id
        objekte = self._objekte_pruefen(tenant_id, req.property_ids, eigene)
        try:
            neu = (
                self._db.table("review_auto_template").insert(nutzlast).execute()
            ).data or []
        except APIError as exc:
            raise self._uebersetzt(exc) from exc
        if not neu:
            from .service import ReviewError

            raise ReviewError("Anlegen fehlgeschlagen.", status_code=500)
        vorlagen_id = str(neu[0]["id"])
        # Gegenzustand (Wurzel 1): scheitert die ZUORDNUNG, muss die eben
        # angelegte Vorlage wieder weg. Sonst bleibt eine Leiche ohne Objekt
        # in der Liste stehen — live gesehen, bevor dieses try hier stand:
        # der Trigger wies das Objekt ab, die Vorlage blieb, und der Betrieb
        # hätte sie von Hand suchen und löschen müssen.
        #
        # PostgREST kennt keine Transaktion über zwei Tabellen, also wird von
        # Hand zurückgeräumt.
        try:
            self._zuordnen(vorlagen_id, objekte)
        except APIError as exc:
            self._db.table("review_auto_template").delete().eq(
                "id", vorlagen_id
            ).execute()
            log.info(
                "review_vorlage_zurueckgenommen",
                tenant_id=tenant_id,
                vorlage=vorlagen_id,
                grund=exc.code,
            )
            raise self._uebersetzt(exc) from exc
        log.info(
            "review_vorlage_angelegt",
            tenant_id=tenant_id,
            vorlage=vorlagen_id,
            objekte=len(objekte),
            texte=len(nutzlast["texte"]),
        )
        return self.eine(tenant_id, vorlagen_id)

    def aendern(
        self,
        tenant_id: str,
        vorlagen_id: str,
        req: AutoTemplateRequest,
        *,
        eigene: list[str] | None,
    ) -> AutoTemplate:
        vorher = self._roh(tenant_id, vorlagen_id)  # Scope + Existenz
        objekte = self._objekte_pruefen(tenant_id, req.property_ids, eigene)
        alte_objekte = [
            str(o["property_id"])
            for o in (vorher.get("review_auto_template_property") or [])
            if o.get("property_id")
        ]
        try:
            self._db.table("review_auto_template").update(
                self._nutzlast(req)
            ).eq("id", vorlagen_id).eq("tenant_id", tenant_id).execute()
            # Gegenzustand (Wurzel 1): die ALTE Zuordnung muss weg, sonst
            # bedient die Vorlage weiter ein Objekt, das der Betrieb gerade
            # abgewählt hat — und der Gast bekäme eine Bewertung, die niemand
            # mehr wollte.
            self._db.table("review_auto_template_property").delete().eq(
                "template_id", vorlagen_id
            ).execute()
            self._zuordnen(vorlagen_id, objekte)
        except APIError as exc:
            # Und der Gegenzustand DAZU: scheitert die neue Zuordnung (etwa
            # weil ein Objekt schon eine aktive Vorlage hat), ist die alte
            # bereits gelöscht — die Vorlage stünde ohne Objekt da und
            # bediente ab sofort niemanden mehr. Ohne Transaktion (PostgREST
            # kennt keine) wird sie von Hand wiederhergestellt.
            self._zuordnung_wiederherstellen(vorlagen_id, alte_objekte)
            raise self._uebersetzt(exc) from exc
        return self.eine(tenant_id, vorlagen_id)

    def _zuordnung_wiederherstellen(
        self, vorlagen_id: str, objekte: list[str]
    ) -> None:
        """Alte Objektzuordnung zurückholen, nachdem die neue scheiterte.

        Best effort mit LAUTEM Log: gelingt auch das nicht, steht eine Vorlage
        ohne Objekt da. Das ist sichtbar (die Liste zeigt „keine Objekte") und
        behebbar — anders als ein stiller Verlust, den erst der ausbleibende
        Versand Wochen später verrät (Wurzel 5).
        """
        if not objekte:
            return
        try:
            self._zuordnen(vorlagen_id, objekte)
        except APIError as exc:
            log.error(
                "review_vorlage_zuordnung_verloren",
                vorlage=vorlagen_id,
                objekte=len(objekte),
                grund=exc.code,
                fehler=(exc.message or "")[:200],
            )

    def kopieren(self, tenant_id: str, vorlagen_id: str) -> AutoTemplate:
        """Duplizieren — Hostaways „Copy".

        Die Kopie entsteht INAKTIV und OHNE Objekte. Beides mit Grund: ein
        Objekt darf nur eine aktive Vorlage haben (Trigger aus 0503), eine
        aktive Kopie liefe also sofort in den Fehler. Und eine Kopie, die
        stillschweigend dieselben Objekte bedient, würde die Vorlage, die man
        kopiert hat, verdrängen — man kopiert sie ja, um sie für ANDERE
        Objekte anzupassen.
        """
        quelle = self._roh(tenant_id, vorlagen_id)
        nutzlast = {
            "tenant_id": tenant_id,
            "name": f"{quelle['name']} (Kopie)"[:120],
            "aktiv": False,
            "nach_tagen": quelle["nach_tagen"],
            "note": quelle["note"],
            "min_gastnote": quelle.get("min_gastnote"),
            "texte": quelle.get("texte") or [],
            "privater_text": quelle.get("privater_text"),
        }
        try:
            neu = (
                self._db.table("review_auto_template").insert(nutzlast).execute()
            ).data or []
        except APIError as exc:
            raise self._uebersetzt(exc) from exc
        if not neu:
            from .service import ReviewError

            raise ReviewError("Kopieren fehlgeschlagen.", status_code=500)
        return self.eine(tenant_id, str(neu[0]["id"]))

    def loeschen(self, tenant_id: str, vorlagen_id: str) -> None:
        """Vorlage entfernen.

        Die Zuordnungen gehen per ``on delete cascade`` mit. Bereits GEPLANTE
        Bewertungen bleiben stehen: sie tragen ihren Text schon in der eigenen
        Zeile (``guest_review_queue``), und was der Betrieb in seiner
        Warteschlange gesehen hat, soll nicht rückwirkend verschwinden. Wer
        sie loswerden will, überspringt sie dort — sichtbar, mit Grund.
        """
        self._roh(tenant_id, vorlagen_id)
        self._db.table("review_auto_template").delete().eq(
            "id", vorlagen_id
        ).eq("tenant_id", tenant_id).execute()
        log.info(
            "review_vorlage_geloescht", tenant_id=tenant_id, vorlage=vorlagen_id
        )

    # ----------------------------------------------------------- Hilfen
    @staticmethod
    def _nutzlast(req: AutoTemplateRequest) -> dict[str, Any]:
        """Die Spalten aus dem Antrag. Texte werden gesäubert (Wurzel 8) und
        leere verworfen — ein leerer Text erzeugte beim Versand eine leere
        öffentliche Bewertung."""
        texte = [t for t in (plaintext(x) for x in req.texte) if t]
        return {
            "name": req.name.strip(),
            "aktiv": req.aktiv,
            "nach_tagen": req.nach_tagen,
            "note": req.note,
            "min_gastnote": req.min_gastnote,
            "texte": texte,
            "privater_text": plaintext(req.privater_text),
        }

    def _objekte_pruefen(
        self, tenant_id: str, ids: list[str], eigene: list[str] | None
    ) -> list[str]:
        """Nur Objekte DIESES Betriebs, und nur die, die der Aufrufer sehen
        darf (Wurzel 3/9).

        Ein Eigentümer, der eine Vorlage für ein fremdes Objekt anlegt, würde
        sonst dessen Gäste bewerten.
        """
        from .service import ReviewError

        eindeutig = sorted(set(ids))
        if not eindeutig:
            return []
        vorhanden = {
            str(z["id"])
            for z in (
                self._db.table("properties")
                .select("id")
                .eq("tenant_id", tenant_id)
                .in_("id", eindeutig)
                .execute()
            ).data
            or []
        }
        if eigene is not None:
            vorhanden &= set(eigene)
        fehlend = [i for i in eindeutig if i not in vorhanden]
        if fehlend:
            raise ReviewError(
                f"{len(fehlend)} Objekt(e) nicht gefunden.", status_code=404
            )
        return eindeutig

    def _zuordnen(self, vorlagen_id: str, objekte: list[str]) -> None:
        if not objekte:
            return
        self._db.table("review_auto_template_property").insert(
            [{"template_id": vorlagen_id, "property_id": o} for o in objekte]
        ).execute()

    @staticmethod
    def _uebersetzt(exc: APIError) -> ReviewError:
        """Datenbankfehler in eine Aussage übersetzen, die der Betrieb versteht.

        Der Trigger aus 0503 wirft `unique_violation`, wenn ein Objekt schon
        eine aktive Vorlage hat. Ungefiltert käme beim Nutzer ein 500 an —
        für eine Bedingung, die er selbst auflösen kann (Wurzel 5).
        """
        from .service import ReviewError

        if exc.code == _SCHON_AKTIV:
            return ReviewError(
                "Für mindestens eines dieser Objekte ist bereits eine "
                "Auto-Bewertung aktiv. Schalte sie zuerst ab.",
                status_code=409,
            )
        if exc.code == _CHECK_VERLETZT:
            # Der CHECK aus 0503: eine AKTIVE Vorlage braucht mindestens einen
            # Text. Der Karten-Schalter schickt genau diesen Fall.
            return ReviewError(
                "Eine aktive Vorlage braucht mindestens einen Bewertungstext.",
                status_code=422,
            )
        # Kein roher Postgres-Text im Kundentext (Wurzel 5: präzise oder
        # generisch, nie die Innereien) — der Grund steht im Log.
        log.warning(
            "review_vorlage_db_fehler", code=exc.code, error=(exc.message or "")[:200]
        )
        return ReviewError("Speichern fehlgeschlagen.", status_code=400)

    @staticmethod
    def _zu_modell(zeile: dict) -> AutoTemplate:
        texte = zeile.get("texte")
        objekte = zeile.get("review_auto_template_property") or []
        return AutoTemplate(
            id=str(zeile["id"]),
            name=zeile["name"],
            aktiv=bool(zeile["aktiv"]),
            nach_tagen=int(zeile["nach_tagen"]),
            note=int(zeile["note"]),
            min_gastnote=zeile.get("min_gastnote"),
            texte=[str(t) for t in texte] if isinstance(texte, list) else [],
            privater_text=zeile.get("privater_text"),
            property_ids=sorted(
                str(o["property_id"]) for o in objekte if o.get("property_id")
            ),
            created_at=zeile.get("created_at"),
        )
