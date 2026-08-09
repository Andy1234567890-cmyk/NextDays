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
from src.core.mail_layout import Aktion, MailInhalt, mail_rendern
from src.core.mail_texte import text
from src.core.security import PlatformContext

from .schemas import (
    TeamInvite,
    TeamInviteAccept,
    TeamInviteResult,
    TeamList,
    TeamMember,
    TeamPasswordResetConfirm,
    TeamPasswordResetRequest,
    TeamUpdate,
)

log = get_logger("nextdays.platform_team")

_MARKE = "myNextDays"

# Die Sprache der BACKOFFICE-Mails. Anders als bei Betriebs-Nutzern gibt es
# hier keine Empfängersprache: `platform_admins` trägt keine Sprachspalte
# (live geprüft), und die Empfänger sind die eigenen Plattform-Betreiber —
# eine Handvoll interner Konten, kein europaweites Publikum. Statt eine
# Spalte für drei Personen zu erfinden, steht die Sprache hier bewusst als
# EINE benannte Konstante: sichtbar, an einer Stelle änderbar und nicht als
# stiller Deutsch-Rückfall über 24 Sprachen verteilt (Wurzel 4).
# Englisch, nicht Deutsch, aus demselben Grund wie in `core.mail_sprache`:
# der nächste Betreiber muss kein Deutsch können.
_BACKOFFICE_SPRACHE = "en"

# Harte Obergrenze (Wurzel 8). Das Betreiber-Team ist klein; wer hier an die
# Grenze stößt, hat ein anderes Problem als die Seitengröße.
_MAX_MEMBERS = 200

# Gültigkeit der Einladung. Kurz genug, dass ein vergessener Link nicht ewig
# offensteht, lang genug für ein Wochenende.
_INVITE_TTL = timedelta(hours=72)

# Gültigkeit eines Passwort-Reset-Links. Deutlich kürzer als die Einladung: hier
# geht es um einen bestehenden Zugang, und der Link liegt in einem Postfach.
_RESET_TTL = timedelta(hours=1)

# Sperrfrist zwischen zwei Reset-Mails an dasselbe Konto. Verhindert, dass der
# öffentliche Endpunkt zum Mail-Bombardement gegen ein Betreiber-Postfach wird
# (der IP-Ratelimit allein hilft dagegen nicht — Wurzel 8).
_RESET_COOLDOWN = timedelta(minutes=1)

