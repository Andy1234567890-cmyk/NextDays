import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Ħlasijiet u Fatturi",
  description: "Fornituri tal-ħlas, regoli tal-ħlas u fatturi.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Ħlasijiet",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Qabbad Fornitur tal-Ħlas",
          excerpt:
            "Hekk tqabbad Stripe jew PayPal ma' myNextDays biex tipproċessa l-ħlasijiet awtomatikament.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Fornituri disponibbli" },
            {
              type: "p",
              text: "myNextDays tipproċessa l-ħlasijiet permezz ta' fornituri tal-ħlas konnessi. Bħalissa huma appoġġjati Stripe u PayPal — tista' tqabbad fornitur wieħed jew it-tnejn fl-istess ħin u tużahom skont il-proprjetà jew ix-xewqa tal-mistieden.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ Kont u aqleb għat-taqsima “Ħlasijiet”.",
                "Agħżel il-fornitur mixtieq — Stripe jew PayPal.",
                "Segwi d-djalogu tal-konnessjoni u idħol għand il-fornitur jew oħloq kont ġdid.",
                "Ikkonferma l-konnessjoni — l-istatus jinbidel għal “konness”.",
              ],
            },
            { type: "h2", text: "X'jiġri wara" },
            {
              type: "p",
              text: "Ladarba fornitur ikun konness, tista' tibgħat links ta' ħlas, tiġbor depożiti u tibda rifużjonijiet direttament mill-prenotazzjoni. L-ammonti kollha jiġu pproċessati fil-munita reġistrata għall-proprjetà rispettiva.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Mingħajr fornitur konness, tista' timmarka l-ħlasijiet manwalment biss bħala riċevuti — debitu awtomatiku ma jkunx possibbli f'dan il-każ.",
            },
            { type: "h2", text: "Diversi proprjetajiet, fornitur wieħed" },
            {
              type: "p",
              text: "Konnessjoni stabbilita darba tapplika għall-proprjetajiet kollha tiegħek fil-kont. Kif jaħdem id-debitu fid-dettall, tiddefinixxih permezz ta' [Regoli tal-Ħlas](/hilfe/zahlungen/zahlungsregeln). Il-ħlasijiet lilek isiru wara permezz tal-fornitur rispettiv, ara [Ħlasijiet](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe hija adattata għal ħlasijiet bil-karta u ħafna metodi ta' ħlas lokali",
                "PayPal toffri lill-mistiedna alternattiva familjari",
                "Iż-żewġ fornituri jistgħu jinqatgħu u jerġgħu jitqabbdu b'mod indipendenti minn xulxin",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Regoli tal-Ħlas",
          excerpt: "Iddefinixxi meta d-depożitu u l-bilanċ finali ta' prenotazzjoni jsiru dovuti.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Depożitu u Bilanċ Finali" },
            {
              type: "p",
              text: "Ir-regoli tal-ħlas jiddeterminaw kif tiġi pproċessata finanzjarjament prenotazzjoni — pereżempju depożitu mal-prenotazzjoni u bilanċ finali qabel il-wasla, jew il-ħlas sħiħ minnufih. Ir-regoli japplikaw għal kull proprjetà u jistgħu jiġu aġġustati fi kwalunkwe ħin.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà u aqleb għat-taqsima “Regoli tal-Ħlas”.",
                "Agħżel jekk jinġabarx depożitu, u ddefinixxi l-perċentwal.",
                "Iddetermina meta l-bilanċ finali jsir dovut, pereżempju ċertu numru ta' ġranet qabel il-wasla.",
                "Issejvja l-issettjar.",
              ],
            },
            { type: "h2", text: "Ġbir Awtomatiku" },
            {
              type: "p",
              text: "Jekk ikun konness fornitur tal-ħlas, myNextDays tiġbor id-depożitu u l-bilanċ finali awtomatikament fil-ħin reġistrat u tinforma lill-mistieden bil-quddiem b'messaġġ.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ir-regoli tal-ħlas japplikaw biss għal prenotazzjonijiet b'fornitur tal-ħlas konness. Mingħajr fornitur, timmarka l-ħlasijiet manwalment fil-prenotazzjoni.",
            },
            { type: "h2", text: "Differenzi skont il-kanal" },
            {
              type: "p",
              text: "Fuq il-portali jista' japplika l-ipproċessar tal-ħlas tagħhom stess — f'dan il-każ iċċekkja l-kundizzjonijiet tal-portal rispettiv. Għal prenotazzjonijiet permezz tal-pjattaforma jew il-websajt proprja, japplikaw dejjem ir-regoli reġistrati hawnhekk. Dettalji dwar il-konnessjoni tal-fornitur ssibhom taħt [Qabbad Fornitur tal-Ħlas](/hilfe/zahlungen/zahlungsanbieter-verbinden), dwar il-ħruġ tal-fatturi taħt [Oħloq Fatturi](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Id-depożitu jista' jkun ammont fiss jew perċentwal",
                "Il-limitu taż-żmien tal-bilanċ finali jista' jintgħażel liberament",
                "Il-bidliet japplikaw biss għal prenotazzjonijiet ġodda, mhux b'mod retroattiv",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Oħloq Fatturi",
          excerpt: "Hekk toħloq fattura b'indirizz tal-fatturazzjoni korrett għal prenotazzjoni.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Oħloq fattura" },
            {
              type: "p",
              text: "Għal kull prenotazzjoni tista' toħloq fattura — għall-mistieden stess jew għal kumpanija differenti, jekk il-prenotazzjoni ssir għal skopijiet ta' negozju.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-prenotazzjoni f'Riżervazzjonijiet.",
                "Agħżel “Oħloq Fattura”.",
                "Iċċekkja jew ikkompleta l-indirizz tal-fatturazzjoni.",
                "Iċċekkja l-entrati elenkati — akkomodazzjoni, Add-ons, imposti.",
                "Oħloq il-fattura u ibgħatha lill-mistieden.",
              ],
            },
            { type: "h2", text: "Immaniġġja l-indirizz tal-fatturazzjoni" },
            {
              type: "p",
              text: "Tista' ddaħħal l-indirizz tal-fatturazzjoni direttament fil-prenotazzjoni jew titlob lill-mistieden jibagħtu wara permezz tal-konferma tal-prenotazzjoni. Mingħajr indirizz komplut, f'ċerti pajjiżi ma tistax toħroġ fattura legalment valida.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fil-każ ta' klijenti tan-negozju, iċċekkja b'mod partikolari l-isem tal-kumpanija u l-indirizz — korrezzjonijiet aktar tard jeħtieġu fattura ta' korrezzjoni.",
            },
            { type: "h2", text: "Ammonti u munita" },
            {
              type: "p",
              text: "L-entrati kollha jintwerew fil-munita reġistrata għall-proprjetà. Il-ħlasijiet li diġà saru jiġu nnotati fuq il-fattura bħala riċevuta ta' ħlas. Kif jinħolqu d-depożitu u l-bilanċ finali aqrahom taħt [Regoli tal-Ħlas](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Il-fatturi jistgħu jitniżżlu bħala PDF",
                "Fatturi ta' korrezzjoni huma possibbli fi kwalunkwe ħin f'każ ta' bidliet",
                "L-Add-ons jidhru bħala entrata separata",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Rifużjonijiet",
          excerpt:
            "Hekk tirrifondi ħlas kompletament jew parzjalment meta prenotazzjoni tiġi kkanċellata jew mibdula.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Meta rifużjoni hija meħtieġa" },
            {
              type: "p",
              text: "Rifużjoni tipikament tapplika f'każ ta' kanċellazzjoni, imma tista' tkun meħtieġa wkoll f'każ ta' aġġustament tal-prezz aktar tard jew Add-on ikkanċellat.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-prenotazzjoni affettwata f'Riżervazzjonijiet.",
                "Agħżel “Rifużjoni” fit-taqsima tal-ħlas tal-prenotazzjoni.",
                "Daħħal l-ammont li għandu jiġi rifużut — sħiħ jew parzjali.",
                "Ikkonferma r-rifużjoni.",
              ],
            },
            { type: "h2", text: "Proċess permezz tal-fornitur tal-ħlas" },
            {
              type: "p",
              text: "Ir-rifużjoni tiġi eżegwita permezz tal-fornitur użat għall-ħlas — Stripe jew PayPal — u tiġi ttrasferita lura direttament lejn il-metodu ta' ħlas oriġinali tal-mistieden. Il-proċess jiġi nnotat awtomatikament fil-linja ta' żmien tal-prenotazzjoni.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Mingħajr fornitur tal-ħlas konness, rifużjoni ma tistax tinbeda awtomatikament — f'dan il-każ iċċara l-ħlas lura direttament mal-mistieden.",
            },
            { type: "h2", text: "Effett fuq il-kummissjonijiet" },
            {
              type: "p",
              text: "Il-kummissjonijiet tas-suq jew tal-portal diġà ffatturati jiġu aġġustati proporzjonalment f'każ ta' rifużjoni. Aktar dettalji taħt [Ifhem il-Kummissjonijiet](/hilfe/zahlungen/provisionen-verstehen). Dettalji dwar il-kanċellazzjoni nnifisha ssibhom taħt [Kanċellazzjoni u Rifużjoni](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Rifużjonijiet parzjali huma possibbli għal entrati individwali",
                "L-istatus tal-ipproċessar huwa viżibbli fil-prenotazzjoni fi kwalunkwe ħin",
                "Ir-rifużjonijiet isiru esklussivament permezz tal-fornitur oriġinarjament użat",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Ħlasijiet lilek",
          excerpt:
            "Hekk tirċievi d-dħul tal-prenotazzjonijiet tiegħek imħallas mill-fornituri tal-ħlas konnessi.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Kif jaħdmu l-ħlasijiet" },
            {
              type: "p",
              text: "Il-ħlasijiet li jaslu jinġabru l-ewwel għand il-fornitur tal-ħlas konness. Minn hemm isir il-ħlas lejn il-kont bankarju rreġistrat tiegħek skont ir-ritmu tas-soltu tal-fornitur rispettiv.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ Kont u aqleb għat-taqsima “Ħlasijiet”.",
                "Iċċekkja l-istatus tal-fornitur rispettiv taħt “Ħlasijiet”.",
                "Iftaħ il-veduta dettaljata tal-fornitur jekk meħtieġ għall-istorja sħiħa tal-ħlasijiet.",
              ],
            },
            { type: "h2", text: "X'jitnaqqas qabel il-ħlas" },
            {
              type: "p",
              text: "Qabel il-ħlas jitqiesu l-kummissjonijiet tas-suq u tal-portal applikabbli kif ukoll l-imposti tal-fornitur. L-ammont imħallas għalhekk mhux bilfors jikkorrispondi għas-somma oriġinali tal-prenotazzjoni.",
            },
            {
              type: "note",
              variant: "info",
              text: "L-istruttura eżatta tat-tnaqqis hija spjegata f'[Ifhem il-Kummissjonijiet](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Diversi proprjetajiet u sidien" },
            {
              type: "p",
              text: "Jekk timmaniġġja proprjetajiet għal sidien differenti, il-ħlasijiet jiġu assenjati skont il-fatturazzjonijiet tas-sidien irreġistrati. F'każ ta' diskrepanzi, iċċekkja l-ewwel l-istatus tal-prenotazzjonijiet sottostanti f'Riżervazzjonijiet.",
            },
            {
              type: "ul",
              items: [
                "Ir-ritmu u l-metodu tal-ħlas jiġu ddeterminati mill-fornitur rispettiv",
                "L-ammonti miżmuma, pereżempju waqt rifużjonijiet kurrenti, huma mmarkati",
                "L-istorja sħiħa hija disponibbli għall-verifika direttament għand il-fornitur",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Ifhem il-Kummissjonijiet",
          excerpt:
            "Ħarsa ġenerali lejn kif jitqassmu l-kummissjonijiet tas-suq u tal-portal u fejn jiġu ffatturati.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Żewġ tipi ta' kummissjonijiet" },
            {
              type: "p",
              text: "Għal prenotazzjonijiet permezz ta' myNextDays jistgħu japplikaw żewġ kummissjonijiet differenti: il-kummissjoni tas-suq għal prenotazzjonijiet permezz tal-pjattaforma proprja, kif ukoll kummissjonijiet tal-portal għal prenotazzjonijiet li jaslu permezz ta' portali konnessi bħal Booking jew Airbnb. It-tnejn huma indipendenti minn xulxin u jistgħu jvarjaw skont il-mogħdija ta' distribuzzjoni ta' prenotazzjoni.",
            },
            {
              type: "ul",
              items: [
                "Kummissjoni tas-suq: tapplika għal prenotazzjonijiet permezz tal-pjattaforma ta' myNextDays",
                "Kummissjoni tal-portal: tiġi kkalkulata mill-portal rispettiv skont il-kundizzjonijiet tiegħu stess",
                "Il-prenotazzjonijiet diretti permezz tal-websajt proprja tiegħek jitqiesu indipendenti minn dan",
              ],
            },
            { type: "h2", text: "Fejn huma viżibbli l-kummissjonijiet" },
            {
              type: "steps",
              items: [
                "Iftaħ Kont u aqleb għat-taqsima “Fatturazzjoni”.",
                "Agħżel ix-xahar mixtieq.",
                "Iċċekkja l-lista għal kull prenotazzjoni bil-kummissjoni korrispondenti.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Permezz ta' liema kanal waslet prenotazzjoni tarah direttament fuq il-prenotazzjoni nnifisha — dan jispjega liema kummissjoni ġiet applikata.",
            },
            { type: "h2", text: "Rabta mal-ħlasijiet" },
            {
              type: "p",
              text: "Il-kummissjonijiet jitnaqqsu mis-somma tal-prenotazzjoni qabel il-ħlas. Dettalji dwar il-proċess tal-ħlas ssibhom taħt [Ħlasijiet](/hilfe/zahlungen/auszahlungen). F'każ ta' rifużjoni, il-kummissjoni korrispondenti tiġi kkoreġuta proporzjonalment — il-proċess sħiħ ta' prenotazzjoni jidher fil-[Linja ta' Żmien tal-Prenotazzjoni](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
