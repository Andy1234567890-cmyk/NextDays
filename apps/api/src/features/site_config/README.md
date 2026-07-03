# Slice: site_config

Page-Builder-Backend: pro Mandant **Branding** (`tenant_site_config`:
Name, Logo, Farben, Schrift, Texte, Buchungsmodus), **Custom-Domains**
(`tenant_custom_domains`, TLS über Cloudflare for SaaS Custom Hostnames,
`cloudflare_client.py`), **Seiten und Blöcke** (`site_pages`/`site_blocks`,
Migrationen 0086/0087) sowie **Start-Templates** (`templates.py`: bergchalet,
kueste, stadt).

- `manage_router`: `/api/v1/site-config` — JWT + Capability
  `MANAGE_SITE_CONFIG`; CRUD für Branding, Domains (anlegen/syncen/löschen),
  Seiten (inkl. `publish`/`unpublish`/`home`), Blöcke (inkl. `reorder`),
  `templates/apply`, `pages/{id}/draft-token`.
- `public_router`: `/api/v1/site` — JWT-los (service-role + explizites
  Tenant-Scope): `by-domain` (Host→Tenant-Resolver für `builder/`), `page`
  (nur veröffentlichte Blöcke), `page/draft` (HMAC-Token, signiert mit
  `site_draft_secret`, TTL 1 h).
- Block-`content` wird pro Typ (10 Block-Typen) strikt gegen Pydantic-Schemas
  validiert; generische `settings` (Hintergrund, Padding, …) separat.
- RLS auf allen vier Tabellen (`current_tenant_id()`), Realtime-Publication
  aktiv; das Dashboard abonniert nur `site_pages` (Seitenliste).
- Ohne `CLOUDFLARE_*`-Konfiguration antworten die Domain-Endpunkte mit 503
  (kein stiller Fallback).

Frontend: Editor `apps/web` (`/website`, craft.js; Server-Actions in
`lib/site-pages.ts` + `lib/site-config.ts`) · öffentlicher Renderer `builder/`.
Siehe [ADR-0013](../../../../../docs/decisions/0013-page-builder-renderer-editor-trennung.md).
