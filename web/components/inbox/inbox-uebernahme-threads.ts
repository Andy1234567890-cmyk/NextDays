// Übernommene Nachrichtenverläufe im Posteingang: Erkennung am ID-Präfix.
//
// Anders als die WhatsApp-Threads werden diese NICHT im Frontend umgeformt —
// der Server liefert sie bereits als `InboxThread` (inbox/uebernahme.py). Hier
// steht nur, woran man sie erkennt, damit die Oberfläche die zwei Dinge lassen
// kann, die bei einem eingefrorenen Archiv nicht gehen: als gelesen markieren
// und antworten.
//
// Gleiches Prinzip wie `wa:` bei WhatsApp: eigener Präfix, keine Datenwanderung.

// Stabiler ID-Präfix (muss zu inbox/uebernahme.py:PREFIX passen).
export const UE_PREFIX = "ue:";

/** Ist das ein übernommener Verlauf aus einem fremden PMS? */
export const istUebernahme = (id: string) => id.startsWith(UE_PREFIX);
