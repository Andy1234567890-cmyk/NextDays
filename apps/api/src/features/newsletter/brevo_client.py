"""HTTP-Client für die Brevo-API v3 (Marketing-Kontakte).

Brevo ist bei uns AUSSCHLIESSLICH der Marketing-Kanal (Liste + Kampagnen).
Transaktionsmails laufen weiter über den eigenen Mailcow (`core.mail`) — zwei
Absenderwege mit derselben Domain hätten getrennte DKIM-/Reputationslagen.

Eckdaten (developers.brevo.com):
  - Auth: Header `api-key: <KEY>`, Body immer `application/json`
    (anderer Content-Type → 406).
  - `POST /contacts` legt an; **ohne** `updateEnabled: true` antwortet Brevo bei
    bekannter Adresse mit 400 `duplicate_parameter`. Wir setzen das Flag UND
    behandeln die 400 zusätzlich als Erfolg — eine zweite Anmeldung derselben
    Person ist kein Fehler (Wurzel 2).
  - Rate-Limit für /contacts: 10 Anfragen/Sekunde, 36.000/Stunde. Bei 429 steht
    die Wartezeit in `x-sib-ratelimit-reset` (Sekunden).
  - 401/403 heißen: Schlüssel falsch ODER die aufrufende IP steht nicht in der
    Authorized-IP-Liste des Kontos. Beides ist ein Konfigurationsfehler und wird
    NICHT wiederholt, sondern laut gemeldet (Wurzel 5).
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from src.core.config import Settings, get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.brevo")

# Nur diese Statuscodes sind wiederholbar. Alles andere ist ein Sachfehler.
_RETRY_STATUS = (429, 500, 502, 503, 504)
_MAX_VERSUCHE = 3
_TIMEOUT = 15.0


class BrevoError(Exception):
    """Aufruf fehlgeschlagen. `retryable` sagt, ob ein späterer Lauf helfen kann."""

    def __init__(
        self, message: str, *, status_code: int | None = None, retryable: bool = False
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.retryable = retryable


class BrevoNotConfigured(BrevoError):
    """Kein API-Schlüssel/keine Listen-ID hinterlegt.

    Eigener Typ, weil der Aufrufer das anders behandelt als einen Fehler: die
    Voranmeldung bleibt gültig, nur der Abgleich steht aus (Wurzel 4: nichts
    erfinden, aber auch nicht still „erfolgreich" melden)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=None, retryable=True)


class BrevoClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    @property
    def configured(self) -> bool:
        """True, wenn Schlüssel UND Ziel-Liste gesetzt sind."""
        s = self._settings
        return bool(s.brevo_api_key.get_secret_value() and s.brevo_list_id)

    # -- öffentliche Aufrufe --------------------------------------------------

    def upsert_contact(
        self, email: str, *, attributes: dict[str, Any] | None = None
    ) -> str | None:
        """Kontakt anlegen/aktualisieren und in die Voranmelde-Liste legen.

        Gibt die Brevo-Kontakt-ID zurück, sofern Brevo eine liefert (bei einem
        Update auf einen bestehenden Kontakt kommt keine). Eine bereits bekannte
        Adresse ist ein Erfolg, kein Fehler.
        """
        s = self._settings
        body: dict[str, Any] = {
            "email": email,
            "updateEnabled": True,
            "listIds": [s.brevo_list_id],
        }
        if attributes:
            # Brevo erwartet Attributnamen in GROSSBUCHSTABEN.
            body["attributes"] = {k.upper(): v for k, v in attributes.items() if v}
        data = self._post("/contacts", body)
        wert = data.get("id") if isinstance(data, dict) else None
        return str(wert) if wert is not None else None

    def blacklist_contact(self, email: str) -> None:
        """Abmeldung: Kontakt auf die Sperrliste setzen (Daten bleiben erhalten).

        Bewusst KEIN Löschen: Brevo unterscheidet Abmeldung (blocklisted) von
        einem DSGVO-Löschbegehren (`DELETE /contacts/{id}`). Wer sich abmeldet,
        will keine Mails mehr — nicht zwingend die Löschung seiner Historie.
        """
        from urllib.parse import quote

        self._request(
            "PUT",
            f"/contacts/{quote(email, safe='')}?identifierType=email_id",
            {"emailBlacklisted": True},
        )

    # -- intern ---------------------------------------------------------------

    def _post(self, pfad: str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", pfad, body)

    def _request(
        self, methode: str, pfad: str, body: dict[str, Any]
    ) -> dict[str, Any]:
        s = self._settings
        schluessel = s.brevo_api_key.get_secret_value()
        if not schluessel or not s.brevo_list_id:
            raise BrevoNotConfigured(
                "Brevo ist nicht konfiguriert (BREVO_API_KEY/BREVO_LIST_ID fehlen)."
            )

        url = f"{s.brevo_base_url.rstrip('/')}{pfad}"
        kopf = {
            "api-key": schluessel,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        letzter: BrevoError | None = None
        for versuch in range(1, _MAX_VERSUCHE + 1):
            try:
                res = httpx.request(
                    methode, url, headers=kopf, json=body, timeout=_TIMEOUT
                )
            except httpx.HTTPError as exc:
                letzter = BrevoError(
                    f"Brevo nicht erreichbar: {exc}", retryable=True
                )
                self._warte(versuch, None)
                continue

            if res.status_code < 300:
                try:
                    return res.json() if res.content else {}
                except ValueError:
                    return {}

            fehler = self._fehler_aus(res)
            # Bekannte Adresse ist der Erfolgspfad, nicht ein Fehler (Wurzel 2).
            if res.status_code == 400 and fehler[0] == "duplicate_parameter":
                log.info("brevo_contact_duplicate", pfad=pfad)
                return {}
            if res.status_code not in _RETRY_STATUS:
                raise BrevoError(
                    f"Brevo {res.status_code}: {fehler[1]}",
                    status_code=res.status_code,
                    retryable=False,
                )
            letzter = BrevoError(
                f"Brevo {res.status_code}: {fehler[1]}",
                status_code=res.status_code,
                retryable=True,
            )
            self._warte(versuch, res)

        raise letzter or BrevoError("Brevo-Aufruf fehlgeschlagen.", retryable=True)

    @staticmethod
    def _fehler_aus(res: httpx.Response) -> tuple[str, str]:
        """(code, message) aus dem Brevo-Fehlerbody — beides kann fehlen."""
        try:
            body = res.json()
        except ValueError:
            return "", res.text[:200]
        if not isinstance(body, dict):
            return "", res.text[:200]
        return str(body.get("code") or ""), str(body.get("message") or res.text[:200])

    @staticmethod
    def _warte(versuch: int, res: httpx.Response | None) -> None:
        """Wartezeit vor dem nächsten Versuch.

        Brevo liefert die Sekunden bis zur Freigabe in `x-sib-ratelimit-reset`
        (in JEDER Antwort, nicht nur bei 429). Fehlt der Header, exponentiell
        zurückweichen. Gedeckelt, damit ein Request nicht minutenlang hängt.
        """
        reset = 0.0
        if res is not None:
            roh = res.headers.get("x-sib-ratelimit-reset")
            try:
                reset = float(roh) if roh else 0.0
            except ValueError:
                reset = 0.0
        wartezeit = min(reset + 2**versuch, 10.0)
        time.sleep(wartezeit)
