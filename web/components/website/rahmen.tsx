"use client";

// Der Rahmen des Baukastens: Reiterleiste, Kopfaktionen, Arbeitsfläche.
//
// Warum das keine `layout.tsx` ist: die Schale hat ZWEI Slots (Einstellungen
// links, Vorschau rechts), ein Next-Layout hat nur `children`. Also nimmt jede
// Route diesen Rahmen selbst und füllt beide Slots — die Reiterleiste und die
// Kopfaktionen stehen dabei nur hier, nicht in fünf Routen kopiert.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Logo } from "@/components/logo";
import { LOCALES, type Locale } from "@/i18n/locales";
import type { Branding, CustomDomain } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";

import {
  SpeicherHaken,
  SprachWahl,
  VerlaufKnoepfe,
  VeroeffentlichenKnopf,
  WebsiteAnsehen,
} from "./kopfleiste";
import {
  BAUKASTEN_BASIS,
  LEISTE_GRUPPEN,
  menueBeschriftung,
  menueAusPfad,
  REITER_HREF,
  REITER_SYMBOL,
  reiterAusPfad,
} from "./reiter";
import { type BaukastenTabelle, useBaukastenRealtime } from "./baukasten-realtime";
import { FremdeAenderung } from "./fremde-aenderung";
import { BaukastenSchale, type SpeicherStand } from "./schale";
import { type Geraet, GeraeteUmschalter } from "./vorschau";

/** „Website ansehen" mit ZWEI Zielen: dem Entwurf und der Live-Fassung.
 *
 *  Vorher gab es nur einen Link auf die Live-Domain. Damit konnte der Kunde
 *  seinen Entwurf nirgends im ganzen Fenster ansehen — nur im schmalen
 *  iframe der Vorschau. Lodgify unterscheidet dieselben zwei Fassungen
 *  („Vorschau-Version" auf einer eigenen Subdomain, „Live-Version"; live
 *  abgelesen am 23.08.2026).
 *
 *  Der Entwurfs-Link hängt an einem kurzlebigen HMAC-Token (1 h) und wird erst
 *  beim Öffnen des Menüs geholt: ein Token bei jedem Seitenaufruf wäre ein
 *  Request für einen Link, den kaum jemand anklickt. */

