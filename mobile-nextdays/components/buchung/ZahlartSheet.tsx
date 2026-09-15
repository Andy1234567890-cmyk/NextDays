// Zahlart-Abfrage beim Check-out. Dieselbe fachliche Bedeutung wie im Web
// (`checkout-payment-dialog`): der Check-out erzeugt verpflichtend die finale
// Rechnung, und ihr Zahlstatus hängt an dieser Angabe.
//   bar/Karte  → am Empfang bezahlt → Rechnung sofort 'paid'
//   Rechnung   → Zahlung auf Rechnung (Überweisung) → 'finalized'
// Die Kartenmarke ist nur bei Karte eine Angabe; ohne Auswahl bleibt sie null
// (kein „Visa" als Vorbelegung, Wurzel 4).
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Col, Row, Txt } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/patterns";
import type { CheckOutPayment } from "@/lib/reservations";
import { useTheme } from "@/theme/ThemeProvider";

const ARTEN: { wert: CheckOutPayment["payment_method"]; label: string; hinweis: string; icon: IconName }[] = [
  // „hand" statt des €-Glyphs: bar bezahlt wird in jeder Währung (Wurzel 4).
  { wert: "cash", label: "Bar", hinweis: "Am Empfang bezahlt", icon: "hand" },
  { wert: "card", label: "Karte", hinweis: "Am Empfang bezahlt", icon: "card" },
  {
    wert: "invoice",
    label: "Auf Rechnung",
    hinweis: "Zahlung per Überweisung",
    icon: "doc",
  },
];

// Die Marken, die an einem Empfang tatsächlich vorkommen. Freitext wäre hier
// falsch: der Wert landet auf der Rechnung.
const MARKEN = ["Visa", "Mastercard", "Amex", "Maestro", "Dankort"];

export function ZahlartSheet({
  offen,
  laeuft,
  onAbbrechen,
  onBestaetigen,
}: {
  offen: boolean;
  laeuft: boolean;
  onAbbrechen: () => void;
  onBestaetigen: (payment: CheckOutPayment) => void;
}) {
  const t = useTheme();
  const [art, setArt] = useState<CheckOutPayment["payment_method"]>("invoice");
  const [marke, setMarke] = useState<string | null>(null);

  return (
    <Sheet
      open={offen}
      onClose={onAbbrechen}
      header={
        <Col gap={2}>
          <Txt v="h2">Zahlart</Txt>
          <Txt v="xs" soft>
            Der Check-out erstellt die finale Rechnung.
          </Txt>
        </Col>
      }
    >
      <Col style={{ padding: 20, gap: 10 }}>
        {ARTEN.map((a) => {
          const an = a.wert === art;
          return (
            <Pressable
              key={a.wert}
              accessibilityRole="radio"
              accessibilityState={{ selected: an }}
              onPress={() => {
                setArt(a.wert);
                // Marke gilt nur zur Karte — bei einem Wechsel weg von Karte
                // muss sie mit weg, sonst landet sie auf einer Barzahlung
                // (Wurzel 1: der Gegenzustand wird mitgepflegt).
                if (a.wert !== "card") setMarke(null);
              }}
              style={({ pressed }) => ({
                borderWidth: an ? 2 : 1,
                borderColor: an ? t.palette.ink : t.palette.line,
                borderRadius: t.radius.card,
                padding: 14,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Row gap={12} style={{ alignItems: "center" }}>
                <Icon n={a.icon} s={18} sw={1.8} c={t.palette.ink} />
                <Col gap={1} style={{ flex: 1 }}>
                  <Txt v="title">{a.label}</Txt>
                  <Txt v="xs" soft>
                    {a.hinweis}
                  </Txt>
                </Col>
                {an && <Icon n="check" s={17} sw={2.2} c={t.palette.accent} />}
              </Row>
            </Pressable>
          );
        })}

        {art === "card" && (
          <Col gap={8}>
            <Txt v="xs" soft>
              Kartenmarke (optional)
            </Txt>
            <Row gap={8} style={{ flexWrap: "wrap" }}>
              {MARKEN.map((m) => {
                const an = m === marke;
                return (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityState={{ selected: an }}
                    onPress={() => setMarke(an ? null : m)}
                    style={({ pressed }) => ({
                      paddingVertical: 7,
                      paddingHorizontal: 13,
                      borderRadius: t.radius.pill,
                      borderWidth: 1,
                      borderColor: an ? t.palette.accent : t.palette.line,
                      backgroundColor: an ? t.palette.accent : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Txt v="xs" color={an ? t.palette.accentInk : t.palette.ink}>
                      {m}
                    </Txt>
                  </Pressable>
                );
              })}
            </Row>
          </Col>
        )}

        <View style={{ height: 4 }} />
        <Btn
          block
          disabled={laeuft}
          onPress={() =>
            onBestaetigen({ payment_method: art, card_brand: marke })
          }
        >
          {laeuft ? "Checke aus…" : "Check-out abschließen"}
        </Btn>
        <Btn block variant="outline" disabled={laeuft} onPress={onAbbrechen}>
          Abbrechen
        </Btn>
      </Col>
    </Sheet>
  );
}
