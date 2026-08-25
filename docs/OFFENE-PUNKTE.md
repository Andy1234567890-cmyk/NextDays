# Offene Punkte — Stand 09.08.2026

**Interne Bestandsaufnahme, nicht für Kunden.** Was hier steht, darf **nicht**
in `NEUERUNGEN-VORLAGE.md` als fertig angekündigt werden.

Gegliedert nach Dringlichkeit. Jeder Punkt nennt: was fehlt, wer es merkt, wer
es erledigen muss. Wo ich es nicht sicher belegen konnte, steht das ausdrücklich
dabei.

**Was gerade grün ist** (selbst ausgeführt, keine Behauptung):

| Prüfung | Ergebnis |
|---|---|
| `pytest` (apps/api) | **2422 passed, 6 skipped** — die 6 sind Stripe-Tests, die ohne `STRIPE_SECRET_KEY` übersprungen werden (Altbestand, nicht aus diesem Durchgang) |
| `bunx tsc --noEmit` (web) | **sauber** |
| `bunx tsc --noEmit` (admin) | **sauber** |
| `bun run lint` (web) | **sauber** |
| `TODO`/`FIXME`/`HACK` in allen geänderten Dateien | **keine Treffer** |

Nicht geprüft (bewusst, kostet Zeit ohne neuen Erkenntniswert): `tsc`/Lint in
`builder`, `plattform`, `gastgeber` und beiden Mobile-Apps — sie wurden in
diesem Durchgang nur am Rand berührt (`gastgeber`: Anzeige-Anpassungen,
`mobile-nextdays`: Portal-Logos). `bun run lint` in `admin` steht noch aus.

---

## 1. Blockiert den Deploy

### 1.1 Coolify-Redeploy von `nextdays-api` ist Pflicht, nicht optional
Die Variablen `APP_BASE_URL`, `MARKETPLACE_BASE_URL` und die neun `COMPANY_*`
sind in Coolify **gesetzt**, wirken aber erst im nächsten Deploy — Coolify
reicht Env-Änderungen nicht in den laufenden Container.

**Solange das nicht passiert ist:** Jede Einladung scheitert mit `500`
(`APP_BASE_URL` fehlt → der Code verweigert bewusst einen geratenen Link), und
jede Mail trägt in der Fußzeile den sichtbaren Mangelhinweis
„Anbieterangaben sind auf diesem Server nicht hinterlegt".

Das heißt konkret: **Ohne Redeploy ist das halbe Update tot** — Eigentümer-Portal
ohne Einladungsmails ist kein nutzbares Feature.

Beleg: `deploy/ENVIRONMENT.md:17-22`.
**Wer:** Nutzer selbst (Coolify).

**Stand 25.08.2026 — ERLEDIGT.** Der Drift lag beim `worker`: nachgemessen im
laufenden Container (`bash scripts/diagnose/mail-umgebung-pruefen.sh`) trug die
API alles, der Worker nichts davon. Die zwölf Variablen sind inzwischen gesetzt
und der Worker ist neu deployt; das Skript meldet beide Prozesse vollständig.

| Prozess | `APP_BASE_URL` | `COMPANY_*` | `FCM_SERVICE_ACCOUNT_JSON` | `MARKETPLACE_BASE_URL` | `STRIPE_SECRET_KEY` |
|---|---|---|---|---|---|
| `nextdays-api` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `nextdays-worker` (vorher) | ❌ | ❌ | ❌ | ❌ | ❌ |
| `nextdays-worker` (nach Deploy) | ✅ | ✅ | ✅ | ✅ | ✅ |

Das ist keine Kleinigkeit: der Worker fährt die Gast-Automails
(`InboxService.dispatch_due_automations`, `worker.py:1096`), die
Bewertungsanfragen (`reviews.automation`, `worker.py:1054`) und die
Zustellproblem-Meldungen (`inbox/planung.py:1411`). Jede dieser Mails geht
derzeit **ohne Anbieterangaben und ohne Link** hinaus, und Push aus dem Worker
gar nicht (kein FCM-Schlüssel).

