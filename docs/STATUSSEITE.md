# Öffentliche Statusseite — `status.mynextdays.com`

Die Statusseite ist das, was ein Kunde bei einer Störung als erstes sucht:
*läuft es gerade, oder liegt es an mir?* Sie liegt deshalb **außerhalb** der
Anwendung — eine Statusseite, die mit der App zusammen ausfällt, ist wertlos.

Betrieben wird sie mit Uptime Kuma auf demselben Server (`65.21.144.136`,
Container `uptime-kuma`, Port 3001 intern).

> **Stand 19.08.2026, abends:** `https://status.mynextdays.com/status/status`
> ist **live** — HTTP 200, Let's-Encrypt-Zertifikat auf den richtigen Namen
> (gültig bis 17.11.2026), HTTP leitet auf HTTPS um, 5/5 Monitore oben. Die
> interne Adresse funktioniert unverändert weiter.
>
> Offen ist nur noch Schritt 3: die zwei Coolify-Variablen an der
> Marketing-App. Bis sie gesetzt sind, entfällt der Footer-Eintrag — bewusst,
> siehe „Warum kein Link auf die interne Adresse".

## Reihenfolge (die Schritte hängen aneinander)

### 1. DNS bei DanDomain — **erledigt**

`mynextdays.com` liegt **nicht** bei Cloudflare, sondern bei DanDomain
(`ns.dandomain.dk`, `ns2.dandomain.dk`). Der Cloudflare-API-Token im Repo hat
dort keinen Zugriff — er verwaltet nur die Zonen `mynextdays.dk` und
`mybestdays.dk`, und die tragen bisher ausschließlich Mail-Einträge.

Einzutragen:

| Typ | Name | Ziel |
|---|---|---|
| A | `status` | `65.21.144.136` |

Prüfen:

```bash
host status.mynextdays.com     # erwartet: 65.21.144.136, nicht NXDOMAIN
```

### 2. Traefik-Route — **erledigt, aber anders als hier zuerst geplant**

Nicht über Container-Labels, sondern über den **Datei-Provider**:
`/data/coolify/proxy/dynamic/nd-statusseite.yaml`. Grund: Labels lassen sich an
einem laufenden Container nicht ändern, er müsste gelöscht und neu erstellt
werden — für das Hinzufügen einer Domain ein zu großer Eingriff in einen
laufenden Dienst. Traefik läuft mit `--providers.file.watch=true`, liest die
Datei also sofort ein, ohne Neustart und ohne Ausfall.

**Fallstrick, der dabei 503 verursachte:** Die Route referenzierte zunächst die
Middlewares `gzip` und `redirect-to-https` — die sind aber als Container-LABEL
definiert und liegen damit im **Docker**-Provider. Eine Datei-Route sucht sie im
**File**-Provider (`gzip@file`) und scheitert mit „middleware does not exist".
Provider haben getrennte Namensräume. Die Datei definiert deshalb eigene
Middlewares (`nd-status-gzip`, `nd-status-https`).

Die alte Anleitung über Labels, falls der Container ohnehin neu erstellt wird:

<details>
<summary>Label-Variante (nicht nötig, nur zur Vollständigkeit)</summary>

Der Kuma-Container ist **nicht** von Coolify verwaltet (`coolify.managed=false`)
— seine Traefik-Labels sind von Hand gesetzt. Die Domain muss in die
Router-Regel, sonst antwortet Traefik mit 404, obwohl DNS und Container stehen.

Aktuell (gekürzt):

```
traefik.http.routers.https-uptimekuma.rule = Host(`uptimekuma.65.21.144.136.sslip.io`) && PathPrefix(`/`)
```

Ziel — beide Hostnamen, damit die interne Adresse für den Serverabruf weiter
funktioniert:

```
Host(`uptimekuma.65.21.144.136.sslip.io`, `status.mynextdays.com`) && PathPrefix(`/`)
```

Dasselbe für den `http-uptimekuma`-Router. Labels lassen sich an einem
laufenden Container nicht ändern; er muss mit den neuen Labels neu erstellt
werden (die Daten liegen im Volume, gehen also nicht verloren — **vorher
prüfen**, dass das Volume wirklich eingebunden ist).

</details>

Danach stellt `letsencrypt` das Zertifikat für die neue Domain automatisch aus.
Prüfen:

```bash
curl -sI https://status.mynextdays.com | head -1
echo | openssl s_client -servername status.mynextdays.com \
  -connect status.mynextdays.com:443 2>/dev/null | openssl x509 -noout -subject
```

### 3. Zwei Coolify-Variablen an der Marketing-App

