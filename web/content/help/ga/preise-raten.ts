import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Praghsanna & Rátaí",
  description: "Pleananna rátaí, praghsanna séasúracha agus praghsanna dinimiciúla.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Praghsáil",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Bunphraghas & Airgeadra",
          excerpt: "Mar seo a shocraíonn tú an bunphraghas agus a shannann tú an t-airgeadra ceart do do mhaoin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is aonad inchurtha in áirithe amháin gach maoin i myNextDays — seomra amháin nó maoin saoire. Cuireann tú bunphraghas agus airgeadra lárnach isteach don aonad seo, a bhaineann leis an maoin iomlán.",
            },
            { type: "h2", text: "An t-airgeadra a shocrú go lárnach" },
            {
              type: "p",
              text: "Socraítear airgeadra na maoine uair amháin de réir maoine agus baineann sé go huathoibríoch le gach plean rátaí a chruthaíonn tú don mhaoin sin. Níl aon airgeadra réamhshocraithe malartach ann — mura bhfuil an t-airgeadra ann, ní féidir leat aon phraghas a shábháil.",
            },
            {
              type: "steps",
              items: [
                "Oscail do mhaoin faoi „Maoine“.",
                "Téigh go dtí an cluaisín „Praghsanna“.",
                "Roghnaigh an t-airgeadra cuí faoi „Airgeadra na Maoine“.",
                "Cuir isteach an bunphraghas don acmhainneacht chaighdeánach.",
                "Sábháil na hathruithe.",
              ],
            },
            { type: "h2", text: "Cad a tharlaíonn nuair a athraítear an t-airgeadra" },
            {
              type: "p",
              text: "Má athraíonn tú airgeadra na maoine ina dhiaidh sin, bíonn tionchar aige sin ar gach plean rátaí atá ann cheana don mhaoin seo, mar bíonn siad sin i gcónaí in airgeadra na maoine. Seiceáil do phraghsanna ina dhiaidh sin sula gcuireann tú ar aghaidh iad chuig na tairseacha arís.",
            },
            {
              type: "ul",
              items: [
                "Airgeadra amháin atá ag maoin — ní roinnt éagsúla in aghaidh gach plean rátaí.",
                "Is é an bunphraghas an luach tosaigh do rátaí díorthaithe.",
                "Taispeántar méideanna i gcónaí le hairgeadra socraithe na maoine.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Gan airgeadra socraithe, ní féidir aon phraghas a shábháil ná aon ráta a chur ar aghaidh chuig tairseacha. Seiceáil é seo ar dtús má theipeann athrú praghais.",
            },
            {
              type: "note",
              variant: "info",
              text: "Tuilleadh eolais faoi phraghsanna díorthaithe le fáil in [Rátaí Díorthaithe](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Pleananna Rátaí a chruthú",
          excerpt: "Cuireann pleananna rátaí praghas, coinníollacha cealaithe agus lónadóireacht le chéile do mhaoin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Sainmhíníonn plean rátaí na coinníollacha faoinar féidir maoin a chur in áirithe: praghas, rialacha cealaithe, lónadóireacht agus fanacht íosta. Is féidir le maoin roinnt pleananna rátaí a thairiscint ag an am céanna, plean solúbtha agus plean neamh-inchealaithe, mar shampla.",
            },
            { type: "h2", text: "Plean rátaí nua a chruthú" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin agus téigh go dtí an cluaisín „Praghsanna“.",
                "Cliceáil ar „Plean rátaí nua a chruthú“.",
                "Tabhair ainm soiléir dó, m.sh. „Solúbtha“ nó „Neamh-inchealaithe“.",
                "Socraigh an bhfuil an plean ina bhunráta nó ina ráta díorthaithe.",
                "Cuir isteach coinníollacha cealaithe agus lónadóireacht.",
                "Sábháil agus gníomhachtaigh an plean rátaí.",
              ],
            },
            { type: "h2", text: "Bunráta i gcomparáid le pleananna rátaí eile" },
            {
              type: "p",
              text: "Cruthaigh do bhunráta ar dtús (ar a dtugtar „BAR“ go minic, Best Available Rate). Is féidir gach plean rátaí eile a choinneáil go neamhspleách nó a dhíorthú ón mbunráta seo.",
            },
            {
              type: "ul",
              items: [
                "Bunráta: bunphraghas de láimh in aghaidh na hoíche.",
                "Pleananna rátaí breise: go neamhspleách nó mar bhreis/lascaine ar an mbunráta.",
                "Is féidir gach plean rátaí a chur ar aghaidh chuig tairseacha go haonair.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Coinnigh líon na bpleananna rátaí do gach maoin faoi smacht — cuireann barraíocht athróg deacracht ar aíonna comparáid a dhéanamh agus ardaíonn sé an t-ualach cothabhála.",
            },
            {
              type: "note",
              variant: "info",
              text: "Tuilleadh sonraí faoi bhreiseanna agus lascainí le fáil in [Rátaí Díorthaithe](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Rátaí Díorthaithe",
          excerpt: "Ríomhtar pleananna rátaí díorthaithe go huathoibríoch as bunráta.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is plean rátaí é ráta dhíorthaithe nach gcoinnítear de láimh ach a ríomhtar go huathoibríoch as bunráta — mar bhreis sheasta, lascaine sheasta nó céatadán. Sábhálann sé seo ualach cothabhála, mar go nuashonraítear gach plean díorthaithe go huathoibríoch nuair a athraítear an bunráta.",
            },
            { type: "h2", text: "Sampla tipiciúil" },
            {
              type: "p",
              text: "Patrún coitianta is ea plean le bricfeasta a dhíorthaítear ón mbunráta gan lónadóireacht: sainmhínítear praghas an bhricfeasta mar bhreis in aghaidh na hoíche agus an duine ar an mbunráta. Má athraíonn tú an bunráta, athraíonn praghas an bhricfeasta go huathoibríoch dá réir.",
            },
            { type: "h2", text: "Ráta dhíorthaithe a shocrú" },
            {
              type: "steps",
              items: [
                "Oscail an plean rátaí atá uait sa chluaisín „Praghsanna“.",
                "Roghnaigh „Díorthaithe ó …“ mar fhoinse praghais agus an bunráta comhfhreagrach.",
                "Socraigh an mbaineann an difríocht le méid seasta nó le céatadán.",
                "Socraigh cibé an bhfuil sé ina bhreis nó ina lascaine.",
                "Sábháil an sannadh.",
              ],
            },
            {
              type: "ul",
              items: [
                "Breis: m.sh. lónadóireacht, ceart cealaithe níos deireanaí.",
                "Lascaine: m.sh. plean neamh-inchealaithe le buntáiste praghais.",
                "Fanann an bunráta mar an t-aon fhoinse a choinnítear de láimh.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ní féidir ráta dhíorthaithe a scríobh thar de láimh ag an am céanna. Bris an díorthú ar dtús má tá tú ag iarraidh praghas aonair a shocrú go difriúil.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Praghsanna Séasúracha & Deireadh Seachtaine",
          excerpt: "Praghsanna a chur in oiriúint go sonrach do thréimhsí séasúracha agus deireadh seachtaine.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Athraíonn éileamh i rith na bliana agus laistigh den tseachtain. Le praghsanna séasúracha agus deireadh seachtaine, cuireann tú an bunphraghas in oiriúint do thréimhsí sonracha nó laethanta seachtaine, gan dul isteach san fhéilire do gach lá ar leith.",
            },
            { type: "h2", text: "Tréimhse shéasúrach a chruthú" },
            {
              type: "steps",
              items: [
                "Oscail sa mhaoin an cluaisín „Praghsanna“ agus an rannóg „Praghsanna Séasúracha“.",
                "Cruthaigh tréimhse nua le dáta tosaigh agus deiridh.",
                "Cuir isteach an praghas nó an difríocht chéatadáin ón mbunphraghas don tréimhse seo.",
                "Sábháil an tréimhse shéasúrach.",
              ],
            },
            { type: "h2", text: "Praghsanna deireadh seachtaine" },
            {
              type: "p",
              text: "Ina theannta sin, is féidir leat laethanta seachtaine aonair, Dé hAoine agus Dé Sathairn mar shampla, a chur suas le breis dá gcuid féin. Baineann an bhreis seo leis an bpraghas séasúrach nó bunúsach atá i bhfeidhm ag an am freisin.",
            },
            {
              type: "ul",
              items: [
                "Bíonn éifeacht ag praghsanna séasúracha ar thréimhsí leanúnacha.",
                "Bíonn éifeacht ag praghsanna deireadh seachtaine de réir lá seachtaine, neamhspleách ar an séasúr.",
                "Is féidir an dá riail a chomhcheangal.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Má fhorluíonn roinnt tréimhsí séasúracha, is í an riail a cruthaíodh is déanaí nó is sonraí a bhíonn i bhfeidhm. Seiceáil an féilire tar éis sábháil.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Le haghaidh coigeartuithe uathoibríocha bunaithe ar éileamh, oireann [Praghsanna Dinimiciúla](/hilfe/preise-raten/dynamische-preise) freisin.",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Praghsanna Dinimiciúla",
          excerpt: "Praghsanna a chur in oiriúint go huathoibríoch d'éileamh, do réamhfhógra agus d'áitíocht.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Is breiseán íocaíochta é an praghsáil dhinimiciúil. Cuireann tú in áirithe é faoi “Breiseáin”, áit a bhfuil an praghas luaite freisin. Gan an modúl, ní ríomhann an uathoibriú aon rud.",
            },
            {
              type: "p",
              text: "Cuireann praghsanna dinimiciúla an bunphraghas in oiriúint go huathoibríoch bunaithe ar fhachtóirí ar nós réamhfhógra áirithinte, áitíocht reatha agus éileamh — cosúil leis an mbealach a dhéanann mórthairseacha a moltaí praghais féin. Mar sin freagraíonn tú d'athruithe margaidh gan a bheith ag coigeartú de láimh gach lá.",
            },
            { type: "h2", text: "Praghsanna dinimiciúla a ghníomhachtú" },
            {
              type: "steps",
              items: [
                "Oscail sa mhaoin an cluaisín „Praghsanna“ agus an rannóg „Praghsanna Dinimiciúla“.",
                "Gníomhachtaigh an fheidhm do bhunráta na maoine.",
                "Socraigh íosphraghas agus uasphraghas.",
                "Socraigh cé chomh mór is a fhéadfaidh an áitíocht tionchar a bheith aici ar an bpraghas.",
                "Sábháil na socruithe.",
              ],
            },
            { type: "h2", text: "Teorainneacha & sábháilteacht" },
            {
              type: "p",
              text: "Cosnaíonn an t-íosphraghas agus an t-uasphraghas ar an algartam uathoibríoch praghsanna nach bhfuil inmharthana do do ghnó a shocrú. Leanann pleananna rátaí díorthaithe an bunráta a ríomhtar go dinimiciúil go huathoibríoch.",
            },
            {
              type: "ul",
              items: [
                "Cosnaíonn an t-íosphraghas ar phraghsanna róíseal in am éileamh laga.",
                "Cosnaíonn an t-uasphraghas ar phraghsanna ró-ard le linn éilimh ard.",
                "Glacann rátaí díorthaithe leis an mbunráta nua go huathoibríoch.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ní bhaineann praghsanna dinimiciúla ach leis an mbunráta. Ní athraíonn pleananna rátaí atá socraithe go seasta de láimh gan díorthú go huathoibríoch dá réir.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Lascainí Fanachta",
          excerpt: "Lascainí a shocrú d'fhanacht níos faide agus áirithintí luatha.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Tugann lascainí fanachta luach saothair d'aíonna as áirithintí níos faide nó áirithint luath. Cuirtear i bhfeidhm iad mar chéatadán ar phraghas iomlán an fhanachta agus is féidir iad a chumrú go neamhspleách de réir maoine.",
            },
            { type: "h2", text: "Cineálacha lascaine" },
            {
              type: "ul",
              items: [
                "Lascaine fhadtéarmach: ó líon áirithe oícheanta ar aghaidh, m.sh. ó 7 nó 28 oíche.",
                "Lascaine luathcuir: le haghaidh áirithinte i bhfad roimh ré.",
                "Lascaine nóiméad deiridh: le haghaidh áirithinte gearrthéarmach gar don dáta teachta.",
              ],
            },
            { type: "h2", text: "Lascaine a shocrú" },
            {
              type: "steps",
              items: [
                "Oscail sa mhaoin an cluaisín „Praghsanna“ agus an rannóg „Lascainí“.",
                "Roghnaigh an cineál lascaine atá uait.",
                "Socraigh an tairseach, m.sh. oícheanta íosta nó réamhfhógra.",
                "Cuir isteach an lascaine mar chéatadán.",
                "Sábháil an riail.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Bíonn éifeacht ag lascainí ar phraghas iomlán an phlean rátaí ábhartha agus taispeántar don aoi iad cheana féin i bhforbhreathnú na bpraghsanna.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Comhcheangail lascainí fadtéarmacha le [Fanacht Íosta & Uasta](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) chun áirithintí níos faide a spreagadh go sonrach.",
            },
          ],
        },
      ],
    },
  ],
};
