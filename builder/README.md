# builder — White-Label-Site-Renderer

Eigenständige Next.js-App, die **pro Custom-Domain die veröffentlichte
Agentur-Website** eines Mandanten ausliefert (white-label Buchungs-Site, eigenes
Branding). Getrennt vom globalen Marktplatz (`plattform/`) und vom Dashboard
(`apps/web`) — Architektur-Entscheidung:
[ADR-0013](../docs/decisions/0013-page-builder-renderer-editor-trennung.md).

Die Inhalte entstehen im visuellen Editor des Dashboards
(`apps/web`, Route `/website`); diese App rendert ausschließlich die
**veröffentlichten** Blöcke (10 Block-Typen, `components/blocks/block-renderer.tsx`).

## Host→Tenant-Auflösung

`middleware.ts` löst aus dem Host-Header den Mandanten auf
(Backend-Resolver `GET /api/v1/site/by-domain?host=…`) und reicht
`x-tenant-id` / `x-site-branding` als Request-Header an die Server-Components
weiter. Jede Domain gehört genau einer Agentur; ein unbekannter Host setzt
`x-site-unknown=1` und die Seite zeigt einen neutralen Hinweis (kein Crash,
kein fremder Inhalt). Custom-Domains + TLS laufen über **Cloudflare for SaaS**
(Custom Hostnames, verwaltet vom API-Slice `site_config`).

## Routen

| Route | Zweck |
|---|---|
| `/` | Homepage der Site (Seite mit `is_home`, nur veröffentlicht) |
| `/[slug]` | weitere veröffentlichte Seiten |
| `/render/[pageId]?token=…` | **Draft-Vorschau** auch unveröffentlichter Seiten — nur mit gültigem HMAC-Draft-Token (`/api/v1/site/page/draft`, TTL 1 h) |
| `/inserat/[id]` | Inserat-/Objektdetail mit Buchungs-Widget |
| `/checkout/[id]` · `/checkout/abgeschlossen` | Buchungs-Checkout (Stripe) |
| `/api/v1/[...path]` | schmaler Proxy zum FastAPI-Backend (`NEXT_PUBLIC_API_URL`) — keine Business-Logik |
| `/healthz` | Healthcheck (Docker/Coolify) |

## Env-Variablen

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_API_URL` | FastAPI-Backend, Ziel des `/api/v1`-Proxys (lokal `http://localhost:8000`) |
| `DASHBOARD_ORIGIN` | Origin des Dashboards, das `/render/*` per iframe einbetten darf (lokal `http://localhost:3000`). **Muss beim BUILD gesetzt sein**, obwohl ohne `NEXT_PUBLIC_`-Präfix: `next.config.ts` liest den Wert in `headers()`, und `next build` friert die Kopfzeilen in `.next/routes-manifest.json` ein — ein Laufzeit-Eintrag kommt nie an. Fehlt er, steht `frame-ancestors 'none'` im Image, und die Entwurfs-Vorschau bleibt leer, **ohne Meldung** |

`NEXT_PUBLIC_SITE_URL` stand hier früher — der Wert wird im Code **nirgends
gelesen**. Eintrag entfernt, statt eine Variable zu dokumentieren, die niemand
braucht.

## Lokaler Start

```bash
cd builder
bun install
# .env.local anlegen (nicht committen):
#   NEXT_PUBLIC_API_URL=http://localhost:8000
#   DASHBOARD_ORIGIN=http://localhost:3000
bun run dev        # → http://localhost:3200
```

## Deploy

Eigene Coolify-App mit **eigenem `Dockerfile`** (Multi-Stage: Build mit bun,
Runtime als Next.js-Standalone unter Node, `HEALTHCHECK` auf `/healthz`;
Build-Context ist `builder/`). Cloudflare-Custom-Hostnames zeigen per
Fallback-Origin auf diese App.
