import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Servicegebyrer",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "myBestDays finansieres gennem et servicegebyr på formidlede bookinger. Denne side forklarer, hvem der betaler det, hvordan det beregnes, og hvor det oplyses.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Hvem der betaler servicegebyret",
      paragraphs: [
        "Servicegebyret bæres af udbyderen. Det fratrækkes bookingværdien og mindsker udbetalingen til denne; gæsten betaler det ikke derudover.",
        "Opstår der undtagelsesvis et servicegebyr for gæsten ved en booking, oplyser vi det som en selvstændig post i totalprisen før gennemførelsen af bookingen. Uden denne oplysning påløber der intet gebyr for gæsten.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Hvordan det beregnes",
      paragraphs: [
        "Servicegebyret er en procentdel af den bookingværdi, der afregnes via platformen. Den sats, der gælder for dine bookinger, fremgår af din værtskonto og af den aftale, du tiltrådte ved registreringen.",
        "Beregningsgrundlaget er overnatningsprisen med tillæg af de tillæg, der afregnes via platformen. Ikke medregnet er gennemløbsposter, der ikke er modydelse fra udbyderen — navnlig turistskat og depositum.",
        "Servicegebyret beregnes og oplyses i opslagets valuta.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Moms",
      paragraphs: [
        "Der påløber moms på servicegebyret, for så vidt den skyldes efter loven. Om den oplyses, eller om omvendt betalingspligt finder anvendelse, afhænger af udbyderens hjemsted og status.",
        "Om servicegebyret udsteder vi udbyderen en opgørelse, der kan hentes i dennes konto.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Afbestilling og refusion",
      paragraphs: [
        "Refunderes en booking fuldt ud, refunderer vi servicegebyret forholdsmæssigt i det omfang, bookingværdien refunderes.",
        "Afbestiller udbyderen uden vigtig grund, bortfalder servicegebyret ikke automatisk; vi forbeholder os at gøre de omkostninger gældende, som afbestillingen har medført.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Ændring af servicegebyret",
      paragraphs: [
        "En ændring af satsen varsler vi over for udbydere mindst 30 dage før ikrafttræden på et varigt medium; det svarer til artikel 3, stk. 2, i forordning (EU) 2019/1150.",
        "For allerede bekræftede bookinger gælder den sats, der var gældende på bookingtidspunktet.",
      ],
    },
  ],
};
