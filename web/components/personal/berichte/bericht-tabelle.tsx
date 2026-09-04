"use client";

// Die Tabelle EINES Berichts: Spalten und Zeilen kommen unverändert vom Server
// (`spalten`/`zeilen`/`summen`, Vertrag §4.2), die Beschriftung ausschliesslich
// über `personal.berichte.spalten.<key>`.
//
// TYPGERECHTE ZELLEN (Vertrag §7):
//   minuten  → `h:mm`, negative Werte mit Vorzeichen UND Farbe (ein Minus im
//              Stundenkonto ist eine Aussage, keine Formatierung)
//   geld     → formatCurrency mit der `currency` DER ANTWORT; fehlt sie, reine
//              Zahl ohne Symbol — kein erfundenes EUR (Wurzel 4)
//   prozent  → eine Nachkommastelle
//   status   → farbige Pille
// `null` ist „—", nie eine 0.
//
// Die Spalte `art` ist zwar `text`, trägt aber einen ENUM-Wert des Servers
// (`urlaub`/`dokument`/…). Sie wird deshalb wie ein Status übersetzt — sonst
// stünde in der griechischen Oberfläche „kind_krank". Übersetzt wird über die
// BESTEHENDEN Kataloge (`personal.abwesenheitArt.*`, `personal.dokArt.*`),
// nicht über eine vierte Kopie derselben Wörter; fehlt ein Eintrag, bleibt der
// rohe Wert stehen statt eines MISSING_MESSAGE.
//
// SORTIERUNG clientseitig und STABIL: `zeilen.map(...)` merkt den
// Ausgangsindex, damit gleiche Schlüssel ihre Serverreihenfolge behalten. Die
// Summenzeile sortiert NICHT mit — sie ist die des Servers und bleibt unten.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { formatCurrency } from "@/lib/currency";
import type {
  BerichtResponse,
  BerichtSpalte,
  BerichtZeile,
  BerichtZelle,
} from "@/lib/personal-berichte-typen";
import {
  minutenText,
  prozentText,
  sortWert,
  statusFarbe,
  zahlText,
} from "@/lib/personal-berichte-typen";
import { formatDate } from "@/lib/utils";

const RECHTS = new Set(["zahl", "minuten", "geld", "prozent", "tage"]);

type Sortierung = { key: string; richtung: "auf" | "ab" } | null;

