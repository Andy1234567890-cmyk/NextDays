"""Zentrale App-Konfiguration. Alle Secrets als SecretStr (PROJECT.md)."""
from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "local"
    log_level: str = "INFO"

    # Frontend-Origin für CORS (Komma-getrennt möglich)
    cors_origins: str = "http://localhost:3000"

    # --- Supabase ---
    supabase_url: str = "http://localhost:54321"
    supabase_anon_key: SecretStr = SecretStr("")
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_jwt_secret: SecretStr = SecretStr("")

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Externe Dienste (optional, erst bei Bedarf gefüllt) ---
    google_maps_api_key: SecretStr = SecretStr("")
    google_translate_api_key: SecretStr = SecretStr("")
    stripe_secret_key: SecretStr = SecretStr("")
    stripe_webhook_secret: SecretStr = SecretStr("")

    # --- Channex (Channel-Manager / OTA-Distribution) ---
    # base_url default = Staging; für Produktion auf https://app.channex.io/api/v1.
    # webhook_secret: eigenes Zufalls-Secret, das wir per Custom-Header an Channex
    # geben und im Webhook-Receiver prüfen (Channex signiert nicht via HMAC).
    channex_api_key: SecretStr = SecretStr("")
    channex_base_url: str = "https://staging.channex.io/api/v1"
    channex_webhook_secret: SecretStr = SecretStr("")
    # Sandbox-Testkanäle (z.B. BookDirectOpen) als verbindbare „Portale" mit
    # anbieten — NUR zum Testen ohne echtes OTA-Konto. Im Prod IMMER false, sonst
    # sähe der Kunde Test-Kanäle. Echter Kunde sieht nur Booking.com/Airbnb/…
    channex_sandbox_portals: bool = False
    # Öffentliche Basis-URL DIESER API (für den Webhook-Callback, den Channex
    # aufruft). Muss von außen per HTTPS erreichbar sein — im Dev z.B. ein
    # Tunnel (ngrok/cloudflared), in Prod die echte API-Domain.
    public_api_url: str = ""

    @property
    def is_local(self) -> bool:
        return self.app_env == "local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
