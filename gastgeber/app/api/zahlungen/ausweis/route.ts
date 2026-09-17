// BFF-Route fuer das Ausweisdokument des Gastgebers. Dateien kommen vom Browser
// als multipart — der geteilte JSON-DAL (lib/api-server) kann kein multipart,
// und der Bearer darf nie ins Browser-JS (BFF). Daher hier: Host-Cookie-Bearer
// lesen, die Anfrage server-zu-server an FastAPI durchreichen. Typ, Groesse und
// Mandanten-Scope prueft das Backend (payments.router
// POST /payments/connect/accounts/{id}/identity-document).
//
// Warum es das gibt: scheitert Stripes Abgleich der eingetippten Angaben
// (`failed_keyed_identity`), nennt Stripe in seiner eigenen Meldung den Ausweg
// — „provide additional documentation to verify". Bis zum 17.09.2026 verwies
// unsere Karte an dieser Stelle auf den Support.
import { readToken } from "@nextdays/auth/server";

import { HOST_COOKIES } from "@/lib/api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const token = await readToken(HOST_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  const eingang = await req.formData();
  const datei = eingang.get("file");
  const konto = eingang.get("konto");
  if (!(datei instanceof File)) return new Response("Keine Datei", { status: 400 });
  if (typeof konto !== "string" || !konto) {
    return new Response("Kein Konto", { status: 400 });
  }
  // Die Seite kommt aus dem Formular; alles ausser „back" ist die Vorderseite.
  const rueckseite = eingang.get("seite") === "back";

  const form = new FormData();
  form.append("file", datei, datei.name);

  const res = await fetch(
    `${BACKEND}/api/v1/payments/connect/accounts/${encodeURIComponent(konto)}` +
      `/identity-document?rueckseite=${rueckseite}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form },
  );
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
