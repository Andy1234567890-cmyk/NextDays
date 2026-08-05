"""Gastgeber-Profil — Lesen und Ändern der Profil-Angaben (Airbnb „Über den
Gastgeber").

Genau EINE Zeile pro Nutzer in public.host_profiles. Fehlt sie, gilt ein leeres
Profil (Schema-Defaults); ein Update legt sie lazy per Upsert an (idempotent,
Wurzel 2). Scope IMMER auf ctx.user_id (Wurzel 3): der Service-Client umgeht RLS,
darum wird jede Query explizit auf die eigene user_id gescopt.

Name und „Hosting begann {Jahr}" sind nicht Teil von host_profiles — sie werden
aus public.users abgeleitet (full_name, created_at). Kein Doppelwert (Wurzel 4).
"""
from __future__ import annotations

import secrets
from datetime import UTC, datetime

from fastapi import HTTPException, status
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import public_storage_url

from .schemas import HostProfile, HostProfileUpdate

log = get_logger("nextdays.host_profiles")

# Avatar-Upload: öffentlicher Bild-Bucket (derselbe wie Objektbilder) unter einem
# eigenen avatars/-Präfix je User. Magic-Byte-Signaturen → wir vertrauen NICHT
# dem Client-content_type (Wurzel 8), sondern prüfen die echten Anfangsbytes.
_AVATAR_BUCKET = "property-images"
_AVATAR_MAX_BYTES = 10 * 1024 * 1024


def _sniff_image_ext(content: bytes) -> str | None:
    """Bildtyp aus den Magic-Bytes bestimmen (PNG/JPEG/WebP/GIF). None = kein
    erlaubtes Bild — der Client-content_type wird bewusst ignoriert (Wurzel 8)."""
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if content.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp"
    if content[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    return None


# content_type je Extension (für den Storage-Upload-Header).
_EXT_MIME = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}

# Editierbare Profil-Spalten (host_profiles), ohne user_id/updated_at.
_COLUMNS = (
    "avatar_url, intro, work, dream_destination, spend_time_on, pets, "
    "decade_born, show_decade, school, useless_skill, favorite_song, fun_fact, "
    "languages, obsessed_with, bio_title, lives_in, lives_in_street, "
    "lives_in_house_number, lives_in_postal_code, lives_in_city, "
    "lives_in_country, lives_in_lat, lives_in_lng, show_travel_stamps, interests"
)


class HostProfileService:
    def __init__(self, db: Client) -> None:
        self._db = db

    def get(self, ctx: AuthContext) -> HostProfile:
        """Profil des eingeloggten Nutzers. Editierbare Felder aus host_profiles
        (fehlt die Zeile → leeres Profil); Name + „Hosting begann" aus users."""
        row = (
            self._db.table("host_profiles")
            .select(_COLUMNS)
            .eq("user_id", ctx.user_id)
            .limit(1)
            .execute()
        ).data
        base = HostProfile(**row[0]) if row else HostProfile()
        self._attach_user_fields(ctx, base)
        return base

    def update(self, ctx: AuthContext, patch: HostProfileUpdate) -> HostProfile:
        """Nur gesetzte Felder ändern (PATCH). Upsert auf die eigene Zeile
        (idempotent, Wurzel 2). full_name/hosting_since_year sind nicht Teil des
        Patches (kommen aus users)."""
        changed = patch.model_dump(exclude_none=True)
        if changed:
            self._db.table("host_profiles").upsert(
                {
                    "user_id": ctx.user_id,
                    "updated_at": datetime.now(UTC).isoformat(),
                    **changed,
                },
                on_conflict="user_id",
            ).execute()
            log.info(
                "host_profile_updated",
                user_id=ctx.user_id,
                fields=sorted(changed),
            )
        return self.get(ctx)

    def upload_avatar(
        self, ctx: AuthContext, content: bytes, content_type: str
    ) -> HostProfile:
        """Profilfoto hochladen → in Storage legen, avatar_url speichern, Profil
        zurückgeben. Magic-Byte-Prüfung (nicht content_type, Wurzel 8); Pfad je
        User (avatars/{user_id}.{ext}, upsert), Cache-Buster in der URL."""
        _ = content_type  # bewusst ignoriert — wir sniffen die echten Bytes.
        if len(content) > _AVATAR_MAX_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Bild ist zu groß (max. 10 MB).",
            )
        ext = _sniff_image_ext(content)
        if not ext:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Nur PNG/JPEG/WebP/GIF erlaubt.",
            )

        path = f"avatars/{ctx.user_id}.{ext}"
        storage = self._db.storage.from_(_AVATAR_BUCKET)
        try:
            storage.upload(
                path,
                content,
                {"content-type": _EXT_MIME[ext], "upsert": "true"},
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich
            log.warning("host_avatar_upload_failed", user_id=ctx.user_id, error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Upload fehlgeschlagen.",
            ) from exc

        # Cache-Buster, damit der Client trotz gleichem Pfad das neue Bild lädt.
        url = f"{public_storage_url(_AVATAR_BUCKET, path)}?v={secrets.token_hex(4)}"
        self._db.table("host_profiles").upsert(
            {
                "user_id": ctx.user_id,
                "avatar_url": url,
                "updated_at": datetime.now(UTC).isoformat(),
            },
            on_conflict="user_id",
        ).execute()
        log.info("host_avatar_uploaded", user_id=ctx.user_id)
        return self.get(ctx)

    # -- Abgeleitete User-Felder (Name, „Hosting begann") ------------------

    def _attach_user_fields(self, ctx: AuthContext, profile: HostProfile) -> None:
        """full_name + hosting_since (voller created_at-Zeitstempel) aus
        public.users setzen. Scope auf die eigene user_id (Wurzel 3). Fehlt der
        User-Datensatz, bleiben beide None (kein erfundener Wert, Wurzel 4)."""
        rows = (
            self._db.table("users")
            .select("full_name, created_at")
            .eq("id", ctx.user_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return
        user = rows[0]
        profile.full_name = user.get("full_name")
        created = user.get("created_at")
        if created:
            profile.hosting_since = str(created)
