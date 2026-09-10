"""Text zu Vektor — Vertex AI Embeddings, regional wie der Textclient.

WARUM EIN EIGENES MODUL neben ``client.py``: Die Anmeldung ist dieselbe, alles
andere nicht. Ein Embedding-Aufruf geht an ``:predict`` statt
``:generateContent``, nutzt ein anderes Modell, kennt weder Temperatur noch
Token-Budget noch Abbruchgründe, und sein Fehlerbild ist ein anderes — ein zu
langer Text wird bei Gemini gekappt, hier erzeugt er einen Vektor, der den
Schluss des Textes nicht kennt. Das in ``VertexClient`` zu falten hieße, jede
Methode dort mit „gilt nur für Text" oder „gilt nur für Embeddings" zu
kommentieren.

MODELLWAHL — ``text-multilingual-embedding-002`` (768 Dimensionen).
Live gegen ``europe-west4`` geprüft; alle drei Kandidaten antworten dort:

* ``text-embedding-005`` (768) ist englischzentriert. Unsere Hilfe-Artikel
  liegen in 24 Sprachen vor, und ein dänischer Besucher fragt auf Dänisch
  nach einem deutsch geschriebenen Artikel — genau der Fall, für den das
  mehrsprachige Modell gebaut ist.
* ``gemini-embedding-001`` (3072) ist das stärkste, aber vierfacher Speicher
  und vierfache Rechenzeit im Index für einen Vorteil, den es bei dieser
  Wissensmenge nicht gibt.

**Die Dimension steht in der Datenbank** (``vector(768)``). Ein Modellwechsel
ändert sie und macht alle vorhandenen Vektoren unvergleichbar. Deshalb trägt
jede Zeile ihr Modell mit, und diese Konstante ist die eine Quelle dafür.
"""

from __future__ import annotations

import time

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest

from src.core.config import get_settings
from src.core.ki.client import KiError, _credentials
from src.core.logging import get_logger

log = get_logger("nextdays.ki.einbettung")

#: Modell und Dimension gehören zusammen — wer eines ändert, muss das andere
#: ändern UND eine Migration schreiben, die ``vector(n)`` anpasst und den
#: Bestand neu berechnet. Beide Werte stehen deshalb hier nebeneinander.
EINBETTUNG_MODELL = "text-multilingual-embedding-002"
EINBETTUNG_DIMENSION = 768

#: Grenze des Modells je Eingabe. Längerer Text wird von Vertex still
#: abgeschnitten — der Vektor beschreibt dann einen Text, den niemand so
#: gespeichert hat. Wir schneiden deshalb selbst und sagen es (Wurzel 5).
MAX_EINBETTUNG_ZEICHEN = 8000

#: Wie viele Texte in einem Aufruf. Vertex nimmt bis zu 250 Instanzen; 32 hält
#: die Nutzlast klein genug, dass ein Netzwerkfehler nicht einen ganzen
#: Aufbaulauf zurückwirft.
STAPEL_GROESSE = 32

_TIMEOUT_SEKUNDEN = 60.0
_TOKEN_PUFFER_SEKUNDEN = 300


