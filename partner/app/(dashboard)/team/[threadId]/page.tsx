// Verlauf einer Team-Unterhaltung. Der Server prüft, dass der Aufrufer Beteiligter ist.
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TeamChatVerlauf } from "@/components/team-chat-verlauf";
import { ApiError } from "@nextdays/auth/errors";
import { getMe, getTeamNachrichten, getTeamThreads } from "@/lib/partner";

export default async function TeamChatSeite({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const [t, locale, me] = await Promise.all([getTranslations("team.chat"), getLocale(), getMe()]);
  if (!me || me.status !== "approved") redirect("/");
  let nachrichten;
  try {
    nachrichten = await getTeamNachrichten(threadId);
  } catch (exc) {
    if (exc instanceof ApiError && (exc.status === 404 || exc.status === 403)) notFound();
    throw exc;
  }
  const thread = (await getTeamThreads()).find((th) => th.id === threadId);

  return (
    <div>
      <Link href="/team" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← {t("zurueck")}
      </Link>
      <h1 className="mt-2 font-sans text-[1.75rem] font-bold tracking-tight">{thread?.partner_name ?? t("titel")}</h1>
      {thread && <p className="mt-1 text-sm text-muted-foreground">{t(`rolle.${thread.role}`)}</p>}
      <TeamChatVerlauf threadId={threadId} nachrichten={nachrichten} locale={locale} />
    </div>
  );
}
