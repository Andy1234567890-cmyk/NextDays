"use client";

// NextDays-Dashboard-Navigation:
// Hauptbereiche + aufklappbare Gruppen (Accordion, Lastenheft §2.1) + User-Block.
// Icons via Iconify (ph:*).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/logo";
import { useSupportChat } from "@/components/support/support-chat";
import { logout } from "@/lib/auth";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@nextdays/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
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
  SidebarTrigger,
} from "@nextdays/ui/sidebar";

// Navigation: oben die täglichen Kernbereiche flach, darunter thematische
// Gruppen. Die Beherbergungsart des Mandanten (vacation_rental | hotel,
// Migration 0090) steuert Begriffe („Objekte" vs. „Zimmer") und Sichtbarkeit
// (Eigentümer nur Ferienvermietung).
// `key` = i18n-Schlüssel (Namespace "nav"), `req` = benötigte Berechtigung;
// ohne `req` immer sichtbar. Admin sieht alles (siehe canSee).
type NavItem = { key: string; href: string; icon: string; req?: string };
type AccommodationType = "vacation_rental" | "hotel";

// Täglich genutzte Kernbereiche (flach, wie Casona „Übersicht/Belegungsplan").
const MAIN: readonly NavItem[] = [
  { key: "dashboard", href: "/", icon: "ph:squares-four" },
  { key: "calendar", href: "/kalender", icon: "ph:calendar-blank", req: "view_calendar" },
  { key: "inbox", href: "/posteingang", icon: "ph:chat-circle", req: "pm_chat" },
];

// Thematische Gruppen; werden zur Laufzeit nach Beherbergungsart gebaut.
type NavGroup = { groupKey: string; icon: string; items: readonly NavItem[] };

// Finanz-/Verwaltungspunkte der Betriebs-Gruppe (per owner_reporting gegated,
// ADR-0009). Hotel und Ferienvermietung haben unterschiedliche Sätze:
//  - Hotel folgt dem Casona-„Hotel"-Menü (Rechnungen … Statistik).
//  - Ferienvermietung führt das buchhaltungslastige NextDays-Set.
// Einstellungen wird separat als letzter Punkt der Gruppe angehängt.
// Ziele zeigen auf real existierende Routen: Rechnungen = die Rechnungsliste
// unter /buchhaltung (wie im Ferienvermietungs-Menü), Bankkonten = /buchhaltung/
// bank, Schließzeiten = der Stop-Sell-Kalender (/stop-sell). Zahlungen/
// Umsatz/Listen/Statistik haben eigene Routen (derzeit ComingSoon-Muster wie
// /buchhaltung/berichte) — NIE auf Pfade ohne Route verlinken (404).
const HOTEL_FINANCE: readonly NavItem[] = [
  { key: "invoices", href: "/buchhaltung", icon: "ph:receipt", req: "owner_reporting" },
  { key: "payments", href: "/buchhaltung/zahlungen", icon: "ph:credit-card", req: "owner_reporting" },
  { key: "revenue", href: "/buchhaltung/umsatz", icon: "ph:trend-up", req: "owner_reporting" },
  { key: "bankAccounts", href: "/buchhaltung/bank", icon: "ph:bank", req: "owner_reporting" },
  { key: "lists", href: "/buchhaltung/listen", icon: "ph:list-checks", req: "owner_reporting" },
  { key: "closingDates", href: "/stop-sell", icon: "ph:calendar-x", req: "owner_reporting" },
  { key: "cashBook", href: "/buchhaltung/kassenbuch", icon: "ph:wallet", req: "owner_reporting" },
  { key: "statistics", href: "/buchhaltung/statistik", icon: "ph:chart-bar", req: "owner_reporting" },
];

const VR_FINANCE: readonly NavItem[] = [
  { key: "invoices", href: "/buchhaltung", icon: "ph:receipt", req: "owner_reporting" },
  { key: "quotes", href: "/buchhaltung/angebote", icon: "ph:file-text", req: "owner_reporting" },
  { key: "expenses", href: "/buchhaltung/ausgaben", icon: "ph:arrow-circle-down", req: "owner_reporting" },
  { key: "dunning", href: "/buchhaltung/mahnwesen", icon: "ph:warning-circle", req: "owner_reporting" },
  { key: "chartOfAccounts", href: "/buchhaltung/kontenplan", icon: "ph:tree-structure", req: "owner_reporting" },
  { key: "cashBook", href: "/buchhaltung/kassenbuch", icon: "ph:wallet", req: "owner_reporting" },
  { key: "tax", href: "/buchhaltung/steuer", icon: "ph:percent", req: "owner_reporting" },
  { key: "eInvoice", href: "/buchhaltung/e-rechnung", icon: "ph:file-code", req: "owner_reporting" },
  { key: "datev", href: "/buchhaltung/datev", icon: "ph:export", req: "owner_reporting" },
  { key: "bank", href: "/buchhaltung/bank", icon: "ph:bank", req: "owner_reporting" },
  { key: "reports", href: "/buchhaltung/berichte", icon: "ph:chart-line", req: "owner_reporting" },
];

