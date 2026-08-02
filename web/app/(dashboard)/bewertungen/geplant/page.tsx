// Geplante Bewertungen über Gäste (Warteschlange). Server Component lädt die
// offenen Entwürfe; ohne MANAGE_REVIEWS ist die Liste read-only (§4.2).
//
// Bewusst KEIN Realtime: guest_review_queue ist für anon/authenticated gesperrt
// (Wurzel 6), ein Abo darauf wäre eine stumme Attrappe. Die Schlange ändert
// sich stündlich, nicht sekündlich.
import { notFound } from "next/navigation";

import { Warteschlange } from "@/components/bewertungen/warteschlange";
import { Card } from "@nextdays/ui/card";
import { getMe } from "@/lib/auth";
import { listQueue } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function GeplanteBewertungenPage() {
  const [liste, me] = await Promise.all([
    listQueue({ status: "geplant", limit: 25 }),
    getMe(),
  ]);
  if (!liste.ok) {
    if (liste.status === 403) notFound();
    return <Card className="p-5 text-sm text-destructive">{liste.error}</Card>;
  }
  return (
    <Warteschlange
      initial={liste.data.items}
      initialTotal={liste.data.total}
      canManage={me?.capabilities.includes("manage_reviews") ?? false}
    />
  );
}
