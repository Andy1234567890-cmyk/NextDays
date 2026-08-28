"use client";

// „Bild ersetzen" (Hostaway: „Replace image") — ein Bild an ALLEN
// Verwendungsstellen gegen ein anderes tauschen.
//
// Die Bildwahl läuft über eine EIGENE, kleine Kachelwand statt die große aus
// dem Hauptdialog wiederzuverwenden: hier gibt es keine Ordner-Navigation,
// keine Mehrfachauswahl und das ALTE Bild fehlt aus der Liste — drei
// Abweichungen, die eine geteilte Komponente nur mit Sonderfällen abbilden
// könnte.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import type { Medium } from "@/lib/site-pages";
import {
  type ErsetzenErgebnis,
  listMediaGefiltert,
  replaceMedium,
} from "@/lib/site-medien";

export function ErsetzenDialog({
  medium,
  onAbbrechen,
  onFertig,
}: {
  medium: Medium;
  onAbbrechen: () => void;
  /** Läuft nach erfolgreichem Tausch — der Aufrufer lädt den Bestand neu. */
  onFertig: () => void;
}) {
  const t = useTranslations("website.mediathek");
  const [bilder, setBilder] = useState<Medium[] | null>(null);
  const [ersatz, setErsatz] = useState<Medium | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<ErsetzenErgebnis | null>(null);

  useEffect(() => {
    void listMediaGefiltert({ limit: 200 }).then((res) => {
      if (res.ok) setBilder(res.data.items.filter((m) => m.id !== medium.id));
    });
  }, [medium.id]);

  async function ersetzen() {
    if (!ersatz) return;
    setLaeuft(true);
    const res = await replaceMedium(medium.id, ersatz.id);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setErgebnis(res.data);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("ersetzen.titel")}
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4"
      onClick={onAbbrechen}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <h3 className="font-display text-base font-extrabold">
            {t("ersetzen.titel")}
          </h3>
          <button
            type="button"
            aria-label={t("ordner.abbrechen")}
            onClick={onAbbrechen}
            className="text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        {ergebnis ? (
          <div className="flex flex-col gap-3 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Icon icon="ph:check-circle" className="size-5 shrink-0" />
              {t("ersetzen.erfolg", { anzahl: ergebnis.replaced })}
            </p>
            {ergebnis.manual > 0 ? (
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0" />
                {t("ersetzen.manuell", { anzahl: ergebnis.manual })}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {t("ersetzen.altesBleibtBestehen")}
            </p>
            <Button onClick={onFertig} className="mt-2 self-end">
              {t("ordner.fertig")}
            </Button>
          </div>
        ) : (
          <>
            <p className="px-5 pt-3 text-sm text-muted-foreground">
              {t("ersetzen.hinweis", { name: medium.filename || medium.url })}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {bilder === null ? (
                <p className="text-sm text-muted-foreground">{t("laedt")}</p>
              ) : bilder.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("leer")}</p>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {bilder.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setErsatz(m)}
                        className={
                          "block w-full overflow-hidden rounded-(--radius) border transition " +
                          (ersatz?.id === m.id
                            ? "border-(--brand) ring-2 ring-(--brand)/30"
                            : "border-border hover:border-foreground/40")
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.url}
                          alt={m.alt_text ?? m.filename ?? ""}
                          loading="lazy"
                          className="aspect-square w-full bg-secondary/40 object-cover"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={onAbbrechen}
                className="rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:bg-secondary"
              >
                {t("ordner.abbrechen")}
              </button>
              <Button disabled={!ersatz || laeuft} onClick={() => void ersetzen()}>
                {laeuft ? t("laedtHoch") : t("ersetzen.bestaetigen")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