Beide Anwendungen fahren **denselben Code aus demselben Repo**, sind in Coolify
aber zwei Anwendungen mit je eigener, handgepflegter Variablenliste — nichts
verglich sie. Das Skript oben tut es jetzt; es gehört vor jeden Deploy, der
Mails berührt.

### 1.1b Derselbe Drift trifft die drei Geld-Läufe des Workers
Nachgeprüft am 25.08.2026: dem Worker fehlt auch **`STRIPE_SECRET_KEY`**
(`STRIPE_PLATFORM_FEE_PCT` und `STRIPE_WEBHOOK_SECRET` hat er).
`STRIPE_PUBLISHABLE_KEY` braucht er nicht — den liest nur der Request-Pfad.

Betroffen sind die drei geldbewegenden Läufe, die ausschließlich dort fahren
(jetzt gebündelt in `apps/api/src/jobs/geld_laeufe.py`):

| Lauf | Takt | ohne Schlüssel |
|---|---|---|
| Einzug fälliger Restzahlungen | stündlich | kein Einzug |
| Auszahlungen an die Betriebe | Tick | keine Auszahlung |
| Provisions- + Nutzungsabrechnung | **nur am Monatsersten** | keine Faktura, nächster Versuch in einem Monat |

**Belegbarer Schaden: nicht nachgewiesen.** Der Container läuft erst seit dem
24.08., der Provisionslauf kam seither nicht vorbei, und der Einzugslauf fand
keine fälligen Zeilen — es gibt also keine Logzeile, die den Ausfall zeigt. Das
ist kein Entlastungsbeweis, sondern genau das Problem: der Mangel wäre auch
dann unsichtbar geblieben, wenn er zugeschlagen hätte.

**Im Code behoben** (die eigentliche Wurzel, unabhängig von der Variablen):
- Alle drei Läufe fingen den Fehlschlag im breiten `except Exception` des Ticks
  und schrieben `log.warning` — dieselbe Zeile wie bei einer abgelehnten Karte.
  Jetzt: eigener Ereignisname je Lauf, Stufe **ERROR**, Handlungsanweisung in
  der Meldung (`core/pflichtumgebung.py`).
- Der Worker meldet beim **Start**, welche Pflichtvariable ihm fehlt — sonst
  fiele es beim Provisionslauf frühestens am nächsten Monatsersten auf.
- Eigene Fehlertypen `PaymentsConfigError` / `SubscriptionsConfigError`
  (Unterklassen, Router unverändert): ein Betriebsmangel trifft ALLE Zeilen,
  eine abgelehnte Karte EINE. Die Monatsläufe isolierten bisher beides gleich.
- **Der teuerste Einzelfall:** `charge_due_balance` löste den Stripe-Client erst
  auf, NACHDEM die Zeile auf `charging` stand. Ein fehlender Schlüssel schrieb
  sie damit auf `failed` — obwohl sie nie bei Stripe war — und der stündliche
  Tick greift `failed` nie wieder auf. Echte Forderungen wären dauerhaft
  verloren gewesen (Wurzel 1). Der Client wird jetzt vor dem Claim aufgelöst,
  und ein Konfigurationsfehler innerhalb des Aufrufs nimmt den Claim zurück.

**Erledigt am 25.08.2026:** die zwölf Variablen sind beim Worker gesetzt und
die Anwendung ist neu deployt (ein `docker restart` hätte nicht gereicht).
Gegengeprüft: `mail-umgebung-pruefen.sh` meldet beide Prozesse vollständig.

Was damit sofort wirkt, ist nur die KONFIGURATION. Die Code-Fixes oben
(Eckdaten in der Meldung, `kanal.website`, die lauten Konfigurationsmeldungen,
der `charge_due_balance`-Riegel) wirken erst mit dem nächsten Deploy von
`apps/api`.

### 1.2 GoTrue-Redeploy für die MFA-Schalter
Die neuen `GOTRUE_MFA_*`- und `GOTRUE_WEBAUTHN_*`-Zeilen stehen in
`deploy/supabase/docker-compose.yml:215-258`, greifen aber erst, wenn der
GoTrue-Container mit dieser Compose-Fassung neu startet. Vorher: kein
Passkey-Enrollment (422), kein SMS-Faktor.

