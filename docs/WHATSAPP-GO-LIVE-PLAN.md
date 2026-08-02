# WhatsApp — Go-Live-Plan

Stand: 02.08.2026. **WhatsApp ist kein kostenpflichtiges Modul** — der Kanal
gehört zum Grundtarif (Begründung in Abschnitt 3c und 4). Alle Zahlen mit Quelle; was nicht belegbar war, ist als offen
markiert (keine erfundenen Werte, Wurzel 4).

## 1. Ist-Stand (live verifiziert)

| Ebene | Stand |
|---|---|
| Code (Slice `apps/api/src/features/whatsapp`) | fertig: Senden, Templates, Webhook mit `X-Hub-Signature-256`, fail-closed ohne App-Secret |
| DB | `0041_whatsapp.sql` (`whatsapp_conversation`/`whatsapp_message`, RLS), Write-Lockdown `0224`, Realtime `0042` |
| UI | `web/components/inbox/whatsapp-panel.tsx` über `lib/whatsapp-api.ts` |
| Meta-App `1767530547737119` | `app_status: dev_mode`, `is_live: false` |
| Business-Portfolio `255420047466894` | **verifiziert** (01.08.2026) |
| WABA `36519686727677404` | „Test WhatsApp Business Account", `account_review_status: APPROVED`, `business_verification_status: verified` |
| WABA `can_send_message` | **BLOCKED** — Fehler `141006`: keine gültige Zahlungsmethode → business-initiierte Konversationen gesperrt |
| Nummer `1141838152354977` | Testnummer `+1 555-633-5030`, `NOT_VERIFIED`, `TIER_250`, Quality GREEN |
| Templates | nur Meta-Beispiele (`hello_world`, `jaspers_market_*`), alle `en_US` — keine eigenen |
| Token | 60-Tage-**User**-Token (bis ~30.09.2026), Scopes korrekt, aber kein System-User-Token |
| Webhook | zeigt auf flüchtigen Cloudflare-Quick-Tunnel (lokaler Rechner) |
| Coolify-Env | `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_APP_SECRET` am 01.08.2026 nachgetragen (api id 8, worker id 9); Redeploy steht aus |

Die eingehenden Testnachrichten (5 Stück, 01.08.2026) liefen über die **lokale**
API gegen die Server-DB, nicht über die Server-API.

## 2. Meta-Kosten (recherchiert)

**Preismodell:** seit 01.07.2025 per-message statt per-conversation. Abgerechnet
wird nach Empfänger-Landesvorwahl, nur bei zugestellten Template-Nachrichten.
Template-Anlage, Nummer-Registrierung und WABA kosten bei Meta nichts.

| Kategorie | Berechnung | Frei im offenen 24-h-Fenster? |
|---|---|---|
| Marketing | immer | nein |
| Utility | außerhalb des Fensters | **ja — endet 01.10.2026** |
| Authentication | außerhalb des Fensters | ja |
| Service (freie Texte) | derzeit kostenlos | **ja — endet 01.10.2026** |

**Zwei Termine, die die Kalkulation bestimmen:**
- **01.08.2026** (heute): Meta Business Agent (KI-Antworten) wird separat
  abgerechnet — 2,00 USD je 1 Mio. Tokens, kanalübergreifend.
- **01.10.2026**: Service-Nachrichten UND Utility-Templates im 24-h-Fenster
  werden kostenpflichtig, zum jeweiligen Landessatz, ohne Mengenrabatt.
  Meta veröffentlicht die Sätze bis spätestens 01.09.2026.

Das 72-h-Free-Entry-Point-Fenster (Click-to-WhatsApp-Ads, CTA-Buttons) bleibt
kostenlos.

**Offen:** die exakten Landessätze für unsere Kernmärkte (DK, DE, AT, CH, SE)
sind nicht belegbar — Metas Rate-Card ist JS-gerendert bzw. CSV hinter Login,
Drittanbieter-Tracker widersprechen sich um Faktor ~1,8. DK/AT/CH/SE liegen im
Bucket „Rest of Western Europe". Verlässlich nur aus dem WhatsApp Manager des
eigenen Business-Kontos (Insights → Rate Card). **Vor der Preisfestlegung dort
abrufen — nicht schätzen.**

## 3. Was der Markt verlangt (recherchiert)

Von 16 geprüften PMS/Channel-Managern nennt genau **einer** einen öffentlichen
WhatsApp-Preis. Öffentliche Preise sind die Ausnahme.

