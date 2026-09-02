// Beiträge (0521): je Reel/Video/Post ein eigener Link, dazu Klicks, Kunden
// und — bei verbundenem Konto — Views aus der Plattform.
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BeitragAnlegen } from "@/components/beitrag-anlegen";
import { BeitragKarte } from "@/components/beitrag-karte";
import { PLATTFORMEN } from "@/lib/kanaele";
import { getCodes, getMe } from "@/lib/partner";
import { getBeitraege } from "@/lib/reichweite";

export default async function BeitraegeSeite() {
  const [t, me] = await Promise.all([getTranslations("beitraege"), getMe()]);
  if (!me || me.status !== "approved") redirect("/");
  const [codes, beitraege] = await Promise.all([getCodes(), getBeitraege()]);
  const verbunden = me.channels.some((k) => k.verified);

  return (
    <div>
      <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("hinweis")}</p>
      {!verbunden && (
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {t("kontoHinweis")}{" "}
          <Link href="/profil#kanaele" className="font-semibold underline-offset-4 hover:underline">
            {t("kontoVerbinden")}
          </Link>
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("neu")}</h2>
        <BeitragAnlegen codes={codes} plattformen={[...PLATTFORMEN]} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("liste", { n: beitraege.length })}
        </h2>
        {beitraege.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("leer")}</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {beitraege.map((b) => (
              <BeitragKarte key={b.id} beitrag={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
