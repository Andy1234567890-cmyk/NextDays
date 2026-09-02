// Auszahlungen mit Gutschrift (Self-Billing) zum Herunterladen.
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { GutschriftKnopf } from "@/components/gutschrift-knopf";
import { betrag, datum } from "@/lib/format";
import { getAuszahlungen, getMe } from "@/lib/partner";

export default async function AuszahlungenSeite() {
  const [t, locale, me] = await Promise.all([getTranslations("auszahlungen"), getLocale(), getMe()]);
  if (!me || me.status !== "approved") redirect("/");
  const liste = await getAuszahlungen();

  return (
    <div>
      <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("hinweis")}</p>
      {!me.payout_method && (
        <p className="mt-4 rounded-2xl border border-border bg-muted px-5 py-3 text-sm">{t("kein_weg")}</p>
      )}
      {liste.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{t("leer")}</p>
      ) : (
        <>
        <ul className="mt-6 space-y-3 md:hidden">
          {liste.items.map((z) => (
            <li key={z.id} className="rounded-2xl border border-border p-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs">{z.statement_no ?? "—"}</span>
                <span className="font-semibold tabular-nums">{betrag({ amount: z.amount, currency: z.currency }, locale)}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {datum(z.period_from, locale)} – {datum(z.period_to, locale)}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>
                  {t(`status.${z.status}`)}
                  {z.paid_at && <span className="text-muted-foreground"> · {datum(z.paid_at, locale)}</span>}
                </span>
                <GutschriftKnopf payoutId={z.id} name={z.statement_no ?? z.id} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">{t("spalte.nummer")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.zeitraum")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.betrag")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.status")}</th>
                <th className="pb-2 font-semibold">{t("spalte.gutschrift")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liste.items.map((z) => (
                <tr key={z.id}>
                  <td className="py-3 pr-4 font-mono text-xs">{z.statement_no ?? "—"}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {datum(z.period_from, locale)} – {datum(z.period_to, locale)}
                  </td>
                  <td className="py-3 pr-4 font-medium">{betrag({ amount: z.amount, currency: z.currency }, locale)}</td>
                  <td className="py-3 pr-4">
                    {t(`status.${z.status}`)}
                    {z.paid_at && <span className="text-muted-foreground"> · {datum(z.paid_at, locale)}</span>}
                  </td>
                  <td className="py-3">
                    <GutschriftKnopf payoutId={z.id} name={z.statement_no ?? z.id} />
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
