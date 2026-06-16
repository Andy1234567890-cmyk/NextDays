import type { Meta, StoryObj } from "@storybook/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const meta: Meta<typeof Accordion> = {
  title: "UI-Bausteine/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
// render-only Stories: Accordion ist eine Discriminated Union (type single|multiple),
// daher Story-Typ nicht an `typeof meta` koppeln (sonst werden args erzwungen).
type Story = StoryObj<typeof Accordion>;

// Standard: einzeln aufklappbar und schließbar.
export const Standard: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-96">
      <AccordionItem value="check-in">
        <AccordionTrigger>Wann ist der Check-in?</AccordionTrigger>
        <AccordionContent>
          Der Check-in ist ab 15:00 Uhr möglich. Den Zugangscode erhalten Sie
          am Anreisetag automatisch per E-Mail.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="haustiere">
        <AccordionTrigger>Sind Haustiere erlaubt?</AccordionTrigger>
        <AccordionContent>
          Hunde sind nach Absprache willkommen. Für die Endreinigung fällt ein
          Zuschlag von 50 € an.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="stornierung">
        <AccordionTrigger>Wie kann ich stornieren?</AccordionTrigger>
        <AccordionContent>
          Eine kostenfreie Stornierung ist bis 14 Tage vor Anreise möglich.
          Danach wird die Anzahlung einbehalten.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

// Mit standardmäßig geöffnetem Abschnitt.
export const MitVorauswahl: Story = {
  render: () => (
    <Accordion
      type="single"
      collapsible
      defaultValue="ausstattung"
      className="w-96"
    >
      <AccordionItem value="ausstattung">
        <AccordionTrigger>Welche Ausstattung gibt es?</AccordionTrigger>
        <AccordionContent>
          WLAN, Geschirrspüler, Waschmaschine und ein voll ausgestatteter
          Außenbereich mit Grill stehen zur Verfügung.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="parken">
        <AccordionTrigger>Gibt es einen Parkplatz?</AccordionTrigger>
        <AccordionContent>
          Ein kostenloser Stellplatz direkt am Ferienhaus ist im Preis
          enthalten.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

// Einzelner Eintrag.
export const Einzeln: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-96">
      <AccordionItem value="kaution">
        <AccordionTrigger>Wird eine Kaution fällig?</AccordionTrigger>
        <AccordionContent>
          Es wird eine Kaution von 250 € erhoben, die nach der Abreise
          erstattet wird.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
