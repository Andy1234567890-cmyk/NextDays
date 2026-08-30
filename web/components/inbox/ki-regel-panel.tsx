"use client";

// Der Regel-Dialog als Seitenpanel, dreispaltig: links der Abschnittstitel mit
// Erklärung, rechts die Felder.
//
// Warum Panel und nicht inline: Ein Inline-Formular unter der Liste verschiebt
// beim Öffnen alle Zeilen; beim Bearbeiten der zwölften Regel steht es
// ausserhalb des Sichtfelds. Das Panel bleibt an derselben Stelle.
//
// ZWEI getrennte Eskalations-Schalter statt eines Kontrollkästchens. Das sind
// zwei Entscheidungen: „Im Posteingang melden" markiert den Thread, „Benachrichtigung
// senden" schickt zusätzlich eine Meldung. Wer jede Beschwerde als E-Mail will,
// ist ein anderer Betrieb als wer sie beim nächsten Blick sehen will.
import { Icon } from "@iconify/react";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import type { KiRegel, KiRegelUpsert } from "@/lib/inbox";
import type { Result } from "@/lib/inbox-wissen-typen";

import { ObjektMehrfachauswahl } from "@/components/objekt-mehrfachauswahl";
import type { Objektwahl } from "./ki-regeln-tab";

const MAX_NAME = 200;
const MAX_ANWEISUNG = 2000;

export const LEERE_REGEL: KiRegelUpsert = {
  name: "",
  aktiv: true,
  gilt_fuer: "alle",
  // Vorgabe „Entwurf": wer eine Regel anlegt, ohne die Zustellart zu wählen,
  // bekommt die vorsichtige — nicht die, die selbständig an Gäste sendet.
  zustellart: "entwurf",
  anweisung: "",
  ist_eskalation: false,
  eskalation_posteingang: true,
  benachrichtigen: false,
  property_ids: [],
};

/** Die vier Bezeichner, die die Vorlage empfiehlt. Freitext bleibt Freitext —
 *  die Knöpfe fügen nur ein, sie erzwingen nichts. Vier Pflichtfelder statt
 *  eines Textbereichs wären eine andere, engere Maske als die Vorlage hat. */
const BEZEICHNER = ["wann", "bedingung", "antworteMit", "ausser"] as const;