| Variable | Wert | wozu |
|---|---|---|
| `NEXT_PUBLIC_STATUS_URL` | `https://status.mynextdays.com/status/status` | der Link, den der Besucher anklickt |
| `STATUS_SERVER_URL` | `https://status.mynextdays.com` | die Adresse, die UNSER Server abfragt |

Zwei Variablen, weil es zwei verschiedene Dinge sind: die erste ist der Link im
Browser, die zweite der Abruf von unserem Server aus. Seit die eigene Domain
steht, tragen beide denselben Wert — die Trennung bleibt trotzdem, weil
`STATUS_SERVER_URL` jederzeit auf die interne Adresse zeigen kann, ohne den
Besucher-Link zu verändern. Nach außen dringt daraus nichts:
`app/api/status/route.ts` gibt nur die verdichtete Lage heraus — keine
Monitor-Namen, keine internen Hostnamen, keine Ping-Zeiten.

Nach dem Setzen neu deployen (`NEXT_PUBLIC_*` wird zur BUILD-Zeit eingebacken,
ein Neustart allein genügt nicht).

## Was der Footer dann zeigt

In der Spalte „Ressourcen" steht „Systemstatus" (24 Sprachen) mit einem
Live-Punkt davor, wie bei `status.claude.com` oder `status.stripe.com`:

| Punkt | Bedeutung |
|---|---|
| grün | alle Monitore oben |
| gelb | mindestens einer unten (Teilausfall) |
| rot | keiner mehr oben |
| blau | Wartung angekündigt |
| kein Punkt | Lage unbekannt |

Streng nach Teilausfall: **ein** Dienst unten heißt „gestört", nicht „läuft" —
wer die Buchungsplattform braucht, ist nicht bedient, weil das Storybook
antwortet.

„Kein Punkt" ist Absicht und der wichtigste Fall: antwortet unser Abruf nicht,
wird nichts angezeigt. Ein grüner Punkt bei unbekanntem Zustand wäre eine
Falschaussage über den Betrieb, ein roter eine Falschaussage über einen Dienst,
der vielleicht läuft (Wurzel 5b — unsere Messung ist nicht der Zustand des
fremden Dienstes).

## Warum kein Link auf die interne Adresse

Es wäre schnell gegangen, `uptimekuma.65.21.144.136.sslip.io` in den Footer zu
schreiben. Das ist schlechter als kein Link:

- Die **Server-IP** stünde im Klartext auf jeder Marketing-Seite.
- Das **Zertifikat** lautet auf `*.sslip.io` — ein Besucher sieht eine
  Fremd-Domain und liest das als Phishing.
- Die Adresse **ändert sich** beim nächsten Coolify-Deploy.

Deshalb entfällt der Eintrag, solange `NEXT_PUBLIC_STATUS_URL` leer ist. Das
ist derselbe Umgang wie beim Hilfe-Center (`HILFE_URL`): leeres Ziel → Eintrag
weglassen, statt auf `#` zu zeigen.

## Warum der Abruf über eine eigene Route läuft

Kuma sendet auf `/api/status-page/heartbeat/*` **kein**
`Access-Control-Allow-Origin` (live geprüft am 19.08.2026). Ein `fetch` direkt
aus dem Browser wird von der Same-Origin-Policy geblockt — der Punkt wäre nie
erschienen, und weil die Komponente absichtlich still scheitert, hätte das
niemand gemerkt. Der Abruf gehört daher auf den Server
(`marketing/app/api/status/route.ts`, 60 s Zwischenspeicher, 5 s Zeitlimit).

## Offene Schwäche: die Monitore prüfen die falschen Adressen

Alle zehn Monitore zeigen auf `*.sslip.io`, also auf Coolifys interne Adressen.
Was Kunden aufrufen — `api.mynextdays.com`, `mynextdays.com` — wird **nicht**
geprüft. Unbemerkt bliebe damit:

- **DNS-Ausfall** oder falscher A-Record: intern grün, außen nichts erreichbar.
- **Abgelaufenes Zertifikat der echten Domain.** Es sind zwei verschiedene
  Zertifikate: `api.mynextdays.com` läuft am **29.10.2026** ab, das überwachte
  `*.sslip.io` am 18.09.2026. Kuma sieht nur das zweite.
- **Domain-Routing im Proxy**, also jede Fehlkonfiguration, die nur den
  öffentlichen Weg betrifft.

Außerdem fehlt der Gast-Marktplatz (`mybestdays.dk`) ganz, obwohl die
Marktplatz-App inzwischen bei Testern liegt. Und `/health` sagt nur „Prozess
lebt" — es bleibt grün, während die Datenbank weg ist.

Das ist noch nicht behoben; es ist eine eigene Aufgabe, keine Nebenwirkung
dieser Seite.
