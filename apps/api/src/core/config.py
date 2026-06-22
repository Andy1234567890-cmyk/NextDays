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
    # Groq (KI-Antwortvorschläge im Posteingang). Pydantic liest case-insensitiv,
    # daher passt auch der Env-Name `Groq_API_Key`.
    groq_api_key: SecretStr = SecretStr("")
    groq_model: str = "llama-3.3-70b-versatile"

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

    # --- WhatsApp (Meta WhatsApp Cloud API) ---
    # access_token: permanenter System-User-Token (Meta Business).
    # phone_number_id: ID der WhatsApp-Business-Telefonnummer (Graph API).
    # verify_token: eigenes Zufalls-Secret für die Webhook-Verifizierung (GET).
    # graph_version: Graph-API-Version (z.B. v21.0).
    # Sandbox: ohne echte Credentials lokal testbar (Mock statt Meta-Call). Im
    # Prod IMMER false, sonst würden Nachrichten nicht real versendet.
    whatsapp_access_token: SecretStr = SecretStr("")
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: SecretStr = SecretStr("")
    whatsapp_graph_version: str = "v21.0"
    whatsapp_sandbox: bool = False
    # Eingehende Webhook-Nachrichten einer NEUEN Nummer brauchen einen Tenant.
    # Da wir (vorerst) eine globale WhatsApp-Nummer haben, ordnet dieser Wert neue
    # Konversationen einem Mandanten zu. Leer → neue Nummern werden NICHT geraten,
    # sondern protokolliert verworfen (Memory „keine Fallbacks").
    whatsapp_default_tenant_id: str = ""

    @property
    def is_local(self) -> bool:
        return self.app_env == "local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
