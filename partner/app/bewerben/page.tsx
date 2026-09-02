// Bewerbung als Partner. Legt Login und Partnerzeile an (Status „in Prüfung").
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BewerbungsFormular } from "@/components/bewerbungs-formular";
import { Logo } from "@/components/logo";
import { getMe } from "@/lib/partner";
import { TERMS_VERSION } from "@/lib/terms";

export default async function BewerbenSeite({
  searchParams,
}: {
  searchParams: Promise<{ sponsor?: string; team?: string }>;
}) {
  const { sponsor } = await searchParams;
  const me = await getMe();
  if (me) redirect("/");
  const t = await getTranslations("bewerben");

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <p className="flex items-center gap-3">
          <Logo heightRem={2} />
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">{t("partner")}</span>
        </p>
        <h1 className="mt-6 font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
        <p className="mt-2 text-muted-foreground">{t("text")}</p>
        <BewerbungsFormular termsVersion={TERMS_VERSION} sponsorVorgabe={(sponsor ?? "").slice(0, 40)} />
        <p className="mt-8 text-sm text-muted-foreground">
          {t("schonPartner")}{" "}
          <Link href="/anmelden" className="font-semibold text-foreground underline-offset-4 hover:underline">
            {t("anmelden")}
          </Link>
        </p>
      </div>
    </div>
  );
}
