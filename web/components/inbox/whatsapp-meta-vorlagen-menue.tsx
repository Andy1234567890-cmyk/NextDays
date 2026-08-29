"use client";

// „WhatsApp-Vorlage senden" im Schreibfeld.
//
// Der Unterschied zum Vorlagen-Knopf daneben ist keiner der Bequemlichkeit,
// sondern einer der Regeln:
//
//   * Ein eigener Textbaustein wird in das Feld EINGEFÜGT und als freie
//     Nachricht verschickt. Das lässt Meta nur innerhalb des
//     24-Stunden-Fensters zu, also solange der Gast zuletzt geschrieben hat.
//   * Eine von Meta geprüfte Vorlage wird nicht eingefügt, sondern DIREKT
//     gesendet — sie ist der einzige Weg, wenn das Fenster zu ist. Würde man
//     ihren Text ins Feld kopieren, wäre es wieder eine freie Nachricht und
//     Meta lehnte sie ab.
//
// Deshalb sendet dieser Knopf sofort und füllt nichts ins Feld. Die Werte der
// Platzhalter setzt der Server aus der Reservierung des Chats; die Oberfläche
// wählt nur aus. Ohne verknüpfte Reservierung meldet er, welche Angaben fehlen
// — statt eine Vorlage mit leerer Anrede zu verschicken.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@nextdays/ui/dialog";
import {
  type WhatsAppTemplate,
  listWhatsAppTemplates,
} from "@/lib/whatsapp-api";

/** Nur Freigegebene lassen sich senden — alles andere weist Meta ab. */
function istSendbar(tpl: WhatsAppTemplate): boolean {
  return tpl.status.toUpperCase() === "APPROVED";
}

function textVon(tpl: WhatsAppTemplate): string {
  return (
    tpl.components?.find((c) => c.type?.toUpperCase() === "BODY")?.text ?? ""
  );
}

export function WhatsAppMetaVorlagenMenue({
  onSenden,
  laeuft,
}: {
  onSenden: (name: string, sprache: string) => void;
  laeuft: boolean;
}) {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<WhatsAppTemplate[]>([]);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    void listWhatsAppTemplates().then((r) =>
      setItems(r.ok ? r.data.items.filter(istSendbar) : []),
    );
  }, []);

  if (items.length === 0) return null;

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={t("tabWhatsAppTemplates")}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:whatsapp-logo" className="size-4" />
          {t("tabWhatsAppTemplates")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[70vh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>{t("tabWhatsAppTemplates")}</DialogTitle>
        <DialogDescription>{t("waSendTemplateHint")}</DialogDescription>
        <ul className="flex flex-col gap-2">
          {items.map((tpl) => (
            <li
              key={tpl.id}
              className="flex items-start gap-3 rounded-2xl border border-border p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{tpl.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {tpl.language.toUpperCase()}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {textVon(tpl)}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={laeuft}
                onClick={() => {
                  onSenden(tpl.name, tpl.language);
                  setOffen(false);
                }}
              >
                {t("waSendTemplate")}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
