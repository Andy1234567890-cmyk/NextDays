"use client";

// PDF-Import — ZWEISTUFIG: hochladen, dann prüfen.
//
// Die Vorlage zeigt nur den Upload. Was danach passiert, zeigt sie nicht — und
// genau dort liegt der Unterschied zwischen einem Werkzeug und einer
// Haftungsfalle: Ein Dokument, das ungeprüft in die Wissensdatenbank fliesst,
// macht die KI zur Sprecherin eines Textes, den niemand gelesen hat, inklusive
// veralteter Preise und alter Türcodes.
import { Icon } from "@iconify/react";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import {
  type WissenImportVorschau,
  type WissenImportVorschlag,
  wissenDokumentLesen,
  wissenImportUebernehmen,
} from "@/lib/inbox";
import {
  WISSEN_KATEGORIEN,
  type WissenKategorie,
} from "@/lib/inbox-wissen-typen";

const MAX_MB = 20;

export function WissenImportPanel({
  objektId,
  onSchliessen,
  onFertig,
}: {
  objektId: string | null;
  onSchliessen: () => void;
  onFertig: () => void;
}) {
  const t = useTranslations("inbox");
  const eingabeRef = useRef<HTMLInputElement>(null);

  const [datei, setDatei] = useState<File | null>(null);
  const [ueberzogen, setUeberzogen] = useState(false);
  const [vorschau, setVorschau] = useState<WissenImportVorschau | null>(null);
  const [entwuerfe, setEntwuerfe] = useState<WissenImportVorschlag[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(new Set());
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function waehlen(f: File | null) {
    setFehler(null);
    if (!f) return;
    // Erste Prüfung im Dialog, damit ein 200-MB-Video gar nicht erst hochlädt.
    // Die ZWEITE, verbindliche sitzt im Server (Magic-Bytes + Grösse) — ein
    // Client-Check ist kein Schutz, nur eine Höflichkeit.
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setFehler(t("kiImportOnlyPdf"));
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFehler(t("kiImportTooBig", { mb: MAX_MB }));
      return;
    }
    setDatei(f);
  }

  function lesen() {
    if (!datei) return;
    setFehler(null);
    start(async () => {
      const res = await wissenDokumentLesen(datei, objektId);
      if (!res.ok) {
        setFehler(res.error);
        return;
      }
      setVorschau(res.data);
      setEntwuerfe(res.data.items);
      // Vorschläge MIT Warnung sind vorab NICHT angehakt: ein Betrag oder eine
      // Jahreszahl ist genau der Fall, den jemand ansehen soll.
      setGewaehlt(
        new Set(res.data.items.map((v, i) => (v.warnung ? -1 : i)).filter((i) => i >= 0)),
      );
    });
  }

  function uebernehmen() {
    if (!vorschau) return;
    const auswahl = entwuerfe.filter((_, i) => gewaehlt.has(i));
    if (auswahl.length === 0) return;
    setFehler(null);
    start(async () => {
      const res = await wissenImportUebernehmen({
        quelle_id: vorschau.quelle_id,
        property_id: objektId,
        items: auswahl,
      });
      if (res.ok) onFertig();
      else setFehler(res.error);
    });
  }

  function aendern(i: number, teil: Partial<WissenImportVorschlag>) {
    setEntwuerfe((alt) => alt.map((v, k) => (k === i ? { ...v, ...teil } : v)));
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onSchliessen()}>
      <SheetContent side="right" className="sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {vorschau
              ? t("kiImportFound", {
                  count: entwuerfe.length,
                  datei: vorschau.datei_name,
                })
              : t("kiUploadFacts")}
          </SheetTitle>
          {vorschau && (
            <p className="text-sm text-muted-foreground">{t("kiImportReview")}</p>
          )}
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {!vorschau ? (
            <>
              <span className="text-sm font-medium">
                {t("kiImportFile")}
                <span className="ml-0.5 text-accent">*</span>
              </span>

              <button
                type="button"
                onClick={() => eingabeRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setUeberzogen(true);
                }}
                onDragLeave={() => setUeberzogen(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setUeberzogen(false);
                  waehlen(e.dataTransfer.files[0] ?? null);
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-10 text-sm transition-colors ${
                  ueberzogen
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <Icon icon="ph:cloud-arrow-up" className="size-8 text-muted-foreground" />
                <span>{t("kiImportDrop")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("kiImportPdfMax", { mb: MAX_MB })}
                </span>
              </button>
              <input
                ref={eingabeRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => waehlen(e.target.files?.[0] ?? null)}
              />

              {datei && (
                <div className="flex items-center gap-3 rounded-(--radius) border border-border px-3 py-2 text-sm">
                  <Icon icon="ph:file-pdf" className="size-5 text-muted-foreground" />
                  <span className="flex-1 truncate">{datei.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(datei.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => setDatei(null)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t("templateCancel")}
                  >
                    <Icon icon="ph:x" className="size-4" />
                  </button>
                </div>
              )}

              {pending && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon icon="ph:spinner" className="size-4 animate-spin" />
                  {t("kiImportReading")}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              {entwuerfe.map((v, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-border p-3"
                >
                  <Checkbox
                    checked={gewaehlt.has(i)}
                    onCheckedChange={() =>
                      setGewaehlt((alt) => {
                        const neu = new Set(alt);
                        if (neu.has(i)) neu.delete(i);
                        else neu.add(i);
                        return neu;
                      })
                    }
                    className="mt-1"
                    aria-label={v.titel ?? v.fact}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        value={v.titel ?? ""}
                        onChange={(e) => aendern(i, { titel: e.target.value })}
                        placeholder={t("kiFieldTitle")}
                        className="flex-1"
                      />
                      <NativeSelect
                        value={v.kategorie}
                        onChange={(e) =>
                          aendern(i, { kategorie: e.target.value as WissenKategorie })
                        }
                        className="w-44"
                      >
                        {WISSEN_KATEGORIEN.map((k) => (
                          <option key={k} value={k}>
                            {t(`kiCategory_${k}` as never)}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <textarea
                      value={v.fact}
                      onChange={(e) => aendern(i, { fact: e.target.value })}
                      rows={2}
                      maxLength={2000}
                      className="w-full resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    {v.warnung && (
                      <p className="flex items-center gap-1.5 text-xs text-warning">
                        <Icon icon="ph:warning" className="size-4 shrink-0" />
                        {t(`kiImportWarn_${v.warnung}` as never)}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {entwuerfe.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("kiImportNothing")}
                </p>
              )}
            </div>
          )}

          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>

        <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-border">
          {vorschau ? (
            <>
              <span className="text-sm text-muted-foreground">
                {t("kiImportSelected", {
                  count: gewaehlt.size,
                  total: entwuerfe.length,
                })}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onSchliessen}>
                  {t("kiImportDiscard")}
                </Button>
                <Button
                  type="button"
                  onClick={uebernehmen}
                  disabled={pending || gewaehlt.size === 0}
                >
                  <Icon icon="ph:check" className="size-4" />
                  {t("kiImportApply")}
                </Button>
              </div>
            </>
          ) : (
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onSchliessen}>
                {t("templateCancel")}
              </Button>
              <Button type="button" onClick={lesen} disabled={pending || !datei}>
                {t("kiImportUpload")}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
