"use client";

// Verwalten-Tab: Sammelseite der Nachrichten-Funktionen (Vorlagen, KI-Antworten,
// Automatisierungen) plus der Einstieg zum WhatsApp-Kanal.
//
// Die drei ersten Karten schalten auf den jeweiligen Tab um — vorher waren es
// tote Kacheln, die nur beschrieben, was woanders zu finden ist.
//
// Die WhatsApp-Karte führt bewusst aus dem Posteingang heraus in den Channel
// Manager (/channels/whatsapp): dort wohnt die Kanal-Verbindung, hier ist nur
// der zweite Einstieg. Wer WhatsApp im Posteingang vermisst, sucht ihn hier und
// nicht unter Vertrieb (Muster: Hostaway, Inbox → Settings → Channels).
import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

type ConfigTab =
  | "tabAiReplies"
  | "tabKnowledge"
  | "tabTemplates"
  | "tabWhatsAppTemplates"
  | "tabAutomations";

const KACHEL =
  "flex flex-col gap-2 rounded-2xl border border-border p-4 text-left " +
  "transition-shadow hover:shadow-md focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring";

export function ManageTab({ onOpenTab }: { onOpenTab: (tab: ConfigTab) => void }) {
  const t = useTranslations("inbox");
  const cards = [
    { icon: "ph:note", key: "tabTemplates", desc: "manageTemplatesDesc" },
    { icon: "ph:sparkle", key: "tabAiReplies", desc: "manageAiDesc" },
    { icon: "ph:lightning", key: "tabAutomations", desc: "manageAutoDesc" },
    { icon: "ph:brain", key: "tabKnowledge", desc: "manageKnowledgeDesc" },
    // Getrennt von "Vorlagen": das hier sind Metas geprüfte Vorlagen, nicht die
    // eigenen Textbausteine. Wer sie zusammenwirft, wundert sich spaeter, warum
    // ein selbst geschriebener Text ausserhalb des 24-Stunden-Fensters nicht
    // rausgeht.
    {
      icon: "ph:whatsapp-logo",
      key: "tabWhatsAppTemplates",
      desc: "manageWhatsAppTemplatesDesc",
    },
  ] as const;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <h2 className="mb-4 font-display text-lg font-extrabold">{t("tabManage")}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className={KACHEL}
            onClick={() => onOpenTab(c.key)}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-accent">
              <Icon icon={c.icon} className="size-5" />
            </span>
            <span className="font-semibold">{t(c.key)}</span>
            <span className="text-sm text-muted-foreground">{t(c.desc)}</span>
          </button>
        ))}
        <Link href="/channels/whatsapp" className={KACHEL}>
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
            {/* Echtes Markenzeichen statt eines nachgezeichneten Symbols.
                SVG: der Bild-Optimierer lehnt es ab (HTTP 400). */}
            <Image
              unoptimized
              src="/channels/whatsapp-mark.svg"
              alt=""
              width={20}
              height={20}
              className="size-5"
            />
          </span>
          <span className="font-semibold">{t("tabWhatsApp")}</span>
          <span className="text-sm text-muted-foreground">
            {t("manageWhatsAppDesc")}
          </span>
        </Link>
      </div>
    </div>
  );
}
