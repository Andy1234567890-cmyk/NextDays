// Die Personalisierungs-Regeln einer Kunden-Seite (0440) — Server-Teil.
//
// Dieselbe Zweiteilung wie bei den Pop-ups (0437) und aus demselben Grund: die
// BEDINGUNGEN gehören in den Browser (Gerät, Uhrzeit beim Gast, wievielter
// Besuch, Kampagnen-Parameter), die INHALTE sind Server-Components — ein
// Pop-up mit Objektliste holt Objekte, Preise und Bewertungen.
//
// Geladen wird hier auch der INHALT der Pop-ups, auf die Regeln zeigen. Nur
// derer, auf die wirklich eine Regel zeigt: ein Betrieb kann zwanzig Pop-ups
// haben, und neunzehn davon vorzurendern wäre Arbeit für nichts.
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { RegelBuehne } from "@/components/regel-buehne";
import { aktuellerHost } from "@/lib/host";
import type { Regel } from "@/lib/regeln";
import { ladePopups, ladeRegeln } from "@/lib/seo";
import type { Block } from "@/lib/site";

export async function RegelFlaeche({
  tenantId,
  sprache,
  standardSprache,
  cookieOffen,
}: {
  tenantId: string;
  sprache: string;
  standardSprache: string;
  cookieOffen: boolean;
}) {
  const host = await aktuellerHost();
  if (!host) return null;
  const { items, ortVerfuegbar } = await ladeRegeln(host);
  if (items.length === 0) return null;

  // Welche Pop-ups werden von einer Regel gebraucht?
  const gebraucht = new Set(
    items
      .filter((r) => r.action_type === "popup")
      .map((r) => String((r.action as { page_id?: string }).page_id ?? ""))
      .filter(Boolean),
  );

  const inhalte: Record<string, React.ReactNode> = {};
  const titel: Record<string, string> = {};
  if (gebraucht.size > 0) {
    const popups = await ladePopups(host);
    for (const p of popups) {
      if (!gebraucht.has(p.id)) continue;
      titel[p.id] = p.title;
      inhalte[p.id] = (
        <BlockRenderer
          blocks={p.blocks as Block[]}
          tenantId={tenantId}
          modus={{ aktiv: false, locale: sprache }}
        />
      );
    }
  }

  return (
    <RegelBuehne
      regeln={items as unknown as Regel[]}
      ortVerfuegbar={ortVerfuegbar}
      sprache={sprache}
      standardSprache={standardSprache}
      popupInhalte={inhalte}
      popupTitel={titel}
      cookieOffen={cookieOffen}
    />
  );
}