**Reihenfolge beachtet:** Erst GoTrue neu starten, dann die 2FA-Pflicht
kommunizieren. Andersherum stehen Admins vor einer Pflicht, die sie technisch
nicht erfüllen können.

**Stand 09.08.2026 (SMS-Teil erledigt):** Der GoTrue-Container läuft inzwischen
mit den MFA-Schaltern **und** einem konfigurierten SMS-Anbieter; die Werte
liegen persistent in Coolifys `applications.docker_compose_raw` (id 1) und
überstehen einen Neustart. Der Phone-Faktor beantwortet die Challenge nicht mehr
mit `500 „Failed to get SMS provider"`. Was noch fehlt, ist kein Schalter,
sondern das Twilio-Trial-Konto — Details und Freischalt-Weg in **2.1**.

**Wer:** Nutzer selbst (verbleibender Teil: Passkey-Domäne, siehe 1.3).

### 1.3 `WEBAUTHN_RP_ID` und `WEBAUTHN_RP_ORIGINS` auf die Produktivdomäne setzen

**Richtigstellung (09.08.2026, live geprüft).** Die frühere Fassung dieses
Abschnitts behauptete, die Staging-Werte ließen **jedes** Passkey-Enrollment mit
`422` scheitern. Das ist **falsch** und war die Ursache einer Fehlsuche.
Tatsächlich gilt:

- GoTrue **übernimmt die vom Browser gemeldete `rpId`**. Live gegen den
  Staging-GoTrue (`GOTRUE_WEBAUTHN_RP_ID=supabase-kong.65.21.144.136.sslip.io`)
  von `http://localhost:3000` aufgerufen, liefert
  `POST /auth/v1/factors/{id}/challenge` `"rp": {"id": "localhost"}` und
  HTTP `200`. Enrollment und Verify liefen damit vollständig durch; ein
  `webauthn`-Faktor stand danach als `verified` in `auth.mfa_factors`.
- Der 422-Fall aus dem Compose-Kommentar (`:237-239`) betraf die **falsch
  geschriebenen Env-Namen** (`GOTRUE_MFA_WEBAUTHN_RP_ID` statt
  `GOTRUE_WEBAUTHN_RP_ID`), **nicht** einen Domain-Mismatch.

Die Server-Variablen sind also die **Vorgabe für die Produktivdomäne**, nicht
der Grund, warum lokal nichts geht. Lokal ist **keine** Änderung nötig.

**Zielwerte für Produktion** (`.com` ist die öffentliche Hauptdomäne;
`mynextdays.dk` ist ausschließlich Mailserver und kommt hier NICHT vor):

```
WEBAUTHN_RP_ID=app.mynextdays.com
WEBAUTHN_RP_DISPLAY_NAME=myNextDays
WEBAUTHN_RP_ORIGINS=https://app.mynextdays.com
```

`RP_ORIGINS` muss `https://` tragen (Ausnahme nur localhost); `RP_ID` ist die
nackte Domain **ohne** Schema. Sollen Passkeys zusätzlich unter der
API-Domäne gelten, kommt `https://api.mynextdays.com` komma-getrennt dazu.

**Vor dem ersten produktiven Passkey setzen.** Ein späterer Wechsel der RP-ID
macht **jeden bereits registrierten Passkey unbrauchbar** — der Passkey ist
kryptografisch an genau diese Domain gebunden und lässt sich nicht umhängen.
Betroffene müssten über Wiederherstellungscodes oder den Admin-Reset zurück ins
Konto.

Zur Korrektur der Vorgabe: Die Variable heißt `WEBAUTHN_RP_ORIGINS`, nicht
`WEBAUTHN_ORIGINS`. Beide Namen stehen zudem **nicht** in
`deploy/ENVIRONMENT.md` — das Inventar ist hier unvollständig und sollte
nachgezogen werden.

**Wer:** Nutzer selbst (Coolify-Env + GoTrue-Redeploy, siehe 1.2).

---

## 2. Direkt nach dem Deploy (Tage)