class EinbettungClient:
    """Erzeugt Vektoren für Suche und Ablage.

    ``aufgabe`` unterscheidet, wofür ein Vektor gedacht ist. Das ist keine
    Kosmetik: Google bettet dieselbe Zeichenkette je nach Aufgabe
    unterschiedlich ein. Ein Wissensstück ist ein ``RETRIEVAL_DOCUMENT``, die
    Frage eines Besuchers ein ``RETRIEVAL_QUERY``. Wer beides als Dokument
    einbettet, verschenkt Trefferqualität, ohne dass es auffällt — die Suche
    liefert weiter Ergebnisse, nur schlechtere.
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
        self._model = model or EINBETTUNG_MODELL
        self._token: str | None = None
        self._token_ablauf: float = 0.0

    @property
    def is_configured(self) -> bool:
        return bool(self._project and self._location and _credentials() is not None)

    @property
    def modell(self) -> str:
        return self._model

    @property
    def _endpunkt(self) -> str:
        # Region im Hostnamen UND im Pfad, dieselbe Begründung wie im
        # Textclient: der globale Endpunkt gibt keine Zusage zum Ort der
        # Verarbeitung.
        return (
            f"https://{self._location}-aiplatform.googleapis.com/v1"
            f"/projects/{self._project}/locations/{self._location}"
            f"/publishers/google/models/{self._model}:predict"
        )

    def _access_token(self) -> str:
        jetzt = time.time()
        if self._token and jetzt < self._token_ablauf:
            return self._token
        creds = _credentials()
        if creds is None:
            raise KiError("Der KI-Assistent ist nicht eingerichtet.", status_code=503)
        creds.refresh(GoogleAuthRequest())
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

    def einbetten(
        self,
        texte: list[str],
        *,
        aufgabe: str = "RETRIEVAL_DOCUMENT",
    ) -> list[list[float]]:
        """Vektoren für mehrere Texte, in der Reihenfolge der Eingabe.

        Wirft ``KiError``, wenn der Dienst nicht antwortet oder weniger
        Vektoren liefert als Texte hineingingen. Eine Teilmenge
        zurückzugeben wäre die schlimmere Variante: der Aufrufer ordnet sie
        seinen Texten nach Index zu und verschiebt damit ALLE Zuordnungen ab
        der Lücke.
        """
        if not texte:
            return []

        gekuerzt = []
        for text in texte:
            sauber = text.strip()
            if len(sauber) > MAX_EINBETTUNG_ZEICHEN:
                log.warning(
                    "einbettung_text_gekuerzt",
                    zeichen=len(sauber),
                    grenze=MAX_EINBETTUNG_ZEICHEN,
                )
                sauber = sauber[:MAX_EINBETTUNG_ZEICHEN]
            gekuerzt.append(sauber)

        vektoren: list[list[float]] = []
        for start in range(0, len(gekuerzt), STAPEL_GROESSE):
            stapel = gekuerzt[start : start + STAPEL_GROESSE]
            vektoren.extend(self._stapel_senden(stapel, aufgabe=aufgabe))
        return vektoren

    def einbetten_eines(
        self,
        text: str,
        *,
        aufgabe: str = "RETRIEVAL_QUERY",
    ) -> list[float]:
        """Ein Vektor für einen Text — der Weg für die Suchanfrage."""
        ergebnis = self.einbetten([text], aufgabe=aufgabe)
        if not ergebnis:
            raise KiError("Der KI-Dienst lieferte keinen Vektor.")
        return ergebnis[0]

    def _stapel_senden(self, texte: list[str], *, aufgabe: str) -> list[list[float]]:
        payload = {
            "instances": [{"task_type": aufgabe, "content": t} for t in texte],
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
                "einbettung_netzwerkfehler",
                modell=self._model,
                region=self._location,
                anzahl=len(texte),
                dauer_ms=int((time.monotonic() - beginn) * 1000),
                grund=type(exc).__name__,
            )
            raise KiError("Der KI-Dienst ist nicht erreichbar.") from exc

        dauer_ms = int((time.monotonic() - beginn) * 1000)
        if resp.status_code >= 400:
            log.error(
                "einbettung_http_fehler",
                modell=self._model,
                region=self._location,
                status=resp.status_code,
                dauer_ms=dauer_ms,
                antwort=resp.text[:500],
            )
            raise KiError(
                "Der KI-Dienst ist gerade ausgelastet. Bitte gleich noch einmal."
                if resp.status_code == 429
                else f"Der KI-Dienst antwortete mit Fehler ({resp.status_code}).",
                status_code=429 if resp.status_code == 429 else 502,
            )

        daten = resp.json()
        vorhersagen = daten.get("predictions") or []
        vektoren: list[list[float]] = []
        for eintrag in vorhersagen:
            werte = (eintrag.get("embeddings") or {}).get("values")
            if not isinstance(werte, list) or not werte:
                continue
            if len(werte) != EINBETTUNG_DIMENSION:
                # Ein Vektor anderer Länge passt nicht in die Spalte und
                # würde beim Einfügen einen rohen DB-Fehler werfen. Hier
                # gefangen heißt: der Fehler steht im Log mit Modellnamen,
                # statt als 500 aus einer INSERT-Zeile zu kommen.
                log.error(
                    "einbettung_falsche_dimension",
                    modell=self._model,
                    erwartet=EINBETTUNG_DIMENSION,
                    erhalten=len(werte),
                )
                raise KiError(
                    "Der KI-Dienst lieferte Vektoren unerwarteter Länge.",
                )
            vektoren.append([float(w) for w in werte])

        if len(vektoren) != len(texte):
            log.error(
                "einbettung_unvollstaendig",
                modell=self._model,
                angefordert=len(texte),
                erhalten=len(vektoren),
            )
            raise KiError("Der KI-Dienst lieferte nicht für jeden Text einen Vektor.")

        log.info(
            "einbettung_ok",
            modell=self._model,
            region=self._location,
            anzahl=len(vektoren),
            dauer_ms=dauer_ms,
        )
        return vektoren
