// Vorlage für config.secrets.ts (diese Datei ist im Repo, config.secrets.ts NICHT).
// Kopiere sie zu `config.secrets.ts` und trage den echten Wert ein:
//   cp lib/config.secrets.example.ts lib/config.secrets.ts
//
// SUPABASE_ANON_KEY = öffentlicher anon-Key des self-hosted Kong (nur für
// Realtime-WebSocket; RLS schützt die Daten). Aus Coolify / Supabase-Dashboard.
// Leer lassen ist erlaubt — der Realtime-Client degradiert sauber (lib/realtime.ts).
export const SUPABASE_ANON_KEY = "<DEIN_SUPABASE_ANON_KEY>";
