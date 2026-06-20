"use client";

// NextDays-Dashboard-Navigation, am Lodgify-Vorbild ausgerichtet:
// Hauptbereiche + aufklappbare Gruppen (Accordion, Lastenheft §2.1) + User-Block.
// Icons via Iconify (ph:*).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/logo";
import { logout } from "@/lib/auth";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// Hauptbereiche (täglich genutzt) — Reihenfolge wie Lodgify, Begriffe auf DE.
// Menüpunkte. `req` = benötigte Lodgify-Berechtigung; ohne `req` immer sichtbar.
// Admin sieht alles (siehe canSee).
type NavItem = { title: string; href: string; icon: string; req?: string };

const MAIN: readonly NavItem[] = [
  { title: "Dashboard", href: "/", icon: "ph:squares-four" },
  { title: "Reservierungen", href: "/reservierungen", icon: "ph:bookmark-simple" },
  { title: "Posteingang", href: "/posteingang", icon: "ph:chat-circle", req: "view_guest_contact" },
  { title: "Kalender", href: "/kalender", icon: "ph:calendar-blank" },
  { title: "Objekte", href: "/objekte", icon: "ph:house-line" },
  { title: "Website-Baukasten", href: "/website", icon: "ph:globe", req: "access_homepage_builder" },
  { title: "Channel Manager", href: "/channels", icon: "ph:squares-four" },
];

