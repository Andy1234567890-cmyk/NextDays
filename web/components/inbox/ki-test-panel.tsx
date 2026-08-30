"use client";

// Test-KI und Kontext-Panel — die rechte Spalte neben allen drei Reitern.
//
// DIE DEBUGGING-PFLICHT IN PRODUKTFORM. Ohne diese beiden Ansichten ist eine
// falsche Antwort nicht diagnostizierbar: man rät zwischen „ein Fakt fehlte",
// „eine Regel griff nicht" und „das Modell hat sich etwas zurechtgelegt".
//
// Der Test SENDET NICHTS. Er läuft gegen dieselbe Kette wie der Ernstfall und
// zeigt, was dann passieren WÜRDE — welche Regel griff, welche Zustellart, ob
// eine Sperre zuschlug. Ein Betrieb kann so vor dem Einschalten prüfen, ob
// seine Regeln greifen, statt es am ersten echten Gast zu erfahren.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type KiKontextAntwort,
  type KiTestAntwort,
  getKiKontext,
  kiTesten,
} from "@/lib/inbox";
import { listProperties } from "@/lib/properties";

type Reiter = "test" | "kontext";
type Runde = { frage: string; antwort: KiTestAntwort };

/** Icon je Kontextquelle. Der Präfix reicht: die Quellen heissen „Gästemappe →
 *  WLAN", „Objektdaten", „Kalender", „Wissensdatenbank", „Richtlinien". */
function quellenIcon(quelle: string): string {
  if (quelle.startsWith("Gästemappe")) return "ph:book-open";
  if (quelle.startsWith("Kalender")) return "ph:calendar";
  if (quelle.startsWith("Wissens")) return "ph:list";
  if (quelle.startsWith("Richtlinien")) return "ph:scroll";
  return "ph:house";
}

