// reCAPTCHA Enterprise für die Bewerbung — geladen erst beim Absenden.
//
// Anders als auf der Marketing-Seite gibt es hier keine Einwilligungsleiste:
// die Bewerbung ist ein Kontoanlage-Formular, und der Bot-Schutz dafür ist
// eine Sicherheitsmaßnahme des ausdrücklich angeforderten Dienstes (Art. 5(3)
// ePrivacy, Ausnahme „unbedingt erforderlich" — dieselbe Einordnung wie ein
// Login-Captcha). Das Skript wird trotzdem NUR auf dieser Seite und NUR beim
// Absenden geladen; die Datenschutzerklärung nennt den Dienst.
//
// Ohne Schlüssel (lokal) passiert nichts und es kommt `null` zurück; die API
// entscheidet über ihre Sandbox (`captcha_sandbox`), der Browser nicht.
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
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

function laden(): Promise<Grecaptcha> | null {
  if (!SITE_KEY || typeof window === "undefined") return null;
  if (ladevorgang) return ladevorgang;
  ladevorgang = new Promise((resolve, reject) => {
    const fertig = () => {
      const g = window.grecaptcha;
      if (!g) return reject(new Error("grecaptcha fehlt"));
      g.enterprise.ready(() => resolve(g));
    };
    if (document.getElementById(SKRIPT_ID)) return fertig();
    const s = document.createElement("script");
    s.id = SKRIPT_ID;
    s.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(SITE_KEY)}`;
    s.async = true;
    s.onload = fertig;
    s.onerror = () => reject(new Error("recaptcha nicht ladbar"));
    document.head.appendChild(s);
  });
  return ladevorgang;
}

/** Token für die Aktion holen — MUSS mit `CAPTCHA_AKTION` in
 *  apps/api/src/features/affiliates/service.py übereinstimmen. */
export async function captchaToken(aktion = "partner_bewerbung"): Promise<string | null> {
  const p = laden();
  if (!p) return null;
  try {
    const g = await p;
    return await g.enterprise.execute(SITE_KEY, { action: aktion });
  } catch {
    return null;
  }
}
