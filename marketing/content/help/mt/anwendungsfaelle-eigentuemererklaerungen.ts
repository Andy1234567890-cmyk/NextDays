import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Dikjarazzjonijiet tas-Sidien",
  description: "Oħloq dikjarazzjonijiet tas-sidien.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Dikjarazzjonijiet tas-Sidien",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Iġġenera Statement ta' Sid",
          excerpt: "Hekk toħloq fatturazzjoni ċara tal-perjodu tiegħu għal sid.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Jekk timmaniġġja proprjetajiet għal sidien, dawn jeħtieġu regolarment ħarsa ġenerali traċċabbli dwar id-dħul, il-kummissjoni mnaqqsa u l-ħlas tal-proprjetajiet tagħhom għal perjodu speċifiku — l-istatement tas-sid jiġbor din id-dejta awtomatikament.",
            },
            {
              type: "steps",
              items: [
                "Fil-Kont, iftaħ it-taqsima Sidien u agħżel is-sid ikkonċernat.",
                "Agħżel il-perjodu ta' fatturazzjoni li għalih għandu jinħoloq l-istatement.",
                "Iċċekkja li l-proprjetajiet kollha ta' dan is-sid ikunu assenjati korrettament, peress li biss proprjetajiet assenjati jidħlu fl-istatement.",
                "Ħalli l-istatement jiġi ġġenerat u iċċekkja li r-riżervazzjonijiet elenkati jkunu kompluti.",
                "Agħmel l-istatement disponibbli għas-sid permezz tal-aċċess tas-sid jew esportah bħala dokument.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L-istatement juri kull riżervazzjoni bl-ammont fil-munita tal-proprjetà rispettiva — ma teżisti ebda indikazzjoni ġenerika tal-munita, peress li diversi proprjetajiet jistgħu jkollhom ukoll muniti differenti. Aktar dettalji dwar l-assenjazzjoni taħt [Assenja Proprjetà lil Sid](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Iffattura l-Kummissjoni mas-Sid",
          excerpt: "Hekk tiżgura li l-kummissjoni tiegħek tiġi kkalkulata korrettament mid-dħul tas-sid.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Il-kummissjoni tiegħek għall-ġestjoni ta' proprjetà hija rreġistrata fit-tariffa tas-sid u titnaqqas awtomatikament mid-dħul gross f'kull statement. Sabiex il-fatturazzjoni tkun korretta, ir-rata tal-kummissjoni trid tkun issettjata korrettament qabel l-ewwel prenotazzjoni fil-perjodu.",
            },
            {
              type: "steps",
              items: [
                "Fil-Kont, iftaħ it-tariffa tas-sid ikkonċernat u iċċekkja r-rata tal-kummissjoni rreġistrata.",
                "Aġġusta r-rata jekk meħtieġ qabel ma jaslu riżervazzjonijiet ġodda fil-perjodu ta' fatturazzjoni li ġej.",
                "Iġġenera l-istatement tas-sid għall-perjodu u iċċekkja li l-kummissjoni tintwera korrettament għal kull riżervazzjoni.",
                "Iċċekkja li s-somma tad-dħul gross, il-kummissjoni mnaqqsa u l-ħlas nett tkun raġonevoli.",
                "Iċċara diskrepanzi direttament mas-sid qabel tirrilaxxa l-istatement, minflok ma tibdel l-istatement aktar tard.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bidla aktar tard fir-rata tal-kummissjoni tapplika biss għal perjodi futuri, mhux b'mod retroattiv għal statements diġà ġġenerati. Għalhekk iċċekkja r-rata fil-ħin qabel il-bidu ta' perjodu ta' fatturazzjoni ġdid — ara wkoll [Fatturazzjoni tas-Sid (Statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
