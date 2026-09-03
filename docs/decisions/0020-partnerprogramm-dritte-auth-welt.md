# ADR-0020: Partnerprogramm als dritte Auth-Welt mit eigener App

- Status: **ANGENOMMEN** (2026-09-02)
- Grundlage: `docs/AFFILIATE-PROGRAMM-PLAN.md` (Recherche Wettbewerber,
  Affiliate-Software, EU-Recht DE/DK, Codebase-Bestand; Freigabe 02.09.2026)
- Betrifft: `apps/api/src/features/affiliates`, `partner/`, `marketing/app/partner`,
  `marketing/app/p/[code]`, `admin/app/(backoffice)/partner`, Migrationen `0517`–`0523`

## Frage

myNextDays braucht ein Partnerprogramm wie Lodgify/Hostaway: Partner
(Influencer, Berater, Agenturen, Bestandskunden) werben Betriebe und erhalten
einen Anteil am Abo-Umsatz. Wo lebt der Partner im System — als Betriebs-Nutzer
mit Sonderrolle, als Gast, oder als eigene Welt? Und wie wird ein Betrieb einem
Partner zugeordnet, ohne Tracking-Cookies?

## Entscheidung

**Der Partner ist die DRITTE Auth-Welt** neben Betriebs-Nutzer (`users`,
`tenant_id`) und Marktplatz-Gast (`portal_guests`) — mit eigenem GoTrue-Login,
eigener Stammdatentabelle (`affiliates`, `id == auth.uid()`), eigenem
Server-Kontext (`AffiliateContext`/`CurrentAffiliate` in `core/security.py`)
und eigener Next.js-App `partner/` auf eigener Subdomain (`partner.`) mit
host-only Cookie `__Host-nd_partner` (ADR-0015/0017 gelten unverändert).

Erkennungsmerkmal im Token ist `app_metadata.affiliate = true`; der Server
prüft zusätzlich bei jedem Request `affiliates.status` frisch aus der DB
(Wurzel 7). Ein Betriebs-Token (trägt `tenant_id`) oder ein Gast-Token (leeres
`app_metadata`) kommt an keinem Partner-Endpunkt durch.

**Zweistufig (Beschluss 02.09.2026, ersetzt die Einstufigkeit vom Vormittag
desselben Tages).** Ein Partner (Sponsor) kann ein Team aus geworbenen Partnern
führen und erhält auf den Netto-Abo-Umsatz der Team-Kunden einen Override nach
SEINEM Rang (`affiliate_tiers.override_rate`: 1 / 2 / 3,5 / 5 %), Migration
0520. Leitplanken, die das von einem Schneeballsystem (UCPD Anhang I Nr. 14,
§ 16 Abs. 2 UWG, spilleloven § 24) trennen und im Code erzwungen sind:
- **Kein Teilnahmebeitrag, kein Geld fürs Anwerben.** Der Override entsteht
  ausschließlich aus bezahlten Abo-Rechnungen echter Kunden (`invoice.paid`,
  `provision.override_buchen`), nie aus der Aufnahme eines Partners.
- **Genau eine Ebene.** *(Aufgehoben am 03.09.2026 — siehe Ergänzung am Ende.)* Ein Team-Partner baut kein eigenes Team; ein Partner
  mit Team wird kein Mitglied. DB-Trigger `affiliate_sponsor_eine_ebene` plus
  Fachprüfung in `attribution.sponsor_zuordnen`/`bo_sponsor_setzen`.
- **Der Rang entsteht nur aus eigenen Kunden** (`stufen.py` unverändert,
  Test `test_rang_zaehlt_nur_eigene_kunden`). Team-Kunden zählen nicht.
- **Beidseitige Freigabe.** Override `held`, wenn Sponsor oder Team-Partner
  nicht `approved` sind oder die Team-Zuordnung Betrugsflags trägt
  (`sponsor_flags`: gleiche E-Mail-Domain, gleiche IBAN).
