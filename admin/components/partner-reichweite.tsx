// Reichweite eines Partners (0521): je Kanal verifizierter Wert NEBEN der
// Selbstauskunft, Follower-Verlauf 90 Tage (CSS-Balken, kein Chart-Paket),
// Views/Engagement, Klicks je 1.000 Views — und die Verdachtsflags mit Messwert
// und Schwelle. Flags sind Hinweise für die Entscheidung, keine Sperre.
import { KanalIcon } from "@/components/kanal-icon";
import { datum, datumZeit } from "@/lib/datum";
import { type Plattform, PLATTFORM_META, reichweite as kurz } from "@/lib/kanaele";
import { type Beitrag, FLAG_TEXT, type KanalReichweite, type Reichweite } from "@/lib/reichweite";

const zahl = (n: number | null | undefined) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("de").format(n));
const prozent = (n: number | null | undefined, stellen = 1) =>
  n === null || n === undefined ? "—" : `${n.toFixed(stellen).replace(".", ",")} %`;
const plattform = (p: string) => (p in PLATTFORM_META ? p : "other") as Plattform;
const tagKurz = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
};

function Verlauf({ verlauf }: { verlauf: KanalReichweite["follower_history"] }) {
  const werte = verlauf.filter((t) => t.followers !== null);
  if (werte.length < 2) return <p className="mt-2 text-xs text-muted-foreground">Verlauf ab dem zweiten Messtag.</p>;
  const min = Math.min(...werte.map((t) => t.followers as number));
  const max = Math.max(...werte.map((t) => t.followers as number));
  const spanne = Math.max(1, max - min);
  return (
    <div className="mt-2">
      <div className="flex h-16 items-end gap-[2px]" role="img" aria-label="Follower je Tag">
        {werte.map((t) => (
          <div
            key={t.day}
            title={`${tagKurz(t.day)} · ${zahl(t.followers)}`}
            className="flex-1 rounded-t bg-foreground"
            style={{ height: `${Math.max(8, Math.round((((t.followers as number) - min) / spanne) * 92) + 8)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
        <span>
          {tagKurz(werte[0].day)} · {zahl(werte[0].followers)}
        </span>
        <span>
          {tagKurz(werte[werte.length - 1].day)} · {zahl(werte[werte.length - 1].followers)}
        </span>
      </div>
    </div>
  );
}

function Kanal({ k }: { k: KanalReichweite }) {
  const p = plattform(k.platform);
  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-3">
        <KanalIcon platform={p} className="size-5" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {k.account_url ? (
              <a href={k.account_url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                {k.account_name ? `@${k.account_name}` : PLATTFORM_META[p].label}
              </a>
            ) : (
              k.account_name ?? PLATTFORM_META[p].label
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {k.verified
              ? `verifiziert · Stand ${datumZeit(k.measured_at)}`
              : k.revoked_at
                ? `Verbindung getrennt ${datum(k.revoked_at)} · Selbstauskunft`
                : "nicht verifiziert · Selbstauskunft"}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${k.verified ? "bg-foreground text-background" : "border border-border text-muted-foreground"}`}>
          {k.verified ? "verifiziert" : "Selbstauskunft"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Follower verifiziert</dt>
          <dd className="font-bold tabular-nums">{k.followers_verified === null ? "—" : kurz(k.followers_verified)}</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Selbstauskunft</dt>
          <dd className="tabular-nums">
            {k.followers_self_reported === null ? "—" : kurz(k.followers_self_reported)}
            {k.deviation_pct !== null && (
              <span className={`ml-2 text-xs ${Math.abs(k.deviation_pct) > 25 ? "text-accent" : "text-muted-foreground"}`}>
                {k.deviation_pct > 0 ? "+" : ""}
                {prozent(k.deviation_pct)}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Views 28 T.</dt>
          <dd className="tabular-nums">{zahl(k.views_28d)}</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Engagement</dt>
          <dd className="tabular-nums">{k.engagement_rate === null ? "—" : prozent(k.engagement_rate * 100, 2)}</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Klicks 28 / 90 T.</dt>
          <dd className="tabular-nums">
            {zahl(k.clicks_28d)} / {zahl(k.clicks_90d)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Klicks je 1.000 Views</dt>
          <dd className="tabular-nums">{k.clicks_per_1000_views === null ? "—" : k.clicks_per_1000_views.toFixed(2).replace(".", ",")}</dd>
        </div>
      </dl>
      {k.last_error && <p className="mt-2 text-xs text-accent">Letzter Abruf fehlgeschlagen: {k.last_error}</p>}
      {k.verified && <Verlauf verlauf={k.follower_history} />}
    </li>
  );
}

export function BeitraegeTabelle({ beitraege, mitPartner = false }: { beitraege: Beitrag[]; mitPartner?: boolean }) {
  if (beitraege.length === 0) return <p className="mt-3 text-sm text-muted-foreground">Noch keine Beiträge angelegt.</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
            <th className="pb-1 pr-3 font-semibold">Beitrag</th>
            {mitPartner && <th className="pb-1 pr-3 font-semibold">Partner</th>}
            <th className="pb-1 pr-3 text-right font-semibold">Views</th>
            <th className="pb-1 pr-3 text-right font-semibold">Klicks 90 T.</th>
            <th className="pb-1 pr-3 text-right font-semibold">Klicks/1.000 V.</th>
            <th className="pb-1 pr-3 text-right font-semibold">Registr.</th>
            <th className="pb-1 text-right font-semibold">Kunden</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {beitraege.map((b) => (
            <tr key={b.id}>
              <td className="max-w-[22rem] py-1.5 pr-3">
                <span className="flex items-center gap-2">
                  <KanalIcon platform={plattform(b.platform)} className="size-4" />
                  {b.url ? (
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="truncate underline-offset-4 hover:underline">
                      {b.title}
                    </a>
                  ) : (
                    <span className="truncate">{b.title}</span>
                  )}
                </span>
                <span className="ml-6 block text-[0.6875rem] text-muted-foreground">
                  <span className="font-mono">{b.code}</span> · {b.utm_content}
                  {b.published_at ? ` · ${datum(b.published_at)}` : ""}
                </span>
              </td>
              {mitPartner && (
                <td className="py-1.5 pr-3">
                  <a href={`/partner/${b.affiliate_id}`} className="underline-offset-4 hover:underline">
                    {b.partner_name}
                  </a>
                </td>
              )}
              <td className="py-1.5 pr-3 text-right tabular-nums" title={b.metrics ? `Stand ${datumZeit(b.metrics.measured_at)}` : "Konto nicht verbunden"}>
                {zahl(b.metrics?.views)}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{zahl(b.clicks_90d)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{b.clicks_per_1000_views === null ? "—" : b.clicks_per_1000_views.toFixed(2).replace(".", ",")}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{zahl(b.registrations)}</td>
              <td className="py-1.5 text-right tabular-nums">{zahl(b.paying_customers)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PartnerReichweite({ reichweite }: { reichweite: Reichweite }) {
  const r = reichweite;
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reichweite · verifiziert vs. Selbstauskunft</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Verifiziert</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{r.reach_verified ? kurz(r.reach_verified) : "—"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Follower aus verbundenen Konten</p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Selbstauskunft</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{r.reach_self_reported ? kurz(r.reach_self_reported) : "—"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Angabe des Partners, alle Kanäle</p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Verdachtsflags</p>
          {r.flags.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">keine</p>
          ) : (
            <ul className="mt-1 space-y-1 text-xs">
              {r.flags.map((f, i) => (
                <li key={`${f.key}-${i}`} className="text-accent" title={f.detail}>
                  {FLAG_TEXT[f.key] ?? f.key} · {f.subject}
                  <span className="block text-muted-foreground">{f.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {r.channels.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Keine Kanäle angegeben.</p>
      ) : (
        <ul className="mt-4 grid gap-4 lg:grid-cols-2">
          {r.channels.map((k, i) => (
            <Kanal key={`${k.platform}-${k.account_url ?? i}`} k={k} />
          ))}
        </ul>
      )}

      <h3 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beiträge</h3>
      <BeitraegeTabelle beitraege={r.posts} />
    </section>
  );
}
