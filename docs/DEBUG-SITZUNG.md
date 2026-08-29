# Sitzungs-Debugging — welcher Betrieb ist gerade angemeldet?

## Warum es das gibt

Am **29.08.2026** standen im Onboarding eines frisch angelegten Betriebs die
**18 Objekte eines fremden Betriebs** (AirSmil) in der Objektauswahl des
Dialogs „Buchungsportal verbinden".

Vier Erklärungen wurden gebaut und wieder verworfen:

| Vermutung | Ergebnis |
|---|---|
| Backend-Scope aufweichbar | Widerlegt — `.eq("tenant_id", …)` steht unbedingt vor jeder Rollenverzweigung |
| Next.js Data-Cache | Widerlegt — `api.ts:64` setzt `cache: "no-store"` |
| Modulweiter State im Frontend | Widerlegt — kein Store hält Objektdaten |
| RLS-Policy / DB-Zuordnung | Widerlegt — 1 User = 1 Tenant, keine Multi-Tenant-Tabelle |

Die Wahrheit war **eine einzige Messung**, die niemand gemacht hatte:

```
Token mit tenant_id = a25577cf (AirSmil)  →  GET /properties  →  total = 18
Token mit tenant_id = beb72997 (UI-Test)  →  GET /properties  →  total =  1
Token ohne tenant_id                      →  GET /properties  →  HTTP 400
```

**Das Backend war korrekt.** Der Browser schickte schlicht das Token eines
anderen Betriebs. Sehen konnte das niemand:

- die Sitzungs-Cookies sind `httpOnly` — JavaScript kommt nicht heran
- sie heißen bei **jedem** Konto gleich (`nd_access`/`nd_refresh`, host-only),
  alle Konten teilen sich also denselben Cookie-Platz
- keine Oberfläche nannte je den laufenden Betrieb
- das Serverlog schrieb `GET /properties 200` — ohne zu sagen, für wen

Ein Fehler, dessen Ursache man nicht **ablesen** kann, wird geraten. Das Raten
kostete hier Stunden. Diese Werkzeuge beenden es.

## Die vier Werkzeuge

### 1. Overlay unten links (Browser)

`web/components/sitzung-debug-panel.tsx`, eingehängt im **Root**-Layout
(`web/app/layout.tsx`) — bewusst dort und nicht im Dashboard-Layout, weil
`(auth)` kein eigenes Layout hat und das Onboarding es sonst nie zeigen würde.

Die Ampel **ist** der Befund:

| Farbe | Bedeutung |
|---|---|
| grün | Cookie-Betrieb == Backend-Betrieb, alles stimmig |
| **rot** | beide nennen **verschiedene** Betriebe, oder die Antwort enthält fremde Objekte |
| gelb | Access-Cookie weg, Refresh-Cookie da → die nächste Navigation belebt die Sitzung **dieses Refresh-Tokens** wieder |
| grau | abgemeldet |

Aufgeklappt zeigt es Cookie-Betrieb, Server-Betrieb, Nutzer, Rolle, 2FA-Stufe,
Restlaufzeit, Token-Kennung und einen **Token-Wechsel-Zähler**. Der Zähler ist
der Fingerabdruck der stillen Middleware-Erneuerung: wechselt die Kennung,
ohne dass sich jemand angemeldet hat, hat die Middleware im Hintergrund
erneuert.

In Produktion fällt die Komponente aus dem Bundle (sie nennt Tenant-IDs im
Klartext). Auf Staging per `NEXT_PUBLIC_SITZUNG_DEBUG=1` zuschaltbar.

### 2. Diagnose-Route

`GET /api/sitzung-debug` (`web/app/api/sitzung-debug/route.ts`)

Liefert **drei Ebenen nebeneinander** — der Vergleich ist der Befund:

1. was das Cookie **behauptet** (ungeprüft dekodiert)
2. was das **Backend** daraus macht (signaturgeprüft)
3. was der Server auf dieses Token **ausliefert** (`total` + Tenant-IDs)

Weichen 1 und 2 ab, ist das Token nicht das, wofür der Browser es hält.
Enthält 3 fremde Tenant-IDs, ist es ein echtes Backend-Leck.

