"""Das LOGIN-KONTO einer Partner-Bewerbung — anlegen, erweitern, zurücknehmen.

Ausgelagert aus ``service.py``, weil jenes Modul die pylint-Zeilengrenze (1500)
riss. Fachlich ist es ein eigener Gegenstand: hier geht es ausschließlich um
``auth.users`` und ``app_metadata``, nicht um Bewerbung, Provision oder Rang.

DER FALL, DER DIESE DATEI GEPRÄGT HAT (03.09.2026): Das Partner-Modul ist eine
eigene Auth-Welt und hat mit den Tenants nichts zu tun. GoTrue hat aber nur
EINE ``auth.users`` mit ``users_email_partial_key UNIQUE (email)`` — zwei
Konten derselben Adresse sind darin technisch unmöglich. Live traf das
a.staudinger32@icloud.com: die Adresse hatte ein EIGENTÜMER-Konto des Betriebs
AirSmil (``role: owner``, ``tenant_id: a25577cf…``) und KEINE Bewerbung. Das
Anlegen scheiterte, und das Formular behauptete „Für diese E-Mail gibt es
bereits eine Bewerbung. Melden Sie sich im Partner-Dashboard an" — dort war
nichts.

Gelöst wird es, indem das BESTEHENDE Konto um ``app_metadata.affiliate = true``
erweitert wird. Die Welten bleiben getrennt, obwohl das Konto beide Kennungen
trägt: ``core.security.get_current_affiliate`` prüft AUSSCHLIESSLICH
``affiliate is True`` plus eine Zeile in ``public.affiliates``,
``get_current_user`` liest ausschließlich ``tenant_id``. Keine der beiden
Prüfungen gewährt etwas aus der anderen Welt — ein Eigentümer wird durch die
Bewerbung nicht zum Admin, ein Partner bekommt keinen Tenant-Zugriff.

WAS DABEI NICHT PASSIEREN DARF, und wogegen
``test_rollback_loescht_ein_bestandskonto_NICHT`` sichert: Bei einem
fehlgeschlagenen Bewerbungs-Insert nahm der Rollback bisher das Konto mit. Bei
einem erweiterten Bestandskonto wäre das die Löschung eines fremden
PMS-Zugangs — deshalb trägt der Ablauf ``neu_angelegt`` mit und entfernt sonst
nur die Partner-Kennung (Wurzel 1: der Gegenzustand ist die Kennung, nicht das
Konto).
"""

from __future__ import annotations

from pydantic import SecretStr
from supabase_auth.errors import AuthError as GoTrueAuthError

from src.core.gotrue_fehler import (
    STOERUNG_MELDUNG,
    TRANSPORT_FEHLER,
    stoerung_oder_ablehnung,
)
from src.core.logging import get_logger, mask_email

from .fehler import AffiliateError
from .schemas import (
    PartnerLogin,
    PartnerMessage,
    PartnerPasswordReset,
    PartnerPasswortNeu,
    PartnerSession,
)

log = get_logger("nextdays.affiliates.login_konto")


def _ist_email_vergeben(exc: Exception) -> bool:
    """Hat GoTrue das Anlegen abgelehnt, WEIL die Adresse schon existiert?


    GoTrue liefert dafür keinen stabilen Fehlercode über den Python-Client — die
    Ablehnung kommt als Text („User already registered", `email_exists`). Deshalb
    wird der Text geprüft, und zwar auf mehrere Schreibweisen: eine einzige
    würde bei der nächsten GoTrue-Version still zu „unbekannter Fehler" werden.

    Fail-SAFE in die andere Richtung (Wurzel 5): erkennt diese Funktion den Fall
    nicht, antwortet der Aufrufer 502 „konnte nicht angelegt werden" statt einer
    Behauptung über das Konto. Eine falsche Aussage über ein bestehendes Konto
    ist schlimmer als ein technischer Fehler.
    """
    text = str(exc).casefold()
    return any(
        marker in text
        for marker in (
            "already registered",
            "already been registered",
            "email_exists",
            "user already exists",
            "duplicate key",
        )
    )


