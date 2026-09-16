"""Push-Versand an die Mobile-Apps (FCM, Migration 0414).

WARUM DAS OFFIZIELLE SDK und kein eigener HTTP-Aufruf: nicht der Versand ist
der schwierige Teil, sondern die ANTWORT. `send_each` liefert je Token eine
typisierte Ausnahme — `UnregisteredError`, `SenderIdMismatchError`,
`QuotaExceededError`, `UnavailableError`. Nur damit laesst sich unterscheiden,
was geloescht werden MUSS (Wurzel 1: Gegenzustand pflegen) von dem, was
wiederholt werden muss, und von dem, was ein Konfigurationsfehler ist
(Wurzel 5: Kontroll-Signal nicht verschlucken). Ein Eigenbau muesste dafuer
JSON-Fehlerstrings parsen.

DER TEUERSTE FEHLER, den dieses Modul vermeidet: `400 INVALID_ARGUMENT` als
„Token kaputt" zu deuten. Firebase meldet damit AUCH eine fehlerhafte Nutzlast
von uns. Wer dabei loescht, raeumt beim ersten eigenen Payload-Bug reihenweise
GUELTIGE Tokens ab und merkt es nie — der Versand meldet weiter Erfolg, nur
ohne Empfaenger. Hier wird deshalb ausschliesslich bei `UnregisteredError` und
`SenderIdMismatchError` geloescht.

WAS HIER NICHT PASSIERT: keine Entscheidung, OB gesendet wird. Die faellt im
Dispatcher ueber die Praeferenz (`soll_senden`) und die Empfaengerermittlung.
Dieses Modul kennt nur „diese Tokens, diese Meldung".

NUTZLAST-DISZIPLIN (Wurzel 3): der Text landet im Sperrbildschirm, sichtbar
ohne Entsperren. Deshalb gehoeren KEINE Gastnamen und KEINE Betraege hinein —
nur das Ereignis und die ID im `data`-Teil. Die Details holt die App nach der
Anmeldung. Das erzwingt hier niemand technisch; es ist die Pflicht des
Aufrufers, und `dispatcher.py` haelt sie ein.
"""
from __future__ import annotations

import base64
import json
import threading
from typing import Any

import firebase_admin
import google.auth
import structlog
from firebase_admin import credentials, exceptions, messaging
from google.auth import exceptions as google_exc

from src.core.config import Settings

log = structlog.get_logger(__name__)

# Name der Firebase-App in diesem Prozess. Explizit benannt, damit ein zweites
# `initialize_app` nicht die Default-App ueberschreibt.
_APP_NAME = "nextdays-push"
# Der Scope, den FCM-Versand braucht. Nur fuer die Vorab-Pruefung der
# Umgebungs-Anmeldung; `firebase_admin` setzt ihn selbst.
_FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_lock = threading.Lock()
# Einelementige Liste statt Modulvariable + `global`: der Zustand bleibt an
# EINER Stelle sichtbar und ist ohne `global`-Anweisung veraenderbar.
_app_zelle: list[firebase_admin.App] = []


class PushFehler(Exception):
    """Versand nicht moeglich (Konfiguration). Der Dispatcher vermerkt es als
    Kanalfehler — nie als „zugestellt"."""


def _aus_dienstkonto_json(rohtext: str) -> firebase_admin.App:
    """Weg 1: Dienstkonto-JSON aus der Umgebung (klassischer Schluessel).

    Nimmt BEIDE Formen: base64-kodiert (empfohlen) oder rohes JSON.

    Warum base64 der empfohlene Weg ist — live passiert am 21.08.2026: das
    Dienstkonto-JSON enthaelt einen PEM-Schluessel mit echten Zeilenumbruechen.
    Als mehrzeilige Umgebungsvariable in Coolify zerbricht das die generierte
    `.env` (`docker compose` bricht ab mit
    `unexpected character '"' in variable name '"type": "service_account",'`)
    — der Container startete nicht mehr, die API war weg. Eine einzeilige
    base64-Zeichenkette kann das nicht ausloesen, egal wie die Plattform die
    Datei schreibt.

    Die Erkennung laeuft ueber den Inhalt, nicht ueber ein zweites Feld: ein
    JSON-Dienstkonto beginnt immer mit `{`, base64 nie. Ein zweiter
    Variablenname waere eine zweite Wahrheit, die stiller veraltet.
    """
    text = rohtext.strip()
    if not text.startswith("{"):
        try:
            text = base64.b64decode(text, validate=True).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise PushFehler(
                "FCM_SERVICE_ACCOUNT_JSON ist weder JSON noch gueltiges base64."
            ) from exc
    try:
        konto: dict[str, Any] = json.loads(text)
    except json.JSONDecodeError as exc:
        # Klar fehlschlagen: ein halb gelesenes Dienstkonto wuerde sonst
        # als „kein Empfaenger" durchgehen (Wurzel 4/5).
        raise PushFehler(
            "FCM_SERVICE_ACCOUNT_JSON ist kein gueltiges JSON."
        ) from exc
    for feld in ("client_email", "private_key", "project_id"):
        if not konto.get(feld):
            raise PushFehler(f"FCM-Dienstkonto ohne '{feld}'.")
    try:
        app = firebase_admin.initialize_app(
            credentials.Certificate(konto), name=_APP_NAME
        )
    except ValueError as exc:
        raise PushFehler(f"FCM-Dienstkonto unbrauchbar: {exc}") from exc
    log.info("push_firebase_initialisiert", weg="dienstkonto_json")
    return app


