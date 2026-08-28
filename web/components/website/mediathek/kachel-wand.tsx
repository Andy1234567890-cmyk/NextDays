"use client";

// Die Kachelwand: der Bestand als Raster oder als Liste.
//
// 1:1 nach dem Media Manager, an dem der Baukasten gemessen wird (Foto vom
// 27.08.2026, Punkte 8-10):
//
//     ┌────────┐ ┌────────┐ ┌────────┐
//     │ Ordner │ │ Ordner │ │ ┌────┐ │   ← Ordner stehen ALS KACHEL in der Wand
//     └────────┘ └────────┘ │ │Ausw│ │     (nicht nur im Baum links)
//      Linens(3)  Blankets   └─┴────┴─┘   ← beim Überfahren: „Auswählen" + ✕
//     ┌────────┐ ┌────────┐
//     │  ✓     │ │  ✓     │              ← gewählt: blauer Rahmen + Häkchen
//     └────────┘ └────────┘
//      dateiname.jpg (kursiv)
//
// WARUM ORDNER AUCH HIER STEHEN
// Der Ordnerbaum links beantwortet „wo bin ich", die Wand beantwortet „was ist
// hier". Ein Ordner, der nur im Baum steht, ist im Hauptbereich unsichtbar —
// man sieht einen leeren Bestand und weiß nicht, dass die 80 Bilder eine Ebene
// tiefer liegen. Genau deshalb führt das Vorbild sie doppelt.
//
// ZWEI ANSICHTEN, EIN ZUSTAND
// Raster und Liste zeigen denselben Bestand mit derselben Auswahl. Die Liste
// ist nicht Zierde: bei Dateien (PDF, DOCX) ist die Kachel ein Symbol mit
// Kürzel, und was man wirklich lesen will, sind Name, Größe und Datum.
import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";

import type { MediaOrdner } from "@/lib/site-medien";
import type { Medium } from "@/lib/site-pages";

import { MedienVorschau } from "./medien-vorschau";
import { MEDIEN_DRAG_TYP } from "./ordner-baum";

const HERKUNFT_ICON: Record<Medium["source"], string> = {
  upload: "",
  unsplash: "simple-icons:unsplash",
  pexels: "ph:image-square",
  iconify: "ph:shapes",
};

export type AnsichtsModus = "raster" | "liste";

/** Menge in Kilo-/Megabyte. `null` bleibt LEER und wird nicht als „0 KB"
 *  ausgegeben: Hotlinks (Stock, Symbole) liegen nicht bei uns, ihre Größe
 *  kennen wir nicht — eine 0 wäre eine Falschaussage (Wurzel 4). */
