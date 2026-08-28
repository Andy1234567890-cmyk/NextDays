"use client";

// Der Design-Reiter: Einstellungen links, Live-Vorschau rechts, Autospeichern.
//
// Zuvor lag das mit den Reitern „Seiten" und „Adresse" in EINER Komponente, die
// über `?reiter=` umschaltete. Damit hatte jeder Unterpunkt dieselbe Adresse,
// und der Logo-Bereich gar keine. Jetzt ist jeder Reiter eine eigene Route und
// diese Datei nur noch für Design zuständig.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { type Branding, type CustomDomain, setBranding } from "@/lib/site-config";
import { type Page, createDraftToken } from "@/lib/site-pages";

import { useBaukastenRealtime } from "./baukasten-realtime";
import { FremdeAenderung } from "./fremde-aenderung";
import { DesignLeiste } from "./design/design-leiste";
import { type CanvasMeldung, useCanvasBruecke } from "./editor/use-canvas-bruecke";
import { BaukastenRahmen } from "./rahmen";
import { menueBeschriftung } from "./reiter";
import { SpeicherAnzeige } from "./schale";
import { useAutospeichern } from "./use-autospeichern";
import { useVorschauToken } from "./use-vorschau-token";
import { type Geraet, VorschauFlaeche } from "./vorschau";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Die Hostaway-Unterseiten des Design-Reiters (0468) — Text · Farben ·
 *  Buttons · Bilder · Breite & Abstand · Layout · Logo. Jede hat eine eigene
 *  Route (`/website/design/<id>`) und einen eigenen Panel-Kopf; die
 *  Grundansicht (`unterseite === null`) zeigt nur noch die Liste dorthin. */
export type DesignUnterseite =
  | "logo"
  | "text"
  | "farben"
  | "buttons"
  | "bilder"
  | "breite-abstand"
  | "site-layout";

/** Nur speichern, wenn alle gesetzten Farben vollständige Hex-Werte sind. Ein
 *  halb getipptes „#ab" wäre serverseitig ein 422. */
function farbenGueltig(b: Branding): boolean {
  return (
    [
      b.primary_color,
      b.secondary_color,
      b.background_color,
      b.foreground_color,
    ] as Array<string | null>
  ).every((c) => !c || HEX_RE.test(c));
}

