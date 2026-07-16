# Claude-Code-Prompt: Storybook mit `apps/web` synchronisieren (Sync, kein Umbau)

**Kontext (wichtig):** `apps/storybook` ist ein **bewusst entkoppelter Fork** —
eine Designer-Werkstatt mit eigenen Komponenten-Kopien unter
`apps/storybook/components/`. Die Stories importieren diese Kopien (Alias `@` →
Storybook-Root), NICHT `apps/web`. Dieser Prompt ändert diese Architektur NICHT.
Er behebt nur die drei realen Drifts, die unabhängig von jeder späteren
Grundsatzentscheidung falsch sind.

**Geltungsbereich:** nur `apps/storybook/`. `apps/web/` ist Quelle und wird NUR
gelesen. Nichts committen/pushen ohne Freigabe (CLAUDE.md).

---

## Der Prompt (ab hier kopieren)

Du arbeitest im Repo `NextDays`. `apps/storybook` ist ein eigenständiges
Design-System-Package mit eigenen Komponenten-Kopien; die Stories importieren aus
`@/components/...` (= `apps/storybook/...`), nicht aus `apps/web`. Ändere diese
Fork-Architektur nicht. Erledige exakt die folgenden drei Aufgaben in dieser
Reihenfolge.

### Aufgabe 1 — Token-Resync (höchste Priorität)

`apps/storybook/styles/globals.css` ist gegenüber `apps/web/app/globals.css`
veraltet. `apps/web` ist die Quelle und eine strikte Obermenge (kein Token
existiert nur in Storybook).

- Übernimm alle CSS-Custom-Properties / Design-Tokens aus
  `apps/web/app/globals.css`, die in `apps/storybook/styles/globals.css` fehlen —
  insbesondere: alle Kanalfarben `--channel-airbnb`, `--channel-booking`,
  `--channel-vrbo`, `--channel-expedia`, `--channel-google`, `--channel-direct`,
  `--channel-portal` samt zugehöriger `--color-channel-*`, sowie `--font-display`,
  `--font-sans`, `--thumb`, `--track-h` und alle weiteren nur in Web vorhandenen.
- Token-Namen und Werte exakt aus Web übernehmen. Keine Tokens erfinden, keine
  aus Storybook entfernen.
- Struktur (`:root`, `.dark`, `@theme`-Mapping falls vorhanden) an die Web-Datei
  angleichen, sodass beide dieselben Tokens definieren.

### Aufgabe 2 — `popover` angleichen

`apps/storybook/components/ui/popover.tsx` und dessen Story dokumentieren eine
API, die `apps/web` nicht mehr hat.

- Gleiche `apps/storybook/components/ui/popover.tsx` an
  `apps/web/components/ui/popover.tsx` an: **`PopoverClose` entfernen** (Web
  exportiert nur `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`),
  Defaults nachziehen (`align="start"`, `sideOffset={8}`, `w-80`, `shadow-lg`).
  Behalte die Storybook-Konvention der anderen Kopien bei (kein `"use client"`,
  falls die übrigen Kopien es ebenfalls gestrippt haben).
- Passe `apps/storybook/stories/ui/popover.stories.tsx` an: entferne jede
  Verwendung/Import von `PopoverClose`, sodass die Story die tatsächliche Web-API
  zeigt.

### Aufgabe 3 — 7 fehlende Stories ergänzen

Diese 7 Design-System-Primitive existieren in `apps/web/components/ui/`, haben aber
keine Storybook-Kopie und keine Story:
`channel-badge`, `collapsible`, `coming-soon`, `label-hint`, `overflow-tabs`,
`phone-input`, `rich-text-editor`.

Pro Komponente:
1. Kopiere `apps/web/components/ui/<name>.tsx` nach
   `apps/storybook/components/ui/<name>.tsx`. Wende dieselbe Konvention an wie die
   bestehenden 8 Kopien (`"use client"` strippen, falls dort so gehandhabt).
   Passe nur Import-Pfade an, wenn nötig — keine Logik/Props ändern.
2. Lege `apps/storybook/stories/ui/<name>.stories.tsx` an, im Stil der bestehenden
   Stories (CSF3: `Meta` + `StoryObj`, sinnvolle `args`, ggf. mehrere Varianten).
   Orientiere dich an einer vorhandenen Story ähnlicher Komplexität
   (z. B. `badge.stories.tsx`, `input.stories.tsx`).
3. `channel-badge` braucht die Kanal-Tokens aus Aufgabe 1 — deshalb Aufgabe 1
   zuerst erledigen.

### NICHT anfassen (bewusst so)

- Fork-Architektur / Alias `@` → Storybook-Root. Stories NICHT auf `apps/web`
  umbiegen.
- Die 18 PMS-Stories (`stories/pms/`) und 7 Builder-Stories (`stories/builder/`) —
  das sind Werkstatt-Prototypen, die in `apps/web` absichtlich nicht existieren.
- Die 9 nur in Storybook vorhandenen Primitive (`accordion`, `alert`, `badge`,
  `breadcrumb`, `command`, `dialog`, `progress`, `table`, `tabs`) — Storybook ist
  hier voraus, nicht veraltet.
- `segmented.tsx` — die Storybook-Kopie ist bewusst erweitert (voraus).
- `apps/web/**` — nur lesen.

### Verifikation (nach Abschluss)

1. **Token-Parität:** jeder Design-Token aus `apps/web/app/globals.css` existiert
   in `apps/storybook/styles/globals.css`:
   ```bash
   comm -23 \
     <(grep -oE -- '--[a-zA-Z0-9-]+:' apps/web/app/globals.css | sort -u) \
     <(grep -oE -- '--[a-zA-Z0-9-]+:' apps/storybook/styles/globals.css | sort -u)
   ```
   Ausgabe muss leer sein (keine Web-Tokens fehlen in Storybook).
2. **Popover-API sauber:** `grep -rn PopoverClose apps/storybook/` → 0 Treffer.
3. **Stories vorhanden:** die 7 neuen `apps/storybook/stories/ui/*.stories.tsx`
   existieren und exportieren jeweils ein default `Meta`.
4. **Storybook baut fehlerfrei:** das Build-Script aus
   `apps/storybook/package.json` ausführen (z. B. `pnpm --filter storybook build`
   bzw. `npm run build-storybook`) — ohne Fehler. Falls ein `typecheck`-Script
   existiert, zusätzlich `tsc --noEmit` grün.

### Optional, empfohlen — Drift künftig sichtbar machen

Lege `apps/storybook/COVERAGE.md` an, die pro Story-Kategorie festhält, was
**gespiegelte Web-Komponente** ist und was **Prototyp** (noch nicht in `apps/web`).
Das macht den bewussten Vorsprung/Rückstand transparent, statt ihn als Bug
erscheinen zu lassen.