export function KiTestPanel({ onSchliessen }: { onSchliessen: () => void }) {
  const t = useTranslations("inbox");
  const [reiter, setReiter] = useState<Reiter>("test");
  // Ohne gewähltes Objekt hat die KI KEINEN Objektkontext — nur die
  // betriebsweiten Fakten. Live gemessen: 0 Zeichen, 0 Quellen. Das ist der
  // richtige Zustand für eine Konversation ohne Objektbezug, sieht im Test
  // aber wie ein Fehler aus, wenn es niemand sagt.
  const [objekte, setObjekte] = useState<{ id: string; title: string }[]>([]);
  const [objektId, setObjektId] = useState("");
  const [frage, setFrage] = useState("");
  const [runden, setRunden] = useState<Runde[]>([]);
  const [kontext, setKontext] = useState<KiKontextAntwort | null>(null);
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    void listProperties().then((p) => {
      if (p.ok) setObjekte(p.data.items.map((x) => ({ id: x.id, title: x.title })));
    });
  }, []);

  const kontextLaden = useCallback(async () => {
    const res = await getKiKontext({ propertyId: objektId || undefined });
    if (res.ok) setKontext(res.data);
    else setFehler(res.error);
  }, [objektId]);

  useEffect(() => {
    if (reiter === "kontext") void kontextLaden();
  }, [reiter, kontextLaden]);

  function fragen() {
    const text = frage.trim();
    if (!text) return;
    setFehler(null);
    start(async () => {
      const res = await kiTesten({
        property_id: objektId || null,
        frage: text,
        // Mehrere Fragen bauen einen Verlauf auf — wie im Ernstfall.
        verlauf: runden.flatMap((r) => [r.frage, r.antwort.antwort]),
      });
      if (res.ok) {
        setRunden((alt) => [...alt, { frage: text, antwort: res.data }]);
        setFrage("");
      } else {
        setFehler(res.error);
      }
    });
  }

  function umschalten(titel: string) {
    setOffen((alt) => {
      const neu = new Set(alt);
      if (neu.has(titel)) neu.delete(titel);
      else neu.add(titel);
      return neu;
    });
  }

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-border">
      <div className="flex items-center gap-4 border-b border-border px-4 py-3 text-sm">
        {(["test", "kontext"] as Reiter[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReiter(r)}
            className={
              r === reiter
                ? "border-b-2 border-accent pb-1 font-semibold text-accent"
                : "pb-1 text-muted-foreground hover:text-foreground"
            }
          >
            {r === "test" ? t("kiTestTab") : t("kiContextTab")}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {reiter === "test" && runden.length > 0 && (
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
      </div>

      <div className="border-b border-border px-4 py-3">
        <label className="text-xs text-muted-foreground">{t("kiTestAs")}</label>
        <NativeSelect
          value={objektId}
          onChange={(e) => {
            setObjektId(e.target.value);
            setRunden([]);
          }}
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

      {!objektId && (
        <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {t("kiTestNoPropertyHint")}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {fehler && <p className="mb-3 text-sm text-destructive">{fehler}</p>}

        {reiter === "kontext" ? (
          <KontextAnsicht
            kontext={kontext}
            offen={offen}
            onUmschalten={umschalten}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {runden.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("kiTestHint")}</p>
            )}
            {runden.map((r, i) => (
              <div key={i} className="flex flex-col gap-2 text-sm">
                <p className="rounded-2xl bg-muted px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {t("kiTestGuest")}
                  </span>
                  <br />
                  {r.frage}
                </p>
                <div className="flex flex-col gap-2 rounded-2xl border border-border p-3">
                  <span className="text-xs text-muted-foreground">{t("kiTestAi")}</span>
                  <p className="whitespace-pre-wrap">{r.antwort.antwort}</p>

                  {r.antwort.fehlende_angabe && (
                    <p className="flex items-start gap-1.5 rounded-(--radius) bg-warning/10 px-2 py-1.5 text-xs">
                      <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0 text-warning" />
                      {t("kiMissingInfo", { was: r.antwort.fehlende_angabe })}
                    </p>
                  )}

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      {t("kiSourcesCount", { count: r.antwort.kontext.quellen.length })}
                    </summary>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {r.antwort.kontext.quellen.map((q, k) => (
                        <li key={k} className="flex items-center gap-1.5">
                          <Icon icon="ph:check" className="size-3 text-success" />
                          {q}
                        </li>
                      ))}
                      {r.antwort.kontext.weggelassen.map((w, k) => (
                        <li key={`w${k}`} className="flex items-center gap-1.5 text-warning">
                          <Icon icon="ph:warning" className="size-3 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </details>

                  {/* Das ist der eigentliche Ertrag des Tests: was im
                      Ernstfall passieren WÜRDE. */}
                  <div className="flex flex-col gap-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
                    {r.antwort.regel_name && (
                      <span>{t("kiTestRule", { name: r.antwort.regel_name })}</span>
                    )}
                    <span>
                      {t("kiTestDelivery", {
                        art:
                          r.antwort.zustellart === "automatisch"
                            ? t("kiDeliveryAutoShort")
                            : t("kiDeliveryDraftShort"),
                      })}
                    </span>
                    <span>{r.antwort.grund}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reiter === "test" && (
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Input
            value={frage}
            onChange={(e) => setFrage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                fragen();
              }
            }}
            placeholder={t("kiTestPlaceholder")}
            maxLength={1500}
          />
          <Button
            type="button"
            size="icon"
            onClick={fragen}
            disabled={pending || !frage.trim()}
            aria-label={t("kiTestSend")}
          >
            <Icon
              icon={pending ? "ph:spinner" : "ph:paper-plane-right"}
              className={pending ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        </div>
      )}
    </aside>
  );
}

function KontextAnsicht({
  kontext,
  offen,
  onUmschalten,
}: {
  kontext: KiKontextAntwort | null;
  offen: Set<string>;
  onUmschalten: (titel: string) => void;
}) {
  const t = useTranslations("inbox");
  if (!kontext) {
    return <p className="text-sm text-muted-foreground">{t("kiContextLoading")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="text-sm font-medium">{t("kiContextTitle")}</h4>
        <p className="text-xs text-muted-foreground">{t("kiContextHint")}</p>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {t("kiContextChars", {
            zeichen: kontext.zeichen,
            max: kontext.max_zeichen,
          })}
        </p>
      </div>

      {kontext.abschnitte.map((a) => (
        <div key={a.titel} className="rounded-2xl border border-border">
          <button
            type="button"
            onClick={() => onUmschalten(a.titel)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
          >
            <Icon icon={quellenIcon(a.quelle)} className="size-4 text-muted-foreground" />
            <span className="flex-1 truncate font-medium">{a.titel}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {a.zeichen}
            </span>
            <Icon
              icon={offen.has(a.titel) ? "ph:caret-up" : "ph:caret-down"}
              className="size-4 text-muted-foreground"
            />
          </button>
          {offen.has(a.titel) && (
            // Der TATSÄCHLICHE Text, nicht eine Beschreibung davon.
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border px-3 py-2 text-xs">
              {a.inhalt}
            </pre>
          )}
        </div>
      ))}

      {kontext.abschnitte.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("kiContextEmpty")}</p>
      )}

      {kontext.weggelassen.length > 0 && (
        // Gesperrte und gekürzte Abschnitte erscheinen SICHTBAR, nicht
        // unsichtbar: sonst sucht jemand den Fehler in der Gästemappe.
        <div className="flex flex-col gap-1 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs">
          <span className="font-medium">{t("kiContextOmitted")}</span>
          {kontext.weggelassen.map((w, i) => (
            <span key={i} className="text-muted-foreground">
              · {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
