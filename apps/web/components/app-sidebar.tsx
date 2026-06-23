"use client";

// NextDays-Dashboard-Navigation, am Lodgify-Vorbild ausgerichtet:
// Hauptbereiche + aufklappbare Gruppen (Accordion, Lastenheft §2.1) + User-Block.
// Icons via Iconify (ph:*).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
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
// `key` = i18n-Schlüssel (Namespace "nav"), `req` = benötigte Lodgify-Berechti-
// gung; ohne `req` immer sichtbar. Admin sieht alles (siehe canSee).
type NavItem = { key: string; href: string; icon: string; req?: string };

const MAIN: readonly NavItem[] = [
  { key: "dashboard", href: "/", icon: "ph:squares-four" },
  { key: "reservations", href: "/reservierungen", icon: "ph:bookmark-simple" },
  { key: "inbox", href: "/posteingang", icon: "ph:chat-circle", req: "view_guest_contact" },
  { key: "calendar", href: "/kalender", icon: "ph:calendar-blank" },
  { key: "stopSell", href: "/stop-sell", icon: "ph:hand-palm" },
  { key: "properties", href: "/objekte", icon: "ph:house-line" },
  { key: "websiteBuilder", href: "/website", icon: "ph:globe", req: "access_homepage_builder" },
  { key: "channelManager", href: "/channels", icon: "ph:squares-four" },
];

// Aufklappbare Gruppen (wie Lodgify „Advanced"/„Tools"). Die „My Next"-Domänen
// (Buchhaltung/Marktplatz/HR/Jobs) sind je eine Gruppe; Buchhaltungs-Module
// per owner_reporting gegated (ADR-0009: eine große Sidebar, Pfad-Navigation).
// `groupKey` = i18n-Schlüssel (Namespace "nav.groups").
const GROUPS: readonly {
  groupKey: string;
  icon: string;
  items: readonly NavItem[];
}[] = [
  {
    groupKey: "advanced",
    icon: "ph:bookmark",
    items: [
      { key: "guests", href: "/gaeste", icon: "ph:users", req: "pm_guest_details" },
      { key: "tasks", href: "/aufgaben", icon: "ph:check-square" },
    ],
  },
  {
    groupKey: "accounting",
    icon: "ph:calculator",
    items: [
      { key: "invoices", href: "/buchhaltung", icon: "ph:receipt", req: "owner_reporting" },
      { key: "quotes", href: "/buchhaltung/angebote", icon: "ph:file-text", req: "owner_reporting" },
      { key: "expenses", href: "/buchhaltung/ausgaben", icon: "ph:arrow-circle-down", req: "owner_reporting" },
      { key: "customers", href: "/buchhaltung/kunden", icon: "ph:address-book", req: "owner_reporting" },
      { key: "dunning", href: "/buchhaltung/mahnwesen", icon: "ph:warning-circle", req: "owner_reporting" },
      { key: "chartOfAccounts", href: "/buchhaltung/kontenplan", icon: "ph:tree-structure", req: "owner_reporting" },
      { key: "cashBook", href: "/buchhaltung/kassenbuch", icon: "ph:wallet", req: "owner_reporting" },
      { key: "tax", href: "/buchhaltung/steuer", icon: "ph:percent", req: "owner_reporting" },
      { key: "eInvoice", href: "/buchhaltung/e-rechnung", icon: "ph:file-code", req: "owner_reporting" },
      { key: "datev", href: "/buchhaltung/datev", icon: "ph:export", req: "owner_reporting" },
      { key: "bank", href: "/buchhaltung/bank", icon: "ph:bank", req: "owner_reporting" },
      { key: "reports", href: "/buchhaltung/berichte", icon: "ph:chart-line", req: "owner_reporting" },
    ],
  },
  {
    groupKey: "marketplace",
    icon: "ph:storefront",
    items: [
      { key: "projects", href: "/marktplatz/projekte", icon: "ph:folder" },
      { key: "orders", href: "/marktplatz/auftraege", icon: "ph:clipboard-text" },
      { key: "offers", href: "/marktplatz/angebote", icon: "ph:handshake" },
      { key: "services", href: "/marktplatz/services", icon: "ph:wrench" },
    ],
  },
  {
    groupKey: "staff",
    icon: "ph:users-three",
    items: [
      { key: "employees", href: "/hr/mitarbeiter", icon: "ph:identification-badge" },
      { key: "absence", href: "/hr/abwesenheit", icon: "ph:airplane-takeoff" },
      { key: "shiftPlan", href: "/hr/schichtplan", icon: "ph:calendar-check" },
      { key: "evaluation", href: "/hr/auswertung", icon: "ph:chart-bar" },
    ],
  },
  {
    groupKey: "jobs",
    icon: "ph:briefcase",
    items: [
      { key: "positions", href: "/jobs/stellen", icon: "ph:megaphone" },
      { key: "applications", href: "/jobs/bewerbungen", icon: "ph:user-list" },
    ],
  },
  {
    groupKey: "tools",
    icon: "ph:plus-circle",
    items: [
      { key: "settings", href: "/einstellungen", icon: "ph:gear" },
    ],
  },
];

// Rollen-Anzeigenamen → i18n-Keys (Namespace "nav.roles").
const ROLE_KEYS: Record<string, string> = {
  admin: "admin",
  co_admin: "coAdmin",
  owner: "owner",
  staff: "staff",
  cleaner: "cleaner",
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
  const t = useTranslations("nav");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Sichtbarkeit eines Menüpunkts: Admin sieht alles; sonst muss die ggf.
  // geforderte Berechtigung vorhanden sein.
  const permSet = new Set(permissions);
  const canSee = (item: NavItem) =>
    role === "admin" || !item.req || permSet.has(item.req);

  const mainItems = MAIN.filter(canSee);

  // Anzeigename + Initialen aus der E-Mail ableiten (bis echtes Profil da ist).
  const displayName = email ? email.split("@")[0] : t("account.title");
  const initials = (email ? email.slice(0, 2) : "ND").toUpperCase();
  const roleLabel = role ? t(`roles.${ROLE_KEYS[role]}`) : "";

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
                    tooltip={t(item.key)}
                  >
                    <Link href={item.href}>
                      <Icon icon={item.icon} />
                      <span className="font-display font-normal">
                        {t(item.key)}
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
              key={group.groupKey}
              defaultOpen={groupActive}
              className="group/collapsible"
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
                    <Icon icon={group.icon} className="size-4" />
                    <span className="font-display font-normal">
                      {t(`groups.${group.groupKey}`)}
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
                            tooltip={t(item.key)}
                          >
                            <Link href={item.href}>
                              <Icon icon={item.icon} />
                              <span className="font-display font-normal">
                                {t(item.key)}
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
                  tooltip={t("account.title")}
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
                    {t("account.myAccount")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  <Link href="/konto/nutzer">
                    <Icon icon="ph:users" />
                    {t("account.users")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  <Link href="/konto/sicherheit">
                    <Icon icon="ph:shield-check" />
                    {t("account.security")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5">
                  <Icon icon="ph:receipt" />
                  {t("account.billing")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5">
                  <Icon icon="ph:question" />
                  {t("account.getHelp")}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5">
                  <Icon icon="ph:lifebuoy" />
                  {t("account.helpCenter")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-3 px-3 py-2.5 text-sm text-destructive focus:text-destructive [&>svg]:size-5"
                  onSelect={() => logout().then(() => router.replace("/login"))}
                >
                  <Icon icon="ph:sign-out" />
                  {t("account.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
