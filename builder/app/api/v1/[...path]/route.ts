// Proxy für die Plattform → FastAPI (Muster wie apps/web/app/api/v1/[...path]/route.ts).
//
// Das Domänen-Modul (lib/inserate.ts) ruft `/api/v1/...` auf dem eigenen Origin.
// Dieser Route-Handler leitet server-seitig an das FastAPI-Backend weiter.
// Die Plattform ist aktuell entkoppelt und (noch) ohne eingeloggte Session;
// sobald Auth/Token nötig ist, wird hier — wie in apps/web — das Supabase-
// Session-Token via currentToken() als Bearer injiziert.
import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const search = req.nextUrl.search;
  const target = `${BACKEND}/api/v1/${path.join("/")}${search}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  // TODO Auth: const token = await currentToken();
  //            if (token) headers.Authorization = `Bearer ${token}`;

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.text();

  let res: Response;
  try {
    res = await fetch(target, { method, headers, body, cache: "no-store" });
  } catch {
    return NextResponse.json(
      { detail: "Backend nicht erreichbar." },
      { status: 503 },
    );
  }

  const respContentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": respContentType || "application/json" },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
