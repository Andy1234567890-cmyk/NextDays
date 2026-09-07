// Kalender — Monatsbelegung der eigenen Objekte, LESEND.
// GET /public-portal/calendar + /public-portal/seasons; der Eigentümer kann
// ansehen, nichts setzen. Wer Nächte freihalten will, stellt einen Sperrantrag.
//
// DARSTELLUNG (07.09.2026, gleichgezogen mit dem Web-Portal
// web/components/portal/portal-kalender.tsx): ein CHIP je AUFENTHALT und
// Einheit, über seine Nächte gespannt, in der KANALFARBE, mit Portal-Logo,
// Vorname des Gastes und der Netto-Auszahlung PRO NACHT. Die Tageszelle trägt
// die Saisonfarbe als schmale Marke und bei mehreren Einheiten „2/5".
//
// Vorher stand in jeder Nacht ein Kasten in drei Farben (frei/belegt/gesperrt)
// — die App zeigte damit weniger als das Web, obwohl der Contract längst alles
// liefert. Die Rechenlogik (Aufenthalte → Segmente → Bahnen) liegt in
// lib/kalender-aufenthalte.ts und ist dort getestet.
//
// GELD IM KALENDER: die einzige Betragsangabe ist die persönliche
// Netto-Auszahlung des Eigentümers je Nacht, mit derselben SERVERSEITIGEN
// Maske wie unter „Auszahlungen": `null` heißt „nicht ausweisbar" und wird als
// „k. A." samt GRUND gezeigt — nie als 0, nie geschätzt (Wurzel 4). Kein
// Gastpreis, kein Gesamtbetrag der Buchung (§4.2).
//
// STATT TOOLTIP: Antippen. Ein Chip oder eine Zelle öffnet eine Detail-Kachel
// unter dem Blatt — das Web nutzt `title`, das gibt es auf dem Telefon nicht.
//
// ZWEI ÜBERNOMMENE FALLEN (bleiben bewusst so gelöst):
//  1. Kalenderdatum LOKAL bilden (`iso`), nie `toISOString()`: das verschiebt
//     östlich von UTC auf den Vortag.
//  2. Ladefehler ≠ leerer Bestand: scheitert der Abruf, bleibt die Liste
//     `null` und es erscheint der Fehler — NICHT „keine Objekte" (Wurzel 4).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Blatt } from "@/components/ui/Blatt";
import { Btn, Kachel, Spinner, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/currency";
import {
  type Aufenthalt,
  BETRAG_KURZ,
  MAX_BAHNEN,
  type Segment,
  type Ueberlauf,
  aufenthalteBilden,
  bahnenVerteilen,
  grundText,
  saisonProTag,
  segmenteBilden,
  wochenBilden,
} from "@/lib/kalender-aufenthalte";
import { kanalAusQuelle, kanalLabel } from "@/lib/kanaele";
import {
  getOwnerCalendar,
  getOwnerProperties,
  getOwnerSeasons,
  type PortalCalendarDay,
  type PortalProperty,
  type PortalSeason,
} from "@/lib/ownerPortal";
import { portalLogo } from "@/lib/portal-logos";
import { useRealtime } from "@/lib/realtime";
import { useUnterkante } from "@/lib/unterkante";
import { MONATE, prozent } from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { kanalFarbe } from "@/theme/kanalfarben";
import { useTheme } from "@/theme/ThemeProvider";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Geometrie der Wochenzeile (px). Der Chip ist so hoch wie eine Zeile Text
// samt Luft; zwei Bahnen fest, eine dritte nur, wenn eine Woche „+n" trägt.
const KOPF_H = 30;
const CHIP_H = 26;
const CHIP_ABSTAND = 4;
const FUSS_H = 6;
const ZEILE_H = KOPF_H + MAX_BAHNEN * (CHIP_H + CHIP_ABSTAND) + FUSS_H;
const SPALTE = 100 / 7;
// Anreise-/Abreisemitte: der Chip beginnt am Anreisetag zur Tagesmitte und
// endet am Abreisetag zur Mitte — am Wechseltag teilen sich zwei Aufenthalte
// den Tag sichtbar, statt wie eine Doppelbuchung auszusehen.
const HALBER_TAG = 0.5;
const CHIP_TEXT = "#FFFFFF";

/** LOKALES Kalenderdatum — kein `toISOString()` (siehe Kopf, Falle 1). */
export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Zellen eines Monatsblatts, montagsbeginnend; `null` = Vorlauf. */
export function monatsRaster(jahr: number, monat: number): (Date | null)[] {
  const erster = new Date(jahr, monat, 1);
  const vorlauf = (erster.getDay() + 6) % 7;
  const tage = new Date(jahr, monat + 1, 0).getDate();
  const zellen: (Date | null)[] = [];
  for (let i = 0; i < vorlauf; i++) zellen.push(null);
  for (let d = 1; d <= tage; d++) zellen.push(new Date(jahr, monat, d));
  return zellen;
}

/** „05.09." aus einem ISO-Datum — ohne Date-Objekt, also ohne Zeitzonen-Versatz. */
function kurzDatum(isoTag: string): string {
  return `${isoTag.slice(8, 10)}.${isoTag.slice(5, 7)}.`;
}

/**
 * Kennzahlen des Monats aus den geladenen Tagen — dieselbe Maske wie die
 * Zellen: sobald EINE belegte Nacht keinen Betrag hat, gibt es keine Summe
 * (eine Teilsumme sähe aus wie der Monatsertrag, Wurzel 4).
 */
export function monatsKennzahlen(tage: readonly PortalCalendarDay[]): {
  naechte: number;
  eigen: number;
  auslastung: number | null;
  payout: number | null;
  currency: string | null;
} {
  let naechte = 0;
  let eigen = 0;
  let kapazitaet = 0;
  let payout = 0;
  let bestimmbar = true;
  let currency: string | null = null;
  for (const d of tage) {
    kapazitaet += d.units_total;
    const bezahlt = d.bookings.filter((b) => !b.is_owner_stay).length;
    eigen += d.bookings.length - bezahlt;
    naechte += bezahlt;
    if (bezahlt > 0) {
      if (d.owner_payout_per_night === null) bestimmbar = false;
      else payout += d.owner_payout_per_night;
      if (d.currency) currency = currency ?? d.currency;
    }
  }
  return {
    naechte,
    eigen,
    auslastung: kapazitaet > 0 ? Math.round(((naechte + eigen) / kapazitaet) * 1000) / 10 : null,
    payout: bestimmbar && naechte > 0 ? Math.round(payout * 100) / 100 : bestimmbar ? 0 : null,
    currency,
  };
}

type Auswahl = { art: "aufenthalt"; wert: Aufenthalt } | { art: "tag"; wert: string } | null;

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };

