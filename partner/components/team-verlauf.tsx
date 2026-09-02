// 12-Monats-Verlauf: Team-Umsatz (Basis) und Team-Provision je Monat, reine CSS-Balken.
import { useTranslations } from "next-intl";

import type { Betrag, TeamMonat } from "@/lib/partner";
import { betraege } from "@/lib/format";

function summe(b: Betrag[]): number {
  return b.reduce((s, x) => s + Number(x.amount), 0);
}

export function TeamVerlauf({ monate, locale }: { monate: TeamMonat[]; locale: string }) {
  const t = useTranslations("team.verlauf");
  const max = Math.max(1, ...monate.map((m) => summe(m.override)));
  const leer = monate.every((m) => summe(m.override) === 0 && summe(m.revenue) === 0);
  return (
    <section className="mt-8 rounded-2xl border border-border p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("titel")}</p>
      {leer ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("leer")}</p>
      ) : (
        <>
          <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label={t("titel")}>
            {monate.map((m) => {
              const o = summe(m.override);
              return (
                <div
                  key={m.month}
                  className="flex h-full flex-1 flex-col justify-end"
                  title={`${m.month} · ${t("provision")} ${betraege(m.override, locale, "—")} · ${t("umsatz")} ${betraege(m.revenue, locale, "—")}`}
                >
                  <div className={`w-full rounded-t ${o ? "bg-foreground" : "bg-muted"}`} style={{ height: `${Math.max(o ? 6 : 2, Math.round((o / max) * 100))}%` }} />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
            <span>{monate[0]?.month}</span>
            <span>{monate[monate.length - 1]?.month}</span>
          </div>
        </>
      )}
    </section>
  );
}
