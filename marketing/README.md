# marketing/ — Öffentliche Marketing-Website

Die öffentliche Vermarktungs-Website von NextDays (Landing, Pricing, About, Blog).

> **Bewusst entkoppelt:** Dieser Ordner liegt **außerhalb von `apps/`** und ist ein
> eigenständiges Projekt mit eigenem Deployment. Begründung:
> [ADR-0002](../docs/decisions/0002-marketing-website-entkopplung.md).

## Abgrenzung

| | Marketing-Website (`marketing/`) | Produkt (`apps/web`) |
|---|---|---|
| Zweck | Vermarktung, SEO, Lead-Gewinnung | eingeloggtes PMS-Dashboard + Portal |
| Domain (geplant) | `nextdays.com` | `app.nextdays.com` |
| Backend-Kopplung | **keine** (statisch/SSG) | FastAPI + Supabase |
| Auth | keine | Supabase Auth |
| Deployment | eigenes Vercel-Projekt | eigenes Vercel-Projekt |

## Stack (geplant)

- **Next.js** (App Router, TypeScript) — konsistent mit dem übrigen Stack, stark
  bei SSR/SEO.
- Tailwind v4 + Iconify; Design-Tokens optional aus `packages/shared`
  (nur Build-Zeit, keine Laufzeit-Abhängigkeit).

## Status

**Struktur vorbereitet** — Implementierung folgt. Noch kein Code/Setup.

## Geplante Struktur

```
marketing/
├── app/
│   ├── page.tsx          # Landing
│   ├── pricing/          # Preis-Seite (ein fairer Preis)
│   ├── about/
│   └── blog/
├── components/
├── public/
└── package.json
```
