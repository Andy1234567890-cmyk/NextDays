"""Schemas für den öffentlichen Löschantrag (Play-Store-Pflicht)."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, SecretStr

# Freitext-Obergrenze. Ein unbegrenztes Feld aus einer öffentlichen Quelle ist
# eine Einladung (Wurzel 8); 2000 Zeichen reichen für jede echte Begründung.
GRUND_MAX = 2000


class LoeschantragRequest(BaseModel):
    """Was das öffentliche Formular schickt.

    Die Partei wird NICHT übernommen und der Status auch nicht — beides setzt
    der Server. Ein Feld, das der Client füllen darf, ist ein Feld, das ein
    Angreifer füllt (Wurzel 3).
    """

    email: EmailStr
    # Optionale Begründung des Antragstellers.
    grund: str | None = Field(default=None, max_length=GRUND_MAX)
    # Sprache für die Bestätigungsmail (BCP-47-Kürzel wie 'de', 'da').
    locale: str | None = Field(default=None, max_length=10)


class LoeschantragResponse(BaseModel):
    """Immer dieselbe Antwort — siehe service.NEUTRAL."""

    detail: str


class BestaetigungResponse(BaseModel):
    """Ergebnis des Klicks auf den Mail-Link."""

    detail: str
    # True nur, wenn dieser Aufruf den Antrag wirklich bestätigt hat. Bei einem
    # zweiten Klick auf denselben Link steht hier False, ohne Fehler — der
    # Antrag liegt dann ja schon vor (Wurzel 2).
    bestaetigt: bool


# --- In-App-Löschung (angemeldet, Apple 5.1.1(v)) ---------------------------


class InAppLoeschRequest(BaseModel):
    """Was die App beim Löschen schickt.

    Das Passwort ist Pflicht: ein gekapertes Token allein darf kein Konto
    vernichten (Wurzel 7). Es ist ein `SecretStr`, damit es nicht in Logs oder
    Fehlermeldungen auftaucht.
    """

    current_password: SecretStr
    grund: str | None = Field(default=None, max_length=GRUND_MAX)


class LoeschStatusResponse(BaseModel):
    """Ob für dieses Konto ein Löschantrag offen ist."""

    antrag_offen: bool
    # Wann er gestellt wurde (ISO). None, wenn keiner offen ist.
    beantragt_am: str | None = None
    # Was trotz Löschung aufbewahrt wird. None, solange kein Antrag läuft —
    # der Hinweis gehört an die Handlung, nicht in jede Antwort.
    hinweis: str | None = None


class InAppLoeschResponse(BaseModel):
    """Ergebnis der Löschung bzw. des Antrags.

    `geloescht` unterscheidet die zwei Fälle ehrlich: true = der Zugang ist weg
    (Mitarbeiter, Eigentümer, Co-Admin), false = es liegt ein Antrag vor, weil am
    Konto der ganze Betrieb hängt. Ein einheitliches „erledigt" wäre für den
    zweiten Fall eine Falschaussage (Wurzel 4).
    """

    geloescht: bool
    antrag_offen: bool
    beantragt_am: str | None = None
    detail: str
    hinweis: str | None = None