| Anbieter | Modell | Preis |
|---|---|---|
| HiJiffy | WhatsApp erst im Premium-Tarif | **319 €/Monat** + Setup 99–599 € je 5 Properties |
| Runnr.ai (apaleo-Marktplatz) | pro Zimmer + Pass-through | **5 €/Zimmer/Monat** + „message fees as incurred" |
| Straiv (apaleo-Marktplatz) | pro Zimmer | ab **1 €/Zimmer/Monat** (Quellen 1–2,50 €) |
| Hostaway | nativ, Preis nicht öffentlich | **kein** Freikontingent belegbar (s. u.) |
| Cloudbeds | Credit-System | Credits je Land, Preise hinter Login |
| Guesty / Lodgify / Beds24 / Hostfully | nativ, kein Einzelpreis | im Feature-Set enthalten |
| Mews / apaleo / Avantio / Smoobu | **kein natives WhatsApp** | nur Marktplatz-Partner |
| 360dialog (BSP-Referenz) | pro Nummer | **49 €/Monat** (Regular), Meta-Kosten 1:1 ohne Markup |
| Twilio (BSP-Referenz) | pro Nachricht | 0,005 USD Aufschlag + Meta-Kosten |
| Trengo | Kontingent | 299 €/Monat (500 Konv.), 18 €/100 Konv. darüber |
| Zoko | dokumentiertes Markup | ab 49,99 USD, gestaffelter Aufschlag je Konversation |

Marktmuster: **Pass-through der Meta-Kosten ist der beworbene Standard**
(360dialog, Twilio, respond.io, Interakt, Runnr.ai), oft mit vorgeschaltetem
Freikontingent. Ob Hostaway/Cloudbeds/Guesty intern aufschlagen, ist aus
öffentlichen Quellen **nicht** klärbar — nicht als „kein Markup" unterstellen.

## 3b. Hostaway im Detail — der direkte Vergleich

Hostaway ist der nächstliegende Wettbewerber und betreibt **zwei** Systeme
parallel:

