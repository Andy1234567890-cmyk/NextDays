// Irische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Beartas Fianán",
  metaDescription:
    "Na fianáin a úsáideann myNextDays: fianáin atá riachtanach go teicniúil agus feidhmiúil amháin, gan aon fhianáin rianaithe ná fógraíochta.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Míníonn an beartas seo na fianáin agus na teicnící stórála comhchosúla a úsáideann ${ANBIETER.firma} ar an suíomh gréasáin seo agus ar ardán myNextDays.`,
    "I mbeagán focal: ní úsáidimid ach fianáin atá riachtanach go teicniúil agus feidhmiúil. Níl aon fhianáin anailíse, fógraíochta ná rianaithe ann, agus ní chuirtear sonraí úsáide ar aghaidh chuig líonraí fógraíochta.",
  ],
  sections: [
    {
      heading: "Cad iad fianáin",
      paragraphs: [
        "Is comhaid téacs bheaga iad fianáin a stórálann suíomh gréasáin sa bhrabhsálaí. Cuireann siad ar chumas seisiún a aithint arís — mar shampla, ionas go bhfanfaidh tú logáilte isteach tar éis duit síniú isteach. Chomh maith le fianáin, úsáideann brabhsálaithe stóráil eile freisin, ar nós Local Storage, a fheidhmíonn go teicniúil ar bhealach cosúil leis.",
      ],
    },
    {
      heading: "Cén fáth a bhfuil do thoiliú ag teastáil uainn",
      paragraphs: [
        "Ní gá toiliú faoi Airteagal 9 den rialachán Danmhargach maidir le fianáin (Cookie-bekendtgørelsen) (lena gcuirtear Airteagal 5(3) de Threoir 2002/58/CE chun feidhme) ach amháin nuair nach mbaineann rochtain ar do ghléas go heisiach le teachtaireacht a tharchur nó nach bhfuil sí fíor-riachtanach do sheirbhís a d'iarr tú féin go sainráite.",
        "Tá gach fianán a shocraímid riachtanach don síniú isteach, do shlándáil an tseisiúin, nó do shocrú a rinne tú féin — ní iarraimid aon rud dá bharr sin, agus ní shocraímid a mhalairt ach an oiread aon rud a mbeadh toiliú ag teastáil dó.",
        "Ní gá duit toiliú a thabhairt ach le haghaidh rud amháin go beacht: cosaint spam ár bhfoirm teagmhála. Tagann sé sin ó Google (reCAPTCHA Enterprise), is é sin le rá gur seirbhís sheachtrach í, agus ní luchtaítear í ach amháin má cheadaigh tú í. Fiafraíonn barra ag bun an scáileáin díot é sin — ar an gcéad chuairt, le cnaipí atá ar chomhchéim dar teideal “Diúltaigh” agus “Glac Leis”, gan aon roghnú réamhshocraithe. Go dtí go mbeidh cinneadh déanta agat, tá feidhm ag “níl sé ceadaithe”.",
        "Tá do chinneadh stóráilte i stóráil do bhrabhsálaí (Local Storage, luach “nd_consent”); ní bhfuil ann ach an chatagóir, an t-am agus uimhir leagain, gan aon sainaitheantóir pearsanta. Is féidir leat é a athrú nó a chúlghairm tráth ar bith ag bun an leathanaigh seo.",
      ],
    },
    {
      heading: "An suíomh gréasáin seo",
      paragraphs: [
        "Ní shocraíonn an suíomh gréasáin margaíochta aon fhianáin. Tá clófhoirne agus deilbhíní lonnaithe ar ár bhfreastalaí féin — ní ghlaotar ar aon tseirbhís deilbhín ná clófhoirne ó thríú páirtí chuige sin. Is é an t-aon tseirbhís sheachtrach ar an leathanach seo cosaint spam an fhoirm teagmhála, agus ní luchtaítear í ach le do thoiliú. Tá tuilleadh sonraí sa [Pholasaí Príobháideachais](/datenschutz).",
      ],
    },
    {
      heading: "Fianáin an ardáin",
      paragraphs: [
        "A luaithe a shíníonn tú isteach sa deais rialaithe, sa mhargadh nó san amharc soghluaiste, socraítear na fianáin seo a leanas:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — síniú isteach (riachtanach go teicniúil)",
          list: [
            "Cuspóir: sainaithníonn sé do sheisiún sínithe isteach don fhreastalaí.",
            "Ábhar: comhartha rochtana gearrshaolach; inléite ag an bhfreastalaí amháin (HttpOnly), ní tharchuirtear é ach trí HTTPS.",
            "Ré: fad an tseisiúin nó go dtí go rachaidh an comhartha in éag.",
          ],
        },
        {
          titel: "nd_refresh — fadú seisiúin (riachtanach go teicniúil)",
          list: [
            "Cuspóir: athnuann sé an comhartha rochtana ionas nach mbeidh ort síniú isteach arís agus arís eile.",
            "Ábhar: comhartha athnuachana; HttpOnly, trí HTTPS amháin.",
            "Ré: go dtí go síneofar amach nó go dtí go rachaidh sé in éag.",
          ],
        },
        {
          titel: "nd_locale — rogha teanga (feidhmiúil)",
          list: [
            "Cuspóir: cuimhníonn sé ar an teanga a roghnaigh tú.",
            "Ábhar: cód teanga, m.sh. “de” nó “en”.",
            "Ré: go dtí go n-athrófar nó go scriosfar é.",
          ],
        },
        {
          titel: "sidebar_state — barra taoibh (feidhmiúil)",
          list: [
            "Cuspóir: cuimhníonn sé an bhfuil an barra loingseoireachta leathnaithe nó laghdaithe.",
            "Ábhar: “true” nó “false”.",
            "Ré: go dtí go n-athrófar nó go scriosfar é.",
          ],
        },
        {
          titel: "sb-… — síniú isteach le Google (riachtanach go teicniúil, ach amháin nuair a úsáidtear é)",
          list: [
            "Cuspóir: coinníonn sé an seisiún nuair a shíníonn tú isteach trí Google.",
            "Ábhar: comhartha seisiúin na seirbhíse síniú isteach.",
            "Ré: fad an tseisiúin nó go dtí go rachaidh an comhartha in éag. Ní shocraítear é ach amháin má roghnaíonn tú síniú isteach trí Google.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Coinníonn sé do chinneadh maidir le cosaint spam an fhoirm teagmhála, ionas nach bhfiafróidh an barra toilithe díot arís ag gach cuairt. Ní stóráiltear ach an chatagóir, an t-am agus uimhir leagain. Ní fhágann an luach do ghléas agus ní tharchuirtear chuig ár bhfreastalaí é; baineann sé leis an mbrabhsálaí seo amháin. Má scriosann tú é, fiafróidh an barra díot arís ar do chéad chuairt eile.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Ní shocraítear é ach amháin má osclaíonn tú féin comhrá ar an suíomh gréasáin seo agus má sheolann tú teachtaireacht. Is í an eochair chuig do chomhrá féin é — dá uireasa ní aimseofá ár bhfreagra arís tar éis duit leathanach eile a oscailt. Níl aon fhaisnéis fút féin ann agus ní úsáidtear é ach amháin chun na críche seo.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Stórálann sé sa bhrabhsálaí ar thoiligh tú le húsáid an ionchuir ghutha, ionas nach n-iarrfar an toiliú sin arís ag gach cuairt. Ní fhágann an luach do ghléas.",
          ],
        },
      ],
    },
    {
      heading: "Fianáin na haipe soghluaiste",
      paragraphs: [
        "Ní oibríonn an aip shoghluaiste le fianáin. Stóráiltear comharthaí rochtana agus athnuachana i stóras eochracha slán an ghléis (iOS Keychain, Android Keystore) agus scriostar iad nuair a shíneofar amach.",
      ],
    },
    {
      heading: "Fianáin tríú páirtí",
      paragraphs: [
        "Nuair a dhéanann tú íocaíocht, féadfaidh an soláthraí seirbhíse íocaíochta (Stripe nó PayPal) fianáin a shocrú ar a leathanach féin atá riachtanach don phróiseáil agus don chosc ar chalaois. Baineann téarmaí an tsoláthraí ábhartha leis sin.",
        "Ar shuíomhanna gréasáin a chruthaíonn gnólachtaí lenár dtógálaí, is é an gnólacht ábhartha a chinneann faoi fhianáin bhreise agus atá freagrach as an bhfaisnéis a thugtar ansin.",
      ],
    },
    {
      heading: "Fianáin a scriosadh agus a rialú",
      paragraphs: [
        "Is féidir leat fianáin a scriosadh nó a bhlocáil tráth ar bith i socruithe do bhrabhsálaí. Má chuireann tú bac ar na fianáin riachtanacha, ní bheidh sé indéanta go teicniúil síniú isteach san ardán — fanfaidh an suíomh gréasáin poiblí agus an margadh inúsáidte gan síniú isteach.",
        "Nuair a shíneoimid amach, baintear na fianáin síniúcháin isteach dínn féin.",
      ],
    },
    {
      heading: "Athruithe ar an mbeartas seo",
      paragraphs: [
        "Má chuirtear feidhmeanna nua leis a bhfuil fianáin bhreise ag teastáil uathu, nuashonróimid an liosta seo. Is í an leagan a fhoilsítear anseo a bhaineann feidhm i gcónaí; taispeánann an dáta thuas an stádas.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
