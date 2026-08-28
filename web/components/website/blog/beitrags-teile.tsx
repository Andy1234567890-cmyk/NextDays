"use client";

// Die TEILE eines Beitrags in der Abschnitts- und der Ebenenliste.
//
// WARUM ES DAS GIBT
// =================
// Ein Blogbeitrag ist eine Seite (`page_type = "post"`), hat aber KEINE
// Abschnitte: sein Inhalt steht in `content_html` und den Beitragsfeldern
// (0483/0485). Beide Listen im Editor arbeiten auf `site_blocks` — für einen
// Beitrag fanden sie dort nichts und schrieben „Noch keine Abschnitte".
//
// Daneben zeichnete die Vorschau Titelbild, Einordnung, Einleitung, Galerien,
// Karussell und Text. Links stand also „hier ist nichts", rechts stand alles.
// Genau so wurde es gemeldet (28.08.2026: „die Section werden nicht richtig
// angezeigt", „auch in layer nicht").
//
// Diese Liste zeigt, was die Vorschau zeichnet — in DERSELBEN Reihenfolge wie
// `builder/components/blog/beitrag-felder.tsx`. Zwei Reihenfolgen für dieselben
// Teile wären zwei Behauptungen darüber, wie der Beitrag aussieht.
//
// WAS SIE NICHT IST
// =================
// Keine Abschnittsliste. Man kann hier nichts umsortieren, duplizieren oder
// löschen — die Teile eines Beitrags sind FELDER, ihre Reihenfolge liegt fest.
// Ein Ziehgriff daran wäre eine Attrappe. Ein Klick öffnet das Feld dort, wo es
// bearbeitet wird: im Beitragsdialog.
//
// LEERE TEILE STEHEN MIT
// ======================
// Anders als in der Vorschau, wo ein leeres Feld nichts erzeugt. Hier ist die
// Liste die INHALTSÜBERSICHT: „Karussell — leer" ist die Antwort auf „warum
// sehe ich kein Karussell". Eine Liste, die nur zeigt, was schon da ist,
// beantwortet diese Frage nie.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { EigenesFeld, Page } from "@/lib/site-pages";

type Teil = {
  key: string;
  icon: string;
  name: string;
  /** Ist etwas eingetragen? Entscheidet nur über die Darstellung — die Zeile
   *  steht so oder so da. */
  gefuellt: boolean;
};

function teileVon(
  page: Page,
  eigene: readonly EigenesFeld[],
  t: (k: string) => string,
): Teil[] {
  const p = page as unknown as Record<string, unknown>;
  const voll = (k: string) => {
    const w = p[k];
    if (w === null || w === undefined) return false;
    if (typeof w === "string") return w.trim().length > 0;
    if (Array.isArray(w)) return w.length > 0;
    return Boolean(w);
  };
  const custom = (page.custom ?? {}) as Record<string, unknown>;

  return [
    {
      key: "cover",
      icon: "ph:image",
      name: t("blog.titelbild"),
      gefuellt: voll("cover_image_url"),
    },
    {
      key: "einordnung",
      icon: "ph:tag",
      name: t("blog.teile.einordnung"),
      gefuellt: voll("industry") || voll("client"),
    },
    {
      key: "full_title",
      icon: "ph:text-t",
      name: t("blog.felder.vollerTitel"),
      gefuellt: voll("full_title"),
    },
    {
      key: "intro",
      icon: "ph:text-align-left",
      name: t("blog.teile.einleitung"),
      gefuellt: voll("intro_heading") || voll("intro_body"),
    },
    {
      key: "cta",
      icon: "ph:cursor-click",
      name: t("blog.teile.aufforderung"),
      gefuellt: voll("button_text") && voll("website_link"),
    },
    {
      key: "gallery_top",
      icon: "ph:images",
      name: t("blog.felder.galerieOben"),
      gefuellt: voll("gallery_top"),
    },
    {
      key: "gallery_seiten",
      icon: "ph:columns",
      name: t("blog.teile.galerieSeiten"),
      gefuellt: voll("gallery_left") || voll("gallery_right"),
    },
    {
      key: "gallery_bottom",
      icon: "ph:images",
      name: t("blog.felder.galerieUnten"),
      gefuellt: voll("gallery_bottom"),
    },
    {
      key: "final",
      icon: "ph:text-align-left",
      name: t("blog.teile.abschluss"),
      gefuellt: voll("final_heading") || voll("final_body"),
    },
    {
      key: "carousel",
      icon: "ph:slideshow",
      name: t("blog.felder.karussellZeigen"),
      // Der SCHALTER entscheidet, nicht die Bilder: vier Bilder bei
      // ausgeschaltetem Karussell erscheinen nicht, und die Liste soll
      // zeigen, was erscheint.
      gefuellt:
        Boolean(p.show_carousel) &&
        [1, 2, 3, 4].some((n) => voll(`carousel_${n}`)),
    },
    {
      key: "content",
      icon: "ph:article",
      name: t("blog.cm.text"),
      gefuellt: voll("content_html"),
    },
    ...eigene
      .filter((f) => !f.versteckt)
      .map((f) => ({
        key: `custom-${f.feld_key}`,
        icon: "ph:plus-square",
        name: f.label,
        gefuellt: (() => {
          const w = custom[f.feld_key];
          if (w === null || w === undefined || w === "" || w === false) {
            return false;
          }
          return !(Array.isArray(w) && w.length === 0);
        })(),
      })),
  ];
}

export function BeitragsTeile({
  page,
  eigeneFelder = [],
  onOeffnen,
}: {
  page: Page;
  eigeneFelder?: readonly EigenesFeld[];
  /** Öffnet den Beitragsdialog — dort werden diese Felder bearbeitet. */
  onOeffnen: () => void;
}) {
  const t = useTranslations("website");
  const teile = teileVon(page, eigeneFelder, t);

  return (
    <div className="flex flex-col pb-8">
      <p className="px-4 pb-2 pt-1 text-xs text-muted-foreground">
        {t("blog.teile.hinweis")}
      </p>
      <ul>
        {teile.map((teil) => (
          <li key={teil.key}>
            <button
              type="button"
              onClick={onOeffnen}
              className="flex w-full items-center gap-1.5 px-4 py-1.5 text-left transition hover:bg-secondary/60"
            >
              <Icon
                icon={teil.icon}
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span
                className={
                  "min-w-0 flex-1 truncate text-sm " +
                  // Ein leerer Teil steht blasser da. Er FEHLT nicht — er ist
                  // nur noch nicht ausgefüllt, und das ist der Unterschied
                  // zwischen „gibt es nicht" und „steht noch aus".
                  (teil.gefuellt ? "" : "text-muted-foreground/60")
                }
              >
                {teil.name}
              </span>
              {teil.gefuellt ? null : (
                <span className="shrink-0 text-[0.6875rem] text-muted-foreground/60">
                  {t("blog.zelle.leer")}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onOeffnen}
        className="mx-4 mt-3 flex items-center justify-center gap-1.5 rounded-(--radius) border border-border py-1.5 text-xs text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
      >
        <Icon icon="ph:pencil-simple" className="size-3.5" />
        {t("blog.teile.bearbeiten")}
      </button>
    </div>
  );
}
