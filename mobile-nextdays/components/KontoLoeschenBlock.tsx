// „Konto löschen" im eigenen Konto — Store-Voraussetzung, nicht Beigabe.
//
// Apple App Review 5.1.1(v): *„If your app supports account creation, you must
// also offer account deletion within the app."* Diese App enthält eine
// Registrierung, also gilt die Regel; die Ausnahme für „sign in with an EXISTING
// enterprise account" greift dann nicht.
//
// Der Ablauf ist zweistufig und ehrlich beschriftet:
//
//  1. Antippen zeigt, WAS passiert — inklusive der Angaben, die aus gesetzlicher
//     Aufbewahrungspflicht erhalten bleiben. Eine Löschung, die stillschweigend
//     Rechnungen behält, ist eine Täuschung.
//  2. Erst nach Eingabe des aktuellen Passworts wird gelöscht (Wurzel 7). Ein
//     gekapertes Token allein darf kein Konto vernichten.
//
// Das Ergebnis unterscheidet zwei Fälle, weil der Server sie unterscheidet:
// Mitarbeiter, Eigentümer und Co-Admins sind sofort weg; beim Kontoinhaber
// entsteht ein ANTRAG, weil an seinem Konto der ganze Betrieb hängt. „Erledigt"
// für beide zu melden wäre eine Falschaussage (Wurzel 4).
import { useCallback, useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Row, Txt } from "@/components/ui/kit";
import {
  kontoLoeschen,
  loeschStatus,
  loeschantragZurueckziehen,
  type LoeschStatus,
} from "@/lib/konto";
import { useTheme } from "@/theme/ThemeProvider";

