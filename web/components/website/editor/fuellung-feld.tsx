"use client";

// Die FÜLLUNG eines Elements — Framers Fill-Popover (§9.3/9.4): Reiter Farbe ·
// Verlauf · Bild, ein Wert (`stil.fuellung`), genau eine Art davon.
//
// Fünf Reiter wie im Vorbild (Solid · Linear · Radial · Conic · Image). Im
// Modell sind es drei ARTEN (Farbe, Verlauf, Bild); die drei Verlaufsreiter
// unterscheiden sich in der FORM (`fuellung.form`), weil sie dieselben Stufen
// tragen und ein Reiterwechsel zwischen ihnen nichts wegwerfen soll.
//
// Was ein Reiter anbietet, muss der Server auch annehmen — sonst ist der
// Reiter stiller Datenverlust (`editor-leiste-muss-allowlist-treffen`).
//
// Ein Reiterwechsel ÄNDERT NOCH NICHTS: er zeigt die Felder der anderen Art.
// Geschrieben wird erst, wenn die Pflichtfelder dieser Art stehen (Farbe: die
// Farbe; Verlauf: zwei Stufen; Bild: die Adresse) — ein `{art: "bild"}` ohne
// Adresse weist das Backend ab, und der Editor soll es gar nicht erst senden.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Fuellung, Lage, Verlaufsstufe } from "@nextdays/baukasten-stil";

import { Schieber, Zahlfeld } from "../inspektor-rahmen";
import { BildEditor, mediumAusUrl } from "../mediathek/bild-editor";
import { BildFeld } from "./bild-feld";
import { Auswahl, Chip, FarbFeld, JaNein } from "./stil-felder";

type Art = Fuellung["art"];
/** Der REITER — Framers fünf. Er bestimmt Art und Form zusammen. */
type Reiter = "farbe" | "linear" | "radial" | "konisch" | "bild";
const REITER: readonly Reiter[] = ["farbe", "linear", "radial", "konisch", "bild"];
const REITER_ICON: Record<Reiter, string> = {
  farbe: "ph:drop-half-bottom",
  linear: "ph:gradient",
  radial: "ph:circle-half",
  konisch: "ph:spiral",
  bild: "ph:image",
};

function reiterAus(f: Fuellung | null): Reiter {
  if (!f) return "farbe";
  if (f.art === "farbe") return "farbe";
  if (f.art === "bild") return "bild";
  return (f.form as Reiter | undefined) ?? "linear";
}

const LAGEN: readonly Lage[] = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
];

function fuellungLesen(wert: unknown): Fuellung | null {
  if (wert === null || typeof wert !== "object" || Array.isArray(wert)) return null;
  const f = wert as Record<string, unknown>;
  if (f.art !== "farbe" && f.art !== "verlauf" && f.art !== "bild") return null;
  return f as unknown as Fuellung;
}

