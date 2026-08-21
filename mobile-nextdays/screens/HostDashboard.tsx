// Gastgeber · Übersicht. Dieselbe Startseite wie im Web-Dashboard und aus
// denselben zwei Quellen: GET /api/v1/reservations/dashboard (Reservierungen,
// Kennzahlen, Objektbestand) und GET /api/v1/inbox/kennzahlen (Nachrichten).
//
// Lade-/Fehler-/Leerzustand getrennt. KEIN Demo-Fallback: eine Übersicht mit
// lauter Nullen ist von einem echten ruhigen Tag nicht zu unterscheiden und
// gibt dem Gastgeber falsche Sicherheit über seinen Betrieb (Wurzel 4). Ist das
// Backend nicht erreichbar, steht das da — mit Wiederholen.
// Beträge/Währung aus den Daten (§4.2: revenue_30d = null → keine Umsatz-Kachel).
//
// Der Screen zeigt ALLE Felder, die die Endpunkte liefern. Zweimal war er
// dahinter zurück, ohne dass es auffiel: bis Juli 2026 fehlten `checkins_30d`
// sowie Kanal, Status und der zweite Datumswert jeder Zeile; bis August 2026
// fehlten die Listen „Freigabe nötig" und „Gäste im Haus", der Umsatz je
// Buchung, die Zeitraum-/Zeitfenster-Umschaltung, die gebuchten
// Zusatzleistungen, der gesamte Nachrichten-Block und der Objektbestand. Beide
// Male sah die App nicht kaputt aus, sondern nur leer — deshalb steht der
// Vergleich mit dem Contract in `lib/dashboard.ts` ausdrücklich dabei.
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BuchungsPanel } from "@/components/buchung/BuchungsPanel";
import { BuchungsReiter } from "@/components/dashboard/BuchungsReiter";
import { KennzahlenAbschnitt } from "@/components/dashboard/KennzahlenAbschnitt";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Avatar, Btn, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { initialenAus } from "@/lib/initialen";
import { getDashboard, type Dashboard } from "@/lib/dashboard";
import { heuteLabel } from "@/lib/kalendertag";
import { getInboxUnreadCount } from "@/lib/inbox";
import { useRealtime } from "@/lib/realtime";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Tageszeit-Begrüßung wie in den Apps der Branche („Good morning, Gus").
 *
 * Bewusst ohne Namen: `/auth/me` liefert die E-Mail, keinen Vornamen — „Guten
 * Morgen, info@airsmil.dk" wäre keine Anrede. Steht der Name eines Tages im
 * Contract, kommt er hier dazu.
 */
function begruessung(): string {
  const stunde = new Date().getHours();
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

/**
 * Eine antippbare Hinweiszeile. `leise` für Bestandsangaben (Objekte), sonst
 * hervorgehoben — ein Handlungsbedarf soll sich von einer Zahl unterscheiden.
 */
function HinweisZeile({
  icon,
  text,
  onPress,
  leise,
}: {
  icon: IconName;
  text: string;
  onPress: () => void;
  leise?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Row
        gap={10}
        style={{
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: t.radius.card,
          borderWidth: 1,
          borderColor: leise ? t.palette.line : t.palette.accent,
          backgroundColor: leise ? "transparent" : t.palette.accentSoft,
        }}
      >
        <Icon
          n={icon}
          s={17}
          sw={1.9}
          c={leise ? t.palette.soft : t.palette.accent}
        />
        <Txt v="sm" numberOfLines={2} style={{ flex: 1 }}>
          {text}
        </Txt>
        <Icon n="fwd" s={15} sw={2} c={t.palette.faint} />
      </Row>
    </Pressable>
  );
}

export default function HostDashboard({ navigation }: { navigation: any }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
  const { me } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  // Offene Konversationen. null = der Posteingang ist für diese Rolle nicht
  // zugänglich (der Endpunkt sagt ab) — dann entfällt der Hinweis, statt „0"
  // zu behaupten, obwohl nichts geladen wurde.
  const [ungelesen, setUngelesen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Zählt jede erfolgreiche Grundabfrage. Die Unterblöcke halten eigenen Zustand
  // (gewähltes Fenster, nachgeladene Zeilen) und erkennen daran, dass frische
  // Grunddaten da sind — ohne die Zählung würden sie den Stand ihres
  // Erstabrufs weiterzeigen, während die Zahlen darüber sich ändern.
  const [version, setVersion] = useState(0);
  const [offeneBuchung, setOffeneBuchung] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Beide Quellen parallel. Die Zahl der offenen Konversationen ist NICHT
    // kritisch: wer keinen Zugang zum Posteingang hat, bekommt dort eine Absage
    // — dann entfällt der Hinweis, statt die ganze Übersicht zu kippen.
    const [res, offen] = await Promise.all([
      getDashboard(),
      getInboxUnreadCount(),
    ]);
    if (res.ok) {
      setData(res.data);
      setError(null);
      setVersion((v) => v + 1);
    } else {
      // Kein Ersatzdatensatz: sonst zeigt die App „0 Buchungen" für einen
      // Betrieb, dessen Zahlen sie schlicht nicht kennt.
      setData(null);
      setError(res.error);
    }
    setUngelesen(offen.ok ? offen.data.ungelesen : null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: Buchungsänderungen → Kennzahlen/Listen debounced neu laden (400 ms
  // wie Web). `reservations` speist die Reservierungszahlen, `properties` den
  // Objektbestand.
  // Ohne `availability`, anders als im Web: keine Zahl dieser Übersicht hängt
  // daran, das Abo würde nur die Grundabfrage bei jeder Kalendersperre erneut
  // auslösen (Wurzel 4 — kein Element ohne Wirkung).
  useRealtime({ table: "reservations", onChange: load });
  useRealtime({ table: "properties", onChange: load });

  const zuBuchungen = useCallback(() => navigation.navigate("Reservations"), [navigation]);
  // Die Buchung öffnet als Panel ÜBER der Übersicht — kein Screen-Wechsel,
  // damit der Blick auf den Tag beim Schließen erhalten bleibt.
  const zurBuchung = useCallback((id: string) => setOffeneBuchung(id), []);
  const zumThread = useCallback(
    (threadId: string) => navigation.navigate("HostInbox", { threadId }),
    [navigation],
  );
  const zumPosteingang = useCallback(() => navigation.navigate("HostInbox"), [navigation]);
  const zuObjekten = useCallback(() => navigation.navigate("Listings"), [navigation]);
  // Offene Anfragen sind die Buchungsliste mit gesetztem Status-Filter — keine
  // eigene Seite: es sind dieselben Buchungen, nur eine Teilmenge.
  const zuAnfragen = useCallback(
    () => navigation.navigate("Reservations", { status: "pending" }),
    [navigation],
  );

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 12 }}>
        <EmptyState icon="info" titel="Übersicht nicht geladen" text={error}>
          <Btn variant="outline" onPress={load} style={{ marginTop: 6 }}>
            Erneut versuchen
          </Btn>
        </EmptyState>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  return (
    // Die Safe-Area sitzt AUSSEN, nicht im `contentContainerStyle`.
    //
    // Vorher stand sie im Scroll-Inhalt: der Scrollbereich reichte damit bis
    // unter die Statusleiste, und beim Scrollen wanderten Reiter und Karten über
    // die Uhrzeit und die Dynamic Island — Text auf Text. Aussen beginnt der
    // Scrollbereich unter der Leiste, und nichts kann mehr darunter geraten.
    // So machen es auch die übrigen acht Screens dieser App; das Dashboard war
    // der einzige Ausreisser.
    <View
      style={{
        flex: 1,
        backgroundColor: t.palette.bg,
        paddingTop: insets.top,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 12,
          gap: 26,
          paddingBottom: unterkante + 24,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Markenkopf: die App ist die myNextDays-App, das gehört auf die
            Startseite. Logo und Name kommen aus theme/marke.ts — kein
            Bild-require und kein Markenname im Screen (ADR-0019). */}
        <Col gap={14}>
          <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
            <Image
              source={t.marke.logo}
              style={{ height: 26, width: 26 * 3.87 }}
              resizeMode="contain"
              accessibilityLabel={t.marke.name}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Konto"
              onPress={() => navigation.navigate("HostProfile")}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              {/* Bild bzw. Initialen statt anonymem Symbol — Letzteres sah
                  aus wie ein Bild, das nicht geladen hat. */}
              <Avatar
                s={34}
                src={me?.avatar_url ?? undefined}
                initialen={initialenAus(me?.full_name, me?.email)}
              />
            </Pressable>
          </Row>
          <Col gap={4}>
            <Txt v="display">{begruessung()}</Txt>
            <Txt v="body" soft numberOfLines={1}>
              {[heuteLabel(data.today), me?.email].filter(Boolean).join(" · ")}
            </Txt>
            {/* Der Tag in einer Zeile: was heute passiert, bevor irgendeine
                Liste geöffnet werden muss. */}
            <Txt v="sm" soft numberOfLines={1}>
              {[
                `${data.checkins_today.length} an`,
                `${data.checkouts_today.length} ab`,
                `${data.im_haus_gesamt} im Haus`,
              ].join(" · ")}
            </Txt>
          </Col>
        </Col>

        {/* Handlungsbedarf. Nur, wenn es welchen GIBT — eine Zeile „0 offene
            Anfragen" ist keine Information, sie kostet nur Platz und
            Aufmerksamkeit. */}
        {(data.freigabe_gesamt > 0 || (ungelesen ?? 0) > 0) && (
          <Col gap={8}>
            {data.freigabe_gesamt > 0 && (
              <HinweisZeile
                icon="clock"
                text={`${data.freigabe_gesamt} ${data.freigabe_gesamt === 1 ? "Anfrage wartet" : "Anfragen warten"} auf Freigabe`}
                onPress={zuAnfragen}
              />
            )}
            {(ungelesen ?? 0) > 0 && (
              <HinweisZeile
                icon="chat"
                text={`${ungelesen} offene ${ungelesen === 1 ? "Konversation" : "Konversationen"}`}
                onPress={zumPosteingang}
              />
            )}
          </Col>
        )}

        <BuchungsReiter
          data={data}
          datenVersion={version}
          onZeile={zurBuchung}
          onNachrichten={zumThread}
          onAlle={zuBuchungen}
        />

        <KennzahlenAbschnitt data={data} />

        {/* Objektbestand als eine Zeile, nicht als Kachelreihe: gesamt, inaktiv
            und Entwurf sind Einrichtungszahlen — man arbeitet mit ihnen unter
            „Inserate", nicht auf der Tagesübersicht. */}
        <HinweisZeile
          icon="home"
          text={`${data.objekte_gesamt} ${data.objekte_gesamt === 1 ? "Objekt" : "Objekte"}${
            data.objekte_inaktiv || data.objekte_entwurf
              ? ` · ${[
                  data.objekte_inaktiv ? `${data.objekte_inaktiv} inaktiv` : null,
                  data.objekte_entwurf ? `${data.objekte_entwurf} Entwurf` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}`
              : ""
          }`}
          onPress={zuObjekten}
          leise
        />
      </ScrollView>

      {offeneBuchung && (
        <BuchungsPanel
          reservationId={offeneBuchung}
          heuteIso={data.today}
          onClose={() => setOffeneBuchung(null)}
          onGeaendert={load}
          onNachrichtOeffnen={(threadId) => {
            setOffeneBuchung(null);
            navigation.navigate("HostInbox", { threadId });
          }}
        />
      )}
    </View>
  );
}
