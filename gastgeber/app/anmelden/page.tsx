// Login/Registrierung des Gastgebers. Server Component: prüft serverseitig, ob
// schon eingeloggt (getMe) → dann direkt ins Dashboard.
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getMe } from "@/lib/me";

export default async function AnmeldenPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { weiter } = await searchParams;
  const ziel = weiter && weiter.startsWith("/") ? weiter : "/";

  const me = await getMe();
  if (me?.tenant_id) redirect(ziel);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="relative hidden flex-1 flex-col justify-between bg-primary p-12 text-primary-foreground md:flex">
        <span className="font-display text-2xl font-semibold">myNextDays</span>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Vermiete auf myNextDays.
          </h1>
          <p className="mt-4 max-w-md text-primary-foreground/70">
            Stelle dein Objekt ein, verwalte Kalender, Preise und Buchungen.
            8 % Provision zahlst du nur auf Buchungen, die über myNextDays
            zustande kommen — Direktbuchungen über deine eigene Seite bleiben
            provisionsfrei.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-primary-foreground/60">
          <span>Keine Grundgebühr</span>
          <span>Sofort startklar</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 md:hidden">
          <span className="font-display text-2xl font-semibold">myNextDays</span>
        </div>
        <AuthForm weiter={ziel} />
        <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
          Mit der Anmeldung stimmst du den Nutzungsbedingungen und der
          Datenschutzerklärung von myNextDays zu.
        </p>
      </div>
    </div>
  );
}
