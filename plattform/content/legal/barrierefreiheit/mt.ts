import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Dikjarazzjoni dwar l-aċċessibbiltà",
  stand: "Aġġornat: 18 ta' Awwissu 2026",
  intro: [
    "myBestDays għandu jkun jista' jintuża minn kulħadd. Din id-dikjarazzjoni tiddeskrivi l-istat tal-aċċessibbiltà tal-Pjattaforma, il-limitazzjonijiet magħrufa u t-triq biex tirrapportalna ostakli.",
    "Hija tirreferi għar-rekwiżiti tad-Direttiva (UE) 2019/882 dwar ir-rekwiżiti ta' aċċessibbiltà għall-prodotti u għas-servizzi, li mit-28 ta' Ġunju 2025 tapplika għas-servizzi tal-kummerċ elettroniku.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. L-istat tal-aċċessibbiltà",
      paragraphs: [
        "Nirreferu għall-istandard armonizzat EN 301 549 u għal-Linji Gwida għall-Aċċessibbiltà tal-Kontenut tal-Web (WCAG) 2.1 li fuqhom huwa bbażat, fil-livell ta' konformità AA.",
        "Huma implimentati fost oħrajn: operabbiltà kontinwa bit-tastiera, fokus viżibbli, struttura semantika tat-titli, tikketti f'kull kaxxa ta' formola, alternattivi testwali għall-elementi ta' kontroll, kuntrast tal-kuluri suffiċjenti, skalabbiltà tat-test mingħajr telf ta' kontenut kif ukoll preżentazzjoni li tadatta ruħha għad-daqs tal-iskrin.",
        "It-testi legali huma disponibbli fl-24 lingwa uffiċjali kollha tal-Unjoni u b'immarkar lingwistiku korrett, biex il-qarrejja tal-iskrin jaqrawhom sew.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Limitazzjonijiet magħrufa",
      paragraphs: ["Bħalissa mhumiex aċċessibbli b'mod partikolari:"],
      list: [
        "Ir-ritratti u d-deskrizzjonijiet fir-reklami ġejjin mingħand fornituri; l-alternattivi testwali għar-ritratti jistgħu jkunu nieqsa jew insuffiċjenti. Nistiednu lill-fornituri jikkompletawhom.",
        "Ir-rappreżentazzjonijiet ta' mapep ta' terzi inkorporati jistgħu jitħaddmu bit-tastiera b'mod limitat biss. Id-dettalji kollha tal-post huma disponibbli wkoll bħala test.",
        "Id-dokumenti mtella' mill-fornituri (pereżempju regoli tad-dar f'format PDF) mhumiex immarkati b'mod konsistenti b'mod aċċessibbli.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. L-aċċessibbiltà tal-akkomodazzjonijiet",
      paragraphs: [
        "Din id-dikjarazzjoni tikkonċerna l-Pjattaforma, mhux l-akkomodazzjonijiet. Id-dettalji dwar l-aċċessibbiltà strutturali ta' akkomodazzjoni ġejjin mingħand il-fornitur.",
        "Jekk tiddependi fuq karatteristiċi speċifiċi — aċċess mingħajr tarġiet, wisa' tal-bibien, doċċa fil-livell tal-art, lift —, iċċarahom qabel l-ibbukkjar mal-fornitur permezz tal-funzjoni tal-messaġġi. Dettalji mhux korretti dwar l-aċċessibbiltà huma ksur tar-regoli tagħna u jistgħu jiġu rrapportati.",
      ],
    },
    {
      id: "melden",
      heading: "4. Rapportar ta' ostakli",
      paragraphs: [
        `Jekk tiltaqa' ma' ostaklu, irrapportahulna fuq ${ANBIETER.email} jew permezz tal-mezzi ta' kuntatt fit-taqsima [Ilmenti u riżoluzzjoni ta' tilwim](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Jekk jogħġbok iddeskrivi liema paġna hija kkonċernata, x'ridt tagħmel u liema għajnuniet tuża. Nikkonfermaw l-irċevuta u ngħidulek kif u sa meta se nneħħu l-ostaklu.",
        "Jekk teħtieġ informazzjoni f'format aċċessibbli, nipprovduhielek fuq talba.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Proċedura ta' infurzar",
      paragraphs: [
        "Jekk mhux sodisfatt bit-tweġiba tagħna, tista' tirrikorri għall-korp kompetenti għas-sorveljanza tas-suq skont id-Direttiva (UE) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (qabel Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Id-Danimarka",
        "Telefown: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
