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
  type BestellteLeistung,
  createBlockRequest,
  getBestellbareLeistungen,
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
  // Bestellte Leistungen (0510/0538). Ohne Bestellung entsteht zur Sperre
  // KEINE Aufgabe; die Agentur genehmigt jede bestellte einzeln.
  const [leistungen, setLeistungen] = useState<BestellteLeistung[]>([]);
  const [bestellt, setBestellt] = useState<string[]>([]);
  const [leistungenFehler, setLeistungenFehler] = useState<string | null>(null);

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

  // Die bestellbaren Leistungen hängen am OBJEKT. Beim Objektwechsel wird
  // die Auswahl geleert statt mitgenommen — sonst stünde eine Bestellung im
  // Formular, die der Server für dieses Objekt mit 422 abweist.
  useEffect(() => {
    if (!objektId) {
      setLeistungen([]);
      setBestellt([]);
      return;
    }
    let aktuell = true;
    void getBestellbareLeistungen(objektId).then((res) => {
      if (!aktuell) return;
      if (res.ok) {
        setLeistungen(res.data.items);
        setLeistungenFehler(null);
      } else {
        // Ein Ladefehler ist nicht dasselbe wie „nichts bestellbar" (Wurzel
        // 4/5): sonst hält der Eigentümer das Nichts für die Wahrheit.
        setLeistungen([]);
        setLeistungenFehler(res.error);
      }
      setBestellt([]);
    });
    return () => {
      aktuell = false;
    };
  }, [objektId]);

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
      bestellte_leistungen: bestellt,
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
                    <Txt v="title" color={aktiv ? t.palette.accentText : t.palette.ink}>
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

          {/* Leistungen bestellen (0510/0538). Nur was hier angekreuzt ist,
              wird zur Sperre ausgeführt und abgerechnet — nach Genehmigung
              durch die Verwaltung. Ohne Auswahl entsteht keine Aufgabe. */}
          {leistungenFehler ? (
            <Kachel>
              <Txt v="sm" color={t.palette.accentText}>
                {leistungenFehler}
              </Txt>
            </Kachel>
          ) : leistungen.length > 0 ? (
            <Kachel>
              <KachelKopf titel="Leistungen bestellen" />
              <Txt v="xs" faint style={{ marginBottom: 6 }}>
                Nur was Sie ankreuzen, wird zu Ihrer Sperrung ausgeführt und
                abgerechnet — sobald Ihre Verwaltung es genehmigt hat.
              </Txt>
              {leistungen.map((l, idx) => {
                const aktiv = bestellt.includes(l.rule_id);
                return (
                  <Pressable
                    key={l.rule_id}
                    onPress={() =>
                      setBestellt((alt) =>
                        aktiv ? alt.filter((x) => x !== l.rule_id) : [...alt, l.rule_id],
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: aktiv }}
                    accessibilityLabel={l.name}
                    style={{
                      paddingVertical: 10,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: t.palette.line,
                    }}
                  >
                    <Txt v="title" color={aktiv ? t.palette.accentText : t.palette.ink}>
                      {aktiv ? "☑ " : "☐ "}
                      {l.name}
                    </Txt>
                  </Pressable>
                );
              })}
            </Kachel>
          ) : null}

          {fehler ? (
            <Kachel>
              <Txt v="sm" color={t.palette.accentText}>
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
