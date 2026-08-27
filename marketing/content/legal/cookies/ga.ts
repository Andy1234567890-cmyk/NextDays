// Irische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Beartas Fianán",
  metaDescription:
    "Cé na fianáin a shocraíonn myNextDays: fianáin atá riachtanach go teicniúil agus – le do thoil amháin – fianáin fheidhmiúla, anailíseacha agus margaíochta. Is féidir gach catagóir a chur ar siúl agus a mhúchadh ina n-aonar.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Míníonn an beartas seo na fianáin agus na teicnící stórála comhchosúla a úsáideann ${ANBIETER.firma} ar an suíomh gréasáin seo agus ar ardán myNextDays.`,
    "Go hachomair: Níl ach na fianáin riachtanach, gan iad ní fheidhmeoidh an suíomh Gréasáin mar a iarradh. Teastaíonn do thoiliú le gach rud eile agus ní lódálfar é gan é – cosaint turscair ár bhfoirm teagmhála, tomhas raon feidhme agus fianáin mhargaíochta, a úsáidimid chun rath ár bhfógraíochta a thomhas. Is féidir leat gach ceann de na catagóirí seo a cheadú nó a dhiúltú ina n-aonar agus do chinneadh a chúlghairm am ar bith.",
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
        "Ní mór duit toiliú a thabhairt do thrí chatagóir, nach lódálfar aon cheann acu gan do chead: cosaint turscair ár bhfoirm teagmhála (reCAPTCHA ó Google), tomhas raon feidhme an tsuímh Ghréasáin seo (Google Analytics 4) agus na fianáin mhargaíochta (Meta, LinkedIn, Google Ads). Chuige sin, iarrann fuinneog le liosta catagóirí – ar an gcéad chuairt, gan réamhroghnú, gach catagóir le lasc féin. Chomh fada agus nach bhfuil cinneadh déanta agat, tá “gan cead” i bhfeidhm, agus ní dhéanfar meastóireacht ná fógraíocht.",
        "Tá do chinneadh stóráilte i stóráil do bhrabhsálaí (Local Storage, luach “nd_consent”); ní bhfuil ann ach an chatagóir, an t-am agus uimhir leagain, gan aon sainaitheantóir pearsanta. Is féidir leat é a athrú nó a chúlghairm tráth ar bith trí dheilbhín na bhfianán i gcúinne bun chlé gach leathanaigh. Tar éis sé mhí, fiafróimid díot arís — níor cheart go mbeadh toiliú bailí gan teorainn ama.",
      ],
    },
    {
      heading: "An suíomh gréasáin seo",
      paragraphs: [
        "Ní shocraíonn an suíomh Gréasáin seo fianáin as féin. Tá clónna agus siombailí ar ár bhfreastalaí féin – ní ghlaoitear ar aon seirbhís siombailí nó clónna tríú páirtí chuige sin. Níl ach na seirbhísí a cheadaíonn tú: cosaint turscair na foirme teagmhála, tomhas raon feidhme agus seirbhísí margaíochta. Cé na fianáin a shocraítear, cén tréimhse bailíochta agus cén t-óstach, tá sé thíos sa chuid “Fianáin Tríú Páirtí”. Cúlghairm tríd an deilbhín fianán ag bun ar chlé – cuirtear deireadh leis an tseirbhís ábhartha láithreach agus scriostar a fianáin. Tá sonraí sa [Beartas Príobháideachais](/datenschutz).",
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
          titel:
            "sb-… — síniú isteach le Google (riachtanach go teicniúil, ach amháin nuair a úsáidtear é)",
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
            "Coinníonn sé do chinneadh maidir leis na seirbhísí a dteastaíonn toiliú leo (cosaint turscair na foirme teagmhála agus tomhas raon feidhme).",
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
        "Ní shocróidh seirbhísí Google fianáin ar an suíomh Gréasáin seo ach amháin le do thoiliú — dhá cheann le haghaidh tomhas an lucht féachana, ceann amháin le haghaidh cosaint turscair. Gan do thoiliú, ní lódálfar an script faoi seach agus ní shocrófar aon cheann de na fianáin seo; má tharraingíonn tú siar do thoiliú, scriosfaimid iad.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Tomhas rathúlachta fógraíochta (Éilíonn toiliú)",
          list: [
            "Cuspóir: Ceanglaíonn sé do chuairt le fógra chun go mbeimid in ann rathúlacht ár bhfeachtas a thomhas.",
            "Ábhar: Aitheantóir a ghintear go randamach; níl aon ainm, ríomhphost, ná sonraí cuntais uainn.",
            "Soláthraí: Meta Platforms Ireland Limited, Bóthar Merrion, Baile Átha Cliath 4, Éire.",
            "Óstach: mynextdays.com (Fianán céadpháirtí, socraithe ag script Meta). Tréimhse bailíochta: thart ar thrí mhí.",
          ],
        },
        {
          titel: "_gcl_au — Tomhas rathúlachta Google Ads (Éilíonn toiliú)",
          list: [
            "Cuspóir: Ceanglaíonn sé do chuairt le fógra Google chun go mbeimid in ann rathúlacht ár bhfeachtas a thomhas.",
            "Ábhar: Aitheantóir a ghintear go randamach gan aon tagairt do d'aitheantas pearsanta.",
            "Soláthraí: Google Ireland Limited, Gordon House, Sráid Barrow, Baile Átha Cliath 4, Éire.",
            "Óstach: mynextdays.com (Fianán céadpháirtí). Tréimhse bailíochta: thart ar thrí mhí.",
          ],
        },
        {
          titel: "li_gc agus bcookie — Fógraíocht LinkedIn (Éilíonn toiliú)",
          list: [
            "Cuspóir: Aithníonn sé do bhrabhsálaí do LinkedIn ionas gur féidir fógraí agus a rathúlacht a shannadh; stórálann li_gc do thoiliú ansin freisin.",
            "Ábhar: Aitheantóir brabhsálaí chomh maith le stádas toilithe; níl aon sonraí ó do chuntas againn.",
            "Soláthraí: LinkedIn Ireland Unlimited Company, Wilton Plaza, Baile Átha Cliath 2, Éire.",
            "Óstach: linkedin.com (Fianáin tríú páirtí). Tréimhse bailíochta: thart ar sé mhí nó bliain.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Cosaint turscair an fhoirm teagmhála (toiliú ag teastáil)",
          list: [
            "Óstach: www.google.com (Fianán tríú páirtí).",
            "Cuspóir: Ligeann sé do Google measúnú riosca a dhéanamh chun idirdhealú a dhéanamh idir teachtaireachtaí uathoibrithe agus fiosrúcháin fhíora.",
            "Ábhar: Aitheantóir a ghineann Google don mheasúnú seo; níl aon ainm, ríomhphost, ná sonraí cuntais uainn.",
            "Soláthraí: Google Ireland Limited, Gordon House, Barrow Street, Baile Átha Cliath 4, Éire.",
            "Tréimhse: Socraithe ag Google, suas le sé mhí. Ní shocraítear é ach amháin má cheadaigh tú an chosaint turscair agus má d'oscail tú an fhoirm teagmhála.",
          ],
        },
        {
          titel: "_ga — Tomhas raon feidhme (teastaíonn toiliú)",
          list: [
            "Óstach: mynextdays.com (Fianán céadpháirtí, socraithe ag script Google).",
            "Cuspóir: idirdhealaíonn sé cuairteoirí ionas nach ndéantar glaonna athfhillteacha a chomhaireamh faoi dhó.",
            "Ábhar: aitheantóir randamach ginte gan aon bhaint le do dhuine; gan aon ainm, ríomhphost nó sonraí cuntais.",
            "Soláthraí: Google Ireland Limited, Gordon House, Barrow Street, Baile Átha Cliath 4, Éire.",
            "Tréimhse: suas le dhá bhliain.",
          ],
        },
        {
          titel:
            "_ga_<aitheantóir> — Stádas seisiúin an tomhais (teastaíonn toiliú)",
          list: [
            "Óstach: mynextdays.com (Fianán céadpháirtí, socraithe ag script Google).",
            "Cuspóir: taifeadann sé cathain a thosaigh do chuairt reatha, ionas go mbaineann radhairc leathanaigh de sheisiún le chéile.",
            "Ábhar: stampa ama agus cuntar an tseisiúin; tagraíonn an t-aitheantóir san ainm dár maoin, ní duitse.",
            "Soláthraí: Google Ireland Limited.",
            "Tréimhse: suas le dhá bhliain.",
          ],
        },
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
