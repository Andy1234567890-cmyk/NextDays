"use client";

// Die drei Reiter AKTUELL · BEVORSTEHENDE · ABGESCHLOSSEN. Von „Meine Aufgaben"
// und „Teamaufgaben" geteilt, damit beide Flächen dieselben Buckets benutzen —
// die Einteilung ist zeitlich, nicht nach Status (siehe `_filter_bucket` im
// Backend).
import { useTranslations } from "next-intl";

const BUCKETS = ["current", "upcoming", "done"] as const;

export function AufgabenReiter({
  value,
  onChange,
}: {
  value: string;
  onChange: (bucket: string) => void;
}) {
  const t = useTranslations("reservations");
  return (
    <div className="flex gap-1 border-b">
      {BUCKETS.map((bucket) => (
        <button
          key={bucket}
          type="button"
          onClick={() => onChange(bucket)}
          className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${
            value === bucket
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(`aufgabenReiter.${bucket}`)}
        </button>
      ))}
    </div>
  );
}