class LoginKontoMixin:
    """Die Login-Konto-Schritte. Erwartet ``self._db`` und ``self._anon``."""

    def password_reset(self, req: PartnerPasswordReset) -> PartnerMessage:
        """Antwortet IMMER neutral (kein Existenz-Leak).

        ``redirect_to`` zeigt auf die Seite der PARTNER-App, die das neue
        Passwort setzt. Ohne diese Angabe nimmt GoTrue seine eigene
        ``GOTRUE_SITE_URL`` — und die zeigt im Stack auf die Supabase-Adresse,
        die 404 gibt (live gemessen 03.09.2026). Der Link in der Mail führte
        damit ins Nichts, selbst wenn man ihn erreichte.

        Das Ziel MUSS in ``GOTRUE_URI_ALLOW_LIST`` stehen (Coolify-Variable
        ``ADDITIONAL_REDIRECT_URLS`` des Supabase-Stacks), sonst verwirft
        GoTrue es stillschweigend und fällt auf die Site-URL zurück — ein
        Fehler, der niemandem auffällt, weil die Mail trotzdem ankommt.

        Fehlt ``partner_base_url``, wird KEIN Ziel übergeben statt eines
        geratenen (Wurzel 4): dann bleibt es beim bisherigen Verhalten, und
        der Code in der Mail funktioniert weiterhin.
        """
        basis = (self._settings.partner_base_url or "").strip().rstrip("/")
        optionen = {"redirect_to": f"{basis}/passwort-neu"} if basis else None
        if not basis:
            log.error(
                "partner_base_url_fehlt",
                hinweis="PARTNER_BASE_URL setzen — Reset-Mail ohne Rücksprungziel.",
            )
        try:
            if optionen:
                self._anon.auth.reset_password_email(req.email, optionen)
            else:
                self._anon.auth.reset_password_email(req.email)
        except Exception as exc:  # noqa: BLE001 — best-effort, neutrale Antwort bleibt
            log.warning(
                "partner_password_reset_failed", email=mask_email(req.email), error=str(exc)
            )
        return PartnerMessage(message="Falls ein Konto existiert, wurde eine E-Mail versendet.")

    def passwort_neu_setzen(self, req: PartnerPasswortNeu) -> PartnerSession:
        """Neues Passwort mit dem Code aus der Reset-Mail setzen und anmelden.

        WARUM DER CODE UND NICHT DER LINK (03.09.2026): Der Link in der Mail
        zeigte auf `{API_EXTERNAL_URL}/verify?token=…`. `API_EXTERNAL_URL` war
        auf die Kong-Basis ohne `/auth/v1` gesetzt — Kong veröffentlicht GoTrue
        aber unter `/auth/v1/verify` (`strip_path: true`), und `/verify`
        antwortete mit „no Route matched". Gemessen: `/auth/v1/verify?…` gibt
        303, `/verify?…` gibt 404. Der Code steht in derselben Mail, hängt an
        keiner URL und ist damit unabhängig vom Proxy.

        ZWEI SCHRITTE, und der zweite braucht den ersten: `verify_otp` tauscht
        Code+Adresse gegen eine Sitzung, und erst MIT dieser Sitzung darf
        `update_user` das Passwort setzen. Ein `update_user` ohne
        vorangegangenes `verify_otp` würde am fehlenden Token scheitern — die
        Reihenfolge ist keine Stilfrage.

        Kein Existenz-Leak (Wurzel 9): ein falscher Code und eine unbekannte
        Adresse ergeben dieselbe 400er-Meldung. Wer raten will, erfährt nicht,
        ob die Adresse überhaupt ein Partnerkonto hat.
        """
        try:
            geprueft = self._anon.auth.verify_otp(
                {
                    "email": str(req.email),
                    "token": req.code.strip(),
                    "type": "recovery",
                }
            )
        except (GoTrueAuthError, *TRANSPORT_FEHLER) as exc:
            if stoerung_oder_ablehnung(exc) and not isinstance(exc, GoTrueAuthError):
                raise AffiliateError(STOERUNG_MELDUNG, status_code=503) from exc
            log.info("partner_reset_code_ungueltig", email=mask_email(str(req.email)))
            raise AffiliateError(
                "Code ist ungültig oder abgelaufen. Bitte neu anfordern.",
                status_code=400,
            ) from exc
        if geprueft.session is None:
            raise AffiliateError(
                "Code ist ungültig oder abgelaufen. Bitte neu anfordern.",
                status_code=400,
            )

        # Eigener Client MIT der frisch geprüften Sitzung: `self._anon` ist
        # geteilt, und ihm hier eine Nutzersitzung aufzudrücken würde den
        # nächsten Aufrufer betreffen.
        try:
            self._anon.auth.set_session(
                geprueft.session.access_token, geprueft.session.refresh_token
            )
            self._anon.auth.update_user(
                {"password": req.password.get_secret_value()}
            )
        except Exception as exc:
            log.warning(
                "partner_passwort_setzen_fehlgeschlagen",
                email=mask_email(str(req.email)),
                error=str(exc),
            )
            raise AffiliateError(
                "Passwort konnte nicht gesetzt werden.", status_code=502
            ) from exc
        finally:
            # Die Sitzung IMMER wieder abräumen — auch im Fehlerfall, sonst
            # trägt der geteilte Client fremde Anmeldedaten weiter.
            try:
                self._anon.auth.sign_out()
            except Exception:  # noqa: BLE001 — best effort
                log.debug("partner_signout_nach_reset_fehlgeschlagen")

        log.info("partner_passwort_neu", email=mask_email(str(req.email)))
        return self.login(
            PartnerLogin(email=req.email, password=req.password)
        )

    def _login_konto_sichern(
        self, email: str, password: SecretStr
    ) -> tuple[str, bool]:
        """``(auth.uid(), neu_angelegt)`` für die Bewerbung.

        ``neu_angelegt=False`` heißt: die Adresse hatte schon ein Konto und
        wurde nur um die Partner-Kennung erweitert. Der Aufrufer darf es dann
        bei einem Fehler nicht löschen.
        """
        vorher = self._auth_user_id_zu_email(email)
        user_id = self._create_auth_user(email, password)
        return user_id, vorher is None


    def _rollback_login_konto(self, user_id: str, *, neu_angelegt: bool) -> None:
        """Den Login-Zustand zurücknehmen — je nachdem, was angelegt wurde.

        Neu angelegtes Konto → löschen (wie bisher). ERWEITERTES Bestandskonto
        → nur die Partner-Kennung entfernen; das Konto selbst gehört einem
        Tenant-Nutzer und darf nicht verschwinden. Ohne diese Unterscheidung
        hätte ein fehlgeschlagener Bewerbungs-Insert das Eigentümer-Konto
        gelöscht, mit dem sich derselbe Mensch im PMS anmeldet.
        """
        if neu_angelegt:
            self._rollback_auth_user(user_id)
            return
        try:
            self._db.auth.admin.update_user_by_id(
                user_id, {"app_metadata": {"affiliate": None}}
            )
        except Exception as exc:  # noqa: BLE001 — Best-effort, nur loggen
            log.error(
                "partner_kennung_rollback_fehlgeschlagen",
                user_id=user_id,
                error=str(exc),
            )


    def _auth_user_id_zu_email(self, email: str) -> str | None:
        """Die auth.uid() zu einer E-Mail — oder ``None``.

        Über die Admin-API und nicht über einen SQL-Zugriff auf `auth.users`:
        jenes Schema gehört Supabase, und ein direkter Select darauf wäre eine
        zweite Wahrheit, die beim nächsten GoTrue-Update bricht.
        """
        try:
            res = self._db.auth.admin.list_users()
        except Exception as exc:  # noqa: BLE001 — nur ein Nachschlag
            log.warning("partner_lookup_user_failed", error=str(exc))
            return None
        gesucht = email.strip().casefold()
        # Die Antwortform hat je Client-Version zwei Gestalten (Liste oder
        # Objekt mit `.users`) — beide bedienen, statt auf eine zu wetten.
        nutzer = getattr(res, "users", res) or []
        for u in nutzer:
            if str(getattr(u, "email", "") or "").strip().casefold() == gesucht:
                return str(getattr(u, "id", "") or "") or None
        return None


    def _als_partner_kennzeichnen(self, user_id: str) -> None:
        """``app_metadata.affiliate = true`` setzen, alles andere unverändert.

        Supabase MERGT `app_metadata` beim Update, überschreibt es nicht — ein
        vorhandenes `tenant_id`/`role` bleibt also stehen. Genau darauf kommt
        es an: das Konto soll in BEIDEN Welten funktionieren, und ein
        weggeräumtes `tenant_id` hätte den Eigentümer aus seinem eigenen
        Betrieb ausgesperrt (Wurzel 1).
        """
        try:
            self._db.auth.admin.update_user_by_id(
                user_id, {"app_metadata": {"affiliate": True}}
            )
        except Exception as exc:
            log.warning(
                "partner_kennzeichnen_fehlgeschlagen", user_id=user_id, error=str(exc)
            )
            raise AffiliateError(
                "Partner-Zugang konnte nicht eingerichtet werden.", status_code=502
            ) from exc


    def _create_auth_user(self, email: str, password: SecretStr) -> str:
        try:
            res = self._db.auth.admin.create_user(
                {
                    "email": email,
                    "password": password.get_secret_value(),
                    # Wie bei portal_guests (Staging-Provisorium, dort dokumentiert):
                    # die Freigabe ist ohnehin manuell, der Bewerber kann bis
                    # dahin nichts auslösen.
                    "email_confirm": True,
                    # DAS Erkennungsmerkmal der Partner-Welt (core.security).
                    "app_metadata": {"affiliate": True},
                }
            )
        except Exception as exc:
            # E-Mail schon in `auth.users`? Dann wird das BESTEHENDE Konto zum
            # Partner-Konto erweitert, statt die Bewerbung abzulehnen.
            #
            # WARUM (03.09.2026): Das Partner-Modul ist eine eigene Auth-Welt —
            # es hat mit den Tenants nichts zu tun. GoTrue hat aber nur EINE
            # `auth.users` mit `users_email_partial_key UNIQUE (email)`; zwei
            # Konten derselben Adresse sind darin technisch unmöglich. Live
            # traf das a.staudinger32@icloud.com: die Adresse hatte ein
            # EIGENTÜMER-Konto des Betriebs AirSmil (`role: owner`,
            # `tenant_id: a25577cf…`) und KEINE Bewerbung. Das Anlegen
            # scheiterte, und das Formular behauptete „Für diese E-Mail gibt es
            # bereits eine Bewerbung. Melden Sie sich im Partner-Dashboard an"
            # — dort war nichts.
            #
            # Die Welten bleiben getrennt, obwohl das Konto beide Kennungen
            # trägt: `get_current_affiliate` prüft AUSSCHLIESSLICH
            # `app_metadata.affiliate is True` PLUS eine Zeile in
            # `public.affiliates`, `get_current_user` liest ausschließlich
            # `tenant_id`. Keine der beiden Prüfungen gewährt etwas aus der
            # anderen Welt — ein Eigentümer wird durch die Bewerbung nicht zum
            # Admin, und ein Partner bekommt keinen Tenant-Zugriff.
            #
            # `tenant_id` und `role` werden dabei NICHT angefasst (Wurzel 1:
            # der Gegenzustand wird gepflegt, nicht überfahren): das
            # Eigentümer-Konto muss weiter funktionieren.
            if _ist_email_vergeben(exc):
                bestehend = self._auth_user_id_zu_email(email)
                if bestehend:
                    self._als_partner_kennzeichnen(bestehend)
                    log.info(
                        "partner_konto_erweitert",
                        user_id=bestehend,
                        email=mask_email(email),
                    )
                    return bestehend
            log.warning(
                "partner_create_user_failed",
                email=mask_email(email),
                error=str(exc),
            )
            raise AffiliateError(
                "Konto konnte nicht angelegt werden.", status_code=502
            ) from exc
        if res.user is None:
            raise AffiliateError("Konto konnte nicht angelegt werden.", status_code=500)
        return res.user.id


    def _rollback_auth_user(self, user_id: str) -> None:
        try:
            self._db.auth.admin.delete_user(user_id)
        except Exception as exc:  # noqa: BLE001 — Best-effort-Rollback, nur loggen
            log.error("partner_rollback_user_failed", user_id=user_id, error=str(exc))
