// Herkunft einer Buchung als Marke — EIN Baustein für Übersicht, Buchungsliste
// und Buchungsdetail, damit ein Kanal in der ganzen App gleich aussieht.
//
// Regel wie im Web (lib/channel-logos.ts): nur ECHTE Portal-Logos. Kanäle ohne
// offizielles Logo (Direkt, eigener Marktplatz) bekommen einen Punkt in ihrer
// Kanalfarbe — keinen gebastelten Buchstaben und kein generisches Ersatz-Icon.
//
// Die Logos sind breite Wortmarken; in einen kleinen Kreis gequetscht wären sie
// ein Fleck. Deshalb rendert die Logo-Variante als Pille, die dem Logo seine
// Breite lässt.
import { Image, View } from "react-native";

import { channelMeta } from "@/lib/calendar-channels";
import { portalLogo } from "@/lib/portal-logos";
import type { ReservationChannel } from "@/lib/reservations";
import { useTheme } from "@/theme/ThemeProvider";

export function KanalMarke({
  channel,
  hoehe = 22,
  randfarbe,
}: {
  channel: ReservationChannel;
  /** Höhe der Pille bzw. Durchmesser des Punkts. */
  hoehe?: number;
  /** Randfarbe zum Freistellen auf Fotos/Avataren (default: Flächenfarbe). */
  randfarbe?: string;
}) {
  const t = useTheme();
  const ch = channelMeta(channel);
  const logo = portalLogo(channel);
  const rand = randfarbe ?? t.palette.surface;

  if (!logo) {
    return (
      <View
        style={{
          width: hoehe,
          height: hoehe,
          borderRadius: hoehe / 2,
          backgroundColor: ch.bar,
          borderWidth: 2,
          borderColor: rand,
        }}
      />
    );
  }

  return (
    <View
      style={{
        height: hoehe,
        paddingHorizontal: hoehe * 0.27,
        borderRadius: hoehe / 2,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        ...t.shadow.sm,
      }}
    >
      <Image
        source={logo}
        style={{ width: hoehe * 2.1, height: hoehe * 0.55 }}
        resizeMode="contain"
        accessibilityLabel={ch.label}
      />
    </View>
  );
}
