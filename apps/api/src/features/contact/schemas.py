"""Schemas des Kontaktformulars (öffentlich, Marketing-Seite).

Was hier NICHT steht, ist der eigentliche Punkt: eine Zieladresse. Das Formular
schickt ausschließlich ein Thema-Kürzel; welches Postfach dazu gehört, entscheidet
der Server (`themen.py`). Ein Feld „an wen" wäre ein offener Mail-Relay — jeder
könnte über unseren DKIM-signierten Server an jede Adresse schreiben (Wurzel 3).
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, field_validator

# Harte Obergrenzen für jedes Freitextfeld (Wurzel 8). Sie stehen hier und im
# Formular (`maxLength`) — der Server ist die Wahrheit, das Formular die Höflichkeit.
NAME_MAX = 120
FIRMA_MAX = 160
TELEFON_MAX = 40
NACHRICHT_MAX = 5000
# Kürzer als NACHRICHT_MAX: wer drei Wörter schreibt, will nichts von uns. Die
# Untergrenze hält die häufigste Bot-Einsendung („test", „hi") heraus, ohne einen
# echten Menschen zu behindern.
NACHRICHT_MIN = 20


class KontaktThema(StrEnum):
    """Die auswählbaren Anliegen.

    Ein Enum und keine Freitextangabe: die Zuordnung zum Postfach hängt daran,
    und ein unbekannter Wert muss 422 ergeben statt in einem Default zu landen
    (Wurzel 4). Neues Thema → hier UND in `themen.EMPFAENGERART` eintragen; der
    Test `test_jedes_thema_hat_einen_empfaenger` bricht sonst.
    """

    ALLGEMEIN = "allgemein"
    VERTRIEB = "vertrieb"
    ABRECHNUNG = "abrechnung"
    PRESSE = "presse"
    PARTNER = "partner"
    DATENSCHUTZ = "datenschutz"
    TECHNIK = "technik"
    API = "api"
    SICHERHEIT = "sicherheit"


class KontaktAnfrage(BaseModel):
    """Was das Formular schickt."""

    name: str = Field(min_length=2, max_length=NAME_MAX)
    email: EmailStr
    firma: str | None = Field(default=None, max_length=FIRMA_MAX)
    telefon: str | None = Field(default=None, max_length=TELEFON_MAX)
    thema: KontaktThema
    nachricht: str = Field(min_length=NACHRICHT_MIN, max_length=NACHRICHT_MAX)
    # Sprache, in der der Besucher die Seite gelesen hat (BCP-47-Kürzel). Steht
    # in der internen Mail, damit die Antwort in derselben Sprache verfasst wird.
    locale: str | None = Field(default=None, max_length=10)
    # reCAPTCHA-Enterprise-Token aus `grecaptcha.enterprise.execute`. Optional im
    # Schema, weil der Server über den Sandbox-Riegel entscheidet, ob er nötig
    # ist — NICHT, weil man ihn weglassen darf. Ohne Sandbox ist ein fehlendes
    # Token ein 403.
    captcha_token: str | None = Field(default=None, max_length=4000)
    # Honigtopf: im Formular ein unsichtbares Feld, das kein Mensch sieht und
    # jeder simple Bot ausfüllt. Ist es gefüllt, antworten wir freundlich und
    # senden nichts. Kein Ersatz für das Captcha, sondern die billige erste
    # Stufe — sie kostet keinen Google-Aufruf.
    website: str | None = Field(default=None, max_length=200)
    # Wie lange das Formular offen war, in Sekunden — gemessen im Browser vom
    # ersten Anfassen bis zum Absenden. Ein Skript füllt in Millisekunden, ein
    # Mensch braucht Sekunden (`spamnetz.MIN_SEKUNDEN`).
    #
    # Optional, und das ist Absicht: ein Besucher mit einer alten Fassung der
    # Seite im Cache schickt das Feld nicht mit, und der soll nicht abgewiesen
    # werden. Fehlt es, greifen Captcha und die übrigen Prüfungen weiter — es
    # wird KEINE Dauer erfunden (Wurzel 4).
    #
    # Der Wert ist angreiferkontrolliert: ein Bot kann jede Zahl behaupten.
    # Deshalb prüft `spamnetz` auch eine Obergrenze, und `ge=0` hält negative
    # Werte heraus, bevor sie in einen Vergleich geraten.
    dauer_sekunden: float | None = Field(default=None, ge=0, le=10**7)

    @field_validator("name", "nachricht")
    @classmethod
    def _nicht_nur_leerraum(cls, wert: str) -> str:
        """200 Leerzeichen sind keine Nachricht.

        Ohne diese Prüfung erfüllt `"   " * 10` die `min_length` und erzeugt eine
        leere Mail in unserem Postfach.
        """
        gekuerzt = wert.strip()
        if not gekuerzt:
            raise ValueError("Feld darf nicht leer sein.")
        return gekuerzt

    @field_validator("firma", "telefon", "website")
    @classmethod
    def _leer_zu_none(cls, wert: str | None) -> str | None:
        """Leere optionale Felder kommen als `""` aus dem HTML-Formular."""
        if wert is None:
            return None
        gekuerzt = wert.strip()
        return gekuerzt or None


class KontaktAntwort(BaseModel):
    """Immer derselbe Text — auch beim Honigtopf-Treffer.

    Ein Bot darf nicht erfahren, dass er erkannt wurde: sonst probiert der
    nächste Lauf das Feld weg.
    """

    detail: str
