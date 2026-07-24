"use client";

// „Schlafgelegenheiten" (Airbnb „Sleeping arrangements"). Öffnet sich als rechte
// Sidebar, wenn man in der Zimmer-Detailansicht auf die Zeile klickt. Aufbau exakt
// wie Airbnb: oben eine Foto-Kachel (Zimmerfoto + „+"), darunter „Wählen Sie die
// Bettenarten" mit je einem Stepper (−/Zahl/+) pro Bett-Typ, unten „Stornieren"
// links und „Erledigt" rechts. Speichert über den übergebenen Callback (der im
// Editor das komplette type_attributes gemergt patcht — Wurzel 1).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { FOTO_ACCEPT } from "@/lib/foto-konvertierung";
import { type PropertyPhoto, uploadPhoto } from "@/lib/property-photos";

import { BETT_TYPEN } from "./bett-typen";

export function SchlafPanel({
  zimmerTitel,
  werte,
  propertyId,
  foto,
  onSpeichere,
  onFotoHochgeladen,
  onZurueck,
}: {
  zimmerTitel: string;
  werte: Record<string, number>;
  // Objekt-ID + aktuell zugeordnetes Zimmerfoto (für die Foto-Kachel oben).
  propertyId: string;
  foto: string | null;
  onSpeichere: (neu: Record<string, number>) => Promise<boolean>;
  // Foto hochgeladen → nach oben melden (Editor pflegt Galerie + Kachel-Zuordnung).
  onFotoHochgeladen: (foto: PropertyPhoto) => void;
  onZurueck: () => void;
}) {
  const t = useTranslations("objektEditor");
  const [lokal, setLokal] = useState<Record<string, number>>(werte);
  const [speichert, setSpeichert] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const dateiInput = useRef<HTMLInputElement>(null);

  function setzt(key: string, delta: number) {
    setLokal((v) => {
      const next = Math.max(0, (v[key] ?? 0) + delta);
      const kopie = { ...v };
      if (next === 0) delete kopie[key];
      else kopie[key] = next;
      return kopie;
    });
  }

  async function fotoGewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei) return;
    setLaedt(true);
    try {
      const neu = await uploadPhoto(propertyId, datei);
      onFotoHochgeladen(neu);
    } catch {
      /* Fehler → Kachel bleibt leer (kein Crash). */
    } finally {
      setLaedt(false);
    }
  }

  async function speichern() {
    setSpeichert(true);
    const ok = await onSpeichere(lokal);
    setSpeichert(false);
    if (ok) onZurueck();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Scrollender Inhalt (Titel + Foto-Kachel + Bett-Liste). */}
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
          {zimmerTitel}
        </h2>

        {/* Foto-Kachel (Zimmerfoto + „+"), wie Airbnb: größere, leere Bild-Kachel
            mittig mit „+"-Badge unten rechts. */}
        <div className="mt-6 flex justify-center">
          <div className="relative">
            <button
              type="button"
              onClick={() => dateiInput.current?.click()}
              disabled={laedt}
              className="flex size-36 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/60 disabled:opacity-70"
            >
              {laedt ? (
                <Icon icon="ph:spinner-gap" className="size-8 animate-spin" />
              ) : foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" className="size-full object-cover" />
              ) : (
                <Icon icon="ph:image" className="size-10" />
              )}
            </button>
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-2.5 -right-2.5 flex size-9 items-center justify-center rounded-full bg-foreground text-background shadow-sm"
            >
              <Icon icon="ph:plus" className="size-4" />
            </span>
          </div>
        </div>
        <input
          ref={dateiInput}
          type="file"
          accept={FOTO_ACCEPT}
          className="hidden"
          onChange={fotoGewaehlt}
        />

        {/* „Wählen Sie die Bettenarten" */}
        <h3 className="mt-8 font-semibold">{t("schlafBettenarten")}</h3>

        <div className="mt-2">
          {BETT_TYPEN.map((bt) => {
            const anzahl = lokal[bt.key] ?? 0;
            return (
              <div key={bt.key} className="flex items-center gap-4 py-4">
                <Icon icon={bt.icon} className="size-6 shrink-0 text-foreground" />
                <span className="min-w-0 flex-1">{bt.label}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={t("verringern")}
                    disabled={anzahl === 0}
                    onClick={() => setzt(bt.key, -1)}
                    className="flex size-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border"
                  >
                    <Icon icon="ph:minus" className="size-4" />
                  </button>
                  <span className="w-6 text-center tabular-nums">{anzahl}</span>
                  <button
                    type="button"
                    aria-label={t("erhoehen")}
                    onClick={() => setzt(bt.key, 1)}
                    className="flex size-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-foreground"
                  >
                    <Icon icon="ph:plus" className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixe Fußzeile — „Stornieren" links, „Erledigt" rechts (Airbnb). */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-background px-8 py-5 lg:px-12">
        <button
          type="button"
          onClick={onZurueck}
          className="text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t("stornieren")}
        </button>
        <button
          type="button"
          onClick={speichern}
          disabled={speichert}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {speichert ? t("speichert") : t("erledigt")}
        </button>
      </div>
    </div>
  );
}
