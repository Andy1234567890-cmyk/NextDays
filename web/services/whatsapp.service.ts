'use client';

import { api } from '@/lib/api-client';
import { createClickToChatLink } from '@/lib/whatsapp';

/**
 * WhatsApp Service
 *
 * Features:
 * 1. Click-to-Chat Links (kostenlos, funktioniert sofort)
 * 2. Meta WhatsApp Business API Integration (optional)
 * 3. Nachrichten-Historie in Supabase
 *
 * Setup (optional - für In-App Messaging):
 * - META_WHATSAPP_ACCESS_TOKEN
 * - META_WHATSAPP_PHONE_NUMBER_ID
 */

export interface WhatsAppMessage {
  id?: string;
  companyId: string;
  customerId?: string;
  customerName?: string;
  customerPhone: string;
  waId?: string;
  direction: 'outbound' | 'inbound';
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  body: string;
  messageId?: string;
  messageType?: string;
  mediaId?: string;
  mediaUrl?: string;
  templateName?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date | string | { seconds: number; nanoseconds: number };
  timestamp?: Date | string;
}

export interface WhatsAppConnection {
  companyId: string;
  phoneNumber: string;
  isConnected: boolean;
  qrCode?: string;
  connectedAt?: string;
  expiresAt?: string;
  lastQrGeneratedAt?: string;
  // Meta API Credentials
  accessToken?: string;
  phoneNumberId?: string;
  wabaId?: string;
  displayName?: string;
  status?: string;
  tokenType?: string;
  tokenExpiresAt?: string;
  tokenLastUpdated?: string;
}

export class WhatsAppService {
  /**
   * Generiert Click-to-Chat Link (funktioniert IMMER)
   */
  static getClickToChatLink(phone: string, message?: string): string {
    return createClickToChatLink(phone, message);
  }

  /**
   * Öffnet WhatsApp Chat in neuem Tab/App
   */
  static openChat(phone: string, message?: string): void {
    const link = WhatsAppService.getClickToChatLink(phone, message);
    window.open(link, '_blank');
  }

  /**
   * Nachricht senden (über KUNDENEIGENE WhatsApp Business Nummer via Meta API)
   */
  static async sendMessage(
    companyId: string,
    toPhone: string,
    message: string,
    customerId?: string,
    customerName?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    // Validierung
    if (!toPhone || toPhone.trim() === '') {
      throw new Error('Telefonnummer ist erforderlich');
    }

    if (!message || message.trim() === '') {
      throw new Error('Nachricht ist erforderlich');
    }

    if (!companyId || companyId.trim() === '') {
      throw new Error('Company ID ist erforderlich');
    }

    // Sende über Meta API mit KUNDENEIGENER Nummer
    const response = await fetch('/api/v1/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        to: toPhone,
        message,
        customerId,
        customerName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Fehler beim Senden');
    }

    const result = await response.json();

    // Nachricht wird bereits in der API gespeichert - KEINE doppelte Speicherung!

    return {
      success: true,
      messageId: result.messageId,
    };
  }

  /**
   * Lädt Chat-Historie für einen Kunden
   */
  static async getCustomerMessages(
    companyId: string,
    customerId: string,
  ): Promise<WhatsAppMessage[]> {
    try {
      return await api.get<WhatsAppMessage[]>(
        `/api/v1/whatsapp-messages/${companyId}/customer/${customerId}`,
      );
    } catch {
      return [];
    }
  }

  /**
   * Real-time Listener für Chat-Nachrichten
   */
  static subscribeToMessages(
    companyId: string,
    customerId: string,
    callback: (messages: WhatsAppMessage[]) => void,
  ): () => void {
    try {
      console.warn('subscribeToMessages: Real-time not yet implemented, using polling');

      const pollInterval = setInterval(async () => {
        try {
          const messages = await WhatsAppService.getCustomerMessages(companyId, customerId);
          callback(messages);
        } catch (error) {
          console.error('Error polling messages:', error);
        }
      }, 5000); // Poll every 5 seconds for chat

      return () => clearInterval(pollInterval);
    } catch {
      return () => {}; // Noop unsubscribe
    }
  }

