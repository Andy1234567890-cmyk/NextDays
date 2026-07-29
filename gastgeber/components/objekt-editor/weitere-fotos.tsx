"use client";

// „Weitere Fotos" (Airbnb „Additional photos"): die Sammelgalerie aller Objekt-
// fotos, die keinem Zimmer zugeordnet sind, aber im Inserat erscheinen. Kopf mit
// „Fotos verwalten" + „+", großes Foto-Grid, Drag&Drop-Upload-Modal und eine
// Vollbild-Lightbox. Fotos leben in properties.photos / property_photos (echter
// Upload über den BFF-Route-Handler); der Editor pflegt die Liste per Realtime.
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { FOTO_ACCEPT } from "@/lib/foto-konvertierung";
import { deletePhoto, type PropertyPhoto, uploadPhoto } from "@/lib/property-photos";

export function WeitereFotos({
  propertyId,
  fotos,
  onFotoHochgeladen,
  onFotoEntfernt,
}: {
  propertyId: string;
  fotos: PropertyPhoto[];
  onFotoHochgeladen: (foto: PropertyPhoto) => void;
  onFotoEntfernt: (fotoId: string, url: string) => void;
}) {
  const t = useTranslations("objektEditor");
  const [uploadOffen, setUploadOffen] = useState(false);
  const [verwalten, setVerwalten] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Kopf: Titel + „Fotos verwalten" + „+" */}
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-sans text-[2rem] font-bold tracking-tight">
            {t("fotosWeitere")}
          </h2>
          <p className="mt-2 max-w-lg text-[0.9375rem] text-muted-foreground">
            {t("weitereFotosText")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {fotos.length > 0 && (
            <button
              type="button"
              onClick={() => setVerwalten((v) => !v)}
              className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                verwalten
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              }`}
            >
              {verwalten ? t("fertigVerwalten") : t("fotosVerwalten")}
            </button>
          )}
          <button
            type="button"
            aria-label={t("raumFotoHinzufuegen")}
            onClick={() => setUploadOffen(true)}
            className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70"
          >
            <Icon icon="ph:plus" className="size-5" />
          </button>
        </div>
      </div>

      {/* Foto-Grid */}
      {fotos.length === 0 ? (
        <button
          type="button"
          onClick={() => setUploadOffen(true)}
          className="mt-6 flex min-h-[16rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <Icon icon="ph:images" className="size-10" />
          <span className="text-sm font-semibold">{t("fotosLeer")}</span>
        </button>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3">
          {fotos.map((f, i) => (
            <div
              key={f.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted"
            >
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="size-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="size-full object-cover" />
              </button>
              {verwalten && (
                <button
                  type="button"
                  aria-label={t("fotoLoeschen")}
                  onClick={async () => {
                    await deletePhoto(propertyId, f.id).catch(() => {});
                    onFotoEntfernt(f.id, f.url);
                  }}
                  className="absolute end-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
                >
                  <Icon icon="ph:trash" className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload-Modal (Drag & Drop + Durchsuchen) */}
      <UploadModal
        offen={uploadOffen}
        propertyId={propertyId}
        onSchliesse={() => setUploadOffen(false)}
        onHochgeladen={onFotoHochgeladen}
      />

      {/* „Select photos"-Vollbild-Grid */}
      {lightbox != null && fotos.length > 0 && (
        <Lightbox
          fotos={fotos}
          index={lightbox}
          onSetze={setLightbox}
          onSchliesse={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

// — Upload-Modal: Dateien wählen (Drag&Drop/Durchsuchen), Vorschau, hochladen —
function UploadModal({
  offen,
  propertyId,
  onSchliesse,
  onHochgeladen,
}: {
  offen: boolean;
  propertyId: string;
  onSchliesse: () => void;
  onHochgeladen: (foto: PropertyPhoto) => void;
}) {
  const t = useTranslations("objektEditor");
  const [dateien, setDateien] = useState<File[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ueberzogen, setUeberzogen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function hinzufuegen(neu: FileList | null) {
    // Bilder annehmen (moderne Formate haben teils leeren MIME → auch Endung
    // prüfen). Die Konvertierung zu JPEG passiert beim Upload.
    const bilder = Array.from(neu ?? []).filter(
      (d) => d.type.startsWith("image/") || /\.(heic|heif)$/i.test(d.name),
    );
    if (bilder.length) setDateien((d) => [...d, ...bilder]);
  }

  function schliessen() {
    setDateien([]);
    setFehler(null);
    onSchliesse();
  }

  async function hochladen() {
    if (dateien.length === 0) return;
    setLaedt(true);
    setFehler(null);
    try {
      for (const datei of dateien) {
        const foto = await uploadPhoto(propertyId, datei);
        onHochgeladen(foto);
      }
      schliessen();
    } catch (exc) {
      setFehler(exc instanceof Error ? exc.message : t("fotoFehler"));
    } finally {
      setLaedt(false);
    }
  }

  return (
    <Dialog open={offen} onOpenChange={(o) => (o ? null : schliessen())}>
      <DialogContent className="max-w-xl" showCloseButton={false}>
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            aria-label={t("schliessen")}
            onClick={schliessen}
            className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
          <div className="text-center">
            <DialogTitle className="font-sans text-lg font-bold">
              {t("uploadTitel")}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {t("uploadAnzahl", { n: dateien.length })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("raumFotoHinzufuegen")}
            onClick={() => input.current?.click()}
            className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Icon icon="ph:plus" className="size-5" />
          </button>
        </div>

        <input
          ref={input}
          type="file"
          accept={FOTO_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            hinzufuegen(e.target.files);
            e.target.value = "";
          }}
        />

        {dateien.length === 0 ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setUeberzogen(true);
            }}
            onDragLeave={() => setUeberzogen(false)}
            onDrop={(e) => {
              e.preventDefault();
              setUeberzogen(false);
              hinzufuegen(e.dataTransfer.files);
            }}
            className={`mt-5 flex min-h-[16rem] w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 transition-colors ${
              ueberzogen ? "border-foreground bg-muted/50" : "border-border"
            }`}
          >
            <Icon icon="ph:images" className="size-12 text-muted-foreground" />
            <span className="font-sans text-xl font-bold">{t("uploadDragDrop")}</span>
            <span className="text-sm text-muted-foreground">{t("uploadOder")}</span>
            <span className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background">
              {t("uploadDurchsuchen")}
            </span>
          </button>
        ) : (
          <div className="mt-5 grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto">
            {dateien.map((d, i) => (
              <div
                key={`${d.name}-${i}`}
                className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(d)}
                  alt={d.name}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  aria-label={t("fotoLoeschen")}
                  onClick={() => setDateien((v) => v.filter((_, j) => j !== i))}
                  className="absolute end-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
                >
                  <Icon icon="ph:x" className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {fehler && <p className="mt-3 text-sm text-destructive">{fehler}</p>}

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
          <button
            type="button"
            onClick={schliessen}
            className="text-sm font-semibold underline-offset-4 hover:underline"
          >
            {t("fertig")}
          </button>
          <button
            type="button"
            onClick={hochladen}
            disabled={laedt || dateien.length === 0}
            className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {laedt ? t("fotoLaedt") : t("uploadHochladen")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// — „Select photos"-Vollbild-Grid (Airbnb): alle Fotos groß im mehrspaltigen
//   Raster, oben zentrierter Titel + Schließen-Kreis. —
function Lightbox({
  fotos,
  onSchliesse,
}: {
  fotos: PropertyPhoto[];
  index: number;
  onSetze: (i: number) => void;
  onSchliesse: () => void;
}) {
  const t = useTranslations("objektEditor");
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="relative mx-auto max-w-[90rem] px-6 py-8 lg:px-10">
        <button
          type="button"
          aria-label={t("schliessen")}
          onClick={onSchliesse}
          className="absolute start-6 top-8 flex size-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70 lg:start-10"
        >
          <Icon icon="ph:x" className="size-5" />
        </button>
        <h2 className="mb-10 text-center font-sans text-[2rem] font-bold tracking-tight">
          {t("fotosAuswaehlen")}
        </h2>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {fotos.map((f) => (
            <div
              key={f.id}
              className="aspect-[4/3] overflow-hidden rounded-2xl bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
