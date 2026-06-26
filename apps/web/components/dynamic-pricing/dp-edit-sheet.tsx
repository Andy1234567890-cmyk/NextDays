"use client";

// Basispreis-Slider (Hostaway-„Set your base rate"): pro Objekt die Basispreis-
// Strategie wählen — Datengetrieben (Konservativ/Empfohlen/Aggressiv) oder
// Manuell (eigener Basispreis) — plus Mindest-/Höchstpreis und (eingeklappt) die
// erweiterten Regeln (Wochenende/Auslastung/Last-Minute/Orphan/Markt). Lädt die
// vollständigen Einstellungen beim Öffnen und speichert per PUT.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/currency";
import {
  type BaseRateMode,
  type DpOverviewItem,
  type DpSettings,
  getDpSettings,
  type LastMinuteRule,
  type RateRule,
  saveDpSettings,
} from "@/lib/dynamic-pricing";

const RATE_MODES: {
  value: BaseRateMode;
  title: string;
  hint: string;
  info: string;
}[] = [
  {
    value: "conservative",
    title: "Konservativ",
    hint: "Passt sich an Markt und Buchungslage an, bleibt aber zurückhaltender als „Empfohlen“.",
    info: "Vorsichtige Strategie: Preise schwanken weniger stark nach oben und unten. Du verlierst seltener Buchungen durch hohe Preise, lässt aber an Spitzentagen etwas Umsatz liegen.",
  },
  {
    value: "recommended",
    title: "Empfohlen",
    hint: "Passt sich an Markt und Buchungslage an.",
    info: "Ausgewogene Standard-Strategie: die Engine reagiert normal stark auf Nachfrage und Markt. Für die meisten Objekte die beste Wahl.",
  },
  {
    value: "aggressive",
    title: "Aggressiv",
    hint: "Passt sich an Markt und Buchungslage an, aber offensiver als „Empfohlen“.",
    info: "Offensive Strategie: Preise schwanken stärker. An gefragten Tagen holst du mehr Umsatz, riskierst aber, dass zu hohe Preise einzelne Buchungen kosten.",
  },
];

