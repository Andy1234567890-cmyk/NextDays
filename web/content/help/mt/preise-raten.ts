import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Prezzijiet u Rati",
  description: "Pjani tar-rata, prezzijiet staġonali u prezzijiet dinamiċi.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Determinazzjoni tal-Prezzijiet",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Prezz Bażiku u Munita",
          excerpt: "Hekk tistabbilixxi l-prezz bażiku u tassenja l-munita korretta lill-proprjetà tiegħek.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Kull proprjetà f'myNextDays hija eżattament unità waħda li tista' tiġi prenotata — kamra waħda jew proprjetà tal-vaganzi. Għal din l-unità, tirreġistra prezz bażiku u munita ċentrali li tapplika għall-proprjetà kollha.",
            },
            { type: "h2", text: "Iddefinixxi l-munita ċentralment" },
            {
              type: "p",
              text: "Il-munita tal-proprjetà tiġi ssettjata darba għal kull proprjetà u tapplika awtomatikament għall-pjani tar-rata kollha li toħloq għal din il-proprjetà. Ma teżisti ebda munita default separata — jekk il-munita tkun nieqsa, ma tistax issejvja prezzijiet.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà tiegħek taħt “Proprjetajiet”.",
                "Aqleb għat-tab “Prezzijiet”.",
                "Agħżel il-munita xierqa taħt “Munita tal-Proprjetà”.",
                "Daħħal il-prezz bażiku għall-okkupazzjoni standard.",
                "Issejvja l-bidliet.",
              ],
            },
            { type: "h2", text: "X'jiġri meta tinbidel il-munita" },
            {
              type: "p",
              text: "Jekk tibdel il-munita tal-proprjetà aktar tard, dan jaffettwa l-pjani tar-rata eżistenti kollha ta' din il-proprjetà, peress li dawn dejjem jinżammu fil-munita tal-proprjetà. Wara dan, iċċekkja l-prezzijiet tiegħek qabel ma terġa' tittrasferihom lill-portali.",
            },
            {
              type: "ul",
              items: [
                "Proprjetà għandha eżattament munita waħda — mhux diversi għal kull pjan tar-rata.",
                "Il-prezz bażiku huwa l-valur ta' tluq għar-rati derivati.",
                "L-ammonti jintwerew dejjem bil-munita tal-proprjetà reġistrata.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Mingħajr munita reġistrata ma jista' jiġi ssejvjat ebda prezz u ebda rata ma tista' tiġi trasferita lill-portali. Iċċekkja dan l-ewwel jekk bidla fil-prezz tfalli.",
            },
            {
              type: "note",
              variant: "info",
              text: "Aktar dettalji dwar prezzijiet derivati ssibhom taħt [Rati Derivati](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Oħloq Pjani tar-Rata",
          excerpt: "Il-pjani tar-rata jgħaqqdu l-prezz, il-kundizzjonijiet ta' kanċellazzjoni u l-ikel għal proprjetà.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Pjan tar-rata jiddefinixxi taħt liema kundizzjonijiet tista' tiġi prenotata proprjetà: prezz, regoli ta' kanċellazzjoni, ikel u soġġorn minimu. Proprjetà tista' toffri diversi pjani tar-rata fl-istess ħin, pereżempju pjan flessibbli u pjan mhux kanċellabbli.",
            },
            { type: "h2", text: "Oħloq Pjan tar-Rata ġdid" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà u aqleb għat-tab “Prezzijiet”.",
                "Ikklikkja “Oħloq Pjan tar-Rata Ġdid”.",
                "Agħti isem deskrittiv, eż. “Flessibbli” jew “Mhux kanċellabbli”.",
                "Iddeċiedi jekk il-pjan huwiex rata bażika jew rata derivata.",
                "Daħħal il-kundizzjonijiet ta' kanċellazzjoni u l-ikel.",
                "Issejvja u attiva l-pjan tar-rata.",
              ],
            },
            { type: "h2", text: "Rata bażika vs. pjani tar-rata oħra" },
            {
              type: "p",
              text: "L-ewwel oħloq ir-rata bażika tiegħek (spiss imsejħa “BAR”, Best Available Rate). Il-pjani tar-rata l-oħra kollha jistgħu jew jinżammu b'mod indipendenti jew jiġu derivati minn din ir-rata bażika.",
            },
            {
              type: "ul",
              items: [
                "Rata bażika: prezz bażiku miżmum manwalment għal kull lejl.",
                "Pjani tar-rata oħra: indipendenti jew bħala żieda/tnaqqis fuq ir-rata bażika.",
                "Kull pjan tar-rata jista' jiġi trasferit individwalment lill-portali.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Żomm in-numru ta' pjani tar-rata għal kull proprjetà ġestibbli — varjanti żejda jagħmluha diffiċli għall-mistiedna li jqabblu u jżidu x-xogħol ta' manutenzjoni.",
            },
            {
              type: "note",
              variant: "info",
              text: "Dettalji dwar iż-żidiet u t-tnaqqis issibhom taħt [Rati Derivati](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Rati Derivati",
          excerpt: "Il-pjani tar-rata derivati jiġu kkalkulati awtomatikament minn rata bażika.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Rata derivata hija pjan tar-rata li l-prezz tiegħu ma jinżammx manwalment, imma jiġi kkalkulat awtomatikament minn rata bażika — bħala żieda fissa, tnaqqis jew perċentwal. Dan ifaddal xogħol ta' manutenzjoni, peress li bidla fil-prezz fir-rata bażika taġġorna awtomatikament il-pjani derivati kollha.",
            },
            { type: "h2", text: "Eżempju tipiku" },
            {
              type: "p",
              text: "Mudell komuni huwa pjan bil-kolazzjon derivat mir-rata bażika mingħajr ikel: il-prezz tal-kolazzjon jiġi definit bħala żieda għal kull lejl u persuna fuq ir-rata bażika. Jekk tibdel ir-rata bażika, il-prezz tal-kolazzjon jaġġusta ruħu awtomatikament.",
            },
            { type: "h2", text: "Ikkonfigura rata derivata" },
            {
              type: "steps",
              items: [
                "Iftaħ il-pjan tar-rata mixtieq fit-tab “Prezzijiet”.",
                "Agħżel “Derivat minn…” bħala s-sors tal-prezz, u r-rata bażika korrispondenti.",
                "Iddetermina jekk id-differenza tapplikax bħala ammont fiss jew bħala perċentwal.",
                "Iddeċiedi jekk hijiex żieda jew tnaqqis.",
                "Issejvja l-assenjazzjoni.",
              ],
            },
            {
              type: "ul",
              items: [
                "Żieda: eż. ikel, possibbiltà ta' kanċellazzjoni aktar tard.",
                "Tnaqqis: eż. pjan mhux kanċellabbli b'vantaġġ fil-prezz.",
                "Ir-rata bażika tibqa' l-unika sors miżmum manwalment.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rata derivata ma tistax tiġi injorata manwalment fl-istess ħin. Neħħi l-ewwel id-derivazzjoni jekk tixtieq tistabbilixxi prezz individwali differenti.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Prezzijiet Staġonali u tal-Weekend",
          excerpt: "Aġġusta b'mod immirat il-prezzijiet għal perjodi staġonali u weekends.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Id-domanda tvarja matul is-sena u fi ħdan il-ġimgħa. Bil-prezzijiet staġonali u tal-weekend, taġġusta l-prezz bażiku għal perjodi jew jiem tal-ġimgħa speċifiċi, mingħajr ma tidħol fil-kalendarju għal kull ġurnata individwalment.",
            },
            { type: "h2", text: "Oħloq perjodu staġonali" },
            {
              type: "steps",
              items: [
                "Fil-proprjetà, iftaħ it-tab “Prezzijiet” u t-taqsima “Prezzijiet Staġonali”.",
                "Oħloq perjodu ġdid b'data tal-bidu u tat-tmiem.",
                "Daħħal il-prezz jew id-devjazzjoni perċentwali mill-prezz bażiku għal dan il-perjodu.",
                "Issejvja l-perjodu staġonali.",
              ],
            },
            { type: "h2", text: "Prezzijiet tal-Weekend" },
            {
              type: "p",
              text: "Barra minn hekk, tista' tassenja żieda tiegħek stess lil jiem individwali tal-ġimgħa, pereżempju l-Ġimgħa u s-Sibt. Din iż-żieda tapplika flimkien mal-prezz staġonali jew bażiku li jkun validu dak il-ħin.",
            },
            {
              type: "ul",
              items: [
                "Il-prezzijiet staġonali japplikaw għal perjodi kontinwi.",
                "Il-prezzijiet tal-weekend japplikaw għal kull jum tal-ġimgħa, indipendentement mill-istaġun.",
                "Iż-żewġ regoli jistgħu jiġu kkombinati.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jekk diversi perjodi staġonali jikkoinċidu, tapplika l-aħħar regola maħluqa jew l-aktar speċifika. Iċċekkja l-kalendarju wara li tissejvja.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Għal aġġustamenti awtomatiċi bbażati fuq id-domanda, jaqbel ukoll [Prezzijiet Dinamiċi](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Prezzijiet Dinamiċi",
          excerpt: "Aġġusta l-prezzijiet awtomatikament skont id-domanda, iż-żmien ta' avviż u l-okkupazzjoni.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Il-prezzijiet dinamiċi huma modulu addizzjonali bi ħlas. Tordnah taħt “Estensjonijiet”, fejn tidher ukoll il-prezz. Mingħajr il-modulu, l-awtomazzjoni ma tikkalkulax.",
            },
            {
              type: "p",
              text: "Il-prezzijiet dinamiċi jaġġustaw il-prezz bażiku awtomatikament abbażi ta' fatturi bħaż-żmien ta' avviż tal-prenotazzjoni, l-okkupazzjoni kurrenti u d-domanda — b'mod simili għal kif il-portali l-kbar jagħmlu bir-rakkomandazzjonijiet ta' prezz tagħhom stess. B'hekk tirreaġixxi għal bidliet fis-suq mingħajr ma taġġusta manwalment kuljum.",
            },
            { type: "h2", text: "Attiva l-prezzijiet dinamiċi" },
            {
              type: "steps",
              items: [
                "Fil-proprjetà, iftaħ it-tab “Prezzijiet” u t-taqsima “Prezzijiet Dinamiċi”.",
                "Attiva l-funzjoni għar-rata bażika tal-proprjetà.",
                "Iddefinixxi limitu minimu u limitu massimu tal-prezz.",
                "Iddetermina sa fejn l-okkupazzjoni tista' tinfluwenza l-prezz.",
                "Issejvja l-issettjar.",
              ],
            },
            { type: "h2", text: "Limiti u sigurtà" },
            {
              type: "p",
              text: "Il-limitu minimu u l-limitu massimu tal-prezz jipprevjenu li l-algoritmu awtomatiku jistabbilixxi prezzijiet li mhumiex sostenibbli għan-negozju tiegħek. Il-pjani tar-rata derivati jsegwu awtomatikament ir-rata bażika kkalkulata dinamikament.",
            },
            {
              type: "ul",
              items: [
                "Il-limitu minimu tal-prezz jipproteġi minn prezzijiet baxxi wisq waqt domanda dgħajfa.",
                "Il-limitu massimu tal-prezz jipproteġi minn prezzijiet esaġerati waqt domanda għolja.",
                "Ir-rati derivati jaqbdu awtomatikament ir-rata bażika l-ġdida.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Il-prezzijiet dinamiċi japplikaw biss għar-rata bażika. Pjani tar-rata ffissati manwalment mingħajr derivazzjoni ma jinbidlux awtomatikament magħha.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Skontijiet fuq is-Soġġorn",
          excerpt: "Ikkonfigura skontijiet għal soġġorni itwal u prenotazzjonijiet bikrija.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-iskontijiet fuq is-soġġorn jippremjaw lill-mistiedna għal prenotazzjonijiet itwal jew għal prenotazzjoni bikrija. Jiġu applikati bħala perċentwal fuq il-prezz totali tas-soġġorn u jistgħu jiġu kkonfigurati b'mod indipendenti għal kull proprjetà.",
            },
            { type: "h2", text: "Tipi ta' skontijiet" },
            {
              type: "ul",
              items: [
                "Skont fuq perjodu twil: minn ċertu numru ta' lejliet, eż. minn 7 jew 28 lejl.",
                "Skont għal prenotazzjoni bikrija: meta l-prenotazzjoni ssir bil-quddiem biżżejjed.",
                "Skont tal-aħħar minuta: għal prenotazzjoni fil-qosor qrib id-data tal-wasla.",
              ],
            },
            { type: "h2", text: "Ikkonfigura skont" },
            {
              type: "steps",
              items: [
                "Fil-proprjetà, iftaħ it-tab “Prezzijiet” u t-taqsima “Skontijiet”.",
                "Agħżel it-tip ta' skont mixtieq.",
                "Iddefinixxi l-limitu, eż. lejliet minimi jew żmien ta' avviż.",
                "Daħħal l-iskont fil-perċentwal.",
                "Issejvja r-regola.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L-iskontijiet japplikaw għall-prezz totali tal-pjan tar-rata rispettiv u jintwerew lill-mistieden diġà fil-ħarsa ġenerali tal-prezzijiet.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ikkombina l-iskontijiet fuq perjodu twil ma' [Soġġorn Minimu u Massimu](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) biex tippromwovi b'mod immirat prenotazzjonijiet itwal.",
            },
          ],
        },
      ],
    },
  ],
};
