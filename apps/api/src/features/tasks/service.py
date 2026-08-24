"""Service-Schicht für tasks (Lastenheft §2.5 + §4.3).

Aufgaben-CRUD, auto-Generierung bei Buchung (Anreise-Check + Endreinigung),
Checklisten mit Foto-Nachweisen, Vertretungs-Feature, Inventar (auch
unterkunftslos). Supabase-Client injiziert → mockbar.

Auslagen und Abschluss-Rückmeldung (0360) liegen in `kosten_rueckmeldung.py` —
eigene Tabellen, eigene Sichtbarkeitsregeln, keine Berührung mit dem
Aufgaben-Lebenszyklus. Der Dienst delegiert dorthin.
"""
# pylint: disable=too-many-lines
#
# Wie payments/channel_manager: der Aufgaben-Lebenszyklus (anlegen, planen,
# zuweisen, abhaken, abschliessen, inspizieren) plus die Regel-/Vorlagen-
# Verwaltung sind EIN Zusammenhang. Ihn allein der Zeilenzahl wegen auf zwei
# Dateien zu verteilen, die sich gegenseitig aufrufen, macht ihn nicht
# lesbarer — es verteilt ihn nur. Was ein eigenes Thema IST, ist bereits
# ausgelagert (engine, schedule_label, kosten_rueckmeldung).
import secrets
from datetime import UTC, date, datetime
from uuid import UUID

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.owner_scope import is_owner, owner_property_ids
from src.features.auth.permissions import Capability, has_capability
from src.features.auth.schemas import UserRole
from src.features.auth.staff_scope import (
    STAFF_ROLES as _STAFF_ROLLEN,
)
from src.features.auth.staff_scope import (
    is_staff,
    staff_property_ids,
)
from src.features.media.service import sign_task_photo
from src.features.notification_settings.ereignisse import (
    melde_aufgaben_entzug,
    melde_aufgaben_zuweisung,
    melde_dienstleistung_erledigt,
    melde_vertretung_entschieden,
    melde_vertretung_gesucht,
)

from .engine import (
    materialize_recurring,
    nachziehen_planmaessig,
    sync_for_reservation,
)
from .kosten_rueckmeldung import (
    kosten_einfuegen,
    kosten_entfernen,
    kosten_laden,
    kosten_zeile,
    rueckmeldung_laden,
    rueckmeldung_schreiben,
    waehrung_fuer_aufgabe,
)
from .schedule_label import schedule_label
from .schemas import (
    CalendarBooking,
    ChecklistItem,
    ChecklistItemCreate,
    ChecklistPhotoCreate,
    InspectionDecision,
    InspectionItem,
    InspectionState,
    InventoryItem,
    InventoryItemCreate,
    RegelDeckung,
    RuleCreate,
    RuleDetail,
    RuleItem,
    RuleListItem,
    RuleUpdate,
    SliceHealth,
    Substitution,
    SubstitutionListItem,
    SubstitutionRequest,
    SubstitutionStatus,
    Task,
    TaskAssigneeOption,
    TaskCalendarResponse,
    TaskCalendarRow,
    TaskCost,
    TaskCostCreate,
    TaskCreate,
    TaskDetail,
    TaskListItem,
    TaskResolution,
    TaskResolutionUpsert,
    TaskRuleKind,
    TaskSource,
    TaskStatus,
    UngedecktesObjekt,
)

log = get_logger("nextdays.tasks")


def _utc(wert: datetime) -> datetime:
    """Zeitstempel als UTC-bewusster Wert. Ein zeitzonenloser Wert aus
    Altdaten gilt als UTC — so wie die DB ihn geschrieben hat."""
    return wert if wert.tzinfo else wert.replace(tzinfo=UTC)


def _als_zeitpunkt(wert: str, feld: str) -> datetime:
    """Eine Fenstergrenze des Kalenders als Zeitpunkt.

    Vorher verglich der Kalender ISO-STRINGS
    (`month_from <= (start_at or due_at).isoformat() <= month_to`). Das hängt am
    Textformat statt am Zeitpunkt: die App schickt `…T00:00:00.000Z`, Python
    schreibt `…+00:00`. Bei gleicher Sekunde entscheidet dann die ASCII-Ordnung
    von '+' und '.' — eine Aufgabe genau auf der unteren Fenstergrenze fiel aus
    dem Kalender heraus, ohne dass irgendwo ein Fehler entstand.

    Ein unlesbarer Wert ist ein Fehler des Aufrufers (422), kein Anlass für ein
    geratenes Fenster (Wurzel 4).
    """
    try:
        gelesen = datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError as exc:
        raise TaskError(
            f"Ungültiger Zeitpunkt in {feld}.", status_code=422
        ) from exc
    return _utc(gelesen)

# Foto-Upload (Checklisten-Nachweise → privater Bucket task-photos).
_TASK_PHOTO_BUCKET = "task-photos"
_PHOTO_MAX_BYTES = 20 * 1024 * 1024
_PHOTO_MIME = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def _bild_typ(content: bytes) -> str | None:
    """Der WIRKLICHE Bildtyp aus den Anfangsbytes, oder None.

    Wurzel 8: der `content_type` des Clients ist eine Behauptung — er wird von
    der Gegenseite gesetzt und kostet nichts. Wer „image/jpeg" schreibt und
    eine HTML- oder SVG-Datei schickt, hätte damit eine Datei im Bucket, die
    ein Browser als Markup ausführt. Deshalb entscheidet die Signatur:
    JPEG ``FF D8 FF``, PNG ``89 50 4E 47 0D 0A 1A 0A``, WebP ``RIFF....WEBP``.
    """
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


