import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portali u Maniġer tal-Kanali",
  description: "Ikkontrolla Booking, Airbnb, Expedia u oħrajn b'mod ċentrali.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Qabbad il-Portali",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "X'inhu l-Maniġer tal-Kanali?",
          excerpt:
            "Il-maniġer tal-kanali jsinkronizza awtomatikament il-prezzijiet, id-disponibbiltà u l-prenotazzjonijiet bejn myNextDays u l-portali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Konnessjoni waħda għall-portali kollha" },
            {
              type: "p",
              text: "Il-maniġer tal-kanali huwa l-pont bejn myNextDays u l-portali kbar ta' prenotazzjoni bħal Booking, Airbnb u oħrajn. Minflok iżżomm il-prezzijiet, id-disponibbiltà u l-okkupazzjoni separatament f'kull portal, iddaħħal kollox darba f'myNextDays — il-maniġer tal-kanali jqassmu awtomatikament lill-portali konnessi kollha.",
            },
            { type: "h2", text: "X'jiġi sinkronizzat awtomatikament" },
            {
              type: "ul",
              items: [
                "Disponibbiltà — kull riżervazzjoni timblokka l-lejl minnufih fuq il-portali kollha",
                "Prezzijiet u soġġorni minimi mill-kalendarju tal-prezzijiet tiegħek",
                "Prenotazzjonijiet minn portali li jaslu jiġu importati awtomatikament f'myNextDays",
                "Il-kanċellazzjonijiet u Stop-Sell jaffettwaw il-kanali kollha",
              ],
            },
            { type: "h2", text: "X'ma jkollokx aktar tagħmel manwalment" },
            {
              type: "p",
              text: "Mingħajr maniġer tal-kanali, ikollok timblokka manwalment il-lejl f'kull portal wara kull prenotazzjoni — raġuni komuni għal prenotazzjonijiet doppji. B'maniġer tal-kanali attiv, myNextDays tieħu ħsieb din is-sinkronizzazzjoni fiż-żewġ direzzjonijiet, diversi drabi kuljum u f'ħin reali għal prenotazzjonijiet ġodda.",
            },
            {
              type: "note",
              variant: "info",
              text: "Il-konnessjoni tal-portal tiġi kkonfigurata darba biss għall-kont kollu. Wara dan, għal kull proprjetà individwali tattiva biss il-mapping — aktar dettalji taħt [Assenja Proprjetà lil Portal](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Ikkonfigura l-Konnessjoni tal-Portal",
          excerpt:
            "Il-konnessjoni mal-portali tikkonfigurha darba għall-kont kollu — mhux mill-ġdid għal kull proprjetà.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Darba biss għall-kont kollu" },
            {
              type: "p",
              text: "Il-konnessjoni mal-portali hija issettjar li japplika għall-kont kollu: tqabbad il-kont tiegħek ta' myNextDays mal-maniġer tal-kanali darba biss. Il-proprjetajiet kollha li toħloq aktar tard jużaw awtomatikament din il-konnessjoni waħda — m'għandekx bżonn terġa' tibniha għal kull proprjetà.",
            },
            { type: "h2", text: "Kif tikkonfigura l-konnessjoni" },
            {
              type: "steps",
              items: [
                "Iftaħ /konto u agħżel it-taqsima “Portali u Maniġer tal-Kanali”",
                "Ikklikkja “Ikkonfigura Konnessjoni” u ikkonferma d-dettalji tan-negozju tiegħek (indirizz, kuntatt, forma legali)",
                "Iċċekkja d-dejta bażika miġbura awtomatikament — tiġi trasferita lill-portali kollha",
                "Ikkompleta l-konfigurazzjoni; l-istatus jinbidel għal “Konness”",
              ],
            },
            { type: "h2", text: "Il-pass li jmiss: assenja l-proprjetajiet" },
            {
              type: "p",
              text: "Wara l-konfigurazzjoni unika, l-ebda proprjetà ma tkun għadha viżibbli — għal dan tassenja kull proprjetà individwalment lil portal (mapping) u tqabbad il-portali mixtieqa bħal Booking.com jew Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Mingħajr dejta bażika kompluta (indirizz, informazzjoni tat-taxxa, kuntatt), il-portali jirrifjutaw il-konnessjoni. Iċċekkja l-ewwel dawn id-dettalji taħt /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Assenja Proprjetà lil Portal",
          excerpt:
            "Wara l-konnessjoni li tapplika għall-kont kollu, tattiva biss il-mapping lejn il-portal rispettiv għal kull proprjetà.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Mapping minflok konnessjoni ġdida" },
            {
              type: "p",
              text: "Ladarba l-konnessjoni tal-portal tkun ikkonfigurata għall-kont kollu, tqabbad kull proprjetà biss permezz ta' dak li jissejjaħ mapping: tiddefinixxi liema proprjetà ta' myNextDays tikkorrispondi għal liema kamra jew tip ta' offerta fil-portal. Dan huwa pass uniku għal kull proprjetà.",
            },
            { type: "h2", text: "Kif tassenja proprjetà" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt /objekte u aqleb għat-tab “Portali”",
                "Agħżel il-portal mixtieq, pereżempju Booking.com jew Airbnb",
                "Assenja l-proprjetà lit-tip ta' kamra jew offerta xieraq fil-portal",
                "Attiva s-sinkronizzazzjoni — il-prezzijiet u d-disponibbiltà jiġu trasferiti minn issa 'l quddiem",
              ],
            },
            { type: "h2", text: "Proprjetà waħda, diversi portali" },
            {
              type: "p",
              text: "Proprjetà individwali tista' tkun assenjata lil diversi portali fl-istess ħin. Kull assenjazzjoni hija indipendenti — tista', pereżempju, tagħmel proprjetà viżibbli fuq Booking.com u Airbnb, imma żżommha diżattivata fuq Expedia għalissa.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Wara l-mapping, iċċekkja direttament il-viżibbiltà — ara [Viżibbiltà għal Kull Portal](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Qabbad Booking.com",
          excerpt: "Hekk tattiva Booking.com bħala kanal ta' distribuzzjoni għal proprjetà.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Rekwiżit: konnessjoni għall-kont kollu" },
            {
              type: "p",
              text: "Qabel ma tattiva Booking.com għal proprjetà, il-konnessjoni tal-portal li tapplika għall-kont kollu trid tkun ikkonfigurata (ara [Ikkonfigura l-Konnessjoni tal-Portal](/hilfe/portale-kanalmanager/portal-verbindung)). Wara dan, Booking.com għal kull proprjetà oħra tkun biss kwistjoni ta' mapping.",
            },
            { type: "h2", text: "Attiva Booking.com" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt /objekte, tab “Portali”",
                "Agħżel “Booking.com” mil-lista tal-portali disponibbli",
                "Assenja t-tip ta' kamra jew offerta xieraq u kkonferma l-pjani tar-rata",
                "Attiva l-viżibbiltà — il-proprjetà ssir attiva wara l-verifika minn Booking.com",
              ],
            },
            { type: "h2", text: "X'jistenna Booking.com mingħandek" },
            {
              type: "ul",
              items: [
                "Deskrizzjoni sħiħa tal-proprjetà, ritratti u faċilitajiet",
                "Mill-inqas rata waħda bi prezz u kundizzjonijiet ta' kanċellazzjoni",
                "Metodu ta' ħlas validu għall-kummissjonijiet",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L-attivazzjoni minn Booking.com tista' tieħu ftit sigħat. L-istatus fit-tab “Portali” tal-proprjetà juri jekk il-konnessjoni tkunx diġà attiva.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Qabbad Airbnb",
          excerpt: "Hekk tagħmel proprjetà disponibbli għall-prenotazzjoni fuq Airbnb permezz tal-maniġer tal-kanali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Airbnb bħala portal ieħor" },
            {
              type: "p",
              text: "Airbnb tiġi kkonnettjata bħal kull portal ieħor permezz tal-konnessjoni li tapplika għall-kont kollu. Ladarba tkun ikkonfigurata, tattiva Airbnb għal kull proprjetà permezz tal-mapping — indipendentement minn jekk il-proprjetà tkunx diġà viżibbli fuq Booking.com jew portali oħra.",
            },
            { type: "h2", text: "Attiva Airbnb għal proprjetà" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt /objekte, tab “Portali”",
                "Agħżel “Airbnb” mil-lista tal-portali disponibbli",
                "Ikkonferma l-kategorija tal-proprjetà u t-tip ta' offerta assenjat",
                "Iċċekkja r-ritratti, il-faċilitajiet u r-regoli tad-dar — Airbnb titlob dettalji kompluti qabel l-attivazzjoni",
                "Attiva l-viżibbiltà għal Airbnb",
              ],
            },
            { type: "h2", text: "Wara l-attivazzjoni" },
            {
              type: "p",
              text: "Ladarba Airbnb tirrilaxxa l-proprjetà, il-prezzijiet u d-disponibbiltà jgħaddu awtomatikament permezz tal-maniġer tal-kanali. Il-prenotazzjonijiet li jaslu fuq Airbnb jidhru wara awtomatikament fil-kalendarju tar-riżervazzjonijiet tiegħek.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Mingħajr kundizzjonijiet ta' kanċellazzjoni u regoli tad-dar irreġistrati, Airbnb tirrifjuta l-attivazzjoni. Żid l-ewwel dawn id-dettalji fil-proprjetà.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Sinkronizza Prezzijiet u Disponibbiltà",
          excerpt: "Il-prezzijiet u d-disponibbiltà jiġu trasferiti awtomatikament lill-portali konnessi kollha.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Kalendarju wieħed, il-portali kollha" },
            {
              type: "p",
              text: "Iżżomm il-prezzijiet u d-disponibbiltà esklussivament fil-kalendarju ta' myNextDays tal-proprjetà rispettiva. Il-maniġer tal-kanali jittrasferixxi awtomatikament kull bidla lill-portali kollha li għalihom il-proprjetà tkun immappjata b'mod attiv — mingħajr ma jkollok bżonn iddaħħal xi ħaġa darbtejn.",
            },
            { type: "h2", text: "X'jiġi trasferit" },
            {
              type: "ul",
              items: [
                "Prezzijiet ta' kuljum mill-kalendarju tal-prezzijiet jew mill-pjani tar-rata tiegħek",
                "Lejliet disponibbli u mblukkar",
                "Soġġorn minimu u restrizzjonijiet tal-wasla/tluq",
                "Ġranet ta' Stop-Sell — dawn jimblukkaw awtomatikament fuq il-portali kollha",
              ],
            },
            { type: "h2", text: "Kemm tieħu ħin biex tapplika s-sinkronizzazzjoni" },
            {
              type: "p",
              text: "Il-bidliet fil-prezzijiet u fid-disponibbiltà jiġu trasferiti lill-portali fi ftit minuti. Ir-riżervazzjonijiet ġodda jimblukkaw il-lejliet affettwati minnufih, sabiex l-istess lejl ma jkunx jista' jinbiegħ mill-ġdid fuq ebda kanal ieħor.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Aktar dettalji dwar l-imblukkar ta' ġranet individwali fuq il-kanali kollha ssibhom taħt [Evita Prenotazzjonijiet Żejda](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Irċievi Prenotazzjonijiet mill-Portali",
          excerpt: "Il-prenotazzjonijiet minn Booking, Airbnb u oħrajn jaslu awtomatikament fil-kalendarju tiegħek.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Importazzjoni awtomatika" },
            {
              type: "p",
              text: "Jekk mistieden jipprenota permezz ta' portal bħal Booking.com jew Airbnb, il-maniġer tal-kanali jimporta r-riżervazzjoni awtomatikament f'myNextDays. M'għandekx bżonn tittrasferixxi xejn manwalment — il-prenotazzjoni tidher fil-kalendarju u fil-lista tar-riżervazzjonijiet tal-proprjetà affettwata.",
            },
            { type: "h2", text: "X'jiġri b'prenotazzjoni minn portal" },
            {
              type: "steps",
              items: [
                "Il-portal jirrapporta l-prenotazzjoni ġdida lill-maniġer tal-kanali",
                "myNextDays toħloq ir-riżervazzjoni bid-dettalji tal-mistieden, il-perjodu u l-prezz",
                "Il-lejliet prenotati jiġu mblukkati minnufih fuq il-kanali l-oħra kollha",
                "Tirċievi notifika u ssib il-prenotazzjoni fil-kalendarju",
              ],
            },
            { type: "h2", text: "Kanċellazzjonijiet u bidliet" },
            {
              type: "p",
              text: "Jekk mistieden jikkanċella permezz tal-portal jew jibdel il-perjodu, dan ukoll jiġi trasferit awtomatikament lejn myNextDays u l-lejliet affettwati jiġu rilaxxati mill-ġdid.",
            },
            {
              type: "note",
              variant: "info",
              text: "Il-prenotazzjonijiet minn portali jistgħu jiġu rikonoxxuti fid-dettalji tar-riżervazzjoni permezz tal-badge tas-sors tagħhom, pereżempju Booking.com jew Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Evita Prenotazzjonijiet Żejda",
          excerpt: "Stop-Sell u l-imblukkar awtomatiku jipprevjenu prenotazzjonijiet doppji fuq diversi portali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Għaliex jinħolqu prenotazzjonijiet żejda" },
            {
              type: "p",
              text: "Mingħajr kontroll ċentrali, faċilment jiġri li l-istess lejl jinbiegħ fuq żewġ portali fl-istess ħin — pereżempju meta l-prezzijiet u d-disponibbiltà jinżammu manwalment f'diversi sistemi. Il-maniġer tal-kanali jagħlaq din il-lakuna billi kull prenotazzjoni fuq kull kanal timblokka minnufih il-kanali l-oħra kollha.",
            },
            { type: "h2", text: "L-għodod tiegħek kontra prenotazzjonijiet żejda" },
            {
              type: "ul",
              items: [
                "Imblukkar awtomatiku: kull riżervazzjoni ġdida — ikun xi jkun il-kanal — timblokka l-lejliet kullimkien",
                "Stop-Sell: timblokka manwalment ġurnata fuq il-kanali kollha fl-istess ħin, pereżempju għal użu personali jew manutenzjoni",
                "Is-soġġorn minimu u r-restrizzjonijiet tal-wasla jipprevjenu prenotazzjonijiet qosra mhux xierqa",
              ],
            },
            { type: "h2", text: "Issettja Stop-Sell" },
            {
              type: "steps",
              items: [
                "Iftaħ il-kalendarju tal-okkupazzjoni tal-proprjetà",
                "Immarka l-ġurnata jew il-perjodu affettwat",
                "Agħżel “Stop-Sell” — il-ġurnata tibqa' mblukkata wara fuq il-portali kollha kif ukoll fuq il-websajt u l-pjattaforma",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell tapplika mingħajr eċċezzjoni għall-kanali kollha. Ma teżisti ebda possibbiltà li timblokka ġurnata biss għal portal wieħed u żżomma miftuħa għal oħrajn.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Viżibbiltà għal Kull Portal",
          excerpt: "Kull portal jista' jiġi attivat jew diżattivat indipendentement mill-websajt u s-Suq tal-Pjattaforma.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Tliet mogħdijiet ta' distribuzzjoni indipendenti" },
            {
              type: "p",
              text: "Proprjetà tista' tinbiegħ permezz ta' diversi mogħdijiet fl-istess ħin: permezz tal-portali (Booking, Airbnb u oħrajn), permezz tas-Suq tal-Pjattaforma ta' myBestDays u permezz tal-websajt proprja tiegħek. Kull mogħdija għandha s-swiċċ tal-viżibbiltà tagħha stess — huma kompletament indipendenti minn xulxin.",
            },
            { type: "h2", text: "Ikkontrolla l-viżibbiltà għal kull portal" },
            {
              type: "p",
              text: "Fi ħdan il-portali, kull portal individwali jista' wkoll jiġi attivat jew diżattivat separatament. Proprjetà tista', pereżempju, tkun attiva fuq Booking.com imma diżattivata fuq Airbnb — iż-żewġ assenjazzjonijiet jibqgħu jeżistu mingħajr ma jiġu affettwati.",
            },
            { type: "h2", text: "Kif tibdel il-viżibbiltà" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt /objekte, tab “Portali”",
                "Attiva jew diżattiva individwalment il-kanal mixtieq (portal individwali, websajt jew Suq tal-Pjattaforma)",
                "Issejvja — il-bidla tapplika fi ftit minuti",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L-istatus tal-proprjetà (attiva/mhux attiva) kif ukoll Stop-Sell jaffettwaw il-kanali kollha fuq livell superjuri. L-iswiċċijiet tal-viżibbiltà jikkontrollaw biss fuq liema kanali addizzjonali tidher proprjetà diġà attiva.",
            },
          ],
        },
      ],
    },
  ],
};
