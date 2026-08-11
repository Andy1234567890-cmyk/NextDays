"use client";

// Massenaktualisierung des Posteingangs (alles bis Datum X als gelesen markieren
// oder archivieren). Aus `inbox-list.tsx` herausgelöst (reine Verschiebung).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import { bulkUpdate } from "@/lib/inbox";

// --- Massenaktualisierung (Dialog) ------------------------------------------
export function BulkUpdateDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  /** Der Server hat geschrieben — die Liste gehört neu geladen (welche Threads
   *  getroffen wurden, entscheidet allein er anhand des Datums). */
  onDone: () => void;
}) {
  const t = useTranslations("inbox");
  const [action, setAction] = useState<"read" | "archived">("read");
  const [before, setBefore] = useState("");
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!before) {
      setError(t("bulkDateRequired"));
      return;
    }
    setError(null);
    startBusy(async () => {
      const res = await bulkUpdate(action, before);
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-extrabold">{t("bulkUpdate")}</h3>
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium">{t("bulkMarkAs")}</label>
        <NativeSelect
          value={action}
          onChange={(e) => setAction(e.target.value as "read" | "archived")}
          className="mb-4 w-full"
        >
          <option value="read">{t("bulkRead")}</option>
          <option value="archived">{t("bulkArchived")}</option>
        </NativeSelect>

        <label className="mb-1 block text-sm font-medium">{t("bulkBefore")}</label>
        <input
          type="date"
          value={before}
          onChange={(e) => setBefore(e.target.value)}
          className="mb-4 w-full rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />

        {error && (
          <p className="mb-3 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" size="sm" onClick={confirm} disabled={busy}>
            {t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
