import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Riżervazzjonijiet u Kalendarju",
  description: "Żomm kontroll fuq ir-riżervazzjonijiet u l-kalendarju.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Riżervazzjonijiet u Kalendarju",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Evita Prenotazzjonijiet Żejda b'Mod Affidabbli",
          excerpt: "Hekk tiżgura li proprjetà qatt ma tiġi prenotata doppjament.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Proprjetà tinbiegħ permezz ta' diversi kanali fl-istess ħin — portali bħal Booking, Airbnb u oħrajn, il-pjattaforma proprja kif ukoll l-app. Prenotazzjoni żejda tinħoloq meta d-disponibbiltà fuq kanal wieħed ma tiġix mblukkata fil-ħin wara li ssir prenotazzjoni fuq kanal ieħor.",
            },
            {
              type: "steps",
              items: [
                "Iċċekkja fil-pjan tal-okkupazzjoni li kull proprjetà tkun eżattament linja waħda b'unità waħda li tista' tiġi prenotata — ebda kapaċità kondiviża ta' diversi kmamar.",
                "Ħalli l-prenotazzjonijiet ġodda jinħolqu esklussivament permezz tal-pjan tal-okkupazzjoni jew il-kanali konnessi, qatt billi tikteb manwalment fuq ġranet individwali.",
                "Wara kull prenotazzjoni, iċċekkja li l-lejliet prenotati jidhru minnufih bħala okkupati fil-kalendarju.",
                "Uża Stop-Sell minnufih f'każ ta' problemi tekniċi jew manutenzjoni, minflok ma tħalli l-ġurnata miftuħa.",
                "F'każ ta' inċertezza, iċċekkja l-linja ta' żmien tal-prenotazzjoni tar-riżervazzjoni affettwata biex issegwi l-proċess kronoloġiku.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Qatt tibdel il-lejliet jew l-imblukkar manwalment barra mill-pjan tal-okkupazzjoni — dan huwa l-uniku mod kif tassigura li l-kanali kollha jaraw l-istess stat ta' disponibbiltà u ma tinħoloq ebda lakuna għal prenotazzjoni doppja.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Iċċaqlaq Prenotazzjoni lejn Proprjetà Oħra",
          excerpt: "Hekk tittrasferixxi riżervazzjoni eżistenti b'mod nadif lejn proprjetà oħra.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Xi drabi mistieden irid iċċaqlaq minn proprjetà għal oħra, pereżempju minħabba difett tekniku jew fuq talba tal-mistieden. Waqt iċ-ċaqliq, il-lejliet preċedenti tal-kalendarju jiġu rilaxxati awtomatikament u okkupati mill-ġdid fil-proprjetà mira.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-prenotazzjoni affettwata fil-linja ta' żmien tal-prenotazzjoni.",
                "Agħżel “Ibdel Proprjetà” jew “Iċċaqlaq” fil-menu tal-azzjonijiet.",
                "Agħżel il-proprjetà mira u iċċekkja d-disponibbiltà tagħha fil-perjodu magħżul.",
                "Ikkonferma ċ-ċaqliq.",
                "Wara dan, iċċekkja fil-pjan tal-okkupazzjoni li l-lejliet il-qodma fil-proprjetà oriġinali jintwerew mill-ġdid bħala disponibbli.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Is-sistema tieħu ħsieb ir-rilaxx tal-lejliet il-qodma awtomatikament — m'għandekx bżonn tiftaħ int stess il-perjodu oriġinali manwalment. Informa lill-mistieden dwar il-bidla tal-proprjetà, speċjalment jekk il-faċilitajiet jew l-aċċess ivarjaw.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Oħloq Prenotazzjoni fit-Tul",
          excerpt: "Hekk toħloq korrettament riżervazzjoni fuq perjodu itwal.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Għal mistiedna fit-tul — pereżempju diversi ġimgħat jew xhur — toħloq riżervazzjoni bħas-soltu, imma tagħti attenzjoni addizzjonali għas-soġġorn minimu, ir-regoli tal-ħlas u l-viżibbiltà tal-kanal tal-proprjetà għall-perjodu kollu.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-pjan tal-okkupazzjoni tal-proprjetà mixtieqa u immarka l-perjodu sħiħ.",
                "Oħloq il-prenotazzjoni bid-dettalji tal-mistieden u d-data ppjanata tal-wasla u t-tluq.",
                "Ikkonfigura regola tal-ħlas b'depożitu u bilanċ finali jekk meħtieġ, minflok ma ttella' l-ammont sħiħ dovut minnufih.",
                "Iċċekkja li ebda regola ta' soġġorn minimu jew massimu ma tikkontradixxi l-perjodu twil.",
                "Issejvja l-prenotazzjoni u iċċekkja li l-perjodu kollu jidher korrettament bħala okkupat fil-kalendarju.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Għal soġġorni twal ħafna, jirrikkmanda bilanċ finali f'diversi ħlasijiet parzjali minflok skadenza kbira waħda — b'hekk ir-riskju tal-ħlas jibqa' ġestibbli. Dettalji dwar dan taħt [Awtomatizza l-Bilanċ Finali](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
