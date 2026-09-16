// Aufenthalt buchen — der Eigentümer hält Nächte für sich frei (Vorlage:
// Hostaway „Book your stay": Objekt mit „Ändern", Zeitraum im Monatsblatt mit
// durchgestrichenen belegten Tagen, Gäste, Notizen, „Aufenthalt bestätigen →").
//
// WAS PASSIERT: ein SPERRANTRAG (`POST /public-portal/block-requests`). Der
// Eigentümer sperrt nicht selbst; die Verwaltung entscheidet (CLAUDE.md Regel
// 2). Der Knopf heißt darum „Aufenthalt beantragen" — nach dem Tipp ist die
// Nacht nicht frei, sondern der Antrag ist offen.
//
// IDEMPOTENZ (Wurzel 2): der Knopf sperrt sich, solange die Anfrage läuft.
//
// DATUM: Oberfläche = Check-in/Check-out (Abreisetag frei), Antrag = inklusiv.
// Die Umrechnung steht EINMAL in `lib/aufenthalt.ts` (`alsSperrantrag`).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/contexts/SprachContext";
import { Blatt, BlattGruppe, BlattOption } from "@/components/ui/Blatt";
import { Icon } from "@/components/ui/Icon";
import { Btn, Kachel, Photo, Spinner, Txt } from "@/components/ui/kit";
import {
  type Bereich,
  alsAbreiseWaehlbar,
  alsSperrantrag,
  aufenthaltNaechte,
  bereichWaehlen,
  gaesteText,
  nachtFrei,
} from "@/lib/aufenthalt";
import {
  type BestellteLeistung,
  createBlockRequest,
  getBestellbareLeistungen,
  getOwnerCalendar,
  getOwnerProperties,
  getOwnerProperty,
  type PortalCalendarDay,
  type PortalProperty,
  type PortalPropertyDetail,
} from "@/lib/ownerPortal";
import {
  type Uebersetzer,
  ausIso,
  isoLokal,
  monatName,
  monatsEnde,
  spanneLesbar,
  wochentagKurz,
} from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = {
  goBack: () => void;
  navigate: (name: string, params?: Record<string, unknown>) => void;
  // Nur im Stack vorhanden; als Tab wird stattdessen navigiert.
  replace?: (name: string, params?: Record<string, unknown>) => void;
};
type Route = { params?: { propertyId?: string; alsTab?: boolean; von?: string; bis?: string } };

// Montag zuerst (Vorlage: M T W T F S S). Die Zahlen sind die Schlüssel in
// `wtagKurz.*`; Sonntag ist dort 7, nicht 0.
const KOPF = [1, 2, 3, 4, 5, 6, 7];

/** Zellen eines Monatsblatts, montagsbeginnend; `null` = Vorlauf. */
export function monatsZellen(jahr: number, monat: number): (string | null)[] {
  const erster = new Date(jahr, monat, 1, 12);
  const vorlauf = (erster.getDay() + 6) % 7;
  const tage = monatsEnde(jahr, monat).getDate();
  const zellen: (string | null)[] = Array.from({ length: vorlauf }, () => null);
  for (let d = 1; d <= tage; d += 1) zellen.push(isoLokal(new Date(jahr, monat, d, 12)));
  while (zellen.length % 7 !== 0) zellen.push(null);
  return zellen;
}

/** Adresse einer Objektdetail-Zeile: „Strandvej 12, 8400 Ebeltoft". */
export function adresse(d: PortalPropertyDetail | null): string | null {
  if (!d) return null;
  const strasse = [d.street, d.house_number].filter(Boolean).join(" ");
  const ort = [d.postal_code, d.city].filter(Boolean).join(" ");
  const teile = [strasse, ort].filter(Boolean);
  return teile.length ? teile.join(", ") : null;
}

/** „2 Kinder" / „1 Kind" / „Keine Kinder". */
function kinderText(txt: Uebersetzer, n: number): string {
  if (n === 0) return txt("buchen.keineKinder");
  return n === 1 ? txt("buchen.einKind") : txt("buchen.anzahlKinder", { anzahl: n });
}

/** „2 Haustiere" / „1 Haustier" / „Keine Haustiere". */
function haustierText(txt: Uebersetzer, n: number): string {
  if (n === 0) return txt("buchen.keineHaustiere");
  return n === 1 ? txt("buchen.einHaustier") : txt("buchen.anzahlHaustiere", { anzahl: n });
}

