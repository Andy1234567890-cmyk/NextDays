# Plan: Eigenes 2FA-System (self-hosted, skaliert auf 100k+ Nutzer)

Ziel: Zwei-Faktor-Authentisierung im **eigenen Ökosystem** — keine fremde Logik,
kein SaaS-Lock-in. Airbnb-naher Flow (Nummer verifizieren → OTP → 2FA aktiv).
Wir bauen die **Twilio-Rolle selbst**: eigenes SMS-Gateway + austauschbaren
Transit. Recherche-belegt (Jasmin, SMPP-Wholesale, Multi-Kanal-Architektur).

---

## Wie Airbnb es wirklich macht (recherche-belegt, Referenz)

Damit wir nicht raten — Airbnbs echtes System (Help-Center Art. 2842/3530/4094,
CSO-Statement, Airbnb-Tech-Blog zur Delivery-Plattform):

- **OTP-Kanäle: SMS + Sprachanruf + E-Mail.** Kein TOTP (Airbnb hat es bewusst
  NICHT — Nutzer fordern es seit Jahren). Wir bauen TOTP trotzdem (einfach,
  phishing-resistenter, 0 € Versand) — als Bonus über Airbnb hinaus.
- **Passkeys/WebAuthn** nur als **Step-up für Finanz-Aktionen** (Auszahlung
  hinzufügen), noch nicht als Login-Faktor. Zukunftsrichtung, kein Muss für Start.
- **PIN + Sicherheitsfragen** = KEIN Login-2FA, sondern ein **separates Gate vor
  der Auszahlungs-Historie** (Wissens-Secret zusätzlich zum OTP). Der moderne
  Ersatz ist Passkey/Step-up-OTP statt PIN — dahin bewegt sich Airbnb selbst.
  → Wir bauen KEIN PIN+Sicherheitsfragen (Social-Engineering-anfällig), sondern
  Step-up-OTP vor Finanzbereichen.
- **„Confirm account"-Step-up**: getriggert bei (a) Login von neuem Gerät/Ort,
  (b) Bearbeiten sensibler Kontodaten. Code per SMS/Anruf/E-Mail, Resend-Cooldown
  ~1 Min. Das ist unser Wurzel-7-Muster (Re-Auth vor sensiblen Selbst-Änderungen).
- **SMS-Infrastruktur**: Airbnb nutzt **Twilio** (belegt) über eine **channel-
  agnostische Delivery-Plattform** (Queue/SQS → austauschbare Vendor-Adapter:
  SendGrid/Twilio/FCM). **KEIN Eigen-SMPP** — sie kaufen Transit ein, genau wie
  unser Plan. Bestätigt die Architektur: Abstraktion → Queue → Vendor-Adapter,
  Twilio-SDK NIE direkt im Auth-Code.
- **Risikobasierte Auth**: Airbnb ging bewusst WEG von „nur bei Verdacht" HIN zu
  **Pflicht-Step-up bei jedem NEUEN Gerät** + Device-History (OS/Ort/Zeit) +
  SMS/E-Mail-Alerts. Bekannte Geräte bleiben reibungslos.

**Übernahme für uns:** Airbnb bestätigt genau die Architektur dieses Plans
(Abstraktion + eingekaufter Transit, kein Eigen-SMPP). Wir gehen an ZWEI Stellen
bewusst über Airbnb hinaus (besser): (1) **TOTP** zusätzlich anbieten, (2) Step-up-
OTP statt PIN+Sicherheitsfragen vor Finanzbereichen. Voice-Anruf lassen wir vorerst
weg (selten genutzt, gleicher Transit-Aufwand wie SMS).

---

## Kern-Erkenntnis (warum es geht — und wo die Grenze liegt)

- **Die Gateway-Software ist voll self-hosted und skaliert**: Jasmin SMS Gateway
  (OSS, Python/Twisted, RabbitMQ, Redis) verarbeitet zehntausende SMS/Tag im
  eigenen HA-Cluster. Routing, Failover, DLR, Rate-Limit, Billing — alles bei uns.
