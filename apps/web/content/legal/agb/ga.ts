import type { LegalDoc } from "../types";

// Irische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer zuerst dort.
// § 5 Absatz 1–2 folgt inhaltlich Stripes offiziellem Empfehlungstext
// (Stripe Connected Account Agreement) — URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Téarmaí agus Coinníollacha Ginearálta do Ghníomhaireachtaí agus do Bhainisteoirí Réadmhaoine",
  stand: "Arna nuashonrú: 3 Iúil 2026",
  intro: [
    "Rialaíonn na Téarmaí agus Coinníollacha seo (na “Téarmaí” anseo feasta) úsáid ardán bogearraí myNextDays (an “tArdán” anseo feasta) ag gníomhaireachtaí, bainisteoirí réadmhaoine, tiarnaí talún agus úsáideoirí gnó eile (an “tÚsáideoir” anseo feasta).",
    "Is é [ainm dlíthiúil iomlán, foirm dhlíthiúil, seoladh agus sonraí cláir na cuideachta oibriúcháin — le comhlánú roimh fhoilsiú] a oibríonn an tArdán (“myNextDays” nó “muidne” anseo feasta).",
    "Tá an tArdán dírithe go heisiach ar ghnóthais de réir bhrí Alt 14 de Chód Sibhialta na Gearmáine (BGB) nó fhorálacha comhfhreagracha an bhallstáit ábhartha den AE. Níl sé dírithe ar thomhaltóirí.",
  ],
  sections: [
    {
      heading: "§ 1 Raon feidhme",
      paragraphs: [
        "Baineann na Téarmaí seo le gach conradh maidir le húsáid an Ardáin idir myNextDays agus an tÚsáideoir agus le gach seirbhís agus modúl a sholáthraítear tríd.",
        "Ní thiocfaidh téarmaí gnó de chuid an Úsáideora atá éagsúil, contrártha nó forlíontach chun bheith ina gcuid den chonradh ach amháin má tá myNextDays tar éis aontú go sainráite i bhfoirm téacs lena bhfeidhm.",
      ],
    },
    {
      heading: "§ 2 Ábhar an chonartha agus seirbhísí",
      paragraphs: [
        "Soláthraíonn myNextDays bogearraí néalbhunaithe don Úsáideoir chun cóiríocht saoire agus gnóthais lóistín a bhainistiú. Eascraíonn raon na bhfeidhmeanna as an gcur síos reatha ar na seirbhísí agus áirítear ann go háirithe:",
      ],
      list: [
        "bainistiú réadmhaoine, féilirí infhaighteachta agus áirithintí (córas bainistíochta réadmhaoine),",
        "nascadh le bealaí áirithinte tríú páirtí (m.sh. Booking.com, Airbnb) trí bhainisteoir bealaí,",
        "foilsiú fógraí trí bhealach áirithinte an Ardáin féin, myNextDays,",
        "cruthú suíomhanna gréasáin de chuid an Úsáideora féin tríd an tógálaí leathanach comhtháite,",
        "feidhmeanna cuntasaíochta, socraíochta agus tuairiscithe, lena n-áirítear ráitis úinéirí,",
        "cumarsáid le haíonna agus glacadh íocaíochtaí tríd an bpróiseáil íocaíochtaí chomhtháite (§ 5).",
      ],
    },
    {
      heading: "§ 3 Clárú, cuntas agus faisnéis an Úsáideora",
      paragraphs: [
        "Ní mór cuntas a chlárú chun an tArdán a úsáid. Tá dualgas ar an Úsáideoir faisnéis chruinn, reatha agus iomlán a sholáthar faoi féin agus faoina ghnó tráth an chláraithe agus le linn théarma iomlán an chonartha, agus í a nuashonrú gan mhoill mhíchuí aon uair a athraíonn sí.",
        "Ní mór sonraí rochtana a choinneáil faoi rún agus a chosaint ar rochtain tríú páirtithe. Ní mór don Úsáideoir myNextDays a chur ar an eolas gan mhoill mhíchuí má tá comharthaí ann go bhfuil a chuntas á mhí-úsáid.",
        "Ní féidir cuntas a aistriú. Cinntíonn an tÚsáideoir go gcomhlíonann gach duine a úsáideann an cuntas thar a cheann na Téarmaí seo.",
      ],
    },
    {
      heading: "§ 4 Ról myNextDays in áirithintí",
      paragraphs: [
        "Is idir an tÚsáideoir (nó an t-úinéir a ndéanann sé ionadaíocht air) agus an t-aoi faoi seach amháin a thugtar conarthaí lóistín i gcrích maidir leis an gcóiríocht a thairgtear ar an Ardán, ar bhealaí tríú páirtí nasctha nó ar shuíomh gréasáin an Úsáideora féin. Ní thagann myNextDays chun bheith ina pháirtí sa chonradh lóistín.",
        "Is é an tÚsáideoir amháin atá freagrach as cruinneas agus dlíthiúlacht ábhar na bhfógraí (cur síos, grianghraif, praghsanna, infhaighteacht, cánacha agus muirir).",
      ],
    },
    {
      heading: "§ 5 Próiseáil íocaíochtaí ag Stripe",
      paragraphs: [
        "Is é Stripe a sholáthraíonn na seirbhísí próiseála íocaíochtaí do ghníomhaireachtaí agus do bhainisteoirí réadmhaoine ar myNextDays agus tá siad faoi réir an [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), lena n-áirítear Téarmaí Seirbhíse Stripe (le chéile, “Comhaontú Seirbhísí Stripe”). Trí aontú leis na Téarmaí seo nó trí leanúint de bheith ag feidhmiú mar ghníomhaireacht nó mar bhainisteoir réadmhaoine ar myNextDays, aontaíonn an tÚsáideoir a bheith faoi cheangal ag Comhaontú Seirbhísí Stripe, a bhféadfaidh Stripe é a leasú ó am go ham.",
        "Mar choinníoll go gcumasóidh myNextDays seirbhísí próiseála íocaíochtaí trí Stripe, aontaíonn an tÚsáideoir faisnéis chruinn agus iomlán faoi féin agus faoina ghnó a sholáthar do myNextDays, agus údaraíonn sé do myNextDays an fhaisnéis sin agus sonraí idirbheart a bhaineann lena úsáid de na seirbhísí próiseála íocaíochtaí a sholáthraíonn Stripe a roinnt le Stripe.",
        "Is é an téacs conartha Béarla atá nasctha, arna leasú ó am go ham, a rialaíonn an caidreamh dlíthiúil le Stripe. Is í an chuideachta Stripe a ainmnítear i gComhaontú Seirbhísí Stripe (Stripe Payments Europe, Limited, Éire, faoi láthair) an páirtí conarthach d’úsáideoirí sa Limistéar Eorpach Eacnamaíoch. Próiseálann Stripe sonraí pearsanta de réir [Pholasaí Príobháideachais Stripe](https://stripe.com/privacy).",
        "Chun oibleagáidí reachtúla sainaitheanta agus fíoraithe a chomhlíonadh (lena n-áirítear ceanglais frith-sciúradh airgid agus “aithnigh do chustaiméir”), féadfaidh myNextDays agus Stripe tuilleadh faisnéise agus doiciméad tacaíochta a iarraidh tráth ar bith, go háirithe doiciméid aitheantais, faisnéis faoi úinéirí tairbhiúla agus sonraí cuntais bhainc. Mura soláthraítear an fhaisnéis nó na doiciméid a iarrtar laistigh den spriocdháta a socraíodh, féadfar glacadh íocaíochtaí nó eisíocaíochtaí a chur ar fionraí go hiomlán nó go páirteach go dtí go mbeidh an fhaisnéis iomlán.",
      ],
    },
    {
      heading: "§ 6 Eisíocaíochtaí, aisghlaonna muirir agus iarmhéideanna diúltacha",
      paragraphs: [
        "Déantar eisíocaíochtaí chuig an gcuntas bainc a sholáthraíonn an tÚsáideoir. Féadfaidh myNextDays sceideal na n-eisíocaíochtaí a choigeartú ar chúiseanna riosca, go háirithe i gcás cuntas nua, patrún idirbheart neamhghnách nó athbhreithnithe leanúnacha.",
        "Is é an tÚsáideoir a iompraíonn aisghlaonna muirir (chargebacks), aisíocaíochtaí agus aon táillí a eascraíonn astu a bhaineann le háirithintí an Úsáideora. Tá myNextDays i dteideal méideanna den sórt sin a fhritháireamh in aghaidh eisíocaíochtaí amach anseo.",
        "Má thagann iarmhéid diúltach chun cinn ar chuntas íocaíochta an Úsáideora, ní mór don Úsáideoir é a shocrú gan mhoill mhíchuí. Údaraíonn an tÚsáideoir do myNextDays agus do Stripe iarmhéideanna diúltacha a dhochrú ón gcuntas bainc atá ar comhad, a mhéid a cheadaítear le dlí.",
      ],
    },
    {
      heading: "§ 7 Táillí agus sonrascú",
      paragraphs: [
        "Eascraíonn na táillí as úsáid an Ardáin as an bpraghasliosta a comhaontaíodh tráth an chonartha nó as an tairiscint aonair. Ní áirítear sna praghsanna go léir na cánacha reachtúla is infheidhme, agus luaitear iad san airgeadra atá sonraithe sa chonradh.",
        "Féadfar táillí idirbheartbhunaithe (m.sh. táillí íocaíochta nó bealaigh) a choinneáil siar nó a fhritháireamh go díreach nuair a phróiseáiltear an t-idirbheart faoi seach.",
        "Má bhíonn an tÚsáideoir i riaráiste íocaíochta, féadfaidh myNextDays, tar éis fógra a thabhairt roimh ré, rochtain ar an Ardán a chur ar fionraí go dtí go mbeidh na méideanna gan íoc socraithe.",
      ],
    },
    {
      heading: "§ 8 Oibleagáidí an Úsáideora; téacsanna dlíthiúla dá chuid féin",
      paragraphs: [
        "Cinntíonn an tÚsáideoir go gcomhlíonann a chuid fógraí, ábhar agus cleachtas gnó na dlíthe is infheidhme, go háirithe dlí lóistín, clárúcháin, cánach agus cosanta tomhaltóirí ag suíomh na réadmhaoine. Coinníonn an tÚsáideoir gach cead, clárú agus ceadúnas riachtanach ar a fhreagracht féin.",
        "Tá an tÚsáideoir féin freagrach as suíomhanna gréasáin a oibríonn sé tríd an tógálaí leathanach agus as a chuid fógraí ar an Ardán; áirítear leis sin go háirithe téarmaí agus coinníollacha an Úsáideora féin d’aíonna, a fhógra dlíthiúil féin agus a fhaisnéis phríobháideachais féin.",
        "Tá cosc go háirithe ar an méid seo a leanas: fógraí míchruinne nó míthreoracha a fhoilsiú, idirbhearta bréige nó calaoiseacha a phróiseáil, an phróiseáil íocaíochtaí faoi § 5 a sheachaint i gcás áirithintí a tugadh i gcrích tríd an Ardán, agus aon úsáid a dhéanann dochar do shlándáil nó d’infhaighteacht an Ardáin.",
      ],
    },
    {
      heading: "§ 9 Bealaí áirithinte tríú páirtí",
      paragraphs: [
        "Agus bealaí tríú páirtí á nascadh (m.sh. Booking.com, Airbnb), beidh feidhm freisin ag téarmaí oibreoir an bhealaigh faoi seach. Is é an tÚsáideoir féin a thugann na conarthaí is gá chuige sin i gcrích go díreach le hoibreoir an bhealaigh.",
        "Déanann myNextDays sioncrónú teicniúil na hinfhaighteachta, na bpraghsanna agus na sonraí áirithinte, ach níl aon tionchar aige ar ábhar, ar choimisiúin ná ar chinntí oibreoirí na mbealaí agus níl sé faoi dhliteanas as a n-infhaighteacht.",
      ],
    },
    {
      heading: "§ 10 Infhaighteacht agus forbairt bhreise",
      paragraphs: [
        "Soláthraíonn myNextDays na seirbhísí le dúthracht gnó stuama agus tá sé mar aidhm aige ardinfhaighteacht an Ardáin a bhaint amach. Féadfaidh fuinneoga cothabhála, forbairt bhreise agus imthosca nach bhfuil faoi smacht myNextDays (m.sh. bristeacha ag soláthraithe tríú páirtí) an infhaighteacht a theorannú go sealadach.",
        "Féadfaidh myNextDays an tArdán a fhorbairt tuilleadh agus feidhmeanna a athrú, ar choinníoll nach gcuirtear cuspóir an chonartha i mbaol dá bharr agus go bhfuil an t-athrú réasúnta don Úsáideoir.",
      ],
    },
    {
      heading: "§ 11 Sonraí agus cosaint sonraí",
      paragraphs: [
        "I gcás ina bpróiseálann myNextDays sonraí pearsanta thar ceann an Úsáideora agus an tArdán á sholáthar (go háirithe sonraí aíonna), déanann na páirtithe comhaontú próiseála sonraí de bhun Airteagal 28 RGCS.",
        "Fanann an tÚsáideoir freagrach as dlíthiúlacht bhailiú agus phróiseáil na sonraí a chuireann sé isteach. Leagtar amach sonraí na próiseála sonraí ag myNextDays i bhfaisnéis phríobháideachais an Ardáin; baineann § 5 le próiseáil sonraí ag Stripe.",
      ],
    },
    {
      heading: "§ 12 Maoin intleachtúil",
      paragraphs: [
        "Is le myNextDays nó lena cheadúnóirí gach ceart san Ardán, ina bhogearraí agus ina ábhar (seachas an t-ábhar a chuireann an tÚsáideoir isteach). Le linn théarma an chonartha, faigheann an tÚsáideoir ceart simplí, neamh-inaistrithe an tArdán a úsáid a mhéid a comhaontaíodh sa chonradh.",
        "Deonaíonn an tÚsáideoir do myNextDays, maidir leis an ábhar a chuireann sé isteach, na cearta úsáide simplí atá riachtanach chun an tArdán a oibriú (go háirithe stóráil, atáirgeadh, taispeáint agus tarchur chuig bealaí nasctha).",
      ],
    },
    {
      heading: "§ 13 Dliteanas",
      paragraphs: [
        "Tá myNextDays faoi dhliteanas gan teorainn i leith intinne agus mórfhaillí agus i leith damáiste a eascraíonn as díobháil don bheatha, don chorp nó don tsláinte.",
        "I gcásanna gnáthfhaillí, níl myNextDays faoi dhliteanas ach amháin i leith shárú oibleagáidí conarthacha bunriachtanacha (oibleagáidí cairdinéalta), teoranta don damáiste intuartha is gnách don chonradh. Ní dhéantar difear don dliteanas faoin dlí um dhliteanas táirgí ná faoi ráthaíochtaí a glacadh.",
        "Maidir le cailliúint sonraí, níl myNextDays faoi dhliteanas ach a mhéid a tharlódh an damáiste fiú dá ndéanfadh an tÚsáideoir cúltacaí sonraí cuí rialta, mura bhfuil an cúltaca sonraí ina fhreagracht chonarthach ar myNextDays.",
      ],
    },
    {
      heading: "§ 14 Téarma, foirceannadh agus fionraí",
      paragraphs: [
        "Eascraíonn an téarma agus na tréimhsí fógra as an gconradh faoi seach. Ní dhéantar difear don cheart chun foirceannadh urghnách ar chúis mhaith.",
        "Féadfaidh myNextDays rochtain ar an Ardán nó ar fheidhmeanna aonair (lena n-áirítear glacadh íocaíochtaí agus eisíocaíochtaí) a chur ar fionraí go sealadach má tá comharthaí nithiúla ann go ndearnadh sárú ar na Téarmaí seo, calaois nó úsáid mhí-úsáideach, nó má cheanglaítear ar myNextDays é sin a dhéanamh le dlí nó le hordú ó sholáthraí seirbhíse íocaíochta. Cuirfear an tÚsáideoir ar an eolas faoin bhfionraí a mhéid a cheadaítear le dlí.",
        "Tar éis dheireadh an chonartha, cuirfidh myNextDays, arna iarraidh sin, sonraí an Úsáideora ar fáil le honnmhairiú i bhformáid choitianta laistigh de 30 lá; ina dhiaidh sin scriosfar na sonraí mura n-éilíonn oibleagáidí coinneála reachtúla a mhalairt.",
      ],
    },
    {
      heading: "§ 15 Athruithe ar na Téarmaí seo",
      paragraphs: [
        "Féadfaidh myNextDays na Téarmaí seo a leasú le héifeacht don todhchaí más gá sin ar chúiseanna bailí (go háirithe athruithe ar an reachtaíocht, ar an gcásdlí nó ar cheanglais soláthraithe seirbhíse íocaíochta) agus mura gcuirtear an tÚsáideoir faoi mhíbhuntáiste míréasúnta dá bharr.",
        "Fógrófar leasuithe don Úsáideoir i bhfoirm téacs sé seachtaine ar a laghad sula dtiocfaidh siad i bhfeidhm. Mura ndéanann an tÚsáideoir agóid laistigh de thréimhse an fhógra nó má leanann sé de bheith ag úsáid an Ardáin tar éis do na leasuithe teacht i bhfeidhm, measfar go bhfuil glactha leis na Téarmaí leasaithe; tarraingeofar aird go sonrach ar an iarmhairt seo san fhógra.",
      ],
    },
    {
      heading: "§ 16 Forálacha deiridh",
      paragraphs: [
        "Beidh feidhm ag dlí an stáit ina bhfuil oifig chláraithe an oibreora, gan Coinbhinsiún na Náisiún Aontaithe maidir le Conarthaí le haghaidh Díol Idirnáisiúnta Earraí a chur san áireamh. Ní dhéantar difear d’fhorálacha sainordaitheacha an stáit ina bhfuil oifig chláraithe an Úsáideora.",
        "Is é oifig chláraithe an oibreora — a mhéid a cheadaítear le dlí — an t-aon ionad dlínse le haghaidh gach díospóide a eascraíonn as an gconradh seo nó i dtaca leis.",
        "Má bhíonn nó má thagann forálacha aonair de na Téarmaí seo chun bheith neamhbhailí, ní dhéanfaidh sin difear do bhailíocht na bhforálacha eile.",
      ],
    },
  ],
};
