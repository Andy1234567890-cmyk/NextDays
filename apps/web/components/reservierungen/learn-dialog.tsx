"use client";

// „Lernen"-Dialog (..): erklärt die Kontrollzentrum-Fläche in einem
// zentrierten Modal. Wiederverwendbar — der Button rendert selbst und öffnet den
// Dialog. Schließt per Escape, Klick aufs Overlay oder „Schließen". Der Inhalt
// wird als Kinder übergeben (Kontrollzentrum-Text vs. Objekt-Text).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function LearnButton({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("reservations");

  // Escape schließt (nur wenn offen — kein globaler Listener sonst).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Icon icon="ph:info" className="size-4" />
        {t("learnDialog.learnButton")}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            role="presentation"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-card shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <button
                type="button"
                aria-label={t("learnDialog.close")}
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
              >
                <Icon icon="ph:x" className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-muted-foreground">
              {children}
            </div>
            <div className="flex justify-end border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("learnDialog.close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Der Kontrollzentrum-Erklärtext (..-Wortlaut, an unsere Begriffe angepasst:
// „Unterkünfte" statt „Vermietungen").
export function ControlCenterLearn() {
  const t = useTranslations("reservations");

  return (
    <LearnButton title={t("learnDialog.controlCenterTitle")}>
      <p>{t("learnDialog.controlCenterIntro")}</p>
      <p>
        <span className="font-semibold text-foreground">
          {t("learnDialog.tipLabel")}
        </span>{" "}
        {t("learnDialog.controlCenterTip")}
      </p>
      <p>{t("learnDialog.controlCenterPercentages")}</p>
      <p className="font-semibold text-foreground">
        {t("learnDialog.expandedChartsLabel")}
      </p>
      <p>{t("learnDialog.expandedChartsBody")}</p>
      <p>
        <span className="font-semibold text-foreground">
          {t("learnDialog.noteLabel")}
        </span>{" "}
        {t("learnDialog.realtimeNote")}
      </p>
    </LearnButton>
  );
}
