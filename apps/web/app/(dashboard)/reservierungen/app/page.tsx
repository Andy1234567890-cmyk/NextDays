import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

// App-Reiter (Lodgify „App"): Info-/Download-Seite für die mobile Housekeeping-
// Sicht. Bei myNextDays ist die Aufgabensicht bereits responsiv im Web
// (mobile-first Detail-Modal) — eine separate native App ist noch nicht Teil
// des Auftrags (prompt-5). Ehrlicher Platzhalter statt Fake-Download.
export default function AppPage() {
  return (
    <ModulePlaceholder
      title="App"
      icon="ph:device-mobile"
      description="Die Aufgaben-Sicht für unterwegs ist bereits responsiv im Web verfügbar (Meine Aufgaben + Detail mit Foto-Upload). Eine separate mobile App folgt als eigener Auftrag."
      link={{ href: "/reservierungen/aufgaben/meine", label: "Zu Meine Aufgaben" }}
    />
  );
}
