// Zählerstände eines Objekts — ansehen und erfassen
// (`GET/POST /public-portal/meter-readings`).
//
// Das ist die EINZIGE schreibende Aktion dieser App neben dem Sperrantrag: der
// Eigentümer liest Strom/Wasser/Gas ab, wenn er selbst vor Ort ist.
//
// IDEMPOTENZ (Wurzel 2): der Knopf sperrt, solange die Anfrage läuft — sonst
// legt ein Doppeldruck zwei Ablesungen mit derselben Zahl an, und der Verbrauch
// zwischen ihnen ist 0.
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { useT } from "@/contexts/SprachContext";
import { Feld } from "@/components/ui/Feld";
import { Btn, Kachel, KachelKopf, Segmented, Spinner, Txt } from "@/components/ui/kit";
import {
  createMeterReading,
  getMeterReadings,
  type MeterReading,
} from "@/lib/ownerPortal";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

// Die Zählerarten. Werte sind die Codes des Servers, die Beschriftung ist
// unsere — ein neuer Code gehört HIER dazu, sonst steht er roh in der Liste.
const ARTEN = [
  { code: "electricity", label: "Strom" },
  { code: "water", label: "Wasser" },
  { code: "gas", label: "Gas" },
];

export function artName(code: string): string {
  return ARTEN.find((a) => a.code === code)?.label ?? code;
}

/** Heute als lokales JJJJ-MM-TT (kein `toISOString()` → keine UTC-Verschiebung). */
export function heuteIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

/**
 * Komma ODER Punkt als Dezimaltrennzeichen annehmen — die deutsche Tastatur
 * liefert das Komma, `Number()` versteht nur den Punkt. Ohne diese Umwandlung
 * wurde „1234,5" zu NaN und die Ablesung stillschweigend verworfen.
 */
export function zahlAus(eingabe: string): number | null {
  const roh = eingabe.trim().replace(",", ".");
  if (roh === "") return null;
  const n = Number(roh);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type Route = { params: { propertyId: string; titel: string } };

export default function Zaehlerstand({ route }: { route: Route }) {
  const txt = useT();
  const t = useTheme();
  const { propertyId } = route.params;
  const [items, setItems] = useState<MeterReading[] | null>(null);
  const [artIndex, setArtIndex] = useState(0);
  const [wert, setWert] = useState("");
  const [datum, setDatum] = useState(() => heuteIso(new Date()));
  const [laedt, setLaedt] = useState(true);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const res = await getMeterReadings(propertyId);
    if (res.ok) setItems(res.data.items);
    else setFehler(res.error);
    setLaedt(false);
  }, [propertyId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const speichern = async () => {
    const zahl = zahlAus(wert);
    if (zahl === null) {
      setFehler(txt("zaehler.fehlerZahl"));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setFehler(txt("zaehler.fehlerDatum"));
      return;
    }
    setSendet(true);
    setFehler(null);
    const res = await createMeterReading({
      property_id: propertyId,
      meter_kind: ARTEN[artIndex]?.code ?? "electricity",
      value: zahl,
      read_at: datum,
    });
    setSendet(false);
    if (res.ok) {
      setWert("");
      await laden();
      return;
    }
    setFehler(res.error);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND }}
      refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
      keyboardShouldPersistTaps="handled"
    >
      <Kachel>
        <KachelKopf titel={txt("zaehler.erfassenTitel")} />
        <Segmented
          options={ARTEN.map((a) => a.label)}
          value={artIndex}
          onChange={setArtIndex}
        />
        <View style={{ height: 12 }} />
        <Feld
          label={txt("zaehler.stand")}
          wert={wert}
          aendern={setWert}
          keyboardType="decimal-pad"
        />
        <View style={{ height: 10 }} />
        <Feld
          label={txt("zaehler.datumFormat")}
          wert={datum}
          aendern={setDatum}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Btn onPress={() => void speichern()} disabled={sendet} block style={{ marginTop: 14 }}>
          {sendet ? txt("zaehler.wirdGespeichert") : txt("zaehler.speichern")}
        </Btn>
        {fehler ? (
          <Txt v="xs" color={t.palette.accentText} style={{ marginTop: 10 }}>
            {fehler}
          </Txt>
        ) : null}
      </Kachel>

      <Kachel>
        <KachelKopf titel={txt("zaehler.bisherige")} />
        {laedt && !items ? <Spinner /> : null}
        {items?.length === 0 ? (
          <Txt v="sm" soft>
            Noch keine Ablesung erfasst.
          </Txt>
        ) : null}
        {items?.map((z, i) => (
          <View
            key={z.id}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 9,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.palette.line,
            }}
          >
            <View>
              <Txt v="sm">{artName(z.meter_kind)}</Txt>
              <Txt v="xs" soft>
                {z.read_at}
              </Txt>
            </View>
            <Txt v="title">{z.value}</Txt>
          </View>
        ))}
      </Kachel>
    </ScrollView>
  );
}
