// Portal-Anfrage im Posteingang entscheiden (Mobile) — fachlicher Spiegel von
// web/components/inbox/inbox-anfrage.tsx.
//
// WARUM DIESE KARTE AUF DAS TELEFON GEHÖRT: Eine Anfrage ist keine Buchung. Der
// Gast wartet, und Airbnb lehnt nach Ablauf der Frist SELBST ab — Untätigkeit
// ist dort eine Absage. Wer nur am Schreibtisch entscheiden kann, verliert
// Anfragen am Wochenende.
//
// Drei Regeln, die aus dem Web übernommen sind und hier nicht neu erfunden
// werden dürfen:
//  1. KEINE Frist ausrechnen. Es gilt `non_response_at` des Portals; fehlt der
//     Wert, wird KEIN Countdown gezeigt (statt 24 Stunden zu raten, Wurzel 4).
//  2. Nur die Aktionen aus `detail.aktionen` anbieten. Eine Voranfrage kennt
//     kein „annehmen", ein Änderungswunsch keinen Sonderpreis.
//  3. Nur die vier Ablehnungsgründe des Portals — ein eigener ergibt 422.
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";

import { Btn, Card, Chip, Col, Divider, Row, Txt } from "@/components/ui/kit";
import {
  ABLEHNUNGSGRUENDE,
  entscheideAnfrage,
  type AnfrageAktion,
  type AnfrageDetail,
} from "@/lib/inbox";
import { useTheme } from "@/theme/ThemeProvider";

/** Verbleibende Minuten bis zur Frist. `null`, wenn das Portal keine nennt. */
function minutenBis(frist: string | null): number | null {
  if (!frist) return null;
  const ziel = Date.parse(frist);
  if (Number.isNaN(ziel)) return null;
  return Math.round((ziel - Date.now()) / 60000);
}

function fristText(minuten: number): string {
  if (minuten <= 0) return "Frist abgelaufen";
  if (minuten < 60) return `noch ${minuten} Min.`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `noch ${stunden} Std.`;
  return `noch ${Math.floor(stunden / 24)} Tage`;
}

const ART_TEXT: Record<string, string> = {
  inquiry: "Voranfrage",
  reservation_request: "Buchungsanfrage",
  alteration_request: "Änderungswunsch",
};

const AKTION_TEXT: Record<AnfrageAktion, string> = {
  annehmen: "Annehmen",
  ablehnen: "Ablehnen",
  vorab_genehmigen: "Vorab genehmigen",
  sonderpreis: "Sonderpreis senden",
  alteration_annehmen: "Änderung annehmen",
  alteration_ablehnen: "Änderung ablehnen",
  alteration_zuruecknehmen: "Änderung zurückziehen",
};

const GRUND_TEXT: Record<string, string> = {
  dates_not_available: "Termin nicht verfügbar",
  not_a_good_fit: "Passt nicht",
  waiting_for_better_reservation: "Warte auf andere Buchung",
  not_comfortable: "Unwohl damit",
};

/** Warum nicht mehr beantwortbar — Kürzel des Servers in Worte. */
const GESPERRT_TEXT: Record<string, string> = {
  accepted: "Bereits angenommen",
  declined: "Bereits abgelehnt",
  expired: "Frist abgelaufen",
  withdrawn: "Vom Gast zurückgezogen",
  cancelled: "Storniert",
  beantwortet: "Bereits beantwortet",
  keine_channex_id: "Keine Portal-Kennung — im Portal entscheiden",
};

