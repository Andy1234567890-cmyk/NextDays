"use client";

// Das Vorlagen-Panel — die Vorlagen als Liste in der Seitenleiste.
//
// Es steht im Abschnitts-Editor, damit der Klick auf „Vorlagen" die Seite nicht
// verlässt. Die große Galerie mit Vorschau bleibt im eigenen Reiter
// (`/website/vorlagen`): dort hat sie Platz für die Renderer-Vorschau je
// Vorlage, hier ist die Vorschau schon die eigene Website.
//
// WAS ES BEWUSST NICHT ZEIGT
// Keine Vorlagen-Vorschau. Wer im Editor an seiner Seite arbeitet, will nicht
// die Vorschau seiner Seite gegen die einer fremden Vorlage tauschen — er will
// wissen, was passiert, wenn er sie übernimmt. Genau das steht als Warnung
// darüber.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  type SeitenVorlage,
  type TemplateSummary,
  applyTemplate,
} from "@/lib/site-pages";

/** Einen mehrsprachigen Wert in der aktuellen Sprache lesen. `null` bleibt
 *  leer — kein erfundener Ersatzname (Wurzel 4). */
function text(v: unknown, locale: string): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const m = v as Record<string, string>;
    return m[locale] ?? m.de ?? m.en ?? Object.values(m)[0] ?? "";
  }
  return "";
}

export function VorlagenPanel({
  templates,
  kategorien,
  seitenVorlagen,
  onFertig,
  onAnsehen,
}: {
  templates: TemplateSummary[];
  kategorien: string[];
  seitenVorlagen: SeitenVorlage[];
  /** Nach dem Übernehmen: Panel schließen und die Vorschau neu laden. */
  onFertig: () => void;
  /** Eine Vorlage ANSEHEN — die Vorschau rechts zeigt sie, statt der eigenen
   *  Seite. Ohne das wählt man eine Vorlage blind: der Name sagt nichts über
   *  ihr Aussehen, und das Übernehmen ersetzt die eigenen Seiten. */
  onAnsehen?: (id: string) => void;
}) {
  const t = useTranslations("website");
  const locale = useLocale();
  const [kategorie, setKategorie] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sichtbar = kategorie
    ? templates.filter((v) => v.kategorie === kategorie)
    : templates;

  function uebernehmen(id: string) {
    start(async () => {
      const res = await applyTemplate(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("vorlagen.angewendet"));
      onFertig();
    });
  }

  return (
    <div className="flex flex-col pb-6">
      {/* Die Warnung steht ÜBER der Liste und nicht in einem Bestätigungsdialog:
          eine Vorlage ersetzt die Seiten des Betriebs, und das soll man wissen,
          bevor man klickt — nicht erst danach. */}
      <p className="px-4 pb-2 pt-3 text-xs text-muted-foreground">
        {t("vorlagen.ersetztHinweis")}
      </p>

      {kategorien.length > 0 ? (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          <button
            type="button"
            onClick={() => setKategorie(null)}
            aria-pressed={kategorie === null}
            className={
              "rounded-full px-2.5 py-1 text-xs transition " +
              (kategorie === null
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground")
            }
          >
            {t("vorlagen.alle")}
          </button>
          {kategorien.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKategorie(k)}
              aria-pressed={kategorie === k}
              className={
                "rounded-full px-2.5 py-1 text-xs transition " +
                (kategorie === k
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              {k}
            </button>
          ))}
        </div>
      ) : null}

      {sichtbar.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          {t("vorlagen.leer")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 px-3">
          {sichtbar.map((v) => (
            <li
              key={v.id}
              className="overflow-hidden rounded-(--radius) border border-border"
            >
              {/* Das Vorschaubild ist der eigentliche Inhalt einer
                  Vorlagen-Kachel: niemand wählt eine Vorlage nach ihrem Namen.
                  Es lag im Datensatz (`preview_image`) und wurde nur nirgends
                  gezeigt. */}
              {v.preview_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.preview_image}
                  alt={text(v.name, locale)}
                  loading="lazy"
                  className="h-28 w-full border-b border-border object-cover object-top"
                />
              ) : (
                // Kein Bild: eine ehrliche Fläche mit dem Symbol, kein
                // erfundener Platzhalter, der wie ein kaputtes Foto aussieht.
                <div className="flex h-28 w-full items-center justify-center border-b border-border bg-secondary">
                  <Icon
                    icon="ph:layout"
                    className="size-6 text-muted-foreground"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 px-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {text(v.name, locale)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAnsehen?.(v.id)}
                >
                  {t("vorlagen.ansehen")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => uebernehmen(v.id)}
                >
                  {t("vorlagen.uebernehmen")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {seitenVorlagen.length > 0 ? (
        <>
          <h3 className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("vorlagen.einzelneSeiten")}
          </h3>
          <ul className="flex flex-col px-3">
            {seitenVorlagen.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2 px-1 py-1.5 text-sm"
              >
                <Icon
                  icon="ph:file-text"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate">
                  {text(v.title, locale)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("vorlagen.abschnitte", { anzahl: v.block_count })}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