- **Folgt der Ertragszeile** (Wurzel 1): `parent_id` auf den Ertrag des
  Team-Partners; Erstattung, Gutschrift und Chargeback nehmen den Override
  anteilig mit zurück; Unique-Backstop eine Override-Zeile je Ertrag.
- **Zuordnung einmalig und sichtbar** (`sponsor_code` in der Bewerbung,
  Team-Link `/p/CODE?team=1`), Umhängen nur im Backoffice mit Grund und Audit.
Die Team-Provision läuft durch denselben Auszahlungslauf und steht als Position
„Team-Provision" auf derselben Gutschrift. Chat Sponsor ↔ Team-Mitglied in
eigenen Tabellen (`affiliate_team_threads/_messages`, RLS nur Beteiligte,
Realtime), nicht in der Support-Welt. Anwaltsprüfung DE/DK der Partner-AGB
und der Staffel steht aus (Marketing `/partner/agb` ist als Entwurf markiert).

**Ränge als Daten.** Die Staffel (bis 5 Kunden 15 %, 6–20 20 %, 21–50 25 %,
ab 51 30 %) steht in `affiliate_tiers`; Marketing-Seite, Partner-Dashboard und
Provisionsbuchung lesen dieselbe Tabelle. Jede Provisionszeile speichert Satz
und Rang zum Buchungszeitpunkt (Muster `dynpricing_ledger.rate`).

