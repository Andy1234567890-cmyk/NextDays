import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Riżervazzjonijiet u Prenotazzjonijiet",
  description: "Immaniġġja, ittrasferixxi u kkanċella prenotazzjonijiet.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Prenotazzjonijiet",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Irreġistra Prenotazzjoni Manwalment",
          excerpt:
            "Hekk tirreġistra direttament f'myNextDays prenotazzjoni li waslet bit-telefon jew bl-email.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Meta tirreġistra manwalment" },
            {
              type: "p",
              text: "Mhux kull prenotazzjoni tidħol permezz ta' portal jew il-pjattaforma proprja tiegħek — talbiet bit-telefon, bl-email jew fuq il-post trid toħloqhom int stess, sabiex il-proprjetà tkun imblukkata korrettament f'myNextDays u ma tinħoloqx okkupazzjoni doppja.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ Riżervazzjonijiet u ikklikkja “Prenotazzjoni Ġdida”.",
                "Agħżel il-proprjetà — kull proprjetà f'myNextDays hija unità waħda li tista' tiġi prenotata, jiġifieri kamra jew proprjetà tal-vaganzi speċifika.",
                "Iddefinixxi l-wasla u t-tluq kif ukoll in-numru ta' mistiedna.",
                "Daħħal id-dettalji tal-mistieden (isem, kuntatt, u l-indirizz għall-fattura jekk applikabbli).",
                "Iċċekkja l-prezz propost u aġġustah jekk meħtieġ.",
                "Issejvja l-prenotazzjoni — il-lejliet jiġu mblukkati minnufih fil-kalendarju.",
              ],
            },
            { type: "h2", text: "Ħlas u Konferma" },
            {
              type: "p",
              text: "Wara li tissejvja, japplikaw l-istess regoli ta' ħlas bħal għal prenotazzjonijiet online. Jekk ikun konness fornitur tal-ħlas, tista' tibgħat link ta' ħlas direttament lill-mistieden jew timmarka l-ħlas manwalment bħala riċevut.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Daħħal talbiet speċjali (wasla bikrija, sodod addizzjonali) direttament fin-noti — it-tim jarahom fil-linja ta' żmien tal-prenotazzjoni.",
            },
            { type: "h2", text: "Wara l-ħolqien" },
            {
              type: "p",
              text: "Il-prenotazzjoni l-ġdida tidher minnufih fil-[Il-Linja ta' Żmien tal-Prenotazzjoni](/hilfe/reservierungen/buchungs-zeitleiste) bil-passi l-oħra kollha bħal messaġġi, kompiti u ħlasijiet f'post wieħed.",
            },
            {
              type: "ul",
              items: [
                "Il-kalendarju u l-portali jiġu sinkronizzati awtomatikament ladarba tissejvja.",
                "Il-mistieden jirċievi messaġġ ta' konferma awtomatiku jekk meħtieġ.",
                "Bidliet fid-dati tirreġistrahom permezz ta' “Ittrasferixxi Prenotazzjoni”.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Il-Linja ta' Żmien tal-Prenotazzjoni",
          excerpt:
            "Il-linja ta' żmien tal-prenotazzjoni tiġbor il-proċess sħiħ ta' riżervazzjoni f'post wieħed.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "X'turi l-linja ta' żmien" },
            {
              type: "p",
              text: "Kull riżervazzjoni għandha l-linja ta' żmien tagħha stess, li turi l-proċess sħiħ b'mod kronoloġiku — mit-talba għal prenotazzjoni jew l-importazzjoni mill-portal sal-check-out. B'hekk tara f'daqqa waħda x'diġà ġara u x'imiss.",
            },
            {
              type: "ul",
              items: [
                "Messaġġi mal-mistieden",
                "Kompiti, pereżempju tindif jew tħejjija",
                "Ħlasijiet u fatturi",
                "Add-ons u servizzi addizzjonali prenotati",
                "Trasferimenti (Move) u kanċellazzjonijiet",
              ],
            },
            { type: "h2", text: "Uża l-linja ta' żmien fil-ħajja ta' kuljum" },
            {
              type: "steps",
              items: [
                "Iftaħ Riżervazzjonijiet u agħżel il-prenotazzjoni mixtieqa.",
                "Aqleb għat-tab “Linja ta' Żmien”.",
                "Skrollja kronoloġikament fost l-avvenimenti kollha.",
                "Uża l-azzjonijiet mgħaġġla biex tibgħat messaġġ direttament jew toħloq kompitu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jekk prenotazzjoni tiġi ttrasferita jew ikkanċellata, dan il-pass jidher ukoll fil-linja ta' żmien — inklużi l-lejliet rilaxxati fil-kalendarju.",
            },
            { type: "h2", text: "Għaliex dan huwa importanti" },
            {
              type: "p",
              text: "Peress li t-tim, is-sid u s-support jaraw l-istess linja ta' żmien, ma jinħolqu ebda lakuni ta' informazzjoni bejn messaġġi, kompiti u ħlasijiet. Dettalji dwar ħlasijiet lura ssibhom taħt [Rifużjonijiet](/hilfe/zahlungen/rueckerstattungen), dwar servizzi addizzjonali taħt [Add-ons u Servizzi Addizzjonali](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Ittrasferixxi Prenotazzjoni",
          excerpt:
            "Hekk tittrasferixxi prenotazzjoni eżistenti għal perjodu ġdid, mingħajr ma tħawwad il-kalendarju.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Iċċekkja qabel tittrasferixxi" },
            {
              type: "p",
              text: "Qabel ma tittrasferixxi prenotazzjoni, iċċekkja d-disponibbiltà fil-perjodu l-ġdid għall-proprjetà prenotata. myNextDays tirrilaxxa l-lejliet oriġinarjament riżervati biss ladarba l-perjodu l-ġdid ikun ikkonfermat — b'hekk ma tinħoloq ebda lakuna li fiha l-proprjetà titqies b'mod żbaljat bħala ħielsa jew okkupata doppjament.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-prenotazzjoni f'Riżervazzjonijiet.",
                "Agħżel “Ittrasferixxi” u daħħal il-perjodu l-ġdid.",
                "Iċċekkja d-disponibbiltà murija għad-dati l-ġodda.",
                "Ikkonferma t-trasferiment.",
                "Iċċekkja jekk il-prezz jinbidilx minħabba n-numru ġdid ta' lejliet, u aġġustah jekk meħtieġ.",
              ],
            },
            { type: "h2", text: "X'jiġri awtomatikament" },
            {
              type: "p",
              text: "Wara l-konferma, il-lejliet il-qodma jiġu rilaxxati korrettament fil-kalendarju u l-lejliet il-ġodda jiġu mblukkati, u l-portali konnessi jiġu aġġornati. Il-proċess jiġi rreġistrat fil-linja ta' żmien tal-prenotazzjoni.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jekk il-prenotazzjoni waslet permezz ta' portal, trasferiment jista' jkun suġġett għal regoli tiegħu stess hemmhekk — iċċekkja l-linji gwida tal-portal qabel tagħmel bidliet kbar.",
            },
            { type: "h2", text: "Differenzi fil-ħlas" },
            {
              type: "p",
              text: "Jekk il-prezz jinbidel minħabba t-trasferiment, aġġusta r-regoli tal-ħlas kif xieraq — ara [Regoli tal-Ħlas](/hilfe/zahlungen/zahlungsregeln). Aktar dettalji dwar il-proċess sħiħ ta' prenotazzjoni ssibhom taħt [Il-Linja ta' Żmien tal-Prenotazzjoni](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Kanċellazzjoni u Rifużjoni",
          excerpt:
            "Hekk tikkanċella prenotazzjoni korrettament u tibda rifużjoni jekk meħtieġ.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Ikkanċella prenotazzjoni" },
            {
              type: "p",
              text: "Kanċellazzjoni tirrilaxxa minnufih il-proprjetà għall-perjodu prenotat — kemm fil-kalendarju tiegħek kif ukoll fuq il-portali konnessi kollha. Qabel il-kanċellazzjoni, iċċekkja liema kundizzjonijiet ta' kanċellazzjoni japplikaw għal din il-prenotazzjoni.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-prenotazzjoni f'Riżervazzjonijiet.",
                "Agħżel “Ikkanċella” u indika raġuni.",
                "Iċċekkja l-ammont ta' rifużjoni propost.",
                "Ikkonferma l-kanċellazzjoni.",
              ],
            },
            { type: "h2", text: "Ibda rifużjoni" },
            {
              type: "p",
              text: "Jekk il-ħlas ġie pproċessat permezz ta' fornitur tal-ħlas konness, tista' tibda r-rifużjoni direttament mill-prenotazzjoni. L-ammont jintwera fil-munita reġistrata għal din il-proprjetà. Dettalji dwar il-proċess ssibhom taħt [Rifużjonijiet](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Rifużjoni sħiħa jew parzjali possibbli",
                "Il-proċess jidher fil-linja ta' żmien tal-prenotazzjoni",
                "Għal prenotazzjonijiet minn portali, japplikaw ukoll ir-regoli tal-portal rispettiv",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kanċellazzjoni ma tistax titħassar. Iċċekkja bir-reqqa l-perjodu u l-mistieden qabel ma tikkonferma.",
            },
            { type: "h2", text: "Wara l-kanċellazzjoni" },
            {
              type: "p",
              text: "Il-proprjetà tkun disponibbli mill-ġdid għall-prenotazzjoni minnufih, u l-kompiti miftuħa relatati mal-prenotazzjoni — pereżempju t-tħejjija — jiġu mmarkati awtomatikament bħala li ma jibqgħux meħtieġa. Il-proċess sħiħ jibqa' traċċabbli fil-[Linja ta' Żmien tal-Prenotazzjoni](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in u Check-out",
          excerpt: "Hekk tiddokumenta l-wasla u t-tluq ta' mistieden f'myNextDays.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Irreġistra Check-in" },
            {
              type: "p",
              text: "Il-check-in jimmarka l-bidu tas-soġġorn u huwa utli speċjalment fil-każ ta' check-in awtonomu jew konsenja taċ-ċavetta mit-tim, biex l-istatus ta' kull prenotazzjoni jinżamm aġġornat.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-prenotazzjoni f'Riżervazzjonijiet.",
                "Agħżel “Check-in” fil-ġurnata tal-wasla.",
                "Żid nota jekk meħtieġ, pereżempju l-ħin jew karatteristiċi speċjali.",
              ],
            },
            { type: "h2", text: "Check-out u Konsenja" },
            {
              type: "p",
              text: "Mal-check-out timmarka s-soġġorn bħala komplut. F'ħafna każijiet dan jiskatta awtomatikament kompitu ta' tindif għall-proprjetà, sabiex tkun imħejjija għall-prenotazzjoni li jmiss.",
            },
            {
              type: "ul",
              items: [
                "Il-Check-in u l-Check-out huma parti mil-linja ta' żmien tal-prenotazzjoni",
                "Il-ħinijiet jistgħu jiġu definiti għal kull proprjetà fl-issettjar tal-proprjetà",
                "B'aċċess mobbli, it-tim jista' jirreġistra l-Check-in u l-Check-out direttament fuq il-post",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Check-out minsi ma jimblokkax awtomatikament il-kompiti sussegwenti — iċċekkja regolarment l-istati skaduti f'Riżervazzjonijiet.",
            },
            { type: "h2", text: "Rabta mal-kompiti" },
            {
              type: "p",
              text: "Il-Check-in u l-Check-out huma marbuta mill-qrib mal-kompiti u mal-linja ta' żmien. Aktar dettalji dwar il-proċess sħiħ aqrahom taħt [Il-Linja ta' Żmien tal-Prenotazzjoni](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-ons u Servizzi Addizzjonali",
          excerpt:
            "Hekk toffri lill-mistiedna servizzi addizzjonali li jistgħu jiġu prenotati bħal kolazzjon jew transfer, u tirreġistrahom fir-riżervazzjoni.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "X'inhuma l-Add-ons" },
            {
              type: "p",
              text: "L-Add-ons huma servizzi addizzjonali fakultattivi għal prenotazzjoni — bħal kolazzjon, wasla bikrija, transfer jew check-out tard. Jiġu rreġistrati għal kull proprjetà u jistgħu jiżdiedu mal-prenotazzjoni mill-mistieden stess jew mit-tim tiegħek.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà u oħloq is-servizzi addizzjonali mixtieqa bil-prezz taħt “Add-ons”.",
                "Iftaħ prenotazzjoni eżistenti f'Riżervazzjonijiet.",
                "Agħżel “Żid Add-on” u agħżel is-servizz mixtieq.",
                "Ikkonferma l-kwantità u l-ħin tas-servizz.",
              ],
            },
            { type: "h2", text: "Fatturazzjoni" },
            {
              type: "p",
              text: "L-Add-ons jiġu ffatturati fil-munita tal-proprjetà rispettiva u jidhru bħala entrata separata fuq il-fattura. Add-ons diġà mħallsa jistgħu jiġu rifużi proporzjonalment f'każ ta' kanċellazzjoni.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Irreġistra darba biss l-Add-ons popolari b'mod ċentrali fil-proprjetà — b'hekk jistgħu jiżdiedu ma' kull prenotazzjoni ġdida bi ftit klikkjar.",
            },
            { type: "h2", text: "Viżibbiltà għall-mistieden" },
            {
              type: "p",
              text: "Jekk il-pjattaforma jew il-websajt proprja jkunu attivi, il-mistiedna spiss ikunu jistgħu jagħżlu Add-ons xierqa diġà matul il-prenotazzjoni stess. Kull żieda tidher wara fil-[Linja ta' Żmien tal-Prenotazzjoni](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "L-Add-ons jistgħu jissemmew u jiġu ffissati bi prezz individwalment għal kull proprjetà",
                "Iż-żieda sussegwenti hija possibbli fi kwalunkwe ħin permezz tal-prenotazzjoni",
                "L-Add-ons ikkanċellati jiġu rifużi proporzjonalment",
              ],
            },
          ],
        },
      ],
    },
  ],
};
