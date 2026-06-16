// Liefert die statischen Storybook-Dateien aus dem PRIVATEN Ordner protected/sb
// aus — aber nur, weil die Middleware vorher eine gültige Session verlangt hat.
// So sind die Assets (Idee, Architektur, Daten) NICHT per Direkt-URL öffentlich.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "protected", "sb");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path: segments = [] } = await params;

  // Pfad-Traversal verhindern.
  const rel = segments.join("/");
  if (rel.includes("..")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let filePath = path.join(ROOT, rel);
  let isIndex = false;

  try {
    const s = await stat(filePath).catch(() => null);
    // Verzeichnis oder leerer Pfad -> index.html (Storybook-Einstieg).
    if (!s || s.isDirectory()) {
      filePath = path.join(ROOT, rel, "index.html");
      isIndex = true;
    }
    const raw = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // In die index.html ein <base href="/sb/"> injizieren, damit die relativen
    // Asset-Pfade des Storybooks IMMER auf /sb/ auflösen — egal ob /sb oder /sb/.
    const body: BodyInit = isIndex
      ? raw
          .toString("utf-8")
          .replace(/<head(\s[^>]*)?>/i, (m) => `${m}<base href="/sb/">`)
      : new Uint8Array(raw);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        // Privat: niemals in geteilten Caches/CDN ablegen.
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
