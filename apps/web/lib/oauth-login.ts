"use client";

// Startet den OAuth-Login (z. B. Google) über Supabase im Browser.
// Supabase leitet zum Anbieter weiter; nach Erfolg kehrt der Nutzer auf
// /auth/callback zurück (Code -> Session). Kein Secret im Browser — nur der
// publishable Key (siehe lib/supabase/client.ts).
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "apple";

export async function signInWithProvider(provider: Provider) {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  // Bei Erfolg navigiert Supabase bereits weg — Rückgabe nur für den Fehlerfall.
  return { ok: true as const };
}
