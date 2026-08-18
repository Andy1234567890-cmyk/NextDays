import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Gearáin agus réiteach díospóidí",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Cuireann an leathanach seo síos ar conas a shroicheann tú myBestDays, ar conas a láimhseálaimid gearáin agus ar na bealaí atá oscailte duit mura n-aontaíonn tú lenár gcinneadh.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Conas a shroicheann tú sinn",
      paragraphs: [
        "Is tríd an Ionad cabhrach agus na bealaí teagmhála atá ann is tapúla a shroicheann tú sinn. Maidir le háirithint atá ann cheana bain úsáid as an tseirbhís teachtaireachtaí i do chuntas — bíonn an áirithint agus an stair againn ansin cheana.",
        `I scríbhinn sroicheann tú sinn ag ${ANBIETER.email} nó ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}; ar an teileafón ag ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Cad ba cheart a bheith i do ghearán",
      paragraphs: ["Ionas gur féidir linn cabhrú go tapa, luaigh le do thoil:"],
      list: [
        "uimhir d'áirithinte agus an seoladh ríomhphoist a úsáideadh don áirithint;",
        "cur síos gearr ar an bhfadhb;",
        "an réiteach atá uait;",
        "an cruthúnas a bhaineann leis — grianghraif, teachtaireachtaí, admhálacha, ráitis chuntais.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Conas a láimhseálaimid é",
      paragraphs: [
        "Taifeadtar gach gearán agus faigheann sé uimhir cháis ar féidir leat an staid a leanúint léi.",
        "Deimhnímid an fháil gan mhoill agus freagraímid go hábhartha laistigh de sheacht lá de ghnáth. Má tá scrúdú níos faide ag teastáil, cuirimid an staid eatramhach in iúl duit.",
        "Láimhseálaimid le tosaíocht gearáin ina bhfuil daoine i mbaol nó ina bhfuil teacht go luath.",
        "Tugaimid cúis lenár gcinneadh agus luaimid an bunús atá leis.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Gearán i gcoinne birt uainne",
      paragraphs: [
        "Má bhain muid ábhar, má chuir muid teorainn lena fheiceálacht, má chealaigh muid áirithint nó má bhac muid cuntas, is féidir leat gearán a dhéanamh ina choinne saor in aisce laistigh de shé mhí. Freagraíonn sé sin d'Airteagal 20 de Rialachán (AE) 2022/2065.",
        "Is daoine a scrúdaíonn an gearán, ní nósanna imeachta uathoibrithe amháin. Má léirítear go bhfuil sé bunaithe, tarraingímid an beart siar.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Réiteach díospóidí lasmuigh den chúirt",
      paragraphs: [
        "Aisghaireadh ardán an Choimisiúin Eorpaigh um réiteach díospóidí ar líne (ardán ODR) le Rialachán (AE) 2024/3228 agus tá deireadh curtha lena oibriú. Ní féidir gearáin a chur isteach tríd a thuilleadh.",
        "Nílimid faoi oibleagáid ná sásta páirt a ghlacadh i nós imeachta réitigh díospóidí os comhair boird réitigh díospóidí tomhaltóirí.",
        `Beag beann air sin is féidir leat mar thomhaltóir dul chuig an gcomhlacht Danmhargach inniúil: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, ${VERBRAUCHERSCHLICHTUNG.land} ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Má chónaíonn tú i mballstát eile, cabhróidh Ionad Eorpach na dTomhaltóirí i do thír leat.`,
        "Má bhaineann an díospóid le beart a ghlacamar i gcoinne d'ábhair nó do chuntais, is féidir leat comhlacht réitigh díospóidí lasmuigh den chúirt atá deimhnithe faoi Airteagal 21 de Rialachán (AE) 2022/2065 a ghlaoch chomh maith. Níl a gcinntí ceangailteach orainn, agus nílimid faoi oibleagáid páirt a ghlacadh i nósanna imeachta den sórt sin.",
      ],
    },
    {
      id: "gericht",
      heading: "6. An bealach chun na cúirte",
      paragraphs: [
        "Tá an bealach chun na gcúirteanna oscailte duit am ar bith, fiú gan nós imeachta gearán roimh ré. Tá na cúirteanna atá inniúil luaite i mír A19 de na [Téarmaí úsáide](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Gearáin ó sholáthraithe",
      paragraphs: [
        "Is féidir le soláthraithe gearáin faoi chur i bhfeidhm na gcoinníollacha seo, faoi chinntí rangaithe agus faoi shrianta ar a bhfógra a chur isteach tríd an nós imeachta céanna. Freagraíonn sé sin d'Airteagal 11 de Rialachán (AE) 2019/1150.",
        "Tuairiscímid gach bliain ar líon, ar ábhar agus ar mheánam próiseála na ngearán sin; tá an tuarascáil ar fáil faoin [nGníomh um Sheirbhísí Digiteacha](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
