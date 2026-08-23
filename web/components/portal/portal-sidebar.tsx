"use client";

// Navigation des Eigentümer-Portals (§4.2). Bewusst EIGEN und nicht die
// Agentur-Sidebar mit Filter: `OWNER_ALLOWED_HREFS` dort war Kosmetik an einer
// Menüliste, die dem Eigentümer nicht gehört. Hier steht genau das, was ein
// Eigentümer tut — Reihenfolge nach dem Branchenmuster (Übersicht → Kalender →
// Auszahlungen/Berichte → Anfragen → Einstellungen).
//
// Es gibt in dieser Liste KEINEN Weg auf eine Agentur-Fläche und keinen auf
// /kalender oder /stop-sell: der Eigentümer darf nicht sperren, nur beantragen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/logo";
import { logout } from "@/lib/auth";

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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@nextdays/ui/sidebar";

/**
 * Voraussetzung, unter der ein Menüpunkt erscheint.
 *
 * ZWEI Herkünfte, EIN Feld — bewusst kein zweites Filtersystem daneben:
 *  * `"berichte"`/`"zugaenge"` sind Freigaben des Familienzugangs (0389,
 *    GET /public-portal/familie/rolle);
 *  * jeder andere Wert ist eine granulare Berechtigung aus `/auth/me`
 *    (`MeResponse.permissions`, z. B. `pm_property_area`).
 * Welcher Fall vorliegt, entscheidet `sichtbar()` an EINER Stelle.
 */
type PortalVoraussetzung =
  | "berichte"
  | "zugaenge"
  | "pm_property_area"
  | "pm_photo_album"
  | "pm_nonrevenue_charts";

type PortalNavItem = {
  key: string;
  href: string;
  icon: string;
  /** Ohne Angabe: immer sichtbar. */
  braucht?: PortalVoraussetzung;
};

const NAV: readonly PortalNavItem[] = [
  { key: "overview", href: "/portal", icon: "ph:squares-four" },
  { key: "calendar", href: "/portal/kalender", icon: "ph:calendar-blank" },
  {
    key: "propertyArea",
    href: "/portal/objekte",
    icon: "ph:house-line",
    braucht: "pm_property_area",
  },
  {
    key: "photoAlbum",
    href: "/portal/fotoalbum",
    icon: "ph:images",
    braucht: "pm_photo_album",
  },
  {
    key: "statistics",
    href: "/portal/statistiken",
    icon: "ph:chart-bar",
    braucht: "pm_nonrevenue_charts",
  },
  {
    key: "reports",
    href: "/portal/berichte",
    icon: "ph:chart-line",
    braucht: "berichte",
  },
  { key: "blockRequests", href: "/portal/sperrungen", icon: "ph:hand-palm" },
  {
    key: "familyAccess",
    href: "/portal/zugaenge",
    icon: "ph:users-three",
    braucht: "zugaenge",
  },
  { key: "meterReadings", href: "/portal/zaehlerstaende", icon: "ph:gauge" },
  { key: "services", href: "/portal/dienstleistungen", icon: "ph:broom" },
  {
    key: "notifications",
    href: "/portal/benachrichtigungen",
    icon: "ph:bell",
  },
];

export function PortalSidebar({
  email = "",
  darfBerichte = true,
  darfZugaenge = true,
  rechte = [],
}: {
  email?: string;
  /** Aus GET /public-portal/familie/rolle. Voreinstellung `true`, weil der
   *  Normalfall der Eigentümer selbst ist — und weil ein Ladefehler die
   *  Navigation nicht leerräumen darf (Wurzel 5: „konnte nicht laden" ist
   *  nicht „darf nicht"). Sicherheit hängt NICHT hieran: jeder Endpunkt prüft
   *  seine Rechte selbst, ein sichtbarer Punkt führt höchstens zu 403. */
  darfBerichte?: boolean;
  darfZugaenge?: boolean;
  /** `MeResponse.permissions` aus `/auth/me` (portalGuard liefert `me`).
   *  Anders als die beiden Freigaben oben ist die Voreinstellung hier LEER:
   *  ein Recht, das der Server nicht nennt, hat der Zugang nicht — es gibt
   *  keinen „Normalfall", aus dem sich `pm_photo_album` ableiten ließe
   *  (Wurzel 4). Sicherheit hängt auch hier nicht daran: die Endpunkte prüfen
   *  selbst, die Liste ist Kosmetik. */
  rechte?: readonly string[];
}) {
  const t = useTranslations("portal.nav");
  const tPortal = useTranslations("portal");
  const pathname = usePathname();
  const router = useRouter();

  // EIN Filter für beide Herkünfte (siehe PortalVoraussetzung).
  const gewaehrt = new Set(rechte);
  const sichtbar = (item: PortalNavItem) => {
    if (!item.braucht) return true;
    if (item.braucht === "berichte") return darfBerichte;
    if (item.braucht === "zugaenge") return darfZugaenge;
    return gewaehrt.has(item.braucht);
  };

  // „/portal" ist nur aktiv, wenn es EXAKT die Übersicht ist — sonst leuchtete
  // der erste Punkt auf jeder Unterseite mit.
  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  const displayName = email ? email.split("@")[0] : tPortal("title");
  const initials = (email ? email.slice(0, 2) : "ND").toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <Link href="/portal" className="group-data-[collapsible=icon]:hidden">
            <Logo heightRem={1.75} />
          </Link>
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.filter(sichtbar).map((item) => (
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
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip={displayName}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                    {initials}
                  </span>
                  <span className="truncate font-display font-normal">
                    {displayName}
                  </span>
                  <Icon icon="ph:caret-up-down" className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="truncate font-normal">
                  {email || displayName}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void logout().then(() => router.push("/login"));
                  }}
                >
                  <Icon icon="ph:sign-out" className="size-4" />
                  {tPortal("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
