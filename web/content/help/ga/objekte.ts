import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Maoine & Áiseanna",
  description: "Seomraí agus maoine saoire a chruthú agus a choinneáil cothrom le dáta.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Maoine a bhainistiú",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Maoin = aonad inchurtha in áirithe amháin",
          excerpt: "Cén fáth a bhfuil gach maoin i myNextDays ina haonad inchurtha in áirithe amháin.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "I myNextDays is aonad inchurtha in áirithe amháin i gcónaí í maoin — seomra amháin in óstán nó maoin saoire iomlán. Baineann an prionsabal seo, is cuma an teach saoire, árasán saoire nó óstán atá agat, agus is é bunchloch na hinfhaighteachta, na bpraghsanna agus na n-áirithintí é.",
            },
            { type: "h2", text: "Ní foirgneamh le seomraí faoi" },
            {
              type: "p",
              text: "Míthuiscint choitianta is ea foirgneamh óstáin a shamhlú mar mhaoin amháin le roinnt seomraí faoi. Níl sé sin ceadaithe i myNextDays. Má tá óstán agat le hocht seomra dhúbailte agus ceithre sheomra shingile, cruthaigh dhá mhaoin déag ar leith — ní maoin amháin le líon seomraí.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ní ann d'aon réimse ar nós “líon na seomraí” ar leibhéal na maoine d'aon ghnó. Tá gá le maoin ar leith le féilire agus praghsanna dá cuid féin do gach seomra.",
            },
            { type: "h2", text: "Maoine saoire" },
            {
              type: "p",
              text: "I gcás teach saoire nó árasán saoire, freagraíonn an mhaoin iomlán don aonad inchurtha in áirithe. Níl aon fhoroinnt bhreise anseo — is maoin neamhspleách í maoin saoire i gcónaí, le féilire dá cuid féin.",
            },
            { type: "h2", text: "Cén fáth a bhfuil sé seo tábhachtach" },
            {
              type: "ul",
              items: [
                "Tá féilire infhaighteachta dá cuid féin ag gach maoin — coisctear áirithintí dúbailte go beacht de réir maoine.",
                "Baineann praghsanna, áiseanna agus grianghraif le gach maoin ar leith, ní le foirgneamh.",
                "Baineann maoin le húinéir amháin i gcónaí — ní cheadaítear ilshannadh.",
                "Rialaítear infheictheacht cainéil (suíomh gréasáin, Ardán Margaidh, tairseacha) de réir maoine.",
              ],
            },
            {
              type: "p",
              text: "Léigh conas an cineál maoine ceart a roghnú do do sheomra nó do do mhaoin saoire in [Cineál maoine a shocrú](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Cineál maoine a shocrú",
          excerpt: "Catagóir, cineál eastáit réadaigh agus cineál tairisceana a shannadh i gceart.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Cinneann an cineál maoine conas a chuirtear do mhaoin in ord agus á scagadh ar thairseacha agus ar an Ardán Margaidh. Tá sé comhdhéanta de thrí réimse roghnúcháin atá ag brath ar a chéile, a rithfidh tú tríothu agus tú ag cruthú nó ag cur maoine in eagar.",
            },
            { type: "h2", text: "Na trí leibhéal roghnúcháin" },
            {
              type: "steps",
              items: [
                "Roghnaigh an chatagóir ar dtús — cóiríocht saoire nó óstán, mar shampla.",
                "Roghnaigh an cineál eastáit réadaigh bunaithe air sin — árasán saoire, teach saoire, seomra dúbailte nó seomra singil, mar shampla.",
                "Roghnaigh an cineál tairisceana — an mhaoin iomlán nó seomra príobháideach, mar shampla.",
                "Cuir isteach na réimsí breise a thaispeántar ag brath ar do rogha, mar shampla cineál leapa nó urlár.",
              ],
            },
            { type: "h2", text: "Cén fáth a bhfuil an t-ord tábhachtach" },
            {
              type: "p",
              text: "Braitheann na trí liosta anuas ar a chéile: cuireann rogha na catagóire teorainn leis na cineálacha eastáit réadaigh atá ar fáil, agus cuireann rogha an chineáil eastáit réadaigh teorainn leis na cineálacha tairisceana ansin. Mar sin ní thagann ach teaglaim chiallmhar chun cinn, mar a úsáidtear ar mhórthairseacha freisin.",
            },
            {
              type: "note",
              variant: "info",
              text: "Má athraíonn tú an chatagóir ina dhiaidh sin, seiceálann myNextDays an bhfuil an cineál eastáit réadaigh agus an cineál tairisceana fós ag teacht leis, agus iarrann sé ort athrogha a dhéanamh más gá.",
            },
            { type: "h2", text: "Cineál maoine a chur in eagar" },
            {
              type: "p",
              text: "Oscail an mhaoin atá uait faoi Maoine agus téigh go dtí an cluaisín Bunsonraí. Gheobhaidh tú na trí liosta ansin faoi Chineál Maoine. Nuair a shábhálann tú d'athrú, cuirtear an t-ord nua ar aghaidh chuig gach cainéal gníomhach.",
            },
            {
              type: "ul",
              items: [
                "Catagóir: an t-ord uilíoch (m.sh. cóiríocht saoire, óstán)",
                "Cineál eastáit réadaigh: an cineál maoine sonrach (m.sh. árasán saoire, seomra dúbailte)",
                "Cineál tairisceana: cad é atá á chur in áirithe go beacht (m.sh. an mhaoin iomlán, seomra príobháideach)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Áiseanna a choinneáil cothrom le dáta",
          excerpt: "Gnéithe áiseanna a roghnú agus a choinneáil cothrom le dáta.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Tá tionchar mór ag áiseanna maoine ar cé chomh maith agus a aimsítear agus a scagtar í ar thairseacha. Scagann aíonna go sonrach de réir gnéithe ar nós WiFi, cistin nó áit pháirceála — is féidir le sonraí atá in easnamh maoin a eisiamh ó thorthaí cuardaigh.",
            },
            { type: "h2", text: "Áiseanna a roghnú" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin agus téigh go dtí an cluaisín Áiseanna.",
                "Roghnaigh gach gné a bhaineann leat ón liosta réamhshocraithe.",
                "Cuir sonraí breise leis más gá, mar líon na n-áiteanna páirceála nó cineál na cistine.",
                "Sábháil na hathruithe — cuirtear ar aghaidh iad go huathoibríoch chuig gach tairseach ghníomhach.",
              ],
            },
            { type: "h2", text: "Cárb as a dtagann na gnéithe" },
            {
              type: "p",
              text: "Leanann liosta na n-áiseanna catalóg gnéithe na mórthairseach, ionas gur féidir do chuid sonraí a shannadh i gceart ansin. Níl gnéithe a cheap tú féin i gceist, mar ní fhéadfaí iad a aistriú go glan chuig tairseacha.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Deimhnigh na háiseanna tar éis gach athrú tógála — aerchóiritheoir nua nó seomra folctha breise, mar shampla — ionas go bhfanann na sonraí cothrom le dáta ar gach cainéal.",
            },
            { type: "h2", text: "Grúpaí gnéithe coitianta" },
            {
              type: "ul",
              items: [
                "Bunáiseanna: WiFi, téamh, aerchóiriú",
                "Cistin & Cothú: cistin lán-fheistithe, miasniteoir, meaisín caife",
                "Seomra folctha & Níochán: seomra folctha féin, meaisín níocháin, tuáillí",
                "Limistéar amuigh: balcóin, léibheann, gairdín, áit pháirceála",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Grianghraif & Cur síos",
          excerpt: "Íomhánna agus téacsanna éifeachtacha le haghaidh níos mó áirithintí.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Is iad grianghraif agus an cur síos an bonn cinnteoireachta is tábhachtaí d'aíonna. Ní féidir maoin a fhoilsiú go dtí go bhfuil grianghraf teidil amháin ar a laghad agus cur síos curtha isteach.",
            },
            { type: "h2", text: "Grianghraif a uaslódáil" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin agus téigh go dtí an cluaisín Grianghraif.",
                "Tarraing comhaid íomhá go dtí an limistéar uaslódála nó roghnaigh iad tríd an mbosca dialóige comhad.",
                "Socraigh grianghraf teidil — beidh sé le feiceáil i dtorthaí cuardaigh agus i dtíleanna.",
                "Cuir na grianghraif eile in ord ciallmhar trí iad a tharraingt.",
              ],
            },
            { type: "h2", text: "Cur síos a scríobh" },
            {
              type: "p",
              text: "Téigh go dtí an cluaisín Cur síos agus cuir isteach teideal chomh maith le téacs leanúnach. Déan cur síos ar shuíomh, ar chomharthaí sóirt agus ar spriocghrúpa na maoine go sonrach — is lú a éifeacht ar thairseacha frásaí ginearálta ná mionsonraí inláimhsithe.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ní cheadaítear grianghraif ó mhaoine eile nó ón idirlíon a úsáid — seiceálann tairseacha é seo agus is féidir leo maoine a chosc mura gcloítear leis.",
            },
            { type: "h2", text: "Moltaí do dheá-ghrianghraif" },
            {
              type: "ul",
              items: [
                "Cúig ghrianghraf ar a laghad, ceann amháin do gach seomra go hidéalach",
                "Formáid tírdhreacha, solas maith, gan uiscechomharthaí",
                "Taispeánann an grianghraf teidil an mhaoin ar bhealach fáiltiúil agus soiléir",
                "Nuashonraigh go rialta, go háirithe tar éis athchóirithe",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Áitíocht & Acmhainneacht",
          excerpt: "Líon uasta aíonna agus roinnt leapacha a chur isteach i gceart.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Socraíonn an acmhainneacht cé mhéad aoi atá in ann fanacht i maoin, agus seiceáiltear é le gach cuardach agus áirithint. Is cúis le hiarratais a dhiúltú nó le ró-áitíocht sonraí míchearta — ba cheart duit an dá rud a sheachaint.",
            },
            { type: "h2", text: "Acmhainneacht a chur isteach" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin agus téigh go dtí an cluaisín Acmhainneacht.",
                "Cuir isteach an líon uasta daoine fásta.",
                "Cuir isteach an líon uasta leanaí, má tá siad ceadaithe.",
                "Cuir isteach roinnt na leapacha de réir seomra, mar shampla leaba dhúbailte agus dhá leaba shingile.",
              ],
            },
            { type: "h2", text: "Teorainneacha na hacmhainneachta" },
            {
              type: "p",
              text: "Nuair a dhéantar iarratas áirithinte, seiceálann myNextDays go huathoibríoch an bhfuil líon na n-aíonna a iarradh laistigh den acmhainneacht atá curtha isteach. Diúltaítear d'iarratais a sháraíonn an acmhainneacht uasta, nó ní thaispeántar iad mar iníoctha in áirithe ar chor ar bith.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ní mhéadaíonn leaba bhreise nó cliabhán an acmhainneacht iarbhír ach amháin má chuireann tú isteach go sainráite í i roinnt na leapacha — seachas sin, fanann an líon uasta aíonna mar an gcéanna.",
            },
            { type: "h2", text: "Foinsí earráide coitianta" },
            {
              type: "ul",
              items: [
                "Líon uasta aíonna socraithe ró-ard cé nach bhfuil ach beagán leapacha ar fáil",
                "Líon na leanaí dearmadta cé go dtarraingíonn an mhaoin teaghlaigh",
                "Roinnt na leapacha gan nuashonrú tar éis athchóirithe",
              ],
            },
            {
              type: "p",
              text: "Mura n-oireann an acmhainneacht agus na háiseanna dá chéile, seiceáil freisin an cluaisín [Áiseanna](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Stádas & Infheictheacht na Maoine",
          excerpt: "An difríocht idir gníomhach/neamhghníomhach agus na trí ais chainéil.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            {
              type: "p",
              text: "Déanann myNextDays idirdhealú idir dhá rud a bhíonn measctha go minic: stádas na maoine (gníomhach nó neamhghníomhach) agus infheictheacht ar chainéil díolacháin aonair. Rialaíonn tú an dá rud seo ar leithligh óna chéile.",
            },
            { type: "h2", text: "Stádas na maoine" },
            {
              type: "p",
              text: "Ciallaíonn an stádas gníomhach go bhfuil maoin inreáchtaithe don díolachán go bunúsach. Cuireann an stádas neamhghníomhach maoin as feidhm go hiomlán — le linn athchóirithe fhadtéarmaigh, mar shampla. Ní féidir maoin neamhghníomhach a chur in áirithe ar aon chainéal, is cuma cén stádas atá ag na laisc chainéil.",
            },
            { type: "h2", text: "Na trí ais chainéil" },
            {
              type: "p",
              text: "Má tá maoin gníomhach, cinneann trí lasc neamhspleácha cá bhfuil sí infheicthe go díreach:",
            },
            {
              type: "ul",
              items: [
                "Suíomh Gréasáin — infheictheacht ar do shuíomh gréasáin myNextDays féin",
                "Ardán Margaidh — infheictheacht ar mhargadh domhanda myNextDays",
                "Tairseacha — infheictheacht ar Booking, Airbnb agus a leithéidí",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Tá na trí ais seo go hiomlán neamhspleách ar stádas na maoine agus ar a chéile. Is féidir le maoin ghníomhach, mar shampla, a bheith infheicthe ar an suíomh gréasáin amháin, ach ní ar thairseacha.",
            },
            { type: "h2", text: "Stádas a athrú" },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin agus téigh go dtí an cluaisín Forbhreathnú.",
                "Socraigh an stádas go gníomhach nó neamhghníomhach.",
                "Cuir na trí lasc chainéil sa chluaisín Infheictheacht in oiriúint freisin más gá.",
                "Sábháil an t-athrú — beidh éifeacht aige láithreach ar gach cainéal a bhaineann leis.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Le haghaidh cosc gearrthéarmach ar laethanta aonair, úsáid Stop-Sell san fhéilire ina áit sin — cuireann sé cosc go sonrach ar laethanta ar gach cainéal, gan an mhaoin iomlán a dhíghníomhachtú.",
            },
          ],
        },
      ],
    },
  ],
};
