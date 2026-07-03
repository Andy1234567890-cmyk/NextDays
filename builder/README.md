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
| `NEXT_PUBLIC_SITE_URL` | eigener Origin der App — lokal explizit auf `http://localhost:3200` setzen (Achtung: der Code-Fallback ist `localhost:3000` und passt NICHT zum Dev-Port) |
| `NEXT_PUBLIC_API_URL` | FastAPI-Backend, Ziel des `/api/v1`-Proxys (lokal `http://localhost:8000`) |

## Lokaler Start

```bash
cd builder
bun install
# .env.local anlegen (nicht committen):
#   NEXT_PUBLIC_SITE_URL=http://localhost:3200
#   NEXT_PUBLIC_API_URL=http://localhost:8000
bun run dev        # → http://localhost:3200
```

## Deploy

Eigene Coolify-App mit **eigenem `Dockerfile`** (Multi-Stage: Build mit bun,
Runtime als Next.js-Standalone unter Node, `HEALTHCHECK` auf `/healthz`;
Build-Context ist `builder/`). Cloudflare-Custom-Hostnames zeigen per
Fallback-Origin auf diese App.
