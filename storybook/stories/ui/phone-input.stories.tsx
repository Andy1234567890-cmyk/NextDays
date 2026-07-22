import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { PhoneInput } from "@/components/ui/phone-input";

// Telefon-Eingabe mit Ländervorwahl. Der Wert wird im E.164-nahen Format
// (Vorwahl + Nummer) zusammengesetzt — wichtig u. a. für das Stripe-Onboarding,
// wo ein falsch formatiertes Feld den Account-Sync abbräche.
const meta = {
  title: "UI-Bausteine/PhoneInput",
  component: PhoneInput,
  tags: ["autodocs"],
  // Pflicht-Props als Default; die Stories rendern über einen State-Wrapper und
  // überschreiben sie ohnehin.
  args: { value: "", onChange: () => {} },
} satisfies Meta<typeof PhoneInput>;

export default meta;
type Story = StoryObj<typeof meta>;

// Kontrolliertes Feld: Wert im State halten und den zusammengesetzten Wert zeigen.
function Demo({ defaultCountry = "DE" }: { defaultCountry?: string }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <PhoneInput
        id="phone"
        value={value}
        onChange={setValue}
        defaultCountry={defaultCountry}
      />
      <p className="text-xs text-muted-foreground">
        Gespeicherter Wert: <code>{value || "—"}</code>
      </p>
    </div>
  );
}

// Standard mit deutscher Vorwahl.
export const Standard: Story = {
  render: () => <Demo />,
};

// Anderes Standardland (Dänemark → +45).
export const Daenemark: Story = {
  render: () => <Demo defaultCountry="DK" />,
};
