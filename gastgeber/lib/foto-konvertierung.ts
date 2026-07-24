"use client";

// Client-Foto-Konvertierung für den Upload. Das Backend speichert nur JPEG/PNG
// (properties GALLERY_MIME); moderne Aufnahmeformate müssen daher VOR dem Upload
// im Browser zu JPEG gewandelt werden:
//   • AVIF / WebP  → der Browser dekodiert sie nativ, Canvas → JPEG.
//   • HEIC / HEIF  → der Browser kann sie NICHT dekodieren → heic2any (dynamisch
//     importiert, damit die ~MB-Lib nur geladen wird, wenn wirklich ein HEIC kommt).
// JPEG/PNG werden unverändert durchgereicht. Hinweis: schnelleres WebP-Ausliefern
// an die Plattform ist ein getrennter Auslieferungs-Schritt (Storage-Transform),
// NICHT dieser Upload-Pfad — im Bucket liegt das verlustarme JPEG-Original.

// Direkt vom Backend akzeptiert → unverändert lassen.
const DURCHREICHEN = new Set(["image/jpeg", "image/png"]);
// Vom Browser nativ dekodierbar → per Canvas zu JPEG.
const CANVAS_KONVERTIERBAR = new Set(["image/avif", "image/webp"]);

/** Erkennt HEIC/HEIF auch, wenn der Browser keinen MIME-Typ liefert (häufig). */
function istHeic(datei: File): boolean {
  const typ = datei.type.toLowerCase();
  if (typ === "image/heic" || typ === "image/heif") return true;
  return /\.(heic|heif)$/i.test(datei.name);
}

/** Ein <img> aus einem Blob laden (für den Canvas-Weg). */
function ladeBild(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht gelesen werden."));
    };
    img.src = url;
  });
}

/** Ein Bild/Blob über Canvas als JPEG-File ausgeben. */
async function zuJpeg(blob: Blob, name: string, qualitaet = 0.9): Promise<File> {
  const img = await ladeBild(blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  ctx.drawImage(img, 0, 0);
  const jpeg = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", qualitaet),
  );
  if (!jpeg) throw new Error("Konvertierung fehlgeschlagen.");
  const basis = name.replace(/\.[^.]+$/, "");
  return new File([jpeg], `${basis}.jpg`, { type: "image/jpeg" });
}

/**
 * Eine Datei in ein vom Backend akzeptiertes Format bringen. JPEG/PNG bleiben
 * unverändert; AVIF/WebP/HEIC/HEIF werden zu JPEG konvertiert. Andere Typen
 * werden durchgereicht (das Backend lehnt sie dann mit 415 klar ab).
 */
export async function fuerUploadVorbereiten(datei: File): Promise<File> {
  if (DURCHREICHEN.has(datei.type)) return datei;

  if (istHeic(datei)) {
    const { default: heic2any } = await import("heic2any");
    const konvertiert = (await heic2any({
      blob: datei,
      toType: "image/jpeg",
      quality: 0.9,
    })) as Blob;
    const basis = datei.name.replace(/\.[^.]+$/, "");
    return new File([konvertiert], `${basis}.jpg`, { type: "image/jpeg" });
  }

  if (CANVAS_KONVERTIERBAR.has(datei.type)) {
    return zuJpeg(datei, datei.name);
  }

  // Unbekannt (z. B. nur per Endung erkennbar) → Canvas-Versuch, sonst
  // unverändert lassen und das Backend entscheiden.
  return datei;
}

// Für das accept-Attribut des Datei-Inputs (moderne Formate mit anbieten).
export const FOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif";
