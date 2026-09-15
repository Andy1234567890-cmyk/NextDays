// Aufgaben-Kalender. Wochenstreifen über einer Tages-Agenda: oben die sieben
// Tage der Woche (Mo–So) mit Punktmarkern, darunter die Aufgaben des gewählten
// Tages als dieselben Karten wie in der Liste.
//
// Warum kein Objekt×Tag-Gitter wie im Web: die Web-Timeline braucht Breite für
// N Objektzeilen × 31 Spalten. Auf einem Telefon bleibt davon eine Fläche zum
// Wischen ohne Lesbarkeit. Die Referenz-Apps lösen es beide so — Turno mit
// Wochenstreifen + Tagesliste, Breezeway mit Heute/Morgen/Woche über
// Tagesgruppen. Dieselbe Datenlage, mobiles Format.
//
// Zwei Datenwege, je nach Recht:
//   MANAGE_TASKS   → GET /tasks/calendar (Monat, alle Objekte MIT ihren
//                    Buchungen). Nur damit lässt sich am Tag „Abreise/Anreise"
//                    ausweisen — die Information, wegen der eine Reinigung
//                    überhaupt terminiert wird.
//   VIEW_OWN_TASKS → GET /tasks/mine (der Scope IST die Autorisierung,
//                    Wurzel 9). Kein Buchungszugriff für Mitarbeiter (§4.3),
//                    also auch kein Wechsel-Merker — nichts wird ersatzweise
//                    erfunden (Wurzel 4).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AufgabeKarte, type Wechsel } from "@/components/aufgaben/AufgabeKarte";
import { Icon } from "@/components/ui/Icon";
import { Col, IconBtn, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import {
  aufgabenTage,
  monatLabel,
  monatsGrenzen,
  tagLabel,
  tagPlus,
  wochenTage,
  zaehleProTag,
} from "@/lib/aufgaben-agenda";
import { AUFGABE_TONE } from "@/lib/aufgabenstatus";
import { heuteIso, WOCHENTAGE } from "@/lib/kalendertag";
import { can } from "@/lib/permissions";
import { useRealtime } from "@/lib/realtime";
import {
  getTaskCalendar,
  listMyTasks,
  type CalendarBooking,
  type TaskListItem,
} from "@/lib/tasks";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

export default function HostTaskCalendar({ navigation }: { navigation: any }) {
  const t = useTheme();
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const canManage = can(me, "manage_tasks");
  const heute = heuteIso();

  const [tag, setTag] = useState(heute);
  const [aufgaben, setAufgaben] = useState<TaskListItem[] | null>(null);
  const [buchungen, setBuchungen] = useState<CalendarBooking[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  // Geladen wird MONATSWEISE (der Server nimmt month_from/month_to), angezeigt
  // wochenweise. Der Schlüssel ist deshalb der Monat des gewählten Tages: erst
  // ein Wechsel über die Monatsgrenze löst ein neues Laden aus.
  const monat = tag.slice(0, 7);

  const load = useCallback(async () => {
    const { von, bis } = monatsGrenzen(`${monat}-01`);
    if (canManage) {
      const res = await getTaskCalendar(von, bis);
      if (!res.ok) {
        // Fehler NIE verschlucken: sonst sieht der Kalender leer aus, als gäbe
        // es keine Aufgaben (Wurzel 5).
        setFehler(res.error);
        setAufgaben([]);
        setBuchungen([]);
        return;
      }
      setFehler(null);
      setAufgaben(res.data.rows.flatMap((r) => r.tasks));
      setBuchungen(res.data.rows.flatMap((r) => r.bookings));
      return;
    }
    const res = await listMyTasks();
    if (!res.ok) {
      setFehler(res.error);
      setAufgaben([]);
      return;
    }
    setFehler(null);
    setAufgaben(res.data);
    setBuchungen([]);
  }, [canManage, monat]);

  useEffect(() => {
    setAufgaben(null);
    load();
  }, [load]);

  useRealtime({ table: "tasks", onChange: load });
  // Buchungen speisen die Wechsel-Merker mit; ohne dieses Abo zeigte der
  // Kalender eine verschobene Abreise weiter am alten Tag.
  useRealtime({ table: "reservations", onChange: load, enabled: canManage });

  const woche = useMemo(() => wochenTage(tag), [tag]);
  const proTag = useMemo(() => zaehleProTag(aufgaben ?? []), [aufgaben]);
  const desTages = useMemo(
    () =>
      (aufgaben ?? [])
        // `aufgabenTage`, nicht `aufgabenTag`: eine Aufgabe, die von einem Tag
        // zum nächsten läuft (Wechsel/Anreise-Check), gehört an BEIDE Tage.
        .filter((a) => aufgabenTage(a).includes(tag))
        .sort((a, b) => (a.start_at ?? a.due_at ?? "").localeCompare(b.start_at ?? b.due_at ?? "")),
    [aufgaben, tag],
  );

  // Wechsel je Objekt an DIESEM Tag: Abreise = check_out, Anreise = check_in.
  // Ohne Uhrzeiten — die Buchung trägt nur Kalendertage.
  const wechselJeObjekt = useMemo(() => {
    const map = new Map<string, Wechsel>();
    for (const b of buchungen) {
      if (b.check_out !== tag && b.check_in !== tag) continue;
      const bisher = map.get(b.property_id) ?? { abreise: false, anreise: false };
      map.set(b.property_id, {
        abreise: bisher.abreise || b.check_out === tag,
        anreise: bisher.anreise || b.check_in === tag,
      });
    }
    return map;
  }, [buchungen, tag]);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <Row style={{ justifyContent: "space-between" }}>
          {/* Derselbe Titel wie in der Liste: es ist EIN Bereich in zwei
              Ansichten. „Kalender" hieße hier dasselbe wie der Tab unten, der
              den BELEGUNGS-Kalender öffnet — zwei verschiedene Dinge unter
              einem Namen. */}
          <Txt v="display">Aufgaben</Txt>
          <IconBtn
            icon="list"
            s={38}
            flat
            onPress={() => navigation.navigate("Tasks")}
            style={{ borderWidth: 1, borderColor: t.palette.line }}
          />
        </Row>

        <Row style={{ justifyContent: "space-between" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Woche zurück"
            hitSlop={10}
            onPress={() => setTag(tagPlus(tag, -7))}
            style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon n="back" s={20} sw={2} c={t.palette.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zu heute"
            onPress={() => setTag(heute)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Txt v="title">{monatLabel(tag)}</Txt>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Woche vor"
            hitSlop={10}
            onPress={() => setTag(tagPlus(tag, 7))}
            style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon n="fwd" s={20} sw={2} c={t.palette.ink} />
          </Pressable>
        </Row>

        <Row gap={0} style={{ justifyContent: "space-between" }}>
          {woche.map((iso) => (
            <TagZelle
              key={iso}
              iso={iso}
              gewaehlt={iso === tag}
              heute={iso === heute}
              anzahl={proTag.get(iso) ?? 0}
              onPress={() => setTag(iso)}
            />
          ))}
        </Row>
      </Col>

      <View style={{ height: 1, backgroundColor: t.palette.line }} />

      {aufgaben === null ? (
        <Spinner />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 18,
            paddingBottom: unterkante + 24,
            gap: 12,
          }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        >
          <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
            {tagLabel(tag, heute)}
          </Txt>

          {fehler && (
            <Txt v="sm" color={AUFGABE_TONE.unassigned.fg}>
              {fehler}
            </Txt>
          )}

          {desTages.length === 0 && !fehler ? (
            <EmptyState
              icon="cal"
              titel="Kein Termin an diesem Tag"
              text="Tage mit Aufgaben tragen im Streifen oben einen Punkt."
            />
          ) : (
            desTages.map((task) => (
              <Pressable
                key={task.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate("TaskDetail", { id: task.id })}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <AufgabeKarte
                  task={task}
                  heuteIso={heute}
                  zeigeZustaendige={canManage}
                  wechsel={task.property_id ? wechselJeObjekt.get(task.property_id) : undefined}
                />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function TagZelle({
  iso,
  gewaehlt,
  heute,
  anzahl,
  onPress,
}: {
  iso: string;
  gewaehlt: boolean;
  heute: boolean;
  anzahl: number;
  onPress: () => void;
}) {
  const t = useTheme();
  const [y, m, d] = iso.split("-").map(Number);
  const wt = new Date(y, m - 1, d).getDay();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: gewaehlt }}
      accessibilityLabel={`${WOCHENTAGE[wt]}, ${d}.`}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}
    >
      <Txt v="xs" soft>
        {WOCHENTAGE[wt]}
      </Txt>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: gewaehlt ? t.palette.accent : "transparent",
          // Der heutige Tag bleibt erkennbar, auch wenn ein anderer gewählt ist.
          borderWidth: !gewaehlt && heute ? 1 : 0,
          borderColor: t.palette.accent,
        }}
      >
        <Txt v="sm" color={gewaehlt ? t.palette.accentInk : t.palette.ink}>
          {d}
        </Txt>
      </View>
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: anzahl > 0 ? t.palette.accent : "transparent",
        }}
      />
    </Pressable>
  );
}
