"""Service des announcements-Slice — Dashboard-Sicht und Backoffice-Redaktion.

Beide Wege laufen über den service_role-Client, weil beide Tabellen für
anon/authenticated hart gesperrt sind (0337, Wurzel 6). Der Client umgeht
damit RLS — jeder Scope muss hier im Code stehen.

DREI SCHICHTEN prüfen die Rolle, und das ist kein Versehen:

| Schicht                | Quelle              | frisch? | Aufgabe                     |
|------------------------|---------------------|---------|-----------------------------|
| RLS-Policy (0337)      | JWT-Claim           | nein    | schließt den DB-Direktpfad  |
| `require_role` (Router)| ctx.role aus dem JWT| nein    | billige erste Hürde         |
| `_rolle_pruefen` (hier)| public.users.role   | **ja**  | verbindlich                 |

`_rolle_pruefen` steht als ERSTE Zeile in jeder der drei Dashboard-Methoden
(Wurzel 9: der Scope des List-Pfads muss auch am Detail-/Schreib-Pfad gelten).
Grund: wird eine `co_admin` zur `cleaner` degradiert, gilt ihr Token noch bis
zu einer Stunde. Ohne die frische DB-Prüfung läse sie so lange weiter — dieselbe
Begründung wie bei `get_current_platform_admin` in core/security.py.
"""
from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import public_storage_url

from .schemas import (
    BILD_BUCKET,
    Announcement,
    AnnouncementCreate,
    AnnouncementList,
    AnnouncementUpdate,
    PopupResponse,
    QuittierenResponse,
    SliceHealth,
)

log = get_logger("nextdays.announcements")

# Zielgruppe. Bewusst als Konstante an EINER Stelle: die Liste steht sonst in
# Router-Guard, RLS-Policy und Service dreimal leicht verschieden da.
LEITUNGS_ROLLEN = frozenset({"admin", "co_admin"})

_SPALTEN = (
    "id, titel, inhalt_html, kurztext, status, kategorie, veroeffentlicht_am, "
    "gueltig_bis, als_popup, created_at, updated_at"
)

# Obergrenzen (Wurzel 8 — jeder unbegrenzte Bereich bekommt eine harte Grenze).
_POPUP_KANDIDATEN = 50
_LISTE_MAX = 200

# Magic-Bytes der beiden erlaubten Bildformate. Der vom Client mitgeschickte
# content_type wird bewusst ignoriert: er ist frei wählbar und damit kein
# Schutz. Eine als `image/png` deklarierte HTML-Datei bliebe sonst HTML — im
# public Bucket wäre das Stored-XSS auf unserer eigenen Storage-Domain.
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_BILD_MAX_BYTES = 10 * 1024 * 1024


