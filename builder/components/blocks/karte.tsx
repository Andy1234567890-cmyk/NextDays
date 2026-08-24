// Karten-Abschnitt einer Kunden-Website (0432).
//
// Zeigt die Lage des Betriebs oder eines Objekts. Die Adresse kommt aus dem
// Abschnitt selbst — oder, wenn sie dort leer bleibt, aus dem FIRMENPROFIL. Das
// ist der Normalfall und derselbe Grundsatz wie beim Kontakt-Abschnitt: wer
// seine Betriebsadresse zeigt, soll sie nicht abtippen.
//
// Googles Maps-EMBED-API per iframe und nicht die JS-API: sie versteht eine
// Adresse direkt. Die JS-API braucht Koordinaten, also einen Geocoding-Aufruf
// pro Seitenansicht — ein zweiter kostenpflichtiger Dienst und ein zusätzliches
// JS-Bundle auf jeder Gästeseite, für eine Karte, die einen Ort zeigt.
//
// OHNE Schlüssel gibt es keine Karte, sondern einen LINK auf Google Maps. Nicht
// als Notlösung, sondern weil das die ehrliche Anzeige ist: ein grauer Kasten,
// der aussieht wie eine defekte Karte, wäre schlechter (Wurzel 4). Der Link
// funktioniert ohne jeden Dienst und ohne Schlüssel.
import { Icon } from "@iconify/react";

import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import type { SiteBranding } from "@/lib/site-context";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

/** Der Schlüssel steht im `src` eines iframes und ist damit ohnehin öffentlich.
 *  Er wird zur Bauzeit eingebacken (siehe builder/Dockerfile). */
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export function KarteBlock({
  content,
  modus = NICHT_EDITIERBAR,
  branding,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Für den Rückfall auf die Anschrift aus dem Firmenprofil. */
  branding?: SiteBranding | null;
}) {
  const headline = pickText(content.headline, modus.locale);
  const eigene =
    typeof content.address === "string" ? content.address.trim() : "";
  // Der Rückfall ist die Anschrift des Betriebs — dieselbe, die die Fußzeile
  // zeigt. Sie steckt nicht im Branding, sondern kommt über das
  // Organization-Objekt (0430), das der Resolver ohnehin liefert.
  const org = branding?.organization;
  const ausProfil = [org?.street, org?.postal_code, org?.city]
    .filter(Boolean)
    .join(" ")
    .trim();
  const adresse = eigene || ausProfil;

  if (!adresse) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerKarte}
      />
    );
  }

  const zoom =
    typeof content.zoom === "number" && content.zoom >= 1 && content.zoom <= 20
      ? content.zoom
      : 14;
  const hoehe =
    typeof content.height === "number" &&
    content.height >= 200 &&
    content.height <= 800
      ? content.height
      : 400;

  const suchLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      {headline ? (
        <h2
          {...editierbar(modus, "headline")}
          className="pb-6 font-display text-3xl font-extrabold tracking-tight"
        >
          {headline}
        </h2>
      ) : null}

      {MAPS_KEY ? (
        <iframe
          // `loading="lazy"`: eine Karte steht praktisch immer unter der Falz,
          // und sie ist der teuerste Einzelbestandteil der Seite.
          loading="lazy"
          title={headline || adresse}
          // `referrerPolicy`: ohne sie schickt der Browser die vollständige
          // Adresse der Kundenseite an Google. Der Host genügt, damit die
          // Referrer-Beschränkung des Schlüssels greift.
          referrerPolicy="origin"
          allowFullScreen
          className="w-full rounded-2xl border border-border"
          style={{ height: `${hoehe}px` }}
          src={
            `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(MAPS_KEY)}` +
            `&q=${encodeURIComponent(adresse)}&zoom=${zoom}`
          }
        />
      ) : (
        // Kein Schlüssel → kein Kartenbild, aber die Adresse und der Weg
        // dorthin. Das ist die vollständige Aussage; nur das Bild fehlt.
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-border px-6 py-8">
          <p className="text-base font-semibold">{adresse}</p>
          <a
            href={suchLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold underline"
          >
            <Icon icon="ph:map-pin" className="size-4" />
            {texte(modus.locale).karteOeffnen}
          </a>
        </div>
      )}

      {/* Der Link steht AUCH unter der Karte: aus einem iframe heraus lässt
          sich keine Navigation starten, und ein Gast auf dem Telefon will die
          Route in seiner Karten-App, nicht in einem Rahmen. */}
      {MAPS_KEY ? (
        <a
          href={suchLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 pt-3 text-sm font-semibold underline"
        >
          <Icon icon="ph:navigation-arrow" className="size-4" />
          {texte(modus.locale).karteRoute}
        </a>
      ) : null}
    </section>
  );
}
