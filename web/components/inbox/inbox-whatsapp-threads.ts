// WhatsApp-Konversationen als gleichwertige Posteingang-Threads: ID-Präfixe und
// die Umformung `WhatsAppConversation` → `InboxThread`. Aus `inbox-list.tsx`
// herausgelöst (Datei-Aufteilung, kein Verhaltenswechsel).
import { type InboxThread } from "@/lib/inbox";
import { type WhatsAppConversation } from "@/lib/whatsapp-api";

// Kanalname für WhatsApp-Konversationen in der gemeinsamen Liste (Filter/Anzeige).
export const WHATSAPP_CHANNEL = "WhatsApp";
// Stabiler ID-Präfix, damit WhatsApp-Threads von OTA-Threads unterscheidbar sind
// (Klick öffnet dann das WhatsApp-Chat-Panel statt der OTA-Konversation).
export const WA_PREFIX = "wa:";
// Flüchtige Konversation für eine NEUE Nummer (entsteht real erst beim Senden).
export const WA_NEW_PREFIX = "wa:new:";
export const isWhatsApp = (id: string) => id.startsWith(WA_PREFIX);

// WhatsApp-Konversation in die InboxThread-Form bringen, damit sie in derselben
// Liste/Filterung wie OTA-Threads läuft. Nur die Felder, die Liste + Filter
// nutzen, werden gefüllt; OTA-spezifische Felder bleiben null (keine Fallbacks).
export function whatsAppToThread(c: WhatsAppConversation): InboxThread {
  return {
    id: `${WA_PREFIX}${c.id}`,
    channex_booking_id: null,
    reservation_id: c.reservation_id,
    guest_id: null,
    property_id: null,
    property_title: null,
    ota_name: WHATSAPP_CHANNEL,
    // Normalisierte WhatsApp-Nummer mitführen (Feld bei WhatsApp sonst leer), um
    // zuverlässig „existiert schon ein Chat für diese Nummer?" zu prüfen — auch
    // wenn der Chat einen echten Gastnamen statt der Rohnummer anzeigt.
    ota_reservation_code: c.wa_phone.replace(/\D/g, ""),
    guest_name: c.guest_name ?? `+${c.wa_phone}`,
    // WhatsApp liefert kein Profilbild — die Initialen bleiben.
    guest_avatar_url: null,
    guest_email: null,
    guest_phone: null,
    status: null,
    arrival_date: null,
    departure_date: null,
    last_message: c.last_message,
    booked_at: null,
    // Bei WhatsApp IST `last_at` das Fremdereignis (Zeitpunkt der letzten
    // Nachricht), nicht unsere Schreibzeit — also gehört er hier hin.
    letzte_aktivitaet: c.last_at,
    updated_at: c.last_at,
    is_read: c.is_read,
    is_starred: false,
    is_archived: false,
    inbox_status: "active",
    assigned_user_id: null,
    assigned_user_name: null,
  };
}

// Flüchtiger Listeneintrag für eine neue, noch nicht existierende WhatsApp-Nummer.
export function whatsAppDraftThread(phone: string): InboxThread {
  return {
    ...whatsAppToThread({
      id: `new:${phone}`,
      wa_phone: phone,
      guest_name: null,
      reservation_id: null,
      last_message: null,
      last_at: null,
      is_read: true,
    }),
    id: `${WA_NEW_PREFIX}${phone}`,
  };
}
