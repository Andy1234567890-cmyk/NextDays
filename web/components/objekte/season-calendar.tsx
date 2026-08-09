"use client";

// Saisonpreise als Jahres-Kalender (12 Monate) mit benannten Saisons und
// Drag-and-Drop: eine Saison in der Legende wählen, dann über die Tage eines
// Monats ziehen → der Zeitraum wird der Saison zugewiesen und ihr effektiver
// Preis (Basispreis ±% oder Fixpreis) nach price_overrides materialisiert +
// an alle Buchungsportale (Channex) gepusht. Live via useRealtime.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@nextdays/ui/popover";
import type { ObjektAuswahlEintrag } from "@/components/objekt-mehrfachauswahl";
import { ZuAnderenObjekten } from "@/components/objekte/pricing/zu-anderen-objekten";
import {
  type Season,
  type SeasonAssignment,
  type SeasonMode,
  applySeasonToProperties,
  assignSeason,
  clearSeasonRange,
  createSeason,
  deleteSeason,
  listSeasons,
} from "@/lib/calendar";
import { formatCurrency } from "@/lib/currency";
import type { Property } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

// Vorschlagsfarben für neue Saisons (semantisch verteilt, gut unterscheidbar).
const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
// Wochentag-Index Mo=0 … So=6 für ein Datum.
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

// Für jeden Tag im Jahr: welche Saison-Farbe/Name gilt (letzte Zuweisung
// gewinnt — spätere überschreibt, wie beim Übermalen). Map ISO → {season, id}.
type DayInfo = { season: Season; assignment: SeasonAssignment };
function buildDayMap(seasons: Season[]): Map<string, DayInfo> {
  const map = new Map<string, DayInfo>();
  for (const season of seasons) {
    for (const a of season.assignments) {
      let cur = a.start_date;
      // end_date ist inklusiv.
      while (cur <= a.end_date) {
        map.set(cur, { season, assignment: a });
        cur = addDays(cur, 1);
      }
    }
  }
  return map;
}

