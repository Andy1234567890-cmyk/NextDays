"use client";

// Die Meldedatei als das, was sie ist: ein Raster.
//
// WARUM DIESE ANSICHT: Die Vorschau zeigte die Meldung als Karten je
// Anbieter und Objekt. Das liest sich gut, ist aber NICHT die Datei — wer
// prüft, was eingereicht wird, muss die Zeilen sehen, die eingereicht
// werden. Die amtliche Vorlage ist ein Raster aus 89 Spalten, und jede
// Zeile füllt die, die ihr Satztyp braucht.
//
// Leere Zellen bleiben leer. Sie sind Teil der Aussage: Dass ein
// Objektsatz keinen Namen trägt und ein Verkäufersatz keine Quartalswerte,
// sieht man nur, wenn die Spalte da ist.
//
// WOHER DIE SPALTEN KOMMEN: aus der Kopfzeile der Datei selbst, nicht aus
// einer Liste im Frontend. Eine zweite Kopie der 89 Spaltennamen würde
// auseinanderlaufen, und dann zeigte die Oberfläche die Meldung anders an,
// als sie eingereicht wird.
//
// ALLE 89 SPALTEN, nicht nur die belegten. Hier standen zuerst nur die
// gefüllten — 61 von 89 —, begründet mit Platz. Das war die falsche
// Abwägung: Diese Ansicht wird der Steuerbehörde vorgelegt, und dort ist
// die LEERE Spalte genauso eine Aussage wie die gefüllte. Wer prüft, ob
// eine Pflichtangabe fehlt, kann das nur sehen, wenn die Spalte da ist.
//
// Der Schalter blendet die leeren aus, wenn jemand nur die Werte lesen
// will. Vorbelegt ist „alle" — die vollständige Ansicht ist die richtige,
// die gekürzte die bequeme.
import { useMemo, useState } from "react";

/** Eine CSV der Vorlage zerlegen: `;`-getrennt, kein Quoting.
 *
 *  Die Vorlage kennt kein Maskieren — der Erzeuger ersetzt Semikolons im
 *  Feldwert, bevor er schreibt. Ein vollwertiger CSV-Parser wäre hier
 *  also nicht genauer, nur langsamer. */
function zerlegen(text: string): { kopf: string[]; zeilen: string[][] } {
  const roh = text
    // \uFEFF ist die BOM. Als Escape geschrieben, nicht als unsichtbares
    // Zeichen: In der Quelldatei waere es nicht zu sehen und beim
    // Kopieren still verlorengegangen.
    .replace(/^\uFEFF/, "")
    .split("\n")
    .filter((z) => z.trim().length > 0);
  if (roh.length === 0) return { kopf: [], zeilen: [] };
  return {
    kopf: roh[0].split(";"),
    zeilen: roh.slice(1).map((z) => z.split(";")),
  };
}

/** Welche Spalten überhaupt einen Wert tragen.
 *
 *  Nur für den Schalter und die Zählung — weggelassen wird nichts, solange
 *  „alle Spalten" steht. */
function belegteSpalten(kopf: string[], zeilen: string[][]): Set<number> {
  return new Set(
    kopf
      .map((_, i) => i)
      .filter((i) => zeilen.some((z) => (z[i] ?? "").trim() !== "")),
  );
}

