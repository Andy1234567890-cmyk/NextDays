# Domain-Cutover — Staging-URLs → echte Domänen

Stand der Erhebung: 31.07.2026. Alle Angaben unter „Ist-Zustand" sind gegen die
autoritativen DanDomain-Nameserver geprüft, nicht aus dem Kundencenter abgelesen.

> **Wo das DNS wirklich liegt** (gemessen 03.09.2026, `dig NS`):
>
> | Domäne | Nameserver |
> |---|---|
> | `mynextdays.com`, `.de`, `.net`, `.org` | **DanDomain** (`ns`/`ns2.dandomain.dk`) |
> | `mybestdays.eu`, `mybestdays.net` | **DanDomain** |
> | `mybestdays.dk` | **Cloudflare** (`devin`/`yolanda.ns.cloudflare.com`) |
> | `mynextdays.dk` | **Cloudflare** — Mail, NICHT ANFASSEN (siehe unten) |
>
> Der ursprünglich geplante Umzug nach Cloudflare fand für die DanDomain-Zeilen
> NIE statt: das DNS-Hotel schaltet die volle Zone frei, Cloudflare war dafür
> nicht nötig. Die Schritte 1, 2 und 6 unten beschreiben deshalb einen Plan,
> nicht den Betrieb — der Titel dieses Dokuments trug bis zum 03.09.2026 den
> Zusatz „DanDomain → Cloudflare" und legte damit das Gegenteil nahe.
>
> Praktisch heißt das: DNS-Änderungen an `mynextdays.com` laufen über
> kundecenter.dandomain.dk → *Mine produkter* → *DNS Hotel* → Domäne →
> *DNS-Administration*, und werden erst mit **„Udgiv ændringer"** live.

## Status: mynextdays.com ist LIVE (31.07.2026)

Erledigt und gegen die echte Welt geprüft:

| Domain | App | HTTPS | Zertifikat |
|---|---|---|---|
| `mynextdays.com` | nextdays-marketing (id 6) | 200 | Let's Encrypt |
| `www.mynextdays.com` | nextdays-marketing | 200 | Let's Encrypt |
| `app.mynextdays.com` | nextdays-web (id 2) | 307 → /login | Let's Encrypt |
| `api.mynextdays.com` | nextdays-api (id 8) | 200 | Let's Encrypt |

DNS liegt weiterhin bei **DanDomain** (DNS-Hotel-Abo, 10 DKK/Monat) — Cloudflare
war für diese Domain nicht nötig, weil das DNS-Hotel die volle Zone freischaltet.
Wildcard `*.mynextdays.com` wurde entfernt (es hätte `api.`/`app.` überdeckt).

Die alten `…sslip.io`-URLs sind bewusst PARALLEL aktiv geblieben und antworten
weiter mit 200 — Rückfallebene, solange die neuen Domains nicht bewiesen stabil sind.

### Stolperstein, der Zeit gekostet hat

Coolify speichert die Traefik-Labels **base64-kodiert in `applications.custom_labels`**
und generiert sie beim Deploy NICHT neu. Ein geändertes `fqdn` allein bewirkt daher
nichts — der neue Container bekommt weiter die alten Routen. Richtig ist:

```php
$a->fqdn = "https://alt.sslip.io,https://neu.tld";
$a->save();
$a->custom_labels = base64_encode(implode(PHP_EOL, generateLabelsApplication($a)));
$a->save();
// danach erst deployen
```

Die API (`build_pack: dockercompose`) nutzt statt `fqdn` das Feld
`docker_compose_domains` — dort MUSS das `:8000`-Suffix je Domain erhalten bleiben.

### Marketing verlinkt NICHT mehr ins Dashboard

Vor dem Start (1. September 2026) darf von der Marketing-Seite kein Link in die
App führen — ein Besucher könnte sich dort weder anmelden noch registrieren.
Live standen aber vier absolute Links auf die Dashboard-Staging-URL
(`/login`, `/signup`, `/agb`, `/hilfe`).

Ursache und Reparatur in `marketing/lib/app-url.ts`:

Das Voranmelde-Popup erkannte seine Knöpfe an `href.startsWith(APP_URL)`. Diese
Kopplung an eine Domain war die eigentliche Falle: Sobald `NEXT_PUBLIC_LOGIN_URL`
auf `app.mynextdays.com` gezeigt hätte, wäre die Erkennung STILL gescheitert und
dieselben Knöpfe hätten Besucher ins Login geschickt, statt das Popup zu öffnen.

