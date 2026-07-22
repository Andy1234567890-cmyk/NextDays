import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { DatePicker } from "@/components/ui/date-picker";
import { MultiSelect } from "@/components/ui/multi-select";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Posteingang-Filter — fachliche PMS-Komponente (§2.3 Kommunikation).
 *
 * Filtert Konversationen nach Kanal (myNextDays + OTAs), Unterkunft
 * (durchsuchbares Multiselect — skaliert für 100+ Objekte), Reservierungsstatus,
 * gelesen/ungelesen und Anreise-Zeitraum (gebrandeter DatePicker). Leere
 * Mehrfachauswahl = alle. Im Posteingang im Popover (Portal), hier als Panel.
 */
const meta = {
  title: "PMS-Komponenten/Posteingang-Filter",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj;

const CHANNELS = ["myNextDays", "Booking.com", "Airbnb", "Vrbo", "Expedia"].map(
  (c) => ({ value: c, label: c }),
);
const PROPERTIES = [
  "Haus Max", "Doppelzimmer Nord", "Strandhaus See", "Lærkevej 10",
  "Rævlingevej 4", "Stjerneskud",
].map((t, i) => ({ value: `p-${i}`, label: t }));

export const FilterPanel: Story = {
  render: () => {
    const [channels, setChannels] = useState<string[]>([]);
    const [props, setProps] = useState<string[]>([]);
    const [status, setStatus] = useState("");
    const [read, setRead] = useState("all");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    return (
      <div className="flex w-72 flex-col gap-3 rounded-2xl border border-border bg-card p-3">
        <span className="text-sm font-semibold">Konversationen filtern</span>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-(--color-accent)" />
          Nicht zugewiesen
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Kanal</span>
          <MultiSelect options={CHANNELS} selected={channels} onChange={setChannels}
            placeholder="Alle Kanäle" searchPlaceholder="Kanal suchen …" allLabel="Alle Kanäle" />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Unterkunft</span>
          <MultiSelect options={PROPERTIES} selected={props} onChange={setProps}
            placeholder="Alle Unterkünfte" searchPlaceholder="Unterkunft suchen …" allLabel="Alle Unterkünfte" />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Reservierungsstatus</span>
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Alle</option>
            <option value="new">Neu</option>
            <option value="modified">Geändert</option>
            <option value="cancelled">Storniert</option>
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Gelesen</span>
          <NativeSelect value={read} onChange={(e) => setRead(e.target.value)}>
            <option value="all">Alle</option>
            <option value="unread">Ungelesen</option>
            <option value="read">Gelesen</option>
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Anreise (von–bis)</span>
          <div className="grid grid-cols-2 gap-2">
            <DatePicker value={from} onChange={setFrom} placeholder="Von" />
            <DatePicker value={to} onChange={setTo} placeholder="Bis" />
          </div>
        </div>
      </div>
    );
  },
};
