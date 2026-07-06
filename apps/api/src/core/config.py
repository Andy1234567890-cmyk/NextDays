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

    # --- Rate-Limiting (Redis-backed, pro IP + pro Tenant) ---
    # Schema je Limit: "<max>/<fenster-sekunden>". Gestaffelt nach Sensitivität.
    # An/aus-Schalter, damit lokale Tests/Dev ohne Redis nicht limitiert werden.
    rate_limit_enabled: bool = True
    # Großzügiger globaler Default pro IP — fängt nur Exzesse/Scraper.
    rate_limit_default: str = "300/60"
    # Streng: Brute-Force-Schutz für Login/Register (pro IP).
    rate_limit_auth: str = "10/60"
    # Streng: teure Zahlungs-Endpunkte (pro IP).
    rate_limit_payments: str = "30/60"
    # Öffentliche (nicht-eingeloggte) Such-/Listings-/Kalender-Endpunkte:
    # Scraper-Schutz PRO IP. 240/60 statt 60/60 — 60 war zu knapp und traf bei
    # Büro-NAT (mehrere Mitarbeiter, eine IP) mehrere Nutzer gemeinsam.
    rate_limit_listings: str = "240/60"
    # EINGELOGGTE Kalender-/Listings-Requests werden PRO TENANT limitiert (nicht
    # pro IP) — sonst sperrt sich ein Betrieb, der seinen eigenen Kalender lädt,
    # selbst aus. Großzügig, weil ein Kalender-Load (bis der Batch-Endpunkt greift)
    # viele Objekt-Requests bündelt. Missbrauch bleibt durch das allgemeine
    # tenant-Limit gedeckelt.
    rate_limit_listings_tenant: str = "1200/60"
    # Multi-Tenant-Fairness: ein eingeloggter Tenant darf den Pool nicht leeren.
    rate_limit_tenant: str = "600/60"
    # Vertrauenswürdige Proxy-Hops für die X-Forwarded-For-Auswertung. Anzahl der
    # von RECHTS zu überspringenden Proxy-IPs; die echte Client-IP ist das
    # (1+trusted_hops)-letzte XFF-Element.
    # WICHTIG (am Server verifiziert): Coolifys Traefik VERTRAUT clientseitigem
    # X-Forwarded-For NICHT — es ersetzt den Header durch die echte Remote-IP
    # (Test: gefälschtes XFF kam als reine Client-IP an). Damit enthält XFF genau
    # ein vertrauenswürdiges Element = die echte IP → trusted_hops = 0 (letztes
    # Element). Würde Coolify später eine weitere Proxy-Schicht (z. B. Cloudflare)
    # davorsetzen, diesen Wert entsprechend erhöhen.
    rate_limit_trusted_proxy_hops: int = 0
    # Auth/Payments fail-CLOSED bei Redis-Ausfall (lieber 503 als Brute-Force-Fenster
    # offen); alle anderen Endpunkte fail-OPEN (Redis ist Cache/Queue, kein harter
    # Gate — ein Redis-Ausfall darf nicht alle Nutzer aussperren).
    rate_limit_fail_closed_sensitive: bool = True

    # --- Externe Dienste (optional, erst bei Bedarf gefüllt) ---
    google_maps_api_key: SecretStr = SecretStr("")
    google_translate_api_key: SecretStr = SecretStr("")
    stripe_secret_key: SecretStr = SecretStr("")
    stripe_webhook_secret: SecretStr = SecretStr("")
    stripe_publishable_key: str = ""          # NEXT_PUBLIC_ im Frontend
    # Plattform-Provision auf Gast-Zahlungen (Destination Charge), in Prozent des
    # Buchungsbetrags. 0 = keine Fee (Default). Wird zu application_fee_amount.
    stripe_platform_fee_pct: float = 0.0
    # Groq (KI-Antwortvorschläge im Posteingang). Pydantic liest case-insensitiv,
    # daher passt auch der Env-Name `Groq_API_Key`.
    groq_api_key: SecretStr = SecretStr("")
    # llama-3.3-70b-versatile wird von Groq stillgelegt (Deprecation 2026);
    # empfohlener Production-Nachfolger: openai/gpt-oss-120b.
    groq_model: str = "openai/gpt-oss-120b"

    # --- Channex (Channel-Manager / OTA-Distribution) ---
    # base_url default = Staging; für Produktion auf https://app.channex.io/api/v1.
    # webhook_secret: eigenes Zufalls-Secret, das wir per Custom-Header an Channex
    # geben und im Webhook-Receiver prüfen (Channex signiert nicht via HMAC).
    channex_api_key: SecretStr = SecretStr("")
    channex_base_url: str = "https://staging.channex.io/api/v1"
    channex_webhook_secret: SecretStr = SecretStr("")
    # Eigenes Secret für interne Cron-Endpunkte (recompute/reconcile/auto-run/
    # dispatch). Bewusst GETRENNT vom channex_webhook_secret: das geht outbound
    # an Channex und darf deshalb keine internen, tenant-übergreifenden
    # Endpunkte autorisieren. Leer = Cron-Endpunkte deaktiviert (503).
    internal_cron_secret: SecretStr = SecretStr("")
    # Sandbox-Testkanäle (z.B. BookDirectOpen) als verbindbare „Portale" mit
    # anbieten — NUR zum Testen ohne echtes OTA-Konto. Im Prod IMMER false, sonst
    # sähe der Kunde Test-Kanäle. Echter Kunde sieht nur Booking.com/Airbnb/…
    channex_sandbox_portals: bool = False
    # Kontoweites Channex-Anfrage-Budget (Token-Bucket im Worker vor jedem Push).
    # EIN Channex-API-Key fürs ganze Konto → alle Betriebe teilen sich Channex'
    # Rate-Limit. Bei vielen gleichzeitig sync'enden Betrieben würde der Worker
    # Channex sonst überfahren (429/Sperre). Zwei Ebenen: kontoweit + pro Property.
    # Schema wie die HTTP-Limits: "<max>/<fenster-sekunden>".
    channex_account_budget: str = "200/60"   # kontoweit ~200 Requests/Minute
    channex_property_budget: str = "20/60"    # je Property ~20 Requests/Minute
    # Öffentliche Basis-URL DIESER API (für den Webhook-Callback, den Channex
    # aufruft). Muss von außen per HTTPS erreichbar sein — im Dev z.B. ein
    # Tunnel (ngrok/cloudflared), in Prod die echte API-Domain.
    public_api_url: str = ""

    # --- Cloudflare for SaaS (Custom Hostnames für White-Label-Agentur-Domains) ---
    # api_token: API-Token mit NUR "Zone › Custom Hostnames › Edit" auf der einen
    #   SaaS-Zone (least-privilege). zone_id: die ID dieser Zone.
    # fallback_origin: der Hostname in der CF-Zone, auf den ALLE Custom-Hostnames
    #   routen (z.B. origin.mynextdays.de → Hetzner-Origin). Genau hierauf zeigt der
    #   CNAME, den eine Agentur für ihre Domain setzt. Ohne konfigurierten
    #   Fallback-Origin (CF-Account-seitig) routet kein Custom-Domain-Traffic.
    # Leer = Cloudflare nicht konfiguriert → Domain-Endpunkte antworten 503 (kein
    #   Raten/Fallback). Branding ohne Custom-Domain funktioniert trotzdem.
    cloudflare_api_token: SecretStr = SecretStr("")
    cloudflare_zone_id: str = ""
    cloudflare_fallback_origin: str = ""
    cloudflare_base_url: str = "https://api.cloudflare.com/client/v4"

    # --- Page-Builder: Draft-Render-Token (Editor-Live-Vorschau) ---
    # HMAC-Secret, mit dem das Backend kurzlebige Tokens signiert, die der
    # builder/-iframe vorzeigt, um UNVERÖFFENTLICHTE Seiten zu rendern. NIE ins
    # Repo/Log. Im Dev leer → ein lokaler Default greift (nur lokal nutzbar).
    site_draft_secret: SecretStr = SecretStr("")

    # --- WhatsApp (Meta WhatsApp Cloud API) ---
    # access_token: permanenter System-User-Token (Meta Business).
    # phone_number_id: ID der WhatsApp-Business-Telefonnummer (Graph API).
    # verify_token: eigenes Zufalls-Secret für die Webhook-Verifizierung (GET).
    # app_secret: App-Geheimnis (Meta-App-Einstellungen) — für die Prüfung der
    #   Webhook-Signatur (X-Hub-Signature-256). Leer = Signaturprüfung wird im Dev
    #   übersprungen (mit Warn-Log); im Prod MUSS es gesetzt sein.
    # graph_version: Graph-API-Version (Übergabe nutzt v25.0).
    # Sandbox: ohne echte Credentials lokal testbar (Mock statt Meta-Call). Im
    # Prod IMMER false, sonst würden Nachrichten nicht real versendet.
    whatsapp_access_token: SecretStr = SecretStr("")
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: SecretStr = SecretStr("")
    whatsapp_app_secret: SecretStr = SecretStr("")
    whatsapp_graph_version: str = "v25.0"
    whatsapp_sandbox: bool = False
    # Eingehende Webhook-Nachrichten einer NEUEN Nummer brauchen einen Tenant.
    # Da wir (vorerst) eine globale WhatsApp-Nummer haben, ordnet dieser Wert neue
    # Konversationen einem Mandanten zu. Leer → neue Nummern werden NICHT geraten,
    # sondern protokolliert verworfen (Memory „keine Fallbacks").
    whatsapp_default_tenant_id: str = ""

    # --- Dynamic Pricing Phase 2: Markt-/Wettbewerbs-Signal ---
    # Provider-Auswahl: leer/„null" → NullProvider (kein externes Signal, Markt-
    # Faktor neutral). „airdna" → AirDnaProvider (nur aktiv mit airdna_api_key).
    market_data_provider: str = ""
    airdna_api_key: SecretStr = SecretStr("")
    airdna_base_url: str = "https://api.airdna.co/api/v1"

    # --- E-Mail-Versand (eigener Mailcow-SMTP-Server, deploy/mail/) ---
    # host/port: der Mailcow-Server. port 587 = STARTTLS (Submission, empfohlen),
    #   465 = implizites TLS (SMTPS). user/password: ein echtes Mailcow-Postfach
    #   (z.B. developer@… oder noreply@…), NICHT der Admin. from_address: die
    #   sichtbare Absenderadresse; MUSS zu einer Domain gehören, für die der
    #   Mailcow-Server DKIM signiert (sonst Spam). from_name: Anzeigename.
    # WICHTIG (keine Fallbacks): Fehlt host ODER from_address, ist Versand NICHT
    #   konfiguriert → send() schlägt fail-CLOSED fehl (kein stiller „Erfolg", keine
    #   erfundene Absenderadresse). Im Dev bleibt es leer → mail_sandbox greift.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from_address: str = ""
    smtp_from_name: str = "myNextDays"
    # STARTTLS (True, Port 587) vs. implizites TLS/SMTPS (False, Port 465). Beides
    # verschlüsselt; unterscheidet nur, WANN der TLS-Handshake beginnt.
    smtp_starttls: bool = True
    # Sandbox: kein echter SMTP-Call, die Mail wird nur geloggt (lokale Tests/Dev
    # ohne Mailserver). Im Prod IMMER false, sonst würde nichts real versendet.
    mail_sandbox: bool = False

    @property
    def mail_configured(self) -> bool:
        """Versand ist nutzbar, wenn Server UND Absender gesetzt sind. Fehlt eins,
        ist es ein Konfig-Fehler (kein Ersatzwert) → send() schlägt fehl."""
        return bool(self.smtp_host and self.smtp_from_address)

    @property
    def is_local(self) -> bool:
        return self.app_env == "local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
