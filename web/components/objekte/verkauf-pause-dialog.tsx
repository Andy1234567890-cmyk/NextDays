"use client";

// Rückfrage und Ergebnis für „bei allen Portalen abschalten" / „zurückholen".
//
// Warum ein Dialog mit Ergebnisliste und nicht nur ein Toast: der Vorgang trifft
// mehrere Portale, und jedes kann einzeln scheitern. Ein „Erfolg"-Toast, während
// Booking.com weiterverkauft, ist genau die Lüge, die dieser Weg verhindern
// soll. Der Betrieb sieht deshalb je Portal, was passiert ist — und beim
// Fehlschlag den Grund im Klartext.
//
// Der Server meldet je Portal nur, was er nach dem Zurücklesen beim Portal
// WIRKLICH vorgefunden hat — ein Erfolg hier bedeutet, dass die Änderung
// angekommen ist, nicht bloß, dass sie gesendet wurde.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import type { ObjektVerkaufErgebnis } from "@/lib/objekt-verkauf";

/** Ein Portal-Ergebnis als Zeile: Symbol, Name, Aussage. */
function PortalZeile({
  eintrag,
}: {
  eintrag: ObjektVerkaufErgebnis["portale"][number];
}) {
  const t = useTranslations("objects.verkaufPause");
  // Drei unterscheidbare Zustände statt eines Freitexts — „übersprungen" ist
  // kein Fehler, aber auch kein Erfolg, und das muss man sehen können.
  const zustand = eintrag.fehler
    ? "fehler"
    : eintrag.uebersprungen
      ? "uebersprungen"
      : "ok";
  const symbol =
    zustand === "fehler"
      ? "ph:warning-circle"
      : zustand === "uebersprungen"
        ? "ph:minus-circle"
        : "ph:check-circle";
  const farbe =
    zustand === "fehler"
      ? "text-destructive"
      : zustand === "uebersprungen"
        ? "text-muted-foreground"
        : "text-foreground";

  return (
    <li className="flex items-start gap-2 py-1.5">
      <Icon icon={symbol} className={`mt-0.5 size-4 shrink-0 ${farbe}`} />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{eintrag.portal}</span>
        <p className={`text-sm ${farbe}`}>
          {eintrag.fehler ??
            eintrag.uebersprungen ??
            (eintrag.wiederhergestellt
              ? t("zeileWiederhergestellt")
              : t("zeileAbgeschaltet"))}
        </p>
        {/* Der Hinweis, der den Vorfall vom 12.08.2026 erklärt hätte: wie viele
            Objekte am Kanal hängen. Nur beim Kanal-Hebel vorhanden. */}
        {eintrag.objekte_am_kanal !== null &&
          eintrag.objekte_am_kanal > 1 && (
            <p className="text-xs text-muted-foreground">
              {t("zeileObjekteAmKanal", { anzahl: eintrag.objekte_am_kanal })}
            </p>
          )}
      </div>
    </li>
  );
}

export function VerkaufPauseDialog({
  open,
  onClose,
  onBestaetigen,
  busy,
  titel,
  richtung,
  ergebnis,
  fehler,
}: {
  open: boolean;
  onClose: () => void;
  onBestaetigen: () => Promise<void>;
  busy: boolean;
  titel: string | null;
  /** `pausieren` = abschalten, `fortsetzen` = zurückholen. */
  richtung: "pausieren" | "fortsetzen";
  /** Erst nach dem Vorgang gesetzt — dann zeigt der Dialog das Ergebnis. */
  ergebnis: ObjektVerkaufErgebnis | null;
  fehler: string | null;
}) {
  const t = useTranslations("objects.verkaufPause");
  const fertig = ergebnis !== null;
  const gescheitert = (ergebnis?.portale ?? []).filter((p) => p.fehler);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>
          {fertig
            ? gescheitert.length > 0
              ? t("ergebnisTeilweiseTitel")
              : t(
                  richtung === "pausieren"
                    ? "ergebnisAusTitel"
                    : "ergebnisAnTitel",
                )
            : t(richtung === "pausieren" ? "fragenAusTitel" : "fragenAnTitel")}
        </DialogTitle>
        <DialogDescription>
          {fertig
            ? gescheitert.length > 0
              ? t("ergebnisTeilweiseText", { anzahl: gescheitert.length })
              : t(
                  richtung === "pausieren"
                    ? "ergebnisAusText"
                    : "ergebnisAnText",
                )
            : t(richtung === "pausieren" ? "fragenAusText" : "fragenAnText", {
                titel: titel ?? "",
              })}
        </DialogDescription>

        {fehler && <p className="text-sm text-destructive">{fehler}</p>}

        {fertig && (
          <ul className="mt-1 divide-y">
            {ergebnis.portale.map((p) => (
              <PortalZeile key={p.portal_code} eintrag={p} />
            ))}
          </ul>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {fertig ? t("schliessen") : t("abbrechen")}
          </Button>
          {!fertig && (
            <Button
              variant={richtung === "pausieren" ? "destructive" : "default"}
              onClick={() => void onBestaetigen()}
              disabled={busy}
            >
              {busy
                ? t("laeuft")
                : t(richtung === "pausieren" ? "jetztAus" : "jetztAn")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
