// reCAPTCHA Enterprise im Browser: Skript nachladen und ein Token holen.
//
// WARUM NACHLADEN UND NICHT IM LAYOUT: Das Skript ist ein Drittanbieter-Request
// (google.com) und würde sonst auf JEDER Seite dieser App laufen — auch auf den
// Rechtstexten, die nichts absenden. Diese App lädt bewusst nicht einmal ihre
// Schriften extern; ein globales Google-Skript für ein Formular wäre nicht
// verhältnismäßig. Geladen wird deshalb erst, wenn jemand das Kontaktformular
// wirklich anfasst.
//
// WARUM DAS TOKEN ERST BEIM ABSENDEN GEHOLT WIRD: Es ist nur zwei Minuten
// gültig und nur einmal verwendbar. Ein Token vom Seitenaufruf ist abgelaufen,
// bevor jemand seine Nachricht getippt hat — die Anfrage käme mit
// `EXPIRED_OR_DUPLICATE` zurück.
//
// Ohne Schlüssel (lokal) passiert hier NICHTS und es kommt `null` zurück. Die
// API entscheidet dann über ihre eigene Sandbox, ob sie das durchlässt — der
// Browser darf diese Entscheidung nicht treffen.
//
// EINWILLIGUNG IST VORAUSSETZUNG: Dies ist der einzige Drittanbieter, den diese
// App im Browser lädt, und damit die einzige Stelle, an der die
// Einwilligungs-Leiste wirklich etwas schaltet (lib/einwilligung.ts). Ohne
// erteilte Einwilligung wird das Skript-Tag NICHT angelegt — kein Request an
// google.com, keine IP-Übermittlung. Fail-closed: „nicht entschieden" zählt wie
// „nicht erlaubt". Wer hier eine Ausnahme einbaut, macht die Leiste zur
// Attrappe.
import { RECAPTCHA_SITE_KEY } from "@/lib/config";
import { istErlaubt } from "@/lib/einwilligung";

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
 */
export function captchaVorbereiten(): Promise<Grecaptcha> | null {
  if (!RECAPTCHA_SITE_KEY) return null;
  if (typeof window === "undefined") return null;
  // Vor der Einwilligung nichts laden. Die Prüfung steht VOR dem Zwischen-
  // speicher: erteilt jemand die Einwilligung erst später, ist `ladevorgang`
  // noch leer und der nächste Aufruf holt das Skript dann — ohne Neuladen der
  // Seite.
  if (!istErlaubt("spamschutz")) return null;
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
      RECAPTCHA_SITE_KEY,
    )}`;
    tag.async = true;
    tag.onload = fertig;
    tag.onerror = () => {
      // Damit ein späterer Versuch es erneut probieren darf — sonst bliebe ein
      // einmaliger Netzfehler für die ganze Sitzung hängen.
      ladevorgang = null;
      reject(new Error("reCAPTCHA konnte nicht geladen werden."));
    };
    document.head.appendChild(tag);
  });

  return ladevorgang;
}

/**
 * Holt ein frisches Token für eine Aktion. `null`, wenn kein Schlüssel
 * konfiguriert ist.
 *
 * `aktion` MUSS mit dem String übereinstimmen, den die API erwartet
 * (`CAPTCHA_AKTION` in `features/contact/service.py`) — Google prüft ihn gegen.
 */
export async function captchaToken(aktion: string): Promise<string | null> {
  const vorbereitung = captchaVorbereiten();
  if (!vorbereitung) return null;
  const g = await vorbereitung;
  return g.enterprise.execute(RECAPTCHA_SITE_KEY, { action: aktion });
}