- **Legacy:** EINE geteilte US-Nummer des CPaaS-Partners für alle Kunden
  („shared across all Inbox users"), nur **4 vorgefertigte, nicht änderbare
  Templates** (EN/FR/ES/IT/DE). Kein Facebook-Login nötig, aber der Gast sieht
  nicht den Betrieb und kann nicht zurückrufen — ein seit Jahren offener
  Feature-Request in ihrem Forum.
- **Eigene Nummer:** seit ca. einem Jahr in **Beta**, Freischaltung lief per
  E-Mail-Anfrage an einen Mitarbeiter. Der Flow ist inhaltlich Embedded Signup
  (Facebook-Login → Portfolio → WABA → Nummer), auch wenn Hostaway den Begriff
  nicht verwendet.

Deren Onboarding-Schritte, direkt als Muster übernehmbar:
Facebook-Login → Business-Portfolio wählen/anlegen → **Prüfung, dass die Nummer
nicht bei WhatsApp registriert ist** (falls doch: trennen, **10 Minuten warten**,
neu starten) → WABA wählen/anlegen → Business-Profil (Anzeigename, Branche —
für Gäste sichtbar) → Nummer hinzufügen → Verifizierung.

Deren Template-Regeln: eigene Templates in Meta anlegen, Kategorie **Utility**,
Freigabe „takes a few minutes", Variablen wie `{{first_name}}`,
`{{property_name}}` werden beim Versand befüllt, Variablennamen über 20 Zeichen
brauchen eine Kurzform, **keine Bilder/Videos/Dateien** in Templates.

**Wo Hostaway schwach ist — unsere Chancen:**
- **Keine WhatsApp-Automationen.** Wörtlich: „WhatsApp cannot be used for
  automations at this time, though this feature is planned for release in 2026."
  Heute nur manueller Versand aus der Inbox. Wir haben die Automatisierung
  schon — das ist das stärkste Verkaufsargument für unser Modul.
- **Nur reservierungsgebundene Chats erscheinen im Dashboard**, eine Lösung ist
  bei ihnen „actively in development". Eine WhatsApp-Nachricht ohne passende
  Reservierung fällt durchs Raster. Das machen wir NICHT nach — eine Nachricht
  muss zuordenbar sein oder ausdrücklich als unzugeordnet geführt werden.
- Nur ein Nutzer je Nummer, kein Import alter Verläufe, dieselbe Nummer nicht
  parallel in der WhatsApp-App nutzbar.
- **Die Kostenfrage blenden sie in der eigenen Doku komplett aus.** Kein Preis,
  kein Kontingent, keine Aussage zum Meta-Modell.

**Korrektur zu einer verbreiteten Zahl:** Die oft zitierten „1.000
Konversationen/Monat frei" sind **nicht belegbar** — das war Metas altes
conversation-based pricing, das zum 01.07.2025 abgeschafft wurde. Wer heute
damit kalkuliert oder wirbt, rechnet mit einer Regel, die es nicht mehr gibt.
Kostenlos sind heute Service-Antworten im offenen 24-h-Fenster — und auch das
nur noch bis zum 01.10.2026.

## 3c. Verdienen an WhatsApp — die vertragliche Lage (verifiziert 01.08.2026)

**Als Tech Provider ist ein Aufschlag VERBOTEN.** Section 5 der *Meta Business
Messaging and Meta Business Agent Technology Provider Terms* (Stand 31.07.2026,
Volltext im Browser gelesen — nicht aus zweiter Hand):

> „You agree that you will not … (i) resell Applicable Platforms, including,
> with respect to the WhatsApp Business Platform, using any credit line you may
> have with us to pay for your Customers' use of the WhatsApp Business Platform
> **or charging a fee for your Customers' use of the WhatsApp Business
> Platform** (but this does not prohibit you from charging for any of your other
> products and services **unrelated to** the use of the WhatsApp Business
> Platform)."

Diese Terms haben wir mit dem Tech-Anbieter-Onboarding am 01.08.2026 akzeptiert.
Ein Rechnungsposten „WhatsApp-Modul" ist damit angreifbar — „unrelated to the use
of the WhatsApp Business Platform" ist er nicht. **Vor dem Verkaufsstart
juristisch prüfen lassen.**

Die gegenteilige Klausel („Price Transparency", Aufschlag erlaubt bei getrennter
Offenlegung) steht in den *Terms for Service Providers* — die gelten für
**Solution Partner**, nicht für uns.

**Metas eigene Tier-Tabelle** (Solution-Provider-Overview) ist eindeutig:

| Stufe | Kreditlinie | Darf Kunden für API-Nutzung abrechnen |
|---|---|---|
| Tech Provider | nein | **nein** |
| Tech Partner | nein | **nein** |
| Solution Partner | ja | **ja** |

Das heißt: Auch der Aufstieg zum **Tech Partner** (2.500 Nachrichten/Tag,
10 aktive Kunden, Quality ≥ 90 %) bringt das Abrechnungsrecht NICHT. Nur der
Solution-Partner-Status — von Meta selbst „a lengthy process" genannt, ohne
öffentliche Zulassungskriterien.

**Der „Meta Performance Accelerator"** (Section 9 der Tech-Provider-Terms hebt
für Programmteilnehmer die Section-5-Sperre auf) hat **keine öffentliche
Programmseite, keine veröffentlichten Kriterien und kein Bewerbungsformular** —
als Planungsgrundlage derzeit unbrauchbar.

### Der praktikable Weg: BSP-Reseller

Ein Solution Partner in der Kette löst das Problem, ohne dass wir selbst einer
werden müssen. Belegte Konditionen:

| Anbieter | Kosten | Aufschlag erlaubt | Eigener Meta-Prozess nötig |
|---|---|---|---|
| **360dialog** | 250 € + 49 €/Kanal → 1.000 € + 15 €/Kanal | ja, Kerngeschäft, **0 % Markup auf Meta-Preise** | erst ab > 3 Kundennummern |
| Twilio | kostenlos, ab 0,005 $/Nachricht + Meta | ja, ausdrückliche ToS-Ausnahme fürs Embedding | ja, eigene App + Review |
| Sinch | auf Anfrage | **nein** — ASP-Terms verbieten Resale ohne Metas schriftliche Zustimmung | ja |
| Infobip / Bird / Gupshup | nicht belegbar | keine klare Vertragsklausel gefunden | ja |

**360dialog ist der einzige Weg, der mit 2–3 Pilotkunden ganz ohne Meta-Prozess
startet** und bei dem die volle Marge bei uns bleibt (0 % Aufschlag ihrerseits).
Vor einer Entscheidung schriftlich bestätigen lassen: Markup-Erlaubnis,
Preisuntergrenzen, Offenlegungspflichten — in deren öffentlicher Doku nicht
geregelt.

Der begonnene Tech-Provider-Weg bleibt trotzdem richtig: er ist die Voraussetzung
dafür, Kunden überhaupt eigene Nummern anbinden zu lassen, und ab Kunde 4 auch im
360dialog-Modell nötig.

## 4. Die Geschäftsmodell-Entscheidung: Tech Provider vs. Solution Partner

