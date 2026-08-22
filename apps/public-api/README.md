# apps/public-api — die öffentliche myNextDays-API (v1)

Eigenständiger FastAPI-Dienst hinter `https://open-api.mynextdays.com`. Er ist
**nicht** Teil von `apps/api`: eigenes Projekt, eigenes Image, eigenes
Deployment, eigene Auth-Welt, eigene Rate-Limits, eigene Versionierung.
Es gibt **keinen Import** und **keinen HTTP-Aufruf** zwischen den beiden
Diensten.

Warum getrennt: eine öffentliche API hat Pflichten, die ein internes
Dashboard-Backend nicht hat — feste Versionierung, Abkündigungsfristen,
harte Grenzen je Kunde, ein veröffentlichtes Schema. Wer beides in einen
Prozess legt, kann keines davon einhalten; ein Lastausbruch eines
API-Kunden würde die Oberfläche des Betriebs mit umlegen.

Kundendokumentation: `/entwickler` in der Marketing-App.
Referenz: `/docs` (Konsole), `/referenz` (Lesefassung), `/openapi.json`.

## Starten

```bash
cd apps/public-api
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e ".[dev]"

# Web
API_TOKEN_SECRET=… SUPABASE_SERVICE_ROLE_KEY=… \
  .venv/bin/uvicorn src.main:app --reload --port 8100

# Webhook-Zusteller (eigener Prozess)
.venv/bin/python -m src.zusteller.dispatcher
```

Der Port ist bewusst nicht 8000: dort läuft die Haupt-API. Zwei Dienste
auf demselben Port wären lokal ein Rätselraten, welcher gerade antwortet.

Prüfen:

```bash
.venv/bin/ruff check src
.venv/bin/pylint --fail-under=10 src
.venv/bin/pytest -q            # 69 Tests, ohne Datenbank
bash ../../scripts/ci/public-api-kopien-pruefen.sh
```

## Zwei Wege, eine Wahrheit: Auftrag oder Kopie

Alles, was hier eine Kette auslöst, die es auch im Dashboard gibt, läuft
über einen **Auftrag** — nicht über nachgebauten Code:

| Endpunkt | Auftrag | Warum nicht selbst |
| --- | --- | --- |
| `POST /v1/reservations/{id}/cancel` | Job `public_api_cancel_reservation` | Nächte freigeben, Portale melden, Partei/Grund, Gebühren, Karenz, Audit — sechs Aufrufer in `apps/api`. |
| `POST /v1/reservations/{id}/move` | Job `public_api_move_reservation` | Alte Nächte frei, neue belegt, beide Zustände an die Portale. |

Beide antworten **202**. Der Abschluss kommt als Ereignis; der Move
beantwortet einen belegten Ziel-Zeitraum trotzdem sofort mit 409, weil
das der häufigste Fehlerfall ist.

Alles, was nur **rechnet**, wird dagegen **geteilt** statt beauftragt —
ein Auftrag wäre dort falsch, weil der Aufrufer sofort eine Zahl braucht.
Die Preisberechnung liegt deshalb als byte-identische Schwesterdatei in
beiden Bäumen (siehe unten).

Die Regel für den nächsten Endpunkt: **löst er eine Kette aus, stelle
einen Auftrag; rechnet er nur, teile die Datei.**

## Was mit der Haupt-API geteilt wird — und was nicht

**Geteilt:** die Datenbank (Supabase, `service_role`), die Tabelle
`api_clients` (dort legt das Dashboard die Zugänge an) und das
Signier-Secret `API_TOKEN_SECRET`. Letzteres MUSS in beiden Diensten
gleich sein: die Zugänge entstehen im Dashboard, die Tokens werden hier
ausgegeben und geprüft. Zwei verschiedene Secrets heißen, dass ein im
Dashboard erzeugter Zugang hier nicht funktioniert.

**Elf Dateien liegen bewusst doppelt** (Muster ADR-0019), byte-identisch,
geprüft von `scripts/ci/public-api-kopien-pruefen.sh`:

| Datei | Was Drift kostet |
| --- | --- |
| `core/ausgehende_url.py` | Eine SSRF-Lücke wird in einer Fassung geschlossen, in der anderen nicht. |
| `core/einheiten_verfuegbar.py` | Zwei verschiedene Verfügbarkeitszahlen — eine davon geht an Booking.com. |
| `core/einheiten.py` | Kalenderzeilen, die der andere Dienst nicht findet; Upserts, die Duplikate anlegen. |
| `core/scopes.py` ↔ `apps/api/src/features/api_clients/scopes.py` | Das Dashboard vergibt Scopes, die kein Endpunkt kennt → Dauer-403 beim Kunden, ohne Fehler im Log. |
| `core/supabase.py` | Verbindungshärtung (Timeouts, Reconnect, HTTP/2 aus) läuft auseinander — der Dienst ohne sie hängt beim ersten Kong-Neustart. |
| `core/ratelimit.py` | Ein Dienst hält sein veröffentlichtes Limit nicht oder glaubt eine gefälschte Client-IP. |
| `core/logging.py` | Einer der Dienste protokolliert personenbezogene Daten im Klartext. |
| `core/dates.py` | Die Nächte-Zählung. Eine Fassung rechnet vier Nächte, die andere fünf. |
| `features/pricing/resolver.py` | **Die EINE Preisberechnung.** Driftet sie, nennt die Preisvorschau der öffentlichen API einen anderen Betrag als die Buchung im Dashboard — zwei Preise für denselben Aufenthalt. |
| `features/pricing/schemas.py` | Die Formen dieser Berechnung; Drift bricht den Resolver in einem der Bäume. |
| `features/addons/pricing.py` | Dieselbe Zusatzleistung kostet über die API etwas anderes als im Dashboard. |

Verbessern heißt: **in beiden Bäumen** ändern. Eine Korrektur nur hier
bricht die CI — das ist Absicht.

Warum Kopien und kein gemeinsames Paket: der Dienst soll ohne
`apps/api` lauffähig, baubar und deploybar sein. Ein Paket dazwischen
wäre eine Laufzeit- und Versionsabhängigkeit; die Kopie mit
CI-Zwang gibt dieselbe Sicherheit ohne diese Bindung.

Die vier Preis-Dateien liegen unter demselben Importpfad wie in `apps/api`
(`src/features/…`) — nur so können sie byte-identisch bleiben. Der Baum
`src/features` dieses Dienstes enthält deshalb KEINE eigene Fachlichkeit,
sondern ausschließlich solche Kopien.

## Aufbau

```
src/main.py                App, Fehler-Handler (problem+json), Middleware, Spec
src/v1/__init__.py         Router-Reihenfolge (feste Pfade VOR Parameter-Pfaden)
src/v1/schemas.py          die öffentlichen Schemas — der stabile Vertrag
src/v1/schemas_verwalten.py Schemas rund um eine bestehende Buchung + Preisvorschau
src/v1/oauth.py            POST /v1/oauth/token, GET /v1/me
src/v1/global_.py          Länder- und Währungscodes (Normdaten)
src/v1/properties.py       Objekte (Einheiten-Typen) + Einheiten
src/v1/objekt_beiwerk.py   Zusatzleistungen, Konditionen, Kanäle, Türcode/WLAN
src/v1/availability.py     freie Stückzahl je Tag; sperren, freigeben, Stop-Sell
src/v1/rates.py            Rate-Pläne, Tagespreise, Aufenthaltsregeln
src/v1/quotes.py           Preisvorschau — nutzt die GETEILTE Preisberechnung
src/v1/reservations.py     Buchungen lesen + anlegen
src/v1/reservations_verwalten.py  eine bestehende Buchung: ändern, verschieben,
                           stornieren, Ablage, An-/Abreise, Nachrichten,
                           Zahlungen, Portal-Rohdaten
src/v1/guests.py           Gästestammdaten (nur lesend)
src/v1/tasks.py            Aufgaben
src/v1/webhooks.py         Ereignis-Abos + Katalog
src/v1/events.py           Ereignisse ABHOLEN (Nachholpfad nach einem Ausfall)
src/core/auth.py           Token ausgeben und prüfen, Scope + Objekt erzwingen
src/core/errors.py         RFC 9457 und der Katalog stabiler Fehlercodes
src/core/idempotency.py    Idempotency-Key (erst beanspruchen, dann handeln)
src/core/pagination.py     Cursor (starting_after) + Offset, harte Obergrenzen
src/core/middleware.py     Request-ID, drei Rate-Limit-Eimer
src/core/ari.py            Portale informieren — reiht Jobs ein, sendet NICHT selbst
src/zusteller/dispatcher.py Webhook-Zustellung (eigener Prozess); schaltet ein
                           dauerhaft scheiterndes Abo mit benanntem Grund ab
```

Datenbank: Migration `0418_public_api.sql` legt `public_api_webhooks`,
`public_api_events`, `public_api_deliveries`, `public_api_idempotency`
an — samt der Trigger, die Ereignisse erzeugen. `0420_public_api_blaetter_indizes.sql`
bringt je Liste den Index, den das Cursor-Blättern braucht (Spaltenfolge =
Sortierung des Endpunkts). Die Zugänge selbst liegen in `api_clients`
(Migration `0179`).

## Drei Entscheidungen, die man kennen muss