Jetzt zeigen die Knöpfe auf das feste Marker-Ziel `#voranmeldung`, und das Popup
erkennt genau dieses Ziel — unabhängig von jeder Domain. `AGB_URL`/`HILFE_URL`
sind vor dem Start leer; Footer-Einträge mit leerem Ziel entfallen, statt auf
eine unerreichbare Adresse zu zeigen.

**Zum Start:** `VOR_DEM_START = false` in `components/voranmeldung-popup.tsx`
und `NEXT_PUBLIC_APP_URL=https://app.mynextdays.com` in Coolify setzen. Dann
führen dieselben Knöpfe wieder in die App — kein Marketing-Baustein wird angefasst.

### Noch offen

- Code-Fallbacks (Schritt 8) zeigen weiter auf `…sslip.io` — funktioniert, ist aber
  nicht das Zielbild.
- Die übrigen `.com`-Domänen (`.net`, `.org`, `mynextdays.de`, `mybestdays.*`)
  liegen weiter auf DanDomain-Parking.

## Status: mybestdays.dk ist LIVE (17.08.2026)

myBestDays (Marktplatz + Gastgeber-Dashboard) läuft unter der eigenen Domäne.
Anders als bei `mynextdays.com` liegt DNS hier auf **Cloudflare** — die Zone
musste neu angelegt werden, weil DanDomain die NS-Umstellung sonst verweigert
(„Domænet eksisterer ikke på navneserveren": der Registrar prüft VOR dem
Umstellen, ob die Zone auf dem Ziel-NS existiert). Reihenfolge ist also:
Zone anlegen → Records setzen → dann erst NS beim Registrar.

| Domain | App (Coolify) | HTTPS | Zertifikat |
|---|---|---|---|
| `mybestdays.dk` | nextdays-plattform (id 3) | 200 | Let's Encrypt, bis 15.11.2026 |
| `www.mybestdays.dk` | nextdays-plattform | 200 | Let's Encrypt |
| `gastgeber.mybestdays.dk` | nextdays-gastgeber (id 12) | 307 → `/anmelden` | Let's Encrypt |

DNS: drei A-Records auf `65.21.144.136`, TTL 300. Das DanDomain-Wildcard `*`
wurde beim Zonen-Import NICHT übernommen — es hätte `gastgeber.` mit der
Parking-IP überdeckt und gegen jeden eigenen Record gewonnen.

Nameserver: `devin.ns.cloudflare.com`, `yolanda.ns.cloudflare.com`. Die Zone
steht in der Cloudflare-API weiter auf `status: pending`; das ist nur deren
eigene Prüfschleife und ohne Wirkung auf die Auflösung (Registry und beide
Resolver liefern korrekt).

### Cloudflare-Proxy ist hier AN (anders als bei mynextdays.com)

Nach Ausstellung der Zertifikate wurde der Proxy für alle drei Records
aktiviert. Grund: Lighthouse wies 6.110 ms Dokumentlatenz aus, weil jeder
Request direkt an Hetzner ging — ohne Edge-Cache, ohne Kompression.

| Einstellung | Wert |
|---|---|
| Proxy | an (orange), alle drei Records |
| SSL/TLS | **Full (strict)** — Pflicht, sobald der Proxy davor steht |
| Always Use HTTPS | an |
| Brotli, HTTP/3, Early Hints | an |
| HSTS | `max-age=31536000; includeSubDomains` |

Die Reihenfolge ist zwingend: **grau bis das Zertifikat steht, dann orange.**
Bei aktivem Proxy terminiert Cloudflare das TLS, und die
Let's-Encrypt-HTTP-01-Challenge von Coolify schlägt fehl.

`cf-cache-status: DYNAMIC` auf dem HTML ist gewollt — die Seiten sind
personalisiert. Gecacht werden die statischen Assets.

### Env-Variablen (Coolify, nextdays-api id 8)

`CORS_ORIGINS` und `TRUSTED_HOSTS` um `mybestdays.dk`, `www.mybestdays.dk` und
`gastgeber.mybestdays.dk` ergänzt (sslip.io-Hosts blieben drin);
`MARKETPLACE_BASE_URL` von der sslip.io-Adresse auf `https://mybestdays.dk`.

### Stolperstein: Labels wirken erst nach dem Deploy

