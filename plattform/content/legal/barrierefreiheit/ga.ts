import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ráiteas inrochtaineachta",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Ba cheart go mbeadh myBestDays inúsáidte ag gach duine. Cuireann an ráiteas seo síos ar staid inrochtaineachta an Ardáin, ar na teorainneacha atá ar eolas againn agus ar an mbealach chun bacanna a thuairisciú dúinn.",
    "Baineann sé le ceanglais Threoir (AE) 2019/882 maidir le ceanglais inrochtaineachta do tháirgí agus do sheirbhísí, atá i bhfeidhm ó 28 Meitheamh 2025 do sheirbhísí ríomhthráchtála.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Staid na hinrochtaineachta",
      paragraphs: [
        "Táimid ag díriú ar an gcaighdeán comhchuibhithe EN 301 549 agus ar na Treoirlínte um Inrochtaineacht Ábhair Ghréasáin (WCAG) 2.1 ar leibhéal comhréireachta AA atá mar bhonn leis.",
        "Tá na nithe seo a leanas curtha i bhfeidhm, i measc nithe eile: oibriú iomlán leis an méarchlár, fócas infheicthe, struchtúr séimeantach ceannteideal, lipéid ar gach réimse foirme, malairtí téacs do rialtáin, codarsnacht dhathanna leordhóthanach, inscálaitheacht an téacs gan cailliúint ábhair, agus cur i láthair a chuireann é féin in oiriúint do mhéid an scáileáin.",
        "Tá na téacsanna dlíthiúla ar fáil i ngach ceann de 24 theanga oifigiúla an Aontais agus tá an teanga cheart marcáilte iontu, ionas go léifidh léitheoirí scáileáin i gceart iad.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Teorainneacha ar eolas",
      paragraphs: [
        "Níl na nithe seo a leanas inrochtana faoi láthair go háirithe:",
      ],
      list: [
        "is ó sholáthraithe a thagann na grianghraif agus na cur síos sna fógraí; is féidir go bhfuil na malairtí téacs ar iarraidh nó easnamhach. Iarraimid ar sholáthraithe iad a chur leis.",
        "níl na léarscáileanna leabaithe ó thríú páirtithe inoibrithe ach go teoranta leis an méarchlár. Tá gach sonra suímh ar fáil mar théacs freisin.",
        "níl na doiciméid a chuireann soláthraithe suas (rialacha tí mar PDF, mar shampla) marcáilte go hiomlán inrochtana.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Inrochtaineacht na lóistíní",
      paragraphs: [
        "Baineann an ráiteas seo leis an Ardán, ní leis na lóistíní. Is ón soláthraí a thagann na sonraí faoi inrochtaineacht fhisiciúil lóistín.",
        "Má tá tréithe áirithe ag teastáil uait — rochtain gan chéimeanna, leithead na ndoirse, cithfholcadán ar leibhéal an urláir, ardaitheoir — soiléirigh iad leis an soláthraí tríd an tseirbhís teachtaireachtaí roimh an áirithint. Is sárú ar ár mbeartais é sonraí míchearta faoin inrochtaineacht agus is féidir iad a thuairisciú.",
      ],
    },
    {
      id: "melden",
      heading: "4. Bacanna a thuairisciú",
      paragraphs: [
        `Má thagann tú ar bhac, cuir in iúl dúinn é ag ${ANBIETER.email} nó trí na bealaí teagmhála faoi [Ghearáin agus réiteach díospóidí](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Déan cur síos ar an leathanach atá i gceist, ar an méid a bhí á dhéanamh agat agus ar na huirlisí cúnta a úsáideann tú. Deimhnímid an tuairisc a fháil agus cuirimid in iúl duit conas agus cathain a réiteoimid an bac.",
        "Má theastaíonn faisnéis uait i bhfoirm inrochtana, cuirimid ar fáil duit í ar iarratas.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Nós imeachta forfheidhmithe",
      paragraphs: [
        "Mura bhfuil tú sásta lenár bhfreagra, is féidir leat dul chuig an gcomhlacht atá freagrach as faireachas margaidh faoi Threoir (AE) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (Sikkerhedsstyrelsen roimhe seo), Esbjerg Brygge 30, 6700 Esbjerg, An Danmhairg",
        "Teileafón: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