### 2.1 SMS als zweiter Faktor — Sackgasse geschlossen, Rest hängt am Twilio-Konto
**Erledigt am 09.08.2026, bis auf einen Punkt, den nur der Kontoinhaber lösen
kann.** Der Befund war richtig und ist live reproduziert worden: `POST /factors`
antwortete `200`, die Challenge danach
`500 „Failed to get SMS provider"` — kein Anbieter im GoTrue-Container.

**Was gemacht wurde:**
1. **GoTrue vollständig konfiguriert** (`GOTRUE_SMS_PROVIDER=twilio` plus
   `GOTRUE_SMS_TWILIO_*`, OTP-Länge/-Gültigkeit, `MAX_FREQUENCY`). Die Werte
   liegen persistent in Coolifys `applications.docker_compose_raw` (id 1) und
   überleben damit einen Neustart; im Repo-Compose stehen nur Platzhalter,
   dokumentiert in `deploy/ENVIRONMENT.md`.
   Nachweis: die Challenge liefert seither nicht mehr „Failed to get SMS
   provider", sondern Twilios eigene Antwort — GoTrue findet den Anbieter,
   erzeugt die Challenge und ruft Twilio mit gültigen Zugangsdaten auf.
2. **Die Oberfläche lügt nicht mehr.** Ob SMS angeboten wird, entscheidet jetzt
   der Server über `MfaStatusResponse.sms_available` (aus `MFA_SMS_AVAILABLE`,
   Default `false`) statt einer bedingungslosen Anzeige. Ist der Weg nicht
   nutzbar, bleibt die Karte **sichtbar**, nennt den Grund und der Knopf ist
   deaktiviert — der Nutzer erfährt, warum es SMS hier nicht gibt, statt in
   einen Serverfehler zu laufen. Text in allen 24 Sprachen
   (`account.security.twoFactor.sms.unavailable` / `.unavailableBadge`).
   Ein bereits eingerichteter SMS-Faktor bleibt entfernbar.

**Was offen ist — und warum es kein Code-Problem ist:** Das Twilio-Konto ist ein
**Trial**-Konto. Ein solches sendet ausschließlich an Nummern, die vorher in der
Twilio-Konsole verifiziert wurden (Fehler `21608`, live belegt), und an höchstens
fünf. Ein Kunde kann seine eigene Nummer dort nicht eintragen — für ihn wäre der
Faktor also weiterhin eine Sackgasse. Deshalb steht `MFA_SMS_AVAILABLE` bewusst
auf `false`: lieber ehrlich „nicht verfügbar" als ein Schein-Angebot
(keine Fallbacks, Wurzel 4).

**Zum Freischalten** (Reihenfolge einhalten):
1. Twilio-Konto aufwerten (Trial verlassen) und Geo-Permissions für die
   Zielländer setzen — beides **nur in der Twilio-Konsole**, nicht per API.
2. `MFA_SMS_AVAILABLE=true` in der Coolify-Env der API setzen, API neu deployen.
3. Gegenprobe: Faktor anlegen, Code anfordern, Zustellung prüfen.

Der Kundentext in `NEUERUNGEN-VORLAGE.md` nennt SMS weiterhin **nicht** — das
bleibt richtig, solange Schritt 1 nicht passiert ist.

**Wer:** Nutzer (Twilio-Konto aufwerten + `MFA_SMS_AVAILABLE=true`).

### 2.2 Vier Admin-Konten ohne zweiten Faktor
Aus der Vorgabe übernommen; **die Zahl selbst konnte ich nicht prüfen**, das
ginge nur gegen die Live-DB. Der Mechanismus ist verifiziert: Jedes Konto mit
Rolle `admin`/`co_admin` ohne Faktor bekommt ab seinem ersten Request eine
14-Tage-Frist, danach ist alles außer `/auth/mfa/*`, `/auth/account` und
`/auth/logout` zu (`mfa_service.py:66-70`, `mfa_gate.py:140-148`).

**Prüfen lässt sich der Ist-Stand so** (lesend):
`select count(*) from auth.mfa_factors where status = 'verified';`