export function CsvRaster({ datei }: { datei: string }) {
  // Offen vorbelegt: Die Datei IST das Ergebnis — sie hinter einem Klick
  // zu verstecken hiesse, das Wichtigste wegzuräumen.
  const [offen, setOffen] = useState(true);
  const [nurBelegte, setNurBelegte] = useState(false);
  const { kopf, zeilen } = useMemo(() => zerlegen(datei), [datei]);
  const belegt = useMemo(
    () => belegteSpalten(kopf, zeilen),
    [kopf, zeilen],
  );
  const index = useMemo(
    () =>
      kopf.map((_, i) => i).filter((i) => !nurBelegte || belegt.has(i)),
    [kopf, belegt, nurBelegte],
  );

  if (kopf.length === 0 || zeilen.length === 0) return null;
  const leer = kopf.length - belegt.size;

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold">Die Meldedatei</h4>
        <span className="text-xs text-muted-foreground">
          {zeilen.length} Zeilen · alle {kopf.length} Spalten · {belegt.size}{" "}
          belegt
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Genau dieses Raster wird übermittelt — eine Zeile je Satz, die
        Spaltennamen EU-weit einheitlich. Leere Spalten stehen mit drin: Dass
        ein Feld nicht belegt ist, ist eine Angabe.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setOffen((wert) => !wert)}
          className="text-sm font-medium underline underline-offset-4"
        >
          {offen ? "Tabelle ausblenden" : "Tabelle anzeigen"}
        </button>
        {offen && leer > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={nurBelegte}
              onChange={(e) => setNurBelegte(e.target.checked)}
              className="size-4"
            />
            Nur belegte Spalten ({belegt.size} von {kopf.length})
          </label>
        )}
      </div>

      {offen && (
        <>
          {/* Waagerecht scrollbar: 45 Spalten passen auf keinen Schirm.
              Die Tabelle DARF breiter sein als die Seite — sie steckt in
              ihrem eigenen Scrollbereich, der Seitenrumpf bleibt ruhig. */}
          <div className="mt-3 max-h-[32rem] overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800">
            <table className="w-max border-collapse text-xs">
              <thead>
                <tr>
                  {/* Die Zeilennummer klebt: Beim Scrollen nach rechts
                      wüsste man sonst nicht mehr, in welcher Zeile man
                      ist. `background` statt `opacity` — opacity macht
                      die ganze Zelle durchsichtig, und die Werte
                      darunter scheinen durch. */}
                  <th className="sticky left-0 top-0 z-30 border-b border-r border-neutral-200 bg-neutral-50 px-2 py-1.5 text-right font-mono font-normal text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                    #
                  </th>
                  {index.map((i) => (
                    <th
                      key={kopf[i]}
                      // Eine in der ganzen Datei leere Spalte wird blasser
                      // gezeigt — sie ist da und gehoert dazu, traegt in
                      // DIESER Meldung aber nichts.
                      className={`sticky top-0 z-20 whitespace-nowrap border-b border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left font-mono font-normal dark:border-neutral-800 dark:bg-neutral-900 ${
                        belegt.has(i)
                          ? "text-neutral-600 dark:text-neutral-300"
                          : "text-neutral-400 dark:text-neutral-600"
                      }`}
                    >
                      {kopf[i]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zeilen.map((zeile, nr) => (
                  <tr
                    // Die Zeilennummer IST die Kennung der Zeile — zwei
                    // Zeilen duerfen gleich aussehen und bleiben doch
                    // verschiedene Saetze.
                    key={nr}
                    className="odd:bg-neutral-50/50 dark:odd:bg-neutral-900/40"
                  >
                    <td className="sticky left-0 z-10 border-r border-neutral-200 bg-white px-2 py-1 text-right font-mono text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950">
                      {nr + 1}
                    </td>
                    {index.map((i) => {
                      const wert = zeile[i] ?? "";
                      // ROW_TYPE trägt die Zeile — er wird betont, weil
                      // er entscheidet, welche Spalten überhaupt gefüllt
                      // sein dürfen.
                      const istTyp = kopf[i] === "ROW_TYPE";
                      return (
                        <td
                          key={kopf[i]}
                          className={`whitespace-nowrap px-2 py-1 ${
                            istTyp
                              ? "font-medium"
                              : "font-mono text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          {wert}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leer > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {nurBelegte
                ? `${leer} leere Spalten sind ausgeblendet.`
                : `${leer} der ${kopf.length} Spalten sind in dieser Meldung durchweg leer — blass dargestellt.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
