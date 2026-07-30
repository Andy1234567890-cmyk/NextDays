// Navigations-Typen (React Navigation). Root-Stack mit Rollen-Auswahl, den
// beiden Tab-Bereichen (Gast/Gastgeber) und den modalen Detail-Screens.
import type { NavigatorScreenParams } from "@react-navigation/native";

export type GuestTabParamList = {
  Home: undefined;
  // Suche kann mit vorbelegtem Suchtext/Zeitraum geöffnet werden (Startseite).
  // lat/lng kommen aus der Standortsuche („In der Nähe") und ersetzen dann q.
  Discover:
    | { q?: string; start?: string; end?: string; guests?: number; lat?: number; lng?: number }
    | undefined;
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
  // Gast-Konto (portal_guests) — eigene Auth-Welt, NICHT die Tenant-Anmeldung.
  GuestLogin: { modus?: "login" | "registrieren" } | undefined;
  // Stammdaten des Gast-Kontos (Name/Telefon), aus dem Profil erreichbar.
  GuestAccount: undefined;
  GuestTabs: NavigatorScreenParams<GuestTabParamList>;
  HostTabs: NavigatorScreenParams<HostTabParamList>;
  OwnerTabs: NavigatorScreenParams<OwnerTabParamList>;
  // Zeitraum/Gäste werden durchgereicht, damit das Detail den EFFEKTIVPREIS
  // des angefragten Zeitraums vom Server holen kann (nicht nur den ab-Preis).
  ListingDetail: { id: string; start?: string; end?: string; guests?: number };
  ReservationDetail: { id: string };
  TaskDetail: { id: string };
  // Buchungsstrecke: ohne Objekt/Zeitraum gibt es nichts zu buchen (Pflichtparam).
  Checkout: {
    listingId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
  };
  // Gastmappe/Check-in einer EIGENEN Buchung (guest-stay, Gast-Session nötig).
  Checkin: { reservationId: string };
  // Buchungsdetail des Gastes (guest-bookings) inkl. Verlauf + Storno.
  TripDetail: { id: string };
  // Eine Merkliste des Gastes (guest-wishlist).
  WishlistDetail: { id: string; name?: string };
};