// Aufklappbare Gruppen (wie Lodgify „Advanced"/„Tools"). Die „My Next"-Domänen
// (Buchhaltung/Marktplatz/HR/Jobs) sind je eine Gruppe; Buchhaltungs-Module
// per owner_reporting gegated (ADR-0009: eine große Sidebar, Pfad-Navigation).
const GROUPS: readonly { label: string; icon: string; items: readonly NavItem[] }[] = [
  {
    label: "Erweitert",
    icon: "ph:bookmark",
    items: [
      { title: "Gäste", href: "/gaeste", icon: "ph:users", req: "view_guest_contact" },
      { title: "Aufgaben", href: "/aufgaben", icon: "ph:check-square" },
    ],
  },
  {
    label: "Buchhaltung",
    icon: "ph:calculator",
    items: [
      { title: "Rechnungen", href: "/buchhaltung", icon: "ph:receipt", req: "owner_reporting" },
      { title: "Angebote", href: "/buchhaltung/angebote", icon: "ph:file-text", req: "owner_reporting" },
      { title: "Ausgaben", href: "/buchhaltung/ausgaben", icon: "ph:arrow-circle-down", req: "owner_reporting" },
      { title: "Kunden", href: "/buchhaltung/kunden", icon: "ph:address-book", req: "owner_reporting" },
      { title: "Mahnwesen", href: "/buchhaltung/mahnwesen", icon: "ph:warning-circle", req: "owner_reporting" },
      { title: "Kontenplan", href: "/buchhaltung/kontenplan", icon: "ph:tree-structure", req: "owner_reporting" },
      { title: "Kassenbuch", href: "/buchhaltung/kassenbuch", icon: "ph:wallet", req: "owner_reporting" },
      { title: "Steuer", href: "/buchhaltung/steuer", icon: "ph:percent", req: "owner_reporting" },
      { title: "E-Rechnung", href: "/buchhaltung/e-rechnung", icon: "ph:file-code", req: "owner_reporting" },
      { title: "DATEV", href: "/buchhaltung/datev", icon: "ph:export", req: "owner_reporting" },
      { title: "Bank", href: "/buchhaltung/bank", icon: "ph:bank", req: "owner_reporting" },
      { title: "Berichte", href: "/buchhaltung/berichte", icon: "ph:chart-line", req: "owner_reporting" },
    ],
  },
  {
    label: "Marktplatz",
    icon: "ph:storefront",
    items: [
      { title: "Projekte", href: "/marktplatz/projekte", icon: "ph:folder" },
      { title: "Aufträge", href: "/marktplatz/auftraege", icon: "ph:clipboard-text" },
      { title: "Angebote", href: "/marktplatz/angebote", icon: "ph:handshake" },
      { title: "Services", href: "/marktplatz/services", icon: "ph:wrench" },
    ],
  },
  {
    label: "Personal",
    icon: "ph:users-three",
    items: [
      { title: "Mitarbeiter", href: "/hr/mitarbeiter", icon: "ph:identification-badge" },
      { title: "Abwesenheit", href: "/hr/abwesenheit", icon: "ph:airplane-takeoff" },
      { title: "Schichtplan", href: "/hr/schichtplan", icon: "ph:calendar-check" },
      { title: "Auswertung", href: "/hr/auswertung", icon: "ph:chart-bar" },
    ],
  },
  {
    label: "Jobs",
    icon: "ph:briefcase",
    items: [
      { title: "Stellen", href: "/jobs/stellen", icon: "ph:megaphone" },
      { title: "Bewerbungen", href: "/jobs/bewerbungen", icon: "ph:user-list" },
    ],
  },
  {
    label: "Werkzeuge",
    icon: "ph:plus-circle",
    items: [
      { title: "Einstellungen", href: "/einstellungen", icon: "ph:gear" },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  co_admin: "Co-Admin",
  owner: "Eigentümer",
  staff: "Mitarbeiter",
  cleaner: "Reinigung",
};

export function AppSidebar({
  email = "",
  role = null,
  permissions = [],
}: {
  email?: string;
  role?: "admin" | "co_admin" | "owner" | "staff" | "cleaner" | null;
  permissions?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Sichtbarkeit eines Menüpunkts: Admin sieht alles; sonst muss die ggf.
  // geforderte Berechtigung vorhanden sein.
  const permSet = new Set(permissions);
  const canSee = (item: NavItem) =>
    role === "admin" || !item.req || permSet.has(item.req);

  const mainItems = MAIN.filter(canSee);

  // Anzeigename + Initialen aus der E-Mail ableiten (bis echtes Profil da ist).
  const displayName = email ? email.split("@")[0] : "Konto";
  const initials = (email ? email.slice(0, 2) : "ND").toUpperCase();
  const roleLabel = role ? ROLE_LABELS[role] : "";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <Link href="/" className="group-data-[collapsible=icon]:hidden">
            <Logo heightRem={1.75} />
          </Link>
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Hauptbereiche */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <Icon icon={item.icon} />
                      <span className="font-display font-normal">
                        {item.title}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Aufklappbare Gruppen */}
        {GROUPS.map((group) => {
          const items = group.items.filter(canSee);
          if (items.length === 0) return null;
          const groupActive = items.some((i) => isActive(i.href));
          return (
            <Collapsible
              key={group.label}
              defaultOpen={groupActive}
              className="group/collapsible"
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
                    <Icon icon={group.icon} className="size-4" />
                    <span className="font-display font-normal">
                      {group.label}
                    </span>
                    <Icon
                      icon="ph:caret-down"
                      className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180"
                    />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive(item.href)}
                            tooltip={item.title}
                          >
                            <Link href={item.href}>
                              <Icon icon={item.icon} />
                              <span className="font-display font-normal">
                                {item.title}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      {/* User-Block unten — Klick öffnet das Konto-Menü (wie Lodgify). */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Konto"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                    {initials}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {displayName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {email}
                    </span>
                  </div>
                  <Icon icon="ph:caret-up-down" className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="right"
                align="end"
                className="w-60 p-1.5"
                sideOffset={8}
              >
                <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                    {initials}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {roleLabel || email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  asChild
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  <Link href="/konto">
                    <Icon icon="ph:user-circle" />
                    Mein Konto
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  <Link href="/konto/nutzer">
                    <Icon icon="ph:users" />
                    Nutzer
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  <Link href="/konto/sicherheit">
                    <Icon icon="ph:shield-check" />
                    Sicherheit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5">
                  <Icon icon="ph:receipt" />
                  Abrechnung
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5">
                  <Icon icon="ph:question" />
                  Hilfe erhalten
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5">
                  <Icon icon="ph:lifebuoy" />
                  Hilfe-Center
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-3 px-3 py-2.5 text-sm text-destructive focus:text-destructive [&>svg]:size-5"
                  onSelect={() => logout().then(() => router.replace("/login"))}
                >
                  <Icon icon="ph:sign-out" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