// Betriebs-Gruppe „Hotel" (exakt das Casona-„Hotel"-Menü).
const HOTEL_GROUP: NavGroup = {
  groupKey: "hotel",
  icon: "ph:buildings",
  items: [
    ...HOTEL_FINANCE,
    // Konditionen = Finanzbedingungen → wie der Backend-Endpunkt gegatet.
    { key: "settings", href: "/einstellungen", icon: "ph:gear", req: "manage_property_conditions" },
  ],
};

// Betriebs-Gruppe „Ferienwohnungen" (NextDays-Finanzsatz + Eigentümer).
const VR_GROUP: NavGroup = {
  groupKey: "vacationRentals",
  icon: "ph:house-line",
  items: [
    { key: "owners", href: "/eigentuemer", icon: "ph:user-circle-gear", req: "manage_owners" },
    ...VR_FINANCE,
    { key: "settings", href: "/einstellungen", icon: "ph:gear", req: "manage_property_conditions" },
  ],
};

function buildGroups(accommodationType: AccommodationType): readonly NavGroup[] {
  const hotel = accommodationType === "hotel";
  // Objekt-Stammdaten als erstes Item der Betriebs-Gruppe: Hotel spricht von
  // „Zimmern", Ferienvermietung von „Objekten" (Label betriebsartabhängig, wie
  // die /objekte-Seite selbst). Ohne diesen Eintrag käme man nicht mehr zur
  // Objektverwaltung (die Route /objekte existiert, war aber unverlinkt).
  const propertiesItem: NavItem = hotel
    ? { key: "rooms", href: "/objekte", icon: "ph:bed" }
    : { key: "properties", href: "/objekte", icon: "ph:house-line" };
  const operationsGroup: NavGroup = {
    ...(hotel ? HOTEL_GROUP : VR_GROUP),
    items: [propertiesItem, ...(hotel ? HOTEL_GROUP : VR_GROUP).items],
  };
  // Genau die Betriebs-Gruppe der eingestellten Beherbergungsart.
  return [
    operationsGroup,
    {
      // Reservierungen (Casona-Muster): Übersicht · Gruppen · Stop-Sell ·
      // Einstellungen. Stop-Sell steuert die Buchbarkeit von Zeiträumen —
      // das ist Reservierungs-/Belegungsarbeit, kein Objektstammdatum.
      groupKey: "reservations",
      icon: "ph:bookmark-simple",
      items: [
        { key: "overview", href: "/reservierungen/kontrollzentrum", icon: "ph:bookmark-simple", req: "view_calendar" },
        { key: "tasks", href: "/reservierungen/aufgaben", icon: "ph:check-square", req: "view_own_tasks" },
        { key: "reservationGroups", href: "/reservierungen/gruppen", icon: "ph:users-three", req: "view_calendar" },
        { key: "stopSell", href: "/stop-sell", icon: "ph:hand-palm", req: "manage_calendar" },
        { key: "settings", href: "/reservierungen/einstellungen", icon: "ph:gear", req: "manage_calendar" },
      ],
    },
    {
      // Gäste: geteilte Hauptkategorie für Hotel UND Ferienvermietung
      // (Casona-Muster): Übersicht · Firmen/Kategorien · Monatsbericht ·
      // Gutscheine, plus die Reisebüro-Partnerkartei.
      groupKey: "guests",
      icon: "ph:users",
      items: [
        { key: "overview", href: "/gaeste", icon: "ph:users", req: "pm_guest_details" },
        { key: "guestCategories", href: "/gaeste/kategorien", icon: "ph:buildings", req: "pm_guest_details" },
        { key: "guestMonthlyReport", href: "/gaeste/monatsbericht", icon: "ph:chart-bar", req: "pm_guest_details" },
        { key: "vouchers", href: "/gaeste/gutscheine", icon: "ph:ticket", req: "pm_guest_details" },
        { key: "travelAgencies", href: "/reisebueros", icon: "ph:handshake", req: "manage_partners" },
      ],
    },
    {
      groupKey: "distribution",
      icon: "ph:broadcast",
      items: [
        { key: "channelManager", href: "/channels", icon: "ph:arrows-left-right" },
        // Preissteuerung ist Vertriebsarbeit — gilt für Hotels wie FeWo.
        { key: "dynamicPricing", href: "/dynamic-pricing", icon: "ph:lightning" },
        { key: "websiteBuilder", href: "/website", icon: "ph:globe", req: "access_homepage_builder" },
      ],
    },
    ...STATIC_GROUPS.filter((g) => !HIDDEN_AT_LAUNCH.has(g.groupKey)),
  ];
}

