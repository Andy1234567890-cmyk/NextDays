import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Ráitis Úinéara",
  description: "Ráitis úinéara a chruthú.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Ráitis Úinéara",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Ráiteas úinéara a ghiniúint",
          excerpt: "Mar seo a chruthaíonn tú billeáil shoiléir do thréimhse úinéara.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Má bhainistíonn tú maoine d'úinéirí, teastaíonn forbhreathnú inrianaithe go rialta uathu ar ioncam, coimisiún asbhainte agus íocaíocht amach a gcuid maoine do thréimhse áirithe — cuireann an Ráiteas Úinéara na sonraí seo le chéile go huathoibríoch.",
            },
            {
              type: "steps",
              items: [
                "Oscail sa Chuntas an rannóg Úinéirí agus roghnaigh an t-úinéir lena mbaineann.",
                "Roghnaigh an tréimhse billeála a bhfuil an ráiteas le cruthú di.",
                "Seiceáil go bhfuil gach maoin an úinéara seo sannta i gceart, mar ní théann ach maoine sannta isteach sa ráiteas.",
                "Lig don ráiteas a ghiniúint agus seiceáil na háirithintí liostaithe le haghaidh iomláine.",
                "Cuir an ráiteas ar fáil don úinéir tríd an rochtain úinéara nó easpórtáil é mar dhoiciméad.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Taispeánann an ráiteas gach áirithint le méid in airgeadra na maoine faoi seach — níl aon nóta airgeadra uilíoch ann, mar go bhféadfadh airgeadraí éagsúla a bheith ag roinnt maoine freisin. Tuilleadh eolais faoi shannadh in [Maoin a shannadh d'úinéir](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Coimisiún a shonrascadh leis an úinéir",
          excerpt: "Mar seo a dheimhníonn tú go ríomhtar do choimisiún i gceart as ioncam an úinéara.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Tá do choimisiún as bainistíocht maoine curtha isteach i bplean an úinéara agus asbhaintear go huathoibríoch é ón ioncam comhlán le gach ráiteas. Chun go mbeidh an billeáil ceart, caithfidh an ráta coimisiúin a bheith socraithe i gceart sula dtagann an chéad áirithint sa tréimhse.",
            },
            {
              type: "steps",
              items: [
                "Oscail sa Chuntas plean an úinéara lena mbaineann agus seiceáil an ráta coimisiúin atá curtha isteach.",
                "Cuir an ráta in oiriúint más gá, sula dtagann áirithintí nua sa tréimhse billeála amach romhainn isteach.",
                "Gin an ráiteas úinéara don tréimhse agus seiceáil go dtaispeántar an coimisiún go ceart de réir áirithinte.",
                "Seiceáil an bhfuil suim an ioncaim chomhláin, an choimisiúin asbhainte agus na híocaíochta glan amach réasúnach.",
                "Réitigh mírréireachtaí go díreach leis an úinéir sula ndeimhníonn tú an ráiteas, seachas an ráiteas a athrú ina dhiaidh sin.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ní bhíonn éifeacht ag athrú ar an ráta coimisiúin ach ar thréimhsí amach romhainn, ní siar i leith ráitis atá giniúint cheana. Seiceáil an ráta in am roimh thús tréimhse billeála nua — féach freisin [Ráiteas Úinéara](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