class AnnouncementError(Exception):
    """Fachlicher Fehler mit HTTP-Status (der Router mappt ihn)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _bildtyp(content: bytes) -> tuple[str, str] | None:
    """(Endung, MIME) aus den Magic-Bytes. None = nicht erlaubt.

    Nur PNG und WebP: Screenshots sind das eine oder das andere. Kein SVG (ein
    SVG im public Bucket darf `<script>` tragen und wird vom Browser als
    Dokument ausgeführt), kein JPEG/GIF (Decoder-Angriffsfläche ohne Nutzen).
    """
    if content.startswith(_PNG_MAGIC):
        return "png", "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp", "image/webp"
    return None


def _zeitpunkt(wert: str | None) -> datetime | None:
    """ISO-Zeitstempel als echtes `datetime` — nie als String vergleichen.

    Ein lexikalischer Vergleich zweier Zeitstempel ist nur zufällig richtig: er
    stimmt, solange beide Seiten dieselbe Schreibweise tragen. `...+00:00` und
    `...Z` bezeichnen denselben Moment, sortieren als Text aber verschieden,
    und ein Offset wie `-01:00` kehrt das Ergebnis um. Postgres liefert heute
    einheitlich `+00:00`, doch daran hängt hier der Neukunden-Filter — also
    wird geparst statt sich auf die Schreibweise zu verlassen.

    Unlesbarer Wert → None. Der Aufrufer behandelt das wie „keine Grenze"
    (fail-open ist hier richtig: der Filter unterdrückt Anzeigen, er gewährt
    keinen Zugriff — der Rollen-Riegel steht davor).
    """
    if not wert:
        return None
    try:
        gelesen = datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError:
        log.warning("ankuendigung_zeitstempel_unlesbar", wert=wert)
        return None
    # Naive Werte als UTC deuten, sonst wirft der Vergleich TypeError.
    return gelesen if gelesen.tzinfo else gelesen.replace(tzinfo=UTC)


def _zeile(row: dict) -> Announcement:
    return Announcement(
        id=str(row["id"]),
        titel=row.get("titel") or "",
        inhalt_html=row.get("inhalt_html") or "",
        kurztext=row.get("kurztext"),
        status=row.get("status") or "entwurf",
        kategorie=row.get("kategorie") or "neuerung",
        veroeffentlicht_am=row.get("veroeffentlicht_am"),
        gueltig_bis=row.get("gueltig_bis"),
        als_popup=bool(row.get("als_popup", True)),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


class AnnouncementService:
    """Dashboard-Lesepfad und Backoffice-Redaktion in einem Service.

    Getrennt sind die beiden Welten über die AUFRUFER (zwei Router mit zwei
    Guards), nicht über zwei Klassen: sie teilen dieselben Tabellen, dieselbe
    Zeilen-Abbildung und dieselbe Statuslogik. Zwei Klassen wären zweimal
    dasselbe `_zeile` und zwei Orte, an denen man den Status vergisst.
    """

    def __init__(self, db: Client) -> None:
        self._db = db

    @property
    def db(self) -> Client:
        """Der DB-Client für das Audit-Protokoll des Backoffice.

        Bewusst nach außen gegeben statt eine zweite Client-Instanz im Router zu
        bauen: `audit.record` braucht denselben service_role-Client, und ein
        eigener wäre eine zweite Quelle derselben Verbindung.
        """
        return self._db

    def health(self) -> SliceHealth:
        return SliceHealth(slice="announcements")

    # === Dashboard =========================================================
    def _rolle_pruefen(self, ctx: AuthContext) -> str:
        """Rolle FRISCH aus public.users lesen und den Zugriff erzwingen.

        Gescopet auf `id` UND `tenant_id` (Wurzel 3): der service_role-Client
        umgeht RLS, ein Lookup allein per user_id würde die Rolle auch dann
        liefern, wenn der Nutzer inzwischen zu einem anderen Mandanten gehört.

        Gibt die tenant_id zurück, damit der Aufrufer sie nicht erneut aus dem
        (weniger vertrauenswürdigen) Token zieht.
        """
        if not ctx.tenant_id:
            raise AnnouncementError("Kein Mandant im Token.", status_code=403)
        rows = (
            self._db.table("users")
            .select("role")
            .eq("id", ctx.user_id)
            .eq("tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data or []
        # Fail-closed: keine Zeile = keine belegbare Rolle = kein Zugriff. Nie
        # auf ctx.role zurückfallen, das wäre der Wert, den wir gerade prüfen.
        if not rows or (rows[0].get("role") or "") not in LEITUNGS_ROLLEN:
            raise AnnouncementError(
                "Ankündigungen sind der Betriebsleitung vorbehalten.",
                status_code=403,
            )
        return ctx.tenant_id

    def _tenant_start(self, tenant_id: str) -> str | None:
        """Registrierungs-Zeitpunkt des Betriebs (Neukunden-Filter).

        Ohne diese Grenze ist für einen frisch registrierten Betrieb JEDE je
        veröffentlichte Ankündigung ungelesen — der erste Login wäre eine
        Klickstrecke durch die halbe Produkthistorie. Ältere bleiben auf
        /neuerungen nachlesbar, sie unterbrechen nur nicht mehr.
        """
        rows = (
            self._db.table("tenants")
            .select("created_at")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("created_at") if rows else None

    def _quittierte_ids(self, user_id: str, ids: list[str]) -> set[str]:
        """Welche der übergebenen Ankündigungen dieser Nutzer quittiert hat.

        Zweiter Roundtrip statt Join: der Python-Client kann keinen Anti-Join
        formulieren. Die Kandidatenmenge ist gedeckelt, damit das `in_` nicht
        unbegrenzt wächst.
        """
        if not ids:
            return set()
        rows = (
            self._db.table("announcement_reads")
            .select("announcement_id")
            .eq("user_id", user_id)
            .in_("announcement_id", ids)
            .execute()
        ).data or []
        return {str(r["announcement_id"]) for r in rows}

    def liste(self, ctx: AuthContext, *, limit: int = 50, offset: int = 0) -> AnnouncementList:
        """Historie für /neuerungen. Nur Veröffentlichtes, neueste zuerst.

        `gueltig_bis` filtert hier bewusst NICHT: ein abgelaufenes
        Wartungsfenster verschwindet aus der Unterbrechung, nicht aus der
        Historie. Archivierte (zurückgezogene) ebenfalls nicht — sie sollen
        nicht weiterverbreitet werden.
        """
        tenant_id = self._rolle_pruefen(ctx)
        limit = max(1, min(limit, _LISTE_MAX))
        rows = (
            self._db.table("announcements")
            .select(_SPALTEN)
            .eq("status", "veroeffentlicht")
            .order("veroeffentlicht_am", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        ).data or []
        items = [_zeile(r) for r in rows]

        # Ungelesen-Zähler auf derselben Seite: eine exakte Gesamtzahl über die
        # ganze Historie wäre ein dritter Roundtrip für eine Zahl, die im Badge
        # ohnehin gedeckelt dargestellt wird.
        start = _zeitpunkt(self._tenant_start(tenant_id))
        quittiert = self._quittierte_ids(ctx.user_id, [i.id for i in items])

        def _zaehlt(item: Announcement) -> bool:
            if item.id in quittiert:
                return False
            wann = _zeitpunkt(item.veroeffentlicht_am)
            return start is None or wann is None or wann >= start

        ungelesen = sum(1 for i in items if _zaehlt(i))
        # Die Quittierung je Zeile mitgeben: das Dashboard markiert damit die
        # ungelesenen Einträge. Sie steht hier ohnehin schon fest — sie zu
        # verschweigen hieße, das Frontend raten zu lassen.
        for item in items:
            item.quittiert = item.id in quittiert
        return AnnouncementList(items=items, total=len(items), ungelesen=ungelesen)

    def popup(self, ctx: AuthContext) -> PopupResponse:
        """Die älteste noch nicht quittierte Ankündigung — oder keine.

        AUFSTEIGEND sortiert: wer zwei Wochen weg war, bekommt sie in
        Erscheinungsreihenfolge, nicht rückwärts.

        Zwei Roundtrips, kein Join (der Client kann keinen Anti-Join): erst die
        sichtbaren Kandidaten aus dem partiellen Index, dann die quittierten IDs
        dieses Nutzers, erste Differenz gewinnt.
        """
        tenant_id = self._rolle_pruefen(ctx)
        jetzt = datetime.now(UTC).isoformat()
        start = self._tenant_start(tenant_id)

        query = (
            self._db.table("announcements")
            .select(_SPALTEN)
            .eq("status", "veroeffentlicht")
            .eq("als_popup", True)
            .or_(f"gueltig_bis.is.null,gueltig_bis.gte.{jetzt}")
        )
        # Der Neukunden-Filter läuft hier bewusst in der DB (`gte`): Postgres
        # vergleicht echte timestamptz und ist von der Schreibweise unabhängig.
        # In `liste` geht das nicht — dort wird nachgezählt und deshalb über
        # `_zeitpunkt` geparst, statt Strings zu vergleichen.
        if start:
            query = query.gte("veroeffentlicht_am", start)
        rows = (
            query.order("veroeffentlicht_am")
            .limit(_POPUP_KANDIDATEN)
            .execute()
        ).data or []

        kandidaten = [_zeile(r) for r in rows]
        quittiert = self._quittierte_ids(ctx.user_id, [k.id for k in kandidaten])
        offen = [k for k in kandidaten if k.id not in quittiert]
        if not offen:
            return PopupResponse(item=None, offen=0)
        return PopupResponse(item=offen[0], offen=len(offen))

    def quittieren(self, ctx: AuthContext, announcement_id: str) -> QuittierenResponse:
        """Aktives Schließen festhalten. Idempotent (Wurzel 2).

        Doppelklick, Retry nach Timeout und ein zweiter Tab kommen real doppelt
        an. `ignore_duplicates=True` nutzt den UNIQUE-Index aus 0337: der
        ursprüngliche Zeitpunkt bleibt stehen, statt vom Retry nach vorn
        geschoben zu werden.

        Ob es NEU war, wird VOR dem Schreiben ermittelt — die Antwort des
        ignorierenden Upserts ist je nach PostgREST-Version leer oder gefüllt
        und wäre damit kein belastbares Signal (Wurzel 4: keine erfundene
        Ableitung).
        """
        tenant_id = self._rolle_pruefen(ctx)
        # Scope-Riegel: nur eine tatsächlich veröffentlichte Ankündigung ist
        # quittierbar. Ohne diese Prüfung ließe sich per geratener UUID ein
        # ENTWURF quittieren — und damit belegen, dass er existiert.
        rows = (
            self._db.table("announcements")
            .select("id")
            .eq("id", announcement_id)
            .eq("status", "veroeffentlicht")
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AnnouncementError("Ankündigung nicht gefunden.", status_code=404)

        bereits = bool(self._quittierte_ids(ctx.user_id, [announcement_id]))
        self._db.table("announcement_reads").upsert(
            {
                "announcement_id": announcement_id,
                "user_id": ctx.user_id,
                "tenant_id": tenant_id,
            },
            on_conflict="announcement_id,user_id",
            ignore_duplicates=True,
        ).execute()
        return QuittierenResponse(ok=True, neu=not bereits)

    # === Backoffice ========================================================
    # Alle folgenden Methoden setzen einen bereits geprüften PlatformContext
    # voraus (CurrentPlatformAdmin am Router, Schreiben zusätzlich
    # require_platform_write als erste Zeile des Handlers). Sie führen deshalb
    # KEINE eigene Rollenprüfung — anders als der Dashboard-Pfad, wo die Rolle
    # aus einem bis zu eine Stunde alten Token stammt.
    def backoffice_liste(self, *, limit: int = 100, offset: int = 0) -> AnnouncementList:
        """Alle Ankündigungen inklusive Entwürfen, neueste zuerst.

        Sortiert nach `created_at`, nicht nach `veroeffentlicht_am`: Entwürfe
        haben keinen Veröffentlichungs-Zeitpunkt und würden sonst ans Ende
        rutschen — ausgerechnet die, an denen gearbeitet wird.
        """
        limit = max(1, min(limit, _LISTE_MAX))
        rows = (
            self._db.table("announcements")
            .select(_SPALTEN)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        ).data or []
        items = [_zeile(r) for r in rows]
        return AnnouncementList(items=items, total=len(items), ungelesen=0)

    def backoffice_detail(self, announcement_id: str) -> Announcement:
        return _zeile(self._laden(announcement_id))

    def _laden(self, announcement_id: str) -> dict:
        rows = (
            self._db.table("announcements")
            .select(_SPALTEN)
            .eq("id", announcement_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise AnnouncementError("Ankündigung nicht gefunden.", status_code=404)
        return rows[0]

    def erstellen(self, req: AnnouncementCreate, *, erstellt_von: str) -> Announcement:
        """Neuen Entwurf anlegen. Status ist nicht wählbar — siehe Schema."""
        ins = (
            self._db.table("announcements")
            .insert(
                {
                    "titel": req.titel.strip(),
                    "inhalt_html": req.inhalt_html,
                    "kurztext": (req.kurztext or "").strip() or None,
                    "kategorie": req.kategorie.value,
                    "als_popup": req.als_popup,
                    "gueltig_bis": req.gueltig_bis,
                    "status": "entwurf",
                    "erstellt_von": erstellt_von,
                }
            )
            .execute()
        ).data
        if not ins:
            raise AnnouncementError("Anlegen fehlgeschlagen.", status_code=500)
        return _zeile(ins[0])

    def aktualisieren(
        self, announcement_id: str, req: AnnouncementUpdate
    ) -> Announcement:
        """Teil-Update. Nur mitgeschickte Felder werden geschrieben.

        `exclude_unset` statt `exclude_none`: sonst ließe sich `kurztext` oder
        `gueltig_bis` nie wieder leeren — ein `null` wäre nicht von „nicht
        mitgeschickt" zu unterscheiden.
        """
        self._laden(announcement_id)
        patch: dict[str, Any] = req.model_dump(exclude_unset=True, mode="json")
        if "titel" in patch and patch["titel"]:
            patch["titel"] = str(patch["titel"]).strip()
        if not patch:
            return self.backoffice_detail(announcement_id)
        patch["updated_at"] = datetime.now(UTC).isoformat()
        upd = (
            self._db.table("announcements")
            .update(patch)
            .eq("id", announcement_id)
            .execute()
        ).data
        if not upd:
            raise AnnouncementError("Ankündigung nicht gefunden.", status_code=404)
        return _zeile(upd[0])

    def veroeffentlichen(self, announcement_id: str) -> Announcement:
        """Freigeben. Setzt den fachlichen Veröffentlichungs-Zeitpunkt.

        Bereits veröffentlichte behalten ihren ursprünglichen Zeitpunkt: ein
        zweiter Klick (Doppelklick, Retry) darf die Mitteilung nicht in der
        Historie nach vorn schieben und sie nicht bei allen erneut als
        ungelesen erscheinen lassen (Wurzel 2).
        """
        row = self._laden(announcement_id)
        if not (row.get("titel") or "").strip():
            raise AnnouncementError("Ohne Titel nicht veröffentlichbar.", status_code=422)
        patch: dict[str, Any] = {
            "status": "veroeffentlicht",
            "updated_at": datetime.now(UTC).isoformat(),
        }
        if not row.get("veroeffentlicht_am"):
            patch["veroeffentlicht_am"] = datetime.now(UTC).isoformat()
        upd = (
            self._db.table("announcements")
            .update(patch)
            .eq("id", announcement_id)
            .execute()
        ).data
        return _zeile(upd[0] if upd else {**row, **patch})

    def zurueckziehen(self, announcement_id: str) -> Announcement:
        """Stoppt die Weiterverbreitung eines veröffentlichten Tippfehlers.

        BEKANNTE GRENZE: wer bereits quittiert hat, ist damit nicht erreicht —
        das Zurückziehen entfernt die Mitteilung aus Popup und Historie, es
        macht sie nicht ungesehen. Die Quittierungen bleiben absichtlich
        stehen: würde man sie löschen, käme eine korrigierte Fassung bei allen
        erneut als Popup hoch, auch bei denen, die den Fehler nie gesehen haben.
        """
        self._laden(announcement_id)
        upd = (
            self._db.table("announcements")
            .update(
                {
                    "status": "archiviert",
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", announcement_id)
            .execute()
        ).data
        if not upd:
            raise AnnouncementError("Ankündigung nicht gefunden.", status_code=404)
        return _zeile(upd[0])

    def loeschen(self, announcement_id: str) -> None:
        """Entwurf endgültig entfernen — NUR im Status `entwurf`.

        Eine veröffentlichte Ankündigung wird zurückgezogen, nicht gelöscht:
        ihre Quittierungen sind Teil der Historie („der Betrieb wurde
        informiert"), und ein `on delete cascade` würde sie stillschweigend
        mitnehmen.
        """
        row = self._laden(announcement_id)
        if row.get("status") != "entwurf":
            raise AnnouncementError(
                "Nur Entwürfe können gelöscht werden. Veröffentlichte "
                "Ankündigungen bitte zurückziehen.",
                status_code=409,
            )
        self._bilder_entfernen(announcement_id)
        self._db.table("announcements").delete().eq("id", announcement_id).execute()

    def _bilder_entfernen(self, announcement_id: str) -> None:
        """Screenshots der Ankündigung aus dem Bucket räumen.

        Ohne diesen Schritt bleiben Waisen liegen, die niemand mehr findet: der
        Pfad ist nach `{announcement_id}/` benannt, und die ID ist nach dem
        Löschen weg.
        """
        try:
            objekte = self._db.storage.from_(BILD_BUCKET).list(announcement_id) or []
            pfade = [
                f"{announcement_id}/{o['name']}"
                for o in objekte
                if isinstance(o, dict) and o.get("name")
            ]
            if pfade:
                self._db.storage.from_(BILD_BUCKET).remove(pfade)
        except Exception as exc:  # noqa: BLE001 — Waisen sind kein Grund für 500
            # Best-effort: das Löschen der Zeile ist der Hauptpfad und darf an
            # einer Storage-Störung nicht scheitern. Der Rest bleibt als
            # unreferenzierte Datei liegen und ist über den Log auffindbar.
            log.warning(
                "ankuendigung_bilder_aufraeumen_fehlgeschlagen",
                announcement_id=announcement_id,
                error=str(exc),
            )

    def bild_hochladen(
        self, announcement_id: str, *, content: bytes
    ) -> str:
        """Screenshot ablegen und die öffentliche URL zurückgeben.

        Der Typ wird AUSSCHLIESSLICH aus den Magic-Bytes bestimmt, nie aus dem
        Client-`content_type` (Wurzel 8). Der Dateiname ist nicht ratbar
        (`token_hex`), weil der Bucket public ist.
        """
        self._laden(announcement_id)
        if not content:
            raise AnnouncementError("Die Datei ist leer.", status_code=422)
        if len(content) > _BILD_MAX_BYTES:
            raise AnnouncementError(
                f"Die Datei ist zu groß (max. {_BILD_MAX_BYTES // (1024 * 1024)} MB).",
                status_code=413,
            )
        typ = _bildtyp(content)
        if typ is None:
            raise AnnouncementError(
                "Nur PNG und WebP sind erlaubt.", status_code=422
            )
        endung, mime = typ
        pfad = f"{announcement_id}/{secrets.token_hex(8)}.{endung}"
        self._db.storage.from_(BILD_BUCKET).upload(
            pfad, content, {"content-type": mime, "upsert": "false"}
        )
        return public_storage_url(BILD_BUCKET, pfad)
