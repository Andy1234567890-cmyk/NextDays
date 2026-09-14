"use client";

// Kontenplan-Seite: vier Reiter (Buchungskonten, Kostenstellen, Nummernkreise,
// Zahlungsarten). Daten kommen als Props aus der Server Component; der aktive
// Reiter steht in der URL (`?tab=`), damit ein Reload ihn behält.
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Segmented } from "@nextdays/ui/segmented";
import type {
  BookingAccount,
  CostCenter,
  NumberSequence,
  PaymentMethod,
} from "@/lib/buchhaltung-kontenplan-typen";

import { BuchungskontenTab } from "./buchungskonten-tab";
import { KostenstellenTab } from "./kostenstellen-tab";
import { NummernkreiseTab } from "./nummernkreise-tab";
import { ZahlungsartenTab } from "./zahlungsarten-tab";

export type KontenplanTab = "konten" | "kostenstellen" | "nummernkreise" | "zahlungsarten";
const TABS: readonly KontenplanTab[] = ["konten", "kostenstellen", "nummernkreise", "zahlungsarten"];

export function KontenplanTabs({
  accounts,
  costCenters,
  sequences,
  methods,
}: {
  accounts: BookingAccount[];
  costCenters: CostCenter[];
  sequences: NumberSequence[];
  methods: PaymentMethod[];
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const roh = params.get("tab");
  const tab: KontenplanTab = TABS.includes(roh as KontenplanTab) ? (roh as KontenplanTab) : "konten";

  const optionen = [
    { value: "konten" as const, label: t("kontenplanPage.tabAccounts") },
    { value: "kostenstellen" as const, label: t("kontenplanPage.tabCostCenters") },
    { value: "nummernkreise" as const, label: t("kontenplanPage.tabSequences") },
    { value: "zahlungsarten" as const, label: t("kontenplanPage.tabPaymentMethods") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto">
        <Segmented
          value={tab}
          options={optionen}
          onChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
        />
      </div>
      {tab === "konten" && <BuchungskontenTab accounts={accounts} />}
      {tab === "kostenstellen" && <KostenstellenTab costCenters={costCenters} />}
      {tab === "nummernkreise" && <NummernkreiseTab sequences={sequences} />}
      {tab === "zahlungsarten" && <ZahlungsartenTab methods={methods} />}
    </div>
  );
}