# Neutrale Antwort der Reset-Anfrage. EINE Formulierung für alle Fälle: kein
# Konto, kein Backoffice-Zugang, entzogener Zugang, Mailfehler. Wer hier
# unterscheidet, baut ein Verzeichnis der Betreiber-Konten (Wurzel 3/9).
_RESET_ANTWORT = (
    "Falls zu dieser Adresse ein Backoffice-Zugang gehört, ist eine E-Mail "
    "mit einem Link unterwegs."
)

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

    # -- Passwort vergessen --------------------------------------------------
    #
    # Zwei öffentliche Schritte, weil der Nutzer sich per Definition nicht
    # anmelden kann. Der Einmal-Token im Postfach IST die Berechtigung —
    # derselbe Mechanismus wie bei der Einladung, nur mit eigenen Spalten
    # (0279) und einer Stunde Gültigkeit.

    def passwort_reset_anfordern(self, req: TeamPasswordResetRequest) -> str:
        """Reset-Link anfordern. Gibt IMMER dieselbe neutrale Auskunft zurück.

        Jeder Abbruchgrund (keine gültige Adresse, kein Konto, kein
        Backoffice-Zugang, entzogener Zugang, Sperrfrist, Mailfehler) endet in
        derselben Antwort. Das ist hier kein Verschlucken, sondern der Zweck:
        eine unterscheidbare Antwort wäre ein Verzeichnis der Betreiber-Zugänge
        (Wurzel 3/9). Jeder Abbruch wird protokolliert, damit der Betrieb sieht,
        was passiert ist.
        """
        email = req.email.strip().lower()
        try:
            self._reset_ausloesen(email)
        except TeamError as exc:
            # EINE Stelle, die abbricht, EINE Antwort: so kann kein neuer
            # Abbruchgrund versehentlich eine unterscheidbare Antwort erzeugen.
            log.info(
                "platform_team_reset_abgebrochen",
                email=mask_email(email),
                grund=exc.message,
            )
        return _RESET_ANTWORT

    def _reset_ausloesen(self, email: str) -> None:
        """Token setzen und Mail schicken. Wirft TeamError bei jedem Abbruch.

        Die Gründe stehen nur im Protokoll, nie in der Antwort — der Aufrufer
        übersetzt sie alle in dieselbe neutrale Auskunft.
        """
        if "@" not in email or email.startswith("@") or email.endswith("@"):
            raise TeamError("Keine gültige E-Mail-Adresse.", status_code=422)
        user_id = self._auth_user_id(email)
        zeile = self._zeile(user_id) if user_id else None
        if zeile is None or not zeile.get("active"):
            # Kein Backoffice-Zugang (oder entzogen) → keine Mail. Der Zugang
            # entsteht ausschließlich über eine Einladung, nie über einen Reset.
            raise TeamError("Kein aktiver Backoffice-Zugang zu dieser Adresse.")
        if self._reset_gesperrt(zeile.get("reset_requested_at")):
            raise TeamError("Sperrfrist seit der letzten Anfrage läuft noch.")

        token = secrets.token_urlsafe(32)
        link = self._reset_link(token)
        jetzt = datetime.now(UTC)
        self._db.table("platform_admins").update(
            {
                "reset_token_hash": _hash(token),
                "reset_expires_at": (jetzt + _RESET_TTL).isoformat(),
                "reset_requested_at": jetzt.isoformat(),
            }
        ).eq("user_id", zeile["user_id"]).execute()

        try:
            self._reset_mail(email, link)
        except MailError as exc:
            # Gegenzustand (Wurzel 1): ging die Mail nicht raus, darf der Token
            # nicht in der DB stehenbleiben — sonst liegt ein gültiger Zugang
            # bereit, den niemand bekommen hat. `reset_requested_at` bleibt,
            # damit die Sperrfrist auch den Fehlerfall deckt.
            self._db.table("platform_admins").update(
                {"reset_token_hash": None, "reset_expires_at": None}
            ).eq("user_id", zeile["user_id"]).execute()
            log.warning(
                "platform_team_reset_mail_failed",
                user_id=zeile["user_id"],
                error=exc.message,
            )
            raise TeamError(f"Mailversand fehlgeschlagen: {exc.message}") from exc

        log.info("platform_team_reset_versendet", user_id=zeile["user_id"])

    def passwort_neu_setzen(self, req: TeamPasswordResetConfirm) -> None:
        """Neues Passwort über den Reset-Token setzen (öffentlich).

        Fehlerfälle antworten absichtlich gleich — ob ein Token existiert, geht
        niemanden etwas an. Nach dem Wechsel werden ALLE Sitzungen des Kontos
        widerrufen: ein Reset ist der Weg, den ein Kompromittierter geht, und
        eine überlebende fremde Sitzung würde ihn wirkungslos machen.
        """
        rows = (
            self._db.table("platform_admins")
            .select("user_id, reset_expires_at, active, accepted_at")
            .eq("reset_token_hash", _hash(req.token))
            .limit(1)
            .execute()
        ).data or []
        zeile = rows[0] if rows else None
        if (
            zeile is None
            or not zeile.get("active")
            or not self._gueltig(zeile.get("reset_expires_at"))
        ):
            raise TeamError("Link ungültig oder abgelaufen.", status_code=400)

        user_id = zeile["user_id"]
        try:
            self._db.auth.admin.update_user_by_id(
                user_id, {"password": req.password}
            )
        except Exception as exc:  # noqa: BLE001 — in TeamError übersetzen
            log.warning("platform_team_reset_set_failed", error=str(exc))
            raise TeamError(
                "Passwort konnte nicht gesetzt werden.", status_code=502
            ) from exc

        felder: dict[str, object] = {
            "reset_token_hash": None,
            "reset_expires_at": None,
        }
        if not zeile.get("accepted_at"):
            # Der Reset ersetzt eine noch offene Einladung: wer ein Passwort
            # gesetzt hat, ist angenommen, und der Einladungslink ist damit
            # verbraucht (Wurzel 1 — sonst zeigt die Team-Liste ewig
            # „Einladung ausstehend" und ein zweiter Link bleibt gültig).
            felder["accepted_at"] = datetime.now(UTC).isoformat()
            felder["invite_token_hash"] = None
            felder["invite_expires_at"] = None
        self._db.table("platform_admins").update(felder).eq(
            "user_id", user_id
        ).execute()
        self._alle_sitzungen_widerrufen(user_id)
        log.info("platform_team_reset_gesetzt", user_id=user_id)

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
        sprache = _BACKOFFICE_SPRACHE
        von = actor.email or text("layout.absender", sprache, marke=_MARKE)
        mail = mail_rendern(
            MailInhalt(
                titel=text("backoffice.einladung.titel", sprache),
                absaetze=[
                    text(
                        "backoffice.einladung.absatz", sprache,
                        von=von, marke=_MARKE,
                    ),
                    text("backoffice.einladung.absatz_passwort", sprache),
                ],
                aktion=Aktion(
                    text=text("auth.einladung.aktion", sprache), url=link
                ),
                hinweise=[
                    text("backoffice.einladung.hinweis_gueltig", sprache),
                    text("auth.einladung.hinweis_ignorieren", sprache),
                ],
                sprache=sprache,
            ),
            settings=self._settings,
        )
        try:
            self._mail.send(
                OutboundMessage(
                    to=email,
                    subject=text(
                        "backoffice.einladung.betreff", sprache, marke=_MARKE
                    ),
                    text=mail.text,
                    html=mail.html,
                    inline_bilder=mail.inline_bilder,
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

    def _reset_link(self, token: str) -> str:
        """Absoluter Link auf die „neues Passwort"-Seite des Backoffice."""
        basis = (self._settings.admin_base_url or "").rstrip("/")
        if not basis:
            raise TeamError(
                "ADMIN_BASE_URL ist nicht konfiguriert — ohne sie kann kein "
                "Reset-Link erzeugt werden.",
                status_code=500,
            )
        return f"{basis}/passwort-neu?token={token}"

    def _reset_mail(self, email: str, link: str) -> None:
        """Reset-Link verschicken (über den eigenen Mailcow-SMTP, `core.mail`).

        Wirft `MailError` weiter — der Aufrufer nimmt den Token dann zurück.
        """
        sprache = _BACKOFFICE_SPRACHE
        mail = mail_rendern(
            MailInhalt(
                titel=text("backoffice.reset.titel", sprache),
                absaetze=[
                    text("backoffice.reset.absatz", sprache, marke=_MARKE)
                ],
                aktion=Aktion(
                    text=text("auth.reset.aktion", sprache), url=link
                ),
                hinweise=[
                    text("auth.reset.hinweis_gueltig", sprache),
                    text("auth.reset.hinweis_ignorieren", sprache),
                ],
                sprache=sprache,
            ),
            settings=self._settings,
        )
        self._mail.send(
            OutboundMessage(
                to=email,
                subject=text(
                    "backoffice.reset.betreff", sprache, marke=_MARKE
                ),
                text=mail.text,
                html=mail.html,
                inline_bilder=mail.inline_bilder,
            )
        )

    @staticmethod
    def _reset_gesperrt(zuletzt: str | None) -> bool:
        """True, solange die Sperrfrist seit der letzten Anfrage läuft.

        Ein unlesbarer Zeitstempel gilt als „nicht gesperrt": lieber eine Mail
        zu viel als ein Konto, das sich nie zurücksetzen lässt.
        """
        if not zuletzt:
            return False
        try:
            gesetzt = datetime.fromisoformat(zuletzt)
        except ValueError:
            return False
        if gesetzt.tzinfo is None:
            gesetzt = gesetzt.replace(tzinfo=UTC)
        return gesetzt + _RESET_COOLDOWN > datetime.now(UTC)

    def _alle_sitzungen_widerrufen(self, user_id: str) -> None:
        """Jede aktive Sitzung des Kontos beenden (RPC aus 0191, keep=None).

        Best-effort: schlägt der Aufruf fehl, ist das Passwort trotzdem neu —
        das darf den Hauptpfad nicht kippen. Protokolliert, damit ein
        klemmender Widerruf nicht unbemerkt bleibt.
        """
        try:
            self._db.rpc(
                "host_revoke_other_sessions",
                {"p_user_id": user_id, "p_keep_session_id": None},
            ).execute()
        except Exception as exc:  # noqa: BLE001 — reiner Aufräum-Schritt
            log.warning(
                "platform_team_reset_sessions_failed",
                user_id=user_id,
                error=str(exc),
            )

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
