// Sperrantrag — Eigennutzung beantragen. Der Eigentümer SPERRT NICHT SELBST:
// er stellt einen Antrag (`POST /public-portal/block-requests`), die Verwaltung
// entscheidet. Deshalb heißt der Knopf „Beantragen" und nicht „Sperren" — die
// Nacht ist danach nicht frei, sondern der Antrag ist offen.
//
// IDEMPOTENZ (Wurzel 2): der Knopf sperrt sich, solange die Anfrage läuft. Ein
// Doppeldruck würde sonst zwei Anträge für denselben Zeitraum anlegen, und
// jemand müsste beide von Hand abarbeiten.
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Feld } from "@/components/ui/Feld";
import { Btn, Kachel, KachelKopf, Txt } from "@/components/ui/kit";
import {
  createBlockRequest,
  getOwnerProperties,
  type PortalProperty,
} from "@/lib/ownerPortal";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

/** Grober Format- und Reihenfolgetest, bevor der Server 422 sagt. */
export function zeitraumPlausibel(von: string, bis: string): boolean {
  const muster = /^\d{4}-\d{2}-\d{2}$/;
  if (!muster.test(von) || !muster.test(bis)) return false;
  return von <= bis;
}

type Nav = { goBack: () => void };
type Route = { params?: { propertyId?: string } };

export default function Sperrantrag({
  navigation,
  route,
}: {
  navigation: Nav;
  route: Route;
}) {
  const t = useTheme();
  const [objekte, setObjekte] = useState<PortalProperty[]>([]);
  const [objektId, setObjektId] = useState<string | null>(route.params?.propertyId ?? null);
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);

  useEffect(() => {
    void getOwnerProperties().then((res) => {
      if (!res.ok) return;
      setObjekte(res.data.items);
      if (!objektId && res.data.items.length > 0) setObjektId(res.data.items[0].id);
    });
    // Absichtlich nur beim Öffnen: die Objektliste ändert sich nicht während
    // des Ausfüllens, und `objektId` in den Abhängigkeiten würde bei jeder
    // Auswahl neu laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const senden = async () => {
    if (!objektId) {
      setFehler("Bitte ein Objekt wählen.");
      return;
    }
    if (!zeitraumPlausibel(von, bis)) {
      setFehler("Bitte Datum als JJJJ-MM-TT angeben, von-Datum vor bis-Datum.");
      return;
    }
    setLaeuft(true);
    setFehler(null);
    const res = await createBlockRequest({
      property_id: objektId,
      start_date: von,
      end_date: bis,
    });
    setLaeuft(false);
    if (res.ok) {
      setFertig(true);
      return;
    }
    setFehler(res.error);
  };

  const gewaehltesObjekt = objekte.find((o) => o.id === objektId);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND }}
      keyboardShouldPersistTaps="handled"
    >
      {fertig ? (
        <Kachel>
          <Txt v="title">Antrag ist eingegangen</Txt>
          <Txt v="sm" soft style={{ marginTop: 4 }}>
            Ihre Verwaltung entscheidet darüber. Solange der Antrag offen ist, bleibt der
            Zeitraum buchbar — erst mit der Zusage wird er gesperrt.
          </Txt>
          <Btn onPress={() => navigation.goBack()} block style={{ marginTop: 14 }}>
            Zurück
          </Btn>
        </Kachel>
      ) : (
        <>
          <Kachel>
            <KachelKopf titel="Objekt" />
            {objekte.length === 0 ? (
              <Txt v="sm" soft>
                Noch kein Objekt zugeordnet.
              </Txt>
            ) : (
              objekte.map((o) => {
                const aktiv = o.id === objektId;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setObjektId(o.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: aktiv }}
                    accessibilityLabel={o.title}
                    style={{
                      paddingVertical: 10,
                      borderTopWidth: objekte.indexOf(o) === 0 ? 0 : 1,
                      borderTopColor: t.palette.line,
                    }}
                  >
                    <Txt v="title" color={aktiv ? t.palette.accent : t.palette.ink}>
                      {aktiv ? "● " : "○ "}
                      {o.title}
                    </Txt>
                  </Pressable>
                );
              })
            )}
          </Kachel>

          <Kachel>
            <KachelKopf titel="Zeitraum" />
            <Feld label="Von (JJJJ-MM-TT)" wert={von} aendern={setVon} keyboardType="numbers-and-punctuation" maxLength={10} />
            <View style={{ height: 10 }} />
            <Feld label="Bis (JJJJ-MM-TT)" wert={bis} aendern={setBis} keyboardType="numbers-and-punctuation" maxLength={10} />
            <Txt v="xs" faint style={{ marginTop: 8 }}>
              Beide Tage gehören zum Zeitraum.
            </Txt>
          </Kachel>

          {fehler ? (
            <Kachel>
              <Txt v="sm" color={t.palette.accent}>
                {fehler}
              </Txt>
            </Kachel>
          ) : null}

          <Btn onPress={() => void senden()} disabled={laeuft} block>
            {laeuft ? "Wird gesendet …" : "Zeitraum beantragen"}
          </Btn>

          {gewaehltesObjekt ? (
            <Txt v="xs" faint style={{ textAlign: "center" }}>
              Antrag für {gewaehltesObjekt.title}
            </Txt>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
