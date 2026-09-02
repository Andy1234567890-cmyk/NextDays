// Die Staffel — aus der API, nie als Zahl im Text (Wurzel 4).
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { type Rang, prozent } from "@/lib/partner";

export function PartnerStaffel({ staffel }: { staffel: Rang[] | null }) {
  const t = useTranslations("partner.staffel");

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />
        {staffel === null ? (
          <p className="mt-10 text-center text-muted-foreground">{t("nichtAbrufbar")}</p>
        ) : (
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {staffel.map((r, i) => {
              const hoechster = i === staffel.length - 1;
              return (
                <li
                  key={r.id}
                  className={
                    "rounded-3xl border p-7 " +
                    (hoechster ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background")
                  }
                >
                  <p className={"text-sm font-semibold uppercase tracking-wide " + (hoechster ? "text-accent-foreground/80" : "text-muted-foreground")}>
                    {r.name}
                  </p>
                  <p className="mt-3 font-display text-5xl font-extrabold tracking-tight">
                    {prozent(r.rate)}
                    <span className="text-2xl"> %</span>
                  </p>
                  <p className={"mt-1 text-sm " + (hoechster ? "text-accent-foreground/80" : "text-muted-foreground")}>
                    {t("satz")}
                  </p>
                  <p className="mt-5 text-sm font-medium">
                    {r.max_customers === null
                      ? t("kundenOffen", { von: r.min_customers })
                      : t("kunden", { von: r.min_customers, bis: r.max_customers })}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
