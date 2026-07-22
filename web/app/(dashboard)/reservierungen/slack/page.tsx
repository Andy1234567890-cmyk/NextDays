import { getTranslations } from "next-intl/server";
import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

// Slack-Reiter (Slack-Benachrichtigungen): Webhook-Integration für
// Team-Benachrichtigungen. Backend-Slice für Benachrichtigungen ist noch nicht
// gebaut (prompt-5) — ehrlicher Platzhalter statt nicht funktionierendem Toggle.
export default async function SlackPage() {
  const t = await getTranslations("reservations");

  return (
    <ModulePlaceholder
      title={t("slackPage.title")}
      icon="ph:chat-circle-dots"
      description={t("slackPage.description")}
    />
  );
}
