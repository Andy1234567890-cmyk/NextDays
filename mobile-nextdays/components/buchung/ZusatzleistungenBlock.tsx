// Zusatzleistungen einer Buchung: gebuchte Positionen mit Zahlstatus, dazu die
// Katalog-Leistungen des Objekts als Schnell-Auswahl. Gilt für JEDEN Kanal —
// auch bei einer Booking-Buchung wird hier am Portal vorbei verkauft.
//
// Alle Beträge und Mengen rechnet das Backend. Die Menge, die hier gesendet
// wird, IST bei „pro Gast" die Personenzahl und kein Faktor obendrauf.
//
// Grund-Pflicht: Storno und Rücknahme der Bezahlt-Markierung verlangen einen
// Text (Protokoll am Vorgang + Zeitleiste). Ohne Eingabe bleibt der Knopf
// gesperrt — die Anfrage würde sonst mit 422 abgewiesen und wirkte wie ein
// Defekt.
import { useCallback, useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Divider, Row, Txt } from "@/components/ui/kit";
import {
  addReservationAddon,
  addonName,
  availableReservationAddons,
  cancelReservationAddon,
  listReservationAddons,
  markReservationAddonPaid,
  unmarkReservationAddonPaid,
  type Addon,
  type ReservationAddon,
} from "@/lib/addons";
import { formatCurrency } from "@/lib/currency";
import { useTheme } from "@/theme/ThemeProvider";

const STATUS_TEXT: Record<ReservationAddon["status"], string> = {
  pending: "offen",
  paid: "bezahlt",
  cancelled: "storniert",
};

const BASIS_TEXT: Record<Addon["basis"], string> = {
  per_stay: "pro Aufenthalt",
  per_night: "pro Nacht",
  per_guest: "pro Gast",
  per_unit: "pro Stück",
};

