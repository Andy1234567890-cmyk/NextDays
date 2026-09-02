// Reichweite programmweit (0521): verifiziert vs. Selbstauskunft, Top-Kanäle
// nach Kunden je 1.000 Follower, Top-Beiträge, und die Schwellen der
// Verdachtsprüfung als Daten (Wurzel 4) — hier änderbar, `leer` = Regel aus.
import Link from "next/link";

import { KanalIcon } from "@/components/kanal-icon";
import { BeitraegeTabelle } from "@/components/partner-reichweite";
import { SchwellenFormular } from "@/components/partner/schwellen-formular";
import { getPlatformMe } from "@/lib/backoffice";
import { type Plattform, PLATTFORM_META, reichweite as kurz } from "@/lib/kanaele";
import { getReichweiteSummary, getSchwellen } from "@/lib/reichweite";

const zahl = (n: number) => new Intl.NumberFormat("de").format(n);

export default async function ReichweiteSeite() {
  const [me, summary, schwellen] = await Promise.all([getPlatformMe(), getReichweiteSummary(), getSchwellen()]);

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">Reichweite</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            Quelldaten der Plattformen neben der Selbstauskunft — und was daraus Klicks und Kunden werden.
          </p>
        </div>
        <Link href="/partner" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground">
          Zur Partnerliste
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Reichweite verifiziert", wert: summary.reach_verified ? kurz(summary.reach_verified) : "—", hinweis: "Follower aus verbundenen Konten" },
          { label: "Reichweite Selbstauskunft", wert: summary.reach_self_reported ? kurz(summary.reach_self_reported) : "—", hinweis: "Angaben der Partner" },
          { label: "Verbundene Konten", wert: zahl(summary.connections_active), hinweis: `${zahl(summary.partners_with_connection)} Partner · ${zahl(summary.connections_revoked)} getrennt` },
          { label: "Verdachtsflags", wert: zahl(summary.flags_total), hinweis: "Hinweise, keine Sperre" },
          { label: "Top-Beiträge", wert: zahl(summary.top_posts.length), hinweis: "nach zahlenden Kunden" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{k.wert}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.hinweis}</p>
          </div>
        ))}
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-2xl border border-border p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top-Kanäle · Kunden je 1.000 Follower</h2>
          <p className="mt-1 text-xs text-muted-foreground">Nur verifizierte Kanäle; Kunden = zahlende Kunden über Beiträge dieses Kanals.</p>
          {summary.top_channels.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Noch kein verbundenes Konto mit Followern.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {summary.top_channels.map((k) => (
                <li key={`${k.affiliate_id}-${k.platform}`} className="flex items-center gap-3 py-2">
                  <KanalIcon platform={(k.platform in PLATTFORM_META ? k.platform : "other") as Plattform} className="size-5" />
                  <Link href={`/partner/${k.affiliate_id}`} className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                    {k.partner_name}
                  </Link>
                  <span className="tabular-nums text-muted-foreground">{kurz(k.followers)}</span>
                  <span className="w-16 text-right tabular-nums">{zahl(k.paying_customers)}</span>
                  <span className="w-16 text-right font-semibold tabular-nums">{k.customers_per_1000_followers.toFixed(2).replace(".", ",")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-border p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top-Beiträge programmweit</h2>
          <BeitraegeTabelle beitraege={summary.top_posts} mitPartner />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Schwellen der Verdachtsprüfung</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Startwerte sind vorläufig und werden nach den ersten Wochen mit echten Daten festgelegt. Ein leerer Wert schaltet die Regel ab.
          Flags sind Hinweise für die Entscheidung im Einzelfall, nie eine automatische Sperre.
        </p>
        <SchwellenFormular schwellen={schwellen} darfSchreiben={me.can_write} />
      </section>
    </div>
  );
}
