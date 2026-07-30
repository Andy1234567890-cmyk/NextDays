import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Áirithintí & Féilire",
  description: "Áirithintí agus féilire a choinneáil faoi smacht.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Áirithintí & Féilire",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Ró-áirithintí a sheachaint go hiontaofa",
          excerpt: "Mar seo a dheimhníonn tú nach ndéantar maoin a chur in áirithe faoi dhó riamh.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Díoltar maoin ar roinnt cainéal ag an am céanna — tairseacha ar nós Booking, Airbnb agus a leithéidí, an t-ardán féin chomh maith leis an aip. Tarlaíonn ró-áirithint nuair nach gcuirtear cosc in am ar infhaighteacht ar chainéal amháin tar éis áirithint a bheith déanta ar chainéal eile.",
            },
            {
              type: "steps",
              items: [
                "Seiceáil sa phlean áitíochta go bhfuil líne amháin go beacht ag gach maoin le haonad inchurtha in áirithe amháin — gan aon acmhainneacht chomhroinnte roinnt seomraí.",
                "Ná lig ach do áirithintí nua a chruthú tríd an bplean áitíochta nó tríd na cainéil nasctha, riamh trí lá amháin a scríobh thar de láimh.",
                "Deimhnigh tar éis gach áirithinte go dtaispeántar na hoícheanta curtha in áirithe san fhéilire mar chuirtha in áirithe láithreach.",
                "I gcás fadhbanna teicniúla nó cothabhála, úsáid Stop-Sell láithreach seachas an lá a fhágáil oscailte.",
                "I gcás mírréireachta, seiceáil amlíne na háirithinte lena mbaineann chun an sraith ama a rianú.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ná hathraigh oícheanta ná coisc de láimh riamh lasmuigh den phlean áitíochta — ní mar sin amháin a fhanann sé cinnte go bhfeiceann gach cainéal an infhaighteacht chéanna agus nach dtagann aon bhearna do dhúbailtáirithint chun cinn.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Áirithint a bhogadh chuig maoin eile",
          excerpt: "Mar seo a aistríonn tú áirithint atá ann cheana go glan chuig maoin eile.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "Uaireanta caithfidh aoi bogadh ó mhaoin amháin go maoin eile, mar gheall ar locht teicniúil nó ar iarratas ón aoi, mar shampla. Le linn an aistrithe, scaoiltear saor go huathoibríoch na hoícheanta féilire a bhí ann cheana agus déantar iad a áitíocht arís sa mhaoin sprice.",
            },
            {
              type: "steps",
              items: [
                "Oscail an áirithint lena mbaineann in amlíne na háirithinte.",
                "Roghnaigh „Maoin a athrú“ nó „Bogadh“ sa roghchlár gníomhaíochta.",
                "Roghnaigh an mhaoin sprice agus seiceáil a hinfhaighteacht sa tréimhse roghnaithe.",
                "Deimhnigh an bogadh.",
                "Seiceáil ina dhiaidh sin sa phlean áitíochta go dtaispeántar na sean-oícheanta sa mhaoin bhunaidh mar ar fáil arís.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Déanann an córas an scaoileadh saor ar na sean-oícheanta go huathoibríoch — ní gá duit an tréimhse bhunaidh a oscailt de láimh féin. Cuir an t-aoi ar an eolas faoin athrú maoine, go háirithe má tá difríocht sna háiseanna nó sa rochtain.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Áirithint fhadtéarmach a chruthú",
          excerpt: "Mar seo a chruthaíonn tú áirithint thar tréimhse níos faide i gceart.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "h2",
              text: "Cúlra",
            },
            {
              type: "p",
              text: "D'aíonna fadtéarmacha — roinnt seachtainí nó míonna, mar shampla — cruthaigh áirithint mar is gnách, ach tabhair aird bhreise ar fhanacht íosta, rialacha íocaíochta agus infheictheacht chainéil na maoine thar an tréimhse iomlán.",
            },
            {
              type: "steps",
              items: [
                "Oscail plean áitíochta na maoine atá uait agus marcáil an tréimhse iomlán.",
                "Cruthaigh an áirithint le sonraí an aoi agus na dátaí teachta agus imeachta pleanáilte.",
                "Socraigh riail íocaíochta le héarlais agus iarmhéid más gá, seachas an méid iomlán a chur dlite láithreach.",
                "Seiceáil nach dtéann aon riail fanachta íosta nó uasta i gcoinne na tréimhse fada.",
                "Sábháil an áirithint agus deimhnigh go dtaispeántar an tréimhse iomlán mar chuirtha in áirithe i gceart san fhéilire.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "I gcás fanachtaí an-fhada, moltar iarmhéid a íoc i roinnt méideanna páirteacha seachas dlite mór amháin — mar sin fanann riosca na híocaíochta faoi smacht. Sonraí faoi seo in [An t-Iarmhéid a uathoibriú](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
