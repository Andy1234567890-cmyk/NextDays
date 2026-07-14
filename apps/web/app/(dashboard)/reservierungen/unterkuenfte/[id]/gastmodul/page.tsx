// Objekt → Gastmodul: Portal-Schalter (Self-Check-in,
// Türcode + Regeln, Kontakt, Kopfbild) aus property_guest_portal PLUS die
// WLAN-/Türzugang-TEXTE aus messaging (eine Wahrheit). Server Component lädt das
// Objekt (für die messaging-Texte); der Client-Teil holt die Schalter und
// speichert beide Quellen zusammen.
import { GuestModuleForm } from "@/components/reservierungen/guest-module-form";
import { getProperty } from "@/lib/properties";

export default async function GastmodulPage({
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
  return <GuestModuleForm property={res.data} />;
}
