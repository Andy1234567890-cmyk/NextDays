// Passwort zurücksetzen (eigene Seite; der Anmeldeschirm bietet es zusätzlich
// inline an). Schon eingeloggt → ins Dashboard.
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PasswortVergessenFormular } from "@/components/passwort-vergessen-formular";
import { Logo } from "@/components/logo";
import { getMe } from "@/lib/partner";

export default async function PasswortVergessenSeite() {
  const me = await getMe();
  if (me) redirect("/");
  const t = await getTranslations("anmelden");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <p className="flex items-center gap-3">
          <Logo heightRem={2} />
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">{t("partner")}</span>
        </p>
        <h1 className="mt-6 font-sans text-[1.75rem] font-bold tracking-tight">{t("passwortVergessen")}</h1>
        <p className="mt-2 text-muted-foreground">{t("resetGesendet")}</p>
        <PasswortVergessenFormular />
        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/anmelden" className="font-semibold text-foreground underline-offset-4 hover:underline">
            {t("anmelden")}
          </Link>
        </p>
      </div>
    </div>
  );
}
