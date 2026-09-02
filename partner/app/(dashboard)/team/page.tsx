// Team (0520): Team-Link, Auswertung je Team-Partner, Verlauf, Chat-Einstieg.
// Der Sponsor sieht, was sein Team umsetzt — nie die Kundendetails der Team-Partner.
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { TeamChatListe } from "@/components/team-chat-liste";
import { TeamLinkKarte } from "@/components/team-link-karte";
import { TeamVerlauf } from "@/components/team-verlauf";
import { betraege, datum, prozent } from "@/lib/format";
import { getMe, getTeam, getTeamThreads } from "@/lib/partner";

export default async function TeamSeite() {
  const [t, locale, me] = await Promise.all([getTranslations("team"), getLocale(), getMe()]);
  if (!me || me.status !== "approved") redirect("/");
  const [team, threads] = await Promise.all([getTeam(), getTeamThreads()]);
  const leer = "—";

  const kacheln = [
    { key: "mitglieder", wert: `${team.members_active} / ${team.members.length}` },
    { key: "teamKunden", wert: String(team.team_customers) },
    { key: "umsatz30", wert: betraege(team.revenue_30d, locale, leer) },
    { key: "offen", wert: betraege(team.override_pending, locale, leer) },
    { key: "auszahlbar", wert: betraege(team.override_approved, locale, leer) },
    { key: "ausgezahlt", wert: betraege(team.override_paid, locale, leer) },
  ];

  return (
    <div>
      <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("hinweis", { satz: prozent(team.own_rate, locale) })}</p>
      {!team.team_allowed && (
        <p className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {t("nochNichtErlaubt")}
        </p>
      )}

      {team.sponsor && (
        <p className="mt-4 rounded-2xl border border-border px-4 py-3 text-sm">
          {t("meinSponsor", { name: team.sponsor.company ?? team.sponsor.name })}
          {team.sponsor.joined_at && <span className="text-muted-foreground"> · {datum(team.sponsor.joined_at, locale)}</span>}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TeamLinkKarte link={team.team_link} />
        <div className="rounded-2xl border border-border p-5 text-sm text-muted-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide">{t("regeln.titel")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>{t("regeln.rang")}</li>
            <li>{t("regeln.ebene")}</li>
            <li>{t("regeln.keinGeld")}</li>
            <li>{t("regeln.dauer")}</li>
          </ul>
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kacheln.map((x) => (
          <div key={x.key} className="rounded-2xl border border-border p-5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`kachel.${x.key}`)}</dt>
            <dd className="mt-2 text-2xl font-bold tracking-tight">{x.wert}</dd>
          </div>
        ))}
      </dl>

      <TeamVerlauf monate={team.months} locale={locale} />

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("mitglieder.titel")}</h2>
      {team.members.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("mitglieder.leer")}</p>
      ) : (
        <>
          <ul className="mt-4 space-y-3 md:hidden">
            {team.members.map((m) => (
              <li key={m.affiliate_id} className="rounded-2xl border border-border p-4 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{m.company ?? m.name}</span>
                  <span className="font-semibold tabular-nums">{betraege(m.override_approved, locale, leer)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t(`status.${m.status}`)} · {m.tier.name} · {t("mitglieder.kunden", { n: m.paying_customers })}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {t("mitglieder.umsatz30")} {betraege(m.revenue_30d, locale, leer)} · {t("mitglieder.offen")} {betraege(m.override_pending, locale, leer)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-semibold">{t("spalte.partner")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("spalte.status")}</th>
                  <th className="pb-2 pr-4 font-semibold">{t("spalte.rang")}</th>
                  <th className="pb-2 pr-4 text-right font-semibold">{t("spalte.kunden")}</th>
                  <th className="pb-2 pr-4 text-right font-semibold">{t("spalte.umsatz30")}</th>
                  <th className="pb-2 pr-4 text-right font-semibold">{t("spalte.umsatzGesamt")}</th>
                  <th className="pb-2 pr-4 text-right font-semibold">{t("spalte.offen")}</th>
                  <th className="pb-2 pr-4 text-right font-semibold">{t("spalte.auszahlbar")}</th>
                  <th className="pb-2 text-right font-semibold">{t("spalte.ausgezahlt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {team.members.map((m) => (
                  <tr key={m.affiliate_id}>
                    <td className="py-3 pr-4">
                      <span className="font-medium">{m.company ?? m.name}</span>
                      {m.joined_at && <span className="block text-xs text-muted-foreground">{t("mitglieder.seit", { datum: datum(m.joined_at, locale) })}</span>}
                    </td>
                    <td className="py-3 pr-4">{t(`status.${m.status}`)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{m.tier.name}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{m.paying_customers}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">{betraege(m.revenue_30d, locale, leer)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">{betraege(m.revenue_total, locale, leer)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{betraege(m.override_pending, locale, leer)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums font-medium">{betraege(m.override_approved, locale, leer)}</td>
                    <td className="py-3 text-right tabular-nums">{betraege(m.override_paid, locale, leer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <TeamChatListe
        threads={threads}
        partner={[
          ...(team.sponsor ? [{ id: team.sponsor.affiliate_id, name: team.sponsor.company ?? team.sponsor.name, role: "sponsor" as const }] : []),
          ...team.members.map((m) => ({ id: m.affiliate_id, name: m.company ?? m.name, role: "member" as const })),
        ]}
      />
    </div>
  );
}
