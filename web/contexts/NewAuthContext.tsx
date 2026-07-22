"use client";

/**
 * Auth-Context-Adapter für den Buchhaltungs-Bestand.
 *
 * Liefert die GLEICHE API wie der ursprüngliche Tasko-`NewAuthContext`
 * (`useNewAuth`, `NewAuthProvider`, `ProtectedRoute`, `NewAuthContextType`),
 * damit die übernommenen Komponenten UNVERÄNDERT bleiben. Die Daten kommen aus
 * der NextDays-Session: Eine Server-Komponente ermittelt den User via getMe()
 * und reicht ihn als `initialUser` an den Provider.
 *
 * Die Bestandskomponenten nutzen praktisch nur `user.uid`; companyId wird als
 * Prop durchgereicht, nicht aus diesem Context gelesen.
 */
import { createContext, useContext, type ReactNode } from "react";

/** Nutzerform, wie der Bestand sie erwartet (Tasko-`AuthUser`, kompatibel). */
export type AuthUser = {
  id: string;
  uid: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  user_type?: string;
  company_id?: string;
  company_name?: string;
  employee_id?: string;
  phone_number?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  displayName?: string;
};

export interface NewAuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  userRole: string | null;
  accessToken: string | null;
}

const NewAuthContext = createContext<NewAuthContextType | undefined>(undefined);

/**
 * Provider — bekommt den bereits aufgelösten NextDays-User (`initialUser`) von
 * einer Server-Komponente. Mappt die NextDays-MeResponse-Felder bereits dort
 * auf die AuthUser-Form.
 */
export function NewAuthProvider({
  user,
  children,
}: {
  user: AuthUser | null;
  children: ReactNode;
}) {
  return (
    <NewAuthContext.Provider
      value={{
        user,
        loading: false,
        isAuthenticated: !!user,
        isLoading: false,
        error: null,
        userRole: user?.user_type ?? null,
        accessToken: null,
      }}
    >
      {children}
    </NewAuthContext.Provider>
  );
}

export function useNewAuth(): NewAuthContextType {
  const ctx = useContext(NewAuthContext);
  if (!ctx) {
    // Kein Provider im Baum → leerer, sicherer Zustand (statt Fehler), damit
    // einzeln gerenderte Bestandskomponenten nicht crashen.
    return {
      user: null,
      loading: false,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      userRole: null,
      accessToken: null,
    };
  }
  return ctx;
}

/** Minimaler Schutz-Wrapper (1:1-Signatur; NextDays gated bereits per Layout). */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
