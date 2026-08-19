// Zentraler Auth-State der GAST-Welt (portal_guests) — das Gegenstück zu
// AuthContext (Tenant/Betrieb). Beide Provider laufen parallel: ein Nutzer kann
// als Gast angemeldet sein und trotzdem sein Betriebskonto nutzen. Die Sessions
// sind vollständig getrennt (eigene Keychain-Einträge, eigener HTTP-Client).
//
// Beim Kaltstart wird ein gespeichertes Gast-Token gegen GET /guest-auth/me
// validiert. EINZIGE Quelle für „ist ein Gast angemeldet?" — Screens fragen den
// Context, nie ad-hoc den Schlüsselbund.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getGuestProfile,
  getGuestToken,
  guestCodeAnfordern as apiGuestCodeAnfordern,
  guestCodePruefen as apiGuestCodePruefen,
  guestLogin as apiGuestLogin,
  guestLogout as apiGuestLogout,
  guestProfilAnlegen as apiGuestProfilAnlegen,
  guestRegister as apiGuestRegister,
  updateGuestProfile,
  type GuestProfile,
  type GuestRegisterInput,
} from "@/lib/guestAuth";

type Status = "loading" | "signedOut" | "signedIn";

type Antwort = { ok: true } | { ok: false; error: string };

type GuestAuthState = {
  status: Status;
  guest: GuestProfile | null;
  login: (email: string, password: string) => Promise<Antwort>;
  register: (input: GuestRegisterInput) => Promise<Antwort>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  /** Schritt 1 der Code-Anmeldung: Code an die Adresse schicken. */
  codeAnfordern: (email: string, locale?: string) => Promise<Antwort>;
  /** Schritt 2: Code prüfen. `profilFehlt` = Name muss noch erfasst werden;
   *  der Status bleibt dann bewusst `signedOut`, denn ohne Namen ist das Konto
   *  für eine Buchung nicht benutzbar. */
  codePruefen: (
    email: string,
    code: string,
  ) => Promise<Antwort & { profilFehlt?: boolean }>;
  /** Schritt 3 (nur Erstanmeldung): Namen nachtragen → dann angemeldet. */
  profilAnlegen: (input: { name: string; phone?: string }) => Promise<Antwort>;
  updateProfile: (input: {
    name?: string;
    phone?: string;
    preferred_locale?: string;
    preferred_currency?: string;
    marketing_opt_in?: boolean;
  }) => Promise<Antwort>;
};

const GuestAuthCtx = createContext<GuestAuthState | null>(null);

export function GuestAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [guest, setGuest] = useState<GuestProfile | null>(null);

  // Profil laden. Bei 401 hat guestApi bereits EINEN Refresh versucht; scheitert
  // der, ist die Session tot → signedOut (fail-closed).
  const ladeProfil = useCallback(async (): Promise<boolean> => {
    try {
      setGuest(await getGuestProfile());
      return true;
    } catch {
      setGuest(null);
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getGuestToken();
      if (!token) {
        setStatus("signedOut");
        return;
      }
      setStatus((await ladeProfil()) ? "signedIn" : "signedOut");
    })();
  }, [ladeProfil]);

  const login = useCallback(
    async (email: string, password: string): Promise<Antwort> => {
      const res = await apiGuestLogin(email, password);
      if (!res.ok) return { ok: false, error: res.error };
      if (!(await ladeProfil())) {
        // Token da, Profil nicht ladbar → nicht „halb angemeldet" stehenbleiben.
        await apiGuestLogout();
        setStatus("signedOut");
        return { ok: false, error: "Konto konnte nicht geladen werden." };
      }
      setStatus("signedIn");
      return { ok: true };
    },
    [ladeProfil],
  );

  const register = useCallback(
    async (input: GuestRegisterInput): Promise<Antwort> => {
      const res = await apiGuestRegister(input);
      if (!res.ok) return { ok: false, error: res.error };
      if (!(await ladeProfil())) {
        await apiGuestLogout();
        setStatus("signedOut");
        return { ok: false, error: "Konto konnte nicht geladen werden." };
      }
      setStatus("signedIn");
      return { ok: true };
    },
    [ladeProfil],
  );

  const codeAnfordern = useCallback(
    async (email: string, locale?: string): Promise<Antwort> => {
      const res = await apiGuestCodeAnfordern(email, locale);
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    [],
  );

  const codePruefen = useCallback(
    async (
      email: string,
      code: string,
    ): Promise<Antwort & { profilFehlt?: boolean }> => {
      const res = await apiGuestCodePruefen(email, code);
      if (!res.ok) return { ok: false, error: res.error };
      if (res.data.profilFehlt) {
        // Angemeldet, aber unvollständig: NICHT `signedIn` melden, sonst zeigt
        // die Oberfläche ein Konto ohne Namen als fertig an.
        return { ok: true, profilFehlt: true };
      }
      if (!(await ladeProfil())) {
        await apiGuestLogout();
        setStatus("signedOut");
        return { ok: false, error: "Konto konnte nicht geladen werden." };
      }
      setStatus("signedIn");
      return { ok: true, profilFehlt: false };
    },
    [ladeProfil],
  );

  const profilAnlegen = useCallback(
    async (input: { name: string; phone?: string }): Promise<Antwort> => {
      const res = await apiGuestProfilAnlegen(input);
      if (!res.ok) return { ok: false, error: res.error };
      setGuest(res.data);
      setStatus("signedIn");
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiGuestLogout();
    setGuest(null);
    setStatus("signedOut");
  }, []);

  const reload = useCallback(async () => {
    await ladeProfil();
  }, [ladeProfil]);

  const updateProfile = useCallback(
    async (input: {
      name?: string;
      phone?: string;
      preferred_locale?: string;
      preferred_currency?: string;
      marketing_opt_in?: boolean;
    }): Promise<Antwort> => {
      const res = await updateGuestProfile(input);
      if (!res.ok) return { ok: false, error: res.error };
      setGuest(res.data);
      return { ok: true };
    },
    [],
  );

  const value = useMemo(
    () => ({
      status,
      guest,
      login,
      register,
      logout,
      reload,
      updateProfile,
      codeAnfordern,
      codePruefen,
      profilAnlegen,
    }),
    [
      status,
      guest,
      login,
      register,
      logout,
      reload,
      updateProfile,
      codeAnfordern,
      codePruefen,
      profilAnlegen,
    ],
  );

  return <GuestAuthCtx.Provider value={value}>{children}</GuestAuthCtx.Provider>;
}

export function useGuestAuth(): GuestAuthState {
  const ctx = useContext(GuestAuthCtx);
  if (!ctx) throw new Error("useGuestAuth muss innerhalb von GuestAuthProvider stehen.");
  return ctx;
}
