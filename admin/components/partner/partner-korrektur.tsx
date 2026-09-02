"use client";

// Manuelle Korrekturzeile (adjustment): Vorzeichen frei, Grund Pflicht,
// Währung Pflicht — nie ein Betrag ohne Währung (Wurzel 4).
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { korrekturBuchen } from "@/lib/partner-actions";

export function PartnerKorrektur({ affiliateId }: { affiliateId: string }) {
  const [offen, setOffen] = useState(false);
  const [laeuft, starte] = useTransition();
  const [betrag, setBetrag] = useState("");
  const [waehrung, setWaehrung] = useState("EUR");
  const [grund, setGrund] = useState("");

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-foreground"
      >
        Korrektur buchen …
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <input
        value={betrag}
        onChange={(e) => setBetrag(e.target.value)}
        placeholder="Betrag, z. B. -12.50"
        className="w-36 rounded-full border border-border bg-transparent px-4 py-2 text-sm outline-none focus-visible:border-foreground"
      />
      <input
        value={waehrung}
        onChange={(e) => setWaehrung(e.target.value.toUpperCase())}
        maxLength={3}
        className="w-20 rounded-full border border-border bg-transparent px-4 py-2 text-sm uppercase outline-none focus-visible:border-foreground"
      />
      <input
        value={grund}
        onChange={(e) => setGrund(e.target.value)}
        placeholder="Grund (Pflicht)"
        className="w-64 rounded-full border border-border bg-transparent px-4 py-2 text-sm outline-none focus-visible:border-foreground"
      />
      <button
        type="button"
        disabled={laeuft || !/^-?\d{1,9}(\.\d{1,2})?$/.test(betrag) || waehrung.length !== 3 || grund.trim().length < 3}
        onClick={() =>
          starte(async () => {
            const res = await korrekturBuchen(affiliateId, betrag, waehrung, grund.trim());
            if (res.ok) {
              toast.success("Korrektur gebucht.");
              setOffen(false);
              setBetrag("");
              setGrund("");
            } else toast.error(res.fehler);
          })
        }
        className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
      >
        Buchen
      </button>
      <button type="button" onClick={() => setOffen(false)} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Abbrechen
      </button>
    </div>
  );
}
