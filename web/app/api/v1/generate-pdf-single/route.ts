// HTML→PDF-Dienst (Node-Runtime, Playwright/Chromium). Nimmt fertiges HTML
// entgegen und rendert es zu einem A4-PDF. Wird von den Finance-PDF-Templates
// (SendDocumentModal) und von der Eigentümer-Abrechnung genutzt.
//
// Vertrag (kompatibel zum Bestand): POST { htmlContent } → { success, pdfBase64 }.
// Diese spezifische Route hat in Next.js Vorrang vor der Catch-all /api/v1/[...path]
// (die ans FastAPI proxyt) — PDF-Rendering läuft also lokal in Node, nicht im
// Python-Backend (dort ist kein Playwright verfügbar).
import { NextResponse } from "next/server";
// playwright-core (statt "playwright"): identischer chromium.launch, aber ohne
// den eigenen Browser-Bootstrap-Treiber — der Chromium-Browser wird im Docker-
// Runtime-Stage über PLAYWRIGHT_BROWSERS_PATH bereitgestellt.
import { chromium } from "playwright-core";

import { currentToken } from "@/lib/session-token";

// Playwright braucht Node (kein Edge) und etwas Zeit fürs Rendern.
export const runtime = "nodejs";
export const maxDuration = 60;

// Obergrenze fürs Client-HTML (Wurzel 8: unbegrenzten Input kappen). Rechnungs-/
// Statement-Templates sind self-contained und weit darunter.
const MAX_HTML_BYTES = 2 * 1024 * 1024;

// SSRF-Allowlist (Wurzel 8): Die einzigen externen Sub-Resources, die PDF-
// Templates legitim laden, sind Logos aus unserem Supabase-Storage. Nur dieser
// Host ist erlaubt; alles andere (interne IPs, Cloud-Metadata, andere Ports)
// wird abgebrochen. Host aus NEXT_PUBLIC_SUPABASE_URL abgeleitet, kein Hardcode.
function erlaubterHost(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host || null;
  } catch {
    return null;
  }
}

// Private/interne Ziele hart blocken (zusätzlich zur Host-Allowlist, falls der
// erlaubte Host je auf eine interne IP zeigt — belt & suspenders).
function istPrivatesZiel(host: string): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".local")) return true;
  // IPv4 privat/loopback/linklocal/CGNAT + IPv6 loopback/ULA.
  return (
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) ||
    h === "::1" ||
    h.startsWith("fd") ||
    h.startsWith("fe80")
  );
}

export async function POST(req: Request) {
  // Auth erzwingen: nur eingeloggte web-Nutzer dürfen rendern (vorher UNAUTH →
  // SSRF-Vektor). Ohne gültige Session 401 (fail-closed, Wurzel 5).
  const token = await currentToken();
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Nicht authentifiziert." },
      { status: 401 },
    );
  }

  let htmlContent: string;
  try {
    const body = await req.json();
    htmlContent = body?.htmlContent;
  } catch {
    return NextResponse.json(
      { success: false, error: "Ungültiger Request-Body." },
      { status: 400 },
    );
  }

  if (!htmlContent || typeof htmlContent !== "string") {
    return NextResponse.json(
      { success: false, error: "htmlContent fehlt." },
      { status: 400 },
    );
  }

  if (Buffer.byteLength(htmlContent, "utf8") > MAX_HTML_BYTES) {
    return NextResponse.json(
      { success: false, error: "HTML zu groß." },
      { status: 413 },
    );
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    // SSRF-Sperre (Wurzel 8): Sub-Resources nur data:/blob: ODER von unserem
    // Storage-Host (Logos). Interne IPs/Metadata/andere Ports werden abgebrochen.
    const allowHost = erlaubterHost();
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url.startsWith("blob:")) {
        void route.continue();
        return;
      }
      try {
        const u = new URL(url);
        const okSchema = u.protocol === "http:" || u.protocol === "https:";
        if (okSchema && u.host === allowHost && !istPrivatesZiel(u.host)) {
          void route.continue();
          return;
        }
      } catch {
        /* unparsebare URL → blocken */
      }
      void route.abort();
    });
    // Externe Loads sind auf den Storage-Host begrenzt; networkidle ist ok, damit
    // das Logo geladen wird, bevor gerendert wird.
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    const pdfBase64 = Buffer.from(pdf).toString("base64");
    return NextResponse.json({ success: true, pdfBase64 });
  } catch (err) {
    // Ins Server-Log, nicht nur in die Antwort: der Client zeigt die erste
    // Zeile, das Log den ganzen Stack (Playwright liefert beim fehlenden
    // Browser einen mehrzeiligen Hinweis samt Install-Befehl).
    console.error("[generate-pdf-single] Rendering fehlgeschlagen", {
      htmlBytes: Buffer.byteLength(htmlContent, "utf8"),
      browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH ?? "(Standard)",
      fehler: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "PDF-Rendering fehlgeschlagen.",
      },
      { status: 500 },
    );
  } finally {
    if (browser) await browser.close();
  }
}
