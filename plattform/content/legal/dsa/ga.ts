import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Gníomh um Sheirbhísí Digiteacha",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Is seirbhís idirghabhála agus ardán ar líne é myBestDays de réir bhrí Rialachán (AE) 2022/2065 maidir le margadh aonair do sheirbhísí digiteacha („an Gníomh um Sheirbhísí Digiteacha“, DSA). Cuireann an leathanach seo le chéile na sonraí agus na nósanna imeachta a éilíonn an Rialachán sin.",
    "Ní ardán an-mhór ar líne é myBestDays de réir bhrí Airteagal 33 den Rialachán. Ní bhaineann na hoibleagáidí breise a bhaineann leis sin linn dá bhrí sin — rioscaí sistéamacha a aithint, iniúchadh neamhspleách, cartlann fógraí agus foilsiú líon míosúil na n-úsáideoirí sa nós imeachta atá leagtha síos ansin.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Pointí teagmhála (Airteagail 11 agus 12)",
      paragraphs: [
        `Pointe teagmhála aonair d'údaráis na mballstát, don Choimisiún agus don Bhord Eorpach um Sheirbhísí Digiteacha: ${ANBIETER.email}, tríd an bpost ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
        `Pointe teagmhála aonair d'úsáideoirí: ${ANBIETER.email}. Sroicheann tú sinn ansin go díreach agus gan nós imeachta uathoibrithe roimh ré.`,
        "Is féidir cumarsáid a dhéanamh leis an dá phointe teagmhála i nGearmáinis, i nDanmhairgis agus i mBéarla.",
        `Níl gá ionadaí dlíthiúil san Aontas a ainmniú faoi Airteagal 13: tá an t-oibreoir bunaithe in ${ANBIETER.land} agus mar sin san Aontas.`,
        `Comhordaitheoir inniúil seirbhísí digiteacha faoi Airteagal 49: ${DSA_KOORDINATOR.name}, ${DSA_KOORDINATOR.land} ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Ábhar mídhleathach a thuairisciú (Airteagal 16)",
      paragraphs: [
        "Is féidir le duine ar bith ábhar a mheasann sé a bheith mídhleathach a thuairisciú dúinn. Bain úsáid as an bhfeidhm tuairiscithe atá ar fáil ag gach fógra, gach léirmheas agus gach teachtaireacht, nó as an bpointe teagmhála d'úsáideoirí.",
        "Ionas gur féidir linn tuairisc a mheas gan scrúdú dlíthiúil doimhin, ba cheart go mbeadh na nithe seo a leanas inti:",
      ],
      list: [
        "míniú réasúnaithe go leor ar an bhfáth a bhfuil an t-ábhar mídhleathach;",
        "an tagairt leictreonach bheacht, go háirithe an URL;",
        "ainm agus seoladh ríomhphoist an duine a dhéanann an tuairisc — ach amháin i gcás tuairiscí faoi chionta i gcoinne féinchinneadh gnéasach leanaí, áit a bhfuil an sonra sin deonach;",
        "an dearbhú go bhfuil na sonraí ceart agus iomlán chomh fada agus is eol don duine.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Conas a láimhseálaimid tuairiscí",
      paragraphs: [
        "Deimhnímid an fháil gan mhoill agus cinnimid go tráthúil, go cúramach, gan treallachas agus go hoibiachtúil.",
        "Má tá na sonraí ó mhír 2 i dtuairisc, bunaíonn sí ár n-eolas de réir bhrí Airteagal 6 den Rialachán.",
        "Cuirimid ár gcinneadh in iúl don duine a rinne an tuairisc agus tarraingímid aird ar na leigheasanna atá ar fáil.",
        "I gcás láimhseála uathoibrithe cuirimid é sin in iúl.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Cúis a thabhairt le bearta (Airteagal 17)",
      paragraphs: [
        "Má chuirimid teorainn le feiceálacht ábhair, má bhainimid é, má bhacaimid rochtain air, má chuirimid íocaíochtaí ar fionraí, má bhacaimid soláthar na seirbhíse nó an cuntas, faigheann an duine lena mbaineann cúis shoiléir shonrach.",
        "Luaitear sa chúis cineál agus raon feidhme an bhirt, a raon feidhme geografach agus ama, na fíricí agus na himthosca a bhí mar bhonn leis an gcinneadh, ar bhain próiseáil uathoibrithe leis, an bunús dlí nó an fhoráil chonartha a sáraíodh agus na leigheasanna atá ar fáil.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Amhras faoi chionta coiriúla (Airteagal 18)",
      paragraphs: [
        "Má tá comharthaí ann ar chion coiriúil a chruthaíonn contúirt do bheatha nó do shábháilteacht duine, cuirimid na húdaráis forfheidhmithe dlí nó bhreithiúnacha inniúla ar an eolas gan mhoill.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. An córas gearán inmheánach (Airteagal 20)",
      paragraphs: [
        "Is féidir gearán a dhéanamh saor in aisce laistigh de shé mhí i gcoinne gach birt faoi mhír 4 agus i gcoinne dhiúltú tuairisce.",
        "Láimhseáiltear gearáin go tráthúil, gan idirdhealú agus go cúramach — faoi mhaoirseacht daoine cáilithe agus ní le modhanna uathoibrithe amháin.",
        "Má léirítear go bhfuil gearán bunaithe, tarraingímid an beart siar. Cuireann [Gearáin agus réiteach díospóidí](https://mybestdays.dk/rechtliches/beschwerden) síos ar an mbealach.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Réiteach díospóidí lasmuigh den chúirt (Airteagal 21)",
      paragraphs: [
        "Is féidir le húsáideoirí dul chuig comhlacht réitigh díospóidí lasmuigh den chúirt atá deimhnithe ag an gcomhordaitheoir inniúil seirbhísí digiteacha i gcás díospóidí faoi bhearta faoi mhír 4. Coinníonn an Coimisiún Eorpach liosta na gcomhlachtaí deimhnithe.",
        "Níl cinntí na gcomhlachtaí sin ceangailteach orainn; nílimid faoi oibleagáid páirt a ghlacadh i nósanna imeachta soláthraithe neamhspleácha. Fanann an bealach chun na gcúirteanna gan athrú.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Tuairisceoirí iontaofa (Airteagal 22)",
      paragraphs: [
        "Láimhseálaimid le tosaíocht tuairiscí a chuireann tuairisceoir atá aitheanta mar thuairisceoir iontaofa isteach ina réimse saineolais.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Bearta i gcoinne mí-úsáide (Airteagal 23)",
      paragraphs: [
        "Bacaimid ar feadh tréimhse réasúnach, tar éis rabhaidh roimh ré, cuntais a chuireann ábhar follasach mídhleathach ar fáil go minic.",
        "Cuirimid láimhseáil tuairiscí agus gearán ar fionraí do dhaoine a chuireann tuairiscí nó gearáin fhollasacha gan bhunús isteach go minic — tar éis rabhaidh roimh ré freisin.",
        "Scrúdaímid gach cás aonair: líon, cion agus déine na n-imeachtaí lena mbaineann chomh maith leis an intinn.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Tuarascálacha trédhearcachta (Airteagail 15 agus 24)",
      paragraphs: [
        "Foilsímid tuarascáil bhliantúil ar mhodhnú ábhair: líon na n-orduithe ó údaráis, líon agus cineál na dtuairiscí, na bearta a glacadh, líon na ngearán agus a dtoradh, sonraí faoi úsáid nósanna imeachta uathoibrithe chomh maith le líon na ndíospóidí os comhair comhlachtaí lasmuigh den chúirt.",
        `Tá micrifhiontair agus fiontair bheaga díolmhaithe ó chuid de na hoibleagáidí sin faoi Airteagal 19 den Rialachán. Fad a bhaineann an díolúine, cuirimid na sonraí ar fáil ar iarratas ag ${ANBIETER.email}; a luaithe a fhoilsítear an chéad tuarascáil, cuirfear nasc léi ag an bpointe seo.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Inrianaitheacht soláthraithe (Airteagail 30 go 32)",
      paragraphs: [
        "Ní féidir le soláthraithe a thrádálann go tráchtálach ar an Ardán tairiscint go dtí go bhfuil ainm, seoladh, uimhir theileafóin, seoladh ríomhphoist, sonraí cláir, uimhir aitheantais cánach breisluacha agus cuntas íocaíochta curtha chugainn acu agus go bhfuil a sonraí sochreidte.",
        "Taispeánaimid na sonraí sin san fhógra, a mhéid a fhoráiltear sin sa Rialachán.",
        "Má fhaighimid amach go raibh táirge nó seirbhís mhídhleathach i gceist le fógra, cuirimid na haíonna lena mbaineann ar an eolas, a mhéid atá a sonraí teagmhála againn.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Córais mholta (Airteagal 27)",
      paragraphs: [
        "Tá príomhpharaiméadair ord na dtorthaí cuardaigh agus na moltaí chomh maith leis an bhféidearthacht tionchar a imirt orthu curtha síos faoi [Praghsanna, rangú agus moltaí](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Fógraíocht (Airteagal 26)",
      paragraphs: [
        "Ní thaispeánaimid aon fhógraíocht íoctha ó thríú páirtithe faoi láthair ná aon suíomh íoctha sna torthaí cuardaigh.",
        "Má thugaimid fógraíocht isteach, marcálfaimid go soiléir í, ainmneoimid an fógróir agus príomhpharaiméadair an taispeána. Eisiaimid fógraíocht atá bunaithe ar chatagóirí speisialta sonraí pearsanta faoi Airteagal 9 de Rialachán (AE) 2016/679 agus fógraíocht do mhionaoisigh atá bunaithe ar phróifíliú.",
      ],
    },
  ],
};