class TaskError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class TasksService:
    slice_name = "tasks"

    def __init__(self, client: Client | None = None) -> None:
        self._client = client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise TaskError("Aufgaben-DB nicht verfügbar.", status_code=500)
        return self._client

    # --- Aufgaben ---

    def create_task(self, tenant_id: str, req: TaskCreate) -> Task:
        # FK-Ziele müssen dem Tenant gehören (Wurzel 3).
        if req.property_id:
            self._require_own_properties(tenant_id, [req.property_id])
        self._require_own_assignee(tenant_id, req.assignee_id, req.property_id)
        row = self._insert(
            "tasks",
            {
                "tenant_id": tenant_id,
                "property_id": req.property_id,
                "assignee_id": req.assignee_id,
                "reservation_id": req.reservation_id,
                "title": req.title,
                "description": req.description,
                "status": TaskStatus.open.value,
                "due_at": req.due_at.isoformat() if req.due_at else None,
                "start_at": req.start_at.isoformat() if req.start_at else None,
                "end_at": req.end_at.isoformat() if req.end_at else None,
                "priority": req.priority,
                "needs_inspection": req.needs_inspection,
            },
        )
        # Der Zugewiesene erfährt von seiner Aufgabe (0331). Best-effort und
        # NACH dem Insert: schlägt der Versand fehl, ist die Aufgabe trotzdem
        # angelegt (Wurzel 5 — der Nebenpfad kippt den Hauptpfad nicht; die
        # Funktion fängt intern breit).
        melde_aufgaben_zuweisung(
            self._db(),
            tenant_id=tenant_id,
            task_id=str(row["id"]),
            assignee_id=req.assignee_id,
            titel=req.title,
            property_id=req.property_id,
        )
        return self._to_task(row)

    def list_tasks(
        self,
        tenant_id: str,
        assignee_id: str | None = None,
        ctx: AuthContext | None = None,
    ) -> list[Task]:
        q = self._db().table("tasks").select("*").eq("tenant_id", tenant_id)
        if assignee_id is not None:
            q = q.eq("assignee_id", assignee_id)
        res = q.execute()
        tasks = [self._to_task(r) for r in (res.data or [])]
        # Defense-in-depth (§4.3): ein Mitarbeiter sieht objektgebundene Aufgaben
        # nur an seinen freigegebenen Objekten (staff_property_assignments), selbst
        # wenn ihm versehentlich eine Aufgabe an einem nicht freigegebenen Objekt
        # zugewiesen wurde. Pool-Aufgaben ohne Objektbezug (property_id=None,
        # z. B. Lager/Büro) bleiben sichtbar. Fail-closed bei objektgebundenen.
        if ctx is not None and is_staff(ctx):
            allowed = staff_property_ids(self._db(), ctx)
            tasks = [
                t
                for t in tasks
                if t.property_id is None or t.property_id in allowed
            ]
        return tasks

    def list_by_reservation(
        self, tenant_id: str, reservation_id: str, ctx: AuthContext | None = None
    ) -> list[Task]:
        """Aufgaben zu einer Buchung (PM-Detailseite).

        ZUERST die Buchung selbst im Rollen-Scope laden, DANN ihre Aufgaben
        (Wurzel 9). Der reine tenant_id-Filter reichte nicht: der
        reservations-Slice 404t eine fremde Buchung (`reads.detail`), dieser
        Pfad tat es nicht — ein Eigentümer konnte über eine untergeschobene
        reservation_id die Aufgaben eines nicht zugeordneten Objekts lesen. Der
        Item-Pfad darf nicht mehr hergeben als der List-Pfad.
        """
        self._require_own_reservation(tenant_id, reservation_id, ctx)
        res = (
            self._db()
            .table("tasks")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .order("due_at")
            .execute()
        )
        return [self._to_task(r) for r in (res.data or [])]

    def _require_own_reservation(
        self, tenant_id: str, reservation_id: str, ctx: AuthContext | None = None
    ) -> None:
        """Die Buchung MUSS dem Tenant gehören UND im Objekt-Scope der Rolle
        liegen (§4.2 owner, §4.3 staff) — sonst 404 wie „nicht vorhanden".

        Ohne `ctx` bleibt es beim reinen Tenant-Scope (interne Aufrufer).
        """
        try:
            # Nicht-UUID würde Postgres mit 22P02 quittieren → nutzergetriebener
            # 500 (Wurzel 5). Fachlich ist das schlicht „nicht gefunden".
            UUID(str(reservation_id))
        except (ValueError, AttributeError, TypeError) as exc:
            raise TaskError(
                "Reservierung nicht gefunden.", status_code=404
            ) from exc
        rows = (
            self._db()
            .table("reservations")
            .select("id, property_id")
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TaskError("Reservierung nicht gefunden.", status_code=404)
        if ctx is None:
            return
        prop = rows[0].get("property_id")
        if is_owner(ctx) and prop not in owner_property_ids(self._db(), ctx):
            raise TaskError("Reservierung nicht gefunden.", status_code=404)
        if is_staff(ctx) and prop not in staff_property_ids(self._db(), ctx):
            raise TaskError("Reservierung nicht gefunden.", status_code=404)

    def delete_task(
        self, tenant_id: str, task_id: str, ctx: AuthContext | None = None
    ) -> None:
        """Aufgabe löschen (Kalender-Popup).

        Der Item-Pfad prüft denselben Scope wie der Listen-Pfad (Wurzel 9):
        vorher war hier NUR der Tenant gescopt, während `bulk_delete` jede
        Aufgabe einzeln über `get_detail` prüft. Damit war der Einzel-Löscher
        schwächer als der Massen-Löscher — ein Mitarbeiter mit `MANAGE_TASKS`
        konnte eine Aufgabe an einem Objekt löschen, das er nicht einmal sehen
        darf.
        """
        # Lädt im Objekt-Scope und wirft 404, wenn die Aufgabe außerhalb liegt.
        self.get_detail(tenant_id, task_id, ctx)
        res = (
            self._db()
            .table("tasks")
            .delete()
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)

    # --- Auto-Generierung bei Buchung (§2.5) ---
    #
    # Früher standen hier zwei fest verdrahtete deutsche Titel („Anreise-Check/
    # Inspektion", „Endreinigung"), die niemand konfigurieren konnte und die
    # nichts mit den angelegten planmäßigen Regeln zu tun hatten. Diese zweite,
    # tote Welt ist mit 0272 ersatzlos weg: was bei einer Buchung entsteht,
    # entscheiden ausschließlich die Regeln (`engine.sync_for_reservation`),
    # aufgerufen vom Reservierungs-Schreibpfad.

    def sync_reservation_tasks(self, tenant_id: str, reservation_id: str) -> int:
        """Regel-Abgleich für eine Reservierung anstoßen (Cron/Nachzügler)."""
        rows = (
            self._db()
            .table("reservations")
            .select(
                "id, property_id, status, check_in, check_out, "
                "checkin_time, checkout_time, created_at"
            )
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TaskError("Reservierung nicht gefunden.", status_code=404)
        return sync_for_reservation(self._db(), tenant_id, rows[0])

    def materialize_recurring(self, tenant_id: str, today: date) -> int:
        """Wiederkehrende Regeln ausrollen (Worker-Tick)."""
        return materialize_recurring(self._db(), tenant_id, today=today)

    def nachziehen_planmaessig(
        self, tenant_id: str, today: date, *, rule_id: str | None = None
    ) -> int:
        """Planmäßige Regeln gegen die Buchungen im Fenster abgleichen.

        Zwei Aufrufer: der Worker-Tick (alle Regeln, Auffangnetz für jeden
        Schreibpfad, der die Engine nicht ruft) und das Speichern einer Regel
        (nur diese Regel, damit ihre Aufgaben sofort stehen statt erst beim
        nächsten Tick).
        """
        return nachziehen_planmaessig(
            self._db(), tenant_id, today=today, rule_id=rule_id
        )

    def regeln_ausrollen(self, today: date) -> dict[str, int]:
        """Beide Regel-Läufe über ALLE Tenants: regelmäßige materialisieren,
        planmäßige gegen die Buchungen im Fenster nachziehen.

        EINE Stelle für den Worker-Tick und den internen Cron-Endpunkt. Vorher
        stand die Tenant-Schleife zweimal im Code — und prompt fehlte der
        Nachzug in einer der beiden Kopien.

        Ein Tenant mit kaputter Regel kippt weder den Lauf noch die übrigen
        Tenants: jeder Schritt wird je Tenant gefangen und protokolliert.
        """
        db = self._db()
        tenants = (db.table("tenants").select("id").execute()).data or []
        created = 0
        nachgezogen = 0
        for tenant in tenants:
            tenant_id = str(tenant["id"])
            try:
                created += materialize_recurring(db, tenant_id, today=today)
            except APIError:  # noqa: BLE001 — ein Tenant kippt nicht alle
                log.exception(
                    "tasks_materialize_failed", extra={"tenant_id": tenant_id}
                )
            try:
                nachgezogen += nachziehen_planmaessig(db, tenant_id, today=today)
            except APIError:  # noqa: BLE001 — ein Tenant kippt nicht alle
                log.exception(
                    "tasks_nachzug_failed", extra={"tenant_id": tenant_id}
                )
        return {
            "tenants": len(tenants),
            "created": created,
            "nachgezogen": nachgezogen,
        }

    def generate_for_addon(
        self,
        tenant_id: str,
        property_id: str,
        reservation_id: str,
        addon_label: str,
        due_at: str,
    ) -> Task | None:
        """Vorbereitungs-Aufgabe bei Kauf einer Zusatzleistung (Trigger
        ``addon_purchased``). Fällig am Anreisetag; ein Task je gekauftem Item.
        Best-effort: Fehler werden geloggt, nicht propagiert (kein Kauf-Abbruch)."""
        try:
            res = (
                self._db()
                .table("tasks")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "reservation_id": reservation_id,
                        "title": f"Zusatzleistung vorbereiten: {addon_label}",
                        "status": TaskStatus.open.value,
                        "due_at": due_at,
                    }
                )
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Task-Fehler darf Kauf nicht killen
            log.warning("addon_task_failed", reservation_id=reservation_id, error=str(exc))
            return None
        log.info("task_generated_for_addon", reservation_id=reservation_id)
        return self._to_task(res.data[0]) if res.data else None

    # --- Checklisten + Foto-Nachweise (§2.5) ---

    def _require_own_task(
        self, tenant_id: str, task_id: str, ctx: AuthContext | None = None
    ) -> None:
        """Die Aufgabe MUSS dem Tenant gehören. checklist_items/-photos tragen
        keine tenant_id (Migration 0012) — der Service läuft mit service_role
        (RLS umgangen), also ist dieser explizite Check der EINZIGE Cross-Tenant-
        Schutz: sonst könnte ein Mitarbeiter mit einer erratenen fremden task_id
        Einträge an fremde Aufgaben schreiben (IDOR).

        Mit `ctx` gilt zusätzlich derselbe Objekt-Scope wie in `list_tasks`
        (Wurzel 9): der Item-Pfad darf nicht mehr hergeben als der List-Pfad,
        sonst liest/schließt ein Mitarbeiter über eine geratene task_id eine
        Aufgabe an einem nicht freigegebenen Objekt ab (IDOR-in-role).
        Pool-Aufgaben ohne Objektbezug bleiben erreichbar, wie in der Liste.
        """
        owned = (
            self._db()
            .table("tasks")
            .select("id, property_id")
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not owned:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        if ctx is not None and is_staff(ctx):
            prop = owned[0].get("property_id")
            if prop is not None and prop not in staff_property_ids(self._db(), ctx):
                # Gleiche Fehlermeldung wie „nicht vorhanden": kein Orakel
                # darüber, ob eine fremde Aufgabe existiert.
                raise TaskError("Aufgabe nicht gefunden.", status_code=404)

    def _require_own_checklist_item(
        self, tenant_id: str, item_id: str, ctx: AuthContext | None = None
    ) -> None:
        """Das Checklist-Item MUSS über seine Aufgabe zum Tenant gehören —
        und mit `ctx` zusätzlich zum Objekt-Scope des Mitarbeiters (Wurzel 9)."""
        item = (
            self._db()
            .table("checklist_items")
            .select("task_id")
            .eq("id", item_id)
            .limit(1)
            .execute()
        ).data
        if not item:
            raise TaskError("Checklisten-Eintrag nicht gefunden.", status_code=404)
        self._require_own_task(tenant_id, str(item[0]["task_id"]), ctx)

    def add_checklist_item(
        self,
        tenant_id: str,
        req: ChecklistItemCreate,
        ctx: AuthContext | None = None,
    ) -> ChecklistItem:
        self._require_own_task(tenant_id, req.task_id, ctx)
        row = self._insert(
            "checklist_items",
            {
                "task_id": req.task_id,
                "label": req.label,
                "room": req.room,
                "sort_order": req.sort_order,
            },
        )
        return ChecklistItem(**{k: row.get(k) for k in ChecklistItem.model_fields})

    def add_checklist_photo(
        self,
        tenant_id: str,
        req: ChecklistPhotoCreate,
        ctx: AuthContext | None = None,
    ) -> str:
        """Bildnachweis (unbegrenzt pro Raum) referenzieren. Gibt Foto-ID zurück."""
        self._require_own_checklist_item(tenant_id, req.item_id, ctx)
        row = self._insert(
            "checklist_photos",
            {"item_id": req.item_id, "storage_path": req.storage_path},
        )
        return row["id"]

    def upload_task_photo(
        self,
        tenant_id: str,
        task_id: str,
        content: bytes,
        content_type: str,
        ctx: AuthContext | None = None,
    ) -> str:
        """Foto direkt an einer Aufgabe (ohne konkretes Checklisten-Item).
        Housekeeping-Nachweis („Foto vom sauberen Zimmer"). Legt bei Bedarf EIN
        Sammel-Item ('Fotos') an und hängt das Foto dort ein — so erscheint es
        im Bilder-Modul als Buchungsbild. IDOR-Guard über tenant + Objekt-Scope."""
        self._require_own_task(tenant_id, task_id, ctx)
        item_id = self._ensure_photo_item(task_id)
        return self.upload_checklist_photo(
            tenant_id, item_id, content, content_type, ctx
        )

    def _ensure_photo_item(self, task_id: str) -> str:
        """Sammel-Item 'Fotos' der Aufgabe — vorhandenes wiederverwenden
        (Idempotenz, Wurzel 2), sonst anlegen."""
        existing = (
            self._db()
            .table("checklist_items")
            .select("id")
            .eq("task_id", task_id)
            .eq("label", "Fotos")
            .limit(1)
            .execute()
        ).data
        if existing:
            return existing[0]["id"]
        row = self._insert(
            "checklist_items",
            {"task_id": task_id, "label": "Fotos", "requires_photo": True},
        )
        return row["id"]

    def upload_checklist_photo(
        self,
        tenant_id: str,
        item_id: str,
        content: bytes,
        content_type: str,
        ctx: AuthContext | None = None,
    ) -> str:
        """Foto-Datei zu einem Checklisten-Punkt hochladen (privater Bucket
        task-photos) und in checklist_photos referenzieren. IDOR-Guard über die
        Item→Task→Tenant-Kette (Wurzel 3) plus Objekt-Scope des Mitarbeiters
        (Wurzel 9). Typ/Größe serverseitig prüfen."""
        self._require_own_checklist_item(tenant_id, item_id, ctx)
        if not content:
            raise TaskError("Bild ist leer.", status_code=413)
        if len(content) > _PHOTO_MAX_BYTES:
            raise TaskError("Bild ist zu groß (max. 20 MB).", status_code=413)
        # Der echte Typ kommt aus den BYTES, nicht aus dem Header des Clients
        # (Wurzel 8). Gespeichert wird ausschließlich, was wirklich ein Bild ist;
        # der mitgeschickte Header muss dazu passen, sonst 415.
        echt = _bild_typ(content)
        if echt is None or (content_type and content_type not in _PHOTO_MIME):
            raise TaskError("Nur JPEG/PNG/WebP erlaubt.", status_code=415)
        ext = _PHOTO_MIME[echt]
        name = secrets.token_hex(8)
        path = f"{tenant_id}/{item_id}/{name}.{ext}"
        try:
            self._db().storage.from_(_TASK_PHOTO_BUCKET).upload(
                path, content, {"content-type": echt}
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich als 502
            log.warning("checklist_photo_upload_failed", item_id=item_id, error=str(exc))
            raise TaskError("Upload fehlgeschlagen.", status_code=502) from exc
        row = self._insert(
            "checklist_photos",
            {"item_id": item_id, "storage_path": path},
        )
        log.info("checklist_photo_uploaded", tenant_id=tenant_id, item_id=item_id)
        return row["id"]

    # --- Vertretungs-Feature (§4.3) ---

    def request_substitution(
        self, tenant_id: str, user_id: str, req: SubstitutionRequest
    ) -> Substitution:
        """Zugewiesener Mitarbeiter fragt Vertretung für eine Aufgabe an.

        §4.3: NUR der zugewiesene Mitarbeiter darf eine Vertretung anfragen. Ohne
        diesen Check könnte ein Mitarbeiter Vertretung für fremde/nicht zugewiesene
        Aufgaben erzeugen, die ein Kollege dann übernimmt (Umgehung der Zuweisung).
        Der Service läuft mit service_role (RLS umgangen) → Check hier zwingend."""
        task = (
            self._db()
            .table("tasks")
            .select("id, assignee_id")
            .eq("id", req.task_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not task:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        if str(task[0].get("assignee_id") or "") != user_id:
            raise TaskError(
                "Nur der zugewiesene Mitarbeiter kann eine Vertretung anfragen.",
                status_code=403,
            )
        row = self._insert(
            "task_substitutions",
            {
                "tenant_id": tenant_id,
                "task_id": req.task_id,
                "requested_by": user_id,
                "status": SubstitutionStatus.requested.value,
                "note": req.note,
            },
        )
        log.info("substitution_requested", task_id=req.task_id, by=user_id)
        # Wer einspringen KOENNTE, erfaehrt es jetzt (0415). Der Empfaengerkreis
        # ist derselbe, aus dem eine Zuweisung schoepfen darf
        # (`moegliche_zustaendige`: Capability + Objekt-Freigabe) — nur ohne den
        # Anfragenden selbst. „An alle im Tenant" waere geraten und schickte der
        # Buchhaltung Reinigungsanfragen.
        #
        # Der Aufruf steht NACH dem Insert und in einem eigenen Nebenpfad: die
        # Anfrage ist der Zustand, die Meldung ihr Beiwerk — ein Mailproblem
        # darf die Anfrage nicht kippen (Wurzel 5).
        aufgabe = (
            self._db()
            .table("tasks")
            .select("title, property_id")
            .eq("id", req.task_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or [{}]
        prop = aufgabe[0].get("property_id")
        melde_vertretung_gesucht(
            self._db(),
            tenant_id=tenant_id,
            task_id=req.task_id,
            empfaenger_ids=[
                k.user_id
                for k in self.moegliche_zustaendige(
                    tenant_id, str(prop) if prop else None
                )
                if k.user_id != user_id
            ],
            titel=str(aufgabe[0].get("title") or ""),
            property_id=str(prop) if prop else None,
        )
        return Substitution(**{k: row.get(k) for k in Substitution.model_fields})

    def _offene_anfrage(self, tenant_id: str, substitution_id: str) -> dict[str, object]:
        """Eine Anfrage laden, die noch entscheidbar ist.

        Der Status-Guard ist der Punkt: ohne ihn liesse sich eine bereits
        angenommene Anfrage erneut „annehmen" und der Vertreter damit
        ueberschreiben — die Aufgabe waere bei jemandem gelandet, mit dem
        niemand gerechnet hat.
        """
        rows = (
            self._db()
            .table("task_substitutions")
            .select("id, task_id, requested_by, status")
            .eq("id", substitution_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TaskError("Vertretungsanfrage nicht gefunden.", status_code=404)
        if str(rows[0].get("status") or "") != SubstitutionStatus.requested.value:
            raise TaskError(
                "Diese Vertretungsanfrage ist bereits entschieden.",
                status_code=409,
            )
        return rows[0]

    def accept_substitution(
        self,
        tenant_id: str,
        substitution_id: str,
        accepted_by: str,
        ctx: AuthContext | None = None,
    ) -> Substitution:
        """Vertretung annehmen — und die Aufgabe dabei WIRKLICH uebernehmen.

        Bis hierher setzte diese Methode nur `status='accepted'`. Die Aufgabe
        selbst blieb beim urspruenglich Zustaendigen: sie tauchte beim
        Vertreter in `/tasks/mine` nie auf, beim Vertretenen dafuer weiter.
        Zwei Leute mit derselben Aufgabe, keiner davon der, der sie
        uebernommen hat — das Feature sah funktionsfaehig aus und war es nie
        (Wurzel 1: die Aktion hatte einen Gegenzustand, den niemand pflegte).

        Reihenfolge: ZUERST die Anfrage claimen (`update … .eq("status",
        "requested")`), dann die Aufgabe umschreiben. Andersherum — und so
        stand es hier zuerst — verliert das Rennen der Falsche: nehmen C und D
        gleichzeitig an, laufen beide durch `_offene_anfrage`, beide rufen
        `set_assignee`, und wer dort ZULETZT schreibt, bekommt die Aufgabe;
        den Claim gewinnt aber, wer beim Quittieren ZUERST ist. Ergebnis waere
        gewesen: Aufgabe bei C, Anfrage sagt D, C bekommt ein 409 „du hast sie
        nicht bekommen" — und beide Benachrichtigungen sind raus. Der Claim
        MUSS deshalb der Riegel sein, nicht die Reihenfolge (Wurzel 2).

        Kippt das Umschreiben danach, wird der Claim zurueckgerollt: eine
        quittierte Anfrage ohne Wirkung waere schlimmer als eine offene
        (Wurzel 1).
        """
        anfrage = self._offene_anfrage(tenant_id, substitution_id)
        if str(anfrage.get("requested_by") or "") == accepted_by:
            raise TaskError(
                "Man kann sich nicht selbst vertreten.", status_code=422
            )
        res = (
            self._db()
            .table("task_substitutions")
            .update(
                {
                    "status": SubstitutionStatus.accepted.value,
                    "accepted_by": accepted_by,
                }
            )
            .eq("id", substitution_id)
            .eq("tenant_id", tenant_id)
            .eq("status", SubstitutionStatus.requested.value)
            .execute()
        )
        if not res.data:
            # Zwischen Laden und Claim hat jemand anderes angenommen.
            raise TaskError(
                "Diese Vertretungsanfrage ist bereits entschieden.",
                status_code=409,
            )
        try:
            self.set_assignee(
                tenant_id, str(anfrage["task_id"]), accepted_by, ctx
            )
        except TaskError:
            # Gegenzustand (Wurzel 1): der Claim war eine Zusage, die nicht
            # eingeloest werden konnte — sie wird zurueckgenommen, damit ein
            # anderer Kollege die Anfrage noch annehmen kann. Bewusst NUR
            # `TaskError` (fachliche Ablehnung wie fehlende Objekt-Freigabe);
            # ein echter Programmfehler fliegt durch und laesst den Claim
            # stehen, statt ihn stillschweigend wegzuraeumen (Wurzel 5).
            self._db().table("task_substitutions").update(
                {
                    "status": SubstitutionStatus.requested.value,
                    "accepted_by": None,
                }
            ).eq("id", substitution_id).eq("tenant_id", tenant_id).execute()
            raise
        log.info(
            "substitution_accepted",
            substitution_id=substitution_id, task_id=anfrage["task_id"],
            by=accepted_by,
        )
        self._melde_vertretungs_antwort(
            tenant_id,
            str(anfrage["task_id"]),
            str(anfrage.get("requested_by") or ""),
            uebernommen=True,
            durch=accepted_by,
        )
        return Substitution(
            **{k: res.data[0].get(k) for k in Substitution.model_fields}
        )

    def decline_substitution(
        self,
        tenant_id: str,
        substitution_id: str,
        declined_by: str,
        ctx: AuthContext | None = None,
    ) -> Substitution:
        """Vertretung ablehnen.

        Das Enum kennt `declined` seit 0019, einen Weg dorthin gab es nie —
        eine ausgeschlagene Anfrage blieb ewig „offen" und stand jedem
        Kollegen weiter in der Liste. Die Aufgabe wechselt hierbei NICHT den
        Zustaendigen: sie bleibt, wo sie war.

        `ctx` ist Pflicht fuer den Scope, nicht Beiwerk: `list_substitutions`
        blendet Anfragen zu nicht freigegebenen Objekten aus, `accept` erbt
        den Scope ueber `set_assignee` — `decline` haette sonst als einziger
        Pfad nur den Tenant geprueft. Ein Mitarbeiter koennte eine Anfrage
        abwuergen, die er nicht einmal sehen darf: die Bitte um Vertretung
        waere erledigt, ohne dass jemand einspringt, und der Fragende erfaehrt
        es nicht (Wurzel 9 — der Item-Pfad darf nicht mehr hergeben als die
        Liste).
        """
        anfrage = self._offene_anfrage(tenant_id, substitution_id)
        # Wirft 404, wenn die Aufgabe ausserhalb des eigenen Objekt-Scopes
        # liegt — dieselbe Meldung wie „gibt es nicht", kein Orakel.
        self.get_detail(tenant_id, str(anfrage["task_id"]), ctx)
        res = (
            self._db()
            .table("task_substitutions")
            .update({"status": SubstitutionStatus.declined.value})
            .eq("id", substitution_id)
            .eq("tenant_id", tenant_id)
            .eq("status", SubstitutionStatus.requested.value)
            .execute()
        )
        if not res.data:
            raise TaskError(
                "Diese Vertretungsanfrage ist bereits entschieden.",
                status_code=409,
            )
        log.info(
            "substitution_declined",
            substitution_id=substitution_id, by=declined_by,
        )
        self._melde_vertretungs_antwort(
            tenant_id,
            str(anfrage["task_id"]),
            str(anfrage.get("requested_by") or ""),
            uebernommen=False,
            durch=declined_by,
        )
        return Substitution(
            **{k: res.data[0].get(k) for k in Substitution.model_fields}
        )

    def _melde_vertretungs_antwort(
        self,
        tenant_id: str,
        task_id: str,
        empfaenger_id: str,
        *,
        uebernommen: bool,
        durch: str,
    ) -> None:
        """Die Entscheidung zurueck an den, der die Vertretung gesucht hat.

        Ein Helfer fuer beide Wege (annehmen/ablehnen), damit der Text und der
        Empfaenger nicht an zwei Stellen gepflegt werden. Bei der Ablehnung
        geht KEIN Name mit — abgelehnt hat eine bestimmte Person, die Aussage
        ist aber „es hat niemand uebernommen".
        """
        aufgabe = (
            self._db()
            .table("tasks")
            .select("title, property_id")
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or [{}]
        prop = aufgabe[0].get("property_id")
        name = self._user_names(tenant_id, {durch}).get(durch) if uebernommen else None
        melde_vertretung_entschieden(
            self._db(),
            tenant_id=tenant_id,
            task_id=task_id,
            empfaenger_id=empfaenger_id,
            titel=str(aufgabe[0].get("title") or ""),
            uebernommen=uebernommen,
            durch_name=name,
            property_id=str(prop) if prop else None,
        )

    def list_substitutions(
        self, tenant_id: str, user_id: str, ctx: AuthContext | None = None
    ) -> list[SubstitutionListItem]:
        """Offene Vertretungsanfragen, die ich uebernehmen KOENNTE.

        Ohne diese Liste war das Feature unerreichbar: es gab keinen Weg, von
        einer Anfrage zu erfahren — man haette ihre ID bereits kennen muessen.

        Eigene Anfragen fallen raus (man vertritt sich nicht selbst), und der
        Objekt-Scope gilt wie ueberall: eine Anfrage zu einer Aufgabe an einem
        Objekt, das mir nicht freigegeben ist, koennte ich ohnehin nicht
        uebernehmen — sie zu zeigen waere eine leere Einladung (Wurzel 9).
        """
        offen = (
            self._db()
            .table("task_substitutions")
            .select("id, task_id, requested_by, accepted_by, status, note")
            .eq("tenant_id", tenant_id)
            .eq("status", SubstitutionStatus.requested.value)
            .execute()
        ).data or []
        fremd = [r for r in offen if str(r.get("requested_by") or "") != user_id]
        if not fremd:
            return []
        aufgaben = {
            str(t["id"]): t
            for t in (
                self._db()
                .table("tasks")
                .select("id, title, property_id, start_at, end_at")
                .eq("tenant_id", tenant_id)
                .in_("id", [str(r["task_id"]) for r in fremd])
                .execute()
            ).data
            or []
        }
        erlaubt: set[str] | None = None
        if ctx is not None and is_staff(ctx):
            erlaubt = staff_property_ids(self._db(), ctx)
        titel = self._property_titles(
            tenant_id,
            {
                str(t["property_id"])
                for t in aufgaben.values()
                if t.get("property_id")
            },
        )
        namen = self._user_names(
            tenant_id, {str(r["requested_by"]) for r in fremd}
        )
        items: list[SubstitutionListItem] = []
        for r in fremd:
            aufgabe = aufgaben.get(str(r["task_id"]))
            if aufgabe is None:
                continue
            prop = aufgabe.get("property_id")
            if erlaubt is not None and prop is not None and str(prop) not in erlaubt:
                continue
            items.append(
                SubstitutionListItem(
                    id=str(r["id"]),
                    task_id=str(r["task_id"]),
                    requested_by=str(r["requested_by"]),
                    accepted_by=r.get("accepted_by"),
                    status=SubstitutionStatus(r["status"]),
                    note=r.get("note"),
                    title=str(aufgabe.get("title") or ""),
                    property_id=str(prop) if prop else None,
                    property_title=titel.get(str(prop)) if prop else None,
                    start_at=aufgabe.get("start_at"),
                    end_at=aufgabe.get("end_at"),
                    requested_by_name=namen.get(str(r["requested_by"])),
                )
            )
        return items

    # --- Inventar (§2.5) ---

    def add_inventory(self, tenant_id: str, req: InventoryItemCreate) -> InventoryItem:
        row = self._insert(
            "inventory_items",
            {
                "tenant_id": tenant_id,
                "property_id": req.property_id,  # None = zentraler Pool
                "name": req.name,
                "quantity": req.quantity,
            },
        )
        return InventoryItem(**{k: row.get(k) for k in InventoryItem.model_fields})

    # --- angereicherte Sichten: Team, Kalender, Detail ---

    def _property_titles(self, tenant_id: str, ids: set[str]) -> dict[str, str]:
        """Objekt-Titel im Batch. Tenant-scoped (Service-Role umgeht RLS)."""
        clean = {i for i in ids if i}
        if not clean:
            return {}
        res = (
            self._db()
            .table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .in_("id", list(clean))
            .execute()
        )
        return {r["id"]: r.get("title") or "" for r in (res.data or [])}

    def _user_names(self, tenant_id: str, ids: set[str]) -> dict[str, str]:
        """Anzeigenamen der Assignees im Batch. Nur Name — keine PII/Kontakt."""
        clean = {i for i in ids if i}
        if not clean:
            return {}
        res = (
            self._db()
            .table("users")
            .select("id, full_name")
            .eq("tenant_id", tenant_id)
            .in_("id", list(clean))
            .execute()
        )
        return {r["id"]: r.get("full_name") or "" for r in (res.data or [])}

    def _checklist_counts(self, task_ids: set[str]) -> dict[str, tuple[int, int]]:
        """(total, done) je Task. checklist_items trägt keine tenant_id — die
        task_ids sind bereits tenant-gefiltert übergeben (Wurzel 3)."""
        clean = {i for i in task_ids if i}
        if not clean:
            return {}
        res = (
            self._db()
            .table("checklist_items")
            .select("task_id, done")
            .in_("task_id", list(clean))
            .execute()
        )
        counts: dict[str, tuple[int, int]] = {}
        for r in res.data or []:
            tid = r["task_id"]
            total, done = counts.get(tid, (0, 0))
            counts[tid] = (total + 1, done + (1 if r.get("done") else 0))
        return counts

    def _reservation_refs(
        self, tenant_id: str, reservation_ids: set[str]
    ) -> dict[str, str]:
        """Anzeige-Referenz je Buchung für die Spalte „Buchung".

        Bevorzugt die Portal-/Fremdreferenz (die Zahl, die der Betrieb beim
        Portal sieht); fehlt sie, der Kurz-Anfang der eigenen ID. Kein
        Gast-Name, kein Betrag (§4.3 — die Spalte sieht auch die Reinigungskraft).
        """
        clean = {i for i in reservation_ids if i}
        if not clean:
            return {}
        rows = (
            self._db()
            .table("reservations")
            .select("id, external_ref")
            .eq("tenant_id", tenant_id)
            .in_("id", list(clean))
            .execute()
        ).data or []
        return {
            r["id"]: (r.get("external_ref") or str(r["id"])[:8]) for r in rows
        }

    def _enrich(
        self, tenant_id: str, tasks: list[Task]
    ) -> list[TaskListItem]:
        """Reichert Tasks um Objekt-/Assignee-Namen, Buchungsreferenz und
        Checklist-Zähler an. KEINE Gast-PII/Beträge (Housekeeping-Masking, §4.3)."""
        pids = {t.property_id for t in tasks if t.property_id}
        aids = {t.assignee_id for t in tasks if t.assignee_id}
        titles = self._property_titles(tenant_id, pids)
        names = self._user_names(tenant_id, aids)
        counts = self._checklist_counts({t.id for t in tasks})
        refs = self._reservation_refs(
            tenant_id, {t.reservation_id for t in tasks if t.reservation_id}
        )
        items: list[TaskListItem] = []
        for t in tasks:
            total, done = counts.get(t.id, (0, 0))
            items.append(
                TaskListItem(
                    **t.model_dump(),
                    property_title=titles.get(t.property_id or ""),
                    assignee_name=names.get(t.assignee_id or ""),
                    reservation_ref=refs.get(t.reservation_id or ""),
                    checklist_total=total,
                    checklist_done=done,
                )
            )
        return items

    def list_team_tasks(
        self,
        tenant_id: str,
        status_bucket: str | None = None,
        property_ids: list[str] | None = None,
        assignee_ids: list[str] | None = None,
        rule_ids: list[str] | None = None,
        tagesende: datetime | None = None,
    ) -> list[TaskListItem]:
        """Alle Aufgaben des Tenants mit Assignee (MANAGE_TASKS)."""
        rows = self._filtered_tasks(
            tenant_id,
            property_ids=property_ids,
            assignee_ids=assignee_ids,
            rule_ids=rule_ids,
        )
        return self._enrich(
            tenant_id, self._filter_bucket(rows, status_bucket, tagesende)
        )

    def list_own_tasks(
        self,
        tenant_id: str,
        user_id: str,
        status_bucket: str | None = None,
        property_ids: list[str] | None = None,
        ctx: AuthContext | None = None,
        tagesende: datetime | None = None,
    ) -> list[TaskListItem]:
        """„Meine Aufgaben": dieselbe Tabelle wie Teamaufgaben, aber hart auf den
        angemeldeten Nutzer gescopt (Wurzel 9 — der Filter ist keine Anzeigehilfe,
        er ist die Autorisierung)."""
        rows = self._filtered_tasks(
            tenant_id, property_ids=property_ids, assignee_ids=[user_id]
        )
        if ctx is not None and is_staff(ctx):
            allowed = staff_property_ids(self._db(), ctx)
            rows = [t for t in rows if t.property_id is None or t.property_id in allowed]
        return self._enrich(
            tenant_id, self._filter_bucket(rows, status_bucket, tagesende)
        )

    _UNASSIGNED = "none"

    def _filtered_tasks(
        self,
        tenant_id: str,
        *,
        property_ids: list[str] | None = None,
        assignee_ids: list[str] | None = None,
        rule_ids: list[str] | None = None,
    ) -> list[Task]:
        """Gemeinsamer Lesepfad der Listen und des Kalenders.

        Mehrfachauswahl wirkt wirklich: früher griff der Nutzerfilter nur bei
        GENAU einer Auswahl, jede weitere blieb folgenlos. Der Sonderwert
        ``none`` in `assignee_ids` meint „Nicht zugeordnet" (Lodgify-Eintrag).
        """
        q = self._db().table("tasks").select("*").eq("tenant_id", tenant_id)
        if property_ids:
            q = q.in_("property_id", property_ids)
        if rule_ids:
            q = q.in_("rule_id", rule_ids)
        assignees = list(assignee_ids or [])
        wants_unassigned = self._UNASSIGNED in assignees
        named = [a for a in assignees if a != self._UNASSIGNED]
        if named and not wants_unassigned:
            q = q.in_("assignee_id", named)
        elif wants_unassigned and not named:
            q = q.is_("assignee_id", "null")
        rows = [self._to_task(r) for r in (q.order("start_at").execute().data or [])]
        if named and wants_unassigned:
            # „Zugeordnet an X ODER niemandem" — PostgREST-or wäre möglich, die
            # Nachfilterung ist hier klarer und die Menge ist tenant-begrenzt.
            allowed = set(named)
            rows = [
                t for t in rows if t.assignee_id is None or t.assignee_id in allowed
            ]
        return rows

    @staticmethod
    def _filter_bucket(
        tasks: list[Task], bucket: str | None, tagesende: datetime | None = None
    ) -> list[Task]:
        """current|upcoming|done → die drei Reiter AKTUELL/BEVORSTEHENDE/ABGESCHLOSSEN.

        Die Einteilung ist ZEITLICH, nicht nach Status: eine heute fällige offene
        Aufgabe gehört unter AKTUELL. Vorher entschied allein der Status, wodurch
        jede offene Aufgabe — auch die von gestern — unter BEVORSTEHENDE lag und
        der AKTUELL-Reiter praktisch leer blieb.

        `tagesende` ist der Beginn des NÄCHSTEN Tages beim Nutzer. Alles davor
        ist AKTUELL, alles danach BEVORSTEHEND.

        Ohne diesen Wert wurde gegen `now()` verglichen — ein Zeitpunkt, wo eine
        Tagesgrenze hingehört. Eine heute um 16:00 fällige Aufgabe lag dann
        morgens um 09:00 unter BEVORSTEHEND, zwischen den Aufgaben der nächsten
        Woche; der Reiter widersprach damit dem Satz zwei Absätze weiter oben.
        Live (23.08.2026) traf das 8 von 57 offenen Aufgaben, und alle 49
        Aufgaben auf UTC-Mitternacht zusätzlich im Fenster 00:00–02:00 Ortszeit.

        Die Grenze kommt vom CLIENT und wird hier nicht gerechnet: die Zeitzone
        hängt am Objekt (`properties.timezone`), und eine Liste über mehrere
        Objekte hat keine einzige richtige. Live sind 24 von 43 Objekten ohne
        Zeitzone — eine hier zu unterstellen wäre ein erfundener Wert (Wurzel 4).
        Der Client weiß dagegen sicher, welcher Tag beim Nutzer läuft. Fehlt der
        Wert (ältere App-Fassung), bleibt es beim bisherigen Verhalten.
        """
        if bucket == "done":
            return [
                t
                for t in tasks
                if t.status in (TaskStatus.done, TaskStatus.cancelled)
            ]
        if bucket not in ("current", "upcoming"):
            return tasks
        now = datetime.now(UTC)
        # Ohne Tagesgrenze bleibt es beim alten Verhalten — inklusive `<=`, damit
        # eine Aufgabe genau JETZT weiter unter AKTUELL fällt. Mit Grenze ist
        # `<` richtig: der Tageswechsel selbst gehört schon zum nächsten Tag.
        if tagesende is None:
            offen = [
                t
                for t in tasks
                if t.status not in (TaskStatus.done, TaskStatus.cancelled)
            ]
            if bucket == "current":
                return [t for t in offen if (t.start_at or t.due_at or now) <= now]
            return [t for t in offen if (t.start_at or t.due_at or now) > now]
        grenze = tagesende
        open_tasks = [
            t for t in tasks if t.status not in (TaskStatus.done, TaskStatus.cancelled)
        ]
        if bucket == "current":
            return [t for t in open_tasks if (t.start_at or t.due_at or now) < grenze]
        return [t for t in open_tasks if (t.start_at or t.due_at or now) >= grenze]

    def calendar(
        self,
        tenant_id: str,
        month_from: str,
        month_to: str,
        assignee_ids: list[str] | None = None,
        rule_ids: list[str] | None = None,
    ) -> TaskCalendarResponse:
        """Kalender-Timeline: ALLE Objekte als Zeilen (auch leere) plus eine
        erste Zeile für objektlose Aufgaben. Je Zeile die Aufgaben- und
        Buchungs-Balken im Zeitraum."""
        tasks = self._calendar_tasks(
            tenant_id, month_from, month_to, assignee_ids, rule_ids
        )
        bookings = self._calendar_bookings(tenant_id, month_from, month_to)
        # Alle Objekte des Tenants als Grundgerüst (sortiert nach Titel), damit
        # auch Objekte ohne Aufgaben/Buchungen eine Zeile bekommen.
        props = (
            self._db()
            .table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .order("title")
            .execute()
        ).data or []

        rows: list[TaskCalendarRow] = []
        # Objektlose Aufgaben immer zuerst. Der Zeilentitel bleibt LEER — wie die
        # Zeile heißt, entscheidet die Oberfläche in ihrer Sprache; ein deutsches
        # Wort aus dem Backend wäre in 23 der 24 Sprachen falsch.
        rows.append(
            TaskCalendarRow(
                property_id=None,
                property_title="",
                tasks=[t for t in tasks if not t.property_id],
            )
        )
        for p in props:
            pid = p["id"]
            rows.append(
                TaskCalendarRow(
                    property_id=pid,
                    property_title=p.get("title") or "",
                    tasks=[t for t in tasks if t.property_id == pid],
                    bookings=[b for b in bookings if b.property_id == pid],
                )
            )
        return TaskCalendarResponse(rows=rows)

    def _calendar_tasks(
        self,
        tenant_id: str,
        month_from: str,
        month_to: str,
        assignee_ids: list[str] | None,
        rule_ids: list[str] | None,
    ) -> list[TaskListItem]:
        """Aufgaben, deren Anzeige-Zeitpunkt (start_at ODER Fälligkeit due_at)
        im Monat liegt. PostgREST kann kein coalesce im Filter → breit laden,
        dann in Python auf das effektive Datum filtern (Altdaten haben nur
        due_at, kein start_at — sonst fielen sie aus der Timeline)."""
        rows = self._filtered_tasks(
            tenant_id, assignee_ids=assignee_ids, rule_ids=rule_ids
        )
        von = _als_zeitpunkt(month_from, "month_from")
        bis = _als_zeitpunkt(month_to, "month_to")
        picked = [
            t
            for t in rows
            if (t.start_at or t.due_at)
            and von <= _utc(t.start_at or t.due_at) <= bis
        ]
        picked.sort(key=lambda t: (t.start_at or t.due_at))
        return self._enrich(tenant_id, picked)

    def _calendar_bookings(
        self, tenant_id: str, month_from: str, month_to: str
    ) -> list[CalendarBooking]:
        """Buchungen, die den Zeitraum überlappen (check_in < to AND
        check_out > from). Tenant-scoped; keine Beträge/Gast-PII (§4.3)."""
        rows = (
            self._db()
            .table("reservations")
            .select(
                "id, property_id, channel, ota_name, adults, children, "
                "check_in, check_out, status"
            )
            .eq("tenant_id", tenant_id)
            .neq("status", "cancelled")
            .lt("check_in", month_to)
            .gt("check_out", month_from)
            .execute()
        ).data or []
        out: list[CalendarBooking] = []
        for r in rows:
            out.append(
                CalendarBooking(
                    id=r["id"],
                    property_id=r["property_id"],
                    channel=r["channel"],
                    ota_name=r.get("ota_name"),
                    guests=int(r.get("adults") or 1) + int(r.get("children") or 0),
                    adults=int(r.get("adults") or 1),
                    children=int(r.get("children") or 0),
                    check_in=r["check_in"],
                    check_out=r["check_out"],
                    status=r["status"],
                )
            )
        return out

    def get_detail(
        self, tenant_id: str, task_id: str, ctx: AuthContext | None = None
    ) -> TaskDetail:
        """Aufgaben-Detail. Mit `ctx` gilt derselbe Objekt-Scope wie in
        `list_tasks` — ein Mitarbeiter sieht im Detail nichts, was ihm in der
        Liste verborgen bliebe (Wurzel 9)."""
        row = (
            self._db()
            .table("tasks")
            .select("*")
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        if ctx is not None and is_staff(ctx):
            prop = row[0].get("property_id")
            if prop is not None and prop not in staff_property_ids(self._db(), ctx):
                raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        task = self._to_task(row[0])
        enriched = self._enrich(tenant_id, [task])[0]
        checklist = self._load_checklist(tenant_id, task_id)
        an, ab = self._reservation_zeitraum(tenant_id, task.reservation_id)
        return TaskDetail(
            **enriched.model_dump(),
            checklist=checklist,
            reservation_check_in=an,
            reservation_check_out=ab,
            costs=self._load_costs(tenant_id, task_id, ctx),
            cost_currency=self._kosten_waehrung(tenant_id, task.property_id),
            resolution=self._load_resolution(tenant_id, task_id),
        )

    def _reservation_zeitraum(
        self, tenant_id: str, reservation_id: str | None
    ) -> tuple[str | None, str | None]:
        """An- und Abreisetag der Buchung einer Aufgabe.

        NUR die zwei Kalendertage — kein Gastname, kein Betrag, kein Kanal
        (§4.3). Für die ausführende Person ist „ab wann ist das Objekt frei"
        die eigentliche Arbeitsangabe; sie stand ihr bisher nirgends.
        Tenant-gescopt (Wurzel 3): die Buchung wird über tenant_id UND id
        geladen, nicht über die id allein.
        """
        if not reservation_id:
            return None, None
        rows = (
            self._db()
            .table("reservations")
            .select("check_in, check_out")
            .eq("tenant_id", tenant_id)
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return None, None
        return rows[0].get("check_in"), rows[0].get("check_out")

    # --- Vierter Arbeitszustand: annehmen / anfangen (0360) ----------------

    # Erlaubte Wechsel. Aus `done` führt genau EIN Weg zurück (open) — das ist
    # das Zurücknehmen eines Abschlusses. Aus `cancelled` ebenso.
    _STATUS_WECHSEL: dict[str, frozenset[str]] = {
        TaskStatus.open.value: frozenset(
            {
                TaskStatus.accepted.value,
                TaskStatus.in_progress.value,
                TaskStatus.done.value,
                TaskStatus.cancelled.value,
            }
        ),
        TaskStatus.accepted.value: frozenset(
            {
                TaskStatus.open.value,
                TaskStatus.in_progress.value,
                TaskStatus.done.value,
                TaskStatus.cancelled.value,
            }
        ),
        TaskStatus.in_progress.value: frozenset(
            {
                TaskStatus.open.value,
                TaskStatus.accepted.value,
                TaskStatus.done.value,
                TaskStatus.cancelled.value,
            }
        ),
        TaskStatus.done.value: frozenset({TaskStatus.open.value}),
        TaskStatus.cancelled.value: frozenset({TaskStatus.open.value}),
    }

    def set_status(
        self,
        tenant_id: str,
        task_id: str,
        status: TaskStatus,
        ctx: AuthContext | None = None,
    ) -> TaskDetail:
        """Arbeitszustand setzen — DER eine Weg für jeden Statuswechsel.

        Bis 0360 gab es hier ein blindes `update`: es schrieb jeden Wert, auch
        `done`. Damit lief der Abschluss am Foto-Zwang und an der Inspektions-
        Folge vorbei, die in `complete_task` hängen — die Foto-Pflicht war über
        diesen Endpunkt eine Empfehlung (Wurzel 5). Jetzt delegiert das Ziel
        `done` an genau diesen Pfad; es gibt keinen zweiten Abschluss mehr.

        Scope wie `get_detail` (Wurzel 9). Ein fachlich unmöglicher Sprung wird
        abgelehnt statt still geschrieben — sonst stünde in der Historie ein
        Zustand, den nie jemand erreichen konnte.
        """
        detail = self.get_detail(tenant_id, task_id, ctx)
        aktuell = detail.status.value
        if aktuell == status.value:
            # Idempotent (Wurzel 2): Doppeltipp auf dem Telefon ist kein Fehler.
            return detail
        erlaubt = self._STATUS_WECHSEL.get(aktuell, frozenset())
        if status.value not in erlaubt:
            raise TaskError(
                f"Wechsel von '{aktuell}' nach '{status.value}' ist nicht vorgesehen.",
                status_code=422,
            )
        if status is TaskStatus.done:
            nutzer = ctx.user_id if ctx else (detail.assignee_id or "")
            return self.complete_task(tenant_id, task_id, nutzer, ctx)
        patch: dict[str, object] = {"status": status.value}
        if aktuell == TaskStatus.done.value:
            # Gegenzustand zum Abschluss (Wurzel 1): wer den Haken zurücknimmt,
            # nimmt auch Zeitpunkt und Urheber zurück. Sonst trüge eine offene
            # Aufgabe weiter ein „abgeschlossen am …" mit sich herum.
            patch["completed_at"] = None
            patch["completed_by"] = None
            patch["inspection_state"] = None
        self._db().table("tasks").update(patch).eq("id", task_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "task_status_gesetzt",
            tenant_id=tenant_id, task_id=task_id, von=aktuell, nach=status.value,
        )
        return self.get_detail(tenant_id, task_id, ctx)

    # --- Zuständigen setzen -----------------------------------------------

    def moegliche_zustaendige(
        self, tenant_id: str, property_id: str | None = None
    ) -> list[TaskAssigneeOption]:
        """Wer kann überhaupt Zuständige:r einer Aufgabe sein?

        NICHT alle Nutzer des Betriebs. Ein `owner` hat `VIEW_OWN_TASKS`
        nicht — er könnte eine ihm zugewiesene Aufgabe nie öffnen. Ihn zur
        Auswahl zu stellen erzeugt eine Zuweisung, die im Nichts endet: live
        standen 11 Aufgaben auf Eigentümer-Konten, die sie nie zu sehen
        bekamen, und die Auswahlliste zeigte 23 Eigentümer neben 2 wirklich
        berechtigten Personen.

        Die Menge kommt aus der CAPABILITY, nicht aus einer hier
        abgeschriebenen Rollenliste: wer `VIEW_OWN_TASKS` hat, kann eine
        Aufgabe annehmen und abschließen. Verschiebt sich die Rechte-Matrix,
        verschiebt sich diese Liste mit — eine kopierte Rollenmenge wäre die
        Stelle, an der beide auseinanderlaufen.

        Gesperrte Zugänge fallen raus (`deactivated_at`): wer sich nicht
        anmelden kann, erledigt nichts.

        Mit `property_id` fällt zusätzlich raus, wer für DIESES Objekt keine
        Freigabe hat — dieselbe Prüfung, die `_require_own_assignee` beim
        Schreiben macht. Ohne sie stünde jemand zur Auswahl, dessen Wahl
        anschließend mit 422 abgelehnt wird: die Liste verspräche etwas, das
        der Schreibpfad verweigert. Bei der Massen-Zuweisung wäre es schlimmer
        — dort verschwinden die Einzelgründe hinter einem „N übersprungen".
        """
        rows = (
            self._db()
            .table("users")
            .select("id, email, full_name, role, deactivated_at")
            .eq("tenant_id", tenant_id)
            .order("full_name")
            .execute()
        ).data or []
        # Nur einmal laden, nicht je Nutzer (die Liste hat schnell 25 Zeilen).
        freigegeben: set[str] | None = None
        if property_id is not None:
            freigegeben = {
                str(r["user_id"])
                for r in (
                    self._db()
                    .table("staff_property_assignments")
                    .select("user_id")
                    .eq("tenant_id", tenant_id)
                    .eq("property_id", property_id)
                    .execute()
                ).data
                or []
            }
        optionen: list[TaskAssigneeOption] = []
        for r in rows:
            if r.get("deactivated_at"):
                continue
            rolle = str(r.get("role") or "")
            try:
                darf = has_capability(UserRole(rolle), Capability.VIEW_OWN_TASKS)
            except ValueError:
                # Unbekannte Rolle: fail-closed (Wurzel 6). Lieber jemand
                # fehlt in der Liste, als dass eine Aufgabe bei einem Konto
                # landet, dessen Rechte niemand kennt.
                darf = False
            if not darf:
                continue
            if (
                freigegeben is not None
                and rolle in _STAFF_ROLLEN
                and str(r["id"]) not in freigegeben
            ):
                continue
            optionen.append(
                TaskAssigneeOption(
                    user_id=str(r["id"]),
                    full_name=r.get("full_name"),
                    email=r.get("email"),
                    role=rolle,
                )
            )
        return optionen

    def set_assignee(
        self,
        tenant_id: str,
        task_id: str,
        assignee_id: str | None,
        ctx: AuthContext | None = None,
    ) -> TaskDetail:
        """Zuständigen einer bestehenden Aufgabe setzen, wechseln oder abziehen.

        Bis hierher war `assignee_id` ein Einweg-Feld: gesetzt beim Anlegen,
        danach nie wieder beschreibbar. Eine Fehlzuweisung ließ sich nur
        beheben, indem man die Aufgabe löschte und neu anlegte — mitsamt
        Checkliste, Fotos und Historie.

        Scope wie `get_detail` (Wurzel 9), Empfänger-Prüfung inklusive
        Objekt-Freigabe (`_require_own_assignee`).

        Beide Meldungen tragen einen `vorgang`-Stempel: ohne ihn liefe ein
        Wechsel A→B→A in die Entdopplung. Der Schlüssel enthält zwar den
        Empfänger, aber der UNIQUE-Index greift über OFFENE Meldungen — A's
        zweite Zuweisung träfe auf seine erste, noch ungelesene, und fiele
        samt Mail aus. Der Zeitstempel macht jeden Wechsel unterscheidbar.
        """
        detail = self.get_detail(tenant_id, task_id, ctx)
        neu = assignee_id or None
        alt = detail.assignee_id or None
        if neu == alt:
            # Idempotent (Wurzel 2): derselbe Empfänger ist kein Wechsel — und
            # löst deshalb auch keine zweite Mail aus.
            return detail
        self._require_own_assignee(tenant_id, neu, detail.property_id)
        self._db().table("tasks").update({"assignee_id": neu}).eq(
            "id", task_id
        ).eq("tenant_id", tenant_id).execute()
        # Ein Stempel je Wechsel — nicht je Empfänger (siehe Docstring).
        vorgang = datetime.now(UTC).isoformat(timespec="seconds")
        log.info(
            "task_zustaendiger_gesetzt",
            tenant_id=tenant_id, task_id=task_id, von=alt, nach=neu,
        )
        melde_aufgaben_zuweisung(
            self._db(),
            tenant_id=tenant_id,
            task_id=task_id,
            assignee_id=neu,
            titel=detail.title,
            property_id=detail.property_id,
            vorgang=vorgang,
        )
        # Der bisherige Zuständige erfährt, dass die Aufgabe weg ist (Wurzel 1):
        # sie verschwindet sonst wortlos aus seiner Liste, und er hält sie
        # womöglich weiter für seine.
        if alt:
            melde_aufgaben_entzug(
                self._db(),
                tenant_id=tenant_id,
                task_id=task_id,
                assignee_id=alt,
                titel=detail.title,
                property_id=detail.property_id,
                vorgang=vorgang,
            )
        return self.get_detail(tenant_id, task_id, ctx)

    def bulk_assign(
        self,
        tenant_id: str,
        ids: list[str],
        assignee_id: str | None,
        ctx: AuthContext | None = None,
    ) -> dict[str, int]:
        """Mehrere Aufgaben auf einmal zuweisen.

        Jede Aufgabe läuft durch denselben Einzelpfad — inklusive Scope- und
        Freigabe-Prüfung (Wurzel 9). Was daran scheitert, wird gezählt statt
        den ganzen Aufruf zu kippen: bei 40 markierten Zeilen ist „drei davon
        gingen nicht" brauchbarer als ein pauschaler 422.
        """
        sauber = self._clean_bulk_ids(ids)
        zugewiesen = 0
        uebersprungen = 0
        for task_id in sauber:
            try:
                self.set_assignee(tenant_id, task_id, assignee_id, ctx)
                zugewiesen += 1
            except TaskError:
                uebersprungen += 1
        log.info(
            "tasks_bulk_zugewiesen",
            tenant_id=tenant_id, zugewiesen=zugewiesen, uebersprungen=uebersprungen,
        )
        return {"assigned": zugewiesen, "skipped": uebersprungen}

    # --- Checklisten-Punkt abhaken (0360) ---------------------------------

    def toggle_checklist_item(
        self,
        tenant_id: str,
        item_id: str,
        done: bool,
        ctx: AuthContext | None = None,
    ) -> TaskDetail:
        """Einen Punkt abhaken oder das Häkchen zurücknehmen.

        Der Punkt hängt an einer Aufgabe, und die Aufgabe trägt den Scope:
        erst wird sie über `get_detail` geladen (Tenant + Objekt-Freigabe,
        Wurzel 9), dann erst geschrieben. Ohne diesen Umweg wäre die item_id
        allein der Schlüssel — und damit jeder fremde Punkt abhakbar.

        `done_at`/`done_by` schreiben mit: ein Haken ohne Absender ist beim
        Reinigungsnachweis wertlos. Beim Zurücknehmen werden sie geleert, damit
        keine Spur von einem Abhaken stehen bleibt, das zurückgenommen wurde
        (Wurzel 1).
        """
        rows = (
            self._db()
            .table("checklist_items")
            .select("id, task_id")
            .eq("id", item_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise TaskError("Punkt nicht gefunden.", status_code=404)
        task_id = rows[0]["task_id"]
        # Wirft 404, wenn die Aufgabe nicht zum Mandanten gehört oder außerhalb
        # der Objekt-Freigabe liegt.
        self.get_detail(tenant_id, task_id, ctx)
        patch: dict[str, object] = {"done": done}
        patch["done_at"] = datetime.now(UTC).isoformat() if done else None
        patch["done_by"] = (ctx.user_id if ctx else None) if done else None
        self._db().table("checklist_items").update(patch).eq(
            "id", item_id
        ).execute()
        return self.get_detail(tenant_id, task_id, ctx)

    # --- Kosten (0360) ----------------------------------------------------

    def _kosten_waehrung(
        self, tenant_id: str, property_id: str | None
    ) -> str | None:
        return waehrung_fuer_aufgabe(self._db(), tenant_id, property_id)

    def _load_costs(
        self, tenant_id: str, task_id: str, ctx: AuthContext | None
    ) -> list[TaskCost]:
        return kosten_laden(
            self._db(), tenant_id, task_id, ctx, self._user_names
        )

    def add_cost(
        self,
        tenant_id: str,
        task_id: str,
        req: TaskCostCreate,
        ctx: AuthContext,
    ) -> TaskDetail:
        """Eine Auslage erfassen. Währung kommt aus den Daten, nie vom Client."""
        detail = self.get_detail(tenant_id, task_id, ctx)
        waehrung = self._kosten_waehrung(tenant_id, detail.property_id)
        if not waehrung:
            raise TaskError(
                "Für dieses Objekt ist keine Währung hinterlegt — Auslagen "
                "lassen sich erst danach erfassen.",
                status_code=422,
            )
        kosten_einfuegen(self._db(), tenant_id, task_id, req, ctx, waehrung)
        log.info("task_kosten_erfasst", tenant_id=tenant_id, task_id=task_id)
        return self.get_detail(tenant_id, task_id, ctx)

    def delete_cost(
        self, tenant_id: str, cost_id: str, ctx: AuthContext
    ) -> TaskDetail:
        """Auslage entfernen.

        Wer sie erfasst hat, darf sie zurücknehmen; die Konto-Führung darf jede.
        Ein Mitarbeiter, der fremde Auslagen löschen könnte, wäre die Kehrseite
        des Lese-Filters — dann hätte der Filter nichts geschützt.
        """
        zeile = kosten_zeile(self._db(), tenant_id, cost_id)
        if not zeile:
            raise TaskError("Auslage nicht gefunden.", status_code=404)
        if is_staff(ctx) and zeile.get("created_by") != ctx.user_id:
            raise TaskError("Auslage nicht gefunden.", status_code=404)
        task_id = zeile["task_id"]
        self.get_detail(tenant_id, task_id, ctx)
        kosten_entfernen(self._db(), tenant_id, cost_id)
        return self.get_detail(tenant_id, task_id, ctx)

    # --- Abschluss-Rückmeldung (0360) -------------------------------------

    def _load_resolution(
        self, tenant_id: str, task_id: str
    ) -> TaskResolution | None:
        return rueckmeldung_laden(
            self._db(), tenant_id, task_id, self._user_names
        )

    def set_resolution(
        self,
        tenant_id: str,
        task_id: str,
        req: TaskResolutionUpsert,
        ctx: AuthContext,
        *,
        darf_benoten: bool,
    ) -> TaskDetail:
        """Rückmeldung zum Ergebnis setzen (genau eine je Aufgabe).

        ``darf_benoten`` trennt zwei Rollen sauber: die zuständige Person darf
        BERICHTEN, wie es gelaufen ist (Hostaway: „get feedback from the task
        assignee"), aber nicht sich selbst benoten — eine Selbstbenotung sagt
        über die Leistung nichts. Die Note setzt die Konto-Führung.
        """
        self.get_detail(tenant_id, task_id, ctx)
        notiz = (req.note or "").strip() or None
        if req.score is not None and not darf_benoten:
            raise TaskError(
                "Die Bewertung vergibt die Konto-Führung.", status_code=403
            )
        if notiz is None and req.score is None:
            raise TaskError(
                "Eine Rückmeldung braucht einen Text oder eine Bewertung.",
                status_code=422,
            )
        rueckmeldung_schreiben(self._db(), tenant_id, task_id, req, ctx, notiz)
        log.info(
            "task_rueckmeldung_gesetzt",
            tenant_id=tenant_id, task_id=task_id, mit_note=req.score is not None,
        )
        return self.get_detail(tenant_id, task_id, ctx)

    def _load_checklist(
        self, tenant_id: str, task_id: str
    ) -> list[ChecklistItem]:
        items = (
            self._db()
            .table("checklist_items")
            .select("*")
            .eq("task_id", task_id)
            .order("sort_order")
            .execute()
        ).data or []
        photos = self._photos_by_item({r["id"] for r in items})
        # Wer abgehakt hat, steht als Name daneben (0360) — eine user_id sagt
        # der Person vor Ort nichts.
        namen = self._user_names(
            tenant_id, {r.get("done_by") for r in items if r.get("done_by")}
        )
        return [
            ChecklistItem(
                id=r["id"],
                task_id=r["task_id"],
                label=r["label"],
                room=r.get("room"),
                done=bool(r.get("done")),
                requires_photo=bool(r.get("requires_photo")),
                sort_order=int(r.get("sort_order") or 0),
                photos=photos.get(r["id"], []),
                photo_urls=[
                    url
                    for pfad in photos.get(r["id"], [])
                    if (url := sign_task_photo(self._db(), pfad))
                ],
                done_at=r.get("done_at"),
                done_by=r.get("done_by"),
                done_by_name=namen.get(r.get("done_by") or ""),
            )
            for r in items
        ]

    def _photos_by_item(self, item_ids: set[str]) -> dict[str, list[str]]:
        clean = {i for i in item_ids if i}
        if not clean:
            return {}
        res = (
            self._db()
            .table("checklist_photos")
            .select("item_id, storage_path")
            .in_("item_id", list(clean))
            .execute()
        )
        out: dict[str, list[str]] = {}
        for r in res.data or []:
            out.setdefault(r["item_id"], []).append(r["storage_path"])
        return out

    # --- Abschluss mit Foto-Pflicht + Inspektion ---

    def complete_task(
        self,
        tenant_id: str,
        task_id: str,
        user_id: str,
        ctx: AuthContext | None = None,
    ) -> TaskDetail:
        """Aufgabe abschließen. Alle requires_photo-Items MÜSSEN ein Foto haben
        (sonst 422). Bei needs_inspection → inspection_state='to_review'.
        Mit `ctx` gilt der Objekt-Scope aus `list_tasks` (Wurzel 9) — sonst
        könnte ein Mitarbeiter fremde Aufgaben abschließen."""
        detail = self.get_detail(tenant_id, task_id, ctx)
        missing = [
            i for i in detail.checklist if i.requires_photo and not i.photos
        ]
        if missing:
            raise TaskError(
                "Foto-Pflicht: Für jeden markierten Punkt ist ein Foto nötig.",
                status_code=422,
            )
        update: dict[str, object] = {
            "status": TaskStatus.done.value,
            "completed_at": "now()",
            "completed_by": user_id,
        }
        if detail.needs_inspection:
            update["inspection_state"] = InspectionState.to_review.value
        res = (
            self._db()
            .table("tasks")
            .update(update)
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        # Hat ein EIGENTÜMER diese Leistung beauftragt (0330), erfährt er von
        # ihrem Abschluss (Kategorie `owner_service`, 0331). Nur dann — eine
        # gewöhnliche Betriebsaufgabe geht ihn nichts an (§4.3). Best-effort;
        # die Funktion fängt intern breit (Wurzel 5).
        melde_dienstleistung_erledigt(
            self._db(),
            tenant_id=tenant_id,
            task_id=task_id,
            zeile=res.data[0],
        )
        return self.get_detail(tenant_id, task_id, ctx)

    def list_inspection(
        self, tenant_id: str, tab: str, property_ids: list[str] | None = None
    ) -> list[InspectionItem]:
        """Inspektions-Tabs: to_review | reviewed | upcoming (needs_inspection,
        noch nicht abgeschlossen)."""
        q = self._db().table("tasks").select("*").eq("tenant_id", tenant_id)
        if property_ids:
            q = q.in_("property_id", property_ids)
        if tab == "reviewed":
            q = q.eq("inspection_state", "reviewed")
        elif tab == "upcoming":
            q = q.eq("needs_inspection", True).neq("status", TaskStatus.done.value)
        else:  # to_review
            q = q.eq("inspection_state", "to_review")
        rows = [self._to_task(r) for r in (q.order("end_at").execute().data or [])]
        enriched = self._enrich(tenant_id, rows)
        # Fotos je Aufgabe als SIGNIERTE URLs. Vorher stand hier der reine
        # Storage-Pfad — die Oberfläche konnte damit kein Bild anzeigen, und eine
        # Inspektion ohne sichtbaren Nachweis prüft nichts.
        out: list[InspectionItem] = []
        for item in enriched:
            checklist = self._load_checklist(tenant_id, item.id)
            urls = [
                url
                for c in checklist
                for p in c.photos
                if (url := sign_task_photo(self._db(), p))
            ]
            out.append(InspectionItem(**item.model_dump(), photos=urls))
        return out

    # --- Massenaktionen (Lodgify: Auswahl + ✓/🗑 unten rechts) ---

    #: Obergrenze je Massenaktion (Wurzel 8 — kein unbegrenzter Bereich).
    BULK_MAX = 200

    def bulk_complete(
        self, tenant_id: str, task_ids: list[str], user_id: str, ctx: AuthContext
    ) -> dict[str, int]:
        """Mehrere Aufgaben abschließen. Jede EINZELN über `complete_task` —
        damit gelten Objekt-Scope (Wurzel 9), Foto-Pflicht und der
        Inspektions-Übergang genauso wie beim einzelnen Abschluss."""
        ids = self._clean_bulk_ids(task_ids)
        done = 0
        skipped: list[str] = []
        for task_id in ids:
            try:
                self.complete_task(tenant_id, task_id, user_id, ctx)
                done += 1
            except TaskError:
                # Fehlendes Pflichtfoto oder fremdes Objekt: diese eine Aufgabe
                # bleibt offen, die übrigen laufen durch. Der Zähler sagt, wie
                # viele — still „alle erledigt" zu melden wäre eine Lüge.
                skipped.append(task_id)
        return {"completed": done, "skipped": len(skipped)}

    def bulk_delete(
        self, tenant_id: str, task_ids: list[str], ctx: AuthContext
    ) -> dict[str, int]:
        """Mehrere Aufgaben löschen. Der Objekt-Scope wird je Aufgabe geprüft
        (Wurzel 9) — sonst löschte ein Mitarbeiter über die Massenaktion, was er
        einzeln nicht einmal sehen darf."""
        ids = self._clean_bulk_ids(task_ids)
        allowed = [i for i in ids if self._may_touch(tenant_id, i, ctx)]
        if allowed:
            self._db().table("tasks").delete().eq("tenant_id", tenant_id).in_(
                "id", allowed
            ).execute()
        return {"deleted": len(allowed), "skipped": len(ids) - len(allowed)}

    def _clean_bulk_ids(self, task_ids: list[str]) -> list[str]:
        ids = list(dict.fromkeys(i for i in task_ids if i))
        if not ids:
            raise TaskError("Keine Aufgaben ausgewählt.", status_code=422)
        if len(ids) > self.BULK_MAX:
            raise TaskError(
                f"Höchstens {self.BULK_MAX} Aufgaben je Aktion.", status_code=422
            )
        return ids

    def _may_touch(self, tenant_id: str, task_id: str, ctx: AuthContext) -> bool:
        try:
            self.get_detail(tenant_id, task_id, ctx)
        except TaskError:
            return False
        return True

    def inspect(
        self, tenant_id: str, task_id: str, decision: InspectionDecision
    ) -> TaskDetail:
        """Freigeben (reviewed) oder zurückweisen (zurück auf to_review +
        Status offen zur Nachbearbeitung)."""
        if decision.approved:
            update: dict[str, object] = {
                "inspection_state": InspectionState.reviewed.value
            }
        else:
            update = {
                "inspection_state": InspectionState.to_review.value,
                "status": TaskStatus.open.value,
            }
        res = (
            self._db()
            .table("tasks")
            .update(update)
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        return self.get_detail(tenant_id, task_id)

    # --- Regeln / Vorlagen (task_rules kind=template|auto|recurring) ---

    # Trigger, die am ANREISE-Anker hängen; alles andere hängt an der Abreise.
    _ANREISE_TRIGGER = frozenset(
        {"check_in", "days_before_check_in", "after_check_in_24h", "booking_confirmed"}
    )

    def regel_deckung(self, tenant_id: str) -> RegelDeckung:
        """Objekte OHNE wirksame planmäßige Regel — getrennt nach An- und Abreise.

        Die Frage, die niemand stellt, bis eine Aufgabe fehlt: greift für jedes
        Objekt überhaupt eine Regel? Eine Regel ohne Objekt-Zuordnung gilt für
        alle; sobald ihr eines zugeordnet ist, gilt sie NUR für die gelisteten.
        Ein später angelegtes Objekt fällt damit still heraus — und ein neu
        angelegter Betrieb hat gar keine Regel, bekommt also nie eine Aufgabe,
        ohne dass irgendwo ein Hinweis steht.
        """
        db = self._db()
        rules = (
            db.table("task_rules")
            .select("id, start_trigger")
            .eq("tenant_id", tenant_id)
            .eq("kind", TaskRuleKind.auto.value)
            .eq("active", True)
            .not_.is_("start_trigger", "null")
            .execute()
        ).data or []
        # ARCHIVIERTE Objekte bleiben draußen (0416): ein gekündigtes Objekt
        # wird nicht mehr vermietet und braucht keine Regel. Ohne diesen Filter
        # bliebe der Hinweis dauerhaft stehen und wäre nach kurzer Zeit
        # Hintergrundrauschen, das niemand mehr liest — live betraf das
        # „Fewo-Mosbjerg-Sindal", am 21.08. archiviert.
        # ENTWÜRFE bleiben drin: ein Entwurf geht irgendwann live, und dann soll
        # die Regel schon greifen.
        props = (
            db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .is_("archived_at", "null")
            .order("title")
            .execute()
        ).data or []
        zuordnung = self._rule_property_ids({str(r["id"]) for r in rules})

        # Je Achse: die Objekte, die von mindestens einer Regel erreicht werden.
        # `alle` = es gibt eine Regel ohne Zuordnung, die damit jedes Objekt
        # trifft (auch jedes künftige).
        gedeckt: dict[str, set[str]] = {"anreise": set(), "abreise": set()}
        alle: dict[str, bool] = {"anreise": False, "abreise": False}
        for rule in rules:
            achse = (
                "anreise"
                if str(rule.get("start_trigger")) in self._ANREISE_TRIGGER
                else "abreise"
            )
            ids = zuordnung.get(str(rule["id"])) or []
            if ids:
                gedeckt[achse].update(str(i) for i in ids)
            else:
                alle[achse] = True

        betroffen: list[UngedecktesObjekt] = []
        for p in props:
            pid = str(p["id"])
            ohne_anreise = not alle["anreise"] and pid not in gedeckt["anreise"]
            ohne_abreise = not alle["abreise"] and pid not in gedeckt["abreise"]
            if ohne_anreise or ohne_abreise:
                betroffen.append(
                    UngedecktesObjekt(
                        property_id=pid,
                        property_title=str(p.get("title") or ""),
                        ohne_anreise=ohne_anreise,
                        ohne_abreise=ohne_abreise,
                    )
                )
        return RegelDeckung(
            objekte=len(props),
            ohne_anreise=sum(1 for b in betroffen if b.ohne_anreise),
            ohne_abreise=sum(1 for b in betroffen if b.ohne_abreise),
            betroffen=betroffen,
        )

    def list_rules(self, tenant_id: str, kind: TaskRuleKind) -> list[RuleListItem]:
        rows = (
            self._db()
            .table("task_rules")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("kind", kind.value)
            .order("updated_at", desc=True)
            .execute()
        ).data or []
        ids = [r["id"] for r in rows]
        counts = self._rule_item_counts(tenant_id, set(ids))
        prop_map = self._rule_property_ids(set(ids))
        names = self._user_names(
            tenant_id, {r.get("assignee_id") for r in rows if r.get("assignee_id")}
        )
        return [self._to_rule_list(r, counts, prop_map, names) for r in rows]

    def _to_rule_list(
        self,
        r: dict[str, object],
        counts: dict[str, int],
        prop_map: dict[str, list[str]],
        names: dict[str, str],
    ) -> RuleListItem:
        aid = r.get("assignee_id")
        return RuleListItem(
            id=r["id"],
            kind=TaskRuleKind(r["kind"]),
            name=r["name"],
            active=bool(r.get("active")),
            priority=int(r.get("priority") or 0),
            assignee_id=aid,
            assignee_name=names.get(aid or ""),
            needs_inspection=bool(r.get("needs_inspection")),
            item_count=counts.get(r["id"], 0),
            property_ids=prop_map.get(r["id"], []),
            schedule_label=schedule_label(r.get("recurrence") or {}),
            updated_at=r.get("updated_at"),
        )

    def _rule_item_counts(
        self, tenant_id: str, rule_ids: set[str]
    ) -> dict[str, int]:
        if not rule_ids:
            return {}
        res = (
            self._db()
            .table("task_rule_items")
            .select("rule_id")
            .eq("tenant_id", tenant_id)
            .in_("rule_id", list(rule_ids))
            .execute()
        )
        out: dict[str, int] = {}
        for r in res.data or []:
            out[r["rule_id"]] = out.get(r["rule_id"], 0) + 1
        return out

    def _rule_property_ids(self, rule_ids: set[str]) -> dict[str, list[str]]:
        """Objekt-Zuordnung je Regel (task_rule_assignments). Keine tenant_id auf
        der Join-Tabelle — rule_ids sind bereits tenant-gefiltert (Wurzel 3)."""
        if not rule_ids:
            return {}
        res = (
            self._db()
            .table("task_rule_assignments")
            .select("rule_id, property_id")
            .in_("rule_id", list(rule_ids))
            .execute()
        )
        out: dict[str, list[str]] = {}
        for r in res.data or []:
            out.setdefault(r["rule_id"], []).append(r["property_id"])
        return out

    def get_rule(self, tenant_id: str, rule_id: str) -> RuleDetail:
        rows = (
            self._db()
            .table("task_rules")
            .select("*")
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TaskError("Regel nicht gefunden.", status_code=404)
        r = rows[0]
        counts = self._rule_item_counts(tenant_id, {rule_id})
        prop_map = self._rule_property_ids({rule_id})
        names = self._user_names(
            tenant_id, {r.get("assignee_id")} if r.get("assignee_id") else set()
        )
        base = self._to_rule_list(r, counts, prop_map, names)
        template_id = r.get("template_rule_id")
        return RuleDetail(
            **base.model_dump(),
            description=r.get("description"),
            remove_on_cancellation=bool(r.get("remove_on_cancellation")),
            recurrence=r.get("recurrence") or {},
            items=self._load_rule_items(tenant_id, rule_id),
            template_rule_id=template_id,
            template_name=self._template_name(tenant_id, template_id),
            start_trigger=r.get("start_trigger"),
            end_trigger=r.get("end_trigger"),
            start_offset_minutes=int(r.get("start_offset_minutes") or 0),
            end_offset_minutes=int(r.get("end_offset_minutes") or 0),
            starts_on=r.get("starts_on"),
            ends_on=r.get("ends_on"),
            start_time=r.get("start_time"),
            duration_minutes=r.get("duration_minutes"),
        )

    def _template_name(self, tenant_id: str, template_id: str | None) -> str | None:
        """Anzeigename der verknüpften Vorlage. Fehlt sie (gelöscht), bleibt das
        Feld leer statt einen Platzhalter zu erfinden (Wurzel 4)."""
        if not template_id:
            return None
        rows = (
            self._db()
            .table("task_rules")
            .select("name")
            .eq("id", template_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return rows[0]["name"] if rows else None

    def _load_rule_items(self, tenant_id: str, rule_id: str) -> list[RuleItem]:
        rows = (
            self._db()
            .table("task_rule_items")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("rule_id", rule_id)
            .order("sort_order")
            .execute()
        ).data or []
        return [
            RuleItem(
                id=r["id"],
                label=r["label"],
                description=r.get("description"),
                room=r.get("room"),
                requires_photo=bool(r.get("requires_photo")),
                sort_order=int(r.get("sort_order") or 0),
            )
            for r in rows
        ]

    def create_rule(self, tenant_id: str, req: RuleCreate) -> RuleDetail:
        self._require_own_properties(tenant_id, req.property_ids)
        # Mit Objektbezug prüfen (wie in `update_rule`): ohne ihn bleibt es eine
        # nackte Existenzabfrage, und die Regel erzeugt später Aufgaben an einem
        # Objekt, für das der Zuständige nicht freigegeben ist.
        self._require_own_assignee(
            tenant_id, req.assignee_id, (req.property_ids or [None])[0]
        )
        self._require_own_template(tenant_id, req.template_rule_id)
        row = self._insert("task_rules", self._rule_payload(tenant_id, req))
        self._replace_rule_children(tenant_id, row["id"], req)
        self._regel_nachziehen(tenant_id, str(row["id"]))
        return self.get_rule(tenant_id, row["id"])

    def update_rule(
        self, tenant_id: str, rule_id: str, req: RuleUpdate
    ) -> RuleDetail:
        self._require_own_properties(tenant_id, req.property_ids)
        # Objektbezug MITGEBEN: ohne ihn ist die Prüfung eine nackte
        # Existenzabfrage (siehe `_require_own_assignee`), und ein Zuständiger
        # ohne Freigabe für das Objekt bekäme die Regel zugewiesen, ohne ihre
        # Aufgaben je zu sehen.
        self._require_own_assignee(
            tenant_id,
            req.assignee_id,
            (req.property_ids or [None])[0],
        )
        if req.template_rule_id == rule_id:
            raise TaskError(
                "Eine Regel kann nicht ihre eigene Vorlage sein.", status_code=422
            )
        self._require_own_template(tenant_id, req.template_rule_id)
        # ALT-Zustand VOR dem Update sichern (Wurzel 1): wer den Zuständigen
        # einer Regel wechselt, muss die schon erzeugten Aufgaben mitziehen.
        vorher = (
            self._db()
            .table("task_rules")
            .select("assignee_id")
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        alter_zustaendiger = str(vorher[0].get("assignee_id") or "") if vorher else ""
        res = (
            self._db()
            .table("task_rules")
            .update(self._rule_payload(tenant_id, req))
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Regel nicht gefunden.", status_code=404)
        self._replace_rule_children(tenant_id, rule_id, req)
        self._zustaendigen_nachziehen(
            tenant_id, rule_id, alter_zustaendiger, req.assignee_id
        )
        self._regel_nachziehen(tenant_id, rule_id)
        return self.get_rule(tenant_id, rule_id)

    def _regel_nachziehen(self, tenant_id: str, rule_id: str) -> None:
        """Fehlende Aufgaben dieser Regel für BESTEHENDE Buchungen anlegen.

        Der Gegenzustand zum Speichern einer Regel (Wurzel 1). Eine planmäßige
        Aufgabe entstand bisher nur im Moment des Reservierungs-Schreibens —
        wer eine Regel nach einer Buchung anlegte oder ihr später ein Objekt
        zuordnete, bekam für diese Buchung nie eine Aufgabe.

        LIVE PASSIERT (23.08.2026): Buchung „Feriehus Britt" vom 10.08., Anreise
        23.08., ohne Anreise-Aufgabe — die Regel „Velk T" wurde erst am 13.08.
        angelegt. Gemeldet als „heute ist eine Anreise, dazu gibt es keine
        Aufgabe".

        Best-effort (Wurzel 5): die Regel IST gespeichert. Ein Fehler hier darf
        den Aufrufer nicht glauben lassen, das Speichern sei misslungen — er
        würde es wiederholen. Der stündliche Tick holt den Nachzug ohnehin.
        """
        try:
            nachziehen_planmaessig(
                self._db(),
                tenant_id,
                today=datetime.now(UTC).date(),
                rule_id=rule_id,
            )
        except APIError:  # noqa: BLE001 - Nachzug, nicht der Hauptpfad
            log.exception(
                "regel_aufgaben_nachziehen_fehlgeschlagen",
                extra={"rule_id": rule_id},
            )

    def _zustaendigen_nachziehen(
        self, tenant_id: str, rule_id: str, alt: str, neu: str | None
    ) -> None:
        """Offene Aufgaben einer Regel dem NEUEN Zuständigen zuordnen.

        Der Gegenzustand zum Regel-Update (Wurzel 1). Ohne diesen Schritt bleibt
        eine bereits erzeugte Aufgabe beim alten Zuständigen stehen, während die
        Regel längst auf jemand anderen zeigt.

        LIVE PASSIERT (23.08.2026 gemessen): eine Regel „Velk T" zeigte auf ein
        EIGENTÜMER-Konto, erzeugte 17 Aufgaben und wurde am 20.08. auf den
        richtigen Verwalter korrigiert. Die 17 Aufgaben blieben am Eigentümer —
        und ein `owner` hat kein `VIEW_OWN_TASKS`, kann sie also nie öffnen.
        15 davon standen offen: Arbeit, die niemand sehen konnte. Gemeldet wurde
        das als „es werden nicht alle Aufgaben angezeigt".

        NUR OFFENE: eine abgeschlossene Aufgabe ist ein Protokoll darüber, wer
        sie erledigt hat. Sie umzuhängen würde die Historie verfälschen — dann
        stünde jemand als Erlediger da, der nie damit zu tun hatte.

        Nur bei echtem Wechsel und nur, wenn die Aufgabe noch auf dem ALTEN Wert
        steht: eine von Hand einzeln umgehängte Aufgabe bleibt, wo sie ist.
        """
        if not alt or str(neu or "") == alt:
            return
        try:
            (
                self._db()
                .table("tasks")
                .update({"assignee_id": neu})
                .eq("tenant_id", tenant_id)
                .eq("rule_id", rule_id)
                .eq("assignee_id", alt)
                .in_("status", [TaskStatus.open.value, TaskStatus.accepted.value,
                                TaskStatus.in_progress.value])
                .execute()
            )
        except APIError:  # noqa: BLE001 - Protokoll, nicht der Hauptpfad
            # Die Regel IST gespeichert. Ein Fehlschlag hier darf den Aufrufer
            # nicht in den Glauben versetzen, das Update sei misslungen — er
            # würde es wiederholen. Stattdessen protokollieren, damit die
            # Abweichung auffindbar bleibt.
            log.exception(
                "regel_zustaendiger_nachziehen_fehlgeschlagen",
                extra={"rule_id": rule_id, "alt": alt, "neu": neu},
            )

    def delete_rule(self, tenant_id: str, rule_id: str) -> None:
        res = (
            self._db()
            .table("task_rules")
            .delete()
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Regel nicht gefunden.", status_code=404)

    @staticmethod
    def _rule_payload(tenant_id: str, req: RuleCreate) -> dict[str, object]:
        return {
            "tenant_id": tenant_id,
            "kind": req.kind.value,
            "name": req.name,
            "description": req.description,
            "active": req.active,
            "priority": req.priority,
            "assignee_id": req.assignee_id,
            "needs_inspection": req.needs_inspection,
            "remove_on_cancellation": req.remove_on_cancellation,
            "recurrence": req.recurrence,
            "template_rule_id": req.template_rule_id,
            "start_trigger": req.start_trigger.value if req.start_trigger else None,
            "end_trigger": req.end_trigger.value if req.end_trigger else None,
            "start_offset_minutes": req.start_offset_minutes,
            "end_offset_minutes": req.end_offset_minutes,
            "starts_on": req.starts_on.isoformat() if req.starts_on else None,
            "ends_on": req.ends_on.isoformat() if req.ends_on else None,
            "start_time": req.start_time.isoformat() if req.start_time else None,
            "duration_minutes": req.duration_minutes,
        }

    def _require_own_template(self, tenant_id: str, template_id: str | None) -> str | None:
        """Die verknüpfte Vorlage MUSS dem Tenant gehören und eine Vorlage sein
        (Wurzel 3). Rückgabe: ihr Name für die Anzeige."""
        if not template_id:
            return None
        rows = (
            self._db()
            .table("task_rules")
            .select("id, name, kind")
            .eq("id", template_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows or rows[0].get("kind") != TaskRuleKind.template.value:
            raise TaskError("Unbekannte Aufgabenvorlage referenziert.", status_code=422)
        return rows[0]["name"]

    def _replace_rule_children(
        self, tenant_id: str, rule_id: str, req: RuleCreate
    ) -> None:
        """Objekt-Zuordnungen + Vorlagen-Items neu setzen (Alt/Neu-Diff, Wurzel 1:
        alte Zuordnungen werden gelöscht, bevor die neuen gesetzt werden)."""
        db = self._db()
        db.table("task_rule_assignments").delete().eq("rule_id", rule_id).execute()
        if req.property_ids:
            db.table("task_rule_assignments").insert(
                [{"rule_id": rule_id, "property_id": p} for p in req.property_ids]
            ).execute()
        db.table("task_rule_items").delete().eq("rule_id", rule_id).eq(
            "tenant_id", tenant_id
        ).execute()
        if req.items:
            db.table("task_rule_items").insert(
                [
                    {
                        "tenant_id": tenant_id,
                        "rule_id": rule_id,
                        "label": it.label,
                        "description": it.description,
                        "room": it.room,
                        "requires_photo": it.requires_photo,
                        "sort_order": idx,
                    }
                    for idx, it in enumerate(req.items)
                ]
            ).execute()

    def _require_own_properties(self, tenant_id: str, ids: list[str]) -> None:
        """Alle referenzierten Objekte MÜSSEN dem Tenant gehören (Wurzel 3)."""
        clean = {i for i in ids if i}
        if not clean:
            return
        owned = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("id", list(clean))
            .execute()
        ).data or []
        if len(owned) != len(clean):
            raise TaskError("Unbekanntes Objekt referenziert.", status_code=422)

    def _require_own_assignee(
        self,
        tenant_id: str,
        assignee_id: str | None,
        property_id: str | None = None,
    ) -> None:
        """Der Empfänger muss existieren UND die Aufgabe sehen können.

        Die zweite Hälfte ist der Grund für `property_id`: der Lesepfad
        (`list_own_tasks`, `get_detail`) blendet für staff/cleaner jede
        objektgebundene Aufgabe aus, deren Objekt ihnen nicht über
        `staff_property_assignments` freigegeben ist. Prüfte der SCHREIBpfad
        das nicht mit, ginge die Zuweisung durch, die Mail ginge raus — und
        beim Empfänger wäre die Aufgabe unsichtbar. Der Item-Pfad muss denselben
        Scope prüfen wie die Liste (Wurzel 9); ein Fehlschlag ist hier ehrlicher
        als eine Zuweisung ins Nichts.
        """
        if not assignee_id:
            return
        owned = (
            self._db()
            .table("users")
            .select("id, role, deactivated_at")
            .eq("tenant_id", tenant_id)
            .eq("id", assignee_id)
            .limit(1)
            .execute()
        ).data
        if not owned:
            raise TaskError("Unbekannter Mitarbeiter referenziert.", status_code=422)
        if owned[0].get("deactivated_at"):
            # Ein gesperrtes Konto kann sich nicht anmelden — die Aufgabe wäre
            # unerreichbar. Vorher ging die Zuweisung durch.
            raise TaskError(
                "Dieses Konto ist gesperrt und würde die Aufgabe nicht sehen.",
                status_code=422,
            )
        rolle = str(owned[0].get("role") or "")
        # DIE ROLLE MUSS AUFGABEN ÜBERHAUPT SEHEN DÜRFEN. Vorher fehlte diese
        # Prüfung ganz, und genau das hat live Schaden angerichtet: ein
        # EIGENTÜMER hat kein `VIEW_OWN_TASKS`, bekam aber 17 Aufgaben
        # zugewiesen (Regel „Velk T", 23.08.2026) — 15 davon offen, keine
        # davon für ihn öffenbar. Die Auswahlliste `moegliche_zustaendige`
        # filtert korrekt danach; der SCHREIBpfad tat es nicht, und über ihn
        # (Regel-Zuweisung) entstand der Fehler.
        try:
            darf_aufgaben = has_capability(UserRole(rolle), Capability.VIEW_OWN_TASKS)
        except ValueError:
            # Unbekannte Rolle: fail-closed (Wurzel 6) — wie in der Auswahlliste.
            darf_aufgaben = False
        if not darf_aufgaben:
            raise TaskError(
                "Diese Rolle kann keine Aufgaben sehen und würde sie nie öffnen.",
                status_code=422,
            )
        if property_id is None:
            # Pool-Aufgabe ohne Objektbezug: für jede berechtigte Rolle sichtbar.
            return
        if rolle not in _STAFF_ROLLEN:
            # admin/co_admin hängen nicht an staff_property_assignments.
            return
        frei = (
            self._db()
            .table("staff_property_assignments")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", assignee_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data
        if not frei:
            raise TaskError(
                "Dieser Mitarbeiter ist nicht für das Objekt der Aufgabe "
                "freigegeben und würde sie nicht sehen.",
                status_code=422,
            )

    # --- intern ---

    def _insert(self, table: str, data: dict[str, object]) -> dict[str, object]:
        res = self._db().table(table).insert(data).execute()
        if not res.data:
            raise TaskError(f"{table}: Anlegen fehlgeschlagen.", status_code=500)
        return res.data[0]

    def _to_task(self, row: dict[str, object]) -> Task:
        insp = row.get("inspection_state")
        return Task(
            id=row["id"],
            tenant_id=row["tenant_id"],
            property_id=row.get("property_id"),
            reservation_id=row.get("reservation_id"),
            assignee_id=row.get("assignee_id"),
            title=row["title"],
            status=TaskStatus(row["status"]),
            due_at=row.get("due_at"),
            needs_inspection=bool(row.get("needs_inspection")),
            inspection_state=InspectionState(insp) if insp else None,
            source=TaskSource(row.get("source") or "manual"),
            priority=int(row.get("priority") or 0),
            start_at=row.get("start_at"),
            end_at=row.get("end_at"),
        )
