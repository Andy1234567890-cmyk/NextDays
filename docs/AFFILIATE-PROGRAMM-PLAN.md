# Affiliate-Programm myNextDays — Plan (freigegeben 02.09.2026, umgesetzt: Etappen 1–4)

Stand: 02.09.2026. Grundlage: vier Recherchen (PMS-Wettbewerber, Affiliate-
Software-Standard, EU-Recht DE/DK, Codebase-Bestand). Quellen am Ende.

**Umsetzungsstand (02.09.2026):** Etappen 1–4 gebaut (Migrationen 0517/0518,
Slice `features/affiliates`, web-Signup-Feld, marketing `/partner` + `/p/[code]`,
admin `/partner`, App `partner/`, Chat über Support-Welt „Partner"). Entscheidung
festgehalten in ADR-0020. Offen: Coolify-App `nextdays-partner` anlegen,
Partner-Bedingungen/Gutschrift-Vorlage (Anwalt/Steuerberater), Videos,
Etappe 5 (Chat Partner ↔ Betrieb, Stripe Connect, Mobile).

## 1. Was gebaut werden soll (Verständnis des Zettels)

Partner (Influencer, Berater, Agenturen, Bestandskunden) werben neue Betriebe
(Tenants). Sie erhalten **12 Monate** lang einen Anteil am Abo-Umsatz jedes
geworbenen Betriebs, gestaffelt nach Anzahl geworbener Kunden:

| Rang        | geworbene Kunden | Provision |
|-------------|------------------|-----------|
| Einsteiger  | bis 5            | 15 %      |
| Aufsteiger  | 6 – 20           | 20 %      |
| Semi Super  | 21 – 50          | 25 %      |
| Super       | ab 51 (100 = Ziel) | 30 % (Maximum) |

→ **Frage 1:** Lesart „Max" = Obergrenze des Rangs (wie oben) oder Schwelle,
ab der der Rang erreicht wird (5 → 15 %, 20 → 20 % …; dann: was gilt bei 1–4)?

Dazu: eigenes Partner-Dashboard (wie Amway: Übersicht über „ihre Leute",
Chat), Marketing-Material (10-Sek-Video Influencer, 60–120-Sek-Erklärvideo).

**Marktvergleich (belegt):** Hostaway 20 %/12 Mon., Lodgify 20–30 %/12 Mon.
gestaffelt, Uplisting 30 %/12 Mon., OwnerRez 30 % Jahr 1. Unsere Staffel liegt
im oberen Branchenrahmen. Jede öffentliche AGB verbietet Selbstwerbung und
Brand-Bidding; Clawback bei Storno ist Standard (Hostaway, Lodgify, Smoobu).

## 2. Produktentscheidungen (Vorschlag — bitte bestätigen/ändern)

| # | Punkt | Vorschlag | Warum |
|---|-------|-----------|-------|
| 2 | Stufen | ~~einstufig~~ → **zweistufig** (Beschluss 02.09.2026, 0520): Override 1/2/3,5/5 % nach eigenem Rang auf Team-Kunden, ~~eine Ebene~~ → **alle Ebenen als Roll-up** (Strukturvertrieb, 0533, 03.09.2026; ADR-0020 Ergänzung), kein Teilnahmebeitrag — Leitplanken in ADR-0020 | Kein Teilnahmebeitrag + Vergütung 100 % aus echtem Abo-Umsatz → UCPD Anh. I Nr. 14, § 16 II UWG, spilleloven § 24 greifen nach Wortlaut nicht. Zweistufig (Verdienst an Unter-Partnern) ist rechtlich anders zu bewerten (Kettenelement) → nur mit Anwalt |
| 3 | „Chat mit ihren Leuten" | (a) Partner ↔ myNextDays-Partnerteam (Pflicht) · (b) Partner ↔ geworbener Betrieb **nur mit Opt-in des Betriebs** bei Registrierung („mein Empfehler darf mich kontaktieren") · (c) Sub-Partner entfällt bei einstufig | Amway/Herbalife haben real KEINEN eigenen Chat (Deep-Links zu WhatsApp); Rewardful zeigt Kunden nur pseudonym, E-Mail nie. (b) ist das Alleinstellungsmerkmal, braucht aber die Einwilligung des Betriebs (DSGVO Zweckbindung) |
| 4 | Was zählt als „Kunde" | Betrieb mit ≥ 1 **bezahlter** Abo-Rechnung, Abo aktiv/past_due; Test-/Demo-/interne Konten nie | Lodgify: 30 Tage aktiv; OwnerRez: erst bei Zahlung. Registrierung allein zählt nicht (sonst Bot-Anmeldungen = Rang) |
| 5 | Rangbewertung | monatlich zum Stichtag; Aufstieg sofort; **Rückstufung** erst nach 2 Stichtagen unter der Schwelle | Ein einzelner Churn stuft sonst sofort |
| 6 | Welcher Satz gilt | Satz des Partners **zum Rechnungszeitpunkt**, für alle seine laufenden 12-Monats-Fenster; nie rückwirkend auf verbuchte Zeilen | FirstPromoter/UpPromote-Praxis; jede Ledger-Zeile speichert `rate` + `tier` (wie `dynpricing_ledger.rate`) |
| 7 | Provisionsbasis | Netto (ohne MwSt, nach Rabatt) der **Abo-Positionen** (Grundtarif + Module). NICHT: OTA-Provisions-Posten (1 %/0,5 % `commission_ledger`, liegen auf DERSELBEN Stripe-Rechnung), Zusatzleistungen, Nachberechnungen | Hostaway: „Net Revenue ohne Add-ons/Onboarding/Steuern". Positionen per `lookup_key` der Abo-Preise filtern, nicht Rechnungssumme |
| 8 | 12 Monate ab | erster bezahlter Abo-Rechnung (`0504` Abo-Beginn) | Lodgify: „from first subscription" |
| 9 | Karenz/Clawback | Zeile `pending` → `approved` nach 30 Tagen; Refund/Chargeback/Gutschrift = **negative Gegenzeile**, Saldo kann negativ werden und wird verrechnet; nie Rückforderung vom Konto | Rewardful 30 Tage pending; FirstPromoter negative Provisionen; entspricht unserem Storno-Wasserfall (`payouts/README`) |
| 10 | Auszahlung Stufe 1 | monatlich NET-30 nach Monatsende, Mindestbetrag 50 (in der jeweiligen Währung, konfigurierbar, nicht hartcodiert), **je Währung ein Lauf, keine Umrechnung**; Backoffice erzeugt Wise-Batch-CSV / SEPA-Liste + Gutschrift-PDF (Self-Billing, DK momsloven § 52a „selvfakturering") | Stripe Global Payouts gibt es für DK nicht; Connect-Konten kosten 15 kr/Monat je aktivem Konto → erst ab Volumen (Stufe 2) |
| 11 | Auszahlung Stufe 2 | Stripe Connect Accounts v2 `recipient` (nur `transfers`), KYC durch Stripe (14 Felder für DK-Privatperson) | erst wenn > ~50 aktive Partner |
| 12 | Bestandskunden als Partner | **ja**, aber Selbstwerbung/eigene Firmengruppe ausgeschlossen; Programmteilnahme darf KEIN Abo voraussetzen | Uplisting/OwnerRez ja, Lodgify nein. Anwaltspunkt: § 16 II UWG „Abnahme" vermeiden |
| 13 | Freigabe | manuell im Backoffice (`pending_review` → `approved`), Formular mit reCAPTCHA, Website/Kanal Pflicht | FirstPromoter-Standard; Hospitable (Sofortzugang) ist die Ausnahme |
| 14 | Attribution | `?ref=CODE` wird als URL-Parameter bis zum Registrierungsformular durchgereicht und dort **sichtbar** im Feld „Empfohlen von" gezeigt; zusätzlich Cookie 60 Tage NUR bei Marketing-Einwilligung (bestehendes Consent-Banner). Zuordnung ist einmalig je Betrieb (UNIQUE), Last-Click, spätere Codes ändern nichts | EDPB 2/2023 Rn. 49–51: Klick-Cookie UND Tracking-Link fallen unter Art. 5(3) ePrivacy → einwilligungspflichtig; händisch bestätigter Code im Formular ist nicht berührt. Vorbefüllung = Grauzone → Anwalt |
| 15 | Was der Partner sieht | je Kunde: Pseudonym (`Kunde #17`), Land, Status (registriert / zahlend / gekündigt), Datum, Provisionsbetrag. Firmenname nur, wenn der Betrieb bei Registrierung zustimmt (siehe 3b) | Rewardful-Standard; Datenminimierung |
| 16 | Kennzeichnungspflicht | Dashboard liefert je Sprache die Pflicht-Wortlaute („Werbung" / „Reklame for myNextDays" / „Reklamelink") und verpflichtet in den Partner-AGB | § 5a IV UWG (Provision = Gegenleistung, vermutet), DK mfl. § 6 stk. 4; Forbrugerombudsmanden verwarnt aktiv (10/2024). Wir haften in DK als „medvirker" |
| 17 | Steuerdaten | bei Bewerbung: Rechtsform, Land, USt-IdNr. (VIES-geprüft, Pflicht für Unternehmer) oder „Privatperson"; Gutschrift mit Reverse-Charge-Vermerk bzw. ohne USt; Hinweis „selbst zu versteuern"; DK-Privatpersonen: B-indkomst-Meldung (CPR) | DAC7 gilt NICHT (§ 3/§ 5 PStTG: Werbeleistung an uns, kein Rechtsgeschäft über die Plattform). Steuerberater muss Gutschrift-Vorlage freigeben |
| 18 | Marke | Partner-Dashboard, Seite, Mails = **myNextDays** (der Betrieb ist Kunde) | CLAUDE.md Zwei Marken |

## 3. Bestand (verifiziert) — was existiert, was fehlt

Nichts zu Affiliate/Referral existiert (Code, DB, Doku, i18n). Vorbilder im Repo:

| Baustein | Vorbild |
|---|---|
| Tenant-lose Nutzerwelt | `portal_guests` + ADR-0015/0017: eigene Tabelle, `GuestContext`/`CurrentGuest` (`core/security.py:317-364`), eigene App + Subdomain, `__Host-`-Cookie, `aud`-Claim |
| Freigabe/Sperre | `platform_admins` (0202): `active`-Flag, DB-geprüft, Audit-Log |
| Ledger mit Satz + Währung | `dynpricing_ledger` (0277): `rate numeric(5,4)`, `currency` Pflicht, RLS + revoke + restrictive |
| Umsatz-Trigger | `invoice.paid` kommt an (`payments/webhook.py:249`), `_handle_invoice_event` (Z. 428-459) wertet aber **keine Beträge** aus → Erweiterung nötig |
| Karenz | `payout_settings.karenz_tage` (0411), `payouts/faelligkeit.py` |
| Chat | `support_tickets`/`support_messages` (0204/0236): Lese-Cursor, `client_msg_id`, Realtime private Channels; 0238 zeigt, wie eine dritte Melder-Welt eingehängt wird (CHECK „genau eine Welt") |
| Backoffice-Liste/Detail | `admin/app/(backoffice)/betriebe/page.tsx` + Layout-Guard; **kein i18n** in admin (deutsch) |
| Öffentliche Seite + Formular | `marketing/app/kontakt` + Slice `contact` (reCAPTCHA Enterprise fail-closed), 24 Sprachen |
| Mails | `core/mail_texte.py` — jeder Schlüssel in 24 Sprachen, Test erzwingt es |
| Registrierung | `POST /auth/register`, `RegisterRequest` (`auth/schemas.py:69-98`) — ohne `referral_code`; `SIGNUP_URL` (`marketing/lib/app-url.ts:73`) ohne Query |

Lücken: `load_scoped` scopet auf `tenant_id` — Affiliate-Welt braucht ein
Gegenstück (`load_scoped_by(db, table, id, column, value)`), kein inline-Check.

## 4. Architektur

### 4.1 Datenmodell (Migration 0517 ff., alle Tabellen RLS + `revoke all from anon, authenticated` + restrictive; Lesen/Schreiben nur über FastAPI/service_role; Realtime nur für Chat-Tabellen)

```
affiliate_tiers            id, name, min_customers, max_customers null, rate numeric(5,4), sort — Seed aus Zettel, nie im Code hartcodiert
affiliates                 id, email unique, password_hash, full_name, company, legal_form (company|private),
                           country, vat_id, vat_id_verified_at, language, payout_method (wise|sepa|paypal),
                           payout_details (verschlüsselt), status (pending_review|approved|suspended|rejected),
                           current_tier_id, channel_url, source, aud='affiliate', created/approved/reviewed_by
affiliate_referral_codes   id, affiliate_id, code unique (kurz, lesbar), active
affiliate_clicks           id, code_id, click_id, ip_hash, ua_hash, referrer, utm jsonb, landing, created_at (Retention 90 Tage)
affiliate_referrals        id, affiliate_id, tenant_id UNIQUE, code_id, click_id, method (url|code|cookie|manual),
                           status (pending|approved|rejected|held), flags jsonb (self_referral, same_domain, paid_source…),
                           first_paid_at, commission_until (= first_paid_at + 12 Mon.), contact_opt_in bool, reviewed_by/at
affiliate_commissions      append-only: id, referral_id, affiliate_id, stripe_invoice_id, stripe_event_id UNIQUE, kind (earn|reversal|adjustment),
                           parent_id, base_amount, currency, rate, tier_id, amount, status (pending|approved|held|paid|reversed),
                           matures_at, payout_id, period (YYYY-MM), reason;  UNIQUE (stripe_invoice_id, kind) WHERE kind='earn'
affiliate_payouts          id, affiliate_id, currency, amount, method, external_ref, status (pending|processing|paid|failed),
                           period_from/to, statement_pdf_path
affiliate_payout_items     payout_id, commission_id
affiliate_tier_history     affiliate_id, tier_id, valid_from, valid_to, customers_at_eval, trigger (auto|manual), by
affiliate_assets           id, kind (video|banner|text|guide), title, language, storage_path, sort
support_tickets            + affiliate_id (dritte Melder-Welt wie 0238), CHECK genau eine Welt
tenants                    + referral_id? NEIN — Zuordnung lebt nur in affiliate_referrals (eine Wahrheit)
```

Etappe 6 — Reichweite (Migration 0521, dieselbe Härtung; Token AES-GCM mit `AFFILIATE_TOKEN_KEY`):

```
affiliate_posts                id, affiliate_id, code_id, platform, url null, title, utm_content (UNIQUE je code_id),
                               external_post_id, published_at (Angabe des Partners), created/updated_at
affiliate_referrals            + post_id → affiliate_posts (beim Anlegen aus click.utm.utm_content aufgelöst;
                               bleibt, wenn der Klick nach 90 Tagen gelöscht ist)
affiliate_channel_connections  id, affiliate_id, provider (youtube|meta|tiktok), platform (youtube|instagram|facebook|tiktok),
                               external_account_id, account_name/url, access_token_enc, refresh_token_enc, token_expires_at,
                               scopes, connected_at, revoked_at/reason, last_sync_at, last_error;
                               UNIQUE (affiliate_id, platform, external_account_id)
affiliate_channel_snapshots    connection_id, affiliate_id, platform, measured_at (Date-Header der Plattformantwort, Wurzel 5b),
                               snapshot_date UNIQUE je connection, followers, views_28d, engagement_rate, posts_count, raw
affiliate_post_metrics         post_id, measured_at, metric_date UNIQUE je post, views, likes, comments, shares, saves, raw
affiliate_reach_thresholds     key, value null (= Regel aus), description — Schwellen der Verdachtsflags als Daten
affiliates.channels[]          + followers_self_reported, verified, verified_at, connection_id (pflegt nur der Server)
```

### 4.2 Backend (`apps/api/src/features/affiliates/`)
- `router.py` öffentlich: `POST /affiliates/apply` (reCAPTCHA), `POST /affiliates/auth/login|refresh|password-reset`, `GET /affiliates/r/{code}` (Klick zählen → Redirect auf marketing mit `?ref=`).
- `router.py` Partner (`CurrentAffiliate`, neuer `AffiliateContext` in `core/security.py`, JWT `aud=affiliate`): `/me`, `/dashboard` (Kennzahlen), `/customers` (pseudonym), `/commissions`, `/payouts`, `/tier`, `/assets`, `/links`, `/tax-profile`, Chat über Support-Slice.
- `attribution.py`: Registrierung nimmt `referral_code` (optional) in `RegisterRequest`; `AuthService.register` ruft `AffiliateAttribution.zuordnen(tenant_id, code, click_id, email, ip)` — deterministische Betrugsregeln (gleiche E-Mail/Domain außer Freemailer, gleiche IP/24, später gleiche Karten-Fingerprint) → `held` + Flag, nie stumm verwerfen.
- `provision.py`: Hook in `_handle_invoice_event` bei `invoice.paid`: Abo-Positionen per `lookup_key` filtern, `total_excluding_tax`-Anteil, Zeile `earn` idempotent auf `(stripe_invoice_id, 'earn')`. `charge.refunded`, `credit_note.created`, `charge.dispute.*` → `reversal`. Nur innerhalb `commission_until`.
- `stufen.py`: monatlicher Worker-Job (`worker`): zählt zahlende Kunden je Partner, schreibt `tier_history`, Mail bei Aufstieg.
- `auszahlung.py`: monatlicher Lauf: `approved` + `matures_at <= now` je (Partner, Währung) ≥ Mindestbetrag → `payout` + Items, CSV (Wise Batch / SEPA), Gutschrift-PDF (Reverse-Charge / selvfakturering / Privat), Status `processing`; Backoffice bestätigt → `paid`.
- Mails (`mail_texte.py`, 24 Sprachen): Bewerbung eingegangen · freigegeben · abgelehnt · neuer Kunde registriert · Kunde zahlt (Provision läuft) · Rang erreicht · Auszahlung erstellt · Gutschrift.
- Debug/Diagnose (Pflicht): Slice-Health, Zähler je Attributionsweg, Log jeder Ablehnung mit Grund, Backoffice zeigt Flags.

### 4.3 Frontends
- **`partner/`** — neue Next.js-App (7. Frontend), `partner.mynextdays.com`, Marke myNextDays, `__Host-nd_partner`-Cookie, i18n wie marketing (24 Sprachen, `nd_locale`). Seiten: Übersicht (Klicks, Registrierungen, zahlende Kunden, offen/ausgezahlt, Rang + „noch X bis Aufsteiger") · Kunden · Provisionen · Auszahlungen · Links & Material (Videos, Banner, Texte, Pflicht-Kennzeichnung je Sprache) · Chat · Profil/Steuerdaten.
  Alternative: Route-Gruppe in `web` — verworfen, ADR-0015 verlangt für eine eigene Auth-Welt eigene App + Subdomain.
- **`marketing/`**: `/partner` (Programm, Staffel live aus `affiliate_tiers`, Bewerbungsformular nach Kontakt-Vorlage), `?ref=` an `SIGNUP_URL` durchreichen, Cookie nur mit Einwilligung.
- **`web/`**: Signup-Formular bekommt Feld „Empfohlen von (Code)" (vorbefüllt aus URL, sichtbar) + Häkchen „Mein Empfehler darf mich über myNextDays kontaktieren" (Punkt 3b).
- **`admin/`**: `/partner` — Bewerbungen (freigeben/ablehnen mit Grund), Liste/Detail (Referrals, Flags, Ledger, Tier-Verlauf, manuelle Zuordnung mit Audit), Auszahlungsläufe (CSV, Gutschrift, „bezahlt" bestätigen), Material verwalten, Chat-Konsole (Support-Konsole erweitert um Welt „Partner").

### 4.4 Sicherheit (Wurzel 3/6/7/9)
- Alle Partner-Tabellen: kein Grant für anon/authenticated; Zugriff nur über FastAPI mit `CurrentAffiliate`; jeder `{id}`-Endpunkt scopet auf `affiliate_id` (`load_scoped_by`).
- Realtime nur für `support_*` mit Policy auf `affiliate_id = current_affiliate_id()` (Helper `security definer`, `search_path=''`, fail-closed).
- Rolle/Status immer frisch aus `affiliates` (suspended → sofort raus), nicht aus JWT.
- Auszahlungsdetails verschlüsselt; Änderung der Auszahlungsmethode nur mit Re-Auth + Mail.
- Eigener Rate-Limit-Bucket für `/apply`, `/r/{code}`, Login.

## 5. Etappen (Reihenfolge; jede Etappe endet mit Slice-Tests + Live-Beweis)

1. **Fundament** — Migration(en), `affiliate_tiers` Seed, Auth-Welt (`AffiliateContext`), Slice mit apply/login, Attribution im Register, `invoice.paid`-Provision + Reversals, Backoffice Bewerbungen/Freigabe, `/partner`-Seite marketing (24 Sprachen), `?ref=`-Durchreichung, Signup-Feld.
2. **Partner-App** — Übersicht, Kunden, Provisionen, Rang, Links/Material, Profil/Steuerdaten (VIES), Kennzeichnungs-Texte.
3. **Chat + Benachrichtigungen** — Support-Welt „Partner", Konsole im Backoffice, Mails (24 Sprachen), Glocke.
4. **Auszahlung** — Stufenjob, Auszahlungslauf, CSV Wise/SEPA, Gutschrift-PDF, Backoffice-Bestätigung.
5. **Später** — Chat Partner ↔ geworbener Betrieb (Opt-in), Stripe Connect recipient, Mobile (mobile-nextdays: Partner-Rolle? → eigene Entscheidung, ADR-0019).
6. **Reichweite (gebaut 02.09.2026, uncommitted)** — Stufe A: Beiträge mit eigenem Link (`utm_content`), Partner-Seite `/beitraege` (Link, QR, Klicks/Registrierungen/Kunden je Beitrag), Backoffice je Partner + Top-Beiträge. Stufe B: OAuth-Anbindung YouTube / Instagram+Facebook (Meta) / TikTok — `features/affiliates/kanal_plattformen.py` (nur lesende offizielle APIs), `kanal_verbindungen.py` (Token AES-GCM, signierter state, Trennen/Widerruf + Mail), Tageslauf `jobs/partner_reichweite_laeufe.py` (ein Snapshot je Kanal und Tag, Token-Erneuerung, `revoked_at` bei entzogenem Zugriff). Stufe C: `reichweite.py` — verifiziert vs. Selbstauskunft, Follower-Verlauf 90 T., Klicks je 1.000 Views, Flags mit Schwellen aus `affiliate_reach_thresholds` (Backoffice `/partner/reichweite`). Was die APIs ohne Analytics-Scope hergeben: Instagram Konto-Views 28 T.; YouTube/TikTok nur Views je Video (`views_28d` = Summe der in 28 T. veröffentlichten Videos); Facebook-Seite nur Follower.

Parallel, nicht Code: Partner-AGB + Gutschrift-Vorlage (Anwalt/Steuerberater —
offene Punkte: Handelsvertreterrecht § 84 HGB / handelsagentloven, Verfalls-
klauseln ggü. Privatpersonen, Vorbefüllung des Codes), zwei Videos produzieren.

## Betrieb — Plattform-Apps (Etappe 6)

Stand 02.09.2026, wird nach jedem Schritt in den Entwicklerportalen fortgeschrieben.

| Anbieter | App / Client | Status | Nächster Schritt |
| --- | --- | --- | --- |
| Google Cloud (YouTube Data API v3) | bestehender OAuth-Client `GOOGLE_OAUTH_CLIENT_ID` (deploy/ENVIRONMENT.md) — Redirect-URIs `…/api/auth/youtube/callback` (partner.mynextdays.com + localhost:3400) ergänzen, API aktivieren, Zustimmungsbildschirm „Extern" mit Testnutzern | offen (Portal-Schritt noch nicht ausgeführt) | im Google-Cloud-Portal erledigen; ohne Verifizierung nur Testnutzer |
| Meta for Developers | App „myNextDays Partner" (Typ Business), Produkte Facebook Login for Business + Instagram Graph API, Berechtigungen instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement | offen | App anlegen/prüfen, `META_APP_ID`/`META_APP_SECRET` in Coolify (api + worker), Datenlöschungs-URL `https://mynextdays.com/datenschutz/loeschung`, Business-Verifizierung (myNextDays ApS, CVR 46615182) prüfen, App-Review einreichen |
| TikTok for Developers | App „myNextDays Partner", Login Kit + Display API (user.info.basic, user.info.profile, user.info.stats, video.list) | offen | App anlegen, `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`, zur Prüfung einreichen |

Rechtstexte: der Datenschutz-Abschnitt „Partnerprogramm" (inkl. verbundene Konten/Beiträge) steht seit 02.09.2026 in allen 24 Sprachen (22 per Gemini mit juristischem Prompt, Plausibilitätsprüfung auf Marken/URLs/Artikelbezug — vorher fehlte der ganze Abschnitt in 22 Sprachen); Partner-AGB § 1/§ 9 nur de/en (die AGB gibt es nur in diesen beiden).

Env je Anbieter fehlt → Anbieter im Dashboard „bald verfügbar", Log `partner_kanal_anbieter_nicht_konfiguriert` nennt die Variable. `AFFILIATE_TOKEN_KEY` (32 Byte base64) ist Pflicht für jede Anbindung — in Coolify für **api UND worker** setzen (derselbe Wert, sonst kann der Worker die Token nicht lesen). Stand 02.09.2026: in Coolify für `nextdays-api` und `nextdays-worker` gesetzt (identisch, `is_preview=false`), wirkt ab dem nächsten Deploy — geprüft dann mit `docker exec <api> env | grep -c AFFILIATE_TOKEN_KEY`. `PARTNER_BASE_URL` fehlt in Coolify weiterhin (Coolify-App `nextdays-partner` noch nicht angelegt) — ohne sie liefert `/channels/{provider}/authorize` 503.

## 6. Offene Fragen an dich (vor dem Bau)

1. Staffel-Lesart (Abschnitt 1) und Satz bei 1–4 Kunden.
2. Einstufig (Vorschlag) oder zweistufig?
3. Chat: nur Partner ↔ Team, oder auch Partner ↔ geworbener Betrieb (mit Opt-in)?
4. Rückstufung erlaubt (Vorschlag: ja, nach 2 Stichtagen)?
5. Provisionsbasis nur Abo-Positionen (Vorschlag) — oder auch OTA-Provisionsposten/Zusatzleistungen?
6. Mindestauszahlung 50 / NET-30 / je Währung ohne Umrechnung — ok?
7. Bestandskunden dürfen Partner sein (Vorschlag: ja)?
8. Eigene App `partner/` (Vorschlag) — ok?
9. Auszahlungsweg Stufe 1: Wise-Batch-CSV + SEPA-Liste manuell — ok, oder von Anfang an Stripe Connect?

## 7. Master-Strategie (Zettel vom 02.09.2026) — Abgleich mit dem Bestand und Etappe 7 (FREIGABE 02.09.2026, GEBAUT 7a–7h, Migrationen 0525–0527 LIVE in Staging, uncommitted)

### 7.1 Was der Zettel will (Verständnis)

Vier Ränge nach **Struktur**-Kundenzahl (eigene + Team), Untervermittler erst ab
Rang 2, einmaliger Aufstiegsbonus je erreichtem Rang ab Rang 2, **Differenz**-
Provision auf Team-Kunden statt festem Override, 12 Monate ab erstem
zahlungspflichtigen Monat, **Superprovision** 2,5 % lebenslang ab Rang 4 auf die
ganze Struktur, **Markt-Turbo** 0,5 % des Buchungswerts aller myBestDays-
Buchungen der Struktur, Gratismonat nach der Testphase für geworbene Neukunden,
**Pflichtlistung** jedes Objekts auf myBestDays, Content-Regeln (Vorab-Freigabe,
nur offizielles Material, keine Garantieversprechen), Lead-Liste möglicher
Multiplikatoren im Backoffice.

### 7.2 Entscheidungen des Nutzers (02.09.2026)

| # | Frage | Entscheidung | Folge im Bau |
|---|---|---|---|
| 1 | Pflichtlistung myBestDays vs. CLAUDE.md „Kanal-Sichtbarkeit pro Kanal" | **Pflichtlistung.** Die Regel in CLAUDE.md wird ersetzt, das System entsprechend umgebaut | Schritt 7h; CLAUDE.md-Abschnitt „Vertriebskanäle" + ADR neu schreiben; Betriebs-AGB brauchen die Klausel (Anwalt) |
| 2 | Superprovision: wie lange? | **Solange der Partner Rang 4 hält** (Struktur ≥ 20 zahlende Kunden) | Prüfung am Rang zum Rechnungszeitpunkt; Rückstufung nach 2 Stichtagen unter 20 beendet sie für weitere Rechnungen, Wiederaufstieg startet sie wieder, kein Nachholen |
| 3 | Markt-Turbo: Direktkunden oder auch Team-Kunden? | **Auch Team-Kunden** | Eine Marktplatz-Buchung eines Team-Kunden zahlt 0,5 % an den Team-Partner UND 0,5 % an dessen Sponsor = 1 % des Buchungswerts (12,5 % unserer 8 %-Gebühr). Bewusst so |
| 4 | Superprovision additiv zu 30 % in Monat 1–12 | **Ja** (32,5 % auf eigene Kunden bei Rang 4) | keine Deckelung der Superprovision; der 30 %-Deckel gilt nur Standard + Differenz |
| 5 | Bonus-Währung | **Euro** für alle Partner | `affiliate_tier_bonuses` mit 50,00 EUR je Rang 2–4; Nicht-Euro-Partner bekommen eine EUR-Auszahlungszeile (Stripe-Transfer in EUR, Stripe rechnet auf die Kontowährung um) |
| 6 | Lead-Liste | **Im Backoffice bauen** | Schritt 7g ist Pflicht, nicht optional; Klarnamen kommen per Oberfläche/CSV in die DB, nie ins Repo |
| 7 | Rang-IDs `experte`/`elite` | **Ja** | Migration hängt `tier_id` um |

### 7.3 Abgleich — Zettel vs. gebaut

| # | Punkt | Zettel | Gebaut (Stand 02.09.2026) | Delta |
|---|---|---|---|---|
| 1 | Rang-Schwellen | 0–4 · ab 5 · ab 10 · ab 20 | 0–5 · 6–20 · 21–50 · ab 51 (`affiliate_tiers`, 0517) | Daten-Migration: neue Zeilen `einsteiger`/`aufsteiger`/`experte`/`elite`, `tier_id` der Partner und Provisionszeilen umhängen, alte IDs `semi_super`/`super` entfernen; Rangnamen in 24 Sprachen × 3 Apps (partner/admin/marketing) neu |
| 2 | Zählbasis Rang | Gesamtstruktur: eigene Direktkunden **plus** Kunden der Untervermittler, 1:1 | nur eigene zahlende Kunden (`stufen.zahlende_kunden_je_partner`) | Team-Kunden (eine Ebene, `sponsor_affiliate_id`) mitzählen; „Kunde" bleibt = bezahlt + Abo aktiv/past_due (Abschnitt 2 Punkt 4); Gratismonats-Kunden zählen erst ab erster Zahlung |
| 3 | Untervermittler | erst ab Rang 2 gestattet | jeder freigegebene Partner darf Sponsor sein (`attribution._sponsor_pruefen`) | Sponsor muss Rang ≥ `aufsteiger` haben — Sperre im Backend (Wurzel 3), Team-Link in der Partner-App erst ab Rang 2 sichtbar; bestehende Zuordnungen bleiben bei Rückstufung, nur neue werden gesperrt |
| 4 | Aufstiegsbonus | einmalig 50,00 € bei Erreichen von Rang 2, 3, 4 | nicht vorhanden | Provisionsart `bonus`; Tabelle `affiliate_tier_bonuses (tier_id, currency, amount)` mit 50,00 EUR für aufsteiger/experte/elite (Daten, kein Hardcode); UNIQUE `(affiliate_id, tier_id) where kind='bonus'` = einmal je Rang, auch nach Rückstufung und Wiederaufstieg nicht doppelt (Wurzel 2); Karenz 30 Tage; Mail „Rang erreicht" nennt den Bonus |
| 5 | Team-Provision | Differenz eigener Satz − Satz des Untervermittlers, Deckel 30 % gesamt | fester Override 1 / 2 / 3,5 / 5 % (`affiliate_tiers.override_rate`, 0520) | `provision.override_buchen`: `rate = max(0, sponsor.rate − partner.rate)` zum Rechnungszeitpunkt, beide Ränge an der Zeile; `override_rate` außer Dienst (0 + Kommentar, nicht löschen); Deckel automatisch erfüllt. **Folge:** Sponsor und Team-Partner im gleichen Rang → Differenz 0 |
| 6 | Laufzeit | 12 Monate ab erstem zahlungspflichtigen Monat | 12 Monate ab erster bezahlter Rechnung (`commission_until`) | passt mit Gratismonat als Trial (Punkt 9). Backstop: Rechnung mit Abo-Basis 0 setzt `first_paid_at` NICHT |
| 7 | Superprovision | ab Rang 4 2,5 % auf Netto-Umsatz der ganzen Struktur, solange der Kunde zahlt | nicht vorhanden | Provisionsart `lifetime`: je bezahlter Abo-Rechnung eines eigenen ODER Team-Kunden 2,5 % der Abo-Basis, **ohne** `commission_until`, Bedingung Rang `elite` zum Rechnungszeitpunkt (Entscheidung 2); ist der Team-Partner selbst Rang 4, bekommt er auf seine eigenen Kunden ebenfalls `lifetime` (dann 5 % auf diesen Kunden); Gegenbuchung/Chargeback wie `override`; UNIQUE `(parent_id, affiliate_id) where kind='lifetime'` |
| 8 | Markt-Turbo | 0,5 % des Gesamtbuchungswerts aller myBestDays-Buchungen, unbegrenzt | nicht vorhanden | Provisionsart `booking_share`: Hook im Payments-Webhook auf erfolgreiche Zahlung einer Buchung mit `channel='portal'` (Marktplatz-Strecke, `payments.service` ~1395) → Tenant → `affiliate_referrals` → Partner **und** dessen Sponsor (Entscheidung 3); Basis = Gastpreis brutto in **Buchungswährung** (Wurzel 4); UNIQUE `(stripe_charge_id, affiliate_id)`; Erstattung (0473) → negative Gegenzeile anteilig; keine Laufzeitgrenze, Karenz 30 Tage; Voraussetzung Referral `approved`, Betrieb aktiv; Rang egal |
| 9 | Gratismonat | Testphase 14 T. + erster voller Monat kostenlos für geworbene Neukunden; Provisionsfenster beginnt danach | Testphase 14 T. (`TESTPHASE_TAGE`), kein Zusatz | Checkout: liegt für den Tenant ein Referral (nicht `rejected`) → `trial_end` = heute + 14 T. + 1 Kalendermonat (`provision.plus_monate`) statt `trial_period_days`; einmalig je Tenant (UNIQUE `tenant_id` in `affiliate_referrals`); Anzeige auf `/p/CODE`, im Signup-Feld „Empfohlen von", Preisseite; kein Coupon (keine 0-€-Rechnung, `first_paid_at` bleibt richtig) |
| 10 | Pflichtlistung myBestDays | „automatisch und nicht abwählbar" | Kanal-Achse `listed_on_marketplace` (0159) mit Schalter in web (`property-channels.tsx`, `marketplace-detail.tsx`), Hebel in `channel_manager/objekt_verkauf.py`, Feld in `PropertyUpdate`, Open API v1, mobile-nextdays, gastgeber; Moderation (0203) und noindex (0194) getrennt | Schritt 7h: Flag wird serverseitig **immer true** für jedes Objekt (DB-Default + Trigger als Backstop gegen PostgREST-Direktschreiben, Wurzel 6); Schalter aus allen Oberflächen raus, Zustand „auf myBestDays gelistet · Freigabe: ausstehend/erteilt" bleibt sichtbar; `PropertyUpdate.listed_on_marketplace` → 422 wenn gesendet; Duplizieren setzt nicht mehr False; Open API liest weiter (immer true, Doku-Hinweis); Moderation durch den Betreiber bleibt die einzige Achse neben `status`; CLAUDE.md-Abschnitt + ADR-0021; Betriebs-AGB + Datenschutz-Hinweis (Anwalt); Hilfe-Artikel und `channelsTab.marketplace*`-Texte in 24 Sprachen |
| 11 | Vorab-Freigabe jedes Beitrags | Video ODER Beitrag vor Veröffentlichung vorlegen | Freigabe pro Video (0523), Link erst nach Freigabe | Bild-/Textbeiträge denselben Weg: Upload jpg/png/pdf zusätzlich zu mp4/mov/webm (Magic-Bytes); feste Ablehnungsgründe (Material, Versprechen, Kennzeichnung, Sonstiges) als Prüfliste |
| 12 | Nur offizielles Material | eigene Software-Aufnahmen verboten | Material-Bibliothek (`affiliate_assets`), AGB § 5/§ 6 ohne diesen Satz | Partner-AGB § 5: „ausschließlich bereitgestelltes Material, keine eigenen Bildschirmaufnahmen"; Prüfliste im Review |
| 13 | Keine Garantieversprechen | z. B. „Vollauslastung in 3 Tagen" | AGB § 6 verbietet Rekrutierungsversprechen; Kennzeichnungs-Wortlaute gebaut | AGB § 6 um Erfolgs-/Garantieversprechen ergänzen; Prüfliste |
| 14 | Multiplikatoren-Liste | ~20 Namen/Accounts DACH in 4 Kategorien | nichts | Backoffice-Tabelle `affiliate_leads` (Name, Organisation, Kategorie A–D, Kanäle/Handles, Reichweite, Status offen/kontaktiert/im Gespräch/gewonnen/abgelehnt, Verantwortlich, nächster Schritt + Datum, Notizen, Verknüpfung `affiliate_id` nach Gewinn) mit RLS + deny-all, nur platform_admin über FastAPI; CSV-Import; Seite `/partner/leads`. Klarnamen NICHT ins Repo |

Nicht berührt: Attribution, Auszahlung per Verbundkonto (0522), Reichweite (0521), Chat, Steuerdaten.

Rechtlicher Hinweis (kein Bau-Blocker, vor Launch): Struktur-Zählung +
Aufstiegsbonus + Differenz + lebenslange Struktur-Provision ist das Muster eines
mehrstufigen Vertriebs; Vergütung stammt weiterhin zu 100 % aus bezahltem Abo-/
Buchungsumsatz, kein Teilnahmebeitrag (Abschnitt 2 Punkt 2). Anwaltsprüfung der
Partner-AGB (ENTWURF) und der Pflichtlistungs-Klausel in den Betriebs-AGB.

### 7.4 Etappe 7 — Bauschritte (Reihenfolge)

| Schritt | Inhalt | Dateien |
|---|---|---|
| 7a Ränge & Struktur | Migration **0525**: Tiers neu (Schwellen/IDs/Namen), `tier_id` umhängen, `affiliate_tier_bonuses` (EUR 50), `kind`-CHECK um `bonus`/`lifetime`/`booking_share`, UNIQUE-Backstops, `override_rate` außer Dienst. `stufen.py`: Strukturzählung (eigene + Team), Aufstiegsbonus beim Rangwechsel nach oben. `attribution._sponsor_pruefen`: Rang ≥ aufsteiger. Rangnamen 24 Sprachen (Gemini) in partner/admin/marketing | `supabase/migrations/0525_*.sql`, `affiliates/stufen.py`, `attribution.py`, `schemas.py`, `router.py` (`/tiers` liefert Bonus mit), Übersetzungen |
| 7b Differenzprovision | `provision.override_buchen` → Differenz; Zeile trägt beide Ränge; Tests gleich/höher/niedriger; `partner-vergleich.tsx` Spalte „Team-Provision" → „Differenz zu deinem Rang" | `provision.py`, `team_service.py`, `marketing/components/partner/partner-vergleich.tsx`, Partner-AGB § 4 |
| 7c Superprovision | `verbuche_rechnung`: `lifetime`-Zeile für Rang-4-Partner (eigene Kunden) und Rang-4-Sponsor (Team-Kunden), ohne Laufzeit; `gegenbuchen`/`chargeback_*` nehmen sie mit; Provisionsart-Label in allen Kopien (`scripts/i18n/provisionsart-pruefen.mjs`) | `provision.py`, `schemas.py`, partner `/provisionen`, admin `/partner/[id]`, Mails |
| 7d Markt-Turbo | `provision.buchungsbeteiligung_buchen(charge)` für Partner + Sponsor, Hook im Payments-Webhook (nur `channel='portal'`), Erstattungs-Gegenzeile, Anzeige je Kunde („Buchungen über myBestDays") | `payments/webhook.py`, `provision.py`, Partner-App Kunden/Provisionen |
| 7e Gratismonat | `subscriptions.service`: `trial_end` statt `trial_period_days`, wenn Referral vorhanden; `first_paid_at`-Guard bei Basis 0; Texte auf `/p/CODE`, Signup, Preisseite, Partner-Landing (24 Sprachen) | `subscriptions/service.py`, `provision.py`, `web` Signup, `marketing` |
| 7f Rechtstexte & Prüfliste | Partner-AGB §§ 3–6 (Ränge, Bonus, Differenz, Super, Turbo, Materialpflicht, Garantieverbot) de+en, 22 → en; Video-Review: feste Ablehnungsgründe + Prüfliste; Bild-/Text-Upload | `marketing/content/legal/partner-agb/`, `video_freigabe.py`, `admin/components/partner-videos.tsx` |
| 7g Lead-Liste | Migration **0526** `affiliate_leads` (RLS + deny-all), Backoffice-Endpunkte CRUD + CSV-Import, Seite `/partner/leads` mit Filter Kategorie/Status, Verknüpfung zum Partner nach Gewinn | neue Migration, `router_backoffice.py`, `leads_service.py`, admin `/partner/leads` |
| 7h Pflichtlistung | Migration **0527**: `listed_on_marketplace` default true, alle Zeilen true, Trigger erzwingt true; Schalter/Hebel raus (web, mobile-nextdays, gastgeber, `objekt_verkauf.py`, `PropertyUpdate` → 422), Duplizieren, MCP-Katalog-Text, Open-API-Doku; CLAUDE.md „Vertriebskanäle" neu + ADR-0021; Betriebs-AGB-Klausel (Entwurf) + Hilfe-Artikel; Texte 24 Sprachen | `supabase/migrations/0527_*.sql`, `properties/schemas.py`+`service.py`, `channel_manager/objekt_verkauf.py`+`marktplatz.py`, `web/components/objekte/property-channels.tsx`, `web/components/channel-manager/marketplace-detail.tsx`, `apps/public-api` Doku, `CLAUDE.md`, `docs/adr` |

**Stand 02.09.2026 (gebaut):** 7a–7h komplett. Backend: `stufen.struktur_kunden_je_partner`,
`bonus_buchen`, `provision.override_buchen` (Differenz), `lifetime_buchen`,
`buchungsanteil_buchen` + Webhook-Hook `_partner_buchungsanteil`, `attribution.rang_darf_team_fuehren`,
`subscriptions/gratismonat.py`, `leads_service.py`, `video_freigabe.dateityp` (JPG/PNG/PDF),
`reason_code` in der Freigabe; `properties`-Trigger 0527. Frontends: partner (Kacheln Struktur/
Super/Turbo/Bonus, Team-Differenz, Datei-Upload, Ablehnungskategorie), admin (Leads-Seite,
Prüfliste, neue Provisionsarten), marketing (Vergleichstabelle mit Bonus/Super/Turbo, Hero-Chip
Gratismonat, Partner-AGB §§ 3–5 de+en, Hilfe-Artikel Pflichtkanal 24 Sprachen), web (Schalter
entfernt, Signup-Hinweis Gratismonat). Gates: affiliates 173 Tests grün (1 fremder TikTok-Env-
Test rot), properties/channel_manager/payments 1205 grün, subscriptions-Checkout-Tests grün,
public-api 107 grün, ruff/pylint 10 auf geänderten Modulen, tsc+lint partner/admin/marketing/web
grün, `provisionsart-pruefen.mjs` grün, `db-trigger-pruefen.sh` grün, `/affiliates/tiers` live
liefert die neue Staffel. Mit dem Lauf kam auch die fremde 0524 (owner_statements, Parallelsitzung)
live; der Slice owner_statements läuft dagegen grün (159 Tests). **Live-Beweis 02.09.2026 (Staging-DB, Demo-Partner):** Monatslauf `raenge_bewerten` läuft mit der neuen
Staffel (Struktur partner.demo = 2, kein Aufstieg, `bonus: 0`); `buchungsanteil_buchen` für MFA Testbetrieb
(Team-Kunde) erzeugt je 4,00 DKK für partner.team UND Sponsor partner.demo, für Nordlicht 4,00 DKK,
Redelivery → `duplikat`, Teilerstattung 50 % → zwei Gegenzeilen à −2,00 DKK (Charge-IDs
`ch_demo_masterstrategie_*`, bleiben als Demo-Daten). Bonus/Aufstieg live NICHT beweisbar, solange kein
Demo-Partner 5 Struktur-Kunden hat — durch 19 Slice-Tests abgedeckt. **Partner-AGB in 24 Sprachen**
(22 maschinell mit juristischem Prompt, alle ENTWURF, Loader ohne en-Rückfall). **Betriebs-AGB § 2:**
Pflichtlistungs-Klausel + Listenpunkt „Marktplatz myBestDays“ in 24 Sprachen, beide Kopien
(marketing + web). Anwaltliche Prüfung beider AGB steht aus. **Offen:** Coolify-Deploy, kein Commit.

Gates je Schritt: Slice-Tests (`uv run pytest src/features/affiliates -q`, bei 7h
zusätzlich `properties` + `channel_manager`), ruff, pylint 10 auf geänderten
Modulen, tsc + lint in partner/admin/marketing/web, `provisionsart-pruefen.mjs`,
`db-trigger-pruefen.sh` nach 0525/0527, Live-Beweis mit den Demo-Partnern
(`partner.demo@` Rang-Aufstieg + Bonus, `partner.team@` Differenz 0 vs. > 0, eine
Marktplatz-Testbuchung → zwei `booking_share`-Zeilen). Kein Commit, kein Deploy
ohne Ansage.

## Quellen (Auswahl)
Wettbewerber: hostaway.com/affiliate-program-terms-and-conditions · lodgify.com/affiliates · uplisting.getrewardful.com/terms · ownerrez.com/support/articles/affiliate-program · smoobu.com TCs-Ambassador-Program-July-25.pdf · guesty.com/referral-program-terms-of-service · cloudbeds.com/terms/ambassadors
Software: help.rewardful.com (cookies, promotion codes, customer details, pay commissions) · help.firstpromoter.com (fraud protection, payouts, refund API) · support.partnerstack.com (tiers, cookie windows) · docs.tolt.com · docs.promotekit.com
Stripe: docs.stripe.com/api/invoices/object · docs.stripe.com/connect/separate-charges-and-transfers · docs.stripe.com/connect/accounts-v2 · docs.stripe.com/global-payouts (nur GB/US) · stripe.com/connect/pricing (DK)
Recht: EuGH C-515/12 (4finance) · gesetze-im-internet.de UWG Anhang Nr. 14, § 16, § 5a; UStG § 14, § 14a; PStTG § 3, § 5 · elov.dk markedsføringsloven bilag 1 · danskelove.dk spilleloven § 24, momsloven § 52a, mfl. § 6 · forbrugerombudsmanden.dk (MLM-Leitlinie 2013, Sociale medier, Pressemitteilung 09.10.2024) · EDPB Guidelines 2/2023 Rn. 49–51 · DSK OH Telemedien Rn. 76 · BGH I ZR 27/22 · wettbewerbszentrale.de Leitfaden Werbekennzeichnung 08/2024
MLM-Dashboards: App-Store Amway+, HL Bizworks, doTERRA Pro, LR Connect; rallyware.com; doterra.com prime-wellness-club-standings
Datenmodelle: github.com/Refferq/Refferq (prisma) · github.com/valeriansaliou/raider (raider.sql) · github.com/keithbrink/affiliates-spark
