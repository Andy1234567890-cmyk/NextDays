"use client";

// Ein Beitrag mit Link, QR (für Stories), Kennzahlen aus unseren Daten (Klicks,
// Registrierungen, Kunden) und — falls das Konto verbunden ist — aus der
// Plattform (Views, Likes …). Die Adresse lässt sich nachtragen; gelöscht werden
// kann nur ein Beitrag ohne Registrierung (der Server lehnt sonst ab).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { BeitragFreigabe } from "@/components/beitrag-freigabe";
import { KanalIcon } from "@/components/kanal-icon";
import { datum, datumZeit } from "@/lib/format";
import { type Plattform, PLATTFORM_META } from "@/lib/kanaele";
import type { Beitrag } from "@/lib/reichweite";
import { beitragAendern, beitragLoeschen } from "@/lib/reichweite-actions";

function Zahl({ label, wert, hinweis }: { label: string; wert: string; hinweis?: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{wert}</p>
      {hinweis && <p className="text-[0.6875rem] text-muted-foreground">{hinweis}</p>}
    </div>
  );
}

export function BeitragKarte({ beitrag }: { beitrag: Beitrag }) {
  const t = useTranslations("beitraege");
  const locale = useLocale();
  const [laeuft, starte] = useTransition();
  const [qr, setQr] = useState(false);
  const [urlBearbeiten, setUrlBearbeiten] = useState(false);
  const [url, setUrl] = useState(beitrag.url ?? "");
  const zahl = (n: number | null | undefined) => (n === null || n === undefined ? "—" : new Intl.NumberFormat(locale).format(n));
  const plattform = (beitrag.platform in PLATTFORM_META ? beitrag.platform : "other") as Plattform;
  const m = beitrag.metrics;

  async function kopieren(wert: string) {
    try {
      await navigator.clipboard.writeText(wert);
      toast.success(t("kopiert"));
    } catch {
      toast.error(t("kopierenFehlgeschlagen"));
    }
  }

  return (
    <article className="rounded-2xl border border-border p-5">
      <div className="flex items-start gap-3">
        <KanalIcon platform={plattform} className="size-6" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{beitrag.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {PLATTFORM_META[plattform].label} · <span className="font-mono">{beitrag.code}</span>
            {beitrag.published_at ? ` · ${t("veroeffentlicht", { datum: datum(beitrag.published_at, locale) })}` : ""}
          </p>
        </div>
        {beitrag.registrations === 0 && (
          <button
            type="button"
            aria-label={t("loeschen")}
            title={t("loeschen")}
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const res = await beitragLoeschen(beitrag.id);
                if (res.ok) toast.success(t("geloescht"));
                else toast.error(res.status === 409 ? t("loeschenGesperrt") : t("fehler"));
              })
            }
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <Icon icon="ph:trash" className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 text-sm">
        {beitrag.link ? (
          <button
            type="button"
            onClick={() => kopieren(beitrag.link as string)}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left hover:border-foreground"
          >
            <span className="truncate font-mono text-xs">{beitrag.link}</span>
            <Icon icon="ph:copy" className="size-4 shrink-0" />
          </button>
        ) : beitrag.review_status !== "approved" ? (
          // Kein Link, weil das Video nicht freigegeben ist (0523) — der Block
          // sagt, wer am Zug ist, statt nur „Link fehlt" zu melden.
          <BeitragFreigabe beitrag={beitrag} />
        ) : (
          <p className="text-xs text-muted-foreground">{t("linkFehlt")}</p>
        )}
        {beitrag.link && <BeitragFreigabe beitrag={beitrag} />}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {beitrag.link && (
            <button type="button" onClick={() => setQr((v) => !v)} className="flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline">
              <Icon icon="ph:qr-code" className="size-4" />
              {qr ? t("qrSchliessen") : t("qrZeigen")}
            </button>
          )}
          {beitrag.url ? (
            <a href={beitrag.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 underline-offset-4 hover:underline">
              <Icon icon="ph:arrow-square-out" className="size-4" />
              {t("beitragOeffnen")}
            </a>
          ) : null}
          <button type="button" onClick={() => setUrlBearbeiten((v) => !v)} className="flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:underline">
            <Icon icon="ph:pencil-simple" className="size-4" />
            {beitrag.url ? t("urlAendern") : t("urlNachtragen")}
          </button>
        </div>
        {qr && beitrag.link && (
          <div className="mt-2 flex flex-col items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG vom eigenen BFF, kein Optimizer nötig */}
            <img src={`/api/beitraege/${beitrag.id}/qr`} alt={t("qrAlt")} width={220} height={220} className="rounded-xl border border-border bg-white p-2" />
            <p className="text-xs text-muted-foreground">{t("qrHinweis")}</p>
          </div>
        )}
        {urlBearbeiten && (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              starte(async () => {
                const res = await beitragAendern(beitrag.id, { url: url.trim() || null });
                if (res.ok) {
                  toast.success(t("gespeichert"));
                  setUrlBearbeiten(false);
                } else toast.error(res.status === 422 ? res.fehler : t("fehler"));
              });
            }}
          >
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={500}
              placeholder={PLATTFORM_META[plattform].beispiel}
              className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-4 py-2 text-sm outline-none focus-visible:border-foreground"
            />
            <button type="submit" disabled={laeuft} className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50">
              {t("speichern")}
            </button>
          </form>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Zahl label={t("kennzahl.klicks")} wert={zahl(beitrag.clicks_90d)} hinweis={t("kennzahl.klicks30", { n: zahl(beitrag.clicks_30d) })} />
        <Zahl label={t("kennzahl.registrierungen")} wert={zahl(beitrag.registrations)} />
        <Zahl label={t("kennzahl.kunden")} wert={zahl(beitrag.paying_customers)} />
        <Zahl
          label={t("kennzahl.views")}
          wert={zahl(m?.views)}
          hinweis={m ? t("kennzahl.gemessen", { zeit: datumZeit(m.measured_at, locale) }) : t("kennzahl.nichtVerbunden")}
        />
      </div>
      {m && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("kennzahl.interaktion", { likes: zahl(m.likes), kommentare: zahl(m.comments), shares: zahl(m.shares), saves: zahl(m.saves) })}
          {beitrag.clicks_per_1000_views !== null ? ` · ${t("kennzahl.pro1000", { n: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(beitrag.clicks_per_1000_views) })}` : ""}
        </p>
      )}
    </article>
  );
}
