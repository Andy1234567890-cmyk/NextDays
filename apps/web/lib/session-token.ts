"use server";

// Liefert das Access-Token des eingeloggten Nutzers für FastAPI-Aufrufe.
// Quelle: FastAPI-Cookie nd_access ODER Supabase-OAuth-Session (Google).
// getUser() zuerst validiert/erneuert die Session serverseitig (@supabase/ssr).
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

const ACCESS = "nd_access";

export async function currentToken(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(ACCESS)?.value;
  if (fromCookie) return fromCookie;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}
