// Voice-Consent + Speech-Engine-Freischaltung (Andy).
//
// Browser blockieren speechSynthesis.speak(), solange keine echte User-Geste
// vorlag. Dieser Store hält die Nutzerentscheidung (zulassen/ablehnen) fest und
// stellt eine Freischalt-Funktion bereit, die INNERHALB des Consent-Klicks läuft
// und die Engine damit fuer die restliche Session entsperrt. Zentral, weil die
// spaetere Voice-Vollsteuerung von myNextDays denselben Consent nutzt.

const CONSENT_KEY = "nd_voice_consent";

export type VoiceConsent = "granted" | "denied" | null;

export function readVoiceConsent(): VoiceConsent {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw === "granted" || raw === "denied" ? raw : null;
  } catch {
    return null;
  }
}

export function writeVoiceConsent(value: Exclude<VoiceConsent, null>): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage kann in strikten Umgebungen fehlen; Consent gilt dann nur
    // fuer die aktuelle Ansicht (State), das ist akzeptabel.
  }
}

// Entsperrt die Speech-Engine. MUSS synchron aus einem echten Klick/Touch heraus
// aufgerufen werden, sonst verwirft der Browser die spaetere Sprachausgabe still.
// Ein kurzes, leeres Utterance „warmt" die Engine an; danach ist speak() erlaubt.
export function unlockSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const primer = new SpeechSynthesisUtterance(" ");
  primer.volume = 0;
  primer.lang = "de-DE";
  synth.speak(primer);
}