Nach dem Eintragen der Domains antwortete `mybestdays.dk` mit Traefiks eigenem
`404 page not found` — DNS und Routing stimmten, aber der LAUFENDE Container
trug nur seine alte sslip.io-Route. Die neuen Labels liegen in
`applications.custom_labels` und erreichen Traefik erst über einen Deploy
(`POST /api/v1/deploy?uuid=…&force=true`; der GET-Endpunkt existiert nicht mehr).
Prüfen lässt sich das direkt am Container:
`docker inspect <name> --format '{{range $k,$v := .Config.Labels}}…' | grep rule=Host`.

### Bewusst nicht gemacht

Bild-Uploads werden weiterhin unverändert gespeichert (13 Endpunkte in
`apps/api`, kein Resize/WebP/EXIF-Stripping; Lighthouse: 2.192 KiB Einsparung
möglich). Auf Entscheidung des Nutzers offen gelassen.

## Ist-Zustand (Erhebung vor dem Cutover)

Sieben Domänen liegen bei DanDomain (`ns.dandomain.dk`, `ns2.dandomain.dk`),
`mynextdays.dk` liegt bereits auf Cloudflare (`yolanda`/`devin.ns.cloudflare.com`).

| Domain | Nameserver | Inhalt |
|---|---|---|
| `mynextdays.com` | DanDomain | nur Parking-A + Wildcard |
| `mynextdays.de` | DanDomain | nur Parking-A + Wildcard |
| `mynextdays.net` | DanDomain | nur Parking-A + Wildcard |
| `mynextdays.org` | DanDomain | nur Parking-A + Wildcard |
| `mybestdays.dk` | DanDomain | nur Parking-A + Wildcard |
| `mybestdays.eu` | DanDomain | nur Parking-A + Wildcard |
| `mybestdays.net` | DanDomain | nur Parking-A + Wildcard |
| `mynextdays.dk` | **Cloudflare** | **Mail (MX → 62.238.4.193). NICHT ANFASSEN.** |

**Wichtigster Befund:** Auf den sieben DanDomain-Domänen gibt es **keine MX-,
keine TXT- und keine CNAME-Records** — ausschließlich einen A-Record auf
`212.237.249.17` (DanDomain-Parking) plus ein Wildcard `*`, das jeden
beliebigen Namen beantwortet (verifiziert mit einem Fantasie-Hostnamen).

Daraus folgt zweierlei:
1. Beim Umzug kann **nichts verloren gehen** — es gibt kein Mailrouting, keine
   SPF/DKIM-Einträge und keine Domain-Verifizierungen, die man mitnehmen müsste.
2. Das **Wildcard muss weg**. Solange es existiert, beantwortet es auch
   `api.` und `app.` mit der Parking-IP und gewinnt gegen alles, was wir
   sonst anlegen.

## Zielbild

Server: `65.21.144.136` (Staging, siehe `deploy/DEPLOY-RUNBOOK.md`).

| App | Staging heute | Ziel |
|---|---|---|
| Marketing | *(keine, nur lokal :3001)* | `mynextdays.com` (+ `www` → 301) |
| Dashboard (web) | `bln3q0n1l1se2hna8utkuag9…sslip.io` | `app.mynextdays.com` |
| API (FastAPI) | `nextdays-api…sslip.io` | `api.mynextdays.com` |
| Plattform | `y13cm245vlmvq3yv38gdbtat…sslip.io` | `mybestdays.dk` (+ `www` → 301) |
| Supabase/Kong | `supabase-kong…sslip.io` | **bleibt sslip.io** (Sicherheitsentscheidung) |

Die übrigen Domänen bekommen **keinen eigenen Inhalt**, sondern 301-Weiterleitungen.
Mehrere Domains mit identischem Inhalt wertet Google als Duplicate Content und
verteilt die Linkkraft — ein 301 bündelt sie stattdessen auf das Original:

- `mynextdays.de`, `mynextdays.net`, `mynextdays.org` → 301 auf `mynextdays.com`
- `mybestdays.eu`, `mybestdays.net` → 301 auf `mybestdays.dk`

## Reihenfolge

Diese Reihenfolge ist nicht verhandelbar. Wer zuerst den Code umstellt, nimmt die
Apps vom Netz, weil die neuen Domains noch nirgends hinzeigen.

### Schritt 0 — TTL senken (mindestens 24 h vorher)

