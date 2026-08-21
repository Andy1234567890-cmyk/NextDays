# Wie die Konkurrenz ihre öffentliche API baut — Recherche für die myNextDays Open API

Stand: 21.08.2026. Grundlage für `docs/OPEN-API.md` (unsere eigene Spezifikation)
und den Skill `.claude/skills/open-api/`.

Untersucht wurden drei Gruppen:

1. **Die Portale, an die wir selbst andocken** — Booking.com Connectivity API,
   Airbnb Homes/Activities API. Sie zeigen, wie ein *Nachfrage*-Riese seine
   Partner-Schnittstelle regiert (Zertifizierung, Pflichten, Sunset-Politik).
2. **Die direkte Software-Konkurrenz** — Guesty, Hostaway, Lodgify, Mews,
   Apaleo, Beds24, Smoobu, Cloudbeds. Das sind Häuser in unserer Rolle: ein PMS,
   das seinen Kunden eine öffentliche API gibt. Ihr Stand ist unser Maßstab.
3. **Die Standards von 2026** — OpenAPI, RFC 9457, Standard Webhooks,
   Idempotency-Key, RateLimit-Header, OWASP API Security Top 10.

Jede Aussage unten ist mit ihrer Quelle belegt. Wo eine Angabe öffentlich nicht
zu belegen war, steht das ausdrücklich da — es wird nichts geraten (Wurzel 4).

---

## 1. Booking.com Connectivity API

### 1.1 Aufbau des Entwicklerportals

Booking trennt sechs Dinge, die bei kleineren Anbietern in einer Seite
zusammenfallen:

| Baustein | Ort | Zweck |
| --- | --- | --- |
| Produkt-/Lösungsübersicht | `developers.booking.com/connectivity/home` | Welche APIs es gibt |
| Referenz-Doku | `developers.booking.com/connectivity/docs` | Wie man sie aufruft |
| Status-Seite | `connect.booking.com/status` | Läuft es gerade? |
| Öffentliche Roadmap | `developers.booking.com/connectivity/roadmap` | Was kommt, was stirbt |
| Provider Portal | `connect.booking.com` | Machine Accounts, Feature-Schalter |
| Support-/Community-Hub | `connectivity.booking.com` | Fragen, Zertifizierungsanträge |

Die Doku-Sidebar ist zweigeteilt: ein Querschnitts-Block **Getting Started**
(About, Authentication in vier Unterseiten, Postman-Tryout, cURL-Beispiel, Going
Live, Glossar, Changelog, Deprecation Policy, Migration Guides, Tutorials) und
darunter **ein Block je Fachdomäne** (Connections, Contracting, Property, Rooms,
Facilities, Content, Photo, Rates & Availability, Reservations, Payments,
Messaging, Guest Review, Reporting, Promotions, Market Insights …). Rund 25
Domänen, jede mit eigener Unter-Sidebar.
Quelle: <https://developers.booking.com/connectivity/docs>

Lehre für uns: Die Doku wird **nach Fachdomäne** gegliedert, nicht nach HTTP-Pfad,
und der Querschnitt (Auth, Fehler, Limits, Versionierung) steht **vor** der
Referenz, nicht darin verstreut.

### 1.2 Zwei Basis-URLs — getrennt nach PCI-Grad

- `https://supply-xml.booking.com` — alles außer Reservierungen (non-PCI).
- `https://secure-supply-xml.booking.com` — nur Abruf und Bestätigung von
  Reservierungen (PCI-Server, weil dort Kreditkartendaten fließen).
- Auth ist ein **dritter** Host: `connectivity-authentication.booking.com`.

Booking sagt ausdrücklich, man solle **nur die Domainnamen** in eine
IP-Allowlist eintragen, nicht die IP-Bereiche — die ändern sich ständig, und
Booking übernimmt keine Haftung für IP-basierte Allowlists.
Quelle: <https://developers.booking.com/connectivity/docs>

Lehre: Die Trennung nach Sensitivität ist bei Booking bis in den Hostnamen
gezogen. Unsere Trennung „Dashboard-API ≠ Partner-API" ist genau dasselbe
Prinzip, eine Ebene gröber.

### 1.3 Authentifizierung

Zwei Verfahren, eines davon planmäßig abgeschaltet:

| | Credential-based (Alt) | Token-based (Soll) |
| --- | --- | --- |
| Verfahren | Credentials bei jedem Request | JWT aus Client-ID/Secret |
| Status | deprecated 30.06.2025, **Sunset 31.12.2025** | aktiv |

Token-Fluss: Machine Account vom Typ „API token" im Provider Portal anlegen →
`POST https://connectivity-authentication.booking.com/token-based-authentication/exchange`
mit `client_id`/`client_secret` (JSON **oder** XML) → JWT.

- **TTL: 1 Stunde.**
- **Max. 30 Token pro Stunde** — gezählt pro Machine Account, nicht pro IP.
- JWT-Claims: Standard `sub`, `aud`, `iss` (`urn://connectivity-modern-auth/v1`),
  `exp`, `iat`, `jti` — plus eigene Claims **`test`**, `machine_account_id`,
  `provider_id`, `client_id`.
- Signaturprüfung über JWKS:
  `.../token-based-authentication/.well-known/jwks.json`, RSA/RS256, `kid`,
  **300 Requests/Stunde** Limit auf dem JWKS-Endpunkt selbst.
- Aufruf danach: `Authorization: Bearer {JWT}`.
- Abgelaufener Token → `401` mit
  `{"code":"401","message":"JWT is wrong or expired, please refresh your JWT."}`

Fehlerbilder am Token-Endpunkt, alle mit `ruid` im Body: `400` (Parameter
fehlt / falscher Content-Type), `401` (ungültig oder widerrufen), `405` (falsche
Methode), `415` (Content-Type fehlt oder unbekannt), `429` (Limit).
Quellen: <https://developers.booking.com/connectivity/docs/token-based-authentication>,
<https://developers.booking.com/connectivity/docs/authentication-best-practices>

Der **`test`-Claim im Token** ist der wichtigste Einzelbefund: Booking trennt
Test von Live nicht über einen anderen Host, sondern über einen Claim im Token
plus Test-Properties. Genau dieses Modell haben wir mit `api_clients.is_test`
bereits gebaut.

### 1.4 Antwort- und Fehlerkonventionen: die RUID

