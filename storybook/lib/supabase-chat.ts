// Supabase-Client für den Storybook-Chat. Nutzt den SSR-Browser-Client, damit
// er DIESELBE Login-Session (Cookies) sieht wie der Storybook-Login — so kennt
// der Chat den eingeloggten Nutzer und braucht keine zweite Anmeldung.
import { createBrowserClient } from "@supabase/ssr";

const url =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string);
const key =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string);

export const supabase = createBrowserClient(url, key, {
  realtime: { params: { eventsPerSecond: 5 } },
});

export type ChatMessage = {
  id: string;
  author: string;
  body: string;
  topic: string | null;
  created_at: string;
};
