// Google-Tag (gtag.js) der Kunden-Website (0430).
//
// EIN Snippet für alle vier Kennungen: Analytics (G-), Altbestand (UA-), Ads
// (AW-) und Campaign Manager (DC-). Google liefert für alle dasselbe Skript;
// welches Produkt gemeint ist, entscheidet das Präfix der Kennung. Deshalb gibt
// es im Baukasten ein Feld und nicht vier.
//
// Zustimmung: das Skript lädt IMMER, die Messung erst nach Freigabe. Das ist
// Googles Consent Mode v2 — `gtag('consent', 'default', …)` steht VOR dem
// Laden, mit allem auf „denied". In diesem Zustand setzt gtag keine Cookies und
// sendet keine personenbezogenen Daten, sondern nur anonyme, zusammengefasste
// Signale. Erst der Klick im Cookie-Hinweis schaltet auf `granted`.
//
// Warum nicht das Skript einfach weglassen, bis geklickt wurde: dann fehlt jede
// Messung für alle, die den Hinweis ignorieren, und Google kann die Lücke nicht
// modellieren. Der Consent Mode ist genau für diesen Fall gebaut — und er ist
// der Punkt, an dem wir es besser machen als Hostaway, dessen Doku offen
// einräumt: „Consent management apps are not able to prevent code from running
// prior to consent when the code is placed in the header HTML."
import Script from "next/script";

import type { SiteBranding } from "@/lib/site-context";

/** Kennungen, die eine Zustimmung brauchen, bevor gemessen wird.
 *
 *  Alle vier. Auch eine Ads-Kennung setzt Cookies, sobald sie messen darf —
 *  „nur Analytics braucht Zustimmung" ist ein verbreiteter Irrtum. */
const EINWILLIGUNG_NOETIG = true;

export function GoogleTag({
  branding,
}: {
  branding: SiteBranding | null | undefined;
}) {
  const id = branding?.gtag_id?.trim();
  if (!id) return null;

  // Der Cookie-Hinweis entscheidet über die Freigabe. Hat der Betrieb keinen
  // aktiviert, gibt es niemanden, der `granted` senden könnte — dann läuft die
  // Messung sofort.
  //
  // Das ist bewusst KEINE stille Umgehung: wer in der EU messen will, braucht
  // den Hinweis, und der Baukasten sagt das an der Stelle, an der man die
  // Kennung eintippt. Hier ohne Hinweis dauerhaft auf „denied" zu bleiben wäre
  // die Alternative — dann wäre das Feld für jeden ohne Banner wirkungslos, und
  // niemand fände heraus, warum keine Zahlen kommen.
  const brauchtKlick = EINWILLIGUNG_NOETIG && Boolean(branding?.cookie_banner);

  const vorlauf = brauchtKlick
    ? `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
try {
  if (window.localStorage.getItem('nd-cookie-hinweis') === 'ok') {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
  }
} catch (e) {
  /* Privates Fenster: es bleibt bei 'denied'. Fail-closed ist hier auch die
     rechtlich richtige Richtung. */
}
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});
`
    : `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});
`;

  return (
    <>
      {/* Der Vorlauf MUSS vor gtag.js laufen — sonst gilt der Consent-Default
          nicht mehr, und gtag hat gemessen, bevor irgendwer zugestimmt hat.
          Deshalb ein GEWÖHNLICHES Inline-Script und kein `next/script`:
          `strategy="beforeInteractive"` wirkt ausschließlich im Root-Layout und
          wäre hier eine Attrappe (ESLint sagt es auch:
          no-before-interactive-script-outside-document). Ein Inline-Script
          dagegen läuft garantiert beim Parsen — also vor dem
          `afterInteractive`-Skript darunter, das erst nach der Hydration lädt.

          Der Inhalt ist vollständig eigener Code; die einzige eingesetzte
          Variable ist die Kennung, und die ist serverseitig gegen
          `^(G|UA|AW|DC)-[A-Za-z0-9-]{4,24}$` geprüft und wird zusätzlich als
          JSON-Literal eingesetzt. Ein `</script`-Ausbruch ist damit
          ausgeschlossen. */}
      <script dangerouslySetInnerHTML={{ __html: vorlauf }} />
      <Script
        id="nd-gtag"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
      />
    </>
  );
}
