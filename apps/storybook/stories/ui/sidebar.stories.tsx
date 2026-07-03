import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const meta = {
  title: "UI-Bausteine/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    // Vollflächig rendern; in der Doku als iframe mit fester Höhe,
    // weil die Sidebar fix positioniert ist und sonst die Doku-Seite überlagert.
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  decorators: [
    // Feste Höhe für den Rahmen; die Sidebar füllt die iframe-Höhe (h-svh).
    (Story) => (
      <div className="h-svh w-full overflow-hidden">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Kompakte myNextDays-Navigation: Gruppen „Verwaltung“ und „Betrieb“,
// aktiver Eintrag, Zähler-Badges, Fußzeile mit Konto.
function PmsSidebarDemo({
  side = "left",
  collapsible = "offcanvas",
  defaultOpen = true,
}: {
  side?: "left" | "right";
  collapsible?: "offcanvas" | "icon" | "none";
  defaultOpen?: boolean;
}) {
  const sidebarElement = (
    <Sidebar side={side} collapsible={collapsible}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Icon icon="ph:house-line" className="size-5 shrink-0 text-accent" />
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            myNextDays
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Verwaltung</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive
                  tooltip="Dashboard"
                  onClick={() => console.log("Navigation: Dashboard")}
                >
                  <Icon icon="ph:squares-four" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Multi-Kalender"
                  onClick={() => console.log("Navigation: Multi-Kalender")}
                >
                  <Icon icon="ph:calendar-blank" />
                  <span>Multi-Kalender</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Reservierungen"
                  onClick={() => console.log("Navigation: Reservierungen")}
                >
                  <Icon icon="ph:book-open" />
                  <span>Reservierungen</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>12</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Objekte"
                  onClick={() => console.log("Navigation: Objekte")}
                >
                  <Icon icon="ph:buildings" />
                  <span>Objekte</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Betrieb</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Aufgaben"
                  onClick={() => console.log("Navigation: Aufgaben")}
                >
                  <Icon icon="ph:check-square" />
                  <span>Aufgaben</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>3</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Reinigung"
                  onClick={() => console.log("Navigation: Reinigung")}
                >
                  <Icon icon="ph:broom" />
                  <span>Reinigung</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Zahlungen"
                  onClick={() => console.log("Navigation: Zahlungen")}
                >
                  <Icon icon="ph:credit-card" />
                  <span>Zahlungen</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Konto"
              onClick={() => console.log("Navigation: Konto")}
            >
              <Icon icon="ph:user-circle" />
              <span>Lena Sørensen</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );

  const insetElement = (
    <SidebarInset>
      <header className="flex h-12 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger />
        <span className="text-sm font-medium">Dashboard</span>
      </header>
      <div className="p-4 text-sm text-muted-foreground">
        Inhaltsbereich — die Sidebar lässt sich über den Knopf oben oder mit
        Strg/⌘ + B umschalten.
      </div>
    </SidebarInset>
  );

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {side === "right" ? (
        <>
          {insetElement}
          {sidebarElement}
        </>
      ) : (
        <>
          {sidebarElement}
          {insetElement}
        </>
      )}
    </SidebarProvider>
  );
}

/** Standard: ausgeklappte Navigation links mit Gruppen, aktivem Eintrag und Badges. */
export const Standard: Story = {
  render: () => <PmsSidebarDemo />,
};

/** Icon-Modus: eingeklappt auf eine schmale Icon-Leiste, Beschriftung als Tooltip. */
export const IconModus: Story = {
  render: () => <PmsSidebarDemo collapsible="icon" defaultOpen={false} />,
};

/** Rechte Seite: Sidebar als Detail-/Werkzeugleiste am rechten Rand. */
export const RechteSeite: Story = {
  render: () => <PmsSidebarDemo side="right" />,
};
