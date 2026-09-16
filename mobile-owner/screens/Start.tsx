// Startseite — Vorlage: Hostaway Owner App „Home": Datum, „Finanzübersicht"
// mit Zeitraum-Chips, eine große Kennzahl mit Verlauf, zwei Nebenkennzahlen,
// darunter „Ihre Objekte (n) ›".
//
// GELD HIER: ausschließlich die NETTO-Auszahlung des Eigentümers aus
// `/public-portal/finanzen` — dieselbe Zahl wie Kalender und Abrechnung,
// dieselbe serverseitige Maske. `null` heißt „nicht ausweisbar" (Grund wird
// genannt) oder „keine Finanzfreigabe" und wird als „k. A." gezeigt, nie als 0
// (Wurzel 4). Kein Gastpreis, kein Bruttoumsatz (§4.2) — deshalb fehlt die
// Kennzahl „Rental Revenue" der Vorlage bewusst.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoBand } from "@/components/DemoBand";
import { Icon } from "@/components/ui/Icon";
import { Kachel, Photo, Spinner, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { Verlauf, type VerlaufPunkt } from "@/components/widgets/Verlauf";
import { useAuth } from "@/contexts/AuthContext";
import { useSprache } from "@/contexts/SprachContext";
import { formatCurrency } from "@/lib/currency";
import {
  type FinanzEinstellungen as Einstellungen,
  KENNZAHL_HINWEIS_SCHLUESSEL,
  KENNZAHL_SCHLUESSEL,
  type Kennzahl,
  STANDARD,
  istGeld,
  punktWert,
  reihenWert,
} from "@/lib/finanz-einstellungen";
import { betragKurz, grundText } from "@/lib/kalender-aufenthalte";
import {
  getOwnerFinanzen,
  getOwnerProperties,
  type PortalFinanzUebersicht,
  type PortalProperty,
} from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useUnterkante } from "@/lib/unterkante";
import {
  type Uebersetzer,
  ZEITRAUM_CHIPS,
  ZEITRAUM_SCHLUESSEL,
  datumLang,
  monatKurz,
  prozent,
  veraenderungPct,
  zeitraumGrenzen,
  zeitraumLegende,
} from "@/lib/zeitraum";
import { FinanzEinstellungenBlatt } from "@/screens/FinanzEinstellungen";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };

/** Wert einer Kennzahl formatiert; null → „k. A." (nie 0). */
export function kennzahlText(
  txt: Uebersetzer,
  sprache: string,
  wert: number | null,
  k: Kennzahl,
  currency: string | null,
): string {
  if (wert === null) return betragKurz(txt);
  if (istGeld(k)) return formatCurrency(wert, currency, 2);
  if (k === "auslastung") return prozent(sprache, wert);
  return String(Math.round(wert));
}

/** Kurze Achsenbeschriftung: Geld ohne Nachkommastellen, Prozent ganz, sonst Zahl. */
export function achsenText(wert: number, k: Kennzahl, currency: string | null): string {
  if (istGeld(k)) return formatCurrency(wert, currency, 0);
  if (k === "auslastung") return `${Math.round(wert)} %`;
  return String(Math.round(wert));
}

/** X-Beschriftung: Tag des Monats bei Tagen, Monatskürzel bei Monaten. */
export function xText(txt: Uebersetzer, label: string): string {
  if (label.length === 10) return String(Number(label.slice(8, 10)));
  return monatKurz(txt, Number(label.slice(5, 7)) - 1);
}

