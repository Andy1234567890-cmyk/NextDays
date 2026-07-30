// Support: Live-Konsole für Chats aus den Betrieben und Formular-Anfragen.
// Beide Melder-Welten (Betriebs-Nutzer und Plattform-Gäste) laufen hier
// zusammen; die Konsole selbst ist eine Client-Komponente, weil sie live ist —
// Liste, Verlauf und Tippt-Anzeige kommen über Supabase-Realtime.
import { getPlatformMe } from "@/lib/backoffice";

import { SupportKonsole } from "@/components/support-konsole";

export default async function SupportSeite({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const me = await getPlatformMe();

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-border px-5 py-4">
        <h1 className="font-sans text-[1.5rem] font-bold tracking-tight">
          Support
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live-Chats und Anfragen von Betrieben und Plattform-Gästen.
        </p>
      </div>
      <SupportKonsole eigeneUserId={me.user_id} startId={c} />
    </div>
  );
}
