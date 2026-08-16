// Kanal → Bildmarke + Kanalfarbe. Reine Daten, kein React — deshalb hier in
// `lib` und nicht in `components/inbox/inbox-darstellung.tsx`, wo das vorher
// stand: jene Datei trägt `"use client"`, und eine daraus importierte Funktion
// lässt sich aus einer Server-Komponente nicht aufrufen („Attempted to call
// kanalAbzeichen() from the server"). Die Startseite rendert serverseitig und
// braucht dieselbe Zuordnung — eine zweite Kopie wäre der Anfang des Driftens.
//
// Bewusst die GLYPHEN, nicht die Wortmarken-SVGs aus `channelLogoLoose`:
// „Booking.com" & Co. sind breite Schriftzüge, in einen 2-rem-Kreis gequetscht
// ergeben sie einen Fleck. Die simple-icons-Glyphen SIND die offiziellen
// Bildmarken — kein Ersatz-Icon (Regel „Portal-Logos nur echt").

const OTA_ICON: Record<string, string> = {
  "booking.com": "simple-icons:bookingdotcom",
  airbnb: "simple-icons:airbnb",
  expedia: "simple-icons:expedia",
  vrbo: "ph:house",
  whatsapp: "ph:whatsapp-logo",
};

export function otaIcon(name: string | null): string {
  if (!name) return "ph:chat-circle";
  return OTA_ICON[name.trim().toLowerCase()] ?? "ph:globe";
}

// Farben aus den --channel-*-Tokens, identisch zum Kalender.
const KANAL_ABZEICHEN: Record<string, { icon: string; fg: string }> = {
  bookingcom: { icon: "simple-icons:bookingdotcom", fg: "text-channel-booking" },
  airbnb: { icon: "simple-icons:airbnb", fg: "text-channel-airbnb" },
  expedia: { icon: "simple-icons:expedia", fg: "text-channel-expedia" },
  vrbo: { icon: "ph:house-fill", fg: "text-channel-vrbo" },
  whatsapp: { icon: "simple-icons:whatsapp", fg: "text-emerald-600" },
  mybestdays: { icon: "ph:globe-hemisphere-west-fill", fg: "text-channel-portal" },
};

export function kanalAbzeichen(name: string | null): { icon: string; fg: string } {
  const key = (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    KANAL_ABZEICHEN[key] ?? {
      icon: otaIcon(name),
      fg: "text-muted-foreground",
    }
  );
}
