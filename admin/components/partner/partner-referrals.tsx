"use client";

// Zuordnungen eines Partners: welcher Betrieb kam über ihn, mit Flags der
// Betrugsprüfung. Angehaltene Zuordnungen entscheidet das Backoffice hier;
// manuelles Nachtragen für Fälle, in denen der Code beim Signup fehlte.
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { datum } from "@/lib/datum";
import { FLAG_LABEL, REFERRAL_LABEL, type Referral } from "@/lib/partner";
import { referralManuell, referralStatusSetzen } from "@/lib/partner-actions";

export function PartnerReferrals({
  affiliateId,
  referrals,
  darfEntscheiden,
}: {
  affiliateId: string;
  referrals: Referral[];
  darfEntscheiden: boolean;
}) {
  const [laeuft, starte] = useTransition();
  const [tenantId, setTenantId] = useState("");
  const [note, setNote] = useState("");

  function status(r: Referral, neu: "approved" | "held" | "rejected") {
    const grund = window.prompt(`Zuordnung auf „${REFERRAL_LABEL[neu]}" setzen — Grund:`);
    if (!grund || grund.trim().length < 3) return;
    starte(async () => {
      const res = await referralStatusSetzen(affiliateId, r.id, neu, grund.trim());
      if (res.ok) toast.success("Zuordnung aktualisiert.");
      else toast.error(res.fehler);
    });
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Geworbene Betriebe ({referrals.length})
      </h2>
      {referrals.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Noch keine Zuordnung.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Betrieb</th>
                <th className="pb-2 pr-4 font-semibold">Weg</th>
                <th className="pb-2 pr-4 font-semibold">Status</th>
                <th className="pb-2 pr-4 font-semibold">Flags</th>
                <th className="pb-2 pr-4 font-semibold">Erste Zahlung</th>
                <th className="pb-2 pr-4 font-semibold">Provision bis</th>
                <th className="pb-2 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {referrals.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-4">
                    <Link href={`/betriebe/${r.tenant_id}`} className="font-medium underline-offset-4 hover:underline">
                      {r.tenant_name ?? r.tenant_id}
                    </Link>
                    <span className="text-muted-foreground"> · {r.tenant_country ?? "—"}</span>
                    {r.contact_opt_in && (
                      <span className="ml-2 text-[0.6875rem] text-muted-foreground">Kontakt erlaubt</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{r.method}</td>
                  <td className="py-2.5 pr-4">{REFERRAL_LABEL[r.status]}</td>
                  <td className="py-2.5 pr-4 text-xs">
                    {r.flags.length === 0 ? "—" : r.flags.map((f) => FLAG_LABEL[f] ?? f).join(", ")}
                    {r.review_note && <p className="text-muted-foreground">{r.review_note}</p>}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{datum(r.first_paid_at)}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{datum(r.commission_until)}</td>
                  <td className="py-2.5">
                    {darfEntscheiden && r.status !== "rejected" && (
                      <div className="flex gap-2 text-xs">
                        {r.status !== "approved" && (
                          <button type="button" disabled={laeuft} onClick={() => status(r, "approved")} className="underline-offset-4 hover:underline">
                            bestätigen
                          </button>
                        )}
                        {r.status !== "held" && (
                          <button type="button" disabled={laeuft} onClick={() => status(r, "held")} className="underline-offset-4 hover:underline">
                            anhalten
                          </button>
                        )}
                        <button type="button" disabled={laeuft} onClick={() => status(r, "rejected")} className="underline-offset-4 hover:underline">
                          ablehnen
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {darfEntscheiden && (
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-border p-4">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Betrieb nachtragen (tenant_id)
            </label>
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="UUID des Betriebs"
              className="mt-1 w-full rounded-full border border-border bg-transparent px-4 py-2 font-mono text-sm outline-none focus-visible:border-foreground"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grund</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z. B. Code beim Signup vergessen, Mail vom 03.09."
              className="mt-1 w-full rounded-full border border-border bg-transparent px-4 py-2 text-sm outline-none focus-visible:border-foreground"
            />
          </div>
          <button
            type="button"
            disabled={laeuft || tenantId.trim().length < 36 || note.trim().length < 3}
            onClick={() =>
              starte(async () => {
                const res = await referralManuell(affiliateId, tenantId.trim(), note.trim());
                if (res.ok) {
                  toast.success("Zuordnung nachgetragen.");
                  setTenantId("");
                  setNote("");
                } else toast.error(res.fehler);
              })
            }
            className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            Zuordnen
          </button>
        </div>
      )}
    </section>
  );
}
