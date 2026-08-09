// Offizielle Ankündigungen an alle Betriebe (Neuerungen, Wartung, Hinweise).
//
// Zielgruppe im Kundendashboard sind nur `admin` und `co_admin` — Eigentümer,
// Mitarbeitende und Reinigungskräfte sehen davon nichts.
import Link from "next/link";

import { getAnkuendigungen } from "@/lib/announcements";
import { getPlatformMe } from "@/lib/backoffice";

import { AnkuendigungListe } from "@/components/ankuendigungen/ankuendigung-liste";

export default async function AnkuendigungenSeite() {
  const [me, liste] = await Promise.all([
    getPlatformMe(),
    getAnkuendigungen({ limit: 100 }),
  ]);

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      {/* HIER stünde sonst <RealtimeRefresh table="announcements" />.
          Bewusst nicht: `announcements` hat für `authenticated` kein
          `grant select` (Wurzel 6 — sonst läge jeder Entwurf, etwa
          „Wartungsfenster am 3.", für jeden eingeloggten Nutzer jedes Betriebs
          offen). Ein Abo ohne Grant ist eine stumme Attrappe: die Oberfläche
          sähe live aus und aktualisierte nie. Die Liste ist stattdessen eine
          Server Component mit revalidatePath nach jeder Aktion. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">
            Ankündigungen
          </h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted-foreground">
            Offizielle Mitteilungen an alle Betriebe. Veröffentlichte
            Ankündigungen erscheinen beim nächsten Login des Betriebs — es gibt
            bewusst keine Live-Zustellung.
          </p>
        </div>
        {me.can_write && (
          <Link
            href="/ankuendigungen/neu"
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Neue Ankündigung
          </Link>
        )}
      </div>

      {!me.can_write && (
        <p className="mt-6 max-w-3xl rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Dein Zugang darf Ankündigungen ansehen, aber nicht anlegen oder
          veröffentlichen.
        </p>
      )}

      <AnkuendigungListe items={liste.items} />
    </div>
  );
}
