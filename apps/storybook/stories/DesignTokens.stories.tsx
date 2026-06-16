import type { Meta, StoryObj } from "@storybook/react";

/**
 * Design-Token-Übersicht für den UX/UI-Designer.
 *
 * Alle Farben kommen aus styles/globals.css (einzige Quelle der Wahrheit).
 * Die Werte sind VORLÄUFIG (aus dem NextDays-Logo abgeleitet) und können hier
 * NICHT bearbeitet werden — Änderungen erfolgen in globals.css und wirken dann
 * sofort in allen Komponenten. Light/Dark über den Toolbar-Umschalter testen.
 */
const TOKENS: { name: string; varName: string; note?: string }[] = [
  { name: "background", varName: "--background" },
  { name: "foreground", varName: "--foreground" },
  { name: "card", varName: "--card" },
  { name: "primary", varName: "--primary", note: "Logo-Schwarz (NextDays)" },
  { name: "primary-foreground", varName: "--primary-foreground" },
  { name: "secondary", varName: "--secondary" },
  { name: "muted", varName: "--muted" },
  { name: "muted-foreground", varName: "--muted-foreground" },
  { name: "accent", varName: "--accent", note: "Logo-Rot (Smil)" },
  { name: "accent-foreground", varName: "--accent-foreground" },
  { name: "destructive", varName: "--destructive" },
  { name: "border", varName: "--border" },
  { name: "ring", varName: "--ring" },
];

function Swatch({ name, varName, note }: { name: string; varName: string; note?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div
        style={{
          width: "3rem",
          height: "3rem",
          borderRadius: "var(--radius)",
          background: `var(${varName})`,
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}
      />
      <div style={{ color: "var(--foreground)", fontFamily: "system-ui" }}>
        <div style={{ fontWeight: 600 }}>{name}</div>
        <code style={{ color: "var(--muted-foreground)", fontSize: "0.8rem" }}>
          {varName}
        </code>
        {note ? (
          <div style={{ color: "var(--muted-foreground)", fontSize: "0.8rem" }}>
            {note}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TokenGrid() {
  return (
    <div
      style={{
        background: "var(--background)",
        padding: "1.5rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))",
        gap: "1rem",
      }}
    >
      {TOKENS.map((t) => (
        <Swatch key={t.varName} {...t} />
      ))}
    </div>
  );
}

const meta: Meta<typeof TokenGrid> = {
  title: "Design/Tokens",
  component: TokenGrid,
};
export default meta;

type Story = StoryObj<typeof TokenGrid>;
export const Farbpalette: Story = {};
