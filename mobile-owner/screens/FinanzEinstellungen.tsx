// Einstellungen der Finanzübersicht — das Blatt hinter „⋮" auf der Startseite
// (Vorlage: Hostaway „Financial settings": Berichtseinstellungen · Kennzahlen ·
// Alles zurücksetzen; jede Zeile öffnet eine Auswahlseite mit Haken).
//
// Es wird an einem ENTWURF gearbeitet: ✓ übernimmt, ✕ verwirft. Sonst lädt
// die Startseite bei jedem Tipp neu, obwohl noch gewählt wird.
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useT } from "@/contexts/SprachContext";
import { Blatt, BlattGruppe, BlattOption, BlattZeile } from "@/components/ui/Blatt";
import { Btn } from "@/components/ui/kit";
import {
  DIAGRAMMTYP_SCHLUESSEL,
  EREIGNIS_HINWEIS_SCHLUESSEL,
  EREIGNIS_SCHLUESSEL,
  type FinanzEinstellungen as Einstellungen,
  type Diagrammtyp,
  type Ereignis,
  KENNZAHLEN,
  KENNZAHL_HINWEIS_SCHLUESSEL,
  KENNZAHL_SCHLUESSEL,
  type Kennzahl,
  STANDARD,
  type Vergleich,
  VERGLEICH_SCHLUESSEL,
  istStandard,
  nebenkennzahlSetzen,
} from "@/lib/finanz-einstellungen";
import type { PortalProperty } from "@/lib/ownerPortal";
import type { TextSchluessel } from "@/lib/sprache";
import { ZEITRAUM_SCHLUESSEL, type ZeitraumWahl } from "@/lib/zeitraum";

type Seite = null | "objekt" | "zeitraum" | "ereignis" | "vergleich" | "diagramm" | "typ" | "neben";

const SEITEN_TITEL: Record<Exclude<Seite, null>, TextSchluessel> = {
  objekt: "finanz.objekteWaehlen",
  zeitraum: "finanz.zeitraumWaehlen",
  ereignis: "finanz.ereignisWaehlen",
  vergleich: "finanz.vergleichWaehlen",
  diagramm: "finanz.diagrammKennzahlWaehlen",
  typ: "finanz.diagrammtypWaehlen",
  neben: "finanz.nebenkennzahlen",
};

/** Der Gruppentitel je Auswahlseite — kürzer als der Seitentitel. */
const GRUPPEN_TITEL: Record<Exclude<Seite, null>, TextSchluessel> = {
  objekt: "finanz.objekte",
  zeitraum: "finanz.zeitraum",
  ereignis: "finanz.ereignis",
  vergleich: "finanz.vergleich",
  diagramm: "finanz.diagrammKennzahl",
  typ: "finanz.diagrammtyp",
  neben: "finanz.nebenkennzahlen",
};

