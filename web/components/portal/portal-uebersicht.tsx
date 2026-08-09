"use client";

// Eigentümer-Portal · Übersicht. Kennzahlen des gewählten Zeitraums, die eigenen
// Objekte und der Auszahlungsstand.
//
// Sichtbar ist ausschließlich die NETTO-Auszahlung des Eigentümers — nie ein
// Gast-Gesamtpreis (§4.2). Liefert das Backend `payout: null` (die Maske
// erlaubt dem Eigentümer keine Beträge), wird „—" gerendert, NIE 0 und nie ein
// Ersatzwert (Wurzel 4).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { PortalRealtime } from "@/components/portal/portal-realtime";
import { Card, CardContent } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type {
  PortalEarnings,
  PortalProperty,
  PortalStatement,
} from "@/lib/portal";

/** Nächte zwischen zwei ISO-Tagen, Ende inklusiv (Zeitraumlänge). */
function tageImZeitraum(von: string, bis: string): number {
  const a = Date.parse(`${von}T00:00:00Z`);
  const b = Date.parse(`${bis}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function PortalUebersicht({
  art,
  von,
  bis,
  properties,
  propertiesError,
  earnings,
  earningsError,
  statements,
  statementsError,
}: {
  art: "monat" | "jahr";
  von: string;
  bis: string;
  properties: PortalProperty[];
  propertiesError: string | null;
  earnings: PortalEarnings | null;
  earningsError: string | null;
  statements: PortalStatement[];
  statementsError: string | null;
}) {
  const t = useTranslations("portal");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  // Realtime statt Reload: eine neue/geänderte Buchung verändert Belegung UND
  // Auszahlung. `owner_statements` ist bewusst NICHT abonniert (Wurzel 6 —
  // authenticated hat dort kein SELECT, das Abo wäre eine Attrappe); die
  // Abrechnungen hängen an denselben Reservierungen.
  const aktualisieren = useCallback(() => router.refresh(), [router]);

  const zeitraumWechseln = (naechste: "monat" | "jahr") => {
    const p = new URLSearchParams(params?.toString() ?? "");
    if (naechste === "jahr") p.set("zeitraum", "jahr");
    else p.delete("zeitraum");
    const qs = p.toString();
    router.push(qs ? `/portal?${qs}` : "/portal");
  };

  const naechte = earnings?.items.reduce((s, i) => s + i.nights, 0) ?? 0;
  const buchungen =
    earnings?.items.reduce((s, i) => s + i.reservations, 0) ?? 0;
  // Belegung = belegte Nächte / (Zeitraumlänge × Anzahl Objekte). Ohne Objekte
  // ist die Quote nicht definiert → null, kein "0 %" (Wurzel 4).
  const kapazitaet = tageImZeitraum(von, bis) * properties.length;
  const belegung = kapazitaet > 0 ? Math.round((naechte / kapazitaet) * 100) : null;

  const auszahlung = earnings?.total_payout ?? null;
  const waehrung = earnings?.currency ?? null;

  // Neueste finalisierte Abrechnung. Sortiert über period_to, nicht über
  // created_at: created_at ist UNSERE Verarbeitungszeit, nicht der Zeitraum,
  // um den es geht (Wurzel 5b).
  const letzte = [...statements]
    .filter((s) => s.status === "finalized")
    .sort((a, b) => b.period_to.localeCompare(a.period_to))[0];

  const fehler = propertiesError ?? earningsError ?? statementsError;

  return (
    <div className="flex flex-col gap-6">
      <PortalRealtime
        quellen={["reservations", "availability", "properties"]}
        onChange={aktualisieren}
      />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {fehler && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {fehler}
        </div>
      )}

      {/* Zeitraum-Umschalter — Monat/Jahr, wie im Branchenmuster wählbar. */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("overview.period")}
        </span>
        <div className="flex gap-1">
          {(["monat", "jahr"] as const).map((wert) => (
            <button
              key={wert}
              type="button"
              onClick={() => zeitraumWechseln(wert)}
              aria-pressed={art === wert}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                art === wert
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {t(wert === "monat" ? "overview.periodMonth" : "overview.periodYear")}
            </button>
          ))}
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kennzahl
          icon="ph:chart-pie-slice"
          label={t("overview.occupancy")}
          hint={t("overview.occupancyHint")}
          wert={belegung === null ? t("amountHidden") : `${belegung} %`}
        />
        <Kennzahl
          icon="ph:moon"
          label={t("overview.nights")}
          wert={String(naechte)}
        />
        <Kennzahl
          icon="ph:bookmark-simple"
          label={t("overview.bookings")}
          wert={String(buchungen)}
        />
        <Kennzahl
          icon="ph:hand-coins"
          label={t("overview.payout")}
          hint={t("overview.payoutHint")}
          // null = keine Beträge-Sicht → „—". Kein 0, kein erfundener Wert.
          wert={
            auszahlung === null
              ? t("amountHidden")
              : formatCurrency(auszahlung, waehrung, locale)
          }
        />
      </div>

      {/* Letzte Abrechnung */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Icon icon="ph:receipt" className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-muted-foreground">
              {t("overview.latestStatement")}
            </span>
            <span className="truncate text-sm font-medium">
              {letzte
                ? `${letzte.period_from} – ${letzte.period_to}`
                : t("overview.noStatement")}
            </span>
          </div>
          {letzte && (
            <span className="shrink-0 text-sm font-semibold">
              {formatCurrency(letzte.owner_payout, letzte.currency, locale)}
            </span>
          )}
          <Link
            href="/portal/berichte"
            className="shrink-0 rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            {t("reports.title")}
          </Link>
        </CardContent>
      </Card>

      {/* Objekte */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">
          {t("properties.title")}
        </h2>
        {properties.length === 0 && !propertiesError ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Icon icon="ph:house-line" className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                {t("properties.empty")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {properties.map((p) => {
              const zeile = earnings?.items.find(
                (i) => i.property_id === p.id,
              );
              return (
                <li key={p.id}>
                  <Card className="h-full">
                    <CardContent className="flex flex-col gap-3 py-4">
                      <div className="flex items-center gap-3">
                        {/* Objektfoto: <img>, weil die URL aus dem Storage
                            kommt und keine feste Domänenliste hat. */}
                        {p.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.photo}
                            alt=""
                            className="size-12 shrink-0 rounded-(--radius) object-cover"
                          />
                        ) : (
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-(--radius) bg-secondary text-muted-foreground">
                            <Icon icon="ph:house-line" className="size-5" />
                          </span>
                        )}
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {p.title}
                          </span>
                          {p.city && (
                            <span className="truncate text-xs text-muted-foreground">
                              {p.city}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {zeile?.nights ?? 0} · {t("overview.nights")}
                        </span>
                        <span className="font-semibold text-foreground">
                          {zeile == null || zeile.payout === null
                            ? t("amountHidden")
                            : formatCurrency(
                                zeile.payout,
                                zeile.currency,
                                locale,
                              )}
                        </span>
                      </div>

                      <Link
                        href={`/portal/kalender?objekt=${encodeURIComponent(p.id)}`}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
                      >
                        <Icon icon="ph:calendar-blank" className="size-4" />
                        {t("properties.openCalendar")}
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kennzahl({
  icon,
  label,
  hint,
  wert,
}: {
  icon: string;
  label: string;
  hint?: string;
  wert: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon icon={icon} className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="font-display text-2xl font-extrabold">{wert}</span>
          {hint && (
            <span className="text-xs text-muted-foreground">{hint}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
