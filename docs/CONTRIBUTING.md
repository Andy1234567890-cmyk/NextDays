# Arbeitsweise & Konventionen

> Die harten Konventionen sind in **[PROJECT.md](../PROJECT.md) §2** verbindlich
> festgehalten. Dieses Dokument fasst sie für die tägliche Arbeit zusammen.

## Grundprinzip

NextDays soll **einfach, fair und stabil** sein — „Schweizer Taschenmesser": viel
Funktion, aber aufgeräumt und selbsterklärend. Das gilt auch für den Code.

## Harte Konventionen (nicht verhandelbar)

### Backend (FastAPI / Python)

- **Business-Logik gehört in FastAPI, nicht in Next.js API-Routes.** Zulässig
  sind ausschließlich **schmale BFF-/Proxy-Routen ohne eigene Geschäftslogik**
  — z. B. `apps/web/app/api/google-fonts` (hält den `GOOGLE_FONTS_API_KEY`
  server-seitig) und `builder/app/api/v1/[...path]` (Proxy zum FastAPI-Backend,
  damit die Site same-origin bleibt). Alles mit Datenmodell, Validierung oder
  Berechtigungen liegt in `apps/api`.
- **Vertical Slice Architecture** — pro Feature ein geschlossener Slice
  (`router.py` + `service.py` + `schemas.py` + `tests/`).
- **Explizite Pydantic-Typisierung.** Kein `Any`-Schludern. `SecretStr` für
  Secrets, **niemals** als `str`.
- **Kein stilles Exception-Swallowing.** Keine breiten `except: pass`. Fehler
  werden geloggt und sauber behandelt.
- **Keine optionalen Imports mit None-Fallback** als Workaround.
- **Firebase/DB niemals direkt aus Komponenten** — immer über Service-/API-Layer.

### Frontend (Next.js / TypeScript)

- **shadcn/ui** in der Tailwind-v4-Variante (CSS-Variablen, **kein**
  `tailwind.config.ts`).
- Design-Tokens als CSS-Variablen im `@theme`-Block in `globals.css`.
- **Iconify only** (`@iconify/react`) — kein `lucide-react`, keine hand-codierten SVGs.
- **rem** für alle Größen (px nur für Borders ≤2px, SVG-Attribute, Shadow-Offsets ≤2px).
- Light + Dark Mode über `next-themes` (`.dark` auf `<html>`).

## Die fünf Frontends — wo entsteht was

| App | Zweck |
|---|---|
| `apps/web` | Vermieter-**Dashboard** (auth-geschützt): PMS, Kalender, Buchungen — inkl. visuellem **Website-Editor** (`/website`, craft.js) |
| `apps/storybook` | **Design-Werkstatt**: UI-Komponenten entstehen hier zuerst (Stories, Design-Tokens), dann Übernahme nach `apps/web` |
| `builder/` | **White-Label-Renderer**: liefert pro Custom-Domain die veröffentlichte Agentur-Website aus (eigene Next.js-App, Port 3200, eigenes Dockerfile) |
| `plattform/` | **globaler Marktplatz** (eigener Buchungskanal wie Booking/Airbnb — nicht „Direkt“) |
| `marketing/` | öffentliche **Marketing-Website** — bewusst entkoppelt, keine PMS/Auth-Kopplung (ADR-0002) |

Neue Dashboard-Features → `apps/web`; neue öffentliche Site-Blöcke → Editor-Node
in `apps/web/components/website/editor/` **und** Renderer in
`builder/components/blocks/` (beide müssen synchron bleiben, siehe
[ADR-0013](decisions/0013-page-builder-renderer-editor-trennung.md)).

## Git-Flow

> **Hinweis:** PROJECT.md schreibt für Teamarbeit *Feature-Branch → PR → Merge*
> vor. Im aktuellen Solo-Betrieb wird direkt auf `main` gearbeitet — bei
> Teamzuwachs auf den Branch/PR-Flow zurückwechseln.

- Pre-Commit: **Lint + Tests müssen grün sein** (`ruff check src` + `pytest`).
- **Commit-Messages spiegeln den Diff exakt** — keine aspirationale Sprache,
  keine Versprechen über noch nicht Umgesetztes.

## Tests

- Jeder Slice hat einen Smoke-Test (mind. Health-Endpoint).
- Logik wird mit Unit-Tests abgedeckt (gemockte externe Dienste).
- Integration-Tests tragen den Marker `@pytest.mark.integration` und werden
  übersprungen, wenn kein Supabase-Stack erreichbar ist.

```bash
cd apps/api
ruff check src
pytest
```

## Architektur-Entscheidungen (ADRs)

Größere oder schwer reversible Entscheidungen werden als **ADR** in
[docs/decisions/](decisions/) dokumentiert (Kontext, Optionen, Entscheidung,
Konsequenz). Externe Dienste zusätzlich mit Rechtsgrundlage (DSGVO/AVV, DPF/SCC).

Vorlage: siehe [ADR-0001](decisions/0001-channel-manager-architektur.md).

## Dokumentation aktuell halten

- **[NOTES.md](../NOTES.md)** nach jeder Arbeitssession aktualisieren
  (aktueller Stand + nächste Schritte).
- Neue Endpoints/Slices in **[docs/API.md](API.md)** ergänzen.
- Architektur-relevante Änderungen in **[docs/ARCHITECTURE.md](ARCHITECTURE.md)**.
