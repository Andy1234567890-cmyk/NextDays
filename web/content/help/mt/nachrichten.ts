import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Messaġġi u Mistiedna",
  description: "Kaxxa tal-posta, mudelli u komunikazzjoni mal-mistiedna.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Komunikazzjoni",
      articles: [
        {
          slug: "posteingang",
          title: "Il-Kaxxa tal-Posta tal-Pjattaforma",
          excerpt: "Il-messaġġi kollha tal-mistiedna tal-proprjetajiet tiegħek jinġabru ċentralment fil-kaxxa tal-posta tal-pjattaforma.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Kaxxa tal-posta waħda għall-proprjetajiet kollha" },
            {
              type: "p",
              text: "Il-kaxxa tal-posta tal-pjattaforma tiġbor il-messaġġi kollha tal-mistiedna tiegħek f'post wieħed — indipendentement minn liema proprjetà jew perjodu tirrigwarda l-konverżazzjoni. Tiftaħha taħt /nachrichten u hemmhekk tara kull konverżazzjoni bħala thread separat.",
            },
            { type: "h2", text: "Struttura tal-kaxxa tal-posta" },
            {
              type: "ul",
              items: [
                "Kolonna tax-xellug: lista tal-konverżazzjonijiet kollha, l-aktar riċenti l-ewwel",
                "Kolonna tan-nofs: l-istorja attiva tal-messaġġi mal-mistieden",
                "Kolonna tal-lemin: kuntest tar-riżervazzjoni — perjodu, proprjetà, dettalji tal-mistieden",
              ],
            },
            { type: "h2", text: "Wieġeb messaġġ" },
            {
              type: "steps",
              items: [
                "Iftaħ /nachrichten u agħżel il-konverżazzjoni mixtieqa",
                "Ikteb it-tweġiba tiegħek fil-qasam tat-test jew uża tweġiba mgħaġġla",
                "Ibgħat il-messaġġ — il-mistieden jirċevih bl-istess mod li bih kiteb",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il-kaxxa tal-posta tal-pjattaforma turi esklussivament il-komunikazzjoni diretta bejnek u l-mistiedna tiegħek fuq myNextDays — il-messaġġi mill-portali tibqa' tipproċessahom hemmhekk.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Tweġibiet Mgħaġġla",
          excerpt: "Mudelli għal mistoqsijiet komuni jfaddlu ħin fil-kuntatt mal-mistiedna.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "X'inhuma t-tweġibiet mgħaġġla" },
            {
              type: "p",
              text: "It-tweġibiet mgħaġġla huma blokki ta' test ifformulati minn qabel għal mistoqsijiet rikorrenti — pereżempju dwar il-wasla, il-password tal-WiFi jew is-sitwazzjoni tal-parkeġġ. Minflok tikteb kull tweġiba mill-ġdid, iddaħħal il-mudell xieraq b'klikk waħda fil-[Kaxxa tal-Posta tal-Pjattaforma](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Oħloq tweġiba mgħaġġla" },
            {
              type: "steps",
              items: [
                "Iftaħ /nachrichten u ikklikkja “Immaniġġja t-Tweġibiet Mgħaġġla”",
                "Ikklikkja “Mudell Ġdid” u agħti titlu, pereżempju “Informazzjoni tal-Check-in”",
                "Ikteb it-test tat-tweġiba; segwaposti bħal isem il-mistieden jew id-data tal-wasla jiġu mdaħħla awtomatikament mal-bgħit",
                "Issejvja l-mudell — jkun disponibbli minn issa 'l quddiem f'kull konverżazzjoni",
              ],
            },
            { type: "h2", text: "Uża t-tweġibiet mgħaġġla fil-ħajja ta' kuljum" },
            {
              type: "p",
              text: "Fit-tieqa tal-messaġġi, iftaħ il-lista tal-mudelli permezz tal-ikona tal-fulmin, agħżel it-tweġiba xierqa u aġġustaha individwalment jekk meħtieġ qabel ma tibgħatha.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Oħloq mudelli għall-aktar ħames sa għaxar mistoqsijiet komuni — dan fil-prattika jkopri l-parti l-kbira tal-messaġġi li jaslu.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Messaġġi Awtomatiċi",
          excerpt: "Il-konfermi, l-informazzjoni tal-check-in u t-tfakkiriet jistgħu jintbagħtu awtomatikament lill-mistiedna.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Awtomatizza messaġġi rikorrenti" },
            {
              type: "p",
              text: "Minflok tibgħat il-konfermi tal-prenotazzjoni, l-informazzjoni tal-check-in jew il-messaġġi ta' ringrazzjament manwalment, irreġistrahom darba bħala regola — myNextDays imbagħad tibgħathom awtomatikament fil-ħin xieraq qabel, matul jew wara s-soġġorn.",
            },
            { type: "h2", text: "Skattaturi tipiċi għal messaġġi awtomatiċi" },
            {
              type: "ul",
              items: [
                "Immedjatament wara l-prenotazzjoni — konferma bid-dettalji ewlenin",
                "Ftit ġranet qabel il-wasla — informazzjoni tal-check-in u kodiċi ta' aċċess",
                "Fil-ġurnata tat-tluq — ringrazzjament u talba għal reviżjoni",
              ],
            },
            { type: "h2", text: "Ikkonfigura messaġġ awtomatiku" },
            {
              type: "steps",
              items: [
                "Iftaħ /nachrichten, taqsima “Messaġġi Awtomatiċi”",
                "Agħżel l-iskattatur, pereżempju “X ġranet qabel il-wasla”",
                "Daħħal it-test — segwaposti bħal isem il-mistieden, proprjetà jew data tal-wasla jimtlew awtomatikament",
                "Attiva r-regola; tapplika għall-proprjetajiet kollha, sakemm ma tkunx limitata b'mod ieħor",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il-messaġġi awtomatiċi jidhru normalment fil-[Kaxxa tal-Posta tal-Pjattaforma](/hilfe/nachrichten/posteingang) u jistgħu jiġu vverifikati hemmhekk aktar tard fi kwalunkwe ħin.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Imblokka Messaġġi",
          excerpt: "Tista' timblokka persuna direttament mill-istorja tal-messaġġi minn kuntatt ulterjuri.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            { type: "h2", text: "Meta imblukkar jagħmel sens" },
            {
              type: "p",
              text: "F'każ ta' messaġġi offensivi, fastidju jew imġiba mhux xierqa ripetuta, tista' timblokka persuna direttament mit-thread tal-messaġġi. Persuna mblukkata ma tistax tibqa' tikteblek messaġġi ġodda u ma tistax toħloq prenotazzjoni ġdida miegħek.",
            },
            { type: "h2", text: "Imblokka persuna mit-thread" },
            {
              type: "steps",
              items: [
                "Iftaħ il-konverżazzjoni affettwata fil-[Kaxxa tal-Posta tal-Pjattaforma](/hilfe/nachrichten/posteingang)",
                "Ikklikkja l-menu fuq nett fit-thread u agħżel “Imblokka Persuna”",
                "Ikkonferma l-proċess — l-imblukkar japplika minnufih",
              ],
            },
            { type: "h2", text: "X'ifisser l-imblukkar — u x'ma jfissirx" },
            {
              type: "ul",
              items: [
                "Messaġġi ġodda mill-persuna mblukkata ma jibqgħux jitwasslu",
                "Talbiet ġodda għal prenotazzjoni mill-persuna jiġu miċħuda",
                "Jekk riżervazzjoni ta' din il-persuna tkun għaddejja bħalissa, il-komunikazzjoni tibqa' possibbli b'eċċezzjoni għad-durata tas-soġġorn",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Imblukkar jista' jitneħħa fi kwalunkwe ħin fil-ħarsa ġenerali “Persuni Mblukkati” fil-Kont. Iċċekkja qabel timblokka jekk diġà tkunx teżisti prenotazzjoni kurrenti.",
            },
          ],
        },
      ],
    },
  ],
};
