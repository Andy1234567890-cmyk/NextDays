"use client";

// Eigentümer-Portal · Berichte: finalisierte Abrechnungen (mit PDF-Download),
// laufender Abrechnungsstand und Monats-/Jahresbericht.
//
// PDF-DOWNLOAD: der Weg existiert für die Agentur (lib/statement-pdf.ts,
// `downloadStatementPdf`) und wird hier für den Eigentümer nutzbar gemacht.
// Wichtig für den Datenschutz: das PDF wird aus dem VOLLEN Statement gebaut,
// das über /owner-statements/{id} kommt — und dieser Endpunkt maskiert
// serverseitig nach `load_guest_mask`. Ein Eigentümer bekommt dort nur den
// VORNAMEN des Gastes und (ohne PM_BOOKING_TOTAL) keine Gast-Beträge. Die
// Maskierung passiert also nicht hier im Client, sondern an der Quelle — sie
// lässt sich nicht durch einen direkten Aufruf umgehen (Wurzel 3/6).
//
// Nur EIGENE und nur FINALISIERTE Abrechnungen: die Liste kommt aus
// /public-portal/statements (self-scoped), der Knopf erscheint nur bei
// status === "finalized". Entwürfe sind nicht verbindlich und gehören dem
// Eigentümer nicht in die Hand.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalRealtime } from "@/components/portal/portal-realtime";
import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { formatCurrency } from "@/lib/currency";
import { getStatement } from "@/lib/owner-statements";
import { type PortalEarnings, type PortalStatement, getOwnerEarnings } from "@/lib/portal";
import { downloadStatementPdf } from "@/lib/statement-pdf";

const STATUS_KEYS: Record<string, string> = {
  draft: "reports.status.draft",
  finalized: "reports.status.finalized",
  cancelled: "reports.status.cancelled",
};

/** Erster/letzter Tag eines Monats bzw. Jahres, ISO. */
function spanne(jahr: number, monat: number | null): { von: string; bis: string } {
  if (monat === null) {
    return { von: `${jahr}-01-01`, bis: `${jahr}-12-31` };
  }
  const mm = String(monat + 1).padStart(2, "0");
  const letzter = new Date(Date.UTC(jahr, monat + 1, 0));
  return { von: `${jahr}-${mm}-01`, bis: letzter.toISOString().slice(0, 10) };
}

