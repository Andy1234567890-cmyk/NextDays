"use client";

// Versandprotokoll EINER Regel als Dialog (14.09.2026) — geöffnet per Klick auf
// die Zustands-Chips. Zeigt je Nachricht, WELCHE Buchung betroffen ist (Gast,
// Objekt, Aufenthalt, Kanal), den Zustand, den Zeitpunkt und den Grund, und
// bietet für Fehlgeschlagenes „Erneut senden". Der Text wird beim Versand neu
// gerendert: ein inzwischen nachgetragener Türcode steht dann drin.
//
// Dazu die Sicht, die der Betrieb zuerst braucht: WELCHE OBJEKTE haben die
// Angaben nicht, an denen Nachrichten scheiterten — mit dem Hinweis, ob das
// Feld heute noch leer ist, und dem Sprung zur Kartei des Objekts.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { zustandName } from "@/components/inbox/automation-stand-chips";
import {
  type Automation,
  type AutomationLuecke,
  type AutomationNachricht,
  listAutomationNachrichten,
  retryAllFailedAutomation,
  retryAutomationNachricht,
} from "@/lib/inbox";

const ERNEUT_ERLAUBT = new Set(["failed", "skipped", "cancelled"]);
const ZEILEN = 50;

export function AutomationProtokollDialog({
  regel,
  luecken,
  offen,
  onClose,
  onGeaendert,
  zeitpunktText,
}: {
  regel: Automation | null;
  /** Die betroffenen Objekte — kommen aus dem Zustand der Regel, damit Karte
   *  und Protokoll dieselbe Rechnung zeigen (eine Quelle, kein zweiter
   *  Verdichter im Browser). */
  luecken: AutomationLuecke[];
  offen: boolean;
  onClose: () => void;
  /** Nach einem erneuten Einplanen — der Aufrufer lädt den Stand neu. */
  onGeaendert: () => void;
  zeitpunktText: (iso: string) => string;
}) {
  const t = useTranslations("inbox");
  const [zeilen, setZeilen] = useState<AutomationNachricht[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!regel) return;
    setFehler(null);
    const res = await listAutomationNachrichten(regel.id, ZEILEN);
    // Ladefehler werden angezeigt, nicht verschluckt (Wurzel 5).
    if (res.ok) setZeilen(res.data.items);
    else setFehler(res.error);
  }, [regel]);

  useEffect(() => {
    if (offen) {
      setZeilen(null);
      void laden();
    }
  }, [offen, laden]);

  async function erneut(id: string) {
    setLaeuft(id);
    const res = await retryAutomationNachricht(id);
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("autoProtokollErneutOk"));
    await laden();
    onGeaendert();
  }

  async function erneutAlle() {
    if (!regel) return;
    setLaeuft("alle");
    const res = await retryAllFailedAutomation(regel.id);
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("autoProtokollErneutAlleOk", { count: res.data.erneut }));
    await laden();
    onGeaendert();
  }

  const fehlgeschlagen = (zeilen ?? []).filter(
    (z) => z.status === "failed",
  ).length;

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle>
          {t("autoProtokollTitel")}
          {regel ? ` · ${regel.name}` : ""}
        </DialogTitle>
        <DialogDescription>{t("autoProtokollBeschreibung")}</DialogDescription>

        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        {zeilen === null && !fehler && (
          <p className="text-sm text-muted-foreground">{t("autoLoading")}</p>
        )}

        <LueckenAbschnitt luecken={luecken} />

        {zeilen && zeilen.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {t("autoProtokollAnzahl", { count: zeilen.length })}
            </span>
            {fehlgeschlagen > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={laeuft !== null}
                onClick={erneutAlle}
              >
                <Icon icon="ph:arrow-clockwise" className="mr-1 size-4" />
                {t("autoProtokollErneutAlle", { count: fehlgeschlagen })}
              </Button>
            )}
          </div>
        )}

        {zeilen && zeilen.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("autoStandEmpty")}</p>
        )}

        {zeilen && zeilen.length > 0 && (
          <ProtokollListe
            zeilen={zeilen}
            laeuft={laeuft}
            zeitpunktText={zeitpunktText}
            onErneut={(id) => void erneut(id)}
          />
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("autoProtokollSchliessen")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Objekte, an denen Nachrichten scheiterten — mit „heute noch leer" je Feld. */
function LueckenAbschnitt({ luecken }: { luecken: AutomationLuecke[] }) {
  const t = useTranslations("inbox");
  if (luecken.length === 0) return null;
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
      <h3 className="font-semibold">{t("autoProtokollLueckenTitel")}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {luecken.map((l) => (
          <li key={l.property_id} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{l.objekt ?? l.property_id}</span>
            <span className="text-muted-foreground">
              {t("autoProtokollLueckenFelder", { count: l.anzahl })}
            </span>
            {l.felder.map((f) => (
              <span
                key={f}
                className={`rounded-full px-2 py-0.5 font-mono text-xs ${
                  l.heute_leer.includes(f)
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                }`}
                title={
                  l.heute_leer.includes(f)
                    ? t("autoProtokollHeuteLeer")
                    : t("autoProtokollInzwischenGepflegt")
                }
              >
                {f}
              </span>
            ))}
            <Link
              href={`/objekte/${l.property_id}/kartei`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              {t("autoProtokollObjektOeffnen")}
              <Icon icon="ph:arrow-square-out" className="size-3.5" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("autoProtokollLueckenHinweis")}
      </p>
    </section>
  );
}

/** Die Protokollzeilen — je Nachricht Buchung, Zustand, Grund, Erneut-Knopf. */
function ProtokollListe({
  zeilen,
  laeuft,
  zeitpunktText,
  onErneut,
}: {
  zeilen: AutomationNachricht[];
  laeuft: string | null;
  zeitpunktText: (iso: string) => string;
  onErneut: (id: string) => void;
}) {
  const t = useTranslations("inbox");
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {zeilen.map((z) => (
        <li
          key={z.id}
          className="flex flex-wrap items-start gap-3 px-3 py-2 text-sm"
        >
          <span
            className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs ${
              z.status === "failed"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                : z.status === "sent"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {zustandName(z.status, (k) => t(k as never))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {z.gast ?? t("autoProtokollGastUnbekannt")}
              {z.objekt ? ` · ${z.objekt}` : ""}
            </span>
            <span className="block text-xs text-muted-foreground">
              {[
                z.arrival_date && z.departure_date
                  ? `${z.arrival_date} – ${z.departure_date}`
                  : null,
                z.ota_name,
                z.send_at
                  ? t("autoStandPlannedFor", { zeit: zeitpunktText(z.send_at) })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {z.last_error && (
              <span className="block text-xs text-destructive">
                {z.last_error}
              </span>
            )}
            {z.heute_leer.length > 0 && (
              <span className="block text-xs text-rose-700 dark:text-rose-400">
                {t("autoProtokollHeuteLeerFelder", {
                  felder: z.heute_leer.join(", "),
                })}
              </span>
            )}
          </span>
          {ERNEUT_ERLAUBT.has(z.status) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={laeuft !== null}
              onClick={() => onErneut(z.id)}
              title={
                z.heute_leer.length > 0
                  ? t("autoProtokollErneutTrotzLuecke")
                  : undefined
              }
            >
              {laeuft === z.id ? t("autoLoading") : t("autoProtokollErneut")}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
