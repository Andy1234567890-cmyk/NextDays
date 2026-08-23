// Einbettbares Widget für FREMDE Seiten (0426).
//
// Der Betrieb hat oft schon eine Website — beim Webdesigner, in WordPress — und
// will von dort in seine Buchungsstrecke verweisen, ohne umzuziehen. Diese Route
// liefert dafür genau zwei Bausteine: ein Suchfeld und ein Buchen-Feld.
//
// UNVERHANDELBAR für diese Route: sie führt KEINE Aktion mit Nebenwirkung aus.
// Sie navigiert, und zwar aus dem Rahmen heraus (`target="_top"`/`_blank`) auf
// die Website des Betriebs. Das ist die Bedingung, unter der sie von überall
// einbettbar sein darf: ein Klick, den ein fremder Seitenbetreiber
// herbeigetrickst hat, löst nichts aus außer einem Seitenwechsel — es gibt hier
// nichts zu bestätigen, nichts zu bezahlen und keine Sitzung.
//
// Deshalb auch KEIN Zahlungsschritt und KEIN Anmeldefeld in diesem Rahmen.
// Beides gehört auf die eigene Domain, wo `frame-ancestors 'none'` gilt.
import { notFound } from "next/navigation";

import { aktuellerHost } from "@/lib/host";
import { getSiteContext } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";
import { texte } from "@/lib/texte";
import { brandStyle, siteFontsHref } from "@/lib/theme";

import { WidgetFormular } from "./formular";

export const dynamic = "force-dynamic";

const TYPEN = ["suche", "buchen"] as const;
type Typ = (typeof TYPEN)[number];

/** Eckenform aus der Adresse. Sie kommt aus dem im Dashboard erzeugten
 *  Schnipsel; ein unbekannter Wert fällt auf die Form der Website zurück, statt
 *  die Seite zu verweigern — ein von Hand verkürzter Schnipsel soll noch
 *  funktionieren. */
function randKlasse(roh: string | undefined, standard: string | null): string {
  const wert = roh ?? standard ?? "pill";
  if (wert === "sharp") return "rounded-none";
  if (wert === "rounded") return "rounded-xl";
  return "rounded-full";
}

export default async function WidgetSeite({
  params,
  searchParams,
}: {
  params: Promise<{ typ: string }>;
  searchParams: Promise<{ lang?: string; ziel?: string; rand?: string }>;
}) {
  const { typ: rohTyp } = await params;
  const sp = await searchParams;
  const typ = TYPEN.find((x) => x === rohTyp) as Typ | undefined;
  if (!typ) notFound();

  const { branding, unknown } = await getSiteContext();
  const host = await aktuellerHost();
  // Ohne aufgelösten Betrieb gibt es kein Ziel für die Navigation. Ein Widget,
  // das ins Leere führt, wäre schlimmer als keins — deshalb 404 statt einer
  // leeren Fläche im fremden Seitenlayout.
  if (unknown || !host) notFound();

  const sprache = spracheWaehlen(branding, sp.lang);
  const txt = texte(sprache);
  const fontsHref = siteFontsHref(branding);

  return (
    <div
      style={brandStyle(branding)}
      data-button-style={branding?.button_style ?? undefined}
      // Transparent, nicht `bg-background`: das Widget sitzt in einer fremden
      // Seite, deren Hintergrund wir nicht kennen. Ein eigener Grund würde dort
      // als Kasten stehen, auch wo keiner hingehört.
      className="text-foreground"
    >
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <WidgetFormular
        typ={typ}
        zielHost={host}
        neuesFenster={sp.ziel === "neu"}
        randKlasse={randKlasse(sp.rand, branding?.button_radius ?? null)}
        texte={{
          von: txt.sucheVon,
          bis: txt.sucheBis,
          gaeste: txt.sucheGaeste,
          suchen: txt.sucheSuchen,
          buchen: txt.jetztBuchen,
          reiseziel: txt.sucheReiseziel,
        }}
      />
    </div>
  );
}
