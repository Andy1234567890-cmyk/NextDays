// Vollbild-Layout des 2FA-Wizards (Airbnb-Muster): schlichter Kopf mit Titel
// mittig + X-Schließen links, sonst nichts. Auth-Guard hier separat.
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMe } from "@/lib/me";

export default async function ZweiFaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [me, t] = await Promise.all([getMe(), getTranslations("zweifa")]);
  if (!me?.tenant_id) redirect("/anmelden?weiter=/zwei-faktor");

  return (
    <div className="min-h-screen bg-background">
      <header className="relative flex h-16 items-center border-b border-border px-6">
        <Link
          href="/konto?bereich=sicherheit"
          aria-label={t("abbrechen")}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <span className="text-xl leading-none">×</span>
        </Link>
        <span className="absolute left-1/2 -translate-x-1/2 text-[0.9375rem] font-semibold">
          {t("titelKopf")}
        </span>
      </header>
      {children}
    </div>
  );
}
