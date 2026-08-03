"use client";

// Gemeinsame Editor-Bausteine der Objekt-Formulare (Verfügbarkeit, Richtlinien,
// Preise, Standort): Sheet-Hülle, Speichern-Hook, Fußzeile, Hinweis-Box, Pill,
// Feld, Leer-Zustand, Kanal-Logos. Eine Quelle statt Kopien pro Formular.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Label } from "@nextdays/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import {
  type Channel,
  CHANNEL_LABELS,
  CHANNEL_LOGOS,
} from "@/lib/availability-meta";

// Ein einzelnes Kanal-Logo (Iconify-Icon ODER lokales SVG via <img>).
export function ChannelLogo({ channel, big }: { channel: Channel; big?: boolean }) {
  const logo = CHANNEL_LOGOS[channel];
  const cls = big ? "size-4" : "size-3.5";
  if (logo.kind === "img") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo.src} alt={CHANNEL_LABELS[channel]} className={`${cls} rounded-sm`} />;
  }
  return <Icon icon={logo.icon} className={cls} />;
}

// Kanal-Logos als kleine Badges (echte Marken-Logos).
export function ChannelIcons({ channels }: { channels: Channel[] }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1 align-middle">
      {channels.map((c) => (
        <span key={c} title={CHANNEL_LABELS[c]} className="inline-flex">
          <ChannelLogo channel={c} />
        </span>
      ))}
    </span>
  );
}

// Slide-over-Hülle für Block-Editoren: Kopf (+ optionale Kanal-Zeile),
// scrollbarer Inhalt, Fußzeile.
export function EditorShell({
  title,
  subtitle,
  channels,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  channels?: Channel[];
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("objects");
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        // Das Google-Places-Autocomplete-Dropdown (.pac-container) hängt am
        // <body>, also AUSSERHALB des Sheets. Ohne diese Ausnahme wertet Radix
        // den Klick auf einen Adressvorschlag als „außerhalb“, verschluckt ihn
        // und schließt/blockiert — das Auswahl-Event feuert dann nie und die
        // Adressfelder bleiben leer. Klicks aufs .pac-container zulassen.
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest(".pac-container")) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest(".pac-container")) e.preventDefault();
        }}
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle className="font-display text-xl font-extrabold">{title}</SheetTitle>
          <SheetDescription className={subtitle ? "" : "sr-only"}>
            {subtitle ?? title}
          </SheetDescription>
          {channels && (
            <p className="flex items-center text-sm text-muted-foreground">
              {t("editorPrimitives.appliesTo")} <ChannelIcons channels={channels} />
            </p>
          )}
        </SheetHeader>
        {/* min-h-0 ist entscheidend, damit der Bereich scrollt statt zu wachsen */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">{children}</div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t p-4">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}

// Speichern-Hook: busy/error um eine (ggf. mehrargumentige) Save-Funktion.
export function useSaver<A extends unknown[]>(
  save: (...args: A) => Promise<true | string>,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(...args: A) {
    setBusy(true);
    setError(null);
    const r = await save(...args);
    setBusy(false);
    if (r !== true) setError(r);
  }
  return { busy, error, run };
}

// Standard-Fußzeile: Abbrechen + Speichern.
export function Footer({
  busy,
  error,
  onCancel,
  onSave,
  saveLabel,
  disabled,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("objects");
  return (
    <div className="flex w-full items-center gap-3">
      {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
      <Button variant="ghost" onClick={onCancel} disabled={busy} className={error ? "" : "ml-auto"}>
        {t("editorPrimitives.cancel")}
      </Button>
      <Button onClick={onSave} disabled={busy || disabled}>
        {busy ? t("editorPrimitives.saving") : (saveLabel ?? t("editorPrimitives.save"))}
      </Button>
    </div>
  );
}

// Info-Hinweis-Box.
export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-(--radius) bg-secondary p-3 text-sm text-muted-foreground">
      <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// Wert-Pill.
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-muted/60 px-3 py-1.5 text-sm">
      {children}
    </span>
  );
}

// Label + Eingabe, optional mit Pflicht-Stern.
export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: React.ReactNode;
  required?: boolean;
  /** Erklärender Text unter dem Feld (optional). */
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Leer-Zustand-Text.
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground/70">{children}</p>;
}