export default function Kalender({ navigation }: { navigation: Nav }) {
  const t = useTheme();
  const { me } = useAuth();
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();
  const [objekte, setObjekte] = useState<PortalProperty[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [monat, setMonat] = useState(() => {
    const jetzt = new Date();
    return { jahr: jetzt.getFullYear(), monat: jetzt.getMonth() };
  });
  const [tage, setTage] = useState<Map<string, PortalCalendarDay> | null>(null);
  const [saisons, setSaisons] = useState<PortalSeason[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<Auswahl>(null);

  useEffect(() => {
    void getOwnerProperties().then((res) => {
      if (res.ok) {
        setObjekte(res.data.items);
        if (res.data.items.length > 0) setGewaehlt(res.data.items[0].id);
      } else {
        setObjekte(null);
        setFehler(res.error);
      }
    });
  }, []);

  const zellen = useMemo(() => monatsRaster(monat.jahr, monat.monat), [monat]);

  const monatLaden = useCallback(async () => {
    if (!gewaehlt) return;
    setTage(null);
    const start = iso(new Date(monat.jahr, monat.monat, 1));
    const ende = iso(new Date(monat.jahr, monat.monat + 1, 1));
    const res = await getOwnerCalendar(gewaehlt, start, ende);
    if (res.ok) {
      setTage(new Map(res.data.days.map((d) => [d.date, d])));
      setFehler(null);
    } else {
      setTage(new Map());
      setFehler(res.error);
    }
  }, [gewaehlt, monat]);

  // Saisons hängen am Objekt, nicht am Monat. Sie sind Schmuck, kein
  // Kerninhalt: scheitert der Abruf, bleibt der Kalender nutzbar und zeigt
  // nur keine Saisonfarben (wie im Web).
  const saisonsLaden = useCallback(async () => {
    if (!gewaehlt) return;
    const res = await getOwnerSeasons(gewaehlt);
    setSaisons(res.ok ? res.data.items : []);
  }, [gewaehlt]);

  useEffect(() => {
    void monatLaden();
  }, [monatLaden]);
  useEffect(() => {
    setAuswahl(null);
    void saisonsLaden();
  }, [saisonsLaden]);

  // Alle speisenden Tabellen abonnieren: `availability` die Sperren,
  // `reservations` die Buchungen, die Saison-Tabellen die Farben. Fehlt ein
  // Abo, sieht die Ansicht live aus und aktualisiert nie (CLAUDE.md „Realtime").
  useRealtime({ table: "availability", onChange: monatLaden });
  useRealtime({ table: "reservations", onChange: monatLaden });
  useRealtime({ table: "property_seasons", onChange: saisonsLaden });
  useRealtime({ table: "property_season_assignments", onChange: saisonsLaden });

  const heute = iso(new Date());
  const wochen = useMemo(() => wochenBilden(zellen.map((z) => (z ? iso(z) : null))), [zellen]);
  const aufenthalte = useMemo(() => (tage ? aufenthalteBilden([...tage.values()]) : []), [tage]);
  const saisonMap = useMemo(() => saisonProTag(saisons), [saisons]);

  // Legende: nur die Kanäle, die in diesem Monat wirklich vorkommen — ein
  // Punkt für eine Farbe, die im Blatt gar nicht auftaucht, erklärt nichts.
  const kanaeleImMonat = useMemo(() => {
    const gesehen = new Map<string, { farbe: string; label: string }>();
    for (const a of aufenthalte) {
      if (a.eigennutzung || !a.quelle) continue;
      const kanal = kanalAusQuelle(a.quelle);
      if (!kanal) continue;
      const farbe = kanalFarbe(kanal);
      if (!gesehen.has(farbe)) gesehen.set(farbe, { farbe, label: kanalLabel(kanal, a.quelle) });
    }
    return [...gesehen.values()];
  }, [aufenthalte]);
  const eigennutzungImMonat = aufenthalte.some((a) => a.eigennutzung);

  const monatsName = `${MONATE[monat.monat]} ${monat.jahr}`;
  const kennzahlen = useMemo(() => (tage ? monatsKennzahlen([...tage.values()]) : null), [tage]);
  const istHeuteMonat = monat.jahr === new Date().getFullYear() && monat.monat === new Date().getMonth();

  const blaettern = (schritt: number) => {
    setAuswahl(null);
    setMonat((m) => {
      const d = new Date(m.jahr, m.monat + schritt, 1);
      return { jahr: d.getFullYear(), monat: d.getMonth() };
    });
  };

  // Gesperrt/Eigennutzung: derselbe gedeckte Ton für beides, kein Kanalton —
  // die eigene Sperre ist keine Buchung über einen Vertriebsweg (wie im Web).
  const gesperrtFarbe = t.palette.soft;

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Kopf
        titel="Kalender"
        name={me?.full_name}
        email={me?.email}
        aufProfil={() => navigation.navigate("Mehr")}
      />

      {objekte && objekte.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: t.density.pad, gap: 8, paddingBottom: 12 }}
        >
          {objekte.map((o) => {
            const aktiv = o.id === gewaehlt;
            return (
              <Pressable
                key={o.id}
                onPress={() => setGewaehlt(o.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: aktiv }}
              >
                <View
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: aktiv ? t.palette.ink : t.palette.surface,
                    borderWidth: 1,
                    borderColor: aktiv ? t.palette.ink : t.palette.line,
                  }}
                >
                  <Txt v="xs" color={aktiv ? t.palette.bg : t.palette.ink} numberOfLines={1} style={{ fontFamily: t.fonts.medium }}>
                    {o.title}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          padding: t.density.pad,
          paddingTop: 0,
          paddingBottom: unterkante + 96,
          gap: KARTE_ABSTAND,
        }}
      >
        {!objekte && !fehler ? <Spinner /> : null}

        {fehler ? (
          <Kachel>
            <Txt v="title">Kalender nicht geladen</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}

        {objekte && objekte.length === 0 ? (
          <Kachel>
            <Txt v="title">Noch kein Objekt zugeordnet</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              Sobald Ihre Verwaltung Ihnen ein Objekt zuordnet, erscheint sein Kalender hier.
            </Txt>
          </Kachel>
        ) : null}

        {objekte && objekte.length > 0 ? (
          <>
            {/* Monatskopf: Titel links, runde Blätter-Knöpfe rechts (Vorlage). */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Txt v="h2" style={{ flex: 1 }}>
                {monatsName}
              </Txt>
              {!istHeuteMonat ? (
                <Pressable
                  onPress={() => {
                    const j = new Date();
                    setAuswahl(null);
                    setMonat({ jahr: j.getFullYear(), monat: j.getMonth() });
                  }}
                  accessibilityRole="button"
                  style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.palette.line }}
                >
                  <Txt v="xs" style={{ fontFamily: t.fonts.medium }}>
                    Heute
                  </Txt>
                </Pressable>
              ) : null}
              <RundKnopf icon="back" label="Vorheriger Monat" auf={() => blaettern(-1)} />
              <RundKnopf icon="fwd" label="Nächster Monat" auf={() => blaettern(1)} />
            </View>

            {/* Kennzahlen des Monats — dieselbe Zahl wie die Chips, nur summiert. */}
            {kennzahlen ? (
              <View style={{ flexDirection: "row", gap: KARTE_ABSTAND }}>
                <MonatsKennzahl titel="Belegte Nächte" wert={String(kennzahlen.naechte)} hinweis={kennzahlen.eigen ? `+ ${kennzahlen.eigen} Eigennutzung` : undefined} />
                <MonatsKennzahl titel="Auslastung" wert={prozent(kennzahlen.auslastung, 0)} />
                <MonatsKennzahl
                  titel="Auszahlung netto"
                  wert={kennzahlen.payout === null ? BETRAG_KURZ : formatCurrency(kennzahlen.payout, kennzahlen.currency, 0)}
                />
              </View>
            ) : null}

          <Kachel>
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              {WOCHENTAGE.map((w) => (
                <Txt key={w} v="xs" soft style={{ flex: 1, textAlign: "center", fontFamily: t.fonts.medium }}>
                  {w}
                </Txt>
              ))}
            </View>

            {!tage ? (
              <View style={{ paddingVertical: 40 }}>
                <Spinner />
              </View>
            ) : (
              <View>
                {wochen.map((woche, wi) => (
                  <Wochenzeile
                    key={`w${wi}`}
                    woche={woche}
                    segmente={segmenteBilden(woche, aufenthalte)}
                    heute={heute}
                    tage={tage}
                    saisonMap={saisonMap}
                    gesperrtFarbe={gesperrtFarbe}
                    aufAuswahl={setAuswahl}
                  />
                ))}
              </View>
            )}

            {/* Legende als Pillen: Kanäle des Monats, Eigennutzung nur wenn
                vorhanden, dann die beiden festen Zustände. */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {kanaeleImMonat.map((k) => (
                <Legende key={k.farbe} farbe={k.farbe} label={k.label} />
              ))}
              {eigennutzungImMonat ? <Legende farbe={gesperrtFarbe} label="Eigennutzung" /> : null}
              <Legende farbe={gesperrtFarbe} label="Gesperrt" rahmen />
              <Legende farbe={t.palette.surface} label="Frei" rahmen />
              {saisons.map((s) => (
                // Die Farbe kommt als Hex AUS DER DB — ein Datenwert.
                <Legende key={s.id} farbe={s.color} label={`Saison ${s.name}`} rund />
              ))}
            </View>
          </Kachel>
          </>
        ) : null}
      </ScrollView>

      {/* Detail als Blatt statt Kachel unter dem Raster — wie das Web-Tooltip,
          nur berührbar. */}
      <Detail
        auswahl={auswahl}
        tag={auswahl?.art === "tag" ? (tage?.get(auswahl.wert) ?? null) : null}
        saison={auswahl?.art === "tag" ? (saisonMap.get(auswahl.wert) ?? null) : null}
        gesperrtFarbe={gesperrtFarbe}
        schliessen={() => setAuswahl(null)}
      />

      {objekte && objekte.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", left: t.density.pad, right: t.density.pad, bottom: unterkante + 14 }}
        >
          <Btn
            variant="dark"
            block
            iconR="fwd"
            onPress={() => navigation.navigate("SperrAntrag", { propertyId: gewaehlt ?? undefined })}
          >
            Aufenthalt buchen
          </Btn>
        </View>
      ) : null}
    </View>
  );
}

