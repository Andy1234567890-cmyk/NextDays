"""Dienstleistungen, die der Eigentuemer direkt beauftragt (Etappe D).

BEWUSST EIN EIGENES MODUL neben `service.py`: der Auftrag ist fachlich kein
Portal-Lesepfad, sondern ein SCHREIBpfad in einen fremden Slice (`tasks`). Er
haengt an drei Dingen — Owner-Scope, Dienstleistungs-Katalog und Aufgaben-
Erzeugung — und wuerde `service.py` verbreitern, ohne dort etwas zu gewinnen.

Abgrenzung (wichtig, gleiche Woerter, zwei Domaenen): Das hier ist NICHT das
Gaeste-Addon aus 0074_property_addons. Dort kauft der GAST eine Zusatzleistung
zu seiner Buchung; hier beauftragt der EIGENTUEMER eine Leistung an seinem
Objekt, die als `tasks`-Zeile beim Betrieb landet.

Sicherheitsleitplanken:
  * Wurzel 3/9 — `property_id` wird ueber `_require_own` gegen
    `owner_property_assignments` geprueft, nie roh inline verglichen. Der
    Lesepfad (`my_service_requests`) scopt auf DIESELBE Menge plus den eigenen
    `requested_by`: ein Eigentuemer sieht keine fremden Aufgaben.
  * Wurzel 2 — Doppelklick erzeugt keinen zweiten Auftrag: der Dedup-Key wird
    VOR dem Insert gebildet, und der UNIQUE-Index `tasks_request_dedup_uq`
    (0330) ist der Backstop, der auch bei zwei parallelen Requests greift.
  * Wurzel 8 — Freitext und Zeitraum sind hart begrenzt (siehe schemas), der
    Freitext wird zusaetzlich auf Steuerzeichen geprueft.
  * Wurzel 4 — findet sich kein Stamm-Mitarbeiter, bleibt der Auftrag
    UNZUGEWIESEN. Kein erfundener Default-Empfaenger.
"""
from __future__ import annotations

import hashlib
from datetime import UTC, date, datetime, time, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.notification_settings.ereignisse import melde_aufgaben_zuweisung

from .schemas_dienstleistungen import (
    ServiceRequestCreate,
    ServiceRequestItem,
    ServiceRequestList,
    ServiceTypeItem,
    ServiceTypeList,
)

log = get_logger("nextdays.portal_dienstleistungen")

# Wieviel Vorlauf ein Auftrag maximal haben darf. Ohne Obergrenze koennte ein
# Client Auftraege ins Jahr 3000 legen und die Aufgabenlisten des Betriebs
# vermuellen (Wurzel 8 — jeder unbegrenzte Bereich bekommt eine Grenze).
MAX_VORLAUF_TAGE = 730

# Wie viele Auftraege ein Eigentuemer je Termin absetzen darf. Die Idempotenz
# greift bei Freitext nicht (jeder abweichende Text ist ein neuer Auftrag), also
# braucht es hier eine harte Grenze (Wurzel 8).
MAX_AUFTRAEGE_PRO_TAG = 20

# Obergrenze der zurueckgelieferten Liste. Ohne Cap waechst die Antwort mit der
# Historie unbegrenzt.
MAX_LISTE = 200

# Fallback-Fenster, wenn der Katalog-Typ keine Standard-Dauer traegt und der
# Eigentuemer keines nennt. KEIN erfundener Wert: das Feld bleibt dann leer,
# `end_at` wird NULL. Siehe `_zeitfenster`.


