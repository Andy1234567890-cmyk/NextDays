import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Ħlasijiet",
  description: "Ipproċessa l-ħlasijiet korrettament.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Ħlasijiet",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Ikkonfigura Depożitu",
          excerpt: "Hekk titlob ammont parzjali biss mal-prenotazzjoni minflok is-somma sħiħa.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Minflok tiġbor l-ammont sħiħ tal-prenotazzjoni minnufih, tista' tiddefinixxi depożitu bħala regola tal-ħlas. Il-mistieden iħallas mal-prenotazzjoni biss ammont parzjali permezz ta' Stripe jew PayPal, il-bqija aktar tard permezz ta' bilanċ finali.",
            },
            {
              type: "steps",
              items: [
                "Fil-proprjetà, iftaħ it-taqsima “Regoli tal-Ħlas”.",
                "Oħloq regola ġdida tat-tip “Depożitu”.",
                "Iddetermina l-ammont tad-depożitu bħala perċentwal jew ammont fiss tas-somma totali.",
                "Iddefinixxi meta d-depożitu jsir dovut, normalment immedjatament mal-prenotazzjoni.",
                "Issejvja r-regola u ittestjaha b'prenotazzjoni ta' prova.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Id-depożitu jiġi pproċessat permezz tal-fornitur tal-ħlas irreġistrat mal-proprjetà. Tikkonfigura l-ammont xieraq għas-somma li fadal taħt [Awtomatizza l-Bilanċ Finali](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Awtomatizza l-Bilanċ Finali",
          excerpt: "Hekk l-ammont li fadal jinġabar awtomatikament qabel il-wasla.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Wara depożitu, jibqa' ammont miftuħ. Minflok issegwih manwalment, tikkonfigura regola tal-ħlas li tiġbor il-bilanċ finali awtomatikament f'ħin fiss qabel il-wasla permezz ta' Stripe jew PayPal.",
            },
            {
              type: "steps",
              items: [
                "Fil-proprjetà, iftaħ it-taqsima “Regoli tal-Ħlas”.",
                "Oħloq regola ġdida tat-tip “Bilanċ Finali”, sakemm diġà teżisti regola ta' depożitu.",
                "Iddetermina kemm-il ġurnata qabel il-wasla il-bilanċ finali jsir dovut.",
                "Attiva l-ġbir awtomatiku, sabiex il-fornitur tal-ħlas irreġistrat idebita l-ammont waħdu.",
                "Wara dan, iċċekkja l-istatus tal-bilanċ finali fil-linja ta' żmien tal-prenotazzjoni tar-riżervazzjoni rispettiva.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Jekk il-ġbir awtomatiku jfalli, pereżempju minħabba karta skaduta, il-prenotazzjoni ma tiġix ikkanċellata awtomatikament. Iċċekkja l-bilanċi finali falluti malajr u ikkuntattja lill-mistieden direttament.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Wettaq Rifużjoni",
          excerpt: "Hekk tirrifondi lil mistieden ammont sħiħ jew parzjali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "F'każ ta' kanċellazzjoni jew ilment, tista' tirrifondi lil mistieden l-ammont imħallas kompletament jew parzjalment. Ir-rifużjoni ssir permezz tal-istess fornitur tal-ħlas li permezz tiegħu sar il-ħlas oriġinali — Stripe jew PayPal.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-prenotazzjoni affettwata fil-linja ta' żmien tal-prenotazzjoni.",
                "Fit-taqsima “Ħlasijiet”, agħżel il-ħlas oriġinali li għandu jiġi rifużut.",
                "Agħżel bejn rifużjoni sħiħa jew parzjali.",
                "F'każ ta' rifużjoni parzjali, daħħal l-ammont mixtieq.",
                "Ikkonferma r-rifużjoni u iċċekkja l-istatus tal-ħlas aġġornat fil-linja ta' żmien.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Rifużjoni ma tbiddel xejn awtomatikament fl-istatus tal-prenotazzjoni jew fil-lejliet okkupati tal-kalendarju. F'każ ta' kanċellazzjoni, iċċekkja wkoll jekk il-lejliet affettwati jridux jerġgħu jiġu rilaxxati fil-pjan tal-okkupazzjoni.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Immaniġġja Depożitu ta' Sigurtà",
          excerpt: "Hekk tikkonfigura depożitu ta' sigurtà u terġa' tirrilaxxah wara s-soġġorn.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Depożitu ta' sigurtà jipproteġik kontra ħsara matul is-soġġorn. Jiġi rreġistrat bħala regola tal-ħlas tiegħu stess u jew jiġi awtorizzat minn qabel jew jinġabar permezz ta' Stripe jew PayPal, skont il-konfigurazzjoni tal-proprjetà.",
            },
            {
              type: "steps",
              items: [
                "Fil-proprjetà, iftaħ it-taqsima “Regoli tal-Ħlas” u oħloq regola tat-tip “Depożitu ta' Sigurtà”.",
                "Iddetermina l-ammont tad-depożitu ta' sigurtà u l-ħin tal-awtorizzazzjoni, normalment ftit qabel il-wasla.",
                "Wara l-check-out, iċċekkja l-istat tal-proprjetà.",
                "Jekk l-istat ikun perfett, irrilaxxa d-depożitu ta' sigurtà kompletament permezz tal-prenotazzjoni.",
                "F'każ ta' ħsara, irrifondi biss il-parti mhux meħtieġa u iddokumenta r-raġuni għaż-żamma.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Depożitu ta' sigurtà awtorizzat imma mhux miġbur jiskadi awtomatikament wara ċertu limitu taż-żmien, skont il-fornitur tal-ħlas. Irrilaxxa d-depożitu ta' sigurtà malajr wara l-check-out jew iġbor l-ammont meħtieġ fil-ħin.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Ikkoreġi Fattura",
          excerpt: "Hekk tikkoreġi fattura diġà maħruġa aktar tard.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "h2",
              text: "Sitwazzjoni tal-bidu",
            },
            {
              type: "p",
              text: "Jekk fattura diġà maħruġa fiha żball, pereżempju fl-indirizz tal-fatturazzjoni jew f'entrata, ikkoreġiha permezz tal-prenotazzjoni, minflok ma sempliċement tħassar il-fattura oriġinali.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ il-prenotazzjoni affettwata fil-linja ta' żmien tal-prenotazzjoni u aqleb għat-taqsima “Fatturi”.",
                "Agħżel il-fattura żbaljata.",
                "Oħloq fattura ta' korrezzjoni jew ta' kanċellazzjoni għall-fattura oriġinali.",
                "Wara dan, oħloq fattura ġdida u kkoreġuta bid-dettalji korretti.",
                "Erġa' ibgħat il-fattura kkoreġuta lill-mistieden jew lill-indirizz tal-fatturazzjoni.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Fattura diġà mibgħuta m'għandhiex tiġi sostitwita direttament għal raġunijiet ta' traċċabbiltà. Il-korrezzjoni permezz ta' fattura ta' kanċellazzjoni tippreserva d-dokument oriġinali u tagħmel il-bidla traċċabbli.",
            },
          ],
        },
      ],
    },
  ],
};
