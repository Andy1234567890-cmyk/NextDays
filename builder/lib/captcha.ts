// reCAPTCHA Enterprise im Browser: Skript nachladen und ein Token holen (0445).
//
// SCHWESTERDATEI-GEDANKE (bewusste Kopie von marketing/lib/captcha.ts): es ist
// DERSELBE Dienst mit DEMSELBEN Schlüssel — nur der Ort ist ein anderer. Eine
// zweite Captcha-Kette mit eigenem Anbieter wäre ein zweiter Schlüssel, ein
// zweites Kontingent und eine zweite Schwelle, die auseinanderlaufen können.
// Bewertet wird immer serverseitig durch `core/captcha.py`; der Browser holt
// nur das Token.
//
// DREI Unterschiede zur Marketing-Fassung, jeder mit Grund:
//
//  1. **Kein Einwilligungs-Tor.** Die Marketing-App lädt das Skript erst nach
//     erteilter Einwilligung, weil dort ein Kontaktformular EIN Angebot unter
//     vielen ist. Hier ist der Spamschutz die Bedingung dafür, dass das
//     Formular überhaupt etwas annimmt: die API weist ohne Token ab
//     (fail-closed), es gibt keinen Schalter „ohne Captcha senden", und
//     Hostaway hat aus demselben Grund keinen. Ein Einwilligungs-Tor davor
//     hieße: wer ablehnt, kann dem Betrieb nicht schreiben — und niemand sagt
//     ihm warum.
//  2. **Geladen wird erst bei der ERSTEN Eingabe im Formular.** Nicht beim
//     Seitenaufruf. Wer die Seite nur liest, löst keinen Request an google.com
//     aus; wer zu tippen anfängt, will absenden. Das ist dieselbe Zurückhaltung
//     wie in der Marketing-App, nur an einen anderen Auslöser gehängt.
//  3. **Eigener Aktionsname** (`website_formular`, siehe
//     `CAPTCHA_AKTION` in `site_config/weiterleitungen.py`). Wäre er derselbe
//     wie auf unserer Kontaktseite, ließe sich ein dort erzeugtes Token hier
//     vorzeigen.
//
// Ohne Schlüssel (lokal) passiert hier NICHTS und es kommt `null` zurück. Die
// API entscheidet dann über ihre eigene Sandbox, ob sie das durchlässt — der
// Browser darf diese Entscheidung nicht treffen (Wurzel 4: kein erfundener
// Ersatz für einen fehlenden Schutz).

/** Öffentlicher reCAPTCHA-Enterprise-Schlüssel. Er ist bewusst öffentlich —
 *  geheim ist nur der API-Schlüssel, mit dem die FastAPI das Token bewerten
 *  lässt. Beide Seiten MÜSSEN dieselbe Kennung tragen (`RECAPTCHA_SITE_KEY` in
 *  der API), sonst hält Google jedes Token für ungültig.
 *
 *  Leer heißt: kein Skript, kein Token. Das ist der lokale Normalfall — die API
 *  riegelt dann über ihre Sandbox ab (`captcha_sandbox`). In Produktion ist ein
 *  leerer Wert ein Konfigurationsfehler, und die API antwortet mit 503 statt
 *  ungeprüft anzunehmen. */
const SITE_KEY = (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "").trim();

/** Der Aktionsname. MUSS mit `CAPTCHA_AKTION` im Backend übereinstimmen —
 *  Google prüft ihn gegen. */
export const CAPTCHA_AKTION = "website_formular";

const SKRIPT_ID = "nd-recaptcha-enterprise";

type Grecaptcha = {
  enterprise: {
    ready: (cb: () => void) => void;
    execute: (siteKey: string, opts: { action: string }) => Promise<string>;
  };
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

let ladevorgang: Promise<Grecaptcha> | null = null;

/**
 * Lädt das Skript einmal und löst auf, sobald `grecaptcha.enterprise` bereit
 * ist. Mehrfache Aufrufe teilen dasselbe Versprechen — sonst hängen bei zwei
 * schnellen Klicks zwei Skript-Tags in der Seite.
 *
 * `null`, wenn kein Schlüssel gesetzt ist oder der Aufruf serverseitig kommt.
 */
export function captchaVorbereiten(): Promise<Grecaptcha> | null {
  if (!SITE_KEY) return null;
  if (typeof window === "undefined") return null;
  if (ladevorgang) return ladevorgang;

  ladevorgang = new Promise<Grecaptcha>((resolve, reject) => {
    const fertig = () => {
      const g = window.grecaptcha;
      if (!g?.enterprise) {
        reject(new Error("reCAPTCHA wurde geladen, meldet sich aber nicht."));
        return;
      }
      // `ready` wartet, bis die Bibliothek ihre eigene Initialisierung
      // abgeschlossen hat; ein `execute` davor wirft.
      g.enterprise.ready(() => resolve(g));
    };

    const vorhanden = document.getElementById(SKRIPT_ID);
    if (vorhanden) {
      fertig();
      return;
    }

    const tag = document.createElement("script");
    tag.id = SKRIPT_ID;
    tag.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(
      SITE_KEY,
    )}`;
    tag.async = true;
    tag.onload = fertig;
    tag.onerror = () => {
      // Zurücksetzen, damit ein späterer Versuch es erneut probieren darf —
      // sonst bliebe ein einmaliger Netzfehler für die ganze Sitzung hängen.
      ladevorgang = null;
      reject(new Error("reCAPTCHA konnte nicht geladen werden."));
    };
    document.head.appendChild(tag);
  });

  return ladevorgang;
}

/**
 * Holt ein frisches Token. `null`, wenn kein Schlüssel konfiguriert ist.
 *
 * Das Token wird ERST BEIM ABSENDEN geholt und nicht beim Seitenaufruf: es ist
 * zwei Minuten gültig und nur EINMAL verwendbar. Ein Token vom Seitenaufruf
 * wäre abgelaufen, bevor jemand seine Anfrage getippt hat — die API bekäme es
 * von Google mit `EXPIRED_OR_DUPLICATE` zurück, und der Gast läse „Die
 * Spamschutz-Prüfung ist abgelaufen", ohne etwas falsch gemacht zu haben.
 */
export async function captchaToken(): Promise<string | null> {
  const vorbereitung = captchaVorbereiten();
  if (!vorbereitung) return null;
  const g = await vorbereitung;
  return g.enterprise.execute(SITE_KEY, { action: CAPTCHA_AKTION });
}
