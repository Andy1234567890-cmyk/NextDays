"use client";

// Die Vorschau EINES Mediums — an jeder Stelle dieselbe.
//
// Seit die Mediathek fünf Arten trägt (Bilder, Symbole, Videos, Audio,
// Dateien, 0479) gibt es kein „einfach ein <img>" mehr. Ein <img src> auf eine
// MP4 zeigt ein zerbrochenes Bild, auf eine PDF ebenfalls, und beides sieht
// nach einem Fehler in der Mediathek aus statt nach der Datei, die es ist.
//
// Warum EIN Bauteil und nicht drei: Kachelwand, Detailspalte und
// Auswahl-Karussell zeigen dasselbe Medium in drei Größen. Wären es drei
// Fassungen, käme die vierte Art in zwei davon an und in der dritten nicht —
// genau die Sorte Lücke, die niemand als Fehler meldet.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { Medium, MediumArt } from "@/lib/site-pages";

/** Symbol je Art, für die Fälle ohne eigenes Vorschaubild. */
const ART_SYMBOL: Record<MediumArt, string> = {
  image: "ph:image",
  icon: "ph:shapes",
  video: "ph:film-slate",
  audio: "ph:waveform",
  file: "ph:file-text",
};

/** Endung aus dem MIME-Typ, als Aufschrift auf der Datei-Kachel.
 *
 *  Aus dem MIME und nicht aus dem Dateinamen: der Name ist reine Anzeige und
 *  darf „urlaub.jpg" heißen, während die Datei ein PDF ist — der MIME kommt aus
 *  der Signaturprüfung des Uploads und ist die einzige verlässliche Angabe. */
function endung(mime: string): string {
  const teil = mime.split("/")[1] ?? "";
  if (teil.includes("wordprocessingml")) return "DOCX";
  if (teil.includes("spreadsheetml")) return "XLSX";
  if (teil.includes("presentationml")) return "PPTX";
  return teil.replace("x-", "").slice(0, 5).toUpperCase();
}

export function MedienVorschau({
  medium,
  gross = false,
  className = "",
}: {
  medium: Medium;
  /** `true` = Detailspalte (abspielbar, mit Bedienelementen), `false` = Kachel.
   *
   *  In der Kachel sind Bedienelemente falsch: ein Klick soll das Medium
   *  auswählen, nicht die Wiedergabe starten — und zwanzig Kacheln mit
   *  Abspielleisten sind eine Wand aus Knöpfen. */
  gross?: boolean;
  className?: string;
}) {
  const t = useTranslations("website.mediathek");
  const rahmen = `flex items-center justify-center bg-secondary/40 ${className}`;

  if (medium.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={medium.url}
        alt={medium.alt_text ?? medium.filename ?? ""}
        loading="lazy"
        className={
          gross ? `max-h-56 w-full object-contain ${className}` : `object-cover ${className}`
        }
      />
    );
  }

  if (medium.kind === "icon") {
    // Symbole sind Vektoren auf durchsichtigem Grund. Ohne Polster und ohne
    // Fläche dahinter wäre ein dunkles Symbol im Dunkelmodus unsichtbar.
    return (
      <span className={rahmen}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={medium.url}
          alt={medium.alt_text ?? medium.filename ?? ""}
          loading="lazy"
          className={gross ? "size-24" : "size-2/5"}
        />
      </span>
    );
  }

  if (medium.kind === "video") {
    return (
      <video
        src={medium.url}
        controls={gross}
        // `metadata` und nicht `auto`: die Kachelwand würde sonst zwanzig
        // Videos gleichzeitig laden. Das erste Bild reicht als Vorschau, und
        // genau das liefert `metadata`.
        preload="metadata"
        muted={!gross}
        playsInline
        className={
          gross ? `max-h-56 w-full bg-black ${className}` : `bg-black object-cover ${className}`
        }
      />
    );
  }

  if (medium.kind === "audio") {
    return gross ? (
      <div className="flex flex-col gap-2 p-2">
        <span className="flex items-center justify-center py-4 text-muted-foreground">
          <Icon icon={ART_SYMBOL.audio} className="size-10" />
        </span>
        <audio src={medium.url} controls className="w-full" />
      </div>
    ) : (
      <span className={rahmen}>
        <Icon icon={ART_SYMBOL.audio} className="size-1/3 text-muted-foreground" />
      </span>
    );
  }

  // Dateien: kein Vorschaubild, aber eine ehrliche Aufschrift. Ein leeres
  // Kästchen wäre eine Datei, von der man nicht weiß, was sie ist.
  return (
    <span className={`${rahmen} flex-col gap-1 text-muted-foreground`}>
      <Icon icon={ART_SYMBOL.file} className={gross ? "size-10" : "size-1/3"} />
      <span className="text-[0.625rem] font-semibold tracking-wide">
        {endung(medium.mime)}
      </span>
      {gross ? (
        <a
          href={medium.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-(--brand) underline-offset-2 hover:underline"
        >
          {t("datei.oeffnen")}
        </a>
      ) : null}
    </span>
  );
}

export { ART_SYMBOL };
