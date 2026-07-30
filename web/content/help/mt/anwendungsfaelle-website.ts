import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Websajt",
  description: "Uża l-websajt tiegħek b'mod ottimali.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Websajt",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Attiva l-Websajt Tiegħek Live",
          excerpt: "Hekk tippubblika l-websajt proprja tiegħek bħala kanal ta' distribuzzjoni indipendenti.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Il-websajt tiegħek hija kanal ta' distribuzzjoni proprju flimkien mal-portali u l-pjattaforma. Tibni l-paġni fl-editur, imma huwa biss bil-pubblikazzjoni li l-websajt issir viżibbli għall-mistiedna u l-proprjetajiet tiegħek jidhru disponibbli għall-prenotazzjoni hemmhekk.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ l-editur tal-websajt u iċċekkja li l-paġni kollha mixtieqa jkunu mimlija bil-kontenut.",
                "Agħżel fit-tab tal-proprjetà, għal kull proprjetà, jekk għandhiex tkun viżibbli fuq il-websajt — din il-viżibbiltà hija indipendenti mill-portali u l-pjattaforma.",
                "Iċċekkja l-anteprima fil-veduta desktop u mobbli qabel tmur live.",
                "Ikklikkja “Ippubblika” biex tattiva l-websajt għall-mistiedna.",
                "Wara l-pubblikazzjoni, iċċekkja l-URL pubblika u ittestja prenotazzjoni ta' eżempju permezz tal-websajt.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il-viżibbiltà tal-websajt ta' proprjetà hija assi tagħha stess — proprjetà tista' tkun attiva fuq il-portali imma moħbija fuq il-websajt, u bil-maqlub. Dettalji taħt [Qabbad Dominju Proprju](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Qabbad Dominju Proprju",
          excerpt: "Hekk tqabbad id-dominju proprju tiegħek mal-websajt tiegħek ta' myNextDays.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Dominju proprju bħal www.in-negozju-tiegħek.mt jidher aktar professjonali minn indirizz default u jsaħħaħ il-marka tiegħek quddiem il-mistiedna li jixtiequ jipprenotaw direttament għandek.",
            },
            {
              type: "steps",
              items: [
                "Fl-editur tal-websajt, iftaħ it-taqsima “Dominju” u daħħal id-dominju proprju mixtieq tiegħek.",
                "Ikkonfigura mal-fornitur tad-dominju tiegħek id-dħul tad-DNS muri (normalment CNAME jew A-Record).",
                "Stenna sakemm id-dominju jintwera konness u ċ-ċertifikat SSL attiv — dan jista' jieħu ftit sigħat skont il-fornitur.",
                "Ittestja l-aċċess tad-dominju proprju f'tieqa privata tal-brawżer biex teskludi dħul qadim maħżun.",
                "Iċċekkja li l-indirizzi default il-qodma jkomplu jiddevjaw lejn id-dominju l-ġdid, sabiex il-links eżistenti ma jispiċċawx fix-xejn.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ibdel id-dħul tad-DNS biss kif muri — valuri żbaljati jistgħu jfixklu l-issettjar tal-email eżistenti tad-dominju tiegħek. F'każ ta' dubju, iċċekkja mal-fornitur tad-dominju tiegħek qabel tissostitwixxi dħul eżistenti.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Żid il-Prenotazzjonijiet Diretti",
          excerpt: "Hekk iddawwar aktar mistiedna lejn il-websajt proprja tiegħek minflok il-portali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Il-prenotazzjonijiet permezz tal-websajt proprja huma ġeneralment orħos għan-negozju tiegħek minn dawk permezz tal-portali, peress li hawnhekk ma tapplika ebda kummissjoni ta' portal. B'xi miżuri immirati żżid is-sehem tal-prenotazzjonijiet diretti permezz tal-websajt tiegħek bħala kanal indipendenti.",
            },
            {
              type: "steps",
              items: [
                "Iżgura li l-proprjetajiet kollha li jistgħu jiġu prenotati jkunu viżibbli fuq il-websajt u pprovduti b'ritratti u deskrizzjonijiet aġġornati.",
                "Ikkonfigura skont jew vantaġġ esklussiv tal-websajt, pereżempju tnaqqis żgħir fil-prezz meta mqabbel mal-portali.",
                "Illinkja d-dominju proprju tiegħek fil-konfermi tal-prenotazzjoni u fil-komunikazzjoni ma' mistiedna li diġà pprenotaw darba.",
                "Iċċekkja regolarment l-istatistika tal-prenotazzjonijiet biex tosserva s-sehem tal-websajt fil-prenotazzjonijiet kollha maż-żmien.",
                "Ottimizza l-ħin tat-tagħbija u l-preżentazzjoni mobbli tal-websajt, peress li parti kbira mill-mistiedna jipprenotaw mill-mobile.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Vantaġġ esklussiv tal-websajt jaħdem biss jekk il-mistiedna jsibu l-websajt fl-ewwel post — irreferi għaliha b'mod attiv, minflok tiddependi biss fuq il-portali. Għall-pubblikazzjoni, ara [Attiva l-Websajt Tiegħek Live](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
