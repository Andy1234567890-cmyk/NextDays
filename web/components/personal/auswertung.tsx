"use client";

// Personal → Auswertung & Lohnvorbereitung (Etappe 5): Stunden, Zuschläge,
// Abwesenheiten, Kosten je Person und je Objekt; Export als CSV oder
// DATEV-LODAS. Fehlende Voraussetzungen kommen als Hinweise vom Server und
// stehen oben — kein stilles „0" (Wurzel 4/5).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { NativeSelect } from "@nextdays/ui/native-select";
import { formatCurrency } from "@/lib/currency";
import { getAuswertung, lohnexport } from "@/lib/personal";
import { type Auswertung as AuswertungDaten, stunden } from "@/lib/personal-typen";
import { formatDate } from "@/lib/utils";

export function Auswertung({ initial, von, bis }: { initial: AuswertungDaten | null; von: string; bis: string }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const [zeitraum, setZeitraum] = useState({ von, bis });
  const [daten, setDaten] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<"datev_lodas" | "csv">("datev_lodas");

  async function laden() {
    setBusy(true);
    const res = await getAuswertung(zeitraum.von, zeitraum.bis);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setDaten(res.data);
  }

  async function exportieren() {
    const d = new Date(`${zeitraum.von}T00:00:00Z`);
    setBusy(true);
    const res = await lohnexport(d.getUTCFullYear(), d.getUTCMonth() + 1, format);
    setBusy(false);
    if (!res.ok) {
      const hinweise = res.details?.hinweise as string[] | undefined;
      toast.error(hinweise?.length ? `${res.error} ${hinweise.join(" ")}` : res.error);
      return;
    }
    const bytes = Uint8Array.from(atob(res.data.inhalt_base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: res.data.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("auswertung.exportiert", { name: res.data.name }));
  }

  const geld = (minor: number | null, currency: string | null) =>
    minor === null || !currency ? "—" : formatCurrency(minor / 100, currency, locale);

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{t("auswertung.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("auswertung.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t("von")}</span><DatePicker value={zeitraum.von} onChange={(v) => setZeitraum((z) => ({ ...z, von: v }))} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t("bis")}</span><DatePicker value={zeitraum.bis} onChange={(v) => setZeitraum((z) => ({ ...z, bis: v }))} /></label>
          <Button variant="outline" className="rounded-full" disabled={busy} onClick={laden}>{t("anzeigen")}</Button>
          <NativeSelect value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="w-40">
            <option value="datev_lodas">DATEV LODAS</option>
            <option value="csv">CSV</option>
          </NativeSelect>
          <Button className="rounded-full" disabled={busy} onClick={exportieren}>
            <Icon icon="ph:download-simple" className="mr-1 size-4" />{t("auswertung.export")}
          </Button>
        </div>
      </div>

      {daten && daten.hinweise.length > 0 && (
        <ul className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {daten.hinweise.map((h) => <li key={h}>• {h}</li>)}
        </ul>
      )}

      {daten && (
        <>
          <p className="text-xs text-muted-foreground">{t("auswertung.zeitraum", { von: formatDate(daten.von, locale), bis: formatDate(daten.bis, locale) })}</p>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="bg-secondary/40 text-left">
                <tr>
                  <th className="p-2">{t("dienstplan.person")}</th>
                  <th className="p-2 text-right">{t("dienstplan.soll")}</th>
                  <th className="p-2 text-right">{t("auswertung.plan")}</th>
                  <th className="p-2 text-right">{t("dienstplan.ist")}</th>
                  <th className="p-2 text-right">{t("auswertung.nacht")}</th>
                  <th className="p-2 text-right">{t("auswertung.sonntag")}</th>
                  <th className="p-2 text-right">{t("auswertung.feiertag")}</th>
                  <th className="p-2 text-right">{t("auswertung.ueberstunden")}</th>
                  <th className="p-2 text-right">{t("abwesenheitArt.urlaub")}</th>
                  <th className="p-2 text-right">{t("abwesenheitArt.krank")}</th>
                  <th className="p-2 text-right">{t("auswertung.kosten")}</th>
                </tr>
              </thead>
              <tbody>
                {daten.personen.map((p) => (
                  <tr key={p.user_id} className="border-t">
                    <td className="p-2">
                      {p.full_name ?? "—"}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {p.beschaeftigungsart ? t(`beschaeftigungsart.${p.beschaeftigungsart}`) : ""}{p.firma_name ? ` · ${p.firma_name}` : ""}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{stunden(p.soll_minuten)}</td>
                    <td className="p-2 text-right tabular-nums">{stunden(p.plan_minuten)}</td>
                    <td className="p-2 text-right font-medium tabular-nums">{stunden(p.ist_minuten)}</td>
                    <td className="p-2 text-right tabular-nums">{stunden(p.nacht_minuten)}</td>
                    <td className="p-2 text-right tabular-nums">{stunden(p.sonntag_minuten)}</td>
                    <td className="p-2 text-right tabular-nums">{stunden(p.feiertag_minuten)}</td>
                    <td className="p-2 text-right tabular-nums">{stunden(p.ueberstunden_minuten)}</td>
                    <td className="p-2 text-right tabular-nums">{p.abwesenheit_tage.urlaub ?? 0}</td>
                    <td className="p-2 text-right tabular-nums">{(p.abwesenheit_tage.krank ?? 0) + (p.abwesenheit_tage.kind_krank ?? 0)}</td>
                    <td className="p-2 text-right tabular-nums">{geld(p.kosten_minor, p.currency)}</td>
                  </tr>
                ))}
                {daten.personen.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">{t("auswertung.keine")}</td></tr>}
              </tbody>
            </table>
          </div>

          <h2 className="mt-2 font-display text-lg font-extrabold">{t("auswertung.kostenJeObjekt")}</h2>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left">
                <tr>
                  <th className="p-2">{t("objekt")}</th>
                  <th className="p-2 text-right">{t("auswertung.stunden")}</th>
                  <th className="p-2 text-right">{t("auswertung.kosten")}</th>
                  <th className="p-2 text-right">{t("auswertung.davonFremd")}</th>
                </tr>
              </thead>
              <tbody>
                {daten.objekte.map((o) => (
                  <tr key={o.property_id ?? "ohne"} className="border-t">
                    <td className="p-2">{o.property_title ?? t("auswertung.ohneObjekt")}</td>
                    <td className="p-2 text-right tabular-nums">{stunden(o.minuten)}</td>
                    <td className="p-2 text-right tabular-nums">{geld(o.kosten_minor, o.currency)}</td>
                    <td className="p-2 text-right tabular-nums">{geld(o.fremd_minor, o.currency)}</td>
                  </tr>
                ))}
                {daten.objekte.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("auswertung.keine")}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
