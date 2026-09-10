"""Anbindung an Google Vertex AI (Gemini) — der KI-Anbieter des Systems.

Bis 29.08.2026 stand dieses Modul unter ``features/site_config`` und sein
Docstring begründete, warum es den Groq-Client des Posteingangs NICHT
ersetzt: der Baukasten schreibe auf eine öffentliche Website, der
Posteingang nur an einen Gast. Diese Begründung hat nicht gehalten — sie
unterschätzte, was in einer Gastnachricht steht.

Der Prompt einer Gastantwort enthält **Türcode, WLAN-Passwort, Anschrift,
Name des Gastes und seine Aufenthaltszeiten**. Das ist personenbezogener
als jeder Objekttext des Baukastens. Groq betreibt seine Inferenz in den
USA; für Vertex AI sagt Google beim REGIONALEN Endpunkt zu, dass die
Verarbeitung in der Jurisdiktion der Region bleibt. Damit gehört der
Posteingang hierher, und das Modul gehört an einen gemeinsamen Ort —
darum ``core/ki`` und nicht mehr ein Slice.

Der zweite Grund bleibt unverändert:

* **Herkunftskennzeichnung (EU AI Act Art. 50 Abs. 2).** Wir sind Anbieter
  des KI-Systems, nicht bloß Nutzer einer API. Was erzeugt wurde, muss
  maschinenlesbar als erzeugt erkennbar sein. Das leistet unser eigenes
  Feld ``content_origin`` (siehe ``site_config/ki_herkunft.py``) — NICHT
  ein Wasserzeichen des Anbieters. SynthID ist für BILDER belegt; ob
  Vertex AI Text wasserzeichnet, ist widersprüchlich dokumentiert und ein
  öffentliches Prüfwerkzeug dafür gibt es nicht. Auf etwas, das man nicht
  nachprüfen kann, lässt sich keine Rechtspflicht stützen.

Groq (``features/inbox/ai.py``) bleibt vorerst für Preiserklärung und
Dashboard-Chat: beide sehen keine Gastdaten, beide sind interne
Auskünfte an den Betrieb. Kein Big-Bang.

**Fehlt die Konfiguration, wirft dieses Modul nicht — es meldet
``is_configured is False``.** Der Aufrufer blendet die KI-Funktionen dann
gar nicht erst ein, statt einen Knopf zu zeigen, der 503 antwortet.
"""

from __future__ import annotations

import base64
import binascii
import json
import time
from dataclasses import dataclass
from functools import lru_cache

import httpx
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from src.core.config import get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.ki")

# Der einzige OAuth-Scope, den ein Vertex-Aufruf braucht. Er ist breit
# formuliert (Google bietet für aiplatform keinen engeren an) — die eigentliche
# Einschränkung sitzt deshalb an der IAM-Rolle des Service-Accounts:
# `roles/aiplatform.user`, sonst nichts. Ein Schlüssel mit dieser einen Rolle
# kann Modelle aufrufen und nichts anlegen, nichts lesen, nichts löschen.
_SCOPES = ("https://www.googleapis.com/auth/cloud-platform",)

# Zugriffstoken laufen bei Google nach 3600 s ab. 300 s Sicherheitsabstand,
# damit ein Token nicht mitten im Flug abläuft (der Aufruf selbst dauert
# Sekunden, nicht Minuten).
_TOKEN_PUFFER_SEKUNDEN = 300

# Harte Obergrenzen für einen einzelnen Aufruf (Wurzel 8: kein unbegrenzter
# Bereich). Der Kontext ist das, was WIR aus den Stammdaten bauen — er kann
# nicht vom Client kommen, aber ein Betrieb mit 300 Objekten und langen
# Beschreibungen könnte ihn ungewollt aufblähen.
MAX_PROMPT_ZEICHEN = 24_000
# 2048 war zu niedrig und hat still gekappt: der Inventar-Import bat um 8000,
# bekam 2048, das Modell brach mitten im JSON ab (`abschlussgrund=MAX_TOKENS`)
# und der Aufrufer bekam einen 502 „Liste nicht lesbar" — ohne Hinweis, dass
# nicht die Antwort kaputt, sondern das Budget zu klein war (10.09.2026, live).
# Gemini 2.5 Flash kann 65.536 Ausgabe-Tokens; 16.384 bleibt ein echter Deckel
# (Wurzel 8) und traegt eine Inventarliste ueber mehrere Seiten.
MAX_ANTWORT_TOKENS = 16_384

