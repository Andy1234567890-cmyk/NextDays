import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Tairseacha & Bainisteoir Cainéal",
  description: "Booking, Airbnb, Expedia agus a leithéidí a rialú go lárnach.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Tairseacha a nascadh",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Cad é an Bainisteoir Cainéal?",
          excerpt:
            "Comhoireann an Bainisteoir Cainéal praghsanna, infhaighteacht agus áirithintí go huathoibríoch idir myNextDays agus na tairseacha.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Nasc amháin do gach tairseach" },
            {
              type: "p",
              text: "Is é an Bainisteoir Cainéal an droichead idir myNextDays agus mórthairseacha áirithinte ar nós Booking, Airbnb agus a leithéidí. In áit praghsanna, infhaighteacht agus áitíocht a choinneáil de láimh i ngach tairseach ar leith, cuireann tú gach rud isteach uair amháin i myNextDays — dáileann an Bainisteoir Cainéal go huathoibríoch é chuig gach tairseach nasctha.",
            },
            { type: "h2", text: "Cad a shioncrónaítear go huathoibríoch" },
            {
              type: "ul",
              items: [
                "Infhaighteacht — cuireann gach áirithint cosc láithreach ar an oíche ar gach tairseach",
                "Praghsanna agus fanacht íosta ó d'fhéilire praghsanna",
                "Allmhairítear áirithintí a thagann isteach ó thairseacha go huathoibríoch chuig myNextDays",
                "Bíonn éifeacht ag cealuithe agus Stop-Sell trasna na gcainéal",
              ],
            },
            { type: "h2", text: "Cad nach gá duit a dhéanamh de láimh a thuilleadh" },
            {
              type: "p",
              text: "Gan an Bainisteoir Cainéal, chaithfeá cosc a chur ar an oíche de láimh i ngach tairseach tar éis gach áirithinte — cúis choitianta le dúbailtáirithintí. Leis an mBainisteoir Cainéal gníomhach, déanann myNextDays an comhoiriúnú seo sa dá threo, arís agus arís eile gach lá agus i bhfíor-am le linn áirithintí nua.",
            },
            {
              type: "note",
              variant: "info",
              text: "Socraítear an nasc tairsí uair amháin ar fud an chuntais. Do gach maoin ar leith, ní theastaíonn uait ach an mapáil a ghníomhachtú ina dhiaidh sin — tuilleadh eolais in [Maoin a shannadh do thairseach](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Nasc tairsí a shocrú",
          excerpt:
            "Socraíonn tú an nasc leis na tairseacha uair amháin ar fud an chuntais — ní athuair do gach maoin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Uair amháin don chuntas iomlán" },
            {
              type: "p",
              text: "Is socrú ar fud an chuntais é an nasc le tairseacha: nascann tú do chuntas myNextDays uair amháin go beacht leis an mBainisteoir Cainéal. Baineann gach maoin a chruthaíonn tú ina dhiaidh sin go huathoibríoch leis an nasc amháin seo — ní gá duit é a atógáil do gach maoin ar leith.",
            },
            { type: "h2", text: "Mar seo a shocraíonn tú an nasc" },
            {
              type: "steps",
              items: [
                "Oscail /konto agus roghnaigh an rannóg „Tairseacha & Bainisteoir Cainéal\"",
                "Cliceáil ar „Nasc a shocrú\" agus deimhnigh sonraí do ghnó (seoladh, teagmháil, foirm dhlíthiúil)",
                "Seiceáil na bunsonraí a glacadh isteach go huathoibríoch — cuirfear ar aghaidh iad chuig gach tairseach",
                "Críochnaigh an socrú; athraíonn an stádas go „Nasctha\"",
              ],
            },
            { type: "h2", text: "An chéad chéim eile: maoine a shannadh" },
            {
              type: "p",
              text: "Tar éis an tsocraithe aonuaire, níl aon mhaoin infheicthe fós — chuige sin, sannann tú gach maoin ar leith do thairseach (mapáil) agus nascann tú na tairseacha atá uait, ar nós Booking.com nó Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Gan bunsonraí iomlána (seoladh, sonraí cánach, teagmháil), diúltaíonn na tairseacha don nasc. Seiceáil na sonraí seo ar dtús faoi /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Maoin a shannadh do thairseach",
          excerpt:
            "Tar éis an naisc ar fud an chuntais, ní ghníomhachtaíonn tú de réir maoine ach an mapáil don tairseach faoi seach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Mapáil in áit athnasc" },
            {
              type: "p",
              text: "Nuair a bhíonn an nasc tairsí socraithe uair amháin ar fud an chuntais, nascann tú gach maoin trí mhapáil dá dtugtar amhlaidh: socraíonn tú cén maoin myNextDays a fhreagraíonn do chén seomra nó cén cineál tairisceana sa tairseach. Is céim aonuaire de réir maoine é seo.",
            },
            { type: "h2", text: "Mar seo a shannann tú maoin" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi /objekte agus téigh go dtí an cluaisín „Tairseacha\"",
                "Roghnaigh an tairseach atá uait, Booking.com nó Airbnb, mar shampla",
                "Sann an mhaoin don chineál seomra nó tairisceana cuí sa tairseach",
                "Gníomhachtaigh an sioncrónú — cuirtear praghsanna agus infhaighteacht ar aghaidh láithreach",
              ],
            },
            { type: "h2", text: "Maoin amháin, roinnt tairseach" },
            {
              type: "p",
              text: "Is féidir le maoin aonair a bheith sannta do roinnt tairseach ag an am céanna. Tá gach sannadh neamhspleách — is féidir leat maoin a dhéanamh infheicthe ar Booking.com agus Airbnb, mar shampla, ach í a fhágáil díghníomhach ar Expedia go fóill.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Seiceáil an infheictheacht go díreach tar éis an mhapála — féach [Infheictheacht in aghaidh na tairsí](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Booking.com a nascadh",
          excerpt: "Mar seo a ghníomhachtaíonn tú Booking.com mar chainéal díolacháin do mhaoin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Réamhriachtanas: nasc ar fud an chuntais" },
            {
              type: "p",
              text: "Sula ngníomhachtaíonn tú Booking.com do mhaoin, caithfidh an nasc tairsí ar fud an chuntais a bheith socraithe (féach [Nasc tairsí a shocrú](/hilfe/portale-kanalmanager/portal-verbindung)). Ina dhiaidh sin níl i gceist le Booking.com do gach maoin bhreise ach ceist mapála.",
            },
            { type: "h2", text: "Booking.com a ghníomhachtú" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi /objekte, cluaisín „Tairseacha\"",
                "Roghnaigh „Booking.com\" ó liosta na dtairseach atá ar fáil",
                "Sann an cineál seomra nó tairisceana cuí agus deimhnigh na pleananna rátaí",
                "Gníomhachtaigh an infheictheacht — cuirfear an mhaoin beo tar éis seiceáil ó Booking.com",
              ],
            },
            { type: "h2", text: "Cad a bhíonn ag teastáil ó Booking.com uait" },
            {
              type: "ul",
              items: [
                "Cur síos iomlán ar an maoin, íomhánna agus áiseanna",
                "Ráta amháin ar a laghad le praghas agus coinníollacha cealaithe",
                "Modh íocaíochta bailí le haghaidh coimisiúin",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Is féidir go dtógfaidh ceadú Booking.com cúpla uair an chloig. Taispeánann an stádas i gcluaisín na maoine „Tairseacha\" an bhfuil an nasc gníomhach cheana.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Airbnb a nascadh",
          excerpt: "Mar seo a dhéanann tú maoin inchurtha in áirithe ar Airbnb tríd an mBainisteoir Cainéal.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Airbnb mar thairseach bhreise" },
            {
              type: "p",
              text: "Nasctar Airbnb, cosúil le gach tairseach eile, tríd an nasc ar fud an chuntais. Nuair atá sé sin socraithe, gníomhachtaíonn tú Airbnb de réir maoine tríd an mapáil — is cuma an bhfuil an mhaoin infheicthe cheana ar Booking.com nó ar thairseacha eile.",
            },
            { type: "h2", text: "Airbnb a ghníomhachtú do mhaoin" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi /objekte, cluaisín „Tairseacha\"",
                "Roghnaigh „Airbnb\" ó liosta na dtairseach atá ar fáil",
                "Deimhnigh catagóir na maoine agus an cineál tairisceana sannta",
                "Seiceáil grianghraif, áiseanna agus rialacha tí — éilíonn Airbnb sonraí iomlána sula ndéantar ceadú",
                "Gníomhachtaigh an infheictheacht do Airbnb",
              ],
            },
            { type: "h2", text: "Tar éis an ghníomhachtaithe" },
            {
              type: "p",
              text: "A luaithe a cheadaíonn Airbnb an mhaoin, ritheann praghsanna agus infhaighteacht go huathoibríoch tríd an mBainisteoir Cainéal. Feictear áirithintí a thagann isteach ar Airbnb go huathoibríoch i d'fhéilire áirithinte ina dhiaidh sin.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Gan coinníollacha cealaithe agus rialacha tí curtha isteach, diúltaíonn Airbnb don cheadú. Cuir isteach na sonraí seo ar dtús sa mhaoin.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Praghsanna & Infhaighteacht a shioncrónú",
          excerpt:
            "Cuirtear praghsanna agus infhaighteacht ar aghaidh go huathoibríoch chuig gach tairseach nasctha.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Féilire amháin, gach tairseach" },
            {
              type: "p",
              text: "Coinníonn tú praghsanna agus infhaighteacht ar bun go heisiach in fhéilire myNextDays na maoine faoi seach — riamh go haonair sna tairseacha féin. Aistríonn an Bainisteoir Cainéal gach athrú go huathoibríoch chuig gach tairseach a bhfuil an mhaoin sannta di go gníomhach — gan aon rud a chur isteach faoi dhó.",
            },
            { type: "h2", text: "Cad a chuirtear ar aghaidh" },
            {
              type: "ul",
              items: [
                "Praghsanna laethúla ó d'fhéilire praghsanna nó ó na pleananna rátaí",
                "Oícheanta ar fáil agus coisc",
                "Fanacht íosta agus srianta teachta/imeachta",
                "Laethanta Stop-Sell — cuireann siad seo cosc go huathoibríoch ar gach tairseach",
              ],
            },
            { type: "h2", text: "Cé chomh tapa is a bhíonn éifeacht ag an sioncrónú" },
            {
              type: "p",
              text: "Cuirtear athruithe ar phraghsanna agus ar infhaighteacht ar aghaidh chuig na tairseacha laistigh de chúpla nóiméad. Cuireann áirithintí nua cosc láithreach ar na hoícheanta lena mbaineann, ionas nach féidir an oíche chéanna a dhíol arís ar aon chainéal eile.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tuilleadh eolais faoin gcosc ar laethanta aonair trasna na gcainéal le fáil in [Ró-áirithintí a sheachaint](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Áirithintí ó thairseach a fháil",
          excerpt: "Tagann áirithintí ó Booking, Airbnb agus a leithéidí isteach go huathoibríoch i d'fhéilire.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Allmhairiú uathoibríoch" },
            {
              type: "p",
              text: "Má chuireann aoi áirithint in áirithe trí thairseach ar nós Booking.com nó Airbnb, allmhairíonn an Bainisteoir Cainéal an áirithint go huathoibríoch chuig myNextDays. Ní gá duit aon rud a aistriú de láimh — feiceann tú an áirithint san fhéilire agus i liosta áirithintí na maoine lena mbaineann.",
            },
            { type: "h2", text: "Cad a tharlaíonn le háirithint ó thairseach" },
            {
              type: "steps",
              items: [
                "Tuairiscíonn an tairseach an áirithint nua don Bhainisteoir Cainéal",
                "Cruthaíonn myNextDays an áirithint le sonraí aoi, tréimhse agus praghas",
                "Cuirtear cosc láithreach ar na hoícheanta curtha in áirithe ar gach cainéal eile",
                "Faigheann tú fógra agus aimseoidh tú an áirithint san fhéilire",
              ],
            },
            { type: "h2", text: "Cealuithe agus athruithe" },
            {
              type: "p",
              text: "Má chealaíonn aoi tríd an tairseach, nó má athraíonn an t-aoi an tréimhse, aistrítear é seo go huathoibríoch chuig myNextDays freisin agus scaoiltear saor na hoícheanta lena mbaineann.",
            },
            {
              type: "note",
              variant: "info",
              text: "Aithnítear áirithintí ó thairseach i sonraí na háirithinte trína suaitheantas foinse, Booking.com nó Airbnb, mar shampla.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Ró-áirithintí a sheachaint",
          excerpt: "Coisceann Stop-Sell agus coisc uathoibríocha dúbailtáirithintí trasna roinnt tairseach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Cén fáth a dtarlaíonn ró-áirithintí" },
            {
              type: "p",
              text: "Gan rialú lárnach, is éasca don oíche chéanna a dhíol ar dhá thairseach ag an am céanna — mar shampla nuair a choinnítear praghsanna agus infhaighteacht de láimh i roinnt córas. Dúnann an Bainisteoir Cainéal an bhearna seo, mar go gcuireann gach áirithint ar gach cainéal cosc láithreach ar gach cainéal eile.",
            },
            { type: "h2", text: "D'uirlisí i gcoinne ró-áirithintí" },
            {
              type: "ul",
              items: [
                "Cosc uathoibríoch: cuireann gach áirithint nua — is cuma cén cainéal — cosc ar na hoícheanta i ngach áit",
                "Stop-Sell: cuireann sé cosc de láimh ar lá ar gach cainéal ag an am céanna, le haghaidh úsáid féin nó cothabháil, mar shampla",
                "Coisceann fanacht íosta agus srianta teachta áirithintí gairide neamhoiriúnacha",
              ],
            },
            { type: "h2", text: "Stop-Sell a shocrú" },
            {
              type: "steps",
              items: [
                "Oscail féilire áitíochta na maoine",
                "Marcáil an lá nó an tréimhse lena mbaineann",
                "Roghnaigh „Stop-Sell\" — tá an lá coiscthe ina dhiaidh sin ar gach tairseach chomh maith le ar an suíomh gréasáin agus ar an ardán",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Baineann Stop-Sell le gach cainéal gan eisceacht. Níl aon bhealach ann lá a chosc do thairseach amháin agus é a fhágáil oscailte do na cinn eile.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Infheictheacht in aghaidh na tairsí",
          excerpt: "Is féidir gach tairseach a chur air nó as go neamhspleách ar an suíomh gréasáin agus ar an Ardán Margaidh.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Trí bhealach dhíolacháin neamhspleácha" },
            {
              type: "p",
              text: "Is féidir maoin a dhíol trí roinnt bealaí ag an am céanna: trí na tairseacha (Booking, Airbnb agus a leithéidí), tríd an Ardán Margaidh myBestDays agus trí do shuíomh gréasáin féin. Tá lasc infheictheachta dá cuid féin ag gach bealach — tá siad go hiomlán neamhspleách óna chéile.",
            },
            { type: "h2", text: "Infheictheacht a rialú in aghaidh na tairsí" },
            {
              type: "p",
              text: "Laistigh de na tairseacha, is féidir gach tairseach ar leith a chur air nó as ar leithligh freisin. Is féidir le maoin, mar shampla, a bheith gníomhach ar Booking.com ach díghníomhach ar Airbnb — fanann an dá shannadh gan athrú.",
            },
            { type: "h2", text: "Mar seo a athraíonn tú an infheictheacht" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi /objekte, cluaisín „Tairseacha\"",
                "Cuir an cainéal atá uait (tairseach amháin, suíomh gréasáin nó Ardán Margaidh) air nó as go haonair",
                "Sábháil — beidh éifeacht ag an athrú laistigh de chúpla nóiméad",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Bíonn éifeacht ag stádas na maoine (gníomhach/neamhghníomhach) chomh maith le Stop-Sell ar gach cainéal go huilíoch. Ní rialaíonn na laisc infheictheachta ach ar cén chainéal bhreise a bhfeictear maoin atá gníomhach cheana ann.",
            },
          ],
        },
        {
          slug: "bewertungen",
          title: "Léirmheasanna ó gach cainéal",
          excerpt: "Tagann léirmheasanna ó na tairseacha agus ó myBestDays le chéile in aon liosta amháin — is ann a fhreagraíonn tú freisin.",
          updated: "Nuashonraithe: Lúnasa 2026",
          body: [
            { type: "h2", text: "Aon liosta amháin do gach cainéal" },
            {
              type: "p",
              text: "Faoi /bewertungen feiceann tú gach léirmheas ar na háiteanna atá agat in aon áit amháin: cinn ó na tairseacha (Booking.com, Airbnb, Expedia) agus cinn ó mhargadh myBestDays. Rátálann na tairseacha as 10, myBestDays as 5 réalta — taispeántar réaltaí, agus an scór bunaidh in aice leo, ionas nach mbeidh cuma shaobhadh ar aon rud.",
            },
            { type: "h2", text: "Freagra ar léirmheas" },
            {
              type: "steps",
              items: [
                "Oscail /bewertungen agus scag ar „Gan freagra amháin\" más mian leat",
                "Cliceáil „Freagair\" ag an léirmheas agus scríobh do fhreagra",
                "Seol — i gcás tairsí téann an freagra ann ar dtús agus ní thaispeántar é anseo mar fhreagartha go dtí ina dhiaidh sin",
              ],
            },
            { type: "h2", text: "Cad eile a fheiceann tú" },
            {
              type: "ul",
              items: [
                "Meán, líon agus ráta freagartha de réir cainéil mar phríomhfhigiúirí",
                "„Nach bhfuil foilsithe fós\": níor thug an taobh eile léirmheas fós agus tá an tréimhse 14 lá ag rith",
                "„Tá an spriocdháta freagra caite\": ní ghlacann an tairseach le freagra a thuilleadh",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ní fheiceann ach tusa léirmheasanna na dtairseach. Ar mhargadh myBestDays agus ar do shuíomh féin, ní thaispeántar ach do léirmheasanna myBestDays fíoraithe féin — ní cheadaíonn Booking.com ná Airbnb athfhoilsiú a léirmheasanna ach go teoranta.",
            },
          ],
        },
      ],
    },
  ],
};
