import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika dwar il-cookies",
  stand: "Aġġornat: 18 ta' Awwissu 2026",
  intro: [
    "Din il-politika tispjega liema cookies u teknoloġiji simili tuża myBestDays, għal xiex, kemm iddumu maħżuna u kif tikkontrollahom.",
    "Hija tikkomplementa l-[Politika ta' privatezza](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. X'inhuma l-cookies",
      paragraphs: [
        "Il-cookies huma fajls żgħar ta' test li sit web jaħżen fil-browser tiegħek. Teknoloġiji simili huma l-ħażna lokali tal-browser u l-pixels ta' traċċar fl-emails.",
        "Il-cookies li huma assolutament meħtieġa għat-tħaddim tal-Pjattaforma nistgħu nqegħduhom mingħajr il-kunsens tiegħek. Għall-oħrajn kollha nitolbu l-kunsens tiegħek (l-Artikolu 5(3) tad-Direttiva 2002/58/KE).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Cookies meħtieġa",
      paragraphs: [
        "Dawn il-cookies huma meħtieġa għat-tħaddim u ma jistgħux jiġu deżattivati. Bħalissa nużaw:",
      ],
      list: [
        "„nd_access“ — iżomm il-login tiegħek. Jinqara biss mis-server (HttpOnly), durata skont il-validità tas-sessjoni.",
        "„nd_refresh“ — iġedded il-login tiegħek, biex ma jkollokx bżonn tidħol kontinwament mill-ġdid. Jinqara biss mis-server, durata 30 jum.",
        "„nd_gast_locale“ — jiftakar il-lingwa magħżula minnek. Durata sena.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Cookies funzjonali, tal-istatistika u tal-marketing",
      paragraphs: [
        "myBestDays bħalissa ma tużax cookies għall-istatistika, għall-kejl tal-firxa jew għar-reklamar u ma tinkorporax netwerks ta' reklamar jew servizzi ta' analiżi.",
        "Jekk dan jinbidel, nitolbu minn qabel il-kunsens tiegħek permezz ta' djalogu ta' għażla li fih ir-rifjut ikun daqstant sempliċi daqs l-aċċettazzjoni, u nikkomplementaw din il-politika bil-cookies konkreti.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Kontenut inkorporat ta' terzi",
      paragraphs: [
        "Fuq paġni ta' dettall jistgħu jkunu inkorporati mapep. Tali kontenut ngħabbuh biss meta tattivah espressament; biss imbagħad jistgħu jiġu trasmessi data lill-fornitur ikkonċernat.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Kif tikkontrolla l-cookies",
      paragraphs: [
        "Il-kunsens tiegħek tista' tbiddlu jew tirtirah f'kull ħin permezz tal-issettjar tal-cookies fil-qiegħ tal-paġna.",
        "Barra minn hekk tista' tħassar jew timblokka l-cookies fil-browser tiegħek. Jekk tħassar il-cookies meħtieġa, tiġi żgassat u l-Pjattaforma taħdem b'mod limitat.",
      ],
    },
  ],
};