**Wer:** Nutzer selbst — und zwar für jedes betroffene Konto einzeln.

### 2.3 Die Frist ist relativ, es gibt keinen Stichtag 23.08.2026
**Korrektur zur Vorgabe.** Ein festes Datum existiert im Code nicht. Implementiert
ist `GRACE_DAUER = timedelta(days=14)` (`mfa_service.py:51`), gesetzt beim
**ersten Request** des jeweiligen Kontos (`_grace_holen_oder_setzen`,
`mfa_service.py:219-262`) — bewusst nicht ab Migrationszeit, damit niemand eine
Frist verbraucht, während er im Urlaub ist.

Das Datum `2026-08-23` kommt im Repo genau einmal vor: als Beispiel-Zeitstempel
in einem Parser-Test (`apps/api/src/features/auth/tests/test_mfa.py:271,274`).

**Folge:** Ein in der Ankündigung genanntes festes Datum wäre eine
Falschaussage — für ein Konto, das sich erst am 20.08. anmeldet, läuft die
Frist bis zum 03.09. Die Vorlage formuliert deshalb „ab jetzt 14 Tage" und
verweist auf das persönliche Datum im Dashboard-Banner.

**Entscheidung nötig:** Relative Frist so lassen (dann ist die Vorlage richtig)
oder auf einen harten Stichtag umbauen (dann ist es ein Code-Auftrag).
**Wer:** Nutzer entscheidet.

### 2.4 `docs/API.md` widerspricht sich selbst bei der 2FA
`docs/API.md:452-453` behauptet noch:

> 2FA läuft als **TOTP im eigenen Backend** (`pyotp`, Tabelle
> `public.user_mfa`) — kein externer SMS-Dienst. SMS ist vorgesehen, aber erst
> mit einem Provider aktiv.

Das ist seit 0341 falsch und steht **im selben Dokument** im Widerspruch zum
korrekten, ausführlichen MFA-Abschnitt weiter oben (`:380-450`).
`public.user_mfa` ist abgelöst, die zugehörigen Endpunkte antworten `410 Gone`
(`apps/api/src/features/auth/router.py:679-700`).

**Wer es merkt:** Der nächste, der die Doku liest — vermutlich ein Agent, der
danach in die falsche Richtung baut.
**Wer:** Ein Agent, kleine Textänderung.

### 2.5 `MARKETPLACE_BASE_URL` auf die Produktivdomäne setzen
`deploy/ENVIRONMENT.md:81` beschreibt die Variable als Ziel der
Bewertungs-Erinnerung an den **Gast**. Sie steht laut Vorgabe noch auf der
`sslip.io`-Staging-Adresse; den konkreten Wert konnte ich im Repo nicht
gegenprüfen (Werte stehen bewusst nur in Coolify) — **in Coolify prüfen.**

Zielwert laut Cutover-Tabelle (`deploy/DOMAIN-CUTOVER.md:109`):

```
MARKETPLACE_BASE_URL=https://mybestdays.dk
```

Achtung, hier **nicht** `.com`: Das ist der Marktplatz **myBestDays**, und der
läuft als eigene Marke bewusst unter `mybestdays.dk`. `mynextdays.com` ist die
Domäne des PMS (Dashboard, API, Marketing) — die beiden Marken teilen sich
keine Adresse.

**Wer es merkt:** Ein Gast, der eine Bewertungs-Erinnerung bekommt und auf einer
Staging-URL landet.
**Wer:** Nutzer selbst.

---

## 3. Bekannte Einschränkungen (funktioniert, aber mit Vorbehalt)

### 3.1 Mail-Zustellbarkeit ist noch nicht verlässlich
Die Domain ist seit dem 15.06.2026 registriert und hat kaum Sendehistorie. Die
erste Testmail landete im Spam, die zweite im Posteingang. `deploy/mail/README.md`
beschreibt das Warmlaufen ausdrücklich als notwendig (`:171-174`: erst wenige
Mails pro Tag) und weist auf die besondere Schwierigkeit bei Apple/iCloud und
Google hin (`:129`). Ein Postmaster-Programm wie bei Google gibt es bei Apple
nicht.

