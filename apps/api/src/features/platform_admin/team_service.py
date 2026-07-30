"""Backoffice-Team: Kolleg:innen einladen, Rollen setzen, Zugänge entziehen.

WARUM EIGENER SERVICE: `platform_admins` vergibt den einzigen mandanten-
übergreifenden Zugang der Plattform. Bis 0237 gab es dafür keinen Weg außer
zwei Handgriffen auf dem Server (GoTrue-Nutzer anlegen, Zeile per psql
einfügen) — Selbstregistrierung ist aus, und GoTrue hat keinen SMTP-Zugang,
kann also weder Einladungen noch Passwort-Links verschicken.

Deshalb läuft die Einladung vollständig über UNSEREN Weg:
  1. E-Mail auf eine Auth-Identität auflösen (RPC `auth_user_id_by_email`,
     nur service_role).
  2. Konto existiert → Zugang freischalten. Kein Link, kein Passwort-Vorgang.
  3. Konto existiert nicht → GoTrue-Nutzer mit Zufallspasswort anlegen (das
     niemand kennt, auch der einladende Admin nicht) und einen EINMAL-Token
     erzeugen. Versendet wird der Link über `core.mail` — der Klartext-Token
     steht nur im Link, in der DB liegt nur sein SHA-256 (Wurzel 6).
  4. Die eingeladene Person setzt ihr Passwort selbst (`accept`).

Schutzregeln (fail-closed):
  • Schreiben darf nur `platform_admin` (Guard im Router).
  • Niemand ändert die eigene Rolle oder deaktiviert sich selbst.
  • Der LETZTE aktive `platform_admin` kann nicht entfernt/herabgestuft werden —
    sonst sperrt sich der Betreiber selbst aus dem Backoffice aus.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.config import Settings, get_settings
from src.core.logging import get_logger, mask_email
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.security import PlatformContext

from .schemas import (
    TeamInvite,
    TeamInviteAccept,
    TeamInviteResult,
    TeamList,
    TeamMember,
    TeamUpdate,
)

log = get_logger("nextdays.platform_team")

# Harte Obergrenze (Wurzel 8). Das Betreiber-Team ist klein; wer hier an die
# Grenze stößt, hat ein anderes Problem als die Seitengröße.
_MAX_MEMBERS = 200

# Gültigkeit der Einladung. Kurz genug, dass ein vergessener Link nicht ewig
# offensteht, lang genug für ein Wochenende.
_INVITE_TTL = timedelta(hours=72)

_ROLLEN = ("platform_admin", "platform_support")


def _hash(token: str) -> str:
    """SHA-256 des Tokens — in der DB liegt nur dieser Wert."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class TeamError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class TeamService:
    def __init__(
        self,
        db: Client,
        settings: Settings | None = None,
        mail: MailService | None = None,
    ) -> None:
        self._db = db
        self._settings = settings or get_settings()
        self._mail = mail or MailService(self._settings)

    # -- Lesen ---------------------------------------------------------------

    def list(self) -> TeamList:
        """Alle Backoffice-Zugänge, neueste zuerst (auch deaktivierte).

        Deaktivierte bleiben sichtbar: sie sind die Historie, wer wann Zugriff
        hatte — genau die Information, die man im Zweifel braucht.
        """
        rows = (
            self._db.table("platform_admins")
            .select("*")
            .order("created_at", desc=True)
            .limit(_MAX_MEMBERS)
            .execute()
        ).data or []
        return TeamList(
            items=[self._member(r) for r in rows], total=len(rows)
        )

    # -- Einladen ------------------------------------------------------------

    def invite(self, req: TeamInvite, *, actor: PlatformContext) -> TeamInviteResult:
        """Zugang vergeben — an ein bestehendes Konto oder per Einladung."""
        email = req.email.strip().lower()
        if "@" not in email or email.startswith("@") or email.endswith("@"):
            raise TeamError("Keine gültige E-Mail-Adresse.", status_code=422)

        vorhandene_id = self._auth_user_id(email)
        if vorhandene_id:
            zeile = self._zugang_setzen(
                user_id=vorhandene_id,
                role=req.platform_role,
                note=req.note,
                granted_by=actor.user_id,
                invite=None,
            )
            log.info(
                "platform_team_granted",
                actor=actor.user_id,
                email=mask_email(email),
                role=req.platform_role,
            )
            return TeamInviteResult(
                member=self._member(zeile),
                ergebnis="freigeschaltet",
                hinweis=(
                    "Das Konto existierte bereits — der Zugang ist sofort aktiv. "
                    "Es wurde kein Einladungslink erzeugt."
                ),
            )

        # Neues Konto: Zufallspasswort, das niemand kennt. Gesetzt wird es von
        # der eingeladenen Person selbst über den Einladungslink.
        user_id = self._create_auth_user(email)
        token = secrets.token_urlsafe(32)
        ablauf = datetime.now(UTC) + _INVITE_TTL
        zeile = self._zugang_setzen(
            user_id=user_id,
            role=req.platform_role,
            note=req.note,
            granted_by=actor.user_id,
            invite=(_hash(token), ablauf),
        )
        link = self._invite_link(token)
        versendet, hinweis = self._invite_mail(email, link, actor)
        log.info(
            "platform_team_invited",
            actor=actor.user_id,
            email=mask_email(email),
            role=req.platform_role,
            mail_versendet=versendet,
        )
        return TeamInviteResult(
            member=self._member(zeile),
            ergebnis="eingeladen",
            mail_versendet=versendet,
            # Der Link wird NUR zurückgegeben, wenn die Mail nicht rausging —
            # sonst stünde ein gültiger Zugangs-Link ohne Not in einer Antwort.
            invite_link=None if versendet else link,
            hinweis=hinweis,
        )

    def accept(self, req: TeamInviteAccept) -> None:
        """Einladung annehmen und eigenes Passwort setzen (öffentlich).

        Fehlerfälle sind bewusst NICHT unterscheidbar (abgelaufen, verbraucht,
        erfunden): eine genaue Auskunft würde einem Angreifer verraten, ob ein
        Token existiert.
        """
        rows = (
            self._db.table("platform_admins")
            .select("user_id, invite_expires_at, accepted_at, active")
            .eq("invite_token_hash", _hash(req.token))
            .limit(1)
            .execute()
        ).data or []
        zeile = rows[0] if rows else None
        if (
            zeile is None
            or zeile.get("accepted_at")
            or not zeile.get("active")
            or not self._gueltig(zeile.get("invite_expires_at"))
        ):
            raise TeamError(
                "Einladung ungültig oder abgelaufen.", status_code=400
            )

        try:
            self._db.auth.admin.update_user_by_id(
                zeile["user_id"], {"password": req.password}
            )
        except Exception as exc:  # noqa: BLE001 — in TeamError übersetzen
            log.warning("platform_team_accept_failed", error=str(exc))
            raise TeamError(
                "Passwort konnte nicht gesetzt werden.", status_code=502
            ) from exc

        # Token verbrauchen — single-use (Wurzel 2: ein zweiter Aufruf mit
        # demselben Link findet nichts mehr).
        self._db.table("platform_admins").update(
            {
                "invite_token_hash": None,
                "invite_expires_at": None,
                "accepted_at": datetime.now(UTC).isoformat(),
            }
        ).eq("user_id", zeile["user_id"]).execute()
        log.info("platform_team_accepted", user_id=zeile["user_id"])

    # -- Ändern --------------------------------------------------------------

    def update(
        self, user_id: str, req: TeamUpdate, *, actor: PlatformContext
    ) -> TeamMember:
        """Rolle, Notiz oder Aktiv-Status ändern (mit Aussperr-Schutz)."""
        zeile = self._zeile(user_id)
        if zeile is None:
            raise TeamError("Zugang nicht gefunden.", status_code=404)

        aendert_rechte = req.platform_role is not None or req.active is not None
        if aendert_rechte and user_id == actor.user_id:
            raise TeamError(
                "Die eigene Rolle oder den eigenen Zugang kann man nicht ändern.",
                status_code=409,
            )

        neu_rolle = req.platform_role or zeile.get("role")
        neu_aktiv = zeile.get("active") if req.active is None else req.active
        verliert_admin = zeile.get("role") == "platform_admin" and (
            neu_rolle != "platform_admin" or not neu_aktiv
        )
        if verliert_admin and self._aktive_admins() <= 1:
            raise TeamError(
                "Das ist der letzte aktive Zugang mit vollen Rechten — "
                "erst eine andere Person zum Admin machen.",
                status_code=409,
            )

        felder: dict[str, object] = {}
        if req.platform_role is not None:
            felder["role"] = req.platform_role
        if req.active is not None:
            felder["active"] = req.active
        if req.note is not None:
            felder["note"] = req.note or None
        if not felder:
            return self._member(zeile)

        upd = (
            self._db.table("platform_admins")
            .update(felder)
            .eq("user_id", user_id)
            .execute()
        ).data
        if not upd:
            raise TeamError("Änderung fehlgeschlagen.", status_code=502)
        log.info(
            "platform_team_updated",
            actor=actor.user_id,
            user_id=user_id,
            felder=sorted(felder),
        )
        return self._member(upd[0])

    # -- intern --------------------------------------------------------------

    def _auth_user_id(self, email: str) -> str | None:
        """E-Mail → auth.users.id (RPC aus 0237). None = kein Konto."""
        try:
            res = self._db.rpc("auth_user_id_by_email", {"p_email": email}).execute()
        except Exception as exc:  # noqa: BLE001 — in TeamError übersetzen
            log.warning("auth_user_lookup_failed", error=str(exc))
            raise TeamError(
                "E-Mail konnte nicht geprüft werden.", status_code=502
            ) from exc
        wert = res.data
        return wert if isinstance(wert, str) and wert else None

    def _create_auth_user(self, email: str) -> str:
        """GoTrue-Nutzer OHNE tenant_id anlegen (Backoffice ist mandantenlos).

        Das Passwort ist zufällig und wird nirgends gespeichert oder angezeigt —
        es dient nur dazu, das Konto anzulegen; gesetzt wird es beim Annehmen
        der Einladung.
        """
        try:
            res = self._db.auth.admin.create_user(
                {
                    "email": email,
                    "password": secrets.token_urlsafe(32),
                    "email_confirm": True,
                    "app_metadata": {"platform_backoffice": True},
                }
            )
        except Exception as exc:  # noqa: BLE001 — in TeamError übersetzen
            log.warning(
                "platform_team_create_user_failed",
                email=mask_email(email),
                error=str(exc),
            )
            raise TeamError(
                "Konto konnte nicht angelegt werden.", status_code=502
            ) from exc
        if res.user is None:
            raise TeamError("Konto konnte nicht angelegt werden.", status_code=502)
        return res.user.id

    def _zugang_setzen(
        self,
        *,
        user_id: str,
        role: str,
        note: str | None,
        granted_by: str,
        invite: tuple[str, datetime] | None,
    ) -> dict:
        """Zeile in platform_admins anlegen oder auffrischen (idempotent).

        Ein zweiter Aufruf für dieselbe Person ist kein Fehler, sondern setzt
        Rolle/Notiz neu und reaktiviert einen entzogenen Zugang (Wurzel 2).
        """
        daten: dict[str, object] = {
            "user_id": user_id,
            "role": role if role in _ROLLEN else "platform_support",
            "note": note or None,
            "granted_by": granted_by,
            "active": True,
        }
        if invite is not None:
            token_hash, ablauf = invite
            daten["invite_token_hash"] = token_hash
            daten["invite_expires_at"] = ablauf.isoformat()
            daten["invited_at"] = datetime.now(UTC).isoformat()
            daten["accepted_at"] = None
        res = (
            self._db.table("platform_admins")
            .upsert(daten, on_conflict="user_id")
            .execute()
        ).data
        if not res:
            raise TeamError("Zugang konnte nicht gesetzt werden.", status_code=502)
        return res[0]

    def _invite_link(self, token: str) -> str:
        """Absoluter Link auf die Einladungsseite des Backoffice.

        Ohne konfigurierte Backoffice-Adresse gibt es keinen sinnvollen Link —
        das ist ein Konfigurationsfehler und wird als solcher gemeldet, statt
        eine plausible URL zu erfinden (Wurzel 4).
        """
        basis = (self._settings.admin_base_url or "").rstrip("/")
        if not basis:
            raise TeamError(
                "ADMIN_BASE_URL ist nicht konfiguriert — ohne sie kann kein "
                "Einladungslink erzeugt werden.",
                status_code=500,
            )
        return f"{basis}/einladung?token={token}"

    def _invite_mail(
        self, email: str, link: str, actor: PlatformContext
    ) -> tuple[bool, str | None]:
        """Einladung verschicken. Gibt (versendet, Hinweis) zurück.

        Ein fehlender Mailversand ist KEIN stiller Erfolg: der Aufrufer bekommt
        den Link zurück und die klare Ansage, dass er ihn selbst weitergeben
        muss (Wurzel 4/5).
        """
        von = actor.email or "dem myNextDays-Team"
        text = (
            "Hallo,\n\n"
            f"{von} hat dir Zugang zum myNextDays-Backoffice eingerichtet.\n\n"
            "Setze hier dein Passwort (der Link ist 72 Stunden gültig und nur "
            "einmal verwendbar):\n"
            f"{link}\n\n"
            "Wenn du damit nichts anfangen kannst, ignoriere diese Mail — ohne "
            "gesetztes Passwort passiert nichts.\n"
        )
        try:
            self._mail.send(
                OutboundMessage(
                    to=email,
                    subject="Dein Zugang zum myNextDays-Backoffice",
                    text=text,
                )
            )
        except MailError as exc:
            log.warning(
                "platform_team_invite_mail_failed",
                email=mask_email(email),
                error=exc.message,
            )
            return False, (
                "Die Einladung konnte nicht per E-Mail versendet werden "
                f"({exc.message}). Gib den Link bitte persönlich weiter."
            )
        return True, None

    def _zeile(self, user_id: str) -> dict | None:
        rows = (
            self._db.table("platform_admins")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _aktive_admins(self) -> int:
        """Wie viele aktive Zugänge mit vollen Rechten es noch gibt."""
        res = (
            self._db.table("platform_admins")
            .select("user_id", count="exact")
            .eq("role", "platform_admin")
            .eq("active", True)
            .execute()
        )
        return res.count or 0

    @staticmethod
    def _gueltig(ablauf: str | None) -> bool:
        """True, solange der Einladungszeitraum läuft (fail-closed)."""
        if not ablauf:
            return False
        try:
            ende = datetime.fromisoformat(ablauf)
        except ValueError:
            return False
        if ende.tzinfo is None:
            ende = ende.replace(tzinfo=UTC)
        return ende > datetime.now(UTC)

    def _member(self, row: dict) -> TeamMember:
        """DB-Zeile + GoTrue-Identität zu einem Team-Eintrag zusammenführen."""
        email, letzter_login = self._auth_identitaet(row["user_id"])
        granted_by = row.get("granted_by")
        return TeamMember(
            user_id=row["user_id"],
            email=email,
            platform_role=row.get("role") or "platform_support",
            active=bool(row.get("active")),
            note=row.get("note"),
            created_at=row["created_at"],
            granted_by_email=(
                self._auth_identitaet(granted_by)[0] if granted_by else None
            ),
            last_sign_in_at=letzter_login,
            invite_pending=bool(row.get("invite_token_hash")),
            invite_expires_at=row.get("invite_expires_at"),
        )

    def _auth_identitaet(self, user_id: str) -> tuple[str | None, datetime | None]:
        """E-Mail + letzter Login aus GoTrue. Fehler sind nicht fatal.

        Die Liste soll auch dann etwas anzeigen, wenn GoTrue gerade klemmt —
        dann eben ohne E-Mail statt gar nicht (best-effort, kippt den
        Hauptpfad nicht).
        """
        try:
            res = self._db.auth.admin.get_user_by_id(user_id)
        except Exception as exc:  # noqa: BLE001 — reine Anzeige-Information
            log.warning("platform_team_user_lookup_failed", error=str(exc))
            return None, None
        user = getattr(res, "user", None)
        if user is None:
            return None, None
        return getattr(user, "email", None), getattr(user, "last_sign_in_at", None)
