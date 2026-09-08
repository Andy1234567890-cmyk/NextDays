// Überblick — der Einstieg. Struktur nach der Vorlage („Smarter Data": Tacho
// oben, Verteilungs-Ring darunter, Kennzahlen als Kacheln).
//
// WAS HIER BEWUSST NICHT STEHT: Umsatz und Erlös. Die Vorlage zeigt an dieser
// Stelle „Revenues / Portal" und eine Umsatzkurve; der Eigentümer-Contract
// liefert unter `/public-portal/statistics` ausschließlich Anzahlen — kein
// Geld (Rollen-Datensplit §4.2/§4.3). Beträge stehen ausschließlich in
// „Auszahlungen" und unterliegen dort der serverseitigen Maske
// (`payout: null` → „—", nie 0). Wer hier eine Geldzahl einbaut, umgeht sie.
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { useSprache } from "@/contexts/SprachContext";
import { Kachel, KachelKopf, Segmented, Spinner, Txt } from "@/components/ui/kit";
import { deckkraft, Ring, type RingTeil } from "@/components/widgets/Ring";
import { Tacho } from "@/components/widgets/Tacho";
import {
  getOwnerStatistics,
  statistikZeitraum,
  type PortalStatistics,
} from "@/lib/ownerPortal";
import { portalLabel } from "@/lib/portal-logos";
import { type Uebersetzer, zahl } from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

// Die drei Zeiträume der Vorlage. 24 Monate wären noch erlaubt
// (STATISTIK_MAX_TAGE = 730), sagen auf einem Telefon aber nichts mehr.
const ZEITRAEUME = [
  { schluessel: "stat.dreiMonate", monate: 3 },
  { schluessel: "stat.sechsMonate", monate: 6 },
  { schluessel: "stat.zwoelfMonate", monate: 12 },
] as const;

/**
 * Kanalname für die Legende: der echte Portalname, wenn einer da ist, sonst
 * der Kanalcode als Klartext. „portal" ist unser eigener Marktplatz und heißt
 * beim Namen der Marke, nicht „Portal" (CLAUDE.md: myBestDays ist ein
 * gleichrangiger Kanal, nicht „Direkt").
 */
export function kanalName(txt: Uebersetzer, channel: string, otaName: string | null): string {
  if (otaName) return portalLabel(otaName);
  // Portalnamen sind Eigennamen und bleiben, wie sie heißen. Übersetzt wird
  // nur, was eine Beschreibung ist: „Direkt", „Eigene Website", „Weitere
  // Portale" — der Rest ist eine Marke.
  const NAMEN: Record<string, string> = {
    direct: txt("kanal.direkt"),
    website: txt("kanal.eigeneWebsite"),
    portal: "myBestDays",
    booking: "Booking.com",
    airbnb: "Airbnb",
    vrbo: "Vrbo",
    ota_other: txt("kanal.weiterePortale"),
  };
  // Unbekannter Code: den Code zeigen, nicht raten (Wurzel 4).
  return NAMEN[channel] ?? channel;
}

/**
 * Kanalzeilen zu Ring-Teilen falten — nach ANZEIGENAME, nicht je Zeile.
 *
 * Die Live-Daten fuehren dasselbe Portal in mehreren Schreibweisen: bei AirSmil
 * stehen `Booking.com` (206 Buchungen) und `BookingCom` (88) nebeneinander, und
 * `portalLabel()` bildet beide auf denselben Namen ab. Wer die Zeilen einzeln
 * durchreicht, bekommt zwei Ring-Segmente mit gleichem React-Key (Warnung
 * "two children with the same key") und eine Legende, die "Booking.com"
 * zweimal mit geteilten Zahlen zeigt — der Eigentuemer sieht seinen groessten
 * Kanal halbiert. Zusammenfassen ist deshalb keine Kosmetik gegen die Warnung,
 * sondern die richtige Zahl.
 */
export function kanalTeile(
  txt: Uebersetzer,
  zeilen: readonly { channel: string; ota_name: string | null; reservations: number }[],
): RingTeil[] {
  const summen = new Map<string, number>();
  for (const z of zeilen) {
    const name = kanalName(txt, z.channel, z.ota_name);
    summen.set(name, (summen.get(name) ?? 0) + z.reservations);
  }
  return Array.from(summen, ([name, wert]) => ({ name, wert })).sort(
    (a, b) => b.wert - a.wert,
  );
}

