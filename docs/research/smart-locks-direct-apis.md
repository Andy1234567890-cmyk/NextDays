# Research: Direkt-APIs der 12 Smart-Lock-Marken (ohne Aggregator)

> Frage: Können wir alle von .. unterstützten Marken selbst integrieren,
> ohne Aggregator (Seam) im Ökosystem? Stand 13.07.2026, Quellen jeweils
> Hersteller-Doku (Links am Ende der Abschnitte in
> `smart-locks-..-seam.md`-Ergänzung).

## Antwort in einem Satz

**Nein — nicht alle 12. Aber die für den EU-Ferienvermietungsmarkt relevanten
Marken (Nuki, Tedee, TTLock, Igloohome, dazu Schlage und SmartThings mit
Auflagen) sind direkt integrierbar; Yale, August, Kwikset, Wyze und Lockly
sind faktisch Aggregator- oder Closed-Partner-only.**

## Matrix

| Marke                              | Eigene offizielle API                                               | Zugang                                                                                                              | Zeitgebundene Keypad-PINs per API                                                                | Webhooks                                     | Direkt machbar?                                                             |
| ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------- |
| **Nuki** (AT)                      | ✅ Web API (api.nuki.io)                                            | Self-Service-Token; **Short-Rental kommerziell = Vertrag mit Nuki nötig**; Webhooks nur via „Advanced API" (Antrag) | ✅ voll (auth type 13, Zeitfenster)                                                              | Nur Advanced API, sonst Polling              | **Ja** (Vertrag einplanen)                                                  |
| **Tedee** (PL)                     | ✅ api.tedee.com                                                    | ✅ am offensten: Personal Access Key self-service; OAuth-App ~2 Wochen Freischaltung                                | ✅ (lockpin-Endpoints)                                                                           | ✅ dokumentiert (Battery, Lock-Status, …)    | **Ja — einfachster Einstieg**                                               |
| **TTLock/Sciener** (CN, EU-Server) | ✅ euopen.ttlock.com                                                | Developer-Antrag (1–2 Tage Freigabe), kein NDA                                                                      | ✅ (keyboardPwd/add mit start/end) — Remote nur mit Gateway + V4-Locks                           | ✅ Callback-URL pro App                      | **Ja** (Gateway-Pflicht)                                                    |
| **Igloohome** (SG)                 | ✅ api.igloodeveloper.co                                            | ✅ Self-Signup, ~2–2,50 USD/Lock/Monat                                                                              | ✅ **algoPIN: algorithmische OFFLINE-PINs** (kein Internet am Schloss nötig!)                    | ✅ (Event-Liste nicht im Detail verifiziert) | **Ja — stärkster Kandidat**                                                 |
| **Schlage** (Allegion, US)         | ✅ Schlage Home API (developer.allegion.com)                        | Gated: Questionnaire + Business-Review + Gespräch, kein Self-Signup                                                 | ✅ offiziell, „Temporary" explizit für Airbnb/VRBO-Use-Case                                      | Unklar (Referenz hinter Login)               | **Ja, mit Freigabeprozess**                                                 |
| **SmartThings** (Samsung)          | ✅ REST-API + OAuth                                                 | Self-Reg.; produktiv = OAuth-SmartApp + Review                                                                      | ⚠️ `lockCodes.setCode/deleteCode` — **kein natives Ablaufdatum**, Lifecycle selbst orchestrieren | ✅ Subscriptions                             | **Bedingt** — Endkunde braucht fast immer Hub; PIN-Support gerätespezifisch |
| **4Suites** (NL, Hotel)            | ✅ api.4suites.nl (OAuth2)                                          | Partner-Onboarding [Vermutung — Portal nicht öffentlich lesbar]                                                     | ❓ nicht aus Primärquelle verifizierbar (Fokus Mobile Key)                                       | ❓ nicht verifizierbar                       | **Vielleicht — direkt anfragen**                                            |
| **Yale** (ASSA ABLOY)              | ❌ (läuft auf August-Backend)                                       | Geschlossenes Partnerprogramm                                                                                       | nur via Aggregator                                                                               | —                                            | **Nein** (nur Partner-Deal)                                                 |
| **August** (ASSA ABLOY)            | ❌ öffentlich; partners.august.com = Login-Gate                     | Antrag, Konditionen nicht öffentlich                                                                                | nicht öffentlich dokumentiert                                                                    | —                                            | **Nein** (nur Partner-Deal)                                                 |
| **Kwikset** (Spectrum)             | ❌ (Cloud-API existiert, undokumentiert)                            | Nur ausgewählte Partner (Seam, Jervis)                                                                              | nur via Aggregator                                                                               | inoffiz. WebSocket                           | **Nein**                                                                    |
| **Wyze** (US)                      | ❌ (API-Key nur für private App-API, unsupported)                   | —                                                                                                                   | nur Reverse-Engineering (wyze-sdk)                                                               | ❌                                           | **Nein — unseriös ohne offizielle API**                                     |
| **Lockly**                         | ⚠️ nur LocklyPRO/LocklyOS via Access Portal, keine öffentliche Doku | Partner/Abo-gated; Lockly selbst verweist auf Seam                                                                  | Portal ja, API unverifiziert                                                                     | ❓                                           | **Kaum** (gated, dünn dokumentiert)                                         |