**Wer es merkt:** Ein neu eingeladener Eigentümer, dessen Einladung im
Spam-Ordner liegt — und der dann anruft. Das trifft ausgerechnet den Moment, in
dem das neue Feature den ersten Eindruck macht.

**Praktische Empfehlung für die ersten Tage:** Beim Anlegen der ersten
Eigentümer-Zugänge kurz Bescheid geben, dass eine Mail kommt und ggf. im
Spam-Ordner liegt. Das kostet nichts und verhindert den ersten Frust.

**Wer:** Zeit und Sendevolumen; niemand kann es beschleunigen.

### 3.2 TOTP-Codes lassen sich innerhalb ihres Zeitfensters mehrfach einlösen
GoTrue v2.189.0 merkt sich den verbrauchten Zeitschritt nicht. Derselbe
6-stellige Code gilt bis zu ~90 Sekunden mehrfach — live reproduziert (zweite
Einlösung: HTTP 200).

Begrenzt wird das durch: einmalige, IP-gebundene Challenges (ein zweiter
Versuch braucht eine **neue** Challenge von **derselben** IP) und
`GOTRUE_MFA_RATE_LIMIT_CHALLENGE_AND_VERIFY=10`. Der Angreifer muss den Code
also live mitlesen und sofort von derselben IP verwenden — Echtzeit-Phishing,
kein späterer Replay.

Bewusst **nicht** selbst nachgebaut: Eine eigene Timestep-Buchführung neben
GoTrue wäre eine zweite Wahrheit über „Code schon benutzt" — dieselbe
Fehlerklasse, die 0341 gerade beseitigt hat. Der saubere Weg ist der Passkey.

Dokumentiert in `docs/API.md:411-433`.
**Wer:** Abhängig von GoTrue upstream; für uns erledigt durch die
Passkey-Empfehlung im Kundentext.

### 3.3 Eigentümer können Anträge nicht selbst zurückziehen
Weder Sperranträge noch Dienstleistungsaufträge lassen sich vom Eigentümer
zurückziehen — es gibt keine UI und keinen Endpunkt
(`apps/api/src/features/public_portal/router.py` kennt nur `POST` und `GET`).
Die Status „Zurückgezogen" existieren nur als Anzeigewert.

**Wer es merkt:** Ein Eigentümer, der sich vertippt hat und den Antrag
loswerden will — er muss die Agentur anrufen. Die Agentur lehnt dann ab.
Die Vorlage benennt das offen, statt es zu verschweigen.
**Wer:** Ein Agent, wenn gewünscht — bewusst zurückgestellt.

### 3.4 Der Eigentümer hat im Portal keine Glocke
Bewusste Entscheidung (`web/components/portal/portal-topbar.tsx:4-6`): Die
In-App-Meldungen sind Betriebs-Meldungen und gehören nicht in die
Eigentümer-Fläche. **Folge:** Die Meldung über eine Sperrantrags-Entscheidung
erreicht den Eigentümer nur per E-Mail bzw. wenn er selbst ins Portal schaut.

Zusammen mit 3.1 heißt das: Landet die Mail im Spam, erfährt er von der
Entscheidung faktisch nichts.
**Wer:** Bewusst so; überdenkenswert, sobald die Zustellbarkeit steht.

### 3.5 Zwei Benachrichtigungs-Kategorien ohne deutsches Label (latent)
`task_assigned` (Mitarbeiter) und `block_request` (Agentur) stehen im Katalog
im Tab `KONTO` (`notification_settings/katalog.py:91,97`), haben aber in
`web/messages/de.json` **kein Label**.

**Aktuell unsichtbar**, und zwar aus einem beiläufigen Grund: Der einzige Ort,
der Benachrichtigungs-Kategorien rendert, ist das **Eigentümer-Portal** — und
das filtert beide über `PORTAL_KATEGORIEN` heraus
(`web/lib/portal-benachrichtigungen.ts:90-100`). Eine Einstellungsseite für den
**Betrieb** existiert im Dashboard derzeit nicht (`grep` über
`web/app/(dashboard)` findet keinen Renderer).