# Timeout je Aufruf. Gemini 2.5 Flash antwortet auf die Textlängen dieses
# Baukastens in wenigen Sekunden; 45 s sind großzügig und trotzdem ein Deckel.
# Ohne Deckel hält ein hängender Fremdaufruf einen Uvicorn-Worker fest.
_TIMEOUT_SEKUNDEN = 45.0


class KiError(Exception):
    """Ein KI-Aufruf ist fehlgeschlagen — mit einem Grund, den die UI zeigen darf.

    ``status_code`` wird 1:1 zum HTTP-Status des Endpunkts. 503 heißt „nicht
    konfiguriert", 502 „der Dienst hat nicht geliefert“, 429 „Deckel erreicht“,
    422 „die Anfrage passt nicht“. Kein Fall gibt einen erfundenen Text zurück.
    """

    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class KiAntwort:
    """Was ein Aufruf geliefert hat — Text UND alles, was ihn nachvollziehbar macht.

    Die Zahlen sind nicht Zierde: sie landen in ``site_ai_usage`` (0465) und
    sind damit die Grundlage, auf der ein späteres Guthabensystem rechnen kann.
    Wer sie erst später einführt, hat für die Vergangenheit nichts.
    """

    text: str
    modell: str
    region: str
    dauer_ms: int
    tokens_ein: int
    tokens_aus: int
    # Warum das Modell aufgehört hat („STOP“, „MAX_TOKENS“, „SAFETY“, …).
    # Steht im Log und wird bei MAX_TOKENS zu einer sichtbaren Warnung: ein
    # mitten im Satz abgeschnittener Text, der wie ein fertiger aussieht, ist
    # schlimmer als eine Fehlermeldung.
    abschlussgrund: str


@lru_cache(maxsize=1)
def _credentials() -> service_account.Credentials | None:
    """Service-Account-Anmeldedaten aus der Umgebung — oder ``None``.

    Der Schlüssel steht als EINZEILIGES Base64 in ``VERTEX_SERVICE_ACCOUNT_B64``.
    Einzeilig, weil eine mehrzeilige Variable in Coolify den Deploy zerbricht
    (siehe Memory „coolify-env-mehrzeilig-zerbricht-deploy“), und ein
    JSON-Service-Account-Schlüssel enthält zwangsläufig einen mehrzeiligen
    privaten Schlüssel.

    Ist die Variable leer, gibt es hier ``None`` und keine Ausnahme — die
    Funktion soll GAR NICHT ERSCHEINEN statt abzustürzen. Ist sie gesetzt, aber
    unbrauchbar, ist das eine Fehlkonfiguration und wird LAUT geloggt: ein
    stummes ``None`` würde wie „nicht gebucht“ aussehen, obwohl jemand den
    Schlüssel hinterlegt hat (Wurzel 5).
    """
    roh = get_settings().vertex_service_account_b64.get_secret_value().strip()
    if not roh:
        return None
    try:
        info = json.loads(base64.b64decode(roh, validate=True).decode("utf-8"))
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError) as exc:
        log.error("vertex_schluessel_unlesbar", grund=type(exc).__name__)
        return None
    try:
        return service_account.Credentials.from_service_account_info(
            info, scopes=list(_SCOPES)
        )
    except (ValueError, KeyError) as exc:
        # from_service_account_info wirft ValueError bei fehlenden Feldern
        # (private_key, client_email) und KeyError bei kaputtem JSON-Aufbau.
        log.error("vertex_schluessel_unvollstaendig", grund=str(exc)[:200])
        return None


