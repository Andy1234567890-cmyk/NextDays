"use client";

// Block „Zu anderen Objekten hinzufügen": denselben Posten (Gebühr oder Steuer)
// auf weitere eigene Objekte übernehmen.
//
// Im Branchenstandard steht dieser Block als letzter Abschnitt IM Editor, mit
// Suchfeld, Zähler „8/20 ausgewählte", „Alle auswählen" und einer Zeile je
// Objekt mit Vorschaubild (live abgelesen 03.08.2026, Gebühren- und
// Steuer-Editor — in beiden derselbe Block). Deshalb liegt er hier als EINE
// Komponente und nicht zweimal: er stand vorher nur im Steuer-Editor, und eine
// Kopie für die Gebühr wäre die zweite Wahrheit über Auswahl und Zählweise.
//
// Die AUSWAHL-Mechanik selbst (Suche, Zähler, „Alle auswählen", Zeilen mit
// Bild/Adresse) liegt inzwischen eine Ebene tiefer in
// `components/objekt-mehrfachauswahl.tsx`, weil die Eigentümer-Zuordnung
// dasselbe braucht. Hier bleibt nur, was diesen Block AUSMACHT: Überschrift,
// erklärender Satz je Posten-Art und die Objektquelle.
//
// Die Liste kommt tenant-gescopt vom Server; welche IDs wirklich erlaubt sind,
// prüft der Endpunkt beim Anwenden erneut (Wurzel 3 — die Auswahl im Browser ist
// eine Bequemlichkeit, keine Autorisierung).
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  ObjektMehrfachauswahl,
  type ObjektAuswahlEintrag,
} from "@/components/objekt-mehrfachauswahl";
import { listProperties, type Property } from "@/lib/properties";

/** Worauf sich die Übernahme bezieht — steuert nur den erklärenden Satz. */
export type ZuAnderenObjektenArt = "fee" | "tax" | "promotion" | "season";

export function ZuAnderenObjekten({
  propertyId,
  kind,
  selected,
  onChange,
  onLoaded,
}: {
  propertyId: string;
  /** Nur für den erklärenden Satz („dieselbe Gebühr" vs. „dieselbe Steuer" vs.
   *  „dieselbe Promotion" vs. „dieselbe Saison") — die Mechanik ist identisch.
   *  Ein neutraler Sammelbegriff („Posten") wäre Fachjargon, den der Betrieb
   *  nirgends sonst liest. */
  kind: ZuAnderenObjektenArt;
  selected: string[];
  onChange: (next: string[]) => void;
  /** Die geladene Objektliste nach oben reichen. Wer eine Server-Antwort je
   *  Objekt anzeigt (übersprungene Ziele beim Übertragen einer Saison), braucht
   *  den Namen zur ID — und der steht hier schon. Ein zweiter
   *  `listProperties`-Aufruf im Aufrufer wäre dieselbe Liste ein zweites Mal. */
  onLoaded?: (objekte: ObjektAuswahlEintrag[]) => void;
}) {
  const t = useTranslations("objects");
  const [objekte, setObjekte] = useState<ObjektAuswahlEintrag[]>([]);
  const [suche, setSuche] = useState("");
  const gemeldet = useRef(onLoaded);
  gemeldet.current = onLoaded;
  useEffect(() => {
    void (async () => {
      const res = await listProperties();
      if (!res.ok) return;
      const eintraege = res.data.items
        .filter((p) => p.id !== propertyId)
        .map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: objektReferenz(p),
          photo: p.photos[0],
        }));
      setObjekte(eintraege);
      // Über die Ref, nicht über die Abhängigkeitsliste: ein Aufrufer, der die
      // Funktion inline schreibt, löste sonst bei jedem Render einen neuen
      // Ladelauf aus. Die Liste hängt fachlich nur am Objekt.
      gemeldet.current?.(eintraege);
    })();
  }, [propertyId]);

  // Der Block bleibt IMMER sichtbar — auch bei nur einem Objekt. Wird er
  // ausgeblendet, sieht die Zuweisung aus wie „nicht gebaut"; stattdessen sagt
  // eine Zeile, warum gerade nichts zur Auswahl steht.
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-extrabold">
        {t("pricingForm.applyToOthersTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">{t(hinweisSchluessel(kind))}</p>
      <ObjektMehrfachauswahl
        objekte={objekte}
        selected={selected}
        onChange={onChange}
        suche={suche}
        onSucheChange={setSuche}
        emptyText={t("pricingForm.applyToOthersEmpty")}
      />
    </section>
  );
}

/** Welcher erklärende Satz über der Liste steht. */
function hinweisSchluessel(kind: ZuAnderenObjektenArt): string {
  if (kind === "fee") return "pricingForm.applyToOthersFeeHint";
  if (kind === "tax") return "pricingForm.applyToOthersTaxHint";
  if (kind === "season") return "pricingForm.applyToOthersSeasonHint";
  return "pricingForm.applyToOthersPromoHint";
}

/** Zweite Zeile je Objekt: Adresse als Unterscheidungsmerkmal, wenn mehrere
 *  Objekte ähnlich heißen. Fehlt sie, bleibt die Zeile weg — kein Platzhalter. */
function objektReferenz(p: Property): string {
  const strasse = [p.street, p.house_number].filter(Boolean).join(" ");
  return [strasse, p.city].filter(Boolean).join(", ");
}
