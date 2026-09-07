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
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

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
import { MONATE, isoLokal, monatsEnde, spanneLesbar } from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = {
  goBack: () => void;
  replace: (name: string, params?: Record<string, unknown>) => void;
};
type Route = { params?: { propertyId?: string } };

// Montag zuerst (Vorlage: M T W T F S S).
const KOPF = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

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

export default function AufenthaltBuchen({ navigation, route }: { navigation: Nav; route: Route }) {
  const t = useTheme();
  const [objekte, setObjekte] = useState<PortalProperty[] | null>(null);
  const [objektId, setObjektId] = useState<string | null>(route.params?.propertyId ?? null);
  const [detail, setDetail] = useState<PortalPropertyDetail | null>(null);
  const [objektBlatt, setObjektBlatt] = useState(false);
  const heute = new Date();
  const [monat, setMonat] = useState({ jahr: heute.getFullYear(), monat: heute.getMonth() });
  const [tage, setTage] = useState<Map<string, PortalCalendarDay>>(new Map());
  const [geladeneMonate, setGeladeneMonate] = useState<Set<string>>(new Set());
  const [bereich, setBereich] = useState<Bereich | null>(null);
  const [gaeste, setGaeste] = useState(2);
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
    setBereich(null);
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
      reason: notizen.trim() ? notizen.trim() : undefined,
      bestellte_leistungen: bestellt,
    });
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    navigation.replace("AufenthaltBestaetigt", {
      antrag: res.data,
      objekt: { title: objekt?.title ?? "Objekt", photo: objekt?.photo ?? null, adresse: adresse(detail) },
      checkIn: bereich.von,
      checkOut: bereich.bis,
      gaeste,
      notizen: notizen.trim() || null,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Objekt */}
        <Kachel>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <Icon n="home" s={18} c={t.palette.soft} />
            <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
              Objekt
            </Txt>
            {objekte && objekte.length > 1 ? (
              <Pressable onPress={() => setObjektBlatt(true)} accessibilityRole="button" hitSlop={8}>
                <Txt v="sm" accent style={{ fontFamily: t.fonts.semibold }}>
                  Ändern
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
              Noch kein Objekt zugeordnet.
            </Txt>
          )}
        </Kachel>

        {/* Zeitraum */}
        <Kachel>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Icon n="cal" s={18} c={t.palette.soft} />
            <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
              Zeitraum
            </Txt>
            {fertigGewaehlt ? (
              <Txt v="sm" style={{ fontFamily: t.fonts.semibold }} numberOfLines={1}>
                {spanneLesbar(bereich.von, bereich.bis as string)}{" "}
                <Txt v="sm" soft>
                  ({naechte} {naechte === 1 ? "Nacht" : "Nächte"})
                </Txt>
              </Txt>
            ) : bereich ? (
              <Txt v="xs" soft>
                Abreise wählen
              </Txt>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            {KOPF.map((k) => (
              <Txt key={k} v="xs" soft style={{ width: `${100 / 7}%`, textAlign: "center" }}>
                {k}
              </Txt>
            ))}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Pressable
              onPress={() => setMonat(({ jahr, monat: m }) => (m === 0 ? { jahr: jahr - 1, monat: 11 } : { jahr, monat: m - 1 }))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Vormonat"
              disabled={monat.jahr === heute.getFullYear() && monat.monat === heute.getMonth()}
              style={{ opacity: monat.jahr === heute.getFullYear() && monat.monat === heute.getMonth() ? 0.3 : 1 }}
            >
              <Icon n="back" s={18} c={t.palette.ink} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
              <Txt v="title">
                {MONATE[monat.monat]} {monat.jahr}
              </Txt>
              {!monatGeladen ? <Spinner /> : null}
            </View>
            <Pressable
              onPress={() => setMonat(({ jahr, monat: m }) => (m === 11 ? { jahr: jahr + 1, monat: 0 } : { jahr, monat: m + 1 }))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Nächster Monat"
            >
              <Icon n="fwd" s={18} c={t.palette.ink} />
            </Pressable>
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
            Durchgestrichene Tage sind belegt. Der Abreisetag bleibt für die nächste Anreise frei.
          </Txt>
        </Kachel>

        {/* Gäste */}
        <Kachel>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Icon n="users" s={18} c={t.palette.soft} />
            <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
              Gäste
            </Txt>
            <Schritt
              label="Weniger Gäste"
              icon="minus"
              disabled={gaeste <= 1}
              auf={() => setGaeste((g) => Math.max(1, g - 1))}
            />
            <Txt v="sm" style={{ fontFamily: t.fonts.semibold, minWidth: 110, textAlign: "center" }}>
              {gaesteText(gaeste)}
            </Txt>
            <Schritt
              label="Mehr Gäste"
              icon="plus"
              disabled={gaeste >= maxGaeste}
              auf={() => setGaeste((g) => Math.min(maxGaeste, g + 1))}
            />
          </View>
        </Kachel>

        {/* Leistungen bestellen (0510/0538): nur Angekreuztes wird ausgeführt
            und abgerechnet — nach Genehmigung. Ohne Auswahl keine Aufgabe. */}
        {leistungenFehler ? (
          <Kachel>
            <Txt v="sm" color={t.palette.accent}>
              {leistungenFehler}
            </Txt>
          </Kachel>
        ) : leistungen.length > 0 ? (
          <Kachel>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Icon n="check" s={18} c={t.palette.soft} />
              <Txt v="sm" soft style={{ flex: 1, marginLeft: 8 }}>
                Leistungen bestellen
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
              Notizen
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
                Wünsche oder Hinweise zu Ihrem Aufenthalt an die Verwaltung
              </Txt>
              <TextInput
                value={notizen}
                onChangeText={setNotizen}
                multiline
                maxLength={2000}
                autoFocus
                placeholder="z. B. Späterer Check-out gewünscht"
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
            <Txt v="sm" color={t.palette.accent}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", left: t.density.pad, right: t.density.pad, bottom: 24 }}>
        <Btn variant="dark" block iconR="fwd" disabled={!fertigGewaehlt || !objektId || laeuft} onPress={() => void senden()}>
          {laeuft ? "Wird gesendet …" : "Aufenthalt beantragen"}
        </Btn>
      </View>

      <Blatt offen={objektBlatt} titel="Objekt wählen" schliessen={() => setObjektBlatt(false)}>
        <BlattGruppe titel="Ihre Objekte">
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
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: gewaehlt ? t.palette.ink : "transparent",
        }}
      >
        <Txt
          v="sm"
          color={gewaehlt ? t.palette.bg : inaktiv ? t.palette.faint : t.palette.ink}
          style={{
            fontFamily: gewaehlt ? t.fonts.semibold : t.fonts.regular,
            textDecorationLine: belegt && !gewaehlt ? "line-through" : "none",
          }}
        >
          {String(Number(tag.slice(8, 10)))}
        </Txt>
      </View>
    </Pressable>
  );
}
