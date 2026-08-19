// Die vollständige Buchungsansicht als Panel, das von RECHTS einfährt — EIN
// Baustein für alle Einstiege (Kalender, Buchungsliste, Übersicht).
//
// Inhaltlich derselbe Umfang wie der Web-Slider
// (`web/components/kalender/reservation-detail-slider.tsx`) und aus derselben
// Quelle (`GET /reservations/{id}` + Realtime auf diese Buchung), aber anders
// gesetzt: dort stehen zehn Abschnitte offen untereinander, was am Telefon eine
// Scrollstrecke ohne Orientierung wäre. Hier stehen Kopf, Aufenthalt und die
// EINE fällige Handlung oben; die Tiefe liegt in aufklappbaren Zeilen — das
// Muster, das Hostaway und Lodgify in ihren Apps verwenden.
//
// Schließen: Knopf, Wisch nach rechts, Antippen der Abdunkelung, Android-Zurück.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KanalMarke } from "@/components/KanalMarke";
import { Angabe, Aufklapper } from "@/components/buchung/Aufklapper";
import { ZahlartSheet } from "@/components/buchung/ZahlartSheet";
import { ZusatzleistungenBlock } from "@/components/buchung/ZusatzleistungenBlock";
import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { STATUS_LABEL, STATUS_TONE, anzeigeStatus } from "@/lib/buchungsstatus";
import { channelMeta } from "@/lib/calendar-channels";
import { formatCurrency } from "@/lib/currency";
import { naechte, tagKurz, tagTeile } from "@/lib/kalendertag";
import { portalLabel } from "@/lib/portal-logos";
import { useBuchungsDetail } from "@/lib/use-buchungsdetail";
import { useTheme } from "@/theme/ThemeProvider";

// Ab dieser Wischstrecke nach rechts schließt das Panel. Kürzer wäre es
// versehentlich beim Scrollen ausgelöst, länger fühlt es sich klemmig an.
const WISCH_SCHWELLE = 90;

/** Datum mit Jahr — im Panel steht der Aufenthalt vollständig, nicht gekürzt. */
function tagLang(iso: string): string {
  const { tag, monat } = tagTeile(iso);
  return `${tag}. ${monat} ${iso.slice(0, 4)}`;
}

/**
 * Ein Betrag aus dem Portal-JSON. Booking liefert ihn als String ("4268.00"),
 * andere als Zahl — beides muss hier ankommen dürfen. Unlesbares ergibt null
 * (dann steht „—" da), nie 0: „kostenfrei" ist eine andere Aussage als
 * „unbekannt" (Wurzel 4).
 */
function portalBetrag(wert: string | number | null): number | null {
  if (wert == null) return null;
  const zahl = typeof wert === "number" ? wert : Number.parseFloat(wert);
  return Number.isFinite(zahl) ? zahl : null;
}

