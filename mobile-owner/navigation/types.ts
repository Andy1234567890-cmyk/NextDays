// Navigations-Typen dieser App. EINE Rolle (owner), EIN Erlebnis — es gibt
// deshalb keinen Rollen-Verteiler wie in mobile-nextdays (`lib/experience.ts`):
// wer sich hier anmeldet und nicht `owner` ist, sieht keine andere Oberfläche,
// sondern eine Erklärung samt Weg in die PMS-App (fail-closed, Wurzel 5).
import type { NavigatorScreenParams } from "@react-navigation/native";

export type OwnerTabParamList = {
  Ueberblick: undefined;
  Objekte: undefined;
  Kalender: undefined;
  Auszahlungen: undefined;
  Mehr: undefined;
};

export type RootStackParamList = {
  Anmelden: undefined;
  Tabs: NavigatorScreenParams<OwnerTabParamList>;
  ObjektDetail: { id: string; titel: string };
  Fotoalbum: undefined;
  Belegung: undefined;
  SperrAntrag: { propertyId?: string } | undefined;
  Zaehlerstand: { propertyId: string; titel: string };
  Abrechnungen: undefined;
  Profil: undefined;
  // Falsche Rolle: kein Erlebnis, sondern ein Hinweis (siehe Kopf).
  FalscheRolle: undefined;
};
