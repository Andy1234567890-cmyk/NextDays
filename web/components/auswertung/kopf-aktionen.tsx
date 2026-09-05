"use client";

// Kopfaktionen der Auswertung — Hostaways rechte Seite: gespeicherte
// Ansichten („New custom view") und „Download report".
//
// ANSICHTEN sind je NUTZER gespeichert (0563): Filter, Schnellwahl-Schlüssel,
// Spalten, Umschalter des Reiters. Laden setzt alles auf einmal; der
// Schnellwahl-Schlüssel wird dabei neu aufgelöst, „Vormonat" bleibt also der
// Vormonat von heute.
//
// DOWNLOAD nimmt die Zahlen, die auf dem Bildschirm stehen — kein zweiter
// Rechenweg im Backend (siehe lib/auswertung-export.ts).
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { Input } from "@nextdays/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@nextdays/ui/popover";
import { deleteAnsicht, listAnsichten, saveAnsicht } from "@/lib/auswertung";
import type { Ansicht, Reiter } from "@/lib/auswertung-typen";
import type { ExportFormat } from "@/lib/auswertung-export";

export function KopfAktionen({
  reiter,
  ansichtLaden,
  ansichtErfassen,
  exportieren,
  exportLaeuft,
}: {
  reiter: Reiter;
  /** Eine gespeicherte Ansicht anwenden. */
  ansichtLaden: (a: Ansicht) => void;
  /** Den aktuellen Stand als speicherbare Ansicht liefern (ohne Name). */
  ansichtErfassen: () => Omit<Ansicht, "id" | "created_at" | "name" | "reiter">;
  exportieren: (format: ExportFormat) => Promise<void>;
  exportLaeuft: boolean;
}) {
  const t = useTranslations("analysis");
  const [ansichten, setAnsichten] = useState<Ansicht[]>([]);
  const [speichernOffen, setSpeichernOffen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await listAnsichten(reiter);
    if (res.ok) setAnsichten(res.data);
  }, [reiter]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function speichern() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setFehler(null);
    const res = await saveAnsicht({ name: n, reiter, ...ansichtErfassen() });
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setName("");
    setSpeichernOffen(false);
    await laden();
  }

  async function loeschen(id: string) {
    const res = await deleteAnsicht(id);
    if (res.ok) await laden();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Icon icon="ph:bookmark-simple" className="size-4" />
            {t("views.button")}
            {ansichten.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums">
                {ansichten.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{t("views.title")}</DropdownMenuLabel>
          {ansichten.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">{t("views.empty")}</p>
          )}
          {ansichten.map((a) => (
            <DropdownMenuItem
              key={a.id}
              className="flex items-center justify-between gap-2"
              onSelect={() => ansichtLaden(a)}
            >
              <span className="truncate">{a.name}</span>
              <button
                type="button"
                aria-label={t("views.delete")}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void loeschen(a.id);
                }}
              >
                <Icon icon="ph:trash" className="size-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSpeichernOffen(true)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("views.new")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={speichernOffen} onOpenChange={setSpeichernOffen}>
        <PopoverTrigger asChild>
          {/* Unsichtbarer Anker: das Popover öffnet aus dem Menü heraus. */}
          <span className="inline-block h-0 w-0" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-72 flex-col gap-2">
          <p className="text-sm font-medium">{t("views.saveTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("views.saveHint")}</p>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("views.namePlaceholder")}
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === "Enter") void speichern();
            }}
          />
          {fehler && <p className="text-xs text-destructive">{fehler}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSpeichernOffen(false)}>
              {t("filter.cancel")}
            </Button>
            <Button type="button" size="sm" disabled={busy || !name.trim()} onClick={speichern}>
              {t("views.save")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" disabled={exportLaeuft}>
            <Icon icon={exportLaeuft ? "ph:spinner" : "ph:download-simple"} className={exportLaeuft ? "size-4 animate-spin" : "size-4"} />
            {t("export.button")}
            <Icon icon="ph:caret-down" className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("export.title")}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void exportieren("csv")}>
            <Icon icon="ph:file-csv" className="size-4" />
            {t("export.csv")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportieren("xlsx")}>
            <Icon icon="ph:file-xls" className="size-4" />
            {t("export.xlsx")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportieren("pdf")}>
            <Icon icon="ph:file-pdf" className="size-4" />
            {t("export.pdf")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("export.hint")}</p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
