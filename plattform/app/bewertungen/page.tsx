// Bewertungen-Seite. Server lädt eigene Bewertungen + vergangene Buchungen und
// leitet daraus die noch offenen (unbewerteten) Aufenthalte ab. Formular +
// Bearbeiten sind eine Client-Insel. ?reservation=<id> öffnet das Formular.
import { redirect } from "next/navigation";

import {
  type BewertbareBuchung,
  BewertungenClient,
} from "@/components/bewertungen-client";
import { KontoShell } from "@/components/konto-shell";
import { isGuestLoggedIn } from "@/lib/guest-session";
import { serverBookings, serverMyReviews } from "@/lib/guest-server";

export default async function BewertungenPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation?: string }>;
}) {
  if (!(await isGuestLoggedIn())) redirect("/anmelden?weiter=/bewertungen");
  const { reservation } = await searchParams;

  const [reviews, past] = await Promise.all([
    serverMyReviews(),
    serverBookings("past"),
  ]);

  const bewertet = new Set(reviews.map((r) => r.reservation_id));

  // Objekt-Titel je property_id (für die Anzeige eigener Bewertungen).
  const reviewTitles: Record<string, string> = {};
  for (const b of past) reviewTitles[b.property.id] = b.property.title;

  // Vergangene Buchungen ohne Bewertung → CTA.
  const bewertbar: BewertbareBuchung[] = past
    .filter((b) => !bewertet.has(b.id))
    .map((b) => ({
      reservation_id: b.id,
      property_id: b.property.id,
      title: b.property.title,
      photo: b.property.photo,
      check_in: b.check_in,
      check_out: b.check_out,
    }));

  return (
    <KontoShell titel="Bewertungen">
      <BewertungenClient
        initialReviews={reviews}
        bewertbar={bewertbar}
        reviewTitles={reviewTitles}
        autoReservation={reservation ?? null}
      />
    </KontoShell>
  );
}