Ohne Cookie: **401**, fail-closed. Das Token selbst wird nie zurückgegeben —
nur seine SHA-256-Kurzkennung, damit sich zwei Aufrufe vergleichen lassen.

### 3. Serverlog mit Betrieb

`apps/api/src/core/security.py` → `_sitzung_protokollieren` bindet
`tenant`/`user`/`rolle`/`aal` per `structlog.contextvars` an den Request.
`apps/api/src/main.py` schreibt daraufhin je Request eine `zugriff`-Zeile.

Statt

```
INFO: 127.0.0.1:63278 - "GET /api/v1/properties HTTP/1.1" 200 OK
```

steht dort jetzt zusätzlich

```
[info] zugriff  request_id=… tenant=a25577cf user=5ed7c939 rolle=admin
                aal=aal2 method=GET pfad=/api/v1/properties status=200 dauer_ms=41
```

Der Kontext wird zu **Request-Beginn geleert** (`clear_contextvars`) — ohne das
trüge ein Request die Bindungen des vorigen weiter, sobald ein Worker-Task
wiederverwendet wird, und das Log zeigte den falschen Betrieb.

Nur IDs, auf acht Zeichen gekürzt. Keine E-Mail, kein Name — acht Zeichen
unterscheiden zwei Betriebe zuverlässig, mehr braucht eine Diagnose nicht.

### 4. Prüfskript (ohne Browser)

```bash
# Ein konkretes Sitzungs-Token prüfen (Wert aus DevTools → Application → Cookies)
node scripts/diagnose/sitzung-pruefen.mjs --token "<JWT>"

# Testtoken für einen Betrieb bauen und messen
node scripts/diagnose/sitzung-pruefen.mjs --tenant a25577cf-c941-45c4-8d23-008887e631aa

# Alle Betriebe der Live-DB durchmessen (braucht SSH)
node scripts/diagnose/sitzung-pruefen.mjs --alle
```

Rein lesend. Exit 1 bei Mandantenbruch, also CI-fähig. Die Gegenprobe (Token
**ohne** `tenant_id` muss abgelehnt werden) läuft immer mit.

Messung vom 29.08.2026 über alle 9 Betriebe:

```
beb72997   1 Objekt    ✓ nur eigener Betrieb
7bf8dfd9   0 Objekte   ✓
9916843f   0 Objekte   ✓
55e8b3c9   4 Objekte   ✓
d30956f2   0 Objekte   ✓
e144d3aa   0 Objekte   ✓
a25577cf  18 Objekte   ✓  ← die 18 aus dem Screenshot
b93bd078  12 Objekte   ✓
69d24767   8 Objekte   ✓
ohne tenant_id → HTTP 400 ✓ fail-closed
```

## Wie man den Fall liest

**Zeigt das Overlay einen anderen Betrieb, als du erwartest**, schickt dieser
Browser die Sitzung eines anderen Kontos. Abmelden (löscht beide Cookies über
`clearSession`) und neu anmelden.

**Zeigt es gelb**, steht eine stille Erneuerung an: `nd_access` ist abgelaufen
und aus dem Jar verschwunden, `nd_refresh` liegt noch 30 Tage da. Die
Middleware (`web/middleware.ts:170-232`) tauscht es bei der nächsten Navigation
**ungeprüft** gegen ein frisches Access-Token — also die Sitzung, die zu diesem
Refresh-Token gehört. Deshalb hilft Neuladen nicht: das Neuladen ist der
Auslöser.

**Zeigt es rot mit fremden Objekten**, ist es kein Sitzungs-, sondern ein
Backend-Problem. Dann greift `scripts/diagnose/sitzung-pruefen.mjs --alle` und
zeigt, welcher Betrieb welche Antwort bekommt.

## Was noch offen ist

Das hier **beobachtet** den Fehler, es **behebt** ihn nicht. Zwei Stellen
verdienen eine Entscheidung:

1. **Login/Signup löschen die alte Sitzung nicht explizit**, bevor sie die neue
   setzen. `persistSession` überschreibt zwar beide Cookies — aber nur, wenn
   ein Login wirklich stattfindet.
