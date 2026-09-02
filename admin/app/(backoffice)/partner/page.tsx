// Partnerprogramm (0517): alle Partner, nach Status. Die Liste zeigt
// Kennzahlen — die Detailansicht ist der protokollierte Vorgang.
import { KanalIcon } from "@/components/kanal-icon";
import Link from "next/link";

import { datum } from "@/lib/datum";
import {
  getPartnerListe,
  type PartnerStatus,
  prozent,
  STATUS_LABEL,
} from "@/lib/partner";
import { getOffeneVideos, getRaenge, getTrackingSummary } from "@/lib/partner";
import { reichweite } from "@/lib/kanaele";
import { getReichweiteSummary } from "@/lib/reichweite";

const TABS: { status: PartnerStatus | ""; label: string }[] = [
  { status: "pending_review", label: "In Prüfung" },
  { status: "approved", label: "Freigegeben" },
  { status: "suspended", label: "Gesperrt" },
  { status: "rejected", label: "Abgelehnt" },
  { status: "", label: "Alle" },
];

export default async function PartnerSeite({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; suche?: string }>;
}) {
  const { status, suche } = await searchParams;
  const aktiv = (TABS.find((t) => t.status === status)?.status ??
    "pending_review") as PartnerStatus | "";
  const [liste, raenge, summary, reichweiteSummary, videos] = await Promise.all([
    getPartnerListe({ status: aktiv || undefined, suche, limit: 200 }),
    getRaenge().catch(() => []),
    getTrackingSummary(),
    getReichweiteSummary(),
    // Der Zähler darf die Seite nicht mitreißen, wenn die Videoliste hakt —
    // die Partnerübersicht ist wichtiger als ihr Abzeichen (Wurzel 5).
    getOffeneVideos().catch(() => []),
  ]);
  const offeneVideos = videos.length;
  const zahl = (n: number) => new Intl.NumberFormat("de").format(n);
  const rangName = new Map(raenge.map((r) => [r.id, `${r.name} (${prozent(r.rate)})`]));

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">Partner</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {liste.total} Partner · Bewerbungen prüfen, Zuordnungen und Provisionen einsehen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/partner/videos"
            className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
          >
            Videofreigabe
            {offeneVideos > 0 && (
              // Wartende Videos blockieren Geld: solange nichts freigegeben ist,
              // hat der Partner keinen Link. Deshalb sichtbar zählen.
              <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                {offeneVideos}
              </span>
            )}
          </Link>
          <Link
            href="/partner/reichweite"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
          >
            Reichweite
          </Link>
          <Link
            href="/partner/material"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
          >
            Werbematerial
          </Link>
          <Link
            href="/partner/leads"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
          >
            Multiplikatoren
          </Link>
          <Link
            href="/partner/auszahlungen"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
          >
            Auszahlungen
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          { label: "Partner", wert: zahl(summary.partners_total), hinweis: `${zahl(summary.partners_approved)} freigegeben · ${zahl(summary.partners_pending)} in Prüfung` },
          { label: "Klicks 30 Tage", wert: zahl(summary.clicks_30d), hinweis: "alle Partner-Links" },
          { label: "Registrierungen 30 T.", wert: zahl(summary.registrations_30d), hinweis: `${zahl(summary.registrations_total)} gesamt` },
          { label: "Zahlende Kunden", wert: zahl(summary.paying_customers), hinweis: "über Partner geworben" },
          { label: "Reichweite", wert: summary.reach_total ? reichweite(summary.reach_total) : "—", hinweis: reichweiteSummary.reach_verified ? `${reichweite(reichweiteSummary.reach_verified)} verifiziert` : "Follower, Selbstauskunft" },
          { label: "Conversion 30 T.", wert: summary.clicks_30d ? `${((summary.registrations_30d / summary.clicks_30d) * 100).toFixed(1).replace(".", ",")} %` : "—", hinweis: "Registrierungen ÷ Klicks" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{k.wert}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.hinweis}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={`/partner?status=${t.status}${suche ? `&suche=${encodeURIComponent(suche)}` : ""}`}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              aktiv === t.status
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form className="mt-6" action="/partner">
        <input type="hidden" name="status" value={aktiv} />
        <input
          type="search"
          name="suche"
          defaultValue={suche ?? ""}
          placeholder="Name, Firma oder E-Mail"
          className="w-full max-w-sm rounded-full border border-border bg-transparent px-5 py-2.5 text-sm outline-none focus-visible:border-foreground"
        />
      </form>

      {liste.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Keine Partner in dieser Ansicht.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Partner</th>
                <th className="pb-2 pr-4 font-semibold">Land</th>
                <th className="pb-2 pr-4 font-semibold">Kanal</th>
                <th className="pb-2 pr-4 font-semibold">Rang</th>
                <th className="pb-2 pr-4 text-right font-semibold">Klicks 30 T.</th>
                <th className="pb-2 pr-4 text-right font-semibold">Reichweite</th>
                <th className="pb-2 pr-4 font-semibold">Kunden</th>
                <th className="pb-2 pr-4 font-semibold">Status</th>
                <th className="pb-2 font-semibold">Bewerbung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liste.items.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/partner/${p.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.company ? `${p.company} · ${p.full_name}` : p.full_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{p.country}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {p.channels.length === 0 ? (
                      "—"
                    ) : (
                      <span className="flex items-center gap-2">
                        {p.channels.map((k) => (
                          <a key={k.url} href={k.url} target="_blank" rel="noopener noreferrer" title={k.url}>
                            <KanalIcon platform={k.platform} className="size-5" />
                          </a>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {rangName.get(p.current_tier_id) ?? p.current_tier_id}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{zahl(p.clicks_30d)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                    {p.reach ? reichweite(p.reach) : "—"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {p.paying_customers} zahlend / {p.referrals}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-semibold">
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground">{datum(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