  /**
   * Lädt alle Nachrichten einer Company
   */
  static async getCompanyMessages(companyId: string): Promise<WhatsAppMessage[]> {
    try {
      return await api.get<WhatsAppMessage[]>(`/api/v1/whatsapp-messages/${companyId}`);
    } catch {
      return [];
    }
  }

  /**
   * Lädt alle Chats gruppiert nach Telefonnummer
   * Gibt eine Liste von Chat-Objekten zurück mit letzter Nachricht
   */
  static async getChats(companyId: string): Promise<
    {
      phone: string;
      customerId?: string;
      customerName?: string;
      lastMessage: WhatsAppMessage;
      unreadCount: number;
    }[]
  > {
    try {
      const messages = await WhatsAppService.getCompanyMessages(companyId);

      // Gruppiere nach Telefonnummer (customerPhone - konsistent für inbound und outbound)
      const chatMap = new Map<
        string,
        {
          phone: string;
          customerId?: string;
          customerName?: string;
          messages: WhatsAppMessage[];
        }
      >();

      for (const msg of messages) {
        // Nutze customerPhone als primären Schlüssel (wird jetzt konsistent gespeichert)
        const rawPhone = msg.customerPhone || (msg as unknown as { to?: string }).to || '';
        if (!rawPhone) continue;

        // Normalisiere Telefonnummer (entferne alles außer Ziffern, behalte + am Anfang)
        const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone.replace(/\D/g, '')}`;

        if (!chatMap.has(phone)) {
          chatMap.set(phone, {
            phone,
            customerId: msg.customerId,
            customerName: msg.customerName,
            messages: [],
          });
        }

        const chat = chatMap.get(phone);
        if (chat) {
          chat.messages.push(msg);
          // Update customerName falls vorhanden
          if (msg.customerName && !chat.customerName) {
            chat.customerName = msg.customerName;
          }
          if (msg.customerId && !chat.customerId) {
            chat.customerId = msg.customerId;
          }
        }
      }

      // Konvertiere zu Array und sortiere nach letzter Nachricht
      return Array.from(chatMap.values())
        .filter(chat => chat.messages.length > 0)
        .map(chat => ({
          phone: chat.phone,
          customerId: chat.customerId,
          customerName: chat.customerName,
          lastMessage: chat.messages[0], // Neueste Nachricht (bereits nach createdAt desc sortiert)
          unreadCount: chat.messages.filter(m => m.direction === 'inbound' && m.status !== 'read')
            .length,
        }))
        .sort((a, b) => {
          const dateA =
            a.lastMessage.createdAt instanceof Date
              ? a.lastMessage.createdAt
              : typeof a.lastMessage.createdAt === 'string'
                ? new Date(a.lastMessage.createdAt)
                : new Date((a.lastMessage.createdAt as { seconds: number }).seconds * 1000);
          const dateB =
            b.lastMessage.createdAt instanceof Date
              ? b.lastMessage.createdAt
              : typeof b.lastMessage.createdAt === 'string'
                ? new Date(b.lastMessage.createdAt)
                : new Date((b.lastMessage.createdAt as { seconds: number }).seconds * 1000);
          return dateB.getTime() - dateA.getTime();
        });
    } catch {
      return [];
    }
  }

  /**
   * Lädt Nachrichten für eine bestimmte Telefonnummer
   */
  static async getMessagesByPhone(companyId: string, phone: string): Promise<WhatsAppMessage[]> {
    try {
      // Normalisiere die gesuchte Telefonnummer
      const normalizedSearch = phone.replace(/\D/g, '');

      // Lade alle Nachrichten und filtere nach Telefonnummer
      const messages = await WhatsAppService.getCompanyMessages(companyId);

      return messages
        .filter(msg => {
          const msgPhone = (
            msg.customerPhone ||
            (msg as unknown as { to?: string }).to ||
            ''
          ).replace(/\D/g, '');
          // Vergleiche die letzten 10 Ziffern (für internationale Nummern)
          return (
            msgPhone === normalizedSearch ||
            msgPhone.endsWith(normalizedSearch.slice(-10)) ||
            normalizedSearch.endsWith(msgPhone.slice(-10))
          );
        })
        .sort((a, b) => {
          const dateA =
            a.createdAt instanceof Date
              ? a.createdAt
              : typeof a.createdAt === 'string'
                ? new Date(a.createdAt)
                : new Date((a.createdAt as { seconds: number }).seconds * 1000);
          const dateB =
            b.createdAt instanceof Date
              ? b.createdAt
              : typeof b.createdAt === 'string'
                ? new Date(b.createdAt)
                : new Date((b.createdAt as { seconds: number }).seconds * 1000);
          return dateA.getTime() - dateB.getTime(); // Älteste zuerst für Chat-Ansicht
        });
    } catch {
      return [];
    }
  }

  /**
   * Prüft ob WhatsApp für eine Company konfiguriert ist
   */
  static async isConfigured(companyId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/whatsapp/status?companyId=${companyId}`);
      const data = await response.json();
      return data.configured;
    } catch {
      return false;
    }
  }

  /**
   * Lädt die WhatsApp-Verbindung einer Company
   */
  static async getConnection(companyId: string): Promise<WhatsAppConnection | null> {
    try {
      return await api.get<WhatsAppConnection>(`/api/v1/whatsapp-connection/${companyId}`);
    } catch {
      return null;
    }
  }

  /**
   * Speichert QR-Code für eine Company
   */
  static async saveQRCode(
    companyId: string,
    qrCode: string,
    expiresInSeconds: number = 120,
  ): Promise<void> {
    await api.put(`/api/v1/whatsapp-connection/${companyId}/qr-code`, {
      qrCode,
      expiresInSeconds,
    });
  }

  /**
   * Speichert erfolgreiche Verbindung
   */
  static async saveConnection(companyId: string, phoneNumber: string): Promise<void> {
    await api.put(`/api/v1/whatsapp-connection/${companyId}`, {
      phoneNumber,
      isConnected: true,
    });
  }

  /**
   * Trennt die WhatsApp-Verbindung
   */
  static async disconnectConnection(companyId: string): Promise<void> {
    await api.delete(`/api/v1/whatsapp-connection/${companyId}`);
  }

  /**
   * Markiert alle Nachrichten eines Chats als gelesen
   */
  static async markMessagesAsRead(companyId: string, phone: string): Promise<void> {
    try {
      await api.patch(`/api/v1/whatsapp-messages/${companyId}/mark-read`, { phone });
    } catch (error) {
      console.warn('Fehler beim Markieren der WhatsApp-Nachrichten als gelesen:', error);
    }
  }
}