**Attribution ohne Cookie.** Der Partner-Link `/p/CODE` (Marketing-Domain)
meldet den Klick server-zu-server und leitet mit `?ref=CODE&klick=TOKEN` auf die
Startseite. Der Code steht bis zur Registrierung SICHTBAR im Formular
(„Empfohlen von"); der Betrieb bestätigt ihn durch das Absenden. Ein Betrieb
wird GENAU EINEM Partner zugeordnet (UNIQUE `tenant_id`). Begründung: nach EDPB
Guidelines 2/2023 Rn. 49–51 fallen Tracking-Cookie UND Tracking-Link unter
Art. 5(3) ePrivacy; der händisch bestätigte Code im Formular nicht. Die
Vorbelegung aus der URL ist als Grauzone im Plan benannt (Anwaltsprüfung).

**Provisionsbasis** = Netto der Abo-Positionen der Stripe-Rechnung
(`parent.type = subscription_item_details`), ohne OTA-Provisions- und
Dyn.-Preise-Posten (liegen auf DERSELBEN Rechnung), ohne Steuern, Zusatz-
leistungen, Nachberechnungen. 12 Monate ab erster bezahlter Rechnung, 30 Tage
Erstattungsfenster, Erstattungen/Chargebacks als negative Gegenzeile.

**Auszahlung je Währung, keine Umrechnung, über ein Verbundkonto** (0522,
Beschluss 02.09.2026 — ersetzt die Sammel-CSV als Weg). Jeder Partner bekommt
einen Stripe Connected Account; der Monatslauf löst einen `transfer` aus, statt
eine CSV zur Bank zu tragen. Mindestbetrag je Währung unverändert aus
`affiliate_payout_minimums`, Gutschrift (Self-Billing, momsloven § 52a)
unverändert.

Kontoform, gemessen an Stripes Anforderungs-API für Plattformland DK
(02.09.2026), nicht angenommen:
- `type=custom`, Dashboard `none` — white-label wie bei den Betrieben.
- `tos_acceptance.service_agreement='full'`. Der zuvor vorgesehene
  `recipient`-Weg EXISTIERT für eine dänische Plattform nicht (alle 43
  Kontoländer melden `tos_types=['full']`) und schlösse
  grenzüberschreitende Auszahlungen ausdrücklich aus. `full` ist zugleich das
  Richtige: EWR→EWR ist erlaubt, die 0,25-%-Cross-Border-Gebühr entfällt
  innerhalb des EWR.
- Capability NUR `transfers` — ein Partner nimmt keine Gästezahlungen an.

**Arbeitsteilung bei der Identitätsprüfung.** Unser eigenes Formular sammelt
alles Tippbare (Person, Anschrift, Geburtsdatum, Firma, Bank). Ausweis und
Lebendnachweis (`verification.document`, `proof_of_liveness`) kann es NICHT —
Stripe dazu wörtlich: „We recommend using Stripe-hosted or embedded onboarding
to satisfy all variations of the proof_of_liveness requirement." Dafür erzeugt
`connect.identitaets_link` einen Account Link (`collection_options.fields=
currently_due`); der Partner kehrt danach ins Dashboard zurück. Ohne diesen
Schritt wäre das Formular eine Attrappe: vollständig ausgefüllt und die
Auszahlung ginge trotzdem nie los.

Die Werte `wise`/`sepa`/`paypal` bleiben in den CHECKs erlaubt, weil
Bestandspartner sie tragen und alte Auszahlungen darauf verweisen (Wurzel 5b:
eine real per SEPA gelaufene Zahlung wird nicht nachträglich zu einem Transfer
umgedeutet). Neu vergeben wird nur noch `stripe`; `export_csv` steht als außer
Dienst markiert für Rückfragen der Buchhaltung. Die Betrugsprüfung „gleiche
Bankverbindung wie der Sponsor" (`same_iban`, Etappe 5) überlebt den Wechsel
über einen gesalzenen IBAN-Fingerabdruck — die IBAN selbst liegt bei Stripe,
wir speichern nur Hash und Endziffern.

**Kanäle als Liste, nicht als eine Adresse** (0519). Ein Partner wirbt über
mehrere Kanäle (Instagram, TikTok, YouTube, Website …); das Backoffice braucht
je Kanal Plattform, Adresse, Handle und Reichweite. `affiliates.channels`
(jsonb, 1–12) statt einer eigenen Tabelle: die Liste wird nur mit dem Partner
gelesen und geschrieben. Logos sind die Original-Markenglyphen aus
simple-icons, lokal gebündelt (`@nextdays/icons`).

**Chat** läuft im vorhandenen Support-Modell als vierte Melder-Welt
(`support_tickets.reporter_affiliate_id`, 0518) — keine eigene Chat-Tabelle
(Begründung wie 0236/0238).

**Videofreigabe vor dem Link** (0523, Beschluss 02.09.2026). Ein Influencer
lädt sein fertiges Video VOR der Veröffentlichung hoch; erst nach der Freigabe
durch das Backoffice baut `beitraege.link_bauen` den Beitragslink. Ohne Freigabe
kein Link und damit kein Verdienst.
- **Datei statt URL**, weil geprüft wird, BEVOR das Video öffentlich ist. Eine
  eingereichte URL setzt voraus, dass der Schaden im Zweifel schon entstanden
  ist.
- **Je Video**, nicht einmal je Partner: jeder Beitrag hat ohnehin seinen
  eigenen Link (`utm_content`), also auch seine eigene Freigabe.
- **Die Sperre sitzt im Link-Bau**, nicht in der Oberfläche — der Partner
  spricht dieselbe API an wie sein Dashboard (Wurzel 3). Der Link entsteht
  schlicht nicht, solange `review_status != 'approved'`.
- **Widerruf** (`rejected` nach einer Freigabe) macht den Link sofort tot. Die
  bereits verdiente Provision BLEIBT: sie stammt aus echten, zahlenden Kunden,
  und ein erfüllter Provisionsanspruch wird nicht rückwirkend entzogen
  (Handelsvertreterrecht). Der Gegenzustand ist der tote Link, nicht die
  Rücknahme des Geldes.
- Videos liegen im privaten Bucket `affiliate-videos` (200 MB, nur
  mp4/mov/webm), Zugriff ausschließlich über kurzlebige signierte Adressen;
  Magic-Byte-Prüfung statt Vertrauen in den `content_type` (Wurzel 8). Das
  Protokoll `affiliate_post_reviews` hält fest, wer wann warum entschieden hat
  — bei einem Werbevideo ist das eine Haftungsfrage.
- Bestandsbeiträge aus 0521 mit veröffentlichter URL gelten als
  bestandsgeschützt (`approved` mit Vermerk); alles andere beginnt bei `draft`.

## Verworfene Alternativen

- **Partner als Betriebs-Nutzer mit Rolle `affiliate`:** hätte jedem Partner
  einen Tenant gegeben und alle 44 tenant-scoped Slices berührt; `load_scoped`
  scopet auf `tenant_id`. Ein Partner hat keinen Betrieb.
- **Partner als Route-Gruppe in `web/`:** verletzt ADR-0015 (eine Auth-Welt =
  eigene App + Subdomain + eigenes Cookie); ein Betriebs-Cookie dürfte nie ein
  Partner-Dashboard öffnen.
- **Externe Affiliate-Software (Rewardful, FirstPromoter, PartnerStack):**
  bietet kein Team-Chat im Partner-Dashboard, liest Stripe-Rechnungen ohne
  Positionsfilter (OTA-Provisionsposten wären Provisionsbasis) und kostet 3 %
  bzw. Monatsgebühr. Die Datenmodelle wurden als Vorlage gelesen (Refferq,
  raider, affiliates-spark).
- **Cookie-Attribution (60 Tage, Last Click):** einwilligungspflichtig; ein
  Programm, dessen Zuordnung an einem Consent-Banner hängt, verliert die
  Zuordnung bei jedem „Ablehnen".

## Folgen

- Neue Frontend-App `partner/` im Workspace, in der CI-Typprüfung und in
  `scripts/ci/bereiche.txt`. Coolify-App `nextdays-partner` ist anzulegen
  (Root-Build-Kontext, `partner/Dockerfile`); erst danach kommt sie in die
  `images`-/`deploy`-Matrix.
- Umgebungsvariablen: API `PARTNER_BASE_URL`; partner-App
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MARKETING_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`; marketing `NEXT_PUBLIC_PARTNER_URL`.
- Offen (nicht Code): Partner-Bedingungen (Anwalt: Handelsvertreterrecht,
  Verfallsklauseln ggü. Privatpersonen, Vorbelegung des Codes),
  Gutschrift-Vorlage (Steuerberater), zwei Werbevideos.


## Nachtrag 02.09.2026 — Master-Strategie (Migrationen 0525–0527)

Der Nutzer hat das Vergütungsmodell auf seinen Strategieplan umgestellt
(`docs/AFFILIATE-PROGRAMM-PLAN.md` Abschnitt 7). Was sich gegenüber dem Text
oben ändert:

- **Ränge nach STRUKTUR.** Einsteiger 0–4 · Aufsteiger 5–9 · Experte 10–19 ·
  Elite-Partner ab 20 zahlenden Kunden — eigene PLUS die Kunden der Team-Partner
  (eine Ebene), jeder einmal (`stufen.struktur_kunden_je_partner`).
- **Team-Provision = Differenz**, nicht fester Override: Satz des Sponsors minus
  Satz des Team-Partners, beide zum Rechnungszeitpunkt
  (`provision.override_buchen`). Gleicher Rang → 0. Der Deckel von 30 % ist
  damit von selbst eingehalten. `affiliate_tiers.override_rate` ist außer Dienst.
- **Untervermittler erst ab Aufsteiger** (`affiliate_tiers.team_allowed`,
  geprüft in `attribution._sponsor_pruefen` und `bo_sponsor_setzen`).
- **Aufstiegsbonus** einmalig je erreichtem Rang ab Aufsteiger
  (`affiliate_tier_bonuses`, 50,00 EUR für alle Partner; kind `bonus`, UNIQUE
  (affiliate_id, tier_id)).
- **Superprovision** (`affiliate_tiers.lifetime_rate`, 2,5 % ab Elite) auf den
  Netto-Abo-Umsatz der ganzen Struktur, ohne 12-Monats-Grenze, solange der
  Partner den Rang zum Rechnungszeitpunkt hält; additiv zur Provision
  (kind `lifetime`).
- **Markt-Turbo** (`affiliate_program_rates.booking_share`, 0,5 %) je bezahlter
  myBestDays-Buchung eines geworbenen Betriebs — für den Partner UND seinen
  Sponsor je eine Zeile (kind `booking_share`, Auslöser
  `payment_intent.succeeded`, UNIQUE (charge, partner)).
- **Gratismonat** für geworbene Betriebe: 14 Tage Test + 1 Kalendermonat als
  `trial_end` im Checkout (`subscriptions/gratismonat.py`), kein Coupon; die
  zwölf Provisionsmonate beginnen mit der ersten echten Zahlung.
- **Content-Regeln** in den Partner-AGB §§ 3–6 (nur offizielles Material, keine
  Garantieversprechen, Vorab-Freigabe jedes Beitrags — Video, Bild, PDF) mit
  fester Prüflisten-Kategorie je Ablehnung (`affiliate_posts.review_reason_code`).
- **Lead-Liste** möglicher Multiplikatoren im Backoffice (`affiliate_leads`),
  Klarnamen nur in der DB.
- **myBestDays ist Pflichtkanal** — eigene Entscheidung, ADR-0021.

Die Leitplanken oben (kein Teilnahmebeitrag, kein Geld fürs Anwerben, eine
Ebene, Vergütung nur aus bezahltem Umsatz) gelten unverändert. Struktur-Zählung,
Aufstiegsbonus und lebenslange Struktur-Provision sind das Muster eines
mehrstufigen Vertriebs; die anwaltliche Prüfung der Partner-AGB (ENTWURF) ist
damit Voraussetzung für den Launch, nicht mehr nur Empfehlung.

## Ergänzung 03.09.2026 — Strukturvertrieb statt einer Ebene (0533)

Entscheidung des Betreibers: das Partnerprogramm ist **Strukturvertrieb**
(„MLM"). Die oben festgehaltene Regel „genau eine Ebene" ist aufgehoben.

- **Team-Provision über alle Ebenen, als Roll-up.** Jeder Sponsor in der
  Kette über dem werbenden Partner erhält die Differenz zwischen seinem Satz
  und dem **höchsten auf diesen Umsatz bereits vergüteten Satz** — nicht zum
  Satz des direkten Kindes. Kette 15 → 30 → 20 → 30 zahlt 15/0/0; die Summe
  ist immer der höchste Satz der Kette, der Deckel von 30 % hält ohne eigene
  Prüfung. Differenz zum direkten Kind hätte hier 55 % ausgezahlt.
- **Rang zählt die ganze Struktur**: eigene zahlende Kunden plus die aller
  Partner darunter, über alle Ebenen, 1:1 (`stufen.struktur_kunden_je_partner`,
  jetzt rekursiv).
- **Superprovision (2,5 %) und Buchungsanteil (0,5 %) sind je Umsatz EIN
  Topf**, den sich alle Elite-Partner der Kette (Werber eingeschlossen) zu
  gleichen Teilen teilen; Rest-Cents an den untersten. Der Buchungsanteil ist
  seit demselben Tag Elite-only (vorher jeder Rang).
- **DB (0533):** Ebenen-Trigger ersetzt durch Zyklen-Trigger (Tiefe ≤ 25 =
  `provision.UPLINE_MAX`); Override-Index auf (parent_id, affiliate_id).
- **Rechtlicher Kern bleibt** in AGB und Texten: kein Teilnahmebeitrag, keine
  Vergütung fürs Anwerben, kein Warenkauf als Voraussetzung, Vergütung nur aus
  bezahltem Abo-Umsatz. Die Marketing-Aussage „Kein Netzwerk, keine Pyramide"
  ist gestrichen — sie wäre jetzt falsch.
- **Dashboard:** die Team-Auswertung zeigt weiterhin die direkten Mitglieder,
  aber je Mitglied Umsatz, Overrides und Kunden seiner ganzen Struktur
  (`team_service._struktur_ids`).