export function FuellungFeld({
  wert,
  laeuft = false,
  onWert,
}: {
  wert: unknown;
  laeuft?: boolean;
  onWert: (wert: Fuellung | null) => void;
}) {
  const t = useTranslations("website.stil");
  const f = fuellungLesen(wert);
  const [reiter, setReiter] = useState<Reiter>(reiterAus(f));
  /** Framers „Crop" (§4.8): der Bildeditor über der Füllung. Er speichert das
   *  Ergebnis als NEUES Bild und setzt dessen Adresse ein — das Original
   *  bleibt, wie es ist (Wurzel 1). */
  const [zuschnitt, setZuschnitt] = useState(false);
  // Entwurf eines Verlaufs, solange er noch keine zwei Stufen hat — er lebt
  // nur hier, bis er gültig ist.
  const [entwurfStufen, setEntwurfStufen] = useState<Verlaufsstufe[]>([]);
  const [aktiveStufe, setAktiveStufe] = useState<number | null>(null);

  const aktiv: Reiter = reiter;
  const art: Art = aktiv === "farbe" ? "farbe" : aktiv === "bild" ? "bild" : "verlauf";
  const form = aktiv === "linear" || aktiv === "radial" || aktiv === "konisch" ? aktiv : null;

  function schreibe(neu: Partial<Fuellung>) {
    const basis: Fuellung = f && f.art === art ? f : ({ art } as Fuellung);
    const zusammen: Fuellung = { ...basis, ...neu, art };
    // Die Form gehört zum Verlauf und NUR zu ihm — an einer Farbe oder einem
    // Bild wäre sie ein Feld, das der Server abweist.
    if (art === "verlauf") zusammen.form = form ?? "linear";
    else delete zusammen.form;
    onWert(zusammen);
  }

  const stufen: Verlaufsstufe[] =
    f?.art === "verlauf" && f.stufen ? f.stufen : entwurfStufen;

  function stufenSetzen(neu: Verlaufsstufe[]) {
    const sortiert = [...neu].sort((a, b) => a.position - b.position);
    if (sortiert.length >= 2) {
      setEntwurfStufen([]);
      schreibe({ stufen: sortiert, winkel: f?.art === "verlauf" ? f.winkel ?? 180 : 180 });
    } else {
      // Unter zwei Stufen ist es kein Verlauf: Entwurf halten, ggf. löschen.
      setEntwurfStufen(sortiert);
      if (f?.art === "verlauf") onWert(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex gap-0.5 rounded-(--radius) bg-secondary p-0.5">
        {REITER.map((a) => (
          <button
            key={a}
            type="button"
            disabled={laeuft}
            aria-pressed={aktiv === a}
            aria-label={t(`fuellung.${a}`)}
            title={t(`fuellung.${a}`)}
            onClick={() => {
              setReiter(a);
              // Zwischen den drei VERLAUFS-Reitern wird die Form sofort
              // umgestellt: die Stufen bleiben, nur die Form ändert sich —
              // ein Reiterwechsel, der die Arbeit wegwirft, wäre der Fehler,
              // den Framer hier macht (Vollerfassung §4.8).
              if (f?.art === "verlauf" && (a === "linear" || a === "radial" || a === "konisch")) {
                onWert({ ...f, form: a });
              }
            }}
            className={
              "flex flex-1 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] py-1.5 transition disabled:opacity-50 " +
              (aktiv === a
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <Icon icon={REITER_ICON[a]} className="size-4" />
          </button>
        ))}
      </div>
      {f && reiterAus(f) !== reiter ? (
        // Der Kunde schaut auf eine andere Art als die gesetzte: sagen, was
        // beim Ausfüllen passiert, statt es still zu ersetzen.
        <p className="text-[0.6875rem] text-muted-foreground">
          {t("fuellung.ersetztHinweis", { art: t(`fuellung.${reiterAus(f)}`) })}
        </p>
      ) : null}

      {reiter === "farbe" ? (
        <FarbFeld
          wert={f?.art === "farbe" ? f.farbe : null}
          laeuft={laeuft}
          onWert={(farbe) => (farbe ? onWert({ art: "farbe", farbe }) : onWert(null))}
        />
      ) : null}

      {form ? (
        <div className="flex flex-col gap-1.5">
          {/* Der Winkel gilt bei Linear für die Richtung, bei Konisch für den
              Startpunkt der Drehung — bei Radial gibt es keinen. */}
          {form !== "radial" ? (
            <div className="flex items-center gap-2">
              <span className="w-[4rem] shrink-0 text-[0.75rem] text-muted-foreground">
                {t("fuellung.winkel")}
              </span>
              <Zahlfeld
                wert={f?.art === "verlauf" ? f.winkel ?? null : null}
                min={0}
                max={360}
                einheit="°"
                laeuft={laeuft || f?.art !== "verlauf"}
                onWert={(w) => schreibe({ winkel: w ?? (form === "konisch" ? 0 : 180) })}
              />
            </div>
          ) : null}
          {form !== "linear" ? (
            <div className="flex items-center gap-2">
              <span className="w-[4rem] shrink-0 text-[0.75rem] text-muted-foreground">
                {t("fuellung.mitte")}
              </span>
              <Auswahl
                wert={f?.art === "verlauf" ? f.lage ?? null : null}
                leer={t("lage.center")}
                laeuft={laeuft || f?.art !== "verlauf"}
                optionen={LAGEN.map((l) => [l, t(`lage.${l.replace(" ", "_")}`)] as const)}
                onWahl={(l) => schreibe({ lage: l })}
              />
            </div>
          ) : null}
          {/* Die Vorschau IST der Verlauf — Rollen zeigen wir als
              Platzhalterstreifen, weil der Editor die Theme-Variablen der
              Kundenseite nicht kennt. */}
          <div
            aria-hidden
            className="h-6 rounded-(--radius) border border-border"
            style={{
              backgroundImage:
                stufen.length >= 2
                  ? (() => {
                      const liste = stufen
                        .map(
                          (s) =>
                            `${s.farbe.startsWith("rolle:") ? "#999" : s.farbe} ${s.position}%`,
                        )
                        .join(", ");
                      const mitte =
                        (f?.art === "verlauf" ? f.lage : null) ?? "center";
                      const winkel = f?.art === "verlauf" ? f.winkel : null;
                      if (form === "radial") return `radial-gradient(circle at ${mitte}, ${liste})`;
                      if (form === "konisch") {
                        return `conic-gradient(from ${winkel ?? 0}deg at ${mitte}, ${liste})`;
                      }
                      return `linear-gradient(${winkel ?? 180}deg, ${liste})`;
                    })()
                  : undefined,
            }}
          />
          <div className="flex flex-wrap gap-1">
            {stufen.map((s, i) => (
              <Chip
                key={`${i}:${s.farbe}:${s.position}`}
                laeuft={laeuft}
                aktiv={aktiveStufe === i}
                onClick={() => setAktiveStufe(aktiveStufe === i ? null : i)}
                onEntfernen={() => {
                  setAktiveStufe(null);
                  stufenSetzen(stufen.filter((_, j) => j !== i));
                }}
              >
                <span className="font-mono">{s.farbe.replace("rolle:", "")}</span> · {s.position}%
              </Chip>
            ))}
            {stufen.length < 8 ? (
              <button
                type="button"
                disabled={laeuft}
                onClick={() => {
                  // Neue Stufe am freien Ende — 0 oder 100, sonst dazwischen.
                  const belegt = new Set(stufen.map((s) => s.position));
                  const position = !belegt.has(0) ? 0 : !belegt.has(100) ? 100 : 50;
                  const neu = [...stufen, { farbe: "#ffffff", position }];
                  stufenSetzen(neu);
                  setAktiveStufe(neu.length - 1);
                }}
                className="flex items-center gap-1 rounded-(--radius) bg-secondary px-2 py-1.5 text-[0.75rem] transition hover:bg-secondary/70 disabled:opacity-50"
              >
                <Icon icon="ph:plus" className="size-3" />
                {t("fuellung.stufe")}
              </button>
            ) : null}
          </div>
          {aktiveStufe !== null && stufen[aktiveStufe] ? (
            <div className="flex flex-col gap-1.5 rounded-(--radius) border border-border p-2">
              <FarbFeld
                wert={stufen[aktiveStufe].farbe}
                laeuft={laeuft}
                onWert={(farbe) => {
                  if (!farbe) return;
                  stufenSetzen(stufen.map((s, j) => (j === aktiveStufe ? { ...s, farbe } : s)));
                }}
              />
              <div className="flex items-center gap-2">
                <span className="w-[4rem] shrink-0 text-[0.75rem] text-muted-foreground">
                  {t("fuellung.position")}
                </span>
                <Schieber
                  wert={stufen[aktiveStufe].position}
                  min={0}
                  max={100}
                  standard={50}
                  einheit="%"
                  laeuft={laeuft}
                  onWert={(p) => {
                    if (p === null) return;
                    stufenSetzen(
                      stufen.map((s, j) => (j === aktiveStufe ? { ...s, position: p } : s)),
                    );
                  }}
                />
              </div>
            </div>
          ) : null}
          {stufen.length < 2 ? (
            <p className="text-[0.6875rem] text-muted-foreground">{t("fuellung.zweiStufen")}</p>
          ) : null}
        </div>
      ) : null}

      {reiter === "bild" ? (
        <div className="flex flex-col gap-1.5">
          <BildFeld
            label={t("fuellung.bild")}
            wert={f?.art === "bild" ? f.url ?? null : null}
            kompakt
            onWert={(url) => (url ? schreibe({ url }) : onWert(null))}
          />
          {f?.art === "bild" ? (
            <>
              {/* Framers „Crop" — bei uns derselbe Bildeditor wie in der
                  Mediathek (Zuschneiden, Drehen, Spiegeln). Er legt eine KOPIE
                  an; das Original bleibt für jeden anderen Zuschnitt erhalten. */}
              <button
                type="button"
                disabled={laeuft}
                onClick={() => setZuschnitt(true)}
                className="flex items-center gap-1.5 self-start rounded-(--radius) bg-secondary px-2 py-1.5 text-[0.75rem] transition hover:bg-secondary/70 disabled:opacity-50"
              >
                <Icon icon="ph:crop" className="size-3.5" />
                {t("fuellung.zuschneiden")}
              </button>
              {zuschnitt && f.url ? (
                <BildEditor
                  medium={mediumAusUrl(f.url)}
                  onFertig={(neu) => {
                    setZuschnitt(false);
                    schreibe({ url: neu.url });
                  }}
                  onSchliesse={() => setZuschnitt(false)}
                />
              ) : null}
              <div className="flex items-center gap-2">
                <span className="w-[4rem] shrink-0 text-[0.75rem] text-muted-foreground">
                  {t("fuellung.groesse")}
                </span>
                <Auswahl
                  wert={f.groesse ?? null}
                  leer={t("automatisch")}
                  laeuft={laeuft}
                  optionen={[
                    ["cover", t("fuellung.cover")],
                    ["contain", t("fuellung.contain")],
                    ["auto", t("fuellung.auto")],
                  ]}
                  onWahl={(g) => schreibe({ groesse: g })}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[4rem] shrink-0 text-[0.75rem] text-muted-foreground">
                  {t("fuellung.lage")}
                </span>
                <Auswahl
                  wert={f.lage ?? null}
                  leer={t("automatisch")}
                  laeuft={laeuft}
                  optionen={LAGEN.map((l) => [l, t(`lage.${l.replace(" ", "_")}`)] as const)}
                  onWahl={(l) => schreibe({ lage: l })}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[4rem] shrink-0 text-[0.75rem] text-muted-foreground">
                  {t("fuellung.wiederholen")}
                </span>
                <JaNein
                  wert={f.wiederholen ?? null}
                  laeuft={laeuft}
                  onWahl={(w) => schreibe({ wiederholen: w })}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[4rem] shrink-0 text-[0.75rem] text-muted-foreground">
                  {t("fuellung.auflage")}
                </span>
                <Schieber
                  wert={f.auflage != null ? Math.round(f.auflage * 100) : null}
                  min={0}
                  max={90}
                  standard={0}
                  einheit="%"
                  laeuft={laeuft}
                  onWert={(p) => schreibe({ auflage: p === null || p === 0 ? null : p / 100 })}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
