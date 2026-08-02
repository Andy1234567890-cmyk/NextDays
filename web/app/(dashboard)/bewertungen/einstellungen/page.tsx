// Bewertungs-Automatik (Einstellungen). Server Component lädt die
// Konfiguration; ohne MANAGE_REVIEWS ist das Formular read-only (§4.2).
import { notFound } from "next/navigation";

import { AutomatikForm } from "@/components/bewertungen/automatik-form";
import { Card } from "@nextdays/ui/card";
import { getMe } from "@/lib/auth";
import { getReviewAutomation } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function BewertungsAutomatikPage() {
  const [cfg, me] = await Promise.all([getReviewAutomation(), getMe()]);
  if (!cfg.ok) {
    if (cfg.status === 403) notFound();
    return (
      <Card className="p-5 text-sm text-destructive">{cfg.error}</Card>
    );
  }
  const canManage = me?.capabilities.includes("manage_reviews") ?? false;
  return <AutomatikForm initial={cfg.data} readOnly={!canManage} />;
}