Das bestimmt, ob wir an den Nachrichten mitverdienen können.

| | Tech Provider | Solution Partner |
|---|---|---|
| Voraussetzung | Business Verification (✅ da) + App Review | zusätzlich Meta-Business-Partner-Aufnahme + Kreditlinie + Credit Allocation API Terms |
| Wer zahlt Meta | **der Kunde direkt** (eigene Zahlungsmethode an seiner WABA) | **wir**, konsolidiert; Kreditlinie per API mit jedem Kunden geteilt |
| Unsere Erlösquelle | nur die Modulgebühr | Modulgebühr **+ Marge auf jede Nachricht** |
| Kundenerlebnis | Kunde muss selbst eine Kreditkarte bei Meta hinterlegen | Kunde sieht nur unsere Rechnung |

Empfehlung: **Phase 1 als Tech Provider** (schneller, keine Kreditlinie nötig),
**Phase 2 Solution Partner**, sobald genug Volumen da ist — dann wird aus dem
Modul ein Marge-Geschäft wie die 8 % Portal-Provision.

Wichtig für die Kundenkommunikation: als Tech Provider muss der Betrieb selbst
eine Zahlungsmethode bei Meta hinterlegen. Das ist genau der Fehler `141006`,
der uns heute blockiert — der wird bei **jedem** Kunden auftreten und gehört als
Pflichtschritt ins Onboarding, mit Statusanzeige aus `health_status`.

## 5. Preis — es gibt keinen Aufpreis

Ausgangspunkt: WhatsApp ist **pro Nummer**, nicht pro Zimmer. Ein Hotel mit 12
Zimmern hat bei uns 12 `properties`, aber **eine** WhatsApp-Nummer. Ein
Pro-Objekt-Preis wie bei Runnr.ai (5 €/Zimmer) ergäbe 60 €/Monat für dasselbe,
was den Betrieb eine Nummer kostet — das ist gegenüber Hotels nicht
verteidigbar. Also **pro Betrieb**, nicht pro Objekt.

**Entscheidung 02.08.2026: WhatsApp kostet nichts extra — Modell wie Hostaway.**

Der Weg dorthin, damit ihn niemand rückwärts geht: Zuerst war Modul 7 als
kostenpflichtiges Zusatzabo gebaut (19/39/79 € nach Objektzahl). Dann kam die
Prüfung von Section 5 der Tech-Provider-Terms — und die Umbenennung in
„Gäste-Kommunikation" allein trägt nicht. Entscheidend ist, WAS das Modul
freischaltet: Das Feature-Gate sperrte ausschließlich den WhatsApp-Versand. Wer
nicht bucht, verliert genau eine Sache — WhatsApp. Damit ist die Gebühr faktisch
eine „fee for your Customers' use of the WhatsApp Business Platform", egal wie
die Rechnungsposition heißt.

Deshalb: **kein Aufpreis.** WhatsApp gehört zum Grundtarif, wie bei Hostaway,
die für WhatsApp ebenfalls nichts extra verlangen. Verdient wird über
Grundtarif und die 8 % Portal-Provision.

Zurückgebaut (02.08.2026):
- Feature-Gate `_require_modul` aus dem whatsapp-Slice entfernt; `send` und
  `send_template` sind wieder frei.
- Modul 7 aus `MODULE_KEYS`, `MODULE_PRICE_LOOKUP`, `_MODULE_PRICE_VARIANTS`
  und dem Stripe-Webhook-Mapping entfernt; die mengenabhängige Modul-Logik
  (`OBJEKT_MENGEN_MODULE`, `_sync_mengen_module`) war nur dafür da und ist weg.
- Stripe: Produkt `prod_Uzh7prK8cHIPLV` und Preis `modul7_whatsapp_staffel`
  archiviert (`active=false`). Im Seed-Skript steht der Grund, damit niemand
  sie versehentlich neu anlegt.
- Migration `0256_modul7_whatsapp_zurueck.sql`: Entitlement-Zeilen gelöscht,
  CHECK auf die vier echten Module zurück. Live gegengeprüft.
- UI: Reiter und Modul-Karte auf `/konto/tarif` entfernt.

**Was bleibt und generisch nützlich ist:** `POST /subscriptions/modules` und
`DELETE /subscriptions/modules/{key}` — Zusatzmodule an einem LAUFENDEN Abo
nachbuchen und kündigen, ohne zweiten Checkout (der hätte eine zweite
Subscription mit doppelter Grundgebühr angelegt). Das gab es vorher nicht und
gilt jetzt für die Module 3, 4 und 6.

