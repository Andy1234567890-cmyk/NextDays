import type { LegalDoc } from "../types";

// Irische Fassung der Gast-AGB. Quelle ist content/legal/agb/de.ts — Änderungen immer zuerst dort.
export const agb: LegalDoc = {
  title: "Téarmaí Úsáide d’Aíonna",
  stand: "Arna nuashonrú: 3 Iúil 2026",
  intro: [
    "Rialaíonn na Téarmaí Úsáide seo úsáid thairseach áirithinte myNextDays (an “tArdán” anseo feasta) ag taistealaithe agus ag daoine a dhéanann áirithintí (an “tAoi” anseo feasta).",
    "Is é [ainm dlíthiúil iomlán, foirm dhlíthiúil, seoladh agus sonraí cláir na cuideachta oibriúcháin — le comhlánú roimh fhoilsiú] a oibríonn an tArdán (“myNextDays” nó “muidne” anseo feasta).",
  ],
  sections: [
    {
      heading: "§ 1 Raon feidhme",
      paragraphs: [
        "Baineann na téarmaí seo le húsáid an Ardáin, go háirithe le cuardach cóiríochta agus le háirithint seirbhísí lóistín tríd an Ardán.",
        "Maidir leis an tseirbhís lóistín féin, beidh feidhm freisin ag téarmaí an tsoláthraí faoi seach (m.sh. rialacha tí, coinníollacha cealaithe) atá luaite san fhógra.",
      ],
    },
    {
      heading: "§ 2 Ról myNextDays; tabhairt i gcrích an chonartha",
      paragraphs: [
        "Feidhmíonn myNextDays mar idirghabhálaí do sheirbhísí lóistín a thairgeann na soláthraithe faoi seach (gníomhaireachtaí, bainisteoirí réadmhaoine nó úinéirí, an “Soláthraí” anseo feasta). Is idir an tAoi agus an Soláthraí faoi seach amháin a thugtar an conradh don chóiríocht i gcrích. Ní thagann myNextDays chun bheith ina pháirtí sa chonradh lóistín.",
        "Ainmnítear an Soláthraí faoi seach san fhógra agus sa deimhniú áirithinte.",
      ],
    },
    {
      heading: "§ 3 Áirithint agus deimhniú áirithinte",
      paragraphs: [
        "Is cuireadh chun tairiscint áirithinte a dhéanamh í taispeáint na cóiríochta ar an Ardán. Trí phróiseas na háirithinte a chríochnú (cliceáil ar an gcnaipe áirithinte a chuireann oibleagáid íocaíochta i bhfeidhm), déanann an tAoi tairiscint cheangailteach chun conradh lóistín a thabhairt i gcrích leis an Soláthraí.",
        "Tugtar an conradh i gcrích nuair a dheimhnítear an áirithint. Seoltar an deimhniú áirithinte chuig an Aoi ag an seoladh ríomhphoist a tugadh.",
        "Ní mór don Aoi faisnéis chruinn agus iomlán a sholáthar agus áirithint á déanamh aige (go háirithe ainm, sonraí teagmhála agus líon na dtaistealaithe).",
      ],
    },
    {
      heading: "§ 4 Praghsanna agus íocaíocht",
      paragraphs: [
        "Beidh feidhm ag na praghsanna atá luaite san fhógra tráth na háirithinte, lena n-áirítear na cánacha, na táillí agus na costais bhreise atá luaite ann. Taispeántar praghsanna san airgeadra atá luaite san fhógra. Féadfaidh muirir áitiúla bhreise (m.sh. cáin turasóireachta) a bheith le híoc ar an láthair i gcás ina luaitear sin san fhógra.",
        "Próiseáiltear an íocaíocht tríd an soláthraí seirbhíse íocaíochta Stripe. Is é Stripe a bhailíonn agus a phróiseálann sonraí íocaíochta (m.sh. sonraí cárta) go díreach; ní stórálann myNextDays sonraí cárta iomlána. Próiseálann Stripe sonraí pearsanta de réir [Pholasaí Príobháideachais Stripe](https://stripe.com/privacy).",
        "Má tá éarlais slándála luaite san fhógra, féadfar í a réamhúdarú tráth na háirithinte nó tráth an teachta agus í a choinneáil go hiomlán nó go páirteach i gcás damáiste; is iad na sonraí san fhógra atá cinntitheach.",
      ],
    },
    {
      heading: "§ 5 Cealú, atháirithint agus tarraingt siar",
      paragraphs: [
        "Is iad coinníollacha cealaithe an tSoláthraí atá luaite san fhógra a chinneann cé acu is féidir nó nach féidir áirithint a chealú nó a athrú saor in aisce, agus na coinníollacha faoina bhféadfar sin a dhéanamh.",
        "I gcás seirbhísí lóistín a chuirtear in áirithe do thréimhse ar leith, de ghnáth ní bhíonn aon cheart reachtúil chun tarraingt siar de bhun Airteagal 16(l) de Threoir an AE maidir le Cearta Tomhaltóirí ná na bhforálacha náisiúnta comhfhreagracha. Ní dhéantar difear do chearta reachtúla sainordaitheacha an Aoi.",
      ],
    },
    {
      heading: "§ 6 Oibleagáidí an Aoi",
      paragraphs: [
        "Úsáideann an tAoi an chóiríocht mar a comhaontaíodh, urramaíonn sé an uasáitíocht atá luaite san fhógra agus comhlíonann sé rialacha tí an tSoláthraí.",
        "Ní ceadmhach an tArdán a mhí-úsáid, go háirithe le haghaidh áirithintí bréige, íocaíochtaí calaoiseacha nó ábhar neamhdhleathach a phostáil (m.sh. i léirmheasanna nó i dteachtaireachtaí).",
      ],
    },
    {
      heading: "§ 7 Dliteanas myNextDays",
      paragraphs: [
        "Is é an Soláthraí amháin atá freagrach as an tseirbhís lóistín a sholáthar. Níl myNextDays faoi dhliteanas as cruinneas ábhar na bhfógraí a phostálann Soláthraithe, ach déanann sé an idirghabháil agus an phróiseáil íocaíochtaí le dúthracht gnó stuama.",
        "Tá myNextDays faoi dhliteanas gan teorainn i leith intinne agus mórfhaillí agus i leith damáiste a eascraíonn as díobháil don bheatha, don chorp nó don tsláinte. I gcásanna gnáthfhaillí, níl myNextDays faoi dhliteanas ach amháin i leith shárú oibleagáidí conarthacha bunriachtanacha (oibleagáidí cairdinéalta), teoranta don damáiste intuartha is gnách don chonradh. Ní dhéantar difear do rialacha dliteanais reachtúla sainordaitheacha.",
      ],
    },
    {
      heading: "§ 8 Cosaint sonraí",
      paragraphs: [
        "Próiseálann myNextDays sonraí pearsanta an Aoi chun an idirghabháil agus an áirithint a chur i gcrích. Tarchuirtear sonraí áirithinte chuig an Soláthraí faoi seach a mhéid is gá chun an conradh lóistín a chomhlíonadh. Baineann § 4 leis an bpróiseáil íocaíochtaí.",
        "Leagtar amach na mionsonraí i bhfaisnéis phríobháideachais an Ardáin.",
      ],
    },
    {
      heading: "§ 9 Gearáin agus réiteach díospóidí",
      paragraphs: [
        "Ba cheart don Aoi gearáin faoin gcóiríocht a dhíriú ar an Soláthraí ar dtús; maidir le ceisteanna faoin áirithint nó faoin íocaíocht, is féidir teagmháil a dhéanamh le tacaíocht myNextDays trí na bealaí teagmhála atá luaite ar an Ardán.",
        "Níl myNextDays faoi oibleagáid ná toilteanach páirt a ghlacadh in imeachtaí réitigh díospóidí os comhair bord eadrána tomhaltóirí, mura n-éilítear sin le dlí.",
      ],
    },
    {
      heading: "§ 10 Athruithe ar na téarmaí seo",
      paragraphs: [
        "Féadfaidh myNextDays na téarmaí seo a leasú le héifeacht don todhchaí más gá sin ar chúiseanna bailí (go háirithe athruithe ar an reachtaíocht nó ar an gcásdlí) agus mura gcuirtear an tAoi faoi mhíbhuntáiste míréasúnta dá bharr. Maidir le háirithintí atá tugtha i gcrích cheana, is é an leagan a bhí i bhfeidhm tráth na háirithinte a bheidh i bhfeidhm.",
      ],
    },
    {
      heading: "§ 11 Forálacha deiridh",
      paragraphs: [
        "Beidh feidhm ag dlí an stáit ina bhfuil oifig chláraithe an oibreora, gan Coinbhinsiún na Náisiún Aontaithe maidir le Conarthaí le haghaidh Díol Idirnáisiúnta Earraí a chur san áireamh. Más tomhaltóir é an tAoi, ní dhéantar difear d’fhorálacha sainordaitheacha cosanta tomhaltóirí an stáit ina bhfuil a ghnátháit chónaithe.",
        "Má bhíonn nó má thagann forálacha aonair de na téarmaí seo chun bheith neamhbhailí, ní dhéanfaidh sin difear do bhailíocht na bhforálacha eile.",
      ],
    },
  ],
};
