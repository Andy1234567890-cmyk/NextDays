"use client";

// „Preise" (Airbnb-Pricing-Screen). Der rechte Editor-Bereich zeigt die Pricing-
// Karten untereinander (Grundpreis, Wochenend-Aufschlag, Smart Pricing). Klick auf
// eine Karte öffnet rechts eine Detail-Sidebar. Rabatte sind ein EIGENER Abschnitt
// (DiscountPanel).
//
// WICHTIG: Diese Panels schreiben an die ECHTE Preis-Wahrheit, nicht in den
// type_attributes-Blob:
//   • Grundpreis    → rate_plans.base_price       (onGrundpreis)
//   • Smart Pricing → dp_settings.enabled/min/max  (onSmart)
//   • Wochenend-%   → dp_settings.weekend_uplift_pct (onSmart) — wirkt nur bei
//     aktivem Smart Pricing (Backend kennt keinen statischen Wochenendaufschlag).
//   • Wochen-/Monatsrabatt → property_discounts    (onRabatt)
//
// Währung strikt aus den Daten; fehlt sie, rendert formatCurrency symbollos
// (Wurzel 4). Der €-Screenshot ist nur Vorlage.
import { Icon } from "@iconify/react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { currencySymbol, formatCurrency } from "@nextdays/currency";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";

import type { MarktVergleich, PreisStand } from "@/lib/preise";
import { ladeMarktVergleich } from "@/lib/preise-actions";

import {
  MARKTPLATZ_FEE_PCT,
  auszahlung,
  marktplatzProvision,
  wochenendPreis,
} from "./preis-rechnung";

type Smart = PreisStand["smart"];
type SmartPatch = Partial<
  Pick<Smart, "enabled" | "min_price" | "max_price" | "weekend_uplift_pct">
>;
type Detail = "base" | "weekend" | "smart";

