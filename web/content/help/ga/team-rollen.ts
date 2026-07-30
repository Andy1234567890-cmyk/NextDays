import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Foireann & Ceadanna",
  description: "Baill foirne, róil agus cearta rochtana.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Rochtain",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Ball foirne a thabhairt cuireadh",
          excerpt: "Mar seo a thugann tú cuireadh do bhaill foirne nua chuig do chuntas myNextDays.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is féidir leat cuireadh a thabhairt do líon ar bith baill foirne chuig do ghnó — don deasc fáilte, don ghlanadh nó don bhainistíocht, mar shampla. Tá gach cuireadh ceangailte le seoladh ríomhphoist agus sannann sé ról seasta láithreach, a chinneann rochtain ar an ngréasán agus san aip myNextDays.",
            },
            { type: "h2", text: "Cuireadh a sheoladh" },
            {
              type: "steps",
              items: [
                "Oscail „Cuntas“ agus téigh go dtí an rannóg „Foireann“.",
                "Cliceáil ar „Ball foirne a thabhairt cuireadh“.",
                "Cuir isteach seoladh ríomhphoist an duine.",
                "Roghnaigh an ról cuí, m.sh. Ball Foirne nó Glanadh.",
                "Deimhnigh an cuireadh.",
              ],
            },
            { type: "h2", text: "Cad a tharlaíonn ina dhiaidh sin" },
            {
              type: "p",
              text: "Faigheann an duine a fuair an cuireadh ríomhphost le nasc chun a phasfhocal féin a shocrú agus logáil isteach. Baineann an logáil isteach leis an deais gréasáin agus leis an aip myNextDays ar an dá bhealach — níl aon chuntas ar leith ann do gach aghaidh úsáide.",
            },
            {
              type: "ul",
              items: [
                "Fanann cuireadh bailí go dtí go nglactar leis nó go dtarraingítear siar é.",
                "Feiceann tú cuirí oscailte sa rannóg „Foireann“ le stádas „Ar feitheamh“.",
                "Is féidir an ról a chur in oiriúint ag am ar bith ina dhiaidh sin.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Léigh cén ról a fheiceann cén réimse in [Róil & Ceadanna](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Sann an ról is cúinge oiriúnach ón tús — is féidir cearta a leathnú níos déanaí ag am ar bith.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Róil & Ceadanna",
          excerpt: "Na cúig ról i myNextDays agus cad is féidir le gach ceann acu a dhéanamh.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Déanann myNextDays idirdhealú idir cúig ról: Riarthóir, Comh-Riarthóir, Ball Foirne, Glanadh agus Úinéir. Cinneann gach ról cé na réimsí atá infheicthe ar an ndeais gréasáin agus san aip myNextDays — cuirtear na cearta i bhfeidhm ar thaobh an fhreastalaí, ní hamháin i bhfolú sa chomhéadan.",
            },
            { type: "h2", text: "Na róil i bhforbhreathnú" },
            {
              type: "ul",
              items: [
                "Riarthóir: rochtain iomlán ar gach réimse, lena n-áirítear airgeadas, díolachán agus bainistíocht foirne.",
                "Comh-Riarthóir: beagnach rochtain iomlán mar an Riarthóir, don dara leibhéal ceannaireachta sa ghnó.",
                "Ball Foirne: rochtain oibríochta ar áirithintí, féilire agus tascanna, gan léargas airgeadais nó díolacháin.",
                "Glanadh: rochtain go heisiach ar thascanna glanta sannta agus sonraí maoine, gan léargas airgeadais nó díolacháin.",
                "Úinéir: léargas cosanta ó athrú ar a chuid maoine féin, gan bainistíocht ar mhaoine daoine eile.",
              ],
            },
            { type: "h2", text: "Ról a shannadh nó a athrú" },
            {
              type: "steps",
              items: [
                "Oscail „Cuntas“ → „Foireann“.",
                "Roghnaigh an ball foirne lena mbaineann ón liosta.",
                "Cliceáil ar „Ról a athrú“.",
                "Roghnaigh an ról nua agus deimhnigh.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ní fheiceann Baill Foirne agus Glanadh aon phraghsanna, ioncam nó cainéil áirithinte de réir bunúsach — baineann an t-eisiamh seo leis an bhfreastalaí féin agus ní féidir dul thairis tríd an gcomhéadan.",
            },
            {
              type: "note",
              variant: "info",
              text: "Forbhreathnú de réir róil le fáil in [Cad a fheiceann cén ról](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Cad a fheiceann cén ról",
          excerpt: "Réimsí agus radharcanna sonracha de réir róil ar an ngréasán agus san aip.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Chomh maith leis na cearta bunúsacha in [Róil & Ceadanna](/hilfe/team-rollen/rollen-berechtigungen), cuidíonn radharc sonrach ar réimsí aonair leat súil chruinn a shocrú agus tú ag oiliúint baill foirne nua.",
            },
            { type: "h2", text: "Féilire & Áirithintí" },
            {
              type: "p",
              text: "Feiceann Riarthóir, Comh-Riarthóir agus Ball Foirne an plean áitíochta iomlán le sonraí aoi agus tascanna. Ní fheiceann Glanadh ach na coinní atá sannta dó, seoladh maoine agus liosta sheiceála san áireamh, ach gan ainmneacha aíonna ná praghsanna. Feiceann Úinéirí an féilire áitíochta ach amháin dá gcuid maoine féin, go léamh amháin.",
            },
            { type: "h2", text: "Airgeadas & Díolachán" },
            {
              type: "ul",
              items: [
                "Ioncam, coimisiúin agus sonraisc: Riarthóir agus Comh-Riarthóir amháin.",
                "Tairseacha (nasc OTA) agus infheictheacht ardáin: Riarthóir agus Comh-Riarthóir amháin.",
                "Ball Foirne agus Glanadh: gan rochtain ar réimsí airgeadais nó díolacháin, ná ar leathanaigh mhionsonraithe.",
              ],
            },
            { type: "h2", text: "Foireann & Socruithe" },
            {
              type: "p",
              text: "Fanann bainistíocht baill foirne, róil agus socruithe cuntais faoi chúram an Riarthóra agus an Chomh-Riarthóra amháin. Ní fheiceann úinéirí ná róil oibríochta an réimse seo san aip myNextDays ná ar an ndeais gréasáin ar chor ar bith.",
            },
            {
              type: "note",
              variant: "info",
              text: "Baineann an foroinnt seo mar an gcéanna leis an ndeais gréasáin agus leis an aip myNextDays, mar iarrann an dá aghaidh úsáide an ról céanna as do chuntas.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tástáil róil nua go gairid le chéile leis an mball foirne tar éis an chuiridh, chun mí-thuiscintí faoi réimsí infheicthe a sheachaint.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Rochtain a bhaint",
          excerpt: "Rochtain baill foirne a bhaint go láithreach agus go hiomlán.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Má fhágann ball foirne do ghnó, nó má athraíonn an chomhoibriú, bain an rochtain go díreach sa Chuntas. Bíonn éifeacht ag an mbaint ar thaobh an fhreastalaí agus láithreach — ní tar éis seisiún reatha a bheith críochnaithe.",
            },
            { type: "h2", text: "Rochtain a bhaint" },
            {
              type: "steps",
              items: [
                "Oscail „Cuntas“ → „Foireann“.",
                "Roghnaigh an ball foirne lena mbaineann.",
                "Cliceáil ar „Rochtain a bhaint“.",
                "Deimhnigh an próiseas.",
              ],
            },
            { type: "h2", text: "Tionchar ar sheisiúin atá ar siúl" },
            {
              type: "p",
              text: "Tar éis an bhainte, ní féidir leis an duine logáil isteach arís, ná ar an ndeais gréasáin ná san aip myNextDays. Ba cheart duit tascanna nó coinní glanta atá sannta cheana a shannadh do bhall foirne eile roimh ré, ionas nach bhfanann aon rud gan déanamh.",
            },
            {
              type: "ul",
              items: [
                "Sann tascanna oscailte do dhuine eile roimh an mbaint.",
                "Is féidir rochtain a athbhunú níos déanaí trí chuireadh nua.",
                "Ní bhaineann an bhaint ach leis an ngnó seo, ní le cuntais eile an duine.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bain an rochtain go tapa a luaithe a chríochnaíonn comhoibriú — fágann cuntais foirne oscailte riosca slándála gan ghá.",
            },
          ],
        },
      ],
    },
  ],
};