**Falls später doch an Nachrichten verdient werden soll**, führt kein Weg an
einem dieser drei vorbei (siehe 3c): Solution-Partner-Status mit eigener
Kreditlinie, Aufnahme in Metas Performance Accelerator (hebt Section 5 auf),
oder ein BSP wie 360dialog in der Kette. Als reiner Tech Provider ist es
vertraglich ausgeschlossen.

## 4. Die Geschäftsmodell-Entscheidung: Tech Provider vs. Solution Partner

Das bestimmt, ob wir an den Nachrichten mitverdienen können.

| | Tech Provider | Solution Partner |
|---|---|---|
| Voraussetzung | Business Verification (✅ da) + App Review | zusätzlich Meta-Business-Partner-Aufnahme + Kreditlinie + Credit Allocation API Terms |
| Wer zahlt Meta | **der Kunde direkt** (eigene Zahlungsmethode an seiner WABA) | **wir**, konsolidiert; Kreditlinie per API mit jedem Kunden geteilt |
| Unsere Erlösquelle | nur die Modulgebühr | Modulgebühr **+ Marge auf jede Nachricht** |
| Kundenerlebnis | Kunde muss selbst eine Kreditkarte bei Meta hinterlegen | Kunde sieht nur unsere Rechnung |

Empfehlung: **Phase 1 als Tech Provider** (schneller, keine Kreditlinie nötig),
**Phase 2 Solution Partner**, sobald genug Volumen da ist — dann wird aus dem
Modul ein Marge-Geschäft wie die 8 % Portal-Provision.

Wichtig für die Kundenkommunikation: als Tech Provider muss der Betrieb selbst
eine Zahlungsmethode bei Meta hinterlegen. Das ist genau der Fehler `141006`,
der uns heute blockiert — der wird bei **jedem** Kunden auftreten und gehört als
Pflichtschritt ins Onboarding, mit Statusanzeige aus `health_status`.

## 5. Preis — es gibt keinen Aufpreis

Ausgangspunkt: WhatsApp ist **pro Nummer**, nicht pro Zimmer. Ein Hotel mit 12
Zimmern hat bei uns 12 `properties`, aber **eine** WhatsApp-Nummer. Ein
Pro-Objekt-Preis wie bei Runnr.ai (5 €/Zimmer) ergäbe 60 €/Monat für dasselbe,
was den Betrieb eine Nummer kostet — das ist gegenüber Hotels nicht
verteidigbar. Also **pro Betrieb**, nicht pro Objekt.

**Entscheidung 01.08.2026: Modell wie Hostaway — reiner Tech Provider, kein
BSP/Sub-Anbieter dazwischen.** Der Betrieb hinterlegt seine Zahlungsmethode
selbst bei Meta und bekommt seine Meta-Rechnung direkt. Wir berühren die
Nachrichtenkosten nicht.

**Kein Inklusiv-Volumen.** Ein Angebot wie „19 € inkl. 300 Nachrichten" wäre
genau das, was Section 5 der Tech-Provider-Terms verbietet: eine Gebühr für die
Nutzung der WhatsApp Business Platform. Erlaubt ist nur die Gebühr für UNSERE
Software. Nachrichten sind kein Teil des Pakets — sie laufen an uns vorbei.

| Stufe | Zielgruppe | Preis (Software) |
|---|---|---|
| Basis | 1–5 Objekte | 19 €/Monat je Betrieb |
| Pro | 6–30 Objekte | 39 €/Monat je Betrieb |
| Business | ab 31 Objekten | 79 €/Monat je Betrieb |

Was der Preis abdeckt (und was ihn rechtfertigt, weil es unsere Leistung ist und
nicht Metas): Posteingang mit Reservierungs-Zuordnung, automatische
Buchungsbestätigung und Erinnerungen aus dem Reservierungssystem, Verwaltung und
Ausrollen der Vorlagen, mehrsprachige Texte, Rollen und Rechte, Onboarding der
Nummer.

**Empfehlung zur Benennung — der Punkt, an dem Hostaway es klüger macht:**
Hostaway verkauft **kein „WhatsApp-Modul"**. WhatsApp ist bei ihnen ein Kanal in
der Unified Inbox, und bezahlt wird die Software. Deshalb haben sie kein
Section-5-Problem. Ein Rechnungsposten „WhatsApp-Modul 19 €" ist angreifbar; ein
Posten „Gäste-Kommunikation" (WhatsApp + E-Mail + SMS + Marktplatz-Nachrichten
in einem Posteingang) ist es nicht. Der interne `module_key` kann
`modul7_whatsapp` bleiben — die KUNDENSICHTBARE Bezeichnung und die
Stripe-Produktbeschreibung sollten den Kommunikationskanal-Verbund nennen.

