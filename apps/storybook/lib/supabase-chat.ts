// Supabase-Browser-Client NUR für den Storybook-Austausch-Chat.
// Nutzt den öffentlichen publishable-key (kein Geheimnis) und spricht
// ausschließlich die isolierte Tabelle storybook_chat an.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const chatCode = (import.meta.env.VITE_CHAT_CODE as string) ?? "";

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
});

export type ChatMessage = {
  id: string;
  author: string;
  body: string;
  topic: string | null;
  created_at: string;
};
