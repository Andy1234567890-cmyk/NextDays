// Die Medien-Abschnitte des Baukastens (0451): Video, Audio, Form.
//
// Alle drei sind SERVER-Komponenten. Video und Audio sind Einbettungen fremder
// Anbieter — dass sie hier ohne Client-Code auskommen, liegt daran, dass der
// eingebettete Rahmen seine eigene Oberfläche mitbringt.
//
// DER PUNKT, AUF DEN ES BEI DIESEN ZWEIEN ANKOMMT: der Renderer setzt die
// Einbettungs-Adresse SELBST zusammen. Er nimmt aus den Daten nur `provider`
// und `video_id` — und beide sind beim Speichern gegen eine Allowlist geprüft
// (`block_inhalte_medien.py`). Die vom Kunden eingegebene Adresse wandert NIE
// in ein `src`. Der Unterschied ist keine Formalie: eine Kennung aus
// [A-Za-z0-9_-] kann aus einem Attribut nicht ausbrechen, eine freie Adresse
// schon.
//
// Slider und Vorher/Nachher brauchen den Browser und stehen in eigenen
// Client-Dateien.
import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { sanitizeHtml } from "@/lib/sanitize";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";
import { BildNachweis } from "./bildnachweis";

/** Überschrift eines Abschnitts. Eigene kleine Komponente statt Import aus
 *  `basis-blocks`, damit diese Datei ohne jene übersetzbar bleibt. */
function Ueberschrift({ text, modus }: { text: string; modus: EditierModus }) {
  if (!text) return null;
  return (
    <h2
      {...editierbar(modus, "headline")}
      className="pb-6 font-display text-3xl font-extrabold tracking-tight"
    >
      {text}
    </h2>
  );
}

// =========================================================================
// Video
// =========================================================================

/** Die Einbettungs-Adresse — aus Anbieter und Kennung, nie aus der Eingabe.
 *
 *  YouTube bekommt `youtube-nocookie.com`: der Rahmen setzt dann erst beim
 *  Abspielen ein Cookie. Für eine Gästeseite mit Cookie-Hinweis ist das der
 *  Unterschied zwischen „ein Video ist eingebettet" und „hier wird ohne
 *  Zustimmung getrackt".
 *
 *  `null` bei unbekanntem Anbieter — nicht ein geratener Rahmen (Wurzel 4). */
function einbettung(provider: string, id: string): string | null {
  const sicher = encodeURIComponent(id);
  switch (provider) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${sicher}`;
    case "vimeo":
      return `https://player.vimeo.com/video/${sicher}`;
    case "dailymotion":
      return `https://geo.dailymotion.com/player.html?video=${sicher}`;
    default:
      return null;
  }
}

/** `VideoObject`-JSON-LD — nur, wenn Name, Beschreibung UND Datum da sind.
 *
 *  Google verlangt für das Rich Result alle drei. Ein halbes Schema ist kein
 *  kleineres Ergebnis, sondern ein Verstoß gegen seine Richtlinien — und der
 *  kann die ganze Domain aus den Rich Results nehmen. Deshalb: alle drei oder
 *  keines (dieselbe Regel wie beim Objekt-Schema in `strukturierte-daten.tsx`). */
function VideoSchema({
  name,
  beschreibung,
  datum,
  einbettungsUrl,
}: {
  name: string;
  beschreibung: string;
  datum: string;
  einbettungsUrl: string;
}) {
  if (!name || !beschreibung || !datum) return null;
  return (
    <script
      type="application/ld+json"
      // Nur eigene, geprüfte Felder; `<` wird escaped, damit das Element nicht
      // aus dem JSON heraus geschlossen werden kann.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name,
          description: beschreibung,
          uploadDate: datum,
          embedUrl: einbettungsUrl,
        }).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function VideoBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const provider = typeof content.provider === "string" ? content.provider : "";
  const id = typeof content.video_id === "string" ? content.video_id : "";
  const src = provider && id ? einbettung(provider, id) : null;

  if (!src) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerVideo}
      />
    );
  }

  const datum =
    typeof content.schema_upload_date === "string"
      ? content.schema_upload_date
      : "";

  return (
    <section className="mx-auto max-w-4xl px-6 py-14">
      <Ueberschrift text={headline} modus={modus} />
      {/* 16:9 über `aspect-video`: ohne feste Höhe springt die Seite beim
          Laden des Rahmens (Layout Shift), und das ist einer der Werte, die
          Google direkt misst. */}
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          src={src}
          title={
            pickText(content.schema_name, modus.locale) ||
            headline ||
            texte(modus.locale).videoTitel
          }
          loading="lazy"
          // `allow` genau so eng wie nötig: Vollbild ja, Kamera/Mikrofon/
          // Standort nein. Ohne diese Angabe erbt der Rahmen die
          // Permissions-Policy der Seite.
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="size-full border-0"
        />
      </div>
      <VideoSchema
        name={pickText(content.schema_name, modus.locale)}
        beschreibung={pickText(content.schema_description, modus.locale)}
        datum={datum}
        einbettungsUrl={src}
      />
    </section>
  );
}

