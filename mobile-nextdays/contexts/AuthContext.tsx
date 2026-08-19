// Zentraler Auth-State der App. Beim Kaltstart wird ein gespeichertes Token
// gegen GET /auth/me validiert; das Ergebnis (me) speist Erlebnis-Routing und
// Capability-Gating (lib/permissions.ts). EINZIGE Quelle für „bin ich
// angemeldet?" — Screens nutzen den Context, kein ad-hoc getToken().
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api } from "@/lib/api";
import {
  getToken,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type RegisterInput,
} from "@/lib/auth";

export type Role = "admin" | "co_admin" | "owner" | "staff" | "cleaner";

// Contract: apps/api/src/features/auth/schemas.py → MeResponse.
export type Me = {
  user_id: string;
  email: string | null;
  tenant_id: string | null;
  role: Role | null;
  capabilities: string[];
  permissions: string[];
  accommodation_type: string | null;
  /**
   * Vorführ-Mandant (0407). Dieser Zugang darf NICHTS ändern: der Riegel im
   * Backend (`demo_gate`) lehnt jede schreibende Anfrage mit 405 ab.
   *
   * Die App MUSS das anzeigen. Ohne den Hinweis erlebt man es als Defekt — man
   * tippt „Senden", es passiert nichts, und der Schluss ist „die App ist
   * kaputt". Genau so ist es hier aufgefallen. Das Web zeigt dafür ein Band
   * (`web/components/demo-band.tsx`), die App jetzt ebenfalls.
   */
  is_demo: boolean;
  /**
   * Anzeigename und Profilbild. NICHT aus `/auth/me` — das liefert nur die
   * E-Mail (deshalb stand in Kopfzeilen und Avataren bisher ein anonymes
   * Personen-Symbol). Beides kommt aus `/auth/account`, EINMAL je Sitzung
   * nachgeladen und hier gehalten: sonst bräuchte jeder Screen mit Avatar einen
   * eigenen Aufruf für zwei Felder.
   *
   * `null` heißt „nicht hinterlegt" bzw. „noch nicht geladen" — die Oberfläche
   * zeigt dann Initialen aus der E-Mail, nie einen erfundenen Namen.
   */
  full_name?: string | null;
  avatar_url?: string | null;
};

type Status = "loading" | "signedOut" | "signedIn";

type AuthState = {
  status: Status;
  me: Me | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  register: (
    input: RegisterInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);

  // me aus dem Server laden. Bei 401 hat api.ts bereits einen Refresh versucht;
  // scheitert das, ist die Session tot → signedOut.
  const fetchMe = useCallback(async (): Promise<boolean> => {
    try {
      const data = await api<Me>("/auth/me");
      setMe(data);
      // Name und Bild nachladen — best effort. Scheitert es, bleibt die Sitzung
      // gültig: der Zugang hängt an `/auth/me`, nicht an einem Anzeigenamen.
      try {
        const konto = await api<{ full_name: string | null; avatar_url: string | null }>(
          "/auth/account",
        );
        setMe((prev) =>
          prev
            ? {
                ...prev,
                full_name: konto.full_name,
                avatar_url: konto.avatar_url,
              }
            : prev,
        );
      } catch {
        // Kein Name — die Oberfläche fällt auf die E-Mail zurück.
      }
      return true;
    } catch {
      setMe(null);
      return false;
    }
  }, []);

  // Kaltstart: Token vorhanden → validieren; sonst direkt ausgeloggt.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setStatus("signedOut");
        return;
      }
      setStatus((await fetchMe()) ? "signedIn" : "signedOut");
    })();
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin(email, password);
      if (!res.ok) return { ok: false as const, error: res.error };
      const ok = await fetchMe();
      if (!ok) {
        // Login-Token da, aber /auth/me scheitert → nicht „halb angemeldet".
        await apiLogout();
        setStatus("signedOut");
        return { ok: false as const, error: "Konto konnte nicht geladen werden." };
      }
      setStatus("signedIn");
      return { ok: true as const };
    },
    [fetchMe],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await apiRegister(input);
      if (!res.ok) return { ok: false as const, error: res.error };
      const ok = await fetchMe();
      if (!ok) {
        await apiLogout();
        setStatus("signedOut");
        return { ok: false as const, error: "Konto konnte nicht geladen werden." };
      }
      setStatus("signedIn");
      return { ok: true as const };
    },
    [fetchMe],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setMe(null);
    setStatus("signedOut");
  }, []);

  const reload = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  const value = useMemo(
    () => ({ status, me, login, register, logout, reload }),
    [status, me, login, register, logout, reload],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth muss innerhalb von AuthProvider stehen.");
  return ctx;
}
