import type { Meta, StoryObj } from "@storybook/react";

import { LegalDocument } from "@/components/plattform/legal-document";
import { DEMO_LEGAL_DOC } from "@/components/plattform/legal";

/**
 * Rechtstext-Renderer des Marktplatzes (Gast-AGB usw.).
 *
 * Rendert Titel, Stand, Intro-Absätze und nummerierte Abschnitte mit optionalen
 * Aufzählungen. Inline-Links werden aus der Schreibweise `[Text](https://…)`
 * aufgelöst — bewusst kein Markdown-Paket, Rechtstexte brauchen nur Links. `lang`
 * setzt die Dokumentsprache für Screenreader/SEO (die AGB gibt es in 24 Sprachen).
 */
const meta = {
  title: "Plattform (Marktplatz)/Rechtstext",
  component: LegalDocument,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="px-6 py-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LegalDocument>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: { doc: DEMO_LEGAL_DOC, lang: "de" },
};