export function PreisPanel({
  preise,
  currency,
  propertyId,
  koords,
  guests,
  onGrundpreis,
  onSmart,
}: {
  preise: PreisStand;
  currency: string | null;
  // Für den Marktvergleich (echte Marktplatz-Inserate im Umkreis).
  propertyId: string;
  koords: { lat: number; lng: number } | null;
  guests: number;
  onGrundpreis: (basePrice: number) => Promise<boolean>;
  onSmart: (fields: SmartPatch) => Promise<boolean>;
}) {
  const t = useTranslations("objektEditor");
  const reduziert = useReducedMotion();
  const [detail, setDetail] = useState<Detail | null>(null);
  // Marktvergleich-Modal: null = zu, "laedt" = lädt, sonst das Ergebnis.
  const [vergleich, setVergleich] = useState<MarktVergleich | "laedt" | null>(null);

  const basePrice = preise.basePrice ?? undefined;
  const hatPreis = basePrice != null && basePrice > 0;
  const weekendPct = preise.smart.weekend_uplift_pct ?? 0;
  const smartAn = preise.smart.enabled === true;
  const fmt = (n: number) => formatCurrency(n, currency, "de-DE", 0);
  const sym = currencySymbol(currency);

  async function oeffneVergleich() {
    setVergleich("laedt");
    const res = await ladeMarktVergleich(propertyId, koords, guests);
    setVergleich(res);
  }

  return (
    <div className="relative h-full">
      <section className="max-w-2xl">
        <h2 className="font-sans text-[2rem] font-bold tracking-tight">
          {t("secPreise")}
        </h2>
        <p className="mt-2 text-[0.9375rem] text-muted-foreground">
          {t("preisHint")}
        </p>

        <div className="mt-8 space-y-4">
          {/* Grundpreis */}
          <KachelButton onClick={() => setDetail("base")}>
            <p className="text-sm font-medium text-muted-foreground">
              {t("preisGrundpreis")}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {hatPreis ? fmt(basePrice) : t("hinzufuegen")}
            </p>
          </KachelButton>

          {/* Wochenend-Aufschlag */}
          <KachelButton onClick={() => setDetail("weekend")}>
            <p className="text-sm font-medium text-muted-foreground">
              {t("preisWochenende")}
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="text-2xl font-bold tracking-tight">
                {weekendPct > 0 ? `+${weekendPct}%` : t("hinzufuegen")}
              </p>
              {hatPreis && weekendPct > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("preisWochenendeFuer", {
                    preis: fmt(wochenendPreis(basePrice, weekendPct)),
                  })}
                </p>
              )}
            </div>
          </KachelButton>

          {/* Smart Pricing — mit eigenem Toggle (Airbnb-Muster). */}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-6">
            <button
              type="button"
              onClick={() => setDetail("smart")}
              className="min-w-0 flex-1 text-left outline-none"
            >
              <p className="font-semibold">{t("preisSmart")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("preisSmartHint")}
              </p>
            </button>
            <Toggle
              an={smartAn}
              onChange={(an) => void onSmart({ enabled: an })}
            />
          </div>

          {/* „Weitere Rabatte & Gebühren im Kalender" (Airbnb-Verweis). */}
          <div className="flex items-center gap-3 rounded-2xl bg-muted/40 px-6 py-5 text-sm text-muted-foreground">
            <Icon icon="ph:arrow-square-out" className="size-5 shrink-0" />
            <span>{t("preisKalenderVerweis")}</span>
          </div>
        </div>
      </section>

      {/* Detail-Sidebar (Overlay über dem Pricing-Screen, Airbnb-Muster). */}
      <AnimatePresence>
        {detail != null && (
          <motion.aside
            key="preis-sidebar"
            className="absolute inset-y-0 right-0 z-20 w-[30rem] overflow-hidden border-l border-border bg-background shadow-xl"
            initial={reduziert ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduziert ? { opacity: 0 } : { x: "100%" }}
            transition={
              reduziert
                ? { duration: 0 }
                : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            {detail === "base" && (
              <NachtpreisSidebar
                basePrice={basePrice}
                sym={sym}
                fmt={fmt}
                onSpeichere={onGrundpreis}
                onZurueck={() => setDetail(null)}
                onVergleich={oeffneVergleich}
              />
            )}
            {detail === "weekend" && (
              <WochenendSidebar
                basePrice={basePrice}
                weekendPct={weekendPct}
                fmt={fmt}
                smartAn={smartAn}
                onSpeichere={(pct) => onSmart({ weekend_uplift_pct: pct })}
                onZurueck={() => setDetail(null)}
                onVergleich={oeffneVergleich}
              />
            )}
            {detail === "smart" && (
              <SmartSidebar
                smart={preise.smart}
                basePrice={basePrice}
                sym={sym}
                onSpeichere={onSmart}
                onZurueck={() => setDetail(null)}
                onVergleich={oeffneVergleich}
              />
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Marktvergleich-Modal (Airbnb „Compare similar listings") — echte
          Marktplatz-Preise der Stadt. */}
      <VergleichModal
        zustand={vergleich}
        currency={currency}
        onSchliessen={() => setVergleich(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rabatte — eigener Abschnitt (Airbnb „Discounts")                   */
/* ------------------------------------------------------------------ */

export function DiscountPanel({
  preise,
  onRabatt,
}: {
  preise: PreisStand;
  onRabatt: (minNights: 7 | 28, pct: number | undefined) => Promise<boolean>;
}) {
  const t = useTranslations("objektEditor");

  return (
    <section className="max-w-2xl">
      <h2 className="font-sans text-[2rem] font-bold tracking-tight">
        {t("secRabatte")}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {t("preisRabatteHint")}
      </p>

      <div className="mt-8 space-y-4">
        <RabattZeile
          titel={t("preisWochenrabatt")}
          hint={t("preisWochenrabattHint")}
          // bps → % für die Anzeige.
          pct={preise.weeklyDiscount ? preise.weeklyDiscount.discount_bps / 100 : undefined}
          onSpeichere={(pct) => onRabatt(7, pct)}
        />
        <RabattZeile
          titel={t("preisMonatsrabatt")}
          hint={t("preisMonatsrabattHint")}
          pct={
            preise.monthlyDiscount ? preise.monthlyDiscount.discount_bps / 100 : undefined
          }
          onSpeichere={(pct) => onRabatt(28, pct)}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Detail-Sidebars                                                    */
/* ------------------------------------------------------------------ */

// Nachtpreis (Airbnb „Nightly price"): großer Preis mit Stift-Icon, darunter
// dauerhaft der Auszahlungs-Breakdown (Grundpreis / Provision / Du verdienst) und
// der Gastpreis, plus „Weniger/Mehr anzeigen"-Umschalter.
function NachtpreisSidebar({
  basePrice,
  sym,
  fmt,
  onSpeichere,
  onZurueck,
  onVergleich,
}: {
  basePrice: number | undefined;
  sym: string;
  fmt: (n: number) => string;
  onSpeichere: (preis: number) => Promise<boolean>;
  onZurueck: () => void;
  onVergleich: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [wert, setWert] = useState(basePrice != null ? String(basePrice) : "");
  const [editiert, setEditiert] = useState(basePrice == null);
  const [offen, setOffen] = useState(true);
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    setWert(basePrice != null ? String(basePrice) : "");
  }, [basePrice]);

  const zahl = Number(wert);
  const gueltig = wert !== "" && Number.isFinite(zahl) && zahl > 0;
  const geaendert = gueltig && zahl !== basePrice;
  // Breakdown-Betrag: gültige Zahl, sonst 0 — der Aufschlüsselungs-Kasten ist
  // IMMER sichtbar (Airbnb zeigt ihn auch bei €0), nur die Zahlen ändern sich.
  const betrag = gueltig ? zahl : 0;

  async function sichern() {
    setEditiert(false);
    if (!geaendert) return;
    setSpeichert(true);
    await onSpeichere(zahl);
    setSpeichert(false);
  }

  return (
    <SidebarRahmen
      titel={t("preisNachtpreis")}
      onZurueck={onZurueck}
      onVergleich={onVergleich}
      speichert={speichert}
    >
      <div className="flex items-center justify-center gap-3 py-8">
        {editiert ? (
          <label className="flex items-baseline gap-1 text-5xl font-bold tracking-tight">
            {sym && <span aria-hidden>{sym}</span>}
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={wert}
              onChange={(e) => setWert(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={sichern}
              onKeyDown={(e) => e.key === "Enter" && sichern()}
              aria-label={t("preisNachtpreis")}
              className="w-[5ch] bg-transparent text-center outline-none placeholder:text-muted-foreground/40"
              placeholder="0"
            />
          </label>
        ) : (
          <>
            <span className="text-5xl font-bold tracking-tight">
              {gueltig ? fmt(zahl) : `${sym}0`}
            </span>
            <button
              type="button"
              onClick={() => setEditiert(true)}
              aria-label={t("bearbeiten")}
              className="flex size-8 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
            >
              <Icon icon="ph:pencil-simple" className="size-4" />
            </button>
          </>
        )}
      </div>

      {/* Aufschlüsselung — IMMER sichtbar (Airbnb zeigt sie auch bei €0). */}
      <div className="space-y-4">
        {offen && (
          <>
            <div className="rounded-2xl border-2 border-foreground p-5 text-sm">
              <Zeile label={t("preisGrundpreis")} wert={fmt(betrag)} />
              <Zeile
                label={t("preisProvision", { pct: MARKTPLATZ_FEE_PCT })}
                wert={`−${fmt(marktplatzProvision(betrag))}`}
              />
              <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
                <span>{t("preisDuVerdienst")}</span>
                <span>{fmt(auszahlung(betrag))}</span>
              </div>
            </div>
            <div className="flex justify-between rounded-2xl border border-border p-5 text-sm">
              <span>{t("preisGastpreis")}</span>
              <span className="font-medium">{fmt(betrag)}</span>
            </div>
          </>
        )}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setOffen((o) => !o)}
            className="flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
          >
            {offen ? t("wenigerAnzeigen") : t("mehrAnzeigen")}
            <Icon icon={offen ? "ph:caret-up" : "ph:caret-down"} className="size-4" />
          </button>
        </div>
      </div>
    </SidebarRahmen>
  );
}

// Wochenend-Aufschlag: Slider (0–50 %) + Ergebnis-Nachtpreis. Wirkt nur bei
// aktivem Smart Pricing (Backend kennt keinen statischen Wochenend-Aufschlag) —
// deshalb ein ehrlicher Hinweis, wenn Smart Pricing aus ist (kein Fake-Effekt).
function WochenendSidebar({
  basePrice,
  weekendPct,
  fmt,
  smartAn,
  onSpeichere,
  onZurueck,
  onVergleich,
}: {
  basePrice: number | undefined;
  weekendPct: number;
  fmt: (n: number) => string;
  smartAn: boolean;
  onSpeichere: (pct: number) => Promise<boolean>;
  onZurueck: () => void;
  onVergleich: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [pct, setPct] = useState(weekendPct);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setPct(weekendPct), [weekendPct]);

  function schiebe(neu: number) {
    setPct(neu);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void onSpeichere(neu), 400);
  }

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  const hatPreis = basePrice != null && basePrice > 0;

  return (
    <SidebarRahmen
      titel={t("preisWochenende")}
      onZurueck={onZurueck}
      onVergleich={onVergleich}
    >
      <div className="flex flex-col items-center justify-center py-10">
        <p className="text-5xl font-bold tracking-tight">+{pct}%</p>
        {hatPreis && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("preisWochenendeFuer", {
              preis: fmt(wochenendPreis(basePrice, pct)),
            })}
          </p>
        )}
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={pct}
          onChange={(e) => schiebe(Number(e.target.value))}
          aria-label={t("preisWochenende")}
          className="mt-10 w-full accent-foreground"
        />
        {/* Ehrlicher Hinweis: ohne Smart Pricing greift der Uplift nicht (Wurzel 4/5
            — keine vorgegaukelte Wirkung). */}
        {!smartAn && (
          <p className="mt-8 max-w-xs text-center text-xs text-muted-foreground">
            {t("preisWochenendeBrauchtSmart")}
          </p>
        )}
      </div>
    </SidebarRahmen>
  );
}

// Smart Pricing: min/max-Preisfelder mit Vorschlag-Links.
function SmartSidebar({
  smart,
  basePrice,
  sym,
  onSpeichere,
  onZurueck,
  onVergleich,
}: {
  smart: Smart;
  basePrice: number | undefined;
  sym: string;
  onSpeichere: (neu: SmartPatch) => Promise<boolean>;
  onZurueck: () => void;
  onVergleich: () => void;
}) {
  const t = useTranslations("objektEditor");
  const an = smart.enabled === true;

  // Vorschlagswerte relativ zum Grundpreis — reine Klick-Vorschläge, kein Auto-Wert.
  const minTipp = basePrice ? Math.round(basePrice * 0.5) : null;
  const maxTipp = basePrice ? Math.round(basePrice * 2) : null;

  return (
    <SidebarRahmen
      titel={t("preisSmart")}
      onZurueck={onZurueck}
      onVergleich={onVergleich}
    >
      <p className="text-sm text-muted-foreground">{t("preisSmartLang")}</p>
      {an ? (
        <div className="mt-6 space-y-4">
          <PreisFeld
            label={t("preisMin")}
            sym={sym}
            wert={smart.min_price ?? undefined}
            tipp={minTipp}
            onSpeichere={(v) => onSpeichere({ min_price: v })}
          />
          <PreisFeld
            label={t("preisMax")}
            sym={sym}
            wert={smart.max_price ?? undefined}
            tipp={maxTipp}
            onSpeichere={(v) => onSpeichere({ max_price: v })}
          />
          <p className="pt-2 text-xs text-muted-foreground">{t("preisSmartStern")}</p>
        </div>
      ) : (
        <div className="flex items-center justify-center py-16">
          <p className="text-center text-sm text-muted-foreground">
            {t("preisSmartAusHint")}
          </p>
        </div>
      )}
    </SidebarRahmen>
  );
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                          */
/* ------------------------------------------------------------------ */

function SidebarRahmen({
  titel,
  onZurueck,
  onVergleich,
  speichert,
  children,
}: {
  titel: string;
  onZurueck: () => void;
  // „Ähnliche Inserate ansehen" — optional; nur die Preis-Detailscreens zeigen ihn.
  onVergleich?: () => void;
  speichert?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("objektEditor");
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-8 lg:px-10 lg:pt-10">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onZurueck}
            aria-label={t("schliessen")}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>
        <h2 className="font-sans text-[1.75rem] font-bold tracking-tight">{titel}</h2>
        <div className="mt-4">{children}</div>

        {/* „Ähnliche Inserate ansehen" (Airbnb-Vergleichslink) — auf den
            Preis-Detailscreens, öffnet die Marktumfeld-Preisvergleichskarte. */}
        {onVergleich && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onVergleich}
              className="text-sm font-semibold underline underline-offset-4 hover:opacity-80"
            >
              {t("preisVergleich")}
            </button>
          </div>
        )}
      </div>
      {speichert && (
        <p className="shrink-0 px-8 pb-4 text-center text-xs text-muted-foreground lg:px-10">
          {t("speichert")}
        </p>
      )}
    </div>
  );
}

function KachelButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-2xl border border-border p-6 text-left outline-none transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-foreground/20"
    >
      {children}
    </button>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{wert}</span>
    </div>
  );
}

function Toggle({ an, onChange }: { an: boolean; onChange: (an: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      onClick={() => onChange(!an)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        an ? "bg-foreground" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block size-5 rounded-full bg-background shadow transition-transform ${
          an ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// Preisfeld mit Symbol + „Vorschlag"-Link (Airbnb „Try €28"). Speichert bei Blur.
function PreisFeld({
  label,
  sym,
  wert,
  tipp,
  onSpeichere,
}: {
  label: string;
  sym: string;
  wert: number | undefined;
  tipp: number | null;
  onSpeichere: (v: number) => Promise<boolean>;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState(wert != null ? String(wert) : "");

  useEffect(() => setLokal(wert != null ? String(wert) : ""), [wert]);

  function sichern() {
    const z = Number(lokal);
    if (lokal !== "" && Number.isFinite(z) && z >= 0 && z !== wert) void onSpeichere(z);
  }

  return (
    <div className="rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {tipp != null && (
          <button
            type="button"
            onClick={() => {
              setLokal(String(tipp));
              void onSpeichere(tipp);
            }}
            className="text-sm font-medium underline underline-offset-2 hover:opacity-80"
          >
            {t("preisTipp", { betrag: `${sym}${tipp}` })}
          </button>
        )}
      </div>
      <label className="mt-2 flex items-baseline gap-1 text-2xl font-bold">
        {sym && <span aria-hidden>{sym}</span>}
        <input
          type="text"
          inputMode="numeric"
          value={lokal}
          onChange={(e) => setLokal(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={sichern}
          aria-label={label}
          className="w-[6ch] bg-transparent outline-none placeholder:text-muted-foreground/40"
          placeholder="0"
        />
      </label>
    </div>
  );
}

// Rabatt-Zeile (Wochen-/Monatsrabatt) mit Prozent-Eingabe + Speichern bei Blur.
// Leeres Feld → Rabatt löschen (undefined nach oben).
function RabattZeile({
  titel,
  hint,
  pct,
  onSpeichere,
}: {
  titel: string;
  hint: string;
  pct: number | undefined;
  onSpeichere: (pct: number | undefined) => Promise<boolean>;
}) {
  const [lokal, setLokal] = useState(pct != null ? String(pct) : "");

  useEffect(() => setLokal(pct != null ? String(pct) : ""), [pct]);

  function sichern() {
    if (lokal === "") {
      if (pct != null) void onSpeichere(undefined);
      return;
    }
    const z = Number(lokal);
    if (Number.isFinite(z) && z >= 0 && z <= 100 && z !== pct) void onSpeichere(z);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-6">
      <div className="min-w-0">
        <p className="font-semibold">{titel}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
      <label className="flex shrink-0 items-baseline gap-0.5 text-xl font-bold">
        <input
          type="text"
          inputMode="numeric"
          value={lokal}
          onChange={(e) => setLokal(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={sichern}
          aria-label={titel}
          className="w-[3ch] bg-transparent text-right outline-none placeholder:text-muted-foreground/40"
          placeholder="0"
        />
        <span aria-hidden>%</span>
      </label>
    </div>
  );
}

// Marktvergleich-Overlay (Airbnb „Compare similar listings"): Vollbild-Karte mit
// Preis-Pins der echten Marktplatz-Nachbarn, das eigene Objekt rot hervorgehoben,
// rechts oben die Info-Karte (Typ · Preisspanne). ECHTE Google-Karte
// (@vis.gl/react-google-maps, Key aus NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). Ohne
// Vergleichsdaten ein ehrlicher Leerhinweis (Wurzel 4).
function VergleichModal({
  zustand,
  currency,
  onSchliessen,
}: {
  zustand: MarktVergleich | "laedt" | null;
  currency: string | null;
  onSchliessen: () => void;
}) {
  const t = useTranslations("objektEditor");
  const offen = zustand != null;
  const fmt = (n: number) => formatCurrency(n, currency, "de-DE", 0);
  const daten = zustand != null && zustand !== "laedt" ? zustand : null;

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onSchliessen()}>
      {/* Vollbild-Overlay statt zentriertem Kärtchen (Airbnb-Karten-Screen). */}
      <DialogContent
        showCloseButton={false}
        className="h-[90vh] w-[94vw] max-w-none overflow-hidden p-0 sm:rounded-3xl"
      >
        <DialogTitle className="sr-only">{t("preisVergleichTitel")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("preisVergleichTitel")}
        </DialogDescription>

        <div className="relative size-full">
          {/* Schließen-X oben links (Airbnb). */}
          <button
            type="button"
            onClick={onSchliessen}
            aria-label={t("schliessen")}
            className="absolute left-5 top-5 z-20 flex size-10 items-center justify-center rounded-full bg-background shadow-md transition-colors hover:bg-muted"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>

          {zustand === "laedt" && (
            <div className="flex size-full items-center justify-center bg-muted/30">
              <Icon icon="ph:spinner-gap" className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {daten && (daten.punkte.length > 0 ? (
            <VergleichKarte punkte={daten.punkte} fmt={fmt} />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground">
              {t("preisVergleichLeer")}
            </div>
          ))}

          {/* Info-Karte rechts oben (Airbnb) — nur mit echten Daten. */}
          {daten && daten.anzahl > 0 && daten.min != null && daten.max != null && (
            <div className="absolute right-5 top-5 z-20 w-80 max-w-[calc(100%-2.5rem)] rounded-2xl bg-background p-6 shadow-xl">
              <h2 className="text-xl font-bold tracking-tight">
                {t("preisVergleichTitel")}
              </h2>
              {daten.eigenesTyp && (
                <p className="mt-1 text-sm text-muted-foreground">{daten.eigenesTyp}</p>
              )}
              <div className="my-5 border-t border-border" />
              <h3 className="font-semibold">{t("preisVergleichGebucht")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("preisVergleichSpanne", {
                  n: daten.anzahl,
                  von: fmt(daten.min),
                  bis: fmt(daten.max),
                })}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Google-Karte mit Preis-Pins. Zentriert/zoomt automatisch auf die Bounding-Box
// aller Punkte. Eigenes Objekt rot (Airbnb-Muster), Nachbarn hell mit Preis.
function VergleichKarte({
  punkte,
  fmt,
}: {
  punkte: NonNullable<MarktVergleich>["punkte"];
  fmt: (n: number) => string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Kartenmittelpunkt = Schwerpunkt aller Punkte (echte Koordinaten).
  const center = {
    lat: punkte.reduce((s, p) => s + p.lat, 0) / punkte.length,
    lng: punkte.reduce((s, p) => s + p.lng, 0) / punkte.length,
  };

  if (!apiKey) {
    // Kein Key konfiguriert → ehrlich melden statt weiße Fläche (Wurzel 4/5).
    return (
      <div className="flex size-full items-center justify-center bg-muted/30 px-6 text-center text-sm text-muted-foreground">
        Kartenschlüssel fehlt.
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={center}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        className="size-full"
      >
        {/* Klassische Marker (ohne registrierte mapId). Preis als Text-Label über
            dem Pin; das eigene Objekt farblich hervorgehoben. Preis 0 (eigenes,
            evtl. draft) ohne Label — nur Standort-Pin. */}
        {punkte.map((p) => (
          <Marker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            label={
              !p.eigenes && p.preis > 0
                ? { text: fmt(p.preis), fontSize: "12px", fontWeight: "600" }
                : undefined
            }
            icon={
              p.eigenes
                ? {
                    path: 0, // google.maps.SymbolPath.CIRCLE
                    scale: 8,
                    fillColor: "#e11d48",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                  }
                : undefined
            }
          />
        ))}
      </Map>
    </APIProvider>
  );
}
