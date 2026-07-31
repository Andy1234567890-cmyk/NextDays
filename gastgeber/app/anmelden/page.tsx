// Login/Registrierung des Gastgebers. Server Component: prüft serverseitig, ob
// schon eingeloggt (getMe) → dann direkt ins Dashboard.
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";
import { getMe } from "@/lib/me";

// Provisionssatz steht an einer Stelle, nicht doppelt in Text und Logik —
// sonst laufen angezeigter und berechneter Satz auseinander.
const PROVISION_PROZENT = 8;

export default async function AnmeldenPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { weiter } = await searchParams;
  const ziel = weiter && weiter.startsWith("/") ? weiter : "/";

  const me = await getMe();
  if (me?.tenant_id) redirect(ziel);

  const t = await getTranslations("anmeldeseite");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="relative hidden flex-1 flex-col justify-between bg-primary p-12 text-primary-foreground md:flex">
        <Logo variant="light" heightRem={2.25} />
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">
            {t("heldTitel")}
          </h1>
          <p className="mt-4 max-w-md text-primary-foreground/70">
            {t("heldText", { pct: PROVISION_PROZENT })}
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-primary-foreground/60">
          <span>{t("merkmalKeineGrundgebuehr")}</span>
          <span>{t("merkmalSofortStartklar")}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 md:hidden">
          <Logo heightRem={2.25} />
        </div>
        <AuthForm weiter={ziel} />
        <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
          {t("rechtshinweis")}
        </p>
      </div>
    </div>
  );
}
