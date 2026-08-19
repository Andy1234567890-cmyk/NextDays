import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Tógálaí Suímh Ghréasáin",
  description: "Do shuíomh gréasáin áirithinte féin a chruthú leis an tógálaí.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Tógálaí Suímh Ghréasáin",
      articles: [
        {
          slug: "website-erstellen",
          title: "Suíomh gréasáin a chruthú",
          excerpt: "Leis an tógálaí, cruthaíonn tú do shuíomh gréasáin áirithinte féin i gceann cúpla nóiméad.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cruthaíonn an Tógálaí Suímh Ghréasáin suíomh gréasáin áirithinte dá chuid féin duit — cainéal díolacháin breise le hais na dtairseach agus Ardán Margaidh myBestDays. Coinníonn tú lánsmacht ar struchtúr, ábhar agus branda.",
            },
            { type: "h2", text: "Mar seo a chruthaíonn tú suíomh gréasáin" },
            {
              type: "steps",
              items: [
                "Oscail Suíomh Gréasáin sa roghchlár.",
                "Cliceáil ar Suíomh gréasáin a chruthú.",
                "Roghnaigh teimpléad mar phointe tosaigh do do leagan amach.",
                "Deimhnigh le Maoin a chruthú — téann tú go díreach isteach san eagarthóir.",
              ],
            },
            { type: "h2", text: "Cad atá sa tógálaí" },
            {
              type: "ul",
              items: [
                "Eagarthóir amhairc le leathanaigh, sraitheanna agus radharc réamhamhairc",
                "Bloic réamhdhéanta le haghaidh liostaí maoine, gailearaithe agus foirmeacha teagmhála",
                "Bealach áirithinte díreach bunaithe ar infhaighteacht d'fhéilire",
                "Dathanna, clófhoirne agus lógó inchustamaithe atá oiriúnach do do bhranda",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Tosaigh le teimpléad atá gar do chineál do mhaoine — maoin saoire nó óstán — sábhálfaidh sé sin am duit ag cur na mbloc in oiriúint níos déanaí.",
            },
            { type: "h2", text: "An chéad chéim eile" },
            {
              type: "p",
              text: "Tar éis é a chruthú, cuireann tú leathanaigh agus leagan amach in oiriúint, féach [Leathanaigh & Leagan Amach a chur in eagar](/hilfe/website/seiten-layout), agus taispeánann tú do mhaoine ar an suíomh gréasáin, féach [Maoine a thaispeáint ar an suíomh gréasáin](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Leathanaigh & Leagan Amach a chur in eagar",
          excerpt: "Leathanaigh, sraitheanna agus bloic a chur in oiriúint san eagarthóir amhairc.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Tá an t-eagarthóir roinnte ina thrí limistéar: ar chlé forbhreathnú na leathanach agus na sraitheanna, sa lár réamhamharc do shuímh gréasáin, ar dheis socruithe an bhloic atá roghnaithe.",
            },
            { type: "h2", text: "Leathanach a chur in eagar" },
            {
              type: "steps",
              items: [
                "Roghnaigh ar chlé faoi Leathanaigh an leathanach atá uait.",
                "Cliceáil sa réamhamharc ar bhloc chun é a roghnú.",
                "Cuir téacs, íomhá nó spásáil an bhloic in oiriúint ar dheis.",
                "Tarraing bloic le tarraing-agus-scaoil chun an t-ord a athrú.",
              ],
            },
            { type: "h2", text: "Leathanaigh & bloic nua a chur leis" },
            {
              type: "p",
              text: "Trí chnaipe Leathanach a chur leis, cruthaíonn tú fo-leathanaigh bhreise, mar shampla Fúinn nó Teagmháil. Laistigh de leathanach, cuireann tú roinnt nua isteach trí Bloc a chur leis, ar nós gailearaí, léirmheasanna nó foirm teagmhála.",
            },
            {
              type: "ul",
              items: [
                "Bíonn Leathanach Baile, Forbhreathnú Maoine agus Teagmháil réamhchomhlánaithe le gach teimpléad",
                "Is féidir leathanaigh eile a ainmniú go saor agus a chur san loingseoireacht",
                "Tá bloic sofhreagracha agus curtha in oiriúint do dheasc, táibléad agus fón cliste",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Níl in athruithe san eagarthóir ach dréacht ar dtús. Ní ghlacann siad éifeacht ar do shuíomh gréasáin poiblí ach tar éis cliceáil ar Foilsigh.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Fearann a nascadh",
          excerpt: "Fearann dá chuid féin a nascadh le do shuíomh gréasáin myNextDays.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "De réir réamhshocraithe, tá do shuíomh gréasáin inrochtana trí fhofhearann myNextDays. Más mian leat fearann dá chuid féin a úsáid ina áit sin, mar shampla do-ghno.ie, nasc é sa rannóg Fearann.",
            },
            { type: "h2", text: "Fearann a chur isteach" },
            {
              type: "steps",
              items: [
                "Oscail sa Suíomh Gréasáin na Socruithe agus ansin Fearann.",
                "Cuir isteach do fhearann féin agus cliceáil ar Nasc.",
                "Cruthaigh na hiontrálacha DNS a thaispeántar ag do sholáthraí fearainn.",
                "Fan ar an dearbhú — déantar an tseiceáil go huathoibríoch sa chúlra.",
              ],
            },
            { type: "h2", text: "Iontrálacha DNS a shocrú i gceart" },
            {
              type: "p",
              text: "Taispeánann myNextDays na hiontrálacha beachta atá riachtanach do do sholáthraí fearainn duit. Ní bhíonn an nasc gníomhach go dtí go bhfuil na hiontrálacha seo socraithe i gceart agus scaipthe ar fud an domhain — is féidir go dtógfaidh sé sin cúpla uair an chloig ag brath ar an soláthraí.",
            },
            {
              type: "ul",
              items: [
                "Socraigh iontráil CNAME nó A de réir na treorach a thaispeántar",
                "Bain iontrálacha atá ann cheana agus atá contrártha don fhearann céanna ar dtús",
                "Eisítear teastas https go huathoibríoch tar éis nasc rathúil",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Gan iontrálacha DNS socraithe i gceart, fanann do shuíomh gréasáin dorochtana faoin bhfearann féin — seiceáil an litriú go cúramach in aghaidh sonraí do sholáthraí.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Maoine a thaispeáint ar an suíomh gréasáin",
          excerpt: "Rialaíonn tú go ar leithligh de réir maoine cé na maoine atá infheicthe agus inchurtha in áirithe tríd an suíomh gréasáin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Chun maoin a bheith le feiceáil ar do shuíomh gréasáin, caithfidh infheictheacht an tsuímh ghréasáin a bheith gníomhachtaithe don mhaoin sin. Tá an lasc seo neamhspleách ar infheictheacht ar Ardán Margaidh myBestDays nó ar thairseacha.",
            },
            { type: "h2", text: "Maoin a ghníomhachtú don suíomh gréasáin" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi Maoine.",
                "Téigh go dtí an cluaisín Infheictheacht.",
                "Gníomhachtaigh an lasc Suíomh Gréasáin.",
                "Téigh go dtí an Suíomh Gréasáin agus seiceáil an bloc Forbhreathnú Maoine sa réamhamharc.",
              ],
            },
            { type: "h2", text: "Ord & taispeáint a chur in oiriúint" },
            {
              type: "p",
              text: "Sa bhloc Forbhreathnú Maoine, socraíonn tú an ndéantar maoine a shórtáil go huathoibríoch de réir infhaighteachta nó an sonraíonn tú ord seasta. Taispeánann gach maoin grianghraf teidil, bunphraghas in airgeadra socraithe agus na príomhghnéithe áiseanna.",
            },
            {
              type: "ul",
              items: [
                "Sórtáil uathoibríoch de réir infhaighteachta nó ord de láimh",
                "Is féidir scagairí de réir cineál maoine nó áiseanna a ghníomhachtú go roghnach",
                "Ritheann na céimeanna áirithinte go díreach ar an suíomh gréasáin, gan aon timpeallán tairsí",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Fanann maoin gan infheictheacht suímh ghréasáin gníomhachtaithe i bhfolach ón bhforbhreathnú maoine, fiú má tá sí infheicthe ar an margadh nó ar thairseacha.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Suíomh gréasáin a fhoilsiú",
          excerpt: "Ní bhíonn dréachtaí infheicthe go poiblí go dtí go gcliceálann tú Foilsigh.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Fad is atá tú ag obair san eagarthóir, ní fheiceann ach tusa an dréacht reatha. Ní dhéantar na hathruithe infheicthe do gach cuairteoir faoi do fhearann go dtí go gcliceálann tú ar Foilsigh.",
            },
            { type: "h2", text: "Mar seo a fhoilsíonn tú" },
            {
              type: "steps",
              items: [
                "Oscail sa eagarthóir an réamhamharc agus seiceáil gach leathanach.",
                "Cliceáil ar Foilsigh sa chúinne uachtarach ar dheis.",
                "Deimhnigh sa bhosca dialóige — beidh an suíomh gréasáin beo díreach ina dhiaidh sin.",
                "Oscail do fhearann i gcluaisín nua chun an toradh a sheiceáil.",
              ],
            },
            { type: "h2", text: "Dréachtaí & Atosú" },
            {
              type: "p",
              text: "Fad is nach bhfuil tú fós foilsithe, is féidir leat filleadh ar an leagan poiblithe deireanach ag am ar bith gan an dréacht a chailleadh go deo — úsáid Cuir an dréacht ar leataobh sna Socruithe Suímh Ghréasáin chuige sin.",
            },
            {
              type: "ul",
              items: [
                "Bíonn athruithe foilsithe infheicthe láithreach faoi do fhearann",
                "Fanann dréacht neamhfhoilsithe inmheánach go dtí go ndeimhníonn tú é",
                "Coinnítear taifead de gach foilsiú le dáta sa stair",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Seiceáil an radharc soghluaiste sa réamhamharc sula bhfoilsíonn tú — is trí fhón cliste a osclaíonn formhór na n-aíonna suímh ghréasáin áirithinte.",
            },
          ],
        },
      ],
    },
  ],
};
