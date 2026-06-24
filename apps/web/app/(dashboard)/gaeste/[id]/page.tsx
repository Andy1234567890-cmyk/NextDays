// Gästekarte — Detail. Lädt den (maskierten) Gast + das Konto fürs Gating.
// Sub-Ressourcen werden client-seitig je Tab nachgeladen.
import { notFound } from "next/navigation";

import { GuestDetail } from "@/components/gaeste/guest-detail";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getAccount } from "@/lib/account";
import { guestAccessFor } from "@/lib/guests-access";
import { getGuest } from "@/lib/guests";

export const dynamic = "force-dynamic";

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [res, acc] = await Promise.all([getGuest(id), getAccount()]);
  if (!res.ok) notFound();
  const access = acc.ok
    ? guestAccessFor(acc.data.role, acc.data.permissions)
    : guestAccessFor(null, []);
  return (
    <>
      <RealtimeRefresh tables={["guests"]} filter={`id=eq.${id}`} />
      <GuestDetail guest={res.data} access={access} />
    </>
  );
}
