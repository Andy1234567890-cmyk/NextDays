import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "UI-Bausteine/Avatar",
  component: Avatar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

// Standard: Bild lädt erfolgreich.
export const Standard: Story = {
  render: () => (
    <Avatar>
      <AvatarImage
        src="https://i.pravatar.cc/80?img=12"
        alt="Lena Sörensen"
      />
      <AvatarFallback>LS</AvatarFallback>
    </Avatar>
  ),
};

// Initialen-Fallback: ungültige Bild-URL, Initialen werden angezeigt.
export const InitialenFallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/nicht-vorhanden.jpg" alt="Mads Petersen" />
      <AvatarFallback>MP</AvatarFallback>
    </Avatar>
  ),
};

// Icon-Fallback: ohne Initialen, stattdessen Platzhalter-Symbol.
export const IconFallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/nicht-vorhanden.jpg" alt="Unbekannter Gast" />
      <AvatarFallback>
        <Icon icon="ph:user" className="h-5 w-5" />
      </AvatarFallback>
    </Avatar>
  ),
};

// Größen: klein, Standard und groß nebeneinander.
export const Groessen: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">SK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Avatar className="h-14 w-14">
        <AvatarFallback className="text-lg">AB</AvatarFallback>
      </Avatar>
    </div>
  ),
};

// Gruppe: überlappende Avatare, z.B. für ein Reinigungsteam.
export const Gruppe: Story = {
  render: () => (
    <div className="flex -space-x-3">
      {[
        { initialen: "AS", bild: "https://i.pravatar.cc/80?img=5" },
        { initialen: "TM", bild: "https://i.pravatar.cc/80?img=8" },
        { initialen: "KN", bild: "" },
      ].map((person, index) => (
        <Avatar key={index} className="border-2 border-background">
          {person.bild ? (
            <AvatarImage src={person.bild} alt={person.initialen} />
          ) : null}
          <AvatarFallback>{person.initialen}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};
