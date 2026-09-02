"use client";

// Fortschritts-Popup des Datei-Bestandsimports.
//
// WARUM ES DIESES FENSTER GIBT: Der Import lief bis zum 31.08.2026 in EINER
// HTTP-Anfrage. Live gemessen an einem Booking.com-Export mit 252 Zeilen:
// 3,6 s je Zeile, also rund 15 Minuten. Sichtbar war davon ein Knopf mit
// Spinner — und nach ein paar Minuten „Backend nicht erreichbar.", während der
// Server unbeirrt weiterschrieb. Der Betrieb sah einen Fehler UND hatte einen
// halb angelegten Bestand.
//
// Jetzt reiht der Klick einen Job ein, der Worker schreibt seinen Stand nach
// `bestandsimport_lauf`, und dieses Fenster liest ihn per Realtime. Es zeigt,
// WIE WEIT der Import ist, WAS gerade läuft und WIE LANGE es noch dauert.
//
// Die Restzeit kommt aus dem GEMESSENEN Takt dieses Laufs (verstrichene Zeit /
// fertige Zeilen), nicht aus einer festen Konstante: die Dauer je Zeile hängt
// an der Zahl der Objekte, der Netzlaufzeit zur DB und daran, wie viele Zeilen
// Duplikate sind. Ein fest verdrahtetes „3,6 s" wäre am ersten anderen Betrieb
// falsch (Wurzel 4 — kein erfundener Wert).
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Dialog, DialogContent, DialogTitle } from "@nextdays/ui/dialog";
import { Button } from "@nextdays/ui/button";
import { type BestandsimportLauf, bestandsimportStand } from "@/lib/channex";
import { useRealtime } from "@/lib/use-realtime";

/** Sekunden → „noch ~3 Min." bzw. „noch ~40 Sek.".
 *
 *  Nimmt den Uebersetzer als Argument statt selbst `useTranslations` zu rufen:
 *  eine Hilfsfunktion ausserhalb der Komponente darf keinen Hook verwenden. */
function restText(
  sekunden: number,
  t: (k: string, v?: Record<string, number>) => string,
) {
  if (sekunden >= 90) {
    return t("importProgress.remainMinutes", { count: Math.round(sekunden / 60) });
  }
  return t("importProgress.remainSeconds", { count: Math.max(5, Math.round(sekunden / 5) * 5) });
}