/** Zeitpunkt mit Uhrzeit (Check-in-/Check-out-Protokoll). */
function zeitpunkt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BuchungsPanel({
  reservationId,
  // Der heutige Kalendertag (YYYY-MM-DD) — entscheidet, ob Check-in vorzeitig
  // wäre und ob der Check-out schon erlaubt ist. Kommt von außen, damit Panel
  // und aufrufende Liste denselben Tag zugrunde legen.
  heuteIso,
  onClose,
  onGeaendert,
  onNachrichtOeffnen,
}: {
  reservationId: string;
  heuteIso: string;
  onClose: () => void;
  /** Nach jeder erfolgreichen Aktion — Kalender/Liste dahinter neu laden. */
  onGeaendert?: () => void;
  /**
   * In den Posteingang-Thread dieser Buchung wechseln. Fehlt der Rückweg, wird
   * der Knopf nicht angezeigt: er würde ins Leere führen (Wurzel 4). Das Panel
   * navigiert nicht selbst — es kennt den Navigator nicht und soll ihn nicht
   * kennen.
   */
  onNachrichtOeffnen?: (threadId: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const d = useBuchungsDetail(reservationId, {
    onGeaendert,
    // Nach einem Storno schließt das Panel: die Buchung, die es zeigt, ist
    // beendet. Check-in/out schließen NICHT — dort will man das Ergebnis
    // (Rechnungsnummer) noch sehen.
    onStorniert: onClose,
  });
  const { data } = d;

  const [zahlartOffen, setZahlartOffen] = useState(false);
  const [frueherBestaetigen, setFrueherBestaetigen] = useState(false);
  const [stornoOffen, setStornoOffen] = useState(false);
  const [stornoGrund, setStornoGrund] = useState("");
  const [ablehnenOffen, setAblehnenOffen] = useState(false);
  const [ablehnenGrund, setAblehnenGrund] = useState("");

  // Einfahren von rechts. `useNativeDriver` hält die Bewegung im UI-Thread,
  // damit sie nicht ruckelt, während das Detail nachgeladen wird.
  const x = useRef(new Animated.Value(width)).current;
  const [sichtbar, setSichtbar] = useState(true);

  useEffect(() => {
    Animated.timing(x, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [x]);

  // Erst hinausfahren, dann melden: würde `onClose` sofort laufen, verschwände
  // das Panel hart und die Bewegung wäre nie zu sehen.
  const schliessen = useCallback(() => {
    Animated.timing(x, {
      toValue: width,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setSichtbar(false);
      onClose();
    });
  }, [x, width, onClose]);

  // Wischen nach rechts. Der Responder greift erst ab 12 Punkten horizontaler
  // Bewegung UND nur, wenn sie deutlicher als die vertikale ist — sonst würde
  // jeder Scrollversuch das Panel wegziehen.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_e, g) => {
        if (g.dx > 0) x.setValue(g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx > WISCH_SCHWELLE) {
          Animated.timing(x, {
            toValue: width,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            setSichtbar(false);
            onClose();
          });
        } else {
          Animated.spring(x, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    }),
  ).current;

  const status = data
    ? anzeigeStatus(data.status, data.checked_in_at, data.checked_out_at)
    : null;
  const istStorniert = data?.status === "cancelled";
  const istEigennutzung = !!data?.is_owner_stay;
  // Eine Portal-Buchung erkennt man am Kanal, nicht am Namen: „portal" sammelt
  // über 40 OTAs.
  const istOta = !!data && data.channel !== "direct" && data.channel !== "website";
  const betrag = (v: number | null | undefined) =>
    v == null ? "—" : formatCurrency(v, data?.currency ?? null);

  // Portal-Angaben: die Struktur gehört dem Portal. Fehlt alles, entfällt der
  // Abschnitt — eine leere Karte „Angaben des Portals" wäre kein Inhalt.
  const staffel = data?.ota_cancel_penalties ?? [];
  const portalDetails = data?.ota_details ?? {};
  const raum = portalDetails.rooms?.[0];
  const hatPortalAngaben =
    staffel.length > 0 ||
    !!data?.ota_notes ||
    !!raum?.policies ||
    !!raum?.meal_plan ||
    !!portalDetails.arrival_hour ||
    (portalDetails.guest_labels?.length ?? 0) > 0;

  return (
    <Modal
      visible={sichtbar}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={schliessen}
    >
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Abdunkelung: schließt bei Antippen und macht sichtbar, dass die
            Ansicht ÜBER dem Kalender liegt, statt ihn zu ersetzen. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buchung schließen"
          onPress={schliessen}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
        />

        <Animated.View
          {...pan.panHandlers}
          style={{
            // Nicht die volle Breite: der Streifen links zeigt, dass der
            // Kalender darunter weiterlebt, und gibt eine zweite Fläche zum
            // Schließen. Auf schmalen Geräten bleibt trotzdem genug Platz.
            width: Math.min(width * 0.94, width - 28),
            backgroundColor: t.palette.bg,
            transform: [{ translateX: x }],
            ...t.shadow.card,
          }}
        >
          {/* Kopf */}
          <Row
            style={{
              alignItems: "flex-start",
              gap: 12,
              paddingTop: insets.top + 12,
              paddingHorizontal: 18,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: t.palette.line,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              onPress={schliessen}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.palette.surface2,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {/* „×", nicht der Pfeil nach rechts: das Panel liegt ÜBER dem
                  Kalender, es ist keine Station in einem Weg, aus dem man
                  „vorwärts" ginge. Der Pfeil las sich wie „weiter". */}
              <Icon n="x" s={17} sw={2.2} c={t.palette.ink} />
            </Pressable>
            <Col gap={2} style={{ flex: 1 }}>
              <Txt v="xs" soft>
                Buchung
              </Txt>
              <Txt v="h2" numberOfLines={1}>
                {d.error
                  ? "Fehler"
                  : data
                    ? data.guest_name?.trim() || data.property_title || "Buchung"
                    : "Lädt…"}
              </Txt>
              {data && (
                <Txt v="xs" soft numberOfLines={1}>
                  {[
                    data.external_ref ? `#${data.external_ref}` : data.id.slice(0, 8),
                    // Der Buchungszeitpunkt aus der QUELLE, wenn es ihn gibt;
                    // sonst ausdrücklich unser Eingang. Beides gleich zu
                    // beschriften wäre eine Falschaussage (Wurzel 5b).
                    data.booked_at
                      ? `gebucht ${tagKurz(data.booked_at.slice(0, 10))}`
                      : data.created_at
                        ? `bei uns ${tagKurz(data.created_at.slice(0, 10))}`
                        : null,
                    data.ota_name ? portalLabel(data.ota_name) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Txt>
              )}
            </Col>
          </Row>

          {d.error ? (
            <Col style={{ padding: 18, gap: 12 }}>
              <Txt v="body" color={t.palette.accent}>
                {d.error}
              </Txt>
              <Btn variant="outline" onPress={d.neuLaden}>
                Erneut versuchen
              </Btn>
            </Col>
          ) : !data ? (
            <View style={{ paddingTop: 40 }}>
              <Spinner />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 16,
                paddingBottom: insets.bottom + 40,
                gap: 14,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Status + Herkunft */}
              <Row gap={8} style={{ alignItems: "center", flexWrap: "wrap" }}>
                {status && (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: t.radius.pill,
                      backgroundColor: STATUS_TONE[status].bg,
                    }}
                  >
                    <Txt
                      v="xs"
                      color={STATUS_TONE[status].fg}
                      style={{ fontFamily: t.fonts.semibold }}
                    >
                      {STATUS_LABEL[status]}
                    </Txt>
                  </View>
                )}
                {/* Eine Eigennutzung kam über KEINEN Vertriebsweg — ein
                    „Direkt"-Abzeichen wäre dort irreführend. */}
                {istEigennutzung ? (
                  <Row
                    gap={5}
                    style={{
                      alignItems: "center",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: t.radius.pill,
                      borderWidth: 1.5,
                      borderColor: t.palette.ink,
                    }}
                  >
                    <Icon n="home" s={12} sw={2} c={t.palette.ink} />
                    <Txt v="xs" style={{ fontFamily: t.fonts.semibold }}>
                      Eigentümer-Aufenthalt
                    </Txt>
                  </Row>
                ) : (
                  <Row gap={6} style={{ alignItems: "center" }}>
                    <KanalMarke channel={data.channel} hoehe={18} />
                    <Txt v="xs" soft>
                      {portalLabel(data.ota_name) || channelMeta(data.channel).label}
                    </Txt>
                  </Row>
                )}
              </Row>

              {istEigennutzung && (
                <Txt v="sm" soft>
                  Eine Eigennutzung belegt den Kalender, erzeugt aber keinen
                  Umsatz — deshalb stehen hier keine Beträge und keine Rechnung.
                </Txt>
              )}

              {/* Objekt + Belegung */}
              <Col gap={3}>
                <Txt v="title">{data.property_title || "Objekt"}</Txt>
                <Txt v="sm" soft>
                  {data.num_guests} {data.num_guests === 1 ? "Gast" : "Gäste"}
                  {[
                    data.adults ? `${data.adults} Erw.` : null,
                    data.children ? `${data.children} Ki.` : null,
                    data.infants ? `${data.infants} Kleink.` : null,
                    data.pets ? `${data.pets} Tier` : null,
                  ].filter(Boolean).length
                    ? ` (${[
                        data.adults ? `${data.adults} Erw.` : null,
                        data.children ? `${data.children} Ki.` : null,
                        data.infants ? `${data.infants} Kleink.` : null,
                        data.pets ? `${data.pets} Tier` : null,
                      ]
                        .filter(Boolean)
                        .join(", ")})`
                    : ""}
                </Txt>
                {[data.property_street, data.property_postal_code, data.property_city]
                  .filter(Boolean).length > 0 && (
                  <Txt v="xs" soft numberOfLines={2}>
                    {[
                      data.property_street,
                      [data.property_postal_code, data.property_city]
                        .filter(Boolean)
                        .join(" "),
                      data.property_country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </Txt>
                )}
              </Col>

              {/* Aufenthaltsband */}
              <Card style={{ padding: 14 }}>
                <Row style={{ alignItems: "center", gap: 12 }}>
                  <Col gap={2} style={{ flex: 1 }}>
                    <Txt v="xs" soft>
                      Anreise
                    </Txt>
                    <Txt v="title">{tagLang(data.check_in)}</Txt>
                    {data.checkin_time ? (
                      <Txt v="xs" soft>
                        ab {data.checkin_time}
                      </Txt>
                    ) : null}
                  </Col>
                  <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />
                  <Col gap={2} style={{ flex: 1 }}>
                    <Txt v="xs" soft>
                      Abreise
                    </Txt>
                    <Txt v="title">{tagLang(data.check_out)}</Txt>
                    {data.checkout_time ? (
                      <Txt v="xs" soft>
                        bis {data.checkout_time}
                      </Txt>
                    ) : null}
                  </Col>
                </Row>
                <Divider style={{ marginVertical: 12 }} />
                <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                  <Txt v="sm" soft>
                    {data.nights || naechte(data.check_in, data.check_out)}{" "}
                    {(data.nights || naechte(data.check_in, data.check_out)) === 1
                      ? "Nacht"
                      : "Nächte"}
                  </Txt>
                  {!istEigennutzung && (
                    <Txt v="h1">{betrag(data.total_amount)}</Txt>
                  )}
                </Row>
              </Card>

              {(data.checked_in_at || data.checked_out_at) && (
                <Txt v="xs" soft>
                  {data.checked_in_at
                    ? `Eingecheckt seit ${zeitpunkt(data.checked_in_at)}`
                    : ""}
                  {data.checked_out_at
                    ? `${data.checked_in_at ? " · " : ""}Ausgecheckt am ${zeitpunkt(data.checked_out_at)}`
                    : ""}
                </Txt>
              )}

              {/* Die EINE fällige Handlung steht oben — nicht in einer Reihe
                  gleichrangiger Knöpfe. Was fällig ist, entscheidet der
                  Zustand, nicht der Nutzer. */}
              {/* Eine Anfrage (Airbnb „Request to Book") wartet auf eine
                  Entscheidung — DAS ist hier die fällige Handlung, nicht der
                  Check-in. Annehmen sperrt die Nächte an den Portalen, Ablehnen
                  gibt sie frei; beide Gegenzustände pflegt der Server. */}
              {!istStorniert && !istEigennutzung && data.status === "pending" && (
                <Col gap={8}>
                  <Btn
                    block
                    icon="check"
                    disabled={d.aktionLaeuft}
                    onPress={() => d.annehmen()}
                  >
                    {d.aktionLaeuft ? "Nehme an…" : "Anfrage annehmen"}
                  </Btn>
                  {ablehnenOffen ? (
                    <Card style={{ padding: 14 }}>
                      <Col gap={10}>
                        <Txt v="title">Anfrage ablehnen</Txt>
                        {/* Anders als beim Storno ist die Begründung hier
                            FREIWILLIG (so der Endpunkt) — sie geht an den Gast.
                            Ein Pflichtfeld zu erfinden, das der Server nicht
                            verlangt, wäre eine eigene Regel. */}
                        <TextInput
                          value={ablehnenGrund}
                          onChangeText={setAblehnenGrund}
                          multiline
                          placeholder="Begründung für den Gast (optional)"
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
                            disabled={d.aktionLaeuft}
                            onPress={() => {
                              setAblehnenOffen(false);
                              setAblehnenGrund("");
                            }}
                          >
                            Zurück
                          </Btn>
                          <Btn
                            style={{ flex: 1, paddingVertical: 11 }}
                            disabled={d.aktionLaeuft}
                            onPress={() => d.ablehnen(ablehnenGrund.trim() || undefined)}
                          >
                            {d.aktionLaeuft ? "Lehne ab…" : "Ablehnen"}
                          </Btn>
                        </Row>
                      </Col>
                    </Card>
                  ) : (
                    <Btn
                      variant="outline"
                      block
                      icon="x"
                      disabled={d.aktionLaeuft}
                      onPress={() => setAblehnenOffen(true)}
                    >
                      Anfrage ablehnen
                    </Btn>
                  )}
                  {d.aktionFehler && (
                    <Card style={{ padding: 12 }}>
                      <Txt v="sm" color={t.palette.accent}>
                        {d.aktionFehler}
                      </Txt>
                    </Card>
                  )}
                </Col>
              )}

              {!istStorniert && !istEigennutzung && !d.checkOutErgebnis && (
                <Col gap={8}>
                  {!data.checked_in_at && data.status === "confirmed" && (
                    <>
                      {!frueherBestaetigen ? (
                        <Btn
                          block
                          icon="key"
                          disabled={d.aktionLaeuft}
                          onPress={() =>
                            heuteIso < data.check_in
                              ? setFrueherBestaetigen(true)
                              : d.einchecken()
                          }
                        >
                          {d.aktionLaeuft ? "Checke ein…" : "Gast einchecken"}
                        </Btn>
                      ) : (
                        <Card style={{ padding: 14 }}>
                          <Col gap={10}>
                            <Txt v="sm">
                              Die Anreise ist erst am {tagLang(data.check_in)} —
                              den Gast trotzdem jetzt einchecken?
                            </Txt>
                            <Row gap={8}>
                              <Btn
                                variant="outline"
                                style={{ flex: 1, paddingVertical: 11 }}
                                disabled={d.aktionLaeuft}
                                onPress={() => setFrueherBestaetigen(false)}
                              >
                                Abbrechen
                              </Btn>
                              <Btn
                                style={{ flex: 1, paddingVertical: 11 }}
                                disabled={d.aktionLaeuft}
                                onPress={() => {
                                  setFrueherBestaetigen(false);
                                  d.einchecken();
                                }}
                              >
                                Ja, einchecken
                              </Btn>
                            </Row>
                          </Col>
                        </Card>
                      )}
                    </>
                  )}

                  {data.checked_in_at &&
                    !data.checked_out_at &&
                    (heuteIso >= data.check_out ? (
                      <Btn
                        block
                        icon="logout"
                        disabled={d.aktionLaeuft}
                        onPress={() => setZahlartOffen(true)}
                      >
                        {d.aktionLaeuft ? "Checke aus…" : "Check-out + Rechnung"}
                      </Btn>
                    ) : (
                      // Kein Knopf, der nichts darf: der Check-out ist erst am
                      // Abreisetag möglich, eine frühere Abreise läuft über das
                      // Verkürzen des Aufenthalts.
                      <Card style={{ padding: 12 }}>
                        <Txt v="sm" soft>
                          Check-out und finale Rechnung ab dem Abreisetag (
                          {tagLang(data.check_out)}). Reist der Gast früher ab,
                          zuerst den Aufenthalt verkürzen.
                        </Txt>
                      </Card>
                    ))}

                  {d.aktionFehler && (
                    <Card style={{ padding: 12 }}>
                      <Txt v="sm" color={t.palette.accent}>
                        {d.aktionFehler}
                      </Txt>
                    </Card>
                  )}
                </Col>
              )}

              {/* Ergebnis des Check-outs: die Rechnungsnummer ist der Beleg der
                  Aktion und bleibt stehen, bis das Panel geschlossen wird. */}
              {d.checkOutErgebnis && (
                <Card style={{ padding: 14 }}>
                  <Row gap={8} style={{ alignItems: "flex-start" }}>
                    <Icon n="check" s={17} sw={2.2} c="#1F8A5B" />
                    <Txt v="sm" style={{ flex: 1 }}>
                      {d.checkOutErgebnis.invoice_already_existed
                        ? `Check-out abgeschlossen — Rechnung ${d.checkOutErgebnis.invoice_number ?? ""} verwendet.`
                        : `Check-out abgeschlossen — finale Rechnung ${d.checkOutErgebnis.invoice_number ?? ""} erstellt.`}
                    </Txt>
                  </Row>
                </Card>
              )}

              {/* Nachricht an den Gast: bewusst AUCH bei stornierter Buchung —
                  gerade dann muss der Betrieb den Gast erreichen. Ohne Thread
                  kein Weg (die Ansicht wäre leer). */}
              {data.message_thread_id && onNachrichtOeffnen && (
                <Btn
                  variant="outline"
                  block
                  icon="chat"
                  onPress={() => {
                    // Der Posteingang liegt in einem anderen Tab; das Panel
                    // schließt dabei, sonst läge es über der Konversation.
                    schliessen();
                    onNachrichtOeffnen?.(data.message_thread_id as string);
                  }}
                >
                  Nachricht an den Gast
                </Btn>
              )}

              {/* --- Tiefe in Aufklappern ------------------------------------ */}

              {!istEigennutzung && (
                <Aufklapper
                  // Währungsneutral (das „euro"-Icon ist ein €-Glyph).
                  icon="card"
                  titel="Preis & Rechnung"
                  kurz={betrag(data.total_amount)}
                  standardOffen
                >
                  {data.quote_items.map((q, i) => (
                    <Row key={`${q.label}-${i}`} style={{ justifyContent: "space-between" }}>
                      <Txt v="sm" soft numberOfLines={1} style={{ flex: 1 }}>
                        {q.label}
                      </Txt>
                      <Txt v="sm">{betrag(q.amount)}</Txt>
                    </Row>
                  ))}
                  {data.quote_items.length > 0 && <Divider />}
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt v="title">Gesamt</Txt>
                    <Txt v="title">{betrag(data.total_amount)}</Txt>
                  </Row>
                  <Angabe
                    label="In Rechnung gestellt"
                    wert={
                      data.invoice && data.invoice.gross_amount != null
                        ? formatCurrency(
                            data.invoice.gross_amount,
                            data.invoice.currency || data.currency,
                          )
                        : null
                    }
                  />
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt v="sm" soft>
                      Bezahlt
                    </Txt>
                    <Txt v="sm">{betrag(data.paid_amount)}</Txt>
                  </Row>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt v="sm" soft>
                      Noch offen
                    </Txt>
                    <Txt
                      v="sm"
                      style={{
                        fontFamily:
                          (data.due_amount ?? 0) > 0
                            ? t.fonts.semibold
                            : t.fonts.regular,
                      }}
                      color={(data.due_amount ?? 0) > 0 ? "#9A6B12" : undefined}
                    >
                      {betrag(data.due_amount)}
                    </Txt>
                  </Row>

                  {data.invoice ? (
                    <>
                      <Divider />
                      <Angabe
                        label="Rechnung"
                        wert={data.invoice.invoice_number ?? data.invoice.id.slice(0, 8)}
                      />
                      <Angabe label="Status" wert={data.invoice.status} />
                      {/* Bewusst OHNE PDF-Ansicht/Versand: das läuft im Web über
                          den Dokument-Dialog der Buchhaltung. Ein halber Weg
                          hier (Datei öffnen, aber nicht versenden können) wäre
                          eine Sackgasse — Rechnung ansehen und verschicken
                          bleibt der Buchhaltung im Web vorbehalten. */}
                    </>
                  ) : (
                    <Txt v="xs" soft>
                      Noch keine Rechnung — sie entsteht beim Check-out.
                    </Txt>
                  )}

                  {/* Was das Portal einbehält, ist Teil der Preis-Wahrheit einer
                      OTA-Buchung (0270) — im Web steht es auf der Detailseite. */}
                  {istOta && (data.ota_commission != null || data.ota_withheld_taxes != null) && (
                    <>
                      <Divider />
                      <Angabe
                        label="Portal-Provision"
                        wert={
                          data.ota_commission != null
                            ? betrag(data.ota_commission)
                            : null
                        }
                      />
                      <Angabe
                        label="Vom Portal einbehaltene Steuern"
                        wert={
                          data.ota_withheld_taxes != null
                            ? betrag(data.ota_withheld_taxes)
                            : null
                        }
                      />
                      <Angabe
                        label="Zahlungsweg"
                        wert={
                          data.payment_collect === "ota"
                            ? "Portal hat kassiert"
                            : data.payment_collect === "property"
                              ? "Wir ziehen ein"
                              : null
                        }
                      />
                      <Angabe label="Zahlart laut Portal" wert={data.payment_method_ota} />
                    </>
                  )}
                </Aufklapper>
              )}

              {!istStorniert && !istEigennutzung && (
                <Aufklapper icon="sparkle" titel="Zusatzleistungen">
                  <ZusatzleistungenBlock
                    reservationId={reservationId}
                    currency={data.currency}
                  />
                </Aufklapper>
              )}

              {(data.guest_email ||
                data.guest_phone ||
                data.guest_language ||
                data.guest_country) && (
                <Aufklapper icon="user" titel="Gast" kurz={data.guest_name || null}>
                  <Angabe label="Name" wert={data.guest_name} />
                  <Angabe label="E-Mail" wert={data.guest_email} />
                  <Angabe label="Telefon" wert={data.guest_phone} />
                  <Angabe label="Sprache" wert={data.guest_language} />
                  <Angabe label="Land" wert={data.guest_country} />
                  {/* Anrufen/Mailen direkt aus der Buchung — die beiden Wege,
                      die ein Telefon besser kann als ein Rechner. */}
                  <Row gap={8} style={{ flexWrap: "wrap" }}>
                    {data.guest_phone && (
                      <Btn
                        variant="outline"
                        icon="user"
                        style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                        onPress={() => Linking.openURL(`tel:${data.guest_phone}`)}
                      >
                        Anrufen
                      </Btn>
                    )}
                    {data.guest_email && (
                      <Btn
                        variant="outline"
                        icon="send"
                        style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                        onPress={() => Linking.openURL(`mailto:${data.guest_email}`)}
                      >
                        E-Mail
                      </Btn>
                    )}
                  </Row>
                </Aufklapper>
              )}

              {/* Konditionen des PORTALS (0384). Für eine OTA-Buchung gilt die
                  Staffel, die Booking bzw. Airbnb dem GAST zugesagt hat — nicht
                  unsere eigene Kondition. Wer am Telefon „bis zum 25. kostenfrei"
                  sagt, muss die Zusage des Portals lesen. Fehlt sie, steht hier
                  nichts; das heißt ausdrücklich NICHT „kostenfrei stornierbar". */}
              {hatPortalAngaben && (
                <Aufklapper
                  icon="globe"
                  titel="Angaben des Portals"
                  kurz={data.ota_name ? portalLabel(data.ota_name) : null}
                >
                  {staffel.length > 0 && (
                    <>
                      <Txt v="title">Storno laut Portal</Txt>
                      {staffel.map((stufe, i) => {
                        const wert = portalBetrag(stufe.amount);
                        return (
                          <Row
                            key={`${stufe.from}-${i}`}
                            gap={10}
                            style={{ justifyContent: "space-between" }}
                          >
                            <Txt v="sm" soft numberOfLines={1} style={{ flex: 1 }}>
                              ab {zeitpunkt(stufe.from)}
                            </Txt>
                            <Txt v="sm">
                              {wert == null
                                ? "—"
                                : wert === 0
                                  ? "kostenfrei"
                                  : formatCurrency(
                                      wert,
                                      stufe.currency || data.currency,
                                    )}
                            </Txt>
                          </Row>
                        );
                      })}
                    </>
                  )}
                  <Angabe label="Verpflegung" wert={raum?.meal_plan} />
                  <Angabe label="Angekündigte Ankunft" wert={portalDetails.arrival_hour} />
                  <Angabe
                    label="Gast-Angaben"
                    wert={
                      portalDetails.guest_labels?.length
                        ? portalDetails.guest_labels.join(", ")
                        : null
                    }
                  />
                  {raum?.policies ? (
                    <Col gap={3}>
                      <Txt v="sm" soft>
                        Regeln des Portals
                      </Txt>
                      <Txt v="sm">{raum.policies}</Txt>
                    </Col>
                  ) : null}
                  {data.ota_notes ? (
                    <Col gap={3}>
                      <Txt v="sm" soft>
                        Hinweis des Portals
                      </Txt>
                      <Txt v="sm">{data.ota_notes}</Txt>
                    </Col>
                  ) : null}
                </Aufklapper>
              )}

              {data.note && (
                <Aufklapper icon="doc" titel="Notiz">
                  <Txt v="sm">{data.note}</Txt>
                </Aufklapper>
              )}

              {data.external_url && (
                <Btn
                  variant="outline"
                  block
                  icon="share"
                  onPress={() => Linking.openURL(data.external_url as string)}
                >
                  Im Portal öffnen
                </Btn>
              )}

              {/* Storno */}
              {istStorniert ? (
                <Card style={{ padding: 14 }}>
                  <Col gap={4}>
                    <Txt v="title" color="#B02A2A">
                      Storniert
                    </Txt>
                    {data.cancelled_at ? (
                      <Txt v="xs" soft>
                        am {zeitpunkt(data.cancelled_at)}
                      </Txt>
                    ) : null}
                    {data.cancel_reason ? (
                      <Txt v="sm">Grund: {data.cancel_reason}</Txt>
                    ) : null}
                    {data.invoice ? (
                      <Txt v="sm" soft>
                        Zur stornierten Buchung existiert Rechnung{" "}
                        {data.invoice.invoice_number ?? data.invoice.id.slice(0, 8)} —
                        eine Stornorechnung entsteht in der Buchhaltung.
                      </Txt>
                    ) : null}
                  </Col>
                </Card>
              ) : stornoOffen ? (
                <Card style={{ padding: 14 }}>
                  <Col gap={10}>
                    <Txt v="title" color="#B02A2A">
                      Stornieren — Begründung erforderlich
                    </Txt>
                    {istOta && (
                      <Txt v="sm" soft>
                        Das storniert die Buchung nur bei uns. Bitte zusätzlich
                        direkt im Portal stornieren
                        {data.ota_name ? ` (${portalLabel(data.ota_name)})` : ""}.
                      </Txt>
                    )}
                    <TextInput
                      value={stornoGrund}
                      onChangeText={setStornoGrund}
                      multiline
                      autoFocus
                      placeholder="Grund der Stornierung"
                      placeholderTextColor={t.palette.faint}
                      style={{
                        minHeight: 74,
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
                    {d.aktionFehler && (
                      <Txt v="sm" color={t.palette.accent}>
                        {d.aktionFehler}
                      </Txt>
                    )}
                    <Row gap={8}>
                      <Btn
                        variant="outline"
                        style={{ flex: 1, paddingVertical: 11 }}
                        disabled={d.aktionLaeuft}
                        onPress={() => {
                          setStornoOffen(false);
                          setStornoGrund("");
                        }}
                      >
                        Abbrechen
                      </Btn>
                      <Btn
                        style={{ flex: 1, paddingVertical: 11 }}
                        disabled={d.aktionLaeuft || !stornoGrund.trim()}
                        onPress={() => d.stornieren(stornoGrund.trim())}
                      >
                        {d.aktionLaeuft ? "Storniere…" : "Stornieren"}
                      </Btn>
                    </Row>
                  </Col>
                </Card>
              ) : (
                <Btn
                  variant="outline"
                  block
                  icon="x"
                  onPress={() => setStornoOffen(true)}
                >
                  Buchung stornieren
                </Btn>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>

      <ZahlartSheet
        offen={zahlartOffen}
        laeuft={d.aktionLaeuft}
        onAbbrechen={() => setZahlartOffen(false)}
        onBestaetigen={(payment) => {
          setZahlartOffen(false);
          d.auschecken(payment);
        }}
      />
    </Modal>
  );
}
