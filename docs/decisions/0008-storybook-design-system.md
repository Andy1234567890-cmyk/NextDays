# ADR-0008: Storybook als Komponenten-Doku & Design-System-Brücke

- Status: **akzeptiert**
- Datum: 2026-06-16

## Kontext

Ein UX/UI-Designer kommt ins Projekt und muss verstehen, welche UI-Bausteine
existieren, wie sie aussehen (inkl. Zustände, Light/Dark) und wo er ansetzt. Die
UI ist komponentenschwer (Drag&Drop-Dashboard, Multi-Kalender, Rich-Text-Editor,
White-Label, einbettbares Buchungs-Widget). Reine Figma-Mockups reichen nicht —
es braucht eine lebende, code-nahe Komponenten-Doku.

## Entscheidung

**Storybook** wird das Komponenten-Doku- und Design-System-Werkzeug für `apps/web`.

- Builder: **`@storybook/react-vite`** (stabil mit Next.js 15 + React 19; der
  Webpack/`@storybook/nextjs`-Builder scheiterte mit Next 15).
- **Light/Dark-Umschalter** in der Toolbar via `@storybook/addon-themes`
  (`.dark`-Klasse, identisch zur App).
- Stories laden die **echte `globals.css`** → Komponenten zeigen die echten
  Design-Tokens, nicht Kopien.
- **Design-Token-Übersicht** als eigene Story (`Design/Tokens`) — der Designer
  sieht die gesamte Marken-Palette auf einen Blick.
- Statisch baubar (`build-storybook`) → als URL deploybar, der Designer braucht
  kein lokales Dev-Setup.

## Tokens & Marke

- Einzige Quelle der Wahrheit: `apps/web/styles/globals.css` (`:root` + `.dark`).
- Startwerte aus dem offiziellen **NextDays-Logo** abgeleitet (Schwarz `#0a0a0a`
  als Primär, Logo-Rot `#b82028` als Akzent). **Vorläufig** — vom Designer
  jederzeit überschreibbar; Komponenten nutzen nur semantische Token-Namen
  (`bg-primary`, `text-accent`), keine festen Hex-Werte. Token-Änderung wirkt
  sofort systemweit ohne Komponenten-Umbau.

## Konsequenz

- `apps/web` enthält shadcn-Stil-Komponenten (CVA + Radix-Slot + `cn`), Icons via
  **Iconify** (kein lucide-react, PROJECT.md §2).
- Jede neue UI-Komponente bekommt eine `.stories.tsx`.
- Build/Dev verifiziert: `storybook build` erfolgreich, Dev-Server liefert HTTP 200.
- **Deployed auf Vercel** als eigenes Projekt `nextdays-storybook` (Monorepo,
  Root `apps/web`, `vercel.json`: Build `bun run build-storybook`, Output
  `storybook-static`). Öffentliche URL (kein Login):
  **https://nextdays-storybook.vercel.app** — der Designer braucht kein lokales Setup.