- **Die „letzte Meile" ins Funknetz hostet physikalisch NIEMAND selbst** — auch
  Twilio nicht. Man braucht einen **SMPP-Uplink** zu einem Carrier/Wholesaler.
  Das ist **kein SaaS-Lock-in**: SMPP ist ein Standard, der Anbieter ist ein
  austauschbarer Connector in Jasmin. Wir behalten die gesamte Logik.
- **Fazit**: „so self-hosted wie möglich" = **eigenes Jasmin-Gateway + reiner
  SMPP-Transit-Vertrag** (statt Twilios proprietärer API). Genau die Ziel-
  architektur. Wir bauen sie so, dass der Versandkanal **hinter einer Abstraktion
  austauschbar** ist — klein anfangen (TOTP + E-Mail self-hosted), SMS-at-Scale
  später dazuschalten, ohne die 2FA-Logik anzufassen.

---

## Die entscheidende Architektur-Idee: Kanal-Abstraktion

2FA-Logik und Versandkanal werden **getrennt**. Ein `OtpChannel`-Interface, dahinter
austauschbare Adapter. So können wir heute rein self-hosted starten und SMS später
skalieren, ohne etwas umzubauen.

```
                    ┌────────────────────────────┐
   FastAPI Auth ──► │  OtpService (Orchestrator) │  Kanal-Wahl SERVERSEITIG
                    │  geordnete Fallback-Kette   │  (Assurance-Level pro Aktion)
                    └────┬────────┬────────┬──────┘
                         │        │        │
                    ┌────▼──┐ ┌───▼───┐ ┌──▼─────┐
                    │ TOTP  │ │ Email │ │  SMS   │   ← Adapter, austauschbar
                    │(gratis│ │Mailcow│ │ Jasmin │
                    │offline│ │self-h.│ │ +SMPP  │
                    └───────┘ └───────┘ └────────┘
```

**Prinzipien (an unsere Wurzeln gebunden):**
- Kanal-Wahl **serverseitig erzwingen**, nie clientseitig „aufmachbar" (Wurzel 6/7).
- Hochsensible Selbst-Änderungen (E-Mail/Passwort/2FA) verlangen Re-Auth (Wurzel 7).
- Fehlt eine Nummer → SMS ist schlicht nicht verfügbar, kein Fantasiewert (Wurzel 4).
- OTP-Trigger = SMS-Pumping-Ziel → eigener strenger Rate-Limit-Bucket (Wurzel 8).

---

## Skalierungsstufen (bewusst gestuft, nicht alles auf einmal)

| Stufe | Nutzer | 2FA-Kanäle | Warum |
|---|---|---|---|
| **1 — jetzt** | bis ~1k | **TOTP + E-Mail-OTP** (beides self-hosted) | 0 € Versand, keine Fraud-Fläche, schließt aal2/MFA-Audit-Lücke |
| **2 — Wachstum** | ~10k | + SMS über SMPP-Wholesale (Jasmin klein) | echte SMS-Zustellung, ein Provider |
| **3 — Scale** | ~100k | Jasmin HA (eigener Stack) + 2 Wholesale-SMPP-Routen mit Failover | volle Kontrolle, kein Lock-in, ~10–50k €/Mon Termination |

Die Kanal-Abstraktion erlaubt genau diesen Weg: der SMS-Adapter wechselt intern
den Provider, ohne dass die 2FA-Logik es merkt.

---

## STUFE 1 — jetzt bauen (voll self-hosted, kein Versand-Vertrag nötig)

### 1a. TOTP (Authenticator-App) — FAST FERTIG
- Backend existiert schon: `/auth/totp/enroll|verify|disable` (live getestet:
  enroll→verify→8 Recovery-Codes ✅).
- Frontend `ZweiFaZeile` gebaut (QR → Code → Recovery-Codes).
- **Rest**: nur ins Airbnb-Layout (Vollbild-Setup-Sheet) heben — kleiner UI-Schliff.

