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
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from postgrest.exceptions import APIError
from supabase import Client

from src.core.bestand import nur_im_bestand
from src.core.ki import KiError, VertexClient
from src.core.logging import get_logger
from src.core.mail_sprache import normalisieren
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

from . import abrechnung
from .engine import (
    materialize_recurring,
    nachziehen_planmaessig,
    sync_for_reservation,
)
from .inventur import zaehle_menge
from .kosten_rueckmeldung import (
    kosten_einfuegen,
    kosten_entfernen,
    kosten_laden,
    kosten_zeile,
    rueckmeldung_laden,
    rueckmeldung_schreiben,
    waehrung_fuer_aufgabe,
)
from .regel_uebersetzung import (
    TaskRegelUebersetzungError,
    lesersprache,
    namen_in_sprache,
    regel_uebersetzen,
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
    TaskTrigger,
    TeamaufgabenStand,
    UngedecktesObjekt,
)
from .startseite import teamaufgaben_stand

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

#: Wie viele IDs höchstens in EINE `in_()`-Liste gehen.
#:
#: PostgREST bekommt `in_`-Listen über die URL. Eine UUID braucht dort rund 38
#: Zeichen, und ab etwa 8 KB antwortet der Server mit HTTP 414 „URI too long" —
#: die supabase-py-Schicht macht daraus einen `APIError`, den niemand fängt,
#: also einen 500.
#:
#: LIVE PASSIERT (01.09.2026): der Aufgabenkalender warf beim Scrollen
#: `internal_error`. Gemessen kippte er zwischen 207 und 212 Aufgaben —
#: `_enrich` reicht ALLE Task-IDs des Fensters in einem Rutsch an
#: `checklist_items` weiter. Nachgestellt: 200 IDs gehen, 210 werfen 414.
#:
#: Das Tückische ist, dass es von der DATENMENGE abhängt, nicht vom Code: bei
#: einem kleinen Betrieb läuft dieselbe Zeile jahrelang, und der Fehler
#: erscheint erst, wenn genug Aufgaben da sind. Kein Test hätte ihn gefunden,
#: solange die Fake-DB jede Listenlänge annimmt.
#:
#: 100 mit Absicht deutlich unter der gemessenen Grenze: Filter, Spaltenliste
#: und Sortierung stehen in derselben URL, und die Grenze ist keine
#: Eigenschaft unseres Codes, sondern der Serverkonfiguration.
_ID_BLOCK = 100


