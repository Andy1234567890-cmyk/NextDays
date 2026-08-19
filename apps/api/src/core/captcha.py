"""Bot-Prüfung öffentlicher Formulare über reCAPTCHA Enterprise (Google Cloud).

EINE Quelle der Wahrheit für die Captcha-Prüfung. Wer ein weiteres öffentliches
Formular baut, ruft `CaptchaService.pruefen()` — es entsteht keine zweite Stelle,
an der ein Score mit einer Schwelle verglichen wird.

WIE ES LÄUFT (score-basierter, unsichtbarer Schlüssel):
  1. Die Seite lädt `https://www.google.com/recaptcha/enterprise.js?render=<site_key>`
     und holt beim Absenden ein Token:
     `grecaptcha.enterprise.execute(site_key, {action: "<aktion>"})`.
  2. Das Token reist als Feld im JSON mit. Es ist ZWEI MINUTEN gültig.
  3. Dieser Service lässt es von Google bewerten:
     `POST {base}/projects/{project}/assessments?key={api_key}`
     mit `{"event": {"token", "siteKey", "expectedAction", "userIpAddress",
     "userAgent"}}`.
  4. Google antwortet mit `tokenProperties.valid`, `tokenProperties.action` und
     `riskAnalysis.score` (0.0 = sicher Bot … 1.0 = sicher Mensch).

WARUM SERVERSEITIG: Ein Token, das nur der Browser erzeugt und niemand bewertet,
ist Dekoration — der Bot schickt einfach kein Token oder ein altes. Die
Bewertung ist der einzige Schritt, der zählt.

Wurzeln (CLAUDE.md):
- W4: Es gibt KEINEN erfundenen Ersatz-Score. Fehlen die Schlüssel, ist der
  Schutz nicht da; das sagt `Settings.captcha_sandbox` ausdrücklich, und
  außerhalb von `local` führt es zu 503 statt zu stillem Durchlassen.
- W5: Fail-CLOSED. Fehlendes Token, Netzwerkfehler, unerwartete Antwort,
  Aktions-Verwechslung, Score unter der Schwelle — jedes davon weist die Anfrage
  ab. Ein `except` das alles verschluckt und „bestanden" meldet, wäre die
  wirkungsvollste Art, den Spamschutz abzuschalten.
- W8: Das Token ist angreiferkontrollierter Input und hat deshalb eine harte
  Längengrenze, BEVOR es zu Google geht — ein 10-MB-„Token" darf nicht erst bei
  Google auffallen.
"""
from __future__ import annotations

from typing import Any

import httpx

from src.core.config import Settings, get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.captcha")

# Obergrenze für das Token (W8). Echte reCAPTCHA-Token liegen bei ~600–2000
# Zeichen; 4000 ist reichlich Luft und trotzdem eine Grenze.
TOKEN_MAX = 4000

_TIMEOUT = 10.0

# Score, der in der Sandbox zurückgegeben wird. Bewusst ein eigener Name statt
# einer 1.0 im Code: so ist an der Aufrufstelle erkennbar, dass hier NICHT
# gemessen, sondern übersprungen wurde.
SANDBOX_SCORE = 1.0


