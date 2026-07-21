// Einstellungen — Buchungs-Konditionen (Zahlungsplan/Storno/Kaution).
// Serverseitig die Konditionen des Tenants laden; die Client-Komponente steuert
// Liste, Erstellen/Bearbeiten und die Aktionen. Der Channel-Manager hat eine
// eigene Seite (/channels) und ist hier bewusst NICHT eingebettet.
import { BookingConditionsManager } from "@/components/einstellungen/booking-conditions";
import { listBookingConditions } from "@/lib/booking-conditions";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const res = await listBookingConditions();

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Konditionen</h1>
        <p className="text-sm text-muted-foreground">
          Buchungs-Konditionen: Zahlungsplan, Stornierung und Kaution als
          wiederverwendbare Vorlagen.
        </p>
      </header>

      {res.ok ? (
        <BookingConditionsManager initial={res.data} />
      ) : (
        <p className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Konditionen konnten nicht geladen werden: {res.error}
        </p>
      )}
    </div>
  );
}