### 1b. E-Mail-OTP über Mailcow — NEU
- **Neuer Kanal**, primär für **Nummern-Verifizierung** und als **Fallback**.
- Voraussetzung: Mailcow Port 25/465 frei (~2026-07-20, Memory-Stand). Bis dahin
  kann der Server nach außen nicht senden → E-Mail-OTP erst ab Freischaltung live.
- NIST: E-Mail als alleiniger 2. Faktor zu schwach für Hochsensibles → als
  Verifizierungs-/Fallback-Kanal einsetzen, nicht als einzigen Login-Faktor.

### 1c. Kanal-Abstraktion + OTP-Slice — NEU (das Fundament)
Neuer FastAPI-Slice `features/otp/`:
- `OtpChannel`-Protocol (`send`, `can_handle`, `name`).
- Adapter: `TotpChannel` (wrappt bestehende TOTP-Logik), `EmailOtpChannel` (Mailcow).
- `OtpService` (Orchestrator, geordnete Fallback-Kette, serverseitige Kanal-Wahl).
- OTP-Erzeugung: 6-stellig, kurze Gültigkeit (~5 min), **einmal verwendbar**,
  Hash in DB (nie Klartext), Idempotenz gegen Doppel-Versand (Wurzel 2).
- **Eigener Rate-Limit-Bucket** pro IP UND pro Nummer/Account (Wurzel 8).
- Migration: `otp_challenge`-Tabelle (id, user_id, channel, code_hash, expires_at,
  attempts, consumed_at) + RLS + REVOKE (nur service_role, Wurzel 6).

### 1d. Telefonnummer per SMS-OTP verifizieren (dein Wunsch)
- Airbnb-„Confirm account"-Flow: Nummer eingeben → OTP → bestätigen.
- **In Stufe 1 noch ohne echtes SMS** → Nummer wird per **E-Mail-OTP** verifiziert
  (Übergang), bis das SMS-Gateway (Stufe 2) steht. Sobald SMS live: Umschalten auf
  SMS-OTP ist nur ein anderer Adapter, kein Logik-Umbau.
- `users.phone_verified_at`-Spalte (neu) — echter Status, kein Fake.

**Stufe 1 ist komplett im eigenen Stack, braucht keinen SMS-Vertrag, keine Hardware.**

---

## STUFE 2 + 3 — SMS-Gateway (wenn Volumen/Bedarf kommt)

### Gateway-Software: Jasmin (self-hosted, Docker)
- OSS, De-facto-Standard für self-hosted A2P-Scale. HTTP-API (`POST /send`) →
  FastAPI ruft nur HTTP, **kein SMPP-Code in unserer App**.
- Deployment: **eigener Docker-Stack** (Jasmin + RabbitMQ + Redis), **getrennt vom
  DB-Stack** (unsere Regel „Worker nie in DB-Stack" gilt analog — ein crashender
  SMS-Dienst darf nie die Prod-DB reißen).
- HA bei Scale: 2–3 Jasmin-Instanzen gegen gemeinsames RabbitMQ+Redis.

### Der SMPP-Uplink (der einzige einzukaufende Baustein)
- **NICHT**: eigene Carrier-Direktverträge (Telekom/Vodafone/O2 einzeln) — für ein
  Startup unrealistisch (Monate Vorlauf, Mindestvolumen, Leased-Line, pro Netz).
- **NICHT**: Grey Routes — für OTP tödlich (Zustellung bricht unvorhersehbar ein,
  = Auth-Fehlschlag = Nutzer kommt nicht rein). In manchen Ländern illegal.
- **JA**: **A2P-Wholesale-SMPP-Direktroute(n)** — Anbieter, die einen **SMPP-Bind**
  verkaufen (nicht nur ihre REST-API). Reiner Transit, austauschbar. Bei Scale
  **zwei** Provider mit Failover-Routing in Jasmin. „Direct routes, no grey routes"
  vertraglich verlangen. Kandidaten-Kategorie: Tyntec, Sinch (Enhanced SMPP),
  T Wholesale, Orange Wholesale, BICS, LINK Mobility.

