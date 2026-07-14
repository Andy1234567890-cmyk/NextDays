// Objekt → Nachrichten-Platzhalter (Messaging placeholders):
// mehrsprachige, wiederverwendbare Texte (Check-in/out, Anfahrt, Türzugang,
// Hausordnung, WLAN, Reiseführer, Notfallkontakt) mit Shortcodes für
// automatische Gästenachrichten. Server Component lädt das Objekt, der
// Client-Teil rendert die bearbeitbaren Blöcke.
import { MessagingForm } from "@/components/objekte/messaging-form";
import { getProperty } from "@/lib/properties";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getProperty(id);
  if (!res.ok) {
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {res.error}
      </div>
    );
  }
  return <MessagingForm initial={res.data} />;
}
