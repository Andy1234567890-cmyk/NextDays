// Geteilte Auth-Typen (client- und server-sicher, keine Runtime-Imports).
// ADR-0017: nur die identischen Shapes; app-spezifische Felder bleiben in der App.

/** Session-Antwort des FastAPI-Auth-Backends (POST /auth/login|register). */
export interface SessionResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** Login-Antwort — kann statt einer Session einen MFA-Zwischenschritt liefern. */
export interface LoginResponse {
  mfa_required: boolean;
  session: SessionResponse | null;
  mfa_token: string | null;
}

/** GET /auth/me — Konto + Rollen/Capabilities fürs UI-Gating. */
export interface MeResponse {
  user_id: string;
  email: string | null;
  tenant_id: string | null;
  role: string | null;
  capabilities: string[];
  permissions: string[];
  accommodation_type: string | null;
  account_type: string | null;
}

/** Die Namen der Session-Cookies einer App (Sicherheitsgrenze — pro App
 *  explizit, NIE ein Default im Shared-Package, ADR-0017 / Wurzel 4). */
export interface CookieNames {
  access: string;
  refresh: string;
}