export function KiRegelPanel({
  regel,
  entwurf,
  objekte,
  bestehende,
  onSchliessen,
  onGespeichert,
  onSpeichern,
}: {
  regel: KiRegel | null;
  entwurf: KiRegelUpsert;
  objekte: Objektwahl[];
  /** Für die Dubletten-Warnung: eine ähnliche Anweisung gibt es schon. */
  bestehende: KiRegel[];
  onSchliessen: () => void;
  onGespeichert: () => void;
  onSpeichern: (werte: KiRegelUpsert) => Promise<Result<KiRegel>>;
}) {
  const t = useTranslations("inbox");
  const [w, setW] = useState<KiRegelUpsert>(entwurf);
  const [fehler, setFehler] = useState<string | null>(null);
  const [warnungenBestaetigt, setWarnungenBestaetigt] = useState(false);
  // Der Suchtext der Objektauswahl liegt HIER, nicht in der Auswahl selbst:
  // beim Wechsel auf „Alle Objekte" soll er zurückgesetzt werden.
  const [objektSuche, setObjektSuche] = useState("");
  const [pending, start] = useTransition();

  const setzen = (teil: Partial<KiRegelUpsert>) => {
    setW((alt) => ({ ...alt, ...teil }));
    setWarnungenBestaetigt(false);
  };

  // Eine Eskalationsregel, die automatisch sendet, ist ein Widerspruch, der
  // stumm nichts täte: sie antwortet ja gerade NICHT, sondern meldet.
  const eskaliert = w.ist_eskalation || w.eskalation_posteingang || w.benachrichtigen;

  const warnungen = useMemo(
    () => antiMuster(w, bestehende, regel?.id ?? null),
    [w, bestehende, regel],
  );

  function bezeichnerEinfuegen(key: (typeof BEZEICHNER)[number]) {
    const zeile = `${t(`kiLabel_${key}` as never)}: `;
    setzen({
      anweisung: w.anweisung
        ? `${w.anweisung.replace(/\s*$/, "")}\n${zeile}`
        : zeile,
    });
  }

  function speichern() {
    if (!w.name.trim()) {
      setFehler(t("kiRuleNameRequired"));
      return;
    }
    if (!w.anweisung.trim()) {
      setFehler(t("kiRuleInstructionRequired"));
      return;
    }
    // Warnungen sind KEINE Sperren — der Betrieb kennt sein Geschäft. Aber ein
    // Klick soll bestätigen, dass er sie gelesen hat.
    if (warnungen.length > 0 && !warnungenBestaetigt) {
      setWarnungenBestaetigt(true);
      return;
    }
    setFehler(null);
    start(async () => {
      const res = await onSpeichern({
        ...w,
        // Eskalation und automatisches Senden schliessen sich aus.
        zustellart: eskaliert ? "entwurf" : w.zustellart,
        ist_eskalation: eskaliert,
        property_ids: w.gilt_fuer === "auswahl" ? w.property_ids : [],
      });
      if (res.ok) onGespeichert();
      else setFehler(res.error);
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onSchliessen()}>
      <SheetContent side="right" className="sm:max-w-3xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{regel ? t("kiEditRule") : t("kiAddRule")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
          <Abschnitt titel={t("kiSectionBasics")} erklaerung={t("kiSectionBasicsHint")}>
            <Feld label={t("kiFieldName")} pflicht>
              <Input
                value={w.name}
                maxLength={MAX_NAME}
                onChange={(e) => setzen({ name: e.target.value })}
                placeholder={t("kiFieldNamePlaceholder")}
              />
            </Feld>

            <Feld label={t("kiColAppliesTo")} pflicht>
              <NativeSelect
                value={w.gilt_fuer}
                onChange={(e) =>
                  setzen({ gilt_fuer: e.target.value as KiRegelUpsert["gilt_fuer"] })
                }
              >
                <option value="alle">{t("knowledgeAllProperties")}</option>
                <option value="auswahl">{t("kiOnlySelectedProperties")}</option>
              </NativeSelect>
            </Feld>

            {w.gilt_fuer === "auswahl" && (
              <Feld label={t("kiFieldProperties")} pflicht>
                {/* Dieselbe Auswahl wie im Preise-Bereich und bei der
                    Eigentümer-Zuordnung: Bild, Name und Ort je Zeile. Ein
                    Betrieb mit 18 gleich benannten Ferienhäusern unterscheidet
                    sie am Foto, nicht am Namen. */}
                <ObjektMehrfachauswahl
                  objekte={objekte.map((o) => ({
                    id: o.id,
                    title: o.title,
                    subtitle: o.ort ?? undefined,
                    photo: o.foto ?? undefined,
                  }))}
                  selected={w.property_ids}
                  onChange={(ids) => setzen({ property_ids: ids })}
                  suche={objektSuche}
                  onSucheChange={setObjektSuche}
                  emptyText={t("kiNoProperties")}
                  countLabel={(n, m) => t("kiSelectedOf", { count: n, total: m })}
                />
              </Feld>
            )}

            <Feld label={t("kiFieldDelivery")} pflicht>
              <NativeSelect
                value={w.zustellart}
                disabled={eskaliert}
                onChange={(e) =>
                  setzen({ zustellart: e.target.value as KiRegelUpsert["zustellart"] })
                }
              >
                <option value="entwurf">{t("kiDeliveryDraft")}</option>
                <option value="automatisch">{t("kiDeliveryAuto")}</option>
              </NativeSelect>
              {eskaliert && (
                <span className="text-xs text-muted-foreground">
                  {t("kiDeliveryLockedByEscalation")}
                </span>
              )}
            </Feld>

            <Feld label={t("kiFieldActive")} pflicht>
              <Switch
                checked={w.aktiv}
                onCheckedChange={(an) => setzen({ aktiv: an })}
                aria-label={t("kiFieldActive")}
              />
            </Feld>
          </Abschnitt>

          <Abschnitt
            titel={t("kiSectionInstruction")}
            erklaerung={t("kiSectionInstructionHint")}
          >
            {/* Die Vorlage empfiehlt Bezeichner ausdrücklich: gekennzeichnete
                Regeln liefern konsistentere Antworten als ein Textblock.
                Angeboten, nicht erzwungen. */}
            <div className="flex flex-wrap gap-2">
              {BEZEICHNER.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => bezeichnerEinfuegen(b)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
                >
                  {t(`kiLabel_${b}` as never)}:
                </button>
              ))}
            </div>

            <textarea
              value={w.anweisung}
              onChange={(e) => setzen({ anweisung: e.target.value })}
              rows={8}
              maxLength={MAX_ANWEISUNG}
              placeholder={t("kiInstructionPlaceholder")}
              className="w-full resize-none rounded-(--radius) border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <span className="self-end text-xs text-muted-foreground tabular-nums">
              {w.anweisung.length} / {MAX_ANWEISUNG}
            </span>

            {/* Die nicht abschaltbare Sperre gehört ans Formular, nicht ins
                Kleingedruckte: sie überstimmt jede Regel, die hier steht. */}
            <p className="flex items-start gap-2 rounded-(--radius) bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Icon icon="ph:lock-simple" className="mt-0.5 size-4 shrink-0" />
              {t("kiBlockedTopicsHint")}
            </p>
          </Abschnitt>

          <Abschnitt titel={t("kiSectionEscalation")} erklaerung={t("kiSectionEscalationHint")}>
            <Schalterzeile
              label={t("kiEscalationInbox")}
              hinweis={t("kiEscalationInboxHint")}
              an={w.eskalation_posteingang}
              onChange={(an) => setzen({ eskalation_posteingang: an })}
            />
            <Schalterzeile
              label={t("kiEscalationNotify")}
              hinweis={t("kiEscalationNotifyHint")}
              an={w.benachrichtigen}
              onChange={(an) => setzen({ benachrichtigen: an })}
            />
          </Abschnitt>

          {warnungen.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
              {warnungen.map((k) => (
                <p key={k} className="flex items-start gap-2">
                  <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0 text-warning" />
                  {t(`kiAntiPattern_${k}` as never)}
                </p>
              ))}
              {warnungenBestaetigt && (
                <p className="text-xs text-muted-foreground">{t("kiSaveAnyway")}</p>
              )}
            </div>
          )}

          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>

        <SheetFooter className="flex-col items-stretch gap-2 border-t border-border">
          {/* Steht immer da, auch ohne Warnung: die zweithäufigste Rückfrage. */}
          <p className="text-xs text-muted-foreground">{t("kiRulesNotRetroactive")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onSchliessen}>
              {t("templateCancel")}
            </Button>
            <Button type="button" onClick={speichern} disabled={pending || !w.name.trim()}>
              <Icon icon="ph:check" className="size-4" />
              {warnungen.length > 0 && !warnungenBestaetigt
                ? t("kiSaveAnywayButton")
                : t("templateSave")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Die drei Anti-Muster, die die Oberfläche erkennen kann.
 *
 *  Warnungen, keine Sperren: der Betrieb kennt sein Geschäft. Aber diese drei
 *  Fehler kosten Antwortqualität, und niemand merkt es von allein. */
function antiMuster(
  w: KiRegelUpsert,
  bestehende: KiRegel[],
  eigeneId: string | null,
): string[] {
  const treffer: string[] = [];
  const text = w.anweisung.toLowerCase();

  // 1. Ton-/Sprach-/Signaturregel — gehört in „Allgemein". Als Regel
  //    formuliert trifft sie auf JEDE Nachricht zu und hebelt damit die
  //    Zustell-Logik aus.
  const tonWorte = ["ton", "tonfall", "sprache", "signatur", "höflich", "freundlich"];
  const hatBedingung = /\b(wann|wenn|falls|bedingung)\b/.test(text);
  if (tonWorte.some((x) => text.includes(x)) && !hatBedingung) {
    treffer.push("tone");
  }

  // 2. Wenn/dann in einer Regel — gehört in zwei Regeln, eine je Zweig.
  if (/\bwenn\b[\s\S]*\bsonst\b/.test(text) || /\bfalls nicht\b/.test(text)) {
    treffer.push("branching");
  }

  // 3. Doppelte Anweisung. Absichtlich grob: eine echte Ähnlichkeitsmessung
  //    wäre hier zu viel Maschinerie für einen Hinweis.
  const eigene = normalisieren(w.anweisung);
  if (
    eigene.length > 20 &&
    bestehende.some(
      (r) => r.id !== eigeneId && r.aktiv && normalisieren(r.anweisung) === eigene,
    )
  ) {
    treffer.push("duplicate");
  }

  return treffer;
}

function normalisieren(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function Abschnitt({
  titel,
  erklaerung,
  children,
}: {
  titel: string;
  erklaerung: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-b border-border pb-6 last:border-0 sm:flex-row sm:gap-6">
      <div className="sm:w-1/3 sm:shrink-0">
        <h4 className="text-sm font-medium">{titel}</h4>
        <p className="text-xs text-muted-foreground">{erklaerung}</p>
      </div>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </section>
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

function Schalterzeile({
  label,
  hinweis,
  an,
  onChange,
}: {
  label: string;
  hinweis: string;
  an: boolean;
  onChange: (an: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="text-sm font-medium">{label}</span>
        <p className="text-xs text-muted-foreground">{hinweis}</p>
      </div>
      <Switch checked={an} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
