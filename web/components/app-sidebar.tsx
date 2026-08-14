"use client";

// NextDays-Dashboard-Navigation:
// Hauptbereiche + aufklappbare Gruppen (Accordion, Lastenheft §2.1) + User-Block.
// Icons via Iconify (ph:*).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/logo";
import { PosteingangAbzeichen } from "@/components/posteingang-abzeichen";
import { useSupportChat } from "@/components/support/support-chat";
import { logout } from "@/lib/auth";
import { inLandVerfuegbar } from "@/lib/laender-funktionen";

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
//
// `rollen` ist die AUSNAHME davon: eine Liste erlaubter Rollen, die VOR dem
// Admin-Kurzschluss in canSee() geprüft wird. Nötig für Punkte, die nicht an
// einer Berechtigung hängen, sondern an der Rolle selbst — `req` allein reicht
// dafür nicht, weil `if (role === "admin") return true` ganz oben steht und
// jede Berechtigungsprüfung überspringt. Ohne `rollen` verhält sich ein Punkt
// exakt wie bisher (No-Op für alle bestehenden Einträge).
type NavItem = {
  key: string;
  href: string;
  icon: string;
  req?: string;
  rollen?: readonly string[];
  // exact=true: nur bei exakt gleichem Pfad aktiv. Nötig für Punkte, unter
  // denen Unterseiten liegen, die die Sidebar NICHT führt (z. B. „Buchungen"
  // auf /reservierungen — /reservierungen/bilder, /warnungen, /unterkuenfte
  // stehen nur im Modul-Menü der PM-Fläche). Die Längster-Treffer-Regel in
  // isActive() kennt nur Sidebar-Pfade und hätte „Buchungen" auf all diesen
  // Unterseiten hervorgehoben.
  exact?: boolean;
};
type AccommodationType = "vacation_rental" | "hotel";

// Täglich genutzte Kernbereiche (flach, wie Casona „Übersicht/Belegungsplan").
const MAIN: readonly NavItem[] = [
  { key: "dashboard", href: "/", icon: "ph:squares-four" },
  { key: "calendar", href: "/kalender", icon: "ph:calendar-blank", req: "view_calendar" },
  { key: "inbox", href: "/posteingang", icon: "ph:chat-circle", req: "pm_chat" },
  // Buchungen (die Buchungstabelle /reservierungen) steht flach unter dem
  // Posteingang: sie ist Tagesgeschäft und war im früheren PM-Untermenü erst
  // nach zwei Klicks erreichbar. Der Punkt steht deshalb NICHT zusätzlich in
  // der Reservierungs-Gruppe.
  { key: "bookings", href: "/reservierungen", icon: "ph:bookmark-simple", req: "view_calendar", exact: true },
  // Aufgaben stehen flach unter dem Posteingang: sie sind Tagesgeschäft und
  // betreffen jede Rolle (auch Reinigung/Mitarbeiter, die die Buchhaltung nie
  // sehen). Der Punkt steht deshalb NICHT zusätzlich in der Reservierungs-
  // Gruppe — sonst hätte die Sidebar ihn zweimal.
  { key: "tasks", href: "/reservierungen/aufgaben", icon: "ph:check-square", req: "view_own_tasks" },
  // Preissteuerung ist Tagesgeschäft, kein Untermenü-Punkt: der Preis wird
  // täglich nachgezogen. Steht deshalb flach unter Aufgaben und NICHT mehr in
  // der Vertriebs-Gruppe — sonst stünde er zweimal.
  { key: "dynamicPricing", href: "/dynamic-pricing", icon: "ph:lightning" },
];

// Thematische Gruppen; werden zur Laufzeit nach Beherbergungsart gebaut.
type NavGroup = { groupKey: string; icon: string; items: readonly NavItem[] };

