"use client";

// NextDays-Dashboard-Navigation:
// Hauptbereiche + aufklappbare Gruppen (Accordion, Lastenheft §2.1) + User-Block.
// Icons via Iconify (ph:*).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { istGesperrt } from "@/lib/demo-sperre";

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
} from "@nextdays/ui/sidebar";
import { HILFE_URL } from "@/lib/marketing-url";

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
  // Angebote (0586, Lastenheft §2.2): verschickte Buchungsangebote und ihr
  // Zustand. Flach unter Buchungen, weil ein laufendes Angebot Nächte in
  // Aussicht stellt, die noch frei verkäuflich sind — das ist Tagesgeschäft.
  // `req` spiegelt den Guard am Endpunkt (MANAGE_CALENDAR): Eigentümer und
  // Mitarbeiter haben mit dem Vertrieb nichts zu tun (§4.2/§4.3).
  { key: "offers", href: "/reservierungen/angebote", icon: "ph:paper-plane-tilt", req: "manage_calendar" },
  // Aufgaben stehen flach unter dem Posteingang: sie sind Tagesgeschäft und
  // betreffen jede Rolle (auch Reinigung/Mitarbeiter, die die Buchhaltung nie
  // sehen). Der Punkt steht deshalb NICHT zusätzlich in der Reservierungs-
  // Gruppe — sonst hätte die Sidebar ihn zweimal.
  { key: "tasks", href: "/reservierungen/aufgaben", icon: "ph:check-square", req: "view_own_tasks" },
  // Preissteuerung ist Tagesgeschäft, kein Untermenü-Punkt: der Preis wird
  // täglich nachgezogen. Steht deshalb flach unter Aufgaben und NICHT mehr in
  // der Vertriebs-Gruppe — sonst stünde er zweimal.
  { key: "dynamicPricing", href: "/dynamic-pricing", icon: "ph:lightning" },
  // Kanalmanager und Bewertungen stehen flach unter der Preissteuerung, nicht
  // in einer Vertriebs-Gruppe: beides ist Tagesgeschäft (ein Kanal-Fehler
  // sperrt den Verkauf, eine unbeantwortete Bewertung kostet Ranking) und war
  // hinter dem zugeklappten Menü erst nach zwei Klicks erreichbar. Die Gruppe
  // „distribution" enthielt nur diese zwei Punkte und ist damit entfallen.
  { key: "channelManager", href: "/channels", icon: "ph:arrows-left-right" },
  { key: "reviews", href: "/bewertungen", icon: "ph:star", req: "view_reviews" },
  // Qualität als EIGENER Punkt, nicht als Unterpunkt der Bewertungen: die
  // Liste ist Tagesgeschäft („was muss ich beantworten"), die Auswertung ist
  // Rückblick („wo stehen wir, woran liegt es"). Als fünfter Reiter neben der
  // Liste wäre sie hinter einer Arbeit versteckt, die nie fertig wird.
  // Hostaway trennt sie aus demselben Grund (`Hosting Quality`).
  { key: "quality", href: "/qualitaet", icon: "ph:chart-line-up", req: "view_reviews" },
  // Website-Baukasten: EIN Eintrag, keine aufklappbare Gruppe.
  //
  // Er führt in den Editor, und der Editor hat seine EIGENE Bereichsleiste
  // (Hinzufügen · Seiten · Ebenen · Theme · SEO/AEO · Blog · Mehr) samt
  // Menüspalte. Die drei Unterpunkte, die hier standen — Design, Seiten,
  // Adresse — sind dort ohnehin vorhanden, und zwar vollständiger: die Leiste
  // führt sieben Bereiche, das Untermenü führte drei davon.
  //
  // Ein Untermenü über einer Fläche, die ihre eigene Navigation mitbringt, ist
  // eine zweite Wahrheit darüber, wo man ist: man klickt „Design", landet im
  // Editor, und die Sidebar behauptet weiter „Design", während man längst über
  // die Leiste bei „Theme" ist. Ausdrücklich so gewünscht am 26.08.2026
  // („muss nur ein button sein kein menü mit sub unterpunkten").
  //
  // Ziel ist `/website/seiten`: die Seitenliste ist der Einstieg, von dem aus
  // jede weitere Fläche des Baukastens erreichbar ist.
  {
    // `websiteBuilder` und nicht `website`: dieser Schlüssel steht in allen 24
    // Sprachen gepflegt da (er beschriftete die Gruppe). Einen neuen anzulegen
    // hieße, dieselben 24 Übersetzungen ein zweites Mal zu führen (Wurzel 2).
    key: "websiteBuilder",
    href: "/website/seiten",
    icon: "ph:globe",
    req: "access_homepage_builder",
  },
];

