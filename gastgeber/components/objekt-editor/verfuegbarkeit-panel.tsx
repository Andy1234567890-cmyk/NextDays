"use client";

// „Verfügbarkeit" (Airbnb „Availability"). Karten links (Mindest-/Maximal-
// aufenthalt, Vorlaufzeit, Buchungsfenster, Mindestaufenthalt-Typ), Klick öffnet
// rechts eine Inline-Detail-Sidebar (dieselbe Mechanik wie Preise/Lage).
//
// WICHTIG — an die ECHTE Verfügbarkeits-Wahrheit angeschlossen (Wurzel 4, kein
// erfundenes Feld):
//   • Mindestaufenthalt → rate_plans.min_stay        (onMinStay → PATCH /rates/{id})
//   • Max-Aufenthalt/Vorlaufzeit/Buchungsfenster/Typ → type_attributes.availability
//     (onBlob → generisches Property-Update); real vom Channex-Content-Sync gelesen
//     (channel_manager/common.py). Datumsgenaue Regeln macht der Kalender.
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { Property } from "@/lib/properties";

// Geltung des Mindestaufenthalts (Channex min_stay_type).
type MinStayType = "both" | "arrival" | "through";

type Detail = "minStay" | "maxStay" | "cutOff" | "window" | "minStayType";

// Verfügbarkeits-Blob-Werte (type_attributes.availability), die dieses Panel setzt.
type AvailBlob = {
  maxStay?: number;
  cutOffDays?: number;
  maxDayAdvance?: number;
  minStayType?: MinStayType;
};