export default function Ueberblick() {
  const { t: txt, sprache } = useSprache();
  const t = useTheme();
  const [monate, setMonate] = useState(12);
  const [daten, setDaten] = useState<PortalStatistics | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const { from, to } = statistikZeitraum(monate, new Date());
    const res = await getOwnerStatistics({ from, to });
    if (res.ok) setDaten(res.data);
    else setFehler(res.error);
    setLaedt(false);
  }, [monate]);

  useEffect(() => {
    setLaedt(true);
    void laden();
  }, [laden]);

  const teile: RingTeil[] = kanalTeile(txt, daten?.by_channel ?? []);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.surface2 }}>
      <ScrollView
        contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND }}
        refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
      >
        <Segmented
          options={ZEITRAEUME.map((z) => txt(z.schluessel))}
          value={ZEITRAEUME.findIndex((z) => z.monate === monate)}
          onChange={(i) => setMonate(ZEITRAEUME[i]?.monate ?? 12)}
        />

        {fehler ? (
          <Kachel>
            <Txt v="title">{txt("stat.nichtGeladen")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}

        {laedt && !daten ? (
          <Kachel>
            <Spinner />
          </Kachel>
        ) : null}

        {daten ? (
          <>
            <Kachel>
              <KachelKopf titel={txt("kennzahl.auslastung")} />
              <Tacho wert={daten.occupancy_rate} label={`${daten.units_total} Einheiten`} />
              <View style={{ flexDirection: "row", marginTop: 12 }}>
                <Wert titel={txt("stat.belegteNaechte")} wert={String(daten.nights_booked)} />
                <Wert titel={txt("stat.eigennutzung")} wert={String(daten.owner_stay_nights)} />
                <Wert
                  titel={txt("stat.kapazitaet")}
                  wert={String(daten.capacity_unit_nights)}
                  hinweis={txt("stat.kapazitaetHinweis")}
                />
              </View>
            </Kachel>

            <Kachel>
              <KachelKopf titel={txt("stat.buchungenJeKanal")} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <Ring teile={teile} mitte={String(daten.reservations)} mitteLabel={txt("stat.anreisen")} />
                <View style={{ flex: 1, gap: 8 }}>
                  {teile.length === 0 ? (
                    <Txt v="sm" soft>
                      {txt("stat.keineAnreisen")}
                    </Txt>
                  ) : (
                    teile.map((teil, i) => (
                      <Legende
                        key={teil.name}
                        name={teil.name}
                        wert={teil.wert}
                        index={i}
                        anzahl={teile.length}
                      />
                    ))
                  )}
                </View>
              </View>
            </Kachel>

            <Kachel>
              <KachelKopf titel={txt("stat.aufenthalt")} />
              <View style={{ flexDirection: "row" }}>
                <Wert
                  titel={txt("stat.durchschnittAufenthalt")}
                  wert={daten.avg_stay_nights === null ? "—" : `${zahl(sprache, daten.avg_stay_nights, 1)} N`}
                />
                <Wert
                  titel={txt("stat.durchschnittVorlauf")}
                  wert={daten.avg_lead_time_days === null ? "—" : txt("stat.tage", { anzahl: Math.round(daten.avg_lead_time_days) })}
                  hinweis={
                    daten.avg_lead_time_basis > 0
                      ? txt("stat.ausBuchungen", { anzahl: daten.avg_lead_time_basis })
                      : txt("stat.nichtBekannt")
                  }
                />
              </View>
            </Kachel>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Eine Kennzahl in der Kachel. „—" steht für „nicht berechenbar". */
function Wert({ titel, wert, hinweis }: { titel: string; wert: string; hinweis?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt v="h2">{wert}</Txt>
      <Txt v="xs" soft>
        {titel}
      </Txt>
      {hinweis ? (
        <Txt v="xs" faint>
          {hinweis}
        </Txt>
      ) : null}
    </View>
  );
}

/** Legendenzeile des Rings — Punkt in der Segmentfarbe, Name, Anzahl. */
function Legende({
  name,
  wert,
  index,
  anzahl,
}: {
  name: string;
  wert: number;
  index: number;
  anzahl: number;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: t.palette.accent,
          // Dieselbe Abstufung wie im Ring — EINE Formel, sonst laufen
          // Segment und Legende auseinander.
          opacity: deckkraft(index, anzahl),
        }}
      />
      <Txt v="sm" style={{ flex: 1 }} numberOfLines={1}>
        {name}
      </Txt>
      <Txt v="sm">{wert}</Txt>
    </View>
  );
}
