"use client";

// „Bilder importieren": ein Bild von einer fremden Adresse in die Mediathek
// holen (Punkt 3 des Vorbilds, „Import Images").
//
// Der Dialog ist absichtlich karg — eine Adresse, ein Knopf. Alles, was zählt,
// passiert auf dem Server: er prüft, ob die Adresse überhaupt abgerufen werden
// darf (interne Netze, Metadaten-Dienst, DNS-Rebinding), deckelt die Menge beim
// Lesen und entscheidet an den Anfangsbytes, ob dahinter wirklich ein Bild
// liegt. Eine Prüfung hier im Browser wäre Zierde: wer den Aufruf umgeht, sieht
// sie nie.
//
// Was der Dialog dem Kunden trotzdem sagt: dass er die RECHTE braucht. Ein
// Bild, das man von einer fremden Seite kopiert, ist nicht deshalb frei, weil
// es sich herunterladen ließ.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { importiereMediumVonUrl } from "@/lib/site-medien";
import type { Medium } from "@/lib/site-pages";

export function ImportDialog({
  ordnerId,
  onAbbrechen,
  onFertig,
}: {
  /** In welchen Ordner das Bild fällt. `null` = Wurzel. */
  ordnerId: string | null;
  onAbbrechen: () => void;
  onFertig: (m: Medium) => void;
}) {
  const t = useTranslations("website.mediathek");
  const [adresse, setAdresse] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function holen() {
    const wert = adresse.trim();
    if (!wert) return;
    setLaeuft(true);
    const res = await importiereMediumVonUrl(wert, ordnerId);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("import.fertig"));
    onFertig(res.data);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("import.titel")}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onAbbrechen}
    >
      <div
        className="w-full max-w-md rounded-(--radius) border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-extrabold">
          {t("import.titel")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("import.hinweis")}</p>

        <label
          htmlFor="mediathek-import-url"
          className="mt-4 block text-xs font-medium"
        >
          {t("import.feld")}
        </label>
        <input
          id="mediathek-import-url"
          autoFocus
          value={adresse}
          inputMode="url"
          placeholder="https://…"
          onChange={(e) => setAdresse(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void holen();
            if (e.key === "Escape") onAbbrechen();
          }}
          className="mt-1 w-full rounded-(--radius) border border-border bg-transparent px-2.5 py-1.5 text-sm"
        />

        <p className="mt-3 rounded-(--radius) bg-secondary/60 px-2.5 py-2 text-xs text-muted-foreground">
          {t("import.rechte")}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onAbbrechen}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            {t("ordner.abbrechen")}
          </button>
          <Button disabled={laeuft || !adresse.trim()} onClick={() => void holen()}>
            {laeuft ? (
              <Icon icon="svg-spinners:180-ring" className="mr-1.5 size-4" />
            ) : (
              <Icon icon="ph:download-simple" className="mr-1.5 size-4" />
            )}
            {t("import.holen")}
          </Button>
        </div>
      </div>
    </div>
  );
}
