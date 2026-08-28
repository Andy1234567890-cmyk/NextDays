"use client";

// Symbolsuche: der Bestand des Reiters „Symbole", solange die Quelle
// „kostenlose Symbole" gewählt ist.
//
// Dieselbe Bauart wie die Stock-Foto-Suche daneben, und aus demselben Grund:
// suchen tut der SERVER (Deckel, IP-Prüfung, eigener Rate-Limit-Eimer), und die
// LIZENZ steht schon am Treffer. Ein Symbol aus einem CC-BY-Satz verlangt eine
// Nennung — das gehört vor die Entscheidung, es zu benutzen, nicht danach.
//
// Übernommen wird per Klick: das Symbol wird eine Zeile in der Mediathek
// (Hotlink, kein Rehosting — ein SVG in unserem öffentlichen Bucket wäre
// Stored-XSS). Danach liegt es im eigenen Bestand und verhält sich wie jedes
// andere Medium: Ordner, Alt-Text, Verwendungsnachweis, Ersetzen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { type IconTreffer, sucheIcons, uebernehmeIcon } from "@/lib/site-medien";
import type { Medium } from "@/lib/site-pages";

export function IconSuche({
  aktuellerOrdner,
  onUebernommen,
}: {
  /** In welchen Ordner ein übernommenes Symbol fällt. `""` = Wurzel. */
  aktuellerOrdner: string;
  onUebernommen: (m: Medium) => void;
}) {
  const t = useTranslations("website.mediathek");
  const [begriff, setBegriff] = useState("");
  const [treffer, setTreffer] = useState<IconTreffer[] | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [uebernahme, setUebernahme] = useState<string | null>(null);

  async function suchen() {
    const wert = begriff.trim();
    if (!wert) return;
    setLaedt(true);
    const res = await sucheIcons(wert);
    setLaedt(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setTreffer(res.data.items);
  }

  async function uebernehmen(treff: IconTreffer) {
    setUebernahme(treff.icon);
    const res = await uebernehmeIcon(treff.icon, aktuellerOrdner || null);
    setUebernahme(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("symbole.uebernommen"));
    onUebernommen(res.data);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <input
          value={begriff}
          placeholder={t("symbole.platzhalter")}
          aria-label={t("symbole.platzhalter")}
          onChange={(e) => setBegriff(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void suchen();
          }}
          className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={laedt || !begriff.trim()}
          onClick={() => void suchen()}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-secondary disabled:opacity-50"
        >
          <Icon
            icon={laedt ? "svg-spinners:180-ring" : "ph:magnifying-glass"}
            className="size-4"
          />
          {t("symbole.suchen")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {treffer === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("symbole.einstieg")}
          </p>
        ) : treffer.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("symbole.keinTreffer")}
          </p>
        ) : (
          <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {treffer.map((treff) => (
              <li key={treff.icon}>
                <button
                  type="button"
                  disabled={uebernahme !== null}
                  onClick={() => void uebernehmen(treff)}
                  title={`${treff.icon}${treff.lizenz ? ` · ${treff.lizenz}` : ""}`}
                  className="flex aspect-square w-full items-center justify-center rounded-(--radius) border border-border transition hover:border-(--brand) hover:bg-secondary/50 disabled:opacity-50"
                >
                  {uebernahme === treff.icon ? (
                    <Icon icon="svg-spinners:180-ring" className="size-5" />
                  ) : (
                    // Das Symbol wird hier über die Bibliothek GERENDERT (wie
                    // jedes andere Symbol der Oberfläche) und nicht als <img>
                    // auf die SVG-Adresse geladen: 48 Bilder je Suche wären 48
                    // Anfragen, und dieselbe Bibliothek liegt schon im Browser.
                    <Icon icon={treff.icon} className="size-7" />
                  )}
                </button>
                <p className="mt-1 truncate text-center text-[0.625rem] text-muted-foreground">
                  {treff.satz}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Die Lizenz ist keine Fußnote: sie steht dauerhaft am unteren Rand des
          Bereichs, weil sie für JEDEN Treffer darüber gilt. */}
      <p className="shrink-0 border-t border-border px-4 py-2 text-[0.6875rem] text-muted-foreground">
        {t("symbole.lizenzHinweis")}
      </p>
    </div>
  );
}
