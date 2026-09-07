"use client";

// Inline-Edit-Zeile im Airbnb-Kontoeinstellungen-Muster: Label + aktueller
// Wert + „Bearbeiten"/„Hinzufügen"-Link rechts. Beim Öffnen klappt das
// Edit-Feld (children als Render-Prop) inline auf, Speichern/Abbrechen darunter.
// Nur EINE Zeile im Abschnitt ist gleichzeitig offen (offen-State liegt beim
// Abschnitt), andere Zeilen werden dann ausgegraut — aber ihr „Bearbeiten"/
// „Hinzufügen" bleibt KLICKBAR und wechselt die offene Zeile. Vorher lag
// `pointer-events-none` auf der ganzen Zeile: wer bei offener Währung die
// Zeitzone anklickte, bekam nichts — kein Öffnen, keine Rückmeldung — und
// meldete „die Zeitzone kann man nicht einstellen" (05.09.2026).
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function KontoZeile({
  label,
  value,
  hint,
  hasValue,
  open,
  dimmed,
  onOpen,
  onClose,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  hasValue: boolean;
  open: boolean;
  dimmed: boolean;
  onOpen: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("konto");

  return (
    <div
      className={`border-b border-border py-6 transition-opacity last:border-0 ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium">{label}</p>
        <button
          type="button"
          onClick={open ? onClose : onOpen}
          className="shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-70 focus-visible:ring-2 focus-visible:ring-foreground/20 outline-none"
        >
          {open ? t("abbrechen") : hasValue ? t("bearbeiten") : t("hinzufuegen")}
        </button>
      </div>

      {open ? (
        <div className="mt-4">{children}</div>
      ) : (
        <>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">{value}</p>
          {hint && (
            <p className="mt-1 max-w-lg text-sm text-muted-foreground/80">
              {hint}
            </p>
          )}
        </>
      )}
    </div>
  );
}
