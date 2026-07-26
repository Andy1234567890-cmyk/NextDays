# Plattform-Backoffice (`admin/`)

Betreiber-Sicht über **alle** Betriebe: Freigaben, Registrierungen, Stripe,
Support. Eigenständige App auf eigener Subdomain, strikt getrennt von
`gastgeber/` (Betriebe) und `plattform/` (Gäste).

## Sicherheitsmodell

Diese App ist die einzige, die mandantenübergreifende Daten zeigt. Der Schutz
liegt bewusst **nicht** im Frontend:

- **Berechtigung in der DB, nicht im Token.** Ein Backoffice-Zugang entsteht
  ausschließlich durch einen Eintrag in `public.platform_admins`. FastAPI prüft
  ihn bei *jedem* Request frisch (`CurrentPlatformAdmin`) — ein entzogener
  Zugang wirkt sofort, nicht erst nach Ablauf des JWT (Wurzel 7).
- **Zwei Stufen.** `platform_admin` darf schreiben (Freigaben, Sperren),
  `platform_support` nur lesen und Tickets bearbeiten. Erzwungen serverseitig
  über `require_platform_write`; die Navigation blendet nur zusätzlich aus.
- **Eigene Cookies** (`__Host-nd_admin`). Kein geteiltes Cookie mit den anderen
  Apps: ein Betriebs-Login öffnet hier nichts, ein hier erbeutetes Cookie nichts
  dort.
- **Login prüft die Rolle vor dem Setzen der Cookies.** Wer sich korrekt
  anmeldet, aber nicht in `platform_admins` steht, bekommt dieselbe neutrale
  Fehlermeldung wie bei falschem Passwort.
- **Vollständiges Protokoll.** Jede Aktion landet in `platform_audit_log` —
  auch lesende Zugriffe, denn das Einsehen fremder Mandantendaten ist der
  Vorgang, der nachvollziehbar sein muss.
- **Kein Index.** `X-Robots-Tag: noindex, nofollow` auf allen Routen.

## Entwicklung

```bash
bun install          # im Repo-Root
cd admin && bun run dev   # Port 3300
```

Ports der Apps: `web` 3000 · `plattform` 3100 · `gastgeber` 3200 ·
`admin` 3300.

Benötigte Variable: `NEXT_PUBLIC_API_URL` (Default `http://localhost:8000`).

## Ersten Zugang anlegen

Es gibt bewusst **keine** Selbstregistrierung. Der erste Backoffice-Nutzer wird
direkt in der DB eingetragen — danach kann er über das Backoffice weitere
Zugänge vergeben:

```sql
-- user_id = die auth.users-ID des bereits registrierten Nutzers
insert into public.platform_admins (user_id, role, note)
values ('<AUTH_USER_ID>', 'platform_admin', 'Erstzugang Betreiber');
```

## Deployment

Coolify-App: `nextdays-admin`, UUID `oznosa2xmefzmfeqidezodm6`,
FQDN `https://admin.65.21.144.136.sslip.io` (Übergangsdomain).

- Build-Kontext = Repo-Root, Dockerfile `admin/Dockerfile`, Port 3000
- Build-Arg `NEXT_PUBLIC_API_URL` → `https://nextdays-api.65.21.144.136.sslip.io`
  (die FastAPI, **nicht** Kong)
- `watch_paths`: `admin/** packages/**` — im Deploy-Workflow eingetragen

Ein Push auf `main`, der `admin/` oder `packages/` berührt, löst das Deployment
aus.
