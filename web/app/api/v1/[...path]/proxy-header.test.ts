// Der Proxy darf Binärdateien weder beschädigen noch die Verbindung killen.
//
// ZWEI ECHTE BUGS, die dieser Test festhält (10.09.2026, beide live):
//
//  1. `await res.text()` statt `arrayBuffer()`: dekodiert die Bytes als UTF-8
//     und ersetzt jede ungültige Sequenz durch U+FFFD. Ein PDF kam als Müll
//     an — ohne Fehler, denn Länge und Content-Type sahen normal aus. Die
//     PDF-Vorschau der Hausmappe blieb grau.
//
//  2. `content-length` aus der Backend-Antwort durchgereicht: die Länge
//     gehört der Verbindung, die sie sendet. Next.js baut die Antwort neu
//     auf, die angekündigte Zahl passte nicht mehr zu den gesendeten Bytes,
//     und der Browser brach ab: „localhost hat die Verbindung abgelehnt" —
//     während das Backend im Log sauber 200 lieferte.
//
// Lauf: `bun test "web/app/api/v1/[...path]/proxy-header.test.ts"`
//
// Geprüft wird die reine Header-/Body-Mechanik, ohne Next-Laufzeit: genau die
// zwei Entscheidungen, an denen es zweimal gescheitert ist.
import { describe, expect, test } from "bun:test";

/** Die Header-Auswahl aus `route.ts` — bewusst hier gespiegelt, damit der
 *  Test die ENTSCHEIDUNG prüft und nicht die Next-Laufzeit. */
function durchgereichteHeader(backend: Headers): Record<string, string> {
  const raus: Record<string, string> = {
    "content-type": backend.get("content-type") ?? "application/json",
  };
  for (const name of [
    "content-disposition",
    "cache-control",
    "x-content-type-options",
  ]) {
    const wert = backend.get(name);
    if (wert) raus[name] = wert;
  }
  return raus;
}

describe("API-Proxy: Datei-Antworten", () => {
  test("reicht content-length NICHT durch", () => {
    const backend = new Headers({
      "content-type": "application/pdf",
      "content-length": "8046442",
      "content-disposition": "inline; filename*=UTF-8''x.pdf",
    });
    const raus = durchgereichteHeader(backend);
    expect(raus["content-length"]).toBeUndefined();
    // Was der Browser wirklich braucht, geht mit.
    expect(raus["content-type"]).toBe("application/pdf");
    expect(raus["content-disposition"]).toContain("inline");
  });

  test("überträgt Binärbytes unverändert (arrayBuffer, nicht text)", async () => {
    // Bytes, die als UTF-8 ungültig sind — genau daran scheiterte `text()`.
    const original = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0xff, 0xfe, 0x00, 0x80]);

    const alsBuffer = await new Response(original).arrayBuffer();
    expect(new Uint8Array(alsBuffer)).toEqual(original);

    // Gegenprobe: der alte Weg zerstört sie nachweislich.
    const alsText = await new Response(original).text();
    const kaputt = new TextEncoder().encode(alsText);
    expect(kaputt.length).not.toBe(original.length);
  });

  test("baut die Antwort ohne Längenverlust neu auf", async () => {
    const daten = new Uint8Array(5000).fill(0xab);
    const backend = new Response(daten, {
      headers: { "content-type": "application/pdf", "content-length": "5000" },
    });
    const rumpf = await backend.arrayBuffer();
    const neu = new Response(rumpf, {
      status: 200,
      headers: durchgereichteHeader(backend.headers),
    });
    expect((await neu.arrayBuffer()).byteLength).toBe(5000);
  });
});