class VertexClient:
    """Ein Aufruf an ein Gemini-Modell über den REGIONALEN Vertex-Endpunkt.

    Regional und nicht global — das ist der ganze Punkt der Anbindung. Der
    globale Endpunkt (``aiplatform.googleapis.com`` ohne Regionspräfix) hat
    laut Googles eigener Datenresidenz-Seite ausdrücklich KEINE Zusage zum Ort
    der Verarbeitung. Die Region steht deshalb im Hostnamen UND im Pfad; beide
    kommen aus derselben Einstellung, damit sie nicht auseinanderlaufen können.
    """

    def __init__(
        self,
        *,
        project_id: str | None = None,
        location: str | None = None,
        model: str | None = None,
    ) -> None:
        s = get_settings()
        self._project = project_id or s.vertex_project_id
        self._location = location or s.vertex_location
        self._model = model or s.vertex_model
        self._token: str | None = None
        self._token_ablauf: float = 0.0

    @property
    def is_configured(self) -> bool:
        """Alle drei Teile da? Schlüssel, Projekt, Region.

        Fehlt einer, ist die Funktion nicht verfügbar — und zwar sichtbar als
        „nicht eingerichtet“, nicht als Fehler beim ersten Klick.
        """
        return bool(self._project and self._location and _credentials() is not None)

    @property
    def modell(self) -> str:
        return self._model

    @property
    def region(self) -> str:
        return self._location

    @property
    def _endpunkt(self) -> str:
        return (
            f"https://{self._location}-aiplatform.googleapis.com/v1"
            f"/projects/{self._project}/locations/{self._location}"
            f"/publishers/google/models/{self._model}:generateContent"
        )

    def _access_token(self) -> str:
        """Gültiges OAuth-Zugriffstoken, gecacht bis kurz vor Ablauf."""
        jetzt = time.time()
        if self._token and jetzt < self._token_ablauf:
            return self._token
        creds = _credentials()
        if creds is None:
            raise KiError(
                "Der KI-Assistent ist nicht eingerichtet.", status_code=503
            )
        try:
            creds.refresh(GoogleAuthRequest())
        except GoogleAuthError as exc:
            # Spezifisch gefangen (Wurzel 5): ein abgelaufener oder entzogener
            # Schlüssel ist eine Betriebssache und muss im Log als solche
            # stehen — nicht als „KI-Dienst nicht erreichbar“.
            log.error("vertex_token_fehler", grund=str(exc)[:300])
            raise KiError(
                "Die Anmeldung beim KI-Dienst wurde abgelehnt.", status_code=502
            ) from exc
        if not creds.token:
            raise KiError("Der KI-Dienst lieferte kein Zugriffstoken.")
        self._token = creds.token
        ablauf = getattr(creds, "expiry", None)
        self._token_ablauf = (
            ablauf.timestamp() - _TOKEN_PUFFER_SEKUNDEN
            if ablauf is not None
            else jetzt + 1800
        )
        return creds.token

    def erzeuge(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.3,
        max_tokens: int = 800,
    ) -> KiAntwort:
        """Einen Text erzeugen lassen. Kein Fallback, keine erfundene Antwort.

        ``system`` ist die Rolle und die Regeln (u. a. „erfinde keine Fakten“),
        ``user`` der konkrete Auftrag samt Kontext. Beide zusammen sind auf
        :data:`MAX_PROMPT_ZEICHEN` gedeckelt — ein Betrieb mit sehr vielen
        Objekten soll nicht versehentlich ein Megabyte an Google schicken.
        """
        if not self.is_configured:
            raise KiError(
                "Der KI-Assistent ist nicht eingerichtet.", status_code=503
            )
        laenge = len(system) + len(user)
        if laenge > MAX_PROMPT_ZEICHEN:
            # LAUT abweisen statt still abzuschneiden: ein gekürzter Kontext
            # erzeugt einen Text über eine Unterkunft, deren halbe Ausstattung
            # der Prompt nicht mehr enthielt — und niemand sieht es dem
            # Ergebnis an (Wurzel 5).
            raise KiError(
                f"Der Kontext ist zu groß ({laenge} Zeichen, erlaubt sind "
                f"{MAX_PROMPT_ZEICHEN}).",
                status_code=422,
            )
        return self._senden(
            system=system,
            teile=[{"text": user}],
            temperature=temperature,
            max_tokens=max_tokens,
        )

    def erzeuge_multimodal(
        self,
        *,
        system: str,
        teile: list[dict],
        temperature: float = 0.2,
        max_tokens: int = 200,
        abbruch_ist_fehler: bool = False,
    ) -> KiAntwort:
        """Wie :meth:`erzeuge`, aber mit gemischten Teilen (Bild + Text).

        Gebraucht für den Alt-Text: Vertex nimmt ein Bild als ``inlineData``
        (base64) oder als ``gs://``-Adresse, aber NICHT als https-Adresse, die
        es selbst abrufen würde. Der Aufrufer (``ki_bild.py``) baut die Teile
        und trägt die Verantwortung für den sicheren Download.

        Der Zeichen-Deckel aus :meth:`erzeuge` greift hier nicht — ein
        base64-Bild ist immer über 24 000 Zeichen. Die Grenze sitzt statt
        dessen dort, wo sie hingehört: ``ki_bild.MAX_BILD_BYTES`` deckelt die
        Bytes beim Herunterladen, also BEVOR sie im Speicher liegen.
        """
        if not self.is_configured:
            raise KiError(
                "Der KI-Assistent ist nicht eingerichtet.", status_code=503
            )
        return self._senden(
            system=system,
            teile=teile,
            temperature=temperature,
            max_tokens=max_tokens,
            abbruch_ist_fehler=abbruch_ist_fehler,
        )

    def _senden(
        self,
        *,
        system: str,
        teile: list[dict],
        temperature: float,
        max_tokens: int,
        abbruch_ist_fehler: bool = False,
    ) -> KiAntwort:
        """Der eine Weg nach draußen. Beide öffentlichen Methoden laufen hier
        zusammen, damit Logging, Fehlerbehandlung und Auswertung nicht zweimal
        existieren und auseinanderlaufen können."""
        tokens = max(1, min(int(max_tokens), MAX_ANTWORT_TOKENS))
        if int(max_tokens) > MAX_ANTWORT_TOKENS:
            # Stilles Kappen ist die schlimmere Variante: der Aufrufer denkt,
            # er habe sein Budget, und bekommt eine abgeschnittene Antwort,
            # die wie eine kaputte aussieht. Genau so entstand der 502 vom
            # 10.09.2026.
            log.warning(
                "vertex_budget_gekappt",
                angefordert=int(max_tokens),
                gewaehrt=tokens,
            )
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": teile}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": tokens,
                # Gemini 2.5 ist ein Reasoning-Modell: ohne Deckel fürs Denken
                # verbraucht es bei kurzen Aufgaben („kürze diesen Absatz“) das
                # ganze Ausgabebudget im Denkschritt und liefert leeren Text.
                # Dieselbe Falle wie bei den gpt-oss-Modellen im Posteingang,
                # nur mit anderem Parameternamen.
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        token = self._access_token()
        beginn = time.monotonic()
        try:
            with httpx.Client(timeout=_TIMEOUT_SEKUNDEN) as client:
                resp = client.post(
                    self._endpunkt,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json; charset=utf-8",
                    },
                    json=payload,
                )
        except httpx.HTTPError as exc:
            log.error(
                "vertex_netzwerkfehler",
                modell=self._model,
                region=self._location,
                dauer_ms=int((time.monotonic() - beginn) * 1000),
                grund=type(exc).__name__,
                fehler=str(exc)[:300],
            )
            raise KiError("Der KI-Dienst ist nicht erreichbar.") from exc

        dauer_ms = int((time.monotonic() - beginn) * 1000)
        if resp.status_code >= 400:
            log.error(
                "vertex_http_fehler",
                modell=self._model,
                region=self._location,
                dauer_ms=dauer_ms,
                status=resp.status_code,
                antwort=resp.text[:500],
            )
            # 429 vom Anbieter bleibt 429 bei uns: „gerade zu viel“ ist eine
            # andere Auskunft als „kaputt“, und die UI darf zum Wiederholen
            # raten. Alles andere wird 502 — der Fremdfehler ist nicht der
            # Fehler des Aufrufers.
            raise KiError(
                "Der KI-Dienst ist gerade ausgelastet. Bitte gleich noch einmal."
                if resp.status_code == 429
                else f"Der KI-Dienst antwortete mit Fehler ({resp.status_code}).",
                status_code=429 if resp.status_code == 429 else 502,
            )
        return self._auswerten(
            resp.json(),
            dauer_ms=dauer_ms,
            grenze=tokens,
            abbruch_ist_fehler=abbruch_ist_fehler,
        )

    def _auswerten(
        self,
        daten: dict,
        *,
        dauer_ms: int,
        grenze: int = 0,
        abbruch_ist_fehler: bool = False,
    ) -> KiAntwort:
        """Antwort-JSON → :class:`KiAntwort`. Leer bleibt leer, nichts erfunden."""
        kandidaten = daten.get("candidates") or []
        nutzung = daten.get("usageMetadata") or {}
        tokens_ein = int(nutzung.get("promptTokenCount") or 0)
        tokens_aus = int(nutzung.get("candidatesTokenCount") or 0)
        if not kandidaten:
            # Kein Kandidat heißt in aller Regel: der Prompt wurde vom
            # Sicherheitsfilter blockiert. Der Grund steht in promptFeedback.
            grund = (daten.get("promptFeedback") or {}).get("blockReason") or "unbekannt"
            log.error(
                "vertex_keine_antwort",
                modell=self._model,
                region=self._location,
                dauer_ms=dauer_ms,
                grund=grund,
            )
            raise KiError(
                "Der KI-Dienst hat keinen Text geliefert "
                f"(Grund laut Anbieter: {grund})."
            )
        kandidat = kandidaten[0]
        abschluss = str(kandidat.get("finishReason") or "")
        teile = ((kandidat.get("content") or {}).get("parts")) or []
        text = "".join(str(t.get("text") or "") for t in teile).strip()
        log.info(
            "vertex_aufruf",
            modell=self._model,
            region=self._location,
            dauer_ms=dauer_ms,
            tokens_ein=tokens_ein,
            tokens_aus=tokens_aus,
            abschlussgrund=abschluss,
            zeichen=len(text),
        )
        if not text:
            raise KiError(
                "Der KI-Dienst lieferte eine leere Antwort "
                f"(Abschlussgrund: {abschluss or 'unbekannt'})."
            )
        if abschluss == "MAX_TOKENS" and abbruch_ist_fehler:
            # EIGENER Fehler statt einer stillen Rueckgabe. Ein mitten im Satz
            # abgeschnittener Text sieht aus wie ein fertiger, und der
            # Aufrufer verarbeitet ihn arglos weiter: beim Inventar-Import
            # scheiterte danach `json.loads` und meldete „Die Liste konnte
            # nicht gelesen werden" — eine Falschaussage, denn die Liste war
            # in Ordnung, nur unser Budget war zu klein (10.09.2026, live).
            # Die Meldung nennt die ZAHLEN, sonst ist sie so blind wie vorher.
            log.error(
                "vertex_abgeschnitten",
                modell=self._model,
                tokens_aus=tokens_aus,
                grenze=grenze,
                zeichen=len(text),
            )
            raise KiError(
                "Die Antwort wurde abgeschnitten: das Modell hat die Grenze "
                f"von {grenze} Tokens erreicht ({tokens_aus} erzeugt). "
                "Für dieses Dokument reicht das Budget nicht.",
                status_code=422,
            )
        return KiAntwort(
            text=text,
            modell=self._model,
            region=self._location,
            dauer_ms=dauer_ms,
            tokens_ein=tokens_ein,
            tokens_aus=tokens_aus,
            abschlussgrund=abschluss,
        )
