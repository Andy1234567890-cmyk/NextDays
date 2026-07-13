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
  HostInbox: undefined;
  Listings: undefined;
  HostProfile: undefined;
};

export type RootStackParamList = {
  RoleSelect: undefined;
  HostLogin: undefined;
  GuestTabs: NavigatorScreenParams<GuestTabParamList>;
  HostTabs: NavigatorScreenParams<HostTabParamList>;
  ListingDetail: { id: string };
  Checkout: undefined;
  Checkin: undefined;
};
