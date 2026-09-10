"""Konfiguration der simulierten Empfangsstelle.

Alles, was diesen Dienst mit der Aussenwelt verbindet, steht hier — und
NICHTS davon hat einen Wert, der auf unsere eigene Infrastruktur zeigt.
Der Dienst laeuft bewusst auf einem ANDEREN Server als das PMS: Erst dann
ist die Einreichung eine echte Netzwerkstrecke zu einer fremden
Gegenstelle und nicht ein Funktionsaufruf im selben Prozess.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Kennwort fuer die Einreichung. Die echte Behoerde verlangt eine
    # Anmeldung bei TastSelv Erhverv; hier genuegt ein gemeinsames Geheimnis,
    # damit die Teststufe nicht offen im Netz steht.
    # KEIN Vorgabewert: Fehlt es, faehrt der Dienst nicht hoch (fail-closed).
    # Ein Standardpasswort waere schlimmer als keines, weil es niemand aendert.
    staging_token: str

    # Wie lange eine Einreichung aufbewahrt wird. Eingereichte DAC7-Dateien
    # enthalten CPR-Nummern und Bankverbindungen — auch Testdaten sollen
    # nicht unbegrenzt liegen bleiben.
    aufbewahrung_stunden: int = 24

    # Obergrenze je Einreichung. Die groesste denkbare echte Meldung eines
    # Betriebs liegt weit darunter; eine 500-MB-Datei ist ein Angriff oder
    # ein Fehler, kein Meldefall.
    max_datei_bytes: int = 20 * 1024 * 1024

    # Erlaubte Herkuenfte fuer den Browser-Zugriff aus dem PMS heraus.
    # Leer = kein CORS. Wird pro Umgebung gesetzt, nie geraten.
    erlaubte_herkuenfte: str = ""

    def herkunft_liste(self) -> list[str]:
        return [h.strip() for h in self.erlaubte_herkuenfte.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
