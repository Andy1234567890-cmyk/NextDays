import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Na Chéad Chéimeanna",
  description: "Cuir do chuntas ar bun agus tosaigh i gceann cúpla nóiméad.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Socrú",
      articles: [
        {
          slug: "willkommen",
          title: "Fáilte go myNextDays",
          excerpt: "Forbhreathnú ar an gcóras bainistíochta maoine, an bainisteoir cainéal, an t-ardán agus an aip.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is é myNextDays an t-ardán lárnach agat le haghaidh maoine saoire agus óstán. In áit go leor córas scoite, bainistíonn tú infhaighteacht, praghsanna, áirithintí agus cumarsáid le haíonna in aon áit amháin — cibé an teach saoire amháin nó roinnt seomraí óstáin atá agat.",
            },
            { type: "h2", text: "Na ceithre bhloc thógála" },
            {
              type: "ul",
              items: [
                "Córas Bainistíochta Maoine (PMS): maoine, féilirí, praghsanna, áirithintí, tascanna agus íocaíochtaí.",
                "Bainisteoir Cainéal: nasc le tairseacha ar nós Booking, Airbnb agus a leithéidí — iontráil amháin, go leor tairseacha sioncrónaithe.",
                "Ardán Margaidh: margadh féin myBestDays, cainéal áirithinte comhchéime le hais na dtairseach.",
                "Aip: an fheidhmchlár soghluaiste d'aíonna, d'úinéirí agus d'fhoireann leis na sonraí céanna atá ar an ngréasán.",
              ],
            },
            { type: "h2", text: "Conas a oibríonn na bloic le chéile" },
            {
              type: "p",
              text: "Coinníonn tú maoin, praghsanna agus infhaighteacht in eagar go lárnach uair amháin sa PMS. As sin, dáileann myNextDays na sonraí go huathoibríoch chuig gach cainéal gníomhach. Nuair a dhéantar áirithint — is cuma cén cainéal trína dtagann sí isteach — cuirtear cosc láithreach ar na hoícheanta comhfhreagracha i ngach áit, ionas nach féidir áirithint dhúbailte tarlú.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tosaigh le Cuntas & Gnó a shocrú, ansin do chéad mhaoin a chruthú — sábhálfaidh an t-ord seo ceartúcháin duit níos déanaí.",
            },
            { type: "h2", text: "An chéad chéim eile" },
            {
              type: "steps",
              items: [
                "Oscail Cuntas sa roghchlár agus líon isteach sonraí do ghnó.",
                "Cruthaigh do chéad mhaoin faoi Maoine.",
                "Deimhnigh go bhfuil áiseanna, grianghraif agus praghsanna iomlán.",
                "Cliceáil ar Foilsigh chun an mhaoin a dhéanamh infheicthe ar gach cainéal.",
              ],
            },
            {
              type: "p",
              text: "Tá tuilleadh eolais faoi na céimeanna aonair le fáil in [Cuntas & Gnó a shocrú](/hilfe/erste-schritte/konto-einrichten) agus [Do chéad mhaoin a chruthú](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Cuntas & Gnó a shocrú",
          excerpt: "Bunsonraí, seoladh sonraisc agus airgeadra a chur isteach i gceart.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Sula gcruthaíonn tú maoine, socraigh do ghnó sa Chuntas. Tá na sonraí seo ag teastáil le haghaidh sonrasc, tairseacha agus billeáil le myNextDays, agus ba cheart iad a bheith iomlán agus ceart dá bharr.",
            },
            { type: "h2", text: "Bunsonraí a chur isteach" },
            {
              type: "steps",
              items: [
                "Oscail Cuntas sa roghchlár.",
                "Cuir isteach faoi Bhunsonraí ainm na cuideachta nó ainm an ghnólachta aonair, seoladh agus sonraí teagmhála.",
                "Cuir isteach an seoladh sonraisc — beidh sé ar gach sonrasc a eiseofar.",
                "Roghnaigh do bhunairgeadra. Baineann sé seo le gach praghas go dtí go n-athraíonn tú é go sonrach do mhaoin ar leith.",
              ],
            },
            { type: "h2", text: "Cén fáth a bhfuil an t-airgeadra tábhachtach" },
            {
              type: "p",
              text: "Ní thomhaistear an t-airgeadra agus ní chuirtear isteach go huathoibríoch é: mura bhfuil sé ann, ní féidir aon phraghas a thaispeáint nó a shonrascú i gceart. Dá bharr sin, éilíonn myNextDays rogha shoiléir agus an cuntas á shocrú, seachas luach réamhshocraithe a chur isteach.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Má athraíonn tú airgeadra maoine ina dhiaidh sin, athraítear gach plean rátaí a bhaineann leis dá réir. Deimhnigh na praghsanna arís ina dhiaidh sin.",
            },
            { type: "h2", text: "Seoladh sonraisc & billeáil" },
            {
              type: "p",
              text: "Faoi Bhilleáil sa Chuntas, feiceann tú do shonraisc reatha agus an seoladh sonraisc atá i bhfeidhm. Coinnigh iad seo cothrom le dáta, go háirithe má athraíonn foirm dhlíthiúil nó seoladh do ghnó, ionas go n-eisítear sonraisc i gceart.",
            },
            {
              type: "ul",
              items: [
                "Ainm na cuideachta nó ainm an ghnólachta aonair",
                "Seoladh sonraisc lena n-áirítear an tír",
                "Uimhir cánach nó CBL, más ann di",
                "Bunairgeadra le haghaidh maoine nua",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Do chéad mhaoin a chruthú",
          excerpt: "Mar seo a chruthaíonn tú do chéad aonad inchurtha in áirithe céim ar chéim.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is aonad inchurtha in áirithe amháin é maoin i myNextDays i gcónaí: seomra amháin in óstán nó maoin saoire iomlán. Má tá óstán le go leor seomraí agat, cruthaigh maoin ar leith do gach seomra.",
            },
            { type: "h2", text: "Maoin a chruthú" },
            {
              type: "steps",
              items: [
                "Oscail Maoine sa roghchlár.",
                "Cliceáil ar Cuir maoin leis.",
                "Roghnaigh cineál na maoine: catagóir, cineál eastáit réadaigh agus cineál tairisceana.",
                "Cuir isteach seoladh, acmhainneacht agus bunphraghas i d'airgeadra socraithe.",
                "Sábháil an mhaoin mar dhréacht chun í a chríochnú níos déanaí.",
              ],
            },
            { type: "h2", text: "Cad atá in easnamh ina dhiaidh sin" },
            {
              type: "p",
              text: "Is dréacht í maoin nuachruthaithe ar dtús agus níl sí infheicthe ar aon chainéal. Cuir áiseanna, grianghraif, cur síos agus infhaighteacht féilire leis sula bhfoilsíonn tú í — ní féidir ach maoin iomlán a mhargú go hiontaofa.",
            },
            {
              type: "ul",
              items: [
                "Roghnaigh gnéithe áiseanna ón liosta catagóire",
                "Cuir isteach grianghraf teidil amháin ar a laghad agus cur síos",
                "Cuir isteach acmhainneacht (daoine fásta, leanaí, leapacha) i gceart",
                "Deimhnigh an bunphraghas agus infhaighteacht an fhéilire",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Má tá roinnt cineálacha seomra agat, athdhéan an próiseas seo do gach seomra ar leith — níl aon leibhéal foirgnimh os cionn na seomraí.",
            },
            {
              type: "p",
              text: "Nuair a bhíonn gach réimse riachtanach líonta isteach, is féidir leat an mhaoin a fhoilsiú, féach [Maoin a fhoilsiú](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Maoin a fhoilsiú",
          excerpt: "Cliceáil amháin agus tá an tArdán Margaidh, na tairseacha agus an suíomh gréasáin go léir gníomhach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Déanann Foilsigh maoin infheicthe agus inchurtha in áirithe. De ghnáth is leor cliceáil amháin chun na trí chainéal díolacháin a ghníomhachtú ag an am céanna — ach is féidir leat infheictheacht gach cainéil a chur in oiriúint go haonair ag am ar bith.",
            },
            { type: "h2", text: "Mar seo a fhoilsíonn tú" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi Maoine.",
                "Deimhnigh sa chluaisín Forbhreathnú go bhfuil gach sonra riachtanach marcáilte glas.",
                "Cliceáil ar Foilsigh.",
                "Deimhnigh sa bhosca dialóige — gníomhachtófar an tArdán Margaidh, na tairseacha agus an suíomh gréasáin.",
              ],
            },
            { type: "h2", text: "Cainéil a rialú go haonair" },
            {
              type: "p",
              text: "Tar éis an fhoilsithe, gheobhaidh tú trí lasc ar leith sa chluaisín Infheictheacht: Suíomh Gréasáin, Ardán Margaidh agus Tairseacha. Más mian leat, mar shampla, maoin a thairiscint ar do shuíomh gréasáin féin amháin, ach ní trí thairseacha, díghníomhachtaigh an lasc chomhfhreagrach.",
            },
            {
              type: "ul",
              items: [
                "Suíomh Gréasáin: infheictheacht ar do shuíomh gréasáin myNextDays féin",
                "Ardán Margaidh: infheictheacht ar mhargadh domhanda myBestDays",
                "Tairseacha: infheictheacht ar Booking, Airbnb agus a leithéidí",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Tá na trí lasc seo neamhspleách ar stádas na maoine (gníomhach/neamhghníomhach). Is féidir le maoin ghníomhach a bheith dofheicthe fós ar chainéil aonair.",
            },
            { type: "h2", text: "Maoin a chosc go sealadach" },
            {
              type: "p",
              text: "Más mian leat lá amháin a chosc seachas an mhaoin go léir, úsáid Stop-Sell san fhéilire — cuireann sé sin cosc ar an lá ar gach cainéal ag an am céanna, is cuma cad é stádas na lasc infheictheachta.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Na trí chainéal díolacháin a thuiscint",
          excerpt: "Tairseacha, an tArdán Margaidh agus an aip i bhforbhreathnú.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Margaíonn myNextDays gach maoin trí bhealaí comhchéime éagsúla ag an am céanna. Má thuigeann tú conas a oibríonn siad le chéile, cuidíonn sé leat infheictheacht agus praghsanna a rialú go sonrach.",
            },
            { type: "h2", text: "Tairseacha" },
            {
              type: "p",
              text: "Tríd an mBainisteoir Cainéal, nascann tú do mhaoin le mórthairseacha áirithinte ar nós Booking, Airbnb agus a leithéidí. Sioncrónaítear infhaighteacht agus praghsanna go huathoibríoch, ionas nach gá duit féilirí iomadúla tairseach a choinneáil de láimh.",
            },
            { type: "h2", text: "Ardán Margaidh" },
            {
              type: "p",
              text: "Is cainéal áirithinte domhanda dá chuid féin é margadh myBestDays — inchomparáide le Booking nó Airbnb, ach mar chuid den ardán céanna. Ní ionadaí é ar “áirithint dhíreach”, ach cainéal comhchéime le hais na dtairseach.",
            },
            { type: "h2", text: "Aip" },
            {
              type: "p",
              text: "Tugann an aip shoghluaiste rochtain d'aíonna, d'úinéirí agus d'fhoireann ar na sonraí céanna a bhíonn ar an ngréasán — sonraí áirithinte, teachtaireachtaí nó tascanna, ag brath ar an ról faoi seach.",
            },
            { type: "h2", text: "Trí ais infheictheachta ar leith" },
            {
              type: "ul",
              items: [
                "Suíomh Gréasáin — do shuíomh gréasáin myNextDays féin",
                "Ardán Margaidh — margadh domhanda myBestDays",
                "Tairseacha — Booking, Airbnb agus a leithéidí tríd an mBainisteoir Cainéal",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Is féidir na trí ais a rialú go neamhspleách ar a chéile. Oibríonn Stop-Sell agus stádas na maoine, ar an lámh eile, trasna na gcainéal go léir ag an am céanna.",
            },
          ],
        },
      ],
    },
  ],
};
