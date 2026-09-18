"use client";

// Sperrzeitraum anlegen — Objekt, Zeitraum und Beschriftung in EINEM Dialog.
//
// WARUM ES DIESEN DIALOG GIBT (18.09.2026): Der Menüpunkt „Sperrzeitraum
// anlegen" im Kalenderkopf war nie verdrahtet — `onCreate` hatte nur einen
// Zweig für „booking", der Eintrag war anklickbar und tat nichts. Der zweite
// Anlauf legte stattdessen eine Vorauswahl im Raster an und öffnete das
// Aktionsmenü; das funktionierte, verlangte dem Nutzer aber ab, Objekt und Tage
// im Gitter nachzujustieren, statt sie zu benennen. Gewünscht war das
// Naheliegende: ein Fenster, in dem man beides auswählt und die Sperre
// beschriftet.
//
// Die Beschriftung ist der eigentliche Zugewinn. `availability.label` gibt es
// seit Langem in der Datenbank und war in 25.013 Zeilen NULL — niemand schrieb
// je hinein. Ohne sie sehen alle Sperren gleich aus, und nach zwei Wochen weiß
// niemand mehr, warum eine Woche im Mai zu ist.
//
// KEIN zweiter Sperr-Pfad: geschrieben wird über `blockRange`, denselben Aufruf
// wie das Aktionsmenü nach dem Ziehen. Der Gegenzustand (Kalender, Quellen,
// Rückgabe an die Portale) hängt serverseitig an EINER Stelle; ein eigener
// Schreibweg hier liefe beim ersten Zusatz auseinander (Wurzel 1).
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { blockRange } from "@/lib/calendar";
import { isoPlus } from "@/lib/dates";

/** Obergrenze der Beschriftung — dieselbe wie im Pydantic-Schema des Servers
 *  (`BlockRequest.label`, max_length=80). Sie steht hier NUR, damit der Nutzer
 *  vor dem Absenden gebremst wird; erzwungen wird sie serverseitig. Eine
 *  Prüfung allein im Browser wäre keine (Wurzel 3). */
const LABEL_MAX = 80;

/**
 * Eine rote Hinweiszeile im Dialog.
 *
 * EINE Komponente für beide Fälle — die Vorwarnung aus der bekannten Belegung
 * und die Antwort des Servers. Zwei gleich aussehende Kästen mit eigenem
 * Markup liefen beim ersten Stiländerung auseinander, und `role="alert"` an nur
 * einem von beiden hiesse: der andere wird nicht vorgelesen.
 */
function Hinweis({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="rounded-(--radius) border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {text}
    </p>
  );
}

