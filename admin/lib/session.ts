"use server";

// Access-Token für den Realtime-Client. Der Token liegt in einem httpOnly-Cookie
// und ist im Browser-JS nicht lesbar — Supabase-Realtime braucht ihn aber
// clientseitig für setAuth(). Diese Server Action reicht ihn gezielt heraus.
//
// Das ist die EINZIGE Stelle, an der der Token den Server verlässt. Vertretbar,
// weil Realtime ohne ihn als anon joint und die RLS-Policies dann 0 Events
// liefern; der Token ist derselbe, den der Nutzer ohnehin besitzt.
import { adminToken } from "./api-server";

export async function adminSessionToken(): Promise<string | null> {
  return adminToken();
}
