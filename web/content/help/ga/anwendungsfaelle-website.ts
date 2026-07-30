import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Suíomh Gréasáin",
  description: "Do shuíomh gréasáin a úsáid go hoptamach.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Suíomh Gréasáin",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Do shuíomh gréasáin a chur beo",
          excerpt: "Mar seo a fhoilsíonn tú do shuíomh gréasáin féin mar chainéal díolacháin neamhspleách.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Is cainéal díolacháin dá chuid féin é do shuíomh gréasáin le hais na dtairseach agus an ardáin. Tógann tú na leathanaigh san eagarthóir, ach ní bhíonn an suíomh gréasáin infheicthe d'aíonna go dtí go bhfoilsíonn tú é, agus is ansin a bhíonn do mhaoine le feiceáil mar iníoctha in áirithe.",
            },
            {
              type: "steps",
              items: [
                "Oscail an tEagarthóir Suímh Ghréasáin agus seiceáil go bhfuil gach leathanach atá uait líonta le hábhar.",
                "Roghnaigh sa chluaisín Maoine, de réir maoine, an mba cheart di a bheith infheicthe ar an suíomh gréasáin — tá an infheictheacht seo neamhspleách ar thairseacha agus ar an ardán.",
                "Deimhnigh an réamhamharc ar an radharc deisce agus soghluaiste sula dtéann tú beo.",
                "Cliceáil ar „Foilsigh“ chun an suíomh gréasáin a ghníomhachtú d'aíonna.",
                "Tar éis an fhoilsithe, seiceáil an URL poiblí agus déan tástáil ar shampla áirithinte tríd an suíomh gréasáin.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Is ais dá cuid féin í infheictheacht suímh ghréasáin maoine — is féidir le maoin a bheith gníomhach ar thairseacha ach folaithe ar an suíomh gréasáin agus a mhalairt. Sonraí in [Fearann féin a shocrú](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Fearann féin a shocrú",
          excerpt: "Mar seo a nascann tú do fhearann féin le do shuíomh gréasáin myNextDays.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Cuireann fearann féin ar nós www.do-ghno.ie i bhfad níos gairmiúla ná seoladh caighdeánach agus neartaíonn sé do bhranda le haíonna ar mian leo áirithint go díreach leat.",
            },
            {
              type: "steps",
              items: [
                "Oscail san Eagarthóir Suímh Ghréasáin an rannóg „Fearann“ agus cuir isteach do fhearann féin atá uait.",
                "Socraigh na hiontrálacha DNS a thaispeántar (CNAME nó A-Record de ghnáth) ag soláthraí do fhearainn.",
                "Fan go dtaispeántar an fearann mar nasctha agus an teastas SSL mar ghníomhach — is féidir go dtógfaidh sé sin cúpla uair an chloig ag brath ar an soláthraí.",
                "Tástáil oscailt an fhearainn féin i bhfuinneog bhrabhsálaí phríobháideach chun iontrálacha caitseáilte sean a eisiamh.",
                "Seiceáil go n-atreoraíonn seansheoltaí caighdeánacha go dtí an fearann nua fós, ionas nach dtéann naisc atá ann cheana in aer.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Athraigh iontrálacha DNS mar a thaispeántar amháin — is féidir le luachanna míchearta socruithe ríomhphoist atá ann cheana do fhearainn a chur trí chéile. Seiceáil le do sholáthraí fearainn más rud é go bhfuil amhras ann, sula scríobhann tú thar iontrálacha atá ann cheana.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Áirithintí díreacha a mhéadú",
          excerpt: "Mar seo a threoraíonn tú níos mó aíonna chuig do shuíomh gréasáin féin seachas chuig tairseacha.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Is minic gur saoire d'áirithintí trí do shuíomh gréasáin féin do do ghnó ná trí thairseacha, mar níl aon choimisiún tairsí i gceist anseo. Le cúpla beart sonrach, méadaíonn tú sciar na n-áirithintí díreacha trí do shuíomh gréasáin mar chainéal neamhspleách.",
            },
            {
              type: "steps",
              items: [
                "Deimhnigh go bhfuil gach maoin inchurtha in áirithe infheicthe ar an suíomh gréasáin agus go bhfuil grianghraif agus cur síos reatha curtha leo.",
                "Socraigh lascaine nó buntáiste eisiach don suíomh gréasáin, laghdú beag ar phraghas le hais tairseach, mar shampla.",
                "Nasc do fhearann féin i ndeimhnithe áirithinte agus i gcumarsáid le haíonna a chuir áirithint in áirithe cheana.",
                "Seiceáil staitisticí na n-áirithintí go rialta chun sciar an tsuímh ghréasáin de gach áirithint a leanúint le himeacht ama.",
                "Optamaigh am luchtaithe agus taispeáint shoghluaiste an tsuímh ghréasáin, mar go n-áirithíonn formhór na n-aíonna trí fhón cliste.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ní oibríonn buntáiste eisiach suímh ghréasáin ach amháin má aimsíonn aíonna an suíomh gréasáin ar chor ar bith — tagair go gníomhach dó seachas a bheith ag brath ar thairseacha amháin. Le haghaidh foilsithe féach [Do shuíomh gréasáin a chur beo](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
