"use client";

// Beleg-Vorschau (Muster aus dem Buchhaltungs-/Finance-Modul: LivePreviewModal):
// zeigt die fertige Abrechnung als A4-Beleg in einem Dialog — exakt das HTML,
// das auch der PDF-Dienst rendert (buildStatementHtml) — bevor heruntergeladen
// oder finalisiert wird. Radix-Dialog im myNextDays-Stil (abgerundet, Tokens).
import { Icon } from "@iconify/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { belegTexte, type StatementPdfTexte } from "@/lib/beleg-texte";
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
  const [busy, setBusy] = useState(false);
  // Texte in der Sprache DES BELEGS (0604) — nicht `useLocale()` des
  // Betrachters. Geladen, sobald sich die Sprache des Statements ändert.
  const [texte, setTexte] = useState<StatementPdfTexte | null>(null);
  const [texteFehler, setTexteFehler] = useState<string | null>(null);
  useEffect(() => {
    let aktiv = true;
    setTexte(null);
    setTexteFehler(null);
    belegTexte(statement.language)
      .then((tx) => {
        if (aktiv) setTexte(tx);
      })
      .catch((e: unknown) => {
        if (aktiv) setTexteFehler(e instanceof Error ? e.message : String(e));
      });
    return () => {
      aktiv = false;
    };
  }, [statement.language]);
  const html = texte ? buildStatementHtml(statement, texte, { kanalLabels }) : null;
  const sprachName =
    LOCALE_LABELS[statement.language as Locale] ?? statement.language;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[min(56rem,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex flex-col">
              <DialogPrimitive.Title className="font-display text-lg font-extrabold">
                {t("previewTitle")}
              </DialogPrimitive.Title>
              {/* Hinweiszeile: der Beleg folgt der Sprache des Eigentümers,
                  die Oberfläche der des Betrachters — beide dürfen abweichen,
                  und das soll man sehen, nicht raten. */}
              <span className="text-xs text-muted-foreground">
                {t("belegIn", { sprache: sprachName })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !texte}
                onClick={() => {
                  if (!texte) return;
                  setBusy(true);
                  void downloadStatementPdf(statement, texte, { kanalLabels })
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
            {texteFehler ? (
              <p role="alert" className="text-sm text-destructive">{texteFehler}</p>
            ) : html ? (
              <iframe
                title={t("previewTitle")}
                srcDoc={html}
                className="mx-auto block h-[60rem] w-full max-w-[50rem] rounded-(--radius) border border-border bg-white shadow-sm"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
