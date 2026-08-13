# MCP-Connector — myNextDays in claude.ai

Ein Betrieb verbindet sein myNextDays-Konto mit claude.ai (oder einem anderen
MCP-Client) und kann dort **lesend** mit seinen Daten arbeiten: Kalender,
Buchungen, Buchungsnotizen und Posteingang.

**Nur lesend.** Es gibt keine schreibenden Werkzeuge — keine Buchung wird
angelegt, keine Nachricht gesendet, keine Notiz geändert.

---

## In claude.ai einrichten

Der Betrieb trägt unter **Customize → Connectors → Add custom connector** ein:

```
https://<domain>/api/v1/mcp
```

Danach führt Claude durch die Anmeldung: der Nutzer landet im myNextDays-
Dashboard, bestätigt den Zugriff und wird zurückgeleitet. Erteilte Verbindungen
stehen unter **Konto → Verbindungen** und lassen sich dort trennen.

Kein Client-Secret nötig — die Anmeldung läuft über CIMD (siehe unten).

---

## Warum diese Bauweise

### CIMD statt Dynamic Client Registration

Anthropic empfiehlt für Server mit vielen Nutzern ausdrücklich **CIMD** (Client
ID Metadata Document). Bei DCR registriert Claude bei *jeder frischen
Verbindung* einen neuen OAuth-Client — bei vielen Betrieben wüchse eine
Client-Tabelle unbegrenzt, ohne dass ein Eintrag je wieder gebraucht würde.

Bei CIMD **ist** die `client_id` eine HTTPS-URL, die auf die Client-Metadaten
zeigt. Der Server holt sie zur Laufzeit und prüft die `redirect_uri` dagegen.
Es gibt keine Registrierung und keine Client-Tabelle.

Damit Claude CIMD wählt, müssen in der Authorization-Server-Metadata **beide**
Felder stehen:

```json
"client_id_metadata_document_supported": true,
"token_endpoint_auth_methods_supported": ["none"]
```

Fehlt eines, fällt Claude auf DCR zurück und sucht einen
`registration_endpoint`, den wir bewusst nicht anbieten.

### Kein client_credentials

Der vorhandene Token-Endpunkt aus `api_clients` (0179) ist ein
Client-Credentials-Grant — Maschine ohne Nutzer. Anthropic unterstützt den für
Connectors **nicht**: „Every connection requires user consent." Deshalb ein
eigener, user-delegierter Authorization-Code-Flow mit PKCE (0385).

### Der 401 ist das Protokoll

Ein unauthentifizierter `tools/call` scheitert als echter **HTTP-401** mit
`WWW-Authenticate` — und zwar *bevor* die JSON-RPC-Schicht ihn sieht.

