"use client";

// Identitätsprüfung (Stripe Identity) in den Kontoeinstellungen. Zeigt den
// ECHTEN Status aus dem Konto (kein hartkodiertes „Verifiziert", Wurzel 5) und
// startet bei „unverified"/„requires_input" die Ausweis-Verifizierung: holt die
// Stripe-Hosted-URL vom Backend und leitet dorthin weiter. Nach Rückkehr steht
// der Status auf „processing", bis der Webhook „verified" setzt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Account } from "@/lib/konto";
import { startIdentityVerification } from "@/lib/konto-actions";

type Status = Account["identity_status"];

const STYLE: Record<Status, { icon: string; cls: string; key: string }> = {
  verified: {
    icon: "solar:verified-check-bold",
    cls: "text-emerald-700",
    key: "identitaetVerifiziert",
  },
  processing: {
    icon: "solar:clock-circle-bold",
    cls: "text-amber-700",
    key: "identitaetProcessing",
  },
  requires_input: {
    icon: "solar:danger-triangle-bold",
    cls: "text-rose-700",
    key: "identitaetRequiresInput",
  },
  unverified: {
    icon: "solar:shield-cross-line-duotone",
    cls: "text-muted-foreground",
    key: "identitaetUnverified",
  },
};

export function IdentitaetZeile({ status }: { status: Status }) {
  const t = useTranslations("konto");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Kein Realtime mehr: `users` ist seit Migration 0337 für `authenticated`
  // gesperrt (Wurzel 6: Rolle/Rechte/Kontaktdaten — revoke + raus aus der
  // Publikation supabase_realtime). Das Abo verband sauber und bekam nie ein
  // Event. Eine Ersatzquelle gibt es nicht: `identity_status` setzt allein der
  // Stripe-Webhook auf der users-Zeile, keine offene Tabelle spiegelt das.
  // Ehrlich: der Wechsel von „In Prüfung" auf „Verifiziert" erscheint erst beim
  // nächsten Laden der Konto-Seite, nicht mehr von selbst.

  const s = STYLE[status];
  // Verifizieren anbieten, solange nicht verifiziert und nicht in Prüfung.
  const kannStarten = status === "unverified" || status === "requires_input";

  async function starten() {
    setBusy(true);
    setFehler(null);
    // Neuen Tab SOFORT im Klick (User-Gesture) öffnen — sonst blockt der Popup-
    // Blocker, weil das Öffnen nach dem await nicht mehr im Gesture-Kontext ist.
    const tab = window.open("", "_blank");
    try {
      // return_url = eigene Konto-Seite (das Frontend kennt seinen Origin).
      const res = await startIdentityVerification(
        `${window.location.origin}/konto?bereich=persoenlich`,
      );
      if (res.ok && res.url) {
        if (tab) {
          tab.location.href = res.url; // Stripe-Hosted-Seite im neuen Tab
        } else {
          // Popup-Blocker hat den Tab verhindert → im selben Tab weiter.
          window.location.assign(res.url);
        }
        setBusy(false);
        return;
      }
      tab?.close();
      setBusy(false);
      setFehler(res.ok ? "Keine Verifizierungs-URL erhalten." : res.error);
    } catch (exc) {
      tab?.close();
      setBusy(false);
      setFehler(exc instanceof Error ? exc.message : "Unbekannter Fehler.");
    }
  }

  return (
    <div className="border-b border-border py-6">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium">{t("identitaet")}</p>
        {kannStarten && (
          <button
            type="button"
            onClick={starten}
            disabled={busy}
            className="shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-70 disabled:opacity-60"
          >
            {busy ? "…" : t("identitaetStarten")}
          </button>
        )}
      </div>
      <p
        className={`mt-1 inline-flex items-center gap-1.5 text-[0.9375rem] ${s.cls}`}
      >
        <Icon icon={s.icon} className="size-4" />
        {t(s.key)}
      </p>
      {kannStarten && (
        <p className="mt-1 max-w-lg text-sm text-muted-foreground/80">
          {t("identitaetHinweis")}
        </p>
      )}
      {fehler && <p className="mt-2 text-sm text-destructive">{fehler}</p>}
    </div>
  );
}
