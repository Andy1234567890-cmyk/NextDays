"use server";

// Onboarding-Fortschritt: Server-Actions gegen den dashboard-Slice
// (/api/v1/dashboard/onboarding). Das Dashboard zeigt den Setup-Assistenten,
// bis `completed` true ist. Status liegt pro Tenant in der DB.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type OnboardingStatus = {
  // "new" = Neukunde (legt Objekte neu an), "switch" = Wechselkunde (importiert
  // Bestands-Listings via Portale). null = Weiche noch offen.
  customer_type: "new" | "switch" | null;
  has_ota: boolean | null;
  selected_portals: string[];
  company_data_set: boolean;
  imported_from_ota: boolean;
  object_created: boolean;
  /** Anzahl der ECHTEN Objekte — ohne das Gerüst „Airbnb-Übernahme läuft".
   *  Der Server rechnet sie aus; die Oberfläche zählt NICHT selbst über
   *  `/properties`, weil dort auch das Gerüst mitkäme. */
  object_count: number;
  price_set: boolean;
  channels_done: boolean;
  /** Läuft ein Abo? Zusammen mit `company_data_set` entscheidet es, ob die
   *  Oberfläche bedienbar ist — ohne beides führt jeder Menüpunkt in eine
   *  Sackgasse. Serverseitig gemessen, nicht aus einem Flag. */
  subscription_active: boolean;
  /** Läuft gerade die kostenlose Testphase (Status genau `trialing`)?
   *  Getrennt von `subscription_active`, weil beide verschiedene Fragen
   *  beantworten: „darf der Betrieb arbeiten" (ja, auch im Test) gegenüber
   *  „wurde schon gezahlt" (nein). */
  in_trial: boolean;
  /** Ende der Testphase (ISO-8601, aus Stripe). `null`, wenn keine läuft ODER
   *  Stripe keinen Wert lieferte — dann zeigt das Band kein Datum statt eines
   *  gerechneten. */
  trial_ends_at: string | null;
  completed: boolean;
};

export type OnboardingUpdate = Partial<OnboardingStatus>;

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "PATCH"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/dashboard${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

export async function getOnboarding(): Promise<Result<OnboardingStatus>> {
  return call<OnboardingStatus>("/onboarding");
}

export async function updateOnboarding(
  patch: OnboardingUpdate,
): Promise<Result<OnboardingStatus>> {
  return call<OnboardingStatus>("/onboarding", { method: "PATCH", body: patch });
}