Jede Antwort trägt eine **RUID** („Response Unique IDentifier"), eindeutig pro
Antwort. Der Support findet damit den konkreten Request/Response im Log wieder —
und die Zertifizierung läuft darüber: Der Partner schickt die RUIDs seiner
Testaufrufe ein, Booking prüft sie im Log.
Quelle: <https://developers.booking.com/connectivity/docs/glossary_of_terms>

Die JSON-Hülle ist über alle Domänen gleich:

```json
{
  "meta":     { "ruid": "9ffdft22-11c0-40979-b2925-b79776462e3b" },
  "warnings": [],
  "errors":   [],
  "data":     { "property_id": 8011855, "status": "connected" }
}
```

Fehler tragen `code` (z. B. `MISSING_ARGUMENT`, `INVALID_ARGUMENT`,
`OPERATION_NOT_ALLOWED`), `message` und `details`. Statuscodes: 400 Client-Fehler,
401 Auth, 403 Autorisierung, 500 Server.
Quellen: <https://developers.booking.com/connectivity/docs/connections-api/managing-connections-api>,
<https://developers.booking.com/connectivity/docs/contracting-api/error-codes>

Kein RFC 7807/9457 — Booking hat ein Eigenformat. Die *Idee* dahinter ist
trotzdem richtig und für uns verbindlich: **eine Korrelations-ID in jeder
Antwort, und ein Fehler ist eine Liste, kein einzelner String** (mehrere Felder
können gleichzeitig falsch sein).

### 1.5 Rate-Limiting

Limits gelten **pro Endpunkt**, nicht global, und werden in einer Tabelle in der
Doku geführt — mit dem ausdrücklichen Vorbehalt, sie jederzeit ohne
Vorankündigung zu ändern oder für einzelne Accounts zu verschärfen:

| Endpunkt | Aufrufe/Minute |
| --- | --- |
| alle Endpunkte (Dach) | 10 000 |
| `/xml/reservationssummary` | 700 |
| `/ota/OTA_HotelDescriptiveContentNotif` | 75 |
| `/ota/OTA_HotelInvNotif` | 75 |
| `/ota/OTA_HotelProductNotif` | 75 |
| `/ota/OTA_HotelSummaryNotif` | 75 |
| `/ota/OTA_HotelDescriptiveInfo` | 100 |
| Photos API (POST pending_photos) | 100 |
| Property Profile API (PUT photo) | 150 |
| Request-to-Book (alle) | 200, Warnungen ab 170 |

Überschreitung → `429`. Empfehlung: exponentielles Backoff, Token cachen statt
neu holen. **Nicht belegt gefunden:** dokumentierte `X-RateLimit-*`-Header —
Booking nennt Zahlen in der Doku, aber keine Header.
Quellen: <https://developers.booking.com/connectivity/docs>,
<https://developers.booking.com/connectivity/docs/authentication-best-practices>

Lehre: **Teuer ≠ billig.** Ein Content-Push (75/min) und ein Reservierungsabruf
(700/min) dürfen nicht im selben Eimer liegen. Das deckt sich mit unserer
bestehenden Staffelung in `core/ratelimit_middleware.py`.

### 1.6 Versionierung, Deprecation, Sunset

Booking versioniert **pro Endpunkt/Operation**, nicht die API als Ganzes
(`OTA_HotelProductNotif` v1.0–v1.3). Die Politik ist zweistufig und benannt:

- **Deprecation** = keine Weiterentwicklung mehr, nur noch geschäftskritische
  Fixes; Nutzung bleibt möglich.
- **Sunsetting** = Abschaltung; Aufrufe liefern danach `400 Bad Request`.

Angekündigt wird über Changelog, Newsletter und Community, mit **Erinnerung
einen Monat vor dem Deprecation-Datum**. Deprecation wird technisch signalisiert:
als HTTP-Header, wenn ein ganzer Endpunkt betroffen ist, oder als
`warnings`-Array im Body, wenn nur ein Teil betroffen ist.

Belegte Beispiele für Fristen:

| Gegenstand | Deprecated | Sunset | Frist |
| --- | --- | --- | --- |
| Credential-based Auth | 30.06.2025 | 31.12.2025 | 6 Monate |
| `OTA_HotelRatePlanNotif` v1.0 | 13.10.2025 | 29.01.2026 | ~3,5 Monate |
| `OTA_HotelDescriptiveContentNotif` | 31.12.2024 | 31.12.2026 | 24 Monate |

Der Changelog hat vier feste Rubriken: *What is new? / What is going to change? /
What has changed? / What was fixed?* — jeder Eintrag mit Referenz-ID und Datum.
Die öffentliche Roadmap kategorisiert nach *New API, New Feature, Breaking
Change, Commercial, Deprecation, Migration, Advisory*, gruppiert nach
Geschäftsfunktion, mit Quartalsangabe.
Quellen: <https://developers.booking.com/connectivity/docs/deprecation-policy/deprecation-and-sunsetting>,
<https://developers.booking.com/connectivity/docs/changelog/changelog>,
<https://developers.booking.com/connectivity/roadmap>

Lehre: Eine Frist ohne Ankündigungskanal ist wertlos. Booking hat drei Kanäle
(Changelog, Roadmap, Header/Body-Warnung) und eine Erinnerungspflicht.

### 1.7 Push vs. Pull — und warum Booking bei Pull blieb

Reservierungen sind **Pull mit Quittung**, nicht Push:

1. Booking sammelt Reservierungsnachrichten in einer providereigenen Queue.
2. Der Partner holt sie: `GET OTA_HotelResNotif` (neu),
   `GET OTA_HotelResModifyNotif` (Änderung/Storno) — oder in einem Rutsch per
   B.XML `POST /reservations`.
3. Der Partner **quittiert** (`POST OTA_HotelResNotif` mit `<Success/>` oder
   `<Errors>`). Bis zur Quittung liefert der GET dieselbe Reservierung **immer
   wieder** aus. Die Doku sagt wörtlich, der Partner müsse diese Wiederholung
   behandeln und Doppelbuchungen vermeiden.
4. Ohne Quittung innerhalb von **30 Minuten** schickt Booking die Reservierung
   als **Fallback-E-Mail** an das Objekt; das Haus muss sie dann von Hand im
   Extranet nacharbeiten. Auf Antrag ist das Fenster auf 24 Stunden
   verlängerbar — mit dem ausdrücklichen Hinweis, dass das die Queue und die
   Überbuchungsgefahr wachsen lässt.

Wichtig: B.XML kann **nicht** quittieren. Nur der OTA-Weg ist fehlertolerant.
Client-Empfehlungen: 5 Minuten HTTP-Timeout, Parallelisierung, kleinere
`limit`-Werte, 40 % Kapazitätspuffer über der Spitzenlast.

Echten Push gibt es als **Connectivity Notification Service (CNS)** — aber
bewusst als *dünner Alarm*: die Notification enthält nicht die Nutzdaten,
sondern nur Metadaten (UUID, Typ, `payloadVersion`) und Kennungen; der Partner
muss danach die Detail-API pullen. Die Messaging-API wandert ausdrücklich von
Polling auf CNS. Bei Ausfall auf einer der beiden Seiten können Notifications
verloren gehen; der Rückweg ist eine Suche über die Fach-API, ausdrücklich nur
zur Wiederherstellung, nicht als reguläres Replay.
Quellen: <https://developers.booking.com/connectivity/docs/reservations-api/reservations-overview>,
<https://developers.booking.com/connectivity/docs/reservations-api/acknowledging-new-reservations-ota>,
<https://developers.booking.com/connectivity/docs/notification-service/notification-service-overview>

Lehre, und die ist unbequem: **Ein Webhook allein ist keine
Zustellgarantie.** Booking, der größte Absender von Buchungsnachrichten
weltweit, verlässt sich nicht darauf — er hält eine Queue, verlangt eine
Quittung und hat einen Papierweg als letzte Rettung. Wir brauchen für Webhooks
denselben Dreiklang: Zustellprotokoll, Wiederholung, und einen Pull-Endpunkt,
über den ein Partner nachholen kann, was er verpasst hat.

**Idempotenz:** Ein generischer `Idempotency-Key`-Header ist bei Booking
**nicht belegt gefunden**. Die Duplikat-Abwehr ist vollständig auf den Empfänger
abgewälzt („avoid creating duplicate bookings"). Das ist eine Schwäche, keine
Vorlage — hier gehen wir bewusst über Booking hinaus.

### 1.8 Test-Umgebung

- Eine **Test-Property** ist ein simuliertes Objekt mit fast allen Funktionen
  eines echten, aber nicht buchbar und nie auf Booking.com sichtbar.
- „Once a test property … always a test property" — sie kann **nie** live
  („Open Bookable") werden.
- Test-Properties lassen sich technisch nicht öffnen/schließen; die
  `Open`-Operation liefert dort einen definierten Fehler, was im
  Self-Assessment sogar als Prüfschritt genutzt wird.
- **Nicht belegt gefunden:** eine separate Sandbox-Basis-URL. Test und Live
  laufen über dieselbe Infrastruktur, getrennt allein durch Test-Property und
  `test`-Claim.
Quellen: <https://developers.booking.com/connectivity/docs/tut-ready-to-check>,
<https://developers.booking.com/connectivity/docs/property-api/status-endpoint/status-self-assessment>

### 1.9 Der Weg von Null bis Live

1. Portal-Zugang (wird im Onboarding vergeben; ein bestehender Kollege kann
   Nutzer anlegen).
2. Machine Account anlegen, Client-ID/Secret sichern.
3. Legal Entity ID besorgen — ohne sie kein Test-Property.
4. Test-Property über ein **15-Schritte-Tutorial** aufbauen (Details → Units →
   … → Availability → Status).
5. Status „Ready to Check" erreichen (automatische Inhaltsprüfung).
6. Self-Assessment fahren und **die RUIDs** an den Support schicken.
7. Going Live — je API entweder **Zertifizierung** (Support prüft echte
   Testaufrufe) oder **Self-Assessment**, plus Compliance-Nachweis:

| API | Compliance | Technisch |
| --- | --- | --- |
| Reservations | PCI **und** PII | Zertifizierung |
| Rates & Availability | – | Zertifizierung |
| Content, Property Details, Property Settings | PII | Zertifizierung |
| Messaging | PII | Zertifizierung |
| Payments | PCI | Self-Assessment |
| Guest Review, Reporting | PII | Self-Assessment |
| Promotions, Photo, Connections, Facilities | – | Self-Assessment |

8. **Beta-Rollout**: erst eine kleine Gruppe für die ersten Wochen, dann alle.
Quelle: <https://developers.booking.com/connectivity/docs/going_live>

Außerdem verlangt Booking von Partnern fachliche Mindestleistungen, die nichts
mit HTTP zu tun haben: alle API-Funktionen unterstützen, **mindestens ein
volles Jahr Preise und Verfügbarkeit** je Objekt laden, den Häusern eine
brauchbare Oberfläche für Zimmer/Raten geben, und die Zahl der Reservierungen
minimieren, die auf E-Mail zurückfallen.
Quelle: <https://developers.booking.com/connectivity/docs>

### 1.10 Doku-Artefakte

Vorhanden: Postman-Collection (nur für den Auth-/ARI-Einstieg, nicht für die
ganze Fläche), cURL-Beispielseite mit allen Pflicht-Headern, Glossar, Changelog
+ Archiv, Deprecation Policy, Migration Guides, Roadmap, Status-Page,
mehrsprachige Portal-PDFs, OTA-XSD (extern bei der OpenTravel Alliance) und
Bookings eigenes B.XML.

**Nicht belegt gefunden: ein öffentliches OpenAPI/Swagger-Dokument für die
Connectivity API.** Es gibt eines für Bookings separate Demand API, nicht für
Connectivity. Das ist der Punkt, an dem der Marktführer altert — und an dem wir
mit einer maschinenlesbaren Spec sofort besser sind.

---

## 2. Airbnb Homes / Activities API

Hier ist die Beweislage grundsätzlich anders: **`developer.withairbnb.com`
(vormals `developer.airbnb.com`) ist login-pflichtig.** Nur die Startseite ist
öffentlich, tiefere Seiten leiten auf einen OAuth-Login um. Öffentlich belegbar
sind daher die *Verträge* und die *Produktstruktur*, nicht die technischen
Details. Was unten steht, ist entsprechend gekennzeichnet.

### 2.1 Zugang: Einladung, nicht Anmeldung

Es gibt kein Self-Service-Onboarding. Airbnb wählt Partner aus; das Programm
heißt **Preferred Software Partner Program** (Stufen „Preferred" und
„Preferred+"). [Sekundärquellen: <https://www.hostaway.com/blog/airbnb-preferred-software-partner-2025/>,
<https://shorttermrentalz.com/news/airbnb-preferred-software-partners-2024/>]

Verbindlich und wörtlich aus den API Terms of Service — ein Partner **muss**:
NDA unterzeichnen, die API Terms akzeptieren, etwaige Partner Specific Terms
unterzeichnen, **Airbnbs Datensicherheits-Review bestehen**, und **alle
verpflichtenden API-Features innerhalb von 6 Monaten nach ihrer
Veröffentlichung umsetzen**.
[offiziell Airbnb: <https://www.airbnb.com/help/article/3418>]

### 2.2 Produktstruktur

Zwei Produkte, jedes mit eigenem Doku-Baum:

- **Homes API** — Getting Started, API Explorer, Sandbox V2 Testing, Manage
  Listings, Sync Availability Checks, Reservations.
- **Activities API** — Quickstart, API Explorer, Sandbox V2 Testing, Manage
  Activities, Sync Availability Checks, Messages API (inkl. QR-Codes).
- Gemeinsam: Changelog, **Valid Enumerations**, Knowledge Base, Support-Case-
  Management, Versioning; Werkzeuge: „Partner API Tools" (Bulk-Operationen) und
  ein **Error Dashboard**.
[offiziell Airbnb: <https://developer.withairbnb.com/>]

Zwei Bausteine daraus sind bemerkenswert und bei den PMS-Wettbewerbern nirgends
zu finden: eine eigene Seite **„Valid Enumerations"** (jede erlaubte
Aufzählung an einem Ort — genau das Problem, das bei uns die Kanal-Enum-Kette
löst) und ein **Error Dashboard**, in dem der Partner *seine eigenen*
Fehlerraten sieht, statt sie beim Support zu erfragen.

### 2.3 Auth

Die Verbindung eines Gastgeber-Kontos mit einem Partner läuft als
Browser-Redirect mit Zustimmungsdialog — Host loggt sich bei Airbnb ein,
bestätigt, wird zurückgeleitet. Vier voneinander unabhängige Partner beschreiben
denselben Ablauf. [Sekundärquellen: <https://docs.channex.io/channel-mapping-guides/airbnb>,
<https://wiki.beds24.com/index.php/Connect_Airbnb_Account>,
<https://www.ownerrez.com/support/articles/channel-management-api-integrations-airbnb-setup-connecting>,
<https://docs.rentalsunited.com/hc/en-gb/articles/35565560818973-Connecting-to-Airbnb>]
Der Grant-Typ wird von keiner Quelle wörtlich benannt; „Authorization Code" ist
eine Einordnung des beschriebenen Ablaufs, kein Zitat.

Scopes sind offiziell definiert als „sets of access permissions"; welche
verfügbar sind, hängt vom Programm ab, **liegt in Airbnbs Ermessen und kann
jederzeit ohne Haftung geändert werden**.
[offiziell Airbnb: <https://www.airbnb.com/help/article/3418>]
**Konkrete Scope-Namen: nicht belegt gefunden** — weder offiziell noch bei
irgendeinem der geprüften Partner.

**Token-/Refresh-Handling: nicht belegt gefunden.** Angaben wie „Token gilt 24 h"
kursieren, stammen aber ausschließlich aus Reverse-Engineering-Repos der alten
Consumer-Web-API (`api.airbnb.com/v2`) und werden hier ausdrücklich **nicht**
als Beleg verwendet. Dasselbe gilt für kursierende Endpunkt-Pfade wie
`/v2/listings` und für ein „API v3 (GraphQL)".

### 2.4 Webhooks

Ein Event-System existiert (die Airbnb-Hilfe beschreibt einen „API Status" im
Listing-Editor: Felder, die direkt bei Airbnb geändert wurden, werden von
Partner-Software nicht mehr überschrieben)
[offiziell Airbnb: <https://www.airbnb.com/help/article/2973>].
Aber: **konkrete Event-Namen und ein Signatur-Header sind nicht belegt
gefunden.** Was in Suchergebnissen als `X-Airbnb-Signature` mit HMAC-SHA256
auftaucht, ließ sich auf ein ausdrücklich als inoffiziell deklariertes
Drittanbieter-Repo zurückführen und wird verworfen.

Sauber belegt sind nur die Webhook-Systeme der *Partner* an ihre eigenen Kunden,
z. B. Channex mit `booking_new`, `booking_modification`,
`booking_cancellation`, `reservation_request`, `alteration_request`, `inquiry`,
`disconnect_listing`; ohne HMAC, dafür mit selbstgewähltem Secret-Header und
IP-Allowlist; Retry bei 5xx mit exponentiellem Backoff, max. 11 Versuche über
rund 24 Stunden. [Sekundärquelle: <https://docs.channex.io/api-v.1-documentation/webhook-collection>]

### 2.5 Rate Limits und Fehlerformat

Offiziell nur eine unbezifferte Ermächtigung: die API könne „call, volume, and
rate limits" haben, die Airbnb „at any time in its sole discretion" setzt.
Konkrete Zahlen, 429-Verhalten, Header oder Airbnbs Fehler-JSON: **nicht belegt
gefunden.** Eine kursierende Zahl „80 Requests/Minute/IP" ließ sich in den
genannten Quellen nicht verifizieren und wird verworfen.
[offiziell Airbnb: <https://www.airbnb.com/help/article/3418>]

### 2.6 Die Partner-Pflichten — der eigentliche Ertrag dieser Recherche

Das ist der Teil, der wörtlich belegt ist und den man beim API-Bau selten
mitdenkt. Alles aus <https://www.airbnb.com/help/article/3418> [offiziell Airbnb]:

| Pflicht | Frist |
| --- | --- |
| Meldung eines Vorfalls mit regulierten Daten (PHI/PCI/SOX) oder mit Credentials/Scopes/Content | **1 Stunde** |
| Meldung aller übrigen Security Incidents | **24 Stunden** |
| Root-Cause-Bericht auf Anfrage | 5 Werktage |
| Vorankündigung der Datenvernichtung bei Vertragsende | 7 Tage |
| Rückgabe/Vernichtung personenbezogener Daten nach Vertragsende | **30 Tage** |
| Patch: critical / high / medium / low | **7 / 30 / 90 / 180 Tage** |
| Verpflichtende neue API-Features umsetzen | 6 Monate |

Dazu: **MFA-Pflicht** für alles Personal, das API-Client, Scopes oder Content
berührt; keine geteilten Passwörter; mindestens vierteljährliche
Vulnerability-Scans und Risikoanalysen; OWASP-Top-10-Testpraxis;
Least-Privilege für Admin-Zugriffe; Audit-Recht Airbnbs (auch durch Dritte, auf
Airbnbs Kosten), bei Vorfällen „immediate and ongoing access" zu Meetings,
Berichten, Logs und Daten; Sperrung des Zugangs jederzeit ohne Vorwarnung.
Beide Seiten sind getrennte Verantwortliche im Datenschutzsinn.
**Nicht belegt gefunden:** eine Pflicht zu SOC 2 / ISO 27001 / PCI-DSS-
Zertifizierung — nur generisch „industry-standard or better safeguards".

Lehre: Eine Partner-API ist zur Hälfte ein Rechtsdokument. Wenn wir Partner
zulassen, brauchen wir dieselben Bausteine — Meldefristen, Löschfristen,
Patch-Fristen, MFA-Pflicht, Audit-Recht, Sperrrecht — sonst haften wir für
Fremdverschulden bei unseren eigenen Kundendaten.

### 2.7 Sandbox

Es gibt eine offizielle **„Sandbox V2 Testing"**-Umgebung, als Navigationspunkt
unter beiden Produkten belegt [offiziell Airbnb: <https://developer.withairbnb.com/>].
Ob sie vollständig von echten Konten getrennt ist: **nicht belegt gefunden**
(Detailseite hinter Login). In der Praxis berichtet Channex, dass für echte
Ende-zu-Ende-Tests ein **echtes, live geschaltetes Inserat** verbunden werden
muss, mit ausdrücklicher Warnung, dass Fake-Inserate zur Kontosperre führen
können. [Sekundärquelle: <https://docs.channex.io/guides/test-accounts-for-airbnb>]
Das deckt sich mit unserer eigenen Regel „Schreibtests am Live-Konto" in
`CLAUDE.md`.

---

## 3. Die direkte Konkurrenz: 8 PMS-Public-APIs im Vergleich

| Anbieter | Eigener API-Host | Auth | Version | Rate Limit | Doku-Werkzeug |
| --- | --- | --- | --- | --- | --- |
| **Guesty** | ja — `open-api.guesty.com` | OAuth2 client_credentials, TTL **24 h**, max. **5 Token/24 h** | `/v1` im Pfad | 15/s · 120/min · 5 000/h | eigenes Portal + `llms.txt` + Postman |
| **Hostaway** | nein/unbelegt (`api.hostaway.com` für beides) | OAuth2 client_credentials, TTL **24 Monate**, ein Scope `general` | `/v1` | 15/10 s pro IP, 20/10 s pro Konto | Slate auf GitHub, kein OpenAPI |
| **Lodgify** | ja — `api.lodgify.com` | **API-Key** im Header `X-ApiKey`, kein OAuth | `/v1` **und** `/v2` parallel | v1 600/min, v2 750/min, `.ics` 10/min | ReadMe.io + `llms.txt` |
| **Mews** | ja — inkl. eigener Demo-Host `api.mews-demo.com` | proprietäres Token-Paar **im Body** (`ClientToken` + `AccessToken` + `Client`) | **Datum je Operation** (z. B. „ver 2026-07-31") | 200/30 s pro Token (Sliding Window) | Mintlify + `llms-full.txt` |
| **Apaleo** | ja — `api.apaleo.com` (App: `app.apaleo.com`) | OAuth2 client_credentials über `identity.apaleo.com`, **granulare Scopes** (`units.read`, `reservations.manage`) | Version **je Modul** (`/inventory/v1`, Beta `/v0-nsfw`) | Live 3 500/min + Burst 200/s; Trial 5/s | Swagger-UI, mehrere Modul-Specs |
| **Beds24** | ja — `api.beds24.com/v2` | Invite-Code → Refresh-Token → kurzlebiger Access-Token, Header `token` | `v2` (v1 deprecated) | **Credit-System**, 100 Credits/5 min | Swagger-UI + MediaWiki |
| **Smoobu** | nein/unbelegt (`login.smoobu.com/api`) | **HMAC-SHA256** (`X-API-Key`/`X-Timestamp`/`X-Nonce`/`X-Signature`); Legacy-Key **Sunset 25.09.2026** | keine Pfad-/Header-Version | 1 000/min | Slate + Status-Page |
| **Cloudbeds** | im Übergang (`api.cloudbeds.com` neu, `hotels.cloudbeds.com` alt) | OAuth2 Authorization Code + API-Key-Alternative; Access-Token **8 h**, Refresh unbegrenzt | `v1.2` im Pfad | uneinheitlich dokumentiert (5–10/s) | ReadMe.io + Teil-OpenAPI auf GitHub |

### 3.1 Was alle acht gleich machen (Branchenkonsens)

- **Webhooks** sind bei allen acht das Push-Mittel. Kein Anbieter setzt auf
  Polling als Hauptweg.
- **HTTP 429** bei Überlast — bei allen.
- **Irgendeine** Form von Versionierung — bei allen.
- **Kein einziger** nutzt RFC 7807/9457 `application/problem+json`. Acht
  Eigenformate:
  Guesty (kein Standard, Header `x-request-id`), Hostaway
  `{"status":"fail","result":"…"}`, Lodgify
  `{message, code, correlation_id, event_id}`, Mews
  `{Message, RequestId, Details}`, Apaleo (problem+json nur sekundär
  angedeutet), Beds24 `{success, Errors}`, Smoobu
  `{status, title, detail, validation_messages}`, Cloudbeds gleich **drei**
  parallele Formen.
- **Kein einziger** dokumentiert einen **`Idempotency-Key`**. Bei allen acht:
  nicht belegt gefunden.
- 6 von 8 trennen die Public API mindestens im Hostnamen von der App
  (Ausnahmen: Hostaway, Smoobu).

### 3.2 Wo sie sich unterscheiden

- **Auth**: OAuth2 client_credentials (Guesty, Hostaway, Apaleo) · OAuth2
  Authorization Code (Cloudbeds) · reiner API-Key (Lodgify) · HMAC-Signatur
  (Smoobu) · proprietäre Token im Body (Mews, Beds24).
- **Token-TTL**: 24 Stunden (Guesty) bis **24 Monate** (Hostaway) bis
  „unbegrenzt" beim Refresh-Token (Cloudbeds). Hostaways 24 Monate sind ein
  Sicherheitsproblem, keine Bequemlichkeit.
- **Pagination**: `limit`/`skip` (Guesty) · `limit`/`offset`/`page` + Cursor
  `afterId` (Hostaway) · `pageNumber`/`pageSize` (Apaleo, Smoobu) · echter
  Cursor `Cursor`+`Count` mit Hülle `{Data, Cursor}` (Mews) · uneinheitlich je
  Endpunkt (Cloudbeds).
- **Webhook-Signatur**: HMAC mit dokumentiertem Header (Lodgify `ms-signature`,
  Smoobu `X-Signature`) · Secret ohne dokumentierten Algorithmus (Guesty) ·
  **gar keine HMAC, nur optionaler Shared Secret in der URL** (Mews) · nicht
  dokumentiert (Apaleo, Cloudbeds).
- **Webhook-Registrierung**: Self-Service per API (Guesty, Lodgify, Smoobu,
  Cloudbeds, Apaleo) · UI + API (Beds24, Hostaway) · **nur per E-Mail an den
  Partner-Success** (Mews).
- **Sandbox**: eigener Host mit festen Test-Tokens (Mews) · kostenloser
  Dev-Account auf Live-Infrastruktur (Apaleo) · kostenpflichtig auf Anfrage
  (Guesty Booking Engine, Cloudbeds) · nichts dokumentiert (Hostaway, Lodgify,
  Beds24, Smoobu).
- **Retry-Verhalten**: Hostaway 3× in ~1 h · Cloudbeds max. 5× mit 1 min
  Abstand und **explizit keiner Reihenfolgegarantie** · Lodgify bis 10× mit
  Auto-Deaktivierung bei HTTP 410 · Mews „nach ein paar Minuten", Empfänger
  muss binnen **5 s** antworten.

### 3.3 Die drei offenen Flanken der Branche

1. **Kein Idempotency-Key.** Bei einer API, über die Buchungen und Stornos
   laufen, ist das die gefährlichste Lücke — ein Netzwerk-Timeout beim
   `POST /reservations` und der Partner weiß nicht, ob gebucht wurde. Retry
   erzeugt die Doppelbuchung.
2. **Acht Fehlerformate.** Ein Partner, der drei PMS anbindet, schreibt drei
   Fehlerparser.
3. **Uneinheitliche/fehlende Webhook-Signaturen.** Mews' „Secret in der URL"
   landet in jedem Proxy-Log.

Alle drei sind mit vorhandenen Standards lösbar (siehe Abschnitt 4). Das ist
unser konkreter Vorsprung, nicht ein Marketing-Satz.

### 3.4 Quellen (Auszug)

Guesty: <https://open-api-docs.guesty.com/docs/authentication>,
<https://open-api-docs.guesty.com/docs/rate-limits>,
<https://open-api-docs.guesty.com/llms.txt> ·
Hostaway: <https://api.hostaway.com/documentation> ·
Lodgify: <https://docs.lodgify.com/docs/authorization>,
<https://docs.lodgify.com/docs/rate-limits>,
<https://docs.lodgify.com/docs/errors>,
<https://docs.lodgify.com/reference/webhooks> ·
Mews: <https://docs.mews.com/connector-api/guidelines/environments>,
<https://docs.mews.com/connector-api/guidelines/authentication>,
<https://docs.mews.com/connector-api/guidelines/pagination>,
<https://docs.mews.com/connector-api/events/wh-faq> ·
Apaleo: <https://apaleo.dev/guides/api/overview.html>,
<https://apaleo.dev/guides/api/rate-limiting.html>,
<https://api.apaleo.com/swagger/index.html> ·
Beds24: <https://api.beds24.com/v2/> ·
Smoobu: <https://docs.smoobu.com/>,
<https://support.smoobu.com/hc/en-us/articles/36304895666450> ·
Cloudbeds: <https://developers.cloudbeds.com/reference/tech-specs>,
<https://developers.cloudbeds.com/docs/webhooks-1>,
<https://github.com/cloudbeds/openapi-specs>

Einschränkung: `wiki.beds24.com` blockte den Abruf durchgängig mit HTTP 403 —
die Beds24-Angaben stützen sich auf Suchergebnis-Auszüge, nicht auf gelesenen
Volltext. Bei Apaleo und Beds24 liefern die Swagger-Seiten client-seitig
gerendertes HTML, sodass Teile nur indirekt belegt sind.

---

## 4. Die Standards, an die wir uns halten (Stand 2026)

### 4.1 OpenAPI

- Aktuell veröffentlicht: **3.2.0** (19.09.2025), abwärtskompatibel zu 3.1/3.0,
  neu vor allem sequentielle Media-Types (SSE, JSONL) via `itemSchema`.
  <https://spec.openapis.org/oas/v3.2.0.html>
- **3.1** ist der Stand mit voller Werkzeugunterstützung: JSON Schema 2020-12,
  `jsonSchemaDialect`, SPDX-Lizenz-Identifier und — entscheidend — das
  Top-Level-Objekt **`webhooks`**. Mindestens eines von `paths`, `components`,
  `webhooks` muss vorhanden sein.
  <https://spec.openapis.org/oas/v3.1.0>,
  <https://github.com/OAI/OpenAPI-Specification/pull/2103>
- Unterschied zu `callbacks` (3.0): ein Callback hängt an einer Operation und
  beschreibt die Antwort auf einen vorherigen Aufruf; `webhooks` beschreibt
  Server→Client-Events **ohne** vorherigen Request.
  <https://www.speakeasy.com/openapi/webhooks/>
- OpenAPI 4.0 „Moonwalk": in Entwurfsphase, **kein Release**.
- Renderer: Swagger UI (Referenz, robust), Redoc (nur lesen), **Scalar** (seit
  2023, eingebauter Client, kleines Bundle), Stoplight Elements.

**Unsere Wahl: OpenAPI 3.1** — wegen `webhooks` und weil das Werkzeug-Ökosystem
für 3.2 erst nachzieht.

### 4.2 Fehler: RFC 9457

**RFC 9457 „Problem Details for HTTP APIs"** (August 2023) ersetzt RFC 7807.
Felder: `type` (URI, Default `about:blank`), `status`, `title`, `detail`,
`instance`; Content-Type **`application/problem+json`**; Erweiterungsfelder
erlaubt, Clients müssen Unbekanntes ignorieren.
<https://www.rfc-editor.org/rfc/rfc9457.html>

Gegenmodell Stripe: `error.type` ∈ `api_error | card_error | idempotency_error |
invalid_request_error`, dazu `code`, `message`, `param`, `doc_url`.
<https://docs.stripe.com/api/errors>

**Unsere Wahl: RFC 9457** mit Erweiterungsfeldern `request_id`, `code` und
`errors[]` (Feldliste). Grund: Es ist der Standard, es ist
Gateway-kompatibel — und keiner der acht Wettbewerber hat es. Stripes `code`
und Bookings `errors`-Liste sind als Erweiterung mit aufgenommen, weil beide
sich in der Praxis bewährt haben.

### 4.3 Rate-Limit-Header

- IETF-Entwurf **draft-ietf-httpapi-ratelimit-headers-11** (23.05.2026, läuft
  24.11.2026 ab, **noch keine RFC**). Nicht mehr die alte Drei-Header-Form,
  sondern zwei Structured Fields (RFC 9651):
  `RateLimit-Policy: "burst";q=100;w=60,"daily";q=1000;w=86400` und
  `RateLimit: "default";r=50;t=30`.
  <https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-11>
- `Retry-After`: RFC 9110 §10.2.3 · `429`: RFC 6585 (dort ist `Retry-After` nur
  SHOULD; 429-Antworten dürfen nicht gecacht werden).
- Praxis: **Stripe** schickt gar keine `RateLimit-*`-Header, nur 429 plus
  `Stripe-Rate-Limited-Reason`. **GitHub** nutzt `x-ratelimit-limit`,
  `-remaining`, `-used`, `-reset`, `-resource` plus `Retry-After`. Kein großer
  Anbieter setzt den Entwurf 1:1 um.

**Unsere Wahl: beides senden** — `RateLimit`/`RateLimit-Policy` nach Entwurf-11
**und** die eingebürgerten `X-RateLimit-*`, plus immer `Retry-After` bei 429.
Zwei Header kosten nichts und ersparen jedem Partner Rätselraten.

### 4.4 Idempotenz

- IETF-Entwurf **draft-ietf-httpapi-idempotency-key-header-07** (15.10.2025,
  abgelaufen, keine RFC): `Idempotency-Key` als Structured-Field-String, UUID
  empfohlen; **409 Conflict** bei parallel laufender gleicher Anfrage;
  optionales Payload-Fingerprinting; 400 wenn Pflicht-Header fehlt, 422 bei Key
  mit abweichendem Payload.
  <https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07>
- **Stripe**: `Idempotency-Key` ≤ 255 Zeichen, UUIDv4 empfohlen; Status **und**
  Body der ersten Anfrage werden gespeichert und beim Retry identisch
  zurückgegeben (auch 5xx); Fenster **mindestens 24 Stunden**; abweichende
  Parameter zum selben Key → Fehler; parallel laufender gleicher Key →
  Konflikt; gilt nur für `POST`. <https://docs.stripe.com/api/idempotent_requests>
- **Shopify**: identisches Muster, ebenfalls 24-Stunden-Fenster.
  <https://shopify.dev/docs/api/usage/implementing-idempotency>
- PayPal nutzt denselben Mechanismus unter eigenem Namen
  (`PayPal-Request-Id`).

**Unsere Wahl: Stripe-Modell** (24 h, UUID, Fingerprint-Vergleich, 409 bei
Parallelität, Pflicht für jeden geldnahen und buchungsnahen POST). Das ist
zugleich die Umsetzung von **Wurzel 2** unserer Projektregeln — „real kommt
alles doppelt" — auf der öffentlichen Oberfläche.

### 4.5 Pagination

- **RFC 8288 „Web Linking"** definiert `Link: <uri>; rel="next"`.
- **Stripe**: Cursor über `starting_after`/`ending_before` (Objekt-ID),
  `limit` 1–100 (Default 10), Hülle `{object:"list", data:[], has_more, url}`.
  <https://docs.stripe.com/api/pagination>
- **GitHub**: seitenbasiert über den `Link`-Header, `per_page` max. 100.

**Unsere Wahl: Cursor à la Stripe** (`starting_after`, `limit`, `has_more`),
zusätzlich `Link`-Header. Grund: Buchungslisten ändern sich während des
Blätterns; Offset überspringt oder wiederholt dann Zeilen.

### 4.6 Versionierung und Abkündigung

- **Stripe**: Header `Stripe-Version` mit Datum; Rangfolge expliziter Header →
  OAuth-App-Version → auf das Konto gepinnte Version.
- **Shopify**: Quartalsversionen (`2026-01`, `2026-04`), jede stabile Version
  **mindestens 12 Monate** unterstützt, **mindestens 9 Monate Überlappung**.
  <https://shopify.dev/docs/api/usage/versioning>
- **RFC 8594** `Sunset`-Header (Zeitpunkt der Abschaltung) und **RFC 9745**
  `Deprecation`-Header (März 2025, Standards Track) bilden zusammen das
  Zweiphasenmodell — genau die Zweiteilung, die Booking fachlich schon fährt.
  <https://www.rfc-editor.org/rfc/rfc8594.html>, <https://www.rfc-editor.org/info/rfc9745/>

**Unsere Wahl: `/v1` im Pfad** (für ein kleines Partner-Ökosystem einfacher als
Datumsversionen) **plus** `Deprecation`- und `Sunset`-Header beim Abkündigen,
Support-Fenster analog Shopify (≥ 12 Monate Laufzeit, ≥ 9 Monate Überlappung),
und ein Changelog mit Bookings vier Rubriken.

### 4.7 Webhooks: Standard Webhooks

Drei Header: `webhook-id` (Event-ID), `webhook-timestamp` (Unix-Sekunden),
`webhook-signature` (eine **oder mehrere**, leerzeichengetrennt — dadurch ist
Secret-Rotation ohne Ausfall möglich). Signiert wird
`{webhook-id}.{webhook-timestamp}.{payload}` per HMAC-SHA256, Base64, mit
Präfix `v1,`. Zustellung ist **at-least-once**; Beispiel-Retry-Plan mit
exponentiellem Backoff von 5 Sekunden bis über 75 Stunden. Der Empfänger muss
den Zeitstempel gegen die aktuelle Zeit prüfen (Replay-Schutz); ein fester
Toleranzwert steht nicht im Kerntext, Referenz-Implementierer nehmen 5 Minuten.
<https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md>

Stripe zum Vergleich: `Stripe-Signature: t=<ts>,v1=<hmac>`, HMAC-SHA256 über
`timestamp + "." + rawBody`, **Standardtoleranz 5 Minuten**, mit ausdrücklicher
Warnung, die Toleranz nie auf 0 zu setzen. Verifikation braucht den
**unveränderten** Rohkörper. <https://docs.stripe.com/webhooks/signature>

**Unsere Wahl: Standard Webhooks** (fertige SDKs beim Partner, mehrere
Signaturen für Rotation), 5-Minuten-Toleranz, at-least-once mit
Zustellprotokoll — und, aus der Booking-Lehre in 1.7, **zusätzlich ein
Pull-Endpunkt zum Nachholen verpasster Events**. Ein Webhook allein ist keine
Zustellgarantie.

### 4.8 Auth

- **RFC 6749** §4.4 Client Credentials: kein Resource Owner beteiligt, in der
  Regel kein Refresh-Token.
- **RFC 9700** (Best Current Practice OAuth 2.0 Security): Implicit Grant und
  Resource Owner Password Credentials sind **abgekündigt**.
- **RFC 8725** (JWT BCP): erlaubte Algorithmen **müssen** auf eine Whitelist
  begrenzt werden (sonst Algorithm Confusion RS256↔HMAC), `alg: none` nicht
  verwenden, **`aud` muss geprüft werden**, Passwörter nie als HMAC-Schlüssel.
- Scope-Design `resource:action` — GitHub (`repo:status`), Stripes Restricted
  Keys (pro Ressource None/Read/Write).
- Praxis: kurzlebige Access-Tokens (5–60 min), rotierende Refresh-Tokens,
  Client-Secret-Rotation mit Überlappungsfenster (Auth0-Muster).
- Stärker als ein statisches Secret: mTLS (**RFC 8705**) oder
  `private_key_jwt`.

**Unsere Wahl:** OAuth2 `client_credentials` → JWT mit 1 h TTL (Booking-Wert),
Scopes `resource:action`, `aud`-Prüfung strikt (unser Token trägt schon die
eigene Audience `mynextdays-api`), Secret-Rotation mit Überlappung, und ein
`test`-Claim wie bei Booking. HS256 bleibt, solange Aussteller und Prüfer
derselbe Dienst sind — **kein JWKS-Endpunkt**, weil es bei einem symmetrischen
Verfahren keinen öffentlichen Schlüssel zu veröffentlichen gibt. Wollen wir
Partnern eine lokale Signaturprüfung erlauben, ist der Umstieg auf RS256 + JWKS
der dokumentierte nächste Schritt, nicht ein „öffentlicher" HMAC-Schlüssel.

### 4.9 Weitere Pflichtbausteine

- **Korrelation**: `X-Request-Id` für einen Aufruf, `X-Correlation-Id` für eine
  Transaktion über mehrere Aufrufe; Client-Header übernehmen, sonst UUIDv4
  erzeugen, in Request **und** Response spiegeln. Bookings RUID ist genau das.
- **CORS**: laut MDN ausschließlich ein Browser-Mechanismus. Eine reine
  Server-zu-Server-API braucht **keine** CORS-Header.
  <https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS>
- **Feldnamen**: `snake_case` dominiert bei Stripe/GitHub/Twilio/Slack/OpenAI.
- **Zeitstempel**: RFC 3339, UTC, `YYYY-MM-DDTHH:MM:SSZ`.
- **Geld**: kleinste Einheit (Minor Unit) ohne Dezimalstellen, dazu der
  ISO-4217-Code — Sonderfälle bei Nulldezimal-Währungen (JPY) und bei
  ISK/HUF/TWD/UGX. <https://docs.stripe.com/currencies>
  Das ist die technische Fassung unserer **Wurzel 4**: die Währung kommt aus den
  Daten, nie aus einem Default.
- **Enums**: Google AIP-126 verlangt einen `_UNSPECIFIED`-Wert für
  Vorwärtskompatibilität; Zalando behandelt JSON-Enums als geschlossen
  (Erweiterung = Breaking Change) und verlangt „Tolerant Reader" — unbekannte
  Felder ignorieren, nicht verwerfen.
- **Sandbox**: Stripe hat vom globalen Test-Mode auf **isolierte Sandboxes**
  mit eigenen Keys/Objekten/Webhooks umgestellt (seit 2025/26 Default).
- **`llms.txt`** (<https://llmstxt.org/>): Markdown-Wegweiser für KI-Agenten,
  bei Stripe, Anthropic, Cloudflare, Vercel im Einsatz — und, in unserem Markt,
  bereits bei **Guesty, Lodgify, Mews und Cloudbeds**. Kein Kernstandard, aber
  billig und inzwischen erwartbar.
- **MCP**: Spec-Version 2026-07-28. Wir haben bereits einen MCP-Slice
  (`features/mcp`) — die Open-API-Spec ist die natürliche Quelle für weitere
  MCP-Werkzeuge.

### 4.10 Sicherheit

Maßgeblich bleibt **OWASP API Security Top 10:2023** — eine API-spezifische
2025/2026-Fassung gibt es **nicht** (der allgemeine Web-App-Top-10 hat eine
2025er Ausgabe, das ist ein anderes Projekt).
<https://owasp.org/API-Security/editions/2023/en/0x11-t10/>

Die drei, die eine Partner-API wirklich treffen:

- **API1 BOLA** — Objekt-IDs im Request manipulieren. Gegenmaßnahme:
  Autorisierung aus der Nutzer-/Mandanten-Policy, **bei jeder Operation**, nicht
  aus einem Client-Parameter. Das ist deckungsgleich mit unseren Wurzeln 3 und 9.
- **API4 Unrestricted Resource Consumption** — fehlende Obergrenzen bei
  Datums-Spannen, Listen, Payloads, Timeouts. Deckungsgleich mit Wurzel 8.
- **API7 SSRF** — tritt laut OWASP typischerweise genau bei **Webhooks** und
  URL-Abrufen auf. Gegenmaßnahmen: robuster URL-Parser, Allowlist für
  Schema/Port/Ziel, Redirects aus, Rohantworten nie durchreichen. Ergänzend aus
  dem SSRF-Cheat-Sheet: DNS auflösen, prüfen, und **auf die geprüfte IP pinnen**
  (Rebinding-Schutz), interne und Metadaten-IPs sperren
  (`169.254.169.254`). Deckungsgleich mit Wurzel 8 — nur dass es diesmal die
  Webhook-URL des Partners ist, die wir abrufen.

---

## 5. Was daraus für myNextDays folgt

| Baustein | Unsere Entscheidung | Vorbild / Beleg |
| --- | --- | --- |
| Trennung | eigener Dienst, eigene Domain `api.mynextdays.dk`, eigene Spec | Guesty, Apaleo, Mews, Booking (6/8 der Branche) |
| Auth | OAuth2 client_credentials → JWT 1 h, `resource:action`-Scopes, `test`-Claim | Booking (TTL + Test-Claim), Apaleo (Scopes) |
| Token-Limit | eigener strenger Eimer auf `/oauth/token` | Booking 30/h, Guesty 5/24 h |
| Fehler | **RFC 9457** `application/problem+json` + `request_id` + `errors[]` | RFC 9457; besser als alle 8 Wettbewerber |
| Korrelation | `X-Request-Id` in jeder Antwort | Bookings RUID |
| Idempotenz | `Idempotency-Key`, 24 h, Fingerprint, 409 bei Parallelität | Stripe/Shopify; **Lücke bei allen 8** |
| Pagination | Cursor `starting_after`/`limit`/`has_more` + `Link` | Stripe, RFC 8288 |
| Rate-Limits | pro Domäne gestaffelt, `RateLimit`+`X-RateLimit-*`+`Retry-After` | Booking (pro Endpunkt), GitHub (Header) |
| Webhooks | Standard Webhooks HMAC-SHA256, mehrere Signaturen, at-least-once + Zustellprotokoll + **Nachhol-Pull** | standardwebhooks.com + Booking-Queue-Lehre |
| Webhook-Sicherheit | Partner-URL: nur `https`, IP-Pinning, interne Netze gesperrt, kein Redirect | OWASP API7 + Wurzel 8 |
| Version | `/v1` im Pfad, `Deprecation`+`Sunset`-Header, ≥ 12 Monate Laufzeit / ≥ 9 Monate Überlappung | RFC 8594/9745, Shopify |
| Test/Live | `is_test` am Client, Testdaten getrennt, gleiche Basis-URL | Booking (Test-Property + Claim) |
| Doku | Getting Started → Auth → Fehler → Limits → Webhooks → Changelog, dann Referenz je Domäne | Booking-Gliederung |
| Maschinenlesbar | öffentliche OpenAPI 3.1 unter `/openapi.json`, dazu `llms.txt` | Booking hat **keine** — hier ziehen wir vorbei |
| Objekt-Scope | jeder `{id}`-Endpunkt prüft Mandant **und** `property_ids` des Clients | OWASP API1 + Wurzeln 3/9 |
| Betrieb | Status-Seite, Changelog, Fehler-Dashboard je Partner | Booking Status, Airbnb Error Dashboard |

Zwei Dinge übernehmen wir bewusst **nicht**:

- **Bookings XML-Doppelwelt** (OTA + B.XML). Wir liefern JSON, eine Sprache.
- **Airbnbs Einladungsmodell.** Unsere API steht jedem Kunden offen, der einen
  Client anlegt — der Zugang ist Selbstbedienung im Konto, nicht ein
  Vertriebsprozess. Die *Pflichten* aus Airbnbs Terms (Meldefristen,
  Löschfristen, MFA) gehören dagegen in unsere Nutzungsbedingungen, sobald
  Partner Gastdaten verarbeiten.
