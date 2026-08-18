import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Téarmaí úsáide do aíonna",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Rialaíonn na téarmaí úsáide seo úsáid an tairsigh áirithinte myBestDays (dá ngairtear „an tArdán“ anseo feasta) ag taistealaithe agus ag daoine a dhéanann áirithintí (dá ngairtear „Aoi“ nó „tú“ anseo feasta).",
    `Is é oibreoir an Ardáin ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, an Danmhairg, uimhir CVR ${ANBIETER.cvr} (dá ngairtear „myBestDays“ nó „muid“ anseo feasta). Is trádmharc de chuid na cuideachta sin é myBestDays agus ní eintiteas dlítheanach ar leith é. Tá sonraí iomlána an tsoláthraí le fáil san [Eolas dlíthiúil](https://mybestdays.dk/rechtliches/impressum).`,
    "Trí úsáid a bhaint as an Ardán, aontaíonn tú leis na téarmaí seo. Léigh go cúramach iad, le do thoil.",
  ],
  summary: {
    heading: "Achoimre ar na téarmaí seo",
    paragraphs: [
      "Is margadh é myBestDays. Cuirimid an tArdán ar fáil ina dtairgeann soláthraithe a gcuid lóistín — ní sholáthraímid an lóistín féin. Déantar an conradh lóistín idir tú féin agus an soláthraí, ní linne.",
      "Tagann a bhfeiceann tú san fhógra ón soláthraí: cur síos, íomhánna, trealamh, praghas, coinníollacha cealaithe agus rialacha an tí. Seiceálaimid na fógraí, ach ní féidir linn seasamh le gach sonra ó sholáthraí.",
      "Is é an praghas a fheiceann tú agus an áirithint á tabhairt chun críche an praghas iomlán ar na seirbhísí a cuireadh in áirithe. Suimeanna breise nach mbíonn dlite ach ar an láthair (mar shampla táille turasóireachta nó éarlais) léirímid ar leith roimh ré.",
      "Má théann rud éigin amú, déan teagmháil linne ar dtús. Cuireann Alt A15 síos ar conas gearán a dhéanamh agus cé na bealaí atá ar fáil duit ina dhiaidh sin.",
      "Míníonn an achoimre seo na téarmaí ach ní ghlacann sí a n-áit. Is é an téacs iomlán atá ceangailteach.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Gach áirithint trí myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Sainmhínithe",
          paragraphs: [
            "Mínítear na téarmaí a úsáidtear sna coinníollacha seo sa ghluais ag deireadh na cáipéise. Is iad na cinn is tábhachtaí:",
          ],
          list: [
            "„Ardán“ — an suíomh gréasáin, na feidhmchláir shoghluaiste agus gach pointe rochtana eile trína dtaispeánann myBestDays lóistín agus trína ndéanann sé áirithintí a idirghabháil.",
            "„Soláthraí“ — an duine nádúrtha nó dlítheanach a thairgeann lóistín tríd an Ardán (óstach, léasóir, gníomhaireacht, óstán nó gnólacht lóistín).",
            "„Lóistín“ — an tseirbhís lóistín a thairgeann an soláthraí, is é sin réadmhaoin saoire nó aonad de chineál seomra nó réada.",
            "„Áirithint“ — áirithint lóistín do thréimhse shonraithe arna tabhairt i gcrích tríd an Ardán.",
            "„Praghas iomlán“ — an tsuim a thaispeántar agus an áirithint á tabhairt chun críche, lena n-áirítear gach cáin, táille agus formhuirear a ghearrtar tríd an Ardán.",
            "„Costais ar an láthair“ — suimeanna nach ngearrtar tríd an Ardán ach a bhíonn dlite don soláthraí (m.sh. táille turasóireachta, éarlais, glantachán deiridh de rogha an tsoláthraí).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Faoi na téarmaí seo",
          paragraphs: [
            "Baineann na téarmaí seo le gach úsáid den Ardán, is cuma an gcruthaíonn tú cuntas nó an dtagann áirithint chun cinn.",
            "Baineann Alt A le gach áirithint. Tá na rialacha forlíontacha maidir le lóistín in Alt B. I gcás contrárthachta, is ag Alt B atá tosaíocht.",
            "Maidir leis an tseirbhís lóistín féin, baineann coinníollacha an tsoláthraí lena mbaineann leis freisin (go háirithe rialacha an tí agus na coinníollacha cealaithe) atá luaite san fhógra. Cuirtear coinníollacha sin an tsoláthraí lenár gcinne; ní féidir leo maolú ar ár dtéarmaí a mhéid a bhaineann le do chaidreamh linne.",
            "Tá na téarmaí seo ar fáil i ngach ceann de na 24 theanga oifigiúla den Aontas Eorpach. I gcás neamhréireachtaí idir na leaganacha teanga, is ag an leagan Gearmáinise atá tosaíocht, mura bhforáiltear a mhalairt le forálacha sainordaitheacha do stáit chónaithe.",
            "Ní dhéanann na téarmaí seo difear do chearta sainordaitheacha tomhaltóirí faoi dhlí do stáit chónaithe.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Faoi myBestDays",
          paragraphs: [
            "Is margadh ar líne é myBestDays do lóistín saoire agus do ghnólachtaí lóistín. Oibrímid an tArdán ina gcuireann soláthraithe a gcuid lóistín i láthair agus ar féidir le haíonna iad a chur in áirithe.",
            "Is idirghabhálaí muid, ní soláthraí lóistín. Níl aon cheann de na lóistíní a thairgtear ar an Ardán faoinár seilbh, á oibriú, á bhainistiú ná á rialú againn agus ní páirtí sa chonradh lóistín muid.",
            "Is seirbhís idirghabhála é myBestDays de réir bhrí Rialachán (AE) 2022/2065 maidir le seirbhísí digiteacha. Tá ár sonraí agus ár nósanna imeachta faoin Rialachán sin le fáil faoi [An tAcht um Sheirbhísí Digiteacha](https://mybestdays.dk/rechtliches/dsa).",
            "Ní tionscnóir turas é myBestDays. Ní chuirimid pacáistí taistil le chéile de réir bhrí Threoir (AE) 2015/2302; maidir le socruithe taistil ceangailte féach A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Ár nArdán",
          paragraphs: [
            "Tagann ábhar fógra — cur síos, grianghraif, trealamh, teorainneacha áitíochta, praghsanna, infhaighteacht, coinníollacha cealaithe agus rialacha an tí — ón soláthraí lena mbaineann. Tá an soláthraí freagrach as a chruinneas agus as a iomláine.",
            "Seiceálaimid na fógraí roimh fhoilsiú agus ar bhonn leanúnach maidir le sáruithe follasacha ar ár [Rialacha maidir le hábhar oiriúnach](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Níl aon oibleagáid faireacháin ghinearálta ar an ábhar ar fad ann agus ní bheadh sí ceadaithe faoi Airteagal 8 de Rialachán (AE) 2022/2065 ach oiread.",
            "Mínímid conas a chuirimid torthaí cuardaigh in ord agus cé na tréithe a chinneann an t-ord san [Eolas faoi phraghsanna, rangú agus moltaí](https://mybestdays.dk/rechtliches/preisangaben).",
            "Déanaimid ár ndícheall Ardán a bheith ar fáil i gcónaí, ach níl infhaighteacht gan bhriseadh dlite againn. Is féidir cothabháil, mífheidhmeanna agus athruithe a bheith ann.",
            "Féadfaidh aistriúcháin ar ábhar soláthraithe a bheith cruthaithe go huathoibríoch. Is é an bunleagan a chuir an soláthraí isteach atá ceangailteach.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Ár luachanna",
          paragraphs: [
            "Táimid ag súil le hiompar measúil ó aíonna agus ó sholáthraithe. Ní ghlactar ar an Ardán le hidirdhealú de bharr bunaidh, dath craicinn, reiligiúin, creidimh, gnéis, féiniúlachta inscne, gnéaschlaonta, míchumais, aoise nó tréithe comhchosúla — féach [Beartas frithidirdhealaithe](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Maidir leis an iompar le linn na fanachta baineann [Bunrialacha d'aíonna](https://mybestdays.dk/rechtliches/grundregeln-gaeste), agus do sholáthraithe [Cód iompair na soláthraithe](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Do chuntas agus úsáid an Ardáin",
          paragraphs: [
            "Is féidir leat cuntas a chruthú le haghaidh áirithinte. Tá tú freagrach as rúndacht do shonraí rochtana agus cuirfidh tú in iúl dúinn láithreach má tá amhras ort faoi úsáid neamhúdaraithe.",
            "Ní féidir leat an tArdán a úsáid ach amháin má tá inniúlacht dhlíthiúil agat agus más féidir leat conarthaí a dhéanamh go bailí.",
            "Ní mór do shonraí ag clárú agus ag áirithint a bheith ceart agus iomlán — go háirithe ainm, sonraí teagmhála agus líon na dtaistealaithe. Teastaíonn na sonraí sin ón soláthraí chun an lóistín a chur ar fáil agus chun a oibleagáidí clárúcháin a chomhlíonadh.",
            "Ní cheadaítear go háirithe:",
          ],
          list: [
            "áirithintí bréagacha, íocaíochtaí calaoiseacha nó úsáid modhanna íocaíochta daoine eile gan údarás;",
            "sonraí a bhaint go huathoibríoch ón Ardán (scraping, crawler) níos faide ná mar a cheadaíonn ár gcomhad robots.txt;",
            "bearta a chuireann isteach ar an Ardán nó ar an mbonneagar taobh thiar de, a chuireann ró-ualach orthu nó a sheachnaíonn a mbearta slándála;",
            "ábhar mídhleathach, maslach nó míthreorach a chur i léirmheasanna, i dteachtaireachtaí nó i sonraí próifíle;",
            "iarracht an áirithint a chur i gcrích lasmuigh den Ardán tar éis don teagmháil teacht chun cinn tríd — féach [Táillí lasmuigh den ardán](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Praghsanna",
          paragraphs: [
            "Taispeántar gach praghas mar phraghas iomlán lena n-áirítear cánacha agus gach táille a ghearrtar tríd an Ardán, a luaithe atá sonraí an turais (tréimhse agus líon na dtaistealaithe) socraithe. Má bhíonn comhpháirt dlite ar an láthair amháin, léirímid ar leith í roimh an áirithint a thabhairt chun críche.",
            "Taispeántar praghsanna in airgeadra an fhógra. Má thaispeántar suim duit in airgeadra eile chomh maith, is comhshó neamhcheangailteach chun treoshuímh é sin; gearrtar in airgeadra an fhógra, mura léirítear a mhalairt le linn na híocaíochta.",
            "Féadfaidh praghsanna athrú go dtí go dtugtar an áirithint chun críche, mar shampla toisc go n-athraíonn an soláthraí iad nó go n-athraíonn an infhaighteacht. Is é an praghas a thaispeántar duit díreach roimh an áirithint cheangailteach agus a luaitear i ndeimhniú na háirithinte atá ceangailteach.",
            "Ní chuireann earráidí praghais follasacha (m.sh. suim atá mícheart de ord méide) ceangal orainn ná ar an soláthraí. Má aithnímid a leithéid d'earráid, cuirimid in iúl duit láithreach; is féidir leat an áirithint a chealú saor in aisce ansin.",
            "Tá sé leagtha amach san [Eolas faoi tháillí seirbhíse](https://mybestdays.dk/rechtliches/servicegebuehren) conas a chuirtear táillí seirbhíse le chéile. Maidir le cánacha agus tobhaigh féach an [Beartas cánach](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Íocaíocht",
          paragraphs: [
            "Próiseálann an soláthraí seirbhísí íocaíochta Stripe na híocaíochtaí tríd an Ardán. Bailíonn agus próiseálann Stripe na sonraí íocaíochta (m.sh. sonraí cárta) go díreach; ní stórálann myBestDays sonraí cárta iomlána.",
            "Braitheann sé ar an bhfógra cathain a bhíonn suim ar leith dlite — éarlais, an t-iarmhéid nó íocaíocht ar an láthair — agus léirítear é sin roimh an áirithint a thabhairt chun críche. Rialaíonn na [Téarmaí íocaíochta](https://mybestdays.dk/rechtliches/zahlungsbedingungen) na sonraí.",
            "Má fhoráiltear éarlais san fhógra, féadfar í a réamhúdarú nó a bhailiú agus, i gcás damáiste, í a choinneáil go hiomlán nó go páirteach; is iad sonraí an fhógra atá ceangailteach.",
            "Má theipeann ar íocaíocht nó má chúlaítear í, féadfar an áirithint a chealú. Féadfaidh an soláthraí leanúint de na suimeanna a d'eascair as a choinníollacha cealaithe a éileamh.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Beartais",
          paragraphs: [
            "Chomh maith leis na téarmaí seo baineann na beartais seo a leanas, ar cuid iad den chonradh eadrainn:",
          ],
          list: [
            "[Rialacha maidir le hábhar oiriúnach](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Beartas léirmheasanna](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Beartas frithidirdhealaithe](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Bunrialacha d'aíonna](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Coinníollacha cealaithe](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Beartas atháirithinte agus aisíocaíochta](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Beartas maidir le suaitheadh tromchúiseach](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Beartas cóipchirt](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Cosaint sonraí agus fianáin",
          paragraphs: [
            "Tá sé leagtha amach sa [Bheartas príobháideachais](https://mybestdays.dk/rechtliches/datenschutz) conas a phróiseálaimid sonraí pearsanta. Tá sé leagtha amach sa [Bheartas fianán](https://mybestdays.dk/rechtliches/cookies) cé na fianáin agus na teicneolaíochtaí comhchosúla a úsáidimid.",
            "Le haghaidh áirithinte cuirimid na sonraí ar aghaidh chuig an soláthraí a theastaíonn uaidh chun an tseirbhís lóistín a sholáthar. Is rialaitheoir neamhspleách é an soláthraí ina leith; baineann na [Caighdeáin cosanta sonraí d'óstaigh](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber) leis.",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Inrochtaineacht",
          paragraphs: [
            "Cuireann an [Ráiteas inrochtaineachta](https://mybestdays.dk/rechtliches/barrierefreiheit) síos ar staid inrochtaineachta an Ardáin agus ar an mbealach chun bacainní a thuairisciú.",
            "Tagann na sonraí faoi inrochtaineacht lóistín ón soláthraí. Má bhraitheann tú ar thréithe áirithe, soiléirigh iad leis an soláthraí roimh an áirithint tríd an bhfeidhm teachtaireachtaí.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Léirmheasanna agus ábhar úsáideoirí",
          paragraphs: [
            "Tar éis na fanachta is féidir leat léirmheas a fhágáil. Ní féidir léirmheas a fhágáil ach ag duine a chuir in áirithe tríd an Ardán agus a thosaigh nó a d'fhéadfadh a bheith tosaithe ar an bhfanacht — cinntímid ar an mbealach sin gur ó fhíor-aíonna a thagann na léirmheasanna a fhoilsítear.",
            "Ní íocaimid as léirmheasanna, ní athraímid a n-ábhar agus ní chuirimid léirmheas faoi chois toisc go bhfuil sé diúltach. Tá na sonraí agus na cúiseanna a mbainimid léirmheas anuas leagtha amach sa [Bheartas léirmheasanna](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Fanann tú freagrach as an ábhar a chuireann tú isteach — léirmheasanna, grianghraif, teachtaireachtaí, sonraí próifíle. Tugann tú dúinn ceart neamheisiach, gan teorainn spáis ná ama, saor in aisce chun an t-ábhar sin a atáirgeadh, a phróiseáil (m.sh. bearradh, aistriú) agus a chur ar fáil don phobal mar chuid d'oibriú agus de chur chun cinn an Ardáin. Is féidir leat d'ábhar a scriosadh; ní dhéanann sin difear d'úsáidí atá déanta cheana i mbailiúcháin atá foilsithe cheana.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Teachtaireachtaí agus cumarsáid leis an soláthraí",
          paragraphs: [
            "Téann teachtaireachtaí eadrat féin agus an soláthraí tríd an Ardán. Cuirimid an fheidhm teachtaireachtaí ar fáil, ach ní muidne seoltóir ná faighteoir an ábhair.",
            "Is féidir linn teachtaireachtaí a sheiceáil go huathoibríoch le haghaidh sáruithe ar na téarmaí seo (m.sh. sonraí teagmhála chun an tArdán a sheachaint, patrúin chalaoise, ábhar mídhleathach) agus na teachtaireachtaí lena mbaineann a choinneáil siar nó a bhaint. Cuirimid baint in iúl duit le réasúnú de réir A17.",
            "Seolaimid teachtaireachtaí chugat faoi d'áirithint (deimhniú, athruithe, eolas teachta) chuig an seoladh ríomhphoist a thug tú. Is cumarsáid chonarthach iad na teachtaireachtaí sin agus ní féidir díliostáil uathu fad a mhaireann an áirithint. Ní bhfaighidh tú teachtaireachtaí fógraíochta ach a mhéid a thug tú toiliú nó a cheadaíonn an dlí é gan toiliú; is féidir leat agóid a dhéanamh am ar bith.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Cearta maoine intleachtúla",
          paragraphs: [
            "Tá an tArdán, a dhearadh, a bhogearraí, a bhunachair shonraí, a théacsanna agus a thrádmharcanna cosanta. Faigheann tú ceart neamheisiach, neamhinaistrithe an tArdán a úsáid chun lóistín a chuardach agus a chur in áirithe — ní níos mó ná sin.",
            "Rialaíonn na [Rialacha maidir le trádmharcanna](https://mybestdays.dk/rechtliches/markenzeichen) úsáid ár dtrádmharcanna agus ár lógónna.",
            "Má cheapann tú go sáraíonn ábhar ar an Ardán do chóipcheart, lean an [Beartas cóipchirt](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Cad atá le déanamh má théann rud éigin amú",
          paragraphs: [
            "Má bhaineann an fhadhb leis an lóistín féin, déan teagmháil leis an soláthraí ar dtús — tríd an bhfeidhm teachtaireachtaí nó ar an láthair. Réitítear go leor fadhbanna ar an mbealach sin is tapa.",
            "Mura n-éiríonn leat leis an soláthraí nó má bhaineann an fhadhb leis an Ardán, leis an íocaíocht nó le próiseáil na háirithinte, déan teagmháil linne. Tá sé leagtha amach faoi [Gearáin agus réiteach díospóidí](https://mybestdays.dk/rechtliches/beschwerden) conas teagmháil a dhéanamh linn agus conas a phléimid le gearáin.",
            "Bíodh na nithe seo ullamh agat: uimhir na háirithinte, seoladh ríomhphoist na háirithinte, cur síos gairid ar an bhfadhb mar aon leis an gcaoi ar mhaith leat go gcabhróimis, agus na fianaise a bhaineann leis (grianghraif, teachtaireachtaí, admhálacha).",
            "Mura bhfuil an lóistín ar fáil ar theacht duit nó má tá sé éagsúil go substaintiúil ón bhfógra, baineann an [Beartas atháirithinte agus aisíocaíochta](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Aisghaireadh ardán an Choimisiúin Eorpaigh um réiteach díospóidí ar líne le Rialachán (AE) 2024/3228 agus scoir sé de bheith ag feidhmiú; níl sé ar fáil mar bhealach a thuilleadh. Tá sé leagtha amach faoi [Gearáin agus réiteach díospóidí](https://mybestdays.dk/rechtliches/beschwerden) cé na comhlachtaí a thagann ina áit.",
            "Má rinneamar beart in aghaidh d'ábhair nó do chuntais, is féidir leat, chomh maith lenár nós imeachta inmheánach gearán, dul chuig comhlacht um réiteach díospóidí lasmuigh den chúirt atá deimhnithe faoi Airteagal 21 de Rialachán (AE) 2022/2065. Níl a chinntí ceangailteach orainn.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Bearta in aghaidh iompair mhíchuí",
          paragraphs: [
            "Má sháraíonn tú na téarmaí seo nó ceann de na beartais atá luaite in A9, féadfaimid — de réir a chéile ag brath ar thromchúis, ar mhinicíocht agus ar iarmhairt an tsáraithe — ábhar a bhaint nó a infheictheacht a shrianadh, feidhmeanna a bhac, áirithintí a chealú nó do chuntas a bhac go sealadach nó go buan.",
            "Roimh bheart déanaimid scrúdú ar an gcás aonair. I gcás ábhair atá mídhleathach go follasach, i gcás contúirte do dhaoine nó i gcás calaoise, féadfaimid gníomhú láithreach.",
            "Tugaimid réasúnú duit ar gach beart agus léirímid an bealach gearáin duit — féach A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Ábhar mídhleathach a thuairisciú agus réasúnú beart",
          paragraphs: [
            "Is féidir le duine ar bith ábhar a mheasann sé a bheith mídhleathach a thuairisciú dúinn. Tá an nós imeachta tuairiscithe faoi Airteagal 16 de Rialachán (AE) 2022/2065, ár bpointí teagmhála agus an chaoi a bpléimid le tuairiscí leagtha amach faoi [An tAcht um Sheirbhísí Digiteacha](https://mybestdays.dk/rechtliches/dsa).",
            "Má dhéanaimid beart in aghaidh ábhair a chuir tú isteach nó in aghaidh do chuntais, gheobhaidh tú réasúnú ina luaitear an chúis, an bunús fíorasach, an bunús dlí nó an fhoráil chonarthach a sáraíodh, chomh maith leis na deiseanna gearáin.",
            "Is féidir leat gearán a dhéanamh saor in aisce in aghaidh gach birt laistigh de shé mhí. Is daoine a phléann leis na gearáin, ní bealaí uathoibríocha amháin.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Teorannú dliteanais",
          paragraphs: [
            "Táimid faoi dhliteanas gan teorainn i gcás intinne agus mórfhaillí, i gcás damáiste a eascraíonn as sárú ar an mbeatha, ar an gcorp nó ar an tsláinte, agus a mhéid a ghlacamar barántas orainn féin. Ní dhéantar difear d'éilimh faoin dlí dliteanais táirgí.",
            "Ina theannta sin, tá ár ndliteanas teoranta don damáiste intuartha a eascraíonn go tipiciúil as sárú ar na hoibleagáidí a bhfuil tú i dteideal muinín a chur ina gcomhlíonadh — agus ní ach a mhéid a cheadaíonn an dlí is infheidhme a leithéid de theorannú.",
            "Níl dliteanas orainn as soláthar na seirbhíse lóistín féin ná as iompar soláthraithe nó aíonna eile. Is é an soláthraí páirtí conarthach na seirbhíse lóistín.",
            "Níl dliteanas orainn as cruinneas na sonraí a chuir soláthraithe isteach, a mhéid nach raibh siad ar eolas againn agus nár ghá dúinn iad a bheith ar eolas. Chomh luath agus a fhaighimid eolas faoi shonra mídhleathach, gníomhaímid láithreach.",
            "Tá dliteanas breise eisiata. Ní dhéantar difear d'éilimh dhlíthiúla shainordaitheacha, go háirithe cearta tomhaltóirí.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. An dlí is infheidhme agus dlínse",
          paragraphs: [
            "Baineann dlí na Danmhairge — tá suíomh an oibreora sa Danmhairg — agus eisiatar Coinbhinsiún na Náisiún Aontaithe ar Chonarthaí um Dhíol Idirnáisiúnta Earraí. Ní dhéantar difear d'fhorálacha sainordaitheacha um chosaint tomhaltóirí an stáit ina bhfuil do ghnáthchónaí, de réir Airteagal 6 de Rialachán (CE) Uimh. 593/2008 (an Róimh I).",
            "Mar thomhaltóir is féidir leat agairt a dhéanamh orainn i gcúirt do chónaithe nó ag ár suíomh sa Danmhairg; ní féidir linne agairt a dhéanamh ort ach i gcúirt do chónaithe (Airteagail 17 go 19 de Rialachán (AE) Uimh. 1215/2012).",
            "Maidir leis an gconradh lóistín baineann de ghnáth dlí an stáit ina bhfuil an lóistín; i gcás caingne a eascraíonn as léasú maoine dochorraithe, tá dlínse eisiach ag a chúirteanna.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Socruithe taistil ceangailte",
          paragraphs: [
            "Ní dhéanann myBestDays idirghabháil ach ar sheirbhísí lóistín. Ní thairgimid eitiltí, gluaisteáin ar cíos, seirbhísí iompair, turais ná nithe is díol spéise agus ní chuirimid pacáistí taistil le chéile de réir bhrí Threoir (AE) 2015/2302.",
            "Má dhéanaimid idirghabháil amach anseo ar sheirbhísí taistil eile, cuirfimid in iúl duit roimh an áirithint leis an bhfoirm chaighdeánach atá forordaithe le dlí cé acu an dtagann pacáiste taistil nó socrú taistil ceangailte chun cinn agus cé na cearta a eascraíonn duit as.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Ré, bac agus foirceannadh",
          paragraphs: [
            "Tá an conradh maidir le húsáid an Ardáin ar feadh tréimhse éiginnte. Is féidir leat do chuntas a scriosadh am ar bith gan cúiseanna a lua; ní dhéanann sin difear d'áirithintí atá ann cheana agus déantar iad a phróiseáil de réir choinníollacha an tsoláthraí lena mbaineann.",
            "Is féidir linn an conradh úsáide a fhoirceannadh le fógra 14 lá. I gcás sárú tromchúiseach ar na téarmaí seo is féidir linn foirceannadh gan fógra agus an cuntas a bhac.",
            "Tar éis an fhoirceanta scriosaimid do shonraí, a mhéid nach bhfuil oibleagáid dlíthiúil coinneála nó leas dlisteanach coinneála ina choinne; rialaíonn an [Beartas príobháideachais](https://mybestdays.dk/rechtliches/datenschutz) na sonraí.",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Clásal leasaithe",
          paragraphs: [
            "Is féidir linn na téarmaí seo a leasú má tá cúis oibiachtúil leis — mar shampla staid dhlíthiúil athraithe, cásdlí na gcúirteanna is airde, feidhmeanna nua nó feidhmeanna a scoireadh den Ardán nó bearnaí rialála a dhúnadh.",
            "Fógraímid leasuithe i bhfoirm théacsúil 30 lá ar a laghad roimh theacht i bhfeidhm. Mura ndéanann tú agóid faoi theacht i bhfeidhm, meastar go bhfuil na téarmaí leasaithe glactha; tarraingímid aird ar leith ar an iarmhairt sin san fhógra. Má dhéanann tú agóid, is féidir linn an conradh úsáide a fhoirceannadh ar dháta an teacht i bhfeidhm.",
            "Maidir le háirithintí atá tugtha i gcrích cheana baineann na téarmaí sa leagan a bhí i bhfeidhm tráth na háirithinte.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Lóistín",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Raon feidhme an ailt seo",
          paragraphs: [
            "Baineann an t-alt seo le háirithint lóistín tríd an Ardán — réadmhaoine saoire chomh maith le seomraí agus aonaid gnólachtaí lóistín.",
            "Comhlánaíonn sé Alt A. I gcás contrárthachtaí is ag an Alt B seo atá tosaíocht.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. An caidreamh conarthach",
          paragraphs: [
            "Déantar an conradh lóistín go heisiach idir tú féin agus an soláthraí. Ní páirtí conarthach é myBestDays.",
            "Is cuireadh chugat é lóistín a chur i láthair ar an Ardán chun tairiscint áirithinte a dhéanamh. Trí chliceáil ar an gcnaipe áirithinte le hoibleagáid íocaíochta déanann tú tairiscint cheangailteach.",
            "Déantar an conradh nuair a dheimhnítear an áirithint. Seolaimid deimhniú na háirithinte chuig an seoladh ríomhphoist a thug tú; luaitear ann an soláthraí, an tseirbhís a cuireadh in áirithe, an tréimhse, an praghas iomlán agus na coinníollacha cealaithe.",
            "I gcás lóistín le háirithint ar iarratas ní dhéantar an conradh ach nuair a ghlacann an soláthraí leis. Go dtí sin féadfar do mhodh íocaíochta a réamhúdarú ach ní féidir é a dhochar.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. A ndéanaimidne",
          paragraphs: [
            "Cuirimid an tArdán ar fáil, taispeánaimid fógraí na soláthraithe, glacaimid le d'áirithint, cuirimid ar aghaidh chuig an soláthraí í agus seolaimid deimhniú na háirithinte chugat.",
            "Próiseálaimid an íocaíocht, a mhéid a fhoráiltear san fhógra d'íocaíocht tríd an Ardán, agus cuirimid an fheidhm teachtaireachtaí ar fáil eadrat féin agus an soláthraí.",
            "Ní chuirimid an lóistín ar fáil, ní oibrímid é agus ní thugaimid barántas maidir lena riocht. Ní muidne do thionscnóir turas.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. A gcaithfidh tusa a dhéanamh",
          paragraphs: [
            "Léigh an fógra ina iomláine roimh an áirithint: trealamh, teorainn áitíochta, amanna teachta agus imeachta, rialacha an tí, coinníollacha cealaithe agus na costais nach dtagann chun cinn ach ar an láthair.",
            "Comhlíon an t-uaslíon áitíochta atá luaite san fhógra. Má thagann níos mó daoine ná mar a cuireadh in áirithe, féadfaidh an soláthraí diúltú glacadh leo nó formhuirear a éileamh.",
            "Comhlíon rialacha tí an tsoláthraí agus na [Bunrialacha d'aíonna](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Caitheann tú go cúramach leis an lóistín agus tá tú faoi dhliteanas as damáiste a dhéanann tú féin nó do chomhthaistealaithe.",
            "Má theastaíonn sonraí clárúcháin ón soláthraí nó ó údarás (m.sh. foirm chlárúcháin, sonraí cárta aitheantais, dearbhú táille turasóireachta), cuireann tú ar fáil in am iad.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Praghsanna agus íocaíocht",
          paragraphs: [
            "Cuimsíonn an praghas iomlán praghas na hoíche don tréimhse a cuireadh in áirithe agus na formhuirir agus na táillí atá luaite san fhógra a ghearrtar tríd an Ardán.",
            "Féadfaidh suimeanna breise teacht chun cinn ar an láthair — go háirithe táille turasóireachta nó tobhaigh áitiúla, éarlais, chomh maith le seirbhísí breise a chuireann tú in áirithe ar an láthair. Léirímid iad sin roimh an áirithint a thabhairt chun críche mar chostais ar an láthair, a mhéid a thug an soláthraí iad.",
            "Má fhoráiltear éarlais san fhógra, bíonn an t-iarmhéid dlite ag an tráth atá luaite san fhógra. Mura n-íoctar an t-iarmhéid, féadfaidh an soláthraí tarraingt siar ón gconradh de réir a choinníollacha cealaithe.",
            "Ní ghlacaimid le híocaíochtaí leis an soláthraí lasmuigh den Ardán agus ní féidir linn iad a rianú; ní thagann siad faoinár bpróiseáil íocaíochta — féach [Táillí lasmuigh den ardán](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Athruithe, cealuithe agus aisíocaíochtaí",
          paragraphs: [
            "Braitheann sé ar choinníollacha cealaithe an tsoláthraí atá luaite san fhógra an féidir áirithint a chealú nó a athrú saor in aisce agus faoi cé na coinníollacha. Cuireann na [Coinníollacha cealaithe](https://mybestdays.dk/rechtliches/stornierungsbedingungen) síos ar na coinníollacha a chuirimid ar fáil do sholáthraithe le roghnú.",
            "I gcás seirbhísí lóistín a chuirtear in áirithe do thréimhse shonraithe níl aon cheart dlíthiúil tarraingthe siar de ghnáth faoi Airteagal 16(l) de Threoir 2011/83/AE ná faoi na forálacha náisiúnta comhfhreagracha. Ní dhéantar difear do chearta dlíthiúla sainordaitheacha.",
            "Má chealaíonn an soláthraí, aisíocaimid go hiomlán an tsuim a íocadh tríd an Ardán. Ina theannta sin baineann an [Beartas atháirithinte agus aisíocaíochta](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Má chuireann teagmhas atá lasmuigh de smacht an dá pháirtí cosc ar an turas nó ar an bhfanacht, baineann an [Beartas maidir le suaitheadh tromchúiseach](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Déantar aisíocaíochtaí chuig an modh íocaíochta a úsáideadh don íocaíocht, mura gcomhaontaítear a mhalairt.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. A gcaithfidh tú a fhios a bheith agat freisin",
          paragraphs: [
            "Féadfaidh soláthraithe a bheith ina n-óstaigh phríobháideacha nó ina dtrádálaithe. Léirímid san fhógra an ngníomhaíonn soláthraí mar thrádálaí. Mura trádálaí atá i gceist, ní bhaineann forálacha an Aontais um chosaint tomhaltóirí leis an gconradh lóistín — tarraingímid d'aird ar an gcúinse sin san fhógra.",
            "Is chun treoshuímh atá na sonraí faoi shuíomh, faoin gceantar máguaird, faoi na fad agus faoi mheasúnuithe tríú páirtithe. Is iad na sonraí faoin tseirbhís a cuireadh in áirithe féin atá ceangailteach.",
            "I gceantair ina bhfuil oibleagáid chlárúcháin le haghaidh cíosa gearrthéarmaigh luaimid san fhógra an uimhir chlárúcháin a thug an soláthraí; féach [Cíos gearrthéarmach](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "I gcás roinnt aonad comhionann de chineál réada nó seomra cuireann tú aonad amháin den chineál sin in áirithe. Is é an soláthraí a chinneann cén t-aonad sonrach a fhaigheann tú.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Gluais",
      paragraphs: [
        "Tá an bhrí atá luaite anseo ag na téarmaí seo a leanas sna coinníollacha seo.",
      ],
      definitions: [
        {
          term: "Soláthraí",
          description:
            "An duine nádúrtha nó dlítheanach a thairgeann lóistín tríd an Ardán agus a thagann chun bheith ina pháirtí sa chonradh lóistín.",
        },
        {
          term: "Áirithint ar iarratas",
          description:
            "Áirithint nach ndéantar ach tar éis don soláthraí glacadh léi go sainráite, murab ionann agus áirithint láithreach.",
        },
        {
          term: "Deimhniú áirithinte",
          description:
            "An teachtaireacht lena ndeimhnímid duit go bhfuil an conradh lóistín déanta; tá an soláthraí, an tseirbhís, an tréimhse, an praghas iomlán agus na coinníollacha cealaithe inti.",
        },
        {
          term: "Aonad",
          description:
            "An réad sonrach is féidir a chur in áirithe faoi chineál réada nó seomra. Díoltar an t-aonad, ach déantar cur síos ar an gcineál agus praghas a shocrú dó.",
        },
        {
          term: "Praghas iomlán",
          description:
            "An tsuim a thaispeántar agus an áirithint á tabhairt chun críche, lena n-áirítear gach cáin agus gach táille a ghearrtar tríd an Ardán.",
        },
        {
          term: "Uaslíon áitíochta",
          description:
            "An líon is mó daoine a cheadaítear a chodladh sa lóistín, mar atá luaite san fhógra.",
        },
        {
          term: "Éarlais",
          description:
            "Suim a éilíonn an soláthraí mar urrús in aghaidh damáiste agus a réamhúdaraítear nó a bhailítear agus a scaoiltear nó a fhritháirítear tar éis na fanachta.",
        },
        {
          term: "Táille turasóireachta",
          description:
            "Tobhach áitiúil ar oícheanta, a bhailítear ar an láthair nó tríd an soláthraí de réir an cheantair; ní seirbhís de chuid myBestDays í.",
        },
        {
          term: "Ardán",
          description:
            "An suíomh gréasáin, na feidhmchláir shoghluaiste agus gach pointe rochtana eile trína dtaispeánann myBestDays lóistín agus trína ndéanann sé áirithintí a idirghabháil.",
        },
        {
          term: "Táille seirbhíse",
          description:
            "An luach saothair as seirbhís idirghabhála myBestDays. Tá sé leagtha amach san eolas faoi tháillí seirbhíse cé a íocann í agus conas a léirítear í.",
        },
        {
          term: "Coinníollacha cealaithe",
          description:
            "Na rialacha a roghnaigh an soláthraí maidir leis an tráth deiridh a bhféadfar áirithint a chealú nó a athrú agus na costais a bhaineann leis.",
        },
        {
          term: "Lóistín",
          description:
            "An tseirbhís lóistín a thairgeann an soláthraí — réadmhaoin saoire nó aonad de chineál seomra nó réada.",
        },
        {
          term: "Costais ar an láthair",
          description:
            "Suimeanna nach ngearrtar tríd an Ardán ach a bhíonn dlite don soláthraí, mar shampla táille turasóireachta, éarlais nó seirbhísí breise a cuireadh in áirithe ar an láthair.",
        },
      ],
    },
  ],
};