export function FinanzEinstellungenBlatt({
  offen,
  wert,
  objekte,
  schliessen,
  uebernehmen,
}: {
  offen: boolean;
  wert: Einstellungen;
  objekte: readonly PortalProperty[];
  schliessen: () => void;
  uebernehmen: (e: Einstellungen) => void;
}) {
  const txt = useT();
  const [entwurf, setEntwurf] = useState<Einstellungen>(wert);
  const [seite, setSeite] = useState<Seite>(null);

  // Beim Öffnen frisch vom gültigen Stand starten — ein verworfener Entwurf
  // darf nicht beim nächsten Öffnen wieder da sein.
  useEffect(() => {
    if (offen) {
      setEntwurf(wert);
      setSeite(null);
    }
  }, [offen, wert]);

  const objektName = (id: string | null) =>
    id === null ? txt("finanz.alleObjekte") : (objekte.find((o) => o.id === id)?.title ?? "Objekt");

  const titel = txt(seite ? SEITEN_TITEL[seite] : "finanz.titel");

  return (
    <Blatt
      offen={offen}
      titel={titel}
      schliessen={schliessen}
      zurueck={seite ? () => setSeite(null) : undefined}
      bestaetigen={seite ? undefined : () => uebernehmen(entwurf)}
      fuss={
        seite ? undefined : (
          <Btn variant="outline" block disabled={istStandard(entwurf)} onPress={() => setEntwurf(STANDARD)}>
            {txt("finanz.zuruecksetzen")}
          </Btn>
        )
      }
    >
      {seite === null ? (
        <View style={{ gap: 12, paddingBottom: 4 }}>
          <BlattGruppe titel={txt("finanz.berichtseinstellungen")}>
            <BlattZeile label={txt("finanz.objekte")} wert={objektName(entwurf.propertyId)} auf={() => setSeite("objekt")} erste />
            <BlattZeile label={txt("finanz.zeitraum")} wert={txt(ZEITRAUM_SCHLUESSEL[entwurf.zeitraum])} auf={() => setSeite("zeitraum")} />
            <BlattZeile label={txt("finanz.ereignis")} wert={txt(EREIGNIS_SCHLUESSEL[entwurf.ereignis])} auf={() => setSeite("ereignis")} />
            <BlattZeile
              label={txt("finanz.vergleich")}
              wert={txt(entwurf.vergleich === "keiner" ? "finanz.vergleichKeiner" : "finanz.vorjahr")}
              auf={() => setSeite("vergleich")}
            />
          </BlattGruppe>
          <BlattGruppe titel={txt("finanz.kennzahlen")}>
            <BlattZeile
              label={txt("finanz.diagrammKennzahl")}
              wert={txt(KENNZAHL_SCHLUESSEL[entwurf.diagramm])}
              auf={() => setSeite("diagramm")}
              erste
            />
            <BlattZeile label={txt("finanz.diagrammtyp")} wert={txt(DIAGRAMMTYP_SCHLUESSEL[entwurf.diagrammtyp])} auf={() => setSeite("typ")} />
            <BlattZeile label={txt("finanz.nebenkennzahlen")} wert="2" auf={() => setSeite("neben")} />
          </BlattGruppe>
        </View>
      ) : null}

      {seite === "objekt" ? (
        <BlattGruppe titel={txt(GRUPPEN_TITEL.objekt)}>
          <BlattOption
            label={txt("finanz.alleObjekte")}
            aktiv={entwurf.propertyId === null}
            auf={() => setEntwurf({ ...entwurf, propertyId: null })}
            erste
          />
          {objekte.map((o) => (
            <BlattOption
              key={o.id}
              label={o.title}
              hinweis={o.city ?? undefined}
              aktiv={entwurf.propertyId === o.id}
              auf={() => setEntwurf({ ...entwurf, propertyId: o.id })}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "zeitraum" ? (
        <BlattGruppe titel={txt(GRUPPEN_TITEL.zeitraum)}>
          {(Object.keys(ZEITRAUM_SCHLUESSEL) as ZeitraumWahl[]).map((z, i) => (
            <BlattOption
              key={z}
              label={txt(ZEITRAUM_SCHLUESSEL[z])}
              aktiv={entwurf.zeitraum === z}
              auf={() => setEntwurf({ ...entwurf, zeitraum: z })}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "ereignis" ? (
        <BlattGruppe titel={txt(GRUPPEN_TITEL.ereignis)}>
          {(Object.keys(EREIGNIS_SCHLUESSEL) as Ereignis[]).map((e, i) => (
            <BlattOption
              key={e}
              label={txt(EREIGNIS_SCHLUESSEL[e])}
              hinweis={txt(EREIGNIS_HINWEIS_SCHLUESSEL[e])}
              aktiv={entwurf.ereignis === e}
              auf={() => setEntwurf({ ...entwurf, ereignis: e })}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "vergleich" ? (
        <BlattGruppe titel={txt(GRUPPEN_TITEL.vergleich)}>
          {(Object.keys(VERGLEICH_SCHLUESSEL) as Vergleich[]).map((v, i) => (
            <BlattOption
              key={v}
              label={txt(VERGLEICH_SCHLUESSEL[v])}
              hinweis={
                v === "vorjahr"
                  ? txt("finanz.vergleichBeispiel", {
                      jahrA: new Date().getFullYear(),
                      jahrB: new Date().getFullYear() - 1,
                    })
                  : undefined
              }
              aktiv={entwurf.vergleich === v}
              auf={() => setEntwurf({ ...entwurf, vergleich: v })}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "diagramm" ? (
        <BlattGruppe titel={txt(GRUPPEN_TITEL.diagramm)}>
          {KENNZAHLEN.map((k, i) => (
            <BlattOption
              key={k}
              label={txt(KENNZAHL_SCHLUESSEL[k])}
              hinweis={txt(KENNZAHL_HINWEIS_SCHLUESSEL[k])}
              aktiv={entwurf.diagramm === k}
              auf={() => setEntwurf({ ...entwurf, diagramm: k })}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "typ" ? (
        <BlattGruppe titel={txt(GRUPPEN_TITEL.typ)}>
          {(Object.keys(DIAGRAMMTYP_SCHLUESSEL) as Diagrammtyp[]).map((d, i) => (
            <BlattOption
              key={d}
              label={txt(DIAGRAMMTYP_SCHLUESSEL[d])}
              aktiv={entwurf.diagrammtyp === d}
              auf={() => setEntwurf({ ...entwurf, diagrammtyp: d })}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "neben" ? (
        <View style={{ gap: 12 }}>
          {([0, 1] as const).map((pos) => (
            <BlattGruppe key={pos} titel={txt("finanz.kennzahlNr", { nr: pos + 1 })}>
              {KENNZAHLEN.map((k: Kennzahl, i) => (
                <BlattOption
                  key={k}
                  label={txt(KENNZAHL_SCHLUESSEL[k])}
                  aktiv={entwurf.nebenkennzahlen[pos] === k}
                  auf={() =>
                    setEntwurf({
                      ...entwurf,
                      nebenkennzahlen: nebenkennzahlSetzen(entwurf.nebenkennzahlen, pos, k),
                    })
                  }
                  erste={i === 0}
                />
              ))}
            </BlattGruppe>
          ))}
        </View>
      ) : null}
    </Blatt>
  );
}
