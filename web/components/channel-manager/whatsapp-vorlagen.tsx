"use client";

// Nachrichtenvorlagen des Betriebs (/channels/whatsapp).
//
// Warum es diese Ansicht braucht: Ausserhalb des 24-Stunden-Fensters laesst
// Meta nur geprüfte Vorlagen zu. Ohne sie kann der Betrieb eine
// Buchungsbestaetigung nicht verschicken — und ohne diese Seite saehe er weder,
// welche Vorlagen seine WABA hat, noch was Meta damit gemacht hat. Der Rollout
// lief bisher nur automatisch beim Verbinden; hier ist der Weg, ihn
// nachzuziehen, wenn der Satz waechst oder Meta eine Vorlage abgelehnt hat.
//
// Die Vorlagen gehoeren der WABA DES BETRIEBS, nicht uns: der Server holt sie
// mit dem Token dieses Betriebs (whatsapp_account). Quelle des Pruefstatus ist
// immer Meta — wir spiegeln ihn nicht, sonst zeigt die Seite APPROVED, waehrend
// Meta laengst abgelehnt hat.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  listWhatsAppTemplates,
  rolloutWhatsAppTemplates,
  type WhatsAppTemplate,
} from "@/lib/whatsapp-api";

/** Metas Status in Farbe. Unbekannte Werte bleiben neutral, statt eine falsche
 *  Zusicherung zu faerben (Meta fuehrt mehr Zustaende, als wir hier kennen). */
function statusFarbe(status: string): string {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "bg-emerald-500/10 text-emerald-700";
    case "PENDING":
    case "PENDING_DELETION":
      return "bg-amber-500/10 text-amber-700";
    case "REJECTED":
    case "DISABLED":
    case "PAUSED":
      return "bg-red-500/10 text-red-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function WhatsAppVorlagen() {
  const [items, setItems] = useState<WhatsAppTemplate[] | null>(null);
  // null = noch nicht geladen, "" = geladen und in Ordnung. Ein Fehler wird
  // angezeigt statt eine leere Liste vorzutaeuschen: "keine Vorlagen" und
  // "Abruf fehlgeschlagen" sind zwei verschiedene Aussagen.
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const laden = useCallback(async () => {
    const res = await listWhatsAppTemplates();
    if (res.ok) {
      setItems(res.data.items);
      setFehler("");
    } else {
      setItems([]);
      setFehler(res.error);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function ausrollen() {
    setLaeuft(true);
    const res = await rolloutWhatsAppTemplates();
    if (res.ok) {
      const { angelegt, uebersprungen, fehler: abgelehnt } = res.data;
      toast.success(
        `${angelegt.length} zur Pruefung eingereicht, ${uebersprungen.length} waren vorhanden.`,
      );
      // Ablehnungen einzeln zeigen: sie verschwinden sonst spurlos, und spaeter
      // fehlt eine Vorlage ohne ersichtlichen Grund.
      for (const zeile of abgelehnt) toast.error(zeile);
      await laden();
    } else {
      toast.error(res.error);
    }
    setLaeuft(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-base font-extrabold">
            Nachrichtenvorlagen
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ausserhalb des 24-Stunden-Fensters laesst WhatsApp nur von Meta
            geprüfte Vorlagen zu. Diese hier liegen in der WhatsApp-Kennung des
            Betriebs; den Pruefstatus vergibt Meta.
          </p>
        </div>
        <Button onClick={() => void ausrollen()} disabled={laeuft}>
          {laeuft ? (
            <Icon icon="svg-spinners:180-ring" className="size-4" />
          ) : (
            <Icon icon="ph:plus" className="size-4" />
          )}
          Vorlagen anlegen
        </Button>
      </div>

      {fehler ? (
        <p className="mt-4 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          {fehler}
        </p>
      ) : items === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Wird geladen …</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Noch keine Vorlagen. „Vorlagen anlegen" reicht den myNextDays-Satz bei
          Meta zur Pruefung ein — Buchungsbestaetigung, Anreiseinfos,
          Zahlungserinnerung, Stornierung und Zahlungseingang, je auf Deutsch und
          Englisch.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
          {items.map((v) => (
            <li
              key={`${v.name}-${v.language}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-semibold">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {v.language} · {v.category}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusFarbe(
                  v.status,
                )}`}
              >
                {v.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
