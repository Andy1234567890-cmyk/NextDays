// Videofreigabe (0523): Ein Influencer bekommt den Link zu seinem Beitrag erst,
// wenn wir das Video gesehen und freigegeben haben. Diese Seite ist der
// Prüfeingang — was hier liegt, verdient noch kein Geld.
import Link from "next/link";

import { PartnerVideos } from "@/components/partner-videos";
import { getOffeneVideos } from "@/lib/partner";

import { RealtimeRefresh } from "@/components/realtime-refresh";

export const dynamic = "force-dynamic";

export default async function VideosSeite() {
  const beitraege = await getOffeneVideos();
  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      {/* Neuer Beitrag zur Prüfung, Video nachgereicht. */}
      <RealtimeRefresh table="affiliate_posts" />
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">Videofreigabe</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {beitraege.length === 0
              ? "Nichts in der Prüfung."
              : `${beitraege.length} ${beitraege.length === 1 ? "Video wartet" : "Videos warten"} auf Freigabe.`}{" "}
            Ohne Freigabe bekommt der Partner keinen Link.
          </p>
        </div>
        <Link
          href="/partner"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground"
        >
          Zurück zu Partner
        </Link>
      </div>
      <div className="mt-8">
        <PartnerVideos beitraege={beitraege} />
      </div>
    </div>
  );
}