// Zum ersten Launch nicht angebotene Bereiche: Gruppen bleiben im Code, sind
// aber unverlinkt. Zum Freischalten den jeweiligen groupKey hier entfernen.
const HIDDEN_AT_LAUNCH: ReadonlySet<string> = new Set([
  "marketplace",
  "staff",
  "jobs",
]);

// Betriebsart-unabhängige Gruppen (Marktplatz/HR/Jobs).
// `groupKey` = i18n-Schlüssel (Namespace "nav.groups").
const STATIC_GROUPS: readonly NavGroup[] = [
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
];

// Rollen-Anzeigenamen → i18n-Keys (Namespace "nav.roles").
const ROLE_KEYS: Record<string, string> = {
  admin: "admin",
  co_admin: "coAdmin",
  owner: "owner",
  staff: "staff",
  cleaner: "cleaner",
};

// Eigentümer-Portal (Lastenheft §4.2): read-only, stark reduzierte Navigation.
// Ein Eigentümer sieht NUR diese Bereiche — Belegungskalender, seine Objekte,
// Dynamic-Pricing-Vorschau und (per owner_reporting gegated) die Berichte.
// Andere Punkte ohne `req` (Reservierungen, Channel Manager, Marktplatz, HR …)
// bleiben der Agentur vorbehalten. Pfad-Präfixe (href-Vergleich).
const OWNER_ALLOWED_HREFS: readonly string[] = [
  "/", // Dashboard
  "/kalender",
  "/objekte",
  "/meine-abrechnungen", // Eigene Auszahlungs-Abrechnungen (self-scoped)
];

// Mitarbeiter/Dienstleister-Portal (Lastenheft §4.3): rein operativ. Staff und
// cleaner sehen NUR ihre freigegebenen Objekte und ihre Aufgaben — keine
// Finanzen, keinen Vertrieb, keine Agentur-Verwaltung. Fail-CLOSED: alles, was
// nicht auf dieser Liste steht, ist für staff/cleaner unsichtbar (§4.3). Ohne
// diese Whitelist sahen sie fast die komplette Agentur-Navigation, die überall
// 403/leer lieferte.
const STAFF_ALLOWED_HREFS: readonly string[] = [
  "/", // Dashboard
  "/objekte", // read-only, per RLS 0136 auf zugewiesene Objekte begrenzt
  "/reservierungen/aufgaben", // Meine Aufgaben (Kern-Fläche)
];

export function AppSidebar({
  email = "",
  role = null,
  permissions = [],
  capabilities = [],
  accommodationType = "vacation_rental",
}: {
  email?: string;
  role?: "admin" | "co_admin" | "owner" | "staff" | "cleaner" | null;
  permissions?: string[];
  capabilities?: string[];
  accommodationType?: AccommodationType;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const supportChat = useSupportChat();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Sichtbarkeit eines Menüpunkts: Admin sieht alles; sonst muss die ggf.
  // geforderte Berechtigung vorhanden sein. `req` kann eine feingranulare
  // Permission ODER eine Capability sein (z. B. manage_owners = Agentur-Verwaltung).
  // Eigentümer (§4.2) sehen zusätzlich NUR die fürs read-only-Portal freigegebenen
  // Bereiche.
  const grantSet = new Set([...permissions, ...capabilities]);
  const canSee = (item: NavItem) => {
    if (role === "admin") return true;
    if (item.req && !grantSet.has(item.req)) return false;
    // Eigentümer (§4.2) und Mitarbeiter/Dienstleister (§4.3) haben je ein
    // reduziertes Portal — fail-closed über eine Href-Whitelist, damit sie nicht
    // die volle Agentur-Navigation sehen (die überall 403/leer liefert).
    if (role === "owner" && !OWNER_ALLOWED_HREFS.includes(item.href)) {
      return false;
    }
    if (
      (role === "staff" || role === "cleaner") &&
      !STAFF_ALLOWED_HREFS.includes(item.href)
    ) {
      return false;
    }
    return true;
  };

  const mainItems = MAIN.filter(canSee);
  const groups = buildGroups(accommodationType);

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
        {groups.map((group) => {
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

      {/* User-Block unten — Klick öffnet das Konto-Menü. */}
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
                {/* Live-Chat mit dem myNextDays-Team (Widget im Layout). */}
                <DropdownMenuItem
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                  onSelect={() => supportChat.oeffnen()}
                >
                  <Icon icon="ph:chat-circle-dots" />
                  {t("account.getHelp")}
                  {supportChat.ungelesen > 0 && (
                    <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                      {supportChat.ungelesen}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  <Link href="/hilfe" target="_blank" rel="noopener noreferrer">
                    <Icon icon="ph:lifebuoy" />
                    {t("account.helpCenter")}
                  </Link>
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
