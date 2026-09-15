"use client";

// Wiederverwendbare Artikel-Auswahl für Positions-Editoren (Rechnung, Angebot):
// Knopf → Dialog mit Suche (Favoriten zuerst) → Klick übernimmt den Artikel
// als Position (description, unit, unit_price, tax_rate) und zählt die
// Verwendung. Lädt erst beim Öffnen; nur AKTIVE Artikel.
//
// Preis und Steuersatz kommen aus dem Artikel — der Aufrufer entscheidet, ob er
// die Belegwährung gegenprüft (`currency` wird mitgegeben; ein Artikel in SEK
// auf einer DKK-Rechnung ist ein Datenfehler, kein stiller Umrechnungsfall).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { listItems, markItemUsed } from "@/lib/buchhaltung-artikel";
import type { ArtikelPosition, BillingItem } from "@/lib/buchhaltung-artikel-typen";
import { formatCurrency } from "@/lib/currency";

export function ArtikelAuswahl({
  onUebernehmen,
  belegWaehrung,
  triggerVariante = "outline",
  triggerText,
}: {
  /** Wird je übernommenem Artikel gerufen. */
  onUebernehmen: (position: ArtikelPosition) => void;
  /** Währung des Belegs — Artikel in anderer Währung werden markiert. */
  belegWaehrung?: string;
  triggerVariante?: "default" | "outline" | "ghost" | "accent";
  triggerText?: string;
}) {
  const t = useTranslations("finance");
  const [offen, setOffen] = useState(false);
  const [artikel, setArtikel] = useState<BillingItem[] | null>(null);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [suche, setSuche] = useState("");

  const laden_ = useCallback(async () => {
    setLaden(true);
    setFehler(null);
    const res = await listItems({ onlyActive: true, limit: 500 });
    setLaden(false);
    if (!res.ok) {
      setFehler(res.error);
      setArtikel([]);
      return;
    }
    setArtikel(res.data);
  }, []);

  useEffect(() => {
    if (offen && artikel === null) void laden_();
  }, [offen, artikel, laden_]);

  const gefiltert = useMemo(() => {
    const wort = suche.trim().toLowerCase();
    const liste = artikel ?? [];
    if (!wort) return liste;
    return liste.filter((a) =>
      [a.name, a.itemNumber, a.description ?? "", a.category ?? ""].some((f) =>
        f.toLowerCase().includes(wort),
      ),
    );
  }, [artikel, suche]);

  function uebernehmen(a: BillingItem) {
    onUebernehmen({
      artikelId: a.id,
      itemNumber: a.itemNumber,
      description: a.name,
      unit: a.unit,
      unit_price: a.unitPrice,
      tax_rate: a.taxRate,
      currency: a.currency,
    });
    // Zähler: best-effort, blockiert die Übernahme nicht. Ein Fehler wird
    // sichtbar protokolliert, nicht verschluckt.
    void markItemUsed(a.id).then((r) => {
      if (!r.ok) console.warn("artikel_verwendung_nicht_gezaehlt", a.id, r.error);
    });
    setOffen(false);
    setSuche("");
  }

  return (
    <>
      <Button
        type="button"
        variant={triggerVariante}
        onClick={() => setOffen(true)}
        className="gap-2"
      >
        <Icon icon="ph:tag" className="size-4" />
        {triggerText ?? t("artikelAuswahl.trigger")}
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent className="flex max-h-[85vh] w-full flex-col gap-3 sm:max-w-2xl">
          <DialogTitle className="font-display text-lg font-extrabold">
            {t("artikelAuswahl.title")}
          </DialogTitle>
          <DialogDescription>{t("artikelAuswahl.description")}</DialogDescription>

          <div className="relative">
            <Icon
              icon="ph:magnifying-glass"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={t("artikelAuswahl.searchPlaceholder")}
              className="pl-9"
              aria-label={t("artikelAuswahl.searchPlaceholder")}
            />
          </div>

          <div className="min-h-40 flex-1 overflow-y-auto rounded-(--radius) border border-border">
            {laden ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <Icon icon="ph:circle-notch" className="size-4 animate-spin" />
                {t("artikelAuswahl.loading")}
              </div>
            ) : fehler ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-destructive">
                {fehler}
                <Button type="button" variant="outline" size="sm" onClick={() => void laden_()}>
                  {t("artikelAuswahl.retry")}
                </Button>
              </div>
            ) : gefiltert.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {artikel && artikel.length === 0
                  ? t("artikelAuswahl.emptyNoItems")
                  : t("artikelAuswahl.emptyNoMatches")}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {gefiltert.map((a) => (
                  <ArtikelZeile
                    key={a.id}
                    artikel={a}
                    belegWaehrung={belegWaehrung}
                    onWaehlen={uebernehmen}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Eine Zeile der Artikelauswahl. Eigene Komponente, damit die Auswahl selbst
 *  nur noch Laden, Suche und Zustand zeigt. */
function ArtikelZeile({
  artikel: a,
  belegWaehrung,
  onWaehlen,
}: {
  artikel: BillingItem;
  belegWaehrung?: string;
  onWaehlen: (a: BillingItem) => void;
}) {
  const t = useTranslations("finance");
  const fremdeWaehrung = Boolean(
    belegWaehrung && a.currency && a.currency !== belegWaehrung.toUpperCase(),
  );
  return (
    <li>
      <button
        type="button"
        onClick={() => onWaehlen(a)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/40"
      >
        <Icon
          icon={a.isFavorite ? "ph:star-fill" : "ph:star"}
          className={`size-4 shrink-0 ${a.isFavorite ? "text-accent" : "text-muted-foreground/50"}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{a.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{a.itemNumber}</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[a.category, a.description].filter(Boolean).join(" · ") || a.unit}
          </div>
        </div>
        <div className="shrink-0 text-right text-sm">
          <div className="font-medium tabular-nums">
            {formatCurrency(Number(a.unitPrice) || 0, a.currency)}
            <span className="text-xs text-muted-foreground"> / {a.unit}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("artikelAuswahl.taxRate", { rate: a.taxRate })}
            {fremdeWaehrung && (
              <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                {t("artikelAuswahl.otherCurrency", { currency: a.currency })}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}
