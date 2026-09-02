"use client";

// Bewerbung entscheiden (freigeben / ablehnen) und Partner sperren/entsperren.
// Ablehnen und Sperren verlangen einen Grund — er geht dem Partner per Mail zu
// bzw. steht in seinem Dashboard.
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Partner } from "@/lib/partner";
import { partnerEntscheiden, partnerEntsperren, partnerSperren } from "@/lib/partner-actions";

export function PartnerEntscheidung({
  partner,
  darfEntscheiden,
}: {
  partner: Partner;
  darfEntscheiden: boolean;
}) {
  const [laeuft, starte] = useTransition();
  const [grund, setGrund] = useState("");
  const [grundOffen, setGrundOffen] = useState<"reject" | "suspend" | null>(null);

  if (!darfEntscheiden) {
    return (
      <div className="rounded-2xl border border-border p-5 text-sm text-muted-foreground">
        Entscheidungen trifft nur platform_admin.
      </div>
    );
  }

  function ausfuehren(aktion: () => Promise<{ ok: boolean; fehler?: string }>, erfolg: string) {
    starte(async () => {
      const res = await aktion();
      if (res.ok) {
        toast.success(erfolg);
        setGrund("");
        setGrundOffen(null);
      } else {
        toast.error(res.fehler ?? "Fehlgeschlagen.");
      }
    });
  }

  const offen = partner.status === "pending_review" || partner.status === "rejected";

  return (
    <div className="rounded-2xl border border-border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Entscheidung
      </h2>
      {partner.status === "pending_review" && (
        <details className="mt-3 rounded-xl border border-border px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold">Prüfliste vor der Freigabe</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
            <li>Engagement-Rate zur Reichweite plausibel (Likes/Kommentare je Beitrag ÷ Follower; unter 1 % bei &gt; 10k ist ein Warnzeichen)?</li>
            <li>Follower-Verlauf organisch (keine Sprünge, keine Plateaus nach Sprüngen)?</li>
            <li>Zielgruppe wirklich Gastgeber/Vermieter/Hotels — Inhalte, Kommentare, Sprache?</li>
            <li>Kanäle erreichbar, Handle passt zur Adresse, Impressum/Kontakt vorhanden?</li>
            <li>Team-Flags (gleiche Domain/IBAN) und Referral-Flags im Tracking unten geprüft?</li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            Werkzeuge:{" "}
            <a href="https://socialblade.com" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">Social Blade</a>{" · "}
            <a href="https://www.modash.io/free-tools/fake-follower-check" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">Modash Fake-Follower-Check</a>{" · "}
            <a href="https://hypeauditor.com" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">HypeAuditor</a>
            {" — die Freigabe bleibt eine Entscheidung von Hand."}
          </p>
        </details>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {offen && (
          <>
            <button
              type="button"
              disabled={laeuft || !partner.terms_accepted_at}
              onClick={() =>
                ausfuehren(() => partnerEntscheiden(partner.id, "approve", ""), "Partner freigegeben — Mail mit Code ist raus.")
              }
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
            >
              Freigeben
            </button>
            {!partner.terms_accepted_at && (
              <p className="text-xs text-muted-foreground">Ohne Zustimmung zu den Bedingungen keine Freigabe.</p>
            )}
            {partner.status === "pending_review" && (
              <button
                type="button"
                disabled={laeuft}
                onClick={() => setGrundOffen(grundOffen === "reject" ? null : "reject")}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-foreground disabled:opacity-50"
              >
                Ablehnen …
              </button>
            )}
          </>
        )}
        {partner.status === "approved" && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => setGrundOffen(grundOffen === "suspend" ? null : "suspend")}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-foreground disabled:opacity-50"
          >
            Sperren …
          </button>
        )}
        {partner.status === "suspended" && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => ausfuehren(() => partnerEntsperren(partner.id), "Partner entsperrt.")}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            Entsperren
          </button>
        )}
      </div>

      {grundOffen && (
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Grund (geht an den Partner)
          </label>
          <textarea
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground"
          />
          <button
            type="button"
            disabled={laeuft || grund.trim().length < 3}
            onClick={() =>
              grundOffen === "reject"
                ? ausfuehren(() => partnerEntscheiden(partner.id, "reject", grund.trim()), "Bewerbung abgelehnt.")
                : ausfuehren(() => partnerSperren(partner.id, grund.trim()), "Partner gesperrt; offene Provisionen angehalten.")
            }
            className="mt-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {grundOffen === "reject" ? "Ablehnung bestätigen" : "Sperre bestätigen"}
          </button>
        </div>
      )}
    </div>
  );
}
