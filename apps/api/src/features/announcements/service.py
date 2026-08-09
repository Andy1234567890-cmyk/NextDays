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
    AnnouncementUebersetzung,
    AnnouncementUpdate,
    PopupResponse,
    QuittierenResponse,
    SliceHealth,
    UebersetzungsUebersicht,
    UebersetzungUpdate,
    sanitize_inhalt,
)

# `UebersetzungError` wird hier bewusst NICHT importiert: der Service fängt ihn
# nicht. Er läuft unverändert bis zum Router durch, der ihn auf 503/422 abbildet
# (Wurzel 5 — ein Ausfall des Übersetzungsdienstes darf nicht als „fertig"
# durchgehen und nicht in einen anderen Fehlertyp umgedeutet werden).
from .uebersetzung import (
    QUELLSPRACHE,
    ZIELSPRACHEN,
    fassung_erzeugen,
    laengen_pruefen,
    quelle_hash,
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

# Spalten der Übersetzungstabelle (0347).
_U_SPALTEN = (
    "sprache, titel, kurztext, inhalt_html, geprueft, geprueft_am, quelle_hash"
)

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

    def liste(
        self,
        ctx: AuthContext,
        *,
        limit: int = 50,
        offset: int = 0,
        sprache: str | None = None,
    ) -> AnnouncementList:
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

        # Die Fassung in der Sprache des Lesers auflegen. EIN Roundtrip für die
        # ganze Seite; fehlt eine Fassung, bleibt der Originaltext stehen
        # (siehe `_anwenden`).
        if sprache:
            fassungen = self._fassungen_fuer([i.id for i in items], sprache)
            items = [self._anwenden(i, fassungen.get(i.id)) for i in items]
        return AnnouncementList(items=items, total=len(items), ungelesen=ungelesen)

    def popup(self, ctx: AuthContext, *, sprache: str | None = None) -> PopupResponse:
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
        erste = offen[0]
        # Nur für die EINE gezeigte Ankündigung nachschlagen — die übrigen
        # `offen` sind bloß eine Zahl („1 von 3") und werden nie gerendert.
        if sprache:
            erste = self._anwenden(
                erste, self._fassungen_fuer([erste.id], sprache).get(erste.id)
            )
        return PopupResponse(item=erste, offen=len(offen))

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
        # Die `de`-Zeile beim Veröffentlichen sicher spiegeln. Sie ist der
        # Originaltext und entsteht ohne API-Aufruf; ohne sie hätte eine nie
        # übersetzte Ankündigung überhaupt keine Fassung, und der Sprachstand
        # im Backoffice zeigte „24 fehlend" statt „23 fehlend".
        self._original_schreiben(
            announcement_id, row, self._quelle_hash_von(row)
        )
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

    # === Übersetzungen (0347) ==============================================
    # DIE ZUSAGE DIESES ABSCHNITTS: eine Fassung mit `geprueft = true` wird von
    # keinem automatischen Lauf verändert. Sie steht nicht nur als if-Zweig im
    # Code, sondern als `.eq("geprueft", False)` in der WHERE-Klausel JEDES
    # maschinellen Schreibens — eine geprüfte Zeile ist für den Automaten
    # schlicht nicht adressierbar. Ein vergessener if-Zweig wäre ein Bug; eine
    # vergessene WHERE-Klausel schreibt gar nichts.

    def _uebersetzungen_laden(self, announcement_id: str) -> list[dict]:
        rows = (
            self._db.table("announcement_translations")
            .select(_U_SPALTEN)
            .eq("announcement_id", announcement_id)
            .execute()
        ).data or []
        return list(rows)

    def _quelle_hash_von(self, row: dict) -> str:
        return quelle_hash(
            row.get("titel") or "",
            row.get("kurztext"),
            row.get("inhalt_html") or "",
        )

    def uebersicht(self, announcement_id: str) -> UebersetzungsUebersicht:
        """Sprachstand fürs Backoffice: vorhanden, fehlend, veraltet.

        `veraltet` wird hier BERECHNET (Hash-Vergleich), nicht gelesen — siehe
        die Begründung am Schema. Die Quellsprache zählt mit: sie ist eine
        vollwertige Fassung (das Original), nur eben nie maschinell erzeugt.
        """
        row = self._laden(announcement_id)
        aktueller = self._quelle_hash_von(row)
        vorhanden = self._uebersetzungen_laden(announcement_id)

        items: list[AnnouncementUebersetzung] = []
        veraltet: list[str] = []
        for r in sorted(vorhanden, key=lambda x: str(x.get("sprache") or "")):
            ist_veraltet = (r.get("quelle_hash") or "") != aktueller
            sprache = str(r.get("sprache") or "")
            if ist_veraltet:
                veraltet.append(sprache)
            items.append(
                AnnouncementUebersetzung(
                    sprache=sprache,
                    titel=r.get("titel") or "",
                    kurztext=r.get("kurztext"),
                    inhalt_html=r.get("inhalt_html") or "",
                    geprueft=bool(r.get("geprueft")),
                    geprueft_am=r.get("geprueft_am"),
                    veraltet=ist_veraltet,
                )
            )

        da = {str(r.get("sprache") or "") for r in vorhanden}
        # Sortiert, damit die Backoffice-Liste eine stabile Reihenfolge hat und
        # nicht bei jedem Laden springt.
        fehlend = sorted(({QUELLSPRACHE} | ZIELSPRACHEN) - da)
        return UebersetzungsUebersicht(
            items=items, fehlend=fehlend, veraltet=sorted(veraltet)
        )

    def _original_schreiben(self, announcement_id: str, row: dict, hash_: str) -> None:
        """Die `de`-Fassung aus dem Original spiegeln.

        Sie ist KEINE Übersetzung und geht deshalb nie an Google. Sie liegt
        trotzdem als Zeile vor, damit der Lesepfad EINEN Weg hat: „hol die
        Fassung in Sprache X" — statt für Deutsch einen Sonderfall zu kennen,
        der irgendwann an einer der beiden Lesestellen fehlt.

        `geprueft = true`, weil ein Mensch sie geschrieben hat. Damit ist sie
        zugleich vor jedem maschinellen Lauf geschützt — was richtig ist: das
        Original zu „übersetzen" hieße, es zu verändern.
        """
        self._db.table("announcement_translations").upsert(
            {
                "announcement_id": announcement_id,
                "sprache": QUELLSPRACHE,
                "titel": row.get("titel") or "",
                "kurztext": row.get("kurztext"),
                "inhalt_html": row.get("inhalt_html") or "",
                "geprueft": True,
                "quelle_hash": hash_,
                "updated_at": datetime.now(UTC).isoformat(),
            },
            on_conflict="announcement_id,sprache",
        ).execute()

    def uebersetzen(
        self, announcement_id: str, *, nur_sprache: str | None = None
    ) -> UebersetzungsUebersicht:
        """Fehlende und veraltete Fassungen erzeugen. Geprüfte bleiben stehen.

        WAS ÜBERSETZT WIRD (und was nicht):
          * fehlt eine Sprache          → wird erzeugt
          * vorhanden, NICHT geprüft,
            Quelltext geändert          → wird ersetzt
          * vorhanden, NICHT geprüft,
            Quelltext unverändert       → NICHTS (Wurzel 2: kein zweiter
                                          bezahlter Aufruf bei Doppelklick)
          * vorhanden, GEPRÜFT          → NIEMALS angefasst, auch nicht bei
                                          geändertem Original

        `nur_sprache` ist der Knopf „diese eine Sprache neu übersetzen" aus dem
        Backoffice. Er überschreibt eine GEPRÜFTE Fassung ebenfalls nicht — wer
        eine geprüfte Fassung verwerfen will, bearbeitet sie von Hand. Ein Weg,
        der die einzige Garantie des Slice aushebelt, darf nicht hinter einem
        beiläufigen Knopf liegen.

        FAIL-CLOSED (Wurzel 5): Scheitert eine Sprache, wird die Exception
        durchgereicht. Bereits geschriebene Sprachen bleiben stehen — sie sind
        korrekt, und sie wegzuwerfen hieße, für sie erneut zu bezahlen. Der
        Vorgang ist wiederholbar: beim nächsten Lauf sind genau die fehlenden
        noch offen (der Hash der geschriebenen passt ja bereits).
        """
        row = self._laden(announcement_id)
        titel = row.get("titel") or ""
        kurztext = row.get("kurztext")
        inhalt = row.get("inhalt_html") or ""
        # Vor dem ERSTEN API-Aufruf prüfen, nicht je Sprache (Wurzel 8).
        laengen_pruefen(titel, kurztext, inhalt)
        aktueller = quelle_hash(titel, kurztext, inhalt)

        # Das Original als `de`-Zeile spiegeln. Idempotent per upsert.
        self._original_schreiben(announcement_id, row, aktueller)

        if nur_sprache is not None and nur_sprache not in ZIELSPRACHEN:
            raise AnnouncementError(
                f"Unbekannte oder nicht übersetzbare Sprache: {nur_sprache!r}.",
                status_code=422,
            )

        bestand = {
            str(r.get("sprache") or ""): r
            for r in self._uebersetzungen_laden(announcement_id)
        }
        ziele = {nur_sprache} if nur_sprache else set(ZIELSPRACHEN)

        offen: list[str] = []
        for sprache in sorted(ziele):
            vorhanden = bestand.get(sprache)
            if vorhanden is None:
                offen.append(sprache)
                continue
            if vorhanden.get("geprueft"):
                # Der Schutz. Auch bei geändertem Original und auch bei
                # `nur_sprache` — die Fassung gehört einem Menschen.
                continue
            if (vorhanden.get("quelle_hash") or "") != aktueller:
                offen.append(sprache)
            # Sonst: identischer Quelltext, maschinelle Fassung liegt vor →
            # nichts zu tun (Idempotenz).

        for sprache in offen:
            neuer_titel, neuer_kurztext, neuer_inhalt = fassung_erzeugen(
                titel=titel,
                kurztext=kurztext,
                inhalt_html=inhalt,
                ziel=sprache,
            )
            # Was der Dienst zurückgibt, ist Fremd-Input (Wurzel 8) — dieselbe
            # nh3-Allowlist wie beim Original, nicht eine zweite hier gebaute.
            self._fassung_schreiben(
                announcement_id,
                sprache,
                titel=neuer_titel,
                kurztext=neuer_kurztext,
                inhalt_html=sanitize_inhalt(neuer_inhalt),
                hash_=aktueller,
            )

        log.info(
            "ankuendigung_uebersetzt",
            announcement_id=announcement_id,
            erzeugt=len(offen),
            nur_sprache=nur_sprache,
        )
        return self.uebersicht(announcement_id)

    def _fassung_schreiben(
        self,
        announcement_id: str,
        sprache: str,
        *,
        titel: str,
        kurztext: str | None,
        inhalt_html: str,
        hash_: str,
    ) -> None:
        """Eine MASCHINELLE Fassung ablegen — niemals über eine geprüfte.

        Zwei unabhängige Riegel, und beide sind nötig:
          1. `update ... .eq("geprueft", False)` — trifft eine geprüfte Zeile
             nicht. Das ist der eigentliche Schutz.
          2. `insert` nur, wenn (1) nichts getroffen hat. Der UNIQUE-Index aus
             0347 verhindert dabei, dass ein gleichzeitiger zweiter Lauf eine
             zweite Zeile für dieselbe Sprache anlegt.

        Bewusst KEIN `upsert`: ein Upsert auf (announcement_id, sprache) würde
        die geprüfte Zeile überschreiben — der Konflikt ist ja genau sie. Die
        WHERE-Klausel des Updates ist der Grund, warum das hier nicht passieren
        kann.
        """
        jetzt = datetime.now(UTC).isoformat()
        werte = {
            "titel": titel,
            "kurztext": kurztext,
            "inhalt_html": inhalt_html,
            "quelle_hash": hash_,
            "geprueft": False,
            "updated_at": jetzt,
        }
        getroffen = (
            self._db.table("announcement_translations")
            .update(werte)
            .eq("announcement_id", announcement_id)
            .eq("sprache", sprache)
            .eq("geprueft", False)
            .execute()
        ).data or []
        if getroffen:
            return
        # Keine Zeile getroffen: entweder gibt es sie noch nicht (Normalfall)
        # oder sie ist geprüft (dann darf sie nicht entstehen). Ein Insert
        # scheitert im zweiten Fall am UNIQUE-Index — und das ist die richtige
        # Antwort, nicht ein stilles Überschreiben.
        try:
            self._db.table("announcement_translations").insert(
                {
                    "announcement_id": announcement_id,
                    "sprache": sprache,
                    **werte,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Konflikt gezielt deuten
            # 23505 = unique_violation: die Zeile ist inzwischen da (paralleler
            # Lauf) oder sie ist geprüft. Beides ist KEIN Fehler dieses Laufs —
            # der gewünschte Zustand liegt vor. Jeden anderen Fehler
            # weiterreichen (Wurzel 5: kein breites Verschlucken).
            if "23505" not in str(exc) and "duplicate key" not in str(exc):
                raise
            log.info(
                "ankuendigung_fassung_bereits_vorhanden",
                announcement_id=announcement_id,
                sprache=sprache,
            )

    def fassung_korrigieren(
        self, announcement_id: str, sprache: str, req: UebersetzungUpdate, *,
        geprueft_von: str,
    ) -> AnnouncementUebersetzung:
        """Eine Fassung von Hand korrigieren — sie gilt danach als geprüft.

        Ab diesem Moment ist sie vor jedem automatischen Lauf geschützt. Der
        `quelle_hash` wird auf den AKTUELLEN Stand des Originals gesetzt: der
        Redakteur hat die Fassung gerade gegen dieses Original geprüft, also
        ist sie in Bezug darauf aktuell. Würde man den alten Hash stehen
        lassen, erschiene die eben korrigierte Fassung sofort wieder als
        „veraltet".
        """
        row = self._laden(announcement_id)
        if sprache != QUELLSPRACHE and sprache not in ZIELSPRACHEN:
            raise AnnouncementError(
                f"Unbekannte Sprache: {sprache!r}.", status_code=422
            )
        jetzt = datetime.now(UTC).isoformat()
        hash_ = self._quelle_hash_von(row)
        werte = {
            "titel": req.titel.strip(),
            "kurztext": (req.kurztext or "").strip() or None,
            "inhalt_html": req.inhalt_html,
            "geprueft": True,
            "geprueft_von": geprueft_von,
            "geprueft_am": jetzt,
            "quelle_hash": hash_,
            "updated_at": jetzt,
        }
        # Hier ist ein Upsert richtig — anders als beim maschinellen Schreiben:
        # ein MENSCH korrigiert bewusst und darf jede Fassung überschreiben,
        # auch eine bereits geprüfte (etwa die eines Kollegen).
        self._db.table("announcement_translations").upsert(
            {
                "announcement_id": announcement_id,
                "sprache": sprache,
                **werte,
            },
            on_conflict="announcement_id,sprache",
        ).execute()
        if sprache == QUELLSPRACHE:
            # Die `de`-Zeile IST das Original. Sie nur in der Übersetzungs-
            # tabelle zu ändern hieße, zwei verschiedene deutsche Texte zu
            # führen — den in `announcements` und den hier. Also mitziehen.
            self._db.table("announcements").update(
                {
                    "titel": werte["titel"],
                    "kurztext": werte["kurztext"],
                    "inhalt_html": werte["inhalt_html"],
                    "updated_at": jetzt,
                }
            ).eq("id", announcement_id).execute()
        return AnnouncementUebersetzung(
            sprache=sprache,
            titel=str(werte["titel"]),
            kurztext=werte["kurztext"],
            inhalt_html=str(werte["inhalt_html"]),
            geprueft=True,
            geprueft_am=jetzt,
            veraltet=False,
        )

    def _fassungen_fuer(
        self, ids: list[str], sprache: str
    ) -> dict[str, dict]:
        """Die Fassungen mehrerer Ankündigungen in EINER Sprache.

        Ein Roundtrip für die ganze Liste statt einer je Zeile — sonst wären es
        bei 20 Einträgen 20 Abfragen. Gibt eine Map announcement_id → Zeile.
        """
        if not ids:
            return {}
        rows = (
            self._db.table("announcement_translations")
            .select("announcement_id, titel, kurztext, inhalt_html")
            .eq("sprache", sprache)
            .in_("announcement_id", ids)
            .execute()
        ).data or []
        return {str(r["announcement_id"]): r for r in rows}

    def _anwenden(self, item: Announcement, fassung: dict | None) -> Announcement:
        """Die Fassung auf die Ankündigung legen — oder das Original lassen.

        KEIN FALLBACK-VERSTOSS (Wurzel 4): Gibt es keine Fassung, wird NICHTS
        erfunden — der Leser sieht den ORIGINALTEXT, also den einzigen real
        existierenden Text dieser Ankündigung, unverändert und vollständig. Ein
        Fallback wäre, einen fehlenden Wert durch einen plausibel aussehenden
        Ersatz zu ersetzen; hier wird stattdessen die vorhandene Wahrheit
        gezeigt. Die Alternative — die Ankündigung ausblenden — wäre schädlich:
        eine Wartungsankündigung nicht zuzustellen, weil ihre lettische Fassung
        fehlt, ist schlechter als sie auf Deutsch zuzustellen. Das Backoffice
        sieht die Lücke als „fehlend" und kann sie schließen.
        """
        if not fassung:
            return item
        item.titel = fassung.get("titel") or item.titel
        item.kurztext = fassung.get("kurztext")
        item.inhalt_html = fassung.get("inhalt_html") or ""
        return item
