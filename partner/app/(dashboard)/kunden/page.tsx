// Geworbene Betriebe — PSEUDONYM. Kein Name, keine E-Mail (Datenminimierung;
// der Partner braucht Status, Zeitpunkte und Beträge, nicht die Identität).
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { betraege, datum } from "@/lib/format";
import { getKunden, getMe } from "@/lib/partner";

export default async function KundenSeite() {
  const [t, locale, me] = await Promise.all([getTranslations("kunden"), getLocale(), getMe()]);
  if (!me || me.status !== "approved") redirect("/");
  const liste = await getKunden();

  return (
    <div>
      <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("hinweis")}</p>
      {liste.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{t("leer")}</p>
      ) : (
        <>
        <ul className="mt-6 space-y-3 md:hidden">
          {liste.items.map((k) => (
            <li key={k.id} className="rounded-2xl border border-border p-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{t("kunde", { n: k.label })} · {k.country ?? "—"}</span>
                <span className="font-semibold tabular-nums">{betraege(k.earned, locale, "—")}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {t(`status.${k.status}`)} · {t("spalte.registriert")} {datum(k.registered_at, locale)}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t("spalte.provisionBis")} {datum(k.commission_until, locale)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-8 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">{t("spalte.kunde")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.land")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.status")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.registriert")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("spalte.provisionBis")}</th>
                <th className="pb-2 font-semibold">{t("spalte.verdient")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liste.items.map((k) => (
                <tr key={k.id}>
                  <td className="py-3 pr-4 font-medium">{t("kunde", { n: k.label })}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{k.country ?? "—"}</td>
                  <td className="py-3 pr-4">{t(`status.${k.status}`)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{datum(k.registered_at, locale)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{datum(k.commission_until, locale)}</td>
                  <td className="py-3 font-medium">{betraege(k.earned, locale, "—")}</td>
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
