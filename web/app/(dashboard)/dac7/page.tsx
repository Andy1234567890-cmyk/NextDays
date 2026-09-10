// Das DAC7-Modul (/dac7) — die gesetzliche Jahresmeldung an die Steuerbehörde.
//
// EIGENES MODUL, kein Unterpunkt der Buchhaltung: DAC7 (EU-Richtlinie
// 2021/514) ist kein Beleg- oder Zahlungsvorgang, sondern eine Meldepflicht
// gegenüber einer Behörde mit eigenem Ablauf — berechnen, prüfen, abgeben,
// korrigieren. Meldepflichtig ist der BETRIEB als Plattformbetreiber,
// deshalb liegt das Modul im PMS.
//
// Kein anderes PMS und kein Channel-Manager hat das; das Modul wird der
// dänischen Steuerbehörde vorgelegt. Die Regeln stammen ausschließlich aus
// deren amtlicher Vorlage — Belege in docs/dac7/VORLAGE-BEFUNDE.md.
import { Dac7Modul } from "@/components/dac7/dac7-modul";
import { getMeldelaeufe } from "@/lib/dac7";
import {
  getObjektangaben,
  getTaxpayerOverview,
} from "@/lib/dac7-steuerangaben";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DAC7-Meldung",
};

export default async function Dac7Page() {
  // Alles parallel: Meldeläufe, Steuerangaben und der Stand der Objektdaten
  // sind eigene Endpunkte, von denen keiner vom anderen abhängt.
  const [laeufe, steuern, objektangaben] = await Promise.all([
    getMeldelaeufe(),
    getTaxpayerOverview(),
    getObjektangaben(),
  ]);

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <Dac7Modul
        laeufe={laeufe}
        steuern={steuern}
        objektangaben={objektangaben}
      />
    </div>
  );
}
