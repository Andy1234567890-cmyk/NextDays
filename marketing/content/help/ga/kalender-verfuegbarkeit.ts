import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Féilire & Infhaighteacht",
  description: "Plean áitíochta, Stop-Sell agus fanacht íosta.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Féilire",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "An plean áitíochta a léamh",
          excerpt: "Mar seo a léann tú áirithintí, infhaighteacht agus praghsanna sa phlean áitíochta i gceart.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Taispeánann an plean áitíochta duit ar an bpointe cé na hoícheanta atá curtha in áirithe, ar fáil nó coiscthe. I gcás maoine saoire, feiceann tú líne amháin do gach maoin; i gcás óstán, radharc neadaithe le líne amháin do gach catagóir seomra agus plean rátaí.",
            },
            { type: "h2", text: "Struchtúr an radhairc" },
            {
              type: "steps",
              items: [
                "Oscail an féilire tríd an mír roghchláir „Plean Áitíochta“.",
                "Roghnaigh an tréimhse a theastaíonn uait a fheiceáil ag an mbarr.",
                "Scag de réir maoine nó catagóire seomra aonair más gá.",
                "Cliceáil ar lá chun sonraí faoi phraghas agus infhaighteacht a oscailt.",
                "Cliceáil ar thréimhse chuirthe in áirithe chun an áirithint chomhfhreagrach a oscailt.",
              ],
            },
            { type: "h2", text: "Dathanna agus siombailí" },
            {
              type: "ul",
              items: [
                "Curtha in áirithe: tá an tréimhse áirithe le háirithint.",
                "Ar fáil: is féidir an lá a chur in áirithe ar gach cainéal gníomhach.",
                "Coiscthe: níl an lá inchurtha in áirithe mar gheall ar Stop-Sell nó cosc láimhe.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Seasann gach líne sa phlean áitíochta d'aonad inchurtha in áirithe amháin — seomra nó maoin saoire. Níl aon líne choimeádán ann do roinnt seomraí ag an am céanna.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Tuilleadh eolais faoi laethanta aonair a oscailt agus a dhúnadh go sonrach le fáil in [Infhaighteacht a shocrú](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Infhaighteacht a shocrú",
          excerpt: "Laethanta aonair nó tréimhsí a oscailt agus a dhúnadh go sonrach.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cinneann infhaighteacht an féidir maoin a chur in áirithe ar lá áirithe. Is féidir leat laethanta aonair nó tréimhsí iomlána a oscailt nó a dhúnadh, díreach sa phlean áitíochta.",
            },
            { type: "h2", text: "Tréimhse a chur in eagar" },
            {
              type: "steps",
              items: [
                "Oscail plean áitíochta na maoine atá uait.",
                "Marcáil an tréimhse atá uait trí chliceáil agus tarraingt.",
                "Roghnaigh „Infhaighteacht a athrú“ sa roghchlár gníomhaíochta.",
                "Deimhnigh ar cheart an tréimhse a oscailt nó a dhúnadh.",
                "Sábháil an t-athrú.",
              ],
            },
            { type: "h2", text: "Tionchar ar chainéil" },
            {
              type: "p",
              text: "Bíonn tionchar ag athrú infhaighteachta ar gach cainéal díolacháin ar a bhfuil an mhaoin infheicthe: tairseacha ar nós Booking, Airbnb agus a leithéidí, an t-ardán féin chomh maith leis an aip. Tarlaíonn an t-aistriú chuig na tairseacha go huathoibríoch sa chúlra.",
            },
            {
              type: "ul",
              items: [
                "Oscailt: bíonn an lá inchurtha in áirithe ar gach cainéal gníomhach.",
                "Dúnadh: imíonn an lá as an inchurtha in áirithe, ach fanann sé infheicthe san fhéilire.",
                "Ní bhíonn tionchar ag athrú infhaighteachta ar áirithintí atá ann cheana.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ná dún tréimhse leis an intinn í a chosc go hiomlán agus go buan ón díolachán — is í Stop-Sell an fheidhm cheart chuige sin, féach [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Cuireann Stop-Sell cosc láithreach ar lá ar gach cainéal díolacháin ag an am céanna.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is é Stop-Sell an bealach is tapúla chun lá amháin a bhaint go hiomlán as an díolachán. Murab ionann agus athrú infhaighteachta amháin, bíonn éifeacht dhian ag Stop-Sell láithreach ar gach cainéal ag an am céanna — ar na tairseacha, ar an ardán féin agus san aip.",
            },
            { type: "h2", text: "Stop-Sell a shocrú" },
            {
              type: "steps",
              items: [
                "Oscail plean áitíochta na maoine lena mbaineann.",
                "Roghnaigh an lá nó an tréimhse atá uait.",
                "Cliceáil ar „Stop-Sell a ghníomhachtú“ sa roghchlár gníomhaíochta.",
                "Deimhnigh an cosc.",
              ],
            },
            { type: "h2", text: "Cathain is ciallmhar é Stop-Sell" },
            {
              type: "ul",
              items: [
                "Obair chothabhála ghearrthéarmach nó fadhbanna teicniúla sa mhaoin.",
                "Cás speisialta nach dteastaíonn uait aon áirithint nua a fháil láithreach agus gan eisceacht ar bith.",
                "Cosc éigeandála tapa ar fud an ardáin ar fad, gan gach cainéal a chur in eagar go haonair.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Níl aon eisceacht shonrach cainéil ag Stop-Sell: má tá lá coiscthe, ní féidir le haon aoi é a chur in áirithe trí aon chainéal, ná fiú tríd an deasc fáilte nó iarratas díreach.",
            },
            {
              type: "note",
              variant: "info",
              text: "Le haghaidh úsáid féin bhuan nó cothabháil phleanáilte, oireann [Cosc Láimhe](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung) ina áit sin.",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Fanacht Íosta & Uasta",
          excerpt: "Cé chomh fada is féidir le haíonna fanacht ar a laghad nó ar a mhéad.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Le fanacht íosta agus uasta, socraíonn tú cé mhéad oíche is féidir le haoi a chur in áirithe ar a laghad nó ar a mhéad do lá teachta ar leith. Cuidíonn sé seo áirithintí gairide bearna a sheachaint nó do mhaoin a shuíomh go sonrach le haghaidh fanacht níos faide.",
            },
            { type: "h2", text: "Riail a shocrú" },
            {
              type: "steps",
              items: [
                "Oscail sa mhaoin an plean áitíochta nó an cluaisín „Praghsanna“.",
                "Roghnaigh an tréimhse lena mbaineann.",
                "Cuir isteach faoi „Fanacht Íosta“ an líon íosta oícheanta.",
                "Cuir isteach faoi „Fanacht Uasta“ líon uasta oícheanta más mian leat.",
                "Sábháil an riail.",
              ],
            },
            { type: "h2", text: "Cásanna úsáide tipiciúla" },
            {
              type: "ul",
              items: [
                "Ardshéasúr: fanacht íosta níos airde chun laethanta athraithe a chomhbhrú.",
                "Ísealshéasúr: fanacht íosta níos ísle chun níos mó áirithintí a cheadú.",
                "Fanacht uasta: ciallmhar nuair a chaithfidh maoin a bheith saor le haghaidh cothabhála nó úsáid eile ina dhiaidh sin.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Baineann an riail leis an lá teachta: ní féidir le haoi teacht ar feadh dhá oíche amháin ar lá le fanacht íosta trí oíche, fiú má tá na laethanta aonair ar fáil.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Comhcheangail fanacht íosta níos faide le [Lascainí Fanachta](/hilfe/preise-raten/aufenthaltsrabatte) chun an spreagadh d'aíonna a mhéadú.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Cosc Láimhe",
          excerpt: "Tréimhsí a chur in áirithe go sonrach le haghaidh úsáid féin nó cothabháil.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cuireann cosc láimhe tréimhse in áirithe san fhéilire gan aon áirithint aoi iarbhír a bheith i gceist — le haghaidh úsáid féin, obair chothabhála phleanáilte nó athchóiriú, mar shampla. Taispeántar an tréimhse sa phlean áitíochta cosúil le háirithint, ach tá sí aitheanta go soiléir mar chosc.",
            },
            { type: "h2", text: "Cosc a chruthú" },
            {
              type: "steps",
              items: [
                "Oscail plean áitíochta na maoine lena mbaineann.",
                "Marcáil an tréimhse atá uait.",
                "Roghnaigh „Cosc de láimh“ sa roghchlár gníomhaíochta.",
                "Cuir isteach cúis, m.sh. „Úsáid féin“ nó „Cothabháil“.",
                "Sábháil an cosc.",
              ],
            },
            { type: "h2", text: "An difríocht le Stop-Sell" },
            {
              type: "p",
              text: "Cuireann cosc láimhe tréimhse ar leith in áirithe go sonrach le haghaidh cuspóir sonrach, doiciméadaithe agus is féidir í a scaoileadh saor arís níos déanaí. Le haghaidh cosc éigeandála láithreach ar fud an ardáin gan tréimhse dhoiciméadaithe, is í Stop-Sell atá i gceist ina áit sin.",
            },
            {
              type: "ul",
              items: [
                "Cosc láimhe: pleanáilte, le cúis, le haghaidh úsáid féin nó cothabháil.",
                "Is féidir é a scaoileadh saor ag am ar bith nuair nach dteastaíonn an tréimhse a thuilleadh.",
                "Ní chomhairítear oícheanta coiscthe mar áirithint aoi agus ní bhíonn siad le feiceáil i bhforbhreathnú an ioncaim.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Scrios cosc láimhe a luaithe nach mbíonn feidhm leis an gcúis a thuilleadh — nó fanfaidh an mhaoin coiscthe gan ghá ar gach cainéal.",
            },
            {
              type: "note",
              variant: "info",
              text: "Le haghaidh cosc láithreach gan tréimhse phleanáilte, úsáid [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
