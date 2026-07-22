"use client";

// Verwalten-Tab: kurze Übersicht über die Nachrichten-Funktionen (Vorlagen,
// KI-Antworten, Automatisierungen). Sammelseite analog "Manage messages".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

export function ManageTab() {
  const t = useTranslations("inbox");
  const cards = [
    { icon: "ph:note", key: "tabTemplates", desc: "manageTemplatesDesc" },
    { icon: "ph:sparkle", key: "tabAiReplies", desc: "manageAiDesc" },
    { icon: "ph:lightning", key: "tabAutomations", desc: "manageAutoDesc" },
  ] as const;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <h2 className="mb-4 font-display text-lg font-extrabold">{t("tabManage")}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className="flex flex-col gap-2 rounded-2xl border border-border p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-accent">
              <Icon icon={c.icon} className="size-5" />
            </span>
            <span className="font-semibold">{t(c.key)}</span>
            <span className="text-sm text-muted-foreground">{t(c.desc)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
