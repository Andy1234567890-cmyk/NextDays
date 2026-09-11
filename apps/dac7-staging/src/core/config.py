"""Konfiguration der simulierten Empfangsstelle.

Alles, was diesen Dienst mit der Aussenwelt verbindet, steht hier — und
NICHTS davon hat einen Wert, der auf unsere eigene Infrastruktur zeigt.
Der Dienst laeuft bewusst auf einem ANDEREN Server als das PMS: Erst dann
ist die Einreichung eine echte Netzwerkstrecke zu einer fremden
Gegenstelle und nicht ein Funktionsaufruf im selben Prozess.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Kennwort fuer die Einreichung. Die echte Behoerde verlangt eine
    # Anmeldung bei TastSelv Erhverv; hier genuegt ein gemeinsames Geheimnis,
    # damit die Teststufe nicht offen im Netz steht.
    # KEIN Vorgabewert: Fehlt es, faehrt der Dienst nicht hoch (fail-closed).
    # Ein Standardpasswort waere schlimmer als keines, weil es niemand aendert.
    #
    # `min_length=1`, weil „fehlt" und „ist leer" fuer Pydantic zwei Dinge
    # sind: ohne die Variable bricht der Start mit ValidationError ab, mit
    # `STAGING_TOKEN=` fuhr der Dienst hoch — mit dem Leerstring als
    # Geheimnis. Die Anmeldung haette weiter jeden abgewiesen
    # (`core/auth.py` prueft `not x_staging_token` vor dem Vergleich), es war
    # also kein offener Zugang; aber die Zusage „ohne Token kein Start" galt
    # nur fuer eine der beiden Arten, kein Token zu haben. Gefunden am
    # 11.09.2026 beim Nachstellen der CI-Gegenprobe, die genau diesen Aufruf
    # macht und ihn wegen `2>/dev/null` nicht sichtbar werden liess.
    staging_token: str = Field(min_length=1)

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

    # Der private Schluessel der Empfangsstelle (PEM, PKCS#8). Mit ihm
    # oeffnet sie verschluesselte Umschlaege (`core/umschlag.py`).
    #
    # KEIN Vorgabewert und KEIN erzeugter Schluessel beim Start: Ein
    # Schluessel, den der Dienst sich selbst ausdenkt, wechselt bei jedem
    # Neustart — der Absender verschluesselt dann gegen einen Schluessel,
    # den es nicht mehr gibt, und bekommt „fuer einen anderen Empfaenger
    # verschluesselt" zu lesen. Fehlt er, nimmt die Stelle nur Klartext
    # entgegen und sagt das auch.
    #
    # In Coolify als Secret setzen, NIE im Repo (CLAUDE.md).
    empfaenger_privkey: str = ""

    # Der zugehoerige oeffentliche Schluessel. Wird unter
    # `GET /v1/schluessel` veroeffentlicht, damit ein Absender ihn holen
    # kann, ohne dass ihn jemand von Hand kopiert.
    empfaenger_pubkey: str = ""

    def nimmt_verschluesselt_entgegen(self) -> bool:
        """Ob diese Stelle einen Umschlag oeffnen kann."""
        return bool(self.empfaenger_privkey.strip())

    def herkunft_liste(self) -> list[str]:
        return [h.strip() for h in self.erlaubte_herkuenfte.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
