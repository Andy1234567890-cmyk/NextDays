"use client";

// „Privatsphäre" (Airbnb „Privacy info") als rechte Sidebar: eine Zeile
// „Türschloss am Zimmer" mit ✕/✓-Umschalter. ✓ ohne gesetzten Schloss-Typ zeigt
// einen Warnhinweis; ein Klick öffnet das Modal zur Typ-Wahl (nur innen / innen
// & außen). Gespeichert wird über den Callback (Editor merged ins komplette
// type_attributes → Wurzel 1). KEINE eigene Tabelle.
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { useTranslations } from "next-intl";
import { useState } from "react";

export type PrivacyWert = {
  hasLock: boolean;
  lockType: "inside_only" | "inside_outside" | null;
};

const LEER: PrivacyWert = { hasLock: false, lockType: null };

export function PrivacyPanel({
  zimmerTitel,
  wert,
  onSpeichere,
  onZurueck,
}: {
  zimmerTitel: string;
  wert: PrivacyWert;
  onSpeichere: (neu: PrivacyWert) => Promise<boolean>;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState<PrivacyWert>(wert ?? LEER);
  const [modalOffen, setModalOffen] = useState(false);
  const [typWahl, setTypWahl] = useState<PrivacyWert["lockType"]>(
    wert?.lockType ?? null,
  );
  const [speichert, setSpeichert] = useState(false);

  const lockTypLabel = (typ: PrivacyWert["lockType"]) =>
    typ === "inside_only"
      ? t("lockInnen")
      : typ === "inside_outside"
        ? t("lockInnenAussen")
        : null;

  // ✕ (kein Schloss) direkt setzen; ✓ öffnet das Typ-Modal (Airbnb-Flow).
  function waehleHatSchloss(hatSchloss: boolean) {
    if (!hatSchloss) {
      setLokal({ hasLock: false, lockType: null });
      return;
    }
    setTypWahl(lokal.lockType);
    setModalOffen(true);
  }

  async function speichernSidebar() {
    setSpeichert(true);
    const ok = await onSpeichere(lokal);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  function modalSpeichern() {
    if (!typWahl) return;
    setLokal({ hasLock: true, lockType: typWahl });
    setModalOffen(false);
  }

  const zeigtWarnung = lokal.hasLock && lokal.lockType == null;

  return (
    <div className="flex h-full flex-col">
      {/* Scrollender Inhalt — nur dieser Bereich scrollt intern. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-8 lg:px-12 lg:pt-12">
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
          {t("privacyTitel", { zimmer: zimmerTitel })}
        </h2>

        {/* Zeile: Türschloss + ✕/✓-Umschalter */}
        <div className="mt-8 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t("lockTuer")}</p>
            {lokal.hasLock && lokal.lockType && (
              <>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {lockTypLabel(lokal.lockType)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTypWahl(lokal.lockType);
                    setModalOffen(true);
                  }}
                  className="mt-1 text-sm font-medium underline underline-offset-4"
                >
                  {t("bearbeiten")}
                </button>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label={t("lockKeins")}
              aria-pressed={!lokal.hasLock}
              onClick={() => waehleHatSchloss(false)}
              className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
                !lokal.hasLock
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground hover:border-foreground"
              }`}
            >
              <Icon icon="ph:x" className="size-4" />
            </button>
            <button
              type="button"
              aria-label={t("lockVorhanden")}
              aria-pressed={lokal.hasLock}
              onClick={() => waehleHatSchloss(true)}
              className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
                lokal.hasLock
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground hover:border-foreground"
              }`}
            >
              <Icon icon="ph:check" className="size-4" />
            </button>
          </div>
        </div>

        {/* Warnhinweis, wenn Schloss gemeldet aber Typ noch offen */}
        {zeigtWarnung && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-muted/60 px-4 py-3.5">
            <Icon icon="ph:warning" className="mt-0.5 size-5 shrink-0 text-accent" />
            <p className="text-sm text-muted-foreground">{t("lockWarnung")}</p>
          </div>
        )}
      </div>

      {/* Fixe Fußzeile — außerhalb des Scroll-Bereichs. */}
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
          onClick={speichernSidebar}
          disabled={speichert}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {speichert ? t("speichert") : t("fertig")}
        </button>
      </div>

      {/* Modal: Schloss-Typ wählen (Airbnb-Flow) */}
      <Dialog open={modalOffen} onOpenChange={setModalOffen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="font-sans text-2xl font-bold tracking-tight">
            {t("lockModalTitel")}
          </DialogTitle>
          <DialogDescription className="mt-2">
            {t("lockModalText")}
          </DialogDescription>

          <div className="mt-6 space-y-3">
            {(["inside_only", "inside_outside"] as const).map((typ) => {
              const aktiv = typWahl === typ;
              return (
                <button
                  key={typ}
                  type="button"
                  onClick={() => setTypWahl(typ)}
                  className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-colors ${
                    aktiv ? "border-foreground bg-muted/50" : "border-border hover:border-foreground"
                  }`}
                >
                  <span className="font-medium">{lockTypLabel(typ)}</span>
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

          <div className="mt-8 flex items-center justify-between gap-4">
            <DialogClose asChild>
              <button
                type="button"
                className="text-sm font-semibold underline-offset-4 hover:underline"
              >
                {t("abbrechen")}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={modalSpeichern}
              disabled={!typWahl}
              className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {t("fertig")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
