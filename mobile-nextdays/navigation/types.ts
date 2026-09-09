// Navigations-Typen der PMS-App (React Navigation). Nur die Betriebs-Welt —
// der Marktplatz lebt seit ADR-0019 in einer eigenen App (myBestDays).
import type { NavigatorScreenParams } from "@react-navigation/native";

import type { MappenFeld } from "@/lib/gaestemappe";

export type HostTabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  // status: mit welchem Status-Filter die Buchungsliste öffnet. Die Übersicht
  // führt so auf „offene Anfragen", ohne dass es dafür eine zweite Seite mit
  // denselben Zeilen gibt.
  Reservations: { status?: "pending" | "confirmed" | "cancelled" | "completed" } | undefined;
  Tasks: undefined;
  // Aufgaben-Kalender (Wochenstreifen + Tages-Agenda). Kein eigener Tab-Button
  // — erreichbar über den Umschalter im Aufgaben-Kopf (Regel „max 5 Tabs").
  TaskCalendar: undefined;
  // threadId: Deep-Link mynextdays://inbox/:threadId öffnet diesen Thread.
  HostInbox: { threadId?: string } | undefined;
  Listings: undefined;
  Reviews: undefined;
  HostProfile: undefined;
  More: undefined;
};

// Mitarbeiter (staff/cleaner): reduzierte Tabs, kein Finanz-/Vertriebseinblick.
// Kein Kalender: _STAFF hat kein VIEW_CALENDAR (§4.3) — der Endpoint würde 403
// liefern; Belegungszeiten sehen Mitarbeiter über ihre Aufgaben.
export type StaffTabParamList = {
  Tasks: undefined;
  // Derselbe Aufgaben-Kalender wie im Verwalter-Erlebnis, nur aus „Meine
  // Aufgaben" gespeist — Mitarbeiter haben kein VIEW_CALENDAR (§4.3), also
  // auch keine Buchungs-/Belegungsdaten darin.
  TaskCalendar: undefined;
  HostProfile: undefined;
};

export type RootStackParamList = {
  HostLogin: undefined;
  // „Passwort vergessen": Reset-Link anfordern. Ohne Session, deshalb im
  // ungeschuetzten Zweig neben HostLogin.
  HostPasswortVergessen: undefined;
  HostTabs: NavigatorScreenParams<HostTabParamList>;
  // Eigentümer-Konten haben in dieser App kein Erlebnis mehr — das
  // Eigentümer-Portal ist eine eigene App. Statt eines stummen Logouts
  // (experienceFor wäre null) landet die Rolle `owner` hier.
  OwnerAppHinweis: undefined;
  ReservationDetail: { id: string };
  TaskDetail: { id: string };
  // Objekt-Detail (Foto/Adresse/Ausstattung/Kanäle) und der eigene
  // Beschreibungs-Screen mit Lese- und Bearbeitungsmodus.
  PropertyDetail: { id: string };
  PropertyDescription: { id: string };
  // Betriebs-eigene Zusatzfelder eines Objekts (Migration 0242).
  PropertyCustomFields: { id: string };
  // Gästemappe: Liste der acht Blöcke und der einzelne Text je Sprache.
  // Dieselben Daten wie im Web (`type_attributes.messaging`).
  PropertyGuestGuide: { id: string };
  PropertyGuestGuideText: { id: string; feld: MappenFeld };
};
