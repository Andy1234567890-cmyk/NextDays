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

import { protokolliereAbsturz } from "@/lib/absturzmeldung";
import { api } from "@/lib/api";
import { pushAbmelden, pushEinrichten, pushTapVerdrahten } from "@/lib/push";
import {
  getToken,
  isExpired,
  refreshSession,
  login as apiLogin,
  mfaFaktoren as apiMfaFaktoren,
  mfaLoesen as apiMfaLoesen,
  mfaSmsAnfordern as apiMfaSmsAnfordern,
  mfaVerwerfen,
  logout as apiLogout,
} from "@/lib/auth";

export type Role = "admin" | "co_admin" | "owner" | "staff" | "cleaner" | "shift_lead";

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
  /**
   * Sprache des Eigentümers aus `/auth/account` (`users.preferred_language`).
   * Sie steuert die Oberfläche (`contexts/SprachContext.tsx`) und ist dieselbe
   * Quelle, aus der Beleg und E-Mails ihre Sprache ziehen — die App war bis
   * 08.09.2026 als einzige Fläche hart deutsch.
   *
   * `null` heißt „nicht hinterlegt": dann entscheidet die Gerätesprache.
   */
  preferred_language?: string | null;
};

type Status = "loading" | "signedOut" | "signedIn";

type AuthState = {
  status: Status;
  me: Me | null;
  login: (
    email: string,
    password: string,
  ) => Promise<
    | { ok: true }
    | { ok: false; error: string }
    | { ok: false; mfaRequired: true; methods: string[]; phoneMasked: string | null }
  >;
  /** Schritt 2 bei aktivem 2FA: Faktor lösen, dann Konto laden. */
  mfaLoesen: (
    factorId: string,
    code: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Die factor_id je Typ (totp/phone) des offenen Anmeldevorgangs. */
  mfaFaktoren: () => Promise<
    { ok: true; data: Record<string, string> } | { ok: false; error: string }
  >;
  /** SMS-Code anfordern (nur bei phone-Faktor). */
  mfaSmsAnfordern: (
    factorId: string,
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
        const konto = await api<{
          full_name: string | null;
          avatar_url: string | null;
          preferred_language: string | null;
        }>("/auth/account");
        setMe((prev) =>
          prev
            ? {
                ...prev,
                full_name: konto.full_name,
                avatar_url: konto.avatar_url,
                preferred_language: konto.preferred_language,
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
  //
  // Der Ablauf wird VORHER geprüft (`isExpired`), nicht dem 401 überlassen.
  // Der Unterschied zeigt sich genau einmal am Tag: morgens, beim ersten
  // Öffnen nach einer Nacht. Dann ist das Token abgelaufen, und der Weg über
  // den 401 zieht `refreshSession` mitten in den Start hinein — parallel zu
  // Realtime-Abos und Push-Registrierung. Proaktiv erneuert läuft der Refresh
  // dagegen VOR dem ersten Aufruf, allein und in Ruhe.
  //
  // Das `.catch()` ist Pflicht, nicht Kosmetik: eine async-IIFE ohne Fänger
  // ist eine unbehandelte Rejection, und die beendet im Release-Build den
  // Prozess (`ErrorUtils`, `absturzmeldung.ts`) — sichtbar als „App geht kurz
  // an und verschwindet sofort wieder". Der Zwilling in `realtime.ts` trägt
  // denselben Fänger seit dem 28.08.2026; diese Stelle wurde damals übersehen.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setStatus("signedOut");
        return;
      }
      // Abgelaufen → erst erneuern. Schlägt das fehl, ist die Sitzung tot.
      if (await isExpired()) {
        if (!(await refreshSession())) {
          setStatus("signedOut");
          return;
        }
      }
      setStatus((await fetchMe()) ? "signedIn" : "signedOut");
    })().catch((e) => {
      // Kein stiller Prozesstod: protokollieren und sauber ausloggen, statt
      // die App im Splash sterben zu lassen (Wurzel 5, fail-closed).
      protokolliereAbsturz(e);
      setStatus("signedOut");
    });
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin(email, password);
      // 2FA offen: KEIN Fehler, sondern der zweite Schritt. Der Screen zeigt
      // die Code-Eingabe; die aal1-Sitzung liegt in lib/auth.ts.
      if (!res.ok && "mfaRequired" in res) {
        return {
          ok: false as const,
          mfaRequired: true as const,
          methods: res.methods,
          phoneMasked: res.phoneMasked,
        };
      }
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

  // Schritt 2: Faktor lösen. Danach dasselbe Muster wie beim Login — erst
  // /auth/me, dann signedIn. Ohne geladenes Konto bleibt der Nutzer draußen,
  // statt „halb angemeldet" zu sein.
  const mfaLoesen = useCallback(
    async (factorId: string, code: string) => {
      const res = await apiMfaLoesen(factorId, code);
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

  // Push-Registrierung am STATUS, nicht an den drei Aufrufern (Login, 2FA,
  // Kaltstart mit gueltigem Token). Sonst muesste derselbe Aufruf dreimal
  // stehen — und die dritte Stelle (Kaltstart) wird typischerweise vergessen,
  // womit ein Nutzer, der die App nur neu oeffnet, nie ein Token meldet.
  //
  // Fehler bleiben still: Push ist eine Zugabe. Wer die Meldungs-Berechtigung
  // verweigert, soll sich trotzdem anmelden koennen.
  useEffect(() => {
    if (status !== "signedIn") return;
    void pushEinrichten();
  }, [status]);

  // Der Tap auf eine Meldung — ebenfalls erst NACH der Anmeldung, nicht bei
  // jedem Mount. Frueher stand hier ein `useEffect(..., [])` mit der Begruendung,
  // ein Effekt an `signedIn` kaeme fuer einen Tap aus dem geschlossenen Zustand
  // zu spaet. Das ist nachweislich falsch:
  //
  //  - Die Start-Meldung liegt in den Intent-Extras der Activity
  //    (`NativeRNFBTurboMessaging.getInitialNotification`, Android-Quelle:
  //    `activity.getIntent().getExtras()`), nicht in einem fluechtigen Puffer.
  //    Sie bleibt abholbar, solange die Activity lebt — eine `message_id` wird
  //    dabei nur EINMAL ausgeliefert (`initialNotificationMap`).
  //  - Zu FRUEH ist der dokumentierte Fehlerfall, nicht zu spaet: ist die
  //    Activity noch nicht bereit, loggt das Modul woertlich „The current
  //    activity is not ready, try calling the method later in the React
  //    lifecycle" und liefert `null`.
  //
  // Der frueher Aufruf hatte dagegen einen echten Preis: er fasst die native
  // Firebase-Seite an, bevor irgendwer angemeldet ist. Ein Ziel-Deep-Link nuetzt
  // ohne Anmeldung ohnehin nichts — der Screen wuerde nur auf den Login werfen.
  useEffect(() => {
    if (status !== "signedIn") return;
    pushTapVerdrahten();
  }, [status]);

  const mfaFaktoren = useCallback(async () => {
    const res = await apiMfaFaktoren();
    return res.ok
      ? { ok: true as const, data: res.data }
      : { ok: false as const, error: res.error };
  }, []);

  const mfaSmsAnfordern = useCallback(async (factorId: string) => {
    const res = await apiMfaSmsAnfordern(factorId);
    return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
  }, []);

  const logout = useCallback(async () => {
    // Einen halb gelaufenen 2FA-Vorgang mitnehmen: sonst haengt die aal1-
    // Sitzung noch im Speicher, wenn sich danach jemand anders anmeldet.
    mfaVerwerfen();
    // VOR apiLogout: das Abmelden des Geraets braucht noch ein gueltiges
    // Token, sonst antwortet die Route 401 und das Geraet bekaeme weiter die
    // Meldungen des abgemeldeten Betriebs (Wurzel 1).
    await pushAbmelden();
    await apiLogout();
    setMe(null);
    setStatus("signedOut");
  }, []);

  const reload = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  const value = useMemo(
    () => ({
      status,
      me,
      login,
      mfaLoesen,
      mfaFaktoren,
      mfaSmsAnfordern,
      logout,
      reload,
    }),
    [status, me, login, mfaLoesen, mfaFaktoren, mfaSmsAnfordern, logout, reload],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth muss innerhalb von AuthProvider stehen.");
  return ctx;
}
