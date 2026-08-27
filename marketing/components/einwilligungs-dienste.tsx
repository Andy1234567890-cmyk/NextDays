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
  //
  // KEIN „erstes Rendern auslassen" mehr. Genau das stand hier von 04:00 bis
  // 04:15 am 27.08.2026 und war ein schwerer Fehler: die Absicht war, den
  // ersten Treffer dem `skript.onload` in analyticsStarten zu ueberlassen. Bei
  // einem echten Seitenaufruf montiert diese Komponente aber NEU — der Merker
  // steht wieder auf `true` —, und wenn gtag.js zu diesem Zeitpunkt schon
  // geladen ist, feuert `onload` nie. Dann meldet NIEMAND den Treffer.
  //
  // Live gemessen: die Startseite zaehlte, `/preise`, `/funktionen`,
  // `/kontakt` und `/ueber-uns` sendeten KEINEN EINZIGEN Treffer. Die
  // Auswertung haette alle Zugriffe der Einstiegsseite zugeschlagen und jede
  // Unterseite mit null gefuehrt — plausibel genug, dass es niemandem auffaellt.
  //
  // Der Effekt meldet deshalb IMMER. Gegen Doppelzaehlung schuetzt bereits
  // `letzterPfad` in lib/analytics.ts; kommt der `onload` dem Effekt zuvor,
  // greift diese Sperre. Ein zu viel gemeldeter Treffer wird dort abgefangen,
  // ein nie gemeldeter ist unrettbar verloren — die Richtung des Zweifels
  // gehoert auf die Seite des Meldens.
  const abfrage = suchparameter?.toString() ?? "";
  useEffect(() => {
    if (!pfad) return;
    seitenaufrufMelden(abfrage ? `${pfad}?${abfrage}` : pfad);
  }, [pfad, abfrage]);

  return null;
}