/** Wie das Datum eines Antrags dasteht — kurz, mit Jahr (er kann alt sein). */
function tagLang(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", {
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
}: {
  onGeloescht: () => void;
}) {
  const t = useTheme();
  const [stand, setStand] = useState<LoeschStatus | null>(null);
  const [offen, setOffen] = useState(false);
  const [passwort, setPasswort] = useState("");
  const [grund, setGrund] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Ergebnis eines ANTRAGS (Kontoinhaber): bleibt stehen, damit der Nutzer
  // liest, was nun passiert.
  const [antragstext, setAntragstext] = useState<string | null>(null);

  const standLaden = useCallback(() => {
    const lauf = async () => {
      const res = await loeschStatus();
      if (res.ok) setStand(res.data);
      else console.warn(`[konto] Löschstatus nicht geladen: ${res.error}`);
    };
    lauf();
  }, []);

  useEffect(() => {
    standLaden();
  }, [standLaden]);

  const loeschen = useCallback(() => {
    const lauf = async () => {
      setLaeuft(true);
      setFehler(null);
      const res = await kontoLoeschen(passwort, grund.trim() || undefined);
      setLaeuft(false);
      if (!res.ok) {
        setFehler(res.error);
        return;
      }
      setPasswort("");
      setGrund("");
      setOffen(false);
      if (res.data.geloescht) {
        onGeloescht();
        return;
      }
      // Antrag: das Konto besteht weiter, der Nutzer bleibt angemeldet.
      setAntragstext(res.data.detail);
      setStand({
        antrag_offen: true,
        beantragt_am: res.data.beantragt_am,
        hinweis: res.data.hinweis,
      });
    };
    lauf();
  }, [passwort, grund, onGeloescht]);

  const zurueckziehen = useCallback(() => {
    const lauf = async () => {
      setLaeuft(true);
      setFehler(null);
      const res = await loeschantragZurueckziehen();
      setLaeuft(false);
      if (!res.ok) {
        setFehler(res.error);
        return;
      }
      setAntragstext(null);
      setStand(res.data);
    };
    lauf();
  }, []);

  // Ein laufender Antrag ersetzt den Knopf: ihn erneut anzubieten hieße, denselben
  // Antrag mehrfach stellen zu lassen (Wurzel 2).
  if (stand?.antrag_offen) {
    return (
      <Col gap={10}>
        <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
          KONTO LÖSCHEN
        </Txt>
        <Card style={{ padding: 16 }}>
          <Col gap={10}>
            <Row gap={8} style={{ alignItems: "flex-start" }}>
              <Icon n="clock" s={16} sw={1.9} c={t.palette.soft} />
              <Txt v="body" style={{ flex: 1 }}>
                Löschung beantragt
                {stand.beantragt_am ? ` am ${tagLang(stand.beantragt_am)}` : ""}
              </Txt>
            </Row>
            <Txt v="sm" soft>
              {antragstext ??
                "Wir prüfen offene Zahlungen und Fristen und melden uns per E-Mail."}
            </Txt>
            {stand.hinweis ? (
              <Txt v="xs" soft>
                {stand.hinweis}
              </Txt>
            ) : null}
            {fehler ? (
              <Txt v="sm" color={t.palette.accent}>
                {fehler}
              </Txt>
            ) : null}
            <Btn variant="outline" block disabled={laeuft} onPress={zurueckziehen}>
              {laeuft ? "Ziehe zurück…" : "Antrag zurückziehen"}
            </Btn>
          </Col>
        </Card>
      </Col>
    );
  }

  return (
    <Col gap={10}>
      <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
        KONTO LÖSCHEN
      </Txt>

      {!offen ? (
        <Btn variant="outline" block icon="x" onPress={() => setOffen(true)}>
          Konto löschen
        </Btn>
      ) : (
        <Card style={{ padding: 16 }}>
          <Col gap={12}>
            <Txt v="title" color="#B02A2A">
              Konto endgültig löschen
            </Txt>
            <Txt v="sm">
              Ihr Zugang wird entfernt. Sind Sie der Kontoinhaber, hängt der
              gesamte Betrieb an diesem Konto — dann wird die Löschung
              beantragt und geprüft, statt sofort ausgeführt.
            </Txt>
            {/* Diese Angabe MUSS vor der Bestätigung stehen, nicht danach. */}
            <Txt v="xs" soft>
              Rechnungen, Zahlungen und Buchungsbelege bleiben aus gesetzlicher
              Aufbewahrungspflicht erhalten (Buchführung, 5 Jahre) und werden vom
              Konto getrennt.
            </Txt>

            <Col gap={6}>
              <Txt v="xs" soft>
                Aktuelles Passwort (Pflicht)
              </Txt>
              <TextInput
                value={passwort}
                onChangeText={setPasswort}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                placeholder="Passwort"
                placeholderTextColor={t.palette.faint}
                style={{
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  borderRadius: t.radius.card,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  color: t.palette.ink,
                  fontFamily: t.fonts.regular,
                  fontSize: 15,
                }}
              />
            </Col>

            <Col gap={6}>
              <Txt v="xs" soft>
                Grund (freiwillig)
              </Txt>
              <TextInput
                value={grund}
                onChangeText={setGrund}
                multiline
                placeholder="Warum möchten Sie löschen?"
                placeholderTextColor={t.palette.faint}
                style={{
                  minHeight: 60,
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  borderRadius: t.radius.card,
                  padding: 10,
                  color: t.palette.ink,
                  fontFamily: t.fonts.regular,
                  fontSize: 14,
                  textAlignVertical: "top",
                }}
              />
            </Col>

            {fehler ? (
              <Txt v="sm" color={t.palette.accent}>
                {fehler}
              </Txt>
            ) : null}

            <Row gap={8}>
              <Btn
                variant="outline"
                style={{ flex: 1, paddingVertical: 11 }}
                disabled={laeuft}
                onPress={() => {
                  setOffen(false);
                  setPasswort("");
                  setGrund("");
                  setFehler(null);
                }}
              >
                Abbrechen
              </Btn>
              <Btn
                style={{ flex: 1, paddingVertical: 11 }}
                disabled={laeuft || passwort.length === 0}
                onPress={loeschen}
              >
                {laeuft ? "Lösche…" : "Löschen"}
              </Btn>
            </Row>
          </Col>
        </Card>
      )}

      <View style={{ height: 4 }} />
    </Col>
  );
}