def _aus_umgebung(projekt: str) -> firebase_admin.App:
    """Weg 2: Application Default Credentials, OHNE Schluesseldatei.

    Der bevorzugte Weg — und in diesem Projekt der einzige moegliche: die
    Organisationsrichtlinie `constraints/iam.disableServiceAccountKeyCreation`
    verbietet das Erzeugen herunterladbarer Dienstkonto-Schluessel (deshalb
    laeuft auch der Mobile-Release-Workflow ueber Workload Identity Federation
    statt ueber einen Key). Kein Geheimnis, das man verlieren, vertauschen oder
    versehentlich einchecken kann.

    Woher die Anmeldung kommt, entscheidet die Umgebung: auf dem Server die
    angehaengte Dienstidentitaet bzw. `GOOGLE_APPLICATION_CREDENTIALS`, lokal
    das `gcloud auth application-default login`. Fehlt beides, faellt das hier
    klar durch — kein stiller Versand ins Nichts.
    """
    try:
        anmeldung, _ = google.auth.default(scopes=[_FCM_SCOPE])
    except google_exc.DefaultCredentialsError as exc:
        raise PushFehler(
            "Keine Google-Anmeldung gefunden (weder FCM_SERVICE_ACCOUNT_JSON "
            "noch Application Default Credentials)."
        ) from exc
    try:
        app = firebase_admin.initialize_app(
            credentials.ApplicationDefault(),
            options={"projectId": projekt},
            name=_APP_NAME,
        )
    except ValueError as exc:
        raise PushFehler(f"Firebase-Initialisierung fehlgeschlagen: {exc}") from exc
    log.info(
        "push_firebase_initialisiert",
        weg="application_default",
        projekt=projekt,
        konto=getattr(anmeldung, "service_account_email", "unbekannt"),
    )
    return app


def _firebase_app(settings: Settings) -> firebase_admin.App:
    """Die initialisierte Firebase-App, einmal je Prozess.

    ZWEI Wege, in dieser Reihenfolge:
      1. `FCM_SERVICE_ACCOUNT_JSON` — ein Dienstkonto-Schluessel als
         Umgebungsvariable. Nie als Datei im Repo: es ist ein privater
         Schluessel.
      2. Application Default Credentials — ohne Schluessel, ueber die
         Identitaet der Umgebung. Das ist der Weg fuer DIESES Projekt, weil
         eine Organisationsrichtlinie Schluessel-Erzeugung verbietet.

    Weg 1 hat Vorrang, damit eine gesetzte Variable immer gewinnt (etwa fuer
    ein zweites Firebase-Projekt); ohne sie greift Weg 2 von selbst.
    """
    if _app_zelle:
        return _app_zelle[0]
    with _lock:
        # Zweite Pruefung im Lock: zwei Anfragen koennen gleichzeitig
        # hereinkommen, und `initialize_app` mit demselben Namen wirft beim
        # zweiten Mal.
        if _app_zelle:
            return _app_zelle[0]
        rohtext = settings.fcm_service_account_json.strip()
        if rohtext:
            app = _aus_dienstkonto_json(rohtext)
        else:
            if not settings.fcm_projekt_id.strip():
                raise PushFehler(
                    "FCM_PROJEKT_ID fehlt (ohne Dienstkonto-JSON noetig)."
                )
            app = _aus_umgebung(settings.fcm_projekt_id.strip())
        _app_zelle.append(app)
        return app


