import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";
import { useTranslations } from "next-intl";

// App-Reiter (App): Info-/Download-Seite für die mobile Housekeeping-
// Sicht. Bei myNextDays ist die Aufgabensicht bereits responsiv im Web
// (mobile-first Detail-Modal) — eine separate native App ist noch nicht Teil
// des Auftrags (prompt-5). Ehrlicher Platzhalter statt Fake-Download.
export default function AppPage() {
  const t = useTranslations("reservations");
  return (
    <ModulePlaceholder
      title="App"
      icon="ph:device-mobile"
      description={t("mobileAppHint")}
      link={{ href: "/reservierungen/aufgaben/meine", label: "Zu Meine Aufgaben" }}
    />
  );
}
