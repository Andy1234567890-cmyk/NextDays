import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Maniġer tal-Kanali",
  description: "Ipprattika l-portali u l-maniġer tal-kanali.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Maniġer tal-Kanali",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Qabbad l-Ewwel Portal Tiegħek",
          excerpt: "Hekk tattiva portal għal proprjetà għall-ewwel darba.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: ħloqt proprjetà, imma għad m'għandekx portal konness",
            },
            {
              type: "p",
              text: "Il-proprjetà tiegħek hija kkonfigurata kompletament f'myNextDays, imma għadha mhix viżibbli fuq ebda portal bħal Booking.com jew Airbnb. Qabel ma portal jaċċetta proprjetà, il-kont tiegħek jeħtieġ darba biss konnessjoni ta' portal li tapplika għall-kont kollu — wara dan, biżżejjed mapping għal kull proprjetà oħra.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ /konto, taqsima “Portali u Maniġer tal-Kanali”, u kkonfigura l-konnessjoni għall-kont kollu bid-dettalji tan-negozju tiegħek",
                "Wara dan, iftaħ il-proprjetà taħt /objekte u aqleb għat-tab “Portali”",
                "Agħżel il-portal mixtieq u assenjah lit-tip ta' kamra jew offerta xieraq",
                "Iċċekkja r-ritratti, il-faċilitajiet, il-prezzijiet u l-kundizzjonijiet ta' kanċellazzjoni — il-portali jitolbu dettalji kompluti",
                "Attiva l-viżibbiltà; l-istatus jinbidel għal “Konness” wara l-verifika mill-portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il-konnessjoni għall-kont kollu tikkonfigurha darba biss. Dettalji dwar dan taħt [Qabbad Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) u [Qabbad Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Qabbad Booking.com",
          excerpt: "Hekk tagħmel proprjetà disponibbli għall-prenotazzjoni fuq Booking.com permezz tal-maniġer tal-kanali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: il-proprjetà tiegħek għandha tkun viżibbli wkoll fuq Booking.com",
            },
            {
              type: "p",
              text: "Booking.com huwa wieħed mill-portali li jitqabbdu permezz tal-maniġer tal-kanali. Ir-rekwiżit huwa l-konnessjoni tal-portal li tapplika għall-kont kollu — jekk din tkun diġà kkonfigurata, għal Booking.com teħtieġ biss mapping għal kull proprjetà.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt /objekte, tab “Portali”",
                "Agħżel “Booking.com” mil-lista tal-portali disponibbli",
                "Assenja t-tip ta' kamra jew offerta xieraq u kkonferma mill-inqas rata waħda bi prezz u kundizzjonijiet ta' kanċellazzjoni",
                "Daħħal metodu ta' ħlas validu għall-fatturazzjoni tal-kummissjoni",
                "Attiva l-viżibbiltà għal Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L-attivazzjoni minn Booking.com tista' tieħu ftit sigħat. L-istatus fit-tab “Portali” juri meta l-konnessjoni tkun attiva.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Qabbad Airbnb",
          excerpt: "Hekk tagħmel proprjetà disponibbli għall-prenotazzjoni fuq Airbnb permezz tal-maniġer tal-kanali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: il-proprjetà tiegħek għandha tkun viżibbli wkoll fuq Airbnb",
            },
            {
              type: "p",
              text: "Airbnb tiġi kkonnettjata bħal kull portal ieħor permezz tal-konnessjoni li tapplika għall-kont kollu. Jekk din tkun ikkonfigurata, tattiva Airbnb għal kull proprjetà permezz ta' mapping — indipendentement minn jekk il-proprjetà tkunx diġà viżibbli fuq Booking.com jew portali oħra.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt /objekte, tab “Portali”",
                "Agħżel “Airbnb” mil-lista tal-portali disponibbli",
                "Ikkonferma l-kategorija tal-proprjetà u t-tip ta' offerta assenjat",
                "Żid ir-ritratti, il-faċilitajiet u r-regoli tad-dar — Airbnb titlob dettalji kompluti qabel l-attivazzjoni",
                "Attiva l-viżibbiltà għal Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Mingħajr kundizzjonijiet ta' kanċellazzjoni u regoli tad-dar irreġistrati, Airbnb tirrifjuta l-attivazzjoni. Żid l-ewwel dawn id-dettalji fil-proprjetà.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Żomm il-Prezzijiet Sinkronizzati fuq il-Portali Kollha",
          excerpt: "Kalendarju wieħed biżżejjed — il-maniġer tal-kanali jqassam awtomatikament il-bidliet fil-prezz lill-portali kollha.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: tbiddel prezz u tixtieq tiżgura li jkun korrett kullimkien",
            },
            {
              type: "p",
              text: "Iżżomm il-prezzijiet esklussivament fil-kalendarju ta' myNextDays tal-proprjetà — qatt individwalment fil-portali stess. Il-maniġer tal-kanali jittrasferixxi awtomatikament kull bidla lill-portali kollha li għalihom il-proprjetà tkun immappjata b'mod attiv.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-kalendarju tal-prezzijiet jew il-pjani tar-rata tal-proprjetà",
                "Aġġusta l-prezz ta' kuljum, is-soġġorn minimu jew ir-restrizzjoni tal-wasla/tluq",
                "Issejvja l-bidla — tapplika l-ewwel internament fil-proprjetà",
                "Iċċekkja fit-tab “Portali” li l-portali kollha mixtieqa jibqgħu mmappjati b'mod attiv",
                "Stenna ftit minuti sakemm il-bidla tiġi trasferita lill-portali",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Qatt iddaħħal il-prezzijiet direttament fil-portal — bidliet bħal dawn jiġu sostitwiti mill-kalendarju ta' myNextDays fis-sinkronizzazzjoni li jmiss.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Importa Prenotazzjoni minn Portal",
          excerpt: "Il-prenotazzjonijiet minn portali jaslu awtomatikament fil-kalendarju — hawnhekk tiċċekkja li l-importazzjoni rnexxiet.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: mistieden ipprenota permezz ta' portal, il-prenotazzjoni għandha tasal f'myNextDays",
            },
            {
              type: "p",
              text: "Jekk mistieden jipprenota permezz ta' Booking.com, Airbnb jew portal konness ieħor, il-maniġer tal-kanali jimporta r-riżervazzjoni awtomatikament — m'għandekx bżonn tittrasferixxi xejn manwalment. Dan il-proċess jiddeskrivi kif issegwi u tikkonferma l-importazzjoni.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-kalendarju jew il-lista tar-riżervazzjonijiet tal-proprjetà affettwata",
                "Fittex ir-riżervazzjoni l-ġdida — għandha badge tas-sors tal-portal, pereżempju Booking.com jew Airbnb",
                "Iċċekkja d-dettalji tal-mistieden, il-perjodu u l-prezz għall-kompletezza",
                "Iċċekkja li l-lejliet prenotati jintwerew imblukkati fuq il-kanali l-oħra kollha",
                "Iftaħ id-dettalji tal-prenotazzjoni jekk meħtieġ biex tipproċessa servizzi addizzjonali jew messaġġi tal-mistieden",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jekk il-mistieden jikkanċella permezz tal-portal jew jibdel il-perjodu, dan ukoll jiġi trasferit awtomatikament lejn myNextDays u l-lejliet jiġu rilaxxati mill-ġdid.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Solvi Prenotazzjoni Doppja",
          excerpt: "Hekk timxi meta l-istess lejl ikun inbiegħ eċċezzjonalment fuq żewġ kanali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: żewġ riżervazzjonijiet jikkoinċidu għall-istess proprjetà u l-istess lejliet",
            },
            {
              type: "p",
              text: "Il-maniġer tal-kanali normalment jimblokka l-lejliet prenotati minnufih madwar il-kanali kollha. Xorta jista' jinħoloq prenotazzjoni doppja, pereżempju f'prenotazzjonijiet simultanji fuq żewġ portali fl-istess mument, jew b'riżervazzjoni maħluqa manwalment li tikkollidi ma' prenotazzjoni minn portal.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-kalendarju tal-proprjetà u identifika ż-żewġ riżervazzjonijiet li jikkoinċidu",
                "Iċċekkja l-ħin tal-prenotazzjoni u l-badge tas-sors taż-żewġ riżervazzjonijiet",
                "Ikkuntattja lill-aħħar mistieden li waslet u offri proprjetà alternattiva jew perjodu alternattiv",
                "Ikkanċella r-riżervazzjoni li ma tistax tinżamm fil-portal rispettiv, mhux biss f'myNextDays",
                "Wara dan, issettja Stop-Sell għal-lejliet affettwati sakemm il-każ ikun solvut kompletament",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ikkanċella dejjem prenotazzjoni minn portal permezz tal-portal stess — kanċellazzjoni biss f'myNextDays tirrilaxxa l-lejl internament, imma ma tinforma bl-ebda mod affidabbli lill-portal.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Waqqaf Portal Temporanjament",
          excerpt: "Iddiżattiva l-viżibbiltà għal kull portal individwalment, mingħajr ma titlef il-mapping.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: proprjetà m'għandhiex tkun disponibbli għall-prenotazzjoni temporanjament fuq portal",
            },
            {
              type: "p",
              text: "Il-viżibbiltà tista' tiġi attivata jew diżattivata individwalment għal kull portal — indipendentement mill-websajt u s-Suq tal-Pjattaforma. Jekk pereżempju tixtieq twaqqaf Airbnb għal żmien qasir, imma tħalli Booking.com jibqa' għaddej, iddiżattiva esklussivament dan il-kanal wieħed.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt /objekte, tab “Portali”",
                "Fittex l-entrata tal-portal li tixtieq twaqqaf",
                "Iddiżattiva l-viżibbiltà għal dan il-portal",
                "Issejvja — il-bidla tapplika fi ftit minuti, il-proprjetà tisparixxi mir-riżultati tat-tfittxija ta' dan il-portal",
                "Erġa' attiva l-viżibbiltà ladarba l-proprjetà għandha terġa' tkun disponibbli għall-prenotazzjoni",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il-mapping jibqa' preservat waqt il-waqfien — m'għandekx bżonn terġa' tikkonfigura l-assenjazzjoni mal-portal aktar tard. Għal imblukkar komplut tal-kanali kollha, uża Stop-Sell minflok.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Iċċekkja l-Mapping tal-Proprjetà",
          excerpt: "Hekk tikkontrolla jekk il-proprjetà tiegħek għadhiex assenjata korrettament lit-tip ta' offerta t-tajjeb fil-portal.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: il-prezzijiet jew id-disponibbiltà fuq portal ma jibqgħux jaqblu ma' myNextDays",
            },
            {
              type: "p",
              text: "Jekk il-wiri fil-portal ivarja mill-kalendarju tiegħek ta' myNextDays, il-kawża spiss tkun mapping żbaljat jew interrott — il-konnessjoni bejn il-proprjetà tiegħek u t-tip ta' kamra jew offerta fil-portal.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt /objekte, tab “Portali”",
                "Iċċekkja l-istatus tal-portal affettwat — għandu juri “Konness”, mhux “Żball” jew “Pendenti”",
                "Iċċekkja jekk it-tip ta' kamra jew offerta assenjat fil-portal għadux jikkorrispondi għall-proprjetà attwali",
                "F'każ ta' diskrepanza: aqta' l-mapping u erġa' assenjah, imbagħad erġa' attiva l-viżibbiltà",
                "Wara l-korrezzjoni, stenna ftit minuti u erġa' iċċekkja l-prezzijiet u d-disponibbiltà fil-portal",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Proprjetà tista' tkun assenjata lil diversi portali fl-istess ħin — f'każ ta' diskrepanzi, iċċekkja b'mod immirat il-portal affettwat wieħed, mhux kollha f'daqqa.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Rati Differenti għal Kull Portal",
          excerpt: "Kif tassenja lil portal pjan tar-rata tiegħu stess, mingħajr ma taffettwa l-kanali l-oħra.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: tixtieq toffri prezz differenti fuq portal minn dak fuq il-kanali l-oħra",
            },
            {
              type: "p",
              text: "Il-pjani tar-rata jistgħu jiġu assenjati individwalment għal kull portal, pereżempju pjan tar-rata mhux kanċellabbli għal portal wieħed u wieħed flessibbli għal ieħor. Il-prezzijiet bażiċi jibqgħu mmaniġġjati ċentralment fil-proprjetà, il-mapping jiddetermina liema pjan tar-rata jmur għal liema portal.",
            },
            {
              type: "steps",
              items: [
                "Oħloq fil-proprjetà l-pjan tar-rata addizzjonali bil-kundizzjonijiet mixtieqa (prezz, kundizzjonijiet ta' kanċellazzjoni, soġġorn minimu)",
                "Iftaħ it-tab “Portali” u agħżel il-portal affettwat",
                "Assenja fil-mapping il-pjan tar-rata l-ġdid lil dan il-portal",
                "Ħalli l-portali l-oħra mhux mibdula fuq il-pjan tar-rata preċedenti tagħhom",
                "Issejvja u wara ftit minuti iċċekkja l-wiri tal-prezz fil-portal rispettiv",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kull pjan tar-rata jiġi trasferit b'mod indipendenti — bidla f'pjan tar-rata ma taffettwax il-portali assenjati lil pjan tar-rata ieħor.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Solvi Żbalji Komuni tal-Portali",
          excerpt: "Kawżi tipiċi meta portal jirrifjuta proprjetà jew is-sinkronizzazzjoni ma tavvanzax.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu: l-istatus ta' portal juri żball jew il-proprjetà ma tiġix aċċettata",
            },
            {
              type: "p",
              text: "Il-portali normalment jirrifjutaw konnessjoni minħabba dejta bażika nieqsa jew dettalji tal-proprjetà mhux kompluti. Għaddi mill-kawżi l-aktar komuni waħda waħda qabel tikkuntattja s-support.",
            },
            {
              type: "steps",
              items: [
                "Iċċekkja taħt /konto jekk l-indirizz, l-informazzjoni tat-taxxa u d-dettalji ta' kuntatt humiex reġistrati kompletament",
                "Iċċekkja fil-proprjetà jekk id-deskrizzjoni, ir-ritratti, il-faċilitajiet u mill-inqas rata waħda humiex kompluti",
                "Iċċekkja jekk hemmx metodu ta' ħlas validu rreġistrat għall-kummissjonijiet",
                "Iftaħ it-tab “Portali” u aqra l-messaġġ ta' żball eżatt ħdejn il-portal affettwat",
                "Solvi l-lakuna msemmija u erġa' attiva l-viżibbiltà",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Żball ta' portal dejjem jaffettwa biss dak il-portal wieħed — il-kanali l-oħra jibqgħu jaħdmu indipendentement, sakemm ir-rekwiżiti tagħhom stess ikunu sodisfatti.",
            },
          ],
        },
      ],
    },
  ],
};
