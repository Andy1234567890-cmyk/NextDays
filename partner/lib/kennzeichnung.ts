// Pflicht-Wortlaute für die Werbekennzeichnung — nur, was belegt ist.
//
// Deutschland: § 5a Abs. 4 UWG, Leitfaden der Wettbewerbszentrale (08/2024):
// „Werbung" oder „Anzeige" am ANFANG, kein bloßes „#ad", Affiliate-Links und
// Codes ausdrücklich kennzeichnen.
// Dänemark: markedsføringsloven § 6 stk. 4, Forbrugerombudsmanden: „Reklame
// for …"/„Annonce for …" als Erstes im Beitrag, Affiliate-Links als
// „Reklamelink"/„Annoncelink" direkt am Link; „affiliate link" reicht NICHT.
//
// Für alle übrigen Länder steht hier bewusst KEIN nationaler Wortlaut — den
// hätten wir nicht belegt (Wurzel 4). Der Partner bekommt die EU-weite
// Grundregel (UCPD Art. 7 Abs. 2: kommerzielle Absicht klar erkennbar) und den
// Hinweis, die Regel seines Landes zu prüfen.
export type Kennzeichnung = {
  land: string;
  beitrag: string[];
  link: string[];
  quelle: string;
};

export const KENNZEICHNUNG: readonly Kennzeichnung[] = [
  {
    land: "DE",
    beitrag: ["Werbung", "Anzeige"],
    link: ["Werbelink", "Affiliate-Link (Werbung)"],
    quelle: "§ 5a Abs. 4 UWG · Wettbewerbszentrale, Leitfaden Werbekennzeichnung 08/2024",
  },
  {
    land: "DK",
    beitrag: ["Reklame for myNextDays", "Annonce for myNextDays"],
    link: ["Reklamelink", "Annoncelink"],
    quelle: "Markedsføringsloven § 6 stk. 4 · Forbrugerombudsmanden, „Skjult reklame på sociale medier“",
  },
];
