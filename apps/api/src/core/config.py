"""Zentrale App-Konfiguration. Alle Secrets als SecretStr (PROJECT.md)."""
from functools import lru_cache

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore",
        # Leere Env-Variablen ignorieren statt Defaults zu überschreiben: die
        # Compose-Dateien mappen Variablen als ${VAR:-} durch — ohne gesetzten
        # Wert käme sonst "" an (z. B. CHANNEX_BASE_URL="" → kaputte URLs im
        # Worker, live beobachtet), was den sinnvollen Default aushebelt.
        env_ignore_empty=True,
    )

    app_env: str = "local"
    log_level: str = "INFO"

    # Frontend-Origin für CORS (Komma-getrennt möglich)
    cors_origins: str = "http://localhost:3000"

    # Erlaubte Host-Header (TrustedHostMiddleware, gegen Host-Header-Injection).
    # Komma-getrennt; leer = aus cors_origins abgeleitet. Wildcard-Subdomains
    # als "*.mynextdays.com" möglich. Lokal offen (get_trusted_hosts).
    trusted_hosts: str = ""

    # --- Supabase ---
    supabase_url: str = "http://localhost:54321"
    # Von AUSSEN (Browser/OTA) erreichbare Kong-Adresse — die EINZIGE Quelle für
    # Storage-Links, die wir speichern. `supabase_url` ist im Container die
    # INTERNE Adresse (`http://kong:8000`) und darf hier NIE einspringen: eine so
    # gebaute URL landet in der DB und ist im Browser unerreichbar (so war das
    # Firmenlogo ein kaputtes Bild und ging als toter Link an die Portale).
    # Zwei akzeptierte Env-Namen für denselben Wert: der Supabase-Stack setzt
    # API_EXTERNAL_URL, SUPABASE_PUBLIC_URL ist der explizite Name.
    supabase_public_url: str = Field(
        default="",
        validation_alias=AliasChoices("supabase_public_url", "api_external_url"),
    )
    supabase_anon_key: SecretStr = SecretStr("")
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_jwt_secret: SecretStr = SecretStr("")

    # --- Entwickler-API (Developer-API-Zugang, Booking-Machine-Account-Modell) ---
    # EIGENES Secret zum Signieren der kurzlebigen API-Access-Tokens — bewusst
    # NICHT das supabase_jwt_secret: ein API-Token (Client-Credentials) darf nie
    # mit einem Supabase-Login-Token verwechselbar sein (getrennte Audience,
    # Wurzel 7). Fehlt es, ist der Token-Endpunkt fail-closed deaktiviert.
    api_token_secret: SecretStr = SecretStr("")

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
    # Streng: Endpunkte, die eine KOSTENPFLICHTIGE Fremd-API anstoßen
    # (Sprachassistent → Groq, Übersetzung → Google). Im Default-Bucket (300/60)
    # könnte ein einzelner eingeloggter Nutzer erhebliche Kosten verursachen —
    # Wurzel 8 verlangt hier einen eigenen, strengen Bucket.
    rate_limit_ai: str = "20/60"

    # Öffentlicher Support-Chat der Marketing-Seite (ohne Login). 20 Aufrufe je
    # Minute und IP reichen für eine tippende Person samt Verlaufs-Abrufen und
    # sind für Massen-Spam zu wenig.
    rate_limit_public_support: str = "20/60"
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
    # Twilio — SMS-OTP-Versand (2FA / Nummern-Verifizierung). Trial im Test:
    # sendet nur an in Twilio verifizierte Nummern. Fehlt die Config, schlägt der
    # SMS-Versand klar fehl (kein Fake-„gesendet", Wurzel 4/5).
    twilio_account_sid: str = ""              # AC… (kein Geheimnis i.e.S.)
    twilio_auth_token: SecretStr = SecretStr("")
    twilio_from_number: str = ""              # Twilio-Absendernummer (E.164)
    stripe_secret_key: SecretStr = SecretStr("")
    stripe_webhook_secret: SecretStr = SecretStr("")
    stripe_publishable_key: str = ""          # NEXT_PUBLIC_ im Frontend
    # VERALTET — ohne Wirkung. Die Provision kommt ausschließlich aus
    # tenants.platform_fee_bps und gilt nur für Portal-Buchungen (Preisliste §2).
    # Bleibt vorerst stehen, damit gesetzte Env-Werte keinen Startfehler
    # erzeugen; nicht mehr verwenden.
    stripe_platform_fee_pct: float = 0.0
    # Trennt der Zahlungspfad Charge und Transfer (Separate Charges +
    # transfer_group) statt sofort per transfer_data.destination weiterzureichen?
    #
    # false (Default) = Destination Charge: Das Geld ist unmittelbar nach dem
    # Charge beim Betrieb. Der Auszahlungslauf (0217) MUSS dann stillstehen,
    # sonst zahlt er dieselbe Buchung ein zweites Mal aus dem Plattform-Saldo.
    #
    # true = Charge landet auf dem Plattform-Saldo, der Auszahlungslauf gibt ihn
    # nach dem Checkout frei. Erst umstellen, wenn KEIN Zahlungspfad mehr
    # transfer_data setzt — sonst laufen beide Mechaniken gleichzeitig.
    stripe_separate_transfers: bool = False

    # --- PayPal (Complete Payments Platform / Multiparty) ---
    # Partner-Credentials (client_credentials-OAuth). Alles Secrets → nie ins
    # Repo, nur Env. Leer = PayPal deaktiviert (Onboarding/Order fail-closed 503).
    paypal_client_id: SecretStr = SecretStr("")
    paypal_secret: SecretStr = SecretStr("")
    # BN-Code (PayPal-Partner-Attribution-Id) — Revenue-Attribution, Pflicht-Header
    # bei Multiparty-Calls. Kommt aus der Partner-Freischaltung (App → Reports).
    paypal_bn_code: str = ""
    # Merchant-ID der Plattform selbst (Empfänger der platform_fees). Aus dem
    # Partner-Konto. Leer → Fee geht default an den API-Caller (die Plattform).
    paypal_platform_merchant_id: str = ""
    # Webhook-ID aus der Webhook-Registrierung (POST /v1/notifications/webhooks);
    # für die Signaturprüfung. Leer = Webhook fail-closed (503).
    paypal_webhook_id: str = ""
    # Basis-URL: Sandbox (Default, testbar ohne Live-Approval) vs. Live.
    paypal_base_url: str = "https://api-m.sandbox.paypal.com"
    # client-id für das Frontend-JS-SDK (öffentlich, NEXT_PUBLIC_).
    paypal_publishable_client_id: str = ""
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
    # ARI zählt Channex GETRENNT und vertraglich verbindlich (Acceptable Use
    # Policy): je Property 10 Availability/Minute UND 10 Restrictions&Preise/
    # Minute — zwei eigene Töpfe, nicht ein gemeinsamer. Kontoweit sind es
    # 20 ARI-Anfragen/Minute. Ein einziger Topf mit 20 je Property wäre für
    # Channex ein Verstoß (10 Availability + 10 Rates hintereinander wären
    # erlaubt, 20 Availability nicht), deshalb eigene Budgets.
    channex_ari_account_budget: str = "20/60"      # kontoweit ARI insgesamt
    channex_availability_budget: str = "10/60"     # je Property, Availability
    channex_rates_budget: str = "10/60"            # je Property, Restrictions+Preise
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
    # waba_id: WhatsApp Business Account (Ebene über der Nummer). Template-Anlage
    # und -Abfrage laufen gegen die WABA, nicht gegen die Nummer. Im Multi-Tenant-
    # Ausbau kommt die WABA je Betrieb aus der DB, dieser Wert ist die eigene.
    whatsapp_waba_id: str = ""
    # app_id: Meta-App-ID. Nötig für den Embedded-Signup-Code-Tausch
    # (client_id) und für debug_token (app_id|app_secret). Keine Geheimnis —
    # steht öffentlich in der App-URL, deshalb str und nicht SecretStr.
    whatsapp_app_id: str = ""
    # signup_config_id: die Facebook-Login-for-Business-Konfiguration hinter
    # Metas gehosteter Embedded-Signup-Seite. Meta erzeugt sie zusammen mit der
    # Redirect-URI im App-Dashboard („Von Meta gehostetes Embedded Signup").
    # Ohne sie kann der Betrieb den Verbinden-Vorgang nicht starten.
    whatsapp_signup_config_id: str = ""
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

    # Öffentliche Adresse des Plattform-Backoffice (admin/). Wird für die
    # Einladungslinks des Backoffice-Teams gebraucht; fehlt sie, schlägt die
    # Einladung klar fehl, statt eine erfundene URL zu verschicken (Wurzel 4).
    admin_base_url: str = ""

    # Öffentliche Adresse der Marketing-Seite (marketing/). Ziel der Bestätigungs-
    # und Abmelde-Links aus den Newsletter-Mails. Fehlt sie, wird keine
    # Voranmeldung angenommen — ein Link auf eine geratene Domain wäre wertlos.
    marketing_base_url: str = ""

    # Öffentliche Adresse des myBestDays-Marktplatzes (plattform/). Ziel des
    # Links in der Bewertungs-Erinnerung an den Gast. Fehlt sie, wird KEINE
    # Erinnerung verschickt — eine Mail mit geratener Domain wäre wertlos
    # (Wurzel 4).
    marketplace_base_url: str = ""

    # --- Brevo (Newsletter/Marketing, getrennt vom eigenen Mailserver) --------
    # Der eigene Mailcow bleibt für Transaktionsmails zuständig; Brevo ist NUR
    # der Marketing-Kanal (Listenpflege, Kampagnen). Ohne Schlüssel läuft die
    # Voranmeldung trotzdem: die Adresse liegt bei uns, der Brevo-Abgleich
    # bleibt sichtbar offen (brevo_last_error), statt still zu „gelingen".
    # ACHTUNG Betrieb: Brevo blockt Aufrufe von nicht autorisierten IPs — die
    # Server-IP muss im Brevo-Konto unter Authorized IPs stehen.
    brevo_api_key: SecretStr = SecretStr("")
    brevo_base_url: str = "https://api.brevo.com/v3"
    # Ziel-Liste der Voranmeldungen. Keine Vorgabe: eine geratene Listen-ID
    # schriebe Kontakte in eine fremde Liste (Wurzel 4).
    brevo_list_id: int | None = None

    # --- Coolify (Deploy-Monitor im Backoffice) -------------------------------
    # Nur LESEN + Redeploy auslösen; Coolify bleibt Herr seiner Daten. Ohne
    # Token ist der Monitor sichtbar deaktiviert (503 mit klarer Meldung) statt
    # mit erfundenen Werten zu füllen (Wurzel 4).
    # NICHT `COOLIFY_URL` nennen: den Namen belegt Coolify SELBST und setzt ihn
    # in jedem Container auf die Domains der laufenden App (live gemessen
    # 06.08.2026 — er kam als "https://api.mynextdays.com,…" an). Ein Monitor
    # mit diesem Namen zeigte also auf sich selbst statt auf Coolify.
    coolify_api_url: str = Field(
        default="",
        validation_alias=AliasChoices("coolify_api_url", "coolify_base_url"),
    )
    coolify_token: SecretStr = SecretStr("")

    @property
    def coolify_configured(self) -> bool:
        """Deploy-Monitor ist nutzbar, wenn Adresse UND Token gesetzt sind."""
        return bool(
            self.coolify_api_url.strip()  # pylint: disable=no-member
            and self.coolify_token.get_secret_value().strip()
        )

    @property
    def mail_configured(self) -> bool:
        """Versand ist nutzbar, wenn Server UND Absender gesetzt sind. Fehlt eins,
        ist es ein Konfig-Fehler (kein Ersatzwert) → send() schlägt fehl."""
        return bool(self.smtp_host and self.smtp_from_address)

    @property
    def storage_public_base(self) -> str:
        """Basis-URL für Storage-Links, die GESPEICHERT und später im Browser oder
        von einem OTA geöffnet werden.

        Fehlt die Adresse, ist das ein Konfigurationsfehler → klar fehlschlagen.
        Kein Rückfall auf `supabase_url`: die ist im Container die interne
        Kong-Adresse und würde eine dauerhaft kaputte URL in die DB schreiben.
        """
        # pylint sieht durch das Field(...) nur die FieldInfo, nicht den str-Wert,
        # den pydantic zur Laufzeit einsetzt (falscher no-member).
        base = self.supabase_public_url.strip()  # pylint: disable=no-member
        if not base:
            raise RuntimeError(
                "SUPABASE_PUBLIC_URL (bzw. API_EXTERNAL_URL) ist nicht gesetzt — "
                "ohne die von außen erreichbare Adresse lässt sich keine "
                "speicherbare Storage-URL bilden."
            )
        return base.rstrip("/")

    @property
    def is_local(self) -> bool:
        return self.app_env == "local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def trusted_host_list(self) -> list[str]:
        """Erlaubte Host-Header. Explizit gesetzt > aus CORS-Origins abgeleitet.

        Der Host aus public_api_url wird IMMER ergänzt: unter dieser URL melden
        wir Webhook-Callbacks bei Dritten an (Channex & Co.). Fehlt sie in der
        Liste, weist die TrustedHostMiddleware jeden eingehenden Callback mit
        400 "Invalid host header" ab, BEVOR ein Handler läuft — also ohne Log,
        ohne DB-Spur, ohne dass die Gegenseite den Grund erfährt. Genau so
        liefen am 25./26.07.2026 86 ARI-Webhooks von Channex stumm auf (die
        Liste war handgepflegt und kannte den Callback-Host nicht). Die beiden
        Werte dürfen deshalb nicht getrennt pflegbar sein.

        Lokal (is_local) wird die TrustedHostMiddleware nicht gebunden — hier gibt
        die Ableitung nur die Prod-Hosts zurück, die main.py im Prod-Zweig nutzt.
        """
        if self.trusted_hosts.strip():
            hosts = [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]
        else:
            # Aus den CORS-Origins die reinen Hostnamen ziehen (ohne Schema/Port).
            hosts = []
            for origin in self.cors_origin_list:
                host = origin.split("://", 1)[-1].split("/", 1)[0].split(":", 1)[0]
                if host and host not in hosts:
                    hosts.append(host)
        callback_host = (
            self.public_api_url.split("://", 1)[-1].split("/", 1)[0].split(":", 1)[0]
        )
        if callback_host and callback_host not in hosts:
            hosts.append(callback_host)
        return hosts


@lru_cache
def get_settings() -> Settings:
    return Settings()
