// Merkzettel-Seite. Server lädt die Listen; Verwaltung + Items-Anzeige sind eine
// Client-Insel.
import { redirect } from "next/navigation";

import { KontoShell } from "@/components/konto-shell";
import { MerkzettelClient } from "@/components/merkzettel-client";
import { isGuestLoggedIn } from "@/lib/guest-session";
import { serverWishlists } from "@/lib/guest-server";

export default async function MerkzettelPage() {
  if (!(await isGuestLoggedIn())) redirect("/anmelden?weiter=/merkzettel");
  const lists = await serverWishlists();
  return (
    <KontoShell titel="Merkzettel" breit>
      <MerkzettelClient initialLists={lists} />
    </KontoShell>
  );
}