export function AnfrageKarte({
  detail,
  darfEntscheiden,
  onEntschieden,
}: {
  detail: AnfrageDetail;
  /** `access.canReply` — ohne Antwortrecht wird nur angezeigt, nie entschieden. */
  darfEntscheiden: boolean;
  onEntschieden: () => void;
}) {
  const t = useTheme();
  const [offen, setOffen] = useState<AnfrageAktion | null>(null);
  const [grund, setGrund] = useState<string>(ABLEHNUNGSGRUENDE[0]);
  const [nachricht, setNachricht] = useState("");
  const [preis, setPreis] = useState("");
  const [busy, setBusy] = useState(false);
  // Der Countdown tickt minütlich — die Frist läuft über Stunden, häufiger
  // wäre nur Batterie.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!detail.beantwortbar || !detail.frist) return;
    const id = setInterval(() => tick((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, [detail.beantwortbar, detail.frist]);

  // Beim Wechsel auf eine andere Anfrage die Eingaben zurücksetzen: sonst
  // stünde der Ablehnungsgrund der vorigen im Formular.
  useEffect(() => {
    setOffen(null);
    setNachricht("");
    setPreis("");
    setGrund(ABLEHNUNGSGRUENDE[0]);
  }, [detail.thread_id]);

  const minuten = useMemo(() => minutenBis(detail.frist), [detail.frist]);
  const aktionen = detail.aktionen.filter(
    (a): a is AnfrageAktion => a in AKTION_TEXT,
  );

  const senden = async (aktion: AnfrageAktion) => {
    const input: Parameters<typeof entscheideAnfrage>[1] = { aktion };
    if (aktion === "ablehnen" || aktion === "alteration_ablehnen") {
      input.grund = grund;
    }
    if (nachricht.trim()) input.nachricht_an_gast = nachricht.trim();
    if (aktion === "sonderpreis") {
      const zahl = Number(preis.replace(",", "."));
      if (!Number.isFinite(zahl) || zahl <= 0) {
        Alert.alert("Preis fehlt", "Bitte einen Gesamtpreis eingeben.");
        return;
      }
      // Minor Units, ganzzahlig — der Server nimmt keine Haupteinheiten.
      input.gesamtpreis_minor = Math.round(zahl * 100);
    }
    setBusy(true);
    const res = await entscheideAnfrage(detail.thread_id, input);
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht übernommen", res.error);
      return;
    }
    setOffen(null);
    onEntschieden();
  };

  const zeile = (label: string, wert: string | null) =>
    wert ? (
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="sm" soft>
          {label}
        </Txt>
        <Txt v="sm">{wert}</Txt>
      </Row>
    ) : null;

  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Chip variant={detail.beantwortbar ? "accent" : ""}>
          {ART_TEXT[detail.art] ?? detail.art}
        </Chip>
        {/* Die Frist ist das Wichtigste an einer OFFENEN Anfrage — aber nur,
            wenn das Portal sie nennt. */}
        {detail.beantwortbar && minuten !== null && (
          <Chip icon="clock" variant={minuten <= 0 ? "accent" : ""}>
            {fristText(minuten)}
          </Chip>
        )}
      </Row>

      <Col gap={6}>
        {zeile("Objekt", detail.objekt)}
        {zeile("Gast", detail.gastname)}
        {zeile("Anreise", detail.anreise)}
        {zeile("Abreise", detail.abreise)}
        {zeile("Nächte", detail.naechte)}
        {zeile("Gäste", detail.gaeste)}
        {zeile("Tiere", detail.tiere)}
        {/* „Auszahlung", nicht „Umsatz": Airbnbs payout_amount ist der Netto-
            Betrag nach Portalgebühr. */}
        {detail.payout_betrag &&
          zeile(
            "Auszahlung",
            `${detail.payout_betrag}${detail.waehrung ? ` ${detail.waehrung}` : ""}`,
          )}
      </Col>

      {!detail.beantwortbar ? (
        <>
          <Divider />
          <Txt v="sm" soft>
            {(detail.grund_gesperrt && GESPERRT_TEXT[detail.grund_gesperrt]) ??
              "Nicht mehr beantwortbar"}
            {/* Eine Ableitung nie als Auskunft des Portals ausgeben. */}
            {detail.status_quelle === "abgeleitet" ? " (aus dem Verlauf)" : ""}
          </Txt>
        </>
      ) : !darfEntscheiden ? (
        <>
          <Divider />
          <Txt v="sm" soft>
            Zum Entscheiden fehlt dir die Berechtigung.
          </Txt>
        </>
      ) : (
        <>
          <Divider />
          {offen === null ? (
            <Col gap={8}>
              {aktionen.map((a) => (
                <Btn
                  key={a}
                  variant={a === "annehmen" ? "dark" : "outline"}
                  block
                  onPress={() => {
                    // Aktionen ohne Zusatzangabe gehen direkt raus; die
                    // anderen öffnen ihr Formular.
                    const braucht =
                      a === "ablehnen" ||
                      a === "alteration_ablehnen" ||
                      a === "sonderpreis";
                    if (braucht) setOffen(a);
                    else senden(a);
                  }}
                >
                  {AKTION_TEXT[a]}
                </Btn>
              ))}
            </Col>
          ) : (
            <Col gap={10}>
              <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                {AKTION_TEXT[offen]}
              </Txt>

              {(offen === "ablehnen" || offen === "alteration_ablehnen") && (
                <Col gap={6}>
                  <Txt v="sm" soft>
                    Grund (das Portal erlaubt nur diese vier)
                  </Txt>
                  <Row style={{ flexWrap: "wrap", gap: 8 }}>
                    {ABLEHNUNGSGRUENDE.map((g) => (
                      <Pressable key={g} onPress={() => setGrund(g)}>
                        <Chip variant={grund === g ? "on" : ""}>
                          {GRUND_TEXT[g]}
                        </Chip>
                      </Pressable>
                    ))}
                  </Row>
                </Col>
              )}

              {offen === "sonderpreis" && (
                <TextInput
                  value={preis}
                  onChangeText={setPreis}
                  keyboardType="decimal-pad"
                  placeholder={`Gesamtpreis${detail.waehrung ? ` in ${detail.waehrung}` : ""}`}
                  placeholderTextColor={t.palette.faint}
                  style={{
                    backgroundColor: t.palette.surface,
                    borderWidth: 1,
                    borderColor: t.palette.line,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 16,
                    color: t.palette.ink,
                  }}
                />
              )}

              <TextInput
                value={nachricht}
                onChangeText={setNachricht}
                placeholder="Nachricht an den Gast (optional)"
                placeholderTextColor={t.palette.faint}
                multiline
                style={{
                  backgroundColor: t.palette.surface,
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  minHeight: 72,
                  fontSize: 16,
                  color: t.palette.ink,
                  textAlignVertical: "top",
                }}
              />

              <Row style={{ gap: 8 }}>
                <Btn
                  variant="ghost"
                  onPress={busy ? undefined : () => setOffen(null)}
                >
                  Zurück
                </Btn>
                <View style={{ flex: 1 }}>
                  <Btn
                    variant="dark"
                    block
                    onPress={busy ? undefined : () => senden(offen)}
                  >
                    {busy ? "Wird gesendet …" : "Abschicken"}
                  </Btn>
                </View>
              </Row>
            </Col>
          )}
        </>
      )}
    </Card>
  );
}
