# Übergabe: Partnerprogramm Etappe 6 — Reichweite je Kanal und Beitrag

**Stand 02.09.2026, 09:30.** Code komplett gebaut, geprüft, Migration 0521 in
der Staging-DB eingespielt. **Nichts committet, nichts deployt.** Offen ist
ausschließlich Auftrags-Abschnitt 2: die Anträge in den drei Entwickler-
Portalen (TikTok, Meta, Google Cloud). Die Sitzung endete, weil Claude Chrome
nicht mitten in einer Sitzung geladen werden kann — Neustart mit
`claude --continue --chrome`.

---

## Zwischenstand 02.09.2026, ~11:40 — TikTok fast fertig, Sitzung durch Auto-Mode blockiert

TikTok (über Claude Chrome, Konto `mynextdays` / developer@mynextdays.dk):
- Organisation **myNextDays ApS** angelegt (Org-ID 7680828328505295892, Rolle Owner).
- App **myNextDays Partner** angelegt (App-ID 7680791416944642069, Typ „Other"),
  Portal: https://developers.tiktok.com/app/7680791416944642069/pending
- Domain **mynextdays.com per DNS-TXT verifiziert** (deckt alle Subdomains, also
  auch partner.mynextdays.com). TXT liegt bei DanDomain.
- Im Formular ausgefüllt (UNGESPEICHERT, weil TikTok das Speichern blockiert,
  solange ein Fehler offen ist): Icon 1024² (aus mobile-nextdays AppIcon-1024),
  Kategorie „Geschäft", Beschreibung (en), AGB-/Datenschutz-URL, Plattform Web
  mit URL https://partner.mynextdays.com, Produkt Login Kit mit Redirect-URI
  `https://partner.mynextdays.com/api/auth/tiktok/callback` (localhost wird
  abgelehnt: nur https), Scopes user.info.basic/profile/stats + video.list,
  Prüf-Erklärungstext (~1000 Zeichen, en).
- **Einziger offener Fehler: Demo-Video (mp4/mov, ≤ 50 MB) fehlt.** Ohne Video
  kein Speichern, kein Einreichen. Der Tab muss offen bleiben, sonst ist die
  Eingabe weg. Nutzer wünscht: „erstelle ein video aber denke dran das es
  nicht ewig dauert".
- Client Key/Secret stehen im Portal (Augen-Symbol), **noch NICHT in
  `apps/api/.env`** — die Erweiterung blockt das Auslesen von Secrets, ein
  lokaler Empfänger wurde vom Auto-Mode-Classifier blockiert. Nutzer trägt
  `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` selbst ein.
- Aufräumen: ein Test-Empfänger `python3 empfaenger.py` lauscht evtl. noch auf
  127.0.0.1:3499 (Scratchpad) → `pkill -f empfaenger.py`.
- Nach dem Blocker konnte Bash nicht mehr ausgeführt werden (Classifier feuert
  für den Rest der Sitzung) → neue Sitzung nötig.

Meta und Google Cloud: noch nicht begonnen.

---

## Was der Nutzer will (wörtlich, mehrfach)

Die Portalarbeit **nur über Claude Chrome** (Werkzeuge `mcp__claude-in-chrome__*`,
seine eingeloggten Tabs). Ausgeschlossen: Skill `seite-auslesen`, Playwright,
AppleScript, Debug-Port-Chrome mit eigenem Profil, verschachtelte `claude -p`-
Aufrufe (der Permission-Classifier blockiert sie). Keine Rückfragen zur
Methode mehr — sofort mit TikTok beginnen; der Nutzer ist dort eingeloggt.

Regeln dabei (Auftrag, Abschnitt 0):
- Vor jedem Klick, der etwas anlegt oder absendet: Seitenzustand lesen und kurz
  melden, was gleich passiert; Formularwerte vor dem Absenden anzeigen.
- Nichts löschen.
- Secrets (Client Key/Secret, App-Secret, Token) **nie** in Repo, Doku oder
  Chat — direkt in `apps/api/.env` (git-ignoriert) eintragen, im Chat nur
  „gesetzt" melden.
- 2FA-Abfrage oder Zahlung → anhalten, Nutzer fragen.
- Status und genannte Bearbeitungszeit je Portal in
  `docs/AFFILIATE-PROGRAMM-PLAN.md` → „Betrieb — Plattform-Apps" nachtragen.

## Die drei Portale — Reihenfolge und Werte

### 1. TikTok for Developers — https://developers.tiktok.com
- App neu anlegen: Name **„myNextDays Partner"**, Kategorie Marketing/Analytics.
- Beschreibung: „Partnerprogramm-Verwaltung: Lesen von Profil- und Video-
  Kennzahlen verbundener Creator-Konten mit deren Zustimmung."
- Produkte: **Login Kit** und **Display API**; Scopes `user.info.basic`,
  `user.info.profile`, `user.info.stats`, `video.list`. Research API nur, falls
  angeboten und ohne Zusatzkosten.
- Redirect-URIs: `https://partner.mynextdays.com/api/auth/tiktok/callback`,
  `http://localhost:3400/api/auth/tiktok/callback` (falls localhost erlaubt).
- Datenschutz `https://mynextdays.com/datenschutz`, Nutzungsbedingungen
  `https://mynextdays.com/agb`.
- Ergebnis → `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` in `apps/api/.env`.
  App zur Prüfung einreichen.

### 2. Meta for Developers — https://developers.facebook.com/apps
- Erst prüfen, ob eine myNextDays-App existiert (die WhatsApp-App:
  `WHATSAPP_APP_ID` in `apps/api/.env`); wenn ja, diese verwenden, sonst neu
  Typ „Business": **„myNextDays Partner"**.
- Produkte: **Facebook Login for Business** + **Instagram Graph API**.
  Berechtigungen: `instagram_basic`, `instagram_manage_insights`,
  `pages_show_list`, `pages_read_engagement` (`business_management` nur wenn für
  Insights nötig).
- Redirect-URIs: `https://partner.mynextdays.com/api/auth/meta/callback`,
  `http://localhost:3400/api/auth/meta/callback`.
- Pflichtangaben: Datenschutz `/datenschutz`, Nutzungsbedingungen `/agb`,
  **Datenlöschungs-URL `https://mynextdays.com/konto-loeschen`** (trägt seit
  heute den Partner-Hinweis in 24 Sprachen), App-Icon aus
  `marketing/public/marketing/brand/`, Kategorie.
- Ergebnis → `META_APP_ID`, `META_APP_SECRET` in `apps/api/.env`.
- Business-Verifizierung (myNextDays ApS, CVR 46615182) nur **prüfen bzw.
  starten**; Unterlagen nie selbst hochladen — geforderte Unterlagen dem
  Nutzer melden. App-Review: Beschreibung textlich ausfüllen, für einen
  Screencast den Nutzer bitten.

### 3. Google Cloud — Vertex-Projekt (Memory `vertex-gemini-eingerichtet`)
- **YouTube Data API v3** aktivieren.
- Den **bestehenden** OAuth-Client (`GOOGLE_OAUTH_CLIENT_ID`, dient auch dem
  GoTrue-Google-Login — dessen Redirect-URI **nicht** entfernen) um die URIs
  `https://partner.mynextdays.com/api/auth/youtube/callback` und
  `http://localhost:3400/api/auth/youtube/callback` ergänzen.
- OAuth-Zustimmungsbildschirm „Extern", Scope
  `https://www.googleapis.com/auth/youtube.readonly`, Testnutzer eintragen, bis
  die Verifizierung durch ist.
- Env ist schon da: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_SECRET` (das Setting
  im Code heißt bewusst `google_oauth_secret`, nicht `…client_secret`).

### 4. Danach
- Coolify-Env `META_APP_ID`/`META_APP_SECRET`, `TIKTOK_CLIENT_KEY`/`…_SECRET`
  für **`nextdays-api` UND `nextdays-worker`** per artisan tinker
  (`is_preview=false`; Muster im Memory `coolify-env-mehrzeilig-zerbricht-deploy`).
  `AFFILIATE_TOKEN_KEY` ist dort bereits gesetzt (identisch in beiden Apps,
  wirkt ab dem nächsten Deploy). `PARTNER_BASE_URL` fehlt in Coolify noch —
  die Coolify-App `nextdays-partner` existiert nicht (offen seit Etappe 4).
- Erster echter OAuth-Durchlauf mit YouTube gegen die lokale API: Partner-App
  `localhost:3400`, Demo-Partner `partner.demo@mynextdays.dk` (Passwort =
  `DEMO_PASSWORT` aus `apps/api/.env`) → Profil → „YouTube verbinden" →
  Zeile in `affiliate_channel_connections` + Snapshot in
  `affiliate_channel_snapshots` prüfen; Token-Erneuerung und Widerruf sind
  bisher nur mit Fake-Anbieter getestet.
- Kein Deploy, kein Commit ohne ausdrückliche Ansage.

## Was gebaut ist (zur Orientierung, alles uncommitted)

- **Migration `0521_affiliate_reichweite.sql`** (live): `affiliate_posts`,
  `affiliate_referrals.post_id`, `affiliate_channel_connections` (Token
  AES-GCM), `affiliate_channel_snapshots` (`measured_at` = Date-Header der
  Plattform), `affiliate_post_metrics`, `affiliate_reach_thresholds`
  (Schwellen als Daten, `value NULL` = Regel aus). RLS + revoke + deny-all
  live verifiziert. Der Runner hat dabei auch `0522` (Stripe Connect, andere
  Sitzung) mit angewendet.
- **Backend** `apps/api/src/features/affiliates/`: `beitraege.py`,
  `kanal_krypto.py`, `kanal_plattformen.py` (YouTube/Meta/TikTok, nur lesend),
  `kanal_verbindungen.py`, `reichweite.py`, `router_reichweite.py`,
  `schemas_reichweite.py`, `mails_reichweite.py`; Mailtexte
  `core/mail_texte_partner_reichweite.py` (24 Sprachen); Tageslauf
  `jobs/partner_reichweite_laeufe.py` (über den stündlichen
  `partner_laeufe.tick`, 20 h Mindestabstand). Berührungspunkte im Fremdcode:
  `schemas.SocialKanal` (+`followers_self_reported`, `verified`, `verified_at`,
  `connection_id`), `attribution.zuordnen` (post_id), `router.me_aendern`
  (`kanaele_abgleichen`), `main.py`, `ratelimit_middleware` (Bucket
  `partner_kanal` 10/60), `mail_texte.py`, `config.py`, `.env.example`,
  `pyproject.toml` (`cryptography` explizit).
- **Partner-App**: `/beitraege` (Link-Generator, QR, Kennzahlen), Profil
  „Verbundene Konten", `app/api/auth/[provider]/callback`,
  `app/api/beitraege/[id]/qr`; Nav-Punkt; 24 Sprachen.
- **Backoffice**: `/partner/reichweite` (verifiziert vs. Selbstauskunft,
  Top-Kanäle, Top-Beiträge, Schwellen editierbar) + Abschnitt im Partner-Detail.
- **Rechtstexte**: Datenschutz-Abschnitt „Partnerprogramm" in 24 Sprachen
  (fehlte vorher komplett in 22), Partner-AGB § 1/§ 9 (de/en),
  `/konto-loeschen` mit Partner-Hinweis.
- **Doku**: `docs/AFFILIATE-PROGRAMM-PLAN.md` (Datenmodell, Etappe 6, Betrieb),
  `docs/API.md`, `deploy/ENVIRONMENT.md`.
- **Gates** (grün): pytest Slice+Core 377, ruff, pylint 10.00, `tsc`+`lint`
  in partner/admin/marketing, `db-trigger-pruefen.sh`, `abos-pruefen.sh`,
  `pruefe-rechtstexte.mjs`; Live-Klickprüfung im Debug-Chrome (Beitrag,
  Klick, QR, Callback-Fehlerpfad, Schwelle mit Audit).

## Achtung — parallele Sitzung

Eine zweite Sitzung arbeitete gleichzeitig im Slice (Mixin-Ausgliederung,
Migrationen 0522/0523, Video-Freigabe an Beiträgen `review_status`). Vor
Änderungen an `service.py`, `schemas.py`, `router.py`, `beitrag-karte.tsx`,
`partner/lib/reichweite.ts` erst `git status`/Dateistand lesen.
