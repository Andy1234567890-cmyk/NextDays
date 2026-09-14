"use client";

// Export-Dialog (Buchhaltung → DATEV): Exporttyp, Zeitraum, Belegarten,
// Vorschau der Anzahl je Belegart samt Problemen, dann Export. Ein zweiter
// Klick mit gleichem Inhalt liefert denselben Lauf (Backend-Idempotenz) —
// die Oberfläche sagt das ehrlich („bereits vorhanden").
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { createDatevExport, previewDatevExport } from "@/lib/buchhaltung-datev";
import {
  BELEGARTEN,
  type Belegart,
  type ExportAnfrage,
  type ExportTyp,
  type Vorschau,
} from "@/lib/buchhaltung-datev-typen";

function jahresanfang(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DatevExportDialog({ configured }: { configured: boolean }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [exportType, setExportType] = useState<ExportTyp>("buchungsstapel");
  const [dateFrom, setDateFrom] = useState(jahresanfang());
  const [dateTo, setDateTo] = useState(heute());
  const [belegarten, setBelegarten] = useState<Belegart[]>(["ausgangsrechnungen", "gutschriften"]);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [probleme, setProbleme] = useState<string[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState<"vorschau" | "export" | null>(null);

  const anfrage: ExportAnfrage = {
    exportType,
    dateFrom,
    dateTo,
    belegarten: exportType === "buchungsstapel" ? belegarten : [],
  };

  function reset() {
    setVorschau(null);
    setProbleme([]);
    setFehler(null);
  }

  function toggle(art: Belegart, an: boolean) {
    setBelegarten((alt) => (an ? [...new Set([...alt, art])] : alt.filter((a) => a !== art)));
    reset();
  }

  async function vorschauLaden() {
    reset();
    setBusy("vorschau");
    const res = await previewDatevExport(anfrage);
    setBusy(null);
    if (!res.ok) {
      setFehler(res.error);
      setProbleme(res.details?.probleme ?? []);
      return;
    }
    setVorschau(res.data);
    setProbleme(res.data.probleme);
  }

  async function exportieren() {
    setFehler(null);
    setBusy("export");
    const res = await createDatevExport(anfrage);
    setBusy(null);
    if (!res.ok) {
      setFehler(res.error);
      setProbleme(res.details?.probleme ?? []);
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data.wiederverwendet
        ? t("datevPage.export.reused", { name: res.data.dateiname })
        : t("datevPage.export.created", { anzahl: res.data.anzahl }),
    );
    setOpen(false);
    reset();
    router.refresh();
  }

  const belegartenLeer = exportType === "buchungsstapel" && belegarten.length === 0;
  const exportMoeglich = vorschau !== null && probleme.length === 0 && vorschau.anzahlGesamt > 0;

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        disabled={!configured}
        title={configured ? undefined : t("datevPage.export.needsSettings")}
      >
        <Icon icon="ph:export" className="size-4" />
        {t("datevPage.export.button")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogTitle>{t("datevPage.export.title")}</DialogTitle>
          <DialogDescription>{t("datevPage.export.subtitle")}</DialogDescription>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="datev-export-typ">{t("datevPage.export.type")}</Label>
              <NativeSelect
                id="datev-export-typ"
                value={exportType}
                onChange={(e) => {
                  setExportType(e.target.value as ExportTyp);
                  reset();
                }}
              >
                <option value="buchungsstapel">{t("datevPage.export.typeBuchungsstapel")}</option>
                <option value="stammdaten">{t("datevPage.export.typeStammdaten")}</option>
              </NativeSelect>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="datev-von">{t("datevPage.export.from")}</Label>
                <Input
                  id="datev-von"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    reset();
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="datev-bis">{t("datevPage.export.to")}</Label>
                <Input
                  id="datev-bis"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    reset();
                  }}
                />
              </div>
            </div>

            {exportType === "buchungsstapel" && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{t("datevPage.export.belegarten")}</legend>
                {BELEGARTEN.map((art) => (
                  <label key={art} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={belegarten.includes(art)}
                      onCheckedChange={(v) => toggle(art, v === true)}
                    />
                    {t(`datevPage.belegart.${art}`)}
                  </label>
                ))}
              </fieldset>
            )}

            {vorschau && (
              <div className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-sm">
                <p className="font-medium">
                  {t("datevPage.export.previewTitle", { anzahl: vorschau.anzahlGesamt })}
                </p>
                <ul className="mt-1 grid gap-0.5 text-muted-foreground sm:grid-cols-2">
                  {Object.entries(vorschau.anzahlJeBelegart).map(([art, n]) => (
                    <li key={art}>
                      {art === "personenkonten"
                        ? t("datevPage.export.personenkonten")
                        : t(`datevPage.belegart.${art as Belegart}`)}
                      : {n}
                    </li>
                  ))}
                </ul>
                {vorschau.warnungen.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("datevPage.export.warnings", { anzahl: vorschau.warnungen.length })}
                  </p>
                )}
              </div>
            )}

            {(fehler || probleme.length > 0) && (
              <div className="rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3 text-sm">
                {fehler && <p className="font-medium text-destructive">{fehler}</p>}
                {probleme.length > 0 && (
                  <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-destructive/90">
                    {probleme.slice(0, 50).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                    {probleme.length > 50 && <li>{t("datevPage.export.moreProblems", { anzahl: probleme.length - 50 })}</li>}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy !== null}>
              {t("datevPage.cancel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={vorschauLaden}
              disabled={busy !== null || belegartenLeer}
            >
              {busy === "vorschau" && <Icon icon="ph:circle-notch" className="size-4 animate-spin" />}
              {t("datevPage.export.preview")}
            </Button>
            <Button type="button" onClick={exportieren} disabled={busy !== null || !exportMoeglich}>
              {busy === "export" && <Icon icon="ph:circle-notch" className="size-4 animate-spin" />}
              {t("datevPage.export.run")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
