# Arbeitsweise & Konventionen

> Die harten Konventionen sind in **[PROJECT.md](../PROJECT.md) §2** verbindlich
> festgehalten. Dieses Dokument fasst sie für die tägliche Arbeit zusammen.

## Grundprinzip

NextDays soll **einfach, fair und stabil** sein — „Schweizer Taschenmesser": viel
Funktion, aber aufgeräumt und selbsterklärend. Das gilt auch für den Code.

## Harte Konventionen (nicht verhandelbar)

### Backend (FastAPI / Python)

- **Keine Next.js API-Routes.** Alle Business-Logik liegt in FastAPI.
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
