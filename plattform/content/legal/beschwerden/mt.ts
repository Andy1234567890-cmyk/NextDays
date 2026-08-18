import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ilmenti u riżoluzzjoni ta' tilwim",
  stand: "Aġġornat: 18 ta' Awwissu 2026",
  intro: [
    "Din il-paġna tiddeskrivi kif tilħaq lil myBestDays, kif nittrattaw l-ilmenti u liema toroq ikollok miftuħa jekk ma taqbilx mad-deċiżjoni tagħna.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Kif tilħaqna",
      paragraphs: [
        "L-iktar malajr tilħaqna permezz taċ-ċentru ta' għajnuna u l-mezzi ta' kuntatt indikati hemm. Għal ibbukkjar eżistenti uża l-funzjoni tal-messaġġi fil-kont tiegħek — hekk ikollna diġà l-ibbukkjar u l-istorja.",
        `Bil-miktub tilħaqna fuq ${ANBIETER.email} jew ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, id-Danimarka; bit-telefown fuq ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. X'għandu jkun fih l-ilment tiegħek",
      paragraphs: ["Biex inkunu nistgħu ngħinu malajr, jekk jogħġbok indika:"],
      list: [
        "in-numru tal-ibbukkjar tiegħek u l-indirizz tal-email użat għall-ibbukkjar;",
        "deskrizzjoni qasira tal-problema;",
        "liema soluzzjoni tixtieq;",
        "il-provi relatati — ritratti, messaġġi, irċevuti, estratti tal-kont.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Kif nittrattaw",
      paragraphs: [
        "Kull ilment jiġi rreġistrat u jirċievi numru ta' każ li bih tista' ssegwi l-istat.",
        "Nikkonfermaw l-irċevuta mingħajr dewmien u nwieġbu fis-sustanza bħala regola fi żmien sebat ijiem. Jekk ikun meħtieġ eżami itwal, ngħidulek l-istat intermedju.",
        "L-ilmenti li fihom persuni jkunu f'periklu jew fejn wasla tkun imminenti nittrattawhom bi prijorità.",
        "Id-deċiżjoni tagħna nimmotivawha u nsemmu l-bażi li fuqha tistrieħ.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Ilment kontra miżura tagħna",
      paragraphs: [
        "Jekk neħħejna kontenut, illimitajna l-viżibbiltà tiegħu, ikkanċellajna ibbukkjar jew imblukkajna kont, tista' tressaq kontra dan ilment bla ħlas fi żmien sitt xhur. Dan jikkorrispondi għall-Artikolu 20 tar-Regolament (UE) 2022/2065.",
        "L-ilment jiġi eżaminat minn bnedmin, mhux esklużivament minn proċeduri awtomatizzati. Jekk jirriżulta fondat, nirtiraw il-miżura.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Riżoluzzjoni extraġudizzjarja ta' tilwim",
      paragraphs: [
        "Il-pjattaforma tal-Kummissjoni Ewropea għar-riżoluzzjoni online tat-tilwim ġiet imħassra bir-Regolament (UE) 2024/3228 u waqfet topera. Permezz tagħha ma jistgħux jitressqu iktar ilmenti.",
        "M'aħniex obbligati u lanqas lesti li nipparteċipaw fi proċedura ta' riżoluzzjoni ta' tilwim quddiem korp ta' riżoluzzjoni alternattiva ta' tilwim tal-konsumaturi.",
        `Indipendentement minn dan, bħala konsumatur tista' tirrikorri għall-korp Daniż kompetenti: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, id-Danimarka ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Jekk tgħix fi Stat Membru ieħor, jgħinek iċ-Ċentru Ewropew tal-Konsumaturi ta' pajjiżek.`,
        "Jekk it-tilwima tikkonċerna miżura li ħadna kontra l-kontenut jew il-kont tiegħek, tista' barra minn hekk tirrikorri għal korp ta' riżoluzzjoni extraġudizzjarja ta' tilwim iċċertifikat skont l-Artikolu 21 tar-Regolament (UE) 2022/2065. Id-deċiżjonijiet tiegħu mhumiex vinkolanti għalina u m'aħniex obbligati nipparteċipaw f'tali proċeduri.",
      ],
    },
    {
      id: "gericht",
      heading: "6. It-triq ġudizzjarja",
      paragraphs: [
        "It-triq lejn il-qrati hija miftuħa għalik f'kull ħin, anke mingħajr proċedura ta' lment minn qabel. Liema qrati huma kompetenti huwa indikat fit-taqsima A19 tat-[Termini tal-użu](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Ilmenti ta' fornituri",
      paragraphs: [
        "Il-fornituri jistgħu jressqu bl-istess proċedura ilmenti dwar l-applikazzjoni ta' dawn it-termini, dwar deċiżjonijiet ta' klassifikazzjoni u dwar restrizzjonijiet fuq l-offerta tagħhom. Dan jikkorrispondi għall-Artikolu 11 tar-Regolament (UE) 2019/1150.",
        "Dwar in-numru, is-suġġett u t-tul medju tat-trattament ta' tali lmenti nirrapportaw kull sena; ir-rapport huwa disponibbli fit-taqsima [Att dwar is-Servizzi Diġitali](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
