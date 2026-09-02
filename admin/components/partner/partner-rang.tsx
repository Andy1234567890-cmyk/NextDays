"use client";

// Rang eines Partners von Hand setzen (mit Grund) + Verlauf. Der Monatslauf
// stuft automatisch; hier greift das Backoffice ein, wenn eine Vereinbarung
// vom Automatismus abweicht.
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { datum } from "@/lib/datum";
import type { Partner, PartnerDetail, Rang } from "@/lib/partner";
import { prozent } from "@/lib/partner";
import { rangSetzen } from "@/lib/partner-actions";

export function PartnerRang({
  partner,
  raenge,
  verlauf,
  darfEntscheiden,
}: {
  partner: Partner;
  raenge: Rang[];
  verlauf: PartnerDetail["tier_history"];
  darfEntscheiden: boolean;
}) {
  const [laeuft, starte] = useTransition();
  const [tier, setTier] = useState(partner.current_tier_id);
  const [note, setNote] = useState("");

  return (
    <div className="rounded-2xl border border-border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rang</h2>
      {darfEntscheiden && partner.status === "approved" && (
        <div className="mt-3 flex flex-col gap-2">
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="rounded-full border border-border bg-transparent px-4 py-2 text-sm"
          >
            {raenge.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {prozent(r.rate)}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Grund (Pflicht)"
            maxLength={1000}
            className="rounded-full border border-border bg-transparent px-4 py-2 text-sm outline-none focus-visible:border-foreground"
          />
          <button
            type="button"
            disabled={laeuft || tier === partner.current_tier_id || note.trim().length < 3}
            onClick={() =>
              starte(async () => {
                const res = await rangSetzen(partner.id, tier, note.trim());
                if (res.ok) {
                  toast.success("Rang gesetzt.");
                  setNote("");
                } else toast.error(res.fehler);
              })
            }
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold hover:border-foreground disabled:opacity-50"
          >
            Rang setzen
          </button>
        </div>
      )}
      <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        {verlauf.length === 0 && <li>Noch kein Verlauf.</li>}
        {verlauf.map((v) => (
          <li key={`${v.tier_id}-${v.valid_from}`}>
            {datum(v.valid_from)} → {v.tier_id} ({v.paying_customers} Kunden, {v.trigger_kind})
            {v.note ? ` · ${v.note}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
