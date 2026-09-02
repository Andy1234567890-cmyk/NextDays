"use server";

// Access-Token für den Realtime-Client (Client-Komponente, setAuth vor
// subscribe). Der Token bleibt sonst im httpOnly-Cookie; diese Action ist die
// EINZIGE Stelle, die ihn herausreicht — Realtime ohne ihn joint als anon und
// bekommt durch RLS 0 Events.
import { partnerToken } from "./api-server";

export async function partnerSessionToken(): Promise<string | null> {
  return partnerToken();
}