export function BaukastenRahmen({
  pages,
  domains,
  seitenleiste,
  panelTitel,
  panelZurueckHref,
  kopfLinks,
  geraet,
  onGeraet,
  inhalt,
  inspektor,
  grossPanel,
  grossPanelTitel,
  onGrossPanelZu,
  breit = false,
  onVeroeffentlicht,
  hinweis,
  tabellen,
  verlauf,
  stand = "ruht",
  aktiveSprache,
  onSprache,
  branding,
}: {
  pages: Page[];
  domains: CustomDomain[];
  seitenleiste?: ReactNode;
  /** Überschrift im Panel-Kopf. Ohne sie hat das Panel keinen Kopf und lässt
   *  sich nicht zuklappen. */
  panelTitel?: string;
  /** Gesetzt = eine Hostaway-Unterseite ist offen; der Kopf bekommt einen
   *  Zurück-Pfeil vor `panelTitel` (0468). */
  panelZurueckHref?: string;
  /** Zusätzliche Bedienelemente links in der Kopfzeile (z. B. die Seitenwahl). */
  kopfLinks?: ReactNode;
  /** Geräte-Umschalter. Nur Reiter mit Vorschau geben ihn mit — auf
   *  „Einstellungen" gäbe es nichts umzuschalten. */
  geraet?: Geraet;
  onGeraet?: (g: Geraet) => void;
  inhalt: ReactNode;
  /** Der Inspektor rechts. */
  inspektor?: ReactNode;
  /** Das von links einfahrende Großpanel (Blog-CMS). */
  grossPanel?: ReactNode;
  grossPanelTitel?: string;
  onGrossPanelZu?: () => void;
  breit?: boolean;
  /** Wird nach erfolgreichem Veröffentlichen gerufen — die Route entscheidet
   *  selbst, ob sie ihre Vorschau neu laden muss. */
  onVeroeffentlicht?: () => void;
  /** Platz links neben „Veröffentlichen" — dort steht der Hinweis, wenn jemand
   *  anderes dieselbe Website geändert hat (`FremdeAenderung`). Als Slot und
   *  nicht fest eingebaut: nicht jeder Reiter hört dieselben Tabellen ab, und
   *  der Rahmen soll nicht wissen müssen, welche. */
  hinweis?: ReactNode;
  /** Welche Tabellen diese Route abonniert. Der Rahmen macht das Abo selbst und
   *  zeigt den Hinweis „jemand anderes hat geändert" — Routen ohne eigenen
   *  Bearbeitungszustand (SEO, Einstellungen, Objekte, Regeln, Widgets) brauchen
   *  dafür keine eigene Hülle mehr.
   *
   *  Bis 27.08.2026 gab es zwei solche Hüllen (`seo/rahmen.tsx`,
   *  `einstellungen/rahmen.tsx`): je eine Datei mit je einem Aufrufer, die
   *  nichts taten außer `useBaukastenRealtime` zu rufen, `breit` zu setzen und
   *  denselben Container zu zeichnen. Beide hießen `rahmen.tsx` wie diese Datei
   *  — drei gleichnamige Dateien für eine Aufgabe.
   *
   *  Ein Reiter mit eigenem Zustand (Editor, Design) ruft den Hook weiterhin
   *  SELBST: er muss `offen` melden, damit ein Neuladen keine halb getippte
   *  Eingabe überschreibt, und gibt seinen Hinweis über `hinweis` herein. */
  tabellen?: readonly BaukastenTabelle[];
  /** Rückgängig/Wiederholen. Nur Bereiche mit einem Verlauf geben ihn mit —
   *  im Design-Reiter gibt es keinen Abschnitts-Verlauf, und zwei ausgegraute
   *  Pfeile wären ein Versprechen ohne Deckung. */
  verlauf?: {
    kannZurueck: boolean;
    kannVor: boolean;
    onZurueck: () => void;
    onVor: () => void;
  };
  /** Speicherstand für das Häkchen in der Kopfzeile. */
  stand?: SpeicherStand;
  /** Welche Sprachfassung bearbeitet wird, und der Weg, sie zu wechseln. */
  aktiveSprache?: Locale;
  onSprache?: (l: Locale) => void;
  /** Für die Sprachwahl: welche Sprachen die Website führt. */
  branding?: Branding | null;
}) {
  const t = useTranslations("website");
  const pfad = usePathname();

  // Das Abo. `tabellen` leer = alle fünf `enabled: false`, also kein Kanal —
  // ein Hook darf nicht bedingt gerufen werden, eine leere Liste schon.
  //
  // `offen` ist hier immer false: diese Routen haben keinen Entwurfsstand, den
  // ein Neuladen zerstören könnte (jedes Feld speichert für sich). Wer einen
  // hat, ruft den Hook selbst und gibt `hinweis` herein.
  const { fremdeAenderung, uebernehmen } = useBaukastenRealtime({
    tabellen: tabellen ?? [],
  });

  const aktiv = reiterAusPfad(pfad);
  // Welcher Unterpunkt in der Menüspalte hervorgehoben wird. Ohne ihn zeigte
  // die Spalte zwar die richtigen Einträge, hob aber keinen hervor — man sah
  // die Liste und nicht, wo man darin steht.
  const menueAktiv = menueAusPfad(pfad);

  const liveDomain = domains.find((d) => d.status === "active")?.domain ?? null;

  return (
    <BaukastenSchale
      texte={{
        panelEinklappen: t("kopf.panelEinklappen"),
        panelAusklappen: t("kopf.panelAusklappen"),
        panelBreite: t("kopf.panelBreite"),
        panelHilfe: t("kopf.panelHilfe"),
        panelZurueck: t("kopf.panelZurueck"),
      }}
      // Die Wörter der Menüspalte kommen aus EINER Stelle (`reiter.ts`) —
      // dieselbe, die der Editor benutzt. Zwei Kopien dieser Kette hatten
      // dazu geführt, dass die Behebung nur außerhalb des Editors wirkte.
      menueBeschriften={(id) => menueBeschriftung(t, id)}
      reiter={LEISTE_GRUPPEN.flat().map((id) => ({
        id,
        label: t(`reiter.${id}`),
        href: REITER_HREF[id],
        icon: REITER_SYMBOL[id],
      }))}
      aktiverReiter={aktiv ?? ""}
      menueAktiv={menueAktiv}
      panelTitel={panelTitel}
      panelZurueckHref={panelZurueckHref}
      kopfLinks={
        <>
          {/* Das Logo als Anker links — auf JEDER Route des Baukastens.
              Es stand nur im Editor und (seit D5) im Vorlagen-Reiter; auf
              `/website/design*`, `/website/objekte`, `/website/regeln`,
              `/website/anfragen`, `/website/widgets`,
              `/website/einstellungen/*` und `/website/seo*` war die linke
              Hälfte der Kopfzeile leer — drei verschiedene Kopfzeilen für
              denselben Bereich (Nachprüfung, neuer Befund 6).

              Es führt in die SEITENLISTE und nicht auf `/website`: der
              Baukasten hat keine Startseite über den Reitern, und die Liste
              ist der Ort, an dem man anfängt. Dieselbe Wahl wie im Editor,
              dort als Knopf auf das Seiten-Panel.

              Eine Seitenwahl steht hier bewusst NICHT daneben: diese Routen
              bearbeiten keine einzelne Seite (Farben gelten für alle, Regeln
              für die Site). Ein Auswahlfeld ohne Wirkung wäre eine Attrappe
              (Wurzel 4). */}
          <Link
            href={`${BAUKASTEN_BASIS}/seiten`}
            aria-label={t("kopf.zurUebersicht")}
            title={t("kopf.zurUebersicht")}
            className="shrink-0 rounded-(--radius) transition hover:opacity-80"
          >
            <Logo heightRem={1.5} />
          </Link>
          <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
          {kopfLinks}
          {/* Die Sprachwahl steht LINKS neben der Seitenwahl — genau wie im
              Foto (`Home ⌄` │ `🏳 ⌄`). Beide beantworten dieselbe Frage: „woran
              arbeite ich gerade" — die eine für die Seite, die andere für die
              Sprachfassung. */}
          {aktiveSprache && onSprache ? (
            <SprachWahl
              // Hier stehen alle 24 zur Wahl, wie im Editor — bearbeitet wird
              // eine FASSUNG, nicht die Auslieferung. Welche die Website
              // ausliefert, sagt `gefuehrt`.
              sprachen={LOCALES as readonly Locale[] as Locale[]}
              gefuehrt={(branding?.languages ?? []) as Locale[]}
              aktiv={aktiveSprache}
              standard={(branding?.default_language ?? null) as Locale | null}
              onWahl={onSprache}
              verwaltenHref={`${BAUKASTEN_BASIS}/einstellungen/sprachen`}
            />
          ) : null}
        </>
      }
      kopfMitte={
        geraet && onGeraet ? (
          <GeraeteUmschalter geraet={geraet} onGeraet={onGeraet} />
        ) : null
      }
      kopfAktionen={
        // Die Reihenfolge ist die des Fotos: ↺ ↻ ✓ ⤴ Vorschau [Publish].
        // Erst was man am Getippten tut, dann ob es gesichert ist, dann was
        // damit nach draußen geht.
        <>
          {/* Der eigene Hinweis, wenn die Route keinen mitgibt. Vorher meldeten
              die Hüllen-Routen ein Abo an und verwarfen dessen Ergebnis: es gab
              gar keine Stelle, an der „jemand anderes hat geändert" erscheinen
              konnte. */}
          {hinweis ?? (
            <FremdeAenderung sichtbar={fremdeAenderung} onUebernehmen={uebernehmen} />
          )}
          {verlauf ? (
            <VerlaufKnoepfe
              kannZurueck={verlauf.kannZurueck}
              kannVor={verlauf.kannVor}
              onZurueck={verlauf.onZurueck}
              onVor={verlauf.onVor}
            />
          ) : null}
          <SpeicherHaken stand={stand} />
          <WebsiteAnsehen pages={pages} liveDomain={liveDomain} />
          <VeroeffentlichenKnopf
            pages={pages}
            onVeroeffentlicht={onVeroeffentlicht}
          />
        </>
      }
      breit={breit}
      seitenleiste={seitenleiste}
      inhalt={inhalt}
      inspektor={inspektor}
      grossPanel={grossPanel}
      grossPanelTitel={grossPanelTitel}
      onGrossPanelZu={onGrossPanelZu}
    />
  );
}
