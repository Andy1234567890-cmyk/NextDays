"use client";

// KI-Regel-Berater über der Preis-Vorschau — als schmale Leiste, nicht als Block.
//
// WARUM LEISTE + DIALOG UND NICHT KARTE
// Die erste Fassung war ein sechszeiliger Textblock über dem Kalender: Regel,
// Wirkung, Belege und Begründung untereinander, alles gleich groß und gleich
// grau. Die wichtigste Zahl (was der Vorschlag mit den Preisen macht) sah aus
// wie die unwichtigste, und der Kalender — die eigentliche Hauptsache der
// Seite — wurde nach unten gedrückt.
//
// Jetzt: eine Zeile mit dem ERGEBNIS (+21 % Ø-Preis), Details im Dialog. Der
// Berater meldet sich, drängt sich aber nicht vor den Kalender.
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import {
  getKiVorschlaege,
  type KiPruefung,
  kiVorschlagAblehnen,
  kiVorschlagAnnehmen,
  type KiVorschlag,
} from "@/lib/dynamic-pricing";

/** Ein Vorschlagswert lesbar machen — Zahl, Stufenleiter oder „nicht gesetzt". */
function wertText(wert: unknown): string {
  if (wert === null || wert === undefined) return "nicht gesetzt";
  if (Array.isArray(wert)) {
    return wert
      .map((s) => {
        const r = s as { ab_pct?: number; adjust_pct?: number };
        const v = r.adjust_pct ?? 0;
        return `ab ${r.ab_pct} % → ${v > 0 ? "+" : ""}${v} %`;
      })
      .join(" · ");
  }
  return String(wert);
}

/** Belege als Klartext: „Auslastung Wochenende: 45,2 %" statt
 *  „auslastung_wochenende_pct: 45.2". Zahlen deutsch (Komma), damit sie
 *  neben den Preisen im selben Dialog nicht fremd aussehen. */
function belegText(schluessel: string, wert: number | string): string {
  const name = schluessel
    .replace(/_pct$/, "")
    .replace(/_/g, " ")
    .replace(/(^|\s)(\w)/g, (_, vor, c: string) => vor + c.toUpperCase());
  const text = typeof wert === "number" ? zahl(wert) : wert;
  return `${name}: ${text}${schluessel.endsWith("_pct") ? " %" : ""}`;
}

/** Veränderung des Durchschnittspreises in Prozent — die eine Zahl, die zählt. */
function veraenderungPct(v: KiVorschlag): number | null {
  if (!v.wirkung || v.wirkung.schnitt_vorher <= 0) return null;
  return Math.round(
    (v.wirkung.schnitt_nachher / v.wirkung.schnitt_vorher - 1) * 100,
  );
}

/** Symbol je Prüfergebnis — auf einen Blick lesbar, ohne Farbe allein. */
function ergebnisSymbol(ergebnis: KiPruefung["ergebnis"]): string {
  if (ergebnis === "vorschlag") return "→";
  if (ergebnis === "zu_wenig_daten") return "○";
  if (ergebnis === "ruht") return "⏸";
  if (ergebnis === "aus") return "–";
  return "✓";
}

