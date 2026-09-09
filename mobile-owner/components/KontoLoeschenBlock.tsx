// „Konto löschen" im Menü — zweistufig und ehrlich beschriftet.
//
// WARUM ZWEISTUFIG: Der erste Druck zeigt, WAS passiert; erst der zweite mit
// dem aktuellen Passwort löscht (Wurzel 7 — ein gekapertes Token allein darf
// kein Konto vernichten). Ein einzelner Knopf, der sofort löscht, wäre in einer
// Liste neben „Abmelden" die falsche Nachbarschaft.
//
// WAS DIESE FASSUNG von `mobile-nextdays/components/KontoLoeschenBlock.tsx`
// unterscheidet — und warum sie KEINE Kopie ist:
//   * Kein Kontoinhaber-Fall. Ein Eigentümer ist nie `admin`; wäre er es,
//     stünde er in `screens/FalscheRolle.tsx` und nicht hier. Die Zweige „es
//     entsteht ein Antrag" und „Antrag zurückziehen" hätten in dieser App
//     keinen Auslöser, und ein Zweig ohne Auslöser ist eine Attrappe.
//     Ein Antrag, der über das WEB-Formular gestellt wurde, kann trotzdem offen
//     stehen — deshalb wird der Stand geladen und der Knopf dann ersetzt
//     (Wurzel 2: sonst stellt jemand denselben Antrag zweimal).
//   * Sie nennt die zwei Folgen, die es nur beim Eigentümer gibt: genehmigte
//     künftige Aufenthalte werden zurückgenommen, und Familienzugänge verlieren
//     die Sicht auf das Objekt. Beides tut der Server (Wurzel 1) — es hier zu
//     verschweigen hieße, jemanden etwas bestätigen zu lassen, dessen Wirkung
//     er nicht kennt.
//   * Sie benutzt `Feld` statt eines eigenen `TextInput`-Stils: in dieser App
//     gibt es dafür eine Stelle.
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Feld } from "@/components/ui/Feld";
import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Row, Txt } from "@/components/ui/kit";
import { useT } from "@/contexts/SprachContext";
import { kontoLoeschen, loeschStatus, type LoeschStatus } from "@/lib/konto";
import { useTheme } from "@/theme/ThemeProvider";

