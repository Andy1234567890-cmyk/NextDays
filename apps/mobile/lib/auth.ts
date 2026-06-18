// Auth-Token-Verwaltung der Mobile-App. Speichert das FastAPI-Access-Token
// (nd_access-Äquivalent) sicher im Schlüsselbund (react-native-keychain).
// Login/Logout laufen über den auth-Slice des Backends (/auth/login).
import * as Keychain from "react-native-keychain";

import { api, type Result } from "@/lib/api";

const SERVICE = "nextdays.auth";
const ACCOUNT = "nd_access";

let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    cached = creds ? creds.password : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function setToken(token: string | null): Promise<void> {
  cached = token;
  try {
    if (token) {
      await Keychain.setGenericPassword(ACCOUNT, token, { service: SERVICE });
    } else {
      await Keychain.resetGenericPassword({ service: SERVICE });
    }
  } catch {
    // Keychain nicht verfügbar — in-memory reicht für die Session.
  }
}

type SessionResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

// E-Mail/Passwort-Login gegen das Backend; speichert das Token bei Erfolg.
export async function login(email: string, password: string): Promise<Result<true>> {
  try {
    const session = await api<SessionResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await setToken(session.access_token);
    return { ok: true, data: true };
  } catch {
    return { ok: false, error: "Login fehlgeschlagen." };
  }
}

export async function logout(): Promise<void> {
  await setToken(null);
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getToken()) !== null;
}
