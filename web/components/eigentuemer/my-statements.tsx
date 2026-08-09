"use client";

// Eigentümer-Portal (§4.2): read-only Liste der EIGENEN Auszahlungs-
// Abrechnungen. Der Eigentümer kann nichts erzeugen/ändern (das macht die
// Agentur) — er sieht Zeitraum, Status und seinen Auszahlungsbetrag und kann
// eine FINALISIERTE Abrechnung als PDF herunterladen.
//
// Der Download war hier bislang nur im Kopfkommentar versprochen, im JSX aber
// nie gerendert. Er ist jetzt da und nutzt denselben Weg wie die Agentur
// (lib/statement-pdf.ts, `downloadStatementPdf`). Datenschutz: das PDF entsteht
// aus dem vollen Statement über /owner-statements/{id} — dieser Endpunkt ist
// self-scoped UND maskiert serverseitig nach `load_guest_mask` (Eigentümer sehen
// nur den Vornamen des Gastes, ohne PM_BOOKING_TOTAL keine Gast-Beträge). Die
// Maskierung sitzt an der Quelle, nicht im Client (Wurzel 3/6).
//
// Nur finalisierte Abrechnungen sind herunterladbar: ein Entwurf ist nicht
// verbindlich und gehört dem Eigentümer nicht in die Hand.
//
// Texte kommen aus `portal.*` (24 Sprachen) — vorher standen hier deutsche
// Zeichenketten fest im Code.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import { type StatementListItem, getStatement } from "@/lib/owner-statements";
import { downloadStatementPdf } from "@/lib/statement-pdf";
import { useRealtime } from "@/lib/use-realtime";

const STATUS_KEYS: Record<string, string> = {
  draft: "reports.status.draft",
  finalized: "reports.status.finalized",
  cancelled: "reports.status.cancelled",
};

export function MyStatements({
  statements,
  error,
}: {
  statements: StatementListItem[];
  error: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("portal");
  const locale = useLocale();
  const [laedtPdf, setLaedtPdf] = useState<string | null>(null);

  // owner_statements ist für authenticated bewusst gesperrt (Wurzel 6) — ein Abo
  // darauf feuert nie. Abrechnungen entstehen aus Reservierungen, die der Owner
  // per RLS auf seine Objekte gefiltert sieht; ein Event genügt zum Refresh der
  // Server-Props.
  useRealtime({ table: "reservations", onChange: () => router.refresh() });

  const pdfLaden = async (s: StatementListItem) => {
    if (laedtPdf) return;
    // Der Knopf erscheint nur bei „finalized"; ein Statuswechsel zwischen
    // Render und Klick darf trotzdem nicht durchrutschen (Wurzel 2).
    if (s.status !== "finalized") {
      toast.error(t("reports.onlyFinalized"));
      return;
    }
    setLaedtPdf(s.id);
    const voll = await getStatement(s.id);
    if (!voll.ok) {
      setLaedtPdf(null);
      toast.error(voll.error);
      return;
    }
    try {
      await downloadStatementPdf(voll.data, locale);
    } catch (e) {
      // Grund erhalten, nicht verschlucken (Wurzel 5).
      toast.error(e instanceof Error ? e.message : t("reports.downloadFailed"));
    } finally {
      setLaedtPdf(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("statements.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {error && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && statements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
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
          {statements.map((s) => (
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
                  {/* Unbekannter Status kommt als Rohwert durch, statt still zu
                      verschwinden (Wurzel 4). */}
                  {STATUS_KEYS[s.status] ? t(STATUS_KEYS[s.status]) : s.status}
                </span>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                {formatCurrency(s.owner_payout, s.currency, locale)}
              </span>
              {s.status === "finalized" && (
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
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