export function VerfuegbarkeitPanel({
  property,
  minStay,
  onMinStay,
  onBlob,
  onDetailOffen,
}: {
  property: Property;
  // Objektweiter Mindestaufenthalt (rate_plans.min_stay).
  minStay: number;
  onMinStay: (naechte: number) => Promise<boolean>;
  // type_attributes.availability gemergt patchen (max_stay/cutOff/window/typ).
  onBlob: (teil: AvailBlob) => Promise<boolean>;
  // Meldet dem Editor, ob eine Detail-Sidebar offen ist (linke Liste ausblenden).
  onDetailOffen?: (offen: boolean) => void;
}) {
  const t = useTranslations("objektEditor");
  const reduziert = useReducedMotion();
  const [detail, setDetailState] = useState<Detail | null>(null);
  function setDetail(d: Detail | null) {
    setDetailState(d);
    onDetailOffen?.(d != null);
  }

  const av = property.type_attributes?.availability ?? {};
  const maxStay = Math.max(0, av.maxStay ?? 0);
  const cutOffDays = Math.max(0, av.cutOffDays ?? 0);
  const maxDayAdvance = Math.max(0, av.maxDayAdvance ?? 0);
  const minStayType: MinStayType = av.minStayType ?? "both";

  const naechte = (n: number) => (n === 1 ? t("verfNachtEinzahl") : t("verfNaechte", { n }));
  const typLabel = (typ: MinStayType) =>
    typ === "arrival"
      ? t("verfMinStayTypeArrival")
      : typ === "through"
        ? t("verfMinStayTypeThrough")
        : t("verfMinStayTypeBoth");

  return (
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:py-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-sans text-[2rem] font-bold tracking-tight">
            {t("secVerfuegbarkeit")}
          </h2>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">{t("verfHint")}</p>

          <div className="mt-8 space-y-4">
            <KachelButton
              titel={t("verfMinStay")}
              wert={naechte(minStay)}
              onClick={() => setDetail("minStay")}
            />
            <KachelButton
              titel={t("verfMaxStay")}
              wert={maxStay > 0 ? naechte(maxStay) : t("verfMaxStayUnbegrenzt")}
              onClick={() => setDetail("maxStay")}
            />
            <KachelButton
              titel={t("verfCutOff")}
              wert={cutOffDays > 0 ? t("verfCutOffTage", { n: cutOffDays }) : t("verfCutOffOhne")}
              onClick={() => setDetail("cutOff")}
            />
            <KachelButton
              titel={t("verfWindow")}
              wert={
                maxDayAdvance > 0 ? t("verfWindowTage", { n: maxDayAdvance }) : t("verfWindowOhne")
              }
              onClick={() => setDetail("window")}
            />
            <KachelButton
              titel={t("verfMinStayType")}
              wert={typLabel(minStayType)}
              onClick={() => setDetail("minStayType")}
            />

            <div className="flex items-center gap-3 rounded-2xl bg-muted/40 px-6 py-5 text-sm text-muted-foreground">
              <Icon icon="ph:calendar-blank" className="size-5 shrink-0" />
              <span>{t("verfKalenderVerweis")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Inline-Detail-Sidebar (kein Overlay): fährt aus, schiebt die Karten zusammen. */}
      <AnimatePresence initial={false}>
        {detail != null && (
          <motion.aside
            key="verf-sidebar"
            className="shrink-0 overflow-hidden border-l border-border"
            initial={reduziert ? false : { width: 0, opacity: 0 }}
            animate={{ width: "32rem", opacity: 1 }}
            exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={reduziert ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
          >
            <div className="h-full w-[32rem]">
              {detail === "minStay" && (
                <NaechteSidebar
                  titel={t("verfMinStay")}
                  hint={t("verfMinStayHint")}
                  wert={minStay}
                  min={1}
                  onSpeichere={onMinStay}
                  onZurueck={() => setDetail(null)}
                />
              )}
              {detail === "maxStay" && (
                <NaechteSidebar
                  titel={t("verfMaxStay")}
                  hint={t("verfMaxStayHint")}
                  wert={maxStay}
                  min={0}
                  nullLabel={t("verfMaxStayUnbegrenzt")}
                  onSpeichere={(n) => onBlob({ maxStay: n })}
                  onZurueck={() => setDetail(null)}
                />
              )}
              {detail === "cutOff" && (
                <NaechteSidebar
                  titel={t("verfCutOff")}
                  hint={t("verfCutOffHint")}
                  wert={cutOffDays}
                  min={0}
                  einheitTage
                  nullLabel={t("verfCutOffOhne")}
                  onSpeichere={(n) => onBlob({ cutOffDays: n })}
                  onZurueck={() => setDetail(null)}
                />
              )}
              {detail === "window" && (
                <NaechteSidebar
                  titel={t("verfWindow")}
                  hint={t("verfWindowHint")}
                  wert={maxDayAdvance}
                  min={0}
                  einheitTage
                  nullLabel={t("verfWindowOhne")}
                  onSpeichere={(n) => onBlob({ maxDayAdvance: n })}
                  onZurueck={() => setDetail(null)}
                />
              )}
              {detail === "minStayType" && (
                <TypSidebar
                  wert={minStayType}
                  onSpeichere={(typ) => onBlob({ minStayType: typ })}
                  onZurueck={() => setDetail(null)}
                />
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebars                                                           */
/* ------------------------------------------------------------------ */

// Zahl-Eingabe (Nächte oder Tage) mit Stepper. min=0 erlaubt „kein Limit" (0).
function NaechteSidebar({
  titel,
  hint,
  wert,
  min,
  einheitTage,
  nullLabel,
  onSpeichere,
  onZurueck,
}: {
  titel: string;
  hint: string;
  wert: number;
  min: number;
  einheitTage?: boolean;
  // Label für den 0-Wert (z. B. „Kein Limit"); nur wenn min===0.
  nullLabel?: string;
  onSpeichere: (n: number) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [n, setN] = useState(wert);
  const [speichert, setSpeichert] = useState(false);
  useEffect(() => setN(wert), [wert]);

  const geaendert = n !== wert;
  const label =
    n <= 0 && nullLabel
      ? nullLabel
      : einheitTage
        ? t("verfTage", { n })
        : n === 1
          ? t("verfNachtEinzahl")
          : t("verfNaechte", { n });

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere(Math.max(min, Math.round(n)));
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen
      titel={titel}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
    >
      <p className="text-sm text-muted-foreground">{hint}</p>
      <div className="mt-10 flex flex-col items-center">
        <p className="text-5xl font-bold tracking-tight">{label}</p>
        <div className="mt-10 flex items-center gap-6">
          <button
            type="button"
            aria-label="−1"
            disabled={n <= min}
            onClick={() => setN((v) => Math.max(min, v - 1))}
            className="flex size-11 items-center justify-center rounded-full border border-border transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon icon="ph:minus" className="size-4" />
          </button>
          <span className="min-w-10 text-center text-2xl font-semibold tabular-nums">{n}</span>
          <button
            type="button"
            aria-label="+1"
            onClick={() => setN((v) => v + 1)}
            className="flex size-11 items-center justify-center rounded-full border border-border transition-colors hover:border-foreground"
          >
            <Icon icon="ph:plus" className="size-4" />
          </button>
        </div>
      </div>
    </SidebarRahmen>
  );
}

// Mindestaufenthalt-Typ (both/arrival/through) als Radio-Liste.
function TypSidebar({
  wert,
  onSpeichere,
  onZurueck,
}: {
  wert: MinStayType;
  onSpeichere: (typ: MinStayType) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [typ, setTyp] = useState<MinStayType>(wert);
  const [speichert, setSpeichert] = useState(false);
  useEffect(() => setTyp(wert), [wert]);

  const geaendert = typ !== wert;
  const optionen: { key: MinStayType; label: string }[] = [
    { key: "both", label: t("verfMinStayTypeBoth") },
    { key: "arrival", label: t("verfMinStayTypeArrival") },
    { key: "through", label: t("verfMinStayTypeThrough") },
  ];

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere(typ);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <SidebarRahmen
      titel={t("verfMinStayType")}
      onZurueck={onZurueck}
      onSpeichern={speichern}
      speichert={speichert}
      speichernAus={!geaendert}
    >
      <p className="text-sm text-muted-foreground">{t("verfMinStayTypeHint")}</p>
      <div className="mt-6 space-y-3">
        {optionen.map((o) => {
          const aktiv = typ === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setTyp(o.key)}
              className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-colors ${
                aktiv ? "border-foreground bg-muted/50" : "border-border hover:border-foreground"
              }`}
            >
              <span className="font-medium">{o.label}</span>
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  aktiv ? "border-foreground" : "border-border"
                }`}
              >
                {aktiv && <span className="size-2.5 rounded-full bg-foreground" />}
              </span>
            </button>
          );
        })}
      </div>
    </SidebarRahmen>
  );
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                          */
/* ------------------------------------------------------------------ */

function SidebarRahmen({
  titel,
  onZurueck,
  onSpeichern,
  speichert,
  speichernAus,
  children,
}: {
  titel: string;
  onZurueck: () => void;
  onSpeichern: () => void;
  speichert?: boolean;
  speichernAus?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("objektEditor");
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8">
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
      </div>

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
  titel,
  wert,
  onClick,
}: {
  titel: string;
  wert: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-2xl border border-border p-6 text-left outline-none transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-foreground/20"
    >
      <p className="text-sm font-medium text-muted-foreground">{titel}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{wert}</p>
    </button>
  );
}