Im DanDomain-Kundencenter bei den vier aktiven Domänen die TTL auf **300 Sekunden**
setzen. Grund: Die TTL bestimmt, wie lange Resolver eine ALTE Antwort behalten.
Steht sie auf 3600 oder höher, dauert ein Rückweg im Fehlerfall Stunden. Bei 300 s
sind es fünf Minuten. Das ist die einzige Vorbereitung, die Zeit braucht — deshalb
zuerst.

### Schritt 1 — Domains in Cloudflare anlegen

Für jede der sieben Domänen: Cloudflare → *Add a site* → Domain eingeben → Free-Plan.

Cloudflare scannt die bestehenden Records. Da es nur Parking gibt, ist das Ergebnis
egal — **alle gescannten A-Records und das Wildcard `*` löschen.** Nichts davon
wird gebraucht.

### Schritt 2 — Records in Cloudflare setzen

**`mynextdays.com`**

| Typ | Name | Ziel | Proxy |
|---|---|---|---|
| A | `@` | `65.21.144.136` | **DNS only (grau)** |
| A | `app` | `65.21.144.136` | **DNS only (grau)** |
| A | `api` | `65.21.144.136` | **DNS only (grau)** |
| A | `www` | `65.21.144.136` | **DNS only (grau)** |

**`mybestdays.dk`**

| Typ | Name | Ziel | Proxy |
|---|---|---|---|
| A | `@` | `65.21.144.136` | **DNS only (grau)** |
| A | `www` | `65.21.144.136` | **DNS only (grau)** |

**Proxy zwingend auf „DNS only" (graue Wolke), nicht orange.** Coolify holt die
TLS-Zertifikate per Let's-Encrypt-HTTP-01-Challenge; steht der Cloudflare-Proxy
davor, terminiert Cloudflare das TLS und die Challenge schlägt fehl. Der Proxy
kann später aktiviert werden, wenn die Zertifikate stehen — aber nicht beim Cutover.

Für die vier Redirect-Domänen (`.de`, `.net`, `.org`, `mybestdays.eu`,
`mybestdays.net`): je einen A-Record `@` und `www` auf `65.21.144.136`, hier
**mit orangem Proxy**, weil die Weiterleitung über Cloudflare-Regeln läuft
(Schritt 5) und dafür kein Zertifikat von unserem Server nötig ist.

### Schritt 3 — Nameserver bei DanDomain umstellen

Cloudflare nennt zwei Nameserver (z. B. `xyz.ns.cloudflare.com`). Diese im
DanDomain-Kundencenter unter *Sæt navneservere* eintragen — pro Domain.

`.dk`- und `.eu`-Domänen können bis zu 24 h brauchen, `.com`/`.net`/`.org`
meist unter einer Stunde.

**`mynextdays.dk` dabei NICHT anfassen** — die liegt schon richtig und trägt die Mail.

### Schritt 4 — Propagation prüfen

Nicht auf Verdacht weitermachen, sondern messen:

```bash
for h in mynextdays.com app.mynextdays.com api.mynextdays.com mybestdays.dk; do
  printf "%-26s " "$h"; dig +short A "$h"
done
```

Erst weiter, wenn überall `65.21.144.136` steht. Kommt noch `212.237.249.17`,
ist die alte Antwort im Cache — abwarten, nicht nachhelfen.

### Schritt 5 — Redirects der Marken-Domänen

