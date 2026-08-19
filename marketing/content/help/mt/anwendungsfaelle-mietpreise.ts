import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Prezzijiet tal-Kera",
  description: "Iddefinixxi l-prezzijiet tal-kera b'mod ottimali.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Prezzijiet tal-Kera",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Ottimizza l-Prezzijiet għall-Istaġun Għoli",
          excerpt: "Hekk togħla l-prezzijiet tiegħek b'mod immirat għal perjodi ta' domanda għolja.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Fl-istaġun għoli, id-domanda tiżdied b'mod sinifikanti, filwaqt li l-prezz bażiku tiegħek jibqa' l-istess bħall-bqija tas-sena. Mingħajr aġġustament staġonali, titlef dħul fl-aktar żmien qawwi tas-sena — l-aġġustament isir permezz tal-pjan tar-rata tal-proprjetà tiegħek, mhux billi tissostitwixxi manwalment ġranet individwali.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-pjan tar-rata tal-proprjetà affettwata u oħloq regola staġonali għall-perjodu mixtieq.",
                "Issettja ż-żieda bħala valur perċentwali jew ammont fiss fuq il-prezz bażiku — il-pjan tar-rata jaqbad awtomatikament il-munita tal-proprjetà.",
                "Iċċekkja fil-kalendarju li l-prezz il-ġdid għall-perjodu tal-istaġun għoli jintwera korrettament qabel ma tattivah.",
                "Iċċekkja s-soġġorn minimu għall-istaġun għoli — ta' spiss dewmien minimu ta' prenotazzjoni ogħla huwa sensibbli biex l-okkupazzjoni tibqa' ppjanabbli.",
                "Wara l-attivazzjoni, osserva s-sitwazzjoni tal-prenotazzjonijiet fl-ewwel ġranet u aġġusta ż-żieda jekk meħtieġ.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Regola staġonali tapplika bl-istess mod fuq il-portali, il-pjattaforma u l-websajt madwar il-kanali kollha. Dettalji dwar l-istruttura tar-regoli ssibhom taħt [Pjani tar-Rata](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Ippromwovi Soġġorni Itwal b'Skont",
          excerpt: "Hekk tippremja lill-mistiedna b'soġġorn itwal u tnaqqas l-isforz ta' bdil.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Soġġorni qosra jfissru aktar waslet u tluq, aktar tindif u riskju akbar ta' vaganza bejn il-prenotazzjonijiet. Skont fuq is-soġġorn imqassam f'livelli jagħmel prenotazzjonijiet itwal aktar attraenti għall-mistiedna u jnaqqas dan l-isforz b'mod notevoli.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-pjan tar-rata tal-proprjetà u oħloq skont fuq is-soġġorn.",
                "Iddefinixxi mill-inqas livell wieħed, pereżempju minn 7 lejliet jew minn 28 lejl, bir-rata ta' skont rispettiva.",
                "Iċċekkja li l-livelli ma jikkoinċidux u li l-iskont japplika biss mid-dewmien minimu rispettiv.",
                "Ittestja fil-kalendarju prenotazzjoni ta' eżempju li taqbeż il-limitu tal-iskont biex tikkonferma l-applikazzjoni korretta.",
                "Attiva l-iskont u osserva l-effett fuq id-dewmien medju tas-soġġorn u l-okkupazzjoni.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L-iskontijiet fuq is-soġġorn jistgħu jiġu kkombinati ma' regoli staġonali — il-pjan tar-rata jikkalkula ż-żewġ aġġustamenti flimkien. Aktar dettalji taħt [Pjani tar-Rata](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
