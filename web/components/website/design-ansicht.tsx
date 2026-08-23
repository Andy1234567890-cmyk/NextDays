"use client";

// Der Design-Reiter: Einstellungen links, Live-Vorschau rechts, Autospeichern.
//
// Zuvor lag das mit den Reitern „Seiten" und „Adresse" in EINER Komponente, die
// über `?reiter=` umschaltete. Damit hatte jeder Unterpunkt dieselbe Adresse,
// und der Logo-Bereich gar keine. Jetzt ist jeder Reiter eine eigene Route und
// diese Datei nur noch für Design zuständig.
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { type Branding, type CustomDomain, setBranding } from "@/lib/site-config";
import { type Page, createDraftToken } from "@/lib/site-pages";

import { DesignLeiste } from "./design/design-leiste";
import { BaukastenRahmen } from "./rahmen";
import { SpeicherAnzeige } from "./schale";
import { useAutospeichern } from "./use-autospeichern";
import { type Geraet, VorschauFlaeche } from "./vorschau";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

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
  unterseite?: "logo" | null;
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
  const [token, setToken] = useState<string | null>(null);
  const [tokenFehler, setTokenFehler] = useState(false);
  const [neuLaden, setNeuLaden] = useState(0);

  // Nur die ID ist die Abhängigkeit, die zählt: `vorschauSeite` ist bei jedem
  // Render ein neues Objekt (aus `pages.find`), und darauf zu hören würde bei
  // jedem Render einen neuen Token holen.
  const vorschauSeitenId = vorschauSeite?.id ?? null;
  useEffect(() => {
    if (!vorschauSeitenId) return;
    let lebt = true;
    setTokenFehler(false);
    createDraftToken(vorschauSeitenId).then((res) => {
      if (!lebt) return;
      if (res.ok) setToken(res.data.token);
      else setTokenFehler(true);
    });
    return () => {
      lebt = false;
    };
  }, [vorschauSeitenId]);

  // Nach einem bestätigten Speichervorgang die Vorschau neu laden — sie rendert
  // serverseitig, ein lokaler State-Wechsel erreicht sie nicht.
  useEffect(() => {
    if (auto.uebernommen) setNeuLaden((n) => n + 1);
  }, [auto.uebernommen]);

  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      onVeroeffentlicht={() => setNeuLaden((n) => n + 1)}
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
          onGeraet={setGeraet}
          pageId={vorschauSeite?.id ?? null}
          token={token}
          tokenFehler={tokenFehler}
          neuLaden={neuLaden}
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
