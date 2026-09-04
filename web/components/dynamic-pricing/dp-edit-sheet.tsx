"use client";

// Basispreis-Slider (Hostaway-„Set your base rate"): pro Objekt die Basispreis-
// Strategie wählen — Datengetrieben (Konservativ/Empfohlen/Aggressiv) oder
// Manuell (eigener Basispreis) — plus Mindest-/Höchstpreis und (eingeklappt) die
// erweiterten Regeln (Wochenende/Auslastung/Last-Minute/Orphan/Markt). Lädt die
// vollständigen Einstellungen beim Öffnen und speichert per PUT.
import { MarktKarte } from "./markt-karte";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Switch } from "@nextdays/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nextdays/ui/tooltip";
import { formatCurrency } from "@/lib/currency";
import {
  type BaseRateMode,
  getMarktStand,
  getStufenVorschau,
  type MarktStand,
  type StufenVorschau,
  type DpOverviewItem,
  type DpSettings,
  getDpSettings,
  type FarFutureRule,
  type LastMinuteRule,
  type OccupancyStep,
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
  const t = useTranslations("dynamicPricing");
  const [s, setS] = useState<DpSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  // Was die drei Stufen im Schnitt kosten. Ohne diese Zahlen ist „aggressiv"
  // ein Wort ohne Bedeutung — man wählt blind. Der Server rechnet sie.
  const [stufen, setStufen] = useState<StufenVorschau | null>(null);
  // Gibt es ueberhaupt einen Markt? Ohne diese Auskunft ist der Schalter
  // "Marktdaten nutzen" von einer Attrappe nicht zu unterscheiden.
  const [markt, setMarkt] = useState<MarktStand | null>(null);

  useEffect(() => {
    let active = true;
    getDpSettings(item.property_id).then((res) => {
      if (!active) return;
      if (res.ok) setS(res.data);
      else setLoadError(res.error);
    });
    // Parallel, nicht davor: die Vorschau ist eine Zusatzinformation und darf
    // das Öffnen des Panels nicht verzögern.
    void getStufenVorschau(item.property_id).then((res) => {
      if (active && res.ok) setStufen(res.data);
    });
    void getMarktStand(item.property_id).then((res) => {
      if (active && res.ok) setMarkt(res.data);
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
      weather_enabled: s.weather_enabled ?? false,
      weather_max_adjust_pct: s.weather_max_adjust_pct ?? 10,
      rate_rules: s.rate_rules ?? [],
      occupancy_steps: s.occupancy_steps ?? [],
      freigabe_noetig: s.freigabe_noetig ?? false,
      far_future: s.far_future ?? [],
    });
    setBusy(false);
    if (res.ok) {
      // Was der Server WIRKLICH gespeichert hat, nicht was wir geschickt
      // haben: ein Feld, das unterwegs verloren geht, sah bisher wie Erfolg
      // aus (occupancy_steps fehlte im Schema und wurde still verworfen).
      const gespeichert = res.data.occupancy_steps?.length ?? 0;
      const gewollt = s.occupancy_steps?.length ?? 0;
      if (gespeichert !== gewollt) {
        setMsg(
          `Die Auslastungsstufen wurden nicht gespeichert (${gewollt} gesendet, ` +
            `${gespeichert} zurückgemeldet). Bitte die Seite neu laden.`,
        );
        return;
      }
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
          <SheetTitle>{t("setBasePrice")}</SheetTitle>
          <SheetDescription>{item.title}</SheetDescription>
        </SheetHeader>

        {loadError && (
          <p className="px-4 text-sm text-destructive">{loadError}</p>
        )}

        {!s && !loadError && (
          <p className="px-4 text-sm text-muted-foreground">{t("loading")}</p>
        )}

        {s && (
          <div className="flex flex-col gap-6 p-4">
            {/* Aktiv-Schalter */}
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="leading-tight">
                <span className="flex items-center gap-1.5 font-semibold">
                  Dynamic Pricing aktiv
                  <InfoHint text="Ist dies an, berechnet die Engine die Tagespreise dieses Objekts automatisch und veröffentlicht sie überall — Kalender, eigene Plattform und alle verbundenen Portale. Ab dem Einschalten übernimmt die Automatik die Preisgestaltung dieses Objekts und ersetzt auch bereits gesetzte Tagespreise. Schaltest du wieder ab, gelten diese sofort erneut — sie bleiben erhalten." />
                </span>
                <span className="block text-sm text-muted-foreground">
                  Standardmäßig aus — du entscheidest pro Objekt. An heißt:
                  ein Preis, überall.
                </span>
              </span>
              <Switch
                checked={s.enabled}
                onCheckedChange={(c) => set("enabled", c)}
              />
            </label>

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
                  {/* Die Beträge sind der Ø-Preis der nächsten 90 Tage, nicht
                      ein fester Basispreis. „Aggressiv" kann deshalb NIEDRIGER
                      liegen als „konservativ": bei schwacher Auslastung
                      verstärkt es den Abschlag, statt ihn zu dämpfen. Ohne
                      diesen Satz wirkt die Reihenfolge wie ein Fehler. */}
                  <p className="text-xs text-muted-foreground">
                    Ø-Preis der nächsten 90 Tage. Aggressiv reagiert stärker auf
                    die Buchungslage — nach oben wie nach unten.
                  </p>
                  {RATE_MODES.map((m) => (
                    <RadioRow
                      key={m.value}
                      small
                      checked={s.base_rate_mode === m.value}
                      title={m.title}
                      hint={m.hint}
                      info={m.info}
                      right={
                        stufen?.[m.value] != null && cur !== null
                          ? formatCurrency(stufen[m.value] as number, cur)
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
                      placeholder={t("pricePlaceholder")}
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
                  placeholder={t("noLimit")}
                />
              </Field>
              <Field
                label={cur ? `Höchstpreis (${cur})` : "Höchstpreis"}
                hint="Über diesen Preis geht die Engine nie — auch bei sehr hoher Nachfrage. Leer = kein Limit."
              >
                <NumInput
                  value={s.max_price}
                  onChange={(n) => set("max_price", n)}
                  placeholder={t("noLimit")}
                />
              </Field>
            </div>

            {/* Freigabe: steht ABSICHTLICH nicht unter „Erweiterte Regeln".
                Sie entscheidet, ob überhaupt etwas an die Portale geht — das
                ist keine Feinheit, sondern die Grundfrage. */}
            <label className="flex cursor-pointer items-center justify-between gap-3 border-t pt-4">
              <span className="leading-tight">
                <span className="flex items-center gap-1.5 font-semibold">
                  Preise erst nach Freigabe senden
                  <InfoHint text="Die Automatik rechnet weiter, sendet aber nichts an die Portale, bis du im Kalender auf „Preise senden“ klickst. Sinnvoll, solange du den Regeln noch nicht blind vertraust — die Zahl geht sonst sofort an Airbnb und Booking." />
                </span>
                <span className="block text-sm text-muted-foreground">
                  Berechnete Preise warten auf deinen Blick, statt sofort zu
                  gehen.
                </span>
              </span>
              <Switch
                checked={s.freigabe_noetig ?? false}
                onCheckedChange={(c) => set("freigabe_noetig", c)}
              />
            </label>
            {/* Die Folge SOFORT benennen, nicht erst nach dem Speichern: ab
                jetzt geht nichts mehr an die Portale, bis jemand freigibt.
                Ein Schalter, dessen Wirkung man erst merkt, wenn Preise
                fehlen, ist eine Falle. */}
            {s.freigabe_noetig && (
              <p className="-mt-1 rounded-(--radius) bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Ab dem Speichern gehen keine berechneten Preise mehr an die
                Portale. Du gibst sie in der Objektliste oder im Kalender des
                Objekts frei.
              </p>
            )}

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
                      label={t("weekendSurcharge")}
                      hint="So viel Prozent teurer werden Freitag und Samstag automatisch. Beispiel: 15 % macht aus 200 € → 230 € am Wochenende."
                    >
                      <NumInput
                        value={s.weekend_uplift_pct}
                        onChange={(n) => set("weekend_uplift_pct", n ?? 0)}
                      />
                    </Field>
                    <Field
                      label={t("occupancySensitivity")}
                      hint="Wie stark der Preis auf die Buchungslage reagiert. Sind viele Nächte rundherum schon belegt, steigt der Preis; ist viel frei, sinkt er. Höherer Wert = stärkere Reaktion."
                    >
                      <NumInput
                        value={s.occupancy_sensitivity}
                        onChange={(n) => set("occupancy_sensitivity", n ?? 0)}
                        disabled={(s.occupancy_steps ?? []).length > 0}
                      />
                      {(s.occupancy_steps ?? []).length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ohne Wirkung — es gelten die Auslastungsstufen weiter
                          unten.
                        </p>
                      )}
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label={t("gapDiscount")}
                      hint="Rabatt für einzelne freie Nächte, die zwischen zwei Buchungen eingeklemmt sind (z. B. nur Mi frei zwischen Di und Do). Solche Lücken sind schwer zu füllen — ein Rabatt macht sie attraktiver."
                    >
                      <NumInput
                        value={s.orphan_gap_discount_pct}
                        onChange={(n) => set("orphan_gap_discount_pct", n ?? 0)}
                      />
                    </Field>
                    <Field
                      label={t("minStayRange")}
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

                  <FarFutureEditor
                    rules={s.far_future ?? []}
                    onChange={(r) => set("far_future", r)}
                  />

                  <OccupancyStepsEditor
                    steps={s.occupancy_steps ?? []}
                    onChange={(r) => set("occupancy_steps", r)}
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
                        label={t("maxWeatherAdjust")}
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
                        <InfoHint text="Einmal täglich werden die öffentlich ausgeschriebenen Preise ganzer Unterkünfte im Umkreis von rund 50 km abgerufen. Die Karte zeigt jeden Preis als Punkt, die Engine richtet deinen Preis am Median aus. Du musst nichts eintragen. Fremde Objektnamen werden weder gespeichert noch angezeigt." />
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        Preis am Median vergleichbarer Objekte in der Umgebung
                        ausrichten.
                      </span>
                    </span>
                    <Switch
                      checked={s.market_enabled}
                      onCheckedChange={(c) => set("market_enabled", c)}
                    />
                  </label>
                  {s.market_enabled && (
                    <>
                      {/* Die Marktkarte ist die wichtigste Auskunft dieses
                          Blocks: ohne sie steht der Schalter auf "an" und
                          niemand sieht, ob er wirkt (live am 04.09.2026: an,
                          ohne Quelle, Faktor an allen 400 Tagen 1,0). Sie zeigt
                          jeden Angebotspreis der Umgebung als Punkt, nie
                          fremde Objektnamen. */}
                      {markt && (
                        <MarktKarte
                          stand={markt}
                          lat={markt.lat}
                          lng={markt.lng}
                          titel={item.title ?? null}
                        />
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <Field
                          label={t("marketSensitivity")}
                          hint="Wie stark sich dein Preis an den Marktpreisen vergleichbarer Objekte orientiert. Höherer Wert = dein Preis zieht stärker Richtung Marktdurchschnitt."
                        >
                          <NumInput
                            value={s.market_sensitivity}
                            onChange={(n) => set("market_sensitivity", n ?? 0)}
                          />
                        </Field>
                        <Field
                          label={t("maxMarketAdjust")}
                          hint="Obergrenze, wie weit der Markt deinen Preis nach oben oder unten verschieben darf. Beispiel 25 %: höchstens ein Viertel Auf- oder Abschlag durch Marktdaten."
                        >
                          <NumInput
                            value={s.market_max_adjust_pct}
                            onChange={(n) => set("market_max_adjust_pct", n ?? 0)}
                          />
                        </Field>
                      </div>
                      {/* KEINE Handeingabe von Markt-Schlüssel/Comp-Set mehr:
                          es gibt keine externe Marktquelle, an die ein
                          Schlüssel ginge, und Objekt-IDs tippt niemand ab.
                          Beide Felder standen ohne Wirkung im Formular
                          (Attrappe, vom Nutzer am 04.09.2026 beanstandet).
                          Die Marktregel arbeitet ausschließlich mit der
                          täglichen Umgebungsbeobachtung oben. */}
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
  const t = useTranslations("dynamicPricing");
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
          <span className="text-muted-foreground">{t("percentDiscount")}</span>
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

// Aufschlag für lange Vorausbuchung — das Gegenstück zum Last-Minute-Rabatt.
// Beide stehen bewusst nebeneinander: sie beantworten dieselbe Frage (was ist
// die Nacht wert, je nach Vorlauf?) in entgegengesetzte Richtungen.
function FarFutureEditor({
  rules,
  onChange,
}: {
  rules: FarFutureRule[];
  onChange: (rules: FarFutureRule[]) => void;
}) {
  // Aufsteigend: die Leiter wird von nah nach fern gelesen, und es gilt die
  // weiteste erreichte Stufe.
  const sortiert = [...rules].sort((a, b) => a.days_before - b.days_before);

  function aendern(i: number, patch: Partial<FarFutureRule>) {
    onChange(sortiert.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-1.5">
        Aufschlag bei langer Vorausbuchung
        <InfoHint text="Wer früh bucht, plant fest und vergleicht weniger — Hochzeiten, Familientreffen, Sommerferien mit Schulkindern. Beispiel: „ab 180 Tagen +10 %, ab 330 Tagen +25 %“. Es gilt immer die weiteste erreichte Stufe." />
      </Label>
      {sortiert.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Kein Aufschlag — ferne Termine kosten wie nahe.
        </p>
      )}
      {sortiert.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">ab</span>
          <NumInput
            value={r.days_before}
            onChange={(n) =>
              aendern(i, {
                days_before: Math.min(730, Math.max(1, n ?? 1)),
              })
            }
            className="w-20"
          />
          <span className="text-muted-foreground">Tagen</span>
          <NumInput
            value={r.uplift_pct}
            onChange={(n) =>
              aendern(i, { uplift_pct: Math.min(300, Math.max(0, n ?? 0)) })
            }
            className="w-20"
          />
          <span className="text-muted-foreground">% Aufschlag</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Entfernen"
            onClick={() => onChange(sortiert.filter((_, idx) => idx !== i))}
          >
            <Icon icon="ph:trash" className="size-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      {sortiert.length < 10 && (
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-1.5"
          onClick={() =>
            onChange([...sortiert, { days_before: 180, uplift_pct: 10 }])
          }
        >
          <Icon icon="ph:plus" className="size-4" /> Stufe hinzufügen
        </Button>
      )}
    </div>
  );
}

// Auslastungs-Stufenleiter: ablesbare Preisliste statt abstrakter Schraube.
// Sind Stufen gepflegt, ERSETZEN sie die Auslastungs-Empfindlichkeit — deshalb
// steht das hier ausdruecklich, sonst sucht man spaeter die Wirkung der Schraube.
function OccupancyStepsEditor({
  steps,
  onChange,
}: {
  steps: OccupancyStep[];
  onChange: (steps: OccupancyStep[]) => void;
}) {
  // Nach Schwelle sortiert anzeigen: die Leiter wird von unten nach oben
  // gelesen, und es gilt die hoechste erreichte Stufe.
  const sortiert = [...steps].sort((a, b) => a.ab_pct - b.ab_pct);

  function aendern(i: number, patch: Partial<OccupancyStep>) {
    onChange(sortiert.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-1.5">
        Auslastungsstufen
        <InfoHint text="Ablesbare Stufenleiter statt Empfindlichkeits-Schraube: „ab 80 % Auslastung +15 %“. Es gilt immer nur die höchste erreichte Stufe — es wird nichts addiert. Sobald hier Stufen stehen, ersetzen sie die Auslastungs-Empfindlichkeit." />
      </Label>
      {sortiert.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine Stufen — es gilt die Auslastungs-Empfindlichkeit oben.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aktiv — diese Stufen ersetzen die Auslastungs-Empfindlichkeit.
        </p>
      )}
      {sortiert.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">ab</span>
          <NumInput
            value={r.ab_pct}
            onChange={(n) =>
              aendern(i, { ab_pct: Math.min(100, Math.max(0, n ?? 0)) })
            }
            className="w-20"
          />
          <span className="text-muted-foreground">% Auslastung</span>
          {/* Signiert: ein Abschlag (ab 30 % -> -10 %) ist ausdruecklich
              erlaubt, NumInput mit min=0 wuerde ihn verhindern. */}
          <NumInputSigned
            value={r.adjust_pct}
            onChange={(n) =>
              aendern(i, { adjust_pct: Math.min(300, Math.max(-90, n ?? 0)) })
            }
            className="w-20"
          />
          <span className="text-muted-foreground">% Preis</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Entfernen"
            onClick={() => onChange(sortiert.filter((_, idx) => idx !== i))}
          >
            <Icon icon="ph:trash" className="size-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      {sortiert.length < 20 && (
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-1.5"
          onClick={() => onChange([...sortiert, { ab_pct: 80, adjust_pct: 10 }])}
        >
          <Icon icon="ph:plus" className="size-4" /> Stufe hinzufügen
        </Button>
      )}
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
  const t = useTranslations("dynamicPricing");
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
        <p className="text-sm text-muted-foreground">{t("noOwnRules")}</p>
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
  const t = useTranslations("dynamicPricing");
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t("explanation")}
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
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      min={0}
      value={value ?? ""}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
    />
  );
}
