"use client";

// Filter der Auswertung — Hostaways Muster seit 2025: EIN Knopf „Filter (n)"
// öffnet ein Panel mit den Dimensionen links und der Auswahl rechts, „Reset"
// und „Übernehmen" unten. Die aktive Auswahl steht daneben als Chips.
//
// WARUM EIN PANEL UND KEINE FELDREIHE MEHR: die Leiste trug sieben Felder
// (Zeitraum, Von, Bis, Zuordnung, Vergleich, Objekte, Kanäle) — auf dem
// Laptop zwei Zeilen, auf dem Telefon vier. Hostaway hat denselben Weg
// genommen („Filters 4" statt der Feldreihe), weil die Zahl der Dimensionen
// wächst: Status kam dazu, Tags kommen.
//
// ÜBERNEHMEN, NICHT LIVE: jede Änderung im Panel ist ein Entwurf. Erst
// „Übernehmen" löst den Abruf aus — sonst rechnete das Backend bei jedem
// Häkchen einen ganzen Bericht (bis 5 000 Buchungen, zweimal bei Vergleich).
//
// Der BEZUGSZEITPUNKT bleibt gleichrangig: er entscheidet, welcher Buchung
// welcher Monat zugerechnet wird, und ändert damit JEDE Zahl der Seite.
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@nextdays/ui/popover";
import type { Bezug, Schnell, Vergleich } from "@/lib/auswertung-typen";
import { SCHNELLWAHL, STATUS_WERTE, VERGLEICHE } from "@/lib/auswertung-typen";

export type FilterStand = {
  von: string;
  bis: string;
  /** Der Schnellwahl-Schlüssel, solange der Zeitraum daraus stammt; `null`
   *  nach einer Handeingabe. Gespeicherte Ansichten halten den SCHLÜSSEL. */
  schnell: Schnell | null;
  bezug: Bezug;
  propertyIds: string[];
  channels: string[];
  status: string[];
  vergleich: Vergleich;
};

/** Ab welcher Zeitraumlänge das Backend den Vergleich ablehnt (422).
 *
 *  Muss zu `MAX_TAGE_VERGLEICH` in `apps/api/.../auswertung/service.py`
 *  passen: ein Vergleich rechnet den ganzen Bericht zweimal, ein 5-Jahres-
 *  Zeitraum wäre damit der doppelte Vollscan. Die Oberfläche sperrt die
 *  Auswahl deshalb VORHER und sagt warum — einen 422 abzuwarten hieße, den
 *  Nutzer gegen eine Wand laufen zu lassen. */
const MAX_TAGE_VERGLEICH = 366;

