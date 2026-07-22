// Buchungsdetail-Seite. Die eigentliche Ansicht (Aufschlüsselung, Timeline,
// Storno) ist eine Client-Insel, damit Interaktion + Nachladen funktionieren.
import Link from "next/link";
import { Icon } from "@iconify/react";

import { BuchungDetailAnsicht } from "@/components/buchung-detail";
import { KontoShell } from "@/components/konto-shell";

export default async function BuchungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <KontoShell
      titel="Buchung"
      aktion={
        <Link
          href="/buchungen"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <Icon icon="ph:arrow-left" className="size-4" />
          Alle Buchungen
        </Link>
      }
    >
      <BuchungDetailAnsicht id={id} />
    </KontoShell>
  );
}