def _nachricht(
    token: str, titel: str, text: str, ziel_pfad: str | None
) -> messaging.Message:
    return messaging.Message(
        # `token`, NICHT `fid`. Die beiden sind NICHT dasselbe Feld, auch wenn
        # der Docstring von firebase-admin „token: Deprecated. Use `fid`
        # instead" nahelegt: `_messaging_encoder.py` serialisiert sie als zwei
        # getrennte JSON-Felder und zaehlt sie als konkurrierende Ziel-Typen
        # ('fid', 'token', 'topic', 'condition' — genau EINES ist erlaubt).
        # `fid` erwartet eine Firebase-INSTALLATION-ID; die Apps melden aber
        # das Registrierungs-Token aus `getToken()` (mobile-*/lib/push.ts).
        # Ein Registrierungs-Token unter `fid` quittiert FCM mit
        # INVALID_ARGUMENT — und das wird unten bewusst nicht als Token-Fehler
        # gewertet, war also still. Seit dem ersten Push-Commit (21.08.2026)
        # ist auf diesem Weg KEINE einzige Benachrichtigung angekommen;
        # gemeldet wurde es am 15.09.2026 vom Nutzer, nicht vom System.
        #
        # Die DeprecationWarning beim Bauen der Nachricht ist ECHT und bleibt:
        # Google loest das Registrierungs-Token langfristig durch die FID ab
        # (Admin SDK 7.5.0, Juli 2026). Der Wechsel geht aber nur GEMEINSAM —
        # erst melden die Apps eine FID (`getId()` aus Firebase Installations
        # statt `getToken()`), dann darf hier `fid=` stehen. Wer nur diese
        # Zeile dreht, baut den stillen Ausfall wieder ein; die Tests in
        # tests/test_push_nutzlast.py halten das fest.
        token=token,
        notification=messaging.Notification(title=titel, body=text),
        # Das Sprungziel als Datenfeld: der Tap oeffnet damit direkt die
        # Buchung bzw. den Thread statt der Startseite. Werte muessen
        # Zeichenketten sein — FCM erlaubt in `data` nichts anderes.
        data={"ziel": ziel_pfad or ""},
        android=messaging.AndroidConfig(
            # `high` weckt das Geraet auch im Doze-Modus. Fuer „neue Buchung"
            # ist das der Zweck; bei `normal` kaeme sie erst beim naechsten
            # Aufwachfenster, unter Umstaenden Stunden spaeter.
            priority="high",
            notification=messaging.AndroidNotification(
                # Der Kanal MUSS in der App existieren (ab Android 8 Pflicht),
                # sonst zeigt Android die Meldung gar nicht an. Angelegt wird er
                # dort ueber `firebase.json`.
                channel_id="nextdays_wichtig",
                default_sound=True,
            ),
        ),
    )


def senden(
    settings: Settings,
    *,
    tokens: list[str],
    titel: str,
    text: str,
    ziel_pfad: str | None = None,
) -> tuple[list[str], list[str]]:
    """Eine Meldung an mehrere Geraete → (zugestellt, zu_loeschen).

    `zu_loeschen` sind NUR Tokens, die Firebase als endgueltig ungueltig
    ausweist (App deinstalliert, Token ersetzt, fremdes Projekt). Alles andere
    bleibt stehen: ein Ratelimit oder ein Ausfall bei Google macht ein Geraet
    nicht ungueltig.

    In der Sandbox (lokal) wird NICHT gesendet, sondern protokolliert. Alle
    Tokens gelten dann als zugestellt: „fehlgeschlagen" waere die falsche
    Auskunft ueber einen Versand, der absichtlich nicht stattfand.
    """
    if not tokens:
        return [], []
    if settings.push_sandbox:
        log.info(
            "push_sandbox",
            empfaenger=len(tokens),
            titel=titel[:80],
            ziel=ziel_pfad,
        )
        return list(tokens), []

    app = _firebase_app(settings)
    nachrichten = [_nachricht(t, titel, text, ziel_pfad) for t in tokens]
    # `send_each` schickt intern Einzel-Requests (der `/batch`-Sammelendpunkt
    # ist seit 21.06.2024 abgeschaltet) und gibt die Antworten in der
    # REIHENFOLGE der Eingabe zurueck — daran haengt die Zuordnung unten.
    antwort = messaging.send_each(nachrichten, app=app)

    zugestellt: list[str] = []
    zu_loeschen: list[str] = []
    for token, ergebnis in zip(tokens, antwort.responses, strict=True):
        if ergebnis.success:
            zugestellt.append(token)
            continue
        fehler = ergebnis.exception
        if isinstance(fehler, messaging.UnregisteredError):
            # App deinstalliert oder Token ersetzt — kommt nie wieder.
            zu_loeschen.append(token)
            log.info("push_token_abgemeldet")
        elif isinstance(fehler, messaging.SenderIdMismatchError):
            # Token gehoert zu einem fremden Firebase-Projekt (Altbestand nach
            # Projektwechsel). Ebenfalls dauerhaft unbrauchbar.
            zu_loeschen.append(token)
            log.warning("push_token_fremdes_projekt")
        elif isinstance(fehler, messaging.QuotaExceededError):
            # Ratelimit. Token BEHALTEN, der naechste Versand geht wieder.
            log.warning("push_quota_erschoepft")
        elif isinstance(fehler, messaging.ThirdPartyAuthError):
            # APNs-Schluessel in der Firebase-Konsole falsch/abgelaufen. Das ist
            # ein Konfigurationsfehler, kein Token-Problem — laut melden, sonst
            # sucht niemand an der richtigen Stelle.
            log.error("push_apns_konfiguration_fehlerhaft", fehler=str(fehler)[:200])
        elif isinstance(fehler, exceptions.UnavailableError):
            # FCM gerade nicht erreichbar. Token behalten.
            log.warning("push_fcm_nicht_erreichbar")
        else:
            # Alles Uebrige — insbesondere INVALID_ARGUMENT (400). NICHT
            # loeschen: das ist oft ein Fehler in UNSERER Nutzlast. Laut
            # protokollieren und stehen lassen (siehe Modul-Kopf).
            log.error(
                "push_abgelehnt",
                typ=type(fehler).__name__,
                fehler=str(fehler)[:300],
            )
    return zugestellt, zu_loeschen
