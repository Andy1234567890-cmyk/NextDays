// App-Konfiguration (bare React Native hat keine eingebauten Env-Vars wie Expo).
// EINZIGE Quelle für URLs/Umgebung — keine URL darf außerhalb dieser Datei
// stehen (CLAUDE.md Wurzel 4 sinngemäß). Umschaltung über __DEV__:
//   Dev  = lokales Backend (iOS-Sim: localhost, Android-Emu: 10.0.2.2)
//   Prod = self-hosted sslip.io (Übergangs-Domain bis zum Domain-Cutover;
//          dann NUR diese Datei anfassen).
import { Platform } from "react-native";

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
  apiUrl: "https://nextdays-api.65.21.144.136.sslip.io",
  // apiUrl: `http://${DEV_HOST}:8000`,
  // Muss zur Supabase gehören, gegen die das lokale Backend läuft
  // (apps/api/.env → SUPABASE_URL) — Realtime-Events kommen aus DERSELBEN DB
  // wie die REST-Daten, sonst nutzlos/irreführend. Stand heute: beide zeigen
  // auf den self-hosted Kong (sslip.io).
  supabaseUrl: "https://supabase-kong.65.21.144.136.sslip.io",
  // Öffentlicher anon-Key des self-hosted Kong (nur für Realtime-WebSocket;
  // RLS schützt die Daten). REST/Auth laufen über die API mit Bearer-Token.
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDAwMDAwLCJleHAiOjIwNjUzNjAwMDB9.j0vFr_Wttmw3kTluPio9ctHchDrgN0cjLwmhzkxk-hI",
};

const PROD: AppConfig = {
  apiUrl: "https://nextdays-api.65.21.144.136.sslip.io",
  supabaseUrl: "https://supabase-kong.65.21.144.136.sslip.io",
  // Öffentlicher anon-Key (derselbe Kong wie Dev). RLS schützt die Daten.
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDAwMDAwLCJleHAiOjIwNjUzNjAwMDB9.j0vFr_Wttmw3kTluPio9ctHchDrgN0cjLwmhzkxk-hI",
};

export const CONFIG: AppConfig = __DEV__ ? DEV : PROD;

// Rückwärtskompatibel: bestehende Importe von API_URL bleiben gültig.
export const API_URL = CONFIG.apiUrl;