function groesse(bytes: number | null): string | null {
  if (bytes === null) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? `${mb.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function KachelWand({
  medien,
  ordner,
  modus,
  ausgewaehlt,
  aktivesDetail,
  mitVerwenden,
  onOeffneOrdner,
  onVerwende,
  onMehrfachUmschalten,
  onDetail,
  onLoeschen,
}: {
  medien: Medium[];
  /** Die Ordner, die in DIESER Ansicht als Kachel stehen (die Kinder des
   *  offenen Ordners bzw. die erste Ebene). Leer, wenn gesucht wird — ein
   *  Suchtreffer ist kein Ort. */
  ordner: MediaOrdner[];
  modus: AnsichtsModus;
  /** Mehrfachauswahl für Verschieben und Löschen — unabhängig vom Detail-Fokus
   *  (`aktivesDetail`), der immer genau ein Medium meint. */
  ausgewaehlt: Set<string>;
  aktivesDetail: string | null;
  /** `false` in der Verwaltungsansicht: dort gibt es kein Bildfeld, in das ein
   *  „Auswählen" das Medium einsetzen könnte. Der Knopf wäre eine Attrappe. */
  mitVerwenden: boolean;
  onOeffneOrdner: (o: MediaOrdner) => void;
  onVerwende: (m: Medium) => void;
  onMehrfachUmschalten: (id: string) => void;
  onDetail: (m: Medium) => void;
  onLoeschen: (m: Medium) => void;
}) {
  const t = useTranslations("website.mediathek");
  const f = useFormatter();

  if (medien.length === 0 && ordner.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("leer")}
      </p>
    );
  }

  if (modus === "liste") {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-10 px-3 py-2" />
            <th className="px-2 py-2 font-medium">{t("liste.name")}</th>
            <th className="px-2 py-2 font-medium">{t("liste.art")}</th>
            <th className="px-2 py-2 font-medium">{t("liste.groesse")}</th>
            <th className="px-2 py-2 font-medium">{t("liste.datum")}</th>
            <th className="w-10 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {ordner.map((o) => (
            <tr
              key={o.id}
              className="border-b border-border/60 hover:bg-secondary/40"
            >
              <td className="px-3 py-1.5">
                <Icon icon="ph:folder" className="size-5 text-muted-foreground" />
              </td>
              <td colSpan={4} className="px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => onOeffneOrdner(o)}
                  className="text-left font-medium underline-offset-2 hover:underline"
                >
                  {o.name}
                </button>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({o.media_count})
                </span>
              </td>
              <td />
            </tr>
          ))}
          {medien.map((m) => (
            <tr
              key={m.id}
              onClick={() => onDetail(m)}
              onDoubleClick={() => (mitVerwenden ? onVerwende(m) : onDetail(m))}
              className={
                "cursor-pointer border-b border-border/60 " +
                (aktivesDetail === m.id
                  ? "bg-secondary/60"
                  : "hover:bg-secondary/40")
              }
            >
              <td className="px-3 py-1.5">
                <span className="flex size-8 items-center justify-center overflow-hidden rounded-(--radius) border border-border">
                  <MedienVorschau medium={m} className="size-8" />
                </span>
              </td>
              <td className="max-w-0 truncate px-2 py-1.5 italic">
                {m.filename ?? t("liste.ohneNamen")}
              </td>
              <td className="px-2 py-1.5 text-muted-foreground">
                {t(`art.${m.kind}`)}
              </td>
              <td className="px-2 py-1.5 text-muted-foreground">
                {groesse(m.bytes) ?? "—"}
              </td>
              <td className="px-2 py-1.5 text-muted-foreground">
                {m.created_at
                  ? f.dateTime(new Date(m.created_at), { dateStyle: "short" })
                  : "—"}
              </td>
              <td className="px-2 py-1.5">
                <button
                  type="button"
                  aria-label={t("details.loeschen")}
                  title={t("details.loeschen")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoeschen(m);
                  }}
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <Icon icon="ph:x" className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {ordner.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            onClick={() => onOeffneOrdner(o)}
            className="group block w-full text-left"
          >
            {/* Die Ordnerform (Lasche oben links) statt eines Symbols in einem
                Quadrat: im Vorbild erkennt man den Ordner an der SILHOUETTE,
                bevor man den Namen liest. */}
            <span className="relative block aspect-square w-full rounded-(--radius) border border-border bg-background transition group-hover:border-foreground/40">
              <span className="absolute left-4 top-4 h-3 w-10 rounded-t-sm bg-secondary" />
              <span className="absolute inset-x-4 bottom-4 top-6 rounded-sm bg-secondary" />
            </span>
            <span className="mt-1 block truncate text-[0.6875rem] italic text-muted-foreground">
              {o.name} ({o.media_count})
            </span>
          </button>
        </li>
      ))}

      {medien.map((m) => {
        const gewaehlt = ausgewaehlt.has(m.id);
        const herkunftIcon = HERKUNFT_ICON[m.source];
        return (
          <li key={m.id} className="group relative">
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                // Mehrfachauswahl zieht ALLE markierten Medien mit, sonst nur
                // dieses eine — der Ordnerbaum liest dieselbe Liste.
                const ids =
                  gewaehlt && ausgewaehlt.size > 0 ? [...ausgewaehlt] : [m.id];
                e.dataTransfer.setData(MEDIEN_DRAG_TYP, JSON.stringify(ids));
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onDetail(m)}
              onDoubleClick={() => (mitVerwenden ? onVerwende(m) : onDetail(m))}
              title={m.filename ?? undefined}
              className={
                "relative block aspect-square w-full overflow-hidden rounded-(--radius) border transition " +
                (gewaehlt
                  ? "border-(--brand) ring-2 ring-(--brand)/40"
                  : aktivesDetail === m.id
                    ? "border-(--brand)"
                    : "border-border hover:border-foreground/40")
              }
            >
              <MedienVorschau medium={m} className="size-full" />
            </button>

            {/* „Auswählen" liegt ÜBER der Kachel und erscheint beim Überfahren.
                Der Doppelklick tut dasselbe, aber niemand findet ihn von
                selbst — im Vorbild ist dieser Knopf der Hauptweg. */}
            {mitVerwenden ? (
              <button
                type="button"
                onClick={() => onVerwende(m)}
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background/95 px-3 py-1 text-xs font-medium opacity-0 shadow-sm transition group-hover:pointer-events-auto group-hover:opacity-100"
              >
                {t("kachel.verwenden")}
              </button>
            ) : null}

            {/* ✕ oben rechts: löschen. Es fragt nach (Löschdialog mit
                Verwendungsnachweis) — ein Löschen ohne Rückfrage direkt an der
                Kachel wäre der eine Klick, der nicht rückholbar ist. */}
            <button
              type="button"
              aria-label={t("details.loeschen")}
              title={t("details.loeschen")}
              onClick={(e) => {
                e.stopPropagation();
                onLoeschen(m);
              }}
              className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground opacity-0 shadow-sm transition hover:text-destructive group-hover:opacity-100"
            >
              <Icon icon="ph:x" className="size-3" />
            </button>

            {/* Mehrfachauswahl: dauerhaft sichtbar, sobald etwas gewählt ist —
                sonst müsste man jede Kachel überfahren, um zu sehen, was
                markiert ist. */}
            <button
              type="button"
              aria-label={t("mehrfachauswahl.umschalten")}
              aria-pressed={gewaehlt}
              onClick={(e) => {
                e.stopPropagation();
                onMehrfachUmschalten(m.id);
              }}
              className={
                "absolute bottom-1.5 left-1.5 flex h-5 items-center gap-1 rounded-full border px-1.5 shadow-sm transition " +
                (gewaehlt
                  ? "border-(--brand) bg-(--brand) text-white"
                  : "border-border bg-background/95 text-muted-foreground opacity-0 group-hover:opacity-100")
              }
            >
              <Icon icon="ph:check-bold" className="size-3" />
            </button>

            {/* Herkunft: Stock-Fotos und Symbole sind Hotlinks ohne Datei bei
                uns — das gehört sichtbar, sonst wundert sich der Kunde, warum
                „Bearbeiten" bei manchen fehlt. */}
            {herkunftIcon ? (
              <span
                title={t(`details.herkunft.${m.source}`)}
                className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm"
              >
                <Icon icon={herkunftIcon} className="size-3" />
              </span>
            ) : null}

            {/* Fehlender Alt-Text: ein stiller SEO-/Barrierefreiheits-Mangel.
                Nur bei Bildern und Symbolen — ein Video oder eine PDF hat
                keinen Alt-Text, und eine Warnung dort wäre ein Mangel, den
                niemand beheben kann. */}
            {!m.alt_text && (m.kind === "image" || m.kind === "icon") ? (
              <span
                title={t("details.altTextFehlt")}
                className="absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-amber-500/90 text-white shadow-sm"
              >
                <Icon icon="ph:warning" className="size-3" />
              </span>
            ) : null}

            <p className="mt-1 truncate text-[0.6875rem] italic text-muted-foreground">
              {m.filename ?? t("liste.ohneNamen")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
