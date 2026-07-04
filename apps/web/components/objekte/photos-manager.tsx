"use client";

// Foto-/Galerieverwaltung eines Objekts (wie Lodgify „Photos"): Multi-Upload per
// Drag&Drop + Klick, Galerie mit Drag-to-Reorder, großem Titelbild (Cover) und
// Inline-Bildunterschrift je Foto (max. 100 Zeichen, mehrsprachig). Die Sprache
// der gerade editierten Caption steuert der Selektor oben. property_photos ist
// die Wahrheit; das Backend pflegt properties.photos als abgeleiteten Spiegel.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useRealtime } from "@/lib/use-realtime";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Locale, DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import {
  type PropertyPhoto,
  deletePropertyPhoto,
  listPropertyPhotos,
  reorderPropertyPhotos,
  updatePropertyPhoto,
  uploadPropertyPhoto,
} from "@/lib/properties";

// Buchungsportale (via Channex) nehmen nur JPEG/PNG an — die speichern/senden
// wir. Der Kunde darf aber auch moderne Formate (WebP/AVIF/HEIC) hochladen; die
// werden vor dem Upload im Browser zu JPEG konvertiert, damit die Portale sie
// sicher annehmen. HEIC/HEIF melden manche Browser mit leerem MIME-Typ → auch
// per Endung erkennen.
const PORTAL_READY = ["image/jpeg", "image/png"];
const CONVERTIBLE = ["image/webp", "image/avif", "image/heic", "image/heif"];
const CONVERTIBLE_EXT = /\.(webp|avif|heic|heif)$/i;
const MAX_BYTES = 20 * 1024 * 1024;
// Untergrenze über die AUFLÖSUNG, nicht die Dateigröße: moderne Formate (AVIF/
// WebP) komprimieren echte Fotos oft unter 50 KB, sind aber vollwertig. Die
// Mindestmaße wehren nur winzige Icons/Thumbnails ab.
const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;
const CAPTION_MAX = 100;

function isConvertible(file: File): boolean {
  return CONVERTIBLE.includes(file.type) || CONVERTIBLE_EXT.test(file.name);
}

// Maße eines Bildes ermitteln (für die Auflösungs-Untergrenze). Kann der Browser
// das Format nicht dekodieren, kommt null → Aufrufer meldet Formatfehler.
async function imageSize(file: File): Promise<{ w: number; h: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

// Wandelt ein nicht-portalfähiges Bild (WebP/AVIF/HEIC) im Browser in JPEG um.
// Nutzt createImageBitmap (dekodiert AVIF/WebP nativ, wo der Browser es kann)
// und zeichnet auf ein Canvas. Gibt bei Erfolg (neue .jpg-Datei, Maße) zurück,
// sonst null (Browser kann das Format nicht dekodieren → Aufrufer meldet Fehler).
async function toJpeg(
  file: File,
): Promise<{ file: File; w: number; h: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const w = bitmap.width;
    const h = bitmap.height;
    bitmap.close();
    // Qualität 0,92: gut genug für Portale, ohne die Datei unnötig aufzublähen.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return null;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { file: new File([blob], name, { type: "image/jpeg" }), w, h };
  } catch {
    return null;
  }
}

type UploadState = { name: string; error: string | null; busy: boolean };