### DLR-Handling (kritisch, Wurzel 2)
- Jasmin ruft `dlr-url` (unser `/otp/dlr`) per HTTP. **Jeder DLR MUSS ge-ackt
  werden**, sonst re-delivered Jasmin endlos. Idempotent (message-id als Key,
  Status nur vorwärts). OTP kurz halten (<160 Zeichen GSM-7) → kein Multi-Segment.
- DLR „undelivered" → Orchestrator schaltet automatisch auf nächsten Kanal.

### Anti-SMS-Pumping (Pflicht, sonst wird die Rechnung zum Todesstoß)
- OTPs = ~89% des A2P-Fraud-Traffics. Ein offener „Nummer verifizieren"-Trigger ist
  das Angriffsprofil. Zwingend: Rate-Limit pro IP + pro Nummer (eigener Bucket),
  Geo-/Präfix-Allowlist (nur Länder mit echten Nutzern), Spike-Monitoring,
  Captcha vor dem Trigger (deckt auch offenen Audit-Punkt ab).

---

## Kostenrealität (ehrlich)

- A2P-SMS DE über Wholesale-SMPP-Direktroute: **~0,03–0,04 €/SMS**.
- Bei 100k Nutzern (10–50k OTP/Tag): **~10.000–50.000 €/Monat** Termination —
  **unabhängig** von Jasmin vs. SaaS (das ist der Funknetz-Preis, den auch Twilio
  weiterreicht). Gateway-Compute dagegen = Peanuts (2–3 Container).
- **Kostenhebel**: TOTP + E-Mail als Primärkanäle → SMS nur wo nötig → senkt
  sowohl Kosten als auch Angriffsfläche massiv.

---

## Was NICHT geht (klar benannt, kein Fake)

- **WhatsApp On-Premises**: seit 23.10.2025 tot (Meta), nur noch Cloud-API (SaaS).
  Kein self-hosted Weg. Als optionaler Zusatzkanal später denkbar, nicht jetzt.
- **RCS**: kein self-hosted Weg (Google/Carrier-gebunden). Verfrüht.
- **100% OSS bis ins Funknetz**: physikalisch unmöglich — die letzte Meile gehört
  den Carriern. Max. erreichbar: eigenes Gateway + austauschbarer SMPP-Transit.

---

## Empfohlene Reihenfolge (Vorschlag zur Freigabe)

1. **OTP-Slice + Kanal-Abstraktion** (Fundament, Stufe 1c) — Backend, Migration, RLS.
2. **TOTP ins Airbnb-Vollbild-Layout** heben (fast fertig).
3. **E-Mail-OTP-Adapter** (Mailcow) + **Nummer-Verifizierung** per E-Mail-OTP.
4. **Frontend**: Airbnb-„2-Faktor einrichten"-Flow (Vollbild-Sheet), Nummer-Confirm.
5. *(später, bei Bedarf)* **SMS-Adapter + Jasmin-Stack + Wholesale-SMPP** (Stufe 2/3).

Stufe 1 (Punkt 1–4) ist komplett im eigenen Stack, braucht **keinen Vertrag, keine
Hardware** und liefert sofort echte 2FA + Nummer-Verifizierung. SMS wird dann ein
reines Dazuschalten, kein Umbau.

---

## Offene Entscheidungen für dich

- **Reihenfolge ok?** Erst self-hosted-Fundament (TOTP+E-Mail), SMS später?
- **E-Mail-OTP jetzt bauen**, obwohl Mailcow-Versand erst ~2026-07-20 nach außen
  geht? (Code fertig, geht live sobald Port frei.)
- **Wholesale-Anbieter**: sollen wir für Stufe 2 konkrete Angebote einholen
  (Tyntec/Sinch/…), oder erst wenn die Nutzerzahl es verlangt?
