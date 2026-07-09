"use client";

// „Lernen"-Dialog (Lodgify): erklärt die Kontrollzentrum-Fläche in einem
// zentrierten Modal. Wiederverwendbar — der Button rendert selbst und öffnet den
// Dialog. Schließt per Escape, Klick aufs Overlay oder „Schließen". Der Inhalt
// wird als Kinder übergeben (Kontrollzentrum-Text vs. Objekt-Text).
import { Icon } from "@iconify/react";
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
        Lernen
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
                aria-label="Schließen"
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
                Schließen
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Der Kontrollzentrum-Erklärtext (Lodgify-Wortlaut, an unsere Begriffe angepasst:
// „Unterkünfte" statt „Vermietungen").
export function ControlCenterLearn() {
  return (
    <LearnButton title="Kontrollzentrum">
      <p>
        Willkommen im Kontrollzentrum. Es gibt Ihnen einen Überblick darüber, wie
        sich Ihr Unternehmen im Laufe der Zeit entwickelt. Wir haben es speziell so
        gestaltet, dass es so flexibel wie möglich ist. Sie können jeden beliebigen
        Zeitraum auswählen und auch nach den von Ihnen gewünschten Unterkünften
        filtern. Benutzen Sie die Auswahl der Unterkünfte oben rechts:
      </p>
      <p>
        <span className="font-semibold text-foreground">Tipp:</span> Wählen Sie
        einzelne Unterkünfte an oder ab. Mit „Alles zurücksetzen" sehen Sie wieder
        alle Objekte zusammengefasst.
      </p>
      <p>
        Die hier angezeigten Prozentsätze vergleichen die aktuelle Periode mit der
        unmittelbar vorhergehenden Periode. Stornierte Buchungen werden in der
        Stornierungsstatistik nicht doppelt gezählt. Informationen von gelöschten
        Unterkünften werden in keiner Grafik oder Tabelle angezeigt.
      </p>
      <p className="font-semibold text-foreground">Erweiterte Diagramme:</p>
      <p>
        Klicken Sie auf eine beliebige Kachel, um sie zu erweitern: Dort können Sie
        der Grafik bis zu vier vorangegangene Zeiträume hinzufügen und den Verlauf
        vergleichen. Die unter der Grafik angezeigten Prozentsätze beziehen sich auf
        den ausgewählten Zeitraum. Die darunter liegende Breakout-Tabelle zeigt die
        genauen Tageswerte jeder Periode.
      </p>
      <p>
        <span className="font-semibold text-foreground">Hinweis:</span> Änderungen
        an Buchungen erscheinen hier live über die Echtzeit-Aktualisierung.
      </p>
    </LearnButton>
  );
}
