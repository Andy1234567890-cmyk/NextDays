"use client";

// Eine Berichtsseite: Filterleiste, Hinweise, Tabelle mit Summenzeile, CSV und
// Druck. Der Bericht selbst kommt serverseitig vorgeladen (`initial`); jede
// Filteränderung schreibt die URL um und die Seite lädt neu — deshalb ist
// dieser Zustand hier bewusst NICHT gespiegelt.
//
// HINWEISE STEHEN ÜBER DER TABELLE (Wurzel 5): „3 Personen ohne Lohn" darf
// nicht unter einer Summe verschwinden, die deshalb zu niedrig ist. Ein
// Bericht ohne Zeilen zeigt einen EmptyState, keine leere Tabelle.
//
// Kein Realtime: die speisenden Tabellen (personal_akten, lohnlaeufe,
// zeiterfassung) sind für `authenticated` gesperrt (Wurzel 6) — ein Abo wäre
// eine stumme Attrappe. Nachgeladen wird über die URL bzw. den Knopf.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { EmptyState } from "@nextdays/ui/empty-state";
import { berichtCsv } from "@/lib/personal-berichte";
import type {
  BerichtFilterName,
  BerichtFilterWerte,
  BerichtResponse,
} from "@/lib/personal-berichte-typen";
import { formatDate, formatDateTime } from "@/lib/utils";

import { downloadBerichtPdf } from "./bericht-druck";
import { BerichtFilter, type FilterOptionen } from "./bericht-filter";
import { BerichtTabelle } from "./bericht-tabelle";

