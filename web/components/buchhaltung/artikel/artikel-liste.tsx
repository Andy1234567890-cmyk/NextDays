"use client";

// Artikelliste (Buchhaltung → Artikel): Suche, Kategorie-Filter, „nur aktive",
// Favoriten-Stern, Aktiv-Schalter, Bearbeiten, Löschen. Die Liste kommt vom
// Server-Component (Server-Action), gefiltert wird hier im Browser — der
// Artikelstamm eines Betriebs ist klein (Obergrenze 500 je Abruf).
// Kein Realtime: `billing_items` ist für authenticated gesperrt (Wurzel 6);
// nach jeder eigenen Aktion `router.refresh()`.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { EmptyState } from "@nextdays/ui/empty-state";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";
import { ArtikelFormular } from "@/components/buchhaltung/artikel/artikel-formular";
import { deleteItem, setFavorite, updateItem } from "@/lib/buchhaltung-artikel";
import type { BillingItem, BillingItemCategory } from "@/lib/buchhaltung-artikel-typen";
import { formatCurrency } from "@/lib/currency";

const ALLE = "__alle__";

function formatPreis(betrag: string, currency: string): string {
  const n = Number(betrag);
  return formatCurrency(Number.isFinite(n) ? n : 0, currency);
}

function formatSatz(satz: string, locale: string): string {
  const n = Number(satz);
  if (!Number.isFinite(n)) return satz;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)} %`;
}

export function ArtikelListe({
  items,
  kategorien,
  locale,
}: {
  items: BillingItem[];
  kategorien: BillingItemCategory[];
  locale: string;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [suche, setSuche] = useState("");
  const [kategorie, setKategorie] = useState(ALLE);
  const [nurAktive, setNurAktive] = useState(false);
  const [formOffen, setFormOffen] = useState(false);
  const [bearbeitet, setBearbeitet] = useState<BillingItem | null>(null);
  const [laufend, setLaufend] = useState<string | null>(null);

  const gefiltert = useMemo(() => {
    const wort = suche.trim().toLowerCase();
    return items.filter((a) => {
      if (nurAktive && !a.isActive) return false;
      if (kategorie !== ALLE && (a.category ?? "") !== kategorie) return false;
      if (!wort) return true;
      return [a.name, a.itemNumber, a.description ?? "", a.category ?? ""].some((f) =>
        f.toLowerCase().includes(wort),
      );
    });
  }, [items, suche, kategorie, nurAktive]);

  function oeffnenNeu() {
    setBearbeitet(null);
    setFormOffen(true);
  }

  function oeffnenBearbeiten(a: BillingItem) {
    setBearbeitet(a);
    setFormOffen(true);
  }

  async function favoritSetzen(a: BillingItem) {
    setLaufend(a.id);
    const res = await setFavorite(a.id, !a.isFavorite);
    setLaufend(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function aktivSetzen(a: BillingItem, aktiv: boolean) {
    setLaufend(a.id);
    const res = await updateItem(a.id, { isActive: aktiv });
    setLaufend(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function loeschen(a: BillingItem) {
    if (!window.confirm(t("artikelPage.deleteConfirm", { name: a.name }))) return;
    setLaufend(a.id);
    const res = await deleteItem(a.id);
    setLaufend(null);
    if (!res.ok) {
      // 409 = bereits übernommen → der Server sagt „deaktivieren"; Text anzeigen.
      toast.error(res.error);
      return;
    }
    toast.success(t("artikelPage.deleted"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <ArtikelFilter
        suche={suche}
        setSuche={setSuche}
        kategorie={kategorie}
        setKategorie={setKategorie}
        kategorien={kategorien}
        nurAktive={nurAktive}
        setNurAktive={setNurAktive}
        onNeu={oeffnenNeu}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="ph:tag"
          titel={t("artikelPage.emptyTitle")}
          text={t("artikelPage.emptySubtitle")}
          aktion={
            <Button onClick={oeffnenNeu} className="gap-2">
              <Icon icon="ph:plus" className="size-4" />
              {t("artikelPage.newItem")}
            </Button>
          }
        />
      ) : gefiltert.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("artikelPage.noMatches")}
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3" aria-label={t("artikelPage.columnFavorite")} />
                <th className="px-4 py-3 font-medium">{t("artikelPage.columnNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("artikelPage.columnName")}</th>
                <th className="px-4 py-3 font-medium">{t("artikelPage.columnCategory")}</th>
                <th className="px-4 py-3 font-medium">{t("artikelPage.columnUnit")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("artikelPage.columnPrice")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("artikelPage.columnTaxRate")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("artikelPage.columnUsage")}</th>
                <th className="px-4 py-3 font-medium">{t("artikelPage.columnActive")}</th>
                <th className="w-24 px-3 py-3" aria-label={t("artikelPage.columnActions")} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {gefiltert.map((a) => (
                <ArtikelZeile
                  key={a.id}
                  artikel={a}
                  locale={locale}
                  laeuft={laufend === a.id}
                  onFavorit={favoritSetzen}
                  onAktiv={aktivSetzen}
                  onBearbeiten={oeffnenBearbeiten}
                  onLoeschen={loeschen}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ArtikelFormular
        open={formOffen}
        onOpenChange={setFormOffen}
        artikel={bearbeitet}
        kategorien={kategorien}
      />
    </div>
  );
}

/** Eine Tabellenzeile des Artikelstamms. */
function ArtikelZeile({
  artikel: a,
  locale,
  laeuft,
  onFavorit,
  onAktiv,
  onBearbeiten,
  onLoeschen,
}: {
  artikel: BillingItem;
  locale: string;
  laeuft: boolean;
  onFavorit: (a: BillingItem) => void;
  onAktiv: (a: BillingItem, aktiv: boolean) => void;
  onBearbeiten: (a: BillingItem) => void;
  onLoeschen: (a: BillingItem) => void;
}) {
  const t = useTranslations("finance");
  return (
  <tr
    key={a.id}
    className={`transition-colors hover:bg-secondary/30 ${a.isActive ? "" : "text-muted-foreground"}`}
  >
    <td className="px-3 py-2">
      <button
        type="button"
        disabled={laeuft}
        onClick={() => onFavorit(a)}
        aria-pressed={a.isFavorite}
        aria-label={
          a.isFavorite
            ? t("artikelPage.removeFavorite")
            : t("artikelPage.addFavorite")
        }
        className="rounded-full p-1.5 transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <Icon
          icon={a.isFavorite ? "ph:star-fill" : "ph:star"}
          className={`size-4 ${a.isFavorite ? "text-accent" : "text-muted-foreground"}`}
        />
      </button>
    </td>
    <td className="px-4 py-2 font-medium">{a.itemNumber}</td>
    <td className="px-4 py-2">
      <div className="font-medium text-foreground">{a.name}</div>
      {a.description && (
        <div className="line-clamp-1 text-xs text-muted-foreground">{a.description}</div>
      )}
    </td>
    <td className="px-4 py-2">{a.category || "—"}</td>
    <td className="px-4 py-2">{a.unit}</td>
    <td className="px-4 py-2 text-right font-medium tabular-nums">
      {formatPreis(a.unitPrice, a.currency)}
    </td>
    <td className="px-4 py-2 text-right tabular-nums">{formatSatz(a.taxRate, locale)}</td>
    <td className="px-4 py-2 text-right tabular-nums">{a.usageCount}</td>
    <td className="px-4 py-2">
      <Switch
        checked={a.isActive}
        disabled={laeuft}
        onCheckedChange={(v) => onAktiv(a, v)}
        aria-label={t("artikelPage.columnActive")}
      />
    </td>
    <td className="px-3 py-2">
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("artikelPage.edit")}
          onClick={() => onBearbeiten(a)}
        >
          <Icon icon="ph:pencil-simple" className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-destructive"
          aria-label={t("artikelPage.delete")}
          disabled={laeuft}
          onClick={() => onLoeschen(a)}
        >
          <Icon icon="ph:trash" className="size-4" />
        </Button>
      </div>
    </td>
  </tr>
  );
}

/** Suche, Kategoriefilter, Aktiv-Schalter und der Knopf »Neuer Artikel«. */
function ArtikelFilter({
  suche,
  setSuche,
  kategorie,
  setKategorie,
  kategorien,
  nurAktive,
  setNurAktive,
  onNeu,
}: {
  suche: string;
  setSuche: (v: string) => void;
  kategorie: string;
  setKategorie: (v: string) => void;
  kategorien: BillingItemCategory[];
  nurAktive: boolean;
  setNurAktive: (v: boolean) => void;
  onNeu: () => void;
}) {
  const t = useTranslations("finance");
  return (
  <div className="flex flex-wrap items-center gap-3">
    <div className="relative min-w-60 flex-1">
      <Icon
        icon="ph:magnifying-glass"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder={t("artikelPage.searchPlaceholder")}
        className="pl-9"
        aria-label={t("artikelPage.searchPlaceholder")}
      />
    </div>
    <NativeSelect
      value={kategorie}
      onChange={(e) => setKategorie(e.target.value)}
      className="w-auto min-w-44"
      aria-label={t("artikelPage.filterCategory")}
    >
      <option value={ALLE}>{t("artikelPage.allCategories")}</option>
      {kategorien.map((k) => (
        <option key={k.name} value={k.name}>
          {k.name} ({k.itemCount})
        </option>
      ))}
    </NativeSelect>
    <label className="flex items-center gap-2 text-sm">
      <Switch
        checked={nurAktive}
        onCheckedChange={setNurAktive}
        aria-label={t("artikelPage.onlyActive")}
      />
      {t("artikelPage.onlyActive")}
    </label>
    <Button onClick={onNeu} className="gap-2">
      <Icon icon="ph:plus" className="size-4" />
      {t("artikelPage.newItem")}
    </Button>
  </div>
  );
}
