// Gastgeber · Übersicht. Dieselbe Startseite wie im Web-Dashboard, aus vier
// Quellen:
//   GET /api/v1/reservations/dashboard      Reservierungen, Kennzahlen, Objekte
//   GET /api/v1/inbox/unread-count          offene Konversationen (Hinweiszeile)
//   GET /api/v1/inbox/kennzahlen            Nachrichten-Durchsatz  (pm_chat)
//   GET /api/v1/calendar/block-requests/vorgaenge  Eigentümer (approve_block)
//   GET /api/v1/tasks/startseite            Teamaufgaben          (manage_tasks)
//
// Die drei rollen-gebundenen Quellen werden NUR abgefragt, wenn `can(me, …)`
// es hergibt — dieselben Regeln wie im Web-Katalog
// (`web/lib/dashboard-katalog.ts`), damit App und Web derselben Rolle dieselbe
// Kachel zeigen. Fehlt die Berechtigung, entfällt der Block; es wird nicht
// gefragt und kein 403 als Ergebnis ausgegeben (Wurzel 5).
//
// Lade-/Fehler-/Leerzustand getrennt. KEIN Demo-Fallback: eine Übersicht mit
// lauter Nullen ist von einem echten ruhigen Tag nicht zu unterscheiden und
// gibt dem Gastgeber falsche Sicherheit über seinen Betrieb (Wurzel 4). Ist das
// Backend nicht erreichbar, steht das da — mit Wiederholen.
// Beträge/Währung aus den Daten (§4.2: revenue_30d = null → keine Umsatz-Kachel).
//
// Der Screen zeigt ALLE Felder, die die Endpunkte liefern. DREIMAL war er
// dahinter zurück, ohne dass es auffiel: bis Juli 2026 fehlten `checkins_30d`
// sowie Kanal, Status und der zweite Datumswert jeder Zeile; bis August 2026
// fehlten die Listen „Freigabe nötig" und „Gäste im Haus", der Umsatz je
// Buchung, die Zeitraum-/Zeitfenster-Umschaltung und die gebuchten
// Zusatzleistungen; bis zum 15.09.2026 fehlten der gesamte Nachrichten-Block,
// die Eigentümer-Vorgänge, der Stand der Teamaufgaben und `objekte_aktiv`.
// Jedes Mal sah die App nicht kaputt aus, sondern nur leer — deshalb steht der
// Vergleich mit dem Contract in `lib/dashboard.ts` ausdrücklich dabei.
//
// Bekannt fehlt weiterhin: `neu_eingegangen`/`neu_gesamt`. Der Server rechnet
// die Liste „zuletzt hereingekommen" (sortiert nach dem ECHTEN
// Buchungszeitpunkt, Wurzel 5b) bei jedem Aufruf, und weder App noch Web
// zeigen sie. Das ist keine Auslassung mit Grund, sondern eine offene Lücke.
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BuchungsPanel } from "@/components/buchung/BuchungsPanel";
import { BuchungsReiter } from "@/components/dashboard/BuchungsReiter";
import { KennzahlenAbschnitt } from "@/components/dashboard/KennzahlenAbschnitt";
import { NachrichtenAbschnitt } from "@/components/dashboard/NachrichtenAbschnitt";
import {
  EigentuemerKachel,
  TeamaufgabenKachel,
} from "@/components/dashboard/VorgangsKacheln";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Avatar, Btn, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { initialenAus } from "@/lib/initialen";
import {
  getEigentuemerVorgaenge,
  type EigentuemerVorgaenge,
} from "@/lib/calendar";
import { getDashboard, type Dashboard } from "@/lib/dashboard";
import { heuteLabel, tagesbeginnIso, tagesendeIso } from "@/lib/kalendertag";
import { getInboxUnreadCount } from "@/lib/inbox";
import { can } from "@/lib/permissions";
import { getTeamaufgabenStand, type TeamaufgabenStand } from "@/lib/tasks";
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
  // Die zwei Bestands-Kacheln des Web-Dashboards. null = diese Rolle sieht sie
  // nicht oder der Abruf ging schief — beides führt dazu, dass die Kachel
  // entfällt, statt Nullen zu zeigen, die von einem ruhigen Tag nicht zu
  // unterscheiden wären (Wurzel 4).
  const [vorgaenge, setVorgaenge] = useState<EigentuemerVorgaenge | null>(null);
  const [teamaufgaben, setTeamaufgaben] = useState<TeamaufgabenStand | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Zählt jede erfolgreiche Grundabfrage. Die Unterblöcke halten eigenen Zustand
  // (gewähltes Fenster, nachgeladene Zeilen) und erkennen daran, dass frische
  // Grunddaten da sind — ohne die Zählung würden sie den Stand ihres
  // Erstabrufs weiterzeigen, während die Zahlen darüber sich ändern.
  const [version, setVersion] = useState(0);
  const [offeneBuchung, setOffeneBuchung] = useState<string | null>(null);

  // Wer die zwei Bestands-Kacheln überhaupt sehen darf — dieselben Regeln wie
  // im Web-Katalog (`web/lib/dashboard-katalog.ts`), damit App und Web
  // derselben Rolle dieselbe Kachel zeigen. Gefragt wird gar nicht erst, wenn
  // die Rolle es nicht darf: Der Server antwortet dort mit 403/404, und einen
  // erwartbaren Fehler zu erzeugen und als Ergebnis auszugeben ist Wurzel 5.
  const darfVorgaenge = can(me, "approve_block");
  const darfTeamaufgaben = can(me, "manage_tasks");

  const load = useCallback(async () => {
    // Alle Quellen parallel. Nur die Grundabfrage ist kritisch: Wer keinen
    // Zugang zum Posteingang, zu den Sperranträgen oder zu fremden Aufgaben
    // hat, bekommt dort eine Absage — dann entfällt der jeweilige Block, statt
    // die ganze Übersicht zu kippen.
    const [res, offen, vorg, team] = await Promise.all([
      getDashboard(),
      getInboxUnreadCount(),
      darfVorgaenge ? getEigentuemerVorgaenge() : null,
      darfTeamaufgaben
        ? getTeamaufgabenStand({
            // Die Tagesgrenzen kommen vom GERÄT: „überfällig" und „heute
            // fällig" hängen daran, welcher Tag beim Leser läuft. Ohne sie
            // liefert der Server nur den Bestand und lässt beide auf 0.
            tagesbeginn: tagesbeginnIso(),
            tagesende: tagesendeIso(),
          })
        : null,
    ]);
    setVorgaenge(vorg?.ok ? vorg.data : null);
    setTeamaufgaben(team?.ok ? team.data : null);
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
  }, [darfVorgaenge, darfTeamaufgaben]);

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
  // Teamaufgaben-Kachel: `tasks` ist freigeschaltet (select für authenticated
  // UND in `supabase_realtime`, am 15.09.2026 gegen die Live-DB geprüft) und
  // wird in HostTasks/TaskDetail schon abonniert. Nur für die Rolle, die die
  // Kachel überhaupt sieht — sonst liefe bei jeder fremden Aufgabe ein Abruf,
  // dessen Ergebnis niemand anzeigt.
  useRealtime({ table: "tasks", onChange: load, enabled: darfTeamaufgaben });
  // KEIN Abo für `block_requests` und `portal_messages`, obwohl sie die
  // Eigentümer- und die Nachrichten-Kachel speisen: Beide haben KEIN `select`
  // für `authenticated` (gemessen 15.09.2026), `portal_messages` steht
  // zusätzlich nicht in der Publikation. Ein Abo darauf wäre eine stumme
  // Attrappe — die Oberfläche sähe live aus und aktualisierte nie. Diese zwei
  // Kacheln kommen beim Öffnen, beim Herunterziehen und bei jeder
  // Buchungsänderung frisch; das ist ehrlicher als ein totes Abo.

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
  const zuAufgaben = useCallback(() => navigation.navigate("Tasks"), [navigation]);
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
              style={{ height: 26, width: 26 * t.marke.logoRatio }}
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

        {/* Nachrichten-Durchsatz (`nachricht:*` im Web-Katalog). Nur mit
            `pm_chat` — ohne die Berechtigung antwortet `/inbox/kennzahlen` mit
            403, und die Kachel bliebe für diese Rolle ohnehin leer. */}
        {can(me, "pm_chat") && <NachrichtenAbschnitt />}

        {/* Die zwei Bestands-Kacheln. Sie stehen NACH den Kennzahlen und vor
            dem Objektbestand: erst was heute läuft, dann was entschieden
            werden muss, zuletzt die Einrichtungszahlen. */}
        {/* Die Eigentümer-Kachel ist BEWUSST nicht antippbar: Einen
            Sperrantrag entscheidet man im Dashboard, diese App hat dafür
            keinen Bildschirm. Ein Pfeil, der nirgends hinführt, wäre eine
            Attrappe — die Zahl allein sagt, dass jemand wartet, und das ist
            unterwegs die nützliche Hälfte. */}
        {vorgaenge && <EigentuemerKachel daten={vorgaenge} />}
        {teamaufgaben && (
          <TeamaufgabenKachel daten={teamaufgaben} onPress={zuAufgaben} />
        )}

        {/* Objektbestand als eine Zeile, nicht als Kachelreihe: gesamt, aktiv,
            inaktiv und Entwurf sind Einrichtungszahlen — man arbeitet mit ihnen
            unter „Inserate", nicht auf der Tagesübersicht.
            `objekte_aktiv` stand bis zum 15.09.2026 im Contract, ohne dass es
            jemand anzeigte: Die Zeile nannte nur, was NICHT verkauft (inaktiv,
            Entwurf) — die Zahl, die zählt, fehlte. */}
        <HinweisZeile
          icon="home"
          text={`${data.objekte_gesamt} ${data.objekte_gesamt === 1 ? "Objekt" : "Objekte"}${
            data.objekte_aktiv || data.objekte_inaktiv || data.objekte_entwurf
              ? ` · ${[
                  data.objekte_aktiv ? `${data.objekte_aktiv} aktiv` : null,
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
