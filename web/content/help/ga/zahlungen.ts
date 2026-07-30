import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Íocaíochtaí & Sonraisc",
  description: "Soláthraithe íocaíochta, rialacha íocaíochta agus sonraisc.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Íocaíochtaí",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Soláthraí íocaíochta a nascadh",
          excerpt:
            "Mar seo a nascann tú Stripe nó PayPal le myNextDays chun íocaíochtaí a phróiseáil go huathoibríoch.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Soláthraithe atá ar fáil" },
            {
              type: "p",
              text: "Próiseálann myNextDays íocaíochtaí trí sholáthraithe íocaíochta nasctha. Tacaítear le Stripe agus PayPal faoi láthair — is féidir leat soláthraí amháin nó an bheirt le chéile a nascadh agus a úsáid ag brath ar an maoin nó ar mhian an aoi.",
            },
            {
              type: "steps",
              items: [
                "Oscail Cuntas agus téigh go dtí an rannóg „Íocaíochtaí“.",
                "Roghnaigh an soláthraí atá uait — Stripe nó PayPal.",
                "Lean bosca dialóige an naisc agus logáil isteach ag an soláthraí nó cruthaigh cuntas nua.",
                "Deimhnigh an nasc — athraíonn an stádas go „nasctha“.",
              ],
            },
            { type: "h2", text: "Cad a tharlaíonn ina dhiaidh sin" },
            {
              type: "p",
              text: "A luaithe atá soláthraí nasctha, is féidir leat naisc íocaíochta a sheoladh, éarlaisí a bhailiú agus aisíocaíochtaí a spreagadh go díreach ón áirithint. Próiseáiltear gach méid san airgeadra atá curtha isteach don mhaoin faoi seach.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Gan soláthraí nasctha, ní féidir leat íocaíochtaí a mharcáil ach de láimh mar fuarthas — ní bhíonn bailiú uathoibríoch indéanta ansin.",
            },
            { type: "h2", text: "Roinnt maoine, soláthraí amháin" },
            {
              type: "p",
              text: "Baineann nasc a chruthaítear uair amháin ar fud an chuntais le gach maoin agat. Socraíonn tú conas a oibríonn an bailiú go mion tríd [Rialacha Íocaíochta](/hilfe/zahlungen/zahlungsregeln). Déantar íocaíochtaí amach chugat ina dhiaidh sin tríd an soláthraí faoi seach, féach [Íocaíochtaí Amach](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Oireann Stripe d'íocaíochtaí cárta agus go leor modhanna íocaíochta áitiúla",
                "Tairgeann PayPal rogha eile atá eolach d'aíonna",
                "Is féidir an dá sholáthraí a scaradh agus a athnascadh go neamhspleách óna chéile",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Rialacha Íocaíochta",
          excerpt: "Socraigh cathain a bhíonn éarlais agus iarmhéid íocaíochta áirithinte dlite.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Éarlais agus iarmhéid" },
            {
              type: "p",
              text: "Cinneann rialacha íocaíochta conas a phróiseáiltear áirithint go hairgeadais — éarlais tráth na háirithinte agus iarmhéid roimh theacht, mar shampla, nó an méid iomlán láithreach. Baineann na rialacha le maoin ar leith agus is féidir iad a chur in oiriúint ag am ar bith.",
            },
            {
              type: "steps",
              items: [
                "Oscail an mhaoin agus téigh go dtí an rannóg „Rialacha Íocaíochta“.",
                "Roghnaigh an mbailítear éarlais, agus socraigh an céatadán.",
                "Socraigh cathain a bhíonn an t-iarmhéid dlite, líon áirithe laethanta roimh theacht, mar shampla.",
                "Sábháil na socruithe.",
              ],
            },
            { type: "h2", text: "Bailiú uathoibríoch" },
            {
              type: "p",
              text: "Má tá soláthraí íocaíochta nasctha, bailíonn myNextDays an éarlais agus an t-iarmhéid go huathoibríoch ag an am atá socraithe agus cuireann sé an t-aoi ar an eolas roimh ré le teachtaireacht.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ní bhíonn éifeacht ag rialacha íocaíochta ach ar áirithintí a bhfuil soláthraí íocaíochta nasctha leo. Gan soláthraí, marcálann tú íocaíochtaí de láimh san áirithint.",
            },
            { type: "h2", text: "Difríochtaí de réir cainéil" },
            {
              type: "p",
              text: "Ar thairseacha, féadfaidh a bpróiseáil íocaíochta féin a bheith i bhfeidhm ina áit — seiceáil coinníollacha na tairsí faoi seach sa chás sin. Le haghaidh áirithintí tríd an ardán féin nó tríd an suíomh gréasáin, bíonn do rialacha atá curtha isteach anseo i bhfeidhm i gcónaí. Tuilleadh eolais faoi nasc an tsoláthraí le fáil in [Soláthraí íocaíochta a nascadh](/hilfe/zahlungen/zahlungsanbieter-verbinden), agus faoi shonrascadh in [Sonraisc a chruthú](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Éarlais mar mhéid seasta nó céatadán indéanta",
                "Sprioc-am iarmhéide inroghnaithe go saor",
                "Ní bhíonn éifeacht ag athruithe ach ar áirithintí nua, ní siar i leith",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Sonraisc a chruthú",
          excerpt: "Mar seo a chruthaíonn tú sonrasc d'áirithint leis an seoladh sonraisc ceart.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Sonrasc a chruthú" },
            {
              type: "p",
              text: "Is féidir sonrasc a chruthú do gach áirithint — don aoi féin nó do chuideachta éagsúil, má tá an áirithint gnó.",
            },
            {
              type: "steps",
              items: [
                "Oscail an áirithint in Áirithintí.",
                "Roghnaigh „Sonrasc a chruthú“.",
                "Seiceáil nó comhlánaigh an seoladh sonraisc.",
                "Seiceáil na míreanna liostaithe — oíche, breiseáin, táillí.",
                "Cruthaigh an sonrasc agus seol chuig an aoi é.",
              ],
            },
            { type: "h2", text: "An seoladh sonraisc a choinneáil cothrom le dáta" },
            {
              type: "p",
              text: "Is féidir leat an seoladh sonraisc a chur isteach go díreach san áirithint nó é a fháil ón aoi tríd an deimhniú áirithinte. Gan seoladh iomlán, ní féidir sonrasc atá bailí go dlíthiúil a eisiúint i dtíortha áirithe.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Deimhnigh, i gcás custaiméirí gnó go háirithe, ainm agus seoladh na cuideachta — éilíonn ceartúcháin ina dhiaidh sin sonrasc ceartúcháin.",
            },
            { type: "h2", text: "Méideanna agus airgeadra" },
            {
              type: "p",
              text: "Taispeántar gach mír san airgeadra atá curtha isteach don mhaoin. Marcáiltear íocaíochtaí atá déanta cheana ar an sonrasc mar íocaíocht faighte. Léigh conas a thagann éarlais agus iarmhéid chun cinn in [Rialacha Íocaíochta](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Is féidir sonraisc a íoslódáil mar PDF",
                "Bíonn sonraisc cheartúcháin indéanta ag am ar bith i gcás athruithe",
                "Feictear breiseáin mar mhír ar leith",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Aisíocaíochtaí",
          excerpt:
            "Mar seo a aisíocann tú íocaíocht go hiomlán nó go páirteach nuair a chealaítear nó a athraítear áirithint.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Cathain atá aisíocaíocht ag teastáil" },
            {
              type: "p",
              text: "De ghnáth bíonn aisíocaíocht ag teastáil i gcás cealaithe, ach d'fhéadfadh sé a bheith ag teastáil freisin i gcás coigeartaithe praghais ina dhiaidh sin nó breiseán cealaithe.",
            },
            {
              type: "steps",
              items: [
                "Oscail an áirithint lena mbaineann in Áirithintí.",
                "Roghnaigh „Aisíocaíocht“ i rannóg íocaíochta na háirithinte.",
                "Cuir isteach an méid atá le haisíoc — go hiomlán nó go páirteach.",
                "Deimhnigh an aisíocaíocht.",
              ],
            },
            { type: "h2", text: "An próiseas tríd an soláthraí íocaíochta" },
            {
              type: "p",
              text: "Cuirtear an aisíocaíocht i gcrích tríd an soláthraí a úsáideadh don íocaíocht — Stripe nó PayPal — agus aistrítear í ar ais go díreach chuig modh íocaíochta bunaidh an aoi. Cláraítear an próiseas go huathoibríoch in amlíne na háirithinte.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Gan soláthraí íocaíochta nasctha, ní féidir aisíocaíocht a spreagadh go huathoibríoch — soiléirigh an aisíocaíocht go díreach leis an aoi sa chás seo.",
            },
            { type: "h2", text: "Tionchar ar choimisiúin" },
            {
              type: "p",
              text: "Cuirtear coimisiúin mhargaidh nó thairsí a bhí sonraiscithe cheana in oiriúint go páirteach i gcás aisíocaíochta. Tuilleadh eolais in [Coimisiúin a thuiscint](/hilfe/zahlungen/provisionen-verstehen). Sonraí faoin gcealú féin le fáil in [Cealú & Aisíocaíocht](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Bíonn aisíocaíochtaí páirteacha indéanta le haghaidh míreanna aonair",
                "Bíonn stádas na próiseála infheicthe san áirithint ag am ar bith",
                "Ní ritheann aisíocaíochtaí ach tríd an soláthraí bunaidh a úsáideadh",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Íocaíochtaí Amach",
          excerpt:
            "Mar seo a fhaigheann tú fáltas d'áirithintí íoctha amach ó na soláthraithe íocaíochta nasctha.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Conas a oibríonn íocaíochtaí amach" },
            {
              type: "p",
              text: "Bailítear íocaíochtaí isteach ar dtús ag an soláthraí íocaíochta nasctha. As sin, déantar íocaíocht amach chuig do chuntas bainc curtha isteach de réir rithim ghnáth an tsoláthraí faoi seach.",
            },
            {
              type: "steps",
              items: [
                "Oscail Cuntas agus téigh go dtí an rannóg „Íocaíochtaí“.",
                "Seiceáil stádas an tsoláthraí faoi seach faoi „Íocaíochtaí Amach“.",
                "Oscail radharc mionsonraithe an tsoláthraí más gá don stair iomlán íocaíochtaí amach.",
              ],
            },
            { type: "h2", text: "Cad a asbhaintear roimh an íocaíocht amach" },
            {
              type: "p",
              text: "Sula ndéantar an íocaíocht amach, cuirtear coimisiúin mhargaidh agus thairsí chomh maith le táillí soláthraí san áireamh. Mar sin ní ionann an méid a íoctar amach agus suim bhunaidh na háirithinte i gcónaí.",
            },
            {
              type: "note",
              variant: "info",
              text: "Míníonn [Coimisiúin a thuiscint](/hilfe/zahlungen/provisionen-verstehen) struchtúr beacht na n-asbhaintí.",
            },
            { type: "h2", text: "Roinnt maoine agus úinéirí" },
            {
              type: "p",
              text: "Má bhainistíonn tú maoine d'úinéirí éagsúla, sannaítear íocaíochtaí amach de réir na ráiteas úinéara atá curtha isteach. I gcás mírréireachtaí, seiceáil ar dtús stádas na n-áirithintí bunúsacha in Áirithintí.",
            },
            {
              type: "ul",
              items: [
                "Cinneann an soláthraí faoi seach rithim agus modh na híocaíochta amach",
                "Marcáiltear méideanna atá coinnithe siar, mar shampla le linn aisíocaíochtaí atá ar siúl",
                "Tá an stair iomlán le feiceáil go díreach ag an soláthraí",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Coimisiúin a thuiscint",
          excerpt:
            "Forbhreathnú ar chomhdhéanamh coimisiúin an mhargaidh agus na dtairseach agus cá sonrascaítear iad.",
          updated: "Nuashonraithe: Iúil 2026",
          body: [
            { type: "h2", text: "Dhá chineál coimisiúin" },
            {
              type: "p",
              text: "Le háirithintí trí myNextDays, is féidir dhá choimisiún dhifriúla a bheith ann: coimisiún an mhargaidh le haghaidh áirithintí tríd an ardán féin agus coimisiúin tairsí le haghaidh áirithintí a thagann isteach trí thairseacha nasctha ar nós Booking nó Airbnb. Tá an dá cheann neamhspleách óna chéile agus is féidir leo a bheith éagsúil ag brath ar bhealach dáilte na háirithinte.",
            },
            {
              type: "ul",
              items: [
                "Coimisiún an mhargaidh: baineann sé le háirithintí tríd an ardán myNextDays",
                "Coimisiún tairsí: ríomhtar é ag an tairseach faoi seach de réir a coinníollacha féin",
                "Ba cheart áirithintí díreacha trí do shuíomh gréasáin féin a mheas go neamhspleách air seo",
              ],
            },
            { type: "h2", text: "Cá bhfuil coimisiúin infheicthe" },
            {
              type: "steps",
              items: [
                "Oscail Cuntas agus téigh go dtí an rannóg „Billeáil“.",
                "Roghnaigh an mhí atá uait.",
                "Seiceáil an liosta de réir áirithinte leis an gcoimisiún gaolmhar.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Feiceann tú cén cainéal a d'úsáid áirithint go díreach ag an áirithint féin — míníonn sé sin cén coimisiún a bhí i bhfeidhm.",
            },
            { type: "h2", text: "Baint le híocaíochtaí amach" },
            {
              type: "p",
              text: "Asbhaintear coimisiúin as suim na háirithinte sula ndéantar an íocaíocht amach. Tuilleadh eolais faoin bpróiseas íocaíochta amach le fáil in [Íocaíochtaí Amach](/hilfe/zahlungen/auszahlungen). I gcás aisíocaíochta, ceartaítear an coimisiún comhfhreagrach go páirteach — taispeánann [Amlíne na hÁirithinte](/hilfe/reservierungen/buchungs-zeitleiste) an próiseas iomlán d'áirithint.",
            },
          ],
        },
      ],
    },
  ],
};
