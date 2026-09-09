// Navigations-Typen dieser App. EINE Rolle (owner), EIN Erlebnis — es gibt
// deshalb keinen Rollen-Verteiler wie in mobile-nextdays (`lib/experience.ts`):
// wer sich hier anmeldet und nicht `owner` ist, sieht keine andere Oberfläche,
// sondern eine Erklärung samt Weg in die PMS-App (fail-closed, Wurzel 5).
import type { NavigatorScreenParams } from "@react-navigation/native";

// Fünf Tabs nach der Vorlage (Hostaway Owner App, 07.09.2026): Start ·
// Abrechnungen · Aufenthalte · Kalender · Mehr. Objekte und Auszahlungen je
// Objekt sind Stack-Routen (von Start bzw. „Mehr" erreichbar), die Statistik
// („Auslastung & Kanäle") ebenso.
export type OwnerTabParamList = {
  Start: undefined;
  Abrechnungen: undefined;
  Aufenthalte: undefined;
  Kalender: { alsTab?: boolean; propertyId?: string } | undefined;
  Mehr: undefined;
};

export type RootStackParamList = {
  Anmelden: undefined;
  Tabs: NavigatorScreenParams<OwnerTabParamList>;
  ObjektDetail: { id: string; titel: string };
  Objekte: undefined;
  Fotoalbum: undefined;
  Belegung: undefined;
  // „Aufenthalt buchen" — Name bleibt für den Deep-Link `eigennutzung`.
  // `von`/`bis` (Anreise/Abreise) aus der Zieh-Auswahl im Kalender.
  SperrAntrag: { propertyId?: string; von?: string; bis?: string } | undefined;
  AufenthaltBestaetigt: {
    antrag: import("@/lib/ownerPortal").BlockRequest;
    objekt: { title: string; photo: string | null; adresse: string | null };
    checkIn: string;
    checkOut: string;
    gaeste: number;
    kinder: number;
    haustiere: number;
    notizen: string | null;
  };
  Zaehlerstand: { propertyId: string; titel: string };
  // Chat mit der Verwaltung (0611). `threadId` ist leer, solange über dieses
  // Objekt noch nie gesprochen wurde — der Faden entsteht serverseitig mit
  // der ersten Nachricht.
  Nachrichten: undefined;
  Chat: { propertyId: string; threadId: string };
  // Die eigenen Chat-Geräte — bei E2E der einzige Schutz gegen einen
  // untergeschobenen Mitleser (ADR-0029).
  ChatGeraete: undefined;
  // Beleg einer Abrechnung (Tab „Abrechnungen" → Karte).
  AbrechnungDetail: { id: string; titel: string };
  // Auszahlungen je Objekt und Statistik — aus „Mehr".
  Auszahlungen: undefined;
  Statistik: undefined;
  // Aufgaben, die die Verwaltung dem Eigentümer zugewiesen hat (03.09.2026).
  Aufgaben: undefined;
  Profil: undefined;
  // Falsche Rolle: kein Erlebnis, sondern ein Hinweis (siehe Kopf).
  FalscheRolle: undefined;
};
