/**
 * Erzeugt einen WhatsApp "Click to Chat" Link für eine Telefonnummer.
 *
 * Anforderungen / Annahmen:
 * - Telefonnummer sollte im E.164-Format oder mit Länderkennung vorliegen (z.B. +491701234567 oder 491701234567).
 * - Die Funktion entfernt nicht-numerische Zeichen und validiert Länge (6-15 Ziffern).
 *
 * Inputs:
 * - phone: string - Telefonnummer (mit oder ohne +). Muss nach Entfernen von Nicht-Ziffern 6-15 Ziffern enthalten.
 * - text?: string - Optionaler Vorausfülltext für den Chat.
 *
 * Output:
 * - string - vollständiger wa.me Link, z.B. https://wa.me/491701234567?text=Hallo
 *
 * Fehlermodi:
 * - wirft Error, wenn die bereinigte Telefonnummer ungültig erscheint.
 */
export function createClickToChatLink(phone: string, text?: string): string {
  if (typeof phone !== 'string') {
    throw new Error('phone must be a string');
  }

  // Entferne alle Zeichen außer Ziffern
  const digits = phone.replace(/\D/g, '');

  // einfache Validierung: WhatsApp erwartet internationale Nummer ohne +, typische Länge 6-15
  if (!/^\d{6,15}$/.test(digits)) {
    throw new Error(
      'Ungültige Telefonnummer für WhatsApp Click-to-Chat. Bitte Telefonnummer mit Ländervorwahl übergeben.',
    );
  }

  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export default createClickToChatLink;
