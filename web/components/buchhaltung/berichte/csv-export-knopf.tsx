// CSV-Export als LINK auf den Next-Proxy (/api/v1/…): der Proxy hängt das
// Session-Token an und reicht Content-Disposition durch — der Browser lädt
// die Datei, ohne dass ein Blob im Client gebaut werden muss.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import type { Berichtsart } from "@/lib/buchhaltung-berichte-typen";

export function CsvExportKnopf({
  report,
  params,
}: {
  report: Berichtsart;
  params: Record<string, string | undefined>;
}) {
  const t = useTranslations("finance");
  const q = new URLSearchParams({ report });
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`/api/v1/buchhaltung/reports/export.csv?${q}`} download>
        <Icon icon="ph:download-simple" className="size-4" aria-hidden />
        {t("berichteGemeinsam.csvExport")}
      </a>
    </Button>
  );
}