// Welcher Menuepunkt haengt an welchem freischaltbaren Modul (0572)?
//
// Die Praefixe MUESSEN zu `MODUL_PRAEFIXE` in
// `apps/api/.../auth/modul_freischaltung.py` passen: dort sperrt der Server,
// hier blendet die Navigation aus. Laufen die beiden auseinander, entsteht
// genau der Zustand, den `demo_gate` schon einmal hatte — ein Menuepunkt, der
// sichtbar ist und dessen Aufruf mit 404 endet.
const MODUL_PFADE: Record<string, string> = {
  "/hr": "personal",
  "/website": "website_builder",
};

/** Braucht dieser Pfad ein Modul, das der Betrieb nicht hat? */
function modulFehlt(href: string, module: string[]): boolean {
  const treffer = Object.entries(MODUL_PFADE).find(
    ([pfad]) => href === pfad || href.startsWith(pfad + "/"),
  );
  return treffer ? !module.includes(treffer[1]) : false;
}

// Fuß der Navigation: kontoweite Flächen, die zu keinem Objekt und keiner
// Buchung gehören. Sie standen in der aufklappbaren Gruppe „Werkzeuge" — ein
// Deckel über genau zwei Punkten, der beide hinter einen zusätzlichen Klick
// legte und im Icon-Modus nur als Werkzeugkasten-Symbol erschien. Jetzt stehen
// sie flach, aber UNTEN: sie werden selten gebraucht und sollen die täglichen
// Punkte oben nicht verdrängen. Eigener Block NACH den Gruppen — `MAIN` würde
// sie an den Anfang setzen.
const BOTTOM: readonly NavItem[] = [
  // DAC7: die gesetzliche Jahresmeldung der Vermietungsumsaetze an die
  // Steuerbehoerde (EU-Richtlinie 2021/514). EIGENES MODUL, kein Unterpunkt
  // der Buchhaltung — es ist kein Beleg- oder Zahlungsvorgang, sondern eine
  // Meldepflicht gegenueber einer Behoerde, die einmal im Jahr erfuellt wird
  // und einen eigenen Ablauf hat (berechnen, pruefen, abgeben, korrigieren).
  //
  // Unten, weil sie einmal jaehrlich anfaellt und die taeglichen Punkte oben
  // nicht verdraengen soll. `manage_billing`, weil die Meldung Steuerdaten
  // des Betriebs offenlegt — Eigentuemer und Mitarbeiter haben damit nichts
  // zu tun (§4.2/§4.3).
  { key: "dac7", href: "/dac7", icon: "ph:file-text", req: "manage_billing" },
  // „Erweiterungen" ist der Modul-Verkauf (Kacheln + Detailseite mit
  // „Aktivieren") — bewusst NICHT in der Abrechnung, dort stehen Tarif und
  // Rechnungen. Buchen kostet Geld → manage_billing.
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

// Betriebs-Gruppe „Hotel": Stammdaten + Konditionen, ohne Buchhaltung.
const HOTEL_GROUP: NavGroup = {
  groupKey: "hotel",
  icon: "ph:buildings",
  items: [
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
    { key: "settings", href: "/einstellungen", icon: "ph:gear", req: "manage_property_conditions" },
  ],
};

// Die Modul-Freischaltung (0572) steht bewusst NICHT hier, sondern in `canSee`:
// gefiltert wird auf Punkt-Ebene, und eine Gruppe ohne sichtbare Punkte faellt
// beim Rendern ohnehin weg (`items.length === 0 → null`). Diese Funktion
// dieselbe Liste ein zweites Mal filtern zu lassen waere eine zweite Wahrheit
// darueber, was sichtbar ist.
function buildGroups(
  accommodationType: AccommodationType,
  istIntern: boolean,
): readonly NavGroup[] {
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
  //
  // NUR IN INTERNEN KONTEN (Stand 30.08.2026, `tenants.is_internal`, 0505):
  // das Modul ist in Entwicklung, 13 seiner 17 Unterseiten sind noch
  // Platzhalter. In einem echten Betrieb wäre das ein Menüpunkt, hinter dem
  // nichts steht. Zum Freischalten diese Bedingung entfernen — dann auch den
  // Riegel in `app/(dashboard)/buchhaltung/layout.tsx`, beide gehören zusammen.
  //
  // NICHT `is_demo`: das ist die anonyme Schaufenster-Vorführung, und dort ist
  // `/buchhaltung` gerade GESPERRT (`demo_gate.GESPERRTE_PRAEFIXE`). Die
  // Bedingung wäre also genau falsch herum — der Punkt erschiene ausgerechnet
  // dort, wo die API ihn verweigert.
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
    ...(istIntern ? [accountingGroup] : []),
    {
      // Reservierungen (Casona-Muster): Übersicht · Gruppen · Stop-Sell.
      // Stop-Sell steuert die Buchbarkeit von Zeiträumen — das ist
      // Reservierungs-/Belegungsarbeit, kein Objektstammdatum.
      //
      // „Einstellungen" ist am 30.08.2026 entfallen: die Seite war ein reiner
      // Platzhalter, der nach /objekte weiterleitete. Buchungsbezogene
      // Einstellungen (Check-in-Zeiten, Richtlinien) liegen am Objekt — ein
      // Menüpunkt, der nur woandershin zeigt, ist ein Umweg, kein Ziel.
      groupKey: "reservations",
      icon: "ph:bookmark-simple",
      items: [
        // Zeigte bis 30.08.2026 auf `/reservierungen/kontrollzentrum`. Das
        // ist als Reiter „Kennzahlen" in die Auswertung gezogen; die
        // Übersicht dieser Gruppe ist jetzt die Reservierungsliste selbst.
        { key: "overview", href: "/reservierungen", icon: "ph:bookmark-simple", req: "view_calendar" },
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
      ],
    },
    {
      // Gäste: geteilte Hauptkategorie für Hotel UND Ferienvermietung
      // (Casona-Muster): Übersicht plus die Reisebüro-Partnerkartei.
      //
      // ENTFERNT am 30.08.2026: „Kategorien", „Monatsbericht" und
      // „Gutscheine". Keine dieser drei Routen existierte — und weil
      // /gaeste/[id] eine dynamische Route ist, gab es dafür KEINEN 404:
      // /gaeste/monatsbericht rief die Gast-Detailseite mit „monatsbericht"
      // als vermeintlicher Gast-ID auf. Ein toter Link, der sich als falsche
      // Seite tarnt, ist schlimmer als einer, der ehrlich scheitert.
      // Der Monatsbericht lebt jetzt als eigener Hauptpunkt „Auswertung"
      // (/auswertung, siehe REPORTING unten); Kategorien und Gutscheine sind
      // ersatzlos gestrichen, bis sie jemand baut.
      groupKey: "guests",
      icon: "ph:users",
      items: [
        { key: "overview", href: "/gaeste", icon: "ph:users", req: "pm_guest_details" },
        { key: "travelAgencies", href: "/reisebueros", icon: "ph:handshake", req: "manage_partners" },
        // CRM (§2.6, 0596–0598): Eigentümer-Akquise (Leads) und Partner &
        // Deals. `req` spiegelt exakt den Guard am Endpunkt (Capability
        // MANAGE_CRM, crm/router.py) — nur admin/co_admin sehen den Punkt.
        { key: "crm", href: "/crm", icon: "ph:funnel", req: "manage_crm" },
      ],
    },
    {
      // Auswertung: Kennzahlen, Buchungen, Auslastung, Kanäle, Gäste.
      //
      // EIGENER Hauptpunkt, kein Unterpunkt unter „Gäste": ein Auslastungs-
      // oder Kanalbericht ist kein Gästethema. Hostaway führt seinen
      // Berichtsbereich ebenfalls eigenständig (`Financial Reporting`),
      // Lodgify als `Reports`.
      //
      // Berechtigung `view_finances` — dieselbe Hürde wie Seite und Endpunkt.
      // Umsatz und Provision gehören nicht in die Hand einer Reinigungskraft
      // (Wurzel 9, §4.3).
      groupKey: "analysis",
      icon: "ph:chart-line",
      items: [
        { key: "overview", href: "/auswertung", icon: "ph:chart-line", req: "view_finances", exact: true },
        // Preise & Markt: die Auswertung des Dynamic Pricing (Preis gegen
        // Umgebung, Uplift, Berater). Eigene Seite, weil sie je OBJEKT liest
        // und keinen Zeitraum kennt — sie passt nicht in die Reiter oben.
        { key: "prices", href: "/auswertung/preise", icon: "ph:chart-line-up", req: "view_finances" },
      ],
    },
    ...STATIC_GROUPS.filter((g) => !HIDDEN_AT_LAUNCH.has(g.groupKey)),
  ];
}

