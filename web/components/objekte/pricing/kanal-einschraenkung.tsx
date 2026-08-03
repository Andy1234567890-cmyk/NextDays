"use client";

// Kanal-Einschränkung einer Gebühr/Steuer: „auf welchen Kanälen wird sie
// erhoben?" Im Branchenstandard ist das ein eigener Block mit Checkboxen, in dem
// die EIGENE Buchungsstrecke gleichrangig neben Airbnb und Booking.com steht
// (live abgelesen 03.08.2026: „Lodgify · Airbnb · Booking.com").
//
// Bei uns sind es zwei eigene Strecken — die Website/Direktbuchung und der
// Marktplatz myBestDays —, weil das laut Datenmodell zwei Vertriebskanäle sind.
// Die Codes sind dieselben, die auch in Reservierungen stehen ("direct",
// "portal"), damit der Preis-Resolver dieselbe Einschränkung lesen kann.
//
// Nichts ausgewählt = alle Kanäle. Das ist NICHT dasselbe wie „keiner": eine
// leere Auswahl heißt „keine Einschränkung", so wie im Standard.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Hint } from "@/components/objekte/editor-primitives";
import { Checkbox } from "@nextdays/ui/checkbox";
import { channelLabel } from "@/lib/channel-logos";
import { listChannelConnections } from "@/lib/channex";

/** Eigene Buchungsstrecken — immer wählbar, unabhängig von verbundenen Portalen. */
const EIGENE = ["direct", "portal"] as const;

export function KanalEinschraenkung({
  propertyId,
  selected,
  onChange,
}: {
  propertyId: string;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("objects");
  const [portale, setPortale] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await listChannelConnections(propertyId);
      if (!res.ok) return;
      // Nur die WIRKLICH verbundenen Portale dieses Objekts: eine Einschränkung
      // auf ein nicht verbundenes Portal wäre wirkungslos und würde in der
      // Oberfläche Sicherheit vortäuschen (der Server weist sie auch ab).
      const codes = res.data.items
        .map((c) => c.portal_code)
        .filter((code): code is string => Boolean(code));
      setPortale([...new Set(codes)]);
    })();
  }, [propertyId]);

  function umschalten(code: string) {
    onChange(
      selected.includes(code)
        ? selected.filter((x) => x !== code)
        : [...selected, code],
    );
  }

  const zeilen: { code: string; label: string }[] = [
    ...EIGENE.map((code) => ({ code, label: t(`pricingForm.ownChannel.${code}`) })),
    ...portale.map((code) => ({ code, label: channelLabel(code) })),
  ];

  // KEIN eigener Titel/Untertitel: der einzige Aufrufer ist ein Dialog, dessen
  // Kopf beide bereits trägt — so stand „Einschränkungen · Wählen Sie die Kanäle
  // aus …" zweimal untereinander im selben Fenster.
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {zeilen.map((zeile) => (
          <label
            key={zeile.code}
            className="flex cursor-pointer items-center gap-3 text-sm"
          >
            <Checkbox
              checked={selected.includes(zeile.code)}
              onCheckedChange={() => umschalten(zeile.code)}
            />
            <span>{zeile.label}</span>
          </label>
        ))}
      </div>
      <Hint>{t("pricingForm.restrictionsNote")}</Hint>
    </section>
  );
}
