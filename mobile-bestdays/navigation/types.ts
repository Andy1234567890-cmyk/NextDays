// Navigations-Typen der Marktplatz-App (React Navigation). Nur die Gast-Welt —
// der Betriebsbereich lebt seit ADR-0019 in einer eigenen App (myNextDays) und
// ist von hier aus nur noch per App-Wechsel erreichbar (lib/appwechsel.ts).
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

export type RootStackParamList = {
  // Gast-Konto (portal_guests) — die einzige Auth-Welt dieser App.
  GuestLogin: { modus?: "login" | "registrieren" } | undefined;
  // Stammdaten des Gast-Kontos (Name/Telefon), aus dem Profil erreichbar.
  GuestAccount: undefined;
  GuestTabs: NavigatorScreenParams<GuestTabParamList>;
  // Zeitraum/Gäste werden durchgereicht, damit das Detail den EFFEKTIVPREIS
  // des angefragten Zeitraums vom Server holen kann (nicht nur den ab-Preis).
  ListingDetail: { id: string; start?: string; end?: string; guests?: number };
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
  // Nachrichten an den Gastgeber (guest-messages). OHNE Parameter: die Liste
  // aller Verläufe (aus dem Profil). MIT `reservationId`: direkt der Verlauf zu
  // dieser Buchung (aus dem Buchungsdetail) — der Thread wird dabei idempotent
  // geholt bzw. angelegt.
  GuestMessages: { reservationId?: string } | undefined;
};
