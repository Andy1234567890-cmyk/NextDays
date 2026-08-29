"use client";

// Vorlagen-Menü im WhatsApp-Schreibfeld.
//
// Es zeigt die EIGENEN Textbausteine des Betriebs (Reiter „Vorlagen"), nicht
// Metas geprüfte Vorlagen. Der Unterschied ist beim Senden entscheidend:
//
//   * Ein Textbaustein ist gewöhnlicher Text. Er darf nur INNERHALB des
//     24-Stunden-Fensters raus — also solange der Gast zuletzt geschrieben hat.
//   * Metas Vorlagen sind das, was ausserhalb des Fensters erlaubt ist. Sie
//     werden nicht in dieses Feld eingefügt, sondern als Vorlage verschickt
//     (eigener Weg, `send-template`) — ein eingefügter Vorlagentext wäre eine
//     freie Nachricht und würde von Meta abgelehnt.
//
// Deshalb steht hier nur das eine, und der Knopf heisst wie im Posteingang.
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
import { type MessageTemplate, listTemplates } from "@/lib/inbox";

export function WhatsAppVorlagenMenue({
  onEinfuegen,
}: {
  onEinfuegen: (text: string) => void;
}) {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    void listTemplates().then((r) => setItems(r.ok ? r.data.items : []));
  }, []);

  if (items.length === 0) return null;

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={t("tabTemplates")}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:note" className="size-4" />
          {t("tabTemplates")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[70vh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>{t("tabTemplates")}</DialogTitle>
        <DialogDescription>{t("waTemplatePickHint")}</DialogDescription>
        <ul className="flex flex-col gap-2">
          {items.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-1 rounded-2xl border border-border p-3 text-left transition-shadow hover:shadow-md"
                onClick={() => {
                  // Der Klartext, nicht `body_html`: WhatsApp überträgt Markup
                  // wörtlich, der Gast läse sonst die Tags mit.
                  onEinfuegen(tpl.body);
                  setOffen(false);
                }}
              >
                <span className="font-medium">{tpl.title}</span>
                <span className="line-clamp-2 text-sm text-muted-foreground">
                  {tpl.body}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
