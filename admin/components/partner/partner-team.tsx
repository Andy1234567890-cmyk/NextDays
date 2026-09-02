"use client";

// Team (0520): Sponsor, Team-Partner, Overrides — und die Aktion „Sponsor
// setzen/umhängen/lösen" mit Pflichtgrund (Audit im Server).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { datum } from "@/lib/datum";
import { type Partner, type Team, TEAM_FLAG_LABEL } from "@/lib/partner";
import { sponsorSetzen } from "@/lib/partner-actions";

const betrag = (b: { amount: string; currency: string }[]) =>
  b.length ? b.map((x) => `${Number(x.amount).toFixed(2)} ${x.currency}`).join(" · ") : "—";

export function PartnerTeam({ partner, team, darfEntscheiden }: { partner: Partner; team: Team; darfEntscheiden: boolean }) {
  const router = useRouter();
  const [sponsorId, setSponsorId] = useState(partner.sponsor_affiliate_id ?? "");
  const [grund, setGrund] = useState("");
  const [laeuft, starte] = useTransition();

  const speichern = (loesen = false) =>
    starte(async () => {
      const res = await sponsorSetzen(partner.id, loesen ? null : sponsorId.trim() || null, grund, false);
      if (!res.ok) {
        toast.error(res.fehler);
        return;
      }
      toast.success(loesen ? "Sponsor gelöst." : "Sponsor gesetzt.");
      setGrund("");
      router.refresh();
    });

  const flagsLoeschen = () =>
    starte(async () => {
      const res = await sponsorSetzen(partner.id, partner.sponsor_affiliate_id, grund || "Flags nach Prüfung entfernt", true);
      if (!res.ok) toast.error(res.fehler);
      else {
        toast.success("Team-Flags entfernt.");
        router.refresh();
      }
    });

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Team (zweistufig, 0520)</h2>
      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border p-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sponsor dieses Partners</p>
            {team.sponsor ? (
              <p className="mt-2">
                <Link href={`/partner/${team.sponsor.affiliate_id}`} className="font-medium underline-offset-4 hover:underline">
                  {team.sponsor.company ? `${team.sponsor.company} · ${team.sponsor.name}` : team.sponsor.name}
                </Link>
                <span className="text-muted-foreground"> · {team.sponsor.email}</span>
                {partner.sponsor_joined_at && <span className="text-muted-foreground"> · seit {datum(partner.sponsor_joined_at)}</span>}
              </p>
            ) : (
              <p className="mt-2 text-muted-foreground">Kein Sponsor — dieser Partner ist eigenständig{team.members.length ? " und führt ein Team" : ""}.</p>
            )}
            {partner.sponsor_flags.length > 0 && (
              <p className="mt-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-xs">
                <span className="font-semibold">Prüfen:</span> {partner.sponsor_flags.map((f) => TEAM_FLAG_LABEL[f] ?? f).join(", ")} — Overrides aus diesem Team-Partner entstehen angehalten.
                {darfEntscheiden && (
                  <button type="button" disabled={laeuft} onClick={flagsLoeschen} className="ml-2 font-semibold underline-offset-4 hover:underline">
                    Flags nach Prüfung entfernen
                  </button>
                )}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border p-5 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Geworbene Partner ({team.members.length})</p>
              <p className="text-xs text-muted-foreground">
                Override offen {betrag(team.override_pending)} · auszahlbar {betrag(team.override_approved)} · ausgezahlt {betrag(team.override_paid)}
              </p>
            </div>
            {team.members.length === 0 ? (
              <p className="mt-2 text-muted-foreground">Keine Team-Partner.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-1 pr-3 font-semibold">Partner</th>
                    <th className="pb-1 pr-3 font-semibold">Status</th>
                    <th className="pb-1 pr-3 font-semibold">Rang</th>
                    <th className="pb-1 pr-3 text-right font-semibold">Kunden</th>
                    <th className="pb-1 pr-3 text-right font-semibold">Abo-Umsatz</th>
                    <th className="pb-1 pr-3 text-right font-semibold">Override</th>
                    <th className="pb-1 font-semibold">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {team.members.map((m) => (
                    <tr key={m.affiliate_id}>
                      <td className="py-2 pr-3">
                        <Link href={`/partner/${m.affiliate_id}`} className="font-medium underline-offset-4 hover:underline">
                          {m.company ? `${m.company} · ${m.name}` : m.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{m.email}{m.joined_at ? ` · seit ${datum(m.joined_at)}` : ""}</span>
                      </td>
                      <td className="py-2 pr-3">{m.status}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{m.current_tier_id}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{m.paying_customers}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{betrag(m.revenue_total)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{betrag(m.override_total)}</td>
                      <td className="py-2 text-xs text-accent">{m.flags.map((f) => TEAM_FLAG_LABEL[f] ?? f).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {darfEntscheiden && (
          <div className="h-fit rounded-2xl border border-border p-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sponsor setzen / umhängen</p>
            <p className="mt-1 text-xs text-muted-foreground">Nur hier, mit Grund, protokolliert. Eine Ebene: der Sponsor darf selbst keinen Sponsor haben; ein Partner mit Team kann kein Mitglied werden.</p>
            <label className="mt-3 block text-xs text-muted-foreground">
              Sponsor (affiliate_id)
              <input value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} placeholder="UUID des Sponsors" className="mt-1 w-full rounded-xl border border-border bg-transparent px-3 py-2 font-mono text-xs" />
            </label>
            <label className="mt-3 block text-xs text-muted-foreground">
              Grund (Pflicht)
              <input value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Bewerbung ohne Code, Mail vom 03.09." className="mt-1 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm" />
            </label>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={laeuft || grund.trim().length < 3 || !sponsorId.trim()} onClick={() => speichern(false)} className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50">
                Sponsor setzen
              </button>
              {partner.sponsor_affiliate_id && (
                <button type="button" disabled={laeuft || grund.trim().length < 3} onClick={() => speichern(true)} className="rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50">
                  Sponsor lösen
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
