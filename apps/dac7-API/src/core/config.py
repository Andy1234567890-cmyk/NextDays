"""Konfiguration der Versand-API.

Hier stehen die Zugangsdaten zur Behoerde. Sie sind der Grund, warum
dieser Dienst getrennt laeuft: Je weniger Code neben ihnen liegt, desto
kleiner die Angriffsflaeche.

KEINE VORGABEWERTE fuer die Geheimnisse. Fehlt eines, faehrt der Dienst
nicht hoch. Ein Standardwert waere schlimmer als keiner — er wird nie
geaendert, und niemand merkt es.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Wer darf hier einreichen ------------------------------------------
    # Das PMS ruft diesen Dienst serverseitig auf und weist sich damit aus.
    # PFLICHT: Ein offener Versanddienst wuerde jedem erlauben, in unserem
    # Namen etwas an die Steuerbehoerde zu schicken.
    versand_token: str

    # --- Wohin geht die Meldung --------------------------------------------
    # Die Gegenstelle. In der Teststufe die simulierte Empfangsstelle
    # (apps/dac7-staging, zweiter Server), spaeter TastSelv Erhverv.
    #
    # Kein Vorgabewert auf die echte Behoerde: Eine falsch konfigurierte
    # Umgebung, die still an die ECHTE Behoerde sendet, ist der teuerste
    # denkbare Fehler dieses Dienstes.
    amt_url: str
    amt_basic_user: str = ""
    amt_basic_password: str = ""
    amt_token: str = ""

    # Ist das die Teststufe oder die echte Behoerde? Steuert nur die
    # Kennzeichnung in Protokoll und Antwort — die Adresse entscheidet,
    # wohin es geht. Bewusst zwei getrennte Angaben: Wer die Adresse
    # umstellt und das hier vergisst, sieht den Widerspruch im Protokoll.
    amt_ist_teststufe: bool = True

    # Wie lange auf die Behoerde gewartet wird. Eine Meldung ist eine
    # kleine Datei; laenger als eine Minute heisst, dass etwas haengt.
    zeitlimit_s: float = 60.0

    max_datei_bytes: int = 20 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