function zahl(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export function KiBeraterKarte({
  propertyId,
  currency,
}: {
  propertyId: string;
  currency: string | null;
}) {
  const [vorschlaege, setVorschlaege] = useState<KiVorschlag[] | null>(null);
  const [pruefungen, setPruefungen] = useState<KiPruefung[]>([]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState(false);
  const [inArbeit, setInArbeit] = useState<string | null>(null);

  async function laden(oeffnen: boolean) {
    setLaedt(true);
    setFehler(null);
    const res = await getKiVorschlaege(propertyId);
    setLaedt(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setVorschlaege(res.data.vorschlaege);
    setPruefungen(res.data.pruefungen ?? []);
    setHinweis(res.data.hinweis);
    // Auch OHNE Vorschlag öffnen: dann zeigt der Dialog die Prüfliste. Ein
    // "keine Vorschläge" ohne Begründung sieht aus wie ein Defekt.
    if (oeffnen) setOffen(true);
  }

  async function entscheiden(feld: string, annehmen: boolean) {
    setInArbeit(feld);
    setFehler(null);
    const res = annehmen
      ? await kiVorschlagAnnehmen(propertyId, feld)
      : await kiVorschlagAblehnen(propertyId, feld);
    setInArbeit(null);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    const rest = (vorschlaege ?? []).filter((x) => x.feld !== feld);
    setVorschlaege(rest);
    // War es der letzte, neu prüfen statt schliessen: die Entscheidung ändert
    // die Datenlage, und die Prüfliste soll zeigen, warum jetzt nichts mehr
    // ansteht — nicht einfach verschwinden.
    if (rest.length === 0) void laden(false);
  }

  const anzahl = vorschlaege?.length ?? 0;
  // Grösste Preiswirkung unter allen Vorschlägen — sie steht in der Leiste,
  // weil sie den Klick wert sein muss.
  const staerkste = (vorschlaege ?? []).reduce<number | null>((max, v) => {
    const p = veraenderungPct(v);
    if (p === null) return max;
    return max === null || Math.abs(p) > Math.abs(max) ? p : max;
  }, null);

  return (
    <>
      {/* Schmale Leiste: eine Zeile, kein Block. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius) border bg-card px-4 py-2.5 text-sm">
        <span className="font-display font-extrabold">Regel-Berater</span>

        {vorschlaege === null && (
          <span className="text-muted-foreground">
            Prüft Buchungen der letzten 12 Monate und schlägt Einstellungen vor.
          </span>
        )}

        {anzahl > 0 && (
          <span>
            {anzahl}{" "}
            {anzahl === 1 ? "Regel-Vorschlag" : "Regel-Vorschläge"}
            {staerkste !== null && (
              <>
                {" · würde "}
                <span
                  className={
                    staerkste > 0
                      ? "font-semibold text-emerald-600 dark:text-emerald-400"
                      : "font-semibold text-amber-600 dark:text-amber-400"
                  }
                >
                  {staerkste > 0 ? "+" : ""}
                  {staerkste} % Ø-Preis
                </span>
                {" bewirken"}
              </>
            )}
          </span>
        )}

        {vorschlaege !== null && anzahl === 0 && (
          <span className="text-muted-foreground">
            {hinweis ?? "Keine Vorschläge."}
          </span>
        )}

        {fehler && <span className="text-destructive">{fehler}</span>}

        <div className="ml-auto flex gap-2">
          {vorschlaege !== null && (
            <Button
              type="button"
              size="sm"
              variant={anzahl > 0 ? "default" : "outline"}
              onClick={() => setOffen(true)}
            >
              {anzahl > 0 ? "Ansehen" : "Warum nicht?"}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => laden(true)}
            disabled={laedt}
          >
            {laedt ? "prüft…" : vorschlaege === null ? "Prüfen" : "Neu prüfen"}
          </Button>
        </div>
      </div>

      {/* Details im Dialog — dort ist Platz für die Aufschlüsselung, ohne den
          Kalender zu verdrängen. */}
      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogTitle>
            {anzahl > 0 ? "Vorschläge des Regel-Beraters" : "Regel-Berater"}
          </DialogTitle>
          <DialogDescription>
            {anzahl > 0
              ? "Vorgeschlagen werden Einstellungen, keine einzelnen Preise. Was du übernimmst, rechnet die Automatik danach selbst."
              : (hinweis ??
                "Zurzeit kein Vorschlag. Unten steht, was geprüft wurde.")}
          </DialogDescription>

          <div className="mt-2 flex flex-col gap-4">
            {(vorschlaege ?? []).map((v) => {
              const pct = veraenderungPct(v);
              return (
                <div
                  key={v.feld}
                  className="flex flex-col gap-2 rounded-(--radius) border p-3"
                >
                  {/* Kennzeichnung ZUERST: darunter steht eine Preiszahl, die
                      ohne diese Zeile wie ein Preisvorschlag aussieht. Was
                      vorgeschlagen wird, ist die REGEL — der Preis ist nur
                      ihre gerechnete Folge. */}
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                      Regel-Vorschlag
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {v.titel}
                    </span>
                  </div>

                  {/* Die REGEL ist das Vorgeschlagene und steht deshalb oben
                      und gross — nicht der Preis. */}
                  <p className="text-base font-semibold">
                    {wertText(v.wert_alt)} → {wertText(v.wert_neu)}
                  </p>

                  {/* Die Preisfolge ausdruecklich als FOLGE benannt: dieselbe
                      Zahl ohne diese Ueberschrift liest sich wie ein
                      Preisvorschlag. */}
                  {v.wirkung && (
                    <div className="rounded-(--radius) bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">
                        Was die Automatik daraus rechnen würde
                      </p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-2">
                        <span className="text-lg font-semibold">
                          {zahl(v.wirkung.schnitt_vorher)} →{" "}
                          {zahl(v.wirkung.schnitt_nachher)}
                          {currency ? ` ${currency}` : ""}
                        </span>
                        {pct !== null && (
                          <span
                            className={
                              pct > 0
                                ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }
                          >
                            {pct > 0 ? "+" : ""}
                            {pct} %
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Ø über {v.wirkung.tage} Tage ·{" "}
                          {v.wirkung.tage_geaendert} Tage betroffen
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Belege als dezente Chips: prüfbar, aber nicht dominant. */}
                  <ul className="flex flex-wrap gap-1.5">
                    {Object.entries(v.belege).map(([k, w]) => (
                      <li
                        key={k}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {belegText(k, w)}
                      </li>
                    ))}
                  </ul>

                  {v.begruendung && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-accent">
                        Warum?
                      </summary>
                      <p className="mt-1 leading-relaxed text-muted-foreground">
                        {v.begruendung}
                      </p>
                    </details>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => entscheiden(v.feld, true)}
                      disabled={inArbeit === v.feld}
                    >
                      {inArbeit === v.feld ? "…" : "Übernehmen"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => entscheiden(v.feld, false)}
                      disabled={inArbeit === v.feld}
                    >
                      Ablehnen
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Die Pruefliste: WAS geprueft wurde und warum nichts vorgeschlagen
              wird. Ohne sie ist ein schweigender Berater nicht von einem
              defekten zu unterscheiden. */}
          {pruefungen.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Geprüft wurde
              </p>
              <ul className="flex flex-col gap-2">
                {pruefungen.map((pr) => (
                  <li key={pr.name} className="flex gap-2 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {ergebnisSymbol(pr.ergebnis)}
                    </span>
                    <div>
                      <span className="font-medium">{pr.titel}</span>
                      <p className="text-xs text-muted-foreground">
                        {pr.grund}
                      </p>
                      {Object.keys(pr.belege).length > 0 && (
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {Object.entries(pr.belege).map(([k, w]) => (
                            <li
                              key={k}
                              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {belegText(k, w)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fehler && <p className="mt-2 text-sm text-destructive">{fehler}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
