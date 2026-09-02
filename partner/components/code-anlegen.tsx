"use client";

// Weiteren Code anlegen (z. B. je Kanal), optional als Wunschcode.
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { codeAnlegen } from "@/lib/partner-actions";

export function CodeAnlegen() {
  const t = useTranslations("links");
  const [laeuft, starte] = useTransition();
  const [offen, setOffen] = useState(false);
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");

  if (!offen) {
    return (
      <button type="button" onClick={() => setOffen(true)} className="mt-4 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-foreground">
        {t("neuerCode")}
      </button>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-border p-4">
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("label")}
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} className="rounded-full border border-border bg-transparent px-4 py-2 text-sm normal-case tracking-normal outline-none focus-visible:border-foreground" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("wunschcode")}
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={31} placeholder="ANNA-INSTA" className="rounded-full border border-border bg-transparent px-4 py-2 font-mono text-sm tracking-normal outline-none focus-visible:border-foreground" />
      </label>
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            const res = await codeAnlegen(label.trim() || null, code.trim() || null);
            if (res.ok) {
              toast.success(t("codeAngelegt"));
              setOffen(false);
              setLabel("");
              setCode("");
            } else toast.error(res.status === 409 ? t("codeVergeben") : t("fehler"));
          })
        }
        className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
      >
        {t("anlegen")}
      </button>
      <button type="button" onClick={() => setOffen(false)} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {t("abbrechen")}
      </button>
    </div>
  );
}