def _in_bloecken(ids: list[str], groesse: int = _ID_BLOCK) -> list[list[str]]:
    """Eine ID-Liste in URL-taugliche Blöcke schneiden.

    EIN Helfer statt sieben Mal dieselbe Schleife: die vorige Fassung hatte
    die Blockbildung an KEINER Stelle, obwohl das Nachbarmodul
    `regel_uebersetzung` sie längst hatte. Wer eine neue Sammelabfrage
    schreibt, greift hierher.
    """
    return [ids[i : i + groesse] for i in range(0, len(ids), groesse)]


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
        roh = res.data or []
        namen = self._regelnamen_fuer(roh, ctx, tenant_id)
        tasks = [self._to_task(r, namen) for r in roh]
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
        if ctx is not None and is_owner(ctx):
            # EIGENTÜMER (03.09.2026): enger als staff. Er sieht nur, was IHM
            # zugewiesen ist UND an einem SEINER Objekte hängt — nicht die
            # Aufgaben des Personals an seinem Haus (wer putzt, ist
            # Personaleinsatz des Betriebs, §4.3) und keine Pool-Aufgaben.
            meine = owner_property_ids(self._db(), ctx)
            tasks = [
                t
                for t in tasks
                if self._eigentuemer_sieht(ctx, t.property_id, t.assignee_id, meine)
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
        roh = res.data or []
        return [
            self._to_task(r, self._regelnamen_fuer(roh, ctx, tenant_id))
            for r in roh
        ]

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
            # `is_owner_stay, block_request_id` (0510) MÜSSEN mit — sonst
            # behandelt der Nachzügler-Knopf eine Eigentümersperrung wieder wie
            # eine Gastbuchung und legt die volle Regelkette an.
            .select(
                "id, property_id, status, check_in, check_out, "
                "checkin_time, checkout_time, created_at, "
                "is_owner_stay, block_request_id"
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
        Best-effort: Fehler werden geloggt, nicht propagiert (kein Kauf-Abbruch).

        ZEITFENSTER (03.09.2026): Hier stand nur ``due_at``. Eine Aufgabe ohne
        ``start_at`` hat kein Zeitfenster — niemand sieht, WANN sie zu tun ist,
        und der Kalender musste sich den Tag aus ``due_at`` holen, also aus dem
        ENDE. Live betraf das 30 Aufgaben („Wäschepaket", „Babybett").

        Das Fenster ist derselbe Vormittag wie bei den übrigen
        anreisebezogenen Aufgaben: die Zusatzleistung muss VOR der Anreise im
        Objekt sein. ``due_at`` bleibt das Ende, damit die Fälligkeit sich
        nicht verschiebt.
        """
        start_at = self._addon_fenster_start(due_at)
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
                        "start_at": start_at,
                        "end_at": due_at,
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

    @staticmethod
    def _addon_fenster_start(due_at: str) -> str:
        """Beginn des Vorbereitungsfensters: vier Stunden vor der Fälligkeit.

        Vier Stunden, weil das die Spanne der übrigen anreisebezogenen Regeln
        ist (Empfang 14:00–18:00). Ein auf die Minute gleicher Start und Ende
        wäre kein Fenster, und ein geratener Tagesbeginn stünde bei einer
        Zeitzone östlich von UTC nachts (Wurzel 4).
        """
        try:
            ende = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
        except ValueError:
            # Unlesbares Datum: kein erfundener Start, dann bleibt es beim
            # Ende allein — sichtbar als Aufgabe ohne Fenster, nicht als
            # stille Falschangabe.
            return due_at
        return (ende - timedelta(hours=4)).isoformat()

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
            .select("id, property_id, assignee_id")
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
        if ctx is not None and is_owner(ctx) and not self._eigentuemer_sieht(
            ctx, owned[0].get("property_id"), owned[0].get("assignee_id")
        ):
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
        out: dict[str, str] = {}
        for block in _in_bloecken(list(clean)):
            for r in (
                self._db()
                .table("properties")
                .select("id, title")
                .eq("tenant_id", tenant_id)
                .in_("id", block)
                .execute()
            ).data or []:
                out[r["id"]] = r.get("title") or ""
        return out

    def _user_names(self, tenant_id: str, ids: set[str]) -> dict[str, str]:
        """Anzeigenamen der Assignees im Batch. Nur Name — keine PII/Kontakt."""
        clean = {i for i in ids if i}
        if not clean:
            return {}
        out: dict[str, str] = {}
        for block in _in_bloecken(list(clean)):
            for r in (
                self._db()
                .table("users")
                .select("id, full_name")
                .eq("tenant_id", tenant_id)
                .in_("id", block)
                .execute()
            ).data or []:
                out[r["id"]] = r.get("full_name") or ""
        return out

    def _checklist_counts(self, task_ids: set[str]) -> dict[str, tuple[int, int]]:
        """(total, done) je Task. checklist_items trägt keine tenant_id — die
        task_ids sind bereits tenant-gefiltert übergeben (Wurzel 3)."""
        clean = {i for i in task_ids if i}
        if not clean:
            return {}
        counts: dict[str, tuple[int, int]] = {}
        for block in _in_bloecken(list(clean)):
            for r in (
                self._db()
                .table("checklist_items")
                .select("task_id, done")
                .in_("task_id", block)
                .execute()
            ).data or []:
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
        out: dict[str, str] = {}
        for block in _in_bloecken(list(clean)):
            for r in (
                self._db()
                .table("reservations")
                .select("id, external_ref")
                .eq("tenant_id", tenant_id)
                .in_("id", block)
                .execute()
            ).data or []:
                out[r["id"]] = r.get("external_ref") or str(r["id"])[:8]
        return out

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
        von: datetime | None = None,
        bis: datetime | None = None,
        tagesende: datetime | None = None,
        ctx: AuthContext | None = None,
    ) -> list[TaskListItem]:
        """Alle Aufgaben des Tenants mit Assignee (MANAGE_TASKS).

        `ctx` dient hier NUR der Anzeigesprache der Regelnamen (0511) — die
        Autorisierung liegt am Router (`_manage()`).
        """
        rows = self._filtered_tasks(
            tenant_id,
            property_ids=property_ids,
            assignee_ids=assignee_ids,
            rule_ids=rule_ids,
            von=von,
            bis=bis,
            ctx=ctx,
        )
        return self._enrich(
            tenant_id, self._filter_bucket(rows, status_bucket, tagesende)
        )

    def teamaufgaben_stand(
        self,
        tenant_id: str,
        *,
        tagesbeginn: datetime | None = None,
        tagesende: datetime | None = None,
    ) -> TeamaufgabenStand:
        """Die Bestaende der Teamaufgaben fuer die Startseiten-Kachel.

        Reine Delegation nach `startseite.py` — dieselbe Trennung wie bei
        `abrechnung`: der Zaehlpfad ist ein eigenes Thema und braucht nichts
        vom Aufgaben-Lebenszyklus. Die Autorisierung liegt am Router
        (`_manage()`), derselbe Guard wie `/tasks/team` (Wurzel 9).
        """
        return teamaufgaben_stand(
            self._db(), tenant_id, tagesbeginn=tagesbeginn, tagesende=tagesende
        )

    def list_own_tasks(
        self,
        tenant_id: str,
        user_id: str,
        status_bucket: str | None = None,
        property_ids: list[str] | None = None,
        ctx: AuthContext | None = None,
        von: datetime | None = None,
        bis: datetime | None = None,
        tagesende: datetime | None = None,
    ) -> list[TaskListItem]:
        """„Meine Aufgaben": dieselbe Tabelle wie Teamaufgaben, aber hart auf den
        angemeldeten Nutzer gescopt (Wurzel 9 — der Filter ist keine Anzeigehilfe,
        er ist die Autorisierung)."""
        rows = self._filtered_tasks(
            tenant_id,
            property_ids=property_ids,
            assignee_ids=[user_id],
            von=von,
            bis=bis,
            ctx=ctx,
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
        von: datetime | None = None,
        bis: datetime | None = None,
        ctx: AuthContext | None = None,
    ) -> list[Task]:
        """Gemeinsamer Lesepfad der Listen und des Kalenders.

        Mehrfachauswahl wirkt wirklich: früher griff der Nutzerfilter nur bei
        GENAU einer Auswahl, jede weitere blieb folgenlos. Der Sonderwert
        ``none`` in `assignee_ids` meint „Nicht zugeordnet" (Lodgify-Eintrag).

        `von`/`bis` sind die Grenzen des Datumsfilters als ZEITPUNKTE (`bis` =
        Beginn des Tages NACH dem gewählten Enddatum, exklusiv). Sie kommen
        fertig gerechnet vom Client, wie schon `tagesende`: der Kalendertag
        eines Aufgaben-Zeitstempels ist in der Zone des OBJEKTS definiert
        (`engine.py::_at`), und live haben 24 von 43 Objekten keine gepflegte
        Zone — eine hier zu unterstellen wäre ein erfundener Wert (Wurzel 4).

        Geprüft wird ÜBERSCHNEIDUNG, nicht `start_at BETWEEN`: eine Aufgabe vom
        20.08. 10:00–16:00 muss beim Filter „20.08.–20.08." erscheinen, und eine
        über Nacht laufende auch an beiden Tagen. Eine Aufgabe überschneidet den
        Zeitraum, wenn sie vor dessen Ende beginnt und nach dessen Anfang endet.
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
        roh = q.order("start_at").execute().data or []
        # 0511: die Regelnamen in der Sprache des Lesers — einmal fuer die
        # ganze Liste. `tasks.title` ist eine Kopie des Regelnamens von der
        # Anlage; ohne diesen Schritt stuende dort weiter das betriebsinterne
        # Kuerzel (live: 63 Aufgaben heissen „Reng T" oder „Velk J").
        namen = self._regelnamen_fuer(roh, ctx, tenant_id)
        rows = [self._to_task(r, namen) for r in roh]
        if named and wants_unassigned:
            # „Zugeordnet an X ODER niemandem" — PostgREST-or wäre möglich, die
            # Nachfilterung ist hier klarer und die Menge ist tenant-begrenzt.
            allowed = set(named)
            rows = [
                t for t in rows if t.assignee_id is None or t.assignee_id in allowed
            ]
        return self._im_zeitraum(rows, von, bis)

    @staticmethod
    def _im_zeitraum(
        tasks: list[Task], von: datetime | None, bis: datetime | None
    ) -> list[Task]:
        """Überschneidung mit dem Datumsfilter (`bis` exklusiv).

        Bewusst in Python und nicht als PostgREST-Bedingung: der Zeitpunkt einer
        Aufgabe steht in DREI nullbaren Spalten mit Vorrang
        ``start_at → due_at``, genau wie in `_filter_bucket`. Als
        ``or``-Verkettung über nullbare Spalten wäre dieselbe Regel zweimal
        formuliert und beim nächsten Feld auseinandergelaufen; ein ``lt`` auf
        ``start_at`` allein hätte JEDE Aufgabe ohne Startzeitpunkt verschluckt
        (live 30 Zusatzleistungs-Aufgaben, die nur ``due_at`` trugen). Die Menge
        ist tenant-begrenzt und für die Reiter-Einteilung ohnehin schon geladen.

        Eine Aufgabe ohne JEDEN Zeitpunkt hat keinen Tag, an dem sie liegt: sie
        fällt aus einem Datumsfilter heraus, statt in jedem Zeitraum
        aufzutauchen. Ohne gesetzten Filter bleibt sie sichtbar.
        """
        if von is None and bis is None:
            return tasks
        treffer: list[Task] = []
        for t in tasks:
            beginn = t.start_at or t.due_at
            if beginn is None:
                continue
            # Ohne Ende ist die Aufgabe ein Zeitpunkt, kein Zeitraum.
            ende = t.end_at or t.due_at or beginn
            if bis is not None and beginn >= bis:
                continue
            if von is not None and ende < von:
                continue
            treffer.append(t)
        return treffer

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
        ctx: AuthContext | None = None,
    ) -> TaskCalendarResponse:
        """Kalender-Timeline: alle GEFÜHRTEN Objekte als Zeilen (auch leere)
        plus eine erste Zeile für objektlose Aufgaben. Je Zeile die Aufgaben-
        und Buchungs-Balken im Zeitraum.

        Archivierte Objekte (`archived_at`, 0416) bekommen KEINE Zeile — auch
        dann nicht, wenn im Zeitraum noch Aufgaben oder Buchungen an ihnen
        hängen. Entscheidung des Betreibers (03.09.2026): „archiviert = raus
        aus dem Aufgabenkalender, zurück nur, wenn wir die Archivierung
        rückgängig machen". „Fewo-Mosbjerg-Sindal", am 21.08.2026 archiviert,
        stand vorher dauerhaft als leere Zeile da.

        Was dabei NICHT verloren geht: Buchungen und Eigentümer-Abrechnungen
        (Archivieren setzt nur `archived_at` und das Vertragsende, `archiv.py`),
        und offene Aufgaben eines archivierten Objekts stehen weiter in „Meine
        Aufgaben" und „Teamaufgaben" — nur die Objektzeile im Kalender fehlt.
        Hebt der Betrieb die Archivierung auf, ist die Zeile wieder da.
        """
        tasks = self._calendar_tasks(
            tenant_id, month_from, month_to, assignee_ids, rule_ids, ctx
        )
        bookings = self._calendar_bookings(tenant_id, month_from, month_to)
        # Der geführte Bestand als Grundgerüst, damit auch Objekte ohne
        # Aufgaben/Buchungen eine Zeile bekommen — und NUR der Bestand.
        props = (
            nur_im_bestand(
                self._db()
                .table("properties")
                .select("id, title, timezone")
                .eq("tenant_id", tenant_id)
            ).execute()
        ).data or []
        # Hier sortieren, nicht in Postgres: Collation und Python-Vergleich
        # ordnen „Ä" und „Z" verschieden; die ID als zweiter Schlüssel hält
        # gleiche Titel stabil.
        props.sort(key=lambda p: ((p.get("title") or "").casefold(), str(p["id"])))

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
                    timezone=p.get("timezone") or None,
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
        ctx: AuthContext | None = None,
    ) -> list[TaskListItem]:
        """Aufgaben, deren Anzeige-Zeitpunkt (start_at ODER Fälligkeit due_at)
        im Monat liegt. PostgREST kann kein coalesce im Filter → breit laden,
        dann in Python auf das effektive Datum filtern (Altdaten haben nur
        due_at, kein start_at — sonst fielen sie aus der Timeline)."""
        rows = self._filtered_tasks(
            tenant_id, assignee_ids=assignee_ids, rule_ids=rule_ids, ctx=ctx
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
        if ctx is not None and is_owner(ctx) and not self._eigentuemer_sieht(
            ctx, row[0].get("property_id"), row[0].get("assignee_id")
        ):
            # Derselbe Scope wie die Liste (Wurzel 9), dieselbe Meldung wie
            # „nicht vorhanden": kein Orakel über fremde Aufgaben.
            raise TaskError("Aufgabe nicht gefunden.", status_code=404)
        task = self._to_task(
            row[0], self._regelnamen_fuer(row, ctx, tenant_id)
        )
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
            # UND den Abrechnungsposten (0531): eine Leistung, die nicht mehr
            # als erledigt gilt, darf dem Eigentuemer nicht berechnet bleiben.
            # Nur der eigene Posten, und nur solange er in keiner
            # festgeschriebenen Abrechnung steckt — das entscheidet
            # `posten_zuruecknehmen`. Der `owner_expense_id` wird dort
            # mitgeloest, deshalb steht er NICHT in diesem Patch.
            try:
                zeile = (
                    self._db()
                    .table("tasks")
                    .select("id, owner_expense_id")
                    .eq("id", task_id)
                    .eq("tenant_id", tenant_id)
                    .limit(1)
                    .execute()
                ).data or []
                if zeile:
                    abrechnung.posten_zuruecknehmen(
                        self._db(), tenant_id=tenant_id, zeile=zeile[0]
                    )
            except Exception as exc:  # noqa: BLE001 — Nebenpfad wie oben
                log.error(
                    "dienstleistung_posten_ruecknahme_fehlgeschlagen",
                    task_id=task_id, error=str(exc)[:200],
                )
        self._db().table("tasks").update(patch).eq("id", task_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "task_status_gesetzt",
            tenant_id=tenant_id, task_id=task_id, von=aktuell, nach=status.value,
        )
        return self.get_detail(tenant_id, task_id, ctx)

    # --- Zeitfenster setzen -------------------------------------------------

    def set_zeitfenster(
        self,
        tenant_id: str,
        task_id: str,
        start_at: datetime | None,
        end_at: datetime | None,
        ctx: AuthContext | None = None,
    ) -> TaskDetail:
        """Start- und Endzeitpunkt EINER Aufgabe von Hand setzen.

        WARUM ES DAS BRAUCHT: Die Zeiten einer bestehenden Aufgabe waren bis
        zum 31.08.2026 unveränderlich. Es gab `PATCH /status` und
        `PATCH /assignee`, aber keinen Weg zu `start_at`/`end_at` — wer eine
        Reinigung auf „28.08. von 10 bis 16 Uhr" legen wollte, konnte das
        nirgends eintragen. Gemeldet als „Start und Endtermine müssen für
        denselben Tag zu setzen sein, z. B. 28.8. von 10-16 Uhr".

        Automatisch erzeugte Aufgaben tragen die Tagesgrenze 00:00, weil der
        Regel-Motor nur mit Tages-Offsets rechnet. Diese Korrektur von Hand ist
        der Weg, eine EINZELNE Aufgabe davon abweichen zu lassen; die Regel
        selbst bleibt unberührt.

        GEPRÜFT WIRD DIE REIHENFOLGE (Wurzel 5): ein Ende vor dem Start wird
        abgelehnt statt geschrieben. Genau das fehlte dem Regel-Motor, und
        live standen deshalb neun Aufgaben mit einem Ende bis zu 64 Tage VOR
        ihrem Start — im Kalender als rückwärts laufender Balken, in der Liste
        als unlesbares Datumspaar.

        `due_at` läuft mit: es ist die Fälligkeit und im Motor immer
        `end or start`. Ohne Nachziehen zeigte jede Liste, die nach Fälligkeit
        sortiert, weiter den alten Termin (Wurzel 1).
        """
        detail = self.get_detail(tenant_id, task_id, ctx)
        if start_at is not None and end_at is not None and end_at < start_at:
            raise TaskError(
                "Das Ende darf nicht vor dem Start liegen.", status_code=422
            )
        patch: dict[str, object] = {
            "start_at": start_at.isoformat() if start_at else None,
            "end_at": end_at.isoformat() if end_at else None,
            "due_at": (end_at or start_at).isoformat()
            if (end_at or start_at)
            else None,
        }
        self._db().table("tasks").update(patch).eq("id", task_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "task_zeitfenster_gesetzt",
            tenant_id=tenant_id,
            task_id=task_id,
            start_at=patch["start_at"],
            end_at=patch["end_at"],
            vorher_start=detail.start_at.isoformat() if detail.start_at else None,
        )
        return self.get_detail(tenant_id, task_id, ctx)

    # --- Zuständigen setzen -----------------------------------------------

    def moegliche_zustaendige(
        self, tenant_id: str, property_id: str | None = None
    ) -> list[TaskAssigneeOption]:
        """Wer kann überhaupt Zuständige:r einer Aufgabe sein?

        NICHT alle Nutzer des Betriebs. Bis zum 03.09.2026 hatte ein `owner`
        `VIEW_OWN_TASKS` nicht und stand deshalb nie zur Wahl — davor lagen
        live 11 Aufgaben auf Eigentümer-Konten, die sie nie zu sehen bekamen.
        Seit dem 03.09.2026 kann er Aufgaben übernehmen (manche Eigentümer
        reinigen selbst), aber NUR an einem Objekt, das ihm gehört: ohne
        `property_id` fehlt er weiterhin, mit `property_id` nur, wenn
        `owner_property_assignments` ihn dort führt.

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
        # EIGENTÜMER (03.09.2026): stehen NUR zur Wahl, wenn ein Objekt genannt
        # ist und es ihnen gehört. Ohne Objekt (Pool-Aufgabe, Filterleisten,
        # Regel-Editor) fehlen sie — ein Eigentümer kann keine Pool-Aufgabe
        # sehen, und eine Regel legt Aufgaben an ALLEN ihren Objekten an.
        # Dieselbe Prüfung wie `_require_own_assignee`: die Liste darf nichts
        # versprechen, was der Schreibpfad ablehnt.
        eigentuemer_frei: set[str] = set()
        if property_id is not None:
            eigentuemer_frei = {
                str(r["user_id"])
                for r in (
                    self._db()
                    .table("owner_property_assignments")
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
            if rolle == UserRole.owner.value and str(r["id"]) not in eigentuemer_frei:
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

    def zaehle_checklist_item(
        self,
        tenant_id: str,
        item_id: str,
        menge: int,
        ctx: AuthContext | None = None,
    ) -> TaskDetail:
        """Eine gezaehlte Menge an einem Zaehlpunkt eintragen (0623).

        Der Weg der Reinigungskraft: sie steht nach der Abreise im Haus, sieht
        „Weinglaeser (6)" auf ihrer Liste und traegt ein, was sie zaehlt. Kein
        Umweg ueber die Kartei — die darf sie gar nicht sehen.

        DERSELBE SCOPE wie `toggle_checklist_item`: erst die Aufgabe ueber
        `get_detail` laden (Tenant + Objekt-Freigabe, Wurzel 9), dann
        schreiben. Ohne den Umweg waere die item_id allein der Schluessel.
        """
        rows = (
            self._db()
            .table("checklist_items")
            .select("id, task_id, inventory_item_id")
            .eq("id", item_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise TaskError("Punkt nicht gefunden.", status_code=404)
        if not rows[0].get("inventory_item_id"):
            # Ein gewoehnlicher Checklistenpunkt hat nichts zu zaehlen. Eine
            # Menge dort anzunehmen waere eine Zahl ohne Bezug.
            raise TaskError("Dieser Punkt ist kein Zählpunkt.", status_code=422)
        task_id = rows[0]["task_id"]
        detail = self.get_detail(tenant_id, task_id, ctx)
        zaehle_menge(
            self._db(),
            tenant_id,
            item_id=item_id,
            inventory_item_id=str(rows[0]["inventory_item_id"]),
            property_id=detail.property_id,
            menge=menge,
            user_id=ctx.user_id if ctx else None,
        )
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
        out: dict[str, list[str]] = {}
        for block in _in_bloecken(list(clean)):
            for r in (
                self._db()
                .table("checklist_photos")
                .select("item_id, storage_path")
                .in_("item_id", block)
                .execute()
            ).data or []:
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
        könnte ein Mitarbeiter fremde Aufgaben abschließen.

        Der Übergang wird hier genauso geprüft wie in `set_status`: dieser
        Endpunkt ist die ZWEITE Tür zu `done`, und eine Regel, die nur an einer
        von zwei Türen hängt, ist keine Regel (Wurzel 5). Ohne die Prüfung ließ
        sich eine ABGEBROCHENE Aufgabe über `POST /{id}/complete` abschließen,
        obwohl `_STATUS_WECHSEL` aus `cancelled` nur `open` erlaubt — die
        Massenaktion `bulk_complete` lief durch dieselbe Lücke."""
        detail = self.get_detail(tenant_id, task_id, ctx)
        aktuell = detail.status.value
        if aktuell == TaskStatus.done.value:
            # Idempotent (Wurzel 2): der zweite Abschluss würde `completed_by`
            # auf den zweiten Tipper umschreiben — die Aufgabe hätte plötzlich
            # jemand anderes erledigt, und `completed_at` wanderte nach vorn.
            return detail
        if TaskStatus.done.value not in self._STATUS_WECHSEL.get(
            aktuell, frozenset()
        ):
            raise TaskError(
                f"Wechsel von '{aktuell}' nach '{TaskStatus.done.value}' "
                "ist nicht vorgesehen.",
                status_code=422,
            )
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
        # Und sie wird ihm BERECHNET (0531). Bis hierher endete die Kette mit
        # der Meldung: die bestellte Leistung war erledigt, stand aber in
        # keiner Abrechnung — ausgefuehrte Arbeit, die niemand fakturiert.
        # Best-effort wie die Meldung daneben: der Abschluss ist der
        # Hauptpfad, jeder Grund fuer einen fehlenden Posten steht im Log
        # (Wurzel 5, kein stilles Verschlucken).
        try:
            abrechnung.posten_anlegen(
                self._db(), tenant_id=tenant_id, zeile=res.data[0]
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, siehe Docstring
            log.error(
                "dienstleistung_posten_fehlgeschlagen",
                task_id=task_id, error=str(exc)[:200],
            )
        return self.get_detail(tenant_id, task_id, ctx)

    def list_inspection(
        self,
        tenant_id: str,
        tab: str,
        property_ids: list[str] | None = None,
        ctx: AuthContext | None = None,
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
        roh = q.order("end_at").execute().data or []
        namen = self._regelnamen_fuer(roh, ctx, tenant_id)
        rows = [self._to_task(r, namen) for r in roh]
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
        {
            "check_in",
            "days_before_check_in",
            "after_check_in_24h",
            "booking_confirmed",
            # Der Tages-Anker der Anreise (0535). Ohne ihn hier zaehlte eine
            # Regel „Am Anreisetag" zur ABREISE-Achse — die Deckungspruefung
            # haette das Objekt dann als „ohne Anreise-Regel" gemeldet, obwohl
            # genau diese Regel dafuer existiert.
            "arrival_day",
        }
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
            nur_im_bestand(
                db.table("properties").select("id, title").eq("tenant_id", tenant_id)
            )
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
        out: dict[str, int] = {}
        for block in _in_bloecken(list(rule_ids)):
            for r in (
                self._db()
                .table("task_rule_items")
                .select("rule_id")
                .eq("tenant_id", tenant_id)
                .in_("rule_id", block)
                .execute()
            ).data or []:
                out[r["rule_id"]] = out.get(r["rule_id"], 0) + 1
        return out

    def _rule_property_ids(self, rule_ids: set[str]) -> dict[str, list[str]]:
        """Objekt-Zuordnung je Regel (task_rule_assignments). Keine tenant_id auf
        der Join-Tabelle — rule_ids sind bereits tenant-gefiltert (Wurzel 3)."""
        if not rule_ids:
            return {}
        out: dict[str, list[str]] = {}
        for block in _in_bloecken(list(rule_ids)):
            for r in (
                self._db()
                .table("task_rule_assignments")
                .select("rule_id, property_id")
                .in_("rule_id", block)
                .execute()
            ).data or []:
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
            quellsprache=r.get("quellsprache"),
            remove_on_cancellation=bool(r.get("remove_on_cancellation")),
            recurrence=r.get("recurrence") or {},
            items=self._load_rule_items(tenant_id, rule_id),
            template_rule_id=template_id,
            template_name=self._template_name(tenant_id, template_id),
            start_trigger=r.get("start_trigger"),
            end_trigger=r.get("end_trigger"),
            start_offset_minutes=int(r.get("start_offset_minutes") or 0),
            end_offset_minutes=int(r.get("end_offset_minutes") or 0),
            start_clock=r.get("start_clock"),
            end_clock=r.get("end_clock"),
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

    # Wie viele Minuten VOR dem Ereignis der jeweilige Trigger ansetzt. Der
    # Motor (`engine._trigger_time`) rechnet `basis + offset_minutes`; um zwei
    # Zeitpunkte VERGLEICHEN zu koennen, braucht es zusaetzlich die Reihenfolge
    # der Basen zueinander. `check_in` ist der Bezugspunkt (0), `check_out`
    # liegt danach — wie weit, haengt an der Buchung, deshalb steht hier nur
    # „spaeter" als sehr grosse Zahl.
    _SPAETER = 10**9

    @staticmethod
    def _trigger_rang(trigger: str | None) -> int | None:
        """Grobe zeitliche Ordnung der Trigger-Basen zueinander.

        `None`, wenn sich die Basis nicht ohne konkrete Buchung einordnen laesst
        (`booking_confirmed` liegt irgendwann vor der Anreise, aber wie weit,
        weiss nur die Buchung).
        """
        if trigger in ("check_in", "days_before_check_in", "arrival_day"):
            return 0
        if trigger == "after_check_in_24h":
            return 1440
        if trigger in ("check_out", "days_after_check_out", "departure_day"):
            return TasksService._SPAETER
        return None

    # Die beiden Tages-Anker (0535): nur bei ihnen traegt die Regel eine eigene
    # Uhrzeit. Bei jedem anderen Anker gilt die Uhrzeit der Buchung.
    _TAGES_TRIGGER = frozenset({"arrival_day", "departure_day"})

    @classmethod
    def _uhr_minuten(cls, trigger: TaskTrigger | None, clock: time | None) -> int:
        """Minuten seit Mitternacht, sofern der Anker eine Regel-Uhrzeit kennt.

        Bei allen uebrigen Ankern 0 — dort kommt die Uhrzeit aus der Buchung
        und laesst sich ohne konkrete Buchung nicht vergleichen.
        """
        if clock is None or trigger is None:
            return 0
        if trigger.value not in cls._TAGES_TRIGGER:
            return 0
        return clock.hour * 60 + clock.minute

    @classmethod
    def _bereinige_uhrzeiten(cls, req: RuleCreate) -> None:
        """Uhrzeit UND Versatz an den Anker angleichen, der gerade gilt.

        DER GEGENZUSTAND (Wurzel 1), und zwar in BEIDE Richtungen. Eine Regel
        traegt vier Zeitangaben — zwei Anker, zwei Versaetze, zwei Uhrzeiten —
        von denen je nach Anker nur ein Teil ausgewertet wird. Die Oberflaeche
        blendet die unbenutzten Felder aus, schickt aber weiterhin ihre alten
        Werte mit. Wer eine Regel umstellt, schleppt damit stumm mit, was
        vorher galt.

        LIVE PASSIERT (03.09.2026): die Regel „Velk T" wurde von
        „Tage vor der Anreise → Beim Check-in" auf „Am Anreisetag 10:00 bis
        16:00" umgestellt. Der alte `end_offset_minutes` von 1440 blieb stehen,
        weil sein Feld bei diesem Anker unsichtbar ist — der Motor rechnete
        16:00 + 1440 Minuten und legte das Ende auf den FOLGETAG. Gemeldet
        wurde es als „das Zeitfenster stimmt auch nicht", nicht als Bug im
        Versatz: sichtbar war nur das falsche Ergebnis.

        Der Versatz wird deshalb NUR an den beiden Tages-Ankern genullt, nicht
        ueberall: an den uebrigen Ankern ist ein Versatz eine gueltige, wenn
        auch nicht mehr per Formular editierbare Einstellung — „Velk J" steht
        live auf `check_in` + 1440 und meint das so. Ihn dort mitzunullen waere
        eine stille Aenderung fremder Regeln.
        """
        start = req.start_trigger.value if req.start_trigger else None
        ende = req.end_trigger.value if req.end_trigger else None
        if start not in cls._TAGES_TRIGGER:
            req.start_clock = None
        else:
            req.start_offset_minutes = 0
        if ende not in cls._TAGES_TRIGGER:
            req.end_clock = None
        else:
            req.end_offset_minutes = 0

    @classmethod
    def _pruefe_zeitfenster(cls, req: RuleCreate) -> None:
        """Eine Regel, deren Ende VOR ihrem Start liegt, wird abgewiesen.

        WARUM DIESE PRUEFUNG EXISTIERT: Start und Ende einer planmaessigen
        Regel sind zwei unabhaengige Trigger mit eigenem Offset. Niemand hat
        sie je gegeneinander geprueft — weder die Oberflaeche noch der Server
        noch der Motor. Eine Regel „Start = Abreise, Ende = Anreise" liess sich
        speichern, und der Motor schrieb das Ergebnis kommentarlos in jede
        betroffene Aufgabe.

        Live gemessen am 31.08.2026: 161 von 234 „Velk"-Aufgaben standen am
        falschen Tag, 151 davon genau einen Tag zu frueh — der Empfang lag vor
        dem Gast. Neun trugen sogar ein Ende bis zu 64 Tage VOR ihrem Start.
        Aufgefallen ist es nicht dem System, sondern dem Auge: „hier haben wir
        einen Fehler … und Aufgaben in 2 unterschiedlichen Tagen".

        Geprueft wird, was sich OHNE konkrete Buchung entscheiden laesst:
        gleiche Basis → die Offsets vergleichen; verschiedene Basen mit
        bekannter Ordnung → die Basen vergleichen. Wo die Ordnung von der
        Buchung abhaengt (`booking_confirmed`, oder Anreise-Basis gegen
        Abreise-Basis mit grossen Offsets), bleibt die Regel erlaubt — dort
        faengt der Motor den Einzelfall ab (`engine._regel_zeitfenster`).
        Lieber eine Regel durchlassen, die nur in seltenen Buchungen schief
        steht, als eine gueltige abzulehnen.
        """
        # TAGESANKER OHNE UHRZEIT (03.09.2026): „Am Anreisetag" ohne Stunde
        # heisst im Motor Tagesbeginn 00:00 vor Ort — keine Arbeitszeit, und
        # bei Altdaten ohne Zone stand daraus „02:00" in der Detailansicht.
        # 261 Aufgaben live so entstanden. Der Anker verlangt die Stunde.
        for seite, trig, clock in (
            ("Beginn", req.start_trigger, req.start_clock),
            ("Ende", req.end_trigger, req.end_clock or req.start_clock),
        ):
            if trig is not None and trig.value in cls._TAGES_TRIGGER and clock is None:
                raise TaskError(
                    f"Für den Tagesanker beim {seite} fehlt die Uhrzeit. "
                    "Trage ein, um wie viel Uhr die Aufgabe beginnt und endet.",
                    status_code=422,
                )
        s_rang = cls._trigger_rang(req.start_trigger.value if req.start_trigger else None)
        e_rang = cls._trigger_rang(req.end_trigger.value if req.end_trigger else None)
        if s_rang is None or e_rang is None:
            return
        s = s_rang + (req.start_offset_minutes or 0)
        e = e_rang + (req.end_offset_minutes or 0)
        # Bei den Tages-Ankern (0535) traegt die UHRZEIT die Unterscheidung, nicht
        # der Versatz: „Am Anreisetag 14:00 bis 10:00" haette denselben Rang und
        # denselben Versatz und waere ohne diese Zeilen durchgerutscht — genau
        # der Fall, den der Nutzer hier neu einstellen kann.
        s += cls._uhr_minuten(req.start_trigger, req.start_clock)
        e += cls._uhr_minuten(req.end_trigger, req.end_clock or req.start_clock)
        # FENSTER UEBER DEN TAG HINAUS (03.09.2026): gleiche Basis, aber das
        # Ende 24 Stunden oder mehr nach dem Start — „Beim Check-in bis
        # Check-in + 1440" — ergibt eine Aufgabe, die ueber Mitternacht laeuft
        # und im Kalender eine Spalte weiter endet als ihre Buchung. Live 233
        # Aufgaben (Velk T 120, Reng T 67, Velk J 41, Reng J 5), vom Nutzer
        # als falsch benannt: „hinweise sind auch fehler". Zwei VERSCHIEDENE
        # Basen (Anreise bis Abreise) bleiben erlaubt — das ist eine
        # Aufenthaltsaufgabe, kein Fehler.
        if s_rang == e_rang and e - s >= 1440:
            raise TaskError(
                "Das Zeitfenster läuft über den Tag hinaus (24 Stunden oder "
                "mehr). Eine Aufgabe am selben Anker endet am selben Tag.",
                status_code=422,
            )
        if e < s:
            raise TaskError(
                "Das Ende der Aufgabe liegt vor ihrem Start. Prüfe Auslöser "
                "und Versatz für Beginn und Ende.",
                status_code=422,
            )

    def create_rule(self, tenant_id: str, req: RuleCreate) -> RuleDetail:
        self._bereinige_uhrzeiten(req)
        self._pruefe_zeitfenster(req)
        self._require_own_properties(tenant_id, req.property_ids)
        # Mit Objektbezug prüfen (wie in `update_rule`): ohne ihn bleibt es eine
        # nackte Existenzabfrage, und die Regel erzeugt später Aufgaben an einem
        # Objekt, für das der Zuständige nicht freigegeben ist.
        self._require_own_assignee(
            tenant_id, req.assignee_id, (req.property_ids or [None])[0]
        )
        self._kein_eigentuemer_als_regelzustaendiger(tenant_id, req.assignee_id)
        self._require_own_template(tenant_id, req.template_rule_id)
        row = self._insert("task_rules", self._rule_payload(tenant_id, req))
        self._replace_rule_children(tenant_id, row["id"], req)
        self._regel_nachziehen(tenant_id, str(row["id"]))
        self._regel_uebersetzen(tenant_id, str(row["id"]))
        return self.get_rule(tenant_id, row["id"])

    def update_rule(
        self, tenant_id: str, rule_id: str, req: RuleUpdate
    ) -> RuleDetail:
        # Dieselbe Pruefung wie beim Anlegen: die 161 falschen Aufgaben sind
        # durch eine GEAENDERTE Regel entstanden, nicht durch eine neue.
        self._bereinige_uhrzeiten(req)
        self._pruefe_zeitfenster(req)
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
        self._kein_eigentuemer_als_regelzustaendiger(tenant_id, req.assignee_id)
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
        # Beim ÄNDERN wird verschoben: die vorhandenen Aufgaben tragen sonst
        # weiter das alte Zeitfenster.
        self._regel_nachziehen(tenant_id, rule_id, verschieben=True)
        self._regel_uebersetzen(tenant_id, rule_id)
        return self.get_rule(tenant_id, rule_id)

    def _regel_nachziehen(
        self, tenant_id: str, rule_id: str, *, verschieben: bool = False
    ) -> None:
        """Fehlende Aufgaben dieser Regel für BESTEHENDE Buchungen anlegen.

        Der Gegenzustand zum Speichern einer Regel (Wurzel 1). Eine planmäßige
        Aufgabe entstand bisher nur im Moment des Reservierungs-Schreibens —
        wer eine Regel nach einer Buchung anlegte oder ihr später ein Objekt
        zuordnete, bekam für diese Buchung nie eine Aufgabe.

        LIVE PASSIERT (23.08.2026): Buchung „Feriehus Britt" vom 10.08., Anreise
        23.08., ohne Anreise-Aufgabe — die Regel „Velk T" wurde erst am 13.08.
        angelegt. Gemeldet als „heute ist eine Anreise, dazu gibt es keine
        Aufgabe".

        `verschieben=True` zieht zusätzlich die SCHON vorhandenen Aufgaben auf
        die neuen Zeiten nach — der zweite fehlende Gegenzustand (Wurzel 1).
        Beim ÄNDERN einer Regel ist das der eigentliche Zweck: wer das
        Zeitfenster einer Regel korrigiert, meint die bestehenden Aufgaben mit.
        Ohne das blieb die Korrektur unsichtbar (03.09.2026, gemeldet als „die
        Daten werden nicht übergeben"), und es gab keinen Weg zu den alten
        Aufgaben außer sie einzeln von Hand zu setzen. Beim ANLEGEN einer Regel
        gibt es nichts zu verschieben, dort bleibt es beim Standard.

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
                verschieben=verschieben,
            )
        except APIError:  # noqa: BLE001 - Nachzug, nicht der Hauptpfad
            log.exception(
                "regel_aufgaben_nachziehen_fehlgeschlagen",
                extra={"rule_id": rule_id},
            )

    def _regel_uebersetzen(self, tenant_id: str, rule_id: str) -> None:
        """Den Regelnamen in die uebrigen gefuehrten Sprachen bringen (0511).

        Der Gegenzustand zum Speichern (Wurzel 1) — dieselbe Bauform wie
        `_regel_nachziehen` daneben: die Regel IST gespeichert, und ein Fehler
        hier darf den Aufrufer nicht glauben lassen, das Speichern sei
        misslungen (er wiederholte es dann).

        WELCHE SPRACHEN: die, in denen dieser Betrieb tatsaechlich Leser hat —
        die gepflegten `users.preferred_language` plus die Betriebssprache. NICHT
        alle 24: das waeren 24 bezahlte Modellaufrufe je Regel fuer 22 Sprachen,
        die niemand liest. Kommt spaeter ein Nutzer mit einer neuen Sprache
        dazu, holt der naechste Regel-Speichervorgang sie nach; bis dahin sieht
        er den Originalnamen, was die ehrliche Auskunft ist.

        OHNE `quellsprache` passiert NICHTS — kein Raten (siehe
        `regel_uebersetzung`). Das ist der Normalfall fuer den Altbestand und
        kein Fehler; es steht im Log, damit man es beheben kann.
        """
        regel = (
            self._db()
            .table("task_rules")
            .select("id, name, description, quellsprache")
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not regel or not regel[0].get("quellsprache"):
            return
        client = VertexClient()
        if not client.is_configured:
            # Ohne Vertex gibt es keine Uebersetzung. Laut, nicht still: eine
            # fehlende Konfiguration, die schweigt, ist derselbe Fehler wie ein
            # verschluckter Exception (Wurzel 5).
            log.warning("regel_uebersetzung_ohne_vertex", extra={"rule_id": rule_id})
            return
        ziele = self._lesersprachen(tenant_id)
        if not ziele:
            return
        try:
            regel_uebersetzen(client, self._db(), regel[0], ziele)
        except (APIError, KiError, TaskRegelUebersetzungError):
            # Genau die drei erwartbaren Arten. Ein breites `except` verschluckte
            # auch echte Programmfehler.
            log.exception(
                "regel_uebersetzung_fehlgeschlagen", extra={"rule_id": rule_id}
            )

    def _lesersprachen(self, tenant_id: str) -> list[str]:
        """Die Sprachen, in denen dieser Betrieb wirklich Leser hat.

        Quelle sind die gepflegten `users.preferred_language` plus
        `tenants.default_language`. Eine Sprache, die niemand eingestellt hat,
        zu uebersetzen kostet einen Modellaufruf und liefert eine Fassung, die
        kein Mensch aufruft.
        """
        nutzer = (
            self._db()
            .table("users")
            .select("preferred_language")
            .eq("tenant_id", tenant_id)
            .not_.is_("preferred_language", "null")
            .execute()
        ).data or []
        betrieb = (
            self._db()
            .table("tenants")
            .select("default_language")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        roh = [r.get("preferred_language") for r in nutzer]
        if betrieb:
            roh.append(betrieb[0].get("default_language"))
        codes = {normalisieren(w) for w in roh}
        return sorted(c for c in codes if c)

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
        """Regel loeschen — samt ihrer noch OFFENEN Aufgaben (Wurzel 1).

        DER GEGENZUSTAND, der gefehlt hat. Der Fremdschluessel steht auf
        `on delete set null`: eine geloeschte Regel liess ihre Aufgaben
        zurueck, ohne Herkunft und ohne Weg, sie wieder loszuwerden. Der
        Nachzug legt sie nicht neu an (die Regel ist ja weg), also blieben sie
        einfach stehen.

        LIVE PASSIERT (03.09.2026): eine Regel wurde umgebaut, indem man sie
        loeschte und neu anlegte — danach stand im Kalender jede Anreise
        DOPPELT, einmal aus der alten und einmal aus der neuen Regel. Gemeldet
        als „warum sind die jetzt doppelt?". Zu diesem Zeitpunkt hingen 243
        Aufgaben an geloeschten Regeln, 117 davon offen.

        ERLEDIGTE bleiben stehen: sie belegen geleistete Arbeit, haengen an
        Kosten und Fotos, und ein Loeschen waere Geschichtsfaelschung. Nur was
        noch zu tun ist, verschwindet mit seiner Regel — es ist ja niemand
        mehr da, der es anordnet.
        """
        db = self._db()
        # Die Aufgaben MUESSEN vor dem Regel-Delete eingesammelt werden: der
        # Fremdschluessel steht auf `on delete set null`, danach traegt keine
        # Zeile mehr die `rule_id` und sie sind nicht mehr auffindbar.
        offen = (
            db.table("tasks")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("rule_id", rule_id)
            .in_("status", [TaskStatus.open.value, TaskStatus.in_progress.value])
            .execute()
        ).data or []
        # Die Regel zuerst loeschen: dieser Schritt prueft Existenz UND Tenant
        # (Wurzel 3). Erst wenn er durch ist, darf an den Aufgaben etwas
        # passieren — sonst raeumte ein 404 fremde Zeilen ab.
        res = (
            db.table("task_rules")
            .delete()
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data:
            raise TaskError("Regel nicht gefunden.", status_code=404)
        if offen:
            db.table("tasks").delete().eq("tenant_id", tenant_id).in_(
                "id", [str(r["id"]) for r in offen]
            ).execute()
            log.info(
                "task_regel_geloescht_mit_aufgaben",
                extra={"rule_id": rule_id, "offene_aufgaben": len(offen)},
            )

    @staticmethod
    def _rule_payload(tenant_id: str, req: RuleCreate) -> dict[str, object]:
        return {
            "tenant_id": tenant_id,
            "kind": req.kind.value,
            "name": req.name,
            "description": req.description,
            # 0511: normalisiert (de-AT → de) oder None. Ein unbekannter Code
            # wird zu None statt gespeichert zu werden — sonst stuende an der
            # Regel eine Sprache, fuer die es keinen Katalog gibt.
            "quellsprache": normalisieren(req.quellsprache),
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
            # Uhrzeitfenster der Tages-Anker (0535). Nur bei
            # `arrival_day`/`departure_day` gepflegt — `_bereinige_uhrzeiten`
            # raeumt sie bei jedem anderen Anker weg, damit keine tote Angabe
            # in der Zeile stehen bleibt (Wurzel 1: der Gegenzustand).
            "start_clock": req.start_clock.isoformat() if req.start_clock else None,
            "end_clock": req.end_clock.isoformat() if req.end_clock else None,
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
        owned: list[dict] = []
        for block in _in_bloecken(list(clean)):
            owned.extend(
                (
                    self._db()
                    .table("properties")
                    .select("id")
                    .eq("tenant_id", tenant_id)
                    .in_("id", block)
                    .execute()
                ).data
                or []
            )
        if len(owned) != len(clean):
            raise TaskError("Unbekanntes Objekt referenziert.", status_code=422)

    def _eigentuemer_sieht(
        self,
        ctx: AuthContext,
        property_id: object,
        assignee_id: object,
        meine: set[str] | None = None,
    ) -> bool:
        """Sieht dieser Eigentümer diese Aufgabe? Nur die IHM zugewiesene an
        SEINEM Objekt (03.09.2026). `meine` kann vorgeladen mitkommen, damit
        eine Liste nicht je Zeile die Zuordnung abfragt."""
        if str(assignee_id or "") != ctx.user_id or property_id is None:
            return False
        if meine is None:
            meine = owner_property_ids(self._db(), ctx)
        return str(property_id) in meine

    def _kein_eigentuemer_als_regelzustaendiger(
        self, tenant_id: str, assignee_id: str | None
    ) -> None:
        """Eine REGEL darf keinem Eigentümer gehören.

        Ihre Aufgaben entstehen an ALLEN zugeordneten Objekten — auch an denen
        anderer Eigentümer. `_require_own_assignee` prüft beim Regel-Speichern
        nur das ERSTE Objekt und ließe das durch; der Motor legte dann Aufgaben
        an fremden Häusern auf sein Konto, die er nie sähe. Ein Eigentümer wird
        einzelnen Aufgaben zugewiesen, nicht Regeln.
        """
        if not assignee_id:
            return
        zeile = (
            self._db()
            .table("users")
            .select("role")
            .eq("tenant_id", tenant_id)
            .eq("id", assignee_id)
            .limit(1)
            .execute()
        ).data
        if zeile and str(zeile[0].get("role") or "") == UserRole.owner.value:
            raise TaskError(
                "Eine Regel kann keinem Eigentümer zugewiesen werden — ihre "
                "Aufgaben entstehen an allen zugeordneten Objekten. Weise ihm "
                "einzelne Aufgaben zu.",
                status_code=422,
            )

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
        if rolle == UserRole.owner.value:
            # EIGENTÜMER (03.09.2026): nur an einem Objekt, das ihm gehört. Eine
            # Pool-Aufgabe sähe er nie (sein Lesepfad verlangt ein eigenes
            # Objekt), ein fremdes Objekt ebenso wenig — beides wäre eine
            # Zuweisung ins Nichts, genau die Klasse Fehler, die diese Prüfung
            # bei staff seit dem 17.08.2026 verhindert.
            if property_id is None:
                raise TaskError(
                    "Ein Eigentümer kann nur Aufgaben an einem eigenen Objekt "
                    "übernehmen — diese Aufgabe hat keinen Objektbezug.",
                    status_code=422,
                )
            gehoert = (
                self._db()
                .table("owner_property_assignments")
                .select("property_id")
                .eq("tenant_id", tenant_id)
                .eq("user_id", assignee_id)
                .eq("property_id", property_id)
                .limit(1)
                .execute()
            ).data
            if not gehoert:
                raise TaskError(
                    "Dieses Objekt gehört nicht diesem Eigentümer — er würde die "
                    "Aufgabe nicht sehen.",
                    status_code=422,
                )
            return
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

    def _regelnamen_fuer(
        self, rows: list[dict], ctx: AuthContext | None, tenant_id: str
    ) -> dict[str, str]:
        """Die Regelnamen dieser Aufgaben in der Sprache des Lesers (0511).

        Einmal je LISTE, nicht je Zeile. Ohne `ctx` gibt es keinen Leser und
        damit keine Sprache — dann bleiben die gespeicherten Titel stehen.
        """
        if ctx is None or not ctx.user_id:
            return {}
        rule_ids = [str(r["rule_id"]) for r in rows if r.get("rule_id")]
        if not rule_ids:
            return {}
        return namen_in_sprache(
            self._db(), rule_ids, lesersprache(self._db(), ctx.user_id, tenant_id)
        )

    def _to_task(
        self, row: dict[str, object], namen: dict[str, str] | None = None
    ) -> Task:
        """Eine tasks-Zeile als API-Objekt.

        `namen` (0511) sind die Regelnamen in der Sprache des Lesers, je
        `rule_id`. Ist eine Fassung dabei, ERSETZT sie den Titel.

        Warum der Titel ueberhaupt ersetzt werden muss: `tasks.title` ist eine
        KOPIE des Regelnamens, einmalig bei der Anlage gezogen
        (`engine._task_payload`). Die Kopie ist Absicht — eine Aufgabe soll ihren
        Titel behalten, auch wenn die Regel spaeter umbenannt oder geloescht
        wird. Sie bedeutet aber, dass eine spaetere Uebersetzung der Regel die
        vorhandenen Aufgaben nicht erreicht: live tragen 63 Aufgaben „Reng T"
        oder „Velk J". Deshalb wird hier gelesen statt dort geschrieben — ein
        UPDATE ueber alle Bestandsaufgaben waere der Gegenzustand, der bei jeder
        Sprache erneut faellig wuerde.

        Ohne Fassung bleibt der gespeicherte Titel stehen: das ist die ehrliche
        Auskunft, kein Ersatzwert (Wurzel 4).
        """
        insp = row.get("inspection_state")
        rule_id = str(row.get("rule_id") or "")
        titel = (namen or {}).get(rule_id) or row["title"]
        return Task(
            id=row["id"],
            tenant_id=row["tenant_id"],
            property_id=row.get("property_id"),
            reservation_id=row.get("reservation_id"),
            assignee_id=row.get("assignee_id"),
            title=titel,
            status=TaskStatus(row["status"]),
            due_at=row.get("due_at"),
            needs_inspection=bool(row.get("needs_inspection")),
            inspection_state=InspectionState(insp) if insp else None,
            source=TaskSource(row.get("source") or "manual"),
            priority=int(row.get("priority") or 0),
            start_at=row.get("start_at"),
            end_at=row.get("end_at"),
        )
