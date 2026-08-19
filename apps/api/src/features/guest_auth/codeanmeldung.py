"""Anmeldung des Gastes per Einmal-Code (E-Mail → Code → Session).

DER ANLASS (19.08.2026): In der myBestDays-App konnte ein Gast buchen, ohne ein
Konto zu haben und ohne zu bezahlen — Name und E-Mail wurden im Checkout frei
eingetippt. Bei Airbnb ist die Reihenfolge umgekehrt und live nachgesehen
(``/book/stays/…`` ohne Anmeldung): **1. Logge dich ein oder registriere dich →
2. Füge eine Zahlungsart hinzu → 3. Überprüfe deine Anfrage**. Schritt 2 ist
ohne Schritt 1 nicht erreichbar. Genau diese Reihenfolge bekommt die App.

WARUM KEIN EIGENES CODE-VERFAHREN: GoTrue kann das schon. ``generate_link``
liefert neben dem Aktionslink den ROHEN Code (``email_otp``), den derselbe
GoTrue später über ``verify_otp`` akzeptiert — mit eigener Ablauffrist und
Einmal-Verwendung. Ein zweites Code-Register in unserer DB wäre ein zweites
Geheimnislager mit eigener Ablauflogik, das an derselben Stelle falsch sein
kann (Wurzel 7: die Auth-Kontrolle gehört dorthin, wo der Angreifer wirklich
einloggt — nicht in eine App-Schicht daneben).

Versendet wird die Mail von UNS (mailcow, 24 Sprachen, eigenes Layout), nicht
von GoTrue: derselbe Weg wie beim Backoffice-Passwort-Reset (0279). Die
GoTrue-Vorlagen kennen weder unsere Marke noch 24 Sprachen.

KEIN EXISTENZ-LEAK: Ob eine Adresse schon ein Konto hat, verrät die Antwort
nicht. Für unbekannte Adressen wird ein Signup-Code erzeugt (der Auth-User
entsteht dabei UNBESTÄTIGT), für bekannte ein Magiclink-Code. Beide Wege
antworten identisch. Erst NACH dem Nachweis, dass der Gast das Postfach
kontrolliert, sagt die Antwort, ob noch ein Profil fehlt.

WURZEL 2 (real kommt alles doppelt): Ein zweiter Code-Wunsch für dieselbe
Adresse legt keinen zweiten Auth-User an — es wird immer erst nachgesehen, ob
es die Adresse schon gibt, und ein „User already registered" aus dem
Signup-Weg wird auf den Magiclink-Weg umgelenkt. ``profil_anlegen`` ist
idempotent: eine vorhandene ``portal_guests``-Zeile wird ergänzt, nicht
verdoppelt (die id ist der Primärschlüssel).
"""
from __future__ import annotations

from typing import Any

from supabase import Client
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.core.config import Settings, get_settings
from src.core.gotrue_fehler import (
    STOERUNG_MELDUNG,
    TRANSPORT_FEHLER,
    ist_abgelehnt,
    stoerung_oder_ablehnung,
)
from src.core.logging import get_logger, mask_email
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_layout import MailInhalt, mail_rendern
from src.core.mail_sprache import aufloesen
from src.core.mail_texte import text
from src.core.security import GuestContext

from .schemas import (
    GuestCodeAnfrageRequest,
    GuestCodeAntwort,
    GuestCodePruefenRequest,
    GuestProfilAnlegenRequest,
    GuestProfileResponse,
    GuestSessionResponse,
)
from .service import GuestAuthError

log = get_logger("nextdays.guest_auth.code")

# Neutrale Antwort auf jede Code-Anfrage — dieselbe für bekannte und unbekannte
# Adressen, dieselbe auch dann, wenn der Versand scheitert (siehe unten).
_NEUTRAL = "Wenn die Adresse nutzbar ist, wurde ein Code verschickt."


