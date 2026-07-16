// Objekt → Gästemappe: die Info-Inhalte fürs Gästeportal
// (Check-in/out, Anfahrt, Türzugang, Hausordnung, WLAN, Reiseführer, Notfall).
//
// WICHTIG (siehe docs/ANALYSE-gaeste-info-gastmodul-gaestemappe.md): Diese
// Inhalte leben in properties.type_attributes.messaging — DERSELBEN Quelle wie
// der Objekt-Reiter „Nachrichten". Der Gästemappe-Reiter ist bewusst eine zweite
// Ansicht auf dieselben Daten (kein neues Datenmodell) und verwendet daher die
// bestehende MessagingForm 1:1 — eine Wahrheit, keine Doppelpflege.
import { getTranslations } from "next-intl/server";
import { MessagingForm } from "@/components/objekte/messaging-form";
import { getProperty } from "@/lib/properties";

export default async function GaestemappePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getProperty(id);
  if (!res.ok) {
    const t = await getTranslations("reservations");
    return (
      <div className="text-sm text-destructive">
        {t("gaestemappePage.loadError", { error: res.error })}
      </div>
    );
  }
  return <MessagingForm initial={res.data} />;
}
