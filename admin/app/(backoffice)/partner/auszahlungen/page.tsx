// Auszahlungen des Partnerprogramms — Stufe 1: der Lauf bündelt, das
// Backoffice lädt die CSV, überweist und bestätigt mit Referenz.
import Link from "next/link";

import { PartnerAuszahlungen } from "@/components/partner/partner-auszahlungen";
import { getPlatformMe } from "@/lib/backoffice";
import { getAuszahlungen } from "@/lib/partner";

const TABS = [
  { status: "pending", label: "Offen" },
  { status: "processing", label: "In Bearbeitung" },
  { status: "paid", label: "Bezahlt" },
  { status: "failed", label: "Fehlgeschlagen" },
  { status: "", label: "Alle" },
];

export default async function AuszahlungenSeite({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const aktiv = TABS.find((t) => t.status === status)?.status ?? "pending";
  const [me, liste] = await Promise.all([getPlatformMe(), getAuszahlungen(aktiv || undefined)]);

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <Link href="/partner" className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
        ← Partner
      </Link>
      <h1 className="mt-4 font-sans text-[2rem] font-bold tracking-tight">Partner-Auszahlungen</h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted-foreground">
        Der Monatslauf bündelt fällige Provisionen je Partner und Währung. Hier: CSV für
        Wise, SEPA oder PayPal laden, überweisen, mit Referenz bestätigen. Die Gutschrift
        (Self-Billing) entsteht je Auszahlung.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={`/partner/auszahlungen?status=${t.status}`}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              aktiv === t.status
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <PartnerAuszahlungen zahlungen={liste.items} darfEntscheiden={me.can_write} />
    </div>
  );
}
