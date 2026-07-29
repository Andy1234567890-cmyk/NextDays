"use client";

// „Beschreibung" (Airbnb „Description"). Linke Liste aus Unterabschnitten
// (Angebotsbeschreibung, Ihr Eigentum, Gastzugang, Interaktion mit Gästen,
// Weitere Details); Klick öffnet rechts eine Inline-Text-Sidebar mit
// Zeichenzähler + Abbrechen/Speichern (dieselbe Mechanik wie Preise/Lage/
// Verfügbarkeit — kein Overlay, die Karten schieben zusammen).
//
// An die ECHTE Datenwahrheit angeschlossen (Wurzel 4, kein erfundenes Feld):
//   • Angebotsbeschreibung → properties.description (Top-Level-Spalte, an
//     Channex/OTAs gesynct) — onDescription.
//   • Ihr Eigentum / Gastzugang / Interaktion / Weitere Details →
//     type_attributes.descriptions.{space,access,interaction,notes} — onBlob.
//     Airbnb-spezifisch, kein OTA-Zielfeld; reine Objektdaten.
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { Property } from "@/lib/properties";

// Schlüssel der type_attributes.descriptions-Zusatzfelder.
type BlobKey = "space" | "access" | "interaction" | "notes";
// Der offene Abschnitt: die Haupt-Beschreibung oder einer der Blob-Zusätze.
type Detail = "description" | BlobKey;

export function BeschreibungPanel({
  property,
  onDescription,
  onBlob,
  onDetailOffen,
}: {
  property: Property;
  // Haupt-„Angebotsbeschreibung" → properties.description.
  onDescription: (text: string) => Promise<boolean>;
  // Zusatztext → type_attributes.descriptions[key] gemergt.
  onBlob: (key: BlobKey, text: string) => Promise<boolean>;
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

  const desc = property.description ?? "";
  const zusatz = property.type_attributes?.descriptions ?? {};

  // Airbnb-Zeichenlimits: Haupttext 500, Zusätze 500 (Airbnb erlaubt hier je 500).
  const abschnitte: {
    key: Detail;
    titel: string;
    hint: string;
    wert: string;
    maxLen: number;
  }[] = [
    {
      key: "description",
      titel: t("beschAngebotTitel"),
      hint: t("beschAngebotHint"),
      wert: desc,
      maxLen: 500,
    },
    {
      key: "space",
      titel: t("beschEigentumTitel"),
      hint: t("beschEigentumHint"),
      wert: zusatz.space ?? "",
      maxLen: 500,
    },
    {
      key: "access",
      titel: t("beschZugangTitel"),
      hint: t("beschZugangHint"),
      wert: zusatz.access ?? "",
      maxLen: 500,
    },
    {
      key: "interaction",
      titel: t("beschInteraktionTitel"),
      hint: t("beschInteraktionHint"),
      wert: zusatz.interaction ?? "",
      maxLen: 500,
    },
    {
      key: "notes",
      titel: t("beschWeitereTitel"),
      hint: t("beschWeitereHint"),
      wert: zusatz.notes ?? "",
      maxLen: 500,
    },
  ];

  const offen = abschnitte.find((a) => a.key === detail) ?? null;

  return (
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:py-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-sans text-[2rem] font-bold tracking-tight">
            {t("secBeschreibung")}
          </h2>

          <div className="mt-8 space-y-3">
            {abschnitte.map((a) => {
              // Vorschau: der gepflegte Text (gekürzt) oder der Hint als „Details
              // hinzufügen"-Ersatz (Airbnb zeigt beim leeren Abschnitt den Hint).
              const vorschau = a.wert.trim() || t("beschDetailsHinzufuegen");
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setDetail(a.key)}
                  className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-6 text-start outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground/20 ${
                    detail === a.key
                      ? "border-2 border-foreground"
                      : "border border-border hover:shadow-md"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{a.titel}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                      {vorschau}
                    </span>
                  </span>
                  <Icon
                    icon="ph:caret-right"
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Inline-Text-Sidebar (kein Overlay): fährt aus, schiebt die Karten zusammen. */}
      <AnimatePresence initial={false}>
        {offen != null && (
          <motion.aside
            key="besch-sidebar"
            className="shrink-0 overflow-hidden border-s border-border"
            initial={reduziert ? false : { width: 0, opacity: 0 }}
            animate={{ width: "32rem", opacity: 1 }}
            exit={reduziert ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={
              reduziert ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }
            }
          >
            <div className="h-full w-[32rem]">
              <TextSidebar
                titel={offen.titel}
                hint={offen.hint}
                wert={offen.wert}
                maxLen={offen.maxLen}
                onSpeichere={(text) =>
                  offen.key === "description"
                    ? onDescription(text)
                    : onBlob(offen.key, text)
                }
                onZurueck={() => setDetail(null)}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                            */
/* ------------------------------------------------------------------ */

// Textfeld mit Zeichenzähler + Abbrechen/Speichern-Fuß. Speichert erst beim
// Klick (Airbnb-Detail-Sidebar), schließt bei Erfolg.
function TextSidebar({
  titel,
  hint,
  wert,
  maxLen,
  onSpeichere,
  onZurueck,
}: {
  titel: string;
  hint: string;
  wert: string;
  maxLen: number;
  onSpeichere: (text: string) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [entwurf, setEntwurf] = useState(wert);
  const [speichert, setSpeichert] = useState(false);
  useEffect(() => setEntwurf(wert), [wert]);

  const geaendert = entwurf.trim() !== wert.trim();
  const verbleibend = maxLen - entwurf.length;

  async function speichern() {
    if (!geaendert) return;
    setSpeichert(true);
    const ok = await onSpeichere(entwurf.trim());
    setSpeichert(false);
    if (ok) onZurueck();
  }

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
        <p className="mt-3 text-sm text-muted-foreground">{hint}</p>

        <p className="mb-2 mt-8 text-xs font-medium text-muted-foreground">
          {t("zeichenVerbleibend", { n: verbleibend, max: maxLen })}
        </p>
        <textarea
          value={entwurf}
          maxLength={maxLen}
          rows={8}
          aria-label={titel}
          onChange={(e) => setEntwurf(e.target.value)}
          className="w-full resize-none rounded-2xl border border-border bg-transparent p-4 text-[0.9375rem] leading-relaxed outline-none focus:border-foreground"
          autoFocus
        />
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
          onClick={speichern}
          disabled={speichert || !geaendert}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {speichert ? t("speichert") : t("speichern")}
        </button>
      </div>
    </div>
  );
}
