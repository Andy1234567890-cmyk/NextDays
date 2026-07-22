// Dashboard-Startseite (Server Component). Liest das eigene Konto server-zu-
// server (getMe) und schützt sich selbst: kein Konto → Redirect zur Anmeldung
// (Autorisierung nah an den Daten, NICHT nur in der Middleware — heise-CVE).
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { getMe } from "@/lib/me";

export default async function DashboardPage() {
  const me = await getMe();
  if (!me?.tenant_id) redirect("/anmelden?weiter=/");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Gastgeber-Dashboard</p>
          <h1 className="font-display text-2xl font-semibold">
            {me.email ?? "Willkommen"}
          </h1>
        </div>
        <LogoutButton />
      </header>

      <section className="rounded-2xl border border-border p-6">
        <h2 className="mb-2 font-medium">Los geht’s</h2>
        <p className="text-sm text-muted-foreground">
          Dein Konto ist angelegt (Provisionsmodell: 8 % pro Buchung, kein Abo).
          Die Bereiche für Objekte, Kalender, Preise, Reservierungen und
          Bewertungen folgen hier.
        </p>
      </section>
    </main>
  );
}