// Zum ersten Launch nicht angebotene Bereiche: Gruppen bleiben im Code, sind
// aber unverlinkt. Zum Freischalten den jeweiligen groupKey hier entfernen.
const HIDDEN_AT_LAUNCH: ReadonlySet<string> = new Set([
  "marketplace",
  "jobs",
]);

// Betriebsart-unabhängige Gruppen (Marktplatz/HR/Jobs). „Werkzeuge" ist
// aufgelöst — seine zwei Punkte stehen flach in `BOTTOM`.
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
    // Personal & Dienstplan (0541). `req` = Fähigkeit aus permissions.py; die
    // Rollen-Whitelists oben entscheiden zusätzlich, was staff/shift_lead sehen.
    items: [
      // Der Schichtplan zuerst: er ist die Arbeitsfläche, alles andere ist
      // Stammdaten und Auswertung dazu (Betreiber, 04.09.2026).
      { key: "shiftPlan", href: "/hr/schichtplan", icon: "ph:calendar-check", req: "view_team_schedule" },
      { key: "employees", href: "/hr/mitarbeiter", icon: "ph:identification-badge", req: "view_team_schedule" },
      { key: "absence", href: "/hr/abwesenheit", icon: "ph:airplane-takeoff", req: "view_team_schedule" },
      { key: "timeTracking", href: "/hr/zeiterfassung", icon: "ph:timer", req: "view_team_schedule" },
      // Die eigene Stempeluhr (0544). `track_own_time` hat JEDE planbare Rolle
      // — der Eintrag ist damit auch für staff/cleaner sichtbar, und nur
      // dieser eine (STAFF_ALLOWED_HREFS unten).
      { key: "timeClock", href: "/hr/stempeluhr", icon: "ph:clock-user", req: "track_own_time" },
      // Schluessel `staffReports`, nicht `reports`: den hat die Buchhaltung
      // schon (/buchhaltung/berichte). Zwei Bereiche mit demselben Label waeren
      // in der Navigation nicht unterscheidbar.
      { key: "staffReports", href: "/hr/berichte", icon: "ph:list-magnifying-glass", req: "view_team_schedule" },
      { key: "evaluation", href: "/hr/auswertung", icon: "ph:chart-bar", req: "export_lohn" },
      // Lohnläufe mit Statuskette (0547) — Geld, also nur die Leitung.
      { key: "payroll", href: "/hr/lohn", icon: "ph:receipt", req: "export_lohn" },
      { key: "hrSettings", href: "/hr/einstellungen", icon: "ph:gear-six", req: "manage_personal" },
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
  shift_lead: "shiftLead",
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
  "/qualitaet", // Auswertung ebendieser Bewertungen (derselbe Objekt-Scope)
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
  // Personal (0544): die EIGENE Stempeluhr — und nur sie. Bis 0543 hatten
  // Mitarbeitende im Web gar keine Personalfläche (die Mitarbeitersicht war
  // der App vorbehalten, ADR-0023 E5); wer aber am Rechner arbeitet, braucht
  // einen Weg zu stempeln, ohne dass ein Terminal steht. Die Seite zeigt
  // ausschliesslich eigene Daten (Guard `track_own_time`, Scope im Dienst) —
  // kein Team, kein Lohn, keine fremden Zeiten.
  "/hr/stempeluhr",
];

