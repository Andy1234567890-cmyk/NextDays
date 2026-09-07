// Einstellungen der Finanzübersicht — das Blatt hinter „⋮" auf der Startseite
// (Vorlage: Hostaway „Financial settings": Berichtseinstellungen · Kennzahlen ·
// Alles zurücksetzen; jede Zeile öffnet eine Auswahlseite mit Haken).
//
// Es wird an einem ENTWURF gearbeitet: ✓ übernimmt, ✕ verwirft. Sonst lädt
// die Startseite bei jedem Tipp neu, obwohl noch gewählt wird.
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Blatt, BlattGruppe, BlattOption, BlattZeile } from "@/components/ui/Blatt";
import { Btn } from "@/components/ui/kit";
import {
  DIAGRAMMTYP_LABEL,
  EREIGNIS_HINWEIS,
  EREIGNIS_LABEL,
  type FinanzEinstellungen as Einstellungen,
  type Diagrammtyp,
  type Ereignis,
  KENNZAHLEN,
  KENNZAHL_HINWEIS,
  KENNZAHL_LABEL,
  type Kennzahl,
  STANDARD,
  type Vergleich,
  VERGLEICH_LABEL,
  istStandard,
  nebenkennzahlSetzen,
} from "@/lib/finanz-einstellungen";
import type { PortalProperty } from "@/lib/ownerPortal";
import { ZEITRAUM_LABEL, type ZeitraumWahl } from "@/lib/zeitraum";

type Seite = null | "objekt" | "zeitraum" | "ereignis" | "vergleich" | "diagramm" | "typ" | "neben";

const SEITEN_TITEL: Record<Exclude<Seite, null>, string> = {
  objekt: "Objekte wählen",
  zeitraum: "Zeitraum wählen",
  ereignis: "Ereignis wählen",
  vergleich: "Vergleichszeitraum wählen",
  diagramm: "Diagramm-Kennzahl wählen",
  typ: "Diagrammtyp wählen",
  neben: "Weitere Kennzahlen",
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
    id === null ? "Alle Objekte" : (objekte.find((o) => o.id === id)?.title ?? "Objekt");

  const titel = seite ? SEITEN_TITEL[seite] : "Finanz-Einstellungen";

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
            Alles zurücksetzen
          </Btn>
        )
      }
    >
      {seite === null ? (
        <View style={{ gap: 12, paddingBottom: 4 }}>
          <BlattGruppe titel="Berichtseinstellungen">
            <BlattZeile label="Objekte" wert={objektName(entwurf.propertyId)} auf={() => setSeite("objekt")} erste />
            <BlattZeile label="Zeitraum" wert={ZEITRAUM_LABEL[entwurf.zeitraum]} auf={() => setSeite("zeitraum")} />
            <BlattZeile label="Ereignis" wert={EREIGNIS_LABEL[entwurf.ereignis]} auf={() => setSeite("ereignis")} />
            <BlattZeile
              label="Vergleichszeitraum"
              wert={entwurf.vergleich === "keiner" ? "Keiner" : "Vorjahr"}
              auf={() => setSeite("vergleich")}
            />
          </BlattGruppe>
          <BlattGruppe titel="Kennzahlen">
            <BlattZeile
              label="Diagramm-Kennzahl"
              wert={KENNZAHL_LABEL[entwurf.diagramm]}
              auf={() => setSeite("diagramm")}
              erste
            />
            <BlattZeile label="Diagrammtyp" wert={DIAGRAMMTYP_LABEL[entwurf.diagrammtyp]} auf={() => setSeite("typ")} />
            <BlattZeile label="Weitere Kennzahlen" wert="2" auf={() => setSeite("neben")} />
          </BlattGruppe>
        </View>
      ) : null}

      {seite === "objekt" ? (
        <BlattGruppe titel="Objekte">
          <BlattOption
            label="Alle Objekte"
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
        <BlattGruppe titel="Zeitraum">
          {(Object.keys(ZEITRAUM_LABEL) as ZeitraumWahl[]).map((z, i) => (
            <BlattOption
              key={z}
              label={ZEITRAUM_LABEL[z]}
              aktiv={entwurf.zeitraum === z}
              auf={() => setEntwurf({ ...entwurf, zeitraum: z })}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "ereignis" ? (
        <BlattGruppe titel="Ereignis">
          {(Object.keys(EREIGNIS_LABEL) as Ereignis[]).map((e, i) => (
            <BlattOption
              key={e}
              label={EREIGNIS_LABEL[e]}
              hinweis={EREIGNIS_HINWEIS[e]}
              aktiv={entwurf.ereignis === e}
              auf={() => setEntwurf({ ...entwurf, ereignis: e })}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "vergleich" ? (
        <BlattGruppe titel="Vergleichszeitraum">
          {(Object.keys(VERGLEICH_LABEL) as Vergleich[]).map((v, i) => (
            <BlattOption
              key={v}
              label={VERGLEICH_LABEL[v]}
              hinweis={v === "vorjahr" ? "z. B. 2026 gegen 2025" : undefined}
              aktiv={entwurf.vergleich === v}
              auf={() => setEntwurf({ ...entwurf, vergleich: v })}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "diagramm" ? (
        <BlattGruppe titel="Diagramm-Kennzahl">
          {KENNZAHLEN.map((k, i) => (
            <BlattOption
              key={k}
              label={KENNZAHL_LABEL[k]}
              hinweis={KENNZAHL_HINWEIS[k]}
              aktiv={entwurf.diagramm === k}
              auf={() => setEntwurf({ ...entwurf, diagramm: k })}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      ) : null}

      {seite === "typ" ? (
        <BlattGruppe titel="Diagrammtyp">
          {(Object.keys(DIAGRAMMTYP_LABEL) as Diagrammtyp[]).map((d, i) => (
            <BlattOption
              key={d}
              label={DIAGRAMMTYP_LABEL[d]}
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
            <BlattGruppe key={pos} titel={`Kennzahl ${pos + 1}`}>
              {KENNZAHLEN.map((k: Kennzahl, i) => (
                <BlattOption
                  key={k}
                  label={KENNZAHL_LABEL[k]}
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
