"use client";

import { useTranslations } from "next-intl";

import { ComingSoon } from "@/components/ui/coming-soon";

export default function AusgabenPage() {
  const t = useTranslations("finance");

  return (
    <ComingSoon
      title={t("page.expensesTitle")}
      description={t("page.expensesDescription")}
      icon="ph:arrow-circle-down"
    />
  );
}
