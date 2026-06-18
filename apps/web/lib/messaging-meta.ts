// Nachrichten-Platzhalter eines Objekts (wie Lodgify „Messaging placeholders").
// Wiederverwendbare, mehrsprachige Texte (Check-in/out, Anfahrt, Türzugang,
// Hausordnung, WLAN, Reiseführer, Notfallkontakt), die in automatischen
// Gästenachrichten per Shortcode ({{CheckinInstructions}} …) eingesetzt werden.
// Gespeichert im flexiblen Feld type_attributes.messaging.
import { type LocalizedText, LANGS } from "@/lib/policy-meta";

// Leerer mehrsprachiger Text (alle Sprachen vorhanden, aber leer).
export function emptyLocalized(): LocalizedText {
  return LANGS.reduce(
    (acc, l) => ({ ...acc, [l]: "" }),
    {} as LocalizedText,
  );
}

// Keys der Platzhalter-Felder (Reihenfolge = Anzeige-Reihenfolge).
export type MessagingField =
  | "checkIn"
  | "checkOut"
  | "directions"
  | "doorInstructions"
  | "rules"
  | "wifi"
  | "localGuide"
  | "emergency";

export type Messaging = Record<MessagingField, LocalizedText>;

// Metadaten je Feld: Titel, Hilfetext, Shortcode (wie Lodgify) + Placeholder.
export type MessagingFieldMeta = {
  key: MessagingField;
  title: string;
  hint: string;
  shortcode: string;
  placeholder: string;
};

export const MESSAGING_FIELDS: MessagingFieldMeta[] = [
  {
    key: "checkIn",
    title: "Check-in-Anweisungen",
    hint: "Informiere deine Gäste über die Details zum Check-in und Besonderheiten bei der Ankunft.",
    shortcode: "{{CheckinInstructions}}",
    placeholder: "Check-in-Anweisungen eingeben …",
  },
  {
    key: "checkOut",
    title: "Check-out-Anweisungen",
    hint: "Informiere deine Gäste über die Details zum Check-out und an wen sie sich bei Bedarf wenden können.",
    shortcode: "{{CheckoutInstructions}}",
    placeholder: "Check-out-Anweisungen eingeben …",
  },
  {
    key: "directions",
    title: "Anfahrt",
    hint: "Erkläre deinen Gästen, wie sie zu deinem Objekt gelangen.",
    shortcode: "{{RentalDirections}}",
    placeholder: "Anfahrtsbeschreibung eingeben …",
  },
  {
    key: "doorInstructions",
    title: "Türzugang",
    hint: "Erkläre deinen Gästen, wie sie Zutritt erhalten (Türcode, Schlüssellage usw.).",
    shortcode: "{{DoorInstructions}}",
    placeholder: "Zugangs-Anweisungen eingeben …",
  },
  {
    key: "rules",
    title: "Hausordnung",
    hint: "Beschreibe und liste die Hausregeln für deine Gäste auf.",
    shortcode: "{{RentalRules}}",
    placeholder: "Hausordnung eingeben …",
  },
  {
    key: "wifi",
    title: "WLAN-Informationen",
    hint: "Beschreibe, wie sich deine Gäste mit dem WLAN verbinden. Tipp: auch erklären, wie man die Verbindung prüft.",
    shortcode: "{{WifiInformation}}",
    placeholder: "WLAN-Name & -Passwort eingeben …",
  },
  {
    key: "localGuide",
    title: "Reiseführer",
    hint: "Informiere deine Gäste über Orte und Aktivitäten in der Umgebung.",
    shortcode: "{{LocalGuide}}",
    placeholder: "Tipps für die Umgebung eingeben …",
  },
  {
    key: "emergency",
    title: "Notfallkontakt",
    hint: "Lass deine Gäste wissen, wen sie im Notfall kontaktieren können.",
    shortcode: "{{EmergencyContact}}",
    placeholder: "Notfallkontakt eingeben …",
  },
];

export const DEFAULT_MESSAGING: Messaging = MESSAGING_FIELDS.reduce(
  (acc, f) => ({ ...acc, [f.key]: emptyLocalized() }),
  {} as Messaging,
);

// Liest die Messaging-Daten robust aus type_attributes (unbekannte Form):
// fehlende Felder/Sprachen werden mit Leerwerten aufgefüllt.
export function readMessaging(attrs: Record<string, unknown>): Messaging {
  const raw = (attrs?.messaging ?? {}) as Record<string, unknown>;
  return MESSAGING_FIELDS.reduce((acc, f) => {
    const field = raw[f.key];
    const base = emptyLocalized();
    if (field && typeof field === "object") {
      for (const l of LANGS) {
        const v = (field as Record<string, unknown>)[l];
        if (typeof v === "string") base[l] = v;
      }
    }
    return { ...acc, [f.key]: base };
  }, {} as Messaging);
}
