// Das Vorschaubild, das LinkedIn, Facebook, WhatsApp, Slack, iMessage und X
// zeigen, wenn jemand mynextdays.com verlinkt.
//
// Warum erzeugt statt als Datei in `public/`: Es gab kein Bild im richtigen
// Format. Die vorhandenen Marken-Dateien sind ein Logo (1470×399), ein Quadrat
// (1600×1600) und ein Foto (1319×1070) — keines davon ist 1200×630, und jedes
// hätte auf den Plattformen einen anderen Ausschnitt bekommen: das Logo wäre
// oben und unten abgeschnitten, das Quadrat links und rechts. Ein Bild, das
// „irgendwie" passt, ist hier teurer als keines, weil es auf jeder Plattform
// anders falsch aussieht.
//
// `ImageResponse` rendert dieses JSX zur Laufzeit in ein PNG mit exakt den
// Maßen aus `size`. Damit stimmt das Format per Konstruktion, und der Text kann
// aus derselben Quelle kommen wie die Seite selbst, statt in einer Grafikdatei
// einzufrieren.
//
// Bewusst OHNE Übersetzung: Next erzeugt dieses Bild beim Bauen, außerhalb
// eines Requests — dort gibt es kein `nd_locale`-Cookie und damit keine
// Sprache. Der Titel bleibt deshalb der Markenname und die Zeile darunter
// englisch, in der Sprache, die auf allen Plattformen am wenigsten fehl am
// Platz wirkt. Der übersetzte Text steht ohnehin in `og:title`/`og:description`
// daneben; das Bild trägt die Marke, nicht den Fließtext.
import { ImageResponse } from "next/og";

export const alt = "myNextDays — Property management system and channel manager";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Markenfarben aus app/globals.css. Hier ausgeschrieben, weil `ImageResponse`
// kein Tailwind und keine CSS-Variablen kennt — es rendert reines Inline-CSS.
// Bei einer Markenänderung ist das die zweite Stelle; deshalb steht sie hier
// benannt und nicht dreimal im JSX verteilt.
const SCHWARZ = "#0a0a0a";
const ROT = "#b82028";

export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: SCHWARZ,
          padding: "80px",
          // `ImageResponse` hat keine Vorgabeschrift mit Umlauten in jeder
          // Lage — die System-Sans deckt den lateinischen Bereich ab, den
          // dieses Bild braucht.
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.03em",
          }}
        >
          myNextDays
        </div>
        <div
          style={{
            display: "flex",
            width: 160,
            height: 10,
            background: ROT,
            margin: "36px 0",
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 40,
            color: "#d4d4d8",
            lineHeight: 1.35,
            maxWidth: 900,
          }}
        >
          Property management and channel manager for holiday rentals and hotels
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 28,
            color: "#a1a1aa",
          }}
        >
          Built in Denmark · Hosted in the EU
        </div>
      </div>
    ),
    size,
  );
}
