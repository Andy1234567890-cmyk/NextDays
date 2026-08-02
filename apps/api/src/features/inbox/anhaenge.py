"""Anhänge und KI-Wissensdatenbank des Posteingangs.

Aus `service.py` herausgelöst (Grenze `too-many-lines`), gleiches Muster wie
`planung.py`: ein **Mixin**, damit Methodennamen und Aufrufstellen unverändert
bleiben.

Beide Bereiche teilen die Eigenschaft, die ihren gemeinsamen Zuschnitt erklärt:
sie tragen die heiklen Daten des Slices. Am Anhang hängt das PDF mit dem
Türcode, in der Wissensdatenbank steht das WLAN-Passwort. Beide Tabellen sind
deshalb für anon/authenticated gesperrt (0259/0260) und ausschließlich über
diesen Server erreichbar.
"""
from __future__ import annotations

import re
from base64 import b64encode
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.channel_manager.channex_client import ChannexError

from .errors import InboxError
from .schemas import (
    Attachment,
    AttachmentList,
    KnowledgeFact,
    KnowledgeFactList,
    KnowledgeFactUpsert,
)

log = get_logger("nextdays.inbox")

# Obergrenze für die Fakten im KI-Prompt. Ohne Deckel wächst der Prompt mit der
# Wissensdatenbank, bis das Modell-Limit reißt oder die Kosten davonlaufen
# (Wurzel 8 — jeder unbegrenzte Bereich bekommt eine harte Grenze).
_WISSEN_MAX = 60

# Anhänge: Obergrenze, Bucket, Gültigkeit der signierten URL.
_ANHANG_MAX_BYTES = 10 * 1024 * 1024
_ANHANG_BUCKET = "inbox-attachments"
_ANHANG_URL_TTL = 3600


