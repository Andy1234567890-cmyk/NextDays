// Channel-Manager → Schlösser (/channels/schloesser). Zugleich das Ziel der
// Rückleitung aus der Anmeldemaske des Schloss-Herstellers: diese Adresse wird
// beim Start des Connect Webviews als Rückkehr-URL mitgegeben (0573).
//
// Warum unter /channels und nicht unter /erweiterungen: Türcodes hängen am
// Buchungsvorgang wie ein Vertriebskanal — sie entstehen mit der Buchung,
// ändern sich mit ihr und werden mit ihr zurückgezogen. Neben WhatsApp ist
// deshalb der richtige Platz, nicht in einer Liste optionaler Zusätze.
import { SchloesserVerwaltung } from "@/components/schloesser/schloesser-verwaltung";

export const dynamic = "force-dynamic";

export default function SchloesserKanalPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Schlösser</h1>
        <p className="text-sm text-muted-foreground">
          Jede Buchung bekommt ihren eigenen Türcode, gültig von der Anreise bis
          zur Abreise. Der Betrieb verbindet sein eigenes Schloss-Konto; die
          Codes gehen über die Gastnachricht hinaus.
        </p>
      </header>

      <SchloesserVerwaltung />
    </div>
  );
}
