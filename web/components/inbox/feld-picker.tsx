"use client";

// Platzhalter-Auswahl für Vorlagen und Automationen.
//
// Ohne Picker müsste man die Schlüssel auswendig wissen — und ein `{{guest_nmae}}`
// fiele erst beim Speichern auf (der Server weist es mit 422 ab). Die Liste kommt
// vom Server, damit Katalog und Oberfläche nicht auseinanderlaufen.
//
// Eingefügt wird an der Cursorposition, nicht am Ende: Platzhalter stehen fast
// immer mitten im Satz („Hallo {{guest_first_name}},"). Wohin genau, entscheidet
// der Aufrufer über `onInsert` — bei allen dreien ist das der `ComposerGriff`
// des Rich-Text-Editors.
//
// ZWEI FORMEN, EIN KATALOG:
//   `FeldDialogKnopf` — der Knopf IN der Werkzeugleiste, der einen Dialog mit
//     allen Platzhaltern öffnet (die Form, die Lodgify gefunden hat: dort heißt
//     er `{{Nachrichtenplatzhalter}}`). Das ist die Standardform, weil der Knopf
//     dort sitzt, wo man ihn beim Schreiben braucht.
//   `FeldPicker` — die frühere Aufklappliste UNTER dem Feld. Sie bleibt für
//     Stellen ohne Werkzeugleiste; sie zeigt denselben Katalog.
//
// Warum ein Dialog und keine lange Liste unter dem Feld: 64 Platzhalter drücken
// das Formular so weit auseinander, dass Speichern aus dem Bild rutscht — und
// beim Klick verliert das Textfeld den Cursor nicht, weil der Dialog ihn beim
// Schließen zurückgibt (`einfuegen` fokussiert den Editor selbst).
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@nextdays/ui/dialog";
import { type FieldEntry, listFields } from "@/lib/inbox";

const GRUPPEN = ["guest", "reservation", "property", "company"] as const;

/** Lädt den Katalog EINMAL je Einsatzstelle. */
function useFelder(): FieldEntry[] {
  const [felder, setFelder] = useState<FieldEntry[]>([]);
  useEffect(() => {
    void listFields().then((r) => setFelder(r.ok ? r.data.items : []));
  }, []);
  return felder;
}

/** Die Chips, nach Gruppe geordnet — in beiden Formen dieselbe Darstellung. */
function FeldGruppen({
  felder,
  onInsert,
}: {
  felder: FieldEntry[];
  onInsert: (platzhalter: string) => void;
}) {
  const t = useTranslations("inbox");
  return (
    <>
      {GRUPPEN.map((gruppe) => {
        const dieser = felder.filter((f) => f.group === gruppe);
        if (dieser.length === 0) return null;
        return (
          <div key={gruppe} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`fieldGroup_${gruppe}` as never)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {dieser.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => onInsert(`{{${f.key}}}`)}
                  title={`{{${f.key}}}`}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
                >
                  {t(`field_${f.key}` as never)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Knopf für die Werkzeugleiste des Editors: öffnet den Platzhalter-Dialog. */
export function FeldDialogKnopf({
  onInsert,
}: {
  onInsert: (platzhalter: string) => void;
}) {
  const t = useTranslations("inbox");
  const felder = useFelder();
  const [offen, setOffen] = useState(false);

  if (felder.length === 0) return null;

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={t("fieldsTitle")}
          className="flex items-center gap-1 rounded-full px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:brackets-curly" className="size-4" />
          {t("fieldsButton")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>{t("fieldsTitle")}</DialogTitle>
        <DialogDescription>{t("fieldsHint")}</DialogDescription>
        <div className="flex flex-col gap-3">
          <FeldGruppen
            felder={felder}
            onInsert={(p) => {
              onInsert(p);
              // Schließen nach dem Einfügen: wer zwei Platzhalter braucht,
              // öffnet zweimal. Offen zu bleiben verdeckte genau die Stelle,
              // an der man das Ergebnis sehen will.
              setOffen(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Aufklappliste unter dem Feld — für Stellen ohne Werkzeugleiste. */
export function FeldPicker({
  onInsert,
}: {
  /** Bekommt den fertigen Platzhalter inkl. Klammern, z. B. "{{guest_name}}". */
  onInsert: (platzhalter: string) => void;
}) {
  const t = useTranslations("inbox");
  const felder = useFelder();
  const [offen, setOffen] = useState(false);

  if (felder.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-accent hover:underline"
      >
        <Icon icon={offen ? "ph:caret-down" : "ph:caret-right"} className="size-4" />
        {t("fieldsTitle")}
      </button>
      {offen && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{t("fieldsHint")}</p>
          <FeldGruppen felder={felder} onInsert={onInsert} />
        </div>
      )}
    </div>
  );
}
