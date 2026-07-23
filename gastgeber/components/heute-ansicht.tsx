"use client";

// „Heute"-Ansicht der Startseite (Airbnb-Today-Muster). Zentrierter Pill-
// Umschalter Heute/Demnächst; darunter der Zustand. Solange keine Buchungen
// existieren (leeres Konto), der Empty State mit Illustration, Headline,
// Untertext und Pill-Button zum Onboarding. Realtime auf reservations, damit
// die erste Buchung ohne Reload erscheint.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useRealtime } from "@/lib/use-realtime";

type Tab = "heute" | "demnaechst";

export function HeuteAnsicht({ hasBookings }: { hasBookings: boolean }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("heute");

  // Erste (OTA-/Marktplatz-)Buchung erscheint ohne Reload.
  useRealtime({ table: "reservations", onChange: () => router.refresh() });

  return (
    <div className="mx-auto max-w-5xl px-6 pt-8">
      {/* Zentrierter Pill-Umschalter */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full">
          {(["heute", "demnaechst"] as const).map((key) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-5 py-2.5 text-[0.9375rem] font-medium transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground hover:bg-muted/70"
                }`}
              >
                {t(key === "heute" ? "tabHeute" : "tabDemnaechst")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State — zentriert, mit Illustration */}
      {!hasBookings && (
        <div className="flex flex-col items-center px-4 pb-16 pt-20 text-center">
          <BuchIllustration />
          <h2 className="mt-8 whitespace-pre-line font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.125rem]">
            {t("keineReservierungenTitel")}
          </h2>
          <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t("keineReservierungenText")}
          </p>
          <Link
            href="/objekt-einstellen"
            className="mt-8 inline-flex items-center rounded-full bg-muted px-6 py-3.5 text-[0.9375rem] font-medium text-foreground transition-colors hover:bg-muted/70"
          >
            {t("objektFertigstellen")}
          </Link>
        </div>
      )}
    </div>
  );
}

// Aufgeschlagenes-Buch-Illustration (Airbnb-Anmutung, dezent, theme-fest).
function BuchIllustration() {
  return (
    <svg
      width="132"
      height="112"
      viewBox="0 0 132 112"
      fill="none"
      aria-hidden="true"
      className="text-muted-foreground/40"
    >
      <path
        d="M66 24C52 14 34 12 20 16v72c14-4 32-2 46 8 14-10 32-12 46-8V16c-14-4-32-2-46 8Z"
        className="fill-muted stroke-border"
        strokeWidth="2"
      />
      <path d="M66 24v72" className="stroke-border" strokeWidth="2" />
      <path
        d="M30 34c8-2 18-1 26 3M30 48c8-2 18-1 26 3M30 62c8-2 18-1 26 3"
        className="stroke-border"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M102 34c-8-2-18-1-26 3M102 48c-8-2-18-1-26 3M102 62c-8-2-18-1-26 3"
        className="stroke-border"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
