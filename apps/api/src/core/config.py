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
    # NOCH strenger: die öffentlichen Token-Vorgänge der Tenant-Nutzer (0334) —
    # Einladung annehmen, Passwort vergessen, neues Passwort setzen. Härter als
    # der Login-Bucket, weil ein Aufruf hier eine Mail an eine FREMDE Adresse
    # auslösen bzw. einen Token durchprobieren kann und ein Treffer ein Passwort
    # SETZT (nicht nur eines prüft). 5/60 reicht für jeden echten Nutzer bequem:
    # man fordert einen Link an und löst ihn einmal ein. Die Sperrfrist je Konto
    # im Dienst kommt zusätzlich obendrauf — sie schützt ein einzelnes Postfach
    # auch vor einem Angreifer mit wechselnden IPs.
    rate_limit_auth_public: str = "5/60"
    # Token-Erneuerung. BEWUSST NICHT im auth-Bucket: /auth/refresh ist kein
    # Credential-Rateweg (wer ein gültiges Refresh-Token hat, ist bereits
    # angemeldet — es gibt nichts zu erraten), wird aber von JEDER Sitzung
    # regelmäßig aufgerufen. Im 10/60-IP-Bucket war das ein Selbstschuss: die
    # Frontends rufen server-zu-server auf, alle Nutzer teilten sich also die
    # zehn Erneuerungen der einen Container-IP — der elfte bekam 429 und wurde
    # abgemeldet, ausgelöst durch die Aktivität FREMDER Nutzer. Gekeyt wird
    # deshalb pro Nutzer (sub-Claim), nicht pro IP; 60/60 deckt auch ein
    # Dashboard mit vielen parallelen Abfragen ab.
    rate_limit_refresh: str = "60/60"
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
    # Der MCP-Connector (0385): `/mcp/token` löst Codes ein und rotiert
    # Refresh-Token, `/mcp/authorize` holt ein fremdes CIMD-Dokument über einen
    # ausgehenden Fetch. Beides ist durchprobierbar bzw. verstärkend, gehört
    # also in einen eigenen strengen Bucket (Wurzel 8) — nicht in den Default.
    # Der MCP-Endpunkt selbst (`/mcp`, Werkzeugaufrufe) bleibt bewusst im
    # Default: ein Gespräch macht viele Aufrufe, 20/60 würde es abwürgen.
    rate_limit_mcp_auth: str = "20/60"
    # AM STRENGSTEN: die 2FA-Verifikationspfade (Wurzel 8). Hier wird ein
    # Geheimnis GEPRUEFT — ein Wiederherstellungscode bzw. ein zweiter Faktor.
    # Der Default-Bucket (300/60) erlaubte 300 Rateversuche je Minute; das ist
    # der Unterschied zwischen „nicht durchprobierbar" und „durchprobierbar".
    # 5/60 reicht fuer jeden echten Nutzer bequem (man tippt einen Code einmal
    # ab, notfalls mit einem Vertipper) und macht Bruteforce sinnlos.
    rate_limit_mfa: str = "5/60"
    # AUSNAHME: `GET /auth/mfa/status` liest nur den EIGENEN 2FA-Zustand und
    # prueft kein Geheimnis (Nutzer kommt aus dem Token, es gibt keinen
    # `user_id`-Parameter). Ein strenges Limit schuetzt dort nichts — es gibt
    # nichts zu erraten und nichts aufzuzaehlen.
    #
    # Der Schaden war real (12.08.2026): Sicherheitsseite und Kopfbereich fragen
    # den Status bei jedem Seitenaufbau ab. Mit 5/60 PRO IP antwortete der Pfad
    # nach wenigen `router.refresh()` in Folge mit 429, ohne Angriff — und bei
    # Buero-NAT teilen sich alle Mitarbeiter dieselben fuenf Anfragen. Dasselbe
    # Muster wie beim `refresh`-Bucket, dessen Kommentar es beschreibt: „der
    # elfte bekam 429, ausgeloest durch die Aktivitaet FREMDER Nutzer".
    #
    # GEKEYT PRO NUTZER (sub-Claim + IP), nicht pro IP allein — dieselbe Lehre
    # wie beim refresh-Bucket: `web/lib/mfa.ts` ist `"use server"`, der Aufruf
    # kommt server-zu-server aus EINEM Next-Container und setzt kein
    # X-Forwarded-For. Ein IP-Zaehler waere fuer ALLE Nutzer ALLER Betriebe
    # gemeinsam; ein einzelner Nutzer mit offener Kalenderseite haette waehrend
    # eines Imports alle anderen aussperren koennen (der Aufruf sitzt im
    # Dashboard-Layout, `realtime-refresh.tsx` loest ihn ueber sechs Hooks aus,
    # deren Debounce hook-lokal ist und nicht koalesziert).
    #
    # 60/60 je Nutzer: reichlich fuer jede Navigation samt Realtime-Bursts, und
    # deutlich unter dem Default (300/60) — ein /auth/*-Pfad bekommt kein
    # 300er-Limit, nur weil er harmlos liest.
    rate_limit_mfa_status: str = "60/60"
    # „Einladung erneut senden" (Mitarbeiter unter /konto/nutzer, Eigentümer
    # unter /eigentuemer). Eingeloggt, aber jeder Aufruf schickt eine Mail an
    # eine FREMDE Adresse — der Default-Bucket (300/60) ist dafür kein Dach
    # (Wurzel 8). 10/60 pro IP: ein Betreiber, der nach einem Mailproblem
    # reihum mehrere Personen neu einlädt, kommt bequem durch; ein Skript, das
    # damit Postfächer flutet, nicht. Die Sperrfrist je ZIELKONTO (1 Minute,
    # `einladung_service._RESEND_COOLDOWN`) bleibt zusätzlich bestehen und
    # deckt den Doppelklick auf denselben Empfänger ab.
    rate_limit_einladung_resend: str = "10/60"

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
    # Ist der SMS-Faktor (GoTrue `factor_type: phone`) auf DIESEM Server
    # wirklich nutzbar? Getrennt von den Twilio-Werten oben, weil das ZWEI
    # verschiedene Systeme sind: die Werte oben versorgen den EIGENEN OTP-Weg
    # der FastAPI, der Faktor laeuft dagegen in GoTrue mit dessen eigener
    # `GOTRUE_SMS_*`-Konfiguration (Wurzel 7). Aus den Twilio-Werten der API
    # laesst sich deshalb NICHT ableiten, ob GoTrue senden kann.
    #
    # Zusaetzlich haengt die Nutzbarkeit nicht nur an der Konfiguration,
    # sondern am Twilio-Konto: ein Trial-Konto sendet ausschliesslich an zuvor
    # in der Twilio-Konsole verifizierte Nummern (Fehler 21608) — hoechstens
    # fuenf. Ein Kunde kann seine eigene Nummer dort nicht eintragen, der
    # Faktor waere fuer ihn also eine Sackgasse. Darum ist das ein
    # ausdruecklicher Schalter und keine Ableitung: Er geht erst auf `true`,
    # wenn das Konto aufgewertet ist UND GoTrue die `GOTRUE_SMS_*`-Werte hat.
    # Default false = die Oberflaeche weist den Weg ehrlich als nicht
    # verfuegbar aus, statt den Nutzer in einen 500er laufen zu lassen.
    mfa_sms_available: bool = False
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

    # --- Vorfuehr-Zugang der Marketing-Seite („Demo ansehen", 0407) ---
    # Zugangsdaten des Vorfuehr-Mandanten. Der Besucher erfaehrt sie NIE: der
    # Endpunkt `/auth/demo` meldet serverseitig an und gibt nur die Session
    # heraus. Leer = der Endpunkt antwortet 503 (kein erfundener Fallback,
    # Wurzel 4) — die Marketing-Seite blendet den Knopf dann aus.
    # `demo_tenant_id` ist die Gegenprobe: das ausgestellte Token MUSS diesen
    # Mandanten tragen, sonst wurde am Konto etwas verstellt und der Endpunkt
    # gibt nichts heraus (fail-closed).
    demo_login: str = ""
    demo_passwort: SecretStr = SecretStr("")
    demo_tenant_id: str = ""

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
    # NICHT direkt lesen — der wirksame Wert ist `mail_sandbox` (Property unten),
    # das lokal von selbst greift. Dieses Feld hebt den lokalen Riegel nur auf,
    # wenn man den Produktivversand vom eigenen Rechner ausdrücklich will.
    mail_sandbox_override: bool | None = None

    # Öffentliche Adresse des Plattform-Backoffice (admin/). Wird für die
    # Einladungslinks des Backoffice-Teams gebraucht; fehlt sie, schlägt die
    # Einladung klar fehl, statt eine erfundene URL zu verschicken (Wurzel 4).
    admin_base_url: str = ""

    # Öffentliche Adresse des PMS-Dashboards (web/, myNextDays). Ziel der
    # Einladungs- und Passwort-Reset-Links für BETRIEBS-Nutzer (0334). Bewusst
    # getrennt von `admin_base_url`: das ist das Plattform-Backoffice, eine
    # andere Anwendung und eine andere Zielgruppe — ein Betriebs-Mitarbeiter
    # darf dort nie landen. Fehlt sie, schlägt die Einladung klar fehl, statt
    # eine erfundene URL zu verschicken (Wurzel 4).
    app_base_url: str = ""

    # Öffentliche Adresse der Marketing-Seite (marketing/). Ziel der Bestätigungs-
    # und Abmelde-Links aus den Newsletter-Mails. Fehlt sie, wird keine
    # Voranmeldung angenommen — ein Link auf eine geratene Domain wäre wertlos.
    marketing_base_url: str = ""

    # Öffentliche Adresse des myBestDays-Marktplatzes (plattform/). Ziel des
    # Links in der Bewertungs-Erinnerung an den Gast. Fehlt sie, wird KEINE
    # Erinnerung verschickt — eine Mail mit geratener Domain wäre wertlos
    # (Wurzel 4).
    marketplace_base_url: str = ""

    # --- Anbieterangaben für die Fußzeile ausgehender E-Mails -----------------
    # Eine geschäftliche E-Mail muss ihren Absender benennen: Firma, Rechtsform,
    # Sitz, Registernummer und einen Kontaktweg (dänische e-handelslov § 7 für
    # den Sitz Dänemark; die EU-Handelsregister-Richtlinie verlangt dasselbe für
    # Geschäftsbriefe, und eine E-Mail ist einer).
    #
    # Diese Werte stehen bewusst NICHT im Code: eine Registeränderung (Sitz,
    # Direktion, Momsregistrierung) darf keinen Deploy brauchen, und zwei
    # gepflegte Wahrheiten laufen auseinander. Die Frontends ziehen dieselben
    # Angaben aus `marketing/content/legal/anbieter.ts` (dort am 30.07.2026
    # gegen cvrapi.dk/Dataforsyningen geprüft) — der Betrieb trägt sie hier als
    # ENV nach.
    #
    # Fehlt ein Wert, entfällt die betroffene Zeile der Fußzeile; fehlt der
    # Firmenname, benennt die Fußzeile den Mangel. Es wird NIE eine plausible
    # Adresse oder Registernummer eingesetzt (Wurzel 4).
    company_legal_name: str = ""
    company_legal_form: str = ""
    company_street: str = ""
    company_city: str = ""
    company_country: str = ""
    # Die CVR-Nummer ist rein 8-stellig und existiert ab Gründung.
    company_registration_number: str = ""
    # Die Umsatzsteuer-Identifikationsnummer („DK" + CVR) gibt es ERST mit der
    # Momsregistrierung. § 7 e-handelslov verlangt sie nur, wenn sie besteht —
    # solange nicht, bleibt dieses Feld leer und die Zeile entfällt. Eine noch
    # nicht erteilte Nummer zu veröffentlichen wäre eine falsche Angabe.
    company_vat_id: str = ""
    company_contact_email: str = ""
    company_contact_phone: str = ""

    # --- Kontaktformular der Marketing-Seite (0414) ----------------------------
    # Zwei Postfächer, weil zwei Zuständigkeiten: allgemeine/kaufmännische
    # Anliegen landen bei info@, technische bei developer@. Die Zuordnung
    # entscheidet AUSSCHLIESSLICH der Server (Wurzel 3) — das Formular schickt
    # nur ein Thema-Kürzel, niemals eine Zieladresse. Ohne diese Werte nimmt das
    # Formular nichts an (503): eine geratene Zieladresse wäre eine Anfrage, die
    # ins Leere geht, ohne dass es jemand merkt (Wurzel 4).
    contact_recipient_general: str = ""
    contact_recipient_technical: str = ""

    # --- reCAPTCHA Enterprise (Google Cloud) ----------------------------------
    # Spamschutz des öffentlichen Kontaktformulars. Score-basierter (unsichtbarer)
    # Schlüssel: die Seite holt per `grecaptcha.enterprise.execute` ein Token, der
    # Server lässt es von Google bewerten
    # (POST https://recaptchaenterprise.googleapis.com/v1/projects/<id>/assessments?key=<api_key>).
    # Bewertet wird SERVERSEITIG — ein Token, das nur der Client prüft, ist kein
    # Schutz. Kostenlos bis 10.000 Bewertungen/Monat je Organisation.
    # project_id = Google-Cloud-Projekt, api_key = API-Schlüssel mit Zugriff auf
    # die reCAPTCHA-Enterprise-API, site_key = der öffentliche Schlüssel, der auch
    # im Frontend steht (NEXT_PUBLIC_RECAPTCHA_SITE_KEY) — beide müssen dieselbe
    # Kennung tragen, sonst ist jedes Token ungültig.
    recaptcha_project_id: str = ""
    recaptcha_api_key: SecretStr = SecretStr("")
    recaptcha_site_key: str = ""
    recaptcha_base_url: str = "https://recaptchaenterprise.googleapis.com/v1"
    # Ab welchem Score die Anfrage als menschlich gilt. 0.5 ist der von Google
    # dokumentierte Ausgangswert; 1.0 = sicher Mensch, 0.0 = sicher Bot.
    recaptcha_min_score: float = 0.5
    # Sandbox: Token wird NICHT bei Google geprüft, nur protokolliert. Gleiche
    # Bauart wie `mail_sandbox` und aus demselben Grund — lokal darf niemand
    # daran denken müssen, und lokal gibt es keine Schlüssel. Der wirksame Wert
    # ist die Property `captcha_sandbox`.
    captcha_sandbox_override: bool | None = None

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
    # EIGENER Token nur für Build-Logs: Coolify gibt `logs` nur mit der
    # Berechtigung `read:sensitive` heraus — und die öffnet in 8 Controllern
    # zusätzlich Webhook-Secrets, Dateiinhalte und Cloud-Provider-Token. Der
    # Deploy-Token bleibt deshalb eng (read+deploy), das Log-Lesen bekommt ein
    # getrenntes Geheimnis (read+read:sensitive, darf NICHT deployen).
    coolify_log_token: SecretStr = SecretStr("")

    @property
    def coolify_configured(self) -> bool:
        """Deploy-Monitor ist nutzbar, wenn Adresse UND Token gesetzt sind."""
        return bool(
            self.coolify_api_url.strip()  # pylint: disable=no-member
            and self.coolify_token.get_secret_value().strip()
        )

    @property
    def coolify_logs_configured(self) -> bool:
        """Log-Ansicht ist nutzbar, wenn zusätzlich der Log-Token gesetzt ist."""
        return bool(
            self.coolify_configured and self.coolify_log_token.get_secret_value().strip()
        )

    # --- GitHub (nur LESEN) ---------------------------------------------------
    # Beantwortet im Deploy-Monitor die Frage „was liegt zwischen dem
    # ausgerollten Stand und main?". Ausschließlich lesend: ein Fine-grained
    # Token mit `contents: read` auf DIESES eine Repo reicht. Fehlt er, sagt der
    # Monitor „nicht abrufbar" — er behauptet nicht, alles sei ausgerollt
    # (Wurzel 4: eine 0 wäre eine Aussage, die wir ohne Abruf nicht haben).
    github_token: SecretStr = SecretStr("")
    github_repo: str = "Nextdays-AirSmil/NextDays"

    @property
    def github_configured(self) -> bool:
        """Rückstands-Anzeige ist nutzbar, wenn Token UND Repo gesetzt sind."""
        return bool(
            self.github_token.get_secret_value().strip() and self.github_repo.strip()
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
    def mail_sandbox(self) -> bool:
        """Ob der Versand nur geloggt statt real zugestellt wird.

        Fail-CLOSED lokal (Wurzel 5): auf dem Entwicklerrechner ist die Sandbox an,
        OHNE dass jemand daran denken muss. Der Riegel hing vorher an einer eigenen
        Variable mit Default `False`; wer sie in seiner `.env` nicht setzte, aber die
        echten SMTP-Daten drin hatte, versendete von lokal aus über den
        Produktions-Mailserver. Real passiert (18.08.2026): 70 Mails aus Testläufen
        an die Fixture-Adressen `vater@example.dk`/`a@b.de` gingen DKIM-signiert
        raus und blieben tagelang in der Postfix-Queue hängen — Reputationsschaden
        für eine Domain, deren DMARC-Berichte bis dahin sauber waren.

        `MAIL_SANDBOX_OVERRIDE` hebt das bewusst auf (echter Versand von lokal);
        ausserhalb von `local` entscheidet es allein, Default aus = echter Versand.
        """
        if self.mail_sandbox_override is not None:
            return self.mail_sandbox_override
        return self.is_local

    @property
    def captcha_configured(self) -> bool:
        """Bewertung ist möglich, wenn Projekt, API-Schlüssel UND Site-Key stehen.

        Alle drei sind nötig: ohne Projekt gibt es keinen Endpunkt, ohne
        API-Schlüssel keinen Zugang, und ohne Site-Key kann Google das Token
        nicht der richtigen Kennung zuordnen (jedes Token gilt dann als
        ungültig). Fehlt eins, ist der Schutz NICHT vorhanden — das entscheidet
        `captcha_sandbox`, nicht ein stilles Durchlassen.
        """
        return bool(
            self.recaptcha_project_id.strip()
            and self.recaptcha_api_key.get_secret_value().strip()
            and self.recaptcha_site_key.strip()
        )

    @property
    def captcha_sandbox(self) -> bool:
        """Ob das Token nur protokolliert statt bei Google bewertet wird.

        Lokal an, ohne dass jemand daran denken muss — dieselbe Bauart wie
        `mail_sandbox` und aus demselben Grund: auf dem Entwicklerrechner gibt es
        keine reCAPTCHA-Schlüssel, und ein Formular, das lokal grundsätzlich 503
        antwortet, wird nicht getestet.

        AUSSERHALB von `local` gibt es KEINE Sandbox aus Versehen: dort
        entscheidet allein `CAPTCHA_SANDBOX_OVERRIDE`, Default aus. Fehlen die
        Schlüssel in Produktion, ist das ein Konfigurationsfehler und das
        Formular sagt das (503) — es nimmt nicht ungeprüft an (Wurzel 5).
        """
        if self.captcha_sandbox_override is not None:
            return self.captcha_sandbox_override
        return self.is_local

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
