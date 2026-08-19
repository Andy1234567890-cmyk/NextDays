import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Áirithintí & Bookáil",
  description: "Áirithintí a bhainistiú, a bhogadh agus a chealú.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Áirithintí",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Áirithint a chlárú de láimh",
          excerpt:
            "Mar seo a chláraíonn tú áirithint a tháinig isteach ar an bhfón nó ar ríomhphost go díreach i myNextDays.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Cathain ba cheart duit clárú de láimh" },
            {
              type: "p",
              text: "Ní thagann gach áirithint isteach trí thairseach nó tríd an ardán féin — caithfidh tú iarratais ar an bhfón, ar ríomhphost nó ar an láthair a chruthú tú féin, ionas go bhfuil an mhaoin coiscthe i gceart i myNextDays agus nach dtarlaíonn dúbailtáitíocht.",
            },
            {
              type: "steps",
              items: [
                "Oscail Áirithintí agus cliceáil ar „Áirithint Nua“.",
                "Roghnaigh an mhaoin — is aonad inchurtha in áirithe amháin gach maoin i myNextDays, seomra nó maoin saoire ar leith.",
                "Socraigh dáta teachta agus imeachta chomh maith le líon na n-aíonna.",
                "Cuir isteach sonraí an aoi (ainm, teagmháil, seoladh don sonrasc más gá).",
                "Seiceáil an praghas molta agus cuir in oiriúint é más gá.",
                "Sábháil an áirithint — cuirtear cosc láithreach san fhéilire ar na hoícheanta.",
              ],
            },
            { type: "h2", text: "Íocaíocht agus deimhniú" },
            {
              type: "p",
              text: "Tar éis an tsábháil, baineann na rialacha íocaíochta céanna atá le háirithintí ar líne. Má tá soláthraí íocaíochta nasctha, is féidir leat nasc íocaíochta a sheoladh chuig an aoi go díreach nó an íocaíocht a mharcáil de láimh mar fuarthas.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Cuir mianta speisialta (teacht luath, leapacha breise) isteach sna nótaí láithreach — feiceann an fhoireann iad in amlíne na háirithinte.",
            },
            { type: "h2", text: "Tar éis an chláraithe" },
            {
              type: "p",
              text: "Feiceann tú an áirithint nua láithreach in [Amlíne na hÁirithinte](/hilfe/reservierungen/buchungs-zeitleiste) le gach céim eile — teachtaireachtaí, tascanna agus íocaíochtaí — in aon áit amháin.",
            },
            {
              type: "ul",
              items: [
                "Sioncrónaítear an féilire agus na tairseacha go huathoibríoch a luaithe a shábhálann tú.",
                "Faigheann an t-aoi teachtaireacht deimhniúcháin uathoibríoch más gá.",
                "Cláraigh athruithe ar dhátaí trí „Áirithint a bhogadh“.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Amlíne na hÁirithinte",
          excerpt:
            "Cuireann amlíne na háirithinte an próiseas iomlán d'áirithint le chéile in aon áit amháin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Cad a thaispeánann an amlíne" },
            {
              type: "p",
              text: "Tá amlíne dá cuid féin ag gach áirithint a thaispeánann an próiseas iomlán go croineolaíoch — ón iarratas áirithinte nó ó allmhairiú tairsí go dtí an t-imeacht. Mar sin feiceann tú ar an bpointe cad atá tarlaithe cheana agus cad atá le teacht.",
            },
            {
              type: "ul",
              items: [
                "Teachtaireachtaí leis an aoi",
                "Tascanna, mar shampla glanadh nó ullmhúchán",
                "Íocaíochtaí agus sonraisc",
                "Breiseáin agus seirbhísí breise curtha in áirithe",
                "Bogadh (aistriú) agus cealuithe",
              ],
            },
            { type: "h2", text: "An amlíne a úsáid sa saol laethúil" },
            {
              type: "steps",
              items: [
                "Oscail Áirithintí agus roghnaigh an áirithint atá uait.",
                "Téigh go dtí an cluaisín „Amlíne“.",
                "Scrollaigh go croineolaíoch trí gach imeacht.",
                "Úsáid na gníomhartha tapa chun teachtaireacht a sheoladh nó tasc a chruthú go díreach.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Má bhogtar nó má chealaítear áirithint, taispeántar an chéim seo san amlíne freisin — lena n-áirítear na hoícheanta a scaoileadh saor san fhéilire.",
            },
            { type: "h2", text: "Cén fáth a bhfuil sé seo tábhachtach" },
            {
              type: "p",
              text: "Toisc go bhfeiceann an fhoireann, an t-úinéir agus an tacaíocht an amlíne chéanna, ní bhíonn aon bhearna eolais idir teachtaireachtaí, tascanna agus íocaíochtaí. Tá tuilleadh eolais faoi aisíocaíochtaí le fáil in [Aisíocaíochtaí](/hilfe/zahlungen/rueckerstattungen), agus faoi sheirbhísí breise in [Breiseáin & Seirbhísí Breise](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Áirithint a bhogadh",
          excerpt:
            "Mar seo a bhogann tú áirithint atá ann cheana go tréimhse nua gan an féilire a chur trí chéile.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Seiceáil sula mbogann tú" },
            {
              type: "p",
              text: "Sula mbogann tú áirithint, seiceáil an infhaighteacht sa tréimhse nua don mhaoin atá curtha in áirithe. Ní scaoileann myNextDays saor na hoícheanta a áirithíodh ar dtús go dtí go ndeimhnítear an tréimhse nua — ní thagann aon bhearna chun cinn ina bhféachtar go míchruinn ar an maoin mar shaor nó mar dhúbailtchurtha in áirithe.",
            },
            {
              type: "steps",
              items: [
                "Oscail an áirithint in Áirithintí.",
                "Roghnaigh „Bogadh“ agus cuir isteach an tréimhse nua.",
                "Seiceáil an infhaighteacht a thaispeántar do na dátaí nua.",
                "Deimhnigh an bogadh.",
                "Seiceáil an athraíonn an praghas mar gheall ar an líon nua oícheanta, agus cuir in oiriúint é más gá.",
              ],
            },
            { type: "h2", text: "Cad a tharlaíonn go huathoibríoch" },
            {
              type: "p",
              text: "Tar éis an deimhnithe, scaoiltear saor na sean-oícheanta san fhéilire i gceart agus cuirtear cosc ar na hoícheanta nua; nuashonraítear tairseacha nasctha. Cláraítear an próiseas in amlíne na háirithinte.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Má fuarthas an áirithint trí thairseach, féadfaidh a rialacha féin a bheith i gceist le bogadh ansin — seiceáil beartais na tairsí sula ndéanann tú athruithe móra.",
            },
            { type: "h2", text: "Difríochtaí íocaíochta" },
            {
              type: "p",
              text: "Má athraíonn an praghas mar gheall ar an mbogadh, cuir na rialacha íocaíochta in oiriúint dá réir — féach [Rialacha Íocaíochta](/hilfe/zahlungen/zahlungsregeln). Tuilleadh eolais faoin bpróiseas iomlán d'áirithint le fáil in [Amlíne na hÁirithinte](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Cealú & Aisíocaíocht",
          excerpt:
            "Mar seo a chealaíonn tú áirithint i gceart agus a spreagann tú aisíocaíocht más gá.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Áirithint a chealú" },
            {
              type: "p",
              text: "Scaoileann cealú an mhaoin saor láithreach don tréimhse a bhí curtha in áirithe — ar d'fhéilire féin agus ar gach tairseach nasctha araon. Seiceáil sula gcealaíonn tú cad iad na coinníollacha cealaithe a bhaineann leis an áirithint seo.",
            },
            {
              type: "steps",
              items: [
                "Oscail an áirithint in Áirithintí.",
                "Roghnaigh „Cealaigh“ agus cuir isteach cúis.",
                "Seiceáil an méid aisíocaíochta a mholtar.",
                "Deimhnigh an cealú.",
              ],
            },
            { type: "h2", text: "Aisíocaíocht a spreagadh" },
            {
              type: "p",
              text: "Má próiseáladh an íocaíocht trí sholáthraí íocaíochta nasctha, is féidir leat an aisíocaíocht a thionscnamh go díreach ón áirithint. Taispeántar an méid san airgeadra atá socraithe don mhaoin seo. Tuilleadh eolais faoin bpróiseas le fáil in [Aisíocaíochtaí](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Is féidir aisíocaíocht iomlán nó pháirteach a dhéanamh",
                "Taispeántar an próiseas in amlíne na háirithinte",
                "I gcás áirithintí ó thairseach, baineann rialacha na tairsí faoi seach freisin",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ní féidir cealú a chur ar ceal. Seiceáil an tréimhse agus an t-aoi go cúramach sula ndeimhníonn tú.",
            },
            { type: "h2", text: "Tar éis an chealaithe" },
            {
              type: "p",
              text: "Tá an mhaoin inchurtha in áirithe arís láithreach, agus marcáiltear tascanna oscailte a bhaineann leis an áirithint — an t-ullmhúchán, mar shampla — go huathoibríoch mar rud nach bhfuil ag teastáil a thuilleadh. Fanann an próiseas iomlán inrianaithe in [Amlíne na hÁirithinte](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Seiceáil isteach & Seiceáil amach",
          excerpt: "Mar seo a dhoiciméadaíonn tú teacht agus imeacht aoi i myNextDays.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Seiceáil isteach a chlárú" },
            {
              type: "p",
              text: "Marcálann an tseiceáil isteach tús an fhanachta agus tá sí úsáideach go háirithe le seiceáil isteach féin nó le lámhachtáil eochracha ón bhfoireann, chun stádas gach áirithinte a choinneáil cothrom le dáta.",
            },
            {
              type: "steps",
              items: [
                "Oscail an áirithint in Áirithintí.",
                "Roghnaigh „Seiceáil isteach“ ar lá an teachta.",
                "Cuir isteach nóta más gá, mar shampla am nó sonraí speisialta.",
              ],
            },
            { type: "h2", text: "Seiceáil amach agus lámhachtáil" },
            {
              type: "p",
              text: "Ag an tseiceáil amach, marcálann tú an fanacht mar chríochnaithe. Spreagann sé seo tasc glanta uathoibríoch don mhaoin i go leor cásanna, ionas go bhfuil sí réidh don chéad áirithint eile.",
            },
            {
              type: "ul",
              items: [
                "Is cuid d'amlíne na háirithinte iad seiceáil isteach agus amach",
                "Is féidir amanna a shainiú de réir maoine sna socruithe maoine",
                "Le rochtain soghluaiste, is féidir leis an bhfoireann seiceáil isteach agus amach a chlárú ar an láthair go díreach",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ní chuireann seiceáil amach a chailltear cosc go huathoibríoch ar thascanna eile — seiceáil stádais atá thar am go rialta in Áirithintí.",
            },
            { type: "h2", text: "Baint le tascanna" },
            {
              type: "p",
              text: "Tá dlúthbhaint idir seiceáil isteach agus amach agus tascanna agus an amlíne. Tuilleadh eolais faoin bpróiseas iomlán le fáil in [Amlíne na hÁirithinte](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Breiseáin & Seirbhísí Breise",
          excerpt:
            "Mar seo a thairgeann tú seirbhísí breise inchurtha in áirithe d'aíonna, ar nós bricfeasta nó aistrithe, agus a chláraíonn tú iad san áirithint.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Cad iad breiseáin" },
            {
              type: "p",
              text: "Is seirbhísí breise roghnacha iad breiseáin le háirithint — bricfeasta, teacht luath, aistriú nó seiceáil amach déanach, mar shampla. Cuirtear isteach iad de réir maoine agus is féidir leis an aoi féin nó le d'fhoireann iad a chur leis an áirithint.",
            },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin agus cruthaigh na seirbhísí breise atá uait faoi „Breiseáin“ le praghas.",
                "Oscail áirithint atá ann cheana in Áirithintí.",
                "Roghnaigh „Breiseán a chur leis“ agus roghnaigh an tseirbhís atá uait.",
                "Deimhnigh méid agus am na seirbhíse.",
              ],
            },
            { type: "h2", text: "Sonrascadh" },
            {
              type: "p",
              text: "Sonrascítear breiseáin in airgeadra na maoine faoi seach agus taispeántar iad mar mhír ar leith ar an sonrasc. Is féidir breiseáin a íocadh cheana a aisíoc go páirteach i gcás cealaithe.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Cuir breiseáin choitianta isteach go lárnach ar an maoin uair amháin — mar sin is féidir iad a chur le gach áirithint nua le cúpla cliceáil.",
            },
            { type: "h2", text: "Infheictheacht don aoi" },
            {
              type: "p",
              text: "Má tá an t-ardán nó do shuíomh gréasáin féin gníomhach, is minic gur féidir le haíonna breiseáin oiriúnacha a roghnú cheana le linn na háirithinte féin. Taispeántar gach breiseadh ansin in [Amlíne na hÁirithinte](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Is féidir breiseáin a ainmniú agus a phraghsáil go haonair de réir maoine",
                "Is féidir iad a chur leis níos déanaí tríd an áirithint ag am ar bith",
                "Aisíoctar breiseáin chealaithe go páirteach",
              ],
            },
          ],
        },
      ],
    },
  ],
};
