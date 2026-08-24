// KOPIE aus web/content/legal/agb/ga.ts — bewusst dupliziert, weil die
// Apps isoliert gebaut werden (ADR-0016): der Docker-Kontext dieser App
// enthält web/ nicht. Inhaltliche Änderungen IMMER in beiden Dateien.
// Zusätzlich zur web-Fassung: slug/metaDescription/numbered/toc für den
// Renderer dieser App.
import type { LegalDoc } from "../types";

// Irische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer zuerst dort.
// § 5 Absatz 1–2 folgt inhaltlich Stripes offiziellem Empfehlungstext
// (Stripe Connected Account Agreement) — URLs nicht verändern.
export const agb: LegalDoc = {
  slug: "agb",
  metaDescription:
    "Téarmaí agus coinníollacha ginearálta maidir le húsáid ardáin myNextDays ag gníomhaireachtaí agus tiarnaí talún.",
  numbered: false,
  toc: true,
  title: "Téarmaí agus Coinníollacha Ginearálta do Ghníomhaireachtaí agus do Bhainisteoirí Réadmhaoine",
  stand: "Arna nuashonrú: 13 Lúnasa 2026",
  intro: [
    "Rialaíonn na Téarmaí agus Coinníollacha seo (na “Téarmaí” anseo feasta) úsáid ardán bogearraí myNextDays (an “tArdán” anseo feasta) ag gníomhaireachtaí, bainisteoirí réadmhaoine, tiarnaí talún agus úsáideoirí gnó eile (an “tÚsáideoir” anseo feasta).",
    "Is é myNextDays ApS, cuideachta faoi theorainn scaireanna (anpartsselskab) faoi dhlí na Danmhairge, Hirtshalsvej 21, 9881 Bindslev, an Danmhairg, cláraithe i gClár Lárnach Gnólachtaí na Danmhairge (CVR) faoi uimhir CVR 46615182 a oibríonn an tArdán (“myNextDays” nó “muidne” anseo feasta).",
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
        "Braitheann conair na híocaíochta ar an gcainéal áirithinte. I gcás áirithintí a dhéantar trí inneall áirithinte an Úsáideora féin agus i gcás áirithintí trí thairseacha dáileacháin nasctha, faightear íocaíochtaí na n-aíonna go díreach isteach i gcuntas íocaíochta an Úsáideora; sna cásanna sin is é an tÚsáideoir, i leith an aoi, faighteoir na híocaíochta agus páirtí conartha na seirbhíse cóiríochta (§ 4), agus ní thagann myNextDays chun bheith ina shealbhóir ar na cistí sin ag am ar bith. Ní ghearrann myNextDays aon táille áirithinte céatadánach ar áirithintí den sórt sin; léirítear an coimisiún d'áirithintí trí thairseacha dáileacháin nasctha ar leithligh agus déantar é a bhilleáil ina dhiaidh sin.",
        "I gcás áirithintí a dhéantar trí thairseach áirithinte myNextDays, próiseáiltear an íocaíocht trí myNextDays. Coinníonn myNextDays an coimisiún idirghabhála atá leagtha amach sa liosta praghsanna atá i bhfeidhm ó am go ham, lena n-áirítear costas próiseála na híocaíochta, agus seolann sé an tsuim atá fágtha ar aghaidh chuig an Úsáideoir de réir na míreanna thíos. Níl aon éifeacht aige sin ar an táille as an mbogearra a úsáid (§ 7).",
        "Déantar eisíocaíochtaí chuig an gcuntas bainc a sholáthraíonn an tÚsáideoir. Féadfaidh myNextDays sceideal na n-eisíocaíochtaí a choigeartú ar chúiseanna riosca, go háirithe i gcás cuntas nua, patrún idirbheart neamhghnách nó athbhreithnithe leanúnacha.",
        "Is é an tÚsáideoir a iompraíonn go heacnamaíoch aisíocaíochtaí le haíonna. Iompraíonn an tÚsáideoir aisghlaonna muirir agus aon táillí a eascraíonn astu i gcás áirithintí a dhéantar trí a inneall áirithinte féin agus trí thairseacha dáileacháin nasctha, ós rud é gurb é an tÚsáideoir faighteoir na híocaíochta sna cásanna sin; i gcás áirithintí a dhéantar trí thairseach áirithinte myNextDays, iompraíonn myNextDays an riosca aisghlaonna muirir, mura n-eascraíonn sé as sárú dualgais ag an Úsáideoir (go háirithe gan an tseirbhís chóiríochta a sholáthar nó imeacht ábhartha uaithi). Tá myNextDays i dteideal suimeanna atá le hiompar ag an Úsáideoir a fhritháireamh in aghaidh eisíocaíochtaí sa todhchaí.",
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
      heading: "§ 12 Úsáid intleachta saorga",
      paragraphs: [
        "Baineann myNextDays úsáid as córais intleachta saorga i bhfeidhmeanna aonair, go háirithe le haghaidh moltaí praghsanna (praghsáil dhinimiciúil), le haghaidh moltaí freagra i mbosca isteach na dteachtaireachtaí agus le tacaíocht sa tseirbhís chustaiméirí. Gineann na feidhmeanna sin moltaí; is faoin Úsáideoir atá an cinneadh agus an fhreagracht as a n-úsáid. Ní ionann moltaí praghsanna agus measúnú tráchtála an Úsáideora féin.",
        "Má bhíonn aíonna ag idirghníomhú go díreach le córas intleachta saorga, nochtar sin dóibh (Airteagal 50(1) de Rialachán (AE) 2024/1689 — “an Gníomh um Intleacht Shaorga”). Ní mór don Úsáideoir téacsanna a ghin córas intleachta saorga nó a d’athraigh sé go substaintiúil agus a chuireann an tÚsáideoir ar aghaidh chuig aíonna a mharcáil mar sin, a mhéid a bhfuil oibleagáid dhlíthiúil air sin a dhéanamh.",
        "Ní oibríonn myNextDays aon chóras intleachta saorga a mheastar a bheith ina chóras ardriosca de réir Iarscríbhinn III den Ghníomh um Intleacht Shaorga, ná aon chleachtas atá coiscthe faoi Airteagal 5 den Ghníomh um Intleacht Shaorga. Ní úsáidtear ionchuir an Úsáideora ná sonraí a aíonna chun samhlacha a thraenáil gan treoir ar leith.",
        "Ní cead don Úsáideoir na feidhmeanna intleachta saorga a úsáid chun cuma chumarsáide daonna a chruthú d’aíonna san áit a bhfuil oibleagáid nochta ann, ná chun dearbhuithe atá ceangailteach ó thaobh dlí a dhéanamh gan scrúdú dá chuid féin.",
        "Má nascann an tÚsáideoir a chuntas, tríd an gcomhéadan atá ceaptha chuige sin, le cúntóir intleachta saorga dá chuid féin (mar shampla Claude ó Anthropic), tá feidhm ag an méid seo a leanas: tugann an tÚsáideoir an conradh maidir leis an tseirbhís sin i gcrích é féin agus tá sé freagrach as a húsáid. Is é an nasc sin a threoir chuig myNextDays na sonraí a scaoil sé a thabhairt ar aghaidh ansin — lena n-áirítear aistriú chuig tríú tír má tá an soláthraí lonnaithe lasmuigh den Aontas Eorpach. Cinntíonn an tÚsáideoir go bhfuil bunús dlí aige chuige sin, go n-ainmníonn a fhaisnéis phríobháideachais féin an faighteoir agus go bhfuil na cosaintí is gá don aistriú i bhfeidhm.",
        "Le haghaidh naisc dá leithéid, úsáideann an tÚsáideoir cineál rochtana a dtairgeann an soláthraí próiseáil sonraí thar ceann an rialaitheora lena aghaidh agus a chuireann úsáid na sonraí chun samhlacha a thraenáil as an áireamh — i gcás Claude, is iad na rochtana do chustaiméirí gnó (Team, Enterprise nó API) atá i gceist. Ní chomhlíonann rochtana d’úsáid phríobháideach an méid sin go rialta; níl siad oiriúnach do shonraí aíonna dá bharr. Ní féidir le myNextDays a aithint cén rochtain a úsáideann an tÚsáideoir, agus tarraingíonn sé aird air sin sa dialóg toilithe.",
        "Tugann an tÚsáideoir aird air nach mbíonn ábhar a chóipeálann sé de láimh as an gcomhéadan úsáideora isteach i réimse ionchuir an chúntóra clúdaithe go rialta ag srianta conarthacha an tsoláthraí — murab ionann agus na sonraí a fhaightear tríd an gcomhéadan.",
        "Sonraí a thagann ó phortál áirithinte, ní úsáideann an tÚsáideoir iad, fiú tríd an gcomhéadan, ach chun an áirithint faoi seach a láimhseáil agus freastal a dhéanamh air — ní chun daoine a mheas, ní chun próifílí a chruthú agus ní le haghaidh fógraíochta. Leagann na portáil an teorannú cuspóra sin síos ina dtéarmaí féin.",
      ],
    },
    {
      heading: "§ 13 Gearáin agus idirghabháil",
      paragraphs: [
        "Coinníonn myNextDays córas inmheánach saor in aisce um láimhseáil gearán d’úsáideoirí gnó (Airteagal 11 de Rialachán (AE) 2019/1150 — “an Rialachán P2B”). Is féidir gearáin — go háirithe faoi sháruithe líomhnaithe ar na Téarmaí seo, faoi fhadhbanna teicniúla a bhfuil tionchar suntasach acu nó faoi bhearta a ghlacann myNextDays i leith an Úsáideora — a chur isteach go neamhfhoirmiúil chuig info@mynextdays.dk nó tríd an tseirbhís tacaíochta sa fheidhmchlár. Admhaítear go bhfuarthas an gearán; déantar é a phróiseáil go pras agus laistigh de thréimhse réasúnta, agus i gcásanna simplí de ghnáth laistigh de 14 lá. Cuirtear an toradh in iúl don Úsáideoir i dteanga shoiléir.",
        "Mura dtagtar ar chomhaontú sa nós imeachta gearáin, tá myNextDays sásta dul, i gcomhar leis an Úsáideoir, chuig na hidirghabhálaithe seo a leanas lasmuigh de na cúirteanna (Airteagal 12 den Rialachán P2B): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Ginéiv 20, an Eilvéis — bíonn na nósanna imeachta ar fáil go cianda agus i níos mó ná teanga amháin; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 Cóbanhávan K, an Danmhairg — stát bunaíochta an oibreora.",
        "Ní chuireann an t-ainmniú sin d’oibleagáid ar an Úsáideoir nós imeachta idirghabhála a dhéanamh; ní dhéantar difear don cheart dul chun cúirte. Glacann myNextDays páirt i gcostais réasúnta idirghabhála; eascraíonn an roinnt as rialacha an idirghabhálaí faoi seach agus as imthosca an cháis aonair.",
        "Foilsíonn myNextDays go bliantúil faisnéis faoi líon na ngearán, faoi fhad na próiseála agus faoi na bearta a glacadh.",
      ],
    },
    {
      heading: "§ 14 Maoin intleachtúil",
      paragraphs: [
        "Is le myNextDays nó lena cheadúnóirí gach ceart san Ardán, ina bhogearraí agus ina ábhar (seachas an t-ábhar a chuireann an tÚsáideoir isteach). Le linn théarma an chonartha, faigheann an tÚsáideoir ceart simplí, neamh-inaistrithe an tArdán a úsáid a mhéid a comhaontaíodh sa chonradh.",
        "Deonaíonn an tÚsáideoir do myNextDays, maidir leis an ábhar a chuireann sé isteach, na cearta úsáide simplí atá riachtanach chun an tArdán a oibriú (go háirithe stóráil, atáirgeadh, taispeáint agus tarchur chuig bealaí nasctha).",
      ],
    },
    {
      heading: "§ 15 Dliteanas",
      paragraphs: [
        "Tá myNextDays faoi dhliteanas gan teorainn i leith intinne agus mórfhaillí agus i leith damáiste a eascraíonn as díobháil don bheatha, don chorp nó don tsláinte.",
        "I gcásanna gnáthfhaillí, níl myNextDays faoi dhliteanas ach amháin i leith shárú oibleagáidí conarthacha bunriachtanacha (oibleagáidí cairdinéalta), teoranta don damáiste intuartha is gnách don chonradh. Ní dhéantar difear don dliteanas faoin dlí um dhliteanas táirgí ná faoi ráthaíochtaí a glacadh.",
        "Maidir le cailliúint sonraí, níl myNextDays faoi dhliteanas ach a mhéid a tharlódh an damáiste fiú dá ndéanfadh an tÚsáideoir cúltacaí sonraí cuí rialta, mura bhfuil an cúltaca sonraí ina fhreagracht chonarthach ar myNextDays.",
      ],
    },
    {
      heading: "§ 16 Téarma, foirceannadh agus fionraí",
      paragraphs: [
        "Eascraíonn an téarma agus na tréimhsí fógra as an gconradh faoi seach. Ní dhéantar difear don cheart chun foirceannadh urghnách ar chúis mhaith.",
        "Féadfaidh myNextDays rochtain ar an Ardán nó ar fheidhmeanna aonair (lena n-áirítear glacadh íocaíochtaí agus eisíocaíochtaí) a chur ar fionraí go sealadach má tá comharthaí nithiúla ann go ndearnadh sárú ar na Téarmaí seo, calaois nó úsáid mhí-úsáideach, nó má cheanglaítear ar myNextDays é sin a dhéanamh le dlí nó le hordú ó sholáthraí seirbhíse íocaíochta. Cuirfear an tÚsáideoir ar an eolas faoin bhfionraí a mhéid a cheadaítear le dlí.",
        "Tar éis dheireadh an chonartha, cuirfidh myNextDays, arna iarraidh sin, sonraí an Úsáideora ar fáil le honnmhairiú i bhformáid choitianta laistigh de 30 lá; ina dhiaidh sin scriosfar na sonraí mura n-éilíonn oibleagáidí coinneála reachtúla a mhalairt.",
      ],
    },
    {
      heading: "§ 17 Athruithe ar na Téarmaí seo",
      paragraphs: [
        "Féadfaidh myNextDays na Téarmaí seo a leasú le héifeacht don todhchaí más gá sin ar chúiseanna bailí (go háirithe athruithe ar an reachtaíocht, ar an gcásdlí nó ar cheanglais soláthraithe seirbhíse íocaíochta) agus mura gcuirtear an tÚsáideoir faoi mhíbhuntáiste míréasúnta dá bharr.",
        "Fógrófar leasuithe don Úsáideoir i bhfoirm téacs sé seachtaine ar a laghad sula dtiocfaidh siad i bhfeidhm. Mura ndéanann an tÚsáideoir agóid laistigh de thréimhse an fhógra nó má leanann sé de bheith ag úsáid an Ardáin tar éis do na leasuithe teacht i bhfeidhm, measfar go bhfuil glactha leis na Téarmaí leasaithe; tarraingeofar aird go sonrach ar an iarmhairt seo san fhógra.",
      ],
    },
    {
      heading: "§ 18 Forálacha deiridh",
      paragraphs: [
        "Beidh feidhm ag dlí an stáit ina bhfuil oifig chláraithe an oibreora, gan Coinbhinsiún na Náisiún Aontaithe maidir le Conarthaí le haghaidh Díol Idirnáisiúnta Earraí a chur san áireamh. Ní dhéantar difear d’fhorálacha sainordaitheacha an stáit ina bhfuil oifig chláraithe an Úsáideora.",
        "Is é oifig chláraithe an oibreora — a mhéid a cheadaítear le dlí — an t-aon ionad dlínse le haghaidh gach díospóide a eascraíonn as an gconradh seo nó i dtaca leis.",
        "Má bhíonn nó má thagann forálacha aonair de na Téarmaí seo chun bheith neamhbhailí, ní dhéanfaidh sin difear do bhailíocht na bhforálacha eile.",
      ],
    },
  ],
};
