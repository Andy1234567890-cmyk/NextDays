"""Einstellungen der öffentlichen API.

EIGENE Variablen (Prefix `PUBLIC_API_` wo möglich), damit der Service niemals
versehentlich mit der Konfiguration der Haupt-API startet. Nur drei Werte teilt
er zwangsläufig mit ihr, weil sie dieselbe Datenbank und dieselbe Client-Tabelle
betreffen:

    SUPABASE_URL                  — dieselbe Datenbank
    SUPABASE_SERVICE_ROLE_KEY     — derselbe Schreib-/Lesezugang
    API_TOKEN_SECRET              — dasselbe Signier-Secret der API-Tokens

Letzteres MUSS übereinstimmen: die Verwaltung der Zugänge (Client anlegen,
rotieren, widerrufen) sitzt im Dashboard, also in der Haupt-API; getauscht und
geprüft wird das Token hier. Zwei verschiedene Secrets würden bedeuten, dass ein
im Dashboard angelegter Zugang hier nicht funktioniert.

Fail-closed (Wurzel 5): fehlt ein Pflichtwert, wird kein Ersatzwert erfunden.
Der Service startet, meldet aber 503 statt stillschweigend ohne Auth zu laufen.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Konfiguration aus der Umgebung. Keine Defaults für Geheimnisse."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # -- Umgebung -----------------------------------------------------------
    # `local` | `staging` | `production`. Steuert Logformat und ob die
    # interaktive Referenz (/docs) erreichbar ist.
    app_env: str = "local"
    log_level: str = "INFO"

    # -- Datenbank (geteilt mit der Haupt-API, weil es EINE Wahrheit gibt) ---
    supabase_url: str = "http://localhost:54321"
    supabase_service_role_key: SecretStr = SecretStr("")
    # Die beiden folgenden Felder braucht dieser Service selbst NICHT — er
    # arbeitet ausschließlich mit service_role und liefert keine Storage-Links
    # aus. Sie stehen hier, weil `core/supabase.py` eine Schwesterdatei der
    # Haupt-API ist (byte-identisch, CI-geprüft) und deren `get_anon_client` /
    # `public_storage_url` sie lesen. Ein eigener, abgewandelter Zwilling der
    # Datei wäre der schlechtere Handel: die Verbindungshärtung würde driften.
    supabase_anon_key: SecretStr = SecretStr("")
    storage_public_base: str = ""

    # -- Auth ---------------------------------------------------------------
    # Signier-Secret der Access-Tokens. Muss identisch zur Haupt-API sein.
    api_token_secret: SecretStr = SecretStr("")

    # -- Rate-Limits --------------------------------------------------------
    redis_url: str = "redis://localhost:6379/1"
    # Form: "<max>/<sekunden>". Getrennte Eimer, weil die Lasten verschieden
    # sind (Recherche 20.08.2026: Lodgify 600/min v1 bzw. 750/min v2 absolut,
    # Hostaway 20 Anfragen / 10 s je Konto — wir liegen bewusst dazwischen und
    # begrenzen zusätzlich je Zugang statt nur je IP).
    #
    # Lesen: der Alltag einer Integration (Kalender abgleichen, Buchungen
    # holen). Schreiben: greift in den Verkauf ein, deshalb strenger.
    rate_limit_read: str = "600/60"
    rate_limit_write: str = "120/60"
    # Token-Tausch: Brute-Force-Fläche, deshalb der strengste Eimer.
    rate_limit_token: str = "10/60"
    # Vertrauenswürdige Proxy-Hops (Traefik/Coolify) für X-Forwarded-For.
    trusted_proxy_hops: int = 0

    # -- Grenzen (Wurzel 8: jeder unbegrenzte Bereich bekommt eine Obergrenze)
    max_page_size: int = 200
    # Längster Zeitraum je Kalender-/Preisabfrage in Tagen.
    max_date_span_days: int = 730

    # -- Webhook-Zustellung -------------------------------------------------
    # Zeitgrenze je Zustellversuch. Hostaway wartet 20 s; wir nehmen 10 s,
    # damit ein hängender Empfänger die Warteschlange nicht ausbremst.
    webhook_timeout_seconds: float = 10.0
    # Maximale Zustellversuche je Ereignis und Abo. Lodgify: 10.
    webhook_max_attempts: int = 10
    # Takt des Zustellers in Sekunden.
    webhook_poll_seconds: float = 5.0

    # -- Veröffentlichte Basis-Adresse (steht in der OpenAPI-Datei) ----------
    public_base_url: str = "https://api.mynextdays.dk"

    @property
    def ist_produktion(self) -> bool:
        return self.app_env == "production"

    @property
    def json_logs(self) -> bool:
        return self.app_env != "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()
