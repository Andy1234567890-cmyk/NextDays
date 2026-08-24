// Die Pop-ups einer Kunden-Seite (0437) — Server-Teil.
//
// Warum zweigeteilt: die AUSLÖSER gehören in den Browser (Zeit,
// Verlassensabsicht, gelesener Anteil), die ABSCHNITTE sind Server-Components
// (sie holen Objekte, Bewertungen, Preise). Diese Datei rendert den Inhalt
// serverseitig vor und übergibt ihn der Client-Komponente, die ihn einblendet.
//
// Die Alternative — den Inhalt im Browser nachladen — hätte bedeutet, dass ein
// Pop-up mit Objektliste erst nach einem zweiten Abruf steht. Und dass ein
// Besucher ohne JavaScript nichts sieht, ist hier richtig: ein Pop-up OHNE
// JavaScript kann sich auch nicht schließen lassen.
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { Popups, type PopupDaten } from "@/components/popups";
import { aktuellerHost } from "@/lib/host";
import { ladePopups } from "@/lib/seo";
import type { Block } from "@/lib/site";

export async function PopupFlaeche({
  tenantId,
  sprache,
}: {
  tenantId: string;
  sprache: string;
}) {
  const host = await aktuellerHost();
  if (!host) return null;
  const popups = await ladePopups(host);
  if (popups.length === 0) return null;

  const daten: PopupDaten[] = popups.map((p) => ({
    id: p.id,
    title: p.title,
    trigger: p.trigger,
    value: p.value,
    device: p.device,
    once: p.once,
  }));

  // Der Inhalt je Pop-up, vorgerendert. `modus.aktiv = false`: in einem Pop-up
  // wird nicht direkt bearbeitet — der Kunde öffnet es im Editor als eigene
  // Seite.
  const kinder: Record<string, React.ReactNode> = {};
  for (const p of popups) {
    kinder[p.id] = (
      <BlockRenderer
        blocks={p.blocks as Block[]}
        tenantId={tenantId}
        modus={{ aktiv: false, locale: sprache }}
      />
    );
  }

  return <Popups popups={daten} sprache={sprache} kinder={kinder} />;
}