**Ein Push ist keine Zustellgarantie.** Deshalb gibt es zwei Wege zu denselben
Ereignissen: der Zusteller pusht sie, und `GET /v1/events` gibt sie heraus. Ein
Partner, dessen Server zwei Stunden weg war, holt damit genau das nach, was die
Wiederholversuche nicht losbekommen haben — sonst fehlen ihm still die Buchungen
dieser zwei Stunden, und er weiß nicht einmal, welche. Zwei Wege zum selben
Datensatz sind kein Widerspruch; zwei Datensätze wären einer.

**Ereignisse kommen aus DB-Triggern, nicht aus dem API-Code.** Die
interessanten Änderungen entstehen NICHT hier: eine Booking.com-Buchung
kommt über den Portal-Import, eine Stornierung über das Dashboard, eine
Preisänderung über einen Hintergrundjob. Ein Ereignis, das nur bei
API-Aufrufen feuert, wäre für „sag mir, wenn eine Buchung reinkommt"
wertlos. Der Trigger sitzt an der Tabelle und sieht jeden Schreibweg —
auch einen, der erst nächstes Jahr dazukommt.

**Schreiben läuft über die vorhandene Wahrheit.** Eine Buchung entsteht
über `create_reservation_atomic` (Buchung + Kalender + Sperre + Push in
einer Transaktion), der Portal-Push über `enqueue_job`. Dieser Dienst
baut davon nichts nach. Wo eine Wahrheit nicht teilbar war — Storno,
Aufenthaltspreis, Nachrichten, Finanzen — kann v1 es bewusst NICHT, und
die Kundendokumentation sagt das offen. Ein halber Storno-Endpunkt wäre
die zweite Wahrheit, die dieser Schnitt gerade verhindert.

## Deployment (Coolify)

Der Stack liegt in `deploy/public-api/docker-compose.yml`: zwei
Container aus einem Image (`api` + `zusteller`).

Die Coolify-App **existiert** (`nextdays-public-api`, UUID
`bok2ol51jn1936lxs66zuujs`) und steht in beiden CI-Listen —
`scripts/ci/coolify-apps.txt` und der images-Matrix in `.github/workflows/ci.yml`.
`scripts/ci/apps-liste-pruefen.sh` hält sie deckungsgleich; ein Eintrag nur an
einer Stelle bricht die CI, was der Zweck ist.

Was in Coolify gesetzt sein muss:

| Variable | Wert |
| --- | --- |
| `SERVICE_ROLE_KEY` | derselbe wie bei `nextdays-api` |
| `API_TOKEN_SECRET` | **identisch** zu `nextdays-api` — sonst funktioniert kein im Dashboard erzeugter Zugang |
| `REDIS_PASSWORD` | wie bei `nextdays-api` |
| `PUBLIC_API_BASE_URL` | `https://open-api.mynextdays.com` |
| `APP_ENV` | `production` |

Mehrzeilige Werte vermeiden — sie zerbrechen den Coolify-Deploy; Secrets
einzeilig setzen.

Konfiguration der Resource: Base Directory `/`, Compose Location
`deploy/public-api/docker-compose.yml`, Domain auf Service `api` Port 8000,
Watch Paths (zeilengetrennt!) `apps/public-api/**` und `deploy/public-api/**`.

Vor dem ersten Deploy: DNS für `open-api.mynextdays.com` auf den Server, dann
das Coolify-Zertifikat abwarten und `GET /health` prüfen. Die Migrationen sind
eingespielt (0418 und 0420, Stand 22.08.2026 gegen die Server-DB geprüft).

## Rate-Limits und Grenzen (Standardwerte)

| Eimer | Wert | Gilt für |
| --- | --- | --- |
| `token` | 10 / min | `POST /v1/oauth/token` (je IP) |
| `write` | 120 / min | POST/PUT/PATCH/DELETE (je Zugang) |
| `read` | 600 / min | GET (je Zugang) |

Geblättert wird über einen **Cursor** (`starting_after` = ID des letzten
Elements der Vorseite); `offset` bleibt für einen einmaligen Seitenblick, beides
gleichzeitig ist 422. Der Grund steht im Kopf von `core/pagination.py`: Offset
beschreibt eine Position, und die verrutscht, sobald sich die Liste ändert —
für ein Fremdsystem ein stiller Datenverlust.

Ereignis-Rückblick max. 30 Tage, Seitengröße max. 200, Datumsspanne max.
730 Tage — alles hart (422),
nie stillschweigend gekürzt. Fällt Redis aus, ist der Token-Endpunkt
fail-CLOSED (503, sein Zweck IST der Brute-Force-Schutz), Lesen und
Schreiben bleiben offen und werden protokolliert.