class CaptchaError(Exception):
    """Prüfung nicht bestanden oder nicht durchführbar.

    `status_code` unterscheidet die beiden Fälle, weil sie verschiedene Leute
    angehen: 403 heißt „der Absender ist durchgefallen", 502/503 heißt „wir
    können gerade nicht prüfen" — Letzteres ist ein Betriebs-, kein Nutzerfehler.
    """

    def __init__(self, message: str, *, status_code: int = 403) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class CaptchaService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def pruefen(
        self,
        token: str | None,
        *,
        aktion: str,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> float:
        """Bewertet das Token und gibt den Score zurück. Wirft bei Nichtbestehen.

        `aktion` MUSS derselbe String sein, den das Frontend an
        `grecaptcha.enterprise.execute` übergibt. Er wird gegengeprüft: sonst
        könnte ein Token, das auf einer harmlosen Seite erzeugt wurde, vor einem
        teuren Endpunkt wiederverwendet werden.
        """
        s = self._settings

        if s.captcha_sandbox:
            # Kein Aufruf bei Google — aber protokolliert, damit im Log steht,
            # dass hier NICHT geprüft wurde.
            log.info(
                "captcha_sandbox_skip",
                aktion=aktion,
                token_vorhanden=bool(token and token.strip()),
            )
            return SANDBOX_SCORE

        if not s.captcha_configured:
            # Außerhalb von `local` ist das ein Konfigurationsfehler, kein
            # Grund, ungeprüft anzunehmen (W5).
            raise CaptchaError(
                "Spamschutz ist nicht konfiguriert (RECAPTCHA_PROJECT_ID, "
                "RECAPTCHA_API_KEY und RECAPTCHA_SITE_KEY fehlen).",
                status_code=503,
            )

        wert = (token or "").strip()
        if not wert:
            raise CaptchaError("Spamschutz-Prüfung fehlt.", status_code=403)
        if len(wert) > TOKEN_MAX:
            raise CaptchaError("Spamschutz-Prüfung ungültig.", status_code=403)

        daten = self._bewerten(wert, aktion=aktion, ip=ip, user_agent=user_agent)
        return self._auswerten(daten, aktion=aktion)

    # --- intern --------------------------------------------------------------

    def _bewerten(
        self,
        token: str,
        *,
        aktion: str,
        ip: str | None,
        user_agent: str | None,
    ) -> dict[str, Any]:
        """Ruft die Assessment-API. Jeder Fehlschlag ist ein Fehlschlag (W5)."""
        s = self._settings
        url = (
            f"{s.recaptcha_base_url.rstrip('/')}"
            f"/projects/{s.recaptcha_project_id.strip()}/assessments"
        )
        ereignis: dict[str, Any] = {
            "token": token,
            "siteKey": s.recaptcha_site_key.strip(),
            "expectedAction": aktion,
        }
        # Beide Felder sind optional und verbessern die Bewertung. Sie werden nur
        # gesetzt, wenn sie WIRKLICH vorliegen — ein leerer String wäre eine
        # Falschangabe an Google (W4).
        if ip:
            ereignis["userIpAddress"] = ip
        if user_agent:
            ereignis["userAgent"] = user_agent

        try:
            antwort = httpx.post(
                url,
                params={"key": s.recaptcha_api_key.get_secret_value().strip()},
                json={"event": ereignis},
                timeout=_TIMEOUT,
            )
        except httpx.HTTPError as exc:
            # Netz/TLS/Timeout: wir KÖNNEN nicht prüfen. Fail-closed — lieber
            # eine Anfrage verlieren als das Formular zum offenen Spam-Tor
            # machen.
            log.warning("captcha_request_failed", aktion=aktion, error=str(exc))
            raise CaptchaError(
                "Spamschutz ist derzeit nicht erreichbar. Bitte später erneut "
                "versuchen.",
                status_code=502,
            ) from exc

        if antwort.status_code != 200:
            # 400/403 hier heißt fast immer: falsches Projekt, falscher
            # API-Schlüssel oder die API ist im Projekt nicht aktiviert. Das ist
            # ein Konfigurationsfehler und wird laut gemeldet, nicht wiederholt.
            log.error(
                "captcha_assessment_rejected",
                aktion=aktion,
                status=antwort.status_code,
                body=antwort.text[:500],
            )
            raise CaptchaError(
                "Spamschutz-Prüfung fehlgeschlagen.", status_code=502
            )

        try:
            daten = antwort.json()
        except ValueError as exc:
            log.error("captcha_assessment_unparsable", aktion=aktion)
            raise CaptchaError(
                "Spamschutz-Prüfung fehlgeschlagen.", status_code=502
            ) from exc

        if not isinstance(daten, dict):
            raise CaptchaError(
                "Spamschutz-Prüfung fehlgeschlagen.", status_code=502
            )
        return daten

    def _auswerten(self, daten: dict[str, Any], *, aktion: str) -> float:
        """Liest `tokenProperties` und `riskAnalysis` — jede Lücke ist ein Nein."""
        eigenschaften = daten.get("tokenProperties")
        if not isinstance(eigenschaften, dict):
            # Antwort ohne tokenProperties ist keine Bewertung, die wir deuten
            # könnten. Nicht als „bestanden" durchwinken.
            log.error("captcha_no_token_properties", aktion=aktion)
            raise CaptchaError(
                "Spamschutz-Prüfung fehlgeschlagen.", status_code=502
            )

        if not eigenschaften.get("valid"):
            grund = str(eigenschaften.get("invalidReason") or "UNBEKANNT")
            # `EXPIRED_OR_DUPLICATE` ist der häufigste echte Fall: das Token ist
            # nur zwei Minuten gültig und nur EINMAL verwendbar.
            log.info("captcha_token_invalid", aktion=aktion, grund=grund)
            raise CaptchaError(
                "Die Spamschutz-Prüfung ist abgelaufen. Bitte das Formular "
                "erneut absenden.",
                status_code=403,
            )

        tatsaechlich = eigenschaften.get("action")
        if tatsaechlich and tatsaechlich != aktion:
            # Token aus einem anderen Formular. Wäre es erlaubt, wäre die
            # Aktionsangabe wertlos.
            log.warning(
                "captcha_action_mismatch",
                erwartet=aktion,
                erhalten=str(tatsaechlich),
            )
            raise CaptchaError("Spamschutz-Prüfung ungültig.", status_code=403)

        analyse = daten.get("riskAnalysis")
        if not isinstance(analyse, dict) or not isinstance(
            analyse.get("score"), (int, float)
        ):
            # Ein gültiges Token ohne Score kann nicht bewertet werden. Kein
            # erfundener Ausweichwert (W4).
            log.error("captcha_no_score", aktion=aktion)
            raise CaptchaError(
                "Spamschutz-Prüfung fehlgeschlagen.", status_code=502
            )

        score = float(analyse["score"])
        if score < self._settings.recaptcha_min_score:
            log.info(
                "captcha_score_too_low",
                aktion=aktion,
                score=score,
                schwelle=self._settings.recaptcha_min_score,
                gruende=analyse.get("reasons") or [],
            )
            raise CaptchaError(
                "Die Anfrage wurde als automatisiert eingestuft und nicht "
                "angenommen.",
                status_code=403,
            )

        log.info("captcha_passed", aktion=aktion, score=score)
        return score
