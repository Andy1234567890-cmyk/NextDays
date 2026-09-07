// Dashboard-Startseite (Server Component) im Airbnb-„Today"-Muster:
//   • oben eine dezent-graue Band-Sektion mit der „Zahlungen einrichten"-Karte
//     — NUR solange das Stripe-Konto nicht freigeschaltet ist (ohne geht kein
//     Objekt auf myBestDays live), und sie führt dorthin. Vorher stand hier
//     eine statische „Konto verifizieren"-Karte ohne Ziel und ohne Bedingung.
//   • darunter die zentrierte Heute/Demnächst-Ansicht mit Empty State
// Werte fehlend → Empty State (nie 0/Fantasiewert, Wurzel 4).
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { HeuteAnsicht } from "@/components/heute-ansicht";
import { getPaymentSettings } from "@/lib/payments";
import { getTenantStats } from "@/lib/stats";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  // Buchungen vorhanden? Stats dürfen fehlen (neues Konto) → als „keine" werten.
  const [stats, zahlungen] = await Promise.all([
    getTenantStats().catch(() => null),
    getPaymentSettings(),
  ]);
  const hasBookings = (stats?.created_reservations?.value ?? 0) > 0;
  const zahlungenBereit = !!zahlungen?.stripe_charges_enabled;

  return (
    <>
      {/* Obere Band-Sektion (Airbnb-Muster): Stripe einrichten, solange offen */}
      {!zahlungenBereit && (
        <section className="bg-muted/40">
          <div className="mx-auto max-w-5xl px-6 py-6">
            <Link
              href="/konto?bereich=zahlungen"
              className="mx-auto flex max-w-md items-center gap-4 rounded-2xl bg-background p-4 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                <Icon icon="solar:card-bold-duotone" className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold">
                  {t("zahlungenEinrichtenTitel")}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {t("zahlungenEinrichtenText")}
                </span>
              </span>
              <Icon icon="ph:caret-right" className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </div>
        </section>
      )}

      <HeuteAnsicht hasBookings={hasBookings} />
    </>
  );
}
