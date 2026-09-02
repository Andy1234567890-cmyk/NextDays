"use client";

// Verbundene Plattform-Konten (0521): freiwillig, jederzeit trennbar. Ohne
// Verbindung zählt die Selbstauskunft; mit Verbindung kommen Follower und
// Views aus der Quelle. Ein Anbieter ohne Zugangsdaten in der Umgebung ist
// nicht verbindbar — der Knopf fehlt, der Grund steht darunter.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import { KanalIcon } from "@/components/kanal-icon";
import { datumZeit } from "@/lib/format";
import { type Plattform, PLATTFORM_META } from "@/lib/kanaele";
import type { KanalUebersicht, Provider } from "@/lib/reichweite";
import { kontoTrennen, kontoVerbinden } from "@/lib/reichweite-actions";

const PROVIDER_LABEL: Record<Provider, string> = { youtube: "YouTube", meta: "Instagram / Facebook", tiktok: "TikTok" };
const PROVIDER_ICON: Record<Provider, Plattform> = { youtube: "youtube", meta: "instagram", tiktok: "tiktok" };

export function KanalVerbindungen({ uebersicht }: { uebersicht: KanalUebersicht }) {
  const t = useTranslations("kanalVerbindung");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [laeuft, starte] = useTransition();
  const gemeldet = useRef(false);
  const zahl = (n: number | null) => (n === null ? "—" : new Intl.NumberFormat(locale).format(n));

  // Rückkehr vom OAuth-Rücksprung: einmal melden, dann die Parameter aus der
  // Adresse nehmen, damit ein Reload die Meldung nicht wiederholt.
  useEffect(() => {
    const ergebnis = params.get("kanal");
    if (!ergebnis || gemeldet.current) return;
    gemeldet.current = true;
    const grund = params.get("grund") ?? "";
    // Erst nach dem nächsten Tick melden: dieser Effekt läuft VOR dem des
    // <Toaster> im Root-Layout (Kind vor Geschwister), ein sofortiger toast()
    // verhallte ungehört — gemessen 02.09.2026 im Debug-Chrome.
    const timer = window.setTimeout(() => {
      if (ergebnis === "verbunden") toast.success(t("rueckkehr.verbunden"));
      else if (ergebnis === "abgelehnt") toast.error(t("rueckkehr.abgelehnt"));
      else toast.error(grund ? `${t("rueckkehr.fehler")} ${grund}` : t("rueckkehr.fehler"));
    }, 0);
    router.replace(`${pathname}#kanaele`);
    return () => window.clearTimeout(timer);
  }, [params, pathname, router, t]);

  const aktive = uebersicht.connections.filter((c) => !c.revoked_at);
  const getrennte = uebersicht.connections.filter((c) => c.revoked_at);

  return (
    <section id="kanaele" className="rounded-2xl border border-border p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("titel")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("hinweis")}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {uebersicht.providers.map((p) =>
          p.configured ? (
            <button
              key={p.provider}
              type="button"
              disabled={laeuft}
              onClick={() =>
                starte(async () => {
                  const res = await kontoVerbinden(p.provider);
                  // Bei Erfolg leitet die Action um; hier landet nur der Fehlerfall.
                  if (!res.ok) toast.error(res.status === 503 ? t("nichtKonfiguriert") : t("fehler"));
                })
              }
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-foreground disabled:opacity-50"
            >
              <KanalIcon platform={PROVIDER_ICON[p.provider]} className="size-4" />
              {t("verbinden", { anbieter: PROVIDER_LABEL[p.provider] })}
            </button>
          ) : (
            <span
              key={p.provider}
              title={t("nichtKonfiguriert")}
              className="flex items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground"
            >
              <KanalIcon platform={PROVIDER_ICON[p.provider]} className="size-4 opacity-60" />
              {PROVIDER_LABEL[p.provider]} · {t("baldVerfuegbar")}
            </span>
          ),
        )}
      </div>

      {aktive.length > 0 && (
        <ul className="mt-5 divide-y divide-border text-sm">
          {aktive.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <KanalIcon platform={(c.platform in PLATTFORM_META ? c.platform : "other") as Plattform} className="size-5" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {c.account_url ? (
                    <a href={c.account_url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                      {c.account_name ?? c.external_account_id}
                    </a>
                  ) : (
                    c.account_name ?? c.external_account_id
                  )}
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-foreground">
                    <Icon icon="ph:seal-check" className="size-3.5" />
                    {t("verifiziert")}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("follower", { n: zahl(c.followers) })}
                  {c.views_28d !== null ? ` · ${t("views28", { n: zahl(c.views_28d) })}` : ""}
                  {c.engagement_rate !== null ? ` · ${t("engagement", { n: (c.engagement_rate * 100).toFixed(2) })}` : ""}
                  {c.measured_at ? ` · ${t("gemessen", { zeit: datumZeit(c.measured_at, locale) })}` : ` · ${t("nochKeinSnapshot")}`}
                </p>
                {c.last_error && <p className="mt-0.5 text-xs text-accent">{t("letzterFehler")}: {c.last_error}</p>}
              </div>
              <button
                type="button"
                disabled={laeuft}
                onClick={() =>
                  starte(async () => {
                    const res = await kontoTrennen(c.id);
                    if (res.ok) toast.success(t("getrennt"));
                    else toast.error(t("fehler"));
                  })
                }
                className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
              >
                {t("trennen")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {getrennte.length > 0 && (
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer">{t("getrennteKonten", { n: getrennte.length })}</summary>
          <ul className="mt-2 space-y-1">
            {getrennte.map((c) => (
              <li key={c.id}>
                {PLATTFORM_META[(c.platform in PLATTFORM_META ? c.platform : "other") as Plattform].label} · {c.account_name ?? c.external_account_id} ·{" "}
                {t("getranntAm", { zeit: datumZeit(c.revoked_at, locale) })}
                {c.revoked_reason?.startsWith("plattform") ? ` · ${t("durchPlattform")}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-4 text-xs text-muted-foreground">{t("datenschutz")}</p>
    </section>
  );
}
