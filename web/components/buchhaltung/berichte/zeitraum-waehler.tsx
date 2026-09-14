"use client";

// Zeitraumwähler der Berichte: zwei Datumsfelder + Schnellwahl. Der Zeitraum
// lebt in der URL (`from`/`to`), damit Seite, CSV-Link und Zurück-Taste
// dieselbe Wahrheit haben; der Server prüft ihn erneut (≤ 366 Tage → 422).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Input } from "@nextdays/ui/input";

const MAX_TAGE = 366;

type Schnellwahl = "monat" | "quartal" | "jahr" | "zwoelf";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function schnellwahl(art: Schnellwahl): { from: string; to: string } {
  const heute = new Date();
  const j = heute.getUTCFullYear();
  const m = heute.getUTCMonth();
  if (art === "monat") return { from: iso(new Date(Date.UTC(j, m, 1))), to: iso(heute) };
  if (art === "quartal") {
    return { from: iso(new Date(Date.UTC(j, m - (m % 3), 1))), to: iso(heute) };
  }
  if (art === "jahr") return { from: iso(new Date(Date.UTC(j, 0, 1))), to: iso(heute) };
  return { from: iso(new Date(Date.UTC(j, m - 11, 1))), to: iso(heute) };
}

export function ZeitraumWaehler({ from, to }: { from: string; to: string }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [laedt, starte] = useTransition();
  const [von, setVon] = useState(from);
  const [bis, setBis] = useState(to);
  const [fehler, setFehler] = useState<string | null>(null);
  const idVon = useId();
  const idBis = useId();

  function anwenden(neuVon: string, neuBis: string) {
    if (!neuVon || !neuBis) return;
    if (neuBis < neuVon) {
      setFehler(t("berichteGemeinsam.fehlerReihenfolge"));
      return;
    }
    const tage = (Date.parse(neuBis) - Date.parse(neuVon)) / 86_400_000 + 1;
    if (tage > MAX_TAGE) {
      setFehler(t("berichteGemeinsam.fehlerZuLang", { max: MAX_TAGE }));
      return;
    }
    setFehler(null);
    const q = new URLSearchParams(params.toString());
    q.set("from", neuVon);
    q.set("to", neuBis);
    starte(() => router.replace(`${pathname}?${q}`));
  }

  const schnell: { key: Schnellwahl; label: string }[] = [
    { key: "monat", label: t("berichteGemeinsam.schnellMonat") },
    { key: "quartal", label: t("berichteGemeinsam.schnellQuartal") },
    { key: "jahr", label: t("berichteGemeinsam.schnellJahr") },
    { key: "zwoelf", label: t("berichteGemeinsam.schnellZwoelf") },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor={idVon}>
            {t("berichteGemeinsam.von")}
            <Input
              id={idVon}
              type="date"
              value={von}
              max={bis}
              onChange={(e) => setVon(e.target.value)}
              onBlur={() => anwenden(von, bis)}
              className="h-9 w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor={idBis}>
            {t("berichteGemeinsam.bis")}
            <Input
              id={idBis}
              type="date"
              value={bis}
              min={von}
              onChange={(e) => setBis(e.target.value)}
              onBlur={() => anwenden(von, bis)}
              className="h-9 w-40"
            />
          </label>
        </div>
        <div className="inline-flex rounded-full border bg-secondary p-0.5 text-sm">
          {schnell.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={laedt}
              onClick={() => {
                const z = schnellwahl(s.key);
                setVon(z.from);
                setBis(z.to);
                anwenden(z.from, z.to);
              }}
              className="rounded-full px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              {s.label}
            </button>
          ))}
        </div>
        {laedt ? (
          <Icon icon="ph:circle-notch" className="mb-2 size-4 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </div>
      {fehler ? (
        <p role="alert" className="text-xs text-destructive">
          {fehler}
        </p>
      ) : null}
    </div>
  );
}