export function DpEditSheet({
  item,
  onClose,
  onSaved,
}: {
  item: DpOverviewItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [s, setS] = useState<DpSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    let active = true;
    getDpSettings(item.property_id).then((res) => {
      if (!active) return;
      if (res.ok) setS(res.data);
      else setLoadError(res.error);
    });
    return () => {
      active = false;
    };
  }, [item.property_id]);

  function set<K extends keyof DpSettings>(key: K, value: DpSettings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!s) return;
    setBusy(true);
    setMsg(null);
    const res = await saveDpSettings(item.property_id, {
      enabled: s.enabled,
      base_mode: s.base_mode,
      base_rate_mode: s.base_rate_mode,
      manual_base_price: s.manual_base_price,
      min_price: s.min_price,
      max_price: s.max_price,
      weekend_uplift_pct: s.weekend_uplift_pct,
      occupancy_sensitivity: s.occupancy_sensitivity,
      orphan_gap_discount_pct: s.orphan_gap_discount_pct,
      last_minute: s.last_minute,
      min_stay_min: s.min_stay_min,
      min_stay_max: s.min_stay_max,
      market_enabled: s.market_enabled,
      market_sensitivity: s.market_sensitivity,
      market_max_adjust_pct: s.market_max_adjust_pct,
      market_key: s.market_key,
      comp_refs: s.comp_refs,
      autopilot_enabled: s.autopilot_enabled ?? false,
      weather_enabled: s.weather_enabled ?? false,
      weather_max_adjust_pct: s.weather_max_adjust_pct ?? 10,
      rate_rules: s.rate_rules ?? [],
    });
    setBusy(false);
    if (res.ok) {
      onSaved();
    } else {
      setMsg(res.error);
    }
  }

  const cur = item.currency;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Basispreis festlegen</SheetTitle>
          <SheetDescription>{item.title}</SheetDescription>
        </SheetHeader>

        {loadError && (
          <p className="px-4 text-sm text-destructive">{loadError}</p>
        )}

        {!s && !loadError && (
          <p className="px-4 text-sm text-muted-foreground">Lädt…</p>
        )}

        {s && (
          <div className="flex flex-col gap-6 p-4">
            {/* Aktiv-Schalter */}
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="leading-tight">
                <span className="flex items-center gap-1.5 font-semibold">
                  Dynamic Pricing aktiv
                  <InfoHint text="Ist dies an, berechnet die Engine die Tagespreise dieses Objekts automatisch und überschreibt den festen Grundpreis. Ein im Kalender manuell gesetzter Tagespreis hat trotzdem immer Vorrang." />
                </span>
                <span className="block text-sm text-muted-foreground">
                  Standardmäßig aus — du entscheidest pro Objekt.
                </span>
              </span>
              <Switch
                checked={s.enabled}
                onCheckedChange={(c) => set("enabled", c)}
              />
            </label>

            {/* Autopilot — nur sinnvoll, wenn DP überhaupt an ist */}
            {s.enabled && (
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="leading-tight">
                  <span className="flex items-center gap-1.5 font-semibold">
                    Autopilot
                    <InfoHint text="Ist Autopilot an, werden die berechneten Preise automatisch an alle Kanäle (eigene Plattform + OTAs) geschickt. Ist er aus, berechnet die Engine die Preise weiterhin und zeigt sie als Vorschau/Empfehlung — veröffentlicht werden sie aber erst, wenn du es freigibst." />
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Preise automatisch veröffentlichen statt nur empfehlen.
                  </span>
                </span>
                <Switch
                  checked={s.autopilot_enabled}
                  onCheckedChange={(c) => set("autopilot_enabled", c)}
                />
              </label>
            )}

            {/* Basispreis-Modus */}
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-1.5">
                Basispreis
                <InfoHint text="Der Ausgangspreis (Anker), auf den alle Regeln wie Wochenende, Auslastung oder Markt rechnen. Du wählst, ob die Engine ihn automatisch ermittelt (Datengetrieben) oder du ihn selbst setzt (Manuell)." />
              </Label>
              <RadioRow
                checked={s.base_mode === "data_driven"}
                title="Datengetrieben"
                hint="Informiert durch unsere Engine, laufend aktualisiert."
                info="Die Engine ermittelt den Basispreis automatisch aus deinem Grundpreis und passt ihn laufend an Nachfrage, Saison und Markt an. Du musst keinen festen Preis vorgeben."
                onSelect={() => set("base_mode", "data_driven")}
              />
              {s.base_mode === "data_driven" && (
                <div className="ml-6 flex flex-col gap-2">
                  {RATE_MODES.map((m) => (
                    <RadioRow
                      key={m.value}
                      small
                      checked={s.base_rate_mode === m.value}
                      title={m.title}
                      hint={m.hint}
                      info={m.info}
                      right={
                        item.base_rate !== null &&
                        cur !== null &&
                        m.value === "recommended"
                          ? formatCurrency(item.base_rate, cur)
                          : undefined
                      }
                      onSelect={() => set("base_rate_mode", m.value)}
                    />
                  ))}
                </div>
              )}
              <RadioRow
                checked={s.base_mode === "manual"}
                title="Manuell"
                hint="Du behältst die volle Kontrolle."
                info="Du legst den Basispreis selbst fest. Die Engine rechnet die Faktoren (Wochenende, Auslastung usw.) auf genau diesen Wert — passt ihn aber nicht eigenständig an den Markt an."
                onSelect={() => set("base_mode", "manual")}
              />
              {s.base_mode === "manual" && (
                <div className="ml-6">
                  <Field label={cur ? `Basispreis (${cur})` : "Basispreis"}>
                    <NumInput
                      value={s.manual_base_price}
                      onChange={(n) => set("manual_base_price", n)}
                      placeholder="z. B. 150"
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* Min/Max-Leitplanken */}
            <div className="grid grid-cols-2 gap-4">
              <Field
                label={cur ? `Mindestpreis (${cur})` : "Mindestpreis"}
                hint="Unter diesen Preis geht die Engine nie — egal wie niedrig die Nachfrage ist. Leer = kein Limit."
              >
                <NumInput
                  value={s.min_price}
                  onChange={(n) => set("min_price", n)}
                  placeholder="kein Limit"
                />
              </Field>
              <Field
                label={cur ? `Höchstpreis (${cur})` : "Höchstpreis"}
                hint="Über diesen Preis geht die Engine nie — auch bei sehr hoher Nachfrage. Leer = kein Limit."
              >
                <NumInput
                  value={s.max_price}
                  onChange={(n) => set("max_price", n)}
                  placeholder="kein Limit"
                />
              </Field>
            </div>

            {/* Erweiterte Regeln (eingeklappt) */}
            <div className="flex flex-col gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                className="flex items-center justify-between text-sm font-medium"
              >
                Erweiterte Regeln
                <Icon
                  icon="ph:caret-down"
                  className={`size-4 transition-transform ${advanced ? "rotate-180" : ""}`}
                />
              </button>
              {advanced && (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Wochenend-Aufschlag (%)"
                      hint="So viel Prozent teurer werden Freitag und Samstag automatisch. Beispiel: 15 % macht aus 200 € → 230 € am Wochenende."
                    >
                      <NumInput
                        value={s.weekend_uplift_pct}
                        onChange={(n) => set("weekend_uplift_pct", n ?? 0)}
                      />
                    </Field>
                    <Field
                      label="Auslastungs-Empfindlichkeit (%)"
                      hint="Wie stark der Preis auf die Buchungslage reagiert. Sind viele Nächte rundherum schon belegt, steigt der Preis; ist viel frei, sinkt er. Höherer Wert = stärkere Reaktion."
                    >
                      <NumInput
                        value={s.occupancy_sensitivity}
                        onChange={(n) => set("occupancy_sensitivity", n ?? 0)}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Lücken-Rabatt 1–2 Nächte (%)"
                      hint="Rabatt für einzelne freie Nächte, die zwischen zwei Buchungen eingeklemmt sind (z. B. nur Mi frei zwischen Di und Do). Solche Lücken sind schwer zu füllen — ein Rabatt macht sie attraktiver."
                    >
                      <NumInput
                        value={s.orphan_gap_discount_pct}
                        onChange={(n) => set("orphan_gap_discount_pct", n ?? 0)}
                      />
                    </Field>
                    <Field
                      label="Min-Stay-Spanne (Tage)"
                      hint="Mindestaufenthalt je nach Nachfrage: bei schwacher Buchungslage gilt der kleinere Wert (links), bei starker der größere (rechts). Beispiel 1–7: normal 1 Nacht, an gefragten Terminen bis zu 7 Nächte."
                    >
                      <div className="flex items-center gap-2">
                        <NumInput
                          value={s.min_stay_min}
                          onChange={(n) => set("min_stay_min", Math.max(1, n ?? 1))}
                        />
                        <span className="text-muted-foreground">–</span>
                        <NumInput
                          value={s.min_stay_max}
                          onChange={(n) => set("min_stay_max", Math.max(1, n ?? 1))}
                        />
                      </div>
                    </Field>
                  </div>

                  <LastMinuteEditor
                    rules={s.last_minute}
                    onChange={(r) => set("last_minute", r)}
                  />

                  <RateRulesEditor
                    rules={s.rate_rules ?? []}
                    onChange={(r) => set("rate_rules", r)}
                  />

                  {/* Wetter (RateBoard-Baustein, DWD-Daten) */}
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="leading-tight">
                      <span className="flex items-center gap-1.5 font-semibold">
                        Wetter berücksichtigen
                        <InfoHint text="Die Engine bezieht das Wetter am Anreisetag ein (amtliche DWD-Daten): gutes Wetter hebt den Preis leicht, schlechtes senkt ihn. Wirkt nur für die nächsten ~10 Tage (so weit reicht die Wettervorhersage) und nur, wenn das Objekt Koordinaten hinterlegt hat." />
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        Preis am Wetter der nächsten Tage ausrichten (DWD).
                      </span>
                    </span>
                    <Switch
                      checked={s.weather_enabled}
                      onCheckedChange={(c) => set("weather_enabled", c)}
                    />
                  </label>
                  {s.weather_enabled && (
                    <div className="ml-0">
                      <Field
                        label="Max. Wetter-Korrektur (±%)"
                        hint="Obergrenze, wie weit gutes/schlechtes Wetter den Preis verschieben darf. Beispiel 10 %: höchstens ein Zehntel Auf- oder Abschlag durch das Wetter."
                      >
                        <NumInput
                          value={s.weather_max_adjust_pct}
                          onChange={(n) => set("weather_max_adjust_pct", n ?? 0)}
                        />
                      </Field>
                    </div>
                  )}

                  {/* Marktdaten */}
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="leading-tight">
                      <span className="flex items-center gap-1.5 font-semibold">
                        Marktdaten nutzen
                        <InfoHint text="Zusätzlich zu deinen eigenen Regeln richtet die Engine den Preis am Wettbewerb und der Marktnachfrage aus. Benötigt eine Marktdaten-Quelle (Markt-Schlüssel/Vergleichsobjekte unten). Ohne Quelle bleibt dieser Faktor wirkungslos." />
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        Preis zusätzlich am Wettbewerb/der Marktnachfrage
                        ausrichten (benötigt eine Marktdaten-Quelle).
                      </span>
                    </span>
                    <Switch
                      checked={s.market_enabled}
                      onCheckedChange={(c) => set("market_enabled", c)}
                    />
                  </label>
                  {s.market_enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Field
                          label="Markt-Empfindlichkeit (%)"
                          hint="Wie stark sich dein Preis an den Marktpreisen vergleichbarer Objekte orientiert. Höherer Wert = dein Preis zieht stärker Richtung Marktdurchschnitt."
                        >
                          <NumInput
                            value={s.market_sensitivity}
                            onChange={(n) => set("market_sensitivity", n ?? 0)}
                          />
                        </Field>
                        <Field
                          label="Max. Markt-Korrektur (±%)"
                          hint="Obergrenze, wie weit der Markt deinen Preis nach oben oder unten verschieben darf. Beispiel 25 %: höchstens ein Viertel Auf- oder Abschlag durch Marktdaten."
                        >
                          <NumInput
                            value={s.market_max_adjust_pct}
                            onChange={(n) => set("market_max_adjust_pct", n ?? 0)}
                          />
                        </Field>
                      </div>
                      <Field
                        label="Markt-Schlüssel (Region/Markt)"
                        hint="Kennung des Marktes/der Region, aus der die Vergleichsdaten kommen (von deiner Marktdaten-Quelle vorgegeben). Beispiel: de-muenchen."
                      >
                        <Input
                          value={s.market_key ?? ""}
                          placeholder="z. B. de-muenchen"
                          onChange={(e) =>
                            set("market_key", e.target.value || null)
                          }
                        />
                      </Field>
                      <Field
                        label="Vergleichsobjekte (Comp-Set, kommagetrennt)"
                        hint="Liste vergleichbarer Objekte (Comp-Set), an deren Preisen sich die Engine orientiert. Kennungen kommagetrennt eintragen. Leer = die Engine nutzt den allgemeinen Marktdurchschnitt der Region."
                      >
                        <Input
                          value={s.comp_refs.join(", ")}
                          placeholder="ref-1, ref-2, …"
                          onChange={(e) =>
                            set(
                              "comp_refs",
                              e.target.value
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </Field>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={busy}>
                {busy ? "Speichern…" : "Speichern"}
              </Button>
              {msg && <p className="text-sm text-destructive">{msg}</p>}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RadioRow({
  checked,
  title,
  hint,
  info,
  right,
  small,
  onSelect,
}: {
  checked: boolean;
  title: string;
  hint: string;
  // Optionaler längerer Erklär-Tooltip (für Begriffe, die der Kurz-Hint nicht abdeckt).
  info?: string;
  right?: string;
  small?: boolean;
  onSelect: () => void;
}) {
  // role="button"-div statt <button>: der Titel kann einen InfoHint (selbst ein
  // <button>) enthalten — verschachtelte <button> sind in HTML verboten und
  // brechen die Hydration. Tastatur-Bedienung über Enter/Space nachgebildet.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex cursor-pointer items-start gap-3 rounded-(--radius) border p-3 text-left ${
        checked ? "border-accent bg-accent/5" : "border-border hover:bg-muted/50"
      }`}
    >
      <span
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-accent" : "border-muted-foreground/40"
        }`}
      >
        {checked && <span className="size-2 rounded-full bg-accent" />}
      </span>
      <span className="flex-1 leading-tight">
        <span className={`flex items-center justify-between gap-2 ${small ? "text-sm" : ""} font-medium`}>
          <span className="flex items-center gap-1.5">
            {title}
            {info && <InfoHint text={info} />}
          </span>
          {right && <span className="font-semibold">{right}</span>}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </div>
  );
}

function LastMinuteEditor({
  rules,
  onChange,
}: {
  rules: LastMinuteRule[];
  onChange: (rules: LastMinuteRule[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-1.5">
        Last-Minute-Rabatte
        <InfoHint text="Rabatt für kurzfristig noch freie Nächte, je näher der Anreisetag rückt. Beispiel: „ab 7 Tagen 10 %, ab 3 Tagen 20 %“ — so füllst du leere Tage kurz vor knapp." />
      </Label>
      {rules.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Noch keine Last-Minute-Regeln.
        </p>
      )}
      {rules.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">ab</span>
          <NumInput
            value={r.days_before}
            onChange={(n) =>
              onChange(
                rules.map((x, idx) =>
                  idx === i ? { ...x, days_before: n ?? 1 } : x,
                ),
              )
            }
            className="w-20"
          />
          <span className="text-muted-foreground">Tagen</span>
          <NumInput
            value={r.discount_pct}
            onChange={(n) =>
              onChange(
                rules.map((x, idx) =>
                  idx === i ? { ...x, discount_pct: n ?? 0 } : x,
                ),
              )
            }
            className="w-20"
          />
          <span className="text-muted-foreground">% Rabatt</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Entfernen"
            onClick={() => onChange(rules.filter((_, idx) => idx !== i))}
          >
            <Icon icon="ph:trash" className="size-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-fit gap-1.5"
        onClick={() => onChange([...rules, { days_before: 5, discount_pct: 10 }])}
      >
        <Icon icon="ph:plus" className="size-4" /> Regel hinzufügen
      </Button>
    </div>
  );
}

const WEEKDAYS = [
  { v: 0, l: "Mo" },
  { v: 1, l: "Di" },
  { v: 2, l: "Mi" },
  { v: 3, l: "Do" },
  { v: 4, l: "Fr" },
  { v: 5, l: "Sa" },
  { v: 6, l: "So" },
];

// Manuelle Rate Rules (RateBoard „KI + Fachwissen"): pro Regel ausgewählte
// Wochentage + ein Auf-/Abschlag in %. Greift OBENDRAUF auf die Auto-Faktoren.
function RateRulesEditor({
  rules,
  onChange,
}: {
  rules: RateRule[];
  onChange: (rules: RateRule[]) => void;
}) {
  function toggleWeekday(i: number, day: number) {
    const cur = rules[i].match.weekday;
    const arr = Array.isArray(cur) ? [...cur] : cur === undefined ? [] : [cur];
    const next = arr.includes(day)
      ? arr.filter((d) => d !== day)
      : [...arr, day].sort((a, b) => a - b);
    onChange(
      rules.map((r, idx) =>
        idx === i ? { ...r, match: { ...r.match, weekday: next } } : r,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-1.5">
        Eigene Regeln
        <InfoHint text="Deine manuellen Regeln zusätzlich zur Automatik (z. B. „sonntags +15 %“). Wähle die Wochentage und den Auf- oder Abschlag in Prozent. Diese Regeln gelten bewusst obendrauf — sie werden nicht von der automatischen Rabatt-Begrenzung verrechnet." />
      </Label>
      {rules.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine eigenen Regeln.</p>
      )}
      {rules.map((r, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-(--radius) border border-border p-3"
        >
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const wd = r.match.weekday;
              const active = Array.isArray(wd)
                ? wd.includes(d.v)
                : wd === d.v;
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => toggleWeekday(i, d.v)}
                  className={`size-8 rounded-full border text-xs font-medium ${
                    active
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
          {(() => {
            const wd = r.match.weekday;
            const empty = Array.isArray(wd) ? wd.length === 0 : wd === undefined;
            return empty ? (
              <p className="text-xs text-warning">
                Wähle mindestens einen Wochentag — sonst bleibt die Regel
                wirkungslos.
              </p>
            ) : null;
          })()}
          <div className="flex items-center gap-2 text-sm">
            <NumInputSigned
              value={r.adjust_pct}
              onChange={(n) =>
                onChange(
                  rules.map((x, idx) =>
                    idx === i ? { ...x, adjust_pct: n ?? 0 } : x,
                  ),
                )
              }
              className="w-24"
            />
            <span className="text-muted-foreground">
              % (positiv = Aufschlag, negativ = Rabatt)
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Entfernen"
              className="ml-auto"
              onClick={() => onChange(rules.filter((_, idx) => idx !== i))}
            >
              <Icon icon="ph:trash" className="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-fit gap-1.5"
        onClick={() =>
          onChange([...rules, { match: { weekday: [] }, adjust_pct: 10 }])
        }
      >
        <Icon icon="ph:plus" className="size-4" /> Regel hinzufügen
      </Button>
    </div>
  );
}

// Wie NumInput, erlaubt aber negative Werte (Rate-Rule-Abschläge).
function NumInputSigned({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
}) {
  return (
    <Input
      type="number"
      value={value ?? ""}
      className={className}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
    />
  );
}

// Kleines „?"-Icon mit Erklär-Tooltip. Hover/Fokus zeigt einen verständlichen
// Hilfetext — damit die Fachbegriffe (Auslastung, Comp-Set, …) niemanden
// ratlos lassen. type=button, damit es im Formular nichts auslöst.
function InfoHint({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Erklärung"
            className="text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            <Icon icon="ph:question" className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  // mt-auto am Input: bei einzeiligen vs. zweizeiligen Labels in einem
  // 2-Spalten-Grid bleiben die Eingabefelder auf gleicher Höhe (Label oben,
  // Feld unten bündig). h-full lässt die Zelle die Grid-Zeilenhöhe füllen.
  return (
    <div className="flex h-full flex-col gap-1.5">
      <Label className="flex items-center gap-1.5 leading-tight">
        {label}
        {hint && <InfoHint text={hint} />}
      </Label>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      type="number"
      min={0}
      value={value ?? ""}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
    />
  );
}