class GuestCodeService:
    """Code anfordern, Code prüfen, fehlendes Profil nachtragen."""

    def __init__(
        self,
        anon_client: Client,
        service_client: Client,
        settings: Settings | None = None,
        mail: MailService | None = None,
    ) -> None:
        # anon: der Gast-Weg (verify_otp stellt die Session aus).
        # service: Admin-Weg (generate_link, Nutzersuche, portal_guests — die
        # Tabelle ist für anon/authenticated per GRANT gesperrt, 0181).
        self._anon = anon_client
        self._service = service_client
        self._settings = settings or get_settings()
        self._mail = mail or MailService(self._settings)

    # --- 1. Code anfordern -------------------------------------------------

    def code_anfordern(self, req: GuestCodeAnfrageRequest) -> GuestCodeAntwort:
        """Einmal-Code erzeugen und per Mail schicken. Antwortet IMMER neutral.

        Auch ein gescheiterter Mailversand ergibt dieselbe Antwort: die
        Unterscheidung „Mail ging raus" / „Mail ging nicht raus" verrät bei
        wiederholtem Probieren, welche Adressen existieren. Der Fehler wird
        geloggt (mit maskierter Adresse), nicht ausgeliefert.
        """
        email = req.email.strip().lower()
        vorhanden = self._konto_vorhanden(email)
        code = self._code_erzeugen(email, neu=not vorhanden)
        if code is not None:
            self._code_senden(email, code, req.locale)
        return GuestCodeAntwort(message=_NEUTRAL)

    def _konto_vorhanden(self, email: str) -> bool:
        """Gibt es zu dieser Adresse schon einen Gast? (service_role, 0181).

        Gefragt wird `portal_guests`, nicht GoTrue: die Tabelle ist unsere
        Wahrheit über Gäste und lässt sich exakt auf die Adresse scopen. Ein
        Auth-User ohne Profilzeile (abgebrochene Erstanmeldung) gilt hier
        bewusst als „nicht vorhanden" — dann läuft der Signup-Weg erneut, und
        genau dessen „User already registered" fängt `_code_erzeugen` auf.
        """
        res = (
            self._service.table("portal_guests")
            .select("id")
            .eq("email", email)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    def _code_erzeugen(self, email: str, *, neu: bool) -> str | None:
        """Roher Einmal-Code von GoTrue (`email_otp`), oder None bei Störung.

        `neu=True` → Signup-Link: der Auth-User entsteht dabei unbestätigt, und
        die Verifikation bestätigt ihn. `neu=False` → Magiclink für ein
        bestehendes Konto. Ein Signup gegen eine bereits registrierte Adresse
        (Rennen zwischen zwei Anfragen) wird auf den Magiclink-Weg umgelenkt.
        """
        try:
            return self._link(email, typ="signup" if neu else "magiclink")
        except GoTrueAuthError as exc:
            if neu and self._schon_registriert(exc):
                try:
                    return self._link(email, typ="magiclink")
                except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc2:
                    self._gotrue_stoerung_pruefen(email, exc2)
                    return None
            self._gotrue_stoerung_pruefen(email, exc)
            return None
        except TRANSPORT_FEHLER as exc:
            self._gotrue_stoerung_pruefen(email, exc)
            return None

    def _link(self, email: str, *, typ: str) -> str:
        """`generate_link` aufrufen und den rohen Code herausgeben."""
        params: dict[str, Any] = {"type": typ, "email": email}
        if typ == "signup":
            # GoTrue verlangt beim Signup-Link ein Passwort. Es wird nie
            # ausgeliefert und nie gebraucht: dieses Konto meldet sich über den
            # Code an. Ein RATEBARER Wert wäre hier fatal — deshalb ein
            # kryptografisch zufälliger, der niemandem bekannt ist (auch uns
            # nicht: er wird nicht gespeichert).
            params["password"] = self._zufallspasswort()
        res = self._service.auth.admin.generate_link(params)
        return res.properties.email_otp

    @staticmethod
    def _zufallspasswort() -> str:
        # secrets, nicht random: das ist ein Geheimnis, keine Zufallszahl.
        from secrets import token_urlsafe  # lokal, damit der Zweck sichtbar bleibt

        return token_urlsafe(32)

    @staticmethod
    def _schon_registriert(exc: Exception) -> bool:
        """Meldet GoTrue „Adresse existiert bereits"?"""
        meldung = str(exc).lower()
        return "already" in meldung and (
            "registered" in meldung or "exists" in meldung
        )

    def _gotrue_stoerung_pruefen(self, email: str, exc: Exception) -> None:
        """Störung des Auth-Dienstes → 503; alles andere bleibt neutral.

        Ein Ausfall darf nicht als „Code verschickt" durchgehen: der Gast würde
        auf eine Mail warten, die nie kommt (Wurzel 5). Eine ABLEHNUNG dagegen
        (unbekannte Adresse, Signup gesperrt) bleibt neutral — sie würde sonst
        die Existenz verraten.
        """
        if stoerung_oder_ablehnung(exc):
            log.warning(
                "guest_code_gotrue_stoerung", email=mask_email(email), error=str(exc)
            )
            raise GuestAuthError(STOERUNG_MELDUNG, status_code=503) from exc
        log.info(
            "guest_code_abgelehnt", email=mask_email(email), error=str(exc)[:200]
        )

    def _code_senden(self, email: str, code: str, locale: str | None) -> None:
        """Code-Mail verschicken (best effort, kippt die neutrale Antwort nicht)."""
        sprache = aufloesen(locale)
        betreff = text("gast_code.betreff", sprache, code=code)
        inhalt = mail_rendern(
            MailInhalt(
                titel=betreff,
                # Der Code als eigener Absatz: er ist das, was der Gast sucht.
                absaetze=[text("gast_code.absatz_1", sprache), code],
                hinweise=[
                    text("gast_code.hinweis_einmal", sprache),
                    text("gast_code.hinweis_nicht_ich", sprache),
                ],
                sprache=sprache,
            )
        )
        try:
            self._mail.send(
                OutboundMessage(
                    to=email,
                    subject=betreff,
                    text=inhalt.text,
                    html=inhalt.html,
                )
            )
        except MailError as exc:
            # Bewusst NICHT durchreichen: der Fehler würde die Existenz der
            # Adresse verraten (ein unbekannter Empfänger scheitert anders als
            # ein bekannter). Der Gast bekommt die neutrale Antwort und kann
            # erneut anfordern.
            log.warning(
                "guest_code_mail_fehlgeschlagen",
                email=mask_email(email),
                error=str(exc)[:200],
            )

    # --- 2. Code prüfen ----------------------------------------------------

    def code_pruefen(self, req: GuestCodePruefenRequest) -> GuestSessionResponse:
        """Code → Session. Falscher/abgelaufener Code ist ein 401.

        Der Code wird von GoTrue geprüft, nicht von uns: Ablauffrist und
        Einmal-Verwendung liegen dort. Beide Typen werden versucht — ein
        Erstanmelder hat einen `signup`-Code, ein bestehendes Konto einen
        `magiclink`-Code, und die App weiß nicht, welcher von beiden gilt (sie
        darf es auch nicht wissen, siehe Existenz-Leak).
        """
        email = req.email.strip().lower()
        code = req.code.strip().replace(" ", "")
        session = None
        letzter: Exception | None = None
        for typ in ("magiclink", "signup", "email"):
            try:
                res = self._anon.auth.verify_otp(
                    {"email": email, "token": code, "type": typ}
                )
            except GoTrueAuthError as exc:
                letzter = exc
                if not ist_abgelehnt(exc):
                    log.warning(
                        "guest_code_verify_stoerung",
                        email=mask_email(email),
                        error=str(exc),
                    )
                    raise GuestAuthError(
                        STOERUNG_MELDUNG, status_code=503
                    ) from exc
                continue
            except TRANSPORT_FEHLER as exc:
                log.warning(
                    "guest_code_verify_transport", email=mask_email(email),
                    error=str(exc),
                )
                raise GuestAuthError(STOERUNG_MELDUNG, status_code=503) from exc
            if res.session is not None:
                session = res.session
                break
        if session is None:
            log.info(
                "guest_code_verify_abgelehnt",
                email=mask_email(email),
                error=str(letzter)[:200] if letzter else None,
            )
            raise GuestAuthError("Code ist ungültig oder abgelaufen.", status_code=401)

        # Profil fehlt = Erstanmeldung. Der Gast IST angemeldet (er hat das
        # Postfach nachgewiesen), aber ohne Namen kann er nicht buchen: eine
        # Reservierung ohne Namen ist für den Gastgeber unbrauchbar.
        return GuestSessionResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            expires_in=session.expires_in,
            profil_fehlt=not self._profil_vorhanden(session.user.id),
        )

    def _profil_vorhanden(self, guest_id: str) -> bool:
        res = (
            self._service.table("portal_guests")
            .select("id, name")
            .eq("id", guest_id)
            .limit(1)
            .execute()
        )
        row = (res.data or [None])[0]
        return bool(row and (row.get("name") or "").strip())

    # --- 3. Profil nachtragen ---------------------------------------------

    def profil_anlegen(
        self, ctx: GuestContext, req: GuestProfilAnlegenRequest
    ) -> GuestProfileResponse:
        """Namen (und optional Telefon) zum frisch angemeldeten Konto schreiben.

        Gescopet über die eigene `guest_id` aus dem Token (Wurzel 3/9) — die
        Route trägt bewusst KEINE id im Pfad, es gibt hier nichts zu erraten.
        `upsert` statt insert-oder-update: der zweite Aufruf (Doppeltipp,
        Retry) darf nicht scheitern und keine zweite Zeile anlegen (Wurzel 2).

        Zurück kommt das PROFIL, keine neue Session: die Session aus Schritt 2
        gilt weiter, und ein zweites Token auszustellen wäre ein Geheimnis mehr
        auf der Leitung, für das es keinen Grund gibt.
        """
        name = req.name.strip()
        if not name:
            raise GuestAuthError("Name fehlt.", status_code=422)
        zeile: dict[str, Any] = {
            "id": ctx.guest_id,
            "email": ctx.email,
            "name": name,
            "phone": (req.phone or "").strip() or None,
        }
        if req.preferred_locale:
            zeile["preferred_locale"] = req.preferred_locale
        if req.preferred_currency:
            zeile["preferred_currency"] = req.preferred_currency
        res = (
            self._service.table("portal_guests")
            .upsert(zeile, on_conflict="id")
            .execute()
        )
        row = (res.data or [None])[0]
        if not row:
            # Ohne Zeile kein Profil — und ohne Profil keine Buchung. Lieber ein
            # klarer Fehler als eine Erfolgsmeldung ohne Gegenstand (Wurzel 5).
            raise GuestAuthError("Profil konnte nicht angelegt werden.", status_code=502)
        log.info("guest_profil_angelegt", guest_id=ctx.guest_id)
        return GuestProfileResponse(
            guest_id=row["id"],
            email=row.get("email") or ctx.email,
            name=row.get("name"),
            phone=row.get("phone"),
            preferred_locale=row.get("preferred_locale"),
            preferred_currency=row.get("preferred_currency"),
            marketing_opt_in=bool(row.get("marketing_opt_in")),
        )
