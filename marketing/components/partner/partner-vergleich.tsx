// Die Staffel als Vergleichstabelle (Vorbild: lodgify.com/affiliates, 02.09.2026):
// Ränge als Pills in der Kopfzeile, darunter Provision, Team-Provision und die
// Leistungen mit Haken. Zahlen kommen LIVE aus /affiliates/tiers (Wurzel 4);
// Leistungen sind nur solche, die es wirklich gibt — kein erfundener Bonus.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { type Rang, bonusText, prozent } from "@/lib/partner";

// ab welchem Rang (Index) eine Leistung gilt — 0 = alle.
const LEISTUNGEN: { key: string; ab: number }[] = [
  { key: "konto", ab: 0 },
  { key: "dashboard", ab: 0 },
  { key: "material", ab: 0 },
  { key: "team", ab: 1 },
  { key: "gutschrift", ab: 0 },
  { key: "chat", ab: 0 },
  { key: "support", ab: 1 },
  { key: "coMarketing", ab: 2 },
];

export function PartnerVergleich({ staffel }: { staffel: Rang[] | null }) {
  const t = useTranslations("partner.vergleich");

  if (staffel === null) {
    return (
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />
          <p className="mt-10 text-center text-muted-foreground">{t("nichtAbrufbar")}</p>
        </div>
      </section>
    );
  }

  const kopf = (label: string) => (
    <tr>
      <th scope="row" className="py-6 pr-6 text-left font-display text-2xl font-extrabold tracking-tight">
        {label}
      </th>
      {staffel.map((r) => (
        <th key={r.id} scope="col" className="px-3 py-6 text-center">
          <span className="inline-block rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
            {r.name}
          </span>
          <span className="mt-2 block text-xs font-normal text-muted-foreground">
            {r.max_customers === null
              ? t("kundenOffen", { von: r.min_customers })
              : t("kunden", { von: r.min_customers, bis: r.max_customers })}
          </span>
        </th>
      ))}
    </tr>
  );

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />
        <div className="mt-12 overflow-x-auto rounded-[2rem] bg-surface-warm px-6 py-4 sm:px-10">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>{kopf(t("plan"))}</thead>
            <tbody className="divide-y divide-border/70">
              <tr>
                <th scope="row" className="py-5 pr-6 text-left font-normal text-muted-foreground">{t("provision")}</th>
                {staffel.map((r) => (
                  <td key={r.id} className="px-3 py-5 text-center text-lg font-semibold tabular-nums">
                    {prozent(r.rate)} %
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-5 pr-6 text-left font-normal text-muted-foreground">
                  {t("teamProvision")}
                  <span className="ml-1 align-super text-xs">*</span>
                </th>
                {staffel.map((r) => (
                  <td key={r.id} className="px-3 py-5 text-center text-sm text-muted-foreground">
                    {r.team_allowed ? t("teamDifferenz", { satz: prozent(r.rate) }) : t("teamNicht")}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-5 pr-6 text-left font-normal text-muted-foreground">{t("bonus")}</th>
                {staffel.map((r) => (
                  <td key={r.id} className="px-3 py-5 text-center text-lg font-semibold tabular-nums">
                    {bonusText(r) ?? <span className="text-muted-foreground">–</span>}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-5 pr-6 text-left font-normal text-muted-foreground">
                  {t("superProvision")}
                  <span className="ml-1 align-super text-xs">***</span>
                </th>
                {staffel.map((r) => (
                  <td key={r.id} className="px-3 py-5 text-center text-lg font-semibold tabular-nums">
                    {Number(r.lifetime_rate) > 0 ? `${prozent(r.lifetime_rate)} %` : <span className="text-muted-foreground">–</span>}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-5 pr-6 text-left font-normal text-muted-foreground">{t("marktTurbo")}</th>
                {staffel.map((r) => (
                  <td key={r.id} className="px-3 py-5 text-center text-muted-foreground">{t("marktTurboWert")}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-5 pr-6 text-left font-normal text-muted-foreground">{t("dauer")}</th>
                {staffel.map((r) => (
                  <td key={r.id} className="px-3 py-5 text-center text-muted-foreground">{t("dauerWert")}</td>
                ))}
              </tr>
            </tbody>
            <thead>{kopf(t("vorteile"))}</thead>
            <tbody className="divide-y divide-border/70">
              {LEISTUNGEN.map((l) => (
                <tr key={l.key}>
                  <th scope="row" className="py-5 pr-6 text-left font-normal text-muted-foreground">
                    {t(`leistung.${l.key}`)}
                    {l.key === "coMarketing" && <span className="ml-1 align-super text-xs">**</span>}
                  </th>
                  {staffel.map((r, i) => (
                    <td key={r.id} className="px-3 py-5 text-center">
                      {i >= l.ab ? (
                        <Icon icon="ph:check-bold" className="mx-auto size-5" aria-label={t("ja")} />
                      ) : (
                        <span className="text-muted-foreground" aria-label={t("nein")}>–</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-8 space-y-1 pb-4 text-xs text-muted-foreground">
            <p>* {t("fussnoteTeam")}</p>
            <p>** {t("fussnoteCoMarketing")}</p>
            <p>*** {t("fussnoteSuper")}</p>
            <p>{t("fussnoteRang")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