class AnhangWissenMixin:
    """Anhänge + Wissensdatenbank. Teil von `InboxService`."""

    # Vom Service gestellt; hier nur deklariert, damit die Typprüfung die
    # Zugriffe kennt. pylint behandelt `*Mixin` gesondert.
    _db: Client | None
    _channex: Any

    # -- Anhänge ---------------------------------------------------------------
    @staticmethod
    def _dateityp(content: bytes) -> tuple[str, str] | None:
        """(Endung, MIME) aus den Magic-Bytes. None = nicht erlaubt.

        Der vom Client mitgeschickte content_type wird bewusst ignoriert: er ist
        frei wählbar und damit kein Schutz (Wurzel 8). Eine als `image/png`
        deklarierte HTML-Datei bliebe sonst eine HTML-Datei."""
        if content.startswith(b"\x89PNG\r\n\x1a\n"):
            return "png", "image/png"
        if content.startswith(b"\xff\xd8\xff"):
            return "jpg", "image/jpeg"
        if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
            return "webp", "image/webp"
        if content[:6] in (b"GIF87a", b"GIF89a"):
            return "gif", "image/gif"
        if content.startswith(b"%PDF-"):
            return "pdf", "application/pdf"
        return None

    @staticmethod
    def _dateiname_saeubern(name: str, endung: str) -> str:
        """Anzeigename ohne Pfadanteile und Steuerzeichen. Der Name landet in
        Downloads und in der Channex-Payload — `../../etc/passwd` hat dort so
        wenig zu suchen wie ein Zeilenumbruch."""
        roh = (name or "").replace("\\", "/").split("/")[-1].strip()
        sauber = re.sub(r"[^\w.\- ]+", "_", roh)[:120].strip(" .") or f"anhang.{endung}"
        if not sauber.lower().endswith(f".{endung}"):
            sauber = f"{sauber}.{endung}"
        return sauber

    def _anhang_zeile(self, r: dict) -> Attachment:
        return Attachment(
            id=str(r["id"]),
            filename=r.get("filename") or "",
            mime=r.get("mime") or "",
            size=int(r.get("size_bytes") or 0),
            url=self._anhang_url(r.get("storage_path") or ""),
            created_at=r.get("created_at"),
            sent_at=r.get("sent_at"),
            channel_error=r.get("channel_error"),
        )

    def _anhang_url(self, path: str) -> str | None:
        """Befristete Download-URL aus dem privaten Bucket."""
        if not path or self._db is None:
            return None
        try:
            signed = self._db.storage.from_(_ANHANG_BUCKET).create_signed_url(
                path, _ANHANG_URL_TTL
            )
        except Exception as exc:  # noqa: BLE001 — ein Anhang ohne URL statt 500
            log.warning("inbox_anhang_signieren_fehlgeschlagen", path=path, error=str(exc))
            return None
        if isinstance(signed, dict):
            return signed.get("signedURL") or signed.get("signedUrl")
        return None

    def list_attachments(self, ctx: AuthContext, thread_id: str) -> AttachmentList:
        db, tenant_id, _row, _access = self._load_thread_scoped(ctx, thread_id)
        rows = (
            db.table("inbox_attachment")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("thread_id", thread_id)
            .order("created_at")
            .execute()
        ).data or []
        items = [self._anhang_zeile(r) for r in rows]
        return AttachmentList(items=items, total=len(items))

    def add_attachment(
        self, ctx: AuthContext, thread_id: str, *, content: bytes, filename: str,
        message: str | None = None,
    ) -> Attachment:
        """Anhang hochladen und an den Kanal übergeben.

        Der Upload gelingt auch dann, wenn der Kanal die Datei ablehnt (Airbnb
        nimmt kein PDF, Booking.com weder PDF noch QR-Code). Der Grund wird an
        der Zeile festgehalten und angezeigt, statt verschluckt zu werden
        (Wurzel 5) — sonst wähnt sich der Betrieb in Sicherheit, während beim
        Gast nichts angekommen ist.
        """
        db, tenant_id, row, access = self._load_thread_scoped(ctx, thread_id)
        if not access.can_reply:
            raise InboxError("Keine Berechtigung zum Senden.", status_code=403)
        if not content:
            raise InboxError("Die Datei ist leer.", status_code=422)
        if len(content) > _ANHANG_MAX_BYTES:
            raise InboxError(
                f"Die Datei ist zu groß (max. {_ANHANG_MAX_BYTES // (1024 * 1024)} MB).",
                status_code=413,
            )
        typ = self._dateityp(content)
        if typ is None:
            raise InboxError(
                "Nur Bilder (JPG, PNG, WebP, GIF) und PDF sind erlaubt.",
                status_code=422,
            )
        endung, mime = typ
        name = self._dateiname_saeubern(filename, endung)
        pfad = f"{tenant_id}/{thread_id}/{uuid4().hex}.{endung}"

        db.storage.from_(_ANHANG_BUCKET).upload(
            pfad, content, {"content-type": mime, "upsert": "false"}
        )
        ins = (
            db.table("inbox_attachment")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "storage_path": pfad,
                    "filename": name,
                    "mime": mime,
                    "size_bytes": len(content),
                    "uploaded_by": ctx.user_id if ctx.user_id != "cron" else None,
                }
            )
            .execute()
        ).data
        zeile = ins[0]

        gesendet_at, fehler = self._anhang_an_kanal(
            row, content=content, filename=name, mime=mime, message=message
        )
        aktualisiert = (
            db.table("inbox_attachment")
            .update({"sent_at": gesendet_at, "channel_error": fehler})
            .eq("tenant_id", tenant_id)
            .eq("id", zeile["id"])
            .execute()
        ).data
        return self._anhang_zeile(aktualisiert[0] if aktualisiert else zeile)

    def _anhang_an_kanal(
        self, row: dict, *, content: bytes, filename: str, mime: str,
        message: str | None,
    ) -> tuple[str | None, str | None]:
        """Anhang an die OTA übergeben → (sent_at, Fehlertext).

        Im Sandbox-Modus gibt es keine Channex-Messaging-API; der Anhang bleibt
        dann bei uns liegen und wird ehrlich als „nicht übergeben" markiert
        statt als gesendet ausgewiesen."""
        if self._sandbox_enabled():
            return None, "Sandbox: nicht an das Portal übergeben."
        cbid = row.get("channex_booking_id")
        if not cbid:
            return None, "Diese Konversation hat keine Portal-Buchung."
        try:
            attachment_id = self._channex.create_attachment(
                file_b64=b64encode(content).decode("ascii"),
                file_name=filename,
                file_type=mime,
            )
            self._channex.send_booking_attachment(
                str(cbid), attachment_id, message=message
            )
        except ChannexError as exc:
            log.warning(
                "inbox_anhang_kanal_abgelehnt",
                channex_booking_id=str(cbid),
                status=exc.channex_status,
                error=exc.message,
            )
            return None, exc.message[:500]
        return datetime.now(UTC).isoformat(), None

    def delete_attachment(self, ctx: AuthContext, attachment_id: str) -> None:
        """Anhang bei uns löschen. Beim Gast angekommene Dateien lassen sich
        nicht zurückholen — die Zeile verschwindet trotzdem, damit sie nicht
        weiter als verfügbar erscheint."""
        db, tenant_id = self._require(ctx)
        rows = (
            db.table("inbox_attachment")
            .select("id, storage_path")
            .eq("tenant_id", tenant_id)
            .eq("id", attachment_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise InboxError("Anhang nicht gefunden.", status_code=404)
        try:
            db.storage.from_(_ANHANG_BUCKET).remove([rows[0]["storage_path"]])
        except Exception as exc:  # noqa: BLE001 — Datei weg ist kein Grund für 500
            log.warning("inbox_anhang_datei_loeschen", error=str(exc))
        db.table("inbox_attachment").delete().eq("tenant_id", tenant_id).eq(
            "id", attachment_id
        ).execute()

    # -- KI-Wissensdatenbank ---------------------------------------------------
    _FACT_COLS = "id, property_id, fact, source, source_ref, updated_at"

    def _fact_row(self, r: dict, titel: dict[str, str]) -> KnowledgeFact:
        pid = str(r["property_id"]) if r.get("property_id") else None
        return KnowledgeFact(
            id=str(r["id"]),
            property_id=pid,
            property_title=titel.get(pid or ""),
            fact=r.get("fact") or "",
            source=r.get("source") or "manual",
            source_ref=r.get("source_ref"),
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

    def list_knowledge(
        self, ctx: AuthContext, *, property_id: str | None = None
    ) -> KnowledgeFactList:
        """Fakten des Betriebs. `property_id` filtert auf ein Objekt UND die
        betriebsweiten Fakten — beim Beantworten gelten beide zusammen."""
        db, tenant_id = self._require(ctx)
        q = (
            db.table("inbox_knowledge_fact")
            .select(self._FACT_COLS)
            .eq("tenant_id", tenant_id)
        )
        if property_id:
            q = q.or_(f"property_id.eq.{property_id},property_id.is.null")
        rows = q.order("updated_at", desc=True).limit(500).execute().data or []
        titel = self._property_titel(db, tenant_id)
        items = [self._fact_row(r, titel) for r in rows]
        return KnowledgeFactList(items=items, total=len(items))

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

    def create_knowledge(
        self, ctx: AuthContext, req: KnowledgeFactUpsert, *, source: str = "manual",
        source_ref: str | None = None,
    ) -> KnowledgeFact:
        db, tenant_id = self._require(ctx)
        text = (req.fact or "").strip()
        if not text:
            raise InboxError("Der Fakt darf nicht leer sein.", status_code=422)
        if len(text) > 2000:
            raise InboxError("Der Fakt ist zu lang (max. 2000 Zeichen).", status_code=422)
        if req.property_id:
            self._own_property(db, tenant_id, req.property_id)
        ins = (
            db.table("inbox_knowledge_fact")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": req.property_id,
                    "fact": text,
                    "source": source,
                    "source_ref": source_ref,
                    "created_by": ctx.user_id if ctx.user_id != "cron" else None,
                }
            )
            .execute()
        ).data
        return self._fact_row(ins[0], self._property_titel(db, tenant_id))

    def update_knowledge(
        self, ctx: AuthContext, fact_id: str, req: KnowledgeFactUpsert
    ) -> KnowledgeFact:
        db, tenant_id = self._require(ctx)
        text = (req.fact or "").strip()
        if not text:
            raise InboxError("Der Fakt darf nicht leer sein.", status_code=422)
        if req.property_id:
            self._own_property(db, tenant_id, req.property_id)
        upd = (
            db.table("inbox_knowledge_fact")
            .update({"fact": text, "property_id": req.property_id})
            .eq("tenant_id", tenant_id)
            .eq("id", fact_id)
            .execute()
        ).data
        if not upd:
            raise InboxError("Fakt nicht gefunden.", status_code=404)
        return self._fact_row(upd[0], self._property_titel(db, tenant_id))

    def delete_knowledge(self, ctx: AuthContext, fact_id: str) -> None:
        db, tenant_id = self._require(ctx)
        db.table("inbox_knowledge_fact").delete().eq("tenant_id", tenant_id).eq(
            "id", fact_id
        ).execute()

    def _wissen_fuer_thread(
        self, db: Client, tenant_id: str, row: dict
    ) -> list[str]:
        """Fakten, die für DIESEN Thread gelten: betriebsweite plus die des
        Objekts. Begrenzt, damit der Prompt nicht unbegrenzt wächst (Wurzel 8)."""
        prop = self._property_for_thread(db, tenant_id, row)
        pid = str(prop["id"]) if prop and prop.get("id") else None
        q = (
            db.table("inbox_knowledge_fact")
            .select("fact, property_id")
            .eq("tenant_id", tenant_id)
        )
        q = q.or_(f"property_id.eq.{pid},property_id.is.null") if pid else q.is_(
            "property_id", "null"
        )
        rows = q.limit(_WISSEN_MAX).execute().data or []
        # Objektbezogene Fakten zuerst: sie schlagen das Allgemeine.
        rows.sort(key=lambda r: 0 if r.get("property_id") else 1)
        return [str(r["fact"]).strip() for r in rows if (r.get("fact") or "").strip()]