/** Runder Blätter-Knopf (Vorlage: graue Kreise mit Pfeil). */
function RundKnopf({ icon, label, auf }: { icon: "back" | "fwd"; label: string; auf: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={auf}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: t.palette.surface2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon n={icon} s={18} sw={2} c={t.palette.ink} />
    </Pressable>
  );
}

function MonatsKennzahl({ titel, wert, hinweis }: { titel: string; wert: string; hinweis?: string }) {
  return (
    <Kachel style={{ flex: 1 }} pad={12}>
      <Txt v="xs" soft numberOfLines={1}>
        {titel}
      </Txt>
      <Txt v="title" numberOfLines={1} style={{ marginTop: 4, fontSize: 17 }}>
        {wert}
      </Txt>
      {hinweis ? (
        <Txt v="xs" faint numberOfLines={1} style={{ fontSize: 10 }}>
          {hinweis}
        </Txt>
      ) : null}
    </Kachel>
  );
}

// ---------------------------------------------------------------------------

function Wochenzeile({
  woche,
  segmente,
  heute,
  tage,
  saisonMap,
  gesperrtFarbe,
  aufAuswahl,
}: {
  woche: (string | null)[];
  segmente: Segment[];
  heute: string;
  tage: Map<string, PortalCalendarDay>;
  saisonMap: Map<string, PortalSeason>;
  gesperrtFarbe: string;
  aufAuswahl: (a: Auswahl) => void;
}) {
  const t = useTheme();
  const { sichtbar, ueberlauf } = useMemo(() => bahnenVerteilen(segmente), [segmente]);
  // Feste Höhe für alle Wochen; nur eine Woche mit „+n" bekommt die Bahn dazu.
  const hoehe = ueberlauf.size > 0 ? ZEILE_H + CHIP_H + CHIP_ABSTAND : ZEILE_H;

  return (
    <View style={{ height: hoehe, borderTopWidth: 1, borderTopColor: t.palette.line }}>
      <View style={{ flexDirection: "row", height: "100%" }}>
        {woche.map((datum, i) =>
          datum ? (
            <Tageszelle
              key={datum}
              datum={datum}
              istHeute={datum === heute}
              info={tage.get(datum) ?? null}
              saison={saisonMap.get(datum) ?? null}
              gesperrtFarbe={gesperrtFarbe}
              auf={() => aufAuswahl({ art: "tag", wert: datum })}
            />
          ) : (
            <View key={`leer${i}`} style={{ flex: 1 }} />
          ),
        )}
      </View>
      {/* Chip-Ebene über den Zellen. `box-none`: die Ebene selbst fängt keine
          Berührung ab, nur die Chips — die Zelle bleibt darunter antippbar. */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
        {sichtbar.map(({ segment, bahn }) => (
          <AufenthaltChip
            key={segment.key}
            segment={segment}
            bahn={bahn}
            gesperrtFarbe={gesperrtFarbe}
            auf={() => aufAuswahl({ art: "aufenthalt", wert: segment.aufenthalt })}
          />
        ))}
        {[...ueberlauf.entries()].map(([spalte, rest]) => (
          <SammelChip key={`plus${spalte}`} spalte={spalte} rest={rest} />
        ))}
      </View>
    </View>
  );
}

function Tageszelle({
  datum,
  istHeute,
  info,
  saison,
  gesperrtFarbe,
  auf,
}: {
  datum: string;
  istHeute: boolean;
  info: PortalCalendarDay | null;
  saison: PortalSeason | null;
  gesperrtFarbe: string;
  auf: () => void;
}) {
  const t = useTheme();
  const tag = Number(datum.slice(8, 10));
  const gesperrt = info?.status === "blocked";
  const vergangen = datum < iso(new Date());
  const einheiten = info && info.units_total > 1 ? `${info.units_booked}/${info.units_total}` : null;
  return (
    <Pressable
      onPress={auf}
      accessibilityLabel={`${kurzDatum(datum)}${gesperrt ? ", gesperrt" : ""}`}
      style={{
        flex: 1,
        marginHorizontal: 1,
        marginVertical: 2,
        borderRadius: 8,
        // Gesperrt: gedeckter Ton mit Deckkraft (8-stelliges Hex), sonst randlos.
        backgroundColor: gesperrt ? `${gesperrtFarbe}1F` : "transparent",
      }}
    >
      <View style={{ alignItems: "center", paddingTop: 4, height: KOPF_H }}>
        {istHeute ? (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: t.palette.ink,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt v="xs" color={t.palette.bg} style={{ fontSize: 12, lineHeight: 14, fontFamily: t.fonts.semibold }}>
              {tag}
            </Txt>
          </View>
        ) : (
          <Txt
            v="xs"
            color={vergangen ? t.palette.faint : t.palette.ink}
            style={{ fontSize: 13, lineHeight: 16, fontFamily: t.fonts.medium, marginTop: 3 }}
          >
            {tag}
          </Txt>
        )}
        {/* Saison als Punkt unter der Zahl in VOLLER Deckkraft — nur so bleibt
            die Farbe mit dem Legendenpunkt abgleichbar. */}
        {saison ? (
          <View style={{ position: "absolute", right: 4, top: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: saison.color }} />
        ) : null}
        {einheiten ? (
          <Txt v="xs" faint style={{ position: "absolute", left: 3, top: 4, fontSize: 8, lineHeight: 10 }}>
            {einheiten}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Waagerechte Lage eines Chips in Prozent — mit halben Tagen an den ECHTEN Kanten. */
function chipLage(segment: Segment): { links: number; breite: number } {
  const linksVersatz = segment.echterAnfang ? HALBER_TAG : 0;
  const rechtsZugabe = segment.echtesEnde ? HALBER_TAG : 0;
  const links = (segment.spalte + linksVersatz) * SPALTE;
  const roh = (segment.breite - linksVersatz + rechtsZugabe) * SPALTE;
  // Nie über die Zeile hinaus: der Betrag muss vollständig lesbar bleiben.
  return { links, breite: Math.min(roh, 100 - links) };
}

function AufenthaltChip({
  segment,
  bahn,
  gesperrtFarbe,
  auf,
}: {
  segment: Segment;
  bahn: number;
  gesperrtFarbe: string;
  auf: () => void;
}) {
  const t = useTheme();
  const a = segment.aufenthalt;
  const kanal = kanalAusQuelle(a.quelle);
  const logo = kanal ? portalLogo(kanal) : null;
  const label = kanal ? kanalLabel(kanal, a.quelle) : "";
  // Der NACHTWERT, nicht die Aufenthaltssumme — siehe Kopf der Datei.
  const betrag = a.proNacht == null ? null : formatCurrency(a.proNacht, a.currency, 0);
  const { links, breite } = chipLage(segment);

  const lage = {
    position: "absolute" as const,
    left: `${links}%` as const,
    width: `${breite}%` as const,
    top: KOPF_H + bahn * (CHIP_H + CHIP_ABSTAND),
    height: CHIP_H,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingHorizontal: 6,
    // Ein heller Rand trennt den Chip von der getönten Zelle darunter.
    borderWidth: 1,
    borderColor: t.palette.surface,
    borderTopLeftRadius: segment.echterAnfang ? 999 : 0,
    borderBottomLeftRadius: segment.echterAnfang ? 999 : 0,
    borderTopRightRadius: segment.echtesEnde ? 999 : 0,
    borderBottomRightRadius: segment.echtesEnde ? 999 : 0,
  };

  // Eigennutzung: eigener Chip — kein Logo (es gab kein Portal), kein Vorname
  // (kein Gast), keine Betragszeile (nichts auszuzahlen).
  if (a.eigennutzung) {
    return (
      <Pressable onPress={auf} accessibilityLabel="Eigennutzung" style={[lage, { backgroundColor: gesperrtFarbe }]}>
        <Icon n="home" s={12} sw={2} c={CHIP_TEXT} />
        <Txt v="xs" color={CHIP_TEXT} numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>
          Eigennutzung
        </Txt>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={auf}
      accessibilityLabel={`${label}${a.gast ? `, ${a.gast}` : ""}`}
      style={[lage, { backgroundColor: kanalFarbe(kanal) }]}
    >
      {logo ? (
        // WORTMARKE: Höhe vorgeben, Breite dazu — in ein Quadrat gezwungen wäre
        // sie 3 px hoch und unlesbar. Weißer Grund, weil dunkle Marken auf der
        // Kanalfarbe sonst untergehen (wie im Web).
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 2, paddingHorizontal: 2 }}>
          <Image source={logo} resizeMode="contain" style={{ width: 30, height: 10 }} accessibilityLabel={label} />
        </View>
      ) : label ? (
        <Txt v="xs" color={CHIP_TEXT} numberOfLines={1} style={{ fontSize: 10, lineHeight: 13, opacity: 0.9 }}>
          {label}
        </Txt>
      ) : null}
      {/* Nur der VORNAME (§4.2). Er ist das einzige Element, das nachgeben darf. */}
      {a.gast ? (
        <Txt v="xs" color={CHIP_TEXT} numberOfLines={1} style={{ flexShrink: 1, fontSize: 11, lineHeight: 14 }}>
          {a.gast}
        </Txt>
      ) : null}
      {/* Der Betrag steht NUR am echten Ende — sonst läse sich ein Aufenthalt
          über zwei Wochenzeilen wie zwei Zahlungen. */}
      {segment.echtesEnde ? (
        <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "baseline", gap: 3, flexShrink: 0 }}>
          <Txt v="xs" color={CHIP_TEXT} style={{ fontSize: 9, lineHeight: 12, opacity: 0.75 }}>
            netto/Nacht
          </Txt>
          <Txt
            v={betrag ? "bold" : "xs"}
            color={CHIP_TEXT}
            style={{ fontSize: 11, lineHeight: 14, fontStyle: betrag ? "normal" : "italic" }}
          >
            {betrag ?? BETRAG_KURZ}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

/** „+n" für die Einheiten, die nicht mehr als eigener Chip passen. */
function SammelChip({ spalte, rest }: { spalte: number; rest: Ueberlauf }) {
  const t = useTheme();
  const betrag = rest.summe == null ? null : formatCurrency(rest.summe, rest.currency, 0);
  return (
    <View
      style={{
        position: "absolute",
        left: `${spalte * SPALTE}%`,
        width: `${SPALTE}%`,
        top: KOPF_H + MAX_BAHNEN * (CHIP_H + CHIP_ABSTAND),
        height: CHIP_H,
        borderRadius: 999,
        backgroundColor: t.palette.surface2,
        borderWidth: 1,
        borderColor: t.palette.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt v="xs" numberOfLines={1} style={{ fontSize: 10, lineHeight: 12 }}>
        +{rest.anzahl}
        {betrag ? ` · ${betrag}` : ""}
      </Txt>
    </View>
  );
}

function Legende({
  farbe,
  label,
  rahmen,
  rund,
}: {
  farbe: string;
  label: string;
  rahmen?: boolean;
  rund?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: t.palette.surface2,
      }}
    >
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: rund ? 5 : 2,
          backgroundColor: rahmen && farbe === t.palette.surface ? farbe : rahmen ? `${farbe}40` : farbe,
          borderWidth: rahmen ? 1 : 0,
          borderColor: t.palette.line,
        }}
      />
      <Txt v="xs" soft style={{ fontSize: 11 }}>
        {label}
      </Txt>
    </View>
  );
}

/** Ersatz für den Web-Tooltip: die Angaben zum angetippten Chip oder Tag. */
function Detail({
  auswahl,
  tag,
  saison,
  gesperrtFarbe,
  schliessen,
}: {
  auswahl: Auswahl;
  tag: PortalCalendarDay | null;
  saison: PortalSeason | null;
  gesperrtFarbe: string;
  schliessen: () => void;
}) {
  const t = useTheme();
  const zeilen: { k: string; v: string }[] = [];
  let titel = "";
  let farbe: string | null = null;

  if (!auswahl) {
    return <Blatt offen={false} titel="" schliessen={schliessen}>{null}</Blatt>;
  }

  if (auswahl.art === "aufenthalt") {
    const a = auswahl.wert;
    const kanal = kanalAusQuelle(a.quelle);
    titel = a.eigennutzung ? "Eigennutzung" : (a.gast ?? "Buchung");
    farbe = a.eigennutzung ? gesperrtFarbe : kanalFarbe(kanal);
    zeilen.push({ k: "Zeitraum", v: `${kurzDatum(a.von)} – ${kurzDatum(a.bis)}` });
    zeilen.push({ k: "Nächte", v: String(a.naechte) });
    if (!a.eigennutzung) {
      if (kanal) zeilen.push({ k: "Buchungsquelle", v: kanalLabel(kanal, a.quelle) });
      // Spanne bei Saisonwechsel, sonst der Nachtwert, sonst der GRUND — nie ein
      // stummer Gedankenstrich.
      const spanne =
        a.minProNacht != null && a.maxProNacht != null && a.minProNacht !== a.maxProNacht
          ? `${formatCurrency(a.minProNacht, a.currency, 0)} – ${formatCurrency(a.maxProNacht, a.currency, 0)}`
          : null;
      const betrag = a.proNacht == null ? null : formatCurrency(a.proNacht, a.currency, 0);
      zeilen.push({ k: "Netto-Auszahlung/Nacht", v: spanne ?? betrag ?? grundText(a.grund) });
    }
  } else {
    titel = kurzDatum(auswahl.wert);
    const status = tag?.status ?? "open";
    zeilen.push({
      k: "Belegung",
      v: status === "booked" ? "Belegt" : status === "blocked" ? "Gesperrt" : "Frei",
    });
    if (saison) zeilen.push({ k: "Saison", v: saison.name });
    if (tag && tag.units_total > 1) {
      zeilen.push({ k: "Einheiten", v: `${tag.units_booked} von ${tag.units_total} belegt` });
    }
    // Belegt, aber kein Betrag ausweisbar: auch die ZELLE nennt den Grund.
    if (tag && tag.status === "booked" && tag.owner_payout_per_night == null) {
      zeilen.push({ k: "Netto-Auszahlung/Nacht", v: grundText(tag.owner_payout_unknown_reason) });
    }
  }

  return (
    <Blatt offen titel={titel} schliessen={schliessen}>
      <View style={{ backgroundColor: t.palette.surface2, borderRadius: 12, overflow: "hidden" }}>
        {zeilen.map((z, i) => (
          <View
            key={z.k}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.palette.line,
            }}
          >
            {i === 0 && farbe ? <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: farbe }} /> : null}
            <Txt v="sm" soft style={{ flex: 1 }}>
              {z.k}
            </Txt>
            <Txt v="sm" numberOfLines={2} style={{ flexShrink: 1, textAlign: "right", fontFamily: t.fonts.semibold }}>
              {z.v}
            </Txt>
          </View>
        ))}
      </View>
      <View style={{ height: 8 }} />
    </Blatt>
  );
}
