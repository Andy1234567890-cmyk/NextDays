"use client";

// Der untere Teil der rechten Spalte: die MEHRFACHAUSWAHL (Punkt 13):
//
//     Ausgewählte Bilder (2)        Alle abwählen
//     ‹ [▢][▢] ›
//     [ In Ordner verschieben  ▾ ]
//     🗑 Auswahl löschen
//
// WARUM DIE AUSWAHL EINE EIGENE FLÄCHE HAT
// Vorher stand sie als schmales Band über der Kachelwand. Damit war sie an der
// Stelle, an der man arbeitet, im Weg, und was genau ausgewählt ist, sah man
// gar nicht — nur eine Zahl. Ein Karussell mit den Vorschaubildern beantwortet
// die eine Frage, die vor „löschen" zählt: WELCHE fünf sind es.
//
// Löschen fragt nach (Dialog beim Aufrufer). Verschieben nicht: es ist
// umkehrbar — man wählt einfach den anderen Ordner.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import type { MediaOrdner } from "@/lib/site-medien";
import type { Medium } from "@/lib/site-pages";

import { MedienVorschau } from "./medien-vorschau";

export function AuswahlLeiste({
  medien,
  ordner,
  aktivId,
  onDetail,
  onAlleAbwaehlen,
  onVerschieben,
  onLoeschen,
}: {
  /** Die ausgewählten Medien, nicht ihre IDs: das Karussell zeigt Bilder. */
  medien: Medium[];
  ordner: MediaOrdner[];
  aktivId: string | null;
  onDetail: (m: Medium) => void;
  onAlleAbwaehlen: () => void;
  /** `null` = zurück in die Wurzel („kein Ordner"). Ein echter Wert, nicht
   *  „unverändert" — deshalb eigener Eintrag in der Liste. */
  onVerschieben: (folderId: string | null) => void;
  onLoeschen: () => void;
}) {
  const t = useTranslations("website.mediathek");
  const band = useRef<HTMLUListElement>(null);

  function schieben(richtung: -1 | 1) {
    // Um eine Bildbreite plus Abstand — nicht um die ganze Breite: bei drei
    // sichtbaren Kacheln würde ein Seitensprung die mittlere überspringen.
    band.current?.scrollBy({ left: richtung * 76, behavior: "smooth" });
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {t("auswahl.titel", { anzahl: medien.length })}
        </h3>
        <button
          type="button"
          onClick={onAlleAbwaehlen}
          className="text-xs text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
        >
          {t("auswahl.alleAbwaehlen")}
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("auswahl.zurueck")}
          onClick={() => schieben(-1)}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:caret-left" className="size-4" />
        </button>
        <ul
          ref={band}
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth"
        >
          {medien.map((m) => (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onDetail(m)}
                title={m.filename ?? undefined}
                className={
                  "block size-16 overflow-hidden rounded-(--radius) border transition " +
                  (aktivId === m.id
                    ? "border-(--brand) ring-2 ring-(--brand)/40"
                    : "border-border hover:border-foreground/40")
                }
              >
                <MedienVorschau medium={m} className="size-full" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-label={t("auswahl.vor")}
          onClick={() => schieben(1)}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:caret-right" className="size-4" />
        </button>
      </div>

      <select
        // Ein Auswahlfeld, das nach der Handlung wieder auf seinen Hinweis
        // zurückfällt: es ZEIGT keinen Zustand („die Auswahl liegt in Ordner
        // X" gibt es nicht, die Medien können aus verschiedenen kommen), es
        // löst eine Handlung aus.
        value=""
        onChange={(e) => {
          if (e.target.value === "") return;
          onVerschieben(e.target.value === "__wurzel__" ? null : e.target.value);
          e.target.value = "";
        }}
        className="w-full rounded-(--radius) border border-border bg-transparent px-2.5 py-1.5 text-sm"
      >
        <option value="" disabled>
          {t("mehrfachauswahl.verschieben")}
        </option>
        <option value="__wurzel__">{t("ordner.wurzel")}</option>
        {ordner.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onLoeschen}
        className="flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-sm font-medium text-destructive transition hover:bg-destructive/10"
      >
        <Icon icon="ph:trash" className="size-4" />
        {t("auswahl.loeschen")}
      </button>
    </div>
  );
}
