// Tracking eines Partners: Klicks (7/30/90 Tage, je Tag, je Code, Herkunft)
// und Reichweite (Selbstauskunft je Kanal). Die Balken sind reines CSS — kein
// Chart-Paket für 30 Zahlen. Dient der Prüfung: passen angegebene Reichweite
// und tatsächliche Klicks zusammen?
import { KanalIcon } from "@/components/kanal-icon";
import { PLATTFORM_META, reichweite } from "@/lib/kanaele";
import type { Tracking } from "@/lib/partner";

function Kachel({ label, wert, hinweis }: { label: string; wert: string; hinweis?: string }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{wert}</p>
      {hinweis && <p className="mt-0.5 text-xs text-muted-foreground">{hinweis}</p>}
    </div>
  );
}

const zahl = (n: number) => new Intl.NumberFormat("de").format(n);
const betraege = (b: { amount: string; currency: string }[]) =>
  b.length ? b.map((x) => `${Number(x.amount).toFixed(2)} ${x.currency}`).join(" · ") : "—";

// Flag → Klartext (Betrugsprüfung: Referral-Flags aus attribution.py, Team-Flags aus 0520).
const FLAG_TEXT: Record<string, string> = {
  self_referral: "Selbstwerbung (eigene E-Mail)",
  same_email_domain: "gleiche E-Mail-Domain",
  disposable_email: "Wegwerf-Adresse",
  click_cluster: "Klick-Häufung (gleiches Gerät/Netz)",
  registration_burst: "viele Registrierungen in 24 h",
  no_property_30d: "Betrieb 30 Tage ohne Objekt",
  same_iban: "gleiche IBAN",
};
const tagKurz = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
};

export function PartnerTracking({ tracking }: { tracking: Tracking }) {
  const t = tracking;
  const max = Math.max(1, ...t.clicks_by_day.map((d) => d.clicks));
  const konversion = t.conversion_90d === null ? "—" : `${(t.conversion_90d * 100).toFixed(1).replace(".", ",")} %`;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tracking · Aufrufe und Reichweite</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kachel label="Klicks 7 Tage" wert={zahl(t.clicks_7d)} />
        <Kachel label="Klicks 30 Tage" wert={zahl(t.clicks_30d)} />
        <Kachel label="Klicks 90 Tage" wert={zahl(t.clicks_90d)} hinweis="Klicks werden 90 Tage aufbewahrt" />
        <Kachel label="Registrierungen" wert={zahl(t.registrations)} hinweis={`${zahl(t.registrations_30d)} in 30 Tagen`} />
        <Kachel label="Zahlende Kunden" wert={zahl(t.paying_customers)} />
        <Kachel label="Conversion 90 T." wert={konversion} hinweis="Registrierungen ÷ Klicks" />
        <Kachel label="Reichweite" wert={t.reach_total ? reichweite(t.reach_total) : "—"} hinweis="Follower, Selbstauskunft" />
      </div>

      {(t.team_size > 0 || t.sponsor_flags.length > 0 || t.referral_flags.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kachel label="Team-Partner" wert={zahl(t.team_size)} />
          <Kachel label="Team-Umsatz 30 / 90 T." wert={betraege(t.team_revenue_30d)} hinweis={betraege(t.team_revenue_90d)} />
          <Kachel label="Team-Override 30 / 90 T." wert={betraege(t.override_30d)} hinweis={betraege(t.override_90d)} />
          <div className="rounded-2xl border border-border p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Betrugsflags</p>
            {t.sponsor_flags.length === 0 && t.referral_flags.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">keine</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs">
                {t.sponsor_flags.map((f) => (
                  <li key={f} className="text-accent">Team: {FLAG_TEXT[f] ?? f}</li>
                ))}
                {t.referral_flags.map((f) => (
                  <li key={f.name}>{FLAG_TEXT[f.name] ?? f.name} · {zahl(f.clicks)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Klicks je Tag · 30 Tage</p>
          {t.clicks_30d === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Noch keine Klicks in den letzten 30 Tagen.</p>
          ) : (
            <div className="mt-4 flex h-32 items-end gap-[2px]" role="img" aria-label="Klicks je Tag">
              {t.clicks_by_day.map((d) => (
                <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${tagKurz(d.day)} · ${d.clicks} Klicks`}>
                  <div
                    className={`w-full rounded-t ${d.clicks ? "bg-foreground" : "bg-muted"}`}
                    style={{ height: `${Math.max(d.clicks ? 6 : 2, Math.round((d.clicks / max) * 100))}%` }}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
            <span>{tagKurz(t.clicks_by_day[0]?.day ?? "")}</span>
            <span>{tagKurz(t.clicks_by_day[t.clicks_by_day.length - 1]?.day ?? "")}</span>
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Je Code</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                <th className="pb-1 pr-3 font-semibold">Code</th>
                <th className="pb-1 pr-3 text-right font-semibold">30 T.</th>
                <th className="pb-1 pr-3 text-right font-semibold">90 T.</th>
                <th className="pb-1 text-right font-semibold">Registr.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {t.codes.map((c) => (
                <tr key={c.code} className={c.active ? "" : "opacity-60"}>
                  <td className="py-1.5 pr-3">
                    <span className="font-mono text-xs">{c.code}</span>
                    {c.label && <span className="ml-2 text-muted-foreground">{c.label}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{zahl(c.clicks_30d)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{zahl(c.clicks_90d)}</td>
                  <td className="py-1.5 text-right tabular-nums">{zahl(c.registrations)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reichweite je Kanal</p>
            {t.reach.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Keine Kanäle angegeben.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border text-sm">
                {t.reach.map((k) => (
                  <li key={k.url} className="flex items-center gap-3 py-2">
                    <KanalIcon platform={k.platform} className="size-5" />
                    <a href={k.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                      {k.handle ? `@${k.handle}` : PLATTFORM_META[k.platform].label}
                    </a>
                    <span className="tabular-nums text-muted-foreground">{k.followers === null ? "—" : reichweite(k.followers)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Herkunft der Klicks · 90 Tage</p>
            {t.referrers.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Noch keine Klicks.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {t.referrers.map((r) => (
                  <li key={r.name} className="flex items-center justify-between gap-3">
                    <span className="truncate">{r.name}</span>
                    <span className="tabular-nums text-muted-foreground">{zahl(r.clicks)}</span>
                  </li>
                ))}
              </ul>
            )}
            {t.utm_sources.length > 0 && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">utm_source</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {t.utm_sources.map((r) => (
                    <li key={r.name} className="flex items-center justify-between gap-3">
                      <span className="truncate">{r.name}</span>
                      <span className="tabular-nums text-muted-foreground">{zahl(r.clicks)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
