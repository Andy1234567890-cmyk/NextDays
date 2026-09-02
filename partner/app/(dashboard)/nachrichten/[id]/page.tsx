// Verlauf einer Konversation mit dem Partnerteam.
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NachrichtVerlauf } from "@/components/nachricht-verlauf";
import { ApiError } from "@/lib/api-server";
import { getMe } from "@/lib/partner";
import { getKonversation } from "@/lib/support";
import { gelesen } from "@/lib/support-actions";

export default async function KonversationSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, locale, me] = await Promise.all([getTranslations("nachrichten"), getLocale(), getMe()]);
  if (!me || me.status !== "approved") redirect("/");
  let k;
  try {
    k = await getKonversation(id);
  } catch (exc) {
    if (exc instanceof ApiError && exc.status === 404) notFound();
    throw exc;
  }
  await gelesen(id);
  return (
    <div>
      <Link href="/nachrichten" className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
        ← {t("titel")}
      </Link>
      <NachrichtVerlauf konversation={k} locale={locale} />
    </div>
  );
}
