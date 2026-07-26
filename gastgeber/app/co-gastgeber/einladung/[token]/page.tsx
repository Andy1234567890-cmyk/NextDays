// Einladung zum Co-Gastgeber (Empfänger-Sicht).
//
// Bewusst AUSSERHALB des Dashboards: Wer hier landet, ist womöglich noch gar
// nicht eingeloggt oder hat noch kein Konto. Die Seite zeigt zuerst, worum es
// geht — annehmen kann man erst danach, mit Login und geprüfter Identität.
import { notFound } from "next/navigation";

import { EinladungAnsicht } from "@/components/cohost/einladung-ansicht";
import { ApiError } from "@/lib/api-server";
import { getEinladung } from "@/lib/cohost-einladung";

export const metadata = {
  title: "Einladung als Co-Gastgeber",
  // Einladungslinks gehören nicht in Suchmaschinen.
  robots: { index: false, follow: false },
};

export default async function EinladungSeite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let einladung;
  try {
    einladung = await getEinladung(token);
  } catch (exc) {
    if (exc instanceof ApiError) {
      // 404 (ungültig), 409 (schon angenommen), 410 (abgelaufen/zurückgezogen)
      // führen alle auf dieselbe ehrliche Aussage — der genaue Grund würde
      // Rückschlüsse auf fremde Einladungen erlauben.
      if ([404, 409, 410].includes(exc.status)) {
        return (
          <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
            <h1 className="font-sans text-[2rem] font-bold tracking-tight">
              Diese Einladung ist nicht mehr gültig
            </h1>
            <p className="mt-3 text-[0.9375rem] text-muted-foreground">
              Sie wurde bereits verwendet, zurückgezogen oder ist abgelaufen.
              Bitte den Gastgeber um eine neue Einladung.
            </p>
          </main>
        );
      }
    }
    throw exc;
  }

  if (!einladung) notFound();

  return <EinladungAnsicht token={token} einladung={einladung} />;
}
