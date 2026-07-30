import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Úinéirí & Ráitis",
  description: "Cuntais úinéara, ráitis agus coimisiúin.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Úinéirí",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Úinéir a chruthú",
          excerpt: "Mar seo a chruthaíonn tú cuntas úinéara nua i myNextDays.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is cuntais ar leith i myNextDays iad úinéirí trína mbainistíonn tú maoine atá ag duine nó cuideachta áirithe. Faigheann cuntas úinéara rochtain teoranta, léamh amháin, ar a chuid maoine féin, gan aon athrú a dhéanamh ar an ngnó féin.",
            },
            { type: "h2", text: "Cuntas úinéara nua a chruthú" },
            {
              type: "steps",
              items: [
                "Oscail an rannóg „Úinéirí“ sa phríomhroghchlár.",
                "Cliceáil ar „Úinéir Nua a chruthú“.",
                "Cuir isteach ainm, seoladh ríomhphoist agus sonraí teagmhála.",
                "Cuir isteach an seoladh sonraisc le haghaidh ráiteas más gá.",
                "Sábháil an cuntas.",
              ],
            },
            { type: "h2", text: "Rochtain a shocrú" },
            {
              type: "p",
              text: "Tar éis é a chruthú, is féidir leat cuireadh a sheoladh chuig an úinéir dá rochtain féin. Logálann an t-úinéir isteach ansin lena chuid sonraí féin agus ní fheiceann sé ach na maoine atá sannta dó.",
            },
            {
              type: "ul",
              items: [
                "Is féidir le cuntas úinéara roinnt maoine a chlúdach.",
                "Baineann gach maoin le húinéir amháin go beacht.",
                "Is féidir sonraí teagmhála agus seoladh sonraisc a chur in oiriúint ag am ar bith ina dhiaidh sin.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Léigh conas maoin atá ann cheana a shannadh d'úinéir in [Maoin a shannadh d'úinéir](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Maoin a shannadh d'úinéir",
          excerpt: "Baineann gach maoin le húinéir amháin go beacht — mar seo a shocraíonn tú an sannadh.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "I myNextDays, baineann gach maoin le húinéir amháin go beacht. Níl ilshannadh i gceist — más mian leat maoin a bheith ag úinéir eile, bris an sannadh atá ann cheana ar dtús sula socraíonn tú ceann nua.",
            },
            { type: "h2", text: "An sannadh a dhéanamh" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi „Maoine“.",
                "Téigh go dtí an cluaisín „Úinéir“.",
                "Roghnaigh an t-úinéir freagrach ón liosta.",
                "Deimhnigh an sannadh.",
                "Sábháil an t-athrú ar an maoin.",
              ],
            },
            { type: "h2", text: "Athrú úinéara" },
            {
              type: "p",
              text: "Má athraíonn úinéir maoine, mar gheall ar dhíolachán, mar shampla, cuir an sannadh atá ann cheana in ionad an cheann nua. Fanann ráitis a cruthaíodh cheana do thréimhsí thart sannta don úinéir bunaidh.",
            },
            {
              type: "ul",
              items: [
                "Ní féidir maoin a bheith sannta ach d'úinéir amháin ag am ar bith.",
                "Gan sannadh, ní fheictear an mhaoin in aon rochtain úinéara.",
                "Fanann ráitis chaite ag an úinéir bunaidh.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Tá ilshannadh maoine do roinnt úinéirí dorochtana — ní cheadaíonn an córas dara sannadh comhuaineach.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Ráiteas Úinéara",
          excerpt: "Mar seo a chruthaíonn tú ráiteas le hioncam lúide coimisiún d'úinéir.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cuireann ráiteas an úinéara, ar a dtugtar Statement freisin, gach ioncam de na maoine sannta le chéile do thréimhse roghnaithe agus asbhaineann sé do choimisiún comhaontaithe. Is é an toradh an méid a íocann tú amach don úinéir.",
            },
            { type: "h2", text: "Ráiteas a chruthú" },
            {
              type: "steps",
              items: [
                "Oscail an rannóg „Úinéirí“ agus roghnaigh an t-úinéir atá uait.",
                "Téigh go dtí an cluaisín „Ráiteas“.",
                "Roghnaigh an tréimhse billeála.",
                "Seiceáil na háirithintí agus an t-ioncam liostaithe de réir maoine.",
                "Cruthaigh an ráiteas leis an gcoimisiún asbhainte.",
              ],
            },
            { type: "h2", text: "Struchtúr an ráitis" },
            {
              type: "p",
              text: "Liostaíonn ráiteas de réir maoine an t-ioncam comhlán ó áirithintí, an coimisiún asbhainte agus an méid íocaíochta amach a thagann as sin. Is féidir costais bhreise ar nós glanadh nó táillí a thaispeáint ar leith, ag brath ar an gcomhaontú.",
            },
            {
              type: "ul",
              items: [
                "Ioncam comhlán: suim gach áirithinte sa tréimhse de réir maoine.",
                "Coimisiún: an sciar atá comhaontaithe agat, asbhainte ón ioncam.",
                "Méid íocaíochta amach: ioncam lúide coimisiún agus míreanna breise más ann dóibh.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Taispeántar méideanna sa ráiteas i gcónaí in airgeadra na maoine — níl aon airgeadra réamhshocraithe uilíoch ann.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Cruthaigh ráitis go rialta ar an dáta céanna, ionas go mbeidh rithim iontaofa ag úinéirí dá n-íocaíochtaí amach.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Rochtain Úinéara",
          excerpt: "Cad is féidir le húinéirí a fheiceáil ina rochtain léamh amháin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is logáil isteach ar leith, léamh amháin, í rochtain úinéara le haghaidh myNextDays. Ní fheiceann úinéirí ann ach na maoine atá sannta dóibh chomh maith leis na hóstáin agus na ráitis a bhaineann leo — gan aon deis socruithe a athrú iad féin.",
            },
            { type: "h2", text: "Cad a fheiceann úinéirí" },
            {
              type: "ul",
              items: [
                "Féilire áitíochta a gcuid maoine féin.",
                "Ráitis chruthaithe le hioncam agus coimisiún asbhainte.",
                "Bunsonraí a gcuid maoine, áiseanna agus cur síos, mar shampla.",
              ],
            },
            { type: "h2", text: "Rochtain a ghníomhachtú" },
            {
              type: "steps",
              items: [
                "Oscail an t-úinéir faoi „Úinéirí“.",
                "Cliceáil ar „Cuireadh chuig rochtain“.",
                "Faigheann an t-úinéir ríomhphost chun a phasfhocal féin a shocrú.",
                "Tar éis logáil isteach, ní fheiceann an t-úinéir go huathoibríoch ach a chuid maoine féin.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Tá rochtain úinéara léamh amháin go docht: ní féidir ach leatsa mar ghnó praghsanna, infhaighteacht nó sonraí maoine a athrú, ní leis an úinéir féin.",
            },
            {
              type: "note",
              variant: "info",
              text: "Tuilleadh eolais faoi shannadh maoine le fáil in [Maoin a shannadh d'úinéir](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
