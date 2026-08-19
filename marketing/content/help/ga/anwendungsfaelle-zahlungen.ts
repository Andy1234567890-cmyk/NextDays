import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Íocaíochtaí",
  description: "Íocaíochtaí a láimhseáil i gceart.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Íocaíochtaí",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Éarlais a shocrú",
          excerpt: "Mar seo nach n-iarrann tú ach méid páirteach tráth na háirithinte seachas an tsuim iomlán.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "In áit an méid iomlán áirithinte a bhailiú láithreach, is féidir leat éarlais a shocrú mar riail íocaíochta. Íocann an t-aoi méid páirteach amháin tráth na háirithinte trí Stripe nó PayPal, an fuílleach ina dhiaidh sin trí iarmhéid.",
            },
            {
              type: "steps",
              items: [
                "Oscail sa mhaoin an rannóg „Rialacha Íocaíochta“.",
                "Cruthaigh riail nua de chineál „Éarlais“.",
                "Socraigh méid na héarlaise mar chéatadán nó méid seasta den tsuim iomlán.",
                "Socraigh cathain a bhíonn an éarlais dlite, de ghnáth go díreach tráth na háirithinte.",
                "Sábháil an riail agus seiceáil í ar áirithint thástála.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Próiseáiltear an éarlais tríd an soláthraí íocaíochta atá curtha isteach ar an maoin. Socraigh an méid cuí don iarmhéid in [An t-Iarmhéid a uathoibriú](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "An t-Iarmhéid a uathoibriú",
          excerpt: "Mar seo a bhailítear an fuílleach oscailte go huathoibríoch roimh theacht.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Tar éis éarlais, fanann fuílleach oscailte. In áit é seo a rianú de láimh, socraíonn tú riail íocaíochta a bhailíonn an t-iarmhéid go huathoibríoch ag am seasta roimh theacht trí Stripe nó PayPal.",
            },
            {
              type: "steps",
              items: [
                "Oscail sa mhaoin an rannóg „Rialacha Íocaíochta“.",
                "Cruthaigh riail nua de chineál „Iarmhéid“, ar an gcoinníoll go bhfuil riail éarlaise ann cheana.",
                "Socraigh cé mhéad lá roimh theacht a bhíonn an t-iarmhéid dlite.",
                "Gníomhachtaigh an bailiú uathoibríoch, ionas go mbaineann an soláthraí íocaíochta atá curtha isteach an méid as go neamhspleách.",
                "Seiceáil stádas an iarmhéid ina dhiaidh sin in amlíne na háirithinte faoi seach.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Má theipeann ar an mbailiú uathoibríoch, mar gheall ar chárta as feidhm, mar shampla, ní chealaítear an áirithint go huathoibríoch. Seiceáil iarmhéideanna teipthe go tapa agus déan teagmháil dhíreach leis an aoi.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Aisíocaíocht a dhéanamh",
          excerpt: "Mar seo a aisíocann tú méid go hiomlán nó go páirteach chuig aoi.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "I gcás cealaithe nó gearáin, is féidir leat an méid a íocadh a aisíoc go hiomlán nó go páirteach chuig an aoi. Ritheann an aisíocaíocht tríd an soláthraí íocaíochta céanna trínar íocadh ar dtús — Stripe nó PayPal.",
            },
            {
              type: "steps",
              items: [
                "Oscail an áirithint lena mbaineann in amlíne na háirithinte.",
                "Roghnaigh sa rannóg „Íocaíochtaí“ an íocaíocht bhunaidh atá le haisíoc.",
                "Roghnaigh idir aisíocaíocht iomlán nó pháirteach.",
                "Cuir isteach an méid atá uait i gcás aisíocaíochta páirtí.",
                "Deimhnigh an aisíocaíocht agus seiceáil an stádas íocaíochta nuashonraithe san amlíne.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ní athraíonn aisíocaíocht aon rud go huathoibríoch ar stádas na háirithinte ná ar na hoícheanta féilire atá curtha in áirithe. I gcás cealaithe, seiceáil freisin an gá na hoícheanta lena mbaineann a scaoileadh saor arís sa phlean áitíochta.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Éarlais Slándála a bhainistiú",
          excerpt: "Mar seo a shocraíonn tú éarlais slándála agus a scaoileann tú saor arís í tar éis an fhanachta.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Cosnaíonn éarlais slándála thú i gcoinne damáiste le linn an fhanachta. Cuirtear isteach í mar riail íocaíochta dá cuid féin agus déantar í a údarú roimh ré nó a bhailiú trí Stripe nó PayPal, ag brath ar chumraíocht na maoine.",
            },
            {
              type: "steps",
              items: [
                "Oscail sa mhaoin an rannóg „Rialacha Íocaíochta“ agus cruthaigh riail de chineál „Éarlais Slándála“.",
                "Socraigh méid na héarlaise slándála agus am an údaraithe, gearr roimh theacht de ghnáth.",
                "Seiceáil staid na maoine tar éis na seiceála amach.",
                "Scaoil saor an éarlais slándála go hiomlán tríd an áirithint más gan mháchaint í an staid.",
                "In gcás damáiste, aisíoc ach an chuid nach dteastaíonn, agus doiciméadaigh an chúis leis an gcoinneáil siar.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rachaidh éarlais slándála atá údaraithe ach nár bailíodh in éag go huathoibríoch tar éis tréimhse áirithe, ag brath ar an soláthraí íocaíochta. Scaoil an éarlais slándála go tapa tar éis na seiceála amach nó bailigh an méid atá uait in am.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Sonrasc a cheartú",
          excerpt: "Mar seo a cheartaíonn tú sonrasc atá eisithe cheana ina dhiaidh sin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Má tá earráid ar sonrasc atá eisithe cheana, sa seoladh sonraisc nó i mír amháin, mar shampla, ceartaigh é tríd an áirithint seachas an sonrasc bunaidh a scriosadh go simplí.",
            },
            {
              type: "steps",
              items: [
                "Oscail an áirithint lena mbaineann in amlíne na háirithinte agus téigh go dtí an rannóg „Sonraisc“.",
                "Roghnaigh an sonrasc lochtach.",
                "Cruthaigh ceartúchán nó sonrasc chealaithe don sonrasc bunaidh.",
                "Cruthaigh sonrasc ceartaithe nua ina dhiaidh sin leis na sonraí cearta.",
                "Seol an sonrasc ceartaithe arís chuig an aoi nó chuig an seoladh sonraisc.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Níor cheart sonrasc atá seolta cheana a scríobh thar go díreach ar mhaithe le hinrianaitheacht. Coinníonn an ceartúchán trí shonrasc chealaithe an doiciméad bunaidh agus déanann sé an t-athrú inrianaithe.",
            },
          ],
        },
      ],
    },
  ],
};
