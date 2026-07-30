import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Sidien u Fatturazzjonijiet",
  description: "Kontijiet tas-sidien, fatturazzjonijiet u kummissjonijiet.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Sidien",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Oħloq Sid",
          excerpt: "Hekk toħloq kont ġdid ta' sid f'myNextDays.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Is-sidien huma kontijiet separati f'myNextDays, li permezz tagħhom timmaniġġja proprjetajiet li jappartjenu lil persuna jew kumpanija speċifika. Kont ta' sid jirċievi aċċess limitat u read-only lill-proprjetajiet tiegħu stess, mingħajr ma jista' jagħmel bidliet fin-negozju.",
            },
            { type: "h2", text: "Oħloq kont ġdid ta' sid" },
            {
              type: "steps",
              items: [
                "Iftaħ it-taqsima “Sidien” fil-menu prinċipali.",
                "Ikklikkja “Oħloq Sid Ġdid”.",
                "Daħħal l-isem, l-indirizz tal-email u d-dettalji ta' kuntatt.",
                "Daħħal l-indirizz tal-fatturazzjoni jekk meħtieġ għall-fatturazzjonijiet.",
                "Issejvja l-kont.",
              ],
            },
            { type: "h2", text: "Ikkonfigura l-aċċess" },
            {
              type: "p",
              text: "Wara l-ħolqien, tista' tibgħat stedina lis-sid għal aċċess tiegħu stess. Is-sid imbagħad jidħol bid-dettalji tal-aċċess tiegħu stess u jara esklussivament il-proprjetajiet assenjati lilu.",
            },
            {
              type: "ul",
              items: [
                "Kont ta' sid jista' jinkludi diversi proprjetajiet.",
                "Kull proprjetà tappartjeni eżattament lil sid wieħed.",
                "Id-dettalji ta' kuntatt u l-indirizz tal-fatturazzjoni jistgħu jiġu aġġustati fi kwalunkwe ħin aktar tard.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kif tassenja proprjetà eżistenti lil sid, aqra taħt [Assenja Proprjetà lil Sid](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Assenja Proprjetà lil Sid",
          excerpt: "Kull proprjetà tappartjeni eżattament lil sid wieħed — hekk tikkonfigura l-assenjazzjoni.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "F'myNextDays, kull proprjetà tappartjeni eżattament lil sid wieħed. Assenjazzjoni multipla mhix prevista — jekk proprjetà għandha tappartjeni lil sid ieħor, neħħi l-ewwel l-assenjazzjoni eżistenti qabel ma tissettja waħda ġdida.",
            },
            { type: "h2", text: "Wettaq l-assenjazzjoni" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt “Proprjetajiet”.",
                "Aqleb għat-tab “Sid”.",
                "Agħżel is-sid responsabbli mil-lista.",
                "Ikkonferma l-assenjazzjoni.",
                "Issejvja l-bidla fil-proprjetà.",
              ],
            },
            { type: "h2", text: "Bidla tas-sid" },
            {
              type: "p",
              text: "Jekk is-sid ta' proprjetà jinbidel, pereżempju permezz ta' bejgħ, issostitwixxi l-assenjazzjoni eżistenti bil-ġdida. Il-fatturazzjonijiet diġà maħluqa għal perjodi passati jibqgħu assenjati lis-sid oriġinali.",
            },
            {
              type: "ul",
              items: [
                "Proprjetà tista' tkun assenjata biss lil sid wieħed fi kwalunkwe mument.",
                "Mingħajr assenjazzjoni, il-proprjetà ma tidhirx f'ebda aċċess ta' sid.",
                "Il-fatturazzjonijiet passati jibqgħu mas-sid oriġinali.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Assenjazzjoni multipla ta' proprjetà lil diversi sidien hija eskluża — is-sistema ma tippermettix it-tieni assenjazzjoni fl-istess ħin.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Fatturazzjoni tas-Sid (Statement)",
          excerpt: "Hekk toħloq statement bid-dħul minn tnaqqis tal-kummissjoni għal sid.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Il-fatturazzjoni tas-sid, imsejħa wkoll statement, tiġbor id-dħul kollu tal-proprjetajiet assenjati għal perjodu magħżul u tnaqqas il-kummissjoni miftiehma tiegħek. Ir-riżultat huwa l-ammont li tħallas lis-sid.",
            },
            { type: "h2", text: "Oħloq statement" },
            {
              type: "steps",
              items: [
                "Iftaħ it-taqsima “Sidien” u agħżel is-sid mixtieq.",
                "Aqleb għat-tab “Fatturazzjoni”.",
                "Agħżel il-perjodu ta' fatturazzjoni.",
                "Iċċekkja l-prenotazzjonijiet u d-dħul elenkati għal kull proprjetà.",
                "Ħalli l-istatement jinħoloq bil-kummissjoni mnaqqsa.",
              ],
            },
            { type: "h2", text: "Struttura tal-istatement" },
            {
              type: "p",
              text: "Statement jelenka għal kull proprjetà d-dħul gross mill-prenotazzjonijiet, il-kummissjoni mnaqqsa minnu u l-ammont ta' ħlas li jirriżulta. Spejjeż addizzjonali bħal tindif jew imposti jistgħu, skont il-ftehim, jintwerew separatament.",
            },
            {
              type: "ul",
              items: [
                "Dħul gross: is-somma tal-prenotazzjonijiet kollha fil-perjodu għal kull proprjetà.",
                "Kummissjoni: is-sehem miftiehem tiegħek, jitnaqqas mid-dħul.",
                "Ammont ta' ħlas: dħul mnaqqas il-kummissjoni u entrati oħra jekk applikabbli.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L-ammonti fl-istatement jintwerew dejjem fil-munita tal-proprjetà — ma teżisti ebda munita default ġenerika.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Oħloq statements regolarment fl-istess data, sabiex is-sidien ikollhom ritmu affidabbli għall-ħlasijiet tagħhom.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Aċċess tas-Sid",
          excerpt: "X'jistgħu jaraw is-sidien fl-aċċess read-only tagħhom.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-aċċess tas-sid huwa login separat, read-only, għal myNextDays. Fih is-sidien jaraw esklussivament il-proprjetajiet assenjati lilhom kif ukoll l-okkupazzjonijiet u l-fatturazzjonijiet korrispondenti — mingħajr possibbiltà li jbiddlu l-issettjar huma stess.",
            },
            { type: "h2", text: "X'jaraw is-sidien" },
            {
              type: "ul",
              items: [
                "Il-kalendarju tal-okkupazzjoni tal-proprjetajiet tagħhom stess.",
                "L-istatements maħluqa bid-dħul u l-kummissjoni mnaqqsa.",
                "Id-dejta bażika tal-proprjetajiet tagħhom, bħall-faċilitajiet u d-deskrizzjoni.",
              ],
            },
            { type: "h2", text: "Attiva l-aċċess" },
            {
              type: "steps",
              items: [
                "Iftaħ is-sid taħt “Sidien”.",
                "Ikklikkja “Stieden għall-Aċċess”.",
                "Is-sid jirċievi email biex jikkonfigura l-password tiegħu stess.",
                "Wara li jidħol, is-sid jara awtomatikament biss il-proprjetajiet assenjati lilu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "L-aċċess tas-sid huwa strettament read-only: il-prezzijiet, id-disponibbiltà jew id-dejta tal-proprjetà jistgħu jinbidlu biss minnek bħala negozju, mhux mis-sid stess.",
            },
            {
              type: "note",
              variant: "info",
              text: "Aktar dettalji dwar l-assenjazzjoni ta' proprjetajiet ssibhom taħt [Assenja Proprjetà lil Sid](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
