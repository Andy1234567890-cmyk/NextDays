"use client";

// Die Rückfrage vor dem Löschen — für EINEN Beitrag und für eine Auswahl.
//
// WARUM ES DIESE DATEI GIBT
// =========================
// Vorher löschte das Zeilenmenü sofort, und die Sammelleiste löschte sofort
// ALLE angehakten Beiträge. Kein Zwischenschritt, keine Rückfrage, kein
// Rückweg: die Undo-Knöpfe der Kopfleiste kennen den Blog nicht, und gelöscht
// ist in `site_pages` gelöscht. Ein Klick neben „Duplizieren" konnte damit
// sechs Beiträge samt Text, Bildern und Adressen entfernen.
//
// Das Vorbild hat denselben Eintrag, aber auch ein projektweites Rückgängig
// (⌘Z). Wir haben das nicht — also braucht die Aktion ihren eigenen Riegel.
//
// WARUM DER TITEL IM TEXT STEHT
// =============================
// „Wirklich löschen?" beantwortet die falsche Frage. Wer aus einer Liste von
// zwanzig Zeilen die falsche erwischt hat, merkt es genau hier — aber nur,
// wenn der Name dasteht. Deshalb nennt die Rückfrage den Beitrag beim Titel,
// bei mehreren die Anzahl.
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";

export function LoeschenBestaetigen({
  /** Der Titel des einen Beitrags — oder `null`, wenn es eine Auswahl ist. */
  titel,
  /** Wie viele Beiträge betroffen sind. Bei 1 steht der Titel im Text. */
  anzahl,
  laeuft,
  onAbbrechen,
  onLoeschen,
}: {
  titel: string | null;
  anzahl: number;
  laeuft?: boolean;
  onAbbrechen: () => void;
  onLoeschen: () => void;
}) {
  const t = useTranslations("website");
  return (
    <Dialog
      open
      onOpenChange={(auf) => {
        if (!auf) onAbbrechen();
      }}
    >
      <DialogContent className="max-w-md gap-4">
        <DialogTitle>{t("blog.loeschenTitel")}</DialogTitle>
        <DialogDescription>
          {anzahl === 1 && titel
            ? t("blog.loeschenFrageEiner", { titel })
            : t("blog.loeschenFrageMehrere", { anzahl })}
        </DialogDescription>
        <p className="text-sm text-muted-foreground">
          {t("blog.loeschenHinweis")}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onAbbrechen} disabled={laeuft}>
            {t("blog.abbrechen")}
          </Button>
          {/* `autoFocus` steht ABSICHTLICH nicht auf dem Löschen-Knopf: eine
              Rückfrage, die man mit der Eingabetaste wegdrückt, ist keine. */}
          <Button
            variant="destructive"
            onClick={onLoeschen}
            disabled={laeuft}
          >
            {t("blog.loeschen")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