export function BerichtTabelle({ bericht }: { bericht: BerichtResponse }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const [sort, setSort] = useState<Sortierung>(null);

  const spalten = bericht.spalten;

  const zeilen = useMemo(() => {
    const mitIndex = bericht.zeilen.map((z, i) => ({ z, i }));
    if (!sort) return mitIndex.map((e) => e.z);
    const faktor = sort.richtung === "auf" ? 1 : -1;
    mitIndex.sort((a, b) => {
      const wa = sortWert(a.z[sort.key] ?? null);
      const wb = sortWert(b.z[sort.key] ?? null);
      // Fehlende Werte immer ans Ende, unabhängig von der Richtung.
      if (wa === null && wb === null) return a.i - b.i;
      if (wa === null) return 1;
      if (wb === null) return -1;
      if (typeof wa === "number" && typeof wb === "number") {
        return wa === wb ? a.i - b.i : (wa - wb) * faktor;
      }
      const cmp = String(wa).localeCompare(String(wb), locale);
      return cmp === 0 ? a.i - b.i : cmp * faktor;
    });
    return mitIndex.map((e) => e.z);
  }, [bericht.zeilen, sort, locale]);

  function umschalten(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, richtung: "auf" };
      if (s.richtung === "auf") return { key, richtung: "ab" };
      return null;
    });
  }

  // `t.has` statt eines String-Vergleichs: liefert der Server einen Bericht
  // mit einer Spalte, die der Katalog noch nicht kennt, steht der rohe
  // Schlüssel da — kein „personal.berichte.spalten.x" und kein Absturz.
  const spaltenTitel = (s: BerichtSpalte) =>
    t.has(`berichte.spalten.${s.key}`) ? t(`berichte.spalten.${s.key}`) : s.key;

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-left">
          <tr>
            {spalten.map((s) => {
              const aktiv = sort?.key === s.key;
              return (
                <th key={s.key} className={`p-2 font-medium ${RECHTS.has(s.typ) ? "text-right" : ""}`}>
                  <button
                    type="button"
                    onClick={() => umschalten(s.key)}
                    title={t("berichte.sortieren")}
                    className={`inline-flex items-center gap-1 rounded-full px-1 hover:text-foreground ${
                      aktiv ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span>{spaltenTitel(s)}</span>
                    <Icon
                      icon={
                        aktiv
                          ? sort?.richtung === "auf"
                            ? "ph:caret-up"
                            : "ph:caret-down"
                          : "ph:caret-up-down"
                      }
                      aria-hidden
                      className={`size-3 ${aktiv ? "" : "opacity-40"}`}
                    />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z, i) => (
            <tr key={zeilenSchluessel(z, i)} className="border-t">
              {spalten.map((s) => (
                <td
                  key={s.key}
                  className={`p-2 ${RECHTS.has(s.typ) ? "text-right tabular-nums" : ""}`}
                >
                  <Zelle
                    wert={z[s.key] ?? null}
                    typ={s.typ}
                    spaltenKey={s.key}
                    currency={bericht.currency}
                  />
                </td>
              ))}
            </tr>
          ))}
          {zeilen.length === 0 && (
            <tr>
              <td colSpan={spalten.length} className="p-6 text-center text-muted-foreground">
                {t("berichte.leer.tabelle")}
              </td>
            </tr>
          )}
        </tbody>
        {bericht.summen && zeilen.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-foreground/60 bg-secondary/30 font-semibold">
              {spalten.map((s, i) => {
                if (!s.summe) {
                  return (
                    <td key={s.key} className="p-2">
                      {i === 0 ? t("berichte.summe") : ""}
                    </td>
                  );
                }
                return (
                  <td
                    key={s.key}
                    className={`p-2 ${RECHTS.has(s.typ) ? "text-right tabular-nums" : ""}`}
                  >
                    <Zelle
                      wert={bericht.summen?.[s.key] ?? null}
                      typ={s.typ}
                      spaltenKey={s.key}
                      currency={bericht.currency}
                    />
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Stabiler React-Key: die erste Zeichenkette der Zeile plus Index. Reine
 *  Indizes wären nach dem Sortieren falsch, eine erfundene ID gibt es nicht. */
function zeilenSchluessel(z: BerichtZeile, i: number): string {
  for (const wert of Object.values(z)) {
    if (typeof wert === "string" && wert) return `${wert}-${i}`;
  }
  return `zeile-${i}`;
}

function Zelle({
  wert,
  typ,
  spaltenKey,
  currency,
}: {
  wert: BerichtZelle;
  typ: BerichtSpalte["typ"];
  spaltenKey: string;
  currency: string | null;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();

  if (wert === null || wert === undefined || wert === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  // `art` ist ein Enum in einer Textspalte — über die bestehenden Kataloge
  // übersetzen, sonst roh lassen.
  if (spaltenKey === "art" && typeof wert === "string") {
    return <>{artText(wert, (k) => (t.has(k) ? t(k) : null))}</>;
  }
  if (Array.isArray(wert)) {
    if (!wert.length) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="text-xs text-amber-900">
        {wert.map((h, i) => (
          <span key={`${h}-${i}`} className="mr-1 block">
            {h}
          </span>
        ))}
      </span>
    );
  }
  if (typeof wert === "boolean") {
    // `fehlt: true` im Bericht monatsabschluesse ist ein Mangel, kein Häkchen.
    return wert ? (
      <Icon icon="ph:warning-circle" aria-hidden className="inline size-4 text-red-600" />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }

  switch (typ) {
    case "minuten": {
      if (typeof wert !== "number") return <>{String(wert)}</>;
      return (
        <span className={wert < 0 ? "text-red-600" : undefined}>{minutenText(wert)}</span>
      );
    }
    case "geld": {
      if (typeof wert !== "number") return <>{String(wert)}</>;
      // Fehlt die Währung, rendert die Zahl SYMBOLLOS — kein `|| 'EUR'`.
      const text = currency
        ? formatCurrency(wert / 100, currency, locale)
        : new Intl.NumberFormat(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(wert / 100);
      return <span className={wert < 0 ? "text-red-600" : undefined}>{text}</span>;
    }
    case "prozent":
      return typeof wert === "number" ? <>{prozentText(wert, locale)}</> : <>{String(wert)}</>;
    case "zahl":
    case "tage":
      return typeof wert === "number" ? <>{zahlText(wert, locale)}</> : <>{String(wert)}</>;
    case "datum":
      return typeof wert === "string" ? <>{formatDate(wert, locale)}</> : <>{String(wert)}</>;
    case "status": {
      const roh = String(wert);
      const schluessel = `berichte.status.${roh}`;
      return (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusFarbe(roh)}`}
        >
          {t.has(schluessel) ? t(schluessel) : roh}
        </span>
      );
    }
    default:
      return <>{String(wert)}</>;
  }
}

/** Der Enum-Wert der Spalte `art` als Text. Zwei Quellen, weil zwei Berichte
 *  dieselbe Spalte mit verschiedenen Katalogen füllen: `abwesenheiten` liefert
 *  eine Abwesenheitsart, `fristen` die Herkunft der Frist. Beide Kataloge
 *  stehen schon in `de.json` — hier wird nur nachgesehen, nichts neu benannt.
 *  Kein Treffer: der rohe Wert, nie ein erfundenes Label (Wurzel 4). */
function artText(wert: string, hole: (schluessel: string) => string | null): string {
  return (
    hole(`abwesenheitArt.${wert}`) ??
    hole(`dokArt.${wert}`) ??
    hole(`berichte.art.${wert}`) ??
    wert
  );
}