// =========================================================================
// Audio
// =========================================================================

export function AudioBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const provider = typeof content.provider === "string" ? content.provider : "";
  const url = typeof content.url === "string" ? content.url : "";

  if (!provider || !url) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerAudio}
      />
    );
  }

  const dunkel = content.dark === true;
  // Beide Anbieter erwarten die Adresse der Aufnahme als Parameter. Sie ist
  // beim Speichern auf Host und Form geprüft; `encodeURIComponent` sorgt
  // zusätzlich dafür, dass sie den Parameter nicht verlassen kann.
  const ziel = encodeURIComponent(url);
  const src =
    provider === "mixcloud"
      ? `https://player-widget.mixcloud.com/widget/iframe/?feed=${ziel}` +
        `&hide_cover=1&light=${dunkel ? "0" : "1"}`
      : `https://w.soundcloud.com/player/?url=${ziel}` +
        "&color=%23000000&auto_play=false&show_teaser=false";
  // SoundCloud braucht 166 px, Mixcloud 120 px — die von den Anbietern
  // dokumentierten Höhen ihrer kompakten Fassung. Ein gemeinsamer Wert hätte
  // bei einem von beiden einen abgeschnittenen oder leeren Streifen ergeben.
  const hoehe = provider === "mixcloud" ? 120 : 166;

  return (
    <section className="mx-auto max-w-3xl px-6 py-14">
      <Ueberschrift text={headline} modus={modus} />
      <iframe
        src={src}
        title={headline || texte(modus.locale).audioTitel}
        loading="lazy"
        allow="autoplay"
        className="w-full rounded-2xl border-0"
        style={{ height: `${hoehe}px` }}
      />
    </section>
  );
}

// =========================================================================
// Form
// =========================================================================

/** Die Formen als `clip-path`.
 *
 *  Feste Tabelle und kein zusammengesetzter Wert: was hier nicht steht, gibt es
 *  nicht — und das Backend lässt ohnehin nur diese Schlüssel durch. `circle`
 *  und `rounded` kommen ohne `clip-path` aus (Border-Radius reicht und bleibt
 *  anklickbar), deshalb stehen sie mit `null` drin statt zu fehlen. */
const FORMEN: Record<string, string | null> = {
  circle: null,
  rounded: null,
  square: null,
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  blob: "polygon(40% 0%, 75% 5%, 100% 35%, 92% 72%, 60% 100%, 22% 94%, 0% 62%, 8% 24%)",
  flag: "polygon(0% 0%, 100% 0%, 100% 100%, 50% 82%, 0% 100%)",
};

const RUNDUNG: Record<string, string> = {
  circle: "rounded-full",
  rounded: "rounded-3xl",
  square: "rounded-none",
};

export function FormBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const shape = typeof content.shape === "string" ? content.shape : "circle";
  const titel = pickText(content.title, modus.locale).trim();
  const html = sanitizeHtml(pickText(content.text, modus.locale));
  const href = typeof content.href === "string" ? content.href : null;
  const bild = typeof content.image_url === "string" ? content.image_url : null;

  if (!titel && !html && !bild) {
    return (
      <AbschnittLeer modus={modus} grund={texte(modus.locale).leerForm} />
    );
  }

  const clip = FORMEN[shape] ?? null;
  const rundung = RUNDUNG[shape] ?? "";
  const align =
    content.align === "left"
      ? "justify-start"
      : content.align === "right"
        ? "justify-end"
        : "justify-center";

  const inhalt = (
    <div
      className={
        "flex aspect-square size-56 flex-col items-center justify-center gap-1 overflow-hidden bg-primary p-6 text-center text-primary-foreground " +
        rundung
      }
      style={{
        ...(clip ? { clipPath: clip } : {}),
        ...(bild
          ? {
              // Die Adresse ist beim Speichern gegen die href-Allowlist geprüft
              // (nur http(s)/relativ). Ein `"` darin wäre trotzdem ein Ausbruch
              // aus dem url() — dieselbe Behandlung wie beim
              // Abschnitts-Hintergrund.
              backgroundImage: `url("${bild.replace(/["'\\()]/g, "")}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}),
      }}
    >
      {titel ? (
        <span className="font-display text-xl font-extrabold leading-tight">
          {titel}
        </span>
      ) : null}
      {html ? (
        <span
          className="text-sm leading-snug"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
    </div>
  );

  return (
    <section className="mx-auto flex max-w-5xl flex-col px-6 py-10">
      <div className={`flex ${align}`}>
        {href ? (
          <a href={href} className="transition hover:-translate-y-1">
            {inhalt}
          </a>
        ) : (
          inhalt
        )}
      </div>
      {/* Der Nachweis steht UNTER der Flaeche und nicht darin: die Flaeche ist
          per `clip-path` beschnitten (Kreis, Raute, Blob), ein Balken in ihrer
          Ecke waere abgeschnitten. Ohne Nachweis rendert er nichts. */}
      <div className={`flex ${align}`}>
        <BildNachweis src={bild} variante="zeile" />
      </div>
    </section>
  );
}
