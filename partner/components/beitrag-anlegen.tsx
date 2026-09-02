"use client";

// Link-Generator je Beitrag (0521): Code + Plattform + Titel → eigener Link mit
// utm_content. Die Veröffentlichung ist die Angabe des Partners (kein Ersatz
// durch unsere Uhr); die Beitrags-Adresse darf später nachgetragen werden.
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { KanalIcon } from "@/components/kanal-icon";
import { type Plattform, PLATTFORM_META, PLATTFORMEN } from "@/lib/kanaele";
import type { Code } from "@/lib/partner";
import { beitragAnlegen } from "@/lib/reichweite-actions";

const FELD =
  "rounded-full border border-border bg-transparent px-4 py-2 text-sm normal-case tracking-normal outline-none focus-visible:border-foreground";

export function BeitragAnlegen({ codes, plattformen }: { codes: Code[]; plattformen: Plattform[] }) {
  const t = useTranslations("beitraege");
  const [laeuft, starte] = useTransition();
  const aktive = codes.filter((c) => c.active);
  const [codeId, setCodeId] = useState(aktive[0]?.id ?? "");
  const [platform, setPlatform] = useState<Plattform>(plattformen[0] ?? "instagram");
  const [titel, setTitel] = useState("");
  const [url, setUrl] = useState("");
  const [datum, setDatum] = useState("");

  if (aktive.length === 0) return <p className="mt-4 text-sm text-muted-foreground">{t("keinCode")}</p>;

  return (
    <form
      className="mt-4 grid gap-3 rounded-2xl border border-border p-5 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!titel.trim()) return;
        starte(async () => {
          const res = await beitragAnlegen(codeId, {
            title: titel.trim(),
            platform,
            url: url.trim() || null,
            published_at: datum ? new Date(`${datum}T12:00:00`).toISOString() : null,
            utm_content: null,
          });
          if (res.ok) {
            toast.success(t("angelegt"));
            setTitel("");
            setUrl("");
            setDatum("");
          } else toast.error(res.status === 409 ? t("doppelt") : res.status === 422 ? res.fehler : t("fehler"));
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("feld.titel")}
        <input value={titel} onChange={(e) => setTitel(e.target.value)} required maxLength={200} placeholder={t("feld.titelBeispiel")} className={FELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("feld.plattform")}
        <span className="flex items-center gap-2">
          <KanalIcon platform={platform} className="size-5 shrink-0" />
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Plattform)} className={`${FELD} w-full pr-10`}>
            {PLATTFORMEN.map((p) => (
              <option key={p} value={p}>
                {PLATTFORM_META[p].label}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("feld.code")}
        <select value={codeId} onChange={(e) => setCodeId(e.target.value)} className={`${FELD} font-mono pr-10`}>
          {aktive.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
              {c.label ? ` · ${c.label}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("feld.datum")}
        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={FELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:col-span-2">
        {t("feld.url")}
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder={PLATTFORM_META[platform].beispiel} className={FELD} />
        <span className="font-normal normal-case tracking-normal">{t("feld.urlHinweis")}</span>
      </label>
      <div className="md:col-span-2">
        <button type="submit" disabled={laeuft || !titel.trim()} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
          {t("linkErzeugen")}
        </button>
      </div>
    </form>
  );
}
