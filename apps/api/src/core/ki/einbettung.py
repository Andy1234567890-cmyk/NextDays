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

#: Wie viele Texte HÖCHSTENS in einem Aufruf. Vertex nimmt bis zu 250
#: Instanzen; 32 hält die Nutzlast klein genug, dass ein Netzwerkfehler nicht
#: einen ganzen Aufbaulauf zurückwirft.
STAPEL_GROESSE = 32

#: Token-Obergrenze je AUFRUF (nicht je Text). Das Modell weist einen Stapel
#: komplett ab, sobald die Summe darüber liegt:
#:
#:   "input token count is 22903 but the model supports up to 20000"
#:
#: Genau das passierte am 11.09.2026, als die Funktionsseiten von ~680 auf
#: ~2000 Zeichen wuchsen: 32 Texte blieben 32 Texte, aber ihre Token-Summe
#: sprengte die Grenze. Eine feste Stückzahl kann das nicht treffen — 32 kurze
#: Texte liegen weit darunter, 32 lange weit darüber.
MAX_TOKEN_JE_AUFRUF = 20000

#: Zeichen je Token, konservativ geschätzt. Gemessen am Fehlerfall lag das
#: Verhältnis bei etwa 2,33; mit 2,0 gerechnet wird der Stapel eher zu klein
#: als zu groß. Ein zu kleiner Stapel kostet einen Aufruf mehr, ein zu großer
#: wirft den ganzen Lauf ab — die Asymmetrie bestimmt die Richtung des
#: Schätzfehlers.
#:
#: Warum nicht die CountTokens-API: sie wäre ein zusätzlicher Netzaufruf je
#: Stapel, um einen Wert zu bestimmen, den wir mit Sicherheitsabstand ohnehin
#: unterschreiten. Die Schätzung ist hier die billigere richtige Antwort.
_ZEICHEN_JE_TOKEN = 2.0

#: Wieviel Zeichen ein Stapel damit tragen darf.
MAX_ZEICHEN_JE_AUFRUF = int(MAX_TOKEN_JE_AUFRUF * _ZEICHEN_JE_TOKEN * 0.9)

_TIMEOUT_SEKUNDEN = 60.0
_TOKEN_PUFFER_SEKUNDEN = 300


def _stapeln(texte: list[str]) -> list[list[str]]:
    """Texte zu Aufrufen bündeln — nach Stückzahl UND Zeichensumme.

    Beide Grenzen gelten: `STAPEL_GROESSE` hält die Nutzlast klein, damit ein
    Netzwerkfehler nicht viel Arbeit vernichtet, `MAX_ZEICHEN_JE_AUFRUF` hält
    den Stapel unter der Token-Grenze des Modells.

    Ein einzelner Text, der die Zeichengrenze allein überschreitet, bekommt
    seinen eigenen Aufruf. Er ist durch `MAX_EINBETTUNG_ZEICHEN` (8000) ohnehin
    gedeckelt und liegt damit klar unter der Aufrufgrenze — der Fall ist
    abgedeckt, nicht bloß angenommen.
    """
    stapel: list[list[str]] = []
    laufend: list[str] = []
    zeichen = 0

    for text in texte:
        passt_nicht = laufend and (
            len(laufend) >= STAPEL_GROESSE
            or zeichen + len(text) > MAX_ZEICHEN_JE_AUFRUF
        )
        if passt_nicht:
            stapel.append(laufend)
            laufend = []
            zeichen = 0
        laufend.append(text)
        zeichen += len(text)

    if laufend:
        stapel.append(laufend)
    return stapel


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
        for stapel in _stapeln(gekuerzt):
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
