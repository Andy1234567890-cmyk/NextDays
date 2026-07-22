// Navigations-Typen (React Navigation). Root-Stack mit Rollen-Auswahl, den
// beiden Tab-Bereichen (Gast/Gastgeber) und den modalen Detail-Screens.
import type { NavigatorScreenParams } from "@react-navigation/native";

export type GuestTabParamList = {
  Home: undefined;
  Discover: undefined;
  Wishlist: undefined;
  Trips: undefined;
  GuestProfile: undefined;
};

export type HostTabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  Reservations: undefined;
  Tasks: undefined;
  // threadId: Deep-Link nextdays://host/inbox/:threadId öffnet diesen Thread.
  HostInbox: { threadId?: string } | undefined;
  Listings: undefined;
  HostProfile: undefined;
  More: undefined;
};

// Mitarbeiter (staff/cleaner): reduzierte Tabs, kein Finanz-/Vertriebseinblick.
// Kein Kalender: _STAFF hat kein VIEW_CALENDAR (§4.3) — der Endpoint würde 403
// liefern; Belegungszeiten sehen Mitarbeiter über ihre Aufgaben.
export type StaffTabParamList = {
  Tasks: undefined;
  HostProfile: undefined;
};

// Eigentümer (Rolle owner): eigenes hermetisches Erlebnis über /public-portal.
// KEINE Agentur-Screens erreichbar (Navigation getrennt, nicht nur versteckt).
export type OwnerTabParamList = {
  OwnerProperties: undefined;
  OwnerCalendar: undefined;
  OwnerEarnings: undefined;
  // Sperr-Anfragen + Zählerstände + Konto/Logout gebündelt (kein Tab-Zoo).
  OwnerRequests: undefined;
};

export type RootStackParamList = {
  RoleSelect: undefined;
  HostLogin: undefined;
  HostSignup: undefined;
  GuestTabs: NavigatorScreenParams<GuestTabParamList>;
  HostTabs: NavigatorScreenParams<HostTabParamList>;
  OwnerTabs: NavigatorScreenParams<OwnerTabParamList>;
  ListingDetail: { id: string };
  ReservationDetail: { id: string };
  TaskDetail: { id: string };
  Checkout: undefined;
  Checkin: undefined;
};