// Buchhaltung: EIGENE Gruppe, nicht mehr im Rumpf der Betriebs-Gruppe. Vorher
// hingen dreizehn Finanzpunkte unter „Ferienwohnungen"/„Hotel" — die Gruppe war
// eine 16 Einträge lange Liste, in der Objektstammdaten, Eigentümer und
// Buchhaltung ununterscheidbar untereinander standen. Fachlich ist das ein
// anderer Arbeitsplatz (und mit `owner_reporting` eine andere Berechtigung).
//
// Reihenfolge = der Belegfluss, nicht Alphabet oder Zufall:
// Vorgang (Angebot → Rechnung → Mahnung → Ausgabe) · Zahlungsverkehr (Bank,
// Kasse) · Buchhaltungsstamm (Kontenplan, Steuer) · Export (E-Rechnung, DATEV) ·
// Auswertung (Berichte/Statistik) · Regeln zuletzt.
//
// Hotel und Ferienvermietung haben unterschiedliche Sätze:
//  - Hotel folgt dem Casona-„Hotel"-Menü (Rechnungen … Statistik).
//  - Ferienvermietung führt das buchhaltungslastige NextDays-Set.
// Ziele zeigen auf real existierende Routen: Rechnungen = die Rechnungsliste
// unter /buchhaltung, Bankkonten = /buchhaltung/bank. Zahlungen/Umsatz/Listen/
// Statistik haben eigene Routen (derzeit ComingSoon-Muster wie
// /buchhaltung/berichte) — NIE auf Pfade ohne Route verlinken (404).
const HOTEL_ACCOUNTING: readonly NavItem[] = [
  { key: "invoices", href: "/buchhaltung", icon: "ph:receipt", req: "owner_reporting" },
  { key: "payments", href: "/buchhaltung/zahlungen", icon: "ph:credit-card", req: "owner_reporting" },
  // Ausgaben steht in BEIDEN Sätzen: Belege kommen in jedem Betrieb laufend rein.
  { key: "expenses", href: "/buchhaltung/ausgaben", icon: "ph:arrow-circle-down", req: "owner_reporting" },
  { key: "bankAccounts", href: "/buchhaltung/bank", icon: "ph:bank", req: "owner_reporting" },
  { key: "cashBook", href: "/buchhaltung/kassenbuch", icon: "ph:wallet", req: "owner_reporting" },
  { key: "revenue", href: "/buchhaltung/umsatz", icon: "ph:trend-up", req: "owner_reporting" },
  { key: "statistics", href: "/buchhaltung/statistik", icon: "ph:chart-bar", req: "owner_reporting" },
  { key: "lists", href: "/buchhaltung/listen", icon: "ph:list-checks", req: "owner_reporting" },
];
// „Schließzeiten" (/stop-sell) stand hier früher als Hotel-Finanzpunkt und
// zeigte damit auf dieselbe Route wie „Stop-Sell" in der Reservierungs-Gruppe:
// derselbe Link zweimal in der Sidebar, einmal unter einem Namen, den die
// Zielseite nicht führt. Ein gesperrter Zeitraum ist Belegungsarbeit, keine
// Buchhaltung — der Punkt lebt nur noch in der Reservierungs-Gruppe.

const VR_ACCOUNTING: readonly NavItem[] = [
  { key: "quotes", href: "/buchhaltung/angebote", icon: "ph:file-text", req: "owner_reporting" },
  { key: "invoices", href: "/buchhaltung", icon: "ph:receipt", req: "owner_reporting" },
  { key: "dunning", href: "/buchhaltung/mahnwesen", icon: "ph:warning-circle", req: "owner_reporting" },
  { key: "expenses", href: "/buchhaltung/ausgaben", icon: "ph:arrow-circle-down", req: "owner_reporting" },
  { key: "bank", href: "/buchhaltung/bank", icon: "ph:bank", req: "owner_reporting" },
  { key: "cashBook", href: "/buchhaltung/kassenbuch", icon: "ph:wallet", req: "owner_reporting" },
  { key: "chartOfAccounts", href: "/buchhaltung/kontenplan", icon: "ph:tree-structure", req: "owner_reporting" },
  { key: "tax", href: "/buchhaltung/steuer", icon: "ph:percent", req: "owner_reporting" },
  { key: "eInvoice", href: "/buchhaltung/e-rechnung", icon: "ph:file-code", req: "owner_reporting" },
  { key: "datev", href: "/buchhaltung/datev", icon: "ph:export", req: "owner_reporting" },
  { key: "reports", href: "/buchhaltung/berichte", icon: "ph:chart-line", req: "owner_reporting" },
];

