// Objekt vor Ort anlegen — der Bogen, den die Agentur beim Kunden ausfüllt.
//
// WARUM SO KURZ: der Web-Stepper hat neun Stufen und über hundert Felder. Wer
// beim Kunden am Küchentisch sitzt, füllt die nicht aus. Hier stehen genau die
// Angaben, die in diesem Moment ohnehin fallen — Name, Art, Gäste, Adresse —
// und von denen der Server nur EINE wirklich verlangt (`title`). Alles Weitere
// wird später in der Kartei ergänzt; ein Pflichtfeld mehr hiesse hier nur, dass
// jemand etwas hineinschreibt, um weiterzukommen (Wurzel 4).
//
// Das Objekt entsteht als ENTWURF: `status` wird nicht mitgesendet, der Server
// setzt seinen Standard `draft`. Es geht also nichts in den Verkauf, nur weil
// jemand vor Ort getippt hat — veröffentlicht wird bewusst und später.
import { useState } from "react";
import { TextInput, View } from "react-native";

import { Btn, Col, Row, Txt } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/patterns";
import {
  anlageNutzlast,
  createProperty,
  propertyTypeLabel,
  type Property,
} from "@/lib/properties";
import { useTheme } from "@/theme/ThemeProvider";

// Dieselben Werte wie das Backend-Enum `PropertyType`
// (apps/api/.../properties/schemas.py). Getrennt nach Betriebsart: eine
// FeWo-Agentur soll nicht durch sechs Hotelzimmer-Typen scrollen.
const FEWO_TYPEN = [
  "ferienhaus",
  "appartement",
  "glamping",
  "tiny_house",
  "stellplatz",
  "hausboot",
] as const;

const HOTEL_TYPEN = [
  "einzelzimmer",
  "doppelzimmer",
  "zweibettzimmer",
  "familienzimmer",
  "junior_suite",
  "suite",
] as const;

export function ObjektAnlegen({
  offen,
  onSchliessen,
  onAngelegt,
}: {
  offen: boolean;
  onSchliessen: () => void;
  /** Das angelegte Objekt — der Aufrufer springt damit weiter. */
  onAngelegt: (p: Property) => void;
}) {
  const [titel, setTitel] = useState("");
  const [typ, setTyp] = useState<string>("ferienhaus");
  const [gaeste, setGaeste] = useState("2");
  const [strasse, setStrasse] = useState("");
  const [hausnummer, setHausnummer] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");
  const [hotelTypen, setHotelTypen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const zuruecksetzen = () => {
    setTitel("");
    setTyp("ferienhaus");
    setGaeste("2");
    setStrasse("");
    setHausnummer("");
    setPlz("");
    setOrt("");
    setHotelTypen(false);
    setFehler(null);
  };

  const anlegen = async () => {
    if (busy) return;
    const name = titel.trim();
    if (!name) {
      setFehler("Ohne Namen lässt sich das Objekt später nicht wiederfinden.");
      return;
    }
    setBusy(true);
    setFehler(null);
    const res = await createProperty(
      anlageNutzlast({ titel: name, typ, gaeste, strasse, hausnummer, plz, ort }),
    );
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    zuruecksetzen();
    onAngelegt(res.data);
  };

  const typen = hotelTypen ? HOTEL_TYPEN : FEWO_TYPEN;

  return (
    <Sheet
      open={offen}
      onClose={() => {
        // Während des Anlegens nicht schliessen: der Aufruf läuft weiter und
        // das Ergebnis fiele ins Leere.
        if (busy) return;
        zuruecksetzen();
        onSchliessen();
      }}
      full
      header={
        <Col gap={2}>
          <Txt v="h2">Neues Objekt</Txt>
          <Txt v="sm" soft>
            Entwurf — nichts geht damit in den Verkauf.
          </Txt>
        </Col>
      }
    >
      <Col gap={18} style={{ paddingBottom: 24 }}>
        <Feld
          label="Name"
          hinweis="So heißt das Objekt in deiner Liste."
          wert={titel}
          setWert={setTitel}
          platzhalter="z. B. Ferienhaus Kornblomst"
        />

        <Col gap={8}>
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Txt v="sm" style={{ fontWeight: "600" }}>
              Art
            </Txt>
            <Btn
              variant="ghost"
              onPress={() => {
                setTyp(hotelTypen ? "ferienhaus" : "doppelzimmer");
                setHotelTypen((v) => !v);
              }}
            >
              {hotelTypen ? "Ferienobjekte" : "Hotelzimmer"}
            </Btn>
          </Row>
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            {typen.map((k) => (
              <Btn
                key={k}
                variant={typ === k ? "primary" : "outline"}
                onPress={() => setTyp(k)}
              >
                {propertyTypeLabel(k)}
              </Btn>
            ))}
          </Row>
        </Col>

        <Feld
          label="Gäste"
          hinweis="Wie viele Personen schlafen hier höchstens?"
          wert={gaeste}
          setWert={setGaeste}
          keyboard="number-pad"
          platzhalter="2"
        />

        <Col gap={8}>
          <Txt v="sm" style={{ fontWeight: "600" }}>
            Adresse
          </Txt>
          <Row gap={8}>
            <View style={{ flex: 3 }}>
              <Eingabe wert={strasse} setWert={setStrasse} platzhalter="Straße" />
            </View>
            <View style={{ flex: 1 }}>
              <Eingabe wert={hausnummer} setWert={setHausnummer} platzhalter="Nr." />
            </View>
          </Row>
          <Row gap={8}>
            <View style={{ flex: 1 }}>
              <Eingabe wert={plz} setWert={setPlz} platzhalter="PLZ" keyboard="number-pad" />
            </View>
            <View style={{ flex: 3 }}>
              <Eingabe wert={ort} setWert={setOrt} platzhalter="Ort" />
            </View>
          </Row>
          <Txt v="xs" soft>
            Kann später ergänzt werden — für die Portale wird sie aber gebraucht.
          </Txt>
        </Col>

        {fehler && (
          <Txt v="sm" soft>
            {fehler}
          </Txt>
        )}

        <Btn variant="primary" block onPress={anlegen} disabled={busy}>
          {busy ? "Wird angelegt …" : "Anlegen und öffnen"}
        </Btn>
      </Col>
    </Sheet>
  );
}

function Feld({
  label,
  hinweis,
  wert,
  setWert,
  platzhalter,
  keyboard,
}: {
  label: string;
  hinweis?: string;
  wert: string;
  setWert: (v: string) => void;
  platzhalter?: string;
  keyboard?: "default" | "number-pad";
}) {
  return (
    <Col gap={6}>
      <Txt v="sm" style={{ fontWeight: "600" }}>
        {label}
      </Txt>
      <Eingabe wert={wert} setWert={setWert} platzhalter={platzhalter} keyboard={keyboard} />
      {hinweis && (
        <Txt v="xs" soft>
          {hinweis}
        </Txt>
      )}
    </Col>
  );
}

function Eingabe({
  wert,
  setWert,
  platzhalter,
  keyboard,
}: {
  wert: string;
  setWert: (v: string) => void;
  platzhalter?: string;
  keyboard?: "default" | "number-pad";
}) {
  const t = useTheme();
  return (
    <TextInput
      value={wert}
      onChangeText={setWert}
      placeholder={platzhalter}
      placeholderTextColor={t.palette.soft}
      keyboardType={keyboard ?? "default"}
      style={{
        borderWidth: 1,
        borderColor: t.palette.line,
        borderRadius: t.radius.pill,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: t.palette.ink,
        fontSize: 15,
      }}
    />
  );
}