**Der Punkt ist also keine Fehlanzeige heute, sondern eine Falle für später:**
Wer als Nächstes die Betriebs-Einstellungen baut, bekommt zwei unbeschriftete
Zeilen — und merkt es nicht, weil `t.has(...)` sauber abfängt statt zu
krachen.

Nebenbefund: Damit kann ein Mitarbeiter seine Aufgaben-Mails aktuell **gar
nicht** abschalten, obwohl der Katalog es vorsieht.
**Wer:** Ein Agent — zusammen mit der Betriebs-Einstellungsseite, nicht davor.

### 3.6 Die Glocke zeigt für neue Kategorien ein neutrales Icon
`KATEGORIE_ICON` in `web/components/glocke.tsx` kennt die fünf neuen Schlüssel
nicht und fällt auf das Standard-Glockensymbol zurück. Kosmetisch, kein
Fehlverhalten.
**Wer:** Ein Agent, klein.

### 3.7 Eigentümer löschen ohne jede Vorprüfung
`OwnersService.delete()` (`apps/api/src/features/owners/service.py:620-631`)
ist ein bedingungsloser DELETE im Tenant-Scope: keine Prüfung auf laufende
Buchungen, kein 409-Pfad. `owner_statements` gehen per Cascade mit — **eine
gelöschte Eigentümer-Abrechnung ist unwiederbringlich weg**, auch wenn dazu
noch offene Buchungen laufen. Objekte selbst bleiben erhalten und werden
eigentümerlos.

Abgesichert ist das aktuell nur durch einen Bestätigungsdialog mit
Irreversibel-Hinweis, also durch Text, nicht durch Technik.

**Wer es merkt:** Der Betrieb, wenn er einen Eigentümer versehentlich löscht —
und es erst bei der nächsten Abrechnung bemerkt. Die Vorlage warnt deshalb
ausdrücklich an dieser Stelle.
**Wer:** Ein Agent, falls ein echter Schutz (409 bei vorhandenen Abrechnungen)
gewünscht ist. **Meine Empfehlung: ja, vor dem Deploy.**

### 3.8 `run_auto_statements` hat keinen UNIQUE-Backstop
**Bestätigt.** Der Automatiklauf prüft per SELECT, ob für Eigentümer + Zeitraum
schon ein Statement existiert, und legt sonst an
(`owner_statements/service.py:1397-1412`). Das ist ein Read-vor-Write. Ein
UNIQUE-Index auf `(owner_id, period_from, period_to)` existiert **nicht** —
`grep` über alle Migrationen liefert keinen Treffer.

**Wer es merkt:** Niemand, solange der Lauf einmal läuft. Bei zwei parallelen
Läufen (Doppelklick, Retry nach Timeout, zweiter Worker) bekäme ein Eigentümer
**zwei Abrechnungen für denselben Zeitraum** — und die zweite zieht die
Ausgaben der ersten ab.

Das ist ein klassischer Wurzel-2-Fall. Er ist **nicht** in diesem Durchgang
entstanden, aber er ist jetzt belegt.
**Wer:** Ein Agent (eine Migration mit `unique index`).

### 3.9 Ankündigungen werden nicht übersetzt
Der Inhalt einer Ankündigung steht bei jedem Betrieb in der Sprache, in der er
geschrieben wurde — nur die Oberfläche drumherum ist 24-sprachig. Für einen
dänischen oder polnischen Betrieb steht dort deutscher Text.

Bewusst so (eine Übersetzung von redaktionellem Text pro Veröffentlichung wäre
ein eigenes Feature). In der Vorlage als Hinweis vermerkt, inklusive der
Möglichkeit, eine zweite englische Ankündigung zu veröffentlichen.
**Wer:** Zurückgestellt.

### 3.10 Ankündigungen erscheinen nicht live
Kein Realtime-Abo, bewusst: Die Tabelle ist für `authenticated` komplett
gesperrt, ein Abo bräuchte ein `grant select` und würde damit auch **Entwürfe**
für jeden eingeloggten Nutzer jedes Betriebs öffnen. Die Zusage lautet deshalb
„erscheint beim nächsten Login", nicht „sofort" (begründet in
`0337_ankuendigungen.sql`, letzter Absatz).

