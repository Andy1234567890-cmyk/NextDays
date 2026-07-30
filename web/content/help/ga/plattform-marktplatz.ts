import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Ardán (Margadh)",
  description: "Díol ar Ardán Margaidh myNextDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Margadh",
      articles: [
        {
          slug: "der-marktplatz",
          title: "Ardán Margaidh myNextDays",
          excerpt: "Is cainéal áirithinte dá chuid féin é Ardán Margaidh domhanda myNextDays le hais na dtairseach agus an tsuímh ghréasáin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is é Ardán Margaidh myNextDays (/plattform) cainéal áirithinte domhanda myNextDays féin — inchomparáide le Booking nó Airbnb, ach mar chuid den ardán céanna. Cuardaíonn aíonna ansin maoine gach gnó nasctha agus déanann siad áirithint go díreach.",
            },
            { type: "h2", text: "Ní “Díreach”, ach cainéal comhchéime" },
            {
              type: "p",
              text: "Ní ionadaí é an tArdán Margaidh ar áirithint dhíreach trí do shuíomh gréasáin féin. Is tríú bealach dáilte neamhspleách é le hais infheictheachta dá chuid féin, bunachar aíonna dá chuid féin agus coimisiún dá chuid féin — díreach cosúil le tairseach, ach á rith ag myNextDays féin.",
            },
            { type: "h2", text: "Conas a thagann maoine ar an margadh" },
            {
              type: "ul",
              items: [
                "Caithfidh an mhaoin a bheith gníomhach (ceadaíonn stádas na maoine díolachán).",
                "Caithfidh infheictheacht an mhargaidh a bheith gníomhachtaithe — ar leithligh ó thairseacha agus ó shuíomh gréasáin.",
                "Caithfidh infhaighteacht a bheith san fhéilire don tréimhse atá uait.",
              ],
            },
            { type: "h2", text: "Áirithintí ón margadh" },
            {
              type: "p",
              text: "Cuireann áirithint ón margadh cosc láithreach ar na hoícheanta comhfhreagracha ar gach cainéal eile — díreach cosúil le háirithint ó thairseach nó ón suíomh gréasáin. Feictear í in d'fhéilire agus i d'áirithintí cosúil le gach áirithint eile, marcáilte leis an gcainéal „Ardán“.",
            },
            {
              type: "note",
              variant: "info",
              text: "Bíonn éifeacht ag Stop-Sell agus stádas neamhghníomhach maoine trasna na gcainéal agus cuireann siad cosc ar an margadh freisin — is cuma cén stádas atá ag lasc infheictheachta an mhargaidh.",
            },
            {
              type: "p",
              text: "Léigh conas maoin a ghníomhachtú don mhargadh in [Maoin a liostáil ar an margadh](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Maoin a liostáil ar an margadh",
          excerpt: "Lasc dá chuid féin í infheictheacht an mhargaidh, ar leithligh ó thairseacha agus ón suíomh gréasáin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Rialaíonn tú infheictheacht ar an margadh trí lasc dá chuid féin ar an maoin — is cuma an bhfuil an mhaoin chéanna infheicthe ar thairseacha nó ar do shuíomh gréasáin freisin.",
            },
            { type: "h2", text: "Mar seo a liostálann tú maoin" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin faoi Maoine.",
                "Téigh go dtí an cluaisín Infheictheacht.",
                "Gníomhachtaigh an lasc Ardán Margaidh.",
                "Deimhnigh go bhfuil stádas na maoine gníomhach agus infhaighteacht san fhéilire ann.",
              ],
            },
            { type: "h2", text: "Réamhriachtanas: próifíl iomlán" },
            {
              type: "p",
              text: "Ní thaispeánann an margadh ach maoine le sonraí iomlána — caithfidh grianghraf teidil, cur síos, áiseanna agus bunphraghas a bheith curtha isteach. Mura bhfuil sonraí riachtanacha ann, fanann an mhaoin dofheicthe fiú má tá an lasc gníomhachtaithe.",
            },
            {
              type: "ul",
              items: [
                "Grianghraf teidil amháin ar a laghad agus cur síos",
                "Gnéithe áiseanna ón liosta catagóire",
                "Acmhainneacht agus bunphraghas in airgeadra socraithe na maoine",
                "Infhaighteacht féilire don tréimhse atá uait",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Cliceáil ar Foilsigh, agus de ghnáth gníomhachtaíonn myNextDays an margadh, na tairseacha agus an suíomh gréasáin le chéile — is féidir leat lasc an mhargaidh a dhíghníomhachtú go haonair ina dhiaidh sin ag am ar bith.",
            },
            { type: "h2", text: "Infheictheacht a bhaint arís" },
            {
              type: "p",
              text: "Má dhíghníomhachtaíonn tú lasc an Ardáin Margaidh, imíonn an mhaoin ó chuardach an mhargaidh. Ní bhíonn tionchar ag seo ar áirithintí atá deimhnithe cheana, agus leanann siad ar aghaidh mar is gnách, féach [Coimisiún an Mhargaidh](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Coimisiún an Mhargaidh",
          excerpt: "Baineann an coimisiún atá curtha isteach sa phlean táillí le gach áirithint a dhéantar tríd an margadh.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cosúil le gach tairseach áirithinte, baineann coimisiún le háirithintí a thagann tríd an Ardán Margaidh myNextDays. Ríomhtar é de réir gach áirithint ar leith agus tá sé neamhspleách ar aon choimisiún ó thairseacha.",
            },
            { type: "h2", text: "Conas a ríomhtar an coimisiún" },
            {
              type: "p",
              text: "Braitheann an méid ar an gcoimisiún atá curtha isteach i bplean táillí do ghnó. Feiceann tú an ráta reatha ag am ar bith faoi Chuntas sa rannóg Billeáil — ní ghlactar leo aon luach uilíoch ann, ach taispeántar an ráta iarbhír atá i bhfeidhm do do phlean.",
            },
            { type: "h2", text: "Cá bhfeiceann tú an coimisiún" },
            {
              type: "steps",
              items: [
                "Oscail Cuntas sa roghchlár.",
                "Téigh go dtí an rannóg Billeáil.",
                "Oscail áirithint ón margadh chun ioncam agus coimisiún a fheiceáil go mion.",
                "Seiceáil forbhreathnú na gcoimisiún don tréimhse billeála reatha.",
              ],
            },
            { type: "h2", text: "Difríocht ó choimisiúin tairsí" },
            {
              type: "ul",
              items: [
                "Baineann coimisiún an mhargaidh go heisiach le háirithintí trí Ardán Margaidh myNextDays.",
                "Bíonn áirithintí ó thairseach (Booking, Airbnb agus a leithéidí) faoi choinníollacha na tairsí faoi seach.",
                "Bíonn áirithintí ón suíomh gréasáin faoi na coinníollacha atá curtha isteach do do phlean, gan coimisiún margaidh.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ríomhtar an coimisiún go huathoibríoch as do phlean táillí. Má tá plean in easnamh nó neamhshoiléir, faigheann tú teachtaireacht earráide shoiléir seachas luach measta.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Próifíl Aoi & Léirmheasanna",
          excerpt: "Bíonn próifíl le stair áirithinte ag aíonna an mhargaidh agus is féidir leo léirmheasanna a fhágáil.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cruthaíonn aíonna a chuireann áirithint in áirithe tríd an Ardán Margaidh myNextDays próifíl aoi dá gcuid féin. Bailítear ansin a gcuid áirithintí, teachtaireachtaí le gnóthaí agus léirmheasanna a tugadh — cosúil le cuntas aoi ar thairseach.",
            },
            { type: "h2", text: "Cad a fheiceann tú mar ghnó" },
            {
              type: "p",
              text: "I sonraí áirithinte áirithinte ón margadh, gheobhaidh tú próifíl an aoi le fanachtaí a bhí ann roimhe seo ag do ghnó agus, má thug an t-aoi cead, léirmheasanna atá le feiceáil go poiblí ar chóiríochtaí eile.",
            },
            { type: "h2", text: "Léirmheasanna tar éis an fhanachta" },
            {
              type: "steps",
              items: [
                "Tar éis na seiceála amach, faigheann an t-aoi iarratas léirmheasa.",
                "Feictear an léirmheas ar leathanach na maoine ar an margadh tar éis seiceáil ghairid.",
                "Is féidir leat mar ghnó freagra a thabhairt go poiblí ar gach léirmheas.",
                "Is féidir leat léirmheasanna neamhfhírinneacha nó mí-úsáideacha a chur isteach le haghaidh seiceála trí Tuairisc a dhéanamh.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tá léirmheasanna ceangailte le hairithint iarbhír — níl aon léirmheas gan fanacht.",
                "Déanann an t-aoi measúnú ar ghlaineacht, cumarsáid, suíomh agus luach ar airgead.",
                "Bíonn do fhreagra infheicthe do gach cuairteoir margaidh.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Bíonn tionchar díreach ag léirmheasanna maithe ar shuíomh do mhaoine i gcuardach an mhargaidh — freagair go tapa agus go réasúnach ar chriticeas.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Daoine Coiscthe",
          excerpt: "Is féidir le gnó cosc a chur ar aoi, rud a stopann teachtaireachtaí agus áirithintí.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Má bhíonn fadhbanna le haoi, is féidir leat, mar ghnó, cosc a chur air. Ní féidir le duine coiscthe teachtaireachtaí a sheoladh chugat a thuilleadh, ná áirithint nua a chruthú ag do ghnó.",
            },
            { type: "h2", text: "Duine a chosc" },
            {
              type: "steps",
              items: [
                "Oscail stair na dteachtaireachtaí nó an áirithint leis an aoi lena mbaineann.",
                "Cliceáil ar Cuir cosc ar aoi.",
                "Deimhnigh sa bhosca dialóige — bíonn éifeacht ag an gcosc láithreach.",
                "Feictear an duine coiscthe ina dhiaidh sin faoi Chuntas i Daoine Coiscthe.",
              ],
            },
            { type: "h2", text: "Cad a dhéanann an cosc" },
            {
              type: "ul",
              items: [
                "Ní féidir leis an aoi aon teachtaireacht nua a sheoladh chuig do ghnó a thuilleadh.",
                "Ní féidir leis an aoi aon áirithint nua a chruthú ag do ghnó.",
                "Ní bhaineann an cosc le hairithint reatha a bhfuil teacht deimhnithe cheana laistigh den dá sheachtain amach romhainn, ionas gur féidir an fanacht a láimhseáil i gceart.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ní bhaineann an cosc ach le do ghnó. Ní fheiceann gnóthaí eile ar an margadh an cosc agus ní bhíonn tionchar aige orthu.",
            },
            { type: "h2", text: "An cosc a bhaint arís" },
            {
              type: "p",
              text: "Oscail Cuntas agus Daoine Coiscthe ansin. Roghnaigh an iontráil agus cliceáil ar Bain an cosc — is féidir leis an aoi teachtaireachtaí a sheoladh agus áirithint a dhéanamh arís ina dhiaidh sin.",
            },
          ],
        },
      ],
    },
  ],
};
