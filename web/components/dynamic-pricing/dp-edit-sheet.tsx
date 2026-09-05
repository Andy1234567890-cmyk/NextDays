"use client";

// Basispreis-Slider (Hostaway-„Set your base rate"): pro Objekt die Basispreis-
// Strategie wählen — Grundpreis oder Marktpreis (Konservativ/Empfohlen/Aggressiv) oder
// Manuell (eigener Basispreis) — plus Mindest-/Höchstpreis und (eingeklappt) die
// erweiterten Regeln (Wochenende/Auslastung/Last-Minute/Orphan/Markt). Lädt die
// vollständigen Einstellungen beim Öffnen und speichert per PUT.
import { DpPreisgrenzen } from "./dp-preisgrenzen";
import { MarktKarte } from "./markt-karte";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
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
import { listRatePlans, type RatePlan } from "@/lib/rates";
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
  // Rückfrage beim EINSCHALTEN der Freigabepflicht (s. Dialog am Ende).
  const [freigabeFrage, setFreigabeFrage] = useState(false);
  // Was die drei Stufen im Schnitt kosten. Ohne diese Zahlen ist „aggressiv"
  // ein Wort ohne Bedeutung — man wählt blind. Der Server rechnet sie.
  const [stufen, setStufen] = useState<StufenVorschau | null>(null);
  // Gibt es ueberhaupt einen Markt? Ohne diese Auskunft ist der Schalter
  // "Marktdaten nutzen" von einer Attrappe nicht zu unterscheiden.
  const [markt, setMarkt] = useState<MarktStand | null>(null);
  // Ratenplaene des Objekts fuer „Preise gelten fuer" (0562). Nur Basisplaene
  // sind waehlbar — ein abgeleiteter folgt seinem Parent.
  const [plaene, setPlaene] = useState<RatePlan[]>([]);

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
    void listRatePlans(item.property_id).then((res) => {
      if (active && res.ok) setPlaene(res.data.items);
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
      // 0562
      freigabe_ab_tagen: s.freigabe_noetig ? (s.freigabe_ab_tagen ?? null) : null,
      anker_enabled: s.anker_enabled ?? false,
      anker_max_pct: s.anker_max_pct ?? 20,
      // Ohne Saisonkalender nie „an" schicken — der Server lehnt es mit 422
      // ab, und der Schalter ist dann ohnehin gesperrt.
      saison_mindestpreis: s.saison_verfuegbar ? (s.saison_mindestpreis ?? false) : false,
      rate_plan_id: s.rate_plan_id ?? null,
      feiertag_uplift_pct: s.feiertag_uplift_pct ?? 0,
      ferien_uplift_pct: s.ferien_uplift_pct ?? 0,
      quellmaerkte: s.quellmaerkte ?? [],
      occupancy_discount_cap_pct: s.occupancy_discount_cap_pct ?? 20,
      occupancy_premium_cap_pct: s.occupancy_premium_cap_pct ?? 15,
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
  // Saison-Untergrenze (0565): wirkt nur, wenn Kalender da UND Regel an.
  const saisonAktiv = Boolean(s?.saison_verfuegbar && s?.saison_mindestpreis);
  const saisonSpanne =
    s?.saison_preis_von != null && s?.saison_preis_bis != null
      ? s.saison_preis_von === s.saison_preis_bis
        ? formatCurrency(s.saison_preis_von, cur)
        : `${formatCurrency(s.saison_preis_von, cur)} – ${formatCurrency(s.saison_preis_bis, cur)}`
      : null;

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
                <InfoHint text="Der Ausgangspreis (Anker), auf den alle Regeln wie Wochenende, Auslastung oder Markt rechnen. Grundpreis = dein Ratenplan, Marktpreis = täglicher Median der Umgebung, Manuell = dein fester Wert." />
              </Label>
              {/* Ehrliches Etikett: dieser Modus nimmt den Grundpreis des
                  Ratenplans — nicht „Daten". Der datengetriebene Anker ist
                  „Marktpreis" darunter (Hostaway „Market-driven base price"). */}
              <RadioRow
                checked={s.base_mode === "data_driven"}
                title="Grundpreis"
                hint="Dein Grundpreis aus dem Ratenplan, die Regeln rechnen darauf."
                info="Anker ist der Grundpreis deines Ratenplans. Alle Regeln (Wochenende, Auslastung, Vorlauf, Markt-Korrektur …) rechnen auf diesen Wert."
                onSelect={() => set("base_mode", "data_driven")}
              />
              <RadioRow
                checked={s.base_mode === "market"}
                title="Marktpreis"
                hint={
                  markt?.markt_median != null && cur
                    ? `Median der Umgebung heute: ${formatCurrency(markt.markt_median, cur)} — je Tag neu.`
                    : "Median der Umgebung je Tag als Anker; ohne Marktwert gilt der Grundpreis."
                }
                info="Anker ist der tägliche Median der öffentlich ausgeschriebenen Preise ganzer Unterkünfte im Umkreis von rund 50 km (die Marktkarte unten zeigt sie). Fehlt für einen Tag ein Marktwert, gilt dort dein Grundpreis — sichtbar in „Warum dieser Preis?“ als Marktbasis."
                onSelect={() => set("base_mode", "market")}
              />
              {(s.base_mode === "data_driven" || s.base_mode === "market") && (
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

            {/* Min/Max-Leitplanken. Regel „Mindestpreis aus dem Saisonkalender"
                an: der Mindestpreis kommt aus dem Kalender — kein Eingabefeld,
                nur die Spanne. Aus: der Betrieb setzt ihn selbst. */}
            <div className="grid grid-cols-2 gap-4">
              {saisonAktiv ? (
                <Field
                  label={cur ? `Mindestpreis (${cur})` : "Mindestpreis"}
                  hint="Kommt aus dem Saisonkalender: der Saisonpreis des Tages ist die Untergrenze."
                >
                  <div className="flex h-9 items-center rounded-(--radius) border bg-muted/40 px-3 text-sm tabular-nums">
                    {saisonSpanne ?? "—"}
                  </div>
                </Field>
              ) : (
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
              )}
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

            {/* Ausnahmen je Zeitraum (SiteMinder „Floor and ceiling overrides"). */}
            <DpPreisgrenzen propertyId={item.property_id} currency={cur} />

            {/* Weitere Preisregeln als lesbare Liste (Hostaway „Additional
                pricing rules") — was gilt, auf einen Blick; bearbeitet wird
                unter „Erweiterte Regeln". */}
            <div className="flex flex-col gap-2 border-t pt-4">
              <Label className="flex items-center gap-1.5">
                Weitere Preisregeln
                <InfoHint text="Zusammenfassung der aktiven Regeln. Ändern kannst du sie unter „Erweiterte Regeln“ weiter unten." />
              </Label>
              <ul className="flex flex-col gap-1 text-sm">
                <RegelZeile
                  titel="Frühbucher-Aufschlag"
                  text={
                    (s.far_future ?? []).length
                      ? [...(s.far_future ?? [])]
                          .sort((a, b) => a.days_before - b.days_before)
                          .map((r) => `+${r.uplift_pct} % ab ${r.days_before} Tagen`)
                          .join(" · ")
                      : "aus"
                  }
                />
                <RegelZeile
                  titel="Last-Minute-Rabatt"
                  text={
                    (s.last_minute ?? []).length
                      ? [...(s.last_minute ?? [])]
                          .sort((a, b) => b.days_before - a.days_before)
                          .map((r) => `−${r.discount_pct} % ab ${r.days_before} Tagen`)
                          .join(" · ")
                      : "aus"
                  }
                />
                <RegelZeile
                  titel="Vorjahresanker"
                  text={
                    s.anker_enabled
                      ? `hebt bis +${s.anker_max_pct ?? 20} % auf den Vorjahresbestwert`
                      : "aus"
                  }
                />
                <RegelZeile
                  titel="Saison-Mindestpreis"
                  text={
                    !s.saison_verfuegbar
                      ? "kein Saisonkalender"
                      : s.saison_mindestpreis
                        ? saisonSpanne ?? "aus dem Saisonkalender"
                        : "aus"
                  }
                />
                <RegelZeile
                  titel="Wochenende"
                  text={s.weekend_uplift_pct ? `+${s.weekend_uplift_pct} % Fr/Sa` : "aus"}
                />
                <RegelZeile
                  titel="Lückenfüllung"
                  text={
                    s.orphan_gap_discount_pct
                      ? `−${s.orphan_gap_discount_pct} % für 1–2-Nächte-Lücken`
                      : "aus"
                  }
                />
                <RegelZeile
                  titel="Feiertage & Ferien"
                  text={
                    (s.feiertag_uplift_pct ?? 0) > 0 || (s.ferien_uplift_pct ?? 0) > 0
                      ? `Feiertag +${s.feiertag_uplift_pct ?? 0} % · Schulferien +${s.ferien_uplift_pct ?? 0} %`
                      : "aus"
                  }
                />
              </ul>
            </div>

            {/* Senden an die Portale (0562): sofort · nur nahe Tage warten ·
                alle warten. SiteMinder „Automate: Always / within X days". */}
            <div className="flex flex-col gap-3 border-t pt-4">
              <Label className="flex items-center gap-1.5">
                Preise an die Portale senden
                <InfoHint text="„Sofort“ ist der Normalfall: jede Preisänderung geht direkt an Airbnb und Booking. Mit Freigabe warten Tage, bis du im Kalender auf „Preise senden“ klickst — entweder nur die nahen (die teuren Fehler) oder alle." />
              </Label>
              <select
                value={
                  !s.freigabe_noetig
                    ? "sofort"
                    : s.freigabe_ab_tagen != null
                      ? "nah"
                      : "alle"
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "sofort") {
                    set("freigabe_noetig", false);
                    set("freigabe_ab_tagen", null);
                    return;
                  }
                  // Einschalten ist die folgenreiche Richtung — Rückfrage.
                  if (!s.freigabe_noetig) setFreigabeFrage(true);
                  else set("freigabe_noetig", true);
                  set("freigabe_ab_tagen", v === "nah" ? (s.freigabe_ab_tagen ?? 14) : null);
                }}
                className="rounded-(--radius) border bg-transparent px-3 py-2 text-sm"
              >
                <option value="sofort">Sofort — jede Änderung geht direkt raus</option>
                <option value="nah">Erst nach Freigabe — nur Tage innerhalb von … Tagen</option>
                <option value="alle">Erst nach Freigabe — alle Tage</option>
              </select>
              {s.freigabe_noetig && s.freigabe_ab_tagen != null && (
                <Field
                  label="Freigabe für Tage innerhalb von (Tagen)"
                  hint="Tage mit kürzerem Vorlauf als dieser Wert warten auf deine Freigabe; fernere gehen automatisch. 14 heißt: die nächsten zwei Wochen siehst du vorher, der Rest läuft."
                >
                  <NumInput
                    value={s.freigabe_ab_tagen}
                    onChange={(n) => set("freigabe_ab_tagen", Math.max(0, n ?? 0))}
                    className="w-32"
                  />
                </Field>
              )}
              {plaene.length > 1 && (
                <Field
                  label="Preise gelten für"
                  hint="Bei mehreren Ratenplänen (Hotel: BAR, B&B …) kann Dynamic Pricing auf einen Plan begrenzt werden. Abgeleitete Pläne folgen ihrem Basisplan und sind nicht wählbar."
                >
                  <select
                    value={s.rate_plan_id ?? ""}
                    onChange={(e) => set("rate_plan_id", e.target.value || null)}
                    className="w-full rounded-(--radius) border bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="">Alle Ratenpläne</option>
                    {plaene
                      .filter((rp) => rp.rate_mode !== "derived")
                      .map((rp) => (
                        <option key={rp.id} value={rp.id}>
                          {rp.name} ({formatCurrency(rp.base_price, rp.currency)})
                        </option>
                      ))}
                  </select>
                </Field>
              )}
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

                  {/* Vorjahresanker (Hostaway „Historical anchoring") */}
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="leading-tight">
                      <span className="flex items-center gap-1.5 font-semibold">
                        Vorjahresanker
                        <InfoHint text="Der beste Nachtpreis, zu dem dieselbe Woche im Vorjahr gebucht wurde, zieht den Preis nach oben — nie nach unten, höchstens um den Deckel. Schützt davor, unter dem zu verkaufen, was letztes Jahr nachweislich ging." />
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        Nie unter dem Vorjahresbestwert derselben Woche.
                      </span>
                    </span>
                    <Switch
                      checked={s.anker_enabled ?? false}
                      onCheckedChange={(c) => set("anker_enabled", c)}
                    />
                  </label>
                  {s.anker_enabled && (
                    <Field
                      label="Höchstens anheben um (%)"
                      hint="Deckel der Anhebung. 20 % heißt: liegt der berechnete Preis mehr als ein Fünftel unter dem Vorjahresbestwert, wird nur um 20 % angehoben."
                    >
                      <NumInput
                        value={s.anker_max_pct}
                        onChange={(n) => set("anker_max_pct", n ?? 0)}
                        className="w-32"
                      />
                    </Field>
                  )}

                  {/* Saison-Mindestpreis (0565): der Saisonkalender setzt die
                      Untergrenze, nie die Obergrenze. Ohne Kalender gesperrt —
                      ein Schalter, der nichts steuert, wäre eine Attrappe. */}
                  <label
                    className={
                      s.saison_verfuegbar
                        ? "flex cursor-pointer items-center justify-between gap-3"
                        : "flex items-center justify-between gap-3 opacity-60"
                    }
                  >
                    <span className="leading-tight">
                      <span className="flex items-center gap-1.5 font-semibold">
                        Mindestpreis aus dem Saisonkalender
                        <InfoHint text="An jedem Tag, der in einer Saison liegt, ist der Saisonpreis dieses Tages die Untergrenze: die Automatik darf darüber, nie darunter. Bei mehreren Saisons zählt die Saison, in der der Tag liegt. Tage ohne Saison behalten den Mindestpreis von oben. Der Höchstpreis bleibt unberührt." />
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {s.saison_verfuegbar
                          ? "Nie unter dem Saisonpreis des Tages. Höchstpreis bleibt."
                          : "Kein Saisonkalender angelegt — zuerst unter Preise eine Saison mit Zeitraum anlegen."}
                      </span>
                    </span>
                    <Switch
                      checked={s.saison_verfuegbar ? (s.saison_mindestpreis ?? false) : false}
                      disabled={!s.saison_verfuegbar}
                      onCheckedChange={(c) => set("saison_mindestpreis", c)}
                    />
                  </label>

                  {/* Feiertage & Schulferien (Feed, 0562) */}
                  <div className="flex flex-col gap-3">
                    <Label className="flex items-center gap-1.5">
                      Feiertage & Schulferien
                      <InfoHint text="Gesetzliche Feiertage und Schulferien des Objektlands und deiner Quellmärkte werden täglich aus öffentlichen Kalendern geladen. 0 % = aus. Quellmärkte: Länder, aus denen deine Gäste anreisen (Dänemark: DE, NL)." />
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Feiertag-Aufschlag (%)">
                        <NumInput
                          value={s.feiertag_uplift_pct}
                          onChange={(n) => set("feiertag_uplift_pct", n ?? 0)}
                        />
                      </Field>
                      <Field label="Schulferien-Aufschlag (%)">
                        <NumInput
                          value={s.ferien_uplift_pct}
                          onChange={(n) => set("ferien_uplift_pct", n ?? 0)}
                        />
                      </Field>
                    </div>
                    <Field
                      label="Quellmärkte (Ländercodes)"
                      hint="Zwei Buchstaben je Land, durch Komma getrennt — z. B. DE, NL, SE. Das Objektland zählt immer."
                    >
                      <Input
                        value={(s.quellmaerkte ?? []).join(", ")}
                        placeholder="DE, NL"
                        onChange={(e) =>
                          set(
                            "quellmaerkte",
                            e.target.value
                              .split(",")
                              .map((c) => c.trim().toUpperCase())
                              .filter((c) => c.length > 0),
                          )
                        }
                      />
                    </Field>
                  </div>

                  {/* Deckel des Auslastungs-/Pickup-Faktors — bisher nur per DB. */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Auslastungs-Rabatt höchstens (%)"
                      hint="Wie tief Auslastung und Buchungstempo den Preis senken dürfen. Ohne Wirkung, wenn Auslastungsstufen gepflegt sind."
                    >
                      <NumInput
                        value={s.occupancy_discount_cap_pct}
                        onChange={(n) => set("occupancy_discount_cap_pct", n ?? 0)}
                      />
                    </Field>
                    <Field
                      label="Auslastungs-Aufschlag höchstens (%)"
                      hint="Wie weit Auslastung und Buchungstempo den Preis heben dürfen."
                    >
                      <NumInput
                        value={s.occupancy_premium_cap_pct}
                        onChange={(n) => set("occupancy_premium_cap_pct", n ?? 0)}
                      />
                    </Field>
                  </div>

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

      {/* Rückfrage beim Einschalten der Freigabepflicht.
          Dynamic Pricing an heisst: die Automatik ändert den Preis, auch auf
          den Portalen. Wer das abschaltet, kehrt diese Zusage um — dann
          verkaufen Airbnb und Booking so lange den ALTEN Preis, bis jemand
          freigibt. Live am 04.09.2026 standen so 435 von 540 Tagen falsch
          bei Channex, ohne dass die Oberfläche es sagte. Das wird gefragt. */}
      <Dialog open={freigabeFrage} onOpenChange={setFreigabeFrage}>
        <DialogContent className="max-w-md">
          <DialogTitle>Preise nicht mehr automatisch senden?</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-3 text-sm">
              <p>
                Dynamic Pricing rechnet weiter, schickt aber nichts mehr an die
                Portale. Airbnb und Booking verkaufen so lange zum
                <strong> bisherigen Preis</strong>, bis du im Kalender auf
                „Preise senden“ klickst.
              </p>
              <p className="text-muted-foreground">
                Ohne diesen Schalter geht jede Preisänderung sofort hinaus —
                das ist der Normalfall.
              </p>
            </div>
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFreigabeFrage(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={() => {
                set("freigabe_noetig", true);
                setFreigabeFrage(false);
              }}
            >
              Erst nach Freigabe senden
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

// Eine Zeile der Regel-Zusammenfassung (Hostaway-Stil: Name, dann was gilt).
function RegelZeile({ titel, text }: { titel: string; text: string }) {
  const aus = text === "aus";
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{titel}</span>
      <span className={aus ? "text-xs text-muted-foreground/70" : "text-right font-medium"}>
        {text}
      </span>
    </li>
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