export default function Start({ navigation }: { navigation: Nav }) {
  const { t: txt, sprache } = useSprache();
  const t = useTheme();
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const unterkante = useUnterkante();
  const [einst, setEinst] = useState<Einstellungen>(STANDARD);
  const [blatt, setBlatt] = useState(false);
  const [daten, setDaten] = useState<PortalFinanzUebersicht | null>(null);
  const [objekte, setObjekte] = useState<PortalProperty[] | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Nur die JUENGSTE Anfrage darf schreiben (Wurzel 2). Zwei Abrufe in
  // Folge — schnelles Blaettern, ein Objektwechsel, ein Realtime-Ereignis
  // mitten im Laden — kommen in unbestimmter Reihenfolge zurueck; ohne
  // diesen Zaehler ueberschreibt die LANGSAMERE Antwort die neuere, und
  // die Ansicht zeigt Daten eines Zeitraums, der nicht mehr gewaehlt ist.
  const lauf = useRef(0);

  const laden = useCallback(async () => {
    const meins = ++lauf.current;
    setFehler(null);
    const { von, bis } = zeitraumGrenzen(einst.zeitraum, new Date());
    const [fin, obj] = await Promise.all([
      getOwnerFinanzen({
        von,
        bis,
        propertyId: einst.propertyId,
        event: einst.ereignis,
        vergleich: einst.vergleich === "vorjahr",
      }),
      getOwnerProperties(),
    ]);
    if (meins !== lauf.current) return;
    if (fin.ok) setDaten(fin.data);
    else setFehler(fin.error);
    // Ein Fehler beim Objektabruf war bis zum 15.09.2026 STUMM: die
    // Ueberschrift „Ihre Objekte" stand ohne Anzahl da, und niemand konnte
    // einen Ausfall von „keine Objekte" unterscheiden (Wurzel 5).
    if (obj.ok) setObjekte(obj.data.items);
    else setFehler((v) => v ?? obj.error);
    setLaedt(false);
  }, [einst.zeitraum, einst.propertyId, einst.ereignis, einst.vergleich]);

  useEffect(() => {
    setLaedt(true);
    void laden();
  }, [laden]);

  // Eine neue oder geänderte Buchung ändert Auszahlung und Auslastung — ohne
  // Abo sähe die Seite live aus und bliebe stehen (CLAUDE.md „Realtime").
  useRealtime({ table: "reservations", onChange: laden });
  useRealtime({ table: "availability", onChange: laden });

  const aktuell = daten?.current ?? null;
  const vergleich = daten?.comparison ?? null;
  const currency = daten?.currency ?? null;

  const punkte = useMemo<VerlaufPunkt[]>(
    () => (aktuell?.points ?? []).map((p) => ({ label: p.label, wert: punktWert(p, einst.diagramm) })),
    [aktuell, einst.diagramm],
  );
  const vergleichPunkte = useMemo<VerlaufPunkt[] | null>(
    () =>
      vergleich ? vergleich.points.map((p) => ({ label: p.label, wert: punktWert(p, einst.diagramm) })) : null,
    [vergleich, einst.diagramm],
  );

  const info = (k: Kennzahl) => Alert.alert(txt(KENNZAHL_SCHLUESSEL[k]), txt(KENNZAHL_HINWEIS_SCHLUESSEL[k]));

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Kopf name={me?.full_name} email={me?.email} aufProfil={() => navigation.navigate("Mehr")} />
      {me?.is_demo ? <DemoBand /> : null}
      <ScrollView
        contentContainerStyle={{
          padding: t.density.pad,
          paddingTop: 0,
          paddingBottom: unterkante + 24,
          gap: KARTE_ABSTAND,
        }}
        refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
      >
        <Txt v="sm" soft>
          {datumLang(txt, new Date())}
        </Txt>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Txt v="h2">{txt("start.titel")}</Txt>
          <Pressable
            onPress={() => setBlatt(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={txt("start.einstellungen")}
          >
            <Icon n="morev" s={22} sw={2.2} c={t.palette.ink} />
          </Pressable>
        </View>

        {/* Zeitraum-Chips: der aktive trägt die MARKE, nicht Schwarz. Die
            Vorlage (Smoobu) setzt hier `ink`, und so stand es bis zum
            15.09.2026 auch hier — eine schwarze Pille ist aber kein Zustand,
            sie ist nur die dunkelste Fläche im Bild und zieht mehr
            Aufmerksamkeit als die Zahl darunter. Ein im Blatt gewählter
            anderer Zeitraum lässt alle drei ruhen. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {ZEITRAUM_CHIPS.map((z) => {
            const aktiv = einst.zeitraum === z;
            return (
              <Pressable
                key={z}
                onPress={() => setEinst({ ...einst, zeitraum: z })}
                accessibilityRole="button"
                accessibilityState={{ selected: aktiv }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: aktiv ? t.palette.accent : t.palette.surface,
                  borderWidth: 1,
                  borderColor: aktiv ? t.palette.accent : t.palette.line,
                }}
              >
                <Txt v="xs" color={aktiv ? t.palette.accentInk : t.palette.ink} style={{ fontFamily: t.fonts.medium }}>
                  {txt(ZEITRAUM_SCHLUESSEL[z])}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>

        {fehler ? (
          <Kachel>
            <Txt v="title">{txt("start.nichtGeladen")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {/* 404 heißt hier: der Server kennt die Finanzübersicht noch nicht
                  (Deploy steht aus) — das sagt „Not Found" niemandem. */}
              {fehler === "Not Found"
                ? txt("start.nichtVerfuegbar")
                : fehler}
            </Txt>
          </Kachel>
        ) : null}

        {laedt && !daten ? (
          <Kachel>
            <Spinner />
          </Kachel>
        ) : null}

        {aktuell ? (
          <>
            <Kachel>
              <Pressable
                onPress={() => info(einst.diagramm)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                accessibilityRole="button"
                accessibilityLabel={txt("kennzahl.erklaerung", { name: txt(KENNZAHL_SCHLUESSEL[einst.diagramm]) })}
              >
                <Txt v="sm" soft>
                  {txt(KENNZAHL_SCHLUESSEL[einst.diagramm])}
                </Txt>
                <Icon n="info" s={15} c={t.palette.faint} />
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 4 }}>
                <Txt v="display">{kennzahlText(txt, sprache, reihenWert(aktuell, einst.diagramm), einst.diagramm, currency)}</Txt>
                <Trend
                  aktuell={reihenWert(aktuell, einst.diagramm)}
                  vergleich={vergleich ? reihenWert(vergleich, einst.diagramm) : null}
                />
              </View>
              {istGeld(einst.diagramm) && aktuell.payout_total === null ? (
                <Txt v="xs" faint style={{ marginTop: 4 }}>
                  {aktuell.payout_unknown_reason
                    ? grundText(txt, aktuell.payout_unknown_reason)
                    : txt("auszahlung.nichtFreigegeben")}
                </Txt>
              ) : null}
              <View style={{ flexDirection: "row", gap: 14, marginTop: 8, marginBottom: 6 }}>
                <LegendePunkt farbe={t.palette.accent} text={zeitraumLegende(txt, aktuell.date_from, aktuell.date_to)} />
                {vergleich ? (
                  <LegendePunkt
                    farbe={t.palette.soft}
                    text={zeitraumLegende(txt, vergleich.date_from, vergleich.date_to)}
                  />
                ) : null}
              </View>
              <Verlauf
                punkte={punkte}
                vergleich={vergleichPunkte}
                typ={einst.diagrammtyp}
                formatY={(w) => achsenText(w, einst.diagramm, currency)}
                formatX={(label) => xText(txt, label)}
              />
            </Kachel>

            <View style={{ flexDirection: "row", gap: KARTE_ABSTAND }}>
              {einst.nebenkennzahlen.map((k) => (
                <Kachel key={k} style={{ flex: 1 }}>
                  <Pressable
                    onPress={() => info(k)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={txt("kennzahl.erklaerung", { name: txt(KENNZAHL_SCHLUESSEL[k]) })}
                  >
                    <Txt v="xs" soft numberOfLines={1} style={{ flexShrink: 1 }}>
                      {txt(KENNZAHL_SCHLUESSEL[k])}
                    </Txt>
                    <Icon n="info" s={13} c={t.palette.faint} />
                  </Pressable>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
                    <Txt v="h2" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {kennzahlText(txt, sprache, reihenWert(aktuell, k), k, currency)}
                    </Txt>
                    <Trend aktuell={reihenWert(aktuell, k)} vergleich={vergleich ? reihenWert(vergleich, k) : null} />
                  </View>
                </Kachel>
              ))}
            </View>
          </>
        ) : null}

        {/* Ihre Objekte */}
        <Pressable
          onPress={() => navigation.navigate("Objekte")}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}
        >
          <Txt v="h2">Ihre Objekte{objekte ? ` (${objekte.length})` : ""}</Txt>
          <Icon n="fwd" s={18} sw={2} c={t.palette.ink} />
        </Pressable>
        {objekte?.length === 0 ? (
          <Kachel>
            <Txt v="title">{txt("start.keinObjekt")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              Sobald Ihre Verwaltung Ihnen ein Objekt zuordnet, erscheint es hier.
            </Txt>
          </Kachel>
        ) : null}
        {objekte?.map((o) => (
          <Pressable key={o.id} onPress={() => navigation.navigate("ObjektDetail", { id: o.id, titel: o.title })}>
            <Kachel pad={12}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Photo src={o.photo ?? undefined} h={68} w={92} r={10} />
                <View style={{ flex: 1 }}>
                  <Txt v="title" numberOfLines={1}>
                    {o.title}
                  </Txt>
                  {o.city ? (
                    <Txt v="xs" soft numberOfLines={1} style={{ marginTop: 2 }}>
                      {o.city}
                    </Txt>
                  ) : null}
                </View>
                <Icon n="fwd" s={16} c={t.palette.faint} />
              </View>
            </Kachel>
          </Pressable>
        ))}
      </ScrollView>

      <FinanzEinstellungenBlatt
        offen={blatt}
        wert={einst}
        objekte={objekte ?? []}
        schliessen={() => setBlatt(false)}
        uebernehmen={(e) => {
          setEinst(e);
          setBlatt(false);
        }}
      />
    </View>
  );
}

/** „↑ 64 %" gegen den Vergleichszeitraum; ohne berechenbaren Vergleich nichts. */
function Trend({ aktuell, vergleich }: { aktuell: number | null; vergleich: number | null }) {
  const t = useTheme();
  const pct = veraenderungPct(aktuell, vergleich);
  if (pct === null) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingBottom: 4 }}>
      <Icon n={pct >= 0 ? "arrowup" : "arrowdown"} s={14} sw={2.2} c={t.palette.ink} />
      <Txt v="xs" style={{ fontFamily: t.fonts.semibold }}>
        {Math.abs(pct)} %
      </Txt>
    </View>
  );
}

function LegendePunkt({ farbe, text }: { farbe: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: farbe }} />
      <Txt v="xs" soft>
        {text}
      </Txt>
    </View>
  );
}
