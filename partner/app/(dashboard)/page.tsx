// Übersicht: Rang, Weg zum nächsten Rang, Kennzahlen, Links. Bewerber sehen
// nur ihren Status (das Dashboard verlangt `approved`, der Server auch).
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { CodeKarte } from "@/components/code-karte";
import { betraege, prozent } from "@/lib/format";
import { getDashboard, getMe } from "@/lib/partner";

export default async function UebersichtSeite() {
  const [t, locale, me] = await Promise.all([getTranslations("uebersicht"), getLocale(), getMe()]);
  if (!me || me.status !== "approved") {
    return (
      <div>
        <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titelBewerber")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("textBewerber")}</p>
        <Link href="/profil" className="mt-6 inline-block rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-foreground">
          {t("zumProfil")}
        </Link>
      </div>
    );
  }
  const d = await getDashboard();
  const k = d.kennzahlen;
  const leer = t("keineBetraege");

  const kacheln = [
    { key: "klicks", wert: String(k.clicks_30d) },
    { key: "registrierungen", wert: String(k.registrations) },
    { key: "zahlend", wert: String(k.paying_customers) },
    { key: "offen", wert: betraege(k.pending, locale, leer) },
    { key: "auszahlbar", wert: betraege(k.approved, locale, leer) },
    { key: "ausgezahlt", wert: betraege(k.paid, locale, leer) },
    { key: "team", wert: betraege(k.team_override, locale, leer), hinweis: t("kachel.teamHinweis", { n: k.team_size }) },
    { key: "struktur", wert: String(k.structure_customers), hinweis: t("kachel.strukturHinweis") },
    { key: "super", wert: betraege(k.lifetime, locale, leer), hinweis: t("kachel.superHinweis", { satz: prozent(d.tier.lifetime_rate, locale) }) },
    { key: "turbo", wert: betraege(k.booking_share, locale, leer), hinweis: t("kachel.turboHinweis") },
    { key: "bonus", wert: betraege(k.bonus, locale, leer), hinweis: t("kachel.bonusHinweis") },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titel", { name: me.full_name })}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("rang", { rang: d.tier.name, satz: prozent(d.tier.rate, locale) })}
            {d.next_tier &&
              ` · ${t("naechsterRang", { fehlend: d.next_tier.missing_customers, rang: d.next_tier.tier.name, satz: prozent(d.next_tier.tier.rate, locale) })}`}
          </p>
        </div>
        <Link href="/links" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
          {t("linksTeilen")}
        </Link>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kacheln.map((x) => (
          <div key={x.key} className="rounded-2xl border border-border p-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`kachel.${x.key}`)}</dt>
            <dd className="mt-2 text-2xl font-bold tracking-tight">{x.wert}</dd>
            {"hinweis" in x && x.hinweis && <p className="mt-1 text-xs text-muted-foreground">{x.hinweis}</p>}
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("deineLinks")}</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {d.codes.map((c) => (
            <CodeKarte key={c.id} code={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
