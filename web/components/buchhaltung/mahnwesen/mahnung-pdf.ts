// Mahnungs-PDF im Browser mit pdf-lib (bereits Abhängigkeit von web).
//
// Warum hier und nicht über invoice-document.ts / @react-pdf: der Bestand kennt
// nur Rechnung/Angebot (invoiceToDocument) und einen Dossier-Renderer; eine
// Mahnung hat andere Zeilen (offener Betrag, Gebühr, Zinsen, Frist). Ein
// kleiner, eigener Erzeuger ist ehrlicher als ein Rechnungs-Template, das man
// verbiegt. Das Backend rendert keine Belege (wie beim Rechnungsversand) — es
// nimmt das PDF Base64 an, prüft Magic-Bytes und Größe.
//
// Schrift: Standard-Helvetica (WinAnsi). Deckt Latein-1 (dänisch/deutsch/
// französisch …) ab, aber KEIN Griechisch/Kyrillisch — Zeichen außerhalb werden
// vor dem Zeichnen ersetzt, statt dass pdf-lib wirft (sonst kein Versand).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { FirmaKopf, Reminder } from "@/lib/buchhaltung-mahnwesen-typen";
import { formatCurrency } from "@/lib/currency";

export type MahnungTexte = {
  titel: string;
  betreff: string;
  anrede: string;
  posten: {
    rechnung: string;
    faelligSeit: string;
    tageUeberfaellig: string;
    offenerBetrag: string;
    mahngebuehr: string;
    verzugszinsen: string;
    gesamt: string;
    zahlbarBis: string;
    mahndatum: string;
    bank: string;
  };
};

const SEITE_B = 595.28; // A4
const SEITE_H = 841.89;
const RAND = 56;

// WinAnsi-Zeichenvorrat: Latein-1 plus die Ergänzungen (Œ œ Š š Ÿ Ž ž €).
const NICHT_WINANSI = /[^ -ÿŒœŠšŸŽž€]/g;

function safe(text: string): string {
  return text.replace(NICHT_WINANSI, "?");
}

function zeilen(font: PDFFont, text: string, size: number, breite: number): string[] {
  const out: string[] = [];
  for (const absatz of safe(text).split(/\r?\n/)) {
    let zeile = "";
    for (const wort of absatz.split(" ")) {
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (font.widthOfTextAtSize(probe, size) > breite && zeile) {
        out.push(zeile);
        zeile = wort;
      } else {
        zeile = probe;
      }
    }
    out.push(zeile);
  }
  return out;
}

function datum(iso: string | null, locale: string): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat(locale).format(new Date(iso));
}

