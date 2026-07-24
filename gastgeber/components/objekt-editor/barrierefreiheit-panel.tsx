"use client";

// „Barrierefreiheit" (Airbnb „Accessibility features") als rechte Sidebar. Drei
// innere Ansichten: (1) Merkmal-Liste nach Kategorie, (2) Merkmal-Detail mit
// Demofoto-Galerie + Foto-Richtlinien-Modal + Ja/Nein-Radio + (bei Ja) Foto-
// Upload-Kasten, (3) Vollbild-Galerie der Demofotos. Gespeichert wird pro Merkmal
// nur has=true/false (die Demofotos sind Vorlagen, werden NIE hochgeladen). Der
// eigene Foto-Upload ist ehrlich als „folgt" deaktiviert, solange kein Upload-
// Backend existiert (Wurzel 4, kein Fake).
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  BARRIERE_KATEGORIEN,
  BARRIERE_MERKMALE,
  type BarriereMerkmal,
} from "./barrierefreiheit-katalog";

export function BarrierefreiheitPanel({
  werte,
  onSpeichere,
  onZurueck,
}: {
  werte: Record<string, { has: boolean }>;
  onSpeichere: (key: string, has: boolean, facility: string | null) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  // Offenes Merkmal (Detail) oder null (Liste).
  const [offen, setOffen] = useState<BarriereMerkmal | null>(null);

  return (
    <div className="flex h-full flex-col">
      <AnimatePresence mode="wait" initial={false}>
        {offen ? (
          <motion.div
            key={`detail-${offen.key}`}
            className="flex h-full flex-col"
            initial={{ opacity: 0, x: "3%" }}
            animate={{ opacity: 1, x: "0%" }}
            exit={{ opacity: 0, x: "3%" }}
            transition={{ duration: 0.22 }}
          >
            <MerkmalDetail
              merkmal={offen}
              vorhanden={werte[offen.key]?.has ?? null}
              onSetze={(has) => onSpeichere(offen.key, has, offen.facility)}
              onZurueck={() => setOffen(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="liste"
            className="flex h-full flex-col"
            initial={{ opacity: 0, x: "-3%" }}
            animate={{ opacity: 1, x: "0%" }}
            exit={{ opacity: 0, x: "-3%" }}
            transition={{ duration: 0.22 }}
          >
            {/* Kopf */}
            <div className="shrink-0 px-8 pt-8 lg:px-12 lg:pt-12">
              {/* Schließen-X oben rechts (Airbnb-Muster). */}
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
              <h2 className="font-sans text-[2rem] font-bold tracking-tight">
                {t("barriereTitel")}
              </h2>
              <p className="mt-2 text-[0.9375rem] text-muted-foreground">
                {t("barriereText")}
              </p>
            </div>

            {/* Merkmal-Liste nach Kategorie */}
            <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-6 lg:px-12">
              {BARRIERE_KATEGORIEN.map((kat) => {
                const merkmale = BARRIERE_MERKMALE.filter((m) => m.kategorie === kat);
                if (merkmale.length === 0) return null;
                return (
                  <section key={kat} className="mb-6">
                    <h3 className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {kat}
                    </h3>
                    <ul className="divide-y divide-border">
                      {merkmale.map((m) => {
                        const v = werte[m.key]?.has;
                        return (
                          <li key={m.key}>
                            <button
                              type="button"
                              onClick={() => setOffen(m)}
                              className="flex w-full items-center gap-4 py-4 text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">{m.label}</p>
                                {v != null && (
                                  <p className="mt-0.5 text-sm text-muted-foreground">
                                    {v ? t("barriereJa") : t("barriereNein")}
                                  </p>
                                )}
                              </div>
                              <Icon
                                icon="ph:caret-right"
                                className="size-4 shrink-0 text-muted-foreground"
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>

            {/* Fußzeile */}
            <div className="flex shrink-0 items-center justify-end border-t border-border bg-background px-8 py-5 lg:px-12">
              <button
                type="button"
                onClick={onZurueck}
                className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {t("fertigButton")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// — Merkmal-Detail: Demofoto-Galerie, Richtlinien, Ja/Nein, Upload-Platzhalter —
function MerkmalDetail({
  merkmal,
  vorhanden,
  onSetze,
  onZurueck,
}: {
  merkmal: BarriereMerkmal;
  vorhanden: boolean | null;
  onSetze: (has: boolean) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState<boolean | null>(vorhanden);
  const [speichert, setSpeichert] = useState(false);
  const [richtlinienOffen, setRichtlinienOffen] = useState(false);
  const [galerieIndex, setGalerieIndex] = useState<number | null>(null);

  async function speichern() {
    if (lokal == null) return;
    setSpeichert(true);
    const ok = await onSetze(lokal);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <>
      {/* Kopf mit Zurück */}
      <div className="shrink-0 px-8 pt-8 lg:px-12 lg:pt-12">
        <button
          type="button"
          aria-label={t("zurueck")}
          onClick={onZurueck}
          className="mb-4 flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <Icon icon="ph:arrow-left" className="size-4" />
        </button>
        <h2 className="font-sans text-[2rem] font-bold tracking-tight">
          {merkmal.label}
        </h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          {merkmal.beschreibung}
        </p>
      </div>

      {/* Scrollender Inhalt */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-6 lg:px-12">
        {/* Demofoto-Galerie (Beispiele) */}
        <p className="mb-3 text-sm font-medium">{t("barriereBeispiele")}</p>
        <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
          {merkmal.bilder.map((b, i) => (
            <button
              key={b.src}
              type="button"
              onClick={() => setGalerieIndex(i)}
              className="aspect-[4/3] w-56 shrink-0 overflow-hidden rounded-2xl bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.src} alt={b.alt} className="size-full object-cover" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRichtlinienOffen(true)}
          className="mt-3 text-sm font-medium underline underline-offset-4"
        >
          {t("barriereRichtlinien")}
        </button>

        {/* Ja/Nein-Radio */}
        <div className="mt-8 space-y-3">
          {[false, true].map((wert) => {
            const aktiv = lokal === wert;
            return (
              <button
                key={String(wert)}
                type="button"
                onClick={() => setLokal(wert)}
                className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-colors ${
                  aktiv ? "border-foreground bg-muted/40" : "border-border hover:border-foreground"
                }`}
              >
                <span className="font-medium">
                  {wert ? t("barriereHabeIch") : t("barriereHabeIchNicht")}
                </span>
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

        {/* Foto-Bereich — erst mit „vorhanden" (Airbnb-Flow): Anleitung als
            Bullet-Liste, Upload-Kasten und Prüf-Hinweis. Der Upload-Kasten ist
            ehrlich deaktiviert, solange kein Upload-Backend existiert (kein Fake,
            Wurzel 4) — die Anleitung + der Hinweis bleiben echt. */}
        {lokal === true && (
          <div className="mt-8">
            <p className="font-medium">{t("barriereFotosTitel")}</p>
            <ul className="mt-3 space-y-2">
              {merkmal.fotoHinweise.map((h) => (
                <li
                  key={h}
                  className="flex gap-2.5 text-sm text-muted-foreground"
                >
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                  {h}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled
              aria-disabled
              className="mt-4 flex w-full cursor-not-allowed flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center opacity-60"
            >
              <Icon icon="ph:camera" className="size-7 text-muted-foreground" />
              <span className="text-sm font-semibold">{t("barriereFotosBtn")}</span>
              <span className="text-xs text-muted-foreground">
                {t("barriereUploadFolgt")}
              </span>
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("barriereFotosPruefung")}
            </p>
          </div>
        )}
      </div>

      {/* Fußzeile */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-background px-8 py-5 lg:px-12">
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
          disabled={speichert || lokal == null}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {speichert ? t("speichert") : t("speichern")}
        </button>
      </div>

      {/* Foto-Richtlinien-Modal */}
      <Dialog open={richtlinienOffen} onOpenChange={setRichtlinienOffen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="font-sans text-2xl font-bold tracking-tight">
            {t("barriereRichtlinienTitel")}
          </DialogTitle>
          <ul className="mt-4 space-y-4">
            {["r1", "r2", "r3"].map((k) => (
              <li key={k} className="text-[0.9375rem] text-muted-foreground">
                {t(`barriereRichtlinie_${k}`)}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-end">
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {t("verstanden")}
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vollbild-Galerie der Demofotos */}
      {galerieIndex != null && (
        <VollbildGalerie
          bilder={merkmal.bilder}
          index={galerieIndex}
          onSetze={setGalerieIndex}
          onSchliesse={() => setGalerieIndex(null)}
        />
      )}
    </>
  );
}

// — Vollbild-Galerie (Demofotos) —
function VollbildGalerie({
  bilder,
  index,
  onSetze,
  onSchliesse,
}: {
  bilder: { src: string; alt: string }[];
  index: number;
  onSetze: (i: number) => void;
  onSchliesse: () => void;
}) {
  const aktiv = bilder[index];
  const vor = () => onSetze((index - 1 + bilder.length) % bilder.length);
  const zurueck = () => onSetze((index + 1) % bilder.length);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <button
          type="button"
          aria-label="Schließen"
          onClick={onSchliesse}
          className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <Icon icon="ph:x" className="size-5" />
        </button>
        <span className="text-sm font-semibold tabular-nums">
          {index + 1} / {bilder.length}
        </span>
        <span className="size-9" />
      </div>
      <div className="flex flex-1 items-center gap-6 px-6 pb-10">
        {bilder.length > 1 && (
          <button
            type="button"
            aria-label="Vorheriges"
            onClick={vor}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
          >
            <Icon icon="ph:caret-left" className="size-5" />
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-10">
          <div className="aspect-[3/2] w-full max-w-3xl overflow-hidden rounded-2xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={aktiv.src} alt={aktiv.alt} className="size-full object-cover" />
          </div>
          <p className="hidden w-64 shrink-0 text-[0.9375rem] leading-relaxed lg:block">
            {aktiv.alt}
          </p>
        </div>
        {bilder.length > 1 && (
          <button
            type="button"
            aria-label="Nächstes"
            onClick={zurueck}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
          >
            <Icon icon="ph:caret-right" className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
