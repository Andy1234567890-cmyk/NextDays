"use client";

// Kontenplan → Nummernkreise: Liste mit Vorschau der nächsten Nummer (aus dem
// bestehenden, nicht-inkrementierenden GET), Bearbeiten von Präfix/Suffix/
// Stellenzahl im Sheet mit Live-Vorschau; der Startwert nur, solange noch keine
// Nummer gezogen wurde (Server: 409). Kein „nächste Nummer ziehen" — GoBD.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { createDefaultSequences, updateNumberSequence } from "@/lib/buchhaltung-kontenplan";
import type { NumberSequence } from "@/lib/buchhaltung-kontenplan-typen";

type Formular = { prefix: string; suffix: string; padding: string; nextNumber: string };

/** `RE-{number:4}/26` → Präfix, Stellen, Suffix (Form von `_kreis_als_bestand`). */
function zerlegen(seq: NumberSequence): Formular {
  const m = /^(.*?)\{number(?::(\d+))?\}(.*)$/.exec(seq.format);
  return {
    prefix: m ? m[1] : seq.prefix,
    padding: m && m[2] ? m[2] : "4",
    suffix: m ? m[3] : "",
    nextNumber: String(seq.nextNumber),
  };
}

function vorschau(f: Formular): string {
  const n = Number(f.nextNumber) || 0;
  const pad = Math.min(10, Math.max(1, Number(f.padding) || 1));
  return `${f.prefix}${String(n).padStart(pad, "0")}${f.suffix}`;
}

const PRAEFIX_OK = /^[A-Za-z0-9._/-]{0,20}$/;

