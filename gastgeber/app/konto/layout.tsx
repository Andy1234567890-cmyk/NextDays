// Kontoeinstellungen-Layout — eigenständige Seite wie Airbnbs /account-settings:
// schlichter Kopf (Logo links, „Fertig" rechts zurück zum Dashboard), KEINE
// Top-Nav. Auth-Guard hier separat (außerhalb der (dashboard)-Group).
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMe } from "@/lib/me";

export default async function KontoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [me, t] = await Promise.all([getMe(), getTranslations("konto")]);
  if (!me?.tenant_id) redirect("/anmelden?weiter=/konto");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="flex h-20 items-center justify-between px-8">
          <Link
            href="/"
            className="font-display text-2xl font-bold tracking-tight text-foreground"
          >
            myNextDays
          </Link>
          <Link
            href="/"
            className="rounded-full bg-muted px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/70"
          >
            {t("fertig")}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
