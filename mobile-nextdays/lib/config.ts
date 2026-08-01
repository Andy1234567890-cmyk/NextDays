// App-Konfiguration (bare React Native hat keine eingebauten Env-Vars wie Expo).
// EINZIGE Quelle für URLs/Umgebung — keine URL darf außerhalb dieser Datei
// stehen (CLAUDE.md Wurzel 4 sinngemäß). Umschaltung über __DEV__:
//   Dev  = lokales Backend (iOS-Sim: localhost, Android-Emu: 10.0.2.2)
//   Prod = api.mynextdays.com (seit dem Domain-Cutover 31.07.2026).
// Supabase/Kong bleibt bewusst auf der sslip.io-Adresse — bewusste
// Sicherheitsentscheidung, die DB bekommt KEINE öffentliche Marken-Domain.
import { Platform } from "react-native";

// Öffentlicher anon-Key aus der gitignorierten config.secrets.ts (im Repo nur
// der Platzhalter config.secrets.example.ts). Erststart: einmal kopieren
//   cp lib/config.secrets.example.ts lib/config.secrets.ts
// und den echten Wert eintragen. Kein echter Token im Repo (CLAUDE.md).
import { SUPABASE_ANON_KEY } from "./config.secrets";

// Android-Emulator erreicht den Host über 10.0.2.2 statt localhost — nur
// relevant, wenn unten bewusst auf lokales Backend umgeschaltet wird.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";

type AppConfig = {
  apiUrl: string;
  supabaseUrl: string;
  // anon-Key NUR für Realtime (RLS-gefiltert). In Prod kommt der Wert aus
  // Coolify und wird hier eingetragen; leer lassen ist erlaubt — der Realtime-
  // Client MUSS bei leerem Key sauber degradieren (kein Crash), siehe
  // lib/realtime.ts.
  supabaseAnonKey: string;
};

const DEV: AppConfig = {
  // Ansage Andy (13.07.): auch Dev läuft gegen die ECHTE API/DB (sslip.io) —
  // kein lokales Backend nötig. Wer bewusst lokal testen will, kommentiert
  // die localhost-Zeile ein (DEV_HOST: iOS-Sim localhost, Android 10.0.2.2).
  apiUrl: "https://api.mynextdays.com",
  // apiUrl: `http://${DEV_HOST}:8000`,
  // Muss zur Supabase gehören, gegen die das lokale Backend läuft
  // (apps/api/.env → SUPABASE_URL) — Realtime-Events kommen aus DERSELBEN DB
  // wie die REST-Daten, sonst nutzlos/irreführend. Stand heute: beide zeigen
  // auf den self-hosted Kong (sslip.io).
  supabaseUrl: "https://supabase-kong.65.21.144.136.sslip.io",
  // Öffentlicher anon-Key des self-hosted Kong (nur für Realtime-WebSocket;
  // RLS schützt die Daten). REST/Auth laufen über die API mit Bearer-Token.
  // Wert aus der gitignorierten config.secrets.ts (kein echter Token im Repo).
  supabaseAnonKey: SUPABASE_ANON_KEY,
};

const PROD: AppConfig = {
  apiUrl: "https://api.mynextdays.com",
  supabaseUrl: "https://supabase-kong.65.21.144.136.sslip.io",
  // Öffentlicher anon-Key (derselbe Kong wie Dev). RLS schützt die Daten.
  // Wert aus der gitignorierten config.secrets.ts (kein echter Token im Repo).
  supabaseAnonKey: SUPABASE_ANON_KEY,
};

export const CONFIG: AppConfig = __DEV__ ? DEV : PROD;

// Rückwärtskompatibel: bestehende Importe von API_URL bleiben gültig.
export const API_URL = CONFIG.apiUrl;
