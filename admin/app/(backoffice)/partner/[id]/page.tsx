// Detailsicht eines Partners — der protokollierte Vorgang (affiliate.view).
// Hier fällt die Entscheidung über die Bewerbung, hier werden Zuordnungen
// geprüft und Provisionen korrigiert.
import Link from "next/link";
import { notFound } from "next/navigation";

import { KanalIcon } from "@/components/kanal-icon";
import { PartnerEntscheidung } from "@/components/partner/partner-entscheidung";
import { PartnerKorrektur } from "@/components/partner/partner-korrektur";
import { PartnerRang } from "@/components/partner/partner-rang";
import { PartnerReferrals } from "@/components/partner/partner-referrals";
import { PartnerTeam } from "@/components/partner/partner-team";
import { PartnerReichweite } from "@/components/partner-reichweite";
import { PartnerTracking } from "@/components/partner-tracking";
import { ApiError } from "@/lib/api-server";
import { getPlatformMe } from "@/lib/backoffice";
import { datum, datumZeit } from "@/lib/datum";
import { PLATTFORM_META, reichweite } from "@/lib/kanaele";
import {
  getPartner,
  getPartnerProvisionen,
  getPartnerReferrals,
  getRaenge,
  getTeam,
  getTracking,
  prozent,
  STATUS_LABEL,
} from "@/lib/partner";
import { getReichweite } from "@/lib/reichweite";

import { RealtimeRefresh } from "@/components/realtime-refresh";

// Schlüssel aus payout_details (vom Partner gepflegt) → lesbare Bezeichnung.
const AUSZAHLUNGSFELD: Record<string, string> = {
  iban: "IBAN",
  account_holder: "Kontoinhaber",
  email: "E-Mail",
  bic: "BIC",
};

const KIND_LABEL: Record<string, string> = {
  earn: "Ertrag",
  reversal: "Gegenbuchung",
  adjustment: "Korrektur",
  override: "Team-Provision",
  bonus: "Aufstiegsbonus",
  lifetime: "Superprovision",
  booking_share: "Buchungsanteil",
};
// Zeilen, die eine Basis (Netto-Abo-Umsatz bzw. Buchungswert) tragen.
const MIT_BASIS = new Set(["earn", "override", "lifetime", "booking_share"]);

