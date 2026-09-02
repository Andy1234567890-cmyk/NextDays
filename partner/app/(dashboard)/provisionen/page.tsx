// Alle Provisionszeilen — Erträge, Gegenbuchungen, Korrekturen — mit Satz und
// Rang zum Buchungszeitpunkt.
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { betrag, datum, prozent } from "@/lib/format";
import { getMe, getProvisionen } from "@/lib/partner";

// Zeilen, die eine Basis tragen (Netto-Abo-Umsatz bzw. Buchungswert).
const MIT_BASIS = new Set(["earn", "override", "lifetime", "booking_share"]);

export default async function ProvisionenSeite() {
  const [t, locale, me] = await Promise.all([getTranslations("provisionen"), getLocale(), getMe()]);
  if (!me || me.status !== "approved") redirect("/");
  const liste = await getProvisionen();

  return (
    <div>
      <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("hinweis")}</p>
      {liste.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{t("leer")}</p>
      ) : (
        <>
        <ul className="mt-6 space-y-3 md:hidden">
          {liste.items.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border p-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {t(`art.${p.kind}`)} · {p.source_partner_name ? `${t("team")} ${p.source_partner_name}` : p.customer_label}
                </span>
                <span className="font-semibold tabular-nums">{betrag({ amount: p.amount, currency: p.currency }, locale)}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {datum(p.created_at, locale)}
                {MIT_BASIS.has(p.kind) && ` · ${t("spalte.basis")} ${betrag({ amount: p.base_amount, currency: p.currency }, locale)}`}
                {` · ${prozent(p.rate, locale)}`}
              </p>
              <p className="mt-1">
                {t(`status.${p.status}`)}
                {p.status === "pending" && p.matures_at && (
                  <span className="text-muted-foreground"> · {t("reifAm", { datum: datum(p.matures_at, locale) })}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-8 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">{t("spalte.datum")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.art")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.kunde")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.basis")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.satz")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.betrag")}</th>
                <th className="pb-2 font-semibold">{t("spalte.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liste.items.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 pr-4 text-muted-foreground">{datum(p.created_at, locale)}</td>
                  <td className="py-3 pr-4">{t(`art.${p.kind}`)}</td>
                  <td className="py-3 pr-4">
                    {p.source_partner_name ? `${t("team")} · ${p.source_partner_name}` : p.customer_label}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {MIT_BASIS.has(p.kind) ? betrag({ amount: p.base_amount, currency: p.currency }, locale) : "—"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{prozent(p.rate, locale)}</td>
                  <td className="py-3 pr-4 font-medium">{betrag({ amount: p.amount, currency: p.currency }, locale)}</td>
                  <td className="py-3">
                    {t(`status.${p.status}`)}
                    {p.status === "pending" && p.matures_at && (
                      <span className="text-muted-foreground"> · {t("reifAm", { datum: datum(p.matures_at, locale) })}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
