// Hinweis über dem Dashboard, solange der Partner nicht freigegeben ist.
import { useTranslations } from "next-intl";

import type { PartnerStatus } from "@/lib/partner";

export function StatusHinweis({ status, grund }: { status: PartnerStatus; grund: string | null }) {
  const t = useTranslations("status");
  return (
    <div className="mb-6 rounded-2xl border border-border bg-muted px-5 py-4 text-sm">
      <p className="font-semibold">{t(`${status}.titel`)}</p>
      <p className="mt-1 text-muted-foreground">{t(`${status}.text`)}</p>
      {grund && (
        <p className="mt-2 text-muted-foreground">
          {t("grund")}: {grund}
        </p>
      )}
    </div>
  );
}
