"use client";

// Test-KI für Bewertungstexte — die rechte Spalte neben dem Katalog.
//
// DIE DEBUGGING-PFLICHT IN PRODUKTFORM, dasselbe Muster wie im Posteingang
// (`inbox/ki-test-panel.tsx`). Ohne diese Ansicht ist ein schiefer Text nicht
// diagnostizierbar: man rät zwischen „der Katalog sagt das so", „die Note
// wurde falsch eingeordnet" und „das Modell hat sich etwas zurechtgelegt".
//
// Der Test SENDET NICHTS. Er läuft gegen dieselbe Kette wie der Ernstfall und
// zeigt, was dann passieren WÜRDE — welche Katalogfragen den Text getragen
// haben, welche Zustellart sich ergäbe und warum nicht automatisch zugestellt
// würde. Ein Betrieb kann so vor dem Einschalten feintunen, statt es an der
// ersten echten Bewertung zu erfahren, die dauerhaft öffentlich steht.
//
// Die Sternewahl ist das eigentliche Werkzeug: derselbe Katalog erzeugt bei
// 5 Sternen einen anderen Text als bei 1 Stern, und genau das soll die
// Agentur nebeneinander sehen können.
import { Icon } from "@iconify/react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import {
  type KiRichtung,
  type KiTestAntwort,
  kiTesten,
} from "@/lib/reviews";

type Objekt = { id: string; title: string };
type Runde = { note: number; richtung: KiRichtung; antwort: KiTestAntwort };

const NOTEN = [5, 4, 3, 2, 1];

export function KiTestPanel({
  objekte,
  onSchliessen,
}: {
  objekte: Objekt[];
  onSchliessen: () => void;
}) {
  const t = useTranslations("reviews");
  const [richtung, setRichtung] = useState<KiRichtung>("antwort");
  const [note, setNote] = useState(5);
  const [objektId, setObjektId] = useState("");
  const [gastText, setGastText] = useState("");
  const [runden, setRunden] = useState<Runde[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function testen() {
    setFehler(null);
    start(async () => {
      const res = await kiTesten({
        richtung,
        note,
        gast_text: gastText.trim() || null,
        property_id: objektId || null,
      });
      if (res.ok) {
        // Neueste zuerst: beim Feintunen vergleicht man den eben erzeugten
        // Text mit dem davor, nicht mit dem ersten von vor zehn Versuchen.
        setRunden((alt) => [{ note, richtung, antwort: res.data }, ...alt]);
      } else {
        setFehler(res.error);
      }
    });
  }

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon icon="ph:flask" className="size-4 text-muted-foreground" />
        <h3 className="flex-1 text-sm font-semibold">{t("kiTestTitle")}</h3>
        {runden.length > 0 && (
          <button
            type="button"
            onClick={() => setRunden([])}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("kiTestReset")}
          >
            <Icon icon="ph:arrow-counter-clockwise" className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onSchliessen}
          className="text-muted-foreground hover:text-foreground"
          aria-label={t("kiTestClose")}
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <div>
          <label className="text-xs text-muted-foreground" htmlFor="ki-richtung">
            {t("kiTestDirection")}
          </label>
          <NativeSelect
            id="ki-richtung"
            value={richtung}
            onChange={(e) => setRichtung(e.target.value as KiRichtung)}
            className="mt-1"
          >
            <option value="antwort">{t("kiDirectionReply")}</option>
            <option value="gast_bewerten">{t("kiDirectionRateGuest")}</option>
          </NativeSelect>
        </div>

        <div>
          <span className="text-xs text-muted-foreground">{t("kiTestStars")}</span>
          {/* Sterne als Knopfreihe, nicht als Auswahlliste: die Note ist der
              wichtigste Hebel des Tests, und ein Klick daneben zeigt sofort
              den Unterschied. */}
          <div className="mt-1 flex gap-1">
            {NOTEN.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNote(n)}
                className={
                  n === note
                    ? "flex-1 rounded-full bg-accent px-2 py-1.5 text-sm font-semibold text-accent-foreground"
                    : "flex-1 rounded-full border border-border px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {n}★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground" htmlFor="ki-objekt">
            {t("kiTestProperty")}
          </label>
          <NativeSelect
            id="ki-objekt"
            value={objektId}
            onChange={(e) => setObjektId(e.target.value)}
            className="mt-1"
          >
            <option value="">{t("kiTestNoProperty")}</option>
            {objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </NativeSelect>
        </div>

        {richtung === "antwort" && (
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="ki-gasttext">
              {t("kiTestGuestText")}
            </label>
            <Textarea
              id="ki-gasttext"
              value={gastText}
              onChange={(e) => setGastText(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder={t("kiTestGuestTextPlaceholder")}
              className="mt-1"
            />
          </div>
        )}

        <Button type="button" onClick={testen} disabled={pending}>
          <Icon
            icon={pending ? "ph:spinner" : "ph:play"}
            className={pending ? "size-4 animate-spin" : "size-4"}
          />
          {t("kiTestRun")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("kiTestSendsNothing")}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {fehler && <p className="mb-3 text-sm text-destructive">{fehler}</p>}
        {runden.length === 0 && !fehler && (
          <p className="text-sm text-muted-foreground">{t("kiTestHint")}</p>
        )}

        <div className="flex flex-col gap-4">
          {runden.map((r, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-2xl border border-border p-3 text-sm"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{r.note}★</span>
                <span>
                  {r.richtung === "antwort"
                    ? t("kiDirectionReply")
                    : t("kiDirectionRateGuest")}
                </span>
              </div>

              <p className="whitespace-pre-wrap">{r.antwort.text}</p>

              {r.antwort.mensch_pruefen && (
                <p className="flex items-start gap-1.5 rounded-(--radius) bg-warning/10 px-2 py-1.5 text-xs">
                  <Icon
                    icon="ph:warning"
                    className="mt-0.5 size-4 shrink-0 text-warning"
                  />
                  {t("kiNeedsHuman", { grund: r.antwort.mensch_pruefen })}
                </p>
              )}

              {/* Welche Katalogfragen den Text getragen haben — die eigentliche
                  Diagnose. Ohne sie bliebe nur das Raten, warum ein Text so
                  klingt, wie er klingt. */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {t("kiUsedQuestions", {
                    count: r.antwort.verwendete_fragen.length,
                  })}
                </summary>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {r.antwort.verwendete_fragen.map((q) => (
                    <li key={q} className="flex items-center gap-1.5">
                      <Icon icon="ph:check" className="size-3 text-success" />
                      {t(`kiQuestion.${q}` as never)}
                    </li>
                  ))}
                  {r.antwort.offene_fragen.map((q) => (
                    <li
                      key={`o${q}`}
                      className="flex items-center gap-1.5 text-warning"
                    >
                      <Icon icon="ph:minus-circle" className="size-3 shrink-0" />
                      {t(`kiQuestion.${q}` as never)}
                    </li>
                  ))}
                </ul>
              </details>

              {/* Der eigentliche Ertrag: was im Ernstfall passieren WÜRDE. */}
              <div className="flex flex-col gap-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
                <span>
                  {t("kiTestDelivery", {
                    art:
                      r.antwort.zustellart === "automatisch"
                        ? t("kiDeliveryAuto")
                        : t("kiDeliveryDraft"),
                  })}
                </span>
                {r.antwort.grund && <span>{r.antwort.grund}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
