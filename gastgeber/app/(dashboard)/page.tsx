// Dashboard-Startseite (Server Component). Der Auth-Guard sitzt im Layout der
// (dashboard)-Group (getMe → Redirect). Inhalt (KPIs, Objekt-Liste) folgt in
// Bereich 09.
import { getTranslations } from "next-intl/server";

import { getMe } from "@/lib/me";

export default async function DashboardPage() {
  const me = await getMe();
  const t = await getTranslations("dashboard");

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">{t("begruessung")}</p>
        <h1 className="font-display text-2xl font-semibold">
          {me?.email ?? "myNextDays"}
        </h1>
      </header>

      <section className="rounded-2xl border border-border p-6">
        <p className="text-sm text-muted-foreground">
          Dein Konto ist angelegt (Provisionsmodell: 8 % pro Buchung, kein Abo).
          Die Bereiche für Objekte, Kalender, Preise, Reservierungen und
          Bewertungen folgen hier.
        </p>
      </section>
    </main>
  );
}
