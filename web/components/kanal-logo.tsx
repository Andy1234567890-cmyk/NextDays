// Das Zeichen neben einem Kanalnamen — eine Wahrheit für alle Tabellen.
//
// WARUM ES DAS GIBT (07.09.2026)
// ==============================
// Die Logos standen zuerst als `<Image width={16} height={16}>` in der
// Kanaltabelle, so wie sie in der Bewertungsliste stehen. Das Ergebnis war
// unlesbar — wörtlich gemeldet: „das erkennt doch keine sau".
//
// Der Grund ist keine zu kleine Zahl, sondern ein Seitenverhältnis: unsere
// Portal-Logos sind WORTMARKEN, keine quadratischen Bildmarken.
// `mybestdays.png` ist 1461 × 403 (≈ 3,6 : 1), `vrbo.svg` 125 × 40 (≈ 3 : 1).
// Ein 3,6 : 1 breites Bild, das per `object-contain` in ein 16 × 16 grosses
// Quadrat passen muss, wird auf 16 × 4,4 Pixel gerechnet: aus dem Schriftzug
// wird ein grauer Strich, und je breiter die Marke, desto duenner.
//
// Richtig ist deshalb ein Feld mit FESTER HOEHE und FREIER BREITE: die Marke
// bekommt die Hoehe der Textzeile und darf so breit werden, wie ihr
// Seitenverhaeltnis es verlangt. `max-w-*` haelt die Namensspalte trotzdem
// ruhig — ein sehr breites Logo wird dann kleiner skaliert.
//
// ZWEITER FALL: Kanaele OHNE Fremdmarke
// -------------------------------------
// „Direkt" ist keine Marke, sondern der eigene Verkauf — dafuer gibt es
// bewusst kein Logo (`channelLogoLoose` liefert `null`), und die Zeile blieb
// deshalb ganz ohne Zeichen. Ein erfundenes Markenlogo waere hier falsch
// (Wurzel 4), ein LEERER Platz aber auch: der Nutzer sucht das Zeichen.
//
// Die Loesung steht laengst im Repo: `CHANNEL_META` fuehrt fuer JEDEN Kanal
// ein Symbol und eine Kanalfarbe — `ph:house-line-fill` fuer `direct`.
// Dieselben Zeichen faerben schon die Balken im Multikalender. Wir fallen
// also auf die vorhandene Wahrheit zurueck statt ein drittes Zeichen zu
// erfinden.
//
// Das gilt AUSDRUECKLICH NICHT fuer myBestDays: unser Marktplatz hat ein
// echtes Logo, und das wird gezeigt — egal ob in der Zeile der Klarname oder
// der Kanalcode `portal` steht.
//
// Reihenfolge: echtes Markenlogo → Kanal-Symbol aus CHANNEL_META → nichts.
import { Icon } from "@iconify/react";
import Image from "next/image";

import type { AvailabilitySource } from "@/lib/calendar";
import { CHANNEL_META } from "@/lib/calendar-channels";
import { channelLogoLoose } from "@/lib/channel-logos";

/** Klarnamen, die auf einen Kanalcode zeigen — fuer das ICON-Ersatzzeichen.
 *
 *  `mybestdays` steht hier bewusst NICHT: unser Marktplatz hat ein ECHTES
 *  Logo (`/channels/mybestdays.png`), und das wird gezeigt — nie ein
 *  Globus-Icon an seiner Stelle. Der Kanalcode `portal` faellt dagegen auf
 *  das Icon zurueck, weil dort kein Name vorliegt, aus dem sich die Marke
 *  ableiten liesse. */
const NAME_ZU_KANAL: Record<string, AvailabilitySource> = {};

function kanalMeta(name: string): AvailabilitySource | null {
  const schluessel = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const zugeordnet = NAME_ZU_KANAL[schluessel];
  if (zugeordnet) return zugeordnet;
  // Kanalcodes (`direct`, `portal`, …) kommen unveraendert durch.
  return schluessel in CHANNEL_META
    ? (schluessel as AvailabilitySource)
    : null;
}

/** Traegt dieser Kanal ein echtes Wortlogo?
 *
 *  Wo ja, steht in der Tabelle NUR das Logo — der Schriftzug IST der Name,
 *  und „[Booking.com-Logo] Booking.com" schreibt ihn zweimal.
 *  Wo nein („Direkt"), stehen Symbol UND Name: ein Haus-Icon allein sagt
 *  nicht, welcher Kanal gemeint ist. */
export function hatWortlogo(name: string | null | undefined): boolean {
  if (!name) return false;
  return Boolean(
    channelLogoLoose(name) ??
      (name.toLowerCase() === "portal" ? channelLogoLoose("myBestDays") : null),
  );
}

export function KanalLogo({
  name,
  className = "",
}: {
  /** Klarname (`ota_name`, „Booking.com") oder Kanalcode — beides wird
   *  schreibweisen-tolerant aufgeloest. */
  name: string | null | undefined;
  className?: string;
}) {
  if (!name) return null;

  // 1. Das echte Markenlogo, wo es eines gibt (Booking.com, Airbnb, Vrbo,
  //    myBestDays). `w-auto` statt eines Quadrats — siehe Kopf.
  //
  //    Der Kanalcode `portal` IST unser Marktplatz: je nach Datenquelle steht
  //    in der Zeile mal der Klarname („myBestDays", aus `ota_name`), mal nur
  //    der Code. Beide muessen dasselbe echte Logo zeigen — sonst traegt
  //    unser eigener Kanal an der einen Stelle die Marke und an der anderen
  //    ein Globus-Icon.
  const logo =
    channelLogoLoose(name) ??
    (name.toLowerCase() === "portal" ? channelLogoLoose("myBestDays") : null);
  if (logo) {
    return (
      <Image
        src={logo}
        alt={name}
        width={160}
        height={44}
        className={`h-6 w-auto max-w-32 shrink-0 object-contain object-left ${className}`}
      />
    );
  }

  // 2. Kein Markenlogo, aber ein bekannter Kanal („Direkt") → sein Symbol in
  //    seiner Kanalfarbe, aus derselben Quelle wie der Multikalender.
  const kanal = kanalMeta(name);
  if (kanal) {
    const meta = CHANNEL_META[kanal];
    if (meta.logo.kind === "icon") {
      return (
        <Icon
          icon={meta.logo.icon}
          className={`size-4 shrink-0 ${meta.textFg} ${className}`}
        />
      );
    }
    return (
      <Image
        src={meta.logo.src}
        alt=""
        width={160}
        height={44}
        className={`h-6 w-auto max-w-32 shrink-0 object-contain object-left ${className}`}
      />
    );
  }

  // 3. Unbekanntes Portal: nur der Name. NIE ein geratenes Markenlogo und kein
  //    generisches Ersatz-Icon, das wie eine Marke aussieht (Wurzel 4).
  return null;
}
