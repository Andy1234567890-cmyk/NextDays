// Eine Buchungszeile, wie sie in Übersicht und Kalender-Listen erscheint:
// Gast, Objekt, Zeitraum + Nächte, Herkunft, Status und die gebuchten
// Zusatzleistungen. Antippen öffnet die Buchung.
//
// Eigene Datei, weil zwei Bereiche sie brauchen (Reiter-Liste der Übersicht und
// künftige Listen) — dieselbe Zeile zweimal zu setzen hieße, dass eine von
// beiden bei der nächsten Ergänzung zurückfällt.
import { Pressable, View } from "react-native";

import { KanalMarke } from "@/components/KanalMarke";
import { Icon } from "@/components/ui/Icon";
import { Avatar, Col, Row, Txt } from "@/components/ui/kit";
import { addonName } from "@/lib/addons";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/buchungsstatus";
import { channelMeta } from "@/lib/calendar-channels";
import { initialenAus } from "@/lib/initialen";
import type { DashboardAddon, DashboardEntry } from "@/lib/dashboard";
import { naechte, tagKurz } from "@/lib/kalendertag";
import { portalLabel } from "@/lib/portal-logos";
import { useTheme } from "@/theme/ThemeProvider";

// Gebuchte Zusatzleistungen der Buchung: WAS vorzubereiten ist („2× Wäsche-
// paket"), und ob es beim Check-in noch zu kassieren ist — ein offener Posten
// sticht farblich hervor, ein bezahlter bleibt ruhig. Ohne Betrag (der wäre
// eine andere Information und bräuchte die Betrags-Sicht, §4.2).
function Addons({ addons }: { addons?: DashboardAddon[] }) {
  const t = useTheme();
  // Optional, nicht weil das Backend das Feld auslässt, sondern weil eine noch
  // im Speicher liegende Antwort von vor dieser Änderung es nicht kennt.
  if (!addons?.length) return null;
  return (
    <Row gap={6} style={{ flexWrap: "wrap", marginTop: 2 }}>
      {addons.map((a, i) => (
        <Row
          key={`${addonName(a.name)}-${i}`}
          gap={4}
          style={{
            alignItems: "center",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: t.radius.pill,
            backgroundColor: a.paid ? t.palette.surface2 : t.palette.accentSoft,
          }}
        >
          <Icon
            n={a.paid ? "check" : "sparkle"}
            s={11}
            sw={2}
            c={a.paid ? t.palette.soft : t.palette.accent}
          />
          <Txt v="xs" color={a.paid ? t.palette.soft : t.palette.accent} style={{ fontSize: 11 }}>
            {a.qty > 1 ? `${a.qty}× ` : ""}
            {addonName(a.name)}
          </Txt>
        </Row>
      ))}
    </Row>
  );
}

/**
 * Eine Buchungszeile. Zeigt alles, was der Endpoint je Eintrag liefert: Gast,
 * Objekt, Zeitraum + Nächte, Herkunft (ota_name vor Kanal-Label), Status und
 * gebuchte Zusatzleistungen. Tippen führt ins Buchungsdetail.
 */
export function BuchungsZeile({
  eintrag,
  datumsfeld,
  onPress,
  onNachrichten,
}: {
  eintrag: DashboardEntry;
  datumsfeld: "check_in" | "check_out";
  onPress: () => void;
  onNachrichten: (threadId: string) => void;
}) {
  const t = useTheme();
  const kanal = channelMeta(eintrag.channel);
  // Echte Herkunft zuerst: „Booking.com" statt des internen Kanal-Kürzels. Ein
  // Eigentümer-Aufenthalt (0241) kommt von keinem Kanal — dort steht die Art.
  const herkunft = eintrag.is_owner_stay
    ? "Eigentümer-Aufenthalt"
    : portalLabel(eintrag.ota_name) || kanal.label;
  const tone = STATUS_TONE[eintrag.status];
  const n = naechte(eintrag.check_in, eintrag.check_out);

  return (
    <Row gap={4} style={{ alignItems: "center", paddingRight: 8 }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          paddingVertical: 14,
          paddingHorizontal: 16,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Row gap={12} style={{ alignItems: "center" }}>
          <View>
            {/* Initialen des Gastes statt anonymem Symbol — der Name liegt
                vor, und ein Personen-Symbol sieht aus wie ein Bild, das nicht
                geladen hat. Eine Eigennutzung behält ihr Haus-Symbol: dort ist
                kein Gast, sondern das Objekt gemeint. */}
            <Avatar
              s={40}
              icon={eintrag.is_owner_stay ? "home" : "user"}
              initialen={
                eintrag.is_owner_stay
                  ? undefined
                  : initialenAus(eintrag.guest_name, null)
              }
            />
            {/* Herkunft als Marke — derselbe Baustein wie in Buchungsliste und
                Buchungsdetail, damit ein Kanal überall gleich aussieht. Ein
                Eigentümer-Aufenthalt trägt keine Kanalmarke, weil er über
                keinen Kanal kam. */}
            {!eintrag.is_owner_stay && (
              <View style={{ position: "absolute", right: -6, bottom: -4 }}>
                <KanalMarke channel={eintrag.channel} hoehe={18} />
              </View>
            )}
          </View>

          <Col gap={3} style={{ flex: 1 }}>
            <Row gap={8} style={{ alignItems: "center" }}>
              <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
                {eintrag.guest_name || "Gast"}
              </Txt>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: t.radius.pill,
                  backgroundColor: tone.bg,
                }}
              >
                <Txt v="xs" color={tone.fg} style={{ fontFamily: t.fonts.semibold }}>
                  {STATUS_LABEL[eintrag.status]}
                </Txt>
              </View>
            </Row>
            <Txt v="sm" soft numberOfLines={1}>
              {eintrag.property_title}
            </Txt>
            <Txt v="xs" soft numberOfLines={1}>
              {tagKurz(eintrag[datumsfeld])} · {n} {n === 1 ? "Nacht" : "Nächte"} · {herkunft}
            </Txt>
            <Addons addons={eintrag.addons} />
          </Col>
        </Row>
      </Pressable>

      {/* Der Weg in den Verlauf liegt NEBEN dem Zeilen-Weg, nicht darin — und
          nur mit echtem Thread: ohne Korrespondenz führte der Knopf in eine
          leere Ansicht, also ein Element ohne Wirkung (Wurzel 4). */}
      {eintrag.message_thread_id ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Verlauf im Posteingang öffnen"
          onPress={() => onNachrichten(eintrag.message_thread_id as string)}
          hitSlop={8}
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
          <Icon n="chat" s={16} sw={1.9} c={t.palette.ink} />
        </Pressable>
      ) : (
        <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />
      )}
    </Row>
  );
}

