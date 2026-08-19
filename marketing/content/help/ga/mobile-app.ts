import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Aip Shoghluaiste",
  description: "Aip myNextDays le haghaidh ar an mbóthar.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Aip",
      articles: [
        {
          slug: "die-app",
          title: "Aip myNextDays",
          excerpt: "Cuntas amháin, ceithre thaithí: Aoi, Gníomhaireacht, Úinéir agus Ball Foirne.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is í aip myNextDays an t-ardán soghluaiste do do ghnó iomlán. Ní táirge ar leith í, ach aghaidh chomhchéime ar do dheais gréasáin — baineann an dá cheann leis an gcuntas céanna agus na sonraí céanna, ach tá an comhéadan optamaithe don bhóthar amháin.",
            },
            { type: "h2", text: "Ceithre thaithí in aon aip amháin" },
            {
              type: "ul",
              items: [
                "Aoi: áirithintí a fheiceáil, cumarsáid leis an ngnó, sonraí seiceála isteach a fháil.",
                "Gníomhaireacht: forbhreathnú a bhainistiú ar roinnt gnóthaí agus maoine.",
                "Úinéir: léargas cosanta ó athrú ar a chuid maoine féin, áitíocht agus tuairiscí.",
                "Ball Foirne: féilire, tascanna agus pleananna glanta don ghnáthobair laethúil.",
              ],
            },
            { type: "h2", text: "Cén taithí a fheiceann tú" },
            {
              type: "p",
              text: "Tar éis logáil isteach, taispeánann an aip an taithí cuí duit go huathoibríoch de réir do róil — an ról céanna atá i bhfeidhm ar an ndeais gréasáin freisin. Feiceann ball foirne le cearta teoranta go díreach na srianta céanna san aip agus a fheicfeadh sé sa bhrabhsálaí, mar go seiceáiltear an chead ar thaobh an fhreastalaí.",
            },
            {
              type: "note",
              variant: "info",
              text: "Tuilleadh eolais faoi róil agus cad is féidir le gach ceann acu a fheiceáil le fáil in [Róil & Ceadanna](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ní theastaíonn clárúchán ar leith uait don aip — logáil isteach le do chuid sonraí myNextDays atá ann cheana.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "An aip a shuiteáil & logáil isteach",
          excerpt: "Mar seo a íoslódálann tú aip myNextDays agus a logálann tú isteach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Tá aip myNextDays ar fáil do iOS agus Android. Déantar an logáil isteach leis na sonraí céanna atá ar an ndeais gréasáin — níl aon chuntas ar leith ná clárúchán nua ag teastáil.",
            },
            { type: "h2", text: "Suiteáil" },
            {
              type: "steps",
              items: [
                "Oscail an App Store (iOS) nó Google Play (Android).",
                "Déan cuardach ar „myNextDays“.",
                "Suiteáil an aip ar do fhón cliste nó táibléad.",
                "Oscail an aip tar éis an tsuiteáil.",
              ],
            },
            { type: "h2", text: "Logáil isteach" },
            {
              type: "steps",
              items: [
                "Tapáil ar „Logáil isteach“.",
                "Cuir isteach do sheoladh ríomhphoist agus do phasfhocal.",
                "Deimhnigh an ceist fíordheimhnithe dhá-fhachtóir más gá.",
                "Tagann tú go huathoibríoch isteach sa taithí atá cuí do do ról.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tá sonraí rochtana comhionann leis an ndeais gréasáin.",
                "Má baineadh do rochtain, coiscítear an logáil isteach san aip freisin láithreach.",
                "I gcás fadhbanna leis an bpasfhocal, úsáid „Pasfhocal Dearmadta“ go díreach san aip.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Logáil isteach ach amháin tríd an iontráil oifigiúil App Store „myNextDays“; ní iarrann an aip sonraí rochtana riamh lasmuigh den scáileán logála isteach.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Bainistiú ar an mbóthar",
          excerpt: "Áirithintí, teachtaireachtaí agus tascanna a láimhseáil go díreach ón bhfón cliste.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Oireann aip myNextDays go háirithe don ghnáthobair leanúnach ar an mbóthar: feiceann tú áirithintí reatha, freagraíonn tú do theachtaireachtaí aíonna agus déanann tú tascanna gan a bheith i do shuí ag ríomhaire — feictear athruithe i bhfíor-am ar an ndeais gréasáin freisin.",
            },
            { type: "h2", text: "Áirithintí faoi shúil" },
            {
              type: "p",
              text: "Sa rannóg „Áirithintí“, feiceann tú teacht agus imeacht, áitíocht agus stádas de réir maoine. Ní fheiceann Baill Foirne agus Glanadh ach an fhaisnéis atá ábhartha dóibh, gan praghsanna nó sonraí díolacháin.",
            },
            { type: "h2", text: "Teachtaireachtaí & Tascanna" },
            {
              type: "steps",
              items: [
                "Oscail an rannóg „Teachtaireachtaí“ chun iarratais aíonna a fhreagairt go díreach.",
                "Téigh go dtí „Tascanna“ chun na tascanna sannta duit a fheiceáil.",
                "Tapáil tasc chun sonraí a oscailt agus é a chríochnú.",
                "Marcáil glantacháin críochnaithe go díreach ar an láthair mar chríochnaithe.",
              ],
            },
            {
              type: "ul",
              items: [
                "Feictear teachtaireachtaí agus tascanna nua go beo, gan nuashonrú de láimh.",
                "Feictear tascanna críochnaithe láithreach ar an ndeais gréasáin freisin.",
                "Feiceann Úinéirí áirithintí agus tuairiscí a gcuid maoine, ach go léamh amháin.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Cuireann fógraí brú ar an eolas thú faoi theachtaireachtaí nua agus tascanna sannta, a luaithe a cheadaíonn tú iad seo i socruithe an ghléis.",
            },
          ],
        },
      ],
    },
  ],
};