export default function AufenthaltBuchen({ navigation, route }: { navigation: Nav; route: Route }) {
  const txt = useT();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const alsTab = route.params?.alsTab === true;
  const [objekte, setObjekte] = useState<PortalProperty[] | null>(null);
  const [objektId, setObjektId] = useState<string | null>(route.params?.propertyId ?? null);
  const [detail, setDetail] = useState<PortalPropertyDetail | null>(null);
  const [objektBlatt, setObjektBlatt] = useState(false);
  const heute = new Date();
  // Vorbelegung aus dem Kalender (Zieh-Auswahl): Anreise/Abreise stehen fest,
  // das Blatt öffnet im Monat der Anreise. Einmal verbraucht — der
  // Objektwechsel-Effekt darunter leert die Auswahl sonst sofort wieder.
  const vorbelegt = useRef<Bereich | null>(
    route.params?.von && route.params?.bis ? { von: route.params.von, bis: route.params.bis } : null,
  );
  const startMonat = vorbelegt.current ? ausIso(vorbelegt.current.von) : heute;
  const [monat, setMonat] = useState({ jahr: startMonat.getFullYear(), monat: startMonat.getMonth() });
  const [tage, setTage] = useState<Map<string, PortalCalendarDay>>(new Map());
  const [geladeneMonate, setGeladeneMonate] = useState<Set<string>>(new Set());
  const [bereich, setBereich] = useState<Bereich | null>(null);
  const [gaeste, setGaeste] = useState(2);
  // Kinder sind eine TEILMENGE der Gästezahl (0608), keine Zugabe: wer 4 Gäste
  // mit 2 Kindern meldet, reist zu viert. Deshalb wird `kinder` mitgesenkt,
  // sobald die Gästezahl darunter fiele — sonst stünde im Antrag „3 Gäste,
  // davon 4 Kinder", und die Verwaltung müsste raten, was gemeint war.
  const [kinder, setKinder] = useState(0);
  // Anzahl, nicht Ja/Nein: die Haustiergebühr fällt je Tier an, und für die
  // Reinigung ist „2 Hunde" eine andere Ansage als „1 Hund".
  const [haustiere, setHaustiere] = useState(0);
  const [notizen, setNotizen] = useState("");
  const [notizenOffen, setNotizenOffen] = useState(false);
  const [leistungen, setLeistungen] = useState<BestellteLeistung[]>([]);
  const [bestellt, setBestellt] = useState<string[]>([]);
  const [leistungenFehler, setLeistungenFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const heuteIso = isoLokal(heute);

  useEffect(() => {
    void getOwnerProperties().then((res) => {
      if (!res.ok) {
        setFehler(res.error);
        setObjekte([]);
        return;
      }
      setObjekte(res.data.items);
      setObjektId((alt) => alt ?? res.data.items[0]?.id ?? null);
    });
  }, []);

  // Objektwechsel: Detail (Adresse, Gästezahl), Leistungen und Kalender neu;
  // Auswahl leeren — sonst stünde ein Zeitraum im Formular, der für DIESES
  // Objekt belegt sein kann.
  useEffect(() => {
    setBereich(vorbelegt.current);
    vorbelegt.current = null;
    setTage(new Map());
    setGeladeneMonate(new Set());
    setBestellt([]);
    setDetail(null);
    if (!objektId) {
      setLeistungen([]);
      return;
    }
    let aktuell = true;
    void getOwnerProperty(objektId).then((res) => {
      if (aktuell && res.ok) setDetail(res.data);
    });
    void getBestellbareLeistungen(objektId).then((res) => {
      if (!aktuell) return;
      if (res.ok) {
        setLeistungen(res.data.items);
        setLeistungenFehler(null);
      } else {
        // Ladefehler ≠ „nichts bestellbar" (Wurzel 4/5).
        setLeistungen([]);
        setLeistungenFehler(res.error);
      }
    });
    return () => {
      aktuell = false;
    };
  }, [objektId]);

  // Belegung des angezeigten Monats laden (einmal je Monat und Objekt).
  const monatLaden = useCallback(
    async (jahr: number, m: number) => {
      if (!objektId) return;
      const key = `${jahr}-${m}`;
      if (geladeneMonate.has(key)) return;
      const start = isoLokal(new Date(jahr, m, 1, 12));
      const ende = isoLokal(new Date(jahr, m + 1, 1, 12));
      const res = await getOwnerCalendar(objektId, start, ende);
      if (!res.ok) {
        setFehler(res.error);
        return;
      }
      setTage((alt) => {
        const neu = new Map(alt);
        for (const d of res.data.days) neu.set(d.date, d);
        return neu;
      });
      setGeladeneMonate((alt) => new Set(alt).add(key));
    },
    [objektId, geladeneMonate],
  );

  useEffect(() => {
    void monatLaden(monat.jahr, monat.monat);
  }, [monat, monatLaden]);

  const zellen = useMemo(() => monatsZellen(monat.jahr, monat.monat), [monat]);
  const objekt = objekte?.find((o) => o.id === objektId) ?? null;
  const maxGaeste = detail?.max_guests ?? 50;
  const fertigGewaehlt = bereich !== null && bereich.bis !== null;
  const naechte = fertigGewaehlt ? aufenthaltNaechte(bereich.von, bereich.bis as string) : 0;
  const monatGeladen = geladeneMonate.has(`${monat.jahr}-${monat.monat}`);

  const tagTippen = (tag: string) => {
    if (tag < heuteIso) return;
    // Als Anreise muss die erste Nacht frei sein; als Abreise müssen alle
    // Nächte dazwischen frei sein — der Abreisetag selbst darf belegt sein.
    if (bereich && bereich.bis === null && tag > bereich.von) {
      if (!alsAbreiseWaehlbar(tage, bereich.von, tag)) return;
      setBereich(bereichWaehlen(bereich, tag));
      return;
    }
    if (!nachtFrei(tage.get(tag))) return;
    setBereich(bereichWaehlen(bereich, tag));
  };

  const senden = async () => {
    if (!objektId || !bereich || bereich.bis === null) return;
    setLaeuft(true);
    setFehler(null);
    const zeitraum = alsSperrantrag(bereich.von, bereich.bis);
    const res = await createBlockRequest({
      property_id: objektId,
      ...zeitraum,
      guests: gaeste,
      children: kinder,
      pets: haustiere,
      reason: notizen.trim() ? notizen.trim() : undefined,
      bestellte_leistungen: bestellt,
    });
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    const ziel = {
      antrag: res.data,
      objekt: { title: objekt?.title ?? "Objekt", photo: objekt?.photo ?? null, adresse: adresse(detail) },
      checkIn: bereich.von,
      checkOut: bereich.bis,
      gaeste,
      kinder,
      haustiere,
      notizen: notizen.trim() || null,
    };
    // Im Stack ersetzt die Bestätigung das Formular; als Tab liegt sie darüber
    // im Root-Stack (ein Tab kennt kein `replace`).
    if (navigation.replace) navigation.replace("AufenthaltBestaetigt", ziel);
    else navigation.navigate("AufenthaltBestaetigt", ziel);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.surface2, paddingTop: alsTab ? insets.top : 0 }}>
      {alsTab ? (
        <View style={{ alignItems: "center", paddingVertical: 12 }}>
          <Txt v="title" style={{ fontSize: 17 }}>
            {txt("buchen.titel")}
          </Txt>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Objekt */}
        <Kachel>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <Icon n="home" s={18} c={t.palette.soft} />
            <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
              {txt("allg.objekt")}
            </Txt>
            {objekte && objekte.length > 1 ? (
              <Pressable onPress={() => setObjektBlatt(true)} accessibilityRole="button" hitSlop={8}>
                <Txt v="sm" accent style={{ fontFamily: t.fonts.semibold }}>
                  {txt("allg.aendern")}
                </Txt>
              </Pressable>
            ) : null}
          </View>
          {objekte === null ? (
            <Spinner />
          ) : objekt ? (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Photo src={objekt.photo ?? undefined} h={72} w={100} r={10} />
              <View style={{ flex: 1 }}>
                <Txt v="title" numberOfLines={1}>
                  {objekt.title}
                </Txt>
                {adresse(detail) ?? objekt.city ? (
                  <Txt v="xs" soft numberOfLines={1} style={{ marginTop: 2 }}>
                    {adresse(detail) ?? objekt.city}
                  </Txt>
                ) : null}
                {detail?.max_guests ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Icon n="users" s={13} c={t.palette.soft} />
                    <Txt v="xs" soft>
                      Bis zu {detail.max_guests} Gäste
                    </Txt>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <Txt v="sm" soft>
              {txt("buchen.keinObjekt")}
            </Txt>
          )}
        </Kachel>

        {/* Zeitraum */}
        <Kachel>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Icon n="cal" s={18} c={t.palette.soft} />
            <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
              {txt("allg.zeitraum")}
            </Txt>
            {fertigGewaehlt ? (
              <Txt v="sm" style={{ fontFamily: t.fonts.semibold }} numberOfLines={1}>
                {spanneLesbar(txt, bereich.von, bereich.bis as string)}{" "}
                <Txt v="sm" soft>
                  {txt("buchen.naechteKlammer", {
                    anzahl: naechte,
                    einheit: txt(naechte === 1 ? "allg.nacht" : "allg.naechte"),
                  })}
                </Txt>
              </Txt>
            ) : bereich ? (
              <Txt v="xs" soft>
                {txt("buchen.abreiseWaehlen")}
              </Txt>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Pressable
              onPress={() => setMonat(({ jahr, monat: m }) => (m === 0 ? { jahr: jahr - 1, monat: 11 } : { jahr, monat: m - 1 }))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={txt("buchen.vormonat")}
              disabled={monat.jahr === heute.getFullYear() && monat.monat === heute.getMonth()}
              style={{ opacity: monat.jahr === heute.getFullYear() && monat.monat === heute.getMonth() ? 0.3 : 1 }}
            >
              <Icon n="back" s={18} c={t.palette.ink} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
              <Txt v="title">
                {monatName(txt, monat.monat)} {monat.jahr}
              </Txt>
              {!monatGeladen ? <Spinner /> : null}
            </View>
            <Pressable
              onPress={() => setMonat(({ jahr, monat: m }) => (m === 11 ? { jahr: jahr + 1, monat: 0 } : { jahr, monat: m + 1 }))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={txt("kal.naechsterMonat")}
            >
              <Icon n="fwd" s={18} c={t.palette.ink} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            {KOPF.map((k) => (
              <Txt key={k} v="xs" soft style={{ width: `${100 / 7}%`, textAlign: "center" }}>
                {wochentagKurz(txt, k === 7 ? 0 : k)}
              </Txt>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {zellen.map((tag, i) => (
              <Zelle
                key={tag ?? `leer-${i}`}
                tag={tag}
                heuteIso={heuteIso}
                bereich={bereich}
                tage={tage}
                auf={tagTippen}
              />
            ))}
          </View>
          <Txt v="xs" faint style={{ marginTop: 8 }}>
            {txt("buchen.belegtHinweis")}
          </Txt>
        </Kachel>

        {/* Gäste */}
        <Kachel>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Icon n="users" s={18} c={t.palette.soft} />
            <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
              {txt("buchen.gaeste")}
            </Txt>
            <Schritt
              label={txt("buchen.wenigerGaeste")}
              icon="minus"
              disabled={gaeste <= 1}
              auf={() =>
                setGaeste((g) => {
                  const neu = Math.max(1, g - 1);
                  setKinder((k) => Math.min(k, neu));
                  return neu;
                })
              }
            />
            <Txt v="sm" style={{ fontFamily: t.fonts.semibold, minWidth: 110, textAlign: "center" }}>
              {gaesteText(txt, gaeste)}
            </Txt>
            <Schritt
              label={txt("buchen.mehrGaeste")}
              icon="plus"
              disabled={gaeste >= maxGaeste}
              auf={() => setGaeste((g) => Math.min(maxGaeste, g + 1))}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: t.palette.line,
            }}
          >
            <Icon n="users" s={18} c={t.palette.soft} />
            <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
              {txt("buchen.kinder")}
            </Txt>
            <Schritt
              label={txt("buchen.wenigerKinder")}
              icon="minus"
              disabled={kinder <= 0}
              auf={() => setKinder((k) => Math.max(0, k - 1))}
            />
            <Txt v="sm" style={{ fontFamily: t.fonts.semibold, minWidth: 110, textAlign: "center" }}>
              {kinderText(txt, kinder)}
            </Txt>
            <Schritt
              label={txt("buchen.mehrKinder")}
              icon="plus"
              disabled={kinder >= gaeste}
              auf={() => setKinder((k) => Math.min(gaeste, k + 1))}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: t.palette.line,
            }}
          >
            <Icon n="pet" s={18} c={t.palette.soft} />
            <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
              {txt("buchen.haustiere")}
            </Txt>
            <Schritt
              label={txt("buchen.wenigerHaustiere")}
              icon="minus"
              disabled={haustiere <= 0}
              auf={() => setHaustiere((h) => Math.max(0, h - 1))}
            />
            <Txt v="sm" style={{ fontFamily: t.fonts.semibold, minWidth: 110, textAlign: "center" }}>
              {haustierText(txt, haustiere)}
            </Txt>
            <Schritt
              label={txt("buchen.mehrHaustiere")}
              icon="plus"
              disabled={haustiere >= 10}
              auf={() => setHaustiere((h) => Math.min(10, h + 1))}
            />
          </View>
        </Kachel>

        {/* Leistungen bestellen (0510/0538): nur Angekreuztes wird ausgeführt
            und abgerechnet — nach Genehmigung. Ohne Auswahl keine Aufgabe. */}
        {leistungenFehler ? (
          <Kachel>
            <Txt v="sm" color={t.palette.accentText}>
              {leistungenFehler}
            </Txt>
          </Kachel>
        ) : leistungen.length > 0 ? (
          <Kachel>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Icon n="check" s={18} c={t.palette.soft} />
              <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
                {txt("buchen.leistungen")}
              </Txt>
            </View>
            <Txt v="xs" faint style={{ marginBottom: 4 }}>
              Nur was Sie ankreuzen, wird zu Ihrem Aufenthalt ausgeführt und abgerechnet — sobald Ihre
              Verwaltung es genehmigt hat.
            </Txt>
            {leistungen.map((l, idx) => {
              const aktiv = bestellt.includes(l.rule_id);
              return (
                <Pressable
                  key={l.rule_id}
                  onPress={() => setBestellt((alt) => (aktiv ? alt.filter((x) => x !== l.rule_id) : [...alt, l.rule_id]))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: aktiv }}
                  accessibilityLabel={l.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: t.palette.line,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: 1.5,
                      borderColor: aktiv ? t.palette.accent : t.palette.line,
                      backgroundColor: aktiv ? t.palette.accent : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {aktiv ? <Icon n="check" s={14} sw={2.5} c={t.palette.accentInk} /> : null}
                  </View>
                  <Txt v="sm">{l.name}</Txt>
                </Pressable>
              );
            })}
          </Kachel>
        ) : null}

        {/* Notizen */}
        <Kachel>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Icon n="doc" s={18} c={t.palette.soft} />
            <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
              {txt("buchen.notizen")}
            </Txt>
            {!notizenOffen ? (
              <Pressable onPress={() => setNotizenOffen(true)} accessibilityRole="button" hitSlop={8}>
                <Txt v="sm" accent style={{ fontFamily: t.fonts.semibold }}>
                  Notizen hinzufügen
                </Txt>
              </Pressable>
            ) : null}
          </View>
          {notizenOffen ? (
            <>
              <Txt v="xs" faint style={{ marginTop: 6 }}>
                {txt("buchen.notizenHinweis")}
              </Txt>
              <TextInput
                value={notizen}
                onChangeText={setNotizen}
                multiline
                maxLength={2000}
                autoFocus
                placeholder={txt("buchen.notizenPlatzhalter2")}
                placeholderTextColor={t.palette.faint}
                style={{
                  marginTop: 8,
                  minHeight: 72,
                  color: t.palette.ink,
                  fontFamily: t.fonts.regular,
                  fontSize: 15,
                  textAlignVertical: "top",
                }}
              />
            </>
          ) : null}
        </Kachel>

        {fehler ? (
          <Kachel>
            <Txt v="sm" color={t.palette.accentText}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: t.density.pad,
          paddingTop: 10,
          paddingBottom: alsTab ? 10 : insets.bottom + 10,
          backgroundColor: t.palette.surface2,
        }}
      >
        <Btn variant="primary" block iconR="fwd" disabled={!fertigGewaehlt || !objektId || laeuft} onPress={() => void senden()}>
          {txt(laeuft ? "allg.wirdGesendet" : "buchen.bestaetigen")}
        </Btn>
      </View>

      <Blatt offen={objektBlatt} titel={txt("buchen.objektWaehlen")} schliessen={() => setObjektBlatt(false)}>
        <BlattGruppe titel={txt("finanz.objekte")}>
          {(objekte ?? []).map((o, i) => (
            <BlattOption
              key={o.id}
              label={o.title}
              hinweis={o.city ?? undefined}
              aktiv={o.id === objektId}
              auf={() => {
                setObjektId(o.id);
                setObjektBlatt(false);
              }}
              erste={i === 0}
            />
          ))}
        </BlattGruppe>
      </Blatt>
    </View>
  );
}

function Schritt({ label, icon, disabled, auf }: { label: string; icon: "plus" | "minus"; disabled: boolean; auf: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={auf}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: t.palette.line,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Icon n={icon} s={16} sw={2} c={t.palette.ink} />
    </Pressable>
  );
}

/**
 * Ein Tag im Monatsblatt. Vergangen: blass. Belegt: durchgestrichen. Anreise
 * und Abreise: gefüllter Kreis; dazwischen ein heller Band-Hintergrund.
 */
function Zelle({
  tag,
  heuteIso,
  bereich,
  tage,
  auf,
}: {
  tag: string | null;
  heuteIso: string;
  bereich: Bereich | null;
  tage: ReadonlyMap<string, PortalCalendarDay>;
  auf: (tag: string) => void;
}) {
  const t = useTheme();
  if (tag === null) return <View style={{ width: `${100 / 7}%`, height: 40 }} />;
  const vergangen = tag < heuteIso;
  const belegt = !nachtFrei(tage.get(tag));
  const istVon = bereich?.von === tag;
  const istBis = bereich?.bis === tag;
  const imBand = !!bereich && bereich.bis !== null && tag > bereich.von && tag < bereich.bis;
  const gewaehlt = istVon || istBis;
  const inaktiv = vergangen || (belegt && !istBis);
  return (
    <Pressable
      onPress={() => auf(tag)}
      disabled={vergangen}
      accessibilityRole="button"
      accessibilityLabel={tag}
      accessibilityState={{ selected: gewaehlt, disabled: inaktiv }}
      style={{ width: `${100 / 7}%`, height: 40, alignItems: "center", justifyContent: "center" }}
    >
      {imBand || (gewaehlt && bereich?.bis) ? (
        <View
          style={{
            position: "absolute",
            top: 4,
            bottom: 4,
            left: istVon ? "50%" : 0,
            right: istBis ? "50%" : 0,
            backgroundColor: t.palette.surface2,
          }}
        />
      ) : null}
      {/* Der ABREISETAG ist ein halber Tag: der Gast reist vormittags ab, die
          Nacht davor war die letzte. Der volle Kreis ließ ihn wie eine
          gebuchte Nacht aussehen (gemeldet 08.09.2026) — deshalb liegt hier
          ein Halbkreis, dessen gefüllte Hälfte zum Zeitraum zeigt. Dieselbe
          Halbtags-Logik wie die Chips im Kalender (`HALBER_TAG`). */}
      {istBis && bereich?.bis ? (
        <View
          style={{
            position: "absolute",
            top: 4,
            bottom: 4,
            left: 0,
            right: "50%",
            backgroundColor: t.palette.surface2,
          }}
        />
      ) : null}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          // Der Abreisetag bleibt UNGEFÜLLT und wird nur umrandet: er ist
          // keine gebuchte Nacht. Die Anreise ist gefüllt.
          backgroundColor: istVon ? t.palette.accent : "transparent",
          borderWidth: istBis && bereich?.bis ? 2 : 0,
          borderColor: t.palette.accent,
        }}
      >
        <Txt
          v="sm"
          color={istVon ? t.palette.accentInk : inaktiv ? t.palette.faint : t.palette.ink}
          style={{
            fontFamily: gewaehlt ? t.fonts.semibold : t.fonts.regular,
            textDecorationLine: belegt && !vergangen && !gewaehlt ? "line-through" : "none",
          }}
        >
          {tag.slice(8, 10)}
        </Txt>
      </View>
    </Pressable>
  );
}