export function NummernkreiseTab({ sequences }: { sequences: NumberSequence[] }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [aktiv, setAktiv] = useState<NumberSequence | null>(null);
  const [form, setForm] = useState<Formular>({ prefix: "", suffix: "", padding: "4", nextNumber: "1" });
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Ein Kreis ohne Zeile (`id: null`) wurde nie gezogen; bei vorhandener Zeile
  // sagt es der Server in der PATCH-Antwort (`gezogen`). In der Liste des
  // Bestands fehlt das Feld — dann gilt: Zeile vorhanden UND nextNumber > 1
  // als Hinweis, verbindlich entscheidet der Server (409).
  function gezogen(seq: NumberSequence): boolean {
    if (seq.gezogen !== undefined) return seq.gezogen;
    return seq.id !== null && seq.nextNumber > (seq.startValue ?? 1);
  }

  function oeffnen(seq: NumberSequence) {
    setFehler(null);
    setForm(zerlegen(seq));
    setAktiv(seq);
  }

  async function speichern() {
    if (!aktiv) return;
    if (!PRAEFIX_OK.test(form.prefix) || !PRAEFIX_OK.test(form.suffix)) {
      setFehler(t("kontenplanPage.prefixInvalid"));
      return;
    }
    const pad = Number(form.padding);
    if (!Number.isInteger(pad) || pad < 1 || pad > 10) {
      setFehler(t("kontenplanPage.paddingInvalid"));
      return;
    }
    const body: { prefix: string; suffix: string; padding: number; nextNumber?: number } = {
      prefix: form.prefix,
      suffix: form.suffix,
      padding: pad,
    };
    if (!gezogen(aktiv) && Number(form.nextNumber) !== aktiv.nextNumber) {
      const start = Number(form.nextNumber);
      if (!Number.isInteger(start) || start < 1) {
        setFehler(t("kontenplanPage.startInvalid"));
        return;
      }
      body.nextNumber = start;
    }
    setBusy(true);
    setFehler(null);
    const res = await updateNumberSequence(aktiv.type, body);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    toast.success(t("kontenplanPage.saved"));
    setAktiv(null);
    router.refresh();
  }

  async function vorgabenAnlegen() {
    setBusy(true);
    const res = await createDefaultSequences();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("kontenplanPage.defaultsCreated", { count: res.data.angelegt.length }));
    router.refresh();
  }

  const fehlende = sequences.filter((s) => s.id === null).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {t("kontenplanPage.sequencesIntro")}
          <InfoHinweis ariaLabel={t("kontenplanPage.sequencesHintAria")} text={t("kontenplanPage.sequencesHint")} />
        </p>
        {fehlende > 0 && (
          <Button variant="outline" className="gap-2" onClick={vorgabenAnlegen} disabled={busy}>
            <Icon icon="ph:list-plus" className="size-4" />
            {t("kontenplanPage.createDefaults", { count: fehlende })}
          </Button>
        )}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnType")}</th>
              <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnFormat")}</th>
              <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnNextNumber")}</th>
              <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnStatus")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("kontenplanPage.columnActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sequences.map((s) => (
              <tr key={s.type} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">{s.type}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{s.format}</td>
                <td className="px-4 py-3 font-mono">{s.nextFormatted}</td>
                <td className="px-4 py-3">
                  {s.id === null ? (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{t("kontenplanPage.seqNotCreated")}</span>
                  ) : gezogen(s) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent">
                      <Icon icon="ph:lock-simple" className="size-3" />
                      {t("kontenplanPage.seqInUse")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
                      {t("kontenplanPage.seqFresh")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => oeffnen(s)} aria-label={t("kontenplanPage.edit")}>
                    <Icon icon="ph:pencil-simple" className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <NummernkreisSheet
        aktiv={aktiv}
        setAktiv={setAktiv}
        form={form}
        setForm={setForm}
        busy={busy}
        fehler={fehler}
        gezogen={gezogen}
        onSpeichern={speichern}
      />
    </div>
  );
}

/** Das Sheet zum Ändern eines Nummernkreises. Der Startwert ist gesperrt,
 *  sobald eine Nummer gezogen wurde (GoBD). */
function NummernkreisSheet({
  aktiv,
  setAktiv,
  form,
  setForm,
  busy,
  fehler,
  gezogen,
  onSpeichern,
}: {
  aktiv: NumberSequence | null;
  setAktiv: (s: NumberSequence | null) => void;
  form: Formular;
  setForm: React.Dispatch<React.SetStateAction<Formular>>;
  busy: boolean;
  fehler: string | null;
  gezogen: (seq: NumberSequence) => boolean;
  onSpeichern: () => void;
}) {
  const t = useTranslations("finance");
  return (
    <Sheet open={aktiv !== null} onOpenChange={(o) => !o && setAktiv(null)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {t("kontenplanPage.editSequence", { type: aktiv?.type ?? "" })}
          </SheetTitle>
          <SheetDescription>{t("kontenplanPage.sequenceSheetDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ns-prefix">{t("kontenplanPage.prefix")}</Label>
              <Input id="ns-prefix" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ns-padding">{t("kontenplanPage.padding")}</Label>
              <Input id="ns-padding" inputMode="numeric" value={form.padding} onChange={(e) => setForm({ ...form, padding: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ns-suffix">{t("kontenplanPage.suffix")}</Label>
              <Input id="ns-suffix" value={form.suffix} onChange={(e) => setForm({ ...form, suffix: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5">
              <Label htmlFor="ns-start">{t("kontenplanPage.startValue")}</Label>
              <InfoHinweis ariaLabel={t("kontenplanPage.startValueHintAria")} text={t("kontenplanPage.startValueHint")} />
            </span>
            <Input
              id="ns-start"
              inputMode="numeric"
              value={form.nextNumber}
              disabled={aktiv ? gezogen(aktiv) : true}
              onChange={(e) => setForm({ ...form, nextNumber: e.target.value })}
            />
            {aktiv && gezogen(aktiv) && (
              <p className="text-xs text-muted-foreground">{t("kontenplanPage.startValueLocked")}</p>
            )}
          </div>
          <div className="rounded-(--radius) border bg-secondary/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("kontenplanPage.preview")}</p>
            <p className="font-mono text-lg">{vorschau(form)}</p>
          </div>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>
        <SheetFooter className="border-t">
          <Button variant="outline" onClick={() => setAktiv(null)}>
            {t("kontenplanPage.cancel")}
          </Button>
          <Button onClick={onSpeichern} disabled={busy}>
            {busy ? t("kontenplanPage.saving") : t("kontenplanPage.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
