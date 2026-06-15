"""Zentrale App-Konfiguration. Alle Secrets als SecretStr (CLAUDE.md)."""
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

    @property
    def is_local(self) -> bool:
        return self.app_env == "local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