Die Meta-Landessätze bleiben trotzdem relevant — nicht für unsere Kalkulation,
sondern für die **Kostentransparenz im Onboarding**: der Betrieb muss vor dem
ersten Versand wissen, was Meta ihm berechnet, besonders ab dem 01.10.2026, wenn
auch Service-Antworten im 24-h-Fenster kostenpflichtig werden.

## 6. Umsetzungsplan

### Phase A — Testkanal serverseitig beweisen
1. **OFFEN — braucht dich:** Redeploy `nextdays-api` (`restart_only`), damit die
   nachgetragenen Coolify-Variablen greifen (`WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_APP_SECRET`, `WHATSAPP_WABA_ID`). Der Classifier verweigert mir
   `queue_application_deployment` und das Anlegen eines Coolify-API-Tokens.
   Bis dahin antwortet der Webhook-POST 503 (fail-closed, korrekt).
2. **Erledigt:** Webhook zeigt auf
   `https://api.mynextdays.com/api/v1/whatsapp/webhook`, Topic
   `whatsapp_business_account`, 9 Felder inkl. `messages`. Verify-Handshake live
   mit 200 + Challenge-Echo geprüft.
   Achtung: der `WHATSAPP_VERIFY_TOKEN` im Container war ein ANDERER als in der
   lokalen `.env` — Meta hat jetzt den Server-Token.
3. Danach: Ende-zu-Ende beweisen — eingehend (Signaturprüfung greift) und
   ausgehend im 24-h-Fenster.
4. **Erledigt:** `.env.example` auf `v25.0` (Live und Code-Default sind v25.0;
   aktuellste Plattformversion ist v26.0, keine Deprecation offen), plus
   `WHATSAPP_WABA_ID` dokumentiert.

### Phase B — echter Sendekanal
5. Zahlungsmethode an der WABA hinterlegen → löst `141006`, `can_send_message`
   muss danach `AVAILABLE` sein (per `health_status` gegenprüfen).
6. Eigene Geschäftsnummer + Anzeigename registrieren; die Test-WABA bleibt
   Sandbox, produktiv wird eine eigene WABA.
7. System-User-Token statt User-Token (überlebt Passwortwechsel).
8. Meta-App von `dev_mode` auf Live.
9. **Erledigt (de/en):** Der Vorlagensatz liegt als Code in
   `apps/api/src/features/whatsapp/templates.py` und wird per
   `POST /api/v1/whatsapp/templates/rollout` in eine WABA ausgerollt —
   idempotent, sammelt Ablehnungen einzeln statt abzubrechen. Live ausgerollt,
   10 Vorlagen bei Meta in Prüfung (PENDING, UTILITY):
   `buchung_bestaetigt`, `checkin_information`, `zahlungserinnerung`,
   `buchung_storniert`, `rechnung_bezahlt` — je de + en.
   Zwei Meta-Regeln, die beim ersten Versuch 6 Ablehnungen erzeugten und jetzt
   im Code berücksichtigt sind:
   - Eine Variable darf **nicht am Anfang oder Ende** der Vorlage stehen — nach
     der letzten Variable muss noch Text folgen (ein Satzpunkt reicht nicht).
   - Das Verhältnis Variablen zu Textlänge wird geprüft: 5 Variablen brauchen
     entsprechend viel Text, sonst „zu viele Variablen".
   Offen: die übrigen 22 Sprachen (4–5 Vorlagen × 22 = ~100 Texte).

### Phase C — Multi-Tenant  ✅ Backend gebaut (01.08.2026)

**Erledigt und live eingespielt:**
- **Migration `0255_whatsapp_account_je_tenant.sql`** — eine WhatsApp-Nummer je
  Betrieb (`waba_id`, `phone_number_id`, Kundentoken, `can_send_message`,
  `send_block_reason`, `quality_rating`, `messaging_limit_tier`, Status).
  Wurzel 6 umgesetzt und **live gegengeprüft**: `anon`/`authenticated` haben
  keinerlei Grants, Lesen UND Schreiben per anon-Key scheitern mit `42501`.
  Zusätzlich restriktive Policy `using (false)` als Backstop, falls später
  jemand versehentlich grantet. Das Token liegt dort — es darf nie über
  PostgREST oder Realtime erreichbar sein.
