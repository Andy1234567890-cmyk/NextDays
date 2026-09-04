// Personal → Dienstplan (Vertrag §5): Tag / Woche / Monat, Grid / Liste.
//
// Serverseitig wird ALLES geladen, was die Oberfläche zum ersten Bild braucht —
// Plan des Fensters, Betriebsregeln (`kennzahlen_zeilen`, `wetter_anzeigen`,
// Zeitzone), Arbeitsbereiche, Schichtvorlagen, Objekte, Kennzahlen, offene
// Tausche und `getMe()` für Rechte und Betriebsname. Danach lebt die Ansicht im
// Client (Realtime + Nachladen).
//
// FÄLLT EINE NEBENABFRAGE AUS, bleibt der Plan bedienbar: nur der Plan selbst
// ist tragend (ohne ihn gibt es nichts zu zeigen), alles andere fällt auf einen
// LEEREN Wert zurück, nicht auf einen erfundenen (Wurzel 4) — fehlende
// Kennzahlen sind `null`, und der Kopf sagt das (`kennzahlen.nichtGeladen`),
// statt Nullen zu zeigen.
//
// Das Fenster steht in der URL (`ansicht`, `anker`) und wird hier genauso
// gerechnet wie im Client, damit der erste Server-Render und der erste
// Client-Render dasselbe Fenster meinen.
import { notFound } from "next/navigation";

import { Dienstplan } from "@/components/personal/dienstplan";
import { getMe } from "@/lib/auth";
import { getRegeln, listArbeitsbereiche, listVorlagen } from "@/lib/personal";
import { getKennzahlen, getPlanWoche, getPlanZeitraum, listTausch } from "@/lib/personal-planung";
import { type Ansicht, monatsRasterStart } from "@/lib/personal-planung-typen";
import { heuteIso, montagVon, tagePlus } from "@/lib/personal-typen";
import { listProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Dasselbe Fenster wie im Client (`dienstplan.tsx`, `fenster`). */
function fenster(ansicht: Ansicht, anker: string): { von: string; bis: string } {
  if (ansicht === "tag") return { von: anker, bis: anker };
  if (ansicht === "woche") {
    const m = montagVon(anker);
    return { von: m, bis: tagePlus(m, 6) };
  }
  const start = monatsRasterStart(anker);
  return { von: start, bis: tagePlus(start, 41) };
}

export default async function SchichtplanPage({
  searchParams,
}: {
  searchParams: Promise<{ ansicht?: string; anker?: string; woche?: string }>;
}) {
  const sp = await searchParams;
  const ansicht: Ansicht =
    sp.ansicht === "tag" || sp.ansicht === "monat" ? sp.ansicht : "woche";
  // `woche` bleibt gültig: Deep-Links aus Mail und Glocke tragen ihn (§1.8).
  const rohAnker = sp.anker ?? sp.woche;
  const anker = rohAnker && ISO.test(rohAnker) ? rohAnker : heuteIso();
  const { von, bis } = fenster(ansicht, anker);

  // Die Kalenderwoche läuft weiter über `/dienstplan?woche=` (gleiche
  // Antwortform, §1.3); jedes andere Fenster über `/dienstplan/zeitraum`.
  const istWoche = ansicht === "woche";
  const [plan, regeln, bereiche, vorlagen, objekte, kennzahlen, tausche, me] = await Promise.all([
    istWoche ? getPlanWoche(von) : getPlanZeitraum(von, bis),
    getRegeln(),
    listArbeitsbereiche(),
    listVorlagen(),
    listProperties(),
    getKennzahlen(von, bis),
    listTausch(montagVon(anker)),
    getMe(),
  ]);

  if (!plan.ok) {
    if (plan.status === 403) notFound();
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {plan.error}
      </div>
    );
  }

  return (
    <Dienstplan
      initial={plan.data}
      regeln={regeln.ok ? regeln.data : null}
      arbeitsbereiche={bereiche.ok ? bereiche.data : []}
      vorlagen={vorlagen.ok ? vorlagen.data : []}
      objekte={objekte.ok ? objekte.data.items.map((p) => ({ id: p.id, title: p.title })) : []}
      kennzahlenInitial={kennzahlen.ok ? kennzahlen.data : null}
      tauschInitial={tausche.ok ? tausche.data : []}
      kannPlanen={me?.capabilities.includes("plan_schichten") ?? false}
      eigeneId={me?.user_id ?? null}
      betrieb={me?.tenant_name ?? null}
    />
  );
}
