import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Beartas fianán",
  stand: "Nuashonraithe: 18 Lúnasa 2026",
  intro: [
    "Míníonn an beartas seo cé na fianáin agus na teicneolaíochtaí comhchosúla a úsáideann myBestDays, chun cad é, cé chomh fada agus a stóráiltear iad agus conas is féidir leat iad a rialú.",
    "Comhlánaíonn sé an [Ráiteas cosanta sonraí](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Cad is fianáin ann",
      paragraphs: [
        "Is comhaid bheaga téacs iad fianáin a stórálann suíomh gréasáin i do bhrabhsálaí. Is teicneolaíochtaí comhchosúla iad stóras logánta an bhrabhsálaí agus picteilíní comhairimh i ríomhphoist.",
        "Is féidir linn fianáin atá fíor-riachtanach d'oibriú an Ardáin a shocrú gan do thoiliú. Iarraimid do thoiliú do gach ceann eile (Airteagal 5(3) de Threoir 2002/58/CE).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Fianáin riachtanacha",
      paragraphs: [
        "Tá na fianáin seo riachtanach don oibriú agus ní féidir iad a dhíroghnú. Úsáidimid faoi láthair:",
      ],
      list: [
        "„nd_access“ — coinníonn sé do shíniú isteach. Inléite ag an bhfreastalaí amháin (HttpOnly), ré de réir bhailíocht an tseisiúin.",
        "„nd_refresh“ — athnuann sé do shíniú isteach ionas nach gá duit síniú isteach as an nua i gcónaí. Inléite ag an bhfreastalaí amháin, ré 30 lá.",
        "„nd_gast_locale“ — cuimhníonn sé ar an teanga a roghnaigh tú. Ré bliain amháin.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Fianáin fheidhmiúla, staitistice agus margaíochta",
      paragraphs: [
        "Ní úsáideann myBestDays aon fhianáin faoi láthair le haghaidh staitistice, tomhas raoin ná fógraíochta agus ní leabaímid aon líonra fógraíochta ná seirbhís anailíse.",
        "Má athraíonn sé sin, iarrfaimid do thoiliú roimh ré trí dhialóg roghnúcháin ina bhfuil diúltú chomh héasca leis an nglacadh, agus cuirfimid na fianáin chruinne leis an mbeartas seo.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Ábhar leabaithe ó thríú páirtithe",
      paragraphs: [
        "Is féidir go bhfuil léarscáileanna leabaithe ar leathanaigh mhionsonraithe. Ní lódálaimid ábhar den sórt sin go dtí go gcuireann tú i ngníomh go sainráite é; ní féidir sonraí a aistriú chuig an soláthraí faoi seach go dtí sin.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Conas a rialaíonn tú fianáin",
      paragraphs: [
        "Is féidir leat do thoiliú a athrú nó a tharraingt siar am ar bith trí na socruithe fianán sa bhunlíne.",
        "Ina theannta sin is féidir leat fianáin a scriosadh nó a bhac i do bhrabhsálaí. Má scriosann tú na fianáin riachtanacha, sínítear amach tú agus oibríonn an tArdán go teoranta.",
      ],
    },
  ],
};