## Strategische Bewertung für NextDays

1. **„Kein Aggregator" ist für den EU-Markt tragfähig.** Die vier in Europa
   dominanten Vacation-Rental-Schlösser — **Nuki (AT), Tedee (PL),
   TTLock (EU-Server), Igloohome** — haben alle eigene, offiziell nutzbare
   APIs mit zeitgebundenen PIN-Codes. Das deckt den realen Bedarf unserer
   Zielkunden (EU-Ferienvermieter) weitgehend ab. Dazu passt: eigener
   `smart_locks`-Slice mit **Adapter-Interface** (Muster channel_manager/ocr),
   ein Adapter pro Marke.
2. **Der Preis der Entscheidung:** Yale/August/Kwikset/Wyze/Lockly sind ohne
   Aggregator nicht (seriös) erreichbar — das sind primär US-Consumer-Marken.
   Verzicht darauf ist ein bewusster Scope-Cut, kein technisches Versäumnis.
   Falls US-Expansion kommt: Schlage direkt (Freigabeprozess) + ggf. dann
   neu bewerten.
3. **Empfohlene Adapter-Reihenfolge:**
   1. **Nuki** — EU-Marktführer Ferienwohnung; Vertrag für Short-Rental
      früh anstoßen (Vertrieb, nicht Code) + Advanced-API für Webhooks
      beantragen.
   2. **Tedee** — offenste API, Webhooks dokumentiert; idealer zweiter
      Adapter und guter Referenz-Adapter für das Interface.
   3. **Igloohome** — algoPIN/Offline-PINs sind ein Alleinstellungsmerkmal
      (Hütten/Glamping ohne WLAN → passt exakt zu unserem
      Beherbergungs-Typ-Ökosystem, PROJECT.md §5).
   4. **TTLock** — riesige White-Label-Verbreitung günstiger Schlösser;
      Gateway-Pflicht dokumentieren.
   5. Später: Schlage (US), SmartThings (generischer Hub-Adapter),
      4Suites (Hotelmodus — direkt Kontakt aufnehmen).
4. **Architektur-Anforderungen an den Slice** (aus den API-Unterschieden):
   - Adapter-Capabilities-Modell (kann_offline_pins, braucht_gateway,
     hat_webhooks, pin_constraints wie Länge/Ziffernregeln — Nuki 6-stellig
     ohne 0, Tedee 5–8, Schlage 4–8 …). KEINE hartkodierten Annahmen
     (Wurzel 4).
   - **Eigener Scheduler für Code-Lifecycle**, weil nicht jede API native
     Ablaufzeiten kann (SmartThings) und Provisionierung asynchron ist →
     Status-Maschine wie bei .. (scheduled/generating/active/expired),
     Jobs über die bestehende jobs-Queue (0102), idempotent (Wurzel 2).
   - Webhook-Empfang fail-closed mit Signatur/Secret je Anbieter (Wurzel 5);
     wo es keine Webhooks gibt (Nuki Standard): Polling mit dokumentierten
     Intervallen (>30s, Nuki-Vorgabe).
   - Storno/Umbuchung: Codes über den Reservierungs-Lifecycle nachziehen
     (Wurzel 1 — Alt/Neu-Diff wie bei Kalendernächten).
5. **Nicht-Code-Aufgaben (Andy):** Nuki-Short-Rental-Vertrag + Advanced-API-
   Antrag; Igloohome-Developer-Konto (Kosten/Lock beachten); TTLock-Developer-
   Freigabe; 4Suites-Partneranfrage. DSGVO: Igloohome (SG) und TTLock (CN,
   EU-Server) als ADR mit AVV/SCC bewerten — Nuki/Tedee sind EU-Anbieter
   (Positionierungs-Vorteil!).

**Empfehlung:** Eigenes Arbeitspaket P10 „smart_locks-Slice + Nuki/Tedee-
Adapter" nach P9. Kein Aggregator — aber ehrlich kommunizieren, dass die
Markenliste anfangs 4–6 statt 12 umfasst.
