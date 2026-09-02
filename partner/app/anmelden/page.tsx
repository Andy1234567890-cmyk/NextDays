// Anmeldung. Server Component: schon eingeloggt → ins Dashboard.
import { sicheresZiel } from "@nextdays/auth/weiterleitung";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AnmeldeFormular } from "@/components/anmelde-formular";
import { Logo } from "@/components/logo";
import { getMe } from "@/lib/partner";

export default async function AnmeldenSeite({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { weiter } = await searchParams;
  const ziel = sicheresZiel(weiter, "/");
  const me = await getMe();
  if (me) redirect(ziel);
  const t = await getTranslations("anmelden");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <p className="flex items-center gap-3">
          <Logo heightRem={2} />
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">{t("partner")}</span>
        </p>
        <h1 className="mt-6 font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
        <p className="mt-2 text-muted-foreground">{t("text")}</p>
        <AnmeldeFormular weiter={ziel} />
        <p className="mt-8 text-sm text-muted-foreground">
          {t("nochKeinKonto")}{" "}
          <Link href="/bewerben" className="font-semibold text-foreground underline-offset-4 hover:underline">
            {t("bewerben")}
          </Link>
        </p>
      </div>
    </div>
  );
}
