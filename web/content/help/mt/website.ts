import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Il-Bennej tal-Websajt",
  description: "Oħloq il-websajt tal-prenotazzjoni proprja tiegħek bil-bennej.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Il-Bennej tal-Websajt",
      articles: [
        {
          slug: "website-erstellen",
          title: "Oħloq Websajt",
          excerpt: "Bil-bennej toħloq websajt tal-prenotazzjoni proprja fi ftit minuti.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Il-bennej tal-websajt joħloqlok websajt tal-prenotazzjoni proprja — kanal ta' distribuzzjoni addizzjonali flimkien mal-portali u s-suq ta' myBestDays. Iżżomm kontroll sħiħ fuq l-istruttura, il-kontenut u l-branding.",
            },
            { type: "h2", text: "Kif toħloq websajt" },
            {
              type: "steps",
              items: [
                "Iftaħ Websajt fil-menu.",
                "Ikklikkja Oħloq Websajt.",
                "Agħżel mudell bħala punt tat-tluq għal-layout tiegħek.",
                "Ikkonferma b'Oħloq Websajt — tidħol direttament fl-editur.",
              ],
            },
            { type: "h2", text: "X'fih il-bennej" },
            {
              type: "ul",
              items: [
                "Editur viżwali b'paġni, saffi u veduta ta' anteprima",
                "Blokki lesti għal-listi ta' proprjetajiet, galleriji u formoli ta' kuntatt",
                "Proċess ta' prenotazzjoni dirett ibbażat fuq id-disponibbiltà tal-kalendarju tiegħek",
                "Kuluri, tipi ta' ittri u logo li jistgħu jiġu adattati skont il-marka tiegħek",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ibda b'mudell li joqrob lejn it-tip ta' proprjetà tiegħek — proprjetà tal-vaganzi jew lukanda — dan ifaddal ħin meta taġġusta l-blokki aktar tard.",
            },
            { type: "h2", text: "Il-passi li jmiss" },
            {
              type: "p",
              text: "Wara l-ħolqien, taġġusta l-paġni u l-layout, ara [Editja l-Paġni u l-Layout](/hilfe/website/seiten-layout), u turi l-proprjetajiet tiegħek fuq il-websajt, ara [Uri l-Proprjetajiet fuq il-Websajt](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Editja l-Paġni u l-Layout",
          excerpt: "Aġġusta l-paġni, is-saffi u l-blokki fl-editur viżwali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-editur huwa maqsum fi tliet taqsimiet: fuq ix-xellug il-ħarsa ġenerali tal-paġni u s-saffi, fin-nofs l-anteprima tal-websajt tiegħek, fuq il-lemin l-issettjar tal-blokk magħżul.",
            },
            { type: "h2", text: "Editja paġna" },
            {
              type: "steps",
              items: [
                "Agħżel il-paġna mixtieqa fuq ix-xellug taħt Paġni.",
                "Ikklikkja fuq blokk fl-anteprima biex tagħżlu.",
                "Aġġusta t-test, l-istampa jew id-distanza tal-blokk fuq il-lemin.",
                "Iġbed il-blokki bid-drag-and-drop biex tibdel l-ordni.",
              ],
            },
            { type: "h2", text: "Żid Paġni u Blokki Ġodda" },
            {
              type: "p",
              text: "Permezz tal-buttuna Żid Paġna toħloq sub-paġni oħra, pereżempju Dwarna jew Kuntatt. Fi ħdan paġna, permezz ta' Żid Blokk iddaħħal taqsimiet ġodda bħal Galleria, Reviżjonijiet jew Formola ta' Kuntatt.",
            },
            {
              type: "ul",
              items: [
                "Il-Paġna Ewlenija, il-Ħarsa Ġenerali tal-Proprjetajiet u l-Kuntatt huma prestabbiliti f'kull mudell",
                "Paġni oħra jistgħu jissemmew liberament u jiddaħħlu fin-navigazzjoni",
                "Il-blokki huma responsivi u jadattaw ruħhom għad-desktop, it-tablet u l-mobile",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il-bidliet fl-editur huma fil-bidu biss abbozz. Klikk fuq Ippubblika biss japplikahom fuq il-websajt pubblika tiegħek.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Qabbad Dominju",
          excerpt: "Qabbad dominju proprju mal-websajt tiegħek ta' myNextDays.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Default, il-websajt tiegħek tista' tintlaħaq permezz ta' sub-dominju ta' myNextDays. Jekk minflok tixtieq tuża dominju proprju bħal pereżempju in-negozju-tiegħek.mt, qabbdu fit-taqsima Dominju.",
            },
            { type: "h2", text: "Irreġistra dominju" },
            {
              type: "steps",
              items: [
                "Fil-Websajt, iftaħ l-Issettjar u hemmhekk Dominju.",
                "Daħħal id-dominju proprju tiegħek u ikklikkja Qabbad.",
                "Oħloq id-dħul ta' DNS murija mal-fornitur tad-dominju tiegħek.",
                "Stenna l-konferma — il-verifika ssir awtomatikament fl-isfond.",
              ],
            },
            { type: "h2", text: "Issettja d-dħul tad-DNS korrettament" },
            {
              type: "p",
              text: "myNextDays turik eżattament id-dħul meħtieġ għall-fornitur tad-dominju tiegħek. Il-konnessjoni ssir attiva biss ladarba dan id-dħul ikun issettjat korrettament u jkun infirex mad-dinja kollha — dan jista' jieħu ftit sigħat skont il-fornitur.",
            },
            {
              type: "ul",
              items: [
                "Issettja dħul CNAME jew A skont l-istruzzjonijiet murija",
                "Neħħi minn qabel dħul eżistenti u kontradittorju għall-istess dominju",
                "Iċ-ċertifikat għal https jinħareġ awtomatikament wara konnessjoni b'suċċess",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Mingħajr dħul tad-DNS issettjat korrettament, il-websajt tiegħek ma tibqax milħuqa taħt id-dominju proprju — iċċekkja bir-reqqa l-kitba kontra d-dettalji tal-fornitur tiegħek.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Uri l-Proprjetajiet fuq il-Websajt",
          excerpt: "Liema proprjetajiet huma viżibbli u disponibbli għall-prenotazzjoni fuq il-websajt, tikkontrollahom separatament għal kull proprjetà.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Sabiex proprjetà tidher fuq il-websajt tiegħek, il-viżibbiltà tal-websajt għal din il-proprjetà trid tkun attivata. Dan is-swiċċ huwa indipendenti mill-viżibbiltà fuq is-suq ta' myBestDays jew fuq il-portali.",
            },
            { type: "h2", text: "Attiva proprjetà għall-websajt" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt Proprjetajiet.",
                "Aqleb għat-tab Viżibbiltà.",
                "Attiva s-swiċċ Websajt.",
                "Aqleb għall-Websajt u iċċekkja l-blokk Ħarsa Ġenerali tal-Proprjetajiet fl-anteprima.",
              ],
            },
            { type: "h2", text: "Aġġusta l-ordni u l-preżentazzjoni" },
            {
              type: "p",
              text: "Fil-blokk Ħarsa Ġenerali tal-Proprjetajiet tiddeċiedi jekk il-proprjetajiet jiġux issortjati awtomatikament skont id-disponibbiltà jew jekk tistabbilixxix ordni fissa. Kull proprjetà turi r-ritratt ewlieni, il-prezz bażiku fil-munita tagħha reġistrata u l-karatteristiċi ewlenin tal-faċilitajiet.",
            },
            {
              type: "ul",
              items: [
                "Issortjar awtomatiku skont id-disponibbiltà jew ordni manwali",
                "Filtru skont it-tip ta' proprjetà jew il-faċilitajiet jista' jiġi attivat b'mod fakultattiv",
                "Il-passi tal-prenotazzjoni jsiru direttament fuq il-websajt, mingħajr ma tgħaddi mill-portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Proprjetà mingħajr il-viżibbiltà tal-websajt attivata tibqa' moħbija mill-ħarsa ġenerali tal-proprjetajiet, anke jekk tkun viżibbli fis-suq jew fil-portali.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Ippubblika l-Websajt",
          excerpt: "L-abbozzi jsiru viżibbli pubblikament biss b'klikk fuq Ippubblika.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Sakemm taħdem fl-editur, int biss tara l-abbozz kurrenti. Klikk fuq Ippubblika biss jagħmel il-bidliet viżibbli taħt id-dominju tiegħek għaż-żjajjar kollha.",
            },
            { type: "h2", text: "Kif tippubblika" },
            {
              type: "steps",
              items: [
                "Fl-editur, iftaħ l-anteprima u iċċekkja l-paġni kollha.",
                "Ikklikkja Ippubblika fuq il-lemin fuq nett.",
                "Ikkonferma d-djalogu — il-websajt tkun attiva immedjatament wara.",
                "Iftaħ id-dominju tiegħek f'tab ġdid biex tiċċekkja r-riżultat.",
              ],
            },
            { type: "h2", text: "Abbozzi u Rriseta" },
            {
              type: "p",
              text: "Sakemm ma tkunx għadek ippubblikajt, tista' terġa' lura fi kwalunkwe ħin għall-aħħar verżjoni ppubblikata, mingħajr ma titlef definittivament l-abbozz — għal dan uża Skarta l-Abbozz fl-issettjar tal-websajt.",
            },
            {
              type: "ul",
              items: [
                "Il-bidliet ippubblikati jkunu viżibbli minnufih taħt id-dominju tiegħek",
                "Abbozz mhux ippubblikat jibqa' intern sakemm tikkonfermah",
                "Kull pubblikazzjoni tiġi rreġistrata bid-data fl-istorja",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Qabel tippubblika, iċċekkja l-veduta mobbli fl-anteprima — ħafna mistiedna jaċċessaw il-websajts tal-prenotazzjoni permezz tal-mobile.",
            },
          ],
        },
      ],
    },
  ],
};