// Portal-Abzüge + Gebühren-Zuordnung. Steht bei der Betriebsart, nicht in der
// Buchhaltung: hier wird eingestellt, was ein Portal je Objekt einbehält —
// eine Stammdaten-Regel des Objektbestands, die die Buchhaltung nur ANWENDET.
// In BEIDEN Betriebs-Gruppen, weil jeder Betrieb über Portale verkauft.
const BILLING_RULES: NavItem = {
  key: "billingRules",
  href: "/buchhaltung/abrechnungsregeln",
  icon: "ph:sliders-horizontal",
  req: "owner_reporting",
};

// Betriebs-Gruppe „Hotel": Stammdaten + Konditionen, ohne Buchhaltung.
const HOTEL_GROUP: NavGroup = {
  groupKey: "hotel",
  icon: "ph:buildings",
  items: [
    BILLING_RULES,
    // Konditionen = Finanzbedingungen → wie der Backend-Endpunkt gegatet.
    { key: "settings", href: "/einstellungen", icon: "ph:gear", req: "manage_property_conditions" },
  ],
};

// Betriebs-Gruppe „Ferienwohnungen": Objekte + Eigentümer + Konditionen.
const VR_GROUP: NavGroup = {
  groupKey: "vacationRentals",
  icon: "ph:house-line",
  items: [
    { key: "owners", href: "/eigentuemer", icon: "ph:user-circle-gear", req: "manage_owners" },
    // Reporting für Eigentümer (0365): Berichte über Zeitraum × Objektauswahl
    // und die Auszahlungen daraus. Eigener Punkt und kein Reiter unter
    // /eigentuemer — dort stehen die STAMMDATEN eines Eigentümers, hier die
    // Auswertung über den ganzen Bestand. `req` spiegelt den Guard am
    // Endpunkt (OWNER_REPORTING) und das notFound() des Layouts.
    {
      key: "ownerReporting",
      href: "/eigentuemer/reporting",
      icon: "ph:chart-line-up",
      req: "owner_reporting",
    },
    BILLING_RULES,
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
  // Buchhaltung als eigener Reiter, betriebsartabhängig bestückt.
  const accountingGroup: NavGroup = {
    groupKey: "accounting",
    icon: "ph:calculator",
    items: hotel ? HOTEL_ACCOUNTING : VR_ACCOUNTING,
  };
  // Reihenfolge der Sidebar: erst der Bestand (Objekte/Eigentümer), direkt
  // darunter die Buchhaltung dazu, dann das Tagesgeschäft (Reservierungen,
  // Gäste), dann der Verkauf, zuletzt die kontoweiten Werkzeuge.
  return [
    operationsGroup,
    accountingGroup,
    {
      // Reservierungen (Casona-Muster): Übersicht · Gruppen · Stop-Sell ·
      // Einstellungen. Stop-Sell steuert die Buchbarkeit von Zeiträumen —
      // das ist Reservierungs-/Belegungsarbeit, kein Objektstammdatum.
      groupKey: "reservations",
      icon: "ph:bookmark-simple",
      items: [
        { key: "overview", href: "/reservierungen/kontrollzentrum", icon: "ph:bookmark-simple", req: "view_calendar" },
        // „tasks" steht jetzt oben in MAIN (unter Posteingang) — hier NICHT
        // wiederholen, sonst hätte die Sidebar den Punkt zweimal.
        { key: "reservationGroups", href: "/reservierungen/gruppen", icon: "ph:users-three", req: "view_calendar" },
        { key: "stopSell", href: "/stop-sell", icon: "ph:hand-palm", req: "manage_calendar" },
        // Sperranträge der Eigentümer (0332). Ohne diesen Punkt war die Seite
        // NUR per manueller URL erreichbar — jeder Antrag blieb `pending`, der
        // Eigentümer wartete auf eine Entscheidung, die niemand sah. `req`
        // spiegelt exakt den Guard am Endpunkt (Capability APPROVE_BLOCK,
        // calendar/router.py) und das notFound() der Seite: wer nicht
        // entscheiden darf, sieht den Punkt nicht.
        { key: "blockRequests", href: "/kalender/sperrantraege", icon: "ph:calendar-x", req: "approve_block" },
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
        // Bewertungen aller Kanäle (Portale + myBestDays) — Vertriebsarbeit:
        // eine unbeantwortete Bewertung kostet Sichtbarkeit im Ranking.
        { key: "reviews", href: "/bewertungen", icon: "ph:star", req: "view_reviews" },
        // „dynamicPricing" steht jetzt oben in MAIN (unter Aufgaben) — hier
        // NICHT wiederholen, sonst hätte die Sidebar den Punkt zweimal.
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

// Betriebsart-unabhängige Gruppen (Werkzeuge/Marktplatz/HR/Jobs).
// `groupKey` = i18n-Schlüssel (Namespace "nav.groups").
const STATIC_GROUPS: readonly NavGroup[] = [
  {
    // Werkzeuge: kontoweite Flächen, die zu keinem Objekt und keiner Buchung
    // gehören. „Erweiterungen" ist der Modul-Verkauf (Kacheln + Detailseite mit
    // „Aktivieren") — bewusst NICHT in der Abrechnung, dort stehen Tarif und
    // Rechnungen. Buchen kostet Geld → manage_billing.
    groupKey: "tools",
    icon: "ph:toolbox",
    items: [
      { key: "extensions", href: "/erweiterungen", icon: "ph:puzzle-piece", req: "manage_billing" },
      // Neuerungen: die offiziellen Ankündigungen des Plattform-Teams. Kein
      // `req`, weil das keine Betriebs-Berechtigung ist, sondern eine Frage
      // der Rolle — Adressat sind die Entscheider des Betriebs. Deshalb
      // `rollen` (greift vor dem Admin-Kurzschluss oben in canSee).
      //
      // /neuerungen steht bewusst NICHT in OWNER_ALLOWED_HREFS oder
      // STAFF_ALLOWED_HREFS: diese Whitelists sind das Gegenteil hiervon
      // (sie öffnen für owner/staff), und beide Rollen sollen den Punkt gar
      // nicht sehen. Der Serverpfad hält das gegen: /neuerungen antwortet für
      // sie mit 404 (notFound), der Backend-Slice mit 403.
      {
        key: "announcements",
        href: "/neuerungen",
        icon: "ph:megaphone",
        rollen: ["admin", "co_admin"],
      },
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
//
// WICHTIG — das hier ist NUR NOCH Kosmetik, nicht die Schranke. Ein Eigentümer
// erreicht diese Sidebar im Normalfall gar nicht mehr: das Dashboard-Layout
// leitet die Rolle `owner` serverseitig auf ihr eigenes Portal (/portal, Route-
// Gruppe `(portal)`, siehe lib/rollen-guard.ts). Vorher war diese Liste die
// einzige „Absicherung" — und sie blendete lediglich Menüpunkte aus, während
// jede direkt eingetippte Agentur-URL trotzdem rendert (Wurzel 9).
//
// Die Liste bleibt als zweite Schicht stehen: sollte ein Eigentümer über einen
// Sonderweg (z. B. eine reine Supabase-OAuth-Sitzung ohne FastAPI-Rolle) doch
// hier landen, sieht er weiterhin nicht die volle Agentur-Navigation.
// Pfad-Präfixe (href-Vergleich).
const OWNER_ALLOWED_HREFS: readonly string[] = [
  "/", // Dashboard
  "/kalender",
  "/objekte",
  "/bewertungen", // Bewertungen SEINER Objekte — lesen, nicht antworten (§4.2)
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
  country = null,
}: {
  email?: string;
  role?: "admin" | "co_admin" | "owner" | "staff" | "cleaner" | null;
  permissions?: string[];
  capabilities?: string[];
  accommodationType?: AccommodationType;
  // Firmensitz (ISO-3166-1 alpha-2) — blendet Werkzeuge aus, die hier nichts
  // taugen (DATEV außerhalb Deutschlands). Bewusst das LAND und nicht die
  // Sprache: der Beta-Betrieb sitzt in DK und arbeitet auf Deutsch.
  country?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const supportChat = useSupportChat();

  // Ein Punkt ist aktiv, wenn der Pfad unter ihm liegt UND kein ANDERER Punkt
  // ein längerer Treffer ist.
  //
  // Der reine `startsWith` allein reicht nicht, sobald zwei Punkte in derselben
  // Pfad-Familie liegen: auf `/eigentuemer/reporting` traf er auch
  // `/eigentuemer`, und beide Punkte standen gleichzeitig hervorgehoben da —
  // die Navigation behauptete, man sei an zwei Stellen. Der längste Treffer
  // gewinnt, weil er der spezifischste ist.
  const alleHrefs = [
    ...MAIN.map((i) => i.href),
    ...buildGroups(accommodationType).flatMap((g) => g.items.map((i) => i.href)),
  ];
  const isActive = ({ href, exact }: NavItem) => {
    if (href === "/") return pathname === "/";
    if (exact) return pathname === href;
    if (!pathname.startsWith(href)) return false;
    return !alleHrefs.some(
      (other) =>
        other !== "/" &&
        other.length > href.length &&
        pathname.startsWith(other),
    );
  };

  // Sichtbarkeit eines Menüpunkts: Admin sieht alles; sonst muss die ggf.
  // geforderte Berechtigung vorhanden sein. `req` kann eine feingranulare
  // Permission ODER eine Capability sein (z. B. manage_owners = Agentur-Verwaltung).
  // Eigentümer (§4.2) sehen zusätzlich NUR die fürs read-only-Portal freigegebenen
  // Bereiche.
  const grantSet = new Set([...permissions, ...capabilities]);
  const canSee = (item: NavItem) => {
    // Rollen-Gate VOR dem Admin-Kurzschluss: `rollen` benennt die Rollen, für
    // die es den Punkt überhaupt gibt. Steht es weiter unten, greift es nie —
    // `role === "admin"` würde vorher `true` liefern. Fail-closed: eine
    // unbekannte oder fehlende Rolle (z. B. reine Supabase-OAuth-Sitzung ohne
    // FastAPI-Profil) sieht den Punkt nicht.
    if (item.rollen && !(role && item.rollen.includes(role))) return false;
    // Länder-Gate ebenfalls VOR dem Admin-Kurzschluss: ein DATEV-Export taugt
    // in Dänemark auch dem Admin nichts — das ist keine Frage der Rechte,
    // sondern des Formats. Stünde es darunter, sähe genau der Nutzer, der den
    // Betrieb führt, als Einziger den unbrauchbaren Punkt.
    if (!inLandVerfuegbar(item.key, country)) return false;
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
                    isActive={isActive(item)}
                    tooltip={t(item.key)}
                  >
                    <Link href={item.href}>
                      <Icon icon={item.icon} />
                      <span className="font-display font-normal">
                        {t(item.key)}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                  {/* Nur der Posteingang trägt eine Zahl. Sie steht als
                      Geschwister NEBEN dem Button, nicht darin: der Button ist
                      `asChild` über einem <Link>, und ein zweites Kind darin
                      bräche Radix' Single-Child-Regel. */}
                  {item.key === "inbox" ? <PosteingangAbzeichen /> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Aufklappbare Gruppen */}
        {groups.map((group) => {
          const items = group.items.filter(canSee);
          if (items.length === 0) return null;
          const groupActive = items.some((i) => isActive(i));
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
                            isActive={isActive(item)}
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

                {/* Zugeklappte Sidebar (Icon-Modus): die Gruppen waren dort
                    KOMPLETT unsichtbar — `SidebarGroupLabel` wird vom
                    UI-Paket auf `opacity-0` gesetzt, und die Einträge stecken
                    im zugeklappten CollapsibleContent. Sichtbar blieben nur die
                    drei Einzel-Links oben, darunter Leerraum. Deshalb hier je
                    Gruppe EIN Icon, das auf ihren ersten Eintrag führt; der
                    Tooltip nennt die Gruppe. Nur im Icon-Modus eingeblendet,
                    damit die aufgeklappte Ansicht unverändert bleibt. */}
                <SidebarMenu className="hidden group-data-[collapsible=icon]:block">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={groupActive}
                      tooltip={t(`groups.${group.groupKey}`)}
                    >
                      <Link href={items[0].href}>
                        <Icon icon={group.icon} />
                        <span className="font-display font-normal">
                          {t(`groups.${group.groupKey}`)}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
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
                <DropdownMenuItem
                  asChild
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  <Link href="/konto/abrechnung">
                    <Icon icon="ph:receipt" />
                    {t("account.billing")}
                  </Link>
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
