"use client";

// Mediathek: der eigene Bildbestand des Betriebs.
//
// Der fehlende Zwischenschritt. Vorher trug jeder Bild-Abschnitt ein Textfeld
// für eine URL — wer keine Bilder im Netz liegen hat, also praktisch jeder
// Vermieter, konnte damit kein eigenes Foto auf die Seite bringen. Jetzt:
// einmal hochladen, danach überall auswählen.
//
// Der Dialog ist ein AUSWAHL-Werkzeug, keine Verwaltungsseite: er öffnet aus
// einem Bildfeld heraus, man klickt ein Bild an und ist zurück im Formular.
// Hochladen und Löschen sind Nebenwege im selben Fenster, damit der Kunde nicht
// zwischen zwei Orten wechseln muss.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type Medium,
  listMedia,
  removeMedium,
  uploadMedium,
} from "@/lib/site-pages";

/** Was der Browser im Dateidialog anbietet. Serverseitig entscheidet die
 *  Magic-Byte-Prüfung — das hier ist nur Bequemlichkeit, kein Schutz. */
const ACCEPT = "image/jpeg,image/png,image/webp";

export function Mediathek({
  onWaehle,
  onSchliesse,
}: {
  onWaehle: (url: string) => void;
  onSchliesse: () => void;
}) {
  const t = useTranslations("website");
  const [bilder, setBilder] = useState<Medium[] | null>(null);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [ueberZiel, setUeberZiel] = useState(false);
  const dateiFeld = useRef<HTMLInputElement>(null);

  const laden = useCallback(async () => {
    const res = await listMedia(200);
    if (!res.ok) {
      toast.error(res.error);
      setBilder([]);
      return;
    }
    setBilder(res.data.items);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Escape schließt — Tastaturbedienung ohne Mausweg zum X.
  useEffect(() => {
    function aufTaste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliesse();
    }
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [onSchliesse]);

  async function hochladen(dateien: FileList | File[]) {
    const liste = [...dateien];
    if (liste.length === 0) return;
    setLaedtHoch(true);
    // Der Reihe nach, nicht parallel: das Backend zählt vor jedem Upload gegen
    // die Obergrenze. Parallel würden mehrere Aufrufe denselben Zählerstand
    // sehen und das Limit gemeinsam überschreiten.
    const neue: Medium[] = [];
    for (const datei of liste) {
      const res = await uploadMedium(datei);
      if (!res.ok) {
        toast.error(`${datei.name}: ${res.error}`);
        continue;
      }
      neue.push(res.data);
    }
    setLaedtHoch(false);
    if (neue.length > 0) {
      // Aus der Antwort ergänzen statt neu zu laden: das Bild ist sofort da,
      // ohne zweiten Netzaufruf.
      setBilder((b) => [...neue, ...(b ?? [])]);
      toast.success(t("mediathek.hochgeladen", { anzahl: neue.length }));
    }
  }

  async function loeschen(m: Medium) {
    const res = await removeMedium(m.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setBilder((b) => (b ?? []).filter((x) => x.id !== m.id));
    toast.success(t("mediathek.geloescht"));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("mediathek.titel")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onSchliesse}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-extrabold">
              {t("mediathek.titel")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("mediathek.hinweis")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("editor.schliessen")}
            onClick={onSchliesse}
            className="text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Ablegen ODER klicken — beides führt zum selben Weg. */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setUeberZiel(true);
            }}
            onDragLeave={() => setUeberZiel(false)}
            onDrop={(e) => {
              e.preventDefault();
              setUeberZiel(false);
              void hochladen(e.dataTransfer.files);
            }}
            className={
              "mb-4 flex flex-col items-center gap-2 rounded-(--radius) border-2 border-dashed px-4 py-6 text-center transition " +
              (ueberZiel
                ? "border-foreground bg-secondary/60"
                : "border-border")
            }
          >
            <Icon
              icon={laedtHoch ? "ph:spinner" : "ph:upload-simple"}
              className={
                "size-6 text-muted-foreground " + (laedtHoch ? "animate-spin" : "")
              }
            />
            <p className="text-sm">
              {laedtHoch ? t("mediathek.laedtHoch") : t("mediathek.ablegen")}
            </p>
            <button
              type="button"
              disabled={laedtHoch}
              onClick={() => dateiFeld.current?.click()}
              className="rounded-(--radius) border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-secondary disabled:opacity-50"
            >
              {t("mediathek.dateiWaehlen")}
            </button>
            <p className="text-xs text-muted-foreground">
              {t("mediathek.formate")}
            </p>
            <input
              ref={dateiFeld}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void hochladen(e.target.files);
                // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
                e.target.value = "";
              }}
            />
          </div>

          {bilder === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("mediathek.laedt")}
            </p>
          ) : bilder.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("mediathek.leer")}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {bilder.map((m) => (
                <li key={m.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onWaehle(m.url)}
                    title={m.filename ?? undefined}
                    className="block w-full overflow-hidden rounded-(--radius) border border-border transition hover:border-foreground hover:ring-2 hover:ring-foreground/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={m.filename ?? ""}
                      loading="lazy"
                      className="aspect-square w-full bg-secondary/40 object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={t("mediathek.loeschen")}
                    title={t("mediathek.loeschen")}
                    onClick={() => void loeschen(m)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-muted-foreground opacity-0 shadow-sm transition group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive"
                  >
                    <Icon icon="ph:trash" className="size-3.5" />
                  </button>
                  {m.filename ? (
                    <p className="mt-1 truncate text-[0.6875rem] text-muted-foreground">
                      {m.filename}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