class DienstleistungError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DienstleistungsService:
    """Katalog lesen und Dienstleistungen beauftragen — im Owner-Scope."""

    def __init__(self, service_client: Client | None = None) -> None:
        self._db = service_client

    # --- Scope ---------------------------------------------------------------

    def _require(self, ctx: AuthContext) -> tuple[str, str]:
        if not ctx.tenant_id or not ctx.user_id:
            raise DienstleistungError("Kein Tenant/Nutzer im Konto.", status_code=400)
        return ctx.tenant_id, ctx.user_id

    def _owned_property_ids(self, ctx: AuthContext) -> list[str]:
        """Objekte dieses Eigentuemers. Fail-closed: keine Zuordnung → leer.

        Bewusst dieselbe Quelle wie `PublicPortalService._owned_property_ids`
        (`owner_property_assignments`) — der Auftrag darf keinen zweiten,
        grosszuegigeren Scope-Begriff einfuehren als der Rest des Portals.
        """
        tenant_id, user_id = self._require(ctx)
        rows = (
            self._db.table("owner_property_assignments")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        ).data or []
        return [str(r["property_id"]) for r in rows]

    def _require_own(self, ctx: AuthContext, property_id: str) -> None:
        if property_id not in self._owned_property_ids(ctx):
            raise DienstleistungError("Objekt nicht gefunden.", status_code=404)

    # --- Katalog -------------------------------------------------------------

    def catalog(self, ctx: AuthContext) -> ServiceTypeList:
        """Beauftragbare Leistungen: Systemvorgaben + eigene des Betriebs.

        Der Anzeigename kommt NICHT von hier — die Antwort traegt nur den
        stabilen `key`, beschriftet wird in der Oberflaeche ueber die Message-
        Kataloge (`services.type.<key>`). Ein deutsches Wort aus dem Backend
        waere in 23 der 24 Sprachen falsch (Wurzel 4).
        """
        tenant_id, _ = self._require(ctx)
        # PostgREST-`or`: Systemvorgaben (tenant_id is null) plus die eigenen.
        # Der Mandanten-Filter steht IM or-Ausdruck, nicht daneben — sonst
        # faenge das `is.null` alle Mandanten mit ein.
        rows = (
            self._db.table("service_types")
            .select("id, key, kategorie, standard_dauer_minuten, sortierung, tenant_id")
            .or_(f"tenant_id.is.null,tenant_id.eq.{tenant_id}")
            .eq("aktiv", True)
            .order("sortierung")
            .execute()
        ).data or []
        items = [
            ServiceTypeItem(
                id=str(r["id"]),
                key=str(r["key"]),
                # `kategorie` ist NOT NULL DEFAULT in der DB (0330) — ein
                # `or "cleaning"` waere ein Ersatzwert fuer einen Zustand, den
                # es nicht gibt, und wuerde einen echten Datenfehler kaschieren
                # (Wurzel 4).
                kategorie=str(r["kategorie"]),
                standard_dauer_minuten=r.get("standard_dauer_minuten"),
                system=r.get("tenant_id") is None,
            )
            for r in rows
        ]
        return ServiceTypeList(items=items, total=len(items))

    def _service_type(self, tenant_id: str, service_type_id: str) -> dict:
        """Einen Katalog-Typ laden — gescopt auf Systemvorgabe ODER den eigenen
        Mandanten. Ein fremder Typ ist „nicht gefunden", nicht „verboten":
        die Existenz fremder Mandanten-Daten wird nicht verraten (Wurzel 3)."""
        rows = (
            self._db.table("service_types")
            .select("id, key, standard_dauer_minuten, tenant_id, aktiv")
            .eq("id", service_type_id)
            .or_(f"tenant_id.is.null,tenant_id.eq.{tenant_id}")
            .limit(1)
            .execute()
        ).data or []
        if not rows or not rows[0].get("aktiv"):
            raise DienstleistungError(
                "Dienstleistung nicht gefunden.", status_code=404
            )
        return rows[0]

    # --- Beauftragen ---------------------------------------------------------

    def request_service(
        self, ctx: AuthContext, req: ServiceRequestCreate
    ) -> ServiceRequestItem:
        """Eine Dienstleistung beauftragen. Landet als `tasks`-Zeile.

        Reihenfolge ist Absicht: erst Scope, dann Katalog, dann Zeitraum, und
        ERST DANN der Seiteneffekt. Der Dedup-Key steht vor dem Insert fest
        (Wurzel 2) — wird er im Insert erzeugt, hat jeder Retry einen anderen
        und die Entdopplung greift nie.
        """
        tenant_id, user_id = self._require(ctx)
        self._require_own(ctx, req.property_id)

        typ = (
            self._service_type(tenant_id, req.service_type_id)
            if req.service_type_id
            else None
        )
        self._pruefe_zeitraum(req)
        self._pruefe_tagesmenge(tenant_id, user_id, req)

        start_at, end_at = self._zeitfenster(req, typ)
        titel = self._titel(req, typ)
        assignee_id = self._stamm_mitarbeiter(
            tenant_id, req.property_id, req.service_type_id
        )
        dedup = self._dedup_key(user_id, req)

        zeile = {
            "tenant_id": tenant_id,
            "property_id": req.property_id,
            "service_type_id": req.service_type_id,
            "requested_by": user_id,
            "request_dedup_key": dedup,
            "assignee_id": assignee_id,
            "title": titel,
            "description": req.notiz or None,
            "status": "open",
            # `start_at` MUSS gesetzt sein: der Aufgaben-Kalender filtert auf
            # `start_at or due_at` — ohne beides faellt der Auftrag aus der
            # Timeline und der Betrieb saehe ihn dort nie (nachgeprueft an
            # tasks/service.py::_calendar_tasks).
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat() if end_at else None,
            "due_at": (end_at or start_at).isoformat(),
            "source": "manual",
            # DER EIGENTUEMER hat sie bestellt (0510/0531). Das Kennzeichen
            # stand hier nicht und blieb auf `false`, obwohl genau dieser Pfad
            # die Eigentuemer-Bestellung IST. Es entscheidet zweierlei: dass
            # die Aufgabe auch bei einer Eigennutzung entsteht (0510) und dass
            # sie beim Abschluss in die Abrechnung des Eigentuemers wandert
            # (0531). Ohne es blieb die ausgefuehrte Leistung unberechnet.
            "ordered_by_owner": True,
            "priority": 0,
        }
        row, neu = self._insert_idempotent(tenant_id, zeile, dedup)
        # Der zustaendige Mitarbeiter erfaehrt vom Auftrag (0331) — aber NUR bei
        # echter Neuanlage (Wurzel 2). Der `dedup_key` der Meldung schuetzt
        # allein die Glocke (partieller UNIQUE-Index, 0287); E-Mail und SMS
        # kennen keine Entdopplung. Ohne dieses `neu` bekaeme die Reinigungs-
        # kraft bei jedem Doppelklick eine weitere Mail, obwohl kein zweiter
        # Auftrag entstanden ist.
        if neu:
            melde_aufgaben_zuweisung(
                self._db,
                tenant_id=tenant_id,
                task_id=str(row["id"]),
                assignee_id=(
                    str(row["assignee_id"]) if row.get("assignee_id") else None
                ),
                titel=titel,
                property_id=req.property_id,
            )
        log.info(
            "portal_dienstleistung_beauftragt",
            tenant_id=tenant_id,
            property_id=req.property_id,
            service_type_id=req.service_type_id,
            zugewiesen=bool(assignee_id),
        )
        return _item(row, key=(typ or {}).get("key"))

    def _insert_idempotent(
        self, tenant_id: str, zeile: dict, dedup: str
    ) -> tuple[dict, bool]:
        """Einfuegen, aber ein Doppelklick liefert den BESTEHENDEN Auftrag.

        Rueckgabe: (Zeile, neu_angelegt). Das Flag ist nicht kosmetisch — der
        Aufrufer benachrichtigt NUR bei echter Neuanlage, weil der Dedup-Key
        einer Benachrichtigung nur die Glocke schuetzt, nicht E-Mail/SMS.

        Zwei Stufen, beide noetig (Wurzel 2):
          1. Vorher nachsehen — faengt den normalen Doppelklick ab, ohne dass
             ein Fehler entsteht.
          2. Der 23505 des UNIQUE-Index `tasks_request_dedup_uq` — faengt das
             echte Rennen zweier gleichzeitiger Requests ab, das Stufe 1
             prinzipbedingt nicht sehen kann. Das ist der Zielzustand, kein
             Fehler: der bestehende Auftrag wird nachgeladen und geliefert.
        """
        bestehend = self._by_dedup(tenant_id, dedup)
        if bestehend:
            return bestehend, False
        try:
            res = self._db.table("tasks").insert(zeile).execute()
        except Exception as exc:  # noqa: BLE001 — Fremdbibliothek, Code-Prüfung
            # Der Supabase-Client wirft je nach Version verschiedene Typen; der
            # Konflikt ist am Code 23505 erkennbar. NUR dieser Fall gilt als
            # Erfolg — jeder andere Fehler wird re-raised, nicht verschluckt
            # (Wurzel 5).
            if "23505" not in str(exc):
                raise
            bestehend = self._by_dedup(tenant_id, dedup)
            if bestehend:
                return bestehend, False
            raise
        if not res.data:
            raise DienstleistungError(
                "Auftrag konnte nicht angelegt werden.", status_code=500
            )
        return res.data[0], True

    def _pruefe_tagesmenge(
        self, tenant_id: str, user_id: str, req: ServiceRequestCreate
    ) -> None:
        """Obergrenze fuer Auftraege desselben Nutzers am selben Termin.

        Die Idempotenz allein genuegt hier NICHT: der Dedup-Key enthaelt bei
        Freitext-Auftraegen den Text, also ist jeder abweichende Wortlaut ein
        neuer, voellig legitimer Auftrag. Ohne Grenze koennte ein Owner-Login
        damit beliebig viele `tasks`-Zeilen (und Benachrichtigungen) beim
        Betrieb erzeugen — genau der unbegrenzte Bereich, den Wurzel 8 verbietet.

        Die Grenze ist bewusst grosszuegig: sie soll Missbrauch bremsen, nicht
        einen Eigentuemer, der an einem Tag wirklich mehrere Arbeiten braucht.
        """
        vorhanden = (
            self._db.table("tasks")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .eq("requested_by", user_id)
            .gte("start_at", req.datum.isoformat())
            .lte("start_at", f"{req.datum.isoformat()}T23:59:59+00:00")
            .execute()
        )
        anzahl = vorhanden.count
        if anzahl is None:
            anzahl = len(vorhanden.data or [])
        if anzahl >= MAX_AUFTRAEGE_PRO_TAG:
            raise DienstleistungError(
                "Zu viele Aufträge für diesen Tag.", status_code=422
            )

    def _by_dedup(self, tenant_id: str, dedup: str) -> dict | None:
        rows = (
            self._db.table("tasks")
            .select(_TASK_COLS)
            .eq("tenant_id", tenant_id)
            .eq("request_dedup_key", dedup)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    # --- Lesen ---------------------------------------------------------------

    def my_service_requests(self, ctx: AuthContext) -> ServiceRequestList:
        """Die vom Eigentuemer selbst beauftragten Leistungen.

        Doppelt gescopt (Wurzel 9 — derselbe Scope wie der Schreibpfad):
        `requested_by = ich` UND das Objekt gehoert mir. Der erste Filter allein
        genuegte nicht, wenn eine Objekt-Zuordnung spaeter entzogen wird; der
        zweite allein zeigte fremde Auftraege an meinem Objekt. Beides zusammen
        heisst: nur MEINE Auftraege an MEINEN Objekten — keine fremden Aufgaben
        des Betriebs (§4.3) und keine Finanz-/Vertriebsdaten.
        """
        tenant_id, user_id = self._require(ctx)
        ids = self._owned_property_ids(ctx)
        if not ids:
            return ServiceRequestList(items=[], total=0)
        rows = (
            self._db.table("tasks")
            .select(_TASK_COLS)
            .eq("tenant_id", tenant_id)
            .eq("requested_by", user_id)
            .in_("property_id", ids)
            .order("start_at", desc=True)
            # Gedeckelt (Wurzel 8): die Historie waechst, die Antwort nicht.
            .limit(MAX_LISTE)
            .execute()
        ).data or []
        keys = self._keys_fuer(rows)
        items = [_item(r, key=keys.get(str(r.get("service_type_id") or ""))) for r in rows]
        return ServiceRequestList(items=items, total=len(items))

    def _keys_fuer(self, rows: list[dict]) -> dict[str, str]:
        """Katalog-Schluessel der referenzierten Typen (fuer die Beschriftung)."""
        ids = {str(r["service_type_id"]) for r in rows if r.get("service_type_id")}
        if not ids:
            return {}
        typen = (
            self._db.table("service_types")
            .select("id, key")
            .in_("id", sorted(ids))
            .execute()
        ).data or []
        return {str(t["id"]): str(t["key"]) for t in typen}

    # --- Helfer --------------------------------------------------------------

    @staticmethod
    def _pruefe_zeitraum(req: ServiceRequestCreate) -> None:
        """Zeitraum plausibel und begrenzt (Wurzel 8).

        Die Feldgrenzen (Laenge, Format) sitzen im Schema; hier stehen die
        Regeln, die zwei Felder in Beziehung setzen.
        """
        heute = datetime.now(UTC).date()
        if req.datum < heute - timedelta(days=1):
            # Ein Tag Toleranz fuer Zeitzonen-Versatz des Clients.
            raise DienstleistungError(
                "Termin liegt in der Vergangenheit.", status_code=422
            )
        if req.datum > heute + timedelta(days=MAX_VORLAUF_TAGE):
            raise DienstleistungError(
                f"Termin liegt weiter als {MAX_VORLAUF_TAGE} Tage in der Zukunft.",
                status_code=422,
            )
        if req.datum_bis is not None:
            if req.datum_bis < req.datum:
                raise DienstleistungError(
                    "Enddatum vor Startdatum.", status_code=422
                )
            if (req.datum_bis - req.datum).days > MAX_VORLAUF_TAGE:
                raise DienstleistungError(
                    "Zeitraum zu lang.", status_code=422
                )

    @staticmethod
    def _zeitfenster(
        req: ServiceRequestCreate, typ: dict | None
    ) -> tuple[datetime, datetime | None]:
        """Start- und Endzeitpunkt des Auftrags.

        Ohne Uhrzeit beginnt der Auftrag um 00:00 des Tages — der Aufgaben-
        Kalender braucht nur ein Datum fuer die Timeline. Das Ende ergibt sich
        aus `datum_bis` oder der Standard-Dauer des Katalog-Typs. Traegt der Typ
        keine Dauer und nennt der Eigentuemer kein Enddatum, bleibt `end_at`
        LEER — kein erfundenes „dauert bestimmt zwei Stunden" (Wurzel 4).
        """
        start = datetime.combine(req.datum, time.min, tzinfo=UTC)
        if req.datum_bis is not None:
            # Ganztaegig bis einschliesslich `datum_bis`.
            return start, datetime.combine(
                req.datum_bis + timedelta(days=1), time.min, tzinfo=UTC
            )
        dauer = (typ or {}).get("standard_dauer_minuten")
        if dauer:
            return start, start + timedelta(minutes=int(dauer))
        return start, None

    @staticmethod
    def _titel(req: ServiceRequestCreate, typ: dict | None) -> str:
        """Der Aufgaben-Titel.

        Bei einem Katalog-Typ ist das der stabile `key` — beschriftet wird in
        der Oberflaeche uebersetzt (`services.type.<key>`), nicht hier. Bei
        einer Freitext-Anfrage der Text des EIGENTUEMERS: den hat er in seiner
        Sprache geschrieben, er ist die Wahrheit und wird nicht uebersetzt.
        """
        if typ is not None:
            return str(typ["key"])
        return (req.freitext or "").strip()

    def _stamm_mitarbeiter(
        self, tenant_id: str, property_id: str, service_type_id: str | None
    ) -> str | None:
        """Zustaendiger Mitarbeiter, ueber den BESTEHENDEN Weg.

        Zwei Stufen, absteigend spezifisch:
          1. `property_service_assignees` — „wer macht die Endreinigung in
             Haus X" (0330).
          2. `staff_property_assignments` — der Stamm-Mitarbeiter des Objekts,
             sofern es GENAU EINEN gibt.
        Sind mehrere Mitarbeiter am Objekt und keiner ist fuer diesen Typ
        hinterlegt, waere jede Wahl geraten → der Auftrag bleibt UNZUGEWIESEN
        und der Betrieb entscheidet. Ebenso, wenn es gar keinen gibt. Kein
        erfundener Default-Empfaenger (Wurzel 4).
        """
        if service_type_id:
            rows = (
                self._db.table("property_service_assignees")
                .select("assignee_id")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .eq("service_type_id", service_type_id)
                .limit(1)
                .execute()
            ).data or []
            if rows:
                return str(rows[0]["assignee_id"])
        staff = (
            self._db.table("staff_property_assignments")
            .select("user_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .limit(2)
            .execute()
        ).data or []
        if len(staff) == 1:
            return str(staff[0]["user_id"])
        return None

    @staticmethod
    def _dedup_key(user_id: str, req: ServiceRequestCreate) -> str:
        """Fachliche Identitaet des Auftrags — VOR dem Insert gebildet.

        Gleiche Person, gleiches Objekt, gleiche Leistung, gleicher Tag = ein
        Auftrag. Die Notiz geht bewusst NICHT ein: ein Doppelklick schickt sie
        identisch mit, und ein Eigentuemer, der wirklich zweimal dasselbe am
        selben Tag will, aendert das Datum oder ruft den Betrieb an — lieber
        eine Dopplung verhindern als zwei Reinigungskraefte schicken.

        Gehasht, weil der Freitext bis 500 Zeichen lang sein darf und der
        Schluessel in einen Index geht.
        """
        roh = "|".join(
            [
                user_id,
                req.property_id,
                req.service_type_id or f"frei:{(req.freitext or '').strip().lower()}",
                req.datum.isoformat(),
            ]
        )
        return hashlib.sha256(roh.encode("utf-8")).hexdigest()


_TASK_COLS = (
    "id, property_id, service_type_id, title, description, status, "
    "start_at, end_at, assignee_id, created_at"
)


def _item(row: dict, *, key: str | None) -> ServiceRequestItem:
    """Aufgaben-Zeile → Portal-Antwort.

    Was der Eigentuemer NICHT bekommt (§4.3): `assignee_id` als ID oder Name
    des Mitarbeiters — wer putzt, ist Personaleinsatz des Betriebs, nicht seine
    Angelegenheit. Er sieht nur, OB der Auftrag angenommen wurde.
    """
    return ServiceRequestItem(
        id=str(row["id"]),
        property_id=str(row["property_id"]) if row.get("property_id") else None,
        service_type_id=(
            str(row["service_type_id"]) if row.get("service_type_id") else None
        ),
        service_key=key,
        titel=str(row.get("title") or ""),
        notiz=row.get("description"),
        status=str(row.get("status") or "open"),
        zugewiesen=bool(row.get("assignee_id")),
        start_at=_as_date(row.get("start_at")),
        created_at=str(row["created_at"]) if row.get("created_at") else None,
    )


def _as_date(value: object) -> date | None:
    if not value:
        return None
    text = str(value)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None
