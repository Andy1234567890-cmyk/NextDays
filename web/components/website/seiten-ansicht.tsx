"use client";

// Der Seiten-Reiter: Seitenliste links (nach Navigationszone gruppiert),
// Vorschau der gewählten Seite rechts.
import { useEffect, useState } from "react";

import type { Branding, CustomDomain } from "@/lib/site-config";
import { type Page, createDraftToken } from "@/lib/site-pages";

import { BaukastenRahmen } from "./rahmen";
import { SeitenLeiste } from "./seiten/seiten-leiste";
import { type Geraet, VorschauFlaeche } from "./vorschau";

export function SeitenAnsicht({
  pages,
  domains,
  branding,
}: {
  pages: Page[];
  domains: CustomDomain[];
  /** Für den Seiteneinstellungen-Dialog: welche Sprachen die Website führt. */
  branding: Branding;
}) {
  const [geraet, setGeraet] = useState<Geraet>("desktop");
  const vorschauSeite = pages.find((p) => p.is_home) ?? pages[0] ?? null;
  const vorschauSeitenId = vorschauSeite?.id ?? null;
  const [token, setToken] = useState<string | null>(null);
  const [tokenFehler, setTokenFehler] = useState(false);
  const [neuLaden, setNeuLaden] = useState(0);

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

  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      onVeroeffentlicht={() => setNeuLaden((n) => n + 1)}
      seitenleiste={
        <SeitenLeiste
          pages={pages}
          websiteSprachen={branding.languages ?? []}
          domain={domains.find((d) => d.status === "active")?.domain ?? null}
        />
      }
      inhalt={
        <VorschauFlaeche
          geraet={geraet}
          onGeraet={setGeraet}
          pageId={vorschauSeitenId}
          token={token}
          tokenFehler={tokenFehler}
          neuLaden={neuLaden}
        />
      }
    />
  );
}