export function SperrzeitraumDialog({
  properties,
  initialPropertyId,
  initialStart,
  initialEnd,
  belegteNaechte,
  onClose,
  onSaved,
}: {
  properties: { id: string; title: string }[];
  initialPropertyId: string;
  /** Erste gesperrte Nacht (YYYY-MM-DD). */
  initialStart: string;
  /** Letzte gesperrte Nacht, INKLUSIV — so, wie der Nutzer es liest. Die
   *  API bekommt daraus das exklusive Ende (`bis + 1 Tag`). */
  initialEnd: string;
  /** Welche Nächte im Zeitraum bereits GEBUCHT sind (ISO-Tage, aufsteigend).
   *
   *  Der Server weist eine Sperre über gebuchte Tage mit 409 ab — das ist die
   *  eigentliche Absicherung und bleibt es (Wurzel 3: eine Prüfung allein im
   *  Browser ist keine). Diese Funktion ist NUR die Vorwarnung: das Board kennt
   *  die Belegung bereits, und dem Nutzer erst nach dem Klick zu sagen, dass
   *  sein Zeitraum nicht geht, ist eine vermeidbare Sackgasse. */
  belegteNaechte: (pid: string, von: string, bisInklusiv: string) => string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("calendar");
  const [pid, setPid] = useState(initialPropertyId);
  const [von, setVon] = useState(initialStart);
  const [bis, setBis] = useState(initialEnd);
  const [label, setLabel] = useState("");
  const [speichert, setSpeichert] = useState(false);
  // Die Servermeldung steht IM Dialog, nicht in einem Toast: sie sagt, was am
  // Zeitraum nicht geht, und der Zeitraum steht hier. Ein Toast wäre weg,
  // bevor der Nutzer das Datum korrigiert hat.
  const [fehler, setFehler] = useState<string | null>(null);

  // Das Bis-Datum zieht mit, wenn Von darüber hinauswandert. Ohne das lässt
  // sich ein leerer Zeitraum einstellen, den der Server dann mit 422 abweist —
  // ein Fehler, den die Oberfläche selbst verhindern kann, gehört nicht zum
  // Server geschickt.
  useEffect(() => {
    if (bis < von) setBis(von);
  }, [von, bis]);

  // Vorwarnung, sobald Objekt oder Zeitraum stehen — nicht erst beim Speichern.
  const belegt = bis >= von ? belegteNaechte(pid, von, bis) : [];

  const naechte = Math.max(
    0,
    Math.round(
      (Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000,
    ) + 1,
  );

  async function speichern() {
    if (speichert) return;
    setFehler(null);
    setSpeichert(true);
    // Das Ende der API ist EXKLUSIV, die Eingabe oben inklusiv: Wer „1.–3."
    // wählt, sperrt die Nächte 1., 2. und 3. und gibt das Objekt am 4. wieder
    // frei. Ohne diese Umrechnung fehlte die letzte Nacht — ein Fehler, den
    // niemand bemerkt, bis am letzten Tag jemand bucht.
    const res = await blockRange(pid, von, isoPlus(bis, 1), label.trim() || undefined);
    setSpeichert(false);
    if (!res.ok) {
      // Der Servertext wird GEZEIGT, nicht durch einen eigenen ersetzt: er
      // nennt den Grund („Zeitraum enthält bereits gebuchte Tage"), und genau
      // der entscheidet, was der Nutzer als Nächstes tut. Der Dialog bleibt
      // dabei OFFEN — die Eingaben sind noch da und müssen nur korrigiert
      // werden.
      setFehler(res.error);
      return;
    }
    toast.success(t("blockDialog.saved", { count: res.data.blocked_days }));
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(offen) => !offen && onClose()}>
      <DialogContent className="max-w-md gap-4">
        <div className="flex flex-col gap-1">
          <DialogTitle className="pr-8 text-base font-semibold">
            {t("calendarActionMenu.createBlockedPeriod")}
          </DialogTitle>
          <DialogDescription>
            {t("calendarActionMenu.createBlockedPeriodHint")}
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sperr-objekt">{t("blockDialog.property")}</Label>
            <NativeSelect
              id="sperr-objekt"
              value={pid}
              onChange={(e) => setPid(e.target.value)}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sperr-von">{t("blockDialog.from")}</Label>
              <Input
                id="sperr-von"
                type="date"
                value={von}
                onChange={(e) => setVon(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sperr-bis">{t("blockDialog.to")}</Label>
              <Input
                id="sperr-bis"
                type="date"
                value={bis}
                min={von}
                onChange={(e) => setBis(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sperr-label">{t("blockDialog.label")}</Label>
            <Input
              id="sperr-label"
              value={label}
              maxLength={LABEL_MAX}
              placeholder={t("blockDialog.labelPlaceholder")}
              onChange={(e) => setLabel(e.target.value)}
            />
            {/* Optional, und das steht auch da: eine Sperre ohne Beschriftung
                ist gültig, sie heißt dann im Balken nur „Gesperrt". */}
            <p className="text-xs text-muted-foreground">
              {t("blockDialog.labelHint")}
            </p>
          </div>

          {/* Die Nächtezahl macht die inklusive Lesart überprüfbar: wer 1.–3.
              wählt, soll „3 Nächte" sehen und nicht selbst nachrechnen, ob der
              letzte Tag mitzählt. */}
          <p className="text-sm text-muted-foreground">
            {t("blockDialog.nights", { count: naechte })}
          </p>

          {/* GEBUCHTE NÄCHTE im gewählten Zeitraum. Eine Sperre darf sie nicht
              überschreiben — der Server weist das mit 409 ab, und das ist die
              eigentliche Absicherung. Der Hinweis hier kommt aber, WÄHREND der
              Nutzer wählt, statt ihn erst nach dem Klick in eine Sackgasse
              laufen zu lassen.
              Die Tage werden AUFGEZÄHLT, nicht nur gezählt: „3 Nächte belegt"
              zwingt zum Suchen, „19.09., 20.09., 21.09." zeigt sofort, wo der
              Zeitraum zu kürzen ist. */}
          {belegt.length > 0 && (
            <Hinweis
              text={t("blockDialog.bookedConflict", {
                count: belegt.length,
                days: belegt
                  .map((d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`)
                  .join(", "),
              })}
            />
          )}

          {/* Die Antwort des Servers — etwa ein Konflikt, den die Vorwarnung
              oben nicht sehen konnte, weil jemand anderes in der Zwischenzeit
              gebucht hat. */}
          {fehler && <Hinweis text={fehler} />}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={speichert}>
            {t("blockDialog.cancel")}
          </Button>
          {/* Gesperrt, solange eine gebuchte Nacht im Zeitraum liegt: der
              Aufruf könnte nur mit 409 enden, und ein Knopf, der sicher
              fehlschlägt, gehört nicht anklickbar. */}
          <Button
            onClick={() => void speichern()}
            disabled={speichert || naechte < 1 || belegt.length > 0}
          >
            {speichert
              ? t("calendarActionMenu.blocking")
              : t("calendarActionMenu.createBlockedPeriod")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
