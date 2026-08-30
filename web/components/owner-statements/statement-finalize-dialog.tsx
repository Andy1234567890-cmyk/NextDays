"use client";

// Doppelbestätigung vor dem Festschreiben.
//
// Warum überhaupt: Finalisieren vergibt eine fortlaufende, unveränderbare
// Rechnungsnummer UND macht den Beleg für den Eigentümer sichtbar. Ein
// Fehlklick ist damit eine falsche Rechnung beim Eigentümer — rückgängig nur
// noch über einen Storno-Beleg, der die falsche Rechnung dokumentiert.
//
// Warum die Zahl getippt wird und kein „Wirklich?"-Haken: ein Bestätigungs-
// dialog, den man wegklickt, ohne zu lesen, ist keine zweite Prüfung. Wer den
// Betrag abtippt, hat ihn gelesen. Genau dieser Betrag geht an den Server, der
// ihn gegen den frisch berechneten Stand hält (409 bei Abweichung).
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { formatCurrency } from "@/lib/currency";

/** Tippfassung → Zahl. Akzeptiert beide Dezimaltrenner und die
 *  Tausenderpunkte aus der angezeigten Formatierung, damit ein abgetippter
 *  Betrag („13.988,28") nicht deshalb scheitert, weil der Nutzer ihn genau so
 *  übernommen hat, wie er dasteht. */
function zahlAusEingabe(text: string): number | null {
  const roh = text.trim().replace(/\s/g, "");
  if (!roh) return null;
  // Letzter Trenner ist der Dezimaltrenner; alles davor sind Tausendertrenner.
  const letzterKomma = roh.lastIndexOf(",");
  const letzterPunkt = roh.lastIndexOf(".");
  const dez = Math.max(letzterKomma, letzterPunkt);
  let normalisiert: string;
  if (dez === -1) {
    normalisiert = roh;
  } else {
    const vor = roh.slice(0, dez).replace(/[.,]/g, "");
    const nach = roh.slice(dez + 1);
    normalisiert = `${vor}.${nach}`;
  }
  const n = Number(normalisiert);
  return Number.isFinite(n) ? n : null;
}

export function StatementFinalizeDialog({
  open,
  onOpenChange,
  betrag,
  waehrung,
  ownerName,
  busy,
  onBestaetigt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Die Eigentümer-Auszahlung, wie sie in der Abrechnung steht. */
  betrag: number;
  waehrung: string;
  ownerName: string | null;
  busy: boolean;
  onBestaetigt: (betrag: number, waehrung: string) => void;
}) {
  const t = useTranslations("ownerStatements.finalizeConfirm");
  const locale = useLocale();
  const [eingabe, setEingabe] = useState("");

  // Bei jedem Öffnen leeren: eine stehengebliebene Eingabe aus dem letzten
  // Versuch würde die zweite Stufe zur Attrappe machen.
  useEffect(() => {
    if (open) setEingabe("");
  }, [open]);

  const getippt = zahlAusEingabe(eingabe);
  // Cent-genau vergleichen — dieselbe Regel wie im Backend.
  const stimmt = getippt !== null && Math.round(getippt * 100) === Math.round(betrag * 100);
  const angezeigt = formatCurrency(betrag, waehrung, locale);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[min(32rem,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <div className="border-b border-border px-5 py-3">
            <DialogPrimitive.Title className="font-display text-lg font-extrabold">
              {t("title")}
            </DialogPrimitive.Title>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            <p className="text-sm text-muted-foreground">
              {t("what", { owner: ownerName ?? t("theOwner") })}
            </p>

            <div className="rounded-(--radius) border border-border bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">{t("amountLabel")}</div>
              <div className="font-display text-2xl font-extrabold tabular-nums">
                {angezeigt}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="finalize-betrag">
                {t("typeLabel")}
              </label>
              <Input
                id="finalize-betrag"
                inputMode="decimal"
                autoComplete="off"
                value={eingabe}
                onChange={(e) => setEingabe(e.target.value)}
                aria-invalid={eingabe.length > 0 && !stimmt}
                aria-describedby="finalize-hinweis"
              />
              <p id="finalize-hinweis" className="text-xs text-muted-foreground">
                {eingabe.length > 0 && !stimmt ? t("mismatch") : t("typeHint")}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">{t("irreversible")}</p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <DialogPrimitive.Close asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                {t("cancel")}
              </Button>
            </DialogPrimitive.Close>
            <Button
              size="sm"
              disabled={!stimmt || busy}
              onClick={() => onBestaetigt(betrag, waehrung)}
            >
              {busy ? t("working") : t("confirm")}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
