"use client";

// Read-only-Abschnitt für strukturierte Werte aus type_attributes (Airbnb-Stil):
// große Überschrift + eine Werteliste (Label · Wert) in einer Karte. Zeilen ohne
// Wert werden weggelassen; ist gar nichts da, „Noch nicht hinterlegt" (kein Fake).
import { useTranslations } from "next-intl";

export type AttributRow = { label: string; wert: string | null };

export function AttributPanel({
  titel,
  rows,
}: {
  titel: string;
  rows: AttributRow[];
}) {
  const t = useTranslations("objektEditor");
  const gesetzt = rows.filter((r) => r.wert != null && r.wert !== "");

  return (
    <section className="max-w-2xl">
      <h2 className="mb-6 font-sans text-[2rem] font-bold tracking-tight">{titel}</h2>
      <div className="rounded-2xl border border-border p-6">
        {gesetzt.length === 0 ? (
          <p className="text-[0.9375rem] text-muted-foreground">{t("noch")}</p>
        ) : (
          <dl className="divide-y divide-border">
            {gesetzt.map((r) => (
              <div
                key={r.label}
                className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <dt className="text-[0.9375rem] text-muted-foreground">{r.label}</dt>
                <dd className="text-[0.9375rem] font-medium text-foreground">
                  {r.wert}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
