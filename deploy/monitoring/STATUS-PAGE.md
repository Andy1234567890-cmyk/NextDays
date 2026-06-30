# Monitoring & öffentliche Status-Seite (Uptime-Kuma)

Schicht **1 von 3** der Betriebsbeobachtung:

| Schicht | Werkzeug | Zweck | Status |
|---|---|---|---|
| **1 — Verfügbarkeit** | **Uptime-Kuma** | „Ist der Dienst erreichbar?" + öffentliche Status-Seite | **aktiv (dieses Dokument)** |
| 2 — Metriken | Beszel | CPU/RAM/Disk/Netz des Servers | geplant |
| 3 — Fehler | Sentry | Anwendungsfehler/Exceptions im Code | geplant |

Uptime-Kuma läuft als Coolify-Container hinter Traefik (HTTPS), persistentes
Volume `/mnt/HC_Volume_106086998/nextdays/uptime-kuma`. **Admin-Login ist aktiv**
(`disableAuth=false`); nur die Status-Seite ist öffentlich.

- Admin/Dashboard (geschützt): `https://uptimekuma.65.21.144.136.sslip.io`
- **Öffentliche Status-Seite:** `https://uptimekuma.65.21.144.136.sslip.io/status/status`
  (Domain-Cutover auf `status.<domain>` = Infra-Runbook Punkt 4, geparkt.)

---

## Monitore

Alle HTTP-Monitore: **Intervall 60 s**, **3 Retries** (Grace), Benachrichtigung an
den ntfy-Kanal (siehe [Backup-Monitoring](../backup/README.md#monitoring)).

### Öffentlich gelistet (kundenrelevant, neutrale Namen)
| Komponente (öffentlich) | geprüfter Endpunkt | Akzeptiert |
|---|---|---|
| **Buchungsplattform** | `plattform …/healthz` | 200–299 |
| **Dashboard (PMS)** | `web …/healthz` | 200–299 |
| **API** | `api …/health` | 200–299 |
| **Server-Infrastruktur** | Gateway-Reachability (`/auth/v1/health`) | 200–299, 401 |

> „Server-Infrastruktur" ist vorerst ein **abgeleiteter Reachability-Proxy** auf das
> Gateway. Sobald **Schicht 2 (Beszel)** läuft, wird diese Komponente von echten
> Server-Metriken gespeist — **ohne** rohe Werte öffentlich zu zeigen.

### Intern (NICHT öffentlich gelistet)
| Monitor | Zweck |
|---|---|
| Supabase-Gateway | Kong/Gateway-Health (technischer Name, nur intern) |
| Marketing-Site | Werbeseite — kein Kundendienst |
| Storybook | internes Dev-Werkzeug |
| NextDays Backup (Dead-man) | nächtlicher Backup-Ping (siehe Backup-README) |

**Warum 401 bei „up" zählt:** Das Gateway antwortet auf den Health-Pfad ohne
API-Key mit `401` — das ist ein *erreichbares* Signal („Gateway lebt"). Ein totes
Gateway liefert 502/504/Timeout. Darum gilt für die Gateway-Monitore `200–299` **oder**
`401` als „up".

---

## Datenschutz der öffentlichen Seite (verifiziert)

Die öffentliche Seite gibt **nichts Sensibles** preis:
- Nur **Anzeigenamen** der Komponenten, keine URLs/Hosts (`sendUrl:0`).
- Heartbeats nach außen tragen **keine rohen Fehlertexte** (`msg` ist leer) —
  kein Statuscode, keine URL, kein Stacktrace.
- Keine internen sslip-Hashes, keine IPs, keine Technologienamen in den
  öffentlichen Komponenten.
- Interne Monitore (Gateway/Backup/Marketing/Storybook) erscheinen **nicht** im
  öffentlichen Heartbeat-/Status-Endpunkt.

---

## Incident-/Wartungs-Workflow (so postet Andy eine Meldung)

**Ein Incident posten (öffentlich sichtbar):**
1. Admin-Login auf `https://uptimekuma.65.21.144.136.sslip.io`.
2. Status-Seite **MyNextDays Status** öffnen → Button **„Create Incident"** oben.
3. Titel + Text schreiben (kundenverständlich, **keine** internen Details), Stil
   wählen (Info/Warning/Danger) → posten. Erscheint sofort oben auf der
   öffentlichen Seite.

**Auf „Resolved" setzen:**
- Auf der Status-Seite das Incident **„Unpin"/Resolve** — es verschwindet von der
  öffentlichen Seite.

**Geplante Wartung ankündigen:**
- Im Admin **Maintenance** anlegen (betroffene Monitore + Zeitfenster) → erscheint
  als Wartungshinweis und unterdrückt im Fenster den Down-Alarm.

> Beides ist in Uptime-Kuma eingebaut; programmatisch geht es über
> `post_incident` / `add_status_page_maintenance` (Socket.io-API).

---

## Verifizierte Tests (Definition of Done)

- ✅ Öffentliche Seite erreichbar (HTTP 200), zeigt Kunden-Services **grün** mit Uptime-%.
- ✅ **Degraded-Test:** API-Monitor kurz auf tote URL gezeigt → Komponente „API"
  öffentlich **Down**, **ohne** Fehlerdetails; danach exakt zurückgesetzt → wieder grün.
- ✅ **Incident-Test:** Test-Incident gepostet → öffentlich sichtbar → resolved → weg.
- ✅ Interne Monitore (Gateway/Backup/Marketing/Storybook) **nicht** öffentlich gelistet.
- ✅ Admin-Login aktiv; ohne Auth liefert `/api/monitor` nur die leere SPA-Shell.

---

## Verwaltung (venv mit uptime-kuma-api)

Programmatische Pflege läuft über ein venv auf dem Server
(`/root/.kuma-venv`), das die Socket.io-API anspricht. Kuma hört im
`coolify`-Docker-Netz (Container-IP `:3001`), **nicht** auf einem Host-Port —
Skripte verbinden sich auf die Container-IP, nicht `localhost`.

> **Stolperstein (verifiziert):** `add_monitor`/`edit_monitor` ohne
> `notificationIDList` **löschen** die Benachrichtigungs-Bindung des Monitors.
> Bei jeder Änderung `notificationIDList` mitgeben.