export default async function PartnerDetailSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let detail;
  try {
    detail = await getPartner(id);
  } catch (exc) {
    if (exc instanceof ApiError && exc.status === 404) notFound();
    throw exc;
  }
  const [me, referrals, provisionen, raenge, tracking, team, reichweiteDaten] = await Promise.all([
    getPlatformMe(),
    getPartnerReferrals(id),
    getPartnerProvisionen(id),
    getRaenge().catch(() => []),
    getTracking(id),
    getTeam(id),
    getReichweite(id),
  ]);
  const p = detail.partner;
  const rang = raenge.find((r) => r.id === p.current_tier_id);

  const stammdaten: { label: string; wert: string }[] = [
    { label: "E-Mail", wert: p.email },
    { label: "Rechtsform", wert: p.legal_form === "company" ? "Unternehmen" : "Privatperson" },
    { label: "Land", wert: p.country },
    {
      label: "USt-IdNr.",
      wert: p.vat_id
        ? `${p.vat_id} · ${p.vat_id_verified_at ? `VIES bestätigt ${datum(p.vat_id_verified_at)}` : "NICHT bestätigt"}`
        : "—",
    },
    { label: "Sprache", wert: p.language },
    { label: "Rang", wert: rang ? `${rang.name} (${prozent(rang.rate)})` : p.current_tier_id },
    { label: "Zahlende Kunden", wert: String(p.paying_customers) },
    { label: "Auszahlungsweg", wert: p.payout_method ?? "— (noch nicht hinterlegt)" },
    {
      label: "Auszahlungsangaben",
      wert:
        Object.entries(detail.payout_details)
          .map(([k, v]) => `${AUSZAHLUNGSFELD[k] ?? k}: ${v}`)
          .join(" · ") || "—",
    },
    { label: "Bedingungen", wert: p.terms_accepted_at ? `${p.terms_version} · ${datumZeit(p.terms_accepted_at)}` : "nicht zugestimmt" },
    { label: "Bewerbung", wert: datumZeit(p.created_at) },
    { label: "Entschieden", wert: datumZeit(p.reviewed_at) },
  ];

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      {/* Nur DIESE Zeile, nicht die ganze Tabelle: die Detailseite zeigt einen
          Partner, und ein Abo ohne Filter würde bei jeder fremden Änderung
          neu laden. */}
      <RealtimeRefresh table="affiliates" filter={`id=eq.${id}`} />
      {/* Beiträge dieses Partners (Videofreigabe, Kennzahlen). */}
      <RealtimeRefresh table="affiliate_posts" filter={`affiliate_id=eq.${id}`} />
      <Link href="/partner" className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
        ← Partner
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <h1 className="font-sans text-[2rem] font-bold tracking-tight">
          {p.company ? `${p.company} · ${p.full_name}` : p.full_name}
        </h1>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
          {STATUS_LABEL[p.status]}
        </span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{p.id}</p>
      {p.status_reason && (
        <p className="mt-2 text-sm text-muted-foreground">Grund: {p.status_reason}</p>
      )}

      <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Bewerbung
          </h2>
          <div className="mt-3 rounded-2xl border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kanäle ({p.channels.length})
            </p>
            {p.channels.length === 0 ? (
              <p className="mt-2 text-sm">— keine Kanäle angegeben —</p>
            ) : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {p.channels.map((k) => (
                  <li key={k.url} className="flex flex-wrap items-center gap-3 py-2">
                    <KanalIcon platform={k.platform} className="size-5" />
                    <span className="w-24 font-medium">{PLATTFORM_META[k.platform].label}</span>
                    <a href={k.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                      {k.url.replace(/^https?:\/\//, "")}
                    </a>
                    {k.handle && <span className="text-muted-foreground">@{k.handle}</span>}
                    <span className="w-28 text-right tabular-nums text-muted-foreground">
                      {k.followers === null ? "—" : `${reichweite(k.followers)} Follower`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 whitespace-pre-wrap text-sm">{p.pitch ?? "— kein Text —"}</p>
          </div>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stammdaten
          </h2>
          <div className="mt-3 divide-y divide-border rounded-2xl border border-border">
            {stammdaten.map((z) => (
              <div key={z.label} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <span className="text-sm text-muted-foreground">{z.label}</span>
                <span className="text-right text-sm font-medium">{z.wert}</span>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Codes ({detail.codes.length})
          </h2>
          {detail.codes.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Noch kein Code (entsteht bei der Freigabe).</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
              {detail.codes.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm">
                  <span className="font-mono font-semibold">{c.code}</span>
                  <span className="text-muted-foreground">
                    {c.clicks_30d} Klicks (30 Tage) · {c.active ? "aktiv" : "inaktiv"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-6">
          <PartnerEntscheidung partner={p} darfEntscheiden={me.can_write} />
          <PartnerRang partner={p} raenge={raenge} verlauf={detail.tier_history} darfEntscheiden={me.can_write} />
        </aside>
      </section>

      <PartnerReferrals affiliateId={p.id} referrals={referrals.items} darfEntscheiden={me.can_write} />

      <PartnerTeam partner={p} team={team} darfEntscheiden={me.can_write} />

      <PartnerTracking tracking={tracking} />

      <PartnerReichweite reichweite={reichweiteDaten} />

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Provisionen ({provisionen.total})
          </h2>
          {me.can_write && <PartnerKorrektur affiliateId={p.id} />}
        </div>
        {provisionen.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Noch keine Provisionen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-semibold">Datum</th>
                  <th className="pb-2 pr-4 font-semibold">Art</th>
                  <th className="pb-2 pr-4 font-semibold">Kunde</th>
                  <th className="pb-2 pr-4 font-semibold">Basis</th>
                  <th className="pb-2 pr-4 font-semibold">Satz</th>
                  <th className="pb-2 pr-4 font-semibold">Betrag</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Rechnung / Grund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {provisionen.items.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 text-muted-foreground">{datum(c.created_at)}</td>
                    <td className="py-2.5 pr-4">{KIND_LABEL[c.kind] ?? c.kind}</td>
                    <td className="py-2.5 pr-4">
                      {c.kind === "bonus" ? (
                        <span className="text-muted-foreground">Rang {c.tier_id}</span>
                      ) : c.source_affiliate_id ? (
                        <>
                          <Link href={`/partner/${c.source_affiliate_id}`} className="underline-offset-4 hover:underline">
                            Team · {c.source_partner_name ?? c.source_affiliate_id.slice(0, 8)}
                          </Link>
                          <Link href={`/betriebe/${c.tenant_id}`} className="ml-2 text-xs text-muted-foreground underline-offset-4 hover:underline">
                            Betrieb
                          </Link>
                        </>
                      ) : (
                        <Link href={`/betriebe/${c.tenant_id}`} className="underline-offset-4 hover:underline">
                          {c.customer_label}
                        </Link>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {MIT_BASIS.has(c.kind) ? `${c.base_amount} ${c.currency}` : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{prozent(c.rate)}</td>
                    <td className="py-2.5 pr-4 font-medium">
                      {c.amount} {c.currency}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{c.status}</td>
                    <td className="max-w-[18rem] truncate py-2.5 font-mono text-xs text-muted-foreground">
                      {c.stripe_invoice_id ?? c.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
