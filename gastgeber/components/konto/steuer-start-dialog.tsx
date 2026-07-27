"use client";

// Schritt 0 des Steuer-Flows: das kleine Popup, das nach dem STEUERREGIME
// fragt (Airbnb-Vorbild „Add tax info").
//
// Warum nicht direkt ein Länder-Dropdown: Die drei Gruppen sind keine
// Geschmacksfrage, sondern drei getrennte Rechtswelten mit unterschiedlichen
// Formularen, Feldern und Geldfolgen. Recherche-belegt (Airbnb Art. 3633):
//
//   USA                  -> IRS, W-9/W-8, 1099-K/1042-S
//   MX/IN                -> nationale Sonderwege, lokale ID mit Geldwirkung
//   alle übrigen Länder  -> OECD/DAC7: EIN Datensatz für ~35 Staaten
//
// Der dritte Punkt ist KEIN Sammelrestposten: EU-27, UK, Kanada, Neuseeland,
// Kolumbien, Norwegen, Island und Costa Rica haben dieselben OECD Model Rules
// umgesetzt — ein Feldkatalog, ein Meldeweg.
//
// Nach der Auswahl geht es in den VOLLBILD-Wizard (/konto/steuern/neu), nicht
// weiter im Dialog: die Felderfassung braucht Platz, und der Nutzer soll sehen,
// dass er einen mehrstufigen Vorgang begonnen hat.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Dialog, DialogClose, DialogContent } from "@nextdays/ui/dialog";

/** Die drei Einstiegs-Gruppen. `pfad` ist der Query-Wert für den Wizard. */
const GRUPPEN = [
  {
    wert: "us",
    titel: "Vereinigte Staaten",
    text: "Für Steuerangaben gegenüber der US-Steuerbehörde (IRS).",
  },
  {
    wert: "national",
    titel: "Mexiko oder Indien",
    text: "Diese Länder verlangen eine lokale Steuernummer. Fehlt sie, wird von deinen Auszahlungen mehr einbehalten.",
  },
  {
    wert: "global",
    titel: "Anderes Land oder andere Region",
    text: "Für die EU, das Vereinigte Königreich, Kanada, Neuseeland und weitere Länder mit gemeinsamem Meldestandard.",
  },
] as const;

export function SteuerStartDialog({
  offen,
  onClose,
}: {
  offen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [gruppe, setGruppe] = useState<string>("");

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[34rem] rounded-3xl p-0" showCloseButton={false}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-4">
          <DialogClose
            aria-label="Schließen"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </DialogClose>
          <h3 className="font-display text-base font-bold">
            Steuerinformationen hinzufügen
          </h3>
          <span className="size-7" />
        </div>

        <div className="px-6 py-6">
          <p className="text-[0.9375rem]">
            Wähle zuerst das Land oder die Region, für die du deine
            Steuerinformationen hinterlegst.
          </p>

          <div className="mt-6 flex flex-col">
            {GRUPPEN.map((g) => (
              <label
                key={g.wert}
                className="flex cursor-pointer items-start gap-4 border-b border-border py-5 last:border-b-0"
              >
                <input
                  type="radio"
                  name="steuergruppe"
                  value={g.wert}
                  checked={gruppe === g.wert}
                  onChange={() => setGruppe(g.wert)}
                  className="mt-0.5 size-5 shrink-0 accent-foreground"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-[0.9375rem] font-medium">{g.titel}</span>
                  <span className="text-sm text-muted-foreground">{g.text}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium underline underline-offset-4"
          >
            Abbrechen
          </button>
          <Button
            disabled={!gruppe}
            onClick={() => router.push(`/konto/steuern/neu?gruppe=${gruppe}`)}
          >
            Weiter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