/** Datum eines Antrags — mit Jahr, er kann alt sein. */
function tagLang(iso: string | null, sprache: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(sprache, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function KontoLoeschenBlock({
  // Nach der vollzogenen Löschung ist der Zugang weg — die App MUSS abmelden,
  // sonst hält sie ein Token, hinter dem kein Konto mehr steht, und jeder
  // weitere Aufruf endet in einem 401 ohne erkennbaren Grund.
  onGeloescht,
  sprache,
}: {
  onGeloescht: () => void;
  sprache: string;
}) {
  const t = useTheme();
  const txt = useT();
  const [stand, setStand] = useState<LoeschStatus | null>(null);
  const [offen, setOffen] = useState(false);
  const [passwort, setPasswort] = useState("");
  const [grund, setGrund] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let lebt = true;
    const lauf = async () => {
      const res = await loeschStatus();
      // Ein Fehler hier darf den Knopf NICHT verstecken: dann fände der Nutzer
      // den Löschweg nicht mehr, und genau der ist die Store-Voraussetzung.
      if (lebt && res.ok) setStand(res.data);
    };
    void lauf();
    return () => {
      lebt = false;
    };
  }, []);

  const loeschen = useCallback(() => {
    const lauf = async () => {
      setLaeuft(true);
      setFehler(null);
      const res = await kontoLoeschen(passwort, grund.trim() || undefined);
      if (!res.ok) {
        setLaeuft(false);
        setFehler(res.error);
        return;
      }
      setPasswort("");
      setGrund("");
      if (res.data.geloescht) {
        // Kein `setLaeuft(false)`: der Knopf verschwindet mit dem Abmelden, und
        // ihn vorher wieder freizugeben lädt zu einem zweiten Druck auf ein
        // Konto ein, das es nicht mehr gibt (Wurzel 2).
        onGeloescht();
        return;
      }
      // Kein Kontoinhaber-Fall in dieser App — kommt er trotzdem, wird der
      // Server-Text gezeigt statt „gelöscht" behauptet (Wurzel 4).
      setLaeuft(false);
      setOffen(false);
      setStand({
        antrag_offen: true,
        beantragt_am: res.data.beantragt_am,
        hinweis: res.data.hinweis ?? res.data.detail,
      });
    };
    void lauf();
  }, [passwort, grund, onGeloescht]);

  if (stand?.antrag_offen) {
    return (
      <Col gap={10}>
        <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
          {txt("konto.loeschenTitel")}
        </Txt>
        <Card style={{ padding: 16 }}>
          <Col gap={10}>
            <Row gap={8} style={{ alignItems: "flex-start" }}>
              <Icon n="clock" s={16} sw={1.9} c={t.palette.soft} />
              <Txt v="body" style={{ flex: 1 }}>
                {stand.beantragt_am
                  ? txt("konto.beantragtAm", {
                      datum: tagLang(stand.beantragt_am, sprache),
                    })
                  : txt("konto.beantragt")}
              </Txt>
            </Row>
            <Txt v="sm" soft>
              {txt("konto.antragLaeuft")}
            </Txt>
            {stand.hinweis ? (
              <Txt v="xs" soft>
                {stand.hinweis}
              </Txt>
            ) : null}
          </Col>
        </Card>
      </Col>
    );
  }

  return (
    <Col gap={10}>
      <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
        {txt("konto.loeschenTitel")}
      </Txt>

      {!offen ? (
        <Btn variant="outline" block icon="x" onPress={() => setOffen(true)}>
          {txt("konto.loeschen")}
        </Btn>
      ) : (
        <Card style={{ padding: 16 }}>
          <Col gap={12}>
            <Txt v="title" accent>
              {txt("konto.loeschenEndgueltig")}
            </Txt>
            <Txt v="sm">{txt("konto.loeschenWas")}</Txt>
            {/* Die drei Folgen stehen VOR der Bestätigung, nicht danach. Eine
                Löschung, die stillschweigend Nächte freigibt und der Familie
                den Zugang nimmt, wäre eine Täuschung. */}
            <Col gap={6}>
              <Punkt text={txt("konto.folgeAufenthalte")} />
              <Punkt text={txt("konto.folgeFamilie")} />
              <Punkt text={txt("konto.folgeAufbewahrung")} />
            </Col>

            <Feld
              label={txt("konto.aktuellesPasswort")}
              wert={passwort}
              aendern={setPasswort}
              geheim
              autoComplete="current-password"
              autoCapitalize="none"
            />
            <Feld
              label={txt("konto.grund")}
              wert={grund}
              aendern={setGrund}
              hinweis={txt("konto.grundHinweis")}
              maxLength={2000}
            />

            {fehler ? (
              <Txt v="sm" accent>
                {fehler}
              </Txt>
            ) : null}

            <Row gap={10}>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="ghost"
                  block
                  disabled={laeuft}
                  onPress={() => {
                    setOffen(false);
                    setPasswort("");
                    setFehler(null);
                  }}
                >
                  {txt("allg.abbrechen")}
                </Btn>
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  variant="primary"
                  block
                  // Ohne Passwort gar nicht erst senden: der Server antwortet
                  // sonst mit 401, und das liest sich wie „falsches Passwort".
                  disabled={laeuft || passwort.length === 0}
                  onPress={loeschen}
                >
                  {laeuft ? txt("konto.wirdGeloescht") : txt("konto.jetztLoeschen")}
                </Btn>
              </View>
            </Row>
          </Col>
        </Card>
      )}
    </Col>
  );
}

function Punkt({ text }: { text: string }) {
  const t = useTheme();
  return (
    <Row gap={8} style={{ alignItems: "flex-start" }}>
      <Icon n="dot" s={14} sw={2} c={t.palette.faint} />
      <Txt v="xs" soft style={{ flex: 1 }}>
        {text}
      </Txt>
    </Row>
  );
}
