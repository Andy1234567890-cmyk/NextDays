"""Automatisierungen des Posteingangs: anlegen, ändern, löschen, auflisten.

Aus `service.py` herausgelöst (16.08.2026), weil die Datei mit den
Nachrichten-Kennzahlen über die pylint-Grenze von 1500 Zeilen lief — dieselbe
Bewegung, aus der schon `spiegel.py` und `kennzahlen.py` entstanden sind.

Bewusst NICHT in `planung.py`: dort liegt, WANN eine Automation feuert und wie
die geplante Nachricht entsteht. Hier liegt die Verwaltung der Regel selbst.
Die beiden hängen an genau einer Stelle zusammen — jede Änderung ruft
`replan_tenant`, weil die bereits eingeplanten Nachrichten der Gegenzustand
der Regel sind (Wurzel 1).
"""
from __future__ import annotations

from supabase import Client

from src.core.security import AuthContext

from .ausloeser import ALLE_TRIGGER, DATUMS_TRIGGER
from .automation_mapping import (
    AUTOMATION_COLS,
    automation_payload,
    automation_row,
)
from .errors import InboxError
from .objekt_zuweisung import aktive_objekt_ids, zuweisung_normieren
from .schemas import Automation, AutomationList, AutomationUpsert
from .sprachen import automation_texte, automation_texte_schreiben


class AutomationenMixin:
    """CRUD der Nachrichten-Automatisierungen."""

    # -- Automatisierungen -----------------------------------------------------
    # Spaltenliste und Abbildung liegen in `automation_mapping` (Datei-Länge).
    _AUTOMATION_COLS = AUTOMATION_COLS
    _automation_row = staticmethod(automation_row)
    _automation_payload = staticmethod(automation_payload)

    _TRIGGER = ALLE_TRIGGER

    def _automation_pruefen(self, req: AutomationUpsert) -> None:
        """Eingabe abweisen, bevor die DB-Constraints als 500 durchschlagen."""
        if req.trigger not in self._TRIGGER:
            raise InboxError(
                f"Unbekannter Auslöser: {req.trigger}", status_code=422
            )
        if bool(req.window_from) != bool(req.window_to):
            raise InboxError(
                "Das Zeitfenster braucht Anfang UND Ende.", status_code=422
            )
        if any(t < 0 or t > 6 for t in req.window_days):
            raise InboxError(
                "Wochentage müssen zwischen 0 (Mo) und 6 (So) liegen.",
                status_code=422,
            )
        if req.only_first_message and req.trigger in DATUMS_TRIGGER:
            # „Nur bei der ersten Gastnachricht" zählt eingegangene NACHRICHTEN
            # (`zaehle_gastnachrichten_je_buchung`). Für eine Datums-Regel gibt
            # es keine Nachricht, an der gezählt werden könnte — die Einstellung
            # wurde gespeichert, in der Oberfläche angezeigt und von der Planung
            # nie gelesen. Eine Attrappe, die dem Betrieb eine Einschränkung
            # zusagt, die es nicht gibt: 422 statt still ignorieren (Wurzel 5).
            raise InboxError(
                "„Nur bei der ersten Gastnachricht“ gilt ausschließlich für den "
                "Auslöser „Nachricht empfangen“ — eine Datums-Regel hängt an "
                "keiner Nachricht.",
                status_code=422,
            )
        if not (req.message or "").strip() and not req.template_id:
            raise InboxError(
                "Die Automatisierung braucht einen Text oder eine Vorlage.",
                status_code=422,
            )
        self._felder_pruefen(req.message)
        self._felder_pruefen(req.subject)
        for t in req.texts or []:
            lang = (t.lang or "").strip().lower()
            if len(lang) != 2 or not lang.isalpha():
                raise InboxError(f"Ungültiger Sprachcode: {t.lang}", status_code=422)
            self._felder_pruefen(t.message)
            self._felder_pruefen(t.subject)

    def _payload_normiert(self, db: Client, tenant_id: str, req: AutomationUpsert) -> dict:
        """Upsert-Payload mit normierter Objektliste: deckt sie alle aktiven
        Objekte ab, wird NULL (= alle) gespeichert — sonst fiele jedes später
        angelegte Objekt aus der Regel (objekt_zuweisung, 14.09.2026)."""
        payload = self._automation_payload(req)
        payload["property_ids"] = zuweisung_normieren(
            payload.get("property_ids"), aktive_objekt_ids(db, tenant_id)
        )
        return payload

    def list_automations(self, ctx: AuthContext) -> AutomationList:
        db, tenant_id = self._require(ctx)
        res = (
            db.table("message_automation")
            .select(self._AUTOMATION_COLS)
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        )
        rows = res.data or []
        texte = automation_texte(db, tenant_id, [str(r["id"]) for r in rows])
        items = [self._automation_row(r, texte.get(str(r["id"]))) for r in rows]
        return AutomationList(items=items, total=len(items))

    def create_automation(
        self, ctx: AuthContext, req: AutomationUpsert
    ) -> Automation:
        db, tenant_id = self._require(ctx)
        if not req.name.strip():
            raise InboxError("Name ist nötig.", status_code=422)
        self._automation_pruefen(req)
        ins = (
            db.table("message_automation")
            .insert({"tenant_id": tenant_id, **self._payload_normiert(db, tenant_id, req)})
            .execute()
        ).data
        row = ins[0]
        # VOR der Neuplanung: die Planung materialisiert den Text je Buchung und
        # wählt dabei die Fassung nach Gastsprache. Erst danach zu schreiben
        # hieße, die erste Planung nimmt die Grundfassung, obwohl Fassungen
        # mitgeschickt wurden.
        texte = automation_texte_schreiben(db, tenant_id, str(row["id"]), req.texts)
        # Sofort für die BESTEHENDEN Buchungen einplanen. Ohne diesen Schritt
        # wirkte eine neue Regel erst bei der nächsten Buchung — live standen
        # deshalb zwei frisch angelegte Regeln mit null geplanten Nachrichten da,
        # obwohl 30 künftige Aufenthalte in der Liste lagen.
        self.replan_tenant(tenant_id)
        return self._automation_row(row, texte)

    def update_automation(
        self, ctx: AuthContext, automation_id: str, req: AutomationUpsert
    ) -> Automation:
        db, tenant_id = self._require(ctx)
        self._automation_pruefen(req)
        upd = (
            db.table("message_automation")
            .update(self._payload_normiert(db, tenant_id, req))
            .eq("tenant_id", tenant_id)
            .eq("id", automation_id)
            .execute()
        ).data
        if not upd:
            raise InboxError("Automatisierung nicht gefunden.", status_code=404)
        # Erst nach dem 404-Riegel (Wurzel 3) und VOR der Neuplanung: die
        # Neuplanung schreibt den gewählten Text in die geplanten Nachrichten.
        texte = automation_texte_schreiben(db, tenant_id, automation_id, req.texts)
        # Wurzel 1: die bereits eingeplanten Nachrichten sind der Gegenzustand
        # dieser Änderung. Ohne Neuplanung blieben sie auf dem alten Zeitpunkt
        # stehen — live stand „Anreisetag, 06:00" als −3 Tage/09:00 eingeplant,
        # weil die Regel nach dem Import geändert wurde.
        self.replan_tenant(tenant_id)
        return self._automation_row(upd[0], texte)

    def delete_automation(self, ctx: AuthContext, automation_id: str) -> None:
        db, tenant_id = self._require(ctx)
        db.table("message_automation").delete().eq("tenant_id", tenant_id).eq(
            "id", automation_id
        ).execute()