export async function mahnungPdfErzeugen(
  mahnung: Reminder,
  firma: FirmaKopf,
  texte: MahnungTexte,
  locale: string,
): Promise<{ bytes: Uint8Array; base64: string }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([SEITE_B, SEITE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const breite = SEITE_B - 2 * RAND;
  let y = SEITE_H - RAND;

  const schreib = (
    text: string,
    opts: { size?: number; fett?: boolean; x?: number; grau?: boolean } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.fett ? bold : font;
    const x = opts.x ?? RAND;
    for (const z of zeilen(f, text, size, breite - (x - RAND))) {
      page.drawText(z, {
        x,
        y,
        size,
        font: f,
        color: opts.grau ? rgb(0.45, 0.45, 0.45) : rgb(0.1, 0.1, 0.1),
      });
      y -= size * 1.4;
    }
  };

  // Absenderzeile (klein, grau) — nur, was da ist (Wurzel 4: nichts erfinden).
  const absender = [
    firma.companyName,
    [firma.companyStreet, firma.companyHouseNumber].filter(Boolean).join(" "),
    [firma.companyPostalCode, firma.companyCity].filter(Boolean).join(" "),
  ].filter(Boolean);
  if (absender.length) schreib(absender.join(" · "), { size: 8, grau: true });
  y -= 18;

  // Empfänger
  if (mahnung.customerName) schreib(mahnung.customerName, { fett: true });
  if (mahnung.customerAddress) schreib(mahnung.customerAddress);
  y -= 24;

  // Rechte Spalte: Mahndatum / Nummer
  const rechtsX = SEITE_B - RAND - 180;
  const yLinks = y;
  y = SEITE_H - RAND - 90;
  schreib(`${texte.posten.mahndatum}: ${datum(mahnung.reminderDate, locale)}`, {
    x: rechtsX,
    size: 9,
  });
  schreib(mahnung.reminderNumber, { x: rechtsX, size: 9 });
  y = Math.min(y, yLinks);

  // Titel + Betreff + Anrede + Kopftext
  schreib(texte.titel, { size: 16, fett: true });
  y -= 4;
  schreib(texte.betreff, { fett: true });
  y -= 10;
  schreib(texte.anrede);
  y -= 6;
  if (mahnung.textHeader) {
    schreib(mahnung.textHeader);
    y -= 10;
  }

  // Posten
  const geld = (b: string) => formatCurrency(Number(b), mahnung.currency, locale);
  const posten: Array<[string, string, boolean?]> = [
    [texte.posten.rechnung, mahnung.invoiceNumber ?? mahnung.invoiceId],
    [texte.posten.faelligSeit, datum(mahnung.invoiceDueDate, locale)],
    [texte.posten.tageUeberfaellig, String(mahnung.daysOverdue)],
    [texte.posten.offenerBetrag, geld(mahnung.amountOpen)],
    [texte.posten.mahngebuehr, geld(mahnung.fee)],
    [`${texte.posten.verzugszinsen} (${mahnung.interestRate} % p.a.)`, geld(mahnung.interest)],
    [texte.posten.gesamt, geld(mahnung.amountTotal), true],
    [texte.posten.zahlbarBis, datum(mahnung.dueDate, locale), true],
  ];
  const rechtsRand = SEITE_B - RAND;
  for (const [label, wert, fett] of posten) {
    const f = fett ? bold : font;
    page.drawLine({
      start: { x: RAND, y: y + 12 },
      end: { x: rechtsRand, y: y + 12 },
      thickness: 0.4,
      color: rgb(0.85, 0.85, 0.85),
    });
    page.drawText(safe(label), { x: RAND, y, size: 10, font: f });
    const w = f.widthOfTextAtSize(safe(wert), 10);
    page.drawText(safe(wert), { x: rechtsRand - w, y, size: 10, font: f });
    y -= 18;
  }
  y -= 12;

  if (mahnung.textFooter) {
    schreib(mahnung.textFooter);
    y -= 8;
  }

  // Bankverbindung — nur wenn vorhanden.
  const bank = [
    firma.bankName,
    firma.iban ? `IBAN ${firma.iban}` : "",
    firma.bic ? `BIC ${firma.bic}` : "",
  ].filter(Boolean);
  if (bank.length) {
    schreib(texte.posten.bank, { fett: true, size: 9 });
    schreib(bank.join(" · "), { size: 9 });
  }

  fusszeile(page, font, firma);

  const bytes = await doc.save();
  return { bytes, base64: bytesZuBase64(bytes) };
}

function fusszeile(page: PDFPage, font: PDFFont, firma: FirmaKopf): void {
  const teile = [
    firma.companyName,
    firma.email,
    firma.phoneNumber,
    firma.vatId ? `VAT ${firma.vatId}` : "",
  ].filter(Boolean);
  if (!teile.length) return;
  page.drawText(safe(teile.join(" · ")), {
    x: RAND,
    y: RAND / 2,
    size: 7.5,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
}

function bytesZuBase64(bytes: Uint8Array): string {
  let bin = "";
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) {
    bin += String.fromCharCode(...bytes.subarray(i, i + block));
  }
  return btoa(bin);
}
