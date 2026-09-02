"use client";

// Gutschrift herunterladen — über eine Server Action, weil das Token im
// httpOnly-Cookie liegt und den Browser nicht verlassen darf.
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { gutschriftLesen } from "@/lib/gutschrift-action";

export function GutschriftKnopf({ payoutId, name }: { payoutId: string; name: string }) {
  const t = useTranslations("auszahlungen");
  const [laeuft, starte] = useTransition();

  return (
    <button
      type="button"
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const res = await gutschriftLesen(payoutId);
          if (!res.ok) {
            toast.error(t("gutschriftFehler"));
            return;
          }
          const blob = new Blob([res.data], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${name}.txt`;
          a.click();
          URL.revokeObjectURL(url);
        })
      }
      className="text-xs font-semibold underline-offset-4 hover:underline disabled:opacity-50"
    >
      {t("gutschriftLaden")}
    </button>
  );
}