export function SeasonCalendar({
  initial,
  currency,
  basePrice,
}: {
  initial: Property;
  currency: string | null;
  // Basispreis aus dem ersten Rate-Plan des Objekts — dieselbe Quelle, mit der
  // der Server die Prozent-Saisons materialisiert. Ohne Rate-Plan null: das
  // %-Label zeigt dann nur den Prozentsatz, keine erfundene 0,00.
  basePrice: number | null;
}) {
  const t = useTranslations("seasons");
  const months = t("months").split(",");
  const weekdays = t("weekdays").split(",");
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  // Saison, die gerade auf andere Objekte übertragen wird (null = Dialog zu).
  // Nur die ID, nicht das Objekt: ein Snapshot überlebte, was eine ANDERE
  // Session inzwischen an der Saison geändert hat. Wird sie dort gelöscht oder
  // auf `fixed` gestellt, stünde der Dialog weiter offen und sein Absenden
  // kassierte genau den 422, den der fehlende Knopf vermeiden soll.
  const [uebertragenId, setUebertragenId] = useState<string | null>(null);
  // Optimistische Überlagerung, bis der Serverstand da ist: season=null → die
  // Tage werden gelöst, sonst bekommen sie diese Saison.
  const [pending, setPending] = useState<
    { from: string; to: string; season: Season | null } | null
  >(null);
  // Laufende Drag-Auswahl: Start-ISO + aktuelles ISO, plus Richtung —
  // linke Maustaste weist zu, rechte löst die Tage wieder (mode "clear").
  type DragMode = "assign" | "clear";
  const drag = useRef<{ from: string; to: string; mode: DragMode } | null>(null);
  const [dragRange, setDragRange] = useState<
    { from: string; to: string; mode: DragMode } | null
  >(null);

  const load = useCallback(async () => {
    const res = await listSeasons(initial.id);
    if (res.ok) {
      setSeasons(res.data.items);
      setActiveSeasonId((prev) =>
        prev && res.data.items.some((s) => s.id === prev)
          ? prev
          : res.data.items[0]?.id ?? null,
      );
    }
  }, [initial.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: Saison-Änderungen anderer Sessions + resultierende Overrides.
  useRealtime({
    table: "property_season_assignments",
    filter: `property_id=eq.${initial.id}`,
    onChange: () => void load(),
  });
  useRealtime({
    table: "property_seasons",
    filter: `property_id=eq.${initial.id}`,
    onChange: () => void load(),
  });

  const dayMap = useMemo(() => {
    const map = buildDayMap(seasons);
    if (!pending) return map;
    // Die noch nicht bestätigte Aktion über den Serverstand legen.
    let cur = pending.from;
    while (cur <= pending.to) {
      if (pending.season) {
        const existing = map.get(cur);
        map.set(cur, {
          season: pending.season,
          // Die Zuweisungs-ID ist erst nach der Antwort bekannt; bis dahin die
          // bisherige weiterreichen (nur fürs Tooltip relevant).
          assignment: existing?.assignment ?? {
            id: "", season_id: pending.season.id, start_date: cur, end_date: cur,
          },
        });
      } else {
        map.delete(cur);
      }
      cur = addDays(cur, 1);
    }
    return map;
  }, [seasons, pending]);
  const activeSeason = seasons.find((s) => s.id === activeSeasonId) ?? null;
  // Bei JEDEM Render gegen die frische Liste auflösen (Muster activeSeasonId):
  // Realtime schiebt Änderungen anderer Sessions herein. Ist die Saison weg oder
  // inzwischen `fixed`, fällt das Ergebnis auf null und der Dialog schließt sich
  // von selbst — statt ein Absenden anzubieten, das der Server mit 422 ablehnt.
  const uebertragenSeason =
    seasons.find((s) => s.id === uebertragenId && s.mode === "percent") ?? null;

  // Preis-Label einer Saison (Fix oder ±% mit optionaler Basispreis-Vorschau).
  function priceLabel(s: Season): string {
    if (s.mode === "fixed") {
      return formatCurrency(s.amount, currency) || String(s.amount);
    }
    const sign = s.amount >= 0 ? "+" : "";
    const pct = `${sign}${s.amount}%`;
    if (basePrice != null) {
      const eff = Math.round(basePrice * (1 + s.amount / 100) * 100) / 100;
      return `${pct} · ${formatCurrency(eff, currency) || eff}`;
    }
    return pct;
  }

  // -- Drag-and-Drop über die Tage eines Monats ---------------------------
  function onDayDown(isoDate: string, mode: DragMode) {
    if (mode === "assign" && !activeSeasonId) {
      toast.error(t("seasonPickFirst"));
      return;
    }
    drag.current = { from: isoDate, to: isoDate, mode };
    setDragRange({ from: isoDate, to: isoDate, mode });
  }
  function onDayEnter(isoDate: string) {
    if (!drag.current) return;
    drag.current = { ...drag.current, to: isoDate };
    setDragRange({ ...drag.current, to: isoDate });
  }
  const onUp = useCallback(async () => {
    const d = drag.current;
    drag.current = null;
    setDragRange(null);
    if (!d) return;
    const lo = d.from < d.to ? d.from : d.to;
    const hi = d.from < d.to ? d.to : d.from;
    const end = addDays(hi, 1); // end exklusiv
    // Sofort anzeigen, was passieren wird. Der Request läuft parallel; der
    // Serverstand ersetzt die Überlagerung beim nächsten load(). Ohne das
    // blieben die Tage bis zur Antwort unverändert und sprangen dann um.
    const season = seasons.find((s) => s.id === activeSeasonId) ?? null;
    if (d.mode === "clear") setPending({ from: lo, to: hi, season: null });
    else if (season) setPending({ from: lo, to: hi, season });
    const res =
      d.mode === "clear"
        ? await clearSeasonRange({ property_id: initial.id, start: lo, end })
        : activeSeasonId
          ? await assignSeason({
              property_id: initial.id,
              season_id: activeSeasonId,
              start: lo,
              end,
            })
          : null;
    if (!res) {
      setPending(null);
      return;
    }
    if (res.ok) {
      toast.success(
        d.mode === "clear"
          ? t("seasonDaysCleared", { count: res.data.days })
          : t("seasonDaysAssigned", { count: res.data.days }),
      );
      await load();
    } else {
      toast.error(res.error);
    }
    setPending(null);
  }, [activeSeasonId, initial.id, load, seasons, t]);

  // Maus-Loslassen global abfangen (auch außerhalb einer Kachel).
  useEffect(() => {
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [onUp]);

  // Tag in der laufenden Drag-Auswahl? Gibt den Modus zurück (für die Optik:
  // Zuweisen umrandet in Akzent, Löschen in Destructive).
  function inDragRange(isoDate: string): DragMode | null {
    if (!dragRange) return null;
    const lo = dragRange.from < dragRange.to ? dragRange.from : dragRange.to;
    const hi = dragRange.from < dragRange.to ? dragRange.to : dragRange.from;
    return isoDate >= lo && isoDate <= hi ? dragRange.mode : null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">{t("seasonPageTitle")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>
            <Icon icon="ph:caret-left" className="size-4" />
          </Button>
          <span className="min-w-16 text-center font-display text-xl font-bold">
            {year}
          </span>
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)}>
            <Icon icon="ph:caret-right" className="size-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{t("seasonPageSubtitle")}</p>

      <div className="flex flex-col gap-6 lg:flex-row-reverse">
        {/* Legende + Saison-Verwaltung (rechts wie Lodgify) */}
        <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-72">
          <SeasonEditor
            propertyId={initial.id}
            currency={currency}
            basePrice={basePrice}
            onCreated={(s) => {
              setSeasons((prev) => [...prev, s]);
              setActiveSeasonId(s.id);
            }}
          />
          {seasons.length === 0 ? (
            <p className="rounded-(--radius) border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              {t("seasonEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {seasons.map((s) => (
                <li key={s.id}>
                  <div
                    // pr kleiner als pl: rechts stehen zwei Icon-Knöpfe, deren
                    // eigene Klickfläche schon Luft mitbringt. Mit dem vollen
                    // px-3 drückten sie sichtbar über die Pill-Rundung hinaus.
                    className={`flex items-center gap-1.5 rounded-full border py-2 pl-3 pr-1.5 text-sm transition-colors ${
                      activeSeasonId === s.id
                        ? "border-accent bg-accent/10"
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSeasonId(s.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className="size-3.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="flex-1 truncate font-medium">{s.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {priceLabel(s)}
                      </span>
                    </button>
                    {/* Übertragen rechnet am Ziel gegen dessen EIGENEN
                        Basispreis — das geht nur prozentual. Ein Fixbetrag ist
                        objektspezifisch, deshalb steht der Knopf dort gar nicht
                        erst (statt ihn anzubieten und dann 422 zu kassieren). */}
                    {s.mode === "percent" && (
                      <button
                        type="button"
                        aria-label={t("seasonApplyToOthers")}
                        title={t("seasonApplyToOthers")}
                        className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        onClick={() => setUebertragenId(s.id)}
                      >
                        <Icon icon="ph:copy" className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t("seasonDelete")}
                      className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                      onClick={async () => {
                        const res = await deleteSeason(s.id);
                        if (res.ok) void load();
                        else toast.error(res.error);
                      }}
                    >
                      <Icon icon="ph:trash" className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {activeSeason && (
            <p className="mt-1 rounded-(--radius) bg-secondary/50 p-2 text-center text-xs text-muted-foreground">
              {t("seasonDragHintPrefix")}<b>{activeSeason.name}</b>{t("seasonDragHintSuffix")}
            </p>
          )}
          {seasons.length > 0 && (
            <p className="rounded-(--radius) bg-secondary/50 p-2 text-center text-xs text-muted-foreground">
              {t("seasonClearHint")}
            </p>
          )}
        </aside>

        {/* 12-Monats-Gitter */}
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {months.map((label, m) => (
            <MonthGrid
              key={m}
              year={year}
              month={m}
              label={label}
              weekdays={weekdays}
              dayMap={dayMap}
              inDragRange={inDragRange}
              onDayDown={onDayDown}
              onDayEnter={onDayEnter}
            />
          ))}
        </div>
      </div>

      {uebertragenSeason && (
        <UebertragenDialog
          propertyId={initial.id}
          season={uebertragenSeason}
          onClose={() => setUebertragenId(null)}
        />
      )}
    </div>
  );
}

// -- Saison auf andere Objekte übertragen (Dialog) ---------------------------
// Kopie, keine Anbindung: am Ziel entsteht eine eigenständige Saison. Das steht
// im Dialog als Satz, weil der Nutzer sonst eine dauerhafte Verknüpfung erwartet.
function UebertragenDialog({
  propertyId,
  season,
  onClose,
}: {
  propertyId: string;
  season: Season;
  onClose: () => void;
}) {
  const t = useTranslations("seasons");
  const [ziele, setZiele] = useState<string[]>([]);
  const [mitZeitraeumen, setMitZeitraeumen] = useState(true);
  const [saving, setSaving] = useState(false);
  // Die Objektliste, die die Auswahl ohnehin lädt — hier nur, um die
  // übersprungenen Ziele beim NAMEN zu nennen. Eine nackte UUID sagt dem
  // Betrieb nicht, welches seiner 18 Häuser er ansehen muss.
  const [objekte, setObjekte] = useState<ObjektAuswahlEintrag[]>([]);

  // Grund-Slug des Servers in einen Satz übersetzen. Ein UNBEKANNTER Slug (neuer
  // Backend-Grund, den die UI noch nicht kennt) fällt auf einen generischen Text
  // zurück, statt next-intl mit MISSING_MESSAGE die Seite zerlegen zu lassen.
  const bekannteGruende = [
    "kein_basispreis",
    "basispreis_null",
    "teilweise_uebertragen",
  ];
  function grundText(grund: string): string {
    return bekannteGruende.includes(grund)
      ? t(`seasonApplySkipReason.${grund}`)
      : t("seasonApplySkipReason.unbekannt");
  }
  function objektName(propertyId: string): string {
    return (
      objekte.find((o) => o.id === propertyId)?.title ??
      // Die Liste kennt das Objekt nicht (gerade gelöscht, Rechte geändert):
      // dann ist die ID das einzig Wahre, das wir sagen können — kein erfundener
      // Platzhaltername.
      propertyId
    );
  }

  // Eine Saison OHNE bemalte Zeiträume kann „mit Zeiträumen" nichts übertragen —
  // der Server weist genau das mit 422 ab. Der Dialog kennt die Zuweisungen
  // bereits, also wird der Fall hier gezeigt, statt den Betrieb erst Objekte
  // auswählen und absenden zu lassen und ihm dann einen Serverfehler zu geben.
  const ohneZeitraeume = season.assignments.length === 0;

  async function submit() {
    if (ziele.length === 0) {
      toast.error(t("seasonApplyPickTarget"));
      return;
    }
    setSaving(true);
    // Ohne bemalte Zeiträume gibt es nur den Weg „nur die Definition". Den
    // Zustand des Häkchens hier NICHT mitzusenden ist der Punkt: es ist
    // vorbelegt an und in diesem Fall gar nicht sichtbar — ungeprüft
    // durchgereicht liefe der Aufruf in genau die 422, die der Hinweis oben
    // gerade vermeiden soll.
    const res = await applySeasonToProperties(
      season.id,
      ziele,
      ohneZeitraeume ? false : mitZeitraeumen,
    );
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { uebertragen, uebersprungen } = res.data;
    // Je übersprungenem Ziel EINE Zeile „Objektname: Grund". Vorher stand hier
    // der rohe Slug, dreimal aneinandergereiht („kein_basispreis ·
    // kein_basispreis · …") — daraus konnte niemand ablesen, welches Objekt
    // gemeint ist (Wurzel 5).
    const details = uebersprungen
      .map((u) => `${objektName(u.property_id)}: ${grundText(u.grund)}`)
      .join("\n");
    if (uebertragen === 0) {
      // Kein einziges Ziel bedient — das ist kein Erfolg. Ein grünes „Auf 0
      // Objekt(e) übertragen" hätte der Betrieb als erledigt abgehakt.
      toast.error(t("seasonApplyNone"), { description: details || undefined });
      return; // Dialog bleibt offen: die Auswahl ist noch zu korrigieren.
    }
    if (uebersprungen.length > 0) {
      toast.warning(
        t("seasonApplyPartial", {
          count: uebertragen,
          skipped: uebersprungen.length,
        }),
        { description: details },
      );
    } else {
      toast.success(t("seasonApplySuccess", { count: uebertragen }));
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <DialogTitle>
              {t("seasonApplyTitle", { name: season.name })}
            </DialogTitle>
            <DialogDescription>{t("seasonApplyCopyHint")}</DialogDescription>
          </div>

          <ZuAnderenObjekten
            propertyId={propertyId}
            kind="season"
            selected={ziele}
            onChange={setZiele}
            onLoaded={setObjekte}
          />

          {ohneZeitraeume ? (
            <p className="text-sm text-muted-foreground">
              {t("seasonApplyNoSpans")}
            </p>
          ) : (
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox
                checked={mitZeitraeumen}
                onCheckedChange={(v) => setMitZeitraeumen(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">
                  {t("seasonApplyWithRanges")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("seasonApplyWithRangesHint")}
                </span>
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {t("seasonApplyCancel")}
            </Button>
            <Button onClick={submit} disabled={saving || ziele.length === 0}>
              {saving ? t("seasonSaving") : t("seasonApplySubmit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -- Ein Monats-Gitter -------------------------------------------------------
function MonthGrid({
  year,
  month,
  label,
  weekdays,
  dayMap,
  inDragRange,
  onDayDown,
  onDayEnter,
}: {
  year: number;
  month: number;
  label: string;
  weekdays: string[];
  dayMap: Map<string, DayInfo>;
  inDragRange: (isoDate: string) => "assign" | "clear" | null;
  onDayDown: (isoDate: string, mode: "assign" | "clear") => void;
  onDayEnter: (isoDate: string) => void;
}) {
  const t = useTranslations("seasons");
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = mondayIndex(first); // Leerzellen vor dem 1.

  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(iso(new Date(Date.UTC(year, month, d))));
  }

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="mb-1 text-center text-sm font-semibold">{label}</div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[0.6rem] text-muted-foreground">
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {cells.map((isoDate, i) => {
          if (!isoDate) return <span key={`e${i}`} />;
          const info = dayMap.get(isoDate);
          const day = Number(isoDate.slice(8, 10));
          const selecting = inDragRange(isoDate);
          return (
            <button
              key={isoDate}
              type="button"
              // Rechte Taste = löschen; das native Kontextmenü unterdrückt
              // onContextMenu, der Bereich entsteht per Rechts-Drag.
              onMouseDown={(e) => {
                if (e.button === 2) onDayDown(isoDate, "clear");
                else if (e.button === 0) onDayDown(isoDate, "assign");
              }}
              onContextMenu={(e) => e.preventDefault()}
              onMouseEnter={() => onDayEnter(isoDate)}
              title={
                info
                  ? t("seasonRemoveTitle", { name: info.season.name })
                  : undefined
              }
              className={`flex aspect-square items-center justify-center rounded text-xs transition-[outline] ${
                selecting === "clear"
                  ? "outline outline-2 outline-destructive"
                  : selecting === "assign"
                    ? "outline outline-2 outline-accent"
                    : ""
              } ${info ? "font-medium text-white" : "hover:bg-secondary"}`}
              style={info ? { backgroundColor: info.season.color } : undefined}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// -- Neue Saison anlegen (Popover) ------------------------------------------
function SeasonEditor({
  propertyId,
  currency,
  basePrice,
  onCreated,
}: {
  propertyId: string;
  currency: string | null;
  basePrice: number | null;
  onCreated: (s: Season) => void;
}) {
  const t = useTranslations("seasons");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<SeasonMode>("percent");
  const [amount, setAmount] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const amt = Number(amount);
    if (!name.trim()) {
      toast.error(t("seasonNameRequired"));
      return;
    }
    if (Number.isNaN(amt) || (mode === "fixed" && amt < 0)) {
      toast.error(t("seasonValueRequired"));
      return;
    }
    setSaving(true);
    const res = await createSeason({
      property_id: propertyId,
      name: name.trim(),
      color,
      mode,
      amount: amt,
    });
    setSaving(false);
    if (res.ok) {
      onCreated(res.data);
      setName("");
      setAmount("");
      setOpen(false);
    } else {
      toast.error(res.error);
    }
  }

  const preview =
    mode === "percent" && basePrice != null && amount !== ""
      ? formatCurrency(
          Math.round(basePrice * (1 + Number(amount) / 100) * 100) / 100,
          currency,
        )
      : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button className="w-full gap-2">
          <Icon icon="ph:plus" className="size-4" />
          {t("seasonAdd")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="season-name">{t("name")}</Label>
            <Input
              id="season-name"
              placeholder={t("seasonNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("seasonPriceRule")}</Label>
            <div className="flex gap-1 rounded-full border border-border p-0.5">
              {(["percent", "fixed"] as SeasonMode[]).map((mo) => (
                <button
                  key={mo}
                  type="button"
                  onClick={() => setMode(mo)}
                  className={`flex-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    mode === mo
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {mo === "percent" ? t("seasonSurcharge") : t("seasonFixed")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="season-amount">
              {mode === "percent" ? t("seasonSurchargeLabel") : t("seasonPriceLabel")}
            </Label>
            <Input
              id="season-amount"
              type="number"
              placeholder={
                mode === "percent"
                  ? t("seasonSurchargePlaceholder")
                  : t("seasonPricePlaceholder")
              }
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {preview && (
              <p className="text-xs text-muted-foreground">
                {t("seasonEffective")}{preview}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("seasonColor")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={t("seasonColorAria", { color: c })}
                  onClick={() => setColor(c)}
                  className={`size-6 rounded-full transition-transform ${
                    color === c ? "scale-110 ring-2 ring-foreground ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? t("seasonSaving") : t("seasonCreate")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
