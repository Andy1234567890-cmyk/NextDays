// HTML→PDF-Dienst (Node-Runtime, Playwright/Chromium). Nimmt fertiges HTML
// entgegen und rendert es zu einem A4-PDF. Wird von den Finance-PDF-Templates
// (SendDocumentModal) und von der Eigentümer-Abrechnung genutzt.
//
// Vertrag (kompatibel zum Bestand): POST { htmlContent } → { success, pdfBase64 }.
// Diese spezifische Route hat in Next.js Vorrang vor der Catch-all /api/v1/[...path]
// (die ans FastAPI proxyt) — PDF-Rendering läuft also lokal in Node, nicht im
// Python-Backend (dort ist kein Playwright verfügbar).
import { NextResponse } from "next/server";
import { chromium } from "playwright";

// Playwright braucht Node (kein Edge) und etwas Zeit fürs Rendern.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
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

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    // Inhalte laden und auf Webfonts/Styles warten.
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    const pdfBase64 = Buffer.from(pdf).toString("base64");
    return NextResponse.json({ success: true, pdfBase64 });
  } catch (err) {
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
