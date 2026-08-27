"use client";

// Hält die einwilligungspflichtigen Dienste im Einklang mit der Entscheidung
// des Besuchers und meldet Seitenwechsel an die Messung. Rendert NICHTS — sie
// hängt nur im Layout, damit es genau EINE Stelle gibt, die das tut.
//
// Warum eine Komponente und nicht ein Aufruf im Layout: Das Layout ist eine
// Server-Komponente. Der localStorage, in dem die Entscheidung liegt, existiert
// nur im Browser — die Prüfung muss also clientseitig laufen, und zwar erneut,
// sobald die Leiste etwas ändert.
//
// Der Widerruf ist hier genauso wichtig wie die Zustimmung (Wurzel 1: jede
// Aktion hat einen Gegenzustand). Wer in der Leiste „Statistik" abwählt, muss
// ohne Neuladen aus der Messung fallen — sonst zählt der Rest des Besuchs
// weiter, obwohl gerade widerrufen wurde.
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { analyticsStarten, analyticsWiderrufen, seitenaufrufMelden } from "@/lib/analytics";
import { captchaWiderrufen } from "@/lib/captcha";
import { pixelStarten, pixelWiderrufen } from "@/lib/pixel";
import { EINWILLIGUNG_EREIGNIS, istErlaubt } from "@/lib/einwilligung";

export function EinwilligungsDienste() {
  const pfad = usePathname();
  const suchparameter = useSearchParams();

  // Zustimmung/Widerruf beobachten — für BEIDE einwilligungspflichtigen
  // Dienste. Dieselben zwei Ereignisse wie in `useEinwilligung`: eigenes für
  // diesen Tab, `storage` für andere Tabs.
  //
  // Der Spamschutz gehört hier mit hinein, obwohl die Komponente nach der
  // Messung benannt ist: er hat keinen eigenen Beobachter, und sein Cookie
  // (`_GRECAPTCHA`) blieb nach einem Widerruf liegen. Wer einen dritten Dienst
  // ergänzt, ergänzt ihn HIER — nicht in einer weiteren Komponente, sonst
  // vergisst der nächste Dienst seinen Gegenzustand wieder.
  //
  // Kein `GA_MEASUREMENT_ID`-Ausstieg mehr vor dem Abgleich: ohne Mess-ID gibt
  // es keine Messung, aber sehr wohl einen Spamschutz, der widerrufen werden
  // muss. Die einzelnen Funktionen prüfen ihre eigene Voraussetzung selbst.
  useEffect(() => {
    const abgleichen = () => {
      if (istErlaubt("analytisch")) analyticsStarten();
      else analyticsWiderrufen();
      if (!istErlaubt("funktional")) captchaWiderrufen();
      if (istErlaubt("marketing")) pixelStarten();
      else pixelWiderrufen();
    };
    abgleichen();
    window.addEventListener(EINWILLIGUNG_EREIGNIS, abgleichen);
    window.addEventListener("storage", abgleichen);
    return () => {
      window.removeEventListener(EINWILLIGUNG_EREIGNIS, abgleichen);
      window.removeEventListener("storage", abgleichen);
    };
  }, []);

  // Seitenwechsel melden. Die Suchparameter gehören in den Pfad, sonst sehen
  // /funktionen?thema=a und ?thema=b in der Auswertung identisch aus.
  //
  // Die Abhängigkeit ist der STRING, nicht das URLSearchParams-Objekt.
  // `useSearchParams()` gibt bei Client-Navigation ein NEUES Objekt zurück,
  // auch wenn die Abfrage gleich bleibt — mit dem Objekt als Dependency lief
  // der Effekt zweimal und jede per Link erreichte Seite wurde DOPPELT
  // gezählt. Live gemessen am 26.08.2026: ein Klick auf /preise ergab
  // `['/preise', '/preise']` in der dataLayer. Ein String wird wertverglichen,
  // damit feuert der Effekt genau bei echtem Seitenwechsel.
  const abfrage = suchparameter?.toString() ?? "";
  useEffect(() => {
    if (!pfad) return;
    seitenaufrufMelden(abfrage ? `${pfad}?${abfrage}` : pfad);
  }, [pfad, abfrage]);

  return null;
}
