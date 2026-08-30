// Portal-Bewertungstexte lesbar machen.
//
// Booking.com liefert DREI benannte Teile in EINEM Feld, mit \r\n getrennt:
//
//     Headline: Super ophold
//     Positive: Dejligt hus med have og alt hvad der skulle bruges.
//     Negative: Sengene kunne måske godt opgraderes 😊
//
// Ungeprüft angezeigt sah das in unserer Liste so aus, wie es hier steht —
// samt einem nackten „Negative:" ohne Inhalt, wenn der Gast nichts Negatives
// geschrieben hat. Das ist keine Bewertung, das ist ein Rohsatz.
//
// Zerlegt wird nur, was sich sicher zerlegen lässt: die drei Marker am
// Zeilenanfang. Alles andere bleibt unverändert stehen — lieber ein Text, der
// aussieht wie beim Portal, als einer, den wir versehentlich zerschnitten
// haben (Wurzel 4: nichts erfinden, was nicht dasteht).
//
// Eigene Datei ohne "use server": das hier ist reine Textarbeit, sie gehört
// nicht in eine Server-Action-Datei (dort darf nur Asynchrones exportiert
// werden, siehe lib/reviews-kanal.ts).
//
// SCHWESTERLOGIK: `apps/api/src/features/reviews/export.py:_lesbarer_text`
// zerlegt denselben Text fürs CSV. Bewusst KEINE gemeinsame Quelle — zwei
// Sprachen, zwei Laufzeiten, drei Zeilen Regel. Aber wer die Marker hier
// ändert, ändert sie dort mit: sonst enthält die Datei etwas anderes als der
// Bildschirm, und das merkt niemand.

/** Ein zerlegter Bewertungstext. Leere Teile sind `null`, nicht "" — die
 *  Anzeige soll „gibt es nicht" von „ist leer" unterscheiden können. */
export type ZerlegterText = {
  /** Die Überschrift, die Booking den Gast getrennt eingeben lässt. */
  titel: string | null;
  /** Was gefallen hat. Bei Kanälen ohne Aufteilung: der ganze Text. */
  positiv: string | null;
  /** Was nicht gefallen hat. */
  negativ: string | null;
  /** true, wenn wirklich in Teile zerlegt wurde — sonst steht alles in
   *  `positiv` und die Anzeige verzichtet auf die Beschriftungen. */
  aufgeteilt: boolean;
};

// Die Marker, die Booking.com setzt. Bewusst nur diese drei und nur am
// Zeilenanfang: ein „Positive:" mitten im Fließtext eines Gastes ist Teil
// seines Satzes, kein Abschnittsbeginn.
const MARKER = /^(Headline|Positive|Negative)\s*:\s*/i;

export function zerlegeBewertungstext(roh: string | null): ZerlegterText | null {
  const text = (roh ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return null;

  const zeilen = text.split("\n");
  const hatMarker = zeilen.some((z) => MARKER.test(z.trim()));
  if (!hatMarker) {
    return { titel: null, positiv: text, negativ: null, aufgeteilt: false };
  }

  const teile: Record<string, string[]> = {
    headline: [],
    positive: [],
    negative: [],
  };
  let aktuell: keyof typeof teile | null = null;

  for (const zeile of zeilen) {
    const treffer = zeile.trim().match(MARKER);
    if (treffer) {
      aktuell = treffer[1].toLowerCase() as keyof typeof teile;
      const rest = zeile.trim().replace(MARKER, "").trim();
      if (rest) teile[aktuell].push(rest);
      continue;
    }
    // Zeilen vor dem ersten Marker gehören zu nichts Benanntem — sie kommen
    // zum positiven Teil, damit sie nicht verschwinden.
    if (zeile.trim()) teile[aktuell ?? "positive"].push(zeile.trim());
  }

  const zusammen = (schluessel: keyof typeof teile): string | null => {
    const wert = teile[schluessel].join("\n").trim();
    return wert || null;
  };

  return {
    titel: zusammen("headline"),
    positiv: zusammen("positive"),
    negativ: zusammen("negative"),
    aufgeteilt: true,
  };
}

/** Eine Zeile für die Tabelle: der Kern des Textes, ohne Marker und Umbrüche.
 *
 *  Nimmt bewusst den TITEL, wenn es einen gibt — er ist die Zusammenfassung
 *  des Gastes selbst und damit besser als die ersten Wörter seines Fließtexts.
 */
export function bewertungsVorschau(roh: string | null): string {
  const t = zerlegeBewertungstext(roh);
  if (!t) return "";
  const quelle = t.titel || t.positiv || t.negativ || "";
  return quelle.replace(/\s+/g, " ").trim();
}
