"use client";

// Löschen einer AUSWAHL — mit derselben Rückfrage wie beim einzelnen Medium,
// nur für viele (Punkt 13 des Vorbilds, „Delete Selected").
//
// WARUM ES DIESEN DIALOG ÜBERHAUPT GIBT
// Verschieben ist umkehrbar, Löschen nicht. Ein Knopf, der zwanzig Medien ohne
// Rückfrage entfernt — samt der Bilder, die auf einer veröffentlichten Seite
// stehen — ist der teuerste Klick der ganzen Oberfläche.
//
// WIE VIEL GEPRÜFT WIRD, UND WARUM DAS DASTEHT
// Die Verwendungsprüfung ist EIN Aufruf JE Medium. Bei 200 markierten Medien
// wären das 200 Abfragen, bevor der Dialog etwas zeigt. Geprüft werden deshalb
// die ersten `PRUEF_GRENZE` — und wenn mehr markiert ist, steht genau das im
// Dialog. Ein stiller Deckel wäre die schlimmere Variante: er sieht aus wie
// „alles geprüft, nichts gefunden".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { mediumVerwendung } from "@/lib/site-medien";
import type { Medium } from "@/lib/site-pages";

import { MedienVorschau } from "./medien-vorschau";

/** Wie viele Medien vor dem Löschen auf Verwendung geprüft werden. */
const PRUEF_GRENZE = 20;

export function MassenLoeschenDialog({
  medien,
  onAbbrechen,
  onBestaetigen,
}: {
  medien: Medium[];
  onAbbrechen: () => void;
  onBestaetigen: () => void;
}) {
  const t = useTranslations("website.mediathek");
  const [verwendet, setVerwendet] = useState<number | null | "fehler">(null);

  useEffect(() => {
    let lebt = true;
    const zuPruefen = medien.slice(0, PRUEF_GRENZE);
    void Promise.all(zuPruefen.map((m) => mediumVerwendung(m.id))).then(
      (ergebnisse) => {
        if (!lebt) return;
        // Ein einziger fehlgeschlagener Aufruf macht die ganze Aussage
        // unbrauchbar: „3 von 20 sind in Verwendung" wäre falsch, wenn zwei
        // Antworten fehlen. Dann sagt der Dialog, dass er es nicht weiß
        // (fail-closed in der AUSSAGE, Wurzel 5).
        if (ergebnisse.some((r) => !r.ok)) {
          setVerwendet("fehler");
          return;
        }
        setVerwendet(
          ergebnisse.filter((r) => r.ok && r.data.items.length > 0).length,
        );
      },
    );
    return () => {
      lebt = false;
    };
    // `medien` ist beim Öffnen fest — die Auswahl kann sich hinter einem
    // offenen Dialog nicht ändern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ungeprueft = Math.max(0, medien.length - PRUEF_GRENZE);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("auswahl.loeschDialogTitel")}
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4"
      onClick={onAbbrechen}
    >
      <div
        className="w-full max-w-md rounded-(--radius) border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-extrabold">
          {t("auswahl.loeschDialogTitel")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("auswahl.loeschDialogText", { anzahl: medien.length })}
        </p>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {medien.slice(0, 12).map((m) => (
            <li
              key={m.id}
              className="size-12 overflow-hidden rounded-(--radius) border border-border"
            >
              <MedienVorschau medium={m} className="size-full" />
            </li>
          ))}
          {medien.length > 12 ? (
            <li className="flex size-12 items-center justify-center rounded-(--radius) border border-border text-xs text-muted-foreground">
              +{medien.length - 12}
            </li>
          ) : null}
        </ul>

        <div className="mt-4 text-sm">
          {verwendet === null ? (
            <p className="text-muted-foreground">{t("ordner.laedt")}</p>
          ) : verwendet === "fehler" ? (
            <p className="text-muted-foreground">
              {t("loeschDialog.pruefungFehlgeschlagen")}
            </p>
          ) : verwendet > 0 ? (
            <p className="flex items-start gap-1.5 rounded-(--radius) border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 font-medium text-amber-700 dark:text-amber-400">
              <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0" />
              {t("auswahl.loeschWarnung", { anzahl: verwendet })}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {t("loeschDialog.unverwendet")}
            </p>
          )}
          {ungeprueft > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("auswahl.ungeprueft", {
                geprueft: PRUEF_GRENZE,
                rest: ungeprueft,
              })}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onAbbrechen}
            className="rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:bg-secondary"
          >
            {t("ordner.abbrechen")}
          </button>
          <button
            type="button"
            onClick={onBestaetigen}
            className="rounded-full bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
          >
            {t("auswahl.loeschBestaetigen", { anzahl: medien.length })}
          </button>
        </div>
      </div>
    </div>
  );
}
