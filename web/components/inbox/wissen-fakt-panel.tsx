"use client";

// Fakt anlegen und bearbeiten — als Seitenpanel, nicht als Inline-Block.
//
// Der Unterschied ist nicht kosmetisch: ein Inline-Formular unter der Liste
// verschiebt beim Öffnen alle Zeilen, und beim Bearbeiten der zwanzigsten Zeile
// steht das Formular ausserhalb des Sichtfelds. Das Panel bleibt an derselben
// Stelle, egal welche Zeile man anklickt.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import {
  type KnowledgeFact,
  createKnowledge,
  updateKnowledge,
} from "@/lib/inbox";
import {
  WISSEN_KATEGORIEN,
  type WissenKategorie,
} from "@/lib/inbox-wissen-typen";

const MAX_TITEL = 200;
const MAX_TEXT = 2000;

export function WissenFaktPanel({
  fakt,
  objektId,
  onSchliessen,
  onGespeichert,
}: {
  fakt: KnowledgeFact | null;
  /** Das Objekt, in dessen Liste wir stehen. `null` = betriebsweite Ebene. */
  objektId: string | null;
  onSchliessen: () => void;
  onGespeichert: () => void;
}) {
  const t = useTranslations("inbox");
  const [titel, setTitel] = useState(fakt?.titel ?? "");
  const [text, setText] = useState(fakt?.fact ?? "");
  const [kategorie, setKategorie] = useState<WissenKategorie>(
    fakt?.kategorie ?? "sonstiges",
  );
  // Beim Anlegen aus der Objektebene ist „nur dieses Objekt" die Vorgabe: wer
  // in der Liste eines Objekts auf „+ Fakt" klickt, meint dieses Objekt.
  const [betriebsweit, setBetriebsweit] = useState(
    fakt ? fakt.property_id === null : objektId === null,
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function speichern() {
    const inhalt = text.trim();
    if (!inhalt) {
      setFehler(t("knowledgeRequired"));
      return;
    }
    setFehler(null);
    const eingabe = {
      property_id: betriebsweit ? null : objektId,
      titel: titel.trim() || null,
      fact: inhalt,
      kategorie,
    };
    start(async () => {
      const res = fakt
        ? await updateKnowledge(fakt.id, eingabe)
        : await createKnowledge(eingabe);
      if (res.ok) onGespeichert();
      else setFehler(res.error);
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onSchliessen()}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{fakt ? t("knowledgeEdit") : t("knowledgeNew")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <Feld label={t("kiFieldTitle")} pflicht={false}>
            <Input
              value={titel}
              maxLength={MAX_TITEL}
              onChange={(e) => setTitel(e.target.value)}
              placeholder={t("kiFieldTitlePlaceholder")}
            />
          </Feld>

          <Feld label={t("kiColFact")} pflicht>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={MAX_TEXT}
              placeholder={t("knowledgePlaceholder")}
              className="w-full resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <span className="self-end text-xs text-muted-foreground tabular-nums">
              {text.length} / {MAX_TEXT}
            </span>
          </Feld>

          <Feld label={t("kiColCategory")} pflicht>
            <NativeSelect
              value={kategorie}
              onChange={(e) => setKategorie(e.target.value as WissenKategorie)}
            >
              {WISSEN_KATEGORIEN.map((k) => (
                <option key={k} value={k}>
                  {t(`kiCategory_${k}` as never)}
                </option>
              ))}
            </NativeSelect>
            <span className="text-xs text-muted-foreground">
              {t(`kiCategoryHint_${kategorie}` as never)}
            </span>
          </Feld>

          {/* Nur auf der Objektebene sinnvoll: auf der betriebsweiten Ebene
              gibt es kein Objekt, an das man den Fakt hängen könnte. */}
          {objektId && (
            <Feld label={t("knowledgeScope")}>
              <NativeSelect
                value={betriebsweit ? "alle" : "dieses"}
                onChange={(e) => setBetriebsweit(e.target.value === "alle")}
              >
                <option value="dieses">{t("kiScopeThisProperty")}</option>
                <option value="alle">{t("knowledgeCompanyWide")}</option>
              </NativeSelect>
            </Feld>
          )}

          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
          <Button type="button" variant="outline" onClick={onSchliessen}>
            {t("templateCancel")}
          </Button>
          <Button type="button" onClick={speichern} disabled={pending || !text.trim()}>
            {t("templateSave")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Feld({
  label,
  pflicht,
  children,
}: {
  label: string;
  pflicht?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {pflicht && <span className="ml-0.5 text-accent">*</span>}
      </span>
      {children}
    </div>
  );
}
