// Navigations-Typen der PMS-App (React Navigation). Nur die Betriebs-Welt —
// der Marktplatz lebt seit ADR-0019 in einer eigenen App (myBestDays).
import type { NavigatorScreenParams } from "@react-navigation/native";

export type HostTabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  Reservations: undefined;
  Tasks: undefined;
  // threadId: Deep-Link mynextdays://inbox/:threadId öffnet diesen Thread.
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
  HostLogin: undefined;
  HostSignup: undefined;
  HostTabs: NavigatorScreenParams<HostTabParamList>;
  OwnerTabs: NavigatorScreenParams<OwnerTabParamList>;
  ReservationDetail: { id: string };
  TaskDetail: { id: string };
  // Objekt-Detail (Foto/Adresse/Ausstattung/Kanäle) und der eigene
  // Beschreibungs-Screen mit Lese- und Bearbeitungsmodus.
  PropertyDetail: { id: string };
  PropertyDescription: { id: string };
  // Betriebs-eigene Zusatzfelder eines Objekts (Migration 0242).
  PropertyCustomFields: { id: string };
};
