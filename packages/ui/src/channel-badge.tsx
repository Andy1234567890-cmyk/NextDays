"use client";

// Kennzeichnung je Formularfeld: Wohin geht dieses Feld?
//
// Zwei Ausbaustufen, beide gültig:
//   1. grob  — `channel="ota" | "local"`: geht an die Portale / nur myBestDays.
//   2. genau — `kanaele={[...]}`: eine Zeile je Portal mit eigenem Status.
//
// Stufe 2 gibt es, weil die Wahrheit pro Feld UND Portal verschieden ist:
// Beschreibung und Fotos nimmt Airbnb sofort, Booking.com nur bei vollständiger
// Anbindung, und eine Gebühr, die ein Portal nicht kennt, verschwindet nicht —
// sie wandert still in den Nachtpreis. Wer das nicht sieht, pflegt ins Leere.
//
// Der Channel-Manager dahinter (Channex) wird bewusst NIE erwähnt — der Kunde
// sieht nur die Portale.
import { Icon } from "@iconify/react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

type Channel = "ota" | "local";

/** Status eines einzelnen Portals für dieses Feld. */
export type ChannelFieldStatus =
  | "voll"
  | "bedingt"
  | "portal"
  | "nein"
  // Keine belastbare Quelle — wird ehrlich als offen angezeigt statt geraten.
  | "unklar";

export type ChannelFieldRow = {
  /** Anzeigename des Portals, z. B. „Airbnb" (Eigenname, nicht übersetzt). */
  name: string;
  status: ChannelFieldStatus;
  /** Kurzer Grund in der Sprache des Nutzers, z. B. „nur als Festbetrag". */
  hinweis?: string;
};

// Standardtexte (deutsch). Über `label`/`hint` überschreibbar, z. B. für i18n.
const DEFAULTS: Record<Channel, { label: string; hint: string; icon: string }> = {
  ota: {
    label: "Booking, Airbnb & Co.",
    hint: "Dieses Feld wird an die Buchungsportale (Booking.com, Airbnb & Co.) übertragen und ist dort für Gäste sichtbar.",
    icon: "ph:globe-hemisphere-west",
  },
  local: {
    label: "Nur myBestDays",
    hint: "Dieses Feld gilt nur auf Ihrer myBestDays-Plattform und für Direktbuchungen — es wird nicht an die Buchungsportale übertragen.",
    icon: "ph:house-line",
  },
};

const STATUS_ICON: Record<ChannelFieldStatus, { icon: string; ton: string }> = {
  voll: { icon: "ph:check-circle-fill", ton: "text-success" },
  bedingt: { icon: "ph:warning-circle-fill", ton: "text-warning" },
  portal: { icon: "ph:arrow-square-out", ton: "text-muted-foreground" },
  nein: { icon: "ph:minus-circle", ton: "text-muted-foreground" },
  unklar: { icon: "ph:question", ton: "text-muted-foreground" },
};

export function ChannelBadge({
  channel,
  label,
  hint,
  kanaele,
  className = "",
}: {
  channel: Channel;
  label?: string;
  hint?: string;
  /** Eine Zeile je Portal — wenn gesetzt, zeigt der Tooltip die Aufschlüsselung. */
  kanaele?: ChannelFieldRow[];
  className?: string;
}) {
  const d = DEFAULTS[channel];
  const text = label ?? d.label;
  const help = hint ?? d.hint;
  const tone =
    channel === "ota"
      ? "border-accent/40 bg-accent/10 text-accent"
      : "border-border bg-secondary text-muted-foreground";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${text} – mehr Informationen`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium leading-none ${tone} ${className}`}
          >
            <Icon icon={d.icon} className="size-3" />
            {text}
            <Icon icon="ph:info" className="size-3 opacity-70" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {kanaele?.length ? (
            <ul className="flex flex-col gap-1.5">
              {kanaele.map((k) => {
                const s = STATUS_ICON[k.status];
                return (
                  <li key={k.name} className="flex items-start gap-2 text-xs">
                    <Icon
                      icon={s.icon}
                      className={`mt-0.5 size-3.5 shrink-0 ${s.ton}`}
                    />
                    <span>
                      <span className="font-semibold">{k.name}</span>
                      {k.hinweis ? (
                        <span className="opacity-80"> — {k.hinweis}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            help
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
