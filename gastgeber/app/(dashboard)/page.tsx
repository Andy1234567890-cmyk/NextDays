// Dashboard-Startseite (Server Component) im Airbnb-„Today"-Muster:
//   • oben eine dezent-graue Band-Sektion mit der „Konto verifizieren"-Karte
//     (nur solange noch nicht veröffentlicht werden kann)
//   • darunter die zentrierte Heute/Demnächst-Ansicht mit Empty State
// Werte fehlend → Empty State (nie 0/Fantasiewert, Wurzel 4).
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";

import { HeuteAnsicht } from "@/components/heute-ansicht";
import { getTenantStats } from "@/lib/stats";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  // Buchungen vorhanden? Stats dürfen fehlen (neues Konto) → als „keine" werten.
  const stats = await getTenantStats().catch(() => null);
  const hasBookings = (stats?.created_reservations?.value ?? 0) > 0;

  return (
    <>
      {/* Obere Band-Sektion: „Konto verifizieren"-Karte (Airbnb-Muster) */}
      <section className="bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="mx-auto flex max-w-md items-center gap-4 rounded-2xl bg-background p-4 shadow-sm ring-1 ring-border">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
              <Icon icon="solar:shield-check-bold-duotone" className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold">
                {t("verifizierenTitel")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("verifizierenText")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <HeuteAnsicht hasBookings={hasBookings} />
    </>
  );
}