export function ZusatzleistungenBlock({
  reservationId,
  // Währung der Buchung als Rückfall, falls der Endpunkt für das Objekt keine
  // liefert. Ist beides leer, wird symbollos gerendert — kein erfundenes
  // Zeichen (Wurzel 4).
  currency,
}: {
  reservationId: string;
  currency: string;
}) {
  const t = useTheme();
  const [positionen, setPositionen] = useState<ReservationAddon[]>([]);
  const [katalog, setKatalog] = useState<Addon[]>([]);
  const [waehrung, setWaehrung] = useState<string | null>(currency || null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Welche Position gerade einen Grund verlangt, und wofür.
  const [grundFuer, setGrundFuer] = useState<
    { id: string; art: "storno" | "unpaid" } | null
  >(null);
  const [grund, setGrund] = useState("");
  const [auswahlOffen, setAuswahlOffen] = useState(false);

  const laden = useCallback(() => {
    const lauf = async () => {
      const [gebucht, verfuegbar] = await Promise.all([
        listReservationAddons(reservationId),
        availableReservationAddons(reservationId),
      ]);
      if (gebucht.ok) {
        setPositionen(gebucht.data.items);
        setWaehrung(gebucht.data.currency ?? currency ?? null);
        setFehler(null);
      } else {
        console.warn(
          `[Zusatzleistungen] nicht geladen (${reservationId}): ${gebucht.error}`,
        );
        setFehler(gebucht.error);
      }
      // Der Katalog ist NICHT kritisch: fehlt er, entfällt nur die
      // Schnell-Auswahl — die gebuchten Positionen bleiben lesbar.
      setKatalog(verfuegbar.ok ? verfuegbar.data.items.filter((a) => a.active) : []);
    };
    lauf();
  }, [reservationId, currency]);

  useEffect(() => {
    laden();
  }, [laden]);

  const betrag = (v: number) => formatCurrency(v, waehrung);

  const buchen = useCallback(
    (addonId: string) => {
      const lauf = async () => {
        setLaeuft(true);
        setFehler(null);
        // qty 0 = „nicht angegeben": der Server setzt die Vorbelegung der
        // Abrechnungsbasis (bei „pro Gast" die Gästezahl der Buchung).
        const res = await addReservationAddon(reservationId, addonId, 0);
        setLaeuft(false);
        if (res.ok) {
          setPositionen(res.data.items);
          setWaehrung(res.data.currency ?? waehrung);
          setAuswahlOffen(false);
        } else {
          setFehler(res.error);
        }
      };
      lauf();
    },
    [reservationId, waehrung],
  );

  const bezahltSetzen = useCallback(
    (id: string) => {
      const lauf = async () => {
        setLaeuft(true);
        setFehler(null);
        const res = await markReservationAddonPaid(id);
        setLaeuft(false);
        if (res.ok) laden();
        else setFehler(res.error);
      };
      lauf();
    },
    [laden],
  );

  const grundAbsenden = useCallback(() => {
    if (!grundFuer || !grund.trim()) return;
    const lauf = async () => {
      setLaeuft(true);
      setFehler(null);
      const res =
        grundFuer.art === "unpaid"
          ? await unmarkReservationAddonPaid(grundFuer.id, grund.trim())
          : await cancelReservationAddon(grundFuer.id, grund.trim());
      setLaeuft(false);
      if (res.ok) {
        setGrundFuer(null);
        setGrund("");
        laden();
      } else {
        setFehler(res.error);
      }
    };
    lauf();
  }, [grundFuer, grund, laden]);

  // Storniertes zählt nicht mit: es steht als Beleg da, ist aber kein Umsatz.
  const summe = positionen
    .filter((p) => p.status !== "cancelled")
    .reduce((s, p) => s + p.total, 0);

  return (
    <Col gap={10}>
      {fehler ? (
        <Txt v="sm" color={t.palette.accent}>
          {fehler}
        </Txt>
      ) : null}

      {positionen.length === 0 ? (
        <Txt v="sm" soft>
          Keine Zusatzleistungen gebucht.
        </Txt>
      ) : (
        <Col gap={0}>
          {positionen.map((p, i) => (
            <View key={p.id}>
              {i > 0 && <Divider />}
              <Col gap={6} style={{ paddingVertical: 10 }}>
                <Row gap={8} style={{ alignItems: "flex-start" }}>
                  <Col gap={2} style={{ flex: 1 }}>
                    <Txt
                      v="title"
                      numberOfLines={2}
                      style={
                        p.status === "cancelled"
                          ? { textDecorationLine: "line-through" }
                          : undefined
                      }
                    >
                      {p.qty > 1 ? `${p.qty}× ` : ""}
                      {addonName(p.name)}
                    </Txt>
                    <Txt v="xs" soft>
                      {BASIS_TEXT[p.basis]} · {STATUS_TEXT[p.status]}
                      {p.cancel_reason ? ` · ${p.cancel_reason}` : ""}
                    </Txt>
                  </Col>
                  <Txt v="title" style={{ flexShrink: 0 }}>
                    {betrag(p.total)}
                  </Txt>
                </Row>

                {/* Aktionen nur, wo sie etwas bewirken: eine stornierte
                    Position ist abgeschlossen (Wurzel 4 — kein Knopf ohne
                    Wirkung). */}
                {p.status !== "cancelled" && (
                  <Row gap={8} style={{ flexWrap: "wrap" }}>
                    {p.status === "pending" ? (
                      <KleinKnopf
                        icon="check"
                        label="Als bezahlt"
                        laeuft={laeuft}
                        onPress={() => bezahltSetzen(p.id)}
                      />
                    ) : (
                      <KleinKnopf
                        icon="back"
                        label="Bezahlt zurücknehmen"
                        laeuft={laeuft}
                        onPress={() => {
                          setGrundFuer({ id: p.id, art: "unpaid" });
                          setGrund("");
                        }}
                      />
                    )}
                    <KleinKnopf
                      icon="x"
                      label="Stornieren"
                      laeuft={laeuft}
                      warn
                      onPress={() => {
                        setGrundFuer({ id: p.id, art: "storno" });
                        setGrund("");
                      }}
                    />
                  </Row>
                )}

                {grundFuer?.id === p.id && (
                  <Card style={{ padding: 12 }}>
                    <Col gap={8}>
                      <Txt v="xs" soft>
                        {grundFuer.art === "unpaid"
                          ? "Warum wird die Bezahlt-Markierung zurückgenommen? (Pflicht)"
                          : "Warum wird die Position storniert? (Pflicht)"}
                      </Txt>
                      <TextInput
                        value={grund}
                        onChangeText={setGrund}
                        multiline
                        autoFocus
                        placeholder="Grund"
                        placeholderTextColor={t.palette.faint}
                        style={{
                          minHeight: 62,
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
                      <Row gap={8}>
                        <Btn
                          variant="outline"
                          style={{ flex: 1, paddingVertical: 11 }}
                          disabled={laeuft}
                          onPress={() => {
                            setGrundFuer(null);
                            setGrund("");
                          }}
                        >
                          Abbrechen
                        </Btn>
                        <Btn
                          style={{ flex: 1, paddingVertical: 11 }}
                          disabled={laeuft || !grund.trim()}
                          onPress={grundAbsenden}
                        >
                          {laeuft ? "…" : "Bestätigen"}
                        </Btn>
                      </Row>
                    </Col>
                  </Card>
                )}
              </Col>
            </View>
          ))}

          <Divider />
          <Row style={{ paddingTop: 10, justifyContent: "space-between" }}>
            <Txt v="title">Summe</Txt>
            <Txt v="title">{betrag(summe)}</Txt>
          </Row>
        </Col>
      )}

      {/* Schnell-Auswahl aus dem Katalog des Objekts. Ohne aktive Leistungen
          erscheint der Knopf nicht — er würde in eine leere Liste führen. */}
      {katalog.length > 0 &&
        (auswahlOffen ? (
          <Col gap={8}>
            {katalog.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                disabled={laeuft}
                onPress={() => buchen(a.id)}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  borderRadius: t.radius.card,
                  padding: 12,
                  opacity: pressed || laeuft ? 0.6 : 1,
                })}
              >
                <Row gap={10} style={{ alignItems: "center" }}>
                  <Icon n="plus" s={16} sw={2} c={t.palette.accent} />
                  <Col gap={1} style={{ flex: 1 }}>
                    <Txt v="title" numberOfLines={1}>
                      {addonName(a.name)}
                    </Txt>
                    <Txt v="xs" soft>
                      {formatCurrency(a.price, waehrung)} · {BASIS_TEXT[a.basis]}
                    </Txt>
                  </Col>
                </Row>
              </Pressable>
            ))}
            <Btn variant="outline" block onPress={() => setAuswahlOffen(false)}>
              Schließen
            </Btn>
          </Col>
        ) : (
          <Btn
            variant="outline"
            block
            icon="plus"
            disabled={laeuft}
            onPress={() => setAuswahlOffen(true)}
          >
            Zusatzleistung buchen
          </Btn>
        ))}
    </Col>
  );
}

// Kleiner Zeilen-Knopf. Eigene Form, nicht `Btn`: der ist eine
// Haupthandlungs-Pille (15 Punkte hoch) und würde drei Stück pro Position zu
// einer Knopfwand machen.
function KleinKnopf({
  icon,
  label,
  laeuft,
  warn,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]["n"];
  label: string;
  laeuft: boolean;
  warn?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const farbe = warn ? t.palette.accent : t.palette.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={laeuft}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 11,
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: t.palette.line,
        opacity: pressed || laeuft ? 0.6 : 1,
      })}
    >
      <Icon n={icon} s={13} sw={2} c={farbe} />
      <Txt v="xs" color={farbe}>
        {label}
      </Txt>
    </Pressable>
  );
}
