import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Faisnéis dlíthiúil",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    `Sonraí faoi sholáthraí an mhargaidh myBestDays. Is í ${ANBIETER.firma} an t-oibreoir; is branda de chuid na cuideachta sin é myBestDays agus ní duine dlítheanach ar leith é.`,
    "Sonraí éigeantacha faoi § 7 den E-handelslov Danmhargach, a thrasuíonn Airteagal 5 de Threoir 2000/31/CE maidir le tráchtáil leictreonach, chomh maith le sonraí faoi Airteagail 11 agus 12 de Rialachán (AE) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Oibreoir an Ardáin",
      paragraphs: [
        `${ANBIETER.firma} — ${ANBIETER.rechtsform}`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}`,
        `Stiúrthóireacht le húdarás ionadaíochta: ${ANBIETER.direktion.join(" agus ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Teagmháil",
      paragraphs: [
        `Ríomhphost: ${ANBIETER.email}`,
        `Teileafón: ${ANBIETER.telefon}`,
        "Le haghaidh ceisteanna faoi áirithint atá ann cheana bain úsáid as an tseirbhís teachtaireachtaí i do chuntas — bíonn an áirithint agus an stair againn ansin cheana; féach [Gearáin agus réiteach díospóidí](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Clár agus cáin bhreisluacha",
      paragraphs: [
        `CVR-nr. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, an Danmhairg.`,
        ...(ANBIETER.ustId
          ? [`Uimhir aitheantais cánach breisluacha: ${ANBIETER.ustId}.`]
          : [
              "Níl uimhir aitheantais cánach breisluacha ann faoi láthair; ní éilíonn § 7 den E-handelslov í a lua ach amháin nuair atá clárú CBL ann.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Pointí teagmhála faoi Rialachán (AE) 2022/2065",
      paragraphs: [
        `Pointe teagmhála aonair d'údaráis faoi Airteagal 11 agus d'úsáideoirí faoi Airteagal 12: ${ANBIETER.email}, tríd an bpost ag an seoladh thuas.`,
        "Is iad Gearmáinis, Danmhairgis agus Béarla teangacha na cumarsáide.",
        "Tá na nósanna imeachta faoin Rialachán sin — ábhar mídhleathach a thuairisciú, cúis a thabhairt le bearta, an nós imeachta gearán — curtha síos faoin [nGníomh um Sheirbhísí Digiteacha](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Údaráis inniúla",
      paragraphs: [
        `Comhordaitheoir seirbhísí digiteacha faoi Airteagal 49 de Rialachán (AE) 2022/2065: ${DSA_KOORDINATOR.name}, ${DSA_KOORDINATOR.land} ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Údarás maoirseachta cosanta sonraí: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, ${AUFSICHTSBEHOERDE.email}.`,
        "Níl aon údarú ar leith ag teastáil sa Danmhairg chun seirbhísí lóistín a idirghabháil; níl aon údarás maoirseachta gairmiúil ann dá bhrí sin.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Réiteach díospóidí tomhaltóirí",
      paragraphs: [
        "Aisghaireadh ardán an Choimisiúin Eorpaigh um réiteach díospóidí ar líne le Rialachán (AE) 2024/3228 agus tá deireadh curtha lena oibriú.",
        "Nílimid faoi oibleagáid ná sásta páirt a ghlacadh i nós imeachta réitigh díospóidí os comhair boird réitigh díospóidí tomhaltóirí.",
        `Beag beann air sin is féidir leat mar thomhaltóir dul chuig an gcomhlacht Danmhargach inniúil: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, ${VERBRAUCHERSCHLICHTUNG.land} ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Má chónaíonn tú i mballstát eile, cabhróidh Ionad Eorpach na dTomhaltóirí i do thír leat.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Nótaí faoi ábhar agus faoi naisc",
      paragraphs: [
        "Is ó na soláthraithe faoi seach a thagann ábhar na bhfógraí. Ní ghlacann myBestDays leis mar a ábhar féin; féach mír A4 de na [Téarmaí úsáide](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Is é oibreoir na leathanach nasctha ó thríú páirtithe atá freagrach as a n-ábhar. Má chuirtear sárú dlí ar ár n-eolas, bainimid an nasc gan mhoill.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Cóipcheart",
      paragraphs: [
        `Tá an t-ábhar, na téacsanna, na grafaicí agus na trádmharcanna ár gcuid féin a fhoilsítear ar an Ardán seo cosanta ag an gcóipcheart agus ag dlí na dtrádmharcanna. Teastaíonn toiliú i scríbhinn roimh ré ó ${ANBIETER.firma} le haghaidh úsáide lasmuigh de na cásanna a cheadaítear le dlí; maidir le trádmharcanna baineann na [Treoirlínte trádmharcanna](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. An dlí is infheidhme",
      paragraphs: [
        `Tá ${ANBIETER.firma} lonnaithe sa Danmhairg agus bunaithe ansin amháin. Baineann dlí na Danmhairge leis an tairiscint ar líne seo dá bhrí sin — fiú don leagan Gaeilge (prionsabal na tíre tionscnaimh faoi Airteagal 3 de Threoir 2000/31/CE). Fanann forálacha éigeantacha um chosaint tomhaltóirí do stáit chónaithe gan athrú.`,
      ],
    },
  ],
};
