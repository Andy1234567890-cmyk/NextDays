"use client";

// "War dieser Artikel hilfreich?" — reine UI-Rückmeldung (lokaler State, kein
// Persistieren). Texte aus next-intl (Namespace "help"). Iconify, Pill-Buttons.
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ArticleFeedback() {
  const t = useTranslations("help");
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);

  if (choice) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        <Icon icon="ph:heart" className="size-5 text-accent" />
        {t("helpfulThanks")}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-foreground">{t("helpfulQuestion")}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setChoice("yes")}>
          <Icon icon="ph:thumbs-up" className="size-4" />
          {t("helpfulYes")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setChoice("no")}>
          <Icon icon="ph:thumbs-down" className="size-4" />
          {t("helpfulNo")}
        </Button>
      </div>
    </div>
  );
}
