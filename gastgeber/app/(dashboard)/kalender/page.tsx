// Multi-Kalender (Server Component) nach dem Airbnb-Vorbild /multicalendar:
// links die Inserate, rechts das Raster aller Objekte über die Tage, dazu das
// Bearbeiten-Panel. Das erste Fenster (eine Woche zurück, gut zwei Monate
// voraus) kommt server-zu-server; weiter blättert der Client per Action nach.
import { MultiKalender } from "@/components/kalender/multi-kalender";
import { getKalenderFenster, isoTag, tagPlus } from "@/lib/kalender";
import { getProperties } from "@/lib/properties";

export default async function KalenderPage() {
  const objekte = await getProperties();
  const heute = isoTag(new Date());
  const start = tagPlus(heute, -7);
  const end = tagPlus(heute, 70);
  const fenster = await getKalenderFenster(
    objekte.map((o) => o.id),
    start,
    end,
  );

  return <MultiKalender objekte={objekte} fenster={fenster} heute={heute} />;
}
