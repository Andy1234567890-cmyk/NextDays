"use client";

// Periodenwahl der Steuer-Seite: Art (Monat/Quartal/Jahr) + Jahr + Monat/Quartal.
// Liefert den Schlüssel, den das Backend versteht: `2026-08`, `2026-Q3`, `2026`.
// Rechnet selbst nichts — die Grenzen der Periode bestimmt der Server.
import { useTranslations } from "next-intl";

import { NativeSelect } from "@nextdays/ui/native-select";
import { Segmented } from "@nextdays/ui/segmented";
import type { PeriodKind } from "@/lib/buchhaltung-steuer-typen";

export type PeriodenTeile = { kind: PeriodKind; year: number; part: number };

export function periodenSchluessel(p: PeriodenTeile): string {
  if (p.kind === "month") return `${p.year}-${String(p.part).padStart(2, "0")}`;
  if (p.kind === "quarter") return `${p.year}-Q${p.part}`;
  return String(p.year);
}

export function periodeZerlegen(key: string): PeriodenTeile {
  const q = /^(\d{4})-Q([1-4])$/i.exec(key);
  if (q) return { kind: "quarter", year: Number(q[1]), part: Number(q[2]) };
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) return { kind: "month", year: Number(m[1]), part: Number(m[2]) };
  return { kind: "year", year: Number(key.slice(0, 4)), part: 1 };
}

function teilUmrechnen(alt: PeriodenTeile, kind: PeriodKind): number {
  const heute = new Date();
  if (kind === "year") return 1;
  if (kind === "month") {
    if (alt.kind === "month") return alt.part;
    if (alt.kind === "quarter") return (alt.part - 1) * 3 + 1;
    return heute.getMonth() + 1;
  }
  if (alt.kind === "quarter") return alt.part;
  if (alt.kind === "month") return Math.floor((alt.part - 1) / 3) + 1;
  return Math.floor(heute.getMonth() / 3) + 1;
}

export function PeriodenWahl({
  value,
  onChange,
  locale,
}: {
  value: PeriodenTeile;
  onChange: (p: PeriodenTeile) => void;
  locale: string;
}) {
  const t = useTranslations("finance");
  const jetzt = new Date().getFullYear();
  const jahre = Array.from({ length: 6 }, (_, i) => jetzt + 1 - i);
  const monatsname = new Intl.DateTimeFormat(locale, { month: "long" });

  // Beim Wechsel der Art den Zeitpunkt behalten: August → Q3, Q3 → Juli.
  const setKind = (kind: PeriodKind) => {
    onChange({ kind, year: value.year, part: teilUmrechnen(value, kind) });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented<PeriodKind>
        value={value.kind}
        onChange={setKind}
        options={[
          { value: "month", label: t("steuerPage.periodMonth") },
          { value: "quarter", label: t("steuerPage.periodQuarter") },
          { value: "year", label: t("steuerPage.periodYear") },
        ]}
      />
      <div className="w-28">
        <NativeSelect
          aria-label={t("steuerPage.periodYear")}
          value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
        >
          {jahre.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </NativeSelect>
      </div>
      {value.kind === "month" && (
        <div className="w-40">
          <NativeSelect
            aria-label={t("steuerPage.periodMonth")}
            value={value.part}
            onChange={(e) => onChange({ ...value, part: Number(e.target.value) })}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monatsname.format(new Date(2026, m - 1, 1))}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {value.kind === "quarter" && (
        <div className="w-28">
          <NativeSelect
            aria-label={t("steuerPage.periodQuarter")}
            value={value.part}
            onChange={(e) => onChange({ ...value, part: Number(e.target.value) })}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Q{q}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  );
}