export function PhotosManager({ propertyId }: { propertyId: string }) {
  const t = useTranslations("fotos");
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bildunterschriften folgen der globalen App-Sprache (Topbar-Umschalter) —
  // kein eigener Selektor. Fallback auf die Basissprache, falls untypisiert.
  const activeLocale = useLocale();
  const lang: Locale = isLocale(activeLocale) ? activeLocale : DEFAULT_LOCALE;

  const reload = useCallback(async () => {
    const res = await listPropertyPhotos(propertyId);
    if (res.ok) setPhotos(res.data.items);
    else toast.error(res.error);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    void reload();
  }, [reload]);
  // Realtime-Pflicht: Uploads/Umsortierungen anderer Sessions live spiegeln
  // (property_photos ist seit 0077 in der Realtime-Publication).
  useRealtime({
    table: "property_photos",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => void reload(),
  });

  // Größe erst nach evtl. Konvertierung prüfen. Der Typ-Check lässt portalfähige
  // (JPEG/PNG) und konvertierbare (WebP/AVIF/HEIC) Formate zu; alles andere raus.
  function validateType(file: File): string | null {
    if (!PORTAL_READY.includes(file.type) && !isConvertible(file)) {
      return t("errorType");
    }
    return null;
  }
  function validateResolution(w: number, h: number): string | null {
    if (w < MIN_WIDTH || h < MIN_HEIGHT) return t("errorTooSmall");
    return null;
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploads(files.map((f) => ({ name: f.name, error: null, busy: true })));
    const added: PropertyPhoto[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const fail = (error: string) =>
        setUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, busy: false, error } : u)),
        );
      let file = files[i];
      const badType = validateType(file);
      if (badType) {
        fail(badType);
        continue;
      }
      // Byte-Obergrenze (vor der Konvertierung, gegen riesige Rohdateien).
      if (file.size > MAX_BYTES) {
        fail(t("errorTooLarge"));
        continue;
      }
      // Moderne Formate vor dem Upload zu JPEG konvertieren (Portal-Kompatibilität).
      // Die Bildmaße fallen dabei ab; sonst separat ermitteln. Untergrenze ist
      // die AUFLÖSUNG, nicht die Dateigröße (AVIF/WebP sind legitim klein).
      let dims: { w: number; h: number } | null;
      if (isConvertible(file)) {
        // eslint-disable-next-line no-await-in-loop -- sequenziell für stabile Reihenfolge
        const jpeg = await toJpeg(file);
        if (!jpeg) {
          fail(t("errorType"));
          continue;
        }
        file = jpeg.file;
        dims = { w: jpeg.w, h: jpeg.h };
      } else {
        // eslint-disable-next-line no-await-in-loop -- sequenziell für stabile Reihenfolge
        dims = await imageSize(file);
      }
      if (!dims) {
        fail(t("errorType"));
        continue;
      }
      const badRes = validateResolution(dims.w, dims.h);
      if (badRes) {
        fail(badRes);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop -- sequenziell für stabile Reihenfolge
      const res = await uploadPropertyPhoto(propertyId, file);
      if (res.ok) {
        added.push(res.data);
        setUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, busy: false } : u)),
        );
      } else {
        setUploads((prev) =>
          prev.map((u, idx) =>
            idx === i ? { ...u, busy: false, error: res.error } : u,
          ),
        );
      }
    }
    if (added.length > 0) {
      setPhotos((prev) => [...prev, ...added]);
      toast.success(t("uploaded", { count: added.length }));
    }
    window.setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.error));
    }, 2500);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) void uploadFiles(files);
  }

  async function persistOrder(next: PropertyPhoto[]) {
    const prev = photos;
    setPhotos(next);
    const res = await reorderPropertyPhotos(
      propertyId,
      next.map((p) => p.id),
    );
    if (res.ok) setPhotos(res.data.items);
    else {
      setPhotos(prev);
      toast.error(res.error);
    }
  }

  function onDropReorder(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const from = photos.findIndex((p) => p.id === dragId);
    const to = photos.findIndex((p) => p.id === targetId);
    setDragId(null);
    setOverId(null);
    if (from === -1 || to === -1) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  }

  async function setCover(photo: PropertyPhoto) {
    const res = await updatePropertyPhoto(propertyId, photo.id, {
      is_cover: true,
    });
    if (res.ok) {
      setPhotos((prev) => {
        const updated = prev.map((p) => ({ ...p, is_cover: p.id === photo.id }));
        // Cover wandert an den Anfang (wie der Backend-Spiegel).
        return [...updated].sort(
          (a, b) => Number(b.is_cover) - Number(a.is_cover),
        );
      });
      toast.success(t("coverSet"));
    } else toast.error(res.error);
  }

  async function removePhoto(photo: PropertyPhoto) {
    const res = await deletePropertyPhoto(propertyId, photo.id);
    if (res.ok) {
      // Liste neu laden, da das Backend ggf. das Cover neu vergeben hat.
      const fresh = await listPropertyPhotos(propertyId);
      if (fresh.ok) setPhotos(fresh.data.items);
      toast.success(t("deleted"));
    } else toast.error(res.error);
  }

  // Caption der aktuellen Sprache speichern (onBlur). Nur bei echter Änderung.
  async function saveCaption(photo: PropertyPhoto, text: string) {
    const trimmed = text.trim();
    if ((photo.caption[lang] ?? "") === trimmed) return;
    const nextCaption = { ...photo.caption };
    if (trimmed) nextCaption[lang] = trimmed;
    else delete nextCaption[lang];
    const res = await updatePropertyPhoto(propertyId, photo.id, {
      caption: nextCaption,
    });
    if (res.ok) {
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, caption: res.data.caption } : p)),
      );
    } else toast.error(res.error);
  }

  const cover = photos.find((p) => p.is_cover) ?? null;
  const rest = photos.filter((p) => !p.is_cover);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Multi-Upload-Zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-(--radius) border-2 border-dashed px-6 py-12 text-center text-sm transition-colors ${
          dragOver
            ? "border-foreground bg-muted/40"
            : "border-border text-muted-foreground hover:bg-muted/40"
        }`}
      >
        <Icon icon="ph:images" className="size-8" />
        <span className="font-medium text-foreground">{t("dropTitle")}</span>
        <span>{t("dropHint")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void uploadFiles(files);
          e.target.value = "";
        }}
      />

      {/* Upload-Fortschritt / Fehler je Datei */}
      {uploads.length > 0 && (
        <div className="flex flex-col gap-1">
          {uploads.map((u) => (
            <div key={u.name} className="flex items-center gap-2 text-sm">
              <Icon
                icon={
                  u.busy
                    ? "ph:spinner"
                    : u.error
                      ? "ph:warning-circle"
                      : "ph:check-circle"
                }
                className={`size-4 shrink-0 ${u.busy ? "animate-spin" : ""} ${
                  u.error ? "text-destructive" : "text-muted-foreground"
                }`}
              />
              <span className="truncate">{u.name}</span>
              {u.error && <span className="text-destructive">— {u.error}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Galerie */}
      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="aspect-[21/9] animate-pulse rounded-(--radius) bg-muted" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className="aspect-[4/3] animate-pulse rounded-(--radius) bg-muted"
              />
            ))}
          </div>
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-(--radius) border border-border p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:image" className="size-7 text-muted-foreground" />
          </span>
          <p className="font-display text-lg font-extrabold">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyHint")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Großes Titelbild (Cover) — volle Breite, wie Lodgify. */}
          {cover && (
            <PhotoCard
              photo={cover}
              lang={lang}
              large
              t={t}
              dragId={dragId}
              overId={overId}
              setDragId={setDragId}
              setOverId={setOverId}
              onDropReorder={onDropReorder}
              onSetCover={setCover}
              onRemove={removePhoto}
              onSaveCaption={saveCaption}
            />
          )}

          {/* Übrige Fotos im Raster. */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  lang={lang}
                  t={t}
                  dragId={dragId}
                  overId={overId}
                  setDragId={setDragId}
                  setOverId={setOverId}
                  onDropReorder={onDropReorder}
                  onSetCover={setCover}
                  onRemove={removePhoto}
                  onSaveCaption={saveCaption}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Eine Foto-Karte: Bild + „…"-Menü (Cover/Löschen) + Inline-Caption mit X/100-
// Zähler. `large` rendert das Titelbild in voller Breite.
function PhotoCard({
  photo,
  lang,
  large = false,
  t,
  dragId,
  overId,
  setDragId,
  setOverId,
  onDropReorder,
  onSetCover,
  onRemove,
  onSaveCaption,
}: {
  photo: PropertyPhoto;
  lang: Locale;
  large?: boolean;
  t: ReturnType<typeof useTranslations>;
  dragId: string | null;
  overId: string | null;
  setDragId: (id: string | null) => void;
  setOverId: (id: string | null) => void;
  onDropReorder: (targetId: string) => void;
  onSetCover: (photo: PropertyPhoto) => void;
  onRemove: (photo: PropertyPhoto) => void;
  onSaveCaption: (photo: PropertyPhoto, text: string) => void;
}) {
  // Lokaler Entwurf, damit der Zähler live mitläuft; gespeichert wird onBlur.
  const [value, setValue] = useState(photo.caption[lang] ?? "");

  useEffect(() => {
    setValue(photo.caption[lang] ?? "");
  }, [photo.caption, lang]);

  return (
    <div className="flex flex-col overflow-hidden rounded-(--radius) border border-border bg-card">
      <div
        draggable
        onDragStart={() => setDragId(photo.id)}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (overId !== photo.id) setOverId(photo.id);
        }}
        onDrop={() => onDropReorder(photo.id)}
        className={`group relative cursor-grab overflow-hidden bg-muted active:cursor-grabbing ${
          large ? "aspect-[21/9]" : "aspect-[4/3]"
        } ${
          overId === photo.id && dragId !== photo.id
            ? "ring-2 ring-inset ring-foreground"
            : ""
        } ${dragId === photo.id ? "opacity-50" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={value}
          className="h-full w-full object-cover"
        />

        {photo.is_cover && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background">
            <Icon icon="ph:star-fill" className="size-3" />
            {t("cover")}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("menu")}
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-opacity hover:bg-background"
            >
              <Icon icon="ph:dots-three" className="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!photo.is_cover && (
              <DropdownMenuItem onSelect={() => onSetCover(photo)}>
                <Icon icon="ph:star" />
                {t("setCover")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onRemove(photo)}
            >
              <Icon icon="ph:trash" />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Inline-Bildunterschrift mit Zeichenzähler (X/100), Speichern onBlur. */}
      <div className="flex items-center gap-3 px-3 py-2">
        <input
          type="text"
          maxLength={CAPTION_MAX}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onSaveCaption(photo, value)}
          placeholder={t("captionPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {value.length}/{CAPTION_MAX}
        </span>
      </div>
    </div>
  );
}
