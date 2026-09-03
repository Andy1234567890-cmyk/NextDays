// robots.txt — was Crawler dürfen, plus die Wegweiser auf Sitemap und llms.txt.
//
// Gesperrt sind genau die Pfade, die auch nicht in der Sitemap stehen (siehe
// dort für die Begründung je Pfad): die Suchergebnisseite und die Ziele von
// Einmal-Links aus E-Mails. `/api/` gehört ebenfalls dazu — die Route-Handler
// dieser App (Statusabfrage, Newsletter) liefern JSON, das in einem Suchindex
// nichts zu suchen hat.
//
// Absichtlich KEIN pauschales `Disallow: /` mit Ausnahmen: Diese Seite soll
// gefunden werden. Eine Sperre „bis zum Start" wäre hier falsch, weil die
// Marketing-Seite und das Hilfe-Center schon vor dem Start öffentlich sind —
// das ist ihr Zweck. Aus demselben Grund steht hier auch KEINE Sperre gegen
// KI-Crawler (GPTBot, ClaudeBot, PerplexityBot, Google-Extended): wer ein
// Sprachmodell fragt „welches PMS für Ferienwohnungen", soll uns in der Antwort
// finden. Das ist eine Vertriebsentscheidung, keine Nachlässigkeit — sie steht
// hier, damit sie beim nächsten Lesen nicht für vergessen gehalten wird.
//
// WARUM ROUTE-HANDLER STATT `robots.ts`: Next' `MetadataRoute.Robots` kennt nur
// die Felder des robots.txt-Standards. Der Verweis auf /llms.txt gehört nicht
// dazu und ließe sich über dieses Objekt nicht ausgeben. Die Datei existierte
// hier schon und lieferte 200 — sie war nur von nirgendwo aus verlinkt und
// damit praktisch unauffindbar.
//
// WARUM DER VERWEIS EIN KOMMENTAR IST (`#`) UND KEINE DIREKTIVE: Die Search
// Console meldete am 29.08.2026 für die bestehende Zeile `Host:` eine Warnung
// „Regel wird von Googlebot ignoriert (line 9)". `Host:` ist eine
// Yandex-Direktive, die Google nie unterstützt hat. Eine erfundene Zeile
// `Llms-txt:` bekäme dieselbe Warnung — sie wäre ohne Wirkung, aber mit
// sichtbarem Fehler in Googles Bericht, und ein Bericht, in dem eine harmlose
// Warnung dauerhaft steht, verdeckt die nächste echte.
//
// Als `#`-Kommentar ist der Verweis dagegen SPEZIFIKATIONSKONFORM (Kommentare
// sind ausdrücklich vorgesehen), erzeugt keine Warnung, und bleibt für ein
// Sprachmodell, das die Datei liest, genauso auffindbar — Modelle lesen den
// Text, nicht nur die Direktiven. Der verbindliche Weg ist ohnehin das
// `<link rel="llms-txt">` im Kopf jeder Seite (app/layout.tsx).
//
// `Host:` fällt aus demselben Grund weg: Sie hat für Google nie etwas bewirkt,
// die kanonische Domain wird jetzt dort festgelegt, wo sie wirkt — per
// 308-Weiterleitung (next.config.ts) und `rel=canonical` auf jeder Seite.
import { siteUrl } from "@/lib/site-url";

// Pfade, die kein Crawler indexieren soll. Dieselbe Liste wie die Ausschlüsse
// der Sitemap — stünde ein Pfad nur hier oder nur dort, widersprächen sich die
// beiden Dateien.
const GESPERRT = [
  "/api/",
  "/hilfe/suche",
  "/newsletter/bestaetigen",
  "/newsletter/abmelden",
  "/konto-loeschen/bestaetigen",
];

export function GET(): Response {
  const zeilen = [
    "User-agent: *",
    "Allow: /",
    ...GESPERRT.map((pfad) => `Disallow: ${pfad}`),
    "",
    `Sitemap: ${siteUrl("/sitemap.xml")}`,
    "",
    "# Wegweiser für KI-Assistenten (llmstxt.org):",
    `# ${siteUrl("/llms.txt")} — kompakter Index`,
    `# ${siteUrl("/llms-full.txt")} — vollständig, mit allen Hilfe-Artikeln`,
    "",
  ];

  return new Response(zeilen.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Einen Tag zwischenspeichern, wie zuvor auch. Die Datei ändert sich nur
      // mit einem Deploy.
      "cache-control": "public, max-age=86400",
    },
  });
}