export function ImportFortschritt({
  lauf,
  setLauf,
  onFertig,
}: {
  lauf: BestandsimportLauf | null;
  setLauf: (l: BestandsimportLauf | null) => void;
  onFertig?: () => void;
}) {
  const t = useTranslations("channels");
  // Startzeitpunkt DIESER Anzeige, für die Taktmessung. Bewusst nicht
  // `created_at` des Laufs: wird die Seite mitten im Lauf geöffnet, wäre die
  // bis dahin verstrichene Zeit mitgezählt, obwohl die zugehörigen Zeilen schon
  // fertig sind — die Schätzung wäre systematisch zu hoch.
  const [start] = useState(() => ({ t: Date.now(), fertig: lauf?.zeilen_fertig ?? 0 }));
  const [jetzt, setJetzt] = useState(() => Date.now());

  const laeuft = lauf?.status === "laeuft";

  // Sekundentakt nur solange der Import läuft — sonst tickt die Uhr sinnlos
  // weiter und rendert das Fenster jede Sekunde neu.
  useEffect(() => {
    if (!laeuft) return;
    const id = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(id);
  }, [laeuft]);

  const nachladen = useCallback(() => {
    void bestandsimportStand().then((r) => {
      if (r.ok) setLauf(r.data);
    });
  }, [setLauf]);

  // Der Balken hängt an dieser Tabelle. Sie ist für `authenticated` lesbar und
  // Mitglied der Publikation (0507) — beides nötig, sonst wäre das Abo eine
  // stumme Attrappe, die live aussieht und nie aktualisiert.
  useRealtime<BestandsimportLauf>({
    table: "bestandsimport_lauf",
    enabled: Boolean(lauf),
    debounceMs: 0,
    onEvent: (payload) => {
      const row = payload.new as BestandsimportLauf;
      if (!row?.id || (lauf && row.id !== lauf.id)) return;
      setLauf(row);
    },
  });

  // Realtime kann aussetzen (Verbindungsabbruch, Tab im Hintergrund). Ein
  // Nachfassen alle 10 s hält den Balken auch dann korrekt — er ist die einzige
  // Rückmeldung, die der Betrieb minutenlang sieht.
  useEffect(() => {
    if (!laeuft) return;
    const id = setInterval(nachladen, 10_000);
    return () => clearInterval(id);
  }, [laeuft, nachladen]);

  // Am Ende einmal die Listen auffrischen: die importierten Buchungen sollen
  // ohne Neuladen unten stehen.
  const fertigGemeldet = lauf?.status && lauf.status !== "laeuft";
  useEffect(() => {
    if (fertigGemeldet) onFertig?.();
  }, [fertigGemeldet, onFertig]);

  if (!lauf) return null;

  const gesamt = Math.max(1, lauf.zeilen_gesamt);
  const fertig = Math.min(lauf.zeilen_fertig, gesamt);
  const prozent = Math.round((fertig / gesamt) * 100);

  // Restzeit aus dem gemessenen Takt. Erst ab ein paar Zeilen, sonst schwankt
  // die Schätzung wild (die erste Zeile trägt den Verbindungsaufbau mit).
  const seitStart = (jetzt - start.t) / 1000;
  const geschafft = fertig - start.fertig;
  const rest =
    laeuft && geschafft >= 3 && seitStart > 0
      ? ((gesamt - fertig) * seitStart) / geschafft
      : null;

  return (
    <Dialog open onOpenChange={() => { if (!laeuft) setLauf(null); }}>
      <DialogContent className="sm:max-w-lg">
          <DialogTitle className="flex items-center gap-2">
            {laeuft ? (
              <Icon icon="ph:spinner" className="size-5 animate-spin text-primary" />
            ) : lauf.status === "fehler" ? (
              <Icon icon="ph:warning-circle" className="size-5 text-destructive" />
            ) : (
              <Icon icon="ph:check-circle" className="size-5 text-emerald-600" />
            )}
            {laeuft
              ? t("importProgress.running")
              : lauf.status === "fehler"
                ? t("importProgress.failed")
                : t("importProgress.done")}
          </DialogTitle>

        <div className="flex flex-col gap-4">
          {/* Balken. `transition-all` macht die Sprünge weich — der Worker
              meldet in Fünferschritten, ohne Übergang ruckelte es sichtbar. */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium">
                {t("importProgress.rows", { fertig, gesamt })}
              </span>
              <span className="tabular-nums text-muted-foreground">{prozent} %</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${prozent}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
              {/* Was gerade läuft. `truncate`, weil Objekt- und Gastname
                  zusammen breiter werden können als der Dialog. */}
              <span className="truncate">{lauf.aktuelle_zeile ?? ""}</span>
              {rest !== null && (
                <span className="shrink-0 tabular-nums">{restText(rest, t)}</span>
              )}
            </div>
          </div>

          {/* Zähler, GETRENNT statt summiert. „0 neu · 251 aktualisiert" ist
              die Aussage, an der ein Betrieb abliest, dass ein zweiter Upload
              nichts verdoppelt hat.
              Bis zum 31.08.2026 lagen „angelegt" und „aktualisiert" in einem
              Zähler: nach dem zweiten Upload derselben Datei stand hier
              „251 angelegt, 0 vorhanden" — die Zahl behauptete genau das
              Gegenteil ihrer Lage (die DB war korrekt). */}
          <div className="grid grid-cols-5 gap-2 text-center">
            {([
              ["importProgress.created", lauf.angelegt, "text-emerald-600"],
              ["importProgress.updated", lauf.aktualisiert, "text-sky-600"],
              // Bereits über den Portal-Feed da und bewusst belassen: die Datei
              // ist ärmer als der Feed (keine Gebühren-Aufstellung, kein
              // Buchungszeitpunkt). Eigene Kachel, damit die Zeilen nicht als
              // „ohne Wirkung" wirken — sie stehen vollständiger da als in der
              // Datei (31.08.2026: 54 überschriebene Feed-Buchungen).
              ["importProgress.portal", lauf.portal ?? 0, "text-violet-600"],
              ["importProgress.skipped", lauf.uebersprungen, "text-muted-foreground"],
              ["importProgress.failedRows", lauf.fehlerhaft, "text-destructive"],
            ] as const).map(([key, wert, farbe]) => (
              <div key={key} className="rounded-lg border p-2">
                <div className={`text-lg font-semibold tabular-nums ${farbe}`}>
                  {wert}
                </div>
                <div className="text-xs text-muted-foreground">{t(key)}</div>
              </div>
            ))}
          </div>

          {laeuft && (
            <p className="text-xs text-muted-foreground">
              {t("importProgress.mayClose")}
            </p>
          )}

          {lauf.fehler && (
            <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
              {lauf.fehler}
            </p>
          )}

          {/* Gescheiterte Zeilen namentlich — der Betrieb muss wissen, WAS er
              in der Datei nachbessern soll (Wurzel 5: kein stilles
              Überspringen). Gedeckelt, damit 200 Fehler den Dialog nicht
              sprengen; die Gesamtzahl steht in der Kachel darüber. */}
          {lauf.gescheitert.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border p-2 text-xs">
              <ul className="flex flex-col gap-1">
                {lauf.gescheitert.slice(0, 20).map((g, i) => (
                  <li key={i} className="text-muted-foreground">
                    {g.grund}
                  </li>
                ))}
              </ul>
              {lauf.gescheitert.length > 20 && (
                <p className="mt-1 text-muted-foreground">
                  {t("importProgress.andMore", {
                    count: lauf.gescheitert.length - 20,
                  })}
                </p>
              )}
            </div>
          )}

          {!laeuft && (
            <Button onClick={() => setLauf(null)} className="self-end">
              {t("importProgress.close")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
