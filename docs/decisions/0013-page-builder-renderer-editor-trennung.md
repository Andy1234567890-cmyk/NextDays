# ADR-0013: Page-Builder — getrennter Renderer (`builder/`) + craft.js-Editor im Dashboard

- Status: **akzeptiert**
- Datum: 2026-07-02
- Bezug: Spec/Bau-Vorlage [docs/FRAMER-FEATURES.md](../FRAMER-FEATURES.md) ·
  Slice [`site_config`](../../apps/api/src/features/site_config/README.md) ·
  Migrationen 0086/0087

## Kontext

Agenturen/Vermieter brauchen eine **eigene, white-label Website unter eigener
Custom-Domain** (Buchungs-Site mit Branding), die sie selbst visuell bearbeiten
können. Die verbindliche Referenz für den Editor ist der Framer-Editor
(Funktionsumfang in `docs/FRAMER-FEATURES.md` mit ✅/🟡/❌-Status erhoben).
Anforderungen im Konflikt:

- Der Editor braucht ein schweres Client-Bundle (craft.js, Canvas, Inspektor,
  Fonts, Motion) und Auth/Tenant-Kontext — gehört ins Dashboard.
- Die öffentlichen Agentur-Seiten müssen schnell, JWT-los und pro Domain
  gebrandet ausgeliefert werden — dürfen weder Dashboard-Auth noch
  Editor-Bundle mitschleppen.
- Custom-Domains beliebiger Agenturen brauchen automatisiertes TLS.

## Entscheidung

Drei physisch getrennte Ebenen, bewusst schmal gekoppelt:

1. **Editor in `apps/web`** — Framer-artiger visueller Canvas-Editor auf
   **craft.js** (`@craftjs/core`/`layers`/`utils`), Vollbild-Overlay über dem
   Dashboard (Route `/website/[pageId]`). `serialize.ts` mappt zwischen
   craft.js-Baum und der flachen Blockliste; Speichern diff't über die
   einzelnen CRUD-Endpunkte (`syncBlocks` in `lib/site-pages.ts`).
2. **Backend-Slice `site_config` (FastAPI)** — `manage_router`
   (`/api/v1/site-config`, JWT + Capability `MANAGE_SITE_CONFIG`) für
   Branding/Domains/Seiten/Blöcke/Templates und `public_router`
   (`/api/v1/site`, JWT-los, service-role + explizites Tenant-Scope) als
   Resolver für den Renderer. Tabellen: `tenant_site_config`,
   `tenant_custom_domains` (0086), `site_pages`, `site_blocks` (0087) — alle
   mit RLS (`current_tenant_id()`) und Realtime-Publication.
3. **Renderer `builder/`** — eigenständige Next.js-App (Port 3200, eigenes
   Dockerfile für Coolify). `middleware.ts` löst Host→Tenant über
   `/api/v1/site/by-domain` auf und reicht `x-tenant-id`/`x-site-branding` an
   die Server-Components weiter; gerendert werden **nur veröffentlichte**
   Blöcke (`block-renderer.tsx`).

**Kopplung über genau 10 Block-Typen:** `hero`, `rich_text`, `image`,
`gallery`, `button`, `spacer`, `contact`, `search`, `properties_grid`,
`featured_properties` — als DB-CHECK, Pydantic-content-Schemas und
Renderer-Switch identisch. Editor-only-Konstrukte (Frame/Stack/Grid/Masonry-
Container, Page-Variables, Code-Overrides) haben **bewusst kein DB-Ziel** und
überleben das Speichern nicht.

**Custom-Domains über Cloudflare for SaaS:** `site_config/cloudflare_client.py`
legt pro Domain einen Custom Hostname an (TLS automatisch), Status/SSL-Status
werden in `tenant_custom_domains` gespiegelt; ohne `CLOUDFLARE_*`-Konfiguration
antworten die Domain-Endpunkte mit 503 (kein stiller Fallback).

**Draft-Vorschau:** unveröffentlichte Seiten sind nur mit HMAC-Draft-Token
erreichbar (`/api/v1/site/page/draft`, signiert mit `SITE_DRAFT_SECRET`,
TTL 1 h) über `builder/app/render/[pageId]`.

## Verworfene Optionen

- **Editor + Renderer in einer App:** öffentliche Seiten würden Auth-Middleware
  und craft.js-Bundle erben; Host-Routing des Dashboards und der Agentur-Domains
  würden kollidieren.
- **craft.js-JSON direkt persistieren und im Renderer abspielen:** koppelt die
  öffentliche Site an Editor-Interna (Node-IDs, Resolver-Namen), macht
  Backend-Validierung des Inhalts praktisch unmöglich und den Renderer
  abhängig von craft.js.

## Konsequenzen

- Renderer bleibt klein, schnell und JWT-los; der Editor kann Framer-Features
  beliebig ausbauen, ohne die öffentlichen Sites zu riskieren.
- Preis der Trennung: die 10 Block-Typen existieren **zweimal** (Editor-Nodes
  in `apps/web/components/website/editor/nodes/` und
  `builder/components/blocks/`) und müssen synchron gehalten werden.
- Editor-Zustand ohne DB-Ziel (Container-Hierarchie, Variables, Code-Overrides)
  geht beim Speichern/Reload verloren — bekannte, dokumentierte Lücke, kein Bug.
- Draft-Route + postMessage-Brücke (`canvas-bridge.tsx`) sind gebaut, aber im
  aktuellen Editor noch nicht verdrahtet (Editor rendert die Nodes direkt).
- Neue Secrets/Envs: `SITE_DRAFT_SECRET`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_FALLBACK_ORIGIN` (API) sowie
  `GOOGLE_FONTS_API_KEY` (apps/web, Schrift-Picker) — siehe
  [deploy/ENVIRONMENT.md](../../deploy/ENVIRONMENT.md).
