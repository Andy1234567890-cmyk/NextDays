// Texte der Voranmeldung (Popup + Bestätigungs-/Abmeldeseite).
//
// Bewusst NICHT in messages/*.json: diese Dateien werden gerade umgebaut
// (Marketing-Überarbeitung, 24 Sprachen). Ein eigener Baustein hier hält die
// Voranmeldung davon unabhängig; beim nächsten i18n-Durchgang wandern die Keys
// mit den übrigen Texten nach next-intl.
//
// Gepflegt sind Deutsch und Englisch. Jede andere Oberflächensprache bekommt
// Englisch — bewusst, statt maschinell erzeugter Texte in 22 Sprachen, die
// niemand gegengelesen hat (der Einwilligungstext ist rechtlich relevant).

export type VoranmeldungTexte = {
  titel: string;
  text: string;
  emailLabel: string;
  emailPlatzhalter: string;
  einwilligung: string;
  datenschutzLink: string;
  absenden: string;
  laeuft: string;
  schliessen: string;
  fehlerAllgemein: string;
  // Bestätigungsseite
  bestaetigenTitel: string;
  bestaetigenLaeuft: string;
  // Abmeldeseite
  abmeldenTitel: string;
  abmeldenLaeuft: string;
  zurueckZurSeite: string;
};

const DE: VoranmeldungTexte = {
  titel: "Sei von Anfang an dabei",
  text:
    "myNextDays startet bald. Trag dich ein und wir melden uns, sobald du " +
    "loslegen kannst — plus Neuigkeiten aus der Entwicklung.",
  emailLabel: "E-Mail-Adresse",
  emailPlatzhalter: "du@beispiel.de",
  einwilligung:
    "Ich möchte Neuigkeiten zu myNextDays per E-Mail erhalten und kann mich " +
    "jederzeit wieder abmelden.",
  datenschutzLink: "Datenschutzerklärung",
  absenden: "Eintragen",
  laeuft: "Wird gesendet …",
  schliessen: "Schließen",
  fehlerAllgemein: "Das hat gerade nicht geklappt. Bitte später erneut versuchen.",
  bestaetigenTitel: "Anmeldung bestätigen",
  bestaetigenLaeuft: "Einen Moment, wir prüfen den Link …",
  abmeldenTitel: "Abmeldung",
  abmeldenLaeuft: "Einen Moment …",
  zurueckZurSeite: "Zur Startseite",
};

const EN: VoranmeldungTexte = {
  titel: "Be there from day one",
  text:
    "myNextDays is launching soon. Leave your address and we'll let you know " +
    "the moment you can start — plus news from development.",
  emailLabel: "Email address",
  emailPlatzhalter: "you@example.com",
  einwilligung:
    "I'd like to receive news about myNextDays by email and can unsubscribe " +
    "at any time.",
  datenschutzLink: "Privacy policy",
  absenden: "Sign up",
  laeuft: "Sending …",
  schliessen: "Close",
  fehlerAllgemein: "That didn't work just now. Please try again later.",
  bestaetigenTitel: "Confirm subscription",
  bestaetigenLaeuft: "One moment, we're checking the link …",
  abmeldenTitel: "Unsubscribe",
  abmeldenLaeuft: "One moment …",
  zurueckZurSeite: "Back to the homepage",
};

export function voranmeldungTexte(locale: string | undefined): VoranmeldungTexte {
  return (locale || "").split("-")[0].toLowerCase() === "de" ? DE : EN;
}
