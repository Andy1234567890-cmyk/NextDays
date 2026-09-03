// Neues Passwort setzen — Ziel des Reset-Wegs.
//
// DIESE SEITE FEHLTE (03.09.2026): `passwort-vergessen` verschickte die Mail,
// aber es gab keine Route, die den Code annimmt und ein Passwort setzt. Der
// Link in der Mail zeigte auf `{API_EXTERNAL_URL}/verify?token=…` und endete
// in Kongs „no Route matched" — der Reset-Weg war also nicht bloss falsch
// verdrahtet, er war unfertig.
//
// `?email=` wird nur VORBELEGT, nicht vertraut: der Code wird serverseitig
// gegen Adresse UND Code geprüft (`verify_otp` mit `type=recovery`), ein
// manipulierter Parameter bringt also nichts. Bequemlichkeit ohne Zusage.
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { PasswortNeuFormular } from "@/components/passwort-neu-formular";
import { getMe } from "@/lib/partner";

export default async function PasswortNeuSeite({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const me = await getMe();
  if (me) redirect("/");
  const t = await getTranslations("anmelden");
  const { email } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <p className="flex items-center gap-3">
          <Logo heightRem={2} />
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">
            {t("partner")}
          </span>
        </p>
        <h1 className="mt-6 font-sans text-[1.75rem] font-bold tracking-tight">
          {t("passwortSetzen")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("passwortNeuIntro")}</p>
        <PasswortNeuFormular email={email} />
        <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <Link
            href="/passwort-vergessen"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {t("resetNeuAnfordern")}
          </Link>
          <Link
            href="/anmelden"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {t("anmelden")}
          </Link>
        </p>
      </div>
    </div>
  );
}