export function DesignAnsicht({
  branding,
  pages,
  domains,
  unterseite = null,
}: {
  branding: Branding;
  pages: Page[];
  domains: CustomDomain[];
  /** Offene Unterseite der Design-Leiste — kommt aus der Route. */
  unterseite?: DesignUnterseite | null;
}) {
  const t = useTranslations("website");
  const [geraet, setGeraet] = useState<Geraet>("desktop");

  const [entwurf, setEntwurf] = useState<Branding>(branding);
  const [bestaetigt, setBestaetigt] = useState<Branding>(branding);

  // Das Realtime-Abo auf `tenant_site_config` löst einen Server-Refresh aus und
  // liefert ein neues `branding`-Prop. `useState` nimmt es aber nur als
  // ANFANGSWERT — ohne diesen Effekt kam eine Änderung aus einer zweiten
  // Sitzung nie an, und das Abo war eine Attrappe.
  //
  // Übernommen wird nur, was der Kunde hier NICHT gerade selbst bearbeitet:
  // sein offener Stand darf nicht unter der Hand ersetzt werden.
  const fremderStand = JSON.stringify(branding);
  useEffect(() => {
    setBestaetigt((alt) => {
      const neu = JSON.parse(fremderStand) as Branding;
      if (JSON.stringify(alt) === fremderStand) return alt;
      setEntwurf((offen) => ({ ...neu, ...istGeaendert(offen, alt) }));
      return neu;
    });
  }, [fremderStand]);

  const auto = useAutospeichern<Branding>({
    wert: entwurf,
    bestaetigt,
    gueltig: farbenGueltig,
    speichern: async (diff) => {
      const res = await setBranding(diff);
      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const, data: res.data };
    },
  });

  // Der vom Server bestätigte Stand ist die Wahrheit — er wird übernommen, nicht
  // der lokale. Sonst schickt der nächste Lauf denselben Diff erneut.
  useEffect(() => {
    if (auto.uebernommen) {
      setBestaetigt(auto.uebernommen);
      setEntwurf((e) => ({
        ...auto.uebernommen!,
        ...istGeaendert(e, auto.uebernommen!),
      }));
    }
  }, [auto.uebernommen]);

  useEffect(() => {
    if (auto.fehler) toast.error(auto.fehler);
  }, [auto.fehler]);

  // Die Vorschau zeigt die Startseite (oder die erste Seite): die Design-Wirkung
  // ist überall dieselbe, und die Startseite ist die, die der Gast zuerst sieht.
  const vorschauSeite = pages.find((p) => p.is_home) ?? pages[0] ?? null;
  const [neuLaden, setNeuLaden] = useState(0);

  // Nur die ID ist die Abhängigkeit, die zählt: `vorschauSeite` ist bei jedem
  // Render ein neues Objekt (aus `pages.find`), und darauf zu hören würde bei
  // jedem Render einen neuen Token holen.
  const router = useRouter();

  // Fremde Änderungen am Theme. Es wirkt auf JEDE Seite — ändert ein Kollege
  // eine Farbe, sieht man es hier und in der Vorschau, ohne neu zu laden.
  // Welche Tabellen der Baukasten abonnieren darf und warum die übrigen NICHT,
  // steht an einer Stelle: `baukasten-realtime.ts`.
  const { fremdeAenderung, uebernehmen } = useBaukastenRealtime({
    tabellen: ["tenant_site_config"],
    // Der Entwurfsstand gilt als offen, solange das Autospeichern noch nicht
    // bestätigt hat — sonst überschriebe ein Neuladen die halb getippte Farbe.
    offen: auto.stand === "speichert" || auto.stand === "fehler",
    onFremd: () => setNeuLaden((n) => n + 1),
  });

  const vorschauSeitenId = vorschauSeite?.id ?? null;

  // Die Vorschau ist auch HIER eine Arbeitsfläche, keine Tapete.
  //
  // Bei Hostaway gibt es EINEN Canvas; die Leiste links wechselt nur, was das
  // Panel zeigt. Man wechselt nicht zwischen „Seite mit Canvas" und „Seite
  // ohne". Wer im Design-Reiter eine Farbe wählt und dann im Bild eine
  // Überschrift anklickt, will sie bearbeiten — und landete vorher im Nichts,
  // weil diesseits niemand zuhörte.
  //
  // Der Sprung geht in den Abschnitts-Editor MIT vorgewähltem Abschnitt. Die
  // Alternative wäre, die komplette Block-Bearbeitung samt Autospeichern ein
  // zweites Mal in diesen Reiter zu holen — zwei Schreibwege auf dieselben
  // Zeilen, und der zweite ist der, den beim nächsten Fehler niemand sucht.
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const aufMeldung = useCallback(
    (m: CanvasMeldung) => {
      if (m.type !== "select" || typeof m.index !== "number") return;
      if (!vorschauSeitenId) return;
      router.push(`/website/seiten/${vorschauSeitenId}?abschnitt=${m.index}`);
    },
    [router, vorschauSeitenId],
  );
  // `scrolleZu` braucht der Design-Reiter nicht: er wählt keine Abschnitte
  // aus, er stellt das Theme ein.
  const { iframeBereit } = useCanvasBruecke(iframeRef, aufMeldung);
  const { token, tokenFehler } = useVorschauToken(
    vorschauSeitenId,
    createDraftToken,
  );

  // Nach einem bestätigten Speichervorgang die Vorschau neu laden — sie rendert
  // serverseitig, ein lokaler State-Wechsel erreicht sie nicht.
  useEffect(() => {
    if (auto.uebernommen) setNeuLaden((n) => n + 1);
  }, [auto.uebernommen]);

  // Der Panel-Kopf zeigt IMMER, wo man gerade steht: „DESIGN" auf der
  // Grundansicht, sonst den Titel der offenen Unterseite — mit Zurück-Pfeil
  // davor. Vorher stand dort immer „DESIGN", und die Unterseite trug ihren
  // eigenen Titel noch einmal als zweite Überschrift im Inhalt (0468).
  //
  // Das Wort kommt aus derselben Stelle wie die Menüspalte
  // (`menueBeschriftung`). Hier stand die Zuordnung Kennung → Schlüssel ein
  // zweites Mal ausgeschrieben, obwohl `MENUE_I18N_SCHLUESSEL` sie schon führt
  // — dieselben sieben Paare an zwei Orten (Wurzel 2).
  const panelTitel = unterseite
    ? menueBeschriftung(t, unterseite)
    : t("reiter.design");
  const panelZurueckHref = unterseite ? "/website/design" : undefined;

  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      panelTitel={panelTitel}
      panelZurueckHref={panelZurueckHref}
      geraet={geraet}
      onGeraet={setGeraet}
      onVeroeffentlicht={() => setNeuLaden((n) => n + 1)}
      hinweis={
        <FremdeAenderung
          sichtbar={fremdeAenderung}
          onUebernehmen={() => {
            uebernehmen();
            setNeuLaden((n) => n + 1);
          }}
        />
      }
      seitenleiste={
        <DesignLeiste
          stand={entwurf}
          setze={(patch) => setEntwurf((e) => ({ ...e, ...patch }))}
          unterseite={unterseite}
        />
      }
      inhalt={
        <VorschauFlaeche
          geraet={geraet}
          pageId={vorschauSeite?.id ?? null}
          token={token}
          tokenFehler={tokenFehler}
          neuLaden={neuLaden}
          iframeRef={iframeRef}
          onLoad={iframeBereit}
          rechts={
            <SpeicherAnzeige
              stand={auto.stand}
              texte={{
                speichert: t("kopf.speichert"),
                gespeichert: t("kopf.gespeichert"),
                fehler: t("kopf.speicherFehler"),
              }}
            />
          }
        />
      }
    />
  );
}

/** Felder, die der Kunde SEIT dem Speichern erneut geändert hat.
 *
 *  Nötig, weil zwischen Absenden und Antwort weitergetippt werden kann: würde man
 *  den Serverstand blind übernehmen, verschwindet diese Eingabe unter der Hand.
 *  Hier gewinnt der lokale Wert, der Server liefert nur die Basis. */
function istGeaendert(lokal: Branding, server: Branding): Partial<Branding> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(lokal) as Array<keyof Branding>) {
    if (JSON.stringify(lokal[k]) !== JSON.stringify(server[k])) {
      out[k] = lokal[k];
    }
  }
  return out as Partial<Branding>;
}