export function BerichtSeite({
  name,
  filterNamen,
  werte,
  optionen,
  bericht,
  loadError,
}: {
  name: string;
  /** Die Filter, die der Katalog für diesen Bericht nennt. */
  filterNamen: BerichtFilterName[];
  werte: BerichtFilterWerte;
  optionen: FilterOptionen;
  bericht: BerichtResponse | null;
  loadError: string | null;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  const titel = t.has(`berichte.namen.${name}.titel`)
    ? t(`berichte.namen.${name}.titel`)
    : name;
  const beschreibung = t.has(`berichte.namen.${name}.beschreibung`)
    ? t(`berichte.namen.${name}.beschreibung`)
    : "";

  /** Fehlermeldung eines Aufrufs: der Vertragscode aus `details.code` schlägt
   *  den Text des Servers, damit die Meldung in der Sprache des Betrachters
   *  steht (`personal.fehlercode.<code>`). */
  function melden(error: string, details?: Record<string, unknown>) {
    const code = typeof details?.code === "string" ? details.code : null;
    if (code && t.has(`fehlercode.${code}`)) {
      toast.error(t(`fehlercode.${code}`));
      return;
    }
    toast.error(error);
  }

  async function csv() {
    setBusy(true);
    const res = await berichtCsv(name, werte);
    setBusy(false);
    if (!res.ok) return melden(res.error, res.details);
    const bytes = Uint8Array.from(atob(res.data.inhalt_base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: res.data.mime }));
    const a = document.createElement("a");
    a.href = url;
    // Der Dateiname kommt vom Server (Content-Disposition) — nie hier erfunden.
    a.download = res.data.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("berichte.csvFertig", { name: res.data.name }));
  }

  async function drucken() {
    if (!bericht) return;
    setBusy(true);
    try {
      await downloadBerichtPdf(
        bericht,
        {
          titel,
          zeitraumLabel: t("berichte.zeitraum"),
          filterLabel: t("berichte.filter.titel"),
          summeLabel: t("berichte.summe"),
          fusszeile: t("berichte.erzeugtAm", {
            zeit: formatDateTime(bericht.erzeugt_am, locale),
          }),
          spalten: Object.fromEntries(
            bericht.spalten.map((s) => [
              s.key,
              t.has(`berichte.spalten.${s.key}`) ? t(`berichte.spalten.${s.key}`) : s.key,
            ]),
          ),
          status: statusWoerterbuch(bericht, (k) => (t.has(k) ? t(k) : null)),
          filter: filterZeilen(),
          hinweise: bericht.hinweise,
        },
        locale,
      );
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : t("fehler"));
    } finally {
      setBusy(false);
    }
  }

  /** Die gesetzten Filter als lesbare „Label: Wert"-Zeilen für den Ausdruck —
   *  ein PDF ohne den Filter darauf ist irreführend. */
  function filterZeilen(): string[] {
    const zeilen: string[] = [];
    if (werte.arbeitsbereich_id) {
      const a = optionen.arbeitsbereiche.find((x) => x.id === werte.arbeitsbereich_id);
      zeilen.push(`${t("arbeitsbereich")}: ${a?.name ?? werte.arbeitsbereich_id}`);
    }
    if (werte.property_id) {
      const o = optionen.objekte.find((x) => x.id === werte.property_id);
      zeilen.push(`${t("objekt")}: ${o?.title ?? werte.property_id}`);
    }
    if (werte.user_id) {
      const p = optionen.personen.find((x) => x.user_id === werte.user_id);
      zeilen.push(`${t("berichte.spalten.person")}: ${p?.full_name ?? werte.user_id}`);
    }
    if (werte.beschaeftigungsart) {
      const schluessel = `beschaeftigungsart.${werte.beschaeftigungsart}`;
      zeilen.push(
        `${t("berichte.spalten.beschaeftigungsart")}: ${
          t.has(schluessel) ? t(schluessel) : werte.beschaeftigungsart
        }`,
      );
    }
    return zeilen;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/hr/berichte"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon icon="ph:arrow-left" aria-hidden className="size-3" />
            {t("berichte.titel")}
          </Link>
          <h1 className="font-display text-3xl font-extrabold">{titel}</h1>
          {beschreibung && <p className="text-sm text-muted-foreground">{beschreibung}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-full" disabled={busy} onClick={csv}>
            <Icon icon="ph:file-csv" aria-hidden className="mr-1 size-4" />
            {t("berichte.csv")}
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={busy || !bericht || bericht.zeilen.length === 0}
            onClick={drucken}
          >
            <Icon icon="ph:printer" aria-hidden className="mr-1 size-4" />
            {t("berichte.drucken")}
          </Button>
        </div>
      </div>

      <BerichtFilter aktiv={filterNamen} werte={werte} optionen={optionen} busy={busy} />

      {loadError && (
        <p className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {loadError}
        </p>
      )}

      {bericht && bericht.hinweise.length > 0 && (
        <ul className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {bericht.hinweise.map((h) => (
            <li key={h}>• {h}</li>
          ))}
        </ul>
      )}

      {bericht && (
        <p className="text-xs text-muted-foreground">
          {t("berichte.zeitraumZeile", {
            von: formatDate(bericht.von, locale),
            bis: formatDate(bericht.bis, locale),
            anzahl: bericht.anzahl,
          })}
        </p>
      )}

      {bericht && bericht.zeilen.length === 0 ? (
        <EmptyState
          icon="ph:table"
          titel={t("berichte.leer.titel")}
          text={t("berichte.leer.text")}
        />
      ) : (
        bericht && <BerichtTabelle bericht={bericht} />
      )}

      {bericht && (
        <p className="text-xs text-muted-foreground">
          {t("berichte.erzeugtAm", { zeit: formatDateTime(bericht.erzeugt_am, locale) })}
        </p>
      )}
    </div>
  );
}

/** Statustexte, die in DIESEM Bericht wirklich vorkommen — nur die gehören auf
 *  den Ausdruck. Ein unbekannter Wert bleibt roh statt zu verschwinden. */
function statusWoerterbuch(
  bericht: BerichtResponse,
  hole: (schluessel: string) => string | null,
): Record<string, string> {
  const werte = new Set<string>();
  const statusSpalten = bericht.spalten.filter((s) => s.typ === "status").map((s) => s.key);
  for (const zeile of bericht.zeilen) {
    for (const key of statusSpalten) {
      const v = zeile[key];
      if (typeof v === "string" && v) werte.add(v);
    }
  }
  const out: Record<string, string> = {};
  for (const v of werte) out[v] = hole(`berichte.status.${v}`) ?? v;
  return out;
}
