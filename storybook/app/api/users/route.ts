// Geschützte Nutzer-Verwaltung für das Storybook.
// - Nur eingeloggte ADMINS (STORYBOOK_ADMIN_EMAILS) dürfen anlegen/listen.
// - Der Service-Role-Key bleibt SERVERSEITIG (niemals im Browser).
// - Legt Nutzer mit Sofort-Passwort an; die neue E-Mail wird automatisch der
//   Zugangs-Allowlist hinzugefügt, damit der neue Nutzer rein darf.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminEmails(): Set<string> {
  return new Set(
    (process.env.STORYBOOK_ADMIN_EMAILS ?? "a.staudinger32@gmail.com")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Prüft die Login-Session und gibt die E-Mail des Aufrufers zurück (oder null).
async function callerEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() ?? null;
}

function admin() {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

function genPassword(): string {
  const chars =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = new Uint8Array(14);
  crypto.getRandomValues(a);
  return "Nd-" + Array.from(a, (n) => chars[n % chars.length]).join("");
}

export async function GET() {
  const email = await callerEmail();
  if (!email || !adminEmails().has(email)) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  }
  const { data, error } = await admin().auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users = data.users.map((u) => ({
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const email = await callerEmail();
  if (!email || !adminEmails().has(email)) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  }

  let body: { email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const newEmail = (body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
    return NextResponse.json(
      { error: "Bitte eine gültige E-Mail eingeben." },
      { status: 400 },
    );
  }

  const password = genPassword();
  const { error } = await admin().auth.admin.createUser({
    email: newEmail,
    password,
    email_confirm: true,
    user_metadata: body.name ? { name: body.name.trim() } : undefined,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ email: newEmail, password });
}
