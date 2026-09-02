// Nachrichten: Konversationen mit dem Partnerteam (Support-Modell, 0518).
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { NachrichtenListe } from "@/components/nachrichten-liste";
import { getMe } from "@/lib/partner";
import { getKonversationen } from "@/lib/support";

export default async function NachrichtenSeite() {
  const [t, locale, me] = await Promise.all([getTranslations("nachrichten"), getLocale(), getMe()]);
  if (!me || me.status !== "approved") redirect("/");
  const liste = await getKonversationen();
  return (
    <div>
      <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("hinweis")}</p>
      <NachrichtenListe konversationen={liste.items} locale={locale} />
    </div>
  );
}