> **Der Umzug zu Cloudflare hat für diese Domänen NIE stattgefunden.** Gemessen
> am 03.09.2026 per `dig NS`: sechs der sieben Domänen liegen weiterhin bei
> **DanDomain** (`ns.dandomain.dk` / `ns2.dandomain.dk`) — `mynextdays.de`,
> `.net`, `.org`, `.com` sowie `mybestdays.eu` und `.net`. Einzig
> `mybestdays.dk` liegt auf Cloudflare (`devin`/`yolanda.ns.cloudflare.com`).
>
> Die Anleitung unten war als Cloudflare-Weg geschrieben (Titel des Dokuments:
> „DanDomain → Cloudflare"). Für alles außer `mybestdays.dk` ist sie damit die
> Beschreibung eines Plans, nicht des Betriebs. Wer nach „Rules → Redirect
> Rules" sucht, findet die Zone dort nicht — dieselbe Falle, die schon einmal
> Zeit gekostet hat (siehe `memory`-Eintrag zur DanDomain-Verwaltung).

**Bei DanDomain** (der reale Weg für die sechs Domänen): Kundencenter →
*Mine produkter* → *DNS Hotel* → Domäne → *DNS-Administration* → dort
**„Ny viderestilling"** (Neue Weiterleitung) statt eines DNS-Records. Wie bei
jeder Zonenänderung wird sie erst mit **„Udgiv ændringer"** wirksam — ohne
diesen zweiten Klick sieht die Oberfläche erfolgreich aus und nichts passiert.

**Bei Cloudflare** (nur `mybestdays.dk`): *Rules → Redirect Rules*, Bedingung
*Hostname enthält*, **301**, „Preserve query string" an.

Ziele:

| Von | Nach |
|---|---|
| `mynextdays.de`, `.net`, `.org` | `https://www.mynextdays.com/$1` |
| `mybestdays.eu`, `mybestdays.net` | `https://mybestdays.dk/$1` |

**Warum `www.` und nicht der Apex (seit 03.09.2026):** `mynextdays.com` leitet
selbst per 308 auf `www.mynextdays.com` weiter (`marketing/next.config.ts`).
Ein Redirect auf den Apex ergäbe also ZWEI Weiterleitungen hintereinander —
funktioniert, kostet aber einen unnötigen Roundtrip und verwässert das Signal
für Suchmaschinen. Eine Schleife kann nicht entstehen, weil `.de` und `.com`
verschiedene Hosts sind.

### Schritt 6 — Coolify: Domains an die Apps hängen

Pro App die Domain eintragen (siehe Zielbild-Tabelle). Coolify fordert das
Let's-Encrypt-Zertifikat automatisch an, sobald DNS auf den Server zeigt.

Achtung `docker_compose_domains`: laut `deploy/`-Doku braucht Kong das
`:8000`-Suffix — für die vier neuen Apps gilt das **nicht**, die laufen über
die normalen Ports.

### Schritt 7 — Env-Variablen in Coolify

Diese Werte liegen als Env in Coolify, **nicht** im Repo:

| App | Variable | Wert |
|---|---|---|
| API | `CORS_ORIGINS` | `https://mynextdays.com,https://app.mynextdays.com,https://mybestdays.dk` |
| API | `TRUSTED_HOSTS` | `*.mynextdays.com,mynextdays.com,mybestdays.dk` |
| Marketing | `NEXT_PUBLIC_LOGIN_URL` | `https://app.mynextdays.com/login` |

`trusted_hosts` unterstützt Wildcard-Subdomains (`src/core/config.py`), deshalb
genügt `*.mynextdays.com` für `app.` und `api.`.

### Schritt 8 — Code-Fallbacks austauschen

Erst wenn die Domains stehen. Betroffen sind die hartkodierten Fallback-URLs:

- `marketing/lib/app-url.ts` — `LOGIN_URL_FALLBACK`
- `plattform/components/plattform-nav.tsx`, `site-header.tsx`, `konto-button.tsx`
- `mobile-bestdays/lib/config.ts` und `mobile-nextdays/lib/config.ts` — `apiUrl`
  (Kong-URL bleibt; die Datei ist eine Schwesterdatei, beide gleich halten)
- `web/components/einstellungen/calendar-sync.tsx` — `API_DOCS_URL`
- `apps/api/src/core/tests/test_trusted_hosts.py` — Testkonstanten

### Schritt 9 — Mobile neu bauen

Die URLs sind in der App **einkompiliert**. Ohne neuen Build reden bereits
installierte Apps weiter mit der alten Adresse. Da Kong auf sslip.io bleibt,
betrifft es nur `apiUrl` — Auth/Realtime laufen unverändert weiter.

## Was bewusst NICHT passiert

- **`mynextdays.dk` bleibt unangetastet.** Mailserver (62.238.4.193), MX, SPF,
  DKIM, DMARC und der Webmailer hängen daran. Ein Fehler hier bricht den
  Mailversand der gesamten Plattform.
- **Supabase/Kong bleibt auf sslip.io** — ausdrückliche Sicherheitsentscheidung.
- **Kein Cloudflare-Proxy** auf den vier aktiven Hosts, solange die
  Let's-Encrypt-Zertifikate nicht stehen.

## Rückweg

Geht etwas schief: in Cloudflare den A-Record zurück auf `212.237.249.17`, oder
bei DanDomain die alten Nameserver wieder eintragen. Mit TTL 300 s ist der
Zustand nach etwa fünf Minuten zurück — genau dafür ist Schritt 0 da.

Die Staging-URLs (`…sslip.io`) bleiben während des gesamten Cutovers aktiv und
funktionsfähig. Sie werden erst abgeschaltet, wenn die neuen Domains bewiesen
laufen.
