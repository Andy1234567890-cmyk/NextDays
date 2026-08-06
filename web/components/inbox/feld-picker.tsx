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
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { type FieldEntry, listFields } from "@/lib/inbox";

const GRUPPEN = ["guest", "reservation", "property", "company"] as const;

export function FeldPicker({
  onInsert,
}: {
  /** Bekommt den fertigen Platzhalter inkl. Klammern, z. B. "{{guest_name}}". */
  onInsert: (platzhalter: string) => void;
}) {
  const t = useTranslations("inbox");
  const [felder, setFelder] = useState<FieldEntry[]>([]);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    void listFields().then((r) => setFelder(r.ok ? r.data.items : []));
  }, []);

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
        </div>
      )}
    </div>
  );
}