**Praktische Folge für dich:** Nach dem Veröffentlichen musst du dich selbst
ab- und wieder anmelden, um das Popup zu sehen. Ein offenes Fenster zeigt es
nicht.
**Wer:** Bewusst so.

---

## 4. Zurückgestellt

### 4.1 Migrations-Nummernkollisionen bleiben stehen
Zwei Dateien tragen `0333`, drei tragen `0337`. Alle sind bereits eingespielt.
Ein Umbenennen wäre **aktiv schädlich**: Getrackt wird der Dateiname, ein neuer
Name gälte als neue Migration und liefe ein zweites Mal — bei manchen wäre das
ein stiller Datenschaden.

Sauber dokumentiert inklusive Tabelle in `supabase/migrations/README.md`.
Nächste freie Nummer laut README: **0340** (`0341` ist bereits vergeben, die
Lücke ist gewollt).
**Wer:** Niemand. Bewusst so, korrekt begründet.

### 4.2 Ein überholter Kommentar in `0336`
`0336_gaeste_direktpfad_schliessen.sql:94` nennt `guest_addresses`,
`guest_contacts` und `guest_notes` als „bleiben offen" und empfiehlt sie als
Realtime-Ersatzquelle. `0337` hat sie danach ebenfalls geschlossen. Der
Kommentar bleibt stehen, weil eine eingespielte Migration Nachweis dessen ist,
was gefahren wurde — die Korrektur steht in `supabase/migrations/README.md`.
Die betroffenen Seiten hören korrekt auf `reservations`.
**Wer:** Niemand.

---

## Erledigt — Befunde aus der Vorgabe, die nicht mehr offen sind

Geprüft und **nicht** mehr offen:

- **Passkeys/WebAuthn-Frontend.** Ist angebunden, nicht mehr in Arbeit:
  `web/lib/mfa-client.ts:159-176` (`mfa.webauthn.register()` /
  `.authenticate()`), Fähigkeitsprüfung über `navigator.credentials`
  (`:187-202`), UI in `zwei-faktor-section.tsx:90-101` und
  `passkey-einrichtung.tsx`, Login-Weg in `mfa-login.ts:121-126`.
  Es fehlt **nur** die Konfiguration aus 1.3.
- **`guest_messages` / `guest_message_threads`, `deals`, `customers`.**
  Alle drei in `0337_direktpfad_sensible_tabellen_schliessen.sql` behandelt
  (`customers` `:417`, `deals` `:438`, die Nachrichtentabellen `:140-183` mit
  bewusst auf den Selbst-Scope reduziertem Leserecht).
  Gegenprobe möglich mit `bash scripts/security/direktpfad-pruefen.sh` (prüft
  live alle acht Rechte-Kombinationen je Tabelle; **empfohlen nach dem
  Deploy**).
- **i18n-Abweichung in `objects.policiesForm.*`.** Behoben: `de.json` und
  `en.json` haben beide **71** Schlüssel, Differenzmenge in beide Richtungen
  leer.
- **Sprachfeld auf der Konto-Seite persistiert nicht.** Behoben: Die
  Betriebssprache wird über `setDefaultLanguage()` gespeichert
  (`web/app/(dashboard)/konto/page.tsx:263`) gegen
  `PATCH /auth/tenant/default-language`.

---

## Wenn ich drei Dinge zuerst machen würde

1. **`nextdays-api` und GoTrue neu deployen** (1.1, 1.2) — ohne das sind
   Einladungen kaputt und die 2FA-Pflicht nicht erfüllbar.
2. **SMS-Option entscheiden** (2.1) — sie ist sichtbar und funktioniert nicht.
   Ausblenden dauert Minuten und verhindert, dass ein Admin unter Fristdruck in
   eine Sackgasse läuft.
3. **`WEBAUTHN_RP_ID` und `WEBAUTHN_RP_ORIGINS` auf `app.mynextdays.com`
   setzen** (1.3) — muss **vor** den ersten Passkeys stehen, sonst sind die
   bereits registrierten später unbrauchbar.