- **`onboarding.py`** — der komplette Embedded-Signup-Ablauf: Code eintauschen
  (30-Sekunden-TTL, deshalb synchron im Callback), Token bei Meta prüfen,
  **WABA-ID aus `granular_scopes` erfragen statt aus dem Request lesen** (sonst
  könnte jemand eine fremde WABA unterschieben, Wurzel 3), unsere App für die
  Webhooks der Kunden-WABA registrieren, Nummer und `health_status` auslesen,
  Zeile schreiben, Vorlagensatz ausrollen. Mehrere WABAs an einem Token → 422
  statt eine auszuwählen.
- **`POST /api/v1/whatsapp/onboarding/verbinden`** und
  **`GET /api/v1/whatsapp/onboarding/status`**. Der Tenant kommt aus dem JWT,
  nicht aus dem Body. Der Status-Endpunkt selektiert das Token bewusst nicht.
- **Webhook demultiplext jetzt korrekt.** Vorher wurde der Betrieb über die
  **Gast-Nummer** bestimmt — bei zwei Betrieben mit demselben Gast landet die
  Nachricht im falschen Betrieb. Jetzt zuerst über `metadata.phone_number_id`,
  dann `entry[].id` (WABA) gegen `whatsapp_account`. Der alte Pfad über die
  Gast-Nummer bleibt nur für den Altbestand und protokolliert jeden Treffer,
  damit er sichtbar verschwindet. Ein Test sichert genau diesen Fall ab.
- Client um `exchange_code`, `debug_token`, `subscribe_app_to_waba`,
  `phone_numbers`, `waba_health` erweitert; `_graph` nimmt jetzt ein
  kundeneigenes Token und kann ohne Bearer-Header aufrufen (OAuth-Tausch).
- `WHATSAPP_APP_ID` in der Konfiguration ergänzt.

