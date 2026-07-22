// Lese-Zugriff auf das eigene Konto (Server Component-tauglich, KEIN "use server").
// getMe() ruft /auth/me server-zu-server über den DAL. Für Rollen-/Capability-
// Gating im Dashboard (nie clientseitig „aufmachen").
import { api, ApiError, hostToken } from "./api-server";
import type { MeResponse } from "./auth";

/** Das eigene Konto (oder null, wenn nicht eingeloggt / Token ungültig). */
export async function getMe(): Promise<MeResponse | null> {
  const token = await hostToken();
  if (!token) return null;
  try {
    return await api<MeResponse>("/auth/me");
  } catch (exc) {
    // 401/403 → nicht (mehr) eingeloggt. Andere Fehler ebenso als „kein Konto"
    // behandeln, damit die Seite nicht crasht (Login-Redirect greift).
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}
