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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, View, type LayoutChangeEvent } from "react-native";
import {
  Gesture,
  GestureDetector,
  type GestureType,
  // Die antippbaren Flächen im Raster und der Roll-Bereich kommen aus
  // gesture-handler. Beim Pressable ist das die Voraussetzung dafür, dass
  // `onTouchMove` während eines langen Drucks weiterläuft; beim Roll-Bereich
  // hält es das Rollen aus dem Weg, solange gezogen wird.
  Pressable as GestenPressable,
  ScrollView as GestenScrollView,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Blatt } from "@/components/ui/Blatt";
import { Btn, Kachel, Spinner, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { useAuth } from "@/contexts/AuthContext";
import { useSprache, useT } from "@/contexts/SprachContext";
import { formatCurrency } from "@/lib/currency";
import {
  type Aufenthalt,
  betragKurz,
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
import { alsAbreiseWaehlbar } from "@/lib/aufenthalt";
import { kanalAusQuelle, kanalLabel } from "@/lib/kanaele";
import {
  getOwnerCalendar,
  getOwnerProperties,
  getOwnerSeasons,
  moveReservation,
  type PortalCalendarDay,
  type PortalProperty,
  type PortalSeason,
} from "@/lib/ownerPortal";
import { portalLogo } from "@/lib/portal-logos";
import { useRealtime } from "@/lib/realtime";
import { monatName, naechte as naechteZwischen, prozent, tagPlus, wochentagKurz } from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { kanalFarbe } from "@/theme/kanalfarben";
import { useTheme } from "@/theme/ThemeProvider";

/** Die Rasterspalten, Montag zuerst — die Zahlen sind die Schlüssel in `wtagKurz.*`. */
const WOCHENTAGE = [1, 2, 3, 4, 5, 6, 7];

// Geometrie der Wochenzeile (px). Der Chip ist so hoch wie eine Zeile Text
// samt Luft; zwei Bahnen fest, eine dritte nur, wenn eine Woche „+n" trägt.
const KOPF_H = 30;
const CHIP_H = 26;
const CHIP_ABSTAND = 4;
const FUSS_H = 6;
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

/** Volle Wochen, montagsbeginnend, mit den Randtagen der Nachbarmonate. */
export function rasterVolleWochen(jahr: number, monat: number): Date[] {
  const erster = new Date(jahr, monat, 1);
  const vorlauf = (erster.getDay() + 6) % 7;
  const tage = new Date(jahr, monat + 1, 0).getDate();
  const gesamt = Math.ceil((vorlauf + tage) / 7) * 7;
  const zellen: Date[] = [];
  for (let i = 0; i < gesamt; i += 1) zellen.push(new Date(jahr, monat, 1 - vorlauf + i));
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
  const { t: txt, sprache } = useSprache();
  const t = useTheme();
  const { me } = useAuth();
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

  const zellen = useMemo(() => rasterVolleWochen(monat.jahr, monat.monat), [monat]);
  const monatsPraefix = `${monat.jahr}-${String(monat.monat + 1).padStart(2, "0")}`;

  const monatLaden = useCallback(async () => {
    if (!gewaehlt) return;
    setTage(null);
    // Das ganze Blatt laden, nicht nur den Monat: die Randtage der
    // Nachbarmonate tragen ihre Belegung mit.
    const erste = zellen[0];
    const letzte = zellen[zellen.length - 1];
    const start = iso(erste);
    const folge = new Date(letzte);
    folge.setDate(folge.getDate() + 1);
    const ende = iso(folge);
    const res = await getOwnerCalendar(gewaehlt, start, ende);
    if (res.ok) {
      setTage(new Map(res.data.days.map((d) => [d.date, d])));
      setFehler(null);
    } else {
      setTage(new Map());
      setFehler(res.error);
    }
  }, [gewaehlt, zellen]);

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
  const wochen = useMemo(() => wochenBilden(zellen.map((z) => iso(z))), [zellen]);
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

  const monatsName = `${monatName(txt, monat.monat)} ${monat.jahr}`;

  // ZIEHEN über Tage wählt einen Zeitraum für die Eigennutzung (Ansage
  // 08.09.2026): langer Druck startet, die Fläche unter dem Finger wird
  // markiert, Loslassen öffnet das Buchungsblatt mit Anreise/Abreise vorbelegt.
  // Buchungen selbst verschiebt der Eigentümer NICHT — das ist Sache der
  // Verwaltung (CLAUDE.md Regel 2: er beantragt, er plant nicht um).
  const [zieh, setZieh] = useState<{ von: string; bis: string } | null>(null);
  const ziehRef = useRef<{ von: string; bis: string } | null>(null);
  const wochenRef = useRef<(string | null)[][]>([]);
  wochenRef.current = wochen;

  // DIAGNOSE (Ansage 08.09.2026: „ich will sofort wissen, warum Drag and Drop
  // nicht geht — debuggen"). Jeder Schritt der Geste schreibt hier hinein, und
  // das Band unter dem Raster zeigt es AUF DEM BILDSCHIRM. Aus den Pixeln
  // allein war nicht zu erkennen, ob der Pan gar nicht startet, ob die
  // Trefferberechnung danebenliegt oder ob die Freiheitsprüfung am Ende
  // abweist — drei verschiedene Fehler, die gleich aussehen.
  //
  // Nur in der Entwicklung: in der veröffentlichten App ist `__DEV__` falsch,
  // dann wird nichts gesammelt und nichts gezeigt.
  const [diag, setDiag] = useState<string[]>([]);
  const merken = useCallback((zeile: string) => {
    if (!__DEV__) return;
    // Zusätzlich ins Log: das Band zeigt es dem Auge, das Log macht es von
    // außen lesbar (`xcrun simctl spawn booted log stream`) — ohne das muss
    // jemand danebenstehen und abtippen.
    console.log(`[zieh] ${zeile}`);
    setDiag((alt) => [zeile, ...alt].slice(0, 6));
  }, []);

  // BUCHUNG VERSCHIEBEN (Drag-and-Drop, Ansage 08.09.2026).
  //
  // Der Eigentümer greift einen Chip und legt ihn auf andere Tage. Gerechnet
  // wird serverseitig über `POST /public-portal/reservations/{id}/move` — dort
  // hängt die ganze Gegenzustands-Kette (alte Nächte frei, neue belegt,
  // Portale nachgezogen). Die App verschiebt nichts selbst; sie zeigt nur die
  // Vorschau und lädt danach neu.
  const [greift, setGreift] = useState<{
    aufenthalt: Aufenthalt;
    /** Verschiebung in TAGEN gegenüber der ursprünglichen Anreise. */
    versatz: number;
  } | null>(null);
  const greiftRef = useRef<typeof greift>(null);
  const [schiebt, setSchiebt] = useState(false);
  const startTagRef = useRef<string | null>(null);

  const aufGreifen = useCallback(
    (a: Aufenthalt, datum: string) => {
      // Eigennutzung ist keine Buchung — sie hat keine Reservierung, die der
      // Server verschieben könnte.
      if (a.eigennutzung) return;
      greiftRef.current = { aufenthalt: a, versatz: 0 };
      startTagRef.current = datum;
      setGreift(greiftRef.current);
      merken(`GREIFT ${a.gast ?? "Buchung"} ab ${a.von}`);
    },
    [merken],
  );

  // ZEITRAUM ZIEHEN — die Handler sitzen AN DER TAGESZELLE, nicht an einer
  // Geste über dem Raster.
  //
  // Gemessen am 08.09.2026 über das Diagnose-Band: eine `Pan` über dem Raster
  // meldete „BEGIN", danach sofort „FINALIZE ohne Start" — sie wurde nie
  // aktiv. `activateAfterLongPress` verlangt nämlich, dass der Finger nach
  // Ablauf der Frist NOCH IN BEWEGUNG ist; wer erst hält und dann zieht, wie
  // der Hinweistext es sagt, fällt durch. Ein `LongPress` an derselben Stelle
  // sah die Berührung überhaupt nicht mehr: die Zelle ist ein Pressable und
  // beansprucht sie für sich.
  //
  // Deshalb jetzt gewöhnliche Touch-Ereignisse der Zelle: `onLongPress`
  // beginnt, `onTouchMove` erweitert, `onTouchEnd` schließt ab. Sie kommen
  // garantiert an, weil das Pressable die Berührung ohnehin hält.
  const haltenRef = useRef(false);
  // Die Bildschirmposition jeder Wochenzeile, um aus einem Fingerpunkt den
  // Tag zu bestimmen. `measureInWindow` statt `onLayout`: der Finger liefert
  // Seitenkoordinaten, und nur so liegen beide im selben Bezugssystem.
  const zeilenFenster = useRef<{ x: number; y: number; b: number; h: number }[]>([]);
  const zeilenRefs = useRef<(View | null)[]>([]);

  const tagAnPunkt = useCallback((seiteX: number, seiteY: number): string | null => {
    const zeile = zeilenFenster.current.findIndex(
      (z) => z && seiteY >= z.y && seiteY < z.y + z.h && seiteX >= z.x && seiteX < z.x + z.b,
    );
    if (zeile < 0) return null;
    const lage = zeilenFenster.current[zeile];
    const spalte = Math.max(0, Math.min(6, Math.floor(((seiteX - lage.x) / lage.b) * 7)));
    return wochenRef.current[zeile]?.[spalte] ?? null;
  }, []);

  const aufBeruehrt = useCallback(
    (datum: string) => {
      merken(`BERÜHRT ${datum}`);
    },
    [merken],
  );

  const aufHalten = useCallback(
    (datum: string) => {
      haltenRef.current = true;
      ziehRef.current = { von: datum, bis: datum };
      setZieh(ziehRef.current);
      merken(`HALTEN ${datum}`);
    },
    [merken],
  );

  const aufZiehen = useCallback(
    (seiteX: number, seiteY: number) => {
      // Ein gegriffener Chip hat Vorrang: dann verschiebt der Finger eine
      // Buchung, statt einen neuen Zeitraum zu wählen.
      const g = greiftRef.current;
      if (g) {
        const tag = tagAnPunkt(seiteX, seiteY);
        if (!tag || !startTagRef.current) return;
        const versatz = naechteZwischen(startTagRef.current, tag);
        if (versatz === g.versatz) return;
        greiftRef.current = { ...g, versatz };
        setGreift(greiftRef.current);
        return;
      }
      if (!haltenRef.current || !ziehRef.current) return;
      const tag = tagAnPunkt(seiteX, seiteY);
      if (!tag) {
        merken(`ZIEHEN: kein Tag bei y=${Math.round(seiteY)} (${zeilenFenster.current.length} Zeilen)`);
        return;
      }
      if (tag === ziehRef.current.bis) return;
      ziehRef.current = { von: ziehRef.current.von, bis: tag };
      setZieh(ziehRef.current);
      merken(`ZIEHEN bis ${tag}`);
    },
    [tagAnPunkt, merken],
  );

  // Die Bewegung liefert eine Pan-Geste ÜBER dem Raster. Sie darf neben den
  // Pressables der Zellen laufen (`simultaneousWithExternalGesture` dort auf
  // `ziehGesteRef`) — ohne das nähme das Pressable ihr die Berührung ab.
  // Auswerten tut sie nur, wenn der lange Druck schon durch ist.
  // Die Geste wird EINMAL gebaut und nie neu: ein neues Gesture-Objekt bei
  // jeder Änderung von `tage` hätte die laufende Berührung abgerissen. Die
  // Handler erreicht sie über Refs, die jeder Render frisch setzt.
  const ziehGesteRef = useRef<GestureType | undefined>(undefined);
  const ziehenRef = useRef<(x: number, y: number) => void>(() => {});
  const loslassenRef = useRef<() => void>(() => {});
  const ziehGeste = useMemo(
    () =>
      Gesture.Pan()
        .withRef(ziehGesteRef)
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        // `onTouchesMove`/`onTouchesUp` statt `onUpdate`/`onFinalize`: die
        // rohen Berührungs-Callbacks feuern bei JEDEM Touch-Ereignis, auch
        // wenn die Geste nie aktiviert wird (belegt im Paket,
        // `eventReceiver.js`). `onUpdate` käme nur bei aktiver Geste — und
        // aktiv wird sie neben den Pressables der Zellen nicht. Genau daran
        // scheiterten alle vorherigen Fassungen.
        .onTouchesMove((e) => {
          const p = e.allTouches[0];
          if (p) ziehenRef.current(p.absoluteX, p.absoluteY);
        })
        .onTouchesUp(() => loslassenRef.current())
        .onTouchesCancelled(() => loslassenRef.current()),
    [],
  );

  const aufLoslassen = useCallback(() => {
    const g = greiftRef.current;
    if (g) {
      greiftRef.current = null;
      startTagRef.current = null;
      setGreift(null);
      if (g.versatz === 0) return;
      const a = g.aufenthalt;
      // `bis` ist die letzte belegte NACHT; der Server will den Abreisetag
      // (exklusiv), also einen Tag später. Dieselbe Umrechnung wie überall.
      const neuVon = tagPlus(a.von, g.versatz);
      const neuBis = tagPlus(tagPlus(a.bis, 1), g.versatz);
      merken(`ABSETZEN ${a.von} → ${neuVon} (${g.versatz} Tage)`);
      setSchiebt(true);
      void moveReservation(a.reservationId, neuVon, neuBis).then((res) => {
        setSchiebt(false);
        if (!res.ok) {
          // Der Server nennt den Grund (409 belegt, 422 Preis fehlt). Ihn zu
          // verschlucken hieße: der Chip springt zurück und niemand weiß warum.
          Alert.alert(txt("kal.nichtVerschoben"), res.error);
          return;
        }
        void monatLaden();
      });
      return;
    }
    if (!haltenRef.current) return;
    haltenRef.current = false;
    const z = ziehRef.current;
    ziehRef.current = null;
    setZieh(null);
    if (!z || !gewaehlt || !tage) return;
    const [von, bis] = z.von <= z.bis ? [z.von, z.bis] : [z.bis, z.von];
    // Der zuletzt berührte Tag IST der Abreisetag — so zählt auch das
    // Buchungsblatt (`aufenthaltNaechte(von, bis)`).
    if (von === bis) {
      merken(`ENDE: nur EIN Tag (${von})`);
      return;
    }
    // NICHT über belegte Nächte hinweg: jede Nacht von der Anreise bis VOR die
    // Abreise muss frei sein — der Abreisetag selbst darf belegt sein, dort
    // reist der nächste Gast an.
    if (!alsAbreiseWaehlbar(tage, von, bis)) {
      merken(`ENDE: ${von}→${bis} belegt`);
      return;
    }
    merken(`ENDE: Antrag ${von} → ${bis}`);
    navigation.navigate("SperrAntrag", { propertyId: gewaehlt, von, bis });
  }, [gewaehlt, navigation, tage, merken, monatLaden, txt]);

  ziehenRef.current = aufZiehen;
  loslassenRef.current = aufLoslassen;

  const kennzahlen = useMemo(
    () => (tage ? monatsKennzahlen([...tage.values()].filter((d) => d.date.startsWith(monatsPraefix))) : null),
    [tage, monatsPraefix],
  );
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
        titel={txt("kal.titel")}
        name={me?.full_name}
        email={me?.email}
        aufProfil={() => navigation.navigate("Mehr")}
      />

      {objekte && objekte.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: t.density.pad, gap: 8, paddingBottom: 12, alignItems: "center" }}
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

      <GestenScrollView
        // Während gezogen wird, rollt die Seite NICHT — sonst wandert unter
        // dem Finger das Raster weg und die Auswahl springt.
        //
        // Der Roll-Bereich ist der aus gesture-handler, nicht der aus React
        // Native: nur dann kennt die native Erkennung beide Gesten und lässt
        // den langen Druck seine 220 ms laufen, statt die Berührung beim
        // ersten Millimeter Bewegung dem Rollen zuzuschlagen (gemeldet
        // 08.09.2026: „jetzt ist das Drag-and-Drop kaputt"). Reanimated
        // braucht er nicht — die App hat es nicht, und `Gesture.Native()`
        // hätte genau daran gescheitert.
        scrollEnabled={zieh === null}
        contentContainerStyle={{
          padding: t.density.pad,
          paddingTop: 0,
          paddingBottom: 120,
          gap: KARTE_ABSTAND,
        }}
      >
        {!objekte && !fehler ? <Spinner /> : null}

        {fehler ? (
          <Kachel>
            <Txt v="title">{txt("kal.nichtGeladen")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}

        {objekte && objekte.length === 0 ? (
          <Kachel>
            <Txt v="title">{txt("start.keinObjekt")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {txt("kal.keinObjektText")}
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
              <RundKnopf icon="back" label={txt("kal.vorherigerMonat")} auf={() => blaettern(-1)} />
              <RundKnopf icon="fwd" label={txt("kal.naechsterMonat")} auf={() => blaettern(1)} />
            </View>

            {/* Kennzahlen des Monats — dieselbe Zahl wie die Chips, nur summiert. */}
            {kennzahlen ? (
              <View style={{ flexDirection: "row", gap: KARTE_ABSTAND }}>
                <MonatsKennzahl titel={txt("kennzahl.naechte")} wert={String(kennzahlen.naechte)} hinweis={kennzahlen.eigen ? txt("kennzahl.eigennutzung", { anzahl: kennzahlen.eigen }) : undefined} />
                <MonatsKennzahl titel={txt("kennzahl.auslastung")} wert={prozent(sprache, kennzahlen.auslastung, 0)} />
                <MonatsKennzahl
                  titel={txt("kennzahl.auszahlung")}
                  wert={kennzahlen.payout === null ? betragKurz(txt) : formatCurrency(kennzahlen.payout, kennzahlen.currency, 0)}
                />
              </View>
            ) : null}

          <Kachel>
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              {WOCHENTAGE.map((w) => (
                <Txt key={w} v="xs" soft style={{ flex: 1, textAlign: "center", fontFamily: t.fonts.medium }}>
                  {wochentagKurz(txt, w === 7 ? 0 : w)}
                </Txt>
              ))}
            </View>

            {!tage ? (
              <View style={{ paddingVertical: 40 }}>
                <Spinner />
              </View>
            ) : (
              <GestureDetector gesture={ziehGeste}>
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
                    monatsPraefix={monatsPraefix}
                    zieh={zieh}
                    // Die Zeile misst sich IM FENSTER, nicht relativ zum
                    // Elternteil: der Finger liefert Seitenkoordinaten, und nur
                    // im selben Bezugssystem lässt sich daraus ein Tag
                    // bestimmen.
                    onLayout={(_e: LayoutChangeEvent) => {
                      zeilenRefs.current[wi]?.measureInWindow((x, y, b, h) => {
                        zeilenFenster.current[wi] = { x, y, b, h };
                        merken(`zeile ${wi}: y=${Math.round(y)} h=${Math.round(h)} b=${Math.round(b)}`);
                      });
                    }}
                    zeileRef={(v) => {
                      zeilenRefs.current[wi] = v;
                    }}
                    aufAuswahl={setAuswahl}
                    aufBeruehrt={aufBeruehrt}
                    aufHalten={aufHalten}
                    aufGreifen={aufGreifen}
                    greift={greift}
                    ziehGesteRef={ziehGesteRef}
                  />
                  ))}
                </View>
              </GestureDetector>
            )}

            {schiebt ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <Spinner />
                <Txt v="xs" soft>
                  {txt("kal.wirdVerschoben")}
                </Txt>
              </View>
            ) : null}

            <Txt v="xs" faint style={{ marginTop: 10 }}>
              {txt("kal.hinweis")}
            </Txt>

            {/* Diagnose-Band (nur in der Entwicklung). Zeigt die letzten
                sechs Schritte der Zieh-Geste. Sagt beim ersten Blick, WO es
                hakt: kommt kein „BEGIN", erreicht die Berührung den Pan gar
                nicht; kommt „BEGIN" ohne „START", schlägt der lange Druck
                fehl; kommt „START → kein Tag", liegt die Trefferberechnung
                daneben; kommt „ENDE: … nicht wählbar", greift die
                Belegungsprüfung. */}
            {__DEV__ && diag.length > 0 ? (
              <View
                style={{
                  marginTop: 10,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: t.palette.surface2,
                  borderWidth: 1,
                  borderColor: t.palette.line,
                }}
              >
                {diag.map((z, i) => (
                  <Txt key={`${i}-${z}`} v="xs" style={{ fontSize: 10, lineHeight: 14 }}>
                    {z}
                  </Txt>
                ))}
              </View>
            ) : null}

            {/* Legende als Pillen: Kanäle des Monats, Eigennutzung nur wenn
                vorhanden, dann die beiden festen Zustände. */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {kanaeleImMonat.map((k) => (
                <Legende key={k.farbe} farbe={k.farbe} label={k.label} />
              ))}
              {eigennutzungImMonat ? <Legende farbe={gesperrtFarbe} label={txt("kal.eigennutzung")} /> : null}
              <Legende farbe={gesperrtFarbe} label={txt("kal.gesperrt")} rahmen />
              <Legende farbe={t.palette.surface} label={txt("kal.frei")} rahmen />
              {saisons.map((s) => (
                // Die Farbe kommt als Hex AUS DER DB — ein Datenwert.
                <Legende key={s.id} farbe={s.color} label={`Saison ${s.name}`} rund />
              ))}
            </View>
          </Kachel>
          </>
        ) : null}
      </GestenScrollView>

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
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: t.density.pad,
            paddingTop: 10,
            paddingBottom: 10,
            backgroundColor: t.palette.bg,
          }}
        >
          <Btn
            variant="dark"
            block
            iconR="fwd"
            onPress={() => navigation.navigate("SperrAntrag", { propertyId: gewaehlt ?? undefined })}
          >
            {txt("kal.aufenthaltBuchen")}
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
  monatsPraefix,
  zieh,
  onLayout,
  zeileRef,
  aufAuswahl,
  aufBeruehrt,
  aufHalten,
  aufGreifen,
  greift,
  ziehGesteRef,
}: {
  woche: (string | null)[];
  segmente: Segment[];
  heute: string;
  tage: Map<string, PortalCalendarDay>;
  saisonMap: Map<string, PortalSeason>;
  gesperrtFarbe: string;
  monatsPraefix: string;
  zieh: { von: string; bis: string } | null;
  onLayout: (e: LayoutChangeEvent) => void;
  zeileRef: (v: View | null) => void;
  aufAuswahl: (a: Auswahl) => void;
  aufBeruehrt: (datum: string) => void;
  aufHalten: (datum: string) => void;
  aufGreifen: (a: Aufenthalt, datum: string) => void;
  greift: { aufenthalt: Aufenthalt; versatz: number } | null;
  ziehGesteRef: React.MutableRefObject<GestureType | undefined>;
}) {
  const t = useTheme();
  const { sichtbar, ueberlauf } = useMemo(() => bahnenVerteilen(segmente), [segmente]);
  // Höhe nach den BELEGTEN Bahnen dieser Woche (mindestens eine), plus die
  // „+n"-Bahn nur, wo es sie gibt — feste zwei Bahnen ließen leere Wochen
  // als hohe weiße Streifen stehen.
  const bahnen = Math.max(1, ...sichtbar.map((b) => b.bahn + 1), ueberlauf.size > 0 ? MAX_BAHNEN + 1 : 0);
  const hoehe = KOPF_H + bahnen * (CHIP_H + CHIP_ABSTAND) + FUSS_H;

  return (
    <View
      ref={zeileRef}
      onLayout={onLayout}
      style={{ height: hoehe, borderTopWidth: 1, borderTopColor: t.palette.line }}
    >
      <View style={{ flexDirection: "row", height: "100%" }}>
        {woche.map((datum, i) =>
          datum ? (
            <Tageszelle
              key={datum}
              datum={datum}
              istHeute={datum === heute}
              fremd={!datum.startsWith(monatsPraefix)}
              imZieh={
                !!zieh &&
                datum >= (zieh.von <= zieh.bis ? zieh.von : zieh.bis) &&
                datum <= (zieh.von <= zieh.bis ? zieh.bis : zieh.von)
              }
              info={tage.get(datum) ?? null}
              saison={saisonMap.get(datum) ?? null}
              gesperrtFarbe={gesperrtFarbe}
              letzte={i === 6}
              auf={() => aufAuswahl({ art: "tag", wert: datum })}
              aufBeruehrt={() => aufBeruehrt(datum)}
              aufHalten={() => aufHalten(datum)}
              ziehGesteRef={ziehGesteRef}
            />
          ) : (
            <View
              key={`leer${i}`}
              style={{ flex: 1, borderRightWidth: i === 6 ? 0 : 1, borderRightColor: t.palette.line }}
            />
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
            aufGreifen={() => aufGreifen(segment.aufenthalt, segment.aufenthalt.von)}
            // Nur der GEGRIFFENE Aufenthalt wandert. Die Prüfung geht über die
            // Reservierungs-ID, nicht über das Segment: ein Aufenthalt über
            // einen Wochenwechsel hat mehrere Segmente, und alle müssen sich
            // gemeinsam bewegen.
            versatz={greift?.aufenthalt.reservationId === segment.aufenthalt.reservationId ? greift.versatz : 0}
            ziehGesteRef={ziehGesteRef}
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
  letzte,
  fremd,
  imZieh,
  auf,
  aufBeruehrt,
  aufHalten,
  ziehGesteRef,
}: {
  datum: string;
  istHeute: boolean;
  info: PortalCalendarDay | null;
  saison: PortalSeason | null;
  gesperrtFarbe: string;
  letzte: boolean;
  /** Tag des Nachbarmonats — blass, aber mit seiner Belegung. */
  fremd: boolean;
  /** Liegt im gerade gezogenen Zeitraum. */
  imZieh: boolean;
  auf: () => void;
  /** Erste Berührung — belegt, dass die Zelle Touch-Ereignisse bekommt. */
  aufBeruehrt: () => void;
  /** Die Pan-Geste des Rasters, damit sie neben dem Pressable laufen darf. */
  ziehGesteRef: React.MutableRefObject<GestureType | undefined>;
  /** Langer Druck: Zeitraum-Wahl beginnt an DIESEM Tag. */
  aufHalten: () => void;
}) {
  const txt = useT();
  const t = useTheme();
  const tag = Number(datum.slice(8, 10));
  const gesperrt = info?.status === "blocked";
  const vergangen = datum < iso(new Date());
  return (
    <GestenPressable
      onPress={auf}
      // Die Zeitraum-Wahl sitzt AN DER ZELLE, nicht an einer Geste über dem
      // Raster. Gemessen am 08.09.2026: eine `Pan`/`LongPress` über dem Raster
      // sah die Berührung nie — die Zelle ist ein Pressable und beansprucht
      // sie für sich, und weder `Simultaneous` noch der Wechsel auf den
      // ScrollView aus gesture-handler änderten daran etwas.
      //
      // `onLongPress` startet die Auswahl, `onTouchMove` erweitert sie über
      // die Nachbartage, `onTouchEnd` schließt ab. Das sind gewöhnliche
      // Touch-Ereignisse des Pressable — sie kommen garantiert an, weil das
      // Pressable die Berührung ohnehin hat.
      // NUR Props, die das Pressable aus gesture-handler wirklich kennt.
      // `onTouchStart`/`onTouchMove`/`onTouchEnd` gibt es dort NICHT — sie
      // wurden stillschweigend verworfen, und genau daran lag es, dass gar
      // nichts passierte (gemessen am 08.09.2026 an seiner Props-Liste).
      // Die Bewegung liefert deshalb die Pan-Geste über dem Raster, die per
      // `simultaneousWithExternalGesture` neben dem Pressable laufen darf.
      onPressIn={aufBeruehrt}
      onLongPress={aufHalten}
      delayLongPress={220}
      simultaneousWithExternalGesture={ziehGesteRef}
      accessibilityLabel={`${kurzDatum(datum)}${gesperrt ? txt("kal.gesperrtZusatz") : ""}`}
      style={{
        flex: 1,
        // Raster (Ansage 08.09.2026): jede Tageszelle sichtbar abgegrenzt —
        // ohne Linien war nicht zu erkennen, zu welchem Tag ein Chip gehört.
        borderRightWidth: letzte ? 0 : 1,
        borderRightColor: t.palette.line,
        // Gesperrt: gedeckter Ton mit Deckkraft (8-stelliges Hex).
        backgroundColor:
          imZieh && !gesperrt
            ? t.palette.accentSoft
            : gesperrt
              ? `${gesperrtFarbe}1F`
              : "transparent",
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
            color={vergangen || fremd ? t.palette.faint : t.palette.ink}
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
      </View>
    </GestenPressable>
  );
}

/** Waagerechte Lage eines Chips in Prozent — mit halben Tagen an den ECHTEN Kanten. */
function chipLage(segment: Segment): { links: number; breite: number } {
  const linksVersatz = segment.echterAnfang ? HALBER_TAG : 0;
  // Das Segment DECKT den Abreisetag bereits ab (`segmenteBilden` läuft bis
  // dorthin). Am echten Ende wird der Chip deshalb um einen halben Tag
  // GEKÜRZT, damit er in der Mitte des Abreisetags endet — hier stand ein
  // Plus, und ein Aufenthalt mit Abreise am 28. reichte sichtbar in den 29.
  // (gemeldet 08.09.2026). Am Wechseltag teilen sich beide Aufenthalte den Tag.
  const rechtsKuerzung = segment.echtesEnde ? HALBER_TAG : 0;
  const links = (segment.spalte + linksVersatz) * SPALTE;
  const roh = (segment.breite - linksVersatz - rechtsKuerzung) * SPALTE;
  // Nie über die Zeile hinaus: der Betrag muss vollständig lesbar bleiben.
  return { links, breite: Math.min(roh, 100 - links) };
}

function AufenthaltChip({
  segment,
  bahn,
  gesperrtFarbe,
  auf,
  aufGreifen,
  versatz,
  ziehGesteRef,
}: {
  segment: Segment;
  bahn: number;
  gesperrtFarbe: string;
  auf: () => void;
  /** Langer Druck: diese Buchung wird jetzt gezogen. */
  aufGreifen: () => void;
  /** Verschiebung in Tagen, solange dieser Chip gezogen wird (sonst 0). */
  versatz: number;
  ziehGesteRef: React.MutableRefObject<GestureType | undefined>;
}) {
  const txt = useT();
  const t = useTheme();
  const a = segment.aufenthalt;
  const kanal = kanalAusQuelle(a.quelle);
  const logo = kanal ? portalLogo(kanal) : null;
  const label = kanal ? kanalLabel(kanal, a.quelle) : "";
  // Der NACHTWERT, nicht die Aufenthaltssumme — siehe Kopf der Datei.
  const betrag = a.proNacht == null ? null : formatCurrency(a.proNacht, a.currency, 0);
  const { links: rohLinks, breite } = chipLage(segment);
  // Während des Ziehens wandert der Chip mit dem Finger. Das ist eine
  // VORSCHAU: verschoben wird erst beim Absetzen, und zwar vom Server.
  const links = rohLinks + versatz * SPALTE;

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
      <GestenPressable
        onPress={auf}
        accessibilityLabel={txt("kal.eigennutzung")}
        style={[lage, { backgroundColor: gesperrtFarbe }]}
      >
        <Icon n="home" s={12} sw={2} c={CHIP_TEXT} />
        <Txt v="xs" color={CHIP_TEXT} numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>
          {txt("kal.eigennutzung")}
        </Txt>
      </GestenPressable>
    );
  }

  return (
    <GestenPressable
      onPress={auf}
      onLongPress={aufGreifen}
      delayLongPress={220}
      // Ohne das nähme dieses Pressable der Pan-Geste die Berührung ab, und
      // der Chip ließe sich greifen, aber nicht bewegen.
      simultaneousWithExternalGesture={ziehGesteRef}
      accessibilityLabel={`${label}${a.gast ? `, ${a.gast}` : ""}`}
      style={[
        lage,
        { backgroundColor: kanalFarbe(kanal) },
        // Der gezogene Chip hebt sich ab und liegt über den anderen.
        versatz !== 0 ? { opacity: 0.85, zIndex: 10, elevation: 4 } : null,
      ]}
    >
      {/* Logo und Vorname stehen NUR am echten Anfang. Läuft ein Aufenthalt
          über den Wochenwechsel, ist das Stück in der neuen Zeile eine
          Fortsetzung — mit Logo sähe es wie eine zweite Buchung aus (gemeldet
          08.09.2026: „warum ist am Ende jetzt ein zweites Logo"). Die
          Kanalfarbe trägt die Zuordnung über die Zeile hinweg. */}
      {!segment.echterAnfang ? null : logo ? (
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
      {a.gast && segment.echterAnfang ? (
        <Txt v="xs" color={CHIP_TEXT} numberOfLines={1} style={{ flexShrink: 1, fontSize: 11, lineHeight: 14 }}>
          {a.gast}
        </Txt>
      ) : null}
      {/* Der Betrag steht NUR am echten Ende — sonst läse sich ein Aufenthalt
          über zwei Wochenzeilen wie zwei Zahlungen. */}
      {segment.echtesEnde && segment.breite >= 3 ? (
        <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "baseline", gap: 3, flexShrink: 0 }}>
          <Txt v="xs" color={CHIP_TEXT} style={{ fontSize: 9, lineHeight: 12, opacity: 0.75 }}>
            {txt("kal.nettoJeNachtKurz")}
          </Txt>
          <Txt
            v={betrag ? "bold" : "xs"}
            color={CHIP_TEXT}
            style={{ fontSize: 11, lineHeight: 14, fontStyle: betrag ? "normal" : "italic" }}
          >
            {betrag ?? betragKurz(txt)}
          </Txt>
        </View>
      ) : null}
    </GestenPressable>
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
  const txt = useT();
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
    titel = a.eigennutzung ? txt("kal.eigennutzung") : (a.gast ?? txt("allg.buchung"));
    farbe = a.eigennutzung ? gesperrtFarbe : kanalFarbe(kanal);
    zeilen.push({ k: txt("kal.anreiseAbreise"), v: `${kurzDatum(a.von)} – ${kurzDatum(tagPlus(a.bis, 1))}` });
    zeilen.push({ k: txt("kal.naechteLabel"), v: String(a.naechte) });
    if (!a.eigennutzung) {
      if (kanal) zeilen.push({ k: txt("kal.buchungsquelle"), v: kanalLabel(kanal, a.quelle) });
      // Spanne bei Saisonwechsel, sonst der Nachtwert, sonst der GRUND — nie ein
      // stummer Gedankenstrich.
      const spanne =
        a.minProNacht != null && a.maxProNacht != null && a.minProNacht !== a.maxProNacht
          ? `${formatCurrency(a.minProNacht, a.currency, 0)} – ${formatCurrency(a.maxProNacht, a.currency, 0)}`
          : null;
      const betrag = a.proNacht == null ? null : formatCurrency(a.proNacht, a.currency, 0);
      zeilen.push({ k: txt("kal.nettoJeNacht"), v: spanne ?? betrag ?? grundText(txt, a.grund) });
    }
  } else {
    titel = kurzDatum(auswahl.wert);
    const status = tag?.status ?? "open";
    zeilen.push({
      k: txt("kal.belegung"),
      v: txt(status === "booked" ? "kal.belegt" : status === "blocked" ? "kal.gesperrt" : "kal.frei"),
    });
    if (saison) zeilen.push({ k: txt("kal.saison", { name: saison.name }), v: saison.name });
    if (tag && tag.units_total > 1) {
      zeilen.push({
        k: txt("kal.einheiten"),
        v: txt("kal.einheitenBelegt", { belegt: tag.units_booked, gesamt: tag.units_total }),
      });
    }
    // Belegt, aber kein Betrag ausweisbar: auch die ZELLE nennt den Grund.
    if (tag && tag.status === "booked" && tag.owner_payout_per_night == null) {
      zeilen.push({ k: txt("kal.nettoJeNacht"), v: grundText(txt, tag.owner_payout_unknown_reason) });
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
