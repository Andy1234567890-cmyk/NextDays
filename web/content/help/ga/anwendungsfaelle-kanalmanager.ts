import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Bainisteoir Cainéal",
  description: "Máistreacht a fháil ar thairseacha agus ar an mBainisteoir Cainéal.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Bainisteoir Cainéal",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Do chéad tairseach a nascadh",
          excerpt: "Mar seo a ghníomhachtaíonn tú tairseach do mhaoin den chéad uair.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: tá maoin cruthaithe agat, ach níl aon tairseach nasctha fós",
            },
            {
              type: "p",
              text: "Tá do mhaoin socraithe go hiomlán i myNextDays, ach níl sí infheicthe fós ar aon tairseach ar nós Booking.com nó Airbnb. Sula nglacann tairseach le maoin, teastaíonn nasc tairsí ar fud an chuntais uair amháin ó do chuntas — ina dhiaidh sin ní theastaíonn ach mapáil do gach maoin bhreise.",
            },
            {
              type: "steps",
              items: [
                "Oscail /konto, rannóg „Tairseacha & Bainisteoir Cainéal\", agus socraigh an nasc ar fud an chuntais le sonraí do ghnó",
                "Oscail an mhaoin faoi /objekte ina dhiaidh sin agus téigh go dtí an cluaisín „Tairseacha\"",
                "Roghnaigh an tairseach atá uait agus sann í don chineál seomra nó tairisceana cuí",
                "Seiceáil grianghraif, áiseanna, praghsanna agus coinníollacha cealaithe — éilíonn tairseacha sonraí iomlána",
                "Gníomhachtaigh an infheictheacht; athraíonn an stádas go „Nasctha\" tar éis seiceáil ón tairseach",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ní shocraíonn tú an nasc ar fud an chuntais ach uair amháin. Sonraí faoi seo in [Booking.com a nascadh](/hilfe/portale-kanalmanager/booking-verbinden) agus [Airbnb a nascadh](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Booking.com a nascadh",
          excerpt: "Mar seo a dhéanann tú maoin inchurtha in áirithe ar Booking.com tríd an mBainisteoir Cainéal.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: ba mhaith leat do mhaoin a bheith infheicthe breise ar Booking.com",
            },
            {
              type: "p",
              text: "Is ceann de na tairseacha atá nasctha tríd an mBainisteoir Cainéal é Booking.com. Is é an réamhriachtanas an nasc tairsí ar fud an chuntais — má tá sé sin socraithe cheana, ní theastaíonn ach mapáil de réir maoine do Booking.com.",
            },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi /objekte, cluaisín „Tairseacha\"",
                "Roghnaigh „Booking.com\" ó liosta na dtairseach atá ar fáil",
                "Sann an cineál seomra nó tairisceana cuí agus deimhnigh ráta amháin ar a laghad le praghas agus coinníollacha cealaithe",
                "Cuir isteach modh íocaíochta bailí don sonrascadh coimisiúin",
                "Gníomhachtaigh an infheictheacht do Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Is féidir go dtógfaidh ceadú Booking.com cúpla uair an chloig. Taispeánann an stádas sa chluaisín „Tairseacha\" a luaithe atá an nasc gníomhach.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Airbnb a nascadh",
          excerpt: "Mar seo a dhéanann tú maoin inchurtha in áirithe ar Airbnb tríd an mBainisteoir Cainéal.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: ba mhaith leat do mhaoin a bheith infheicthe breise ar Airbnb",
            },
            {
              type: "p",
              text: "Nasctar Airbnb, cosúil le gach tairseach eile, tríd an nasc ar fud an chuntais. Nuair atá sé sin socraithe, gníomhachtaíonn tú Airbnb de réir maoine trí mhapáil — is cuma an bhfuil an mhaoin infheicthe cheana ar Booking.com nó ar thairseacha eile.",
            },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi /objekte, cluaisín „Tairseacha\"",
                "Roghnaigh „Airbnb\" ó liosta na dtairseach atá ar fáil",
                "Deimhnigh catagóir na maoine agus an cineál tairisceana sannta",
                "Cuir grianghraif, áiseanna agus rialacha tí leis — éilíonn Airbnb sonraí iomlána sula ndéantar ceadú",
                "Gníomhachtaigh an infheictheacht do Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Gan coinníollacha cealaithe agus rialacha tí curtha isteach, diúltaíonn Airbnb don cheadú. Cuir isteach na sonraí seo ar dtús sa mhaoin.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Praghsanna a choinneáil sioncrónaithe ar gach tairseach",
          excerpt: "Is leor féilire amháin — dáileann an Bainisteoir Cainéal athruithe praghais go huathoibríoch chuig gach tairseach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: athraíonn tú praghas agus ba mhaith leat a bheith cinnte go bhfuil sé ceart i ngach áit",
            },
            {
              type: "p",
              text: "Coinníonn tú praghsanna go heisiach in fhéilire myNextDays na maoine — riamh go haonair sna tairseacha féin. Aistríonn an Bainisteoir Cainéal gach athrú go huathoibríoch chuig gach tairseach a bhfuil an mhaoin sannta di go gníomhach.",
            },
            {
              type: "steps",
              items: [
                "Oscail féilire praghsanna nó pleananna rátaí na maoine",
                "Cuir an praghas laethúil, fanacht íosta nó srian teachta/imeachta in oiriúint",
                "Sábháil an t-athrú — bíonn éifeacht aige ar dtús go hinmheánach sa mhaoin",
                "Seiceáil sa chluaisín „Tairseacha\" go bhfuil gach tairseach atá uait fós mapáilte go gníomhach",
                "Fan cúpla nóiméad go dtí go gcuirtear an t-athrú ar aghaidh chuig na tairseacha",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ná cuir praghsanna isteach go díreach sa tairseach riamh — scríobhfar athruithe den sórt sin thar de réir fhéilire myNextDays ag an gcéad chomhoiriúnú eile.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Áirithint ó thairseach a allmhairiú",
          excerpt: "Tagann áirithintí ó thairseach isteach go huathoibríoch san fhéilire — seiceáil anseo gur oibrigh an t-allmhairiú.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: tá áirithint déanta ag aoi trí thairseach, ba cheart don áirithint teacht go myNextDays",
            },
            {
              type: "p",
              text: "Má chuireann aoi áirithint in áirithe trí Booking.com, Airbnb nó tairseach nasctha eile, allmhairíonn an Bainisteoir Cainéal an áirithint go huathoibríoch — ní gá duit aon rud a aistriú de láimh. Míníonn an próiseas seo conas an t-allmhairiú a rianú agus a dhearbhú.",
            },
            {
              type: "steps",
              items: [
                "Oscail féilire nó liosta áirithintí na maoine lena mbaineann",
                "Aimsigh an áirithint nua — bíonn suaitheantas foinse na tairsí uirthi, Booking.com nó Airbnb, mar shampla",
                "Seiceáil go bhfuil sonraí an aoi, an tréimhse agus an praghas iomlán",
                "Deimhnigh go dtaispeántar na hoícheanta curtha in áirithe mar choiscthe ar gach cainéal eile",
                "Oscail sonraí na háirithinte más gá chun seirbhísí breise nó teachtaireachtaí ón aoi a phróiseáil",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Má chealaíonn an t-aoi tríd an tairseach nó má athraíonn sé an tréimhse, glactar leis seo go huathoibríoch freisin agus scaoiltear saor na hoícheanta arís.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Dúbailtáirithint a réiteach",
          excerpt: "Mar seo a leanann tú ar aghaidh nuair a díoladh an oíche chéanna go heisceachtúil ar dhá chainéal.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: forluíonn dhá áirithint don mhaoin chéanna agus na hoícheanta céanna",
            },
            {
              type: "p",
              text: "De ghnáth, cuireann an Bainisteoir Cainéal cosc láithreach ar oícheanta curtha in áirithe trasna na gcainéal. D'fhéadfadh dúbailtáirithint tarlú fós, mar shampla i gcás áirithintí comhuaineacha ar dhá thairseach san am céanna, nó áirithint chruthaithe de láimh a bhuaileann in aghaidh áirithint ó thairseach.",
            },
            {
              type: "steps",
              items: [
                "Oscail féilire na maoine agus aithin an dá áirithint atá ag forluí",
                "Seiceáil am na háirithinte agus suaitheantas foinse an dá áirithint",
                "Déan teagmháil leis an aoi is déanaí a tháinig isteach agus tairg maoin mhalartach nó tréimhse mhalartach",
                "Cealaigh an áirithint neamh-inseasta sa tairseach féin, ní i myNextDays amháin",
                "Socraigh Stop-Sell do na hoícheanta lena mbaineann ansin go dtí go réitítear an cás go hiomlán",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Cealaigh áirithint ó thairseach i gcónaí tríd an tairseach féin — ní ghlanann cealú i myNextDays amháin an oíche saor go hiomlán inmheánach, ach ní chuireann sé an tairseach ar an eolas go hiontaofa.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Tairseach a chur ar sos go sealadach",
          excerpt: "Infheictheacht de réir tairsí a chur as go haonair gan an mapáil a chailleadh.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: níor cheart maoin a bheith inchurtha in áirithe go sealadach ar thairseach",
            },
            {
              type: "p",
              text: "Is féidir infheictheacht a rialú go haonair de réir tairsí — neamhspleách ar an suíomh gréasáin agus ar an Ardán Margaidh. Más mian leat Airbnb a chur ar sos go gairid, mar shampla, ach Booking.com a fhágáil ag rith, díghníomhachtaigh an cainéal amháin sin go heisiach.",
            },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi /objekte, cluaisín „Tairseacha\"",
                "Aimsigh iontráil na tairsí ba mhaith leat a chur ar sos",
                "Múch an infheictheacht don tairseach seo",
                "Sábháil — bíonn éifeacht ag an athrú laistigh de chúpla nóiméad, imíonn an mhaoin ó thorthaí cuardaigh na tairsí seo",
                "Cuir an infheictheacht ar ais air a luaithe ba cheart don mhaoin a bheith inchurtha in áirithe arís",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Fanann an mapáil slán agus é ar sos — ní gá duit an sannadh don tairseach a shocrú arís níos déanaí. Le haghaidh cosc iomlán ar gach cainéal, úsáid Stop-Sell ina áit sin.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "An mapáil maoine a sheiceáil",
          excerpt: "Mar seo a sheiceálann tú an bhfuil do mhaoin fós sannta i gceart don chineál tairisceana ceart sa tairseach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: ní réitíonn praghsanna nó infhaighteacht ar thairseach le myNextDays a thuilleadh",
            },
            {
              type: "p",
              text: "Má tá difríocht idir an taispeáint sa tairseach agus d'fhéilire myNextDays, is minic gur mapáil lochtach nó briste — nasc idir do mhaoin agus an cineál seomra nó tairisceana sa tairseach — is cúis leis.",
            },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi /objekte, cluaisín „Tairseacha\"",
                "Seiceáil stádas na tairsí lena mbaineann — ba cheart go dtaispeánfadh sé „Nasctha\", ní „Earráid\" ná „Ar feitheamh\"",
                "Seiceáil an bhfuil an cineál seomra nó tairisceana sannta sa tairseach fós ag freagairt don mhaoin iarbhír",
                "I gcás difríochta: bris an mapáil agus sann arís, ansin gníomhachtaigh an infheictheacht arís",
                "Fan cúpla nóiméad tar éis an cheartúcháin agus seiceáil praghsanna agus infhaighteacht arís sa tairseach",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Is féidir le maoin a bheith sannta do roinnt tairseach ag an am céanna — i gcás mírréireachta, seiceáil go sonrach an tairseach amháin lena mbaineann, ní gach ceann acu ag an am céanna.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Rátaí éagsúla de réir tairsí",
          excerpt: "Mar seo a shannann tú plean rátaí dá cuid féin do thairseach, gan tionchar a bheith ag na cainéil eile.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: ba mhaith leat praghas difriúil a thairiscint ar thairseach amháin ná ar na cainéil eile",
            },
            {
              type: "p",
              text: "Is féidir pleananna rátaí a shannadh go haonair de réir tairsí, plean rátaí neamh-inchealaithe do thairseach amháin agus plean solúbtha do cheann eile, mar shampla. Fanann na bunphraghsanna lárnach sa mhaoin, cinneann an mapáil cén plean rátaí a théann chuig cén tairseach.",
            },
            {
              type: "steps",
              items: [
                "Cruthaigh an plean rátaí breise sa mhaoin leis na coinníollacha atá uait (praghas, coinníollacha cealaithe, fanacht íosta)",
                "Oscail an cluaisín „Tairseacha\" agus roghnaigh an tairseach lena mbaineann",
                "Sann an plean rátaí nua don tairseach seo sa mhapáil",
                "Fág na tairseacha eile gan athrú ar a bplean rátaí atá ann cheana",
                "Sábháil agus seiceáil taispeáint an phraghais i ngach tairseach tar éis cúpla nóiméad",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Cuirtear gach plean rátaí ar aghaidh go neamhspleách — ní bhíonn tionchar ag athrú ar phlean rátaí amháin ar thairseacha atá sannta do phlean rátaí eile.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Earráidí coitianta tairsí a réiteach",
          excerpt: "Cúiseanna tipiciúla nuair a dhiúltaíonn tairseach do mhaoin nó nuair a stopann an sioncrónú.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra: taispeánann stádas tairsí earráid nó ní ghlactar leis an maoin",
            },
            {
              type: "p",
              text: "Diúltaíonn tairseacha do nasc de ghnáth mar gheall ar bhunsonraí in easnamh nó sonraí maoine neamhiomlána. Téigh trí na cúiseanna is coitianta san ord seo sula ndéanann tú teagmháil leis an tacaíocht.",
            },
            {
              type: "steps",
              items: [
                "Seiceáil faoi /konto go bhfuil seoladh, sonraí cánach agus sonraí teagmhála iomlána curtha isteach",
                "Seiceáil sa mhaoin go bhfuil cur síos, grianghraif, áiseanna agus ráta amháin ar a laghad iomlán",
                "Seiceáil go bhfuil modh íocaíochta bailí curtha isteach do choimisiúin",
                "Oscail an cluaisín „Tairseacha\" agus léigh an teachtaireacht earráide bheacht in aice na tairsí lena mbaineann",
                "Réitigh an bhearna a luaitear agus gníomhachtaigh an infheictheacht arís",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ní bhaineann earráid tairsí ach leis an tairseach amháin sin i gcónaí — leanann na cainéil eile ar aghaidh go neamhspleách air, fad is a chomhlíontar a gcuid riachtanas féin.",
            },
          ],
        },
      ],
    },
  ],
};
