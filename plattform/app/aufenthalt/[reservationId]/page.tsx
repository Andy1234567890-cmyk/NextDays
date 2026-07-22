// Aufenthalts-/Gastmodul-Seite. Die Ansicht (Check-in-Infos, Türcode,
// Self-Check-in) ist eine Client-Insel.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { AufenthaltAnsicht } from "@/components/aufenthalt-ansicht";
import { KontoShell } from "@/components/konto-shell";

export default async function AufenthaltPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  return (
    <KontoShell
      titel="Dein Aufenthalt"
      aktion={
        <Link
          href={`/buchungen/${reservationId}`}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <Icon icon="ph:arrow-left" className="size-4" />
          Zur Buchung
        </Link>
      }
    >
      <AufenthaltAnsicht reservationId={reservationId} />
    </KontoShell>
  );
}
