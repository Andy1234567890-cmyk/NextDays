"use client";

// Beleg-Vorschau (Muster aus dem Buchhaltungs-/Finance-Modul: LivePreviewModal):
// zeigt die fertige Abrechnung als A4-Beleg in einem Dialog — exakt das HTML,
// das auch der PDF-Dienst rendert (buildStatementHtml) — bevor heruntergeladen
// oder finalisiert wird. Radix-Dialog im myNextDays-Stil (abgerundet, Tokens).
import { Icon } from "@iconify/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import type { Statement } from "@/lib/owner-statements";
import { buildStatementHtml, downloadStatementPdf } from "@/lib/statement-pdf";

export function StatementPreviewModal({
  statement,
  open,
  onOpenChange,
  kanalLabels,
}: {
  statement: Statement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Übersetzte Kanalnamen für Zeilen ohne `ota_name` — dieselbe Karte wie
   *  beim Download, damit Vorschau und PDF denselben Text zeigen. */
  kanalLabels?: Record<string, string>;
}) {
  const t = useTranslations("ownerStatements");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const html = buildStatementHtml(statement, locale, { kanalLabels });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[min(56rem,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <DialogPrimitive.Title className="font-display text-lg font-extrabold">
              {t("previewTitle")}
            </DialogPrimitive.Title>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void downloadStatementPdf(statement, locale, { kanalLabels })
                    .catch(() => toast.error(t("downloadFailed")))
                    .finally(() => setBusy(false));
                }}
              >
                <Icon icon="ph:download-simple" className="size-4" />
                {t("download")}
              </Button>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" aria-label={t("close")}>
                  <Icon icon="ph:x" className="size-5" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>
          {/* A4-Beleg in der grauen Bühne — identisch zur späteren PDF-Ausgabe. */}
          <div className="flex-1 overflow-auto bg-secondary/40 p-6">
            <iframe
              title={t("previewTitle")}
              srcDoc={html}
              className="mx-auto block h-[60rem] w-full max-w-[50rem] rounded-(--radius) border border-border bg-white shadow-sm"
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
