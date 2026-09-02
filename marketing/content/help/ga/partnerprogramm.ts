import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Clár Comhpháirtíochta",
  description: "Mol gnólachtaí, tóg foireann agus tuill sciar d'ioncam síntiús.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Conas a oibríonn sé",
      articles: [
        {
          slug: "ueberblick",
          title: "Forbhreathnú ar an gClár Comhpháirtíochta",
          excerpt: "Cé atá incháilithe, conas a ghintear coimisiún agus cad a fheiceann tú.",
          updated: "Dáta: Meán Fómhair 2026",
          body: [
            {
              type: "p",
              text: "Mar chomhpháirtí, molann tú myNextDays d'úinéirí réadmhaoine, d'ghníomhaireachtaí agus d'óstáin. Má chláraíonn gnó le do chód nó trí do nasc agus má íocann sé a bhillí síntiúis, gheobhaidh tú sciar d'ioncam glan an tsíntiúis ar feadh dhá mhí dhéag. Tá an scála de réir custaiméirí íocacha beo ar leathanach an chláir.",
            },
            { type: "h2", text: "Cé atá incháilithe le bheith ina chomhpháirtí" },
            {
              type: "ul",
              items: [
                "Daoine aonair agus cuideachtaí san AE, san Eilvéis nó sa Ríocht Aontaithe a bhfuil fíor-chainéal acu le hóstach: tionchair, comhairleoirí, gníomhaireachtaí, gnólachtaí dlí cánach, cumainn.",
                "Fiú custaiméirí myNextDays féin — ní réamhriachtanas é síntiús.",
                "Riachtanas san iarratas: cuntas meán sóisialta amháin ar a laghad (Instagram, TikTok, YouTube, Facebook, LinkedIn …) le seoladh, láimhseáil agus teacht. Suíomh Gréasáin nó nuachtlitir breise más mian leat.",
              ],
            },
            { type: "h2", text: "Conas a shanntar gnó duit" },
            {
              type: "steps",
              items: [
                "Roinneann tú do nasc (mynextdays.com/p/IHR-CODE) nó do chód.",
                "Feiceann an gnó an cód le linn an chláraithe sa réimse “Molta ag” agus deimhníonn sé é trína chur isteach — gan fianán.",
                "Leis an gcéad bhille síntiúis íoctha, tosaíonn an tréimhse dhá mhí dhéag.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Feiceann tú do chustaiméirí gan ainm (Custaiméir #1, #2 …) le tír, stádas agus méideanna — ní ainm ná ríomhphost riamh. Sannfar gnó d'aon chomhpháirtí amháin; buann an chéad cheann.",
            },
            { type: "h2", text: "Cad a gheobhaidh tú ar an deais" },
            {
              type: "ul",
              items: [
                "Forbhreathnú: rang, cliceanna, gnólachtaí cláraithe agus íocacha, coimisiún oscailte, iníoctha agus íoctha.",
                "Coimisiúin: gach bille síntiúis íoctha mar líne le bonn, ráta, méid agus stádas.",
                "Íocaíochtaí: go míosúil in aghaidh an airgeadra ón íosmhéid, le creidmheas (féinbhilleáil) mar admháil.",
                "Naisc & Ábhar: do chóid, ábhar margaíochta agus an lipéadú éigeantach in aghaidh na tíre.",
                "Teachtaireachtaí: an líne dhíreach chuig an bhfoireann comhpháirtíochta.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Foireann a thógáil: an coimisiún foirne",
          excerpt: "Comhpháirtithe a earcú a thagann isteach le do chód — agus sciar d'ioncam a gcuid custaiméirí a thuilleamh.",
          updated: "Dáta: Meán Fómhair 2026",
          body: [
            {
              type: "p",
              text: "Is féidir leat comhpháirtithe eile a thabhairt isteach i do fhoireann. Má dhéanann duine iarratas trí do nasc foirne (mynextdays.com/p/IHR-CODE?team=1) agus má chuireann sé do chód isteach go soiléir san iarratas, beidh sé mar chuid de d'fhoireann tar éis ceadú. Gheobhaidh tú coimisiún foirne ar ioncam glan síntiúis chustaiméirí do chomhpháirtithe foirne.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Braitheann ráta na foirne ar DO rang tráth na híocaíochta — ní ar mhéid do fhoirne. Tá na rátaí ar leathanach an chláir.",
                "Ní thagann do rang ach ó do chustaiméirí íocacha féin. Ní áirítear custaiméirí foirne don rang.",
                "Leibhéal amháin go díreach: ní thógann do chomhpháirtithe foirne a bhfoireann féin fút.",
                "Gan táille rannpháirtíochta, gan airgead chun comhpháirtí a earcú. Ní thagann coimisiún foirne ach ó ioncam síntiúis íoctha.",
                "Dhá mhí dhéag ón gcéad bhille íoctha de chuid an chustaiméara foirne ábhartha, fuinneog aisíocaíochta 30 lá, aisghabháil i gcás aisíocaíochta nó aisíocaíochta — mar atá leis an gcoimisiún féin.",
                "Ní thagann foráil foirne chun cinn ach amháin má tá tú féin agus do chomhpháirtí foirne ceadaithe; murach sin, cuirfear ar fionraí í.",
              ],
            },
            { type: "h2", text: "Anailís na Foirne" },
            {
              type: "p",
              text: "Faoi “Fhoireann” feicfidh tú gach comhpháirtí foirne le céim, custaiméirí íocacha, ioncam síntiúis a gcustaiméirí (30 lá agus iomlán) agus do choimisiún foirne uaidh sin — oscailte, iníoctha, íoctha — chomh maith le stair an dá mhí dhéag roimhe sin. Ní fheicfidh tú sonraí custaiméirí do chomhpháirtithe foirne; is leo féin iad.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Trí “Fhoireann” is féidir leat teacht ar do chomhpháirtithe foirne go díreach trí theachtaireacht — agus do urraitheoir ortsa.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Déanfar an fearann ríomhphoist céanna nó an cuntas bainc céanna idir urraitheoir agus comhpháirtí foirne a mharcáil agus a sheiceáil ag an bhfoireann comhpháirtíochta sula n-íoctar an coimisiún foirne.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Íocaíocht, Creidmheas agus Cánacha",
          excerpt: "Cathain a bheidh coimisiún iníoctha, conas a bhreathnaíonn an creidmheas agus cad iad na rialacha cánach.",
          updated: "Stádas: Meán Fómhair 2026",
          body: [
            {
              type: "steps",
              items: [
                "Cruthaítear líne choimisiúin leis an sonrasc síntiúis íoctha agus bíonn sí “oscailte” ar feadh 30 lá (fuinneog aisíocaíochta).",
                "Ina dhiaidh sin, bíonn sí iníoctha. Ar an gcéad lá den mhí, déanaimid gach líne iníoctha a bhailiú de réir airgeadra.",
                "Má tá an tsuim os cionn íosmhéid d'airgeadra, cruthaítear íocaíocht le creidmheas (féinbhilleáil). Ní gá duit sonrasc a eisiúint.",
                "Tar éis an aistrithe, taispeántar an íocaíocht mar “Íoctha” le tagairt sa phainéal.",
              ],
            },
            {
              type: "ul",
              items: [
                "Cuideachtaí: Tá an nóta droim ar ais muirir ar an gcreidmheas; is réamhriachtanas é uimhir CBL deimhnithe (seiceáil VIES).",
                "Daoine aonair: Ní thaispeánann an creidmheas CBL; caithfear an coimisiún a chánachas féin.",
                "Íocaíocht trí SEPA, Wise nó PayPal — cuir isteach na sonraí i do phróifíl; éilíonn athruithe do phasfhocal.",
                "Gan tiontú: Íoctar coimisiún i DKK i DKK, coimisiún in EUR in EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ní mór fógraíocht a bheith inaitheanta mar fhógraíocht — ag tús an phoist, i dteanga an phoist. Is féidir na foclaíocht atá ceadaithe de réir tíre a fháil faoi “Naisc & Ábhar”. D’fhéadfadh sárú a bheith mar thoradh ar bhlocáil.",
            },
          ],
        },
      ],
    },
  ],
};
