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
import { useEffect, useState } from "react";

import { currencySymbol, formatCurrency } from "@nextdays/currency";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";

import type { MarktVergleich, PreisStand, SmartVorschlag } from "@/lib/preise";
import { ladeMarktVergleich, ladeSmartVorschlag } from "@/lib/preise-actions";

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
  onDetailOffen,
}: {
  preise: PreisStand;
  currency: string | null;
  // Für den Marktvergleich (echte Marktplatz-Inserate im Umkreis).
  propertyId: string;
  koords: { lat: number; lng: number } | null;
  guests: number;
  onGrundpreis: (basePrice: number) => Promise<boolean>;
  onSmart: (fields: SmartPatch) => Promise<boolean>;
  // Meldet dem Editor, ob eine Detail-Sidebar offen ist — dann blendet der Editor
  // die linke Abschnittsliste aus (Airbnb: Klick auf eine Karte → links ausblenden).
  onDetailOffen?: (offen: boolean) => void;
}) {
  const t = useTranslations("objektEditor");
  const reduziert = useReducedMotion();
  // Detail-Sidebar (Airbnb): standardmäßig ZU (null). Klick auf eine Karte öffnet
  // sie inline; X/Zurück schließt sie wieder. Jede Änderung wird nach oben gemeldet.
  const [detail, setDetailState] = useState<Detail | null>(null);
  function setDetail(d: Detail | null) {
    setDetailState(d);
    onDetailOffen?.(d != null);
  }
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
    // Inline-Layout: links die Karten (flex-1), rechts die Detail-Sidebar als
    // EIGENE Spalte, die per Breiten-Animation ausfährt und die Karten daneben
    // schrumpfen lässt (kein Overlay — die Sidebar liegt NEBEN, nicht ÜBER dem
    // Inhalt).
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:py-12">
        <div className="mx-auto max-w-2xl">
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
              onChange={(an) => {
                void onSmart({ enabled: an });
                // Beim EINSCHALTEN die rechte Spalte auf das Smart-Detail wechseln.
                if (an) setDetail("smart");
              }}
            />
          </div>

          {/* „Weitere Rabatte & Gebühren im Kalender" (Airbnb-Verweis). */}
          <div className="flex items-center gap-3 rounded-2xl bg-muted/40 px-6 py-5 text-sm text-muted-foreground">
            <Icon icon="ph:arrow-square-out" className="size-5 shrink-0" />
            <span>{t("preisKalenderVerweis")}</span>
          </div>
        </div>
        </div>
      </section>

      {/* Detail-Sidebar als INLINE-Spalte (kein Overlay): fährt per Breiten-
          Animation (0 → 32rem) aus und schiebt die Karten daneben zusammen. X
          schließt sie. */}
      <AnimatePresence initial={false}>
        {detail != null && (
          <motion.aside
            key="preis-sidebar"
            className="shrink-0 overflow-hidden border-l border-border"
            initial={reduziert ? false : { width: 0, opacity: 0 }}
            animate={{ width: "32rem", opacity: 1 }}
            exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={
              reduziert ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            <div className="h-full w-[32rem]">
            {detail === "base" && (
              <NachtpreisSidebar
                basePrice={basePrice}
                sym={sym}
                fmt={fmt}
                onSpeichere={onGrundpreis}
                onVergleich={oeffneVergleich}
                onZurueck={() => setDetail(null)}
              />
            )}
            {detail === "weekend" && (
              <WochenendSidebar
                basePrice={basePrice}
                weekendPct={weekendPct}
                fmt={fmt}
                smartAn={smartAn}
                onSpeichere={(pct) => onSmart({ weekend_uplift_pct: pct })}
                onVergleich={oeffneVergleich}
                onZurueck={() => setDetail(null)}
              />
            )}
            {detail === "smart" && (
              <SmartSidebar
                smart={preise.smart}
                propertyId={propertyId}
                sym={sym}
                onSpeichere={onSmart}
                onVergleich={oeffneVergleich}
                onZurueck={() => setDetail(null)}
              />
            )}
            </div>
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
  currency,
  onRabatt,
}: {
  preise: PreisStand;
  currency: string | null;
  onRabatt: (minNights: 7 | 28, pct: number | undefined) => Promise<boolean>;
}) {
  const t = useTranslations("objektEditor");

  const basePrice = preise.basePrice ?? 0;
  const weeklyPct = preise.weeklyDiscount ? preise.weeklyDiscount.discount_bps / 100 : 0;
  const monthlyPct = preise.monthlyDiscount ? preise.monthlyDiscount.discount_bps / 100 : 0;
  // Durchschnittlicher Aufenthaltspreis nach Rabatt (Airbnb „Weekly average is €X"):
  // Grundpreis × Nächte × (1 − Rabatt). Nur mit gesetztem Grundpreis (kein Fake).
  const schnitt = (naechte: number, pct: number) =>
    basePrice > 0
      ? formatCurrency(Math.round(basePrice * naechte * (1 - pct / 100)), currency, "de-DE", 0)
      : null;
  const wochenSchnitt = schnitt(7, weeklyPct);
  const monatsSchnitt = schnitt(28, monthlyPct);

  return (
    <section className="mx-auto max-w-2xl px-8 py-8 lg:py-12">
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
          avg={wochenSchnitt ? t("preisWochenschnitt", { preis: wochenSchnitt }) : null}
          onSpeichere={(pct) => onRabatt(7, pct)}
        />
        <RabattZeile
          titel={t("preisMonatsrabatt")}
          hint={t("preisMonatsrabattHint")}
          pct={
            preise.monthlyDiscount ? preise.monthlyDiscount.discount_bps / 100 : undefined
          }
          avg={monatsSchnitt ? t("preisMonatsschnitt", { preis: monatsSchnitt }) : null}
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
  onVergleich,
  onZurueck,
}: {
  basePrice: number | undefined;
  sym: string;
  fmt: (n: number) => string;
  onSpeichere: (preis: number) => Promise<boolean>;
  onVergleich: () => void;
  onZurueck: () => void;
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

  // Speichern über den Fuß-Button — nur wenn geändert und gültig; danach schließen.
  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere(zahl);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen
      titel={t("preisNachtpreis")}
      onVergleich={onVergleich}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
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
              onBlur={() => setEditiert(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditiert(false)}
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
  onVergleich,
  onZurueck,
}: {
  basePrice: number | undefined;
  weekendPct: number;
  fmt: (n: number) => string;
  smartAn: boolean;
  onSpeichere: (pct: number) => Promise<boolean>;
  onVergleich: () => void;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [pct, setPct] = useState(weekendPct);
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => setPct(weekendPct), [weekendPct]);

  const geaendert = pct !== weekendPct;

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere(pct);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  const hatPreis = basePrice != null && basePrice > 0;

  return (
    <SidebarRahmen
      titel={t("preisWochenende")}
      onVergleich={onVergleich}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
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
          onChange={(e) => setPct(Number(e.target.value))}
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
  propertyId,
  sym,
  onSpeichere,
  onVergleich,
  onZurueck,
}: {
  smart: Smart;
  propertyId: string;
  sym: string;
  onSpeichere: (neu: SmartPatch) => Promise<boolean>;
  onVergleich: () => void;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const an = smart.enabled === true;

  // Vorschlagswerte aus der ECHTEN Dynamic-Pricing-Engine (min/max der
  // nachfrage-getriebenen Tagespreise), NICHT aus einem geratenen Multiplikator
  // (Wurzel 4). Lazy geladen, sobald Smart Pricing an ist. null = kein Vorschlag
  // (dann kein „Try €X"-Link statt einer erfundenen Zahl).
  const [vorschlag, setVorschlag] = useState<SmartVorschlag | null>(null);
  useEffect(() => {
    if (!an) return;
    let aktiv = true;
    ladeSmartVorschlag(propertyId).then((v) => {
      if (aktiv) setVorschlag(v);
    });
    return () => {
      aktiv = false;
    };
  }, [an, propertyId]);
  const minTipp = vorschlag?.available ? vorschlag.min_price : null;
  const maxTipp = vorschlag?.available ? vorschlag.max_price : null;

  // min/max lokal sammeln; über den Fuß speichern.
  const [minWert, setMinWert] = useState<number | null>(smart.min_price);
  const [maxWert, setMaxWert] = useState<number | null>(smart.max_price);
  const [speichert, setSpeichert] = useState(false);
  useEffect(() => setMinWert(smart.min_price), [smart.min_price]);
  useEffect(() => setMaxWert(smart.max_price), [smart.max_price]);

  const geaendert = minWert !== smart.min_price || maxWert !== smart.max_price;

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere({ min_price: minWert, max_price: maxWert });
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen
      titel={t("preisSmart")}
      onVergleich={onVergleich}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
    >
      <p className="text-sm text-muted-foreground">{t("preisSmartLang")}</p>
      {an ? (
        <div className="mt-6 space-y-4">
          <PreisFeld
            label={t("preisMin")}
            sym={sym}
            wert={minWert ?? undefined}
            tipp={minTipp}
            onChange={setMinWert}
          />
          <PreisFeld
            label={t("preisMax")}
            sym={sym}
            wert={maxWert ?? undefined}
            tipp={maxTipp}
            onChange={setMaxWert}
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
  onVergleich,
  onZurueck,
  onSpeichern,
  speichert,
  speichernAus,
  children,
}: {
  titel: string;
  // „Ähnliche Inserate ansehen" — optional; nur die Preis-Detailscreens zeigen ihn.
  onVergleich?: () => void;
  // Sidebar schließen (X oben rechts + „Abbrechen" im Fuß, Airbnb-Muster).
  onZurueck: () => void;
  // Speichern-Button im Fuß.
  onSpeichern: () => void;
  speichert?: boolean;
  speichernAus?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("objektEditor");
  return (
    <div className="flex h-full flex-col">
      {/* Scrollender Inhalt. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8">
        {/* Schließen-X oben rechts (Airbnb). */}
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onZurueck}
            aria-label={t("schliessen")}
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>
        <h2 className="font-sans text-[1.5rem] font-bold tracking-tight">{titel}</h2>
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

      {/* Fester Save/Cancel-Fuß am unteren Rand der Sidebar (Airbnb). */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4">
        <button
          type="button"
          onClick={onZurueck}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("abbrechen")}
        </button>
        <button
          type="button"
          onClick={onSpeichern}
          disabled={speichert || speichernAus}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {speichert ? t("speichert") : t("speichern")}
        </button>
      </div>
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

// Preisfeld mit Symbol + „Vorschlag"-Link (Airbnb „Try €28"). Meldet Änderungen
// nach oben (onChange) — gespeichert wird über den Save/Cancel-Fuß der Sidebar,
// nicht direkt hier. Leeres Feld = null (kein Wert gesetzt).
function PreisFeld({
  label,
  sym,
  wert,
  tipp,
  onChange,
}: {
  label: string;
  sym: string;
  wert: number | undefined;
  tipp: number | null;
  onChange: (v: number | null) => void;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState(wert != null ? String(wert) : "");

  useEffect(() => setLokal(wert != null ? String(wert) : ""), [wert]);

  // Eingabe säubern, lokal halten UND nach oben melden (leer → null).
  function aendern(roh: string) {
    const clean = roh.replace(/[^\d]/g, "");
    setLokal(clean);
    if (clean === "") onChange(null);
    else {
      const z = Number(clean);
      if (Number.isFinite(z)) onChange(z);
    }
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
              onChange(tipp);
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
          onChange={(e) => aendern(e.target.value)}
          aria-label={label}
          className="w-[6ch] bg-transparent outline-none placeholder:text-muted-foreground/40"
          placeholder="0"
        />
      </label>
    </div>
  );
}

// Rabatt-Karte im Airbnb-„Discounts"-Look: oben Titel · Kurzbeschreibung (links)
// und der Durchschnittspreis (rechts, „Wochenschnitt: €385"), darunter der große
// Prozentwert mit Eingabe. Speichern bei Blur; leeres Feld → Rabatt löschen.
function RabattZeile({
  titel,
  hint,
  pct,
  avg,
  onSpeichere,
}: {
  titel: string;
  hint: string;
  pct: number | undefined;
  // Durchschnittspreis-Hinweis (Airbnb „Weekly average is €X"); null = kein Preis.
  avg: string | null;
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
    <div className="rounded-2xl border border-border p-6">
      {/* Kopf: Titel · Kurzbeschreibung links, Durchschnitt rechts (Airbnb). */}
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 text-sm font-medium text-muted-foreground">
          <span className="font-semibold text-foreground">{titel}</span>
          <span className="mx-1.5" aria-hidden>·</span>
          {hint}
        </p>
        {avg && <p className="shrink-0 text-sm text-muted-foreground">{avg}</p>}
      </div>
      {/* Großer Prozentwert mit Inline-Eingabe (Airbnb: „7%"). */}
      <label className="mt-2 flex items-baseline gap-0.5 text-3xl font-bold tracking-tight">
        <input
          type="text"
          inputMode="numeric"
          value={lokal}
          onChange={(e) => setLokal(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={sichern}
          aria-label={titel}
          className="w-[2.5ch] bg-transparent outline-none placeholder:text-muted-foreground/40"
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