// Schichtleitung (0540): wie staff PLUS die Planungsflächen ihres Teams. Die
// Akte (/hr/mitarbeiter/<id>) ist über `req: manage_personal` gesperrt; die
// Liste zeigt ihr nur Namen und Arbeitsbereiche.
const SHIFT_LEAD_ALLOWED_HREFS: readonly string[] = [
  ...STAFF_ALLOWED_HREFS,
  "/hr/mitarbeiter",
  "/hr/schichtplan",
  "/hr/abwesenheit",
  "/hr/zeiterfassung",
  // Berichte (0547): die Schichtleitung sieht dort nur die Team-Berichte —
  // welche, entscheidet der SERVER (`export_lohn` fehlt ihr, die Finanz-
  // berichte stehen gar nicht im Katalog). Die Whitelist gibt hier also den
  // Weg frei, nicht den Inhalt.
  "/hr/berichte",
];

export function AppSidebar({
  email = "",
  role = null,
  permissions = [],
  capabilities = [],
  accommodationType = "vacation_rental",
  country = null,
  istDemo = false,
  istIntern = false,
  module = [],
  logoUrl = null,
  einrichtungOffen = false,
}: {
  email?: string;
  role?: "admin" | "co_admin" | "owner" | "staff" | "cleaner" | "shift_lead" | null;
  permissions?: string[];
  capabilities?: string[];
  accommodationType?: AccommodationType;
  // Firmensitz (ISO-3166-1 alpha-2) — blendet Werkzeuge aus, die hier nichts
  // taugen (DATEV außerhalb Deutschlands). Bewusst das LAND und nicht die
  // Sprache: der Beta-Betrieb sitzt in DK und arbeitet auf Deutsch.
  country?: string | null;
  // Vorführ-Zugang: gesperrte Bereiche bleiben SICHTBAR, werden aber
  // als nicht öffenbar markiert. Ausblenden würde den Umfang der Software
  // verstecken; der Schutz selbst liegt ohnehin im Backend (`demo_gate`).
  istDemo?: boolean;
  // Internes Konto des Hauses (`tenants.is_internal`, 0505): schaltet die
  // Buchhaltung frei, die noch in Entwicklung ist. Getrennt von `istDemo` —
  // das ist die anonyme Vorführung, dort ist die Buchhaltung gesperrt.
  istIntern?: boolean;
  /** Freigeschaltete Module dieses Betriebs (0572), z. B. „personal". */
  module?: string[];
  /** Firmenlogo aus Konto → Profil (`tenant_billing_profile.company_logo_url`).
   *  null = keins hochgeladen → die Karte zeigt die Initialen. */
  logoUrl?: string | null;
  // Firmendaten ODER Abo fehlen: die Oberflaeche ist dann eine SACKGASSE —
  // veroeffentlichen geht nicht (422), Geld kann nicht ankommen. Statt den
  // Betrieb das auf jeder Seite einzeln herausfinden zu lassen, bleibt die
  // Navigation gesperrt, bis die Einrichtung steht.
  //
  // SICHTBAR gesperrt, nicht ausgeblendet — sonst wirkt die Software kleiner,
  // als sie ist (dieselbe Entscheidung wie beim Vorfuehr-Zugang).
  //
  // Frei bleiben nur die Wege, die aus der Sackgasse HERAUSFUEHREN: das
  // Dashboard mit seinen „Ersten Schritten" und `/konto`, wo Firmendaten und
  // Abo hinterlegt werden. Eine Sperre, die auch den Ausweg sperrt, waere
  // eine Falle.
  einrichtungOffen?: boolean;
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
  // Alle Menüpunkte führen auf einen PFAD — kein Punkt unterscheidet sich mehr
  // nur im Query. Der Baukasten war der letzte Fall (`?reiter=design|seiten|
  // adresse`) und brauchte dafür einen eigenen Vergleichszweig plus
  // `useSearchParams`; seit er echte Unterpfade hat, trägt der normale
  // Präfix-Vergleich auch ihn.
  const alleHrefs = [
    ...MAIN.map((i) => i.href),
    ...BOTTOM.map((i) => i.href),
    ...buildGroups(accommodationType, istIntern).flatMap((g) =>
      g.items.map((i) => i.href),
    ),
  ];
  const isActive = ({ href: pfad, exact }: NavItem) => {
    if (pfad === "/") return pathname === "/";
    if (exact) return pathname === pfad;
    if (!pathname.startsWith(pfad)) return false;
    return !alleHrefs.some(
      (other) =>
        other !== "/" &&
        other.length > pfad.length &&
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
    // Modul-Gate (0572) ebenfalls VOR dem Admin-Kurzschluss: ob ein Betrieb
    // das Personal-Modul hat, ist keine Frage der Rechte, sondern der
    // Freischaltung — der Server antwortet auf `/hr/*` mit 404, egal wer
    // fragt. Stand es unter `role === "admin"`, sah GENAU der Betriebsinhaber
    // als Einziger einen Menuepunkt, dessen Aufruf ins Leere laeuft (live am
    // 07.09.2026: „Hotel Seeblick Warnemuende" mit `enabled_modules: []`).
    if (modulFehlt(item.href, module)) return false;
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
    if (role === "shift_lead" && !SHIFT_LEAD_ALLOWED_HREFS.includes(item.href)) {
      return false;
    }
    return true;
  };

  const mainItems = MAIN.filter(canSee);
  const bottomItems = BOTTOM.filter(canSee);
  const groups = buildGroups(accommodationType, istIntern);

  // Anzeigename + Initialen aus der E-Mail ableiten (bis echtes Profil da ist).
  const displayName = email ? email.split("@")[0] : t("account.title");
  const initials = (email ? email.slice(0, 2) : "ND").toUpperCase();
  const roleLabel = role ? t(`roles.${ROLE_KEYS[role]}`) : "";

  // Das Firmenlogo aus Konto → Profil. Kein `next/image`: die URL zeigt auf
  // den Supabase-Bucket, der in `images.remotePatterns` nicht eingetragen ist —
  // `next/image` bräche dort mit einem Laufzeitfehler ab.
  // `object-contain`, weil Logos meist Wortmarken sind: in einen quadratischen
  // Rahmen gequetscht (`object-cover`) wäre die Marke abgeschnitten.
  const logoBild = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Bucket-URL, s. o.
    <img
      src={logoUrl}
      alt=""
      className="size-8 shrink-0 rounded-full bg-secondary object-contain"
    />
  ) : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Kein Einklapp-Knopf mehr: die Topbar traegt denselben
            `SidebarTrigger` (components/topbar.tsx), und Cmd/Ctrl+B klappt die
            Leiste ebenfalls. Zwei Knoepfe fuer dieselbe Sache direkt
            uebereinander sahen aus wie zwei verschiedene Funktionen.

            Das Logo bleibt in BEIDEN Zustaenden sichtbar, wechselt aber die
            Form: ausgeklappt der Schriftzug, eingeklappt nur das Chevron. Das
            Lockup ist 245x44 (5,6:1) und passt nicht in die ~3 rem schmale
            Leiste — es war dort bisher schlicht versteckt, was eine leere
            Kopfzeile ergab und die Marke genau dann verschwinden liess, wenn
            von ihr nur noch Symbole uebrig sind. */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Link href="/">
            <span className="group-data-[collapsible=icon]:hidden">
              <Logo heightRem={1.75} />
            </span>
            <span className="hidden group-data-[collapsible=icon]:inline-block">
              <Logo heightRem={1.5} nurZeichen />
            </span>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Hauptbereiche */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  {(istDemo && istGesperrt(item.href)) ||
                  (einrichtungOffen && !istAusweg(item.href)) ? (
                    <DemoGesperrt
                      grund={istDemo ? "demo" : "einrichtung"}
                      icon={item.icon}
                      label={t(item.key)}
                      tourKey={item.key}
                    />
                  ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item)}
                    tooltip={t(item.key)}
                  >
                    <Link href={item.href} data-tour={item.key}>
                      <Icon icon={item.icon} />
                      <span className="font-display font-normal">
                        {t(item.key)}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                  )}
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
                          {(istDemo && istGesperrt(item.href)) ||
                          (einrichtungOffen && !istAusweg(item.href)) ? (
                            <DemoGesperrt
                              grund={istDemo ? "demo" : "einrichtung"}
                              icon={item.icon}
                              label={t(item.key)}
                              tourKey={item.key}
                            />
                          ) : (
                          <SidebarMenuButton
                            asChild
                            isActive={isActive(item)}
                            tooltip={t(item.key)}
                          >
                            <Link href={item.href} data-tour={item.key}>
                              <Icon icon={item.icon} />
                              <span className="font-display font-normal">
                                {t(item.key)}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                          )}
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

        {/* Fuß der Navigation: flache Punkte NACH den Gruppen (Erweiterungen,
            Neuerungen). `mt-auto` schiebt den Block an den unteren Rand, damit
            er auch bei kurzer Navigation unten sitzt und nicht direkt an der
            letzten Gruppe klebt. */}
        {bottomItems.length > 0 ? (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {bottomItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    {(istDemo && istGesperrt(item.href)) ||
                    (einrichtungOffen && !istAusweg(item.href)) ? (
                      <DemoGesperrt
                        grund={istDemo ? "demo" : "einrichtung"}
                        icon={item.icon}
                        label={t(item.key)}
                        tourKey={item.key}
                      />
                    ) : (
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item)}
                        tooltip={t(item.key)}
                      >
                        <Link href={item.href} data-tour={item.key}>
                          <Icon icon={item.icon} />
                          <span className="font-display font-normal">
                            {t(item.key)}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
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
                  {logoBild ?? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                      {initials}
                    </span>
                  )}
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
                  {logoBild ?? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                      {initials}
                    </span>
                  )}
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {roleLabel || email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  asChild={!istDemo}
                  disabled={istDemo}
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  {istDemo ? (
                    <span className="flex items-center gap-3">
                      <Icon icon="ph:user-circle" />
                      {t("account.myAccount")}
                      <span
                        aria-hidden="true"
                        className="ml-auto size-2 shrink-0 rounded-full bg-sky-500"
                      />
                    </span>
                  ) : (
                    <Link href="/konto">
                      <Icon icon="ph:user-circle" />
                      {t("account.myAccount")}
                    </Link>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild={!istDemo}
                  disabled={istDemo}
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  {istDemo ? (
                    <span className="flex items-center gap-3">
                      <Icon icon="ph:users" />
                      {t("account.users")}
                      <span
                        aria-hidden="true"
                        className="ml-auto size-2 shrink-0 rounded-full bg-sky-500"
                      />
                    </span>
                  ) : (
                    <Link href="/konto/nutzer">
                      <Icon icon="ph:users" />
                      {t("account.users")}
                    </Link>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild={!istDemo}
                  disabled={istDemo}
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  {istDemo ? (
                    <span className="flex items-center gap-3">
                      <Icon icon="ph:shield-check" />
                      {t("account.security")}
                      <span
                        aria-hidden="true"
                        className="ml-auto size-2 shrink-0 rounded-full bg-sky-500"
                      />
                    </span>
                  ) : (
                    <Link href="/konto/sicherheit">
                      <Icon icon="ph:shield-check" />
                      {t("account.security")}
                    </Link>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild={!istDemo}
                  disabled={istDemo}
                  className="gap-3 px-3 py-2.5 text-sm [&>svg]:size-5"
                >
                  {istDemo ? (
                    <span className="flex items-center gap-3">
                      <Icon icon="ph:receipt" />
                      {t("account.billing")}
                      <span
                        aria-hidden="true"
                        className="ml-auto size-2 shrink-0 rounded-full bg-sky-500"
                      />
                    </span>
                  ) : (
                    <Link href="/konto/abrechnung">
                      <Icon icon="ph:receipt" />
                      {t("account.billing")}
                    </Link>
                  )}
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
                  <a href={HILFE_URL} target="_blank" rel="noopener noreferrer">
                    <Icon icon="ph:lifebuoy" />
                    {t("account.helpCenter")}
                  </a>
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

/** Ein Menüpunkt, der in der Vorführung nicht geöffnet werden kann.
 *
 * Sichtbar, aber nicht klickbar — der Besucher soll den Umfang der Software
 * sehen und zugleich erkennen, wo die Vorführung endet. Ein ausgeblendeter
 * Punkt würde beides verhindern: er lässt das Produkt kleiner wirken und wirft
 * die Frage auf, warum das Menü so kurz ist.
 *
 * `div` statt `button`: es gibt keine Aktion. Ein deaktivierter Button wäre
 * fokussierbar-aber-wirkungslos, und Screenreader kündigten eine Schaltfläche
 * an, die nichts tut. Der Punkt trägt stattdessen `title` als Erklärung.
 */
/** Fuehrt dieser Pfad aus der Einrichtung HERAUS? Der bleibt immer offen. */
function istAusweg(href: string): boolean {
  return href === "/" || href.startsWith("/konto");
}

function DemoGesperrt({
  icon,
  label,
  tourKey,
  grund = "demo",
}: {
  icon: string;
  label: string;
  tourKey?: string;
  // WARUM gesperrt ist — die beiden Gruende sind verschieden und duerfen nicht
  // denselben Text tragen. „In der Vorfuehrung gesperrt" waere im eigenen
  // Betrieb schlicht falsch und schickt den Kunden auf die Suche nach einem
  // Vorfuehr-Modus, den es bei ihm nicht gibt.
  grund?: "demo" | "einrichtung";
}) {
  return (
    <div
      data-tour={tourKey}
      title={
        grund === "einrichtung"
          ? "Erst Firmendaten und Abo hinterlegen — dann ist dieser Bereich nutzbar."
          : "In der Vorführung gesperrt — im eigenen Betrieb voll verfügbar"
      }
      aria-disabled="true"
      className="flex h-8 w-full items-center gap-2 rounded-(--radius) px-2 text-sm text-sidebar-foreground/50"
    >
      <Icon icon={icon} className="shrink-0" />
      <span className="truncate font-display font-normal">{label}</span>
      {/* Der blaue Punkt ist die eigentliche Botschaft: hier ist etwas, das
          freischaltbar ist — kein Fehler und kein fehlendes Recht. Deshalb
          blau (Hinweis) und nicht rot (Sperre) oder grau (unwichtig). */}
      <span
        aria-hidden="true"
        className="ml-auto size-2 shrink-0 rounded-full bg-sky-500 group-data-[collapsible=icon]:hidden"
      />
    </div>
  );
}