/**
 * Vordefinierte Nachrichten-Templates
 */
export const WhatsAppTemplates = {
  INVOICE_PAID: (
    customerName: string,
    invoiceNumber: string,
    amount: number,
    companyName: string,
  ) =>
    `Hallo ${customerName},\n\nvielen Dank! Ihre Zahlung für Rechnung ${invoiceNumber} über ${amount.toFixed(2)} € ist eingegangen.\n\nMit freundlichen Grüßen\n${companyName}`,

  INVOICE_REMINDER: (
    customerName: string,
    invoiceNumber: string,
    amount: number,
    daysOverdue: number,
    companyName: string,
  ) =>
    `Hallo ${customerName},\n\ndie Rechnung ${invoiceNumber} über ${amount.toFixed(2)} € ist seit ${daysOverdue} Tagen fällig.\n\nBitte überweisen Sie den Betrag zeitnah.\n\nMit freundlichen Grüßen\n${companyName}`,

  INVOICE_SENT: (
    customerName: string,
    invoiceNumber: string,
    amount: number,
    dueDate: string,
    companyName: string,
  ) =>
    `Hallo ${customerName},\n\nIhre Rechnung ${invoiceNumber} über ${amount.toFixed(2)} € wurde erstellt.\n\nZahlbar bis: ${dueDate}\n\nMit freundlichen Grüßen\n${companyName}`,

  APPOINTMENT_REMINDER: (
    customerName: string,
    date: string,
    time: string,
    location: string,
    companyName: string,
  ) =>
    `Hallo ${customerName},\n\nErinnerung: Ihr Termin am ${date} um ${time} Uhr.\n\nOrt: ${location}\n\nBis bald!\n${companyName}`,
};

export default WhatsAppService;