export function PortalBerichte({
  statements,
  statementsError,
  current,
  currentError,
}: {
  statements: PortalStatement[];
  statementsError: string | null;
  current: PortalEarnings | null;
  currentError: string | null;
}) {
  const t = useTranslations("portal");
  const locale = useLocale();

  const monatsNamen = useMemo(
    () => t("calendar.months").split(","),
    [t],
  );

  const [laedtPdf, setLaedtPdf] = useState<string | null>(null);

  // Berichts-Auswahl: Jahr + optional Monat (Monat leer = Jahresbericht).
  // „Jetzt" wird EINMAL beim Mount festgehalten (Lazy-Initializer statt `new
  // Date()` im Render-Körper): sonst entstünde bei jedem Render ein neues
  // Objekt und jedes davon abhängige useMemo liefe unnötig neu.
  const [aktuellesJahr] = useState(() => new Date().getUTCFullYear());
  const [aktuellerMonat] = useState(() => new Date().getUTCMonth());
  const [jahr, setJahr] = useState(aktuellesJahr);
  const [monat, setMonat] = useState<number | null>(aktuellerMonat);
  const [bericht, setBericht] = useState<PortalEarnings | null>(null);
  const [berichtFehler, setBerichtFehler] = useState<string | null>(null);
  const [laedtBericht, setLaedtBericht] = useState(false);

  // Jahre, für die es überhaupt etwas geben kann: aus den Abrechnungen
  // abgeleitet plus das laufende Jahr. Keine erfundene Liste „letzte 10 Jahre".
  const jahre = useMemo(() => {
    const set = new Set<number>([aktuellesJahr]);
    for (const s of statements) {
      const j = Number(s.period_to.slice(0, 4));
      if (Number.isInteger(j)) set.add(j);
    }
    return [...set].sort((a, b) => b - a);
  }, [statements, aktuellesJahr]);

  const berichtLaden = useCallback(async () => {
    setLaedtBericht(true);
    const { von, bis } = spanne(jahr, monat);
    const res = await getOwnerEarnings(von, bis);
    setLaedtBericht(false);
    if (res.ok) {
      setBericht(res.data);
      setBerichtFehler(null);
    } else {
      setBericht(null);
      setBerichtFehler(res.error);
    }
  }, [jahr, monat]);

  const pdfLaden = async (st: PortalStatement) => {
    if (laedtPdf) return;
    // Doppelte Absicherung: der Knopf erscheint ohnehin nur bei „finalized",
    // aber ein Zustandswechsel zwischen Render und Klick darf hier nicht
    // durchrutschen (Wurzel 2).
    if (st.status !== "finalized") {
      toast.error(t("reports.onlyFinalized"));
      return;
    }
    setLaedtPdf(st.id);
    // Das volle Statement holen — serverseitig self-scoped UND gast-maskiert.
    const voll = await getStatement(st.id);
    if (!voll.ok) {
      setLaedtPdf(null);
      toast.error(voll.error);
      return;
    }
    try {
      await downloadStatementPdf(voll.data, locale);
    } catch (e) {
      // Der Grund bleibt erhalten (kein verschluckter Fehler, Wurzel 5).
      toast.error(
        e instanceof Error ? e.message : t("reports.downloadFailed"),
      );
    } finally {
      setLaedtPdf(null);
    }
  };

  const finalisiert = useMemo(
    () =>
      [...statements]
        .filter((s) => s.status === "finalized")
        // Nach dem ZEITRAUM sortiert, nicht nach created_at: created_at ist
        // unsere Verarbeitungszeit, nicht die Aussage der Abrechnung
        // (Wurzel 5b).
        .sort((a, b) => b.period_to.localeCompare(a.period_to)),
    [statements],
  );

  const aktuelleSumme = current?.total_payout ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Realtime: Abrechnungen und der laufende Stand hängen an den
          Reservierungen. `owner_statements` ist bewusst NICHT abonniert —
          authenticated hat dort kein SELECT (Wurzel 6, Migration 0187), ein
          Abo wäre eine stumme Attrappe. */}
      <PortalRealtime quellen={["reservations"]} onChange={() => void berichtLaden()} />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("reports.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("reports.subtitle")}</p>
      </header>

      {(statementsError || currentError) && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {statementsError ?? currentError}
        </div>
      )}

      {/* Laufender Abrechnungsstand */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:hourglass-medium" className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">
                {t("reports.currentTitle")}
              </span>
              {current && (
                <span className="text-xs text-muted-foreground">
                  {current.period_from} – {current.period_to}
                </span>
              )}
            </div>
            <span className="shrink-0 font-display text-2xl font-extrabold">
              {aktuelleSumme === null
                ? t("amountHidden")
                : formatCurrency(aktuelleSumme, current?.currency ?? null, locale)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("reports.currentHint")}
          </p>
        </CardContent>
      </Card>

      {/* Monats-/Jahresbericht */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">{t("reports.year")}</span>
              <NativeSelect
                value={String(jahr)}
                onChange={(e) => setJahr(Number(e.target.value))}
                className="min-w-32"
              >
                {jahre.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">
                {t("reports.month")}
              </span>
              <NativeSelect
                value={monat === null ? "" : String(monat)}
                onChange={(e) =>
                  setMonat(e.target.value === "" ? null : Number(e.target.value))
                }
                className="min-w-44"
              >
                {/* Leer = Jahresbericht. */}
                <option value="">{t("reports.yearly")}</option>
                {monatsNamen.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => void berichtLaden()}
              disabled={laedtBericht}
            >
              <Icon icon="ph:chart-line" className="size-4" />
              {monat === null ? t("reports.yearly") : t("reports.monthly")}
            </Button>
          </div>

          {berichtFehler && (
            <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {berichtFehler}
            </div>
          )}

          {bericht && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-md text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-normal">
                      {t("earnings.property")}
                    </th>
                    <th className="py-2 pr-4 text-right font-normal">
                      {t("earnings.reservations")}
                    </th>
                    <th className="py-2 pr-4 text-right font-normal">
                      {t("earnings.nights")}
                    </th>
                    <th className="py-2 text-right font-normal">
                      {t("earnings.payout")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bericht.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-muted-foreground"
                      >
                        {t("earnings.empty")}
                      </td>
                    </tr>
                  ) : (
                    bericht.items.map((i) => (
                      <tr
                        key={i.property_id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2 pr-4">{i.title}</td>
                        <td className="py-2 pr-4 text-right">
                          {i.reservations}
                        </td>
                        <td className="py-2 pr-4 text-right">{i.nights}</td>
                        <td className="py-2 text-right font-medium">
                          {/* null = keine Beträge-Sicht → „—", nie 0. */}
                          {i.payout === null
                            ? t("amountHidden")
                            : formatCurrency(i.payout, i.currency, locale)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {bericht.items.length > 0 && (
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="py-2 pr-4">{t("earnings.total")}</td>
                      <td colSpan={2} />
                      <td className="py-2 text-right">
                        {bericht.total_payout === null
                          ? t("amountHidden")
                          : formatCurrency(
                              bericht.total_payout,
                              bericht.currency,
                              locale,
                            )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Finalisierte Abrechnungen mit PDF-Download */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">
          {t("statements.title")}
        </h2>
        {finalisiert.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Icon icon="ph:receipt" className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                {t("statements.empty")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
            {finalisiert.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Icon icon="ph:receipt" className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {s.period_from} – {s.period_to}
                    {s.invoice_number ? ` · ${s.invoice_number}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_KEYS[s.status] ? t(STATUS_KEYS[s.status]) : s.status}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-semibold">
                  {formatCurrency(s.owner_payout, s.currency, locale)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void pdfLaden(s)}
                  disabled={laedtPdf === s.id}
                >
                  <Icon icon="ph:file-pdf" className="size-4" />
                  {laedtPdf === s.id
                    ? t("reports.downloading")
                    : t("reports.download")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
