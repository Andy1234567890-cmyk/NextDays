import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalendarju u Disponibbiltà",
  description: "Pjan tal-okkupazzjoni, Stop-Sell u soġġorn minimu.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalendarju",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Aqra l-Pjan tal-Okkupazzjoni",
          excerpt: "Hekk taqra korrettament il-prenotazzjonijiet, id-disponibbiltà u l-prezzijiet fil-pjan tal-okkupazzjoni.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Il-pjan tal-okkupazzjoni juri f'daqqa waħda liema lejliet huma prenotati, disponibbli jew imblukkati. Fil-każ ta' proprjetajiet tal-vaganzi tara linja waħda għal kull proprjetà, fil-każ ta' lukandi tara veduta annidata b'linja waħda għal kull kategorija ta' kmamar u pjan tar-rata.",
            },
            { type: "h2", text: "Struttura tal-veduta" },
            {
              type: "steps",
              items: [
                "Iftaħ il-kalendarju permezz tal-element tal-menu “Pjan tal-Okkupazzjoni”.",
                "Fuq nett, agħżel il-perjodu li tixtieq tara.",
                "Iffiltra jekk meħtieġ skont proprjetajiet individwali jew kategoriji ta' kmamar.",
                "Ikklikkja fuq ġurnata biex tiftaħ id-dettalji dwar il-prezz u d-disponibbiltà.",
                "Ikklikkja fuq perjodu okkupat biex tiftaħ il-prenotazzjoni korrispondenti.",
              ],
            },
            { type: "h2", text: "Kuluri u simboli" },
            {
              type: "ul",
              items: [
                "Okkupat: il-perjodu huwa riżervat b'prenotazzjoni.",
                "Disponibbli: il-ġurnata tista' tiġi prenotata fuq il-kanali attivi kollha.",
                "Imblukkat: il-ġurnata mhix disponibbli għall-prenotazzjoni minħabba Stop-Sell jew imblukkar manwali.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kull linja fil-pjan tal-okkupazzjoni tirrappreżenta eżattament unità waħda li tista' tiġi prenotata — kamra jew proprjetà tal-vaganzi. Ma teżisti ebda linja kontenitur għal diversi kmamar fl-istess ħin.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Aktar dettalji dwar kif tiftaħ u tagħlaq b'mod immirat ġranet individwali ssibhom taħt [Issettja d-Disponibbiltà](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Issettja d-Disponibbiltà",
          excerpt: "Iftaħ u agħlaq b'mod immirat ġranet jew perjodi individwali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Id-disponibbiltà tiddetermina jekk proprjetà tistax tiġi prenotata f'ġurnata partikolari. Tista' tiftaħ jew tagħlaq ġranet individwali jew perjodi sħaħ, direttament fil-pjan tal-okkupazzjoni.",
            },
            { type: "h2", text: "Editja perjodu" },
            {
              type: "steps",
              items: [
                "Iftaħ il-pjan tal-okkupazzjoni tal-proprjetà mixtieqa.",
                "Immarka l-perjodu mixtieq billi tikklikkja u ġġib.",
                "Agħżel “Ibdel id-Disponibbiltà” fil-menu tal-azzjonijiet.",
                "Ikkonferma jekk il-perjodu għandux jinfetaħ jew jingħalaq.",
                "Issejvja l-bidla.",
              ],
            },
            { type: "h2", text: "Effett fuq il-kanali" },
            {
              type: "p",
              text: "Bidla fid-disponibbiltà taffettwa l-kanali ta' distribuzzjoni kollha li fuqhom il-proprjetà tkun viżibbli: portali bħal Booking, Airbnb u oħrajn, il-pjattaforma proprja kif ukoll l-app. It-trasferiment lill-portali jsir awtomatikament fl-isfond.",
            },
            {
              type: "ul",
              items: [
                "Ftuħ: il-ġurnata ssir disponibbli għall-prenotazzjoni fuq il-kanali attivi kollha.",
                "Għeluq: il-ġurnata tisparixxi mid-disponibbiltà għall-prenotazzjoni, imma tibqa' viżibbli fil-kalendarju.",
                "Prenotazzjonijiet li jeżistu diġà mhumiex affettwati minn bidla fid-disponibbiltà.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Tagħlaqx perjodu bl-intenzjoni li timblukkah kompletament u b'mod permanenti mill-bejgħ — għal dan Stop-Sell hija l-funzjoni korretta, ara [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-Sell timblokka ġurnata minnufih fuq il-kanali ta' distribuzzjoni kollha fl-istess ħin.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Stop-Sell hija l-aktar mod mgħaġġel biex tneħħi ġurnata individwali kompletament mill-bejgħ. B'differenza minn sempliċi bidla fid-disponibbiltà, Stop-Sell taħdem b'mod strett u minnufih fuq il-kanali kollha fl-istess ħin — fuq il-portali, il-pjattaforma proprja u l-app.",
            },
            { type: "h2", text: "Issettja Stop-Sell" },
            {
              type: "steps",
              items: [
                "Iftaħ il-pjan tal-okkupazzjoni tal-proprjetà affettwata.",
                "Agħżel il-ġurnata jew il-perjodu mixtieq.",
                "Ikklikkja “Attiva Stop-Sell” fil-menu tal-azzjonijiet.",
                "Ikkonferma l-imblukkar.",
              ],
            },
            { type: "h2", text: "Meta Stop-Sell tagħmel sens" },
            {
              type: "ul",
              items: [
                "Xogħol ta' manutenzjoni fuq perjodu qasir jew problemi tekniċi fil-proprjetà.",
                "Każ speċjali fejn ma tridx ebda prenotazzjoni ġdida minnufih u mingħajr eċċezzjoni.",
                "Imblukkar ta' emerġenza mgħaġġel u wiesa' fuq il-pjattaforma kollha, mingħajr ma tipproċessa kull kanal individwalment.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell ma tagħraf ebda eċċezzjoni speċifika għal kanal: jekk ġurnata tkun imblukkata, ebda mistieden ma jista' jipprenota permezz ta' ebda kanal, lanqas permezz tar-riċezzjoni jew talba diretta.",
            },
            {
              type: "note",
              variant: "info",
              text: "Għal użu personali permanenti jew manutenzjoni ppjanata, [Imblukkar Manwali](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung) hija xierqa minflok.",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Soġġorn Minimu u Massimu",
          excerpt: "Kemm żmien il-mistiedna jistgħu jipprenotaw minimu jew massimu.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Bis-soġġorn minimu u massimu, tiddetermina kemm-il lejl mistieden jista' jipprenota minimu jew massimu għal ġurnata tal-wasla. Dan jgħin biex jiġu evitati prenotazzjonijiet qosra ta' lakuna jew biex tippożizzjona l-proprjetà tiegħek b'mod immirat għal soġġorni itwal.",
            },
            { type: "h2", text: "Ikkonfigura regola" },
            {
              type: "steps",
              items: [
                "Fil-proprjetà, iftaħ il-pjan tal-okkupazzjoni jew it-tab “Prezzijiet”.",
                "Agħżel il-perjodu affettwat.",
                "Daħħal in-numru minimu ta' lejliet taħt “Soġġorn Minimu”.",
                "Daħħal b'mod fakultattiv in-numru massimu ta' lejliet taħt “Soġġorn Massimu”.",
                "Issejvja r-regola.",
              ],
            },
            { type: "h2", text: "Każijiet tipiċi ta' użu" },
            {
              type: "ul",
              items: [
                "Staġun għoli: soġġorn minimu ogħla biex jinġabru l-jiem ta' bidla.",
                "Staġun baxx: soġġorn minimu aktar baxx biex jippermetti aktar prenotazzjonijiet.",
                "Soġġorn massimu: utli meta proprjetà jkollha tkun ħielsa wara għal manutenzjoni jew użu ieħor.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ir-regola tapplika għall-ġurnata tal-wasla: mistieden ma jistax jasal għal jumejn biss f'ġurnata b'soġġorn minimu ta' tliet lejliet, anke jekk il-ġranet individwali jkunu disponibbli.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ikkombina soġġorni minimi itwal ma' [Skontijiet fuq is-Soġġorn](/hilfe/preise-raten/aufenthaltsrabatte) biex iżżid l-inċentiv għall-mistiedna.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Imblukkar Manwali",
          excerpt: "Irriżerva b'mod immirat perjodi għal użu personali jew manutenzjoni.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Imblukkar manwali jirriżerva perjodu fil-kalendarju mingħajr ma tkun teżisti prenotazzjoni reali ta' mistieden — pereżempju għal użu personali, xogħol ta' manutenzjoni ppjanat jew rinnovazzjonijiet. Il-perjodu jintwera fil-pjan tal-okkupazzjoni bħal prenotazzjoni, imma jkun rikonoxxibbli b'mod ċar bħala mblukkar.",
            },
            { type: "h2", text: "Oħloq imblukkar" },
            {
              type: "steps",
              items: [
                "Iftaħ il-pjan tal-okkupazzjoni tal-proprjetà affettwata.",
                "Immarka l-perjodu mixtieq.",
                "Agħżel “Imblokka Manwalment” fil-menu tal-azzjonijiet.",
                "Indika raġuni, eż. “Użu Personali” jew “Manutenzjoni”.",
                "Issejvja l-imblukkar.",
              ],
            },
            { type: "h2", text: "Differenza minn Stop-Sell" },
            {
              type: "p",
              text: "Imblukkar manwali jirriżerva b'mod konkret perjodu għal skop speċifiku u dokumentat, u jista' jerġa' jiġi rilaxxat aktar tard. Għal imblukkar ta' emerġenza immedjat u wiesa' fuq il-pjattaforma mingħajr perjodu dokumentat, Stop-Sell hija maħsuba minflok.",
            },
            {
              type: "ul",
              items: [
                "Imblukkar manwali: ippjanat, b'raġuni, għal użu personali jew manutenzjoni.",
                "Ir-rilaxx huwa possibbli fi kwalunkwe ħin, ladarba l-perjodu ma jkunx aktar meħtieġ.",
                "Il-lejliet imblukkati ma jgħoddux bħala prenotazzjoni ta' mistieden u ma jidhrux fil-ħarsa ġenerali tad-dħul.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ħassar imblukkar manwali ladarba r-raġuni ma tibqax teżisti — inkella l-proprjetà tibqa' mblukkata bla bżonn fuq il-kanali kollha.",
            },
            {
              type: "note",
              variant: "info",
              text: "Għal imblukkar immedjat mingħajr perjodu ppjanat, uża [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
