import { ModulePlaceholder } from "@/components/reservierungen/module-placeholder";

// Slack-Reiter (Slack-Benachrichtigungen): Webhook-Integration für
// Team-Benachrichtigungen. Backend-Slice für Benachrichtigungen ist noch nicht
// gebaut (prompt-5) — ehrlicher Platzhalter statt nicht funktionierendem Toggle.
export default function SlackPage() {
  return (
    <ModulePlaceholder
      title="Slack-Benachrichtigungen"
      icon="ph:chat-circle-dots"
      description="Benachrichtigungen an einen Slack-Webhook (neue Buchung, Aufgabe fällig, Warnung) werden als eigener Auftrag angebunden. Danach steht hier die Webhook-Konfiguration."
    />
  );
}
