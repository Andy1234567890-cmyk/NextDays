"use server";

// Server Action, die das Host-Access-Token liefert — für den Realtime-Client
// (Client-Komponente), der setAuth(token) vor subscribe() braucht. Der Token
// bleibt server-seitig; die Action gibt ihn nur an den Realtime-Client weiter.
import { hostToken } from "./api-server";

export async function hostSessionToken(): Promise<string | null> {
  return hostToken();
}
