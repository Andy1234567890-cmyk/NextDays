// Vorschau einer BUCHUNGSSTRECKEN-Vorlage (0474) — dieselbe Bühne wie die
// Entwurfs- und die Vorlagen-Vorschau, nur mit Bausteinen, die es in der
// Datenbank noch nicht gibt.
//
// Warum eine eigene Route und nicht `/render/vorlage/[templateId]`: eine
// Strecke ist keine Website-Vorlage. Sie bringt keine Seiten und kein Branding
// mit, sondern die Bausteine für drei BESTEHENDE Seiten — und sie hat drei
// Abschnitte statt einer Seitenliste. Beides in einer Route hieße, dass zwei
// verschiedene Fixture-Formen über denselben Parameter kommen.
//
// Sie durch DENSELBEN Renderer zu schicken ist der ganze Punkt: was der Betrieb
// im Auswahl-Fenster sieht, ist Zeile für Zeile dieselbe Ausgabe wie später
// seine Seite. Eine nachgebaute Vorschau im Dashboard wäre der Doppel-Renderer,
// den der Baukasten bewusst nicht hat.
//
// DAS BEISPIELOBJEKT
// Die Objektseiten-Bausteine brauchen ein Objekt — ohne eines haben sie nichts
// zu zeigen. Es kommt als `?objekt=` aus dem Auswahl-Fenster und ist ein ECHTES
// Objekt des Betriebs, kein erfundenes (Wurzel 4). Fehlt es, rendern die
// Bausteine ihren Leer-Zustand mit dem Grund.
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteShell } from "@/components/site-shell";
import { editierModusAus } from "@/lib/editier-kontext";
import { ladeInserat } from "@/lib/inserate";
import { ladeStreckenEntwurf } from "@/lib/site";
import { navOf } from "@/lib/site-context";
import { brandStyle, siteFontsHref } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function StreckenRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ strecke: string }>;
  searchParams: Promise<{
    token?: string;
    seite?: string;
    objekt?: string;
    locale?: string;
  }>;
}) {
  const { strecke } = await params;
  const sp = await searchParams;
  const { token } = sp;
  if (!token) notFound();

  const site = await ladeStreckenEntwurf(strecke, sp.seite ?? "objekt", token);
  if (!site) notFound();

  // Das Beispielobjekt wird auf den Tenant der ANTWORT gescopt und nicht auf
  // eine ID aus der Adresse allein (Wurzel 3): der Tenant steckt im Token, das
  // der Server signiert hat, die Objekt-ID nicht.
  const objekt = sp.objekt
    ? await ladeInserat(
        sp.objekt,
        // Dieselbe Sprache wie die Vorschau (0474), damit die
        // Ausstattungs-Bezeichnungen zur gezeigten Fassung passen.
        { locale: sp.locale ?? "en" },
        site.tenant_id,
      )
    : null;

  const branding = site.branding;
  const fontsHref = siteFontsHref(branding);
  // Die Vorlage ist NICHT bearbeitbar: sie gehört noch niemandem. Erst nach dem
  // Übernehmen entstehen echte Bausteine, und die haben ihren eigenen Editor.
  //
  // `aktiv: false` heißt zugleich, dass die Bausteine ihre Leer-Zustände NICHT
  // als Editor-Hinweis zeigen — hier soll der Betrieb sehen, was der Gast sieht.
  const modus = editierModusAus({ locale: sp.locale });

  return (
    <div
      style={brandStyle(branding)}
      data-button-style={branding?.button_style ?? undefined}
      className="min-h-screen bg-background text-foreground"
    >
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <SiteShell
        branding={branding}
        nav={navOf(branding)}
        jahr={new Date().getFullYear()}
        sprache={modus.locale}
        vorschau
      >
        <BlockRenderer
          blocks={site.blocks}
          tenantId={site.tenant_id}
          modus={modus}
          objekt={objekt}
        />
      </SiteShell>
    </div>
  );
}