**Noch offen in Phase C:**
- Redirect-URI bei Meta eintragen (verlangt Metas „Link generieren"-Dialog) und
  Frontend-Einstieg „WhatsApp verbinden" im Kanalmanager.
- Live-Test des Onboardings — geht erst nach dem App Review, vorher fehlt der
  Advanced Access.
- `WHATSAPP_DEFAULT_TENANT_ID` entfernen, sobald kein Altkunde mehr darüber läuft.

### Phase C (Ursprungsplan, Referenz)
10. App Review für Advanced Access auf `whatsapp_business_messaging` und
    `whatsapp_business_management`. Voraussetzung Business Verification ist
    erfüllt. Je Permission ein eigenes Video (business-seitige Oberfläche, nicht
    die Gast-Sicht) plus eigene schriftliche Begründung — beides zusammen in
    einem Video führt zur Ablehnung. Realistisch Tage bis Wochen, nicht die in
    der Doku genannten ~24 h.
11. Datenmodell: neue Tabelle `whatsapp_account` je Tenant
    (`waba_id`, `phone_number_id`, verschlüsseltes Business-Token,
    `can_send_message`, `messaging_limit_tier`, `quality_rating`).
    Damit fällt `WHATSAPP_DEFAULT_TENANT_ID` weg — das ist heute ein
    Provisorium, das jede eingehende Nachricht einem einzigen Tenant zuordnet.
12. Webhook demultiplexen: ein zentraler Endpunkt, Zuordnung über
    `entry[].id` (WABA-ID) + `value.metadata.phone_number_id` gegen
    `whatsapp_account`. Kein Callback je Kunde.
13. Embedded-Signup-Flow im Frontend: Facebook Login for Business, `FB.login`
    mit `config_id` und `response_type: 'code'`, `message`-Listener auf
    `WA_EMBEDDED_SIGNUP` (Origin-Prüfung auf `facebook.com`). Der Code hat
    **30 Sekunden TTL** → sofort serverseitig gegen ein
    Business-Integration-System-User-Token tauschen. Der exakte Tausch-Endpunkt
    steht in der WhatsApp-Doku nicht wörtlich; vor dem Bau gegen die aktuelle
    Graph-Referenz verifizieren, nicht raten.
14. Onboarding-Limit nach Freigabe: 10 neue Kunden je rollierender Woche,
    steigt mit Access Verification auf 200.
15. Templates je Kunden-WABA automatisch anlegen (kein Bulk-Push bei Meta
    vorhanden — eigener Codepfad, der unseren Template-Satz für jede neue WABA
    einzeln ausrollt). Limits: 250 Templates je WABA, 100 Erstellungen/Stunde.
16. Rechtliches: WhatsApp Business Solution Terms, Terms for Service Providers,
    Meta Business Messaging Technology Provider Terms. Letztere verbieten
    Tracking/Profiling einzelner Endnutzer und Weitergabe an Dritte —
    relevant für unsere Datenschutzerklärung und den AVV.

### Phase D — Modul verkaufen  ✅ Grundgerüst steht (01.08.2026)
17. **Erledigt und live:** Modul 7 ist buchbar.
    - Migration `0254_modul7_whatsapp.sql` erweitert den CHECK auf
      `tenant_module_entitlement.module_key` — ohne das wäre der Kauf ein
      23514-Fehler im Stripe-Webhook (Kunde zahlt, Entitlement fehlt).
      Live gegengeprüft.
    - Stripe: Produkt `prod_Uzh7prK8cHIPLV`, Preis
      `modul7_whatsapp_staffel` (`price_1TzhjE02RC0rKIinL5wfz4dA`),
      `tiers_mode=volume` mit 19/39/79 EUR nach Objektzahl.
    - `POST /api/v1/subscriptions/modules` und
      `DELETE /api/v1/subscriptions/modules/{key}` — Nachbuchen am LAUFENDEN
      Abo statt zweitem Checkout (der hätte eine zweite Subscription mit
      doppelter Grundgebühr angelegt). Idempotent über
      `idempotency_key` + Wiederverwendung vorhandener Positionen.
      Kündigen entfernt die Position ohne Gutschrift und setzt
      `active_until` auf das Periodenende — der Zugang bleibt bis dahin.
    - `_sync_mengen_module`: wächst die Objektzahl, wächst die WhatsApp-Menge
      mit. Ohne das bliebe ein Betrieb, der von 4 auf 40 Objekte wächst, für
      immer in der 19-EUR-Stufe.
    - UI: Reiter „WhatsApp" auf `/konto/tarif`
      (`web/components/konto/konto-whatsapp-modul.tsx`) mit Staffelanzeige aus
      Stripe, Buchen/Kündigen und — getrennt davon — dem Kanal-Zustand.
      Gebucht ≠ sendebereit: ohne verbundene Nummer sendet das Modul nichts,
      und das steht dort auch so. Realtime auf `tenant_module_entitlement`
      und `tenant_subscription` (beide live als echt geprüft).
18. Offen: Verbrauchszählung je Tenant und Kategorie (Marketing/Utility/Auth/
    Service), damit Inklusiv-Volumen und Pass-through abrechenbar sind. Quelle
    für Ist-Kosten: `GET /<WABA_ID>/conversation_analytics` mit
    `metric_types=COST` (Endpunkt live geprüft, liefert derzeit leer, weil noch
    nichts berechnet wurde).
19. Offen: Kostenwarnung im UI, bevor eine kostenpflichtige Kategorie gesendet
    wird.
20. **Erledigt:** Feature-Gate. `WhatsAppService._require_modul` sperrt
    `send` UND `send_template` mit **402**, wenn Modul 7 nicht aktiv ist.
    Fail-closed: fehlende Zeile, inaktive Zeile und ein unparsbares
    `active_until` sperren alle drei. Gekündigt mit `active_until` in der
    Zukunft bleibt erlaubt.
    Bewusst NUR der Sendepfad: eingehende Nachrichten laufen über den Webhook
    weiter und Lesen bleibt möglich — ein abgelaufenes Abo darf keine
    Gästenachrichten verschlucken. 5 Tests decken die Fälle ab.

## 7. Bekannte Baustellen im Code
- `web/services/whatsapp.service.ts` + `whatsapp-notifications.service.ts`
  (814 Zeilen, genutzt von `EmailSendModal` und `InvoiceListView`) rufen
  `/api/v1/companies/{id}/integrations/whatsapp/templates/…` — diese Endpunkte
  existieren nicht. Der Rechnungsversand per WhatsApp läuft ins Leere; der
  funktionierende Pfad ist `lib/whatsapp-api.ts` → `/api/v1/whatsapp/*`.
- App-URLs bei Meta zeigen auf `mynextdays.com`/`app.mynextdays.com`
  (Datenschutz, AGB, Datenlöschung) — beim `.dk`-Cutover mitziehen.
- `contact_email_verified: false` an der Meta-App.
- `require_2fa: false` an der App und „Zweistufige Authentifizierung: Niemand"
  im Business-Portfolio — sollte auf „Alle", das ist ein Admin-Zugang zur
  Kundenkommunikation.
- `require_app_secret: false`. Einschalten geht erst, wenn
  `apps/api/.../whatsapp/client.py` `appsecret_proof` mitsendet — tut er heute
  nicht.