function spanneTage(von: string, bis: string): number {
  const a = Date.parse(von);
  const b = Date.parse(bis);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Ob der Zeitraum kurz genug für einen Vergleich ist. */
export function vergleichMoeglich(von: string, bis: string): boolean {
  return spanneTage(von, bis) <= MAX_TAGE_VERGLEICH;
}

const iso = (d: Date) => {
  // Lokale Zeitzone, nicht toISOString() — das rechnet nach UTC um und
  // liefert östlich von Greenwich den Vortag.
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
};

/** Schnellwahl auflösen — IMMER von heute aus. Eine gespeicherte Ansicht
 *  „Vormonat" meint den Vormonat des Tages, an dem man sie öffnet. */
export function zeitraumAufloesen(art: Schnell): { von: string; bis: string } {
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  const tag = (versatz: number) => {
    const d = new Date(h);
    d.setDate(d.getDate() + versatz);
    return d;
  };
  switch (art) {
    case "monat":
      return {
        von: iso(new Date(h.getFullYear(), h.getMonth(), 1)),
        bis: iso(new Date(h.getFullYear(), h.getMonth() + 1, 0)),
      };
    case "vormonat":
      return {
        von: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
        bis: iso(new Date(h.getFullYear(), h.getMonth(), 0)),
      };
    case "quartal": {
      const q = Math.floor(h.getMonth() / 3) * 3;
      return {
        von: iso(new Date(h.getFullYear(), q, 1)),
        bis: iso(new Date(h.getFullYear(), q + 3, 0)),
      };
    }
    case "jahr":
      return {
        von: iso(new Date(h.getFullYear(), 0, 1)),
        bis: iso(new Date(h.getFullYear(), 11, 31)),
      };
    case "vorjahr":
      return {
        von: iso(new Date(h.getFullYear() - 1, 0, 1)),
        bis: iso(new Date(h.getFullYear() - 1, 11, 31)),
      };
    case "letzte30":
      return { von: iso(tag(-29)), bis: iso(h) };
    case "naechste30":
      return { von: iso(h), bis: iso(tag(29)) };
    case "letzte12monate":
      return {
        von: iso(new Date(h.getFullYear() - 1, h.getMonth() + 1, 1)),
        bis: iso(new Date(h.getFullYear(), h.getMonth() + 1, 0)),
      };
    case "naechste12monate":
      return {
        von: iso(new Date(h.getFullYear(), h.getMonth(), 1)),
        bis: iso(new Date(h.getFullYear() + 1, h.getMonth(), 0)),
      };
  }
}

const BEZUEGE: readonly Bezug[] = ["anreise", "abreise", "buchung", "uebernachtung"];

type Dimension = "zeitraum" | "bezug" | "objekte" | "kanaele" | "status" | "vergleich";
const DIMENSIONEN: readonly { key: Dimension; icon: string }[] = [
  { key: "zeitraum", icon: "ph:calendar-blank" },
  { key: "bezug", icon: "ph:target" },
  { key: "objekte", icon: "ph:house" },
  { key: "kanaele", icon: "ph:share-network" },
  { key: "status", icon: "ph:tag" },
  { key: "vergleich", icon: "ph:chart-line" },
];

/** Wie viele Dimensionen vom Standard abweichen — die Zahl am Knopf. */
export function aktiveFilter(s: FilterStand): number {
  let n = 0;
  if (s.propertyIds.length) n += 1;
  if (s.channels.length) n += 1;
  if (s.status.length) n += 1;
  if (s.bezug !== "anreise") n += 1;
  if (s.vergleich !== "keiner") n += 1;
  return n;
}

export function Filterleiste({
  stand,
  setzen,
  objekte,
  kanaele,
  laedt,
}: {
  stand: FilterStand;
  setzen: (s: FilterStand) => void;
  objekte: readonly { value: string; label: string }[];
  kanaele: readonly { value: string; label: string }[];
  laedt: boolean;
}) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const [offen, setOffen] = useState(false);
  const [dim, setDim] = useState<Dimension>("zeitraum");
  const [entwurf, setEntwurf] = useState<FilterStand>(stand);
  const [suche, setSuche] = useState("");

  // Beim Öffnen den aktuellen Stand als Entwurf übernehmen — sonst zeigte das
  // Panel einen Entwurf, den man beim letzten Mal verworfen hat.
  useEffect(() => {
    if (offen) setEntwurf(stand);
  }, [offen, stand]);

  const vergleichGesperrt = !vergleichMoeglich(entwurf.von, entwurf.bis);
  const geaendert = JSON.stringify(entwurf) !== JSON.stringify(stand);

  function uebernehmen() {
    setzen(
      vergleichMoeglich(entwurf.von, entwurf.bis)
        ? entwurf
        : { ...entwurf, vergleich: "keiner" },
    );
    setOffen(false);
  }

  function zuruecksetzen() {
    const z = zeitraumAufloesen("monat");
    setEntwurf({
      ...z,
      schnell: "monat",
      bezug: "anreise",
      propertyIds: [],
      channels: [],
      status: [],
      vergleich: "keiner",
    });
  }

  const datum = (s: string) =>
    s ? new Date(`${s}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  const objektSuche = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return q ? objekte.filter((o) => o.label.toLowerCase().includes(q)) : objekte;
  }, [objekte, suche]);

  const umschalten = (liste: string[], wert: string) =>
    liste.includes(wert) ? liste.filter((x) => x !== wert) : [...liste, wert];

  /** Kurztext einer Dimension unter ihrem Namen im linken Menü. */
  const kurz = (d: Dimension): string => {
    switch (d) {
      case "zeitraum":
        return entwurf.schnell
          ? t(`range.${entwurf.schnell}`)
          : `${datum(entwurf.von)} – ${datum(entwurf.bis)}`;
      case "bezug":
        return t(`basis.${entwurf.bezug}`);
      case "objekte":
        return entwurf.propertyIds.length
          ? t("filter.nSelected", { count: entwurf.propertyIds.length })
          : t("filter.allProperties");
      case "kanaele":
        return entwurf.channels.length
          ? t("filter.nSelected", { count: entwurf.channels.length })
          : t("filter.allChannels");
      case "status":
        return entwurf.status.length
          ? t("filter.nSelected", { count: entwurf.status.length })
          : t("filter.allStatuses");
      case "vergleich":
        return t(`compare.${entwurf.vergleich}`);
    }
  };

  const anzahl = aktiveFilter(stand);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={offen} onOpenChange={setOffen}>
          <PopoverTrigger asChild>
            <Button type="button" variant={anzahl ? "default" : "outline"} size="sm" disabled={laedt && !offen}>
              <Icon icon="ph:funnel" className="size-4" />
              {t("filter.button")}
              {anzahl > 0 && (
                <span className="ml-1 rounded-full bg-background/20 px-1.5 text-xs tabular-nums">
                  {anzahl}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(92vw,44rem)] p-0">
            <div className="flex max-h-[70vh] min-h-72">
              {/* Links: die Dimensionen mit ihrem aktuellen Wert. */}
              <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border p-2">
                {DIMENSIONEN.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDim(d.key)}
                    className={
                      "flex flex-col items-start rounded-md px-2.5 py-2 text-left transition-colors " +
                      (dim === d.key ? "bg-accent/10" : "hover:bg-muted")
                    }
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon icon={d.icon} className="size-3.5 text-muted-foreground" />
                      {t(`filter.dim.${d.key}`)}
                    </span>
                    <span className="truncate text-xs text-accent">{kurz(d.key)}</span>
                  </button>
                ))}
              </nav>

              {/* Rechts: die Auswahl der gewählten Dimension. */}
              <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                {dim === "zeitraum" && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("filter.range")}
                      </span>
                      <NativeSelect
                        value={entwurf.schnell ?? "frei"}
                        onChange={(e) => {
                          const v = e.target.value as Schnell | "frei";
                          if (v === "frei") return;
                          setEntwurf({ ...entwurf, ...zeitraumAufloesen(v), schnell: v });
                        }}
                      >
                        {entwurf.schnell === null && (
                          <option value="frei">{t("range.frei")}</option>
                        )}
                        {SCHNELLWAHL.map((s) => (
                          <option key={s} value={s}>
                            {t(`range.${s}`)}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("filter.from")}
                        </span>
                        <DatePicker
                          value={entwurf.von}
                          onChange={(v) => setEntwurf({ ...entwurf, von: v, schnell: null })}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("filter.to")}
                        </span>
                        <DatePicker
                          value={entwurf.bis}
                          onChange={(v) => setEntwurf({ ...entwurf, bis: v, schnell: null })}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("filter.rangeHint")}</p>
                  </>
                )}

                {dim === "bezug" && (
                  <div className="flex flex-col gap-1">
                    {BEZUEGE.map((b) => (
                      <label
                        key={b}
                        className={
                          "flex cursor-pointer flex-col rounded-md border px-3 py-2 " +
                          (entwurf.bezug === b ? "border-accent bg-accent/5" : "border-border hover:bg-muted")
                        }
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="radio"
                            name="bezug"
                            className="accent-current"
                            checked={entwurf.bezug === b}
                            onChange={() => setEntwurf({ ...entwurf, bezug: b })}
                          />
                          {t(`basis.${b}`)}
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">
                          {t(`basisHint.${b}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {dim === "objekte" && (
                  <>
                    <Input
                      value={suche}
                      onChange={(e) => setSuche(e.target.value)}
                      placeholder={t("filter.searchProperties")}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {entwurf.propertyIds.length
                          ? t("filter.nSelected", { count: entwurf.propertyIds.length })
                          : t("filter.allProperties")}
                      </span>
                      {entwurf.propertyIds.length > 0 && (
                        <button
                          type="button"
                          className="text-accent hover:underline"
                          onClick={() => setEntwurf({ ...entwurf, propertyIds: [] })}
                        >
                          {t("filter.clear")}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {objektSuche.map((o) => (
                        <label
                          key={o.value}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={entwurf.propertyIds.includes(o.value)}
                            onCheckedChange={() =>
                              setEntwurf({
                                ...entwurf,
                                propertyIds: umschalten(entwurf.propertyIds, o.value),
                              })
                            }
                          />
                          <span className="truncate">{o.label}</span>
                        </label>
                      ))}
                      {!objektSuche.length && (
                        <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                          {t("filter.noMatch")}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {dim === "kanaele" && (
                  <div className="flex flex-col gap-0.5">
                    {kanaele.map((k) => (
                      <label
                        key={k.value}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          checked={entwurf.channels.includes(k.value)}
                          onCheckedChange={() =>
                            setEntwurf({ ...entwurf, channels: umschalten(entwurf.channels, k.value) })
                          }
                        />
                        {k.label}
                      </label>
                    ))}
                  </div>
                )}

                {dim === "status" && (
                  <div className="flex flex-col gap-0.5">
                    {STATUS_WERTE.map((s) => (
                      <label
                        key={s}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          checked={entwurf.status.includes(s)}
                          onCheckedChange={() =>
                            setEntwurf({ ...entwurf, status: umschalten(entwurf.status, s) })
                          }
                        />
                        {t(`status.${s}`)}
                      </label>
                    ))}
                    <p className="px-2 pt-2 text-xs text-muted-foreground">{t("filter.statusHint")}</p>
                  </div>
                )}

                {dim === "vergleich" && (
                  <div className="flex flex-col gap-1">
                    {VERGLEICHE.map((v) => (
                      <label
                        key={v}
                        className={
                          "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm " +
                          (entwurf.vergleich === v ? "border-accent bg-accent/5" : "border-border hover:bg-muted") +
                          (vergleichGesperrt && v !== "keiner" ? " opacity-50" : "")
                        }
                      >
                        <input
                          type="radio"
                          name="vergleich"
                          className="accent-current"
                          disabled={vergleichGesperrt && v !== "keiner"}
                          checked={(vergleichGesperrt ? "keiner" : entwurf.vergleich) === v}
                          onChange={() => setEntwurf({ ...entwurf, vergleich: v })}
                        />
                        {t(`compare.${v}`)}
                      </label>
                    ))}
                    {vergleichGesperrt && (
                      <p className="text-xs text-muted-foreground">{t("compareLocked")}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border p-3">
              <Button type="button" variant="ghost" size="sm" onClick={zuruecksetzen}>
                <Icon icon="ph:arrow-counter-clockwise" className="size-4" />
                {t("filter.reset")}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOffen(false)}>
                  {t("filter.cancel")}
                </Button>
                <Button type="button" size="sm" onClick={uebernehmen} disabled={!geaendert}>
                  {t("filter.apply")}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Die aktive Auswahl als Chips — lesbar ohne das Panel zu öffnen. */}
        <Chip icon="ph:calendar-blank">
          {stand.schnell ? t(`range.${stand.schnell}`) : null}
          {stand.schnell ? " · " : null}
          {datum(stand.von)} – {datum(stand.bis)}
        </Chip>
        <Chip icon="ph:target">{t(`basis.${stand.bezug}`)}</Chip>
        {stand.propertyIds.length > 0 && (
          <Chip icon="ph:house" loeschen={() => setzen({ ...stand, propertyIds: [] })}>
            {stand.propertyIds.length === 1
              ? objekte.find((o) => o.value === stand.propertyIds[0])?.label ?? "1"
              : t("filter.nProperties", { count: stand.propertyIds.length })}
          </Chip>
        )}
        {stand.channels.length > 0 && (
          <Chip icon="ph:share-network" loeschen={() => setzen({ ...stand, channels: [] })}>
            {stand.channels.map((c) => kanaele.find((k) => k.value === c)?.label ?? c).join(", ")}
          </Chip>
        )}
        {stand.status.length > 0 && (
          <Chip icon="ph:tag" loeschen={() => setzen({ ...stand, status: [] })}>
            {stand.status.map((s) => t(`status.${s}`)).join(", ")}
          </Chip>
        )}
        {stand.vergleich !== "keiner" && (
          <Chip icon="ph:chart-line" loeschen={() => setzen({ ...stand, vergleich: "keiner" })}>
            {t(`compare.${stand.vergleich}`)}
          </Chip>
        )}
        {laedt && (
          <Icon icon="ph:spinner" className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Was der gewählte Bezug bedeutet — ausgeschrieben, nicht als Tooltip.
          Wer „Buchungsdatum" wählt, muss wissen, dass Buchungen ohne echten
          Quell-Zeitstempel dann fehlen (Wurzel 5b). */}
      <p className="text-xs text-muted-foreground">{t(`basisHint.${stand.bezug}`)}</p>
    </div>
  );
}

function Chip({
  icon,
  children,
  loeschen,
}: {
  icon: string;
  children: React.ReactNode;
  loeschen?: () => void;
}) {
  return (
    <span className="inline-flex max-w-72 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs">
      <Icon icon={icon} className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
      {loeschen && (
        <button
          type="button"
          onClick={loeschen}
          className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="×"
        >
          <Icon icon="ph:x" className="size-3" />
        </button>
      )}
    </span>
  );
}