Eine 200-Antwort mit `isError: true` erzeugt in Claude **keinen**
Verbindungs-Dialog, sondern nur Text im Chat („please sign in"), und der Nutzer
könnte sich nie anmelden. Das ist die häufigste Fehlerquelle beim Bau eines
Connectors.

`initialize` und `tools/list` bleiben offen (Lazy Authentication): so lässt sich
der Server hinzufügen und seine Werkzeuge ansehen, bevor man sich anmeldet.

---

## Endpunkte

| Pfad | Zweck |
|---|---|
| `/.well-known/oauth-protected-resource` | RFC 9728 — wo steht der Auth-Server? |
| `/.well-known/oauth-protected-resource/api/v1/mcp` | dieselbe Antwort, pfad-suffigiert (Clients probieren diese zuerst) |
| `/.well-known/oauth-authorization-server` | RFC 8414 — Beschreibung des Auth-Servers |
| `/api/v1/mcp/authorize` | Einstieg: prüft PKCE + CIMD + redirect_uri, leitet ins Dashboard |
| `/api/v1/mcp/consent` | Zustimmung speichern, Code ausstellen (Dashboard ruft das auf) |
| `/api/v1/mcp/token` | Code → Token, Refresh-Rotation (`form-urlencoded`) |
| `/api/v1/mcp` | der MCP-Endpunkt selbst (POST, Streamable HTTP) |
| `/api/v1/mcp/verbindungen` | erteilte Zustimmungen lesen/trennen |

**Die Discovery-Pfade liegen auf der Domain-Wurzel**, nicht unter `/api/v1` —
Clients suchen sie dort. Unter dem Präfix fände die Erkennung nichts und die
Verbindung schlüge mit „Couldn't reach the MCP server" fehl.

---

## Werkzeuge

| Name | Liefert |
|---|---|
| `kalender_verfuegbarkeit` | Belegung je Tag **plus** die Zahl freier Einheiten (Stop-Sell eingerechnet) |
| `buchungen_liste` | Buchungen, optional nach Objekt und Anreise-Zeitraum |
| `buchung_detail` | eine Buchung vollständig |
| `posteingang_liste` | Konversationen **aller** Kanäle in einer Liste |
| `posteingang_verlauf` | Nachrichten einer Konversation |
| `buchung_notizen` | interner Notiz-Verlauf (erfordert `PM_VIEW_NOTES`) |

### Ein Posteingang, nicht zwei

Für den Betrieb ist der Posteingang *ein* Posteingang. Er fragt „was hat der
Gast geschrieben", nicht „über welches System kam das". Deshalb führt
`posteingang_liste` alle Quellen zusammen — OTA über Channex, den
myBestDays-Marktplatz und übernommene Verläufe aus einem fremden PMS — und
nennt den Kanal als **Feld** an jedem Thread.

Zwei Werkzeuge hätten das Modell raten lassen, in welchem es suchen soll; ein
Fehlgriff hätte „nichts gefunden" geheißen, obwohl die Nachricht im anderen
lag. Und beim nächsten angebundenen Kanal wäre es ein drittes geworden.

Die Zusammenführung sitzt im **Service-Layer**
(`features/inbox/nebenquellen.py`), nicht im MCP-Layer: Web-UI, Mobile-Apps und
die geplante Open API bekommen sie damit ebenfalls, und ein neuer Kanal ist ein
Eintrag an einer Stelle.

---

## Sicherheit

Alles, was der Service-Layer erzwingt, gilt hier automatisch — der MCP-Server
ruft dieselben Methoden wie die Weboberfläche und hat keine eigene Fachlogik.

| Regel | Umsetzung |
|---|---|
| Tenant-Scope (Wurzel 3) | aus dem Token, nie aus einem Parameter des Aufrufers |
| Owner-Scope §4.2 | Eigentümer sehen nur zugeordnete Objekte |
| Rollen-Split §4.3 | staff/cleaner ohne Beträge — aus der DB, nicht aus dem JWT |
| Item-Scope (Wurzel 9) | `{id}`-Zugriffe prüfen denselben Scope wie die Liste |
| Obergrenzen (Wurzel 8) | jedes Werkzeug deckelt Zeitraum und Listenlänge |
| Zeitstempel (Wurzel 5b) | Portal-Zeit oder leer — nie unsere Uhr als fremdes Ereignis |

Dazu die OAuth-spezifischen Maßnahmen:

- **Codes und Refresh-Token** liegen nur als SHA-256 in der DB.
- **Codes sind einmal einlösbar**; ein zweiter Versuch wird protokolliert (er
  bedeutet, dass der Code abgefangen wurde).
- **Refresh-Token rotieren** mit Reuse-Detection: ein wiederverwendeter Token
  verwirft die gesamte Kette dieses Clients.
- **PKCE S256** ist Pflicht, `plain` wird abgelehnt.
- **`redirect_uri`** wird exakt verglichen; Loopback-Adressen ohne Port
  (RFC 8252 §7.3, für native Clients).
- **CIMD-Abruf ist SSRF-gehärtet**: HTTPS-Pflicht, interne/CGNAT/Metadaten-IPs
  gesperrt, Größenlimit, keine Redirects.
- **Token-Audience** ist die angeforderte Ressource (RFC 8707) — ein Token für
  einen anderen Dienst wird abgelehnt (Token-Passthrough ist verboten).
- **Zustimmung wird je (Nutzer, Client) gespeichert** und vor der Weiterleitung
  geprüft (gegen Confused Deputy).
- **Session-IDs sind keine Authentifizierung**: jeder Request weist sich einzeln
  per Bearer-Token aus; die Session-ID trägt die Nutzer-ID in sich.
- **Trennen löscht die Refresh-Token** — sonst könnte der Client sich noch bis
  zu 30 Tage neue Zugangstoken holen, und „getrennt" wäre eine Falschaussage.

Der Zustimmungsdialog zeigt den **Host der `client_id`-URL** als Antragsteller,
nicht den Namen aus dem Client-Dokument: das Dokument ist selbst-behauptet, jede
Seite könnte sich darin „Claude" nennen. Der Host ist die einzige geprüfte
Identität.

---

## Betrieb

**Voraussetzungen**

- **`PUBLIC_API_URL`** muss die öffentliche Adresse **dieser API** tragen
  (`https://api.mynextdays.com`). Sie steht als `resource`/`issuer` in der
  Discovery; ohne sie antworten die Discovery-Endpunkte mit 503 statt mit
  Metadaten auf einer geratenen Domain.

  Das ist die **bestehende** Einstellung — sie speist bereits den
  Channex-Webhook-Callback und die TrustedHost-Liste. Bewusst keine eigene
  MCP-Variable: zwei Einstellungen für dieselbe Adresse laufen irgendwann
  auseinander, und dann zeigt die Discovery woandershin als der Webhook.

  Nicht zu verwechseln mit `APP_BASE_URL` — das ist das **Dashboard**
  (`https://app.mynextdays.com`), und nur der Zustimmungsdialog leitet dorthin.
  Stünde die Dashboard-Adresse in `resource`/`issuer`, zeigte die Discovery auf
  einen Host ohne MCP-Endpunkt; Claude meldet dann nur „Couldn't reach the MCP
  server", ohne die Ursache zu nennen. Zwei Tests sichern die Trennung ab.
- `APP_BASE_URL` muss weiterhin aufs Dashboard zeigen (Zustimmungsdialog).
- `API_TOKEN_SECRET` signiert die Access-Token (dasselbe wie beim API-Zugang).
- Anthropic ruft aus `160.79.104.0/21` an; eine WAF davor muss das durchlassen.
- Discovery- und Token-Endpunkte müssen unter 10 Sekunden antworten.

**Migrationen**

`0384_reservation_notes.sql` und `0385_mcp_oauth.sql` müssen eingespielt sein:

```bash
bash supabase/apply-migrations.sh
```

**Prüfen**

```bash
bash scripts/mcp/connector-pruefen.sh https://<domain>
```

Das Skript geht die Kette in der Reihenfolge durch, in der ein Client sie geht,
und sagt, wo es klemmt — die Fehlermeldung in claude.ai ist bei allen Ursachen
dieselbe.

---

## Quellen

- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [MCP Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)
- [Authentication for connectors](https://claude.com/docs/connectors/building/authentication)
- [Lazy authentication](https://claude.com/docs/connectors/building/lazy-authentication)
