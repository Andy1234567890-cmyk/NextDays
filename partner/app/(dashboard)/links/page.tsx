// Links, Codes, Werbematerial und die Pflicht-Kennzeichnung.
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { CodeAnlegen } from "@/components/code-anlegen";
import { CodeKarte } from "@/components/code-karte";
import { KENNZEICHNUNG } from "@/lib/kennzeichnung";
import { getCodes, getMaterial, getMe } from "@/lib/partner";

export default async function LinksSeite() {
  const [t, me] = await Promise.all([getTranslations("links"), getMe()]);
  if (!me || me.status !== "approved") redirect("/");
  const [codes, material] = await Promise.all([getCodes(), getMaterial()]);

  return (
    <div>
      <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("hinweis")}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {codes.map((c) => (
          <CodeKarte key={c.id} code={c} />
        ))}
      </div>
      {codes.length < 10 && <CodeAnlegen />}

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("kennzeichnung.titel")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("kennzeichnung.text")}</p>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {KENNZEICHNUNG.map((k) => (
            <li key={k.land} className="rounded-2xl border border-border p-5 text-sm">
              <p className="font-semibold">{t(`kennzeichnung.land.${k.land}`)}</p>
              <p className="mt-2">
                <span className="text-muted-foreground">{t("kennzeichnung.imBeitrag")}: </span>
                {k.beitrag.map((w) => (
                  <code key={w} className="mr-2 rounded bg-muted px-1.5 py-0.5">{w}</code>
                ))}
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground">{t("kennzeichnung.amLink")}: </span>
                {k.link.map((w) => (
                  <code key={w} className="mr-2 rounded bg-muted px-1.5 py-0.5">{w}</code>
                ))}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{k.quelle}</p>
            </li>
          ))}
          <li className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            {t("kennzeichnung.andere")}
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("material.titel")}</h2>
        {material.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("material.leer")}</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {material.map((m) => (
              <li key={m.id} className="rounded-2xl border border-border p-5 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`material.art.${m.kind}`)}</p>
                <p className="mt-1 font-semibold">{m.title}</p>
                {m.description && <p className="mt-1 text-muted-foreground">{m.description}</p>}
                {m.body && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">{m.body}</pre>}
                {m.url && (
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-semibold underline-offset-4 hover:underline">
                    {t("material.oeffnen")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
