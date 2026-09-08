// Die gewählte Sprache über Neustarts hinweg behalten.
//
// WARUM KEYCHAIN und nicht AsyncStorage: die App bringt AsyncStorage gar nicht
// mit (Tokens gehören laut CLAUDE.md ausschließlich in die Keychain, und ein
// zweiter Speicher nur für eine Zeichenkette wäre ein weiteres natives Modul
// samt Store-Angaben). Die Sprache ist kein Geheimnis — sie liegt hier, weil
// dieser Speicher bereits da ist, nicht weil sie Schutz bräuchte.
//
// Gespeichert wird die WAHL des Nutzers, nicht die berechnete Sprache: fällt
// eine Sprache weg oder kommt eine dazu, greift wieder die Kette in
// `lib/sprache.ts` (Wahl → Profil → Gerät → de).
import * as Keychain from "react-native-keychain";

const SERVICE = "com.mynextdays.owner.sprache";

/** Die gespeicherte Wahl, oder `null` wenn noch keine getroffen wurde. */
export async function spracheLaden(): Promise<string | null> {
  try {
    const eintrag = await Keychain.getGenericPassword({ service: SERVICE });
    return eintrag ? eintrag.password : null;
  } catch {
    // Ein nicht lesbarer Speicher ist kein Grund, die App aufzuhalten — die
    // Kette fällt dann auf Profil bzw. Gerät zurück.
    return null;
  }
}

/** Die Wahl merken. Fehler werden geschluckt: sie gilt dann für diese Sitzung. */
export async function spracheSpeichern(sprache: string): Promise<void> {
  try {
    await Keychain.setGenericPassword("sprache", sprache, { service: SERVICE });
  } catch {
    // Bewusst still: die Oberfläche hat bereits umgestellt, und eine
    // Fehlermeldung über einen misslungenen Komfort-Speicher hilft niemandem.
  }
}
