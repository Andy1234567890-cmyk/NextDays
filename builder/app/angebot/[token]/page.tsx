// Die öffentliche Annahmeseite eines Buchungsangebots (Lastenheft §2.2, 0586).
//
// Der Gast kommt über den Token-Link aus der Angebotsmail hierher. Kein Login,
// kein Cookie — der Token ist der ganze Zugang, und er steht nur in dieser
// einen Mail (gespeichert ist serverseitig nur sein Hash).
//
// KEINE SiteShell: Diese Seite gehört zu KEINER Kundenwebsite. Das Angebot
// hängt am Betrieb, nicht an einer Domain — derselbe Link muss funktionieren,
// wenn der Betrieb gar keine Website gebaut hat. Kopf- und Fußzeile eines
// fremden Auftritts wären hier eine Behauptung über die Herkunft.
//
// `noindex`: ein Angebot ist an eine Person gerichtet und hat in keinem Index
// etwas zu suchen.
import type { Metadata } from "next";

import { AngebotAnsicht } from "@/components/angebot-ansicht";
import { ladeAngebot } from "@/lib/angebot";
import { istSprache } from "@/lib/sprache";
import { texte } from "@/lib/texte";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AngebotSeite({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  // `?lang=` überschreibt die Sprache des Angebots — der Gast kann die Seite
  // in seiner Sprache lesen, auch wenn der Betrieb eine andere hinterlegt hat.
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const angebot = await ladeAngebot(token);
  // Sprache: Wunsch des Gastes (?lang=) → Sprache des Angebots (die der
  // Betrieb beim Anlegen gesetzt hat) → Englisch (`texte()` fällt selbst
  // darauf zurück). NICHT `spracheWaehlen`: das entscheidet über die
  // Sprachliste EINER Website, und diese Seite gehört zu keiner — das Angebot
  // hängt am Betrieb, nicht an einer Domain.
  const sprache = istSprache(lang)
    ? lang
    : (angebot?.language ?? "");
  const t = texte(sprache);

  if (!angebot) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold">
          {t.angebotTitel}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t.angebotNichtGefunden}
        </p>
      </main>
    );
  }

  return <AngebotAnsicht angebot={angebot} token={token} t={t} />;
}
