import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Tascanna & Glanadh",
  description: "Pleananna glanta agus tascanna foirne a eagrú.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Gnó",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Tascanna a chruthú",
          excerpt: "Mar seo a chruthaíonn tú tasc nua do mhaoin nó do thréimhse.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cuireann tascanna gach rud a chaithfear a dhéanamh maidir le maoin le chéile — ó ghlanadh tar éis seiceáil amach go dtí obair chothabhála nó iarratais aoi. Baineann gach tasc le maoin amháin go beacht agus is féidir é a shannadh do bhall foirne.",
            },
            { type: "h2", text: "Tasc nua a chruthú" },
            {
              type: "steps",
              items: [
                "Oscail an rannóg „Tascanna“ sa phríomhroghchlár.",
                "Cliceáil ar „Tasc Nua“.",
                "Roghnaigh an mhaoin lena mbaineann.",
                "Tabhair teideal dó agus, más mian leat, cur síos roghnach.",
                "Socraigh dáta agus am dlite.",
                "Sábháil an tasc.",
              ],
            },
            { type: "h2", text: "Cineálacha tascanna" },
            {
              type: "p",
              text: "Chomh maith le tascanna saor, tá tascanna a chruthaítear go córasach ann freisin, glantacháin phleanáilte go huathoibríoch tar éis seiceáil amach, mar shampla. Tá siad seo nasctha cheana leis an maoin agus leis an bhfuinneog ama cheart, agus ní gá ach iad a shannadh do bhall foirne.",
            },
            {
              type: "ul",
              items: [
                "Tasc de láimh: cláraithe go saor, m.sh. cothabháil nó iarratas speisialta.",
                "Tasc glanta uathoibríoch: díorthaithe ó dháta na seiceála amach.",
                "Tasc athfhillteach: le haghaidh seiceálacha nó cigireachtaí rialta.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Sonraí faoin bpleanáil ama uathoibríoch le fáil in [Pleananna Glanta](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tabhair teidil bheachta — is minic nach bhfeiceann baill foirne sa radharc soghluaiste ach an teideal agus an mhaoin ar an bpointe.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Pleananna Glanta",
          excerpt: "Glantacháin a phleanáil go huathoibríoch tar éis na seiceála amach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cinntíonn plean glanta go gcruthaítear tasc glanta go huathoibríoch don mhaoin lena mbaineann tar éis gach seiceáil amach — gan ort gach áirithint a rianú go haonair. Laghdaíonn sé sin lámhachtálacha dearmadta agus cinntíonn sé próiseas iontaofa idir dhá fhanacht.",
            },
            { type: "h2", text: "Pleanáil uathoibríoch a ghníomhachtú" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin agus téigh go dtí an cluaisín „Glanadh“.",
                "Gníomhachtaigh „Glanadh a phleanáil go huathoibríoch tar éis seiceáil amach“.",
                "Socraigh cé mhéad ama a phleanáiltear don ghlanadh tar éis na seiceála amach.",
                "Socraigh foireann réamhshocraithe nó glantóir réamhshocraithe más mian leat.",
                "Sábháil an socrú.",
              ],
            },
            { type: "h2", text: "Comhoibriú leis an bhféilire" },
            {
              type: "p",
              text: "A luaithe a chealaítear nó a bhogtar áirithint, cuireann an tasc glanta gaolmhar é féin in oiriúint go huathoibríoch don dáta seiceála amach nua. Mar sin fanann an plean glanta i sioncrónú leis an stádas áitíochta iarbhír i gcónaí.",
            },
            {
              type: "ul",
              items: [
                "Cruthaítear glanadh go huathoibríoch le gach seiceáil amach le plean gníomhach.",
                "Má bhogtar an áirithint, bogtar an tasc glanta leis.",
                "Má chealaíonn aíonna an fanacht, baintear an tasc glanta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Gan plean glanta gníomhachtaithe, ní chruthaítear aon tasc go huathoibríoch — cruthaigh glantacháin ansin de láimh faoi [Tascanna a chruthú](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Tascanna a shannadh",
          excerpt: "Tascanna a shannadh go sonrach do ghlantóirí nó do bhaill foirne.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Chun tasc a chur i gcrích, sannann tú é do bhall foirne áirithe — glantóir nó fostaí le cúram cothabhála, mar shampla. Ní fheiceann ach an duine sannta an tasc ina fhorbhreathnú féin de réir réamhshocraithe.",
            },
            { type: "h2", text: "Tasc a shannadh de láimh" },
            {
              type: "steps",
              items: [
                "Oscail an tasc sa liosta „Tascanna“.",
                "Cliceáil ar „Sann“.",
                "Roghnaigh an ball foirne freagrach ón liosta.",
                "Deimhnigh an sannadh.",
              ],
            },
            { type: "h2", text: "Sannadh de réir maoine" },
            {
              type: "p",
              text: "Má tá maoin sannta go seasta cheana do ghlantóir, is féidir leat tascanna don mhaoin seo a shannadh go huathoibríoch don duine seo freisin. Sábhálann sé sin cliceanna le haghaidh glantacháin athfhillteacha agus laghdaíonn sé ceisteanna breise.",
            },
            {
              type: "ul",
              items: [
                "Sannadh de láimh: roghnaíonn tú féin an duine do gach tasc.",
                "Sannadh maoine seasta: téann tascanna nua don mhaoin seo go huathoibríoch chuig an duine curtha isteach.",
                "Bíonn duine freagrach amháin ag tasc i gcónaí.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ní fheiceann glantóirí agus baill foirne ach a gcuid tascanna sannta féin, ní aon sonraí airgeadais nó díolacháin na maoine.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Stádas Tascanna a rianú",
          excerpt: "Súil a choinneáil ar dhul chun cinn tascanna i bhfíor-am.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Téann gach tasc trí stádas soiléir — ó oscailte go ar siúl go críochnaithe. Mar sin feiceann tú ag am ar bith an mbeidh glanadh nó cothabháil réidh in am roimh an gcéad seiceáil isteach eile.",
            },
            { type: "h2", text: "Forbhreathnú stádais" },
            {
              type: "ul",
              items: [
                "Oscailte: cruthaíodh an tasc, ach níor tosaíodh air fós.",
                "Ar siúl: tá tosaithe ag an duine sannta ar an tasc.",
                "Críochnaithe: tá an tasc déanta agus deimhnithe.",
              ],
            },
            { type: "h2", text: "Stádas a nuashonrú" },
            {
              type: "steps",
              items: [
                "Oscail an tasc ón liosta „Tascanna“.",
                "Roghnaigh an stádas cuí, m.sh. „Ar siúl“ nó „Críochnaithe“.",
                "Cuir nóta gairid leis más gá, faoi rud éigin neamhghnách sa mhaoin, mar shampla.",
                "Sábháil an t-athrú.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Feictear athruithe stádais láithreach sa liosta tascanna roinnte — ní gá athlódáil de láimh.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Má tá glanadh fós oscailte go gairid roimh an gcéad seiceáil isteach eile, seiceáil an sannadh ar dtús sula ndéanann tú teagmháil leis an aoi.",
            },
          ],
        },
      ],
    },
  ],
};
