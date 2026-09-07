"use client";

// Die rechte Leiste für einen CONTAINER — Abschnitt, Spalte, innere Spalte.
//
// Seit 05.09.2026 („ich will dieselbe Sidebar mit allem genau so wie Framer")
// ist sie nichts anderes als das Style-Panel (`StilInspektor`) mit den
// Container-Zusätzen: Spaltenbreite in der Karte „Größe", Spalten und
// Innenabstand in der Karte „Layout". Kein Kopf mit Name und Breadcrumb
// (das steht in den Ebenen), keine Struktur-Knöpfe (Kontextmenü und Ebenen),
// keine Design-Karte mit orangen Geräteknöpfen (Sichtbar steht in „Stil",
// je Breakpoint).
//
// Jede Strukturänderung läuft über EINEN Weg mit Sperre: ein zweiter Klick
// während des ersten würde denselben Vorgang doppelt auslösen (Wurzel 2).
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { Geraet } from "@nextdays/baukasten-stil";

import { type Block, addContainer, updateBlock } from "@/lib/site-pages";

import { type Gemessen, StilInspektor } from "./stil-inspektor";

export function ContainerInspektor({
  container,
  geschwister,
  kinder,
  geraet,
  sprache,
  gemessen = null,
  ankerListe,
  onLiveStil,
  onGeaendert,
}: {
  container: Block;
  /** Die Container derselben Ebene, nach Rang — für die Spaltenzahl. */
  geschwister: Block[];
  /** Die direkten Kinder — bei einem Abschnitt seine Spalten. */
  kinder: Block[];
  /** Das Gerät der Vorschau — Layout, Größe und Stil schreiben DAFÜR. */
  geraet: Geraet;
  /** Die Inhaltssprache — der Overlay-Text hängt daran. */
  sprache: string;
  gemessen?: Gemessen | null;
  ankerListe?: readonly string[];
  /** Die geänderte Darstellung SOFORT in die Vorschau schicken — sie steht
   *  dort, bevor der Server geantwortet hat (06.09.2026). Ohne das sah man
   *  jede Änderung an einem Abschnitt erst nach `router.refresh()`. */
  onLiveStil?: (settings: Record<string, unknown>) => void;
  /** Nach jeder Strukturänderung lädt der Aufrufer den Baum neu. */
  onGeaendert: () => void;
}) {
  const t = useTranslations("website");
  const [laeuft, setLaeuft] = useState(false);
  const istSpalte = container.kind === "column" || container.kind === "inner_column";
  const spaltenZahl = geschwister.filter(
    (g) => (g.kind ?? "widget") === "column" || g.kind === "inner_column",
  ).length;

  async function fuehreAus(aktion: () => Promise<{ ok: boolean; error?: string }>) {
    if (laeuft) return;
    setLaeuft(true);
    try {
      const res = await aktion();
      if (!res.ok) {
        toast.error(res.error ?? t("seiten.fehlgeschlagen"));
        return;
      }
      onGeaendert();
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <StilInspektor
      sprache={sprache}
      settings={(container.settings ?? {}) as Record<string, unknown>}
      geraet={geraet}
      gemessen={gemessen}
      ankerListe={ankerListe}
      laeuft={laeuft}
      onSettings={(neu) => {
        onLiveStil?.(neu);
        void fuehreAus(() => updateBlock(container.id, { settings: neu }));
      }}
      container={{
        istSpalte,
        // EINE Spalte über die volle Breite ist keine Spalte, sondern der
        // Inhaltsbereich — erst ab zwei trägt `span` eine Information.
        span: istSpalte && spaltenZahl > 1 ? (container.span ?? 12) : null,
        onSpan: (span) => void fuehreAus(() => updateBlock(container.id, { span })),
        kinderZahl: kinder.length,
        onSpalteHinzu: !istSpalte
          ? () =>
              void fuehreAus(() =>
                addContainer(container.page_id, "column", {
                  parentId: container.id,
                  span: Math.max(1, Math.floor(12 / Math.max(1, kinder.length + 1))),
                }),
              )
          : undefined,
      }}
    />
  );
}