2. **Die Middleware prüft beim Erneuern nicht, wem das Refresh-Token gehört.**
   Sie kann nicht wissen, wer erwartet wird — genau deshalb macht das Overlay
   den Zustand sichtbar, statt ihn stillschweigend zu heilen.

---

# Zweiter Fall am selben Tag: „Portal verbunden", obwohl nichts autorisiert war

Dieselbe Sitzung, wenige Stunden später. Die Oberfläche behauptete:

> Ein Portal ist schon verbunden und deine Objekte sind übertragen — du musst
> hier nichts erneut verbinden.
> 1 Objekt übernommen

Gleichzeitig lehnte **derselbe Server** jeden Abruf der Airbnb-Inserate ab:

```
POST /airbnb/uebernahme/listings → 409 Conflict
airbnb_uebernahme_kanal_zustand  hat_tokens=False  settings_schluessel=[]
```

Zwei widersprechende Aussagen. Ohne Debugging wäre auch das geraten worden —
mit Debugging waren es zwei Log-Zeilen und zwei DB-Abfragen.

## Was die Messung ergab

```
properties          : 1 Zeile, „Airbnb-Übernahme läuft", draft,
                      airbnb_listing_id = NULL              (07:33:15)
channex_property_map: 1 Zeile                                (07:33:18)
ota_account         : connected_at = NULL, is_active = true  (07:33:19)
Channex-Kanal       : settings = {}, hat_tokens = False
```

Alle drei Zeilen entstehen beim **Klick** auf „Airbnb verbinden", nicht bei der
Zustimmung: `uebernahme_starten` legt ein **Gerüst-Objekt** an und registriert
es bei Channex, weil Channex ein Ziel braucht, auf das die Airbnb-Anzeigen
später gemappt werden. Bleibt die Zustimmung aus, bleiben die Zeilen stehen.

Die alte Messung fragte nur: *steht eine Zeile in `channex_property_map`?* Das
war wahr — und bedeutete nichts.

## Was geändert wurde

`_real_progress` (`apps/api/src/features/dashboard/service.py`) misst jetzt:

| Vorher | Jetzt |
|---|---|
| `has_registered` = Zeile in `channex_property_map` | `ota_account.connected_at` gesetzt **und** `is_active` **und nicht** `token_invalid` |
| `has_property` = irgendeine `properties`-Zeile | Zeilen **ohne** das Gerüst (Titel + fehlende `airbnb_listing_id`) |
| — | neu: `object_count` — die Zahl der echten Objekte, die die Oberfläche anzeigt |

`connected_at` ist die ehrliche Angabe: gesetzt, wenn das **Portal** bestätigt
hat, nicht wenn wir gefragt haben (Wurzel 5b).

Zusätzlich trennt `airbnb_uebernahme.py` jetzt zwei 409-Fälle, die vorher
dieselbe Meldung bekamen:

- `settings` leer → *„Dieses Portal ist noch nicht autorisiert. Klicke auf
  'Airbnb verbinden'…"*
- `token_invalid` → *„…in deinem Airbnb-Konto ist bereits eine andere Software
  verbunden…"*

Vorher las der Kunde im frischen Testkonto die zweite Meldung und suchte nach
einer Verbindung, die es nie gab.

## Nachweis

```
$ node scripts/diagnose/sitzung-pruefen.mjs --tenant beb72997-…
   /properties     : HTTP 200  total=1
   Onboarding      : echte Objekte=0  Portal verbunden=false
   ⓘ 1 Gerüst-Objekt(e) in der Liste — angelegt beim Klick auf „verbinden",
     noch ohne Portal-Daten.

$ node scripts/diagnose/sitzung-pruefen.mjs --tenant a25577cf-…   (AirSmil)
   Onboarding      : echte Objekte=19  Portal verbunden=true
```

Der echte Betrieb bleibt korrekt auf „verbunden" — der Fix hat nichts
verschoben. Festgehalten in
`apps/api/src/features/dashboard/tests/test_onboarding_fortschritt.py`
(8 Tests, u. a. der Live-Fall, zurückgezogene Autorisierung, abgeschaltetes
Konto, gefülltes Gerüst).
